/* Full pool batch 34: Shien's Castle of Mist to Advance Force (build/batches/full/full-34.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, pay, search, takeControl, setFaceDown, addMod, equip, equippedTo,
  addCtr, ctr, negateAttack, addRule, tokens, tributeCands, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv,
  baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM, shuffleDeck, log, PN, live, opp, oppFaceUp, stOnField,
  evSummoned, battleKill, emit, forbid, isEHERO } = L;
const atk = L.atk;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
const isSixSam = x => isMon(x) && /Six Samurai/.test(name(x));
const otherSam = (g, c) => monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && isSixSam(x) && name(x) !== name(c));
const isSynchro = x => isMon(x) && D(x).k === 'synchro';
const isVolcanic = x => isMon(x) && /Volcanic/.test(D(x).n);
const isWorm = x => isMon(x) && /^Worm /.test(D(x).n) && race(x) === 'Reptile';
const isVenomMon = x => /Venom/.test(name(x));
const flip = (label, more) => ({ type: 'trig', mand: true, faceDownOk: true, label, on: (g, ev, c) => ev.type === 'flip' && ev.c === c, ...more });
const sentByBattle = (ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy';
function* tribute(g, p, xs, text) { const [x] = yield* pick(g, p, text, xs, 1, 1, 'cost'); if (!x) return null; move(g, x, "gy", { reason: "cost", by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); return x; }
function toBottom(g, x) { move(g, x, 'deckTop', { reason: 'effect' }); if (x.zone !== 'deck') return; const d = g.p[x.owner].deck; const i = d.indexOf(x); if (i >= 0) { d.splice(i, 1); d.unshift(x); } }
function* ssFrom(g, p, xs, text, pos = 'atk') { if (!xs.length || freeM(g, p) < 0) return null; const [x] = yield* pick(g, p, text, xs, 1, 1, 'good'); if (!x) return null; const fromDeck = x.zone === 'deck'; const ok = ss(g, p, x, pos); if (fromDeck) shuffleDeck(g, p); return ok ? x : null; }
// cards that "can't attack this turn" after using their effect
const noAtkSelf = { cantAttack: (g, c) => c.flags.f34noatk === g.turnNo };
const markNoAtk = function* (g, c) { c.flags.f34noatk = g.turnNo; };


/* Ongoing Level changes (Stygian Dirge -1 to the opponent's monsters, Synchro Boost +1 to the equipped monster).
 lv() has no ongoing hook, so the change is kept in flags.lv and refreshed on every game event (as batch-7 does for Scopen).
 PARTIAL: a change that happens without an event shows at the next event. */
const num = v => +v || 0;
function refreshLv(g) {
  const negd = L.negd || (() => false);
  for (const m of fieldMons(g)) {
    let d = 0;
    if (faceUp(m)) for (const P of g.p) for (const x of P.st) if (x && faceUp(x) && !negd(g, x)) {
      if (named(x, 'Stygian Dirge') && x.ctrl !== m.ctrl) d -= 1;
      if (named(x, 'Synchro Boost') && x.equipTo === m.u) d += 1;
    }
    const had = m.flags.f34lvd || 0;
    if (d === had) continue;
    const natural = (m.flags.lv || num(D(m).lv)) - had;
    m.flags.lv = (d === 0 && natural === num(D(m).lv)) ? null : Math.max(1, natural + d);
    m.flags.f34lvd = d;
  }
}
const lvWatch = { type: 'trig', loc: 'any', on: (g, ev, c) => { if (c.f34lvSeen !== g.seq) { c.f34lvSeen = g.seq; refreshLv(g); } return false; }, res: noop };

/* Venom Counters. With a face-up Venom Swamp, a monster whose ATK falls to 0 from the counters is destroyed (checked by the
 cards of this file whenever they place counters). */
const swampUp = g => allField(g).some(x => faceUp(x) && named(x, 'Venom Swamp'));
function venom(g, xs, n, by) {
  const dead = [];
  for (const x of xs) { if (!onField(x) || x.zone !== 'm') continue; const pre = atk(g, x); addCtr(g, x, 'venom', n); log(g, `${n > 1 ? n + ' Venom Counters were' : 'A Venom Counter was'} placed on ${name(x) && faceUp(x) ? name(x) : 'a face-down monster'}.`);
    if (swampUp(g) && faceUp(x) && pre > 0 && atk(g, x) === 0) dead.push(x); }
  if (dead.length) destroy(g, dead, { by });
}
const venomIgn = (n, noAtk) => ({ type: 'ign', opt: true, label: `Place ${n} Venom Counter${n > 1 ? 's' : ''}`,
  cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
  cost: noAtk ? markNoAtk : undefined,
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, `Place ${n} Venom Counter${n > 1 ? 's' : ''} on which monster?`, monsOf(g, opp(p)), 1, 1, 'bad'); },
  res: function* (g, c, p, L2) { venom(g, live(L2), n, p); } });

/* Synchro Summons with material rules the engine's reader doesn't know (as full-29.js).
 PARTIAL: Synchro Summoned with its own rule, always in Attack Position. */
function synMats(g, p, sx, o) {
  const mons = monsOf(g, p).filter(c => faceUp(c));
  const Lv = lv(sx), out = [], n = mons.length;
  for (let mask = 1; mask < (1 << n) && out.length < 12; mask++) {
    const mats = mons.filter((_, i) => mask & (1 << i)); if (mats.length < 2) continue;
    if (mats.reduce((s, c) => s + lv(c), 0) !== Lv) continue;
    if (mats.some(t => D(t).tu && o.tuner(t) && mats.filter(x => x !== t).every(x => !D(x).tu))) out.push(mats);
  }
  return out;
}
const synProc = o => ({ extra: true, how: 'synchro', label: 'Synchro Summon',
  cond: (g, c, p) => synMats(g, p, c, o).length > 0,
  cost: function* (g, c, p, grp) { const cs = synMats(g, p, c, o); let mats = cs[0];
    if (cs.length > 1) { const i = yield* choose(g, p, `Synchro Summon ${name(c)} with which monsters?`, cs.map(m => m.map(name).join(' + '))); mats = cs[i]; }
    for (const m of mats) move(g, m, 'gy', { reason: 'synchro', by: p, group: grp });
    log(g, `${PN(g, p)} sent ${mats.map(m => D(m).n).join(' + ')} to the GY for a Synchro Summon.`); } });

