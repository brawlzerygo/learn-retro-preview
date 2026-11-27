/* Full pool batch 22: Fuhma Shuriken to Hidden Spellbook (build/batches/full/full-22.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text; cards with a
 Goat-only script elsewhere (Fusilier Dragon, Fusionist, Gate Guardian, Gatling Dragon, Gear Golem, Gearfried the Iron Knight,
 Gigantes, Gilasaurus, Giltia, Golem Sentry, Gorgon's Eye, Granmarg, Graverobber, Greenkappa, Gyaku-Gire Panda, Hallowed Life
 Barrier, Hayabusa Knight, Heavy Slump) are ported here as the shared version (the Goat ones still win while Goat is loaded). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, setFaceDown, negate, addMod,
  equip, addRule, ritualSummon, canRitual, coin, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv,
  baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, shuffleDeck, log, PN, live, opp, stOnField,
  evSummoned, emit, forbid, stat, negd } = L;
const atk = L.atk;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
// a coin call: the caller picks Heads or Tails at random, the coin decides
function callCoin(g, p) { const call = g.rnd() < 0.5; log(g, `${PN(g, p)} called ${call ? 'Heads' : 'Tails'}.`); const right = coin(g, p) === call; log(g, right ? 'The call was right.' : 'The call was wrong.'); return right; }
// A Normal Spell/Trap that is face-up on the field is the one resolving right now (Release Restraint)
const resolving = (g, p, n) => stOf(g, p).some(x => faceUp(x) && named(x, n));
const equipsOn = (g, c) => allField(g).filter(x => x.zone === 'st' && x.equipTo === c.u);
function* discardOne(g, p, not) { const cs = g.p[p].hand.filter(x => x !== not); const [x] = yield* pick(g, p, 'Discard 1 card', cs, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } return x; }
function toBottom(g, x) { move(g, x, 'deckTop', { reason: 'effect' }); const d = g.p[x.owner].deck; const i = d.indexOf(x); if (i >= 0) { d.splice(i, 1); d.unshift(x); } }
function* ssFrom(g, p, f, text, zones, pos = 'atk') {
  const cs = zones.flatMap(z => g.p[p][z]).filter(f); if (!cs.length || freeM(g, p) < 0) { if (zones.includes('deck')) shuffleDeck(g, p); return null; }
  const [x] = yield* pick(g, p, text, cs, 1, 1, 'good'); let done = false;
  if (x) { const fromDeck = x.zone === 'deck'; done = ss(g, p, x, pos); if (fromDeck) shuffleDeck(g, p); }
  return done ? x : null;
}
// A battle position change by a card effect, announced (Dream Clown and the like watch for it)
function flipPos(g, c) { if (!onField(c) || c.zone !== 'm' || !faceUp(c)) return; const from = c.pos; c.pos = from === 'atk' ? 'def' : 'atk'; g.seq++; log(g, `${name(c)} was changed to ${c.pos === 'atk' ? 'Attack' : 'Defense'} Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from }); }
// An Equip Spell: target a face-up monster (filter), equip it at resolution. Bonuses go in the card's cont.
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && filter(t)) equip(g, c, t); } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
// "If this card is flipped face-up" style Flip effects (FLIP:)
const flipOn = (g, ev, c) => ev.type === 'flip' && ev.c === c;
// A Trap that responds to an event the engine opens no window for (classic-5.js trapTrig): offered as a trigger while Set
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });
// A chain watcher: a Spell Speed 3 effect that is never offered; its cond runs each time a player could respond to the chain,
// so it sees every link as it is added (Gora Turtle of Illusion, Fushioh Richie, Heart of Clear Water).
// ENGINE: no hook for "negate effects that target this card" or for "the link resolving right now"; this stands in for it.
const watcher = (loc, fn) => ({ type: 'quick', speed: 3, ds: true, loc, label: 'Watch the chain', cond: (g, c, p, x) => { fn(g, c, p, x); return false; }, res: noop });

/* "Cannot be Special Summoned" and "Must first be Special Summoned ..." locks. One duel rule, installed by the first event any of
 these cards sees. A card that was properly Summoned once (c.f22nomi) can be revived later.
 ENGINE: no general "can't be Special Summoned" flag; an effect that Special Summons these from the hand is not stopped. */
const reviveOk = c => !['deck', 'gy', 'ban'].includes(c.zone) || (c.zone !== 'deck' && !!c.f22nomi);
const LOCKS = {
  'Fushi No Tori': () => true,
  'Garuda the Wind Spirit': (g, a) => !reviveOk(a.c),
  'Gigantes': (g, a) => !reviveOk(a.c),
  "Gradius' Option": (g, a) => !reviveOk(a.c),
  'Gate Guardian': (g, a) => !reviveOk(a.c),
  // from the hand or Deck by Great Dezard's effect (full-09.js), revived once properly summoned
  'Fushioh Richie': (g, a) => ['gy', 'ban'].includes(a.c.zone) && !a.c.f22nomi,
  // only with Release Restraint (from the hand or Deck), revived once properly summoned
  'Gearfried the Swordmaster': (g, a) => (['hand', 'deck'].includes(a.c.zone) && !resolving(g, a.p, 'Release Restraint')) || (['gy', 'ban'].includes(a.c.zone) && !a.c.f22nomi),
  'Helpoemer': (g, a) => a.c.zone === 'gy',
};
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: (g) => { if (!g.f22lock) { g.f22lock = true; addRule(g, (g2, a) => { if (a.type !== 'ss' || !a.c || a.c.id == null) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); } return false; } };
// marks a proper summon (from the hand or Deck, by its own rule or the card that may summon it)
const nomiMark = { type: 'trig', loc: 'any', res: noop,
  on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.to === 'm' && ['hand', 'deck'].includes(ev.from) && ev.reason === 'summon') c.f22nomi = true; return false; } };
