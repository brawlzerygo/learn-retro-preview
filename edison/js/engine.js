/* Learn Edison rules engine (2026-11-20).
 A full Edison duel as one coroutine: the game runs until it needs a decision, then stops on a prompt
 ({p, type, text, opts, min, max}); E.act(g, keys) answers it and the game runs on to the next prompt.
 Every answer is recorded in g.history, and the duel is deterministic from its seed, so E.clone(g) rebuilds
 any position by replaying the answers. The computer uses that to try lines, and online play can later run
 the same code on a server.

 Rules: the April 2010 rules (see the site's Rules page): the first player draws, no Battle Phase on turn 1,
 chains with Spell Speed, priority, costs and targets, Trigger Effects on one chain in SEGOC order, optional
 "When ... you can" effects missing the timing, summon negation windows, the Damage Step in its steps.
 Card effects are scripted in SCRIPTS by card name; a card without a script plays as a vanilla monster, and a
 Spell or Trap without one can only be Set. E.scripted(name) says whether a card is automated.

 Known simplifications (2026-11-20): one Field Spell per player zone (none in the automated decks); phase
 response windows are offered to the opponent at the start of the Battle Phase and in the End Phase, plus
 after every summon, attack and activation. */
(function (root) {
'use strict';
const E = {};
let DATA = new Map(), BYNAME = new Map();
/* Formats (2026-11-24, for Learn Retro Play): the same core plays Edison and Goat. E.init(cards, {format}) picks the card pool's
 format; E.addScripts(obj, 'goat') adds scripts that only Goat uses (a card whose 2005 behavior differs, or a card Edison never needed),
 and they win over the shared SCRIPTS while that format is loaded. Edison (the default) is unchanged. */
let FMT = 'edison'; const FSCRIPTS = {};
let CARDLIST = [];
E.init = (cards, opts = {}) => {
  FMT = opts.format || 'edison'; CARDLIST = cards;
  DATA = new Map(); BYNAME = new Map();
  for (const c of cards) { DATA.set(c.id, c); BYNAME.set(c.n, c); }
  for (const t of TOKENS) { DATA.set(t.id, t); BYNAME.set(t.n, t); }
};
const TOKENS = [
  { id: 'tok-sheep', n: 'Sheep Token', k: 'token', a: 'EARTH', r: 'Beast', lv: 1, atk: '0', def: '0' },
  { id: 'tok-gorz', n: 'Emissary of Darkness Token', k: 'token', a: 'LIGHT', r: 'Fairy', lv: 7, atk: '0', def: '0' },
];
const num = v => { const x = parseInt(v, 10); return isNaN(x) ? 0 : x; };
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
class Over { constructor() { this.over = true; } }

/* ---------- card facts ---------- */
const D = c => DATA.get(c.id);
const isMonD = d => d && !['spell', 'trap'].includes(d.k);
const isExtraD = d => d && (d.k === 'synchro' || d.k === 'fusion');
const isSpell = c => D(c).k === 'spell', isTrap = c => D(c).k === 'trap', isST = c => isSpell(c) || isTrap(c);
const isMon = c => isMonD(D(c));
const onField = c => c.zone === 'm' || c.zone === 'st' || c.zone === 'fz';
const faceUp = c => onField(c) && c.pos !== 'set';
const SC = c => (FMT !== 'edison' && FSCRIPTS[FMT] && FSCRIPTS[FMT][D(c).n]) || SCRIPTS[D(c).n] || null;
function name(c) { const d = D(c); if (onField(c) && faceUp(c)) { if (d.n === 'Dupe Frog' && !c.flags.negated) return 'Des Frog'; } return d.n; }
const isBW = c => /^Blackwing/.test(name(c));
const isFrog = c => /Frog/.test(name(c));
const isHERO = c => /HERO/.test(name(c));
const isEHERO = c => /^Elemental HERO/.test(name(c));
const attr = c => D(c).a || '';
const race = c => D(c).r || '';
function lv(c) { if (c.flags.lv) return c.flags.lv; return num(D(c).lv); }
function baseAtk(c) { if (c.flags.baseAtk != null) return c.flags.baseAtk; return num(D(c).atk); }
/* ---------- static effects (scripts' "self" and "cont") ----------
 A script can describe what is always true while its card is face-up:
   self: { piercing, directAttack, noBattleDestroy, noEffectDestroy, cantAttack, noAttackTarget, noBattleDamage,
           cantBeTargeted, unaffectedSpells, unaffectedTraps, atk(g,c), def(g,c) }  (each a value or a function (g,c))
   cont: { atk(g,src,c), def(g,src,c), grant(g,src,c,flag), forbid(g,src,action), dmg(g,src,p,n,o), negates(g,src,c), loc }
 cont works from the field (face-up), or from cont.loc ('gy'/'hand') when set. forbid() blocks actions:
 {type:'activate',c,eff,p}, {type:'ns',c,p}, {type:'set',c,p}, {type:'ss',c,p,how}, {type:'search',p}, {type:'attack',c},
 {type:'setST',c,p}, {type:'draw',p}, {type:'pos',c}. Temporary rules (g.rules) use the same forbid shape. */
function statics(g) {
  if (g._st && g._st.seq === g.seq && g._st.turn === g.turnNo) return g._st.list;
  const out = [];
  for (const c of allField(g)) { if (!faceUp(c)) continue; const sc = SC(c); if (sc && sc.cont && !sc.cont.loc && !(isMon(c) && c.flags.negated)) out.push([c, sc.cont]); }
  for (const P of g.p) for (const z of ['gy', 'hand']) for (const c of P[z]) { const sc = SC(c); if (sc && sc.cont && sc.cont.loc === z) out.push([c, sc.cont]); }
  g._st = { seq: g.seq, turn: g.turnNo, list: out };
  return out;
}
let NEGDEPTH = 0;
function negd(g, c) { // is this card's effect negated right now?
  if (c.flags.negated) return true;
  if (NEGDEPTH > 2) return false; NEGDEPTH++;
  try { for (const [s, ct] of statics(g)) if (ct.negates && s !== c && ct.negates(g, s, c)) return true; } finally { NEGDEPTH--; }
  return false;
}
function has(g, c, flag) {
  const sc = SC(c);
  if (sc && sc.self && sc.self[flag] != null && onField(c) && faceUp(c) && !negd(g, c)) { const v = sc.self[flag]; if (typeof v === 'function' ? v(g, c) : v) return true; }
  if (c.flags[flag]) return true;
  for (const [s, ct] of statics(g)) if (ct.grant && ct.grant(g, s, c, flag)) return true;
  return false;
}
function forbid(g, a) {
  for (const [s, ct] of statics(g)) if (ct.forbid && ct.forbid(g, s, a)) return true;
  for (const r of g.rules) if (r.forbid(g, a)) return true;
  return false;
}
function stat(g, c, which) { // current ATK or DEF
  const d = D(c); let v = which === 'atk' ? baseAtk(c) : num(d.def);
  if (c.flags.tokAtk != null) v = c.flags.tokAtk;
  if (!onField(c) || !faceUp(c) || c.zone !== 'm') return v;
  const nm = d.n, neg = negd(g, c);
  const sc = SC(c); if (!neg && sc && sc.self && sc.self[which]) v += sc.self[which](g, c) || 0;
  for (const [s, ct] of statics(g)) if (ct[which]) v += ct[which](g, s, c) || 0;
  if (!neg) {
    if (nm === 'Colossal Fighter' && which === 'atk') v += 100 * allCards(g, 'gy').filter(x => isMon(x) && race(x) === 'Warrior').length;
    if (nm === 'Elemental HERO Absolute Zero' && which === 'atk') v += 500 * fieldMons(g).filter(x => x !== c && faceUp(x) && attr(x) === 'WATER').length;
    if (nm === 'Tragoedia') v += 600 * g.p[c.ctrl].hand.length;
  }
  for (const s of g.p[c.ctrl].st) if (s && s.equipTo === c.u && D(s).n === 'Armory Arm' && which === 'atk') v += 1000;
  for (const m of c.mods) { if (m.set != null && (m.which === which || m.which === 'both')) v = m.set; else if (m[which]) v += m[which]; }
  return Math.max(0, v);
}
E.atk = (g, c) => stat(g, c, 'atk'); E.def = (g, c) => stat(g, c, 'def');
E.name = name; E.data = D; E.lv = lv; E.onField = onField;

/* ---------- zones ---------- */
function allCards(g, zone) { const out = []; for (const P of g.p) { const a = P[zone]; if (Array.isArray(a)) for (const c of a) if (c) out.push(c); else if (a) out.push(a); } return out; }
const fieldMons = g => [...g.p[0].m, ...g.p[1].m].filter(Boolean);
const monsOf = (g, p) => g.p[p].m.filter(Boolean);
const stOf = (g, p) => [...g.p[p].st.filter(Boolean), ...(g.p[p].fz ? [g.p[p].fz] : [])];
const fieldOf = (g, p) => [...monsOf(g, p), ...stOf(g, p)];
const allField = g => [...fieldOf(g, 0), ...fieldOf(g, 1)];
const freeM = (g, p) => g.p[p].m.findIndex(z => !z);
const freeST = (g, p) => g.p[p].st.findIndex(z => !z);
const nFreeM = (g, p) => g.p[p].m.filter(z => !z).length;
E.fieldOf = fieldOf; E.monsOf = monsOf;

function mk(g, id, owner) { return { u: g.nextU++, id, owner, ctrl: owner, zone: 'deck', pos: null, mods: [], flags: {}, used: {}, attacks: 0 }; }
function detach(g, c) {
  if (c.zone === 'm' || c.zone === 'st') { const a = g.p[c.ctrl][c.zone]; const i = a.indexOf(c); if (i >= 0) a[i] = null; }
  else if (c.zone === 'fz') { if (g.p[c.ctrl].fz === c) g.p[c.ctrl].fz = null; }
  else if (g.p[c.owner][c.zone]) { const a = g.p[c.owner][c.zone]; const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); }
}
function snap(g, c) { return { name: name(c), atk: onField(c) ? stat(g, c, 'atk') : baseAtk(c), def: onField(c) ? stat(g, c, 'def') : num(D(c).def), attr: attr(c), lv: lv(c), race: race(c), pos: c.pos, ctrl: c.ctrl, faceUp: faceUp(c), mon: isMon(c), flags: c.flags }; }
/* Move a card. to: hand, deck (shuffled in), deckTop, gy, ban, extra, m, st, fz. o: {reason, by (player), destroyed, battle, killer, ctrl, pos, zi, group, faceDown} */
function move(g, c, to, o = {}) {
  if (to === 'hand' && !o._hw) { const r = move(g, c, to, { ...o, _hw: true }); handWin(g, c.owner); return r; }
  const from = c.zone, wasField = onField(c), s = wasField ? snap(g, c) : null, prevCtrl = c.ctrl;
  if (from === 'gone') return null;
  if (wasField && c.flags.banishOnLeave && to !== 'ban' && to !== 'm') to = 'ban';
  if (wasField && D(c).k === 'token' && to !== 'm') { detach(g, c); c.zone = 'gone'; emit(g, { type: 'move', c, from, to: 'gone', wasField, snap: s, prevCtrl, ...o }, o.group); return null; }
  if (wasField && isExtraD(D(c)) && ['hand', 'deck', 'deckTop'].includes(to)) to = 'extra';
  detach(g, c);
  if (wasField && to !== 'm') {
    // equips on it go to the GY; its own equip link ends
    for (const P of g.p) for (const x of P.st) if (x && x.equipTo === c.u) { x.equipTo = null; g.later.push(x); }
    for (const x of allField(g)) if (x.linkTo === c.u) { x.linkTo = null; g.laterDestroy.push(x); }
    if (c.linkTo) { const t = allField(g).find(x => x.u === c.linkTo); if (t) g.laterDestroy.push(t); }
    c.mods = []; c.flags = {}; c.attacks = 0; c.equipTo = null; c.linkTo = null; c.ctr = {};
  }
  if (to === 'm' || to === 'st' || to === 'fz') {
    const P = g.p[o.ctrl != null ? o.ctrl : c.owner]; c.ctrl = o.ctrl != null ? o.ctrl : c.owner;
    if (to === 'fz') P.fz = c; else {
      // zone: an effect's own pick, else the zone the player chose in the client (E.act's hint), else the first free one
      let i = o.zi != null && !P[to][o.zi] ? o.zi : -1;
      if (i < 0 && g.pz && g.pz.u === c.u && g.pz.to === to && g.pz.zi >= 0 && g.pz.zi < 5 && !P[to][g.pz.zi]) { i = g.pz.zi; g.pz = null; }
      if (i < 0) i = P[to].findIndex(z => !z);
      P[to][i] = c;
    }
    c.pos = o.pos || (to === 'm' ? 'atk' : 'up'); c.zone = to; c.turnIn = g.turnNo; c.posChanged = false;
  } else {
    c.ctrl = c.owner; c.pos = null; c.zone = to === 'deckTop' ? 'deck' : to;
    const P = g.p[c.owner];
    if (to === 'deckTop') P.deck.push(c);
    else if (to === 'deck') { P.deck.push(c); shuffleDeck(g, c.owner); }
    else P[to].push(c);
  }
  const ev = emit(g, { type: 'move', c, from, to, wasField, snap: s, prevCtrl, ...o }, o.group);
  if (!o.noLater) flushLater(g, ev.group);
  return ev;
}
function flushLater(g, group) {
  for (let i = 0; i < 6 && (g.later.length || g.laterDestroy.length); i++) {
    const l = g.later; g.later = []; for (const x of l) if (onField(x)) move(g, x, 'gy', { reason: 'rule', group, noLater: true });
    const d = g.laterDestroy; g.laterDestroy = []; for (const x of d) if (onField(x)) move(g, x, 'gy', { reason: 'effect', destroyed: true, group, noLater: true });
  }
}
function shuffleDeck(g, p) { const a = g.p[p].deck; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(g.rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }

/* ---------- events and triggers ---------- */
function beginOp(g) { g.group++; g.sw = null; }
function emit(g, ev, group) {
  ev.group = group != null ? group : g.group; ev.seq = ++g.seq; ev.turn = g.turnNo; ev.phase = g.phase;
  if (ev.type === 'summon') g.summoned[ev.p] = true;
  g.events.push(ev); if (g.events.length > 120) g.events.splice(0, 40);
  if (g.hooks) g.hooks.ev(g, ev); // a client watching the live duel (Learn Retro Play); clones and tests have none
  // collect triggers from every card that can see it
  for (const P of g.p) for (const z of ['m', 'st', 'fz', 'hand', 'gy', 'ban', 'deck', 'extra']) {
    const arr = z === 'fz' ? (P.fz ? [P.fz] : []) : P[z]; if (!arr) continue;
    for (const c of arr) {
      if (!c) continue; const sc = SC(c); if (!sc || !sc.effs) continue;
      sc.effs.forEach((eff, ei) => {
        if (eff.type !== 'trig') return;
        const loc = eff.loc || 'm';
        if (loc === 'any' ? false : loc === 'm' ? c.zone !== 'm' || !faceUp(c) && !eff.faceDownOk : loc !== c.zone || ((loc === 'st' || loc === 'fz') && !faceUp(c))) return;
        if (loc === 'm' && negd(g, c)) return;
        try { if (eff.on(g, ev, c)) g.pend.push({ c, eff, ei, ev, p: onField(c) ? c.ctrl : c.owner }); } catch (e) { throw e; }
      });
    }
  }
  return ev;
}
const lastGroup = g => g.events.length ? g.events[g.events.length - 1].group : -1;

/* ---------- logging ---------- */
function log(g, t) { if (g.quiet) return; g.log.push(t); if (g.log.length > 300) g.log.splice(0, 100); }
const PN = (g, p) => g.cfg.names ? g.cfg.names[p] : 'Player ' + (p + 1);
const shown = (g, c) => (c.zone === 'm' || c.zone === 'st') && c.pos === 'set' ? 'a face-down card' : name(c);

/* ---------- prompts ---------- */
function* ask(g, p, type, text, opts, min = 1, max = 1, extra = {}) {
  if (!opts.length) return [];
  if (type === 'pick' && min >= opts.length && max >= opts.length && !extra.always) return opts.map(o => o.key);
  const r = yield { p, type, text, opts, min: Math.min(min, opts.length), max: Math.min(max, opts.length), ...extra };
  return r;
}
function* pick(g, p, text, cards, min = 1, max = 1, hint) {
  if (!cards.length) return [];
  const r = yield* ask(g, p, 'pick', text, cards.map(c => ({ key: 'u' + c.u, u: c.u, label: shown(g, c) === 'a face-down card' && c.ctrl !== p ? 'Face-down card' : name(c) })), min, max, { hint });
  return r.map(k => cards.find(c => 'u' + c.u === k)).filter(Boolean);
}
function* yn(g, p, text) { const r = yield* ask(g, p, 'yesno', text, [{ key: 'y', label: 'Yes' }, { key: 'n', label: 'No' }]); return r[0] === 'y'; }
function* choose(g, p, text, labels) { const r = yield* ask(g, p, 'choose', text, labels.map((l, i) => ({ key: 'c' + i, label: l }))); return +r[0].slice(1); }

/* ---------- life points, drawing, moving by effects ---------- */
function checkLP(g) {
  const a = g.p[0].lp <= 0, b = g.p[1].lp <= 0;
  if (a || b) { g.p[0].lp = Math.max(0, g.p[0].lp); g.p[1].lp = Math.max(0, g.p[1].lp); g.winner = a && b ? -1 : a ? 1 : 0; g.why = a && b ? 'Both players hit 0 LP' : `${PN(g, a ? 0 : 1)} hit 0 LP`; log(g, g.why + '.'); throw new Over(); }
}
function damage(g, p, n, o = {}) {
  for (const [s, ct] of statics(g)) if (ct.dmg) { const r = ct.dmg(g, s, p, n, o); if (r && r.gain) { gain(g, p, r.gain); return 0; } if (typeof r === 'number') n = r; }
  if (n <= 0) return 0; g.p[p].lp -= n;
  log(g, `${PN(g, p)} took ${n} ${o.battle ? 'battle ' : ''}damage.`);
  emit(g, { type: 'damage', p, n, battle: !!o.battle, src: o.src, srcP: o.srcP, direct: !!o.direct });
  checkLP(g); return n;
}
// a card that wins the duel (Exodia, Destiny Board): p wins, why says how (Classic cards, 2026-11-25)
// "you win when you have all of these in your hand": a script's self.handWin(g, c, p) on any card in that hand
function handWin(g, p) { if (g.p[p].lp <= 0) return; for (const x of g.p[p].hand) { const sc = SC(x); if (sc && sc.self && sc.self.handWin && sc.self.handWin(g, x, p)) winDuel(g, p, `${PN(g, p)} won with ${D(x).n}`); } }
function winDuel(g, p, why) { g.winner = p; g.why = why; log(g, why + '.'); throw new Over(); }
// coin tosses and dice rolls, from the duel's own seeded random (replays and the computer's copies stay the same)
function coin(g, p) { const h = g.rnd() < 0.5; log(g, `${PN(g, p)} tossed a coin: ${h ? 'Heads' : 'Tails'}.`); return h; }
function dice(g, p) { const n = 1 + Math.floor(g.rnd() * 6); log(g, `${PN(g, p)} rolled a ${n}.`); return n; }
function gain(g, p, n) { if (n <= 0) return; g.p[p].lp += n; log(g, `${PN(g, p)} gained ${n} LP.`); }
function pay(g, p, n) { g.p[p].lp -= n; log(g, `${PN(g, p)} paid ${n} LP.`); }
function draw(g, p, n = 1) {
  for (let i = 0; i < n; i++) {
    if (forbid(g, { type: 'draw', p })) return;
    const P = g.p[p]; if (!P.deck.length) { g.winner = 1 - p; g.why = `${PN(g, p)} couldn't draw`; log(g, g.why + '.'); throw new Over(); }
    const c = P.deck[P.deck.length - 1]; move(g, c, 'hand', { reason: 'draw' });
  }
  if (n) log(g, `${PN(g, p)} drew ${n === 1 ? 'a card' : n + ' cards'}.`);
}
function mill(g, p, n) { const out = []; for (let i = 0; i < n && g.p[p].deck.length; i++) { const c = g.p[p].deck[g.p[p].deck.length - 1]; move(g, c, 'gy', { reason: 'effect' }); out.push(c); } if (out.length) log(g, `${PN(g, p)} sent ${out.map(name).join(', ')} from the Deck to the GY.`); return out; }
function* search(g, p, filter, text, to = 'hand') {
  if (to === 'hand' && forbid(g, { type: 'search', p })) { log(g, 'Cards can\u2019t be added from the Deck right now.'); return null; }
  const cands = g.p[p].deck.filter(filter); if (!cands.length) { shuffleDeck(g, p); return null; }
  const [c] = yield* pick(g, p, text, cands, 1, 1, 'good');
  if (c) { if (to === 'hand') { move(g, c, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(c)} from the Deck to the hand.`); } else { move(g, c, to, { reason: 'effect' }); log(g, `${PN(g, p)} sent ${name(c)} from the Deck to the GY.`); } }
  shuffleDeck(g, p); return c;
}
/* Destroy: checks "can't be destroyed", returns the cards destroyed. */
function destroy(g, cards, o = {}) {
  const out = []; const group = g.group;
  for (const c of cards) {
    if (!c || !onField(c)) continue;
    if (o.battle && cantBattleDestroy(g, c)) continue;
    if (!o.battle && !o.rule && faceUp(c) && has(g, c, 'noEffectDestroy')) continue;
    if (replaced(g, c, o)) continue;
    if (!o.battle && o.src && faceUp(c) && isST(o.src) && has(g, c, isSpell(o.src) ? 'unaffectedSpells' : 'unaffectedTraps')) continue;
    move(g, c, o.banish ? 'ban' : 'gy', { reason: o.battle ? 'battle' : 'effect', destroyed: true, battle: !!o.battle, killer: o.killer, by: o.by, group, noLater: true });
    out.push(c);
  }
  flushLater(g, group);
  if (out.length && !o.quietLog) log(g, `${out.map(x => x.snapName || name(x)).join(', ')} ${out.length > 1 ? 'were' : 'was'} destroyed${o.banish ? ' and banished' : ''}.`);
  return out;
}
function replaced(g, c, o) { // "destroy X instead" style effects
  const sc = SC(c); if (sc && sc.self && sc.self.replaceDestroy && faceUp(c) && !negd(g, c) && sc.self.replaceDestroy(g, c, o)) return true;
  for (const [s, ct] of statics(g)) if (ct.replaceDestroy && ct.replaceDestroy(g, s, c, o)) return true;
  return false;
}
function cantBattleDestroy(g, c) {
  if (!faceUp(c) && c.pos !== 'def') return false;
  const n = D(c).n, neg = negd(g, c);
  if (!neg && (n === 'Spirit Reaper' || n === 'Blackwing Armor Master')) return true;
  if (has(g, c, 'noBattleDestroy')) return true;
  if (isFrog(c) && monsOf(g, c.ctrl).some(x => faceUp(x) && D(x).n === 'Substitoad' && !x.flags.negated)) return true;
  if (isBW(c) && g.tp !== c.ctrl && !g.silverwindUsed[c.ctrl] && monsOf(g, c.ctrl).some(x => faceUp(x) && D(x).n === 'Blackwing - Silverwind the Ascendant' && !x.flags.negated)) { g.silverwindUsed[c.ctrl] = true; return true; }
  return false;
}
function ss(g, p, c, pos = 'atk', o = {}) { // Special Summon by an effect (no negation window of its own)
  const zi = freeM(g, p); if (zi < 0) return false;
  if (forbid(g, { type: 'ss', c, p, how: o.how || 'special' })) { log(g, `${name(c)} can\u2019t be Special Summoned right now.`); return false; }
  move(g, c, 'm', { ctrl: p, pos, reason: 'summon', group: o.group });
  c.summonType = o.how || 'special'; c.attacks = 0;
  if (o.negate) c.flags.negated = true;
  if (o.banishOnLeave) c.flags.banishOnLeave = true;
  log(g, `${PN(g, p)} Special Summoned ${pos === 'set' ? 'a monster face-down' : name(c)}${pos === 'def' ? ' in Defense Position' : ''}.`);
  const ev = emit(g, { type: 'summon', cs: [c], how: o.how || 'special', p, byEffect: true }, o.group);
  g.sw = { cs: [c], p, how: o.how || 'special', group: ev.group };
  return true;
}
function takeControl(g, p, c, untilEnd) {
  const zi = freeM(g, p); if (zi < 0 || !onField(c)) return false;
  detach(g, c); c.ctrl = p; g.p[p].m[zi] = c; c.flags.ctrlUntil = untilEnd ? g.turnNo : null; if (untilEnd) c.flags.ctrlFrom = 1 - p;
  log(g, `${PN(g, p)} took control of ${name(c)}.`); return true;
}
function setFaceDown(g, c) { g.seq++; c.pos = 'set'; c.mods = []; c.flags = { banishOnLeave: c.flags.banishOnLeave }; log(g, `${D(c).n} was turned face-down.`); }
function negate(g, L, destroyIt) {
  L.negated = true; log(g, `${name(L.c)}'s ${L.eff.type === 'act' ? 'activation' : 'effect'} was negated.`);
  if (destroyIt && onField(L.c)) destroy(g, [L.c], { by: L.negBy });
}
function addMod(g, c, m) { c.mods.push({ ...m, turn: g.turnNo }); }

/* ---------- Synchro and summon rules ---------- */
function synReq(sx) {
  const d = D(sx), n = d.n, first = (d.ps || d.tx || '').split('\n')[0];
  const r = { tuner: () => true, non: () => true, minNon: 1 };
  if (/"Blackwing" Tuner/.test(first) || /Blackwing/.test(n) && /Blackwing/.test(first)) r.tuner = c => isBW(c);
  if (/Junk Synchron/.test(first)) r.tuner = c => D(c).n === 'Junk Synchron';
  if (/2 or more non-Tuner|2\+ non-Tuner/.test(first)) r.minNon = 2;
  if (/non-Tuner DARK/.test(first)) r.non = c => attr(c) === 'DARK';
  return r;
}
function synCombos(g, p, sx) {
  const d = D(sx); if (d.k !== 'synchro') return [];
  const mons = monsOf(g, p).filter(c => faceUp(c) && !(D(c).n === 'Blackwing - Vayu the Emblem of Honor' && !c.flags.negated));
  const r = synReq(sx), out = [], n = mons.length, L = num(d.lv);
  for (let mask = 1; mask < (1 << n); mask++) {
    const mats = mons.filter((_, i) => mask & (1 << i)); if (mats.length < 2) continue;
    const tun = mats.filter(c => D(c).tu), non = mats.filter(c => !D(c).tu);
    if (tun.length !== 1 || non.length < r.minNon) continue;
    if (!r.tuner(tun[0]) || !non.every(r.non)) continue;
    if (mats.reduce((s, c) => s + lv(c), 0) !== L) continue;
    out.push(mats);
  }
  return out;
}
const isGemini = c => /treated as a Normal Monster while face-up on the field or in the GY/.test(D(c).tx || '');
function cfCombos(g, p, fx) { // contact fusions: Chimeratech Fortress Dragon, Superalloy Beast Raptinus
  const n = D(fx).n;
  if (n === 'Chimeratech Fortress Dragon') {
    const cyber = fieldMons(g).filter(c => faceUp(c) && D(c).n === 'Cyber Dragon');
    const mach = fieldMons(g).filter(c => faceUp(c) && race(c) === 'Machine' && D(c).n !== 'Cyber Dragon');
    if (!cyber.length || !mach.length) return [];
    return [[cyber[0], ...mach]];
  }
  if (n === 'Superalloy Beast Raptinus') {
    const gem = monsOf(g, p).filter(c => faceUp(c) && isGemini(c)); return gem.length >= 2 ? [gem.slice(0, 2)] : [];
  }
  return [];
}
function canNormal(c) { const d = D(c); if (!isMonD(d) || isExtraD(d) || d.k === 'token' || d.k === 'ritual') return false; const t = d.ps || d.tx || ''; if (/Cannot be Normal Summoned/i.test(t)) return false; return true; }
function tribNeed(g, p, c) { // [standard, alternatives...]
  const L = lv(c), need = L >= 7 ? 2 : L >= 5 ? 1 : 0, n = D(c).n, oppHas = monsOf(g, 1 - p).length > 0;
  const alts = [need];
  const sc0 = SC(c); if (sc0 && sc0.self && sc0.self.tribExact) return [sc0.self.tribExact];
  if (sc0 && sc0.self && sc0.self.tributes) for (const n2 of [].concat(sc0.self.tributes(g, c, p) || [])) alts.push(n2);
  for (const [s, ct] of statics(g)) if (ct.tributes) { const n2 = ct.tributes(g, s, c, p, need); if (n2 != null) alts.push(n2); }
  if (n === 'Blackwing - Sirocco the Dawn' && !monsOf(g, p).length && oppHas) alts.push(0);
  if (n === 'Evil HERO Malicious Edge' && oppHas) alts.push(1);
  return [...new Set(alts)];
}
function tributeCands(g, p) {
  const own = monsOf(g, p).filter(c => D(c).n !== 'Sheep Token' && !c.flags.noTribute);
  const extra = g.soulEx[p] ? monsOf(g, 1 - p).filter(c => c.u === g.soulEx[p]) : [];
  return [...own, ...extra];
}
function combos(arr, k) { const out = []; const rec = (s, cur) => { if (cur.length === k) { out.push(cur.slice()); return; } for (let i = s; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); } }; rec(0, []); return out; }

/* ---------- what a player may activate now ---------- */
function speedOf(c, eff) {
  if (eff.speed) return eff.speed;
  if (eff.type === 'act') { const d = D(c); if (d.k === 'trap') return d.sub === 'Counter' ? 3 : 2; return d.sub === 'Quick-Play' ? 2 : 1; }
  if (eff.type === 'quick') return 2;
  return 1;
}
function usable(g, p, c, eff, ei, mode) {
  if (eff.type === 'trig' || !eff.res) return false;
  const d = D(c), top = g.chain[g.chain.length - 1], sp = speedOf(c, eff);
  const holder = onField(c) ? c.ctrl : c.owner;
  if (!eff.anyPlayer && holder !== p) return false;
  if (eff.anyPlayer && !(onField(c) && faceUp(c))) return false;
  if (eff.opt && c.used[ei] === g.turnNo) return false;
  if (top) { if (sp < 2 || sp < top.speed) return false; }
  else if (mode !== 'idle' && sp < 2 && !(mode === 'ign' && g.tp === p)) return false;
  if (sp === 1 && (g.tp !== p || !['main1', 'main2'].includes(g.phase))) return false;
  if (g.inDS && !(eff.ds || (eff.type === 'act' && d.sub === 'Counter') || eff.speed === 3)) return false;
  if (g.attempt && !top && !eff.negSummon) return false;
  if (eff.type === 'act') {
    if (g.coldWave != null && g.coldWave >= 0) return false;
    if (c.zone === 'hand') {
      if (d.k === 'trap') return false;
      if (g.tp !== p) return false;
      if (d.sub === 'Field' ? false : freeST(g, p) < 0) return false;
    } else if ((c.zone === 'st' || c.zone === 'fz') && c.ctrl === p && c.pos === 'set') {
      if ((d.k === 'trap' || d.sub === 'Quick-Play') && c.turnIn === g.turnNo) return false;
      if (d.k === 'spell' && d.sub !== 'Quick-Play' && (g.tp !== p)) return false;
    } else return false;
  } else {
    if (isMonD(d) && (eff.loc || 'm') === 'm' && negd(g, c)) return false;
    if (isMonD(d) && c.flags.gemini === false && eff.gemini) return false;
    const loc = eff.loc || 'm';
    if (loc === 'm') { if (c.zone !== 'm' || !faceUp(c)) return false; }
    else if (loc === 'st' || loc === 'fz') { if (c.zone !== loc || !faceUp(c)) return false; }
    else if (c.zone !== loc) return false;
  }
  if (eff.type === 'ign' && (mode !== 'idle' && mode !== 'ign')) return false;
  if (eff.gemini && !c.flags.gemini) return false;
  if (forbid(g, { type: 'activate', c, eff, p })) return false;
  try { return eff.cond ? !!eff.cond(g, c, p, { top, mode }) : true; } catch (e) { throw e; }
}
function activatable(g, p, mode) {
  const out = [];
  const seen = new Set();
  const consider = (c) => { if (!c || seen.has(c.u)) return; seen.add(c.u); const sc = SC(c); if (!sc || !sc.effs) return; sc.effs.forEach((eff, ei) => { if (usable(g, p, c, eff, ei, mode)) out.push({ c, eff, ei }); }); };
  const P = g.p[p];
  P.hand.forEach(consider); P.st.forEach(consider); P.m.forEach(consider); P.gy.forEach(consider); if (P.fz) consider(P.fz); P.ban.forEach(consider);
  for (const x of [...g.p[1 - p].st, ...g.p[p].st, g.p[1 - p].fz, g.p[p].fz]) if (x && faceUp(x) && SC(x) && SC(x).effs && SC(x).effs.some(e => e.anyPlayer)) { seen.delete(x.u); consider(x); }
  return out;
}
function actLabel(g, a) { const sc = SC(a.c); const lab = a.eff.label || (a.eff.type === 'act' ? (a.c.zone === 'hand' || a.c.pos === 'set' ? 'Activate' : 'Activate') : 'Use effect'); return `${lab}: ${name(a.c)}`; }

/* ---------- activation, chains ---------- */
function* activate(g, p, c, eff, ei) {
  const d = D(c);
  const L = { c, eff, ei, p, speed: speedOf(c, eff), t: [], data: {}, negated: false, cardAct: eff.type === 'act', tags: eff.tags || {}, link: g.chain.length + 1 };
  if (eff.type === 'act') {
    if (c.zone === 'hand') { if (d.sub === 'Field') { if (g.p[p].fz) move(g, g.p[p].fz, 'gy', { reason: 'rule' }); move(g, c, 'fz', { ctrl: p, pos: 'up', reason: 'activate' }); } else move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'activate' }); }
    else { c.pos = 'up'; g.seq++; }
  }
  c.used[ei] = g.turnNo;
  log(g, `${PN(g, p)} activated ${name(c)}${eff.type !== 'act' ? "'s effect" : ''}${g.chain.length ? ` (Chain Link ${g.chain.length + 1})` : ''}.`);
  if (eff.cost) yield* eff.cost(g, c, p, L);
  if (eff.target) yield* eff.target(g, c, p, L);
  g.chain.push(L);
  if (g.hooks) g.hooks.note(g, { type: 'chain', L });
  if (eff.after) eff.after(g, c, p, L);
  return L;
}
function* respondLoop(g, p, mode) { // players respond to the chain until both pass
  let passes = 0;
  while (passes < 2) {
    const acts = activatable(g, p, 'respond');
    if (!acts.length) { passes++; p = 1 - p; continue; }
    const top = g.chain[g.chain.length - 1];
    const k = (yield* ask(g, p, 'respond', top ? `${name(top.c)} was activated. Respond?` : 'Respond?', [...acts.map(a => ({ key: `a:${a.c.u}:${a.ei}`, u: a.c.u, label: actLabel(g, a) })), { key: 'pass', label: 'Pass' }]))[0];
    if (k === 'pass') { passes++; p = 1 - p; continue; }
    const [, u, ei] = k.split(':'); const a = acts.find(x => x.c.u === +u && x.ei === +ei);
    yield* activate(g, p, a.c, a.eff, a.ei); passes = 0; p = 1 - p;
  }
}
function* resolveChain(g) {
  while (g.chain.length) {
    const L = g.chain.pop(); beginOp(g);
    if (g.hooks) g.hooks.note(g, { type: 'resolve', L });
    if (!L.negated) {
      const d = D(L.c);
      const stillThere = L.eff.type !== 'act' || onField(L.c) || !['Continuous', 'Equip', 'Field'].includes(d.sub);
      const monGone = isMonD(d) && L.eff.type !== 'trig' && L.eff.needsSelf && !onField(L.c);
      if (stillThere && !monGone && !(isMonD(d) && onField(L.c) && negd(g, L.c) && L.eff.loc !== 'gy' && L.eff.loc !== 'hand')) yield* L.eff.res(g, L.c, L.p, L);
    }
    if (L.eff.type === 'act' && onField(L.c) && L.c.zone === 'st' && !['Continuous', 'Equip', 'Field'].includes(D(L.c).sub) && !L.keep) move(g, L.c, 'gy', { reason: 'rule' });
    if (L.eff.type === 'act' && onField(L.c) && D(L.c).sub === 'Equip' && !L.c.equipTo && !L.c.linkTo) move(g, L.c, 'gy', { reason: 'rule' });
    if (L.eff.type === 'act' && !L.negated && onField(L.c) && D(L.c).sub === 'Field') { const o = g.p[1 - L.p].fz; if (o && o.pos !== 'set') destroy(g, [o], { rule: true }); }
    for (const t of L.t) if (t && D(t).n === 'Spirit Reaper' && onField(t) && faceUp(t) && !t.flags.negated && !L.negated) destroy(g, [t]);
  }
}
function* processTriggers(g) {
  let guard = 0;
  while (g.pend.length && guard++ < 30) {
    const last = lastGroup(g); let list = g.pend; g.pend = [];
    const seen = new Set();
    list = list.filter(t => {
      const k = t.c.u + ':' + t.ei; if (seen.has(k)) return false; seen.add(k);
      if (t.eff.when && !t.eff.mand && t.ev.group !== last) return false; // missed the timing
      const loc = t.eff.loc || 'm'; if (loc !== 'any' && (loc === 'm' ? t.c.zone !== 'm' : t.c.zone !== loc)) return false;
      if (t.eff.opt && t.c.used[t.ei] === g.turnNo) return false;
      return !t.eff.cond || t.eff.cond(g, t.c, t.p, { ev: t.ev });
    });
    if (!list.length) continue;
    const tp = g.tp, order = [...list.filter(t => t.eff.mand && t.p === tp), ...list.filter(t => t.eff.mand && t.p !== tp), ...list.filter(t => !t.eff.mand && t.p === tp), ...list.filter(t => !t.eff.mand && t.p !== tp)];
    for (const t of order) {
      if (!t.eff.mand && !(yield* yn(g, t.p, `Use ${name(t.c)}'s effect?${t.eff.label ? ' (' + t.eff.label + ')' : ''}`))) continue;
      if (t.eff.ok && !t.eff.ok(g, t.c, t.p, { ev: t.ev })) continue;
      if (forbid(g, { type: 'activate', c: t.c, eff: t.eff, p: t.p })) continue;
      const L = yield* activate(g, t.p, t.c, t.eff, t.ei); L.ev = t.ev;
    }
    if (g.chain.length) { yield* respondLoop(g, 1 - g.chain[g.chain.length - 1].p); yield* resolveChain(g); }
  }
}
/* A response window with an empty chain (after a summon, an attack, at a phase). */
function* openWindow(g, first, o = {}) {
  let p = first, passes = 0, guard = 0;
  while (passes < 2 && guard++ < 40) {
    const mode = o.ign && p === g.tp ? 'ign' : 'respond';
    const acts = activatable(g, p, mode);
    if (!acts.length) { passes++; p = 1 - p; continue; }
    const k = (yield* ask(g, p, 'respond', o.text || 'Activate a card or effect?', [...acts.map(a => ({ key: `a:${a.c.u}:${a.ei}`, u: a.c.u, label: actLabel(g, a) })), { key: 'pass', label: 'Pass' }]))[0];
    if (k === 'pass') { passes++; p = 1 - p; continue; }
    const [, u, ei] = k.split(':'); const a = acts.find(x => x.c.u === +u && x.ei === +ei);
    yield* activate(g, p, a.c, a.eff, a.ei);
    yield* respondLoop(g, 1 - p); yield* resolveChain(g); yield* processTriggers(g);
    if (g.attempt) return; // a summon negation window ends after one chain
    passes = 0; p = g.tp;
  }
}
function* afterAction(g) { yield* processTriggers(g); if (g.sw) yield* openWindow(g, g.tp, { ign: true, text: 'Respond to the summon?' }); }

/* ---------- summoning ---------- */
function* summonAttempt(g, p, cs, how) {
  g.attempt = { cs, how, p, negated: false };
  yield* openWindow(g, 1 - p, { text: `${PN(g, p)} is summoning ${cs.map(name).join(', ')}. Negate it?` });
  const neg = g.attempt.negated; g.attempt = null;
  if (neg) { destroy(g, cs.filter(onField), {}); return false; }
  return true;
}
function* normalSummon(g, p, c, set) {
  const alts = tribNeed(g, p, c); let need = Math.min(...alts);
  const cands = tributeCands(g, p);
  const usable = alts.filter(n => cands.length >= n);
  if (usable.length > 1) { const i = yield* choose(g, p, `Summon ${name(c)} with how many Tributes?`, usable.map(n => n ? `${n} Tribute${n > 1 ? 's' : ''}` : 'No Tribute')); need = usable[i]; } else need = usable[0];
  let tribs = [];
  if (need) { tribs = yield* pick(g, p, `Choose ${need} monster${need > 1 ? 's' : ''} to Tribute`, cands, need, need, 'cost'); }
  const group = g.group;
  for (const t of tribs) { const wasOpp = t.ctrl !== p; move(g, t, 'gy', { reason: 'tribute', by: p, group, tributeFor: c.u }); if (wasOpp) g.soulEx[p] = null; }
  if (tribs.length) log(g, `${PN(g, p)} Tributed ${tribs.map(x => x.snapName || D(x).n).join(', ')}.`);
  if (g.frogNS[p] && g.ns[p] >= 1 && isFrog(c)) g.frogNS[p] = false; else g.ns[p]++;
  const zi = freeM(g, p); if (zi < 0) return;
  move(g, c, 'm', { ctrl: p, pos: set ? 'set' : 'atk', reason: set ? 'set' : 'summon', group });
  c.summonType = tribs.length ? 'tribute' : 'normal'; c.tributes = tribs.map(t => t.u);
  if (set) { log(g, `${PN(g, p)} Set a monster.`); emit(g, { type: 'set', c, p }, group); yield* processTriggers(g); return; }
  log(g, `${PN(g, p)} ${tribs.length ? 'Tribute' : 'Normal'} Summoned ${name(c)}.`);
  if (!(yield* summonAttempt(g, p, [c], c.summonType))) { yield* processTriggers(g); return; }
  const ev = emit(g, { type: 'summon', cs: [c], how: c.summonType, p, tribs }, group);
  g.sw = { cs: [c], p, how: c.summonType, group: ev.group };
  yield* afterAction(g);
}
function* specialProc(g, p, c, how, cost, pos = 'atk') { // inherent Special Summons: from the hand, Synchro, contact Fusion
  const group = g.group;
  if (cost) yield* cost(group);
  const zi = freeM(g, p); if (zi < 0) return;
  move(g, c, 'm', { ctrl: p, pos, reason: 'summon', group }); c.summonType = how; c.attacks = 0;
  log(g, `${PN(g, p)} ${how === 'synchro' ? 'Synchro' : how === 'fusion' ? 'Fusion' : 'Special'} Summoned ${name(c)}${pos === 'def' ? ' in Defense Position' : ''}.`);
  if (!(yield* summonAttempt(g, p, [c], how))) { yield* processTriggers(g); return; }
  const ev = emit(g, { type: 'summon', cs: [c], how, p }, group);
  g.sw = { cs: [c], p, how, group: ev.group };
  yield* afterAction(g);
}

/* ---------- the duel ---------- */
E.newDuel = function (cfg) {
  const seed = cfg.seed != null ? cfg.seed : Math.floor(Math.random() * 2 ** 31);
  cfg = { ...cfg, seed };
  const g = {
    cfg, rnd: mulberry(seed), nextU: 1, p: [], tp: cfg.first || 0, turnNo: 0, phase: 'start', chain: [], events: [], pend: [], later: [], laterDestroy: [], rules: [],
    group: 0, seq: 0, summoned: [false, false], history: [], log: [], winner: null, why: '', ns: [0, 0], frogNS: [false, false], soulEx: [null, null],
    noBP: [false, false], noSummon: [false, false], onlyAttacker: [null, null], silverwindUsed: [false, false], roar: null,
    coldWave: null, goldSarc: [], attempt: null, sw: null, aw: null, inDS: false, battle: null, quiet: !!cfg.quiet,
  };
  for (const pi of [0, 1]) {
    const dk = cfg.decks[pi];
    const P = { lp: 8000, deck: [], hand: [], gy: [], ban: [], extra: [], m: [null, null, null, null, null], st: [null, null, null, null, null], fz: null, name: PN(g, pi), deckName: dk.name };
    g.p.push(P);
    for (const id of dk.main) { if (!DATA.has(id)) continue; const c = mk(g, id, pi); P.deck.push(c); }
    for (const id of dk.extra || []) { if (!DATA.has(id)) continue; const c = mk(g, id, pi); c.zone = 'extra'; P.extra.push(c); }
  }
  g.gen = duel(g); step(g, undefined); return g;
};
function step(g, input) {
  try { const r = g.gen.next(input); g.prompt = r.done ? null : r.value; }
  catch (e) { if (e instanceof Over || (e && e.over)) { g.prompt = null; } else throw e; }
}
E.act = function (g, keys, pz) { // pz: optional zone hint {u, to: 'm'|'st', zi} for where the player put the card
  const pr = g.prompt; if (!pr) throw new Error('No prompt');
  if (!Array.isArray(keys)) keys = [keys];
  const valid = new Set(pr.opts.map(o => o.key));
  if (keys.length < pr.min || keys.length > pr.max || keys.some(k => !valid.has(k)) || new Set(keys).size !== keys.length) throw new Error('Bad answer ' + JSON.stringify(keys) + ' to ' + pr.type + ': ' + pr.text);
  g.history.push(keys); (g.pzs || (g.pzs = []))[g.history.length - 1] = pz || null; if (pz) g.pz = pz; step(g, keys);
};
E.clone = function (g, quiet = true) {
  const h = E.newDuel({ ...g.cfg, quiet });
  g.history.forEach((k, i) => E.act(h, k, g.pzs && g.pzs[i]));
  return h;
};
E.scripted = n => { if (SCRIPTS[n] || (FMT !== 'edison' && FSCRIPTS[FMT] && FSCRIPTS[FMT][n])) return true; const d = BYNAME.get(n); return !!d && (d.k === 'normal' || d.k === 'token'); };
E.hasScript = n => !!SCRIPTS[n];

/* A preset position (tutorials, tests): cfg.board = [side0, side1], each {hand, m, st, gy, ban, extra, lp, turn}
 with card names or {n, pos}. Listed hand cards replace the drawn hand; new cards are made for every list. */
function applyBoard(g, board) {
  const idOf = n => { const d = BYNAME.get(n); if (!d) throw new Error('Unknown card ' + n); return d.id; };
  board.forEach((b, p) => {
    if (!b) return; const P = g.p[p];
    if (b.lp != null) P.lp = b.lp;
    const make = (x, zone) => { const nm = typeof x === 'string' ? x : x.n; const c = mk(g, idOf(nm), p); c.zone = zone; return c; };
    if (b.hand) { for (const c of P.hand.splice(0)) { c.zone = 'deck'; P.deck.unshift(c); } for (const x of b.hand) P.hand.push(make(x, 'hand')); }
    for (const z of ['gy', 'ban', 'extra']) if (b[z]) for (const x of b[z]) P[z].push(make(x, z));
    if (b.deckTop) for (const x of b.deckTop.slice().reverse()) P.deck.push(make(x, 'deck'));
    (b.m || []).forEach((x, i) => { if (!x) return; const c = make(x, 'm'); c.pos = x.pos || 'atk'; c.turnIn = 0; P.m[x.zi != null ? x.zi : i] = c; });
    (b.st || []).forEach((x, i) => { if (!x) return; const c = make(x, 'st'); c.pos = x.pos || 'set'; c.turnIn = 0; P.st[x.zi != null ? x.zi : i] = c; });
  });
  const tn = board.turn || (board[0] && board[0].turn); if (tn) g.turnNo = tn - 1;
}
function* duel(g) {
  if (!g.cfg.noShuffle) { shuffleDeck(g, 0); shuffleDeck(g, 1); } else for (const P of g.p) P.deck.reverse();
  for (let i = 0; i < 5; i++) { for (const p of [0, 1]) move(g, g.p[p].deck[g.p[p].deck.length - 1], 'hand', { reason: 'draw' }); }
  if (g.cfg.board) applyBoard(g, g.cfg.board);
  log(g, `${PN(g, g.tp)} ${g.tp === 0 && g.cfg.names && g.cfg.names[0] === 'You' ? 'go' : 'goes'} first.`);
  for (;;) { yield* turn(g); g.tp = 1 - g.tp; }
}
function* turn(g) {
  const tp = g.tp; g.turnNo++; g.ns = [0, 0]; g.summoned = [false, false]; g.frogNS = [false, false]; g.noBP = [false, false]; g.noSummon = [false, false]; g.onlyAttacker = [null, null]; g.silverwindUsed = [false, false]; g.roar = null; g.bpEnd = false; g.goBattle = false; g.soulEx = [null, null];
  if (g.coldWave && g.coldWave.p === tp) g.coldWave = null;
  g.rules = g.rules.filter(r => r.startOf !== tp);
  for (const c of fieldMons(g)) { c.attacks = 0; c.posChanged = false; c.declared = false; }
  log(g, `— Turn ${g.turnNo}: ${PN(g, tp)} —`);
  g.phase = 'draw'; beginOp(g); draw(g, tp, 1); yield* processTriggers(g);
  g.phase = 'standby'; beginOp(g);
  // Gold Sarcophagus: the card comes to the hand in the activator's second Standby Phase
  for (const gs of g.goldSarc.filter(x => x.p === tp)) { gs.n++; if (gs.n >= 2 && gs.c.zone === 'ban') { move(g, gs.c, 'hand', { reason: 'effect' }); log(g, `${PN(g, tp)} added ${name(gs.c)} to the hand (Gold Sarcophagus).`); gs.done = true; } }
  g.goldSarc = g.goldSarc.filter(x => !x.done);
  emit(g, { type: 'phase', ph: 'standby', tp }); yield* processTriggers(g);
  g.phase = 'main1'; g.mainStart = true; yield* mainPhase(g);
  if (g.goBattle) { yield* battlePhase(g); g.phase = 'main2'; g.mainStart = false; yield* mainPhase(g); }
  g.phase = 'end'; beginOp(g); emit(g, { type: 'phase', ph: 'end', tp }); yield* processTriggers(g);
  yield* openWindow(g, 1 - tp, { text: 'End Phase. Activate a card or effect?' });
  // end of turn: "until the End Phase" effects end, control returns
  for (const c of fieldMons(g)) { c.mods = c.mods.filter(m => !m.end); if (c.flags.lvUntil) { c.flags.lv = null; c.flags.lvUntil = null; } }
  g.rules = g.rules.filter(r => !(r.end != null && r.end <= g.turnNo));
  for (const c of fieldMons(g)) if (c.flags.ctrlUntil != null) { const back = c.flags.ctrlFrom; c.flags.ctrlUntil = null; c.flags.ctrlFrom = null; const zi = freeM(g, back); if (zi >= 0) { detach(g, c); c.ctrl = back; g.p[back].m[zi] = c; log(g, `${name(c)} returned to ${PN(g, back)}.`); } else move(g, c, 'gy', { reason: 'rule' }); }
  // hand limit
  const P = g.p[tp];
  if (P.hand.length > 6) { const n = P.hand.length - 6; const ds = yield* pick(g, tp, `Discard ${n} card${n > 1 ? 's' : ''} (hand limit 6)`, P.hand, n, n, 'cost'); beginOp(g); for (const c of ds) move(g, c, 'gy', { reason: 'discard' }); log(g, `${PN(g, tp)} discarded ${ds.map(name).join(', ')} for the hand limit.`); yield* processTriggers(g); }
  for (const c of fieldMons(g)) c.flags.wedgeZero = false;
}

/* Main Phase: the turn player's free actions */
function idleOpts(g) {
  const p = g.tp, P = g.p[p], out = [], main = ['main1', 'main2'].includes(g.phase);
  if (!main) return out;
  const nsLeft = g.ns[p] < 1 || g.frogNS[p];
  if (!g.noSummon[p]) for (const c of P.hand) {
    if (!isMon(c)) continue;
    if (canNormal(c) && (g.ns[p] < 1 || (g.frogNS[p] && isFrog(c) && !['Swap Frog', 'Frog the Jam'].includes(D(c).n)))) {
      const alts = tribNeed(g, p, c), cands = tributeCands(g, p);
      if (alts.some(n => cands.length >= n && (n > 0 || freeM(g, p) >= 0))) {
        if (!forbid(g, { type: 'ns', c, p })) out.push({ key: 'ns:' + c.u, u: c.u, kind: 'ns', label: Math.min(...alts.filter(n => cands.length >= n)) ? 'Tribute Summon' : 'Normal Summon' });
        if (!forbid(g, { type: 'set', c, p })) out.push({ key: 'set:' + c.u, u: c.u, kind: 'set', label: 'Set face-down' });
      }
    }
    const sc = SC(c);
    if (sc && sc.proc && !sc.proc.extra && freeM(g, p) >= 0 && sc.proc.cond(g, c, p) && !forbid(g, { type: 'ss', c, p, how: 'special' })) out.push({ key: 'sp:' + c.u, u: c.u, kind: 'sp', label: sc.proc.label || 'Special Summon' });
  }
  if (!g.noSummon[p] && freeM(g, p) >= 0 || monsOf(g, p).length) {
    for (const x of P.extra) {
      if (g.noSummon[p]) break;
      if (forbid(g, { type: 'ss', c: x, p, how: D(x).k })) continue;
      const xs = SC(x); if (xs && xs.proc && xs.proc.extra && xs.proc.cond(g, x, p)) out.push({ key: 'sp:' + x.u, u: x.u, kind: 'sp', label: xs.proc.label || 'Special Summon' });
      if (D(x).k === 'synchro' && !(xs && xs.noSynchro) && synCombos(g, p, x).length) out.push({ key: 'syn:' + x.u, u: x.u, kind: 'syn', label: 'Synchro Summon' });
      if (D(x).k === 'fusion' && cfCombos(g, p, x).length) out.push({ key: 'cf:' + x.u, u: x.u, kind: 'cf', label: 'Special Summon' });
    }
  }
  for (const c of monsOf(g, p)) {
    if (c.pos === 'set' && c.turnIn !== g.turnNo && !c.posChanged) out.push({ key: 'flip:' + c.u, u: c.u, kind: 'flip', label: 'Flip Summon' });
    if (c.pos === 'atk' && isGemini(c) && !c.flags.gemini && (g.ns[p] < 1) && !g.noSummon[p] && !forbid(g, { type: 'ns', c, p })) out.push({ key: 'gem:' + c.u, u: c.u, kind: 'gem', label: 'Gemini Summon (gain its effect)' });
    if (c.pos !== 'set' && c.turnIn !== g.turnNo && !c.posChanged && !c.attacks && !forbid(g, { type: 'pos', c })) out.push({ key: 'pos:' + c.u, u: c.u, kind: 'pos', label: c.pos === 'atk' ? 'Change to Defense' : 'Change to Attack' });
  }
  for (const a of activatable(g, p, 'idle')) out.push({ key: `a:${a.c.u}:${a.ei}`, u: a.c.u, kind: 'act', label: a.eff.label || (a.eff.type === 'act' ? 'Activate' : 'Use effect') });
  if (!g.coldWave) for (const c of P.hand) if (isST(c) && D(c).sub === 'Field' && !forbid(g, { type: 'setST', c, p })) out.push({ key: 'setst:' + c.u, u: c.u, kind: 'setst', label: 'Set' });
  if (freeST(g, p) >= 0 && !(g.coldWave)) for (const c of P.hand) if (isST(c) && D(c).sub !== 'Field' && !forbid(g, { type: 'setST', c, p })) out.push({ key: 'setst:' + c.u, u: c.u, kind: 'setst', label: 'Set' });
  if (g.phase === 'main1' && g.turnNo > 1 && !g.noBP[p]) out.push({ key: 'bp', kind: 'phase', label: 'Battle Phase' });
  out.push({ key: 'end', kind: 'phase', label: 'End turn' });
  return out;
}
E.idleOpts = idleOpts;
function* mainPhase(g) {
  for (let guard = 0; guard < 200; guard++) {
    const opts = idleOpts(g);
    const k = (yield* ask(g, g.tp, 'idle', g.phase === 'main1' ? 'Main Phase 1' : 'Main Phase 2', opts))[0];
    if (k === 'bp') { g.goBattle = true; return; }
    if (k === 'end') return;
    g.mainStart = false; { const sw = g.sw; beginOp(g); if (k.startsWith('a:')) g.sw = sw; } // a response to the last summon keeps it
    yield* doIdle(g, k);
  }
}
function* doIdle(g, k) {
  const p = g.tp, P = g.p[p]; const [kind, a, b] = k.split(':'); const u = +a;
  const find = u => [...P.hand, ...P.extra, ...monsOf(g, p), ...stOf(g, p), ...P.gy, ...P.ban, ...fieldOf(g, 1 - p)].find(c => c.u === u);
  const c = find(u);
  if (kind === 'ns' || kind === 'set') return yield* normalSummon(g, p, c, kind === 'set');
  if (kind === 'sp') { const pr = SC(c).proc; return yield* specialProc(g, p, c, pr.how || 'special', pr.cost ? (grp) => pr.cost(g, c, p, grp) : null, pr.pos || 'atk'); }
  if (kind === 'syn') {
    const cs = synCombos(g, p, c); let mats = cs[0];
    if (cs.length > 1) { const i = yield* choose(g, p, `Synchro Summon ${name(c)} with which monsters?`, cs.map(m => m.map(name).join(' + '))); mats = cs[i]; }
    const posI = yield* choose(g, p, `${name(c)}: which position?`, ['Attack Position', 'Defense Position']);
    return yield* specialProc(g, p, c, 'synchro', function* (grp) { for (const m of mats) move(g, m, 'gy', { reason: 'synchro', by: p, group: grp }); log(g, `${PN(g, p)} sent ${mats.map(m => m.snapName || D(m).n).join(' + ')} to the GY for a Synchro Summon.`); }, posI ? 'def' : 'atk');
  }
  if (kind === 'cf') {
    const mats = cfCombos(g, p, c)[0];
    return yield* specialProc(g, p, c, 'fusion', function* (grp) { for (const m of mats) move(g, m, 'gy', { reason: 'fusion', by: p, group: grp }); if (D(c).n === 'Chimeratech Fortress Dragon') c.flags.baseAtk = 1000 * mats.length; });
  }
  if (kind === 'flip') {
    const group = g.group; c.pos = 'atk'; c.posChanged = true; log(g, `${PN(g, p)} Flip Summoned ${name(c)}.`);
    if (!(yield* summonAttempt(g, p, [c], 'flip'))) { yield* processTriggers(g); return; }
    emit(g, { type: 'flip', c, p }, group); const ev = emit(g, { type: 'summon', cs: [c], how: 'flip', p }, group);
    g.sw = { cs: [c], p, how: 'flip', group: ev.group }; return yield* afterAction(g);
  }
  if (kind === 'gem') {
    const group = g.group; g.ns[p]++; log(g, `${PN(g, p)} Gemini Summoned ${name(c)}.`);
    if (!(yield* summonAttempt(g, p, [c], 'normal'))) { yield* processTriggers(g); return; }
    c.flags.gemini = true; const ev = emit(g, { type: 'summon', cs: [c], how: 'gemini', p }, group);
    g.sw = { cs: [c], p, how: 'gemini', group: ev.group }; return yield* afterAction(g);
  }
  if (kind === 'pos') { c.pos = c.pos === 'atk' ? 'def' : 'atk'; c.posChanged = true; log(g, `${PN(g, p)} changed ${name(c)} to ${c.pos === 'atk' ? 'Attack' : 'Defense'} Position.`); emit(g, { type: 'pos', c, p }); yield* processTriggers(g); return; }
  if (kind === 'setst') { if (D(c).sub === 'Field') { if (P.fz) move(g, P.fz, 'gy', { reason: 'rule' }); move(g, c, 'fz', { ctrl: p, pos: 'set', reason: 'set' }); log(g, `${PN(g, p)} Set a Field Spell.`); return; } move(g, c, 'st', { ctrl: p, pos: 'set', reason: 'set' }); log(g, `${PN(g, p)} Set a card.`); return; }
  if (kind === 'a') {
    const ei = +b; const eff = SC(c).effs[ei];
    yield* activate(g, p, c, eff, ei); yield* respondLoop(g, 1 - p); yield* resolveChain(g); yield* afterAction(g);
  }
}

/* ---------- battle ---------- */
/* Goat hook (2026-11-24): a script's self.maxAttacks(g, c) sets how many attacks it has this turn, and self.attackOk(g, c, t)
 filters its attack targets (Asura Priest: each opponent's monster once). No Edison script uses either key. */
const selfFn = (g, c, k) => { const sc = SC(c); return sc && sc.self && typeof sc.self[k] === 'function' && faceUp(c) && !negd(g, c) ? sc.self[k] : null; };
function canAttack(g, c) {
  const mx = selfFn(g, c, 'maxAttacks');
  if (c.ctrl !== g.tp || c.pos !== 'atk' || c.attacks >= (mx ? mx(g, c) : c.flags.maxAttacks && c.flags.maxAttacksTurn === g.turnNo ? c.flags.maxAttacks : c.flags.extraAttack && c.flags.extraAttack === g.turnNo ? 2 : 1)) return false;
  if (has(g, c, 'cantAttack') || forbid(g, { type: 'attack', c })) return false;
  { const ac = selfFn(g, c, 'attackCost'); if (ac && g.p[c.ctrl].lp <= ac(g, c)) return false; }
  if (g.onlyAttacker[g.tp] && g.onlyAttacker[g.tp] !== c.u) return false;
  return true;
}
function attackTargets(g, c) {
  const opp = monsOf(g, 1 - g.tp);
  const dupe = opp.filter(x => faceUp(x) && D(x).n === 'Dupe Frog' && !x.flags.negated);
  const aok = selfFn(g, c, 'attackOk');
  const targetable = opp.filter(t => !(faceUp(t) && has(g, t, 'noAttackTarget')) && (!aok || aok(g, c, t)));
  const out = (dupe.length ? dupe : targetable).map(t => t.u);
  if (!opp.length || (D(c).n === 'Unifrog' && !negd(g, c)) || has(g, c, 'directAttack') || (!targetable.length && !dupe.length)) out.push('d');
  return out;
}
function battleOpts(g) {
  const out = [];
  if (!g.roar || g.roar !== g.tp) for (const c of monsOf(g, g.tp)) if (canAttack(g, c)) for (const t of attackTargets(g, c)) {
    const tc = t === 'd' ? null : fieldMons(g).find(x => x.u === t);
    out.push({ key: `atk:${c.u}:${t}`, u: c.u, t: t === 'd' ? null : t, kind: 'atk', label: t === 'd' ? 'Attack directly' : `Attack ${tc.pos === 'set' ? 'the face-down monster' : name(tc)}` });
  }
  for (const a of activatable(g, g.tp, 'respond')) out.push({ key: `a:${a.c.u}:${a.ei}`, u: a.c.u, kind: 'act', label: a.eff.label || 'Activate' });
  out.push({ key: 'endbp', kind: 'phase', label: 'End Battle Phase' });
  return out;
}
E.battleOpts = battleOpts;
function* battlePhase(g) {
  g.phase = 'battle'; beginOp(g); log(g, `${PN(g, g.tp)} entered the Battle Phase.`);
  yield* openWindow(g, 1 - g.tp, { text: 'Start of the Battle Phase. Activate a card or effect?' });
  for (let guard = 0; guard < 60 && !g.bpEnd; guard++) {
    const k = (yield* ask(g, g.tp, 'idle', 'Battle Phase', battleOpts(g)))[0];
    if (k === 'endbp') break;
    { const sw = g.sw; beginOp(g); if (k.startsWith('a:')) g.sw = sw; }
    if (k.startsWith('a:')) { const [, u, ei] = k.split(':'); const c = [...g.p[g.tp].hand, ...allField(g), ...g.p[g.tp].gy, ...g.p[g.tp].ban].find(x => x.u === +u); yield* activate(g, g.tp, c, SC(c).effs[+ei], +ei); yield* respondLoop(g, 1 - g.tp); yield* resolveChain(g); yield* processTriggers(g); continue; }
    const [, au, tu] = k.split(':'); const a = fieldMons(g).find(x => x.u === +au); const t = tu === 'd' ? null : fieldMons(g).find(x => x.u === +tu);
    yield* attack(g, a, t);
  }
  g.bpEnd = false; beginOp(g); emit(g, { type: 'phase', ph: 'bpEnd', tp: g.tp }); yield* processTriggers(g);
}
function* attack(g, a, t) {
  const tp = g.tp, op = 1 - tp;
  for (let replay = 0; replay < 4; replay++) {
    if (!replay) { const ac = selfFn(g, a, 'attackCost'); if (ac) pay(g, tp, ac(g, a)); }
    a.attacks++; a.declared = true;
    log(g, `${name(a)} attacks ${t ? (t.pos === 'set' ? 'a face-down monster' : name(t)) : 'directly'}.`);
    const before = monsOf(g, op).length; beginOp(g);
    const ev = emit(g, { type: 'attack', a, t, p: tp, direct: !t });
    g.aw = { a, t, group: ev.group };
    yield* processTriggers(g);
    if (g.aw) yield* openWindow(g, op, { text: `${name(a)} is attacking. Respond?` });
    g.aw = null;
    if (g.attackNegated) { g.attackNegated = false; log(g, 'The attack was negated.'); return; }
    if (g.bpEnd || !onField(a) || a.ctrl !== tp || a.pos !== 'atk') return;
    const now = monsOf(g, op).length;
    if (now !== before || (t && (!onField(t) || t.ctrl !== op))) { // replay
      const tg = attackTargets(g, a); if (g.roar === tp) return;
      const opts = tg.map(x => x === 'd' ? { key: 'd', label: 'Attack directly' } : { key: 'u' + x, label: 'Attack ' + shown(g, fieldMons(g).find(m => m.u === x)) });
      opts.push({ key: 'stop', label: "Don't attack" });
      const k = (yield* ask(g, tp, 'choose', 'The opponent’s monsters changed: choose a new target (replay)', opts))[0];
      if (k === 'stop') return;
      t = k === 'd' ? null : fieldMons(g).find(m => 'u' + m.u === k); a.attacks--; continue;
    }
    break;
  }
  yield* damageStep(g, a, t);
}
function* damageStep(g, a, t) {
  const tp = g.tp, op = 1 - tp;
  g.inDS = true; g.battle = { a, t }; beginOp(g);
  emit(g, { type: 'dsStart', a, t }); yield* processTriggers(g);
  yield* openWindow(g, op, { text: 'Damage Step. Activate a card or effect?' });
  const alive = () => onField(a) && a.ctrl === tp && (!t || (onField(t) && t.ctrl === op));
  if (!alive()) { g.inDS = false; g.battle = null; return; }
  let flipped = false;
  if (t && t.pos === 'set') { t.pos = 'def'; flipped = true; g.seq++; log(g, `The face-down monster was ${name(t)}.`); }
  yield* openWindow(g, op, { text: 'Before damage calculation. Activate a card or effect?' });
  if (!alive()) { g.inDS = false; g.battle = null; return; }
  beginOp(g);
  const A = stat(g, a, 'atk') + (t && t.pos !== 'atk' && D(a).n === 'Blackwing Armed Wing' && !a.flags.negated ? 500 : 0);
  const pierce = c => (!negd(g, c) && ['Blackwing - Bora the Spear', 'Blackwing Armed Wing', 'Flamvell Uruquizas', 'Evil HERO Malicious Edge'].includes(D(c).n)) || has(g, c, 'piercing');
  const noDmg = (p, c1, c2) => [c1, c2].some(c => c && c.ctrl === p && faceUp(c) && ((D(c).n === 'Blackwing Armor Master' && !negd(g, c)) || has(g, c, 'noBattleDamage'))) || g.p[p].noBattleDamage === g.turnNo;
  let killA = false, killT = false, dmgTo = null, dmg = 0;
  const tDef = t && t.pos !== 'atk';
  if (!t) { dmgTo = op; dmg = A; }
  else if (t.pos === 'atk') { const T = stat(g, t, 'atk'); if (A > T) { killT = true; dmgTo = op; dmg = A - T; } else if (A < T) { killA = true; dmgTo = tp; dmg = T - A; } else if (A > 0 || T === 0) { killA = killT = A > 0 || true; if (A === 0 && T === 0) killA = killT = true; } }
  else { const Dv = stat(g, t, 'def'); if (A > Dv) { killT = true; if (pierce(a)) { dmgTo = op; dmg = A - Dv; } } else if (A < Dv) { dmgTo = tp; dmg = Dv - A; } }
  if (t && t.pos === 'atk' && A === stat(g, t, 'atk') && A === 0) { killA = killT = true; }
  if (dmgTo != null && noDmg(dmgTo, a, t)) dmg = 0;
  if (dmg > 0) damage(g, dmgTo, dmg, { battle: true, src: dmgTo === op ? a : t, srcP: 1 - dmgTo, direct: !t });
  const victims = [];
  if (killT && t && !cantBattleDestroy(g, t)) victims.push([t, a]);
  if (killA && !cantBattleDestroy(g, a)) victims.push([a, t]);
  for (const [v] of victims) v.flags.battleDoomed = true;
  emit(g, { type: 'afterCalc', a, t, tWasDef: tDef, flipped });
  if (flipped && onField(t)) emit(g, { type: 'flip', c: t, p: op, battle: true });
  yield* processTriggers(g);
  beginOp(g);
  const grp = g.group;
  for (const [v, k] of victims) if (onField(v) && v.flags.battleDoomed) { v.flags.battleDoomed = false; if (replaced(g, v, { battle: true, killer: k })) continue; move(g, v, 'gy', { reason: 'battle', destroyed: true, battle: true, killer: k, group: grp, noLater: true }); log(g, `${D(v).n} was destroyed by battle.`); }
  flushLater(g, grp);
  emit(g, { type: 'dsEnd', a, t, attackedMonster: !!t });
  yield* processTriggers(g);
  g.inDS = false; g.battle = null;
}

/* ---------- card scripts ---------- */
const opp = p => 1 - p;
const evSummoned = (ev, c, hows) => ev.type === 'summon' && ev.cs.includes(c) && (!hows || hows.includes(ev.how));
const fromFieldToGY = (ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy';
const battleKill = (ev, c) => ev.type === 'move' && ev.battle && ev.killer === c && ev.to === 'gy' && ev.c.zone === 'gy';
function* tgt(g, p, L, text, cands, min = 1, max = 1, hint) { cands = cands.filter(x => !(onField(x) && faceUp(x) && has(g, x, 'cantBeTargeted') && (!L || !L.c || !(SC(x) && SC(x).self && SC(x).self.targetFilter) || SC(x).self.targetFilter(g, x, L)))); const t = yield* pick(g, p, text, cands, min, max, hint); L.t = t; return t; }
const live = (L) => L.t.filter(x => onField(x));
const oppFaceUp = (g, p) => monsOf(g, opp(p)).filter(faceUp);
const stOnField = g => [...stOf(g, 0), ...stOf(g, 1)];
const lastSummonOk = (g, f) => g.sw && f(g.sw);
const spellTrapAct = L => L && L.cardAct && isST(L.c);

const SCRIPTS = {
  /* ----- Blackwing ----- */
  'Blackwing - Blizzard the Far North': { effs: [{ type: 'trig', when: true, tags: { ss: 1 },
    on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isBW(x) && isMon(x) && lv(x) <= 4),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon a Level 4 or lower Blackwing from your GY', g.p[p].gy.filter(x => isBW(x) && isMon(x) && lv(x) <= 4), 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'def'); } }] },
  'Blackwing - Bora the Spear': { proc: { cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isBW(x) && D(x).n !== 'Blackwing - Bora the Spear'), label: 'Special Summon (you control a Blackwing)' } },
  'Blackwing - Gale the Whirlwind': { proc: { cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isBW(x) && D(x).n !== 'Blackwing - Gale the Whirlwind'), label: 'Special Summon (you control a Blackwing)' },
    effs: [{ type: 'ign', opt: true, label: 'Halve ATK/DEF',
      cond: (g, c, p) => oppFaceUp(g, p).length > 0,
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Halve the ATK and DEF of', oppFaceUp(g, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (t && faceUp(t)) { const A = stat(g, t, 'atk'), Dv = stat(g, t, 'def'); addMod(g, t, { atk: -(A - Math.floor(A / 2)), def: -(Dv - Math.floor(Dv / 2)) }); log(g, `${name(t)}'s ATK and DEF were halved.`); } } }] },
  'Blackwing - Kalut the Moon Shadow': { effs: [{ type: 'quick', loc: 'hand', ds: true, label: '+1400 ATK',
    cond: (g, c, p) => g.inDS && g.battle && [g.battle.a, g.battle.t].some(x => x && x.ctrl === p && faceUp(x) && isBW(x)),
    cost: function* (g, c, p, L) { L.data.m = [g.battle.a, g.battle.t].find(x => x && x.ctrl === p && isBW(x)); move(g, c, 'gy', { reason: 'cost' }); },
    res: function* (g, c, p, L) { const m = L.data.m; if (m && onField(m) && faceUp(m)) { addMod(g, m, { atk: 1400, end: true }); log(g, `${name(m)} gained 1400 ATK.`); } } }] },
  'Blackwing - Shura the Blue Flame': { effs: [{ type: 'trig', tags: { ss: 1 },
    on: (g, ev, c) => battleKill(ev, c), cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isBW(x) && isMon(x) && baseAtk(x) <= 1500),
    res: function* (g, c, p, L) { const cands = g.p[p].deck.filter(x => isBW(x) && isMon(x) && baseAtk(x) <= 1500); const [x] = yield* pick(g, p, 'Special Summon a Blackwing with 1500 or less ATK from your Deck', cands, 1, 1, 'good'); if (x) ss(g, p, x, 'atk', { negate: true }); shuffleDeck(g, p); } }] },
  'Blackwing - Sirocco the Dawn': { effs: [{ type: 'ign', opt: true, label: 'Pump a Blackwing',
    cond: (g, c, p) => g.phase === 'main1' && monsOf(g, p).filter(x => faceUp(x) && isBW(x)).length >= 2,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Which Blackwing gains the ATK?', monsOf(g, p).filter(x => faceUp(x) && isBW(x)), 1, 1, 'good'); },
    after: (g, c, p, L) => { g.onlyAttacker[p] = L.t[0] && L.t[0].u; },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !faceUp(t)) return; const add = fieldMons(g).filter(x => x !== t && faceUp(x) && isBW(x)).reduce((s, x) => s + stat(g, x, 'atk'), 0); addMod(g, t, { atk: add, end: true }); log(g, `${name(t)} gained ${add} ATK.`); } }] },
  'Blackwing - Vayu the Emblem of Honor': { effs: [{ type: 'ign', loc: 'gy', tags: { ss: 1 }, label: 'Summon a Blackwing Synchro',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => x !== c && isBW(x) && isMon(x) && !D(x).tu && g.p[p].extra.some(e => D(e).k === 'synchro' && isBW(e) && num(D(e).lv) === lv(x) + lv(c))),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Banish which non-Tuner Blackwing with Vayu?', g.p[p].gy.filter(x => x !== c && isBW(x) && isMon(x) && !D(x).tu && g.p[p].extra.some(e => D(e).k === 'synchro' && isBW(e) && num(D(e).lv) === lv(x) + lv(c))), 1, 1, 'cost'); },
    res: function* (g, c, p, L) { const t = L.t[0]; if (!t || t.zone !== 'gy' || c.zone !== 'gy') return; const L2 = lv(t) + lv(c); move(g, c, 'ban', { reason: 'effect' }); move(g, t, 'ban', { reason: 'effect' }); const cands = g.p[p].extra.filter(e => D(e).k === 'synchro' && isBW(e) && num(D(e).lv) === L2); const [x] = yield* pick(g, p, 'Special Summon which Blackwing Synchro?', cands, 1, 1, 'good'); if (x) ss(g, p, x, 'atk', { negate: true }); } }] },
  'Dark Armed Dragon': { proc: { cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK').length === 3, label: 'Special Summon (exactly 3 DARKs in your GY)' },
    effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Banish a DARK: destroy a card',
      cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'DARK') && allField(g).some(x => x !== c),
      cost: function* (g, c, p, L) { const [x] = yield* pick(g, p, 'Banish a DARK from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK'), 1, 1, 'cost'); move(g, x, 'ban', { reason: 'cost' }); },
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which card?', allField(g).filter(x => x !== c), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'Allure of Darkness': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 2,
    res: function* (g, c, p, L) { draw(g, p, 2); const darks = g.p[p].hand.filter(x => isMon(x) && attr(x) === 'DARK'); if (darks.length) { const [x] = yield* pick(g, p, 'Banish a DARK from your hand', darks, 1, 1, 'cost'); move(g, x, 'ban', { reason: 'effect' }); log(g, `${PN(g, p)} banished ${name(x)}.`); } else { const h = g.p[p].hand.slice(); for (const x of h) move(g, x, 'gy', { reason: 'effect' }); log(g, `${PN(g, p)} had no DARK and sent the whole hand to the GY.`); } } }] },
  'Black Whirlwind': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', when: true,
      on: (g, ev, c) => ev.type === 'summon' && ['normal', 'tribute'].includes(ev.how) && ev.p === c.ctrl && ev.cs.some(isBW),
      res: function* (g, c, p, L) { const m = L.ev.cs[0]; const A = onField(m) ? stat(g, m, 'atk') : baseAtk(m); yield* search(g, p, x => isBW(x) && isMon(x) && baseAtk(x) < A, `Add a Blackwing with less than ${A} ATK`); } }] },
  'Book of Moon': { effs: [{ type: 'act', cond: (g) => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Turn which monster face-down?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (t && faceUp(t)) setFaceDown(g, t); } }] },
  'Brain Control': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp > 800 && oppFaceUp(g, p).length && freeM(g, p) >= 0,
    cost: function* (g, c, p) { pay(g, p, 800); },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Take control of which monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (t && faceUp(t) && t.ctrl !== p) takeControl(g, p, t, true); } }] },
  'Heavy Storm': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c) => stOnField(g).some(x => x !== c),
    res: function* (g, c, p) { destroy(g, stOnField(g).filter(x => x !== c), { by: p }); } }] },
  'Mystical Space Typhoon': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c) => stOnField(g).some(x => x !== c),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which Spell/Trap?', stOnField(g).filter(x => x !== c), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'Bottomless Trap Hole': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => lastSummonOk(g, s => s.p !== p && s.cs.some(x => onField(x) && faceUp(x) && stat(g, x, 'atk') >= 1500)),
    target: function* (g, c, p, L) { L.data.cs = g.sw.cs.slice(); },
    res: function* (g, c, p, L) { destroy(g, L.data.cs.filter(x => onField(x) && faceUp(x) && stat(g, x, 'atk') >= 1500), { by: p, banish: true }); } }] },
  'Dimensional Prison': { effs: [{ type: 'act', cond: (g, c, p) => g.aw && g.aw.a.ctrl !== p,
    target: function* (g, c, p, L) { L.t = [g.aw.a]; },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (t) { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished.`); } } }] },
  'Icarus Attack': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Winged Beast') && allField(g).filter(x => x !== c).length >= 2,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute a Winged Beast', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Winged Beast'), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which 2 cards?', allField(g).filter(x => x !== c), 2, 2, 'bad'); },
    res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'Legacy of Yata-Garasu': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 1, res: function* (g, c, p) { draw(g, p, 1); } }] },
  'Mirror Force': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => g.aw && g.aw.a.ctrl !== p,
    res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)).filter(x => x.pos === 'atk'), { by: p }); } }] },
  'Solemn Judgment': { effs: [{ type: 'act', negSummon: true,
    cond: (g, c, p, x) => (!x.top && g.attempt) || spellTrapAct(x.top),
    cost: function* (g, c, p, L) { pay(g, p, Math.floor(g.p[p].lp / 2)); },
    target: function* (g, c, p, L) { L.data.mode = g.chain.length ? 'link' : 'summon'; L.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L) { if (L.data.mode === 'summon') { if (g.attempt) { g.attempt.negated = true; log(g, 'The summon was negated.'); } } else { L.data.L.negBy = p; negate(g, L.data.L, true); } } }] },
  'Trap Dustshoot': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length >= 4,
    res: function* (g, c, p) { const h = g.p[opp(p)].hand; log(g, `${PN(g, p)} looked at ${PN(g, opp(p))}'s hand.`); const mons = h.filter(isMon); if (!mons.length) return; const [x] = yield* pick(g, p, 'Shuffle which monster into the Deck?', mons, 1, 1, 'bad'); move(g, x, 'deck', { reason: 'effect' }); log(g, `${name(x)} was shuffled into the Deck.`); } }] },
  'Ally of Justice Catastor': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 },
    on: (g, ev, c) => ev.type === 'dsStart' && (ev.a === c || ev.t === c) && (() => { const o = ev.a === c ? ev.t : ev.a; return o && attr(o) !== 'DARK'; })(),
    res: function* (g, c, p, L) { const o = L.ev.a === c ? L.ev.t : L.ev.a; if (o && onField(o)) destroy(g, [o], { by: p }); } }] },
  'Black Rose Dragon': { effs: [
    { type: 'trig', when: true, tags: { destroy: 1 }, label: 'Destroy all cards on the field', on: (g, ev, c) => evSummoned(ev, c, ['synchro']),
      res: function* (g, c, p) { destroy(g, allField(g), { by: p }); } },
    { type: 'ign', opt: true, label: 'Make a Defense monster 0 ATK',
      cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && race(x) === 'Plant') && monsOf(g, opp(p)).some(x => x.pos !== 'atk'),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish a Plant from your GY', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Plant'), 1, 1, 'cost'); move(g, x, 'ban', { reason: 'cost' }); },
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Change which Defense Position monster?', monsOf(g, opp(p)).filter(x => x.pos !== 'atk'), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (t && t.pos !== 'atk') { if (t.pos === 'set') log(g, `It was ${name(t)}.`); t.pos = 'atk'; addMod(g, t, { set: 0, which: 'atk', end: true }); log(g, `${name(t)} is in Attack Position with 0 ATK.`); } } }] },
  'Blackwing - Silverwind the Ascendant': { effs: [{ type: 'trig', when: true, tags: { destroy: 1 }, label: 'Destroy up to 2 monsters',
    on: (g, ev, c) => evSummoned(ev, c, ['synchro']),
    cond: (g, c, p) => fieldMons(g).some(x => x !== c && faceUp(x) && stat(g, x, 'def') < stat(g, c, 'atk')),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy up to 2 face-up monsters', fieldMons(g).filter(x => x !== c && faceUp(x) && stat(g, x, 'def') < stat(g, c, 'atk')), 1, 2, 'bad'); g.noBP[p] = true; },
    res: function* (g, c, p, L) { destroy(g, live(L).filter(x => faceUp(x) && onField(c) && stat(g, x, 'def') < stat(g, c, 'atk')), { by: p }); } }] },
  'Blackwing Armor Master': { effs: [
    { type: 'trig', when: true, on: (g, ev, c) => ev.type === 'dsEnd' && ev.a === c && ev.t && onField(ev.t), label: 'Place a Wedge Counter',
      res: function* (g, c, p, L) { const t = L.ev.t; if (t && onField(t)) { t.flags.wedge = 1; log(g, `${name(t)} got a Wedge Counter.`); } } },
    { type: 'quick', ds: true, label: 'Remove Wedge Counters', cond: (g, c, p) => monsOf(g, opp(p)).some(x => x.flags.wedge),
      res: function* (g, c, p) { for (const x of monsOf(g, opp(p))) if (x.flags.wedge) { x.flags.wedge = 0; addMod(g, x, { set: 0, which: 'both', end: true }); log(g, `${name(x)}'s ATK and DEF became 0.`); } } }] },
  'Brionac, Dragon of the Ice Barrier': { effs: [{ type: 'ign', opt: true, label: 'Discard to bounce cards',
    cond: (g, c, p) => g.p[p].hand.length > 0 && allField(g).length > 0,
    cost: function* (g, c, p, L) { const n = yield* choose(g, p, 'Discard how many cards?', [...Array(Math.min(g.p[p].hand.length, allField(g).length)).keys()].map(i => String(i + 1))); const ds = yield* pick(g, p, `Discard ${n + 1} card${n ? 's' : ''}`, g.p[p].hand, n + 1, n + 1, 'cost'); for (const x of ds) move(g, x, 'gy', { reason: 'cost' }); L.data.n = n + 1; },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, `Return ${L.data.n} card(s) to the hand`, allField(g), L.data.n, L.data.n, 'bad'); },
    res: function* (g, c, p, L) { for (const t of live(L)) move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${L.t.map(D).map(d => d.n).join(', ')} returned to the hand.`); } }] },
  'Colossal Fighter': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && allCards(g, 'gy').some(x => isMon(x) && race(x) === 'Warrior'),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which Warrior from either GY?', allCards(g, 'gy').filter(x => isMon(x) && race(x) === 'Warrior'), 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  'Dark End Dragon': { effs: [{ type: 'ign', opt: true, label: 'Send a monster to the GY', cond: (g, c, p) => monsOf(g, opp(p)).length > 0 && stat(g, c, 'atk') >= 500 && stat(g, c, 'def') >= 500,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Send which monster to the GY?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { if (!onField(c) || stat(g, c, 'atk') < 500 || stat(g, c, 'def') < 500) return; addMod(g, c, { atk: -500, def: -500 }); const t = live(L)[0]; if (t) { move(g, t, 'gy', { reason: 'effect', by: p }); log(g, `${D(t).n} was sent to the GY.`); } } }] },
  'Goyo Guardian': { effs: [{ type: 'trig', tags: { ss: 1 }, on: (g, ev, c) => battleKill(ev, c), cond: (g, c, p, x) => freeM(g, p) >= 0 && x.ev.c.zone === 'gy',
    res: function* (g, c, p, L) { const t = L.ev.c; if (t.zone === 'gy') ss(g, p, t, 'def'); } }] },
  'Magical Android': { effs: [{ type: 'trig', mand: true, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
    res: function* (g, c, p) { gain(g, p, 600 * monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Psychic').length); } }] },
  'Stardust Dragon': { effs: [
    { type: 'quick', label: 'Tribute to negate', speed: 2,
      cond: (g, c, p, x) => x.top && x.top.tags && x.top.tags.destroy && !x.top.negated,
      cost: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; g.stardust = g.stardust || {}; g.stardust[c.u] = g.turnNo; move(g, c, 'gy', { reason: 'cost' }); },
      res: function* (g, c, p, L) { L.data.L.negBy = p; negate(g, L.data.L, true); } },
    { type: 'trig', loc: 'gy', tags: { ss: 1 }, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && g.stardust && g.stardust[c.u] === g.turnNo,
      cond: (g, c, p) => freeM(g, p) >= 0, res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c); } }] },
  'Thought Ruler Archfiend': { effs: [
    { type: 'trig', mand: true, on: (g, ev, c) => battleKill(ev, c), res: function* (g, c, p, L) { gain(g, p, baseAtk(L.ev.c)); } },
    { type: 'quick', label: 'Pay 1000 to negate', cond: (g, c, p, x) => spellTrapAct(x.top) && x.top.t.length === 1 && isMon(x.top.t[0]) && race(x.top.t[0]) === 'Psychic' && g.p[p].lp > 1000,
      cost: function* (g, c, p, L) { pay(g, p, 1000); L.data.L = g.chain[g.chain.length - 1]; }, res: function* (g, c, p, L) { L.data.L.negBy = p; negate(g, L.data.L, true); } }] },
  /* ----- Hybrid / Dark ----- */
  'Armageddon Knight': { effs: [{ type: 'trig', when: true, on: (g, ev, c) => evSummoned(ev, c), cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && attr(x) === 'DARK'),
    res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && attr(x) === 'DARK', 'Send a DARK monster from your Deck to the GY', 'gy'); } }] },
  'Plaguespreader Zombie': { effs: [{ type: 'ign', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon from the GY', cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Put a card from your hand on top of your Deck', g.p[p].hand, 1, 1, 'cost'); move(g, x, 'deckTop', { reason: 'cost' }); },
    res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c, 'atk', { banishOnLeave: true }); } }] },
  'Caius the Shadow Monarch': { effs: [{ type: 'trig', mand: true, on: (g, ev, c) => evSummoned(ev, c, ['tribute']), cond: (g) => allField(g).length > 0,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Banish which card?', allField(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (!t) return; const dark = isMon(t) && faceUp(t) && attr(t) === 'DARK', o = t.ctrl; move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished.`); if (dark) damage(g, o === p ? opp(p) : o, 1000, { src: c, srcP: p }); } }] },
  'Card Trooper': { effs: [
    { type: 'ign', opt: true, label: 'Send 1-3 cards to the GY for ATK', cond: (g, c, p) => g.p[p].deck.length > 1,
      cost: function* (g, c, p, L) { const n = yield* choose(g, p, 'Send how many cards from the top of your Deck?', ['1', '2', '3'].slice(0, Math.min(3, g.p[p].deck.length - 1))); L.data.n = n + 1; },
      res: function* (g, c, p, L) { const out = mill(g, p, L.data.n); if (onField(c) && faceUp(c)) addMod(g, c, { atk: 500 * out.length, end: true }); } },
    { type: 'trig', loc: 'gy', mand: true, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField && ev.to === 'gy' && ev.prevCtrl === c.owner,
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  'Dark Grepher': { proc: { label: 'Special Summon (discard a Level 5+ DARK)', cond: (g, c, p) => g.p[p].hand.some(x => x !== c && isMon(x) && lv(x) >= 5 && attr(x) === 'DARK'),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Discard a Level 5 or higher DARK', g.p[p].hand.filter(x => x !== c && isMon(x) && lv(x) >= 5 && attr(x) === 'DARK'), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'discard', group: grp }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    effs: [{ type: 'ign', opt: true, label: 'Discard a DARK: send a DARK', cond: (g, c, p) => g.p[p].hand.some(x => isMon(x) && attr(x) === 'DARK') && g.p[p].deck.some(x => isMon(x) && attr(x) === 'DARK'),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard a DARK monster', g.p[p].hand.filter(x => isMon(x) && attr(x) === 'DARK'), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); },
      res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && attr(x) === 'DARK', 'Send a DARK monster from your Deck to the GY', 'gy'); } }] },
  'Super-Nimble Mega Hamster': { effs: [{ type: 'trig', tags: { ss: 1 }, faceDownOk: true, on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && race(x) === 'Beast' && lv(x) <= 3),
    res: function* (g, c, p) { const cands = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Beast' && lv(x) <= 3); const [x] = yield* pick(g, p, 'Special Summon a Level 3 or lower Beast face-down', cands, 1, 1, 'good'); if (x) ss(g, p, x, 'set'); shuffleDeck(g, p); } }] },
  'Ryko, Lightsworn Hunter': { effs: [{ type: 'trig', tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    target: function* (g, c, p, L) { const cands = allField(g).filter(x => x !== c); if (cands.length) yield* tgt(g, p, L, 'Destroy which card?', cands, 1, 1, 'bad'); },
    res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); mill(g, p, 3); } }] },
  'Spirit Reaper': { effs: [{ type: 'trig', mand: true, on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.direct && ev.src === c,
    res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, opp(p))} discarded ${name(x)} at random.`); } }] },
  'Reinforcement of the Army': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && race(x) === 'Warrior' && lv(x) <= 4),
    res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && race(x) === 'Warrior' && lv(x) <= 4, 'Add a Level 4 or lower Warrior'); } }] },
  'Burial from a Different Dimension': { effs: [{ type: 'act', cond: (g) => allCards(g, 'ban').some(isMon),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Return up to 3 banished monsters to the GY', allCards(g, 'ban').filter(isMon), 1, 3, 'good'); },
    res: function* (g, c, p, L) { for (const t of L.t) if (t.zone === 'ban') move(g, t, 'gy', { reason: 'effect' }); log(g, `${L.t.map(x => D(x).n).join(', ')} returned to the GY.`); } }] },
  'Dust Tornado': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => stOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which Spell/Trap?', stOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); const st = g.p[p].hand.filter(isST); if (st.length && freeST(g, p) >= 0 && (yield* yn(g, p, 'Set a Spell/Trap from your hand?'))) { const [x] = yield* pick(g, p, 'Set which card?', st, 1, 1, 'good'); move(g, x, 'st', { ctrl: p, pos: 'set', reason: 'set' }); log(g, `${PN(g, p)} Set a card.`); } } }] },
  'Royal Oppression': { effs: [{ type: 'act', res: function* () {} },
    { type: 'quick', loc: 'st', anyPlayer: true, negSummon: true, label: 'Pay 800: negate the Special Summon',
      cond: (g, c, p, x) => g.p[p].lp > 800 && ((!x.top && g.attempt && !['normal', 'tribute', 'flip'].includes(g.attempt.how)) || (x.top && x.top.tags && x.top.tags.ss && !x.top.negated)),
      cost: function* (g, c, p, L) { pay(g, p, 800); L.data.mode = g.chain.length ? 'link' : 'summon'; L.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L) { if (L.data.mode === 'summon') { if (g.attempt) { g.attempt.negated = true; log(g, 'The Special Summon was negated.'); } } else { L.data.L.negBy = p; negate(g, L.data.L, true); } } }] },
  'Compulsory Evacuation Device': { effs: [{ type: 'act', cond: (g) => fieldMons(g).length > 0,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Return which monster to the hand?', fieldMons(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (t) { move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${D(t).n} returned to the ${isExtraD(D(t)) ? 'Extra Deck' : 'hand'}.`); } } }] },
  'Torrential Tribute': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g) => !!g.sw,
    res: function* (g, c, p) { destroy(g, fieldMons(g), { by: p }); } }] },
  'Dark Bribe': { effs: [{ type: 'act', cond: (g, c, p, x) => spellTrapAct(x.top) && x.top.p !== p,
    target: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L) { const o = L.data.L.p; if (g.p[o].deck.length) draw(g, o, 1); L.data.L.negBy = p; negate(g, L.data.L, true); } }] },
  'Battle Fader': { effs: [{ type: 'trig', loc: 'hand', tags: { ss: 1 }, on: (g, ev, c) => ev.type === 'attack' && ev.direct && ev.p !== c.owner,
    cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) { if (c.zone === 'hand' && ss(g, p, c, 'def', { banishOnLeave: true })) { g.bpEnd = true; g.aw = null; log(g, 'The Battle Phase ended.'); } } }] },
  /* ----- Frogs and HEROes ----- */
  'Dupe Frog': { effs: [{ type: 'trig', loc: 'gy', when: true, on: (g, ev, c) => fromFieldToGY(ev, c),
    cond: (g, c, p) => [...g.p[p].deck, ...g.p[p].gy].some(x => isMon(x) && /Frog/.test(D(x).n) && D(x).n !== 'Dupe Frog'),
    res: function* (g, c, p) { const cands = [...g.p[p].deck, ...g.p[p].gy].filter(x => isMon(x) && /Frog/.test(D(x).n) && D(x).n !== 'Dupe Frog'); const [x] = yield* pick(g, p, 'Add a Frog from your Deck or GY to your hand', cands, 1, 1, 'good'); if (x) { const fromDeck = x.zone === 'deck'; move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(x)} to the hand.`); if (fromDeck) shuffleDeck(g, p); } } }] },
  'Elemental HERO Ocean': { effs: [{ type: 'trig', opt: true, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    cond: (g, c, p) => [...monsOf(g, p).filter(faceUp), ...g.p[p].gy].some(x => isMon(x) && isHERO(x)),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Return which HERO to your hand?', [...monsOf(g, p).filter(faceUp), ...g.p[p].gy].filter(x => isMon(x) && isHERO(x)), 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = L.t[0]; if (t && (t.zone === 'gy' || onField(t))) { move(g, t, 'hand', { reason: 'effect' }); log(g, `${D(t).n} returned to the hand.`); } } }] },
  'Elemental HERO Stratos': { effs: [{ type: 'trig', when: true, on: (g, ev, c) => evSummoned(ev, c) && ev.how !== 'flip',
    res: function* (g, c, p) { const heroes = monsOf(g, p).filter(x => x !== c && faceUp(x) && isHERO(x)).length; const canD = heroes > 0 && stOnField(g).length > 0; const i = canD ? yield* choose(g, p, 'Stratos: choose an effect', ['Destroy Spells/Traps', 'Add a HERO from your Deck']) : 1;
      if (i === 0) { const ts = yield* pick(g, p, `Destroy up to ${heroes} Spell/Trap card(s)`, stOnField(g), 1, heroes, 'bad'); destroy(g, ts, { by: p }); } else yield* search(g, p, x => isMon(x) && isHERO(x), 'Add a HERO from your Deck'); } }] },
  'Evil HERO Infernal Prodigy': { proc: { cond: (g, c, p) => monsOf(g, p).length === 0, label: 'Special Summon (you control no monsters)' },
    effs: [{ type: 'trig', loc: 'gy', mand: true, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.prodigy === g.turnNo, res: function* (g, c, p) { draw(g, p, 1); } },
      { type: 'trig', loc: 'gy', mand: true, on: (g, ev, c) => { if (ev.type === 'summon' && ev.how === 'tribute' && ev.tribs && ev.tribs.includes(c) && ev.cs.some(isHERO)) c.flags.prodigy = g.turnNo; return false; }, res: function* () {} }] },
  'Gorz the Emissary of Darkness': { effs: [{ type: 'trig', loc: 'hand', when: true, tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'damage' && ev.p === c.owner && ev.srcP === 1 - c.owner,
    cond: (g, c, p) => fieldOf(g, p).length === 0,
    res: function* (g, c, p, L) { if (c.zone !== 'hand' || fieldOf(g, p).length) return; if (!ss(g, p, c)) return; const ev = L.ev;
      if (ev.battle) { if (freeM(g, p) >= 0) { const t = mk(g, 'tok-gorz', p); t.zone = 'tok'; t.flags.tokAtk = ev.n; move(g, t, 'm', { ctrl: p, pos: 'atk', reason: 'summon' }); t.flags.tokAtk = ev.n; t.flags.tokDef = ev.n; addMod(g, t, { set: ev.n, which: 'def' }); log(g, `${PN(g, p)} Special Summoned an Emissary of Darkness Token with ${ev.n} ATK.`); } }
      else damage(g, opp(p), ev.n, { src: c, srcP: p }); } }] },
  'Junk Synchron': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, on: (g, ev, c) => evSummoned(ev, c, ['normal']),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && lv(x) <= 2),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon a Level 2 or lower monster from your GY', g.p[p].gy.filter(x => isMon(x) && lv(x) <= 2), 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'def', { negate: true }); } }] },
  'Raiza the Storm Monarch': { effs: [{ type: 'trig', mand: true, on: (g, ev, c) => evSummoned(ev, c, ['tribute']), cond: g => allField(g).length > 0,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Return which card to the top of the Deck?', allField(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (t) { move(g, t, 'deckTop', { reason: 'effect', by: p }); log(g, `${D(t).n} was put on top of the Deck.`); } } }] },
  'Substitoad': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Tribute a monster: summon a Frog', cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && /Frog/.test(D(x).n)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute a monster', monsOf(g, p), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
    res: function* (g, c, p) { const cands = g.p[p].deck.filter(x => isMon(x) && /Frog/.test(D(x).n)); const [x] = yield* pick(g, p, 'Special Summon a Frog from your Deck', cands, 1, 1, 'good'); if (x) ss(g, p, x); shuffleDeck(g, p); } }] },
  'Swap Frog': { proc: { label: 'Special Summon (discard a WATER)', cond: (g, c, p) => g.p[p].hand.some(x => x !== c && isMon(x) && attr(x) === 'WATER'),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Discard a WATER monster', g.p[p].hand.filter(x => x !== c && isMon(x) && attr(x) === 'WATER'), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'discard', group: grp }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    effs: [{ type: 'trig', when: true, on: (g, ev, c) => evSummoned(ev, c), cond: (g, c, p) => [...g.p[p].deck, ...monsOf(g, p).filter(x => x !== c && faceUp(x))].some(x => isMon(x) && lv(x) <= 2 && attr(x) === 'WATER' && race(x) === 'Aqua'),
      res: function* (g, c, p) { const cands = [...g.p[p].deck, ...monsOf(g, p).filter(x => faceUp(x))].filter(x => isMon(x) && lv(x) <= 2 && attr(x) === 'WATER' && race(x) === 'Aqua'); const [x] = yield* pick(g, p, 'Send a Level 2 or lower WATER Aqua to the GY', cands, 1, 1, 'cost'); if (x) { const fromDeck = x.zone === 'deck'; move(g, x, 'gy', { reason: 'effect' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); if (fromDeck) shuffleDeck(g, p); } } },
      { type: 'ign', opt: true, label: 'Return a monster: extra Frog summon', cond: (g, c, p) => monsOf(g, p).length > 0,
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Return a monster you control to the hand', monsOf(g, p), 1, 1, 'cost'); move(g, x, 'hand', { reason: 'cost' }); log(g, `${PN(g, p)} returned ${D(x).n} to the hand.`); },
        res: function* (g, c, p) { g.frogNS[p] = true; log(g, `${PN(g, p)} can Normal Summon a Frog once more this turn.`); } }] },
  'Treeborn Frog': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 }, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner,
    cond: (g, c, p) => freeM(g, p) >= 0 && stOf(g, p).length === 0 && !monsOf(g, p).some(x => faceUp(x) && D(x).n === 'Treeborn Frog'),
    res: function* (g, c, p) { if (c.zone === 'gy' && stOf(g, p).length === 0) ss(g, p, c); } }] },
  'E - Emergency Call': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && /^Elemental HERO/.test(D(x).n)),
    res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && /^Elemental HERO/.test(D(x).n), 'Add an Elemental HERO'); } }] },
  'Enemy Controller': { effs: [{ type: 'act', cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    cost: function* (g, c, p, L) { const canTake = monsOf(g, p).length > 0; L.data.mode = canTake ? yield* choose(g, p, 'Enemy Controller: choose', ['Change its battle position', 'Tribute a monster and take control']) : 0;
      if (L.data.mode === 1) { const [x] = yield* pick(g, p, 'Tribute a monster', monsOf(g, p), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); } },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, L.data.mode ? 'Take control of which monster?' : 'Change the position of which monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !faceUp(t)) return; if (L.data.mode) takeControl(g, p, t, true); else { t.pos = t.pos === 'atk' ? 'def' : 'atk'; log(g, `${name(t)} changed to ${t.pos === 'atk' ? 'Attack' : 'Defense'} Position.`); } } }] },
  'Miracle Fusion': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].extra.some(x => fusionMats(g, p, x).length),
    res: function* (g, c, p) { const fs = g.p[p].extra.filter(x => fusionMats(g, p, x).length); if (!fs.length) return; const [f] = yield* pick(g, p, 'Fusion Summon which Elemental HERO?', fs, 1, 1, 'good'); const cs = fusionMats(g, p, f); let mats = cs[0]; if (cs.length > 1) { const i = yield* choose(g, p, 'Banish which materials?', cs.map(m => m.map(x => D(x).n).join(' + '))); mats = cs[i]; }
      for (const m of mats) move(g, m, 'ban', { reason: 'fusion' }); log(g, `${PN(g, p)} banished ${mats.map(x => D(x).n).join(' + ')}.`); ss(g, p, f, 'atk', { how: 'fusion' }); } }] },
  'One for One': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => x !== c && isMon(x)) && [...g.p[p].hand, ...g.p[p].deck].some(x => isMon(x) && lv(x) === 1 && !isExtraD(D(x))),
    cost: function* (g, c, p, L) { const [x] = yield* pick(g, p, 'Send a monster from your hand to the GY', g.p[p].hand.filter(x => x !== c && isMon(x)), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); },
    res: function* (g, c, p) { const cands = [...g.p[p].hand, ...g.p[p].deck].filter(x => isMon(x) && lv(x) === 1 && !/Cannot be Special Summoned/i.test(D(x).ps || '')); const [x] = yield* pick(g, p, 'Special Summon a Level 1 monster from your hand or Deck', cands, 1, 1, 'good'); if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x); if (fromDeck) shuffleDeck(g, p); } } }] },
  'Soul Exchange': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, opp(p)).length > 0 && g.phase === 'main1',
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Tribute which of their monsters this turn?', monsOf(g, opp(p)), 1, 1, 'bad'); g.noBP[p] = true; },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (t) { g.soulEx[p] = t.u; log(g, `${PN(g, p)} can Tribute ${shown(g, t)} this turn.`); } } }] },
  'Raigeki Break': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => g.p[p].hand.length > 0 && allField(g).some(x => x !== c),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard a card', g.p[p].hand, 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which card?', allField(g).filter(x => x !== c), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'Elemental HERO Absolute Zero': { effs: [{ type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField,
    res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)), { by: p }); } }] },
  'Elemental HERO Gaia': { effs: [{ type: 'trig', mand: true, on: (g, ev, c) => evSummoned(ev, c, ['fusion']), cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Halve the ATK of which monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !faceUp(t) || !onField(c)) return; const A = stat(g, t, 'atk'), h = A - Math.floor(A / 2); addMod(g, t, { atk: -h, end: true }); addMod(g, c, { atk: h, end: true }); log(g, `${name(t)} lost ${h} ATK and Gaia gained it.`); } }] },
  'Armory Arm': { effs: [{ type: 'ign', opt: true, label: 'Equip to a monster', cond: (g, c, p) => fieldMons(g).some(x => x !== c && faceUp(x)) && freeST(g, p) >= 0,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Equip Armory Arm to which monster?', fieldMons(g).filter(x => x !== c && faceUp(x)), 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !onField(c) || freeST(g, p) < 0) return; move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); c.equipTo = t.u; log(g, `Armory Arm was equipped to ${name(t)} (+1000 ATK).`); } },
    { type: 'trig', loc: 'st', mand: true, on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.killer && ev.killer.u === c.equipTo && ev.to === 'gy',
      res: function* (g, c, p, L) { damage(g, L.ev.c.owner, L.ev.snap ? L.ev.snap.atk : 0, { src: c, srcP: p }); } }] },
  'Junk Warrior': { effs: [{ type: 'trig', mand: true, on: (g, ev, c) => evSummoned(ev, c, ['synchro']),
    res: function* (g, c, p) { if (!onField(c)) return; const add = monsOf(g, p).filter(x => faceUp(x) && lv(x) <= 2).reduce((s, x) => s + stat(g, x, 'atk'), 0); addMod(g, c, { atk: add }); log(g, `Junk Warrior gained ${add} ATK.`); } }] },
  'Mist Wurm': { effs: [{ type: 'trig', mand: true, on: (g, ev, c) => evSummoned(ev, c, ['synchro']), cond: (g, c, p) => fieldOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Return up to 3 of their cards to the hand', fieldOf(g, opp(p)), 1, 3, 'bad'); },
    res: function* (g, c, p, L) { const ts = live(L); for (const t of ts) move(g, t, 'hand', { reason: 'effect', by: p }); if (ts.length) log(g, `${ts.length} card(s) returned to the hand.`); } }] },
  'Unifrog': { effs: [{ type: 'trig', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.direct && ev.src === c,
    cond: (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x) && isFrog(x)) && stOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which Spell/Trap?', stOf(g, opp(p)), 1, 1, 'bad'); },
    tags: { destroy: 1 }, res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'Mobius the Frost Monarch': { effs: [{ type: 'trig', tags: { destroy: 1 }, on: (g, ev, c) => evSummoned(ev, c, ['tribute']), cond: g => stOnField(g).length > 0,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy up to 2 Spells/Traps', stOnField(g), 1, 2, 'bad'); },
    res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'Tragoedia': { effs: [
    { type: 'trig', loc: 'hand', tags: { ss: 1 }, on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.p === c.owner, cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { if (c.zone === 'hand') ss(g, p, c); } },
    { type: 'ign', opt: true, label: 'Take control of a monster', cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && oppFaceUp(g, p).some(t => lv(t) === lv(x))),
      cost: function* (g, c, p, L) { const [x] = yield* pick(g, p, 'Send a monster from your hand to the GY', g.p[p].hand.filter(x => isMon(x) && oppFaceUp(g, p).some(t => lv(t) === lv(x))), 1, 1, 'cost'); L.data.lv = lv(x); move(g, x, 'gy', { reason: 'cost' }); },
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Take control of which monster?', oppFaceUp(g, p).filter(t => lv(t) === L.data.lv), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (t && faceUp(t)) takeControl(g, p, t, false); } },
    { type: 'ign', opt: true, label: 'Copy a Level', cond: (g, c, p) => g.p[p].gy.some(isMon),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Copy the Level of which monster in your GY?', g.p[p].gy.filter(isMon), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (t && onField(c)) { c.flags.lv = lv(t); c.flags.lvUntil = true; log(g, `Tragoedia's Level became ${lv(t)}.`); } } }] },
  'Gold Sarcophagus': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length > 0,
    res: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish which card from your Deck?', g.p[p].deck, 1, 1, 'good'); if (x) { move(g, x, 'ban', { reason: 'effect' }); g.goldSarc.push({ c: x, p, n: 0 }); log(g, `${PN(g, p)} banished ${name(x)} face-up with Gold Sarcophagus.`); } shuffleDeck(g, p); } }] },
  'Scapegoat': { effs: [{ type: 'act', cond: (g, c, p) => nFreeM(g, p) >= 4 && !g.summoned[p],
    after: (g, c, p) => { g.noSummon[p] = true; },
    res: function* (g, c, p) { const grp = g.group; const toks = []; for (let i = 0; i < 4; i++) { if (freeM(g, p) < 0) break; const t = mk(g, 'tok-sheep', p); t.zone = 'tok'; move(g, t, 'm', { ctrl: p, pos: 'def', reason: 'summon', group: grp }); toks.push(t); } log(g, `${PN(g, p)} Special Summoned ${toks.length} Sheep Tokens.`); const ev = emit(g, { type: 'summon', cs: toks, how: 'special', p, byEffect: true }, grp); g.sw = { cs: toks, p, how: 'special', group: ev.group }; } }] },
  'Cold Wave': { effs: [{ type: 'act', cond: (g, c, p) => g.phase === 'main1' && g.mainStart,
    res: function* (g, c, p) { g.coldWave = { p }; log(g, 'Until their next turn, no Spells or Traps can be Set or activated.'); } }] },
  'Threatening Roar': { effs: [{ type: 'act', cond: (g, c, p) => g.tp !== p && ['standby', 'main1', 'battle', 'draw'].includes(g.phase) && !g.inDS,
    res: function* (g, c, p) { g.roar = opp(p); log(g, `${PN(g, opp(p))} can't declare an attack this turn.`); } }] },
  'Flamvell Uruquizas': { effs: [{ type: 'trig', mand: true, on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl, res: function* (g, c) { if (onField(c)) { addMod(g, c, { atk: 300 }); log(g, 'Flamvell Uruquizas gained 300 ATK.'); } } }] },
  'X-Saber Urbellum': { effs: [{ type: 'trig', mand: true, on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl && g.p[ev.p].hand.length >= 4,
    res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'deckTop', { reason: 'effect' }); log(g, `A random card from ${PN(g, opp(p))}'s hand went on top of the Deck.`); } }] },
  'Red Dragon Archfiend': { effs: [
    { type: 'trig', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'afterCalc' && ev.a === c && ev.t && ev.tWasDef,
      res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)).filter(x => x.pos !== 'atk'), { by: p }); } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) destroy(g, monsOf(g, p).filter(x => x !== c && !x.declared), { by: p }); } }] },
};
function fusionMats(g, p, f) {
  const n = D(f).n, pool = [...monsOf(g, p).filter(faceUp), ...g.p[p].gy.filter(isMon)];
  let A, B; if (n === 'Elemental HERO Absolute Zero') { A = x => isHERO(x); B = x => attr(x) === 'WATER'; } else if (n === 'Elemental HERO Gaia') { A = x => isEHERO(x); B = x => attr(x) === 'EARTH'; } else return [];
  if (freeM(g, p) < 0 && !monsOf(g, p).length) return [];
  const out = []; for (const a of pool) for (const b of pool) if (a !== b && A(a) && B(b)) { if (!out.some(m => m.includes(a) && m.includes(b))) out.push([a, b]); }
  return out.slice(0, 8);
}
SCRIPTS['Chimeratech Fortress Dragon'] = { effs: [] }; // its summon rule is in cfCombos
// Cyber Dragon and Neos Alius: no script needed for the Best decks beyond their summon rule.
SCRIPTS['Cyber Dragon'] = { proc: { cond: (g, c, p) => monsOf(g, p).length === 0 && monsOf(g, opp(p)).length > 0, label: 'Special Summon (only they control a monster)' } };
// Gemini (Neos Alius) and the 2010-only monsters plays as their printed stats.
['Elemental HERO Neos Alius', 'Evil HERO Malicious Edge', 'Superalloy Beast Raptinus', 'Blackwing Armed Wing', 'Blackwing - Bora the Spear'].forEach(n => { SCRIPTS[n] = SCRIPTS[n] || { effs: [] }; });
SCRIPTS['Blackwing - Bora the Spear'].effs = SCRIPTS['Blackwing - Bora the Spear'].effs || [];

