/* Batch 1: Blackwing, Vayu Turbo, Hybrid, Hero Frog, Junk Frog, Diva Zombie, Diva Hero, Diva Hero Beat, Dragon Turbo.
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, setFaceDown, negate, addMod,
  equip, equippedTo, link, addCtr, ctr, negateAttack, endBattle, addRule, token, tokens, fusionSummon, canFusion, ritualSummon, canRitual,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned,
  fromFieldToGY, battleKill, isGemini } = L;
const atk = L.atk, def = L.def;
const isExtraD = L.isExtraD, synCombos = L.synCombos, fusionRecipe = L.fusionRecipe;

/* ---------- shared helpers ---------- */
const isZombie = c => isMon(c) && race(c) === 'Zombie';
const isDragon = c => isMon(c) && race(c) === 'Dragon';
const named = (c, n) => D(c).n === n;
const upNamed = (g, n) => allField(g).filter(x => faceUp(x) && D(x).n === n);
// Royal Decree on the field (other than src) negates Trap effects.
const decreeOn = (g, src) => allField(g).some(x => x !== src && faceUp(x) && D(x).n === 'Royal Decree' && !decreeBlocked(g, x));
const decreeBlocked = (g, x) => allField(g).some(y => y !== x && faceUp(y) && D(y).n === 'Royal Decree' && y.u < x.u); // two Decrees: the older one applies
const trapLive = (g, c) => faceUp(c) && !decreeOn(g, c);
const maskOn = g => allField(g).some(x => D(x).n === 'Mask of Restrict' && trapLive(g, x));
const mirrorOn = g => allField(g).some(x => D(x).n === 'Light-Imprisoning Mirror' && trapLive(g, x));
const isFlipMon = c => isMon(c) && /FLIP:/.test(D(c).tx || '');
const ssed = c => ['special', 'synchro', 'fusion', 'ritual'].includes(c.summonType) || D(c).k === 'token';
const discard = (g, p, x, reason = 'cost') => { move(g, x, 'gy', { reason }); log(g, `${PN(g, p)} discarded ${name(x)}.`); };
function* discardN(g, p, n, filter, text) { const xs = yield* pick(g, p, text || `Discard ${n} card${n > 1 ? 's' : ''}`, g.p[p].hand.filter(filter || (() => true)), n, n, 'cost'); for (const x of xs) discard(g, p, x); return xs; }
function assign(preds, pool) { // one way to give each predicate its own card, or null
  const rec = (i, used) => { if (i === preds.length) return used.slice(); for (const c of pool) if (!used.includes(c) && isMon(c) && preds[i](c)) { used.push(c); const r = rec(i + 1, used); if (r) return r; used.pop(); } return null; };
  return rec(0, []);
}
function allAssign(preds, pool, limit = 8) {
  const out = []; const rec = (i, used) => { if (out.length >= limit) return; if (i === preds.length) { const k = used.map(c => c.u).sort().join(); if (!out.some(m => m.map(c => c.u).sort().join() === k)) out.push(used.slice()); return; } for (const c of pool) if (!used.includes(c) && isMon(c) && preds[i](c)) { used.push(c); rec(i + 1, used); used.pop(); } };
  rec(0, []); return out;
}
/* What a chain link would destroy, as far as it is certain (Starlight Road, My Body as a Shield, Prime Material Dragon). */
function destroyList(g, Lk) {
  if (!Lk || Lk.negated || !Lk.tags || !Lk.tags.destroy) return [];
  const n = D(Lk.c).n, p = Lk.p, o = 1 - p;
  const byName = {
    'Heavy Storm': () => stOnField(g).filter(x => x !== Lk.c),
    'Torrential Tribute': () => fieldMons(g),
    'Mirror Force': () => monsOf(g, o).filter(x => x.pos === 'atk'),
    'Black Rose Dragon': () => allField(g).filter(x => Lk.eff.type === 'trig'),
    'Lightning Vortex': () => oppFaceUp(g, p),
    'Elemental HERO Absolute Zero': () => monsOf(g, o),
    'Red Dragon Archfiend': () => Lk.eff.on && Lk.ev && Lk.ev.type === 'afterCalc' ? monsOf(g, o).filter(x => x.pos !== 'atk') : [],
    'Bottomless Trap Hole': () => (Lk.data.cs || []).filter(x => onField(x) && faceUp(x) && atk(g, x) >= 1500),
    'Deck Devastation Virus': () => monsOf(g, o).filter(x => (faceUp(x) ? atk(g, x) : baseAtk(x)) <= 1500),
    'Fossil Dyna Pachycephalo': () => fieldMons(g).filter(ssed),
    'Smashing Ground': () => { const f = oppFaceUp(g, p); if (!f.length) return []; const m = Math.max(...f.map(x => def(g, x))); return f.filter(x => def(g, x) === m).slice(0, 1); },
    'Ally of Justice Catastor': () => Lk.ev ? [Lk.ev.a === Lk.c ? Lk.ev.t : Lk.ev.a].filter(x => x && onField(x)) : [],
    'Exploder Dragonwing': () => Lk.ev ? [Lk.ev.a === Lk.c ? Lk.ev.t : Lk.ev.a].filter(x => x && onField(x)) : [],
  };
  if (byName[n]) return byName[n]();
  return (Lk.t || []).filter(x => x && onField(x));
}
const wouldDestroyMine = (g, Lk, p) => destroyList(g, Lk).filter(x => x.ctrl === p);
const wouldDestroyMon = (g, Lk) => destroyList(g, Lk).filter(x => x.zone === 'm');

/* Synchro material rules the engine's synCombos doesn't read (checked as a Summon rule). */
const SYNREQ = {
  'Doomkaiser Dragon': (t, non) => named(t, 'Plaguespreader Zombie') && non.every(isZombie),
  'Revived King Ha Des': (t, non) => named(t, 'Plaguespreader Zombie') && non.every(isZombie),
  'Sea Dragon Lord Gishilnodon': (t, non) => non.length === 1 && lv(non[0]) === 3,
  'Exploder Dragonwing': (t, non) => non.every(isDragon),
  'Tempest Magician': (t, non) => non.every(x => race(x) === 'Spellcaster'),
  'Trident Dragion': (t, non) => isDragon(t) && non.every(isDragon),
};
function synLegal(g, sx, mats) {
  const t = mats.find(x => D(x).tu), non = mats.filter(x => x !== t);
  const req = SYNREQ[D(sx).n]; if (req && !req(t, non)) return false;
  const deb = mats.find(x => D(x).n === 'Debris Dragon');
  if (deb && (race(sx) !== 'Dragon' || mats.some(x => x !== deb && lv(x) === 4))) return false;
  return true;
}
const KYCOO_BANISH = ['Dark Armed Dragon', 'Blackwing - Vayu the Emblem of Honor', 'Mezuki', 'Destiny HERO - Malicious', 'Red-Eyes Wyvern', 'D.D. Crow', 'Soul Release', 'Book of Life', 'Kycoo the Ghost Destroyer', 'Black Rose Dragon', 'Burial from a Different Dimension'];

