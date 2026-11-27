/* Full pool batch 09: Grave Lure to Horus the Black Flame Dragon LV8 (build/batches/full/full-09.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text; cards with a
 Goat-only script elsewhere (Gravekeeper's Spear Soldier, Harpie Lady Sisters, Harpie's Feather Duster, Harpie's Pet Dragon,
 Horn of Heaven, Horn of the Unicorn, Horus LV6 and LV8) are ported here as the shared version (the Goat ones still win in Goat). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, setFaceDown, negate, addMod,
  equip, negateAttack, addRule, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk,
  monsOf, stOf, allField, fieldMons, freeM, freeST, shuffleDeck, log, PN, live, opp, stOnField, spellTrapAct,
  evSummoned, battleKill, stat, negd, num, isEHERO } = L;

/* ----- helpers ----- */
const noop = function* () {};
const named = (c, n) => D(c).n === n;
const txt = c => { const d = D(c); return d.ps && !/^No (?:Edison|rulings)/.test(d.ps) ? d.ps : d.tx || ''; };
const isGK = c => isMon(c) && /^Gravekeeper's/.test(D(c).n);
const isEH = c => isMon(c) && /^Elemental HERO/.test(D(c).n);
const isSixSam = c => isMon(c) && /Six Samurai/.test(D(c).n);
const SPECIAL = ['special', 'synchro', 'fusion', 'ritual'];
// a Normal Spell is face-up on the field while it resolves (Elegant Egotist, Level Up!)
const resolving = (g, p, n) => stOf(g, p).some(x => faceUp(x) && named(x, n));
// "Harpie Lady": the three numbered Harpie Ladies and Cyber Harpie Lady always, Harpie Queen on the field or in the GY.
// ENGINE: name() can't be changed by a script, so cards in other files that ask for "Harpie Lady" don't see these.
const HL = ['Harpie Lady', 'Harpie Lady 1', 'Harpie Lady 2', 'Harpie Lady 3', 'Cyber Harpie Lady'];
const isHL = c => HL.includes(D(c).n) || (named(c, 'Harpie Queen') && (onField(c) || c.zone === 'gy'));
const isHarpie = c => isMon(c) && /Harpie/.test(D(c).n);
const isFlipMon = c => /Flip/.test(D(c).ab || '') || /^(?:①\s*)?FLIP:/m.test(D(c).tx || '');
// Equip Spells
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) equip(g, c, t); } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
const equipsOn = (g, m) => stOnField(g).filter(x => faceUp(x) && isSpell(x) && D(x).sub === 'Equip' && x.equipTo === m.u);
// "Once per turn, you can flip this card into face-down Defense Position" (not the turn it was summoned or changed position)
const flipDown = () => ({ type: 'ign', opt: true, label: 'Flip this card face-down', cond: (g, c) => faceUp(c) && c.turnIn !== g.turnNo && !c.posChanged,
  res: function* (g, c) { if (onField(c) && faceUp(c)) { setFaceDown(g, c); c.posChanged = true; } } });
// A Trap that activates when something happens (classic-5.js trapTrig): the event is kept on the card.
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });
// Special Summon 1 card from the hand and/or Deck
function* ssFrom(g, p, f, text, zones, pos = 'atk') {
  const cs = zones.flatMap(z => g.p[p][z]).filter(f); if (!cs.length || freeM(g, p) < 0) { if (zones.includes('deck')) shuffleDeck(g, p); return null; }
  const [x] = yield* pick(g, p, text, cs, 1, 1, 'good'); let done = false;
  if (x) { const fromDeck = x.zone === 'deck'; done = ss(g, p, x, pos); if (fromDeck) shuffleDeck(g, p); }
  return done ? x : null;
}
// Spirit return (goat-1.js): during the End Phase of the turn it was Normal Summoned or flipped face-up
const spiritReturn = { type: 'trig', mand: true, label: 'Return to the hand',
  on: (g, ev, c) => {
    if ((ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how)) || (ev.type === 'flip' && ev.c === c)) c.flags.spirit = g.turnNo;
    return ev.type === 'phase' && ev.ph === 'end' && c.flags.spirit === g.turnNo; },
  res: function* (g, c) { if (onField(c) && faceUp(c)) { move(g, c, 'hand', { reason: 'effect' }); log(g, `${name(c)} returned to the hand.`); } } };
// Necrovalley's GY lock for Gravekeeper's Priestess (same reach as batch-4.js Necrovalley)
const NV_BANISH = ['Dark Armed Dragon', 'Blackwing - Vayu the Emblem of Honor', 'D.D. Crow', 'Book of Life'];
const noFieldSpell = g => ![g.p[0].fz, g.p[1].fz].some(f => f && faceUp(f));
const hasChief = (g, p) => monsOf(g, p).some(x => faceUp(x) && named(x, "Gravekeeper's Chief") && !negd(g, x));
// Gravekeeper's Watcher: does this card's effect make its activator discard? Read from the text, costs stripped
// (the part before a ";", "by discarding", "discard ... to activate"), and "your opponent discards" doesn't count.
const makesDiscard = c => { let t = txt(c).replace(/[^.:;]*;/g, ' ').replace(/by discarding[^.,]*/gi, ' ').replace(/discard[^.;]*to activate[^.]*/gi, ' ').replace(/(?:your )?opponent discards?[^.]*/gi, ' '); return /\bdiscards?\b/i.test(t); };
// S/T cards a player activated this turn (each activation stamps c.used with the turn number)
function stActsThisTurn(g, p) {
  let n = 0;
  for (const z of ['hand', 'deck', 'gy', 'ban', 'st']) for (const x of (g.p[p][z] || [])) {
    if (!x || !isST(x)) continue; const sc = E.SCRIPTS[D(x).n]; if (!sc || !sc.effs) continue;
    if (sc.effs.some((e, i) => e.type === 'act' && x.used && x.used[i] === g.turnNo)) n++;
  }
  if (g.p[p].fz) { const x = g.p[p].fz; const sc = E.SCRIPTS[D(x).n]; if (sc && sc.effs && sc.effs.some((e, i) => e.type === 'act' && x.used && x.used[i] === g.turnNo)) n++; }
  return n;
}

