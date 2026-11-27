/* Full pool 02: Aqua Chorus to Black Veloci (build/batches/full/full-02.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts (Edison and Goat) from the 2010 text;
 cards with a Goat-only script elsewhere keep it in Goat, and their shared version here is ported from it. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, negate, addMod,
  equip, equippedTo, link, addCtr, ctr, addRule, ritualSummon, canRitual,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, allCards, shuffleDeck, log, PN, has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned, emit } = L;
const atk = L.atk, def = L.def;

/* ----- helpers for this batch ----- */
const named = (c, n) => D(c).n === n;
const isAssault = c => isMon(c) && / Assault Mode$/.test(D(c).n);
const ctrlAssault = (g, p) => monsOf(g, p).some(x => faceUp(x) && isAssault(x));
const isEquipSpell = c => isSpell(c) && D(c).sub === 'Equip';
const isTuner = c => isMon(c) && !!D(c).tu;
const isArchfiend = c => isMon(c) && (/Archfiend/.test(name(c)) || ['Summoned Skull', 'Fiend Skull Dragon'].includes(name(c)));
// a monster that can be Special Summoned from the hand by an effect (no "Cannot be Special Summoned" / nomi text)
const ssable = c => isMon(c) && !['ritual', 'fusion', 'synchro', 'token'].includes(D(c).k) && !/Cannot be (Normal|Special) Summoned/i.test(D(c).tx || '');
// this batch's per-duel state (Armored Glass, Battle Teleportation)
const ST = g => g.full02 || (g.full02 = { glass: -1, bt: {}, rule: false });
const glassOn = g => ST(g).glass === g.turnNo;
// "If this card destroys an opponent's monster by battle"
const killedByBattle = (ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.prevCtrl !== c.ctrl;
// Summon turn record (Armor Exe, Big-Tusked Mammoth): every summon marks the monsters with the turn
const markSummon = { type: 'trig', loc: 'any', on: (g, ev) => { if (ev.type === 'summon') for (const x of ev.cs) if (x && x.flags) x.flags.sumTurn = g.turnNo; return false; }, res: function* () {} };
const summonedNow = (g, c) => c.flags.sumTurn === g.turnNo || c.turnIn === g.turnNo;

/* ENGINE: the card data has no Edison PSCT for these, and the engine reads "Cannot be Normal Summoned" from the PSCT line
 only, so the Summon limits are added as one duel rule the first time any event happens: no Normal Summon or Set, and
 (Armed Dragon LV7 / LV10, "Cannot be Special Summoned from the GY / banished, even if it was properly Summoned") no
 Special Summon from the GY or banished pile. */
const NOMI = { 'Aqua Spirit': { ns: true }, 'Armed Dragon LV7': { ns: true, gy: true }, 'Armed Dragon LV10': { ns: true, gy: true } };
const nomiRule = { type: 'trig', loc: 'any', on: (g) => {
  const s = ST(g); if (s.rule) return false; s.rule = true;
  g.rules.push({ forbid: (g2, a) => { if (!a.c || a.c.id == null) return false; const d = D(a.c), r = d && NOMI[d.n]; if (!r) return false;
    if ((a.type === 'ns' || a.type === 'set') && r.ns) return true;
    if (a.type === 'ss' && r.gy && (a.c.zone === 'gy' || a.c.zone === 'ban')) return true;
    return false; } });
  return false; }, res: function* () {} };

// An Equip Spell: target a face-up monster (filter), equip it at resolution. Bonuses go in the card's cont.
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?', more = {}) => ({ type: 'act', ...more,
  cond: (g, c, p, x) => fieldMons(g).some(m => faceUp(m) && filter(m, g, p)) && (!more.cond || more.cond(g, c, p, x)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m, g, p)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && filter(t, g, p)) { equip(g, c, t); c.flags.eqU = t.u; } } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });

// Union monsters (Edison union rules): once per turn equip to a monster you control, or unequip and Special Summon in
// Attack Position; a monster has at most 1 Union; "if the equipped monster would be destroyed, destroy this card instead".
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
  if (o.rule || src.zone !== 'st' || src.equipTo !== m.u || !src.flags.union || glassOn(g)) return false;
  move(g, src, 'gy', { reason: o.battle ? 'battle' : 'effect', destroyed: true, by: o.by }); log(g, `${D(src).n} was destroyed instead of ${name(m)}.`); return true; } };

// The Ritual Spells: total Levels equal to or more than the Ritual Monster's
const ritualSpell = rn => ({ effs: [{ type: 'act', tags: { ss: 1 },
  cond: (g, c, p) => canRitual(g, p, { monster: x => named(x, rn) }),
  res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, rn) }); } }] });

// B.E.S. counters: "If this card attacks or is attacked, remove 1 counter at the end of the Damage Step. If you can't, destroy it."
const besPlace = (n, hows) => ({ type: 'trig', mand: true, label: `Place ${n} counters`, on: (g, ev, c) => evSummoned(ev, c, hows),
  res: function* (g, c) { if (!onField(c)) return; addCtr(g, c, 'bes', n); log(g, `${name(c)} got ${n} counters.`); } });
const besEnd = { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Remove a counter', on: (g, ev, c) => ev.type === 'dsEnd' && (ev.a === c || ev.t === c),
  res: function* (g, c, p) { if (!onField(c)) return; if (ctr(c, 'bes') > 0) { addCtr(g, c, 'bes', -1); log(g, `${name(c)} lost a counter (${ctr(c, 'bes')} left).`); } else destroy(g, [c], { by: p }); } };

// A Trap that answers an event the engine opens no window for (a Standby Phase, damage): offered as an optional
// trigger while it is Set (same shape as classic-5.js). The event is kept on the card for the cost and target.
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });

