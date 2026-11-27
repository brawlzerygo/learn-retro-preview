/* Full pool batch 20: Change of Heart to Dreamsprite (build/batches/full/full-20.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text; cards with a
 Goat-only script elsewhere (Change of Heart, Charubin the Fire Knight, Chiron the Mage, Chorus of Sanctuary, Chosen One,
 Cockroach Knight, Collected Power, Convulsion of Nature, Crass Clown, Cursed Seal of the Forbidden Spell, Delinquent Duo,
 Despair from the Dark, Don Zaloog, Dream Clown) are ported here as the shared version. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, setFaceDown, negate, addMod,
  equip, negateAttack, addRule, tokens, ritualSummon, canRitual, dice, emit, num,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, monsOf, stOf, allField, fieldMons,
  freeM, freeST, nFreeM, shuffleDeck, log, PN, live, opp, oppFaceUp, stOnField, evSummoned, isExtraD } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = { type: 'act', res: function* () {} };
const txt = c => { const d = D(c); return d.ps && !/^No (?:Edison|rulings)/.test(d.ps) ? d.ps : d.tx || ''; };
const isArchfiend = c => isMon(c) && /Archfiend/.test(name(c));
const discardRandom = (g, p, by) => { const h = g.p[p].hand; if (!h.length) return null; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard', by }); log(g, `${PN(g, p)} discarded ${name(x)} at random.`); return x; };
function* discardPick(g, p, n, text, not, by) { const h = g.p[p].hand.filter(x => x !== not); if (!h.length) return []; const k = Math.min(n, h.length); const xs = yield* pick(g, p, text, h, k, k, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'discard', by }); if (xs.length) log(g, `${PN(g, p)} discarded ${xs.map(name).join(', ')}.`); return xs; }
function* discardOne(g, p, filter, text) { const [x] = yield* pick(g, p, text, g.p[p].hand.filter(filter), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } return x; }
// a monster that can be Special Summoned from the hand by any effect (not a Ritual or summon-only monster)
const ssAble = x => isMon(x) && !isExtraD(D(x)) && D(x).k !== 'ritual' && !/Cannot be (?:Normal|Special) Summoned|can(?:not| not|'t) be Special Summoned|must (?:first )?be Special Summoned|can only be (?:Special|Ritual) Summoned/i.test(txt(x));
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) equip(g, c, t); } });
// "this turn" direct attacks, "during the Damage Step only" boosts and Cost Down's Levels end here. A trig that never
// starts a chain, watching every event from any zone (each card that uses these carries it; running it twice is harmless).
const turnDirect = (g, m) => { m.flags.directAttack = true; m.flags.f20dirT = g.turnNo; g.seq++; };
const clearCD = c => { delete c.flags.lv; delete c.flags.lvUntil; delete c.flags.f20cdT; delete c.flags.f20cdN; delete c.flags.f20cdBase; };
const cleanup = { type: 'trig', loc: 'any', res: function* () {}, on: (g, ev) => {
  if (ev.type === 'phase' && ev.ph === 'end') {
    for (const m of fieldMons(g)) if (m.flags.f20dirT) { delete m.flags.directAttack; delete m.flags.f20dirT; g.seq++; }
    for (const P of g.p) for (const z of ['hand', 'gy', 'ban', 'deck', 'm']) for (const x of P[z]) if (x && x.flags.f20cdT) clearCD(x);
    for (const m of fieldMons(g)) if (m.mods.some(x => x.f20gus != null && x.f20gus <= g.turnNo)) { m.mods = m.mods.filter(x => !(x.f20gus != null && x.f20gus <= g.turnNo)); g.seq++; }
  }
  if (ev.type === 'dsEnd') for (const m of fieldMons(g)) if (m.mods.some(x => x.f20ds)) { m.mods = m.mods.filter(x => !x.f20ds); g.seq++; }
  if (ev.type === 'move' && ev.from === 'hand' && ev.to !== 'm' && ev.c.flags.f20cdT) clearCD(ev.c);
  return false; } };
// The attacked monster battles another monster here (an attack redirect).
// PARTIAL: the engine's attack() keeps its target local (build/ENGINE_TODO.md), so this damage calculation is done in the card.
function miniBattle(g, a, t) {
  if (t.pos === 'set') { t.pos = 'def'; g.seq++; log(g, `The face-down monster was ${name(t)}.`); emit(g, { type: 'flip', c: t, p: t.ctrl, battle: true }); }
  const A = atk(g, a), owner = a.ctrl;
  log(g, `${name(a)} battles ${name(t)} instead.`);
  if (t.pos === 'atk') {
    const T = atk(g, t);
    if (A > T) { damage(g, t.ctrl, A - T, { battle: true, src: a, srcP: owner }); destroy(g, [t], { battle: true, killer: a }); }
    else if (A < T) { damage(g, owner, T - A, { battle: true, src: t, srcP: t.ctrl }); destroy(g, [a], { battle: true, killer: t }); }
    else if (A > 0) destroy(g, [a, t], { battle: true });
  } else {
    const Dv = def(g, t);
    if (A > Dv) destroy(g, [t], { battle: true, killer: a });
    else if (A < Dv) damage(g, owner, Dv - A, { battle: true, src: t, srcP: t.ctrl });
  }
}
// Archfiend dice: "when it is targeted by the effect of a card your opponent controls, when resolving, roll a die".
// ENGINE: no "as a targeting effect resolves" hook, so the roll is an optional Spell Speed 3 response to the targeting link.
const archDice = (who, hits, label) => ({ type: 'quick', speed: 3, ds: true, label,
  cond: (g, c, p, x) => { const T = x.top; return !!T && !T.negated && T.p !== p && !(T.f20dice || []).includes(c.u) && T.t.some(m => onField(m) && m.zone === 'm' && faceUp(m) && m.ctrl === p && who(g, c, m)); },
  target: function* (g, c, p, L2) { const T = g.chain[g.chain.length - 1]; (T.f20dice || (T.f20dice = [])).push(c.u); L2.data.L = T; },
  res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated) return; const n = dice(g, p); if (hits.includes(n)) { T.negBy = p; negate(g, T, true); } else log(g, 'Nothing happened.'); } });
const archCost = { type: 'trig', mand: true, label: 'Pay 500 LP', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
  // PARTIAL: with 500 LP or less the card is destroyed instead of paying (the text gives no rule for it).
  res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 500) pay(g, p, 500); else destroy(g, [c], { by: p }); } };
// Cobra Jar's token remembers its Jar (the token is gone once it leaves the field)
const cobraOf = (ev, c) => ev.type === 'move' && ev.snap && ev.snap.flags && ev.snap.flags.f20jar === c.u && ev.battle && ev.destroyed;

E.addScripts({
  'Change of Heart': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, opp(p)).length > 0 && freeM(g, p) >= 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone === 'm' && t.ctrl !== p) takeControl(g, p, t, true); } }] },
  'Chaosrider Gustaph': { effs: [cleanup, { type: 'ign', opt: true, label: 'Banish Spells for ATK',
    cond: (g, c, p) => g.p[p].gy.some(isSpell),
    cost: function* (g, c, p, L2) { const xs = yield* pick(g, p, 'Banish up to 2 Spell Cards from your GY', g.p[p].gy.filter(isSpell), 1, 2, 'cost');
      for (const x of xs) move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${xs.map(name).join(' and ')}.`); L2.data.n = xs.length; },
    res: function* (g, c, p, L2) { if (!onField(c) || !faceUp(c) || !L2.data.n) return; const n = 300 * L2.data.n;
      addMod(g, c, { atk: n, f20gus: g.turnNo + 1 }); log(g, `${name(c)} gained ${n} ATK until the end of the next turn.`); } }] },
  // Until the End Phase, read from the Charm in the GY. PARTIAL: it ends early if the Charm leaves the GY.
  'Charm of Shabti': {
    cont: { loc: 'gy', grant: (g, src, c, flag) => flag === 'noBattleDestroy' && !!g.f20shabti && g.f20shabti[c.ctrl] === g.turnNo && onField(c) && /^Gravekeeper's/.test(name(c)) },
    effs: [{ type: 'quick', loc: 'hand', ds: true, label: 'Discard: Gravekeepers survive battle',
      cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && /^Gravekeeper's/.test(name(m))),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded Charm of Shabti.`); },
      res: function* (g, c, p) { (g.f20shabti || (g.f20shabti = {}))[p] = g.turnNo; g.seq++; log(g, `${PN(g, p)}'s Gravekeeper's monsters can't be destroyed by battle this turn.`); } }] },
  'Charubin the Fire Knight': { effs: [] },
  'Checkmate': { effs: [cleanup, { type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => isArchfiend(x) && monsOf(g, p).some(t => t !== x && faceUp(t) && named(t, 'Terrorking Archfiend'))),
    cost: function* (g, c, p) { const ms = monsOf(g, p); const [x] = yield* pick(g, p, 'Tribute 1 Archfiend monster', ms.filter(x => isArchfiend(x) && ms.some(t => t !== x && faceUp(t) && named(t, 'Terrorking Archfiend'))), 1, 1, 'cost');
      if (x) { const n = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${n}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Terrorking Archfiend can attack directly?', monsOf(g, p).filter(t => faceUp(t) && named(t, 'Terrorking Archfiend')), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { turnDirect(g, t); log(g, `${name(t)} can attack directly this turn.`); } } }] },
  'Chiron the Mage': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Discard a Spell: destroy a Spell/Trap',
    cond: (g, c, p) => g.p[p].hand.some(isSpell) && stOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { yield* discardOne(g, p, isSpell, 'Discard 1 Spell Card'); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  // PARTIAL: Equip Spells with their own "equip only to" rule are left out of the choice.
  'Chopman the Desperate Outlaw': (() => { const ok = x => isSpell(x) && D(x).sub === 'Equip' && !/equip only|only equip|can only be equipped/i.test(txt(x));
    return { effs: [{ type: 'trig', when: true, label: 'Equip an Equip Spell from your GY', on: (g, ev, c) => evSummoned(ev, c, ['flip']),
      cond: (g, c, p) => freeST(g, p) >= 0 && g.p[p].gy.some(ok),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip which Equip Spell to this card?', g.p[p].gy.filter(ok), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const x = L2.t[0]; if (!x || x.zone !== 'gy' || !onField(c) || !faceUp(c) || freeST(g, p) < 0) return;
        move(g, x, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); equip(g, x, c); } }] }; })(),
  'Chorus of Sanctuary': { cont: { def: (g, src, m) => m.pos === 'def' ? 500 : 0 }, effs: [noop] },
  'Chosen One': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => x !== c && ssAble(x)) && g.p[p].hand.filter(x => x !== c && !isMon(x)).length >= 2,
    res: function* (g, c, p) { const h = g.p[p].hand;
      const [m] = yield* pick(g, p, 'Choose 1 Monster Card', h.filter(ssAble), 1, 1, 'good');
      const ns = yield* pick(g, p, 'Choose 2 non-Monster Cards', h.filter(x => !isMon(x)), 2, 2, 'cost');
      const set = [m, ...ns].filter(Boolean); if (set.length < 3) return;
      log(g, `${PN(g, p)} chose ${set.map(name).join(', ')}.`);
      const x = set[Math.floor(g.rnd() * set.length)]; log(g, `${PN(g, opp(p))} picked ${name(x)} at random.`);
      if (isMon(x)) ss(g, p, x);
      for (const y of set) if (y !== x || !isMon(x)) if (y.zone === 'hand') move(g, y, 'gy', { reason: 'effect' });
      log(g, isMon(x) ? 'The other 2 cards were sent to the GY.' : 'All 3 cards were sent to the GY.'); } }] },
  'Coach Goblin': { effs: [{ type: 'trig', opt: true, label: 'Return a Normal Monster: draw 1',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
    cond: (g, c, p) => g.p[p].hand.some(x => D(x).k === 'normal') && g.p[p].deck.length > 0,
    res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; const [x] = yield* pick(g, p, 'Return which Normal Monster to the bottom of your Deck?', g.p[p].hand.filter(x => D(x).k === 'normal'), 1, 1, 'cost'); if (!x) return;
      log(g, `${PN(g, p)} revealed ${name(x)} and put it on the bottom of the Deck.`); move(g, x, 'deckTop', { reason: 'effect' }); const d = g.p[p].deck; d.splice(d.indexOf(x), 1); d.unshift(x); draw(g, p, 1); } }] },
  'Cobra Jar': { effs: [
    { type: 'trig', mand: true, faceDownOk: true, tags: { ss: 1 }, label: 'Summon a Poisonous Snake Token', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
      cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { if (freeM(g, p) < 0) return; const i = yield* choose(g, p, 'Poisonous Snake Token: which position?', ['Attack Position', 'Defense Position']);
        const [t] = tokens(g, p, { n: 'Poisonous Snake Token', a: 'EARTH', r: 'Reptile', lv: 3, atk: 1200, def: 1200 }, 1, i ? 'def' : 'atk'); if (t) { t.flags.f20jar = c.u; t.flags.f20jarP = p; } } },
    { type: 'trig', loc: 'any', mand: true, label: '500 damage', on: (g, ev, c) => cobraOf(ev, c),
      res: function* (g, c, p, L2) { const q = L2.ev.snap.flags.f20jarP; damage(g, opp(q), 500, { src: c, srcP: q }); } }] },
  'Cobraman Sakuzy': { effs: [
    { type: 'ign', opt: true, label: 'Flip this card face-down', cond: (g, c) => faceUp(c) && c.turnIn !== g.turnNo && !c.posChanged,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { setFaceDown(g, c); c.posChanged = true; } } },
    { type: 'trig', mand: true, faceDownOk: true, label: 'Look at their Set Spells and Traps', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
      cond: (g, c, p) => stOf(g, opp(p)).some(x => x.pos === 'set'),
      res: function* (g, c, p) { const xs = stOf(g, opp(p)).filter(x => x.pos === 'set'); log(g, xs.length ? `${PN(g, p)} looked at ${PN(g, opp(p))}'s Set cards: ${xs.map(x => D(x).n).join(', ')}.` : 'There were no Set cards.'); } }] },
  'Cockroach Knight': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Return to the top of the Deck', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy',
    res: function* (g, c) { if (c.zone === 'gy') { move(g, c, 'deckTop', { reason: 'effect' }); log(g, 'Cockroach Knight returned to the top of the Deck.'); } } }] },
  // Once per event group: monsters sent at the same time count as 1 time.
  'Coffin Seller': { effs: [noop, { type: 'trig', loc: 'st', mand: true, label: '300 damage',
    on: (g, ev, c) => { if (ev.type !== 'move' || ev.to !== 'gy' || !isMon(ev.c) || ev.c.owner === c.ctrl || c.flags.f20cofG === ev.group) return false; c.flags.f20cofG = ev.group; return true; },
    res: function* (g, c, p) { damage(g, opp(p), 300, { src: c, srcP: p }); } }] },
  // PARTIAL: an Equip Card that becomes equipped to an incorrect monster is only destroyed when it is a Monster Card (Unions and the like).
  'Collected Power': { effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp) && allField(g).some(x => x.zone === 'st' && x.equipTo),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip all Equip Cards to which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const eqs = allField(g).filter(x => x.zone === 'st' && x.equipTo && x.equipTo !== t.u);
      const bad = []; for (const x of eqs) { const from = fieldMons(g).find(m => m.u === x.equipTo); x.equipTo = t.u; if (isMon(x) && !(from && D(from).n === D(t).n)) bad.push(x); }
      g.seq++; if (eqs.length) log(g, `${eqs.map(name).join(', ')} ${eqs.length > 1 ? 'were' : 'was'} equipped to ${name(t)}.`);
      if (bad.length) destroy(g, bad, { by: p, src: c }); } }] },
  'Combination Attack': (() => {
    const unionOn = (g, m) => stOnField(g).find(x => isMon(x) && x.equipTo === m.u) || null;
    return { effs: [{ type: 'act', cond: (g, c, p) => g.phase === 'battle' && fieldMons(g).some(m => faceUp(m) && m.attacks > 0 && unionOn(g, m) && freeM(g, unionOn(g, m).ctrl) >= 0),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster that attacked separates its Union?', fieldMons(g).filter(m => faceUp(m) && m.attacks > 0 && unionOn(g, m) && freeM(g, unionOn(g, m).ctrl) >= 0), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const m = live(L2)[0]; if (!m || !faceUp(m)) return; const u = unionOn(g, m); if (!u || freeM(g, u.ctrl) < 0) return;
        const q = u.ctrl, i = yield* choose(g, q, `${name(u)}: which position?`, ['Attack Position', 'Defense Position']); u.equipTo = null;
        if (ss(g, q, u, i ? 'def' : 'atk')) { m.flags.extraAttack = g.turnNo; g.seq++; log(g, `${name(m)} can attack again this turn.`); } } }] }; })(),
  'Commencement Dance': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && canRitual(g, p, { monster: x => named(x, 'Performance of Sword') }),
    res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, 'Performance of Sword') }); } }] },
  'Confiscation': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp > 1000 && g.p[opp(p)].hand.length > 0,
    cost: function* (g, c, p) { pay(g, p, 1000); },
    res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; log(g, `${PN(g, p)} looked at ${PN(g, opp(p))}'s hand: ${h.map(x => D(x).n).join(', ')}.`);
      const [x] = yield* pick(g, p, 'Discard which card from their hand?', h, 1, 1, 'bad'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, opp(p))} discarded ${name(x)}.`); } } }] },
  // PARTIAL: destroying the attacker uses a chain link right after damage calculation (it is a Continuous Effect).
  'Continuous Destruction Punch': { effs: [noop, { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy the attacker',
    on: (g, ev, c) => ev.type === 'afterCalc' && ev.t && ev.t.ctrl === c.ctrl && ev.tWasDef && ev.a && ev.a.ctrl !== c.ctrl && onField(ev.a) && def(g, ev.t) > atk(g, ev.a),
    res: function* (g, c, p, L2) { const a = L2.ev.a; if (onField(a) && onField(c) && faceUp(c)) destroy(g, [a], { by: p, src: c }); } }] },
  // ENGINE: no face-up Deck; the top cards are shown in the log instead.
  'Convulsion of Nature': { effs: [{ type: 'act',
    res: function* (g) { for (const q of [0, 1]) { const t = g.p[q].deck[g.p[q].deck.length - 1]; if (t) log(g, `${PN(g, q)}'s top card is ${name(t)}.`); } } }] },
  // Levels are lowered on the cards themselves (kept when they are Summoned this turn), and reset in the End Phase.
  'Cost Down': { effs: [cleanup, { type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c),
    cost: function* (g, c, p) { yield* discardPick(g, p, 1, 'Discard 1 card', c); },
    res: function* (g, c, p) { const ms = g.p[p].hand.filter(isMon); for (const x of ms) {
        if (x.flags.f20cdT !== g.turnNo) { clearCD(x); x.flags.f20cdBase = lv(x); x.flags.f20cdN = 0; }
        x.flags.f20cdN++; x.flags.f20cdT = g.turnNo; x.flags.lv = Math.max(1, x.flags.f20cdBase - 2 * x.flags.f20cdN); x.flags.lvUntil = true; }
      g.seq++; log(g, `The Levels of the monsters in ${PN(g, p)}'s hand were reduced by 2 this turn.`); } }] },
  'Covering Fire': { effs: [cleanup, { type: 'act', ds: true,
    cond: (g, c, p) => !!(g.inDS && g.battle && g.battle.t && g.battle.t.ctrl === p && g.battle.a.ctrl !== p && faceUp(g.battle.t) && monsOf(g, p).some(m => m !== g.battle.t && faceUp(m))),
    target: function* (g, c, p, L2) { L2.data.m = g.battle.t; yield* tgt(g, p, L2, 'Which monster lends its ATK?', monsOf(g, p).filter(m => m !== g.battle.t && faceUp(m)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0], m = L2.data.m; if (!t || !faceUp(t) || !onField(m) || !faceUp(m) || !g.inDS) return; const n = atk(g, t);
      addMod(g, m, { atk: n, end: true, f20ds: true }); log(g, `${name(m)} gained ${n} ATK during this Damage Step.`); } }] },
  'Crab Turtle': { effs: [] },
  'Crass Clown': { effs: [{ type: 'trig', mand: true, label: 'Return a monster to the hand',
    on: (g, ev, c) => ev.type === 'pos' && ev.c === c && c.pos === 'atk',
    cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { const ms = monsOf(g, opp(p)); if (!ms.length) return; const [x] = yield* pick(g, p, 'Return which of their monsters to the hand?', ms, 1, 1, 'bad');
      if (x) { const n = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'hand', { reason: 'effect', by: p }); log(g, `${n} returned to the hand.`); } } }] },
  // A Continuous Effect: while its Normal Summon is being answered, no Trap can be activated (by either player).
  'Creeping Doom Manta': { effs: [{ type: 'trig', res: function* () {}, on: (g, ev, c) => {
    if (evSummoned(ev, c, ['normal', 'tribute'])) { const u = c.u; addRule(g, (g2, a) => a.type === 'activate' && a.eff && a.eff.type === 'act' && isTrap(a.c) && !!g2.sw && g2.sw.cs.some(x => x.u === u), { end: g.turnNo }); }
    return false; } }] },
  'Criosphinx': { effs: [{ type: 'trig', mand: true, label: 'The owner sends a card from the hand to the GY',
    on: (g, ev, c) => { if (ev.type !== 'move' || !ev.wasField || ev.to !== 'hand' || !ev.snap || !ev.snap.mon || ev.c === c || c.flags.f20crG === ev.group) return false; c.flags.f20crG = ev.group; return true; },
    res: function* (g, c, p, L2) { const grp = L2.ev.group; const owners = [...new Set(g.events.filter(e => e.type === 'move' && e.group === grp && e.wasField && e.to === 'hand' && e.snap && e.snap.mon).map(e => e.c.owner))];
      for (const q of owners) { const h = g.p[q].hand; if (!h.length) continue; const [x] = yield* pick(g, q, 'Send 1 card from your hand to the GY', h, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${PN(g, q)} sent ${name(x)} to the GY.`); } } } }] },
  // The doubling is read from this card in the GY for this one battle. PARTIAL: destroying the attacker uses a chain link.
  'Cross Counter': { cont: { loc: 'gy', dmg: (g, src, p, n, o) => o.battle && g.f20cc && g.f20cc.u === src.u && p !== g.f20cc.p && g.battle && g.battle.a && g.battle.a.u === g.f20cc.a ? n * 2 : undefined },
    effs: [{ type: 'act', ds: true,
      cond: (g, c, p) => !!(g.inDS && g.battle && g.battle.t && g.battle.t.ctrl === p && g.battle.a.ctrl !== p && g.battle.t.pos === 'def' && def(g, g.battle.t) > atk(g, g.battle.a)),
      target: function* (g, c, p, L2) { L2.data.a = g.battle.a; },
      res: function* (g, c, p, L2) { const a = L2.data.a; if (!onField(a) || !g.battle || g.battle.a !== a) return; g.f20cc = { u: c.u, a: a.u, p }; g.seq++; log(g, `The battle damage to ${PN(g, a.ctrl)} is doubled, and ${name(a)} will be destroyed.`); } },
    { type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy the attacker',
      on: (g, ev, c) => { if (ev.type === 'dsEnd' && g.f20cc && g.f20cc.u === c.u) { g.f20cc = null; g.seq++; } return ev.type === 'afterCalc' && !!g.f20cc && g.f20cc.u === c.u && ev.a && ev.a.u === g.f20cc.a; },
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (onField(a)) destroy(g, [a], { by: g.f20cc ? g.f20cc.p : p, src: c }); } }] },
  'Cure Mermaid': { effs: [{ type: 'trig', mand: true, label: 'Gain 800 LP', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    res: function* (g, c, p) { if (onField(c) && faceUp(c)) gain(g, p, 800); } }] },
  'Cursed Seal of the Forbidden Spell': { effs: [{ type: 'act',
    cond: (g, c, p, x) => { const t = x.top; return !!(t && t.cardAct && isSpell(t.c) && !t.negated) && g.p[p].hand.some(isSpell); },
    cost: function* (g, c, p) { yield* discardOne(g, p, isSpell, 'Discard 1 Spell Card'); },
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated) return; const nm = D(T.c).n, o = opp(p);
      T.negBy = p; negate(g, T, true);
      addRule(g, (g2, a) => a.type === 'activate' && a.p === o && a.eff && a.eff.type === 'act' && isSpell(a.c) && D(a.c).n === nm);
      log(g, `${PN(g, o)} can't activate ${nm} for the rest of the Duel.`); } }] },
  'Cyclon Laser': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 300 : 0, grant: (g, src, m, flag) => flag === 'piercing' && src.equipTo === m.u },
    effs: [equipAct(m => named(m, 'Gradius'), 'Equip to which Gradius?')] },
  // ENGINE: Type changes (race() reads the card data only), so this card has no effect yet.
  'D. Tribe': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(faceUp),
    res: function* (g, c, p) { log(g, `${PN(g, p)}'s monsters are treated as Dragons this turn (not applied by the engine yet).`); } }] },
  'Dancing Fairy': { effs: [{ type: 'trig', mand: true, label: 'Gain 1000 LP', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.pos === 'def',
    res: function* (g, c, p) { if (onField(c) && c.pos === 'def') gain(g, p, 1000); } }] },
  'Darkbishop Archfiend': { effs: [archCost, archDice((g, c, m) => isArchfiend(m), [1, 3, 6], 'Roll a die (1, 3 or 6 negates)')] },
  'Darklord Marie': { effs: [{ type: 'trig', loc: 'gy', opt: true, mand: true, label: 'Gain 200 LP', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner,
    res: function* (g, c, p) { if (c.zone === 'gy') gain(g, p, 200); } }] },
  'Deal of Phantom': { effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { L2.data.n = 100 * g.p[p].gy.filter(isMon).length; yield* tgt(g, p, L2, 'Which face-up monster gains ATK?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !L2.data.n) return; addMod(g, t, { atk: L2.data.n, end: true }); log(g, `${name(t)} gained ${L2.data.n} ATK.`); } }] },
  'Decayed Commander': { effs: [
    { type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon Zombie Tiger', on: (g, ev, c) => evSummoned(ev, c, ['normal']),
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => named(x, 'Zombie Tiger')),
      res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => named(x, 'Zombie Tiger')); if (!cs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon which Zombie Tiger?', cs, 1, 1, 'good'); if (x) ss(g, p, x); } },
    { type: 'trig', mand: true, label: 'Discard a random card', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.direct && ev.src === c && ev.p !== c.ctrl,
      res: function* (g, c, p) { discardRandom(g, opp(p), p); } }] },
  'Dedication through Light and Darkness': (() => { const dmoc = (g, p) => [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].filter(x => named(x, 'Dark Magician of Chaos'));
    return { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => monsOf(g, p).some(x => named(x, 'Dark Magician')) && dmoc(g, p).length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 Dark Magician', monsOf(g, p).filter(x => named(x, 'Dark Magician')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Dark Magician.`); } },
      res: function* (g, c, p) { const cs = dmoc(g, p); if (!cs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon which Dark Magician of Chaos?', cs, 1, 1, 'good'); if (!x) return;
        const fromDeck = x.zone === 'deck'; ss(g, p, x); if (fromDeck) shuffleDeck(g, p); } }] }; })(),
  'Delinquent Duo': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp > 1000 && g.p[opp(p)].hand.length > 0,
    cost: function* (g, c, p) { pay(g, p, 1000); },
    res: function* (g, c, p) { const o = opp(p); discardRandom(g, o, p); if (g.p[o].hand.length) yield* discardPick(g, o, 1, 'Discard 1 card of your choice', null, p); } }] },
  'Delta Attacker': (() => { const trio = (g, p) => { const by = {}; for (const m of monsOf(g, p)) if (faceUp(m) && D(m).k === 'normal') (by[D(m).n] || (by[D(m).n] = [])).push(m); return Object.values(by).find(a => a.length >= 3) || null; };
    return { effs: [cleanup, { type: 'act', cond: (g, c, p) => !!trio(g, p),
      res: function* (g, c, p) { const t = trio(g, p); if (!t) return; const ms = t.slice(0, 3); for (const m of ms) turnDirect(g, m); log(g, `${ms.map(name).join(', ')} can attack directly this turn.`); } }] }; })(),
  // Levels are kept on the monster (the engine's lv() has no hook for ongoing changes); restored when Demotion leaves.
  'Demotion': { effs: [
    { ...equipAct(), res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c) || !equip(g, c, t)) return;
      if (!t.flags.f20demN) t.flags.f20demBase = lv(t); t.flags.f20demN = (t.flags.f20demN || 0) + 1; t.flags.lv = Math.max(1, t.flags.f20demBase - 2 * t.flags.f20demN); c.flags.f20demTo = t.u; g.seq++; log(g, `${name(t)} is now Level ${lv(t)}.`); } },
    { type: 'trig', loc: 'any', res: function* () {}, on: (g, ev, c) => {
      if (ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.flags.f20demTo) { const m = fieldMons(g).find(x => x.u === ev.snap.flags.f20demTo);
        if (m && m.flags.f20demN) { m.flags.f20demN--; m.flags.lv = m.flags.f20demN ? Math.max(1, m.flags.f20demBase - 2 * m.flags.f20demN) : null; g.seq++; } }
      return false; } }] },
  'Desertapir': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Flip a monster face-down', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: g => fieldMons(g).some(m => faceUp(m) && !named(m, 'Desertapir')),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Flip which face-up monster face-down?', fieldMons(g).filter(m => faceUp(m) && !named(m, 'Desertapir')), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) setFaceDown(g, t); } }] },
  // Whose effect sent it: the move's `by` when set, else an effect during the opponent's turn.
  // PARTIAL: an opponent's Quick Effect on your own turn that sends it with no "by" is missed.
  'Despair from the Dark': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon itself',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && ['hand', 'deck'].includes(ev.from) && ['effect', 'discard'].includes(ev.reason) && (ev.by != null ? ev.by !== c.owner : g.tp !== c.owner),
    cond: (g, c, p) => freeM(g, p) >= 0, res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c, 'atk'); } }] },
  'Desrook Archfiend': { effs: [archCost, archDice((g, c, m) => m === c, [3], 'Roll a die (3 negates)'),
    { type: 'trig', loc: 'hand', when: true, tags: { ss: 1 }, label: 'Send this card: revive Terrorking Archfiend',
      on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.destroyed && ev.to === 'gy' && named(ev.c, 'Terrorking Archfiend') && ev.prevCtrl === c.owner,
      cond: (g, c, p, x) => x.ev.c.zone === 'gy',
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Desrook Archfiend to the GY.`); },
      res: function* (g, c, p, L2) { const t = L2.ev.c; if (t.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, t); } }] },
  'Dian Keto the Cure Master': { effs: [{ type: 'act', res: function* (g, c, p) { gain(g, p, 1000); } }] },
  // PARTIAL: it gets one attack for each monster the opponent controls as this resolves, but could attack the same monster
  // twice; "must attack" isn't forced (ENGINE: no forced attacks). Monsters it destroys can't activate their effects this turn.
  'Diffusion Wave-Motion': { effs: [{ type: 'trig', loc: 'any', res: function* () {}, on: (g, ev) => {
      if (ev.type === 'move' && ev.battle && ev.destroyed && ev.killer && ev.killer.flags && ev.killer.flags.f20dwm === g.turnNo) { const x = ev.c; addRule(g, (g2, a) => a.type === 'activate' && a.c === x, { end: g.turnNo }); }
      return false; } },
    { type: 'act', cond: (g, c, p) => g.phase === 'main1' && !g.noBP[p] && g.p[p].lp > 1000 && monsOf(g, opp(p)).length > 0 && monsOf(g, p).some(m => faceUp(m) && race(m) === 'Spellcaster' && lv(m) >= 7),
      cost: function* (g, c, p) { pay(g, p, 1000); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Level 7 or higher Spellcaster attacks every monster?', monsOf(g, p).filter(m => faceUp(m) && race(m) === 'Spellcaster' && lv(m) >= 7), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; g.onlyAttacker[p] = t.u; t.flags.maxAttacks = Math.max(1, monsOf(g, opp(p)).length); t.flags.maxAttacksTurn = g.turnNo; t.flags.f20dwm = g.turnNo; g.seq++;
        log(g, `${name(t)} attacks every monster ${PN(g, opp(p))} controls this turn; other monsters can't attack.`); } }] },
  // ENGINE: the emptied Monster Zone can still be used (no zone lock). Returning it uses a chain link in the Standby Phase.
  'Dimensionhole': { effs: [
    { type: 'act', cond: (g, c, p) => monsOf(g, p).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which of your monsters until your next Standby Phase?', monsOf(g, p), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.ctrl !== p) return; const pos = t.pos; move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished until ${PN(g, p)}'s next Standby Phase.`);
        (g.f20dh || (g.f20dh = [])).push({ u: c.u, c: t, p, pos, turn: g.turnNo }); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return the banished monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && !!g.f20dh && g.f20dh.some(e => e.u === c.u && e.p === ev.tp && g.turnNo > e.turn),
      res: function* (g, c) { const due = g.f20dh.filter(e => e.u === c.u && e.p === g.tp && g.turnNo > e.turn); g.f20dh = g.f20dh.filter(e => !due.includes(e));
        for (const e of due) { const x = e.c; if (x.zone !== 'ban' || freeM(g, x.owner) < 0) continue; move(g, x, 'm', { ctrl: x.owner, pos: e.pos, reason: 'effect' }); log(g, `${D(x).n} returned to the field.`); } } }] },
  'Disappear': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].gy.length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which card from their GY?', g.p[opp(p)].gy, 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished.`); } } }] },
  'Disarmament': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c) => stOnField(g).some(x => x !== c && faceUp(x) && (x.equipTo || (isSpell(x) && D(x).sub === 'Equip'))),
    res: function* (g, c, p) { destroy(g, stOnField(g).filter(x => x !== c && faceUp(x) && (x.equipTo || (isSpell(x) && D(x).sub === 'Equip'))), { by: p, src: c }); } }] },
  // PARTIAL: the check is at the start of the Damage Step (a face-down monster is flipped then), not right before damage calculation.
  'Disc Fighter': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the Defense Position monster',
    on: (g, ev, c) => ev.type === 'dsStart' && ev.a === c && ev.t && ev.t.pos !== 'atk' && (ev.t.pos === 'set' ? num(D(ev.t).def) : def(g, ev.t)) >= 2000,
    res: function* (g, c, p, L2) { const t = L2.ev.t; if (!t || !onField(t) || !onField(c) || t.pos === 'atk') return;
      if (t.pos === 'set') { t.pos = 'def'; g.seq++; log(g, `The face-down monster was ${name(t)}.`); emit(g, { type: 'flip', c: t, p: t.ctrl, battle: true }); }
      if (def(g, t) >= 2000) destroy(g, [t], { by: p }); } }] },
  'Disturbance Strategy': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length > 0,
    res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand.slice(); if (!h.length) return; for (const x of h) move(g, x, 'deck', { reason: 'effect', by: p }); log(g, `${PN(g, o)} shuffled ${h.length} card${h.length > 1 ? 's' : ''} into the Deck.`); draw(g, o, h.length); } }] },
  'Dokurorider': { effs: [] },
  'Don Turtle': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon Don Turtles', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'flip']),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => named(x, 'Don Turtle')),
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => named(x, 'Don Turtle')); const n = Math.min(cs.length, nFreeM(g, p)); if (!n) return;
      const xs = yield* pick(g, p, 'Special Summon any number of Don Turtle from your hand', cs, 1, n, 'good'); for (const x of xs) ss(g, p, x); } }] },
  'Don Zaloog': { effs: [{ type: 'trig', when: true, label: 'Discard or mill 2',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    cond: (g, c, p) => g.p[opp(p)].hand.length > 0 || g.p[opp(p)].deck.length > 0,
    res: function* (g, c, p) { const o = opp(p), opts = [];
      if (g.p[o].hand.length) opts.push('Discard 1 random card from their hand');
      if (g.p[o].deck.length) opts.push('Send the top 2 cards of their Deck to the GY');
      if (!opts.length) return; const i = opts.length > 1 ? yield* choose(g, p, 'Don Zaloog: which effect?', opts) : 0;
      if (/random/.test(opts[i])) discardRandom(g, o, p); else mill(g, o, 2); } }] },
  // The first Normal Summon of the next turn counts, whatever its Level.
  'Dora of Fate': { effs: [
    { type: 'act', cond: (g, c, p) => g.tp !== p && oppFaceUp(g, p).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which face-up monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t) return; const l = lv(t); (g.f20dora || (g.f20dora = [])).push({ u: c.u, p, lv: l, turn: g.turnNo + 1 });
        log(g, `If ${PN(g, p)} Normal Summons a Level ${l - 1} monster next turn, ${PN(g, opp(p))} takes ${l * 500} damage.`); } },
    // The damage is the resolved Trap's lingering effect, so it is dealt as the summon happens (no chain link, and a Jinzo
    // that is Normal Summoned doesn't stop it).
    { type: 'trig', loc: 'any', res: function* () {},
      on: (g, ev, c) => { if (ev.type !== 'summon' || !['normal', 'tribute'].includes(ev.how) || !g.f20dora) return false;
        for (const e of g.f20dora) if (e.u === c.u && !e.used && e.p === ev.p && e.turn === g.turnNo) { e.used = true; if (lv(ev.cs[0]) === e.lv - 1) { log(g, 'Dora of Fate inflicts damage.'); damage(g, opp(e.p), e.lv * 500, { src: c, srcP: e.p }); } }
        g.f20dora = g.f20dora.filter(e => !e.used && e.turn >= g.turnNo); return false; } }] },
  "Doriado's Blessing": { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && canRitual(g, p, { monster: x => named(x, 'Elemental Mistress Doriado') }),
    res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, 'Elemental Mistress Doriado') }); } }] },
  'Dragged Down into the Grave': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && g.p[opp(p)].hand.length > 0,
    res: function* (g, c, p) { const o = opp(p); const hp = g.p[p].hand, ho = g.p[o].hand; if (!hp.length && !ho.length) return;
      log(g, `${PN(g, p)}'s hand: ${hp.map(x => D(x).n).join(', ') || 'empty'}. ${PN(g, o)}'s hand: ${ho.map(x => D(x).n).join(', ') || 'empty'}.`);
      const first = g.tp, second = opp(g.tp), chosen = [];
      for (const q of [first, second]) { const h = g.p[opp(q)].hand; if (!h.length) continue; const [x] = yield* pick(g, q, 'Choose 1 card from your opponent’s hand to discard', h, 1, 1, 'bad'); if (x) chosen.push(x); }
      for (const x of chosen) if (x.zone === 'hand') move(g, x, 'gy', { reason: 'discard', by: p });
      if (chosen.length) log(g, `${chosen.map(name).join(' and ')} ${chosen.length > 1 ? 'were' : 'was'} discarded.`);
      draw(g, first, 1); draw(g, second, 1); } }] },
  'Draining Shield': { effs: [{ type: 'act', cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p),
    target: function* (g, c, p, L2) { L2.t = [g.aw.a]; },
    res: function* (g, c, p, L2) { const a = live(L2)[0]; if (!a || !g.aw || g.aw.a !== a) return; const n = faceUp(a) ? atk(g, a) : 0; negateAttack(g); gain(g, p, n); } }] },
  'Dramatic Rescue': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p, x) => { const T = x.top; return !!T && !T.negated && T.t.some(m => onField(m) && m.zone === 'm' && faceUp(m) && m.ctrl === p && /Amazoness/.test(name(m))) && g.p[p].hand.some(y => y !== c && ssAble(y)); },
    target: function* (g, c, p, L2) { const T = g.chain[g.chain.length - 1]; L2.t = T.t.filter(m => onField(m) && m.zone === 'm' && faceUp(m) && m.ctrl === p && /Amazoness/.test(name(m))).slice(0, 1); },
    res: function* (g, c, p, L2) { const m = live(L2)[0]; if (!m || !faceUp(m)) return; move(g, m, 'hand', { reason: 'effect', by: p }); log(g, `${D(m).n} returned to the hand.`);
      const cs = g.p[p].hand.filter(y => y !== m && ssAble(y)); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which monster from your hand?', cs, 1, 1, 'good'); if (!x) return;
      const i = yield* choose(g, p, `${name(x)}: which position?`, ['Attack Position', 'Defense Position']); ss(g, p, x, i ? 'def' : 'atk'); } }] },
  'Dream Clown': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a monster',
    on: (g, ev, c) => ev.type === 'pos' && ev.c === c && c.pos === 'def',
    cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which of their monsters?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  // The attack is negated and the attacker battles the new target in the card (miniBattle).
  'Dreamsprite': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Switch the attack target',
    on: (g, ev, c) => ev.type === 'attack' && ev.t === c && ev.a && ev.a.ctrl !== c.ctrl,
    cond: (g, c, p) => monsOf(g, p).some(m => m !== c),
    target: function* (g, c, p, L2) { L2.data.a = g.aw ? g.aw.a : null; yield* tgt(g, p, L2, 'Switch the attack to which of your monsters?', monsOf(g, p).filter(m => m !== c), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0], a = L2.data.a; if (!t || !a || !onField(a) || !g.aw || g.aw.a !== a || t.ctrl !== p) return;
      negateAttack(g); g.aw = null; log(g, `The attack was switched to ${t.pos === 'set' ? 'a face-down monster' : name(t)}.`); miniBattle(g, a, t); } }] },
});
})();
