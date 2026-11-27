/* Full pool batch 37: Darklord Nurse Reficule to Escape from the Dark Dimension (build/batches/full/full-37.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, takeControl, negate, addMod,
  negateAttack, addRule, ritualSummon, canRitual, addCtr, ctr, name, D, isMon, isST, isSpell, isTrap, isExtraD, onField, faceUp,
  attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, allCards, shuffleDeck, log, PN, has, live,
  opp, oppFaceUp, stOnField, spellTrapAct, evSummoned, fromFieldToGY, forbid, stat, negd, num, winDuel } = L;
const atk = L.atk;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const ctrlOf = c => onField(c) ? c.ctrl : c.owner;
const canSS = (g, p, x) => isMon(x) && !isExtraD(D(x)) && D(x).k !== 'ritual' && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
function toBottom(g, x) { move(g, x, 'deckTop', { reason: 'effect' }); const d = g.p[x.owner].deck; const i = d.indexOf(x); if (i >= 0) { d.splice(i, 1); d.unshift(x); } }
const flip = (label, more) => ({ type: 'trig', mand: true, faceDownOk: true, label, on: (g, ev, c) => ev.type === 'flip' && ev.c === c, ...more });
const ritualSpell = (pred, exact) => ({ effs: [{ type: 'act', tags: { ss: 1 },
  cond: (g, c, p) => canRitual(g, p, { monster: pred, exact }),
  res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: pred, exact }); } }] });
// "by an effect of a card controlled by your opponent" (same as full-26.js): the move's own `by` when given, else the turn player.
const byOpp = (g, ev, c) => ev.by != null ? ev.by !== c.owner : g.tp !== c.owner;
// Countdown on a face-up Spell/Trap: counts the controller's (mine) or the opponent's (!mine) phases of one kind after activation.
const countdown = (ph, mine, n, label, how = 'destroy') => ({ type: 'trig', loc: 'st', mand: true, label,
  on: (g, ev, c) => { if (ev.type !== 'phase' || ev.ph !== ph || c.flags.f37cd == null) return false;
    if ((ev.tp === c.ctrl) !== mine) return false; c.flags.f37cd++; return c.flags.f37cd >= n; },
  res: function* (g, c, p) { if (!onField(c)) return; if (how === 'destroy') destroy(g, [c], { rule: true }); else { move(g, c, 'gy', { reason: 'rule' }); log(g, `${name(c)} was sent to the GY.`); } } });
const startCount = c => { c.flags.f37cd = 0; };

/* A Trap that answers a moment with no response window in the engine (same as full-26.js): a trigger that only fires while
 the card is Set (and wasn't Set this turn). It flips the card face-up, counts as a Trap Card activation, and sends the
 card to the GY after it resolves. */
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = o.speed || 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });

/* Summon locks: one duel-long rule, installed by the first event any of these cards sees.
 ENGINE: no general "can't be Special Summoned" flag; these locks stand in for it. */
const proper = a => ['gy', 'ban'].includes(a.c.zone) && a.c.f37proper;
const LOCKS = {
  'Diabolos, King of the Abyss': () => true,
  // "cannot be Special Summoned by other ways": only its own rule from the hand. PARTIAL: an effect that Special Summons it from the hand is not stopped.
  'Doom Dozer': (g, a) => a.c.zone !== 'hand',
  // must first be Special Summoned from the hand by its own rule; once properly summoned it can be revived
  "Enishi, Shien's Chancellor": (g, a) => !(a.c.zone === 'hand' || proper(a)),
  // only with Assault Mode Activate (face-up while it resolves); revivable once properly summoned
  'Doomkaiser Dragon Assault Mode': (g, a) => !((['hand', 'deck'].includes(a.c.zone) && stOf(g, a.p).some(x => faceUp(x) && named(x, 'Assault Mode Activate'))) || proper(a)),
};
const lockEff = { type: 'trig', loc: 'any', res: noop, on: (g, ev) => {
  if (!g.f37lock) { g.f37lock = true; addRule(g, (g2, a) => {
    // Diabolos: no Normal Summon or Set without 2 DARK monsters to Tribute (the engine's Tribute pick can't be limited to DARK)
    if ((a.type === 'ns' || a.type === 'set') && a.c && a.c.id != null && D(a.c).n === 'Diabolos, King of the Abyss')
      return monsOf(g2, a.p).filter(m => attr(m) === 'DARK' && !m.flags.noTribute).length < 2;
    if (a.type !== 'ss' || !a.c || a.c.id == null) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); }
  if (ev.type === 'summon') for (const x of ev.cs) if (x) x.f37proper = true;
  return false; } };

/* Union monsters (same as full-02.js): once per turn equip to a monster you control, or unequip and Special Summon in Attack
 Position; a monster has at most 1 Union; "if the equipped monster would be destroyed by battle, destroy this card instead". */
const glassOn = g => !!(g.full02 && g.full02.glass === g.turnNo);
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
      cond: (g, c, p) => c.used.union !== g.turnNo && !!c.equipTo && !!c.flags.union && freeM(g, p) >= 0 && !glassOn(g),
      after: (g, c) => { c.used.union = g.turnNo; },
      res: function* (g, c, p) { if (c.zone !== 'st' || !c.equipTo) return; c.equipTo = null; c.flags.union = false; ss(g, p, c, 'atk'); } }];
}
const unionCont = { replaceDestroy: (g, src, m, o) => {
  if (!o.battle || src.zone !== 'st' || src.equipTo !== m.u || !src.flags.union || glassOn(g)) return false;
  move(g, src, 'gy', { reason: 'battle', destroyed: true, by: o.by }); log(g, `${D(src).n} was destroyed instead of ${name(m)}.`); return true; } };

// Eccentric Boy: a Synchro Monster whose recipe is any "1 Tuner + 1 or more non-Tuners"
const plainRecipe = sx => /^(①\s*)?1 Tuner \+ (1\+|1 or more) non-Tuners?( monsters?)?\s*$/i.test(((D(sx).ps || D(sx).tx || '').split('\n')[0] || '').trim());
function boyOpts(g, c, p) {
  if (c.zone !== 'm' || !faceUp(c)) return [];
  const out = [];
  for (const h of g.p[p].hand) {
    if (!isMon(h) || D(h).tu || isExtraD(D(h)) || D(h).k === 'token') continue;
    for (const sx of g.p[p].extra) if (D(sx).k === 'synchro' && num(D(sx).lv) === lv(c) + lv(h) && plainRecipe(sx) && !forbid(g, { type: 'ss', c: sx, p, how: 'synchro' })) out.push([sx, h]);
  }
  return out;
}
const boyUsed = (g, c, grp) => g.events.some(e => e.group === grp && e.type === 'move' && e.c === c && e.reason === 'synchro');

// Doom Shaman, Doomkaiser Dragon Assault Mode: monsters this card Special Summoned
const summonedBy = (g, k, u) => fieldMons(g).filter(m => m.flags[k] === u);