// Spirit return (full-09.js): during the End Phase of the turn it was Normal Summoned or flipped face-up
const spiritReturn = { type: 'trig', mand: true, label: 'Return to the hand',
  on: (g, ev, c) => {
    if ((ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how)) || (ev.type === 'flip' && ev.c === c)) c.flags.spirit = g.turnNo;
    return ev.type === 'phase' && ev.ph === 'end' && c.flags.spirit === g.turnNo; },
  res: function* (g, c) { if (onField(c) && faceUp(c)) { move(g, c, 'hand', { reason: 'effect' }); log(g, `${name(c)} returned to the hand.`); } } };
// "Once per turn, you can change this card to face-down Defense Position" (goat-5.js)
const selfFaceDown = { type: 'ign', opt: true, label: 'Turn face-down', cond: (g, c) => c.turnIn !== g.turnNo && !c.posChanged,
  res: function* (g, c) { if (onField(c) && faceUp(c)) { setFaceDown(g, c); c.posChanged = true; } } };
// Union monsters (full-02.js): once per turn equip to a monster you control, or unequip and Special Summon in Attack Position;
// a monster has at most 1 Union; "if the equipped monster would be destroyed, destroy this card instead".
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
const unionReplace = (g, src, m, o) => {
  if (o.rule || src.zone !== 'st' || src.equipTo !== m.u || !src.flags.union) return false;
  move(g, src, 'gy', { reason: o.battle ? 'battle' : 'effect', destroyed: true, by: o.by }); log(g, `${D(src).n} was destroyed instead of ${name(m)}.`); return true; };
// Ground Collapse: the zones every face-up copy holds, [{p, i}]
const gcZones = g => allField(g).filter(x => x.zone === 'st' && faceUp(x) && named(x, 'Ground Collapse') && x.flags.gcZones).flatMap(x => x.flags.gcZones);
const HARPIES = ['Harpie Lady', 'Harpie Lady 1', 'Harpie Lady 2', 'Harpie Lady 3', 'Cyber Harpie Lady', 'Harpie Lady Sisters'];
const isNinja = m => /Ninja/.test(name(m));
// Gamble: the turn the player skips
const skipped = (g, p) => !!(g.f22skip && g.f22skip[p] === g.turnNo);

