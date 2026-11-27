/* Full pool batch 24: Labyrinth of Nightmare to Moai Interceptor Cannons (build/batches/full/full-24.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text; cards with a
 Goat-only script elsewhere (Labyrinth Tank, Larvae Moth, Laser Cannon Armor, Leghul, Lekunga, Lightforce Sword, Lightning
 Blade, Lord of D., Magician of Faith, Maha Vailo, Makyura the Destructor, Manga Ryu-Ran, Mass Driver, Mataza the Zapper,
 Megamorph, Metalmorph, Metalzoa, Metamorphosis, Meteor of Destruction, Milus Radiant) are ported here as the shared version;
 Goat keeps its own scripts, which win while Goat is loaded. Lesser Fiend is Goat only. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, search, setFaceDown, negate, addMod, equip, equippedTo,
  addCtr, ctr, addRule, tokens, takeControl, name, D, isMon, isST, isSpell, isTrap, isExtraD, onField, faceUp, attr, race, lv,
  baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM, shuffleDeck, log, PN, live, opp, stOnField,
  spellTrapAct, evSummoned, fromFieldToGY, battleKill, emit, forbid, stat, negd, num, tributeCands } = L;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const isEdison = () => E.format() === 'edison';
const txt = c => { const d = D(c); return d.ps && !/^No (?:Edison|rulings)/.test(d.ps) ? d.ps : d.tx || ''; };
const ATK = (g, c) => stat(g, c, 'atk');
const shownName = c => c.pos === 'set' ? 'a face-down monster' : name(c);
// Change a face-up monster's battle position by a card effect (announced as a 'pos' event, as full-08.js does)
function swapPos(g, c) {
  if (!onField(c) || c.zone !== 'm' || !faceUp(c)) return;
  const from = c.pos; c.pos = from === 'atk' ? 'def' : 'atk'; g.seq++;
  log(g, `${name(c)} was changed to ${c.pos === 'atk' ? 'Attack' : 'Defense'} Position.`);
  emit(g, { type: 'pos', c, p: c.ctrl, from });
}
// "Once per turn, you can flip this card into face-down Defense Position." It can't be Flip Summoned again the same turn.
const flipDown = { type: 'ign', opt: true, label: 'Flip it face-down',
  cond: (g, c) => c.pos !== 'set',
  res: function* (g, c) { if (!onField(c) || !faceUp(c)) return; setFaceDown(g, c); c.posChanged = true; armMSG(g, c); } };
function discardRandom(g, p, by) { const h = g.p[p].hand; if (!h.length) return null; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard', by }); log(g, `${PN(g, p)} discarded ${name(x)} at random.`); return x; }
function* tributeCost(g, p, text, filter = () => true) { const [x] = yield* pick(g, p, text, monsOf(g, p).filter(filter), 1, 1, 'cost'); if (!x) return null; const nm = shownName(x); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); return x; }
// Both players take damage at the same time (Ring of Destruction style): lower the opponent's LP first, then damage() checks both.
function bothDamage(g, p, n, src) { const o = opp(p); g.p[o].lp -= n; log(g, `${PN(g, o)} took ${n} damage.`); emit(g, { type: 'damage', p: o, n, battle: false, src, srcP: p }); damage(g, p, n, { src, srcP: p }); }
// Equip Spells
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) equip(g, c, t); } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
// a Trap that becomes an Equip Card (Metalmorph): it stays on the field
function equipTrap(g, c, t, L2) { if (!onField(c) || !t || !onField(t) || !faceUp(t) || t.zone !== 'm') return false; equip(g, c, t); L2.keep = true; return true; }
// "When ...": a Set Trap that answers an event with no response window of its own (port of full-17.js's trapTrig).
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });
// Umi on the field: Umi or A Legendary Ocean face-up, or Maiden of the Aqua face-up while no Field Spell is face-up
const umiOn = g => {
  const fz = [g.p[0].fz, g.p[1].fz].filter(f => f && faceUp(f));
  if (fz.some(f => named(f, 'Umi') || named(f, 'A Legendary Ocean'))) return true;
  return !fz.length && fieldMons(g).some(m => faceUp(m) && named(m, 'Maiden of the Aqua') && !negd(g, m));
};

/* ----- summon locks ("Cannot be Special Summoned", "Must first be Special Summoned ..."), one duel-long rule ----- */
// The marks c.f24nomi (properly summoned once) and c.f24go (its own Deck summon is resolving) sit on the card object.
// PARTIAL: an effect that Special Summons one of these from the hand is not stopped (the proc and an effect look the same).
const LOCKS = {
  'Larvae Moth': (g, a) => isEdison() && (a.c.zone === 'deck' || (['gy', 'ban'].includes(a.c.zone) && !a.c.f24nomi)),
  'Manga Ryu-Ran': (g, a) => isEdison() && (a.c.zone === 'deck' || (['gy', 'ban'].includes(a.c.zone) && !a.c.f24nomi)),
  'Metalzoa': (g, a) => isEdison() && (a.c.zone === 'deck' ? !a.c.f24go : a.c.zone === 'hand' || !a.c.f24nomi),
  'Maharaghi': () => true,
  'Mazera DeVille': (g, a) => a.c.zone !== 'hand',
  'Megarock Dragon': (g, a) => a.c.zone !== 'hand',
};
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: (g) => { if (!g.f24lock) { g.f24lock = true; addRule(g, (g2, a) => { if (a.type !== 'ss' || !a.c) return false; const f = LOCKS[D(a.c).n]; return !!f && f(g2, a); }); } return false; } };

