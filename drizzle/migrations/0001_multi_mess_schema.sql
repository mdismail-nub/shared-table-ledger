comment on table public.members is 'DEPRECATED: replaced by mess_members';
comment on table public.meals is 'DEPRECATED: replaced by mess_meals';
comment on table public.expenses is 'DEPRECATED: replaced by mess_expenses';
comment on table public.deposits is 'DEPRECATED: replaced by payments';
comment on table public.mess_settings is 'DEPRECATED: replaced by messes';

create table public.messes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null check (char_length(trim(name)) between 2 and 80),
  address text not null default '' check (char_length(address) <= 200),
  manager text not null default '' check (char_length(manager) <= 80),
  start_day int not null default 1 check (start_day between 1 and 28),
  currency text not null default 'BDT (৳)',
  invite_code text not null unique check (invite_code ~ '^[0-9]{6}$'),
  show_invite_to_members boolean not null default true,
  meal_categories text[] not null default array['Rice','Vegetables','Fish & meat','Eggs','Cooking oil','Spices','Other food'],
  household_categories text[] not null default array['Wi-Fi','Electricity','Gas','Water','Cleaning','Other household'],
  created_at timestamptz not null default now()
);

create table public.mess_members (
  id uuid primary key default gen_random_uuid(),
  mess_id uuid not null references public.messes(id) on delete cascade,
  user_id uuid,
  role text not null default 'member' check (role in ('admin','member')),
  name text not null check (char_length(trim(name)) between 1 and 80),
  phone text not null default '' check (char_length(phone) <= 30),
  room text not null default '' check (char_length(room) <= 30),
  joined date not null default current_date,
  status text not null default 'active' check (status in ('active','new','left')),
  tone text not null default 'primary',
  created_at timestamptz not null default now()
);
create unique index mess_members_one_mess_per_user on public.mess_members(user_id) where user_id is not null;

create or replace function public.my_mess_id() returns uuid language sql stable security definer set search_path = public as $$
  select mess_id from public.mess_members where user_id = auth.uid() limit 1
$$;
create or replace function public.is_mess_admin(_mess uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mess_members where user_id = auth.uid() and mess_id = _mess and role = 'admin')
$$;
alter table public.mess_members alter column mess_id set default public.my_mess_id();

create table public.mess_meals (
  id uuid primary key default gen_random_uuid(),
  mess_id uuid not null default public.my_mess_id() references public.messes(id) on delete cascade,
  member_id uuid not null references public.mess_members(id) on delete cascade,
  date date not null,
  breakfast numeric not null default 0 check (breakfast between 0 and 10),
  lunch numeric not null default 0 check (lunch between 0 and 10),
  dinner numeric not null default 0 check (dinner between 0 and 10),
  unique (member_id, date)
);
create table public.mess_expenses (
  id uuid primary key default gen_random_uuid(),
  mess_id uuid not null default public.my_mess_id() references public.messes(id) on delete cascade,
  date date not null default current_date,
  type text not null check (type in ('meal','household')),
  category text not null check (char_length(category) <= 60),
  description text not null default '' check (char_length(description) <= 300),
  amount numeric not null check (amount > 0 and amount < 10000000),
  member_id uuid references public.mess_members(id) on delete set null,
  method text not null default 'Cash',
  created_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  mess_id uuid not null default public.my_mess_id() references public.messes(id) on delete cascade,
  date date not null default current_date,
  member_id uuid not null references public.mess_members(id) on delete cascade,
  amount numeric not null check (amount > 0 and amount < 10000000),
  method text not null default 'Cash',
  kind text not null default 'Deposit',
  reference text not null default '' check (char_length(reference) <= 100),
  created_at timestamptz not null default now()
);

grant select (id, owner_id, name, address, manager, start_day, currency, show_invite_to_members, meal_categories, household_categories, created_at) on public.messes to authenticated;
grant update (name, address, manager, start_day, currency, show_invite_to_members, meal_categories, household_categories) on public.messes to authenticated;
grant all on public.messes to service_role;
grant select, insert, update, delete on public.mess_members, public.mess_meals, public.mess_expenses, public.payments to authenticated;
grant all on public.mess_members, public.mess_meals, public.mess_expenses, public.payments to service_role;

alter table public.messes enable row level security;
alter table public.mess_members enable row level security;
alter table public.mess_meals enable row level security;
alter table public.mess_expenses enable row level security;
alter table public.payments enable row level security;

create policy "read own mess" on public.messes for select to authenticated using (id = public.my_mess_id());
create policy "admin updates mess" on public.messes for update to authenticated using (public.is_mess_admin(id)) with check (public.is_mess_admin(id));

create policy "read mess members" on public.mess_members for select to authenticated using (mess_id = public.my_mess_id());
create policy "admin inserts members" on public.mess_members for insert to authenticated with check (public.is_mess_admin(mess_id) and role = 'member');
create policy "admin updates members" on public.mess_members for update to authenticated using (public.is_mess_admin(mess_id)) with check (public.is_mess_admin(mess_id));
create policy "admin deletes members" on public.mess_members for delete to authenticated using (public.is_mess_admin(mess_id) and user_id is distinct from auth.uid());