/* The hub: rules and bookkeeping for this batch, run on every event by the HOOK effect below (no prompts here). */
function blockedTrig(g, t) {
  const c = t.c; if (!c || !c.flags) return false;
  if (c.flags.b1hades && (c.zone === 'gy' || onField(c))) return true; // Revived King Ha Des
  if (isMon(c) && attr(c) === 'LIGHT' && (c.zone === 'gy' || c.zone === 'm') && mirrorOn(g)) return true; // Light-Imprisoning Mirror
  if (isTrap(c) && (t.eff.loc === 'st' || onField(c)) && allField(g).some(x => x !== c && D(x).n === 'Royal Decree' && faceUp(x))) return true; // Royal Decree
  return false;
}
function hubInit(g) {
  g.b1 = { seq: -1, rej: { turn: -1, n: [0, 0] } };
  // trigger effects that are negated never reach the chain (filtered when the engine reads the pending list)
  let pend = g.pend;
  Object.defineProperty(g, 'pend', { configurable: true, enumerable: true,
    get() { for (let i = pend.length - 1; i >= 0; i--) if (blockedTrig(g, pend[i])) pend.splice(i, 1); return pend; },
    set(v) { pend = v; } });
  addRule(g, (g2, a) => {
    if (a.type === 'ss') {
      const n = D(a.c).n;
      if (n === "Vanity's Fiend") return true;
      if ((n === 'Five-Headed Dragon' || n === 'Elemental HERO Mariner') && a.how !== 'fusion') return true;
      if (n === 'Trident Dragion' && a.how !== 'synchro') return true;
      if (a.how === 'synchro' && a.c.zone === 'extra') { const cs = synCombos(g, a.p, a.c); if (cs.length && !cs.some(m => synLegal(g, a.c, m))) return true; }
    }
    if (a.type === 'activate' && a.c.flags && a.c.flags.b1hades && a.c.zone === 'gy') return true;
    return false;
  });
}
function hub(g, ev) {
  if (!g.b1) hubInit(g);
  if (g.b1.seq === ev.seq) return; g.b1.seq = ev.seq;
  // Revived King Ha Des: monsters destroyed by battle with your Zombies have their effects negated
  const hades = p => monsOf(g, p).some(x => faceUp(x) && D(x).n === 'Revived King Ha Des' && !L.negd(g, x));
  if (ev.type === 'afterCalc' && ev.t) for (const [v, k] of [[ev.t, ev.a], [ev.a, ev.t]]) {
    if (v && k && v.flags.battleDoomed && race(k) === 'Zombie' && faceUp(k) && hades(k.ctrl) && isMon(v) && D(v).k !== 'normal') { v.flags.negated = true; v.flags.b1hades = true; }
  }
  if (ev.type === 'move' && ev.battle && ev.to === 'gy' && ev.killer && race(ev.killer) === 'Zombie' && hades(ev.killer.ctrl) && ev.c.zone === 'gy' && D(ev.c).k !== 'normal') { ev.c.flags.negated = true; ev.c.flags.b1hades = true; }
  // Doomkaiser Dragon: the Zombie it summoned is destroyed when it leaves the field
  if (ev.type === 'move' && ev.wasField && D(ev.c).n === 'Doomkaiser Dragon') for (const x of fieldMons(g)) if (x.flags.b1doom === ev.c.u) g.laterDestroy.push(x);
  // Super Rejuvenation: Dragons discarded or Tributed this turn
  if (ev.type === 'move' && ev.to === 'gy') {
    const fromHand = ev.from === 'hand' && ['discard', 'cost'].includes(ev.reason);
    const fromField = ev.wasField && ['tribute', 'cost'].includes(ev.reason);
    const wasDragon = ev.snap ? ev.snap.race === 'Dragon' && ev.snap.mon : isDragon(ev.c);
    if ((fromHand || fromField) && wasDragon) {
      const who = ev.by != null ? ev.by : fromField ? ev.prevCtrl : ev.c.owner;
      if (g.b1.rej.turn !== g.turnNo) g.b1.rej = { turn: g.turnNo, n: [0, 0] };
      g.b1.rej.n[who]++;
    }
  }
  // Mind Control: the monster can be Tributed again once its turn ends
  if (ev.type === 'phase' && ev.ph === 'end') for (const x of fieldMons(g)) if (x.flags.b1mc != null && x.flags.b1mc <= g.turnNo) { x.flags.b1mc = null; x.flags.noTribute = false; }
}
const HOOK = { type: 'trig', loc: 'any', on: (g, ev) => { hub(g, ev); return false; }, res: function* () {} };


