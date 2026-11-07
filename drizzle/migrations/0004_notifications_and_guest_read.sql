-- Create notifications table
create table if not exists public.mess_notifications (
  id uuid primary key default gen_random_uuid(),
  mess_id uuid not null references public.messes(id) on delete cascade,
  sender_id uuid references public.mess_members(id) on delete set null,
  recipient_id uuid references public.mess_members(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  message text not null check (char_length(trim(message)) between 1 and 1000),
  type text not null default 'notice' check (type in ('notice', 'reminder', 'alert', 'info')),
  created_at timestamptz not null default now()
);

grant select, insert, delete on public.mess_notifications to authenticated;
grant select on public.mess_notifications to anon;
alter table public.mess_notifications enable row level security;

-- Admin can manage all notifications in their mess
create policy "admin all notifications" on public.mess_notifications
  for all to authenticated
  using (public.is_mess_admin(mess_id))
  with check (public.is_mess_admin(mess_id));

-- Authenticated member reads broadcast notifications or notifications specifically for them
create policy "member reads notifications" on public.mess_notifications
  for select to authenticated
  using (
    mess_id = public.my_mess_id() and
    (recipient_id is null or recipient_id = public.my_member_id())
  );

-- Function 1: Lookup mess preview and active member list by 6-digit invite code (accessible to guest members)
create or replace function public.get_mess_by_invite_code(_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare _mess record; _members json;
begin
  if coalesce(_code, '') !~ '^[0-9]{6}$' then
    raise exception 'Invalid 6-digit code format';
  end if;

  select id, name, manager, address, currency, meal_categories, household_categories
  into _mess
  from public.messes
  where invite_code = _code;

  if _mess.id is null then
    raise exception 'No mess found with that invitation code.';
  end if;

  select json_agg(json_build_object('id', id, 'name', name, 'room', room, 'tone', tone, 'role', role, 'status', status) order by created_at)
  into _members
  from public.mess_members
  where mess_id = _mess.id and status <> 'left';

  return json_build_object(
    'id', _mess.id,
    'name', _mess.name,
    'manager', _mess.manager,
    'address', _mess.address,
    'currency', _mess.currency,
    'meal_categories', _mess.meal_categories,
    'household_categories', _mess.household_categories,
    'members', coalesce(_members, '[]'::json)
  );
end $$;

-- Function 2: Full read-only workspace load by invite code (accessible to guest members without Google sign-in)
create or replace function public.get_workspace_by_invite_code(_code text, _month text, _member_id uuid default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  _mess record;
  _start date;
  _end date;
  _year int;
  _month_num int;
  _members json;
  _meals json;
  _expenses json;
  _summary json;
  _notifications json;
begin
  if coalesce(_code, '') !~ '^[0-9]{6}$' then
    raise exception 'Invalid 6-digit code format';
  end if;

  select id, owner_id, name, manager, address, currency, start_day, meal_categories, household_categories, show_invite_to_members
  into _mess
  from public.messes
  where invite_code = _code;

  if _mess.id is null then
    raise exception 'No mess found with that invitation code.';
  end if;

  _year := substring(_month from 1 for 4)::int;
  _month_num := substring(_month from 6 for 2)::int;
  _start := make_date(_year, _month_num, 1);
  if _month_num = 12 then
    _end := make_date(_year + 1, 1, 1);
  else
    _end := make_date(_year, _month_num + 1, 1);
  end if;

  select json_agg(row_to_json(m) order by m.created_at)
  into _members
  from (
    select id, user_id, role, name, phone, room, joined, status, tone
    from public.mess_members
    where mess_id = _mess.id
  ) m;

  select json_agg(row_to_json(ml) order by ml.date desc)
  into _meals
  from (
    select id, member_id, date, breakfast, lunch, dinner
    from public.mess_meals
    where mess_id = _mess.id and date >= _start and date < _end
  ) ml;

  select json_agg(row_to_json(e) order by e.date desc, e.created_at desc)
  into _expenses
  from (
    select id, date, type, category, description, amount, member_id, method, created_at
    from public.mess_expenses
    where mess_id = _mess.id and date >= _start and date < _end
  ) e;

  select json_build_object(
    'food', coalesce((select sum(amount) from public.mess_expenses where mess_id = _mess.id and type = 'meal' and date >= _start and date < _end), 0),
    'household', coalesce((select sum(amount) from public.mess_expenses where mess_id = _mess.id and type = 'household' and date >= _start and date < _end), 0),
    'total_meals', coalesce((select sum(breakfast + lunch + dinner) from public.mess_meals where mess_id = _mess.id and date >= _start and date < _end), 0),
    'deposits', coalesce((select sum(amount) from public.payments where mess_id = _mess.id and date >= _start and date < _end), 0),
    'active_members', (select count(*) from public.mess_members where mess_id = _mess.id and status <> 'left')
  ) into _summary;

  select json_agg(row_to_json(n) order by n.created_at desc)
  into _notifications
  from (
    select id, title, message, type, recipient_id, created_at
    from public.mess_notifications
    where mess_id = _mess.id and (recipient_id is null or recipient_id = _member_id)
    order by created_at desc
    limit 50
  ) n;

  return json_build_object(
    'mess', row_to_json(_mess),
    'members', coalesce(_members, '[]'::json),
    'isAdmin', false,
    'meals', coalesce(_meals, '[]'::json),
    'expenses', coalesce(_expenses, '[]'::json),
    'payments', '[]'::json,
    'summary', _summary,
    'notifications', coalesce(_notifications, '[]'::json)
  );
end $$;

-- Function 3: Send notification RPC
create or replace function public.send_mess_notification(
  _recipient_id uuid,
  _title text,
  _message text,
  _type text default 'notice'
)
returns json language plpgsql security definer set search_path = public as $$
declare
  _mess_id uuid := public.my_mess_id();
  _sender_id uuid := public.my_member_id();
  _notif_id uuid;
begin
  if not public.is_mess_admin(_mess_id) then
    raise exception 'Only mess admins can send notifications.';
  end if;

  if char_length(trim(coalesce(_title, ''))) < 1 then
    raise exception 'Title cannot be empty.';
  end if;

  if char_length(trim(coalesce(_message, ''))) < 1 then
    raise exception 'Message cannot be empty.';
  end if;

  if _recipient_id is not null and not exists (
    select 1 from public.mess_members where id = _recipient_id and mess_id = _mess_id
  ) then
    raise exception 'Selected member does not belong to your mess.';
  end if;

  insert into public.mess_notifications (mess_id, sender_id, recipient_id, title, message, type)
  values (_mess_id, _sender_id, _recipient_id, trim(_title), trim(_message), coalesce(_type, 'notice'))
  returning id into _notif_id;

  return json_build_object('id', _notif_id, 'success', true);
end $$;

grant execute on function public.get_mess_by_invite_code(text) to anon, authenticated;
grant execute on function public.get_workspace_by_invite_code(text, text, uuid) to anon, authenticated;
grant execute on function public.send_mess_notification(uuid, text, text, text) to authenticated;
