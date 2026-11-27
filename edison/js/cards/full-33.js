/* Full pool batch 33: Neo Space to Seed of Flame (build/batches/full/full-33.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, takeControl, addMod, equip, link, addCtr, ctr,
  negateAttack, endBattle, addRule, token, tokens, synCombos, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv,
  baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp,
  oppFaceUp, stOnField, spellTrapAct, evSummoned, battleKill, emit, forbid, negd, num } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const isPsy = x => isMon(x) && race(x) === 'Psychic';
const isRep = x => isMon(x) && /Reptilianne/.test(name(x));
const isPlant = x => race(x) === 'Plant';
const isXSaber = x => isMon(x) && /X-Saber/.test(name(x));
const isPB = x => named(x, 'Gazelle the King of Mythical Beasts') || /^Phantom Beast/.test(name(x));
const sanctuary = g => allField(g).some(x => faceUp(x) && named(x, 'The Sanctuary in the Sky'));
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'atk' }); };
function* discard1(g, p, text) { const [x] = yield* pick(g, p, text || 'Discard 1 card', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } return x; }
// Fusion Monsters that specifically list "Elemental HERO Neos" as a material (the data writes "Elemental Hero Neos" on some)
const neosFusion = c => D(c).k === 'fusion' && /"Elemental HERO Neos"/i.test((D(c).ps || D(c).tx || '').split('\n')[0]);
// "ATK becomes 0, also it can't change its battle position" (Reptilianne): a flag on the card (gone when it leaves the field or
// is turned face-down), read by one duel-long rule.
function zeroLock(g, t, lock) {
  addMod(g, t, { set: 0, which: 'atk' });
  if (lock) { t.flags.f33noPos = true; if (!g.f33noPos) { g.f33noPos = true; addRule(g, (g2, a) => a.type === 'pos' && !!a.c && !!a.c.flags && !!a.c.flags.f33noPos && onField(a.c)); } }
  g.seq++; log(g, `${name(t)}'s ATK became 0${lock ? " and it can't change its battle position" : ''}.`);
}
/* Summon locks, one duel-long rule installed by the first event any of these cards sees (a trig that never fires). */
const LOCKS = {
  // "Cannot be Special Summoned except with NEX" (full-41.js sets g.f41nex while NEX summons)
  'Neo-Spacian Marine Dolphin': (g, a) => a.type === 'ss' && !g.f41nex,
  'Neo-Spacian Twinkle Moss': (g, a) => a.type === 'ss' && !g.f41nex,
  'Rose Tentacles': (g, a) => a.type === 'ss',
  // only by its own procedure from the hand (taken outside any chain); never by a card effect. Only 1 face-up on the field.
  'Reptilianne Vaskii': (g, a) => (a.type === 'ss' && (a.c.zone !== 'hand' || !!g.resolvingL)) || (['ss', 'ns', 'set', 'flip'].includes(a.type) && fieldMons(g).some(x => x !== a.c && faceUp(x) && named(x, 'Reptilianne Vaskii'))),
};
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: (g) => { if (!g.f33lock) { g.f33lock = true; addRule(g, (g2, a) => { if (!a.c || !a.c.id || !['ns', 'set', 'ss'].includes(a.type)) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); } return false; } };
// "by an opponent's card effect": the move's own `by`, else the turn player. PARTIAL: an opponent's Quick Effect on your turn without `by` is missed.
const byOpp = (g, ev) => ev.by != null ? ev.by !== ev.prevCtrl : g.tp !== ev.prevCtrl;
// Gemini: the effect applies only while Gemini Summoned and not negated
const gem = (g, c) => onField(c) && faceUp(c) && c.flags.gemini && !negd(g, c);
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) equip(g, c, t); } });
// Phantom Dragon: 2 Monster Zones per face-up Phantom Dragon can't be used (counted, not picked)
const pdLocked = (g, p) => 2 * monsOf(g, p).filter(x => faceUp(x) && named(x, 'Phantom Dragon') && !negd(g, x)).length;
// Psychic Jumper: switch control of two monsters in place
function swapControl(g, a, b) {
  const pa = a.ctrl, pb = b.ctrl, ia = g.p[pa].m.indexOf(a), ib = g.p[pb].m.indexOf(b); if (ia < 0 || ib < 0) return false;
  g.p[pa].m[ia] = b; g.p[pb].m[ib] = a; a.ctrl = pb; b.ctrl = pa;
  for (const x of [a, b]) { x.flags.ctrlUntil = null; x.flags.ctrlFrom = null; }
  g.seq++; log(g, `${name(a)} and ${name(b)} switched control.`); return true;
}
const SKY = { n: 'Skyblaster Token', a: 'DARK', r: 'Fiend', lv: 4, atk: 500, def: 500 };