const S = {
  /* ----- Blackwing ----- */
  'D.D. Crow': { effs: [{ type: 'quick', loc: 'hand', label: 'Discard: banish a card from their GY',
    cond: (g, c, p) => g.p[opp(p)].gy.length > 0,
    cost: function* (g, c, p) { discard(g, p, c); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which card from their GY?', g.p[opp(p)].gy, 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${name(t)} was banished.`); } } }] },
  'Fossil Dyna Pachycephalo': { cont: { forbid: (g, src, a) => a.type === 'ss' },
    effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(ssed), { by: p, src: c }); } }] },
  'Nobleman of Crossout': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(x => x.pos === 'set'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Set monster?', fieldMons(g).filter(x => x.pos === 'set'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.pos !== 'set') return; const flip = isFlipMon(t), n = D(t).n;
      if (!destroy(g, [t], { by: p, banish: true, src: c }).length) return;
      if (flip) for (const P of [0, 1]) { const xs = g.p[P].deck.filter(x => D(x).n === n); for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: p }); if (xs.length) log(g, `${PN(g, P)} banished ${xs.length} ${n} from the Deck.`); } } }] },
  'Deck Devastation Virus': { effs: [
    { type: 'act', tags: { destroy: 1 },
      cond: (g, c, p) => !maskOn(g) && L.tributeCands(g, p).some(x => faceUp(x) && attr(x) === 'DARK' && atk(g, x) >= 2000),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute a DARK with 2000 or more ATK', L.tributeCands(g, p).filter(x => faceUp(x) && attr(x) === 'DARK' && atk(g, x) >= 2000), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
      res: function* (g, c, p) { const o = opp(p); log(g, `${PN(g, p)} looked at ${PN(g, o)}'s hand.`);
        destroy(g, monsOf(g, o).filter(x => (faceUp(x) ? atk(g, x) : baseAtk(x)) <= 1500), { by: p, src: c });
        const hs = g.p[o].hand.filter(x => isMon(x) && baseAtk(x) <= 1500); for (const x of hs) move(g, x, 'gy', { reason: 'effect', destroyed: true, by: p }); if (hs.length) log(g, `${hs.map(name).join(', ')} in the hand ${hs.length > 1 ? 'were' : 'was'} destroyed.`);
        g.b1ddv = (g.b1ddv || []).filter(r => r.u !== c.u); g.b1ddv.push({ u: c.u, p, victim: o, until: g.turnNo + (g.tp === o ? 6 : 5), drawn: [] }); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Check the drawn cards',
      on: (g, ev, c) => { if (ev.type !== 'move' || ev.reason !== 'draw' || !g.b1ddv) return false; const r = g.b1ddv.find(r => r.u === c.u && r.victim === ev.c.owner && g.turnNo <= r.until); if (!r) return false; r.drawn.push(ev.c); return true; },
      res: function* (g, c, p) { const r = (g.b1ddv || []).find(r => r.u === c.u); if (!r) return; const xs = r.drawn.filter(x => x.zone === 'hand' && isMon(x) && baseAtk(x) <= 1500); r.drawn = [];
        for (const x of xs) move(g, x, 'gy', { reason: 'effect', destroyed: true, by: r.p }); if (xs.length) log(g, `Deck Devastation Virus destroyed ${xs.map(name).join(', ')}.`); } }] },
  'Pulling the Rug': { effs: [{ type: 'act',
    cond: (g, c, p, x) => { const t = x.top; return !!(t && !t.negated && t.eff.type === 'trig' && t.ev && t.ev.type === 'summon' && ['normal', 'tribute'].includes(t.ev.how) && t.ev.cs.includes(t.c) && isMon(t.c)); },
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  /* ----- Vayu Turbo ----- */
  "Vanity's Fiend": { hook: true, cont: { forbid: (g, src, a) => a.type === 'ss' }, effs: [] },
  'Mind Crush': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.length > 0,
    target: function* (g, c, p, L2) { const o = opp(p); const names = [...new Set([...g.p[o].hand, ...g.p[o].deck, ...g.p[o].gy, ...g.p[o].ban, ...fieldOf(g, o)].filter(x => !isExtraD(D(x)) && D(x).k !== 'token').map(x => D(x).n))].sort();
      if (!names.length) return; const i = yield* choose(g, p, 'Declare a card name', names); L2.data.n = names[i]; log(g, `${PN(g, p)} declared ${names[i]}.`); },
    res: function* (g, c, p, L2) { const o = opp(p), n = L2.data.n; const xs = g.p[o].hand.filter(x => D(x).n === n);
      if (xs.length) { for (const x of xs) move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, o)} discarded ${xs.length} ${n}.`); }
      else { log(g, `${PN(g, o)} revealed the hand.`); const h = g.p[p].hand; if (h.length) { const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)} at random.`); } } } }] },
  /* ----- Hybrid ----- */
  'Starlight Road': { effs: [{ type: 'act',
    cond: (g, c, p, x) => wouldDestroyMine(g, x.top, p).length >= 2,
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const Lk = L2.data.L, was = onField(Lk.c); Lk.negBy = p; negate(g, Lk, true);
      if (!(was && !onField(Lk.c))) return;
      const sd = g.p[p].extra.filter(x => D(x).n === 'Stardust Dragon');
      if (sd.length && freeM(g, p) >= 0 && (yield* yn(g, p, 'Special Summon Stardust Dragon from your Extra Deck?'))) ss(g, p, sd[0]); } }] },
  'Lightning Vortex': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && oppFaceUp(g, p).length > 0,
    cost: function* (g, c, p) { yield* discardN(g, p, 1, x => x !== c); },
    res: function* (g, c, p) { destroy(g, oppFaceUp(g, p), { by: p, src: c }); } }] },
  /* ----- Hero Frog / Junk Frog ----- */
  'Snowman Eater': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c) => fieldMons(g).some(x => faceUp(x) && !(x === c && c.flags.battleDoomed)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up monster?', fieldMons(g).filter(x => faceUp(x) && !(x === c && c.flags.battleDoomed)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2).filter(faceUp), { by: p }); } }] },
  'Super Polymerization': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && g.p[p].extra.some(fx => D(fx).k === 'fusion' && fusionRecipe(fx) && assign(fusionRecipe(fx), fieldMons(g)) && !L.forbid(g, { type: 'ss', c: fx, p, how: 'fusion' })),
    cost: function* (g, c, p) { yield* discardN(g, p, 1, x => x !== c); },
    after: (g, c, p, L2) => { addRule(g, (g2, a) => a.type === 'activate' && g.chain.includes(L2), { end: g.turnNo }); },
    res: function* (g, c, p) { const pool = fieldMons(g);
      const fs = g.p[p].extra.filter(fx => D(fx).k === 'fusion' && fusionRecipe(fx) && assign(fusionRecipe(fx), pool)); if (!fs.length) return;
      const [fx] = yield* pick(g, p, 'Fusion Summon which monster?', fs, 1, 1, 'good'); if (!fx) return;
      const cs = allAssign(fusionRecipe(fx), pool); let mats = cs[0];
      if (cs.length > 1) { const i = yield* choose(g, p, 'Use which Fusion Materials?', cs.map(m => m.map(x => `${D(x).n} (${x.ctrl === p ? 'yours' : 'theirs'})`).join(' + '))); mats = cs[i]; }
      const grp = g.group; for (const m of mats) move(g, m, 'gy', { reason: 'fusion', by: p, group: grp });
      log(g, `${PN(g, p)} used ${mats.map(x => D(x).n).join(' + ')} as Fusion Material.`);
      ss(g, p, fx, 'atk', { how: 'fusion', group: grp }); } }] },
  'My Body as a Shield': { effs: [{ type: 'act',
    cond: (g, c, p, x) => !g.inDS && x.top && x.top.p !== p && g.p[p].lp > 1500 && wouldDestroyMon(g, x.top).length > 0,
    cost: function* (g, c, p, L2) { pay(g, p, 1500); L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  /* ----- Diva Zombie ----- */
  'Deep Sea Diva': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, on: (g, ev, c) => evSummoned(ev, c, ['normal']),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && race(x) === 'Sea Serpent' && lv(x) <= 3),
    res: function* (g, c, p) { const cands = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Sea Serpent' && lv(x) <= 3); const [x] = yield* pick(g, p, 'Special Summon a Level 3 or lower Sea Serpent from your Deck', cands, 1, 1, 'good'); if (x) ss(g, p, x); shuffleDeck(g, p); } }] },
  'Goblin Zombie': { effs: [
    { type: 'trig', mand: true, on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
      res: function* (g, c, p) { mill(g, opp(p), 1); } },
    { type: 'trig', loc: 'gy', mand: true, on: (g, ev, c) => fromFieldToGY(ev, c),
      res: function* (g, c, p) { yield* search(g, p, x => isZombie(x) && L.num(D(x).def) <= 1200, 'Add a Zombie with 1200 or less DEF'); } }] },
  'Mezuki': { effs: [{ type: 'ign', loc: 'gy', tags: { ss: 1 }, label: 'Banish: revive a Zombie',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => x !== c && isZombie(x)),
    cost: function* (g, c, p) { move(g, c, 'ban', { reason: 'cost' }); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Zombie from your GY?', g.p[p].gy.filter(isZombie), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && isZombie(t)) ss(g, p, t); } }] },
  'Mystic Tomato': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && attr(x) === 'DARK' && baseAtk(x) <= 1500),
    res: function* (g, c, p) { const cands = g.p[p].deck.filter(x => isMon(x) && attr(x) === 'DARK' && baseAtk(x) <= 1500); const [x] = yield* pick(g, p, 'Special Summon a DARK with 1500 or less ATK', cands, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  'Pyramid Turtle': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isZombie(x) && L.num(D(x).def) <= 2000),
    res: function* (g, c, p) { const cands = g.p[p].deck.filter(x => isZombie(x) && L.num(D(x).def) <= 2000); const [x] = yield* pick(g, p, 'Special Summon a Zombie with 2000 or less DEF', cands, 1, 1, 'good');
      if (x) { const i = yield* choose(g, p, `${name(x)}: which position?`, ['Attack Position', 'Defense Position']); ss(g, p, x, i ? 'def' : 'atk'); } shuffleDeck(g, p); } }] },
  'Sangan': { effs: [{ type: 'trig', loc: 'gy', mand: true, on: (g, ev, c) => fromFieldToGY(ev, c),
    res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && baseAtk(x) <= 1500, 'Add a monster with 1500 or less ATK'); } }] },
  'Zombie Master': { effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Send a monster: revive a Zombie',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(isMon) && (allCards(g, 'gy').some(x => isZombie(x) && lv(x) <= 4) || g.p[p].hand.some(x => isZombie(x) && lv(x) <= 4)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send a monster from your hand to the GY', g.p[p].hand.filter(isMon), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Level 4 or lower Zombie?', allCards(g, 'gy').filter(x => isZombie(x) && lv(x) <= 4), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && isZombie(t) && onField(c) && faceUp(c)) ss(g, p, t); } }] },
  'Book of Life': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(isZombie) && g.p[opp(p)].gy.some(isMon),
    target: function* (g, c, p, L2) { const [a] = yield* pick(g, p, 'Special Summon which Zombie from your GY?', g.p[p].gy.filter(isZombie), 1, 1, 'good'); const [b] = yield* pick(g, p, 'Banish which monster from their GY?', g.p[opp(p)].gy.filter(isMon), 1, 1, 'bad'); L2.t = [a, b].filter(Boolean); L2.data.a = a; L2.data.b = b; },
    res: function* (g, c, p, L2) { const { a, b } = L2.data; if (a && a.zone === 'gy' && isZombie(a)) ss(g, p, a); if (b && b.zone === 'gy') { move(g, b, 'ban', { reason: 'effect', by: p }); log(g, `${name(b)} was banished.`); } } }] },
  'Foolish Burial': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.some(isMon),
    res: function* (g, c, p) { yield* search(g, p, isMon, 'Send a monster from your Deck to the GY', 'gy'); } }] },
  'Mind Control': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, opp(p)).length > 0 && freeM(g, p) >= 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.ctrl === p) return; if (!takeControl(g, p, t, true)) return;
      t.flags.noTribute = true; t.flags.b1mc = g.turnNo; const u = t.u; addRule(g, (g2, a) => a.type === 'attack' && a.c.u === u, { end: g.turnNo }); } }, HOOK] },
  'Phoenix Wing Wind Blast': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.length > 0 && fieldOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { yield* discardN(g, p, 1); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Put which card on top of the Deck?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) { move(g, t, 'deckTop', { reason: 'effect', by: p }); log(g, `${D(t).n} was put on top of the Deck.`); } } }] },
  'Doomkaiser Dragon': { hook: true, effs: [{ type: 'trig', when: true, tags: { ss: 1 }, on: (g, ev, c) => evSummoned(ev, c, ['special', 'synchro', 'fusion', 'ritual']),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[opp(p)].gy.some(isZombie),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Zombie from their GY?', g.p[opp(p)].gy.filter(isZombie), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy' || !isZombie(t)) return; if (ss(g, p, t, 'atk') && onField(c)) t.flags.b1doom = c.u; else if (!onField(c) && onField(t)) destroy(g, [t], { by: p }); } }] },
  // PARTIAL: effects activated by a negated monster are stopped before they reach the chain instead of being negated on it.
  'Revived King Ha Des': { hook: true, effs: [] },
  // PARTIAL: LIGHT monster effects on the field or in the GY are stopped from activating (Ignition/Quick) or reaching the chain (Triggers) instead of being negated after activating.
  'Light-Imprisoning Mirror': { hook: true, cont: { forbid: (g, src, a) => a.type === 'activate' && !decreeOn(g, src) && isMon(a.c) && attr(a.c) === 'LIGHT' && ['m', 'gy'].includes(a.c.zone) },
    effs: [{ type: 'act', res: function* () {} }] },
  'Return from the Different Dimension': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].ban.some(isMon),
      cost: function* (g, c, p) { pay(g, p, Math.floor(g.p[p].lp / 2)); },
      res: function* (g, c, p) { const cands = g.p[p].ban.filter(x => isMon(x) && !L.forbid(g, { type: 'ss', c: x, p, how: 'special' })); const n = Math.min(nFreeM(g, p), cands.length); if (!n) return;
        const xs = yield* pick(g, p, `Special Summon ${n} banished monster${n > 1 ? 's' : ''}`, cands, n, n, 'good'); const grp = g.group, out = [];
        for (const x of xs) if (x.zone === 'ban' && freeM(g, p) >= 0 && ss(g, p, x, 'atk', { group: grp })) { x.flags.b1rfdd = c.u; out.push(x); }
      } },
    { type: 'trig', loc: 'any', mand: true, label: 'Banish the summoned monsters', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(x => x.flags.b1rfdd === c.u),
      res: function* (g, c, p) { const xs = fieldMons(g).filter(x => x.flags.b1rfdd === c.u); for (const x of xs) move(g, x, 'ban', { reason: 'effect' }); if (xs.length) log(g, `${xs.map(x => D(x).n).join(', ')} ${xs.length > 1 ? 'were' : 'was'} banished.`); } }] },
  /* ----- Diva Hero ----- */
  'Destiny HERO - Malicious': { effs: [{ type: 'ign', loc: 'gy', tags: { ss: 1 }, label: 'Banish: summon a Malicious',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => D(x).n === 'Destiny HERO - Malicious'),
    cost: function* (g, c, p) { move(g, c, 'ban', { reason: 'cost' }); },
    res: function* (g, c, p) { const x = g.p[p].deck.find(x => D(x).n === 'Destiny HERO - Malicious'); if (x) ss(g, p, x, 'def'); shuffleDeck(g, p); } }] },
  'Spined Gillman': { cont: { atk: (g, src, c) => c.ctrl === src.ctrl && ['Fish', 'Sea Serpent', 'Aqua'].includes(race(c)) ? 400 : 0 }, effs: [] },
  'Future Fusion': { effs: [
    { type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => g.p[p].extra.some(fx => D(fx).k === 'fusion' && fusionRecipe(fx) && assign(fusionRecipe(fx), g.p[p].deck) && !L.forbid(g, { type: 'ss', c: fx, p, how: 'fusion' })),
      res: function* (g, c, p) { const fs = g.p[p].extra.filter(fx => D(fx).k === 'fusion' && fusionRecipe(fx) && assign(fusionRecipe(fx), g.p[p].deck)); if (!fs.length) return;
        const [fx] = yield* pick(g, p, 'Reveal which Fusion Monster?', fs, 1, 1, 'good'); if (!fx) return; log(g, `${PN(g, p)} revealed ${D(fx).n}.`);
        const cs = allAssign(fusionRecipe(fx), g.p[p].deck); let mats = cs[0];
        if (cs.length > 1) { const i = yield* choose(g, p, 'Send which Fusion Materials from your Deck?', cs.map(m => m.map(x => D(x).n).join(' + '))); mats = cs[i]; }
        for (const m of mats) move(g, m, 'gy', { reason: 'effect' }); log(g, `${PN(g, p)} sent ${mats.map(x => D(x).n).join(', ')} from the Deck to the GY.`); shuffleDeck(g, p);
        if (onField(c)) c.flags.b1ff = { name: D(fx).n, n: 0 }; } },
    { type: 'trig', loc: 'st', mand: true, tags: { ss: 1 }, label: 'Fusion Summon the revealed monster',
      on: (g, ev, c) => { if (ev.type !== 'phase' || ev.ph !== 'standby' || ev.tp !== c.ctrl || !c.flags.b1ff || c.flags.b1ff.done || !faceUp(c)) return false; c.flags.b1ff.n++; return c.flags.b1ff.n === 2; },
      res: function* (g, c, p) { const f = c.flags.b1ff; if (!f || !onField(c)) return; f.done = true; const fx = g.p[p].extra.find(x => D(x).n === f.name);
        if (fx && freeM(g, p) >= 0 && ss(g, p, fx, 'atk', { how: 'fusion' })) link(g, c, fx); } }] },
  'Consecrated Light': { cont: { forbid: (g, src, a) => (['ns', 'ss'].includes(a.type) && attr(a.c) === 'DARK') || (a.type === 'attack' && attr(a.c) === 'DARK') },
    self: { noBattleDestroy: (g, c) => !!(g.battle && [g.battle.a, g.battle.t].some(x => x && x !== c && attr(x) === 'DARK')),
      noBattleDamage: (g, c) => !!(g.battle && [g.battle.a, g.battle.t].includes(c) && [g.battle.a, g.battle.t].some(x => x && x !== c && attr(x) === 'DARK')) }, effs: [] },
  'Smashing Ground': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    res: function* (g, c, p) { const f = oppFaceUp(g, p); if (!f.length) return; const m = Math.max(...f.map(x => def(g, x))); const [t] = yield* pick(g, p, 'Destroy which monster with the highest DEF?', f.filter(x => def(g, x) === m), 1, 1, 'bad'); if (t) destroy(g, [t], { by: p, src: c }); } }] },
  'Soul Release': { effs: [{ type: 'act', cond: g => allCards(g, 'gy').length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish up to 5 cards from the GYs', allCards(g, 'gy'), 1, 5, 'bad'); },
    res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.map(x => D(x).n).join(', ')} ${xs.length > 1 ? 'were' : 'was'} banished.`); } }] },
  // PARTIAL: Tribute costs are blocked for this batch's cards and the engine's Icarus Attack, Substitoad and Soul Exchange; Enemy Controller's Tribute option is not.
  'Mask of Restrict': { cont: { forbid: (g, src, a) => { if (decreeOn(g, src)) return false;
      if ((a.type === 'ns' || a.type === 'set') && lv(a.c) >= 5) return !(D(a.c).n === 'Blackwing - Sirocco the Dawn' && !monsOf(g, a.p).length && monsOf(g, opp(a.p)).length);
      if (a.type === 'ss' && a.how === 'ritual') return true;
      if (a.type === 'activate' && ['Icarus Attack', 'Substitoad', 'Soul Exchange'].includes(D(a.c).n)) return true;
      return false; } },
    effs: [{ type: 'act', res: function* () {} }] },
  // PARTIAL: other Traps can't be activated (and Trap triggers don't start) instead of being negated when they resolve.
  'Royal Decree': { hook: true, cont: { forbid: (g, src, a) => a.type === 'activate' && isTrap(a.c) && a.c !== src && !decreeBlocked(g, src) },
    effs: [{ type: 'act', res: function* () {} }] },
  /* ----- Diva Hero Beat ----- */
  'D.D. Warrior Lady': { effs: [{ type: 'trig', label: 'Banish both monsters',
    on: (g, ev, c) => ev.type === 'afterCalc' && ev.t && (ev.a === c || ev.t === c),
    res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a;
      if (o && onField(o)) { move(g, o, 'ban', { reason: 'effect', by: p }); log(g, `${D(o).n} was banished.`); }
      if (onField(c)) { move(g, c, 'ban', { reason: 'effect', by: p }); log(g, 'D.D. Warrior Lady was banished.'); } } }] },
  'Honest': { effs: [
    { type: 'ign', label: 'Return Honest to the hand', res: function* (g, c, p) { if (onField(c)) { move(g, c, 'hand', { reason: 'effect' }); log(g, 'Honest returned to the hand.'); } } },
    { type: 'quick', loc: 'hand', ds: true, label: 'Gain the opponent’s ATK',
      cond: (g, c, p) => !!(g.inDS && g.battle && g.battle.t && [g.battle.a, g.battle.t].some(x => x.ctrl === p && faceUp(x) && attr(x) === 'LIGHT') && [g.battle.a, g.battle.t].some(x => x.ctrl !== p)),
      cost: function* (g, c, p, L2) { const b = g.battle; L2.data.m = [b.a, b.t].find(x => x.ctrl === p && attr(x) === 'LIGHT'); L2.data.o = [b.a, b.t].find(x => x.ctrl !== p); move(g, c, 'gy', { reason: 'cost' }); },
      res: function* (g, c, p, L2) { const { m, o } = L2.data; if (m && onField(m) && faceUp(m) && o && onField(o)) { const n = atk(g, o); addMod(g, m, { atk: n, end: true }); log(g, `${name(m)} gained ${n} ATK.`); } } }] },
  'Gemini Spark': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !maskOn(g) && L.tributeCands(g, p).some(x => faceUp(x) && isGemini(x) && lv(x) === 4) && allField(g).some(x => x !== c),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute a face-up Level 4 Gemini', L.tributeCands(g, p).filter(x => faceUp(x) && isGemini(x) && lv(x) === 4), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', allField(g).filter(x => x !== c), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { if (destroy(g, live(L2), { by: p, src: c }).length) draw(g, p, 1); } }] },
  // PARTIAL: if the monster leaves the field any other way (bounced, banished), Call of the Haunted is destroyed too.
  'Call of the Haunted': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(isMon),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which monster from your GY?', g.p[p].gy.filter(isMon), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && onField(c) && ss(g, p, t, 'atk')) link(g, c, t); } }] },
  'Hero Blast': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.some(x => D(x).k === 'normal' && /^Elemental HERO/.test(D(x).n)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Elemental HERO Normal Monster?', g.p[p].gy.filter(x => D(x).k === 'normal' && /^Elemental HERO/.test(D(x).n)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy') return; move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`);
      const A = baseAtk(t), cs = oppFaceUp(g, p).filter(x => atk(g, x) <= A); if (!cs.length) return; const [x] = yield* pick(g, p, 'Destroy which monster?', cs, 1, 1, 'bad'); if (x) destroy(g, [x], { by: p, src: c }); } }] },
  'Sea Dragon Lord Gishilnodon': { hook: true, effs: [{ type: 'trig', mand: true,
    on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.to === 'gy' && ev.snap && ev.snap.faceUp && ev.snap.mon && ev.snap.lv <= 3,
    res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { set: 3000, which: 'atk', end: true }); log(g, 'Sea Dragon Lord Gishilnodon’s ATK became 3000.'); } } }] },
  // PARTIAL: "can't banish from either GY" covers the listed cards that banish from a GY (KYCOO_BANISH), not every card.
  'Kycoo the Ghost Destroyer': { cont: { forbid: (g, src, a) => a.type === 'activate' && a.p !== src.ctrl && KYCOO_BANISH.includes(D(a.c).n) },
    effs: [{ type: 'trig', label: 'Banish up to 2 monsters from their GY', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
      cond: (g, c, p) => g.p[opp(p)].gy.some(isMon),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish up to 2 monsters from their GY', g.p[opp(p)].gy.filter(isMon), 1, 2, 'bad'); },
      res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.map(x => D(x).n).join(', ')} ${xs.length > 1 ? 'were' : 'was'} banished.`); } }] },
  /* ----- Dragon Turbo ----- */
  // ENGINE: destroy() has no replacement hook, so "discard 1 card instead" of being destroyed by an opponent's effect is missing.
  // PARTIAL: the doubled ATK applies through the whole Damage Step, not only during damage calculation.
  'Clear Vice Dragon': { self: { atk: (g, c) => { const b = g.battle; if (!g.inDS || !b || b.a !== c || !b.t || D(b.t).n === 'Clear Vice Dragon') return 0; return 2 * atk(g, b.t) - baseAtk(c); } }, effs: [] },
  // PARTIAL: the material limits are checked when the Synchro Summon is offered; the combination menu can still list an illegal set beside a legal one.
  'Debris Dragon': { hook: true, effs: [{ type: 'trig', when: true, tags: { ss: 1 }, on: (g, ev, c) => evSummoned(ev, c, ['normal']),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && baseAtk(x) <= 500),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon a monster with 500 or less ATK from your GY', g.p[p].gy.filter(x => isMon(x) && baseAtk(x) <= 500), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk', { negate: true }); } }] },
  // PARTIAL: the End Phase upkeep is a trigger on the chain (it should not start a chain).
  "Koa'ki Meiru Drago": { cont: { forbid: (g, src, a) => a.type === 'ss' && ['LIGHT', 'DARK'].includes(attr(a.c)) },
    effs: [{ type: 'trig', mand: true, label: 'Upkeep', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; const h = g.p[p].hand, core = h.filter(x => D(x).n === "Iron Core of Koa'ki Meiru"), drg = h.filter(isDragon);
        const opts = []; if (core.length) opts.push('Send Iron Core of Koa’ki Meiru to the GY'); if (drg.length) opts.push('Reveal a Dragon'); opts.push('Destroy Koa’ki Meiru Drago');
        const i = yield* choose(g, p, 'Koa’ki Meiru Drago: keep it?', opts); const k = opts[i];
        if (k.startsWith('Send')) { move(g, core[0], 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Iron Core of Koa'ki Meiru to the GY.`); }
        else if (k.startsWith('Reveal')) { const [x] = yield* pick(g, p, 'Reveal which Dragon?', drg, 1, 1, 'good'); log(g, `${PN(g, p)} revealed ${name(x)}.`); }
        else destroy(g, [c], { rule: true }); } }] },
  'Prime Material Dragon': { cont: { dmg: (g, src, p, n, o) => (o && o.battle) ? undefined : { gain: n } },
    effs: [{ type: 'quick', ds: true, label: 'Discard to negate',
      cond: (g, c, p, x) => g.p[p].hand.length > 0 && x.top && wouldDestroyMon(g, x.top).length > 0,
      cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; yield* discardN(g, p, 1, null, 'Send a card from your hand to the GY'); },
      res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  'Red-Eyes Darkness Metal Dragon': { proc: { label: 'Special Summon (banish a face-up Dragon)', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isDragon(x)),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish a face-up Dragon you control', monsOf(g, p).filter(x => faceUp(x) && isDragon(x)), 1, 1, 'cost'); move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
    effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Special Summon a Dragon',
      cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].gy].some(x => isDragon(x) && D(x).n !== 'Red-Eyes Darkness Metal Dragon' && !isExtraD(D(x)) && !L.forbid(g, { type: 'ss', c: x, p, how: 'special' })),
      res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].gy].filter(x => isDragon(x) && D(x).n !== 'Red-Eyes Darkness Metal Dragon' && !isExtraD(D(x))); const [x] = yield* pick(g, p, 'Special Summon a Dragon from your hand or GY', cs, 1, 1, 'good'); if (x) ss(g, p, x); } }] },
  'The White Stone of Legend': { effs: [{ type: 'trig', loc: 'gy', mand: true, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy',
    res: function* (g, c, p) { yield* search(g, p, x => D(x).n === 'Blue-Eyes White Dragon', 'Add Blue-Eyes White Dragon'); } }] },
  'Card Destruction': { effs: [{ type: 'act',
    cond: (g, c, p) => { const mine = g.p[p].hand.filter(x => x !== c).length; return (mine > 0 || g.p[opp(p)].hand.length > 0) && g.p[p].deck.length >= mine; },
    res: function* (g, c, p) { const n = [0, 1].map(P => g.p[P].hand.length); const grp = g.group;
      for (const P of [0, 1]) { for (const x of g.p[P].hand.slice()) move(g, x, 'gy', { reason: 'discard', group: grp }); if (n[P]) log(g, `${PN(g, P)} discarded ${n[P]} card${n[P] > 1 ? 's' : ''}.`); }
      for (const P of [g.tp, 1 - g.tp]) if (n[P]) draw(g, P, n[P]); } }] },
  'Cards of Consonance': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 2 && g.p[p].hand.some(x => isDragon(x) && D(x).tu && baseAtk(x) <= 1000),
    cost: function* (g, c, p) { yield* discardN(g, p, 1, x => isDragon(x) && D(x).tu && baseAtk(x) <= 1000, 'Discard a Dragon Tuner with 1000 or less ATK'); },
    res: function* (g, c, p) { draw(g, p, 2); } }] },
  'Giant Trunade': { effs: [{ type: 'act', cond: (g, c) => stOnField(g).some(x => x !== c),
    res: function* (g, c, p) { const xs = stOnField(g).filter(x => x !== c && !g.chain.some(l => l.c === x && !['Continuous', 'Equip', 'Field'].includes(D(x).sub)));
      for (const x of xs) move(g, x, 'hand', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.length} Spell/Trap card${xs.length > 1 ? 's' : ''} returned to the hand.`); } }] },
  'Instant Fusion': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.p[p].lp > 1000 && freeM(g, p) >= 0 && !(g.b1if && g.b1if[p] === g.turnNo) && g.p[p].extra.some(fx => D(fx).k === 'fusion' && L.num(D(fx).lv) <= 5 && !L.forbid(g, { type: 'ss', c: fx, p, how: 'fusion' })),
      cost: function* (g, c, p) { pay(g, p, 1000); g.b1if = g.b1if || [null, null]; g.b1if[p] = g.turnNo; },
      res: function* (g, c, p) { const fs = g.p[p].extra.filter(fx => D(fx).k === 'fusion' && L.num(D(fx).lv) <= 5); const [fx] = yield* pick(g, p, 'Fusion Summon which Level 5 or lower Fusion Monster?', fs, 1, 1, 'good');
        if (fx && ss(g, p, fx, 'atk', { how: 'fusion' })) { fx.flags.cantAttack = true; fx.flags.b1if = c.u; } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the summoned monster', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(x => x.flags.b1if === c.u),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.flags.b1if === c.u), { by: p }); } }] },
  'Magical Stone Excavation': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.filter(x => x !== c).length >= 2 && g.p[p].gy.some(isSpell),
    cost: function* (g, c, p) { yield* discardN(g, p, 2, x => x !== c); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Spell from your GY?', g.p[p].gy.filter(isSpell), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },
  'Pot of Avarice': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 2 && g.p[p].gy.filter(isMon).length >= 5,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Shuffle which 5 monsters into the Deck?', g.p[p].gy.filter(isMon), 5, 5, 'cost'); },
    res: function* (g, c, p, L2) { if (L2.t.length < 5 || L2.t.some(x => x.zone !== 'gy')) { log(g, 'Not all 5 monsters were in the GY.'); return; }
      for (const x of L2.t) move(g, x, isExtraD(D(x)) ? 'extra' : 'deck', { reason: 'effect' }); shuffleDeck(g, p); log(g, `${PN(g, p)} shuffled 5 monsters into the Deck.`); draw(g, p, 2); } }] },
  // PARTIAL: the End Phase draw is a trigger on the chain (it should resolve without starting a chain).
  'Super Rejuvenation': { hook: true, effs: [
    { type: 'act', res: function* (g, c, p) { g.b1rejQ = g.b1rejQ || []; g.b1rejQ.push({ u: c.u, p, turn: g.turnNo }); log(g, 'Dragons discarded or Tributed this turn will be counted in the End Phase.'); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Draw for each Dragon', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && (g.b1rejQ || []).some(r => r.u === c.u && r.turn === g.turnNo),
      res: function* (g, c) { const rs = g.b1rejQ.filter(r => r.u === c.u && r.turn === g.turnNo); g.b1rejQ = g.b1rejQ.filter(r => !rs.includes(r));
        for (const r of rs) { const n = g.b1 && g.b1.rej.turn === g.turnNo ? g.b1.rej.n[r.p] : 0; if (n) draw(g, r.p, n); else log(g, 'Super Rejuvenation: no Dragons were discarded or Tributed.'); } } }] },
  'Trade-In': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 2 && g.p[p].hand.some(x => isMon(x) && lv(x) === 8),
    cost: function* (g, c, p) { yield* discardN(g, p, 1, x => isMon(x) && lv(x) === 8, 'Discard a Level 8 monster'); },
    res: function* (g, c, p) { draw(g, p, 2); } }] },
  'Upstart Goblin': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 1, res: function* (g, c, p) { draw(g, p, 1); gain(g, opp(p), 1000); } }] },
  'Darkfire Dragon': { mats: [c => D(c).n === 'Firegrass', c => D(c).n === 'Petit Dragon'], effs: [] },
  'Elemental HERO Mariner': { hook: true, mats: [c => D(c).n === 'Elemental HERO Bubbleman', c => D(c).n === 'Elemental HERO Avian'],
    self: { directAttack: (g, c) => g.p[c.ctrl].st.some(x => x && x.pos === 'set') }, effs: [] },
  'Five-Headed Dragon': { hook: true, mats: Array(5).fill(isDragon),
    self: { noBattleDestroy: (g, c) => !!(g.battle && [g.battle.a, g.battle.t].some(x => x && x !== c && ['DARK', 'EARTH', 'WATER', 'FIRE', 'WIND'].includes(attr(x)))) }, effs: [] },
  'Musician King': { mats: [c => D(c).n === 'Witch of the Black Forest', c => D(c).n === 'Lady of Faith'], effs: [] },
  'Ancient Fairy Dragon': { effs: [
    { type: 'ign', opt: true, tags: { ss: 1 }, label: 'Special Summon a Level 4 or lower monster',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && lv(x) <= 4 && !isExtraD(D(x))),
      after: (g, c, p) => { g.noBP[p] = true; },
      res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isMon(x) && lv(x) <= 4 && !isExtraD(D(x))); const [x] = yield* pick(g, p, 'Special Summon a Level 4 or lower monster from your hand', cs, 1, 1, 'good'); if (x) ss(g, p, x); } },
    { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy a Field Spell',
      cond: g => !!(g.p[0].fz || g.p[1].fz),
      res: function* (g, c, p) { const fz = [g.p[0].fz, g.p[1].fz].filter(Boolean); const [x] = yield* pick(g, p, 'Destroy which Field Spell?', fz, 1, 1, 'bad'); if (!x || !destroy(g, [x], { by: p }).length) return;
        gain(g, p, 1000); if (g.p[p].deck.some(y => D(y).sub === 'Field') && (yield* yn(g, p, 'Add a Field Spell from your Deck?'))) yield* search(g, p, y => D(y).sub === 'Field', 'Add a Field Spell'); } }] },
  'Exploder Dragonwing': { hook: true, effs: [{ type: 'trig', tags: { destroy: 1 }, label: 'Destroy it and inflict its ATK',
    on: (g, ev, c) => ev.type === 'dsStart' && ev.t && (ev.a === c || ev.t === c),
    cond: (g, c, p, x) => { const o = x.ev.a === c ? x.ev.t : x.ev.a; return !!(o && onField(o) && atk(g, c) >= atk(g, o)); },
    res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; if (!o || !onField(o) || !onField(c) || atk(g, c) < atk(g, o)) return; const n = atk(g, o);
      if (destroy(g, [o], { by: p }).length) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  'Tempest Magician': { hook: true, effs: [
    { type: 'trig', mand: true, on: (g, ev, c) => evSummoned(ev, c, ['synchro']), res: function* (g, c) { if (onField(c)) { addCtr(g, c, 'spell', 1); log(g, 'Tempest Magician got a Spell Counter.'); } } },
    { type: 'ign', opt: true, label: 'Discard for Spell Counters', cond: (g, c, p) => g.p[p].hand.length > 0,
      cost: function* (g, c, p, L2) { const n = yield* choose(g, p, 'Discard how many cards?', g.p[p].hand.map((_, i) => String(i + 1))); const xs = yield* discardN(g, p, n + 1); L2.data.n = xs.length; },
      res: function* (g, c, p, L2) { const ok = monsOf(g, p).filter(x => faceUp(x) && /Spell Counter/.test(D(x).ps || D(x).tx || ''));
        for (let i = 0; i < L2.data.n && ok.length; i++) { const [x] = ok.length > 1 ? yield* pick(g, p, `Place Spell Counter ${i + 1} of ${L2.data.n} on which monster?`, ok, 1, 1, 'good') : [ok[0]]; if (x && onField(x)) addCtr(g, x, 'spell', 1); }
        log(g, `${PN(g, p)} placed ${L2.data.n} Spell Counter${L2.data.n > 1 ? 's' : ''}.`); } },
    { type: 'ign', label: 'Remove all Spell Counters: 500 damage each', cond: g => allField(g).some(x => ctr(x, 'spell') > 0),
      cost: function* (g, c, p, L2) { let n = 0; for (const x of allField(g)) { n += ctr(x, 'spell'); if (ctr(x, 'spell')) addCtr(g, x, 'spell', -ctr(x, 'spell')); } L2.data.n = n; log(g, `${PN(g, p)} removed ${n} Spell Counter${n > 1 ? 's' : ''}.`); },
      res: function* (g, c, p, L2) { damage(g, opp(p), 500 * L2.data.n, { src: c, srcP: p }); } }] },
  // ENGINE: a monster can attack at most twice a turn, so destroying 2 cards gives 1 extra attack instead of 2.
  'Trident Dragion': { hook: true, effs: [{ type: 'trig', tags: { destroy: 1 }, label: 'Destroy up to 2 of your cards',
    on: (g, ev, c) => evSummoned(ev, c, ['synchro']), cond: (g, c, p) => fieldOf(g, p).some(x => x !== c),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy up to 2 other cards you control', fieldOf(g, p).filter(x => x !== c), 1, 2, 'cost'); },
    res: function* (g, c, p, L2) { const n = destroy(g, live(L2), { by: p }).length; if (n && onField(c)) { c.flags.extraAttack = g.turnNo; log(g, `Trident Dragion can attack ${n + 1} times this turn.`); } } }] },
  'Red-Eyes Wyvern': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Banish: revive a Red-Eyes',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.owner,
    cond: (g, c, p) => g.ns[p] === 0 && freeM(g, p) >= 0 && g.p[p].gy.some(x => x !== c && isMon(x) && /Red-Eyes/.test(D(x).n)),
    cost: function* (g, c, p) { move(g, c, 'ban', { reason: 'cost' }); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Red-Eyes monster?', g.p[p].gy.filter(x => isMon(x) && /Red-Eyes/.test(D(x).n)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { g.noSummon[p] = true; const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  'Treacherous Trap Hole': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => !g.p[p].gy.some(isTrap) && fieldMons(g).length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which 2 monsters?', fieldMons(g), 2, 2, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
};
for (const k in S) if (S[k].hook) { delete S[k].hook; S[k].effs = [...(S[k].effs || []), HOOK]; }
E.addScripts(S);
})();
