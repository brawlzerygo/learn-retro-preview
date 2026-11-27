/* Full pool batch 21 (build/batches/full/full-21.md): Drill Bug to Fuh-Rin-Ka-Zan.
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts (Edison text and rulings);
 cards that also have a goat-only script (classic-*.js, goat-*.js) keep it in Goat. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, takeControl, addMod, equip, ctr,
  addRule, ritualSummon, canRitual, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk,
  monsOf, stOf, allField, fieldMons, freeM, freeST, nFreeM, shuffleDeck, log, PN, live, opp, oppFaceUp, stOnField,
  spellTrapAct, evSummoned, battleKill, negd, isExtraD, emit } = L;
const atk = L.atk, def = L.def;

/* ----- helpers for this batch ----- */
const named = (c, ...ns) => ns.includes(D(c).n);
const noopG = function* () {};
const noop = { type: 'act', res: noopG };
const mainPhase = g => g.phase === 'main1' || g.phase === 'main2';
// "by a card effect your opponent controls": the mover the script named, else the turn player
const byOpp = (g, ev, c) => ev.by != null ? ev.by !== c.owner : g.tp !== c.owner;
const effMove = ev => ev.reason !== 'cost' && ev.reason !== 'rule' && ev.reason !== 'draw' && !ev.battle;
const isUnion = c => isMon(c) && /Union/.test(D(c).ab || '');
const isNormalMon = c => D(c).k === 'normal' || !!c.flags.trapMon;
const hasUnion = (g, m) => allField(g).some(x => x.zone === 'st' && x.equipTo === m.u && x.flags.union);
const PIECES = ['Exodia the Forbidden One', 'Right Arm of the Forbidden One', 'Left Arm of the Forbidden One', 'Right Leg of the Forbidden One', 'Left Leg of the Forbidden One'];
const ATTRS = ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND'];
function negLink(g, T, p, destroyIt) { if (!T || T.negated) return; T.negated = true; T.negBy = p; log(g, `${name(T.c)}'s effect was negated.`); if (destroyIt && onField(T.c)) destroy(g, [T.c], { by: p }); }
// Equip Spells
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?', o = {}) => ({ type: 'act',
  cond: (g, c, p) => (o.cands ? o.cands(g, p) : fieldMons(g)).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, (o.cands ? o.cands(g, p) : fieldMons(g)).filter(m => faceUp(m) && filter(m)), 1, 1, o.hint || 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c) && equip(g, c, t) && o.post) yield* o.post(g, c, p, L2, t); } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
// Traps that answer a moment with no response window (a draw, a destruction): optional triggers while Set (as classic-5.js).
// ENGINE: no response window after a card is destroyed or drawn outside a chain.
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });
// a Spell/Trap is resolving now (a face-up Normal Spell, Quick-Play or Normal Trap still on the field), for effects that
// don't say what destroyed a card (destroy() called without src)
const stResolving = g => stOnField(g).some(x => faceUp(x) && !['Continuous', 'Equip', 'Field'].includes(D(x).sub));
const spellSrc = (g, o) => o.src ? (isSpell(o.src) ? o.src : null) : (stOnField(g).find(x => faceUp(x) && isSpell(x) && D(x).sub !== 'Continuous' && D(x).sub !== 'Equip' && D(x).sub !== 'Field' && (o.by == null || x.ctrl === o.by)) || null);
// switch control of two monsters (Creature Swap style, it lasts)
function swapCtrl(g, a, b) {
  if (!a || !b || !onField(a) || !onField(b) || a.zone !== 'm' || b.zone !== 'm' || a.ctrl === b.ctrl) return false;
  const pa = a.ctrl, pb = b.ctrl, ia = g.p[pa].m.indexOf(a), ib = g.p[pb].m.indexOf(b);
  g.p[pa].m[ia] = b; g.p[pb].m[ib] = a; a.ctrl = pb; b.ctrl = pa; g.seq++;
  for (const x of [a, b]) { x.flags.ctrlUntil = null; x.flags.ctrlFrom = null; }
  log(g, `${PN(g, pa)} and ${PN(g, pb)} switched control of ${L.shown(g, a)} and ${L.shown(g, b)}.`); return true;
}
// give a taken monster back (Eria, Falling Down)
function giveBack(g, t, to) { if (!t || !onField(t) || t.ctrl === to) return; if (freeM(g, to) >= 0) takeControl(g, to, t, false); else move(g, t, 'gy', { reason: 'rule' }); }
// Spell Speed 3 answer to a Spell that targets one of your monsters (Freed, Frontier Wiseman).
// ENGINE: no automatic negation hook, so it is an optional Spell Speed 3 response. PARTIAL: the player may decline.
const spellGuard = (protects, label) => ({ type: 'quick', speed: 3, ds: true, label,
  cond: (g, c, p, x) => { const t = x.top; return !!(t && isSpell(t.c) && !t.negated && t.t && t.t.some(m => onField(m) && faceUp(m) && m.zone === 'm' && protects(g, c, p, m))); },
  target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
  res: function* (g, c, p, L2) { negLink(g, L2.data.L, p, true); } });
// redirect a Spell's single target (Fairy's / Fiend's Hand Mirror). PARTIAL: "appropriate target" is the same kind of card
// (a monster for a monster, a Spell/Trap for a Spell/Trap) with the same face-up or face-down state.
const mirror = (isKind, extra) => ({ type: 'act',
  cond: (g, c, p, x) => { const t = x.top; if (!(t && spellTrapAct(t) && isSpell(t.c) && t.p !== p && !t.negated && t.t && t.t.length === 1)) return false; const o = t.t[0]; return onField(o) && isKind(o) && others(g, c, t).length > 0; },
  target: function* (g, c, p, L2) { const T = g.chain[g.chain.length - 1]; L2.data.T = T; yield* tgt(g, p, L2, `${name(T.c)} now targets which card?`, others(g, c, T), 1, 1, 'bad'); } ,
  res: function* (g, c, p, L2) { const T = L2.data.T, n = live(L2)[0]; if (!T || !g.chain.includes(T) || !n) return; T.t = [n]; log(g, `${name(T.c)} now targets ${L.shown(g, n)}.`); } });
