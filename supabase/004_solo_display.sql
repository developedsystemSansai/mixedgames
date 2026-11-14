-- 004: โหมด 1 คนทายเริ่มได้แม้มีผู้เล่นคนเดียว + จอแสดงคำสำหรับคนดู (ลิงก์ ?watch=รหัสห้อง)
-- รันต่อจาก 003 ใน Supabase SQL Editor

-- 1) mg_start: โหมด solo เริ่มได้ตั้งแต่ 1 คน (เพื่อนที่นั่งอยู่ด้วยกันดูคำจากจอแสดงคำ)
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
  if n < (case when r.game = 'solo' then 1 else 2 end) then raise exception 'need_players'; end if;
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

-- 2) mg_watch: คนดูไม่ต้องเข้าห้อง ไม่ต้องใช้โทเคน เห็นเฉพาะสถานะห้องและ "คำของโหมด solo" เท่านั้น
--    (คำต้องห้าม/อะไรอยู่หัวกู ไม่ถูกส่งออกทางนี้เลย)
create or replace function public.mg_watch(p_room text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r mg_rooms; gh mg_hands; gname text; players jsonb; cat text;
begin
  p_room := upper(trim(p_room));
  select * into r from mg_rooms where code = p_room;
  if not found then raise exception 'room_not_found'; end if;
  if r.status = 'playing' and r.ends_at is not null and r.ends_at < now() then
    perform mg_finish(p_room);
    select * into r from mg_rooms where code = p_room;
  end if;
  select jsonb_agg(jsonb_build_object('name', name, 'hue', hue, 'score', score) order by score desc, joined) into players
    from mg_players where room = p_room;
  if r.game = 'solo' and r.round > 0 and r.guesser is not null then
    select * into gh from mg_hands where room = p_room and round = r.round and player = r.guesser;
    select name into gname from mg_players where id = r.guesser;
    select w.category into cat from mg_words w where w.text = gh.word limit 1;
  end if;
  return jsonb_build_object('room', r.code, 'game', r.game, 'status', r.status, 'round', r.round,
    'ends_at', r.ends_at, 'now', now(), 'minutes', coalesce((r.settings->>'minutes')::int, 0),
    'guesser', gname, 'state', gh.state,
    'word', case when r.game = 'solo' and r.status in ('playing', 'over') then gh.word end,
    'emoji', case when r.game = 'solo' and r.status in ('playing', 'over') then gh.emoji end,
    'category', case when r.game = 'solo' and r.status in ('playing', 'over') then cat end,
    'players', coalesce(players, '[]'::jsonb));
end $$;
grant execute on function public.mg_watch(text) to anon, authenticated;
