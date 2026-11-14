-- เกมวงเพื่อน: ตาราง + ฟังก์ชัน RPC (ทุกตารางล็อก RLS, เข้าถึงผ่าน RPC + โทเคนผู้เล่นเท่านั้น)
create table public.mg_words (id serial primary key, category text not null, level smallint not null check (level between 1 and 5), text text not null unique);
create table public.mg_rooms (
  code text primary key,
  game text not null default 'head' check (game in ('head','forbidden')),
  status text not null default 'lobby' check (status in ('lobby','playing','over')),
  host_id uuid,
  settings jsonb not null default '{"reveal":true,"minutes":0,"mode":"all","levels":[1,2,3],"cats":[]}',
  round int not null default 0,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create table public.mg_players (
  id uuid primary key default gen_random_uuid(),
  room text not null references public.mg_rooms(code) on delete cascade,
  token uuid not null default gen_random_uuid(),
  name text not null, hue int not null default 0, score int not null default 0,
  seen timestamptz not null default now(), joined timestamptz not null default now());
create table public.mg_hands (
  room text not null references public.mg_rooms(code) on delete cascade,
  round int not null,
  player uuid not null references public.mg_players(id) on delete cascade,
  word text not null,
  state text not null default 'active' check (state in ('active','out','solved','gaveup')),
  rank int, pts int not null default 0,
  primary key (room, round, player));
create table public.mg_claims (
  id bigserial primary key,
  room text not null references public.mg_rooms(code) on delete cascade,
  round int not null,
  target uuid not null references public.mg_players(id) on delete cascade,
  accuser uuid not null references public.mg_players(id) on delete cascade,
  votes jsonb not null default '{}',
  status text not null default 'open' check (status in ('open','upheld','dismissed')),
  created_at timestamptz not null default now());
alter table public.mg_words enable row level security;
alter table public.mg_rooms enable row level security;
alter table public.mg_players enable row level security;
alter table public.mg_hands enable row level security;
alter table public.mg_claims enable row level security;
revoke all on public.mg_words, public.mg_rooms, public.mg_players, public.mg_hands, public.mg_claims from anon, authenticated;

-- ===== ตัวช่วยภายใน (ไม่เปิดให้เรียกจากเว็บ) =====
create function public.mg_norm(t text) returns text language sql immutable set search_path = public as
$$ select regexp_replace(lower(coalesce(t,'')),'[[:space:][:punct:]]+','','g') $$;

create function public.mg_auth(p_room text, p_player uuid, p_token uuid) returns public.mg_players
language plpgsql security definer set search_path = public as $$
declare p mg_players;
begin
  select * into p from mg_players where id = p_player and room = upper(trim(p_room)) and token = p_token;
  if not found then raise exception 'unauthorized'; end if;
  update mg_players set seen = now() where id = p.id;
  return p;
end $$;

create function public.mg_pool(s jsonb) returns setof public.mg_words
language sql stable security definer set search_path = public as $$
  select * from mg_words w where case s->>'mode'
    when 'chaos' then (w.level >= 4 or w.category = 'คำกวน')
    when 'cat' then w.category in (select jsonb_array_elements_text(s->'cats'))
                    and w.level in (select (jsonb_array_elements_text(s->'levels'))::int)
    else w.level in (select (jsonb_array_elements_text(s->'levels'))::int) end $$;

create function public.mg_finish(p_room text) returns void
language plpgsql security definer set search_path = public as $$
declare r mg_rooms; n int;
begin
  select * into r from mg_rooms where code = p_room for update;
  if r.status <> 'playing' then return; end if;
  if r.game = 'forbidden' then
    select count(*) into n from mg_hands where room = r.code and round = r.round and state = 'active';
    update mg_players p set score = score + case when n = 1 then 2 else 1 end
      from mg_hands h where h.player = p.id and h.room = r.code and h.round = r.round and h.state = 'active';
    update mg_hands set pts = pts + case when n = 1 then 2 else 1 end
      where room = r.code and round = r.round and state = 'active';
  end if;
  update mg_claims set status = 'dismissed' where room = r.code and round = r.round and status = 'open';
  update mg_rooms set status = 'over', ends_at = null, updated_at = now() where code = r.code;
end $$;

create function public.mg_check_end(p_room text) returns void
language plpgsql security definer set search_path = public as $$
declare r mg_rooms; a int;
begin
  select * into r from mg_rooms where code = p_room;
  if r.status <> 'playing' then return; end if;
  select count(*) into a from mg_hands where room = r.code and round = r.round and state = 'active';
  if a <= 1 then perform mg_finish(p_room); end if;
end $$;

create function public.mg_resolve(cid bigint, force boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare c mg_claims; elig int; need int; y int; nn int;
begin
  select * into c from mg_claims where id = cid and status = 'open' for update;
  if not found then return; end if;
  select count(*) into elig from mg_players where room = c.room and id <> c.target;
  need := elig / 2 + 1;
  select count(*) filter (where value = 'true'::jsonb), count(*) filter (where value = 'false'::jsonb)
    into y, nn from jsonb_each(c.votes) where key <> c.target::text;
  if force or y >= need then
    update mg_claims set status = 'upheld' where id = cid;
    update mg_hands set state = 'out' where room = c.room and round = c.round and player = c.target and state = 'active';
    update mg_hands set pts = pts + 1 where room = c.room and round = c.round and player = c.accuser;
    update mg_players set score = score + 1 where id = c.accuser;
    perform mg_check_end(c.room);
  elsif nn >= elig - need + 1 then
    update mg_claims set status = 'dismissed' where id = cid;
  end if;
end $$;

-- ===== RPC สำหรับหน้าเว็บ =====
create function public.mg_create(p_name text, p_game text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c text; pl mg_players; chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ'; i int; tries int := 0;
begin
  p_name := left(trim(coalesce(p_name,'')), 16);
  if p_name = '' then raise exception 'name_required'; end if;
  delete from mg_rooms where updated_at < now() - interval '1 day';
  loop
    c := '';
    for i in 1..4 loop c := c || substr(chars, 1 + floor(random()*24)::int, 1); end loop;
    exit when not exists (select 1 from mg_rooms where code = c);
    tries := tries + 1;
    if tries > 20 then raise exception 'busy'; end if;
  end loop;
  insert into mg_rooms(code, game) values (c, case when p_game = 'forbidden' then 'forbidden' else 'head' end);
  insert into mg_players(room, name, hue) values (c, p_name, 0) returning * into pl;
  update mg_rooms set host_id = pl.id where code = c;
  return jsonb_build_object('room', c, 'player', pl.id, 'token', pl.token);
end $$;

create function public.mg_join(p_room text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r mg_rooms; pl mg_players; n int;
begin
  p_room := upper(trim(coalesce(p_room,''))); p_name := left(trim(coalesce(p_name,'')), 16);
  if p_name = '' then raise exception 'name_required'; end if;
  select * into r from mg_rooms where code = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.status = 'playing' then raise exception 'in_progress'; end if;
  select count(*) into n from mg_players where room = p_room;
  if n >= 10 then raise exception 'room_full'; end if;
  if exists (select 1 from mg_players where room = p_room and lower(name) = lower(p_name)) then raise exception 'name_taken'; end if;
  insert into mg_players(room, name, hue) values (p_room, p_name, n) returning * into pl;
  update mg_rooms set updated_at = now() where code = p_room;
  return jsonb_build_object('room', p_room, 'player', pl.id, 'token', pl.token);
end $$;

create function public.mg_state(p_room text, p_player uuid, p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me mg_players; r mg_rooms; hands jsonb; claims jsonb; players jsonb; reveal boolean;
begin
  p_room := upper(trim(p_room));
  me := mg_auth(p_room, p_player, p_token);
  select * into r from mg_rooms where code = p_room;
  if r.status = 'playing' and r.ends_at is not null and r.ends_at < now() then
    perform mg_finish(p_room);
    select * into r from mg_rooms where code = p_room;
  end if;
  reveal := coalesce((r.settings->>'reveal')::boolean, true);
  select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'hue', hue, 'score', score,
           'online', seen > now() - interval '20 seconds') order by joined)
    into players from mg_players where room = p_room;
  select coalesce(jsonb_agg(jsonb_build_object('player', h.player, 'state', h.state, 'rank', h.rank, 'pts', h.pts,
    'word', case
      when r.status = 'over' then h.word
      when h.state <> 'active' then h.word
      when r.game = 'head' then case when h.player = p_player then null else h.word end
      else case when h.player = p_player or reveal then h.word else null end end)), '[]'::jsonb)
    into hands from mg_hands h where h.room = p_room and h.round = r.round;
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'target', c.target, 'accuser', c.accuser,
    'word', (select word from mg_hands where room = c.room and round = c.round and player = c.target),
    'yes', (select count(*) from jsonb_each(c.votes) v where v.value = 'true'::jsonb and v.key <> c.target::text),
    'no', (select count(*) from jsonb_each(c.votes) v where v.value = 'false'::jsonb and v.key <> c.target::text),
    'mine', c.votes -> (p_player::text)) order by c.id), '[]'::jsonb)
    into claims from mg_claims c where c.room = p_room and c.round = r.round and c.status = 'open';
  return jsonb_build_object('me', me.id, 'room', r.code, 'game', r.game, 'status', r.status, 'host', r.host_id,
    'settings', r.settings, 'round', r.round, 'ends_at', r.ends_at, 'now', now(),
    'players', coalesce(players, '[]'::jsonb), 'hands', hands, 'claims', claims,
    'cats', (select jsonb_agg(distinct category order by category) from mg_words));