E.addScripts({
  /* ----- Equip Spells ----- */
  'Fuhma Shuriken': { cont: eqBonus(700, 0),
    effs: [equipAct(isNinja, 'Equip to which Ninja monster?'),
      { type: 'trig', loc: 'gy', mand: true, label: 'Inflict 700 damage', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy',
        res: function* (g, c, p) { damage(g, opp(p), 700, { src: c, srcP: p }); } }] },
  // PARTIAL: any Ritual Monster in the GY can be summoned (the "properly Ritual Summoned before" ruling isn't tracked).
  // The banish when this card is destroyed uses a chain link (the ruling says it starts none).
  'Fulfillment of the Contract': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.p[p].lp > 800 && freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && D(x).k === 'ritual'),
      cost: function* (g, c, p) { pay(g, p, 800); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Ritual Monster from your GY?', g.p[p].gy.filter(x => isMon(x) && D(x).k === 'ritual'), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && onField(c) && ss(g, p, t, 'atk') && equip(g, c, t)) c.flags.foc = t.u; } },
    { type: 'trig', loc: 'any', mand: true, label: 'Banish the equipped monster', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !!(ev.snap && ev.snap.flags && ev.snap.flags.foc),
      res: function* (g, c, p, L2) { const t = fieldMons(g).find(x => x.u === L2.ev.snap.flags.foc); if (t) { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished.`); } } }] },
  // Each of the equipped monster's controller's Standby Phases: -300 ATK for a non-Machine (kept on this card, gone when it leaves).
  'Germ Infection': {
    cont: { atk: (g, src, m) => src.equipTo === m.u && race(m) !== 'Machine' ? -300 * (src.flags.germ || 0) : 0 },
    effs: [equipAct(),
      { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'standby' && c.equipTo) { const m = fieldMons(g).find(x => x.u === c.equipTo); if (m && m.ctrl === ev.tp && race(m) !== 'Machine') { c.flags.germ = (c.flags.germ || 0) + 1; g.seq++; log(g, `${name(m)} lost 300 ATK to Germ Infection.`); } } return false; }, res: noop }] },
  'Gust Fan': { cont: eqBonus(400, -200), effs: [equipAct(m => attr(m) === 'WIND', 'Equip to which WIND monster?')] },
  // Not destroyed by battle or by a card effect that targets it; destroyed itself once the monster's ATK is 1300 or more.
  'Heart of Clear Water': {
    cont: { grant: (g, src, m, flag) => flag === 'noBattleDestroy' && src.equipTo === m.u,
      replaceDestroy: (g, src, m, o) => {
        if (o.battle || o.rule || src.equipTo !== m.u || !faceUp(src)) return false;
        const snapL = src.flags.hcwChain || []; const L2 = snapL.find(x => !g.chain.includes(x));
        if (!L2 || !L2.t.includes(m)) return false;
        log(g, `${name(m)} was not destroyed (Heart of Clear Water).`); return true; } },
    effs: [equipAct(),
      watcher('st', (g, c, p, x) => { c.flags.hcwChain = g.chain.length ? g.chain.slice() : []; }),
      { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy Heart of Clear Water',
        // its own activation is watched too: the equip at resolution announces nothing
        on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.to === 'st' && ev.reason === 'activate') return true; if (!c.equipTo || c.flags.hcwDue) return false; const m = fieldMons(g).find(x => x.u === c.equipTo); if (m && atk(g, m) >= 1300) { c.flags.hcwDue = true; return true; } return false; },
        cond: (g, c) => { const m = c.equipTo && fieldMons(g).find(x => x.u === c.equipTo); return !!m && atk(g, m) >= 1300; },
        res: function* (g, c, p) { c.flags.hcwDue = false; const m = fieldMons(g).find(x => x.u === c.equipTo); if (onField(c) && m && atk(g, m) >= 1300) destroy(g, [c], { by: p }); } }] },

  /* ----- Spirit, Ritual and summon-rule monsters ----- */
  'Fushi No Tori': { effs: [lockInstall, spiritReturn,
    { type: 'trig', mand: true, label: 'Gain LP equal to the damage', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
      res: function* (g, c, p, L2) { gain(g, p, L2.ev.n); } }] },
  // PARTIAL: the negation of Spells/Traps that target it happens as each one is chained (see watcher), not at resolution.
  'Fushioh Richie': { effs: [lockInstall, nomiMark, selfFaceDown,
    watcher('m', (g, c) => { for (const L2 of g.chain) if (!L2.negated && isST(L2.c) && L2.t.includes(c) && faceUp(c) && !negd(g, c)) { L2.negBy = c.ctrl; negate(g, L2, true); } }),
    { type: 'trig', tags: { ss: 1 }, label: 'Special Summon a Zombie from your GY', on: flipOn,
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && race(x) === 'Zombie' && !forbid(g, { type: 'ss', c: x, p, how: 'special' })),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Zombie from your GY?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Zombie' && !forbid(g, { type: 'ss', c: x, p, how: 'special' })), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  // tributes returns [0]: the engine skips a bare 0. A no-Tribute Normal Summon or Set halves its original ATK/DEF (1400/1000)
  // while face-up; Skill Drain gives the full stats back (the halving is its own effect). Turned face-down, it gets them back.
  'Fusilier Dragon, the Dual-Mode Beast': {
    self: { tributes: () => [0], atk: (g, c) => c.flags.fusHalf ? -1400 : 0, def: (g, c) => c.flags.fusHalf ? -1000 : 0 },
    effs: [{ type: 'trig', faceDownOk: true, res: noop, on: (g, ev, c) => {
      if (((ev.type === 'summon' && ev.cs.includes(c) && ev.how === 'normal') || (ev.type === 'set' && ev.c === c)) && !(c.tributes || []).length) c.flags.fusHalf = true;
      return false; } }] },
  'Garuda the Wind Spirit': {
    proc: { label: 'Special Summon (banish a WIND monster)', cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'WIND'),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish a WIND monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'WIND'), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${name(x)}.`); } } },
    effs: [lockInstall, nomiMark,
      { type: 'trig', label: 'Change a monster’s battle position', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp !== c.ctrl,
        cond: (g, c, p) => monsOf(g, opp(p)).some(faceUp),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change the battle position of which monster?', monsOf(g, opp(p)).filter(faceUp), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) flipPos(g, t); } }] },
  // Tributes the three from your field (face-up or face-down).
  'Gate Guardian': {
    proc: { label: 'Special Summon (Tribute Sanga, Kazejin and Suijin)',
      cond: (g, c, p) => ['Sanga of the Thunder', 'Kazejin', 'Suijin'].every(n => monsOf(g, p).some(m => named(m, n))),
      cost: function* (g, c, p, grp) { const ts = ['Sanga of the Thunder', 'Kazejin', 'Suijin'].map(n => monsOf(g, p).find(m => named(m, n))).filter(Boolean);
        for (const t of ts) move(g, t, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Sanga of the Thunder, Kazejin and Suijin.`); } },
    effs: [lockInstall, nomiMark] },
  // An Equip Spell's activation is the event watched (the equip itself announces nothing); the new equip is checked once the
  // chain has resolved. Other equips (Union, monster equips) are caught by comparing the equips at each event.
  'Gearfried the Swordmaster': { effs: [lockInstall, nomiMark,
    { type: 'trig', mand: true, ds: true, tags: { destroy: 1 }, label: 'Destroy a monster',
      on: (g, ev, c) => { if (ev.type === 'move' && ev.to === 'st' && ev.reason === 'activate' && isSpell(ev.c) && D(ev.c).sub === 'Equip') return true;
        const now = equipsOn(g, c).map(x => x.u), seen = c.flags.f22eq || []; c.flags.f22eq = now; if (now.some(u => !seen.includes(u))) { c.flags.f22due = true; return true; } return false; },
      cond: (g, c, p) => monsOf(g, opp(p)).length > 0 && (!!c.flags.f22due || equipsOn(g, c).some(x => !(c.flags.f22eq || []).includes(x.u))),
      target: function* (g, c, p, L2) { c.flags.f22due = false; c.flags.f22eq = equipsOn(g, c).map(x => x.u); yield* tgt(g, p, L2, 'Destroy which of their monsters?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  'Gigantes': {
    proc: { label: 'Special Summon (banish an EARTH monster)', cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'EARTH'),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish an EARTH monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'EARTH'), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${name(x)}.`); } } },
    effs: [lockInstall, nomiMark,
      { type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy all Spells and Traps', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
        res: function* (g, c, p) { destroy(g, stOnField(g), { by: p }); } }] },
  // Edison: the Special Summon takes the place of the Normal Summon (ruling), so it needs the turn's Normal Summon.
  'Gilasaurus': {
    proc: { label: 'Special Summon from the hand', cond: (g, c, p) => g.ns[p] < 1, cost: function* (g, c, p) { g.ns[p]++; c.flags.gila = true; } },
    effs: [{ type: 'trig', mand: true, tags: { ss: 1 }, label: 'Opponent may revive a monster', on: (g, ev, c) => evSummoned(ev, c, ['special']) && !!c.flags.gila,
      res: function* (g, c, p) { const o = opp(p); const ms = g.p[o].gy.filter(x => isMon(x) && !forbid(g, { type: 'ss', c: x, p: o, how: 'special' })); if (!ms.length || freeM(g, o) < 0) return;
        const [x] = yield* pick(g, o, 'Special Summon a monster from your GY? (none is fine)', ms, 0, 1, 'good');
        if (x) { const i = yield* choose(g, o, `${name(x)}: which position?`, ['Attack Position', 'Defense Position']); ss(g, o, x, i ? 'def' : 'atk'); } } }] },
  // Its ATK/DEF are the chosen Gradius's; destroyed when that Gradius leaves the field.
  "Gradius' Option": {
    proc: { label: 'Special Summon (target a Gradius you control)', cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && named(m, 'Gradius')),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Which Gradius?', monsOf(g, p).filter(m => faceUp(m) && named(m, 'Gradius')), 1, 1, 'good'); c.f22grad = x ? x.u : null; } },
    self: { atk: (g, c) => { const x = fieldMons(g).find(m => m.u === c.f22grad && faceUp(m)); return x ? stat(g, x, 'atk') : 0; },
      def: (g, c) => { const x = fieldMons(g).find(m => m.u === c.f22grad && faceUp(m)); return x ? stat(g, x, 'def') : 0; } },
    effs: [lockInstall, nomiMark,
      { type: 'trig', on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.wasField) c.f22grad = null; return false; }, loc: 'any', res: noop },
      { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy this card', on: (g, ev, c) => ev.type === 'move' && ev.wasField && c.f22grad != null && ev.c.u === c.f22grad && ev.c !== c,
        res: function* (g, c, p) { c.f22grad = null; if (onField(c)) destroy(g, [c], { by: p }); } }] },
  'Hamburger Recipe': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => canRitual(g, p, { monster: x => named(x, 'Hungry Burger') }),
    res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, 'Hungry Burger') }); } }] },
  'Helpoemer': { effs: [lockInstall,
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c) c.flags.helpBattle = ev.to === 'gy' && !!ev.battle && !!ev.destroyed; return false; } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Opponent discards 1 random card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'bpEnd' && ev.tp !== c.owner && !!c.flags.helpBattle,
      res: function* (g, c, p) { if (c.zone !== 'gy') return; const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, opp(p))} discarded ${name(x)} at random.`); } }] },

  /* ----- Fusions ----- */
  'Fusionist': { effs: [] },
  'Giltia the D. Knight': { effs: [] },
  // "As many as possible": the number of Heads, or every monster if there are fewer (ruling).
  'Gatling Dragon': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Toss 3 coins: destroy monsters',
    cond: g => fieldMons(g).length > 0,
    res: function* (g, c, p) { const h = [0, 1, 2].map(() => coin(g, p)).filter(Boolean).length;
      log(g, `${h} Head${h === 1 ? '' : 's'}.`); const ms = fieldMons(g), n = Math.min(h, ms.length); if (!n) return;
      const xs = yield* pick(g, p, `Destroy ${n} monster${n > 1 ? 's' : ''}`, ms, n, n, 'bad'); destroy(g, xs, { by: p }); } }] },

  /* ----- other monsters ----- */
  'Gale Lizard': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Return a monster to the hand', on: flipOn,
    cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which of their monsters to the hand?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone === 'm') { const n = faceUp(t) ? name(t) : 'A face-down monster'; move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${n} returned to the hand.`); } } }] },
  'Gear Golem the Moving Fortress': { self: { directAttack: (g, c) => c.flags.gearDirect === g.turnNo },
    effs: [{ type: 'ign', opt: true, label: 'Pay 800: attack directly', cond: (g, c, p) => g.phase === 'main1' && g.p[p].lp > 800,
      cost: function* (g, c, p) { pay(g, p, 800); },
      res: function* (g, c) { if (onField(c)) { c.flags.gearDirect = g.turnNo; log(g, `${name(c)} can attack directly this turn.`); } } }] },
  // Mandatory. PARTIAL: an equip that lands without an event (an Equip Spell resolving) is caught at the next game event.
  'Gearfried the Iron Knight': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the Equip Card',
    on: (g, ev, c) => equipsOn(g, c).length > 0 || (ev.type === 'move' && ev.to === 'st' && ev.reason === 'activate' && isSpell(ev.c) && D(ev.c).sub === 'Equip'),
    cond: (g, c) => equipsOn(g, c).length > 0,
    res: function* (g, c, p) { if (onField(c) && faceUp(c)) destroy(g, equipsOn(g, c), { by: p, src: c }); } }] },
  // At the end of the Damage Step, even if Getsu Fuhma itself was destroyed (ruling).
  'Getsu Fuhma': { effs: [{ type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the Fiend or Zombie',
    on: (g, ev, c) => { if (ev.type === 'dsStart' && (ev.a === c || ev.t === c) && onField(c)) { const o = ev.a === c ? ev.t : ev.a; c.f22getsu = o && { o, turn: g.turnNo }; } return ev.type === 'dsEnd' && !!c.f22getsu && c.f22getsu.turn === g.turnNo && (ev.a === c || ev.t === c || ev.a === c.f22getsu.o || ev.t === c.f22getsu.o); },
    res: function* (g, c, p) { const o = c.f22getsu && c.f22getsu.o; c.f22getsu = null; if (o && onField(o) && faceUp(o) && ['Fiend', 'Zombie'].includes(race(o))) destroy(g, [o], { by: p }); } }] },
  'Ghost Knight of Jackal': { effs: [{ type: 'trig', tags: { ss: 1 }, label: 'Special Summon the destroyed monster',
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.to === 'gy' && ev.prevCtrl !== c.ctrl && ev.c.owner !== c.ctrl,
    cond: (g, c, p, x) => freeM(g, p) >= 0 && x.ev.c.zone === 'gy' && !forbid(g, { type: 'ss', c: x.ev.c, p, how: 'special' }),
    res: function* (g, c, p, L2) { const t = L2.ev.c; if (t.zone === 'gy' && onField(c) && faceUp(c)) ss(g, p, t, 'def'); } }] },
  'Goddess of Whim': { effs: [{ type: 'ign', opt: true, label: 'Toss a coin',
    res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; const a = atk(g, c);
      if (callCoin(g, p)) { addMod(g, c, { atk: a, end: true }); log(g, `${name(c)}'s ATK was doubled.`); }
      else { addMod(g, c, { atk: -(a - Math.floor(a / 2)), end: true }); log(g, `${name(c)}'s ATK was halved.`); } } }] },
  // ENGINE: no substitute Fusion Material hook; it can't stand in for a Fusion Material yet.
  'Goddess with the Third Eye': { effs: [] },
  // PARTIAL: it can't turn itself face-down the turn it was summoned or changed position (the usual position-change limit).
  'Golem Sentry': { effs: [selfFaceDown,
    { type: 'trig', mand: true, label: 'Return a monster to the hand', on: (g, ev, c) => evSummoned(ev, c, ['flip']),
      cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which of their monsters to the hand?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone === 'm') { const n = faceUp(t) ? name(t) : 'A face-down monster'; move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${n} returned to the hand.`); } } }] },
  // Declared attacks only: an ATK raised after the declaration lets the attack go on (ruling).
  'Gora Turtle': { cont: { forbid: (g, src, a) => a.type === 'attack' && !negd(g, src) && !!a.c && faceUp(a.c) && atk(g, a.c) >= 1900 } },
  // PARTIAL: the negation happens as the opponent's Spell/Trap is chained (see watcher); an Equip Spell negated this way
  // goes to the GY instead of staying equipped.
  'Gora Turtle of Illusion': { effs: [
    watcher('m', (g, c) => { if (!faceUp(c) || negd(g, c)) return; for (const L2 of g.chain) if (!L2.negated && isST(L2.c) && L2.p !== c.ctrl && L2.t.includes(c)) { L2.negBy = c.ctrl; negate(g, L2, false); } })] },
  'Granadora': { effs: [
    { type: 'trig', mand: true, label: 'Gain 1000 LP', on: (g, ev, c) => evSummoned(ev, c), res: function* (g, c, p) { gain(g, p, 1000); } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Take 2000 damage', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.to === 'gy',
      res: function* (g, c) { damage(g, c.owner, 2000, { src: c, srcP: c.owner }); } }] },
  'Granmarg the Rock Monarch': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a Set card', on: (g, ev, c) => evSummoned(ev, c, ['tribute']),
    cond: g => allField(g).some(x => x.pos === 'set'),
    target: function* (g, c, p, L2) { const cs = allField(g).filter(x => x.pos === 'set'); const theirs = cs.filter(x => x.ctrl !== p);
      yield* tgt(g, p, L2, 'Destroy which Set card?', theirs.length ? [...theirs, ...cs.filter(x => x.ctrl === p)] : cs, 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2).filter(x => x.pos === 'set'), { by: p }); } }] },
  // Discarding is the cost; the second attack is for this turn.
  'Gray Wing': { effs: [{ type: 'ign', label: 'Discard: attack twice', cond: (g, c, p) => g.phase === 'main1' && g.p[p].hand.length > 0 && c.flags.extraAttack !== g.turnNo,
    cost: function* (g, c, p) { yield* discardOne(g, p); },
    res: function* (g, c) { if (onField(c) && faceUp(c)) { c.flags.extraAttack = g.turnNo; log(g, `${name(c)} can attack twice this turn.`); } } }] },
  'Greenkappa': { effs: [{ type: 'trig', mand: true, faceDownOk: true, tags: { destroy: 1 }, label: 'Destroy 2 Set Spells/Traps', on: flipOn,
    cond: g => allField(g).filter(x => isST(x) && x.pos === 'set').length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which 2 Set Spells/Traps?', allField(g).filter(x => isST(x) && x.pos === 'set'), 2, 2, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  'Gren Maju Da Eiza': { self: { atk: (g, c) => 400 * g.p[c.ctrl].ban.length, def: (g, c) => 400 * g.p[c.ctrl].ban.length } },
  // The player who just lost control of it gains 3000 (ruling: a stolen Griggle coming back gives the thief the LP), once while face-up.
  // PARTIAL: control changes make no event, so it triggers at the next game event.
  'Griggle': { effs: [{ type: 'trig', mand: true, label: 'Gain 3000 LP',
    on: (g, ev, c) => { if (!onField(c) || !faceUp(c)) return false; if (c.flags.grig == null) { c.flags.grig = c.ctrl; return false; }
      if (c.ctrl === c.flags.grig) return false; const prev = c.flags.grig; c.flags.grig = c.ctrl; if (c.flags.grigUsed) return false; c.flags.grigUsed = true; c.flags.grigTo = prev; return true; },
    res: function* (g, c) { if (c.flags.grigTo != null) gain(g, c.flags.grigTo, 3000); } }] },
  'Gyaku-Gire Panda': { self: { atk: (g, c) => 500 * monsOf(g, opp(c.ctrl)).length, piercing: true } },
  'Hade-Hane': { effs: [{ type: 'trig', faceDownOk: true, label: 'Return up to 3 monsters to the hand', on: flipOn,
    cond: g => fieldMons(g).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return up to 3 monsters to the hand', fieldMons(g), 1, 3, 'bad'); },
    res: function* (g, c, p, L2) { const ts = live(L2); for (const t of ts) move(g, t, 'hand', { reason: 'effect', by: p }); if (ts.length) log(g, `${ts.length} monster${ts.length > 1 ? 's' : ''} returned to the hand.`); } }] },
  'Hand of Nephthys': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Tribute 2: summon Sacred Phoenix',
    cond: (g, c, p) => monsOf(g, p).some(x => x !== c) && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Sacred Phoenix of Nephthys') && !forbid(g, { type: 'ss', c: x, p, how: 'special' })),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which other monster?', monsOf(g, p).filter(x => x !== c), 1, 1, 'cost');
      move(g, c, 'gy', { reason: 'cost', by: p }); if (x) move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Hand of Nephthys${x ? ' and ' + (faceUp(x) || x.zone !== 'm' ? D(x).n : 'a face-down monster') : ''}.`); },
    res: function* (g, c, p) { yield* ssFrom(g, p, x => named(x, 'Sacred Phoenix of Nephthys'), 'Special Summon Sacred Phoenix of Nephthys', ['hand', 'deck']); } }] },
  'Hane-Hane': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Return a monster to the hand', on: flipOn,
    cond: g => fieldMons(g).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which monster to the hand?', fieldMons(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone === 'm') { const n = faceUp(t) ? name(t) : 'A face-down monster'; move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${n} returned to the hand.`); } } }] },
  'Hayabusa Knight': { self: { maxAttacks: () => 2 } },
  'Heavy Mech Support Platform': { cont: { ...eqBonus(500, 500), replaceDestroy: unionReplace },
    effs: unionEffs(m => race(m) === 'Machine', 'Equip Heavy Mech Support Platform to which Machine?') },
  'Helping Robo for Combat': { effs: [{ type: 'trig', mand: true, label: 'Draw 1, then return 1',
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.prevCtrl !== c.ctrl,
    res: function* (g, c, p) { if (g.p[p].deck.length) draw(g, p, 1); const h = g.p[p].hand; if (!h.length) return;
      const [x] = yield* pick(g, p, 'Return which card to the bottom of your Deck?', h, 1, 1, 'cost'); if (x) { toBottom(g, x); log(g, `${PN(g, p)} put a card on the bottom of the Deck.`); } } }] },

  /* ----- Spells ----- */
  'Gather Your Mind': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'Gather Your Mind')),
    after: (g, c, p) => { addRule(g, (g2, a) => a.type === 'activate' && a.p === p && !!a.c && named(a.c, 'Gather Your Mind'), { end: g.turnNo }); },
    res: function* (g, c, p) { yield* search(g, p, x => named(x, 'Gather Your Mind'), 'Add Gather Your Mind from your Deck'); } }] },
  "Goblin's Secret Remedy": { effs: [{ type: 'act', res: function* (g, c, p) { gain(g, p, 600); } }] },
  'Gravedigger Ghoul': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].gy.some(isMon),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish up to 2 monsters from their GY', g.p[opp(p)].gy.filter(isMon), 1, 2, 'bad'); },
    res: function* (g, c, p, L2) { const ts = L2.t.filter(x => x.zone === 'gy'); for (const t of ts) move(g, t, 'ban', { reason: 'effect', by: p }); if (ts.length) log(g, `${ts.map(x => D(x).n).join(', ')} ${ts.length > 1 ? 'were' : 'was'} banished.`); } }] },
  // Choose 2 unused Main Monster Zones (either side); no one can use them while this card is face-up.
  // PARTIAL: a monster placed by a control change ignores the zones.
  'Ground Collapse': {
    cont: { forbid: (g, src, a) => ['ns', 'set', 'ss'].includes(a.type) && a.p != null && !!src.flags.gcZones && (() => { const Z = gcZones(g); return !g.p[a.p].m.some((x, i) => !x && !Z.some(z => z.p === a.p && z.i === i)); })() },
    effs: [{ type: 'act', cond: g => { const Z = gcZones(g); let n = 0; for (const q of [0, 1]) g.p[q].m.forEach((x, i) => { if (!x && !Z.some(z => z.p === q && z.i === i)) n++; }); return n >= 2; },
      res: function* (g, c, p) { if (!onField(c)) return; const Z = gcZones(g), free = [];
        for (const q of [opp(p), p]) g.p[q].m.forEach((x, i) => { if (!x && !Z.some(z => z.p === q && z.i === i)) free.push({ p: q, i }); });
        const out = [];
        for (let k = 0; k < 2 && free.length; k++) { const j = yield* choose(g, p, `Choose a Monster Zone to lock (${k + 1} of 2)`, free.map(z => `${z.p === p ? 'Your' : 'Their'} zone ${z.i + 1}`)); out.push(free.splice(j, 1)[0]); }
        c.flags.gcZones = out; g.seq++; log(g, `${out.map(z => `${PN(g, z.p)}'s zone ${z.i + 1}`).join(' and ')} can't be used.`); } },
      { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
        if (ev.type !== 'move' || ev.to !== 'm' || !c.flags.gcZones) return false; const row = g.p[ev.c.ctrl].m, i = row.indexOf(ev.c), Z = gcZones(g);
        if (i >= 0 && Z.some(z => z.p === ev.c.ctrl && z.i === i)) { const j = row.findIndex((x, k) => !x && !Z.some(z => z.p === ev.c.ctrl && z.i === k)); if (j >= 0) { row[i] = null; row[j] = ev.c; g.seq++; } }
        return false; } }] },
  "Gryphon's Feather Duster": { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => stOf(g, p).some(x => x !== c),
    res: function* (g, c, p) { const n = destroy(g, stOf(g, p).filter(x => x !== c), { by: p, src: c }).length; if (n) gain(g, p, 500 * n); } }] },
  // ATK ties: the activating player chooses (ruling: chosen at resolution).
  'Hammer Shot': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(x => x.pos === 'atk'),
    res: function* (g, c, p) { const ms = fieldMons(g).filter(x => x.pos === 'atk' && faceUp(x)); if (!ms.length) return; const top = Math.max(...ms.map(x => atk(g, x)));
      const cs = ms.filter(x => atk(g, x) === top); const [x] = cs.length > 1 ? yield* pick(g, p, 'Destroy which monster with the highest ATK?', cs, 1, 1, 'bad') : cs; if (x) destroy(g, [x], { by: p, src: c }); } }] },
  // Field Spell: both sides' Winged Beasts gain 200; when a Harpie is summoned, the player who summoned it destroys a Spell/Trap.
  "Harpies' Hunting Ground": {
    cont: { atk: (g, src, m) => faceUp(m) && race(m) === 'Winged Beast' ? 200 : 0, def: (g, src, m) => faceUp(m) && race(m) === 'Winged Beast' ? 200 : 0 },
    effs: [{ type: 'act', res: noop },
      { type: 'trig', loc: 'fz', mand: true, tags: { destroy: 1 }, label: 'Destroy a Spell/Trap',
        on: (g, ev, c) => { if (ev.type === 'summon' && ev.how !== 'flip' && ev.cs.some(x => HARPIES.includes(name(x)) || HARPIES.includes(D(x).n))) { c.flags.hhgP = ev.p; return true; } return false; },
        cond: g => stOnField(g).length > 0,
        target: function* (g, c, p, L2) { const q = c.flags.hhgP != null ? c.flags.hhgP : p; L2.data.q = q; yield* tgt(g, q, L2, 'Destroy which Spell/Trap?', stOnField(g), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { destroy(g, live(L2), { by: L2.data.q }); } }] },
  "Heart of the Underdog": { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', when: true, label: 'Reveal the Normal Monster: draw 1',
      on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && ev.to === 'hand' && g.phase === 'draw' && g.tp === c.ctrl && ev.c.owner === c.ctrl && D(ev.c).k === 'normal',
      cond: (g, c, p) => g.p[p].deck.length > 0,
      res: function* (g, c, p, L2) { log(g, `${PN(g, p)} revealed ${name(L2.ev.c)}.`); if (g.p[p].deck.length) draw(g, p, 1); } }] },

  /* ----- Traps ----- */
  // A wrong call: the next turn of the player is skipped (no draw, nothing to do but end it).
  // ENGINE: no real turn skip; that turn still happens, with no draw, no summons, no activations and no Battle Phase.
  'Gamble': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length >= 6 && g.p[p].hand.length <= 2,
    res: function* (g, c, p) { if (callCoin(g, p)) { const n = Math.max(0, 5 - g.p[p].hand.length); if (n) draw(g, p, Math.min(n, g.p[p].deck.length)); return; }
      const t = g.tp === p ? g.turnNo + 2 : g.turnNo + 1; (g.f22skip || (g.f22skip = [null, null]))[p] = t; log(g, `${PN(g, p)} skips their next turn.`);
      if (!g.f22skipRule) { g.f22skipRule = true; addRule(g, (g2, a) => { const q = a.p != null ? a.p : a.c && a.c.ctrl; return q != null && skipped(g2, q) && ['draw', 'ns', 'set', 'ss', 'activate', 'setST', 'attack', 'pos'].includes(a.type); }); } } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { if (ev.type === 'phase' && ev.ph === 'standby' && skipped(g, ev.tp)) g.noBP[ev.tp] = true; return false; } }] },
  'Good Goblin Housekeeping': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length > 0,
    res: function* (g, c, p) { const n = 1 + g.p[p].gy.filter(x => named(x, 'Good Goblin Housekeeping')).length; draw(g, p, Math.min(n, g.p[p].deck.length));
      const h = g.p[p].hand; if (!h.length) return; const [x] = yield* pick(g, p, 'Return which card to the bottom of your Deck?', h, 1, 1, 'cost'); if (x) { toBottom(g, x); log(g, `${PN(g, p)} put a card on the bottom of the Deck.`); } } }] },
  // The negation lasts the turn (kept on the game; the GY copy carries it). PARTIAL: it ends early if this card leaves the GY.
  "Gorgon's Eye": { cont: { loc: 'gy', negates: (g, src, c) => g.gorgonEye === g.turnNo && c.zone === 'm' && (c.pos === 'def' || c.pos === 'set') },
    effs: [{ type: 'act', res: function* (g) { g.gorgonEye = g.turnNo; g.seq++; log(g, 'Effects of Defense Position monsters are negated this turn.'); } }] },
  // PARTIAL (classic-5.js): the Spell is Set in your Spell/Trap Zone to use this turn like a card in your hand (a Quick-Play
  // can't be activated the turn it is Set); still Set at the End Phase, it goes back to its owner's GY. Using it costs 2000
  // damage. Field Spells are left out (they need the Field Zone).
  'Graverobber': { effs: [
    { type: 'act', cond: (g, c, p) => freeST(g, p) >= 0 && g.p[opp(p)].gy.some(x => isSpell(x) && D(x).sub !== 'Field'),
      res: function* (g, c, p) { const cs = g.p[opp(p)].gy.filter(x => isSpell(x) && D(x).sub !== 'Field'); if (!cs.length || freeST(g, p) < 0) return;
        const [x] = yield* pick(g, p, 'Take which Spell from their GY?', cs, 1, 1, 'good'); if (!x) return;
        move(g, x, 'st', { ctrl: p, pos: 'set', reason: 'effect', by: p }); x.turnIn = g.turnNo - 1; x.flags.robbedBy = c.u; x.flags.robbedTurn = g.turnNo;
        log(g, `${PN(g, p)} took ${name(x)} from the GY to use this turn.`); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Take 2000 damage',
      on: (g, ev, c) => { let due = false; for (const x of allField(g)) if (x.zone === 'st' && faceUp(x) && x.flags.robbedBy === c.u && !x.flags.robbedPaid) { x.flags.robbedPaid = true; due = true; } return due; },
      res: function* (g, c) { damage(g, c.owner, 2000, { src: c, srcP: c.owner }); } },
    { type: 'trig', loc: 'any', mand: true, res: noop,
      on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'end') for (const x of allField(g)) if (x.zone === 'st' && x.pos === 'set' && x.flags.robbedBy === c.u && x.flags.robbedTurn === g.turnNo) { move(g, x, 'gy', { reason: 'rule' }); log(g, `${D(x).n} went back to the GY.`); } return false; } }] },
  "Graverobber's Retribution": { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', mand: true, label: '100 damage for each banished monster', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      cond: (g, c, p) => g.p[opp(p)].ban.some(isMon),
      res: function* (g, c, p) { const n = g.p[opp(p)].ban.filter(isMon).length; if (n && onField(c)) damage(g, opp(p), 100 * n, { src: c, srcP: p }); } }] },
  'Gryphon Wing': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p, x) => !!x.top && x.top.cardAct && x.top.p !== p && !x.top.negated && named(x.top.c, "Harpie's Feather Duster"),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated) return; T.negBy = p; negate(g, T, false); destroy(g, stOf(g, opp(p)), { by: p, src: c }); } }] },
  // No response window opens after a destruction, so it is offered as a trigger while Set (classic-5.js trapTrig).
  'Gust': { effs: [trapTrig({ label: 'Destroy a Spell/Trap', tags: { destroy: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.destroyed && !ev.battle && ev.to === 'gy' && isSpell(ev.c) && ev.prevCtrl === c.ctrl && ev.by === opp(c.ctrl),
    cond: g => stOnField(g).length > 1,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOnField(g).filter(x => x !== c), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } })] },
  // Battle damage stops through the turn flag; effect damage while this card is in the GY.
  // PARTIAL: effect damage counts again if this card leaves the GY that turn.
  'Hallowed Life Barrier': {
    cont: { loc: 'gy', dmg: (g, src, p, n, o) => (g.f22hlb && g.f22hlb[p] === g.turnNo && o.srcP != null && o.srcP !== p ? 0 : undefined) },
    effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c),
      cost: function* (g, c, p) { yield* discardOne(g, p, c); },
      res: function* (g, c, p) { g.p[p].noBattleDamage = g.turnNo; (g.f22hlb || (g.f22hlb = [null, null]))[p] = g.turnNo; log(g, `${PN(g, p)} takes no damage from the opponent this turn.`); } }] },
  'Heavy Slump': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length >= 8,
    res: function* (g, c, p) { const o = opp(p); const h = g.p[o].hand.slice(); if (h.length < 8) return; for (const x of h) move(g, x, 'deck', { reason: 'effect' }); shuffleDeck(g, o); log(g, `${PN(g, o)} shuffled ${h.length} cards into the Deck.`); draw(g, o, Math.min(2, g.p[o].deck.length)); } }] },
  'Hidden Spellbook': { effs: [{ type: 'act', cond: (g, c, p) => g.tp === p && g.p[p].gy.filter(isSpell).length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Shuffle which 2 Spells into your Deck?', g.p[p].gy.filter(isSpell), 2, 2, 'good'); },
    res: function* (g, c, p, L2) { const ts = L2.t.filter(x => x.zone === 'gy'); for (const t of ts) move(g, t, 'deck', { reason: 'effect' }); if (ts.length) log(g, `${ts.map(x => D(x).n).join(' and ')} ${ts.length > 1 ? 'were' : 'was'} shuffled into the Deck.`); } }] },
});
})();
