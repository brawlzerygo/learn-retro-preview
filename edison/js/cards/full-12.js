/* Full pool batch 12: Miracle Dig to Pot of Greed (build/batches/full/full-12.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text; cards with a
 Goat-only script elsewhere (Mirror Wall, Monster Gate, Monster Reborn, Monster Recovery, Mystic Box, Mystic Swordsman LV2,
 Nightmare Penguin, Ojama King, Ojama Trio, Pot of Greed) are ported here as the shared version. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, takeControl, negate, addMod,
  equip, addRule, addCtr, ctr, tokens, dice, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv,
  baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, live, opp,
  oppFaceUp, stOnField, spellTrapAct, evSummoned, battleKill, isEHERO, isExtraD, forbid, stat, num, has } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const txt = c => D(c).ps || D(c).tx || '';
const handDeck = (g, p, n) => [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, n));
// a monster that can be Normal Summoned/Set (Monster Gate)
const canNS = c => isMon(c) && !isExtraD(D(c)) && !['ritual', 'token'].includes(D(c).k) && !/Cannot be Normal Summoned/i.test(txt(c));
function excavate(g, p) { const deck = g.p[p].deck, out = []; for (let i = deck.length - 1; i >= 0; i--) { const x = deck[i]; if (canNS(x)) return [x, out]; out.push(x); } return [null, out]; }
const sendAll = (g, xs) => { for (const x of xs) if (x.zone === 'deck') move(g, x, 'gy', { reason: 'effect' }); };
const killFoe = (g, c, p, t) => { if (t && onField(t) && t.zone === 'm') destroy(g, [t], { by: p, src: c }); };
// Mirror Wall: halve once per wall (the mod goes when the wall leaves)
function halve(g, wall, m) {
  if (!onField(m) || !faceUp(m) || m.mods.some(x => x.mw === wall.u)) return;
  const a = stat(g, m, 'atk'), cut = a - Math.floor(a / 2); if (!cut) return;
  m.mods.push({ atk: -cut, mw: wall.u, turn: g.turnNo }); log(g, `${name(m)}'s ATK was halved by Mirror Wall.`);
}
// Ojama King: up to 3 of the opponent's unused Monster Zones (Edison: unused ones only), chosen automatically, lowest first
function kingZones(g, c) {
  const o = opp(c.ctrl); if (c.flags.ojamaZones && c.flags.ojamaZones.p === o) return c.flags.ojamaZones;
  const zs = [0, 1, 2, 3, 4].filter(i => !g.p[o].m[i]).slice(0, 3);
  c.flags.ojamaZones = { p: o, zs }; return c.flags.ojamaZones;
}
// Effect Monsters (Non-Spellcasting Area)
function isEffMon(c) {
  const d = D(c), tx = d.tx || '';
  if (d.k === 'trap' || d.k === 'effect') return true;
  if (d.k === 'fusion' || d.k === 'synchro') return tx.split(/\r?\n/).filter(s => s.trim()).length > 1;
  if (d.k === 'ritual') return tx.replace(/^You can Ritual Summon this card with "[^"]+"\.\s*/i, '').replace(/^This card can only be Ritual Summoned[^.]*\.\s*/i, '').trim().length > 0;
  return false;
}
const isSpirit = c => /Spirit/.test(D(c).ab || '') || /returns? to (?:its owner's|the owner's|your) hand during the End Phase of the turn/i.test(D(c).tx || '');
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) equip(g, c, t); } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
// Union monsters (Edison union rules, same shape as full-02.js)
const hasUnion = (g, m) => allField(g).some(x => x.zone === 'st' && x.equipTo === m.u && x.flags.union);
function unionEffs(okTarget, text) {
  const cands = (g, c, p) => monsOf(g, p).filter(x => x !== c && faceUp(x) && okTarget(x) && !hasUnion(g, x));
  return [
    { type: 'ign', label: 'Equip to a monster',
      cond: (g, c, p) => c.used.union !== g.turnNo && freeST(g, p) >= 0 && cands(g, c, p).length > 0,
      after: (g, c) => { c.used.union = g.turnNo; },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, cands(g, c, p), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !okTarget(t) || c.zone !== 'm' || !faceUp(c) || freeST(g, p) < 0 || hasUnion(g, t)) return;
        move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); c.equipTo = t.u; c.flags.union = true; log(g, `${D(c).n} was equipped to ${name(t)}.`); } },
    { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Unequip and Special Summon',
      cond: (g, c, p) => c.used.union !== g.turnNo && !!c.equipTo && !!c.flags.union && freeM(g, p) >= 0,
      after: (g, c) => { c.used.union = g.turnNo; },
      res: function* (g, c, p) { if (c.zone !== 'st' || !c.equipTo) return; c.equipTo = null; c.flags.union = false; ss(g, p, c, 'atk'); } }];
}
const unionCont = { replaceDestroy: (g, src, m, o) => {
  if (o.rule || !o.battle || src.zone !== 'st' || src.equipTo !== m.u || !src.flags.union) return false;
  move(g, src, 'gy', { reason: 'battle', destroyed: true, by: o.by }); log(g, `${D(src).n} was destroyed instead of ${name(m)}.`); return true; } };