end $$;

create function public.mg_settings(p_room text, p_player uuid, p_token uuid, p_game text, p_settings jsonb) returns void
language plpgsql security definer set search_path = public as $$
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
    'cats', coalesce(p_settings->'cats', r.settings->'cats'));
  update mg_rooms set game = case when p_game = 'forbidden' then 'forbidden' else 'head' end,
    settings = s, status = 'lobby', updated_at = now() where code = r.code;
end $$;

create function public.mg_start(p_room text, p_player uuid, p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me mg_players; r mg_rooms; n int; m int; rd int; pool text[];
begin
  me := mg_auth(p_room, p_player, p_token);
  select * into r from mg_rooms where code = me.room for update;
  if r.host_id <> me.id then raise exception 'host_only'; end if;
  if r.status = 'playing' then raise exception 'in_progress'; end if;
  select count(*) into n from mg_players where room = r.code;
  if n < 2 then raise exception 'need_players'; end if;
  rd := r.round + 1; m := coalesce((r.settings->>'minutes')::int, 0);
  select array_agg(t.text order by random()) into pool from mg_pool(r.settings) t
    where not exists (select 1 from mg_hands h where h.room = r.code and h.word = t.text);
  if coalesce(cardinality(pool), 0) < n then
    delete from mg_hands where room = r.code;
    select array_agg(t.text order by random()) into pool from mg_pool(r.settings) t;
  end if;
  if coalesce(cardinality(pool), 0) < n then raise exception 'few_words'; end if;
  insert into mg_hands(room, round, player, word)
    select r.code, rd, ps.id, pool[ps.rn::int]
    from (select id, row_number() over (order by random()) rn from mg_players where room = r.code) ps;
  delete from mg_claims where room = r.code;
  update mg_rooms set status = 'playing', round = rd, updated_at = now(),
    ends_at = case when m > 0 then now() + make_interval(mins => m) end where code = r.code;
end $$;

create function public.mg_accuse(p_room text, p_player uuid, p_token uuid, p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me mg_players; r mg_rooms; cid bigint;
begin
  me := mg_auth(p_room, p_player, p_token);
  select * into r from mg_rooms where code = me.room for update;
  if r.status <> 'playing' or r.game <> 'forbidden' then raise exception 'bad_state'; end if;
  if me.id = p_target then raise exception 'bad_state'; end if;
  if not exists (select 1 from mg_hands where room = r.code and round = r.round and player = p_target and state = 'active') then raise exception 'bad_state'; end if;
  if exists (select 1 from mg_claims where room = r.code and round = r.round and target = p_target and status = 'open') then raise exception 'already_open'; end if;
  insert into mg_claims(room, round, target, accuser, votes)
    values (r.code, r.round, p_target, me.id, jsonb_build_object(me.id::text, true)) returning id into cid;
  perform mg_resolve(cid);
end $$;

create function public.mg_vote(p_room text, p_player uuid, p_token uuid, p_claim bigint, p_yes boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me mg_players; c mg_claims;
begin
  me := mg_auth(p_room, p_player, p_token);
  select * into c from mg_claims where id = p_claim and room = me.room and status = 'open' for update;
  if not found then return; end if;
  if me.id = c.target then
    if p_yes then perform mg_resolve(c.id, true); end if;
    return;
  end if;
  update mg_claims set votes = votes || jsonb_build_object(me.id::text, p_yes) where id = c.id;
  perform mg_resolve(c.id);
end $$;

create function public.mg_guess(p_room text, p_player uuid, p_token uuid, p_guess text) returns boolean
language plpgsql security definer set search_path = public as $$
declare me mg_players; r mg_rooms; h mg_hands; rk int; pt int;
begin
  me := mg_auth(p_room, p_player, p_token);
  select * into r from mg_rooms where code = me.room for update;
  if r.status <> 'playing' or r.game <> 'head' then raise exception 'bad_state'; end if;
  select * into h from mg_hands where room = r.code and round = r.round and player = me.id and state = 'active';
  if not found then raise exception 'bad_state'; end if;
  if mg_norm(p_guess) = '' or mg_norm(p_guess) <> mg_norm(h.word) then return false; end if;
  select coalesce(max(rank), 0) + 1 into rk from mg_hands where room = r.code and round = r.round;
  pt := greatest(1, 4 - rk);
  update mg_hands set state = 'solved', rank = rk, pts = pt where room = r.code and round = r.round and player = me.id;
  update mg_players set score = score + pt where id = me.id;
  perform mg_check_end(r.code);
  return true;
end $$;

create function public.mg_giveup(p_room text, p_player uuid, p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me mg_players; r mg_rooms;
begin
  me := mg_auth(p_room, p_player, p_token);
  select * into r from mg_rooms where code = me.room for update;
  if r.status <> 'playing' then raise exception 'bad_state'; end if;
  update mg_hands set state = case when r.game = 'head' then 'gaveup' else 'out' end
    where room = r.code and round = r.round and player = me.id and state = 'active';
  perform mg_check_end(r.code);
end $$;

create function public.mg_end(p_room text, p_player uuid, p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me mg_players; r mg_rooms;
begin
  me := mg_auth(p_room, p_player, p_token);
  select * into r from mg_rooms where code = me.room;
  if r.host_id <> me.id then raise exception 'host_only'; end if;
  perform mg_finish(r.code);
end $$;

create function public.mg_lobby(p_room text, p_player uuid, p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me mg_players; r mg_rooms;
begin
  me := mg_auth(p_room, p_player, p_token);
  select * into r from mg_rooms where code = me.room;
  if r.host_id <> me.id then raise exception 'host_only'; end if;
  update mg_rooms set status = 'lobby', updated_at = now() where code = r.code and status <> 'playing';
end $$;

create function public.mg_leave(p_room text, p_player uuid, p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me mg_players; r mg_rooms; nxt uuid;
begin
  me := mg_auth(p_room, p_player, p_token);
  delete from mg_players where id = me.id;
  select * into r from mg_rooms where code = me.room;
  select id into nxt from mg_players where room = me.room order by joined limit 1;
  if nxt is null then delete from mg_rooms where code = me.room; return; end if;
  if r.host_id = me.id then update mg_rooms set host_id = nxt where code = me.room; end if;
  perform mg_check_end(me.room);
end $$;

revoke all on function public.mg_norm(text), public.mg_auth(text,uuid,uuid), public.mg_pool(jsonb),
  public.mg_finish(text), public.mg_check_end(text), public.mg_resolve(bigint,boolean)
  from public, anon, authenticated;
