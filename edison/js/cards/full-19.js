/* Full pool batch 19: Archlord Zerato to Cestus of Dagla (build/batches/full/full-19.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text; cards with a
 Goat-only script elsewhere (Asura Priest, Back to Square One, Banisher of the Light, Barrel Behind the Door, Barrel Dragon,
 Bazoo the Soul-Eater, Berserk Gorilla, Bickuribox, Blade Knight, Block Attack, Blowback Dragon, Boar Soldier, Buster Blader,
 Byser Shock, Cannon Soldier, Catapult Turtle, Ceasefire, Cestus of Dagla) are ported here as the shared version. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, takeControl, addMod, equip, addRule, negateAttack, coin, dice,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, nFreeM, shuffleDeck, log, PN, live, opp, oppFaceUp, stOnField, evSummoned, stat, num, emit, isGemini, effsOf } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
const named = (c, ...ns) => ns.includes(D(c).n);
const noop = function* () {};
const tx = c => D(c).tx || '';
const toggle = (g, m) => { const from = m.pos; m.pos = m.pos === 'atk' ? 'def' : 'atk'; g.seq++; log(g, `${name(m)} was changed to ${m.pos === 'atk' ? 'Attack' : 'Defense'} Position.`); emit(g, { type: 'pos', c: m, p: m.ctrl, from }); };
function* discardPick(g, p, n, text, not) { const h = g.p[p].hand.filter(x => x !== not); if (!h.length) return []; const xs = yield* pick(g, p, text, h, Math.min(n, h.length), Math.min(n, h.length), 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'discard' }); if (xs.length) log(g, `${PN(g, p)} discarded ${xs.map(name).join(', ')}.`); return xs; }
// Effect Monsters (same as full-04.js): Effect, Flip and the rest, Fusions and Synchros with text after the materials, Rituals
// with text past their summon line, and Trap Monsters
function isEffMon(c) {
  const d = D(c), t = d.tx || '';
  if (d.k === 'trap') return true;
  if (d.k === 'effect') return true;
  if (d.k === 'fusion' || d.k === 'synchro') return t.split(/\r?\n/).filter(s => s.trim()).length > 1;
  if (d.k === 'ritual') return t.replace(/^You can Ritual Summon this card with "[^"]+"\.\s*/i, '').replace(/^This card can only be Ritual Summoned[^.]*\.\s*/i, '').trim().length > 0;
  return false;
}
const isFlipMon = c => isMon(c) && (/Flip/.test(D(c).ab || '') || /FLIP:/.test(tx(c)));
const inBattle = (g, c) => !!(g.battle && (g.battle.a === c || g.battle.t === c));
const battling = (g, a, b) => g.inDS && g.battle && a !== b && ((g.battle.a === a && g.battle.t === b) || (g.battle.a === b && g.battle.t === a));
// Does this card's effect inflict effect damage? (goat-4.js's test: battle damage text doesn't count)
const burnText = c => { const t = tx(c).replace(/[^.]*battle damage[^.]*\.?/gi, ''); return /inflict[^.]*damage|damage to (both|each|your)|takes? [^.]*damage/i.test(t); };
const umiOn = g => [g.p[0].fz, g.p[1].fz].some(f => f && faceUp(f) && named(f, 'Umi', 'A Legendary Ocean'));
const sanctuaryOf = (g, p) => { const f = g.p[p].fz; return !!f && faceUp(f) && named(f, 'The Sanctuary in the Sky'); };
const HARPIE = ['Harpie Lady', 'Harpie Lady 1', 'Harpie Lady 2', 'Harpie Lady 3', 'Cyber Harpie Lady'];
// Equip Spells
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m, g)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m, g)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t, g) && onField(c)) equip(g, c, t); } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
// Spirit-style return (goat-1.js): "During the End Phase of the turn this card is Normal Summoned or flipped face-up: return it"
const spiritReturn = { type: 'trig', mand: true, label: 'Return to the hand',
  on: (g, ev, c) => {
    if ((ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how)) || (ev.type === 'flip' && ev.c === c)) c.flags.spirit = g.turnNo;
    return ev.type === 'phase' && ev.ph === 'end' && c.flags.spirit === g.turnNo; },
  res: function* (g, c) { if (onField(c) && faceUp(c)) { move(g, c, 'hand', { reason: 'effect' }); log(g, `${name(c)} returned to the hand.`); } } };
// "Cannot be Special Summoned": the GY part only (ENGINE: no general "can't be Special Summoned" flag)
const noSSFromGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src };
// "This card can attack all monsters your opponent controls once each" (goat-1.js's Asura Priest): it may attack directly
// only if it hasn't attacked a monster this turn
function hitThisTurn(g, c) { return new Set(g.events.filter(e => e.type === 'attack' && e.a === c && e.turn === g.turnNo && e.t).map(e => e.t.u)); }
const attackAll = {
  maxAttacks: (g, c) => { const hit = hitThisTurn(g, c); const rest = monsOf(g, opp(c.ctrl)).filter(m => !hit.has(m.u)).length; return c.attacks + (rest || (c.attacks ? 0 : 1)); },
  attackOk: (g, c, t) => !hitThisTurn(g, c).has(t.u) };
