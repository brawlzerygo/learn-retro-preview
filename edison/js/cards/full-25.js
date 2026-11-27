/* Full pool batch 25: Moisture Creature to Pharaoh's Treasure (build/batches/full/full-25.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings.
 Cards with a Goat-only script elsewhere (Mokey Mokey King, Mudora, Muko, Mystik Wok, Newdoria, Nimble Momonga,
 Ninja Grandmaster Sasuke, Parasite Paracide, Penguin Knight, Penguin Soldier, Peten the Dark Clown) are ported here as the
 shared version; the Goat-only ones still win under Goat. Morphing Jar #2 and Mushroom Man #2 are Goat only. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, takeControl, addMod, equip, addRule, tokens,
  ritualSummon, canRitual, winDuel, endBattle, search, name, D, isMon, isST, isSpell, isTrap, isExtraD, onField, faceUp, attr,
  race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, nFreeM, shuffleDeck, log, PN, has, live, opp,
  oppFaceUp, evSummoned, emit, forbid, stat, negd } = L;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const tx = c => D(c).ps || D(c).tx || '';
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
const killFoe = (g, c, p, t) => { if (t && onField(t) && t.zone === 'm') destroy(g, [t], { by: p, src: c }); };
// Flip effect shape (classic-2.js)
const flip = (label, more) => ({ type: 'trig', mand: true, faceDownOk: true, label, on: (g, ev, c) => ev.type === 'flip' && ev.c === c, ...more });
// Equip Spells: target a face-up monster that passes filter, equip it at resolution
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c) && equip(g, c, t)) c.flags.f25eq = t.u; } });
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'atk' }); };
const toAtk = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'def') return; c.pos = 'atk'; g.seq++; log(g, `${name(c)} was changed to Attack Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'def' }); };
// "by an effect of a card controlled by your opponent" (classic-2.js): the move's own `by` when given, else the turn player.
// PARTIAL: an opponent's Quick Effect on your own turn without `by` is missed.
const byOpp = (g, ev, c) => ev.by != null ? ev.by !== c.owner : g.tp !== c.owner;
// "Cannot be Special Summoned". ENGINE: only enforced from the GY (no generic flag; build/ENGINE_TODO.md).
const noSSFromGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src };
// Spirit return: during the End Phase of the turn it was Normal Summoned or flipped face-up (as full-09.js)
const spiritReturn = { type: 'trig', mand: true, label: 'Return to the hand',
  on: (g, ev, c) => {
    if ((ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how)) || (ev.type === 'flip' && ev.c === c)) c.flags.spirit = g.turnNo;
    return ev.type === 'phase' && ev.ph === 'end' && c.flags.spirit === g.turnNo; },
  res: function* (g, c) { if (onField(c) && faceUp(c)) { move(g, c, 'hand', { reason: 'effect' }); log(g, `${name(c)} returned to the hand.`); } } };
const kycooOn = (g, p) => monsOf(g, opp(p)).some(x => faceUp(x) && named(x, 'Kycoo the Ghost Destroyer') && !x.flags.negated);
// "Archfiend" monsters (as full-02.js: Summoned Skull and Fiend Skull Dragon are Archfiends by their OCG names)
const isArchName = n => /Archfiend/.test(n) || ['Summoned Skull', 'Fiend Skull Dragon'].includes(n);
const isArchfiend = c => isMon(c) && isArchName(name(c));
const isNinja = c => /Ninja/.test(name(c));
const isNormalMon = c => D(c).k === 'normal';
const randomOf = (g, arr) => arr[Math.floor(g.rnd() * arr.length)];
const kindOf = c => isMon(c) ? 0 : isSpell(c) ? 1 : 2;
const KINDS = ['Monster', 'Spell', 'Trap'];
// the turn number of player q's next Draw Phase
const nextDrawTurn = (g, q) => g.tp === q && g.phase === 'draw' ? g.turnNo + 2 : g.tp === q ? g.turnNo + 2 : g.turnNo + 1;
function skipDraw(g, q) { const T = nextDrawTurn(g, q); addRule(g, (g2, a) => a.type === 'draw' && a.p === q && g2.phase === 'draw' && g2.turnNo === T, { end: T }); }
// Battle damage player q is about to take in the current battle (for Nutrient Z). Reads the same numbers as damage calculation.
function battleDmgTo(g, q) {
  const b = g.battle; if (!b || !b.a || !onField(b.a)) return 0;
  const a = b.a, t = b.t; const A = stat(g, a, 'atk');
  if (g.p[q].noBattleDamage === g.turnNo) return 0;
  const noDmg = c => c && c.ctrl === q && faceUp(c) && has(g, c, 'noBattleDamage');
  if (noDmg(a) || noDmg(t)) return 0;
  if (!t) return a.ctrl !== q ? A : 0;
  if (!onField(t)) return 0;
  if (t.pos === 'atk') { const T = stat(g, t, 'atk'); if (A > T && t.ctrl === q) return A - T; if (T > A && a.ctrl === q) return T - A; return 0; }
  if (t.pos === 'set') return 0;   // unknown until it is flipped
  const Dv = stat(g, t, 'def');
  if (A < Dv && a.ctrl === q) return Dv - A;
  if (A > Dv && t.ctrl === q && has(g, a, 'piercing')) return A - Dv;
  return 0;
}
/* A Trap that answers a moment with no response window in the engine (as full-26.js): a trigger that only fires while the
 card is Set (and wasn't Set this turn). It flips the card face-up, counts as a Trap Card activation at Spell Speed 2, and
 sends the card to the GY after it resolves. */
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });
// Tribute a monster you control as a cost
function* tributeCost(g, p, cands, text) { const [m] = yield* pick(g, p, text, cands, 1, 1, 'cost'); if (!m) return null; const nm = m.pos === 'set' ? 'a face-down monster' : name(m); const s = { lv: lv(m), atk: stat(g, m, 'atk'), def: stat(g, m, 'def') }; move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); return s; }
// Morale Boost: the Equip Spell Cards (and monsters treated as Equip Spells) equipped right now
const equipsNow = g => allField(g).filter(x => x.zone === 'st' && x.equipTo && !isTrap(x));
// Neko Mane King: it becomes the End Phase. The turn player can do nothing more this turn except in the End Phase.
// PARTIAL: the turn player stays in their Main Phase with only "End turn" left (and Flip Summons, which the engine
// can't forbid); a battle already in the Damage Step finishes its damage calculation.
function toEndPhase(g) {
  const q = g.tp, T = g.turnNo;
  if (g.phase === 'battle') endBattle(g);
  g.noBP[q] = true; g.noSummon[q] = true;
  addRule(g, (g2, a) => g2.turnNo === T && g2.phase !== 'end' && a.p === q && ['activate', 'setST', 'ns', 'set', 'ss'].includes(a.type), { end: T });
  addRule(g, (g2, a) => g2.turnNo === T && ((a.type === 'attack' && a.c && a.c.ctrl === q) || (a.type === 'pos' && a.c && a.c.ctrl === q)), { end: T });
  log(g, 'It became the End Phase of this turn.');
}

