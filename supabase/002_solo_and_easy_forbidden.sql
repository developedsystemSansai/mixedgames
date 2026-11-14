-- 002: โหมด "อะไรอยู่หัวกู · 1 คนทาย" (solo) + รูปประกอบคำ + คำต้องห้ามใช้หมวดเดียวกัน/คำง่ายในชีวิตประจำวัน
alter table public.mg_words add column if not exists emoji text;
alter table public.mg_hands add column if not exists emoji text;
alter table public.mg_rooms add column if not exists guesser uuid;

alter table public.mg_rooms drop constraint if exists mg_rooms_game_check;
alter table public.mg_rooms add constraint mg_rooms_game_check check (game in ('head','forbidden','solo'));
alter table public.mg_hands drop constraint if exists mg_hands_state_check;
alter table public.mg_hands add constraint mg_hands_state_check check (state in ('active','out','solved','gaveup','helper'));

-- เลือกหมวดเดียวสำหรับรอบนั้น: คำต้องห้าม = เฉพาะคำระดับ 1 (ง่าย) ที่หมวดมีคำพอกับจำนวนผู้เล่น, solo = เฉพาะคำที่มีรูป
create or replace function public.mg_pick_cat(p_room text, p_game text, s jsonb, need int) returns text
language sql security definer set search_path = public as $$
  select w.category from mg_words w
  where (case p_game when 'forbidden' then w.level = 1 else w.emoji is not null end)
    and (coalesce(s->>'mode','all') <> 'cat' or jsonb_array_length(coalesce(s->'cats','[]'::jsonb)) = 0
         or w.category in (select jsonb_array_elements_text(s->'cats')))
    and not exists (select 1 from mg_hands h where h.room = p_room and h.word = w.text)
  group by w.category
  having count(*) >= case when p_game = 'forbidden' then need else 1 end
  order by random() limit 1 $$;
revoke all on function public.mg_pick_cat(text,text,jsonb,int) from public, anon, authenticated;

create or replace function public.mg_check_end(p_room text) returns void
language plpgsql security definer set search_path = public as $$
declare r mg_rooms; a int;
begin
  select * into r from mg_rooms where code = p_room;
  if r.status <> 'playing' then return; end if;
  select count(*) into a from mg_hands where room = r.code and round = r.round and state = 'active';
  if (r.game = 'solo' and a = 0) or (r.game <> 'solo' and a <= 1) then perform mg_finish(p_room); end if;
end $$;

create or replace function public.mg_create(p_name text, p_game text) returns jsonb
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
  insert into mg_rooms(code, game) values (c, case when p_game in ('forbidden','solo') then p_game else 'head' end);
  insert into mg_players(room, name, hue) values (c, p_name, 0) returning * into pl;
  update mg_rooms set host_id = pl.id where code = c;
  return jsonb_build_object('room', c, 'player', pl.id, 'token', pl.token);
end $$;

create or replace function public.mg_settings(p_room text, p_player uuid, p_token uuid, p_game text, p_settings jsonb) returns void
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
  update mg_rooms set game = case when p_game in ('forbidden','solo') then p_game else 'head' end,
    settings = s, status = 'lobby', updated_at = now() where code = r.code;
end $$;