// damage to both players at once (a draw if both reach 0)
function dmgBoth(g, p, n, src) {
  if (g.p[p].lp > n) { damage(g, p, n, { src, srcP: p }); damage(g, opp(p), n, { src, srcP: p }); return; }
  g.p[p].lp -= n; log(g, `${PN(g, p)} took ${n} damage.`); damage(g, opp(p), n, { src, srcP: p });
  if (g.p[p].lp <= 0) damage(g, p, 1, { src, srcP: p }); // the opponent survived: the duel ends on this player's 0 LP
}
function* ssFrom(g, p, filter, text, zones) {
  const cands = zones.flatMap(z => g.p[p][z]).filter(x => x && filter(x)); if (!cands.length || freeM(g, p) < 0) { if (zones.includes('deck')) shuffleDeck(g, p); return null; }
  const [x] = yield* pick(g, p, text, cands, 1, 1, 'good'); const fromDeck = x && x.zone === 'deck';
  if (x) ss(g, p, x, 'atk'); if (fromDeck || zones.includes('deck')) shuffleDeck(g, p); return x;
}
// Armored Glass: the ATK/DEF an Equip Card gives the monster it is equipped to
let GLASS_DEPTH = 0;
function eqSum(g, m, which) {
  if (GLASS_DEPTH) return 0; GLASS_DEPTH++;
  try { let s = 0; for (const e of allField(g)) { if (e.zone !== 'st' || e.equipTo !== m.u || !faceUp(e)) continue; const sc = E.SCRIPTS[D(e).n];
    if (sc && sc.cont && sc.cont[which]) s += sc.cont[which](g, e, m) || 0; if (which === 'atk' && D(e).n === 'Armory Arm') s += 1000; } return s; }
  finally { GLASS_DEPTH--; }
}

