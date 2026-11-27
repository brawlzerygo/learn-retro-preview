/* Full pool batch 29: Watapon to Zombyra the Dark, then the Edison-only Alien, Allure Queen, Arcana Force and Archfiend cards
 (build/batches/full/full-29.md). Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from
 the Edison text and rulings. Cards with a Goat-only script elsewhere (Wave-Motion Cannon, Widespread Ruin, Xing Zhen Hu,
 Zaborg the Thunder Monarch, Zolga, Zombyra the Dark) are ported here as the shared version; the Goat-only ones still win
 under Goat. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, takeControl, negate, addMod,
  addCtr, ctr, addRule, tokens, coin, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk,
  monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, allCards, shuffleDeck, log, PN, has, live, opp, oppFaceUp,
  stOnField, evSummoned, battleKill, emit, forbid, stat, negd } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const flipEff = (label, more) => ({ type: 'trig', mand: true, faceDownOk: true, label, on: (g, ev, c) => ev.type === 'flip' && ev.c === c, ...more });
// change a face-up monster's battle position by an effect
function swapPos(g, m) {
  if (!onField(m) || m.zone !== 'm' || !faceUp(m)) return;
  const from = m.pos; m.pos = from === 'atk' ? 'def' : 'atk'; g.seq++;
  log(g, `${name(m)} was changed to ${m.pos === 'atk' ? 'Attack' : 'Defense'} Position.`);
  emit(g, { type: 'pos', c: m, p: m.ctrl, from });
}
const toDef = (g, c) => { if (onField(c) && c.zone === 'm' && c.pos === 'atk') swapPos(g, c); };
function toBottom(g, x) { move(g, x, 'deckTop', { reason: 'effect' }); const d = g.p[x.owner].deck; const i = d.indexOf(x); if (i >= 0) { d.splice(i, 1); d.unshift(x); } }
// the turn number of player q's next Draw Phase, and skipping it (as full-25.js)
const nextDrawTurn = (g, q) => g.tp === q ? g.turnNo + 2 : g.turnNo + 1;
function skipDraw(g, q) { const T = nextDrawTurn(g, q); addRule(g, (g2, a) => a.type === 'draw' && a.p === q && g2.phase === 'draw' && g2.turnNo === T, { end: T }); }
// battle damage this card inflicted to its controller's opponent
const dealtBattleDmg = (ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl && ev.n > 0;

/* "Cannot be Special Summoned" and summon-only-by-its-own-rule: one duel-long rule, installed by the first event any of these
 cards sees (as full-04.js). ENGINE: no general "can't be Special Summoned" flag yet. */
const XYZ = ['XY-Dragon Cannon', 'XYZ-Dragon Cannon', 'XZ-Tank Cannon', 'YZ-Tank Dragon'];
const LOCKS = {
  'Yata-Garasu': () => true,
  'Yamata Dragon': () => true,
  // PARTIAL: an effect that Special Summons them from the hand is not stopped (their own rule needs the same check).
  'Arcana Force EX - The Dark Ruler': (g, a) => ['gy', 'ban', 'deck'].includes(a.c.zone),
  'Arcana Force EX - The Light Ruler': (g, a) => ['gy', 'ban', 'deck'].includes(a.c.zone),
};
// XYZ Fusions: only by their own rule (the idle menu asks with how 'fusion'; Polymerization can't read their recipe, see mats)
for (const n of XYZ) LOCKS[n] = (g, a) => ['gy', 'ban'].includes(a.c.zone) || (a.c.zone === 'extra' && a.how !== 'fusion');
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: (g) => { if (!g.f29lock) { g.f29lock = true; addRule(g, (g2, a) => { if (a.type !== 'ss' || !a.c || a.c.id == null) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); } return false; } };

// Spirit return (as full-28.js): during the End Phase of the turn it was Normal Summoned or flipped face-up, it returns to the hand.
const spiritReturn = { type: 'trig', mand: true, label: 'Return to the hand',
  on: (g, ev, c) => {
    if ((ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how)) || (ev.type === 'flip' && ev.c === c)) c.flags.spirit = g.turnNo;
    return ev.type === 'phase' && ev.ph === 'end' && c.flags.spirit === g.turnNo;
  },
  res: function* (g, c) { if (onField(c) && faceUp(c)) { move(g, c, 'hand', { reason: 'effect' }); log(g, `${name(c)} returned to the hand.`); } } };

// Union monsters (as full-02.js): once per turn equip to a monster you control, or unequip and Special Summon in Attack
// Position; a monster has at most 1 Union; "if the equipped monster would be destroyed, destroy this card instead".
const hasUnion = (g, m) => allField(g).some(x => x.zone === 'st' && x.equipTo === m.u && x.flags.union);
function unionEffs(okTarget, text) {
  const cands = (g, c, p) => monsOf(g, p).filter(x => x !== c && faceUp(x) && okTarget(x) && !hasUnion(g, x));
  return [
    { type: 'ign', label: 'Equip to a monster',
      cond: (g, c, p) => c.used.union !== g.turnNo && freeST(g, p) >= 0 && cands(g, c, p).length > 0,
      after: (g, c) => { c.used.union = g.turnNo; },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, cands(g, c, p), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !okTarget(t) || c.zone !== 'm' || !faceUp(c) || freeST(g, p) < 0 || hasUnion(g, t)) return;
        move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); c.equipTo = t.u; c.flags.union = true; log(g, `${D(c).n} was equipped to ${name(t)}.`); } },
    { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Unequip and Special Summon',
      cond: (g, c, p) => c.used.union !== g.turnNo && !!c.equipTo && !!c.flags.union && freeM(g, p) >= 0,
      after: (g, c) => { c.used.union = g.turnNo; },
      res: function* (g, c, p) { if (c.zone !== 'st' || !c.equipTo) return; c.equipTo = null; c.flags.union = false; ss(g, p, c, 'atk'); } }];
}
const unionCont = (a, d, battleOnly) => ({
  atk: (g, src, m) => src.zone === 'st' && src.flags.union && src.equipTo === m.u ? a : 0,
  def: (g, src, m) => src.zone === 'st' && src.flags.union && src.equipTo === m.u ? d : 0,
  replaceDestroy: (g, src, m, o) => {
    if (o.rule || (battleOnly && !o.battle) || src.zone !== 'st' || src.equipTo !== m.u || !src.flags.union) return false;
    move(g, src, 'gy', { reason: o.battle ? 'battle' : 'effect', destroyed: true, by: o.by }); log(g, `${D(src).n} was destroyed instead of ${name(m)}.`); return true; } });

