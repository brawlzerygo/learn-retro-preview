/* Goat 7: Clown Control, Heavy Slump, Stein Gate Turbo, Last Turn, Library FTK, Monarch, Earth Beat, Drain Beat,
 Cat OTK, Cat Burn, Stein Horus, Stein OTK, Panda Burn, Bazoo Burn and the other decks that share these cards.
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md), registered for Goat only (E.addScripts(obj, 'goat')).
 Written from each card's 2005 (summer Goat format) behavior; where today's text in goat/data/cards.js reads
 differently, the 2005 reading is used and noted. Coin calls are a fair coin (the caller is right half the time). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, addMod, equip, addCtr, ctr, name, D, isMon, isSpell, isTrap,
  isST, isExtraD, onField, faceUp, attr, race, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, shuffleDeck, log, PN,
  live, opp, emit, forbid, stat, evSummoned, battleKill, spellTrapAct } = L;

const named = (c, n) => D(c).n === n;
const coin = g => g.rnd() < 0.5; // true: the call was right
const tx = c => D(c).ps || D(c).tx || '';
// A monster changes battle position by a card effect: logged and announced (Dream Clown watches for it).
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'atk' }); };
// Spell Counters as each Spell resolves. Normal and Quick-Play Spells count as they leave the Spell/Trap Zone after resolving;
// Continuous, Equip and Field Spells, which stay, count as they are activated from the hand.
// PARTIAL: a Set Continuous, Equip or Field Spell flipped up to activate adds no counter (the engine has no event for that flip).
const spellCounter = max => ({ type: 'trig', on: (g, ev, c) => {
  if (ev.type !== 'move' || !isSpell(ev.c) || ctr(c, 'spell') >= max) return false;
  const stays = ['Continuous', 'Equip', 'Field'].includes(D(ev.c).sub);
  if ((!stays && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule') || (stays && ev.from === 'hand' && ev.reason === 'activate')) { addCtr(g, c, 'spell', 1); log(g, `${name(c)} got a Spell Counter (${ctr(c, 'spell')}).`); }
  return false; }, res: function* () {} });
// Chain Energy: the face-up copies on the field.
const chainEnergies = g => allField(g).filter(x => faceUp(x) && named(x, 'Chain Energy'));
// The names a player could declare: every card name in their own deck list (cards they own, wherever they are).
function ownNames(g, p) { const s = new Set(); for (const z of ['deck', 'hand', 'gy', 'ban', 'extra']) for (const x of g.p[p][z]) s.add(D(x).n); for (const x of allField(g)) if (x.owner === p) s.add(D(x).n); return [...s].sort(); }
const convulsion = g => allField(g).some(x => faceUp(x) && named(x, 'Convulsion of Nature'));
const lwFrom = c => isMon(c) && !isExtraD(D(c)) && !['ritual', 'token'].includes(D(c).k) && baseAtk(c) <= 1500 && !/Cannot be (Normal|Special) Summoned/i.test(tx(c));

E.addScripts({
  /* ----- Clown Control ----- */
  // 2005: "When this card is changed from Attack Position to face-up Defense Position, destroy 1 monster on your opponent's side
  // of the field." Mandatory. Seen for a manual change and for effect changes that announce it (Stumbling, Goblin Attack Force).
  // PARTIAL: position changes made by other cards' scripts (Desert Sunlight and the like) don't announce it, so they don't trigger it.
  'Dream Clown': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a monster',
    on: (g, ev, c) => ev.type === 'pos' && ev.c === c && c.pos === 'def',
    cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which of their monsters?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  'Protector of the Sanctuary': { cont: { forbid: (g, src, a) => a.type === 'draw' && a.p !== src.ctrl && g.phase !== 'draw' } },
  // PARTIAL: the coin is tossed at the start of the Damage Step (the engine has no trigger point right before damage calculation);
  // the result is the same: the other monster is destroyed before damage is calculated.
  'Sasuke Samurai #4': { effs: [{ type: 'trig', mand: true, faceDownOk: true, tags: { destroy: 1 }, label: 'Toss a coin',
    on: (g, ev, c) => ev.type === 'dsStart' && ev.t && (ev.a === c || ev.t === c),
    res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; if (!onField(c) || !o || !onField(o)) return;
      const right = coin(g); log(g, `${PN(g, p)} called the coin ${right ? 'right' : 'wrong'}.`); if (right) destroy(g, [o], { by: p }); } }] },
  // Continuous: no chain link. A monster that is Normal, Flip or Special Summoned in face-up Attack Position goes to Defense Position.
  'Stumbling': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'summon') for (const m of ev.cs) if (m.pos === 'atk') toDef(g, m); return false; }, res: function* () {} }] },

  /* ----- Heavy Slump ----- */
  // 2005: "As long as this card remains face-up on the field, all face-up WATER monsters on your side of the field gain 200 ATK.
  // When this card is flipped face-up, return 1 card on your opponent's side of the field to its owner's hand." Mandatory.
  'Nightmare Penguin': { cont: { atk: (g, src, m) => m.ctrl === src.ctrl && attr(m) === 'WATER' ? 200 : 0 },
    effs: [{ type: 'trig', mand: true, label: 'Return a card to the hand', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
      cond: (g, c, p) => fieldOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which of their cards to the hand?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) { const n = faceUp(t) ? name(t) : 'A face-down card'; move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${n} returned to the hand.`); } } }] },
  'Penguin Soldier': { effs: [{ type: 'trig', faceDownOk: true, label: 'Return up to 2 monsters', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: g => fieldMons(g).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return up to 2 monsters to the hand', fieldMons(g), 1, 2, 'bad'); },
    res: function* (g, c, p, L2) { for (const t of live(L2)) { const n = faceUp(t) ? name(t) : 'A face-down monster'; move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${n} returned to the hand.`); } } }] },
  // PARTIAL: the 500 is paid as each card leaves the hand (not as a cost before it), and actions are blocked while a player
  // couldn't pay (500 LP or less for each face-up Chain Energy).
  'Chain Energy': {
    cont: { forbid: (g, src, a) => {
      if (a.p == null || g.p[a.p].lp > 500 * chainEnergies(g).length) return false;
      if (a.type === 'ns' || a.type === 'set' || a.type === 'setST') return true;
      if (a.type === 'ss') return !!(a.c && a.c.zone === 'hand');
      if (a.type === 'activate') return a.c.zone === 'hand' && a.eff.type === 'act' && a.c !== src;
      return false; } },
    effs: [{ type: 'act', res: function* () {} },
      { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'move' && ev.c !== c && ev.from === 'hand' && ['m', 'st', 'fz'].includes(ev.to)) pay(g, ev.c.ctrl, 500); return false; }, res: function* () {} }] },
  'Heavy Slump': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length >= 8,
    res: function* (g, c, p) { const o = opp(p); const h = g.p[o].hand.slice(); if (h.length < 8) return; for (const x of h) move(g, x, 'deck', { reason: 'effect' }); shuffleDeck(g, o); log(g, `${PN(g, o)} shuffled ${h.length} cards into the Deck.`); draw(g, o, Math.min(2, g.p[o].deck.length)); } }] },

  /* ----- Stein Gate Turbo, Last Turn ----- */
  'Cannon Soldier': { effs: [{ type: 'ign', label: 'Tribute: 500 damage', cond: (g, c, p) => monsOf(g, p).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 monster', monsOf(g, p), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${x.pos === 'set' ? 'a face-down monster' : name(x)}.`); },
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  // tributes returns [0], not 0: the engine skips a bare 0 as no alternative.
  // The no-Tribute Summon or Set halves its original ATK (1400) and DEF (1000) while it stays on the field.
  // PARTIAL: if it is turned face-down (Book of Moon) it gets its full stats back when flipped, and under Skill Drain its ATK stays halved.
  'Fusilier Dragon, the Dual-Mode Beast': {
    self: { tributes: () => [0], def: (g, c) => c.flags.fusHalf ? -1000 : 0 },
    effs: [{ type: 'trig', faceDownOk: true, on: (g, ev, c) => {
      if (((ev.type === 'summon' && ev.cs.includes(c) && ev.how === 'normal') || (ev.type === 'set' && ev.c === c)) && !(c.tributes || []).length) { c.flags.baseAtk = 1400; c.flags.fusHalf = true; }
      return false; }, res: function* () {} }] },
  // 2005: "While your Life Points are lower than your opponent's, double the original ATK of the equipped monster.
  // While your Life Points are higher, halve the original ATK."
  'Megamorph': {
    cont: { atk: (g, src, m) => { if (src.equipTo !== m.u) return 0; const me = g.p[src.ctrl].lp, them = g.p[opp(src.ctrl)].lp; const b = baseAtk(m);
      return me < them ? b : me > them ? -Math.floor(b / 2) : 0; } },
    effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Megamorph to which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c)) equip(g, c, t); } }] },
  // PARTIAL: it can only be activated once a monster of yours has gone from the field to your GY this turn, and it summons right away;
  // activating it first and summoning later in the turn isn't done.
  'Last Will': { effs: [
    // watches from anywhere (hand, Deck, GY) so it knows what happened earlier in the turn
    { type: 'trig', loc: 'any', on: (g, ev, c) => { if (ev.type === 'move' && ev.wasField && ev.to === 'gy' && ev.snap && ev.snap.mon && ev.prevCtrl === ev.c.owner) (g.lastWill || (g.lastWill = {}))[ev.c.owner] = g.turnNo; return false; }, res: function* () {} },
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.lastWill && g.lastWill[p] === g.turnNo && freeM(g, p) >= 0 && g.p[p].deck.some(lwFrom),
      res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => lwFrom(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' }));
        if (cs.length && freeM(g, p) >= 0) { const [x] = yield* pick(g, p, 'Special Summon a monster with 1500 or less ATK from your Deck', cs, 1, 1, 'good');
          if (x) { const i = yield* choose(g, p, `${name(x)}: which position?`, ['Attack Position', 'Defense Position']); ss(g, p, x, i ? 'def' : 'atk'); } }
        shuffleDeck(g, p); } }] },

  /* ----- Library FTK ----- */
  'Royal Magical Library': { effs: [spellCounter(3),
    { type: 'ign', label: 'Remove 3 Spell Counters: draw 1', cond: (g, c, p) => ctr(c, 'spell') >= 3 && g.p[p].deck.length > 0,
      cost: function* (g, c) { addCtr(g, c, 'spell', -3); log(g, 'Royal Magical Library removed 3 Spell Counters.'); },
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  // You declare from the names in your own deck list. While Convulsion of Nature is face-up the top card is known, so its name is listed first.
  "Archfiend's Oath": { effs: [{ type: 'act', res: function* () {} },
    { type: 'ign', loc: 'st', opt: true, label: 'Pay 500: declare a card', cond: (g, c, p) => g.p[p].lp > 500 && g.p[p].deck.length > 0,
      cost: function* (g, c, p) { pay(g, p, 500); },
      target: function* (g, c, p, L2) { let ns = ownNames(g, p); const top = g.p[p].deck[g.p[p].deck.length - 1];
        if (top && convulsion(g)) ns = [D(top).n, ...ns.filter(n => n !== D(top).n)];
        const i = ns.length > 1 ? yield* choose(g, p, 'Declare a card name', ns) : 0; L2.data.n = ns[i]; log(g, `${PN(g, p)} declared ${ns[i]}.`); },
      res: function* (g, c, p, L2) { const top = g.p[p].deck[g.p[p].deck.length - 1]; if (!top) return; log(g, `${PN(g, p)} excavated ${name(top)}.`);
        if (D(top).n === L2.data.n && !forbid(g, { type: 'search', p })) { move(g, top, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(top)} to the hand.`); }
        else move(g, top, 'gy', { reason: 'effect' }); } }] },
  'Black Pendant': {
    cont: { atk: (g, src, m) => src.equipTo === m.u ? 500 : 0 },
    effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Black Pendant to which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && equip(g, c, t)) c.flags.pendant = true; } },
    // only once it was equipped (a Black Pendant whose activation failed isn't counted)
    { type: 'trig', loc: 'any', mand: true, label: '500 damage', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy' && ev.snap && ev.snap.flags && ev.snap.flags.pendant,
      res: function* (g, c, p, L2) { const q = L2.ev.prevCtrl != null ? L2.ev.prevCtrl : p; damage(g, opp(q), 500, { src: c, srcP: q }); } }] },
  // ENGINE: the Decks aren't turned face-up (the engine has no face-up Deck); the top cards are logged instead, and
  // Archfiend's Oath lists the known top card first.
  'Convulsion of Nature': { effs: [{ type: 'act',
    res: function* (g) { for (const q of [0, 1]) { const t = g.p[q].deck[g.p[q].deck.length - 1]; if (t) log(g, `${PN(g, q)}'s top card is ${name(t)}.`); } } }] },
  'Reversal Quiz': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length > 0,
    res: function* (g, c, p) {
      const cs = [...g.p[p].hand, ...fieldOf(g, p).filter(x => x !== c)]; for (const x of cs) if (x.zone === 'hand' || onField(x)) move(g, x, 'gy', { reason: 'effect', by: p });
      log(g, `${PN(g, p)} sent ${cs.length} card${cs.length === 1 ? '' : 's'} to the GY.`);
      const top = g.p[p].deck[g.p[p].deck.length - 1]; if (!top) return;
      const kinds = ['Monster', 'Spell', 'Trap']; const i = yield* choose(g, p, 'Call the type of the top card of your Deck', kinds);
      const real = isMon(top) ? 0 : isSpell(top) ? 1 : 2; log(g, `${PN(g, p)} called ${kinds[i]}. The top card is ${name(top)}.`);
      if (i === real) { const a = g.p[p].lp; g.p[p].lp = g.p[opp(p)].lp; g.p[opp(p)].lp = a; log(g, `The players swapped Life Points (${g.p[p].lp} and ${g.p[opp(p)].lp}).`); } } }] },

  /* ----- Monarch ----- */
  // PARTIAL: the damage comes at the start of the Damage Step (the engine has no trigger point right before damage calculation).
  'Reflect Bounder': { effs: [
    { type: 'trig', mand: true, label: 'Damage equal to the attacker’s ATK', on: (g, ev, c) => ev.type === 'dsStart' && ev.t === c && c.pos === 'atk' && ev.a.ctrl !== c.ctrl,
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (!onField(c) || !onField(a)) return; c.flags.reflect = g.turnNo; damage(g, opp(p), stat(g, a, 'atk'), { src: c, srcP: p }); } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy this card', on: (g, ev, c) => ev.type === 'afterCalc' && ev.t === c && c.flags.reflect === g.turnNo,
      res: function* (g, c) { if (onField(c)) destroy(g, [c], { by: c.ctrl }); } }] },
  'Cyber Saurus': {},
  'Labyrinth Tank': {},
  'Metal Dragon': {},

  /* ----- Earth Beat, Drain Beat ----- */
  // Changed to Defense Position at the end of the Battle Phase it attacked in (no chain), then locked until the End Phase of your next turn.
  'Goblin Attack Force': {
    cont: { forbid: (g, src, a) => a.type === 'pos' && a.c === src && src.flags.gafLock >= g.turnNo },
    effs: [{ type: 'trig', on: (g, ev, c) => {
      if (ev.type === 'attack' && ev.a === c) c.flags.gafAtk = g.turnNo;
      if (ev.type === 'phase' && ev.ph === 'bpEnd' && c.flags.gafAtk === g.turnNo) { toDef(g, c); c.flags.gafLock = g.turnNo + 2; }
      return false; }, res: function* () {} }] },
  // Losing half is not damage (Des Wombat doesn't stop it); the loss rounds down.
  'Jirai Gumo': { effs: [{ type: 'trig', mand: true, label: 'Toss a coin', on: (g, ev, c) => ev.type === 'attack' && ev.a === c,
    res: function* (g, c, p) { if (coin(g)) { log(g, `${PN(g, p)} called the coin right.`); return; }
      const n = Math.floor(g.p[p].lp / 2); g.p[p].lp -= n; log(g, `${PN(g, p)} called the coin wrong and lost ${n} LP.`); } }] },
  // PARTIAL: once properly summoned it can still not be revived from the GY (one "can't be Special Summoned" rule, build/ENGINE_TODO.md).
  'Gigantes': {
    proc: { label: 'Special Summon (banish an EARTH monster)', cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'EARTH'),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish an EARTH monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'EARTH'), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${name(x)}.`); } } },
    cont: { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src },
    effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy all Spells and Traps', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
      res: function* (g, c, p) { destroy(g, allField(g).filter(x => x.zone !== 'm' && isST(x)), { by: p }); } }] },
  'Charubin the Fire Knight': {},
  // 2005: "This card can be Special Summoned from your hand. If it is, your opponent can Special Summon 1 monster from their GY."
  'Gilasaurus': {
    proc: { label: 'Special Summon from the hand', cond: () => true, cost: function* (g, c) { c.flags.gila = true; } },
    effs: [{ type: 'trig', mand: true, tags: { ss: 1 }, label: 'Opponent may revive a monster', on: (g, ev, c) => evSummoned(ev, c, ['special']) && c.flags.gila,
      res: function* (g, c, p) { const o = opp(p); const ms = g.p[o].gy.filter(x => isMon(x) && !forbid(g, { type: 'ss', c: x, p: o, how: 'special' })); if (!ms.length || freeM(g, o) < 0) return;
        const [x] = yield* pick(g, o, 'Special Summon a monster from your GY? (none is fine)', ms, 0, 1, 'good');
        if (x) { const i = yield* choose(g, o, `${name(x)}: which position?`, ['Attack Position', 'Defense Position']); ss(g, o, x, i ? 'def' : 'atk'); } } }] },

  /* ----- Stein Horus ----- */
  'Granmarg the Rock Monarch': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a face-down card', on: (g, ev, c) => evSummoned(ev, c, ['tribute']),
    cond: g => allField(g).some(x => x.pos === 'set'),
    target: function* (g, c, p, L2) { const cs = allField(g).filter(x => x.pos === 'set'); const mine = cs.filter(x => x.ctrl === p), theirs = cs.filter(x => x.ctrl !== p);
      yield* tgt(g, p, L2, 'Destroy which face-down card?', theirs.length ? [...theirs, ...mine] : mine, 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2).filter(x => x.pos === 'set'), { by: p }); } }] },
  'Horus the Black Flame Dragon LV6': { self: { unaffectedSpells: true },
    effs: [
      { type: 'trig', on: (g, ev, c) => { if (battleKill(ev, c)) c.flags.horusKill = g.turnNo; return false; }, res: function* () {} },
      { type: 'trig', tags: { ss: 1 }, label: 'Send it: summon LV8', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.horusKill === g.turnNo,
        cond: (g, c, p) => [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Horus the Black Flame Dragon LV8')),
        cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Horus the Black Flame Dragon LV6 to the GY.`); },
        res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Horus the Black Flame Dragon LV8')); if (!cs.length || freeM(g, p) < 0) return;
          const [x] = yield* pick(g, p, 'Special Summon Horus the Black Flame Dragon LV8', cs, 1, 1, 'good'); if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x); if (fromDeck) shuffleDeck(g, p); } } }] },
  // PARTIAL: it can't be revived from the GY; other ways from the hand or Deck aren't blocked (one "can't be Special Summoned" rule, build/ENGINE_TODO.md).
  'Horus the Black Flame Dragon LV8': { cont: { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src },
    effs: [{ type: 'quick', ds: true, needsSelf: true, label: 'Negate a Spell', cond: (g, c, p, x) => { const t = x && x.top; return !!(t && spellTrapAct(t) && isSpell(t.c) && !t.negated); },
      target: function* (g, c, p, L2) { L2.data.tl = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { const t = L2.data.tl; if (!onField(c) || !faceUp(c) || !t || t.negated) return; t.negBy = p; L.negate(g, t, true); } }] },

  /* ----- burn and beat cards ----- */
  'Amazoness Archer': { effs: [{ type: 'ign', label: 'Tribute 2: 1200 damage', cond: (g, c, p) => monsOf(g, p).length >= 2,
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Tribute 2 monsters', monsOf(g, p), 2, 2, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed 2 monsters.`); },
    res: function* (g, c, p) { damage(g, opp(p), 1200, { src: c, srcP: p }); } }] },
  'Des Wombat': { cont: { dmg: (g, src, p, n, o) => p === src.ctrl && !(o && o.battle) ? 0 : n } },
  'Milus Radiant': { cont: { atk: (g, src, m) => faceUp(m) ? (attr(m) === 'EARTH' ? 500 : attr(m) === 'WIND' ? -400 : 0) : 0 } },
  'The Big March of Animals': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Beast'),
    res: function* (g, c, p) { const bs = monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Beast'); const n = 200 * bs.length;
      for (const x of bs) addMod(g, x, { atk: n, end: true }); log(g, `${PN(g, p)}'s Beasts gained ${n} ATK.`); } }] },
  // 2005: "When this card is Normal, Flip or Special Summoned successfully, return all face-down cards on the field to their owners' hands."
  'Byser Shock': { effs: [{ type: 'trig', mand: true, label: 'Return all Set cards', on: (g, ev, c) => evSummoned(ev, c),
    cond: g => allField(g).some(x => x.pos === 'set'),
    res: function* (g) { const cs = allField(g).filter(x => x.pos === 'set'); for (const x of cs) move(g, x, 'hand', { reason: 'effect' }); if (cs.length) log(g, `${cs.length} Set card${cs.length > 1 ? 's' : ''} returned to the hand.`); } }] },
  'Gear Golem the Moving Fortress': { self: { directAttack: (g, c) => c.flags.gearDirect === g.turnNo },
    effs: [{ type: 'ign', opt: true, label: 'Pay 800: attack directly', cond: (g, c, p) => g.phase === 'main1' && g.p[p].lp > 800,
      cost: function* (g, c, p) { pay(g, p, 800); },
      res: function* (g, c) { if (onField(c)) { c.flags.gearDirect = g.turnNo; log(g, `${name(c)} can attack directly this turn.`); } } }] },
  'Emergency Provisions': { effs: [{ type: 'act', cond: (g, c, p) => stOf(g, p).some(x => x !== c),
    cost: function* (g, c, p, L2) { const xs = yield* pick(g, p, 'Send which of your other Spells and Traps to the GY?', stOf(g, p).filter(x => x !== c), 1, 5, 'cost');
      for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p }); L2.data.n = xs.length; log(g, `${PN(g, p)} sent ${xs.length} card${xs.length > 1 ? 's' : ''} to the GY.`); },
    res: function* (g, c, p, L2) { gain(g, p, 1000 * L2.data.n); } }] },
}, 'goat');
})();
