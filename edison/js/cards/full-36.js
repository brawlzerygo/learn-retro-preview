/* Full pool batch 36: Broken Bamboo Sword to Darkblaze Dragon (build/batches/full/full-36.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings.
 Crush Card Virus has a Goat-only script in classic-5.js; it is ported here as the shared version (the Goat one still wins under Goat). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
// Clock Counters: added with addCtr(..., 'clock', n) by any file (Eternal Dread in full-38.js), read the same way everywhere
const clocks = c => Math.max((c.ctr && c.ctr.clock) || 0, c.flags.clock || 0);
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, takeControl, negate, addMod,
  equip, addCtr, ctr, negateAttack, addRule, tokens, coin, dice, name, D, isMon, isST, isSpell, isTrap, isExtraD, onField, faceUp,
  attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has,
  live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned, battleKill, emit, forbid, stat, negd, num, isGemini, tributeCands } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return false; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'atk' }); return true; };
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
function* discard1(g, p, text = 'Discard 1 card', cands = null) {
  const hs = cands || g.p[p].hand; if (!hs.length) return null;
  const [x] = yield* pick(g, p, text, hs, 1, 1, 'cost'); if (!x) return null;
  move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${D(x).n}.`); return x;
}
// Equip Spells: target a face-up monster that passes filter, equip it at resolution
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?', after) => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c) && equip(g, c, t) && after) after(g, c, t); } });
const eqBonus = n => ({ atk: (g, src, m) => src.equipTo === m.u ? n : 0 });
// A Trap that responds to an event with no response window of its own (a battle destruction): an optional trigger while Set.
// Same shape as classic-5.js. The event is kept on the card: the engine sets L.ev only after cost and target have run.
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; log(g, `${PN(g, p)} flipped up ${name(c)}.`); if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });
const battleDeath = (ev, q) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && ev.wasField && ev.from === 'm' && isMon(ev.c) && ev.prevCtrl === q;
// "by an effect of a card controlled by your opponent" (same as full-26.js): the move's own `by` when given, else the turn player
const byOpp = (g, ev, c) => ev.by != null ? ev.by !== c.owner : g.tp !== c.owner;
// Normal Monsters: Normal cards, and Gemini monsters that are not Gemini Summoned (in the GY or face-up on the field)
const isNormal = x => isMon(x) && (D(x).k === 'normal' || (isGemini(x) && !(onField(x) && x.flags.gemini)));
// a monster with ? ATK: the card data stores it as 0, so it is read from the text.
// PARTIAL: a 0 ATK monster whose text sets its ATK in other words isn't seen.
const qAtk = x => isMon(x) && D(x).atk === '0' && /original ATK|ATK (and DEF )?(of this card )?(is|are|become|becomes) (equal|each|the|\d)|ATK and DEF (are|is) each|ATK equal to|ATK become equal/i.test(D(x).tx || '');
const ctrlsAttr = (g, p, a) => monsOf(g, p).some(m => faceUp(m) && attr(m) === a);
const isAlien = x => /Alien/.test(D(x).n);
const quoted = x => [...(D(x).tx || '').matchAll(/"([^"]+)"/g)].map(m => m[1]);
const isChrysalis = x => isMon(x) && /^Chrysalis/.test(D(x).n);
const isSixSam = x => isMon(x) && /Six Samurai/.test(D(x).n);
// Command Knight: when every monster of a player can't be attacked, the opponent can't declare an attack at all (same as full-26.js)
const noTargetLeft = (g, q) => monsOf(g, q).length > 0 && monsOf(g, q).every(m => faceUp(m) && has(g, m, 'noAttackTarget'));
// "Cannot be Special Summoned (except ...)": one duel-long rule, installed by the first event any of these cards sees.
// ENGINE: no generic "can't be Special Summoned" flag.
const LOCKS = {
  'Cactus Bouncer': () => true,
  'Colossal Fighter Assault Mode': (g, a) => !(a.c.zone === 'deck' && stOf(g, a.p).some(x => faceUp(x) && named(x, 'Assault Mode Activate'))),
  // PARTIAL: any Ritual Summon is allowed, not only one with Emblem of the Awakening
  'Cu Chulainn the Awakened': (g, a) => a.how !== 'ritual',
};
const lockInstall = { type: 'trig', loc: 'any', res: noop, on: (g) => {
  if (!g.f36lock) { g.f36lock = true; addRule(g, (g2, a) => { if (a.type !== 'ss' || !a.c || a.c.id == null) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); }
  return false; } };
// "it is destroyed during the End Phase": a mark on the monster (flags clear if it leaves the field or turns face-down),
// destroyed by a trigger of the card that summoned it, wherever that card is now
const endDestroy = { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the summoned monster',
  on: (g, ev) => { if (ev.type !== 'phase' || ev.ph !== 'end' || g.f36endSeq === ev.seq) return false; if (!fieldMons(g).some(m => faceUp(m) && m.flags.f36end === g.turnNo)) return false; g.f36endSeq = ev.seq; return true; },
  res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => faceUp(m) && m.flags.f36end === g.turnNo), { by: p }); } };
// Combo Fighter / Combo Master: a Chain of 2 or more Links is seen when a game event happens while a Chain Link is still waiting
// (the costs and resolution of Link 2 and up). PARTIAL: a Link 2 that makes no game event at all (a bare negation) isn't seen.
const comboEff = { type: 'trig', res: noop, on: (g, ev, c) => { if (g.tp === c.ctrl && g.phase === 'main1' && g.chain.length >= 1 && c.flags.extraAttack !== g.turnNo) { c.flags.extraAttack = g.turnNo; log(g, `${name(c)} can attack twice this turn.`); } return false; } };
// a Normal Summon or Set made by a card effect (Cry Havoc!). ENGINE: no summon negation window for it (the engine's own
// Normal Summon routine isn't open to scripts).
function* effectNormalSummon(g, p, x) {
  const need = lv(x) >= 7 ? 2 : lv(x) >= 5 ? 1 : 0;
  const cands = tributeCands(g, p); if (cands.length < need) return false;
  const set = (yield* choose(g, p, `Normal Summon or Set ${D(x).n}?`, ['Normal Summon', 'Set'])) === 1;
  const grp = g.group;
  if (need) { const tribs = yield* pick(g, p, `Choose ${need} monster${need > 1 ? 's' : ''} to Tribute`, cands, need, need, 'cost'); for (const t of tribs) move(g, t, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${tribs.map(t => D(t).n).join(', ')}.`); }
  if (freeM(g, p) < 0 || x.zone !== 'hand') return false;
  move(g, x, 'm', { ctrl: p, pos: set ? 'set' : 'atk', reason: set ? 'set' : 'summon', group: grp });
  x.summonType = need ? 'tribute' : 'normal';
  if (set) { log(g, `${PN(g, p)} Set a monster.`); emit(g, { type: 'set', c: x, p }, grp); return true; }
  log(g, `${PN(g, p)} Normal Summoned ${name(x)}.`);
  const ev = emit(g, { type: 'summon', cs: [x], how: x.summonType, p, byEffect: true }, grp);
  g.sw = { cs: [x], p, how: x.summonType, group: ev.group };
  return true;
}
// Clear World: Spells activated while you control a WIND monster cost 500 LP. ENGINE: no activation cost hook, so the LP is
// paid as the Spell is played from the hand, or (a Set Normal or Quick-Play Spell) as it leaves the field after resolving.
// PARTIAL: a Set Continuous, Equip or Field Spell flipped face-up isn't charged.
function cwWind(g, ev, src) {
  if (ev.type !== 'move' || !isSpell(ev.c) || ev.c === src) return; // Clear World's own activation is not charged (it is not applying yet)
  g.f36cw = g.f36cw || {};
  let who = null;
  if (ev.reason === 'activate' && ev.from === 'hand') { who = ev.c.ctrl; g.f36cw[ev.c.u] = true; }
  else if (ev.reason === 'rule' && ev.wasField && ev.to === 'gy' && ev.snap && ev.snap.faceUp) { if (g.f36cw[ev.c.u]) { delete g.f36cw[ev.c.u]; return; } if (['Normal', 'Quick-Play', 'Ritual'].includes(D(ev.c).sub) || !D(ev.c).sub) who = ev.prevCtrl; }
  if (who == null || g.f36cwSeq === ev.seq || !ctrlsAttr(g, who, 'WIND')) return;
  g.f36cwSeq = ev.seq; log(g, `${PN(g, who)} pays 500 LP for the Spell (Clear World).`); pay(g, who, 500);
}

E.addScripts({
  /* ----- B ----- */
  'Broken Bamboo Sword': { cont: eqBonus(0), effs: [equipAct()] },
  'Broken Blocker': { effs: [trapTrig({ label: 'Special Summon monsters with the same name', tags: { ss: 1 },
    on: (g, ev, c) => battleDeath(ev, c.ctrl) && ev.snap && ['def', 'set'].includes(ev.snap.pos) && ev.snap.def > ev.snap.atk,
    cond: (g, c, p, x) => freeM(g, p) >= 0 && g.p[p].deck.some(y => named(y, D(x.ev.c).n) && canSS(g, p, y)),
    res: function* (g, c, p, L2) {
      const n = D(L2.ev.c).n; const cands = g.p[p].deck.filter(y => named(y, n)); const k = Math.min(2, nFreeM(g, p), cands.length); if (!k) { shuffleDeck(g, p); return; }
      const xs = yield* pick(g, p, `Special Summon up to 2 ${n} from your Deck`, cands, 1, k, 'good');
      for (const x of xs) ss(g, p, x, 'def'); shuffleDeck(g, p); } })] },
  'Broww, Huntsman of Dark World': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Draw',
    on: (g, ev, c) => {
      if (!(ev.type === 'move' && ev.c === c && ev.from === 'hand' && ev.to === 'gy' && ['discard', 'cost'].includes(ev.reason))) return false;
      // the hand size limit is not a card effect (it leaves the hand at 6 or more in your End Phase)
      if (g.phase === 'end' && ev.by == null && g.tp === c.owner && g.p[c.owner].hand.length >= 6 && !g.chain.length) return false;
      c.f36opp = byOpp(g, ev, c); return true; },
    res: function* (g, c, p) { draw(g, p, c.f36opp ? 2 : 1); } }] },
  'Brron, Mad King of Dark World': { effs: [{ type: 'trig', when: true, label: 'Discard 1 card',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    cond: (g, c, p) => g.p[p].hand.length > 0,
    res: function* (g, c, p) { yield* discard1(g, p); } }] },
  // The Trap becomes an Equip Card on a monster you control.
  'Brutal Potion': {
    effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Brutal Potion to which monster you control?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.ctrl === p && onField(c) && equip(g, c, t)) L2.keep = true; } },
    { type: 'trig', loc: 'st', mand: true, opt: true, label: '+1000 ATK',
      on: (g, ev, c) => ev.type === 'damage' && !ev.battle && ev.srcP === c.ctrl && ev.p !== c.ctrl && !!c.equipTo,
      res: function* (g, c) { const m = fieldMons(g).find(x => x.u === c.equipTo); if (m && faceUp(m)) { addMod(g, m, { atk: 1000, end: true }); log(g, `${name(m)} gained 1000 ATK.`); } } }] },
  'Burden of the Mighty': { cont: { atk: (g, src, m) => m.ctrl !== src.ctrl ? -100 * lv(m) : 0 }, effs: [actNoop] },
  // Continuous Trap: negates a monster effect that activates on a Normal Summon (Spell Speed 2 response), and that player draws 1.
  'By Order of the Emperor': { effs: [actNoop,
    { type: 'quick', loc: 'st', label: 'Negate the effect',
      cond: (g, c, p, x) => { const T = x.top; return !!T && !T.negated && T.eff.type === 'trig' && isMon(T.c) && !!T.ev && T.ev.type === 'summon' && ['normal', 'tribute', 'gemini'].includes(T.ev.how); },
      target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated) return; T.negBy = p; negate(g, T, false); draw(g, T.p, 1); } }] },
  'Byroad Sacrifice': { effs: [trapTrig({ label: 'Special Summon Cyber Ogre', tags: { ss: 1 },
    on: (g, ev, c) => battleDeath(ev, c.ctrl),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => named(x, 'Cyber Ogre') && canSS(g, p, x)),
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => named(x, 'Cyber Ogre')); if (!cs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon Cyber Ogre from your hand', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } })] },

  /* ----- C ----- */
  'Cactus Bouncer': { cont: { forbid: (g, src, a) => a.type === 'ss' && fieldMons(g).some(m => m !== src && faceUp(m) && race(m) === 'Plant') },
    effs: [lockInstall] },
  // Triggers even if this card is destroyed in the same battle (ruling), so it works from any zone.
  'Cactus Fighter': { effs: [{ type: 'trig', loc: 'any', mand: true, tags: { ss: 1 }, label: 'Give the opponent a Needle Token',
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.prevCtrl !== c.ctrl && ev.wasField,
    cond: (g, c, p) => freeM(g, opp(p)) >= 0,
    res: function* (g, c, p) { tokens(g, opp(p), { n: 'Needle Token', a: 'EARTH', r: 'Plant', lv: 1, atk: 500, def: 500 }, 1, 'def'); } }] },
  // Only at the start of Main Phase 1 (before any other action). PARTIAL: Flip Summons aren't stopped (no forbid action for them).
  'Calming Magic': { effs: [{ type: 'act', cond: g => g.phase === 'main1' && !!g.mainStart,
    res: function* (g, c, p) {
      g.noSummon[0] = g.noSummon[1] = true;
      addRule(g, (g2, a) => ['ns', 'set', 'ss'].includes(a.type) && g2.phase !== 'end', { end: g.turnNo });
      log(g, 'Neither player can Summon monsters during the Main Phases and Battle Phase this turn.'); } }] },
  'Cannon Soldier MK-2': { effs: [{ type: 'ign', label: 'Tribute 2 monsters: 1500 damage',
    cond: (g, c, p) => monsOf(g, p).length >= 2,
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Tribute 2 monsters', monsOf(g, p), 2, 2, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${xs.map(x => D(x).n).join(', ')}.`); },
    res: function* (g, c, p) { damage(g, opp(p), 1500, { src: c, srcP: p }); } }] },
  'Canyon': { cont: { dmg: (g, src, p, n, o) => {
      if (!o.battle || !g.battle || !g.battle.t || !g.battle.a) return n; const t = g.battle.t;
      return faceUp(t) && t.pos === 'def' && race(t) === 'Rock' && p === g.battle.a.ctrl ? n * 2 : n; } },
    effs: [actNoop] },
  'Carrierroid': { effs: [{ type: 'quick', label: 'Discard: negate and destroy',
    cond: (g, c, p, x) => { const T = x.top; return !!T && !T.negated && T.p !== p && T.tags && T.tags.destroy && T.t.some(t => isST(t) && onField(t) && t.ctrl === p) && g.p[p].hand.length > 0; },
    cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; yield* discard1(g, p); },
    res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated) return; T.negBy = p; negate(g, T, true); } }] },
  // Not in the Damage Step; doesn't target (rulings).
  'Catoblepas and the Witch of Fate': { effs: [{ type: 'trig', when: true, tags: { destroy: 1 }, label: 'Banish a ? ATK monster: destroy the summoned monsters',
    on: (g, ev, c) => ev.type === 'summon' && ev.p !== c.ctrl && ['special', 'synchro', 'fusion', 'ritual'].includes(ev.how),
    cond: (g, c, p, x) => !g.inDS && g.p[p].gy.some(qAtk) && x.ev.cs.some(m => onField(m) && m.ctrl !== p),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish a monster with ? ATK from your GY', g.p[p].gy.filter(qAtk), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
    res: function* (g, c, p, L2) { destroy(g, L2.ev.cs.filter(m => onField(m) && m.ctrl !== p), { by: p }); } }] },
  'Celestial Transformation': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Fairy' && canSS(g, p, x)),
    res: function* (g, c, p) {
      const cs = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Fairy'); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon a Fairy from your hand', cs, 1, 1, 'good'); if (!x || !ss(g, p, x, 'atk')) return;
      const A = stat(g, x, 'atk'); addMod(g, x, { atk: -(A - Math.floor(A / 2)) }); x.flags.f36end = g.turnNo;
      log(g, `${name(x)}'s ATK was halved. It will be destroyed in the End Phase.`); } }, endDestroy] },
  'Cell Explosion Virus': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && ctr(g.aw.a, 'A') > 0,
    res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)).filter(m => m.pos === 'atk'), { by: p }); } }] },
  // Marked after damage calculation (so a battle with no damage calculation doesn't count); works from any zone (rulings).
  // PARTIAL: Skill Drain doesn't stop it while the card is on the field.
  'Chainsaw Insect': { effs: [{ type: 'trig', loc: 'any', mand: true, label: 'Opponent draws 1 card',
    on: (g, ev, c) => {
      if (ev.type === 'afterCalc' && (ev.a === c || ev.t === c)) { c.f36saw = true; return false; }
      if (ev.type === 'dsEnd' && (ev.a === c || ev.t === c) && c.f36saw) { c.f36saw = false; return true; }
      return false; },
    res: function* (g, c, p) { draw(g, opp(p), 1); } }] },
  'Changing Destiny': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target the attacking monster', [g.aw.a], 1, 1, 'bad'); },
    res: function* (g, c, p, L2) {
      const t = live(L2)[0]; if (!t) return;
      if (g.aw && g.aw.a === t) negateAttack(g);
      if (!faceUp(t) || !toDef(g, t)) return;
      t.flags.f36noPos = true;
      if (!g.f36posRule) { g.f36posRule = true; addRule(g, (g2, a) => a.type === 'pos' && a.c && a.c.flags && a.c.flags.f36noPos); }
      const half = Math.floor(stat(g, t, 'atk') / 2), o = opp(p);
      const i = yield* choose(g, o, 'Changing Destiny: choose 1', [`You gain ${half} LP`, `${PN(g, p)} takes ${half} damage`]);
      if (i === 0) gain(g, o, half); else damage(g, p, half, { src: c, srcP: p }); } }] },
  'Chimera the Flying Mythical Beast': { effs: [{ type: 'trig', loc: 'any', when: true, tags: { ss: 1 }, label: 'Special Summon Berfomet or Gazelle',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => (named(x, 'Berfomet') || named(x, 'Gazelle the King of Mythical Beasts')) && canSS(g, p, x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which monster from your GY?', g.p[p].gy.filter(x => named(x, 'Berfomet') || named(x, 'Gazelle the King of Mythical Beasts')), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  'Clay Charge': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.aw && !!g.aw.t && g.aw.a.ctrl !== p && g.aw.t.ctrl === p && named(g.aw.t, 'Elemental HERO Clayman'),
    target: function* (g, c, p, L2) { L2.data.a = g.aw.a; L2.data.t = g.aw.t; if (g.aw.t.pos === 'set') log(g, 'The face-down monster is Elemental HERO Clayman.'); },
    res: function* (g, c, p, L2) { destroy(g, [L2.data.a, L2.data.t].filter(x => x && onField(x)), { by: p }); damage(g, opp(p), 800, { src: c, srcP: p }); } }] },
  // Each player gets the effects of the Attributes they control. PARTIAL: LIGHT (play with your hand revealed) does nothing here.
  'Clear World': {
    cont: { forbid: (g, src, a) => {
      if (a.type === 'attack' && a.c) { const q = a.c.ctrl; return ctrlsAttr(g, q, 'DARK') && monsOf(g, q).length >= 2; }
      if (a.type === 'activate' && a.eff && a.eff.type === 'act' && a.c && isSpell(a.c) && ctrlsAttr(g, a.p, 'WIND') && g.p[a.p].lp <= 500) return true;
      return false; } },
    effs: [actNoop,
      { type: 'trig', loc: 'fz', mand: true, label: 'Pay 500 LP or destroy Clear World',
        on: (g, ev, c) => { cwWind(g, ev, c); return ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl; },
        res: function* (g, c, p) { if (!onField(c)) return;
          if (g.p[p].lp > 500 && (yield* choose(g, p, 'Clear World: pay 500 LP or destroy it?', ['Pay 500 LP', 'Destroy Clear World'])) === 0) pay(g, p, 500);
          else destroy(g, [c], { by: p, rule: true }); } },
      { type: 'trig', loc: 'fz', mand: true, tags: { destroy: 1 }, label: 'EARTH: destroy a Defense Position monster',
        on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'standby' && ctrlsAttr(g, ev.tp, 'EARTH') && monsOf(g, ev.tp).some(m => faceUp(m) && m.pos === 'def')) { c.flags.cwq = ev.tp; return true; } return false; },
        target: function* (g, c, p, L2) { const q = c.flags.cwq; L2.data.q = q; yield* tgt(g, q, L2, 'Clear World: destroy 1 face-up Defense Position monster you control', monsOf(g, q).filter(m => faceUp(m) && m.pos === 'def'), 1, 1, 'cost'); },
        res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } },
      { type: 'trig', loc: 'fz', mand: true, label: 'WATER: discard 1 card',
        on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'end' && ctrlsAttr(g, ev.tp, 'WATER')) { c.flags.cwqw = ev.tp; return true; } return false; },
        res: function* (g, c, p) { const q = c.flags.cwqw; if (q != null && ctrlsAttr(g, q, 'WATER')) yield* discard1(g, q, 'Clear World: discard 1 card'); } },
      { type: 'trig', loc: 'fz', mand: true, label: 'FIRE: take 1000 damage',
        on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'end' && ctrlsAttr(g, ev.tp, 'FIRE')) { c.flags.cwqf = ev.tp; return true; } return false; },
        res: function* (g, c, p) { const q = c.flags.cwqf; if (q != null && ctrlsAttr(g, q, 'FIRE')) damage(g, q, 1000, { src: c, srcP: p }); } }] },
  'Clock Tower Prison': {
    cont: { dmg: (g, src, p, n, o) => o.battle && p === src.ctrl && clocks(src) >= 4 ? 0 : n },
    effs: [actNoop,
      { type: 'trig', loc: 'fz', mand: true, opt: true, label: 'Place a Clock Counter',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl,
        res: function* (g, c) { if (!onField(c)) return; addCtr(g, c, 'clock', 1); c.flags.clock = clocks(c); log(g, `Clock Tower Prison has ${clocks(c)} Clock Counter${clocks(c) > 1 ? 's' : ''}.`); } },
      // the counters are read from the card as it left the field. A Field Spell you replace yourself counts too (ruling).
      { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon Destiny HERO - Dreadmaster',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy' && (ev.destroyed || ev.from === 'fz') && ev.snap && Math.max(ev.snap.flags.clock || 0, (ev.snap.ctr && ev.snap.ctr.clock) || 0, (ev.c.ctr && ev.c.ctr.clock) || 0) >= 4,
        cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Destiny HERO - Dreadmaster')),
        res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Destiny HERO - Dreadmaster')); if (!cs.length || freeM(g, p) < 0) return;
          const [x] = yield* pick(g, p, 'Special Summon Destiny HERO - Dreadmaster from your hand or Deck', cs, 1, 1, 'good'); if (x) { const fd = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fd) shuffleDeck(g, p); } } }] },
  // ENGINE: a token's Attribute and Type come from the first Clone Token made in the duel (no attr()/race() override);
  // its Level, ATK and DEF are set per token.
  'Cloning': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => !!g.sw && g.sw.p !== p && ['normal', 'tribute', 'flip'].includes(g.sw.how) && g.sw.cs.some(x => onField(x) && faceUp(x) && x.ctrl !== p && lv(x) > 0) && freeM(g, p) >= 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target the summoned monster', g.sw.cs.filter(x => onField(x) && faceUp(x) && x.ctrl !== p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) {
      const t = live(L2)[0]; if (!t || !faceUp(t)) return;
      const st = { n: 'Clone Token', a: attr(t), r: race(t), lv: num(D(t).lv), atk: baseAtk(t), def: num(D(t).def) };
      const [k] = tokens(g, p, st, 1, 'atk'); if (!k) return;
      k.flags.baseAtk = st.atk; k.flags.lv = st.lv; addMod(g, k, { set: st.def, which: 'def' }); k.flags.f36cloneOf = t.u;
      log(g, `The Clone Token has ${st.atk} ATK and ${st.def} DEF.`); } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the Clone Token',
      on: (g, ev, c) => { if (!(ev.type === 'move' && ev.destroyed && ev.to === 'gy' && ev.wasField) || g.f36cloneSeq === ev.seq) return false;
        if (!fieldMons(g).some(m => m.flags.f36cloneOf === ev.c.u)) return false; g.f36cloneSeq = ev.seq; c.f36cl = ev.c.u; return true; },
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => m.flags.f36cloneOf === c.f36cl), { by: p }); } }] },
  // The counters stay after this card leaves the field (ruling).
  'Cold Enchanter': { self: { atk: g => 300 * allField(g).reduce((s, x) => s + ctr(x, 'ice'), 0) },
    effs: [{ type: 'ign', label: 'Discard: place an Ice Counter',
      cond: (g, c, p) => g.p[p].hand.length > 0 && fieldMons(g).some(faceUp),
      cost: function* (g, c, p) { yield* discard1(g, p); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Place an Ice Counter on which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addCtr(g, t, 'ice', 1); log(g, `${name(t)} got an Ice Counter.`); } } }] },
  'Colossal Fighter Assault Mode': {
    cont: { atk: (g, src, m) => m.ctrl !== src.ctrl ? -100 * g.p[src.ctrl].gy.filter(x => isMon(x) && race(x) === 'Warrior').length : 0 },
    effs: [lockInstall,
      { type: 'trig', when: true, label: 'Send up to 2 Warriors from your Deck to the GY',
        on: (g, ev, c) => evSummoned(ev, c, ['special']),
        cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && race(x) === 'Warrior'),
        res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Warrior'); if (!cs.length) return;
          const xs = yield* pick(g, p, 'Send up to 2 Warriors from your Deck to the GY', cs, 0, 2, 'good');
          for (const x of xs) move(g, x, 'gy', { reason: 'effect', by: p }); if (xs.length) log(g, `${PN(g, p)} sent ${xs.map(x => D(x).n).join(', ')} from the Deck to the GY.`); shuffleDeck(g, p); } },
      { type: 'trig', loc: 'any', when: true, tags: { ss: 1 }, label: 'Special Summon Colossal Fighter from your GY',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed,
        cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, 'Colossal Fighter') && canSS(g, p, x)),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Colossal Fighter?', g.p[p].gy.filter(x => named(x, 'Colossal Fighter')), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  'Combo Fighter': { effs: [comboEff] },
  'Combo Master': { effs: [comboEff] },
  'Command Knight': {
    self: { noAttackTarget: (g, c) => monsOf(g, c.ctrl).some(x => x !== c) },
    cont: { atk: (g, src, m) => m.ctrl === src.ctrl && race(m) === 'Warrior' ? 400 : 0,
      forbid: (g, src, a) => a.type === 'attack' && a.c && a.c.ctrl !== src.ctrl && noTargetLeft(g, src.ctrl) && !has(g, a.c, 'directAttack') },
    effs: [] },
  'Commander Covington': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Send the 3 Machina: Special Summon Machina Force',
    cond: (g, c, p) => ['Machina Soldier', 'Machina Sniper', 'Machina Defender'].every(n => monsOf(g, p).some(x => faceUp(x) && named(x, n))) && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Machina Force')),
    cost: function* (g, c, p) { const grp = g.group; const xs = [];
      for (const n of ['Machina Soldier', 'Machina Sniper', 'Machina Defender']) { const [x] = yield* pick(g, p, `Send which ${n} to the GY?`, monsOf(g, p).filter(x => faceUp(x) && named(x, n)), 1, 1, 'cost'); if (x) xs.push(x); }
      for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} sent ${xs.map(x => D(x).n).join(', ')} to the GY.`); },
    res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Machina Force')); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon Machina Force from your hand or Deck', cs, 1, 1, 'good'); if (x) { const fd = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fd) shuffleDeck(g, p); } } }] },
  'Commander Gottoms, Swordmaster': { cont: { atk: (g, src, m) => m.ctrl === src.ctrl && /Saber/.test(name(m)) ? 400 : 0 }, effs: [] },
  'Common Charity': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 2,
    res: function* (g, c, p) {
      draw(g, p, 2);
      const ns = g.p[p].hand.filter(isNormal);
      if (ns.length) { const [x] = yield* pick(g, p, 'Banish 1 Normal Monster from your hand', ns, 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'effect', by: p }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } }
      else { const h = g.p[p].hand.slice(); for (const x of h) move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${PN(g, p)} had no Normal Monster and sent the whole hand to the GY.`); } } }] },
  // The monster's ATK is the one it had when it was Special Summoned. When this card leaves the field, it returns to the hand.
  'Common Soul': {
    cont: { atk: (g, src, m) => src.flags.f36cs && src.flags.f36cs.m === m.u ? src.flags.f36cs.n : 0 },
    effs: [{ type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => fieldMons(g).some(m => faceUp(m) && freeM(g, m.ctrl) >= 0) && g.p[p].hand.some(x => isMon(x) && /^Neo-Spacian/.test(D(x).n)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select 1 face-up monster', fieldMons(g).filter(m => faceUp(m) && freeM(g, m.ctrl) >= 0), 1, 1, 'good'); },
      res: function* (g, c, p, L2) {
        const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c)) return; const side = t.ctrl;
        const cs = g.p[p].hand.filter(x => isMon(x) && /^Neo-Spacian/.test(D(x).n)); if (!cs.length || freeM(g, side) < 0) return;
        const [x] = yield* pick(g, p, 'Special Summon a Neo-Spacian from your hand', cs, 1, 1, 'good'); if (!x || !ss(g, side, x, 'atk')) return;
        c.flags.f36cs = { m: t.u, s: x.u, n: stat(g, x, 'atk') }; g.seq++; log(g, `${name(t)} gains ${c.flags.f36cs.n} ATK.`); } },
      { type: 'trig', loc: 'any', mand: true, label: 'Return the Neo-Spacian to the hand',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && !!ev.snap.flags.f36cs && fieldMons(g).some(m => m.u === ev.snap.flags.f36cs.s),
        res: function* (g, c, p, L2) { const s = L2.ev.snap.flags.f36cs.s; const x = fieldMons(g).find(m => m.u === s); if (x) { move(g, x, 'hand', { reason: 'effect', by: p }); log(g, `${D(x).n} returned to the hand.`); } } }] },
  'Comrade Swordsman of Landstar': { cont: { atk: (g, src, m) => m.ctrl === src.ctrl && race(m) === 'Warrior' ? 400 : 0 }, effs: [] },
  // The battle is worked out by the card. ENGINE: attack redirects; the attack is negated and the two monsters battle here.
  'Confusion Chaff': { effs: [
    { type: 'act',
      cond: (g, c, p) => { const f = g.f36dir; return !!g.aw && g.aw.a.ctrl !== p && !g.aw.t && !!f && f.turn === g.turnNo && f.c !== g.aw.a && onField(f.c) && f.c.zone === 'm' && f.c.ctrl === g.aw.a.ctrl; },
      target: function* (g, c, p, L2) { L2.data.a = g.aw.a; L2.data.f = g.f36dir.c; },
      res: function* (g, c, p, L2) {
        const a = L2.data.a, f = L2.data.f; if (g.aw && g.aw.a === a) negateAttack(g);
        if (!onField(a) || !onField(f) || a.zone !== 'm' || f.zone !== 'm' || a.pos !== 'atk') return;
        const q = a.ctrl; log(g, `${name(a)} battles ${f.pos === 'set' ? 'a face-down monster' : name(f)}.`);
        if (f.pos === 'set') { f.pos = 'def'; g.seq++; log(g, `The face-down monster was ${name(f)}.`); emit(g, { type: 'flip', c: f, p: f.ctrl, battle: true }); }
        const A = stat(g, a, 'atk');
        if (f.pos === 'atk') { const F = stat(g, f, 'atk');
          if (A > F) { damage(g, q, A - F, { battle: true, src: a, srcP: q }); destroy(g, [f], { battle: true, killer: a }); }
          else if (A < F) { damage(g, q, F - A, { battle: true, src: f, srcP: q }); destroy(g, [a], { battle: true, killer: f }); }
          else if (A > 0) destroy(g, [a, f], { battle: true }); }
        else { const Dv = stat(g, f, 'def');
          if (A > Dv) destroy(g, [f], { battle: true, killer: a });
          else if (A < Dv) damage(g, q, Dv - A, { battle: true, src: f, srcP: q }); } } },
    // remembers the first monster that attacked directly this turn (an attack that reached the Damage Step)
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { if (ev.type === 'dsStart' && !ev.t && ev.a && (!g.f36dir || g.f36dir.turn !== g.turnNo)) g.f36dir = { turn: g.turnNo, c: ev.a }; return false; } }] },
  'Conscription': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].deck.length > 0,
    res: function* (g, c, p) {
      const o = opp(p), dk = g.p[o].deck; if (!dk.length) return; const x = dk[dk.length - 1];
      log(g, `${PN(g, p)} excavated ${D(x).n}.`);
      const t = D(x).tx || '';
      const normalOk = isMon(x) && !isExtraD(D(x)) && !['ritual', 'token'].includes(D(x).k) && !/Cannot be Normal Summoned/i.test(t) && !/Cannot be Special Summoned/i.test(t) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
      if (!normalOk) { move(g, x, 'hand', { reason: 'effect', by: p }); log(g, `${D(x).n} was added to ${PN(g, o)}'s hand.`); return; }
      if (freeM(g, p) >= 0) ss(g, p, x, 'atk');
      else { move(g, x, 'gy', { reason: 'effect', destroyed: true, by: p }); log(g, `${D(x).n} was destroyed and sent to the GY.`); } } }] },
  'Contact': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => { const ch = monsOf(g, p).filter(x => faceUp(x) && isChrysalis(x)); const ns = new Set(ch.flatMap(quoted)); return ch.length > 0 && [...g.p[p].hand, ...g.p[p].deck].some(x => isMon(x) && ns.has(D(x).n)); },
    res: function* (g, c, p) {
      const ch = monsOf(g, p).filter(x => faceUp(x) && isChrysalis(x)); if (!ch.length) return; const ns = new Set(ch.flatMap(quoted));
      const grp = g.group; for (const x of ch) move(g, x, 'gy', { reason: 'effect', by: p, group: grp }); log(g, `${PN(g, p)} sent ${ch.map(x => D(x).n).join(', ')} to the GY.`);
      const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => isMon(x) && ns.has(D(x).n)); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon a monster written on those cards', cs, 1, 1, 'good'); if (x) { const fd = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fd) shuffleDeck(g, p); } } }] },
  'Contact Out': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && D(x).k === 'fusion' && /Neos/.test(D(x).n)),
    target: function* (g, c, p, L2) { L2.data.x = (yield* pick(g, p, 'Return which Neos Fusion Monster to the Extra Deck?', monsOf(g, p).filter(x => faceUp(x) && D(x).k === 'fusion' && /Neos/.test(D(x).n)), 1, 1, 'cost'))[0]; },
    res: function* (g, c, p, L2) {
      const x = L2.data.x; if (!x || !onField(x)) return;
      const mats = ((D(x).ps || D(x).tx || '').split('\n')[0].match(/"([^"]+)"/g) || []).map(s => s.slice(1, -1));
      move(g, x, 'deck', { reason: 'effect', by: p }); log(g, `${D(x).n} returned to the Extra Deck.`);
      const picked = []; for (const n of mats) { const y = g.p[p].deck.find(d => named(d, n) && !picked.includes(d)); if (!y) return; picked.push(y); }
      if (!picked.length || nFreeM(g, p) < picked.length || picked.some(y => !canSS(g, p, y))) return;
      if (!(yield* yn(g, p, `Special Summon ${picked.map(y => D(y).n).join(', ')} from your Deck?`))) return;
      for (const y of picked) ss(g, p, y, 'atk'); shuffleDeck(g, p); } }] },
  'Copy Plant': { effs: [{ type: 'ign', opt: true, label: 'Copy a Plant’s Level',
    cond: (g, c, p) => fieldMons(g).some(x => x !== c && faceUp(x) && race(x) === 'Plant' && lv(x) > 0),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Copy the Level of which Plant?', fieldMons(g).filter(x => x !== c && faceUp(x) && race(x) === 'Plant' && lv(x) > 0), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c) || !faceUp(c)) return; c.flags.lv = lv(t); c.flags.lvUntil = true; g.seq++; log(g, `Copy Plant became Level ${lv(t)} until the end of this turn.`); } }] },
  'Copycat': { effs: [{ type: 'trig', mand: true, label: 'Copy original ATK/DEF',
    on: (g, ev, c) => evSummoned(ev, c),
    cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Copy the original ATK/DEF of which monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c) || !faceUp(c)) return;
      addMod(g, c, { set: baseAtk(t), which: 'atk' }); addMod(g, c, { set: num(D(t).def), which: 'def' }); log(g, `Copycat's ATK/DEF became ${baseAtk(t)}/${num(D(t).def)}.`); } }] },
  'Corruption Cell A': { effs: [{ type: 'act', cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Place an A-Counter on which monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addCtr(g, t, 'A', 1); log(g, `${name(t)} got an A-Counter.`); } } }] },
  // PARTIAL: the 1-Tribute option is offered while you could Tribute an opponent-owned monster, but the Tribute itself isn't
  // limited to that monster (ENGINE: no per-summon Tribute filter).
  "Cosmic Horror Gangi'el": {
    self: { tributes: (g, c, p) => tributeCands(g, p).some(x => x.owner !== p) ? [1] : [] },
    effs: [{ type: 'ign', opt: true, label: 'Place an A-Counter',
      cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Place an A-Counter on which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) { addCtr(g, t, 'A', 1); log(g, `${shown(g, t)} got an A-Counter.`); } } }] },
  'Counselor Lily': { effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Pay 500: the Synchro Monster gains 1000 ATK',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && ev.reason === 'synchro',
    cond: (g, c, p) => g.p[p].lp > 500 && !!lilySyn(g, p),
    cost: function* (g, c, p, L2) { L2.data.s = lilySyn(g, p); pay(g, p, 500); },
    res: function* (g, c, p, L2) { const s = L2.data.s; if (s && onField(s) && faceUp(s)) { addMod(g, s, { atk: 1000, end: true }); log(g, `${name(s)} gained 1000 ATK.`); } } }] },
  'Cranium Fish': {
    proc: { label: "Special Summon (Tribute Ocean's Keeper)", cond: (g, c, p) => monsOf(g, p).some(x => named(x, "Ocean's Keeper")),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, "Tribute Ocean's Keeper", monsOf(g, p).filter(x => named(x, "Ocean's Keeper")), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Ocean's Keeper.`); } } },
    effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Discard a WATER: destroy a face-down card',
      cond: (g, c, p) => g.p[p].hand.some(x => isMon(x) && attr(x) === 'WATER') && allField(g).some(x => x.pos === 'set'),
      cost: function* (g, c, p) { yield* discard1(g, p, 'Discard 1 WATER monster', g.p[p].hand.filter(x => isMon(x) && attr(x) === 'WATER')); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-down card?', allField(g).filter(x => x.pos === 'set'), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2).filter(x => x.pos === 'set'), { by: p }); } }] },
  // Control swaps for good. If either player has no face-up Normal Monster when it resolves, nothing switches (ruling).
  'Creature Seizure': { effs: [{ type: 'act',
    cond: (g, c, p) => [p, opp(p)].every(q => monsOf(g, q).some(m => faceUp(m) && isNormal(m))),
    res: function* (g, c, p) {
      const o = opp(p); if (![p, o].every(q => monsOf(g, q).some(m => faceUp(m) && isNormal(m)))) { log(g, 'No monsters switched control.'); return; }
      const [x] = yield* pick(g, p, 'Give which face-up Normal Monster to your opponent?', monsOf(g, p).filter(m => faceUp(m) && isNormal(m)), 1, 1, 'cost');
      const [y] = yield* pick(g, o, 'Give which face-up Normal Monster to your opponent?', monsOf(g, o).filter(m => faceUp(m) && isNormal(m)), 1, 1, 'cost');
      if (!x || !y) return; const ix = g.p[p].m.indexOf(x), iy = g.p[o].m.indexOf(y); if (ix < 0 || iy < 0) return;
      g.p[p].m[ix] = y; g.p[o].m[iy] = x; x.ctrl = o; y.ctrl = p;
      for (const m of [x, y]) { m.flags.ctrlUntil = null; m.flags.ctrlFrom = null; }
      g.seq++; log(g, `${name(x)} and ${name(y)} switched control.`); } }] },
  'Crop Circles': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => monsOf(g, p).length > 0,
    cost: function* (g, c, p, L2) { const xs = yield* pick(g, p, 'Send any number of your monsters to the GY', monsOf(g, p), 1, monsOf(g, p).length, 'cost'); L2.data.n = xs.reduce((s, x) => s + lv(x), 0);
      const grp = g.group; for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} sent ${xs.map(x => D(x).n).join(', ')} to the GY (total Level ${L2.data.n}).`); },
    res: function* (g, c, p, L2) {
      const n = L2.data.n; const cs = g.p[p].deck.filter(x => isMon(x) && isAlien(x) && lv(x) === n && canSS(g, p, x));
      if (!cs.length || freeM(g, p) < 0) { log(g, `No Level ${n} Alien was found.`); shuffleDeck(g, p); damage(g, p, 2000, { src: c, srcP: p }); return; }
      const [x] = yield* pick(g, p, `Special Summon a Level ${n} Alien from your Deck`, cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  // PARTIAL: "a card that you can place a Spell Counter on" is a face-up card whose text mentions Spell Counters.
  'Crusader of Endymion': { effs: [{ type: 'ign', opt: true, gemini: true, label: 'Place a Spell Counter: +600 ATK',
    cond: (g, c, p) => allField(g).some(x => spellCtrOk(g, c, x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Place a Spell Counter on which card?', allField(g).filter(x => spellCtrOk(g, c, x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !spellCtrOk(g, c, t)) return; addCtr(g, t, 'spell', 1); log(g, `${name(t)} got a Spell Counter.`);
      if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 600, end: true }); log(g, 'Crusader of Endymion gained 600 ATK.'); } } }] },
  // Original 2010 text: "Tribute 1 DARK monster with an ATK of 1000 or less. Check your opponent's monsters on the field and
  // the cards in their hand, and destroy all monsters with 1500 or more ATK. Your opponent checks all cards they draw for
  // 3 turns (your opponent's turns), and destroys any monster with 1500 or more ATK." The modern rewrite (no damage until
  // the next turn, destroy up to 3 from the Deck) came later. If it is activated in the opponent's turn, that turn counts.
  // PARTIAL: the draw check runs as the card is drawn, without a chain link.
  'Crush Card Virus': { effs: [{ type: 'act', tags: { destroy: 1 },
      cond: (g, c, p) => monsOf(g, p).some(m => attr(m) === 'DARK' && stat(g, m, 'atk') <= 1000),
      cost: function* (g, c, p) { const [m] = yield* pick(g, p, 'Tribute a DARK monster with 1000 or less ATK', monsOf(g, p).filter(m => attr(m) === 'DARK' && stat(g, m, 'atk') <= 1000), 1, 1, 'cost'); if (m) { move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(m).n}.`); } },
      res: function* (g, c, p) {
        const o = opp(p);
        const h = g.p[o].hand; log(g, `${PN(g, p)} looked at ${PN(g, o)}'s hand: ${h.length ? h.map(x => D(x).n).join(', ') : 'empty'}.`);
        destroy(g, monsOf(g, o).filter(m => stat(g, m, 'atk') >= 1500), { by: p, src: c });
        const hx = h.filter(x => isMon(x) && baseAtk(x) >= 1500);
        for (const x of hx) move(g, x, 'gy', { reason: 'effect', destroyed: true, by: p });
        if (hx.length) log(g, `${hx.map(x => D(x).n).join(', ')} ${hx.length > 1 ? 'were' : 'was'} destroyed in the hand.`);
        (g.ccvDraw || (g.ccvDraw = [])).push({ src: c.u, p: o, by: p, until: g.turnNo + (g.tp === o ? 4 : 5) });
        log(g, `${PN(g, o)}'s draws are checked for the next 3 of their turns.`); } },
    { type: 'trig', loc: 'any', res: function* () {}, on: (g, ev, c) => {
      if (ev.type !== 'move' || ev.reason !== 'draw' || ev.to !== 'hand' || ev.ccvSeen || !g.ccvDraw) return false;
      const e = g.ccvDraw.find(x => x.src === c.u && x.p === ev.c.owner && g.tp === x.p && g.turnNo <= x.until);
      if (!e || ev.c.zone !== 'hand') return false; ev.ccvSeen = true; const x = ev.c;
      if (isMon(x) && baseAtk(x) >= 1500) { move(g, x, 'gy', { reason: 'effect', destroyed: true, by: e.by }); log(g, `${PN(g, e.p)} drew ${D(x).n}, and Crush Card Virus destroyed it.`); }
      else log(g, `${PN(g, e.p)} drew ${D(x).n} and showed it to Crush Card Virus.`);
      return false; } }] },
  // The extra Normal Summon/Set doesn't use your normal one (ruling). Banishing is the cost; only in your Main Phase.
  'Cry Havoc!': { effs: [actNoop,
    { type: 'ign', loc: 'st', label: 'Banish a monster: Normal Summon a Normal Monster',
      cond: (g, c, p) => !g.noSummon[p] && g.p[p].gy.some(isMon) && g.p[p].hand.some(x => D(x).k === 'normal' && tributeCands(g, p).length >= (lv(x) >= 7 ? 2 : lv(x) >= 5 ? 1 : 0) && (freeM(g, p) >= 0 || lv(x) >= 5) && !forbid(g, { type: 'ns', c: x, p })),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish a monster from your GY', g.p[p].gy.filter(isMon), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
      res: function* (g, c, p) {
        const cs = g.p[p].hand.filter(x => D(x).k === 'normal' && tributeCands(g, p).length >= (lv(x) >= 7 ? 2 : lv(x) >= 5 ? 1 : 0) && (freeM(g, p) >= 0 || lv(x) >= 5)); if (!cs.length) return;
        const [x] = yield* pick(g, p, 'Normal Summon or Set which Normal Monster?', cs, 1, 1, 'good'); if (x) yield* effectNormalSummon(g, p, x); } }] },
  'Cryomancer of the Ice Barrier': { cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && lv(a.c) >= 4 && monsOf(g, src.ctrl).some(x => x !== src && faceUp(x) && /Ice Barrier/.test(name(x))) }, effs: [] },
  // The gain lasts until your next Standby Phase (removed as that phase starts).
  'Cu Chulainn the Awakened': { effs: [lockInstall,
    { type: 'ign', opt: true, label: 'Banish a Normal Monster: gain its ATK',
      cond: (g, c, p) => g.p[p].gy.some(isNormal),
      cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Banish a Normal Monster from your GY', g.p[p].gy.filter(isNormal), 1, 1, 'cost'); L2.data.n = x ? baseAtk(x) : 0; if (x) { move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
      res: function* (g, c, p, L2) { if (!onField(c) || !faceUp(c)) return; addMod(g, c, { atk: L2.data.n, f36cu: true }); log(g, `Cu Chulainn the Awakened gained ${L2.data.n} ATK.`); } },
    { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.mods.some(m => m.f36cu && m.turn < g.turnNo)) { c.mods = c.mods.filter(m => !(m.f36cu && m.turn < g.turnNo)); g.seq++; } return false; } }] },
  // The sent monster is a cost; the target is a "Six Samurai" monster in either GY (it can be the one just sent).
  'Cunning of the Six Samurai': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isSixSam(x)) && allCards(g, 'gy').some(isSixSam),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Six Samurai monster to the GY?', monsOf(g, p).filter(x => faceUp(x) && isSixSam(x)), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Six Samurai monster from either GY?', allCards(g, 'gy').filter(x => isSixSam(x) && canSS(g, p, x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, t, 'atk'); } }] },
  'Cup of Ace': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 2 && g.p[opp(p)].deck.length >= 2,
    res: function* (g, c, p) { if (coin(g, p)) draw(g, p, 2); else draw(g, opp(p), 2); } }] },
  'Cursed Fig': {
    cont: { loc: 'gy', forbid: (g, src, a) => a.type === 'activate' && !!src.f36fig && a.c && ['st', 'fz'].includes(a.c.zone) && a.c.pos === 'set' && src.f36fig.some(e => e.u === a.c.u && e.t === a.c.turnIn) },
    effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Lock 2 Set Spell/Trap Cards',
      on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.from === 'gy') c.f36fig = null; return ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy'; },
      cond: (g, c) => allField(g).filter(x => isST(x) && x.pos === 'set').length >= 2,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target 2 Set Spell/Trap Cards', allField(g).filter(x => isST(x) && x.pos === 'set'), 2, 2, 'bad'); },
      res: function* (g, c, p, L2) { if (c.zone !== 'gy') return; const ts = live(L2).filter(x => x.pos === 'set'); c.f36fig = ts.map(x => ({ u: x.u, t: x.turnIn })); if (ts.length) log(g, `${ts.length} Set card${ts.length > 1 ? 's' : ''} can't be activated while Cursed Fig is in the GY.`); } }] },
  // Tributing the Tuner is the cost; the target is another monster in your GY with its Attribute and Level.
  'Cyborg Doctor': { effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Tribute a Tuner: revive a monster',
    cond: (g, c, p) => monsOf(g, p).some(t => D(t).tu && g.p[p].gy.some(y => isMon(y) && attr(y) === attr(t) && lv(y) === lv(t) && canSS(g, p, y))),
    cost: function* (g, c, p, L2) { const [t] = yield* pick(g, p, 'Tribute which Tuner?', monsOf(g, p).filter(t => D(t).tu && g.p[p].gy.some(y => isMon(y) && attr(y) === attr(t) && lv(y) === lv(t))), 1, 1, 'cost');
      L2.data.a = attr(t); L2.data.lv = lv(t); L2.data.u = t.u; move(g, t, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(t).n}.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which monster from your GY?', g.p[p].gy.filter(y => y.u !== L2.data.u && isMon(y) && attr(y) === L2.data.a && lv(y) === L2.data.lv && canSS(g, p, y)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, t, 'atk'); } }] },
  'Cyclone Blade': { effs: [equipAct(m => /^Destiny HERO/.test(name(m)), 'Equip to which Destiny HERO?'),
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy a Spell/Trap',
      on: (g, ev, c) => ev.type === 'dsEnd' && !!ev.a && c.equipTo === ev.a.u,
      target: function* (g, c, p, L2) { const cs = stOnField(g); if (cs.length) yield* tgt(g, p, L2, 'Destroy which Spell/Trap Card?', cs, 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  // The equipped monster is remembered on the card, since the equip ends as the monster leaves the field.
  'Cyclone Boomerang': { cont: eqBonus(500),
    effs: [equipAct(m => named(m, 'Elemental HERO Wildheart'), 'Equip to which Elemental HERO Wildheart?', (g, c, t) => { c.f36eq = t.u; }),
      { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy all Spells and Traps',
        on: (g, ev, c) => ev.type === 'move' && c.zone === 'st' && !!c.f36eq && ev.c.u === c.f36eq && ev.wasField && ev.destroyed && !ev.battle && ev.to === 'gy',
        res: function* (g, c, p) { c.f36eq = null; const n = destroy(g, stOnField(g), { by: p, src: c }).length; if (n) damage(g, opp(p), 100 * n, { src: c, srcP: p }); } }] },

  /* ----- D ----- */
  // Fusion recipe 3 "Des Frog" is read from the text (Dupe Frog on the field counts as Des Frog). ENGINE: substitutes aren't a hook.
  'D.3.S. Frog': { self: { atk: (g, c) => 500 * g.p[c.ctrl].gy.filter(x => named(x, 'Treeborn Frog')).length }, effs: [] },
  'Dangerous Machine Type-6': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Roll a die',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; const n = dice(g, p), o = opp(p);
        if (n === 1) yield* discard1(g, p);
        else if (n === 2) yield* discard1(g, o);
        else if (n === 3) draw(g, p, 1);
        else if (n === 4) draw(g, o, 1);
        else if (n === 5) { const ms = monsOf(g, o); if (ms.length) { const [x] = yield* pick(g, p, 'Destroy which monster your opponent controls?', ms, 1, 1, 'bad'); if (x) destroy(g, [x], { by: p, src: c }); } }
        else destroy(g, [c], { by: p }); } }] },
  // The doubled ATK/DEF is added as a gain (it stays with later changes and ends if the card leaves or turns face-down).
  'Darkblaze Dragon': { effs: [
    { type: 'trig', mand: true, label: 'Double ATK and DEF',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'gy' && ev.to === 'm' && ev.reason === 'summon',
      res: function* (g, c) { if (!onField(c) || !faceUp(c)) return; addMod(g, c, { atk: baseAtk(c), def: num(D(c).def) }); log(g, `Darkblaze Dragon's ATK and DEF were doubled.`); } },
    { type: 'trig', mand: true, label: 'Inflict damage', on: (g, ev, c) => battleKill(ev, c),
      res: function* (g, c, p, L2) { const n = baseAtk(L2.ev.c); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
});

// Counselor Lily: the Synchro Monster summoned with it (the last Synchro Summon of that player)
function lilySyn(g, p) { for (let i = g.events.length - 1; i >= 0; i--) { const e = g.events[i]; if (e.type === 'summon' && e.how === 'synchro' && e.p === p) { const s = e.cs[0]; return s && onField(s) && faceUp(s) ? s : null; } } return null; }
function spellCtrOk(g, self, x) { return x !== self && faceUp(x) && /Spell Counter/.test(D(x).tx || '') && !(isMon(x) && negd(g, x)); }
function shown(g, c) { return c.pos === 'set' ? 'A face-down monster' : name(c); }
})();
