/* Full pool batch 44: Shattered Axe to Survival Instinct (build/batches/full/full-44.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, negate, addMod, equip, equippedTo,
  addCtr, ctr, negateAttack, addRule, tokens, dice, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv,
  baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp,
  oppFaceUp, stOnField, spellTrapAct, evSummoned, fromFieldToGY, emit, forbid, negd, num } = L;
const atk = L.atk;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
const flip = (label, more) => ({ type: 'trig', mand: true, faceDownOk: true, label, on: (g, ev, c) => ev.type === 'flip' && ev.c === c, ...more });
const isTuner = c => !!(D(c).tu || c.flags.f41tuner);
const toBottom = (g, x) => { move(g, x, 'deckTop', { reason: 'effect' }); const d = g.p[x.owner].deck; const i = d.indexOf(x); if (i >= 0) { d.splice(i, 1); d.unshift(x); } };
const setPos = (g, c, pos) => { if (!onField(c) || c.zone !== 'm' || c.pos === pos) return false; const from = c.pos; c.pos = pos; g.seq++; log(g, `${name(c)} was changed to ${pos === 'atk' ? 'Attack' : 'Defense'} Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from }); return true; };
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) equip(g, c, t); } });
// "by an effect of a card controlled by your opponent" (as full-39.js): the move's own `by` when given, else the turn player.
const byOpp = (g, ev, c) => ev.by != null ? ev.by !== c.owner : g.tp !== c.owner;
// Dark World: discarded from the hand to the GY by a card effect (as full-39.js). The hand size limit doesn't count.
const dwDiscard = (g, ev, c) => {
  if (!(ev.type === 'move' && ev.c === c && ev.from === 'hand' && ev.to === 'gy' && ['discard', 'cost'].includes(ev.reason))) return false;
  if (g.phase === 'end' && ev.by == null && g.tp === c.owner && g.p[c.owner].hand.length >= 6 && !g.chain.length) return false;
  return true; };
// once per turn, it can't be destroyed by battle (Sphere of Chaos, Stardust Xiaolong)
const oncePerTurnBattle = { replaceDestroy: (g, c, o) => { if (!o.battle || c.flags.f44bt === g.turnNo) return false; c.flags.f44bt = g.turnNo; log(g, `${name(c)} was not destroyed by battle.`); return true; } };
// Trap Monsters (as batch-7.js). PARTIAL: as a monster it has no Type/Attribute (ENGINE: no Attribute/Type override).
function trapMonster(g, c, p, st) {
  if (!onField(c) || freeM(g, p) < 0) return false;
  if (!ss(g, p, c, 'def')) return false;
  c.flags.baseAtk = st.atk; c.flags.lv = st.lv; c.flags.trapMon = true; addMod(g, c, { set: st.def, which: 'def' });
  return true;
}
// Synchro Summon with a named Tuner (as full-41.js; Sun Dragon Inti needs "Fire Ant Ascator")
function synMats(g, p, sx, tunerOk) {
  const mons = monsOf(g, p).filter(faceUp), out = [], Lv = num(D(sx).lv);
  for (let mask = 1; mask < (1 << mons.length) && out.length < 12; mask++) {
    const mats = mons.filter((_, i) => mask & (1 << i)); if (mats.length < 2) continue;
    if (mats.reduce((s, c) => s + lv(c), 0) !== Lv) continue;
    if (mats.some(t => isTuner(t) && tunerOk(t) && mats.filter(x => x !== t).every(x => !isTuner(x)))) out.push(mats);
  }
  return out;
}
const synProc = tunerOk => ({ extra: true, how: 'synchro', label: 'Synchro Summon',
  cond: (g, c, p) => synMats(g, p, c, tunerOk).length > 0,
  cost: function* (g, c, p, grp) { const cs = synMats(g, p, c, tunerOk); let mats = cs[0];
    if (cs.length > 1) { const i = yield* choose(g, p, `Synchro Summon ${name(c)} with which monsters?`, cs.map(m => m.map(name).join(' + '))); mats = cs[i]; }
    for (const m of mats) move(g, m, 'gy', { reason: 'synchro', by: p, group: grp });
    log(g, `${PN(g, p)} sent ${mats.map(m => D(m).n).join(' + ')} to the GY for a Synchro Summon.`); } });

/* "Cannot be Special Summoned" and "Must be Special Summoned (from your hand) by its own rule".
 ENGINE: no general "can't be Special Summoned" flag, so one duel-long rule is installed by the first event any of these cards sees.
 PARTIAL: an effect that Special Summons one of the hand-only monsters from the hand is not stopped. */
const LOCKS = {
  'Simorgh, Bird of Divinity': () => true,
  'Sky Scourge Invicil': () => true,
  'Sky Scourge Enrise': a => a.c.zone !== 'hand',
  // once properly summoned it may come back from the GY or banished pile (rulings)
  'Supersonic Skull Flame': a => a.c.zone !== 'hand' && !(['gy', 'ban'].includes(a.c.zone) && a.c.f44nomi),
};
// Simorgh, Bird of Divinity: enough face-up WIND monsters to Tribute (1 while a face-up Simorgh, Bird of Ancestry lowers the cost)
const divinityTributes = (g, p) => { const need = allField(g).some(x => x.zone === 'm' && faceUp(x) && named(x, 'Simorgh, Bird of Ancestry') && !negd(g, x)) ? 1 : 2; return monsOf(g, p).filter(x => faceUp(x) && attr(x) === 'WIND').length >= need; };
// Sky Scourge Invicil: mark Spell/Trap chain links negated while a face-up Invicil with that effect applies (not GY effects).
function invicilScan(g) {
  if (!g.chain || !g.chain.length) return;
  const invs = fieldMons(g).filter(x => faceUp(x) && named(x, 'Sky Scourge Invicil') && x.flags.f44inv && !negd(g, x));
  const sp = invs.some(x => x.flags.f44inv.sp), tr = invs.some(x => x.flags.f44inv.tr);
  for (const L2 of g.chain) {
    if (L2.eff.loc === 'gy' || !isST(L2.c)) continue;
    const hit = (sp && isSpell(L2.c)) || (tr && isTrap(L2.c));
    if (hit && !L2.negated) { L2.negated = true; L2.f44inv = true; log(g, `Sky Scourge Invicil negates the effect of ${name(L2.c)}.`); }
    else if (!hit && L2.f44inv) { L2.negated = false; L2.f44inv = false; }
  }
}
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: (g, ev, c) => {
    if (!g.f44lock) { g.f44lock = true; addRule(g, (g2, a) => {
      if (!a.c || !a.c.id) return false; const d = D(a.c);
      if (a.type === 'ns' && d && d.n === 'Simorgh, Bird of Divinity') return !divinityTributes(g2, a.p);
      if (a.type !== 'ss') return false; const f = d && LOCKS[d.n]; return !!f && f(a); }); }
    if (ev.type === 'summon' && ev.cs.includes(c) && c.flags.f44proc) c.f44nomi = true;
    return false; } };

