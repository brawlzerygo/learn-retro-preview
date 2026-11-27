/* Full pool batch 08: Energy Bravery to Graceful Revival (build/batches/full/full-08.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text; cards with a
 Goat-only script elsewhere (Energy Drain, Fairy Box, Gift of The Mystical Elf, Flame Ghost, Giant Orc, Gaia the Dragon
 Champion, Giant Germ, Goblin Attack Force, Graceful Charity, Graceful Dice) are ported here as the shared version. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, setFaceDown, negate, addMod,
  equip, link, addRule, fusionSummon, canFusion, ritualSummon, canRitual, coin, dice, winDuel,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, allField, fieldMons,
  freeM, freeST, nFreeM, shuffleDeck, log, PN, live, opp, stOnField, spellTrapAct, evSummoned, isGemini, stat, negd, emit } = L;

const named = (c, n) => D(c).n === n;
// Edison text: the PSCT line when there is one, else the card text ("No Edison-Accurate PSCT" is a placeholder)
const txt = c => { const d = D(c); return d.ps && !/^No (?:Edison|rulings)/.test(d.ps) ? d.ps : d.tx || ''; };
// A monster changes battle position by a card effect (logged and announced, no chain).
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'atk' }); };
function* discardPick(g, p, n, text, not) { const h = g.p[p].hand.filter(x => x !== not); if (!h.length) return []; const xs = yield* pick(g, p, text, h, Math.min(n, h.length), Math.min(n, h.length), 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'discard' }); if (xs.length) log(g, `${PN(g, p)} discarded ${xs.map(name).join(', ')}.`); return xs; }
// Does this card's effect inflict effect damage? (read from its text; battle damage doesn't count)
const dmgText = c => /inflict[^.]*damage|damage[^.]*(?:to your opponent|to you\b|to each player|to both players|to its controller|to the controller)|takes? [^.]*damage/i.test(txt(c).replace(/(?:piercing )?battle damage/gi, ''));
const dmgLink = L2 => !!L2 && !L2.negated && dmgText(L2.c);
// Equip Spells
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) equip(g, c, t); } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
// "If this card attacks, it is changed to Defense Position at the end of the Battle Phase. Its battle position can't be
// changed until the end of your next turn." Done as it happens, with no chain link. A negated attack doesn't count
// (Goblin Attack Force ruling): the attack counts once it reaches the Damage Step.
const goblinLock = (more = {}) => ({ ...more,
  cont: { ...(more.cont || {}), forbid: (g, src, a) => a.type === 'pos' && a.c === src && src.flags.gobLock >= g.turnNo },
  effs: [{ type: 'trig', on: (g, ev, c) => {
    if (ev.type === 'dsStart' && ev.a === c) c.flags.gobAtk = g.turnNo;
    if (ev.type === 'phase' && ev.ph === 'bpEnd' && c.flags.gobAtk === g.turnNo && onField(c)) { c.flags.gobAtk = 0; c.flags.gobLock = g.turnNo + 2; toDef(g, c); }
    return false; }, res: function* () {} }, ...(more.effs || [])] });
// Flint
const flintOf = (g, m) => stOnField(g).find(x => faceUp(x) && named(x, 'Flint') && x.equipTo === m.u) || null;
const flintImmune = (g, m) => named(m, 'Flint Lock') && faceUp(m) && !negd(g, m);
// Gaia Plate: halve during the Damage Step (the inner stat() call skips this cont, so it halves the rest)
let HALVING = 0;
const battling = (g, src, c) => g.inDS && g.battle && c !== src && ((g.battle.a === src && g.battle.t === c) || (g.battle.t === src && g.battle.a === c));
const gaiaHalf = which => (g, src, c) => { if (HALVING || !battling(g, src, c)) return 0; HALVING++; try { const v = stat(g, c, which); return -(v - Math.floor(v / 2)); } finally { HALVING--; } };
// Spell Cards your opponent's card effect sent to your GY this turn (cards the engine marks with who did it)
const sentByOpp = (g, x, p) => g.events.some(e => e.type === 'move' && e.c === x && e.turn === g.turnNo && e.to === 'gy' && e.by === opp(p));
// Goblin of Greed: an effect whose cost is discarding (read from the text: "discard ...;" in PSCT, "by discarding")
const discardCost = c => /discard[^.;]*;/i.test(txt(c)) || /(?:^|[.;:]\s*|\bby |\byou can |, )discard/i.test(txt(c));
const fromHandToGY = ev => ev.type === 'move' && ev.from === 'hand' && ev.to === 'gy' && ['discard', 'cost'].includes(ev.reason);

E.addScripts({
  'Energy Bravery': { cont: { grant: (g, src, c, flag) => flag === 'noEffectDestroy' && c.ctrl === src.ctrl && onField(c) && isGemini(c) && !!c.flags.gemini } },
  'Energy Drain': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which of your face-up monsters?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const n = 200 * g.p[opp(p)].hand.length; if (!n) return; addMod(g, t, { atk: n, def: n, end: true }); log(g, `${name(t)} gained ${n} ATK and DEF.`); } }] },
  // The damage of the link it chains to becomes a gain (a damage hook from the GY, for that one link only).
  // PARTIAL: "an effect that would inflict damage" is read from the card's text.
  'Energy-Absorbing Monolith': {
    cont: { loc: 'gy', dmg: (g, src, p, n, o) => !o.battle && g.monolith && g.monolith.some(m => m.p === p && m.grp === g.group) ? { gain: n } : undefined },
    effs: [{ type: 'act', cond: (g, c, p, x) => !!x.top && x.top.p !== p && dmgLink(x.top),
      res: function* (g, c, p) { (g.monolith || (g.monolith = [])).push({ p, grp: g.group + 1 }); if (g.monolith.length > 8) g.monolith.shift(); log(g, `${PN(g, p)} will gain LP instead of taking that damage.`); } }] },
  // The call is a fair coin: right half the time.
  'Fairy Box': { effs: [
    { type: 'act', res: function* () {} },
    { type: 'quick', loc: 'st', label: 'Toss a coin',
      cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p && g.aw.fairy !== c.u),
      target: function* (g, c, p, L2) { g.aw.fairy = c.u; L2.t = [g.aw.a]; },
      res: function* (g, c, p, L2) { const a = live(L2)[0]; if (!a || !faceUp(a)) return; const call = g.rnd() < 0.5; log(g, `${PN(g, p)} called ${call ? 'Heads' : 'Tails'}.`);
        if (coin(g, p) === call) { addMod(g, a, { set: 0, which: 'atk', end: true, fairy: c.u }); log(g, `${name(a)}'s ATK became 0.`); } else log(g, 'The call was wrong.'); } },
    { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'bpEnd') for (const m of fieldMons(g)) m.mods = m.mods.filter(x => x.fairy !== c.u); return false; }, res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, label: 'Pay 500 LP or destroy this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 500 && (yield* yn(g, p, 'Pay 500 LP to keep Fairy Box?'))) pay(g, p, 500); else destroy(g, [c], { by: p }); } }] },
  // PARTIAL: only Spells the engine marks as sent by the opponent count (destroyed or negated by their card; discards
  // and mills from the Deck carry no "by" yet).
  'Fairy Guardian': { effs: [{ type: 'ign', label: 'Tribute: return a Spell to the Deck',
    cond: (g, c, p) => g.p[p].gy.some(x => isSpell(x) && sentByOpp(g, x, p)),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Fairy Guardian.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which Spell Card to the bottom of your Deck?', g.p[p].gy.filter(x => isSpell(x) && sentByOpp(g, x, p)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const x = L2.t[0]; if (!x || x.zone !== 'gy') return; move(g, x, 'deckTop', { reason: 'effect' }); const d = g.p[x.owner].deck; d.splice(d.indexOf(x), 1); d.unshift(x); log(g, `${name(x)} was put on the bottom of the Deck.`); } }] },
  'Fairy King Truesdale': { cont: {
    atk: (g, src, c) => src.pos === 'def' && c.ctrl === src.ctrl && faceUp(c) && race(c) === 'Plant' ? 500 : 0,
    def: (g, src, c) => src.pos === 'def' && c.ctrl === src.ctrl && faceUp(c) && race(c) === 'Plant' ? 500 : 0 } },
  'Fairy Meteor Crush': { cont: { grant: (g, src, m, flag) => flag === 'piercing' && src.equipTo === m.u }, effs: [equipAct()] },
  'Fairy of the Spring': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.some(x => isSpell(x) && D(x).sub === 'Equip'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Equip Spell to your hand?', g.p[p].gy.filter(x => isSpell(x) && D(x).sub === 'Equip'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const x = L2.t[0]; if (!x || x.zone !== 'gy') return; move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(x)} to the hand.`);
      addRule(g, (g2, a) => a.type === 'activate' && a.c === x && a.eff.type === 'act', { end: g.turnNo }); } }] },
  'Fairy Wind': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c) => stOnField(g).some(x => x !== c && faceUp(x)),
    res: function* (g, c, p) { const n = destroy(g, stOnField(g).filter(x => x !== c && faceUp(x)), { by: p, src: c }).length; if (!n) return;
      const d = 300 * n; const order = [p, opp(p)].sort((a, b) => (g.p[a].lp <= d) - (g.p[b].lp <= d));
      if (g.p[order[0]].lp <= d && g.p[order[1]].lp <= d) { g.p[order[0]].lp -= d; log(g, `${PN(g, order[0])} took ${d} damage.`); damage(g, order[1], d, { src: c, srcP: p }); }
      else for (const q of order) damage(g, q, d, { src: c, srcP: p }); } }] },
  'Familiar Knight': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Each player can summon a Level 4',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p) { for (const q of [p, opp(p)]) { const cs = g.p[q].hand.filter(x => isMon(x) && lv(x) === 4); if (!cs.length || freeM(g, q) < 0) continue;
      if (!(yield* yn(g, q, 'Special Summon a Level 4 monster from your hand?'))) continue; const [x] = yield* pick(g, q, 'Special Summon which Level 4 monster?', cs, 1, 1, 'good'); if (x) ss(g, q, x, 'atk'); } } }] },
  // PARTIAL: a face-down monster flipped by an attack is changed to Attack Position after damage calculation, not before.
  'Final Attack Orders': (() => { const allAtk = g => { for (const m of fieldMons(g)) if (faceUp(m) && m.pos === 'def') { m.pos = 'atk'; g.seq++; log(g, `${name(m)} was changed to Attack Position.`); } };
    return { cont: { forbid: (g, src, a) => a.type === 'pos' && a.c && faceUp(a.c) },
      effs: [{ type: 'act', res: function* (g) { allAtk(g); } },
        { type: 'trig', loc: 'st', on: (g, ev, c) => { if (faceUp(c)) allAtk(g); return false; }, res: function* () {} }] }; })(),
  // The win is checked at the 20th turn's End Phase (turn 1 is the activation turn); both at once is a draw.
  'Final Countdown': { effs: [
    { type: 'act', cond: (g, c, p) => g.p[p].lp > 2000, cost: function* (g, c, p) { pay(g, p, 2000); },
      res: function* (g, c, p) { (g.fcd || (g.fcd = [])).push({ p, t: g.turnNo }); log(g, `${PN(g, p)} wins at the end of turn ${g.turnNo + 19}.`); } },
    { type: 'trig', loc: 'any', on: (g, ev) => {
      if (ev.type === 'phase' && ev.ph === 'end' && g.fcd) { const due = g.fcd.filter(e => g.turnNo >= e.t + 19); if (due.length) { if (new Set(due.map(e => e.p)).size > 1) winDuel(g, -1, 'Both Final Countdowns ended: the Duel is a draw'); winDuel(g, due[0].p, `${PN(g, due[0].p)} won with Final Countdown`); } }
      return false; }, res: function* () {} }] },
  'Final Destiny': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => g.p[p].hand.filter(x => x !== c).length >= 5,
    cost: function* (g, c, p) { yield* discardPick(g, p, 5, 'Discard 5 cards', c); },
    res: function* (g, c, p) { destroy(g, allField(g), { by: p, src: c }); } }] },
  'Final Flame': { effs: [{ type: 'act', res: function* (g, c, p) { damage(g, opp(p), 600, { src: c, srcP: p }); } }] },
  'Final Ritual of the Ancients': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && canRitual(g, p, { monster: x => named(x, 'Reshef the Dark Being') }),
    res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, 'Reshef the Dark Being') }); } }] },
  // PARTIAL: sending the monster to the GY in the End Phase uses a chain link (the ruling says it doesn't start one).
  'Fire Ant Ascator': { effs: [
    { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon a Level 5 from your GY',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => x !== c && isMon(x) && lv(x) === 5),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Level 5 monster?', g.p[p].gy.filter(x => x !== c && isMon(x) && lv(x) === 5), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && ss(g, p, t, 'atk', { negate: true })) { t.flags.ascator = g.turnNo; c.flags.ascTurn = g.turnNo; } } },
    { type: 'trig', loc: 'any', mand: true, label: 'Send the summoned monster to the GY',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.ascTurn === g.turnNo && fieldMons(g).some(x => x.flags.ascator === g.turnNo),
      res: function* (g, c) { c.flags.ascTurn = 0; for (const x of fieldMons(g).filter(x => x.flags.ascator === g.turnNo)) { move(g, x, 'gy', { reason: 'effect' }); log(g, `${D(x).n} was sent to the GY.`); } } }] },
  'Fire Darts': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.length === 0,
    res: function* (g, c, p) { const n = dice(g, p) + dice(g, p) + dice(g, p); damage(g, opp(p), n * 100, { src: c, srcP: p }); } }] },
  // A Continuous Effect (ruling): the damage happens with no chain link whenever its controller's LP has gone up.
  // PARTIAL: LP is compared at each game event, so a gain and a loss between two events can be missed.
  'Fire Princess': { effs: [{ type: 'trig', on: (g, ev, c) => {
    const p = c.ctrl, cur = g.p[p].lp, prev = c.flags.fpLp; c.flags.fpLp = cur;
    if (prev != null && cur > prev && g.p[opp(p)].lp > 0) { log(g, 'Fire Princess inflicts 500 damage.'); damage(g, opp(p), 500, { src: c, srcP: p }); }
    return false; }, res: function* () {} }] },
  'Fire Sorcerer': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Banish 2 random cards: 800 damage', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c, p) => g.p[p].hand.length >= 2,
    res: function* (g, c, p) { const h = g.p[p].hand; if (h.length < 2) return; const xs = [];
      while (xs.length < 2) { const x = h[Math.floor(g.rnd() * h.length)]; if (!xs.includes(x)) xs.push(x); }
      for (const x of xs) move(g, x, 'ban', { reason: 'effect' }); log(g, `${PN(g, p)} banished ${xs.map(name).join(' and ')} from the hand.`);
      damage(g, opp(p), 800, { src: c, srcP: p }); } }] },
  'Fire Trooper': { effs: [{ type: 'trig', when: true, label: 'Send it to the GY: 1000 damage', on: (g, ev, c) => evSummoned(ev, c),
    cond: (g, c) => onField(c),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Fire Trooper to the GY.`); },
    res: function* (g, c, p) { damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },
  // mats: the recipe line can't be read while the PSCT field holds a placeholder.
  'Flame Ghost': { mats: [x => named(x, 'Skull Servant'), x => named(x, 'Dissolverock')], effs: [] },
  // ENGINE: "can't be Special Summoned" is only enforced from the GY (no generic flag; build/ENGINE_TODO.md).
  'Flame Ogre': { cont: { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src },
    effs: [{ type: 'trig', mand: true, label: 'Draw 1 card', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']), res: function* (g, c, p) { draw(g, p, 1); } }] },
  // PARTIAL: offers a 1-Tribute Summon of a Level 7+ FIRE monster while this card is face-up, but the engine lets any one monster be the Tribute.
  'Flame Ruler': { cont: { tributes: (g, src, c, p, need) => src.ctrl === p && need === 2 && attr(c) === 'FIRE' ? 1 : null } },
  'Flame Spirit Ignis': { effs: [{ type: 'ign', label: 'Tribute a FIRE: burn',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && attr(x) === 'FIRE'),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 face-up FIRE monster', monsOf(g, p).filter(x => faceUp(x) && attr(x) === 'FIRE'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    res: function* (g, c, p) { const n = g.p[p].gy.filter(x => isMon(x) && attr(x) === 'FIRE').length; damage(g, opp(p), 100 * n, { src: c, srcP: p }); } }] },
  'Flint': {
    cont: { atk: (g, src, m) => src.equipTo === m.u && !flintImmune(g, m) ? -300 : 0,
      forbid: (g, src, a) => (a.type === 'pos' || a.type === 'attack') && a.c && src.equipTo === a.c.u && !flintImmune(g, a.c) },
    effs: [{ ...equipAct(), res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && equip(g, c, t)) c.flags.flintTo = t.u; } },
      { type: 'trig', loc: 'gy', mand: true, label: 'Equip Flint to another monster',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy' && ev.reason === 'rule' && ev.snap && ev.snap.flags.flintTo &&
          g.events.some(e => e.type === 'move' && e.c.u === ev.snap.flags.flintTo && e.destroyed && e.group === ev.group),
        cond: (g, c, p) => freeST(g, p) >= 0 && fieldMons(g).some(faceUp),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Flint to which monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || c.zone !== 'gy' || freeST(g, p) < 0) return; move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); if (equip(g, c, t)) c.flags.flintTo = t.u; } }] },
  'Flint Lock': { self: { noBattleDestroy: (g, c) => !!flintOf(g, c) },
    effs: [
      { type: 'ign', opt: true, label: 'Equip a Flint to this card',
        cond: (g, c) => !flintOf(g, c) && stOnField(g).some(x => faceUp(x) && named(x, 'Flint') && x.equipTo),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip which Flint to Flint Lock?', stOnField(g).filter(x => faceUp(x) && named(x, 'Flint') && x.equipTo), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const f = live(L2)[0]; if (f && faceUp(f) && onField(c) && faceUp(c) && !flintOf(g, c) && equip(g, f, c)) f.flags.flintTo = c.u; } },
      { type: 'ign', label: 'Move Flint to another monster',
        cond: (g, c) => !!flintOf(g, c) && fieldMons(g).some(x => x !== c && faceUp(x)),
        target: function* (g, c, p, L2) { const f = flintOf(g, c); yield* tgt(g, p, L2, 'Equip Flint to which monster?', fieldMons(g).filter(x => x !== c && faceUp(x)), 1, 1, 'bad'); L2.t = [f, ...L2.t]; },
        res: function* (g, c, p, L2) { const [f, m] = L2.t; if (f && m && onField(f) && f.equipTo === c.u && onField(m) && faceUp(m) && equip(g, f, m)) f.flags.flintTo = m.u; } }] },
  'Flint Missile': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(m => flintOf(g, m)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster equipped with Flint?', fieldMons(g).filter(m => flintOf(g, m)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && flintOf(g, t)) destroy(g, [t], { by: p, src: c });
      if (onField(c) && (yield* yn(g, p, 'Return Flint Missile to your Deck instead of the GY?'))) { move(g, c, 'deck', { reason: 'effect' }); log(g, 'Flint Missile was shuffled into the Deck.'); } } }] },
  'Forced Back': { effs: [{ type: 'act', negSummon: true,
    cond: (g, c, p, x) => !x.top && !!g.attempt && ['normal', 'tribute', 'flip'].includes(g.attempt.how),
    target: function* (g, c, p, L2) { L2.data.cs = g.attempt.cs.slice(); },
    res: function* (g, c, p, L2) { if (!g.attempt) return; for (const x of L2.data.cs) if (onField(x)) { move(g, x, 'hand', { reason: 'effect', by: p }); log(g, `${D(x).n} returned to the hand.`); } g.attempt.negated = true; log(g, 'The summon was negated.'); } }] },
  'Forced Ceasefire': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.length > 0,
    cost: function* (g, c, p) { yield* discardPick(g, p, 1, 'Discard 1 card'); },
    res: function* (g, c, p) { addRule(g, (g2, a) => a.type === 'activate' && a.eff && a.eff.type === 'act' && isTrap(a.c), { end: g.turnNo }); log(g, 'No Trap Cards can be activated this turn.'); } }] },
  // PARTIAL: "when you discard" is read as a discard (or a hand card sent to the GY as a cost) in the last few game events.
  'Forced Requisition': { effs: [
    { type: 'act', cond: (g, c, p) => g.events.slice(-6).some(e => fromHandToGY(e) && e.c.owner === p && e.c !== c), res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, label: 'Your opponent discards the same number',
      on: (g, ev, c) => { if (!fromHandToGY(ev) || ev.c.owner !== c.ctrl || ev.turn !== g.turnNo) return false; c.flags.frqN = (c.flags.frqN || 0) + 1; return c.flags.frqN === 1; },
      res: function* (g, c, p) { const n = c.flags.frqN || 1; c.flags.frqN = 0; yield* discardPick(g, opp(p), n, `Forced Requisition: discard ${n} card${n > 1 ? 's' : ''}`); } }] },
  'Fusion Devourer': { cont: { atk: (g, src, c) => D(c).k === 'fusion' && battling(g, src, c) ? -99999 : 0 } },
  'Fusion Gate': { effs: [{ type: 'act', res: function* () {} },
    { type: 'ign', loc: 'fz', anyPlayer: true, tags: { ss: 1 }, label: 'Fusion Summon (banish the materials)',
      cond: (g, c, p) => canFusion(g, p, { from: ['hand', 'm'] }),
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) yield* fusionSummon(g, p, { from: ['hand', 'm'], banish: true }); } }] },
  // PARTIAL: "an effect that inflicts damage" is read from the card's text.
  'Fusion Guard': { effs: [{ type: 'act', cond: (g, c, p, x) => dmgLink(x.top),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, false); const fs = g.p[p].extra.filter(x => D(x).k === 'fusion'); if (fs.length) { const x = fs[Math.floor(g.rnd() * fs.length)]; move(g, x, 'gy', { reason: 'effect' }); log(g, `${PN(g, p)} sent ${D(x).n} from the Extra Deck to the GY.`); } } }] },
  // Fusion Material is marked as it goes to the GY (this card watches from wherever it is); old events are a fallback.
  'Fusion Recovery': (() => { const wasMat = (g, x) => x.flags.fusMat || g.events.some(e => e.type === 'move' && e.c === x && e.reason === 'fusion' && e.to === 'gy');
    const mats = (g, p) => g.p[p].gy.filter(x => isMon(x) && wasMat(g, x)), polys = (g, p) => g.p[p].gy.filter(x => named(x, 'Polymerization'));
    return { effs: [
      { type: 'act', cond: (g, c, p) => mats(g, p).length > 0 && polys(g, p).length > 0,
        target: function* (g, c, p, L2) { const [a] = yield* pick(g, p, 'Add which Polymerization?', polys(g, p), 1, 1, 'good'); const [b] = yield* pick(g, p, 'Add which Fusion Material monster?', mats(g, p), 1, 1, 'good'); L2.t = [a, b].filter(Boolean); },
        res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'hand', { reason: 'effect' }); if (xs.length) log(g, `${PN(g, p)} added ${xs.map(name).join(' and ')} to the hand.`); } },
      { type: 'trig', loc: 'any', on: (g, ev) => { if (ev.type === 'move') { if (ev.reason === 'fusion' && ev.to === 'gy') ev.c.flags.fusMat = true; else if (ev.from === 'gy') delete ev.c.flags.fusMat; } return false; }, res: function* () {} }] }; })(),
  'Fusion Sage': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'Polymerization')),
    res: function* (g, c, p) { yield* search(g, p, x => named(x, 'Polymerization'), 'Add Polymerization to your hand'); } }] },
  'Fusion Sword Murasame Blade': { self: { noEffectDestroy: (g, c) => !!c.equipTo }, cont: eqBonus(800, 0), effs: [equipAct(m => race(m) === 'Warrior', 'Equip to which Warrior?')] },
  'Fusion Weapon': { cont: eqBonus(1500, 1500), effs: [equipAct(m => D(m).k === 'fusion' && lv(m) <= 6, 'Equip to which Level 6 or lower Fusion Monster?')] },
  // PARTIAL: the halving applies through the whole Damage Step, not only damage calculation. The Standby Phase cost uses a chain link.
  'Gaia Plate the Earth Giant': {
    proc: { label: 'Special Summon (banish 2 Rocks from your GY)', cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && race(x) === 'Rock').length >= 2,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Banish 2 Rock monsters from your GY', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Rock'), 2, 2, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${xs.map(name).join(' and ')}.`); } },
    cont: { atk: gaiaHalf('atk'), def: gaiaHalf('def') },
    effs: [{ type: 'trig', mand: true, label: 'Banish a Rock or send this card to the GY', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; const rs = g.p[p].gy.filter(x => isMon(x) && race(x) === 'Rock');
        if (rs.length && (yield* yn(g, p, 'Banish 1 Rock monster from your GY to keep Gaia Plate?'))) { const [x] = yield* pick(g, p, 'Banish which Rock monster?', rs, 1, 1, 'cost'); move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${name(x)}.`); }
        else { move(g, c, 'gy', { reason: 'rule' }); log(g, 'Gaia Plate the Earth Giant was sent to the GY.'); } } }] },
  'Gaia Power': { effs: [{ type: 'act', res: function* () {} }],
    cont: { atk: (g, src, c) => faceUp(c) && attr(c) === 'EARTH' ? 500 : 0, def: (g, src, c) => faceUp(c) && attr(c) === 'EARTH' ? -400 : 0 } },
  'Gaia Soul the Combustible Collective': { self: { piercing: true },
    effs: [{ type: 'ign', opt: true, label: 'Tribute Pyros for ATK',
      cond: (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x) && race(x) === 'Pyro'),
      cost: function* (g, c, p, L2) { const cs = monsOf(g, p).filter(x => x !== c && faceUp(x) && race(x) === 'Pyro'); const xs = yield* pick(g, p, 'Tribute up to 2 Pyro monsters', cs, 1, 2, 'cost');
        for (const x of xs) move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${xs.map(x => D(x).n).join(' and ')}.`); L2.data.n = xs.length; },
      res: function* (g, c, p, L2) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 1000 * L2.data.n }); log(g, `${name(c)} gained ${1000 * L2.data.n} ATK.`); } } },
      { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end',
        res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  'Gaia the Dragon Champion': { mats: [x => named(x, 'Gaia The Fierce Knight'), x => named(x, 'Curse of Dragon')], effs: [] },
  'Giant Axe Mummy': { effs: [
    { type: 'ign', opt: true, label: 'Flip this card face-down', cond: (g, c) => faceUp(c) && c.turnIn !== g.turnNo && !c.posChanged,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { setFaceDown(g, c); c.posChanged = true; } } },
    { type: 'trig', mand: true, faceDownOk: true, tags: { destroy: 1 }, label: 'Destroy the attacker',
      on: (g, ev, c) => ev.type === 'afterCalc' && ev.t === c && ev.flipped && ev.a && ev.a.ctrl !== c.ctrl && stat(g, ev.a, 'atk') < stat(g, c, 'def'),
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (onField(a)) destroy(g, [a], { by: p }); } }] },
  'Giant Germ': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: '500 damage, summon Giant Germs', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p });
      const cs = g.p[p].deck.filter(x => named(x, 'Giant Germ')); const n = Math.min(cs.length, nFreeM(g, p)); if (!n) return;
      const xs = yield* pick(g, p, 'Special Summon any number of Giant Germ from your Deck (none is fine)', cs, 0, n, 'good');
      for (const x of xs) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  // PARTIAL: destroying itself with no "Kozaky" uses a chain link (the ruling says it starts none).
  'Giant Kozaky': { effs: [
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'No Kozaky: destroy this card',
      on: (g, ev, c) => onField(c) && faceUp(c) && !fieldMons(g).some(x => faceUp(x) && named(x, 'Kozaky')),
      cond: (g, c) => onField(c) && faceUp(c) && !fieldMons(g).some(x => faceUp(x) && named(x, 'Kozaky')),
      res: function* (g, c, p) { if (onField(c) && faceUp(c) && !fieldMons(g).some(x => faceUp(x) && named(x, 'Kozaky'))) destroy(g, [c], { by: p }); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Damage to its controller',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.snap && ev.snap.faceUp,
      res: function* (g, c, p, L2) { damage(g, L2.ev.prevCtrl, baseAtk(c), { src: c, srcP: L2.ev.prevCtrl }); } }] },
  'Giant Orc': goblinLock(),
  'Giant Trap Hole': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: g => !!g.sw && !['normal', 'tribute', 'flip', 'gemini'].includes(g.sw.how) && g.sw.cs.filter(onField).length >= 2,
    res: function* (g, c, p) { destroy(g, fieldMons(g), { by: p, src: c }); } }] },
  'Gift Card': { effs: [{ type: 'act', res: function* (g, c, p) { gain(g, opp(p), 3000); } }] },
  'Gift of the Martyr': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).length >= 2 && monsOf(g, p).some(faceUp),
    cost: function* (g, c, p, L2) { const ms = monsOf(g, p); const cs = ms.filter(x => ms.some(y => y !== x && faceUp(y)));
      const [x] = yield* pick(g, p, 'Send which monster to the GY?', cs, 1, 1, 'cost'); L2.data.a = baseAtk(x); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster gains the ATK?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && L2.data.a) { addMod(g, t, { atk: L2.data.a, end: true }); log(g, `${name(t)} gained ${L2.data.a} ATK.`); } } }] },
  'Gift of The Mystical Elf': { effs: [{ type: 'act', res: function* (g, c, p) { gain(g, p, 300 * fieldMons(g).length); } }] },
  'Goblin Attack Force': goblinLock(),
  'Goblin Black Ops': goblinLock({ self: { directAttack: true } }),
  'Goblin Decoy Squad': goblinLock({ effs: [{ type: 'trig', when: true, label: 'Draw 1 card',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl, res: function* (g, c, p) { draw(g, p, 1); } }] }),
  'Goblin Elite Attack Force': goblinLock(),
  // Continuous effect: the Flip Summoned monster's own triggers are dropped, then it is destroyed. PARTIAL: uses a chain link.
  'Goblin Fan': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy the Flip Summoned monster',
      on: (g, ev, c) => { if (ev.type !== 'summon' || ev.how !== 'flip') return false; const ms = ev.cs.filter(x => lv(x) <= 2); if (!ms.length) return false; g.pend = g.pend.filter(t => !ms.includes(t.c)); return true; },
      res: function* (g, c, p, L2) { destroy(g, L2.ev.cs.filter(x => onField(x) && lv(x) <= 2), { by: p, src: c }); } }] },
  'Goblin King': { self: {
    noAttackTarget: (g, c) => monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && race(x) === 'Fiend'),
    atk: (g, c) => 1000 * fieldMons(g).filter(x => x !== c && faceUp(x) && race(x) === 'Fiend').length,
    def: (g, c) => 1000 * fieldMons(g).filter(x => x !== c && faceUp(x) && race(x) === 'Fiend').length } },
  // PARTIAL: a discard cost is read from the card's text ("Discard ...;", "by discarding").
  'Goblin of Greed': { cont: { forbid: (g, src, a) => a.type === 'activate' && a.eff && !!a.eff.cost && discardCost(a.c) } },
  'Goblin Out of the Frying Pan': { effs: [{ type: 'act', cond: (g, c, p, x) => spellTrapAct(x.top) && isSpell(x.top.c) && !x.top.negated && g.p[p].lp > 500,
    cost: function* (g, c, p) { pay(g, p, 500); },
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; T.negBy = p; negate(g, T, false); if (onField(T.c)) { move(g, T.c, 'hand', { reason: 'effect', by: p }); log(g, `${D(T.c).n} returned to its owner's hand.`); } } }] },
  'Goblin Recon Squad': goblinLock({ effs: [{ type: 'trig', when: true, label: 'Look at a random card in their hand',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.direct && ev.src === c && ev.p !== c.ctrl,
    cond: (g, c, p) => g.p[opp(p)].hand.length > 0,
    res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; log(g, `${PN(g, p)} looked at ${name(x)} in ${PN(g, opp(p))}'s hand.`);
      if (isSpell(x)) { move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${name(x)} was sent to the GY.`); } } }] }),
  'Goblin Thief': { effs: [{ type: 'act', res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); gain(g, p, 500); } }] },
  'Graceful Charity': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 3,
    res: function* (g, c, p) { draw(g, p, 3); yield* discardPick(g, p, 2, 'Discard 2 cards'); } }] },
  'Graceful Dice': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).length > 0,
    res: function* (g, c, p) { const n = dice(g, p) * 100; for (const m of monsOf(g, p)) addMod(g, m, { atk: n, def: n, end: true }); if (monsOf(g, p).length) log(g, `${PN(g, p)}'s monsters gained ${n} ATK and DEF.`); } }] },
  'Graceful Revival': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && lv(x) <= 2),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Level 2 or lower monster?', g.p[p].gy.filter(x => isMon(x) && lv(x) <= 2), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && onField(c) && ss(g, p, t, 'atk')) link(g, c, t); } }] },
});
})();
