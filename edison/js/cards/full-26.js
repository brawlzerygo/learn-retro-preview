/* Full pool batch 26: Physical Double to Sacred Phoenix of Nephthys (build/batches/full/full-26.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings.
 Cards with a Goat-only script elsewhere (Pinch Hopper, Polymerization, Premature Burial, Protector of the Sanctuary,
 Pumpking, Punished Eagle, Rabid Horseman, Raigeki, Reaper of the Cards, Reasoning, Reckless Greed, Reflect Bounder,
 Regenerating Mummy, Reload, Remove Trap, Reversal Quiz, Roaring Ocean Snake, Robbin' Goblin, Rope of Life,
 Roulette Barrel, Sacred Crane) are ported here as the shared version; the Goat-only ones still win under Goat. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, takeControl, setFaceDown, negate, addMod,
  equip, addRule, tokens, fusionRecipe, dice, name, D, isMon, isST, isSpell, isTrap, isExtraD, onField, faceUp, attr, race, lv,
  baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp,
  oppFaceUp, stOnField, spellTrapAct, evSummoned, fromFieldToGY, emit, forbid, stat, negd, num } = L;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'atk' }); };
function toBottom(g, x) { move(g, x, 'deckTop', { reason: 'effect' }); const d = g.p[x.owner].deck; const i = d.indexOf(x); if (i >= 0) { d.splice(i, 1); d.unshift(x); } }
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
// Equip Spells: target a face-up monster that passes filter, equip it at resolution
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) equip(g, c, t); } });
// The engine lets a monster attack directly when every monster of the opponent "can't be attacked". By the rules it can't
// attack at all then (unless it can attack directly). Prickle Fairy and Raregold Armor add that check while they apply.
const noTargetLeft = (g, q) => monsOf(g, q).length > 0 && monsOf(g, q).every(m => faceUp(m) && has(g, m, 'noAttackTarget'));
const attackLock = (g, src, a) => a.type === 'attack' && a.c && a.c.ctrl !== src.ctrl && noTargetLeft(g, src.ctrl) && !has(g, a.c, 'directAttack');
// "by an effect of a card controlled by your opponent" (same as goat-6.js): the move's own `by` when given, else the turn player.
// PARTIAL: an opponent's Quick Effect on your own turn without `by` is missed.
const byOpp = (g, ev, c) => ev.by != null ? ev.by !== c.owner : g.tp !== c.owner;
const sentByOpp = (g, ev, c, froms) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && froms.includes(ev.from) && ['effect', 'discard'].includes(ev.reason) && byOpp(g, ev, c);
// Flip effect shape
const flip = (label, more) => ({ type: 'trig', mand: true, faceDownOk: true, label, on: (g, ev, c) => ev.type === 'flip' && ev.c === c, ...more });
const castleUp = g => fieldMons(g).some(x => faceUp(x) && named(x, 'Castle of Dark Illusions'));
// Reasoning: a monster that can be Normal Summoned/Set
const canNS = c => isMon(c) && !isExtraD(D(c)) && !['ritual', 'token'].includes(D(c).k) && !/Cannot be Normal Summoned/i.test(D(c).tx || '');
function excavate(g, p) { const deck = g.p[p].deck, out = []; for (let i = deck.length - 1; i >= 0; i--) { const x = deck[i]; if (canNS(x)) return [x, out]; out.push(x); } return [null, out]; }

/* Polymerization: the Fusion Materials come from the hand and the field (face-down monsters too). When every zone is full,
 at least one material must be on the field. ENGINE: no substitute Fusion Material hook (King of the Swamp, Fusion Substitutes). */
function matSets(preds, pool, limit = 12) {
  const out = [];
  const rec = (i, used) => { if (out.length >= limit) return; if (i === preds.length) { out.push(used.slice()); return; } for (const c of pool) if (!used.includes(c) && preds[i](c)) { used.push(c); rec(i + 1, used); used.pop(); } };
  rec(0, []);
  const seen = new Set(); return out.filter(m => { const k = m.map(c => c.u).sort().join(','); if (seen.has(k)) return false; seen.add(k); return true; });
}
function polyOptions(g, p, self) {
  const pool = [...g.p[p].hand.filter(x => x !== self && isMon(x)), ...monsOf(g, p)];
  const out = [];
  for (const fx of g.p[p].extra) {
    if (D(fx).k !== 'fusion' || forbid(g, { type: 'ss', c: fx, p, how: 'fusion' })) continue;
    const r = fusionRecipe(fx); if (!r) continue;
    let sets = matSets(r, pool); if (freeM(g, p) < 0) sets = sets.filter(s => s.some(onField));
    if (sets.length) out.push({ fx, sets });
  }
  return out;
}
const matLabel = c => D(c).n + (c.zone === 'hand' ? ' (hand)' : c.pos === 'set' ? ' (face-down)' : ' (field)');

/* A Trap that answers a moment with no response window in the engine (same as classic-5.js): a trigger that only fires while
 the card is Set (and wasn't Set this turn). It flips the card face-up, counts as a Trap Card activation at Spell Speed 2,
 and sends the card to the GY after it resolves.
 ENGINE: no response window after a monster is destroyed by battle, so Rope of Life acts as an optional trigger. */
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });

