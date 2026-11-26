/* Classic 1: Duelist Kingdom and Battle City cards (Toons, the Egyptian Gods, Exodia, Destiny Board, the mask cards,
 the classic Rituals and Fusions). Card scripts for js/engine.js (see build/CARD_SCRIPTS.md), registered for Goat only
 (E.addScripts(obj, 'goat')): these cards are drafted and dueled under Goat rules. Each card follows its text in
 play/data/classic-cards.js, played by Goat-era rules. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, move, destroy, ss, damage, pay, search, takeControl, addMod, addRule, ritualSummon, canRitual,
  name, D, isMon, isSpell, onField, faceUp, attr, monsOf, stOf, allField, fieldMons, freeM, freeST, shuffleDeck, log, PN,
  live, opp, tributeCands, winDuel, evSummoned, fromFieldToGY } = L;
const atk = L.atk;

const named = (c, n) => D(c).n === n;
function* tributeN(g, p, n, text, not) {
  const cs = monsOf(g, p).filter(x => x !== not);
  const xs = yield* pick(g, p, text, cs, n, n, 'cost');
  for (const x of xs) { const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); }
  return xs;
}

/* ----- Toons ----- */
const isToon = c => /Toon/.test(D(c).ab || '') || /treated as a "Toon" card/.test(D(c).tx || '');
const toonWorld = (g, p) => stOf(g, p).some(x => faceUp(x) && named(x, 'Toon World'));
// Cannot be Normal Summoned (the engine reads that from the text). Special Summoned from the hand by Tributing n monsters
// while you control Toon World; can't attack that turn; 500 LP to declare each attack; dies with Toon World; attacks
// directly unless the opponent controls a Toon, then it must attack a Toon.
function toon(n) {
  return {
    proc: { label: n ? `Special Summon (Tribute ${n}, Toon World)` : 'Special Summon (Toon World)',
      cond: (g, c, p) => toonWorld(g, p) && tributeCands(g, p).length >= n,
      cost: n ? function* (g, c, p) { yield* tributeN(g, p, n, `Tribute ${n} monster${n > 1 ? 's' : ''}`); } : null },
    self: {
      cantAttack: (g, c) => c.turnIn === g.turnNo,
      attackCost: () => 500,
      directAttack: (g, c) => !monsOf(g, opp(c.ctrl)).some(x => faceUp(x) && isToon(x)),
      attackOk: (g, c, t) => !monsOf(g, opp(c.ctrl)).some(x => faceUp(x) && isToon(x)) || (faceUp(t) && isToon(t)),
    },
    effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroyed with Toon World',
      on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.destroyed && named(ev.c, 'Toon World') && ev.prevCtrl === c.ctrl,
      res: function* (g, c) { if (onField(c)) destroy(g, [c], { rule: true }); } }],
  };
}

/* ----- the Egyptian Gods ----- */
const GODS = ['Obelisk the Tormentor', 'Slifer the Sky Dragon', 'The Winged Dragon of Ra'];
// Duel-long rules, put in the first time a God sees any event: no God can be Normal Set, and Ra can't be Special Summoned.
const godRules = { type: 'trig', loc: 'any', res: function* () {},
  on: (g) => { if (!g.classic1Gods) { g.classic1Gods = true; addRule(g, (g2, a) => (a.type === 'set' && a.c && GODS.includes(D(a.c).n)) || (a.type === 'ss' && a.c && named(a.c, 'The Winged Dragon of Ra'))); } return false; } };
// "This card's Normal Summon cannot be negated. When Normal Summoned, cards and effects cannot be activated."
// PARTIAL: the lock lasts while the engine still treats the summon as the last thing that happened (g.sw), so the
// summoning player's other cards stay locked until their next action. The God's own effects are left free.
const godLock = {
  forbid: (g, src, a) => a.type === 'activate' && a.c !== src && (
    (g.attempt && g.attempt.cs.includes(src) && ['normal', 'tribute'].includes(g.attempt.how)) ||
    (g.sw && g.sw.cs.includes(src) && ['normal', 'tribute'].includes(g.sw.how))),
};
// "Once per turn, during the End Phase, if this card was Special Summoned: Send it to the GY."
const godReturn = { type: 'trig', mand: true, opt: true, label: 'Send it to the GY',
  on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !['normal', 'tribute'].includes(c.summonType),
  res: function* (g, c) { if (onField(c)) { move(g, c, 'gy', { reason: 'effect' }); log(g, `${name(c)} was sent to the GY.`); } } };