create or replace function public.mg_start(p_room text, p_player uuid, p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me mg_players; r mg_rooms; n int; m int; rd int; pool text[]; cat text;
  ids uuid[]; idx int; g uuid; v_word text; v_emoji text;
begin
  me := mg_auth(p_room, p_player, p_token);
  select * into r from mg_rooms where code = me.room for update;
  if r.host_id <> me.id then raise exception 'host_only'; end if;
  if r.status = 'playing' then raise exception 'in_progress'; end if;
  select count(*) into n from mg_players where room = r.code;
  if n < 2 then raise exception 'need_players'; end if;
  rd := r.round + 1; m := coalesce((r.settings->>'minutes')::int, 0);

  if r.game = 'head' then
    select array_agg(t.text order by random()) into pool from mg_pool(r.settings) t
      where not exists (select 1 from mg_hands h where h.room = r.code and h.word = t.text);
    if coalesce(cardinality(pool), 0) < n then
      delete from mg_hands where room = r.code;
      select array_agg(t.text order by random()) into pool from mg_pool(r.settings) t;
    end if;
    if coalesce(cardinality(pool), 0) < n then raise exception 'few_words'; end if;
    insert into mg_hands(room, round, player, word, emoji)
      select r.code, rd, ps.id, pool[ps.rn::int], (select ww.emoji from mg_words ww where ww.text = pool[ps.rn::int] limit 1)
      from (select id, row_number() over (order by random()) rn from mg_players where room = r.code) ps;
  else
    cat := mg_pick_cat(r.code, r.game, r.settings, n);
    if cat is null then
      delete from mg_hands where room = r.code;
      cat := mg_pick_cat(r.code, r.game, r.settings, n);
    end if;
    if cat is null then raise exception 'few_words'; end if;

    if r.game = 'forbidden' then
      -- ทุกคนได้คำต่างกัน แต่อยู่ในหมวดเดียวกัน และเป็นคำง่าย (ระดับ 1)
      insert into mg_hands(room, round, player, word, emoji)
        select r.code, rd, ps.id, x.text, x.emoji
        from (select id, row_number() over (order by random()) rn from mg_players where room = r.code) ps
        join (select ww.text, ww.emoji, row_number() over (order by random()) rn from mg_words ww
              where ww.category = cat and ww.level = 1
                and not exists (select 1 from mg_hands h where h.room = r.code and h.word = ww.text)) x on x.rn = ps.rn;
    else
      -- solo: คำเดียวสำหรับทั้งห้อง ผู้ทาย 1 คนหมุนเวียนตามลำดับที่เข้าห้อง
      select ww.text, ww.emoji into v_word, v_emoji from mg_words ww
        where ww.category = cat and ww.emoji is not null
          and not exists (select 1 from mg_hands h where h.room = r.code and h.word = ww.text)
        order by random() limit 1;
      select array_agg(id order by joined, id) into ids from mg_players where room = r.code;
      idx := array_position(ids, r.guesser);
      g := case when idx is null then ids[((rd - 1) % n) + 1] else ids[(idx % n) + 1] end;
      insert into mg_hands(room, round, player, word, emoji, state)
        select r.code, rd, id, v_word, v_emoji, case when id = g then 'active' else 'helper' end
        from mg_players where room = r.code;
      update mg_rooms set guesser = g where code = r.code;
    end if;
  end if;

  delete from mg_claims where room = r.code;
  update mg_rooms set status = 'playing', round = rd, updated_at = now(),
    ends_at = case when m > 0 then now() + make_interval(mins => m) end where code = r.code;
end $$;

create or replace function public.mg_guess(p_room text, p_player uuid, p_token uuid, p_guess text) returns boolean
language plpgsql security definer set search_path = public as $$
declare me mg_players; r mg_rooms; h mg_hands; rk int; pt int;
begin
  me := mg_auth(p_room, p_player, p_token);
  select * into r from mg_rooms where code = me.room for update;
  if r.status <> 'playing' or r.game not in ('head','solo') then raise exception 'bad_state'; end if;
  select * into h from mg_hands where room = r.code and round = r.round and player = me.id and state = 'active';
  if not found then raise exception 'bad_state'; end if;
  if mg_norm(p_guess) = '' or mg_norm(p_guess) <> mg_norm(h.word) then return false; end if;
  if r.game = 'solo' then
    rk := 1; pt := 3;  -- ผู้ทายได้ 3 แต้ม ผู้ช่วยทุกคนได้ 1 แต้ม
    update mg_hands set pts = 1 where room = r.code and round = r.round and player <> me.id;
    update mg_players set score = score + 1 where room = r.code and id <> me.id;
  else
    select coalesce(max(rank), 0) + 1 into rk from mg_hands where room = r.code and round = r.round;
    pt := greatest(1, 4 - rk);
  end if;
  update mg_hands set state = 'solved', rank = rk, pts = pt where room = r.code and round = r.round and player = me.id;
  update mg_players set score = score + pt where id = me.id;
  perform mg_check_end(r.code);
  return true;
end $$;

create or replace function public.mg_giveup(p_room text, p_player uuid, p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me mg_players; r mg_rooms;
begin
  me := mg_auth(p_room, p_player, p_token);
  select * into r from mg_rooms where code = me.room for update;
  if r.status <> 'playing' then raise exception 'bad_state'; end if;
  update mg_hands set state = case when r.game in ('head','solo') then 'gaveup' else 'out' end
    where room = r.code and round = r.round and player = me.id and state = 'active';
  perform mg_check_end(r.code);
end $$;

create or replace function public.mg_state(p_room text, p_player uuid, p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me mg_players; r mg_rooms; hands jsonb; claims jsonb; players jsonb; reveal boolean; gs text; hide boolean; cat text;
begin
  p_room := upper(trim(p_room));
  me := mg_auth(p_room, p_player, p_token);
  select * into r from mg_rooms where code = p_room;
  if r.status = 'playing' and r.ends_at is not null and r.ends_at < now() then
    perform mg_finish(p_room);
    select * into r from mg_rooms where code = p_room;
  end if;
  reveal := coalesce((r.settings->>'reveal')::boolean, true);
  -- solo: ผู้ทายที่ยังทายอยู่ห้ามเห็นคำ/รูปของใครเลย (เซิร์ฟเวอร์ไม่ส่งให้)
  select state into gs from mg_hands where room = p_room and round = r.round and player = r.guesser;
  hide := r.game = 'solo' and p_player = r.guesser and gs = 'active';
  select w.category into cat from mg_hands h join mg_words w on w.text = h.word where h.room = p_room and h.round = r.round limit 1;
  select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'hue', hue, 'score', score,
           'online', seen > now() - interval '20 seconds') order by joined)
    into players from mg_players where room = p_room;
  select coalesce(jsonb_agg(jsonb_build_object('player', x.player, 'state', x.state, 'rank', x.rank, 'pts', x.pts,
    'word', case when x.vis then x.word end, 'emoji', case when x.vis then x.emoji end)), '[]'::jsonb)
    into hands
    from (select h.player, h.state, h.rank, h.pts, h.word, h.emoji,
            case when r.status = 'over' then true
                 when r.game = 'solo' then not hide
                 when h.state <> 'active' then true
                 when r.game = 'head' then h.player <> p_player
                 else (h.player = p_player or reveal) end as vis
          from mg_hands h where h.room = p_room and h.round = r.round) x;
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'target', c.target, 'accuser', c.accuser,
    'word', (select word from mg_hands where room = c.room and round = c.round and player = c.target),
    'yes', (select count(*) from jsonb_each(c.votes) v where v.value = 'true'::jsonb and v.key <> c.target::text),
    'no', (select count(*) from jsonb_each(c.votes) v where v.value = 'false'::jsonb and v.key <> c.target::text),
    'mine', c.votes -> (p_player::text)) order by c.id), '[]'::jsonb)
    into claims from mg_claims c where c.room = p_room and c.round = r.round and c.status = 'open';
  return jsonb_build_object('me', me.id, 'room', r.code, 'game', r.game, 'status', r.status, 'host', r.host_id,
    'guesser', r.guesser, 'category', case when r.game = 'forbidden' or (r.game = 'solo' and not hide) then cat end, 'settings', r.settings, 'round', r.round, 'ends_at', r.ends_at, 'now', now(),
    'players', coalesce(players, '[]'::jsonb), 'hands', hands, 'claims', claims,
    'cats', (select jsonb_agg(distinct w.category order by w.category) from mg_words w
             where case r.game when 'forbidden' then w.level = 1 when 'solo' then w.emoji is not null else true end));
end $$;