/* ----- Toons (port of classic-1.js's toon()) ----- */
const isToon = c => /Toon/.test(D(c).ab || '') || /treated as a "Toon" card/.test(D(c).tx || '');
const toonWorld = (g, p) => stOf(g, p).some(x => faceUp(x) && named(x, 'Toon World'));
const oppToon = (g, c) => monsOf(g, opp(c.ctrl)).some(x => faceUp(x) && isToon(x));
function toon(n) {
  return {
    proc: { label: `Special Summon (Tribute ${n}, Toon World)`,
      cond: (g, c, p) => toonWorld(g, p) && tributeCands(g, p).length >= n,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, `Tribute ${n} monsters`, tributeCands(g, p), n, n, 'cost');
        for (const x of xs) { const nm = shownName(x); move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${nm}.`); } c.f24nomi = true; } },
    self: {
      cantAttack: (g, c) => c.turnIn === g.turnNo,
      attackCost: () => 500,
      directAttack: (g, c) => !oppToon(g, c),
      attackOk: (g, c, t) => !oppToon(g, c) || (faceUp(t) && isToon(t)),
    },
    effs: [lockInstall, { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroyed with Toon World',
      on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.destroyed && named(ev.c, 'Toon World') && ev.prevCtrl === c.ctrl,
      res: function* (g, c) { if (onField(c)) destroy(g, [c], { rule: true }); } }],
  };
}

/* ----- Metalzoa (port of classic-2.js): Tribute Zoa equipped with Metalmorph, Special Summon it from the Deck ----- */
// ENGINE: no idle action for an inherent Special Summon from the Deck. PARTIAL: it is offered as an optional trigger from the
// Deck at your Standby Phase, the end of your Battle Phase, and the first game event of each of your Main Phases.
const metalBase = (g, p, base) => monsOf(g, p).find(m => faceUp(m) && name(m) === base && stOnField(g).some(s => named(s, 'Metalmorph') && faceUp(s) && s.equipTo === m.u));
const metalSummon = base => ({ type: 'trig', loc: 'deck', tags: { ss: 1 }, label: `Tribute ${base}: Special Summon from the Deck`,
  on: (g, ev, c) => {
    if (g.tp !== c.owner || !metalBase(g, c.owner, base)) return false;
    if (ev.type === 'phase' && (ev.ph === 'standby' || ev.ph === 'bpEnd') && ev.tp === c.owner) return true;
    if (['main1', 'main2'].includes(g.phase) && ev.type !== 'phase') { const k = g.turnNo + g.phase; if (c.flags.metalAsk === k) return false; c.flags.metalAsk = k; return true; }
    return false;
  },
  cond: (g, c, p) => !!metalBase(g, p, base) && freeM(g, p) >= 0,
  cost: function* (g, c, p) { const m = metalBase(g, p, base); if (m) { move(g, m, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${base}.`); } },
  res: function* (g, c, p) { if (c.zone !== 'deck' || freeM(g, p) < 0) return; c.f24go = true; const ok = ss(g, p, c, 'atk'); c.f24go = false; if (ok) c.f24nomi = true; shuffleDeck(g, p); } });

/* ----- Life Absorbing Machine: LP paid as costs, read from the duel log ----- */
// ENGINE: pay() has no event. PARTIAL: payments are found in the log ("X paid N LP."), so a quiet duel copy (the computer's
// look-ahead) sees none, and two players with the same name can't be told apart.
function scanPays(g) {
  const s = g.f24pay || (g.f24pay = { n: 0, list: [] });
  if (g.log.length < s.n) s.n = Math.max(0, s.n - 100); // the log drops its oldest 100 lines past 300
  for (let i = s.n; i < g.log.length; i++) {
    const m = /^(.+) paid (\d+) LP\.$/.exec(g.log[i]); if (!m) continue;
    const p = PN(g, 0) === m[1] ? 0 : PN(g, 1) === m[1] ? 1 : -1;
    if (p >= 0 && g.tp === p) s.list.push({ p, turn: g.turnNo, n: +m[2] });
  }
  s.n = g.log.length; if (s.list.length > 40) s.list.splice(0, s.list.length - 40);
  return s;
}

/* ----- Mid Shield Gardna: negate a Spell that targets it while face-down ----- */
// ENGINE: no event or window when a card is activated, and face-down monsters have no effects to offer. The check runs from
// a getter on the face-down card's flags (effsOf reads c.flags.copyEffs whenever either player's options are listed, which
// happens before every chain link resolves). It goes with the flags object, so it ends when the card is flipped or leaves.
function msgCheck(g, c) {
  if (c.zone !== 'm' || c.pos !== 'set' || !g.chain.length) return;
  const top = g.chain[g.chain.length - 1];
  if (top.negated || !spellTrapAct(top) || !isSpell(top.c) || top.t.length !== 1 || top.t[0] !== c) return;
  top.negBy = c.ctrl; negate(g, top, false);
  c.pos = 'def'; g.seq++; log(g, `${name(c)} was flipped face-up in Defense Position.`);
}
function armMSG(g, c) {
  if (!named(c, 'Mid Shield Gardna') || c.zone !== 'm' || c.pos !== 'set' || Object.getOwnPropertyDescriptor(c.flags, 'copyEffs')) return;
  Object.defineProperty(c.flags, 'copyEffs', { configurable: true, enumerable: false, get() { msgCheck(g, c); return undefined; } });
}