// Summon locks: one duel-long rule, installed by the first event any of these cards sees (a trig that never fires).
// A Normal Spell is face-up on the field while it resolves (A Deal with Dark Ruler).
const resolving = (g, p, n) => stOf(g, p).some(x => faceUp(x) && named(x, n));
const LOCKS = {
  // only by its own rule (from the hand). PARTIAL: an effect that Special Summons it from the hand is not stopped.
  'Archlord Zerato': (g, a) => a.type === 'ss' && a.c.zone !== 'hand',
  'Berserk Dragon': (g, a) => a.type === 'ss' && !resolving(g, a.p, 'A Deal with Dark Ruler'),
};
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: (g) => { if (!g.f19lock) { g.f19lock = true; addRule(g, (g2, a) => { if (!a.c || a.type !== 'ss') return false; const f = LOCKS[D(a.c).n]; return !!f && f(g2, a); }); } return false; } };
// Charmers: "While this card is face-up on the field, take control of 1 <Attribute> monster your opponent controls."
// Control goes back at the next game event after the Charmer leaves, is turned face-down, or the monster loses the Attribute.
const charmer = (A) => ({ effs: [
  { type: 'trig', mand: true, faceDownOk: true, label: `Take control of an ${A} monster`, on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    target: function* (g, c, p, L2) { const cs = monsOf(g, opp(p)).filter(m => faceUp(m) && attr(m) === A); if (cs.length) yield* tgt(g, p, L2, `Take control of which ${A} monster?`, cs, 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || attr(t) !== A || t.ctrl === p || !onField(c) || !faceUp(c)) return;
      const from = t.ctrl; if (takeControl(g, p, t, false)) { t.flags.f19charm = c.u; t.flags.f19charmFrom = from; } } },
  { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
    if (g.f19charmBusy) return false;
    for (const m of fieldMons(g)) {
      if (m.flags.f19charm !== c.u) continue;
      if (onField(c) && faceUp(c) && faceUp(m) && attr(m) === A) continue;
      const back = m.flags.f19charmFrom; m.flags.f19charm = null; g.f19charmBusy = true;
      try { if (m.ctrl !== back) { if (freeM(g, back) >= 0) { takeControl(g, back, m, false); log(g, `${name(m)} returned to ${PN(g, back)}.`); } else move(g, m, 'gy', { reason: 'rule' }); } }
      finally { g.f19charmBusy = false; }
    }
    return false; } }] });
// Array of Revealing Light: every Type in the card list
let TYPES = null;
const allTypes = () => TYPES || (TYPES = [...new Set(E.cards().filter(x => ['normal', 'effect', 'fusion', 'ritual', 'synchro'].includes(x.k) && x.r).map(x => x.r))].sort());
// Buster Rancher: its own boost is left out when checking the equipped monster's ATK
let RANCH = 0;