create policy "read mess meals" on public.mess_meals for select to authenticated using (mess_id = public.my_mess_id());
create policy "admin writes meals" on public.mess_meals for all to authenticated using (public.is_mess_admin(mess_id)) with check (public.is_mess_admin(mess_id));
create policy "read mess expenses" on public.mess_expenses for select to authenticated using (mess_id = public.my_mess_id());
create policy "admin writes expenses" on public.mess_expenses for all to authenticated using (public.is_mess_admin(mess_id)) with check (public.is_mess_admin(mess_id));
create policy "read mess payments" on public.payments for select to authenticated using (mess_id = public.my_mess_id());
create policy "admin writes payments" on public.payments for all to authenticated using (public.is_mess_admin(mess_id)) with check (public.is_mess_admin(mess_id));

create or replace function public.protect_member_role() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role or new.user_id is distinct from old.user_id or new.mess_id is distinct from old.mess_id then
    raise exception 'Role, account and mess cannot be changed';
  end if;
  return new;
end $$;
create trigger mess_members_protect_role before update on public.mess_members for each row execute function public.protect_member_role();

create or replace function public.new_invite_code() returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare _c text;
begin
  loop
    _c := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    exit when not exists (select 1 from public.messes where invite_code = _c);
  end loop;
  return _c;
end $$;

create or replace function public.create_mess(_name text, _address text, _manager text, _start_day int, _currency text)
returns json language plpgsql security definer set search_path = public as $$
declare _id uuid; _code text;
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  if exists (select 1 from public.mess_members where user_id = auth.uid()) then raise exception 'You already belong to a mess'; end if;
  if char_length(trim(coalesce(_name,''))) < 2 then raise exception 'Mess name is too short'; end if;
  if char_length(trim(coalesce(_manager,''))) < 1 then raise exception 'Please enter your name'; end if;
  _code := public.new_invite_code();
  insert into public.messes (owner_id, name, address, manager, start_day, currency, invite_code)
  values (auth.uid(), trim(_name), trim(coalesce(_address,'')), trim(_manager), coalesce(_start_day,1), coalesce(nullif(trim(_currency),''),'BDT (৳)'), _code)
  returning id into _id;
  insert into public.mess_members (mess_id, user_id, role, name, status, tone) values (_id, auth.uid(), 'admin', trim(_manager), 'active', 'primary');
  return json_build_object('id', _id, 'name', trim(_name), 'invite_code', _code);
end $$;

create or replace function public.join_mess_by_code(_code text) returns json language plpgsql security definer set search_path = public as $$
declare _mess public.messes; _name text; _tones text[] := array['primary','mint','peach','lime','cyan'];
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  if exists (select 1 from public.mess_members where user_id = auth.uid()) then
    select m.* into _mess from public.messes m where m.id = public.my_mess_id();
  else
    if coalesce(_code,'') !~ '^[0-9]{6}$' then raise exception 'Invitation codes are 6 digits'; end if;
    select * into _mess from public.messes where invite_code = _code;
    if _mess.id is null then raise exception 'We couldn''t find a mess with that code'; end if;
    select coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email,'@',1)) into _name from auth.users where id = auth.uid();
    insert into public.mess_members (mess_id, user_id, role, name, status, tone)
    values (_mess.id, auth.uid(), 'member', coalesce(_name,'Member'), 'new', _tones[1 + floor(random()*5)::int]);
  end if;
  return json_build_object('id', _mess.id, 'name', _mess.name, 'address', _mess.address, 'manager', _mess.manager,
    'members', (select count(*) from public.mess_members where mess_id = _mess.id and status <> 'left'));
end $$;

create or replace function public.mess_invite_code() returns text language sql stable security definer set search_path = public as $$
  select m.invite_code from public.messes m
  where m.id = public.my_mess_id() and (public.is_mess_admin(m.id) or m.show_invite_to_members)
$$;

create or replace function public.regenerate_invite_code() returns text language plpgsql security definer set search_path = public as $$
declare _code text; _id uuid := public.my_mess_id();
begin
  if not public.is_mess_admin(_id) then raise exception 'Only the admin can change the code'; end if;
  _code := public.new_invite_code();
  update public.messes set invite_code = _code where id = _id;
  return _code;
end $$;

create or replace function public.mess_month_summary(_start date, _end date) returns json language plpgsql stable security definer set search_path = public as $$
declare _m uuid := public.my_mess_id();
begin
  if _m is null then raise exception 'Not allowed'; end if;
  return json_build_object(
    'food', coalesce((select sum(amount) from public.mess_expenses where mess_id=_m and type='meal' and date >= _start and date < _end),0),
    'household', coalesce((select sum(amount) from public.mess_expenses where mess_id=_m and type='household' and date >= _start and date < _end),0),
    'total_meals', coalesce((select sum(breakfast+lunch+dinner) from public.mess_meals where mess_id=_m and date >= _start and date < _end),0),
    'deposits', coalesce((select sum(amount) from public.payments where mess_id=_m and date >= _start and date < _end),0),
    'active_members', (select count(*) from public.mess_members where mess_id=_m and status <> 'left'));
end $$;

revoke all on function public.new_invite_code() from public, anon, authenticated;
revoke all on function public.protect_member_role() from public, anon, authenticated;
revoke all on function public.create_mess(text,text,text,int,text), public.join_mess_by_code(text), public.mess_invite_code(), public.regenerate_invite_code(), public.mess_month_summary(date,date), public.my_mess_id(), public.is_mess_admin(uuid) from public, anon;
grant execute on function public.create_mess(text,text,text,int,text), public.join_mess_by_code(text), public.mess_invite_code(), public.regenerate_invite_code(), public.mess_month_summary(date,date), public.my_mess_id(), public.is_mess_admin(uuid) to authenticated;