/* ----- Destiny Board ----- */
const MSGS = ['Spirit Message "I"', 'Spirit Message "N"', 'Spirit Message "A"', 'Spirit Message "L"'];
const isBoardPart = c => named(c, 'Destiny Board') || MSGS.includes(D(c).n);
const msgsOn = (g, p) => stOf(g, p).filter(x => faceUp(x) && MSGS.includes(D(x).n));
function boardWin(g, p) {
  const have = new Set(msgsOn(g, p).map(x => D(x).n));
  if (stOf(g, p).some(x => faceUp(x) && named(x, 'Destiny Board')) && MSGS.every(n => have.has(n))) winDuel(g, p, `${PN(g, p)} spelled FINAL with Destiny Board and won`);
}
// "This card can only be placed on the field by the effect of Destiny Board": it can't be activated or Set from the hand.
const spiritMessage = { cont: { loc: 'hand', forbid: (g, src, a) => a.type === 'setST' && a.c === src }, effs: [] };

/* ----- Ritual Spells ----- */
const ritualSpell = rn => ({ effs: [{ type: 'act', tags: { ss: 1 },
  cond: (g, c, p) => freeM(g, p) >= 0 || monsOf(g, p).length > 0 ? canRitual(g, p, { monster: x => named(x, rn) }) : false,
  res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, rn) }); } }] });