/* Summon limits, as one duel rule (as full-38.js). ENGINE: no general "can't be Special Summoned" flag.
 "Must be Special Summoned by ..." is read like this: the proc or the card that summons it marks it for that one check. */
const procOk = (g, c) => g.f34proc && g.f34proc.u === c.u && g.f34proc.seq === g.seq;
const markProc = (g, c) => { g.f34proc = { u: c.u, seq: g.seq }; return true; };
const LOCKS = {
  // once properly summoned, it can be revived from the GY (ruling)
  'Volcanic Doomfire': (g, a) => a.type === 'ss' && !procOk(g, a.c) && !(a.c.zone === 'gy' && a.c.f34nomi),
  'Volcanic Queen': (g, a) => a.type === 'ss' && !procOk(g, a.c) && !(a.c.zone === 'gy' && a.c.f34nomi),
  'Worm Erokin': (g, a) => a.type === 'ss',
  'Yubel - Terror Incarnate': (g, a) => a.type === 'ss' && !a.c.f34ok,
  'Yubel - The Ultimate Nightmare': (g, a) => a.type === 'ss' && !a.c.f34ok,
};
function installRules(g) {
  if (g.f34rules) return; g.f34rules = true;
  addRule(g, (g2, a) => { if (!a.c || a.c.id == null) return false; const d = D(a.c), f = d && LOCKS[d.n]; return !!f && f(g2, a); });
}

/* One recorder for the whole file (a trigger that never fires, deduped by event): the Summons each player made this turn
 (Summon Limit), Synchro Material counts (Synchro Strike), Elemental HEROes destroyed by battle (Skyscraper 2), Normal Summons
 (Turbo Booster), monsters that battled (Turbo Booster), attack targets (Stealth Union), Synchro Control's return. */
function record(g, ev) {
  installRules(g);
  if (g.f34seq === ev.seq) return; g.f34seq = ev.seq;
  if (!g.f34sl || g.f34sl.turn !== g.turnNo) g.f34sl = { turn: g.turnNo, s: [[], []] };
  const addSum = (p, grp) => { const s = g.f34sl.s[p]; if (!s.includes(grp)) s.push(grp); };
  if (ev.type === 'move') {
    if (ev.to === 'gy') ev.c.f34hc = !!(ev.battle && ev.destroyed && /^Elemental HERO/.test(D(ev.c).n));
    if (ev.to === 'm' && ev.reason === 'summon') addSum(ev.ctrl != null ? ev.ctrl : ev.c.ctrl, ev.group);
    if (ev.reason === 'synchro') g.f34sm = g.f34sm && g.f34sm.group === ev.group ? { group: ev.group, n: g.f34sm.n + 1 } : { group: ev.group, n: 1 };
  }
  if (ev.type === 'summon') {
    if (ev.how === 'flip') addSum(ev.p, ev.group);
    if (ev.how === 'synchro' && g.f34sm && g.f34sm.group === ev.group) for (const x of ev.cs) if (onField(x)) x.flags.f34mats = g.f34sm.n;
    if (ev.how === 'normal' || ev.how === 'tribute') { g.f34ns = g.f34ns || [-1, -1]; g.f34ns[ev.p] = g.turnNo; }
  }
  if (ev.type === 'afterCalc' && ev.t) { ev.a.f34bt = { turn: g.turnNo, vs: ev.t.ctrl }; ev.t.f34bt = { turn: g.turnNo, vs: ev.a.ctrl }; }
  if (ev.type === 'attack' && ev.t) { const h = ev.a.f34hit; if (h && h.turn === g.turnNo) h.us.push(ev.t.u); else ev.a.f34hit = { turn: g.turnNo, us: [ev.t.u] }; }
  if (ev.type === 'phase' && ev.ph === 'end') for (const m of fieldMons(g)) { const s = m.flags.f34sc; if (s && s.turn === g.turnNo) { m.flags.ctrlUntil = g.turnNo; m.flags.ctrlFrom = s.back; m.flags.f34sc = null; } }
}
const REC = { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { record(g, ev); return false; } };
const sumCount = (g, p) => g.f34sl && g.f34sl.turn === g.turnNo ? g.f34sl.s[p] : [];

/* Six Samurai "destroy another face-up Six Samurai monster you control instead".
 PARTIAL: no prompt: it is always used when it can be, and destroys your lowest-ATK other face-up Six Samurai. */
let SUB = 0;
const samReplace = (g, c) => {
  if (SUB) return false;
  const xs = monsOf(g, c.ctrl).filter(x => x !== c && faceUp(x) && isSixSam(x)).sort((a, b) => atk(g, a) - atk(g, b)); if (!xs.length) return false;
  log(g, `${PN(g, c.ctrl)} destroyed ${name(xs[0])} instead of ${name(c)}.`);
  SUB++; try { destroy(g, [xs[0]], { by: c.ctrl, rule: true }); } finally { SUB--; }
  return true;
};

/* Yubel: the forms are summoned with a mark the lock lets through. */
function* yubelNext(g, p, n) {
  const xs = [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].filter(x => named(x, n)); if (!xs.length || freeM(g, p) < 0) return;
  const [x] = yield* pick(g, p, `Special Summon which ${n}?`, xs, 1, 1, 'good'); if (!x) return;
  const fromDeck = x.zone === 'deck'; x.f34ok = true; try { ss(g, p, x, 'atk'); } finally { x.f34ok = false; } if (fromDeck) shuffleDeck(g, p);
}
const yubelSelf = { noBattleDestroy: true, noBattleDamage: true };
const yubelBurn = { type: 'trig', mand: true, label: 'Inflict damage equal to the attacker’s ATK',
  on: (g, ev, c) => ev.type === 'dsStart' && ev.t === c && c.pos === 'atk' && !!ev.a && ev.a.ctrl !== c.ctrl,
  res: function* (g, c, p, L2) { const a = L2.ev.a; if (a && onField(a)) damage(g, opp(p), atk(g, a), { src: c, srcP: p }); } };

