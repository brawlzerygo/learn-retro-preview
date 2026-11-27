/* Full pool batch 15: Spell Absorption to Sword of the Soul-Eater (build/batches/full/full-15.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text; cards with a
 Goat-only script elsewhere (Spell Canceller, Spell Economics, Spell Reproduction) are ported here as the shared version. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, search, negate, addMod,
  equip, link, addCtr, ctr, negateAttack, endBattle, addRule,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, allCards, shuffleDeck, log, PN, live, opp, stOnField, spellTrapAct, evSummoned, battleKill, isGemini, stat, emit } = L;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const txt = c => { const d = D(c); return d.ps && !/^No (?:Edison|rulings)/.test(d.ps) ? d.ps : d.tx || ''; };
const isSpiritMon = c => isMon(c) && /Spirit/.test(D(c).ab || '');
const STAYS = ['Continuous', 'Equip', 'Field'];
// A Spell Card has been activated and resolved, read from the moves (as goat-7.js counts Spell Counters): a Normal or
// Quick-Play Spell as it leaves the Spell/Trap Zone for the GY after resolving, a Continuous, Equip or Field Spell as it is
// activated from the hand. Returns the player who activated it, or -1.
// PARTIAL: a Normal Spell whose activation was negated without destroying it still counts, and a Set Continuous, Equip or
// Field Spell flipped face-up to activate does not (the engine has no event for either).
function spellResolvedBy(ev) {
  if (ev.type !== 'move' || !isSpell(ev.c)) return -1;
  const stays = STAYS.includes(D(ev.c).sub);
  if (!stays && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule') return ev.prevCtrl;
  if (stays && ev.from === 'hand' && ev.reason === 'activate') return ev.c.ctrl;
  return -1;
}
// Does this card's effect inflict effect damage? (read from its text, as in full-08.js)
const dmgText = c => /inflict[^.]*damage|damage[^.]*(?:to your opponent|to you\b|to each player|to both players|to its controller|to the controller)|takes? [^.]*damage/i.test(txt(c).replace(/(?:piercing )?battle damage/gi, ''));
const dmgLink = L2 => !!L2 && !L2.negated && dmgText(L2.c);
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'atk' }); };
function* discardPick(g, p, n, text, not) { const h = g.p[p].hand.filter(x => x !== not); if (h.length < n) return []; const xs = yield* pick(g, p, text, h, n, n, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'cost' }); if (xs.length) log(g, `${PN(g, p)} discarded ${xs.map(name).join(', ')}.`); return xs; }
const tribute = (g, p, x) => { move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); };
// Equip Spells
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?', mine = false) => ({ type: 'act',
  cond: (g, c, p) => (mine ? monsOf(g, p) : fieldMons(g)).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, (mine ? monsOf(g, p) : fieldMons(g)).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c) && equip(g, c, t)) c.flags.eqTo = t.u; } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
// "When the equipped monster is <moved> and this card is sent to the GY": this card went from the S/T Zone to the GY
// in the same move as the monster it was equipped to (ev.snap.flags.eqTo, set on equipping).
const sentWithEquipped = (g, ev, c, test) => ev.type === 'move' && ev.c === c && ev.from === 'st' && ev.to === 'gy' && ev.snap && ev.snap.flags.eqTo &&
  g.events.some(e => e.type === 'move' && e.c.u === ev.snap.flags.eqTo && e.wasField && e.group === ev.group && test(e));
// Union monsters (as full-02.js): once per turn equip to a monster you control, or unequip and Special Summon in Attack
// Position; one Union per monster; "if the equipped monster would be destroyed, destroy this card instead".
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
const unionReplace = (g, src, m, o) => {
  if (o.rule || src.zone !== 'st' || src.equipTo !== m.u || !src.flags.union) return false;
  move(g, src, 'gy', { reason: o.battle ? 'battle' : 'effect', destroyed: true, by: o.by }); log(g, `${D(src).n} was destroyed instead of ${name(m)}.`); return true; };
// Special Summon "ignoring the Summoning conditions" (Spell Gear): the full-01.js rule that stops Ancient Gear Golem from
// being Special Summoned is set aside for this one summon; every other lock still applies.
function ssIgnoring(g, p, x, pos) {
  const off = g.rules.filter(r => /ssBlocked/.test(String(r.forbid)));
  g.rules = g.rules.filter(r => !off.includes(r)); g._st = null;
  try { return ss(g, p, x, pos); } finally { g.rules.push(...off); g._st = null; }
}
// Spirit of the Pharaoh: only by "The First Sarcophagus" (read from the game: that card left the field this turn).
// ENGINE: "can't be Special Summoned" has no generic flag; this one duel-long rule stands in.
// PARTIAL: any Special Summon of it from the hand or Deck in the turn The First Sarcophagus left the field is allowed.
const sarcOk = g => g.events.some(e => e.type === 'move' && e.turn === g.turnNo && e.wasField && named(e.c, 'The First Sarcophagus'));
const pharaohLock = { type: 'trig', loc: 'any', res: noop, on: (g) => {
  if (!g.f15pharaoh) { g.f15pharaoh = true; addRule(g, (g2, a) => a.type === 'ss' && a.c && a.c.id != null && D(a.c) && named(a.c, 'Spirit of the Pharaoh') && !(['hand', 'deck'].includes(a.c.zone) && sarcOk(g2))); }
  return false; } };
// Spell Reclamation: the Spell Cards it watches ({u, by}: the card and the Spell Reclamation that watches it)
const reclaimList = g => g.f15reclaim || (g.f15reclaim = []);

E.addScripts({
  /* ----- Spells and Traps about Spells ----- */
  // A Continuous Effect: the LP is gained with no chain link. It doesn't count its own activation.
  'Spell Absorption': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
      if (ev.c === c || !faceUp(c)) return false;
      if (spellResolvedBy(ev) >= 0) gain(g, c.ctrl, 500);
      return false; } }] },
  // No activation of its own: it is Set, and works from the GY once destroyed there by the opponent's Spell or Trap.
  // PARTIAL: "by the effect of a Spell or Trap Card" is read as: destroyed by the opponent while they have a face-up
  // Normal or Quick-Play Spell, or Normal or Counter Trap, on the field (the card that is resolving).
  'Spell Calling': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Set a Quick-Play Spell from your Deck',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !ev.battle && ev.snap && !ev.snap.faceUp && ev.by === opp(c.owner) &&
      stOf(g, opp(c.owner)).some(x => faceUp(x) && ((isSpell(x) && ['Normal', 'Quick-Play'].includes(D(x).sub)) || (isTrap(x) && ['Normal', 'Counter'].includes(D(x).sub)))),
    cond: (g, c, p) => freeST(g, p) >= 0 && g.p[p].deck.some(x => isSpell(x) && D(x).sub === 'Quick-Play'),
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isSpell(x) && D(x).sub === 'Quick-Play'); if (!cs.length || freeST(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Set which Quick-Play Spell from your Deck?', cs, 1, 1, 'good');
      if (x) { log(g, `${PN(g, p)} showed ${name(x)} and Set it.`); move(g, x, 'st', { ctrl: p, pos: 'set', reason: 'set' }); } shuffleDeck(g, p); } }] },
  // Spell Cards can't be activated, nor their effects on the field; Spell effects on the field are negated. GY effects work.
  'Spell Canceller': { cont: {
    forbid: (g, src, a) => a.type === 'activate' && a.c && isSpell(a.c) && a.c.zone !== 'gy',
    negates: (g, src, c) => isSpell(c) && onField(c) } },
  'Spell Chronicle': { effs: [
    { type: 'act', cond: (g, c, p) => g.p[p].deck.filter(isST).length >= 5,
      cost: function* (g, c, p) { const h = g.p[p].hand.filter(x => x !== c); for (const x of h) move(g, x, 'gy', { reason: 'cost' }); if (h.length) log(g, `${PN(g, p)} sent ${h.length} card${h.length > 1 ? 's' : ''} from the hand to the GY.`); },
      res: function* (g, c, p) { const cs = g.p[p].deck.filter(isST); const xs = yield* pick(g, p, 'Banish 5 Spells/Traps from your Deck', cs, Math.min(5, cs.length), Math.min(5, cs.length), 'good');
        for (const x of xs) { move(g, x, 'ban', { reason: 'effect' }); x.flags.chron = c.u; }
        shuffleDeck(g, p); if (xs.length) log(g, `${PN(g, p)} banished ${xs.map(name).join(', ')} face-up.`); if (onField(c)) c.flags.chronOn = true; } },
    // Chronicle Counters and the damage on leaving the field happen with no chain link (rulings).
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (onField(c) && faceUp(c) && c.flags.chronOn && ev.c !== c && spellResolvedBy(ev) === opp(c.ctrl)) { addCtr(g, c, 'chronicle', 1); log(g, `${name(c)} got a Chronicle Counter (${ctr(c, 'chronicle')}).`); }
      if (ev.type === 'move' && ev.c === c && ev.wasField && ev.from === 'st' && ev.snap && ev.snap.faceUp && ev.snap.flags.chronOn) {
        const n = g.p[c.owner].ban.filter(x => x.flags.chron === c.u).length;
        if (n) damage(g, ev.prevCtrl, 500 * n, { src: c, srcP: ev.prevCtrl });
      }
      return false; } },
    { type: 'ign', loc: 'st', label: 'Remove 2 Chronicle Counters: add a banished card',
      cond: (g, c, p) => ctr(c, 'chronicle') >= 2 && g.p[p].ban.some(x => x.flags.chron === c.u),
      cost: function* (g, c) { addCtr(g, c, 'chronicle', -2); log(g, `2 Chronicle Counters were removed from ${name(c)}.`); },
      res: function* (g, c, p) { const cs = g.p[p].ban.filter(x => x.flags.chron === c.u); if (!cs.length) return;
        const [x] = yield* pick(g, opp(p), 'Spell Chronicle: choose a banished card for your opponent to add to the hand', cs, 1, 1, 'cost');
        if (x) { delete x.flags.chron; move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(x)} to the hand.`); } } }] },
  // ENGINE: there is no hook for paying LP to activate a Spell Card, so this card does nothing yet (goat-6.js has the same
  // stand-in, with Toon World checking it by hand).
  'Spell Economics': { effs: [{ type: 'act', res: noop }] },
  'Spell Gear': { effs: [{ type: 'act', tags: { ss: 1, destroy: 1 },
    cond: (g, c, p) => fieldOf(g, p).filter(x => x !== c && faceUp(x) && /Ancient Gear/.test(name(x))).length >= 3 && g.p[p].deck.some(x => named(x, 'Ancient Gear Golem')),
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Send 3 "Ancient Gear" cards you control to the GY', fieldOf(g, p).filter(x => x !== c && faceUp(x) && /Ancient Gear/.test(name(x))), 3, 3, 'cost');
      for (const x of xs) move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${xs.map(x => D(x).n).join(', ')} to the GY.`); },
    res: function* (g, c, p) {
      for (const z of ['hand', 'deck']) {
        const cs = g.p[p][z].filter(x => named(x, 'Ancient Gear Golem')); if (!cs.length || freeM(g, p) < 0) continue;
        if (!(yield* yn(g, p, `Special Summon Ancient Gear Golem from your ${z === 'hand' ? 'hand' : 'Deck'}?`))) continue;
        ssIgnoring(g, p, cs[0], 'atk'); if (z === 'deck') shuffleDeck(g, p);
      }
      destroy(g, monsOf(g, p).filter(x => !(faceUp(x) && named(x, 'Ancient Gear Golem'))), { by: p, src: c });
      addRule(g, (g2, a) => (a.type === 'ns' || a.type === 'set') && a.p === p, { end: g.turnNo + 2 });
      log(g, `${PN(g, p)} can't Normal Summon or Set until the end of the next turn.`); } }] },
  // ENGINE: reflecting effect damage has no hook; a GY damage hook (as Energy-Absorbing Monolith in full-08.js) sends the
  // damage of the link it chains to over to the opponent. PARTIAL: "an effect that would inflict damage" is read from the text.
  'Spell of Pain': {
    cont: { loc: 'gy', dmg: (g, src, p, n, o) => {
      if (o.battle || o.f15pain || !g.f15pain) return undefined;
      const e = g.f15pain.find(x => x.p === p && x.grp === g.group); if (!e) return undefined;
      log(g, `Spell of Pain: ${PN(g, opp(p))} takes the damage instead.`); damage(g, opp(p), n, { src: src, srcP: p, f15pain: true }); return 0; } },
    effs: [{ type: 'act', cond: (g, c, p, x) => !g.inDS && !!x.top && x.top.p !== p && dmgLink(x.top),
      res: function* (g, c, p) { (g.f15pain || (g.f15pain = [])).push({ p, grp: g.group + 1 }); if (g.f15pain.length > 8) g.f15pain.shift(); log(g, `${PN(g, p)} will send that damage back.`); } }] },
  'Spell Power Grasp': (() => { const can = x => faceUp(x) && /Spell Counter/.test(txt(x));
    return { effs: [{ type: 'act', cond: (g, c, p) => !(g.f15spg && g.f15spg[p] === g.turnNo) && allField(g).some(x => x !== c && can(x)),
      after: (g, c, p) => { (g.f15spg || (g.f15spg = [0, 0]))[p] = g.turnNo; },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Place a Spell Counter on which card?', allField(g).filter(x => x !== c && can(x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !can(t)) return; addCtr(g, t, 'spell', 1); log(g, `A Spell Counter was placed on ${name(t)}.`);
        if (g.p[p].deck.some(x => named(x, 'Spell Power Grasp')) && (yield* yn(g, p, 'Add a Spell Power Grasp from your Deck to your hand?'))) yield* search(g, p, x => named(x, 'Spell Power Grasp'), 'Add Spell Power Grasp'); } }],
    }; })(),
  'Spell Purification': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.p[p].hand.length > 0 && stOnField(g).some(x => faceUp(x) && isSpell(x) && D(x).sub === 'Continuous'),
    cost: function* (g, c, p) { yield* discardPick(g, p, 1, 'Discard 1 card'); },
    res: function* (g, c, p) { destroy(g, stOnField(g).filter(x => faceUp(x) && isSpell(x) && D(x).sub === 'Continuous'), { by: p, src: c }); } }] },
  'Spell Reactor RE': { effs: [{ type: 'quick', opt: true, tags: { destroy: 1 }, label: 'Destroy that Spell: 800 damage',
    cond: (g, c, p, x) => spellTrapAct(x.top) && isSpell(x.top.c) && x.top.p !== p && onField(x.top.c),
    target: function* (g, c, p, L2) { L2.t = [g.chain[g.chain.length - 1].c]; },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && destroy(g, [t], { by: p }).length) damage(g, opp(p), 800, { src: c, srcP: p }); } }] },
  // The watched Spell returns to its owner's hand the first time it goes from the field to the GY (no chain link).
  'Spell Reclamation': { effs: [
    { type: 'act', cond: (g, c, p, x) => spellTrapAct(x.top) && isSpell(x.top.c) && x.top.p === p && g.p[p].hand.length > 0,
      cost: function* (g, c, p) { yield* discardPick(g, p, 1, 'Discard 1 card'); },
      target: function* (g, c, p, L2) { L2.data.s = g.chain[g.chain.length - 1].c; },
      res: function* (g, c, p, L2) { const s = L2.data.s; if (s && onField(s)) { reclaimList(g).push({ u: s.u, by: c.u }); log(g, `${name(s)} will return to the hand when it is sent to the GY.`); } } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (ev.type !== 'move' || !ev.wasField || !g.f15reclaim) return false;
      const i = g.f15reclaim.findIndex(e => e.u === ev.c.u && e.by === c.u); if (i < 0) return false;
      g.f15reclaim.splice(i, 1);
      if (ev.to === 'gy' && ev.c.zone === 'gy') { move(g, ev.c, 'hand', { reason: 'effect' }); log(g, `${name(ev.c)} returned to its owner's hand (Spell Reclamation).`); }
      return false; } }] },
  'Spell Reproduction': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.filter(x => x !== c && isSpell(x)).length >= 2 && g.p[p].gy.some(isSpell),
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Send 2 Spells from your hand to the GY', g.p[p].hand.filter(x => x !== c && isSpell(x)), 2, 2, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${xs.map(name).join(' and ')} to the GY.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Spell from your GY to your hand?', g.p[p].gy.filter(isSpell), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },
  'Spell Shattering Arrow': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => stOf(g, opp(p)).some(x => faceUp(x) && isSpell(x)),
    res: function* (g, c, p) { const n = destroy(g, stOf(g, opp(p)).filter(x => faceUp(x) && isSpell(x)), { by: p, src: c }).length; if (n) damage(g, opp(p), 500 * n, { src: c, srcP: p }); } }] },
  'Spell Shield Type-8': (() => { const one = top => top.t.length === 1 && isMon(top.t[0]) && onField(top.t[0]);
    return { effs: [{ type: 'act',
      cond: (g, c, p, x) => spellTrapAct(x.top) && isSpell(x.top.c) && !x.top.negated && (one(x.top) || g.p[p].hand.some(y => y !== c && isSpell(y))),
      cost: function* (g, c, p, L2) { const top = g.chain[g.chain.length - 1]; const ok = [one(top), g.p[p].hand.some(y => y !== c && isSpell(y))];
        let m = ok[0] ? 0 : 1; if (ok[0] && ok[1]) m = yield* choose(g, p, 'Spell Shield Type-8: choose an effect', ['Negate a Spell that targets 1 monster', 'Send a Spell from your hand: negate a Spell']);
        if (m === 1) { const [y] = yield* pick(g, p, 'Send 1 Spell Card from your hand to the GY', g.p[p].hand.filter(y => y !== c && isSpell(y)), 1, 1, 'cost'); if (y) { move(g, y, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(y)} to the GY.`); } }
        L2.data.L = top; },
      res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] }; })(),
  'Spell Striker': { self: { directAttack: true, noBattleDamage: true },
    proc: { label: 'Special Summon (banish a Spell from your GY)', cond: (g, c, p) => g.p[p].gy.some(isSpell),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish 1 Spell Card from your GY', g.p[p].gy.filter(isSpell), 1, 1, 'cost'); move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${name(x)}.`); } } },
  'Spell Vanishing': { effs: [{ type: 'act', cond: (g, c, p, x) => spellTrapAct(x.top) && isSpell(x.top.c) && !x.top.negated && g.p[p].hand.filter(y => y !== c).length >= 2,
    cost: function* (g, c, p, L2) { yield* discardPick(g, p, 2, 'Discard 2 cards', c); L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L, n = D(T.c).n; T.negBy = p; negate(g, T, true);
      const o = opp(p); log(g, `${PN(g, p)} looked at ${PN(g, o)}'s hand and Deck.`);
      const xs = [...g.p[o].hand, ...g.p[o].deck].filter(y => isSpell(y) && D(y).n === n);
      for (const y of xs) move(g, y, 'gy', { reason: 'effect', by: p }); shuffleDeck(g, o);
      if (xs.length) log(g, `${xs.length} cop${xs.length > 1 ? 'ies' : 'y'} of ${n} went to the GY.`); } }] },
  'Spell-Stopping Statute': { effs: [{ type: 'act', cond: (g, c, p, x) => spellTrapAct(x.top) && isSpell(x.top.c) && D(x.top.c).sub === 'Continuous' && x.top.p !== p && !x.top.negated,
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },

  /* ----- Spirit ----- */
  'Spirit Barrier': { effs: [{ type: 'act', res: noop }],
    cont: { dmg: (g, src, p, n, o) => o.battle && p === src.ctrl && monsOf(g, p).length > 0 ? 0 : undefined } },
  'Spirit Burner': { effs: [equipAct(),
    { type: 'ign', loc: 'st', opt: true, label: 'Change the equipped monster to Defense Position',
      cond: (g, c) => fieldMons(g).some(m => m.u === c.equipTo && faceUp(m) && m.pos === 'atk'),
      res: function* (g, c) { const m = fieldMons(g).find(x => x.u === c.equipTo); if (m) toDef(g, m); } },
    { type: 'trig', loc: 'gy', mand: true, label: '600 damage', on: (g, ev, c) => sentWithEquipped(g, ev, c, e => e.to === 'hand' || e.to === 'extra'),
      res: function* (g, c, p) { damage(g, opp(p), 600, { src: c, srcP: p }); } },
    // PARTIAL: the normal draw happens, then the drawn card goes back on top of the Deck and this card is added instead.
    { type: 'trig', loc: 'gy', label: 'Add this card instead of the normal draw',
      on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && g.phase === 'draw' && g.tp === c.owner && ev.c.owner === c.owner && ev.turn === g.turnNo,
      res: function* (g, c, p, L2) { if (c.zone !== 'gy') return; const x = L2.ev.c; if (x.zone === 'hand') move(g, x, 'deckTop', { reason: 'effect' });
        move(g, c, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added Spirit Burner to the hand instead of drawing.`); } }] },
  'Spirit Caller': { effs: [{ type: 'trig', faceDownOk: true, tags: { ss: 1 }, label: 'Special Summon a Level 3 or lower Normal Monster',
    on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => D(x).k === 'normal' && lv(x) <= 3),
    res: function* (g, c, p) { const cs = g.p[p].gy.filter(x => D(x).k === 'normal' && lv(x) <= 3); if (!cs.length) return; const [x] = yield* pick(g, p, 'Special Summon which Normal Monster?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  // ENGINE: banishing from the GY has no replacement hook, so the substitutes on the field are not used.
  // PARTIAL: the card resolves and is logged, with no effect.
  // PARTIAL: the engine has no hook to swap a banish as it happens, so the swap is made right after: the monster banished
  // from your GY goes back to the GY and you banish a monster you control instead (one that shares its Attribute and Type
  // first, so a cost like "banish 1 FIRE monster" stays met). With no monster on your field the GY banish stands.
  'Spirit Elimination': { effs: [{ type: 'act', res: function* (g, c, p) { (g.f15elim || (g.f15elim = [null, null]))[p] = { turn: g.turnNo, u: c.u }; log(g, 'Monsters banished from the GY this turn would come from the field instead.'); } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Banish a monster you control instead',
      on: (g, ev, c) => { const e = g.f15elim && g.f15elim[c.owner]; return !!e && e.u === c.u && e.turn === g.turnNo && ev.type === 'move' && ev.from === 'gy' && ev.to === 'ban' && isMon(ev.c) && ev.c.owner === c.owner && !ev.f15elim; },
      res: function* (g, c, p) {
        const xs = g.events.filter(e => e.type === 'move' && e.from === 'gy' && e.to === 'ban' && isMon(e.c) && e.c.owner === p && e.c.zone === 'ban' && e.turn === g.turnNo && e.c.flags.f15elim !== g.turnNo).map(e => e.c);
        const x = xs[xs.length - 1]; const mons = monsOf(g, p);
        if (!x || !mons.length) return;
        x.flags.f15elim = g.turnNo;
        const both = mons.filter(m => attr(m) === attr(x) && race(m) === race(x)), one = mons.filter(m => attr(m) === attr(x) || race(m) === race(x));
        const cs = both.length ? both : one.length ? one : mons;
        const [m] = yield* pick(g, p, `Spirit Elimination: banish a monster you control instead of ${name(x)}`, cs, 1, 1, 'cost'); if (!m) return;
        move(g, x, 'gy', { reason: 'rule', f15elim: true }); move(g, m, 'ban', { reason: 'effect', by: p, f15elim: true });
        log(g, `${name(x)} went back to the GY and ${PN(g, p)} banished ${name(m)} instead (Spirit Elimination).`); } }] },
  // PARTIAL: there is no window at damage calculation, so it is used in the Damage Step; the battle damage is 0 for the
  // rest of that battle.
  'Spirit Force': { effs: [{ type: 'act', ds: true, cond: (g, c, p) => g.tp !== p && g.inDS && !!g.battle,
      res: function* (g, c, p) { g.f15sf = { u: c.u, p, turn: g.turnNo, prev: g.p[p].noBattleDamage }; g.p[p].noBattleDamage = g.turnNo; log(g, `${PN(g, p)} takes no battle damage from this battle.`);
        const cs = g.p[p].gy.filter(x => isMon(x) && D(x).tu && race(x) === 'Warrior' && stat(g, x, 'def') <= 1500);
        if (cs.length && (yield* yn(g, p, 'Add a Warrior Tuner with 1500 or less DEF from your GY to your hand?'))) { const [x] = yield* pick(g, p, 'Add which Warrior Tuner?', cs, 1, 1, 'good'); if (x) { move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(x)} to the hand.`); } } } },
    { type: 'trig', loc: 'gy', res: noop, on: (g, ev, c) => { const e = g.f15sf; if (ev.type === 'dsEnd' && e && e.u === c.u && e.turn === g.turnNo) { g.f15sf = null; if (g.p[e.p].noBattleDamage === g.turnNo) g.p[e.p].noBattleDamage = e.prev; } return false; } }] },
  // Placed only by Destiny Board, never activated.
  // ENGINE: Destiny Board (full-06.js) looks for the Goat names ('Spirit Message "I"'), so in Edison it doesn't place these.
  'Spirit Message A': { effs: [] },
  'Spirit Message I': { effs: [] },
  'Spirit Message L': { effs: [] },
  'Spirit Message N': { effs: [] },
  // The engine reads "Cannot be Normal Summoned/Set" from the text. ENGINE: "must first be Special Summoned" has no flag,
  // so other effects can still Special Summon it.
  'Spirit of Flames': { self: { atk: (g, c) => g.phase === 'battle' && g.tp === c.ctrl ? 300 : 0 },
    proc: { label: 'Special Summon (banish a FIRE from your GY)', cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'FIRE'),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish 1 FIRE monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'FIRE'), 1, 1, 'cost'); move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${name(x)}.`); } } },
  'Spirit of the Breeze': { effs: [{ type: 'trig', mand: true, label: 'Gain 1000 LP', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.pos === 'atk',
    res: function* (g, c, p) { if (onField(c) && faceUp(c) && c.pos === 'atk') gain(g, p, 1000); } }] },
  'Spirit of the Pharaoh': { effs: [pharaohLock,
    { type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon up to 4 Zombie Normal Monsters', on: (g, ev, c) => evSummoned(ev, c, ['special']),
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => D(x).k === 'normal' && race(x) === 'Zombie' && lv(x) <= 2),
      target: function* (g, c, p, L2) { const cs = g.p[p].gy.filter(x => D(x).k === 'normal' && race(x) === 'Zombie' && lv(x) <= 2); yield* tgt(g, p, L2, 'Special Summon which Zombie Normal Monsters?', cs, 1, Math.min(4, cs.length, g.p[p].m.filter(z => !z).length), 'good'); },
      res: function* (g, c, p, L2) { for (const t of L2.t) if (t.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, t, 'atk'); } }] },
  // Activated after Pot of Greed resolves (ruling): seen as Pot of Greed goes to the GY after resolving.
  'Spirit of the Pot of Greed': { effs: [{ type: 'trig', mand: true, label: 'Draw 1 more card',
    on: (g, ev, c) => c.pos === 'atk' && ev.type === 'move' && named(ev.c, 'Pot of Greed') && spellResolvedBy(ev) >= 0,
    res: function* (g, c, p, L2) { if (!onField(c) || !faceUp(c) || c.pos !== 'atk') return; const q = L2.ev.prevCtrl;
      if (g.p[q].deck.length && (yield* yn(g, q, 'Draw 1 more card (Spirit of the Pot of Greed)?'))) draw(g, q, 1); } }] },
  'Spirit of the Six Samurai': { cont: { replaceDestroy: unionReplace,
      atk: (g, src, m) => src.zone === 'st' && src.flags.union && src.equipTo === m.u ? 500 : 0,
      def: (g, src, m) => src.zone === 'st' && src.flags.union && src.equipTo === m.u ? 500 : 0 },
    effs: [...unionEffs(x => /Six Samurai/.test(name(x)), 'Equip Spirit of the Six Samurai to which "Six Samurai" monster?'),
      { type: 'trig', loc: 'st', mand: true, label: 'Draw 1 card',
        on: (g, ev, c) => c.flags.union && ev.type === 'move' && ev.battle && ev.killer && ev.killer.u === c.equipTo && ev.to === 'gy' && ev.prevCtrl !== c.ctrl,
        res: function* (g, c, p) { draw(g, p, 1); } }] },
  // The bonus lasts until the end of the Battle Phase.
  'Spirit Ryu': { effs: [
    { type: 'quick', label: 'Discard a Dragon: +1000 ATK/DEF',
      cond: (g, c, p) => g.tp === p && g.phase === 'battle' && !g.inDS && !!g.aw && (g.aw.a === c || g.aw.t === c) && g.p[p].hand.some(x => isMon(x) && race(x) === 'Dragon'),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 Dragon monster', g.p[p].hand.filter(x => isMon(x) && race(x) === 'Dragon'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 1000, def: 1000, end: true, ryu: true }); log(g, `${name(c)} gained 1000 ATK and DEF.`); } } },
    { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'bpEnd') c.mods = c.mods.filter(m => !m.ryu); return false; } }] },
  // Spirit monsters' End Phase returns (each one's own mandatory trigger) are stopped while this card is face-up.
  // PARTIAL: the return is spotted as a Spirit monster's mandatory trigger in the End Phase of the turn it was summoned or
  // flipped (c.flags.spirit) or one labeled as a return to the hand.
  'Spiritual Energy Settle Machine': {
    cont: { forbid: (g, src, a) => a.type === 'activate' && a.eff && a.eff.type === 'trig' && a.eff.mand && g.phase === 'end' && a.c && a.c.zone === 'm' && isSpiritMon(a.c) &&
      (a.c.flags.spirit === g.turnNo || /hand/i.test(a.eff.label || '')) },
    effs: [{ type: 'act', res: noop },
      { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Discard 1 card or destroy this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
        res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].hand.length && (yield* yn(g, p, 'Discard 1 card to keep Spiritual Energy Settle Machine?'))) yield* discardPick(g, p, 1, 'Discard 1 card'); else destroy(g, [c], { by: p }); } },
      { type: 'trig', loc: 'any', mand: true, label: 'Return all face-up Spirit monsters',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.faceUp && fieldMons(g).some(x => faceUp(x) && isSpiritMon(x)),
        res: function* (g) { const xs = fieldMons(g).filter(x => faceUp(x) && isSpiritMon(x)); for (const x of xs) move(g, x, 'hand', { reason: 'effect' }); if (xs.length) log(g, `${xs.map(x => D(x).n).join(', ')} returned to the hand.`); } }] },
  // Applied automatically, once each turn.
  'Spiritual Forest': { effs: [{ type: 'act', res: noop }],
    cont: { replaceDestroy: (g, src, m, o) => {
      if (!o.battle || m.ctrl !== src.ctrl || !faceUp(m) || !['Beast', 'Beast-Warrior', 'Plant'].includes(race(m)) || src.flags.forest === g.turnNo) return false;
      src.flags.forest = g.turnNo; log(g, `${name(m)} was not destroyed (Spiritual Forest).`); return true; } } },

  /* ----- Super ----- */
  'Super Conductor Tyranno': { cont: { forbid: (g, src, a) => a.type === 'attack' && a.c === src && src.flags.tyrUsed === g.turnNo },
    effs: [{ type: 'ign', opt: true, label: 'Tribute a monster: 1000 damage', cond: (g, c, p) => monsOf(g, p).length > 0,
      after: (g, c) => { c.flags.tyrUsed = g.turnNo; },
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 monster', monsOf(g, p), 1, 1, 'cost'); if (x) tribute(g, p, x); },
      res: function* (g, c, p) { damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },
  // PARTIAL: the Normal Summon from this effect gets no summon negation window. The return in the End Phase has no chain link.
  'Super Double Summon': { effs: [
    { type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isGemini(x) && !x.flags.gemini),
      res: function* (g, c, p) { const cs = monsOf(g, p).filter(x => faceUp(x) && isGemini(x) && !x.flags.gemini); if (!cs.length) return;
        const [x] = yield* pick(g, p, 'Normal Summon which Gemini monster?', cs, 1, 1, 'good'); if (!x || !onField(x)) return;
        x.flags.gemini = true; x.flags.sdsRet = g.turnNo; log(g, `${PN(g, p)} Normal Summoned ${name(x)} again (Gemini).`);
        const ev = emit(g, { type: 'summon', cs: [x], how: 'gemini', p, byEffect: true }); g.sw = { cs: [x], p, how: 'gemini', group: ev.group }; } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (ev.type === 'phase' && ev.ph === 'end') for (const x of fieldMons(g).filter(m => faceUp(m) && m.flags.sdsRet === g.turnNo)) { move(g, x, 'hand', { reason: 'effect' }); log(g, `${D(x).n} returned to the hand.`); }
      return false; } }] },
  // ENGINE: attack redirects; the battle is worked out inside the card (no Damage Step, no flips).
  'Super Junior Confrontation': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!(g.aw && g.aw.a && g.aw.a.ctrl !== p) && monsOf(g, p).some(x => faceUp(x) && x.pos === 'def') && monsOf(g, opp(p)).some(x => x.pos === 'atk'),
    res: function* (g, c, p) {
      negateAttack(g); log(g, 'The battle was negated.');
      const lowest = (xs, f) => { const m = Math.min(...xs.map(f)); return xs.filter(x => f(x) === m); };
      const as = monsOf(g, opp(p)).filter(x => x.pos === 'atk' && faceUp(x)), ds = monsOf(g, p).filter(x => faceUp(x) && x.pos === 'def');
      if (as.length && ds.length) {
        const al = lowest(as, x => stat(g, x, 'atk')), dl = lowest(ds, x => stat(g, x, 'def'));
        const [a] = al.length > 1 ? yield* pick(g, p, 'Which of their monsters battles?', al, 1, 1, 'bad') : al;
        const [d] = dl.length > 1 ? yield* pick(g, p, 'Which of your monsters battles?', dl, 1, 1, 'good') : dl;
        const A = stat(g, a, 'atk'), Dv = stat(g, d, 'def'); log(g, `${name(a)} battles ${name(d)}.`);
        if (A > Dv) destroy(g, [d], { battle: true, killer: a, by: opp(p) });
        else if (A < Dv) damage(g, opp(p), Dv - A, { battle: true, src: d, srcP: p });
      }
      endBattle(g); } }] },
  // PARTIAL: the monster summoned by this effect can still be revived (the engine doesn't track "properly summoned").
  'Super Robolady': { self: { atk: (g, c) => g.inDS && g.battle && g.battle.a === c && !g.battle.t ? 1000 : 0 },
    effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Return this card: Special Summon Super Roboyarou',
      cond: (g, c, p) => c.turnIn !== g.turnNo && g.p[p].extra.some(x => named(x, 'Super Roboyarou')),
      cost: function* (g, c, p) { move(g, c, 'extra', { reason: 'cost' }); log(g, `${PN(g, p)} returned Super Robolady to the Extra Deck.`); },
      res: function* (g, c, p) { const x = g.p[p].extra.find(y => named(y, 'Super Roboyarou')); if (x) ss(g, p, x, 'atk'); } }] },
  'Super Roboyarou': { self: { atk: (g, c) => g.inDS && g.battle && ((g.battle.a === c && g.battle.t) || g.battle.t === c) ? 1000 : 0 },
    effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Return this card: Special Summon Super Robolady',
      cond: (g, c, p) => c.turnIn !== g.turnNo && g.p[p].extra.some(x => named(x, 'Super Robolady')),
      cost: function* (g, c, p) { move(g, c, 'extra', { reason: 'cost' }); log(g, `${PN(g, p)} returned Super Roboyarou to the Extra Deck.`); },
      res: function* (g, c, p) { const x = g.p[p].extra.find(y => named(y, 'Super Robolady')); if (x) ss(g, p, x, 'atk'); } }] },
  'Super Solar Nutrient': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => c.zone === 'hand' && monsOf(g, p).some(x => faceUp(x) && race(x) === 'Plant' && lv(x) <= 2),
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Tribute 1 Level 2 or lower Plant monster', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Plant' && lv(x) <= 2), 1, 1, 'cost'); L2.data.lv = lv(x); tribute(g, p, x); },
    res: function* (g, c, p, L2) { const max = (L2.data.lv || 0) + 3; const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => isMon(x) && race(x) === 'Plant' && lv(x) <= max && !['fusion', 'synchro', 'ritual'].includes(D(x).k));
      let t = null; if (cs.length && freeM(g, p) >= 0 && onField(c)) { [t] = yield* pick(g, p, `Special Summon a Level ${max} or lower Plant from your hand or Deck`, cs, 1, 1, 'good'); const fromDeck = t && t.zone === 'deck'; if (t && !ss(g, p, t, 'atk')) t = null; if (fromDeck) shuffleDeck(g, p); }
      if (t && onField(c)) link(g, c, t); else if (onField(c)) move(g, c, 'gy', { reason: 'rule' }); } }] },
  'Super Vehicroid Jumbo Drill': { self: { piercing: true } },
  'Super War-Lion': { effs: [] },
  // PARTIAL: the 1-Tribute Summon accepts any monster as the Tribute, and can also be a Set.
  'Super-Ancient Dinobeast': { self: { tributes: (g, c, p) => monsOf(g, p).some(x => race(x) === 'Dinosaur') ? [1] : [] },
    effs: [{ type: 'trig', when: true, label: 'Draw 1 card',
      on: (g, ev, c) => ev.type === 'summon' && !g.inDS && ev.cs.some(x => x !== c && race(x) === 'Dinosaur' && x.ctrl === c.ctrl &&
        g.events.some(e => e.type === 'move' && e.c === x && e.from === 'gy' && e.to === 'm' && e.group === ev.group)),
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  // PARTIAL: the Batteryman D negation is an optional Spell Speed 3 response, as Ryu Senshi in goat-*.js.
  'Super-Electromagnetic Voltech Dragon': {
    self: { piercing: (g, c) => !!c.flags.voltC, atk: (g, c) => c.flags.voltAA ? 1000 : 0 },
    effs: [{ type: 'trig', mand: true, label: 'Gain the Batteryman effect',
      on: (g, ev, c) => evSummoned(ev, c, ['tribute']) && (ev.tribs || []).some(x => ['Batteryman D', 'Batteryman C', 'Batteryman AA'].includes(D(x).n)),
      res: function* (g, c, p, L2) { if (!onField(c)) return; for (const x of L2.ev.tribs || []) { const n = D(x).n;
        if (n === 'Batteryman D') c.flags.voltD = true; if (n === 'Batteryman C') c.flags.voltC = true; if (n === 'Batteryman AA') c.flags.voltAA = true; }
        log(g, `${name(c)} gained its Batteryman effect.`); } },
      { type: 'quick', speed: 3, ds: true, label: 'Negate the Spell/Trap that targets it',
        cond: (g, c, p, x) => !!c.flags.voltD && !!x.top && isST(x.top.c) && !x.top.negated && x.top.t.length === 1 && x.top.t[0] === c,
        target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
        res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, false); } }] },

  /* ----- Sword ----- */
  'Sword Hunter': { self: { atk: (g, c) => 200 * stOnField(g).filter(x => x.equipTo === c.u && x.flags.swordHunt).length },
    effs: [{ type: 'trig', res: noop, on: (g, ev, c) => { if (battleKill(ev, c)) { if (c.flags.shTurn !== g.turnNo) { c.flags.shTurn = g.turnNo; c.flags.shKills = []; } c.flags.shKills.push(ev.c.u); } return false; } },
      { type: 'trig', mand: true, label: 'Equip the destroyed monsters',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'bpEnd' && c.flags.shTurn === g.turnNo && (c.flags.shKills || []).some(u => allCards(g, 'gy').some(x => x.u === u)),
        res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; const us = c.flags.shKills || []; c.flags.shKills = [];
          for (const x of allCards(g, 'gy').filter(y => us.includes(y.u))) { if (freeST(g, p) < 0) break; move(g, x, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); x.equipTo = c.u; x.flags.swordHunt = true; log(g, `${D(x).n} was equipped to ${name(c)}.`); } } }] },
  'Sword Master': { self: { piercing: true },
    effs: [{ type: 'trig', loc: 'hand', tags: { ss: 1 }, label: 'Special Summon this card from your hand',
      on: (g, ev, c) => ev.type === 'dsEnd' && ev.a && ev.t && ev.a.ctrl === c.owner && onField(ev.a) && faceUp(ev.a) && race(ev.a) === 'Warrior' &&
        !g.events.some(e => e.type === 'move' && e.c === ev.t && e.battle && e.turn === g.turnNo && e.seq > (g.events.slice().reverse().find(d => d.type === 'dsStart') || {}).seq),
      cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { if (c.zone === 'hand') ss(g, p, c, 'atk'); } }] },
  'Sword of Dark Destruction': { cont: eqBonus(400, -200), effs: [equipAct(m => attr(m) === 'DARK', 'Equip to which DARK monster?')] },
  // PARTIAL: "Tributed" is read from the monster's move (reason tribute or ritual); scripts that Tribute as a plain cost may not count.
  'Sword of Dark Rites': { cont: eqBonus(400, 0), effs: [equipAct(m => attr(m) === 'DARK', 'Equip to which DARK monster?'),
    { type: 'trig', loc: 'gy', mand: true, label: 'Return this card to the hand', on: (g, ev, c) => sentWithEquipped(g, ev, c, e => e.to === 'gy' && ['tribute', 'ritual'].includes(e.reason)),
      res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} returned Sword of Dark Rites to the hand.`); } } }] },
  'Sword of Deep-Seated': { cont: eqBonus(500, 500), effs: [equipAct(),
    { type: 'trig', loc: 'gy', mand: true, label: 'Place it on top of your Deck', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && ev.from !== 'gy',
      res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'deckTop', { reason: 'effect' }); log(g, 'Sword of Deep-Seated was placed on top of the Deck.'); } } }] },
  "Sword of Dragon's Soul": { cont: eqBonus(700, 0), effs: [equipAct(m => race(m) === 'Warrior', 'Equip to which Warrior?'),
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
      if (ev.type === 'afterCalc' && ev.a && ev.t && c.equipTo) { const m = [ev.a, ev.t].find(x => x.u === c.equipTo); const o = m && (m === ev.a ? ev.t : ev.a);
        if (o && race(o) === 'Dragon') { if (c.flags.dsTurn !== g.turnNo) { c.flags.dsTurn = g.turnNo; c.flags.dsT = []; } c.flags.dsT.push(o.u); } }
      return false; } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the Dragon it battled',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'bpEnd' && c.flags.dsTurn === g.turnNo && fieldMons(g).some(x => (c.flags.dsT || []).includes(x.u)),
      res: function* (g, c, p) { const xs = fieldMons(g).filter(x => (c.flags.dsT || []).includes(x.u)); c.flags.dsT = []; destroy(g, xs, { by: p, src: c }); } }] },
  'Sword of Kusanagi': { cont: { grant: (g, src, m, flag) => flag === 'piercing' && src.equipTo === m.u },
    effs: [equipAct(m => isSpiritMon(m), 'Equip to which Spirit monster?'),
      { type: 'trig', loc: 'gy', mand: true, label: 'Return this card to the hand',
        on: (g, ev, c) => sentWithEquipped(g, ev, c, e => e.to === 'hand' && e.prevCtrl === ev.prevCtrl) && ev.prevCtrl === c.owner,
        res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} returned Sword of Kusanagi to the hand.`); } } }] },
  'Sword of Sparkles': { effs: [equipAct(m => /X-Saber/.test(name(m)), 'Equip to which "X-Saber" monster?'),
    { type: 'trig', loc: 'st', tags: { destroy: 1 }, label: 'Destroy 1 card your opponent controls',
      on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.killer && ev.killer.u === c.equipTo && ev.to === 'gy' && ev.prevCtrl !== c.ctrl,
      cond: (g, c, p) => fieldOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } },
    { type: 'ign', loc: 'gy', label: 'Tribute a monster: return this card to the top of the Deck', cond: (g, c, p) => monsOf(g, p).length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 monster you control', monsOf(g, p), 1, 1, 'cost'); if (x) tribute(g, p, x); },
      res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'deckTop', { reason: 'effect' }); log(g, 'Sword of Sparkles was placed on top of the Deck.'); } } }] },
  // The Tributes are part of the activation (done as it is activated, once the monster to equip is chosen).
  'Sword of the Soul-Eater': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 1000 * (src.flags.soulN || 0) : 0 },
    effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && D(m).k === 'normal' && lv(m) <= 3),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which Level 3 or lower Normal Monster?', monsOf(g, p).filter(m => faceUp(m) && D(m).k === 'normal' && lv(m) <= 3), 1, 1, 'good');
        const t = L2.t[0]; const xs = monsOf(g, p).filter(x => x !== t && faceUp(x) && D(x).k === 'normal');
        for (const x of xs) tribute(g, p, x); L2.data.n = xs.length; },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && equip(g, c, t)) { c.flags.soulN = L2.data.n || 0; if (c.flags.soulN) log(g, `${name(t)} gained ${1000 * c.flags.soulN} ATK.`); } } }] },
});
})();
