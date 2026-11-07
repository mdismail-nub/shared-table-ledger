-- Fix 1: Update my_mess_id to exclude former members who have left
create or replace function public.my_mess_id() returns uuid language sql stable security definer set search_path = public as $$
  select mess_id from public.mess_members where user_id = auth.uid() and status <> 'left' limit 1
$$;

-- Fix 2: Allow users who left a previous mess to join a new one
drop index if exists public.mess_members_one_mess_per_user;
create unique index mess_members_one_mess_per_user on public.mess_members(user_id) where user_id is not null and status <> 'left';

-- Fix 3: Drop the buggy restrictive policy that blocked admins from updating admin member records
drop policy if exists "protect admin membership" on public.mess_members;

-- Fix 4: Make sync_mess_role handle insert, update, and delete cleanly with ON CONFLICT
create or replace function public.sync_mess_role() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.user_id is not null then
      delete from public.mess_user_roles where user_id = old.user_id;
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if old.user_id is not null and (new.user_id is null or new.user_id <> old.user_id or new.status = 'left') then
      delete from public.mess_user_roles where user_id = old.user_id;
    end if;
    if new.user_id is not null and new.status <> 'left' then
      insert into public.mess_user_roles(user_id, mess_id, role)
      values(
        new.user_id,
        new.mess_id,
        case when exists(select 1 from public.messes where id = new.mess_id and owner_id = new.user_id) then 'admin' else new.role end
      )
      on conflict (user_id) do update set mess_id = excluded.mess_id, role = excluded.role;
    end if;
    return new;
  elsif tg_op = 'INSERT' then
    if new.user_id is not null and new.status <> 'left' then
      insert into public.mess_user_roles(user_id, mess_id, role)
      values(
        new.user_id,
        new.mess_id,
        case when exists(select 1 from public.messes where id = new.mess_id and owner_id = new.user_id) then 'admin' else new.role end
      )
      on conflict (user_id) do update set mess_id = excluded.mess_id, role = excluded.role;
    end if;
    return new;
  end if;
  return null;
end $$;

drop trigger if exists sync_mess_member_role on public.mess_members;
create trigger sync_mess_member_role
after insert or update or delete on public.mess_members
for each row execute function public.sync_mess_role();

-- Fix 5: Strengthen join_mess_by_code to prevent cross-mess confusion and enforce code validation
create or replace function public.join_mess_by_code(_code text) returns json language plpgsql security definer set search_path = public as $$
declare _mess public.messes; _name text; _tones text[] := array['primary','mint','peach','lime','cyan'];
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  if coalesce(_code,'') !~ '^[0-9]{6}$' then raise exception 'Invitation codes must be 6 digits'; end if;
  
  select * into _mess from public.messes where invite_code = _code;
  if _mess.id is null then raise exception 'We couldn''t find a mess with that code'; end if;

  if exists (select 1 from public.mess_members where user_id = auth.uid() and status <> 'left') then
    if public.my_mess_id() <> _mess.id then
      raise exception 'You already belong to an active mess. Leave your current mess before joining a new one.';
    end if;
  else
    select coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email,'@',1)) into _name from auth.users where id = auth.uid();
    insert into public.mess_members (mess_id, user_id, role, name, status, tone)
    values (_mess.id, auth.uid(), 'member', coalesce(_name,'Member'), 'new', _tones[1 + floor(random()*5)::int]);
  end if;
  
  return json_build_object(
    'id', _mess.id,
    'name', _mess.name,
    'address', _mess.address,
    'manager', _mess.manager,
    'members', (select count(*) from public.mess_members where mess_id = _mess.id and status <> 'left')
  );
end $$;