/* ----- summon locks -----
 ENGINE: no generic "can't be Special Summoned" / "can't be Summoned unless" flag (build/ENGINE_TODO.md), so these are one
 duel-long rule, installed by the first event any of these cards sees (a trig that never fires). */
const GUARDIAN_EQ = { 'Guardian Baou': 'Wicked-Breaking Flamberge - Baou', 'Guardian Ceal': 'Shooting Star Bow - Ceal', 'Guardian Elma': 'Butterfly Dagger - Elma',
  'Guardian Grarl': 'Gravity Axe - Grarl', "Guardian Kay'est": "Rod of Silence - Kay'est", 'Guardian Tryce': 'Twin Swords of Flashing Light - Tryce' };
const ctlFaceUp = (g, p, n) => stOf(g, p).some(x => faceUp(x) && named(x, n));
const LOCKS = {
  'Great Long Nose': (g, a) => a.type === 'ss',
  // Must first be Special Summoned by its own rule; once it was, card effects can revive it. PARTIAL: an effect that
  // Special Summons it from the hand isn't stopped.
  'Great Moth': (g, a) => a.type === 'ss' && (a.c.zone === 'deck' || (['gy', 'ban'].includes(a.c.zone) && !a.c.f09nomi)),
  // Must first be Special Summoned with Elegant Egotist (Goat keeps its classic-2.js lock).
  'Harpie Lady Sisters': (g, a) => { if (E.format() !== 'edison' || a.type !== 'ss') return false; if (resolving(g, a.p, 'Elegant Egotist')) { a.c.f09nomi = true; return false; } return !(['gy', 'ban'].includes(a.c.zone) && a.c.f09nomi); },
  // only by Horus LV6 (or Level Up!, which ignores summoning conditions); never revived (Goat keeps its goat-7.js lock)
  'Horus the Black Flame Dragon LV8': (g, a) => E.format() === 'edison' && a.type === 'ss' && g.f09lv !== a.c.u && !resolving(g, a.p, 'Level Up!'),
  "Gravekeeper's Chief": (g, a) => a.type !== 'set' && monsOf(g, a.p).some(x => faceUp(x) && named(x, "Gravekeeper's Chief")),
  'Guardian of Order': (g, a) => monsOf(g, a.p).some(x => named(x, 'Guardian of Order')),
};
for (const n in GUARDIAN_EQ) LOCKS[n] = (g, a) => !ctlFaceUp(g, a.p, GUARDIAN_EQ[n]);
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: g => { if (!g.f09lock) { g.f09lock = true; addRule(g, (g2, a) => { if (!a.c || !['ns', 'set', 'ss'].includes(a.type)) return false; const f = LOCKS[D(a.c).n]; return !!f && f(g2, a); }); } return false; } };

