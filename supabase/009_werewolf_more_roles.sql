-- 009: เกมหมาป่า เพิ่มบทบาทให้ครบชุดการ์ดมาตรฐาน
-- ใหม่: ลูกหมาป่า(cub) นายพราน(hunter) กามเทพ(cupid) เด็กหญิง(littlegirl) นักล่า(killer) ผู้ติดเชื้อ(infected) จอมโจร(thief)
-- ชนะเพิ่ม: 'lovers' (คู่รักคนละฝ่ายเหลือสองคนสุดท้าย) และ 'killer' (นักล่ารอดคนเดียว)
alter table public.mg_wolf_p add column if not exists lover uuid;
alter table public.mg_wolf_p add column if not exists was text;
alter table public.mg_wolf_g add column if not exists cub_day int;
do $m$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.mg_wolf_p'::regclass and contype = 'c' loop execute format('alter table public.mg_wolf_p drop constraint %I', c); end loop;
  for c in select conname from pg_constraint where conrelid = 'public.mg_wolf_act'::regclass and contype = 'c' loop execute format('alter table public.mg_wolf_act drop constraint %I', c); end loop;
end $m$;
alter table public.mg_wolf_p add constraint mg_wolf_p_role_check check (role in ('wolf','alpha','cub','villager','seer','guard','witch','hunter','cupid','littlegirl','mayor','idiot','killer','infected','thief'));
alter table public.mg_wolf_act add constraint mg_wolf_act_kind_check check (kind in ('kill','kill2','see','guard','vote','heal','poison','witchpass','slay','peek','caught','shoot','love1','love2','steal','pass'));

create or replace function public.mg_wolf_isw(r text) returns boolean language sql immutable set search_path = public as $f$ select r in ('wolf','alpha','cub') $f$;

-- ฆ่าผู้เล่น 1 คน พร้อมผลต่อเนื่อง: ลูกหมาป่าตาย -> คืนถัดไปหมาป่ากิน 2 คน, นายพรานยิงเป้าที่เลือกไว้, คู่รักตายตาม
create or replace function public.mg_wolf_die(p_room text, p_player uuid, p_day int) returns jsonb
language plpgsql security definer set search_path = public as $f$
declare pr mg_wolf_p; out jsonb := '[]'::jsonb; tgt uuid;
begin
  select * into pr from mg_wolf_p where room = p_room and player = p_player and alive for update;
  if not found then return out; end if;
  update mg_wolf_p set alive = false where room = p_room and player = p_player;
  if pr.role = 'cub' then update mg_wolf_g set cub_day = p_day + 1 where room = p_room; end if;
  if pr.role = 'hunter' then
    select a.target into tgt from mg_wolf_act a where a.room = p_room and a.actor = p_player and a.kind = 'shoot' and a.target is not null order by a.day_no desc limit 1;
    if tgt is not null and exists (select 1 from mg_wolf_p where room = p_room and player = tgt and alive) then
      out := out || jsonb_build_array(jsonb_build_object('p', tgt, 'why', 'shot')) || mg_wolf_die(p_room, tgt, p_day);
    end if;
  end if;
  if pr.lover is not null and exists (select 1 from mg_wolf_p where room = p_room and player = pr.lover and alive) then
    out := out || jsonb_build_array(jsonb_build_object('p', pr.lover, 'why', 'love')) || mg_wolf_die(p_room, pr.lover, p_day);
  end if;
  return out;
end $f$;
revoke all on function public.mg_wolf_die(text, uuid, int) from public, anon, authenticated;

