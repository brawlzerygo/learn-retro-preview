/* Full pool batch 31: D.D.M. - Different Dimension Master to Gadget Hauler (build/batches/full/full-31.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings.
 Relatives kept consistent with: Earthbound Immortals (batch-6.js), Djinn Releaser (batch-7.js), Morphtronics (batch-7.js),
 Clock Tower Prison (full-36.js), Ritual of Grace (full-13.js), Dark Fusion (full-05.js), Dark Calling (batch-6.js). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, takeControl, negate, addMod,
  equip, link, addCtr, addRule, tokens, ritualSummon, canRitual, search, name, D, isMon, isST, isSpell, isTrap, isExtraD,
  onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, allField, fieldMons, freeM, freeST, nFreeM, shuffleDeck,
  log, PN, has, live, opp, oppFaceUp, spellTrapAct, evSummoned, emit, forbid, stat, negd, num } = L;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const isOver = e => e && e.over;
const isDH = c => /^Destiny HERO/.test(name(c));          // as seen (face-up name)
const isDHd = c => /^Destiny HERO/.test(D(c).n);          // by its card data (hand, GY, face-down Tributes)
const dhMon = c => isMon(c) && isDHd(c);
const isEI = x => isMon(x) && /^Earthbound Immortal/.test(D(x).n);
const isBW = c => /^Blackwing/.test(name(c));
const morphMon = c => isMon(c) && /Morphtronic/.test(D(c).n);
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
const numAtk = x => D(x).atk === '?' ? null : baseAtk(x);
function toBottom(g, x) { move(g, x, 'deckTop', { reason: 'effect' }); const d = g.p[x.owner].deck; const i = d.indexOf(x); if (i >= 0) { d.splice(i, 1); d.unshift(x); } }
const flip = (label, more) => ({ type: 'trig', mand: true, faceDownOk: true, label, on: (g, ev, c) => ev.type === 'flip' && ev.c === c, ...more });
const discard1 = function* (g, p, text, not) { const h = g.p[p].hand.filter(x => x !== not); if (!h.length) return null; const [x] = yield* pick(g, p, text, h, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${D(x).n}.`); } return x; };
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) equip(g, c, t); } });
// "since your last Standby Phase": a mark made on turn r still counts in your Standby Phase of turn r+1 or r+2
const sinceLastStandby = (g, r) => r != null && r >= g.turnNo - 2 && r <= g.turnNo;
const toPos = (g, m, pos) => { const from = m.pos; m.pos = pos; g.seq++; log(g, `${name(m)} was changed to ${pos === 'atk' ? 'Attack' : 'Defense'} Position.`); emit(g, { type: 'pos', c: m, p: m.ctrl, from }); };
// A Trap that answers a moment with no response window in the engine (same as full-26.js): an optional trigger that only fires
// while the card is Set (and wasn't Set this turn); it flips face-up, counts as a Trap activation, and goes to the GY after.
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });

/* Summon locks (same idea as full-13.js): one game rule, added at the first game event, checks every Special Summon.
 ENGINE: no general "can't be Special Summoned" flag, so each lock is written here. */
const LOCKS = {
  'Destiny HERO - Double Dude': () => true,
  'Flamvell Commando': () => true,
  // only by its own summon rule (an idle action, never a resolving effect)
  'Evil Dragon Ananta': g => !!g.resolvingL,
  // its own summon rule first; once properly summoned, effects can bring it back
  'Destiny HERO - Dogma': (g, a) => !!g.resolvingL && !a.c.f31ok,
  'Destiny HERO - Disk Commander': (g, a) => a.c.zone === 'gy' && a.c.f31gyT === g.turnNo,
  'Divine Grace - Northwemko': (g, a) => a.how === 'ritual' && !(g.resolvingL && named(g.resolvingL.c, 'Ritual of Grace')),
};
const DFUSION = ['Evil HERO Infernal Sniper', 'Evil HERO Inferno Wing', 'Evil HERO Lightning Golem', 'Evil HERO Wild Cyclone'];
for (const n of DFUSION) LOCKS[n] = (g, a) => !a.c.f31ok && !(a.c.flags && a.c.flags.darkFusion) && !(g.resolvingL && ['Dark Fusion', 'Dark Calling'].includes(D(g.resolvingL.c).n));
const lockEff = { type: 'trig', loc: 'any', res: noop, on: (g) => {
  if (!g.f31lock) { g.f31lock = true; addRule(g, (g2, a) => { if (a.type !== 'ss' || !a.c || a.c.id == null) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); }
  return false; } };
// marks a monster that was summoned the proper way (its later revivals are allowed)
const markProper = hows => ({ type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (evSummoned(ev, c, hows)) c.f31ok = true; return false; } });

/* Earthbound Immortal shared parts (same as batch-6.js) */
const eiSelf = { noAttackTarget: true, directAttack: true };
const eiCont = {
  forbid: (g, src, a) => {
    if ((a.type === 'ns' || a.type === 'set' || a.type === 'ss') && a.c && a.c !== src && a.c.id && isEI(a.c)) return true;
    if (a.type === 'attack' && a.c.ctrl !== src.ctrl && monsOf(g, src.ctrl).every(x => faceUp(x) && has(g, x, 'noAttackTarget')) && !has(g, a.c, 'directAttack')) return true;
    return false;
  } };
const EI_SELF_LABEL = 'No Field Spell: destroy this card';
const noFieldSpell = g => ![g.p[0].fz, g.p[1].fz].some(f => f && f.pos !== 'set');
const eiSelfDestroy = { type: 'trig', mand: true, label: EI_SELF_LABEL,
  on: (g) => noFieldSpell(g),
  cond: (g, c) => onField(c) && faceUp(c) && noFieldSpell(g) && !has(g, c, 'noEffectDestroy'),
  res: function* (g, c, p) { if (onField(c) && faceUp(c) && noFieldSpell(g)) { c.flags.selfDestroy = true; destroy(g, [c], { by: p }); } } };

/* Djinn "of Rituals": noticed when the Djinn is used as a Ritual Tribute (move reason 'ritual') and the Ritual Monster arrives
 in the same group (as batch-7.js). ENGINE: ritualSummon() takes Tributes from the hand and field only, so banishing a Djinn
 from the GY as a Tribute isn't offered; a Djinn Tributed from the hand or field gives the same effect. */
const djinnTrack = apply => ({ type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
  if (ev.type === 'move' && ev.c === c && ev.reason === 'ritual') c.f31rit = ev.group;
  else if (ev.type === 'summon' && ev.how === 'ritual' && c.f31rit != null && c.f31rit === ev.group && ev.cs[0]) { c.f31rit = null; apply(g, c, ev.cs[0]); g.seq++; }
  return false; } });

/* Diamond Dude: the Normal Spell's effect is activated from the GY in the Main Phase of your next turn. The pending effects
 are kept on the game; whichever Diamond Dude you have (field, GY, banished or hand) offers them, once each.
 Costs are skipped; the Spell's own activation check is still asked (PARTIAL: the rulings bypass general requirements).
 PARTIAL: if every Diamond Dude you own is in the Deck or Extra Deck, the effect isn't offered. */
