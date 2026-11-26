/* Goat 3: Warrior, Zombie, Chaos and beatdown support (batch list build/batches/goat-3.txt).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md), registered for Goat only (E.addScripts(obj, 'goat')).
 Written from each card's 2005 (summer Goat format) behavior. The list's text is today's wording; where the 2005 card
 played differently, the 2005 behavior is used and noted. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, choose, move, destroy, ss, damage, gain, pay, mill, addMod, addCtr, ctr, addRule, name, D, isMon, isSpell,
  onField, faceUp, attr, race, baseAtk, monsOf, fieldMons, allField, freeM, shuffleDeck, log, PN, has, live, opp, stat, evSummoned,
  battleKill } = L;

const named = (c, n) => D(c).n === n;
const isFlipMon = c => isMon(c) && (!!D(c).flip || /FLIP:/.test(D(c).tx || ''));
const inBattle = (g, c) => !!(g.battle && (g.battle.a === c || g.battle.t === c));
const foeOf = (g, c) => (g.battle ? (g.battle.a === c ? g.battle.t : g.battle.t === c ? g.battle.a : null) : null);
function* discardOne(g, p, filter, text) {
  const cs = g.p[p].hand.filter(filter || (() => true)); const [x] = yield* pick(g, p, text || 'Discard 1 card', cs, 1, 1, 'cost');
  if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } return x;
}
const discardRandom = (g, p) => { const h = g.p[p].hand; if (!h.length) return null; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)} at random.`); return x; };
const kycooOn = (g, p) => monsOf(g, opp(p)).some(x => faceUp(x) && named(x, 'Kycoo the Ghost Destroyer') && !x.flags.negated);
// "Must be Fusion Summoned": blocks a revival from the GY, as in goat-1.js.
// PARTIAL: works from the GY only (one cont per card; the engine has no general "can't be Special Summoned" flag).
const noSSFromGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src };
// Spell Counter on each resolved Spell (seen as it leaves the Spell/Trap Zone for the GY), as Skilled White Magician in goat-1.js.
// PARTIAL: Continuous, Equip and Field Spells stay on the field after resolving, so they add no counter.
const spellCounter3 = { type: 'trig', on: (g, ev, c) => { if (ev.type === 'move' && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && isSpell(ev.c) && !['Continuous', 'Equip', 'Field'].includes(D(ev.c).sub) && ctr(c, 'spell') < 3) { addCtr(g, c, 'spell', 1); log(g, `${name(c)} got a Spell Counter (${ctr(c, 'spell')}).`); } return false; }, res: function* () {} };
// "Destroy that monster" at a battle moment (Sasuke, Mystic Swordsman, Ryu Kokki)
const killFoe = (g, c, p, t) => { if (t && onField(t) && t.zone === 'm') destroy(g, [t], { by: p, src: c }); };

E.addScripts({
  /* ----- monsters ----- */
  // 2005: "When this card is destroyed by battle and sent to the Graveyard, destroy 1 monster on the field." Mandatory.
  'Newdoria': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy a monster',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: g => fieldMons(g).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  // The Flip negation: while it is your only monster, a Flip monster it is about to destroy by battle (flagged battleDoomed
  // before the flip event) has its effects negated, so its Flip effect never triggers.
  'Blade Knight': {
    self: { atk: (g, c) => g.p[c.ctrl].hand.length <= 1 ? 400 : 0 },
    cont: { negates: (g, src, c) => c !== src && isFlipMon(c) && !!c.flags.battleDoomed && inBattle(g, src) && inBattle(g, c) && monsOf(g, src.ctrl).every(x => x === src) },
    effs: [] },
  'Don Zaloog': { effs: [{ type: 'trig', when: true, label: 'Discard or mill 2',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    cond: (g, c, p) => g.p[opp(p)].hand.length > 0 || g.p[opp(p)].deck.length > 0,
    res: function* (g, c, p) {
      const o = opp(p), opts = [];
      if (g.p[o].hand.length) opts.push('Discard 1 random card from their hand');
      if (g.p[o].deck.length) opts.push('Send the top 2 cards of their Deck to the GY');
      if (!opts.length) return;
      const i = opts.length > 1 ? yield* choose(g, p, 'Don Zaloog: which effect?', opts) : 0;
      if (/random/.test(opts[i])) discardRandom(g, o); else mill(g, o, 2);
    } }] },
  // 2005: "You can offer this card as a Tribute to destroy 1 monster on the field."
  'Exiled Force': { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Tribute: destroy a monster',
    cond: (g, c) => fieldMons(g).some(x => x !== c),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Exiled Force.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  // The face-down monster is destroyed at the start of the Damage Step without being flipped (no Flip effect, not "by battle",
  // so it doesn't count for the level up).
  'Mystic Swordsman LV2': { effs: [
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the face-down monster',
      on: (g, ev, c) => ev.type === 'dsStart' && ev.a === c && !!ev.t && ev.t.pos === 'set',
      res: function* (g, c, p, L2) { killFoe(g, c, p, L2.ev.t); } },
    { type: 'trig', on: (g, ev, c) => { if (battleKill(ev, c)) c.flags.msKill = g.turnNo; return false; }, res: function* () {} },
    { type: 'trig', tags: { ss: 1 }, label: 'Send it: summon Mystic Swordsman LV4',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.msKill === g.turnNo,
      cond: (g, c, p) => [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Mystic Swordsman LV4')),
      cost: function* (g, c) { move(g, c, 'gy', { reason: 'cost' }); },
      res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Mystic Swordsman LV4')); const [x] = yield* pick(g, p, 'Special Summon Mystic Swordsman LV4', cs, 1, 1, 'good'); if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } } }] },
  'Ninja Grandmaster Sasuke': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the Defense Position monster',
    on: (g, ev, c) => ev.type === 'dsStart' && ev.a === c && !!ev.t && ev.t.pos === 'def',
    res: function* (g, c, p, L2) { killFoe(g, c, p, L2.ev.t); } }] },
  // "Cannot attack directly": it can't attack when there is no monster it could attack instead.
  'Zombyra the Dark': {
    self: { cantAttack: (g, c) => !monsOf(g, opp(c.ctrl)).some(t => !(faceUp(t) && has(g, t, 'noAttackTarget'))) },
    effs: [{ type: 'trig', mand: true, label: 'Lose 200 ATK', on: (g, ev, c) => battleKill(ev, c),
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: -200 }); log(g, `${name(c)} lost 200 ATK.`); } } }] },
  'Skilled Dark Magician': { effs: [spellCounter3,
    { type: 'ign', tags: { ss: 1 }, label: 'Tribute: summon Dark Magician',
      cond: (g, c, p) => ctr(c, 'spell') >= 3 && [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].some(x => named(x, 'Dark Magician')),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed Skilled Dark Magician.`); },
      res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].filter(x => named(x, 'Dark Magician')); const [x] = yield* pick(g, p, 'Special Summon Dark Magician from your hand, Deck or GY', cs, 1, 1, 'good'); if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x); if (fromDeck) shuffleDeck(g, p); } } }] },
  // ENGINE: "This card must attack if able" isn't enforced (no way to force an attack before the Battle Phase ends).
  'Berserk Gorilla': { effs: [{ type: 'trig', mand: true, label: 'Destroy itself (face-up Defense Position)',
    on: (g, ev, c) => faceUp(c) && c.pos === 'def',
    res: function* (g, c, p) { if (onField(c) && faceUp(c) && c.pos === 'def') destroy(g, [c], { by: p, src: c }); } }] },
  'Ryu Kokki': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the Warrior or Spellcaster',
    on: (g, ev, c) => ev.type === 'dsEnd' && (ev.a === c || ev.t === c) && (() => { const o = ev.a === c ? ev.t : ev.a; return !!o && onField(o) && ['Warrior', 'Spellcaster'].includes(race(o)); })(),
    res: function* (g, c, p, L2) { killFoe(g, c, p, L2.ev.a === c ? L2.ev.t : L2.ev.a); } }] },
  // PARTIAL: the engine has no window during damage calculation, so Lily is used in the Damage Step windows of its battle
  // (start of the Damage Step or before damage calculation); the 3000 ATK lasts until that Damage Step ends.
  'Injection Fairy Lily': {
    self: { atk: (g, c) => g.battle && c.flags.lilyB === g.battle ? 3000 : 0 },
    effs: [{ type: 'quick', ds: true, label: 'Pay 2000: +3000 ATK',
      cond: (g, c, p) => g.inDS && inBattle(g, c) && c.flags.lilyB !== g.battle && g.p[p].lp > 2000,
      cost: function* (g, c, p) { pay(g, p, 2000); },
      res: function* (g, c) { if (onField(c) && faceUp(c) && g.battle && inBattle(g, c)) { c.flags.lilyB = g.battle; log(g, `${name(c)} gained 3000 ATK for this battle.`); } } }] },
  // 2005: the declaration and send are mandatory; the revival comes in your next Standby Phase after an opponent's card
  // destroys it while you control it.
  'Vampire Lord': { effs: [
    { type: 'trig', mand: true, label: 'Declare a card type',
      on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
      res: function* (g, c, p) {
        const o = opp(p), types = ['Monster', 'Spell', 'Trap'];
        const i = yield* choose(g, p, 'Vampire Lord: declare a card type', types); log(g, `${PN(g, p)} declared ${types[i]}.`);
        const fit = x => (i === 0 ? isMon(x) : i === 1 ? isSpell(x) : D(x).k === 'trap');
        const cs = g.p[o].deck.filter(fit); if (!cs.length) { log(g, `${PN(g, o)} has no ${types[i]} Card in the Deck.`); shuffleDeck(g, o); return; }
        const [x] = yield* pick(g, o, `Send 1 ${types[i]} Card from your Deck to the GY`, cs, 1, 1, 'cost');
        if (x) { move(g, x, 'gy', { reason: 'effect' }); log(g, `${PN(g, o)} sent ${name(x)} from the Deck to the GY.`); }
        shuffleDeck(g, o);
      } },
    { type: 'trig', loc: 'gy', on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.to === 'gy' && ev.wasField && ev.destroyed && !ev.battle && ev.by != null && ev.by !== c.owner && ev.prevCtrl === c.owner) c.flags.vlTurn = g.turnNo; return false; }, res: function* () {} },
    { type: 'trig', loc: 'gy', mand: true, opt: true, tags: { ss: 1 }, label: 'Special Summon itself',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner && c.flags.vlTurn != null && c.flags.vlTurn < g.turnNo,
      res: function* (g, c, p) { if (c.zone !== 'gy') return; c.flags.vlTurn = null; ss(g, p, c, 'atk'); } }] },
  // 2005: "until the end of your opponent's turn": the bonus is kept on the card as {n, until} (flags clear if it leaves the field).
  'Bazoo the Soul-Eater': {
    self: { atk: (g, c) => (c.flags.bazoo || []).filter(b => g.turnNo <= b.until).reduce((s, b) => s + 300 * b.n, 0) },
    effs: [{ type: 'ign', opt: true, label: 'Banish up to 3 monsters: +300 ATK each',
      cond: (g, c, p) => g.p[p].gy.some(isMon),
      cost: function* (g, c, p, L2) { const xs = yield* pick(g, p, 'Banish up to 3 monsters from your GY', g.p[p].gy.filter(isMon), 1, 3, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost' }); L2.data.n = xs.length; log(g, `${PN(g, p)} banished ${xs.map(name).join(', ')}.`); },
      res: function* (g, c, p, L2) { if (!onField(c) || !faceUp(c)) return; (c.flags.bazoo || (c.flags.bazoo = [])).push({ n: L2.data.n, until: g.turnNo + 1 }); log(g, `${name(c)} gained ${300 * L2.data.n} ATK.`); } }] },
  'Gyaku-Gire Panda': { self: { atk: (g, c) => 500 * monsOf(g, opp(c.ctrl)).length, piercing: true }, effs: [] },
  'Elemental HERO Flame Wingman': { cont: noSSFromGY,
    effs: [{ type: 'trig', mand: true, label: 'Damage equal to its ATK', on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
      res: function* (g, c, p, L2) { const t = L2.ev.c; if (t.zone === 'gy' && isMon(t)) damage(g, opp(p), baseAtk(t), { src: c, srcP: p }); } }] },
  'Abyss Soldier': { effs: [{ type: 'ign', opt: true, label: 'Discard a WATER: return a card to the hand',
    cond: (g, c, p) => g.p[p].hand.some(x => isMon(x) && attr(x) === 'WATER') && allField(g).length > 0,
    cost: function* (g, c, p) { yield* discardOne(g, p, x => isMon(x) && attr(x) === 'WATER', 'Discard 1 WATER monster'); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which card to its owner’s hand?', allField(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; const nm = t.pos === 'set' ? 'a face-down card' : name(t); move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${nm} returned to the hand.`); } }] },
  // Kycoo the Ghost Destroyer stops the banish (its goat-1.js list doesn't name Peten, so it is checked here).
  'Peten the Dark Clown': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Banish it: summon another Peten',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy',
    cond: (g, c, p) => c.zone === 'gy' && freeM(g, p) >= 0 && !kycooOn(g, p) && [...g.p[p].hand, ...g.p[p].deck].some(x => x !== c && named(x, 'Peten the Dark Clown')),
    cost: function* (g, c, p) { move(g, c, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished Peten the Dark Clown.`); },
    res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Peten the Dark Clown')); const [x] = yield* pick(g, p, 'Special Summon Peten the Dark Clown from your hand or Deck', cs, 1, 1, 'good'); if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } } }] },
  'Zaborg the Thunder Monarch': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a monster',
    on: (g, ev, c) => evSummoned(ev, c, ['tribute']),
    cond: g => fieldMons(g).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'St. Joan': { effs: [] }, // Fusion Monster with no effect
  'Gravekeeper\'s Spear Soldier': { self: { piercing: true }, effs: [] },
  // PARTIAL: the +2000 applies for the whole Damage Step of a battle with a Warrior, not only during damage calculation.
  'Cipher Soldier': {
    self: { atk: (g, c) => cipher(g, c), def: (g, c) => cipher(g, c) },
    effs: [] },

  /* ----- Spells ----- */
  'Tribute to the Doomed': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && fieldMons(g).length > 0,
    cost: function* (g, c, p) { yield* discardOne(g, p, x => x !== c); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Mystik Wok': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).length > 0,
    cost: function* (g, c, p, L2) {
      const [m] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p), 1, 1, 'cost'); if (!m) return;
      L2.data.a = stat(g, m, 'atk'); L2.data.d = stat(g, m, 'def');
      const nm = m.pos === 'set' ? 'a face-down monster' : name(m); move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`);
    },
    res: function* (g, c, p, L2) { if (L2.data.a == null) return; const i = yield* choose(g, p, 'Mystik Wok: gain which?', [`ATK (${L2.data.a})`, `DEF (${L2.data.d})`]); gain(g, p, i ? L2.data.d : L2.data.a); } }] },

  /* ----- Traps ----- */
  'Xing Zhen Hu': {
    cont: { forbid: (g, src, a) => a.type === 'activate' && (src.flags.xing || []).includes(a.c.u) && a.c.zone === 'st' },
    effs: [{ type: 'act', cond: (g, c) => allField(g).filter(x => x !== c && x.zone === 'st' && x.pos === 'set').length >= 2,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select 2 Set Spell or Trap Cards', allField(g).filter(x => x !== c && x.zone === 'st' && x.pos === 'set'), 2, 2, 'bad'); },
      res: function* (g, c, p, L2) { const ts = live(L2).filter(x => x.pos === 'set'); if (!onField(c) || !ts.length) return; c.flags.xing = ts.map(x => x.u); log(g, `${ts.length} Set card${ts.length > 1 ? 's' : ''} can't be activated.`); } }] },
  'Cursed Seal of the Forbidden Spell': { effs: [{ type: 'act', tags: {},
    cond: (g, c, p, x) => { const t = x.top; return !!(t && t.cardAct && isSpell(t.c) && !t.negated) && g.p[p].hand.some(isSpell); },
    cost: function* (g, c, p) { yield* discardOne(g, p, isSpell, 'Discard 1 Spell Card'); },
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) {
      const T = L2.data.L; if (!T || T.negated) return; const nm = D(T.c).n, o = opp(p);
      T.negBy = p; L.negate(g, T, true);
      addRule(g, (g2, a) => a.type === 'activate' && a.p === o && a.eff && a.eff.type === 'act' && isSpell(a.c) && D(a.c).n === nm);
      log(g, `${PN(g, o)} can't activate ${nm} for the rest of the Duel.`);
    } }] },
  'Hallowed Life Barrier': {
    // PARTIAL: effect damage is stopped while this card is in the GY (a cont works from the field, GY or hand only);
    // battle damage is stopped either way.
    cont: { loc: 'gy', dmg: (g, src, p, n, o) => (g.hlbGoat && g.hlbGoat[p] === g.turnNo && o.srcP != null && o.srcP !== p ? 0 : undefined) },
    effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.length > 0,
      cost: function* (g, c, p) { yield* discardOne(g, p); },
      res: function* (g, c, p) { g.p[p].noBattleDamage = g.turnNo; (g.hlbGoat || (g.hlbGoat = [null, null]))[p] = g.turnNo; log(g, `${PN(g, p)} takes no damage from the opponent this turn.`); } }] },

  /* ----- Banisher of the Light ----- */
  // ENGINE: move() has no "banish instead" replacement. Closest: as a card lands in the GY while this card is face-up,
  // it is moved on to the banished pile at once. GY triggers of that card then fail (they check the zone), and "destroyed
  // and sent to the GY" triggers (battleKill) don't fire, as with the real replacement.
  'Banisher of the Light': { effs: [{ type: 'trig', on: (g, ev, c) => {
    if (ev.type === 'move' && ev.to === 'gy' && ev.c !== c && ev.c.zone === 'gy' && onField(c) && faceUp(c)) { move(g, ev.c, 'ban', { reason: 'rule', noLater: true }); log(g, `${name(ev.c)} was banished instead.`); }
    return false; }, res: function* () {} }] },
}, 'goat');

function cipher(g, c) { const o = foeOf(g, c); return g.inDS && o && race(o) === 'Warrior' ? 2000 : 0; }
})();