// XYZ Fusions: Special Summoned from the Extra Deck by banishing the listed monsters you control (face-down ones too).
function xyzProc(names) {
  const have = (g, p, n) => monsOf(g, p).filter(x => named(x, n));
  return { extra: true, how: 'fusion', label: `Special Summon (banish ${names.join(' + ')})`,
    cond: (g, c, p) => names.every(n => have(g, p, n).length > 0),
    cost: function* (g, c, p, grp) {
      const out = [];
      for (const n of names) { const cs = have(g, p, n); const [x] = cs.length > 1 ? yield* pick(g, p, `Banish which ${n}?`, cs, 1, 1, 'cost') : cs; if (x) out.push(x); }
      for (const x of out) move(g, x, 'ban', { reason: 'cost', by: p, group: grp });
      log(g, `${PN(g, p)} banished ${out.map(x => D(x).n).join(' and ')}.`); } };
}
// "You can discard 1 card, then target ...; destroy that target." (not once per turn)
const xyzDestroy = (label, text, cands) => ({ type: 'ign', tags: { destroy: 1 }, label,
  cond: (g, c, p) => g.p[p].hand.length > 0 && cands(g, p).length > 0,
  cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${D(x).n}.`); } },
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, cands(g, p), 1, 1, 'bad'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) destroy(g, [t], { by: p, src: c }); } });
const xyzFusion = (names, eff) => ({ mats: [() => false, () => false], proc: xyzProc(names), effs: [lockInstall, eff] });

// Charmers (as full-19.js): control lasts while the Charmer is face-up and the monster keeps the Attribute.
const charmer = (A) => ({ effs: [
  flipEff(`Take control of a ${A} monster`, {
    target: function* (g, c, p, L2) { const cs = monsOf(g, opp(p)).filter(m => faceUp(m) && attr(m) === A); if (cs.length) yield* tgt(g, p, L2, `Take control of which ${A} monster?`, cs, 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || attr(t) !== A || t.ctrl === p || !onField(c) || !faceUp(c)) return;
      const from = t.ctrl; if (takeControl(g, p, t, false)) { t.flags.f29charm = c.u; t.flags.f29charmFrom = from; } } }),
  { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
    if (g.f29charmBusy) return false;
    for (const m of fieldMons(g)) {
      if (m.flags.f29charm !== c.u) continue;
      if (onField(c) && faceUp(c) && faceUp(m) && attr(m) === A) continue;
      const back = m.flags.f29charmFrom; m.flags.f29charm = null; g.f29charmBusy = true;
      try { if (m.ctrl !== back) { if (freeM(g, back) >= 0) { takeControl(g, back, m, false); log(g, `${name(m)} returned to ${PN(g, back)}.`); } else move(g, m, 'gy', { reason: 'rule' }); } }
      finally { g.f29charmBusy = false; }
    }
    return false; } }] });

// A Normal Trap whose moment has no response window in the engine (as full-28.js): an optional trigger while it is Set (not the
// turn it was Set); it turns face-up as it activates and goes to the GY after it resolves.
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });

// A Spell Card activated and resolved, read from the moves (as full-15.js). Returns the player who activated it, or -1.
// PARTIAL: a Set Continuous/Equip/Field Spell flipped face-up to activate is not seen (no event for it).
const STAYS = ['Continuous', 'Equip', 'Field'];
function spellResolvedBy(ev) {
  if (ev.type !== 'move' || !isSpell(ev.c)) return -1;
  const stays = STAYS.includes(D(ev.c).sub);
  if (!stays && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule') return ev.prevCtrl;
  if (stays && ev.from === 'hand' && ev.reason === 'activate') return ev.c.ctrl;
  return -1;
}

/* ----- A-Counters ----- */
const isAlien = c => /Alien/.test(name(c));
const aCount = g => allField(g).reduce((s, x) => s + ctr(x, 'A'), 0);
function* placeA(g, p, n, cands) { // place n A-Counters one at a time on monsters from cands(g)
  for (let i = 0; i < n; i++) { const ms = cands(g); if (!ms.length) break; const [m] = yield* pick(g, p, `Place an A-Counter on which monster? (${i + 1} of ${n})`, ms, 1, 1, 'bad'); if (!m) break; addCtr(g, m, 'A', 1); log(g, `${name(m)} got an A-Counter.`); }
}
function* removeA(g, p, n) { // remove n A-Counters from cards on the field (the player picks)
  for (let i = 0; i < n; i++) {
    const cs = allField(g).filter(x => ctr(x, 'A') > 0); if (!cs.length) return false;
    const [x] = yield* pick(g, p, `Remove an A-Counter from which card? (${i + 1} of ${n})`, cs, 1, 1, 'cost');
    addCtr(g, x, 'A', -1);
  }
  log(g, `${PN(g, p)} removed ${n} A-Counter${n > 1 ? 's' : ''}.`); return true;
}
// "Monsters with A-Counters lose 300 ATK/DEF for each A-Counter on them, while battling an 'Alien' monster, during damage
// calculation only" (as batch-4.js). Each card with this effect applies it once, so 2 copies give -600 per counter.
// PARTIAL: it applies for the whole Damage Step, not only damage calculation.
function aBattle(g, c) {
  const n = ctr(c, 'A'); if (!n || !g.inDS || !g.battle) return 0;
  const { a, t } = g.battle; const o = a === c ? t : t === c ? a : null;
  return o && isAlien(o) ? -300 * n : 0;
}
const alienCont = { atk: (g, src, c) => aBattle(g, c), def: (g, src, c) => aBattle(g, c) };
// remember the A-Counters on the monster this card battles (the counters are gone once it leaves the field)
const noteBattleA = (ev, c, key) => { if (ev.type === 'afterCalc' && (ev.a === c || ev.t === c)) { const o = ev.a === c ? ev.t : ev.a; c.flags[key] = o && ctr(o, 'A') > 0 ? o.u : null; } };

/* ----- Allure Queens ----- */
// Each can equip 1 face-up opponent's monster (once per turn, Main Phase); battle destruction hits the equipped monster instead.
const aqEquip = (g, c) => stOf(g, c.ctrl).find(x => x.equipTo === c.u && x.flags.f29aq) || null;
function allureQueen(maxLv, from, next) {
  const ok = (g, c) => from == null || c.flags.f29aqFrom === from;
  const cands = (g, c, p) => monsOf(g, opp(p)).filter(m => faceUp(m) && (maxLv == null || lv(m) <= maxLv));
  const effs = [
    { type: 'ign', opt: true, label: 'Equip an opponent\'s monster',
      cond: (g, c, p) => ok(g, c) && !aqEquip(g, c) && freeST(g, p) >= 0 && cands(g, c, p).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, `Equip which monster${maxLv ? ` (Level ${maxLv} or lower)` : ''} to ${D(c).n}?`, cands(g, c, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) {
        const t = live(L2)[0]; if (!t || t.zone !== 'm') return;
        // ruling: if this card was turned face-down in the meantime, the target is destroyed
        if (onField(c) && !faceUp(c)) { destroy(g, [t], { by: p, src: c }); return; }
        if (!faceUp(t) || (maxLv != null && lv(t) > maxLv) || !onField(c) || aqEquip(g, c) || freeST(g, p) < 0) return;
        move(g, t, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); t.equipTo = c.u; t.flags.f29aq = true; log(g, `${D(t).n} was equipped to ${name(c)}.`); } }];
  if (next) effs.push({ type: 'trig', label: `Send it: Special Summon ${next}`, tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && !!aqEquip(g, c),
    cond: (g, c, p) => !!aqEquip(g, c) && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, next)),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(c).n} to the GY.`); },
    res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, next)); const [x] = yield* pick(g, p, `Special Summon ${next} from your hand or Deck`, cs, 1, 1, 'good');
      if (!x) return; const fromDeck = x.zone === 'deck'; x.flags.f29aqFrom = D(c).n; if (!ss(g, p, x, 'atk')) x.flags.f29aqFrom = null; if (fromDeck) shuffleDeck(g, p); } });
  return { self: { replaceDestroy: (g, c, o) => { if (!o.battle) return false; const e = aqEquip(g, c); if (!e) return false;
    move(g, e, 'gy', { reason: 'effect', destroyed: true, by: c.ctrl }); log(g, `${D(e).n} was destroyed instead of ${name(c)}.`); return true; } }, effs };
}

/* ----- Arcana Force -----
 Each one tosses a coin when Summoned and keeps the result (c.flags.arc, 'H' or 'T'). Every Arcana Force script carries all the
 heads/tails effects, each gated on the card's effective name, so Arcana Call can swap in another card's effect for the turn
 (c.flags.arcSub). Light Barrier (full-11.js, g.lightBarrier) lets the player pick the result instead of tossing. */
const isArcana = c => /^Arcana Force/.test(D(c).n);
const AF = { fool: 'Arcana Force 0 - The Fool', mag: 'Arcana Force I - The Magician', emp: 'Arcana Force III - The Empress',
  emperor: 'Arcana Force IV - The Emperor', lovers: 'Arcana Force VI - The Lovers', chariot: 'Arcana Force VII - The Chariot',
  temp: 'Arcana Force XIV - Temperance', moon: 'Arcana Force XVIII - The Moon', world: 'Arcana Force XXI - The World',
  dark: 'Arcana Force EX - The Dark Ruler', light: 'Arcana Force EX - The Light Ruler' };