E.addScripts({
  /* ----- Aqua ----- */
  // "If there are monsters with the same name on the field, those monsters gain 500 ATK and DEF."
  'Aqua Chorus': { effs: [{ type: 'act', res: function* () {} }],
    cont: { atk: (g, src, m) => faceUp(m) && fieldMons(g).some(x => x !== m && faceUp(x) && name(x) === name(m)) ? 500 : 0,
      def: (g, src, m) => faceUp(m) && fieldMons(g).some(x => x !== m && faceUp(x) && name(x) === name(m)) ? 500 : 0 } },
  'Aqua Dragon': { effs: [] }, // its recipe is read from its text
  // ported from goat-5.js
  'Aqua Spirit': {
    proc: { label: 'Special Summon (banish a WATER from your GY)', cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'WATER'),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish a WATER monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'WATER'), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${name(x)}.`); } } },
    effs: [nomiRule, { type: 'trig', label: 'Change a monster’s position', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl,
      cond: (g, c, p) => oppFaceUp(g, p).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change the battle position of which monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || t.zone !== 'm') return;
        t.pos = t.pos === 'atk' ? 'def' : 'atk'; t.posChanged = true; g.seq++;
        addRule(g, (g2, a) => a.type === 'pos' && a.c === t, { end: g.turnNo });
        log(g, `${name(t)} changed to ${t.pos === 'atk' ? 'Attack' : 'Defense'} Position.`); emit(g, { type: 'pos', c: t, p }); } }] },

  /* ----- Armed Dragon and other "Armed" cards ----- */
  // "Send 1 Equip Spell Card from your hand to the GY to activate this card. If the equipped monster destroys a monster by
  // battle, the controller of this card can add 1 monster with ATK equal to or less than the equipped monster from their GY to their hand."
  'Armed Changer': { effs: [equipAct(() => true, 'Equip Armed Changer to which face-up monster?', {
      cond: (g, c, p) => g.p[p].hand.some(x => x !== c && isEquipSpell(x)),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send 1 Equip Spell from your hand to the GY', g.p[p].hand.filter(x => x !== c && isEquipSpell(x)), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); } } }),
    { type: 'trig', loc: 'st', label: 'Add a monster from the GY',
      on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && !!ev.killer && ev.killer.u === c.equipTo,
      cond: (g, c, p) => { const m = equippedTo(g, c); return !!m && g.p[p].gy.some(x => isMon(x) && baseAtk(x) <= atk(g, m)); },
      res: function* (g, c, p) { const m = equippedTo(g, c); if (!m) return; const cs = g.p[p].gy.filter(x => isMon(x) && baseAtk(x) <= atk(g, m)); const [x] = yield* pick(g, p, 'Add which monster from your GY to your hand?', cs, 1, 1, 'good'); if (x) { move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(x)} from the GY to the hand.`); } } }] },
  // "Cannot be Normal Summoned or Set. Cannot be Special Summoned except by Tributing 1 Armed Dragon LV7. You can send 1 card
  // from your hand to the GY to destroy all face-up monsters your opponent controls."
  'Armed Dragon LV10': {
    proc: { label: 'Special Summon (Tribute Armed Dragon LV7)', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && named(x, 'Armed Dragon LV7')),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Tribute Armed Dragon LV7', monsOf(g, p).filter(x => faceUp(x) && named(x, 'Armed Dragon LV7')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Armed Dragon LV7.`); } } },
    effs: [nomiRule, { type: 'ign', tags: { destroy: 1 }, label: 'Discard: destroy their face-up monsters',
      cond: (g, c, p) => g.p[p].hand.length > 0 && oppFaceUp(g, p).length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send 1 card from your hand to the GY', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); } },
      res: function* (g, c, p) { destroy(g, oppFaceUp(g, p), { by: p, src: c }); } }] },
  // "During your Standby Phase: You can send this card to the GY; Special Summon 1 Armed Dragon LV5 from your hand/Deck."
  'Armed Dragon LV3': { effs: [{ type: 'trig', tags: { ss: 1 }, label: 'Level up to LV5',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    cond: (g, c, p) => [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Armed Dragon LV5')),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Armed Dragon LV3 to the GY.`); },
    res: function* (g, c, p) { yield* ssFrom(g, p, x => named(x, 'Armed Dragon LV5'), 'Special Summon Armed Dragon LV5', ['hand', 'deck']); } }] },
  'Armed Dragon LV5': { effs: [
    { type: 'ign', tags: { destroy: 1 }, label: 'Send a monster: destroy a monster',
      cond: (g, c, p) => g.p[p].hand.some(x => isMon(x) && oppFaceUp(g, p).some(t => atk(g, t) <= baseAtk(x))),
      cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Send 1 monster from your hand to the GY', g.p[p].hand.filter(x => isMon(x) && oppFaceUp(g, p).some(t => atk(g, t) <= baseAtk(x))), 1, 1, 'cost'); L2.data.a = baseAtk(x); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, `Destroy which monster with ${L2.data.a} or less ATK?`, oppFaceUp(g, p).filter(t => atk(g, t) <= L2.data.a), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2).filter(faceUp), { by: p, src: c }); } },
    { type: 'trig', on: (g, ev, c) => { if (ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && onField(c)) c.flags.lvKill = g.turnNo; return false; }, res: function* () {} },
    { type: 'trig', tags: { ss: 1 }, label: 'Level up to LV7',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.lvKill === g.turnNo,
      cond: (g, c, p) => [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Armed Dragon LV7')),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Armed Dragon LV5 to the GY.`); },
      res: function* (g, c, p) { yield* ssFrom(g, p, x => named(x, 'Armed Dragon LV7'), 'Special Summon Armed Dragon LV7', ['hand', 'deck']); } }] },
  // PARTIAL: "Must be Special Summoned by Armed Dragon LV5" is enforced as no Normal Summon and no revival from the GY/banished.
  'Armed Dragon LV7': { effs: [nomiRule, { type: 'ign', tags: { destroy: 1 }, label: 'Send a monster: destroy monsters',
    cond: (g, c, p) => g.p[p].hand.some(isMon) && oppFaceUp(g, p).length > 0,
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Send 1 monster from your hand to the GY', g.p[p].hand.filter(isMon), 1, 1, 'cost'); L2.data.a = baseAtk(x); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); },
    res: function* (g, c, p, L2) { destroy(g, oppFaceUp(g, p).filter(t => atk(g, t) <= L2.data.a), { by: p, src: c }); } }] },
  // "FLIP: Target 1 Spell Card on the field; destroy it. (If it is Set, reveal it; a Trap goes back face-down.)"
  'Armed Ninja': { effs: [{ type: 'trig', mand: true, faceDownOk: true, tags: { destroy: 1 }, label: 'Destroy a Spell Card', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: g => stOnField(g).some(x => x.pos === 'set' || isSpell(x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target 1 Spell Card on the field', stOnField(g).filter(x => x.pos === 'set' || isSpell(x)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; if (isSpell(t)) destroy(g, [t], { by: p }); else log(g, `${PN(g, p)} revealed ${name(t)}. It is not a Spell Card, so it stays.`); } }] },
  // "After damage calculation, if this card battles an Effect Monster: Negate the effects of that monster (including in the
  // GY). You must control another face-up WATER monster to activate and to resolve this effect. If this card would be
  // destroyed, you can destroy 1 face-up Level 3 or lower WATER monster you control instead."
  // PARTIAL: the substitute is used whenever possible (no prompt inside a destruction); in the GY the negation blocks
  // that monster's activated effects.
  'Armed Sea Hunter': {
    self: { replaceDestroy: (g, c, o) => { if (o.rule) return false; const xs = monsOf(g, c.ctrl).filter(x => x !== c && faceUp(x) && attr(x) === 'WATER' && lv(x) <= 3 && !has(g, x, 'noEffectDestroy') && !x.flags.battleDoomed);
      if (!xs.length) return false; xs.sort((a, b) => atk(g, a) - atk(g, b)); move(g, xs[0], 'gy', { reason: 'effect', destroyed: true, by: c.ctrl }); log(g, `${D(xs[0]).n} was destroyed instead of Armed Sea Hunter.`); return true; } },
    effs: [{ type: 'trig', mand: true, label: 'Negate the monster’s effects',
      on: (g, ev, c) => ev.type === 'afterCalc' && (ev.a === c || ev.t === c) && (() => { const o = ev.a === c ? ev.t : ev.a; return !!o && D(o).k === 'effect'; })(),
      cond: (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x) && attr(x) === 'WATER'),
      res: function* (g, c, p, L2) { if (!monsOf(g, p).some(x => x !== c && faceUp(x) && attr(x) === 'WATER')) return; const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; if (!o) return;
        if (onField(o)) { o.flags.negated = true; g.seq++; }
        addRule(g, (g2, a) => a.type === 'activate' && a.c === o && a.c.zone === 'gy');
        log(g, `${D(o).n}'s effects were negated.`); } }] },
  // ported from goat-4.js: one more attack per Equip Card on it
  'Armed Samurai - Ben Kei': { self: { maxAttacks: (g, c) => 1 + allField(g).filter(x => x.zone === 'st' && x.equipTo === c.u).length }, effs: [] },
  'Armor Break': { effs: [{ type: 'act', label: 'Negate an Equip Spell',
    cond: (g, c, p, x) => spellTrapAct(x.top) && !x.top.negated && isEquipSpell(x.top.c),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  // Union: ① equip to a Warrior / unequip; ② while equipped, if the equipped monster inflicts battle damage: target 1 card
  // on the field; destroy it; ③ if the equipped monster would be destroyed, destroy this card instead.
  'Armor Breaker': { cont: unionCont, effs: [...unionEffs(x => race(x) === 'Warrior', 'Equip Armor Breaker to which Warrior?'),
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy 1 card',
      on: (g, ev, c) => !!c.flags.union && ev.type === 'damage' && ev.battle && !!ev.src && ev.src.u === c.equipTo && ev.p !== c.ctrl && !glassOn(g),
      cond: g => allField(g).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', allField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  // "Can't attack the turn it is Normal, Flip or Special Summoned. During each Standby Phase, remove 1 Spell Counter from
  // your field or destroy this card."
  'Armor Exe': { self: { cantAttack: (g, c) => summonedNow(g, c) },
    effs: [markSummon, { type: 'trig', mand: true, label: 'Remove a Spell Counter or be destroyed', on: (g, ev) => ev.type === 'phase' && ev.ph === 'standby',
      res: function* (g, c, p) { if (!onField(c)) return; const src = fieldOf(g, p).filter(x => ctr(x, 'spell') > 0);
        if (src.length && (yield* yn(g, p, 'Armor Exe: remove 1 Spell Counter from your field? (No destroys Armor Exe)'))) { const [x] = yield* pick(g, p, 'Remove a Spell Counter from which card?', src, 1, 1, 'cost'); addCtr(g, x, 'spell', -1); log(g, `${PN(g, p)} removed a Spell Counter from ${name(x)}.`); }
        else destroy(g, [c], { by: p }); } }] },
  // "If you control a face-up Psychic monster, you can Normal Summon this card without Tributing. If this card destroys an
  // opponent's monster by battle, you take damage equal to half its ATK. Then, you can Special Summon 1 monster from your
  // GY with ATK less than or equal to the damage you took."
  'Armored Axon Kicker': { self: { tributes: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Psychic') ? [0] : [] },
    effs: [{ type: 'trig', mand: true, label: 'Take damage, then revive', on: (g, ev, c) => killedByBattle(ev, c),
      res: function* (g, c, p, L2) { const n = Math.floor(baseAtk(L2.ev.c) / 2); if (n <= 0) return; const took = damage(g, p, n, { src: c, srcP: p });
        const cs = g.p[p].gy.filter(x => isMon(x) && baseAtk(x) <= took); if (!took || !cs.length || freeM(g, p) < 0) return;
        if (!(yield* yn(g, p, `Special Summon a monster with ${took} or less ATK from your GY?`))) return;
        const [x] = yield* pick(g, p, 'Special Summon which monster?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  // Union for "Cyber Dragon" or a Fusion that lists it: ② once per turn while equipped: target 1 face-up monster; the
  // equipped monster loses exactly 1000 ATK, and if it does, destroy that target.
  'Armored Cybern': { cont: unionCont, effs: [...unionEffs(x => named(x, 'Cyber Dragon') || (D(x).k === 'fusion' && /"Cyber Dragon"/.test(D(x).tx || '')), 'Equip Armored Cybern to which monster?'),
    { type: 'ign', loc: 'st', opt: true, tags: { destroy: 1 }, label: '-1000 ATK: destroy a monster',
      cond: (g, c, p) => { const m = c.flags.union && equippedTo(g, c); return !!m && !glassOn(g) && atk(g, m) >= 1000 && fieldMons(g).some(faceUp); },
      target: function* (g, c, p, L2) { L2.data.m = equippedTo(g, c); yield* tgt(g, p, L2, 'Destroy which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const m = L2.data.m; if (!m || !onField(m) || !faceUp(m) || atk(g, m) < 1000) return; addMod(g, m, { atk: -1000 }); log(g, `${name(m)} lost 1000 ATK.`); destroy(g, live(L2).filter(faceUp), { by: p, src: c }); } }] },
  // "Activate only when a monster is equipped with an Equip Card. Negate the effects of all Equip Cards on the field this turn."
  // PARTIAL: ATK/DEF changes and activated effects of Equip Cards are negated; other kept effects (piercing) are not.
  'Armored Glass': {
    cont: { loc: 'gy',
      atk: (g, src, m) => glassOn(g) && allCards(g, 'gy').find(x => named(x, 'Armored Glass')) === src ? -eqSum(g, m, 'atk') : 0,
      def: (g, src, m) => glassOn(g) && allCards(g, 'gy').find(x => named(x, 'Armored Glass')) === src ? -eqSum(g, m, 'def') : 0,
      forbid: (g, src, a) => glassOn(g) && a.type === 'activate' && !!a.c && a.c.zone === 'st' && !!a.c.equipTo },
    effs: [{ type: 'act', cond: g => allField(g).some(x => x.zone === 'st' && x.equipTo && faceUp(x)),
      res: function* (g, c, p) { ST(g).glass = g.turnNo; g.seq++; log(g, 'The effects of all Equip Cards are negated this turn.'); } }] },
  // "Equip only to a Warrior that is the only monster you control. It gains 300 ATK. During your Main Phase 1, you can send
  // this card to the GY to let the equipped monster attack twice this turn."
  'Assault Armor': { cont: eqBonus(300, 0),
    effs: [equipAct((m, g, p) => race(m) === 'Warrior' && m.ctrl === p && monsOf(g, p).length === 1, 'Equip Assault Armor to which Warrior?'),
      { type: 'ign', loc: 'st', label: 'Send to the GY: attack twice',
        cond: (g, c, p) => g.phase === 'main1' && !!equippedTo(g, c) && !glassOn(g),
        cost: function* (g, c, p, L2) { L2.data.m = equippedTo(g, c); move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Assault Armor to the GY.`); },
        res: function* (g, c, p, L2) { const m = L2.data.m; if (m && onField(m) && faceUp(m)) { m.flags.extraAttack = g.turnNo; log(g, `${name(m)} can attack twice this turn.`); } } }] },
  'Assault Counter': { effs: [{ type: 'act', label: 'Negate and destroy',
    cond: (g, c, p, x) => ctrlAssault(g, p) && !!x.top && !x.top.negated && (spellTrapAct(x.top) || (isMon(x.top.c) && x.top.eff.type !== 'act')),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  'Assault Mercenary': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Return Assault Mode Activate: destroy a Spell/Trap',
    cond: (g, c, p) => [...g.p[p].hand, ...g.p[p].gy].some(x => named(x, 'Assault Mode Activate')) && stOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Return Assault Mode Activate to the Deck', [...g.p[p].hand, ...g.p[p].gy].filter(x => named(x, 'Assault Mode Activate')), 1, 1, 'cost'); if (x) { move(g, x, 'deck', { reason: 'cost' }); log(g, `${PN(g, p)} returned Assault Mode Activate to the Deck.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  'Assault on GHQ': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => monsOf(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which of your monsters?', monsOf(g, p), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { if (destroy(g, live(L2), { by: p, src: c }).length) mill(g, opp(p), 2); } }] },
  'Assault Overload': { effs: [{ type: 'act', label: 'Tribute an Assault Mode monster: damage both players',
    cond: (g, c, p) => monsOf(g, p).some(isAssault),
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Tribute 1 Assault Mode monster', monsOf(g, p).filter(isAssault), 1, 1, 'cost'); L2.data.n = lv(x) * 200; move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
    res: function* (g, c, p, L2) { dmgBoth(g, p, L2.data.n, c); } }] },
  // PARTIAL: any Assault Mode monster in the GY can be summoned (the engine doesn't track "properly summoned first").
  'Assault Revival': { effs: [{ type: 'act', tags: { destroy: 1, ss: 1 },
    cond: (g, c, p) => g.p[p].gy.some(x => named(x, 'Assault Mode Activate')) && monsOf(g, p).length > 0 && g.p[p].gy.some(isAssault),
    cost: function* (g, c, p) { const x = g.p[p].gy.find(x => named(x, 'Assault Mode Activate')); move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished Assault Mode Activate from the GY.`); },
    res: function* (g, c, p) { const mine = monsOf(g, p); if (!mine.length) return; const d = destroy(g, mine, { by: p, src: c }); if (!d.length || monsOf(g, p).length) return;
      const cs = g.p[p].gy.filter(isAssault); if (!cs.length) return; const [x] = yield* pick(g, p, 'Special Summon which Assault Mode monster?', cs, 1, 1, 'good');
      if (x && ss(g, p, x, 'atk', { negate: true, banishOnLeave: true })) x.flags.noTribute = true; } }] },
  'Assault Slash': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => ctrlAssault(g, p),
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(faceUp), { by: p, src: c }); } }] },
  'Assault Teleport': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(isAssault) && g.p[p].deck.length >= 1,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Return 1 Assault Mode monster from your hand to the Deck', g.p[p].hand.filter(isAssault), 1, 1, 'cost'); if (x) { log(g, `${PN(g, p)} revealed ${name(x)} and returned it to the Deck.`); move(g, x, 'deck', { reason: 'cost' }); } },
    res: function* (g, c, p) { draw(g, p, 2); } }] },
  // "When you take damage: inflict 700 damage, plus 300 for each Attack and Receive in your GY."
  // PARTIAL: offered as an optional trigger while Set (no response window right after damage).
  'Attack and Receive': { effs: [trapTrig({ label: 'Inflict damage',
    on: (g, ev, c) => ev.type === 'damage' && ev.p === c.ctrl,
    res: function* (g, c, p) { damage(g, opp(p), 700 + 300 * g.p[p].gy.filter(x => named(x, 'Attack and Receive')).length, { src: c, srcP: p }); } })] },
  // "If a Level 3 or lower Normal Monster you control battles, during the Damage Step you can pay LP in multiples of 100;
  // the opponent's monster loses that much ATK until the End Phase (not more than its ATK)." Once per Damage Step.
  'Attack of the Cornered Rat': (() => {
    const pair = (g, p) => { const b = g.battle; if (!g.inDS || !b || !b.t) return null; const mine = [b.a, b.t].find(x => x && x.ctrl === p && faceUp(x) && D(x).k === 'normal' && lv(x) <= 3); const foe = mine && (mine === b.a ? b.t : b.a); return foe && foe.ctrl !== p && faceUp(foe) && atk(g, foe) >= 100 && g.p[p].lp > 100 ? { foe } : null; };
    const payIt = function* (g, c, p, L2) { const { foe } = pair(g, p); const max = Math.min(Math.floor(atk(g, foe) / 100), Math.floor((g.p[p].lp - 1) / 100), 60);
      const i = yield* choose(g, p, `Pay how much LP? (${name(foe)} loses that much ATK)`, [...Array(max).keys()].map(k => String((k + 1) * 100))); const n = (i + 1) * 100;
      pay(g, p, n); c.flags.ratB = g.battle; L2.data.foe = foe; L2.data.n = n; };
    const apply = function* (g, c, p, L2) { const f = L2.data.foe; if (f && onField(f) && faceUp(f)) { addMod(g, f, { atk: -L2.data.n, end: true }); log(g, `${name(f)} lost ${L2.data.n} ATK.`); } };
    return { effs: [
      { type: 'act', ds: true, cond: (g, c, p) => !g.inDS || !!pair(g, p), cost: function* (g, c, p, L2) { if (g.inDS) yield* payIt(g, c, p, L2); }, res: function* (g, c, p, L2) { if (L2.data.foe) yield* apply(g, c, p, L2); } },
      { type: 'quick', loc: 'st', ds: true, label: 'Pay LP: lower ATK', cond: (g, c, p) => !!pair(g, p) && c.flags.ratB !== g.battle, cost: payIt, res: apply }] };
  })(),
  'Attack Pheromones': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, label: 'Change to Attack Position',
      on: (g, ev, c) => ev.type === 'dsEnd' && ev.a && ev.a.ctrl === c.ctrl && !!ev.t && race(ev.a) === 'Reptile' && onField(ev.t) && ev.t.pos !== 'atk',
      res: function* (g, c, p, L2) { const t = L2.ev.t; if (t && onField(t) && t.pos !== 'atk') { if (t.pos === 'set') log(g, `It was ${name(t)}.`); t.pos = 'atk'; g.seq++; log(g, `${name(t)} changed to Attack Position.`); emit(g, { type: 'pos', c: t, p }); } } }] },
  'Attack Reflector Unit': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => D(x).n === 'Cyber Dragon') && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Cyber Barrier Dragon')),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 Cyber Dragon', monsOf(g, p).filter(x => D(x).n === 'Cyber Dragon'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Cyber Dragon.`); } },
    res: function* (g, c, p) { yield* ssFrom(g, p, x => named(x, 'Cyber Barrier Dragon'), 'Special Summon Cyber Barrier Dragon', ['hand', 'deck']); } }] },

  /* ----- B.E.S. ----- */
  'B.E.S. Big Core': { self: { noBattleDestroy: true }, effs: [besPlace(3, ['normal', 'tribute']), besEnd] },
  'B.E.S. Big Core MK-2': { self: { noBattleDestroy: true, tributes: (g, c, p) => monsOf(g, p).length === 0 ? [0] : [] }, effs: [besPlace(3, ['special', 'synchro', 'fusion', 'ritual']), besEnd] },
  // "If this card attacks or is attacked, at the end of the Damage Step toss a coin and call it; wrong: remove 1 counter.
  // If this card battles without a counter, destroy it at the end of the Damage Step."
  'B.E.S. Covered Core': { self: { noBattleDestroy: true }, effs: [besPlace(2, ['normal', 'tribute']),
    { type: 'trig', on: (g, ev, c) => { if (ev.type === 'dsStart' && (ev.a === c || ev.t === c)) c.flags.ccHad = ctr(c, 'bes') > 0; return false; }, res: function* () {} },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Toss a coin', on: (g, ev, c) => ev.type === 'dsEnd' && (ev.a === c || ev.t === c),
      res: function* (g, c, p) { if (!onField(c)) return; if (!c.flags.ccHad) { destroy(g, [c], { by: p }); return; }
        const call = yield* choose(g, p, 'Call the coin toss', ['Heads', 'Tails']); const h = L.coin(g, p);
        if ((call === 0) !== h) { addCtr(g, c, 'bes', -1); log(g, `${PN(g, p)} called it wrong. ${name(c)} lost a counter.`); } else log(g, `${PN(g, p)} called it right.`); } }] },
  'B.E.S. Crystal Core': { self: { noBattleDestroy: true }, effs: [besPlace(3, ['normal', 'tribute']), besEnd,
    { type: 'ign', opt: true, label: 'Change a monster to Defense Position', cond: (g, c, p) => monsOf(g, opp(p)).some(x => x.pos === 'atk'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change which Attack Position monster to Defense Position?', monsOf(g, opp(p)).filter(x => x.pos === 'atk'), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.ctrl !== p && t.pos === 'atk') { t.pos = 'def'; g.seq++; log(g, `${name(t)} changed to Defense Position.`); emit(g, { type: 'pos', c: t, p }); } } }] },
  'B.E.S. Tetran': { self: { noBattleDestroy: true }, effs: [besPlace(3, ['normal', 'tribute']), besEnd,
    { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Remove a counter: destroy a Spell/Trap', cond: (g, c, p) => ctr(c, 'bes') > 0 && stOnField(g).length > 0,
      cost: function* (g, c) { addCtr(g, c, 'bes', -1); log(g, `B.E.S. Tetran removed a counter.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOnField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },

  /* ----- Battle ----- */
  // "Activate only during your opponent's Standby Phase. Their face-up monsters change to Attack Position and can't change
  // positions this turn. All their monsters must attack this turn, if able."
  // ENGINE: no forced attacks; the position part works. PARTIAL: offered as an optional trigger in their Standby Phase.
  'Battle Mania': { effs: [trapTrig({ label: 'Battle Mania',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl,
    cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { const ms = monsOf(g, opp(p)).filter(faceUp); for (const m of ms) if (m.pos !== 'atk') { m.pos = 'atk'; log(g, `${name(m)} changed to Attack Position.`); emit(g, { type: 'pos', c: m, p }); }
      g.seq++; addRule(g, (g2, a) => a.type === 'pos' && ms.includes(a.c), { end: g.turnNo }); log(g, `${PN(g, opp(p))}'s monsters must attack this turn.`); } })] },
  'Battle of the Elements': { effs: [{ type: 'act',
    cond: g => fieldMons(g).every(faceUp) && monsOf(g, 0).length > 0 && monsOf(g, 1).length > 0,
    res: function* (g, c, p) { for (const q of [p, opp(p)]) { const ms = monsOf(g, q); const at = [...new Set(ms.map(attr))]; if (at.length < 2) continue;
      const i = yield* choose(g, q, 'Keep monsters of which Attribute?', at); const out = ms.filter(m => attr(m) !== at[i]);
      for (const m of out) move(g, m, 'gy', { reason: 'effect', by: p }); log(g, `${PN(g, q)} sent ${out.map(m => D(m).n).join(', ')} to the GY.`); } } }] },
  // "Activate if you control only 1 face-up Psychic monster, and select it. It can attack directly this turn. At the end
  // of the Battle Phase, give control of it to your opponent."
  'Battle Teleportation': {
    cont: { loc: 'gy', grant: (g, src, m, flag) => { const b = ST(g).bt[src.u]; return flag === 'directAttack' && !!b && b.turn === g.turnNo && b.u === m.u; } },
    effs: [{ type: 'act', cond: (g, c, p) => g.tp === p && ['draw', 'standby', 'main1', 'battle'].includes(g.phase) && !g.noBP[p] && !g.inDS && monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Psychic').length === 1,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select your Psychic monster', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Psychic'), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || t.ctrl !== p) return; ST(g).bt[c.u] = { u: t.u, turn: g.turnNo, p }; log(g, `${name(t)} can attack directly this turn.`); } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Give control away',
      on: (g, ev, c) => { const b = ST(g).bt[c.u]; return ev.type === 'phase' && ev.ph === 'bpEnd' && !!b && b.turn === g.turnNo && !b.done; },
      res: function* (g, c, p) { const b = ST(g).bt[c.u]; if (!b) return; b.done = true; const m = fieldMons(g).find(x => x.u === b.u); if (!m || m.ctrl !== b.p) return;
        if (!takeControl(g, opp(b.p), m, false)) destroy(g, [m], { by: b.p, src: c }); } }] },
  'Battle Tuned': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.some(isTuner) && monsOf(g, p).some(faceUp),
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Banish 1 Tuner from your GY', g.p[p].gy.filter(isTuner), 1, 1, 'cost'); L2.data.a = baseAtk(x); move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${name(x)}.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, `Which monster gains ${L2.data.a} ATK?`, monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: L2.data.a }); log(g, `${name(t)} gained ${L2.data.a} ATK.`); } } }] },
  // "Select 1 Archfiend you control. Your opponent also pays the LP you pay for it during the Standby Phase. If this card
  // leaves the field, destroy that monster; when the monster leaves the field, destroy this card."
  // PARTIAL: the amount is read from the Archfiend's text ("pays N LP"); Pandemonium makes it 0.
  'Battle-Scarred': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isArchfiend(x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select 1 Archfiend you control', monsOf(g, p).filter(x => faceUp(x) && isArchfiend(x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c)) { link(g, c, t); log(g, `Battle-Scarred selected ${name(t)}.`); } } },
    { type: 'trig', loc: 'st', mand: true, label: 'Your opponent pays too',
      on: (g, ev, c) => { if (ev.type !== 'phase' || ev.ph !== 'standby' || !c.linkTo) return false; const m = fieldMons(g).find(x => x.u === c.linkTo); return !!m && ev.tp === m.ctrl; },
      res: function* (g, c, p) { const m = fieldMons(g).find(x => x.u === c.linkTo); if (!m || !faceUp(m)) return; const r = (D(m).tx || '').match(/pays? (\d+) (?:LP|Life Points)/); const n = r ? +r[1] : 0;
        if (!n || allField(g).some(x => faceUp(x) && named(x, 'Pandemonium'))) return; const q = opp(p);
        if (g.p[q].lp >= n) pay(g, q, n); else log(g, `${PN(g, q)} can't pay ${n} LP.`); } }] },

  /* ----- Beasts ----- */
  'Beast Fangs': { cont: eqBonus(300, 300), effs: [equipAct(m => race(m) === 'Beast', 'Equip Beast Fangs to which Beast?')] },
  // PARTIAL: Setting it with 3 Tributes isn't blocked (the Tribute count is chosen after Set is picked).
  'Beast King Barbaros': { self: { tributes: () => [0, 3], atk: (g, c) => c.flags.barb1900 ? -1100 : 0 },
    effs: [{ type: 'trig', on: (g, ev, c) => { if (((ev.type === 'summon' && ev.cs.includes(c) && ev.how === 'normal') || (ev.type === 'set' && ev.c === c)) && !(c.tributes && c.tributes.length)) c.flags.barb1900 = true; return false; }, faceDownOk: true, res: function* () {} },
      { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy all their cards', on: (g, ev, c) => evSummoned(ev, c, ['tribute']) && !!ev.tribs && ev.tribs.length === 3,
        res: function* (g, c, p) { destroy(g, fieldOf(g, opp(p)), { by: p, src: c }); } }] },
  // "Special Summon (from your hand) by banishing 1 Machine and 1 Beast-Warrior from your hand, field, and/or GY. If this
  // card attacks or is attacked, your opponent takes no battle damage."
  'Beast Machine King Barbaros Ür': (() => {
    const pool = (g, c, p) => [...g.p[p].hand, ...monsOf(g, p).filter(faceUp), ...g.p[p].gy].filter(x => x !== c && isMon(x));
    return {
      proc: { label: 'Special Summon (banish a Machine and a Beast-Warrior)',
        cond: (g, c, p) => { const ps = pool(g, c, p); return ps.some(a => race(a) === 'Machine' && ps.some(b => b !== a && race(b) === 'Beast-Warrior')); },
        cost: function* (g, c, p, grp) { const ps = pool(g, c, p); const [a] = yield* pick(g, p, 'Banish 1 Machine monster', ps.filter(a => race(a) === 'Machine' && ps.some(b => b !== a && race(b) === 'Beast-Warrior')), 1, 1, 'cost');
          const [b] = yield* pick(g, p, 'Banish 1 Beast-Warrior monster', ps.filter(b => b !== a && race(b) === 'Beast-Warrior'), 1, 1, 'cost');
          for (const x of [a, b]) if (x) move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${[a, b].filter(Boolean).map(x => D(x).n).join(' and ')}.`); } },
      cont: { dmg: (g, src, q, n, o) => (o && o.battle && o.src === src && q !== src.ctrl ? 0 : undefined) },
      effs: [] };
  })(),
  'Beast of the Pharaoh': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon a Zombie',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.reason === 'synchro' && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && race(x) === 'Zombie' && lv(x) <= 4),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Level 4 or lower Zombie?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Zombie' && lv(x) <= 4), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  'Beast Soul Swap': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Beast'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which Beast to your hand?', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Beast'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || race(t) !== 'Beast') return; const L0 = lv(t); move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${D(t).n} returned to the hand.`);
      if (t.zone !== 'hand') return; const cs = g.p[p].hand.filter(x => ssable(x) && race(x) === 'Beast' && lv(x) === L0); if (!cs.length) return;
      const [x] = yield* pick(g, p, `Special Summon a Level ${L0} Beast from your hand`, cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  'Beast Striker': { effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Discard: summon Moja',
    cond: (g, c, p) => g.p[p].hand.length > 0 && freeM(g, p) >= 0 && g.p[p].deck.some(x => named(x, 'Moja')),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    res: function* (g, c, p) { yield* ssFrom(g, p, x => named(x, 'Moja'), 'Special Summon Moja from your Deck', ['deck']); } }] },

  /* ----- Big ----- */
  // ported from goat-4.js: +400 ATK, piercing; when it leaves the field, banish the equipped monster.
  'Big Bang Shot': { cont: { ...eqBonus(400, 0), grant: (g, src, m, flag) => flag === 'piercing' && src.equipTo === m.u && !glassOn(g) },
    effs: [equipAct(),
      { type: 'trig', loc: 'any', mand: true, label: 'Banish the equipped monster',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && !!(ev.snap && ev.snap.flags && ev.snap.flags.eqU),
        res: function* (g, c, p, L2) { const t = fieldMons(g).find(x => x.u === L2.ev.snap.flags.eqU); if (t && faceUp(t)) { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished.`); } } }] },
  // "When your opponent activates a card that targets a monster in the GY: banish all monsters in both GYs."
  'Big Burn': { effs: [{ type: 'act', cond: (g, c, p, x) => !!x.top && x.top.p !== p && !x.top.negated && (x.top.t || []).some(t => isMon(t) && t.zone === 'gy'),
    res: function* (g, c, p) { const ms = allCards(g, 'gy').filter(isMon); for (const m of ms) move(g, m, 'ban', { reason: 'effect', by: p }); if (ms.length) log(g, `${ms.length} monster(s) in the GYs were banished.`); } }] },
  // "Tribute 1 Dinosaur to activate this card. It stays on the field; while face-up, you can Normal Summon Level 5 or higher
  // Dinosaurs without Tributing. Destroy it during your opponent's 3rd End Phase."
  'Big Evolution Pill': {
    cont: { tributes: (g, src, c, p) => src.flags.pill && src.ctrl === p && race(c) === 'Dinosaur' && lv(c) >= 5 ? 0 : null },
    effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => race(x) === 'Dinosaur'),
      cost: function* (g, c, p, L2) { L2.keep = true; const [x] = yield* pick(g, p, 'Tribute 1 Dinosaur', monsOf(g, p).filter(x => race(x) === 'Dinosaur'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
      res: function* (g, c, p) { if (onField(c)) { c.flags.pill = true; log(g, 'Level 5 or higher Dinosaurs can be Normal Summoned without Tributing.'); } } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Third End Phase',
      on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'end' && ev.tp !== c.ctrl && c.flags.pill) { c.flags.pillN = (c.flags.pillN || 0) + 1; return c.flags.pillN >= 3; } return false; },
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  'Big Eye': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Arrange the top 5 cards', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c, p) => g.p[p].deck.length > 0,
    res: function* (g, c, p) { const dk = g.p[p].deck; const top = dk.splice(Math.max(0, dk.length - 5)); const order = [];
      while (top.length) { const [x] = top.length === 1 ? [top[0]] : yield* pick(g, p, `Which card goes ${order.length ? 'next' : 'on top'}?`, top, 1, 1, 'good'); order.push(x); top.splice(top.indexOf(x), 1); }
      for (const x of order.slice().reverse()) dk.push(x); log(g, `${PN(g, p)} looked at the top ${order.length} cards of the Deck and put them back in any order.`); } }] },
  // ported from goat-2.js. "If this card is attacked, change it to Attack Position at the end of the Damage Step."
  // ENGINE: a face-down monster can't respond to a chain, so "When a Spell Card that targets this face-down card is
  // activated: change it to face-up Defense Position and negate the activation" isn't scripted.
  'Big Shield Gardna': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Change to Attack Position',
    on: (g, ev, c) => ev.type === 'dsEnd' && ev.t === c && onField(c) && c.pos !== 'atk',
    res: function* (g, c, p) { if (onField(c) && c.pos !== 'atk') { c.pos = 'atk'; g.seq++; log(g, 'Big Shield Gardna changed to Attack Position.'); emit(g, { type: 'pos', c, p }); } } }] },
  'Big Wave Small Wave': { effs: [{ type: 'act', tags: { destroy: 1, ss: 1 }, cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && attr(x) === 'WATER'),
    res: function* (g, c, p) { const n = destroy(g, monsOf(g, p).filter(x => faceUp(x) && attr(x) === 'WATER'), { by: p, src: c }).length;
      const cs = () => g.p[p].hand.filter(x => ssable(x) && attr(x) === 'WATER'); if (!n || !cs().length || freeM(g, p) < 0) return;
      const xs = yield* pick(g, p, `Special Summon up to ${n} WATER monster(s) from your hand`, cs(), 0, Math.min(n, cs().length), 'good');
      for (const x of xs) if (x.zone === 'hand' && freeM(g, p) >= 0) ss(g, p, x, 'atk'); } }] },
  'Big-Tusked Mammoth': { cont: { forbid: (g, src, a) => a.type === 'attack' && a.c.ctrl !== src.ctrl && summonedNow(g, a.c) }, effs: [markSummon] },

  /* ----- Black ----- */
  'Black Dragon\'s Chick': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Send to the GY: summon Red-Eyes',
    cond: (g, c, p) => g.p[p].hand.some(x => named(x, 'Red-Eyes Black Dragon')),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Black Dragon's Chick to the GY.`); },
    res: function* (g, c, p) { yield* ssFrom(g, p, x => named(x, 'Red-Eyes Black Dragon'), 'Special Summon Red-Eyes Black Dragon from your hand', ['hand']); } }] },
  // "When your opponent would Special Summon exactly 1 monster: negate the Special Summon, and if you do, destroy it."
  'Black Horn of Heaven': { effs: [{ type: 'act', negSummon: true, label: 'Negate the Special Summon',
    cond: (g, c, p, x) => !x.top && !!g.attempt && g.attempt.p !== p && !['normal', 'tribute', 'flip'].includes(g.attempt.how) && g.attempt.cs.length === 1,
    res: function* (g, c, p) { if (g.attempt) { g.attempt.negated = true; log(g, 'The Special Summon was negated.'); } } }] },
  'Black Luster Ritual': ritualSpell('Black Luster Soldier'),
  'Black Luster Soldier': { effs: [] },
  'Black Magic Ritual': ritualSpell('Magician of Black Chaos'),
  // ported from goat-7.js: +500 ATK; when sent from the field to the GY, 500 damage to the opponent.
  'Black Pendant': {
    cont: { atk: (g, src, m) => src.equipTo === m.u && !glassOn(g) ? 500 : 0 },
    effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Black Pendant to which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && equip(g, c, t)) c.flags.pendant = true; } },
    { type: 'trig', loc: 'any', mand: true, label: '500 damage', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy' && ev.snap && ev.snap.flags && ev.snap.flags.pendant,
      res: function* (g, c, p, L2) { const q = L2.ev.prevCtrl != null ? L2.ev.prevCtrl : p; damage(g, opp(q), 500, { src: c, srcP: q }); } }] },
  'Black Potan': { self: { noBattleDestroy: (g, c) => monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && isTuner(x)) },
    effs: [{ type: 'trig', mand: true, label: 'Gain 800 LP',
      on: (g, ev, c) => ev.type === 'move' && ev.c !== c && ev.wasField && ev.from === 'm' && !!ev.snap && ev.snap.faceUp && isTuner(ev.c) && ev.prevCtrl === c.ctrl,
      res: function* (g, c, p) { gain(g, p, 800); } }] },
  'Black Ptera': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Return to the hand',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy' && !ev.battle,
    res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'hand', { reason: 'effect' }); log(g, 'Black Ptera returned to the hand.'); } } }] },
  'Black Stego': { effs: [{ type: 'trig', mand: true, label: 'Change to Defense Position', on: (g, ev, c) => ev.type === 'attack' && ev.t === c && c.pos === 'atk',
    res: function* (g, c, p) { if (onField(c) && c.pos === 'atk') { c.pos = 'def'; g.seq++; log(g, 'Black Stego changed to Defense Position.'); emit(g, { type: 'pos', c, p }); } } }] },
  'Black Tyranno': { self: { directAttack: (g, c) => { const o = opp(c.ctrl); return stOf(g, o).length === 0 && monsOf(g, o).length > 0 && monsOf(g, o).every(x => x.pos !== 'atk'); } }, effs: [] },
  'Black Veloci': { self: { atk: (g, c) => { const b = g.battle; if (!g.inDS || !b) return 0; if (b.a === c && b.t) return 400; if (b.t === c && b.a && b.a.ctrl !== c.ctrl) return -400; return 0; } }, effs: [] },
});
})();