// Charmer control (same as full-19.js): control goes back at the next game event after the Charmer leaves the field, is turned
// face-down, or the monster loses the Attribute.
const charmer = (A) => ({ effs: [
  flip(`Take control of a ${A} monster`, {
    target: function* (g, c, p, L2) { const cs = monsOf(g, opp(p)).filter(m => faceUp(m) && attr(m) === A); if (cs.length) yield* tgt(g, p, L2, `Take control of which ${A} monster?`, cs, 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || attr(t) !== A || t.ctrl === p || !onField(c) || !faceUp(c)) return;
      const from = t.ctrl; if (takeControl(g, p, t, false)) { t.flags.f37charm = c.u; t.flags.f37charmFrom = from; } } }),
  { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
    if (g.f37charmBusy) return false;
    for (const m of fieldMons(g)) {
      if (m.flags.f37charm !== c.u) continue;
      if (onField(c) && faceUp(c) && faceUp(m) && attr(m) === A) continue;
      const back = m.flags.f37charmFrom; m.flags.f37charm = null; g.f37charmBusy = true;
      try { if (m.ctrl !== back) { if (freeM(g, back) >= 0) { takeControl(g, back, m, false); log(g, `${name(m)} returned to ${PN(g, back)}.`); } else move(g, m, 'gy', { reason: 'rule' }); } }
      finally { g.f37charmBusy = false; }
    }
    return false; } }] });

// Defense Draw: would player p take battle damage from the current battle?
function takesDamage(g, p) {
  const b = g.battle; if (!b || !b.a || !onField(b.a) || b.a.ctrl === p) return false;
  const A = stat(g, b.a, 'atk'), t = b.t;
  if (!t) return A > 0;
  if (!onField(t) || t.ctrl !== p) return false;
  if (t.pos === 'atk') return A > stat(g, t, 'atk');
  return A > stat(g, t, 'def') && has(g, b.a, 'piercing');
}
// A battle worked out in the card (as full-03.js battleInstead): the engine's attack() keeps its target local.
// ENGINE: attack redirect. PARTIAL: no Damage Step windows in this battle. Both monsters must be face-up.
function cardBattle(g, a, t) {
  if (!a || !t || a.zone !== 'm' || t.zone !== 'm' || !faceUp(a) || !faceUp(t)) return;
  log(g, `${name(a)} battles ${name(t)}.`);
  const A = stat(g, a, 'atk'), ac = a.ctrl, tc = t.ctrl;
  const noDmg = q => [a, t].some(x => x.ctrl === q && faceUp(x) && has(g, x, 'noBattleDamage')) || g.p[q].noBattleDamage === g.turnNo;
  if (t.pos === 'atk') {
    const T = stat(g, t, 'atk');
    if (A > T) { if (!noDmg(tc)) damage(g, tc, A - T, { battle: true, src: a, srcP: ac }); destroy(g, [t], { battle: true, killer: a }); }
    else if (A < T) { if (!noDmg(ac)) damage(g, ac, T - A, { battle: true, src: t, srcP: tc }); destroy(g, [a], { battle: true, killer: t }); }
    else if (A > 0 || T === 0) destroy(g, [a, t], { battle: true });
  } else {
    const Dv = stat(g, t, 'def');
    if (A > Dv) { if (has(g, a, 'piercing') && !noDmg(tc)) damage(g, tc, A - Dv, { battle: true, src: a, srcP: ac }); destroy(g, [t], { battle: true, killer: a }); }
    else if (A < Dv && !noDmg(ac)) damage(g, ac, Dv - A, { battle: true, src: t, srcP: tc });
  }
}
const ATTRS = ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND'];
const isGB = x => /^Gladiator Beast/.test(name(x));