function others(g, c, T) { const o = T.t[0]; const pool = isMon(o) || o.zone === 'm' ? fieldMons(g) : stOnField(g); return pool.filter(x => x !== o && x !== T.c && faceUp(x) === faceUp(o) && (x.zone === 'm') === (o.zone === 'm')); }

// "Cannot be Special Summoned" locks: one duel-long rule, put in by the first event any of these cards sees.
// Exodia Necross: only by Contract with Exodia (a face-up Contract of the summoner resolving now).
// Fenrir: must first be Special Summoned from the hand by its own rule; once properly summoned it can come back from the
// GY or banished (Edison ruling). In Goat (2005 text "can only be Special Summoned by ...") it never can.
// PARTIAL: an effect that Special Summons Fenrir from the hand is not stopped.
const LOCKS = {
  'Exodia Necross': (g, a) => !stOf(g, a.p).some(x => faceUp(x) && named(x, 'Contract with Exodia')),
  'Fenrir': (g, a) => ['deck', 'extra'].includes(a.c.zone) || (['gy', 'ban'].includes(a.c.zone) && (E.format() === 'goat' || !a.c.f21proper)),
};
const lockInstall = { type: 'trig', loc: 'any', res: noopG,
  on: (g) => { if (!g.f21lock) { g.f21lock = true; addRule(g, (g2, a) => { if (a.type !== 'ss' || !a.c || !a.c.id) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); } return false; } };

E.addScripts({
  /* ----- monsters ----- */
  'Drill Bug': { effs: [{ type: 'trig', when: true, label: 'Put Parasite Paracide on top of the Deck',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'Parasite Paracide')),
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => named(x, 'Parasite Paracide')); if (!cs.length) return;
      const [x] = yield* pick(g, p, 'Select Parasite Paracide from your Deck', cs, 1, 1, 'good'); shuffleDeck(g, p); if (!x || x.zone !== 'deck') return;
      move(g, x, 'deckTop', { reason: 'effect' }); log(g, `${PN(g, p)} placed Parasite Paracide on top of the Deck.`); } }] },
  // Ported from classic-3.js.
  'Drillago': { self: { directAttack: (g, c) => { const f = [...monsOf(g, opp(c.ctrl)), ...stOf(g, opp(c.ctrl))]; return f.length > 0 && f.every(x => x.zone === 'm' && faceUp(x) && atk(g, x) >= 1600); } } },
  // Flip: the opponent picks the monster. Control stays switched (like Creature Swap).
  'Dummy Golem': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Switch control', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { const o = opp(p); if (!onField(c) || c.zone !== 'm' || c.ctrl !== p || !monsOf(g, o).length) return;
      const [m] = yield* pick(g, o, 'Dummy Golem: which of your monsters do you give?', monsOf(g, o), 1, 1, 'cost'); if (m) swapCtrl(g, c, m); } }] },
  // A Continuous Effect as it is Normal Summoned: no Trap Card can be activated in response (Solemn on the summon still works).
  'Eagle Eye': { effs: [{ type: 'trig', res: noopG, on: (g, ev, c) => {
    if (evSummoned(ev, c, ['normal', 'tribute'])) { const u = c.u, grp = ev.group; addRule(g, (g2, a) => a.type === 'activate' && isTrap(a.c) && !!g2.sw && g2.sw.cs.some(x => x.u === u) && g2.sw.group === grp, { end: g.turnNo }); log(g, 'No Trap Cards can be activated.'); }
    return false; } }] },
  // Each attack by a non-Zombie into a face-up Electric Lizard stops that monster's attacks on its controller's next turn.
  'Electric Lizard': { effs: [{ type: 'trig', res: noopG, on: (g, ev, c) => {
    if (ev.type === 'afterCalc' && ev.t === c && ev.a && onField(ev.a) && race(ev.a) !== 'Zombie') {
      ev.a.flags.f21liz = g.turnNo + 2; log(g, `${name(ev.a)} can't attack on its next turn.`);
      if (!g.f21lizR) { g.f21lizR = true; addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.flags && a.c.flags.f21liz === g2.turnNo); } }
    return false; } }] },
  // Ported from classic-2.js.
  'Electric Snake': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Draw 2 cards',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'hand' && ev.to === 'gy' && ev.reason === 'discard' && byOpp(g, ev, c),
    res: function* (g, c, p) { draw(g, p, 2); } }] },
  'Elephant Statue of Blessing': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Gain 2000 LP',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'hand' && ev.to === 'gy' && effMove(ev) && byOpp(g, ev, c),
    res: function* (g, c, p) { gain(g, p, 2000); } }] },
  'Elephant Statue of Disaster': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: '2000 damage',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'hand' && ev.to === 'gy' && effMove(ev) && byOpp(g, ev, c),
    res: function* (g, c, p) { damage(g, opp(p), 2000, { src: c, srcP: p }); } }] },
  'Emes the Infinity': { effs: [{ type: 'trig', mand: true, label: '+700 ATK', on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
    res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 700 }); log(g, 'Emes the Infinity gained 700 ATK.'); } } }] },
  'Empress Judge': { effs: [] },
  'Enraged Muka Muka': { self: { atk: (g, c) => 400 * g.p[c.ctrl].hand.length, def: (g, c) => 400 * g.p[c.ctrl].hand.length } },
  // Flip: control lasts while Eria is face-up on the field (checked at every game event).
  'Eria the Water Charmer': { effs: [
    { type: 'trig', mand: true, faceDownOk: true, label: 'Take control of a WATER monster', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
      target: function* (g, c, p, L2) { const cs = oppFaceUp(g, p).filter(m => attr(m) === 'WATER'); if (cs.length) yield* tgt(g, p, L2, 'Take control of which face-up WATER monster?', cs, 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || attr(t) !== 'WATER' || t.ctrl === p || !onField(c) || !faceUp(c)) return;
        const from = t.ctrl; if (takeControl(g, p, t, false)) c.f21charm = { u: t.u, from }; } },
    { type: 'trig', loc: 'any', mand: true, label: 'Control returns',
      on: (g, ev, c) => !!c.f21charm && (!onField(c) || !faceUp(c) || c.zone !== 'm'),
      res: function* (g, c) { const s = c.f21charm; c.f21charm = null; if (!s) return; const t = fieldMons(g).find(x => x.u === s.u); if (t) giveBack(g, t, s.from); } }] },
  // Ported from goat-3.js (Edison: "Tribute this card to target 1 monster on the field; destroy that target").
  'Exiled Force': { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Tribute: destroy a monster',
    cond: (g, c) => fieldMons(g).some(x => x !== c),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Exiled Force.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  // Only Contract with Exodia can Special Summon it (lock above). Can't be destroyed by battle or by Spell/Trap effects.
  // PARTIAL: a destruction that doesn't name its source counts as a Spell/Trap one when a Spell/Trap is resolving.
  // The self-destruction is a mandatory trigger at the next game event (a Continuous Effect in the rules).
  'Exodia Necross': {
    self: { noBattleDestroy: true, replaceDestroy: (g, c, o) => !o.battle && !o.rule && (o.src ? isST(o.src) : stResolving(g)) },
    effs: [lockInstall,
      { type: 'trig', mand: true, opt: true, label: '+500 ATK', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
        res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500 }); log(g, 'Exodia Necross gained 500 ATK.'); } } },
      { type: 'trig', mand: true, label: 'Destroyed (Exodia pieces missing)',
        on: (g, ev, c) => onField(c) && faceUp(c) && !PIECES.every(n => g.p[c.ctrl].gy.some(x => named(x, n))),
        res: function* (g, c) { if (onField(c) && faceUp(c) && !PIECES.every(n => g.p[c.ctrl].gy.some(x => named(x, n)))) destroy(g, [c], { rule: true }); } }] },
  // Ported from classic-1.js.
  'Exodia the Forbidden One': { effs: [], self: { handWin: (g, c, p) => PIECES.slice(1).every(n => g.p[p].hand.some(x => named(x, n))) } },
  'Fear from the Dark': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon this card',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && (ev.from === 'hand' || ev.from === 'deck') && ev.to === 'gy' && effMove(ev) && byOpp(g, ev, c),
    cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c, 'atk'); } }] },
  'Fenrir': {
    proc: { label: 'Special Summon (banish 2 WATER monsters from your GY)',
      cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && attr(x) === 'WATER').length >= 2,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Banish 2 WATER monsters from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'WATER'), 2, 2, 'cost');
        for (const x of xs) move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${xs.map(name).join(' and ')}.`); c.flags.f21proc = true; } },
    effs: [lockInstall,
      { type: 'trig', res: noopG, on: (g, ev, c) => { if (ev.type === 'summon' && ev.cs.includes(c) && c.flags.f21proc) c.f21proper = true; return false; } },
      { type: 'trig', mand: true, label: 'Opponent skips their next Draw Phase',
        on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.prevCtrl !== c.ctrl,
        res: function* (g, c, p) { const o = opp(p), when = g.tp === o ? g.turnNo + 2 : g.turnNo + 1;
          addRule(g, (g2, a) => a.type === 'draw' && a.p === o && g2.phase === 'draw' && g2.turnNo === when, { end: when });
          log(g, `${PN(g, o)} skips the next Draw Phase.`); } }] },
  // Flip: hands, fields and GYs go back into the Decks (Fusion and Synchro Monsters to the Extra Deck), then each draws 5.
  'Fiber Jar': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Reset hands, field and GYs', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) {
      const grp = g.group;
      const back = x => move(g, x, isExtraD(D(x)) ? 'extra' : 'deckTop', { reason: 'effect', by: p, group: grp, noLater: true });
      for (const x of fieldMons(g)) back(x);
      for (const x of stOnField(g)) back(x);
      for (const q of [0, 1]) { for (const x of g.p[q].hand.slice()) back(x); for (const x of g.p[q].gy.slice()) back(x); }
      g.later = []; g.laterDestroy = [];
      shuffleDeck(g, 0); shuffleDeck(g, 1); log(g, 'Both players shuffled their hand, field and GY into the Deck.');
      draw(g, g.tp, 5); draw(g, opp(g.tp), 5); } }] },
  'Firebird': { effs: [{ type: 'trig', mand: true, label: '+500 ATK',
    on: (g, ev, c) => ev.type === 'move' && ev.c !== c && ev.destroyed && ev.wasField && ev.from === 'm' && ev.prevCtrl === c.ctrl && ev.snap && ev.snap.faceUp && ev.snap.race === 'Winged Beast',
    res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500 }); log(g, 'Firebird gained 500 ATK.'); } } }] },
  'Flash Assailant': { self: { atk: (g, c) => -400 * g.p[c.ctrl].hand.length, def: (g, c) => -400 * g.p[c.ctrl].hand.length } },
  'Flower Wolf': { effs: [] },
  // Face-up at the start of the Damage Step and destroyed by battle: it comes back in the End Phase (to its owner).
  // "This face-up card can't be Tributed for a Tribute Summon" keeps c.flags.noTribute in step with its face.
  'Fox Fire': { effs: [
    { type: 'trig', loc: 'any', res: noopG, on: (g, ev, c) => {
      if (onField(c) && c.zone === 'm') c.flags.noTribute = faceUp(c) && !negd(g, c);
      if (ev.type === 'dsStart' && (ev.a === c || ev.t === c) && faceUp(c)) c.f21ds = g.turnNo;
      if (ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy' && c.f21ds === g.turnNo) c.f21fox = g.turnNo;
      return false; } },
    { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon this card',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.f21fox === g.turnNo,
      cond: (g, c) => freeM(g, c.owner) >= 0,
      res: function* (g, c) { c.f21fox = null; if (c.zone === 'gy') ss(g, c.owner, c, 'atk'); } }] },
  // The draw is skipped when a Level 4 or lower Warrior is in the Deck; the choice to search or draw is offered at the
  // start of the Standby Phase (as full-05.js Dark General Freed). PARTIAL: the choice comes one step late.
  'Freed the Matchless General': {
    cont: { forbid: (g, src, a) => {
      if (a.type !== 'draw' || g.phase !== 'draw' || a.p !== src.ctrl || g.tp !== src.ctrl || src.zone !== 'm' || negd(g, src)) return false;
      if (g.f21freed && g.f21freed.t === g.turnNo) return false;
      if (!g.p[a.p].deck.some(x => isMon(x) && race(x) === 'Warrior' && lv(x) <= 4)) return false;
      g.f21freed = { t: g.turnNo, u: src.u }; return true; } },
    effs: [
      { type: 'trig', loc: 'any', mand: true, label: 'Draw or add a Warrior',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && g.f21freed && g.f21freed.t === g.turnNo && g.f21freed.u === c.u,
        res: function* (g, c, p) {
          const okk = onField(c) && faceUp(c) && g.p[p].deck.some(x => isMon(x) && race(x) === 'Warrior' && lv(x) <= 4);
          const k = okk ? yield* choose(g, p, 'Freed the Matchless General: instead of your normal draw?', ['Add a Level 4 or lower Warrior', 'Draw normally']) : 1;
          if (k === 0) yield* search(g, p, x => isMon(x) && race(x) === 'Warrior' && lv(x) <= 4, 'Add which Level 4 or lower Warrior?'); else draw(g, p, 1); } },
      spellGuard((g, c, p, m) => m === c, 'Negate the Spell targeting Freed')] },
  // Union with Burning Beast (as full-03.js Burning Beast).
  'Freezing Beast': {
    cont: { replaceDestroy: (g, src, m, o) => { if (!o.battle || !src.flags.union || src.equipTo !== m.u || src.zone !== 'st') return false; log(g, `Freezing Beast was destroyed instead of ${name(m)}.`); destroy(g, [src], { quietLog: true }); return true; } },
    effs: [
      { type: 'ign', label: 'Equip to Burning Beast',
        cond: (g, c, p) => c.used.union !== g.turnNo && freeST(g, p) >= 0 && monsOf(g, p).some(x => x !== c && faceUp(x) && named(x, 'Burning Beast') && !hasUnion(g, x)),
        after: (g, c) => { c.used.union = g.turnNo; },
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Freezing Beast to which Burning Beast?', monsOf(g, p).filter(x => x !== c && faceUp(x) && named(x, 'Burning Beast') && !hasUnion(g, x)), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || c.zone !== 'm' || !faceUp(c) || freeST(g, p) < 0 || hasUnion(g, t)) return; move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); c.equipTo = t.u; c.flags.union = true; log(g, `Freezing Beast was equipped to ${name(t)}.`); } },
      { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Unequip and Special Summon',
        cond: (g, c, p) => c.used.union !== g.turnNo && !!c.flags.union && !!c.equipTo && freeM(g, p) >= 0,
        after: (g, c) => { c.used.union = g.turnNo; },
        res: function* (g, c, p) { if (c.zone !== 'st' || !c.equipTo) return; c.equipTo = null; c.flags.union = false; ss(g, p, c, 'atk'); } },
      { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy a face-down Spell/Trap',
        on: (g, ev, c) => ev.type === 'damage' && ev.battle && !!ev.src && !!c.flags.union && ev.src.u === c.equipTo && ev.p !== ev.src.ctrl,
        cond: g => stOnField(g).some(x => !faceUp(x)),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-down Spell/Trap?', stOnField(g).filter(x => !faceUp(x)), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { destroy(g, live(L2).filter(x => !faceUp(x)), { by: p }); } }] },
  'Frontier Wiseman': { effs: [spellGuard((g, c, p, m) => m.ctrl === p && race(m) === 'Warrior', 'Negate the Spell targeting your Warrior')] },

  /* ----- Spells ----- */
  // PARTIAL: "unaffected" covers destruction only (no hook for other effects), and a destruction with no named source
  // counts as a Spell when one of that player's Spells is resolving.
  'Dust Barrier': {
    cont: { replaceDestroy: (g, src, m, o) => { if (o.battle || o.rule || m.zone !== 'm' || !faceUp(m) || !isNormalMon(m)) return false; const s = spellSrc(g, o); return !!s && s.ctrl !== src.ctrl; } },
    effs: [{ type: 'act', res: function* (g, c) { c.flags.f21sb = 0; } },
      { type: 'trig', loc: 'st', mand: true, label: 'Destroyed (second Standby Phase)',
        on: (g, ev, c) => { if (!(ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl)) return false; c.flags.f21sb = (c.flags.f21sb || 0) + 1; return c.flags.f21sb >= 2; },
        res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { rule: true }); } }] },
  'Earth Chant': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => canRitual(g, p, { monster: x => attr(x) === 'EARTH', exact: true }),
    res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => attr(x) === 'EARTH', exact: true }); } }] },
  'Earthquake': { effs: [{ type: 'act', cond: g => fieldMons(g).some(m => m.pos === 'atk'),
    res: function* (g) { const ms = fieldMons(g).filter(m => m.pos === 'atk'); for (const m of ms) { m.pos = 'def'; g.seq++; } if (ms.length) log(g, `${ms.map(name).join(', ')} changed to Defense Position.`); for (const m of ms) emit(g, { type: 'pos', c: m, p: m.ctrl }); } }] },
  // Ported from classic-4.js.
  'Ectoplasmer': { effs: [noop,
    { type: 'trig', loc: 'st', mand: true, opt: true, label: 'Tribute a monster for damage',
      on: (g, ev) => ev.type === 'phase' && ev.ph === 'end', cond: g => monsOf(g, g.tp).some(faceUp),
      res: function* (g, c, p, L2) { const tp = L2.ev.tp; const cs = monsOf(g, tp).filter(faceUp); if (!cs.length) return;
        const [m] = yield* pick(g, tp, 'Tribute which face-up monster (Ectoplasmer)?', cs, 1, 1, 'cost'); if (!m) return;
        const n = Math.floor(baseAtk(m) / 2); move(g, m, 'gy', { reason: 'effect', by: p, tribute: true }); log(g, `${PN(g, tp)} Tributed ${D(m).n}.`);
        if (n > 0) damage(g, opp(tp), n, { src: c, srcP: tp }); } }] },
  // The count is the equipped monster's controller's End Phases after activation; a control change restarts it.
  'Ekibyo Drakmord': {
    cont: { grant: (g, src, m, flag) => flag === 'cantAttack' && src.equipTo === m.u },
    effs: [equipAct(() => true, 'Equip to which face-up monster?', { hint: 'bad', post: function* (g, c, p, L2, t) { c.flags.f21eki = { t: g.turnNo, ctrl: t.ctrl, n: 0 }; } }),
      { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy the equipped monster',
        on: (g, ev, c) => { const s = c.flags.f21eki; if (!s || ev.type !== 'phase' || ev.ph !== 'end') return false; const m = fieldMons(g).find(x => x.u === c.equipTo); if (!m) return false;
          if (m.ctrl !== s.ctrl) { s.ctrl = m.ctrl; s.n = 0; s.t = g.turnNo; return false; }
          if (ev.tp !== m.ctrl || g.turnNo <= s.t) return false; s.n++; return s.n >= 2; },
        res: function* (g, c, p) { const m = fieldMons(g).find(x => x.u === c.equipTo); if (!onField(c) || !m) return;
          move(g, c, 'hand', { reason: 'effect' }); log(g, `Ekibyo Drakmord returned to ${PN(g, c.owner)}'s hand.`); destroy(g, [m], { by: p, src: c }); } }] },
  'Electro-Whip': { cont: eqBonus(300, 300), effs: [equipAct(m => race(m) === 'Thunder', 'Equip to which face-up Thunder monster?')] },
  // Ported from classic-4.js.
  'Elegant Egotist': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && fieldMons(g).some(m => faceUp(m) && name(m) === 'Harpie Lady') && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Harpie Lady', 'Harpie Lady Sisters')),
    res: function* (g, c, p) { if (freeM(g, p) < 0 || !fieldMons(g).some(m => faceUp(m) && name(m) === 'Harpie Lady')) return;
      const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Harpie Lady', 'Harpie Lady Sisters')); const [x] = yield* pick(g, p, 'Special Summon Harpie Lady or Harpie Lady Sisters', cs, 1, 1, 'good');
      if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x); if (fromDeck) shuffleDeck(g, p); } } }] },
  // Ported from classic-4.js.
  "Elf's Light": { cont: eqBonus(400, -200), effs: [equipAct(m => attr(m) === 'LIGHT', 'Equip to which face-up LIGHT monster?')] },
  'Emblem of Dragon Destroyer': { effs: [{ type: 'act', cond: (g, c, p) => [...g.p[p].deck, ...g.p[p].gy].some(x => named(x, 'Buster Blader')),
    res: function* (g, c, p) { const cs = [...g.p[p].deck, ...g.p[p].gy].filter(x => named(x, 'Buster Blader')); if (!cs.length) return;
      if (cs.every(x => x.zone === 'deck') && L.forbid(g, { type: 'search', p })) return;
      const [x] = yield* pick(g, p, 'Add Buster Blader from your Deck or GY', cs, 1, 1, 'good'); if (!x) return;
      const fromDeck = x.zone === 'deck'; move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added Buster Blader to the hand.`); if (fromDeck) shuffleDeck(g, p); } }] },
  // Ported from goat-7.js. Sending the cards is the cost.
  'Emergency Provisions': { effs: [{ type: 'act', cond: (g, c, p) => stOf(g, p).some(x => x !== c),
    cost: function* (g, c, p, L2) { const xs = yield* pick(g, p, 'Send which of your other Spells and Traps to the GY?', stOf(g, p).filter(x => x !== c), 1, 6, 'cost');
      for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p }); L2.data.n = xs.length; log(g, `${PN(g, p)} sent ${xs.length} card${xs.length > 1 ? 's' : ''} to the GY.`); },
    res: function* (g, c, p, L2) { gain(g, p, 1000 * (L2.data.n || 0)); } }] },
  // Excavated Level 3 or lower Normal Monsters are Special Summoned (ones with no zone go to the GY), the rest shuffled back.
  'Enchanting Fitting Room': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.p[p].lp > 800 && g.p[p].deck.length > 0,
    cost: function* (g, c, p) { pay(g, p, 800); },
    res: function* (g, c, p) { const dk = g.p[p].deck; const top = dk.slice(-4).reverse(); if (!top.length) return;
      log(g, `${PN(g, p)} excavated ${top.map(name).join(', ')}.`);
      let mons = top.filter(x => D(x).k === 'normal' && lv(x) <= 3);
      const room = nFreeM(g, p);
      if (mons.length > room) { const keep = room ? yield* pick(g, p, `Special Summon which ${room} monster${room > 1 ? 's' : ''}?`, mons, room, room, 'good') : [];
        for (const x of mons.filter(x => !keep.includes(x))) move(g, x, 'gy', { reason: 'effect' }); mons = keep; }
      for (const x of mons) if (x.zone === 'deck' && !ss(g, p, x, 'atk')) move(g, x, 'gy', { reason: 'effect' });
      shuffleDeck(g, p); } }] },
  'Eternal Rest': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(m => allField(g).some(x => x.equipTo === m.u)),
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => allField(g).some(x => x.equipTo === m.u)), { by: p, src: c }); } }] },
  // Ported from classic-4.js.
  'Exchange': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && g.p[opp(p)].hand.length > 0,
    // PARTIAL: the engine keeps every hand card in its owner's hand, so a card taken this way changes owner.
    res: function* (g, c, p) { const o = opp(p), mine = g.p[p].hand.slice(), theirs = g.p[o].hand.slice(); if (!mine.length || !theirs.length) return;
      log(g, 'Both players revealed their hands.');
      const [a] = yield* pick(g, p, 'Add which card from their hand to yours?', theirs, 1, 1, 'bad');
      const [b] = yield* pick(g, o, 'Add which card from their hand to yours?', mine, 1, 1, 'bad');
      const give = (x, to) => { const P = g.p[x.owner]; const i = P.hand.indexOf(x); if (i < 0) return; P.hand.splice(i, 1); x.owner = to; x.ctrl = to; g.p[to].hand.push(x); };
      if (a) give(a, p); if (b) give(b, o); g.seq++;
      log(g, `${PN(g, p)} took ${a ? name(a) : 'nothing'} and ${PN(g, o)} took ${b ? name(b) : 'nothing'}.`); } }] },
  // Ported from classic-4.js.
  'Exile of the Wicked': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(m => faceUp(m) && race(m) === 'Fiend'),
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => faceUp(m) && race(m) === 'Fiend'), { by: p, src: c }); } }] },
  // Taken control lasts while this card is equipped; it is destroyed while you control no "Archfiend" card (checked as a
  // mandatory trigger at the next game event). The 800 damage comes in each of your opponent's Standby Phases.
  'Falling Down': { effs: [
    { type: 'act', cond: (g, c, p) => oppFaceUp(g, p).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!onField(c)) return;
        if (!allField(g).some(x => x.ctrl === p && faceUp(x) && /Archfiend/.test(name(x)))) { destroy(g, [c], { rule: true }); return; }
        if (!t || !faceUp(t) || t.ctrl === p) return; const from = t.ctrl; if (!takeControl(g, p, t, false)) return;
        c.equipTo = t.u; c.flags.f21fall = { u: t.u, from }; log(g, `Falling Down was equipped to ${name(t)}.`);
        if (!allField(g).some(x => x.ctrl === p && faceUp(x) && /Archfiend/.test(name(x)))) destroy(g, [c], { rule: true }); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Destroyed (no Archfiend)',
      on: (g, ev, c) => !!c.equipTo && !allField(g).some(x => x.ctrl === c.ctrl && faceUp(x) && /Archfiend/.test(name(x))),
      res: function* (g, c) { if (onField(c) && !allField(g).some(x => x.ctrl === c.ctrl && faceUp(x) && /Archfiend/.test(name(x)))) destroy(g, [c], { rule: true }); } },
    { type: 'trig', loc: 'st', mand: true, label: '800 damage', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl && !!c.equipTo,
      res: function* (g, c, p) { damage(g, p, 800, { src: c, srcP: p }); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Control returns', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.flags && ev.snap.flags.f21fall,
      res: function* (g, c, p, L2) { const s = L2.ev.snap.flags.f21fall; const t = fieldMons(g).find(x => x.u === s.u); if (t) giveBack(g, t, s.from); } }] },
  // Ported from goat-4.js.
  'Fengsheng Mirror': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length > 0,
    res: function* (g, c, p) { const h = g.p[opp(p)].hand; log(g, `${PN(g, opp(p))}'s hand: ${h.map(name).join(', ') || 'no cards'}.`);
      const sp = h.filter(x => isMon(x) && /Spirit/.test(D(x).ab || '')); if (!sp.length) return;
      const [x] = yield* pick(g, p, 'Discard which Spirit monster?', sp, 1, 1, 'bad'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, opp(p))} discarded ${name(x)}.`); } } }] },
  // The monster is chosen as this card resolves.
  'Fissure': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    res: function* (g, c, p) { const ms = oppFaceUp(g, p); if (!ms.length) return; const lo = Math.min(...ms.map(m => atk(g, m)));
      const tied = ms.filter(m => atk(g, m) === lo); const [x] = tied.length > 1 ? yield* pick(g, p, 'Destroy which monster with the lowest ATK?', tied, 1, 1, 'bad') : tied;
      if (x) destroy(g, [x], { by: p, src: c }); } }] },
  'Follow Wind': { cont: eqBonus(300, 300), effs: [equipAct(m => race(m) === 'Winged Beast', 'Equip to which face-up Winged Beast monster?')] },
  'Forest': { cont: { atk: (g, src, m) => ['Insect', 'Beast', 'Plant', 'Beast-Warrior'].includes(race(m)) ? 200 : 0, def: (g, src, m) => ['Insect', 'Beast', 'Plant', 'Beast-Warrior'].includes(race(m)) ? 200 : 0 },
    effs: [noop] },
  'Frontline Base': { effs: [noop,
    { type: 'ign', loc: 'st', opt: true, tags: { ss: 1 }, label: 'Special Summon a Union monster',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isUnion(x) && lv(x) <= 4),
      res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isUnion(x) && lv(x) <= 4); if (!cs.length || freeM(g, p) < 0) return;
        const [x] = yield* pick(g, p, 'Special Summon which Level 4 or lower Union monster?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },

  /* ----- Traps ----- */
  'Driving Snow': { effs: [trapTrig({ label: 'Destroy a Spell/Trap', tags: { destroy: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.c !== c && ev.destroyed && ev.wasField && ev.to === 'gy' && !ev.battle && isTrap(ev.c) && ev.prevCtrl === c.ctrl && ev.c.owner === c.ctrl && ev.by != null && ev.by !== c.ctrl,
    cond: (g, c) => stOnField(g).some(x => x !== c),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOnField(g).filter(x => x !== c), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } })] },
  // Answers the opponent's normal draw in their Draw Phase.
  'Drop Off': { effs: [trapTrig({ label: 'Discard the card they drew',
    on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && g.phase === 'draw' && g.tp !== c.ctrl && ev.c.owner === opp(c.ctrl),
    res: function* (g, c, p, L2) { const x = L2.ev && L2.ev.c; if (!x || x.zone !== 'hand') return; move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, opp(p))} discarded ${name(x)}.`); } })] },
  'Earthshaker': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { const a = ATTRS[yield* choose(g, p, 'Earthshaker: choose the first Attribute', ATTRS)]; const rest = ATTRS.filter(x => x !== a);
      const b = rest[yield* choose(g, p, 'Earthshaker: choose the second Attribute', rest)]; L2.data.at = [a, b]; log(g, `${PN(g, p)} chose ${a} and ${b}.`); },
    res: function* (g, c, p, L2) { const at = L2.data.at; if (!at) return; const k = yield* choose(g, opp(p), 'Earthshaker: destroy all face-up monsters of which Attribute?', at);
      log(g, `${PN(g, opp(p))} chose ${at[k]}.`); destroy(g, fieldMons(g).filter(m => faceUp(m) && attr(m) === at[k]), { by: p, src: c }); } }] },
  'Eatgaboon': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.sw && g.sw.p !== p && ['normal', 'tribute', 'flip', 'gemini'].includes(g.sw.how) && g.sw.cs.some(x => onField(x) && faceUp(x) && atk(g, x) <= 500),
    target: function* (g, c, p, L2) { L2.data.cs = g.sw.cs.slice(); },
    res: function* (g, c, p, L2) { destroy(g, L2.data.cs.filter(x => onField(x) && faceUp(x) && atk(g, x) <= 500), { by: p, src: c }); } }] },
  // Ported from classic-5.js. PARTIAL: as a monster it has no Type or Attribute (ENGINE: attr()/race() can't be set by a
  // script) and it frees its Spell/Trap Zone.
  'Embodiment of Apophis': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => mainPhase(g) && freeM(g, p) >= 0,
    res: function* (g, c, p) { if (!onField(c) || freeM(g, p) < 0) return; const i = yield* choose(g, p, 'Embodiment of Apophis: which position?', ['Attack Position', 'Defense Position']);
      if (!ss(g, p, c, i ? 'def' : 'atk')) return; c.flags.baseAtk = 1600; c.flags.lv = 4; c.flags.trapMon = true; addMod(g, c, { set: 1800, which: 'def' }); } }] },
  'Enchanted Javelin': { effs: [{ type: 'act', cond: g => !!g.aw && !!g.aw.a && onField(g.aw.a),
    target: function* (g, c, p, L2) { L2.t = [g.aw.a]; },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) gain(g, p, atk(g, t)); } }] },
  // ENGINE: the hand limit of 6 is fixed in the engine's End Phase. PARTIAL: at the start of the opponent's End Phase
  // they discard down to 5.
  'Enervating Mist': { effs: [noop,
    { type: 'trig', loc: 'st', mand: true, label: 'Hand size limit 5', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp !== c.ctrl,
      cond: (g, c, p) => g.p[opp(p)].hand.length > 5,
      res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand; if (h.length <= 5) return; const n = h.length - 5;
        const ds = yield* pick(g, o, `Discard ${n} card${n > 1 ? 's' : ''} (hand limit 5)`, h, n, n, 'cost'); for (const x of ds) move(g, x, 'gy', { reason: 'discard' });
        log(g, `${PN(g, o)} discarded ${ds.map(name).join(', ')} for the hand limit.`); } }] },
  'Exhausting Spell': { effs: [{ type: 'act', cond: g => allField(g).some(x => ctr(x, 'spell') > 0),
    res: function* (g) { for (const x of allField(g)) if (x.ctr && x.ctr.spell) x.ctr.spell = 0; g.seq++; log(g, 'All Spell Counters were removed.'); } }] },
  "Fairy's Hand Mirror": { effs: [mirror(x => x.zone === 'm')] },
  // Each monster sent from the field to the GY costs its owner 500 (counted on the card, dealt in one go per owner).
  'Fatal Abacus': { effs: [noop,
    { type: 'trig', loc: 'st', mand: true, label: '500 damage per monster',
      on: (g, ev, c) => { if (ev.type !== 'move' || ev.from !== 'm' || ev.to !== 'gy' || !ev.wasField) return false; const s = c.flags.f21ab || (c.flags.f21ab = [0, 0]); s[ev.c.owner]++; return true; },
      res: function* (g, c) { const s = c.flags.f21ab || [0, 0]; c.flags.f21ab = [0, 0]; for (const q of [g.tp, opp(g.tp)]) if (s[q]) damage(g, q, 500 * s[q], { src: c, srcP: c.ctrl }); } }] },
  "Fiend's Hand Mirror": { effs: [mirror(x => x.zone === 'st' || x.zone === 'fz')] },
  // PARTIAL: the Union equip goes to a monster named in the Union's own text ("equip it to your ..."), or any monster you
  // control when the text names none.
  'Formation Union': { effs: [{ type: 'act',
    cond: (g, c, p) => fuEquip(g, p).length > 0 || (freeM(g, p) >= 0 && fuUnequip(g, p).length > 0),
    target: function* (g, c, p, L2) { const opts = []; if (fuEquip(g, p).length) opts.push('Equip a Union monster'); if (freeM(g, p) >= 0 && fuUnequip(g, p).length) opts.push('Unequip a Union monster and Special Summon it');
      const k = opts.length > 1 ? yield* choose(g, p, 'Formation Union: which effect?', opts) : 0; L2.data.mode = opts[k].startsWith('Equip') ? 'eq' : 'un'; },
    res: function* (g, c, p, L2) {
      if (L2.data.mode === 'eq') { const us = fuEquip(g, p); if (!us.length || freeST(g, p) < 0) return; const [u] = yield* pick(g, p, 'Equip which Union monster?', us, 1, 1, 'good'); if (!u) return;
        const ts = fuTargets(g, p, u); const [t] = yield* pick(g, p, `Equip ${name(u)} to which monster?`, ts, 1, 1, 'good'); if (!t || freeST(g, p) < 0) return;
        move(g, u, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); u.equipTo = t.u; u.flags.union = true; log(g, `${D(u).n} was equipped to ${name(t)}.`); }
      else { const us = fuUnequip(g, p); if (!us.length || freeM(g, p) < 0) return; const [u] = yield* pick(g, p, 'Unequip which Union monster?', us, 1, 1, 'good'); if (!u) return;
        u.equipTo = null; u.flags.union = false; ss(g, p, u, 'atk'); } } }] },
  'Fruits of Kozaky\'s Studies': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length > 0,
    res: function* (g, c, p) { const dk = g.p[p].deck; const top = dk.splice(Math.max(0, dk.length - 3)); const order = [];
      while (top.length) { const [x] = top.length === 1 ? [top[0]] : yield* pick(g, p, `Which card goes ${order.length ? 'next' : 'on top'}?`, top, 1, 1, 'good'); order.push(x); top.splice(top.indexOf(x), 1); }
      for (const x of order.slice().reverse()) dk.push(x); g.seq++; log(g, `${PN(g, p)} looked at the top ${order.length} cards of the Deck and put them back in any order.`); } }] },
  'Frozen Soul': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp <= g.p[opp(p)].lp - 2000,
    res: function* (g, c, p) { const o = opp(p);
      if (g.tp === o && ['draw', 'standby', 'main1'].includes(g.phase)) g.noBP[o] = true; else (g.f21skip || (g.f21skip = [false, false]))[o] = true;
      log(g, `${PN(g, o)} skips their next Battle Phase.`); } },
    { type: 'trig', loc: 'any', res: noopG, on: (g, ev) => { if (ev.type === 'phase' && ev.ph === 'standby' && g.f21skip && g.f21skip[ev.tp]) { g.f21skip[ev.tp] = false; g.noBP[ev.tp] = true; } return false; } }] },
  'Fuh-Rin-Ka-Zan': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => ['WIND', 'WATER', 'FIRE', 'EARTH'].every(a => fieldMons(g).some(m => faceUp(m) && attr(m) === a)) && fuhOpts(g, c, p).length > 0,
    target: function* (g, c, p, L2) { const os = fuhOpts(g, c, p); const k = os.length > 1 ? yield* choose(g, p, 'Fuh-Rin-Ka-Zan: apply which effect?', os) : 0; L2.data.k = os[k]; },
    res: function* (g, c, p, L2) { const o = opp(p), k = L2.data.k;
      if (k === FUH[0]) destroy(g, monsOf(g, o), { by: p, src: c });
      else if (k === FUH[1]) destroy(g, stOf(g, o), { by: p, src: c });
      else if (k === FUH[2]) { for (let i = 0; i < 2 && g.p[o].hand.length; i++) { const h = g.p[o].hand; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, o)} discarded ${name(x)} at random.`); } }
      else if (k === FUH[3]) draw(g, p, 2); } }] },
});
const FUH = ['Destroy all monsters your opponent controls', 'Destroy all Spells and Traps your opponent controls', 'Discard 2 random cards from their hand', 'Draw 2 cards'];
function fuhOpts(g, c, p) { const o = opp(p); const out = [];
  if (monsOf(g, o).length) out.push(FUH[0]); if (stOf(g, o).length) out.push(FUH[1]); if (g.p[o].hand.length) out.push(FUH[2]); if (g.p[p].deck.length >= 2) out.push(FUH[3]); return out; }
// Formation Union helpers
function fuTargets(g, p, u) { const m = (D(u).tx || '').match(/equip it to (?:your |a |an |1 )?"([^"]+)"(?: or "([^"]+)")?/i); const ns = m ? [m[1], m[2]].filter(Boolean) : null;
  return monsOf(g, p).filter(x => x !== u && faceUp(x) && !hasUnion(g, x) && (!ns || ns.includes(name(x)))); }
const fuEquip = (g, p) => freeST(g, p) < 0 ? [] : monsOf(g, p).filter(u => faceUp(u) && isUnion(u) && fuTargets(g, p, u).length > 0);
const fuUnequip = (g, p) => stOf(g, p).filter(x => x.zone === 'st' && isUnion(x) && x.equipTo && x.flags.union);
})();
