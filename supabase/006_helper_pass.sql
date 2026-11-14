-- 006: ผู้ช่วย (คนให้คำใบ้) กด "ให้ผ่าน" ได้ทันที ถ้าคำที่ผู้ทายพูด/ทายเป็นที่ยอมรับในวง (โหมด 1 คนทาย)
-- ต้องเปิด settings.accept ในล็อบบี้ · รันใน Supabase SQL Editor หลัง 005
create or replace function public.mg_pass_core(p_room text) returns void
language plpgsql security definer set search_path = public as $$
declare r mg_rooms; g uuid;
begin
  select * into r from mg_rooms where code = upper(trim(p_room)) for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.status <> 'playing' or r.game <> 'solo' or not coalesce((r.settings->>'accept')::boolean, false) then raise exception 'bad_state'; end if;
  g := r.guesser;
  if g is null or not exists (select 1 from mg_hands where room = r.code and round = r.round and player = g and state = 'active') then raise exception 'bad_state'; end if;
  update mg_hands set pts = 1 where room = r.code and round = r.round and player <> g;
  update mg_players set score = score + 1 where room = r.code and id <> g;
  update mg_hands set state = 'solved', rank = 1, pts = 3 where room = r.code and round = r.round and player = g;
  update mg_players set score = score + 3 where id = g;
  update mg_guesses set status = 'accepted' where room = r.code and round = r.round and status = 'open';
  perform mg_check_end(r.code);
end $$;
revoke all on function public.mg_pass_core(text) from public, anon, authenticated;

create or replace function public.mg_pass(p_room text, p_player uuid, p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me mg_players; r mg_rooms;
begin
  me := mg_auth(p_room, p_player, p_token);
  select * into r from mg_rooms where code = me.room;
  if r.guesser = me.id then raise exception 'bad_state'; end if;
  perform mg_pass_core(me.room);
end $$;

create or replace function public.mg_watch_pass(p_room text) returns void
language plpgsql security definer set search_path = public as $$
begin perform mg_pass_core(p_room); end $$;

grant execute on function public.mg_pass(text, uuid, uuid) to anon, authenticated;
grant execute on function public.mg_watch_pass(text) to anon, authenticated;