E.addScripts({
  /* ----- M ----- */
  // A third Tribute is offered only while the opponent has a Spell or Trap Card (ruling); 2 Tributes give no effect.
  'Moisture Creature': { self: { tributes: (g, c, p) => stOf(g, opp(p)).length ? [3] : [] },
    effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy their Spells and Traps',
      on: (g, ev, c) => evSummoned(ev, c, ['tribute']) && (ev.tribs || []).length === 3,
      res: function* (g, c, p) { destroy(g, stOf(g, opp(p)), { by: p, src: c }); } }] },
  // "When ... you can": misses the timing if it leaves the field in the middle of a chain.
  'Mokey Mokey King': { effs: [{ type: 'trig', loc: 'any', when: true, tags: { ss: 1 }, label: 'Summon Mokey Mokey from the GY',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to !== 'm',
    cond: (g, c) => freeM(g, c.owner) >= 0 && g.p[c.owner].gy.some(x => named(x, 'Mokey Mokey') && canSS(g, c.owner, x)),
    res: function* (g, c) { const p = c.owner; for (const x of g.p[p].gy.filter(y => named(y, 'Mokey Mokey'))) { if (freeM(g, p) < 0) break; ss(g, p, x, 'atk'); } } }] },
  // Mokey Mokey on your field at resolution become 3000 ATK until the End Phase; one Summoned later that turn does too (ruling).
  'Mokey Mokey Smackdown': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Mokey Mokey become 3000 ATK',
      on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.destroyed && ev.from === 'm' && ev.prevCtrl === c.ctrl && ev.snap && ev.snap.mon && ev.snap.faceUp !== false && ev.snap.race === 'Fairy'
        && monsOf(g, c.ctrl).some(x => faceUp(x) && named(x, 'Mokey Mokey')),
      res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; (g.f25smack || (g.f25smack = {}))[p] = g.turnNo;
        const ms = monsOf(g, p).filter(x => faceUp(x) && named(x, 'Mokey Mokey')); for (const m of ms) addMod(g, m, { set: 3000, which: 'atk', end: true });
        if (ms.length) log(g, `${PN(g, p)}'s Mokey Mokey ${ms.length > 1 ? 'have' : 'has'} 3000 ATK this turn.`); } },
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
      if (ev.type === 'summon' && g.f25smack && g.f25smack[c.ctrl] === g.turnNo) for (const m of ev.cs) if (m.ctrl === c.ctrl && faceUp(m) && named(m, 'Mokey Mokey') && !m.mods.some(x => x.set === 3000)) { addMod(g, m, { set: 3000, which: 'atk', end: true }); log(g, `${name(m)} has 3000 ATK this turn.`); }
      return false; } }] },
  'Molten Destruction': { cont: { atk: (g, src, m) => attr(m) === 'FIRE' ? 500 : 0, def: (g, src, m) => attr(m) === 'FIRE' ? -400 : 0 }, effs: [actNoop] },
  // Face-up Special Summons from the GY only (ruling: Set by The Shallow Grave, no draw).
  'Molten Zombie': { effs: [{ type: 'trig', mand: true, label: 'Draw 1 card',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'gy' && ev.to === 'm' && ev.reason === 'summon' && c.pos !== 'set',
    res: function* (g, c, p) { draw(g, p, 1); } }] },
  'Monk Fighter': { self: { noBattleDamage: true } },
  // Morale Boost applies without a chain. PARTIAL: the 1000 LP for a new equip is gained at the next game event after the
  // equip resolves (the engine's equip() emits no event).
  'Morale Boost': { effs: [{ type: 'act', res: function* (g, c) { if (onField(c)) c.flags.f25mb = equipsNow(g).map(x => x.u); } },
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
      if (!faceUp(c) || negd(g, c)) return false;
      if (!c.flags.f25mb) c.flags.f25mb = equipsNow(g).map(x => x.u);
      const seen = c.flags.f25mb;
      if (ev.type === 'move' && ev.wasField && ev.from === 'st' && seen.includes(ev.c.u) && ev.c !== c) {
        c.flags.f25mb = seen.filter(u => u !== ev.c.u);
        log(g, `Morale Boost: ${PN(g, ev.prevCtrl)}'s Equip Card left the field.`); damage(g, ev.prevCtrl, 1000, { src: c, srcP: c.ctrl });
      }
      for (const x of equipsNow(g)) if (!c.flags.f25mb.includes(x.u)) { c.flags.f25mb.push(x.u); log(g, `Morale Boost: ${PN(g, x.ctrl)} equipped ${name(x)}.`); gain(g, x.ctrl, 1000); }
      return false; } }] },
  'Mountain': { cont: { atk: (g, src, m) => ['Dragon', 'Winged Beast', 'Thunder'].includes(race(m)) ? 200 : 0, def: (g, src, m) => ['Dragon', 'Winged Beast', 'Thunder'].includes(race(m)) ? 200 : 0 }, effs: [actNoop] },
  // +1000 in your next Standby Phase after it inflicts battle damage (once, however often it hit that turn); the gain ends
  // when it leaves the field or is turned face-down (its flags reset).
  'Mucus Yolk': { self: { directAttack: true, atk: (g, c) => c.flags.f25yolk || 0 },
    effs: [{ type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl) c.flags.f25yolkP = true; return false; } },
      { type: 'trig', mand: true, label: 'Gain 1000 ATK', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && !!c.flags.f25yolkP,
        res: function* (g, c) { if (!onField(c) || !faceUp(c)) return; c.flags.f25yolkP = false; c.flags.f25yolk = (c.flags.f25yolk || 0) + 1000; g.seq++; log(g, `${name(c)} gained 1000 ATK.`); } }] },
  'Mudora': { self: { atk: (g, c) => 200 * g.p[c.ctrl].gy.filter(x => isMon(x) && race(x) === 'Fairy').length } },
  'Muka Muka': { self: { atk: (g, c) => 300 * g.p[c.ctrl].hand.length, def: (g, c) => 300 * g.p[c.ctrl].hand.length } },
  // Cards drawn while the targeted draw effect resolves (the next resolution after this one) go straight to the GY (classic-5.js).
  'Muko': { effs: [
    { type: 'act', ds: true, cond: (g, c, p, x) => !!(x.top && !x.top.negated && x.top.c !== c && /\bdraws? (\d|a card|one|two|three|cards?)\b|\bdraw until\b/i.test(tx(x.top.c)) && !/Draw Phase/i.test(tx(x.top.c).replace(/draw \d/ig, ''))),
      res: function* (g) { g.muko = { group: g.group + 1, turn: g.turnNo }; } },
    { type: 'trig', loc: 'any', on: (g, ev) => {
      if (ev.type === 'move' && ev.reason === 'draw' && g.muko && g.muko.turn === g.turnNo && ev.group === g.muko.group && ev.c.zone === 'hand') { log(g, `${PN(g, ev.c.owner)} drew ${D(ev.c).n}, and Muko sent it to the GY.`); move(g, ev.c, 'gy', { reason: 'discard' }); }
      return false; }, res: noop }] },
  // Tribute 1 Insect (face-down too) as the cost; the Tokens can't be Tributed for a Tribute Summon.
  'Multiplication of Ants': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => { const ins = monsOf(g, p).filter(x => race(x) === 'Insect'); return ins.length > 0 && nFreeM(g, p) + 1 >= 2; },
    cost: function* (g, c, p) { yield* tributeCost(g, p, monsOf(g, p).filter(x => race(x) === 'Insect'), 'Tribute 1 Insect monster'); },
    res: function* (g, c, p) { if (nFreeM(g, p) < 2) return; tokens(g, p, { n: 'Army Ant Token', a: 'EARTH', r: 'Insect', lv: 4, atk: 500, def: 1200 }, 2, 'def', { noTribute: true }); } }] },
  // Any number of differently named "Dark Scorpion" monsters from the hand (it resolves even if Don Zaloog is gone).
  'Mustering of the Dark Scorpions': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && named(x, 'Don Zaloog')) && freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && /Dark Scorpion/.test(D(x).n) && canSS(g, p, x)),
    res: function* (g, c, p) {
      for (let i = 0; i < 5 && freeM(g, p) >= 0; i++) {
        const done = monsOf(g, p).filter(x => x.f25must === c.u).map(x => D(x).n);
        const xs = g.p[p].hand.filter(x => isMon(x) && /Dark Scorpion/.test(D(x).n) && !done.includes(D(x).n) && canSS(g, p, x));
        if (!xs.length) break;
        const [x] = yield* pick(g, p, 'Special Summon a Dark Scorpion from your hand? (1 of each)', xs, 0, 1, 'good'); if (!x) break;
        const pi = yield* choose(g, p, `${D(x).n}: which position?`, ['Attack Position', 'Defense Position']);
        if (ss(g, p, x, pi ? 'def' : 'atk')) x.f25must = c.u;
      } } }] },
  // ATK or DEF is chosen when it is activated (ruling): the current value of the Tributed monster.
  'Mystik Wok': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).length > 0,
    cost: function* (g, c, p, L2) {
      const s = yield* tributeCost(g, p, monsOf(g, p), 'Tribute which monster?'); if (!s) return;
      const i = yield* choose(g, p, 'Mystik Wok: gain which?', [`ATK (${s.atk})`, `DEF (${s.def})`]); L2.data.n = i ? s.def : s.atk; },
    res: function* (g, c, p, L2) { if (L2.data.n) gain(g, p, L2.data.n); } }] },

  /* ----- N ----- */
  // Each player may Normal Summon or Set 2 more monsters while it is face-up (counted from its activation).
  'Narrow Pass': { cont: { forbid: (g, src, a) => (a.type === 'ns' || a.type === 'set') && !!src.flags.f25np && src.flags.f25np[a.p] >= 2 },
    effs: [{ type: 'act', cond: g => monsOf(g, 0).length <= 2 && monsOf(g, 1).length <= 2,
      res: function* (g, c) { if (onField(c)) { c.flags.f25np = [0, 0]; log(g, 'Each player can Normal Summon or Set 2 more monsters.'); } } },
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
      if (!c.flags.f25np) return false;
      if (ev.type === 'summon' && ['normal', 'tribute'].includes(ev.how)) c.flags.f25np[ev.p]++;
      if (ev.type === 'set' && ev.c && isMon(ev.c)) c.flags.f25np[ev.p]++;
      return false; } }] },
  // The equipped monster's identity is noted at equip time (the engine clears equipTo before this card reaches the GY).
  'Necklace of Command': { effs: [equipAct(),
    { type: 'trig', loc: 'gy', when: true, label: 'Draw 1 or a random discard',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.from === 'st' && ev.to === 'gy' && !!ev.snap && !!ev.snap.flags && !!ev.snap.flags.f25eq
        && g.events.some(e => e.type === 'move' && e.group === ev.group && e.c.u === ev.snap.flags.f25eq && e.battle && e.destroyed && e.to === 'gy' && e.prevCtrl === ev.prevCtrl),
      res: function* (g, c, p) {
        const o = opp(p), opts = ['Draw 1 card', 'Discard 1 random card from their hand'];
        const i = g.p[o].hand.length ? yield* choose(g, p, 'Necklace of Command: which effect?', opts) : 0;
        if (i === 0) draw(g, p, 1);
        else { const x = randomOf(g, g.p[o].hand); move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, o)} discarded ${name(x)} at random.`); } } }] },
  // Mandatory; from the field, hand or Deck, during the opponent's turn, by the opponent's card effect.
  'Neko Mane King': { effs: [{ type: 'trig', loc: 'gy', mand: true, ds: true, label: 'It becomes the End Phase',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && g.tp !== c.owner && ['effect', 'discard'].includes(ev.reason) && byOpp(g, ev, c) && (!ev.wasField || ev.prevCtrl === c.owner),
    res: function* (g) { toEndPhase(g); } }] },
  "Newdoria": { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy a monster',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: g => fieldMons(g).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  // The owner activates it; gaining LP is mandatory, the Summons are optional.
  'Nimble Momonga': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Gain 1000, summon Nimble Momongas',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p) { gain(g, p, 1000);
      const cs = g.p[p].deck.filter(x => named(x, 'Nimble Momonga') && canSS(g, p, x)); const n = Math.min(cs.length, nFreeM(g, p)); if (!n) return;
      const xs = yield* pick(g, p, 'Special Summon any number of Nimble Momonga face-down (none is fine)', cs, 0, n, 'good');
      for (const x of xs) ss(g, p, x, 'set'); shuffleDeck(g, p); } }] },
  // Face-up Defense Position at the start of the Damage Step (a face-down one isn't flipped yet). Doesn't target.
  'Ninja Grandmaster Sasuke': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the Defense Position monster',
    on: (g, ev, c) => ev.type === 'dsStart' && ev.a === c && !!ev.t && ev.t.pos === 'def',
    res: function* (g, c, p, L2) { killFoe(g, c, p, L2.ev.t); } }] },
  // The target is marked; the mark is lost if it leaves the field or is turned face-down, and the Trap stays (rulings).
  'Ninjitsu Art of Decoy': {
    cont: { grant: (g, src, c, flag) => flag === 'noBattleDestroy' && c.zone === 'm' && faceUp(c) && c.flags.f25decoy === src.u },
    effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isNinja(x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Ninja can’t be destroyed by battle?', monsOf(g, p).filter(x => faceUp(x) && isNinja(x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c)) { t.flags.f25decoy = c.u; g.seq++; log(g, `${name(t)} can't be destroyed by battle.`); } } }] },
  // Tribute a face-up Ninja (cost); its Level on the field +3 is the limit. When this card leaves the field, the monster is destroyed.
  'Ninjitsu Art of Transformation': { effs: [{ type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => monsOf(g, p).some(n => faceUp(n) && isNinja(n) && [...g.p[p].hand, ...g.p[p].deck].some(x => isMon(x) && ['Beast', 'Winged Beast', 'Insect'].includes(race(x)) && D(x).k !== 'ritual' && lv(x) <= lv(n) + 3)),
      cost: function* (g, c, p, L2) { const s = yield* tributeCost(g, p, monsOf(g, p).filter(n => faceUp(n) && isNinja(n)), 'Tribute 1 face-up Ninja monster'); L2.data.lv = s ? s.lv : 0; },
      res: function* (g, c, p, L2) {
        if (!onField(c) || freeM(g, p) < 0) return;
        const xs = [...g.p[p].hand, ...g.p[p].deck].filter(x => isMon(x) && ['Beast', 'Winged Beast', 'Insect'].includes(race(x)) && D(x).k !== 'ritual' && lv(x) <= L2.data.lv + 3 && canSS(g, p, x));
        const [x] = yield* pick(g, p, `Special Summon a Beast, Winged Beast or Insect (Level ${L2.data.lv + 3} or lower) from your hand or Deck`, xs, 1, 1, 'good');
        if (!x) return; const fromDeck = x.zone === 'deck';
        if (ss(g, p, x, 'atk')) c.flags.f25m = x.u; if (fromDeck) shuffleDeck(g, p); } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the monster',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && !!ev.snap && !!ev.snap.flags && !!ev.snap.flags.f25m && fieldMons(g).some(m => m.u === ev.snap.flags.f25m),
      res: function* (g, c, p, L2) { const m = fieldMons(g).find(x => x.u === L2.ev.snap.flags.f25m); if (m) destroy(g, [m], { by: p }); } }] },
  // Damage equal to the monster's original ATK. It is destroyed when the monster isn't on the opponent's side anymore.
  'Nitro Unit': { effs: [{ type: 'act',
      cond: (g, c, p) => oppFaceUp(g, p).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Nitro Unit to which of their monsters?', oppFaceUp(g, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.ctrl !== p && onField(c) && equip(g, c, t)) c.flags.f25eq = t.u; } },
    { type: 'trig', loc: 'any', mand: true, label: 'Damage equal to its ATK',
      on: (g, ev, c) => ev.type === 'move' && !!c.flags.f25eq && ev.c.u === c.flags.f25eq && ev.battle && ev.destroyed && ev.to === 'gy',
      res: function* (g, c, p, L2) { const m = L2.ev.c; damage(g, L2.ev.prevCtrl === p ? opp(p) : L2.ev.prevCtrl, baseAtk(m), { src: c, srcP: p }); } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy Nitro Unit',
      on: (g, ev, c) => { if (!c.equipTo || c.flags.f25nd) return false; const m = fieldMons(g).find(x => x.u === c.equipTo); if (m && m.ctrl === c.ctrl) { c.flags.f25nd = true; return true; } return false; },
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  // The 2 monsters are chosen (targeted) on activation; it destroys itself if it is the only monster (ruling).
  'Nobleman-Eater Bug': { effs: [flip('Destroy 2 monsters', { tags: { destroy: 1 },
    cond: g => fieldMons(g).length > 0,
    target: function* (g, c, p, L2) { const ms = fieldMons(g), n = Math.min(2, ms.length); yield* tgt(g, p, L2, 'Destroy which 2 monsters?', ms, n, n, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } })] },
  "Novox's Prayer": { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && canRitual(g, p, { monster: x => named(x, 'Skull Guardian') }),
    res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, 'Skull Guardian') }); } }] },
  // "If ..., you can": targets a Continuous Spell in your GY (ruling).
  'Nubian Guard': { effs: [{ type: 'trig', label: 'Return a Continuous Spell to the top of the Deck',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    cond: (g, c, p) => g.p[p].gy.some(x => isSpell(x) && D(x).sub === 'Continuous'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which Continuous Spell to the top of your Deck?', g.p[p].gy.filter(x => isSpell(x) && D(x).sub === 'Continuous'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'deckTop', { reason: 'effect', by: p }); log(g, `${PN(g, p)} put ${D(t).n} on top of the Deck.`); } } }] },
  // ENGINE: no response window after damage, so it acts as an optional trigger while Set (as Rope of Life, full-26.js).
  // Only damage to LP (battle or effect), not LP paid as a cost.
  'Numinous Healer': { effs: [trapTrig({ label: 'Gain LP',
    on: (g, ev, c) => ev.type === 'damage' && ev.p === c.ctrl && ev.n > 0,
    res: function* (g, c, p) { const n = g.p[p].gy.filter(x => named(x, 'Numinous Healer')).length; gain(g, p, 1000 + 500 * n); } })] },
  // ENGINE: no window during damage calculation; it is offered in the Damage Step windows while the battle would deal you
  // 2000 or more damage (a face-down target is counted once it is flipped).
  'Nutrient Z': { effs: [{ type: 'act', ds: true, cond: (g, c, p) => !!g.inDS && battleDmgTo(g, p) >= 2000,
    res: function* (g, c, p) { gain(g, p, 4000); } }] },
  // Mandatory when Normal Summoned (not when Set); -200 ATK for each monster the opponent controls.
  'Nuvia the Wicked': { self: { atk: (g, c) => -200 * monsOf(g, opp(c.ctrl)).length },
    effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy this card', on: (g, ev, c) => evSummoned(ev, c, ['normal']),
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p, src: c }); } }] },

  /* ----- O ----- */
  // Skipping the Draw Phase is part of the effect: a negated activation skips nothing, a target flipped face-down still does.
  'Offerings to the Doomed': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) destroy(g, [t], { by: p, src: c }); skipDraw(g, p); log(g, `${PN(g, p)} skips the next Draw Phase.`); } }] },
  'Old Vindictive Magician': { effs: [flip('Destroy a monster', { tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which of their monsters?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } })] },
  'Ominous Fortunetelling': { effs: [actNoop,
    { type: 'trig', loc: 'st', opt: true, label: 'Call the type of a random card in their hand',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      cond: (g, c, p) => g.p[opp(p)].hand.length > 0,
      res: function* (g, c, p) { const o = opp(p); if (!onField(c) || !g.p[o].hand.length) return; const x = randomOf(g, g.p[o].hand);
        const i = yield* choose(g, p, 'Call the type of the random card', KINDS);
        log(g, `${PN(g, p)} called ${KINDS[i]}. The card was ${D(x).n}.`);
        if (i === kindOf(x)) damage(g, o, 700, { src: c, srcP: p }); else log(g, 'The call was wrong.'); } }] },
  'Ooguchi': { self: { directAttack: true } },
  'Ookazi': { effs: [{ type: 'act', res: function* (g, c, p) { damage(g, opp(p), 800, { src: c, srcP: p }); } }] },
  'Opti-Camouflage Armor': { cont: { grant: (g, src, m, flag) => flag === 'directAttack' && src.equipTo === m.u },
    effs: [equipAct(m => lv(m) === 1, 'Equip to which face-up Level 1 monster?')] },
  // The Tribute is the cost (face-down too); the destroy targets.
  'Orca Mega-Fortress of Darkness': { effs: [
    { type: 'ign', label: 'Tribute Torpedo Fish: destroy a monster', tags: { destroy: 1 },
      cond: (g, c, p) => monsOf(g, p).some(x => named(x, 'Torpedo Fish')) && fieldMons(g).some(x => !named(x, 'Torpedo Fish') || monsOf(g, p).filter(y => named(y, 'Torpedo Fish')).length > 1 || x.ctrl !== p),
      cost: function* (g, c, p) { yield* tributeCost(g, p, monsOf(g, p).filter(x => named(x, 'Torpedo Fish')), 'Tribute 1 Torpedo Fish'); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } },
    { type: 'ign', label: 'Tribute Cannonball Spear Shellfish: destroy a Spell or Trap', tags: { destroy: 1 },
      cond: (g, c, p) => monsOf(g, p).some(x => named(x, 'Cannonball Spear Shellfish')) && [...stOf(g, 0), ...stOf(g, 1)].length > 0,
      cost: function* (g, c, p) { yield* tributeCost(g, p, monsOf(g, p).filter(x => named(x, 'Cannonball Spear Shellfish')), 'Tribute 1 Cannonball Spear Shellfish'); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell or Trap Card?', [...stOf(g, opp(p)), ...stOf(g, p)], 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  // Each attack of an opponent's monster; you need a card in hand (rulings).
  'Ordeal of a Traveler': { effs: [actNoop,
    { type: 'trig', loc: 'st', label: 'They call the type of a random card in your hand',
      on: (g, ev, c) => ev.type === 'attack' && ev.a && ev.a.ctrl !== c.ctrl,
      cond: (g, c, p) => g.p[p].hand.length > 0,
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (!onField(c) || !g.p[p].hand.length) return; const x = randomOf(g, g.p[p].hand);
        const i = yield* choose(g, opp(p), 'Call the type of the random card in their hand', KINDS);
        log(g, `${PN(g, opp(p))} called ${KINDS[i]}. The card was ${D(x).n}.`);
        if (i !== kindOf(x) && a && onField(a) && a.zone === 'm') { move(g, a, 'hand', { reason: 'effect', by: p }); log(g, `${D(a).n} returned to the hand.`); }
        else if (i === kindOf(x)) log(g, 'The call was right.'); } }] },
  'Order to Charge': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isNormalMon(x)) && monsOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Tribute which Normal Monster?', monsOf(g, p).filter(x => faceUp(x) && isNormalMon(x)), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.ctrl !== p) return; move(g, t, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(t).n}.`);
      const os = monsOf(g, opp(p)); if (!os.length) return; const [x] = yield* pick(g, p, 'Destroy which of their monsters?', os, 1, 1, 'bad'); if (x) destroy(g, [x], { by: p, src: c }); } }] },
  // Tribute and the Spells/Traps are chosen at resolution (rulings).
  'Order to Smash': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isNormalMon(x) && lv(x) <= 2),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Tribute which Level 2 or lower Normal Monster?', monsOf(g, p).filter(x => faceUp(x) && isNormalMon(x) && lv(x) <= 2), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.ctrl !== p) return; move(g, t, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(t).n}.`);
      const os = stOf(g, opp(p)); if (!os.length) return; const xs = yield* pick(g, p, 'Destroy up to 2 of their Spells/Traps', os, 1, 2, 'bad'); destroy(g, xs, { by: p, src: c }); } }] },
  'Otohime': { cont: noSSFromGY, effs: [spiritReturn,
    { type: 'trig', when: true, label: 'Change the battle position of their monster',
      on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']) || (ev.type === 'flip' && ev.c === c),
      cond: (g, c, p) => oppFaceUp(g, p).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change the battle position of which face-up monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; if (t.pos === 'atk') toDef(g, t); else toAtk(g, t); } }] },
  // Mandatory, from anywhere to your GY (it waits for the chain to resolve, ruling).
  'Outstanding Dog Marron': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Shuffle it into the Deck',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy',
    res: function* (g, c) { if (c.zone !== 'gy') return; move(g, c, 'deck', { reason: 'effect' }); log(g, 'Outstanding Dog Marron was shuffled into the Deck.'); } }] },

  /* ----- P ----- */
  'Painful Choice': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 5 && !forbid(g, { type: 'search', p }),
    res: function* (g, c, p) {
      if (g.p[p].deck.length < 5) return;
      const five = yield* pick(g, p, 'Select 5 cards from your Deck', g.p[p].deck, 5, 5, 'good'); if (five.length < 5) return;
      log(g, `${PN(g, p)} showed ${five.map(x => D(x).n).join(', ')}.`);
      const [x] = yield* pick(g, opp(p), 'Which card do they add to their hand?', five, 1, 1);
      if (x) { move(g, x, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} added ${D(x).n} to the hand.`); }
      const grp = g.group; for (const y of five) if (y !== x && y.zone === 'deck') move(g, y, 'gy', { reason: 'effect', by: p, group: grp });
      shuffleDeck(g, p); } }] },
  'Paladin of White Dragon': { effs: [
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the face-down monster',
      on: (g, ev, c) => ev.type === 'dsStart' && ev.a === c && !!ev.t && ev.t.pos === 'set',
      res: function* (g, c, p, L2) { const t = L2.ev.t; if (t && onField(t) && t.pos === 'set') killFoe(g, c, p, t); } },
    { type: 'ign', tags: { ss: 1 }, label: 'Tribute: Special Summon Blue-Eyes White Dragon',
      cond: (g, c, p) => [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Blue-Eyes White Dragon')),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Paladin of White Dragon.`); },
      res: function* (g, c, p) { const T = g.turnNo;
        addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.ctrl === p && named(a.c, 'Blue-Eyes White Dragon') && g2.turnNo === T, { end: T });
        if (freeM(g, p) < 0) return; const xs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Blue-Eyes White Dragon') && canSS(g, p, x));
        const [x] = yield* pick(g, p, 'Special Summon Blue-Eyes White Dragon from your hand or Deck', xs, 1, 1, 'good'); if (!x) return;
        const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } }] },
  // No Standby Phase LP payment for Archfiends: their payment triggers ("Pay N LP") are blocked while it is face-up.
  // The search: once per group of Archfiends destroyed together (not by battle), Level lower than the highest of them; the
  // owner of the destroyed Archfiend searches (ruling).
  // PARTIAL: payments are recognized by their effect label ("Pay ... LP"); a script that pays without such a label still pays.
  'Pandemonium': {
    cont: { forbid: (g, src, a) => a.type === 'activate' && !!a.eff && a.eff.type === 'trig' && g.phase === 'standby' && isArchfiend(a.c) && /\bpay\b/i.test(a.eff.label || '') },
    effs: [actNoop,
      { type: 'trig', loc: 'fz', mand: true, label: 'Add a lower Level Archfiend',
        on: (g, ev, c) => {
          if (!(ev.type === 'move' && ev.wasField && ev.from === 'm' && ev.destroyed && !ev.battle && ev.to === 'gy' && ev.snap && ev.snap.mon && isArchName(ev.snap.name))) return false;
          const k = ev.group + ':' + ev.c.owner; if (c.flags.f25pg && c.flags.f25pg.includes(k)) return false;
          (c.flags.f25pg || (c.flags.f25pg = [])).push(k); if (c.flags.f25pg.length > 20) c.flags.f25pg.shift(); return true; },
        res: function* (g, c, p, L2) {
          const q = L2.ev.c.owner, grp = L2.ev.group;
          const L0 = Math.max(...g.events.filter(e => e.type === 'move' && e.group === grp && e.destroyed && !e.battle && e.c.owner === q && e.snap && e.snap.mon && isArchName(e.snap.name)).map(e => e.snap.lv), L2.ev.snap.lv);
          const f = x => isMon(x) && isArchName(D(x).n) && !isExtraD(D(x)) && lv(x) < L0;
          if (!g.p[q].deck.some(f)) return;
          if (!(yield* yn(g, q, `Pandemonium: add an Archfiend lower than Level ${L0} from your Deck to your hand?`))) return;
          yield* search(g, q, f, `Add 1 Archfiend lower than Level ${L0} from your Deck`); } }] },
  // Your Pandemonium isn't destroyed by your opponent's card effects (a new Field Spell replacing it still sends it away).
  'Pandemonium Watchbear': { cont: { replaceDestroy: (g, src, c, o) => !o.battle && !o.rule && o.by != null && o.by !== src.ctrl && c.ctrl === src.ctrl && faceUp(c) && named(c, 'Pandemonium') } },
  'Paralyzing Potion': { cont: { grant: (g, src, m, flag) => flag === 'cantAttack' && src.equipTo === m.u && race(m) !== 'Machine' },
    effs: [equipAct()] },
  // Port of classic-3.js.
  // PARTIAL: the last part ("all monsters your opponent controls become Insect monsters") isn't done.
  // ENGINE: no hook changes a monster's Type.
  'Parasite Paracide': { effs: [
    flip('Shuffle into their Deck', {
      res: function* (g, c, p) {
        if (!onField(c)) return; const o = opp(p), own = c.owner;
        move(g, c, 'deck', { reason: 'effect', by: p });
        if (o !== own) { const a = g.p[own].deck, i = a.indexOf(c); if (i >= 0) a.splice(i, 1); g.p[o].deck.push(c); c.owner = o; c.paraFrom = own; }
        c.flags.para = true; shuffleDeck(g, o);
        log(g, `Parasite Paracide was shuffled face-up into ${PN(g, o)}'s Deck.`);
      } }),
    { type: 'trig', loc: 'hand', mand: true, label: 'Infest the drawer',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.reason === 'draw' && c.flags.para,
      res: function* (g, c, p) {
        c.flags.para = false; if (c.zone !== 'hand') return;
        const back = c.paraFrom;
        if (ss(g, p, c, 'def') && back != null) { c.owner = back; c.paraFrom = null; }
        damage(g, p, 1000, { src: c, srcP: opp(p) });
      } }] },
  // ENGINE: attack redirects (attack() keeps its target local), so the controller can't choose the opponent's attack targets.
  'Patrician of Darkness': { effs: [] },
  'Patrol Robo': { effs: [{ type: 'trig', label: 'Look at a Set card',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    cond: (g, c, p) => fieldOf(g, opp(p)).some(x => x.pos === 'set'),
    res: function* (g, c, p) { const xs = fieldOf(g, opp(p)).filter(x => x.pos === 'set'); if (!xs.length || !onField(c)) return;
      const [x] = yield* pick(g, p, 'Look at which Set card?', xs, 1, 1, 'bad'); if (x) log(g, `${PN(g, p)} looked at a Set card: ${D(x).n}.`); } }] },
  // The opponent needs exactly 4 cards in hand on activation only (ruling); the effect is chosen on activation.
  'Penalty Game!': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length === 4,
    cost: function* (g, c, p, L2) { L2.data.i = yield* choose(g, p, 'Penalty Game!: which effect?', ['They can’t draw in their next Draw Phase', 'They can’t activate Spell/Trap Cards this turn']); },
    res: function* (g, c, p, L2) { const q = opp(p);
      if (L2.data.i === 1) { const T = g.turnNo; addRule(g, (g2, a) => a.type === 'activate' && a.p === q && a.eff && a.eff.type === 'act' && a.c && isST(a.c) && g2.turnNo === T, { end: T }); log(g, `${PN(g, q)} can't activate Spell or Trap Cards this turn.`); }
      else { skipDraw(g, q); log(g, `${PN(g, q)} can't draw in the next Draw Phase.`); } } }] },
  // Sent from the Deck to the GY by an opponent's card effect (classic-2.js).
  'Penguin Knight': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Shuffle the GY into the Deck',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'deck' && ev.to === 'gy' && ev.reason !== 'cost' && byOpp(g, ev, c),
    res: function* (g, c, p) { const P = g.p[p]; const n = P.gy.length; for (const x of P.gy.slice()) { x.zone = 'deck'; x.pos = null; P.deck.push(x); } P.gy.length = 0; shuffleDeck(g, p); g.seq++; log(g, `${PN(g, p)} shuffled ${n} cards from the GY into the Deck.`); } }] },
  // "You can target up to 2": optional (0 by declining), Tokens just leave the field.
  'Penguin Soldier': { effs: [{ type: 'trig', faceDownOk: true, label: 'Return up to 2 monsters', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: g => fieldMons(g).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return up to 2 monsters to the hand', fieldMons(g), 1, 2, 'bad'); },
    res: function* (g, c, p, L2) { for (const t of live(L2)) { const n = faceUp(t) ? name(t) : 'A face-down monster'; move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${n} returned to the hand.`); } } }] },
  // +1000 during the Damage Step only, attacking or attacked, against a face-up LIGHT monster.
  'Penumbral Soldier Lady': { self: { atk: (g, c) => { const b = g.battle; if (!g.inDS || !b || !b.t || (b.a !== c && b.t !== c)) return 0; const o = b.a === c ? b.t : b.a; return o && onField(o) && faceUp(o) && attr(o) === 'LIGHT' ? 1000 : 0; } } },
  'Perfect Machine King': { self: { atk: (g, c) => 500 * fieldMons(g).filter(x => x !== c && faceUp(x) && race(x) === 'Machine').length } },
  'Performance of Sword': { effs: [] },
  // "When ... you can": misses the timing (rulings). Kycoo the Ghost Destroyer stops the banish (goat-3.js).
  'Peten the Dark Clown': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Banish it: summon another Peten',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy',
    cond: (g, c, p) => c.zone === 'gy' && freeM(g, p) >= 0 && !kycooOn(g, p) && [...g.p[p].hand, ...g.p[p].deck].some(x => x !== c && named(x, 'Peten the Dark Clown') && canSS(g, p, x)),
    cost: function* (g, c, p) { move(g, c, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished Peten the Dark Clown.`); },
    res: function* (g, c, p) { if (freeM(g, p) < 0) return; const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Peten the Dark Clown') && canSS(g, p, x)); const [x] = yield* pick(g, p, 'Special Summon Peten the Dark Clown from your hand or Deck', cs, 1, 1, 'good'); if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } } }] },
  // Shuffled face-up into the Deck (marked c.flags.f25ph). When drawn: it goes to the GY, then a card in your GY comes back.
  // PARTIAL: the Deck isn't shown face-up to the players; Painful Choice, Cyber Jar etc. don't remove the mark.
  "Pharaoh's Treasure": { effs: [
    { type: 'act', res: function* (g, c, p) { if (!onField(c)) return; move(g, c, 'deck', { reason: 'effect', by: p }); c.flags.f25ph = true; log(g, `Pharaoh's Treasure was shuffled face-up into ${PN(g, p)}'s Deck.`); } },
    { type: 'trig', loc: 'hand', mand: true, label: 'Send it to the GY, then add a card from the GY',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.reason === 'draw' && !!c.flags.f25ph,
      target: function* (g, c, p, L2) { c.flags.f25ph = false; const xs = g.p[p].gy.filter(x => x !== c); if (xs.length) yield* tgt(g, p, L2, 'Add which card from your GY to your hand?', xs, 1, 1, 'good'); },
      res: function* (g, c, p, L2) { if (c.zone === 'hand') { move(g, c, 'gy', { reason: 'effect', by: p }); log(g, 'Pharaoh’s Treasure was sent to the GY.'); }
        const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} added ${D(t).n} from the GY to the hand.`); } } }] },
});

/* ----- Goat only ----- */
E.addScripts({
  // Every monster on the field goes back to its owner's Deck (Tokens vanish, Fusions return to the Extra Deck and aren't
  // counted); then each player excavates until they reveal as many monsters as they shuffled into their Main Deck.
  // Level 4 or lower monsters are Special Summoned face-down (while zones are free), the rest go to the GY.
  'Morphing Jar #2': { effs: [flip('Shuffle every monster into the Deck', {
    res: function* (g, c, p) {
      const n = [0, 0]; const grp = g.group;
      for (const m of fieldMons(g)) { const tok = D(m).k === 'token', ex = isExtraD(D(m)); const o = m.owner; move(g, m, 'deck', { reason: 'effect', by: p, group: grp }); if (!tok && !ex) n[o]++; }
      for (const q of [0, 1]) shuffleDeck(g, q);
      log(g, 'Every monster on the field was shuffled into the Deck.');
      for (const q of [g.tp, opp(g.tp)]) {
        const deck = g.p[q].deck, out = []; let k = 0;
        while (k < n[q] && deck.length) { const x = deck[deck.length - 1]; deck.pop(); deck.unshift(x); out.push(x); if (isMon(x)) k++; }
        for (const x of out) { const i = deck.indexOf(x); if (i >= 0) deck.splice(i, 1); deck.push(x); }   // back on top, in order
        if (out.length) log(g, `${PN(g, q)} excavated ${out.map(x => D(x).n).join(', ')}.`);
        const sum = out.filter(x => isMon(x) && !isExtraD(D(x)) && D(x).k !== 'ritual' && lv(x) <= 4);
        for (const x of out.slice().reverse()) { if (x.zone !== 'deck') continue; if (sum.includes(x) && freeM(g, q) >= 0 && canSS(g, q, x)) ss(g, q, x, 'set'); }
        const rest = out.filter(x => x.zone === 'deck'); for (const x of rest) move(g, x, 'gy', { reason: 'effect', by: p, group: g.group });
      } } })] },
  // The controller loses 300 LP in each of their Standby Phases (not damage). In their End Phase they can pay 500 LP to give
  // control to the opponent.
  'Mushroom Man #2': { effs: [
    { type: 'trig', mand: true, label: 'Lose 300 LP', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; g.p[p].lp -= 300; log(g, `${PN(g, p)} lost 300 LP.`); if (g.p[p].lp <= 0) { g.p[p].lp = 0; winDuel(g, opp(p), `${PN(g, p)} hit 0 LP`); } } },
    { type: 'trig', label: 'Pay 500 LP: give control to the opponent', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      cond: (g, c, p) => g.p[p].lp > 500 && freeM(g, opp(p)) >= 0,
      cost: function* (g, c, p) { pay(g, p, 500); },
      res: function* (g, c, p) { if (onField(c) && c.ctrl === p) takeControl(g, opp(p), c, false); } }] },
}, 'goat');
})();