E.addScripts({
  /* ----- A ----- */
  'Archlord Zerato': {
    proc: { label: 'Special Summon (Tribute Warrior of Zera)',
      cond: (g, c, p) => allField(g).some(f => f.zone === 'fz' && faceUp(f) && named(f, 'The Sanctuary in the Sky')) && monsOf(g, p).some(m => faceUp(m) && name(m) === 'Warrior of Zera'),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Tribute which Warrior of Zera?', monsOf(g, p).filter(m => faceUp(m) && name(m) === 'Warrior of Zera'), 1, 1, 'cost');
        if (x) { move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Warrior of Zera.`); } } },
    effs: [lockInstall,
      { type: 'ign', tags: { destroy: 1 }, label: 'Discard a LIGHT: destroy all their monsters',
        cond: (g, c, p) => sanctuaryOf(g, p) && g.p[p].hand.some(x => isMon(x) && attr(x) === 'LIGHT') && monsOf(g, opp(p)).length > 0,
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard which LIGHT monster?', g.p[p].hand.filter(x => isMon(x) && attr(x) === 'LIGHT'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
        res: function* (g, c, p) { if (!sanctuaryOf(g, p)) { log(g, 'The Sanctuary in the Sky is gone, so nothing happens.'); return; } destroy(g, monsOf(g, opp(p)), { by: p }); } }] },
  // The Type is declared on activation and kept on the card. Summons are noted on each monster (the flag clears if it is
  // turned face-down, so a monster flipped back up by an effect can attack, ruling).
  'Array of Revealing Light': {
    cont: { forbid: (g, src, a) => a.type === 'attack' && !!src.flags.f19type && race(a.c) === src.flags.f19type && a.c.flags.f19sumT === g.turnNo },
    effs: [{ type: 'act',
      target: function* (g, c, p, L2) { const ts = allTypes(); const i = yield* choose(g, p, 'Declare a Type', ts); L2.data.type = ts[i]; log(g, `${PN(g, p)} declared ${ts[i]}.`); },
      res: function* (g, c, p, L2) { if (onField(c)) { c.flags.f19type = L2.data.type; g.seq++; } } },
      { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { if (ev.type === 'summon' && ['normal', 'tribute', 'flip', 'special', 'synchro', 'fusion', 'ritual'].includes(ev.how)) for (const x of ev.cs) if (onField(x)) x.flags.f19sumT = g.turnNo; return false; } }] },
  'Arsenal Robber': { effs: [{ type: 'act',
    res: function* (g, c, p) { const o = opp(p); const cs = g.p[o].deck.filter(x => isSpell(x) && D(x).sub === 'Equip');
      if (!cs.length) { log(g, `${PN(g, o)} has no Equip Spell in the Deck.`); shuffleDeck(g, o); return; }
      const [x] = yield* pick(g, o, 'Send which Equip Spell from your Deck to the GY?', cs, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${PN(g, o)} sent ${name(x)} from the Deck to the GY.`); } shuffleDeck(g, o); } }] },
  'Arsenal Summoner': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Add a Guardian card', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { const no = ['Celtic Guardian', 'Winged Dragon, Guardian of the Fortress 1', 'Winged Dragon, Guardian of the Fortress #1', 'Winged Dragon, Guardian of the Fortress 2', 'Winged Dragon, Guardian of the Fortress #2', 'Guardian of the Labyrinth', 'The Reliable Guardian'];
      yield* search(g, p, x => /Guardian/.test(D(x).n) && !no.includes(D(x).n), 'Add a Guardian card from your Deck'); } }] },
  // ENGINE: attack redirect (attack() keeps its target local). PARTIAL: the attack on your monster is negated and the
  // attacker's ATK is dealt to you as direct battle damage, with no Damage Step of its own.
  'Astral Barrier': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', label: 'Make it a direct attack', on: (g, ev, c) => ev.type === 'attack' && !!ev.t && ev.a.ctrl !== c.ctrl && ev.t.ctrl === c.ctrl,
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (!g.aw || g.aw.a !== a || !onField(a)) return; negateAttack(g); log(g, `${name(a)}'s attack became a direct attack.`);
        const n = atk(g, a); if (n > 0 && g.p[p].noBattleDamage !== g.turnNo) damage(g, p, n, { battle: true, src: a, srcP: a.ctrl, direct: true }); } }] },
  'Asura Priest': { cont: noSSFromGY, self: attackAll, effs: [spiritReturn] },
  'Aswan Apparition': { effs: [{ type: 'trig', label: 'Return a Trap to the top of the Deck',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    cond: (g, c, p) => g.p[p].gy.some(isTrap),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which Trap to the top of your Deck?', g.p[p].gy.filter(isTrap), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'deckTop', { reason: 'effect' }); log(g, `${name(t)} was put on top of the Deck.`); } } }] },
  'Atomic Firefly': { effs: [
    { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'attack' && (ev.a === c || ev.t === c) && faceUp(c)) c.flags.f19ff = g.turnNo; return false; } },
    { type: 'trig', loc: 'any', mand: true, label: '1000 damage to the player who destroyed it',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.wasField && ev.snap && ev.snap.flags && ev.snap.flags.f19ff === g.turnNo,
      res: function* (g, c, p, L2) { const k = L2.ev.killer; const who = k ? (onField(k) ? k.ctrl : k.owner) : opp(L2.ev.prevCtrl); damage(g, who, 1000, { src: c, srcP: L2.ev.prevCtrl }); } }] },
  'Aussa the Earth Charmer': charmer('EARTH'),
  'Autonomous Action Unit': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.p[p].lp > 1500 && freeM(g, p) >= 0 && g.p[opp(p)].gy.some(isMon),
      cost: function* (g, c, p) { pay(g, p, 1500); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, "Special Summon which monster from your opponent's GY?", g.p[opp(p)].gy.filter(isMon), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && onField(c) && ss(g, p, t, 'atk')) { equip(g, c, t); c.flags.f19aau = t.u; } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the equipped monster', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.flags && ev.snap.flags.f19aau,
      cond: (g, c, p, x) => fieldMons(g).some(m => m.u === x.ev.snap.flags.f19aau),
      res: function* (g, c, p, L2) { const t = fieldMons(g).find(x => x.u === L2.ev.snap.flags.f19aau); if (t) destroy(g, [t], { by: p }); } }] },
  'Avatar of The Pot': { effs: [{ type: 'ign', label: 'Send Pot of Greed: draw 3',
    cond: (g, c, p) => g.p[p].hand.some(x => named(x, 'Pot of Greed')) && g.p[p].deck.length >= 3,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Pot of Greed to the GY?', g.p[p].hand.filter(x => named(x, 'Pot of Greed')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Pot of Greed to the GY.`); } },
    res: function* (g, c, p) { draw(g, p, 3); } }] },

  /* ----- Ba ----- */
  'Back to Square One': { effs: [{ type: 'act', cond: (g, c, p) => fieldMons(g).length > 0 && g.p[p].hand.some(x => x !== c),
    cost: function* (g, c, p) { yield* discardPick(g, p, 1, 'Discard 1 card', c); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, "Put which monster on top of its owner's Deck?", fieldMons(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.zone !== 'm') return; const n = faceUp(t) ? name(t) : 'A face-down monster';
      move(g, t, 'deckTop', { reason: 'effect', by: p }); log(g, `${n} was put on top of the Deck.`); } }] },
  // Several FIRE monsters at once deal 500 once (one trigger per event batch).
  'Backfire': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', mand: true, label: '500 damage',
      on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.destroyed && ev.to === 'gy' && ev.c.zone === 'gy' && ev.snap && ev.snap.mon && ev.snap.faceUp && ev.snap.attr === 'FIRE' && ev.prevCtrl === c.ctrl,
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  'Backup Soldier': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].gy.filter(isMon).length >= 5 && g.p[p].gy.some(x => isMon(x) && (!isEffMon(x) || isGemini(x)) && baseAtk(x) <= 1500),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add up to 3 non-Effect Monsters with 1500 or less ATK', g.p[p].gy.filter(x => isMon(x) && (!isEffMon(x) || isGemini(x)) && baseAtk(x) <= 1500), 1, 3, 'good'); },
    res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'hand', { reason: 'effect' }); if (xs.length) log(g, `${PN(g, p)} added ${xs.map(name).join(', ')} to the hand.`); } }] },
  // ENGINE: gain() has no hook. PARTIAL: an LP gain of the opponent is seen at the next game event, undone, and dealt as damage
  // (a gain followed by damage before any event is seen as the difference only).
  'Bad Reaction to Simochi': { effs: [
    { type: 'act', res: function* (g, c, p) { if (onField(c)) c.flags.f19lp = g.p[opp(p)].lp; } },
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
      const o = opp(c.ctrl), P = g.p[o], was = c.flags.f19lp; c.flags.f19lp = P.lp;
      if (was == null || P.lp <= was || g.f19simo) return false;
      const d = P.lp - was; g.f19simo = true;
      try { P.lp -= d; c.flags.f19lp = P.lp; log(g, `Bad Reaction to Simochi turned ${PN(g, o)}'s ${d} LP gain into damage.`); damage(g, o, d, { src: c, srcP: c.ctrl }); }
      finally { g.f19simo = false; c.flags.f19lp = P.lp; }
      return false; } }] },
  // A Trap whose timing is right is activated and resolved right away (inside Bait Doll's resolution, no chain of its own).
  // PARTIAL: "timing" is the Trap's own activation condition; a Trap with no script counts as wrong timing.
  'Bait Doll': { effs: [{ type: 'act', cond: (g, c) => stOnField(g).some(x => x !== c && x.zone === 'st' && x.pos === 'set'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which Set card?', stOnField(g).filter(x => x !== c && x.zone === 'st' && x.pos === 'set'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) {
      const t = live(L2)[0];
      if (t && t.pos === 'set') {
        log(g, `The Set card was ${D(t).n}.`);
        if (!isTrap(t)) log(g, `${D(t).n} was returned face-down.`);
        else {
          const q = t.ctrl, es = effsOf(t), ei = es.findIndex(e => e.type === 'act'), eff = es[ei];
          let okT = false; try { okT = !!eff && (!eff.cond || !!eff.cond(g, t, q, { top: g.chain[g.chain.length - 1], mode: 'respond' })); } catch (e) { okT = false; }
          t.pos = 'up'; g.seq++;
          if (!okT) { log(g, `${D(t).n} was activated at the wrong time, so it was negated.`); destroy(g, [t], { by: p, src: c }); }
          else {
            log(g, `${PN(g, q)} activated ${D(t).n}.`); t.used[ei] = g.turnNo;
            const L3 = { c: t, eff, ei, p: q, speed: 2, t: [], data: {}, negated: false, cardAct: true, tags: eff.tags || {}, link: g.chain.length + 1 };
            if (eff.cost) yield* eff.cost(g, t, q, L3);
            if (eff.target) yield* eff.target(g, t, q, L3);
            if (eff.res) yield* eff.res(g, t, q, L3);
            if (onField(t) && t.zone === 'st' && !['Continuous', 'Equip', 'Field'].includes(D(t).sub)) move(g, t, 'gy', { reason: 'rule' });
          }
        }
      }
      if (onField(c)) { move(g, c, 'deck', { reason: 'effect' }); log(g, 'Bait Doll was shuffled into the Deck.'); } } }] },
  // The +1500 is noted when its battle starts against a face-down Defense Position monster and counts in that Damage Step.
  'Ballista of Rampart Smashing': {
    cont: { atk: (g, src, m) => src.equipTo === m.u && g.inDS && g.battle && g.battle.a === m && src.flags.f19bal === g.battle ? 1500 : 0 },
    effs: [equipAct(),
      { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => { if (ev.type === 'dsStart' && ev.a && ev.a.u === c.equipTo && ev.t && ev.t.pos === 'set') { c.flags.f19bal = g.battle; g.seq++; } return false; } }] },
  // Counters are kept in flags (they clear when it leaves the field or is turned face-down), so the GY trigger can count them.
  'Balloon Lizard': { effs: [
    { type: 'trig', mand: true, label: 'Put a counter on this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { c.flags.f19bl = (c.flags.f19bl || 0) + 1; L.addCtr(g, c, 'balloon', 1); log(g, `Balloon Lizard has ${c.flags.f19bl} counter${c.flags.f19bl > 1 ? 's' : ''}.`); } } },
    { type: 'trig', loc: 'any', mand: true, label: '400 damage per counter',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField && ev.snap && ev.snap.faceUp && ev.snap.flags && ev.snap.flags.f19bl > 0,
      res: function* (g, c, p, L2) { const ev = L2.ev, k = ev.killer; const who = ev.battle && k ? (onField(k) ? k.ctrl : k.owner) : ev.by != null ? ev.by : opp(ev.prevCtrl);
        damage(g, who, 400 * ev.snap.flags.f19bl, { src: c, srcP: ev.prevCtrl }); } }] },
  // Port of goat-3.js. ENGINE: no banish-instead replacement in move(), so cards that reach the GY are moved on to banishment.
  'Banisher of the Light': { effs: [{ type: 'trig', res: noop, on: (g, ev, c) => {
    if (ev.type === 'move' && ev.to === 'gy' && ev.c !== c && ev.c.zone === 'gy' && onField(c) && faceUp(c)) { move(g, ev.c, 'ban', { reason: 'rule', noLater: true }); log(g, `${name(ev.c)} was banished instead.`); }
    return false; } }] },
  'Banner of Courage': { cont: { atk: (g, src, m) => m.ctrl === src.ctrl && g.phase === 'battle' && g.tp === src.ctrl ? 200 : 0 }, effs: [{ type: 'act', res: noop }] },
  'Bark of Dark Ruler': { effs: [{ type: 'act', ds: true,
    cond: (g, c, p) => { if (!g.inDS || !g.battle || !g.battle.t) return false; const { a, t } = g.battle; const mine = [a, t].find(x => x.ctrl === p), foe = [a, t].find(x => x.ctrl !== p);
      return !!mine && !!foe && faceUp(mine) && race(mine) === 'Fiend' && onField(foe) && faceUp(foe) && Math.max(atk(g, foe), def(g, foe)) >= 100 && g.p[p].lp > 100; },
    cost: function* (g, c, p, L2) { const foe = [g.battle.a, g.battle.t].find(x => x.ctrl !== p); L2.data.foe = foe;
      const top = Math.min(Math.floor(Math.max(atk(g, foe), def(g, foe)) / 100) * 100, Math.floor((g.p[p].lp - 1) / 100) * 100);
      const opts = []; for (let n = 100; n <= top; n += 100) opts.push(n);
      const i = yield* choose(g, p, 'Pay how many LP?', opts.map(n => n + ' LP')); L2.data.n = opts[i]; pay(g, p, L2.data.n); },
    target: function* (g, c, p, L2) { L2.t = [L2.data.foe]; },
    res: function* (g, c, p, L2) { const t = live(L2)[0], n = L2.data.n; if (!t || !faceUp(t) || !n) return; addMod(g, t, { atk: -n, def: -n, end: true }); log(g, `${name(t)} lost ${n} ATK and DEF.`); } }] },
  // Port of goat-4.js
  'Barrel Behind the Door': {
    cont: { loc: 'gy', dmg: (g, src, p, n, o) => { if (o.barrel || !o.src || !g.barrel) return; const b = g.barrel.find(x => x.by === src.u && x.p === p && x.u === o.src.u); if (!b) return;
      log(g, 'Barrel Behind the Door turned the damage around.'); damage(g, opp(p), n, { ...o, barrel: true }); return 0; } },
    effs: [{ type: 'act',
      cond: (g, c, p, x) => { const t = x.top; return !!(t && !t.negated && t.c !== c && t.p !== p && burnText(t.c) && !['Continuous', 'Equip', 'Field'].includes(D(t.c).sub || '')); },
      target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated) return; const res0 = T.eff.res, entry = { by: c.u, p, u: T.c.u };
        T.eff = { ...T.eff, res: function* (g2, c2, p2, L3) { (g2.barrel || (g2.barrel = [])).push(entry); try { yield* res0(g2, c2, p2, L3); } finally { g2.barrel = g2.barrel.filter(x => x !== entry); } } };
        log(g, `${PN(g, opp(p))} will take that damage instead.`); } }] },
  'Barrel Dragon': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Toss 3 coins: destroy a monster',
    cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which of their monsters?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { let h = 0; for (let i = 0; i < 3; i++) if (coin(g, p)) h++; log(g, `${h} of 3 coins came up Heads.`); if (h >= 2) destroy(g, live(L2), { by: p }); } }] },
  // Port of goat-3.js: the gain lasts until the end of the opponent's next turn
  'Bazoo the Soul-Eater': {
    self: { atk: (g, c) => (c.flags.bazoo || []).filter(b => g.turnNo <= b.until).reduce((s, b) => s + 300 * b.n, 0) },
    effs: [{ type: 'ign', opt: true, label: 'Banish up to 3 monsters: +300 ATK each',
      cond: (g, c, p) => g.p[p].gy.some(isMon),
      cost: function* (g, c, p, L2) { const xs = yield* pick(g, p, 'Banish up to 3 monsters from your GY', g.p[p].gy.filter(isMon), 1, 3, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost' }); L2.data.n = xs.length; log(g, `${PN(g, p)} banished ${xs.map(name).join(', ')}.`); },
      res: function* (g, c, p, L2) { if (!onField(c) || !faceUp(c)) return; (c.flags.bazoo || (c.flags.bazoo = [])).push({ n: L2.data.n, until: g.turnNo + 1 }); g.seq++; log(g, `${name(c)} gained ${300 * L2.data.n} ATK.`); } }] },
  // ENGINE: substitute Fusion Materials ("You can substitute this card for any 1 Fusion Material Monster") aren't read.
  'Beastking of the Swamps': { effs: [] },
  'Beckoning Light': { effs: [{ type: 'act',
    cond: (g, c, p) => { const h = g.p[p].hand.length; return h > 0 && g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT').length >= h; },
    res: function* (g, c, p) { const h = g.p[p].hand.slice(); if (!h.length || g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT').length < h.length) return;
      for (const x of h) move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded the whole hand (${h.length} card${h.length > 1 ? 's' : ''}).`);
      const n = h.filter(x => x.zone === 'gy').length; const cs = g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT'); if (!n || !cs.length) return;
      const xs = yield* pick(g, p, `Add ${n} LIGHT monster${n > 1 ? 's' : ''} from your GY to your hand`, cs, Math.min(n, cs.length), Math.min(n, cs.length), 'good');
      for (const x of xs) move(g, x, 'hand', { reason: 'effect' }); if (xs.length) log(g, `${PN(g, p)} added ${xs.map(name).join(', ')} to the hand.`); } }] },
  // With 1 Tribute its original ATK becomes 2000 (noted on the Summon or Set; turned face-down it is 2700 again, ruling).
  'Behemoth the King of All Animals': {
    self: { tributes: () => [1] },
    effs: [
      { type: 'trig', faceDownOk: true, res: noop, on: (g, ev, c) => {
        if (((ev.type === 'summon' && ev.cs.includes(c) && ev.how === 'tribute') || (ev.type === 'set' && ev.c === c)) && c.tributes && c.tributes.length === 1 && c.flags.f19beh !== c.turnIn) { c.flags.f19beh = c.turnIn; c.flags.baseAtk = 2000; g.seq++; }
        return false; } },
      { type: 'trig', when: true, label: 'Return Beasts from the GY to the hand', on: (g, ev, c) => evSummoned(ev, c, ['tribute']) && (ev.tribs || []).length > 0,
        cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && race(x) === 'Beast'),
        target: function* (g, c, p, L2) { const n = (c.tributes || []).length; const cs = g.p[p].gy.filter(x => isMon(x) && race(x) === 'Beast');
          yield* tgt(g, p, L2, `Return ${n} Beast monster${n > 1 ? 's' : ''} from your GY to the hand`, cs, Math.min(n, cs.length), Math.min(n, cs.length), 'good'); },
        res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'hand', { reason: 'effect' }); if (xs.length) log(g, `${xs.map(name).join(', ')} returned to the hand.`); } }] },
  'Berserk Dragon': { self: attackAll,
    effs: [lockInstall,
      { type: 'trig', mand: true, label: 'Lose 500 ATK', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
        res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: -500 }); log(g, 'Berserk Dragon lost 500 ATK.'); } } }] },
  // Port of goat-3.js. ENGINE: no forced attacks ("must attack if able" isn't enforced).
  'Berserk Gorilla': { effs: [{ type: 'trig', mand: true, label: 'Destroy itself (face-up Defense Position)',
    on: (g, ev, c) => faceUp(c) && c.pos === 'def',
    res: function* (g, c, p) { if (onField(c) && faceUp(c) && c.pos === 'def') destroy(g, [c], { by: p }); } }] },

  /* ----- Bi to Bu ----- */
  'Bickuribox': { effs: [] },
  'Birdface': { effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Add Harpie Lady',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => g.p[p].deck.some(x => named(x, ...HARPIE)),
    res: function* (g, c, p) { yield* search(g, p, x => named(x, ...HARPIE), 'Add Harpie Lady from your Deck'); } }] },
  'Bite Shoes': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Change a monster\'s battle position', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    target: function* (g, c, p, L2) { const cs = fieldMons(g).filter(m => faceUp(m) && m !== c); const all = cs.length ? cs : fieldMons(g).filter(faceUp); if (all.length) yield* tgt(g, p, L2, 'Change the battle position of which face-up monster?', all, 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.zone === 'm') toggle(g, t); } }] },
  // Port of goat-3.js
  'Blade Knight': {
    self: { atk: (g, c) => g.p[c.ctrl].hand.length <= 1 ? 400 : 0 },
    cont: { negates: (g, src, c) => c !== src && isFlipMon(c) && !!c.flags.battleDoomed && inBattle(g, src) && inBattle(g, c) && monsOf(g, src.ctrl).every(x => x === src) },
    effs: [] },
  'Blade Rabbit': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a monster',
    on: (g, ev, c) => ev.type === 'pos' && ev.c === c && c.pos === 'def' && (ev.from ? ev.from === 'atk' : true),
    cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which of their monsters?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  'Bladefly': { cont: { atk: (g, src, m) => faceUp(m) ? (attr(m) === 'WIND' ? 500 : 0) + (attr(m) === 'EARTH' ? -400 : 0) : 0 }, effs: [] },
  'Blasting the Ruins': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.length >= 30,
    res: function* (g, c, p) { damage(g, opp(p), 3000, { src: c, srcP: p }); } }] },
  // PARTIAL: a discard counts as the opponent's when the move names them (by), or when it is a plain discard during the
  // opponent's turn (the engine doesn't say which card is resolving).
  'Blessings of the Nile': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', mand: true, label: 'Gain 1000 LP',
      on: (g, ev, c) => ev.type === 'move' && ev.from === 'hand' && ev.to === 'gy' && ev.c.owner === c.ctrl && ['discard', 'effect'].includes(ev.reason)
        && (ev.by === opp(c.ctrl) || (ev.by == null && ev.reason === 'discard' && g.tp === opp(c.ctrl) && g.phase !== 'end')),
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) gain(g, p, 1000); } }] },
  // Face-up monsters only (a face-down monster's Level isn't known).
  'Blind Destruction': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', mand: true, opt: true, tags: { destroy: 1 }, label: 'Roll a die', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; const n = dice(g, p);
        const xs = fieldMons(g).filter(faceUp).filter(m => lv(m) > 0 && (n === 6 ? lv(m) >= 6 : lv(m) === n));
        if (xs.length) destroy(g, xs, { by: p, src: c }); else log(g, 'No monster had that Level.'); } }] },
  // ENGINE: takeControl() doesn't check for "control can't switch". PARTIAL: it can't be targeted by effects that take
  // control (read from their text); Creature Swap style effects that don't target still move it.
  // Review fix: a control-taking card can't be activated when the Goblin's controller has only face-up Goblins (rulings:
  // Change of Heart, Snatch Steal and Brain Control can't take it, and neither player can activate Creature Swap then).
  'Blindly Loyal Goblin': { self: { cantBeTargeted: true, targetFilter: (g, x, L2) => /take control|control of|gain control|switch control|change control/i.test(tx(L2.c)) },
    cont: { forbid: (g, src, a) => a.type === 'activate' && !!a.c && faceUp(src) && (a.p === opp(src.ctrl) || named(a.c, 'Creature Swap'))
      && /take control|control of|gain control|switch control|change control/i.test(tx(a.c))
      && monsOf(g, src.ctrl).every(m => faceUp(m) && named(m, 'Blindly Loyal Goblin')) },
    effs: [] },
  'Block Attack': { effs: [{ type: 'act', cond: (g, c, p) => oppFaceUp(g, p).some(m => m.pos === 'atk'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change which Attack Position monster to Defense?', oppFaceUp(g, p).filter(m => m.pos === 'atk'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.pos === 'atk') toggle(g, t); } }] },
  'Blowback Dragon': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Toss 3 coins: destroy a card', cond: (g, c, p) => fieldOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which card?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { let h = 0; for (let i = 0; i < 3; i++) if (coin(g, p)) h++; log(g, `${h} of 3 coins came up Heads.`); if (h >= 2) destroy(g, live(L2), { by: p }); } }] },
  'Boar Soldier': { self: { atk: (g, c) => monsOf(g, opp(c.ctrl)).length ? -1000 : 0 },
    effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy this card', on: (g, ev, c) => ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how),
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  'Bombardment Beetle': { effs: [{ type: 'trig', mand: true, faceDownOk: true, tags: { destroy: 1 }, label: 'Look at a face-down monster', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    target: function* (g, c, p, L2) { const cs = monsOf(g, opp(p)).filter(m => m.pos === 'set'); if (cs.length) yield* tgt(g, p, L2, 'Look at which face-down monster?', cs, 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.pos !== 'set') return; log(g, `The face-down monster was ${D(t).n}.`);
      if (isEffMon(t)) destroy(g, [t], { by: p }); else log(g, `${D(t).n} was returned face-down.`); } }] },
  'Bottomless Shifting Sand': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy the highest ATK monster(s)', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp !== c.ctrl,
      cond: g => fieldMons(g).some(faceUp),
      res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; const ms = fieldMons(g).filter(faceUp); if (!ms.length) return; const top = Math.max(...ms.map(m => atk(g, m))); destroy(g, ms.filter(m => atk(g, m) === top), { by: p, src: c }); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Destroy this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && g.p[c.ctrl].hand.length <= 4,
      res: function* (g, c, p) { if (onField(c) && g.p[p].hand.length <= 4) destroy(g, [c], { by: p, rule: true }); } }] },
  'Bowganian': { effs: [{ type: 'trig', mand: true, opt: true, label: '600 damage', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    res: function* (g, c, p) { damage(g, opp(p), 600, { src: c, srcP: p }); } }] },
  'Bubonic Vermin': { effs: [{ type: 'trig', faceDownOk: true, tags: { ss: 1 }, label: 'Special Summon a Bubonic Vermin', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => named(x, 'Bubonic Vermin')),
    res: function* (g, c, p) { const x = g.p[p].deck.find(y => named(y, 'Bubonic Vermin')); if (x && freeM(g, p) >= 0) ss(g, p, x, 'set'); shuffleDeck(g, p); } }] },
  'Buster Blader': { self: { atk: (g, c) => 500 * [...monsOf(g, opp(c.ctrl)).filter(faceUp), ...g.p[opp(c.ctrl)].gy].filter(x => isMon(x) && race(x) === 'Dragon').length }, effs: [] },
  // The boost is added in the Damage Step of its battles. If the equipped monster's ATK goes above 1000 by another effect,
  // Buster Rancher is destroyed (checked at each game event).
  'Buster Rancher': {
    cont: { atk: (g, src, m) => { if (RANCH || src.equipTo !== m.u || !g.inDS || !g.battle || !g.battle.t || !inBattle(g, m)) return 0;
      const o = g.battle.a === m ? g.battle.t : g.battle.a; if (!o || !onField(o) || o.ctrl === m.ctrl) return 0;
      RANCH++; try { return o.pos === 'atk' ? (atk(g, o) >= 2500 ? 2500 : 0) : (def(g, o) >= 2500 ? 2500 : 0); } finally { RANCH--; } } },
    effs: [equipAct((m, g) => atk(g, m) <= 1000, 'Equip to which monster with 1000 or less ATK?'),
      { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
        if (g.f19ranch || !c.equipTo) return false; const m = fieldMons(g).find(x => x.u === c.equipTo); if (!m) return false;
        RANCH++; let a; try { a = atk(g, m); } finally { RANCH--; }
        if (a > 1000) { g.f19ranch = true; try { log(g, `${name(m)} has more than 1000 ATK.`); destroy(g, [c], { rule: true }); } finally { g.f19ranch = false; } }
        return false; } }] },
  // Port of goat-7.js
  'Byser Shock': { effs: [{ type: 'trig', mand: true, label: 'Return all Set cards', on: (g, ev, c) => evSummoned(ev, c),
    cond: g => allField(g).some(x => x.pos === 'set'),
    res: function* (g) { const cs = allField(g).filter(x => x.pos === 'set'); for (const x of cs) move(g, x, 'hand', { reason: 'effect' }); if (cs.length) log(g, `${cs.length} Set card${cs.length > 1 ? 's' : ''} returned to the hand.`); } }] },

  /* ----- C ----- */
  'Cannon Soldier': { effs: [{ type: 'ign', label: 'Tribute: 500 damage', cond: (g, c, p) => monsOf(g, p).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 monster', monsOf(g, p), 1, 1, 'cost'); if (!x) return; const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); },
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  // PARTIAL: the engine's "unaffected by Spells" only covers destruction by Spells.
  'Cannonball Spear Shellfish': { self: { unaffectedSpells: g => umiOn(g) }, effs: [] },
  // The opponent's monster's original ATK becomes 200 for the Damage Step of a battle with this card during their turn.
  'Cat\'s Ear Tribe': { cont: { atk: (g, src, m) => battling(g, src, m) && m.ctrl !== src.ctrl && g.tp === m.ctrl ? 200 - baseAtk(m) : 0 }, effs: [] },
  'Catapult Turtle': { effs: [{ type: 'ign', label: 'Tribute a monster: damage',
    cond: (g, c, p) => monsOf(g, p).length > 0,
    cost: function* (g, c, p, L2) { const [m] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p), 1, 1, 'cost'); if (!m) return;
      L2.data.n = Math.floor(stat(g, m, 'atk') / 2); const nm = m.pos === 'set' ? 'a face-down monster' : name(m);
      move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); },
    res: function* (g, c, p, L2) { if (L2.data.n > 0) damage(g, opp(p), L2.data.n, { src: c, srcP: p }); } }] },
  'Catnipped Kitty': {
    self: { noAttackTarget: (g, c) => monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && race(x) === 'Beast') },
    effs: [{ type: 'ign', opt: true, label: 'Make a monster\'s DEF 0', cond: (g, c, p) => oppFaceUp(g, p).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Make which monster\'s DEF 0?', oppFaceUp(g, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { set: 0, which: 'def', end: true }); log(g, `${name(t)}'s DEF became 0.`); } } }] },
  // canNormal reads "while you control a monster" (engine, 2026-11-26)
  // (the Set-vs-Summon fix in build/ENGINE_TODO.md). The "while you control a monster" part is a forbid for when it can.
  'Cave Dragon': {
    self: { cantAttack: (g, c) => !monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && race(x) === 'Dragon') },
    cont: { loc: 'hand', forbid: (g, src, a) => a.type === 'ns' && a.c === src && monsOf(g, a.p).length > 0 },
    effs: [] },
  // Port of goat-2.js. Flipped monsters are not Flip Summoned and their Flip effects don't activate.
  'Ceasefire': { effs: [{ type: 'act', cond: g => fieldMons(g).some(x => x.pos === 'set' || (faceUp(x) && isEffMon(x))),
    res: function* (g, c, p) { let f = 0; for (const x of fieldMons(g)) if (x.pos === 'set') { x.pos = 'def'; f++; g.seq++; }
      if (f) log(g, 'All face-down monsters were turned face-up.'); const n = fieldMons(g).filter(x => faceUp(x) && isEffMon(x)).length; if (n) damage(g, opp(p), 500 * n, { src: c, srcP: p }); } }] },
  'Cemetary Bomb': { effs: [{ type: 'act',
    res: function* (g, c, p) { const n = g.p[opp(p)].gy.length; if (n) damage(g, opp(p), 100 * n, { src: c, srcP: p }); else log(g, `${PN(g, opp(p))} has no cards in the GY.`); } }] },
  // The Fusion's owner picks and summons a material named on it. PARTIAL: when both players' Fusions go at once, only the
  // first one's owner gets a summon.
  'Centrifugal Field': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'fz', mand: true, tags: { ss: 1 }, label: 'Special Summon a Fusion Material',
      on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.destroyed && !ev.battle && ev.to === 'gy' && ev.c.zone === 'gy' && D(ev.c).k === 'fusion',
      cond: (g, c, p, x) => { const f = x.ev.c, o = f.owner; const ns = [...(tx(f).split('\n')[0] || '').matchAll(/"([^"]+)"/g)].map(m => m[1]); return freeM(g, o) >= 0 && g.p[o].gy.some(y => isMon(y) && ns.includes(D(y).n)); },
      res: function* (g, c, p, L2) { const f = L2.ev.c, o = f.owner; const ns = [...(tx(f).split('\n')[0] || '').matchAll(/"([^"]+)"/g)].map(m => m[1]);
        const cs = g.p[o].gy.filter(y => isMon(y) && ns.includes(D(y).n)); if (!cs.length || freeM(g, o) < 0) return;
        const [x] = yield* pick(g, o, 'Special Summon which Fusion Material from your GY?', cs, 1, 1, 'good'); if (x) ss(g, o, x, 'atk'); } }] },
  // PARTIAL: the hands are shown in the log (each card that enters a hand while it is face-up, and both hands when it lands).
  'Ceremonial Bell': { effs: [{ type: 'trig', res: noop, on: (g, ev, c) => {
    if ((ev.type === 'summon' && ev.cs.includes(c)) || (ev.type === 'flip' && ev.c === c)) for (const q of [0, 1]) log(g, `${PN(g, q)}'s hand: ${g.p[q].hand.map(x => D(x).n).join(', ') || 'empty'}.`);
    else if (ev.type === 'move' && ev.to === 'hand' && ev.c.zone === 'hand') log(g, `Ceremonial Bell: ${PN(g, ev.c.owner)} added ${D(ev.c).n} to the hand.`);
    return false; } }] },
  'Cestus of Dagla': { cont: eqBonus(500, 0), effs: [equipAct(m => race(m) === 'Fairy', 'Equip to which face-up Fairy?'),
    { type: 'trig', loc: 'st', mand: true, label: 'Gain the damage as LP', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src && c.equipTo && ev.src.u === c.equipTo && ev.p === opp(c.ctrl),
      res: function* (g, c, p, L2) { gain(g, p, L2.ev.n); } }] },
});
})();