E.addScripts({
  /* ----- Dark ----- */
  // ENGINE: gain() has no hook. PARTIAL (as full-19.js Bad Reaction to Simochi): while this card is face-up, an LP gain of the
  // opponent is seen at the next game event, undone, and dealt as damage.
  'Darklord Nurse Reficule': { effs: [{ type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
    if (c.zone !== 'm' || !faceUp(c)) { c.flags.f37lp = null; return false; }
    const o = opp(c.ctrl), P = g.p[o], was = c.flags.f37lp; c.flags.f37lp = { o, lp: P.lp };
    if (!was || was.o !== o || P.lp <= was.lp || g.f37nurse) return false;
    const d = P.lp - was.lp; g.f37nurse = true;
    try { P.lp -= d; log(g, `Darklord Nurse Reficule turned ${PN(g, o)}'s ${d} LP gain into damage.`); damage(g, o, d, { src: c, srcP: c.ctrl }); }
    finally { g.f37nurse = false; c.flags.f37lp = { o, lp: P.lp }; }
    return false; } }] },
  // "If" (no missed timing); it activates even if this card was also destroyed in that battle.
  'Darknight Parshath': { self: { atk: (g, c) => 100 * g.p[c.ctrl].gy.filter(x => isMon(x) && attr(x) === 'DARK').length },
    effs: [{ type: 'trig', loc: 'any', label: 'Banish a DARK: draw 1 card',
      on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && !!ev.snap && ev.snap.ctrl !== ctrlOf(c),
      cond: (g, c, p) => g.p[p].deck.length > 0 && g.p[p].gy.some(x => isMon(x) && attr(x) === 'DARK'),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish a DARK monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK'), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${name(x)}.`); } },
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  'Darksea Float': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Owner draws 1 card',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !ev.battle && ev.to === 'gy',
    res: function* (g, c) { draw(g, c.owner, 1); } }] },
  // Only when the Synchro Summon it was used for was not negated (the summon happened in the same group).
  'Darksea Rescue': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Owner draws 1 card',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.reason === 'synchro' && ev.to === 'gy',
    cond: (g, c, p, x) => g.events.some(e => e.type === 'summon' && e.how === 'synchro' && e.group === x.ev.group),
    res: function* (g, c) { draw(g, c.owner, 1); } }] },
  // Gemini: while Gemini Summoned, its original DEF is 2300.
  'Dawnbreak Gardna': { self: { def: (g, c) => c.flags.gemini ? 2300 - num(D(c).def) : 0 }, effs: [] },
  // ENGINE: "add from the Deck" is only stopped for search(); a script that moves a Deck card to the hand directly isn't.
  // PARTIAL: the destruction in the 2nd Standby Phase is a chain link of its own (the ruling says no chain).
  'Deck Lockdown': { cont: { forbid: (g, src, a) => a.type === 'search' || (a.type === 'ss' && !!a.c && a.c.zone === 'deck') },
    effs: [{ type: 'act', res: function* (g, c) { startCount(c); log(g, 'Neither player can add cards from the Deck to the hand or Special Summon from the Deck.'); } },
      countdown('standby', true, 2, 'Destroy Deck Lockdown')] },
  // The declared attack is negated and the attacker battles the summoned Dragon here (see cardBattle).
  'Decoy Dragon': { effs: [{ type: 'trig', mand: true, tags: { ss: 1 }, label: 'Special Summon a Level 7+ Dragon',
    on: (g, ev, c) => ev.type === 'attack' && ev.t === c && ev.p !== c.ctrl,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && race(x) === 'Dragon' && lv(x) >= 7 && canSS(g, p, x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Level 7 or higher Dragon?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Dragon' && lv(x) >= 7 && canSS(g, p, x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy' || !ss(g, p, t, 'atk')) return; const a = L2.ev.a;
      if (a && onField(a) && a.ctrl !== p) { negateAttack(g); log(g, `The attack target changed to ${name(t)}.`); cardBattle(g, a, t); } } }] },
  'Decoyroid': { cont: { grant: (g, src, c, flag) => flag === 'noAttackTarget' && c.ctrl === src.ctrl && c !== src && faceUp(c) && name(c) !== 'Decoyroid' } },
  'Deep Diver': { effs: [
    { type: 'trig', loc: 'gy', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy') c.f37dd = g.turnNo; return false; } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Put a monster from your Deck on top',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'bpEnd' && c.f37dd === g.turnNo,
      cond: (g, c, p) => g.p[p].deck.some(isMon),
      res: function* (g, c, p) { c.f37dd = null; const xs = g.p[p].deck.filter(isMon); if (!xs.length) return; const [x] = yield* pick(g, p, 'Place which monster on top of your Deck?', xs, 1, 1, 'good');
        shuffleDeck(g, p); if (x) { const d = g.p[p].deck; d.splice(d.indexOf(x), 1); d.push(x); log(g, `${PN(g, p)} placed a monster on top of the Deck.`); } } }] },
  // PARTIAL: the replacement is used automatically (no prompt), once per turn, for each Spellcaster in one destruction while
  // your Spell Counters last.
  'Defender, the Magical Knight': {
    cont: { replaceDestroy: (g, src, m, o) => {
      if (o.rule || !onField(m) || m.zone !== 'm' || !faceUp(m) || race(m) !== 'Spellcaster') return false;
      const r = src.f37def; if (r && r.turn === g.turnNo && r.group !== g.group) return false;
      const x = fieldOf(g, src.ctrl).find(y => ctr(y, 'spell') > 0); if (!x) return false;
      addCtr(g, x, 'spell', -1); src.f37def = { turn: g.turnNo, group: g.group };
      log(g, `${PN(g, src.ctrl)} removed a Spell Counter instead of ${name(m)} being destroyed.`); return true; } },
    effs: [{ type: 'trig', mand: true, label: 'Place a Spell Counter', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
      res: function* (g, c) { if (onField(c) && faceUp(c) && ctr(c, 'spell') < 1) { addCtr(g, c, 'spell', 1); log(g, `A Spell Counter was placed on ${name(c)}.`); } } }] },
  // ENGINE: no window at damage calculation; it is activated in the Damage Step windows before it.
  'Defense Draw': { cont: { loc: 'gy', dmg: (g, src, p, n, o) => { const r = g.f37ddraw; return o.battle && r && r.p === p && r.turn === g.turnNo && g.battle && g.battle.a && g.battle.a.u === r.a ? 0 : undefined; } },
    effs: [{ type: 'act', ds: true,
      cond: (g, c, p) => g.tp !== p && g.inDS && g.p[p].deck.length > 0 && takesDamage(g, p),
      res: function* (g, c, p) { if (!g.battle || !g.battle.a) return; g.f37ddraw = { p, a: g.battle.a.u, turn: g.turnNo }; log(g, `${PN(g, p)} takes no battle damage from this battle.`); draw(g, p, 1); } }] },
  // PARTIAL: a monster turned face-down this turn loses the protection.
  'Defensive Tactics': { effs: [
    { type: 'act', cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && isGB(m)),
      res: function* (g, c, p) { g.p[p].noBattleDamage = g.turnNo; const us = monsOf(g, p).map(m => { m.flags.noBattleDestroy = true; return m.u; });
        g.f37dt = { p, turn: g.turnNo, us }; log(g, `${PN(g, p)}'s monsters can't be destroyed by battle this turn, and ${PN(g, p)} takes no battle damage.`);
        if (onField(c)) { toBottom(g, c); log(g, 'Defensive Tactics was put on the bottom of the Deck.'); } } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => {
      const r = g.f37dt; if (!r) return false;
      if (r.turn !== g.turnNo) { for (const m of fieldMons(g)) if (r.us.includes(m.u)) m.flags.noBattleDestroy = false; g.f37dt = null; return false; }
      if (ev.type === 'summon' && ev.p === r.p) for (const m of ev.cs) if (m && onField(m) && m.ctrl === r.p) { m.flags.noBattleDestroy = true; r.us.push(m.u); }
      return false; } }] },
  // PARTIAL: if the controller can't pay 500, the card is destroyed. ENGINE: no banish-instead hook in move(), so a monster
  // returned to the hand is banished right after it arrives (a chain link).
  'Degenerate Circuit': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Pay 500 LP', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 500) pay(g, p, 500); else destroy(g, [c], { rule: true }); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Banish the returned monster',
      on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.to === 'hand' && isMon(ev.c),
      res: function* (g, c, p, L2) { const x = L2.ev.c; if (x.zone === 'hand') { move(g, x, 'ban', { reason: 'effect', by: p }); log(g, `${name(x)} was banished instead.`); } } }] },
  'Demise of the Land': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.sw && g.sw.p !== p && !['normal', 'tribute', 'flip', 'gemini'].includes(g.sw.how) && g.p[p].deck.some(x => isSpell(x) && D(x).sub === 'Field'),
    res: function* (g, c, p) {
      const xs = g.p[p].deck.filter(x => isSpell(x) && D(x).sub === 'Field'); if (!xs.length) return;
      const [x] = yield* pick(g, p, 'Activate which Field Spell from your Deck?', xs, 1, 1, 'good'); shuffleDeck(g, p); if (!x) return;
      if (g.p[p].fz) move(g, g.p[p].fz, 'gy', { reason: 'rule' });
      move(g, x, 'fz', { ctrl: p, pos: 'up', reason: 'activate' }); log(g, `${PN(g, p)} activated ${name(x)} from the Deck.`);
      const o = g.p[opp(p)].fz; if (o && o.pos !== 'set') destroy(g, [o], { rule: true });
      const a = L.effsOf(x).find(e => e.type === 'act');
      if (a && a.res) { const L2 = { c: x, eff: a, p, t: [], data: {}, tags: a.tags || {}, cardAct: true }; if (!a.cond || a.cond(g, x, p, {})) { if (a.target) yield* a.target(g, x, p, L2); yield* a.res(g, x, p, L2); } } } }] },
  'Demise, King of Armageddon': { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Pay 2000: destroy all other cards',
    cond: (g, c, p) => g.p[p].lp > 2000 && allField(g).some(x => x !== c),
    cost: function* (g, c, p) { pay(g, p, 2000); },
    res: function* (g, c, p) { destroy(g, allField(g).filter(x => x !== c), { by: p, src: c }); } }] },
  // Discarding is part of the effect, once per attack declaration. Destroyed in the opponent's 3rd End Phase after activation.
  'Depth Amulet': { effs: [
    { type: 'act', res: function* (g, c, p) { startCount(c); if (g.aw && g.aw.a && g.aw.a.ctrl !== p && g.p[p].hand.length && c.flags.f37amSeq !== g.aw.group && (yield* yn(g, p, 'Discard 1 card to negate the attack?'))) {
      c.flags.f37amSeq = g.aw.group; const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); negateAttack(g); } } } },
    { type: 'trig', loc: 'st', when: true, label: 'Discard 1 card to negate the attack',
      on: (g, ev, c) => ev.type === 'attack' && ev.p !== c.ctrl,
      cond: (g, c, p, x) => g.p[p].hand.length > 0 && c.flags.f37amSeq !== x.ev.group,
      res: function* (g, c, p, L2) { if (!onField(c) || !g.p[p].hand.length) return; c.flags.f37amSeq = L2.ev.group; const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand, 1, 1, 'cost');
        if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); if (g.aw) negateAttack(g); } } },
    countdown('end', false, 3, 'Destroy Depth Amulet')] },
  // Its Level is lowered by 1 (a flag the engine reads), DEF 0, effects negated, and it can't change position. All of it ends
  // when the monster is turned face-down or leaves the field (its flags and modifiers are cleared).
  'Descending Lost Star': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => D(x).k === 'synchro' && !forbid(g, { type: 'ss', c: x, p, how: 'special' })),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Synchro Monster?', g.p[p].gy.filter(x => D(x).k === 'synchro' && !forbid(g, { type: 'ss', c: x, p, how: 'special' })), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy') return; const L0 = num(D(t).lv);
      if (!ss(g, p, t, 'def', { negate: true })) return; t.flags.lv = Math.max(1, L0 - 1); t.flags.f37dls = true; addMod(g, t, { set: 0, which: 'def' });
      if (!g.f37dlsRule) { g.f37dlsRule = true; addRule(g, (g2, a) => a.type === 'pos' && !!a.c && !!a.c.flags && !!a.c.flags.f37dls); } } }] },
  'Destroyersaurus': { effs: [{ type: 'ign', loc: 'hand', label: 'Discard: add Jurassic World',
    cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'Jurassic World')),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded Destroyersaurus.`); },
    res: function* (g, c, p) { yield* search(g, p, x => named(x, 'Jurassic World'), 'Add Jurassic World'); } }] },
  'Destruct Potion': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => monsOf(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which of your monsters?', monsOf(g, p), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; const A = faceUp(t) ? stat(g, t, 'atk') : 0; if (destroy(g, [t], { by: p, src: c }).length) gain(g, p, A); } }] },
  // PARTIAL: the 3000 damage when it leaves the field is a chain link (the ruling says no chain).
  'Destructive Draw': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Draw 1 more card',
      on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && ev.to === 'hand' && g.phase === 'draw' && ev.c.owner === g.tp && g.p[g.tp].hand.length === 1 && c.flags.f37ddr !== g.turnNo && (c.flags.f37ddr = g.turnNo, true),
      res: function* (g, c, p, L2) { const q = L2.ev.c.owner; if (g.p[q].deck.length && (yield* yn(g, q, 'Destructive Draw: draw 1 more card?'))) draw(g, q, 1); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Lose 700 LP', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; const n = Math.min(700, g.p[p].lp); g.p[p].lp -= n; log(g, `${PN(g, p)} lost ${n} LP.`); if (g.p[p].lp <= 0) { g.p[p].lp = 0; winDuel(g, opp(p), `${PN(g, p)} hit 0 LP`); } } },
    { type: 'trig', loc: 'any', mand: true, label: '3000 damage to its controller',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && !!ev.snap && ev.snap.faceUp,
      res: function* (g, c, p, L2) { damage(g, L2.ev.prevCtrl, 3000, { src: c, srcP: L2.ev.prevCtrl }); } }] },
  'Destructotron': { effs: [
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy itself', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end',
      cond: (g, c, p) => monsOf(g, p).filter(m => faceUp(m) && race(m) === 'Psychic').length === 1,
      res: function* (g, c, p) { if (onField(c) && monsOf(g, p).filter(m => faceUp(m) && race(m) === 'Psychic').length === 1) destroy(g, [c], { by: p }); } },
    { type: 'ign', tags: { destroy: 1 }, label: 'Pay 1000: destroy a Set Spell/Trap',
      cond: (g, c, p) => g.p[p].lp > 1000 && stOf(g, opp(p)).some(x => x.pos === 'set'),
      cost: function* (g, c, p) { pay(g, p, 1000); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Set Spell/Trap?', stOf(g, opp(p)).filter(x => x.pos === 'set'), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2).filter(x => x.pos === 'set'), { by: p }); } }] },
  'Detonate': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && /^Kuriboh( Token)?$/.test(name(m))) && fieldOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { const ks = monsOf(g, p).filter(m => faceUp(m) && /^Kuriboh( Token)?$/.test(name(m))); const n = destroy(g, ks, { by: p, src: c }).length;
      const xs = fieldOf(g, opp(p)); if (!n || !xs.length) return; const ts = yield* pick(g, p, `Destroy up to ${n} of your opponent's cards`, xs, 1, n, 'bad'); destroy(g, ts, { by: p, src: c }); } }] },
  'Detonator Circle A': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(m => faceUp(m) && ctr(m, 'A') > 0),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster with an A-Counter?', fieldMons(g).filter(m => faceUp(m) && ctr(m, 'A') > 0), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || ctr(t, 'A') < 1) return; if (destroy(g, [t], { by: p, src: c }).length) { damage(g, opp(p), 1000, { src: c, srcP: p }); damage(g, p, 1000, { src: c, srcP: p }); } } }] },
  'Dharc the Dark Charmer': charmer('DARK'),
  // ENGINE: no per-summon Tribute check: it needs 2 DARK monsters to be offered, but the Tribute pick itself isn't limited to DARK; no hook for "can't be Tributed by card
  // effects". PARTIAL: the engine has no window before the normal draw, so the look happens at the end of your own turn
  // (the same top card the opponent draws next), once per turn.
  'Diabolos, King of the Abyss': { effs: [lockEff,
    { type: 'trig', opt: true, label: 'Look at the top card of their Deck',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      cond: (g, c, p) => g.p[opp(p)].deck.length > 0,
      res: function* (g, c, p) { const d = g.p[opp(p)].deck; if (!d.length) return; const x = d[d.length - 1];
        const i = yield* choose(g, p, `The top card of their Deck is ${name(x)}.`, ['Keep it on top', 'Put it on the bottom']);
        if (i === 1) { d.pop(); d.unshift(x); } log(g, `${PN(g, p)} looked at the top card of ${PN(g, opp(p))}'s Deck and put it on the ${i === 1 ? 'bottom' : 'top'}.`); } }] },
  'Diamond-Dust Cyclone': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => g.p[p].deck.length > 0 && fieldMons(g).some(m => ctr(m, 'fog') >= 4),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster with 4 or more Fog Counters?', fieldMons(g).filter(m => ctr(m, 'fog') >= 4), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; const n = faceUp(t) ? ctr(t, 'fog') : 0; if (destroy(g, [t], { by: p, src: c }).length && n >= 4) draw(g, p, Math.floor(n / 4)); } }] },
  // ENGINE: no response window after a banish, so it is an optional trigger while Set.
  'Dimensional Inversion': { effs: [trapTrig({ label: 'Special Summon your banished monster', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.to === 'ban' && isMon(ev.c) && ev.c.owner === c.ctrl && ev.reason === 'effect' && byOpp(g, ev, c),
    cond: (g, c, p, x) => freeM(g, p) >= 0 && g.events.some(e => e.group === x.ev.group && e.type === 'move' && e.to === 'ban' && e.c.owner === p && e.c.zone === 'ban' && isMon(e.c)),
    target: function* (g, c, p, L2) { const xs = [...new Set(g.events.filter(e => e.group === L2.ev.group && e.type === 'move' && e.to === 'ban' && e.c.owner === p && e.c.zone === 'ban' && isMon(e.c)).map(e => e.c))];
      yield* tgt(g, p, L2, 'Special Summon which banished monster?', xs, 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'ban') ss(g, p, t, 'atk'); } })] },
  // The "Gladiator Beast" card is shuffled in at resolution (not a cost).
  'Disarm': { effs: [{ type: 'act', cond: (g, c, p, x) => spellTrapAct(x.top) && isSpell(x.top.c) && g.p[p].hand.some(h => /Gladiator Beast/.test(D(h).n)),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const gb = g.p[p].hand.filter(h => /Gladiator Beast/.test(D(h).n)); if (!gb.length) return;
      const [x] = yield* pick(g, p, 'Shuffle which Gladiator Beast card into the Deck?', gb, 1, 1, 'cost'); if (!x) return; log(g, `${PN(g, p)} revealed ${name(x)}.`); move(g, x, 'deck', { reason: 'effect' });
      L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  'Disciple of the Forbidden Spell': { effs: [
    { type: 'trig', mand: true, label: 'Declare Attributes', on: (g, ev, c) => evSummoned(ev, c),
      res: function* (g, c, p) { if (!onField(c)) return; const n = Math.min(ATTRS.length, g.p[p].gy.filter(x => named(x, 'Disciple of the Forbidden Spell')).length); const got = [];
        for (let i = 0; i < n; i++) { const left = ATTRS.filter(a => !got.includes(a)); const k = yield* choose(g, p, `Declare an Attribute (${i + 1} of ${n})`, left); got.push(left[k]); }
        c.flags.f37attrs = got; if (got.length) log(g, `${PN(g, p)} declared ${got.join(', ')}.`); } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the attacked monster',
      on: (g, ev, c) => ev.type === 'dsStart' && ev.a === c && !!ev.t && faceUp(ev.t) && (c.flags.f37attrs || []).includes(attr(ev.t)),
      res: function* (g, c, p, L2) { const t = L2.ev.t; if (t && onField(t) && faceUp(t)) destroy(g, [t], { by: p }); } }] },
  // PARTIAL: sending it to the GY in the 3rd End Phase is a chain link (the ruling says no chain).
  'Discord': { cont: { forbid: (g, src, a) => a.type === 'ss' && a.how === 'synchro' },
    effs: [{ type: 'act', res: function* (g, c) { startCount(c); log(g, 'Neither player can Synchro Summon.'); } }, countdown('end', true, 3, 'Send Discord to the GY', 'gy')] },
  'Disenchanter': { effs: [{ type: 'ign', opt: true, label: 'Remove a Spell Counter: return a Spell',
    cond: g => stOnField(g).some(x => faceUp(x) && isSpell(x)) && allField(g).some(x => ctr(x, 'spell') > 0),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which face-up Spell to the hand?', stOnField(g).filter(x => faceUp(x) && isSpell(x)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const xs = allField(g).filter(x => ctr(x, 'spell') > 0); if (!xs.length) return; const [y] = yield* pick(g, p, 'Remove a Spell Counter from which card?', xs, 1, 1, 'cost');
      addCtr(g, y, 'spell', -1); log(g, `${PN(g, p)} removed a Spell Counter from ${name(y)}.`); const t = live(L2)[0]; if (t && faceUp(t)) { move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${D(t).n} returned to the hand.`); } } }] },
  // The 500 ATK lasts until the end of the opponent's next turn (removed at the start of your next turn).
  'Diskblade Rider': { effs: [
    { type: 'ign', opt: true, label: 'Banish a Normal Trap: +500 ATK',
      cond: (g, c, p) => g.p[p].gy.some(x => isTrap(x) && D(x).sub === 'Normal'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which Normal Trap from your GY?', g.p[p].gy.filter(x => isTrap(x) && D(x).sub === 'Normal'), 1, 1, 'cost'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy') return; move(g, t, 'ban', { reason: 'effect' }); log(g, `${D(t).n} was banished.`);
        if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500, f37disk: true }); log(g, `${name(c)} gained 500 ATK.`); } } },
    { type: 'trig', res: noop, on: (g, ev, c) => { if (c.mods.some(m => m.f37disk && g.turnNo >= m.turn + 2)) c.mods = c.mods.filter(m => !(m.f37disk && g.turnNo >= m.turn + 2)); return false; } }] },
  'Doctor Cranium': { effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Pay 800: add a Psychic',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => g.p[p].lp > 800 && g.p[p].deck.some(x => isMon(x) && race(x) === 'Psychic'),
    cost: function* (g, c, p) { pay(g, p, 800); },
    res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && race(x) === 'Psychic', 'Add a Psychic monster'); } }] },
  'Doitsu': { cont: { ...unionCont, atk: (g, src, m) => src.zone === 'st' && src.flags.union && src.equipTo === m.u ? 2500 : 0 },
    effs: unionEffs(x => name(x) === 'Soitsu', 'Equip Doitsu to which Soitsu?') },
  'Domino Effect': { effs: [actNoop,
    { type: 'trig', loc: 'st', when: true, tags: { destroy: 1 }, label: 'Send a monster: destroy a monster',
      on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && !!ev.snap && ev.snap.ctrl !== c.ctrl,
      cond: (g, c, p) => monsOf(g, p).length > 0 && monsOf(g, opp(p)).length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which of your monsters to the GY?', monsOf(g, p), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { if (onField(c)) destroy(g, live(L2), { by: p, src: c }); } }] },
  'Doom Dozer': {
    proc: { label: 'Special Summon (banish 2 Insects)', cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && race(x) === 'Insect').length >= 2,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Banish 2 Insect monsters from your GY', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Insect'), 2, 2, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${xs.map(name).join(' and ')}.`); } },
    effs: [lockEff, { type: 'trig', mand: true, label: 'Send their top card to the GY',
      on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
      res: function* (g, c, p) { L.mill(g, opp(p), 1); } }] },
  // PARTIAL: destroying its Fiends when it leaves the field is a chain link (the ruling says no chain).
  'Doom Shaman': { effs: [
    { type: 'ign', gemini: true, opt: true, tags: { ss: 1 }, label: 'Special Summon a Fiend',
      cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...allCards(g, 'gy')].some(x => race(x) === 'Fiend' && canSS(g, p, x)),
      res: function* (g, c, p) { const xs = [...g.p[p].hand, ...allCards(g, 'gy')].filter(x => race(x) === 'Fiend' && canSS(g, p, x)); if (!xs.length || freeM(g, p) < 0) return;
        const [x] = yield* pick(g, p, 'Special Summon which Fiend from your hand or either GY?', xs, 1, 1, 'good'); if (x && ss(g, p, x, 'atk') && onField(c)) x.flags.f37shaman = c.u; } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the Fiends it summoned',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && summonedBy(g, 'f37shaman', c.u).length > 0,
      res: function* (g, c, p) { destroy(g, summonedBy(g, 'f37shaman', c.u), { by: p }); } }] },
  'Doomkaiser Dragon Assault Mode': { effs: [lockEff,
    { type: 'trig', mand: true, tags: { ss: 1 }, label: 'Special Summon Zombies from the GYs', on: (g, ev, c) => evSummoned(ev, c) && !['normal', 'tribute', 'flip'].includes(ev.how),
      res: function* (g, c, p) { const xs = allCards(g, 'gy').filter(x => isMon(x) && race(x) === 'Zombie' && !forbid(g, { type: 'ss', c: x, p, how: 'special' })); const n = Math.min(xs.length, L.nFreeM(g, p)); if (!n) return;
        const ts = yield* pick(g, p, `Special Summon up to ${n} Zombies from the GYs`, xs, 0, n, 'good');
        for (const t of ts) if (t.zone === 'gy' && freeM(g, p) >= 0 && ss(g, p, t, 'atk', { negate: true })) { t.flags.f37dk = g.turnNo; t.flags.f37dkBy = c.u; } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the Zombies',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(m => m.flags.f37dk === g.turnNo && m.flags.f37dkBy === c.u),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => m.flags.f37dk === g.turnNo && m.flags.f37dkBy === c.u), { by: p }); } },
    { type: 'trig', loc: 'any', when: true, tags: { ss: 1 }, label: 'Special Summon Doomkaiser Dragon',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed,
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, 'Doomkaiser Dragon')),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon Doomkaiser Dragon from your GY', g.p[p].gy.filter(x => named(x, 'Doomkaiser Dragon')), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  'Doomsday Horror': {
    self: { atk: g => 300 * allCards(g, 'ban').filter(x => isMon(x) && attr(x) === 'DARK').length, def: g => 300 * allCards(g, 'ban').filter(x => isMon(x) && attr(x) === 'DARK').length },
    effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Return banished DARKs to the GY',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.to === 'gy',
      res: function* (g) { const xs = allCards(g, 'ban').filter(x => isMon(x) && attr(x) === 'DARK'); for (const x of xs) move(g, x, 'gy', { reason: 'effect' }); if (xs.length) log(g, `${xs.map(name).join(', ')} returned to the GY.`); } }] },
  'Doppelganger': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Inflict the same damage',
      on: (g, ev, c) => ev.type === 'damage' && !ev.battle && ev.p === c.ctrl && ev.srcP === opp(c.ctrl) && !!ev.src && isMon(ev.src),
      res: function* (g, c, p, L2) { if (onField(c)) damage(g, opp(p), L2.ev.n, { src: c, srcP: p }); } }] },
  // ENGINE: no response window when cards are drawn or added, so it is an optional trigger while Set (at Spell Speed 3).
  'Drastic Drop Off': { effs: [trapTrig({ label: 'They discard 1 of the added cards', speed: 3,
    on: (g, ev, c) => ev.type === 'move' && ev.from === 'deck' && ev.to === 'hand' && ev.c.owner !== c.ctrl,
    cond: (g, c, p, x) => g.events.some(e => e.group === x.ev.group && e.type === 'move' && e.from === 'deck' && e.to === 'hand' && e.c.owner === opp(p) && e.c.zone === 'hand'),
    res: function* (g, c, p, L2) { const q = opp(p); const xs = [...new Set(g.events.filter(e => e.group === L2.ev.group && e.type === 'move' && e.from === 'deck' && e.to === 'hand' && e.c.owner === q && e.c.zone === 'hand').map(e => e.c))];
      if (!xs.length) return; const [x] = yield* pick(g, q, 'Discard 1 of the cards you added', xs, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, q)} discarded ${name(x)}.`); } } })] },
  'Dreadscythe Harvester': { effs: [{ type: 'ign', label: 'Tribute an Insect: +500 ATK',
    cond: (g, c, p) => monsOf(g, p).some(m => m !== c && faceUp(m) && race(m) === 'Insect'),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which Insect?', monsOf(g, p).filter(m => m !== c && faceUp(m) && race(m) === 'Insect'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500, end: true }); log(g, `${name(c)} gained 500 ATK.`); } } }] },
  'Drill Synchron': { cont: { grant: (g, src, c, flag) => flag === 'piercing' && c.ctrl === src.ctrl && faceUp(c) && race(c) === 'Warrior' },
    effs: [{ type: 'trig', opt: true, when: true, label: 'Draw 1 card',
      on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.srcP === c.ctrl && ev.p !== c.ctrl && !!g.battle && g.battle.a === ev.src && !!g.battle.t && g.battle.t.pos !== 'atk' && race(ev.src) === 'Warrior',
      cond: (g, c, p) => g.p[p].deck.length > 0, res: function* (g, c, p) { draw(g, p, 1); } }] },
  'DUCKER Mobile Cannon': { effs: [flip('Add a Level 4 monster from your GY', {
    target: function* (g, c, p, L2) { const xs = g.p[p].gy.filter(x => isMon(x) && lv(x) === 4); if (xs.length) yield* tgt(g, p, L2, 'Add which Level 4 monster to your hand?', xs, 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } })] },
  'Dweller in the Depths': { self: { atk: (g, c) => 300 * g.p[c.ctrl].st.filter(x => x && faceUp(x) && isSpell(x) && D(x).sub === 'Continuous').length } },

  /* ----- E ----- */
  // PARTIAL: the engine offers a 1-Tribute Summon for a Level 7+ EARTH Normal Monster while you control it, but the one
  // Tribute can be any monster (ENGINE: no per-summon Tribute check).
  'Earth Effigy': { cont: { tributes: (g, src, c, p, need) => src.ctrl === p && need === 2 && D(c).k === 'normal' && attr(c) === 'EARTH' ? 1 : null } },
  'Ebon Arrow': { cont: { loc: 'gy', grant: (g, src, c, flag) => flag === 'piercing' && !!c.flags.f37ebon && c.flags.f37ebon.turn === g.turnNo },
    effs: [{ type: 'act', ds: true, cond: (g, c, p) => monsOf(g, p).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Choose a face-up monster you control', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; addMod(g, t, { atk: -500, end: true });
        const r = t.flags.f37ebon && t.flags.f37ebon.turn === g.turnNo ? t.flags.f37ebon : (t.flags.f37ebon = { turn: g.turnNo, by: [] }); r.by.push({ u: c.u, p });
        log(g, `${name(t)} lost 500 ATK and inflicts piercing damage this turn.`); } },
    { type: 'trig', loc: 'gy', mand: true, label: "Damage equal to the destroyed monster's DEF",
      on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && !!ev.killer && !!ev.killer.flags.f37ebon && ev.killer.flags.f37ebon.turn === g.turnNo && ev.killer.flags.f37ebon.by.some(b => b.u === c.u),
      res: function* (g, c, p, L2) { damage(g, opp(p), num(D(L2.ev.c).def), { src: c, srcP: p }); } }] },
  'Ebon Magician Curran': { effs: [{ type: 'trig', mand: true, label: '300 damage per monster', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    res: function* (g, c, p) { const n = monsOf(g, opp(p)).length; if (n) damage(g, opp(p), 300 * n, { src: c, srcP: p }); } }] },
  // PARTIAL: Synchro Summoning with a monster in your hand is offered as this card's effect (it is a summon condition, not
  // an effect, and gets no summon negation window), for Synchro Monsters with a plain "1 Tuner + 1 or more non-Tuners" recipe.
  // ENGINE: no per-material Synchro check, so the engine still lets it be used with a monster on the field; that Synchro gets
  // the same penalty. The Synchro Monster's effects are negated and it is banished when it leaves the field.
  'Eccentric Boy': { effs: [
    { type: 'ign', label: 'Synchro Summon with a monster in your hand', tags: { ss: 1 },
      cond: (g, c, p) => boyOpts(g, c, p).length > 0,
      res: function* (g, c, p) { const os = boyOpts(g, c, p); if (!os.length) return;
        const i = os.length > 1 ? yield* choose(g, p, 'Synchro Summon which monster?', os.map(([sx, h]) => `${D(sx).n} (with ${D(h).n})`)) : 0; const [sx, h] = os[i];
        const grp = g.group; move(g, c, 'gy', { reason: 'synchro', by: p, group: grp }); move(g, h, 'gy', { reason: 'synchro', by: p, group: grp });
        log(g, `${PN(g, p)} sent Eccentric Boy + ${D(h).n} to the GY for a Synchro Summon.`); ss(g, p, sx, 'atk', { how: 'synchro', group: grp }); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (ev.type === 'summon' && ev.how === 'synchro' && boyUsed(g, c, ev.group)) for (const x of ev.cs) if (x && onField(x)) { x.flags.negated = true; x.flags.banishOnLeave = true; g.seq++; }
      return false; } }] },
  'Edge Hammer': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && name(m) === 'Elemental HERO Bladedge') && monsOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute Elemental HERO Bladedge', monsOf(g, p).filter(m => faceUp(m) && name(m) === 'Elemental HERO Bladedge'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.ctrl === p) return; const A = baseAtk(t); if (destroy(g, [t], { by: p, src: c }).length && A > 0) damage(g, opp(p), A, { src: c, srcP: p }); } }] },
  'Eliminating the League': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.p[p].hand.some(isSpell) && oppFaceUp(g, p).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard a Spell', g.p[p].hand.filter(isSpell), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const n = name(t); if (!destroy(g, [t], { by: p, src: c }).length) return;
      const q = opp(p); log(g, `${PN(g, p)} looked at ${PN(g, q)}'s hand.`); const xs = g.p[q].hand.filter(x => D(x).n === n);
      for (const x of xs) move(g, x, 'gy', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.length} ${n} ${xs.length > 1 ? 'were' : 'was'} sent from the hand to the GY.`); } }] },
  'Emblem of the Awakening': ritualSpell(x => named(x, 'Cu Chulainn the Awakened'), false),
  // Tracks monsters destroyed by a card effect this turn (a mark on the card, set when it reaches the GY).
  'Emergency Assistance': { effs: [
    { type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => g.phase === 'main2' && freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && lv(x) === 4 && x.f37ea === g.turnNo && canSS(g, p, x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Level 4 monster?', g.p[p].gy.filter(x => isMon(x) && lv(x) === 4 && x.f37ea === g.turnNo && canSS(g, p, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { if (ev.type === 'move' && ev.c) { if (ev.to === 'gy' && ev.destroyed && !ev.battle) ev.c.f37ea = g.turnNo; else if (ev.c.f37ea) ev.c.f37ea = null; } return false; } }] },
  'Emperor Sem': { effs: [{ type: 'trig', label: 'Return a card from the GY to the top of the Deck',
    on: (g, ev, c) => ev.type === 'summon' && ev.how === 'tribute' && ev.p === c.ctrl && !ev.cs.includes(c),
    cond: (g, c, p) => g.p[p].gy.length > 0,
    res: function* (g, c, p) {
      if (g.p[p].gy.length) { const [x] = yield* pick(g, p, 'Return which card from your GY to the top of your Deck?', g.p[p].gy, 1, 1, 'good'); if (x) { move(g, x, 'deckTop', { reason: 'effect' }); log(g, `${PN(g, p)} put ${name(x)} on top of the Deck.`); } }
      const q = opp(p); if (g.p[q].gy.length && (yield* yn(g, q, 'Emperor Sem: return a card from your GY to the top of your Deck?'))) { const [y] = yield* pick(g, q, 'Return which card to the top of your Deck?', g.p[q].gy, 1, 1, 'good'); if (y) { move(g, y, 'deckTop', { reason: 'effect' }); log(g, `${PN(g, q)} put ${name(y)} on top of the Deck.`); } } } }] },
  'End of the World': ritualSpell(x => named(x, 'Ruin, Queen of Oblivion') || named(x, 'Demise, King of Armageddon'), true),
  // PARTIAL: the summon from the GY is offered as an effect of the card in the GY (a chain link), since inherent summons
  // are only offered from the hand.
  'Endymion, the Master Magician': {
    proc: { label: 'Special Summon (remove 6 Spell Counters)', cond: (g, c, p) => !!g.p[p].fz && faceUp(g.p[p].fz) && named(g.p[p].fz, 'Magical Citadel of Endymion') && ctr(g.p[p].fz, 'spell') >= 6,
      cost: function* (g, c, p) { addCtr(g, g.p[p].fz, 'spell', -6); log(g, `${PN(g, p)} removed 6 Spell Counters from Magical Citadel of Endymion.`); c.flags.f37endy = true; } },
    effs: [
      { type: 'ign', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon (remove 6 Spell Counters)',
        cond: (g, c, p) => freeM(g, p) >= 0 && !!g.p[p].fz && faceUp(g.p[p].fz) && named(g.p[p].fz, 'Magical Citadel of Endymion') && ctr(g.p[p].fz, 'spell') >= 6 && !forbid(g, { type: 'ss', c, p, how: 'special' }),
        cost: function* (g, c, p) { addCtr(g, g.p[p].fz, 'spell', -6); log(g, `${PN(g, p)} removed 6 Spell Counters from Magical Citadel of Endymion.`); },
        res: function* (g, c, p) { if (c.zone !== 'gy') return; c.flags.f37endy = true; if (!ss(g, p, c, 'atk')) c.flags.f37endy = false; } },
      { type: 'trig', label: 'Add a Spell from your GY', on: (g, ev, c) => evSummoned(ev, c) && !!c.flags.f37endy,
        cond: (g, c, p) => g.p[p].gy.some(isSpell),
        target: function* (g, c, p, L2) { c.flags.f37endy = false; yield* tgt(g, p, L2, 'Add which Spell to your hand?', g.p[p].gy.filter(isSpell), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } },
      { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Discard a Spell: destroy a card',
        cond: (g, c, p) => g.p[p].hand.some(isSpell) && allField(g).length > 0,
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard a Spell', g.p[p].hand.filter(isSpell), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', allField(g), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  "Enishi, Shien's Chancellor": {
    self: { cantAttack: (g, c) => c.flags.f37enishi === g.turnNo },
    proc: { label: 'Special Summon (banish 2 Six Samurai)', cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && /Six Samurai/.test(D(x).n)).length >= 2,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Banish 2 "Six Samurai" monsters from your GY', g.p[p].gy.filter(x => isMon(x) && /Six Samurai/.test(D(x).n)), 2, 2, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${xs.map(name).join(' and ')}.`); } },
    effs: [lockEff, { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy a face-up monster',
      cond: g => fieldMons(g).some(faceUp),
      after: (g, c) => { c.flags.f37enishi = g.turnNo; },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2).filter(faceUp), { by: p }); } }] },
  // PARTIAL: the extra attack is not forced to happen right away (the monster just gets a second attack this turn).
  'Enlightenment': { effs: [
    { type: 'act',
      cond: (g, c, p) => { const r = g.f37enl; if (!r || g.phase !== 'battle' || g.inDS || g.tp !== p || g.summoned[p] || r.turn !== g.turnNo || r.atk !== g.f37atkSeq) return false; const m = fieldMons(g).find(x => x.u === r.u); return !!m && m.ctrl === p && faceUp(m) && race(m) === 'Spellcaster'; },
      res: function* (g, c, p) { const r = g.f37enl; const m = r && fieldMons(g).find(x => x.u === r.u);
        g.noSummon[p] = true; addRule(g, (g2, a) => a.type === 'ss' && a.p === p, { end: g.turnNo });
        if (m && faceUp(m) && m.ctrl === p) { m.flags.maxAttacks = (m.attacks || 0) + 1; m.flags.maxAttacksTurn = g.turnNo; log(g, `${name(m)} can attack again.`); } } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => {
      if (ev.type === 'attack') g.f37atkSeq = ev.seq;
      else if (ev.type === 'move' && ev.battle && ev.destroyed && ev.killer && g.battle && g.battle.a === ev.killer && ev.snap && ev.snap.ctrl !== ev.killer.ctrl && onField(ev.killer)) g.f37enl = { u: ev.killer.u, turn: g.turnNo, atk: g.f37atkSeq };
      return false; } }] },
  // ENGINE: no forced battle, so the Equip Card moves but the battle between the two monsters isn't conducted.
  'Equip Shot': { effs: [{ type: 'act',
    cond: (g, c, p) => g.phase === 'battle' && !g.inDS && monsOf(g, opp(p)).some(m => m.pos === 'atk') && stOf(g, p).some(x => faceUp(x) && isSpell(x) && D(x).sub === 'Equip' && monsOf(g, p).some(m => m.u === x.equipTo && m.pos === 'atk')),
    target: function* (g, c, p, L2) {
      const [eq] = yield* pick(g, p, 'Move which Equip Card?', stOf(g, p).filter(x => faceUp(x) && isSpell(x) && D(x).sub === 'Equip' && monsOf(g, p).some(m => m.u === x.equipTo && m.pos === 'atk')), 1, 1, 'good');
      L2.data.eq = eq; L2.data.from = eq && eq.equipTo; yield* tgt(g, p, L2, 'Equip it to which Attack Position monster?', monsOf(g, opp(p)).filter(m => m.pos === 'atk'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const eq = L2.data.eq, t = live(L2)[0]; if (!eq || !onField(eq) || !t || t.pos !== 'atk') return; eq.equipTo = t.u; g.seq++; log(g, `${name(eq)} was equipped to ${name(t)}.`);
      // then the previously equipped monster and the selected one battle; the turn player's monster attacks (see cardBattle)
      const m = monsOf(g, p).find(x => x.u === L2.data.from); if (!m || m.pos !== 'atk' || !onField(t) || t.pos !== 'atk') return;
      if (g.tp === p) cardBattle(g, m, t); else cardBattle(g, t, m); } }] },
  // Linked both ways: when this card leaves the field the monster is destroyed and banished; when the monster is destroyed,
  // this card is destroyed.
  'Escape from the Dark Dimension': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].ban.some(x => isMon(x) && attr(x) === 'DARK' && canSS(g, p, x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which banished DARK monster?', g.p[p].ban.filter(x => isMon(x) && attr(x) === 'DARK' && canSS(g, p, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'ban' && onField(c) && ss(g, p, t, 'atk')) c.f37esc = t.u; } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy and banish the monster',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && !!c.f37esc,
      res: function* (g, c, p) { const u = c.f37esc; c.f37esc = null; const t = fieldMons(g).find(m => m.u === u); if (t) destroy(g, [t], { by: p, banish: true }); } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy Escape from the Dark Dimension',
      on: (g, ev, c) => ev.type === 'move' && !!c.f37esc && ev.c.u === c.f37esc && ev.wasField && ev.destroyed,
      res: function* (g, c, p) { c.f37esc = null; if (onField(c)) destroy(g, [c], { by: p }); } }] },
});
})();