create or replace function public.mg_wolf_win(p_room text) returns text
language plpgsql security definer set search_path = public as $f$
declare w int; k int; o int; lv int;
begin
  select count(*) filter (where mg_wolf_isw(role)), count(*) filter (where role = 'killer'),
         count(*) filter (where not mg_wolf_isw(role) and role <> 'killer'), count(*) filter (where lover is not null)
    into w, k, o, lv from mg_wolf_p where room = p_room and alive;
  if w + k + o = 2 and lv = 2 and w = 1 then return 'lovers'; end if;
  if w = 0 and k = 0 then return 'village'; end if;
  if k = 1 and w = 0 and o = 0 then return 'killer'; end if;
  if w > 0 and w >= o + k then return 'wolf'; end if;
  return null;
end $f$;

create or replace function public.mg_wolf_end(p_room text, p_winner text) returns void
language plpgsql security definer set search_path = public as $f$
begin
  update mg_wolf_g set phase = 'over', winner = p_winner, phase_end = null,
    log = log || jsonb_build_array(jsonb_build_object('t', 'end', 'winner', p_winner)) where room = p_room;
  if p_winner is not null then
    update mg_players set score = score + 3 where id in (select player from mg_wolf_p where room = p_room and (
      (p_winner = 'wolf' and mg_wolf_isw(role)) or (p_winner = 'village' and not mg_wolf_isw(role) and role <> 'killer')
      or (p_winner = 'killer' and role = 'killer') or (p_winner = 'lovers' and lover is not null)));
  end if;
  update mg_rooms set status = 'over', ends_at = null, updated_at = now() where code = p_room;
end $f$;

create or replace function public.mg_wolf_init(p_room text) returns void
language plpgsql security definer set search_path = public as $f$
declare r mg_rooms; ids uuid[]; n int; nw int; roles text[] := array[]::text[]; i int; st jsonb; sel text[]; k text;
begin
  select * into r from mg_rooms where code = p_room for update;
  select array_agg(id order by random()) into ids from mg_players where room = r.code;
  n := coalesce(cardinality(ids), 0);
  if n < 5 then raise exception 'need_5'; end if;
  st := coalesce(r.settings->'wolf', '{}'::jsonb);
  nw := coalesce(nullif((st->>'wolves')::int, 0), case when n <= 6 then 1 when n <= 9 then 2 else 3 end);
  nw := greatest(1, least(nw, (n - 1) / 2));
  if jsonb_typeof(st->'roles') = 'array' then
    select coalesce(array_agg(x), array[]::text[]) into sel from jsonb_array_elements_text(st->'roles') x;
  else sel := case when n >= 6 then array['seer','guard'] else array['seer'] end; end if;
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