const arcName = (g, c) => c.flags.arcSub && c.flags.arcSub.turn === g.turnNo ? c.flags.arcSub.n : D(c).n;
const arcIs = (g, c, n, side) => onField(c) && c.zone === 'm' && faceUp(c) && c.flags.arc === side && arcName(g, c) === n;
function* arcToss(g, c, p) {
  let h;
  if (g.lightBarrier && g.lightBarrier[p]) { h = (yield* choose(g, p, `Light Barrier: choose the result for ${name(c)}`, ['Heads', 'Tails'])) === 0; log(g, `${PN(g, p)} chose ${h ? 'Heads' : 'Tails'} (Light Barrier).`); }
  else h = coin(g, p);
  c.flags.arc = h ? 'H' : 'T'; g.seq++;
  arcApply(g, c);
}
// effects that act the moment they apply: the Chariot on tails gives itself to the opponent
function arcApply(g, c) {
  if (arcIs(g, c, AF.chariot, 'T') && c.ctrl === c.owner && !c.flags.f29chariotGiven && freeM(g, opp(c.ctrl)) >= 0) { c.flags.f29chariotGiven = true; takeControl(g, opp(c.ctrl), c, false); }
}
const arcSummonToss = (hows) => ({ type: 'trig', mand: true, label: 'Toss a coin',
  on: (g, ev, c) => ev.type === 'summon' && ev.cs.includes(c) && (hows ? hows.includes(ev.how) : ev.how !== 'gemini'),
  res: function* (g, c, p) { if (onField(c) && faceUp(c)) yield* arcToss(g, c, p); } });
const opponentNS = (ev, c) => (ev.type === 'summon' && ['normal', 'tribute'].includes(ev.how) && ev.p !== c.ctrl) || (ev.type === 'set' && ev.p !== c.ctrl);
// targets this card: the link's targets include it
const targetsMe = (T, c) => !!T && !T.negated && Array.isArray(T.t) && T.t.includes(c);
const ARC_EFFS = [
  // The Fool, tails: negate your opponent's card effects that target this card, and destroy them.
  // ENGINE: no automatic negation hook, so it is an optional Spell Speed 3 response for its controller.
  { type: 'quick', speed: 3, ds: true, tags: { destroy: 1 }, label: 'Negate the effect that targets this card',
    cond: (g, c, p, x) => arcIs(g, c, AF.fool, 'T') && targetsMe(x.top, c) && x.top.p !== p,
    target: function* (g, c, p, L2) { L2.data.T = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.T; if (!T || T.negated) return; T.negBy = p; negate(g, T, true); } },
  // The Magician: when a Spell Card is activated (applied as it resolves): heads, ATK becomes double its original ATK until the
  // End Phase; tails, the opponent gains 500 LP. Continuous effects, no chain.
  { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
    if (spellResolvedBy(ev) < 0) return false;
    if (arcIs(g, c, AF.mag, 'H')) { addMod(g, c, { set: 2 * baseAtk(c), which: 'atk', end: true }); log(g, `${name(c)}'s ATK became ${2 * baseAtk(c)}.`); }
    else if (arcIs(g, c, AF.mag, 'T')) gain(g, opp(c.ctrl), 500);
    return false; } },
  // The Empress: each time the opponent Normal Summons or Sets: heads, you can Special Summon 1 Arcana Force from your hand;
  // tails, send 1 card from your hand to the GY.
  { type: 'trig', tags: { ss: 1 }, label: 'Special Summon an Arcana Force from your hand',
    on: (g, ev, c) => arcIs(g, c, AF.emp, 'H') && opponentNS(ev, c),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && isArcana(x)),
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isMon(x) && isArcana(x)); const [x] = yield* pick(g, p, 'Special Summon which Arcana Force?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } },
  { type: 'trig', mand: true, label: 'Send 1 card from your hand to the GY',
    on: (g, ev, c) => arcIs(g, c, AF.emp, 'T') && opponentNS(ev, c),
    res: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send 1 card from your hand to the GY', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} from the hand to the GY.`); } } },
  // The Chariot, heads: if this card destroys an opponent's monster by battle, you can Special Summon that monster.
  { type: 'trig', tags: { ss: 1 }, label: 'Special Summon the destroyed monster',
    on: (g, ev, c) => arcIs(g, c, AF.chariot, 'H') && battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
    cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p, L2) { const x = L2.ev && L2.ev.c; if (x && x.zone === 'gy' && isMon(x)) ss(g, p, x, 'atk'); } },
  // The Moon: heads, during your Standby Phase you can Special Summon 1 Moon Token; tails, during each of your End Phases give
  // control of 1 monster you control to your opponent.
  { type: 'trig', tags: { ss: 1 }, label: 'Special Summon a Moon Token',
    on: (g, ev, c) => arcIs(g, c, AF.moon, 'H') && ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) { tokens(g, p, { n: 'Moon Token', a: 'LIGHT', r: 'Fairy', lv: 1, atk: 0, def: 0 }, 1, 'def'); } },
  { type: 'trig', mand: true, label: 'Give a monster to your opponent',
    on: (g, ev, c) => arcIs(g, c, AF.moon, 'T') && ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Give control of which monster to your opponent?', monsOf(g, p), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.ctrl === p && freeM(g, opp(p)) >= 0) { takeControl(g, opp(p), t, false); t.flags.ctrlUntil = null; } } },
  // The World: heads, during your End Phase you can send 2 monsters you control to the GY to skip your opponent's next turn.
  // ENGINE: no real turn skip; the turn still happens, with no draw, summons, activations or Battle Phase (as Gamble, full-22.js).
  { type: 'trig', label: 'Send 2 monsters: skip the opponent\'s next turn',
    on: (g, ev, c) => arcIs(g, c, AF.world, 'H') && ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
    cond: (g, c, p) => monsOf(g, p).length >= 2,
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Send 2 monsters you control to the GY', monsOf(g, p), 2, 2, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${xs.map(x => D(x).n).join(' and ')} to the GY.`); },
    res: function* (g, c, p) { const q = opp(p), T = g.tp === q ? g.turnNo + 2 : g.turnNo + 1; (g.f29skip || (g.f29skip = [null, null]))[q] = T; log(g, `${PN(g, q)} skips their next turn.`);
      if (!g.f29skipRule) { g.f29skipRule = true; addRule(g, (g2, a) => { const s = g2.f29skip; if (!s) return false; const who = a.p != null ? a.p : a.c && a.c.ctrl; return who != null && s[who] === g2.turnNo && ['draw', 'ns', 'set', 'ss', 'activate', 'setST', 'attack', 'pos'].includes(a.type); }); } } },
  // The World, tails: during your opponent's Draw Phase, add the top card of their GY to their hand.
  { type: 'trig', mand: true, opt: true, label: 'Add the top card of the opponent\'s GY to their hand',
    on: (g, ev, c) => arcIs(g, c, AF.world, 'T') && g.phase === 'draw' && g.tp !== c.ctrl && ev.type === 'move' && ev.reason === 'draw' && ev.c.owner === g.tp,
    res: function* (g, c, p) { const gy = g.p[opp(p)].gy; const x = gy[gy.length - 1]; if (x) { move(g, x, 'hand', { reason: 'effect' }); log(g, `${D(x).n} was added from the GY to ${PN(g, opp(p))}'s hand.`); } } },
  // The Dark Ruler, heads: after a second attack this Battle Phase, it goes to Defense Position at the end of the Battle Phase
  // and can't change position until the end of your next turn.
  { type: 'trig', mand: true, label: 'Change to Defense Position',
    on: (g, ev, c) => arcIs(g, c, AF.dark, 'H') && ev.type === 'phase' && ev.ph === 'bpEnd' && c.attacks >= 2,
    res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; toDef(g, c); c.flags.f29posLock = g.turnNo + 2; } },
  // The Dark Ruler, tails: if this card is destroyed, destroy all cards on the field (no chain).
  { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
    if (!(ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.snap && ev.snap.faceUp && ev.snap.flags)) return false;
    const f = ev.snap.flags, n = f.arcSub && f.arcSub.turn === g.turnNo ? f.arcSub.n : D(c).n;
    if (f.arc === 'T' && n === AF.dark && !f.negated) { const all = allField(g); if (all.length) { log(g, `${D(c).n} destroys every card on the field.`); destroy(g, all, { by: ev.prevCtrl }); } }
    return false; } },
  // The Light Ruler, heads: when this card destroys an opponent's monster by battle and sends it to the GY: you can target 1 card
  // in your GY; add it to your hand.
  { type: 'trig', when: true, label: 'Add a card from your GY to your hand',
    on: (g, ev, c) => arcIs(g, c, AF.light, 'H') && battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
    cond: (g, c, p) => g.p[p].gy.length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which card from your GY to your hand?', g.p[p].gy, 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const x = L2.t[0]; if (x && x.zone === 'gy') { move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${D(x).n} from the GY to the hand.`); } } },
  // The Light Ruler, tails: when a card or effect that targets this card is activated, it loses exactly 1000 ATK and you negate
  // the activation and destroy that card. ENGINE: no automatic negation hook, so it is an optional Spell Speed 3 response.
  { type: 'quick', speed: 3, ds: true, tags: { destroy: 1 }, label: 'Lose 1000 ATK: negate and destroy',
    cond: (g, c, p, x) => arcIs(g, c, AF.light, 'T') && targetsMe(x.top, c) && !(x.top.f29lr || []).includes(c.u),
    target: function* (g, c, p, L2) { const T = g.chain[g.chain.length - 1]; (T.f29lr || (T.f29lr = [])).push(c.u); L2.data.T = T; },
    res: function* (g, c, p, L2) { const T = L2.data.T; if (onField(c) && faceUp(c)) { addMod(g, c, { atk: -1000 }); log(g, `${name(c)} lost 1000 ATK.`); }
      if (T && !T.negated) { T.negBy = p; negate(g, T, true); } } },
];
const ARC_SELF = {
  // The Fool, heads: "negate your card effects that target this card, and destroy them".
  // PARTIAL: its controller can't target it instead (the effect never starts, so nothing is destroyed).
  cantBeTargeted: (g, c) => arcIs(g, c, AF.fool, 'H'),
  targetFilter: (g, x, L2) => !!L2 && L2.p === x.ctrl,
  // The Dark Ruler, heads: it can make a second attack during each Battle Phase
  maxAttacks: (g, c) => { const d = c.flags.maxAttacks && c.flags.maxAttacksTurn === g.turnNo ? c.flags.maxAttacks : c.flags.extraAttack === g.turnNo ? 2 : 1; return arcIs(g, c, AF.dark, 'H') ? Math.max(2, d) : d; },
};
const ARC_CONT = {
  // The Emperor: Arcana Force monsters you control gain (heads) or lose (tails) 500 ATK
  atk: (g, src, m) => { if (src.ctrl !== m.ctrl || !isArcana(m)) return 0; return arcIs(g, src, AF.emperor, 'H') ? 500 : arcIs(g, src, AF.emperor, 'T') ? -500 : 0; },
  forbid: (g, src, a) => {
    // The Lovers, tails: you can't Tribute Summon Arcana Force monsters
    if (a.type === 'ns' && a.p === src.ctrl && a.c && isArcana(a.c) && lv(a.c) >= 5 && arcIs(g, src, AF.lovers, 'T')) return true;
    if (a.type === 'pos' && a.c === src) {
      // The Fool can't be changed to Defense Position, except with a card effect; the Dark Ruler's heads lock
      if (named(src, AF.fool) && src.pos === 'atk' && !negd(g, src)) return true;
      if (src.flags.f29posLock && g.turnNo <= src.flags.f29posLock) return true;
    }
    return false; },
  // The Lovers, heads: can be treated as 2 Tributes for an Arcana Force. PARTIAL: the engine lets any one monster be that Tribute.
  tributes: (g, src, c, p, need) => src.ctrl === p && need === 2 && isArcana(c) && arcIs(g, src, AF.lovers, 'H') ? 1 : null,
  // Temperance: halve all battle damage you take (heads) or your opponent takes (tails)
  dmg: (g, src, p, n, o) => { if (!o.battle) return undefined; if (arcIs(g, src, AF.temp, 'H') && p === src.ctrl) return Math.floor(n / 2); if (arcIs(g, src, AF.temp, 'T') && p !== src.ctrl) return Math.floor(n / 2); return undefined; },
};
const arcana = (more = {}) => ({ self: { ...ARC_SELF, ...(more.self || {}) }, cont: ARC_CONT, proc: more.proc,
  effs: [...(more.pre || []), arcSummonToss(more.hows), ...ARC_EFFS] });