const DD = 'Destiny HERO - Diamond Dude';
const actEffOf = x => ((L.effsOf ? L.effsOf(x) : []) || []).find(e => e.type === 'act');
const condOk = (g, x, p, e) => { try { return !e.cond || !!e.cond(g, x, p, { top: null, mode: 'idle' }); } catch (err) { return false; } };
const ddPending = (g, p) => (g.f31dd || []).filter(e => e.p === p && e.turn === g.turnNo && !e.used && e.x.zone === 'gy' && e.x.f31ddTag === e.tag && actEffOf(e.x) && condOk(g, e.x, p, actEffOf(e.x)));
function ddHolder(g, p) { for (const z of ['m', 'gy', 'ban', 'hand']) { const arr = z === 'm' ? monsOf(g, p).filter(faceUp) : g.p[p][z]; const x = arr.find(y => named(y, DD)); if (x) return x; } return null; }
// Runs a borrowed Spell/Trap effect inside this chain link. Errors from the borrowed script are logged, not thrown.
function* runBorrowed(g, x, e, p, L2) {
  try { if (e.target) yield* e.target(g, x, p, L2); yield* e.res(g, x, p, L2); }
  catch (err) { if (isOver(err)) throw err; log(g, `${D(x).n}'s effect could not be applied.`); }
}
const ddUse = loc => ({ type: 'ign', loc, label: 'Activate the Normal Spell in your GY (Diamond Dude)',
  cond: (g, c, p) => ddHolder(g, p) === c && ddPending(g, p).length > 0,
  cost: function* (g, c, p, L2) { const es = ddPending(g, p); const [x] = yield* pick(g, p, 'Activate the effect of which Spell?', es.map(e => e.x), 1, 1, 'good');
    const e = es.find(y => y.x === x); if (e) { e.used = true; L2.data.f31x = x; log(g, `${PN(g, p)} activated the effect of ${D(x).n} in the GY.`); } },
  res: function* (g, c, p, L2) { const x = L2.data.f31x; if (!x || x.zone !== 'gy') return; const e = actEffOf(x); if (e) yield* runBorrowed(g, x, e, p, L2); } });