/* ----- Horus ----- */
const horusKill = { type: 'trig', on: (g, ev, c) => { if (ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c) c.flags.horusKill = g.turnNo; return false; }, res: noop };
const horusUp = next => ({ type: 'trig', tags: { ss: 1 }, label: `Send it: summon ${next}`,
  on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.horusKill === g.turnNo,
  cond: (g, c, p) => onField(c) && faceUp(c) && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, `Horus the Black Flame Dragon ${next}`)),
  cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(c).n} to the GY.`); },
  res: function* (g, c, p) {
    const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, `Horus the Black Flame Dragon ${next}`)); if (!cs.length || freeM(g, p) < 0) return;
    const [x] = yield* pick(g, p, `Special Summon Horus the Black Flame Dragon ${next}`, cs, 1, 1, 'good');
    if (x) { const fromDeck = x.zone === 'deck'; g.f09lv = x.u; try { ss(g, p, x); } finally { g.f09lv = null; } if (fromDeck) shuffleDeck(g, p); } } });

E.addScripts({
  // PARTIAL: the Deck has no face-up cards, so the card is shown in the log; sending it to the GY on the draw uses a chain link.
  'Grave Lure': { effs: [
    { type: 'act', cond: (g, c, p) => g.p[opp(p)].deck.length > 0,
      res: function* (g, c, p) { const d = g.p[opp(p)].deck; if (!d.length) return; const x = d[d.length - 1]; x.flags.lure = c.u; log(g, `${name(x)} was turned face-up on top of ${PN(g, opp(p))}'s Deck.`); shuffleDeck(g, opp(p)); log(g, `${PN(g, opp(p))} shuffled the Deck.`); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Send the face-up card to the GY',
      on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && ev.to === 'hand' && ev.c.flags.lure === c.u,
      res: function* (g, c, p, L2) { const x = L2.ev.c; x.flags.lure = null; if (x.zone === 'hand') { move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${name(x)} was drawn face-up and sent to the GY.`); } } }] },
  'Grave of the Super Ancient Organism': (() => {
    const hit = (g, c) => c && c.zone === 'm' && faceUp(c) && lv(c) >= 6 && SPECIAL.includes(c.summonType);
    return { effs: [{ type: 'act', res: function* (g) { g.seq++; } }],
      cont: { forbid: (g, src, a) => (a.type === 'attack' && hit(g, a.c)) || (a.type === 'activate' && a.eff && a.eff.type !== 'act' && hit(g, a.c)) } }; })(),
  'Grave Ohja': { self: { noAttackTarget: (g, c) => monsOf(g, c.ctrl).some(x => x.pos === 'set') },
    effs: [{ type: 'trig', mand: true, label: '300 damage', on: (g, ev, c) => ev.type === 'summon' && ev.how === 'flip' && ev.p === c.ctrl,
      res: function* (g, c, p) { damage(g, opp(p), 300, { src: c, srcP: p }); } }] },
  // The monster is still destroyed by battle (Great Dezard counts it), but goes to the Deck: no "sent to the GY" triggers.
  'Grave Protector': { cont: { replaceDestroy: (g, src, m, o) => {
    if (!o.battle || m === src || !onField(m)) return false;
    move(g, m, 'deck', { reason: 'battle', destroyed: true, battle: true, killer: o.killer }); log(g, `${D(m).n} was destroyed by battle and shuffled into the Deck.`); return true; } } },
  'Grave Squirmer': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy 1 card on the field',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: g => allField(g).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', allField(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  "Gravekeeper's Cannonholder": { effs: [{ type: 'ign', label: "Tribute a Gravekeeper's: 700 damage",
    cond: (g, c, p) => monsOf(g, p).some(x => x !== c && isGK(x) && !named(x, "Gravekeeper's Cannonholder") && (faceUp(x) || x.ctrl === p)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, "Tribute 1 Gravekeeper's monster", monsOf(g, p).filter(x => x !== c && isGK(x) && !named(x, "Gravekeeper's Cannonholder")), 1, 1, 'cost');
      if (x) { move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    res: function* (g, c, p) { damage(g, opp(p), 700, { src: c, srcP: p }); } }] },
  // PARTIAL: "Your GY is unaffected by Necrovalley" only reaches Gravekeeper's Priestess here; batch-4.js Necrovalley
  // doesn't look for it (ENGINE: no "unaffected by" hook for Field Spells). Only 1 face-up Chief: Flip Summons aren't stopped.
  "Gravekeeper's Chief": { effs: [lockInstall, { type: 'trig', when: true, tags: { ss: 1 }, label: "Special Summon a Gravekeeper's from your GY",
    on: (g, ev, c) => evSummoned(ev, c, ['tribute']),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(isGK),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, "Special Summon which Gravekeeper's monster?", g.p[p].gy.filter(isGK), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  "Gravekeeper's Curse": { effs: [{ type: 'trig', mand: true, label: '500 damage', on: (g, ev, c) => evSummoned(ev, c),
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  "Gravekeeper's Guard": { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Return a monster to the hand', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which monster to the hand?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) { move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${D(t).n} returned to the hand.`); } } }] },
  // While no Field Spell is face-up: Necrovalley's +500 for Gravekeeper's and its GY banish lock (the same reach as
  // batch-4.js Necrovalley). PARTIAL: effects that target the GY aren't negated (no hook, same as Necrovalley).
  "Gravekeeper's Priestess": { cont: {
    atk: (g, src, c) => isGK(c) ? 200 + (noFieldSpell(g) ? 500 : 0) : 0,
    def: (g, src, c) => isGK(c) ? 200 + (noFieldSpell(g) ? 500 : 0) : 0,
    forbid: (g, src, a) => noFieldSpell(g) && !(a.p != null && hasChief(g, a.p)) && ((a.type === 'banish' && a.from === 'gy') || (a.type === 'activate' && a.c && NV_BANISH.includes(D(a.c).n))) } },
  // The mill is done as the attack is declared (a cost of the attack, no chain link).
  "Gravekeeper's Servant": { effs: [{ type: 'act', res: function* (g) { g.seq++; } },
    { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'attack' && ev.a && ev.a.ctrl !== c.ctrl && faceUp(c)) mill(g, ev.a.ctrl, 1); return false; }, res: noop }],
    cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && a.c.ctrl !== src.ctrl && g.p[a.c.ctrl].deck.length < stOf(g, src.ctrl).filter(x => faceUp(x) && named(x, "Gravekeeper's Servant")).length } },
  "Gravekeeper's Spear Soldier": { self: { piercing: true } },
  // Its battle damage to the opponent becomes effect damage (no Battle Damage, so "battle damage" triggers don't see it).
  "Gravekeeper's Vassal": { cont: { dmg: (g, src, p, n, o) => {
    if (!o.battle || o.src !== src || p === src.ctrl || n <= 0) return undefined;
    damage(g, p, n, { src, srcP: src.ctrl }); return 0; } } },
  // PARTIAL: with a Gravekeeper's monster on your side it can be Tribute Summoned with 1 Tribute, but the engine lets any
  // monster be that Tribute. The destruction replacement discards the first Gravekeeper's monster in the hand (no prompt).
  "Gravekeeper's Visionary": { self: {
    tributes: (g, c, p) => monsOf(g, p).some(isGK) ? 1 : null,
    atk: (g, c) => 200 * g.p[c.ctrl].gy.filter(isGK).length,
    replaceDestroy: (g, c) => { const x = g.p[c.ctrl].hand.find(isGK); if (!x) return false; move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, c.ctrl)} discarded ${D(x).n} so Gravekeeper's Visionary wasn't destroyed.`); return true; } } },
  // PARTIAL: "could make them discard" is read from the activated card's text.
  "Gravekeeper's Watcher": { effs: [{ type: 'quick', loc: 'hand', label: 'Negate a discard effect',
    cond: (g, c, p, x) => { const t = x && x.top; return !!t && t.p !== p && !t.negated && (spellTrapAct(t) || (isMon(t.c) && t.eff.type !== 'act')) && makesDiscard(t.c); },
    cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Gravekeeper's Watcher to the GY.`); },
    res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated) return; T.negBy = p; negate(g, T, true); } }] },
  'Gravity Axe - Grarl': { cont: { ...eqBonus(500, 0), forbid: (g, src, a) => a.type === 'pos' && a.c && !!src.equipTo && a.c.ctrl !== src.ctrl }, effs: [equipAct()] },
  // PARTIAL: the first effect (negate and destroy Spells/Traps that target it) is offered as a Spell Speed 3 response.
  'Great Dezard': { effs: [
    { type: 'trig', on: (g, ev, c) => { if (ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && onField(c)) { c.flags.dezard = (c.flags.dezard || 0) + 1; if (c.flags.dezard <= 2) log(g, `Great Dezard has destroyed ${c.flags.dezard} monster${c.flags.dezard > 1 ? 's' : ''} by battle.`); } return false; }, res: noop },
    { type: 'quick', speed: 3, ds: true, needsSelf: true, label: 'Negate a Spell/Trap that targets it',
      cond: (g, c, p, x) => { const t = x && x.top; return (c.flags.dezard || 0) >= 1 && !!t && spellTrapAct(t) && !t.negated && t.t.includes(c); },
      target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated) return; T.negBy = p; negate(g, T, true); } },
    { type: 'ign', tags: { ss: 1 }, label: 'Tribute it: summon Fushioh Richie',
      cond: (g, c, p) => (c.flags.dezard || 0) >= 2 && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Fushioh Richie')),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Great Dezard.`); },
      res: function* (g, c, p) { yield* ssFrom(g, p, x => named(x, 'Fushioh Richie'), 'Special Summon Fushioh Richie', ['hand', 'deck']); } }] },
  'Great Long Nose': { effs: [lockInstall, spiritReturn,
    { type: 'trig', mand: true, label: 'Your opponent skips their next Battle Phase', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
      res: function* (g, c, p) { (g.f09skip || (g.f09skip = [false, false]))[opp(p)] = true; log(g, `${PN(g, opp(p))} skips their next Battle Phase.`); } },
    { type: 'trig', loc: 'any', on: (g, ev) => { if (ev.type === 'phase' && ev.ph === 'standby' && g.f09skip && g.f09skip[ev.tp]) { g.f09skip[ev.tp] = false; g.noBP[ev.tp] = true; } return false; }, res: noop }] },
  // Its ATK becomes twice the highest original ATK among its Tributes (set as it is summoned, no chain link).
  'Great Maju Garzett': { effs: [{ type: 'trig', on: (g, ev, c) => {
    if (evSummoned(ev, c, ['tribute']) && ev.tribs && ev.tribs.length) { const a = Math.max(...ev.tribs.map(t => num(D(t).atk))); c.flags.baseAtk = 2 * a; g.seq++; log(g, `Great Maju Garzett's ATK became ${2 * a}.`); }
    return false; }, res: noop }] },
  'Great Moth': { effs: [lockInstall],
    proc: { label: 'Special Summon (Tribute Petit Moth in its Cocoon)',
      cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && named(m, 'Petit Moth') && stOnField(g).some(x => named(x, 'Cocoon of Evolution') && x.equipTo === m.u && x.flags.cocoon && x.flags.cocoonTurns >= 4)),
      cost: function* (g, c, p, grp) { const ms = monsOf(g, p).filter(m => faceUp(m) && named(m, 'Petit Moth') && stOnField(g).some(x => named(x, 'Cocoon of Evolution') && x.equipTo === m.u && x.flags.cocoon && x.flags.cocoonTurns >= 4));
        const [m] = yield* pick(g, p, 'Tribute which Petit Moth?', ms, 1, 1, 'cost'); if (m) { move(g, m, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Petit Moth.`); } c.f09nomi = true; } } },
  // The declared name is picked from the opponent's own cards (hand, Deck, GY and Extra Deck).
  'Great Phantom Thief': { effs: [{ type: 'trig', mand: true, label: 'Declare a card name', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    res: function* (g, c, p) { const P = g.p[opp(p)]; const names = [...new Set([...P.hand, ...P.deck, ...P.gy, ...P.extra].map(x => D(x).n))].sort(); if (!names.length) return;
      const nm = names[yield* choose(g, p, 'Declare 1 card name', names)]; log(g, `${PN(g, p)} declared ${nm} and looked at ${PN(g, opp(p))}'s hand.`);
      const xs = P.hand.filter(x => D(x).n === nm); for (const x of xs) move(g, x, 'gy', { reason: 'discard', by: p }); log(g, xs.length ? `${PN(g, opp(p))} discarded ${xs.length} ${nm}.` : `${PN(g, opp(p))} had no ${nm} in hand.`); } }] },
  // PARTIAL: Spell/Trap activations are counted for the whole turn (also before Shien was on the field, and negated ones);
  // the destruction replacement picks your lowest-ATK face-up Six Samurai monster with no prompt.
  'Great Shogun Shien': {
    proc: { label: 'Special Summon (2 face-up Six Samurai)', cond: (g, c, p) => monsOf(g, p).filter(x => faceUp(x) && isSixSam(x)).length >= 2 },
    cont: { forbid: (g, src, a) => a.type === 'activate' && a.p === opp(src.ctrl) && a.c && isST(a.c) && a.eff && a.eff.type === 'act' && stActsThisTurn(g, a.p) >= 1 },
    self: { replaceDestroy: (g, c) => { const xs = monsOf(g, c.ctrl).filter(x => x !== c && faceUp(x) && isSixSam(x)).sort((a, b) => stat(g, a, 'atk') - stat(g, b, 'atk')); if (!xs.length) return false;
      log(g, `${PN(g, c.ctrl)} destroyed ${name(xs[0])} instead of Great Shogun Shien.`); destroy(g, [xs[0]], { by: c.ctrl }); return true; } } },
  'Great Spirit': { effs: [flipDown(),
    { type: 'trig', when: true, label: 'Switch the original ATK and DEF of an EARTH monster', on: (g, ev, c) => evSummoned(ev, c, ['flip']),
      cond: g => fieldMons(g).some(x => faceUp(x) && attr(x) === 'EARTH'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Switch the original ATK and DEF of which EARTH monster?', fieldMons(g).filter(x => faceUp(x) && attr(x) === 'EARTH'), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || attr(t) !== 'EARTH') return; const a = baseAtk(t), d = num(D(t).def);
        addMod(g, t, { atk: d - a, def: a - d, end: true }); log(g, `${name(t)}'s original ATK and DEF were switched.`); } }] },
  // PARTIAL: Normal Draws are told apart by the Draw Phase (an effect draw in the Draw Phase isn't counted).
  'Greed': { effs: [{ type: 'act', res: function* (g, c) { c.flags.greed = [0, 0]; g.seq++; } },
    { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'move' && ev.reason === 'draw' && ev.to === 'hand' && g.phase !== 'draw' && faceUp(c)) { const f = c.flags.greed || (c.flags.greed = [0, 0]); f[ev.c.owner]++; } return false; }, res: noop },
    { type: 'trig', loc: 'st', mand: true, label: '500 damage for each card drawn by effects',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!c.flags.greed && (c.flags.greed[0] > 0 || c.flags.greed[1] > 0),
      res: function* (g, c, p) { const f = c.flags.greed || [0, 0]; c.flags.greed = [0, 0]; for (const q of [g.tp, opp(g.tp)]) if (f[q]) damage(g, q, 500 * f[q], { src: c, srcP: p }); } }] },
  'Greed Grado': { effs: [
    { type: 'act', cond: (g, c, p) => !!g.f09grado && g.f09grado[p] === g.turnNo && g.p[p].deck.length >= 2, res: function* (g, c, p) { draw(g, p, 2); } },
    { type: 'trig', loc: 'any', on: (g, ev) => {
      if (ev.type === 'move' && ev.destroyed && ev.wasField && ev.snap && ev.snap.faceUp && D(ev.c).k === 'synchro') {
        const q = opp(ev.prevCtrl), mine = ev.battle ? ev.killer && ev.killer.ctrl === q : ev.by === q;
        if (mine) (g.f09grado || (g.f09grado = [0, 0]))[q] = g.turnNo; }
      return false; }, res: noop }] },
  'Greed Quasar': { self: { atk: (g, c) => 300 * lv(c) - baseAtk(c), def: (g, c) => 300 * lv(c) - num(D(c).def) },
    effs: [{ type: 'trig', on: (g, ev, c) => { if (ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && onField(c) && faceUp(c) && !negd(g, c)) { const n = ev.snap ? ev.snap.lv : lv(ev.c); if (n > 0) { c.flags.lv = lv(c) + n; g.seq++; log(g, `Greed Quasar is now Level ${c.flags.lv}.`); } } return false; }, res: noop }] },
  'Guardian Angel Joan': { effs: [{ type: 'trig', mand: true, label: 'Gain LP', on: (g, ev, c) => battleKill(ev, c),
    res: function* (g, c, p, L2) { gain(g, p, num(D(L2.ev.c).atk)); } }] },
  // The destroyed monster's effects can't be activated this turn (a rule set as it is destroyed, so its triggers are dropped).
  'Guardian Baou': { effs: [lockInstall,
    { type: 'trig', on: (g, ev, c) => { if (ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && isMon(ev.c)) { const v = ev.c; addRule(g, (g2, a) => a.type === 'activate' && a.c === v, { end: g.turnNo }); } return false; }, res: noop },
    { type: 'trig', mand: true, label: 'Gain 1000 ATK', on: (g, ev, c) => battleKill(ev, c) && ev.c.owner !== c.ctrl,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 1000 }); log(g, 'Guardian Baou gained 1000 ATK.'); } } }] },
  'Guardian Ceal': { effs: [lockInstall, { type: 'ign', tags: { destroy: 1 }, label: 'Send an Equip: destroy a monster',
    cond: (g, c, p) => equipsOn(g, c).some(x => x.ctrl === p) && monsOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Equip Spell to the GY?', equipsOn(g, c).filter(x => x.ctrl === p), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  'Guardian Eatos': {
    proc: { label: 'Special Summon (no monsters in your GY)', cond: (g, c, p) => !g.p[p].gy.some(isMon) },
    effs: [{ type: 'ign', label: 'Send an Equip: banish monsters from their GY',
      cond: (g, c, p) => equipsOn(g, c).length > 0 && g.p[opp(p)].gy.some(isMon),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Equip Spell to the GY?', equipsOn(g, c), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish up to 3 monsters from their GY', g.p[opp(p)].gy.filter(isMon), 1, 3, 'bad'); },
      res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: p }); if (!xs.length) return;
        log(g, `${xs.map(x => D(x).n).join(', ')} ${xs.length > 1 ? 'were' : 'was'} banished.`); if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500 * xs.length, end: true }); log(g, `Guardian Eatos gained ${500 * xs.length} ATK.`); } } }] },
  // PARTIAL: "appropriate" is read from the Equip's text ("Equip only to a ... monster"); Premature Burial and Snatch Steal style cards are left out.
  'Guardian Elma': (() => {
    const BAD = ['Premature Burial', 'Snatch Steal', 'Mist Body', 'Creature Swap'];
    const fits = (eq, m) => { if (!isSpell(eq) || D(eq).sub !== 'Equip' || BAD.includes(D(eq).n)) return false; const t = txt(eq); if (/take control|control of|Equip only to a (?:face-up )?monster your opponent controls|from your GY|from the GY/i.test(t)) return false;
      const k = t.match(/Equip only to (?:a |an )?(?:face-up )?([A-Z]+|[A-Z][a-z-]+(?: [A-Z][a-z-]+)?)(?: |-Type )monster/); if (!k) return true; const w = k[1]; return w === attr(m) || w === race(m) || name(m).includes(w); };
    return { effs: [lockInstall, { type: 'trig', when: true, label: 'Equip an Equip Spell from your GY',
      on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute', ...SPECIAL]),
      cond: (g, c, p) => freeST(g, p) >= 0 && g.p[p].gy.some(x => fits(x, c)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip which Equip Spell to Guardian Elma?', g.p[p].gy.filter(x => fits(x, c)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const x = L2.t[0]; if (!x || x.zone !== 'gy' || !onField(c) || !faceUp(c) || freeST(g, p) < 0) return;
        move(g, x, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); if (!equip(g, x, c)) move(g, x, 'gy', { reason: 'rule' }); g.seq++; } }] }; })(),
  'Guardian Grarl': { effs: [lockInstall], proc: { label: 'Special Summon (only card in your hand)', cond: (g, c, p) => g.p[p].hand.length === 1 && g.p[p].hand[0] === c } },
  "Guardian Kay'est": { effs: [lockInstall], self: { unaffectedSpells: true, noAttackTarget: true } },
  'Guardian of Order': { effs: [lockInstall], proc: { label: 'Special Summon (2 LIGHT monsters)', cond: (g, c, p) => monsOf(g, p).filter(x => faceUp(x) && attr(x) === 'LIGHT').length >= 2 } },
  'Guardian Sphinx': { effs: [flipDown(),
    { type: 'trig', mand: true, label: 'Return all their monsters to the hand', on: (g, ev, c) => evSummoned(ev, c, ['flip']),
      res: function* (g, c, p) { const xs = monsOf(g, opp(p)); for (const x of xs) move(g, x, 'hand', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.map(x => D(x).n).join(', ')} returned to the hand.`); } }] },
  'Guardian Statue': { effs: [flipDown(),
    { type: 'trig', mand: true, label: 'Return a monster to the hand', on: (g, ev, c) => evSummoned(ev, c, ['flip']),
      cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which monster to the hand?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) { move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${D(t).n} returned to the hand.`); } } }] },
  // The monster Tributed for its Tribute Summon is remembered on the card (c.tributes, set by the engine).
  'Guardian Tryce': { effs: [lockInstall, { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon its Tribute',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy' && c.summonType === 'tribute' && (c.tributes || []).length > 0,
    cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) { const u = (c.tributes || [])[0]; const x = [...g.p[0].gy, ...g.p[1].gy].find(y => y.u === u); if (x && isMon(x) && !/Cannot be Special Summoned|Must (?:first )?be Special Summoned/i.test(txt(x))) ss(g, p, x); } }] },
  'Harpie Lady 1': { cont: { atk: (g, src, c) => faceUp(c) && attr(c) === 'WIND' ? 300 : 0 } },
  // Its battle with a Flip monster that will be destroyed: that monster's effects can't be activated this turn.
  'Harpie Lady 2': { effs: [{ type: 'trig', on: (g, ev, c) => {
    if (ev.type === 'afterCalc' && (ev.a === c || ev.t === c)) { const o = ev.a === c ? ev.t : ev.a; if (o && o.flags.battleDoomed && isFlipMon(o)) addRule(g, (g2, a) => a.type === 'activate' && a.c === o, { end: g.turnNo }); }
    return false; }, res: noop }] },
  'Harpie Lady 3': { effs: [{ type: 'trig', on: (g, ev, c) => {
    if (ev.type === 'dsStart' && (ev.a === c || ev.t === c)) { const o = ev.a === c ? ev.t : ev.a; if (o && o.ctrl !== c.ctrl) {
      const until = g.tp === o.ctrl ? g.turnNo + 2 : g.turnNo + 3; addRule(g, (g2, a) => a.type === 'attack' && a.c === o, { end: until }); log(g, `${name(o)} can't attack during its controller's next 2 turns.`); } }
    return false; }, res: noop }] },
  'Harpie Lady Sisters': { effs: [lockInstall] },
  'Harpie Queen': { effs: [{ type: 'ign', loc: 'hand', label: "Discard: add Harpies' Hunting Ground",
    cond: (g, c, p) => g.p[p].deck.some(x => named(x, "Harpies' Hunting Ground")),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded Harpie Queen.`); },
    res: function* (g, c, p) { yield* search(g, p, x => named(x, "Harpies' Hunting Ground"), "Add Harpies' Hunting Ground"); } }] },
  "Harpie's Feather Duster": { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => stOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { destroy(g, stOf(g, opp(p)), { by: p, src: c }); } }] },
  "Harpie's Pet Baby Dragon": (() => {
    const n = (g, c) => monsOf(g, c.ctrl).filter(x => x !== c && faceUp(x) && isHarpie(x) && !named(x, "Harpie's Pet Baby Dragon")).length;
    return {
      self: { atk: (g, c) => n(g, c) >= 2 ? baseAtk(c) : 0, def: (g, c) => n(g, c) >= 2 ? num(D(c).def) : 0 },
      cont: { grant: (g, src, m, flag) => flag === 'noAttackTarget' && m.ctrl === src.ctrl && m !== src && faceUp(m) && isHarpie(m) && !named(m, "Harpie's Pet Baby Dragon") && n(g, src) >= 1 },
      effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy 1 card (3 Harpies)',
        cond: (g, c, p) => n(g, c) >= 3 && fieldOfOpp(g, p).length > 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', fieldOfOpp(g, p), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] }; })(),
  "Harpie's Pet Dragon": { self: { atk: g => 300 * fieldMons(g).filter(x => faceUp(x) && isHL(x)).length, def: g => 300 * fieldMons(g).filter(x => faceUp(x) && isHL(x)).length } },
  // Activated before an attack, it negates the next attack this turn.
  'Hero Barrier': { effs: [
    { type: 'act', cond: (g, c, p) => g.tp !== p && !g.inDS && ['main1', 'battle'].includes(g.phase),
      res: function* (g, c, p) { if (!monsOf(g, p).some(x => faceUp(x) && isEHERO(x))) { log(g, 'Hero Barrier did nothing (no face-up Elemental HERO).'); return; }
        if (g.aw && g.aw.a.ctrl !== p) { negateAttack(g); log(g, 'Hero Barrier negated the attack.'); } else { (g.f09barrier || (g.f09barrier = [])).push({ p, turn: g.turnNo }); log(g, 'Hero Barrier will negate the next attack.'); } } },
    { type: 'trig', loc: 'any', on: (g, ev) => {
      if (ev.type === 'attack' && g.f09barrier) { const i = g.f09barrier.findIndex(e => e.turn === g.turnNo && e.p !== ev.p); if (i >= 0) { g.f09barrier.splice(i, 1); negateAttack(g); log(g, 'Hero Barrier negated the attack.'); } }
      return false; }, res: noop }] },
  'Hero Counterattack': { effs: [trapTrig({ label: 'Reveal a random card from your hand', tags: { destroy: 1, ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.wasField && ev.prevCtrl === c.ctrl && ev.snap && /^Elemental HERO/.test(ev.snap.name),
    cond: (g, c, p) => g.p[p].hand.length > 0,
    res: function* (g, c, p) { const h = g.p[p].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; log(g, `${PN(g, opp(p))} picked ${name(x)} from ${PN(g, p)}'s hand.`);
      if (!isEH(x)) return; const os = monsOf(g, opp(p)); if (!os.length) return;
      const [t] = yield* pick(g, p, 'Destroy which of their monsters?', os, 1, 1, 'bad'); if (t) destroy(g, [t], { by: p, src: c });
      if (x.zone === 'hand' && !ss(g, p, x)) { move(g, x, 'gy', { reason: 'effect', destroyed: true }); log(g, `${name(x)} was destroyed.`); } } })] },
  'Hero Flash!!': (() => {
    const HERO = ['H - Heated Heart', 'E - Emergency Call', 'R - Righteous Justice', 'O - Oversoul'];
    return { cont: { loc: 'gy', grant: (g, src, m, flag) => flag === 'directAttack' && m.flags.f09flash === g.turnNo && faceUp(m) },
      effs: [{ type: 'act', cond: (g, c, p) => HERO.every(n => g.p[p].gy.some(x => named(x, n))),
        cost: function* (g, c, p) { const xs = HERO.map(n => g.p[p].gy.find(x => named(x, n))); for (const x of xs) move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished H, E, R and O.`); },
        res: function* (g, c, p) { yield* ssFrom(g, p, x => isEH(x) && D(x).k === 'normal', 'Special Summon an Elemental HERO Normal Monster', ['deck']);
          for (const m of monsOf(g, p)) if (faceUp(m) && isEH(m) && D(m).k === 'normal') m.flags.f09flash = g.turnNo; g.seq++; log(g, 'Elemental HERO Normal Monsters can attack directly this turn.'); } }] }; })(),
  'Hero Heart': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isEHERO(x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which Elemental HERO?', monsOf(g, p).filter(x => faceUp(x) && isEHERO(x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const a = stat(g, t, 'atk'); addMod(g, t, { atk: -(a - Math.floor(a / 2)), end: true }); t.flags.extraAttack = g.turnNo; log(g, `${name(t)}'s ATK was halved and it can attack twice this turn.`); } }] },
  'Hero Kid': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon Hero Kids from your Deck', on: (g, ev, c) => evSummoned(ev, c, SPECIAL),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => named(x, 'Hero Kid')),
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => named(x, 'Hero Kid')); const n = Math.min(cs.length, 5 - monsOf(g, p).length); if (n <= 0) return;
      const xs = yield* pick(g, p, 'Special Summon any number of Hero Kid from your Deck', cs, 1, n, 'good'); for (const x of xs) ss(g, p, x, 'def'); shuffleDeck(g, p); } }] },
  // ENGINE: name() can't be changed by a script, so the target's name stays the same (only the Deck to GY part is done).
  // PARTIAL / ENGINE: name() can't be changed by a script (build/ENGINE_TODO.md), so the new name is only logged and kept in
  // c.flags.f09mask; cards that check names still see the original one.
  'Hero Mask': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which face-up monster?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; const x = yield* search(g, p, isEH, 'Send an Elemental HERO from your Deck to the GY', 'gy'); if (x && t && faceUp(t)) { t.flags.f09mask = D(x).n; log(g, `${name(t)} is treated as ${D(x).n} until the End Phase.`); } } }] },
  'Hero Medal': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Shuffle it into the Deck and draw 1',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !ev.battle && ev.to === 'gy' && ev.snap && ev.snap.pos === 'set' && ev.by === opp(c.owner),
    res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'deck', { reason: 'effect' }); log(g, 'Hero Medal was shuffled into the Deck.'); } draw(g, p, 1); } }] },
  // PARTIAL: an attack on the equipped monster by a 1900+ ATK monster is negated as it is declared (it isn't kept out of the target list).
  'Hero Ring': { effs: [
    { type: 'act', cond: g => fieldMons(g).some(x => faceUp(x) && race(x) === 'Warrior' && stat(g, x, 'atk') <= 1500),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Hero Ring to which Warrior?', fieldMons(g).filter(x => faceUp(x) && race(x) === 'Warrior' && stat(g, x, 'atk') <= 1500), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && equip(g, c, t)) L2.keep = true; } },
    { type: 'trig', loc: 'st', on: (g, ev, c) => {
      if (ev.type === 'attack' && ev.t && c.equipTo === ev.t.u && ev.a.ctrl !== c.ctrl && stat(g, ev.a, 'atk') >= 1900) { negateAttack(g); log(g, `Hero Ring stops ${name(ev.a)} from attacking ${name(ev.t)}.`); }
      return false; }, res: noop }] },
  'Hero Signal': { effs: [trapTrig({ label: 'Special Summon an Elemental HERO', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.wasField && ev.to === 'gy' && ev.prevCtrl === c.ctrl && isMon(ev.c),
    cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].deck].some(x => isEH(x) && lv(x) <= 4),
    res: function* (g, c, p) { yield* ssFrom(g, p, x => isEH(x) && lv(x) <= 4, 'Special Summon a Level 4 or lower Elemental HERO', ['hand', 'deck']); } })] },
  'Hero Spirit': { cont: { loc: 'gy', dmg: (g, src, p, n, o) => o.battle && o.src && (g.f09spirit || []).some(e => e.p === p && e.u === o.src.u && e.turn === g.turnNo && e.c === src.u) ? 0 : undefined },
    effs: [{ type: 'act', cond: (g, c, p) => g.phase === 'battle' && monsOf(g, opp(p)).length > 0 && g.events.some(e => e.type === 'move' && e.battle && e.destroyed && e.turn === g.turnNo && e.prevCtrl === p && e.snap && /^Elemental HERO/.test(e.snap.name)),
      res: function* (g, c, p) { const os = monsOf(g, opp(p)); if (!os.length) return; const [t] = yield* pick(g, p, 'Battle damage from which monster becomes 0?', os, 1, 1, 'bad');
        if (t) { (g.f09spirit || (g.f09spirit = [])).push({ p, u: t.u, turn: g.turnNo, c: c.u }); log(g, `Battle damage from ${name(t)} becomes 0 this turn.`); } } }] },
  'Horn of Heaven': { effs: [{ type: 'act', negSummon: true, tags: { destroy: 1 },
    cond: (g, c, p, x) => !x.top && !!g.attempt && monsOf(g, p).some(m => !g.attempt.cs.includes(m)),
    cost: function* (g, c, p) { const [m] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p).filter(m => !g.attempt.cs.includes(m)), 1, 1, 'cost'); if (m) { const nm = m.pos === 'set' ? 'a face-down monster' : name(m); move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); } },
    res: function* (g) { if (g.attempt) { g.attempt.negated = true; log(g, 'The summon was negated.'); } } }] },
  'Horn of Light': { cont: eqBonus(0, 800), effs: [equipAct(),
    { type: 'trig', loc: 'gy', when: true, label: 'Pay 500 LP: return it to the top of the Deck',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy',
      cond: (g, c, p) => g.p[p].lp > 500,
      cost: function* (g, c, p) { pay(g, p, 500); },
      res: function* (g, c) { if (c.zone === 'gy') { move(g, c, 'deckTop', { reason: 'effect' }); log(g, `Horn of Light returned to the top of ${PN(g, c.owner)}'s Deck.`); } } }] },
  'Horn of the Unicorn': { cont: eqBonus(700, 700), effs: [equipAct(),
    { type: 'trig', loc: 'gy', mand: true, label: 'Return to the top of the Deck', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy',
      res: function* (g, c) { if (c.zone === 'gy') { move(g, c, 'deckTop', { reason: 'effect' }); log(g, `Horn of the Unicorn returned to the top of ${PN(g, c.owner)}'s Deck.`); } } }] },
  // ENGINE: takeControl() has no "control can't switch" check, so the first sentence isn't applied.
  // Control can't switch: a take of control is undone at once (the full-07.js Element pattern).
  // PARTIAL / ENGINE: takeControl() has no forbid check, so Change of Heart and the like resolve and then control goes straight back.
  'Horus the Black Flame Dragon LV4': { effs: [horusKill, horusUp('LV6'), { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
    if (!onField(c) || !faceUp(c)) { c.f09ctrl = null; return false; }
    if (c.f09ctrl != null && c.ctrl !== c.f09ctrl && !negd(g, c) && freeM(g, c.f09ctrl) >= 0) { const back = c.f09ctrl; c.flags.ctrlUntil = null; c.flags.ctrlFrom = null; L.takeControl(g, back, c, false); log(g, `Control of ${name(c)} can't switch.`); }
    c.f09ctrl = c.ctrl; return false; } }] },
  'Horus the Black Flame Dragon LV6': { self: { unaffectedSpells: true }, effs: [horusKill, horusUp('LV8')] },
  'Horus the Black Flame Dragon LV8': { effs: [lockInstall,
    { type: 'quick', ds: true, needsSelf: true, label: 'Negate a Spell', cond: (g, c, p, x) => { const t = x && x.top; return !!(t && spellTrapAct(t) && isSpell(t.c) && !t.negated); },
      target: function* (g, c, p, L2) { L2.data.tl = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { const t = L2.data.tl; if (!onField(c) || !faceUp(c) || !t || t.negated) return; t.negBy = p; negate(g, t, true); } }] },
});
function fieldOfOpp(g, p) { return [...monsOf(g, opp(p)), ...stOf(g, opp(p))]; }
})();
