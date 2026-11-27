/* Full pool batch 28: Stray Lambs to Wasteland (build/batches/full/full-28.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings.
 Cards with a Goat-only script elsewhere (Stumbling, Suijin, Swamp Battleguard, Swords of Revealing Light, Token Thanksgiving,
 Tribe-Infecting Virus, Tribute to the Doomed, Tsukuyomi, Umi, United We Stand, Valkyrion the Magna Warrior, Waboku) are
 ported here as the shared version; the Goat-only ones still win under Goat. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, damage, gain, pay, negate, addMod, equip, addRule, tokens, ritualSummon,
  canRitual, dice, name, D, isMon, isST, isSpell, isTrap, isExtraD, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf,
  allField, fieldMons, freeM, freeST, nFreeM, shuffleDeck, log, PN, live, opp, stOnField, spellTrapAct, evSummoned, emit,
  forbid, stat, setFaceDown } = L;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const ATK = (g, c) => stat(g, c, 'atk');
const txt = c => D(c).ps || D(c).tx || '';
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
// a monster that can be Normal Summoned/Set (Tribute Doll, Unshaven Angler)
const canNS = x => isMon(x) && !isExtraD(D(x)) && !['ritual', 'token'].includes(D(x).k) && !/Cannot be Normal Summoned/i.test(txt(x));
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'atk' }); };
const flipUp = (g, c, pos) => { c.pos = pos; g.seq++; log(g, `${name(c)} was flipped face-up.`); emit(g, { type: 'flip', c, p: c.ctrl }); };
const pos2 = function* (g, p, x) { const i = yield* choose(g, p, `${name(x)}: which position?`, ['Attack Position', 'Defense Position']); return i ? 'def' : 'atk'; };
function* discardPick(g, p, n, text, filter = () => true) { const h = g.p[p].hand.filter(filter); if (!h.length) return []; const xs = yield* pick(g, p, text, h, Math.min(n, h.length), Math.min(n, h.length), 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'discard' }); if (xs.length) log(g, `${PN(g, p)} discarded ${xs.map(name).join(', ')}.`); return xs; }
const discardRandom = (g, p, by) => { const h = g.p[p].hand; if (!h.length) return null; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard', by }); log(g, `${PN(g, p)} discarded ${name(x)} at random.`); return x; };
// Flip effect shape
const flip = (label, more) => ({ type: 'trig', mand: true, faceDownOk: true, label, on: (g, ev, c) => ev.type === 'flip' && ev.c === c, ...more });
// Equip Spells: target a face-up monster that passes filter, equip it at resolution
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) equip(g, c, t); } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
// Field Spells: a stat change for every monster that passes filter
// (a monster unaffected by Spells, like Torpedo Fish under Umi, is skipped)
// (only the monster's own flag is read, not other cards' grants, so a stat check never loops back here)
const spellOk = (g, m) => { if (m.flags.unaffectedSpells) return false; const sc = E.SCRIPTS[D(m).n], v = sc && sc.self && sc.self.unaffectedSpells; return !(v && !L.negd(g, m) && (typeof v === 'function' ? v(g, m) : v)); };
const fieldMod = (filter, a, d) => ({ effs: [actNoop], cont: { atk: (g, src, m) => filter(m) && spellOk(g, m) ? a : 0, def: (g, src, m) => filter(m) && spellOk(g, m) ? d : 0 } });
// A Normal Trap whose condition is an event the engine opens no window for (as full-17.js): offered as an optional trigger
// while it is Set (not the turn it was Set); it is turned face-up as it activates and goes to the GY after it resolves.
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });
// Spirit return (as goat-1.js): during the End Phase of the turn it was Normal Summoned or flipped face-up, it returns to the hand.
const spiritReturn = { type: 'trig', mand: true, label: 'Return to the hand',
  on: (g, ev, c) => {
    if ((ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how)) || (ev.type === 'flip' && ev.c === c)) c.flags.spirit = g.turnNo;
    return ev.type === 'phase' && ev.ph === 'end' && c.flags.spirit === g.turnNo;
  },
  res: function* (g, c, p) { if (onField(c) && faceUp(c)) { move(g, c, 'hand', { reason: 'effect' }); log(g, `${name(c)} returned to the hand.`); } } };
// "Cannot be Special Summoned" (Susa Soldier, Tsukuyomi) and "only by its own effect" (Theinen): one duel-long rule installed
// by the first event any of these cards sees (as full-04.js). ENGINE: no general "can't be Special Summoned" flag yet.
const LOCKS = {
  'Susa Soldier': () => true,
  'Tsukuyomi': () => true,
  'Theinen the Great Sphinx': (g, a) => !a.c.f28own,
};
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: (g) => { if (!g.f28lock) { g.f28lock = true; addRule(g, (g2, a) => { if (a.type !== 'ss' || !a.c || !a.c.id) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); } return false; } };
// Archfiends (as full-20.js): the Standby Phase cost, and the die roll when an opponent's effect targets it.
const isArchfiend = c => isMon(c) && /Archfiend/.test(name(c));
const archCost = n => ({ type: 'trig', mand: true, label: `Pay ${n} LP`, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
  // the card is destroyed when its controller can't pay; Pandemonium removes the cost
  res: function* (g, c, p) { if (!onField(c) || allField(g).some(x => faceUp(x) && named(x, 'Pandemonium'))) return; if (g.p[p].lp > n) pay(g, p, n); else destroy(g, [c], { by: p }); } });
// ENGINE: no "as a targeting effect resolves" hook, so the roll is an optional Spell Speed 3 response to the targeting link.
const archDice = (hits, label) => ({ type: 'quick', speed: 3, ds: true, label,
  cond: (g, c, p, x) => { const T = x.top; return !!T && !T.negated && T.p !== p && !(T.f28dice || []).includes(c.u) && T.t.includes(c); },
  target: function* (g, c, p, L2) { const T = g.chain[g.chain.length - 1]; (T.f28dice || (T.f28dice = [])).push(c.u); L2.data.L = T; },
  res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated) return; const n = dice(g, p); if (hits.includes(n)) { T.negBy = p; negate(g, T, true); } else log(g, 'Nothing happened.'); } });
// Kazejin, Sanga, Suijin (as classic-2.js): the attacker's ATK becomes 0 for this damage calculation, once while face-up.
// PARTIAL: the engine has no window during damage calculation, so it is used in the Damage Step windows of the battle;
// the 0 lasts until damage calculation is done (removed at afterCalc).
const guardian = [
  { type: 'quick', ds: true, label: 'Make the attacker’s ATK 0',
    cond: (g, c, p) => g.inDS && g.battle && g.battle.t === c && g.tp !== c.ctrl && !c.flags.guardUsed && g.battle.a && onField(g.battle.a) && !g.battle.a.mods.some(m => m.guardZero),
    target: function* (g, c, p, L2) { L2.t = [g.battle.a]; },
    after: (g, c) => { c.flags.guardUsed = true; },
    res: function* (g, c, p, L2) { const a = live(L2)[0]; if (!a || a.zone !== 'm' || !g.battle) return; addMod(g, a, { set: 0, which: 'atk', end: true, guardZero: true }); g.seq++; log(g, `${name(a)}'s ATK became 0 for damage calculation.`); } },
  { type: 'trig', on: (g, ev) => { if ((ev.type === 'afterCalc' || ev.type === 'dsEnd') && ev.a && ev.a.mods.some(m => m.guardZero)) { ev.a.mods = ev.a.mods.filter(m => !m.guardZero); g.seq++; } return false; }, res: noop },
];
const UMIS = ['Umi', 'A Legendary Ocean'];
const umiUp = g => allField(g).some(x => faceUp(x) && UMIS.includes(D(x).n));
const umiMod = c => { const r = race(c); return ['Fish', 'Sea Serpent', 'Thunder', 'Aqua'].includes(r) ? 200 : ['Machine', 'Pyro'].includes(r) ? -200 : 0; };
const MAGNETS = ['Alpha The Magnet Warrior', 'Beta The Magnet Warrior', 'Gamma the Magnet Warrior'];
const nomiGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src && !src.nomiOk };
const MEISEI = 'Sealmaster Meisei';
const meiseiUp = (g, p) => monsOf(g, p).some(x => faceUp(x) && named(x, MEISEI));
// "Destroy this card when Sealmaster Meisei is removed from the field" (no face-up Meisei left on your side)
const meiseiGone = { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Sealmaster Meisei left: destroy this card',
  on: (g, ev, c) => ev.type === 'move' && ev.wasField && named(ev.c, MEISEI) && ev.prevCtrl === c.ctrl && !meiseiUp(g, c.ctrl),
  res: function* (g, c, p) { if (onField(c) && !meiseiUp(g, p)) destroy(g, [c], { rule: true }); } };
const isUnion = c => isMon(c) && /Union/.test(D(c).ab || '');
const isNormalMon = c => D(c).k === 'normal';
// "Your opponent skips their next Main Phase 1" / "can't declare an attack during their next turn": their next turn's number
const nextTurnOf = (g, o) => g.tp === o ? g.turnNo + 2 : g.turnNo + 1;

E.addScripts({
  /* ----- Spells ----- */
  // You can't Summon other monsters the turn you activate it (Set is allowed). ENGINE: Flip Summons can't be forbidden.
  'Stray Lambs': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => nFreeM(g, p) >= 2 && !g.summoned[p],
    after: (g, c, p) => { addRule(g, (g2, a) => a.p === p && (a.type === 'ns' || (a.type === 'ss' && !(a.c && a.c.id === 'tok-lamb-token'))), { end: g.turnNo }); },
    res: function* (g, c, p) { if (nFreeM(g, p) < 2) return; tokens(g, p, { n: 'Lamb Token', a: 'EARTH', r: 'Beast', lv: 1, atk: 0, def: 0 }, 2, 'def'); } }] },
  // Mandatory trigger that starts a chain in the summon response timing; changes the summoned Attack Position monsters.
  'Stumbling': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Change it to Defense Position',
      on: (g, ev) => ev.type === 'summon' && ev.cs.some(m => onField(m) && m.pos === 'atk'),
      res: function* (g, c, p, L2) { for (const m of (L2.ev && L2.ev.cs) || []) toDef(g, m); } }] },
  // Stays on the field until the End Phase of the opponent's 3rd turn; flips their Set monsters face-up (Flip effects activate).
  'Swords of Revealing Light': { cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && a.c.ctrl !== src.ctrl },
    effs: [{ type: 'act', after: (g, c, p, L2) => { L2.keep = true; },
      res: function* (g, c, p, L2) { L2.keep = true; if (monsOf(g, opp(p)).some(x => x.pos === 'set')) for (const x of monsOf(g, opp(p))) if (x.pos === 'set') flipUp(g, x, 'def'); log(g, `${PN(g, opp(p))}'s monsters can't declare an attack.`); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Count a turn', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp !== c.ctrl,
      res: function* (g, c) { if (!onField(c)) return; L.addCtr(g, c, 'swords', 1); if (L.ctr(c, 'swords') >= 3) destroy(g, [c], { rule: true }); } }] },
  // PARTIAL: the new target is any other face-up monster (an Equip Spell's own "equip only to" isn't checked).
  'Tailor of the Fickle': { effs: [{ type: 'act',
    cond: g => allField(g).some(x => x.zone === 'st' && faceUp(x) && L.equippedTo(g, x) && fieldMons(g).some(m => faceUp(m) && m.u !== x.equipTo)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Move which Equip Card?', allField(g).filter(x => x.zone === 'st' && faceUp(x) && L.equippedTo(g, x) && fieldMons(g).some(m => faceUp(m) && m.u !== x.equipTo)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const e = live(L2)[0]; if (!e || !faceUp(e) || !L.equippedTo(g, e)) return; const ms = fieldMons(g).filter(m => faceUp(m) && m.u !== e.equipTo); if (!ms.length) return;
      const [m] = yield* pick(g, p, `Equip ${name(e)} to which monster?`, ms, 1, 1, e.ctrl === p ? 'good' : 'bad'); if (m) { e.equipTo = m.u; g.seq++; log(g, `${name(e)} was moved to ${name(m)}.`); } } }] },
  // Activated while you control a face-up Sealmaster Meisei. PARTIAL: face-up Spells' static effects still apply.
  'Talisman of Trap Sealing': { cont: { forbid: (g, src, a) => a.type === 'activate' && a.c && isTrap(a.c), negates: (g, src, c) => isTrap(c) && onField(c) },
    effs: [{ type: 'act', cond: (g, c, p) => meiseiUp(g, p), res: function* (g, c, p) { if (!meiseiUp(g, p)) destroy(g, [c], { rule: true }); else log(g, 'Trap Cards can’t be activated.'); } }, meiseiGone] },
  // "Neither player can destroy Set Spell and Trap Cards until your opponent's next End Phase." It works from the GY.
  // PARTIAL: if Timidity leaves the GY before then, the protection ends.
  'Timidity': { cont: { loc: 'gy', replaceDestroy: (g, src, c) => { const t = g.f28timid && g.f28timid[src.u]; if (t == null || g.turnNo > t || !['st', 'fz'].includes(c.zone) || c.pos !== 'set') return false; log(g, `${PN(g, c.ctrl)}'s Set card can’t be destroyed (Timidity).`); return true; } },
    effs: [{ type: 'act', res: function* (g, c, p) { (g.f28timid || (g.f28timid = {}))[c.u] = g.turnNo + 1; log(g, 'Set Spell and Trap Cards can’t be destroyed until the opponent’s next End Phase.'); } }] },
  'Token Thanksgiving': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(x => D(x).k === 'token'),
    res: function* (g, c, p) { const out = destroy(g, fieldMons(g).filter(x => D(x).k === 'token'), { by: p, src: c }); if (out.length) gain(g, p, 800 * out.length); } }] },
  // Paying 500 is a cost: a player who can't pay can't declare the attack. Each Toll is paid separately.
  'Toll': { cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && g.p[a.c.ctrl].lp <= 500 * allField(g).filter(x => faceUp(x) && named(x, 'Toll')).length },
    effs: [actNoop,
      { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => { if (ev.type !== 'attack' || !ev.a) return false; const paid = c.flags.f28toll || (c.flags.f28toll = {}); const k = `${g.turnNo}:${ev.a.u}:${ev.a.attacks}`;
        if (!paid[k]) { paid[k] = true; pay(g, ev.a.ctrl, 500); } return false; } }] },
  'Tremendous Fire': { effs: [{ type: 'act', res: function* (g, c, p) { damage(g, opp(p), 1000, { src: c, srcP: p }); damage(g, p, 500, { src: c, srcP: p }); } }] },
  // PARTIAL: the opponent's face-up Continuous Traps keep their static effects (their activations and effects are stopped).
  'Triangle Ecstasy Spark': { effs: [{ type: 'act', cond: g => fieldMons(g).some(x => faceUp(x) && named(x, 'Harpie Lady Sisters')),
    res: function* (g, c, p) { const o = opp(p);
      for (const x of fieldMons(g).filter(x => faceUp(x) && named(x, 'Harpie Lady Sisters'))) addMod(g, x, { set: 2700, which: 'atk', end: true });
      addRule(g, (g2, a) => a.type === 'activate' && a.c && isTrap(a.c) && a.p === o, { end: g.turnNo });
      log(g, `Harpie Lady Sisters has 2700 ATK, and ${PN(g, o)} can't activate Traps this turn.`); } }] },
  // PARTIAL: the 2000 is added to the current ATK/DEF until the End Phase (not to the original values).
  'Triangle Power': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isNormalMon(x) && lv(x) === 1),
      res: function* (g, c, p) { const ms = monsOf(g, p).filter(x => faceUp(x) && isNormalMon(x) && lv(x) === 1); for (const x of ms) addMod(g, x, { atk: 2000, def: 2000, end: true });
        if (ms.length) log(g, `${ms.map(name).join(', ')} gained 2000 ATK and DEF.`); (g.f28tri || (g.f28tri = [])).push({ src: c.u, p, turn: g.turnNo }); } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy your Level 1 Normal Monsters',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!g.f28tri && g.f28tri.some(e => e.src === c.u && e.turn === g.turnNo),
      res: function* (g, c) { const es = g.f28tri.filter(e => e.src === c.u && e.turn === g.turnNo); g.f28tri = g.f28tri.filter(e => !es.includes(e));
        for (const e of es) destroy(g, monsOf(g, e.p).filter(x => isNormalMon(x) && lv(x) === 1), { by: e.p, src: c }); } }] },
  // The Level 7 monster must be one that can be Normal Summoned/Set; it can't attack this turn.
  'Tribute Doll': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).length > 0 && g.p[p].hand.some(x => x !== c && canNS(x) && lv(x) === 7 && canSS(g, p, x)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 monster', monsOf(g, p), 1, 1, 'cost'); if (x) { const n = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${n}.`); } },
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => canNS(x) && lv(x) === 7 && canSS(g, p, x)); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which Level 7 monster?', cs, 1, 1, 'good'); if (x && ss(g, p, x, 'atk')) addRule(g, (g2, a) => a.type === 'attack' && a.c === x, { end: g.turnNo }); } }] },
  'Tribute to the Doomed': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && fieldMons(g).length > 0,
    cost: function* (g, c, p) { yield* discardPick(g, p, 1, 'Discard 1 card', x => x !== c); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Turtle Oath': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => canRitual(g, p, { monster: x => named(x, 'Crab Turtle') }),
    res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, 'Crab Turtle') }); } }] },
  'Umi': { effs: [actNoop], cont: { atk: (g, src, c) => spellOk(g, c) ? umiMod(c) : 0, def: (g, src, c) => spellOk(g, c) ? umiMod(c) : 0 } },
  'Umiiruka': fieldMod(m => attr(m) === 'WATER', 500, -400),
  'Wasteland': fieldMod(m => ['Dinosaur', 'Zombie', 'Rock'].includes(race(m)), 200, 200),
  // "The equipped monster gains 800 ATK/DEF for each face-up monster you control" (you: this card's controller).
  'United We Stand': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 800 * monsOf(g, src.ctrl).filter(faceUp).length : 0, def: (g, src, m) => src.equipTo === m.u ? 800 * monsOf(g, src.ctrl).filter(faceUp).length : 0 },
    effs: [equipAct()] },
  'Ultra Evolution Pill': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => race(x) === 'Reptile') && g.p[p].hand.some(x => x !== c && isMon(x) && race(x) === 'Dinosaur' && D(x).k !== 'ritual' && canSS(g, p, x)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 Reptile monster', monsOf(g, p).filter(x => race(x) === 'Reptile'), 1, 1, 'cost'); if (x) { const n = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${n}.`); } },
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Dinosaur' && D(x).k !== 'ritual' && canSS(g, p, x)); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which Dinosaur?', cs, 1, 1, 'good'); if (x) ss(g, p, x, yield* pos2(g, p, x)); } }] },
  'Vile Germs': { cont: eqBonus(300, 300), effs: [equipAct(m => race(m) === 'Plant', 'Equip Vile Germs to which Plant?')] },
  'Violet Crystal': { cont: eqBonus(300, 300), effs: [equipAct(m => race(m) === 'Zombie', 'Equip Violet Crystal to which Zombie?')] },

  /* ----- Traps ----- */
  // Activated while you control a face-up Sealmaster Meisei. PARTIAL: face-up Spells' static effects still apply.
  'Talisman of Spell Sealing': { cont: { forbid: (g, src, a) => a.type === 'activate' && a.c && isSpell(a.c), negates: (g, src, c) => isSpell(c) && onField(c) },
    effs: [{ type: 'act', cond: (g, c, p) => meiseiUp(g, p), res: function* (g, c, p) { if (!meiseiUp(g, p)) destroy(g, [c], { rule: true }); else log(g, 'Spell Cards can’t be activated.'); } }, meiseiGone] },
  // The opponent's monsters must attack the selected monster this turn: the others can't be attack targets while it stays.
  // It works from the GY (PARTIAL: if Taunt leaves the GY that turn, it stops; a face-down other monster can still be attacked).
  'Taunt': { cont: { loc: 'gy', grant: (g, src, m, flag) => { if (flag !== 'noAttackTarget') return false; const s = g.f28taunt && g.f28taunt[src.u]; if (!s || s.turn !== g.turnNo || m.ctrl !== s.p || m.u === s.u) return false;
      const sel = fieldMons(g).find(x => x.u === s.u); return !!sel && sel.ctrl === s.p && sel.flags.f28taunt === src.u; } },
    // PARTIAL: the engine opens no window at the end of Main Phase 1, so it can also be activated at the start of the Battle Phase
    // (before any attack is declared), which stands in for that moment.
    effs: [{ type: 'act', cond: (g, c, p) => g.tp !== p && (g.phase === 'main1' || (g.phase === 'battle' && !g.aw && !g.battle && !g.inDS && monsOf(g, g.tp).every(x => !x.attacks && !x.declared))) && monsOf(g, p).length > 0,
      res: function* (g, c, p) { const [m] = yield* pick(g, p, 'Select 1 monster on your side of the field', monsOf(g, p), 1, 1, 'good'); if (!m) return;
        m.flags.f28taunt = c.u; (g.f28taunt || (g.f28taunt = {}))[c.u] = { p, u: m.u, turn: g.turnNo }; g.seq++; log(g, `${PN(g, opp(p))} must attack ${m.pos === 'set' ? 'the selected face-down monster' : name(m)} this turn.`); } }] },
  'Token Feastevil': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.sw && g.sw.how === 'special' && g.sw.cs.some(x => D(x).k === 'token' && onField(x)),
    res: function* (g, c, p) { const out = destroy(g, fieldMons(g).filter(x => D(x).k === 'token'), { by: p, src: c }); if (out.length) damage(g, opp(p), 300 * out.length, { src: c, srcP: p }); } }] },
  // A Spell Counter each time a Spell Card that was activated while this card was face-up resolves (not when its activation
  // is negated, and not for Spells this card was chained to). Normal, Quick-Play and Ritual Spells count as they go to the GY
  // after resolving; Continuous, Equip and Field Spells when their link has left the chain. Links seen on the chain are watched
  // so a negated one is known. PARTIAL: a Set Continuous/Equip/Field Spell flipped face-up is only counted if its link is seen.
  'Tower of Babel': { effs: [{ type: 'act', res: function* (g, c) { if (onField(c)) c.flags.babel = { ex: g.chain.map(x => x.c), tr: [], neg: [], pend: [], done: [] }; } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: '4th Spell Counter: destroy it, 3000 damage',
      on: (g, ev, c) => { const b = c.flags.babel; if (!b || b.hit) return false;
        const stays = x => ['Continuous', 'Equip', 'Field'].includes(D(x).sub);
        const count = who => { L.addCtr(g, c, 'spell', 1); log(g, `${name(c)} got a Spell Counter (${L.ctr(c, 'spell')}).`); if (L.ctr(c, 'spell') >= 4) { b.hit = true; b.victim = who; return true; } return false; };
        let hit = false;
        for (const L2 of g.chain) if (L2.cardAct && isSpell(L2.c) && !b.ex.includes(L2.c) && !b.tr.includes(L2)) { b.tr.push(L2); b.pend = b.pend.filter(x => x !== L2.c); }
        for (const x of b.pend.slice()) { if (ev.type === 'move' && ev.c === x) continue; b.pend.splice(b.pend.indexOf(x), 1); if (onField(x) && faceUp(x)) { b.done.push(x); hit = count(x.ctrl) || hit; } }
        for (const L2 of b.tr.slice()) { if (g.chain.includes(L2)) continue; b.tr.splice(b.tr.indexOf(L2), 1);
          if (!stays(L2.c)) { if (L2.negated) b.neg.push(L2.c); continue; }
          if (b.done.includes(L2.c)) { b.done.splice(b.done.indexOf(L2.c), 1); continue; }
          if (!L2.negated) hit = count(L2.p) || hit; }
        if (ev.type === 'move' && ev.c && isSpell(ev.c)) {
          if (stays(ev.c) && ev.from === 'hand' && ev.reason === 'activate' && !b.pend.includes(ev.c)) b.pend.push(ev.c);
          if (!stays(ev.c) && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule') {
            if (b.ex.includes(ev.c)) b.ex.splice(b.ex.indexOf(ev.c), 1);
            else if (b.neg.includes(ev.c)) b.neg.splice(b.neg.indexOf(ev.c), 1);
            else hit = count(ev.prevCtrl) || hit; } }
        return hit; },
      res: function* (g, c) { const b = c.flags.babel; if (!onField(c) || !b) return; const v = b.victim; if (destroy(g, [c], { by: c.ctrl }).length) damage(g, v, 3000, { src: c, srcP: c.ctrl }); } }] },
  // "When a face-up Attack Position monster your opponent controls is changed to face-up Defense Position". The engine opens no
  // window after a position change, so it is offered as an optional trigger while Set. Not in the Damage Step.
  'Tragedy': { effs: [trapTrig({ label: 'Destroy their Defense Position monsters', tags: { destroy: 1 },
    on: (g, ev, c) => ev.type === 'pos' && ev.c && ev.c.ctrl !== c.ctrl && ev.c.zone === 'm' && ev.c.pos === 'def' && (ev.from ? ev.from === 'atk' : true) && !g.inDS,
    cond: g => !g.inDS,
    res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)).filter(x => x.pos !== 'atk'), { by: p, src: c }); } })] },
  'Tutan Mask': { effs: [{ type: 'act',
    cond: (g, c, p, x) => { const T = x.top; return spellTrapAct(T) && !T.negated && T.t.length === 1 && onField(T.t[0]) && T.t[0].zone === 'm' && faceUp(T.t[0]) && race(T.t[0]) === 'Zombie'; },
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; T.negBy = p; negate(g, T, true); } }] },
  // Discarding a Spell Card is the cost. Ignition effect of the face-up Trap (your Main Phase).
  'Type Zero Magic Crusher': { effs: [actNoop,
    { type: 'ign', loc: 'st', label: 'Discard a Spell: 500 damage', cond: (g, c, p) => g.p[p].hand.some(isSpell),
      cost: function* (g, c, p) { yield* discardPick(g, p, 1, 'Discard 1 Spell Card', isSpell); },
      res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  // "You take no battle damage from your opponent's monsters this turn. Your monsters can't be destroyed by battle this turn."
  // The battle protection works from the GY (the card is there after it resolves) for the rest of the turn.
  'Waboku': { cont: { loc: 'gy', grant: (g, src, m, flag) => flag === 'noBattleDestroy' && m.zone === 'm' && g.p[m.ctrl].wabokuTurn === g.turnNo },
    effs: [{ type: 'act', res: function* (g, c, p) { g.p[p].noBattleDamage = g.turnNo; g.p[p].wabokuTurn = g.turnNo; g.seq++; log(g, `${PN(g, p)}'s monsters can't be destroyed by battle this turn, and ${PN(g, p)} takes no battle damage.`); } }] },

  /* ----- Monsters ----- */
  // Quick Effect, once per turn per copy: banish 2 DARKs from your GY; banish this card until the End Phase.
  'Strike Ninja': { effs: [
    { type: 'quick', opt: true, label: 'Banish 2 DARKs: banish this card until the End Phase',
      cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK').length >= 2,
      cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Banish 2 DARK monsters from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK'), 2, 2, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${xs.map(name).join(', ')}.`); },
      res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; const pos = c.pos; move(g, c, 'ban', { reason: 'effect', by: p }); if (c.zone === 'ban') { c.flags.f28ninja = { turn: g.turnNo, pos, p }; log(g, 'Strike Ninja was banished until the End Phase.'); } } },
    { type: 'trig', loc: 'ban', mand: true, label: 'Return to the field',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!c.flags.f28ninja && c.flags.f28ninja.turn === g.turnNo,
      res: function* (g, c) { const f = c.flags.f28ninja; if (c.zone !== 'ban' || !f) return; c.flags.f28ninja = null;
        if (freeM(g, c.owner) >= 0) { move(g, c, 'm', { ctrl: c.owner, pos: f.pos, reason: 'effect' }); log(g, 'Strike Ninja returned to the field.'); } else { move(g, c, 'gy', { reason: 'rule' }); log(g, 'Strike Ninja had no free zone and was sent to the GY.'); } } }] },
  'Suijin': { effs: guardian },
  // FLIP (mandatory): Tribute 1 other monster (cost); Special Summon 1 Fusion Monster from the Extra Deck, destroyed in the End Phase.
  // A Fusion Monster turned face-down before then is not destroyed (its mark is cleared).
  'Summoner of Illusions': { effs: [
    flip('Tribute a monster: summon a Fusion Monster', { tags: { ss: 1 },
      cond: (g, c, p) => monsOf(g, p).some(x => x !== c) && g.p[p].extra.some(x => D(x).k === 'fusion' && canSS(g, p, x)),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 other monster', monsOf(g, p).filter(x => x !== c), 1, 1, 'cost'); if (x) { const n = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${n}.`); } },
      res: function* (g, c, p) { const cs = g.p[p].extra.filter(x => D(x).k === 'fusion' && canSS(g, p, x)); if (!cs.length || freeM(g, p) < 0) return;
        const [x] = yield* pick(g, p, 'Special Summon which Fusion Monster?', cs, 1, 1, 'good'); if (x && ss(g, p, x, 'atk')) { x.flags.f28soi = { turn: g.turnNo, src: c.u }; log(g, `${name(x)} will be destroyed in the End Phase.`); } } }),
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the Fusion Monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(m => faceUp(m) && m.flags.f28soi && m.flags.f28soi.src === c.u && m.flags.f28soi.turn === g.turnNo),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => faceUp(m) && m.flags.f28soi && m.flags.f28soi.src === c.u && m.flags.f28soi.turn === g.turnNo), { by: p }); } }] },
  // FLIP (mandatory): add 2 monsters from your GY that were sent there as Fusion Material. Every Supply watches the moves to the
  // GY (a mark on the card that a later move clears).
  'Supply': { effs: [
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { if (ev.type === 'move' && ev.c && isMon(ev.c)) ev.c.f28fusMat = ev.reason === 'fusion' && ev.to === 'gy'; return false; } },
    flip('Add 2 Fusion Material monsters', {
      cond: (g, c, p) => g.p[p].gy.filter(x => x.f28fusMat).length >= 2,
      res: function* (g, c, p) { const cs = g.p[p].gy.filter(x => x.f28fusMat); if (cs.length < 2) return; const xs = yield* pick(g, p, 'Add 2 Fusion Material monsters to your hand', cs, 2, 2, 'good');
        for (const x of xs) move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${xs.map(name).join(', ')} to the hand.`); } })] },
  // Spirit: returns to the hand. Battle damage it inflicts to the opponent is halved (rounded up).
  'Susa Soldier': { cont: { dmg: (g, src, p, n, o) => o.battle && o.src === src && p !== src.ctrl ? Math.ceil(n / 2) : undefined },
    effs: [spiritReturn, lockInstall] },
  'Swamp Battleguard': { self: { atk: (g, c) => 500 * monsOf(g, c.ctrl).filter(x => faceUp(x) && named(x, 'Lava Battleguard')).length } },
  // Once per turn it can turn itself face-down; when Flip Summoned it destroys (mandatory).
  'Swarm of Locusts': { effs: [
    { type: 'ign', opt: true, label: 'Change to face-down Defense Position', cond: (g, c) => faceUp(c),
      res: function* (g, c) { if (onField(c) && faceUp(c)) { setFaceDown(g, c); c.posChanged = true; } } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a Spell/Trap', on: (g, ev, c) => evSummoned(ev, c, ['flip']),
      cond: (g, c, p) => stOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  'Swarm of Scarabs': { effs: [
    { type: 'ign', opt: true, label: 'Change to face-down Defense Position', cond: (g, c) => faceUp(c),
      res: function* (g, c) { if (onField(c) && faceUp(c)) { setFaceDown(g, c); c.posChanged = true; } } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a monster', on: (g, ev, c) => evSummoned(ev, c, ['flip']),
      cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  // Continuous: no Trap Cards can be activated in response to its Normal Summon (both players).
  'Tactical Espionage Expert': { effs: [{ type: 'trig', res: noop, on: (g, ev, c) => {
    if (evSummoned(ev, c, ['normal', 'tribute'])) { const grp = ev.group; addRule(g, (g2, a) => a.type === 'activate' && a.c && isTrap(a.c) && !!g2.sw && g2.sw.cs.includes(c) && g2.sw.group === grp, { end: g.turnNo }); }
    return false; } }] },
  'Tainted Wisdom': { effs: [{ type: 'trig', mand: true, label: 'Shuffle your Deck',
    on: (g, ev, c) => ev.type === 'pos' && ev.c === c && c.pos === 'def' && (ev.from ? ev.from === 'atk' : true),
    res: function* (g, c, p) { shuffleDeck(g, p); log(g, `${PN(g, p)} shuffled the Deck.`); } }] },
  // Normal Summon only while you control a face-up Archfiend (it can be Set or Special Summoned anyway).
  // ENGINE: canNormal reads "Cannot be Normal Summoned or Flip Summoned unless ..." as a full ban on Normal Summon and Set, and
  // Flip Summons can't be forbidden. PARTIAL: the Normal Summon is a summon rule that counts as your Normal Summon (the log
  // calls it a Special Summon), the Set is a hand effect that Sets it as its cost (it uses a chain link), and its Flip Summon
  // isn't checked.
  // Normal Summon and Set: the engine's canNormal reads "unless you have an Archfiend" (2026-11-26), so no summon rule here
  'Terrorking Archfiend': {
    effs: [archCost(800), archDice([2, 5], 'Roll a die (2 or 5 negates)'),
      // the effects of an Effect Monster it destroys by battle are negated (its triggers can't be activated this turn)
      { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && isMon(ev.c) && /Effect/.test(D(ev.c).ab || '')) { const v = ev.c; addRule(g, (g2, a) => a.type === 'activate' && a.c === v, { end: g.turnNo }); } return false; } }] },
  'Teva': { effs: [{ type: 'trig', mand: true, label: 'Your opponent can’t attack next turn', on: (g, ev, c) => evSummoned(ev, c, ['tribute']),
    res: function* (g, c, p) { const o = opp(p), when = nextTurnOf(g, o); addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.ctrl === o && g2.turnNo === when, { end: when }); log(g, `${PN(g, o)} can't declare an attack during their next turn.`); } }] },
  'Theban Nightmare': { self: { atk: (g, c) => !g.p[c.ctrl].hand.length && !g.p[c.ctrl].st.some(Boolean) ? 1500 : 0 } },
  // Summoned only by its own trigger from the hand or Deck when Andro Sphinx and Sphinx Teleia you control are destroyed at the
  // same time (one Theinen per chain). Both effects are optional and can miss the timing.
  'Theinen the Great Sphinx': { effs: [lockInstall,
    { type: 'trig', loc: 'any', when: true, tags: { ss: 1 }, label: 'Pay 500 LP: Special Summon this card',
      on: (g, ev, c) => { if (!['hand', 'deck'].includes(c.zone) || ev.type !== 'move' || !ev.destroyed || !ev.wasField || ev.prevCtrl !== c.owner) return false;
        const n = D(ev.c).n, other = n === 'Andro Sphinx' ? 'Sphinx Teleia' : n === 'Sphinx Teleia' ? 'Andro Sphinx' : null; if (!other) return false;
        return g.events.some(e => e !== ev && e.type === 'move' && e.group === ev.group && e.destroyed && e.wasField && e.prevCtrl === c.owner && D(e.c).n === other); },
      cond: (g, c, p) => ['hand', 'deck'].includes(c.zone) && g.p[p].lp > 500 && freeM(g, p) >= 0,
      ok: g => !g.chain.some(L2 => named(L2.c, 'Theinen the Great Sphinx')),
      cost: function* (g, c, p) { pay(g, p, 500); },
      res: function* (g, c, p) { if (!['hand', 'deck'].includes(c.zone)) return; const fromDeck = c.zone === 'deck'; c.f28own = true; ss(g, p, c, 'atk'); c.f28own = false; if (fromDeck) shuffleDeck(g, p); } },
    { type: 'trig', when: true, label: 'Pay 500 LP: +3000 ATK', on: (g, ev, c) => evSummoned(ev, c, ['special']), cond: (g, c, p) => g.p[p].lp > 500,
      cost: function* (g, c, p) { pay(g, p, 500); },
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 3000, end: true }); log(g, `${name(c)} gained 3000 ATK until the End Phase.`); } } }] },
  'Thestalos the Firestorm Monarch': { effs: [{ type: 'trig', mand: true, label: 'Random discard', on: (g, ev, c) => evSummoned(ev, c, ['tribute']),
    res: function* (g, c, p) { const x = discardRandom(g, opp(p), p); if (x && isMon(x)) damage(g, opp(p), lv(x) * 100, { src: c, srcP: p }); } }] },
  // Tribute 1 Warrior (itself is allowed) to destroy a face-up monster whose DEF is at most this card's ATK.
  'Throwstone Unit': { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Tribute a Warrior: destroy a monster',
    cond: (g, c, p) => { const A = ATK(g, c); return fieldMons(g).some(x => faceUp(x) && stat(g, x, 'def') <= A && monsOf(g, p).some(w => w !== x && race(w) === 'Warrior')); },
    cost: function* (g, c, p, L2) { L2.data.a = ATK(g, c); const A = L2.data.a;
      const ws = monsOf(g, p).filter(w => race(w) === 'Warrior' && fieldMons(g).some(x => x !== w && faceUp(x) && stat(g, x, 'def') <= A));
      const [w] = yield* pick(g, p, 'Tribute 1 Warrior monster', ws, 1, 1, 'cost'); if (w) { const n = w.pos === 'set' ? 'a face-down monster' : name(w); move(g, w, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${n}.`); } },
    target: function* (g, c, p, L2) { const A = onField(c) ? ATK(g, c) : L2.data.a; yield* tgt(g, p, L2, 'Destroy which face-up monster?', fieldMons(g).filter(x => faceUp(x) && stat(g, x, 'def') <= A), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const A = onField(c) && faceUp(c) ? ATK(g, c) : L2.data.a; destroy(g, live(L2).filter(x => faceUp(x) && stat(g, x, 'def') <= A), { by: p }); } }] },
  // If it destroys an opponent's monster by battle (even if it is destroyed too): the opponent skips their next Main Phase 1.
  // ENGINE: no phase skip. PARTIAL: in that Main Phase 1 nothing can be summoned, Set, activated or changed (Flip Summons aside).
  'Timeater': { effs: [{ type: 'trig', loc: 'any', mand: true, label: 'Opponent skips Main Phase 1',
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.prevCtrl !== ev.killer.ctrl,
    res: function* (g, c, p) { const o = opp(p), when = nextTurnOf(g, o);
      addRule(g, (g2, a) => g2.turnNo === when && g2.phase === 'main1' && ['ns', 'set', 'ss', 'setST', 'pos', 'activate'].includes(a.type), { end: when });
      log(g, `${PN(g, o)} skips their next Main Phase 1.`); } }] },
  // PARTIAL: "unaffected by Spell Cards" covers destruction only (the engine's unaffectedSpells).
  'Torpedo Fish': { self: { unaffectedSpells: g => umiUp(g) } },
  'Troop Dragon': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon a Troop Dragon',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => named(x, 'Troop Dragon')),
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => named(x, 'Troop Dragon')); if (!cs.length || freeM(g, p) < 0) return; const x = cs[0]; ss(g, p, x, yield* pos2(g, p, x)); shuffleDeck(g, p); } }] },
  // Mandatory: target 1 face-up monster (itself allowed), change it to face-down Defense Position. Spirit: returns to the hand.
  'Tsukuyomi': { effs: [lockInstall,
    { type: 'trig', mand: true, label: 'Turn a monster face-down',
      on: (g, ev, c) => (ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how)) || (ev.type === 'flip' && ev.c === c),
      cond: g => fieldMons(g).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change which face-up monster to face-down Defense Position?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.zone === 'm') setFaceDown(g, t); } },
    spiritReturn] },
  'Twinheaded Beast': { self: { maxAttacks: () => 2 } },
  // A second attack right after its first, if the opponent still controls a monster (no other attack in between).
  // Trap effects that target it are negated and destroyed (PARTIAL: an automatic Spell Speed 3 response, offered as an option).
  // From the GY it can only be Special Summoned while you control a Dragon to Tribute (PARTIAL: the Tribute is a trigger right after).
  'Tyrant Dragon': { cont: { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src && !monsOf(g, a.p).some(x => isMon(x) && race(x) === 'Dragon') },
    self: { maxAttacks: (g, c) => c.attacks >= 1 && g.f28last && g.f28last.u === c.u && g.f28last.turn === g.turnNo && monsOf(g, opp(c.ctrl)).length > 0 ? 2 : 1 },
    effs: [
      { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'attack' && ev.a) g.f28last = { u: ev.a.u, turn: g.turnNo }; if (ev.type === 'move' && ev.c === c && ev.from === 'gy' && ev.to === 'm') c.flags.f28gy = true; return false; } },
      { type: 'quick', speed: 3, ds: true, label: 'Negate the Trap and destroy it',
        cond: (g, c, p, x) => { const T = x.top; return !!T && !T.negated && isTrap(T.c) && T.t.includes(c); },
        target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
        res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated) return; T.negBy = p; negate(g, T, true); } },
      { type: 'trig', mand: true, label: 'Tribute 1 Dragon', on: (g, ev, c) => evSummoned(ev, c) && !!c.flags.f28gy,
        res: function* (g, c, p) { c.flags.f28gy = false; const ds = monsOf(g, p).filter(x => x !== c && race(x) === 'Dragon');
          if (!ds.length) { if (onField(c)) destroy(g, [c], { rule: true }); return; }
          const [x] = yield* pick(g, p, 'Tribute 1 Dragon monster', ds, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } } }] },
  'UFO Turtle': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon a FIRE monster',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && attr(x) === 'FIRE' && baseAtk(x) <= 1500 && canSS(g, p, x)),
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isMon(x) && attr(x) === 'FIRE' && baseAtk(x) <= 1500 && canSS(g, p, x)); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon a FIRE monster with 1500 or less ATK', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  // Takes a face-up Union Monster from the opponent's field and equips it to this card (Main Phase, needs a free S/T zone).
  // PARTIAL: the Union's own effect isn't stopped from unequipping it, and its equip bonuses aren't stripped.
  'Union Rider': { effs: [{ type: 'ign', label: 'Take a Union Monster and equip it',
    cond: (g, c, p) => freeST(g, p) >= 0 && monsOf(g, opp(p)).some(x => faceUp(x) && isUnion(x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take which Union Monster?', monsOf(g, opp(p)).filter(x => faceUp(x) && isUnion(x)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || t.ctrl === p || !onField(c) || !faceUp(c) || freeST(g, p) < 0) return;
      move(g, t, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p }); t.equipTo = c.u; t.flags.f28rider = true; g.seq++; log(g, `${D(t).n} was equipped to Union Rider.`); } }] },
  // ENGINE: Tribute counts are fixed in the engine (same as The Trojan Horse, full-16.js). Closest: Tribute this card alone to
  // Tribute Summon a Level 7 or higher WATER from your hand (your Normal Summon). This summon has no Solemn Judgment window.
  'Unshaven Angler': { effs: [{ type: 'ign', label: 'Tribute as 2: summon a WATER',
    cond: (g, c, p) => g.ns[p] < 1 && !g.noSummon[p] && g.p[p].hand.some(x => attr(x) === 'WATER' && lv(x) >= 7 && canNS(x) && !forbid(g, { type: 'ns', c: x, p })),
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Tribute Summon which WATER monster?', g.p[p].hand.filter(x => attr(x) === 'WATER' && lv(x) >= 7 && canNS(x) && !forbid(g, { type: 'ns', c: x, p })), 1, 1, 'good');
      L2.data.x = x; g.ns[p]++; move(g, c, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Unshaven Angler as 2 Tributes.`); },
    res: function* (g, c, p, L2) { const x = L2.data.x; if (!x || x.zone !== 'hand' || freeM(g, p) < 0) return; const grp = g.group;
      move(g, x, 'm', { ctrl: p, pos: 'atk', reason: 'summon', group: grp }); x.summonType = 'tribute'; x.tributes = [c.u]; x.attacks = 0;
      log(g, `${PN(g, p)} Tribute Summoned ${name(x)}.`);
      const ev = emit(g, { type: 'summon', cs: [x], how: 'tribute', p, tribs: [c] }, grp); g.sw = { cs: [x], p, how: 'tribute', group: ev.group }; } }] },
  'Valkyrion the Magna Warrior': {
    proc: { label: 'Special Summon (Tribute Alpha, Beta and Gamma)',
      cond: (g, c, p) => c.zone === 'hand' && MAGNETS.every(n => [...g.p[p].hand, ...monsOf(g, p)].some(x => named(x, n))),
      cost: function* (g, c, p, grp) {
        const xs = [];
        for (const n of MAGNETS) { const [x] = yield* pick(g, p, `Tribute ${n}`, [...g.p[p].hand, ...monsOf(g, p)].filter(x => named(x, n)), 1, 1, 'cost'); if (x) xs.push(x); }
        for (const x of xs) move(g, x, 'gy', { reason: 'tribute', by: p, group: grp });
        log(g, `${PN(g, p)} Tributed ${xs.map(x => D(x).n).join(', ')}.`); c.nomiOk = true;
      } },
    cont: nomiGY,
    effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Tribute: summon Alpha, Beta and Gamma',
      cond: (g, c, p) => nFreeM(g, p) >= 2 && MAGNETS.every(n => g.p[p].gy.some(x => named(x, n))),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Valkyrion the Magna Warrior.`); },
      target: function* (g, c, p, L2) { const ts = []; for (const n of MAGNETS) { const [x] = yield* pick(g, p, `Target ${n} in your GY`, g.p[p].gy.filter(x => named(x, n)), 1, 1, 'good'); if (x) ts.push(x); } L2.t = ts; },
      res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); if (xs.length > nFreeM(g, p)) return; for (const x of xs) ss(g, p, x, 'atk'); } }] },
  'Vampiric Orchis': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon Des Dendle', on: (g, ev, c) => evSummoned(ev, c, ['normal']),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => named(x, 'Des Dendle') && canSS(g, p, x)),
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => named(x, 'Des Dendle')); if (!cs.length || freeM(g, p) < 0) return; ss(g, p, cs[0], yield* pos2(g, p, cs[0])); } }] },
  // ENGINE: no substitute Fusion Material hook, so it plays as a vanilla monster for now.
  'Versago the Destroyer': { effs: [] },
  // Your opponent can't attack your other Archfiends while it is on the field.
  'Vilepawn Archfiend': { cont: { grant: (g, src, m, flag) => flag === 'noAttackTarget' && m.zone === 'm' && m.ctrl === src.ctrl && m !== src && isArchfiend(m) && !named(m, 'Vilepawn Archfiend') && g.tp !== src.ctrl },
    effs: [archCost(500), archDice([3], 'Roll a die (3 negates)')] },
  // Once per turn in your Main Phase: turn itself face-down, then the face-down Defense monsters in your zones are rearranged.
  'Wandering Mummy': { effs: [{ type: 'ign', opt: true, label: 'Turn face-down and shuffle your Set monsters', cond: (g, c) => faceUp(c),
    res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; setFaceDown(g, c); c.posChanged = true;
      const M = g.p[p].m, zs = M.map((x, i) => x && x.pos === 'set' ? i : -1).filter(i => i >= 0), cs = zs.map(i => M[i]);
      for (let i = cs.length - 1; i > 0; i--) { const j = Math.floor(g.rnd() * (i + 1)); [cs[i], cs[j]] = [cs[j], cs[i]]; }
      zs.forEach((z, i) => { M[z] = cs[i]; }); g.seq++; log(g, `${PN(g, p)} rearranged the face-down monsters.`); } }] },
  'Tribe-Infecting Virus': { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Discard: destroy a Type',
    cond: (g, c, p) => g.p[p].hand.length > 0 && fieldMons(g).some(faceUp),
    cost: function* (g, c, p) { yield* discardPick(g, p, 1, 'Discard 1 card'); },
    // the Type is declared on activation, from the Types face-up on the field (Edison ruling)
    target: function* (g, c, p, L2) { const types = [...new Set(fieldMons(g).filter(faceUp).map(race))]; if (!types.length) return;
      const i = types.length > 1 ? yield* choose(g, p, 'Declare which Type?', types) : 0; L2.data.type = types[i]; log(g, `${PN(g, p)} declared ${types[i]}.`); },
    res: function* (g, c, p, L2) { if (L2.data.type) destroy(g, fieldMons(g).filter(x => faceUp(x) && race(x) === L2.data.type), { by: p }); } }] },
});
})();
