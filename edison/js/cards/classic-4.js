/* Classic 4: Duelist Kingdom and Battle City Spells (build/classic_batch_4.json). Card scripts for js/engine.js
 (see build/CARD_SCRIPTS.md), registered for Goat only (E.addScripts(obj, 'goat')). Each card follows its text in the
 batch file, played by Goat-era rules. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, choose, move, destroy, ss, draw, damage, gain, pay, search, takeControl, addMod, equip, addRule,
  tokens, fusionSummon, canFusion, negateAttack, name, D, isMon, isSpell, isTrap, isST, onField, faceUp, attr, race,
  baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, live, opp,
  stOnField, emit, forbid, stat, coin, dice, num } = L;

const named = (c, ...ns) => ns.includes(D(c).n);
const baseDef = c => num(D(c).def);
// An Equip Spell: target a face-up monster that passes filter (side: 'own' for your side only), equip it at resolution.
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?', o = {}) => {
  const cands = (g, p) => (o.own ? monsOf(g, p) : fieldMons(g)).filter(m => faceUp(m) && filter(m));
  return { type: 'act', cond: (g, c, p) => cands(g, p).length > 0,
    target: function* (g, c, p, L2) { if (o.pre) yield* o.pre(g, c, p, L2); yield* tgt(g, p, L2, text, cands(g, p), 1, 1, o.hint || 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c) && equip(g, c, t)) { c.flags.eqU = t.u; if (o.post) o.post(g, c, p, L2); } } };
};
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
const isRace = r => m => race(m) === r;
const isAttr = a => m => attr(m) === a;
const noop = { type: 'act', res: function* () {} };
// Did this monster just come to the field from a GY? (the move event right before its summon)
function fromGY(g, x) { for (let i = g.events.length - 1; i >= 0; i--) { const e = g.events[i]; if (e.type === 'move' && e.c === x && e.to === 'm') return e.from === 'gy'; } return false; }
// "This turn" flags for Eye of Illusion, cleared at the End Phase (a cleanup that watches every event from any zone).
const turnFlagCleanup = { type: 'trig', loc: 'any', on: (g, ev) => {
  if (ev.type === 'phase' && ev.ph === 'end') for (const m of fieldMons(g)) if (m.flags.eyeIll) { m.flags.eyeIll = null; m.flags.noBattleDestroy = false; }
  return false; }, res: function* () {} };
// Eye of Illusion's redirect: the attack is negated and the attacker battles the new target here.
// PARTIAL: the engine's attack() keeps its target local (build/ENGINE_TODO.md), so this damage calculation is done in the card.
function miniBattle(g, a, t) {
  const A = stat(g, a, 'atk'), owner = a.ctrl;
  log(g, `${name(a)} battles ${name(t)} instead.`);
  if (t.pos === 'atk') {
    const T = stat(g, t, 'atk');
    if (A > T) { destroy(g, [t], { battle: true, killer: a }); damage(g, t.ctrl, A - T, { battle: true, src: a, srcP: owner }); }
    else if (A < T) { destroy(g, [a], { battle: true, killer: t }); damage(g, owner, T - A, { battle: true, src: t, srcP: t.ctrl }); }
    else if (A > 0) destroy(g, [a, t], { battle: true });
  } else {
    const Dv = stat(g, t, 'def');
    if (A > Dv) destroy(g, [t], { battle: true, killer: a });
    else if (A < Dv) damage(g, owner, Dv - A, { battle: true, src: t, srcP: t.ctrl });
  }
}
const spellcaster = m => faceUp(m) && (race(m) === 'Spellcaster' || race(m) === 'Illusion');

E.addScripts({
  /* ----- Equip Spells ----- */
  // "Activate this card by choosing ATK or DEF": the choice is made as it is activated and kept on the card.
  '7 Completed': { cont: { atk: (g, src, m) => src.equipTo === m.u && src.flags.which === 'atk' ? 700 : 0, def: (g, src, m) => src.equipTo === m.u && src.flags.which === 'def' ? 700 : 0 },
    effs: [equipAct(isRace('Machine'), 'Equip to which face-up Machine monster?', {
      pre: function* (g, c, p, L2) { const i = yield* choose(g, p, '7 Completed: which stat gains 700?', ['ATK', 'DEF']); L2.data.which = i ? 'def' : 'atk'; log(g, `${PN(g, p)} chose ${i ? 'DEF' : 'ATK'}.`); },
      post: (g, c, p, L2) => { c.flags.which = L2.data.which; } })] },
  'Book of Secret Arts': { cont: eqBonus(300, 300), effs: [equipAct(isRace('Spellcaster'), 'Equip to which face-up Spellcaster?')] },
  'Cyber Shield': { cont: eqBonus(500, 0), effs: [equipAct(m => ['Harpie Lady', 'Harpie Lady Sisters'].includes(name(m)), 'Equip to which Harpie Lady?')] },
  'Dragon Nails': { cont: { ...eqBonus(600, 0),
      // "It cannot be destroyed by your opponent's card effects."
      replaceDestroy: (g, src, m, o) => { if (src.equipTo !== m.u || o.battle || o.rule || o.by == null || o.by === m.ctrl) return false; log(g, `${name(m)} was not destroyed (Dragon Nails).`); return true; } },
    effs: [equipAct(isAttr('DARK'), 'Equip to which face-up DARK monster?'),
      // Seen as the equipped monster is destroyed by battle (this card still sits in the Spell/Trap Zone, about to follow it to the GY).
      { type: 'trig', loc: 'any', opt: true, label: 'Revive the monster and re-equip',
        on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && c.zone === 'st' && c.flags.eqU != null && c.flags.eqU === ev.c.u,
        cond: (g, c, p, x) => c.zone === 'gy' && x.ev.c.zone === 'gy' && freeM(g, p) >= 0,
        res: function* (g, c, p, L2) { const m = L2.ev.c; if (m.zone !== 'gy' || c.zone !== 'gy' || !ss(g, p, m)) return;
          if (freeST(g, p) < 0) return; move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'effect' }); if (equip(g, c, m)) { c.flags.eqU = m.u; c.flags.banishOnLeave = true; } else move(g, c, 'ban', { reason: 'effect' }); } }] },
  "Elf's Light": { cont: eqBonus(400, -200), effs: [equipAct(isAttr('LIGHT'), 'Equip to which face-up LIGHT monster?')] },
  'Horn of the Unicorn': { cont: eqBonus(700, 700), effs: [equipAct(),
    { type: 'trig', loc: 'gy', mand: true, label: 'Return to the top of the Deck', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy',
      res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'deckTop', { reason: 'effect' }); log(g, `Horn of the Unicorn returned to the top of ${PN(g, c.owner)}'s Deck.`); } } }] },
  'Invigoration': { cont: eqBonus(400, -200), effs: [equipAct(isAttr('EARTH'), 'Equip to which face-up EARTH monster?')] },
  'Laser Cannon Armor': { cont: eqBonus(300, 300), effs: [equipAct(isRace('Insect'), 'Equip to which face-up Insect?')] },
  'Magical Labyrinth': { effs: [equipAct(m => name(m) === 'Labyrinth Wall', 'Equip to which Labyrinth Wall?'),
    { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Tribute the Wall: summon Wall Shadow',
      cond: (g, c, p) => { const m = fieldMons(g).find(x => x.u === c.equipTo); return !!m && m.ctrl === p && g.p[p].deck.some(x => named(x, 'Wall Shadow')); },
      cost: function* (g, c, p) { const m = fieldMons(g).find(x => x.u === c.equipTo); if (m) { move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(m).n}.`); } },
      res: function* (g, c, p) { if (freeM(g, p) < 0) return; const cs = g.p[p].deck.filter(x => named(x, 'Wall Shadow')); const [x] = yield* pick(g, p, 'Special Summon Wall Shadow from your Deck', cs, 1, 1, 'good'); if (x) ss(g, p, x); shuffleDeck(g, p); } }] },
  // "Only attack the monster equipped with this card": the controller's other face-up monsters can't be attacked.
  // PARTIAL: the controller's face-down monsters stay attackable (the engine's noAttackTarget only covers face-up monsters).
  'Ring of Magnetism': { cont: { ...eqBonus(-500, -500), grant: (g, src, m, flag) => flag === 'noAttackTarget' && !!src.equipTo && m.ctrl === src.ctrl && m.u !== src.equipTo && fieldMons(g).some(x => x.u === src.equipTo && x.ctrl === src.ctrl) },
    effs: [equipAct(() => true, 'Equip to which of your face-up monsters?', { own: true, hint: 'cost' })] },
  'Salamandra': { cont: eqBonus(700, 0), effs: [equipAct(isAttr('FIRE'), 'Equip to which face-up FIRE monster?')] },
  'Shine Palace': { cont: eqBonus(700, 0), effs: [equipAct(isAttr('LIGHT'), 'Equip to which face-up LIGHT monster?')] },
  'Silver Bow and Arrow': { cont: eqBonus(300, 300), effs: [equipAct(isRace('Fairy'), 'Equip to which face-up Fairy?')] },
  // ENGINE: Jinzo (goat-2.js) forbids every Trap activation through its own cont.forbid, and nothing can exempt one player, so
  // "does not negate the effects of its controller's Trap Cards" isn't applied. PARTIAL: "cannot be negated" isn't enforced either.
  'Amplifier': { effs: [equipAct(m => name(m) === 'Jinzo', 'Equip to which Jinzo?'),
    { type: 'trig', loc: 'any', mand: true, label: 'Destroy the equipped monster', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.flags && ev.snap.flags.eqU != null,
      res: function* (g, c, p, L2) { const m = fieldMons(g).find(x => x.u === L2.ev.snap.flags.eqU); if (m) destroy(g, [m], { by: p, src: c }); } }] },
  'Cestus of Dagla': { cont: eqBonus(500, 0), effs: [equipAct(isRace('Fairy'), 'Equip to which face-up Fairy?'),
    { type: 'trig', loc: 'st', mand: true, label: 'Gain the damage as LP', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src && c.equipTo && ev.src.u === c.equipTo && ev.p === opp(c.ctrl),
      res: function* (g, c, p, L2) { gain(g, p, L2.ev.n); } }] },
  'Machine Conversion Factory': { cont: eqBonus(300, 300), effs: [equipAct(isRace('Machine'), 'Equip to which face-up Machine?')] },
  'Magic Formula': { cont: eqBonus(700, 0), effs: [equipAct(m => ['Dark Magician', 'Dark Magician Girl'].includes(name(m)), 'Equip to which Dark Magician or Dark Magician Girl?'),
    { type: 'trig', loc: 'gy', mand: true, label: 'Gain 1000 LP', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy',
      res: function* (g, c, p) { gain(g, c.owner, 1000); } }] },

  /* ----- Normal Spells ----- */
  'Block Attack': { effs: [{ type: 'act', cond: (g, c, p) => oppFaceUp(g, p).some(m => m.pos === 'atk'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change which Attack Position monster to Defense?', oppFaceUp(g, p).filter(m => m.pos === 'atk'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.pos === 'atk') { t.pos = 'def'; g.seq++; log(g, `${name(t)} was changed to Defense Position.`); emit(g, { type: 'pos', c: t, p }); } } }] },
  'Breath of Light': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(m => faceUp(m) && race(m) === 'Rock'),
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => faceUp(m) && race(m) === 'Rock'), { by: p, src: c }); } }] },
  'Change of Heart': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, opp(p)).length > 0 && freeM(g, p) >= 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone === 'm' && t.ctrl !== p) takeControl(g, p, t, true); } }] },
  'De-Spell': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c) => stOnField(g).some(x => x !== c && (x.pos === 'set' || isSpell(x))),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which Spell or Set card?', stOnField(g).filter(x => x !== c && (x.pos === 'set' || isSpell(x))), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; if (t.pos === 'set') log(g, `The Set card was ${D(t).n}.`); if (isSpell(t)) destroy(g, [t], { by: p, src: c }); } }] },
  'Elegant Egotist': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && fieldMons(g).some(m => faceUp(m) && name(m) === 'Harpie Lady') && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Harpie Lady', 'Harpie Lady Sisters')),
    res: function* (g, c, p) { if (freeM(g, p) < 0 || !fieldMons(g).some(m => faceUp(m) && name(m) === 'Harpie Lady')) return;
      const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Harpie Lady', 'Harpie Lady Sisters')); const [x] = yield* pick(g, p, 'Special Summon Harpie Lady or Harpie Lady Sisters', cs, 1, 1, 'good');
      if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x); if (fromDeck) shuffleDeck(g, p); } } }] },
  "Harpie's Feather Duster": { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => stOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { destroy(g, stOf(g, opp(p)), { by: p, src: c }); } }] },
  // ENGINE: forbid has no Flip Summon action, so only manual position changes are stopped.
  'Mesmeric Control': { effs: [{ type: 'act',
    res: function* (g, c, p) { const o = opp(p); addRule(g, (g2, a) => a.type === 'pos' && a.c && a.c.ctrl === o, { startOf: p }); log(g, `${PN(g, o)} can't change battle positions during the next turn.`); } }] },
  'Monster Reborn': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && allCards(g, 'gy').some(x => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' })),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which monster from either GY?', allCards(g, 'gy').filter(x => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' })), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  'Mooyan Curry': { effs: [{ type: 'act',
    res: function* (g, c, p) { const i = yield* choose(g, p, 'Which player gains 200 LP?', ['You', 'Your opponent']); gain(g, i ? opp(p) : p, 200); } }] },
  'Mystic Box': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => monsOf(g, opp(p)).length > 0 && monsOf(g, p).length > 0,
    target: function* (g, c, p, L2) {
      const [a] = yield* tgt(g, p, L2, 'Destroy which of their monsters?', monsOf(g, opp(p)), 1, 1, 'bad');
      const [b] = yield* tgt(g, p, L2, 'Give which of your monsters to your opponent?', monsOf(g, p), 1, 1, 'cost');
      L2.t = [a, b].filter(Boolean); },
    res: function* (g, c, p, L2) { const [a, b] = L2.t; if (!a || !onField(a) || !destroy(g, [a], { by: p, src: c }).length) return;
      if (b && onField(b) && b.zone === 'm' && b.ctrl === p) takeControl(g, opp(p), b, false); } }] },
  // Fusion Materials are noted on the Fusion Monster for De-Fusion.
  'Polymerization': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 || monsOf(g, p).length > 0 ? canFusion(g, p) : false,
    res: function* (g, c, p) { const s0 = g.seq; const fx = yield* fusionSummon(g, p, { from: ['hand', 'm'] });
      if (fx && onField(fx)) fx.flags.fusionMats = g.events.filter(e => e.seq > s0 && e.type === 'move' && e.reason === 'fusion').map(e => e.c.u); } }] },
  'Red Medicine': { effs: [{ type: 'act', res: function* (g, c, p) { gain(g, p, 500); } }] },
  'Remove Trap': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => stOnField(g).some(x => faceUp(x) && isTrap(x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up Trap?', stOnField(g).filter(x => faceUp(x) && isTrap(x)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2).filter(x => faceUp(x) && isTrap(x)), { by: p, src: c }); } }] },
  'Riryoku': { effs: [{ type: 'act', cond: g => fieldMons(g).filter(faceUp).length >= 2,
    target: function* (g, c, p, L2) {
      const [a] = yield* tgt(g, p, L2, 'Halve the ATK of which monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad');
      const [b] = yield* tgt(g, p, L2, 'Which monster gains the lost ATK?', fieldMons(g).filter(m => faceUp(m) && m !== a), 1, 1, 'good');
      L2.t = [a, b].filter(Boolean); },
    res: function* (g, c, p, L2) { const [a, b] = L2.t; if (!a || !onField(a) || !faceUp(a)) return; const A = stat(g, a, 'atk'), lost = A - Math.floor(A / 2);
      addMod(g, a, { atk: -lost, end: true }); log(g, `${name(a)}'s ATK was halved.`);
      if (b && onField(b) && faceUp(b)) { addMod(g, b, { atk: lost, end: true }); log(g, `${name(b)} gained ${lost} ATK.`); } } }] },
  // Swaps the original values; changes from other cards still apply on top.
  'Shield & Sword': { effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
    res: function* (g, c, p) { for (const m of fieldMons(g).filter(faceUp)) { const d = baseDef(m) - baseAtk(m); if (d) addMod(g, m, { atk: d, def: -d, end: true }); } log(g, 'The original ATK and DEF of every face-up monster were switched.'); } }] },
  'Card of Sanctity': { effs: [{ type: 'act',
    cond: (g, c, p) => fieldOf(g, p).some(x => x !== c) && g.p[p].hand.some(x => x !== c) && g.p[p].deck.length >= 2,
    res: function* (g, c, p) { const out = [...fieldOf(g, p).filter(x => x !== c), ...g.p[p].hand.slice()]; for (const x of out) if (x.zone !== 'ban') move(g, x, 'ban', { reason: 'effect', by: p });
      if (out.length) log(g, `${PN(g, p)} banished ${out.length} card${out.length > 1 ? 's' : ''}.`);
      const n = 2 - g.p[p].hand.length; if (n > 0) draw(g, p, n); } }] },
  'Chosen One': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => g.p[p].hand.some(x => x !== c && isMon(x)) && g.p[p].hand.filter(x => x !== c && !isMon(x)).length >= 2,
    res: function* (g, c, p) { const h = g.p[p].hand;
      const [m] = yield* pick(g, p, 'Choose 1 Monster Card', h.filter(isMon), 1, 1, 'good');
      const ns = yield* pick(g, p, 'Choose 2 non-Monster Cards', h.filter(x => !isMon(x)), 2, 2, 'cost');
      const set = [m, ...ns].filter(Boolean); if (set.length < 3) return;
      const x = set[Math.floor(g.rnd() * set.length)]; log(g, `${PN(g, opp(p))} picked ${name(x)} at random.`);
      if (isMon(x)) { ss(g, p, x); for (const y of set) if (y !== x && y.zone === 'hand') move(g, y, 'gy', { reason: 'effect' }); }
      else for (const y of set) if (y.zone === 'hand') move(g, y, 'gy', { reason: 'effect' });
      log(g, `The other cards were sent to the GY.`); } }] },
  // ENGINE: the engine opens no window in the Standby Phase, so this is offered from the hand at your Standby Phase
  // (the card goes to the field as it is activated). PARTIAL: it can't be activated from a Set position.
  'Curse of Fiend': { effs: [{ type: 'trig', loc: 'hand', label: 'Activate Curse of Fiend',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner,
    cond: (g, c, p) => freeST(g, p) >= 0 && fieldMons(g).some(m => m.pos === 'atk' || m.pos === 'def' || m.pos === 'set') && !forbid(g, { type: 'activate', c, eff: {}, p }),
    cost: function* (g, c, p) { move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'activate' }); },
    res: function* (g, c, p) {
      const changed = [];
      for (const m of fieldMons(g)) {
        if (m.pos === 'atk') { m.pos = 'def'; changed.push(m); }
        else if (m.pos === 'def') { m.pos = 'atk'; changed.push(m); }
        else if (m.pos === 'set') { m.pos = 'atk'; changed.push(m); log(g, `The face-down monster was ${name(m)}.`); emit(g, { type: 'flip', c: m, p: m.ctrl }); }
      }
      g.seq++; if (changed.length) log(g, 'Every monster switched its battle position.');
      const us = new Set(changed.map(m => m.u)); addRule(g, (g2, a) => a.type === 'pos' && a.c && us.has(a.c.u), { end: g.turnNo });
      if (onField(c)) move(g, c, 'gy', { reason: 'rule' }); } }] },
  'Dark Magic Curtain': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => !g.summoned[p] && freeM(g, p) >= 0 && g.p[p].deck.some(x => named(x, 'Dark Magician')),
    cost: function* (g, c, p) { pay(g, p, Math.floor(g.p[p].lp / 2)); },
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => named(x, 'Dark Magician')); if (cs.length && freeM(g, p) >= 0) { const [x] = yield* pick(g, p, 'Special Summon Dark Magician from your Deck', cs, 1, 1, 'good'); if (x) ss(g, p, x); } shuffleDeck(g, p);
      addRule(g, (g2, a) => (a.type === 'ns' || a.type === 'ss') && a.p === p, { end: g.turnNo }); } }] },
  'Exchange': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && g.p[opp(p)].hand.length > 0,
    // PARTIAL: the engine keeps every hand card in its owner's hand, so a card taken this way changes owner.
    res: function* (g, c, p) { const o = opp(p), mine = g.p[p].hand.slice(), theirs = g.p[o].hand.slice(); if (!mine.length || !theirs.length) return;
      log(g, `Both players revealed their hands.`);
      const [a] = yield* pick(g, p, 'Add which card from their hand to yours?', theirs, 1, 1, 'bad');
      const [b] = yield* pick(g, o, 'Add which card from their hand to yours?', mine, 1, 1, 'bad');
      const give = (x, to) => { const P = g.p[x.owner]; const i = P.hand.indexOf(x); if (i < 0) return; P.hand.splice(i, 1); x.owner = to; x.ctrl = to; g.p[to].hand.push(x); };
      if (a) give(a, p); if (b) give(b, o); g.seq++;
      log(g, `${PN(g, p)} took ${a ? name(a) : 'nothing'} and ${PN(g, o)} took ${b ? name(b) : 'nothing'}.`); } }] },
  'Exile of the Wicked': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(m => race(m) === 'Fiend'),
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => race(m) === 'Fiend'), { by: p, src: c }); } }] },
  'Hinotama': { effs: [{ type: 'act', res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  'Meteor of Destruction': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].lp > 3000,
    res: function* (g, c, p) { if (g.p[opp(p)].lp > 3000) damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },

  /* ----- Quick-Play Spells ----- */
  'Eye of Illusion': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(spellcaster),
    target: function* (g, c, p, L2) {
      const modes = [['protect', 'Your Spellcasters can’t be destroyed by battle']];
      if (g.tp !== p && oppFaceUp(g, p).length && freeM(g, p) >= 0) modes.push(['steal', 'Take control of a monster']);
      if (g.aw && g.aw.a && g.aw.a.ctrl !== p && onField(g.aw.a) && oppFaceUp(g, p).some(m => m !== g.aw.a)) modes.push(['redirect', 'Change the attack target']);
      const i = modes.length > 1 ? yield* choose(g, p, 'Eye of Illusion: which effect?', modes.map(m => m[1])) : 0; L2.data.mode = modes[i][0];
      if (L2.data.mode === 'steal') yield* tgt(g, p, L2, 'Take control of which monster?', oppFaceUp(g, p), 1, 1, 'bad');
      if (L2.data.mode === 'redirect') { L2.data.a = g.aw.a; yield* tgt(g, p, L2, 'Redirect the attack to which of their monsters?', oppFaceUp(g, p).filter(m => m !== g.aw.a), 1, 1, 'bad'); } },
    res: function* (g, c, p, L2) {
      if (L2.data.mode === 'protect') { // PARTIAL: covers the Spellcasters you control as it resolves
        for (const m of monsOf(g, p).filter(spellcaster)) { m.flags.noBattleDestroy = true; m.flags.eyeIll = g.turnNo; }
        log(g, `${PN(g, p)}'s Spellcasters can't be destroyed by battle this turn.`); }
      else if (L2.data.mode === 'steal') { const t = live(L2)[0]; if (t && faceUp(t) && t.ctrl !== p) takeControl(g, p, t, true); }
      else { const t = live(L2)[0], a = L2.data.a; if (!t || !faceUp(t) || !a || !onField(a) || !g.aw || g.aw.a !== a) return; negateAttack(g); miniBattle(g, a, t); } } },
    turnFlagCleanup] },
  'Monster Recovery': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(m => m.owner === p) && g.p[p].hand.every(x => x.owner === p),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Shuffle which of your monsters into the Deck?', monsOf(g, p).filter(m => m.owner === p), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.zone !== 'm') return; move(g, t, 'deck', { reason: 'effect', by: p });
      const h = g.p[p].hand.slice(); for (const x of h) move(g, x, 'deck', { reason: 'effect' }); shuffleDeck(g, p);
      log(g, `${PN(g, p)} shuffled ${D(t).n} and ${h.length} card${h.length === 1 ? '' : 's'} from the hand into the Deck.`);
      if (h.length) draw(g, p, Math.min(h.length, g.p[p].deck.length) || h.length); } }] },
  'Multiply': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && name(m) === 'Kuriboh'),
    cost: function* (g, c, p) { const [m] = yield* pick(g, p, 'Tribute which Kuriboh?', monsOf(g, p).filter(m => faceUp(m) && name(m) === 'Kuriboh'), 1, 1, 'cost'); if (m) { move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Kuriboh.`); } },
    res: function* (g, c, p) { const n = nFreeM(g, p); if (n) tokens(g, p, { n: 'Kuriboh Token', a: 'DARK', r: 'Fiend', lv: 1, atk: 300, def: 200 }, n, 'def', { noTribute: true }); } }] },
  // "Cards and effects cannot be activated in response": nothing can be activated while this link is on the chain.
  'Anti-Magic Arrows': { effs: [{ type: 'act',
    cond: (g, c, p, x) => g.phase === 'battle' && !x.top && !g.aw && !g.inDS && !fieldMons(g).some(m => m.declared),
    after: (g, c, p, L2) => { addRule(g, (g2, a) => a.type === 'activate' && g2.chain.includes(L2), { end: g.turnNo }); },
    res: function* (g, c, p) { addRule(g, (g2, a) => a.type === 'activate' && a.c && isST(a.c), { end: g.turnNo }); log(g, 'Spell and Trap Cards can’t be activated for the rest of this turn.'); } }] },
  'De-Fusion': { effs: [{ type: 'act', cond: g => fieldMons(g).some(m => faceUp(m) && D(m).k === 'fusion'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which Fusion Monster to the Extra Deck?', fieldMons(g).filter(m => faceUp(m) && D(m).k === 'fusion'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const us = t.flags.fusionMats || [];
      move(g, t, 'extra', { reason: 'effect', by: p }); log(g, `${D(t).n} returned to the Extra Deck.`);
      const mats = us.map(u => g.p[p].gy.find(x => x.u === u));
      if (!us.length || mats.some(x => !x) || nFreeM(g, p) < mats.length) return;
      if (!(yield* L.yn(g, p, `Special Summon ${mats.map(name).join(' and ')} from your GY?`))) return;
      for (const m of mats) ss(g, p, m); } }] },
  'Graceful Dice': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).length > 0,
    res: function* (g, c, p) { const n = dice(g, p) * 100; for (const m of monsOf(g, p)) addMod(g, m, { atk: n, def: n, end: true }); if (monsOf(g, p).length) log(g, `${PN(g, p)}'s monsters gained ${n} ATK and DEF.`); } }] },

  /* ----- Continuous Spells ----- */
  'Burning Land': { effs: [{ type: 'act',
      res: function* (g, c, p) { const fz = allField(g).filter(x => x.zone === 'fz'); if (fz.length) destroy(g, fz, { by: p, src: c }); } },
    { type: 'trig', loc: 'st', mand: true, label: 'The turn player takes 500 damage', on: (g, ev) => ev.type === 'phase' && ev.ph === 'standby',
      res: function* (g, c, p, L2) { damage(g, L2.ev.tp, 500, { src: c, srcP: p }); } }] },
  'Card of Safe Return': { effs: [noop,
    { type: 'trig', loc: 'st', when: true, label: 'Draw 1 card',
      on: (g, ev, c) => ev.type === 'summon' && ev.how !== 'normal' && ev.how !== 'tribute' && ev.how !== 'flip' && ev.cs.some(x => x.owner === c.ctrl && fromGY(g, x)),
      cond: (g, c, p) => g.p[p].deck.length > 0, res: function* (g, c, p) { if (onField(c)) draw(g, p, 1); } }] },
  'Ectoplasmer': { effs: [noop,
    { type: 'trig', loc: 'st', mand: true, opt: true, label: 'Tribute a monster for damage',
      on: (g, ev) => ev.type === 'phase' && ev.ph === 'end', cond: g => monsOf(g, g.tp).some(faceUp),
      res: function* (g, c, p, L2) { const tp = L2.ev.tp; const cs = monsOf(g, tp).filter(faceUp); if (!cs.length) return;
        const [m] = yield* pick(g, tp, 'Tribute which face-up monster (Ectoplasmer)?', cs, 1, 1, 'cost'); if (!m) return;
        const n = Math.floor(baseAtk(m) / 2); move(g, m, 'gy', { reason: 'effect', by: p, tribute: true }); log(g, `${PN(g, tp)} Tributed ${D(m).n}.`);
        if (n > 0) damage(g, opp(tp), n, { src: c, srcP: tp }); } }] },
  // ENGINE: the hand limit of 6 is fixed in the engine's End Phase (no hook to lift it), so this card does nothing yet.
  'Infinite Cards': { effs: [noop] },
  // PARTIAL: Flip Summons aren't stopped (forbid has no Flip Summon action).
  'Insect Barrier': { cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && a.c.ctrl !== src.ctrl && faceUp(a.c) && race(a.c) === 'Insect' }, effs: [noop] },
  // PARTIAL: Flip Summons aren't stopped (forbid has no Flip Summon action).
  'Jam Breeding Machine': { cont: { forbid: (g, src, a) => (a.type === 'ns' || a.type === 'ss') && a.p === src.ctrl && a.c && D(a.c) && D(a.c).n !== 'Slime Token' },
    effs: [noop, { type: 'trig', loc: 'st', mand: true, tags: { ss: 1 }, label: 'Summon a Slime Token', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { if (freeM(g, p) >= 0) tokens(g, p, { n: 'Slime Token', a: 'WATER', r: 'Aqua', lv: 1, atk: 500, def: 500 }, 1, 'atk'); } }] },

  /* ----- Field Spells ----- */
  'Chorus of Sanctuary': { cont: { def: (g, src, m) => m.pos === 'def' ? 500 : 0 }, effs: [noop] },
  // PARTIAL: the Spirit Message replacement for Destiny Board isn't done (it needs a hook into Destiny Board's placement).
  'Dark Sanctuary': { effs: [noop,
    { type: 'trig', loc: 'fz', mand: true, label: 'Toss a coin', on: (g, ev, c) => ev.type === 'attack' && ev.a && ev.a.ctrl !== c.ctrl,
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (!g.aw || g.aw.a !== a || !onField(a)) return;
        if (coin(g, p)) { const n = Math.floor(stat(g, a, 'atk') / 2); negateAttack(g); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } } }] },
}, 'goat');
const oppFaceUp = L.oppFaceUp;
})();