create or replace function public.mg_wolf_act(p_room text, p_player uuid, p_token uuid, p_kind text, p_target uuid) returns void
language plpgsql security definer set search_path = public as $f$
declare me mg_players; r mg_rooms; g mg_wolf_g; mp mg_wolf_p; tp mg_wolf_p; wid uuid;
begin
  me := mg_auth(p_room, p_player, p_token);
  perform mg_wolf_tick(me.room);
  select * into r from mg_rooms where code = me.room;
  if r.game <> 'wolf' or r.status <> 'playing' then raise exception 'bad_state'; end if;
  select * into g from mg_wolf_g where room = me.room;
  if g.phase <> 'night' then raise exception 'bad_state'; end if;
  select * into mp from mg_wolf_p where room = me.room and player = me.id;
  if not found or not mp.alive then raise exception 'bad_state'; end if;
  if not ((p_kind = 'kill' and mg_wolf_isw(mp.role))
       or (p_kind = 'kill2' and mg_wolf_isw(mp.role) and g.cub_day is not distinct from g.day_no)
       or (p_kind = 'see' and mp.role = 'seer') or (p_kind = 'guard' and mp.role = 'guard')
       or (p_kind in ('heal','poison','witchpass') and mp.role = 'witch')
       or (p_kind = 'slay' and mp.role = 'killer') or (p_kind = 'peek' and mp.role = 'littlegirl')
       or (p_kind = 'shoot' and mp.role = 'hunter')
       or (p_kind in ('love1','love2') and mp.role = 'cupid' and g.day_no = 1)
       or (p_kind = 'steal' and mp.role = 'thief' and g.day_no = 1)
       or (p_kind = 'pass' and (mp.role in ('killer','littlegirl') or (g.day_no = 1 and mp.role in ('hunter','cupid','thief'))))) then
    raise exception 'not_allowed';
  end if;
  if p_kind in ('heal','poison','witchpass') and exists (select 1 from mg_wolf_act where room = me.room and day_no = g.day_no and actor = me.id and kind in ('heal','poison','witchpass')) then
    raise exception 'already_done';
  end if;
  if p_kind = 'witchpass' then
    insert into mg_wolf_act(room, day_no, kind, actor, target) values (me.room, g.day_no, 'witchpass', me.id, null);
    perform mg_wolf_tick(me.room); return;
  end if;
  if p_kind = 'pass' then
    insert into mg_wolf_act(room, day_no, kind, actor, target) values (me.room, g.day_no, 'pass', me.id, null) on conflict do nothing;
    perform mg_wolf_tick(me.room); return;
  end if;
  if p_kind = 'peek' then
    if exists (select 1 from mg_wolf_act where room = me.room and day_no = g.day_no and actor = me.id and kind = 'peek') then raise exception 'already_done'; end if;
    select player into wid from mg_wolf_p where room = me.room and alive and mg_wolf_isw(role) order by random() limit 1;
    if wid is null then raise exception 'bad_state'; end if;
    insert into mg_wolf_act(room, day_no, kind, actor, target) values (me.room, g.day_no, 'peek', me.id, wid);
    if random() < 0.34 then
      insert into mg_wolf_act(room, day_no, kind, actor, target) values (me.room, g.day_no, 'caught', me.id, me.id);
    end if;
    perform mg_wolf_tick(me.room); return;
  end if;
  select * into tp from mg_wolf_p where room = me.room and player = p_target;
  if not found or not tp.alive then raise exception 'bad_target'; end if;
  if p_kind in ('kill','kill2') and mg_wolf_isw(tp.role) then raise exception 'bad_target'; end if;
  if p_kind in ('see','slay','shoot','steal') and tp.player = me.id then raise exception 'bad_target'; end if;
  if p_kind = 'see' and exists (select 1 from mg_wolf_act where room = me.room and day_no = g.day_no and kind = 'see' and actor = me.id) then raise exception 'already_done'; end if;
  if p_kind in ('heal','poison') then
    if exists (select 1 from mg_wolf_act where room = me.room and actor = me.id and kind = p_kind) then raise exception 'already_done'; end if;
    if p_kind = 'poison' and tp.player = me.id then raise exception 'bad_target'; end if;
  end if;
  if p_kind = 'love2' and exists (select 1 from mg_wolf_act where room = me.room and day_no = g.day_no and actor = me.id and kind = 'love1' and target = p_target) then raise exception 'bad_target'; end if;
  insert into mg_wolf_act(room, day_no, kind, actor, target) values (me.room, g.day_no, p_kind, me.id, p_target)
    on conflict (room, day_no, kind, actor) do update set target = excluded.target;
  perform mg_wolf_tick(me.room);
end $f$;

