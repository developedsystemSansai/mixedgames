(() => {
  const CFG = window.MG_CONFIG, FX = window.FX;
  const sb = supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ld = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const sv = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const ig = (n, c = '') => `<img class="gi ${c}" src="assets/game/${n}.webp" alt="" decoding="async" draggable="false">`;
  const pp = (cls, i) => `class="${cls} pop" style="--i:${i}"`;
  // รูปประกอบคำ: ใช้ Twemoji (SVG) ถ้าโหลดไม่ได้จะถอยกลับไปใช้ตัวอีโมจิ
  const twCode = (e) => { const c = [...e].map((x) => x.codePointAt(0).toString(16)); return (c.includes('200d') ? c : c.filter((x) => x !== 'fe0f')).join('-'); };
  const pic = (e, cls = '') => (e ? `<span class="pic ${cls}" data-e="${esc(e)}"><img src="https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${twCode(e)}.svg" alt="" decoding="async" draggable="false" onerror="this.parentNode.classList.add('err');this.remove()"></span>` : '');
  const eff = (st, g) => (g === 'head' ? st.mode : st.mode === 'cat' ? 'cat' : 'all');

  const GAMES = {
    head: { name: 'อะไรอยู่หัวกู', icon: 'question', rule: 'เห็นคำของเพื่อนทุกคน ยกเว้นของตัวเอง ถามใช่/ไม่ใช่แล้วทายให้ได้ก่อน' },
    solo: { name: 'อะไรอยู่หัวกู · 1 คนทาย', icon: 'players', rule: 'ทายทีละคน คนอื่นเห็นคำพร้อมรูป แล้วช่วยตอบ ใช่/ไม่ใช่' },
    forbidden: { name: 'คำต้องห้าม', icon: 'no-talking', rule: 'ทุกคนได้คำง่ายๆ จากหมวดเดียวกัน ห้ามพูดคำของตัวเอง ชวนคุยให้เพื่อนหลุด' },
  };
  const LV = ['ง่ายมาก', 'ง่าย', 'ปานกลาง', 'ยาก', 'ยากมาก'];
  const MODES = { all: 'สุ่มทุกหมวด', cat: 'เลือกหมวด', chaos: 'Chaos' };
  const MODES2 = { all: 'สุ่มหมวดทุกรอบ', cat: 'เลือกหมวด' };
  const TIMES = [0, 3, 5, 10, 15, 20, 30];
  const TAGS = { y: ['check', 'ใช่'], n: ['wrong', 'ไม่ใช่'], h: ['chat-bubbles', 'คำใบ้'], q: ['question', 'สงสัย'] };
  const ERR = {
    unauthorized: 'หมดเวลาเชื่อมต่อ ลองเข้าห้องใหม่', room_not_found: 'ไม่พบห้องนี้ เช็กรหัสอีกที', in_progress: 'ห้องนี้กำลังเล่นอยู่ รอจบรอบก่อน',
    room_full: 'ห้องเต็มแล้ว (สูงสุด 10 คน)', name_taken: 'มีคนใช้ชื่อนี้ในห้องแล้ว', name_required: 'ใส่ชื่อก่อนนะ', need_players: 'ต้องมีอย่างน้อย 2 คน',
    few_words: 'คำในหมวดที่เลือกไม่พอ ลองเลือกหมวดเพิ่มหรือสุ่มทุกหมวด', host_only: 'เฉพาะโฮสต์เท่านั้น', already_open: 'มีคนจับคนนี้อยู่แล้ว', bad_state: 'ทำรายการนี้ไม่ได้ในตอนนี้', busy: 'ระบบยุ่งอยู่ ลองอีกครั้ง',
  };
  const P = {
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', crown: '<path d="M4 18h16M5 18L3.5 8l5 4L12 5l3.5 7 5-4L19 18"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>', out: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    play: '<path d="M8 5l11 7-11 7z"/>', trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    note: '<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M9 9h6M9 13h4"/><path d="M15.5 17.5l5-5 1.5 1.5-5 5-2 .5z"/>',
  };
  const ico = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

  let sess = null, S = null, ch = null, offset = 0, busy = false, homeGame = 'head', viewKey = '', enterNext = false, last = '', fired = false, tt, quiet = false, lastTick = -1;
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
    try {
      const d = await call('mg_state'); offset = Date.parse(d.now) - Date.now();
      const prev = S; S = d; events(prev, d); notesSync(); render();
    } catch (e) { if (e.message === 'unauthorized') { say('ห้องนี้ปิดไปแล้ว หรือคุณถูกลบออกจากห้อง'); leaveLocal(); } }
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
    sess = null; S = null; sv('mg.sess', null);
    if (ch) { sb.removeChannel(ch); ch = null; }
    history.replaceState(null, '', location.pathname); notesSync(); render();
  }

  /* ---------- เอฟเฟกต์จากการเปลี่ยนสถานะ ---------- */
  function events(p, n) {
    if (!p || p.room !== n.room) return;
    const me = n.me, hand = (s, id) => s.hands.find((h) => h.player === id), nm = (id) => (n.players.find((x) => x.id === id) || { name: '?' }).name;
    if (p.status === 'lobby' && n.status === 'lobby' && n.players.length > p.players.length) {
      const old = new Set(p.players.map((x) => x.id));
      n.players.filter((x) => !old.has(x.id)).forEach((x) => FX.banner(`${x.name} เข้าห้องแล้ว`, 'players')); FX.play('pop');
    }
    if (n.status === 'playing' && (p.status !== 'playing' || p.round !== n.round)) {
      FX.splash({ icon: 'mystery-cards', title: `รอบที่ ${n.round}`, sub: n.game === 'solo' ? `${nm(n.guesser)} เป็นผู้ทายรอบนี้` : GAMES[n.game].name, ms: 1400 }); FX.play('start'); FX.vib(30); return;
    }
    if (n.status === 'over' && p.status === 'playing') return finale(n);
    if (n.status !== 'playing' || p.round !== n.round) return;
    for (const h of n.hands) {
      const o = hand(p, h.player); if (!o || o.state === h.state) continue;
      const mine = h.player === me;
      if (h.state === 'solved') {
        if (mine) { FX.play('correct'); FX.burst(innerWidth / 2, innerHeight * 0.38, 100); FX.flash('gold'); FX.floaty(`+${h.pts}`); FX.vib([30, 30, 80]); }
        else if (n.game === 'solo') { FX.banner(`${nm(h.player)} ทายถูกแล้ว! ทุกคนได้ +1`, 'check'); FX.play('correct'); FX.burst(innerWidth / 2, innerHeight * 0.38, 60); FX.floaty('+1'); }
        else { FX.banner(`${nm(h.player)} ทายถูกแล้ว! อันดับ ${h.rank}`, 'check'); FX.play('pop'); }
      } else if (h.state === 'gaveup') {
        quiet = false; if (mine) FX.play('lose'); else { FX.banner(`${nm(h.player)} ยอมแพ้`, 'mascot-cry'); FX.play('vote'); }
      } else if (h.state === 'out') {
        if (mine) caught(); else { FX.banner(`${nm(h.player)} หลุดแล้ว!`, 'wrong'); FX.play('buzz'); FX.shake(); }
      }
    }
    const seen = new Set(p.claims.map((c) => c.id));
    for (const c of n.claims) if (!seen.has(c.id)) claimed(c, nm);
    for (const c of p.claims) if (!n.claims.some((x) => x.id === c.id)) { const t = hand(n, c.target); if (t && t.state === 'active') { FX.banner('โหวตไม่ผ่าน รอดไปก่อน!', 'check'); FX.play('correct'); } }
  }
  function caught() {
    if (quiet) { quiet = false; FX.banner('คุณออกจากรอบแล้ว', 'mascot-cry'); return; }
    FX.flash('red'); FX.shake(); FX.play('buzz'); FX.vib([90, 50, 90]);
    FX.splash({ icon: 'mascot-cry', title: 'โดนจับได้!', sub: 'คุณเผลอพูดคำต้องห้าม', bad: true, ms: 1700 });
  }
  function claimed(c, nm) {
    if (c.target === S?.me || c.target === sess?.player) { FX.flash('red'); FX.shake(); FX.play('buzz'); FX.vib([60, 40, 60]); FX.banner(`${nm(c.accuser)} จับคุณว่าพูดคำต้องห้าม!`, 'buzzer'); }
    else if (c.accuser !== (S && S.me)) { FX.play('buzz'); FX.banner(`${nm(c.accuser)} จับ ${nm(c.target)}! ช่วยโหวตหน่อย`, 'buzzer'); }
  }
  const winners = (n) => (n.game === 'head' ? n.hands.filter((h) => h.rank === 1).map((h) => h.player)
    : n.game === 'solo' ? (n.hands.some((h) => h.state === 'solved') ? n.players.map((p) => p.id) : [])
    : n.hands.filter((h) => h.state === 'active').map((h) => h.player));
  function finale(n) {
    const wins = winners(n);
    const mine = n.hands.find((h) => h.player === n.me) || {};
    if (wins.includes(n.me)) { FX.play('win'); FX.cannons(); FX.rain(2600); FX.flash('gold'); FX.vib([40, 40, 140]); }
    else if (mine.state === 'solved') { FX.play('correct'); FX.burst(); }
    else FX.play('lose');
  }

  /* ---------- views ---------- */
  const avatar = (p) => `<span class="av" style="--h:${(p.hue * 37 + 12) % 360}" aria-hidden="true">${esc((p.name.match(/[ก-ฮA-Za-z0-9]/) || [[...p.name][0]])[0])}</span>`;
  const H = (id) => S.hands.find((h) => h.player === id);
  const PL = (id) => S.players.find((p) => p.id === id) || { name: '?', hue: 0 };
  const top = (mid = '') => `<div class="top"><span class="roomcode" aria-label="รหัสห้อง ${S.room}">${S.room}</span>${mid}<button class="btn ghost sm" data-act="leave">${ico('out')}ออก</button></div>`;
  const timer = () => (S.ends_at
    ? `<div class="timerwrap"><span class="timer num" data-end="${S.ends_at}" data-total="${(S.settings.minutes || 0) * 60000}">${ig('timer')}<span data-t></span></span><div class="bar"><i data-bar></i></div></div>`
    : `<span class="mute">รอบที่ ${S.round}</span>`);
  const ticket = (cls, lbl, word, sub, q, badge) => `<div class="ticket ${cls}">${badge ? ig(badge, 'badge') : ''}<span class="lbl">${lbl}</span><span class="word${q ? ' q' : ''}">${esc(word)}</span>${sub ? `<span class="sub mute">${sub}</span>` : ''}</div>`;

  function home() {
    const q = inviteCode(), name = esc(ld('mg.name') || '');
    const invite = q ? `<div ${pp('say', 1)}>${ig('mascot-wave')}<p>เพื่อนชวนเข้าห้อง <b>${q}</b> ใส่ชื่อแล้วกดเข้าห้องได้เลย</p></div>` : '';
    const join = `<section ${pp('panel', 3)}><h2>${ig('players', 'sm')}เข้าห้องของเพื่อน</h2><label class="field">รหัสห้อง 4 ตัว<input id="code" class="code-in" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="ABCD" value="${esc(q)}"></label><button class="btn ${q ? 'primary' : ''} block" data-act="join">${ico('play')}เข้าห้อง</button></section>`;
    const create = `<section ${pp('panel', q ? 4 : 3)}><h2>${ig('mystery-cards', 'sm')}เปิดห้องใหม่</h2><div class="seg list" role="group" aria-label="เลือกเกม">${Object.entries(GAMES).map(([k, g]) => `<button class="opt" data-act="pickgame" data-v="${k}" aria-pressed="${k === homeGame}">${ig(g.icon)}<b>${g.name}</b><small>${g.rule}</small></button>`).join('')}</div><button class="btn ${q ? '' : 'primary'} block" data-act="create">สร้างห้อง</button></section>`;
    return `<div class="stack lg"><section ${pp('hero', 0)}>${ig('mascot-wave', 'bob')}<div><h1 class="sr">Let me ทาย</h1><p class="lead">ทายคำกับเพื่อน 2–10 คน ใช้มือถือของตัวเอง ไม่ต้องสมัครสมาชิก</p></div></section>${invite}
      <section ${pp('panel', 2)}><label class="field">ชื่อที่ใช้ในเกม<input id="name" maxlength="16" autocomplete="off" placeholder="เช่น บี" value="${name}"></label></section>${q ? join + create : create + join}</div>`;
  }

  function lobby() {
    const host = S.host === S.me, st = S.settings, g = S.game, n = S.players.length, md = eff(st, g);
    const list = `<ul class="plist">${S.players.map((p) => `<li class="${p.online ? '' : 'off'}">${avatar(p)}<span class="nm">${esc(p.name)}${p.id === S.me ? ' <span class="mute">(คุณ)</span>' : ''}</span>${p.id === S.host ? `<span class="crown" title="โฮสต์">${ico('crown')}</span>` : ''}${S.round ? `<span class="num mute">${p.score} แต้ม</span>` : ''}</li>`).join('')}</ul>`;
    const chips = (arr, fn) => `<div class="chips">${arr.map(fn).join('')}</div>`;
    const settings = host ? `<section ${pp('panel', 3)}><h2>${ig('mystery-cards', 'sm')}ตั้งค่าเกม</h2>
      <div class="seg list" role="group" aria-label="เกม">${Object.entries(GAMES).map(([k, x]) => `<button class="opt" data-act="game" data-v="${k}" aria-pressed="${k === g}">${ig(x.icon)}<b>${x.name}</b><small>${x.rule}</small></button>`).join('')}</div>
      <div class="seg ${g === 'head' ? 'three' : 'two'}" role="group" aria-label="โหมดสุ่มคำ">${Object.entries(g === 'head' ? MODES : MODES2).map(([k, t]) => `<button class="chip" data-act="mode" data-v="${k}" aria-pressed="${md === k}">${t}</button>`).join('')}</div>
      ${g === 'forbidden' ? '<p class="hint">คำง่ายๆ ที่ใช้ในชีวิตประจำวัน · แต่ละรอบทุกคนได้คำจากหมวดเดียวกัน</p>' : g === 'solo' ? '<p class="hint">ใช้คำที่มีรูปประกอบ · ผู้ทายหมุนเวียนทีละคน คนอื่นเห็นคำและรูปแล้วช่วยตอบ ใช่/ไม่ใช่ (ผู้ทายได้ 3 แต้ม ผู้ช่วยคนละ 1 แต้ม)</p>' : md === 'chaos' ? '<p class="hint">Chaos: สุ่มเฉพาะคำยากมากและคำกวนประสาท</p>' : chips(LV, (t, i) => `<button class="chip" data-act="lvl" data-v="${i + 1}" aria-pressed="${st.levels.includes(i + 1)}">${t}</button>`)}
      ${md === 'cat' ? chips(S.cats || [], (c) => `<button class="chip" data-act="cat" data-v="${esc(c)}" aria-pressed="${st.cats.includes(c)}">${esc(c)}</button>`) : ''}
      <hr class="divider"><h2>${ig('timer', 'sm')}เวลาในการทาย <span class="hint">(สูงสุด 30 นาที)</span></h2>
      ${chips(TIMES, (m) => `<button class="chip" data-act="mins" data-v="${m}" aria-pressed="${st.minutes === m}">${m ? m + ' นาที' : 'ไม่จำกัด'}</button>`)}
      ${g === 'forbidden' ? `<button class="chip" data-act="reveal" aria-pressed="${st.reveal}">เห็นคำของคนอื่น (ไว้หลอกล่อ)</button>` : ''}</section>`
      : `<section ${pp('panel', 3)}><h2>${ig(GAMES[g].icon, 'sm')}${GAMES[g].name}</h2><p class="mute">${GAMES[g].rule}</p><p class="hint">โหมด ${(g === 'head' ? MODES : MODES2)[md]} · ${st.minutes ? st.minutes + ' นาที' : 'ไม่จำกัดเวลา'}</p></section>`;
    const wait = !host ? `<div ${pp('say', 4)}>${ig('mascot-wave')}<p>รอโฮสต์กดเริ่มเกมนะ</p></div>` : n < 2 ? `<div ${pp('say', 4)}>${ig('mascot-wave')}<p>ชวนเพื่อนอีกอย่างน้อย 1 คนก่อนเริ่ม (สนุกสุด 5–10 คน)</p></div>` : '';
    return `${top()}<div class="stack lg">
      <div ${pp('stack', 0)}><div class="codebox" aria-label="รหัสห้อง">${ig('ticket')}<b>${S.room}</b></div>
      <button class="btn sun block" data-act="share">${ico('link')}คัดลอกลิงก์เชิญเพื่อน</button></div>
      <section ${pp('panel', 1)}><div class="row between"><h2>ผู้เล่น</h2><span class="count num">${ig('players')}${n}/10</span></div>${list}</section>${settings}${wait}
      ${host ? `<button ${pp('btn primary block' + (n >= 2 ? ' breathe' : ''), 5)} data-act="start" ${n < 2 ? 'disabled' : ''}>${ico('play')}${S.round ? 'เริ่มรอบใหม่' : 'เริ่มเกม'}</button>` : ''}</div>`;
  }

  const hostEnd = () => (S.host === S.me ? `<button class="btn ghost block" data-act="end">จบรอบนี้</button>` : '');

  const guessBox = () => `<div class="stack"><div class="guessrow"><label class="field"><span class="sub mute">ทายเลย</span><input id="guess" maxlength="60" autocomplete="off" placeholder="คิดว่าเป็นอะไร?"></label><button class="btn primary" data-act="guess" aria-label="ส่งคำทาย">${ico('send')}</button></div><button class="btn ghost" data-act="giveup">ยอมแพ้ ขอดูเฉลย</button></div>`;

  function headGame() {
    const me = H(S.me) || {};
    let mine;
    if (me.state === 'solved') mine = ticket('mine win', 'ทายถูกแล้ว', me.word, `อันดับ ${me.rank} · +${me.pts} แต้ม`, false, 'check');
    else if (me.state === 'gaveup') mine = ticket('mine dead', 'คุณยอมแพ้', me.word, 'คำบนหัวคุณคือคำนี้', false, 'wrong');
    else mine = ticket('mine', 'คำบนหัวของคุณ', '?', 'ถามเพื่อนใช่/ไม่ใช่ แล้วพิมพ์ทาย', true, 'question');
    const guess = me.state === 'active' ? guessBox() : '';
    const others = S.players.filter((p) => p.id !== S.me).map((p, i) => {
      const h = H(p.id) || {}, done = h.state && h.state !== 'active';
      return `<li ${pp('hand', i)}>${avatar(p)}<span class="who"><b>${esc(p.name)}</b>${h.state === 'solved' ? `<span class="tag good">ทายถูก อันดับ ${h.rank}</span>` : h.state === 'gaveup' ? '<span class="tag bad">ยอมแพ้</span>' : '<span class="sub mute">ยังทายอยู่</span>'}</span><span class="stub ${done ? 'dim' : ''}">${pic(h.emoji, 'sm')}${esc(h.word)}</span></li>`;
    }).join('');
    return `${top(timer())}<div class="stack lg"><div class="pop" style="--i:0">${mine}</div><div class="pop" style="--i:1">${guess}</div><section class="stack pop" style="--i:2"><h2>คำบนหัวเพื่อน</h2><ul class="plist">${others}</ul></section>${hostEnd()}</div>`;
  }


  function soloGame() {
    const g = S.guesser, gh = H(g) || {}, imG = g === S.me, gp = PL(g), done = gh.state && gh.state !== 'active';
    const card = (cls, lbl, sub, badge) => `<div class="ticket solo ${cls}">${badge ? ig(badge, 'badge') : ''}<span class="lbl">${lbl}</span>${gh.emoji ? pic(gh.emoji, 'xl') : '<span class="pic xl q">?</span>'}<span class="word${gh.word ? '' : ' q'}">${esc(gh.word || '?')}</span>${sub ? `<span class="sub mute">${sub}</span>` : ''}</div>`;
    let main;
    if (gh.state === 'solved') main = card('win', imG ? 'คุณทายถูกแล้ว!' : `${esc(gp.name)} ทายถูกแล้ว!`, `ผู้ทายได้ +${gh.pts} แต้ม · ผู้ช่วยได้ +1`, 'check');
    else if (gh.state === 'gaveup') main = card('dead', imG ? 'คุณยอมแพ้' : `${esc(gp.name)} ยอมแพ้`, 'เฉลยคือคำนี้', 'wrong');
    else if (imG) main = card('mine', 'คุณคือผู้ทายรอบนี้', 'ถามเพื่อนใช่/ไม่ใช่ เพื่อนเห็นคำและรูปบนจอของตัวเอง แล้วพิมพ์ทาย', 'question');
    else main = card('', `คำบนหัวของ ${esc(gp.name)}`, 'ตอบได้แค่ ใช่ / ไม่ใช่ เท่านั้น ห้ามบอกตรงๆ นะ', 'no-talking');
    const cat = !imG && S.category && !done ? `<div class="catpill pop" style="--i:0">หมวดรอบนี้ <b>${esc(S.category)}</b></div>` : '';
    const guess = imG && gh.state === 'active' ? guessBox() : '';
    const crew = S.players.filter((p) => p.id !== g).map((p, i) => `<li ${pp('hand', i)}>${avatar(p)}<span class="who"><b>${esc(p.name)}${p.id === S.me ? ' <span class="mute">(คุณ)</span>' : ''}</b><span class="sub mute">ผู้ช่วยตอบ ใช่ / ไม่ใช่</span></span></li>`).join('');
    const who = `<div class="turn pop" style="--i:0">${avatar(gp)}<span>${imG ? 'ตาคุณทายแล้ว!' : `<b>${esc(gp.name)}</b> กำลังทาย`}</span></div>`;
    return `${top(timer())}<div class="stack lg">${who}${cat}<div class="pop" style="--i:1">${main}</div><div class="pop" style="--i:2">${guess}</div><section class="stack pop" style="--i:3"><h2>${imG ? 'เพื่อนที่ช่วยตอบ' : 'ผู้ช่วย'}</h2><ul class="plist">${crew}</ul></section>${hostEnd()}</div>`;
  }

  function forbGame() {
    const me = H(S.me) || {}, out = me.state === 'out';
    const mine = out ? ticket('mine dead', 'คุณหลุดแล้ว', me.word, 'ยังช่วยโหวตจับเพื่อนได้', false, 'wrong') : ticket('mine', 'คำต้องห้ามของคุณ · ห้ามพูด', me.word, 'คุยตามปกติ แต่อย่าเผลอพูดคำนี้', false, 'no-talking');
    const cat = S.category ? `<div class="catpill pop" style="--i:0">หมวดรอบนี้ <b>${esc(S.category)}</b> · ทุกคนได้คำในหมวดเดียวกัน</div>` : '';
    const open = new Set(S.claims.map((c) => c.target));
    const claims = S.claims.map((c) => {
      const self = c.target === S.me, v = c.mine;
      const btns = self ? `<button class="btn sm" data-act="vote" data-id="${c.id}" data-v="1">ยอมรับว่าพูดแล้ว</button>`
        : `<button class="btn sm ${v === true ? 'mint' : ''}" data-act="vote" data-id="${c.id}" data-v="1">${ig('check')}ได้ยินจริง</button><button class="btn sm ${v === false ? 'sun' : ''}" data-act="vote" data-id="${c.id}" data-v="0">${ig('wrong')}ไม่ใช่</button>`;
      return `<div class="claim">${'<p>'}${ig('buzzer')}<span><b>${esc(PL(c.accuser).name)}</b> จับ <b>${self ? 'คุณ' : esc(PL(c.target).name)}</b> ว่าพูดคำว่า</span> <span class="stub">${esc(c.word)}</span></p><div class="row between wrap"><span class="sub mute num">เห็นด้วย ${c.yes} · ไม่ใช่ ${c.no}</span><div class="row">${btns}</div></div></div>`;
    }).join('');
    const others = S.players.filter((p) => p.id !== S.me).map((p, i) => {
      const h = H(p.id) || {}, alive = h.state === 'active';
      return `<li ${pp('hand', i)}>${avatar(p)}<span class="who"><b>${esc(p.name)}</b><span class="tag ${alive ? 'good' : 'bad'}" style="justify-self:start">${alive ? 'ยังอยู่' : 'หลุดแล้ว'}</span></span>
        <span class="row" style="flex-direction:column;align-items:flex-end;gap:8px">${h.word ? `<span class="stub ${alive ? '' : 'dim'}">${esc(h.word)}</span>` : '<span class="stub dim">ซ่อนไว้</span>'}${alive && !open.has(p.id) ? `<button class="btn sm primary" data-act="accuse" data-id="${p.id}">${ig('buzzer')}จับได้!</button>` : ''}</span></li>`;
    }).join('');
    return `${top(timer())}<div class="stack lg">${cat}<div class="pop" style="--i:0">${mine}</div>${claims ? `<section class="stack"><h2>รอโหวต</h2>${claims}</section>` : ''}<section class="stack pop" style="--i:2"><h2>เพื่อนในวง</h2><ul class="plist">${others}</ul></section>${hostEnd()}</div>`;
  }

  function over() {
    const host = S.host === S.me, hands = S.hands, mine = H(S.me) || {};
    const wins = winners(S);
    const gh = S.game === 'solo' ? H(S.guesser) || {} : null;
    let head;
    if (S.game === 'solo') head = gh.state === 'solved' ? `${esc(PL(S.guesser).name)} ทายถูก! ทั้งทีมได้แต้ม` : `${esc(PL(S.guesser).name)} ทายไม่ออก`;
    else if (S.game === 'head') head = wins.length ? `${esc(PL(wins[0]).name)} ทายถูกก่อน` : 'ไม่มีใครทายถูกเลย';
    else head = wins.length === 1 ? `${esc(PL(wins[0]).name)} รอดคนสุดท้าย` : wins.length ? `${wins.length} คนรอดจนหมดเวลา` : 'ไม่มีใครรอด';
    const iWon = wins.includes(S.me), lost = mine.state === 'out' || mine.state === 'gaveup';
    const mood = iWon ? `<img class="gi cel" src="assets/game/mascot-celebration.gif" alt="" decoding="async">` : ig(lost ? 'mascot-cry' : wins.length ? 'mascot-shock' : 'mascot-wave', 'big');
    const rows = [...S.players].sort((a, b) => b.score - a.score).map((p, i) => {
      const h = H(p.id), from = p.score - (h ? h.pts : 0);
      return `<li ${pp(i === 0 ? 'first' : '', i + 2)}><span class="rank num ${i === 0 ? 'first' : ''}">${i + 1}</span>${avatar(p)}<span class="nm">${esc(p.name)}${h ? `<br><span class="sub mute">${S.game === 'solo' ? (p.id === S.guesser ? 'ผู้ทาย' : 'ผู้ช่วย') : esc(h.word)}</span>` : ''}</span><span class="delta num">${h && h.pts ? '+' + h.pts : ''}</span><b class="num" data-count data-from="${from}" data-to="${p.score}">${p.score}</b>${i === 0 && p.score > 0 ? ig('trophy') : ''}</li>`;
    }).join('');
    return `${top()}<div class="stack lg"><div class="winhero pop" style="--i:0">${iWon ? ig('trophy', 'tro') : ''}${mood}<p class="mute">จบรอบที่ ${S.round}</p><h1>${head}</h1>${gh && gh.word ? `<div class="revealpic">${pic(gh.emoji, 'xl')}<span class="stub">${esc(gh.word)}</span></div>` : ''}</div>
      <section class="stack pop" style="--i:1"><h2>คะแนนรวม</h2><ul class="plist">${rows}</ul></section>
      ${host ? `<div class="stack pop" style="--i:6"><button class="btn primary block" data-act="start">${ico('play')}เล่นรอบต่อไป</button><button class="btn ghost block" data-act="tolobby">ตั้งค่า / รอเพื่อนเพิ่ม</button></div>` : `<div ${pp('say', 6)}>${ig('mascot-wave')}<p>รอโฮสต์เริ่มรอบใหม่</p></div>`}</div>`;
  }

  function render() {
    let html;
    if (!sess) html = home();
    else if (!S) html = `<div class="say pop">${ig('mascot-wave', 'bob')}<p>กำลังเข้าห้อง…</p></div>`;
    else html = S.status === 'lobby' ? lobby() : S.status === 'over' ? over() : S.game === 'head' ? headGame() : S.game === 'solo' ? soloGame() : forbGame();
    const key = !sess ? 'home' : !S ? 'load' : S.status + ':' + S.round + ':' + S.game;
    if (key !== viewKey) { viewKey = key; enterNext = true; }
    document.body.classList.toggle('in-room', !!(sess && S));
    html = `<div>${html}</div>`;
    if (html === last) return;
    last = html; fired = false;
    const a = document.activeElement, id = a && a.id, val = a && a.value, pos = a && a.selectionStart;
    const app = $('#app'); app.innerHTML = html;
    if (enterNext) { app.firstElementChild.classList.add('enter'); enterNext = false; countUps(); }
    if (id) { const n = document.getElementById(id); if (n) { n.value = val; n.focus(); try { n.setSelectionRange(pos, pos); } catch {} } }
    tick();
  }
  function tick() {
    document.querySelectorAll('[data-end]').forEach((el) => {
      const ms = Date.parse(el.dataset.end) - (Date.now() + offset), s = Math.max(0, Math.ceil(ms / 1000)), tot = +el.dataset.total || 0;
      el.querySelector('[data-t]').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      const bar = document.querySelector('[data-bar]');
      if (bar && tot) { const p = Math.max(0, Math.min(100, (ms / tot) * 100)); bar.style.setProperty('--p', p + '%'); bar.style.setProperty('--bc', p > 50 ? 'var(--mint)' : p > 20 ? 'var(--sun)' : 'var(--chili)'); }
      const hurry = s > 0 && s <= 10; el.classList.toggle('hurry', hurry);
      if (hurry && s !== lastTick) { lastTick = s; FX.play('tick'); }
      if (ms <= 0 && !fired) { fired = true; refresh(); }
    });
  }
  function countUps() {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const from = +el.dataset.from, to = +el.dataset.to; if (from === to || FX.reduce) return;
      el.textContent = from; const t0 = performance.now() + 700, dur = 900;
      const step = (t) => { const k = Math.max(0, Math.min(1, (t - t0) / dur)); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }

  /* ---------- สมุดจดคำใบ้ (เก็บในเครื่อง แยกตามห้อง/รอบ) ---------- */
  const N = { open: false, who: '', tag: 'y', items: [], key: '', sig: '' };
  const notesKey = () => (S ? `mg.notes.${S.room}.${S.round}` : '');
  function notesSync() {
    const root = $('#notes-root'), on = !!(S && S.status === 'playing');
    if (!on) { if (N.open || root.innerHTML) { N.open = false; N.key = ''; N.items = []; root.innerHTML = ''; document.body.style.overflow = ''; } return; }
    const k = notesKey();
    if (N.key !== k) {
      N.key = k; N.who = ''; try { N.items = JSON.parse(ld(k) || '[]'); } catch { N.items = []; }
      try { Object.keys(localStorage).filter((x) => x.startsWith('mg.notes.') && x !== k).forEach((x) => localStorage.removeItem(x)); } catch {}
      N.open = false; root.innerHTML = '';
    }
    if (!root.innerHTML) notesShell();
    const sig = S.players.map((p) => p.id + p.name).join('|');
    if (N.open && sig !== N.sig) noteWho();
    N.sig = sig; noteBadge();
  }
  const noteSave = () => sv(N.key, JSON.stringify(N.items));
  function notesShell() {
    const root = $('#notes-root');
    if (!N.open) { root.innerHTML = `<button class="fab" data-act="noteopen" aria-label="เปิดสมุดจดคำใบ้"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P.note}</svg><em id="nbadge" hidden></em></button>`; noteBadge(); return; }
    root.innerHTML = `<div class="veil" data-act="noteclose"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="สมุดจดคำใบ้">
      <div class="sh-head"><h2 class="row">${ig('chat-bubbles')}สมุดจดคำใบ้</h2><div class="row"><button class="btn sm ghost" data-act="noteclear" aria-label="ล้างโน้ตทั้งหมด">${ico('trash')}</button><button class="btn sm" data-act="noteclose" aria-label="ปิดสมุด">${ico('x')}</button></div></div>
      <div class="chips" id="nwho" role="group" aria-label="คำใบ้ของใคร"></div>
      <div class="chips" id="ntag" role="group" aria-label="ประเภทโน้ต"></div>
      <div class="row"><input id="ntext" maxlength="80" autocomplete="off" placeholder="จดคำใบ้ เช่น เป็นสัตว์ / กินได้"><button class="btn sun" data-act="noteadd" aria-label="เพิ่มโน้ต">${ico('send')}</button></div>
      <ul class="notelist" id="nlist"></ul></section>`;
    noteWho(); noteTag(); noteList();
  }
  function noteBadge() { const b = $('#nbadge'); if (b) { b.hidden = !N.items.length; b.textContent = N.items.length; } }
  function noteWho() {
    const el = $('#nwho'); if (!el) return;
    const opts = [['', 'ทั่วไป'], ...S.players.filter((p) => p.id !== S.me).map((p) => [p.id, p.name])];
    if (!opts.some((o) => o[0] === N.who)) N.who = '';
    el.innerHTML = opts.map(([id, n]) => `<button class="chip" data-act="notewho" data-id="${esc(id)}" aria-pressed="${id === N.who}">${esc(n)}</button>`).join('');
  }
  function noteTag() { const el = $('#ntag'); if (el) el.innerHTML = Object.entries(TAGS).map(([k, [i, t]]) => `<button class="chip" data-act="notetag" data-v="${k}" aria-pressed="${k === N.tag}">${ig(i)}${t}</button>`).join(''); }
  function noteList() {
    const el = $('#nlist'); if (!el) return;
    el.innerHTML = N.items.length ? N.items.map((n) => `<li class="note"><span>${ig(TAGS[n.tag][0])}</span><span><span class="who">${esc(n.who || 'ทั่วไป')} · ${TAGS[n.tag][1]}</span><br><span class="tx">${esc(n.text)}</span></span><button data-act="notedel" data-id="${n.id}" aria-label="ลบโน้ตนี้">${ico('x')}</button></li>`).join('')
      : `<li class="empty">${ig('mascot-wave')}<span>ยังไม่มีโน้ต จดคำตอบ ใช่/ไม่ใช่ ของเพื่อนไว้ช่วยทายได้เลย</span></li>`;
    noteBadge();
  }
  function noteOpen(o) { N.open = o; document.body.style.overflow = o ? 'hidden' : ''; notesShell(); if (o) setTimeout(() => { const i = $('#ntext'); i && i.focus(); }, 380); }
  function noteAdd() {
    const i = $('#ntext'), text = (i.value || '').trim(); if (!text) { i.focus(); return; }
    const who = N.who ? PL(N.who).name : '';
    N.items.unshift({ id: Date.now() + '' + Math.floor(Math.random() * 99), who, tag: N.tag, text }); N.items = N.items.slice(0, 100);
    noteSave(); noteList(); i.value = ''; i.focus(); FX.play('pop');
  }

  /* ---------- actions ---------- */
  const nameVal = () => { const n = $('#name').value.trim(); sv('mg.name', n); return n; };
  const patch = (game, s) => act('mg_settings', { p_game: game || S.game, p_settings: { ...S.settings, ...s } });
  const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const A = {
    pickgame(t) { homeGame = t.dataset.v; t.parentNode.querySelectorAll('.opt').forEach((b) => b.setAttribute('aria-pressed', b === t)); },
    async create() { try { enter(await rpcOpen('mg_create', { p_name: nameVal(), p_game: homeGame })); FX.play('pop'); } catch (e) { say(e.message); FX.play('wrong'); } },
    async join() { try { enter(await rpcOpen('mg_join', { p_room: $('#code').value, p_name: nameVal() })); FX.play('pop'); } catch (e) { say(e.message); FX.play('wrong'); } },
    async share() {
      const url = location.origin + location.pathname + '?room=' + S.room;
      try { if (navigator.share) await navigator.share({ title: 'Let me ทาย', text: 'มาเล่น Let me ทาย ด้วยกัน รหัสห้อง ' + S.room, url }); else { await navigator.clipboard.writeText(url); say('คัดลอกลิงก์แล้ว'); } }
      catch { try { await navigator.clipboard.writeText(url); say('คัดลอกลิงก์แล้ว'); } catch { say(url); } }
    },
    async leave() { if (!confirm('ออกจากห้องนี้?')) return; try { await call('mg_leave'); ping(); } catch {} leaveLocal(); },
    game(t) { const v = t.dataset.v; patch(v, { cats: [], mode: v !== 'head' && S.settings.mode === 'chaos' ? 'all' : S.settings.mode }); }, mode(t) { patch(null, { mode: t.dataset.v }); },
    lvl(t) { const l = toggle(S.settings.levels, +t.dataset.v); if (l.length) patch(null, { levels: l }); },
    cat(t) { patch(null, { cats: toggle(S.settings.cats, t.dataset.v) }); },
    mins(t) { patch(null, { minutes: +t.dataset.v }); }, reveal() { patch(null, { reveal: !S.settings.reveal }); },
    start() { act('mg_start'); }, end() { act('mg_end'); }, tolobby() { act('mg_lobby'); },
    accuse(t) { act('mg_accuse', { p_target: t.dataset.id }); },
    vote(t) { FX.play('vote'); act('mg_vote', { p_claim: +t.dataset.id, p_yes: t.dataset.v === '1' }); },
    async guess() {
      const i = $('#guess'); if (!i || !i.value.trim()) return;
      try {
        const ok = await call('mg_guess', { p_guess: i.value }); i.value = ''; ping();
        if (!ok) { FX.play('wrong'); FX.vib(60); FX.shake($('.guessrow')); FX.banner('ยังไม่ใช่ ถามเพื่อนเพิ่มนะ', 'mascot-shock'); }
        await refresh();
      } catch (e) { say(e.message); }
    },
    giveup() { if (confirm('ยอมแพ้และดูเฉลย?')) { quiet = true; act('mg_giveup'); } },
    noteopen() { noteOpen(true); }, noteclose() { noteOpen(false); }, noteadd: noteAdd,
    noteclear() { if (N.items.length && confirm('ล้างโน้ตทั้งหมดของรอบนี้?')) { N.items = []; noteSave(); noteList(); } },
    notewho(t) { N.who = t.dataset.id; noteWho(); }, notetag(t) { N.tag = t.dataset.v; noteTag(); },
    notedel(t) { N.items = N.items.filter((n) => n.id !== t.dataset.id); noteSave(); noteList(); },
  };
  async function rpcOpen(fn, args) { const { data, error } = await sb.rpc(fn, args); if (error) throw new Error(error.message); return data; }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (t && !t.disabled && A[t.dataset.act]) { if (!/^(guess|create|join|vote|noteadd)$/.test(t.dataset.act)) FX.play('click'); A[t.dataset.act](t); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && N.open) return noteOpen(false);
    if (e.key !== 'Enter') return;
    if (e.target.id === 'guess') A.guess(); else if (e.target.id === 'code') A.join(); else if (e.target.id === 'ntext') noteAdd();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (sess && !document.hidden) refresh(); }, 3000);
  setInterval(tick, 500);

  const q = inviteCode();
  if (q && sess && sess.room !== q) { sess = null; sv('mg.sess', null); }
  if (sess) enter(sess); else render();
})();