// Reverse Trap: every add or subtract to ATK/DEF is turned around this turn. Done as one extra modifier: -2 x (the monster's
// current stat minus its base). PARTIAL: a monster whose stat was set to a value (mods with set) isn't reversed, and a stat
// held at 0 can't show what went below it; halving done as a subtraction by a script is reversed too.
let REV = 0;
const revStat = which => (g, src, m) => {
  if (REV || g.f26rev !== g.turnNo) return 0;
  if (allCards(g, 'gy').find(x => named(x, 'Reverse Trap')) !== src) return 0;   // more Reverse Traps add nothing
  if (m.mods.some(x => x.set != null && (x.which === which || x.which === 'both'))) return 0;
  const base = m.flags.tokAtk != null ? m.flags.tokAtk : which === 'atk' ? baseAtk(m) : num(D(m).def);
  REV++; let v; try { v = stat(g, m, which); } finally { REV--; }
  return -2 * (v - base);
};

// Pikeru's Circle of Enchantment: effect damage to that player is 0 this turn (read from the GY, where the card is once used).
// PARTIAL: if every Pikeru's Circle leaves the GY that turn, the effect stops.
const pikeruDmg = (g, src, p, n, o) => (!o.battle && g.f26pik && g.f26pik[p] === g.turnNo) ? 0 : undefined;

// Remove Brainwashing: monsters go back to their owners while it is face-up (no chain link; checked at every game event).
let RB = 0;
function brainwashBack(g, src) {
  if (RB || !faceUp(src) || negd(g, src)) return; RB++;
  try {
    for (const m of fieldMons(g).filter(x => x.zone === 'm' && x.ctrl !== x.owner)) {
      if (!onField(m)) continue;
      if (freeM(g, m.owner) >= 0) { takeControl(g, m.owner, m, false); m.flags.ctrlUntil = null; m.flags.ctrlFrom = null; g.seq++; log(g, `${name(m)} returned to ${PN(g, m.owner)}.`); }
      else destroy(g, [m], { rule: true });
    }
  } finally { RB--; }
}