E.addScripts({
  /* ----- D.D.M. and Damage cards ----- */
  // Discard a Spell (cost), target one of your banished monsters, Special Summon it to your field.
  'D.D.M. - Different Dimension Master': { effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Discard a Spell: summon a banished monster',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(isSpell) && g.p[p].ban.some(x => canSS(g, p, x)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard which Spell Card?', g.p[p].hand.filter(isSpell), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${D(x).n}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which banished monster?', g.p[p].ban.filter(x => canSS(g, p, x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'ban' && freeM(g, p) >= 0) ss(g, p, t, 'atk'); } }] },
  // Continuous Trap: once per turn, after Battle Damage from a battle with a Reptile, summon a Reptile with ATK up to that damage.
  'Damage = Reptile': { effs: [actNoop,
    { type: 'trig', loc: 'st', when: true, opt: true, tags: { ss: 1 }, label: 'Special Summon a Reptile from your Deck',
      on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.p === c.ctrl && !!g.battle && [g.battle.a, g.battle.t].some(x => x && isMon(x) && race(x) === 'Reptile'),
      cond: (g, c, p, x) => freeM(g, p) >= 0 && g.p[p].deck.some(y => isMon(y) && race(y) === 'Reptile' && numAtk(y) != null && numAtk(y) <= x.ev.n && canSS(g, p, y)),
      res: function* (g, c, p, L2) { const n = L2.ev.n; const cs = g.p[p].deck.filter(y => isMon(y) && race(y) === 'Reptile' && numAtk(y) != null && numAtk(y) <= n && canSS(g, p, y));
        if (cs.length && freeM(g, p) >= 0) { const [x] = yield* pick(g, p, `Special Summon which Reptile (ATK ${n} or less)?`, cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } shuffleDeck(g, p); } }] },
  // ENGINE: no response window right after battle damage, so it is an optional trigger while Set (as Rope of Life in full-26.js).
  'Damage Condenser': { effs: [trapTrig({ label: 'Discard 1: summon a monster from your Deck', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.p === c.ctrl,
    cond: (g, c, p) => g.p[p].hand.length > 0 && g.p[p].deck.length > 0,
    cost: function* (g, c, p) { yield* discard1(g, p, 'Damage Condenser: discard 1 card'); },
    res: function* (g, c, p, L2) { const n = L2.ev.n; const cs = g.p[p].deck.filter(y => isMon(y) && numAtk(y) != null && numAtk(y) <= n && canSS(g, p, y));
      if (cs.length && freeM(g, p) >= 0) { const [x] = yield* pick(g, p, `Special Summon which monster (ATK ${n} or less)?`, cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } shuffleDeck(g, p); } })] },
  // PARTIAL: "an effect that inflicts damage" is read from the activated card's text.
  'Damage Polarizer': { effs: [{ type: 'act',
    cond: (g, c, p, x) => !!x.top && !x.top.negated && /inflicts?\b[^.]*damage/i.test(D(x.top.c).ps || D(x.top.c).tx || ''),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; if (T && g.chain.includes(T) && !T.negated) { T.negBy = p; negate(g, T, false);
        if (T.cardAct && onField(T.c) && isST(T.c)) move(g, T.c, 'gy', { reason: 'rule' }); }
      draw(g, g.tp, 1); draw(g, opp(g.tp), 1); } }] },
  // Effect damage to you is halved this turn (one copy only); in the End Phase, a Ghost Token for each time you took effect
  // damage, or none if you have too few free zones.
  'Damage Translation': {
    cont: { loc: 'gy', dmg: (g, src, p, n, o) => { const r = g.f31dt && g.f31dt[p]; return !o.battle && r && r.turn === g.turnNo && r.u === src.u ? Math.floor(n / 2) : undefined; } },
    effs: [{ type: 'act', res: function* (g, c, p) { const dt = g.f31dt || (g.f31dt = {}); if (!dt[p] || dt[p].turn !== g.turnNo) dt[p] = { turn: g.turnNo, u: c.u, n: 0, p }; log(g, `Effect damage to ${PN(g, p)} is halved this turn.`); } },
      { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { const r = g.f31dt && ev.type === 'damage' && !ev.battle && g.f31dt[ev.p]; if (r && r.u === c.u && r.turn === g.turnNo) r.n++; return false; } },
      { type: 'trig', loc: 'any', mand: true, tags: { ss: 1 }, label: 'Special Summon Ghost Tokens',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!g.f31dt && Object.values(g.f31dt).some(r => r.u === c.u && r.turn === g.turnNo && r.n > 0 && !r.done),
        res: function* (g, c) { const r = Object.values(g.f31dt || {}).find(x => x.u === c.u && x.turn === g.turnNo && !x.done); if (!r) return; r.done = true;
          if (nFreeM(g, r.p) < r.n) { log(g, 'Not enough free zones for the Ghost Tokens.'); return; }
          tokens(g, r.p, { n: 'Ghost Token', a: 'DARK', r: 'Fiend', lv: 1, atk: 0, def: 0 }, r.n, 'def'); } }] },
  // Tribute a DARK (cost, face-down too). The opponent may reveal a Spell from the hand when it resolves to negate the draw.
  'Dark Spirit Art - Greed': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 2 && monsOf(g, p).some(x => attr(x) === 'DARK'),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which DARK monster?', monsOf(g, p).filter(x => attr(x) === 'DARK'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    res: function* (g, c, p) { const o = opp(p), sp = g.p[o].hand.filter(isSpell);
      if (sp.length && (yield* yn(g, o, 'Reveal a Spell Card from your hand to negate Dark Spirit Art - Greed?'))) { const [x] = yield* pick(g, o, 'Reveal which Spell Card?', sp, 1, 1, 'cost'); log(g, `${PN(g, o)} revealed ${D(x).n}. The effect was negated.`); return; }
      draw(g, p, 2); } }] },
  // ENGINE: Traps can't be activated from the hand, so the hand version is a Spell Speed 2 effect that places the card face-up
  // as it activates (it counts as a Trap Card activation) and sends it to the GY after.
  'Delta Crow - Anti Reverse': (() => {
    const bws = (g, p) => monsOf(g, p).filter(x => faceUp(x) && isBW(x)).length;
    const res = function* (g, c, p) { destroy(g, stOf(g, opp(p)).filter(x => x.pos === 'set'), { by: p, src: c }); };
    return { effs: [
      { type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => bws(g, p) > 0 && stOf(g, opp(p)).some(x => x.pos === 'set'), res },
      { type: 'quick', loc: 'hand', tags: { destroy: 1 }, label: 'Activate from the hand (3 Blackwings)',
        cond: (g, c, p) => bws(g, p) === 3 && freeST(g, p) >= 0 && stOf(g, opp(p)).some(x => x.pos === 'set'),
        cost: function* (g, c, p, L2) { move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'activate' }); L2.cardAct = true; },
        res: function* (g, c, p, L2) { yield* res(g, c, p, L2); if (onField(c)) move(g, c, 'gy', { reason: 'rule' }); } }] };
  })(),

  /* ----- Destiny HERO ----- */
  'Destiny HERO - Blade Master': { effs: [{ type: 'quick', loc: 'hand', label: 'Discard: Destiny HEROs gain 800 ATK',
    cond: (g, c, p) => g.tp !== p && g.phase === 'battle' && monsOf(g, p).some(x => faceUp(x) && isDH(x)),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded Destiny HERO - Blade Master.`); },
    res: function* (g, c, p) { const ms = monsOf(g, p).filter(x => faceUp(x) && isDH(x)); for (const m of ms) addMod(g, m, { atk: 800, end: true }); if (ms.length) log(g, `${ms.map(name).join(', ')} gained 800 ATK.`); } }] },
  // The battle-destroyed Destiny HEROs are noted while this card is face-up (the note ends if it leaves the field or is flipped).
  'Destiny HERO - Captain Tenacious': (() => {
    const elig = (g, c, p) => (c.flags.ctDead || []).filter(r => sinceLastStandby(g, r.t) && r.x.zone === 'gy' && r.x.owner === p && canSS(g, p, r.x)).map(r => r.x);
    return { effs: [
      { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c !== c && ev.battle && ev.destroyed && ev.to === 'gy' && dhMon(ev.c) && ev.c.owner === c.ctrl) (c.flags.ctDead || (c.flags.ctDead = [])).push({ x: ev.c, t: g.turnNo }); return false; } },
      { type: 'trig', opt: true, tags: { ss: 1 }, label: 'Special Summon a battle-destroyed Destiny HERO',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && elig(g, c, c.ctrl).length > 0,
        cond: (g, c, p) => freeM(g, p) >= 0 && elig(g, c, p).length > 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Destiny HERO?', elig(g, c, p), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, t, 'atk'); } }] };
  })(),
  'Destiny HERO - Defender': { effs: [{ type: 'trig', mand: true, label: 'Your opponent draws 1 card',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl && c.pos === 'def',
    cond: (g, c) => faceUp(c) && c.pos === 'def',
    res: function* (g, c, p) { if (onField(c) && faceUp(c) && c.pos === 'def') draw(g, opp(p), 1); } }] },
  // PARTIAL: "banish instead of going to the GY from the hand/Deck" happens right after it reaches the GY (ENGINE: no
  // banish-instead replacement in move()); only when a resolving card effect sent it (not a cost or the hand size limit).
  'Destiny HERO - Departed': {
    self: { replaceDestroy: (g, c, o) => { if (!o.battle) return false; move(g, c, 'ban', { reason: 'battle', destroyed: true, battle: true, killer: o.killer }); log(g, 'Destiny HERO - Departed was destroyed by battle and banished.'); return true; } },
    effs: [
      { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: "Special Summon itself to the opponent's field",
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner,
        res: function* (g, c, p) { if (c.zone !== 'gy' || freeM(g, opp(p)) < 0) return; if (ss(g, opp(p), c, 'atk')) log(g, `Destiny HERO - Departed went to ${PN(g, opp(p))}'s side of the field.`); } },
      { type: 'trig', loc: 'gy', mand: true, label: 'Banish this card',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && ['hand', 'deck'].includes(ev.from) && ev.reason !== 'cost' && !!g.resolvingL,
        res: function* (g, c) { if (c.zone === 'gy') { move(g, c, 'ban', { reason: 'effect' }); log(g, 'Destiny HERO - Departed was banished.'); } } }] },
  'Destiny HERO - Diamond Dude': { effs: [
    { type: 'ign', opt: true, label: 'Excavate the top card of your Deck', cond: (g, c, p) => g.p[p].deck.length > 0,
      res: function* (g, c, p) { const x = g.p[p].deck[g.p[p].deck.length - 1]; if (!x) return;
        log(g, `${PN(g, p)} excavated ${D(x).n}.`);
        if (isSpell(x) && D(x).sub === 'Normal') { move(g, x, 'gy', { reason: 'effect', by: p }); const tag = (g.f31ddN = (g.f31ddN || 0) + 1); x.f31ddTag = tag;
          (g.f31dd || (g.f31dd = [])).push({ x, p, tag, turn: g.turnNo + 2 }); log(g, `${D(x).n} went to the GY. Its effect can be activated next turn.`); }
        else { toBottom(g, x); log(g, `${D(x).n} went to the bottom of the Deck.`); } } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { if (ev.type === 'move' && ev.c.f31ddTag && ev.from === 'gy') ev.c.f31ddTag = null; return false; } },
    ddUse('m'), ddUse('gy'), ddUse('ban'), ddUse('hand')] },
  'Destiny HERO - Disk Commander': { effs: [lockEff,
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c) { if (ev.to === 'gy') c.f31gyT = g.turnNo; if (ev.to === 'm' && ev.from === 'gy') c.flags.fromGY = true; } return false; } },
    // Original 2006/2010 text: "When this card is Special Summoned from the Graveyard, draw 2 cards." No once-per-Duel
    // limit (added by later errata), and the draw is mandatory.
    { type: 'trig', mand: true, label: 'Draw 2 cards',
      on: (g, ev, c) => evSummoned(ev, c) && ev.byEffect && !!c.flags.fromGY,
      cond: (g, c, p) => g.p[p].deck.length > 0,
      res: function* (g, c, p) { draw(g, p, 2); } }] },
  // Special Summoned from the hand by Tributing 3 monsters including a Destiny HERO. In the opponent's next Standby Phase, if
  // it is still face-up: halve their LP (mandatory).
  'Destiny HERO - Dogma': {
    proc: { label: 'Special Summon (Tribute 3, including a Destiny HERO)',
      cond: (g, c, p) => monsOf(g, p).length >= 3 && monsOf(g, p).some(dhMon),
      cost: function* (g, c, p, grp) {
        const [a] = yield* pick(g, p, 'Tribute which Destiny HERO?', monsOf(g, p).filter(dhMon), 1, 1, 'cost');
        const rest = yield* pick(g, p, 'Tribute 2 more monsters', monsOf(g, p).filter(x => x !== a), 2, 2, 'cost');
        const ts = [a, ...rest]; for (const t of ts) move(g, t, 'gy', { reason: 'tribute', by: p, group: grp });
        log(g, `${PN(g, p)} Tributed ${ts.map(x => D(x).n).join(', ')}.`); c.flags.dogma = g.turnNo; } },
    effs: [lockEff, markProper(['special']),
      { type: 'trig', mand: true, opt: true, label: "Halve the opponent's LP",
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl && c.flags.dogma != null && g.turnNo === c.flags.dogma + 1,
        res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; const o = opp(p), lp = g.p[o].lp, n = lp - Math.ceil(lp / 2); g.p[o].lp -= n; log(g, `${PN(g, o)}'s LP were halved (${g.p[o].lp}).`); } }] },
  // The banished monster returns in your 2nd Standby Phase after activation (PARTIAL: as a chain link, not without one).
  'Destiny HERO - Doom Lord': { effs: [
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { if (ev.type === 'attack') (g.f31atk || (g.f31atk = {}))[ev.p] = g.turnNo; return false; } },
    { type: 'ign', opt: true, label: 'Banish a monster until your 2nd Standby Phase',
      cond: (g, c, p) => c.pos === 'atk' && monsOf(g, opp(p)).length > 0 && !(g.f31atk && g.f31atk[p] === g.turnNo),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      after: (g, c, p) => { addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.ctrl === p, { end: g.turnNo }); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !onField(c) || c.pos !== 'atk') return;
        const pos = t.pos, owner = t.owner; move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished.`);
        (c.f31doom || (c.f31doom = [])).push({ x: t, owner, pos, p, turn: g.turnNo + 4 }); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return the banished monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && (c.f31doom || []).some(r => r.turn === g.turnNo && r.p === ev.tp),
      res: function* (g, c) { const rs = (c.f31doom || []).filter(r => r.turn === g.turnNo); c.f31doom = (c.f31doom || []).filter(r => r.turn !== g.turnNo);
        for (const r of rs) { if (r.x.zone !== 'ban') continue; if (freeM(g, r.owner) >= 0) { move(g, r.x, 'm', { ctrl: r.owner, pos: r.pos, reason: 'effect' }); log(g, `${r.pos === 'set' ? 'A face-down monster' : D(r.x).n} returned to the field.`); }
          else { move(g, r.x, 'gy', { reason: 'rule' }); log(g, `${D(r.x).n} had no zone to return to and went to the GY.`); } } } }] },
  'Destiny HERO - Double Dude': {
    self: { maxAttacks: () => 2 },
    effs: [lockEff,
      { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c) c.f31dd = ev.destroyed && ev.to === 'gy' ? g.turnNo : null; return false; } },
      { type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon 2 Double Dude Tokens',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner && sinceLastStandby(g, c.f31dd) && c.f31dd < g.turnNo,
        cond: (g, c, p) => nFreeM(g, p) >= 2,
        cost: function* (g, c) { c.f31dd = null; },
        res: function* (g, c, p) { if (c.zone !== 'gy' || nFreeM(g, p) < 2) return; const i = yield* choose(g, p, 'Double Dude Tokens: which position?', ['Attack Position', 'Defense Position']);
          tokens(g, p, { n: 'Double Dude Token', a: 'DARK', r: 'Warrior', lv: 4, atk: 1000, def: 1000 }, 2, i ? 'def' : 'atk'); } }] },
  // Clock Counters are kept the way full-36.js reads them (flags.clock) and shown as counters.
  'Destiny HERO - Dread Servant': { effs: [
    { type: 'trig', mand: true, label: 'Place a Clock Counter on each Clock Tower Prison', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
      res: function* (g) { const ps = allField(g).filter(x => faceUp(x) && named(x, 'Clock Tower Prison'));
        for (const x of ps) { x.flags.clock = (x.flags.clock || 0) + 1; addCtr(g, x, 'clock', 1); g.seq++; log(g, `Clock Tower Prison has ${x.flags.clock} Clock Counter${x.flags.clock > 1 ? 's' : ''}.`); } } },
    { type: 'trig', loc: 'gy', when: true, tags: { destroy: 1 }, label: 'Destroy a Spell/Trap you control',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
      cond: (g, c, p) => stOf(g, p).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap you control?', stOf(g, p), 1, 1, 'cost'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  // "Summoned by Clock Tower Prison" = while Clock Tower Prison's effect is the chain link resolving.
  // PARTIAL: the protection and "no battle damage" for your Destiny HEROs last while this card stays face-up that turn.
  'Destiny HERO - Dreadmaster': (() => {
    const others = (g, c) => monsOf(g, c.ctrl).filter(x => x !== c && faceUp(x) && isDH(x)).reduce((s, x) => s + baseAtk(x), 0);
    return {
      self: { atk: (g, c) => others(g, c), def: (g, c) => others(g, c) },
      cont: { grant: (g, src, c, flag) => ['noBattleDestroy', 'noEffectDestroy', 'noBattleDamage'].includes(flag) && src.flags.dmTurn === g.turnNo && !negd(g, src) && c.zone === 'm' && c.ctrl === src.ctrl && faceUp(c) && isDH(c) },
      effs: [
        { type: 'trig', res: noop, on: (g, ev, c) => { if (evSummoned(ev, c, ['special'])) { c.flags.dmTurn = g.turnNo; g.seq++; } return false; } },
        { type: 'trig', mand: true, tags: { destroy: 1, ss: 1 }, label: 'Destroy your non-Destiny HERO monsters, revive 2 Destiny HEROs',
          on: (g, ev, c) => evSummoned(ev, c, ['special']) && !!g.resolvingL && named(g.resolvingL.c, 'Clock Tower Prison'),
          res: function* (g, c, p) {
            destroy(g, monsOf(g, p).filter(x => !(faceUp(x) && isDH(x))), { by: p });
            const cs = () => g.p[p].gy.filter(x => dhMon(x) && canSS(g, p, x)); const n = Math.min(2, nFreeM(g, p), cs().length);
            if (n > 0 && (yield* yn(g, p, 'Special Summon up to 2 Destiny HERO monsters from your GY?'))) {
              const xs = yield* pick(g, p, `Special Summon which Destiny HEROs (up to ${n})?`, cs(), 1, n, 'good'); for (const x of xs) if (x.zone === 'gy') ss(g, p, x, 'atk'); } } }] };
  })(),
  'Destiny HERO - Dunker': { effs: [{ type: 'ign', label: 'Send a Destiny HERO card: 500 damage',
    cond: (g, c, p) => g.p[p].hand.some(isDHd),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Destiny HERO card from your hand to the GY?', g.p[p].hand.filter(isDHd), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  'Destiny HERO - Fear Monger': (() => {
    const cands = (g, p) => g.p[p].gy.filter(x => dhMon(x) && !named(x, 'Destiny HERO - Fear Monger') && canSS(g, p, x));
    return { effs: [
      { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c) c.f31fm = ev.to === 'gy' && ev.battle && ev.destroyed ? g.turnNo : null; return false; } },
      { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon a Destiny HERO from your GY',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner && sinceLastStandby(g, c.f31fm) && c.f31fm < g.turnNo,
        cond: (g, c, p) => freeM(g, p) >= 0 && cands(g, p).length > 0,
        target: function* (g, c, p, L2) { c.f31fm = null; yield* tgt(g, p, L2, 'Special Summon which Destiny HERO?', cands(g, p), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, t, 'atk'); } }] };
  })(),

  /* ----- Divine and Djinn ----- */
  // Mandatory on its Normal Summon: one effect per Excelion in your GY at resolution, all different.
  'Divine Dragon - Excelion': { effs: [
    { type: 'trig', mand: true, label: 'Gain effects for each Excelion in your GY', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
      res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return;
        let n = Math.min(3, g.p[p].gy.filter(x => named(x, 'Divine Dragon - Excelion')).length); const opts = ['Gain 1000 ATK', 'Attack again after destroying a monster by battle', 'Damage equal to the ATK of a monster it destroys'];
        const left = [0, 1, 2];
        while (n-- > 0 && left.length) { const i = left.length > 1 ? yield* choose(g, p, 'Divine Dragon - Excelion: which effect?', left.map(k => opts[k])) : 0; const k = left.splice(i, 1)[0];
          if (k === 0) addMod(g, c, { atk: 1000 }); else if (k === 1) c.flags.exAgain = true; else c.flags.exBurn = true;
          log(g, `Divine Dragon - Excelion: ${opts[k]}.`); } } },
    { type: 'trig', res: noop, on: (g, ev, c) => { if (c.flags.exAgain && ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.c.owner !== c.ctrl) c.flags.extraAttack = g.turnNo; return false; } },
    { type: 'trig', mand: true, label: "Damage equal to the destroyed monster's ATK",
      on: (g, ev, c) => !!c.flags.exBurn && L.battleKill(ev, c) && ev.c.owner !== c.ctrl,
      res: function* (g, c, p, L2) { const n = baseAtk(L2.ev.c); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  // Ritual Summoned by Ritual of Grace (full-13.js). It selects up to as many face-up cards as monsters used for it;
  // while any of them is face-up on the field, it can't be destroyed by card effects.
  'Divine Grace - Northwemko': {
    self: { noEffectDestroy: (g, c) => (c.flags.nw || []).some(u => allField(g).some(x => x.u === u && faceUp(x))) },
    effs: [lockEff,
      { type: 'trig', mand: true, label: 'Select face-up cards',
        on: (g, ev, c) => { if (!evSummoned(ev, c, ['ritual'])) return false; c.flags.nwN = g.events.filter(e => e.type === 'move' && e.reason === 'ritual' && e.group === ev.group).length || 1; return true; },
        target: function* (g, c, p, L2) { const n = c.flags.nwN || 1;
          const cs = allField(g).filter(x => x !== c && faceUp(x)); if (cs.length) yield* tgt(g, p, L2, `Select up to ${n} face-up card${n > 1 ? 's' : ''}`, cs, 1, Math.min(n, cs.length), 'good'); },
        res: function* (g, c, p, L2) { if (!onField(c)) return; c.flags.nw = live(L2).filter(faceUp).map(x => x.u); g.seq++; if (c.flags.nw.length) log(g, `Divine Grace - Northwemko selected ${live(L2).map(name).join(', ')}.`); } }] },
  'Divine Sword - Phoenix Blade': {
    cont: { atk: (g, src, m) => src.equipTo === m.u ? 300 : 0 },
    effs: [equipAct(m => race(m) === 'Warrior', 'Equip to which Warrior?'),
      { type: 'ign', loc: 'gy', label: 'Banish 2 Warriors: add this card to your hand',
        cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && race(x) === 'Warrior').length >= 2,
        cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Banish which 2 Warrior monsters from your GY?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Warrior'), 2, 2, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${xs.map(x => D(x).n).join(' and ')}.`); },
        res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} added Divine Sword - Phoenix Blade to the hand.`); } } }] },
  // PARTIAL: Synchro effects are negated while this Djinn stays in the GY (the effect is read from there).
  'Djinn Cursenchanter of Rituals': {
    cont: { loc: 'gy', negates: (g, src, x) => isMon(x) && D(x).k === 'synchro' && fieldMons(g).some(m => m.flags.f31cur === src.u && faceUp(m)) },
    effs: [djinnTrack((g, c, rm) => { rm.flags.f31cur = c.u; log(g, `While ${name(rm)} is face-up, Synchro Monsters' effects are negated.`); })] },
  'Djinn Disserere of Rituals': { effs: [djinnTrack((g, c, rm) => { rm.flags.unaffectedTraps = true; log(g, `${name(rm)} is unaffected by Trap effects.`); })] },
  // PARTIAL: the draw is a chain link (the card says it doesn't start a Chain).
  'Djinn Presider of Rituals': { effs: [djinnTrack((g, c, rm) => { rm.flags.f31pres = c.u; }),
    { type: 'trig', loc: 'any', mand: true, label: 'The Ritual Monster’s controller draws 1 card',
      on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && !!ev.killer && onField(ev.killer) && ev.killer.flags.f31pres === c.u,
      res: function* (g, c, p, L2) { const k = L2.ev.killer; draw(g, onField(k) ? k.ctrl : p, 1); } }] },
  // PARTIAL: the discard is a chain link (the card says it doesn't start a Chain).
  'Djinn Prognosticator of Rituals': { effs: [djinnTrack((g, c, rm) => { rm.flags.f31prog = c.u; }),
    { type: 'trig', loc: 'any', mand: true, label: 'The opponent discards 1 card',
      on: (g, ev, c) => ev.type === 'damage' && ev.battle && !!ev.src && !!ev.src.flags && ev.src.flags.f31prog === c.u && ev.p !== ev.src.ctrl,
      res: function* (g, c, p, L2) { const o = L2.ev.p; yield* discard1(g, o, 'Discard 1 card'); } }] },

  /* ----- Earthbound ----- */
  // Its damage is the destroyed monster's original ATK (read in the GY).
  'Earthbound Immortal Ccapac Apu': { self: eiSelf, cont: eiCont, effs: [eiSelfDestroy,
    { type: 'trig', mand: true, label: "Damage equal to the destroyed monster's ATK",
      on: (g, ev, c) => L.battleKill(ev, c) && ev.c.owner !== c.ctrl,
      res: function* (g, c, p, L2) { const n = baseAtk(L2.ev.c); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  // PARTIAL: "the opponent can't conduct their Battle Phase" is set at their Standby Phase and Main Phase 1 events while this
  // card is in face-up Defense Position (switching it back later that turn doesn't give the Battle Phase back).
  'Earthbound Immortal Chacu Challhua': { self: eiSelf, cont: eiCont, effs: [eiSelfDestroy,
    { type: 'trig', res: noop, on: (g, ev, c) => { if (c.pos === 'def' && g.tp !== c.ctrl && ['standby', 'main1'].includes(g.phase) && !negd(g, c)) g.noBP[g.tp] = true; return false; } },
    { type: 'ign', opt: true, label: 'Damage equal to half its DEF',
      after: (g, c) => { addRule(g, (g2, a) => a.type === 'attack' && a.c === c, { end: g.turnNo }); },
      res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; const n = Math.floor(stat(g, c, 'def') / 2); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  // The "Tribute another monster instead" choice is made for you: the monster with the lowest ATK is Tributed.
  // PARTIAL: it is always used when it can be (the card says "you can").
  'Earthbound Immortal Cusillu': { self: { ...eiSelf,
      replaceDestroy: (g, c, o) => { if (!o.battle) return false; const ms = monsOf(g, c.ctrl).filter(x => x !== c); if (!ms.length) return false;
        const t = ms.slice().sort((a, b) => stat(g, a, 'atk') - stat(g, b, 'atk'))[0]; move(g, t, 'gy', { reason: 'effect', by: c.ctrl }); log(g, `${PN(g, c.ctrl)} Tributed ${D(t).n} instead of Earthbound Immortal Cusillu.`);
        const o2 = opp(c.ctrl), lp = g.p[o2].lp; g.p[o2].lp -= lp - Math.ceil(lp / 2); log(g, `${PN(g, o2)}'s LP were halved (${g.p[o2].lp}).`); return true; } },
    cont: eiCont, effs: [eiSelfDestroy] },
  // The discard is the cost (read the 2010 way).
  'Earthbound Immortal Revival': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && g.p[p].gy.some(isEI) && g.p[p].gy.some(x => isSpell(x) && D(x).sub === 'Field'),
    cost: function* (g, c, p) { yield* discard1(g, p, 'Earthbound Immortal Revival: discard 1 card', c); },
    target: function* (g, c, p, L2) {
      const [a] = yield* pick(g, p, 'Add which Earthbound Immortal?', g.p[p].gy.filter(isEI), 1, 1, 'good');
      const [b] = yield* pick(g, p, 'Add which Field Spell?', g.p[p].gy.filter(x => isSpell(x) && D(x).sub === 'Field'), 1, 1, 'good'); L2.t = [a, b].filter(Boolean); },
    res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'hand', { reason: 'effect', by: p }); if (xs.length) log(g, `${PN(g, p)} added ${xs.map(x => D(x).n).join(' and ')} to the hand.`); } }] },
  'Earthbound Immortal Uru': { self: eiSelf, cont: eiCont, effs: [eiSelfDestroy,
    { type: 'ign', opt: true, label: 'Tribute a monster: take control of a monster',
      cond: (g, c, p) => monsOf(g, p).some(x => x !== c) && oppFaceUp(g, p).length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p).filter(x => x !== c), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which face-up monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.ctrl !== p) takeControl(g, p, t, true); } }] },
  'Earthbound Immortal Wiraqocha Rasca': { self: eiSelf, cont: eiCont, effs: [eiSelfDestroy,
    { type: 'trig', mand: true, label: 'Return cards: random discards',
      on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
      cond: (g, c, p) => g.p[opp(p)].hand.length > 0,
      target: function* (g, c, p, L2) { const n = Math.min(3, g.p[opp(p)].hand.length); yield* tgt(g, p, L2, `Shuffle 1 to ${n} cards you control into the Deck`, L.fieldOf(g, p), 1, n, 'cost'); },
      res: function* (g, c, p, L2) { const xs = live(L2); for (const x of xs) move(g, x, 'deck', { reason: 'effect', by: p }); shuffleDeck(g, p); if (xs.length) log(g, `${PN(g, p)} shuffled ${xs.length} card${xs.length > 1 ? 's' : ''} into the Deck.`);
        const o = opp(p), h = g.p[o].hand; let k = 0;
        for (let i = 0; i < xs.length && h.length; i++) { const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, o)} discarded ${D(x).n} at random.`); k++; }
        if (k && onField(c) && faceUp(c)) { addMod(g, c, { atk: 1000 * k }); log(g, `${name(c)} gained ${1000 * k} ATK.`); } } }] },
  // Earthbound Immortals can't destroy themselves: their "no Field Spell" self-destruction can't activate, and an Earthbound
  // Immortal's own resolving effect can't destroy it.
  'Earthbound Linewalker': { cont: {
    forbid: (g, src, a) => a.type === 'activate' && !!a.c && isEI(a.c) && a.eff && a.eff.label === EI_SELF_LABEL && !negd(g, src),
    replaceDestroy: (g, src, c, o) => !o.battle && isEI(c) && !negd(g, src) && !!g.resolvingL && g.resolvingL.c === c } },

  /* ----- Evil ----- */
  'Evil Blast': {
    cont: { atk: (g, src, m) => src.equipTo === m.u ? 500 : 0 },
    effs: [{ type: 'act',
      cond: (g, c, p) => !!g.sw && !['normal', 'tribute', 'flip', 'gemini'].includes(g.sw.how) && g.sw.cs.some(x => onField(x) && x.zone === 'm' && x.ctrl === opp(p) && faceUp(x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Evil Blast to which monster?', g.sw.cs.filter(x => onField(x) && x.zone === 'm' && x.ctrl === opp(p) && faceUp(x)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && equip(g, c, t)) L2.keep = true; } },
      { type: 'trig', loc: 'st', mand: true, label: '500 damage to the opponent',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl && !!c.equipTo,
        res: function* (g, c, p) { if (onField(c) && c.equipTo) damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  // Special Summoned by banishing every Reptile you control and in your GY (at least 1); 600 ATK and DEF for each.
  'Evil Dragon Ananta': (() => {
    const reps = (g, p) => [...monsOf(g, p).filter(x => race(x) === 'Reptile'), ...g.p[p].gy.filter(x => isMon(x) && race(x) === 'Reptile')];
    return {
      self: { atk: (g, c) => 600 * (c.flags.f31n || 0), def: (g, c) => 600 * (c.flags.f31n || 0) },
      proc: { label: 'Special Summon (banish all your Reptiles)', cond: (g, c, p) => reps(g, p).length > 0,
        cost: function* (g, c, p, grp) { const xs = reps(g, p); for (const x of xs) move(g, x, 'ban', { reason: 'cost', by: p, group: grp }); c.flags.f31n = xs.length; log(g, `${PN(g, p)} banished ${xs.length} Reptile monster${xs.length > 1 ? 's' : ''}.`); } },
      effs: [lockEff,
        { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy 1 card on the field',
          on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
          res: function* (g, c, p) { const cs = allField(g); if (!cs.length) return; const [x] = yield* pick(g, p, 'Destroy which card on the field?', cs, 1, 1, 'bad'); if (x) destroy(g, [x], { by: p, src: c }); } }] };
  })(),
  // Banish this card (cost) in Main Phase 1: a Fiend you control attacks twice each Battle Phase while you control it face-up.
  // This card comes back in your 2nd Standby Phase after (mandatory), unless it left the banished pile meanwhile.
  'Evil HERO Infernal Gainer': { effs: [
    { type: 'ign', label: 'Banish this card: a Fiend attacks twice',
      cond: (g, c, p) => g.phase === 'main1' && monsOf(g, p).some(x => x !== c && faceUp(x) && race(x) === 'Fiend'),
      cost: function* (g, c, p) { move(g, c, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished Evil HERO Infernal Gainer.`); c.f31gain = { p, turn: g.turnNo + 4 }; },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Fiend can attack twice?', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Fiend'), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || t.ctrl !== p) return; t.flags.f31g2 = p; t.flags.maxAttacks = 2; t.flags.maxAttacksTurn = g.turnNo; g.seq++; log(g, `${name(t)} can attack twice each Battle Phase.`); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (ev.type === 'move' && ev.c === c && ev.from === 'ban') c.f31gain = null;
      if (ev.type === 'phase' && ev.ph === 'standby') for (const m of fieldMons(g)) if (m.flags.f31g2 != null && m.flags.f31g2 === m.ctrl && faceUp(m)) { m.flags.maxAttacks = 2; m.flags.maxAttacksTurn = g.turnNo; }
      return false; } },
    { type: 'trig', loc: 'ban', mand: true, opt: true, tags: { ss: 1 }, label: 'Special Summon this card',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && !!c.f31gain && ev.tp === c.f31gain.p && g.turnNo === c.f31gain.turn,
      res: function* (g, c, p) { c.f31gain = null; if (c.zone !== 'ban') return; if (freeM(g, p) >= 0) ss(g, p, c, 'atk'); else { move(g, c, 'gy', { reason: 'rule' }); log(g, 'Evil HERO Infernal Gainer had no zone and went to the GY.'); } } }] },
  // Dark Fusion monsters: only Dark Fusion (or Dark Calling, treated as Dark Fusion) can summon them, then effects can revive them.
  'Evil HERO Infernal Sniper': {
    self: { replaceDestroy: (g, c, o) => { if (o.battle || o.rule) return false; const s = o.src || (g.resolvingL && g.resolvingL.c); return !!s && isSpell(s); } },
    effs: [lockEff, markProper(['fusion']),
      { type: 'trig', mand: true, label: '1000 damage to the opponent',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.pos === 'def',
        cond: (g, c) => faceUp(c) && c.pos === 'def',
        res: function* (g, c, p) { if (onField(c) && faceUp(c) && c.pos === 'def') damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },
  'Evil HERO Inferno Wing': { self: { piercing: true },
    effs: [lockEff, markProper(['fusion']),
      { type: 'trig', mand: true, label: "Damage equal to the destroyed monster's ATK or DEF",
        on: (g, ev, c) => L.battleKill(ev, c),
        res: function* (g, c, p, L2) { const x = L2.ev.c; const n = Math.max(baseAtk(x), num(D(x).def)); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  'Evil HERO Lightning Golem': { effs: [lockEff, markProper(['fusion']),
    { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy a monster', cond: g => fieldMons(g).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  'Evil HERO Wild Cyclone': {
    cont: { forbid: (g, src, a) => a.type === 'activate' && !!a.c && a.p !== src.ctrl && a.eff && a.eff.type === 'act' && isST(a.c) && !negd(g, src) && ((g.aw && g.aw.a === src) || (g.battle && g.battle.a === src)) },
    effs: [lockEff, markProper(['fusion']),
      { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy their face-down Spells and Traps',
        on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
        res: function* (g, c, p) { destroy(g, stOf(g, opp(p)).filter(x => x.pos === 'set'), { by: p, src: c }); } }] },
  'Evil Thorn': { effs: [{ type: 'ign', label: 'Tribute: 300 damage',
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Evil Thorn.`); },
    res: function* (g, c, p) { damage(g, opp(p), 300, { src: c, srcP: p });
      const cs = () => g.p[p].deck.filter(x => named(x, 'Evil Thorn') && canSS(g, p, x)); const n = Math.min(2, nFreeM(g, p), cs().length);
      if (n > 0 && (yield* yn(g, p, 'Special Summon up to 2 Evil Thorn from your Deck?'))) { const xs = yield* pick(g, p, `Special Summon which Evil Thorn (up to ${n})?`, cs(), 1, n, 'good'); for (const x of xs) ss(g, p, x, 'atk', { negate: true }); }
      if (n > 0) shuffleDeck(g, p); } }] },

  /* ----- Fake ----- */
  // Monsters in this battle can't be destroyed by it (read from the GY); after damage calculation, Summon Reactor SK comes out
  // (a new chain, mandatory).
  'Fake Explosion': (() => {
    const cur = (g, src) => { const r = g.f31fe; return r && r.u === src.u && r.turn === g.turnNo && g.battle && g.battle.a.u === r.a && g.battle.a.attacks === r.n; };
    return {
      cont: { loc: 'gy', grant: (g, src, m, flag) => flag === 'noBattleDestroy' && cur(g, src) && (m === g.battle.a || m === g.battle.t) },
      effs: [{ type: 'act', cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p,
        res: function* (g, c, p) { if (!g.aw) return; g.f31fe = { u: c.u, turn: g.turnNo, a: g.aw.a.u, n: g.aw.a.attacks }; log(g, 'Monsters can’t be destroyed by this battle.'); } },
        { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon Summon Reactor SK',
          on: (g, ev, c) => ev.type === 'afterCalc' && !!g.f31fe && g.f31fe.u === c.u && g.f31fe.turn === g.turnNo && ev.a.u === g.f31fe.a && ev.a.attacks === g.f31fe.n,
          cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].gy].some(x => named(x, 'Summon Reactor SK') && canSS(g, p, x)),
          res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].gy].filter(x => named(x, 'Summon Reactor SK') && canSS(g, p, x)); if (!cs.length || freeM(g, p) < 0) return;
            const [x] = yield* pick(g, p, 'Special Summon which Summon Reactor SK?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] };
  })(),
  // The copied Normal Trap must fit this moment (its own activation check); its cost is skipped and its targets are picked
  // when Fake Feather resolves.
  'Fake Feather': (() => {
    const traps = (g, c, p, x) => g.p[opp(p)].gy.filter(t => isTrap(t) && D(t).sub === 'Normal' && actEffOf(t) && (() => { try { const e = actEffOf(t); return !e.cond || !!e.cond(g, t, p, x || { top: null }); } catch (err) { return false; } })());
    return { effs: [{ type: 'act',
      cond: (g, c, p, x) => g.p[p].hand.some(y => isMon(y) && isBW(y)) && traps(g, c, p, x).length > 0,
      cost: function* (g, c, p) { const [y] = yield* pick(g, p, 'Send which Blackwing monster from your hand to the GY?', g.p[p].hand.filter(z => isMon(z) && isBW(z)), 1, 1, 'cost'); if (y) { move(g, y, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(y).n} to the GY.`); } },
      target: function* (g, c, p, L2) { const top = g.chain[g.chain.length - 1]; const [t] = yield* pick(g, p, 'Copy which Normal Trap?', traps(g, c, p, { top }), 1, 1, 'good'); L2.data.f31tr = t; if (t) log(g, `Fake Feather copies ${D(t).n}.`); },
      res: function* (g, c, p, L2) { const t = L2.data.f31tr; if (!t || t.zone !== 'gy') return; const e = actEffOf(t); if (!e) return; L2.t = []; yield* runBorrowed(g, t, e, p, L2); } }] };
  })(),
  // The monster can't attack and returns to the hand in the End Phase.
  'Fake Hero': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && /^Elemental HERO/.test(D(x).n) && canSS(g, p, x)),
      res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isMon(x) && /^Elemental HERO/.test(D(x).n) && canSS(g, p, x)); if (!cs.length || freeM(g, p) < 0) return;
        const [x] = yield* pick(g, p, 'Special Summon which Elemental HERO from your hand?', cs, 1, 1, 'good');
        if (x && ss(g, p, x, 'atk')) { x.flags.cantAttack = true; x.flags.f31fh = g.turnNo; (c.f31fh || (c.f31fh = [])).push({ x, turn: g.turnNo }); } } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return the monster to the hand',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && (c.f31fh || []).some(r => r.turn === g.turnNo && onField(r.x) && r.x.flags.f31fh === g.turnNo),
      res: function* (g, c) { const rs = (c.f31fh || []).filter(r => r.turn === g.turnNo); c.f31fh = (c.f31fh || []).filter(r => r.turn > g.turnNo);
        for (const r of rs) if (onField(r.x) && r.x.flags.f31fh === g.turnNo) { move(g, r.x, 'hand', { reason: 'effect' }); log(g, `${D(r.x).n} returned to the hand.`); } } }] },
});

