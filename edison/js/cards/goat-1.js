/* Goat 1: the four tier A Goat decks (Goat Control, Chaos Turbo, Thunder Dragon Chaos Control, Chaos Control).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md), registered for Goat only (E.addScripts(obj, 'goat')),
 so they win over the shared Edison SCRIPTS of the same name while Goat is loaded and Edison never sees them.
 Each card is written from its 2005 (summer Goat format) behavior, not today's text in goat/data/cards.js:
 Ring of Destruction and Sinister Serpent have no once-per-turn limits (goat/data/lessons-101.js), and so on.
 Thousand-Eyes Restrict is here for Metamorphosis (the guide lists keep it in the Fusion Deck). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, takeControl, setFaceDown, addMod,
  addCtr, ctr, addRule, name, D, isMon, isSpell, isST, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, allField,
  fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, live, opp, oppFaceUp, emit, forbid, stat } = L;

const named = (c, n) => D(c).n === n;
const discardRandom = (g, p) => { const h = g.p[p].hand; if (!h.length) return null; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)} at random.`); return x; };
function* discardPick(g, p, n, text) { const h = g.p[p].hand; if (!h.length) return []; const xs = yield* pick(g, p, text, h, Math.min(n, h.length), Math.min(n, h.length), 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'discard' }); if (xs.length) log(g, `${PN(g, p)} discarded ${xs.map(name).join(', ')}.`); return xs; }
// "Cannot be Special Summoned": blocks a revival from the GY (Call of the Haunted, Premature Burial), the only way these decks could try.
// PARTIAL: one cont per card, so it works from the GY only (the engine has no single "can't be Special Summoned" flag yet, build/ENGINE_TODO.md).
const noSSFromGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src };
// Spirit-style return: "During the End Phase of the turn this card is Normal Summoned or flipped face-up: return it to the hand."
// The summon or flip is noted on the card (flags clear when it leaves the field or is turned face-down).
const spiritReturn = { type: 'trig', mand: true, label: 'Return to the hand',
  on: (g, ev, c) => {
    if ((ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how)) || (ev.type === 'flip' && ev.c === c)) c.flags.spirit = g.turnNo;
    return ev.type === 'phase' && ev.ph === 'end' && c.flags.spirit === g.turnNo;
  },
  res: function* (g, c, p) { if (onField(c) && faceUp(c)) { move(g, c, 'hand', { reason: 'effect' }); log(g, `${name(c)} returned to the hand.`); } } };
// Chaos Sorcerer style summon: banish 1 LIGHT and 1 DARK monster from your GY.
const chaosProc = { label: 'Special Summon (banish a LIGHT and a DARK)',
  cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'LIGHT') && g.p[p].gy.some(x => isMon(x) && attr(x) === 'DARK'),
  cost: function* (g, c, p, grp) {
    const [l] = yield* pick(g, p, 'Banish a LIGHT monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT'), 1, 1, 'cost');
    const [d] = yield* pick(g, p, 'Banish a DARK monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK'), 1, 1, 'cost');
    for (const x of [l, d]) if (x) move(g, x, 'ban', { reason: 'cost', group: grp });
    log(g, `${PN(g, p)} banished ${[l, d].filter(Boolean).map(name).join(' and ')}.`);
  } };
// Thousand-Eyes Restrict / Relinquished: the monster equipped to this card (it sits in a Spell/Trap Zone as an Equip Card).
const eyeEquip = (g, c) => allField(g).find(x => x.zone === 'st' && isMon(x) && x.equipTo === c.u) || null;
const absorb = { type: 'ign', opt: true, label: 'Equip an opponent’s monster',
  cond: (g, c, p) => !eyeEquip(g, c) && freeST(g, p) >= 0 && monsOf(g, opp(p)).length > 0,
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip which of their monsters to this card?', monsOf(g, opp(p)), 1, 1, 'bad'); },
  res: function* (g, c, p, L2) {
    const t = live(L2)[0]; if (!t || t.zone !== 'm' || !onField(c) || eyeEquip(g, c) || freeST(g, p) < 0) return;
    const nm = D(t).n; move(g, t, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p });
    t.equipTo = c.u; t.flags.negated = true; // an Equip Card now: its monster effects don't apply
    log(g, `${nm} was equipped to ${name(c)}.`);
  } };
const absorbSelf = {
  atk: (g, c) => { const e = eyeEquip(g, c); return e ? stat(g, e, 'atk') : 0; },
  def: (g, c) => { const e = eyeEquip(g, c); return e ? stat(g, e, 'def') : 0; },
  // "If this card would be destroyed by battle, destroy the equipped monster instead."
  replaceDestroy: (g, c, o) => { if (!o.battle) return false; const e = eyeEquip(g, c); if (!e) return false; destroy(g, [e], { quietLog: false }); log(g, `${name(c)} survived: the equipped monster was destroyed instead.`); return true; },
};

E.addScripts({
  /* ----- monsters ----- */
  'Airknight Parshath': { self: { piercing: true },
    effs: [{ type: 'trig', mand: true, label: 'Draw 1 card', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
      res: function* (g, c, p) { if (g.p[p].deck.length) draw(g, p, 1); } }] },
  // 2005: Spirit-like return, attacks every opponent's monster once each (engine hooks self.maxAttacks / self.attackOk).
  'Asura Priest': { cont: noSSFromGY,
    self: {
      maxAttacks: (g, c) => { const hit = asuraHit(g, c); const rest = monsOf(g, opp(c.ctrl)).filter(m => !hit.has(m.u)).length; return c.attacks + (rest || (c.attacks ? 0 : 1)); },
      attackOk: (g, c, t) => !asuraHit(g, c).has(t.u),
    },
    effs: [spiritReturn] },
  'Black Luster Soldier - Envoy of the Beginning': { proc: chaosProc,
    self: { cantAttack: (g, c) => c.flags.envoyBanish === g.turnNo },
    // "Once per turn, you can activate 1 of these effects": one shared use (c.flags.envoyUsed).
    effs: [{ type: 'ign', label: 'Banish a monster', tags: {},
      cond: (g, c, p) => c.flags.envoyUsed !== g.turnNo && fieldMons(g).some(x => x !== c),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which monster?', fieldMons(g).filter(x => x !== c), 1, 1, 'bad'); },
      after: (g, c) => { c.flags.envoyUsed = g.turnNo; c.flags.envoyBanish = g.turnNo; },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) { const n = D(t).n; move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${n} was banished.`); } } },
    { type: 'trig', label: 'Attack again', on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.killer === c && ev.to === 'gy' && g.battle && g.battle.a === c && ev.prevCtrl !== c.ctrl,
      cond: (g, c) => c.flags.envoyUsed !== g.turnNo && onField(c),
      after: (g, c) => { c.flags.envoyUsed = g.turnNo; },
      res: function* (g, c) { if (onField(c)) { c.flags.extraAttack = g.turnNo; log(g, `${name(c)} can attack again.`); } } }] },
  'Dark Mimic LV1': { effs: [
    { type: 'trig', mand: true, faceDownOk: true, label: 'Draw 1 card', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
      res: function* (g, c, p) { if (g.p[p].deck.length) draw(g, p, 1); } },
    { type: 'trig', label: 'Send it: summon Dark Mimic LV3', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      cond: (g, c, p) => [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Dark Mimic LV3')),
      cost: function* (g, c) { move(g, c, 'gy', { reason: 'cost' }); },
      res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Dark Mimic LV3')); const [x] = yield* pick(g, p, 'Special Summon Dark Mimic LV3', cs, 1, 1, 'good'); if (x) { const fromDeck = x.zone === 'deck'; if (ss(g, p, x)) x.flags.mimic = true; if (fromDeck) shuffleDeck(g, p); } } }] },
  'Dark Mimic LV3': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Draw', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p, L2) { const n = L2.ev.snap && L2.ev.snap.flags && L2.ev.snap.flags.mimic ? 2 : 1; draw(g, p, Math.min(n, g.p[p].deck.length) || 1); } }] },
  'Magician of Faith': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Add a Spell from the GY', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c, p) => g.p[p].gy.some(isSpell),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Spell from your GY to your hand?', g.p[p].gy.filter(isSpell), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },
  // 2005: "During your Standby Phase, if this card is in your Graveyard, you can return it to your hand." No limit, no banish.
  'Sinister Serpent': { effs: [{ type: 'trig', loc: 'gy', label: 'Return to the hand', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner,
    res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} returned Sinister Serpent to the hand.`); } } }] },
  'Thunder Dragon': { effs: [{ type: 'ign', loc: 'hand', label: 'Discard: add 2 Thunder Dragon',
    cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'Thunder Dragon')) && !forbid(g, { type: 'search', p }),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded Thunder Dragon.`); },
    res: function* (g, c, p) { if (forbid(g, { type: 'search', p })) return; const cs = g.p[p].deck.filter(x => named(x, 'Thunder Dragon')); const xs = yield* pick(g, p, 'Add up to 2 Thunder Dragon to your hand', cs, 1, 2, 'good'); for (const x of xs) move(g, x, 'hand', { reason: 'effect' }); if (xs.length) log(g, `${PN(g, p)} added ${xs.length} Thunder Dragon to the hand.`); shuffleDeck(g, p); } }] },
  // 2005: "By discarding 1 card from your hand, declare 1 Type of monster. Destroy all face-up monsters of the declared Type on the field."
  'Tribe-Infecting Virus': { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Discard: destroy a Type',
    cond: (g, c, p) => g.p[p].hand.length > 0 && fieldMons(g).some(faceUp),
    cost: function* (g, c, p) { yield* discardPick(g, p, 1, 'Discard 1 card'); },
    target: function* (g, c, p, L2) { const types = [...new Set(fieldMons(g).filter(faceUp).map(race))]; // PARTIAL: you declare from the Types face-up on the field (any Type is legal; the others would do nothing)
      const i = types.length > 1 ? yield* choose(g, p, 'Declare which Type?', types) : 0; L2.data.type = types[i]; log(g, `${PN(g, p)} declared ${types[i]}.`); },
    res: function* (g, c, p, L2) { destroy(g, fieldMons(g).filter(x => faceUp(x) && race(x) === L2.data.type), { by: p }); } }] },
  // 2005: mandatory; "change 1 face-up monster on the field to face-down Defense Position", itself included.
  'Tsukuyomi': { cont: noSSFromGY,
    effs: [{ type: 'trig', mand: true, label: 'Turn a monster face-down',
      on: (g, ev, c) => (ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how)) || (ev.type === 'flip' && ev.c === c),
      cond: g => fieldMons(g).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change which face-up monster to face-down Defense Position?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.zone === 'm') setFaceDown(g, t); } },
    spiritReturn] },
  // Counters go on as each Spell resolves (seen when it leaves the Spell/Trap Zone for the GY after resolving), no chain link.
  // PARTIAL: Continuous, Equip and Field Spells stay on the field after resolving, so they don't add a counter.
  'Skilled White Magician': { effs: [
    { type: 'trig', on: (g, ev, c) => { if (ev.type === 'move' && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && isSpell(ev.c) && !['Continuous', 'Equip', 'Field'].includes(D(ev.c).sub) && ctr(c, 'spell') < 3) { addCtr(g, c, 'spell', 1); log(g, `${name(c)} got a Spell Counter (${ctr(c, 'spell')}).`); } return false; }, res: function* () {} },
    { type: 'ign', tags: { ss: 1 }, label: 'Tribute: summon Buster Blader',
      cond: (g, c, p) => ctr(c, 'spell') >= 3 && [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].some(x => named(x, 'Buster Blader')),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed Skilled White Magician.`); },
      res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].filter(x => named(x, 'Buster Blader')); const [x] = yield* pick(g, p, 'Special Summon Buster Blader from your hand, Deck or GY', cs, 1, 1, 'good'); if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x); if (fromDeck) shuffleDeck(g, p); } } }] },
  'Buster Blader': { self: { atk: (g, c) => 500 * [...monsOf(g, opp(c.ctrl)).filter(faceUp), ...g.p[opp(c.ctrl)].gy].filter(x => isMon(x) && race(x) === 'Dragon').length } },
  'Thousand-Eyes Restrict': { self: absorbSelf,
    // "Other monsters on the field cannot change their battle positions or attack."
    // PARTIAL: Flip Summons of other monsters aren't stopped (the engine has no forbid action for a Flip Summon).
    cont: { forbid: (g, src, a) => (a.type === 'attack' || a.type === 'pos') && a.c !== src },
    effs: [absorb] },
  'Relinquished': { self: absorbSelf, effs: [absorb] }, // PARTIAL: the battle damage reflection isn't done (not in the tier A decks)

  /* ----- Spells ----- */
  'Delinquent Duo': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp > 1000 && g.p[opp(p)].hand.length > 0,
    cost: function* (g, c, p) { pay(g, p, 1000); },
    res: function* (g, c, p) { const o = opp(p); discardRandom(g, o); yield* discardPick(g, o, 1, 'Discard 1 card of your choice'); } }] },
  'Graceful Charity': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 3,
    res: function* (g, c, p) { draw(g, p, 3); yield* discardPick(g, p, 2, 'Discard 2 cards'); } }] },
  'Pot of Greed': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 2, res: function* (g, c, p) { draw(g, p, 2); } }] },
  // 2005: "Offer 1 monster on your side of the field as a Tribute. Special Summon 1 Fusion Monster with the same Level ... from your Fusion Deck."
  // The Tribute is a cost, so Sheep Tokens and face-down monsters can be used.
  'Metamorphosis': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(m => metaTargets(g, p, lv(m)).length),
    cost: function* (g, c, p, L2) { const [m] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p).filter(m => metaTargets(g, p, lv(m)).length), 1, 1, 'cost'); L2.data.lv = lv(m); const nm = m.pos === 'set' ? 'a face-down monster' : name(m); move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); },
    res: function* (g, c, p, L2) { const fs = metaTargets(g, p, L2.data.lv); if (!fs.length || freeM(g, p) < 0) return; const [f] = yield* pick(g, p, `Special Summon which Level ${L2.data.lv} Fusion Monster?`, fs, 1, 1, 'good'); if (f) ss(g, p, f, 'atk'); } }] },
  // 2005: "Equip only to a monster your opponent controls. Take control of the equipped monster.
  // During each of your opponent's Standby Phases, they gain 1000 Life Points." Control lasts while it stays equipped.
  'Snatch Steal': { effs: [
    { type: 'act', cond: (g, c, p) => oppFaceUp(g, p).length > 0 && freeM(g, p) >= 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || t.ctrl === p || !onField(c)) return; const from = t.ctrl; if (!takeControl(g, p, t, false)) return; c.equipTo = t.u; c.flags.snatch = { u: t.u, from }; log(g, `Snatch Steal was equipped to ${name(t)}.`); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Opponent gains 1000 LP', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl && !!c.equipTo,
      res: function* (g, c, p) { gain(g, opp(p), 1000); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Control returns', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.flags && ev.snap.flags.snatch,
      res: function* (g, c, p, L2) { const s = L2.ev.snap.flags.snatch; const t = fieldMons(g).find(x => x.u === s.u); if (!t || t.ctrl === s.from) return;
        if (freeM(g, s.from) >= 0) takeControl(g, s.from, t, false); else { move(g, t, 'gy', { reason: 'rule' }); } } }] },

  /* ----- Traps ----- */
  // 2005: "Destroy 1 face-up monster and inflict damage to both players equal to its ATK." Either turn, either side, no limit.
  'Ring of Destruction': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const n = stat(g, t, 'atk');
      if (!destroy(g, [t], { by: p, src: c }).length || n <= 0) return;
      // both players take it at the same time: lower the opponent's LP first, then damage() checks both
      const o = opp(p); g.p[o].lp -= n; log(g, `${PN(g, o)} took ${n} damage.`); emit(g, { type: 'damage', p: o, n, battle: false, src: c, srcP: p });
      damage(g, p, n, { src: c, srcP: p }); } }] },
  'Sakuretsu Armor': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => g.aw && g.aw.a.ctrl !== p,
    target: function* (g, c, p, L2) { L2.t = [g.aw.a]; },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },

  /* ----- 2005 overrides of shared Edison scripts ----- */
  // Scapegoat (2005): "You cannot Normal Summon, Flip Summon or Special Summon the turn you activate this card (you can Set)."
  // The shared script blocks Sets too; here only Summons are blocked.
  'Scapegoat': { effs: [{ type: 'act', cond: (g, c, p) => nFreeM(g, p) >= 4 && !g.summoned[p],
    after: (g, c, p) => {
      addRule(g, (g2, a) => (a.type === 'ns' || a.type === 'ss') && a.p === p, { end: g.turnNo });
      for (const m of monsOf(g, p)) if (m.pos === 'set') m.posChanged = true; // no Flip Summon this turn (a monster Set later this turn can't flip anyway)
    },
    res: function* (g, c, p, L2) { yield* E.SCRIPTS['Scapegoat'].effs[0].res(g, c, p, L2); } }] },
  // Kycoo (2005): "Your opponent cannot remove cards from play from either Graveyard." Goat adds the Chaos summons,
  // which banish from the GY as their cost, to the Edison list of blocked cards.
  'Kycoo the Ghost Destroyer': { cont: { forbid: (g, src, a) => (a.p != null && a.p !== src.ctrl) && (
      (a.type === 'ss' && a.c && a.c.zone === 'hand' && GY_BANISH_SUMMON.includes(D(a.c).n)) ||
      (a.type === 'activate' && GY_BANISH_ACT.includes(D(a.c).n))) },
    get effs() { const s = E.SCRIPTS['Kycoo the Ghost Destroyer']; return s && s.effs ? s.effs : []; } }, // the shared battle-damage banish (batch-1.js), read lazily so load order doesn't matter
}, 'goat');

const GY_BANISH_SUMMON = ['Chaos Sorcerer', 'Black Luster Soldier - Envoy of the Beginning', 'Chaos Emperor Dragon - Envoy of the End', 'Dark Magician of Chaos'];
const GY_BANISH_ACT = ['Kycoo the Ghost Destroyer', 'D.D. Survivor', 'Soul Release', 'Burial from a Different Dimension', 'Bazoo the Soul-Eater', 'Gren Maju Da Eiza'];
function asuraHit(g, c) { return new Set(g.events.filter(e => e.type === 'attack' && e.a === c && e.turn === g.turnNo && e.t).map(e => e.t.u)); }
function metaTargets(g, p, L0) { return g.p[p].extra.filter(f => D(f).k === 'fusion' && lv(f) === L0 && !forbid(g, { type: 'ss', c: f, p, how: 'special' })); }
})();