// The EX Rulers: Special Summoned from the hand by sending 3 monsters you control to the GY (not Tokens)
const exProc = { label: 'Special Summon (send 3 monsters you control to the GY)',
  cond: (g, c, p) => monsOf(g, p).filter(x => D(x).k !== 'token').length >= 3,
  cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Send 3 monsters you control to the GY', monsOf(g, p).filter(x => D(x).k !== 'token'), 3, 3, 'cost');
    for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} sent ${xs.map(x => D(x).n).join(', ')} to the GY.`); } };

// Synchro Summons with material rules the engine's reader doesn't know (as full-11.js), with a minimum number of non-Tuners.
function synMats(g, p, sx, o) {
  const mons = monsOf(g, p).filter(c => faceUp(c));
  const Lv = lv(sx), out = [], n = mons.length;
  for (let mask = 1; mask < (1 << n) && out.length < 12; mask++) {
    const mats = mons.filter((_, i) => mask & (1 << i)); if (mats.length < 1 + (o.minNon || 1)) continue;
    if (mats.reduce((s, c) => s + lv(c), 0) !== Lv) continue;
    if (mats.some(t => D(t).tu && o.tuner(t) && mats.filter(x => x !== t).every(x => o.non(x) && !D(x).tu))) out.push(mats);
  }
  return out;
}
// PARTIAL: Synchro Summoned with its own rule, always in Attack Position.
const synProc = o => ({ extra: true, how: 'synchro', label: 'Synchro Summon',
  cond: (g, c, p) => synMats(g, p, c, o).length > 0,
  cost: function* (g, c, p, grp) { const cs = synMats(g, p, c, o); let mats = cs[0];
    if (cs.length > 1) { const i = yield* choose(g, p, `Synchro Summon ${name(c)} with which monsters?`, cs.map(m => m.map(name).join(' + '))); mats = cs[i]; }
    for (const m of mats) move(g, m, 'gy', { reason: 'synchro', by: p, group: grp });
    log(g, `${PN(g, p)} sent ${mats.map(m => D(m).n).join(' + ')} to the GY for a Synchro Summon.`); } });

const pandUp = g => allField(g).some(x => faceUp(x) && named(x, 'Pandemonium'));
const kindOf = c => isMon(c) ? 0 : isSpell(c) ? 1 : 2;

E.addScripts({
  /* ===== Watapon to Zombyra ===== */
  // If added from the Deck to the hand by a card effect (a draw by an effect counts, the normal draw doesn't): you can SS it.
  'Watapon': { effs: [{ type: 'trig', loc: 'hand', tags: { ss: 1 }, label: 'Special Summon this card',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'deck' && ev.to === 'hand' && (ev.reason === 'effect' || (ev.reason === 'draw' && !!g.resolvingL)),
    cond: (g, c, p) => c.zone === 'hand' && freeM(g, p) >= 0,
    res: function* (g, c, p) { if (c.zone === 'hand') ss(g, p, c, 'atk'); } }] },
  // Counts your Standby Phases since it was activated; the send is a cost. (It may be sent the turn it was activated, for 0.)
  'Wave-Motion Cannon': { effs: [actNoop,
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && faceUp(c)) addCtr(g, c, 'wave', 1); return false; } },
    { type: 'ign', loc: 'st', label: 'Send it: 1000 damage per Standby Phase',
      cost: function* (g, c, p, L2) { L2.data.n = ctr(c, 'wave'); move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent Wave-Motion Cannon to the GY.`); },
      res: function* (g, c, p, L2) { if (L2.data.n > 0) damage(g, opp(p), 1000 * L2.data.n, { src: c, srcP: p }); else log(g, 'No Standby Phases have passed, so no damage.'); } }] },
  // Once during each of your Standby Phases: pay 700 LP, target a Warrior or Machine you control; switch its current ATK and DEF
  // until the end of your opponent's next turn, while this card stays face-up.
  // ENGINE: no Standby Phase response window, so it is an optional trigger at the start of your Standby Phase.
  // PARTIAL: the switch is worked out once (from the ATK/DEF at resolution) and later changes are added on top.
  'Weapon Change': { effs: [actNoop,
    { type: 'trig', loc: 'st', opt: true, label: 'Pay 700 LP: switch a monster\'s ATK and DEF',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      cond: (g, c, p) => g.p[p].lp > 700 && monsOf(g, p).some(x => faceUp(x) && ['Warrior', 'Machine'].includes(race(x))),
      cost: function* (g, c, p) { pay(g, p, 700); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Switch the ATK and DEF of which Warrior or Machine?', monsOf(g, p).filter(x => faceUp(x) && ['Warrior', 'Machine'].includes(race(x))), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c) || !faceUp(c)) return;
        const a = atk(g, t), d = def(g, t); c.flags.f29wc = { u: t.u, dA: d - a, dD: a - d, until: g.tp === p ? g.turnNo + 1 : g.turnNo + 2 }; g.seq++;
        log(g, `${name(t)}'s ATK and DEF were switched (${d}/${a}).`); } }],
    cont: { atk: (g, src, m) => { const w = src.flags.f29wc; return w && w.u === m.u && g.turnNo <= w.until ? w.dA : 0; },
      def: (g, src, m) => { const w = src.flags.f29wc; return w && w.u === m.u && g.turnNo <= w.until ? w.dD : 0; } } },
  // FLIP: destroy the opponent's face-up Swords of Revealing Light; if one is destroyed, two Battle Phases this turn (or next).
  // ENGINE: no second Battle Phase; each monster you control at the start of that Battle Phase gets one more attack instead.
  'Weather Report': { effs: [
    flipEff('Destroy Swords of Revealing Light', { tags: { destroy: 1 },
      res: function* (g, c, p) { const sw = stOf(g, opp(p)).filter(x => faceUp(x) && named(x, 'Swords of Revealing Light')); if (!sw.length) return;
        const out = destroy(g, sw, { by: p, src: c }); if (!out.length) return;
        const T = g.tp === p ? g.turnNo : g.turnNo + 1; (g.f29wr || (g.f29wr = {}))[p] = T; log(g, `${PN(g, p)} can conduct two Battle Phases ${T === g.turnNo ? 'this turn' : 'next turn'}.`); } }),
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      const w = g.f29wr; if (!w || ev.type !== 'move' && ev.type !== 'phase' && ev.type !== 'attack') return false;
      for (const q of [0, 1]) if (w[q] === g.turnNo && g.tp === q && (g.phase === 'battle' || ev.type === 'attack') && c.owner === q) {
        w[q] = null; for (const m of monsOf(g, q)) { m.flags.maxAttacks = Math.max(2, (m.flags.maxAttacksTurn === g.turnNo && m.flags.maxAttacks) || 0); m.flags.maxAttacksTurn = g.turnNo; } }
      return false; } }] },
  // "When Tribute Summoning a WIND monster, you can treat this 1 monster as 2 Tributes."
  // PARTIAL: while it is face-up, a WIND monster that needs 2 Tributes can be Summoned with 1, but the engine lets any one monster
  // be that Tribute (not only this card).
  'Whirlwind Prodigy': { cont: { tributes: (g, src, c, p, need) => src.ctrl === p && need === 2 && attr(c) === 'WIND' ? 1 : null } },
  'Widespread Ruin': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && monsOf(g, opp(p)).some(x => x.pos === 'atk'),
    res: function* (g, c, p) { const ms = monsOf(g, opp(p)).filter(x => x.pos === 'atk'); if (!ms.length) return;
      const top = Math.max(...ms.map(x => stat(g, x, 'atk'))); const tied = ms.filter(x => stat(g, x, 'atk') === top);
      const [t] = tied.length > 1 ? yield* pick(g, p, 'Destroy which of the tied monsters?', tied, 1, 1, 'bad') : tied; if (t) destroy(g, [t], { by: p, src: c }); } }] },
  // Target 1 Beast or Beast-Warrior; it gains ATK equal to its current DEF until the End Phase; destroy it during the End Phase.
  'Wild Nature\'s Release': { effs: [{ type: 'act',
    cond: g => fieldMons(g).some(m => faceUp(m) && ['Beast', 'Beast-Warrior'].includes(race(m))),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which Beast or Beast-Warrior?', fieldMons(g).filter(m => faceUp(m) && ['Beast', 'Beast-Warrior'].includes(race(m))), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const d = def(g, t); addMod(g, t, { atk: d, end: true }); log(g, `${name(t)} gained ${d} ATK.`);
      (g.f29wnr || (g.f29wnr = [])).push({ u: t.u, turn: g.turnNo, by: p }); } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && (g.f29wnr || []).some(e => e.turn === g.turnNo) && allCards(g, 'gy').concat(allCards(g, 'ban'), allField(g)).filter(x => named(x, 'Wild Nature\'s Release'))[0] === c,
      res: function* (g, c) { const es = (g.f29wnr || []).filter(e => e.turn === g.turnNo); g.f29wnr = (g.f29wnr || []).filter(e => e.turn !== g.turnNo);
        for (const e of es) { const m = fieldMons(g).find(x => x.u === e.u); if (m) destroy(g, [m], { by: e.by }); } } }] },
  'Windstorm of Etaqua': { effs: [{ type: 'act', cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    res: function* (g, c, p) { for (const m of oppFaceUp(g, p)) swapPos(g, m); } }] },
  'Witch\'s Apprentice': { cont: {
    atk: (g, src, m) => attr(m) === 'DARK' ? 500 : attr(m) === 'LIGHT' ? -400 : 0 } },
  'Wodan the Resident of the Forest': { self: { atk: g => 100 * fieldMons(g).filter(x => faceUp(x) && race(x) === 'Plant').length } },
  // Send 1 Equip Card equipped to this card to the GY (cost): 500 damage. Any number of times in your Main Phase.
  'Woodland Sprite': { effs: [{ type: 'ign', label: 'Send an Equip Card: 500 damage',
    cond: (g, c) => allField(g).some(x => x.zone === 'st' && x.equipTo === c.u),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Equip Card to the GY?', allField(g).filter(x => x.zone === 'st' && x.equipTo === c.u), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  // Activate only when a Field Spell Card is activated: negate that Field Spell this turn.
  // The Field Spell stays on the field; this turn its lasting effects don't apply (a static negation read from this card in
  // the GY) and its effects can't be activated.
  'World Suppression': { cont: { loc: 'gy', negates: (g, src, m) => (g.f29ws || []).some(w => w.u === m.u && w.turn === g.turnNo) }, effs: [{ type: 'act',
    cond: (g, c, p, x) => !!x.top && x.top.cardAct && isSpell(x.top.c) && D(x.top.c).sub === 'Field' && !x.top.negated,
    target: function* (g, c, p, L2) { L2.data.T = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.T; if (!T) return; T.negated = true; const fu = T.c.u, turn = g.turnNo;
      (g.f29ws || (g.f29ws = [])).push({ u: fu, turn }); g.seq++; log(g, `${D(T.c).n} is negated this turn.`); addRule(g, (g2, a) => a.type === 'activate' && a.c && a.c.u === fu && g2.turnNo === turn, { end: turn }); } }] },
  'Wynn the Wind Charmer': charmer('WIND'),
  'Xing Zhen Hu': {
    cont: { forbid: (g, src, a) => a.type === 'activate' && (src.flags.xing || []).includes(a.c.u) && a.c.zone === 'st' },
    effs: [{ type: 'act', cond: (g, c) => allField(g).filter(x => x !== c && x.zone === 'st' && x.pos === 'set').length >= 2,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target 2 Set Spell/Trap Cards', allField(g).filter(x => x !== c && x.zone === 'st' && x.pos === 'set'), 2, 2, 'bad'); },
      res: function* (g, c, p, L2) { const ts = live(L2).filter(x => x.pos === 'set'); if (!onField(c) || !ts.length) return; c.flags.xing = ts.map(x => x.u); g.seq++; log(g, `${ts.length} Set card${ts.length > 1 ? 's' : ''} can't be activated.`); } }] },
  'XY-Dragon Cannon': xyzFusion(['X-Head Cannon', 'Y-Dragon Head'],
    xyzDestroy('Discard: destroy a face-up Spell/Trap', 'Destroy which face-up Spell/Trap?', (g, p) => stOf(g, opp(p)).filter(faceUp))),
  'XYZ-Dragon Cannon': xyzFusion(['X-Head Cannon', 'Y-Dragon Head', 'Z-Metal Tank'],
    xyzDestroy('Discard: destroy a card', 'Destroy which card?', (g, p) => fieldOf(g, opp(p)))),
  'XZ-Tank Cannon': xyzFusion(['X-Head Cannon', 'Z-Metal Tank'],
    xyzDestroy('Discard: destroy a face-down Spell/Trap', 'Destroy which face-down Spell/Trap?', (g, p) => stOf(g, opp(p)).filter(x => !faceUp(x)))),
  'YZ-Tank Dragon': xyzFusion(['Y-Dragon Head', 'Z-Metal Tank'],
    xyzDestroy('Discard: destroy a face-down monster', 'Destroy which face-down monster?', (g, p) => monsOf(g, opp(p)).filter(x => !faceUp(x)))),
  'Y-Dragon Head': { cont: unionCont(400, 400), effs: unionEffs(x => named(x, 'X-Head Cannon'), 'Equip Y-Dragon Head to which X-Head Cannon?') },
  'Z-Metal Tank': { cont: unionCont(600, 600), effs: unionEffs(x => named(x, 'X-Head Cannon') || named(x, 'Y-Dragon Head'), 'Equip Z-Metal Tank to which X-Head Cannon or Y-Dragon Head?') },
  // When changed from Attack to Defense Position: you can put any number of cards from your hand on the bottom of the Deck.
  'Yado Karu': { effs: [{ type: 'trig', when: true, label: 'Put cards from your hand on the bottom of the Deck',
    on: (g, ev, c) => ev.type === 'pos' && ev.c === c && c.pos === 'def' && (ev.from == null || ev.from === 'atk'),
    cond: (g, c, p) => g.p[p].hand.length > 0,
    res: function* (g, c, p) { let n = 0;
      for (let i = 0; i < 60 && g.p[p].hand.length; i++) {
        const opts = g.p[p].hand.slice(); const k = yield* choose(g, p, n ? 'Put another card on the bottom of the Deck?' : 'Put which card on the bottom of the Deck first?', [...opts.map(x => D(x).n), 'Stop']);
        if (k >= opts.length) break; toBottom(g, opts[k]); n++; }
      if (n) log(g, `${PN(g, p)} put ${n} card${n > 1 ? 's' : ''} from the hand on the bottom of the Deck.`); } }] },
  'Yamata Dragon': { effs: [lockInstall, spiritReturn,
    { type: 'trig', mand: true, label: 'Draw until you have 5 cards', on: (g, ev, c) => dealtBattleDmg(ev, c),
      res: function* (g, c, p) { const n = 5 - g.p[p].hand.length; if (n > 0) draw(g, p, n); } }] },
  'Yami': { effs: [actNoop], cont: {
    atk: (g, src, m) => ['Fiend', 'Spellcaster'].includes(race(m)) ? 200 : race(m) === 'Fairy' ? -200 : 0,
    def: (g, src, m) => ['Fiend', 'Spellcaster'].includes(race(m)) ? 200 : race(m) === 'Fairy' ? -200 : 0 } },
  // Can't be Special Summoned; Spirit; when it inflicts battle damage to the opponent, they skip their next Draw Phase.
  'Yata-Garasu': { effs: [lockInstall, spiritReturn,
    { type: 'trig', mand: true, label: 'Opponent skips their next Draw Phase', on: (g, ev, c) => dealtBattleDmg(ev, c),
      res: function* (g, c, p) { const o = opp(p); skipDraw(g, o); log(g, `${PN(g, o)} skips their next Draw Phase.`); } }] },
  'Yellow Luster Shield': { effs: [actNoop], cont: { def: (g, src, m) => m.ctrl === src.ctrl ? 300 : 0 } },
  // If destroyed by battle and sent to the GY: destroy the monster that destroyed it (no target).
  'Yomi Ship': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy the monster that destroyed it',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy' && !!ev.killer,
    res: function* (g, c, p, L2) { const k = L2.ev && L2.ev.killer; if (k && onField(k) && k.zone === 'm') destroy(g, [k], { by: p, src: c }); } }] },
  'Zaborg the Thunder Monarch': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a monster',
    on: (g, ev, c) => evSummoned(ev, c, ['tribute']),
    cond: g => fieldMons(g).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Zero Gravity': { effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
    res: function* (g) { for (const m of fieldMons(g).filter(faceUp)) swapPos(g, m); } }] },
  // When a monster is Tribute Summoned by Tributing this card: the owner of this card gains 2000 LP (the Edison text says owner).
  'Zolga': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Owner gains 2000 LP',
    on: (g, ev, c) => ev.type === 'summon' && ev.how === 'tribute' && Array.isArray(ev.tribs) && ev.tribs.includes(c),
    res: function* (g, c) { gain(g, c.owner, 2000); } }] },
  // Union for Decayed Commander: +500 ATK/DEF; when the equipped monster destroys an opponent's monster by battle, they discard
  // 1 random card; only battle destruction is replaced.
  'Zombie Tiger': { cont: unionCont(500, 500, true), effs: [...unionEffs(x => named(x, 'Decayed Commander'), 'Equip Zombie Tiger to which Decayed Commander?'),
    { type: 'trig', loc: 'st', mand: true, label: 'Opponent discards 1 random card',
      on: (g, ev, c) => !!c.flags.union && ev.type === 'move' && ev.battle && ev.destroyed && !!ev.killer && ev.killer.u === c.equipTo && ev.prevCtrl !== c.ctrl,
      res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, opp(p))} discarded ${D(x).n} at random.`); } }] },
  'Zombyra the Dark': {
    self: { cantAttack: (g, c) => !monsOf(g, opp(c.ctrl)).some(t => !(faceUp(t) && has(g, t, 'noAttackTarget'))) },
    effs: [{ type: 'trig', mand: true, label: 'Lose 200 ATK', on: (g, ev, c) => battleKill(ev, c),
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: -200 }); log(g, `${name(c)} lost 200 ATK.`); } } }] },

  /* ===== Aliens ===== */
  // When a Reptile you control is destroyed by battle with an opponent's attacking monster and sent to the GY: take control of
  // that monster. ENGINE: no Type change, so it stays its own Type (it should become a Reptile). No window after a battle
  // destruction, so it is offered as an optional trigger while Set.
  'Alien Brain': { effs: [trapTrig({ label: 'Take control of the attacking monster',
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && ev.prevCtrl === c.ctrl && ev.snap && ev.snap.race === 'Reptile' && race(ev.c) === 'Reptile'
      && !!ev.killer && ev.killer.ctrl !== c.ctrl && !!g.battle && g.battle.a === ev.killer,
    cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p, L2) { const k = L2.ev && L2.ev.killer; if (k && onField(k) && k.zone === 'm' && k.ctrl !== p) { takeControl(g, p, k, false); k.flags.ctrlUntil = null; } } })] },
  // When you Normal Summon an "Alien" monster, you can Special Summon this card from your hand; then place 2 A-Counters on
  // face-up monsters your opponent controls (a separate mandatory effect, no target).
  'Alien Dog': { effs: [
    { type: 'trig', loc: 'hand', when: true, tags: { ss: 1 }, label: 'Special Summon this card',
      on: (g, ev, c) => ev.type === 'summon' && ['normal', 'tribute'].includes(ev.how) && ev.p === c.owner && ev.cs.some(x => isAlien(x)),
      cond: (g, c, p) => c.zone === 'hand' && freeM(g, p) >= 0,
      res: function* (g, c, p) { if (c.zone !== 'hand') return; c.flags.f29dog = true; if (!ss(g, p, c, 'atk')) c.flags.f29dog = false; } },
    { type: 'trig', mand: true, label: 'Place 2 A-Counters',
      on: (g, ev, c) => evSummoned(ev, c, ['special']) && !!c.flags.f29dog,
      res: function* (g, c, p) { c.flags.f29dog = false; yield* placeA(g, p, 2, g2 => oppFaceUp(g2, p)); } }] },
  'Alien Grey': { cont: alienCont, effs: [
    flipEff('Place an A-Counter', {
      target: function* (g, c, p, L2) { c.flags.f29flipped = true; const cs = oppFaceUp(g, p); if (cs.length) yield* tgt(g, p, L2, 'Place an A-Counter on which monster?', cs, 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addCtr(g, t, 'A', 1); log(g, `${name(t)} got an A-Counter.`); } } }),
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'flip' && ev.c === c) c.flags.f29flipped = true; return false; } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Draw 1 card',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy' && !!ev.snap && !!ev.snap.flags && !!ev.snap.flags.f29flipped,
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  // If this card destroys a monster with an A-Counter by battle: it can attack again in a row.
  'Alien Hunter': { effs: [
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { noteBattleA(ev, c, 'f29huntA'); return false; } },
    { type: 'trig', mand: true, label: 'Attack again',
      on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && !!c.flags.f29huntA && ev.c.u === c.flags.f29huntA,
      res: function* (g, c) { if (!onField(c) || !faceUp(c)) return; c.flags.maxAttacks = c.attacks + 1; c.flags.maxAttacksTurn = g.turnNo; log(g, `${name(c)} can attack again.`); } }] },
  // Gemini: take control of an opponent's monster with an A-Counter while this card is on the field; in each of your End
  // Phases remove 1 A-Counter from each monster it controls, destroying any that run out.
  'Alien Hypno': { effs: [
    { type: 'ign', gemini: true, label: 'Take control of a monster with an A-Counter',
      cond: (g, c, p) => freeM(g, p) >= 0 && monsOf(g, opp(p)).some(x => ctr(x, 'A') > 0),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which monster with an A-Counter?', monsOf(g, opp(p)).filter(x => ctr(x, 'A') > 0), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !ctr(t, 'A') || t.ctrl === p || !onField(c)) return; const from = t.ctrl;
        if (takeControl(g, p, t, false)) { t.flags.f29hypno = c.u; t.flags.f29hypnoFrom = from; } } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Remove A-Counters',
      on: (g, ev, c) => !!c.flags.gemini && ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl && fieldMons(g).some(m => m.flags.f29hypno === c.u),
      res: function* (g, c, p) { const ms = fieldMons(g).filter(m => m.flags.f29hypno === c.u); const dead = [];
        for (const m of ms) { addCtr(g, m, 'A', -1); log(g, `An A-Counter was removed from ${name(m)}.`); if (!ctr(m, 'A')) dead.push(m); }
        if (dead.length) destroy(g, dead, { by: p, src: c }); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (g.f29hypBusy || (onField(c) && c.zone === 'm')) return false;
      for (const m of fieldMons(g)) { if (m.flags.f29hypno !== c.u) continue; const back = m.flags.f29hypnoFrom; m.flags.f29hypno = null; g.f29hypBusy = true;
        try { if (m.ctrl !== back) { if (freeM(g, back) >= 0) { takeControl(g, back, m, false); log(g, `${name(m)} returned to ${PN(g, back)}.`); } else move(g, m, 'gy', { reason: 'rule' }); } }
        finally { g.f29hypBusy = false; } }
      return false; } }] },
  // ① once per turn: move to an adjacent empty Monster Zone; ② attack directly while the opponent has no card in its column
  // (your zone i faces the opponent's zone 4 - i).
  'Alien Infiltrator': { self: { directAttack: (g, c) => { const i = g.p[c.ctrl].m.indexOf(c); if (i < 0) return false; const P = g.p[opp(c.ctrl)]; return !P.m[4 - i] && !P.st[4 - i]; } },
    effs: [{ type: 'ign', opt: true, label: 'Move to an adjacent Monster Zone',
      cond: (g, c, p) => { const i = g.p[p].m.indexOf(c); return i >= 0 && ((i > 0 && !g.p[p].m[i - 1]) || (i < 4 && !g.p[p].m[i + 1])); },
      res: function* (g, c, p) { const M = g.p[p].m, i = M.indexOf(c); if (i < 0) return; const js = [i - 1, i + 1].filter(j => j >= 0 && j < 5 && !M[j]); if (!js.length) return;
        const j = js.length > 1 ? js[yield* choose(g, p, 'Move to which zone?', js.map(j2 => j2 < i ? 'Left' : 'Right'))] : js[0];
        M[i] = null; M[j] = c; g.seq++; log(g, `${name(c)} moved to another Monster Zone.`); } }] },
  // ① if a monster is Special Summoned to your opponent's field: place 1 A-Counter on it.
  'Alien Kid': { cont: alienCont, effs: [{ type: 'trig', mand: true, label: 'Place an A-Counter',
    on: (g, ev, c) => ev.type === 'summon' && !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how) && ev.cs.some(m => onField(m) && m.ctrl !== c.ctrl),
    res: function* (g, c, p, L2) { for (const m of (L2.ev ? L2.ev.cs : [])) if (onField(m) && m.zone === 'm' && m.ctrl !== p) { addCtr(g, m, 'A', 1); log(g, `${name(m)} got an A-Counter.`); } } }] },
  'Alien Mars': { cont: { negates: (g, src, c) => isMon(c) && ctr(c, 'A') > 0 && !named(c, 'Alien Mars') } },
  // ① at the end of a Battle Phase in which it destroyed monsters with A-Counters by battle: you can Special Summon them;
  // ② if this card leaves the field, destroy them.
  'Alien Mother': { effs: [
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      noteBattleA(ev, c, 'f29momA');
      if (ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && ev.killer === c && c.flags.f29momA && ev.c.u === c.flags.f29momA) { const k = c.flags.f29momK; c.flags.f29momK = { turn: g.turnNo, us: (k && k.turn === g.turnNo ? k.us : []).concat(ev.c.u) }; }
      return false; } },
    { type: 'trig', tags: { ss: 1 }, label: 'Special Summon the monsters it destroyed',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'bpEnd' && !!c.flags.f29momK && c.flags.f29momK.turn === g.turnNo,
      cond: (g, c, p) => freeM(g, p) >= 0 && allCards(g, 'gy').some(x => c.flags.f29momK && c.flags.f29momK.us.includes(x.u)),
      res: function* (g, c, p) { const us = (c.flags.f29momK || {}).us || []; c.flags.f29momK = null; const kids = [];
        for (const x of allCards(g, 'gy').filter(x => us.includes(x.u))) if (ss(g, p, x, 'atk')) kids.push(x.u);
        if (onField(c)) c.flags.f29kids = (c.flags.f29kids || []).concat(kids); } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the monsters it Special Summoned',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to !== 'm' && !!ev.snap && !!ev.snap.flags && (ev.snap.flags.f29kids || []).some(u => fieldMons(g).some(m => m.u === u)),
      res: function* (g, c, p, L2) { const us = L2.ev.snap.flags.f29kids || []; destroy(g, fieldMons(g).filter(m => us.includes(m.u)), { by: p }); } }] },
  // Ⓤ remove 2 A-Counters from the field to Special Summon it from the hand; ① once per turn: an A-Counter on each face-up
  // monster your opponent controls; you can only control 1 Alien Overlord.
  'Alien Overlord': {
    proc: { label: 'Special Summon (remove 2 A-Counters)', cond: (g, c, p) => aCount(g) >= 2 && !monsOf(g, p).some(x => faceUp(x) && named(x, 'Alien Overlord')),
      cost: function* (g, c, p) { yield* removeA(g, p, 2); } },
    cont: { ...alienCont, forbid: (g, src, a) => ['ns', 'set', 'ss'].includes(a.type) && a.p === src.ctrl && !!a.c && a.c !== src && a.c.id != null && named(a.c, 'Alien Overlord') },
    effs: [{ type: 'ign', opt: true, label: 'Place an A-Counter on each opponent\'s monster',
      cond: (g, c, p) => oppFaceUp(g, p).length > 0,
      res: function* (g, c, p) { const ms = oppFaceUp(g, p); for (const m of ms) addCtr(g, m, 'A', 1); if (ms.length) log(g, `${ms.map(name).join(', ')} got an A-Counter.`); } }] },
  'Alien Psychic': { cont: { forbid: (g, src, a) => a.type === 'attack' && !!a.c && ctr(a.c, 'A') > 0 },
    effs: [{ type: 'trig', mand: true, label: 'Change to Defense Position', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute', 'flip']),
      res: function* (g, c) { toDef(g, c); } }] },
  // Ⓤ Special Summon it from your hand to your opponent's field by Tributing 1 of their Level 3 or lower monsters, with an
  // A-Counter on it; you can't Normal Summon/Set that turn. The summon goes through the engine's own rule onto your field and the
  // card moves to the opponent's field as it is summoned (no chain). PARTIAL: it needs a free Monster Zone on your side too.
  'Alien Skull': {
    proc: { label: 'Special Summon to the opponent\'s field (Tribute their Level 3 or lower monster)',
      cond: (g, c, p) => g.ns[p] === 0 && monsOf(g, opp(p)).some(x => faceUp(x) && lv(x) <= 3),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Tribute which Level 3 or lower monster your opponent controls?', monsOf(g, opp(p)).filter(x => faceUp(x) && lv(x) <= 3), 1, 1, 'bad');
        if (!x) return; move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); c.flags.f29skull = p;
        addRule(g, (g2, a) => (a.type === 'ns' || a.type === 'set') && a.p === p, { end: g.turnNo }); } },
    cont: alienCont,
    effs: [{ type: 'trig', res: noop, on: (g, ev, c) => {
      if (ev.type === 'summon' && ev.cs.includes(c) && c.flags.f29skull != null) { const p = c.flags.f29skull; c.flags.f29skull = null;
        if (c.ctrl === p && freeM(g, opp(p)) >= 0) { takeControl(g, opp(p), c, false); c.flags.ctrlUntil = null; addCtr(g, c, 'A', 1); log(g, `${name(c)} got an A-Counter.`); } }
      return false; } }] },

  /* ===== Allure Queens ===== */
  'Allure Queen LV3': allureQueen(3, null, 'Allure Queen LV5'),
  'Allure Queen LV5': allureQueen(5, 'Allure Queen LV3', 'Allure Queen LV7'),
  'Allure Queen LV7': allureQueen(null, 'Allure Queen LV5', null),

  /* ===== Arcana Force ===== */
  // Target 1 Arcana Force you control and 1 Arcana Force in either GY; banish the GY one; until the End Phase the first one's
  // heads/tails effect becomes the banished monster's (same result).
  'Arcana Call': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isArcana(x)) && allCards(g, 'gy').some(x => isMon(x) && isArcana(x)),
    target: function* (g, c, p, L2) { const [a] = yield* pick(g, p, 'Target which Arcana Force you control?', monsOf(g, p).filter(x => faceUp(x) && isArcana(x)), 1, 1, 'good');
      const [b] = yield* pick(g, p, 'Target which Arcana Force in a GY?', allCards(g, 'gy').filter(x => isMon(x) && isArcana(x)), 1, 1, 'good'); L2.t = [a, b].filter(Boolean); },
    res: function* (g, c, p, L2) { const [a, b] = L2.t; if (!a || !b || b.zone !== 'gy') return; move(g, b, 'ban', { reason: 'effect', by: p }); log(g, `${PN(g, p)} banished ${D(b).n}.`);
      if (!onField(a) || !faceUp(a) || a.zone !== 'm') return; a.flags.arcSub = { n: D(b).n, turn: g.turnNo }; g.seq++; log(g, `${name(a)} uses the effect of ${D(b).n} this turn.`); arcApply(g, a); } }] },
  // Fusion: "Queen's Knight" + "Jack's Knight" + "King's Knight" (no substitutes). Once per turn, when a Spell/Trap Card or monster
  // effect that targets this face-up card is activated: discard a card of the same type; negate the effect.
  'Arcana Knight Joker': { effs: [{ type: 'quick', opt: true, ds: true, label: 'Discard the same card type: negate the effect',
    cond: (g, c, p, x) => { const T = x.top; if (!targetsMe(T, c) || !faceUp(c)) return false; const k = T.cardAct ? kindOf(T.c) : isMon(T.c) ? 0 : -1; return k >= 0 && g.p[p].hand.some(h => kindOf(h) === k); },
    cost: function* (g, c, p, L2) { const T = g.chain[g.chain.length - 1]; L2.data.T = T; const k = T.cardAct ? kindOf(T.c) : 0;
      const [h] = yield* pick(g, p, `Discard 1 ${['Monster', 'Spell', 'Trap'][k]} Card`, g.p[p].hand.filter(x => kindOf(x) === k), 1, 1, 'cost'); if (h) { move(g, h, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${D(h).n}.`); } },
    res: function* (g, c, p, L2) { const T = L2.data.T; if (T && !T.negated) { T.negBy = p; negate(g, T, false); } } }] },
  // "This card can't be destroyed by battle" and "can't be changed to Defense Position, except with a card effect" always apply.
  'Arcana Force 0 - The Fool': (() => { const s = arcana(); s.self = { ...s.self, noBattleDestroy: true }; return s; })(),
  'Arcana Force EX - The Dark Ruler': arcana({ proc: exProc, hows: ['special'], pre: [lockInstall] }),
  'Arcana Force EX - The Light Ruler': arcana({ proc: exProc, hows: ['special'], pre: [lockInstall] }),
  'Arcana Force I - The Magician': arcana(),
  'Arcana Force III - The Empress': arcana(),
  'Arcana Force IV - The Emperor': arcana(),
  'Arcana Force VI - The Lovers': arcana(),
  'Arcana Force VII - The Chariot': arcana(),
  // During damage calculation: discard this card; you take no battle damage from that battle.
  // PARTIAL: the engine has no window during damage calculation, so it is used in the Damage Step windows before it.
  'Arcana Force XIV - Temperance': arcana({ pre: [
    { type: 'quick', loc: 'hand', ds: true, label: 'Discard: no battle damage from this battle',
      cond: (g, c, p) => g.inDS && !!g.battle,
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${D(c).n}.`); },
      res: function* (g, c, p) { const P = g.p[p]; g.f29temp = { p, b: g.battle, prev: P.noBattleDamage }; P.noBattleDamage = g.turnNo; log(g, `${PN(g, p)} takes no battle damage from this battle.`); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { const t = g.f29temp; if (t && ev.type === 'dsEnd') { g.p[t.p].noBattleDamage = t.prev; g.f29temp = null; } return false; } }] }),
  'Arcana Force XVIII - The Moon': arcana(),
  'Arcana Force XXI - The World': arcana(),

  /* ===== Archfiends ===== */
  // Discard this card (cost): add 1 Pandemonium from your Deck to your hand. While on the field without Pandemonium, destroy it.
  'Archfiend General': { effs: [
    { type: 'ign', loc: 'hand', label: 'Discard: add Pandemonium',
      cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'Pandemonium')),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded Archfiend General.`); },
      res: function* (g, c, p) { yield* search(g, p, x => named(x, 'Pandemonium'), 'Add Pandemonium to your hand'); } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroyed without Pandemonium',
      on: (g, ev, c) => faceUp(c) && !pandUp(g),
      cond: (g, c) => onField(c) && faceUp(c) && !pandUp(g),
      res: function* (g, c, p) { if (onField(c) && faceUp(c) && !pandUp(g)) destroy(g, [c], { by: p, rule: true }); } }] },
  // When sent to the GY: you can target 1 face-up monster; equip it with this card; it loses 500 ATK.
  'Archfiend of Gilfer': { cont: { atk: (g, src, m) => src.zone === 'st' && src.flags.f29gil && src.equipTo === m.u ? -500 : 0 },
    effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Equip it to a monster (-500 ATK)',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy',
      cond: (g, c, p) => freeST(g, p) >= 0 && fieldMons(g).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Archfiend of Gilfer to which monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || c.zone !== 'gy' || freeST(g, p) < 0) return;
        move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); c.equipTo = t.u; c.flags.f29gil = true; log(g, `Archfiend of Gilfer was equipped to ${name(t)}.`); } }] },
  // "Plaguespreader Zombie" + 2 or more non-Tuner Zombies; Zombies you control can't be destroyed by card effects.
  'Archfiend Zombie-Skull': { noSynchro: true, proc: synProc({ tuner: c => named(c, 'Plaguespreader Zombie'), non: c => race(c) === 'Zombie', minNon: 2 }),
    cont: { grant: (g, src, m, flag) => flag === 'noEffectDestroy' && m.ctrl === src.ctrl && m.zone === 'm' && faceUp(m) && race(m) === 'Zombie' } },
});
})();
