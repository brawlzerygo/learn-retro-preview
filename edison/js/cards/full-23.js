/* Full pool batch 23: Hieracosphinx to Kwagar Hercules (build/batches/full/full-23.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text; cards with a
 Goat-only script elsewhere (Hinotama, Humanoid Worm Drake, Infinite Cards, Injection Fairy Lily, Invigoration, Jam Breeding
 Machine, Jam Defender, Jigen Bakudan, Jirai Gumo, Jowgen the Spiritualist, Just Desserts, Karbonala Warrior, Kazejin, Kelbek,
 Keldo, Kiseitai, Kuriboh) are ported here as the shared version. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, addMod, takeControl, negate, negateAttack, addRule, tokens,
  ritualSummon, canRitual, coin, dice, equippedTo, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk,
  monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp, oppFaceUp,
  stOnField, evSummoned, battleKill, stat, negd, emit, num } = L;

const named = (c, n) => D(c).n === n;
const noop = { type: 'act', res: function* () {} };
const ATK = (g, c) => stat(g, c, 'atk');
// "Cannot be Special Summoned". ENGINE: only enforced from the GY (no generic flag; build/ENGINE_TODO.md).
const noSSFromGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src };
// Spirit return: during the End Phase of the turn it was Normal Summoned or flipped face-up (as full-09.js)
const spiritReturn = { type: 'trig', mand: true, label: 'Return to the hand',
  on: (g, ev, c) => {
    if ((ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how)) || (ev.type === 'flip' && ev.c === c)) c.flags.spirit = g.turnNo;
    return ev.type === 'phase' && ev.ph === 'end' && c.flags.spirit === g.turnNo; },
  res: function* (g, c) { if (onField(c) && faceUp(c)) { move(g, c, 'hand', { reason: 'effect' }); log(g, `${name(c)} returned to the hand.`); } } };
// Flip effect shape (classic-2.js)
const flip = (label, more) => ({ type: 'trig', mand: true, faceDownOk: true, label, on: (g, ev, c) => ev.type === 'flip' && ev.c === c, ...more });
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'atk' }); };
const inBattle = (g, c) => !!(g.battle && (g.battle.a === c || g.battle.t === c));
const discardRandom = (g, p) => { const h = g.p[p].hand; if (!h.length) return null; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)} at random.`); return x; };
const isSpecial = c => D(c).k === 'token' || (c.summonType && !['normal', 'tribute', 'flip', 'gemini'].includes(c.summonType));
// A coin call: the call is a fair guess, right half the time.
const callCoin = (g, p) => { const call = g.rnd() < 0.5; log(g, `${PN(g, p)} called ${call ? 'Heads' : 'Tails'}.`); const right = coin(g, p) === call; log(g, right ? 'The call was right.' : 'The call was wrong.'); return right; };
// Equip Spells (full-08.js)
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) L.equip(g, c, t); } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
// A flag that lasts this turn only (cleared by the watchers of the cards that set it)
const tmpFlag = (g, m, flag) => { m.flags[flag] = g.turnNo; (g.f23tmp || (g.f23tmp = [])).push({ u: m.u, flag, turn: g.turnNo }); };
const tmpClean = g => { if (!g.f23tmp || !g.f23tmp.length) return; g.f23tmp = g.f23tmp.filter(e => { if (e.turn === g.turnNo) return true; const m = fieldMons(g).find(x => x.u === e.u); if (m && m.flags[e.flag] === e.turn) delete m.flags[e.flag]; return false; }); };
const tmpWatch = { type: 'trig', loc: 'any', on: g => { tmpClean(g); return false; }, res: function* () {} };

// A battle worked out inside a card (classic-5.js, for Jam Defender).
// PARTIAL: the original attack is negated and this battle has no Damage Step windows of its own.
function miniBattle(g, a, t) {
  if (!a || !onField(a) || a.zone !== 'm') return;
  if (t && (!onField(t) || t.zone !== 'm')) return;
  const ap = a.ctrl, keep = g.battle; g.battle = { a, t };
  try {
    log(g, `${name(a)} attacks ${t ? (t.pos === 'set' ? 'a face-down monster' : name(t)) : 'directly'}.`);
    let flipped = false;
    if (t && t.pos === 'set') { t.pos = 'def'; g.seq++; flipped = true; log(g, `The face-down monster was ${name(t)}.`); }
    const A = stat(g, a, 'atk'); let killA = false, killT = false, to = null, dmg = 0;
    if (!t) { to = opp(ap); dmg = A; }
    else if (t.pos === 'atk') { const T = stat(g, t, 'atk'); if (A > T) { killT = true; to = t.ctrl; dmg = A - T; } else if (A < T) { killA = true; to = ap; dmg = T - A; } else if (A > 0) { killA = killT = true; } }
    else { const Dv = stat(g, t, 'def'); if (A > Dv) { killT = true; if (has(g, a, 'piercing')) { to = t.ctrl; dmg = A - Dv; } } else if (A < Dv) { to = ap; dmg = Dv - A; } }
    if (to != null && dmg > 0) {
      const noD = g.p[to].noBattleDamage === g.turnNo || [a, t].some(x => x && x.ctrl === to && faceUp(x) && has(g, x, 'noBattleDamage'));
      if (!noD) damage(g, to, dmg, { battle: true, src: t && to === ap ? t : a, srcP: opp(to), direct: !t });
    }
    if (flipped && onField(t)) emit(g, { type: 'flip', c: t, p: t.ctrl, battle: true });
    const vs = []; if (killT) vs.push([t, a]); if (killA) vs.push([a, t]);
    for (const [v, k] of vs) if (onField(v)) destroy(g, [v], { battle: true, killer: k });
  } finally { g.battle = keep; }
}
const stopAttack = g => { negateAttack(g); g.aw = null; };

// Imperial Order and Infernalqueen Archfiend work on chain links as they are built. Both run this scan from every game
// event (a watcher in any zone) and from the response menus (a hidden Spell Speed 3 effect whose cond never offers it).
// ENGINE: no hook when a link is added or resolves; spell links are marked negated while a face-up Imperial Order applies
// (and unmarked if it leaves the field before they resolve).
function chainScan(g) {
  if (!g.chain || !g.chain.length) return;
  const io = stOnField(g).some(x => named(x, 'Imperial Order') && x.zone === 'st' && faceUp(x) && !negd(g, x));
  for (const L2 of g.chain) {
    if (!isSpell(L2.c) || L2.eff.loc === 'gy' || L2.eff.loc === 'hand') continue;
    if (io && !L2.negated) { L2.negated = true; L2.ioNeg = true; log(g, `Imperial Order negates the effect of ${name(L2.c)}.`); }
    else if (!io && L2.ioNeg) { L2.negated = false; L2.ioNeg = false; }
  }
  // PARTIAL: the Archfiend die is rolled when the targeting link is added, not as it resolves.
  for (const L2 of g.chain) {
    if (L2.negated || L2.ifq || !L2.t || !L2.t.length) continue;
    const q = L2.t.find(t => t && onField(t) && t.zone === 'm' && faceUp(t) && named(t, 'Infernalqueen Archfiend') && t.ctrl !== L2.p && !negd(g, t));
    if (!q) continue; L2.ifq = true;
    const n = dice(g, q.ctrl);
    if (n === 2 || n === 5) { L2.negated = true; log(g, `Infernalqueen Archfiend negates ${name(L2.c)}'s effect.`); if (onField(L2.c)) destroy(g, [L2.c], { by: q.ctrl }); }
  }
}
const scanWatch = { type: 'trig', loc: 'any', on: g => { chainScan(g); return false; }, res: function* () {} };
const scanMenu = loc => ({ type: 'quick', loc, anyPlayer: loc !== 'm', speed: 3, ds: true, negSummon: true, label: 'Check the chain',
  cond: g => { chainScan(g); return false; }, res: function* () {} });

// Hino-Kagu-Tsuchi: the hand discard waits for the opponent's next Draw Phase (or their Standby Phase if it is skipped).
// PARTIAL: the discard is a chain link right after the draw (the drawn card is kept out of it).
const hinoDue = (g, c, p) => (g.f23hino || []).find(e => e.src === c.u && e.p === p && g.turnNo > e.turn);
// Kotodama: monsters stamped as they are first seen face-up; the newest of a same-name group are destroyed
const kotoVictims = (g, c) => {
  const up = fieldMons(g).filter(faceUp); let seq = (g.f23koto = (g.f23koto || 0) + 1);
  const fresh = !c.flags.kotoMe; c.flags.kotoMe = true;
  for (const x of up) if (!x.flags.kotoStamp) x.flags.kotoStamp = seq;
  const groups = new Map(); for (const x of up) { const n = name(x); if (!groups.has(n)) groups.set(n, []); groups.get(n).push(x); }
  const out = [];
  for (const gr of groups.values()) { if (gr.length < 2) continue; if (fresh) { out.push(...gr); continue; }
    const hi = Math.max(...gr.map(x => x.flags.kotoStamp)); const nw = gr.filter(x => x.flags.kotoStamp === hi); out.push(...(nw.length === gr.length ? gr : nw)); }
  return out;
};

// Union monsters (full-03.js Burning Beast): once per turn equip to the host or unequip and Special Summon in Attack Position.
const unionOn = (g, m) => allField(g).some(x => x.equipTo === m.u && isMon(x));
const unionEq = (src, m) => src.zone === 'st' && !!src.flags.union && src.equipTo === m.u;
const union = (me, host, o = {}) => ({
  cont: { ...(o.cont || {}),
    replaceDestroy: (g, src, c, x) => { if (!x.battle || !src.flags.union || src.equipTo !== c.u || src.zone !== 'st') return false; log(g, `${me} was destroyed instead of ${name(c)}.`); destroy(g, [src], { quietLog: true }); return true; } },
  effs: [
    { type: 'ign', label: `Equip to ${host}`,
      cond: (g, c, p) => c.used.union !== g.turnNo && freeST(g, p) >= 0 && monsOf(g, p).some(x => x !== c && faceUp(x) && named(x, host) && !unionOn(g, x)),
      after: (g, c) => { c.used.union = g.turnNo; },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, `Equip ${me} to which ${host}?`, monsOf(g, p).filter(x => x !== c && faceUp(x) && named(x, host) && !unionOn(g, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || c.zone !== 'm' || !faceUp(c) || freeST(g, p) < 0 || unionOn(g, t)) return; move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); c.equipTo = t.u; c.flags.union = true; g.seq++; log(g, `${me} was equipped to ${name(t)}.`); } },
    { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Unequip and Special Summon',
      cond: (g, c, p) => c.used.union !== g.turnNo && !!c.flags.union && !!c.equipTo && freeM(g, p) >= 0,
      after: (g, c) => { c.used.union = g.turnNo; },
      res: function* (g, c, p) { if (c.zone !== 'st' || !c.equipTo) return; c.equipTo = null; c.flags.union = false; ss(g, p, c, 'atk'); } },
    ...(o.effs || [])] });

E.addScripts({
  // Attacks on its controller's face-down Defense monsters are stopped as they are declared.
  // ENGINE: attack targets can't be filtered by the defender's cards (noAttackTarget only covers face-up monsters).
  // PARTIAL: the attack is negated; the first one each turn gives the attacker its attack back to choose again.
  'Hieracosphinx': { effs: [{ type: 'trig', on: (g, ev, c) => {
    if (ev.type === 'attack' && ev.t && ev.t.pos === 'set' && ev.t.ctrl === c.ctrl && ev.a && ev.a.ctrl !== c.ctrl && onField(c) && faceUp(c)) {
      negateAttack(g); log(g, 'Hieracosphinx: face-down Defense Position monsters can’t be attacked.');
      if (ev.a.flags.f23hiera !== g.turnNo) { ev.a.flags.f23hiera = g.turnNo; ev.a.attacks = Math.max(0, ev.a.attacks - 1); } }
    return false; }, res: function* () {} }] },
  // ENGINE: the hand size limit is fixed at 6.
  'Hieroglyph Lithograph': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp > 1000,
    cost: function* (g, c, p) { pay(g, p, 1000); },
    res: function* (g, c, p) { g.p[p].handLimit = 7; log(g, `${PN(g, p)}'s hand size limit is now 7.`); } }] },
  // Control lasts while Hiita is face-up on the field and the monster is still FIRE (a watcher gives it back).
  'Hiita the Fire Charmer': { effs: [
    flip('Take control of a FIRE monster', {
      target: function* (g, c, p, L2) { const cs = oppFaceUp(g, p).filter(x => attr(x) === 'FIRE'); if (cs.length) yield* tgt(g, p, L2, 'Take control of which face-up FIRE monster?', cs, 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || attr(t) !== 'FIRE' || t.ctrl === p || !onField(c) || !faceUp(c) || c.ctrl !== p) return;
        const from = t.ctrl; if (takeControl(g, p, t, false)) (g.f23charm || (g.f23charm = [])).push({ c: c.u, t: t.u, from }); } }),
    { type: 'trig', loc: 'any', on: (g, ev, c) => {
      if (!g.f23charm || !g.f23charm.some(e => e.c === c.u)) return false;
      g.f23charm = g.f23charm.filter(e => { if (e.c !== c.u) return true; const t = fieldMons(g).find(x => x.u === e.t); if (!t) return false;
        if (onField(c) && faceUp(c) && attr(t) === 'FIRE') return true;
        if (t.ctrl !== e.from && t.flags.ctrlUntil == null) { if (freeM(g, e.from) >= 0) { takeControl(g, e.from, t, false); g.seq++; } else { move(g, t, 'gy', { reason: 'rule' }); log(g, `${D(t).n} was sent to the GY.`); } }
        return false; });
      return false; }, res: function* () {} }] },
  'Hino-Kagu-Tsuchi': { cont: noSSFromGY, effs: [spiritReturn,
    { type: 'trig', on: (g, ev, c) => { if (ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl && onField(c)) { (g.f23hino || (g.f23hino = [])).push({ src: c.u, p: ev.p, turn: g.turnNo }); log(g, `${PN(g, ev.p)} will discard their hand in their next Draw Phase.`); } return false; }, res: function* () {} },
    { type: 'trig', loc: 'any', mand: true, label: 'The opponent discards their hand',
      on: (g, ev, c) => { if (!g.f23hino) return false;
        const due = (ev.type === 'move' && ev.reason === 'draw' && g.phase === 'draw' && ev.c.owner === g.tp && hinoDue(g, c, g.tp)) || (ev.type === 'phase' && ev.ph === 'standby' && hinoDue(g, c, ev.tp));
        if (!due) return false; g.f23hino = g.f23hino.filter(e => e !== due); return true; },
      res: function* (g, c, p, L2) { const q = L2.ev.type === 'move' ? L2.ev.c.owner : L2.ev.tp; const keep = L2.ev.type === 'move' ? L2.ev.c : null;
        const xs = g.p[q].hand.filter(x => x !== keep); for (const x of xs) move(g, x, 'gy', { reason: 'discard', by: p }); if (xs.length) log(g, `${PN(g, q)} discarded ${xs.map(name).join(', ')}.`); } }] },
  'Hinotama': { effs: [{ type: 'act', res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  "Hiro's Shadow Scout": { effs: [flip('Your opponent draws 3 cards', {
    res: function* (g, c, p) { const o = opp(p), before = g.p[o].hand.slice(); draw(g, o, 3); const got = g.p[o].hand.filter(x => !before.includes(x));
      if (!got.length) return; log(g, `${PN(g, o)} drew ${got.map(name).join(', ')}.`);
      const sp = got.filter(isSpell); for (const x of sp) move(g, x, 'gy', { reason: 'discard', by: p }); if (sp.length) log(g, `${PN(g, o)} discarded ${sp.map(name).join(', ')}.`); } })] },
  // ENGINE: no Attribute override; the chosen Attribute is only logged.
  'Homunculus the Alchemic Being': { effs: [{ type: 'ign', opt: true, label: 'Change its Attribute',
    res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; const as = ['LIGHT', 'DARK', 'EARTH', 'WATER', 'FIRE', 'WIND'].filter(a => a !== (c.flags.f23attr || attr(c)));
      const i = yield* choose(g, p, 'Change its Attribute to', as); c.flags.f23attr = as[i]; log(g, `${name(c)}'s Attribute became ${as[i]}.`); } }] },
  // PARTIAL: neither player can target them (cantBeTargeted can't tell who is targeting; goat-5.js King Dragun has the same gap).
  "Horus' Servant": { cont: { grant: (g, src, c, flag) => flag === 'cantBeTargeted' && c.zone === 'm' && faceUp(c) && /^Horus the Black Flame Dragon/.test(D(c).n) } },
  'Hoshiningen': { cont: { atk: (g, src, c) => !faceUp(c) ? 0 : attr(c) === 'LIGHT' ? 500 : attr(c) === 'DARK' ? -400 : 0 } },
  'House of Adhesive Tape': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.sw && g.sw.p !== p && ['normal', 'tribute', 'flip'].includes(g.sw.how) && g.sw.cs.some(x => onField(x) && faceUp(x) && stat(g, x, 'def') <= 500),
    target: function* (g, c, p, L2) { L2.data.cs = g.sw.cs.slice(); },
    res: function* (g, c, p, L2) { destroy(g, L2.data.cs.filter(x => onField(x) && faceUp(x) && stat(g, x, 'def') <= 500), { by: p, src: c }); } }] },
  'Huge Revolution': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.tp === p && ['main1', 'main2'].includes(g.phase) && ['People Running About', 'Oppressed People', 'United Resistance'].every(n => monsOf(g, p).some(x => faceUp(x) && named(x, n))),
    res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand.slice(); for (const x of h) move(g, x, 'gy', { reason: 'effect', by: p }); if (h.length) log(g, `${PN(g, o)} sent ${h.length} card${h.length > 1 ? 's' : ''} from the hand to the GY.`);
      destroy(g, fieldOf(g, o), { by: p, src: c }); } }] },
  // Level 2 or lower Normal Monsters (and Tokens) destroyed by battle on its controller's side are counted as it happens.
  'Human-Wave Tactics': { effs: [noop,
    { type: 'trig', loc: 'st', on: (g, ev, c) => {
      if (ev.type === 'move' && ev.wasField && ev.battle && ev.destroyed && ev.prevCtrl === c.ctrl && ev.snap && ev.snap.mon && ev.snap.lv <= 2 && ['normal', 'token'].includes(D(ev.c).k)) {
        if (!c.flags.hwt || c.flags.hwt.turn !== g.turnNo) c.flags.hwt = { turn: g.turnNo, n: 0 }; c.flags.hwt.n++; }
      return false; }, res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, tags: { ss: 1 }, label: 'Special Summon Normal Monsters from your Deck',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!c.flags.hwt && c.flags.hwt.turn === g.turnNo && c.flags.hwt.n > 0,
      res: function* (g, c, p) { const n = c.flags.hwt ? c.flags.hwt.n : 0; if (c.flags.hwt) c.flags.hwt.n = 0;
        const cs = g.p[p].deck.filter(x => D(x).k === 'normal' && lv(x) <= 2); const k = Math.min(n, cs.length, nFreeM(g, p)); if (!k) { shuffleDeck(g, p); return; }
        const xs = yield* pick(g, p, `Special Summon ${k} Level 2 or lower Normal Monster${k > 1 ? 's' : ''} from your Deck`, cs, k, k, 'good');
        for (const x of xs) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  'Humanoid Worm Drake': { effs: [] },
  'Hungry Burger': { effs: [] },
  'Hyena': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon Hyenas from your Deck',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => named(x, 'Hyena')),
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => named(x, 'Hyena')); const n = Math.min(cs.length, nFreeM(g, p)); if (!n) return;
      const xs = yield* pick(g, p, 'Special Summon any number of Hyena from your Deck', cs, 1, n, 'good'); for (const x of xs) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  'Hysteric Fairy': { effs: [{ type: 'ign', label: 'Tribute 2 monsters: gain 1000 LP', cond: (g, c, p) => monsOf(g, p).length >= 2,
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Tribute 2 monsters', monsOf(g, p), 2, 2, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${xs.map(x => D(x).n).join(' and ')}.`); },
    res: function* (g, c, p) { gain(g, p, 1000); } }] },
  'Impenetrable Formation': {
    cont: { def: (g, src, m) => m.u === src.flags.f23sel && m.ctrl === src.ctrl && monsOf(g, src.ctrl).length >= 2 && monsOf(g, src.ctrl).every(x => x.pos !== 'atk') ? 700 : 0 },
    effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which of your monsters?', monsOf(g, p), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!onField(c)) return; if (!t || t.ctrl !== p) { move(g, c, 'gy', { reason: 'rule' }); return; } c.flags.f23sel = t.u; g.seq++; log(g, `Impenetrable Formation selected ${name(t)}.`); } },
      { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy Impenetrable Formation',
        on: (g, ev, c) => ev.type === 'move' && ev.wasField && !!c.flags.f23sel && ev.c.u === c.flags.f23sel && ev.to !== 'm',
        res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  // ENGINE: a face-up Spell's continuous effects (cont) still apply; Spell activations and Spell effect links are negated.
  'Imperial Order': {
    cont: { negates: (g, src, c) => isSpell(c) && onField(c) },
    effs: [noop, scanMenu('st'), scanWatch,
      { type: 'trig', loc: 'st', mand: true, label: 'Pay 700 LP or destroy this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby',
        res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 700) pay(g, p, 700); else destroy(g, [c], { by: p }); } }] },
  'Inaba White Rabbit': { cont: noSSFromGY, self: { directAttack: true, attackOk: () => false }, effs: [spiritReturn] },
  'Incandescent Ordeal': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && canRitual(g, p, { monster: x => named(x, 'Legendary Flame Lord') }),
    res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, 'Legendary Flame Lord') }); } }] },
  // PARTIAL: the Standby Phase cost is a chain link; the die roll is done by chainScan (above).
  'Infernalqueen Archfiend': { effs: [scanMenu('m'), scanWatch,
    { type: 'trig', mand: true, label: 'Pay 500 LP', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 500) pay(g, p, 500); else destroy(g, [c], { by: p }); } },
    { type: 'trig', mand: true, label: 'An Archfiend gains 1000 ATK', on: (g, ev) => ev.type === 'phase' && ev.ph === 'standby',
      cond: g => fieldMons(g).some(x => faceUp(x) && /Archfiend/.test(D(x).n)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Archfiend monster gains 1000 ATK?', fieldMons(g).filter(x => faceUp(x) && /Archfiend/.test(D(x).n)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: 1000, end: true }); log(g, `${name(t)} gained 1000 ATK.`); } } }] },
  // ENGINE: the hand size limit is fixed at 6.
  'Infinite Cards': { effs: [noop] },
  'Infinite Dismissal': { effs: [noop,
    { type: 'trig', loc: 'any', on: (g, ev) => { if (ev.type === 'summon' && ['normal', 'tribute', 'flip'].includes(ev.how)) for (const x of ev.cs) if (onField(x)) x.flags.f23ns = g.turnNo; return false; }, res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy Level 3 or lower monsters',
      on: (g, ev) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(x => faceUp(x) && x.flags.f23ns === g.turnNo && lv(x) <= 3),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => faceUp(x) && x.flags.f23ns === g.turnNo && lv(x) <= 3), { by: p, src: c }); } }] },
  // PARTIAL (as goat-3.js): no window during damage calculation, so it is used in the Damage Step windows.
  'Injection Fairy Lily': {
    self: { atk: (g, c) => g.battle && c.flags.lilyB === g.battle ? 3000 : 0 },
    effs: [{ type: 'quick', ds: true, label: 'Pay 2000: +3000 ATK',
      cond: (g, c, p) => g.inDS && inBattle(g, c) && c.flags.lilyB !== g.battle && c.flags.lilyPaid !== g.battle && g.p[p].lp > 2000,
      cost: function* (g, c, p) { c.flags.lilyPaid = g.battle; pay(g, p, 2000); },
      res: function* (g, c) { if (onField(c) && faceUp(c) && g.battle && inBattle(g, c)) { c.flags.lilyB = g.battle; log(g, `${name(c)} gained 3000 ATK for this battle.`); } } }] },
  // PARTIAL: used once per opponent's Standby Phase (no Standby Phase window to repeat it).
  'Inspection': { effs: [noop,
    { type: 'trig', loc: 'st', label: 'Pay 500 LP: look at a random card in their hand',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl,
      cond: (g, c, p) => g.p[p].lp > 500 && g.p[opp(p)].hand.length > 0,
      cost: function* (g, c, p) { pay(g, p, 500); },
      res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; log(g, `${PN(g, p)} looked at ${name(x)} in ${PN(g, opp(p))}'s hand.`); } }] },
  // PARTIAL: the return in the End Phase is a chain link. The monster comes back to its owner's field in the same position.
  'Interdimensional Matter Transporter': { effs: [
    { type: 'act', cond: (g, c, p) => monsOf(g, p).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which of your face-up monsters until the End Phase?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || t.ctrl !== p) return; const pos = t.pos, u = t.u;
        move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished until the End Phase.`);
        if (t.zone === 'ban') (g.f23imt || (g.f23imt = [])).push({ src: c.u, u, pos }); } },
    { type: 'trig', loc: 'any', mand: true, label: 'The banished monster returns',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!g.f23imt && g.f23imt.some(e => e.src === c.u),
      res: function* (g, c) { const es = g.f23imt.filter(e => e.src === c.u); g.f23imt = g.f23imt.filter(e => e.src !== c.u);
        for (const e of es) { const x = allCards(g, 'ban').find(y => y.u === e.u); if (!x) continue;
          if (freeM(g, x.owner) >= 0) { move(g, x, 'm', { ctrl: x.owner, pos: e.pos, reason: 'effect' }); log(g, `${D(x).n} returned to the field.`); }
          else { move(g, x, 'gy', { reason: 'rule' }); log(g, `${D(x).n} was sent to the GY.`); } } } }] },
  'Invader of Darkness': { cont: { forbid: (g, src, a) => a.type === 'activate' && a.c && a.p !== src.ctrl && isSpell(a.c) && D(a.c).sub === 'Quick-Play' && a.eff && a.eff.type === 'act' } },
  'Invader of the Throne': { effs: [flip('Switch control with an opponent’s monster', {
    cond: g => g.phase !== 'battle',
    target: function* (g, c, p, L2) { if (monsOf(g, opp(p)).length) yield* tgt(g, p, L2, 'Switch control with which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0], o = opp(p); if (!t || t.ctrl !== o || !onField(c) || c.ctrl !== p) return;
      const ia = g.p[p].m.indexOf(c), ib = g.p[o].m.indexOf(t); g.p[p].m[ia] = t; g.p[o].m[ib] = c; c.ctrl = o; t.ctrl = p;
      for (const x of [c, t]) { x.flags.ctrlUntil = null; x.flags.ctrlFrom = null; } g.seq++;
      log(g, `${name(c)} and ${t.pos === 'set' ? 'a face-down monster' : name(t)} switched control.`); } })] },
  'Invasion of Flames': { cont: { forbid: (g, src, a) => a.type === 'activate' && a.c && isTrap(a.c) && a.eff && a.eff.type === 'act' && !!g.sw && g.sw.cs.includes(src) && ['normal', 'tribute'].includes(g.sw.how) } },
  'Invigoration': { cont: eqBonus(400, -200), effs: [equipAct(m => attr(m) === 'EARTH', 'Equip to which face-up EARTH monster?')] },
  'Invitation to a Dark Sleep': {
    cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && !!src.flags.f23sleep && a.c.u === src.flags.f23sleep },
    effs: [{ type: 'trig', mand: true, label: 'Select a monster that can’t attack', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute', 'flip']),
      cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster can’t attack?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && onField(c) && faceUp(c)) { c.flags.f23sleep = t.u; g.seq++; log(g, `${t.pos === 'set' ? 'The face-down monster' : name(t)} can’t attack.`); } } }] },
  'Jade Insect Whistle': { effs: [{ type: 'act',
    res: function* (g, c, p) { const o = opp(p), d = g.p[o].deck, cs = d.filter(x => isMon(x) && race(x) === 'Insect');
      if (!cs.length) { log(g, `${PN(g, o)} has no Insect monster in the Deck.`); return; }
      const [x] = yield* pick(g, o, 'Put which Insect monster on top of your Deck?', cs, 1, 1, 'cost'); if (!x) return;
      d.splice(d.indexOf(x), 1); shuffleDeck(g, o); d.push(x); log(g, `${PN(g, o)} shuffled the Deck and put ${name(x)} on top.`); } }] },
  // PARTIAL (as classic-4.js): Flip Summons aren't stopped (forbid has no Flip Summon action).
  'Jam Breeding Machine': { cont: { forbid: (g, src, a) => (a.type === 'ns' || a.type === 'ss') && a.p === src.ctrl && a.c && D(a.c) && D(a.c).n !== 'Slime Token' },
    effs: [noop, { type: 'trig', loc: 'st', mand: true, tags: { ss: 1 }, label: 'Summon a Slime Token', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { if (freeM(g, p) >= 0) tokens(g, p, { n: 'Slime Token', a: 'WATER', r: 'Aqua', lv: 1, atk: 500, def: 500 }, 1, 'atk'); } }] },
  // PARTIAL (as classic-5.js): the switched attack is worked out by the card (miniBattle).
  'Jam Defender': { effs: [noop,
    { type: 'quick', loc: 'st', label: 'Switch the attack to Revival Jam',
      cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p && g.aw.t && g.aw.t.ctrl === p && monsOf(g, p).some(m => faceUp(m) && named(m, 'Revival Jam') && m !== g.aw.t)),
      target: function* (g, c, p, L2) { L2.data.a = g.aw.a; yield* tgt(g, p, L2, 'Switch the attack to which Revival Jam?', monsOf(g, p).filter(m => faceUp(m) && named(m, 'Revival Jam') && m !== g.aw.t), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const j = live(L2)[0], a = L2.data.a; if (!j || !onField(a)) return; if (g.aw && g.aw.a === a) stopAttack(g); log(g, `The attack was switched to ${name(j)}.`); miniBattle(g, a, j); } }] },
  'Jar Robber': { effs: [{ type: 'act', cond: (g, c, p, x) => !!x.top && x.top.cardAct && named(x.top.c, 'Pot of Greed') && !x.top.negated,
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; T.negBy = p; negate(g, T, false); draw(g, p, 1); } }] },
  'Jigen Bakudan': { effs: [flip('Arm the bomb', { res: function* (g, c) { if (onField(c) && faceUp(c)) { c.flags.jigen = true; log(g, 'Jigen Bakudan is armed.'); } } }),
    { type: 'trig', tags: { destroy: 1 }, label: 'Tribute it: destroy your monsters, burn', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.flags.jigen,
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Jigen Bakudan.`); },
      res: function* (g, c, p) { const ms = monsOf(g, p); const at = new Map(ms.map(m => [m, faceUp(m) ? ATK(g, m) : 0]));
        const gone = destroy(g, ms, { by: p }); const n = Math.floor(gone.reduce((s, m) => s + (at.get(m) || 0), 0) / 2); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  'Jirai Gumo': { effs: [{ type: 'trig', mand: true, label: 'Toss a coin', on: (g, ev, c) => ev.type === 'attack' && ev.a === c,
    res: function* (g, c, p) { if (callCoin(g, p)) return; const n = Math.floor(g.p[p].lp / 2); g.p[p].lp -= n; log(g, `${PN(g, p)} lost ${n} LP.`); } }] },
  'Jowgen the Spiritualist': { cont: { forbid: (g, src, a) => a.type === 'ss' },
    effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Random discard: destroy Special Summoned monsters',
      cond: (g, c, p) => g.p[p].hand.length > 0 && fieldMons(g).some(isSpecial),
      cost: function* (g, c, p) { discardRandom(g, p); },
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(isSpecial), { by: p }); } }] },
  'Jowls of Dark Demise': { effs: [tmpWatch, flip('Take control of a monster this turn', {
    target: function* (g, c, p, L2) { if (monsOf(g, opp(p)).length && freeM(g, p) >= 0) yield* tgt(g, p, L2, 'Take control of which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.ctrl === p) return; if (takeControl(g, p, t, true)) tmpFlag(g, t, 'directAttack'); } })] },
  'Just Desserts': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { const n = monsOf(g, opp(p)).length; if (n) damage(g, opp(p), 500 * n, { src: c, srcP: p }); } }] },
  'KA-2 Des Scissors': { effs: [{ type: 'trig', mand: true, label: 'Damage equal to its Level x 500', on: (g, ev, c) => battleKill(ev, c),
    res: function* (g, c, p, L2) { const n = 500 * num(D(L2.ev.c).lv || 0); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  'Kaibaman': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Tribute: Special Summon Blue-Eyes White Dragon',
    cond: (g, c, p) => g.p[p].hand.some(x => named(x, 'Blue-Eyes White Dragon')),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Kaibaman.`); },
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => named(x, 'Blue-Eyes White Dragon')); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which Blue-Eyes White Dragon?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  'Kaminari Attack': { effs: [] },
  // PARTIAL: the destruction at the end of each Damage Step is a chain link (the ruling says it isn't).
  'Kaminote Blow': (() => { const FIGHTERS = ['Chu-Ske the Mouse Fighter', 'Monk Fighter', 'Master Monk'];
    const isF = (g, x, p) => x && onField(x) && faceUp(x) && x.ctrl === p && FIGHTERS.some(n => named(x, n));
    const foe = (g, ev, c) => { const e = (g.f23kami || []).find(e => e.src === c.u && e.turn === g.turnNo); if (!e) return null;
      for (const [k, o] of [[ev.a, ev.t], [ev.t, ev.a]]) if (isF(g, k, e.p) && o && onField(o) && o.ctrl !== e.p) return o; return null; };
    return { effs: [
      { type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && FIGHTERS.some(n => named(x, n))),
        res: function* (g, c, p) { (g.f23kami || (g.f23kami = [])).push({ src: c.u, p, turn: g.turnNo }); log(g, 'Monsters that battle your fighters this turn are destroyed at the end of the Damage Step.'); } },
      { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the monster it battled',
        on: (g, ev, c) => ev.type === 'dsEnd' && !!foe(g, ev, c),
        res: function* (g, c, p, L2) { const o = foe(g, L2.ev, c) || [L2.ev.a, L2.ev.t].find(x => x && onField(x) && x.ctrl !== p); if (o && onField(o)) destroy(g, [o], { by: p, src: c }); } }] }; })(),
  'Kangaroo Champ': { effs: [{ type: 'trig', mand: true, label: 'Change the other monster to Defense Position',
    on: (g, ev, c) => ev.type === 'afterCalc' && (ev.a === c || ev.t === c) && !!(ev.a === c ? ev.t : ev.a),
    res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; if (o && onField(o) && !o.flags.battleDoomed) toDef(g, o); } }] },
  'Karate Man': { effs: [
    { type: 'ign', opt: true, label: 'Double its original ATK', cond: (g, c) => !c.flags.karate,
      res: function* (g, c) { if (!onField(c) || !faceUp(c)) return; c.flags.baseAtk = 2 * num(D(c).atk); c.flags.karate = g.turnNo; g.seq++; log(g, `${name(c)}'s original ATK became ${c.flags.baseAtk}.`); } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy Karate Man', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.karate === g.turnNo,
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  'Karbonala Warrior': { effs: [] },
  // PARTIAL (as classic-2.js): no window during damage calculation, so it is used in the Damage Step windows; the 0 lasts
  // until damage calculation is done.
  'Kazejin': { effs: [
    { type: 'quick', ds: true, label: 'Make the attacker’s ATK 0',
      cond: (g, c, p) => g.inDS && g.battle && g.battle.t === c && g.tp !== c.ctrl && !c.flags.guardUsed && g.battle.a && onField(g.battle.a) && !g.battle.a.mods.some(m => m.guardZero),
      target: function* (g, c, p, L2) { L2.t = [g.battle.a]; },
      after: (g, c) => { c.flags.guardUsed = true; },
      res: function* (g, c, p, L2) { const a = live(L2)[0]; if (!a || a.zone !== 'm' || !g.battle) return; addMod(g, a, { set: 0, which: 'atk', end: true, guardZero: true }); g.seq++; log(g, `${name(a)}'s ATK became 0 for damage calculation.`); } },
    { type: 'trig', on: (g, ev) => { if ((ev.type === 'afterCalc' || ev.type === 'dsEnd') && ev.a && ev.a.mods.some(m => m.guardZero)) { ev.a.mods = ev.a.mods.filter(m => !m.guardZero); g.seq++; } return false; }, res: function* () {} }] },
  'Kelbek': { effs: [{ type: 'trig', loc: 'any', mand: true, label: 'Return the attacker to the hand',
    on: (g, ev, c) => ev.type === 'dsEnd' && ev.t === c && ev.a && ev.a.ctrl !== (onField(c) ? c.ctrl : c.owner),
    res: function* (g, c, p, L2) { const a = L2.ev.a; if (a && onField(a) && a.zone === 'm') { const n = name(a); move(g, a, 'hand', { reason: 'effect', by: p }); log(g, `${n} returned to the hand.`); } } }] },
  'Keldo': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Shuffle 2 cards into their Deck',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => g.p[opp(p)].gy.length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Shuffle which 2 cards from their GY into their Deck?', g.p[opp(p)].gy, 2, 2, 'bad'); },
    res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'deck', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.map(name).join(', ')} went back into ${PN(g, opp(p))}'s Deck.`); } }] },
  'Kiryu': union('Kiryu', 'Dark Blade', {
    cont: { atk: (g, src, m) => unionEq(src, m) ? 900 : 0, def: (g, src, m) => unionEq(src, m) ? 900 : 0 },
    effs: [tmpWatch, { type: 'ign', loc: 'st', label: 'Tribute Kiryu: direct attack',
      cond: (g, c) => c.zone === 'st' && !!c.flags.union && !!equippedTo(g, c),
      cost: function* (g, c, p, L2) { L2.data.m = equippedTo(g, c); move(g, c, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Kiryu.`); },
      res: function* (g, c, p, L2) { const m = L2.data.m; if (m && onField(m)) { tmpFlag(g, m, 'directAttack'); log(g, `${name(m)} can attack directly this turn.`); } } }] }),
  'Kiseitai': { effs: [
    { type: 'trig', mand: true, faceDownOk: true, label: 'Become an Equip Card',
      on: (g, ev, c) => ev.type === 'attack' && ev.t === c && c.pos === 'set' && ev.a.ctrl !== c.ctrl,
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (c.zone !== 'm' || c.pos !== 'set' || !onField(a) || freeST(g, p) < 0) return;
        move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p }); c.equipTo = a.u; // not flags.negated: that would stop its Standby LP gain
        log(g, `Kiseitai became an Equip Card equipped to ${name(a)}.`); negateAttack(g); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Gain half its ATK',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl && !!c.equipTo && fieldMons(g).some(x => x.u === c.equipTo),
      res: function* (g, c, p) { const m = fieldMons(g).find(x => x.u === c.equipTo); if (m) gain(g, p, Math.floor(ATK(g, m) / 2)); } }] },
  'Kishido Spirit': { effs: [noop], cont: { grant: (g, src, c, flag) => {
    if (flag !== 'noBattleDestroy' || c.ctrl !== src.ctrl || !g.battle || !inBattle(g, c)) return false;
    const o = g.battle.a === c ? g.battle.t : g.battle.a; return !!o && onField(o) && ATK(g, o) === ATK(g, c); } } },
  "Knight's Title": { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && named(x, 'Dark Magician')) && [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].some(x => named(x, 'Dark Magician Knight')),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 face-up Dark Magician', monsOf(g, p).filter(x => faceUp(x) && named(x, 'Dark Magician')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Dark Magician.`); } },
    res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].filter(x => named(x, 'Dark Magician Knight')); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which Dark Magician Knight?', cs, 1, 1, 'good'); if (!x) return; const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } }] },
  'Koitsu': union('Koitsu', 'Aitsu', {
    cont: { atk: (g, src, m) => unionEq(src, m) ? 3000 : 0, grant: (g, src, m, flag) => flag === 'piercing' && unionEq(src, m) } }),
  // PARTIAL: the destruction is a chain link (a Continuous Effect, no chain, in the rulings).
  'Kotodama': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy monsters with the same name',
    on: (g, ev, c) => { if (!onField(c) || !faceUp(c)) return false; const vs = kotoVictims(g, c); if (!vs.length) return false;
      return !g.pend.some(t => t.c === c) && !g.chain.some(L2 => L2.c === c); },
    res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; const vs = kotoVictims(g, c); if (vs.length) destroy(g, vs, { by: p }); } }] },
  // Can't be activated; when it is destroyed while Set, the player who destroyed it takes 1000.
  "Kozaky's Self-Destruct Button": { effs: [{ type: 'trig', loc: 'gy', mand: true, label: '1000 damage to the player who destroyed it',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.snap && ev.snap.pos === 'set' && ev.by != null,
    res: function* (g, c, p, L2) { damage(g, L2.ev.by, 1000, { src: c, srcP: p }); } }] },
  'Kryuel': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Toss a coin: destroy a monster',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.battle && ev.to === 'gy',
    cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { if (!callCoin(g, p)) return; const ms = monsOf(g, opp(p)); if (!ms.length) return;
      const [x] = yield* pick(g, p, 'Destroy which monster?', ms, 1, 1, 'bad'); if (x) destroy(g, [x], { by: p, src: c }); } }] },
  'Kuriboh': { cont: { loc: 'gy', dmg: (g, src, p, n, o) => o.battle && p === src.owner && g.battle && g.battle.kuriboh && g.battle.kuriboh.includes(p) ? 0 : n },
    effs: [{ type: 'quick', loc: 'hand', ds: true, label: 'Discard: no battle damage',
      cond: (g, c, p) => g.inDS && !!g.battle && g.battle.a.ctrl !== p && !(g.battle.kuriboh && g.battle.kuriboh.includes(p)),
      cost: function* (g, c, p, L2) { L2.data.b = g.battle; move(g, c, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded Kuriboh.`); },
      res: function* (g, c, p, L2) { const b = L2.data.b; if (b && g.battle === b) { (b.kuriboh || (b.kuriboh = [])).push(p); log(g, `${PN(g, p)} will take no battle damage from this battle.`); } } }] },
  'Kwagar Hercules': { effs: [] },
});
})();
