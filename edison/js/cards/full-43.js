/* Full pool batch 43: Rampaging Rhynos to Shark Cruiser (build/batches/full/full-43.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings.
 Riryoku had a Goat-only script (classic-4.js); it is ported here as the shared version. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, setFaceDown, addMod,
  equip, addRule, tokens, name, D, isMon, isST, isSpell, isTrap, isExtraD, onField, faceUp, attr, race, lv,
  baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp,
  oppFaceUp, stOnField, evSummoned, fromFieldToGY, emit, forbid, stat, negd, num, isGemini, addCtr, ctr } = L;
const atk = L.atk;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
const isLS = x => /Lightsworn/.test(name(x));
// "by an effect of a card controlled by your opponent" (as in full-26.js): the move's own `by` when given, else the turn player.
const byOpp = (g, ev, c) => ev.by != null ? ev.by !== c.owner : g.tp !== c.owner;
const flip = (label, more) => ({ type: 'trig', mand: true, faceDownOk: true, label, on: (g, ev, c) => ev.type === 'flip' && ev.c === c, ...more });
// the monster it battles right now
const foeOf = (g, c) => g.battle ? (g.battle.a === c ? g.battle.t : g.battle.t === c ? g.battle.a : null) : null;
const toPos = (g, c, pos) => { if (!onField(c) || c.zone !== 'm' || c.pos === pos) return; const from = c.pos; c.pos = pos; g.seq++;
  log(g, `${name(c)} was changed to ${pos === 'atk' ? 'Attack' : 'Defense'} Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from }); };
function* askPos(g, p, what) { const i = yield* choose(g, p, `${what}: which position?`, ['Attack Position', 'Defense Position']); return i ? 'def' : 'atk'; }
// move a monster to an adjacent free Monster Zone (Rampaging Rhynos, Senet Switch)
const adjFree = (g, c) => { const a = g.p[c.ctrl].m, i = a.indexOf(c); return [i - 1, i + 1].filter(j => j >= 0 && j < 5 && !a[j]); };
function* moveAdj(g, p, c) {
  if (!onField(c) || c.zone !== 'm') return; const js = adjFree(g, c); if (!js.length) return;
  let j = js[0]; if (js.length > 1) j = js[(yield* choose(g, p, `Move ${shownName(c)} which way?`, ['Left', 'Right']))];
  const a = g.p[c.ctrl].m; const i = a.indexOf(c); a[i] = null; a[j] = c; g.seq++; log(g, `${shownName(c)} moved to an adjacent Monster Zone.`); }
const shownName = c => c.pos === 'set' ? 'The face-down monster' : name(c);
// mirrored zones: zone i of one player faces zone 4 - i of the other
const sameColumn = (g, a, t) => { const i = g.p[a.ctrl].m.indexOf(a), j = g.p[t.ctrl].m.indexOf(t); return i >= 0 && j >= 0 && i === 4 - j; };
// "Twice per turn" style counters
const usedN = (g, c, k) => c.flags[k] && c.flags[k].t === g.turnNo ? c.flags[k].n : 0;
const useN = (g, c, k) => { c.flags[k] = { t: g.turnNo, n: usedN(g, c, k) + 1 }; };
// Monsters a card stored to remove later ("destroyed during the End Phase", "sent to the GY during the End Phase").
// Kept on the card object (not c.flags, which a move clears). Entries: {u, turn, tp (only that player's End Phase), how}.
const later = (c, e) => (c.f43later || (c.f43later = [])).push(e);
const laterTrig = { type: 'trig', loc: 'any', mand: true, label: 'End Phase',
  on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!c.f43later && c.f43later.some(e => e.turn <= g.turnNo && (e.tp == null || e.tp === ev.tp)),
  res: function* (g, c, p) { const due = c.f43later.filter(e => e.turn <= g.turnNo && (e.tp == null || e.tp === g.tp)); c.f43later = c.f43later.filter(e => !due.includes(e));
    for (const e of due) { const m = fieldMons(g).find(x => x.u === e.u); if (!m) continue;
      if (e.how === 'gy') { move(g, m, 'gy', { reason: 'effect', by: p }); log(g, `${D(m).n} was sent to the GY.`); } else destroy(g, [m], { by: p }); } } };

/* A Trap (or a Quick-Play Spell from the hand or Set) that answers a moment the engine opens no window for (as in full-26.js):
 a trigger that fires only while the card could be activated. It flips the card face-up (or plays it from the hand), counts as
 a card activation at Spell Speed 2, and a Normal one goes to the GY after it resolves; o.keep keeps a Continuous Trap.
 ENGINE: no response window after a monster is destroyed, so these act as optional triggers. */