E.addScripts({
  /* ----- Toons ----- */
  'Blue-Eyes Toon Dragon': toon(2),
  'Manga Ryu-Ran': toon(2),
  'Toon Mermaid': toon(0),
  'Toon Summoned Skull': toon(1),

  /* ----- Exodia ----- */
  'Exodia the Forbidden One': { effs: [],
    self: { handWin: (g, c, p) => ['Left Arm of the Forbidden One', 'Right Arm of the Forbidden One', 'Left Leg of the Forbidden One', 'Right Leg of the Forbidden One']
      .every(n => g.p[p].hand.some(x => named(x, n))) } },

  /* ----- the Egyptian Gods ----- */
  'Obelisk the Tormentor': { cont: godLock,
    self: { tribExact: 3, cantBeTargeted: true, cantAttack: (g, c) => c.flags.obeliskUsed === g.turnNo },
    effs: [godRules, godReturn,
      { type: 'ign', tags: { destroy: 1 }, label: 'Tribute 2: destroy their monsters',
        cond: (g, c, p) => monsOf(g, p).filter(x => x !== c).length >= 2 && monsOf(g, opp(p)).length > 0,
        cost: function* (g, c, p) { yield* tributeN(g, p, 2, 'Tribute 2 monsters', c); },
        after: (g, c) => { c.flags.obeliskUsed = g.turnNo; },
        res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)), { by: p }); } }] },
  // ATK/DEF "?" (stored as -1): the +1 brings the base to 0 before 1000 for each card in the hand.
  'Slifer the Sky Dragon': { cont: godLock,
    self: { tribExact: 3, atk: (g, c) => 1 + 1000 * g.p[c.ctrl].hand.length, def: (g, c) => 1 + 1000 * g.p[c.ctrl].hand.length },
    effs: [godRules, godReturn,
      { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Summoned monster loses 2000 ATK',
        on: (g, ev, c) => ev.type === 'summon' && ev.how !== 'flip' && ev.cs.some(x => x.ctrl !== c.ctrl && x.zone === 'm' && x.pos === 'atk'),
        res: function* (g, c, p, L2) {
          for (const x of L2.ev.cs) {
            if (!onField(x) || x.zone !== 'm' || x.ctrl === p || !faceUp(x)) continue;
            const before = atk(g, x); addMod(g, x, { atk: -2000 }); log(g, `${name(x)} lost 2000 ATK.`);
            if (before > 0 && atk(g, x) === 0) destroy(g, [x], { by: p });
          }
        } }] },
  // PARTIAL: Ra's later effects (the Phoenix mode, fusing with the Tributes) aren't on this text; only the two written here are.
  'The Winged Dragon of Ra': { cont: godLock,
    self: { tribExact: 3, atk: () => 1, def: () => 1 },
    effs: [godRules,
      { type: 'trig', when: true, label: 'Pay LP down to 100: gain that much ATK/DEF',
        on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
        cond: (g, c, p) => g.p[p].lp > 100,
        cost: function* (g, c, p, L2) { const n = g.p[p].lp - 100; L2.data.n = n; pay(g, p, n); },
        res: function* (g, c, p, L2) { if (!onField(c) || !faceUp(c)) return; addMod(g, c, { set: L2.data.n, which: 'both' }); log(g, `${name(c)} gained ${L2.data.n} ATK and DEF.`); } },
      { type: 'ign', tags: { destroy: 1 }, label: 'Pay 1000: destroy a monster',
        cond: (g, c, p) => g.p[p].lp > 1000 && fieldMons(g).some(x => x !== c),
        cost: function* (g, c, p) { pay(g, p, 1000); },
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) destroy(g, [t], { by: p }); } }] },

  /* ----- Ritual Monsters and their Spells ----- */
  'Black Luster Soldier': { effs: [] },
  'Magician of Black Chaos': { effs: [] }, // its Ritual Spell, Black Magic Ritual, is scripted with its own batch
  'Fortress Whale': { effs: [] },
  'The Masked Beast': { effs: [] },
  'Zera the Mant': { effs: [] },
  'Black Luster Ritual': ritualSpell('Black Luster Soldier'),
  'Curse of the Masked Beast': ritualSpell('The Masked Beast'),
  "Fortress Whale's Oath": ritualSpell('Fortress Whale'),
  'Zera Ritual': ritualSpell('Zera the Mant'),
  'Black Magic Ritual': ritualSpell('Magician of Black Chaos'),

  /* ----- Fusions (the recipe on the first line is read by the engine) ----- */
  'Barox': { effs: [] },
  'Bickuribox': { effs: [] },
  'Punished Eagle': { effs: [] },
  'Rabid Horseman': { effs: [] },
  'Skelgon': { effs: [] },
  'Zombie Warrior': { effs: [] },
  'Great Mammoth of Goldfine': { effs: [] },
  // Direct attack when the opponent has face-up monsters and every one of them is EARTH, WATER or FIRE.
  "Alligator's Sword Dragon": { effs: [],
    self: { directAttack: (g, c) => { const fu = monsOf(g, opp(c.ctrl)).filter(faceUp); return fu.length > 0 && fu.every(x => ['EARTH', 'WATER', 'FIRE'].includes(attr(x))); } } },
  'Chimera the Flying Mythical Beast': { effs: [{ type: 'trig', loc: 'any', when: true, tags: { ss: 1 }, label: 'Summon Berfomet or Gazelle',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, 'Berfomet') || named(x, 'Gazelle the King of Mythical Beasts')),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which monster from your GY?', g.p[p].gy.filter(x => named(x, 'Berfomet') || named(x, 'Gazelle the King of Mythical Beasts')), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },

  /* ----- Masked Beast Des Gardius and the masks ----- */
  'Masked Beast Des Gardius': {
    proc: { label: 'Special Summon (Tribute 2, incl. Grand Tiki Elder or Melchid)',
      cond: (g, c, p) => monsOf(g, p).length >= 2 && monsOf(g, p).some(x => faceUp(x) && (named(x, 'Grand Tiki Elder') || named(x, 'Melchid the Four-Face Beast'))),
      cost: function* (g, c, p) {
        const [a] = yield* pick(g, p, 'Tribute Grand Tiki Elder or Melchid the Four-Face Beast', monsOf(g, p).filter(x => faceUp(x) && (named(x, 'Grand Tiki Elder') || named(x, 'Melchid the Four-Face Beast'))), 1, 1, 'cost');
        const [b] = yield* pick(g, p, 'Tribute 1 more monster', monsOf(g, p).filter(x => x !== a), 1, 1, 'cost');
        for (const x of [a, b]) if (x) move(g, x, 'gy', { reason: 'tribute', by: p });
        log(g, `${PN(g, p)} Tributed ${[a, b].filter(Boolean).map(x => D(x).n).join(' and ')}.`);
      } },
    effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Equip The Mask of Remnants',
      on: (g, ev, c) => fromFieldToGY(ev, c),
      cond: (g, c, p) => freeST(g, p) >= 0 && fieldMons(g).length > 0 && g.p[p].deck.some(x => named(x, 'The Mask of Remnants')),
      res: function* (g, c, p) {
        const ms = g.p[p].deck.filter(x => named(x, 'The Mask of Remnants')); const mons = fieldMons(g);
        if (!ms.length || !mons.length || freeST(g, p) < 0) return;
        const [t] = yield* pick(g, p, 'Equip The Mask of Remnants to which monster?', mons, 1, 1, 'bad');
        if (!t) return;
        const m = ms[0]; move(g, m, 'st', { ctrl: p, pos: 'up', reason: 'effect' }); shuffleDeck(g, p);
        m.equipTo = t.u; log(g, `The Mask of Remnants was equipped to ${name(t)}.`);
        if (t.ctrl !== p) { const from = t.ctrl; if (takeControl(g, p, t, false)) m.flags.remnants = { u: t.u, from }; }
      } }] },
  // Played from the hand it just goes back into the Deck. As an Equip Card from Des Gardius, control returns when it leaves.
  'The Mask of Remnants': { effs: [
    { type: 'act', res: function* (g, c, p) { if (onField(c)) { move(g, c, 'deck', { reason: 'effect' }); log(g, `${PN(g, p)} shuffled The Mask of Remnants into the Deck.`); } } },
    { type: 'trig', loc: 'any', mand: true, label: 'Control returns', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.flags && ev.snap.flags.remnants,
      res: function* (g, c, p, L2) { const s = L2.ev.snap.flags.remnants; const t = fieldMons(g).find(x => x.u === s.u); if (!t || t.ctrl === s.from) return;
        if (freeM(g, s.from) >= 0) takeControl(g, s.from, t, false); else move(g, t, 'gy', { reason: 'rule' }); } }] },
  'Mask of Dispel': { effs: [
    { type: 'act', cond: (g, c, p) => allField(g).some(x => x !== c && faceUp(x) && isSpell(x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which face-up Spell Card?', allField(g).filter(x => x !== c && faceUp(x) && isSpell(x)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!onField(c)) return; if (!t || !faceUp(t)) { move(g, c, 'gy', { reason: 'rule' }); return; } c.flags.dispel = t.u; log(g, `Mask of Dispel selected ${name(t)}.`); } },
    { type: 'trig', loc: 'st', mand: true, label: '500 damage', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && !!c.flags.dispel,
      res: function* (g, c, p) { const t = allField(g).find(x => x.u === c.flags.dispel); if (t && onField(c)) damage(g, t.ctrl, 500, { src: c, srcP: p }); } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy Mask of Dispel', on: (g, ev, c) => ev.type === 'move' && ev.wasField && c.flags.dispel === ev.c.u && ev.to !== 'm' && ev.to !== 'st',
      res: function* (g, c) { if (onField(c)) destroy(g, [c], { rule: true }); } }] },
  'Mask of the Accursed': {
    cont: { grant: (g, src, m, flag) => flag === 'cantAttack' && src.equipTo === m.u },
    effs: [
      { type: 'act', cond: g => fieldMons(g).some(faceUp),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Mask of the Accursed to which monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c)) L.equip(g, c, t); } },
      { type: 'trig', loc: 'st', mand: true, label: '500 damage', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && !!c.equipTo,
        res: function* (g, c, p) { const t = fieldMons(g).find(x => x.u === c.equipTo); if (t && onField(c)) damage(g, t.ctrl, 500, { src: c, srcP: p }); } }] },
  'Mask of Weakness': { effs: [{ type: 'act', label: 'Attacker loses 700 ATK',
    cond: (g, c, p) => !!(g.aw && g.aw.a && g.aw.a.ctrl !== p),
    target: function* (g, c, p, L2) { L2.t = [g.aw.a]; },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: -700, end: true }); log(g, `${name(t)} lost 700 ATK.`); } } }] },

  /* ----- Destiny Board ----- */
  'Destiny Board': { effs: [
    { type: 'act', res: function* (g, c, p) { boardWin(g, p); } },
    // "Once per turn, during your opponent's End Phase: Place 1 Spirit Message from your hand or Deck, in the order I, N, A, L."
    { type: 'trig', loc: 'st', mand: true, opt: true, label: 'Place a Spirit Message',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp !== c.ctrl,
      cond: (g, c, p) => freeST(g, p) >= 0 && msgsOn(g, p).length < 4,
      res: function* (g, c, p) {
        if (!onField(c) || !faceUp(c) || freeST(g, p) < 0) return;
        const have = new Set(msgsOn(g, p).map(x => D(x).n)); const next = MSGS.find(n => !have.has(n)); if (!next) return;
        const x = g.p[p].hand.find(y => named(y, next)) || g.p[p].deck.find(y => named(y, next));
        if (!x) { log(g, `${PN(g, p)} has no ${next} to place.`); return; }
        const fromDeck = x.zone === 'deck';
        move(g, x, 'st', { ctrl: p, pos: 'up', reason: 'effect' }); if (fromDeck) shuffleDeck(g, p);
        log(g, `${PN(g, p)} placed ${next} with Destiny Board.`);
        boardWin(g, p);
      } },
    // "When any Spirit Message card or Destiny Board you control leaves the field, send all of them to the GY."
    { type: 'trig', loc: 'any', mand: true, label: 'Send the Board and Messages to the GY',
      on: (g, ev, c) => ev.type === 'move' && ev.wasField && !ev.dboard && isBoardPart(ev.c) && ev.to !== 'st' &&
        (ev.c === c || (onField(c) && ev.prevCtrl === c.ctrl)),
      res: function* (g, c, p) {
        const who = onField(c) ? c.ctrl : p;
        const xs = stOf(g, who).filter(isBoardPart); if (!xs.length) return;
        for (const x of xs) move(g, x, 'gy', { reason: 'rule', dboard: true });
        log(g, `${xs.map(name).join(', ')} went to the GY.`);
      } }] },
  'Spirit Message "I"': spiritMessage,
  'Spirit Message "N"': spiritMessage,
  'Spirit Message "A"': spiritMessage,
  'Spirit Message "L"': spiritMessage,
}, 'goat');
})();