/* ----- Metalsilver Armor: who is activating ----- */
// ENGINE: targeting doesn't know which player targets. Every activation is checked with forbid({type:'activate', p}) just
// before it is offered or used, so the last player checked is the one choosing targets (recorded while the Armor is face-up).
const GY_TARGET = /target 1 [A-Za-z -]*monster in [^.;]*(?:GY|Graveyard)/i;

E.addScripts({
  /* ----- L ----- */
  // Continuous Trap: in each End Phase, every face-up monster of the turn player changes battle position.
  'Labyrinth of Nightmare': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', mand: true, opt: true, label: 'Change battle positions',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && monsOf(g, ev.tp).some(faceUp),
      res: function* (g, c) { for (const m of monsOf(g, g.tp).filter(faceUp)) swapPos(g, m); } }] },
  'Labyrinth Tank': { effs: [] }, // Fusion Monster with no effect; the recipe is read from its text
  'Larvae Moth': { effs: [lockInstall],
    proc: { label: 'Special Summon (Tribute Petit Moth in its Cocoon)',
      cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && named(m, 'Petit Moth') && stOnField(g).some(x => named(x, 'Cocoon of Evolution') && x.equipTo === m.u && x.flags.cocoon && x.flags.cocoonTurns >= 2)),
      cost: function* (g, c, p, grp) { const ms = monsOf(g, p).filter(m => faceUp(m) && named(m, 'Petit Moth') && stOnField(g).some(x => named(x, 'Cocoon of Evolution') && x.equipTo === m.u && x.flags.cocoon && x.flags.cocoonTurns >= 2));
        const [m] = yield* pick(g, p, 'Tribute which Petit Moth?', ms, 1, 1, 'cost'); if (m) { move(g, m, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Petit Moth.`); } c.f24nomi = true; } } },
  'Laser Cannon Armor': { cont: eqBonus(300, 300), effs: [equipAct(m => race(m) === 'Insect', 'Equip to which face-up Insect monster?')] },
  // Mandatory trigger: the attacked monster must have been face-down at the start of the Damage Step.
  'Legacy Hunter': { effs: [
    { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'dsStart' && ev.a === c) c.flags.lhT = ev.t && ev.t.pos === 'set' ? ev.t.u : null; return false; } },
    { type: 'trig', mand: true, label: 'Return a random card to the Deck',
      on: (g, ev, c) => battleKill(ev, c) && c.flags.lhT === ev.c.u && g.p[opp(c.ctrl)].hand.length > 0,
      res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'deck', { reason: 'effect', by: p }); log(g, `${PN(g, o)} returned a random card from the hand to the Deck.`); } }] },
  'Leghul': { self: { directAttack: true } },
  'Lekunga': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Banish 2 WATER: summon a Lekunga Token',
    cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && attr(x) === 'WATER').length >= 2 && freeM(g, p) >= 0,
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Banish 2 WATER monsters from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'WATER'), 2, 2, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${xs.map(name).join(' and ')}.`); },
    res: function* (g, c, p) { tokens(g, p, { n: 'Lekunga Token', a: 'WATER', r: 'Plant', lv: 2, atk: 700, def: 700 }, 1, 'atk'); } }] },
  'Life Absorbing Machine': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'any', res: noop, on: (g) => { scanPays(g); return false; } },
    { type: 'trig', loc: 'st', mand: true, label: 'Gain half the LP you paid last turn',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && scanPays(g).list.some(e => e.p === c.ctrl && e.turn === g.turnNo - 2),
      res: function* (g, c, p) { for (const e of scanPays(g).list.filter(e => e.p === p && e.turn === g.turnNo - 2)) gain(g, p, Math.floor(e.n / 2)); } }] },
  'Lighten the Load': { effs: [{ type: 'act', res: noop },
    { type: 'ign', loc: 'st', opt: true, label: 'Shuffle a Level 7+ monster in, draw 1',
      cond: (g, c, p) => g.p[p].hand.some(x => isMon(x) && lv(x) >= 7),
      res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isMon(x) && lv(x) >= 7); const [x] = yield* pick(g, p, 'Shuffle which Level 7 or higher monster into your Deck?', cs, 1, 1, 'cost'); if (!x) return;
        log(g, `${PN(g, p)} showed ${name(x)} and shuffled it into the Deck.`); move(g, x, 'deck', { reason: 'effect' }); draw(g, p, 1); } }] },
  'Lightforce Sword': { effs: [
    { type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length > 0,
      res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)];
        move(g, x, 'ban', { reason: 'effect', by: p }); (g.lfs || (g.lfs = [])).push({ by: c.u, u: x.u, o, n: 0, turn: -1 }); log(g, `A random card from ${PN(g, o)}'s hand was banished face-down.`); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return the banished card',
      on: (g, ev, c) => { if (ev.type !== 'phase' || ev.ph !== 'standby' || !g.lfs) return false; let due = false;
        for (const e of g.lfs) if (e.by === c.u && e.o === ev.tp && e.turn !== g.turnNo) { e.turn = g.turnNo; e.n++; if (e.n >= 4) due = true; } return due; },
      res: function* (g, c) { for (const e of g.lfs.filter(e => e.by === c.u && e.n >= 4)) { const x = g.p[e.o].ban.find(y => y.u === e.u); if (x) { move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, x.owner)} got the banished card back.`); } }
        g.lfs = g.lfs.filter(e => !(e.by === c.u && e.n >= 4)); } }] },
  'Lightning Blade': { cont: { atk: (g, src, m) => (src.equipTo === m.u ? 800 : 0) + (src.equipTo && attr(m) === 'WATER' ? -500 : 0) },
    effs: [equipAct(m => race(m) === 'Warrior', 'Equip to which face-up Warrior monster?')] },
  'Little Chimera': { cont: { atk: (g, src, m) => attr(m) === 'FIRE' ? 500 : attr(m) === 'WATER' ? -400 : 0 } },
  'Little-Winguard': { effs: [{ type: 'trig', opt: true, label: 'Change its battle position',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
    res: function* (g, c) { swapPos(g, c); } }] },
  // PARTIAL: "unaffected by your opponent's monster effects" isn't applied (the engine has no "unaffected by" hook for monsters).
  'Lone Wolf': {
    cont: { grant: (g, src, c, flag) => flag === 'noBattleDestroy' && src.flags.lw === c.u && c.zone === 'm' && faceUp(c) },
    effs: [{ type: 'act', cond: (g, c, p) => { const ms = monsOf(g, p); return ms.length === 1 && faceUp(ms[0]) && ['Chu-Ske the Mouse Fighter', 'Monk Fighter', 'Master Monk'].includes(name(ms[0])); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster does Lone Wolf protect?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c)) return; c.flags.lw = t.u; log(g, `Lone Wolf protects ${name(t)}.`); } },
    // flipped face-down or gone: the effect ends for good
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => { if (c.flags.lw) { const t = fieldMons(g).find(x => x.u === c.flags.lw); if (!t || !faceUp(t)) c.flags.lw = null; } return false; } }] },
  'Lord of D.': { cont: { grant: (g, src, c, flag) => flag === 'cantBeTargeted' && c.zone === 'm' && faceUp(c) && race(c) === 'Dragon' } },
  // Face-down banished cards (Lightforce Sword) don't count.
  'Lost Guardian': { self: { def: (g, c) => 700 * g.p[c.ctrl].ban.filter(x => isMon(x) && race(x) === 'Rock' && !(g.lfs || []).some(e => e.u === x.u)).length } },
  'Luminous Soldier': { self: { atk: (g, c) => { if (!g.inDS || !g.battle) return 0; const o = g.battle.a === c ? g.battle.t : g.battle.t === c ? g.battle.a : null; return o && onField(o) && faceUp(o) && attr(o) === 'DARK' ? 500 : 0; } } },
  'Luminous Spark': { cont: { atk: (g, src, m) => attr(m) === 'LIGHT' ? 500 : 0, def: (g, src, m) => attr(m) === 'LIGHT' ? -400 : 0 }, effs: [{ type: 'act', res: noop }] },

  /* ----- Ma ----- */
  'Magician of Faith': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Add a Spell from the GY', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c, p) => g.p[p].gy.some(isSpell),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Spell from your GY to your hand?', g.p[p].gy.filter(isSpell), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },
  'Magician\'s Circle': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: g => !!g.aw && onField(g.aw.a) && faceUp(g.aw.a) && race(g.aw.a) === 'Spellcaster',
    res: function* (g, c, p) {
      for (const q of [p, opp(p)]) {
        if (freeM(g, q) < 0) continue;
        const cs = g.p[q].deck.filter(x => isMon(x) && race(x) === 'Spellcaster' && !isExtraD(D(x)) && num(D(x).atk) <= 2000 && !forbid(g, { type: 'ss', c: x, p: q, how: 'special' }));
        const [x] = yield* pick(g, q, 'Special Summon a Spellcaster with 2000 or less ATK from your Deck', cs, 1, 1, 'good');
        if (x) ss(g, q, x, 'atk'); shuffleDeck(g, q);
      } } }] },
  'Maha Vailo': { self: { atk: (g, c) => 500 * allField(g).filter(x => x.zone === 'st' && x.equipTo === c.u).length } },
  // Spirit: returns at the End Phase of the turn it was Normal Summoned or flipped face-up. Each such summon or flip also
  // sets up a look at the top card. PARTIAL: the engine draws as soon as a turn starts (no event before the draw), so the look
  // happens at the End Phase of the turn before your next Draw Phase.
  'Maharaghi': { effs: [lockInstall,
    { type: 'trig', mand: true, label: 'Return to the hand',
      on: (g, ev, c) => {
        if ((evSummoned(ev, c, ['normal', 'tribute'])) || (ev.type === 'flip' && ev.c === c)) { c.flags.spirit = g.turnNo; (g.f24mah || (g.f24mah = [])).push({ u: c.u, p: c.ctrl, seq: ev.seq }); }
        return ev.type === 'phase' && ev.ph === 'end' && c.flags.spirit === g.turnNo; },
      res: function* (g, c) { if (onField(c) && faceUp(c)) { move(g, c, 'hand', { reason: 'effect' }); log(g, `${name(c)} returned to the hand.`); } } },
    { type: 'trig', loc: 'any', mand: true, label: 'Look at the top card of your Deck',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && (g.f24mah || []).some(e => e.u === c.u && e.p !== ev.tp && e.seq < ev.seq),
      res: function* (g, c) {
        const mine = g.f24mah.filter(e => e.u === c.u && e.p !== g.tp); g.f24mah = g.f24mah.filter(e => !mine.includes(e));
        for (const e of mine) { const P = g.p[e.p]; if (!P.deck.length) continue; const top = P.deck[P.deck.length - 1];
          const i = yield* choose(g, e.p, `Maharaghi: the top card of your Deck is ${name(top)}.`, ['Keep it on top', 'Put it on the bottom']);
          if (i === 1) { P.deck.pop(); P.deck.unshift(top); g.seq++; log(g, `${PN(g, e.p)} looked at the top card of the Deck and put it on the bottom.`); }
          else log(g, `${PN(g, e.p)} looked at the top card of the Deck and left it on top.`); } } }] },
  // ENGINE: other cards that check for Umi (The Legendary Fisherman, Tornado Wall and the like) only look at the Field Zone;
  // Mermaid Knight (this file) does see Maiden of the Aqua.
  'Maiden of the Aqua': { effs: [] },
  // Mandatory trigger, once for each batch of face-up Beasts destroyed at the same time.
  'Maji-Gire Panda': { effs: [{ type: 'trig', mand: true, label: 'Gain 500 ATK',
    on: (g, ev, c) => ev.type === 'move' && ev.destroyed && ev.wasField && ev.c !== c && ev.snap && ev.snap.mon && ev.snap.faceUp && ev.snap.race === 'Beast',
    res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500 }); log(g, `${name(c)} gained 500 ATK.`); } } }] },
  // PARTIAL: "by your opponent's effect" is read from the move's own player when the effect gave one, else the turn player.
  'Major Riot': { effs: [trapTrig({ label: 'Return every monster and Set from the hand', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.from === 'm' && ev.to === 'hand' && ev.prevCtrl === c.ctrl && (ev.by != null ? ev.by !== c.ctrl : g.tp !== c.ctrl),
    res: function* (g, c, p) {
      const cnt = [0, 0], ms = fieldMons(g).slice();
      for (const m of ms) { if (!onField(m)) continue; const back = D(m).k !== 'token' && !isExtraD(D(m)); const o = m.owner; move(g, m, 'hand', { reason: 'effect', by: p }); if (back) cnt[o]++; }
      log(g, 'Every monster on the field was returned to the hand.');
      for (const q of [p, opp(p)]) {
        const cs = g.p[q].hand.filter(x => isMon(x) && !isExtraD(D(x)) && D(x).k !== 'ritual' && lv(x) <= 4 && !forbid(g, { type: 'ss', c: x, p: q, how: 'special' }));
        const n = Math.min(cnt[q], cs.length, nFreeM(g, q)); if (!n) continue;
        const xs = yield* pick(g, q, `Special Summon ${n} monster${n > 1 ? 's' : ''} from your hand in face-down Defense Position`, cs, n, n, 'good');
        for (const x of xs) ss(g, q, x, 'set');
      } } })] },
  // ATK = the original ATK of its 2 Tributes, set as it is Tribute Summoned (no chain link).
  'Maju Garzett': { effs: [{ type: 'trig', res: noop, on: (g, ev, c) => {
    if (evSummoned(ev, c, ['tribute']) && ev.tribs && ev.tribs.length) { const a = ev.tribs.reduce((s, t) => s + (t.flags && t.flags.tokAtk != null ? t.flags.tokAtk : num(D(t).atk)), 0); c.flags.baseAtk = a; g.seq++; log(g, `Maju Garzett's ATK became ${a}.`); }
    return false; } }] },
  // PARTIAL: done as a trigger that Sets 1 Trap from the hand and lets it be activated this turn (the text has no chain link).
  // Original 2010 text: "When this card is destroyed and sent to the Graveyard, you can activate Trap Cards from your hand
  // during the turn it was destroyed." So: only when destroyed, any number of Traps, no once-per-turn (all later errata).
  'Makyura the Destructor': { effs: [{ type: 'trig', loc: 'gy', label: 'Ready Traps from the hand',
    on: (g, ev, c) => fromFieldToGY(ev, c) && ev.from === 'm' && !!ev.destroyed,
    cond: (g, c, p) => freeST(g, p) >= 0 && g.p[p].hand.some(isTrap),
    res: function* (g, c, p) { const n = 5 - g.p[p].st.filter(Boolean).length; if (n <= 0) return;
      const xs = yield* pick(g, p, 'Which Traps do you want to be able to activate this turn?', g.p[p].hand.filter(isTrap), 1, Math.min(n, g.p[p].hand.filter(isTrap).length), 'good');
      let k = 0; for (const x of xs) { if (freeST(g, p) < 0) break; move(g, x, 'st', { ctrl: p, pos: 'set', reason: 'set' }); x.turnIn = g.turnNo - 1; k++; }
      if (k) log(g, `${PN(g, p)} Set ${k === 1 ? 'a Trap' : k + ' Traps'} from the hand. They can be activated this turn.`); } }] },
  'Man-Thro\' Tro\'': { effs: [{ type: 'ign', label: 'Tribute a Normal Monster: 800 damage',
    cond: (g, c, p) => monsOf(g, p).some(x => D(x).k === 'normal'),
    cost: function* (g, c, p) { yield* tributeCost(g, p, 'Tribute 1 Normal Monster', x => D(x).k === 'normal'); },
    res: function* (g, c, p) { damage(g, opp(p), 800, { src: c, srcP: p }); } }] },
  'Manga Ryu-Ran': toon(2),
  'Manticore of Darkness': { effs: [
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.to === 'gy') c.f24mant = g.turnNo; return false; } },
    { type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Send a Beast: Special Summon it',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.f24mant === g.turnNo,
      cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...monsOf(g, p)].some(x => isMon(x) && D(x).k !== 'token' && ['Beast', 'Beast-Warrior', 'Winged Beast'].includes(race(x))),
      cost: function* (g, c, p) { const cs = [...g.p[p].hand, ...monsOf(g, p)].filter(x => isMon(x) && D(x).k !== 'token' && ['Beast', 'Beast-Warrior', 'Winged Beast'].includes(race(x)));
        const [x] = yield* pick(g, p, 'Send which Beast, Beast-Warrior or Winged Beast to the GY?', cs, 1, 1, 'cost'); if (!x) return; const nm = x.zone === 'm' ? shownName(x) : name(x); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${nm} to the GY.`); },
      res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c, 'atk'); } }] },
  // ENGINE: when every monster is shielded the engine lets the opponent attack directly (attackTargets), which the rulings don't allow.
  'Marauding Captain': {
    cont: { grant: (g, src, c, flag) => flag === 'noAttackTarget' && c !== src && c.zone === 'm' && c.ctrl === src.ctrl && faceUp(c) && race(c) === 'Warrior' },
    effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon a Level 4 or lower monster',
      on: (g, ev, c) => evSummoned(ev, c, ['normal']),
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && !isExtraD(D(x)) && lv(x) <= 4),
      res: function* (g, c, p) { if (freeM(g, p) < 0) return; const cs = g.p[p].hand.filter(x => isMon(x) && !isExtraD(D(x)) && D(x).k !== 'ritual' && lv(x) <= 4 && !forbid(g, { type: 'ss', c: x, p, how: 'special' }));
        const [x] = yield* pick(g, p, 'Special Summon a Level 4 or lower monster from your hand', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  'Maryokutai': { effs: [{ type: 'quick', ds: true, label: 'Tribute: negate the Spell',
    cond: (g, c, p, x) => g.tp !== p && !!x && !!x.top && x.top.p !== p && spellTrapAct(x.top) && isSpell(x.top.c) && !x.top.negated,
    cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Maryokutai.`); },
    res: function* (g, c, p, L2) { const t = L2.data.L; if (!t || t.negated) return; t.negBy = p; negate(g, t, true); } }] },
  'Mass Driver': { effs: [{ type: 'act', res: noop },
    { type: 'ign', loc: 'st', label: 'Tribute: 400 damage', cond: (g, c, p) => monsOf(g, p).length > 0,
      cost: function* (g, c, p) { yield* tributeCost(g, p, 'Tribute 1 monster'); },
      res: function* (g, c, p) { damage(g, opp(p), 400, { src: c, srcP: p }); } }] },
  // Control can't switch while it is face-up: it goes back to the player who controlled it when it was face-up.
  // A face-down Mataza taken and then flipped stays; with its effect negated (Skill Drain) control can switch.
  'Mataza the Zapper': { self: { maxAttacks: () => 2 },
    effs: [{ type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (c.zone !== 'm' || !faceUp(c)) { c.f24mz = null; return false; }
      if (c.f24mz == null || negd(g, c)) { c.f24mz = c.ctrl; return false; }
      if (c.ctrl !== c.f24mz && freeM(g, c.f24mz) >= 0) { const back = c.f24mz; takeControl(g, back, c, false); log(g, `Control of ${name(c)} can't switch: it went back to ${PN(g, back)}.`); }
      return false; } }] },
  'Mazera DeVille': {
    proc: { label: 'Special Summon (Tribute Warrior of Zera, Pandemonium)',
      cond: (g, c, p) => stOnField(g).some(x => faceUp(x) && named(x, 'Pandemonium')) && monsOf(g, p).some(m => faceUp(m) && named(m, 'Warrior of Zera')),
      cost: function* (g, c, p, grp) { const [m] = yield* pick(g, p, 'Tribute which Warrior of Zera?', monsOf(g, p).filter(m => faceUp(m) && named(m, 'Warrior of Zera')), 1, 1, 'cost'); if (m) { move(g, m, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Warrior of Zera.`); } } },
    effs: [lockInstall, { type: 'trig', mand: true, label: 'Your opponent discards 3 random cards',
      on: (g, ev, c) => evSummoned(ev, c, ['special']),
      cond: (g, c, p) => stOf(g, p).some(x => faceUp(x) && named(x, 'Pandemonium')),
      res: function* (g, c, p) { if (!stOf(g, p).some(x => faceUp(x) && named(x, 'Pandemonium'))) return; for (let i = 0; i < 3; i++) if (!discardRandom(g, opp(p), p)) break; } }] },
  'Mecha-Dog Marron': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Inflict 1000 damage',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p, L2) { if (L2.ev && L2.ev.battle) bothDamage(g, p, 1000, c); else damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },
  'Medusa Worm': { effs: [flipDown,
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a monster', on: (g, ev, c) => evSummoned(ev, c, ['flip']),
      cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which of their monsters?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Mefist the Infernal General': { self: { piercing: true },
    effs: [{ type: 'trig', mand: true, label: 'Your opponent discards 1 random card',
      on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
      res: function* (g, c, p) { discardRandom(g, opp(p), p); } }] },

  /* ----- Me ----- */
  'Mega Ton Magical Cannon': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => fieldOf(g, p).reduce((s, x) => s + ctr(x, 'spell'), 0) >= 10,
    cost: function* (g, c, p) { let n = 10; for (const x of fieldOf(g, p).filter(x => ctr(x, 'spell')).sort((a, b) => ctr(b, 'spell') - ctr(a, 'spell'))) { const k = Math.min(n, ctr(x, 'spell')); addCtr(g, x, 'spell', -k); n -= k; if (!n) break; }
      log(g, `${PN(g, p)} removed 10 Spell Counters.`); },
    res: function* (g, c, p) { destroy(g, fieldOf(g, opp(p)), { by: p, src: c }); } }] },
  // Only one Megamorph on a monster counts (ruling 2). PARTIAL: done as + its original ATK or - half of it, so other changes stack on top.
  'Megamorph': {
    cont: { atk: (g, src, m) => { if (src.equipTo !== m.u) return 0;
      const first = stOnField(g).filter(x => named(x, 'Megamorph') && faceUp(x) && x.equipTo === m.u).sort((a, b) => a.u - b.u)[0]; if (first !== src) return 0;
      const me = g.p[src.ctrl].lp, them = g.p[opp(src.ctrl)].lp, b = baseAtk(m);
      return me < them ? b : me > them ? -Math.floor(b / 2) : 0; } },
    effs: [equipAct()] },
  'Megarock Dragon': {
    self: { atk: (g, c) => 700 * (c.flags.rocks || 0), def: (g, c) => 700 * (c.flags.rocks || 0) },
    proc: { label: 'Special Summon (banish Rocks from your GY)',
      cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && race(x) === 'Rock'),
      cost: function* (g, c, p, grp) { const cs = g.p[p].gy.filter(x => isMon(x) && race(x) === 'Rock'); const xs = yield* pick(g, p, 'Banish any number of Rock monsters from your GY', cs, 1, cs.length, 'cost');
        for (const x of xs) move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${xs.length} Rock monster${xs.length > 1 ? 's' : ''}.`); c.flags.rocks = xs.length; } },
    effs: [lockInstall] },
  'Mermaid Knight': { self: { maxAttacks: g => umiOn(g) ? 2 : 1 } },
  'Metalmorph': { effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { equipTrap(g, c, live(L2)[0], L2); } }],
    // "During damage calculation only": read in the Damage Step, when the equipped monster is the attacker.
    cont: { atk: (g, src, m) => src.equipTo !== m.u ? 0 : 300 + (g.inDS && g.battle && g.battle.a === m && g.battle.t && onField(g.battle.t) ? Math.floor(stat(g, g.battle.t, 'atk') / 2) : 0),
      def: (g, src, m) => src.equipTo === m.u ? 300 : 0 } },
  // PARTIAL: a Spell, Trap or monster effect of the opponent that targets a monster in a GY is blocked by reading its text.
  'Metalsilver Armor': {
    cont: {
      forbid: (g, src, a) => { if (a.type !== 'activate') return false; g.f24actor = a.p; const m = equippedTo(g, src);
        return !!m && m.ctrl === src.ctrl && a.p !== src.ctrl && GY_TARGET.test(txt(a.c)); },
      grant: (g, src, c, flag) => { if (flag !== 'cantBeTargeted' || c.zone !== 'm') return false; const m = equippedTo(g, src);
        return !!m && m !== c && m.ctrl === src.ctrl && g.f24actor === opp(src.ctrl); },
    },
    effs: [equipAct()] },
  'Metalzoa': { effs: [lockInstall, metalSummon('Zoa')] },
  'Metamorphosis': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(m => metaTargets(g, p, lv(m)).length),
    cost: function* (g, c, p, L2) { const [m] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p).filter(m => metaTargets(g, p, lv(m)).length), 1, 1, 'cost'); L2.data.lv = lv(m); const nm = shownName(m); move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); },
    res: function* (g, c, p, L2) { const fs = metaTargets(g, p, L2.data.lv); if (!fs.length || freeM(g, p) < 0) return; const [f] = yield* pick(g, p, `Special Summon which Level ${L2.data.lv} Fusion Monster?`, fs, 1, 1, 'good'); if (f) ss(g, p, f, 'atk'); } }] },
  // Ruling: once activated it resolves even if their LP dropped to 3000 or less.
  'Meteor of Destruction': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].lp > 3000,
    res: function* (g, c, p) { damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },
  // Your turn, Draw Phase to the end of the Battle Phase (not in the Damage Step): your monsters pierce this turn.
  // The grant works from the GY (a card's cont with loc 'gy'), so it lasts while a used Meteorain is there.
  'Meteorain': {
    cont: { loc: 'gy', grant: (g, src, c, flag) => flag === 'piercing' && c.zone === 'm' && !!g.f24meteor && g.f24meteor[c.ctrl] === g.turnNo && g.tp === c.ctrl },
    effs: [{ type: 'act', cond: (g, c, p) => g.tp === p && ['draw', 'standby', 'main1', 'battle'].includes(g.phase) && !g.inDS,
      res: function* (g, c, p) { (g.f24meteor || (g.f24meteor = [0, 0]))[p] = g.turnNo; log(g, `${PN(g, p)}'s monsters inflict piercing damage this turn.`); } }] },
  'Michizure': { effs: [trapTrig({ label: 'Destroy a monster', tags: { destroy: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.from === 'm' && ev.to === 'gy' && ev.c.owner === c.ctrl && ev.snap && ev.snap.mon && fieldMons(g).length > 0,
    cond: g => fieldMons(g).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } })] },
  'Micro Ray': { effs: [{ type: 'act', ds: true, cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which face-up monster\'s DEF becomes 0?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { set: 0, which: 'def', end: true }); log(g, `${name(t)}'s DEF became 0 until the end of the turn.`); } } }] },
  // The negation runs from msgCheck (see the helpers).
  'Mid Shield Gardna': { effs: [flipDown, { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { armMSG(g, c); return false; } }] },
  'Millennium Scorpion': { effs: [{ type: 'trig', mand: true, label: 'Gain 500 ATK',
    on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
    res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500 }); log(g, `${name(c)} gained 500 ATK.`); } } }] },
  'Milus Radiant': { cont: { atk: (g, src, m) => faceUp(m) ? (attr(m) === 'EARTH' ? 500 : attr(m) === 'WIND' ? -400 : 0) : 0 } },
  // PARTIAL: "by your opponent's card" is read from the move's own player when the effect gave one, else the turn player.
  'Minar': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Inflict 1000 damage',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'hand' && ev.to === 'gy' && ['discard', 'effect'].includes(ev.reason) && (ev.by != null ? ev.by !== c.owner : g.tp !== c.owner),
    res: function* (g, c, p) { damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },
  'Mine Golem': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Inflict 500 damage',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  'Minefield Eruption': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && named(m, 'Mine Golem')),
    res: function* (g, c, p) { const gs = monsOf(g, p).filter(m => faceUp(m) && named(m, 'Mine Golem')); if (!gs.length) return;
      damage(g, opp(p), 1000 * gs.length, { src: c, srcP: p }); destroy(g, gs.filter(onField), { by: p, src: c }); } }] },
  'Minor Goblin Official': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].lp <= 3000, res: noop },
    { type: 'trig', loc: 'st', mand: true, label: 'Inflict 500 damage', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl,
      res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  'Mispolymerization': { effs: [{ type: 'act',
    cond: g => !!g.sw && g.sw.cs.some(x => onField(x) && faceUp(x) && D(x).k === 'fusion'),
    res: function* (g, c, p) { const fs = fieldMons(g).filter(x => faceUp(x) && D(x).k === 'fusion'); for (const x of fs) move(g, x, 'extra', { reason: 'effect', by: p });
      if (fs.length) log(g, `${fs.map(name).join(', ')} returned to the Extra Deck.`); } }] },
  'Moai Interceptor Cannons': { effs: [flipDown] },
});

function metaTargets(g, p, L0) { return g.p[p].extra.filter(f => D(f).k === 'fusion' && lv(f) === L0 && !forbid(g, { type: 'ss', c: f, p, how: 'special' })); }

/* ----- Goat only ----- */
E.addScripts({
  // "Banish any monster destroyed by battle with this card": the doomed monster is marked after damage calculation,
  // so its battle destruction sends it to the banished pile (the mark is removed if it survives).
  'Lesser Fiend': { effs: [{ type: 'trig', res: noop, on: (g, ev, c) => {
    if (ev.type === 'afterCalc' && (ev.a === c || ev.t === c)) { const o = ev.a === c ? ev.t : ev.a; if (o && onField(o) && o.flags.battleDoomed) { o.flags.banishOnLeave = true; o.flags.f24lf = true; } }
    if (ev.type === 'dsEnd' && (ev.a === c || ev.t === c)) for (const o of [ev.a, ev.t]) if (o && o !== c && onField(o) && o.flags.f24lf) { o.flags.banishOnLeave = false; o.flags.f24lf = false; }
    return false; } }] },
}, 'goat');
})();