/* ---------- helpers for card scripts (also used by js/cards/*.js) ---------- */
function equip(g, eq, target) { if (!onField(eq) || !onField(target)) return false; eq.equipTo = target.u; log(g, `${name(eq)} was equipped to ${name(target)}.`); return true; }
const equippedTo = (g, eq) => eq.equipTo ? fieldMons(g).find(x => x.u === eq.equipTo) || null : null;
function link(g, st, m) { st.linkTo = m.u; }
function addCtr(g, c, kind, n = 1) { c.ctr = c.ctr || {}; c.ctr[kind] = Math.max(0, (c.ctr[kind] || 0) + n); }
const ctr = (c, kind) => (c.ctr && c.ctr[kind]) || 0;
function negateAttack(g) { g.attackNegated = true; }
function endBattle(g) { g.bpEnd = true; g.aw = null; g.attackNegated = true; log(g, 'The Battle Phase ended.'); }
/* A temporary rule: forbid(g, action) like cont.forbid; end: the turn number at whose End Phase it ends; startOf: the player whose next turn ends it */
function addRule(g, forbidFn, o = {}) { g.rules.push({ forbid: forbidFn, end: o.end, startOf: o.startOf }); }
function token(g, p, t, pos = 'def', o = {}) {
  const id = 'tok-' + t.n.replace(/\s+/g, '-').toLowerCase();
  if (!DATA.has(id)) { const d = { id, n: t.n, k: 'token', a: t.a || 'EARTH', r: t.r || 'Fiend', lv: t.lv || 1, atk: String(t.atk || 0), def: String(t.def || 0) }; DATA.set(id, d); BYNAME.set(d.n, d); }
  if (freeM(g, p) < 0) return null;
  if (forbid(g, { type: 'ss', c: { id, owner: p, flags: {}, zone: 'tok' }, p, how: 'special' })) return null;
  const c = mk(g, id, p); c.zone = 'tok'; move(g, c, 'm', { ctrl: p, pos, reason: 'summon', group: o.group });
  if (o.noTribute) c.flags.noTribute = true;
  return c;
}
function tokens(g, p, t, n, pos = 'def', o = {}) {
  const grp = g.group, out = [];
  for (let i = 0; i < n; i++) { const c = token(g, p, t, pos, { ...o, group: grp }); if (c) out.push(c); }
  if (out.length) { log(g, `${PN(g, p)} Special Summoned ${out.length} ${t.n}${out.length > 1 ? 's' : ''}.`); const ev = emit(g, { type: 'summon', cs: out, how: 'special', p, byEffect: true }, grp); g.sw = { cs: out, p, how: 'special', group: ev.group }; }
  return out;
}
/* Fusion materials: a script's `mats` (array of predicates) or the first line of the Fusion's text. */
const ATTRS = ['DARK', 'LIGHT', 'FIRE', 'WATER', 'EARTH', 'WIND'];
function fusionRecipe(fx) {
  const sc = SCRIPTS[D(fx).n]; if (sc && sc.mats) return sc.mats;
  const first = (D(fx).ps || D(fx).tx || '').split('\n')[0].replace(/^①\s*/, '');
  const parts = first.split(/\s\+\s/); const out = [];
  for (let part of parts) {
    part = part.trim(); let n = 1; const m = part.match(/^(\d+)\s+/); if (m) { n = +m[1]; part = part.slice(m[0].length); }
    let f = null; const q = part.match(/^"([^"]+)"$/) || part.match(/^"?([^"]+?)"?$/);
    const qq = part.match(/"([^"]+)"/);
    if (/^"[^"]+"$/.test(part) || (!/monster/i.test(part) && qq)) { const nm = qq ? qq[1] : q[1]; f = c => D(c).n === nm || name(c) === nm; }
    else if (qq && /monster/i.test(part)) { const nm = qq[1]; f = c => name(c).includes(nm); }
    else { const at = ATTRS.find(a => part.includes(a)); const rc = part.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)?)-Type/); if (at) f = c => attr(c) === at; else if (rc) f = c => race(c) === rc[1]; }
    if (!f || /or more/.test(part)) return null;
    for (let i = 0; i < n; i++) out.push(f);
  }
  return out.length >= 2 ? out : null;
}
function assignMats(preds, pool, limit = 12) {
  const out = [];
  const rec = (i, used) => { if (out.length >= limit) return; if (i === preds.length) { out.push(used.slice()); return; } for (const c of pool) if (!used.includes(c) && isMon(c) && preds[i](c)) { used.push(c); rec(i + 1, used); used.pop(); } };
  rec(0, []);
  const seen = new Set(); return out.filter(m => { const k = m.map(c => c.u).sort().join(','); if (seen.has(k)) return false; seen.add(k); return true; });
}
function fusionPool(g, p, from) { const out = []; for (const z of from) { if (z === 'hand') out.push(...g.p[p].hand); else if (z === 'm') out.push(...monsOf(g, p).filter(faceUp)); else if (z === 'gy') out.push(...g.p[p].gy); else if (z === 'deck') out.push(...g.p[p].deck); } return out; }
function canFusion(g, p, o = {}) { const from = o.from || ['hand', 'm']; const pool = fusionPool(g, p, from); return g.p[p].extra.some(fx => D(fx).k === 'fusion' && (!o.filter || o.filter(fx)) && fusionRecipe(fx) && assignMats(fusionRecipe(fx), pool, 1).length); }
function* fusionSummon(g, p, o = {}) {
  const from = o.from || ['hand', 'm']; const pool = fusionPool(g, p, from);
  const fs = g.p[p].extra.filter(fx => D(fx).k === 'fusion' && (!o.filter || o.filter(fx)) && fusionRecipe(fx) && assignMats(fusionRecipe(fx), pool, 1).length);
  if (!fs.length) return null;
  const [fx] = yield* pick(g, p, 'Fusion Summon which monster?', fs, 1, 1, 'good');
  const cs = assignMats(fusionRecipe(fx), pool); let mats = cs[0];
  if (cs.length > 1) { const i = yield* choose(g, p, 'Use which Fusion Materials?', cs.map(m => m.map(c => D(c).n + (c.zone === 'hand' ? ' (hand)' : c.zone === 'm' ? ' (field)' : c.zone === 'gy' ? ' (GY)' : ' (Deck)')).join(' + '))); mats = cs[i]; }
  const grp = g.group; for (const m of mats) move(g, m, o.banish ? 'ban' : 'gy', { reason: 'fusion', group: grp });
  log(g, `${PN(g, p)} used ${mats.map(c => D(c).n).join(' + ')} as Fusion Material.`);
  if (freeM(g, p) < 0) return null;
  ss(g, p, fx, 'atk', { how: 'fusion', group: grp }); return fx;
}
/* Ritual Summon: o.monster (predicate for the Ritual Monster), o.exact (levels must equal) or at least its Level. */
function ritualCombos(g, p, rm, o = {}) {
  const L = lv(rm); const pool = [...g.p[p].hand.filter(c => c !== rm && isMon(c)), ...monsOf(g, p)];
  const out = []; const rec = (i, cur, sum) => { if (out.length > 10) return; if (o.exact ? sum === L : sum >= L) { if (cur.length) out.push(cur.slice()); if (!o.exact) return; } if (sum >= L) return; for (let j = i; j < pool.length; j++) { cur.push(pool[j]); rec(j + 1, cur, sum + lv(pool[j])); cur.pop(); } };
  rec(0, [], 0); return out;
}
function canRitual(g, p, o) { return g.p[p].hand.some(c => isMon(c) && D(c).k === 'ritual' && o.monster(c) && ritualCombos(g, p, c, o).length); }
function* ritualSummon(g, p, o) {
  const rms = g.p[p].hand.filter(c => isMon(c) && D(c).k === 'ritual' && o.monster(c) && ritualCombos(g, p, c, o).length); if (!rms.length) return null;
  const [rm] = yield* pick(g, p, 'Ritual Summon which monster?', rms, 1, 1, 'good');
  const cs = ritualCombos(g, p, rm, o); let trib = cs[0];
  if (cs.length > 1) { const i = yield* choose(g, p, 'Tribute which monsters?', cs.map(m => m.map(c => `${D(c).n} (Lv ${lv(c)})`).join(' + '))); trib = cs[i]; }
  const grp = g.group; for (const t of trib) move(g, t, 'gy', { reason: 'ritual', group: grp });
  if (freeM(g, p) < 0) return null;
  ss(g, p, rm, 'atk', { how: 'ritual', group: grp }); return rm;
}
E.lib = {
  ask, pick, yn, choose, tgt: null, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, setFaceDown, negate, addMod,
  equip, equippedTo, link, addCtr, ctr, negateAttack, endBattle, addRule, token, tokens, fusionSummon, canFusion, fusionRecipe, ritualSummon, canRitual,
  stat, atk: (g, c) => stat(g, c, 'atk'), def: (g, c) => stat(g, c, 'def'), name, D, isMon, isMonD, isST, isSpell, isTrap, isExtraD, onField, faceUp, attr, race, lv, baseAtk,
  monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, forbid, negd, num, shown, emit, beginOp,
  winDuel, coin, dice, isBW, isFrog, isHERO, isEHERO, isGemini, evSummoned, fromFieldToGY, battleKill, oppFaceUp, stOnField, spellTrapAct, live, opp, tributeCands, synCombos,
};
E.lib.tgt = tgt;
E.addScripts = (obj, format) => { const into = format && format !== 'edison' ? (FSCRIPTS[format] || (FSCRIPTS[format] = {})) : SCRIPTS; for (const k in obj) into[k] = obj[k]; };
E.format = () => FMT;
E.cards = () => CARDLIST;   // the card list E.init loaded (the computer re-inits with it plus its stand-ins)
E.SCRIPTS = SCRIPTS;
root.EdisonEngine = E;
E._internal = { stat, synCombos, activatable, fieldMons, monsOf, stOf, faceUp, isMon, isST, D };
})(typeof window !== 'undefined' ? window : globalThis);
