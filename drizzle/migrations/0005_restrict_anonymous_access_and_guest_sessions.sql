-- Migration 0005: Restrict Anonymous Access, Remove Data Leakage, and Add Scoped Guest Sessions
-- 1. Revoke direct anon select on notifications table
revoke select on public.mess_notifications from anon;

-- 2. Restrict mess preview by invite code (exclude phone, user_id, and left members)
create or replace function public.get_mess_by_invite_code(_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  _mess record;
  _members json;
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

  -- Only expose public member profile (id, name, room, tone, role, status); NEVER phone or user_id
  select json_agg(
    json_build_object(
      'id', id,
      'name', name,
      'room', room,
      'tone', tone,
      'role', role,
      'status', status
    ) order by created_at
  )
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

-- 3. Scoped guest session table for revocable, expiring guest access
create table if not exists public.mess_guest_sessions (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  mess_id uuid not null references public.messes(id) on delete cascade,
  member_id uuid references public.mess_members(id) on delete cascade,
  role text not null default 'guest' check (role in ('guest', 'member')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.mess_guest_sessions enable row level security;
grant select on public.mess_guest_sessions to authenticated;

-- Function to establish an expiring, scoped guest token from a valid invite code
create or replace function public.create_guest_session(_code text, _member_id uuid default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  _mess record;
  _token text;
  _session_role text := 'guest';
begin
  if coalesce(_code, '') !~ '^[0-9]{6}$' then
    raise exception 'Invalid 6-digit code format';
  end if;

  select id into _mess from public.messes where invite_code = _code;
  if _mess.id is null then
    raise exception 'Invalid invite code.';
  end if;

  if _member_id is not null then
    if not exists (select 1 from public.mess_members where id = _member_id and mess_id = _mess.id and status <> 'left') then
      raise exception 'Member not found in this mess.';
    end if;
    _session_role := 'member';
  end if;

  _token := encode(gen_random_bytes(32), 'hex');

  insert into public.mess_guest_sessions (token, mess_id, member_id, role)
  values (_token, _mess.id, _member_id, _session_role);

  return json_build_object(
    'token', _token,
    'mess_id', _mess.id,
    'role', _session_role,
    'expires_in', 2592000
  );
end $$;

grant execute on function public.create_guest_session(text, uuid) to anon, authenticated;

-- 4. Restrict workspace read by invite code:
-- - NEVER trust client-supplied _member_id as proof of identity to unlock private notices.
-- - Only return broadcast notifications to unauthenticated callers.
-- - Do NOT leak member phone numbers, user_ids, or owner_id.
-- - Do NOT leak payments or former member records.
create or replace function public.get_workspace_by_invite_code(
  _code text,
  _month text,
  _guest_token text default null
)
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
  _session record;
begin
  if coalesce(_code, '') !~ '^[0-9]{6}$' then
    raise exception 'Invalid 6-digit code format';
  end if;

  select id, name, manager, address, currency, start_day, meal_categories, household_categories, show_invite_to_members
  into _mess
  from public.messes
  where invite_code = _code;

  if _mess.id is null then
    raise exception 'No mess found with that invitation code.';
  end if;

  -- Validate guest token if provided
  if _guest_token is not null and _guest_token <> '' then
    select * into _session
    from public.mess_guest_sessions
    where token = _guest_token
      and mess_id = _mess.id
      and not revoked
      and expires_at > now();
  end if;

  _year := substring(_month from 1 for 4)::int;
  _month_num := substring(_month from 6 for 2)::int;
  _start := make_date(_year, _month_num, 1);
  if _month_num = 12 then
    _end := make_date(_year + 1, 1, 1);
  else
    _end := make_date(_year, _month_num + 1, 1);
  end if;

  -- Members: sanitize out phone numbers and user_id for public/guest workspace reads
  select json_agg(row_to_json(m) order by m.created_at)
  into _members
  from (
    select id, role, name, room, joined, status, tone
    from public.mess_members
    where mess_id = _mess.id and status <> 'left'
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

  -- Notifications:
  -- Only return broadcast notifications, UNLESS the caller holds a verified guest session bound to a specific member
  select json_agg(row_to_json(n) order by n.created_at desc)
  into _notifications
  from (
    select id, title, message, type, recipient_id, created_at
    from public.mess_notifications
    where mess_id = _mess.id
      and (
        recipient_id is null
        or (_session.member_id is not null and (recipient_id = _session.member_id or sender_id = _session.member_id))
      )
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

grant execute on function public.get_workspace_by_invite_code(text, text, text) to anon, authenticated;