create or replace function public.mg_wolf_tick(p_room text) returns void
language plpgsql security definer set search_path = public as $f$
declare r mg_rooms; g mg_wolf_g; miss int; w text;
begin
  select * into r from mg_rooms where code = p_room for update;
  if not found or r.game <> 'wolf' or r.status <> 'playing' then return; end if;
  select * into g from mg_wolf_g where room = p_room for update;
  if not found or g.phase = 'over' then return; end if;
  w := mg_wolf_win(p_room);
  if w is not null then perform mg_wolf_end(p_room, w); return; end if;
  if g.phase = 'night' then
    select count(*) into miss from mg_wolf_p p where p.room = p_room and p.alive and (
      (mg_wolf_isw(p.role) and not exists (select 1 from mg_wolf_act a where a.room = p_room and a.day_no = g.day_no and a.actor = p.player and a.kind = 'kill'))
      or (mg_wolf_isw(p.role) and g.cub_day is not distinct from g.day_no and not exists (select 1 from mg_wolf_act a where a.room = p_room and a.day_no = g.day_no and a.actor = p.player and a.kind = 'kill2'))
      or (p.role = 'seer' and not exists (select 1 from mg_wolf_act a where a.room = p_room and a.day_no = g.day_no and a.actor = p.player and a.kind = 'see'))
      or (p.role = 'guard' and not exists (select 1 from mg_wolf_act a where a.room = p_room and a.day_no = g.day_no and a.actor = p.player and a.kind = 'guard'))
      or (p.role = 'witch' and not exists (select 1 from mg_wolf_act a where a.room = p_room and a.day_no = g.day_no and a.actor = p.player and a.kind in ('heal','poison','witchpass'))
            and not (exists (select 1 from mg_wolf_act a where a.room = p_room and a.actor = p.player and a.kind = 'heal')
                 and exists (select 1 from mg_wolf_act a where a.room = p_room and a.actor = p.player and a.kind = 'poison')))
      or (p.role = 'killer' and not exists (select 1 from mg_wolf_act a where a.room = p_room and a.day_no = g.day_no and a.actor = p.player and a.kind in ('slay','pass')))
      or (p.role = 'littlegirl' and not exists (select 1 from mg_wolf_act a where a.room = p_room and a.day_no = g.day_no and a.actor = p.player and a.kind in ('peek','pass')))
      or (g.day_no = 1 and p.role = 'hunter' and not exists (select 1 from mg_wolf_act a where a.room = p_room and a.day_no = g.day_no and a.actor = p.player and a.kind in ('shoot','pass')))
      or (g.day_no = 1 and p.role = 'cupid' and not exists (select 1 from mg_wolf_act a where a.room = p_room and a.day_no = g.day_no and a.actor = p.player and a.kind in ('love2','pass')))
      or (g.day_no = 1 and p.role = 'thief' and not exists (select 1 from mg_wolf_act a where a.room = p_room and a.day_no = g.day_no and a.actor = p.player and a.kind in ('steal','pass'))));
    if miss = 0 or now() >= g.phase_end then perform mg_wolf_resolve_night(p_room); end if;
  elsif g.phase = 'day' then
    if now() >= g.phase_end then perform mg_wolf_to_vote(p_room); end if;
  elsif g.phase = 'vote' then
    select count(*) into miss from mg_wolf_p p where p.room = p_room and p.alive and not p.revealed
      and not exists (select 1 from mg_wolf_act a where a.room = p_room and a.day_no = g.day_no and a.kind = 'vote' and a.actor = p.player);
    if miss = 0 or now() >= g.phase_end then perform mg_wolf_resolve_vote(p_room); end if;
  end if;
end $f$;

create or replace function public.mg_wolf_resolve_night(p_room text) returns void
language plpgsql security definer set search_path = public as $f$
declare g mg_wolf_g; r mg_rooms; v1 uuid; v2 uuid; gt uuid; ht uuid; pt uuid; kt uuid; dead uuid; dead2 uuid;
  extra jsonb := '[]'::jsonb; saved boolean := false; vx uuid; cas jsonb; w text; secs int; l1 uuid; l2 uuid; lg uuid; th uuid; tt uuid; rl text;