E.addScripts({
  /* ----- Neo Space ----- */
  // PARTIAL: "don't have to activate" their End Phase shuffle: under Neo Space the shuffle effects are never activated
  // (ENGINE: no way to ask for a mandatory trigger, so the monster always stays).
  'Neo Space': {
    cont: {
      atk: (g, src, m) => named(m, 'Elemental HERO Neos') || neosFusion(m) ? 500 : 0,
      forbid: (g, src, a) => a.type === 'activate' && !!a.eff && a.eff.type === 'trig' && !!a.eff.mand && g.phase === 'end' && a.c.zone === 'm' && neosFusion(a.c) && (!a.eff.label || /Extra Deck/i.test(a.eff.label)) },
    effs: [actNoop] },
  'Neo Space Pathfinder': { effs: [{ type: 'ign', loc: 'hand', label: 'Discard: add Neo Space from Deck/GY',
    cond: (g, c, p) => g.p[p].gy.some(x => named(x, 'Neo Space')) || (g.p[p].deck.some(x => named(x, 'Neo Space')) && !forbid(g, { type: 'search', p })),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded Neo Space Pathfinder.`); },
    res: function* (g, c, p) {
      const cs = [...g.p[p].gy, ...(forbid(g, { type: 'search', p }) ? [] : g.p[p].deck)].filter(x => named(x, 'Neo Space')); if (!cs.length) return;
      const [x] = yield* pick(g, p, 'Add which Neo Space to your hand?', cs, 1, 1, 'good'); if (!x) return;
      const from = x.zone; move(g, x, 'hand', { reason: 'effect', by: p }); if (from === 'deck') shuffleDeck(g, p);
      log(g, `${PN(g, p)} added Neo Space from the ${from === 'deck' ? 'Deck' : 'GY'} to the hand.`); } }] },
  'Neo-Parshath, the Sky Paladin': {
    proc: { label: 'Special Summon (Tribute Airknight Parshath)',
      cond: (g, c, p) => monsOf(g, p).some(x => named(x, 'Airknight Parshath')),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Tribute which Airknight Parshath?', monsOf(g, p).filter(x => named(x, 'Airknight Parshath')), 1, 1, 'cost');
        if (x) { move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Airknight Parshath.`); } } },
    self: { piercing: true,
      atk: (g, c) => { const me = g.p[c.ctrl].lp, them = g.p[opp(c.ctrl)].lp; return sanctuary(g) && me > them ? me - them : 0; },
      def: (g, c) => { const me = g.p[c.ctrl].lp, them = g.p[opp(c.ctrl)].lp; return sanctuary(g) && me > them ? me - them : 0; } },
    effs: [{ type: 'trig', mand: true, label: 'Draw 1 card', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  'Neo-Spacian Air Hummingbird': { effs: [{ type: 'ign', opt: true, label: 'Gain 500 LP per card in their hand',
    cond: (g, c, p) => g.p[opp(p)].hand.length > 0,
    res: function* (g, c, p) { gain(g, p, 500 * g.p[opp(p)].hand.length); } }] },
  'Neo-Spacian Flare Scarab': { self: { atk: (g, c) => 400 * stOf(g, opp(c.ctrl)).length }, effs: [] },
  // ENGINE: "also treated as Neo-Spacian Aqua Dolphin" needs a name() override (NEX, Cocoon Party and the Chrysalis cards know it).
  'Neo-Spacian Marine Dolphin': { effs: [lockInstall, { type: 'ign', opt: true, label: 'Discard: look at their hand',
    cond: (g, c, p) => g.p[p].hand.length > 0 && g.p[opp(p)].hand.length > 0,
    cost: function* (g, c, p) { yield* discard1(g, p); },
    res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand; log(g, `${PN(g, p)} looked at ${PN(g, o)}'s hand.`); const mons = h.filter(isMon); if (!mons.length) return;
      const [x] = yield* pick(g, p, 'Select a monster in their hand', mons, 1, 1, 'bad'); if (!x) return; log(g, `${PN(g, p)} selected ${name(x)}.`);
      const a = D(x).atk === '?' ? Infinity : baseAtk(x);
      if (monsOf(g, p).some(m => faceUp(m) && atk(g, m) >= a)) { move(g, x, 'gy', { reason: 'effect', destroyed: true, by: p }); log(g, `${name(x)} was destroyed.`); damage(g, o, 500, { src: c, srcP: p }); } } }] },
  // ENGINE: "also treated as Neo-Spacian Glow Moss" needs a name() override. PARTIAL: the Spell result turns the attack into
  // direct battle damage at once (as Glow Moss in batch-6.js).
  'Neo-Spacian Twinkle Moss': { effs: [lockInstall, { type: 'trig', mand: true, label: 'Draw and reveal a card',
    on: (g, ev, c) => ev.type === 'attack' && (ev.a === c || ev.t === c),
    res: function* (g, c, p, L2) { const n = g.p[p].hand.length; draw(g, p, 1); if (g.p[p].hand.length === n) return; const x = g.p[p].hand[g.p[p].hand.length - 1]; log(g, `${PN(g, p)} revealed ${name(x)}.`);
      if (isMon(x)) endBattle(g);
      else if (isSpell(x)) { if (L2.ev.a === c && L2.ev.t && onField(c) && c.pos === 'atk' && g.aw && (yield* yn(g, p, 'Change the attack to a direct attack?'))) { negateAttack(g); g.aw = null; damage(g, opp(p), atk(g, c), { battle: true, src: c, srcP: p, direct: true }); } }
      else toDef(g, c); } }] },

  /* ----- HERO support ----- */
  'O - Oversoul': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => D(x).k === 'normal' && /^Elemental HERO/.test(D(x).n) && canSS(g, p, x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Elemental HERO Normal Monster?', g.p[p].gy.filter(x => D(x).k === 'normal' && /^Elemental HERO/.test(D(x).n)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  'R - Righteous Justice': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => { const n = monsOf(g, p).filter(x => faceUp(x) && /^Elemental HERO/.test(name(x))).length; return n > 0 && stOnField(g).filter(x => x !== c).length >= n; },
    res: function* (g, c, p) { const n = monsOf(g, p).filter(x => faceUp(x) && /^Elemental HERO/.test(name(x))).length; const cs = stOnField(g).filter(x => x !== c);
      if (!n || cs.length < n) { log(g, 'There are too few Spells and Traps, so nothing was destroyed.'); return; }
      const xs = yield* pick(g, p, `Destroy ${n} Spell/Trap card${n > 1 ? 's' : ''}`, cs, n, n, 'bad'); destroy(g, xs, { by: p, src: c }); } }] },
  // Rose Bud leaves the field first, so full-07.js's Poison Rose lock (only with a Rose Bud) lets the summon through.
  'Rose Bud': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => named(x, 'Elemental HERO Knospe')) && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Elemental HERO Poison Rose')),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which Elemental HERO Knospe?', monsOf(g, p).filter(x => named(x, 'Elemental HERO Knospe')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Elemental HERO Knospe.`); } },
    res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Elemental HERO Poison Rose')); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which Elemental HERO Poison Rose?', cs, 1, 1, 'good'); if (!x) return;
      const fromDeck = x.zone === 'deck'; if (onField(c)) move(g, c, 'gy', { reason: 'rule' }); ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } }] },

  /* ----- Alien, Phantom Beasts ----- */
  // PARTIAL: "during damage calculation only" applies through the whole Damage Step.
  'Otherworld - The A Zone': { effs: [actNoop],
    cont: { atk: (g, src, m) => aZone(g, src, m), def: (g, src, m) => aZone(g, src, m) } },
  'Phantom Beast Cross-Wing': { cont: { loc: 'gy', atk: (g, src, m) => isPB(m) ? 300 : 0 }, effs: [] },
  // PARTIAL: the 1-Tribute Summon is offered while you control a Phantom Beast or Gazelle, but any monster can be the Tribute.
  'Phantom Beast Rock-Lizard': { self: { tributes: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isPB(x)) ? [1] : [] },
    effs: [
      { type: 'trig', mand: true, label: '500 damage', on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
        res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } },
      { type: 'trig', loc: 'gy', mand: true, label: '2000 damage', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !ev.battle && ev.to === 'gy' && byOpp(g, ev),
        res: function* (g, c, p) { damage(g, opp(p), 2000, { src: c, srcP: p }); } }] },
  'Phantom Beast Thunder-Pegasus': { effs: [
    { type: 'quick', loc: 'gy', label: 'Banish: protect a Phantom Beast',
      cond: (g, c, p) => !!g.aw && !g.inDS && g.aw.a.ctrl !== p && monsOf(g, p).some(x => faceUp(x) && isPB(x)),
      cost: function* (g, c, p) { move(g, c, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished Phantom Beast Thunder-Pegasus.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Protect which monster?', monsOf(g, p).filter(x => faceUp(x) && isPB(x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return;
        c.f33peg = { u: t.u, turn: g.turnNo, nbd: t.flags.noBattleDestroy, nbg: t.flags.noBattleDamage };
        t.flags.noBattleDestroy = true; t.flags.noBattleDamage = true; g.seq++;
        log(g, `${name(t)} can't be destroyed by battle and its controller takes no battle damage from this battle.`); } },
    // the protection lasts for this battle (cleared at the end of the Damage Step or of the turn)
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      const s = c.f33peg; if (!s || !((ev.type === 'dsEnd') || (ev.type === 'phase' && ev.ph === 'end') || s.turn !== g.turnNo)) return false;
      c.f33peg = null; const t = fieldMons(g).find(x => x.u === s.u);
      if (t) { t.flags.noBattleDestroy = s.nbd; t.flags.noBattleDamage = s.nbg; g.seq++; }
      return false; } }] },
  'Phantom Beast Wild-Horn': { self: { piercing: true }, effs: [] },

  /* ----- Phantom ----- */
  'Phantom Cricket': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Return a face-down monster to the Deck', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c) => fieldMons(g).some(x => x !== c && x.pos === 'set'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which face-down monster to the top of the Deck?', fieldMons(g).filter(x => x !== c && x.pos === 'set'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.pos !== 'set') return; move(g, t, 'deckTop', { reason: 'effect', by: p }); log(g, `A face-down monster was returned to the top of ${PN(g, t.owner)}'s Deck.`); } }] },
  // PARTIAL: the 2 unusable zones are counted, not picked: while it is face-up its controller can only use the Monster Zones
  // beyond 2 per Phantom Dragon (Tribute Summons are let through).
  'Phantom Dragon': {
    cont: { forbid: (g, src, a) => ['ns', 'set', 'ss'].includes(a.type) && a.p === src.ctrl && a.c !== src && !(['ns', 'set'].includes(a.type) && a.c.id && lv(a.c) >= 5) && nFreeM(g, src.ctrl) <= pdLocked(g, src.ctrl) },
    effs: [{ type: 'trig', loc: 'hand', when: true, tags: { ss: 1 }, label: 'Special Summon this card',
      on: (g, ev, c) => ev.type === 'summon' && ev.p !== c.owner && !g.inDS && !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how),
      cond: (g, c, p) => !g.inDS && nFreeM(g, p) >= 3 + pdLocked(g, p),
      res: function* (g, c, p) { if (c.zone !== 'hand' || nFreeM(g, p) < 3 + pdLocked(g, p)) return; if (ss(g, p, c, 'atk')) log(g, `2 of ${PN(g, p)}'s Monster Zones can't be used.`); } }] },
  'Phantom Dragonray Bronto': {
    self: { atk: (g, c) => c.flags.gemini ? 2300 - baseAtk(c) : 0 },
    effs: [
      { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'attack' && ev.a === c) c.flags.f33bronto = g.turnNo; return false; } },
      { type: 'trig', mand: true, label: 'Change to Defense Position', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'bpEnd' && c.flags.f33bronto === g.turnNo && gem(g, c),
        res: function* (g, c) { if (!onField(c) || c.pos !== 'atk') return; toDef(g, c); const u = c.u;
          addRule(g, (g2, a) => a.type === 'pos' && !!a.c && a.c.u === u, { end: g.turnNo + 2 }); } }] },
  'Phantom Skyblaster': { effs: [
    { type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon Skyblaster Tokens', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute', 'flip']),
      cond: (g, c, p) => freeM(g, p) >= 0 && monsOf(g, p).length > 0,
      res: function* (g, c, p) { const max = Math.min(monsOf(g, p).length, nFreeM(g, p)); if (max < 1) return;
        let n = max; if (max > 1) n = 1 + (yield* choose(g, p, 'How many Skyblaster Tokens?', Array.from({ length: max }, (_, i) => String(i + 1))));
        const pos = (yield* choose(g, p, 'Skyblaster Tokens: which position?', ['Attack Position', 'Defense Position'])) ? 'def' : 'atk';
        tokens(g, p, SKY, n, pos); } },
    { type: 'trig', opt: true, label: '300 damage per Skyblaster', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      after: (g, c, p) => { addRule(g, (g2, a) => a.type === 'attack' && !!a.c && a.c.ctrl === p && /Skyblaster/.test(name(a.c)), { end: g.turnNo }); log(g, `${PN(g, p)}'s Skyblaster monsters can't attack this turn.`); },
      res: function* (g, c, p) { const n = monsOf(g, p).filter(x => faceUp(x) && /Skyblaster/.test(name(x))).length; if (n) damage(g, opp(p), 300 * n, { src: c, srcP: p }); } }] },

  /* ----- Psychic ----- */
  // ENGINE: no response window after a battle destruction, so it is offered as an optional trigger while Set (as D.D. Trap Hole).
  'Psi-Curse': { effs: [{ type: 'trig', loc: 'any', speed: 2, tags: { destroy: 1 }, label: 'Activate Psi-Curse',
    on: (g, ev, c) => {
      if (c.zone !== 'st' || c.pos !== 'set' || c.turnIn === g.turnNo) return false;
      if (ev.type !== 'move' || !ev.battle || !ev.destroyed || ev.to !== 'gy' || !ev.wasField || ev.prevCtrl !== c.ctrl || !ev.snap || ev.snap.race !== 'Psychic') return false;
      const k = ev.killer; if (!k || k.ctrl === c.ctrl || !g.battle || g.battle.a !== k) return false;
      c.f33curse = { u: k.u, lv: ev.snap.lv }; return true; },
    cond: (g, c) => c.zone === 'st' && c.pos === 'set' && !!c.f33curse && fieldMons(g).some(x => x.u === c.f33curse.u),
    cost: function* (g, c) { c.pos = 'up'; g.seq++; },
    target: function* (g, c, p, L2) { L2.data.lv = c.f33curse.lv; yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g).filter(x => x.u === c.f33curse.u), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && destroy(g, [t], { by: p, src: c }).length) damage(g, opp(p), 300 * L2.data.lv, { src: c, srcP: p });
      if (onField(c)) move(g, c, 'gy', { reason: 'rule' }); } }] },
  'Psi-Impulse': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(isPsy) && g.p[opp(p)].hand.length > 0 && g.p[opp(p)].deck.length >= 3,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which Psychic monster?', monsOf(g, p).filter(isPsy), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand.slice(); if (!h.length) return;
      for (const x of h) move(g, x, 'deck', { reason: 'effect', by: p }); log(g, `${PN(g, o)} shuffled ${h.length} card${h.length > 1 ? 's' : ''} from the hand into the Deck.`); draw(g, o, 3); } }] },
  'Psi-Station': { effs: [actNoop, { type: 'trig', loc: 'st', when: true, label: 'Pay 500: +1 Level and +300 ATK',
    on: (g, ev, c) => { if (ev.type === 'summon' && ['normal', 'tribute'].includes(ev.how) && ev.cs.length && isPsy(ev.cs[0])) { c.f33st = ev.cs[0]; return true; } return false; },
    cond: (g, c, p) => g.p[p].lp > 500 && !!c.f33st && onField(c.f33st) && faceUp(c.f33st),
    cost: function* (g, c, p) { pay(g, p, 500); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Psychic monster?', [c.f33st].filter(x => onField(x) && faceUp(x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; t.flags.lv = lv(t) + 1; addMod(g, t, { atk: 300 }); g.seq++; log(g, `${name(t)} gained 1 Level and 300 ATK.`); } }] },
  'Psychic Emperor': { effs: [{ type: 'trig', mand: true, label: 'Gain 500 LP per Psychic in your GY',
    on: (g, ev, c) => ev.type === 'summon' && ev.cs.includes(c) && !['flip', 'gemini'].includes(ev.how),
    res: function* (g, c, p) { const n = g.p[p].gy.filter(isPsy).length; if (n) gain(g, p, 500 * n); } }] },
  'Psychic Jumper': { effs: [{ type: 'ign', opt: true, label: 'Pay 1000: switch control',
    cond: (g, c, p) => g.p[p].lp > 1000 && oppFaceUp(g, p).length > 0 && monsOf(g, p).some(x => x !== c && faceUp(x) && isPsy(x) && !named(x, 'Psychic Jumper')),
    cost: function* (g, c, p) { pay(g, p, 1000); },
    target: function* (g, c, p, L2) {
      const [a] = yield* pick(g, p, 'Take which of their monsters?', oppFaceUp(g, p), 1, 1, 'bad');
      const [b] = yield* pick(g, p, 'Give which of your Psychic monsters?', monsOf(g, p).filter(x => x !== c && faceUp(x) && isPsy(x) && !named(x, 'Psychic Jumper')), 1, 1, 'cost');
      L2.t = [a, b].filter(Boolean); },
    res: function* (g, c, p, L2) {
      const [a, b] = L2.t;
      if (!a || !b || !onField(a) || !onField(b) || a.ctrl === p || b.ctrl !== p) return;
      if (swapControl(g, a, b)) { const us = [a.u, b.u]; addRule(g, (g2, x) => x.type === 'pos' && !!x.c && us.includes(x.c.u), { end: g.turnNo }); } } }] },
  'Psychic Overload': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].gy.filter(isPsy).length >= 3,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Shuffle which 3 Psychic monsters into the Deck?', g.p[p].gy.filter(isPsy), 3, 3, 'cost'); },
    res: function* (g, c, p, L2) { if (L2.t.length < 3 || L2.t.some(x => x.zone !== 'gy')) return;
      for (const x of L2.t) move(g, x, 'deck', { reason: 'effect', by: p }); log(g, `${PN(g, p)} shuffled 3 Psychic monsters into the Deck.`); draw(g, p, 2); } }] },
  'Psychic Path': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].lp > 800 && g.p[p].ban.some(isPsy),
    cost: function* (g, c, p) { pay(g, p, 800); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which banished Psychic monsters?', g.p[p].ban.filter(isPsy), 1, 2, 'good'); },
    res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'ban'); for (const x of xs) move(g, x, 'hand', { reason: 'effect', by: p }); if (xs.length) log(g, `${PN(g, p)} added ${xs.map(name).join(' and ')} to the hand.`); } }] },
  'Psychic Rejuvenation': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isPsy(x)),
    res: function* (g, c, p) { const n = monsOf(g, p).filter(x => faceUp(x) && isPsy(x)).length; if (n) gain(g, p, 1000 * n); } }] },
  'Psychic Snail': { effs: [
    { type: 'ign', label: 'Pay 800: a Psychic attacks twice',
      cond: (g, c, p) => g.p[p].lp > 800 && monsOf(g, p).some(x => x !== c && faceUp(x) && isPsy(x)),
      cost: function* (g, c, p) { pay(g, p, 800); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Psychic monster can attack twice?', monsOf(g, p).filter(x => x !== c && faceUp(x) && isPsy(x)), 1, 1, 'good'); },
      after: (g, c) => { const u = c.u; addRule(g, (g2, a) => a.type === 'attack' && !!a.c && a.c.u === u, { end: g.turnNo }); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; t.flags.f33snail = true; t.flags.maxAttacks = 2; t.flags.maxAttacksTurn = g.turnNo; g.seq++; log(g, `${name(t)} can attack twice during each Battle Phase.`); } },
    // keeps the 2 attacks up every turn while that monster stays face-up (the flag goes when it leaves the field)
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { if (ev.type === 'phase') for (const x of fieldMons(g)) if (x.flags.f33snail && faceUp(x)) { x.flags.maxAttacks = 2; x.flags.maxAttacksTurn = g.turnNo; } return false; } }] },
  'Psychic Soul': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(isPsy),
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Tribute which Psychic monster?', monsOf(g, p).filter(isPsy), 1, 1, 'cost'); if (!x) return; L2.data.lv = lv(x); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
    res: function* (g, c, p, L2) { if (L2.data.lv) gain(g, p, 300 * L2.data.lv); } }] },
  'Psychic Sword': { cont: { atk: (g, src, m) => { if (src.equipTo !== m.u) return 0; const me = g.p[src.ctrl].lp, them = g.p[opp(src.ctrl)].lp; return me < them ? Math.min(2000, them - me) : 0; } },
    effs: [equipAct(isPsy, 'Equip to which Psychic monster?')] },
  'Psychic Trigger': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].lp < g.p[opp(p)].lp && g.p[p].gy.filter(isPsy).length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which 2 Psychic monsters?', g.p[p].gy.filter(isPsy), 2, 2, 'cost'); },
    res: function* (g, c, p, L2) { if (L2.t.length < 2 || L2.t.some(x => x.zone !== 'gy')) return;
      for (const x of L2.t) move(g, x, 'ban', { reason: 'effect', by: p }); log(g, `${PN(g, p)} banished ${L2.t.map(x => D(x).n).join(' and ')}.`); draw(g, p, 2); } }] },
  // ENGINE: "treated as a Tuner" needs a Tuner override (synCombos reads the card data), so the monster is summoned but not a Tuner.
  'Psychic Tuning': { effs: [
    { type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isPsy(x) && canSS(g, p, x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Psychic monster?', g.p[p].gy.filter(isPsy), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy' || !onField(c)) return; const n = lv(t);
        if (ss(g, p, t, 'atk')) { link(g, c, t); c.f33lv = n; log(g, `${name(t)} is treated as a Tuner.`); } } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Take damage', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && ev.wasField && !!c.f33lv,
      res: function* (g, c, p) { const n = c.f33lv; c.f33lv = null; if (n) damage(g, p, 400 * n, { src: c, srcP: p }); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ['hand', 'deck', 'ban'].includes(ev.to)) c.f33lv = null; return false; } }] },

  /* ----- Puppets ----- */
  'Puppet King': { effs: [
    { type: 'trig', loc: 'hand', when: true, tags: { ss: 1 }, label: 'Special Summon this card',
      on: (g, ev, c) => ev.type === 'move' && ev.to === 'hand' && ['deck', 'gy', 'ban'].includes(ev.from) && ev.reason !== 'draw' && ev.c.owner !== c.owner && isMon(ev.c) && !g.inDS,
      cond: (g, c, p) => freeM(g, p) >= 0 && !g.inDS,
      res: function* (g, c, p) { if (c.zone !== 'hand') return; if (ss(g, p, c, 'atk')) c.flags.f33king = g.tp === p ? g.turnNo + 2 : g.turnNo + 1; } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.f33king === g.turnNo,
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  // Port of classic-3.js (the Goat one stays there)
  'Puppet Master': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Pay 2000: revive 2 Fiends',
    on: (g, ev, c) => evSummoned(ev, c, ['tribute']),
    cond: (g, c, p) => g.p[p].lp > 2000 && nFreeM(g, p) >= 2 && g.p[p].gy.filter(x => isMon(x) && race(x) === 'Fiend' && canSS(g, p, x)).length >= 2,
    cost: function* (g, c, p) { pay(g, p, 2000); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which 2 Fiends from your GY?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Fiend'), 2, 2, 'good'); },
    res: function* (g, c, p, L2) { const done = [];
      for (const x of L2.t.filter(x => x.zone === 'gy')) if (ss(g, p, x, 'atk')) done.push(x);
      if (done.length) { const us = done.map(x => x.u); addRule(g, (g2, a) => a.type === 'attack' && !!a.c && us.includes(a.c.u), { end: g.turnNo }); } } }] },
  'Puppet Plant': { effs: [{ type: 'ign', loc: 'hand', label: 'Discard: take a Warrior or Spellcaster',
    cond: (g, c, p) => freeM(g, p) >= 0 && oppFaceUp(g, p).some(x => ['Warrior', 'Spellcaster'].includes(race(x))),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded Puppet Plant.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which monster?', oppFaceUp(g, p).filter(x => ['Warrior', 'Spellcaster'].includes(race(x))), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.ctrl !== p && ['Warrior', 'Spellcaster'].includes(race(t))) takeControl(g, p, t, true); } }] },

  /* ----- Radiant, Sanctuary ----- */
  'Radiant Jeral': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Gain 1000 LP',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && !(ev.battle && ev.destroyed) && sanctuary(g),
    res: function* (g, c, p) { if (sanctuary(g)) gain(g, p, 1000); } }] },
  'Radiant Mirror Force': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.aw && !g.inDS && g.aw.a.ctrl !== p && monsOf(g, opp(p)).filter(x => x.pos === 'atk').length >= 3,
    res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)).filter(x => x.pos === 'atk'), { by: p, src: c }); } }] },
  'Radiant Spirit': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy face-down and non-LIGHT monsters',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.wasField && ev.to === 'gy',
    cond: g => fieldMons(g).some(x => x.pos === 'set' || attr(x) !== 'LIGHT'),
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.pos === 'set' || attr(x) !== 'LIGHT'), { by: p }); } }] },

  /* ----- Reptilianne ----- */
  'Reptilianne Gardna': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Add a Reptilianne monster',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && ev.wasField && ev.destroyed && ev.prevCtrl === c.owner,
    cond: (g, c, p) => g.p[p].deck.some(isRep),
    res: function* (g, c, p) { yield* search(g, p, isRep, 'Add which Reptilianne monster?'); } }] },
  'Reptilianne Gorgon': { effs: [{ type: 'trig', mand: true, label: 'Its ATK becomes 0', on: (g, ev, c) => ev.type === 'afterCalc' && ev.a === c && !!ev.t,
    res: function* (g, c, p, L2) { const t = L2.ev.t; if (!t || !onField(t) || !faceUp(t) || t.flags.battleDoomed) return; zeroLock(g, t, true); } }] },
  'Reptilianne Hydra': { noSynchro: true,
    proc: { extra: true, how: 'synchro', label: 'Synchro Summon',
      cond: (g, c, p) => hydraCombos(g, p, c).length > 0,
      cost: function* (g, c, p, grp) { const cs = hydraCombos(g, p, c); let mats = cs[0]; if (cs.length > 1) { const i = yield* choose(g, p, 'Synchro Summon Reptilianne Hydra with which monsters?', cs.map(m => m.map(name).join(' + '))); mats = cs[i]; }
        for (const m of mats) move(g, m, 'gy', { reason: 'synchro', by: p, group: grp }); log(g, `${PN(g, p)} sent ${mats.map(m => D(m).n).join(' + ')} to the GY for a Synchro Summon.`); } },
    effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy their 0 ATK monsters and draw', on: (g, ev, c) => evSummoned(ev, c, ['synchro']),
      res: function* (g, c, p) { const xs = destroy(g, oppFaceUp(g, p).filter(x => atk(g, x) === 0), { by: p }); if (xs.length) draw(g, p, xs.length); } }] },
  'Reptilianne Medusa': { effs: [{ type: 'ign', label: 'Send a card: ATK becomes 0',
    cond: (g, c, p) => g.p[p].hand.length > 0 && oppFaceUp(g, p).some(x => atk(g, x) > 0),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which card from your hand to the GY?', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster?', oppFaceUp(g, p).filter(x => atk(g, x) > 0), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) zeroLock(g, t, true); } }] },
  'Reptilianne Naga': { self: { noBattleDestroy: true },
    effs: [
      { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'afterCalc' && ev.a && ev.t && (ev.a === c || ev.t === c)) { const o = ev.a === c ? ev.t : ev.a;
        if (!c.f33naga || c.f33naga.turn !== g.turnNo) c.f33naga = { turn: g.turnNo, us: [] }; if (!c.f33naga.us.includes(o.u)) c.f33naga.us.push(o.u); } return false; } },
      // activates in the GY or banished too (Edison ruling)
      { type: 'trig', loc: 'any', mand: true, label: 'ATK of the monsters it battled becomes 0',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'bpEnd' && !!c.f33naga && c.f33naga.turn === g.turnNo && c.f33naga.us.length > 0 && (onField(c) || ['gy', 'ban'].includes(c.zone)),
        res: function* (g, c) { const us = c.f33naga ? c.f33naga.us : []; c.f33naga = null; for (const x of fieldMons(g).filter(m => us.includes(m.u) && faceUp(m))) zeroLock(g, x, false); } },
      { type: 'trig', mand: true, label: 'Change to Attack Position', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl && c.pos === 'def',
        res: function* (g, c, p) { if (!onField(c) || c.pos !== 'def') return; c.pos = 'atk'; g.seq++; log(g, 'Reptilianne Naga was changed to Attack Position.'); emit(g, { type: 'pos', c, p, from: 'def' }); } }] },
  'Reptilianne Poison': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isRep(x)) && monsOf(g, opp(p)).some(x => x.pos !== 'atk'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Defense Position monster?', monsOf(g, opp(p)).filter(x => x.pos !== 'atk'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.pos === 'atk') return;
      const wasSet = t.pos === 'set'; t.pos = 'atk'; g.seq++; log(g, `${name(t)} was changed to Attack Position.`);
      if (wasSet) emit(g, { type: 'flip', c: t, p: t.ctrl }); emit(g, { type: 'pos', c: t, p: t.ctrl, from: 'def' });
      if (onField(t) && faceUp(t)) zeroLock(g, t, false); } }] },
  // ENGINE: "the equipped monster becomes Reptile" needs a race() override.
  'Reptilianne Rage': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 800 : 0 },
    effs: [equipAct(),
      { type: 'trig', loc: 'gy', mand: true, label: 'A monster loses 800 ATK', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy',
        cond: (g, c, p) => oppFaceUp(g, p).length > 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster loses 800 ATK?', oppFaceUp(g, p), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: -800 }); log(g, `${name(t)} lost 800 ATK.`); } } }] },
  'Reptilianne Scylla': { effs: [{ type: 'trig', tags: { ss: 1 }, label: 'Special Summon the destroyed monster',
    on: (g, ev, c) => battleKill(ev, c) && !!ev.snap && ev.snap.mon && ev.snap.atk === 0 && ev.prevCtrl !== c.ctrl,
    cond: (g, c, p, x) => freeM(g, p) >= 0 && x.ev.c.zone === 'gy' && canSS(g, p, x.ev.c),
    res: function* (g, c, p, L2) { const x = L2.ev.c; if (x && x.zone === 'gy') ss(g, p, x, 'def', { negate: true }); } }] },
  // PARTIAL: "destroy this card when it is targeted by a Spell or Trap" is checked at the next game event after the targeting.
  'Reptilianne Servant': {
    cont: { forbid: (g, src, a) => a.type === 'ns' },
    effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy this card',
      on: (g, ev, c) => faceUp(c) && (fieldMons(g).some(x => x !== c && faceUp(x)) || [...g.chain, g.resolvingL].some(L2 => L2 && isST(L2.c) && (L2.t || []).includes(c))),
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) destroy(g, [c], { by: p }); } }] },
  'Reptilianne Spawn': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => nFreeM(g, p) >= 2 && g.p[p].gy.some(isRep),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish which Reptilianne monster from your GY?', g.p[p].gy.filter(isRep), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
    res: function* (g, c, p) { if (nFreeM(g, p) < 2) return; tokens(g, p, { n: 'Reptilianne Token', a: 'EARTH', r: 'Reptile', lv: 1, atk: 0, def: 0 }, 2, 'def'); } }] },
  'Reptilianne Vaskii': {
    proc: { label: 'Special Summon (Tribute 2 face-up 0 ATK monsters)',
      cond: (g, c, p) => fieldMons(g).filter(x => faceUp(x) && atk(g, x) === 0).length >= 2 && nFreeM(g, p) + monsOf(g, p).filter(x => faceUp(x) && atk(g, x) === 0).length >= 1,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Tribute which 2 face-up monsters with 0 ATK?', fieldMons(g).filter(x => faceUp(x) && atk(g, x) === 0), 2, 2, 'cost');
        const ns = xs.map(name); for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${ns.join(' and ')}.`); } },
    effs: [lockInstall, { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy a face-up monster',
      cond: (g, c) => fieldMons(g).some(x => x !== c && faceUp(x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up monster?', fieldMons(g).filter(x => x !== c && faceUp(x)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) destroy(g, [t], { by: p }); } }] },
  'Reptilianne Viper': { effs: [{ type: 'trig', when: true, label: 'Take control of a 0 ATK monster', on: (g, ev, c) => evSummoned(ev, c, ['normal']),
    cond: (g, c, p) => freeM(g, p) >= 0 && oppFaceUp(g, p).some(x => atk(g, x) === 0),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which monster?', oppFaceUp(g, p).filter(x => atk(g, x) === 0), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.ctrl !== p) takeControl(g, p, t, false); } }] },

  /* ----- Plants ----- */
  'Rose Fairy': { effs: [{ type: 'trig', loc: 'hand', tags: { ss: 1 }, label: 'Special Summon this card',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'deck' && ev.to === 'hand' && ev.reason !== 'draw' && !g.inDS,
    cond: (g, c, p) => freeM(g, p) >= 0 && !g.inDS,
    res: function* (g, c, p) { if (c.zone === 'hand') ss(g, p, c, 'atk'); } }] },
  // The extra attacks are counted the first time the game asks in the Battle Phase (the start of the Battle Phase).
  'Rose Tentacles': {
    self: { maxAttacks: (g, c) => { const n = monsOf(g, opp(c.ctrl)).filter(x => faceUp(x) && isPlant(x)).length;
      if (g.phase !== 'battle') return 1 + n; if (!c.flags.f33rt || c.flags.f33rt.turn !== g.turnNo) c.flags.f33rt = { turn: g.turnNo, n }; return 1 + c.flags.f33rt.n; } },
    effs: [lockInstall, { type: 'trig', mand: true, label: '300 damage', on: (g, ev, c) => battleKill(ev, c) && !!ev.snap && ev.snap.race === 'Plant',
      res: function* (g, c, p) { damage(g, opp(p), 300, { src: c, srcP: p }); } }] },
  'Samsara Lotus': { effs: [
    { type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.owner,
      cond: (g, c, p) => freeM(g, p) >= 0 && stOf(g, p).length === 0 && canSS(g, p, c),
      res: function* (g, c, p) { if (c.zone === 'gy' && stOf(g, p).length === 0) ss(g, p, c, 'atk'); } },
    { type: 'trig', mand: true, label: '1000 damage to its controller', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) damage(g, p, 1000, { src: c, srcP: p }); } }] },
  'Seed Cannon': { effs: [actNoop,
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => { if (ev.type === 'summon' && ev.cs.some(x => onField(x) && isPlant(x)) && c.f33sc !== ev.seq && ctr(c, 'plant') < 5) { c.f33sc = ev.seq; addCtr(g, c, 'plant', 1); g.seq++; log(g, `Seed Cannon has ${ctr(c, 'plant')} Plant Counter${ctr(c, 'plant') > 1 ? 's' : ''}.`); } return false; } },
    { type: 'ign', loc: 'st', label: 'Send to the GY: 500 damage per counter',
      cond: (g, c) => ctr(c, 'plant') > 0,
      cost: function* (g, c, p, L2) { L2.data.n = ctr(c, 'plant'); move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Seed Cannon to the GY.`); },
      res: function* (g, c, p, L2) { if (L2.data.n) damage(g, opp(p), 500 * L2.data.n, { src: c, srcP: p }); } }] },
  'Seed of Deception': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && isPlant(x) && lv(x) <= 2 && canSS(g, p, x)),
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isMon(x) && isPlant(x) && lv(x) <= 2); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which Plant monster?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  'Seed of Flame': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Revive a Plant and give them a Seed Token',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !ev.battle && ev.to === 'gy' && ev.prevCtrl === c.owner,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => x !== c && isMon(x) && isPlant(x) && lv(x) <= 4 && !named(x, 'Seed of Flame') && canSS(g, p, x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Plant monster?', g.p[p].gy.filter(x => x !== c && isMon(x) && isPlant(x) && lv(x) <= 4 && !named(x, 'Seed of Flame')), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy' || !ss(g, p, t, 'atk')) return; const o = opp(p);
      const tk = token(g, o, { n: 'Seed Token', a: 'EARTH', r: 'Plant', lv: 1, atk: 0, def: 0 }, 'def', { noTribute: true });
      if (tk) { log(g, `${PN(g, p)} Special Summoned a Seed Token to ${PN(g, o)}'s field.`); const ev = emit(g, { type: 'summon', cs: [tk], how: 'special', p: o, byEffect: true }); g.sw = { cs: [tk], p: o, how: 'special', group: ev.group }; } } }] },

  /* ----- Others ----- */
  'Saber Beetle': { self: { piercing: true }, effs: [] },
  'Saber Hole': { effs: [{ type: 'act', negSummon: true,
    cond: (g, c, p, x) => !x.top && !!g.attempt && g.attempt.p !== p && monsOf(g, p).some(m => faceUp(m) && isXSaber(m)),
    res: function* (g) { if (g.attempt) { g.attempt.negated = true; log(g, 'The summon was negated.'); } } }] },
  'Saber Slash': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && x.pos === 'atk' && isXSaber(x)) && allField(g).some(x => x !== c && faceUp(x)),
    res: function* (g, c, p) { const n = monsOf(g, p).filter(x => faceUp(x) && x.pos === 'atk' && isXSaber(x)).length; const cs = allField(g).filter(x => x !== c && faceUp(x)); if (!n || !cs.length) return;
      const k = Math.min(n, cs.length); const xs = yield* pick(g, p, `Destroy ${k} face-up card${k > 1 ? 's' : ''}`, cs, k, k, 'bad'); destroy(g, xs, { by: p, src: c }); } }] },
  // PARTIAL: the Tributes reach the GY for a moment before going to the Deck (ENGINE: no "instead" replacement in move()).
  'Samsara': { effs: [actNoop, { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
    if (ev.type === 'move' && ev.reason === 'ritual' && ev.to === 'gy' && ev.c.zone === 'gy' && isMon(ev.c)) { move(g, ev.c, 'deck', { reason: 'rule', noLater: true }); log(g, `${D(ev.c).n} was shuffled into the Deck instead.`); }
    return false; } }] },
  'Samsara Kaiser': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Return this card to the hand',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.reason === 'tribute' && ev.to === 'gy',
    res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'hand', { reason: 'effect', by: p }); log(g, 'Samsara Kaiser returned to the hand.'); } } }] },
});

function aZone(g, src, m) {
  if (!g.inDS || !g.battle || !g.battle.a || !g.battle.t) return 0;
  const { a, t } = g.battle; const me = src.ctrl;
  const alien = x => x && x.ctrl === me && faceUp(x) && /Alien/.test(name(x));
  if (m.ctrl !== me && ((m === a && alien(t)) || (m === t && alien(a)))) return -300;
  return 0;
}
function hydraCombos(g, p, c) { return synCombos(g, p, c).filter(m => m.filter(x => D(x).tu).every(x => /Reptilianne/.test(name(x)))); }
})();