E.addScripts({
  /* ----- P ----- */
  // A Mirage Token with the target's Level, Type, Attribute, ATK and DEF (as they are when it resolves; a Field Spell that
  // boosts the target boosts the Token again). Destroyed in the End Phase.
  // ENGINE: a Token's Attribute and Type can't be set per card: every Mirage Token in the duel keeps the Attribute and Type
  // of the first one made.
  'Physical Double': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => g.tp !== p && freeM(g, p) >= 0 && oppFaceUp(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Copy which face-up monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) {
      const t = live(L2)[0]; if (!t || !faceUp(t) || t.zone !== 'm' || freeM(g, p) < 0) return;
      const A = stat(g, t, 'atk'), Df = stat(g, t, 'def'), Lv = lv(t);
      const [tok] = tokens(g, p, { n: 'Mirage Token', a: attr(t), r: race(t), lv: Lv, atk: A, def: Df }, 1, 'atk');
      if (!tok) return;
      tok.flags.tokAtk = A; tok.flags.lv = Lv; const dd = Df - A;   // the engine's tokAtk is the base of both ATK and DEF
      if (dd) addMod(g, tok, { def: dd }); g.seq++;
      log(g, `The Mirage Token has ${A} ATK and ${Df} DEF.`);
      (c.f26tok || (c.f26tok = [])).push({ u: tok.u, turn: g.turnNo }); } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the Mirage Token',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!c.f26tok && c.f26tok.some(e => e.turn === g.turnNo && fieldMons(g).some(m => m.u === e.u)),
      res: function* (g, c, p) { const us = (c.f26tok || []).filter(e => e.turn === g.turnNo).map(e => e.u); c.f26tok = (c.f26tok || []).filter(e => e.turn > g.turnNo);
        destroy(g, fieldMons(g).filter(m => us.includes(m.u)), { by: p }); } }] },
  "Pikeru's Circle of Enchantment": { cont: { loc: 'gy', dmg: pikeruDmg },
    effs: [{ type: 'act', res: function* (g, c, p) { (g.f26pik || (g.f26pik = {}))[p] = g.turnNo; log(g, `Effect damage to ${PN(g, p)} is 0 this turn.`); } }] },
  // The opponent's draws are logged (shown) until the end of their second End Phase after this card resolves.
  "Pikeru's Second Sight": { effs: [
    { type: 'act', res: function* (g, c, p) { (c.f26ss || (c.f26ss = [])).push({ p, n: 0 }); log(g, `${PN(g, opp(p))} shows every card they draw for a while.`); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (!c.f26ss || !c.f26ss.length) return false;
      if (ev.type === 'move' && ev.reason === 'draw' && ev.to === 'hand') { if (c.f26ss.some(e => e.p !== ev.c.owner)) log(g, `${PN(g, ev.c.owner)} drew ${D(ev.c).n} (Pikeru's Second Sight).`); }
      if (ev.type === 'phase' && ev.ph === 'end') { for (const e of c.f26ss) if (ev.tp === opp(e.p)) e.n++; c.f26ss = c.f26ss.filter(e => e.n < 2); }
      return false; } }] },
  'Pinch Hopper': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon an Insect from your hand',
    on: (g, ev, c) => fromFieldToGY(ev, c) && ev.prevCtrl === c.owner,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Insect' && D(x).k !== 'ritual' && canSS(g, p, x)),
    res: function* (g, c, p) { if (freeM(g, p) < 0) return; const xs = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Insect' && D(x).k !== 'ritual' && canSS(g, p, x)); if (!xs.length) return;
      const [x] = yield* pick(g, p, 'Special Summon which Insect from your hand?', xs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  // Counted at resolution; the opponent picks which of their monsters are destroyed.
  'Pineapple Blast': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.sw && g.sw.p === p && ['normal', 'tribute'].includes(g.sw.how) && monsOf(g, opp(p)).length > monsOf(g, p).length,
    res: function* (g, c, p) { const o = opp(p), k = monsOf(g, o).length - monsOf(g, p).length; if (k <= 0) return;
      const xs = yield* pick(g, o, `Choose ${k} of your monsters to be destroyed`, monsOf(g, o), k, k, 'cost'); destroy(g, xs, { by: p, src: c }); } }] },
  'Piranha Army': { cont: { dmg: (g, src, p, n, o) => o.battle && o.direct && o.src === src && p !== src.ctrl && !negd(g, src) ? 2 * n : undefined } },
  // Mandatory ("When ...", no "you can").
  'Pixie Knight': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Opponent returns a Spell to the top of the Deck',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
    res: function* (g, c) { const q = c.owner, sp = g.p[q].gy.filter(isSpell); if (!sp.length) return;
      const [x] = yield* pick(g, opp(q), 'Place which Spell from their GY on top of their Deck?', sp, 1, 1, 'bad');
      if (x && x.zone === 'gy') { move(g, x, 'deckTop', { reason: 'effect', by: opp(q) }); log(g, `${name(x)} was placed on top of ${PN(g, q)}'s Deck.`); } } }] },
  // Fusion Materials are noted on the Fusion Monster for De-Fusion (as in classic-4.js).
  'Polymerization': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => polyOptions(g, p, c).length > 0,
    res: function* (g, c, p) {
      const opts = polyOptions(g, p, c); if (!opts.length) { log(g, 'No Fusion Summon is possible.'); return; }
      const [fx] = yield* pick(g, p, 'Fusion Summon which monster?', opts.map(o => o.fx), 1, 1, 'good'); if (!fx) return;
      const sets = opts.find(o => o.fx === fx).sets; let mats = sets[0];
      if (sets.length > 1) { const i = yield* choose(g, p, 'Use which Fusion Materials?', sets.map(s => s.map(matLabel).join(' + '))); mats = sets[i]; }
      const pi = yield* choose(g, p, `${D(fx).n}: which position?`, ['Attack Position', 'Defense Position']);
      const grp = g.group; for (const m of mats) move(g, m, 'gy', { reason: 'fusion', by: p, group: grp });
      log(g, `${PN(g, p)} sent ${mats.map(m => D(m).n).join(' + ')} to the GY as Fusion Material.`);
      if (freeM(g, p) < 0) return;
      if (ss(g, p, fx, pi ? 'def' : 'atk', { how: 'fusion', group: grp })) { fx.f26proper = true; fx.flags.fusionMats = mats.map(m => m.u); } } }] },
  // Tribute this face-up card (cost): take control of every face-up Level 3 or lower monster the opponent controls at
  // resolution. With too few free zones, you pick which to take and the rest are destroyed (ruling).
  'Possessed Dark Soul': { effs: [{ type: 'ign', label: 'Tribute: take their Level 3 or lower monsters',
    cond: (g, c, p) => oppFaceUp(g, p).some(x => lv(x) <= 3),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Possessed Dark Soul.`); },
    res: function* (g, c, p) {
      let xs = oppFaceUp(g, p).filter(x => lv(x) <= 3); if (!xs.length) return;
      const n = nFreeM(g, p);
      let take = xs;
      if (xs.length > n) { take = n ? yield* pick(g, p, `Take control of which ${n} monster${n > 1 ? 's' : ''}? (the rest are destroyed)`, xs, n, n, 'bad') : []; destroy(g, xs.filter(x => !take.includes(x)), { by: p, src: c }); }
      for (const x of take) if (onField(x) && x.ctrl !== p) takeControl(g, p, x, false); } }] },
  // Tribute Summons and Tribute Sets with 2 or more of your Tributes (the Set path counts too, per the rulings).
  'Precious Cards from Beyond': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Draw 2 cards',
      on: (g, ev, c) => (ev.type === 'summon' && ev.how === 'tribute' && ev.p === c.ctrl && (ev.tribs || []).length >= 2) || (ev.type === 'set' && ev.p === c.ctrl && (ev.c.tributes || []).length >= 2),
      res: function* (g, c, p) { if (onField(c)) draw(g, p, 2); } }] },
  // Pay 800 (cost), revive in Attack Position and equip; when this card is destroyed, destroy the monster (a bounce doesn't).
  'Premature Burial': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.p[p].lp > 800 && freeM(g, p) >= 0 && g.p[p].gy.some(x => canSS(g, p, x)),
      cost: function* (g, c, p) { pay(g, p, 800); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which monster from your GY?', g.p[p].gy.filter(x => canSS(g, p, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && onField(c) && ss(g, p, t, 'atk')) { equip(g, c, t); c.flags.pb = t.u; } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the equipped monster', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.snap && ev.snap.flags && ev.snap.flags.pb,
      res: function* (g, c, p, L2) { const t = fieldMons(g).find(x => x.u === L2.ev.snap.flags.pb); if (t) destroy(g, [t], { by: p }); } }] },
  'Prickle Fairy': {
    cont: { grant: (g, src, c, flag) => flag === 'noAttackTarget' && c !== src && onField(c) && c.zone === 'm' && c.ctrl === src.ctrl && faceUp(c) && race(c) === 'Insect' && !negd(g, src),
      forbid: (g, src, a) => !negd(g, src) && attackLock(g, src, a) },
    effs: [{ type: 'trig', loc: 'any', mand: true, label: 'Change the monster to Defense Position',
      on: (g, ev, c) => ev.type === 'dsEnd' && ev.t && (ev.a === c || ev.t === c) && (() => { const o = ev.a === c ? ev.t : ev.a; return !!o && onField(o) && o.pos === 'atk'; })(),
      res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; if (o && onField(o)) toDef(g, o); } }] },
  'Primal Seed': { effs: [{ type: 'act',
    cond: (g, c, p) => allField(g).some(x => faceUp(x) && ['Black Luster Soldier - Envoy of the Beginning', 'Chaos Emperor Dragon - Envoy of the End'].includes(D(x).n)) && g.p[p].ban.length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which 2 of your banished cards to your hand?', g.p[p].ban, 2, 2, 'good'); },
    res: function* (g, c, p, L2) { for (const x of L2.t) if (x.zone === 'ban') { move(g, x, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} added ${D(x).n} to the hand.`); } } }] },
  // The opponent can't draw outside the Draw Phase, so they can't activate a card or effect whose text has them draw (rulings).
  // Mandatory triggers (Morphing Jar) still activate and just don't draw.
  // PARTIAL: "makes the opponent draw" is read from the text; a card that makes both players draw (Card Destruction) stays
  // usable by the Protector's controller, and the opponent just doesn't draw.
  'Protector of the Sanctuary': { cont: { forbid: (g, src, a) => {
    if (g.phase === 'draw') return false;
    if (a.type === 'draw') return a.p !== src.ctrl;
    if (a.type === 'activate' && a.p !== src.ctrl && a.eff && a.eff.type !== 'trig' && a.c) { const t = D(a.c).tx || ''; return /\bdraws?\b/i.test(t) && !/(?:your )?opponent draws/i.test(t); }
    return false; } } },
  // +100 while Castle of Dark Illusions is face-up, then 100 more in each of your next Standby Phases, 4 in all; it resets
  // when the Castle is gone (port of classic-2.js).
  'Pumpking the King of Ghosts': {
    self: { atk: (g, c) => { if (!castleUp(g)) { c.flags.pump = 0; return 0; } return 100 + 100 * (c.flags.pump || 0); }, def: (g, c) => castleUp(g) ? 100 + 100 * (c.flags.pump || 0) : 0 },
    effs: [{ type: 'trig', mand: true, label: 'Gain 100 ATK and DEF', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && castleUp(g) && (c.flags.pump || 0) < 4,
      cond: g => castleUp(g),
      res: function* (g, c) { if (onField(c) && faceUp(c) && castleUp(g) && (c.flags.pump || 0) < 4) { c.flags.pump = (c.flags.pump || 0) + 1; g.seq++; log(g, `${name(c)} gained 100 ATK and DEF.`); } } }] },
  'Punished Eagle': { effs: [] },
  'Pyramid Energy': { effs: [{ type: 'act', ds: true, cond: (g, c, p) => monsOf(g, p).some(faceUp),
    res: function* (g, c, p) { const i = yield* choose(g, p, 'Pyramid Energy: which effect?', ['Your face-up monsters gain 200 ATK', 'Your face-up monsters gain 500 DEF']);
      const ms = monsOf(g, p).filter(faceUp); for (const m of ms) addMod(g, m, i ? { def: 500, end: true } : { atk: 200, end: true });
      if (ms.length) log(g, `${PN(g, p)}'s face-up monsters gained ${i ? '500 DEF' : '200 ATK'} this turn.`); } }] },
  'Pyramid of Light': { effs: [actNoop,
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy and banish the Sphinxes',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.from === 'st' && ev.snap && ev.snap.faceUp && monsOf(g, ev.prevCtrl).some(x => faceUp(x) && ['Andro Sphinx', 'Sphinx Teleia'].includes(D(x).n)),
      res: function* (g, c, p, L2) { const q = L2.ev.prevCtrl; destroy(g, monsOf(g, q).filter(x => faceUp(x) && ['Andro Sphinx', 'Sphinx Teleia'].includes(D(x).n)), { by: q, banish: true }); } }] },
  // PARTIAL: the engine has no shared turn count. It moves the counts it can see: Final Countdown (full-08.js),
  // Lightforce Sword (classic-5.js) and Swords of Revealing Light (its 'swords' turn counter; gone at once on its 3rd)
  // go 1 turn further; g.pyroClock counts for any later script that wants it.
  'Pyro Clock of Destiny': { effs: [{ type: 'act',
    res: function* (g) { g.pyroClock = (g.pyroClock || 0) + 1;
      if (g.fcd) for (const e of g.fcd) e.t -= 1;
      if (g.lfs) for (const e of g.lfs) e.n += 1;
      const sw = stOnField(g).filter(x => faceUp(x) && named(x, 'Swords of Revealing Light'));
      for (const x of sw) L.addCtr(g, x, 'swords', 1);
      const done = sw.filter(x => L.ctr(x, 'swords') >= 3); if (done.length) destroy(g, done, { rule: true });
      log(g, 'The turn count moved forward by 1 turn.'); } }] },

  /* ----- Q ----- */
  "Queen's Double": { self: { directAttack: true } },
  // The opponent calls a name from the monsters in your GY (listed in alphabetical order); the bottom monster is the one
  // that went to the GY first. Right: banished. Wrong: Special Summoned, if it can be.
  'Question': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.some(isMon),
    res: function* (g, c, p) { const bottom = g.p[p].gy.find(isMon); if (!bottom) return;
      const names = [...new Set(g.p[p].gy.filter(isMon).map(x => D(x).n))].sort();
      const i = names.length > 1 ? yield* choose(g, opp(p), 'Question: call the name of the bottom monster of their GY', names) : 0;
      log(g, `${PN(g, opp(p))} called ${names[i]}. The bottom monster is ${D(bottom).n}.`);
      if (names[i] === D(bottom).n) { move(g, bottom, 'ban', { reason: 'effect', by: p }); log(g, `${D(bottom).n} was banished.`); }
      else if (freeM(g, p) >= 0 && canSS(g, p, bottom)) ss(g, p, bottom, 'atk'); } }] },

  /* ----- R ----- */
  'Rabid Horseman': { effs: [] },
  'Rafflesia Seduction': { effs: [flip('Take control of a monster', {
    target: function* (g, c, p, L2) { if (oppFaceUp(g, p).length) yield* tgt(g, p, L2, 'Take control of which face-up monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.ctrl !== p) takeControl(g, p, t, true); } })] },
  'Raigeki': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)), { by: p, src: c }); } }] },
  'Raimei': { effs: [{ type: 'act', res: function* (g, c, p) { damage(g, opp(p), 300, { src: c, srcP: p }); } }] },
  'Rain of Mercy': { effs: [{ type: 'act', res: function* (g, c, p) { gain(g, p, 1000); gain(g, opp(p), 1000); } }] },
  'Raise Body Heat': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 300 : 0, def: (g, src, m) => src.equipTo === m.u ? 300 : 0 },
    effs: [equipAct(m => race(m) === 'Dinosaur', 'Equip to which Dinosaur?')] },
  // "Cannot be Normal Summoned or Set" is read from its text; it can be Special Summoned by card effects.
  'Rare Metal Dragon': {},
  // +500 ATK to the targeted Machine. Its "once, negate a Spell effect that targets that monster" is offered as a
  // Spell Speed 3 response (PARTIAL, same as goat-*.js: the engine has no automatic negation at resolution).
  'Rare Metalmorph': {
    cont: { atk: (g, src, m) => src.flags.mm === m.u && race(m) === 'Machine' ? 500 : 0 },
    effs: [{ type: 'act', ds: true, cond: g => fieldMons(g).some(m => faceUp(m) && race(m) === 'Machine'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which Machine monster?', fieldMons(g).filter(m => faceUp(m) && race(m) === 'Machine'), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c)) { c.flags.mm = t.u; g.seq++; log(g, `${name(t)} gained 500 ATK.`); } } },
    { type: 'quick', loc: 'st', speed: 3, ds: true, label: 'Negate the Spell that targets the Machine',
      cond: (g, c, p, x) => !!c.flags.mm && !c.flags.mmUsed && !!x.top && isSpell(x.top.c) && !x.top.negated && (x.top.t || []).some(t => t && t.u === c.flags.mm && onField(t)),
      target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; c.flags.mmUsed = true; },
      res: function* (g, c, p, L2) { const T = L2.data.L; if (T && g.chain.includes(T) && !T.negated) { T.negBy = p; negate(g, T, false); } } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy Rare Metalmorph',
      on: (g, ev, c) => ev.type === 'move' && !!c.flags.mm && ev.c.u === c.flags.mm && ev.wasField && ev.to !== 'm',
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  'Raregold Armor': {
    cont: { grant: (g, src, c, flag) => { if (flag !== 'noAttackTarget' || !src.equipTo || c.zone !== 'm') return false; const m = fieldMons(g).find(x => x.u === src.equipTo); return !!m && m.ctrl === src.ctrl && c.ctrl === src.ctrl && c !== m; },
      forbid: (g, src, a) => !!src.equipTo && attackLock(g, src, a) },
    effs: [equipAct()] },
  'Ray of Hope': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT').length >= 2,
    res: function* (g, c, p) { const cs = g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT'); if (cs.length < 2) return;
      const xs = yield* pick(g, p, 'Shuffle which 2 LIGHT monsters into your Deck?', cs, 2, 2, 'good');
      for (const x of xs) move(g, x, 'deck', { reason: 'effect', by: p }); shuffleDeck(g, p); log(g, `${PN(g, p)} shuffled ${xs.map(x => D(x).n).join(' and ')} into the Deck.`); } }] },
  // Only a Fusion Monster that was properly Fusion Summoned (ruling). When this card is destroyed, banish the monster.
  'Re-Fusion': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.p[p].lp > 800 && freeM(g, p) >= 0 && g.p[p].gy.some(x => D(x).k === 'fusion' && (x.f26proper || x.summonType === 'fusion') && canSS(g, p, x)),
      cost: function* (g, c, p) { pay(g, p, 800); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Fusion Monster from your GY?', g.p[p].gy.filter(x => D(x).k === 'fusion' && (x.f26proper || x.summonType === 'fusion') && canSS(g, p, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && onField(c)) { t.f26proper = true; if (ss(g, p, t, 'atk')) { equip(g, c, t); c.flags.rf = t.u; } } } },
    { type: 'trig', loc: 'any', mand: true, label: 'Banish the equipped monster', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.snap && ev.snap.flags && ev.snap.flags.rf,
      res: function* (g, c, p, L2) { const u = L2.ev.snap.flags.rf; const t = fieldMons(g).find(x => x.u === u);
        if (t) { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished.`); } } }] },
  'Ready for Intercepting': { effs: [{ type: 'act', cond: g => fieldMons(g).some(m => faceUp(m) && ['Warrior', 'Spellcaster'].includes(race(m))),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Turn which Warrior or Spellcaster face-down?', fieldMons(g).filter(m => faceUp(m) && ['Warrior', 'Spellcaster'].includes(race(m))), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.zone === 'm') setFaceDown(g, t); } }] },
  'Really Eternal Rest': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: g => fieldMons(g).some(m => allField(g).some(x => x.zone === 'st' && x.equipTo === m.u)),
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => allField(g).some(x => x.zone === 'st' && x.equipTo === m.u)), { by: p, src: c }); } }] },
  // Port of classic-2.js: a Set card is looked at; only a Trap is destroyed.
  'Reaper of the Cards': { effs: [flip('Destroy a Trap', {
    target: function* (g, c, p, L2) { const cs = allField(g).filter(x => x.zone !== 'm' && (x.pos === 'set' || isTrap(x))); if (cs.length) yield* tgt(g, p, L2, 'Select which Trap (or Set card)?', cs, 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; if (t.pos === 'set') log(g, `${PN(g, p)} looked at the Set card: ${name(t)}.`);
      if (isTrap(t)) destroy(g, [t], { by: p, src: c }); else log(g, `${name(t)} isn't a Trap, so it stays.`); } })] },
  // The card's behavior (as in goat-2.js): the declared Level sends everything to the GY, any other Level Special Summons it.
  // The batch text reads the other way round ("if its Level isn't the declared number, send ... to the GY"), which is
  // not how Reasoning has ever played, so the printed behavior is kept.
  'Reasoning': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(canNS),
    res: function* (g, c, p) { const o = opp(p); const i = yield* choose(g, o, 'Reasoning: declare a Level', Array.from({ length: 12 }, (_, k) => 'Level ' + (k + 1))); const lvD = i + 1; log(g, `${PN(g, o)} declared Level ${lvD}.`);
      const [m, rest] = excavate(g, p); log(g, `${PN(g, p)} revealed ${rest.length + (m ? 1 : 0)} card${rest.length + (m ? 1 : 0) === 1 ? '' : 's'}${m ? `, down to ${D(m).n}` : ''}.`);
      for (const x of rest) if (x.zone === 'deck') move(g, x, 'gy', { reason: 'effect' });
      if (!m) return; if (lv(m) === lvD) { move(g, m, 'gy', { reason: 'effect' }); log(g, `${name(m)} was Level ${lvD}, so it went to the GY.`); return; }
      if (!ss(g, p, m, 'atk') && m.zone === 'deck') move(g, m, 'gy', { reason: 'effect' }); } }] },
  'Reckless Greed': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 2,
    res: function* (g, c, p) { draw(g, p, 2); const first = g.turnNo + (g.tp === p ? 2 : 1), turns = [first, first + 2];
      addRule(g, (g2, a) => a.type === 'draw' && a.p === p && g2.phase === 'draw' && g2.tp === p && turns.includes(g2.turnNo), { end: turns[1] });
      log(g, `${PN(g, p)} skips the next 2 Draw Phases.`); } }] },
  // ENGINE: no Standby Phase response window, so it is an optional trigger at the start of your Standby Phase, once each.
  // PARTIAL: the rulings let it be used several times in one Standby Phase.
  'Recycle': { effs: [actNoop,
    { type: 'trig', loc: 'st', label: 'Pay 300: return a non-Monster card to the bottom of the Deck',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      cond: (g, c, p) => g.p[p].lp > 300 && g.p[p].gy.some(isST),
      cost: function* (g, c, p) { pay(g, p, 300); },
      res: function* (g, c, p) { const cs = g.p[p].gy.filter(isST); if (!cs.length) return; const [x] = yield* pick(g, p, 'Return which non-Monster card to the bottom of your Deck?', cs, 1, 1, 'good');
        if (x) { toBottom(g, x); log(g, `${D(x).n} went to the bottom of ${PN(g, p)}'s Deck.`); } } }] },
  // PARTIAL (port of goat-7.js): the damage comes at the start of the Damage Step (no trigger point right before damage calculation).
  'Reflect Bounder': { effs: [
    { type: 'trig', mand: true, label: 'Damage equal to the attacker’s ATK', on: (g, ev, c) => ev.type === 'dsStart' && ev.t === c && c.pos === 'atk' && ev.a.ctrl !== c.ctrl,
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (!onField(c) || !onField(a)) return; c.flags.reflect = g.turnNo; damage(g, opp(p), stat(g, a, 'atk'), { src: c, srcP: p }); } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy this card', on: (g, ev, c) => ev.type === 'afterCalc' && ev.t === c && c.flags.reflect === g.turnNo,
      res: function* (g, c) { if (onField(c)) destroy(g, [c], { by: c.ctrl }); } }] },
  'Regenerating Mummy': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Return to the hand',
    on: (g, ev, c) => sentByOpp(g, ev, c, ['hand']),
    res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} returned Regenerating Mummy to the hand.`); } } }] },
  'Reinforcements': { effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which face-up monster gains 500 ATK?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: 500, end: true }); log(g, `${name(t)} gained 500 ATK this turn.`); } } }] },
  'Reload': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c),
    res: function* (g, c, p) { const h = g.p[p].hand.slice(); for (const x of h) move(g, x, 'deck', { reason: 'effect' }); shuffleDeck(g, p); log(g, `${PN(g, p)} shuffled ${h.length} card${h.length > 1 ? 's' : ''} into the Deck.`);
      const mine = h.filter(x => x.owner === p).length; draw(g, p, Math.min(h.length, g.p[p].deck.length)); if (mine < h.length) log(g, 'The opponent’s cards went back to their Deck.'); } }] },
  // While face-up, every monster goes back to its owner (checked at each game event; no chain link). A monster that has no
  // free zone to go back to is destroyed. Monsters still under the wrong control can't attack.
  // PARTIAL: between a control change and the next game event the monster stays put (it can't attack in that gap).
  'Remove Brainwashing': {
    cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && a.c.ctrl !== a.c.owner && !negd(g, src) },
    effs: [{ type: 'act', res: function* (g, c) { brainwashBack(g, c); } },
      { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => { if (fieldMons(g).some(m => m.ctrl !== m.owner)) brainwashBack(g, c); return false; } }] },
  'Remove Trap': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => stOnField(g).some(x => faceUp(x) && isTrap(x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up Trap?', stOnField(g).filter(x => faceUp(x) && isTrap(x)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2).filter(x => faceUp(x) && isTrap(x)), { by: p, src: c }); } }] },
  // Ritual Summoned by Final Ritual of the Ancients (full-08.js). Ignition: discard a Spell (cost), take a monster this turn.
  // Only Final Ritual of the Ancients can Ritual Summon it (another Ritual Spell, like Advanced Ritual Art, can't).
  'Reshef the Dark Being': { cont: { loc: 'hand', forbid: (g, src, a) => a.type === 'ss' && a.c === src && a.how === 'ritual' && !(g.resolvingL && D(g.resolvingL.c).n === 'Final Ritual of the Ancients') },
    effs: [{ type: 'ign', opt: true, label: 'Discard a Spell: take control of a monster',
    cond: (g, c, p) => g.p[p].hand.some(isSpell) && monsOf(g, opp(p)).length > 0 && freeM(g, p) >= 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard which Spell?', g.p[p].hand.filter(isSpell), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone === 'm' && t.ctrl !== p) takeControl(g, p, t, true); } }] },
  // PARTIAL: hands are shown in the log (on activation and at the start of each turn), not kept face-up in the client.
  'Respect Play': { effs: [
    { type: 'act', res: function* (g, c) { log(g, `${PN(g, g.tp)} shows their hand: ${g.p[g.tp].hand.map(x => D(x).n).join(', ') || 'no cards'}.`); } },
    { type: 'trig', loc: 'st', res: noop, on: (g, ev) => { if (ev.type === 'phase' && ev.ph === 'standby') log(g, `${PN(g, ev.tp)} shows their hand: ${g.p[ev.tp].hand.map(x => D(x).n).join(', ') || 'no cards'}.`); return false; } }] },
  'Restructer Revolution': { effs: [{ type: 'act', res: function* (g, c, p) { const n = 200 * g.p[opp(p)].hand.length; if (n) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  // Sending the hand and field to the GY is the cost (ruling), so it needs at least 1 card there.
  'Reversal Quiz': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length > 0 && (g.p[p].hand.some(x => x !== c) || fieldOf(g, p).some(x => x !== c)),
    cost: function* (g, c, p) { const cs = [...g.p[p].hand.filter(x => x !== c), ...fieldOf(g, p).filter(x => x !== c)]; for (const x of cs) if (x.zone === 'hand' || onField(x)) move(g, x, 'gy', { reason: 'cost', by: p });
      log(g, `${PN(g, p)} sent ${cs.length} card${cs.length === 1 ? '' : 's'} to the GY.`); },
    res: function* (g, c, p) {
      const top = g.p[p].deck[g.p[p].deck.length - 1]; if (!top) return;
      const kinds = ['Monster', 'Spell', 'Trap']; const i = yield* choose(g, p, 'Call the type of the top card of your Deck', kinds);
      const real = isMon(top) ? 0 : isSpell(top) ? 1 : 2; log(g, `${PN(g, p)} called ${kinds[i]}. The top card is ${name(top)}.`);
      if (i === real) { const a = g.p[p].lp; g.p[p].lp = g.p[opp(p)].lp; g.p[opp(p)].lp = a; log(g, `The players swapped Life Points (${g.p[p].lp} and ${g.p[opp(p)].lp}).`); } } }] },
  'Reverse Trap': { cont: { loc: 'gy', atk: revStat('atk'), def: revStat('def') },
    effs: [{ type: 'act', res: function* (g) { g.f26rev = g.turnNo; g.seq++; log(g, 'ATK and DEF increases and decreases are reversed this turn.'); } }] },
  'Riryoku Field': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p, x) => spellTrapAct(x.top) && isSpell(x.top.c) && !x.top.negated && (x.top.t || []).length === 1 && x.top.t[0].zone === 'm',
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; if (T && g.chain.includes(T)) { T.negBy = p; negate(g, T, true); } } }] },
  'Rising Air Current': { cont: { atk: (g, src, m) => attr(m) === 'WIND' ? 500 : 0, def: (g, src, m) => attr(m) === 'WIND' ? -400 : 0 }, effs: [actNoop] },
  'Roaring Ocean Snake': { effs: [] },
  // Mandatory, even with no cards in the opponent's hand (ruling).
  "Robbin' Goblin": { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Random discard', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.p !== c.ctrl && ev.src && ev.src.ctrl === c.ctrl && onField(ev.src),
      res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, opp(p))} discarded ${name(x)} at random.`); } }] },
  // Mandatory: shuffled back even when discarded as a cost (ruling).
  'Roc from the Valley of Haze': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Shuffle into the Deck',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'hand' && ev.to === 'gy',
    res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'deck', { reason: 'effect' }); log(g, `${PN(g, p)} shuffled Roc from the Valley of Haze into the Deck.`); } } }] },
  'Rock Bombardment': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && race(x) === 'Rock'),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Rock monster from your Deck to the GY?', g.p[p].deck.filter(x => isMon(x) && race(x) === 'Rock'), 1, 1, 'cost');
      if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${name(x)} from the Deck to the GY.`); } shuffleDeck(g, p); },
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  'Rod of the Mind\'s Eye': { cont: { dmg: (g, src, p, n, o) => o.battle && o.src && o.src.u === src.equipTo && o.src.ctrl === src.ctrl && p === opp(src.ctrl) ? 1000 : undefined },
    effs: [equipAct()] },
  'Rope of Life': { effs: [trapTrig({ label: 'Discard your hand: revive the monster', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && ev.wasField && isMon(ev.c) && ev.c.owner === c.ctrl,
    cond: (g, c, p, x) => g.p[p].hand.length > 0 && x.ev.c.zone === 'gy' && freeM(g, p) >= 0,
    cost: function* (g, c, p) { const h = g.p[p].hand.slice(); for (const x of h) move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${h.length} card${h.length > 1 ? 's' : ''}.`); },
    target: function* (g, c, p, L2) { L2.t = [L2.ev.c]; L2.data.x = L2.ev.c; },
    res: function* (g, c, p, L2) { const x = L2.data.x; if (x.zone !== 'gy' || !ss(g, p, x, 'atk')) return; addMod(g, x, { atk: 800 }); log(g, `${name(x)} gained 800 ATK.`); } })] },
  'Roulette Barrel': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Roll 2 dice: destroy a monster',
    res: function* (g, c, p) {
      const a = dice(g, p), b = dice(g, p);
      const i = a === b ? 0 : yield* choose(g, p, 'Use which result?', ['Level ' + a, 'Level ' + b]); const n = i ? b : a;
      const ms = fieldMons(g).filter(x => faceUp(x) && lv(x) === n); if (!ms.length) { log(g, `No face-up Level ${n} monster.`); return; }
      const [t] = yield* pick(g, p, `Destroy which Level ${n} monster?`, ms, 1, 1, 'bad'); if (t) destroy(g, [t], { by: p }); } }] },

  /* ----- S ----- */
  'Sacred Crane': { effs: [{ type: 'trig', mand: true, label: 'Draw 1 card', on: (g, ev, c) => evSummoned(ev, c, ['special', 'fusion', 'ritual', 'synchro']),
    res: function* (g, c, p) { if (g.p[p].deck.length) draw(g, p, 1); } }] },
  // Destroyed by a card effect and sent to the GY (from anywhere, per the rulings): in its owner's next Standby Phase it comes
  // back and destroys every Spell and Trap on the field. The mark lives on the card object, cleared when it moves again.
  'Sacred Phoenix of Nephthys': { effs: [
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c) c.f26phx = ev.to === 'gy' && ev.destroyed && !ev.battle ? g.turnNo : null; return false; } },
    { type: 'trig', loc: 'gy', mand: true, opt: true, tags: { ss: 1, destroy: 1 }, label: 'Special Summon itself and destroy all Spells and Traps',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner && c.f26phx != null && g.turnNo > c.f26phx,
      res: function* (g, c, p) { c.f26phx = null; if (c.zone !== 'gy' || freeM(g, p) < 0) return; if (ss(g, p, c, 'atk')) destroy(g, stOnField(g), { by: p, src: c }); } }] },
});
})();