/* Familiar-Possessed: Special Summon from the hand or Deck by sending the Charmer and another face-up monster of its Attribute
 you control to the GY; piercing when summoned this way.
 ENGINE: no idle action for a Special Summon from the Deck, so the Deck version is offered as an optional trigger during your
 Main Phase whenever a new pair of materials is on your field (PARTIAL: it uses a chain link, so Solemn Judgment can't
 negate it). From the hand it is a normal summon rule. */
function familiar(charmer, at) {
  const pairs = (g, p) => { const ch = monsOf(g, p).filter(x => faceUp(x) && named(x, charmer)); const ot = monsOf(g, p).filter(x => faceUp(x) && attr(x) === at); return ch.some(a => ot.some(b => b !== a)); };
  const sendCost = function* (g, c, p, grp) {
    const ch = monsOf(g, p).filter(x => faceUp(x) && named(x, charmer) && monsOf(g, p).some(b => b !== x && faceUp(b) && attr(b) === at));
    const [a] = yield* pick(g, p, `Send which ${charmer}?`, ch, 1, 1, 'cost');
    const [b] = yield* pick(g, p, `Send which face-up ${at} monster?`, monsOf(g, p).filter(x => x !== a && faceUp(x) && attr(x) === at), 1, 1, 'cost');
    for (const x of [a, b]) if (x) move(g, x, 'gy', { reason: 'cost', by: p, group: grp });
    log(g, `${PN(g, p)} sent ${[a, b].filter(Boolean).map(x => D(x).n).join(' and ')} to the GY.`); };
  return {
    self: { piercing: (g, c) => !!c.flags.fpOwn },
    proc: { label: `Special Summon (send ${charmer} and a ${at} monster)`, cond: (g, c, p) => pairs(g, p),
      cost: function* (g, c, p, grp) { yield* sendCost(g, c, p, grp); c.flags.fpOwn = true; } },
    effs: [{ type: 'trig', loc: 'deck', tags: { ss: 1 }, label: 'Special Summon this card from your Deck',
      on: (g, ev, c) => {
        if (g.tp !== c.owner || !['main1', 'main2'].includes(g.phase) || ev.type === 'phase') return false;
        if (g.p[c.owner].deck.find(x => named(x, D(c).n)) !== c || !pairs(g, c.owner) || forbid(g, { type: 'ss', c, p: c.owner, how: 'special' })) return false;
        const key = g.turnNo + g.phase + ':' + monsOf(g, c.owner).filter(x => faceUp(x) && (named(x, charmer) || attr(x) === at)).map(x => x.u).join(',');
        if (c.flags.fpAsk === key) return false; c.flags.fpAsk = key; return true; },
      cond: (g, c, p) => c.zone === 'deck' && pairs(g, p),
      cost: function* (g, c, p) { yield* sendCost(g, c, p, g.group); },
      res: function* (g, c, p) { if (c.zone !== 'deck' || freeM(g, p) < 0) return; if (ss(g, p, c, 'atk')) c.flags.fpOwn = true; shuffleDeck(g, p); } }] };
}

