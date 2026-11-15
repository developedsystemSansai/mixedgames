-- 010: เน้น "หมาป่า + ลูกหมาป่า" เป็นเซตเดียวกัน
-- ค่าเริ่มต้นของเกมหมาป่าจะมีลูกหมาป่าเสมอ และเมื่อเปิดลูกหมาป่า จะมีหมาป่าอย่างน้อย 2 ตัว (หมาป่า 1 + ลูกหมาป่า 1)
create or replace function public.mg_wolf_init(p_room text) returns void
language plpgsql security definer set search_path = public as $f$
declare r mg_rooms; ids uuid[]; n int; nw int; roles text[] := array[]::text[]; i int; st jsonb; sel text[]; k text;
begin
  select * into r from mg_rooms where code = p_room for update;
  select array_agg(id order by random()) into ids from mg_players where room = r.code;
  n := coalesce(cardinality(ids), 0);
  if n < 5 then raise exception 'need_5'; end if;
  st := coalesce(r.settings->'wolf', '{}'::jsonb);
  if jsonb_typeof(st->'roles') = 'array' then
    select coalesce(array_agg(x), array[]::text[]) into sel from jsonb_array_elements_text(st->'roles') x;
  else sel := case when n >= 6 then array['seer','guard','cub'] else array['seer','cub'] end; end if;
  nw := coalesce(nullif((st->>'wolves')::int, 0), case when n <= 6 then 1 when n <= 9 then 2 else 3 end);
  if 'cub' = any(sel) then nw := greatest(nw, 2); end if;
  nw := greatest(1, least(nw, (n - 1) / 2));
  for i in 1..nw loop roles := array_append(roles, 'wolf'); end loop;
  if 'alpha' = any(sel) then roles[1] := 'alpha'; end if;
  if 'cub' = any(sel) and (nw >= 2 or not ('alpha' = any(sel))) then roles[nw] := 'cub'; end if;
  foreach k in array array['seer','guard','witch','hunter','cupid','littlegirl','idiot','mayor','killer','infected','thief'] loop
    if k = any(sel) and cardinality(roles) < n then roles := array_append(roles, k); end if;
  end loop;
  while cardinality(roles) < n loop roles := array_append(roles, 'villager'); end loop;
  delete from mg_wolf_act where room = r.code;
  delete from mg_wolf_p where room = r.code;
  delete from mg_wolf_g where room = r.code;
  for i in 1..n loop insert into mg_wolf_p(room, player, role) values (r.code, ids[i], roles[i]); end loop;
  insert into mg_wolf_g(room, phase, day_no, phase_secs, phase_end)
    values (r.code, 'night', 1, mg_wolf_secs(r, 'night', 1), now() + make_interval(secs => mg_wolf_secs(r, 'night', 1)));
  delete from mg_claims where room = r.code;
  update mg_rooms set status = 'playing', round = r.round + 1, ends_at = null, guesser = null, updated_at = now() where code = r.code;
end $f$;
