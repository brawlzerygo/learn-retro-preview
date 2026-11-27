/* Full pool batch 18: Vampire Baby to Archfiend's Roar (build/batches/full/full-18.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text; cards with a
 Goat-only script elsewhere (Vampire Lord, Vengeful Bog Spirit, Wall of Illusion, Wall Shadow, Warrior of Tradition, White
 Magical Hat, Witch of the Black Forest, 7 Completed, Abyss Soldier, Airknight Parshath, Amplifier, Archfiend's Oath) are
 ported here as the shared version. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, setFaceDown, negateAttack, addMod, addCtr,
  equip, addRule, tokens, ritualSummon, canRitual, coin, dice, forbid, num,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, allField, fieldMons,
  freeM, freeST, nFreeM, shuffleDeck, log, PN, has, live, opp, stOnField, spellTrapAct, evSummoned, battleKill, emit } = L;
const atk = L.atk, def = L.def;

const named = (c, n) => D(c).n === n;
const txt = c => { const d = D(c); return d.ps && !/^No (?:Edison|rulings)/.test(d.ps) ? d.ps : d.tx || ''; };
const flipUp = (g, c, pos) => { c.pos = pos; g.seq++; log(g, `${name(c)} was flipped face-up.`); emit(g, { type: 'flip', c, p: c.ctrl }); };
// Equip Spells (o.pre runs before the target is picked, o.post after a successful equip)
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?', o = {}) => {
  const cands = g => fieldMons(g).filter(m => faceUp(m) && filter(m));
  return { type: 'act', cond: g => cands(g).length > 0,
    cost: o.cost,
    target: function* (g, c, p, L2) { if (o.pre) yield* o.pre(g, c, p, L2); yield* tgt(g, p, L2, text, cands(g), 1, 1, o.hint || 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c) && equip(g, c, t)) { c.flags.eqU = t.u; if (o.post) o.post(g, c, p, L2); } } };
};
const eqOf = (g, c) => c.equipTo ? fieldMons(g).find(x => x.u === c.equipTo) || null : null;
// "Must first be Special Summoned with X": it can't be Special Summoned from the GY unless it was once summoned from the
// hand or Deck (as classic-2.js). ENGINE: no generic "can't be Special Summoned" flag, so other summons from the hand/Deck pass.
const nomiLock = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src && !src.nomi };
const nomiMark = { type: 'trig', on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.to === 'm' && ['hand', 'deck'].includes(ev.from)) c.nomi = true; return false; }, res: function* () {} };
const noSSFromGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src };
// "When this card inflicts battle damage to your opponent"
const dealtBattleDmg = (ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl;
// Vampire Lady / Vampire Lord: declare a card type, the opponent sends 1 card of that type from their Deck to the GY.
function* vampireMill(g, c, p) {
  const o = opp(p), types = ['Monster', 'Spell', 'Trap'];
  const i = yield* choose(g, p, `${D(c).n}: declare a card type`, types); log(g, `${PN(g, p)} declared ${types[i]}.`);
  const fit = x => (i === 0 ? isMon(x) : i === 1 ? isSpell(x) : isTrap(x));
  const cs = g.p[o].deck.filter(fit); if (!cs.length) { log(g, `${PN(g, o)} has no ${types[i]} Card in the Deck.`); shuffleDeck(g, o); return; }
  const [x] = yield* pick(g, o, `Send 1 ${types[i]} Card from your Deck to the GY`, cs, 1, 1, 'cost');
  if (x) { move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${PN(g, o)} sent ${name(x)} from the Deck to the GY.`); }
  shuffleDeck(g, o);
}
// A battle worked out in the card (as full-03.js battleInstead): the engine's attack() keeps its target local, so an attack
// redirect negates the declared attack and the attacker battles the new target here. ENGINE: attack redirect.
function battleInstead(g, a, t) {
  negateAttack(g);
  if (!a || !t || a.zone !== 'm' || t.zone !== 'm' || !faceUp(a)) return;
  log(g, `${name(a)} battles ${t.pos === 'set' ? 'a face-down monster' : name(t)} instead.`);
  if (t.pos === 'set') flipUp(g, t, 'def');
  const A = atk(g, a), ac = a.ctrl, tc = t.ctrl;
  const noDmg = q => [a, t].some(x => x.ctrl === q && faceUp(x) && has(g, x, 'noBattleDamage')) || g.p[q].noBattleDamage === g.turnNo;
  if (t.pos === 'atk') {
    const T = atk(g, t);
    if (A > T) { if (!noDmg(tc)) damage(g, tc, A - T, { battle: true, src: a, srcP: ac }); destroy(g, [t], { battle: true, killer: a }); }
    else if (A < T) { if (!noDmg(ac)) damage(g, ac, T - A, { battle: true, src: t, srcP: tc }); destroy(g, [a], { battle: true, killer: t }); }
    else if (A > 0 || T === 0) destroy(g, [a, t], { battle: true });
  } else {
    const Dv = def(g, t);
    if (A > Dv) { if (has(g, a, 'piercing') && !noDmg(tc)) damage(g, tc, A - Dv, { battle: true, src: a, srcP: ac }); destroy(g, [t], { battle: true, killer: a }); }
    else if (A < Dv && !noDmg(ac)) damage(g, ac, Dv - A, { battle: true, src: t, srcP: tc });
  }
}
// Absolute End: the declared attack becomes a direct attack (worked out here, as battleInstead).
function directInstead(g, a) {
  negateAttack(g);
  if (!a || a.zone !== 'm' || !faceUp(a)) return;
  const q = opp(a.ctrl); log(g, `${name(a)}'s attack became a direct attack.`);
  const noDmg = g.p[q].noBattleDamage === g.turnNo;
  if (!noDmg) damage(g, q, atk(g, a), { battle: true, src: a, srcP: a.ctrl, direct: true });
}
// Archfiend's Oath (as goat-7.js): you declare from the names in your own deck list.
function ownNames(g, p) { const s = new Set(); for (const z of ['deck', 'hand', 'gy', 'ban', 'extra']) for (const x of g.p[p][z]) s.add(D(x).n); for (const x of allField(g)) if (x.owner === p) s.add(D(x).n); return [...s].sort(); }
const convulsion = g => allField(g).some(x => faceUp(x) && named(x, 'Convulsion of Nature'));
// where a monster came to the field from in this summon's group
const cameFromDeck = (g, x, grp) => g.events.some(e => e.type === 'move' && e.c === x && e.to === 'm' && e.group === grp && e.from === 'deck');
const umiOn = g => [g.p[0].fz, g.p[1].fz].some(f => f && faceUp(f) && (named(f, 'Umi') || named(f, 'A Legendary Ocean')));
const TYPES = ['Aqua', 'Beast', 'Beast-Warrior', 'Dinosaur', 'Divine-Beast', 'Dragon', 'Fairy', 'Fiend', 'Fish', 'Insect', 'Machine', 'Plant', 'Psychic', 'Pyro', 'Reptile', 'Rock', 'Sea Serpent', 'Spellcaster', 'Thunder', 'Warrior', 'Winged Beast', 'Zombie'];
const ATTRS = ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND', 'DIVINE'];
const isArchfiend = x => isMon(x) && /Archfiend/.test(D(x).n);
const isTuner = x => !!D(x).tu;

E.addScripts({
  /* ----- Vampires ----- */
  // Kills are remembered on the card (they clear if it leaves the field); every one still in a GY at the end of the Battle
  // Phase is Special Summoned.
  'Vampire Baby': { effs: [{ type: 'trig', tags: { ss: 1 }, label: 'Special Summon the monster it destroyed',
    on: (g, ev, c) => {
      if (battleKill(ev, c)) { c.flags.vbKills = (c.flags.vbKills || []).filter(k => k.t === g.turnNo).concat([{ t: g.turnNo, x: ev.c }]); return false; }
      return ev.type === 'phase' && ev.ph === 'bpEnd' && (c.flags.vbKills || []).some(k => k.t === g.turnNo && k.x.zone === 'gy'); },
    cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) { const xs = (c.flags.vbKills || []).filter(k => k.t === g.turnNo && k.x.zone === 'gy').map(k => k.x); c.flags.vbKills = [];
      for (const x of xs) if (x.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, x, 'atk'); } }] },
  // ENGINE: "cannot be Special Summoned by other ways" is only enforced from the GY (no generic flag).
  'Vampire Genesis': { cont: noSSFromGY,
    proc: { label: 'Special Summon (banish Vampire Lord)', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && named(x, 'Vampire Lord')),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish 1 Vampire Lord you control', monsOf(g, p).filter(x => faceUp(x) && named(x, 'Vampire Lord')), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished Vampire Lord.`); } } },
    effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Discard a Zombie: revive a lower Zombie',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(z => isMon(z) && race(z) === 'Zombie' && g.p[p].gy.some(y => isMon(y) && race(y) === 'Zombie' && lv(y) < lv(z))),
      cost: function* (g, c, p, L2) { const cs = g.p[p].hand.filter(z => isMon(z) && race(z) === 'Zombie' && g.p[p].gy.some(y => isMon(y) && race(y) === 'Zombie' && lv(y) < lv(z)));
        const [z] = yield* pick(g, p, 'Discard 1 Zombie monster', cs, 1, 1, 'cost'); if (!z) return; L2.data.lv = lv(z); move(g, z, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(z)}.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, `Special Summon which Zombie (Level ${(L2.data.lv || 1) - 1} or lower)?`, g.p[p].gy.filter(y => isMon(y) && race(y) === 'Zombie' && lv(y) < (L2.data.lv || 0)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  'Vampire Lady': { effs: [{ type: 'trig', mand: true, label: 'Declare a card type', on: (g, ev, c) => dealtBattleDmg(ev, c),
    res: function* (g, c, p) { yield* vampireMill(g, c, p); } }] },
  // Port of goat-3.js. The mark is made as it reaches its owner's GY destroyed by the opponent's card effect (from the field,
  // the hand or the Deck), while its owner controlled it.
  'Vampire Lord': { effs: [
    { type: 'trig', mand: true, label: 'Declare a card type', on: (g, ev, c) => dealtBattleDmg(ev, c), res: function* (g, c, p) { yield* vampireMill(g, c, p); } },
    { type: 'trig', loc: 'gy', on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.to === 'gy' && ev.destroyed && !ev.battle && ev.by != null && ev.by !== c.owner && ev.prevCtrl === c.owner) c.flags.vlTurn = g.turnNo; return false; }, res: function* () {} },
    { type: 'trig', loc: 'gy', mand: true, opt: true, tags: { ss: 1 }, label: 'Special Summon itself',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner && c.flags.vlTurn != null && c.flags.vlTurn < g.turnNo,
      res: function* (g, c, p) { if (c.zone !== 'gy') return; c.flags.vlTurn = null; ss(g, p, c, 'atk'); } }] },
  // Port of classic-5.js.
  'Vengeful Bog Spirit': { effs: [{ type: 'act', res: function* () {} }],
    cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && (a.c.turnIn === g.turnNo && a.c.summonType || g.events.some(e => e.type === 'summon' && e.turn === g.turnNo && e.cs.includes(a.c))) } },
  // Control changes make no event, so the equipped monster's controller is compared at each game event.
  // PARTIAL: a control change is noticed at the next event (the End Phase return is seen as the next turn starts).
  'Vengeful Servant': { effs: [equipAct(() => true, 'Equip to which face-up monster?', { post: (g, c, p, L2) => { const m = eqOf(g, c); if (m) { c.flags.vsU = m.u; c.flags.vsCtrl = m.ctrl; } } }),
    { type: 'trig', loc: 'st', mand: true, label: 'Damage to the new controller',
      on: (g, ev, c) => { const m = eqOf(g, c); if (!m) { c.flags.vsCtrl = null; return false; }
        if (c.flags.vsU !== m.u) { c.flags.vsU = m.u; c.flags.vsCtrl = m.ctrl; return false; }
        if (m.ctrl !== c.flags.vsCtrl) { c.flags.vsCtrl = m.ctrl; c.flags.vsTo = m.ctrl; return true; } return false; },
      res: function* (g, c, p) { const m = eqOf(g, c); if (!m) return; damage(g, c.flags.vsTo != null ? c.flags.vsTo : m.ctrl, baseAtk(m), { src: c, srcP: p }); } }] },
  'Vengeful Shinobi': { effs: [{ type: 'trig', mand: true, label: 'Draw 1 card', on: (g, ev, c) => ev.type === 'attack' && ev.t === c && c.pos === 'atk',
    res: function* (g, c, p) { draw(g, p, 1); } }] },
  // Port of classic-3.js: after damage calculation the attacker returns to the hand (unless it was destroyed in the battle).
  'Wall of Illusion': { effs: [{ type: 'trig', loc: 'any', mand: true, label: 'Return the attacker to the hand',
    on: (g, ev, c) => ev.type === 'dsEnd' && ev.t === c && ev.a && ev.a.ctrl !== (onField(c) ? c.ctrl : c.owner),
    res: function* (g, c, p, L2) { const a = L2.ev.a; if (a && onField(a) && a.zone === 'm') { const n = name(a); move(g, a, 'hand', { reason: 'effect', by: p }); log(g, `${n} returned to the hand.`); } } }] },
  // The Token's damage starts no chain: it is dealt as the Token leaves the field.
  'Wall of Ivy': { effs: [
    { type: 'trig', mand: true, faceDownOk: true, tags: { ss: 1 }, label: 'Summon an Ivy Token to their field', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
      cond: (g, c, p) => freeM(g, opp(p)) >= 0,
      res: function* (g, c, p) { const [t] = tokens(g, opp(p), { n: 'Ivy Token', a: 'EARTH', r: 'Plant', lv: 1, atk: 0, def: 0 }, 1, 'def'); if (t) t.flags.ivyBy = c.u; } },
    { type: 'trig', loc: 'any', on: (g, ev, c) => {
      if (ev.type === 'move' && ev.destroyed && ev.c.flags && ev.c.flags.ivyBy === c.u && ev.prevCtrl != null) { ev.c.flags.ivyBy = null; log(g, 'The Ivy Token was destroyed.'); damage(g, ev.prevCtrl, 300, { src: c, srcP: c.owner }); }
      return false; }, res: function* () {} }] },
  'Wall of Thorns': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!(g.aw && g.aw.t && g.aw.t.ctrl === p && faceUp(g.aw.t) && race(g.aw.t) === 'Plant'),
    res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)).filter(x => x.pos === 'atk'), { by: p, src: c }); } }] },
  // Port of classic-2.js.
  'Wall Shadow': { cont: nomiLock, effs: [nomiMark] },
  // Face-down monsters show no Type, so only face-up Warriors are destroyed.
  'Warrior Elimination': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(x => faceUp(x) && race(x) === 'Warrior'),
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => faceUp(x) && race(x) === 'Warrior'), { by: p, src: c }); } }] },
  'Warrior Lady of the Wasteland': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Summon an EARTH Warrior from the Deck',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && attr(x) === 'EARTH' && race(x) === 'Warrior' && D(x).atk !== '?' && baseAtk(x) <= 1500),
    res: function* (g, c, p) { if (freeM(g, p) < 0) return; const cs = g.p[p].deck.filter(x => isMon(x) && attr(x) === 'EARTH' && race(x) === 'Warrior' && D(x).atk !== '?' && baseAtk(x) <= 1500);
      const [x] = yield* pick(g, p, 'Special Summon an EARTH Warrior with 1500 or less ATK', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  // Port of goat-5.js (a plain Fusion; the recipe is read from the text).
  'Warrior of Tradition': { effs: [] },
  'White Dragon Ritual': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && canRitual(g, p, { monster: x => named(x, 'Paladin of White Dragon') }),
    res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, 'Paladin of White Dragon') }); } }] },
  // The protection is a destruction replacement read from the GY, for that one Dark Hole card until it leaves the field.
  // PARTIAL: it works while a White Hole sits in a GY (a banished White Hole drops it).
  'White Hole': {
    cont: { loc: 'gy', replaceDestroy: (g, src, m, o) => { if (!g.whiteHole || o.battle || !o.src) return false; const w = g.whiteHole.find(e => e.dh === o.src.u && e.p === m.ctrl && e.wh === src.u); if (!w) return false; log(g, `${name(m)} was not destroyed (White Hole).`); return true; } },
    effs: [
      { type: 'act', cond: (g, c, p, x) => spellTrapAct(x.top) && x.top.p !== p && named(x.top.c, 'Dark Hole') && !x.top.negated,
        target: function* (g, c, p, L2) { L2.data.dh = g.chain[g.chain.length - 1].c.u; },
        res: function* (g, c, p, L2) { (g.whiteHole || (g.whiteHole = [])).push({ dh: L2.data.dh, p, wh: c.u }); log(g, `${PN(g, p)}'s monsters can't be destroyed by that Dark Hole.`); } },
      { type: 'trig', loc: 'gy', on: (g, ev) => { if (g.whiteHole && ev.type === 'move' && ev.wasField) g.whiteHole = g.whiteHole.filter(e => e.dh !== ev.c.u); return false; }, res: function* () {} }] },
  // Port of classic-2.js.
  'White Magical Hat': { effs: [{ type: 'trig', mand: true, label: 'Random discard', on: (g, ev, c) => dealtBattleDmg(ev, c),
    res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, opp(p))} discarded ${name(x)} at random.`); } }] },
  'White Magician Pikeru': { effs: [{ type: 'trig', mand: true, label: 'Gain 400 LP per monster', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    res: function* (g, c, p) { gain(g, p, 400 * monsOf(g, p).length); } }] },
  'White Night Dragon': { effs: [
    // PARTIAL: the mandatory negation is offered as an optional response (the engine has no automatic negation hook).
    { type: 'quick', ds: true, label: 'Negate the Spell/Trap that targets it',
      cond: (g, c, p, x) => spellTrapAct(x.top) && !x.top.negated && (x.top.t || []).includes(c),
      target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated) return; T.negBy = p; L.negate(g, T, true); } },
    // ENGINE: attack redirect; the attacker battles this card here (see battleInstead).
    { type: 'trig', label: 'Send a Spell/Trap: take the attack',
      on: (g, ev, c) => ev.type === 'attack' && ev.t && ev.t !== c && ev.t.ctrl === c.ctrl && faceUp(ev.t) && ev.a && ev.a.ctrl !== c.ctrl,
      cond: (g, c, p) => stOf(g, p).length > 0 && !!g.aw,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send 1 Spell/Trap you control to the GY', stOf(g, p), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); } },
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (!g.aw || g.aw.a !== a || !onField(c) || !faceUp(c)) return; battleInstead(g, a, c); } }] },
  'White Ninja': { effs: [{ type: 'trig', mand: true, faceDownOk: true, tags: { destroy: 1 }, label: 'Destroy a Defense Position monster', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c) => fieldMons(g).some(x => x !== c && x.pos !== 'atk'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Defense Position monster?', fieldMons(g).filter(x => x !== c && x.pos !== 'atk'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2).filter(x => x.pos !== 'atk'), { by: p }); } }] },
  'White Potan': { self: { noBattleDestroy: (g, c) => monsOf(g, c.ctrl).some(x => faceUp(x) && isTuner(x)) },
    effs: [{ type: 'trig', mand: true, label: '500 damage',
      on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && ev.c !== c && ev.prevCtrl === c.ctrl && ev.snap && ev.snap.faceUp && isTuner(ev.c),
      res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  'White-Horned Dragon': { effs: [{ type: 'trig', mand: true, label: 'Banish Spells from their GY',
    on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute', 'special', 'fusion', 'synchro', 'ritual']),
    cond: (g, c, p) => g.p[opp(p)].gy.some(isSpell),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish up to 5 Spell Cards from their GY', g.p[opp(p)].gy.filter(isSpell), 1, 5, 'bad'); },
    res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: p }); if (!xs.length) return;
      log(g, `${PN(g, p)} banished ${xs.map(name).join(', ')}.`); if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 300 * xs.length }); log(g, `${name(c)} gained ${300 * xs.length} ATK.`); } } }] },
  // The card sent from the hand is a cost (not a discard). Monsters it destroys by battle can't activate their effects
  // while they stay in the GY.
  'Wicked-Breaking Flamberge - Baou': {
    cont: { atk: (g, src, m) => src.equipTo === m.u ? 500 : 0 },
    effs: [equipAct(() => true, 'Equip to which face-up monster?', { cost: function* (g, c, p) {
        const h = g.p[p].hand.filter(x => x !== c); const [x] = yield* pick(g, p, 'Send 1 card from your hand to the GY', h, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); } } }),
      { type: 'trig', loc: 'st', on: (g, ev, c) => {
        if (ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && ev.killer && c.equipTo && ev.killer.u === c.equipTo && ev.prevCtrl !== c.ctrl && isMon(ev.c)) {
          const v = ev.c; v.flags.negated = true; g.pend = g.pend.filter(t => t.c !== v);
          addRule(g, (g2, a) => a.type === 'activate' && a.c === v && v.zone === 'gy'); log(g, `${D(v).n}'s effects are negated.`); }
        return false; }, res: function* () {} }] },
  // Activated in the GY for its owner (ruling): no battle damage for them for the rest of the turn.
  'Winged Kuriboh': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'No battle damage this turn',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p) { g.p[p].noBattleDamage = g.turnNo; log(g, `${PN(g, p)} takes no battle damage this turn.`); } }] },
  // ENGINE: "must be Special Summoned with Transcendent Wings" is only enforced from the GY (see nomiLock).
  'Winged Kuriboh LV10': { cont: nomiLock, effs: [nomiMark,
    { type: 'quick', tags: { destroy: 1 }, label: 'Tribute: destroy their Attack Position monsters',
      cond: (g, c, p) => g.phase === 'battle' && g.tp !== p && !g.inDS && monsOf(g, opp(p)).some(x => x.pos === 'atk'),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Winged Kuriboh LV10.`); },
      res: function* (g, c, p) { const out = destroy(g, monsOf(g, opp(p)).filter(x => x.pos === 'atk'), { by: p }); const n = out.reduce((s, x) => s + baseAtk(x), 0); if (n) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  // PARTIAL: "banished instead of being sent to the GY" is done as the Spell reaches the GY (no banish-instead hook in move()).
  'Winged Kuriboh LV9': {
    self: { atk: (g, c) => 500 * g.p[opp(c.ctrl)].gy.filter(isSpell).length, def: (g, c) => 500 * g.p[opp(c.ctrl)].gy.filter(isSpell).length },
    cont: { forbid: (g, src, a) => (a.type === 'ss' || a.type === 'ns') && a.c !== src && a.p === src.ctrl && a.c.id === src.id },
    effs: [
      { type: 'quick', loc: 'hand', tags: { ss: 1 }, label: 'Special Summon (Chain Link 3 or higher)',
        cond: (g, c, p) => g.chain.length >= 2 && !g.chain.some(l => l.c === c) && freeM(g, p) >= 0 && !monsOf(g, p).some(x => faceUp(x) && named(x, 'Winged Kuriboh LV9')),
        res: function* (g, c, p) { if (c.zone === 'hand' && !monsOf(g, p).some(x => faceUp(x) && named(x, 'Winged Kuriboh LV9'))) ss(g, p, c, 'atk'); } },
      { type: 'trig', on: (g, ev, c) => {
        if (ev.type === 'move' && ev.wasField && ev.to === 'gy' && ev.c.zone === 'gy' && isSpell(ev.c) && ev.snap && ev.snap.faceUp) { move(g, ev.c, 'ban', { reason: 'rule', noLater: true }); log(g, `${name(ev.c)} was banished instead.`); }
        return false; }, res: function* () {} }] },
  'Winged Minion': { effs: [{ type: 'ign', label: 'Tribute: a Fiend gains 700 ATK/DEF',
    cond: (g, c) => fieldMons(g).some(x => x !== c && faceUp(x) && race(x) === 'Fiend'),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Winged Minion.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which face-up Fiend gains 700 ATK and DEF?', fieldMons(g).filter(x => faceUp(x) && race(x) === 'Fiend'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: 700, def: 700 }); log(g, `${name(t)} gained 700 ATK and DEF.`); } } }] },
  // Once for each Trap Card activation (marked on that chain link).
  'Winged Rhynos': { effs: [{ type: 'quick', label: 'Return this card to the hand',
    cond: (g, c, p, x) => !g.inDS && spellTrapAct(x.top) && isTrap(x.top.c) && !(x.top.data.rhynos || []).includes(c.u),
    target: function* (g, c, p) { const T = g.chain[g.chain.length - 1]; (T.data.rhynos || (T.data.rhynos = [])).push(c.u); },
    res: function* (g, c, p) { if (onField(c) && faceUp(c)) { move(g, c, 'hand', { reason: 'effect', by: p }); log(g, 'Winged Rhynos returned to the hand.'); } } }] },
  'Winged Sage Falcos': { effs: [{ type: 'trig', when: true, label: 'Put the monster on top of their Deck',
    on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl && ev.snap && ev.snap.pos === 'atk',
    res: function* (g, c, p, L2) { const x = L2.ev.c; if (x.zone === 'gy') { move(g, x, 'deckTop', { reason: 'effect', by: p }); log(g, `${name(x)} was put on top of the Deck.`); } } }] },
  'Witch Doctor of Chaos': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Banish a monster from a GY', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: g => [...g.p[0].gy, ...g.p[1].gy].some(isMon),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which monster from a GY?', [...g.p[opp(p)].gy, ...g.p[p].gy].filter(isMon), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const x = L2.t[0]; if (x && x.zone === 'gy') { move(g, x, 'ban', { reason: 'effect', by: p }); log(g, `${name(x)} was banished.`); } } }] },
  'Witch Doctor of Sparta': { effs: [{ type: 'trig', mand: true, label: '500 damage',
    on: (g, ev, c) => ev.type === 'summon' && ev.cs.some(x => x !== c && cameFromDeck(g, x, ev.group)),
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  // Original 2010 text: "When this card is sent from the field to the Graveyard, add 1 monster with 1500 or less DEF".
  // No once-per-turn and no lock on the added card's name (both added by later errata).
  'Witch of the Black Forest': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Add a monster with 1500 or less DEF',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy',
    res: function* (g, c, p) { yield* search(g, p, m => isMon(m) && num(D(m).def) <= 1500 && D(m).def !== '?', 'Add which monster with 1500 or less DEF?'); } }] },

  /* ----- numbers ----- */
  '3-Hump Lacooda': { effs: [{ type: 'ign', label: 'Tribute 2 Lacooda: draw 3',
    cond: (g, c, p) => monsOf(g, p).filter(x => faceUp(x) && named(x, '3-Hump Lacooda')).length >= 3 && g.p[p].deck.length >= 3,
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Tribute 2 3-Hump Lacooda', monsOf(g, p).filter(x => faceUp(x) && named(x, '3-Hump Lacooda')), 2, 2, 'cost');
      for (const x of xs) move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed 2 3-Hump Lacooda.`); },
    res: function* (g, c, p) { draw(g, p, 3); } }] },
  // Face-down monsters show no Level, so only face-up Level 4 monsters are destroyed.
  '4-Starred Ladybug of Doom': { effs: [{ type: 'trig', mand: true, faceDownOk: true, tags: { destroy: 1 }, label: 'Destroy their Level 4 monsters', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)).filter(x => faceUp(x) && lv(x) === 4), { by: p }); } }] },
  // The draw is a trigger of the first face-up "7" (Imperial Order can negate it); checked at each event, once per card.
  '7': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Three 7s: draw 3',
      on: (g, ev, c) => { const ss7 = stOf(g, c.ctrl).filter(x => faceUp(x) && named(x, '7')); return ss7.length >= 3 && ss7[0] === c && !c.flags.sevenDone; },
      cond: (g, c, p) => stOf(g, p).filter(x => faceUp(x) && named(x, '7')).length >= 3,
      cost: function* (g, c) { c.flags.sevenDone = true; },
      res: function* (g, c, p) { draw(g, p, 3); destroy(g, stOnField(g).filter(x => faceUp(x) && named(x, '7')), { by: p, src: c }); } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Gain 700 LP', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy',
      res: function* (g, c) { gain(g, c.owner, 700); } }] },
  // Port of classic-4.js.
  '7 Completed': { cont: { atk: (g, src, m) => src.equipTo === m.u && src.flags.which === 'atk' ? 700 : 0, def: (g, src, m) => src.equipTo === m.u && src.flags.which === 'def' ? 700 : 0 },
    effs: [equipAct(m => race(m) === 'Machine', 'Equip to which face-up Machine monster?', {
      pre: function* (g, c, p, L2) { const i = yield* choose(g, p, '7 Completed: which stat gains 700?', ['ATK', 'DEF']); L2.data.which = i ? 'def' : 'atk'; log(g, `${PN(g, p)} chose ${i ? 'DEF' : 'ATK'}.`); },
      post: (g, c, p, L2) => { c.flags.which = L2.data.which; } })] },
  // PARTIAL: the ATK becomes 2400 for the whole Damage Step (the engine has no damage calculation window).
  '8-Claws Scorpion': { effs: [
    { type: 'ign', opt: true, label: 'Set this card', cond: (g, c) => faceUp(c),
      res: function* (g, c) { if (onField(c) && faceUp(c)) { setFaceDown(g, c); c.posChanged = true; } } },
    { type: 'trig', on: (g, ev, c) => {
      if (ev.type === 'dsStart' && ev.a === c && ev.t && ev.t.pos === 'set') { addMod(g, c, { set: 2400, which: 'atk', scorp: true }); log(g, '8-Claws Scorpion\'s ATK became 2400.'); }
      if (ev.type === 'dsEnd' && ev.a === c) c.mods = c.mods.filter(m => !m.scorp);
      return false; }, res: function* () {} }] },
  'Abare Ushioni': { effs: [{ type: 'ign', opt: true, label: 'Toss a coin and call it',
    res: function* (g, c, p) { const call = (yield* choose(g, p, 'Call it', ['Heads', 'Tails'])) === 0; log(g, `${PN(g, p)} called ${call ? 'Heads' : 'Tails'}.`);
      if (coin(g, p) === call) damage(g, opp(p), 1000, { src: c, srcP: p }); else damage(g, p, 1000, { src: c, srcP: p }); } }] },
  // Opponent's monsters may attack directly this turn; an attack declared on a monster is turned into a direct attack.
  // PARTIAL: the converted attack is worked out in the card (its Damage Step gets no windows).
  'Absolute End': {
    cont: { loc: 'gy', grant: (g, src, c, flag) => flag === 'directAttack' && !!g.absEnd && g.absEnd.turn === g.turnNo && c.ctrl === g.absEnd.atkP && onField(c) },
    effs: [
      { type: 'act', cond: (g, c, p) => g.tp !== p,
        res: function* (g, c, p) { g.absEnd = { turn: g.turnNo, atkP: opp(p) }; log(g, `${PN(g, opp(p))}'s attacks become direct attacks this turn.`);
          if (g.aw && g.aw.t && g.aw.a && g.aw.a.ctrl === opp(p)) directInstead(g, g.aw.a); } },
      { type: 'trig', loc: 'gy', mand: true, label: 'The attack becomes a direct attack',
        on: (g, ev) => ev.type === 'attack' && !!ev.t && !!g.absEnd && g.absEnd.turn === g.turnNo && ev.a.ctrl === g.absEnd.atkP && !g.absDone,
        cond: (g, c, p, x) => { if (g.absEnd && g.absEnd.by == null) g.absEnd.by = c.u; return g.absEnd.by === c.u; },
        res: function* (g, c, p, L2) { const a = L2.ev.a; if (g.aw && g.aw.a === a) directInstead(g, a); } }] },
  'Absorbing Kid from the Sky': { effs: [{ type: 'trig', mand: true, label: 'Gain LP',
    on: (g, ev, c) => battleKill(ev, c), cond: (g, c) => onField(c) && faceUp(c),
    res: function* (g, c, p, L2) { gain(g, p, 300 * num(D(L2.ev.c).lv)); } }] },
  // Port of goat-3.js.
  'Abyss Soldier': { effs: [{ type: 'ign', opt: true, label: 'Discard a WATER: return a card to the hand',
    cond: (g, c, p) => g.p[p].hand.some(x => isMon(x) && attr(x) === 'WATER') && allField(g).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 WATER monster', g.p[p].hand.filter(x => isMon(x) && attr(x) === 'WATER'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which card to its owner’s hand?', allField(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; const nm = t.pos === 'set' ? 'a face-down card' : name(t); move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${nm} returned to the hand.`); } }] },
  'Abyssal Designator': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp > 1000,
    cost: function* (g, c, p) { pay(g, p, 1000); },
    target: function* (g, c, p, L2) { const t = yield* choose(g, p, 'Declare a Type', TYPES); const a = yield* choose(g, p, 'Declare an Attribute', ATTRS);
      L2.data.r = TYPES[t]; L2.data.a = ATTRS[a]; log(g, `${PN(g, p)} declared ${ATTRS[a]} ${TYPES[t]}.`); },
    res: function* (g, c, p, L2) { const o = opp(p), fit = x => isMon(x) && race(x) === L2.data.r && attr(x) === L2.data.a;
      const cs = [...g.p[o].hand, ...g.p[o].deck].filter(fit); if (!cs.length) { log(g, `${PN(g, o)} has no such monster.`); return; }
      const [x] = yield* pick(g, o, `Send 1 ${L2.data.a} ${L2.data.r} monster from your hand or Deck to the GY`, cs, 1, 1, 'cost');
      if (x) { const fromDeck = x.zone === 'deck'; move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${PN(g, o)} sent ${name(x)} to the GY.`); if (fromDeck) shuffleDeck(g, o); } } }] },
  'Acid Rain': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(x => faceUp(x) && race(x) === 'Machine'),
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => faceUp(x) && race(x) === 'Machine'), { by: p, src: c }); } }] },
  // PARTIAL: a Flip effect of a monster that this card destroys is dropped (it is no longer on the field when triggers run).
  'Acid Trap Hole': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(x => x.pos === 'set'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which face-down Defense Position monster?', fieldMons(g).filter(x => x.pos === 'set'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.pos !== 'set' || t.zone !== 'm') return; flipUp(g, t, 'def');
      if (def(g, t) <= 2000) destroy(g, [t], { by: p, src: c }); else if (onField(t)) setFaceDown(g, t); } }] },
  // Halves the original ATK (kept on the card; it ends if the monster is turned face-down or leaves the field).
  'Adhesion Trap Hole': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.sw && g.sw.p !== p && g.sw.cs.some(x => onField(x) && faceUp(x)),
    target: function* (g, c, p, L2) { L2.data.cs = g.sw.cs.slice(); },
    res: function* (g, c, p, L2) { for (const x of L2.data.cs) if (onField(x) && faceUp(x) && x.zone === 'm') { x.flags.baseAtk = Math.floor(baseAtk(x) / 2); log(g, `${name(x)}'s original ATK was halved.`); } } }] },
  // The monsters that took part in a damage calculation this turn are marked (the mark clears if they leave the field).
  'After the Struggle': { effs: [
    { type: 'act', cond: g => g.phase === 'main1', res: function* (g, c, p) { g.ats = g.turnNo; log(g, 'Monsters that battle this turn are destroyed in the End Phase.'); } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the monsters that battled',
      on: (g, ev, c) => {
        if (ev.type === 'afterCalc' && g.ats === g.turnNo) { for (const x of [ev.a, ev.t]) if (x && onField(x)) x.flags.atsCalc = g.turnNo; return false; }
        return ev.type === 'phase' && ev.ph === 'end' && g.ats === g.turnNo && c.zone === 'gy' && fieldMons(g).some(x => x.flags.atsCalc === g.turnNo); },
      cond: g => g.ats === g.turnNo,
      res: function* (g, c, p) { g.ats = null; destroy(g, fieldMons(g).filter(x => x.flags.atsCalc === g.turnNo), { by: p, src: c }); } }] },
  // The roll is mandatory; the summon is optional.
  'Agido': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Roll a die: revive a Fairy',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p) { const n = dice(g, p); const cs = g.p[p].gy.filter(x => isMon(x) && race(x) === 'Fairy' && (n === 6 ? lv(x) >= 6 : lv(x) === n));
      if (!cs.length || freeM(g, p) < 0 || !(yield* yn(g, p, `Special Summon a Level ${n === 6 ? '6 or higher' : n} Fairy from your GY?`))) return;
      const [x] = yield* pick(g, p, 'Special Summon which Fairy?', cs, 1, 1, 'good'); if (x && x.zone === 'gy') ss(g, p, x, 'atk'); } }] },
  // Port of goat-1.js.
  'Airknight Parshath': { self: { piercing: true },
    effs: [{ type: 'trig', mand: true, label: 'Draw 1 card', on: (g, ev, c) => dealtBattleDmg(ev, c),
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  // Sending the monster is a cost; a Token leaves no card in the GY, so it gives no LP.
  'Altar for Tribute': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).length > 0,
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Send which monster you control to the GY?', monsOf(g, p), 1, 1, 'cost'); if (!x) return;
      const a = baseAtk(x), tok = D(x).k === 'token'; move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); L2.data.n = tok ? 0 : a; },
    res: function* (g, c, p, L2) { if (L2.data.n) gain(g, p, L2.data.n); } }] },
  // Control changes make no event, so the controller is compared at each game event (the mark clears when it is turned
  // face-down or leaves the field). PARTIAL: a control change is noticed at the next event.
  'Ameba': { effs: [{ type: 'trig', mand: true, label: '2000 damage to the new controller',
    on: (g, ev, c) => { if (!faceUp(c)) return false; if (c.flags.amCtrl == null) { c.flags.amCtrl = c.ctrl; return false; }
      if (c.ctrl !== c.flags.amCtrl) { c.flags.amCtrl = c.ctrl; if (!c.flags.amUsed) { c.flags.amUsed = true; c.flags.amTo = c.ctrl; return true; } } return false; },
    res: function* (g, c, p) { damage(g, c.flags.amTo != null ? c.flags.amTo : p, 2000, { src: c, srcP: opp(p) }); } }] },
  'Amphibious Bugroth MK-3': { self: { directAttack: g => umiOn(g) } },
  // Port of classic-4.js. ENGINE: Jinzo's Trap lock can't exempt its controller (the first effect is not done), and
  // "can't be negated" has no hook.
  'Amplifier': { effs: [equipAct(m => name(m) === 'Jinzo', 'Equip to which Jinzo?'),
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the equipped monster', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.flags && ev.snap.flags.eqU != null,
      res: function* (g, c, p, L2) { const m = fieldMons(g).find(x => x.u === L2.ev.snap.flags.eqU); if (m) destroy(g, [m], { by: p, src: c }); } }] },
  'An Owl of Luck': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Put a Field Spell on top of the Deck', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isSpell(x) && D(x).sub === 'Field'); if (!cs.length) return;
      const [x] = yield* pick(g, p, 'Choose a Field Spell Card from your Deck', cs, 1, 1, 'good'); if (!x) return; log(g, `${PN(g, p)} chose ${name(x)}.`);
      const necro = allField(g).some(f => faceUp(f) && named(f, 'Necrovalley'));
      if (necro && !forbid(g, { type: 'search', p }) && (yield* yn(g, p, `Add ${name(x)} to your hand instead?`))) { move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(x)} to the hand.`); shuffleDeck(g, p); }
      else { shuffleDeck(g, p); move(g, x, 'deckTop', { reason: 'effect' }); log(g, `${PN(g, p)} put ${name(x)} on top of the Deck.`); } } }] },
  // The summon from the hand is a Spell Speed 1 effect (ruling), so it is an Ignition effect here.
  'Andro Sphinx': { cont: noSSFromGY, self: { cantAttack: (g, c) => c.turnIn === g.turnNo },
    effs: [
      { type: 'ign', loc: 'hand', tags: { ss: 1 }, label: 'Pay 500 LP: Special Summon',
        cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].lp > 500 && allField(g).some(x => faceUp(x) && named(x, 'Pyramid of Light')),
        cost: function* (g, c, p) { pay(g, p, 500); },
        res: function* (g, c, p) { if (c.zone === 'hand' && allField(g).some(x => faceUp(x) && named(x, 'Pyramid of Light'))) ss(g, p, c, 'atk'); } },
      { type: 'trig', loc: 'any', mand: true, label: 'Half the destroyed monster’s ATK as damage',
        on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.snap && ev.snap.pos !== 'atk' && ev.prevCtrl !== c.ctrl,
        res: function* (g, c, p, L2) { const n = Math.floor((L2.ev.snap.atk || 0) / 2); if (n) damage(g, L2.ev.prevCtrl, n, { src: c, srcP: opp(L2.ev.prevCtrl) }); } }] },
  // Each player picks at resolution; the lower Level is sent to the GY and its player takes 1000 (a tie returns both).
  'Ante': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && g.p[opp(p)].hand.length > 0,
    res: function* (g, c, p) { const o = opp(p); if (!g.p[p].hand.length || !g.p[o].hand.length) return;
      const [a] = yield* pick(g, p, 'Ante: reveal 1 card from your hand', g.p[p].hand, 1, 1, 'good'); const [b] = yield* pick(g, o, 'Ante: reveal 1 card from your hand', g.p[o].hand, 1, 1, 'good');
      if (!a || !b) return; const la = isMon(a) ? lv(a) : 0, lb = isMon(b) ? lv(b) : 0; log(g, `${PN(g, p)} revealed ${name(a)} and ${PN(g, o)} revealed ${name(b)}.`);
      if (la === lb) return; const [x, q] = la < lb ? [a, p] : [b, o]; move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${name(x)} was sent to the GY.`); damage(g, q, 1000, { src: c, srcP: p }); } }] },
  // A card that can hold Spell Counters is read from its text.
  'Apprentice Magician': { effs: [
    { type: 'trig', mand: true, label: 'Place a Spell Counter', on: (g, ev, c) => evSummoned(ev, c) && faceUp(c),
      cond: (g, c) => allField(g).some(x => x !== c && faceUp(x) && !named(x, 'Apprentice Magician') && /Spell Counter/.test(txt(x))),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Place a Spell Counter on which card?', allField(g).filter(x => x !== c && faceUp(x) && !named(x, 'Apprentice Magician') && /Spell Counter/.test(txt(x))), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addCtr(g, t, 'spell', 1); log(g, `${name(t)} got a Spell Counter.`); } } },
    { type: 'trig', loc: 'any', tags: { ss: 1 }, label: 'Summon a Level 2 or lower Spellcaster face-down',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed,
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && race(x) === 'Spellcaster' && lv(x) <= 2),
      res: function* (g, c, p) { if (freeM(g, p) < 0) return; const cs = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Spellcaster' && lv(x) <= 2);
        const [x] = yield* pick(g, p, 'Special Summon a Level 2 or lower Spellcaster face-down', cs, 1, 1, 'good'); if (x) { log(g, `${PN(g, p)} showed ${name(x)}.`); ss(g, p, x, 'set'); } shuffleDeck(g, p); } }] },
  // Activation: an opponent's draw outside the Draw Phase among the last game events. Then each such draw (once per
  // effect, however many cards) draws 2 with no chain.
  'Appropriate': { effs: [
    { type: 'act', cond: (g, c, p) => g.events.slice(-8).some(e => e.type === 'move' && e.reason === 'draw' && e.c.owner === opp(p) && e.phase !== 'draw' && e.turn === g.turnNo), res: function* () {} },
    { type: 'trig', loc: 'st', on: (g, ev, c) => {
      if (ev.type === 'move' && ev.reason === 'draw' && ev.to === 'hand' && ev.c.owner === opp(c.ctrl) && ev.phase !== 'draw' && faceUp(c) && c.flags.apGrp !== ev.group && !g.chain.some(l => l.c === c)) {
        c.flags.apGrp = ev.group; log(g, 'Appropriate: draw 2 cards.'); draw(g, c.ctrl, 2); }
      return false; }, res: function* () {} }] },
  'Arcane Archer of the Forest': { self: { noAttackTarget: (g, c) => monsOf(g, c.ctrl).some(x => faceUp(x) && race(x) === 'Plant') },
    effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Tribute a Plant: destroy a Spell/Trap',
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Plant') && stOnField(g).length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 Plant monster', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Plant'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap Card?', stOnField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  // Port of goat-7.js: you declare from the names in your own deck list (the known top card first under Convulsion of Nature).
  "Archfiend's Oath": { effs: [{ type: 'act', res: function* () {} },
    { type: 'ign', loc: 'st', opt: true, label: 'Pay 500: declare a card', cond: (g, c, p) => g.p[p].lp > 500 && g.p[p].deck.length > 0,
      cost: function* (g, c, p) { pay(g, p, 500); },
      target: function* (g, c, p, L2) { let ns = ownNames(g, p); const top = g.p[p].deck[g.p[p].deck.length - 1];
        if (top && convulsion(g)) ns = [D(top).n, ...ns.filter(n => n !== D(top).n)];
        const i = ns.length > 1 ? yield* choose(g, p, 'Declare a card name', ns) : 0; L2.data.n = ns[i]; log(g, `${PN(g, p)} declared ${ns[i]}.`); },
      res: function* (g, c, p, L2) { const top = g.p[p].deck[g.p[p].deck.length - 1]; if (!top) return; log(g, `${PN(g, p)} excavated ${name(top)}.`);
        if (D(top).n === L2.data.n && !forbid(g, { type: 'search', p })) { move(g, top, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(top)} to the hand.`); }
        else move(g, top, 'gy', { reason: 'effect' }); } }] },
  "Archfiend's Roar": { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.p[p].lp > 500 && freeM(g, p) >= 0 && g.p[p].gy.some(isArchfiend),
      cost: function* (g, c, p) { pay(g, p, 500); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Archfiend monster?', g.p[p].gy.filter(isArchfiend), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && ss(g, p, t, 'atk')) { t.flags.noTribute = true; t.flags.roarBy = c.u; t.flags.roarEnd = g.turnNo; } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the summoned Archfiend',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(x => x.flags.roarBy === c.u && x.flags.roarEnd === g.turnNo),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.flags.roarBy === c.u && x.flags.roarEnd === g.turnNo), { by: p, src: c }); } }] },
});
})();