E.addScripts({
  'Familiar-Possessed - Aussa': familiar('Aussa the Earth Charmer', 'EARTH'),
  'Familiar-Possessed - Eria': familiar('Eria the Water Charmer', 'WATER'),
  'Familiar-Possessed - Hiita': familiar('Hiita the Fire Charmer', 'FIRE'),
  'Familiar-Possessed - Wynn': familiar('Wynn the Wind Charmer', 'WIND'),

  /* ----- Flamvell ----- */
  // Normal Summon or Set only while you control a Flamvell monster to Tribute.
  // PARTIAL: the Tribute itself isn't limited to the Flamvell (tributeCands has no per-summon filter).
  'Flamvell Commando': {
    cont: { loc: 'hand', forbid: (g, src, a) => (a.type === 'ns' || a.type === 'set') && a.c === src && !monsOf(g, src.owner).some(x => /^Flamvell/.test(D(x).n)) },
    effs: [lockEff,
      { type: 'ign', opt: true, label: 'Banish a 200 DEF monster: damage equal to its ATK',
        cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && D(x).def != null && num(D(x).def) === 200 && D(x).def !== '?'),
        cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Banish which monster with 200 DEF from your GY?', g.p[p].gy.filter(x => isMon(x) && num(D(x).def) === 200 && D(x).def !== '?'), 1, 1, 'cost');
          if (x) { L2.data.n = baseAtk(x); move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
        res: function* (g, c, p, L2) { if (L2.data.n > 0) damage(g, opp(p), L2.data.n, { src: c, srcP: p }); } }] },
  'Flamvell Counter': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p, x) => spellTrapAct(x.top) && !x.top.negated && g.p[p].gy.some(y => isMon(y) && attr(y) === 'FIRE' && num(D(y).def) === 200 && D(y).def !== '?'),
    cost: function* (g, c, p) { const [y] = yield* pick(g, p, 'Banish which FIRE monster with 200 DEF from your GY?', g.p[p].gy.filter(y => isMon(y) && attr(y) === 'FIRE' && num(D(y).def) === 200 && D(y).def !== '?'), 1, 1, 'cost'); if (y) { move(g, y, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${D(y).n}.`); } },
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; if (T && g.chain.includes(T) && !T.negated) { T.negBy = p; negate(g, T, true); } } }] },
  'Flamvell Dragnov': { effs: [
    { type: 'trig', loc: 'gy', mand: true, label: '500 damage', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
      res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } },
    { type: 'ign', loc: 'gy', label: 'Banish with a FIRE: add Flamvell Dragnov',
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && attr(x) === 'FIRE') && g.p[p].deck.some(x => named(x, 'Flamvell Dragnov')),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish which face-up FIRE monster you control?', monsOf(g, p).filter(x => faceUp(x) && attr(x) === 'FIRE'), 1, 1, 'cost');
        move(g, c, 'ban', { reason: 'cost', by: p }); if (x) move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished Flamvell Dragnov${x ? ' and ' + D(x).n : ''}.`); },
      res: function* (g, c, p) { yield* search(g, p, x => named(x, 'Flamvell Dragnov'), 'Add Flamvell Dragnov'); } }] },

  /* ----- Fortress and Fossil ----- */
  'Fortress Warrior': { self: { noBattleDamage: true,
    replaceDestroy: (g, c, o) => { if (!o.battle || c.flags.fwTurn === g.turnNo) return false; c.flags.fwTurn = g.turnNo; log(g, 'Fortress Warrior was not destroyed by battle.'); return true; } } },
  'Fortress Whale': { effs: [] },
  "Fortress Whale's Oath": { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && canRitual(g, p, { monster: x => named(x, 'Fortress Whale') }),
    res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, 'Fortress Whale') }); } }] },
  'Fossil Dig': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && race(x) === 'Dinosaur' && lv(x) <= 6),
    res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && race(x) === 'Dinosaur' && lv(x) <= 6, 'Add a Level 6 or lower Dinosaur'); } }] },
  // Continuous Trap: discard 1 (cost), revive a Dinosaur with its effects negated, linked both ways.
  'Fossil Excavation': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => x !== c) && g.p[p].gy.some(x => isMon(x) && race(x) === 'Dinosaur' && canSS(g, p, x)),
    cost: function* (g, c, p) { yield* discard1(g, p, 'Fossil Excavation: discard 1 card', c); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Dinosaur from your GY?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Dinosaur' && canSS(g, p, x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && onField(c) && ss(g, p, t, 'atk', { negate: true })) link(g, c, t); } }] },
  'Fossil Tusker': { effs: [{ type: 'trig', mand: true, label: '400 damage', on: (g, ev, c) => L.battleKill(ev, c),
    res: function* (g, c, p) { damage(g, opp(p), 400, { src: c, srcP: p }); } }] },

  /* ----- Gadget ----- */
  'Gadget Arms': { effs: [flip('Add a Morphtronic Spell/Trap from your GY', {
    target: function* (g, c, p, L2) { const cs = g.p[p].gy.filter(x => isST(x) && /Morphtronic/.test(D(x).n)); if (cs.length) yield* tgt(g, p, L2, 'Add which Morphtronic Spell/Trap?', cs, 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} added ${D(t).n} to the hand.`); } } })] },
  'Gadget Driver': { effs: [{ type: 'quick', loc: 'hand', label: 'Discard: change Morphtronic positions',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && morphMon(x)),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent Gadget Driver to the GY.`); },
    target: function* (g, c, p, L2) { const cs = monsOf(g, p).filter(x => faceUp(x) && morphMon(x)); yield* tgt(g, p, L2, 'Change the position of which Morphtronic monsters?', cs, 1, cs.length, 'good'); },
    res: function* (g, c, p, L2) { for (const m of live(L2)) if (faceUp(m) && m.zone === 'm') toPos(g, m, m.pos === 'atk' ? 'def' : 'atk'); } }] },
  // Sending the Morphtronics is part of the effect (not a cost).
  'Gadget Hauler': { effs: [{ type: 'ign', opt: true, label: 'Send Morphtronics: gain 800 ATK each',
    cond: (g, c, p) => g.p[p].hand.some(morphMon),
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(morphMon); if (!cs.length) return;
      const xs = yield* pick(g, p, 'Send which Morphtronic monsters from your hand to the GY?', cs, 1, cs.length, 'cost'); let k = 0;
      for (const x of xs) { move(g, x, 'gy', { reason: 'effect', by: p }); if (x.zone === 'gy') k++; }
      if (xs.length) log(g, `${PN(g, p)} sent ${xs.map(x => D(x).n).join(', ')} to the GY.`);
      if (k && onField(c) && faceUp(c)) { addMod(g, c, { atk: 800 * k }); log(g, `${name(c)} gained ${800 * k} ATK.`); } } }] },
});
})();