const lateAct = o => ({ type: 'trig', loc: 'any', label: o.label, tags: o.tags,
  on: (g, ev, c) => { if (!(ready(g, c, o) && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => ready(g, c, o) && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev;
    if (c.zone === 'hand') move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'activate' }); else { c.pos = 'up'; g.seq++; }
    L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (!o.keep && onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });
function ready(g, c, o) {
  if (c.zone === 'st' && c.pos === 'set') return c.turnIn !== g.turnNo;
  if (o.qp && c.zone === 'hand') return g.tp === c.owner && freeST(g, c.owner) >= 0 && !forbid(g, { type: 'setST', c, p: c.owner });
  return false;
}

// Raviel (only by its own rule, from the hand) and Sauropod Brachion (never from the Deck): one duel-long rule, installed by the
// first event any of them sees. PARTIAL: an effect that Special Summons Raviel from the hand is not stopped.
// ENGINE: no general "can't be Special Summoned" flag.
const LOCKS = {
  'Raviel, Lord of Phantasms': (g, a) => a.type === 'ss' && a.c.zone !== 'hand',
  'Sauropod Brachion': (g, a) => a.type === 'ss' && a.c.zone === 'deck',
};
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: (g) => { if (!g.f43lock) { g.f43lock = true; addRule(g, (g2, a) => { if (!a.c || a.type !== 'ss' || !a.c.id) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); } return false; } };

// Revoke Fusion: the Fusion Material Monsters a Fusion names
// the printed recipe (tx): the PSCT line (ps) of some Fusions leaves the materials out
const matNames = fx => [...((D(fx).tx || D(fx).ps || '').split(/\r?\n/)[0].matchAll(/"([^"]+)"/g))].map(m => m[1]);
// names compared without case: Air Neos prints "Elemental Hero Neos" for Elemental HERO Neos
const revokeHand = (g, p, fx) => { const ns = matNames(fx).map(n => n.toLowerCase()); return g.p[p].hand.filter(x => isMon(x) && ns.includes(D(x).n.toLowerCase()) && D(x).k !== 'ritual' && canSS(g, p, x)); };
const revokeFx = (g, p) => g.p[p].extra.filter(fx => D(fx).k === 'fusion' && revokeHand(g, p, fx).length > 0);
// Roll Out!: the monsters a Union monster's text lets it equip to
const isUnion = c => isMon(c) && /Union/.test(D(c).ab || '');
const unionOn = (g, m) => allField(g).some(x => x.equipTo === m.u && isMon(x));
// the names it lists ("equip it to your \"Freezing Beast\"", "Target 1 \"X-Head Cannon\" you control"), else a Type it names, else any monster
function unionTargets(g, p, u) { const qs = [...(D(u).tx || '').matchAll(/"([^"]+)"/g)].map(m => m[1]).filter(n => n !== D(u).n); const ns = qs.length ? qs : null;
  const mt = !ns && (D(u).tx || '').match(/equip (?:it|this card) to (?:your |a |an |1 )?(?:face-up )?(\w+)(?:-Type)? monster/i);
  return monsOf(g, p).filter(x => faceUp(x) && !unionOn(g, x) && (ns ? ns.includes(name(x)) : mt && mt[1] !== 'Monster' ? race(x) === mt[1] || attr(x) === mt[1].toUpperCase() : true)); }
// Road Warrior: "Road Synchron" + 2 or more non-Tuners
function roadMats(g, p, sx) {
  const mons = monsOf(g, p).filter(faceUp), out = [], n = mons.length;
  for (let mask = 1; mask < (1 << n) && out.length < 12; mask++) {
    const mats = mons.filter((_, i) => mask & (1 << i)); if (mats.length < 3) continue;
    const tun = mats.filter(x => D(x).tu); if (tun.length !== 1 || !named(tun[0], 'Road Synchron')) continue;
    if (mats.reduce((s, x) => s + lv(x), 0) !== lv(sx)) continue;
    out.push(mats);
  }
  return out;
}
// 0 DEF, not "?" (ruling)
const zeroDef = x => /^\s*0\s*$/.test(String(D(x).def));
const isEI = x => /^Earthbound Immortal/.test(name(x));

E.addScripts({
  /* ----- R ----- */
  // Moving keeps a face-down Rhynos moving (ruling). The 500 ATK applies in the Damage Step when it attacks the monster that
  // faces it (zones are mirrored: zone i faces the opponent's zone 4 - i).
  'Rampaging Rhynos': { self: { atk: (g, c) => g.inDS && g.battle && g.battle.a === c && g.battle.t && sameColumn(g, c, g.battle.t) ? 500 : 0 },
    effs: [{ type: 'ign', opt: true, label: 'Move to an adjacent zone', cond: (g, c) => adjFree(g, c).length > 0,
      res: function* (g, c, p) { yield* moveAdj(g, p, c); } }] },
  // A Continuous Effect: the damage comes right after the Normal Spell resolves (it is sent to the GY then), with no chain.
  'Rapid-Fire Magician': { effs: [{ type: 'trig', res: noop,
    on: (g, ev, c) => { if (ev.type === 'move' && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && ev.c !== c && isSpell(ev.c) && D(ev.c).sub === 'Normal' && ev.prevCtrl === c.ctrl && faceUp(c))
      damage(g, opp(c.ctrl), 400, { src: c, srcP: c.ctrl }); return false; } }] },
  'Raptor Wing Strike': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && /^Blackwing/.test(name(x))) && g.p[p].deck.some(x => isMon(x) && /^Blackwing/.test(D(x).n)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Shuffle which Blackwing monster you control into the Deck?', monsOf(g, p).filter(x => faceUp(x) && /^Blackwing/.test(name(x))), 1, 1, 'cost');
      if (x) { move(g, x, 'deck', { reason: 'cost' }); log(g, `${PN(g, p)} returned ${D(x).n} to the Deck.`); } },
    res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && /^Blackwing/.test(D(x).n), 'Add which Blackwing monster to your hand?'); } }] },
  // Phantasm Tokens can't declare an attack, even under Skill Drain (a flag on the Token).
  'Raviel, Lord of Phantasms': {
    proc: { label: 'Special Summon (Tribute 3 Fiends)', cond: (g, c, p) => monsOf(g, p).filter(x => race(x) === 'Fiend').length >= 3,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Tribute 3 Fiend monsters', monsOf(g, p).filter(x => race(x) === 'Fiend'), 3, 3, 'cost');
        for (const x of xs) move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${xs.map(x => D(x).n).join(', ')}.`); } },
    effs: [lockInstall,
      { type: 'trig', mand: true, tags: { ss: 1 }, label: 'Special Summon Phantasm Tokens',
        on: (g, ev, c) => ev.type === 'summon' && ['normal', 'tribute'].includes(ev.how) && ev.p !== c.ctrl,
        res: function* (g, c, p, L2) { const n = Math.min(L2.ev.cs.length, nFreeM(g, p)); if (n <= 0) return;
          const pos = yield* askPos(g, p, 'Phantasm Token');
          for (const t of tokens(g, p, { n: 'Phantasm Token', a: 'DARK', r: 'Fiend', lv: 1, atk: 1000, def: 1000 }, n, pos)) t.flags.cantAttack = true; } },
      { type: 'ign', opt: true, label: 'Tribute a monster: gain its ATK', cond: (g, c, p) => monsOf(g, p).some(x => x !== c),
        cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p).filter(x => x !== c), 1, 1, 'cost');
          if (!x) return; L2.data.n = baseAtk(x); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
        res: function* (g, c, p, L2) { if (!onField(c) || !faceUp(c)) return; addMod(g, c, { atk: L2.data.n || 0, end: true }); log(g, `${name(c)} gained ${L2.data.n || 0} ATK.`); } }] },
  // Destroyed at the start of the Damage Step, before it is flipped, so there is no damage calculation.
  'Razor Lizard': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the face-down monster',
    on: (g, ev, c) => ev.type === 'dsStart' && ev.a === c && !!ev.t && ev.t.pos === 'set' && monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && race(x) === 'Reptile'),
    res: function* (g, c, p, L2) { const t = L2.ev.t; if (t && onField(t) && t.pos === 'set' && monsOf(g, p).some(x => x !== c && faceUp(x) && race(x) === 'Reptile')) destroy(g, [t], { by: p, src: c }); } }] },
  // None of its effects activate: counters are placed as cards leave your Deck (once per batch of cards).
  'Realm of Light': {
    self: { replaceDestroy: (g, c, o) => { if (o.battle || o.rule || ctr(c, 'shine') < 2) return false; addCtr(g, c, 'shine', -2); log(g, 'Realm of Light removed 2 Shine Counters instead of being destroyed.'); return true; } },
    cont: { atk: (g, src, m) => isLS(m) ? 100 * ctr(src, 'shine') : 0 },
    effs: [actNoop, { type: 'trig', loc: 'fz', res: noop,
      on: (g, ev, c) => { if (ev.type === 'move' && ev.from === 'deck' && ev.to === 'gy' && ev.c.owner === c.ctrl && c.f43grp !== ev.group) { c.f43grp = ev.group; addCtr(g, c, 'shine', 1); g.seq++; log(g, `Realm of Light got a Shine Counter (${ctr(c, 'shine')}).`); } return false; } }] },
  'Reborn Zombie': { self: { noBattleDestroy: (g, c) => c.pos === 'atk' && g.p[c.ctrl].hand.length === 0 } },
  'Reckoned Power': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.p[p].hand.some(x => named(x, "Iron Core of Koa'ki Meiru")) && stOf(g, opp(p)).some(x => x.pos === 'set'),
    cost: function* (g, c, p) { log(g, `${PN(g, p)} revealed Iron Core of Koa'ki Meiru.`); },
    res: function* (g, c, p) { destroy(g, stOf(g, opp(p)).filter(x => x.pos === 'set'), { by: p, src: c }); } }] },
  'Recurring Nightmare': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK' && zeroDef(x)).length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which 2 DARK monsters with 0 DEF to your hand?', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK' && zeroDef(x)), 2, 2, 'good'); },
    res: function* (g, c, p, L2) { for (const x of L2.t.filter(x => x.zone === 'gy')) { move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${D(x).n} to the hand.`); } } }] },
  'Recycling Batteries': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && race(x) === 'Thunder' && baseAtk(x) <= 1500).length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which 2 Thunder monsters to your hand?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Thunder' && baseAtk(x) <= 1500), 2, 2, 'good'); },
    res: function* (g, c, p, L2) { for (const x of L2.t.filter(x => x.zone === 'gy')) { move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${D(x).n} to the hand.`); } } }] },
  'Regenerating Rose': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon 2 Regenerating Rose Tokens',
    on: (g, ev, c) => fromFieldToGY(ev, c) && ev.battle, cond: (g, c, p) => nFreeM(g, p) >= 2,
    res: function* (g, c, p) { if (nFreeM(g, p) < 2) return; const pos = yield* askPos(g, p, 'Regenerating Rose Tokens');
      tokens(g, p, { n: 'Regenerating Rose Token', a: 'DARK', r: 'Plant', lv: 3, atk: 1200, def: 1200 }, 2, pos); } }] },
  // ENGINE: no response window after a battle destruction, so it is offered as an optional trigger while it is Set.
  'Regretful Rebirth': { effs: [lateAct({ label: 'Special Summon the destroyed monster', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.to === 'gy' && ev.prevCtrl === c.ctrl && ev.c.owner === c.ctrl && isMon(ev.c),
    cond: (g, c, p) => freeM(g, p) >= 0,
    target: function* (g, c, p, L2) { const x = L2.ev && L2.ev.c; L2.t = x && x.zone === 'gy' ? [x] : []; },
    res: function* (g, c, p, L2) { const x = L2.t[0]; if (!x || x.zone !== 'gy' || !canSS(g, p, x)) return;
      if (ss(g, p, x, 'def')) later(c, { u: x.u, turn: g.turnNo, tp: p }); } }), laterTrig] },
  'Regulus': { effs: [{ type: 'ign', opt: true, label: 'Shuffle a Field Spell into the Deck',
    cond: (g, c, p) => g.p[p].gy.some(x => isSpell(x) && D(x).sub === 'Field'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Shuffle which Field Spell into the Deck?', g.p[p].gy.filter(x => isSpell(x) && D(x).sub === 'Field'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const x = L2.t[0]; if (x && x.zone === 'gy') { move(g, x, 'deck', { reason: 'effect', by: p }); log(g, `${D(x).n} was shuffled into the Deck.`); } } }] },
  // Two separate effects, two chains. The choice is made at resolution (ruling).
  'Reign-Beaux, Overlord of Dark World': { effs: [
    { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon this card',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'hand' && ev.to === 'gy' && ev.reason === 'discard' && byOpp(g, ev, c),
      res: function* (g, c, p) { if (c.zone !== 'gy' || freeM(g, p) < 0) return; c.f43rb = g.turnNo; if (!ss(g, p, c, 'atk')) c.f43rb = null; } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy all monsters or all Spells and Traps',
      on: (g, ev, c) => evSummoned(ev, c) && c.f43rb === g.turnNo,
      res: function* (g, c, p) { c.f43rb = null; const o = opp(p), opts = [];
        if (monsOf(g, o).length) opts.push('Destroy all their monsters'); if (stOf(g, o).length) opts.push('Destroy all their Spell and Trap Cards');
        if (!opts.length) return; const k = opts.length > 1 ? opts[yield* choose(g, p, 'Reign-Beaux: destroy which?', opts)] : opts[0];
        destroy(g, k.includes('monsters') ? monsOf(g, o) : stOf(g, o), { by: p, src: c }); } }] },
  'Reinforced Human Psychic Borg': { effs: [{ type: 'ign', label: 'Banish a Psychic: gain 500 ATK',
    cond: (g, c, p) => usedN(g, c, 'f43borg') < 2 && g.p[p].gy.some(x => isMon(x) && race(x) === 'Psychic'),
    cost: function* (g, c, p) { useN(g, c, 'f43borg'); const [x] = yield* pick(g, p, 'Banish which Psychic monster from your GY?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Psychic'), 1, 1, 'cost');
      if (x) { move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
    res: function* (g, c, p) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500 }); log(g, `${name(c)} gained 500 ATK.`); } } }] },
  'Relieve Monster': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && monsOf(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which monster you control to the hand?', monsOf(g, p), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.ctrl !== p) return;
      move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${D(t).n} returned to the hand.`);
      const cs = g.p[p].hand.filter(x => isMon(x) && lv(x) === 4 && D(x).k !== 'ritual' && canSS(g, p, x)); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which Level 4 monster from your hand?', cs, 1, 1, 'good'); if (!x) return;
      ss(g, p, x, yield* askPos(g, p, name(x))); } }] },
  'Relinquished Spider': { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Tribute: destroy face-up Defense monsters',
    cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && race(x) === 'Insect').length >= 4,
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Relinquished Spider.`); },
    res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)).filter(x => x.pos === 'def'), { by: p, src: c }); } }] },
  // PARTIAL: "an appropriate monster" is read as any monster the opponent controls in the same face-up/face-down state.
  'Remote Revenge': { effs: [{ type: 'act',
    cond: (g, c, p, x) => { const t = x.top; if (!t || t.c === c || !(t.tags && t.tags.destroy)) return false; const ms = t.t.filter(isMon);
      return ms.length === 1 && onField(ms[0]) && ms[0].ctrl === p && monsOf(g, opp(p)).length > 0; },
    target: function* (g, c, p, L2) { L2.data.link = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const l = L2.data.link; if (!l || !g.chain.includes(l)) return; const old = l.t.find(isMon); if (!old) return;
      const cs = monsOf(g, opp(p)).filter(x => x !== old && (old.pos === 'set') === (x.pos === 'set')); if (!cs.length) return;
      const [n] = yield* pick(g, p, 'Switch the target to which monster?', cs, 1, 1, 'bad'); if (!n) return;
      l.t = l.t.map(x => x === old ? n : x); log(g, `The target was switched to ${shownName(n)}.`); } }] },
  'Rescueroid': { effs: [{ type: 'trig', when: true, label: 'Return the roid monster to the hand',
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.to === 'gy' && ev.c !== c && ev.prevCtrl === c.ctrl && ev.snap && /roid/.test(ev.snap.name),
    res: function* (g, c, p, L2) { const x = L2.ev.c; if (x.zone !== 'gy') return; move(g, x, isExtraD(D(x)) ? 'extra' : 'hand', { reason: 'effect', by: p });
      log(g, `${D(x).n} returned to ${isExtraD(D(x)) ? 'the Extra Deck' : 'the hand'}.`); } }] },
  // The Arcana Force scripts (full-29.js) keep their coin result in c.flags.arc ('H' or 'T'); this swaps it while the monster stays
  // face-up (a move clears the flags). PARTIAL: The Chariot turned to Tails this way does not change control.
  'Reversal of Fate': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && /^Arcana Force/.test(name(x))),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which Arcana Force monster?', monsOf(g, p).filter(x => faceUp(x) && /^Arcana Force/.test(name(x))), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { if (t.flags.arc) t.flags.arc = t.flags.arc === 'H' ? 'T' : 'H'; t.flags.coinReversed = !t.flags.coinReversed; g.seq++; log(g, `${name(t)}'s coin toss result is now the opposite.`); } } }] },
  // ENGINE: no response window right after a destruction, so it is an optional trigger from the hand (your turn) or while Set.
  'Reverse of Neos': { effs: [lateAct({ qp: true, label: 'Special Summon Elemental HERO Neos', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.destroyed && ev.wasField && ev.snap && ev.snap.faceUp && ev.prevCtrl === c.owner && D(ev.c).k === 'fusion' && /Neos/.test(ev.snap.name),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => named(x, 'Elemental HERO Neos')),
    res: function* (g, c, p) { const x = g.p[p].deck.find(y => named(y, 'Elemental HERO Neos')); if (!x || freeM(g, p) < 0) return;
      if (ss(g, p, x, 'atk')) { shuffleDeck(g, p); addMod(g, x, { atk: 1000 }); log(g, `${name(x)} gained 1000 ATK.`); later(c, { u: x.u, turn: g.turnNo }); } else shuffleDeck(g, p); } }), laterTrig] },
  'Revoke Fusion': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => x !== c && named(x, 'Polymerization')) && revokeFx(g, p).length > 0,
    cost: function* (g, c, p) { const x = g.p[p].hand.find(y => y !== c && named(y, 'Polymerization')); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded Polymerization.`); } },
    res: function* (g, c, p) { const fs = revokeFx(g, p); if (!fs.length || freeM(g, p) < 0) return;
      const [fx] = yield* pick(g, p, 'Send which Fusion Monster from your Extra Deck to the GY?', fs, 1, 1, 'good'); if (!fx) return;
      const hs = revokeHand(g, p, fx); move(g, fx, 'gy', { reason: 'effect', by: p }); log(g, `${PN(g, p)} sent ${D(fx).n} from the Extra Deck to the GY.`);
      const [x] = yield* pick(g, p, 'Special Summon which Fusion Material Monster from your hand?', hs.filter(y => y.zone === 'hand'), 1, 1, 'good'); if (!x) return;
      if (ss(g, p, x, yield* askPos(g, p, name(x)))) later(c, { u: x.u, turn: g.turnNo, how: 'gy' }); } }, laterTrig] },
  // The Ribbon remembers what it was equipped to; in the End Phase it Special Summons that monster from the GY if it was destroyed
  // by battle and sent there this turn, as long as the Ribbon is in the GY or banished (ruling).
  'Ribbon of Rebirth': { effs: [{ type: 'act',
    cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Ribbon of Rebirth to which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && equip(g, c, t)) { c.f43eq = t.u; c.f43by = p; } } },
    { type: 'trig', loc: 'any', mand: true, tags: { ss: 1 }, label: 'Special Summon the monster',
      on: (g, ev, c) => { if (c.equipTo) c.f43eq = c.equipTo; if (ev.type === 'move' && ev.c === c && ev.wasField) c.f43eq = null;
        if (ev.type === 'move' && c.f43eq && ev.c.u === c.f43eq) { if (ev.battle && ev.to === 'gy') c.f43rib = { u: ev.c.u, turn: g.turnNo, p: onField(c) ? c.ctrl : c.f43by != null ? c.f43by : c.owner }; c.f43eq = null; }
        return ev.type === 'phase' && ev.ph === 'end' && !!c.f43rib && c.f43rib.turn === g.turnNo && ['gy', 'ban'].includes(c.zone); },
      res: function* (g, c) { const r = c.f43rib; c.f43rib = null; if (!r) return; const x = allCards(g, 'gy').find(y => y.u === r.u); if (!x || freeM(g, r.p) < 0) return; ss(g, r.p, x, 'atk'); } }] },
  'Rigorous Reaver': { effs: [flip('Each player discards 1 card', {
      res: function* (g, c, p) { for (const q of [p, opp(p)]) { const h = g.p[q].hand; if (!h.length) continue; const [x] = yield* pick(g, q, 'Discard 1 card', h, 1, 1, 'cost');
        if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, q)} discarded ${D(x).n}.`); } } } }),
    { type: 'trig', loc: 'any', mand: true, label: 'The monster that destroyed it loses 500 ATK and DEF',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.wasField && !!ev.killer,
      res: function* (g, c, p, L2) { const k = L2.ev.killer; if (k && onField(k) && faceUp(k) && k.zone === 'm') { addMod(g, k, { atk: -500, def: -500 }); log(g, `${name(k)} lost 500 ATK and DEF.`); } } }] },
  'Rinyan, Lightsworn Rogue': { effs: [flip('Shuffle a Lightsworn monster into the Deck, then draw',
    { cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && /Lightsworn/.test(D(x).n)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Shuffle which Lightsworn monster into the Deck?', g.p[p].gy.filter(x => isMon(x) && /Lightsworn/.test(D(x).n)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const x = L2.t[0]; if (!x || x.zone !== 'gy') return; move(g, x, isExtraD(D(x)) ? 'extra' : 'deck', { reason: 'effect', by: p }); log(g, `${D(x).n} was shuffled into the Deck.`); draw(g, p, 1); } })] },
  // Halves the current ATK of the first target; the other gains what it lost (both until the end of the turn).
  'Riryoku': { effs: [{ type: 'act', cond: g => fieldMons(g).filter(faceUp).length >= 2,
    target: function* (g, c, p, L2) {
      const [a] = yield* pick(g, p, 'Halve the ATK of which monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad');
      const [b] = yield* pick(g, p, 'Which monster gains the lost ATK?', fieldMons(g).filter(m => faceUp(m) && m !== a), 1, 1, 'good');
      L2.t = [a, b].filter(Boolean); },
    res: function* (g, c, p, L2) { const [a, b] = L2.t; if (!a || !onField(a) || !faceUp(a)) return; const A = stat(g, a, 'atk'), lost = A - Math.floor(A / 2);
      addMod(g, a, { atk: -lost, end: true }); log(g, `${name(a)}'s ATK was halved.`);
      if (b && onField(b) && faceUp(b)) { addMod(g, b, { atk: lost, end: true }); log(g, `${name(b)} gained ${lost} ATK.`); } } }] },
  // ENGINE: no response window right after a destruction, so it is an optional trigger while Set.
  'Rise of the Snake Deity': { effs: [lateAct({ label: 'Special Summon Vennominaga', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.destroyed && !ev.battle && ev.wasField && ev.snap && ev.snap.faceUp && ev.prevCtrl === c.ctrl && ev.snap.name === 'Vennominon the King of Poisonous Snakes',
    cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Vennominaga the Deity of Poisonous Snakes')),
    res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Vennominaga the Deity of Poisonous Snakes')); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which Vennominaga?', cs, 1, 1, 'good'); if (!x) return; const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } })] },
  'Rising Energy': { effs: [{ type: 'act', ds: true,
    cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && fieldMons(g).some(faceUp),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand.filter(x => x !== c), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${D(x).n}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which face-up monster gains 1500 ATK?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: 1500, end: true }); log(g, `${name(t)} gained 1500 ATK.`); } } }] },
  // PARTIAL / ENGINE: the Synchro material check reads its printed Level, so for Synchros other than Road Warrior it still counts
  // as Level 4 (no per-Synchro material Level hook).
  'Road Synchron': { effs: [{ type: 'trig', mand: true, label: 'Level up by 1',
    on: (g, ev, c) => ev.type === 'dsEnd' && ev.a === c,
    res: function* (g, c) { if (!onField(c) || !faceUp(c)) return; c.flags.lv = lv(c) + 1; c.flags.lvUntil = true; g.seq++; log(g, `${name(c)} is now Level ${lv(c)}.`); } }] },
  // PARTIAL: Synchro Summoned with its own rule ("Road Synchron" + 2 or more non-Tuners), always in Attack Position.
  'Road Warrior': { noSynchro: true,
    proc: { extra: true, how: 'synchro', label: 'Synchro Summon', cond: (g, c, p) => roadMats(g, p, c).length > 0,
      cost: function* (g, c, p, grp) { const cs = roadMats(g, p, c); let mats = cs[0];
        if (cs.length > 1) { const i = yield* choose(g, p, 'Synchro Summon Road Warrior with which monsters?', cs.map(m => m.map(name).join(' + '))); mats = cs[i]; }
        for (const m of mats) move(g, m, 'gy', { reason: 'synchro', by: p, group: grp }); log(g, `${PN(g, p)} sent ${mats.map(m => D(m).n).join(' + ')} to the GY for a Synchro Summon.`); } },
    effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Special Summon a Level 2 or lower Warrior or Machine',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && lv(x) <= 2 && ['Warrior', 'Machine'].includes(race(x)) && canSS(g, p, x)),
      res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isMon(x) && lv(x) <= 2 && ['Warrior', 'Machine'].includes(race(x)) && canSS(g, p, x)); if (!cs.length || freeM(g, p) < 0) { shuffleDeck(g, p); return; }
        const [x] = yield* pick(g, p, 'Special Summon which monster from your Deck?', cs, 1, 1, 'good'); if (x) ss(g, p, x, yield* askPos(g, p, name(x))); shuffleDeck(g, p); } }] },
  'Roar of the Earthbound Immortal': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, opt: true, tags: { destroy: 1 }, label: 'Destroy the attacker',
      on: (g, ev, c) => ev.type === 'attack' && ev.a.ctrl !== c.ctrl,
      cond: (g, c, p) => !!g.aw && onField(g.aw.a) && monsOf(g, p).some(x => faceUp(x) && isEI(x) && atk(g, x) > atk(g, g.aw.a)),
      target: function* (g, c, p, L2) { L2.t = g.aw && g.aw.a ? [g.aw.a] : []; },
      res: function* (g, c, p, L2) { const a = live(L2)[0]; if (!a || !faceUp(a) || !monsOf(g, p).some(x => faceUp(x) && isEI(x) && atk(g, x) > atk(g, a))) return;
        const A = atk(g, a); if (destroy(g, [a], { by: p, src: c }).length) damage(g, opp(p), Math.floor(A / 2), { src: c, srcP: p }); } }] },
  "Robbin' Zombie": { effs: [actNoop, { type: 'trig', loc: 'st', mand: true, label: 'Send the top card of their Deck to the GY',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.p !== c.ctrl && ev.srcP === c.ctrl,
    res: function* (g, c, p) { mill(g, opp(p), 1); } }] },
  'Rockstone Warrior': { self: { noBattleDamage: true },
    effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon 2 Rockstone Tokens',
      on: (g, ev, c) => fromFieldToGY(ev, c) && ev.battle && !!g.battle && g.battle.a === c,
      res: function* (g, c, p) { const n = Math.min(2, nFreeM(g, p)); if (n <= 0) return; const pos = yield* askPos(g, p, 'Rockstone Tokens');
        tokens(g, p, { n: 'Rockstone Token', a: 'EARTH', r: 'Rock', lv: 1, atk: 0, def: 0 }, n, pos, { noTribute: true }); } }] },
  'Roll Out!': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].st.filter(z => !z).length >= (c.zone === 'st' ? 1 : 2) && g.p[p].gy.some(u => isUnion(u) && unionTargets(g, p, u).length > 0),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip which Union monster from your GY?', g.p[p].gy.filter(u => isUnion(u) && unionTargets(g, p, u).length > 0), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const u = L2.t[0]; if (!u || u.zone !== 'gy') return; const ts = unionTargets(g, p, u); if (!ts.length) return;
      const [t] = yield* pick(g, p, `Equip ${D(u).n} to which monster?`, ts, 1, 1, 'good'); if (!t) return;
      // the Roll Out! card itself still holds a zone while it resolves
      const fz = g.p[p].st.findIndex(z => !z); if (fz < 0) return;
      move(g, u, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); u.equipTo = t.u; u.flags.union = true; log(g, `${D(u).n} was equipped to ${name(t)}.`); } }] },
  'Rose, Warrior of Revenge': { effs: [{ type: 'trig', mand: true, label: 'Inflict 300 damage',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    res: function* (g, c, p) { damage(g, opp(p), 300, { src: c, srcP: p }); } }] },
  'Ruin, Queen of Oblivion': { effs: [{ type: 'trig', opt: true, label: 'Attack again',
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.prevCtrl !== c.ctrl && !!g.battle && g.battle.a === c,
    res: function* (g, c) { if (onField(c) && faceUp(c)) { c.flags.extraAttack = g.turnNo; log(g, `${name(c)} can attack again.`); } } }] },
  'Ruthless Denial': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).length > 0 && g.p[opp(p)].hand.length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which monster you control?', monsOf(g, p), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0], h = g.p[opp(p)].hand; if (!t || t.ctrl !== p || !h.length) return;
      const x = h[Math.floor(g.rnd() * h.length)]; const grp = g.group;
      move(g, t, 'gy', { reason: 'effect', by: p, group: grp }); move(g, x, 'gy', { reason: 'effect', by: p, group: grp });
      log(g, `${D(t).n} and ${D(x).n} (at random from ${PN(g, opp(p))}'s hand) were sent to the GY.`); } }] },

  /* ----- S ----- */
  'Sage of Silence': { effs: [{ type: 'trig', loc: 'any', mand: true, label: 'No Spell Cards next turn',
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.prevCtrl !== (onField(c) ? c.ctrl : c.owner) && !(onField(c) && negd(g, c)),
    res: function* (g, c, p) { const T = g.turnNo + 1, o = opp(p); addRule(g, (g2, a) => g2.turnNo === T && a.type === 'activate' && a.p === o && a.eff && a.eff.type === 'act' && isSpell(a.c), { end: T });
      log(g, `${PN(g, o)} can't activate Spell Cards next turn.`); } }] },
  'Sage of Stillness': { effs: [{ type: 'trig', loc: 'any', mand: true, label: 'No Trap Cards next turn',
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.prevCtrl !== (onField(c) ? c.ctrl : c.owner) && !(onField(c) && negd(g, c)),
    res: function* (g, c, p) { const T = g.turnNo + 1, o = opp(p); addRule(g, (g2, a) => g2.turnNo === T && a.type === 'activate' && a.p === o && isTrap(a.c), { end: T });
      log(g, `${PN(g, o)} can't activate Trap Cards next turn.`); } }] },
  // A face-down Flip monster flipped this way activates its Flip effect.
  'Samurai Sword Baron': { effs: [{ type: 'ign', opt: true, label: 'Change a Defense monster to Attack',
    cond: (g, c, p) => monsOf(g, opp(p)).some(x => x.pos !== 'atk'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change which Defense Position monster to Attack Position?', monsOf(g, opp(p)).filter(x => x.pos !== 'atk'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.pos === 'atk') return; const wasSet = t.pos === 'set';
      toPos(g, t, 'atk'); if (wasSet) { log(g, `It was ${name(t)}.`); emit(g, { type: 'flip', c: t, p: t.ctrl }); } } }] },
  // PARTIAL: the swapped original DEF is shown as a -1000 DEF change (the engine has no original-DEF override).
  'Sand Moth': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon this card',
    on: (g, ev, c) => fromFieldToGY(ev, c) && ev.destroyed && !ev.battle && ev.snap && ev.snap.pos === 'set',
    res: function* (g, c) { const q = c.owner; if (c.zone !== 'gy' || freeM(g, q) < 0) return;
      if (ss(g, q, c, 'atk')) { c.flags.baseAtk = 2000; addMod(g, c, { def: -1000 }); g.seq++; log(g, 'Sand Moth now has 2000 ATK and 1000 DEF.'); } } }] },
  // Its continuous effects start no chain; "destroy this card" is done as a mandatory trigger. PARTIAL: face-down cards turned
  // face-up by other ways (Flip effects of monsters) are not covered, only Spell/Trap activations.
  'Sanguine Swamp': {
    cont: { forbid: (g, src, a) => a.type === 'activate' && a.eff && a.eff.type === 'act' && a.c !== src && ['st', 'fz'].includes(a.c.zone) && a.c.pos === 'set' },
    // activated while you control another Spell/Trap: destroyed once it resolves (ruling)
    effs: [{ type: 'act', res: function* (g, c, p) { c.f43n = 0; if (onField(c) && stOf(g, p).some(x => x !== c)) destroy(g, [c], { by: p, rule: true }); } },
      { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy Sanguine Swamp',
        on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl) c.f43n = (c.f43n || 0) + 1;
          return !g.chain.length && (stOf(g, c.ctrl).some(x => x !== c) || (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.f43n >= 2)); },
        res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p, rule: true }); } }] },
  'Satellite Cannon': {
    self: { noBattleDestroy: (g, c) => { const f = foeOf(g, c); return !!f && lv(f) <= 7; } },
    effs: [{ type: 'trig', mand: true, label: 'Gain 1000 ATK', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 1000, sat: true }); log(g, `${name(c)} gained 1000 ATK.`); } } },
    { type: 'trig', mand: true, label: 'The gained ATK returns to 0', on: (g, ev, c) => ev.type === 'afterCalc' && ev.a === c && c.mods.some(m => m.sat),
      res: function* (g, c) { c.mods = c.mods.filter(m => !m.sat); g.seq++; log(g, `${name(c)}'s gained ATK returned to 0.`); } }] },
  // PARTIAL: "Tribute 1 Dinosaur" lets any 1 monster be the Tribute when you control a Dinosaur, and a Set with 1 Tribute is
  // allowed too (the engine's Tribute hook has no per-monster or Summon-only check).
  'Sauropod Brachion': {
    self: { tributes: (g, c, p) => monsOf(g, p).some(x => race(x) === 'Dinosaur') ? 1 : null },
    cont: { dmg: (g, src, p, n, o) => o.battle && g.battle && g.battle.t === src && p !== src.ctrl ? 2 * n : undefined },
    effs: [lockInstall,
      { type: 'ign', opt: true, label: 'Change to face-down Defense', cond: (g, c) => c.pos !== 'set',
        res: function* (g, c) { if (onField(c) && faceUp(c)) { setFaceDown(g, c); c.posChanged = true; } } },
      { type: 'trig', mand: true, label: 'Change all other monsters to face-down Defense', on: (g, ev, c) => evSummoned(ev, c, ['flip']),
        res: function* (g, c) { for (const x of fieldMons(g)) if (x !== c && faceUp(x)) setFaceDown(g, x); } }] },
  // ENGINE: no forced attacks, so "All Attack Position monsters must attack if able" is not enforced.
  // PARTIAL: an attack negated after it was declared still counts as declared.
  'Savage Colosseum': { effs: [actNoop,
    { type: 'trig', loc: 'fz', mand: true, label: 'Gain 300 LP', on: (g, ev, c) => ev.type === 'dsEnd' && onField(ev.a),
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (onField(a)) gain(g, a.ctrl, 300); } },
    { type: 'trig', loc: 'fz', mand: true, tags: { destroy: 1 }, label: 'Destroy monsters that did not attack', on: (g, ev) => ev.type === 'phase' && ev.ph === 'end',
      res: function* (g, c, p) { destroy(g, monsOf(g, g.tp).filter(x => x.pos === 'atk' && !x.declared), { by: p, src: c }); } }] },
  // ENGINE: no name or Attribute change; the Level, ATK and DEF are copied until the End Phase, and it is banished if it leaves
  // the field while that applies.
  'Scanner': { effs: [{ type: 'ign', opt: true, label: 'Copy a banished monster',
    cond: (g, c, p) => g.p[opp(p)].ban.some(isMon),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Copy which of your opponent’s banished monsters?', g.p[opp(p)].ban.filter(isMon), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const x = L2.t[0]; if (!x || x.zone !== 'ban' || !onField(c) || !faceUp(c)) return;
      c.flags.lv = lv(x); c.flags.lvUntil = true; c.flags.banishOnLeave = true; c.flags.f43scan = g.turnNo;
      addMod(g, c, { set: baseAtk(x), which: 'atk', end: true }); addMod(g, c, { set: num(D(x).def), which: 'def', end: true }); g.seq++;
      log(g, `${name(c)} copied ${D(x).n}.`); } },
    { type: 'trig', mand: true, res: noop, on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'end' && c.flags.f43scan != null) { c.flags.banishOnLeave = false; c.flags.f43scan = null; } return false; } }] },
  'Scarr, Scout of Dark World': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Add a Dark World monster',
    on: (g, ev, c) => fromFieldToGY(ev, c) && ev.battle,
    res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && lv(x) <= 4 && /Dark World/.test(D(x).n), 'Add which Level 4 or lower Dark World monster?'); } }] },
  // Special Summons made before it was face-up don't count; its own Summon doesn't count either.
  'Scary Moth': {
    cont: { forbid: (g, src, a) => a.type === 'ss' && !!src.f43ss && src.f43ss.turn === g.turnNo && !!src.f43ss[a.p] },
    effs: [{ type: 'trig', res: noop, on: (g, ev, c) => {
      if (ev.type === 'summon' && !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how) && !ev.cs.includes(c)) {
        if (!c.f43ss || c.f43ss.turn !== g.turnNo) c.f43ss = { turn: g.turnNo }; c.f43ss[ev.p] = true; g.seq++; }
      return false; } }] },
  'Sea Koala': { effs: [{ type: 'ign', opt: true, label: 'Change a monster’s ATK to 0',
    cond: (g, c, p) => oppFaceUp(g, p).length > 0 && monsOf(g, p).some(x => x !== c && faceUp(x) && race(x) === 'Beast'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change the ATK of which monster to 0?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !monsOf(g, p).some(x => x !== c && faceUp(x) && race(x) === 'Beast')) return;
      addMod(g, t, { set: 0, which: 'atk', end: true }); log(g, `${name(t)}'s ATK became 0.`); } }] },
  // ENGINE: negating a face-up Spell/Trap stops its activated effects only for monsters; a negated Spell/Trap's continuous
  // effects still apply (the engine's negation hook covers monsters).
  'Seal of Wickedness': {
    cont: { negates: (g, src, c) => !!src.f43seal && src.f43seal.turn === g.turnNo && src.f43seal.u === c.u && onField(c) },
    effs: [actNoop,
      { type: 'trig', loc: 'st', mand: true, opt: true, label: 'Negate a face-up card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl,
        cond: g => allField(g).some(faceUp),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Negate the effects of which face-up card this turn?', allField(g).filter(faceUp), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c)) return; c.f43seal = { u: t.u, turn: g.turnNo }; g.seq++; log(g, `${name(t)}'s effects are negated this turn.`); } },
      { type: 'trig', loc: 'st', mand: true, label: 'Pay 500 LP or destroy Seal of Wickedness', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
        res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 500 && (yield* yn(g, p, 'Pay 500 LP to keep Seal of Wickedness?'))) pay(g, p, 500); else destroy(g, [c], { by: p, rule: true }); } }] },
  'Search Striker': { effs: [{ type: 'trig', tags: { destroy: 1 }, label: 'Destroy the face-down monster',
      on: (g, ev, c) => ev.type === 'dsStart' && ev.a === c && !!ev.t && ev.t.pos === 'set',
      res: function* (g, c, p, L2) { const t = L2.ev.t; if (!t || !onField(t) || t.pos !== 'set') return;
        if (destroy(g, [t], { by: p, src: c }).length && onField(c)) { c.flags.f43strike = g.turnNo; const T = g.turnNo + 2; addRule(g, (g2, a) => a.type === 'pos' && a.c === c, { end: T }); } } },
    { type: 'trig', mand: true, label: 'Change to Defense Position', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'bpEnd' && c.flags.f43strike === g.turnNo,
      res: function* (g, c) { toPos(g, c, 'def'); } }] },
  // PARTIAL: effects that turn monsters face-down aren't stopped (setFaceDown has no forbid check).
  'Searchlightman': { effs: [flip('Your opponent can’t Set cards this turn', {
    res: function* (g, c, p) { const o = opp(p), T = g.turnNo; addRule(g, (g2, a) => (a.type === 'set' || a.type === 'setST') && a.p === o, { end: T }); log(g, `${PN(g, o)} can't Set cards this turn.`); } })] },
  'Secrets of the Gallant': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && (D(x).k === 'normal' || (isGemini(x) && !x.flags.gemini))),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which Normal Monster?', monsOf(g, p).filter(x => faceUp(x) && (D(x).k === 'normal' || (isGemini(x) && !x.flags.gemini))), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; (c.f43sg || (c.f43sg = [])).push({ u: t.u, turn: g.turnNo }); log(g, `${name(t)} was selected.`); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Your opponent discards 2 random cards',
      on: (g, ev, c) => ev.type === 'damage' && ev.battle && !!ev.src && !!c.f43sg && c.f43sg.some(e => e.turn === g.turnNo && e.u === ev.src.u) && ev.p !== ev.src.ctrl,
      res: function* (g, c, p) { const o = opp(p); for (let i = 0; i < 2 && g.p[o].hand.length; i++) { const h = g.p[o].hand; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, o)} discarded ${D(x).n} at random.`); } } }] },
  'Security Orb': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && onField(g.aw.a),
    target: function* (g, c, p, L2) { L2.t = [g.aw.a]; },
    res: function* (g, c, p, L2) { const a = live(L2)[0]; if (!a || a.zone !== 'm') return; toPos(g, a, a.pos === 'atk' ? 'def' : 'atk'); } },
    { type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy 1 monster on the field',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'st' && ev.to === 'gy' && ev.destroyed && ev.snap && !ev.snap.faceUp && !!g.resolvingL && isST(g.resolvingL.c) && g.resolvingL.p !== c.owner,
      cond: g => fieldMons(g).length > 0,
      res: function* (g, c, p) { const [x] = yield* pick(g, p, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); if (x) destroy(g, [x], { by: p, src: c }); } }] },
  'Seismic Crasher': { effs: [{ type: 'ign', label: 'Send a Continuous card: 500 damage',
    cond: (g, c, p) => usedN(g, c, 'f43crash') < 2 && stOf(g, p).some(x => faceUp(x) && D(x).sub === 'Continuous'),
    cost: function* (g, c, p) { useN(g, c, 'f43crash'); const [x] = yield* pick(g, p, 'Send which face-up Continuous Spell or Trap to the GY?', stOf(g, p).filter(x => faceUp(x) && D(x).sub === 'Continuous'), 1, 1, 'cost');
      if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  // ENGINE: no response window right after a destruction, so it is an optional trigger while Set.
  // PARTIAL: the lock is kept as a count (see the forbid below), since the engine picks the zone a card lands in. The Dinosaur is
  // chosen when it destroys itself.
  'Seismic Shockwave': {
    cont: { forbid: (g, src, a) => { if (!src.f43zones || !a.c || a.p !== opp(src.ctrl)) return false;
      const fromHandST = (a.type === 'setST' || (a.type === 'activate' && a.eff && a.eff.type === 'act' && a.c.zone === 'hand')) && isST(a.c) && D(a.c).sub !== 'Field';
      if (!fromHandST) return false;
      // PARTIAL: the engine picks the zone a card goes to, so the lock is kept as a count: the opponent keeps at least as many
      // empty zones as were locked.
      return g.p[a.p].st.filter(z => !z).length <= src.f43zones.length; } },
    effs: [lateAct({ keep: true, label: 'Lock 3 of your opponent’s Spell and Trap Zones',
      on: (g, ev, c) => !g.inDS && ev.type === 'move' && ev.destroyed && ev.to === 'gy' && ev.wasField && ev.snap && ev.snap.faceUp && ev.prevCtrl === c.ctrl && ev.snap.race === 'Dinosaur',
      res: function* (g, c, p) { const st = g.p[opp(p)].st; c.f43zones = st.map((z, i) => z ? -1 : i).filter(i => i >= 0).slice(0, 3); c.f43n = 0; g.seq++;
        log(g, `${PN(g, opp(p))} can't use ${c.f43zones.length} of their Spell and Trap Zones.`); } }),
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy Seismic Shockwave',
      on: (g, ev, c) => { if (!(c.f43zones && ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl)) return false; c.f43n = (c.f43n || 0) + 1; return c.f43n >= 3; },
      res: function* (g, c, p) { if (!onField(c) || !destroy(g, [c], { by: p, src: c }).length) return;
        const ds = g.p[p].gy.filter(x => isMon(x) && race(x) === 'Dinosaur'); if (!ds.length || !(yield* yn(g, p, 'Add a Dinosaur from your GY to your hand?'))) return;
        const [x] = yield* pick(g, p, 'Add which Dinosaur to your hand?', ds, 1, 1, 'good'); if (x) { move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${D(x).n} to the hand.`); } } }] },
  'Senet Switch': { effs: [actNoop, { type: 'ign', loc: 'st', opt: true, label: 'Move a monster to an adjacent zone',
    cond: (g, c, p) => monsOf(g, p).some(x => adjFree(g, x).length > 0),
    res: function* (g, c, p) { const cs = monsOf(g, p).filter(x => adjFree(g, x).length > 0); if (!cs.length) return; const [x] = yield* pick(g, p, 'Move which monster?', cs, 1, 1, 'good'); if (x) yield* moveAdj(g, p, x); } }] },
  'Serpent Suppression': { effs: [actNoop],
    cont: { grant: (g, src, c, flag) => { if (flag !== 'noBattleDestroy' || c.ctrl === src.ctrl || c.zone !== 'm' || c.pos !== 'atk') return false;
      const f = foeOf(g, c); return !!f && /^Reptilianne/.test(name(f)) && atk(g, c) === 0; } } },
  'Shadowpriestess of Ohm': { effs: [{ type: 'ign', label: 'Tribute a DARK monster: 800 damage',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && attr(x) === 'DARK'),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which face-up DARK monster?', monsOf(g, p).filter(x => faceUp(x) && attr(x) === 'DARK'), 1, 1, 'cost');
      if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    res: function* (g, c, p) { damage(g, opp(p), 800, { src: c, srcP: p }); } }] },
  'Shark Cruiser': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon up to 2 WATER monsters',
    on: (g, ev, c) => fromFieldToGY(ev, c) && ev.destroyed && !ev.battle && ev.snap && ev.snap.faceUp && ev.prevCtrl === c.owner && byOpp(g, ev, c),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && attr(x) === 'WATER' && lv(x) <= 4 && canSS(g, p, x)),
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isMon(x) && attr(x) === 'WATER' && lv(x) <= 4 && canSS(g, p, x)); const n = Math.min(2, nFreeM(g, p));
      if (!cs.length || n <= 0) { shuffleDeck(g, p); return; }
      const xs = yield* pick(g, p, `Special Summon up to ${n} WATER monster${n > 1 ? 's' : ''} from your Deck`, cs, 1, n, 'good'); for (const x of xs) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
});
})();
