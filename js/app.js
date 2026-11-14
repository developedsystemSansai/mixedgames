(() => {
  const CFG = window.MG_CONFIG;
  const sb = supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ld = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const sv = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };

  const GAMES = {
    head: { name: 'อะไรอยู่หัวกู', rule: 'เห็นคำของเพื่อนทุกคน ยกเว้นของตัวเอง ถามใช่/ไม่ใช่แล้วทายให้ได้ก่อน' },
    forbidden: { name: 'คำต้องห้าม', rule: 'ทุกคนมีคำที่ห้ามพูด ชวนคุยให้เพื่อนหลุดพูดคำของตัวเอง' },
  };
  const LV = ['ง่ายมาก', 'ง่าย', 'ปานกลาง', 'ยาก', 'ยากมาก'];
  const MODES = { all: 'สุ่มทุกหมวด', cat: 'เลือกหมวด', chaos: 'Chaos' };
  const ERR = {
    unauthorized: 'หมดเวลาเชื่อมต่อ ลองเข้าห้องใหม่', room_not_found: 'ไม่พบห้องนี้ เช็กรหัสอีกที', in_progress: 'ห้องนี้กำลังเล่นอยู่ รอจบรอบก่อน',
    room_full: 'ห้องเต็มแล้ว (สูงสุด 10 คน)', name_taken: 'มีคนใช้ชื่อนี้ในห้องแล้ว', name_required: 'ใส่ชื่อก่อนนะ', need_players: 'ต้องมีอย่างน้อย 2 คน',
    few_words: 'คำในหมวดนี้ไม่พอ ลองเพิ่มระดับหรือหมวด', host_only: 'เฉพาะโฮสต์เท่านั้น', already_open: 'มีคนจับคนนี้อยู่แล้ว', bad_state: 'ทำรายการนี้ไม่ได้ในตอนนี้', busy: 'ระบบยุ่งอยู่ ลองอีกครั้ง',
  };
  const P = {
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    crown: '<path d="M4 18h16M5 18L3.5 8l5 4L12 5l3.5 7 5-4L19 18"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flag: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>', send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
    out: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
  };
  const ico = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

  let sess = null, S = null, ch = null, offset = 0, busy = false, homeGame = 'head', lastRound = -1, last = '', fired = false, tt;
  try { sess = JSON.parse(ld('mg.sess')); } catch {}
  const inviteCode = () => (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);

  const say = (m) => { const t = $('#toast'); t.textContent = ERR[m] || m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3500); };

  async function call(fn, extra = {}) {
    const { data, error } = await sb.rpc(fn, { p_room: sess.room, p_player: sess.player, p_token: sess.token, ...extra });
    if (error) throw new Error(error.message);
    return data;
  }
  const ping = () => ch && ch.send({ type: 'broadcast', event: 'ping', payload: {} });
  async function act(fn, extra) {
    try { const r = await call(fn, extra); ping(); await refresh(); return r; }
    catch (e) { say(e.message); await refresh(); }
  }
  async function refresh() {
    if (!sess || busy) return;
    busy = true;
    try { const d = await call('mg_state'); offset = Date.parse(d.now) - Date.now(); S = d; render(); }
    catch (e) { if (e.message === 'unauthorized') { say('ห้องนี้ปิดไปแล้ว หรือคุณถูกลบออกจากห้อง'); leaveLocal(); } }
    finally { busy = false; }
  }
  function enter(s) {
    sess = s; sv('mg.sess', JSON.stringify(s)); S = null;
    if (ch) sb.removeChannel(ch);
    ch = sb.channel('mg:' + s.room).on('broadcast', { event: 'ping' }, () => refresh()).subscribe();
    history.replaceState(null, '', '?room=' + s.room);
    render(); refresh();
  }
  function leaveLocal() {
    sess = null; S = null; sv('mg.sess', null); lastRound = -1;
    if (ch) { sb.removeChannel(ch); ch = null; }
    history.replaceState(null, '', location.pathname); render();
  }

  /* ---------- views ---------- */
  const avatar = (p) => `<span class="av" style="--h:${(p.hue * 37 + 12) % 360}" aria-hidden="true">${esc((p.name.match(/[ก-ฮA-Za-z0-9]/) || [[...p.name][0]])[0])}</span>`;
  const H = (id) => S.hands.find((h) => h.player === id);
  const PL = (id) => S.players.find((p) => p.id === id) || { name: '?', hue: 0 };
  const top = (mid = '') => `<div class="top"><span class="roomcode" aria-label="รหัสห้อง ${S.room}">${S.room}</span>${mid}<button class="btn ghost sm" data-act="leave">${ico('out')}ออก</button></div>`;
  const timer = () => (S.ends_at ? `<span class="timer num" data-end="${S.ends_at}">${ico('clock')}<span data-t></span></span>` : `<span class="mute">รอบที่ ${S.round}</span>`);
  const ticket = (cls, lbl, word, sub, q) => `<div class="ticket ${cls}"><span class="lbl">${lbl}</span><span class="word${q ? ' q' : ''}">${esc(word)}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;

  function home() {
    const q = inviteCode(), name = esc(ld('mg.name') || '');
    const join = `<section class="panel"><h2>เข้าห้องของเพื่อน</h2><label class="field">รหัสห้อง 4 ตัว<input id="code" class="code-in" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="ABCD" value="${esc(q)}"></label><button class="btn ${q ? 'primary' : ''} block" data-act="join">${ico('play')}เข้าห้อง</button></section>`;
    const create = `<section class="panel"><h2>เปิดห้องใหม่</h2><div class="seg two" role="group" aria-label="เลือกเกม">${Object.entries(GAMES).map(([k, g]) => `<button class="opt" data-act="pickgame" data-v="${k}" aria-pressed="${k === homeGame}"><b>${g.name}</b><small>${g.rule}</small></button>`).join('')}</div><button class="btn ${q ? '' : 'primary'} block" data-act="create">สร้างห้อง</button></section>`;
    return `<div class="stack lg"><div class="stack"><h1>เกมวงเพื่อน</h1><p class="mute">เปิดห้อง ส่งรหัสให้เพื่อน แล้วเล่นพร้อมกันบนมือถือได้สูงสุด 10 คน</p></div>
      <label class="field">ชื่อที่ใช้ในเกม<input id="name" maxlength="16" autocomplete="off" placeholder="เช่น บี" value="${name}"></label>${q ? join + create : create + join}</div>`;
  }

  function lobby() {
    const host = S.host === S.me, st = S.settings, g = S.game, n = S.players.length;
    const list = `<ul class="plist">${S.players.map((p) => `<li class="${p.online ? '' : 'off'}">${avatar(p)}<span class="nm">${esc(p.name)}${p.id === S.me ? ' <span class="mute">(คุณ)</span>' : ''}</span>${p.id === S.host ? `<span class="crown" title="โฮสต์">${ico('crown')}</span>` : ''}${S.round ? `<span class="num mute">${p.score} แต้ม</span>` : ''}</li>`).join('')}</ul>`;
    const chips = (arr, fn) => `<div class="chips">${arr.map(fn).join('')}</div>`;
    const settings = host ? `<section class="panel"><h2>ตั้งค่าเกม</h2>
      <div class="seg two" role="group" aria-label="เกม">${Object.entries(GAMES).map(([k, x]) => `<button class="opt" data-act="game" data-v="${k}" aria-pressed="${k === g}"><b>${x.name}</b><small>${x.rule}</small></button>`).join('')}</div>
      <div class="seg three" role="group" aria-label="โหมดสุ่มคำ">${Object.entries(MODES).map(([k, t]) => `<button class="chip" data-act="mode" data-v="${k}" aria-pressed="${st.mode === k}">${t}</button>`).join('')}</div>
      ${st.mode === 'chaos' ? '<p class="hint">Chaos: สุ่มเฉพาะคำยากมากและคำกวนประสาท</p>' : chips(LV, (t, i) => `<button class="chip" data-act="lvl" data-v="${i + 1}" aria-pressed="${st.levels.includes(i + 1)}">${t}</button>`)}
      ${st.mode === 'cat' ? chips(S.cats || [], (c) => `<button class="chip" data-act="cat" data-v="${esc(c)}" aria-pressed="${st.cats.includes(c)}">${esc(c)}</button>`) : ''}
      <hr class="divider"><div class="chips">${[0, 3, 5, 10].map((m) => `<button class="chip" data-act="mins" data-v="${m}" aria-pressed="${st.minutes === m}">${m ? m + ' นาที' : 'ไม่จำกัดเวลา'}</button>`).join('')}
      ${g === 'forbidden' ? `<button class="chip" data-act="reveal" aria-pressed="${st.reveal}">เห็นคำของคนอื่น (ไว้หลอกล่อ)</button>` : ''}</div></section>`
      : `<section class="panel"><h2>${GAMES[g].name}</h2><p class="mute">${GAMES[g].rule}</p><p class="hint">โหมด ${MODES[st.mode]} · ${st.minutes ? st.minutes + ' นาที' : 'ไม่จำกัดเวลา'} · รอโฮสต์กดเริ่ม</p></section>`;
    return `${top()}<div class="stack lg">
      <div class="stack"><div class="big-code" aria-label="รหัสห้อง">${S.room}</div>
      <button class="btn sun block" data-act="share">${ico('link')}คัดลอกลิงก์เชิญเพื่อน</button></div>
      <section class="stack"><div class="row between"><h2>ผู้เล่น</h2><span class="mute num">${n}/10</span></div>${list}</section>${settings}
      ${host ? `<div class="stack"><button class="btn primary block" data-act="start" ${n < 2 ? 'disabled' : ''}>${ico('play')}${S.round ? 'เริ่มรอบใหม่' : 'เริ่มเกม'}</button>${n < 2 ? '<p class="hint">ต้องมีอย่างน้อย 2 คน (สนุกสุด 5–10 คน)</p>' : ''}</div>` : ''}</div>`;
  }

  const hostEnd = () => (S.host === S.me ? `<button class="btn ghost block" data-act="end">จบรอบนี้</button>` : '');

  function headGame() {
    const me = H(S.me) || {};
    let mine;
    if (me.state === 'solved') mine = ticket('mine win', 'ทายถูกแล้ว', me.word, `อันดับ ${me.rank} · +${me.pts} แต้ม`);
    else if (me.state === 'gaveup') mine = ticket('mine dead', 'คุณยอมแพ้', me.word, 'คำบนหัวคุณคือคำนี้');
    else mine = ticket('mine', 'คำบนหัวของคุณ', '?', 'ถามเพื่อนเป็นใช่/ไม่ใช่ แล้วพิมพ์ทายด้านล่าง', true);
    const guess = me.state === 'active' ? `<div class="stack"><div class="row"><label class="field" style="flex:1"><span class="sub mute">ทายเลย</span><input id="guess" maxlength="60" autocomplete="off" placeholder="คิดว่าเป็นอะไร?"></label><button class="btn primary" data-act="guess" aria-label="ส่งคำทาย" style="align-self:end">${ico('send')}</button></div><button class="btn ghost" data-act="giveup">ยอมแพ้ ขอดูเฉลย</button></div>` : '';
    const others = S.players.filter((p) => p.id !== S.me).map((p) => {
      const h = H(p.id) || {}, done = h.state && h.state !== 'active';
      return `<li class="hand"><span>${avatar(p)}</span><span class="who"><b>${esc(p.name)}</b>${h.state === 'solved' ? `<span class="tag good">ทายถูก อันดับ ${h.rank}</span>` : h.state === 'gaveup' ? '<span class="tag bad">ยอมแพ้</span>' : '<span class="sub mute">ยังทายอยู่</span>'}</span><span class="stub ${done ? 'dim' : ''}">${esc(h.word)}</span></li>`;
    }).join('');
    return `${top(timer())}<div class="stack lg">${mine}${guess}<section class="stack"><h2>คำบนหัวเพื่อน</h2><ul class="plist rowlist">${others}</ul></section>${hostEnd()}</div>`;
  }

  function forbGame() {
    const me = H(S.me) || {}, out = me.state === 'out';
    const mine = out ? ticket('mine dead', 'คุณหลุดแล้ว', me.word, 'ยังช่วยโหวตจับเพื่อนได้') : ticket('mine', 'คำต้องห้ามของคุณ · ห้ามพูด', me.word, 'คุยตามปกติ แต่อย่าเผลอพูดคำนี้');
    const open = new Set(S.claims.map((c) => c.target));
    const claims = S.claims.map((c) => {
      const self = c.target === S.me, v = c.mine;
      const btns = self ? `<button class="btn sm" data-act="vote" data-id="${c.id}" data-v="1">ยอมรับว่าพูดแล้ว</button>`
        : `<button class="btn sm ${v === true ? 'sun' : ''}" data-act="vote" data-id="${c.id}" data-v="1">${ico('check')}ได้ยินจริง</button><button class="btn sm ${v === false ? 'sun' : ''}" data-act="vote" data-id="${c.id}" data-v="0">${ico('x')}ไม่ใช่</button>`;
      return `<div class="claim"><p><b>${esc(PL(c.accuser).name)}</b> จับ <b>${self ? 'คุณ' : esc(PL(c.target).name)}</b> ว่าพูดคำว่า <span class="stub">${esc(c.word)}</span></p><div class="row between wrap"><span class="sub mute num">เห็นด้วย ${c.yes} · ไม่ใช่ ${c.no}</span><div class="row">${btns}</div></div></div>`;
    }).join('');
    const others = S.players.filter((p) => p.id !== S.me).map((p) => {
      const h = H(p.id) || {}, alive = h.state === 'active';
      return `<li class="hand"><span>${avatar(p)}</span><span class="who"><b>${esc(p.name)}</b><span class="tag ${alive ? 'good' : 'bad'}" style="justify-self:start">${alive ? 'ยังอยู่' : 'หลุดแล้ว'}</span></span>
        <span class="row" style="flex-direction:column;align-items:flex-end;gap:8px">${h.word ? `<span class="stub ${alive ? '' : 'dim'}">${esc(h.word)}</span>` : '<span class="stub dim">ซ่อนไว้</span>'}${alive && !open.has(p.id) ? `<button class="btn sm" data-act="accuse" data-id="${p.id}">${ico('flag')}จับได้!</button>` : ''}</span></li>`;
    }).join('');
    return `${top(timer())}<div class="stack lg">${mine}${claims ? `<section class="stack"><h2>รอโหวต</h2>${claims}</section>` : ''}<section class="stack"><h2>เพื่อนในวง</h2><ul class="plist rowlist">${others}</ul></section>${hostEnd()}</div>`;
  }

  function over() {
    const host = S.host === S.me, hands = S.hands;
    let head;
    if (S.game === 'head') { const w = hands.find((h) => h.rank === 1); head = w ? `${esc(PL(w.player).name)} ทายถูกก่อน` : 'ไม่มีใครทายถูกเลย'; }
    else { const a = hands.filter((h) => h.state === 'active'); head = a.length === 1 ? `${esc(PL(a[0].player).name)} รอดคนสุดท้าย` : a.length ? `${a.length} คนรอดจนหมดเวลา` : 'ไม่มีใครรอด'; }
    const rows = [...S.players].sort((a, b) => b.score - a.score).map((p, i) => {
      const h = H(p.id);
      return `<li><span class="rank num ${i === 0 ? 'first' : ''}">${i + 1}</span>${avatar(p)}<span class="nm">${esc(p.name)}${h ? `<br><span class="sub mute">${esc(h.word)}</span>` : ''}</span><span class="delta num">${h && h.pts ? '+' + h.pts : ''}</span><b class="num">${p.score}</b></li>`;
    }).join('');
    return `${top()}<div class="stack lg"><div class="stack"><p class="mute">จบรอบที่ ${S.round}</p><h1>${head}</h1></div><section class="stack"><h2>คะแนนรวม</h2><ul class="plist">${rows}</ul></section>
      ${host ? `<div class="stack"><button class="btn primary block" data-act="start">${ico('play')}เล่นรอบต่อไป</button><button class="btn ghost block" data-act="tolobby">ตั้งค่า / รอเพื่อนเพิ่ม</button></div>` : '<p class="hint">รอโฮสต์เริ่มรอบใหม่</p>'}</div>`;
  }

  function render() {
    let html;
    if (!sess) html = home();
    else if (!S) html = '<p class="mute">กำลังเข้าห้อง…</p>';
    else html = S.status === 'lobby' ? lobby() : S.status === 'over' ? over() : S.game === 'head' ? headGame() : forbGame();
    let cls = '';
    if (S && S.status === 'playing' && S.round !== lastRound) { lastRound = S.round; cls = 'fresh'; }
    html = `<div class="${cls}">${html}</div>`;
    if (html === last) return;
    last = html; fired = false;
    const a = document.activeElement, id = a && a.id, val = a && a.value, pos = a && a.selectionStart;
    $('#app').innerHTML = html;
    if (id) { const n = document.getElementById(id); if (n) { n.value = val; n.focus(); try { n.setSelectionRange(pos, pos); } catch {} } }
    tick();
  }
  function tick() {
    document.querySelectorAll('[data-end]').forEach((el) => {
      const ms = Date.parse(el.dataset.end) - (Date.now() + offset), s = Math.max(0, Math.ceil(ms / 1000));
      el.querySelector('[data-t]').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      if (ms <= 0 && !fired) { fired = true; refresh(); }
    });
  }

  /* ---------- actions ---------- */
  const nameVal = () => { const n = $('#name').value.trim(); sv('mg.name', n); return n; };
  const patch = (game, s) => act('mg_settings', { p_game: game || S.game, p_settings: { ...S.settings, ...s } });
  const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const A = {
    pickgame(t) { homeGame = t.dataset.v; t.parentNode.querySelectorAll('.opt').forEach((b) => b.setAttribute('aria-pressed', b === t)); },
    async create() {
      try { enter(await rpcOpen('mg_create', { p_name: nameVal(), p_game: homeGame })); } catch (e) { say(e.message); }
    },
    async join() {
      try { enter(await rpcOpen('mg_join', { p_room: $('#code').value, p_name: nameVal() })); } catch (e) { say(e.message); }
    },
    async share() {
      const url = location.origin + location.pathname + '?room=' + S.room;
      try { if (navigator.share) await navigator.share({ title: 'เกมวงเพื่อน', text: 'มาเล่นด้วยกัน รหัสห้อง ' + S.room, url }); else { await navigator.clipboard.writeText(url); say('คัดลอกลิงก์แล้ว'); } }
      catch { try { await navigator.clipboard.writeText(url); say('คัดลอกลิงก์แล้ว'); } catch { say(url); } }
    },
    async leave() { if (!confirm('ออกจากห้องนี้?')) return; try { await call('mg_leave'); ping(); } catch {} leaveLocal(); },
    game(t) { patch(t.dataset.v, {}); },
    mode(t) { patch(null, { mode: t.dataset.v }); },
    lvl(t) { const l = toggle(S.settings.levels, +t.dataset.v); if (l.length) patch(null, { levels: l }); },
    cat(t) { patch(null, { cats: toggle(S.settings.cats, t.dataset.v) }); },
    mins(t) { patch(null, { minutes: +t.dataset.v }); },
    reveal() { patch(null, { reveal: !S.settings.reveal }); },
    start() { act('mg_start'); }, end() { act('mg_end'); }, tolobby() { act('mg_lobby'); },
    accuse(t) { act('mg_accuse', { p_target: t.dataset.id }); },
    vote(t) { act('mg_vote', { p_claim: +t.dataset.id, p_yes: t.dataset.v === '1' }); },
    async guess() {
      const i = $('#guess'); if (!i || !i.value.trim()) return;
      try { const ok = await call('mg_guess', { p_guess: i.value }); i.value = ''; say(ok ? 'ถูกต้อง!' : 'ยังไม่ใช่ ลองถามเพื่อนเพิ่ม'); ping(); await refresh(); } catch (e) { say(e.message); }
    },
    giveup() { if (confirm('ยอมแพ้และดูเฉลย?')) act('mg_giveup'); },
  };
  async function rpcOpen(fn, args) { const { data, error } = await sb.rpc(fn, args); if (error) throw new Error(error.message); return data; }

  document.addEventListener('click', (e) => { const t = e.target.closest('[data-act]'); if (t && !t.disabled && A[t.dataset.act]) A[t.dataset.act](t); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'guess') A.guess();
    else if (e.target.id === 'code') A.join();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (sess && !document.hidden) refresh(); }, 3000);
  setInterval(tick, 500);

  const q = inviteCode();
  if (q && sess && sess.room !== q) { sess = null; sv('mg.sess', null); }
  if (sess) enter(sess); else render();
})();