begin
  select * into r from mg_rooms where code = p_room;
  select * into g from mg_wolf_g where room = p_room;
  select a.target into l1 from mg_wolf_act a join mg_wolf_p p on p.room = a.room and p.player = a.actor and p.alive and p.role = 'cupid'
   where a.room = p_room and a.day_no = g.day_no and a.kind = 'love1' limit 1;
  select a.target into l2 from mg_wolf_act a join mg_wolf_p p on p.room = a.room and p.player = a.actor and p.alive and p.role = 'cupid'
   where a.room = p_room and a.day_no = g.day_no and a.kind = 'love2' limit 1;
  if l1 is not null and l2 is not null and l1 <> l2 then
    update mg_wolf_p set lover = l2 where room = p_room and player = l1;
    update mg_wolf_p set lover = l1 where room = p_room and player = l2;
  end if;
  select q.target into v1 from (
    select a.target from mg_wolf_act a
      join mg_wolf_p p on p.room = a.room and p.player = a.actor and p.alive and mg_wolf_isw(p.role)
     where a.room = p_room and a.day_no = g.day_no and a.kind = 'kill' and a.target is not null
     group by a.target order by count(*) desc, max(case when p.role = 'alpha' then 1 else 0 end) desc, random() limit 1) q;
  if g.cub_day is not distinct from g.day_no then
    select q.target into v2 from (
      select a.target from mg_wolf_act a
        join mg_wolf_p p on p.room = a.room and p.player = a.actor and p.alive and mg_wolf_isw(p.role)
       where a.room = p_room and a.day_no = g.day_no and a.kind = 'kill2' and a.target is not null and a.target is distinct from v1
       group by a.target order by count(*) desc, max(case when p.role = 'alpha' then 1 else 0 end) desc, random() limit 1) q;
  end if;
  select a.target into gt from mg_wolf_act a join mg_wolf_p p on p.room = a.room and p.player = a.actor and p.alive and p.role = 'guard'
   where a.room = p_room and a.day_no = g.day_no and a.kind = 'guard' limit 1;
  select a.target into ht from mg_wolf_act a join mg_wolf_p p on p.room = a.room and p.player = a.actor and p.alive and p.role = 'witch'
   where a.room = p_room and a.day_no = g.day_no and a.kind = 'heal' limit 1;
  select a.target into pt from mg_wolf_act a join mg_wolf_p p on p.room = a.room and p.player = a.actor and p.alive and p.role = 'witch'
   where a.room = p_room and a.day_no = g.day_no and a.kind = 'poison' limit 1;
  select a.target into kt from mg_wolf_act a join mg_wolf_p p on p.room = a.room and p.player = a.actor and p.alive and p.role = 'killer'
   where a.room = p_room and a.day_no = g.day_no and a.kind = 'slay' limit 1;
  foreach vx in array array[v1, v2] loop
    continue when vx is null;
    continue when not exists (select 1 from mg_wolf_p where room = p_room and player = vx and alive);
    if vx = gt or vx = ht then saved := true; continue; end if;
    select role into rl from mg_wolf_p where room = p_room and player = vx;
    if rl = 'infected' then
      update mg_wolf_p set role = 'wolf', was = coalesce(was, 'infected') where room = p_room and player = vx;
      continue;
    end if;
    cas := mg_wolf_die(p_room, vx, g.day_no);
    if vx is not distinct from v1 then dead := vx;
    else extra := extra || jsonb_build_array(jsonb_build_object('p', vx, 'why', 'wolf')); end if;
    extra := extra || cas;
  end loop;
  if kt is not null and exists (select 1 from mg_wolf_p where room = p_room and player = kt and alive) then
    if kt = gt then saved := true;
    else
      cas := mg_wolf_die(p_room, kt, g.day_no);
      extra := extra || jsonb_build_array(jsonb_build_object('p', kt, 'why', 'killer')) || cas;
    end if;
  end if;
  if pt is not null and exists (select 1 from mg_wolf_p where room = p_room and player = pt and alive) then
    dead2 := pt; cas := mg_wolf_die(p_room, pt, g.day_no); extra := extra || cas;
  end if;
  select a.actor into lg from mg_wolf_act a join mg_wolf_p p on p.room = a.room and p.player = a.actor and p.alive and p.role = 'littlegirl'
   where a.room = p_room and a.day_no = g.day_no and a.kind = 'caught' limit 1;
  if lg is not null then
    cas := mg_wolf_die(p_room, lg, g.day_no);
    extra := extra || jsonb_build_array(jsonb_build_object('p', lg, 'why', 'caught')) || cas;
  end if;
  select a.actor, a.target into th, tt from mg_wolf_act a join mg_wolf_p p on p.room = a.room and p.player = a.actor and p.alive and p.role = 'thief'
   where a.room = p_room and a.day_no = g.day_no and a.kind = 'steal' limit 1;
  if th is not null and tt is not null and exists (select 1 from mg_wolf_p where room = p_room and player = tt and alive) then
    select role into rl from mg_wolf_p where room = p_room and player = tt;
    update mg_wolf_p set role = rl, was = coalesce(was, 'thief') where room = p_room and player = th;
    update mg_wolf_p set role = 'villager', was = coalesce(was, rl) where room = p_room and player = tt;
  end if;
  secs := mg_wolf_secs(r, 'day', g.day_no);
  update mg_wolf_g set phase = 'day', phase_secs = secs, phase_end = now() + make_interval(secs => secs),
    log = log || jsonb_build_array(jsonb_build_object('t', 'night', 'day', g.day_no, 'dead', dead, 'dead2', dead2, 'saved', saved, 'extra', extra))
   where room = p_room;
  w := mg_wolf_win(p_room);
  if w is not null then perform mg_wolf_end(p_room, w); end if;
