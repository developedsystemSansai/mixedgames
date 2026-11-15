(() => {
  const CFG = window.MG_CONFIG, FX = window.FX;
  const sb = supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ld = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const sv = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const ig = (n, c = '') => `<img class="gi ${c}" src="assets/game/${n}.webp?v=2" alt="" decoding="async" draggable="false">`;
  const pp = (cls, i) => `class="${cls} pop" style="--i:${i}"`;
  // รูปประกอบคำ: ใช้ Twemoji (SVG) ถ้าโหลดไม่ได้จะถอยกลับไปใช้ตัวอีโมจิ
  const twCode = (e) => { const c = [...e].map((x) => x.codePointAt(0).toString(16)); return (c.includes('200d') ? c : c.filter((x) => x !== 'fe0f')).join('-'); };
  const pic = (e, cls = '') => (e ? `<span class="pic ${cls}" data-e="${esc(e)}"><img src="https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${twCode(e)}.svg" alt="" decoding="async" draggable="false" onerror="this.parentNode.classList.add('err');this.remove()"></span>` : '');
  const eff = (st, g) => (g === 'head' ? st.mode : st.mode === 'cat' ? 'cat' : 'all');

  const GAMES = {
    head: { name: 'อะไรอยู่บนหัววะ?', icon: 'question', rule: 'เห็นคำของเพื่อนทุกคน ยกเว้นของตัวเอง ถามใช่/ไม่ใช่แล้วทายให้ได้ก่อน' },
    solo: { name: 'อะไรอยู่บนหัววะ? · 1 คนทาย', icon: 'players', rule: 'ทายทีละคน เพื่อนดูคำและรูปจากจอแสดงคำ แล้วช่วยตอบ ใช่/ไม่ใช่ · มีคนเดียวก็เริ่มได้' },
    forbidden: { name: 'คำต้องห้าม', icon: 'no-talking', rule: 'ทุกคนได้คำง่ายๆ จากหมวดเดียวกัน ห้ามพูดคำของตัวเอง ชวนคุยให้เพื่อนหลุด' },
    wolf: { name: 'หมาป่า', icon: 'm-angry', rule: 'ทุกคนได้บทลับ กลางคืนหมาป่าแอบกินคน กลางวันช่วยกันโหวตหาตัวหมาป่า · 5–10 คน' },
  };
  const LV = ['ง่ายมาก', 'ง่าย', 'ปานกลาง', 'ยาก', 'ยากมาก'];
  const MODES = { all: 'สุ่มทุกหมวด', cat: 'เลือกหมวด', chaos: 'Chaos' };
  const MODES2 = { all: 'สุ่มหมวดทุกรอบ', cat: 'เลือกหมวด' };
  const TIMES = [0, 3, 5, 10, 15, 20, 30];
  const TAGS = { y: ['check', 'ใช่'], n: ['wrong', 'ไม่ใช่'], h: ['chat-bubbles', 'คำใบ้'], q: ['question', 'สงสัย'] };
  const ERR = {
    unauthorized: 'หมดเวลาเชื่อมต่อ ลองเข้าห้องใหม่', room_not_found: 'ไม่พบห้องนี้ เช็กรหัสอีกที', in_progress: 'ห้องนี้กำลังเล่นอยู่ รอจบรอบก่อน',
    room_full: 'ห้องเต็มแล้ว (สูงสุด 10 คน)', name_taken: 'มีคนใช้ชื่อนี้ในห้องแล้ว', name_required: 'ใส่ชื่อก่อนนะ', need_players: 'ต้องมีอย่างน้อย 2 คน (โหมด 1 คนทายเริ่มคนเดียวได้)',
    few_words: 'คำในหมวดที่เลือกไม่พอ ลองเลือกหมวดเพิ่มหรือสุ่มทุกหมวด', host_only: 'เฉพาะโฮสต์เท่านั้น', already_open: 'มีคนจับคนนี้อยู่แล้ว', bad_state: 'ทำรายการนี้ไม่ได้ในตอนนี้', busy: 'ระบบยุ่งอยู่ ลองอีกครั้ง',
    guess_gone: 'คำทายนี้ถูกจัดการไปแล้ว',
    need_5: 'เกมหมาป่าต้องมีอย่างน้อย 5 คน', bad_target: 'เลือกคนนี้ไม่ได้', not_allowed: 'ทำรายการนี้ไม่ได้', busy: 'ส่งเร็วเกินไป รอแป๊บนึง', empty: 'พิมพ์ข้อความก่อนนะ', already_done: 'เลือกไปแล้ว เปลี่ยนไม่ได้',
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

  let WATCH = '', sess = null, S = null, ch = null, offset = 0, busy = false, homeGame = 'head', viewKey = '', enterNext = false, last = '', fired = false, tt, quiet = false, lastTick = -1;
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
      d.guesses = d.game === 'solo' && d.status === 'playing' && d.settings.accept === true ? await call('mg_guesses').catch(() => []) : [];
      d.wolf = d.game === 'wolf' && d.status !== 'lobby' ? await call('mg_wolf_state').catch(() => null) : null;
      d.wchat = d.game === 'wolf' && d.status === 'playing' ? await call('mg_wolf_chat_list').catch(() => (S && S.room === d.room ? S.wchat : null) || []) : [];
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
      FX.countdown({ title: `รอบที่ ${n.round}`, sub: n.game === 'solo' ? `${nm(n.guesser)} เป็นผู้ทายรอบนี้` : GAMES[n.game].name }); FX.vib(30); return;
    }
    if (n.status === 'over' && p.status === 'playing') return finale(n);
    if (n.game === 'wolf') { if (n.status === 'playing' && p.round === n.round) wolfEvents(p, n); return; }
    if (n.status !== 'playing' || p.round !== n.round) return;
    for (const h of n.hands) {
      const o = hand(p, h.player); if (!o || o.state === h.state) continue;
      const mine = h.player === me;
      if (h.state === 'solved') {
        if (mine) { FX.play('correct'); FX.burst(innerWidth / 2, innerHeight * 0.38, 100); FX.flash('gold'); FX.floaty(`+${h.pts}`); FX.peek('m-jump'); FX.vib([30, 30, 80]); }
        else if (n.game === 'solo') { FX.banner(`${nm(h.player)} ทายถูกแล้ว! ทุกคนได้ +1`, 'check'); FX.play('correct'); FX.burst(innerWidth / 2, innerHeight * 0.38, 60); FX.floaty('+1'); }
        else { FX.banner(`${nm(h.player)} ทายถูกแล้ว! อันดับ ${h.rank}`, 'check'); FX.play('pop'); }
      } else if (h.state === 'gaveup') {
        quiet = false; if (mine) FX.play('lose'); else { FX.banner(`${nm(h.player)} ยอมแพ้`, 'mascot-cry'); FX.play('vote'); }
      } else if (h.state === 'out') {
        if (mine) caught(); else { FX.banner(`${nm(h.player)} หลุดแล้ว!`, 'wrong'); FX.play('buzz'); FX.shake(); }
      }
    }
    if (n.game === 'solo' && n.me !== n.guesser && n.guesses && n.guesses.length && (!p.guesses || !p.guesses.length || p.guesses[0].id !== n.guesses[0].id)) { FX.banner(`${nm(n.guesser)} ทายว่า "${n.guesses[0].text}" ใกล้เคียงไหม?`, 'question'); FX.play('pop'); }
    const seen = new Set(p.claims.map((c) => c.id));
    for (const c of n.claims) if (!seen.has(c.id)) claimed(c, nm);
    for (const c of p.claims) if (!n.claims.some((x) => x.id === c.id)) { const t = hand(n, c.target); if (t && t.state === 'active') { FX.banner('โหวตไม่ผ่าน รอดไปก่อน!', 'check'); FX.play('correct'); } }
  }
  function caught() {
    if (quiet) { quiet = false; FX.banner('คุณออกจากรอบแล้ว', 'mascot-cry'); return; }
    FX.flash('red'); FX.shake(); FX.play('buzz'); FX.vib([90, 50, 90]); FX.peek('m-angry');
    FX.splash({ icon: 'mascot-cry', title: 'โดนจับได้!', sub: 'คุณเผลอพูดคำต้องห้าม', bad: true, ms: 1700 });
  }
  function claimed(c, nm) {
    if (c.target === S?.me || c.target === sess?.player) { FX.flash('red'); FX.shake(); FX.play('buzz'); FX.peek('m-angry'); FX.vib([60, 40, 60]); FX.banner(`${nm(c.accuser)} จับคุณว่าพูดคำต้องห้าม!`, 'buzzer'); }
    else if (c.accuser !== (S && S.me)) { FX.play('buzz'); FX.peek('m-idea'); FX.banner(`${nm(c.accuser)} จับ ${nm(c.target)}! ช่วยโหวตหน่อย`, 'buzzer'); }
  }
  const winners = (n) => (n.game === 'head' ? n.hands.filter((h) => h.rank === 1).map((h) => h.player)
    : n.game === 'solo' ? (n.hands.some((h) => h.state === 'solved') ? n.players.map((p) => p.id) : [])
    : n.hands.filter((h) => h.state === 'active').map((h) => h.player));
  function finale(n) {
    if (n.game === 'wolf') {
      const w = n.wolf, won = w && w.winner && iWon(w);
      if (won) { FX.play('win'); FX.cannons(); FX.rain(2600); FX.flash('gold'); FX.vib([40, 40, 140]); } else FX.play('lose');
      return;
    }
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
    const join = `<section ${pp('panel', 3)}><h2>${ig('players', 'sm')}เข้าห้องของเพื่อน</h2><label class="field">รหัสห้อง 4 ตัว<input id="code" class="code-in" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="ABCD" value="${esc(q)}"></label><button class="btn ${q ? 'primary' : ''} block" data-act="join">${ico('play')}เข้าห้อง</button><button class="btn ghost block" data-act="watch">${ig('question', 'sm')}ดูจอแสดงคำอย่างเดียว</button></section>`;
    const create = `<section ${pp('panel', q ? 4 : 3)}><h2>${ig('mystery-cards', 'sm')}เปิดห้องใหม่</h2><div class="seg list" role="group" aria-label="เลือกเกม">${Object.entries(GAMES).map(([k, g]) => `<button class="opt" data-act="pickgame" data-v="${k}" aria-pressed="${k === homeGame}">${ig(g.icon)}<b>${g.name}</b><small>${g.rule}</small></button>`).join('')}</div><button class="btn ${q ? '' : 'primary'} block" data-act="create">สร้างห้อง</button></section>`;
    return `<div class="stack lg"><section ${pp('hero', 0)}>${ig('mascot-wave', 'bob')}<div><h1 class="sr">Let me ทาย</h1><p class="lead">เปิดห้อง ส่งรหัสให้เพื่อน แล้วทายกันเลย ไม่ต้องสมัคร ใช้มือถือหรือไอแพดก็ได้</p></div></section>${invite}
      <section ${pp('panel', 2)}><label class="field">ชื่อที่ใช้ในเกม<input id="name" maxlength="16" autocomplete="off" placeholder="เช่น บี" value="${name}"></label></section>${q ? join + create : create + join}</div>`;
  }

  function lobby() {
    const host = S.host === S.me, st = S.settings, g = S.game, n = S.players.length, md = eff(st, g);
    const list = `<ul class="plist">${S.players.map((p) => `<li class="${p.online ? '' : 'off'}">${avatar(p)}<span class="nm">${esc(p.name)}${p.id === S.me ? ' <span class="mute">(คุณ)</span>' : ''}</span>${g === 'wolf' && (st.wolf || {}).mod && p.id === S.host ? '<span class="tag">ผู้ดำเนินเกม</span>' : ''}${p.id === S.host ? `<span class="crown" title="โฮสต์">${ico('crown')}</span>` : ''}${S.round ? `<span class="num mute">${p.score} แต้ม</span>` : ''}</li>`).join('')}</ul>`;
    const chips = (arr, fn) => `<div class="chips">${arr.map(fn).join('')}</div>`;
    const settings = host ? `<section ${pp('panel', 3)}><h2>${ig('mystery-cards', 'sm')}ตั้งค่าเกม</h2>
      <div class="seg list" role="group" aria-label="เกม">${Object.entries(GAMES).map(([k, x]) => `<button class="opt" data-act="game" data-v="${k}" aria-pressed="${k === g}">${ig(x.icon)}<b>${x.name}</b><small>${x.rule}</small></button>`).join('')}</div>
      <div class="seg ${g === 'head' ? 'three' : 'two'}" role="group" aria-label="โหมดสุ่มคำ">${Object.entries(g === 'head' ? MODES : MODES2).map(([k, t]) => `<button class="chip" data-act="mode" data-v="${k}" aria-pressed="${md === k}">${t}</button>`).join('')}</div>
      ${g === 'forbidden' ? '<p class="hint">คำง่ายๆ ที่ใช้ในชีวิตประจำวัน · แต่ละรอบทุกคนได้คำจากหมวดเดียวกัน</p>' : g === 'solo' ? '<p class="hint">ใช้คำที่มีรูปประกอบ · ผู้ทายหมุนเวียนทีละคน คนอื่นเห็นคำและรูปแล้วช่วยตอบ ใช่/ไม่ใช่ (ผู้ทายได้ 3 แต้ม ผู้ช่วยคนละ 1 แต้ม)</p>' : md === 'chaos' ? '<p class="hint">Chaos: สุ่มเฉพาะคำยากมากและคำกวนประสาท</p>' : chips(LV, (t, i) => `<button class="chip" data-act="lvl" data-v="${i + 1}" aria-pressed="${st.levels.includes(i + 1)}">${t}</button>`)}
      ${md === 'cat' ? chips(S.cats || [], (c) => `<button class="chip" data-act="cat" data-v="${esc(c)}" aria-pressed="${st.cats.includes(c)}">${esc(c)}</button>`) : ''}
      <hr class="divider"><h2>${ig('timer', 'sm')}เวลาในการทาย <span class="hint">(สูงสุด 30 นาที)</span></h2>
      ${chips(TIMES, (m) => `<button class="chip" data-act="mins" data-v="${m}" aria-pressed="${st.minutes === m}">${m ? m + ' นาที' : 'ไม่จำกัด'}</button>`)}
      ${g === 'forbidden' ? `<button class="chip" data-act="reveal" aria-pressed="${st.reveal}">เห็นคำของคนอื่น (ไว้หลอกล่อ)</button>` : ''}${g === 'solo' ? `<hr class="divider"><h2>${ig('check', 'sm')}ยอมรับคำใกล้เคียง</h2><button class="chip" data-act="accept_mode" aria-pressed="${st.accept === true}">${st.accept === true ? 'เปิดอยู่' : 'ปิดอยู่'} · ผู้ช่วยกดยอมรับได้ ถ้าทายทับศัพท์/ใกล้เคียง/ใช้แทนกันได้</button>` : ''}</section>`
      : `<section ${pp('panel', 3)}><h2>${ig(GAMES[g].icon, 'sm')}${GAMES[g].name}</h2><p class="mute">${GAMES[g].rule}</p><p class="hint">โหมด ${(g === 'head' ? MODES : MODES2)[md]} · ${st.minutes ? st.minutes + ' นาที' : 'ไม่จำกัดเวลา'}</p></section>`;
    const wst = st.wolf || {}, wmod = wst.mod === true, wknow = wst.know !== false, plan = wolfPlan(n - (wmod ? 1 : 0), wst), wsec = wst.day || 120, wrev = wst.reveal !== false;
    const curRoles = Array.isArray(wst.roles) ? wst.roles : (plan.N >= 6 ? ['seer', 'guard', 'cub'] : ['seer', 'cub']);
    const pack = ['wolf', 'alpha', 'cub'].filter((k) => plan.roles[k] > 0).map((k) => `${ROLE[k].n} ×${plan.roles[k]}`).join(' + ');
    const strip = WORDER.filter((k) => plan.roles[k] > 0).map((k) => `<figure><button class="rbtn" data-act="rinfo" data-v="${k}" aria-label="ดูรายละเอียด ${ROLE[k].n}">${rcard(ROLE[k].img, '', ROLE[k].n)}</button><figcaption>${ROLE[k].n} <b>×${plan.roles[k]}</b></figcaption></figure>`).join('');
    const cfg = host ? `<hr class="divider"><h2>เลือกการ์ดบทพิเศษ</h2><p class="hint">แตะเพื่อเปิด/ปิด ที่เหลือระบบเติมเป็นชาวบ้านให้เอง</p>${chips(WOPT, (k) => `<button class="chip" data-act="wrole" data-v="${k}" aria-pressed="${curRoles.includes(k)}">${ROLE[k].e} ${ROLE[k].n}</button>`)}<h2>จำนวนหมาป่า <span class="hint">(สูงสุด ${plan.maxW} คนสำหรับ ${plan.N} คน)</span></h2>${chips([0, 1, 2, 3], (v) => `<button class="chip" data-act="wwolves" data-v="${v}" aria-pressed="${(wst.wolves || 0) === v}" ${v > plan.maxW || (v === 1 && curRoles.includes('cub')) ? 'disabled' : ''}>${v || 'อัตโนมัติ'}</button>`)}` : '';
    const wolfSet = `<section ${pp('panel', 3)}><h2>${ig('m-angry', 'sm')}หมาป่า</h2><p class="mute">${GAMES.wolf.rule}</p><p class="hint">การ์ดสำหรับ ${plan.N} คน (ระบบสุ่มแจก ไม่มีใครรู้บทของคนอื่น)</p><p class="wolfset">🐺 ชุดหมาป่า: <b>${pack}</b></p><p class="hint">หมาป่ากับลูกหมาป่าเป็นเซตเดียวกัน · ถ้าลูกหมาป่าตาย คืนถัดไปฝูงจะกินเหยื่อได้ 2 คน</p><div class="rolestrip">${strip}</div><button class="btn ghost sm" data-act="rall">ดูการ์ดบทบาททั้งหมด · แตะการ์ดเพื่อดูรายละเอียด</button>${plan.dropped.length ? `<p class="hint warn">คนไม่พอ จึงตัดออก: ${plan.dropped.map((k) => ROLE[k].n).join(', ')}</p>` : ''}<p class="hint">กติกาพื้นฐานคงเดิม: มีหมาป่าอย่างน้อย 1 ตัว และไม่เกินครึ่งหนึ่งของผู้เล่น · ชาวบ้านชนะเมื่อหมาป่าหมด หมาป่าชนะเมื่อมีจำนวนไม่น้อยกว่าคนที่เหลือ</p>${cfg}${host ? `<hr class="divider"><h2>${ig('timer', 'sm')}เวลาคุยตอนกลางวัน</h2>${chips([60, 120, 180], (x) => `<button class="chip" data-act="wday" data-v="${x}" aria-pressed="${wsec === x}">${x / 60} นาที</button>`)}<button class="chip" data-act="wreveal" aria-pressed="${wrev}">เปิดเผยบทบาทคนที่ตาย</button><hr class="divider"><h2>${ig('mascot-wave', 'sm')}รูปแบบการเล่น</h2><div class="seg list" role="group" aria-label="รูปแบบการเล่น"><button class="opt" data-act="wfmt" data-v="online" aria-pressed="${!wmod && wknow}"><b>ทุกคนเล่นผ่านแอป</b><small>ทุกคนใช้มือถือ หมาป่าเห็นเพื่อนหมาป่าในแอป</small></button><button class="opt" data-act="wfmt" data-v="live" aria-pressed="${wmod && !wknow}"><b>เจอหน้า + ผู้ดำเนินเกม</b><small>โฮสต์ไม่เล่น คุมเกมและบรรยาย หมาป่ารู้จักกันตอนลืมตาจริง แอปไม่แสดงเพื่อนหมาป่า</small></button></div><h2>ปรับเอง</h2><button class="chip" data-act="wmod" aria-pressed="${wmod}">${wmod ? 'เปิดอยู่' : 'ปิดอยู่'} · โฮสต์เป็นผู้ดำเนินเกม (ไม่ได้เล่น)</button><button class="chip" data-act="wknow" aria-pressed="${wknow}">${wknow ? 'เปิดอยู่' : 'ปิดอยู่'} · หมาป่าเห็นเพื่อนหมาป่าในแอป</button><p class="hint">${wmod ? `ผู้ดำเนินเกมเห็นบทของทุกคนและกดแทนผู้เล่นได้ (ต้องมีผู้เล่นอีกอย่างน้อย 5 คน ตอนนี้ ${n - 1} คน)` : 'ถ้าเล่นเจอหน้ากันและมีคนคุมเกม แนะนำปิดการแสดงเพื่อนหมาป่าในแอป เพราะหมาป่าเห็นหน้ากันจริงอยู่แล้ว'}${wknow ? '' : ' · ปิดอยู่: แอปจะไม่บอกว่าใครเป็นหมาป่า และไม่แสดงว่าเพื่อนหมาป่าเลือกเหยื่อคนไหน'}</p>` : `<p class="hint">คุยตอนกลางวัน ${wsec / 60} นาที · ${wrev ? 'เปิดเผย' : 'ไม่เปิดเผย'}บทบาทคนที่ตาย</p>${wmod ? `<p class="hint">🎙️ โฮสต์ <b>${esc(PL(S.host).name)}</b> เป็นผู้ดำเนินเกม (ไม่ได้เล่น และไม่ได้รับบท)</p>` : ''}<p class="hint">${wknow ? '🐺 หมาป่าจะเห็นเพื่อนหมาป่าในแอป' : '🐺 แอปไม่แสดงเพื่อนหมาป่า (รู้จักกันตอนลืมตาจริง)'}</p>`}</section>`;
    const minP = g === 'solo' ? 1 : g === 'wolf' ? (wmod ? 6 : 5) : 2;
    const wait = !host ? `<div ${pp('say', 4)}>${ig('m-sleep')}<p>รอโฮสต์กดเริ่มเกมนะ</p></div>` : n < minP ? `<div ${pp('say', 4)}>${ig('mascot-wave')}<p>${g === 'wolf' ? wmod ? `โหมดผู้ดำเนินเกมต้องมีผู้เล่นอย่างน้อย 5 คน + โฮสต์ (ตอนนี้ผู้เล่น ${n - 1} คน) ชวนเพื่อนเพิ่มนะ` : `เกมหมาป่าต้องมีอย่างน้อย 5 คน (ตอนนี้ ${n} คน) ชวนเพื่อนเพิ่มนะ` : 'ชวนเพื่อนอีกอย่างน้อย 1 คนก่อนเริ่ม (สนุกสุด 5–10 คน)'}</p></div>` : '';
    return `${top()}<div class="stack lg">
      <div ${pp('stack', 0)}><div class="codebox" aria-label="รหัสห้อง">${ig('ticket')}<b>${S.room}</b></div>
      <button class="btn sun block" data-act="share">${ico('link')}คัดลอกลิงก์เชิญเพื่อน</button></div>
      <section ${pp('panel', 1)}><div class="row between"><h2>ผู้เล่น</h2><span class="count num">${ig('players')}${n}/10</span></div>${list}</section>${g === 'solo' ? watchPanel(false) : ''}${g === 'wolf' ? wolfSet : settings}${wait}
      ${host ? `<button ${pp('btn primary block' + (n >= minP ? ' breathe' : ''), 5)} data-act="start" ${n < minP ? 'disabled' : ''}>${ico('play')}${S.round ? 'เริ่มรอบใหม่' : 'เริ่มเกม'}</button>` : ''}</div>`;
  }

  const hostEnd = () => (S.host === S.me ? `<button class="btn ghost block" data-act="end">จบรอบนี้</button>` : '');

  const guessBox = () => `<div class="stack"><div class="guessrow"><label class="field"><span class="sub mute">ทายเลย</span><input id="guess" maxlength="60" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" placeholder="คิดว่าเป็นอะไร?"></label><button class="btn primary" data-act="guess" aria-label="ส่งคำทาย">${ico('send')}</button></div><button class="btn ghost" data-act="giveup">ยอมแพ้ ขอดูเฉลย</button></div>`;

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
    return `${top(timer())}<div class="split"><div class="stack lg"><div class="pop" style="--i:0">${mine}</div><div class="pop" style="--i:1">${guess}</div></div><div class="stack lg"><section class="stack pop" style="--i:2"><h2>คำบนหัวเพื่อน</h2><ul class="plist">${others}</ul></section>${hostEnd()}</div></div>`;
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
    const canPass = gh.state === 'active' && S.settings.accept === true; const gl = canPass ? (S.guesses || []) : [];
    const glist = (btn) => gl.length ? `<ul class="glist">${gl.map((x) => `<li><span class="gword">${esc(x.text)}</span>${btn ? `<button class="btn mint sm" data-act="acceptg" data-id="${x.id}" data-t="${esc(x.text)}">${ig('check')}ยอมรับ</button>` : ''}</li>`).join('')}</ul>` : '';
    const near = !canPass ? '' : imG ? (gl.length ? `<section class="near"><h2>${ig('question', 'sm')}คำทายที่ส่งไปแล้ว</h2><p class="hint">รอเพื่อนตัดสินว่าใกล้เคียงพอไหม ถ้าใช่ เพื่อนจะกดให้ผ่าน</p>${glist(false)}</section>` : '') : `<section class="near"><h2>${ig('check', 'sm')}ให้ผ่าน</h2><p class="hint">ถ้าคำที่ <b>${esc(gp.name)}</b> พูดหรือทายมา วงคนให้คำใบ้ยอมรับกันได้ กดให้ผ่านได้เลย</p>${glist(true)}<button class="btn mint block" data-act="passg">${ig('check')}ให้ผ่าน (ยอมรับคำทายนี้)</button></section>`;
    const crew = S.players.filter((p) => p.id !== g).map((p, i) => `<li ${pp('hand', i)}>${avatar(p)}<span class="who"><b>${esc(p.name)}${p.id === S.me ? ' <span class="mute">(คุณ)</span>' : ''}</b><span class="sub mute">ผู้ช่วยตอบ ใช่ / ไม่ใช่</span></span></li>`).join('');
    const who = `<div class="turn pop" style="--i:0">${avatar(gp)}<span>${imG ? 'ตาคุณทายแล้ว!' : `<b>${esc(gp.name)}</b> กำลังทาย`}</span></div>`;
    const crewBox = crew ? `<section class="stack pop" style="--i:3"><h2>${imG ? 'เพื่อนที่ช่วยตอบในแอป' : 'ผู้ช่วย'}</h2><ul class="plist">${crew}</ul></section>` : '';
    return `${top(timer())}<div class="split"><div class="stack lg">${who}${cat}<div class="pop" style="--i:1">${main}</div><div class="pop" style="--i:2">${guess}</div>${imG ? near : ''}</div><div class="stack lg">${imG ? '' : near}${imG && gh.state === 'active' ? watchPanel(true) : ''}${crewBox}${hostEnd()}</div></div>`;
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
    return `${top(timer())}<div class="split"><div class="stack lg">${cat}<div class="pop" style="--i:0">${mine}</div>${claims ? `<section class="stack"><h2>รอโหวต</h2>${claims}</section>` : ''}</div><div class="stack lg"><section class="stack pop" style="--i:2"><h2>เพื่อนในวง</h2><ul class="plist">${others}</ul></section>${hostEnd()}</div></div>`;
  }

  function over() {
    if (S.game === 'wolf') return wolfOver();
    const host = S.host === S.me, hands = S.hands, mine = H(S.me) || {};
    const wins = winners(S);
    const gh = S.game === 'solo' ? H(S.guesser) || {} : null;
    let head;
    if (S.game === 'solo') head = gh.state === 'solved' ? `${esc(PL(S.guesser).name)} ทายถูก! ทั้งทีมได้แต้ม` : `${esc(PL(S.guesser).name)} ทายไม่ออก`;
    else if (S.game === 'head') head = wins.length ? `${esc(PL(wins[0]).name)} ทายถูกก่อน` : 'ไม่มีใครทายถูกเลย';
    else head = wins.length === 1 ? `${esc(PL(wins[0]).name)} รอดคนสุดท้าย` : wins.length ? `${wins.length} คนรอดจนหมดเวลา` : 'ไม่มีใครรอด';
    const iWon = wins.includes(S.me), lost = mine.state === 'out' || mine.state === 'gaveup';
    const mood = iWon ? ig('banner-win', 'ban') + ig('m-win', 'big') : lost ? ig('banner-lose', 'ban') : ig(wins.length ? 'm-shock' : 'm-think', 'big');
    const rows = [...S.players].sort((a, b) => b.score - a.score).map((p, i) => {
      const h = H(p.id), from = p.score - (h ? h.pts : 0);
      return `<li ${pp(i === 0 ? 'first' : '', i + 2)}><span class="rank num ${i === 0 ? 'first' : ''}">${i + 1}</span>${avatar(p)}<span class="nm">${esc(p.name)}${h ? `<br><span class="sub mute">${S.game === 'solo' ? (p.id === S.guesser ? 'ผู้ทาย' : 'ผู้ช่วย') : esc(h.word)}</span>` : ''}</span><span class="delta num">${h && h.pts ? '+' + h.pts : ''}</span><b class="num" data-count data-from="${from}" data-to="${p.score}">${p.score}</b>${i === 0 && p.score > 0 ? ig('trophy') : ''}</li>`;
    }).join('');
    return `${top()}<div class="split"><div class="stack lg"><div class="winhero pop" style="--i:0">${iWon ? ig('trophy', 'tro') : ''}${mood}<p class="mute">จบรอบที่ ${S.round}</p><h1>${head}</h1>${gh && gh.word ? `<div class="revealpic">${pic(gh.emoji, 'xl')}<span class="stub">${esc(gh.word)}</span></div>` : ''}</div></div>
      <div class="stack lg"><section class="stack pop" style="--i:1"><h2>คะแนนรวม</h2><ul class="plist">${rows}</ul></section>
      ${host ? `<div class="stack pop" style="--i:6"><button class="btn primary block" data-act="start">${ico('play')}เล่นรอบต่อไป</button><button class="btn ghost block" data-act="tolobby">ตั้งค่า / รอเพื่อนเพิ่ม</button></div>` : `<div ${pp('say', 6)}>${ig('mascot-wave')}<p>รอโฮสต์เริ่มรอบใหม่</p></div>`}</div></div>`;
  }

  function render() {
    let html;
    if (!sess) html = home();
    else if (!S) html = `<div class="say pop">${ig('m-run', 'bob')}<p>กำลังเข้าห้อง…</p></div>`;
    else html = S.status === 'lobby' ? lobby() : S.status === 'over' ? over() : S.game === 'wolf' ? wolfGame() : S.game === 'head' ? headGame() : S.game === 'solo' ? soloGame() : forbGame();
    const key = !sess ? 'home' : !S ? 'load' : S.status + ':' + S.round + ':' + S.game;
    if (key !== viewKey) { viewKey = key; enterNext = true; }
    document.body.classList.toggle('in-room', !!(sess && S));
    document.body.classList.toggle('wolfnight', !!(S && S.game === 'wolf' && S.status === 'playing' && S.wolf && S.wolf.phase === 'night'));
    html = `<div>${html}</div>`;
    if (html === last) return;
    last = html; fired = false;
    const a = document.activeElement, id = a && a.id, val = a && a.value, pos = a && a.selectionStart;
    const app = $('#app'); app.innerHTML = html;
    if (enterNext) { app.firstElementChild.classList.add('enter'); enterNext = false; countUps(); }
    document.querySelectorAll('.wchat-list').forEach((l) => { l.scrollTop = l.scrollHeight; });
    if (id) { const n = document.getElementById(id); if (n) { n.value = val; n.focus(); try { n.setSelectionRange(pos, pos); } catch {} } }
    tick();
  }
  function tick() {
    document.querySelectorAll('[data-end]').forEach((el) => {
      const ms = Date.parse(el.dataset.end) - (Date.now() + offset), s = Math.max(0, Math.ceil(ms / 1000)), tot = +el.dataset.total || 0;
      el.querySelector('[data-t]').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      const bar = document.querySelector('[data-bar]');
      if (bar && tot) { const p = Math.max(0, Math.min(100, (ms / tot) * 100)); bar.style.setProperty('--p', p + '%'); bar.style.setProperty('--bc', p > 50 ? 'var(--mint)' : p > 20 ? 'var(--sun)' : 'var(--chili)'); }
      const hurry = s > 0 && s <= 10; el.classList.toggle('hurry', hurry); document.body.classList.toggle('urgent', hurry);
      if (hurry && s !== lastTick) { lastTick = s; FX.play('tick'); }
      if (ms <= 0 && !fired) { fired = true; document.body.classList.remove('urgent'); WATCH ? watchPoll() : refresh(); }
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

  /* ---------- เกมหมาป่า ---------- */
  const ROLE = {
    wolf: { n: 'หมาป่า', e: '🐺', img: 'wolf', en: 'WEREWOLF', team: 'wolf', d: 'ตื่นในเวลากลางคืน ร่วมกันเลือกเหยื่อ 1 คน และต้องปกปิดตัวตนในตอนกลางวัน', ab: 'กลางคืน: เลือกเหยื่อร่วมกับหมาป่าตัวอื่น (คนที่ได้เสียงมากสุดจะถูกกิน) และเห็นว่าใครเป็นเพื่อนหมาป่า' },
    alpha: { n: 'จ่าฝูงหมาป่า', e: '👑', img: 'alpha', en: 'ALPHA WOLF', team: 'wolf', d: 'ร่วมเลือกเหยื่อกับหมาป่า มีสิทธิ์ตัดสินเมื่อเลือกไม่ตรงกัน', ab: 'กลางคืน: เลือกเหยื่อเหมือนหมาป่า และเสียงของจ่าฝูงชี้ขาดเมื่อคะแนนเสมอ หมอดูส่องแล้วเห็นเป็นหมาป่า' },
    cub: { n: 'ลูกหมาป่า', e: '🐾', img: 'cub', en: 'WOLF CUB', team: 'wolf', d: 'เป็นสมาชิกหมาป่า หากถูกกำจัด อาจทำให้หมาป่าได้สิทธิ์ฆ่าเพิ่ม', ab: 'กลางคืน: เลือกเหยื่อร่วมกับหมาป่า · ถ้าลูกหมาป่าตาย (ด้วยวิธีใดก็ตาม) คืนถัดไปหมาป่าจะเลือกเหยื่อได้ 2 คน' },
    villager: { n: 'ชาวบ้าน', e: '🧑‍🌾', img: 'villager', en: 'VILLAGER', team: 'village', d: 'ไม่มีความสามารถพิเศษ วิเคราะห์พฤติกรรมและคำพูด ร่วมโหวตหาหมาป่า', ab: 'กลางวัน: คุย สังเกต และโหวตหาหมาป่า' },
    seer: { n: 'หมอดู', e: '🔮', img: 'seer', en: 'SEER', team: 'village', d: 'ตรวจสอบผู้เล่น 1 คนในแต่ละคืน ระบบแจ้งผลว่าผู้เล่นเป็นหมาป่าหรือไม่', ab: 'กลางคืน: เลือกส่อง 1 คน (หมาป่าทุกชนิดรวมจ่าฝูงและลูกหมาป่าจะเห็นเป็น "หมาป่า")' },
    guard: { n: 'ผู้คุ้มกัน', e: '🛡️', img: 'guard', en: 'BODYGUARD', team: 'village', d: 'เลือกปกป้องผู้เล่น 1 คนต่อคืน เป้าหมายจะรอดจากการโจมตี', ab: 'กลางคืน: เลือกปกป้อง 1 คน (เลือกตัวเองได้) ป้องกันได้ทั้งหมาป่าและนักล่า' },
    witch: { n: 'แม่มด', e: '🧪', img: 'witch', en: 'WITCH', team: 'village', d: 'มียาชุบชีวิต 1 ครั้ง และยาพิษ 1 ครั้ง เลือกใช้หรือไม่ใช้ในแต่ละคืน', ab: 'กลางคืน: เห็นเหยื่อของหมาป่า เลือกชุบชีวิตหรือวางยาพิษได้ (คืนละอย่างเดียว ยาแต่ละขวดใช้ได้ครั้งเดียวตลอดเกม)' },
    hunter: { n: 'นายพราน', e: '🏹', img: 'hunter', en: 'HUNTER', team: 'village', d: 'เมื่อถูกกำจัด สามารถเลือกยิงผู้เล่น 1 คน ให้ตายทันที', ab: 'กลางคืน: เลือกเป้าหมายที่จะยิงไว้ล่วงหน้า (เปลี่ยนได้ทุกคืน) พอตาย ไม่ว่าถูกกินหรือถูกโหวตออก จะยิงเป้านั้นตายตามทันที' },
    cupid: { n: 'กามเทพ', e: '💘', img: 'cupid', en: 'CUPID', team: 'village', d: 'เลือกผู้เล่น 2 คนเป็นคู่รัก หากคนหนึ่งตาย อีกคนตายตาม', ab: 'คืนแรก: เลือกคู่รัก 2 คน (เลือกตัวเองได้) · ถ้าคู่รักเป็นคนละฝ่ายและเหลือกันสองคนสุดท้าย คู่รักชนะ' },
    littlegirl: { n: 'เด็กหญิง', e: '👧', img: 'littlegirl', en: 'LITTLE GIRL', team: 'special', d: 'แอบสังเกตหมาป่าในคืนได้ แต่มีความเสี่ยงที่จะถูกจับได้', ab: 'กลางคืน: แอบดูได้ 1 ครั้ง จะรู้ชื่อหมาป่า 1 ตัว แต่มีโอกาสราว 1 ใน 3 ที่ถูกจับได้และตายตอนเช้า' },
    mayor: { n: 'ผู้ใหญ่บ้าน', e: '🎖️', img: 'mayor', en: 'MAYOR', team: 'special', d: 'คะแนนโหวตของคุณมีน้ำหนัก 2 เสียง', ab: 'กลางวัน: โหวตของคุณนับเป็น 2 เสียง' },
    idiot: { n: 'คนโง่ประจำหมู่บ้าน', e: '🤪', img: 'idiot', en: 'IDIOT', team: 'special', d: 'เมื่อถูกโหวตออก อาจไม่ตาย แต่เสียสิทธิ์โหวต', ab: 'กลางวัน: ถ้าถูกโหวตออกครั้งแรกจะไม่ตาย แต่ต้องเปิดไพ่และเสียสิทธิ์โหวตตั้งแต่นั้น (ถ้าถูกโหวตอีกจะตาย)' },
    killer: { n: 'นักล่า', e: '🔪', img: 'killer', en: 'SERIAL KILLER', team: 'solo', d: 'ฆ่าผู้เล่นหนึ่งคนทุกคืน และมีเงื่อนไขชนะเป็นของตัวเอง', ab: 'กลางคืน: เลือกฆ่า 1 คน (ผู้คุ้มกันปกป้องได้) หมอดูส่องแล้วเห็นว่าไม่ใช่หมาป่า · ชนะเมื่อรอดเป็นคนสุดท้าย' },
    infected: { n: 'ผู้ติดเชื้อ', e: '🦠', img: 'infected', en: 'INFECTED', team: 'special', d: 'เปลี่ยนฝ่ายตามเงื่อนไขที่กำหนด', ab: 'เริ่มเป็นฝ่ายชาวบ้าน · ถ้าหมาป่าเลือกกินคุณ (และไม่มีใครช่วย) คุณจะไม่ตาย แต่ถูกเปลี่ยนเป็นหมาป่าและได้รู้จักเพื่อนหมาป่า' },
    thief: { n: 'จอมโจร', e: '🦹', img: 'thief', en: 'THIEF', team: 'special', d: 'สามารถเปลี่ยนหรือแลกเปลี่ยนบทบาทในคืนแรก', ab: 'คืนแรก: เลือกขโมยบทบาทของผู้เล่น 1 คน คุณจะได้บทของเขา และเขากลายเป็นชาวบ้าน (หรือเลือกไม่ขโมยก็ได้)' },
  };
  const TEAM = { wolf: 'ฝ่ายหมาป่า', village: 'ฝ่ายชาวบ้าน', special: 'บทเสริม / พิเศษ', solo: 'อิสระ' };
  const WINTXT = { wolf: 'หมาป่าชนะเมื่อมีจำนวนไม่น้อยกว่าคนที่เหลือ', village: 'ชาวบ้านชนะเมื่อกำจัดหมาป่าทั้งหมด (และนักล่า) ได้', special: 'ชนะตามฝ่ายที่ตัวเองสังกัดเมื่อจบเกม (ผู้ติดเชื้อที่กลายเป็นหมาป่าจะชนะฝั่งหมาป่า)', solo: 'ชนะคนเดียวเมื่อรอดเป็นผู้เล่นคนสุดท้าย' };
  const RGROUPS = [['ฝ่ายหมาป่า', ['wolf', 'alpha', 'cub']], ['ฝ่ายชาวบ้าน', ['villager', 'seer', 'witch', 'guard', 'hunter', 'cupid']], ['บทเสริม', ['littlegirl', 'mayor', 'idiot']], ['พิเศษ / อิสระ', ['killer', 'infected', 'thief']]];
  const rcard = (img, c = '', alt = '') => `<img class="rcard ${c}" src="assets/wolf/${img}.webp" alt="${esc(alt)}" decoding="async" draggable="false">`;
  const isW = (r) => r === 'wolf' || r === 'alpha' || r === 'cub';
  const WSPEC = ['seer', 'guard', 'witch', 'hunter', 'cupid', 'littlegirl', 'idiot', 'mayor', 'killer', 'infected', 'thief'];
  const WOPT = ['cub', 'alpha', 'seer', 'guard', 'witch', 'hunter', 'cupid', 'littlegirl', 'idiot', 'mayor', 'killer', 'infected', 'thief'];
  const WORDER = ['wolf', 'alpha', 'cub', 'seer', 'guard', 'witch', 'hunter', 'cupid', 'littlegirl', 'idiot', 'mayor', 'killer', 'infected', 'thief', 'villager'];
  // คำนวณชุดการ์ดแบบเดียวกับ mg_wolf_init ฝั่งเซิร์ฟเวอร์ (กติกาพื้นฐาน: หมาป่า >= 1 และไม่เกินครึ่งของผู้เล่น)
  const wolfPlan = (n, wst = {}) => {
    const N = Math.max(n, 5), maxW = Math.floor((N - 1) / 2), auto = N <= 6 ? 1 : N <= 9 ? 2 : 3;
    const sel = Array.isArray(wst.roles) ? wst.roles : (N >= 6 ? ['seer', 'guard', 'cub'] : ['seer', 'cub']);
    let nw0 = wst.wolves || auto; if (sel.includes('cub')) nw0 = Math.max(nw0, 2);
    const nw = Math.max(1, Math.min(nw0, maxW)), roles = { wolf: nw }, dropped = [];
    if (sel.includes('alpha')) { roles.alpha = 1; roles.wolf--; }
    if (sel.includes('cub')) { if (nw >= 2 || !sel.includes('alpha')) { roles.cub = 1; roles.wolf--; } else dropped.push('cub'); }
    let used = nw;
    for (const k of WSPEC) if (sel.includes(k)) { if (used < N) { roles[k] = 1; used++; } else dropped.push(k); }
    roles.villager = N - used;
    return { roles, nw, maxW, dropped, N };
  };
  let wolfHide = false;
  const wlog = (w, t, day) => [...w.log].reverse().find((e) => e.t === t && (day == null || e.day === day));
  const roleName = (w, id) => { const p = w.players.find((x) => x.id === id); return p && p.role && ROLE[p.role] ? ROLE[p.role].n : ''; };
  const WHY = { wolf: 'ถูกหมาป่ากินตาย', poison: 'ถูกวางยาตาย', killer: 'ถูกนักล่าฆ่าตาย', caught: 'แอบดูหมาป่าแล้วถูกจับได้', shot: 'ถูกนายพรานยิงตาย', love: 'ตรอมใจตายตามคู่รัก', vote: 'ถูกโหวตออก' };
  const deaths = (e) => (!e ? [] : e.t === 'vote' ? [...(e.dead ? [{ p: e.dead, why: 'vote' }] : []), ...(e.extra || [])]
    : [...(e.dead ? [{ p: e.dead, why: 'wolf' }] : []), ...(e.dead2 ? [{ p: e.dead2, why: 'poison' }] : []), ...(e.extra || [])]);
  const iWon = (w) => (w.winner === 'wolf' ? isW(w.role) : w.winner === 'village' ? !isW(w.role) && w.role !== 'killer' : w.winner === 'killer' ? w.role === 'killer' : w.winner === 'lovers' ? !!w.lover : false);

  /* หน้าต่างดูรายละเอียดการ์ด */
  let rv = null, rvBack = false;
  const rdetail = (k) => { const R = ROLE[k]; return `<div class="rdetail">${rcard(R.img, 'big', R.n)}<h2>${R.n}</h2><p class="ren">${R.en}</p><p><span class="tag ${R.team === 'wolf' ? 'dead' : ''}">${TEAM[R.team]}</span></p><p class="rdesc">${R.d}</p><div class="rinfo"><h3>ความสามารถ</h3><p>${R.ab}</p></div><div class="rinfo"><h3>เงื่อนไขชนะ</h3><p>${WINTXT[R.team]}${k === 'cupid' ? ' · หรือ "คู่รักชนะ" ถ้าคู่รักคนละฝ่ายเหลือกันสองคนสุดท้าย' : ''}</p></div></div>`; };
  function roleSheet() {
    const root = $('#role-root'); if (!root) return;
    if (!rv) { root.innerHTML = ''; document.body.classList.remove('sheetopen'); return; }
    const gal = RGROUPS.map(([t, ks]) => `<h3>${t}</h3><div class="rgrid">${ks.map((k) => `<button class="rbtn" data-act="rinfo" data-v="${k}" data-from="all">${rcard(ROLE[k].img, '', ROLE[k].n)}<span>${ROLE[k].n}</span></button>`).join('')}</div>`).join('');
    const idx = WORDER.indexOf(rv), prev = WORDER[(idx + WORDER.length - 1) % WORDER.length], next = WORDER[(idx + 1) % WORDER.length], frm = rvBack ? 'all' : '';
    const head = rv === 'all' ? '<h2>การ์ดบทบาททั้งหมด</h2>'
      : `<div class="rs-nav">${rvBack ? '<button class="btn ghost sm rback" data-act="rall" aria-label="กลับไปการ์ดทั้งหมด"><span aria-hidden="true">←</span><span class="lbl"> ทั้งหมด</span></button>' : ''}<button class="btn ghost sm arrow" data-act="rinfo" data-v="${prev}" data-from="${frm}" aria-label="การ์ดก่อนหน้า: ${ROLE[prev].n}">‹</button><span class="hint num">${idx + 1}/${WORDER.length}</span><button class="btn ghost sm arrow" data-act="rinfo" data-v="${next}" data-from="${frm}" aria-label="การ์ดถัดไป: ${ROLE[next].n}">›</button></div>`;
    const body = rv === 'all' ? `<p class="hint">แตะการ์ดเพื่อดูรายละเอียด</p>${gal}` : (ROLE[rv] ? rdetail(rv) : '');
    root.innerHTML = `<div class="rsheet"><button class="rsheetbg" data-act="rclose" aria-label="ปิด"></button><div class="rsheetbox" role="dialog" aria-modal="true" aria-label="รายละเอียดการ์ดบทบาท"><div class="rs-head">${head}<button class="rs-x" data-act="rclose" aria-label="ปิด">✕</button></div><div class="rs-body">${body}</div><div class="rs-foot"><button class="btn primary block" data-act="rclose">ปิด</button></div></div></div>`;
    const bx = root.querySelector('.rs-x'); if (bx) bx.focus({ preventScroll: true });
    document.body.classList.add('sheetopen');
  }

  addEventListener('keydown', (e) => {
    if (!rv) return;
    if (e.key === 'Escape') { rv = null; roleSheet(); return; }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && rv !== 'all' && ROLE[rv]) { const i = WORDER.indexOf(rv); rv = WORDER[(i + (e.key === 'ArrowRight' ? 1 : WORDER.length - 1)) % WORDER.length]; roleSheet(); }
  });

  function wolfEvents(p, n) {
    const a = p.wolf, b = n.wolf; if (!a || !b) return;
    const nm = (id) => (n.players.find((x) => x.id === id) || { name: '?' }).name;
    const seq = (ds, icon, withRole) => ds.slice(0, 4).forEach((d, i) => setTimeout(() => { const r = withRole ? roleName(b, d.p) : ''; FX.banner(`${nm(d.p)} ${WHY[d.why]}${r ? ' · เป็น' + r : ''}`, icon); }, i * 1900));
    if (a.phase !== b.phase || a.day_no !== b.day_no) {
      if (b.phase === 'day') {
        const ds = deaths(wlog(b, 'night', a.day_no));
        if (ds.length) { seq(ds, 'mascot-cry'); FX.play('lose'); FX.shake(); FX.vib([60, 40, 120]); }
        else { FX.banner('เมื่อคืนไม่มีใครตาย', 'check'); FX.play('correct'); }
      } else if (b.phase === 'vote') { FX.banner('ได้เวลาโหวตแล้ว!', 'question'); FX.play('start'); }
      else if (b.phase === 'night') {
        const e = wlog(b, 'vote', a.day_no), ds = deaths(e);
        if (e && e.idiot) { FX.banner(`${nm(e.idiot)} คือคนโง่ประจำหมู่บ้าน! รอดตายแต่เสียสิทธิ์โหวต`, 'check'); FX.play('tick2'); }
        else if (ds.length) { seq(ds, 'wrong', true); FX.play('buzz'); }
        else { FX.banner('โหวตเสมอ ไม่มีใครถูกโหวตออก', 'check'); FX.play('tick2'); }
        setTimeout(() => FX.banner('กลางคืนมาถึงแล้ว หลับตาได้', 'm-sleep'), 2600 + Math.max(0, ds.length - 1) * 1900);
      }
    }
    const me0 = a.players.find((x) => x.id === n.me), me1 = b.players.find((x) => x.id === n.me);
    if (me0 && me1 && me0.alive && !me1.alive) { FX.peek('m-cry'); FX.vib([80, 40, 80]); }
    if (a.role && b.role && a.role !== b.role) { FX.banner(`บทของคุณเปลี่ยนเป็น ${ROLE[b.role] ? ROLE[b.role].n : ''}`, 'question'); FX.play('start'); }
  }


  /* ---------- แชทเกมหมาป่า ----------
     ช่อง 'wolf' (ลับ): ส่งได้เฉพาะหมาป่าที่ยังมีชีวิตตอนกลางคืน และเห็นได้เฉพาะหมาป่า (+ผู้ดำเนินเกม) · บังคับที่เซิร์ฟเวอร์ (mg_wolf_chat_*)
     ช่อง 'all' : ผู้เล่นที่ยังมีชีวิตคุยกันตอนกลางวัน/โหวต · ผู้ดำเนินเกมส่งได้ทุกเวลา */
  function wolfChatInfo(w) {
    const me = (w.players || []).find((p) => p.id === S.me), role = w.role, st = S.settings.wolf || {};
    const know = st.know !== false, night = w.phase === 'night', alive = w.alive !== false;
    const ch = w.mod ? 'all' : isW(role) && alive && know && night ? 'wolf' : alive && !night ? 'all' : null;
    let why = '';
    if (!ch) why = w.mod ? '' : !alive ? 'คุณตายแล้ว ดูแชทได้อย่างเดียว' : night ? 'กลางคืนห้ามคุย หลับตารอเช้า' : '';
    const canSee = w.mod || (isW(role) && know);
    return { ch, why, canSee, me };
  }
  function wolfChat(w) {
    const { ch, why, canSee } = wolfChatInfo(w), list = (S.wchat || []).filter((m) => m.ch !== 'wolf' || canSee); // กันซ้ำฝั่งเครื่อง: ข้อความช่องหมาป่าแสดงเฉพาะผู้มีสิทธิ์ (เซิร์ฟเวอร์ก็กรองให้อยู่แล้ว)
    const msgs = list.map((m) => `<li class="cmsg ${m.ch === 'wolf' ? 'wolfonly' : ''} ${m.mine ? 'mine' : ''}"><span class="cwho">${m.ch === 'wolf' ? '🐺 ' : ''}${esc(m.name)}${m.mine ? ' (คุณ)' : ''}</span><span class="ctxt">${esc(m.text)}</span></li>`).join('');
    const hint = canSee ? '<p class="hint">🐺 ข้อความที่มีป้ายหมาป่า เห็นได้เฉพาะหมาป่า (และผู้ดำเนินเกม) · ข้อความทั่วไปทุกคนเห็น</p>' : '<p class="hint">คุยกันได้ตอนกลางวันและตอนโหวต</p>';
    const form = ch ? `<div class="cform"><input id="wcmsg" maxlength="200" autocomplete="off" enterkeyhint="send" placeholder="${ch === 'wolf' ? 'พิมพ์ถึงเพื่อนหมาป่า (ลับ)' : 'พิมพ์ถึงทุกคน'}" data-ch="${ch}"><button class="btn primary" data-act="wsay" aria-label="ส่งข้อความ">ส่ง</button></div><p class="hint">${ch === 'wolf' ? '🔒 ช่องนี้เห็นเฉพาะหมาป่า' : '💬 ช่องนี้ทุกคนเห็น'}</p>` : `<p class="hint">${why}</p>`;
    return `<section ${pp('panel wchat', 3)}><h2>${ig('chat-bubbles', 'sm')}แชท</h2>${hint}<ul class="wchat-list" aria-live="polite">${msgs || '<li class="mute cempty">ยังไม่มีข้อความ</li>'}</ul>${form}</section>`;
  }

  function wolfGame() {
    const w = S.wolf;
    if (!w) return `${top()}<div class="say pop">${ig('m-run', 'bob')}<p>กำลังโหลดเกม…</p></div>`;
    if (w.mod) return modGame();
    const host = S.host === S.me, role = w.role, R = ROLE[role] || ROLE.villager, alive = w.alive, mine = w.mine || {};
    const others = w.players.filter((p) => p.alive && p.id !== S.me);
    const title = w.phase === 'night' ? `กลางคืนที่ ${w.day_no}` : w.phase === 'day' ? `กลางวันที่ ${w.day_no}` : 'ลงคะแนนโหวต';
    const tm = w.phase_end ? `<div class="timerwrap"><span class="timer num" data-end="${w.phase_end}" data-total="${w.phase_secs * 1000}">${ig('timer')}<span data-t></span></span><div class="bar"><i data-bar></i></div></div>` : '';
    const mates = isW(role) ? w.players.filter((p) => isW(p.role) && p.id !== S.me).map((p) => esc(PL(p.id).name) + (p.role !== 'wolf' && ROLE[p.role] ? ` (${ROLE[p.role].n})` : '')) : [];
    const cubAlive = isW(role) && w.players.some((p) => p.role === 'cub' && p.alive);
    const lover = w.lover ? PL(w.lover) : null;
    const was = w.was && w.was !== role && ROLE[w.was] ? `<p class="hint warn">บทของคุณเปลี่ยนไปแล้ว (เดิมคือ ${ROLE[w.was].n})</p>` : '';
    const card = `<section ${pp('panel rolecard', 0)}><div class="row between"><h2>บทบาทของคุณ</h2><div class="row"><button class="btn ghost sm" data-act="rall">ดูทุกบท</button><button class="btn ghost sm" data-act="wolfhide">${wolfHide ? 'ดูการ์ด' : 'ซ่อนการ์ด'}</button></div></div>${wolfHide ? '<p class="hint">ซ่อนอยู่ กดดูอีกครั้งตอนไม่มีใครมอง</p>' : `<div class="rolebox"><button class="rbtn" data-act="rinfo" data-v="${role}" aria-label="ดูรายละเอียด ${R.n}">${rcard(R.img, 'big', R.n)}</button><div><b class="rname">${R.n}</b><p class="hint">${R.d}</p>${mates.length ? `<p class="hint">เพื่อนหมาป่า: <b>${mates.join(', ')}</b></p>` : isW(role) ? ((S.settings.wolf || {}).know === false ? '<p class="hint">🐺 โฮสต์ปิดการแสดงเพื่อนหมาป่าในแอป ให้รู้จักกันตอนผู้ดำเนินเกมเรียกฝูงลืมตา</p>' : '<p class="hint">คุณเป็นหมาป่าตัวเดียว</p>') : ''}${cubAlive ? '<p class="hint">🐾 ฝูงมีลูกหมาป่า ช่วยกันปกป้องมันไว้ ถ้ามันตาย คืนถัดไปฝูงจะกินได้ 2 คน</p>' : ''}${lover ? `<p class="hint">💘 คุณเป็นคู่รักกับ <b>${esc(lover.name)}</b> ถ้าคนหนึ่งตาย อีกคนตายตาม</p>` : ''}${was}<button class="btn ghost sm" data-act="rinfo" data-v="${role}">รายละเอียดบทนี้</button></div></div>`}</section>`;
    const roster = `<ul class="plist">${w.players.map((p) => { const pl = PL(p.id); return `<li class="${p.alive ? '' : 'off'}">${avatar(pl)}<span class="nm">${esc(pl.name)}${p.id === S.me ? ' <span class="mute">(คุณ)</span>' : ''}</span>${p.alive ? `<span class="tag">${p.revealed ? 'เปิดไพ่ · ' + (ROLE[p.role] ? ROLE[p.role].n : '') : 'ยังอยู่'}</span>` : `<span class="tag dead">ตาย${p.role && ROLE[p.role] ? ' · ' + ROLE[p.role].n : ''}</span>`}</li>`; }).join('')}</ul>`;
    const pick = (act, kind, list, chosen) => `<div class="pick">${list.map((p) => `<button class="pickbtn" data-act="${act}" data-k="${kind}" data-id="${p.id}" aria-pressed="${chosen === p.id}">${avatar(PL(p.id))}<span>${esc(PL(p.id).name)}</span></button>`).join('')}</div>`;
    const okLine = (t) => `<p class="hint ok">${t}</p>`;
    const passBtn = (label) => `<button class="btn ghost block" data-act="wnpass">${label}</button>`;
    const dead = `<section ${pp('panel', 1)}><h2>คุณตายแล้ว</h2>${ig('m-cry', 'sm')}<p class="hint">ดูเพื่อนเล่นต่อเงียบๆ ห้ามบอกใบ้นะ</p></section>`;
    const seerNotes = role === 'seer' && (w.seer || []).length ? `<section class="panel"><h2>ผลที่ส่องมา</h2><ul class="glist">${w.seer.map((x) => `<li><span>คืนที่ ${x.day}: <b>${esc(PL(x.target).name)}</b></span><span class="tag ${x.wolf ? 'dead' : ''}">${x.wolf ? 'หมาป่า' : 'ไม่ใช่หมาป่า'}</span></li>`).join('')}</ul></section>` : '';
    const peekNotes = role === 'littlegirl' && (w.peeks || []).length ? `<section class="panel"><h2>หมาป่าที่แอบเห็น</h2><ul class="glist">${w.peeks.map((x) => `<li><span>คืนที่ ${x.day}: <b>${esc(PL(x.target).name)}</b></span><span class="tag dead">หมาป่า</span></li>`).join('')}</ul></section>` : '';
    const sleep = `<section ${pp('panel', 1)}><h2>หลับตาอยู่…</h2>${ig('m-sleep')}<p class="hint">คืนนี้ไม่มีอะไรให้ทำ หลับตาหรือวางมือถือไว้ รอเช้า ห้ามแอบดู</p></section>`;
    let main = '', hostBtn = '';
    if (w.phase === 'night') {
      const d1 = w.day_no === 1;
      if (!alive) main = dead;
      else if (isW(role)) {
        const prey = w.players.filter((p) => p.alive && !isW(p.role));
        const seen = (k) => (w.wolf_picks || []).filter((x) => x.kind === k && x.from !== S.me && x.to).map((x) => `${esc(PL(x.from).name)} เลือก ${esc(PL(x.to).name)}`);
        const s1 = seen('kill'), s2 = seen('kill2');
        main = `<section ${pp('panel', 1)}><h2>เลือกเหยื่อของคืนนี้</h2><p class="hint">แตะชื่อเพื่อเลือก ถ้ามีหมาป่าหลายตัว คนที่ได้เสียงมากสุดจะถูกกิน${(S.settings.wolf || {}).know === false ? ' (แอปไม่แสดงว่าเพื่อนหมาป่าเลือกใคร ให้ตกลงกันนอกแอป)' : ''}</p>${pick('nact', 'kill', prey, mine.kill)}${s1.length ? `<p class="hint">${s1.join(' · ')}</p>` : ''}${w.cub_double ? `<h2>ลูกหมาป่าตายไปแล้ว! เลือกเหยื่อคนที่ 2</h2>${pick('nact', 'kill2', prey, mine.kill2)}${s2.length ? `<p class="hint">${s2.join(' · ')}</p>` : ''}` : ''}${mine.kill && (!w.cub_double || mine.kill2) ? okLine('เลือกแล้ว รอคืนนี้จบ (เปลี่ยนใจได้จนกว่าทุกคนเลือกครบ)') : ''}</section>`;
      } else if (role === 'seer') {
        const res = (w.seer || []).find((x) => x.day === w.day_no);
        main = `<section ${pp('panel', 1)}><h2>เลือกคนที่จะส่อง</h2>${res ? `<div class="seerres ${res.wolf ? 'bad' : 'good'}"><b>${esc(PL(res.target).name)}</b> ${res.wolf ? 'เป็นหมาป่า!' : 'ไม่ใช่หมาป่า'}</div><p class="hint">จำไว้ แล้วรอเช้า ห้ามบอกใครในตอนนี้</p>` : pick('nact', 'see', others, null)}</section>${seerNotes}`;
      } else if (role === 'guard') {
        main = `<section ${pp('panel', 1)}><h2>เลือกคนที่จะปกป้อง</h2><p class="hint">ถ้าหมาป่า (หรือนักล่า) เลือกคนนี้ เขาจะรอด (เลือกตัวเองได้)</p>${pick('nact', 'guard', w.players.filter((p) => p.alive), mine.guard)}${mine.guard ? okLine('เลือกแล้ว รอเช้า') : ''}</section>`;
      } else if (role === 'witch') {
        const wi = w.witch || {}, vics = [wi.victim, wi.victim2].filter(Boolean);
        if (wi.done) main = `<section ${pp('panel', 1)}><h2>คืนนี้คุณจัดการแล้ว</h2>${okLine('รอเช้า ห้ามบอกใคร')}</section>`;
        else if (wi.heal_used && wi.poison_used) main = `<section ${pp('panel', 1)}><h2>ยาหมดแล้ว</h2>${ig('m-sleep')}<p class="hint">คุณใช้ยาครบทั้งสองขวดแล้ว หลับตารอเช้าได้เลย</p></section>`;
        else main = `<section ${pp('panel', 1)}><h2>ยาของแม่มด</h2><p class="hint">${vics.length ? `คืนนี้หมาป่าเลือกกิน <b>${vics.map((v) => esc(PL(v).name)).join(' และ ')}</b>` : 'หมาป่ายังเลือกเหยื่อไม่เสร็จ รอสักครู่ (ถ้าจะชุบชีวิตต้องรอเห็นเหยื่อก่อน)'}</p>${!wi.heal_used ? (vics.length ? vics.map((v) => `<button class="btn mint block" data-act="nact" data-k="heal" data-id="${v}">ใช้ยาชุบชีวิตช่วย ${esc(PL(v).name)}</button>`).join('') : '<button class="btn mint block" disabled>ใช้ยาชุบชีวิต (รอเห็นเหยื่อก่อน)</button>') : '<p class="hint">ยาชุบชีวิตใช้ไปแล้ว</p>'}${!wi.poison_used ? `<h2>หรือใช้ยาพิษกับใคร?</h2>${pick('nact', 'poison', others, null)}` : '<p class="hint">ยาพิษใช้ไปแล้ว</p>'}<button class="btn ghost block" data-act="witchpass">คืนนี้ไม่ใช้ยา</button><p class="hint">คืนหนึ่งใช้ได้อย่างเดียว และใช้แต่ละขวดได้ครั้งเดียวตลอดเกม</p></section>`;
      } else if (role === 'hunter') {
        const cur = mine.shoot || w.shoot;
        main = `<section ${pp('panel', 1)}><h2>เลือกเป้าหมายที่จะยิง</h2><p class="hint">ถ้าคุณถูกกำจัดไม่ว่าด้วยวิธีใด จะยิงคนนี้ตายทันที${d1 ? '' : ' (เปลี่ยนเป้าได้ทุกคืน)'}</p>${pick('nact', 'shoot', others, cur)}${cur ? okLine('ตั้งเป้าแล้ว') : ''}${d1 && !mine.shoot && !mine.pass ? passBtn('ยังไม่เลือกตอนนี้') : ''}</section>`;
      } else if (role === 'cupid' && d1) {
        const nmOf = (id) => esc(PL(id).name);
        if (mine.love2 || mine.pass) main = `<section ${pp('panel', 1)}><h2>จับคู่เรียบร้อย</h2>${mine.love2 ? `<p class="hint">💘 <b>${nmOf(mine.love1)}</b> กับ <b>${nmOf(mine.love2)}</b> เป็นคู่รักกันแล้ว</p>` : '<p class="hint">คืนนี้คุณไม่จับคู่</p>'}${okLine('รอเช้า ห้ามบอกใคร')}</section>`;
        else if (mine.love1) main = `<section ${pp('panel', 1)}><h2>เลือกคู่รักคนที่ 2</h2><p class="hint">คนที่ 1: <b>${nmOf(mine.love1)}</b></p>${pick('nact', 'love2', w.players.filter((p) => p.alive && p.id !== mine.love1), null)}</section>`;
        else main = `<section ${pp('panel', 1)}><h2>เลือกคู่รักคนที่ 1</h2><p class="hint">เลือกผู้เล่น 2 คนให้เป็นคู่รัก (เลือกตัวเองได้) ถ้าคนหนึ่งตาย อีกคนตายตาม</p>${pick('nact', 'love1', w.players.filter((p) => p.alive), null)}${passBtn('ไม่จับคู่')}</section>`;
      } else if (role === 'littlegirl') {
        const res = (w.peeks || []).find((x) => x.day === w.day_no);
        main = `<section ${pp('panel', 1)}><h2>แอบดูหมาป่า</h2>${res ? `<div class="seerres bad"><b>${esc(PL(res.target).name)}</b> เป็นหมาป่า!</div><p class="hint">จำไว้ ถ้าโชคร้ายคุณอาจถูกจับได้ตอนเช้า รอเช้า ห้ามบอกใคร</p>` : mine.pass ? okLine('คืนนี้ไม่แอบดู รอเช้า') : `<p class="hint">แอบดูได้ 1 ครั้งต่อคืน จะรู้ชื่อหมาป่า 1 ตัว แต่มีโอกาสราว 1 ใน 3 ที่ถูกจับได้และตายตอนเช้า</p><button class="btn sun block" data-act="wnpeek">แอบดูเลย (เสี่ยง!)</button>${passBtn('คืนนี้ไม่แอบดู')}`}</section>${peekNotes}`;
      } else if (role === 'killer') {
        main = `<section ${pp('panel', 1)}><h2>เลือกคนที่จะฆ่า</h2><p class="hint">คุณเป็นฝ่ายอิสระ ฆ่าได้ทุกคืน ชนะเมื่อรอดเป็นคนสุดท้าย</p>${pick('nact', 'slay', others, mine.slay)}${mine.slay ? okLine('เลือกแล้ว รอเช้า (เปลี่ยนใจได้จนกว่าทุกคนทำเสร็จ)') : mine.pass ? okLine('คืนนี้ไม่ฆ่าใคร') : passBtn('คืนนี้ไม่ฆ่าใคร')}</section>`;
      } else if (role === 'thief' && d1) {
        main = `<section ${pp('panel', 1)}><h2>เลือกคนที่จะขโมยบทบาท</h2><p class="hint">คุณจะได้บทของเขาตอนเช้า และเขากลายเป็นชาวบ้าน</p>${mine.steal ? `<p class="hint ok">เลือกขโมยบทของ <b>${esc(PL(mine.steal).name)}</b> แล้ว รอเช้า</p>` : mine.pass ? okLine('คืนนี้ไม่ขโมย รอเช้า') : `${pick('nact', 'steal', others, null)}${passBtn('ไม่ขโมย')}`}</section>`;
      } else main = sleep;
      if (host) hostBtn = '<button class="btn ghost block" data-act="wskip">ข้ามคืนนี้เลย</button>';
    } else if (w.phase === 'day') {
      const ev = wlog(w, 'night', w.day_no), lv = w.day_no > 1 ? wlog(w, 'vote', w.day_no - 1) : null;
      const line = (d) => `<b>${esc(PL(d.p).name)}</b> ${WHY[d.why]}${roleName(w, d.p) ? ' · เป็น' + roleName(w, d.p) : ''}`;
      const nds = deaths(ev), vds = deaths(lv);
      const news = nds.length ? 'เมื่อคืน ' + nds.map(line).join(' · ') : 'เมื่อคืนไม่มีใครตาย';
      const vnews = lv ? (lv.idiot ? `${esc(PL(lv.idiot).name)} คือคนโง่ประจำหมู่บ้าน! รอดตายแต่เสียสิทธิ์โหวต` : vds.length ? vds.map((d) => `${esc(PL(d.p).name)} ${WHY[d.why]}`).join(' · ') : 'เสมอ ไม่มีใครถูกโหวตออก') : '';
      main = `<section ${pp('panel', 1)}><h2>เช้าแล้ว</h2><p class="newsline">${news}</p>${lv ? `<p class="hint">เมื่อวานโหวต: ${vnews}</p>` : ''}<p class="hint">ช่วยกันคุย ถามกัน หาคนที่ท่าทางแปลกๆ แล้วโหวตเมื่อหมดเวลา</p></section>${seerNotes}${peekNotes}`;
      if (host) hostBtn = '<button class="btn sun block" data-act="wskip">เริ่มโหวตเลย</button>';
    } else {
      if (!alive) main = `${dead}<p class="hint">โหวตแล้ว ${w.voted}/${w.need}</p>`;
      else if (w.revealed) main = `<section ${pp('panel', 1)}><h2>คุณเปิดไพ่แล้ว</h2><p class="hint">คุณคือคนโง่ประจำหมู่บ้าน ยังอยู่ในเกมแต่ไม่มีสิทธิ์โหวตแล้ว · โหวตแล้ว ${w.voted}/${w.need}</p></section>`;
      else main = `<section ${pp('panel', 1)}><h2>โหวตไล่ใครออก?</h2>${role === 'mayor' ? '<p class="hint">คุณเป็นผู้ใหญ่บ้าน โหวตของคุณนับ 2 เสียง</p>' : ''}${pick('wvote', 'vote', others, mine.vote)}<button class="btn ghost block" data-act="wvote" data-id="">${'vote' in mine && !mine.vote ? '✓ ' : ''}งดออกเสียง</button><p class="hint">โหวตแล้ว ${w.voted}/${w.need} · เปลี่ยนใจได้จนกว่าทุกคนจะโหวต</p></section>`;
      if (host) hostBtn = '<button class="btn ghost block" data-act="wskip">ปิดโหวตเลย</button>';
    }
    return `${top(tm)}<div class="split"><div class="stack lg"><h1 class="wtitle pop">${title}</h1>${main}${hostBtn}</div><div class="stack lg">${card}<section ${pp('panel', 2)}><h2>ผู้เล่น</h2>${roster}</section>${wolfChat(w)}${hostEnd()}</div></div>`;
  }


  /* ---------- ผู้ดำเนินเกม (โฮสต์ไม่เล่น เห็นทุกบท กดแทนผู้เล่นได้) ---------- */
  let mvoter = null, mlove = null;
  const MORDER = ['cupid', 'thief', 'seer', 'guard', 'witch', 'killer', 'hunter', 'littlegirl'];
  async function modRun(calls, fn = 'mg_wolf_mod_act') {
    let ok = false;
    for (const c of calls) { try { await call(fn, c); ok = true; } catch (e) { if (!ok) say(e.message); break; } }
    ping(); await refresh();
  }
  function modGame() {
    const w = S.wolf, acts = w.acts || [], hist = w.hist || [], alive = w.players.filter((p) => p.alive);
    const nm = (id) => esc(PL(id).name), rn = (id) => { const p = w.players.find((x) => x.id === id); return p && ROLE[p.role] ? ROLE[p.role].n : ''; };
    const roleOf = (id) => (w.players.find((x) => x.id === id) || {}).role;
    const title = w.phase === 'night' ? `กลางคืนที่ ${w.day_no}` : w.phase === 'day' ? `กลางวันที่ ${w.day_no}` : 'ลงคะแนนโหวต';
    const tm = w.phase_end ? `<div class="timerwrap"><span class="timer num" data-end="${w.phase_end}" data-total="${w.phase_secs * 1000}">${ig('timer')}<span data-t></span></span><div class="bar"><i data-bar></i></div></div>` : '';
    const pick = (act, kind, actor, list, chosen) => `<div class="pick">${list.map((p) => `<button class="pickbtn" data-act="${act}" data-k="${kind}" data-actor="${actor}" data-id="${p.id}" aria-pressed="${chosen === p.id}">${avatar(PL(p.id))}<span>${esc(PL(p.id).name)}<small>${ROLE[p.role] ? ROLE[p.role].n : ''}</small></span></button>`).join('')}</div>`;
    const okLine = (t) => `<p class="hint ok">${t}</p>`;
    const has = (actor, kind) => acts.some((a) => a.actor === actor && a.kind === kind);
    const tally = (kind) => { const c = {}; acts.filter((a) => a.kind === kind && a.target).forEach((a) => { c[a.target] = (c[a.target] || 0) + 1; }); return Object.entries(c).sort((x, y) => y[1] - x[1]); };
    const roster = `<ul class="plist">${w.players.map((p) => { const R = ROLE[p.role]; return `<li class="${p.alive ? '' : 'off'}">${R ? `<button class="rbtn thumbbtn" data-act="rinfo" data-v="${p.role}" aria-label="ดูรายละเอียด ${R.n}">${rcard(R.img, 'thumb', R.n)}</button>` : avatar(PL(p.id))}<span class="nm">${nm(p.id)}<br><span class="sub mute">${R ? R.n : ''}${p.lover ? ' · 💘 คู่รัก ' + nm(p.lover) : ''}</span></span>${p.alive ? `<span class="tag">${p.revealed ? 'เปิดไพ่' : 'ยังอยู่'}</span>` : '<span class="tag dead">ตาย</span>'}</li>`; }).join('')}</ul>`;
    const banner = `<section ${pp('panel', 0)}><h2>${ig('mascot-wave', 'sm')}คุณคือผู้ดำเนินเกม</h2><p class="hint">คุณเห็นบทของทุกคนและกดแทนผู้เล่นได้ บรรยายตามลำดับด้านล่าง ผู้เล่นที่มีมือถือกดเองก็ได้ ระบบนับให้ทั้งสองแบบ</p></section>`;
    let main = '', hostBtn = '';
    if (w.phase === 'night') {
      const wolves = alive.filter((p) => isW(p.role)), prey = alive.filter((p) => !isW(p.role));
      const needK = wolves.filter((p) => !has(p.id, 'kill')), needK2 = w.cub_double ? wolves.filter((p) => !has(p.id, 'kill2')) : [];
      const v1 = tally('kill').map(([id]) => id)[0], v2 = w.cub_double ? tally('kill2').map(([id]) => id)[0] : null;
      const wolfSec = needK.length || needK2.length
        ? `<section ${pp('panel', 1)}><h2>1) 🐺 ฝูงหมาป่าตื่น</h2><p class="hint">“หมาป่าลืมตา ชี้เหยื่อของคืนนี้” แล้วแตะคนที่ถูกชี้ (นับให้หมาป่าทุกตัว: ${wolves.map((p) => nm(p.id)).join(', ')})</p>${needK.length ? pick('mkill', 'kill', '', prey, v1) : okLine('เหยื่อคนที่ 1: <b>' + (v1 ? nm(v1) : '-') + '</b>')}${w.cub_double ? `<h2>ลูกหมาป่าตายไปแล้ว: เหยื่อคนที่ 2</h2>${needK2.length ? pick('mkill', 'kill2', '', prey.filter((p) => p.id !== v1), v2) : okLine('เหยื่อคนที่ 2: <b>' + (v2 ? nm(v2) : '-') + '</b>')}` : ''}</section>`
        : `<section ${pp('panel', 1)}><h2>1) 🐺 ฝูงหมาป่า</h2>${okLine('เลือกเหยื่อแล้ว: <b>' + [v1, v2].filter(Boolean).map(nm).join(' และ ') + '</b> · “หมาป่าหลับตา”')}</section>`;
      const pend = (w.pending || []).filter((x) => MORDER.includes(x.role)).sort((a, b) => MORDER.indexOf(a.role) - MORDER.indexOf(b.role));
      const ui = (x) => {
        const a = x.player, others = alive.filter((p) => p.id !== a), pass = (k = 'pass', t = 'ข้าม / ไม่ใช้') => `<button class="btn ghost block" data-act="mact" data-k="${k}" data-actor="${a}" data-id="">${t}</button>`;
        if (x.role === 'seer') return `<p class="hint">“หมอดูตื่น เลือกคนที่จะส่อง”</p>${pick('mact', 'see', a, others, null)}`;
        if (x.role === 'guard') return `<p class="hint">“ผู้คุ้มกันตื่น เลือกคนที่จะปกป้อง” (เลือกตัวเองได้)</p>${pick('mact', 'guard', a, alive, null)}`;
        if (x.role === 'witch') {
          const used = (k) => hist.some((h) => h.actor === a && h.kind === k), vics = [v1, v2].filter(Boolean);
          return `<p class="hint">“แม่มดตื่น ดูว่าหมาป่ากินใคร” เหยื่อคืนนี้: <b>${vics.length ? vics.map(nm).join(' และ ') : 'ยังไม่มี'}</b></p>${!used('heal') ? vics.map((v) => `<button class="btn mint block" data-act="mact" data-k="heal" data-actor="${a}" data-id="${v}">ใช้ยาชุบชีวิตช่วย ${nm(v)}</button>`).join('') : '<p class="hint">ยาชุบชีวิตใช้ไปแล้ว</p>'}${!used('poison') ? `<h2>หรือใช้ยาพิษ</h2>${pick('mact', 'poison', a, others, null)}` : '<p class="hint">ยาพิษใช้ไปแล้ว</p>'}${pass('witchpass', 'คืนนี้ไม่ใช้ยา')}`;
        }
        if (x.role === 'killer') return `<p class="hint">“นักล่าตื่น เลือกคนที่จะฆ่า”</p>${pick('mact', 'slay', a, others, null)}${pass('pass', 'คืนนี้ไม่ฆ่าใคร')}`;
        if (x.role === 'hunter') return `<p class="hint">“นายพรานตื่น เลือกเป้าที่จะยิงถ้าตัวเองตาย”</p>${pick('mact', 'shoot', a, others, null)}${pass('pass', 'ยังไม่เลือก')}`;
        if (x.role === 'thief') return `<p class="hint">“จอมโจรตื่น เลือกคนที่จะขโมยบท” (ได้บทของเขา เขากลายเป็นชาวบ้าน)</p>${pick('mact', 'steal', a, others, null)}${pass('pass', 'ไม่ขโมย')}`;
        if (x.role === 'littlegirl') return `<p class="hint">เด็กหญิงแอบดูได้ 1 ครั้ง (เสี่ยงถูกจับ 1 ใน 3)</p><button class="btn sun block" data-act="mact" data-k="peek" data-actor="${a}" data-id="">แอบดูเลย</button>${pass('pass', 'คืนนี้ไม่แอบดู')}`;
        if (x.role === 'cupid') return mlove && mlove.actor === a
          ? `<p class="hint">คนที่ 1: <b>${nm(mlove.id)}</b> · เลือกคนที่ 2</p>${pick('mlove2', 'love2', a, alive.filter((p) => p.id !== mlove.id), null)}`
          : `<p class="hint">“กามเทพตื่น เลือกคู่รัก 2 คน” (เลือกตัวเองได้)</p>${pick('mlove1', 'love1', a, alive, null)}${pass('pass', 'ไม่จับคู่')}`;
        return '';
      };
      const secs = pend.map((x, i) => `<section ${pp('panel modcard', 1)}><div class="row"><span class="rcwrap">${rcard(ROLE[x.role].img, 'thumb', ROLE[x.role].n)}</span><div><h2>${i + 2}) ${ROLE[x.role].n}</h2><span class="hint">${nm(x.player)}</span></div></div>${ui(x)}</section>`).join('');
      const SEE = (a) => { const t = roleOf(a.target); return `${rn(a.actor) || ''} ${nm(a.actor)} ส่อง ${nm(a.target)}: <b>${isW(t) ? 'หมาป่า' : 'ไม่ใช่หมาป่า'}</b>`; };
      const NOTE = { see: SEE, guard: (a) => `ผู้คุ้มกัน ${nm(a.actor)} ปกป้อง ${nm(a.target)}`, heal: (a) => `แม่มดชุบชีวิต ${nm(a.target)}`, poison: (a) => `แม่มดวางยา ${nm(a.target)}`, slay: (a) => `นักล่าเลือกฆ่า ${nm(a.target)}`, shoot: (a) => `นายพรานเล็ง ${nm(a.target)}`, love1: (a) => `คู่รักคนที่ 1: ${nm(a.target)}`, love2: (a) => `คู่รักคนที่ 2: ${nm(a.target)}`, steal: (a) => `จอมโจรขโมยบท ${nm(a.target)}`, peek: (a) => `เด็กหญิง ${nm(a.actor)} แอบดู (เห็นหมาป่า ${nm(a.target)})`, witchpass: (a) => `แม่มดไม่ใช้ยา`, pass: (a) => `${rn(a.actor)} ${nm(a.actor)} ข้ามคืนนี้` };
      const done = acts.filter((a) => NOTE[a.kind]).map((a) => `<li>${NOTE[a.kind](a)}</li>`).join('');
      const sum = done ? `<section class="panel"><h2>สิ่งที่เกิดขึ้นคืนนี้ (เห็นเฉพาะผู้ดำเนินเกม)</h2><ul class="recap">${done}</ul></section>` : '';
      main = `${wolfSec}${secs}${!needK.length && !needK2.length && !pend.length ? `<section ${pp('panel', 1)}><h2>ครบทุกบทแล้ว</h2>${okLine('“ทุกคนลืมตา เช้าแล้ว!” ระบบกำลังสรุปคืนนี้')}</section>` : ''}${sum}`;
      hostBtn = '<button class="btn ghost block" data-act="wskip">จบคืนนี้ / ข้ามไปเช้า</button>';
    } else if (w.phase === 'day') {
      const ev = wlog(w, 'night', w.day_no), lv = w.day_no > 1 ? wlog(w, 'vote', w.day_no - 1) : null;
      const line = (d) => `<b>${nm(d.p)}</b> ${WHY[d.why]}${rn(d.p) ? ' · เป็น' + rn(d.p) : ''}`;
      const nds = deaths(ev), vds = deaths(lv);
      const news = nds.length ? 'เมื่อคืน ' + nds.map(line).join(' · ') : 'เมื่อคืนไม่มีใครตาย';
      const vnews = lv ? (lv.idiot ? `${nm(lv.idiot)} คือคนโง่ประจำหมู่บ้าน! รอดตายแต่เสียสิทธิ์โหวต` : vds.length ? vds.map((d) => `${nm(d.p)} ${WHY[d.why]}`).join(' · ') : 'เสมอ ไม่มีใครถูกโหวตออก') : '';
      main = `<section ${pp('panel', 1)}><h2>เช้าแล้ว: ประกาศข่าว</h2><p class="newsline">${news}</p>${lv ? `<p class="hint">เมื่อวานโหวต: ${vnews}</p>` : ''}<p class="hint">“ทุกคนลืมตา” ให้ผู้เล่นคุยกัน แล้วกดเริ่มโหวตเมื่อพร้อม</p></section>`;
      hostBtn = '<button class="btn sun block" data-act="wskip">เริ่มโหวตเลย</button>';
    } else {
      const voters = alive.filter((p) => !p.revealed), votes = acts.filter((a) => a.kind === 'vote');
      const wt = {}; votes.forEach((a) => { if (a.target) wt[a.target] = (wt[a.target] || 0) + (roleOf(a.actor) === 'mayor' ? 2 : 1); });
      const rank = Object.entries(wt).sort((x, y) => y[1] - x[1]);
      const vtile = (p) => { const v = votes.find((a) => a.actor === p.id); return `<button class="pickbtn" data-act="mvsel" data-id="${p.id}" aria-pressed="${mvoter === p.id}">${avatar(PL(p.id))}<span>${nm(p.id)}<small>${v ? (v.target ? '→ ' + nm(v.target) : 'งดออกเสียง') : 'ยังไม่โหวต'}</small></span></button>`; };
      main = `<section ${pp('panel', 1)}><h2>บันทึกโหวต</h2><p class="hint">ให้ทุกคนชี้พร้อมกัน แล้วแตะ “คนโหวต” จากนั้นแตะ “คนที่ถูกโหวต” (ผู้ใหญ่บ้านนับ 2 เสียงอัตโนมัติ) · โหวตแล้ว ${w.voted}/${w.need}</p><div class="pick">${voters.map(vtile).join('')}</div>${mvoter ? `<h2>${nm(mvoter)} โหวตใคร?</h2>${pick('mvote', 'vote', mvoter, alive.filter((p) => p.id !== mvoter), null)}<button class="btn ghost block" data-act="mvote" data-id="">งดออกเสียง</button>` : ''}</section>${rank.length ? `<section class="panel"><h2>คะแนนตอนนี้</h2><ul class="glist">${rank.map(([id, c]) => `<li><span>${nm(id)}</span><b class="num">${c} เสียง</b></li>`).join('')}</ul></section>` : ''}`;
      hostBtn = '<button class="btn ghost block" data-act="wskip">ปิดโหวตเลย</button>';
    }
    return `${top(tm)}<div class="split"><div class="stack lg"><h1 class="wtitle pop">${title}</h1>${main}${hostBtn}</div><div class="stack lg">${banner}<section ${pp('panel', 2)}><h2>ผู้เล่นและบทบาท</h2>${roster}</section>${wolfChat(w)}${hostEnd()}</div></div>`;
  }

  function wolfOver() {
    const w = S.wolf, host = S.host === S.me;
    if (!w) return `${top()}<div class="say pop">${ig('m-run', 'bob')}<p>กำลังสรุปผล…</p></div>`;
    const won = !w.mod && !!w.winner && iWon(w);
    const head = ({ wolf: 'หมาป่าชนะ!', village: 'ชาวบ้านชนะ!', killer: 'นักล่าชนะ!', lovers: 'คู่รักชนะ!' })[w.winner] || 'โฮสต์จบเกม';
    const mood = won ? ig('banner-win', 'ban') + ig('m-win', 'big') : w.winner ? ig('banner-lose', 'ban') : ig('m-think', 'big');
    const teamImg = w.winner === 'wolf' ? 'team-wolf' : w.winner === 'village' ? 'team-village' : w.winner === 'killer' ? 'killer' : w.winner === 'lovers' ? 'cupid' : null;
    const rows = w.players.map((p) => ({ p, pl: PL(p.id) })).sort((a, b) => b.pl.score - a.pl.score).map(({ p, pl }, i) => `<li ${pp('', i + 2)}>${ROLE[p.role] ? `<button class="rbtn thumbbtn" data-act="rinfo" data-v="${p.role}" aria-label="ดูรายละเอียด ${ROLE[p.role].n}">${rcard(ROLE[p.role].img, 'thumb', ROLE[p.role].n)}</button>` : avatar(pl)}<span class="nm">${esc(pl.name)}${p.id === S.me ? ' <span class="mute">(คุณ)</span>' : ''}<br><span class="sub mute">${ROLE[p.role] ? ROLE[p.role].n : ''} · ${p.alive ? 'รอดถึงจบเกม' : 'ตายแล้ว'}</span></span><b class="num">${pl.score}</b></li>`).join('');
    const recap = w.log.filter((e) => e.t === 'night' || e.t === 'vote').map((e) => { const ds = deaths(e); const txt = ds.map((d) => `${esc(PL(d.p).name)} ${WHY[d.why]}`).join(' · '); return `<li>${e.t === 'night' ? `คืนที่ ${e.day}: ${txt || (e.saved ? 'มีคนช่วยเหยื่อไว้ได้ ไม่มีใครตาย' : 'ไม่มีใครตาย')}` : `วันที่ ${e.day}: ${e.idiot ? `${esc(PL(e.idiot).name)} คือคนโง่ประจำหมู่บ้าน รอดตายแต่เสียสิทธิ์โหวต` : txt || 'โหวตเสมอ ไม่มีใครถูกโหวตออก'}`}</li>`; }).join('');
    return `${top()}<div class="split"><div class="stack lg"><div class="winhero pop" style="--i:0">${won ? ig('trophy', 'tro') : ''}${mood}${teamImg ? rcard(teamImg, 'team', head) : ''}<p class="mute">${w.mod ? 'คุณเป็นผู้ดำเนินเกม' : 'คุณเป็น ' + (ROLE[w.role] ? ROLE[w.role].n : '')}</p>${ROLE[w.role] ? `<button class="rbtn" data-act="rinfo" data-v="${w.role}" aria-label="ดูรายละเอียด">${rcard(ROLE[w.role].img, 'big', ROLE[w.role].n)}</button>` : ''}<h1>${head}</h1></div>${recap ? `<section ${pp('panel', 1)}><h2>เกิดอะไรขึ้นบ้าง</h2><ul class="recap">${recap}</ul></section>` : ''}</div>
      <div class="stack lg"><section class="stack pop" style="--i:1"><h2>เฉลยบทบาท · คะแนนรวม</h2><ul class="plist">${rows}</ul></section>
      ${host ? `<div class="stack pop" style="--i:6"><button class="btn primary block" data-act="start">${ico('play')}เล่นรอบต่อไป</button><button class="btn ghost block" data-act="tolobby">ตั้งค่า / รอเพื่อนเพิ่ม</button></div>` : `<div ${pp('say', 6)}>${ig('mascot-wave')}<p>รอโฮสต์เริ่มรอบใหม่</p></div>`}</div></div>`;
  }

  /* ---------- จอแสดงคำ (ลิงก์ ?watch=รหัสห้อง) เข้าทีหลังได้ ไม่ต้องใส่ชื่อ ---------- */
  const watchCode = () => (new URLSearchParams(location.search).get('watch') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  const watchUrl = () => location.origin + location.pathname + '?watch=' + (S ? S.room : WATCH);
  function qrSvg(url) { try { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch { return ''; } }
  function watchPanel(guesserView) {
    if (!S) return '';
    return `<section ${pp('panel watchbox', 2)}><h2>${ig('question', 'sm')}จอแสดงคำให้เพื่อนดู</h2>
      <div class="wb-body"><div class="qr" role="img" aria-label="คิวอาร์โค้ดจอแสดงคำ">${qrSvg(watchUrl())}</div>
      <div class="stack"><p>${guesserView ? 'ส่งลิงก์ให้เพื่อน หรือเปิดบนไอแพดวางไว้ให้เพื่อนดูคำและรูป' : 'เปิดบนอีกเครื่อง (ไอแพด/มือถือเพื่อน) เพื่อโชว์คำและรูปให้ทุกคน ยกเว้นผู้ทาย เข้าทีหลังตอนไหนก็ได้ ไม่ต้องใส่ชื่อ'}</p>
      <button class="btn sun block" data-act="copywatch">${ico('link')}คัดลอกลิงก์จอแสดงคำ</button></div></div>
      ${guesserView ? '<p class="hint warn">อย่าเปิดจอนี้บนเครื่องที่คุณมองเห็นนะ จะเห็นเฉลย</p>' : ''}</section>`;
  }
  const W = { d: null, err: '', ch: null, busy: false };
  function startWatch(code) {
    WATCH = code; sess = null; S = null;
    document.body.classList.add('watching');
    document.title = 'จอแสดงคำ ' + code + ' · Let me ทาย';
    W.ch = sb.channel('mg:' + code).on('broadcast', { event: 'ping' }, () => watchPoll()).subscribe();
    watchRender(); watchPoll();
  }
  async function watchPoll() {
    if (!WATCH || W.busy) return; W.busy = true;
    try {
      const { data, error } = await sb.rpc('mg_watch', { p_room: WATCH }); if (error) throw new Error(error.message);
      offset = Date.parse(data.now) - Date.now(); const prev = W.d; W.d = data; W.err = ''; watchEvents(prev, data);
    } catch (e) { W.err = e.message; }
    finally { W.busy = false; watchRender(); }
  }
  function watchEvents(p, d) {
    if (!p || p.room !== d.room) return;
    if (d.status === 'playing' && (p.status !== 'playing' || p.round !== d.round)) FX.countdown({ title: `รอบที่ ${d.round}`, sub: d.guesser ? `${d.guesser} เป็นผู้ทาย` : '' });
    else if (d.state !== p.state && d.state === 'solved') { FX.play('win'); FX.cannons(); FX.flash('gold'); }
    else if (d.state !== p.state && d.state === 'gaveup') { FX.play('lose'); FX.flash('red'); }
  }
  function watchRender() {
    const d = W.d; let body;
    const board = d && d.players.length ? `<ul class="plist board">${d.players.map((p, i) => `<li><span class="rank num ${i === 0 && p.score > 0 ? 'first' : ''}">${i + 1}</span>${avatar(p)}<span class="nm">${esc(p.name)}</span><b class="num">${p.score}</b></li>`).join('')}</ul>` : '';
    if (W.err && !d) body = `<div class="say big">${ig('m-cry')}<p>${W.err === 'room_not_found' ? `ไม่พบห้อง ${WATCH} ลองเช็กรหัสอีกที` : 'เชื่อมต่อไม่ได้ กำลังลองใหม่…'}</p></div>`;
    else if (!d) body = `<div class="say big">${ig('m-run', 'bob')}<p>กำลังต่อจอ…</p></div>`;
    else if (d.game !== 'solo') body = `<div class="say big">${ig('m-cool')}<p>ห้อง ${d.room} กำลังเล่น <b>${GAMES[d.game].name}</b> คำเป็นความลับ จอแสดงคำใช้ได้เฉพาะโหมด 1 คนทาย</p></div>${board}`;
    else if (d.status === 'lobby' || !d.word) body = `<div class="say big">${ig('m-sleep')}<p>รอโฮสต์เริ่มเกม แล้วคำจะขึ้นที่จอนี้</p></div>${board}`;
    else {
      const fin = d.status === 'over', ok = d.state === 'solved';
      const timer = d.ends_at && !fin ? `<div class="timerwrap"><span class="timer num" data-end="${d.ends_at}" data-total="${d.minutes * 60000}">${ig('timer')}<span data-t></span></span><div class="bar"><i data-bar></i></div></div>` : '';
      body = `<div class="wtop">${d.category ? `<span class="catpill">หมวด <b>${esc(d.category)}</b></span>` : ''}${timer}</div>
        <div class="wcard ${fin ? (ok ? 'win' : 'dead') : ''}">${fin ? ig(ok ? 'banner-win' : 'banner-lose', 'wban') : ''}<span class="wlabel">${fin ? (ok ? `${esc(d.guesser)} ทายถูก!` : `${esc(d.guesser)} ทายไม่ออก · เฉลยคือ`) : `${esc(d.guesser)} กำลังทาย · ห้ามให้ผู้ทายเห็นจอนี้`}</span>${pic(d.emoji, 'xl wpic')}<span class="wword">${esc(d.word)}</span></div>
        ${!fin && d.accept ? `<section class="near wnear"><h2>${ig('check', 'sm')}ให้ผ่าน · กดถ้าวงยอมรับคำที่ ${esc(d.guesser)} ทาย</h2>${d.guesses && d.guesses.length ? `<ul class="glist">${d.guesses.map((x) => `<li><span class="gword">${esc(x.text)}</span><button class="btn mint sm" data-act="wacceptg" data-id="${x.id}" data-t="${esc(x.text)}">${ig('check')}ยอมรับ</button></li>`).join('')}</ul>` : ''}<button class="btn mint block" data-act="wpass">${ig('check')}ให้ผ่าน</button></section>` : ''} ${fin ? board : ''}`;
    }
    const html = `<div class="wrap-watch"><div class="wbar"><span class="roomcode">${WATCH}</span><span class="wname">จอแสดงคำ</span><a class="btn ghost sm" href="${location.pathname}">หน้าแรก</a></div>${body}</div>`;
    if (html === last) return; last = html; fired = false; $('#app').innerHTML = html; tick();
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
    watch() { const c = ($('#code').value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); if (c.length < 4) return say('ใส่รหัสห้อง 4 ตัวก่อนนะ'); location.href = location.pathname + '?watch=' + c; },
    async copywatch() { const u = watchUrl(); try { await navigator.clipboard.writeText(u); say('คัดลอกลิงก์จอแสดงคำแล้ว'); } catch { say(u); } },
    async leave() { if (!confirm('ออกจากห้องนี้?')) return; try { await call('mg_leave'); ping(); } catch {} leaveLocal(); },
    game(t) { const v = t.dataset.v; patch(v, { cats: [], mode: v !== 'head' && S.settings.mode === 'chaos' ? 'all' : S.settings.mode }); }, mode(t) { patch(null, { mode: t.dataset.v }); },
    lvl(t) { const l = toggle(S.settings.levels, +t.dataset.v); if (l.length) patch(null, { levels: l }); },
    cat(t) { patch(null, { cats: toggle(S.settings.cats, t.dataset.v) }); },
    mins(t) { patch(null, { minutes: +t.dataset.v }); }, reveal() { patch(null, { reveal: !S.settings.reveal }); }, accept_mode() { patch(null, { accept: !S.settings.accept }); },
    passg() { if (confirm('วงคนให้คำใบ้ยอมรับแล้ว ให้ผู้ทายผ่านรอบนี้?')) act('mg_pass'); }, async wpass() { if (!confirm('วงคนให้คำใบ้ยอมรับแล้ว ให้ผู้ทายผ่านรอบนี้?')) return; try { const { error } = await sb.rpc('mg_watch_pass', { p_room: WATCH }); if (error) throw new Error(error.message); ping(); } catch (e) { say(e.message); } watchPoll(); },
    acceptg(t) { if (confirm(`ยอมรับคำว่า "${t.dataset.t}" ให้ผ่าน?`)) act('mg_accept', { p_guess: +t.dataset.id }); }, async wacceptg(t) { if (!confirm(`ยอมรับคำว่า "${t.dataset.t}" ให้ผ่าน?`)) return; try { const { error } = await sb.rpc('mg_watch_accept', { p_room: WATCH, p_guess: +t.dataset.id }); if (error) throw new Error(error.message); ping(); } catch (e) { say(e.message); } watchPoll(); },
    wolfhide() { wolfHide = !wolfHide; last = ''; render(); },
    wrole(t) { const cur = S.settings.wolf || {}, n = S.players.length, base = Array.isArray(cur.roles) ? cur.roles : (Math.max(n, 5) >= 6 ? ['seer', 'guard', 'cub'] : ['seer', 'cub']), v = t.dataset.v; patch(null, { wolf: { ...cur, roles: base.includes(v) ? base.filter((x) => x !== v) : [...base, v] } }); },
    wwolves(t) { patch(null, { wolf: { ...(S.settings.wolf || {}), wolves: +t.dataset.v } }); },
    rinfo(t) { rvBack = t.dataset.from === 'all'; rv = t.dataset.v; roleSheet(); },
    rall() { rv = 'all'; roleSheet(); },
    rclose() { rv = null; roleSheet(); },
    wnpass() { FX.play('click'); act('mg_wolf_act', { p_kind: 'pass', p_target: null }); },
    wnpeek() { if (!confirm('แอบดูหมาป่า? มีโอกาสราว 1 ใน 3 ที่จะถูกจับได้')) return; FX.play('click'); act('mg_wolf_act', { p_kind: 'peek', p_target: null }); },
    witchpass() { FX.play('click'); act('mg_wolf_act', { p_kind: 'witchpass', p_target: null }); },
    wknow() { const cur = S.settings.wolf || {}; patch(null, { wolf: { ...cur, know: cur.know === false } }); },
    wfmt(t) { const cur = S.settings.wolf || {}, live = t.dataset.v === 'live'; patch(null, { wolf: { ...cur, mod: live, know: !live } }); },
    wmod() { const cur = S.settings.wolf || {}; patch(null, { wolf: { ...cur, mod: !cur.mod } }); },
    mact(t) { const k = t.dataset.k, id = t.dataset.id || null, ask = { see: 'ส่อง', heal: 'ใช้ยาชุบชีวิตช่วย', poison: 'ใช้ยาพิษกับ', steal: 'ขโมยบทของ', peek: 'ให้เด็กหญิงแอบดู (เสี่ยงถูกจับ 1 ใน 3)', slay: 'ให้ฆ่า', shoot: 'ให้ยิง' }[k]; if (ask && !confirm(`${ask}${id ? ' ' + PL(id).name : ''}?`)) return; FX.play('click'); modRun([{ p_actor: t.dataset.actor, p_kind: k, p_target: id }]); },
    mkill(t) { const k = t.dataset.k, tg = t.dataset.id, ws = (S.wolf.players || []).filter((p) => p.alive && isW(p.role) && !(S.wolf.acts || []).some((a) => a.actor === p.id && a.kind === k)); FX.play('click'); modRun(ws.map((p) => ({ p_actor: p.id, p_kind: k, p_target: tg }))); },
    mlove1(t) { mlove = { actor: t.dataset.actor, id: t.dataset.id }; FX.play('click'); render(); },
    mlove2(t) { const a = mlove; mlove = null; if (!a) return; FX.play('click'); modRun([{ p_actor: a.actor, p_kind: 'love1', p_target: a.id }, { p_actor: a.actor, p_kind: 'love2', p_target: t.dataset.id }]); },
    mvsel(t) { mvoter = mvoter === t.dataset.id ? null : t.dataset.id; render(); },
    mvote(t) { const v = mvoter; if (!v) return; mvoter = null; FX.play('vote'); modRun([{ p_actor: v, p_target: t.dataset.id || null }], 'mg_wolf_mod_vote'); },
    wday(t) { patch(null, { wolf: { ...(S.settings.wolf || {}), day: +t.dataset.v } }); },
    wreveal() { const cur = S.settings.wolf || {}; patch(null, { wolf: { ...cur, reveal: cur.reveal === false } }); },
    nact(t) { const k = t.dataset.k, ask = { see: 'เลือกส่อง', heal: 'ใช้ยาชุบชีวิตช่วย', poison: 'ใช้ยาพิษกับ', steal: 'ขโมยบทบาทของ' }[k]; if (ask && !confirm(`${ask} ${PL(t.dataset.id).name}?`)) return; FX.play('click'); act('mg_wolf_act', { p_kind: k, p_target: t.dataset.id }); },
    async wsay() {
      const el = document.getElementById('wcmsg'); if (!el) return; const text = el.value.trim(); if (!text) return;
      el.value = ''; try { await call('mg_wolf_chat_send', { p_ch: el.dataset.ch, p_text: text }); ping(); } catch (e) { el.value = text; say(e.message); }
      await refresh(); const n = document.getElementById('wcmsg'); if (n) n.focus();
    },
    wvote(t) { FX.play('vote'); act('mg_wolf_vote', { p_target: t.dataset.id || null }); },
    wskip() { if (confirm('ข้ามไปช่วงถัดไปเลย?')) act('mg_wolf_skip'); },
    start() { act('mg_start'); }, end() { act('mg_end'); }, tolobby() { act('mg_lobby'); },
    accuse(t) { act('mg_accuse', { p_target: t.dataset.id }); },
    vote(t) { FX.play('vote'); act('mg_vote', { p_claim: +t.dataset.id, p_yes: t.dataset.v === '1' }); },
    async guess() {
      const i = $('#guess'); if (!i || !i.value.trim()) return;
      try {
        const ok = await call('mg_guess', { p_guess: i.value }); i.value = ''; ping();
        if (!ok) { FX.play('wrong'); FX.vib(60); FX.shake($('.guessrow')); FX.peek('m-shock'); FX.banner(S && S.game === 'solo' && S.settings.accept === true ? 'ยังไม่ตรงเป๊ะ ถ้าใกล้เคียง เพื่อนกดยอมรับให้ได้' : 'ยังไม่ใช่ ถามเพื่อนเพิ่มนะ', 'mascot-shock'); }
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
    if (e.key === 'Escape' && rv) { rv = null; return roleSheet(); }
    if (e.key === 'Escape' && N.open) return noteOpen(false);
    if (e.key !== 'Enter') return;
    if (e.target.id === 'guess') A.guess(); else if (e.target.id === 'code') A.join(); else if (e.target.id === 'ntext') noteAdd(); else if (e.target.id === 'wcmsg') A.wsay();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (sess && !WATCH && !document.hidden) refresh(); if (WATCH && !document.hidden) watchPoll(); }, 2500);
  setInterval(tick, 500);

  setInterval(() => { if (S && S.game === 'wolf' && S.status === 'playing' && !document.hidden) refresh(); }, 6000);
  /* ปุ่มเลื่อนขึ้น/ลง */ (() => { const box = document.createElement('div'); box.id = 'scrollbtns'; box.hidden = true; box.innerHTML = '<button type="button" id="goup" aria-label="เลื่อนขึ้นบนสุด">▲</button><button type="button" id="godown" aria-label="เลื่อนลงล่างสุด">▼</button>'; document.body.appendChild(box); const de = document.documentElement; const upd = () => { const max = de.scrollHeight - innerHeight, y = scrollY; box.hidden = max < innerHeight * 0.35; $('#goup').style.visibility = y > 120 ? 'visible' : 'hidden'; $('#godown').style.visibility = y < max - 120 ? 'visible' : 'hidden'; }; $('#goup').onclick = () => scrollTo({ top: 0, behavior: 'smooth' }); $('#godown').onclick = () => scrollTo({ top: de.scrollHeight, behavior: 'smooth' }); addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); new MutationObserver(upd).observe($('#app'), { childList: true, subtree: true }); upd(); })(); const q = inviteCode(), wc = watchCode();
  if (wc) startWatch(wc);
  else {
    if (q && sess && sess.room !== q) { sess = null; sv('mg.sess', null); }
    if (sess) enter(sess); else render();
  }
})();