// A Trap that answers an event the engine opens no window for (the Standby Phase): offered as an optional trigger while Set
// (same shape as full-02.js).
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });
// Spell Counters on your side of the field (Miracle Restoring's cost)
const ownCtrs = (g, p) => fieldOf(g, p).reduce((s, x) => s + ctr(x, 'spell'), 0);
function* removeSpellCtrs(g, p, n) {
  for (let i = 0; i < n; i++) { const cs = fieldOf(g, p).filter(x => ctr(x, 'spell') > 0); if (!cs.length) return false; const [x] = yield* pick(g, p, `Remove a Spell Counter from which card? (${i + 1} of ${n})`, cs, 1, 1, 'cost'); addCtr(g, x, 'spell', -1); }
  log(g, `${PN(g, p)} removed ${n} Spell Counters.`); return true;
}
// Mirage Dragon, Pitch-Black Warwolf: the opponent can't activate Trap Cards during the Battle Phase (face-up Traps' effects still can)
const noTrapsInBattle = { forbid: (g, src, a) => a.type === 'activate' && g.phase === 'battle' && a.p === opp(src.ctrl) && isTrap(a.c) && a.eff.type === 'act' };
// Mystic Swordsman: "at the start of the Damage Step, if this card attacked a face-down Defense Position monster"
const swordDS = (more) => ({ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the face-down monster',
  on: (g, ev, c) => ev.type === 'dsStart' && ev.a === c && !!ev.t && ev.t.pos === 'set',
  res: more || function* (g, c, p, L2) { killFoe(g, c, p, L2.ev.t); } });