end $f$;

create or replace function public.mg_wolf_resolve_vote(p_room text) returns void
language plpgsql security definer set search_path = public as $f$
declare g mg_wolf_g; r mg_rooms; top uuid; ties int; dead uuid; idiot uuid; votes jsonb; w text; secs int; tp mg_wolf_p; cas jsonb := '[]'::jsonb;
begin
  select * into r from mg_rooms where code = p_room;
  select * into g from mg_wolf_g where room = p_room;
  select coalesce(jsonb_agg(jsonb_build_object('from', a.actor, 'to', a.target)), '[]'::jsonb) into votes
    from mg_wolf_act a join mg_wolf_p p on p.room = a.room and p.player = a.actor and p.alive and not p.revealed
   where a.room = p_room and a.day_no = g.day_no and a.kind = 'vote';
  with t as (
    select a.target, sum(case when p.role = 'mayor' then 2 else 1 end) c from mg_wolf_act a
      join mg_wolf_p p on p.room = a.room and p.player = a.actor and p.alive and not p.revealed
     where a.room = p_room and a.day_no = g.day_no and a.kind = 'vote' and a.target is not null group by a.target),
  m as (select max(c) mx from t)
  select (select t.target from t, m where t.c = m.mx limit 1), (select count(*) from t, m where t.c = m.mx) into top, ties;
  if top is not null and ties = 1 then
    select * into tp from mg_wolf_p where room = p_room and player = top;
    if tp.role = 'idiot' and not tp.revealed then
      idiot := top; update mg_wolf_p set revealed = true where room = p_room and player = top;
    else
      dead := top; cas := mg_wolf_die(p_room, top, g.day_no);
    end if;
  end if;
  update mg_wolf_g set log = log || jsonb_build_array(jsonb_build_object('t', 'vote', 'day', g.day_no, 'dead', dead, 'idiot', idiot, 'votes', votes, 'extra', cas))
   where room = p_room;
  w := mg_wolf_win(p_room);
  if w is not null then perform mg_wolf_end(p_room, w); return; end if;
  secs := mg_wolf_secs(r, 'night', g.day_no + 1);
  update mg_wolf_g set phase = 'night', day_no = g.day_no + 1, phase_secs = secs, phase_end = now() + make_interval(secs => secs) where room = p_room;
end $f$;