// Shining Silver Force: a Trap whose text inflicts damage (battle damage shifts like Dimension Wall don't count).
// PARTIAL: read from the text, so a card that only might inflict damage (The Paths of Destiny) or inflicts it later
// (Skull Invitation) also counts.
const trapDealsDamage = c => { const t = (D(c).ps || D(c).tx || '').replace(/battle damage/gi, ''); return /inflict[^.]*damage|takes? [^.]*damage/i.test(t); };

// Supernatural Regeneration: Psychic monsters sent to any GY this turn, counted by every copy in the duel (any zone) and
// kept once per event.
const psyCount = { type: 'trig', loc: 'any', res: noop, on: (g, ev) => {
  if (ev.type === 'move' && ev.to === 'gy' && isMon(ev.c) && race(ev.c) === 'Psychic') {
    if (!g.f44psy || g.f44psy.turn !== g.turnNo) g.f44psy = { turn: g.turnNo, seen: {} };
    g.f44psy.seen[ev.seq] = true;
  }
  return false; } };
const psyThisTurn = g => g.f44psy && g.f44psy.turn === g.turnNo ? Object.keys(g.f44psy.seen).length : 0;

E.addScripts({
  // Continuous Trap: the target loses 500 ATK in each of your Standby Phases; destroyed with it.
  'Shattered Axe': { effs: [
    { type: 'act', cond: g => fieldMons(g).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c)) { c.flags.f44axe = t.u; g.seq++; log(g, `Shattered Axe targets ${name(t)}.`); } } },
    { type: 'trig', loc: 'st', mand: true, label: 'The target loses 500 ATK',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && !!c.flags.f44axe && fieldMons(g).some(m => m.u === c.flags.f44axe && faceUp(m)),
      res: function* (g, c) { const t = fieldMons(g).find(m => m.u === c.flags.f44axe); if (t && faceUp(t) && onField(c)) { addMod(g, t, { atk: -500 }); log(g, `${name(t)} lost 500 ATK.`); } } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy Shattered Axe',
      on: (g, ev, c) => ev.type === 'move' && !!c.flags.f44axe && ev.c.u === c.flags.f44axe && ev.wasField && ev.destroyed,
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  // Mandatory: any card on the field destroyed by battle or a card effect sends this face-up card back to the hand.
  'Shiba-Warrior Taro': { self: { noBattleDestroy: true },
    effs: [{ type: 'trig', mand: true, label: 'Return to the hand',
      on: (g, ev, c) => ev.type === 'move' && ev.c !== c && ev.wasField && ev.destroyed && faceUp(c),
      res: function* (g, c) { if (onField(c) && faceUp(c)) { move(g, c, 'hand', { reason: 'effect' }); log(g, `${D(c).n} returned to the hand.`); } } }] },
  'Shine Palace': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 700 : 0 },
    effs: [equipAct(m => attr(m) === 'LIGHT', 'Equip to which LIGHT monster?')] },
  'Shining Silver Force': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p, x) => spellTrapAct(x.top) && isTrap(x.top.c) && x.top.p !== p && !x.top.negated && trapDealsDamage(x.top.c),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; if (T && !T.negated) { T.negBy = p; negate(g, T, true); }
      const xs = stOf(g, opp(p)).filter(faceUp); if (xs.length) destroy(g, xs, { by: p, src: c }); } }] },
  // Quick Effect in the GY: exactly 1 Synchro Monster Special Summoned to the opponent's field. Banishing itself is the cost.
  'Shiny Black C': { effs: [{ type: 'quick', loc: 'gy', tags: { destroy: 1 }, label: 'Banish: destroy the Synchro Monster',
    cond: (g, c, p) => !!g.sw && g.sw.p !== p && !['normal', 'tribute', 'flip', 'gemini'].includes(g.sw.how) && g.sw.cs.length === 1 && D(g.sw.cs[0]).k === 'synchro' && onField(g.sw.cs[0]) && faceUp(g.sw.cs[0]) && g.sw.cs[0].ctrl !== p,
    cost: function* (g, c, p, L2) { L2.data.t = g.sw.cs[0]; move(g, c, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished Shiny Black C.`); },
    target: function* (g, c, p, L2) { L2.t = [L2.data.t]; },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) destroy(g, [t], { by: p, src: c }); } }] },
  'Shire, Lightsworn Spirit': {
    self: { atk: (g, c) => 300 * new Set(g.p[c.ctrl].gy.filter(x => isMon(x) && /Lightsworn/.test(D(x).n)).map(x => D(x).n)).size },
    effs: [{ type: 'trig', mand: true, label: 'Send the top 2 cards of your Deck to the GY',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) mill(g, p, 2); } }] },
  'Short Circuit': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).filter(x => faceUp(x) && /Batteryman/.test(name(x))).length >= 3 && fieldOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { destroy(g, fieldOf(g, opp(p)), { by: p, src: c }); } }] },
  // Sending the Machine is the cost; the target's Level must be at most the sent monster's Level.
  'Shreddder': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Send a Machine: destroy a monster',
    cond: (g, c, p) => g.p[p].hand.some(x => isMon(x) && race(x) === 'Machine' && oppFaceUp(g, p).some(t => lv(t) <= lv(x))),
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Send which Machine monster from your hand to the GY?', g.p[p].hand.filter(x => isMon(x) && race(x) === 'Machine' && oppFaceUp(g, p).some(t => lv(t) <= lv(x))), 1, 1, 'cost');
      L2.data.lv = lv(x); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} (Level ${L2.data.lv}) to the GY.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, `Destroy which Level ${L2.data.lv} or lower monster?`, oppFaceUp(g, p).filter(t => lv(t) <= L2.data.lv), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) destroy(g, [t], { by: p, src: c }); } }] },
  // Once per turn, one of the two (the banish is a cost; the second targets a banished Zombie).
  'Shutendoji': { effs: [{ type: 'ign', opt: true, label: 'Draw, or return a banished Zombie',
    cond: (g, c, p) => (g.p[p].gy.filter(x => isMon(x) && race(x) === 'Zombie').length >= 2 && g.p[p].deck.length > 0) || g.p[p].ban.some(x => isMon(x) && race(x) === 'Zombie'),
    cost: function* (g, c, p, L2) {
      const a = g.p[p].gy.filter(x => isMon(x) && race(x) === 'Zombie').length >= 2 && g.p[p].deck.length > 0, b = g.p[p].ban.some(x => isMon(x) && race(x) === 'Zombie');
      const m = a && b ? yield* choose(g, p, 'Shutendoji: which effect?', ['Banish 2 Zombies from your GY: draw 1 card', 'Place a banished Zombie on top of your Deck']) : a ? 0 : 1;
      L2.data.m = m;
      if (m === 0) { const xs = yield* pick(g, p, 'Banish which 2 Zombie monsters from your GY?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Zombie'), 2, 2, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${xs.map(x => D(x).n).join(' and ')}.`); } },
    target: function* (g, c, p, L2) { if (L2.data.m === 1) yield* tgt(g, p, L2, 'Place which banished Zombie on top of your Deck?', g.p[p].ban.filter(x => isMon(x) && race(x) === 'Zombie'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) {
      if (L2.data.m === 0) { draw(g, p, 1); return; }
      const t = L2.t[0]; if (t && t.zone === 'ban') { move(g, t, 'deckTop', { reason: 'effect', by: p }); log(g, `${D(t).n} was placed on top of ${PN(g, p)}'s Deck.`); } } }] },
  // Mandatory. If an opponent's card discarded it, they also put exactly 2 cards from their hand on the bottom of their Deck
  // (only after Sillva is Special Summoned, and only with 2 or more cards in hand).
  'Sillva, Warlord of Dark World': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon it',
    // Whose card discarded it is read when it happens: the resolving card's controller (some discard helpers set `by` to the
    // player who discarded, e.g. Dark World Dealings), else `by`, else the turn player. A discard paid as a cost is your own card's.
    on: (g, ev, c) => { if (!dwDiscard(g, ev, c)) return false;
      c.flags.f44opp = ev.reason === 'cost' ? false : g.resolvingL ? g.resolvingL.p !== c.owner : byOpp(g, ev, c); return true; },
    cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p, L2) {
      const byO = !!c.flags.f44opp; c.flags.f44opp = false;
      if (c.zone !== 'gy' || !ss(g, p, c, 'atk')) return;
      if (!byO) return;
      const o = opp(p), h = g.p[o].hand; if (h.length < 2) return;
      const xs = yield* pick(g, o, 'Put which 2 cards from your hand on the bottom of your Deck?', h, 2, 2, 'cost');
      for (const x of xs) toBottom(g, x); log(g, `${PN(g, o)} put 2 cards from the hand on the bottom of the Deck.`); } }] },
  // Battle: twice per turn per monster (more copies don't add). Effects: Silver Wing is destroyed instead, used automatically.
  // PARTIAL: it is also used when the same effect destroys Silver Wing too (ruling: it can't be used then).
  'Silver Wing': {
    cont: {
      replaceDestroy: (g, src, m, o) => {
        if (src.equipTo !== m.u || !onField(src) || !faceUp(src)) return false;
        if (o.battle) { const b = m.flags.f44swb && m.flags.f44swb.t === g.turnNo ? m.flags.f44swb : (m.flags.f44swb = { t: g.turnNo, n: 0 }); if (b.n >= 2) return false; b.n++; log(g, `${name(m)} was not destroyed by battle (Silver Wing).`); return true; }
        if (src.f44used === g.seq) return false; src.f44used = g.seq;
        g.laterDestroy.push(src); log(g, `Silver Wing was destroyed instead of ${name(m)}.`); return true; } },
    effs: [equipAct(m => D(m).k === 'synchro' && race(m) === 'Dragon' && lv(m) >= 8, 'Equip to which Level 8 or higher Dragon Synchro Monster?')] },
  // Both players' WIND monsters need 1 less Tribute while it is face-up. Treated as a Normal Monster in the hand (no effect
  // in the engine needs that). Tribute Summoned with only WIND Tributes: return up to 2 of the opponent's cards (targets).
  'Simorgh, Bird of Ancestry': {
    cont: { tributes: (g, s, c, p, need) => !negd(g, s) && attr(c) === 'WIND' && need > 0 ? need - 1 : null },
    effs: [{ type: 'trig', mand: true, label: 'Return up to 2 cards to the hand',
      on: (g, ev, c) => evSummoned(ev, c, ['tribute']) && (ev.tribs || []).length > 0 && ev.tribs.every(t => attr(t) === 'WIND'),
      cond: (g, c, p) => fieldOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which 1 or 2 of their cards to the hand?', fieldOf(g, opp(p)), 1, 2, 'bad'); },
      res: function* (g, c, p, L2) { const xs = live(L2); for (const x of xs) move(g, x, 'hand', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.map(x => D(x).n).join(' and ')} returned to the hand.`); } }] },
  // ENGINE: no per-summon Tribute restriction, so its Tribute Summon (not its Set) is only offered while you have 2 face-up WIND monsters to
  // Tribute (PARTIAL: you can still pick others). It can't be Special Summoned (lock).
  'Simorgh, Bird of Divinity': {
    effs: [lockInstall,
      { type: 'trig', mand: true, label: 'End Phase damage',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end',
        res: function* (g, c, p, L2) { if (!onField(c) || !faceUp(c)) return; const q = L2.ev.tp; const n = 1000 - 500 * stOf(g, q).length; if (n > 0) damage(g, q, n, { src: c, srcP: p }); } }] },
  'Simultaneous Loss': { effs: [{ type: 'act', res: function* (g, c, p) { mill(g, p, 1); mill(g, opp(p), 1); } }] },
  'Six Scrolls of the Samurai': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).filter(x => faceUp(x) && /Six Samurai/.test(name(x))).length >= 2 && g.p[p].deck.some(x => named(x, 'Great Shogun Shien')),
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Tribute which 2 face-up Six Samurai monsters?', monsOf(g, p).filter(x => faceUp(x) && /Six Samurai/.test(name(x))), 2, 2, 'cost');
      for (const x of xs) move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${xs.map(x => D(x).n).join(' and ')}.`); },
    res: function* (g, c, p) { if (freeM(g, p) < 0) return; const x = g.p[p].deck.find(y => named(y, 'Great Shogun Shien')); if (x && canSS(g, p, x)) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  'Skelengel': { effs: [flip('Draw 1 card', { res: function* (g, c, p) { draw(g, p, 1); } })] },
  'Skill Successor': { effs: [
    { type: 'act', ds: true, cond: (g, c, p) => monsOf(g, p).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which of your face-up monsters gains 400 ATK?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: 400, end: true }); log(g, `${name(t)} gained 400 ATK.`); } } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.to === 'gy') c.f44gy = g.turnNo; return false; } },
    { type: 'quick', loc: 'gy', ds: true, label: 'Banish: a monster gains 800 ATK',
      cond: (g, c, p) => g.tp === p && c.f44gy !== g.turnNo && monsOf(g, p).some(faceUp),
      cost: function* (g, c, p) { move(g, c, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished Skill Successor.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which of your face-up monsters gains 800 ATK?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: 800, end: true }); log(g, `${name(t)} gained 800 ATK.`); } } }] },
  // Activates wherever the card went (its owner's), sending as many as there are, up to 2.
  'Skreech': { effs: [{ type: 'trig', loc: 'any', mand: true, label: 'Send 2 WATER monsters from your Deck to the GY',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed,
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isMon(x) && attr(x) === 'WATER'); if (!cs.length) return; const n = Math.min(2, cs.length);
      const xs = yield* pick(g, p, `Send which ${n} WATER monster${n > 1 ? 's' : ''} from your Deck to the GY?`, cs, n, n, 'good');
      for (const x of xs) move(g, x, 'gy', { reason: 'effect', by: p }); shuffleDeck(g, p); log(g, `${PN(g, p)} sent ${xs.map(x => D(x).n).join(' and ')} from the Deck to the GY.`); } }] },
  'Sky Scourge Enrise': {
    self: { cantAttack: (g, c) => c.flags.f44noatk === g.turnNo },
    proc: { label: 'Special Summon (banish 3 LIGHT Fairies and 1 DARK Fiend)',
      cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT' && race(x) === 'Fairy').length >= 3 && g.p[p].gy.some(x => isMon(x) && attr(x) === 'DARK' && race(x) === 'Fiend'),
      cost: function* (g, c, p, grp) {
        const a = yield* pick(g, p, 'Banish which 3 LIGHT Fairy monsters from your GY?', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT' && race(x) === 'Fairy'), 3, 3, 'cost');
        const [b] = yield* pick(g, p, 'Banish which DARK Fiend monster from your GY?', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK' && race(x) === 'Fiend'), 1, 1, 'cost');
        for (const x of [...a, b]) move(g, x, 'ban', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} banished ${[...a, b].map(x => D(x).n).join(', ')}.`); } },
    effs: [lockInstall, { type: 'ign', opt: true, label: 'Banish a face-up monster',
      cond: (g, c) => !c.attacks && fieldMons(g).some(x => x !== c && faceUp(x)),
      cost: function* (g, c) { c.flags.f44noatk = g.turnNo; },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which face-up monster?', fieldMons(g).filter(x => x !== c && faceUp(x)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished.`); } } }] },
  // The effect is noted when it is Tribute Summoned (not Set) with a LIGHT Fairy and/or DARK Fiend Tribute.
  // Lasting effects of face-up Spells/Traps are negated through cont.negates. Effects on the chain (a Normal Spell, a Trap's
  // activation) are negated by a chain scan run from the response menus (as Imperial Order in full-23.js): every Spell/Trap
  // link not activated in the GY is marked negated while Invicil applies, and unmarked if it stops applying before resolving.
  // ENGINE: no hook when a link is added; the scan runs in each response window, which always follows a new link.
  'Sky Scourge Invicil': {
    cont: { negates: (g, src, x) => !src.flags.negated && !!src.flags.f44inv && ((src.flags.f44inv.sp && isSpell(x)) || (src.flags.f44inv.tr && isTrap(x))) },
    effs: [lockInstall,
      { type: 'quick', speed: 3, ds: true, negSummon: true, label: 'Check the chain', cond: g => { invicilScan(g); return false; }, res: noop },
      { type: 'trig', loc: 'any', res: noop, on: g => { invicilScan(g); return false; } }, { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (evSummoned(ev, c, ['tribute'])) {
        const ts = ev.tribs || [];
        const sp = ts.some(t => attr(t) === 'LIGHT' && race(t) === 'Fairy'), tr = ts.some(t => attr(t) === 'DARK' && race(t) === 'Fiend');
        if (sp || tr) { c.flags.f44inv = { sp, tr }; g.seq++; log(g, `Sky Scourge Invicil negates the effects of all ${sp && tr ? 'Spell and Trap' : sp ? 'Spell' : 'Trap'} Cards.`); }
      }
      return false; } }] },
  // Negates the attack and banishes the attack target until the next Standby Phase (it comes back in the same position, not
  // as a summon).
  'Slip of Fortune': { effs: [
    { type: 'act', cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && !!g.aw.t && onField(g.aw.t),
      target: function* (g, c, p, L2) { L2.t = [g.aw.t, g.aw.a]; L2.data.t = g.aw.t; },
      res: function* (g, c, p, L2) {
        negateAttack(g); const t = L2.data.t; if (!t || !onField(t) || t.zone !== 'm') return;
        const rec = { u: t.u, owner: t.owner, pos: t.pos, turn: g.turnNo };
        move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished until the next Standby Phase.`);
        (c.f44slip || (c.f44slip = [])).push(rec); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return the banished monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && !!c.f44slip && c.f44slip.some(r => r.turn < g.turnNo),
      res: function* (g, c) {
        const due = c.f44slip.filter(r => r.turn < g.turnNo); c.f44slip = c.f44slip.filter(r => r.turn >= g.turnNo);
        for (const r of due) { const x = g.p[r.owner].ban.find(y => y.u === r.u); if (!x || freeM(g, r.owner) < 0) continue;
          move(g, x, 'm', { ctrl: r.owner, pos: r.pos, reason: 'effect' }); log(g, `${r.pos === 'set' ? 'A face-down monster' : D(x).n} returned to the field.`); } } }] },
  // The summoned monster returns to the hand in this turn's End Phase (a monster unaffected by Traps stays).
  'Slip Summon': { effs: [
    { type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => !!g.sw && g.sw.p !== p && freeM(g, p) >= 0 && g.p[p].hand.some(x => x !== c && isMon(x) && lv(x) <= 4 && D(x).k !== 'ritual' && canSS(g, p, x)),
      res: function* (g, c, p) { if (freeM(g, p) < 0) return; const cs = g.p[p].hand.filter(x => isMon(x) && lv(x) <= 4 && D(x).k !== 'ritual' && canSS(g, p, x)); if (!cs.length) return;
        const [x] = yield* pick(g, p, 'Special Summon which Level 4 or lower monster in Defense Position?', cs, 1, 1, 'good');
        if (x && ss(g, p, x, 'def')) { x.flags.f44slip = true; (c.f44ss || (c.f44ss = [])).push({ u: x.u, turn: g.turnNo }); } } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return the monster to the hand',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!c.f44ss && c.f44ss.some(r => r.turn === g.turnNo),
      res: function* (g, c) {
        const us = c.f44ss.filter(r => r.turn === g.turnNo).map(r => r.u); c.f44ss = c.f44ss.filter(r => r.turn > g.turnNo);
        for (const x of fieldMons(g).filter(m => us.includes(m.u) && m.flags.f44slip && !(faceUp(m) && has(g, m, 'unaffectedTraps')))) { move(g, x, 'hand', { reason: 'effect' }); log(g, `${D(x).n} returned to the hand.`); } } }] },
  'Small Piece Golem': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon Medium Piece Golem',
    on: (g, ev, c) => evSummoned(ev, c),
    cond: (g, c, p) => freeM(g, p) >= 0 && monsOf(g, p).some(m => faceUp(m) && named(m, 'Big Piece Golem')) && g.p[p].deck.some(x => named(x, 'Medium Piece Golem')),
    res: function* (g, c, p) { if (freeM(g, p) < 0) return;
      const cs = g.p[p].deck.filter(x => named(x, 'Medium Piece Golem')); if (!cs.length) return; ss(g, p, cs[0], 'atk', { negate: true }); shuffleDeck(g, p); } }] },
  // Discard is the cost. Not tagged as destruction: Stardust Dragon can't negate it (ruling).
  'Snipe Hunter': { effs: [{ type: 'ign', label: 'Discard: roll to destroy a card',
    cond: (g, c, p) => g.p[p].hand.length > 0 && allField(g).some(x => x !== c),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard which card?', g.p[p].hand, 1, 1, 'cost'); move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${D(x).n}.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which card?', allField(g).filter(x => x !== c), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const n = dice(g, p); const t = live(L2)[0]; if (!t) return; if (n === 1 || n === 6) { log(g, 'Nothing happens.'); return; } destroy(g, [t], { by: p, src: c }); } }] },
  // Targets a face-up Fortune Lady (Level 3 or more) and another face-up monster. PARTIAL: a Level 3 Fortune Lady stays Level 1
  // (the engine can't show Level 0).
  'Solitaire Magician': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Lower a Fortune Lady\'s Level: destroy a monster',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && /^Fortune Lady/.test(name(x)) && lv(x) >= 3 && fieldMons(g).some(y => y !== x && faceUp(y))),
    target: function* (g, c, p, L2) {
      const [f] = yield* pick(g, p, 'Target which Fortune Lady?', monsOf(g, p).filter(x => faceUp(x) && /^Fortune Lady/.test(name(x)) && lv(x) >= 3 && fieldMons(g).some(y => y !== x && faceUp(y))), 1, 1, 'good');
      const [o] = yield* pick(g, p, 'Destroy which other face-up monster?', fieldMons(g).filter(y => y !== f && faceUp(y)), 1, 1, 'bad');
      L2.t = [f, o]; L2.data.f = f; L2.data.o = o; },
    res: function* (g, c, p, L2) { const f = L2.data.f, o = L2.data.o; if (!f || !onField(f) || !faceUp(f)) return;
      f.flags.lv = Math.max(1, lv(f) - 3); g.seq++; log(g, `${name(f)} is now Level ${lv(f)}.`);
      if (o && onField(o) && faceUp(o)) destroy(g, [o], { by: p, src: c }); } }] },
  // Counted at resolution: each different Neo-Spacian name (Marine Dolphin also counts as Aqua Dolphin).
  'Space Gift': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && /Neo-Spacian/.test(name(x))),
    res: function* (g, c, p) { const ns = new Set(); for (const x of monsOf(g, p)) if (faceUp(x) && /Neo-Spacian/.test(name(x))) { ns.add(name(x)); if (D(x).n === 'Neo-Spacian Marine Dolphin') ns.add('Neo-Spacian Aqua Dolphin'); }
      if (ns.size) draw(g, p, ns.size); } }] },
  // Gate Counters are placed without a chain at the end of each Damage Step that involves an opponent's monster.
  'Spacegate': { effs: [actNoop,
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
      if (ev.type === 'dsEnd' && faceUp(c)) { const side = x => x && (onField(x) ? x.ctrl : x.owner); if (side(ev.a) !== c.ctrl || (ev.t && side(ev.t) !== c.ctrl)) { addCtr(g, c, 'gate', 1); g.seq++; log(g, `Spacegate has ${ctr(c, 'gate')} Gate Counter${ctr(c, 'gate') > 1 ? 's' : ''}.`); } }
      return false; } },
    { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Send it: Special Summon a monster from your hand',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && D(x).k !== 'ritual' && lv(x) <= ctr(c, 'gate') && canSS(g, p, x)),
      cost: function* (g, c, p, L2) { L2.data.n = ctr(c, 'gate'); move(g, c, 'gy', { reason: 'cost', by: p }); },
      res: function* (g, c, p, L2) { if (freeM(g, p) < 0) return; const cs = g.p[p].hand.filter(x => isMon(x) && D(x).k !== 'ritual' && lv(x) <= L2.data.n && canSS(g, p, x)); if (!cs.length) return;
        const [x] = yield* pick(g, p, `Special Summon which Level ${L2.data.n} or lower monster?`, cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  // Main Phase ignition while equipped, any number of times; the 3rd use destroys it after it resolves.
  'Spark Blaster': {
    effs: [equipAct(m => named(m, 'Elemental HERO Sparkman'), 'Equip to which Elemental HERO Sparkman?'),
      { type: 'ign', loc: 'st', label: 'Change a monster\'s battle position',
        cond: (g, c) => !!equippedTo(g, c) && fieldMons(g).some(faceUp),
        target: function* (g, c, p, L2) { c.flags.f44n = (c.flags.f44n || 0) + 1; L2.data.n = c.flags.f44n; yield* tgt(g, p, L2, 'Change the position of which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) setPos(g, t, t.pos === 'atk' ? 'def' : 'atk');
          if (L2.data.n >= 3 && onField(c)) destroy(g, [c], { by: p }); } }] },
  // Once per Battle Phase, the turn it was Normal Summoned (not in the Damage Step): ATK becomes double its original ATK
  // until the end of the Battle Phase.
  'Speed Warrior': { effs: [
    { type: 'quick', opt: true, label: 'Double its ATK',
      cond: (g, c, p) => g.phase === 'battle' && g.tp === p && !g.inDS && c.summonType === 'normal' && c.turnIn === g.turnNo,
      res: function* (g, c) { if (!onField(c) || !faceUp(c)) return; addMod(g, c, { set: 2 * baseAtk(c), which: 'atk', end: true, f44sw: true }); log(g, `${name(c)}'s ATK became ${2 * baseAtk(c)}.`); } },
    { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'bpEnd' && c.mods.some(m => m.f44sw)) { c.mods = c.mods.filter(m => !m.f44sw); g.seq++; } return false; } }] },
  // ENGINE: no Attribute override, so it stays DARK only (it should also be LIGHT on the field).
  'Sphere of Chaos': { self: oncePerTurnBattle,
    effs: [{ type: 'trig', when: true, label: 'Add a Level 3 monster', on: (g, ev, c) => evSummoned(ev, c, ['tribute']),
      cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && lv(x) === 3),
      res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && lv(x) === 3, 'Add which Level 3 monster to your hand?'); } }] },
  'Spider Egg': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && !g.aw.t && g.p[p].gy.filter(x => isMon(x) && race(x) === 'Insect').length >= 3 && nFreeM(g, p) >= 3,
    res: function* (g, c, p) { if (nFreeM(g, p) < 3) return; negateAttack(g); tokens(g, p, { n: 'Spider Token', a: 'EARTH', r: 'Insect', lv: 1, atk: 100, def: 100 }, 3, 'atk'); } }] },
  // Field Spell, no chain: an attacker goes to Defense Position at the end of the Damage Step and can't change its position until
  // the End Phase of its controller's next turn (only while this card is on the field; a face-down flip clears it).
  'Spider Web': {
    cont: { forbid: (g, src, a) => a.type === 'pos' && !!a.c && a.c.flags.f44web != null && a.c.flags.f44web >= g.turnNo },
    effs: [actNoop,
      { type: 'trig', loc: 'fz', res: noop, on: (g, ev, c) => {
        if (ev.type === 'dsEnd' && faceUp(c) && ev.a && onField(ev.a) && ev.a.zone === 'm' && ev.a.pos === 'atk') { setPos(g, ev.a, 'def'); ev.a.flags.f44web = g.turnNo + 2; }
        return false; } }] },
  // Once per turn, target a face-up Insect you control (kept as a list). Opponent's monsters that battled one are changed to
  // Defense Position at the end of the Battle Phase and stay that way while this card is face-up (no chain).
  "Spiders' Lair": {
    cont: { forbid: (g, src, a) => a.type === 'pos' && !!a.c && a.c.flags.f44lair === src.u },
    effs: [actNoop,
      { type: 'ign', loc: 'st', opt: true, label: 'Target an Insect you control',
        cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Insect' && !(c.flags.f44list || []).includes(x.u)),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which face-up Insect?', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Insect'), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c)) { (c.flags.f44list || (c.flags.f44list = [])).push(t.u); t.flags.f44lairT = c.u; g.seq++; log(g, `Spiders' Lair targets ${name(t)}.`); } } },
      { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
        const list = c.flags.f44list || [];
        const mine = x => x && onField(x) && faceUp(x) && x.ctrl === c.ctrl && list.includes(x.u) && x.flags.f44lairT === c.u;
        if (ev.type === 'dsEnd' && ev.t) { const o = mine(ev.a) ? ev.t : mine(ev.t) ? ev.a : null; if (o && onField(o) && o.ctrl !== c.ctrl) o.flags.f44lairPend = c.u; }
        if (ev.type === 'phase' && ev.ph === 'bpEnd') for (const m of monsOf(g, opp(c.ctrl))) if (m.flags.f44lairPend === c.u) { m.flags.f44lairPend = null; if (m.pos === 'atk' && setPos(g, m, 'def')) m.flags.f44lair = c.u; }
        return false; } }] },
  // ENGINE: no "can't be negated" hook for the activation and effects of your Spells and Traps.
  'Splendid Venus': { cont: {
    atk: (g, src, m) => !negd(g, src) && race(m) !== 'Fairy' ? -500 : 0,
    def: (g, src, m) => !negd(g, src) && race(m) !== 'Fairy' ? -500 : 0 } },
  // LP paid in 500s (cost, at most what the best legal monster can lose); at resolution pick a monster in your hand or a face-up
  // one you control whose Level stays 1 or more. The reduction lasts until the End Phase.
  'Star Blast': { effs: [
    { type: 'act',
      cond: (g, c, p) => { const m = Math.max(0, ...[...g.p[p].hand, ...monsOf(g, p).filter(faceUp)].filter(x => x !== c && isMon(x)).map(lv)); return m >= 2 && g.p[p].lp > 500; },
      cost: function* (g, c, p, L2) {
        const m = Math.max(...[...g.p[p].hand, ...monsOf(g, p).filter(faceUp)].filter(x => x !== c && isMon(x)).map(lv));
        const k = Math.min(m - 1, Math.floor((g.p[p].lp - 1) / 500));
        const i = k > 1 ? yield* choose(g, p, 'Star Blast: pay how much LP?', Array.from({ length: k }, (_, j) => `${500 * (j + 1)} LP (${j + 1} Level${j ? 's' : ''})`)) : 0;
        L2.data.n = i + 1; pay(g, p, 500 * L2.data.n); },
      res: function* (g, c, p, L2) { const n = L2.data.n;
        const cs = [...g.p[p].hand, ...monsOf(g, p).filter(faceUp)].filter(x => isMon(x) && lv(x) - n >= 1); if (!cs.length) { log(g, 'No monster can be chosen.'); return; }
        const [x] = yield* pick(g, p, `Reduce which monster's Level by ${n}?`, cs, 1, 1, 'good'); if (!x) return;
        x.flags.lv = lv(x) - n; x.flags.lvUntil = true; g.seq++; log(g, `${D(x).n} is Level ${lv(x)} until the End Phase.`);
        (g.f44sb || (g.f44sb = [])).push({ u: x.u, turn: g.turnNo }); } },
    // a monster still in the hand goes back to its own Level in the End Phase (the engine clears field monsters itself)
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => {
      if (ev.type === 'phase' && ev.ph === 'end' && g.f44sb && g.f44sb.length) { for (const r of g.f44sb) for (const P of g.p) for (const x of P.hand) if (x.u === r.u && x.flags.lvUntil) { x.flags.lv = null; x.flags.lvUntil = null; } g.f44sb = []; }
      return false; } }] },
  'Stardust Xiaolong': { self: oncePerTurnBattle,
    effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon it',
      on: (g, ev, c) => ev.type === 'summon' && ev.how === 'synchro' && ev.p === c.owner && ev.cs.some(x => named(x, 'Stardust Dragon')),
      cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c, 'atk'); } }] },
  // At the end of the Battle Phase in which it attacked, while you control another "roid" monster: destroy 1 Spell/Trap.
  'Stealthroid': { effs: [
    { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'attack' && ev.a === c) c.flags.f44att = g.turnNo; return false; } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a Spell or Trap',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'bpEnd' && c.flags.f44att === g.turnNo,
      cond: (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x) && /roid/.test(name(x))) && stOnField(g).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell or Trap?', stOnField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { if (!monsOf(g, p).some(x => x !== c && faceUp(x) && /roid/.test(name(x)))) return; const t = live(L2)[0]; if (t) destroy(g, [t], { by: p, src: c }); } }] },
  'Steam Gyroid': {},
  'Steamroid': { self: { atk: (g, c) => { const b = g.inDS && g.battle; if (!b || !b.t) return 0; if (b.a === c && b.t.ctrl !== c.ctrl) return 500; if (b.t === c && b.a.ctrl !== c.ctrl) return -500; return 0; } } },
  // PARTIAL: the monster goes to the GY first and is then put on top of the Deck (an optional trigger), so GY effects still see it.
  // ENGINE: no "send somewhere else instead" replacement in move().
  'Storm Caller': { effs: [
    { type: 'trig', label: 'Put the destroyed monster on top of its owner\'s Deck',
      on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && !!ev.killer && ev.killer !== c && race(ev.killer) === 'Psychic' && (onField(ev.killer) ? ev.killer.ctrl : ev.killer.owner) === c.ctrl && ev.c.owner !== c.ctrl && ev.prevCtrl !== c.ctrl,
      cond: (g, c, p, x) => x.ev.c.zone === 'gy',
      res: function* (g, c, p, L2) { const x = L2.ev.c; if (x.zone === 'gy') { move(g, x, 'deckTop', { reason: 'effect', by: p }); log(g, `${D(x).n} was put on top of ${PN(g, x.owner)}'s Deck.`); } } },
    { type: 'trig', loc: 'any', mand: true, label: 'Its controller takes damage',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !ev.battle,
      res: function* (g, c, p, L2) { damage(g, L2.ev.prevCtrl, num(D(c).atk), { src: c, srcP: opp(L2.ev.prevCtrl) }); } }] },
  // Once per turn, one of the two; your zone i faces the opponent's zone 4 - i (as full-29.js).
  'Storm Shooter': { effs: [{ type: 'ign', opt: true, label: 'Move, or bounce a card in its column',
    cond: (g, c, p) => { const i = g.p[p].m.indexOf(c); if (i < 0) return false; const M = g.p[p].m, O = g.p[opp(p)]; return (i > 0 && !M[i - 1]) || (i < 4 && !M[i + 1]) || !!O.m[4 - i] || !!O.st[4 - i]; },
    target: function* (g, c, p, L2) {
      const i = g.p[p].m.indexOf(c), M = g.p[p].m, O = g.p[opp(p)];
      const canMove = (i > 0 && !M[i - 1]) || (i < 4 && !M[i + 1]), col = [O.m[4 - i], O.st[4 - i]].filter(Boolean);
      const m = canMove && col.length ? yield* choose(g, p, 'Storm Shooter: which effect?', ['Move to an adjacent empty Monster Zone', 'Return a card in its column to the hand']) : canMove ? 0 : 1;
      L2.data.m = m; if (m === 1) yield* tgt(g, p, L2, 'Return which card to the hand?', col, 1, 1, 'bad'); },
    res: function* (g, c, p, L2) {
      if (L2.data.m === 1) { const t = live(L2)[0]; if (t) { move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${D(t).n} returned to the hand.`); } return; }
      const M = g.p[p].m, i = M.indexOf(c); if (i < 0) return; const js = [i - 1, i + 1].filter(j => j >= 0 && j < 5 && !M[j]); if (!js.length) return;
      const j = js.length > 1 ? js[yield* choose(g, p, 'Move to which zone?', js.map(j2 => j2 < i ? 'Left' : 'Right'))] : js[0];
      M[i] = null; M[j] = c; g.seq++; log(g, `${name(c)} moved to another Monster Zone.`); } }] },
  // The Tribute is a cost. The summoned monster is destroyed when this card leaves the field face-up (not if either was flipped
  // face-down first). PARTIAL: a control change doesn't count as leaving your side.
  'Storming Wynn': { effs: [
    { type: 'ign', opt: true, tags: { ss: 1 }, label: 'Tribute a WIND: Special Summon a WIND from your hand',
      cond: (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x) && attr(x) === 'WIND') && g.p[p].hand.some(x => isMon(x) && attr(x) === 'WIND' && D(x).k !== 'ritual' && canSS(g, p, x)),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which WIND monster?', monsOf(g, p).filter(x => x !== c && faceUp(x) && attr(x) === 'WIND'), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
      res: function* (g, c, p) { if (freeM(g, p) < 0) return; const cs = g.p[p].hand.filter(x => isMon(x) && attr(x) === 'WIND' && D(x).k !== 'ritual' && canSS(g, p, x)); if (!cs.length) return;
        const [x] = yield* pick(g, p, 'Special Summon which WIND monster from your hand?', cs, 1, 1, 'good');
        if (x && ss(g, p, x, 'atk')) { x.flags.f44wynn = c.u; if (onField(c) && faceUp(c)) (c.flags.f44wynnSet || (c.flags.f44wynnSet = [])).push(x.u); } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the summoned monster',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to !== 'm' && ev.snap && ev.snap.faceUp && !!ev.snap.flags.f44wynnSet && fieldMons(g).some(m => ev.snap.flags.f44wynnSet.includes(m.u) && faceUp(m) && m.flags.f44wynn === c.u),
      res: function* (g, c, p, L2) { const us = L2.ev.snap.flags.f44wynnSet; destroy(g, fieldMons(g).filter(m => us.includes(m.u) && faceUp(m) && m.flags.f44wynn === c.u), { by: p, src: c }); } }] },
  'Straight Flush': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.p[opp(p)].st.every(Boolean),
    res: function* (g, c, p) { destroy(g, g.p[opp(p)].st.filter(Boolean), { by: p, src: c }); } }] },
  'Stray Asmodian': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Both players gain 800 LP',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p) { gain(g, p, 800); gain(g, opp(p), 800); } }] },
  // +700 and piercing until the End Phase. PARTIAL: the piercing is granted from this card in the GY, so it stops if every
  // Strike Slash leaves the GY that turn.
  'Strike Slash': {
    cont: { loc: 'gy', grant: (g, src, c, flag) => flag === 'piercing' && c.flags.f44slash === g.turnNo },
    effs: [{ type: 'act', cond: (g, c, p) => !!g.aw && g.aw.a.ctrl === p,
      target: function* (g, c, p, L2) { L2.t = [g.aw.a]; },
      res: function* (g, c, p, L2) { const a = live(L2)[0]; if (!a || !faceUp(a)) return; addMod(g, a, { atk: 700, end: true }); a.flags.f44slash = g.turnNo; g.seq++; log(g, `${name(a)} gained 700 ATK and inflicts piercing damage this turn.`); } }] },
  // Not destroyed by battle with a monster that has the same ATK; Tributing a Dragon gives half its original ATK.
  'Strong Wind Dragon': {
    self: { piercing: true,
      noBattleDestroy: (g, c) => { const b = g.battle; if (!b || !b.t) return false; const o = b.a === c ? b.t : b.t === c ? b.a : null; return !!o && onField(o) && faceUp(o) && atk(g, o) === atk(g, c); } },
    effs: [{ type: 'trig', mand: true, label: 'Gain half the Tributed Dragon\'s ATK',
      on: (g, ev, c) => evSummoned(ev, c, ['tribute']) && (ev.tribs || []).some(t => race(t) === 'Dragon'),
      res: function* (g, c, p, L2) { if (!onField(c) || !faceUp(c)) return; const n = L2.ev.tribs.filter(t => race(t) === 'Dragon').reduce((s, t) => s + Math.floor(num(D(t).atk) / 2), 0);
        if (n) { addMod(g, c, { atk: n }); log(g, `${name(c)} gained ${n} ATK.`); } } }] },
  // Trap Monster (Machine/EARTH/Level 4/0/2000); +3000 ATK while you control face-up Green, Red and Yellow Gadget.
  'Stronghold the Moving Fortress': {
    self: { atk: (g, c) => ['Green Gadget', 'Red Gadget', 'Yellow Gadget'].every(n => monsOf(g, c.ctrl).some(x => faceUp(x) && named(x, n))) ? 3000 : 0 },
    effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { trapMonster(g, c, p, { atk: 0, def: 2000, lv: 4 }); } }] },
  'Submarine Frog': { self: { piercing: true } },
  // A direct attack made with its own effect (the opponent controls a monster) deals its original ATK.
  'Submarineroid': {
    self: { directAttack: true },
    cont: { dmg: (g, src, p, n, o) => o.battle && o.direct && o.src === src && src.flags.f44sub === g.turnNo && !negd(g, src) ? baseAtk(src) : undefined },
    effs: [
      { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'attack' && ev.a === c) c.flags.f44sub = ev.direct && monsOf(g, opp(c.ctrl)).length > 0 ? g.turnNo : null; return false; } },
      { type: 'trig', label: 'Change to Defense Position',
        on: (g, ev, c) => ev.type === 'dsEnd' && (ev.a === c || ev.t === c) && onField(c) && c.pos === 'atk',
        res: function* (g, c) { if (onField(c) && c.pos === 'atk') setPos(g, c, 'def'); } }] },
  'Success Probability 0%': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[opp(p)].extra.some(x => D(x).k === 'fusion'),
    res: function* (g, c, p) { const fs = g.p[opp(p)].extra.filter(x => D(x).k === 'fusion').slice(); const out = [];
      for (let i = 0; i < 2 && fs.length; i++) out.push(fs.splice(Math.floor(g.rnd() * fs.length), 1)[0]);
      for (const x of out) move(g, x, 'gy', { reason: 'effect', by: p }); if (out.length) log(g, `${out.map(x => D(x).n).join(' and ')} went from the Extra Deck to the GY.`); } }] },
  "Summoner's Art": { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].deck.some(x => D(x).k === 'normal' && lv(x) >= 5),
    res: function* (g, c, p) { yield* search(g, p, x => D(x).k === 'normal' && lv(x) >= 5, 'Add which Level 5 or higher Normal Monster?'); } }] },
  // Synchro Summoned with "Fire Ant Ascator" as the Tuner (as Moon Dragon Quilla with Supay in full-41.js).
  'Sun Dragon Inti': { noSynchro: true, proc: synProc(t => named(t, 'Fire Ant Ascator')),
    effs: [
      { type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy the monster that destroyed it',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy' && !!ev.killer,
        res: function* (g, c, p, L2) { const k = L2.ev.killer; if (!k || !onField(k) || k.zone !== 'm') return; const A = faceUp(k) ? atk(g, k) : 0;
          if (destroy(g, [k], { by: p, src: c }).length) damage(g, opp(p), Math.floor(A / 2), { src: c, srcP: p }); } },
      // destroyed on the field: in the next turn's Standby Phase, wherever it is now
      { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed) c.f44inti = g.turnNo; return false; } },
      { type: 'trig', loc: 'any', tags: { ss: 1 }, label: 'Special Summon Moon Dragon Quilla',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && c.f44inti === g.turnNo - 1,
        cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, 'Moon Dragon Quilla') && canSS(g, p, x)),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Moon Dragon Quilla?', g.p[p].gy.filter(x => named(x, 'Moon Dragon Quilla') && canSS(g, p, x)), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  'Sunlight Unicorn': { effs: [{ type: 'ign', opt: true, label: 'Excavate the top card',
    cond: (g, c, p) => g.p[p].deck.length > 0,
    res: function* (g, c, p) { const d = g.p[p].deck, x = d[d.length - 1]; if (!x) return; log(g, `${PN(g, p)} excavated ${D(x).n}.`);
      if (isSpell(x) && D(x).sub === 'Equip') { move(g, x, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} added ${D(x).n} to the hand.`); }
      else { toBottom(g, x); log(g, `${D(x).n} went to the bottom of the Deck.`); } } }] },
  // Sent to the GY as material for a LIGHT Synchro Monster that was Synchro Summoned (after the summon succeeds).
  'Sunny Pixie': { effs: [
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.reason === 'synchro' && ev.to === 'gy') c.f44pix = ev.group; return false; } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Gain 1000 LP',
      on: (g, ev, c) => ev.type === 'summon' && ev.how === 'synchro' && c.f44pix != null && ev.group === c.f44pix && ev.cs.some(x => attr(x) === 'LIGHT'),
      res: function* (g, c, p) { c.f44pix = null; gain(g, p, 1000); } }] },
  // Sent from the field to the GY by a card effect: you can Special Summon Oracle of the Sun from the Deck with double ATK;
  // it returns to the hand in this turn's End Phase.
  'Supay': { effs: [
    { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon Oracle of the Sun',
      on: (g, ev, c) => fromFieldToGY(ev, c) && ev.reason === 'effect',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => named(x, 'Oracle of the Sun') && canSS(g, p, x)),
      res: function* (g, c, p) { if (freeM(g, p) < 0) return; const x = g.p[p].deck.find(y => named(y, 'Oracle of the Sun') && canSS(g, p, y)); if (!x) return;
        if (ss(g, p, x, 'atk')) { const A = atk(g, x); addMod(g, x, { atk: A }); x.flags.f44supay = g.turnNo; log(g, `${name(x)}'s ATK was doubled.`); (c.f44sup || (c.f44sup = [])).push({ u: x.u, turn: g.turnNo }); }
        shuffleDeck(g, p); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return Oracle of the Sun to the hand',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!c.f44sup && c.f44sup.some(r => r.turn === g.turnNo),
      res: function* (g, c) { const us = c.f44sup.filter(r => r.turn === g.turnNo).map(r => r.u); c.f44sup = c.f44sup.filter(r => r.turn > g.turnNo);
        for (const x of fieldMons(g).filter(m => us.includes(m.u) && m.flags.f44supay === g.turnNo)) { move(g, x, 'hand', { reason: 'effect' }); log(g, `${D(x).n} returned to the hand.`); } } }] },
  'Supercharge': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && monsOf(g, p).length > 0 && monsOf(g, p).every(x => faceUp(x) && race(x) === 'Machine' && /roid/.test(name(x))) && g.p[p].deck.length >= 2,
    res: function* (g, c, p) { draw(g, p, 2); } }] },
  'Supernatural Regeneration': { effs: [psyCount,
    { type: 'act', cond: g => g.phase === 'end' && psyThisTurn(g) > 0,
      res: function* (g, c, p) { const n = psyThisTurn(g); if (n) gain(g, p, 1000 * n); } }] },
  'Supersonic Skull Flame': {
    proc: { label: 'Special Summon (banish Skull Flame from your GY)',
      cond: (g, c, p) => g.p[p].gy.some(x => named(x, 'Skull Flame')),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish which Skull Flame from your GY?', g.p[p].gy.filter(x => named(x, 'Skull Flame')), 1, 1, 'cost');
        move(g, x, 'ban', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} banished Skull Flame.`); c.flags.f44proc = true; } },
    effs: [lockInstall,
      { type: 'ign', opt: true, label: 'Burn 400 for each Burning Skull Head',
        cond: (g, c, p) => g.p[p].gy.some(x => named(x, 'Burning Skull Head')),
        res: function* (g, c, p) { const n = g.p[p].gy.filter(x => named(x, 'Burning Skull Head')).length; if (n) damage(g, opp(p), 400 * n, { src: c, srcP: p }); } },
      { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon Skull Flame',
        on: (g, ev, c) => fromFieldToGY(ev, c),
        cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, 'Skull Flame') && canSS(g, p, x)),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Skull Flame?', g.p[p].gy.filter(x => named(x, 'Skull Flame') && canSS(g, p, x)), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  // Compared when it is activated.
  'Supremacy Berry': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp !== g.p[opp(p)].lp,
    target: function* (g, c, p, L2) { L2.data.low = g.p[p].lp < g.p[opp(p)].lp; },
    res: function* (g, c, p, L2) { if (L2.data.low) gain(g, p, 2000); else damage(g, p, 1000, { src: c, srcP: p }); } }] },
  // Banishing is the cost (1 or more); 400 LP for each.
  'Survival Instinct': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && race(x) === 'Dinosaur'),
    cost: function* (g, c, p, L2) { const cs = g.p[p].gy.filter(x => isMon(x) && race(x) === 'Dinosaur');
      const xs = yield* pick(g, p, 'Banish which Dinosaur monsters from your GY?', cs, 1, cs.length, 'good'); for (const x of xs) move(g, x, 'ban', { reason: 'cost', by: p });
      L2.data.n = xs.length; log(g, `${PN(g, p)} banished ${xs.length} Dinosaur monster${xs.length > 1 ? 's' : ''}.`); },
    res: function* (g, c, p, L2) { gain(g, p, 400 * (L2.data.n || 0)); } }] },
});
})();