const swordKill = { type: 'trig', on: (g, ev, c) => { if (battleKill(ev, c)) c.flags.msKill = g.turnNo; return false; }, res: noop };
const swordUp = to => ({ type: 'trig', tags: { ss: 1 }, label: `Send it: summon ${to}`,
  on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.msKill === g.turnNo,
  cond: (g, c, p) => handDeck(g, p, to).length > 0,
  cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(c).n} to the GY.`); },
  res: function* (g, c, p) { const cs = handDeck(g, p, to); if (!cs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, `Special Summon ${to}`, cs, 1, 1, 'good');
    if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } } });

/* Duel-long rules, installed by the first event any of these cards sees (a trig that never fires):
 - Mirage Knight: only by Dark Flare Knight's effect (full-05.js marks it with flags.byDFK), never revived.
 - Ocean Dragon Lord - Neo-Daedalus: only by its own rule from the hand. PARTIAL: another effect that Special Summons it from
   the hand isn't stopped (the engine checks the rule with the same "ss" action before offering it).
 - Miracle Flipper: can't be Summoned while you control a face-up Miracle Flipper.
 - Mystic Swordsman LV4 / LV6: "Cannot be Normal Summoned (but can be Normal Set)": the engine's canNormal reads this
   (2026-11-26), so no rule is needed here. */
const LOCKS = {
  // only Dark Flare Knight summons it, from the hand or Deck (Goat's own Dark Flare Knight script doesn't set byDFK, so those zones count too)
  'Mirage Knight': (g, a) => a.type === 'ss' && !a.c.flags.byDFK && !['deck', 'hand'].includes(a.c.zone),
  'Ocean Dragon Lord - Neo-Daedalus': (g, a) => a.type === 'ss' && a.c.zone !== 'hand',
  'Miracle Flipper': (g, a) => ['ns', 'ss'].includes(a.type) && monsOf(g, a.p).some(x => x !== a.c && faceUp(x) && named(x, 'Miracle Flipper')),
};
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: (g, ev, c) => {
    if (!g.f12lock) { g.f12lock = true; addRule(g, (g2, a) => { if (!a.c || a.c.id == null || !['ns', 'set', 'ss'].includes(a.type)) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); }
    return false; } };

/* Mysterious Triangle summons and Miracle Fertilizer: delayed end-of-turn work */
const SC12 = g => g.f12 || (g.f12 = { locus: [] });

E.addScripts({
  'Miracle Dig': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].ban.filter(isMon).length >= 5,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which 3 banished monsters to the GY?', g.p[p].ban.filter(isMon), 3, 3, 'good'); },
    res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'ban'); for (const x of xs) move(g, x, 'gy', { reason: 'effect' }); if (xs.length) log(g, `${xs.map(x => D(x).n).join(', ')} returned to the GY.`); } }] },

  // The Normal Summon lock comes only after a successful summon (ruling); its monster's leaving destroys this card.
  'Miracle Fertilizer': { effs: [
    { type: 'act', res: noop },
    { type: 'ign', loc: 'st', opt: true, tags: { ss: 1 }, label: 'Special Summon a Plant from your GY',
      cond: (g, c, p) => g.ns[p] === 0 && freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && race(x) === 'Plant'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Plant from your GY?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Plant'), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy' || !ss(g, p, t, 'atk')) return; t.flags.fert = c.u;
        const turn = g.turnNo; addRule(g, (g2, a) => (a.type === 'ns' || a.type === 'set') && a.p === p && g2.turnNo === turn, { end: turn }); log(g, `${PN(g, p)} can't Normal Summon or Set this turn.`); } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy Miracle Fertilizer',
      on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.c !== c && ev.snap && ev.snap.flags && ev.snap.flags.fert === c.u,
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },

  // PARTIAL: "destroyed by the effect of a Spell or Trap Card" is read as destroyed by an effect while a Spell/Trap is
  // resolving (a face-up Normal, Quick-Play or Counter card on the field, or a Continuous one when nothing else is), since
  // the destroy event doesn't carry the card that destroyed it.
  'Miracle Flipper': {
    cont: { grant: (g, src, m, flag) => flag === 'noAttackTarget' && m !== src && m.ctrl === src.ctrl && faceUp(m) },
    effs: [lockInstall,
      { type: 'trig', loc: 'any', on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.wasField) { c.flags.flipTo = opp(ev.prevCtrl); c.flags.flipTurn = g.turnNo; } return false; }, res: noop },
      { type: 'trig', loc: 'any', mand: true, tags: { ss: 1 }, label: "Special Summon it to the opponent's field",
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'bpEnd' && c.flags.flipTurn === g.turnNo && ['gy', 'ban'].includes(c.zone),
        res: function* (g, c) { const to = c.flags.flipTo; c.flags.flipTurn = 0; if (to == null || !['gy', 'ban'].includes(c.zone)) return; ss(g, to, c, 'atk'); } },
      { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy a monster',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !ev.battle && ev.reason === 'effect' &&
          (stOnField(g).some(x => faceUp(x) && !['Continuous', 'Equip', 'Field'].includes(D(x).sub)) || g.chain.some(l => isST(l.c) && onField(l.c))),
        cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which of their monsters?', monsOf(g, opp(p)), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },

  // ENGINE: "can't be banished while face-up" has no hook in move().
  // The counters are placed as the Dinosaurs land (no chain link), 2 per group of cards sent together.
  'Miracle Jurassic Egg': { effs: [
    { type: 'trig', on: (g, ev, c) => { if (ev.type === 'move' && ev.to === 'gy' && ev.c !== c && ev.c.owner === c.ctrl && isMon(ev.c) && race(ev.c) === 'Dinosaur' && c.flags.eggGrp !== ev.group) { c.flags.eggGrp = ev.group; addCtr(g, c, 'egg', 2); log(g, `Miracle Jurassic Egg got 2 counters (${ctr(c, 'egg')}).`); } return false; }, res: noop },
    { type: 'ign', tags: { ss: 1 }, label: 'Tribute: summon a Dinosaur',
      cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && race(x) === 'Dinosaur' && lv(x) <= ctr(c, 'egg')),
      cost: function* (g, c, p, L2) { L2.data.n = ctr(c, 'egg'); move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Miracle Jurassic Egg (${L2.data.n} counters).`); },
      res: function* (g, c, p, L2) { const cs = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Dinosaur' && lv(x) <= L2.data.n); if (!cs.length || freeM(g, p) < 0) { shuffleDeck(g, p); return; }
        const [x] = yield* pick(g, p, `Special Summon a Dinosaur of Level ${L2.data.n} or lower from your Deck`, cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },

  'Miracle Kids': { effs: [{ type: 'act', ds: true, cond: (g, c, p) => g.p[p].gy.some(x => named(x, 'Hero Kid')) && oppFaceUp(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster loses ATK?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const n = 400 * g.p[p].gy.filter(x => named(x, 'Hero Kid')).length; if (!n) return; addMod(g, t, { atk: -n, end: true }); log(g, `${name(t)} lost ${n} ATK.`); } }] },

  // Up to 2 attacks, both on monsters: after a direct attack, or with no monster to attack, it can't attack again.
  // Its battles deal no battle damage to the activator's opponent this turn (a GY damage hook, like Energy-Absorbing Monolith).
  // PARTIAL: if Miracle Locus leaves the GY that turn, the no-damage part stops.
  'Miracle Locus': {
    cont: { loc: 'gy', dmg: (g, src, p, n, o) => o.battle && g.battle && SC12(g).locus.some(e => e.turn === g.turnNo && e.p === p && [g.battle.a, g.battle.t].some(x => x && x.u === e.u)) ? 0 : undefined },
    effs: [{ type: 'act', ds: true, cond: (g, c, p) => monsOf(g, p).some(x => x.pos === 'atk') && !(g.inDS && g.battle && g.battle.calcDone),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which of your Attack Position monsters?', monsOf(g, p).filter(x => x.pos === 'atk'), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { if (g.p[opp(p)].deck.length) draw(g, opp(p), 1); const t = live(L2)[0]; if (!t || !faceUp(t) || t.pos !== 'atk') return;
        addMod(g, t, { atk: 1000, end: true }); log(g, `${name(t)} gained 1000 ATK and can attack 2 monsters this turn.`);
        if (!(t.flags.maxAttacks > 2 && t.flags.maxAttacksTurn === g.turnNo)) { t.flags.maxAttacks = 2; t.flags.maxAttacksTurn = g.turnNo; }
        const u = t.u, turn = g.turnNo; t.flags.locus = turn; SC12(g).locus.push({ u, p: opp(p), turn });
        addRule(g, (g2, a) => a.type === 'attack' && a.c.u === u && a.c.flags.locus === turn && a.c.attacks >= 1 && (a.c.flags.locusDirect === turn || !monsOf(g2, opp(a.c.ctrl)).length), { end: turn }); } },
      { type: 'trig', loc: 'any', on: (g, ev) => { if (ev.type === 'attack' && ev.direct && ev.a.flags.locus === g.turnNo) ev.a.flags.locusDirect = g.turnNo; return false; }, res: noop }] },

  'Miracle Restoring': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => ownCtrs(g, p) >= 2 && freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, 'Dark Magician') || named(x, 'Buster Blader')),
    cost: function* (g, c, p) { yield* removeSpellCtrs(g, p, 2); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which monster?', g.p[p].gy.filter(x => named(x, 'Dark Magician') || named(x, 'Buster Blader')), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },

  'Mirage Dragon': { cont: noTrapsInBattle },

  // PARTIAL: its ATK gain applies through the whole Damage Step, not only during damage calculation.
  'Mirage Knight': {
    self: { atk: (g, c) => { if (!g.inDS || !g.battle) return 0; const { a, t } = g.battle; const o = a === c ? t : t === c ? a : null; return o && onField(o) ? baseAtk(o) : 0; } },
    effs: [lockInstall,
      { type: 'trig', on: (g, ev, c) => { if (ev.type === 'attack' && (ev.a === c || ev.t === c)) c.flags.mkBattle = g.turnNo; return false; }, res: noop },
      { type: 'trig', mand: true, label: 'Banish Mirage Knight', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.mkBattle === g.turnNo,
        res: function* (g, c) { if (onField(c) && faceUp(c)) { move(g, c, 'ban', { reason: 'effect' }); log(g, 'Mirage Knight was banished.'); } } }] },

  'Mirage of Nightmare': { effs: [
    { type: 'act', res: noop },
    { type: 'trig', loc: 'st', mand: true, opt: true, label: 'Draw until you have 4 cards',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; const n = Math.max(0, 4 - g.p[p].hand.length); if (!n) return; draw(g, p, n); c.flags.monDrew = n; c.flags.monTurn = g.turnNo; } },
    { type: 'trig', loc: 'st', mand: true, label: 'Discard at random',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.flags.monDrew > 0 && c.flags.monTurn < g.turnNo,
      res: function* (g, c, p) { const n = c.flags.monDrew; c.flags.monDrew = 0; if (!onField(c)) return; const h = g.p[p].hand; const xs = [];
        while (xs.length < n && xs.length < h.length) { const x = h[Math.floor(g.rnd() * h.length)]; if (!xs.includes(x)) xs.push(x); }
        for (const x of xs) move(g, x, 'gy', { reason: 'discard' }); if (xs.length) log(g, `${PN(g, p)} discarded ${xs.map(name).join(', ')} at random.`); } }] },

  'Mirage Tube': { effs: [{ type: 'act', cond: (g, c, p) => c.zone !== 'hand' && !!g.aw && !!g.aw.t && g.aw.t.ctrl === p && faceUp(g.aw.t),
    res: function* (g, c, p) { damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },

  // Damage calculation happens inside Mirror Gate's resolution (ruling), so no Damage Step cards or effects can be used.
  // PARTIAL: battle triggers that read the Damage Step events (afterCalc, dsEnd) don't see this battle.
  'Mirror Gate': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && !!g.aw.t && g.aw.t.ctrl === p && faceUp(g.aw.t) && isEHERO(g.aw.t),
    target: function* (g, c, p, L2) { L2.data.a = g.aw.a; L2.data.t = g.aw.t; },
    res: function* (g, c, p, L2) { const { a, t } = L2.data, o = opp(p);
      if (!onField(a) || !onField(t) || a.zone !== 'm' || t.zone !== 'm' || a.ctrl !== o || t.ctrl !== p) return;
      const ia = g.p[o].m.indexOf(a), it = g.p[p].m.indexOf(t);
      g.p[o].m[ia] = t; g.p[p].m[it] = a; a.ctrl = p; t.ctrl = o; g.seq++;
      a.flags.ctrlUntil = g.turnNo; a.flags.ctrlFrom = o; t.flags.ctrlUntil = g.turnNo; t.flags.ctrlFrom = p;
      log(g, `Control of ${name(a)} and ${name(t)} was switched.`);
      const A = atk(g, a);
      if (t.pos === 'atk') { const T = atk(g, t);
        if (A > T) { damage(g, o, A - T, { battle: true, src: a, srcP: p }); destroy(g, [t], { battle: true, killer: a, by: p }); }
        else if (A < T) { damage(g, p, T - A, { battle: true, src: t, srcP: o }); destroy(g, [a], { battle: true, killer: t, by: o }); }
        else if (A > 0) destroy(g, [a, t], { battle: true, by: p }); }
      else { const Dv = def(g, t); if (A > Dv) destroy(g, [t], { battle: true, killer: a, by: p }); else if (A < Dv) damage(g, p, Dv - A, { battle: true, src: t, srcP: o }); }
      g.attackNegated = false; } }] },

  // Only monsters Special Summoned from the opponent's Main Deck (seen in the same event group as the summon).
  'Mirror of Oaths': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.sw && g.sw.p !== p && fromDeckSS(g).some(x => onField(x)),
    target: function* (g, c, p, L2) { L2.data.cs = fromDeckSS(g); },
    res: function* (g, c, p, L2) { const n = destroy(g, L2.data.cs.filter(x => onField(x) && x.zone === 'm'), { by: p, src: c }).length; if (n) draw(g, p, 1); } }] },

  // PARTIAL: the Spirit's return is always skipped while equipped (no prompt), read as its End Phase trigger that returns it.
  'Mirror of Yata': {
    cont: { ...eqBonus(0, 0),
      forbid: (g, src, a) => a.type === 'activate' && a.eff && a.eff.type === 'trig' && src.equipTo === a.c.u && g.phase === 'end' && /return|hand/i.test(a.eff.label || ''),
      replaceDestroy: (g, src, m, o) => { if (!o.battle || src.equipTo !== m.u || !onField(src)) return false; move(g, src, 'gy', { reason: 'effect', destroyed: true }); log(g, `Mirror of Yata was destroyed instead of ${name(m)}.`); return true; } },
    effs: [equipAct(isSpirit, 'Equip Mirror of Yata to which Spirit monster?')] },

  'Mirror Wall': { effs: [
    { type: 'act', res: function* (g, c, p) { const b = g.aw || g.battle; if (b && b.a && b.a.ctrl !== p) halve(g, c, b.a); } },
    { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'attack' && ev.a.ctrl !== c.ctrl && faceUp(c)) halve(g, c, ev.a); return false; }, res: noop },
    { type: 'trig', loc: 'any', on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.wasField) for (const m of fieldMons(g)) m.mods = m.mods.filter(x => x.mw !== c.u); return false; }, res: noop },
    { type: 'trig', loc: 'st', mand: true, label: 'Pay 2000 LP or destroy it', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 2000 && (yield* yn(g, p, 'Pay 2000 LP to keep Mirror Wall?'))) pay(g, p, 2000); else destroy(g, [c], { rule: true }); } }] },

  'Monster Gate': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => monsOf(g, p).length > 0 && g.p[p].deck.some(canNS),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 monster', monsOf(g, p), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${x.pos === 'set' ? 'a face-down monster' : name(x)}.`); },
    res: function* (g, c, p) { const [m, rest] = excavate(g, p); log(g, `${PN(g, p)} excavated ${rest.length + (m ? 1 : 0)} card${rest.length + (m ? 1 : 0) === 1 ? '' : 's'}.`);
      sendAll(g, rest); if (m && !ss(g, p, m, 'atk') && m.zone === 'deck') move(g, m, 'gy', { reason: 'effect' }); } }] },

  'Monster Reborn': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && allCards(g, 'gy').some(x => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' })),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which monster from either GY?', allCards(g, 'gy').filter(x => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' })), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },

  'Monster Recovery': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(m => m.owner === p) && g.p[p].hand.every(x => x.owner === p),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Shuffle which of your monsters into the Deck?', monsOf(g, p).filter(m => m.owner === p), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.zone !== 'm') return; const nm = D(t).n; move(g, t, 'deck', { reason: 'effect', by: p });
      const h = g.p[p].hand.slice(); for (const x of h) move(g, x, 'deck', { reason: 'effect' }); shuffleDeck(g, p);
      log(g, `${PN(g, p)} shuffled ${nm} and ${h.length} card${h.length === 1 ? '' : 's'} from the hand into the Deck.`);
      if (h.length) draw(g, p, h.length); } }] },

  'Mysterious Guard': { effs: [{ type: 'trig', mand: true, label: 'Return monsters', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { const all = fieldMons(g).filter(faceUp);
      const [a] = yield* pick(g, p, 'Return which face-up monster to the top of the Deck?', all, 1, 1, 'bad'); L2.t = a ? [a] : []; L2.data.a = a;
      const warrior = monsOf(g, p).some(x => faceUp(x) && race(x) === 'Warrior');
      const rest = all.filter(x => x !== a);
      if (a && warrior && rest.length && (yield* yn(g, p, 'Target a second monster to return to the hand?'))) { const [b] = yield* pick(g, p, 'Return which monster to the hand?', rest, 1, 1, 'bad'); if (b) { L2.t.push(b); L2.data.b = b; } } },
    res: function* (g, c, p, L2) { const { a, b } = L2.data;
      if (a && onField(a) && faceUp(a)) { move(g, a, 'deckTop', { reason: 'effect', by: p }); log(g, `${D(a).n} was put on top of the Deck.`); }
      if (b && onField(b) && faceUp(b) && monsOf(g, p).some(x => faceUp(x) && race(x) === 'Warrior')) { move(g, b, 'hand', { reason: 'effect', by: p }); log(g, `${D(b).n} returned to the hand.`); } } }] },

  'Mysterious Puppeteer': { effs: [{ type: 'trig', mand: true, label: 'Gain 500 LP', on: (g, ev) => ev.type === 'summon' && ['normal', 'tribute', 'flip'].includes(ev.how),
    res: function* (g, c, p) { gain(g, p, 500); } }] },

  'Mysterious Triangle': { effs: [
    { type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(x => ctr(x, 'A') > 0),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster with an A-Counter?', fieldMons(g).filter(x => ctr(x, 'A') > 0), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || ctr(t, 'A') < 1 || !destroy(g, [t], { by: p, src: c }).length) return;
        const cs = g.p[p].deck.filter(x => isMon(x) && /^Alien/.test(D(x).n) && lv(x) === 4); if (!cs.length || freeM(g, p) < 0) return;
        if (!(yield* yn(g, p, 'Special Summon a Level 4 Alien from your Deck?'))) return;
        const [x] = yield* pick(g, p, 'Special Summon which Alien?', cs, 1, 1, 'good'); if (x && ss(g, p, x, 'atk')) { x.flags.triangle = g.turnNo; SC12(g).tri = { u: c.u, turn: g.turnNo }; } shuffleDeck(g, p); } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the Alien',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && SC12(g).tri && SC12(g).tri.u === c.u && SC12(g).tri.turn === g.turnNo && fieldMons(g).some(x => x.flags.triangle === g.turnNo),
      res: function* (g, c, p) { SC12(g).tri = null; destroy(g, fieldMons(g).filter(x => x.flags.triangle === g.turnNo), { by: p }); } }] },

  'Mystic Box': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => monsOf(g, opp(p)).length > 0 && monsOf(g, p).length > 0,
    target: function* (g, c, p, L2) {
      const [a] = yield* tgt(g, p, L2, 'Destroy which of their monsters?', monsOf(g, opp(p)), 1, 1, 'bad');
      const [b] = yield* tgt(g, p, L2, 'Give which of your monsters to your opponent?', monsOf(g, p), 1, 1, 'cost');
      L2.t = [a, b].filter(Boolean); },
    res: function* (g, c, p, L2) { const [a, b] = L2.t; if (!a || !onField(a) || !destroy(g, [a], { by: p, src: c }).length) return;
      if (b && onField(b) && b.zone === 'm' && b.ctrl === p) takeControl(g, opp(p), b, false); } }] },

  'Mystic Lamp': { self: { directAttack: true } },

  'Mystic Plasma Zone': { cont: { atk: (g, src, m) => attr(m) === 'DARK' ? 500 : 0, def: (g, src, m) => attr(m) === 'DARK' ? -400 : 0 }, effs: [{ type: 'act', res: noop }] },

  // Negates the Continuous Spell it answers (and any other on the chain), and no Continuous Spell can be activated or use
  // an effect for the rest of the turn. Every face-up Continuous Spell's lasting effect is negated for the turn too (a GY
  // negates hook). PARTIAL: that part stops early if this card leaves the GY during the turn.
  'Mystic Probe': { cont: { loc: 'gy', negates: (g, src, c) => SC12(g).probe === g.turnNo && isSpell(c) && D(c).sub === 'Continuous' && onField(c) },
    effs: [{ type: 'act',
    cond: (g, c, p, x) => spellTrapAct(x.top) && isSpell(x.top.c) && D(x.top.c).sub === 'Continuous' && !x.top.negated,
    res: function* (g, c, p) { for (const l of g.chain) if (isSpell(l.c) && D(l.c).sub === 'Continuous' && !l.negated) { l.negBy = p; negate(g, l, false); }
      const turn = g.turnNo; addRule(g, (g2, a) => a.type === 'activate' && g2.turnNo === turn && isSpell(a.c) && D(a.c).sub === 'Continuous', { end: turn });
      SC12(g).probe = turn; g.seq++; log(g, 'Continuous Spell Cards are negated this turn.'); } }] },

  'Mystic Swordsman LV2': { effs: [swordDS(), swordKill, swordUp('Mystic Swordsman LV4')] },
  'Mystic Swordsman LV4': { effs: [lockInstall, swordDS(), swordKill, swordUp('Mystic Swordsman LV6')] },
  'Mystic Swordsman LV6': { effs: [lockInstall, swordDS(function* (g, c, p, L2) { const t = L2.ev.t; if (!t || !onField(t) || t.zone !== 'm') return;
    const top = t.owner === opp(p) && !has(g, t, 'noEffectDestroy') && (yield* yn(g, p, "Place it on top of your opponent's Deck instead of the GY?"));
    if (!top) { killFoe(g, c, p, t); return; }
    move(g, t, 'deckTop', { reason: 'effect', destroyed: true, by: p }); log(g, `${D(t).n} was destroyed and put on top of the Deck.`); })] },

  // One Spell & Trap Zone per face-up copy is held back: a Spell/Trap can't be Set or activated from the hand into the last
  // free zones. The extra draw is offered after the normal draw. PARTIAL: other ways into a zone (Union equips) aren't
  // stopped, the zone isn't chosen, and the draw uses a chain link.
  'Mystical Cards of Light': {
    cont: { forbid: (g, src, a) => { const p = src.ctrl; if (a.p !== p) return false;
      const locks = stOf(g, p).filter(x => faceUp(x) && named(x, 'Mystical Cards of Light')).length; if (!locks) return false;
      const fromHand = (a.type === 'setST' || (a.type === 'activate' && a.eff && a.eff.type === 'act')) && a.c && a.c.zone === 'hand' && isST(a.c) && D(a.c).sub !== 'Field';
      return fromHand && g.p[p].st.filter(z => !z).length <= locks; } },
    effs: [{ type: 'act', cond: (g, c, p) => g.p[p].st.filter(z => !z).length >= (c.zone === 'hand' ? 2 : 1), res: noop },
      { type: 'trig', loc: 'st', label: 'Draw 1 more card',
        on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && g.phase === 'draw' && g.tp === c.ctrl && ev.c.owner === c.ctrl,
        cond: (g, c, p) => g.p[p].deck.length > 0 && SC12(g).mcol !== g.turnNo && stOf(g, p).some(x => x !== c && faceUp(x) && named(x, 'Mystical Cards of Light')),
        res: function* (g, c, p) { if (SC12(g).mcol === g.turnNo) return; SC12(g).mcol = g.turnNo; draw(g, p, 1); } }] },

  'Mystical Knight of Jackal': { effs: [{ type: 'trig', when: true, label: 'Put it on top of the Deck',
    on: (g, ev, c) => battleKill(ev, c) && ev.c.owner !== c.ctrl && ev.prevCtrl === ev.c.owner,
    res: function* (g, c, p, L2) { const x = L2.ev.c; if (x.zone !== 'gy') return; move(g, x, 'deckTop', { reason: 'effect', by: p }); log(g, `${D(x).n} was put on top of the Deck.`); } }] },

  'Mystical Moon': { cont: eqBonus(300, 300), effs: [equipAct(m => race(m) === 'Beast-Warrior', 'Equip Mystical Moon to which Beast-Warrior?')] },

  // ENGINE: substitute Fusion Materials ("You can substitute this card for any 1 Fusion-Material Monster") aren't read by
  // fusionRecipe(); it plays as its printed stats.
  'Mystical Sheep 1': { effs: [] },

  // Destroys a Spell/Trap (targeted). Only as Chain Link 3 or higher, and not when 2 links in the chain share a name.
  'Mystical Wind Typhoon': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p, x) => !!x.top && g.chain.length >= 2 && new Set(g.chain.map(l => D(l.c).n)).size === g.chain.length && stOnField(g).some(y => y !== c),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOnField(g).filter(y => y !== c), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },

  'Needle Burrower': { effs: [{ type: 'trig', mand: true, label: 'Inflict damage', on: (g, ev, c) => battleKill(ev, c),
    res: function* (g, c, p, L2) { const n = 500 * num(D(L2.ev.c).lv); if (n) damage(g, opp(p), n, { src: c, srcP: p }); } }] },

  'Needle Ceiling': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).length >= 4,
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(faceUp), { by: p, src: c }); } }] },

  // The opponent's zones count 1-5 from your right, which is their m[0] to m[4].
  'Needle Wall': { effs: [
    { type: 'act', res: noop },
    { type: 'trig', loc: 'st', mand: true, opt: true, tags: { destroy: 1 }, label: 'Roll a die',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; let n = 6; for (let i = 0; i < 20 && n === 6; i++) n = dice(g, p); if (n === 6) return;
        const m = g.p[opp(p)].m[n - 1]; if (m) destroy(g, [m], { by: p, src: c }); else log(g, 'There was no monster in that zone.'); } }] },

  'Needle Worm': { effs: [{ type: 'trig', mand: true, label: "Send 5 of their cards to the GY", on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { L.mill(g, opp(p), 5); } }] },

  // The 800 is taken as each token is destroyed (no chain link, ruling).
  'Nightmare Archfiends': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => monsOf(g, p).length > 0 && nFreeM(g, opp(p)) >= 3,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 monster', monsOf(g, p), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${x.pos === 'set' ? 'a face-down monster' : name(x)}.`); },
      res: function* (g, c, p) { if (nFreeM(g, opp(p)) < 3) return; const ts = tokens(g, opp(p), { n: 'Nightmare Archfiend Token', a: 'DARK', r: 'Fiend', lv: 6, atk: 2000, def: 2000 }, 3, 'atk'); for (const t of ts) t.flags.nmArch = c.u; } },
    { type: 'trig', loc: 'any', on: (g, ev, c) => { if (ev.type === 'move' && ev.destroyed && ev.wasField && ev.snap && ev.snap.flags && ev.snap.flags.nmArch === c.u) damage(g, ev.prevCtrl, 800, { src: c, srcP: c.owner }); return false; }, res: noop }] },

  'Nightmare Horse': { self: { directAttack: true } },

  'Nightmare Penguin': { cont: { atk: (g, src, m) => m.ctrl === src.ctrl && faceUp(m) && attr(m) === 'WATER' ? 200 : 0 },
    effs: [{ type: 'trig', mand: true, label: 'Return a card to the hand', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
      cond: (g, c, p) => fieldOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which of their cards to the hand?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) { const n = faceUp(t) ? name(t) : 'A face-down card'; move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${n} returned to the hand.`); } } }] },

  // Only in your Standby Phase: offered there while Set. The discard is its cost.
  'Non Aggression Area': { effs: [trapTrig({ label: 'Non Aggression Area',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    cond: (g, c, p) => g.p[p].hand.length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    res: function* (g, c, p) { const o = opp(p), t = g.turnNo + 1; addRule(g, (g2, a) => ['ns', 'set', 'ss'].includes(a.type) && a.p === o && g2.turnNo === t, { end: t }); log(g, `${PN(g, o)} can't Normal Summon, Set or Special Summon next turn.`); } })] },

  // Fusion Summons are blocked, and so are the Spells that Fusion Summon (Polymerization, Miracle Fusion, Power Bond).
  'Non-Fusion Area': {
    cont: { forbid: (g, src, a) => (a.type === 'ss' && a.how === 'fusion') || (a.type === 'activate' && a.eff && a.eff.type === 'act' && isSpell(a.c) && /Fusion Summon/i.test(txt(a.c))) },
    effs: [{ type: 'act', res: noop }] },

  // PARTIAL: "unaffected by Spell effects" covers destruction only (the engine's unaffectedSpells flag).
  'Non-Spellcasting Area': { cont: { grant: (g, src, m, flag) => flag === 'unaffectedSpells' && m.zone === 'm' && faceUp(m) && !isEffMon(m) }, effs: [{ type: 'act', res: noop }] },

  'Ocean Dragon Lord - Neo-Daedalus': {
    proc: { label: 'Special Summon (Tribute Levia-Dragon - Daedalus)', cond: (g, c, p) => monsOf(g, p).some(x => named(x, 'Levia-Dragon - Daedalus')),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Tribute which Levia-Dragon - Daedalus?', monsOf(g, p).filter(x => named(x, 'Levia-Dragon - Daedalus')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Levia-Dragon - Daedalus.`); } } },
    effs: [lockInstall,
      { type: 'ign', label: 'Send Umi: send every other card to the GY',
        cond: (g, c, p) => !!umiOf(g, p),
        cost: function* (g, c, p) { const u = umiOf(g, p); move(g, u, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(u).n} to the GY.`); },
        res: function* (g, c, p) { const grp = g.group; const xs = [...allField(g).filter(x => x !== c), ...g.p[0].hand, ...g.p[1].hand];
          for (const x of xs) if (x.zone !== 'gone') move(g, x, 'gy', { reason: 'effect', by: p, group: grp }); log(g, 'Every other card in the hands and on the field was sent to the GY.'); } }] },

  'Ojama Delta Hurricane!!': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => ['Ojama Green', 'Ojama Yellow', 'Ojama Black'].every(n => monsOf(g, p).some(x => faceUp(x) && name(x) === n)) && fieldOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { destroy(g, fieldOf(g, opp(p)), { by: p, src: c }); } }] },

  'Ojama King': {
    cont: { forbid: (g, src, a) => ['ns', 'set', 'ss'].includes(a.type) && a.p === opp(src.ctrl) && (() => { const Z = kingZones(g, src); return !g.p[Z.p].m.some((x, i) => !x && !Z.zs.includes(i)); })() },
    effs: [{ type: 'trig', on: (g, ev, c) => {
      if (evSummoned(ev, c) || (ev.type === 'flip' && ev.c === c)) { c.flags.ojamaZones = null; const Z = kingZones(g, c); if (Z.zs.length) log(g, `${PN(g, Z.p)}'s Monster Zones ${Z.zs.map(i => i + 1).join(', ')} can't be used.`); }
      if (ev.type === 'move' && ev.to === 'm' && ev.c !== c && ev.c.ctrl === opp(c.ctrl) && onField(c) && faceUp(c)) {
        const Z = kingZones(g, c), row = g.p[Z.p].m, i = row.indexOf(ev.c);
        if (i >= 0 && Z.zs.includes(i)) { const j = row.findIndex((x, k) => !x && !Z.zs.includes(k)); if (j >= 0) { row[i] = null; row[j] = ev.c; g.seq++; } }
      }
      return false; }, res: noop }] },

  'Ojama Red': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon Ojamas from your hand',
    on: (g, ev, c) => evSummoned(ev, c, ['normal']),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && /Ojama/.test(D(x).n)),
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isMon(x) && /Ojama/.test(D(x).n)); const n = Math.min(4, nFreeM(g, p), cs.length); if (!n) return;
      const xs = yield* pick(g, p, `Special Summon up to ${n} Ojama monsters`, cs, 1, n, 'good'); for (const x of xs) if (x.zone === 'hand') ss(g, p, x, 'atk'); } }] },

  'Ojama Trio': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => nFreeM(g, opp(p)) >= 3,
    res: function* (g, c, p) { const ts = tokens(g, opp(p), { n: 'Ojama Token', a: 'LIGHT', r: 'Beast', lv: 2, atk: 0, def: 1000 }, 3, 'def', { noTribute: true }); for (const t of ts) t.flags.ojama = c.u; } },
    { type: 'trig', loc: 'gy', mand: true, label: '300 damage', on: (g, ev, c) => ev.type === 'move' && ev.destroyed && ev.wasField && ev.snap && ev.snap.flags && ev.snap.flags.ojama === c.u,
      res: function* (g, c, p, L2) { damage(g, L2.ev.prevCtrl, 300, { src: c, srcP: p }); } }] },

  // Activated with 3 Spell Counters; once per turn in your turn (Spell Speed 2) move 1 to another face-up card that uses them.
  'Pitch-Black Power Stone': { effs: [
    { type: 'act', res: function* (g, c) { if (onField(c)) { addCtr(g, c, 'spell', 3); log(g, 'Pitch-Black Power Stone got 3 Spell Counters.'); } } },
    { type: 'quick', loc: 'st', opt: true, label: 'Move a Spell Counter',
      cond: (g, c, p) => g.tp === p && ctr(c, 'spell') > 0 && ctrTargets(g, c).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Place a Spell Counter on which card?', ctrTargets(g, c), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { if (!onField(c) || ctr(c, 'spell') < 1) return; addCtr(g, c, 'spell', -1); const t = live(L2)[0];
        if (t && faceUp(t)) { addCtr(g, t, 'spell', 1); log(g, `A Spell Counter moved to ${name(t)}.`); }
        if (ctr(c, 'spell') === 0) destroy(g, [c], { by: p }); } }] },

  'Pitch-Black Warwolf': { cont: noTrapsInBattle },

  'Pitch-Dark Dragon': {
    cont: { ...unionCont,
      atk: (g, src, m) => src.zone === 'st' && src.flags.union && src.equipTo === m.u ? 400 : 0,
      def: (g, src, m) => src.zone === 'st' && src.flags.union && src.equipTo === m.u ? 400 : 0,
      grant: (g, src, m, flag) => flag === 'piercing' && src.zone === 'st' && src.flags.union && src.equipTo === m.u },
    effs: unionEffs(x => name(x) === 'Dark Blade', 'Equip Pitch-Dark Dragon to which Dark Blade?') },

  'Poison Chain': { effs: [
    { type: 'act', res: noop },
    { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'attack' && ev.p === c.ctrl) c.flags.pcAtk = g.turnNo; return false; }, res: noop },
    { type: 'trig', loc: 'st', label: "Send cards from the top of their Deck",
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl && c.flags.pcAtk !== g.turnNo,
      cond: (g, c, p) => { const n = chains(g, p); return n > 0 && g.p[opp(p)].deck.length >= n; },
      res: function* (g, c, p) { const n = chains(g, p); if (n) L.mill(g, opp(p), n); } }] },

  'Poison Draw Frog': { effs: [
    { type: 'trig', on: (g, ev, c) => { if (ev.type === 'afterCalc' && ev.t === c && ev.flipped) c.flags.fdHit = true; return false; }, res: noop },
    { type: 'trig', loc: 'gy', when: true, label: 'Draw 1 card',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy' && ev.snap && ev.snap.faceUp && !(ev.battle && ev.snap.flags && ev.snap.flags.fdHit),
      cond: (g, c, p) => g.p[p].deck.length > 0,
      res: function* (g, c, p) { draw(g, p, 1); } }] },

  // No chain link (ruling: Barrel Behind the Door can't answer it).
  'Poison Fangs': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'damage' && ev.battle && ev.p === opp(c.ctrl) && ev.src && isMon(ev.src) && race(ev.src) === 'Beast' && g.p[ev.p].lp > 0) damage(g, ev.p, 500, { src: c, srcP: c.ctrl }); return false; }, res: noop }] },

  'Poison Mummy': { effs: [{ type: 'trig', mand: true, label: '500 damage', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },

  'Poison of the Old Man': { effs: [{ type: 'act',
    cost: function* (g, c, p, L2) { L2.data.i = yield* choose(g, p, 'Poison of the Old Man: choose', ['Gain 1200 LP', 'Inflict 800 damage']); },
    res: function* (g, c, p, L2) { if (L2.data.i) damage(g, opp(p), 800, { src: c, srcP: p }); else gain(g, p, 1200); } }] },

  // Banished after it resolves (a negated one goes to the GY). 1 per turn per player.
  'Pot of Benevolence': { effs: [{ type: 'act', cond: (g, c, p) => allCards(g, 'gy').length >= 2 && !(SC12(g).benev && SC12(g).benev[p] === g.turnNo),
    after: (g, c, p) => { (SC12(g).benev || (SC12(g).benev = [0, 0]))[p] = g.turnNo; },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Shuffle which 2 cards from the GYs into the Deck?', allCards(g, 'gy'), 2, 2, 'good'); },
    res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'deck', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.map(x => D(x).n).join(', ')} ${xs.length > 1 ? 'were' : 'was'} shuffled into the Deck.`);
      if (onField(c)) { L2.keep = true; move(g, c, 'ban', { reason: 'rule' }); log(g, 'Pot of Benevolence was banished.'); } } }] },

  'Pot of Generosity': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.filter(x => x !== c).length >= 2,
    res: function* (g, c, p) { if (g.p[p].hand.length < 2) return; const xs = yield* pick(g, p, 'Return 2 cards from your hand to the Deck', g.p[p].hand, 2, 2, 'cost');
      for (const x of xs) move(g, x, 'deck', { reason: 'effect' }); shuffleDeck(g, p); log(g, `${PN(g, p)} returned 2 cards to the Deck.`); } }] },

  'Pot of Greed': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 2, res: function* (g, c, p) { draw(g, p, 2); } }] },
});

// Goat-only card with the same text
E.addScripts({ 'Mystical Sheep #1': { effs: [] } }, 'goat'); // ENGINE: substitute Fusion Materials

function fromDeckSS(g) { if (!g.sw) return []; const grp = g.sw.group; return g.sw.cs.filter(x => g.events.some(e => e.type === 'move' && e.c === x && e.group === grp && e.from === 'deck' && e.to === 'm')); }
function umiOf(g, p) { const f = g.p[p].fz; return f && faceUp(f) && (named(f, 'Umi') || named(f, 'A Legendary Ocean')) ? f : null; }
function ctrTargets(g, c) { return allField(g).filter(x => x !== c && faceUp(x) && /Spell Counter/i.test(D(x).tx || '')); }
function chains(g, p) { return monsOf(g, p).filter(x => faceUp(x) && /^Iron Chain/.test(name(x))).length; }
})();