create or replace function public.mg_wolf_state(p_room text, p_player uuid, p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $f$
declare me mg_players; r mg_rooms; g mg_wolf_g; mp mg_wolf_p; rev boolean; fin boolean;
  players jsonb; mine jsonb; picks jsonb := '[]'::jsonb; seer jsonb := '[]'::jsonb; witch jsonb; peeks jsonb := '[]'::jsonb; voted int; need int; lg jsonb;
  v1 uuid; v2 uuid; shoot uuid;
begin
  me := mg_auth(p_room, p_player, p_token);
  perform mg_wolf_tick(me.room);
  select * into r from mg_rooms where code = me.room;
  select * into g from mg_wolf_g where room = me.room;
  if not found then return null; end if;
  select * into mp from mg_wolf_p where room = me.room and player = me.id;
  fin := r.status = 'over';
  rev := coalesce((r.settings->'wolf'->>'reveal')::boolean, true);
  select coalesce(jsonb_agg(jsonb_build_object('id', p.player, 'alive', p.alive, 'revealed', p.revealed,
      'role', case when fin or p.player = me.id or p.revealed or (not p.alive and rev) or (mg_wolf_isw(mp.role) and mg_wolf_isw(p.role)) then p.role end)
      order by pl.joined), '[]'::jsonb) into players
    from mg_wolf_p p join mg_players pl on pl.id = p.player where p.room = me.room;
  select coalesce(jsonb_object_agg(kind, target), '{}'::jsonb) into mine
    from mg_wolf_act where room = me.room and day_no = g.day_no and actor = me.id;
  if mg_wolf_isw(mp.role) then
    select coalesce(jsonb_agg(jsonb_build_object('from', actor, 'to', target, 'kind', kind)), '[]'::jsonb) into picks
      from mg_wolf_act where room = me.room and day_no = g.day_no and kind in ('kill','kill2');
  end if;
  if mp.role = 'seer' then
    select coalesce(jsonb_agg(jsonb_build_object('day', a.day_no, 'target', a.target, 'wolf', mg_wolf_isw(t.role)) order by a.day_no), '[]'::jsonb) into seer
      from mg_wolf_act a join mg_wolf_p t on t.room = a.room and t.player = a.target
     where a.room = me.room and a.kind = 'see' and a.actor = me.id;
  end if;
  if mp.role = 'littlegirl' then
    select coalesce(jsonb_agg(jsonb_build_object('day', a.day_no, 'target', a.target) order by a.day_no), '[]'::jsonb) into peeks
      from mg_wolf_act a where a.room = me.room and a.kind = 'peek' and a.actor = me.id;
  end if;
  if mp.role = 'hunter' then
    select a.target into shoot from mg_wolf_act a where a.room = me.room and a.actor = me.id and a.kind = 'shoot' and a.target is not null order by a.day_no desc limit 1;
  end if;
  if mp.role = 'witch' then
    if g.phase = 'night' then
      select a.target into v1 from mg_wolf_act a join mg_wolf_p p on p.room = a.room and p.player = a.actor and p.alive and mg_wolf_isw(p.role)
       where a.room = me.room and a.day_no = g.day_no and a.kind = 'kill' and a.target is not null group by a.target order by count(*) desc, a.target limit 1;
      if g.cub_day is not distinct from g.day_no then
        select a.target into v2 from mg_wolf_act a join mg_wolf_p p on p.room = a.room and p.player = a.actor and p.alive and mg_wolf_isw(p.role)
         where a.room = me.room and a.day_no = g.day_no and a.kind = 'kill2' and a.target is not null and a.target is distinct from v1 group by a.target order by count(*) desc, a.target limit 1;
      end if;
    end if;
    select jsonb_build_object(
      'heal_used', exists (select 1 from mg_wolf_act a where a.room = me.room and a.actor = me.id and a.kind = 'heal'),
      'poison_used', exists (select 1 from mg_wolf_act a where a.room = me.room and a.actor = me.id and a.kind = 'poison'),
      'done', exists (select 1 from mg_wolf_act a where a.room = me.room and a.day_no = g.day_no and a.actor = me.id and a.kind in ('heal','poison','witchpass')),
      'victim', v1, 'victim2', v2) into witch;
  end if;
  select count(*) into need from mg_wolf_p where room = me.room and alive and not revealed;
  select count(*) into voted from mg_wolf_act a join mg_wolf_p p on p.room = a.room and p.player = a.actor and p.alive and not p.revealed
   where a.room = me.room and a.day_no = g.day_no and a.kind = 'vote';
  if fin then lg := g.log;
  else select coalesce(jsonb_agg(e - 'saved' order by ord), '[]'::jsonb) into lg from jsonb_array_elements(g.log) with ordinality t(e, ord); end if;
  return jsonb_build_object('phase', g.phase, 'day_no', g.day_no, 'phase_end', g.phase_end, 'phase_secs', g.phase_secs,
    'winner', g.winner, 'role', mp.role, 'was', mp.was, 'lover', mp.lover, 'alive', coalesce(mp.alive, false), 'revealed', coalesce(mp.revealed, false),
    'players', players, 'mine', mine, 'wolf_picks', picks, 'cub_double', (g.phase = 'night' and g.cub_day is not distinct from g.day_no),
    'seer', seer, 'peeks', peeks, 'shoot', shoot, 'witch', witch, 'voted', voted, 'need', need, 'log', lg, 'reveal', rev);
end $f$;

create or replace function public.mg_settings(p_room text, p_player uuid, p_token uuid, p_game text, p_settings jsonb) returns void
language plpgsql security definer set search_path = public as $f$
declare me mg_players; r mg_rooms; s jsonb;
begin
  me := mg_auth(p_room, p_player, p_token);
  select * into r from mg_rooms where code = me.room for update;
  if r.host_id <> me.id then raise exception 'host_only'; end if;
  if r.status = 'playing' then raise exception 'in_progress'; end if;
  s := jsonb_build_object(
    'reveal', coalesce((p_settings->>'reveal')::boolean, (r.settings->>'reveal')::boolean),
    'minutes', least(30, greatest(0, coalesce((p_settings->>'minutes')::int, (r.settings->>'minutes')::int))),
    'mode', case when p_settings->>'mode' in ('all','cat','chaos') then p_settings->>'mode' else r.settings->>'mode' end,
    'levels', coalesce(p_settings->'levels', r.settings->'levels'),
    'cats', coalesce(p_settings->'cats', r.settings->'cats'),
    'accept', coalesce((p_settings->>'accept')::boolean, (r.settings->>'accept')::boolean, false),
    'wolf', jsonb_build_object(
      'day', least(300, greatest(30, coalesce((p_settings->'wolf'->>'day')::int, (r.settings->'wolf'->>'day')::int, 120))),
      'reveal', coalesce((p_settings->'wolf'->>'reveal')::boolean, (r.settings->'wolf'->>'reveal')::boolean, true),
      'wolves', least(3, greatest(0, coalesce((p_settings->'wolf'->>'wolves')::int, (r.settings->'wolf'->>'wolves')::int, 0))),
      'roles', case when jsonb_typeof(p_settings->'wolf'->'roles') = 'array'
        then coalesce((select jsonb_agg(distinct x) from jsonb_array_elements_text(p_settings->'wolf'->'roles') x
                        where x in ('seer','guard','witch','mayor','idiot','alpha','cub','hunter','cupid','littlegirl','killer','infected','thief')), '[]'::jsonb)
        else r.settings->'wolf'->'roles' end));
  update mg_rooms set game = case when p_game in ('forbidden','solo','wolf') then p_game else 'head' end,
    settings = s, status = 'lobby', updated_at = now() where code = r.code;
end $f$;