/* Stealth Union */
const suEquips = (g, c) => stOf(g, c.ctrl).filter(x => x.equipTo === c.u && isMon(x) && x.f34su === c.u);
const suHits = (g, c) => c.f34hit && c.f34hit.turn === g.turnNo ? c.f34hit.us : [];

E.addScripts({
  /* ----- Six Samurai ----- */
  // During the Damage Step of an attack on a Six Samurai (the closest moment the engine has to damage calculation).
  "Shien's Castle of Mist": { effs: [actNoop],
    cont: { atk: (g, src, m) => g.inDS && g.battle && g.battle.a === m && g.battle.t && faceUp(g.battle.t) && isSixSam(g.battle.t) ? -500 : 0 } },
  "Shien's Footsoldier": { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon a Level 3 or lower Six Samurai',
    on: (g, ev, c) => sentByBattle(ev, c),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isSixSam(x) && lv(x) <= 3 && canSS(g, p, x)),
    res: function* (g, c, p) { yield* ssFrom(g, p, g.p[p].deck.filter(x => isSixSam(x) && lv(x) <= 3 && canSS(g, p, x)), 'Special Summon which Six Samurai from your Deck?'); } }] },
  // PARTIAL: a monster turned face-down loses the return (setFaceDown clears its flags).
  "Shien's Spy": { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(faceUp) && freeM(g, opp(p)) >= 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Give control of which face-up monster?', monsOf(g, p).filter(faceUp), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.ctrl === p) takeControl(g, opp(p), t, true); } }] },
  "The Six Samurai - Nisashi": { self: { maxAttacks: (g, c) => otherSam(g, c) ? 2 : (c.flags.extraAttack === g.turnNo ? 2 : 1), replaceDestroy: samReplace }, effs: [] },
  "The Six Samurai - Yariza": { self: { directAttack: (g, c) => otherSam(g, c), replaceDestroy: samReplace }, effs: [] },
  // No chain: at the end of the Damage Step of the first battle of your Six Samurai each turn.
  "Swift Samurai Storm!": { effs: [actNoop,
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
      if (ev.type !== 'dsEnd' || c.f34storm === g.turnNo) return false;
      if (![ev.a, ev.t].some(x => x && onField(x) && x.ctrl === c.ctrl && isSixSam(x))) return false;
      c.f34storm = g.turnNo; const xs = monsOf(g, c.ctrl).filter(x => faceUp(x) && isSixSam(x));
      for (const x of xs) addMod(g, x, { atk: 300, end: true }); g.seq++;
      if (xs.length) log(g, `${PN(g, c.ctrl)}'s Six Samurai monsters gained 300 ATK (Swift Samurai Storm!).`); return false; } }] },

  /* ----- Elemental HERO ----- */
  'Skyscraper 2 - Hero City': { effs: [actNoop, REC,
    { type: 'ign', loc: 'fz', opt: true, tags: { ss: 1 }, label: 'Special Summon an Elemental HERO destroyed by battle',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => x.f34hc && isMon(x) && canSS(g, p, x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Elemental HERO?', g.p[p].gy.filter(x => x.f34hc && isMon(x) && canSS(g, p, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && t.f34hc) ss(g, p, t, 'atk'); } }] },

  /* ----- Spiritual Arts ----- */
  'Spiritual Earth Art - Kurogane': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => attr(x) === 'EARTH') && g.p[p].gy.some(x => isMon(x) && attr(x) === 'EARTH' && lv(x) <= 4 && canSS(g, p, x)),
    cost: function* (g, c, p, L2) { L2.data.tr = yield* tribute(g, p, monsOf(g, p).filter(x => attr(x) === 'EARTH'), 'Tribute which EARTH monster?'); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Level 4 or lower EARTH monster?', g.p[p].gy.filter(x => x !== L2.data.tr && isMon(x) && attr(x) === 'EARTH' && lv(x) <= 4 && canSS(g, p, x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  'Spiritual Fire Art - Kurenai': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => attr(x) === 'FIRE'),
    cost: function* (g, c, p, L2) { const x = yield* tribute(g, p, monsOf(g, p).filter(x => attr(x) === 'FIRE'), 'Tribute which FIRE monster?'); L2.data.n = x ? baseAtk(x) : 0; },
    res: function* (g, c, p, L2) { damage(g, opp(p), L2.data.n, { src: c, srcP: p }); } }] },
  'Spiritual Wind Art - Miyabi': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => attr(x) === 'WIND') && fieldOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { yield* tribute(g, p, monsOf(g, p).filter(x => attr(x) === 'WIND'), 'Tribute which WIND monster?'); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Place which card on the bottom of the Deck?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; const n = D(t).n; toBottom(g, t); log(g, `${n} was placed on the bottom of the Deck.`); } }] },

  /* ----- Stygian ----- */
  'Stygian Dirge': { effs: [{ type: 'act', res: function* (g) { refreshLv(g); } }, lvWatch] },
  'Stygian Security': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon a Level 1 Fiend from your Deck',
    on: (g, ev, c) => sentByBattle(ev, c),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && race(x) === 'Fiend' && lv(x) === 1 && canSS(g, p, x)),
    res: function* (g, c, p) { yield* ssFrom(g, p, g.p[p].deck.filter(x => isMon(x) && race(x) === 'Fiend' && lv(x) === 1 && canSS(g, p, x)), 'Special Summon which Level 1 Fiend?'); } }] },
  // 1 Fiend Tuner + 1 or more non-Tuners. The 800 ATK lasts for this Battle Phase; each use gives one more attack.
  'Stygian Sergeants': { noSynchro: true, proc: synProc({ tuner: t => race(t) === 'Fiend' }),
    effs: [{ type: 'trig', label: 'Gain 800 ATK and attack again', on: (g, ev, c) => battleKill(ev, c) && ev.c.owner !== c.ctrl,
      res: function* (g, c) { if (!onField(c) || !faceUp(c)) return; addMod(g, c, { atk: 800, end: true, f34sg: true }); c.flags.maxAttacks = c.attacks + 1; c.flags.maxAttacksTurn = g.turnNo; g.seq++;
        log(g, 'Stygian Sergeants gained 800 ATK and can attack again.'); } },
    { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'bpEnd' && c.mods.some(m => m.f34sg)) { c.mods = c.mods.filter(m => !m.f34sg); g.seq++; } return false; } }] },

  /* ----- Summon cards ----- */
  // Doesn't target; from the GY it destroys itself after the summon.
  'Summon Cloud': { effs: [actNoop,
    { type: 'ign', loc: 'st', opt: true, tags: { ss: 1 }, label: 'Special Summon a Cloudian',
      cond: (g, c, p) => monsOf(g, p).length === 0 && freeM(g, p) >= 0 && cloudCands(g, p).length > 0,
      res: function* (g, c, p) { if (!onField(c) || monsOf(g, p).length) return; const xs = cloudCands(g, p); if (!xs.length) return;
        const [x] = yield* pick(g, p, 'Special Summon which Cloudian?', xs, 1, 1, 'good'); if (!x) return; const fromGY = x.zone === 'gy';
        if (ss(g, p, x, 'atk') && fromGY && onField(c)) destroy(g, [c], { by: p }); } }] },
  // Counts every Summon this turn (one per summon event; negated Normal/Special Summons count).
  // ENGINE: Flip Summons can't be forbidden, so a third Flip Summon still happens (it is counted).
  'Summon Limit': { effs: [actNoop, REC],
    cont: { forbid: (g, src, a) => (a.type === 'ns' || a.type === 'ss') && a.p != null && sumCount(g, a.p).length >= 2 && !sumCount(g, a.p).includes(g.group) } },
  // ① first Summon to the opponent's field each turn: 800. ② after ① this turn: negate an opponent's attack.
  // ③ PARTIAL: Flying Fortress SKY FIRE from the GY is refused by its own lock (full-38.js).
  'Summon Reactor SK': { effs: [
    { type: 'trig', mand: true, label: 'Inflict 800 damage', on: (g, ev, c) => {
      if (ev.type !== 'summon' || !ev.cs.some(x => onField(x) && x.ctrl !== c.ctrl) || ev.cs.includes(c)) return false;
      if (c.f34sk === g.turnNo) return false; c.f34sk = g.turnNo; return true; },
      res: function* (g, c, p) { c.f34ska = g.turnNo; damage(g, opp(p), 800, { src: c, srcP: p }); } },
    { type: 'trig', label: 'Negate the attack', on: (g, ev, c) => ev.type === 'attack' && ev.a.ctrl !== c.ctrl && c.f34ska === g.turnNo,
      target: function* (g, c, p, L2) { L2.t = g.aw && g.aw.a ? [g.aw.a] : []; },
      res: function* (g, c, p, L2) { const a = live(L2)[0]; if (a && g.aw && g.aw.a === a) negateAttack(g); } },
    { type: 'ign', tags: { ss: 1 }, label: 'Send the 3 Reactors: Special Summon SKY FIRE',
      cond: (g, c, p) => ['Trap Reactor Y FI', 'Spell Reactor RE'].every(n => monsOf(g, p).some(x => faceUp(x) && named(x, n))) && skyCands(g, p).length > 0,
      cost: function* (g, c, p) { const xs = [c, ...['Trap Reactor Y FI', 'Spell Reactor RE'].map(n => monsOf(g, p).find(x => faceUp(x) && named(x, n)))];
        for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${xs.map(x => D(x).n).join(', ')} to the GY.`); },
      res: function* (g, c, p) { yield* ssFrom(g, p, skyCands(g, p), 'Special Summon which Flying Fortress SKY FIRE?'); } }] },

  /* ----- Fusion and Synchro ----- */
  // Equips a face-up non-Machine monster (once per turn). While it has one: it can attack each opponent's monster once,
  // its original ATK is halved while it attacks, and it inflicts piercing damage.
  'Super Vehicroid - Stealth Union': {
    self: { piercing: true,
      atk: (g, c) => (g.battle && g.battle.a === c) || (g.aw && g.aw.a === c) ? -Math.floor(baseAtk(c) / 2) : 0,
      maxAttacks: (g, c) => { const base = c.flags.extraAttack === g.turnNo ? 2 : 1; if (!suEquips(g, c).length) return base;
        const hit = suHits(g, c); const left = monsOf(g, opp(c.ctrl)).filter(t => !hit.includes(t.u)).length;
        return left > 0 || c.attacks === 0 ? c.attacks + 1 : c.attacks; },
      attackOk: (g, c, t) => !suEquips(g, c).length || !suHits(g, c).includes(t.u) },
    effs: [REC, { type: 'ign', opt: true, label: 'Equip a non-Machine monster',
      cond: (g, c, p) => freeST(g, p) >= 0 && fieldMons(g).some(x => x !== c && faceUp(x) && race(x) !== 'Machine'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip which face-up non-Machine monster?', fieldMons(g).filter(x => x !== c && faceUp(x) && race(x) !== 'Machine'), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || race(t) === 'Machine' || !onField(c) || !faceUp(c) || freeST(g, p) < 0) return;
        move(g, t, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p }); t.equipTo = c.u; t.f34su = c.u; log(g, `${D(t).n} was equipped to Super Vehicroid - Stealth Union.`); } }] },
  'Turbo Cannon': { noSynchro: true, proc: synProc({ tuner: t => D(t).n === 'Turbo Rocket' }),
    effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy a monster: half its ATK as damage',
      cond: g => fieldMons(g).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const n = Math.floor(atk(g, t) / 2), who = t.ctrl;
        if (destroy(g, [t], { by: p }).length && n > 0) damage(g, who, n, { src: c, srcP: p }); } }] },

  /* ----- Synchro support ----- */
  // You take no damage until the End Phase of the next turn (read from the GY, where the card is once used).
  // PARTIAL: if every Synchro Barrier leaves the GY, the effect stops.
  'Synchro Barrier': { cont: { loc: 'gy', dmg: (g, src, p) => g.f34bar && g.f34bar[p] != null && g.turnNo <= g.f34bar[p] ? 0 : undefined },
    effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(isSynchro),
      cost: function* (g, c, p) { yield* tribute(g, p, monsOf(g, p).filter(isSynchro), 'Tribute which Synchro Monster?'); },
      res: function* (g, c, p) { (g.f34bar || (g.f34bar = {}))[p] = g.turnNo + 1; log(g, `${PN(g, p)} takes no damage until the End Phase of the next turn.`); } }] },
  'Synchro Blast Wave': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isSynchro(x)) && monsOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Synchro Boost': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 500 : 0 },
    effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c)) equip(g, c, t); } }, lvWatch] },
  // Banishing the Synchro Monster is the cost; the new one has its effects negated.
  'Synchro Change': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isSynchro(x) && g.p[p].extra.some(y => isSynchro(y) && lv(y) === lv(x) && canSS(g, p, y))),
    cost: function* (g, c, p, L2) { const xs = monsOf(g, p).filter(x => faceUp(x) && isSynchro(x) && g.p[p].extra.some(y => isSynchro(y) && lv(y) === lv(x) && canSS(g, p, y)));
      const [x] = yield* pick(g, p, 'Banish which face-up Synchro Monster?', xs, 1, 1, 'cost'); L2.data.lv = lv(x); move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${D(x).n}.`); },
    res: function* (g, c, p, L2) { const xs = g.p[p].extra.filter(y => isSynchro(y) && lv(y) === L2.data.lv && canSS(g, p, y)); if (!xs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which Synchro Monster?', xs, 1, 1, 'good'); if (x && ss(g, p, x, 'atk', { negate: true })) log(g, `${name(x)}'s effects are negated.`); } }] },
  // Until the End Phase of your turn: on the opponent's turn the monster stays until your next End Phase.
  'Synchro Control': { effs: [REC, { type: 'act',
    cond: (g, c, p) => !monsOf(g, p).some(isSynchro) && !g.p[p].gy.some(isSynchro) && g.p[p].lp > 1000 && freeM(g, p) >= 0 && oppFaceUp(g, p).some(isSynchro),
    cost: function* (g, c, p) { pay(g, p, 1000); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which Synchro Monster?', oppFaceUp(g, p).filter(isSynchro), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || t.ctrl === p) return; const mine = g.tp === p;
      if (takeControl(g, p, t, mine) && !mine) t.flags.f34sc = { turn: g.turnNo + 1, back: opp(p) }; } }] },
  'Synchro Deflector': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.aw && !!g.aw.t && g.aw.a.ctrl !== p && g.aw.t.ctrl === p && faceUp(g.aw.t) && isSynchro(g.aw.t) && monsOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { negateAttack(g); destroy(g, live(L2), { by: p, src: c }); } }] },
  // Only a monster that was Synchro Summoned and stayed face-up since (the count is noted when it is Synchro Summoned).
  'Synchro Strike': { effs: [REC, { type: 'act',
    cond: g => fieldMons(g).some(x => faceUp(x) && x.summonType === 'synchro' && x.flags.f34mats > 0),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Synchro Summoned monster gains ATK?', fieldMons(g).filter(x => faceUp(x) && x.summonType === 'synchro' && x.flags.f34mats > 0), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !t.flags.f34mats) return; const n = 500 * t.flags.f34mats;
      addMod(g, t, { atk: n, end: true }); g.seq++; log(g, `${name(t)} gained ${n} ATK.`); } }] },

  /* ----- Turbo ----- */
  'Turbo Booster': {
    proc: { label: 'Special Summon (you Normal Summoned this turn)', cond: (g, c, p) => !!g.f34ns && g.f34ns[p] === g.turnNo },
    effs: [REC, { type: 'ign', tags: { destroy: 1 }, label: 'Tribute: destroy a monster that battled',
      cond: (g, c, p) => monsOf(g, opp(p)).some(x => x.f34bt && x.f34bt.turn === g.turnNo && x.f34bt.vs === p),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Turbo Booster.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', monsOf(g, opp(p)).filter(x => x.f34bt && x.f34bt.turn === g.turnNo && x.f34bt.vs === p), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  'Turbo Rocket': { self: { noBattleDestroy: (g, c) => !!g.battle && g.battle.a === c },
    effs: [{ type: 'trig', mand: true, label: 'Damage equal to half the target’s ATK', on: (g, ev, c) => ev.type === 'afterCalc' && ev.a === c && !!ev.t,
      res: function* (g, c, p, L2) { const t = L2.ev.t; const n = Math.floor(atk(g, t) / 2); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  'Turbo Synchron': { effs: [
    { type: 'trig', when: true, label: 'Change the attack target to Defense Position', on: (g, ev, c) => ev.type === 'attack' && ev.a === c && !!ev.t,
      cond: (g, c, p, x) => onField(x.ev.t) && x.ev.t.pos === 'atk',
      res: function* (g, c, p, L2) { const t = L2.ev.t; if (!onField(t) || t.pos !== 'atk') return; t.pos = 'def'; g.seq++; log(g, `${name(t)} was changed to Defense Position.`); emit(g, { type: 'pos', c: t, p: t.ctrl, from: 'atk' }); } },
    { type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon a monster from your hand',
      on: (g, ev, c) => { if (!(ev.type === 'damage' && ev.battle && ev.p === c.ctrl && g.battle && g.battle.a === c)) return false; c.f34dmg = ev.n; return true; },
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && D(x).k !== 'ritual' && baseAtk(x) <= (c.f34dmg || 0) && canSS(g, p, x)),
      res: function* (g, c, p) { yield* ssFrom(g, p, g.p[p].hand.filter(x => isMon(x) && D(x).k !== 'ritual' && baseAtk(x) <= (c.f34dmg || 0) && canSS(g, p, x)), 'Special Summon which monster from your hand?'); } }] },

  /* ----- Venom ----- */
  'Venom Boa': { self: noAtkSelf, effs: [venomIgn(2, true)] },
  'Venom Burn': { effs: [{ type: 'act',
    cond: g => fieldMons(g).some(x => ctr(x, 'venom') > 0),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Remove the Venom Counters from which monster?', fieldMons(g).filter(x => ctr(x, 'venom') > 0), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; const n = ctr(t, 'venom'); if (!n) return; addCtr(g, t, 'venom', -n); g.seq++;
      log(g, `${n} Venom Counter${n > 1 ? 's were' : ' was'} removed.`); damage(g, opp(p), 700 * n, { src: c, srcP: p }); } }] },
  'Venom Serpent': { effs: [venomIgn(1, false)] },
  'Venom Shot': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && (/^Venom/.test(name(x)) || ['Vennominaga the Deity of Poisonous Snakes', 'Vennominon the King of Poisonous Snakes'].includes(name(x))))
      && g.p[p].deck.some(x => isMon(x) && race(x) === 'Reptile') && oppFaceUp(g, p).length > 0,
    res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && race(x) === 'Reptile', 'Send which Reptile from your Deck to the GY?', 'gy');
      const xs = oppFaceUp(g, p); if (!xs.length) return; const [x] = yield* pick(g, p, 'Place 2 Venom Counters on which face-up monster?', xs, 1, 1, 'bad'); if (x) venom(g, [x], 2, p); } }] },
  'Venom Snake': { self: noAtkSelf, effs: [venomIgn(1, true)] },
  'Venom Swamp': { cont: { atk: (g, src, m) => -500 * ctr(m, 'venom') },
    effs: [actNoop, { type: 'trig', loc: 'fz', mand: true, label: 'Place a Venom Counter on each face-up monster',
      on: (g, ev) => ev.type === 'phase' && ev.ph === 'end',
      cond: g => fieldMons(g).some(x => faceUp(x) && !isVenomMon(x)),
      res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; venom(g, fieldMons(g).filter(x => faceUp(x) && !isVenomMon(x)), 1, p); } }] },

  /* ----- Volcanic ----- */
  'Volcanic Blaster': { effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Place a Volcanic monster on top of your Deck',
    on: (g, ev, c) => sentByBattle(ev, c), cond: (g, c, p) => g.p[p].deck.some(isVolcanic),
    res: function* (g, c, p) { const xs = g.p[p].deck.filter(isVolcanic); if (!xs.length) return; const [x] = yield* pick(g, p, 'Place which Volcanic monster on top of your Deck?', xs, 1, 1, 'good'); if (!x) return;
      shuffleDeck(g, p); const d = g.p[p].deck; d.splice(d.indexOf(x), 1); d.push(x); log(g, `${PN(g, p)} placed a Volcanic monster on top of the Deck.`); } }] },
  // ENGINE: no forced attacks (the opponent's monsters must attack it).
  'Volcanic Doomfire': {
    proc: { label: 'Special Summon (send Tri-Blaze Accelerator)', cond: (g, c, p) => stOf(g, p).some(x => faceUp(x) && named(x, 'Tri-Blaze Accelerator')) && markProc(g, c),
      cost: function* (g, c, p, grp) { const x = stOf(g, p).find(y => faceUp(y) && named(y, 'Tri-Blaze Accelerator')); if (x) { move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} sent Tri-Blaze Accelerator to the GY.`); } c.f34nomi = true; } },
    effs: [REC, { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy all their monsters: 500 each', on: (g, ev, c) => battleKill(ev, c),
      res: function* (g, c, p) { const xs = destroy(g, monsOf(g, opp(p)), { by: p }); if (xs.length) damage(g, opp(p), 500 * xs.length, { src: c, srcP: p }); } }] },
  'Volcanic Eruption': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.tp === p && g.phase === 'end' && stOf(g, p).some(x => faceUp(x) && named(x, 'Jurassic World')),
    res: function* (g, c, p) { destroy(g, allField(g).filter(x => x !== c), { by: p, src: c }); } }] },
  'Volcanic Hammerer': { self: noAtkSelf, effs: [{ type: 'ign', opt: true, label: '200 damage per Volcanic in your GY', cost: markNoAtk,
    cond: (g, c, p) => g.p[p].gy.some(isVolcanic),
    res: function* (g, c, p) { const n = 200 * g.p[p].gy.filter(isVolcanic).length; if (n) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  // Special Summoned from the hand to the opponent's field by Tributing 1 of their monsters (as Lava Golem in full-10.js).
  'Volcanic Queen': {
    proc: { label: 'Special Summon to their field (Tribute 1 of their monsters)', cond: (g, c, p) => monsOf(g, opp(p)).length >= 1 && g.ns[p] < 1 && markProc(g, c),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Tribute 1 monster your opponent controls', monsOf(g, opp(p)), 1, 1, 'bad'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); }
        c.flags.f34to = opp(p); c.f34nomi = true; addRule(g, (g2, a) => (a.type === 'ns' || a.type === 'set') && a.p === p, { end: g.turnNo }); } },
    effs: [REC,
      { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.to === 'm' && c.flags.f34to != null) { const to = c.flags.f34to; c.flags.f34to = null; if (c.ctrl !== to) takeControl(g, to, c, false); } return false; } },
      { type: 'ign', opt: true, label: 'Send a card: 1000 damage', cond: (g, c, p) => fieldOf(g, p).some(x => x !== c),
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which other card you control to the GY?', fieldOf(g, p).filter(x => x !== c), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
        res: function* (g, c, p) { damage(g, opp(p), 1000, { src: c, srcP: p }); } },
      { type: 'trig', mand: true, label: 'Tribute a monster or take 1000 damage', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
        res: function* (g, c, p) { const xs = monsOf(g, p).filter(x => x !== c);
          if (xs.length && (yield* choose(g, p, 'Volcanic Queen: Tribute 1 other monster or take 1000 damage?', ['Tribute 1 other monster', 'Take 1000 damage'])) === 0) {
            const [x] = yield* pick(g, p, 'Tribute which monster?', xs, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); return; } }
          damage(g, p, 1000, { src: c, srcP: p }); } }] },
  'Volcanic Recharge': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.some(isVolcanic),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return up to 3 Volcanic monsters to your Deck', g.p[p].gy.filter(isVolcanic), 1, 3, 'good'); },
    res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'deck', { reason: 'effect', by: p }); if (xs.length) log(g, `${PN(g, p)} shuffled ${xs.map(x => D(x).n).join(', ')} into the Deck.`); } }] },
  // ① has no activation when it is sent from the hand by a Blaze Accelerator card (ruling).
  'Volcanic Scattershot': { effs: [
    { type: 'trig', loc: 'gy', mand: true, label: 'Inflict 500 damage', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && !(ev.from === 'hand' && byBlaze(g, ev)),
      res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } },
    { type: 'trig', loc: 'gy', tags: { destroy: 1 }, label: 'Send 2 Volcanic Scattershot: destroy all their monsters',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && byBlaze(g, ev),
      cond: (g, c, p) => [...g.p[p].hand, ...g.p[p].deck].filter(x => x !== c && named(x, 'Volcanic Scattershot')).length >= 2,
      cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Send 2 Volcanic Scattershot from your hand or Deck to the GY', [...g.p[p].hand, ...g.p[p].deck].filter(x => x !== c && named(x, 'Volcanic Scattershot')), 2, 2, 'cost');
        const deck = xs.some(x => x.zone === 'deck'); for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p }); if (deck) shuffleDeck(g, p); log(g, `${PN(g, p)} sent 2 Volcanic Scattershot to the GY.`); },
      res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)), { by: p }); } }] },
  'Volcanic Slicer': { self: noAtkSelf, effs: [{ type: 'ign', opt: true, label: 'Inflict 500 damage', cost: markNoAtk,
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },

  /* ----- Worm ----- */
  'Worm Apocalypse': { effs: [flip('Destroy a Spell/Trap', { tags: { destroy: 1 }, cond: g => stOnField(g).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap Card?', stOnField(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } })] },
  'Worm Bait': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Insect') && nFreeM(g, p) >= 2,
    res: function* (g, c, p) { addRule(g, (g2, a) => (a.type === 'ns' || a.type === 'ss') && a.p === p && a.c && [3, 4].includes(lv(a.c)), { end: g.turnNo });
      if (nFreeM(g, p) < 2) return; tokens(g, p, { n: 'Worm Token', a: 'EARTH', r: 'Insect', lv: 1, atk: 0, def: 0 }, 2, 'def'); } }] },
  'Worm Barses': { effs: [{ type: 'trig', mand: true, label: 'Change a Defense Position monster to Attack Position',
    on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']), cond: g => fieldMons(g).some(x => x.pos !== 'atk'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change which Defense Position monster to Attack Position?', fieldMons(g).filter(x => x.pos !== 'atk'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.zone !== 'm' || t.pos === 'atk') return; const wasSet = t.pos === 'set';
      t.pos = 'atk'; g.seq++; log(g, `${name(t)} was changed to Attack Position.`); emit(g, { type: 'pos', c: t, p: t.ctrl, from: wasSet ? 'set' : 'def' }); if (wasSet) emit(g, { type: 'flip', c: t, p: t.ctrl }); } }] },
  'Worm Cartaros': { effs: [flip('Add a Level 4 or lower Reptile Worm', { cond: (g, c, p) => g.p[p].deck.some(x => isWorm(x) && lv(x) <= 4),
    res: function* (g, c, p) { yield* search(g, p, x => isWorm(x) && lv(x) <= 4, 'Add which Level 4 or lower Reptile Worm monster?'); } })] },
  'Worm Dimikles': { effs: [flip('Gain 300 ATK and DEF', { res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 300, def: 300 }); g.seq++; log(g, 'Worm Dimikles gained 300 ATK and DEF.'); } } })] },
  'Worm Erokin': { effs: [REC, { type: 'ign', opt: true, label: 'Change a Reptile Worm to face-down Defense',
    cond: g => fieldMons(g).some(x => faceUp(x) && isWorm(x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change which Reptile Worm to face-down Defense Position?', fieldMons(g).filter(x => faceUp(x) && isWorm(x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.zone === 'm') setFaceDown(g, t); } }] },

  /* ----- Yubel ----- */
  'Yubel': { self: yubelSelf, effs: [REC, yubelBurn,
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Tribute 1 other monster or destroy Yubel', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; const xs = monsOf(g, p).filter(x => x !== c);
        if (xs.length && (yield* choose(g, p, 'Yubel: Tribute 1 other monster or destroy Yubel?', ['Tribute 1 other monster', 'Destroy Yubel'])) === 0) {
          const [x] = yield* pick(g, p, 'Tribute which monster?', xs, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); return; } }
        c.f34selfd = true; try { destroy(g, [c], { by: p }); } finally { c.f34selfd = false; } } },
    { type: 'trig', loc: 'any', when: true, tags: { ss: 1 }, label: 'Special Summon Yubel - Terror Incarnate',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && !!ev.destroyed && !c.f34selfd,
      cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].some(x => named(x, 'Yubel - Terror Incarnate')),
      res: function* (g, c, p) { yield* yubelNext(g, p, 'Yubel - Terror Incarnate'); } }] },
  'Yubel - Terror Incarnate': { self: yubelSelf, effs: [REC, yubelBurn,
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy all other monsters', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      cond: (g, c) => fieldMons(g).some(x => x !== c),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x !== c), { by: p }); } },
    { type: 'trig', loc: 'any', when: true, tags: { ss: 1 }, label: 'Special Summon Yubel - The Ultimate Nightmare',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && !!ev.snap && ev.snap.faceUp && !['deck', 'deckTop'].includes(ev.to),
      cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].some(x => named(x, 'Yubel - The Ultimate Nightmare')),
      res: function* (g, c, p) { yield* yubelNext(g, p, 'Yubel - The Ultimate Nightmare'); } }] },
  'Yubel - The Ultimate Nightmare': { self: yubelSelf, effs: [REC,
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Damage equal to its ATK, and destroy it',
      on: (g, ev, c) => { if (ev.type !== 'dsEnd' || !(ev.a === c || ev.t === c) || c.pos !== 'atk') return false; const o = ev.a === c ? ev.t : ev.a; return !!o && o.owner !== c.ctrl; },
      res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; if (!o) return; const n = atk(g, o);
        if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); if (onField(o) && o.zone === 'm') destroy(g, [o], { by: p }); } }] },

  /* ----- A ----- */
  'Abaki': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Both players take 500 damage', on: (g, ev, c) => sentByBattle(ev, c),
    res: function* (g, c, p) { damage(g, p, 500, { src: c, srcP: p }); damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  // Once per turn, not destroyed by an effect that doesn't target it (no chain; the resolving link's targets are checked).
  'Abyssal Kingshark': { self: { replaceDestroy: (g, c, o) => {
    if (o.battle || o.rule || c.f34ks === g.turnNo) return false; const Lr = g.resolvingL; if (Lr && (Lr.t || []).includes(c)) return false;
    c.f34ks = g.turnNo; log(g, 'Abyssal Kingshark was not destroyed.'); return true; } }, effs: [] },
  'Accumulated Fortune': { effs: [{ type: 'act',
    cond: g => { if (g.chain.length < 3) return false; const ns = g.chain.map(x => D(x.c).n); return new Set(ns).size === ns.length; },
    res: function* (g, c, p) { draw(g, p, 2); } }] },
  'Acidic Downpour': { effs: [actNoop], cont: { atk: (g, src, m) => attr(m) === 'EARTH' ? -500 : 0, def: (g, src, m) => attr(m) === 'EARTH' ? 400 : 0 } },
  // PARTIAL: it resolves at the start of the Damage Step (before the flip), so the battle stops there, as it would after the equip.
  'Adhesive Explosive': { effs: [
    { type: 'trig', mand: true, faceDownOk: true, label: 'Equip this card to the attacking monster',
      on: (g, ev, c) => ev.type === 'dsStart' && ev.t === c && c.pos === 'set' && !!ev.a && ev.a.ctrl !== c.ctrl,
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (!onField(c) || c.zone !== 'm' || !a || !onField(a) || a.zone !== 'm' || freeST(g, p) < 0) return;
        move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p }); c.equipTo = a.u; c.f34adh = g.turnNo; log(g, `Adhesive Explosive was equipped to ${name(a)}.`);
        // ENGINE: the Damage Step goes on while the attack target is still on the field in a Spell/Trap Zone, so this battle is
        // made harmless: no damage either way and no destruction, until the end of this Damage Step.
        c.flags.noBattleDestroy = true; c.flags.noBattleDamage = true; a.flags.noBattleDamage = true; a.f34adhB = true; } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'dsEnd' && ev.t === c) { c.flags.noBattleDestroy = false; c.flags.noBattleDamage = false; if (ev.a && ev.a.f34adhB) { ev.a.flags.noBattleDamage = false; ev.a.f34adhB = false; } } return false; } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy the equipped monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl && c.f34adh != null && g.turnNo > c.f34adh && !!equippedTo(g, c),
      res: function* (g, c, p) { const m = equippedTo(g, c); c.f34adh = null; if (m) destroy(g, [m], { by: p }); } }] },
  'Advance Draw': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && lv(x) >= 8),
    cost: function* (g, c, p) { yield* tribute(g, p, monsOf(g, p).filter(x => faceUp(x) && lv(x) >= 8), 'Tribute which Level 8 or higher monster?'); },
    res: function* (g, c, p) { draw(g, p, 2); } }] },
  // ENGINE: no per-summon Tribute restriction, so the single Tribute can be any monster (offered only while you have a Level 5+).
  'Advance Force': { effs: [actNoop],
    cont: { tributes: (g, src, c, p) => src.ctrl === p && lv(c) >= 7 && tributeCands(g, p).some(x => lv(x) >= 5) ? 1 : null } },

  // If this is the only card in your hand, it can be Normal Summoned without Tributing.
  // PARTIAL: the tributeless option is offered for a Set too.
  'Swift Gaia the Fierce Knight': { self: { tributes: (g, c, p) => c.zone === 'hand' && g.p[p].hand.length === 1 ? [0] : [] }, effs: [] },
  // Mandatory: when Tribute Summoned with a WIND Tribute, every Spell and Trap Card on the field returns to the hand.
  'Swift Birdman Joe': { effs: [{ type: 'trig', mand: true, label: 'Return all Spell and Trap Cards to the hand',
    on: (g, ev, c) => evSummoned(ev, c, ['tribute']) && (ev.tribs || []).some(t => attr(t) === 'WIND'),
    cond: g => allField(g).some(isST),
    res: function* (g) { const xs = allField(g).filter(isST); for (const x of xs) move(g, x, 'hand', { reason: 'effect' }); if (xs.length) log(g, `${xs.length} Spell and Trap Card${xs.length > 1 ? 's were' : ' was'} returned to the hand.`); } }] },
});

function cloudCands(g, p) { return [...g.p[p].hand, ...g.p[0].gy, ...g.p[1].gy].filter(x => isMon(x) && /^Cloudian/.test(D(x).n) && lv(x) <= 4 && canSS(g, p, x)); }
function skyCands(g, p) { return [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].filter(x => named(x, 'Flying Fortress SKY FIRE') && canSS(g, p, x)); }
function byBlaze(g, ev) { return ev.reason === 'effect' && !!g.resolvingL && /Blaze Accelerator/.test(D(g.resolvingL.c).n); }
})();
