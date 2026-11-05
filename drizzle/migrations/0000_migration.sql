create type public.app_role as enum ('admin', 'member');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  name text not null,
  phone text not null default '',
  room text not null default '',
  joined date not null default current_date,
  status text not null default 'active' check (status in ('active','new','left')),
  tone text not null default 'primary',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.members to authenticated;
grant all on public.members to service_role;
alter table public.members enable row level security;
create policy "admin all members" on public.members for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "member reads self" on public.members for select to authenticated using (user_id = auth.uid());

create or replace function public.my_member_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.members where user_id = auth.uid() limit 1
$$;

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  date date not null,
  breakfast numeric not null default 0,
  lunch numeric not null default 0,
  dinner numeric not null default 0,
  unique (member_id, date)
);
grant select, insert, update, delete on public.meals to authenticated;
grant all on public.meals to service_role;
alter table public.meals enable row level security;
create policy "admin all meals" on public.meals for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "member reads own meals" on public.meals for select to authenticated using (member_id = public.my_member_id());

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  type text not null check (type in ('meal','household')),
  category text not null,
  description text not null default '',
  amount numeric not null check (amount > 0),
  member_id uuid references public.members(id) on delete set null,
  method text not null default 'Cash',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
create policy "admin all expenses" on public.expenses for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  member_id uuid not null references public.members(id) on delete cascade,
  amount numeric not null check (amount > 0),
  method text not null default 'Cash',
  kind text not null default 'Deposit',
  reference text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.deposits to authenticated;
grant all on public.deposits to service_role;
alter table public.deposits enable row level security;
create policy "admin all deposits" on public.deposits for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "member reads own deposits" on public.deposits for select to authenticated using (member_id = public.my_member_id());

create table public.mess_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'My Mess',
  manager text not null default '',
  address text not null default '',
  currency text not null default 'BDT (৳)',
  invite_code text not null default upper(substr(md5(random()::text), 1, 6)),
  meal_categories text[] not null default array['Rice','Vegetables','Fish & meat','Eggs','Cooking oil','Spices','Other food'],
  household_categories text[] not null default array['Wi-Fi','Electricity','Gas','Water','Cleaning','Other household']
);
grant select, insert, update on public.mess_settings to authenticated;
grant all on public.mess_settings to service_role;
alter table public.mess_settings enable row level security;
create policy "admin manage settings" on public.mess_settings for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "members read settings" on public.mess_settings for select to authenticated using (public.my_member_id() is not null);
insert into public.mess_settings (id) values (1);

-- first user to sign up becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.join_mess(_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid; _name text; _tones text[] := array['primary','mint','peach','lime','cyan'];
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into _id from public.members where user_id = auth.uid();
  if _id is not null then return _id; end if;
  if not exists (select 1 from public.mess_settings where upper(invite_code) = upper(trim(_code))) then
    raise exception 'That invite code is not correct';
  end if;
  select coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email,'@',1)) into _name from auth.users where id = auth.uid();
  insert into public.members (user_id, name, status, tone)
  values (auth.uid(), _name, 'new', _tones[1 + floor(random()*5)::int])
  returning id into _id;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'member') on conflict do nothing;
  return _id;
end $$;
revoke execute on function public.join_mess(text) from anon;

create or replace function public.month_summary(_start date, _end date)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_role(auth.uid(),'admin') or public.my_member_id() is not null) then
    raise exception 'Not allowed';
  end if;
  return json_build_object(
    'food', coalesce((select sum(amount) from public.expenses where type='meal' and date >= _start and date < _end),0),
    'household', coalesce((select sum(amount) from public.expenses where type='household' and date >= _start and date < _end),0),
    'total_meals', coalesce((select sum(breakfast+lunch+dinner) from public.meals where date >= _start and date < _end),0),
    'deposits', coalesce((select sum(amount) from public.deposits where date >= _start and date < _end),0),
    'active_members', (select count(*) from public.members where status <> 'left')
  );
end $$;
revoke execute on function public.month_summary(date, date) from anon;