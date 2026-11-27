/* Full pool batch 01: Gladiator Beast, A-Counter cards, "A ..." cards, Amazoness, Ancient Gear, Ancient and Anti cards.
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, setFaceDown, negate, addMod,
  equip, equippedTo, link, addCtr, ctr, negateAttack, endBattle, addRule, token, tokens, fusionSummon, canFusion, ritualSummon, canRitual,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned,
  fromFieldToGY, battleKill, isGemini, forbid, num, tributeCands } = L;
const atk = L.atk, def = L.def;

/* ---------- shared helpers ---------- */
const nm = x => D(x).n;
const isGB = x => /^Gladiator Beast/.test(nm(x));
const gbMon = x => isMon(x) && isGB(x);
const isAG = x => isMon(x) && /^Ancient Gear/.test(name(x));
const isAmz = x => isMon(x) && /Amazon/.test(name(x)); // "Amazoness" monsters (and Amazon Archer, the old name)
const isAlien = x => isMon(x) && /Alien/.test(name(x));
const SSTYPES = ['special', 'synchro', 'fusion', 'ritual'];
const wasSS = x => SSTYPES.includes(x.summonType) || D(x).k === 'token';
const discard1 = function* (g, p, except) { const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand.filter(y => y !== except), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${nm(x)}.`); } return x; };
function* posPick(g, p, x) { const i = yield* choose(g, p, `${nm(x)}: which position?`, ['Attack Position', 'Defense Position']); return i ? 'def' : 'atk'; }
const canBeSSFromHand = x => isMon(x) && !['ritual', 'fusion', 'synchro', 'token'].includes(D(x).k) && !/Cannot be (Normal Summoned|Special Summoned)/i.test(D(x).ps || D(x).tx || '') && !/Must (first )?be Special Summoned/i.test(D(x).ps || D(x).tx || '') && !(D(x).ab || '').split(' ').includes('Spirit');
// Opponent can't activate Spell/Trap Cards while this card attacks, until the end of the Damage Step (Ancient Gear)
const atkLock = { forbid: (g, src, a) => a.type === 'activate' && a.eff.type === 'act' && isST(a.c) && a.p !== src.ctrl && ((g.aw && g.aw.a === src) || (g.battle && g.battle.a === src)) };
// "Special Summoned by the effect of a Gladiator Beast monster": the flag is set before the summon so "when summoned" checks see it
function gbSS(g, p, x, pos = 'atk') { x.flags.gb = true; const ok = ss(g, p, x, pos); if (!ok) delete x.flags.gb; return ok; }
const byGB = (ev, c) => evSummoned(ev, c) && c.flags.gb;
// remembers that this monster was in damage calculation this turn ("if this card battled")
const battledHook = { type: 'trig', on: (g, ev, c) => { if (ev.type === 'afterCalc' && (ev.a === c || ev.t === c)) c.flags.battled = g.turnNo; return false; }, res: function* () {} };
const endBP = (g, ev, c) => ev.type === 'phase' && ev.ph === 'bpEnd' && c.zone === 'm' && faceUp(c) && c.flags.battled === g.turnNo;

/* ---------- "Cannot be Special Summoned (except by ...)" ----------
 One permanent rule, put in place by the first game event: a monster on this list can't be Special Summoned, except by the
 named card. "By that card" is read from the game: that monster was just shuffled from the field into the Deck as a cost
 (the Gladiator Beast tag out) earlier this turn, and that shuffle hasn't already been used for a summon.
 PARTIAL: if two tag outs are on the same chain, the most recent shuffle is the one that counts. */
const NOSS = { 'Ancient Gear Golem': null, 'Gladiator Beast Alexander': 'Gladiator Beast Dimacari', 'Gladiator Beast Spartacus': 'Gladiator Beast Hoplomus' };
function enabler(g, need) {
  for (let i = g.events.length - 1; i >= 0 && i >= g.events.length - 60; i--) {
    const e = g.events[i]; if (e.turn !== g.turnNo) break;
    if (e.type === 'move' && e.reason === 'cost' && e.wasField && (e.to === 'deck' || e.to === 'extra')) return nm(e.c) === need && !(g._f01used || []).includes(e.seq) ? e : null;
  }
  return null;
}
const ssBlocked = (g, x) => { const n = nm(x); if (!(n in NOSS)) return false; return !(NOSS[n] && enabler(g, NOSS[n])); };
const noSSHook = { type: 'trig', loc: 'any', on: (g, ev, c) => {
  if (!g._f01ss) { g._f01ss = true; addRule(g, (g2, a) => a.type === 'ss' && a.c && a.c.id != null && D(a.c) && ssBlocked(g2, a.c)); }
  if (ev.type === 'summon' && ev.cs.includes(c) && NOSS[nm(c)]) { const e = enabler(g, NOSS[nm(c)]); if (e) (g._f01used = g._f01used || []).push(e.seq); }
  return false; }, res: function* () {} };

/* Tag out: at the end of the Battle Phase, if this card battled, you can shuffle it into the (Extra) Deck to Special Summon
 n "Gladiator Beast" monsters from your Deck. It is read from any zone so Skill Drain doesn't stop it (rulings).
 PARTIAL: several end-of-Battle-Phase effects go on one chain instead of one chain each. */
function tagOut(self, n = 1, except = self, gbOnly = false) {
  const cands = (g, p, pre) => g.p[p].deck.filter(y => gbMon(y) && nm(y) !== except && (pre ? !(nm(y) in NOSS) || NOSS[nm(y)] === self : !forbid(g, { type: 'ss', c: y, p, how: 'special' })));
  return { type: 'trig', loc: 'any', tags: { ss: 1 }, label: 'Tag out',
    on: (g, ev, c) => endBP(g, ev, c) && (!gbOnly || c.flags.gb),
    cond: (g, c, p) => c.zone === 'm' && faceUp(c) && cands(g, p, true).length >= n && nFreeM(g, p) + 1 >= n,
    cost: function* (g, c, p) { move(g, c, 'deck', { reason: 'cost' }); log(g, `${PN(g, p)} shuffled ${nm(c)} into the ${L.isExtraD(D(c)) ? 'Extra Deck' : 'Deck'}.`); },
    res: function* (g, c, p) {
      for (let i = 0; i < n; i++) {
        const cs = cands(g, p, false); if (!cs.length || freeM(g, p) < 0) break;
        const [x] = yield* pick(g, p, 'Special Summon a Gladiator Beast from your Deck', cs, 1, 1, 'good'); if (!x) break;
        gbSS(g, p, x, yield* posPick(g, p, x));
      }
      shuffleDeck(g, p);
    } };
}
/* Contact Fusion: shuffle the listed monsters you control into the Deck. */
function contactSets(g, p, preds) {
  const pool = monsOf(g, p).filter(faceUp), out = [];
  const rec = (i, used) => { if (out.length > 6) return; if (i === preds.length) { out.push(used.slice()); return; } for (const x of pool) if (!used.includes(x) && preds[i](x)) { used.push(x); rec(i + 1, used); used.pop(); } };
  rec(0, []);
  const seen = new Set(); return out.filter(m => { const k = m.map(x => x.u).sort().join(','); if (seen.has(k)) return false; seen.add(k); return true; });
}
function contactProc(preds, label) {
  return { extra: true, how: 'fusion', label, cond: (g, c, p) => contactSets(g, p, preds).length > 0,
    cost: function* (g, c, p, grp) {
      const cs = contactSets(g, p, preds); let mats = cs[0];
      if (cs.length > 1) { const i = yield* choose(g, p, 'Shuffle which monsters into the Deck?', cs.map(m => m.map(nm).join(' + '))); mats = cs[i]; }
      for (const m of mats) move(g, m, 'deck', { reason: 'fusion', group: grp });
      log(g, `${PN(g, p)} shuffled ${mats.map(nm).join(' + ')} into the Deck.`);
    } };
}
/* Equip Spells. ok: which monsters it can equip to. */
function equipAct(ok, text) {
  return { type: 'act', cond: g => fieldMons(g).some(x => faceUp(x) && ok(x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(x => faceUp(x) && ok(x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && ok(t) && equip(g, c, t)) (g._eqT = g._eqT || {})[c.u] = t.u; } };
}
// keeps g._eqT (equip u -> monster u) current, so the equip still knows its monster after that monster has left
const eqTrack = { type: 'trig', loc: 'st', on: (g, ev, c) => { if (c.equipTo) (g._eqT = g._eqT || {})[c.u] = c.equipTo; return false; }, res: function* () {} };
/* "When the equipped monster is returned from your side of the field to the Deck and this card is sent to the GY: return this card to your hand." */
const gbEquipBack = { type: 'trig', loc: 'gy', mand: true, label: 'Return this card to the hand',
  on: (g, ev, c) => {
    if (!(ev.type === 'move' && ev.c === c && ev.from === 'st' && ev.to === 'gy')) return false;
    const mu = g._eqT && g._eqT[c.u]; if (!mu) return false; delete g._eqT[c.u];
    const m = [...g.p[0].deck, ...g.p[1].deck, ...g.p[0].extra, ...g.p[1].extra].find(x => x.u === mu); if (!m) return false;
    for (let i = g.events.length - 1; i >= 0; i--) { const e = g.events[i]; if (e.type === 'move' && e.c === m) return e.wasField && (e.to === 'deck' || e.to === 'extra') && e.prevCtrl === ev.prevCtrl; }
    return false; },
  res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} returned ${nm(c)} to the hand.`); } } };
/* A-Counters: place n, one at a time, on face-up monsters picked from cs(g) */
function* placeA(g, p, n, cs) {
  for (let i = 0; i < n; i++) { const ms = cs(g); if (!ms.length) break; const [m] = yield* pick(g, p, `Place an A-Counter on which monster? (${i + 1} of ${n})`, ms, 1, 1, 'bad'); if (!m) break; addCtr(g, m, 'A', 1); log(g, `${name(m)} got an A-Counter.`);
    for (const k in (g._incS || {})) g._incS[k][m.u] = ctr(m, 'A'); } // A Cell Incubator sees the new counter even if no event comes before its removal
}
// subsets of the cards whose Levels add up to exactly n (Ancient Gear Factory)
function lvSets(cards, n, limit = 8) {
  const out = []; const rec = (i, cur, s) => { if (out.length >= limit) return; if (s === n) { out.push(cur.slice()); return; } if (s > n) return; for (let j = i; j < cards.length; j++) { cur.push(cards[j]); rec(j + 1, cur, s + lv(cards[j])); cur.pop(); } };
  rec(0, [], 0); return out;
}
const tribStd = x => lv(x) >= 7 ? 2 : lv(x) >= 5 ? 1 : 0;

E.addScripts({
  /* ===== Gladiator Beast ===== */
  'Gladiator Beast Alexander': {
    // PARTIAL: "unaffected by Spell effects" is honored by the engine for destruction only.
    self: { unaffectedSpells: (g, c) => wasSS(c) },
    effs: [noSSHook, battledHook, tagOut('Gladiator Beast Alexander')] },
  'Gladiator Beast Dimacari': { self: { maxAttacks: (g, c) => c.flags.gb ? 2 : 1 },
    effs: [battledHook, tagOut('Gladiator Beast Dimacari')] },
  // Edison text: Gyzarus-style tag out of 2; the 2010 card text keeps "except Gladiator Beast Spartacus".
  'Gladiator Beast Gaiodiaz': {
    mats: [() => false, () => false], // can't be Fusion Summoned with Polymerization
    proc: contactProc([x => nm(x) === 'Gladiator Beast Spartacus', gbMon], 'Special Summon (shuffle Spartacus + 1 Gladiator Beast)'),
    effs: [battledHook, tagOut('Gladiator Beast Gaiodiaz', 2, 'Gladiator Beast Spartacus'),
      { type: 'trig', mand: true, label: 'Damage equal to its DEF', on: (g, ev, c) => battleKill(ev, c),
        res: function* (g, c, p, L2) { damage(g, opp(p), num(D(L2.ev.c).def), { src: c, srcP: p }); } }] },
  'Gladiator Beast Octavius': { effs: [battledHook,
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a Set Spell/Trap', on: (g, ev, c) => byGB(ev, c),
      cond: g => stOnField(g).some(x => x.pos === 'set'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Set Spell/Trap?', stOnField(g).filter(x => x.pos === 'set'), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2).filter(x => x.pos === 'set'), { by: p, src: c }); } },
    { type: 'trig', mand: true, label: 'Shuffle it or discard 1 card', on: (g, ev, c) => endBP(g, ev, c) && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return;
        const i = g.p[p].hand.length ? yield* choose(g, p, 'Gladiator Beast Octavius: shuffle it into the Deck or discard 1 card?', ['Shuffle Octavius into the Deck', 'Discard 1 card']) : 0;
        if (i === 1) yield* discard1(g, p); else { move(g, c, 'deck', { reason: 'effect' }); log(g, `${PN(g, p)} shuffled Gladiator Beast Octavius into the Deck.`); } } }] },
  // Resolves even with 1 or no free zone: the monsters that don't fit are destroyed (rulings).
  'Gladiator Beast Secutor': { effs: [battledHook,
    { type: 'trig', mand: true, tags: { ss: 1 }, label: 'Special Summon 2 Gladiator Beasts', on: (g, ev, c) => endBP(g, ev, c) && c.flags.gb,
      cond: (g, c, p) => g.p[p].deck.some(y => gbMon(y) && nm(y) !== 'Gladiator Beast Secutor'),
      res: function* (g, c, p) {
        let cs = g.p[p].deck.filter(y => gbMon(y) && nm(y) !== 'Gladiator Beast Secutor'); if (!cs.length) return;
        const xs = cs.length > 2 ? yield* pick(g, p, 'Special Summon which 2 Gladiator Beasts from your Deck?', cs, 2, 2, 'good') : cs;
        for (const x of xs) { if (freeM(g, p) >= 0 && !forbid(g, { type: 'ss', c: x, p, how: 'special' })) gbSS(g, p, x, yield* posPick(g, p, x)); else { move(g, x, 'gy', { reason: 'rule', destroyed: true }); log(g, `${nm(x)} had no zone and was destroyed.`); } }
        shuffleDeck(g, p); } }] },
  'Gladiator Beast Spartacus': { effs: [noSSHook, battledHook, tagOut('Gladiator Beast Spartacus'),
    { type: 'trig', mand: true, label: 'Add a Gladiator Beast Equip Spell', on: (g, ev, c) => evSummoned(ev, c, SSTYPES),
      cond: (g, c, p) => g.p[p].deck.some(x => isSpell(x) && D(x).sub === 'Equip' && isGB(x)),
      res: function* (g, c, p) { yield* search(g, p, x => isSpell(x) && D(x).sub === 'Equip' && isGB(x), 'Add a Gladiator Beast Equip Spell from your Deck'); } }] },
  'Gladiator Beast Torax': { effs: [battledHook,
    { type: 'trig', loc: 'any', label: 'Shuffle it into the Deck: draw 1', on: (g, ev, c) => endBP(g, ev, c) && c.flags.gb,
      cond: (g, c, p) => c.zone === 'm' && faceUp(c),
      cost: function* (g, c, p) { move(g, c, 'deck', { reason: 'cost' }); log(g, `${PN(g, p)} shuffled Gladiator Beast Torax into the Deck.`); },
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  "Gladiator Beast's Battle Archfiend Shield": {
    cont: { replaceDestroy: (g, src, m, o) => { if (src.equipTo !== m.u || o.rule || src.flags.shieldGone) return false; src.flags.shieldGone = true; const d = destroy(g, [src], { by: o.by, quietLog: true }); if (!d.length) { delete src.flags.shieldGone; return false; } log(g, `Gladiator Beast's Battle Archfiend Shield was destroyed instead of ${name(m)}.`); return true; } },
    effs: [equipAct(gbMon, 'Equip to which Gladiator Beast?'), eqTrack, gbEquipBack] },
  "Gladiator Beast's Battle Gladius": { cont: { atk: (g, src, m) => src.equipTo === m.u ? 300 : 0 },
    effs: [equipAct(gbMon, 'Equip to which Gladiator Beast?'), eqTrack, gbEquipBack] },
  "Gladiator Beast's Battle Halberd": { effs: [equipAct(gbMon, 'Equip to which Gladiator Beast?'), eqTrack, gbEquipBack,
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy 1 Spell/Trap', on: (g, ev, c) => ev.type === 'dsEnd' && ev.a && ev.a.u === c.equipTo,
      cond: (g, c) => stOnField(g).length > 0,
      res: function* (g, c, p) { const cs = stOnField(g); if (!cs.length) return; const [x] = yield* pick(g, p, 'Destroy which Spell/Trap?', cs, 1, 1, 'bad'); if (x) destroy(g, [x], { by: p, src: c }); } }] },
  "Gladiator Beast's Battle Manica": { cont: { grant: (g, src, m, flag) => flag === 'noBattleDestroy' && src.equipTo === m.u },
    effs: [equipAct(gbMon, 'Equip to which Gladiator Beast?'), eqTrack, gbEquipBack] },
  "Gladiator Beast's Respite": { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.filter(x => x !== c && isGB(x)).length >= 2,
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => x !== c && isGB(x)); if (cs.length < 2) return;
      const xs = yield* pick(g, p, 'Shuffle which 2 Gladiator Beast cards into the Deck?', cs, 2, 2, 'cost');
      for (const x of xs) move(g, x, 'deck', { reason: 'effect' }); log(g, `${PN(g, p)} shuffled ${xs.map(nm).join(' and ')} into the Deck.`); draw(g, p, 3); } }] },
  // PARTIAL: the engine opens no window after a summon made by a resolving effect (the tag outs), so Lash can be used then
  // only as the first play of the next Main Phase (nothing else may happen in between, phase changes aside).
  // The hook remembers the last Gladiator Beast Special Summon; Lash stays usable until any other event but a phase change.
  'Gladiator Lash': { effs: [{ type: 'trig', loc: 'any', on: (g, ev) => { if (ev.type === 'summon' && SSTYPES.includes(ev.how) && ev.cs.some(gbMon)) g._lashW = { p: ev.p, turn: g.turnNo, n: g.events.length, cs: ev.cs.slice() }; return false; }, res: function* () {} },
    { type: 'act', cond: (g, c, p) => (!!g.sw && g.sw.p === p && g.sw.cs.some(x => onField(x) && gbMon(x)))
      || (!!g._lashW && g._lashW.p === p && g._lashW.turn === g.turnNo && g._lashW.cs.some(x => onField(x) && gbMon(x)) && g.events.slice(g._lashW.n).every(e => e.type === 'phase')),
    res: function* (g, c, p) { const o = opp(p); if (!g.p[o].hand.length) return; const [x] = yield* pick(g, o, 'Discard 1 card', g.p[o].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, o)} discarded ${nm(x)}.`); } } }] },
  'Gladiator Proving Ground': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.some(x => gbMon(x) && lv(x) <= 4),
    res: function* (g, c, p) { yield* search(g, p, x => gbMon(x) && lv(x) <= 4, 'Add a Level 4 or lower Gladiator Beast'); } }] },

  /* ===== single cards ===== */
  'Enraged Battle Ox': { effs: [], cont: { grant: (g, src, c, flag) => flag === 'piercing' && c.ctrl === src.ctrl && faceUp(c) && ['Beast', 'Beast-Warrior', 'Winged Beast'].includes(race(c)) } },

  /* ===== A-Counters ===== */
  'A Cell Breeding Device': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, label: 'Put an A-Counter', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      cond: (g, c, p) => oppFaceUp(g, p).length > 0,
      res: function* (g, c, p) { if (onField(c)) yield* placeA(g, p, 1, g2 => oppFaceUp(g2, p)); } }] },
  // PARTIAL: "removed by a card effect" is read as any drop in a face-up card's A-Counters while this card is face-up
  // (ENGINE: no counter-removal event); counters lost by leaving the field don't count.
  'A Cell Incubator': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', on: (g, ev, c) => {
        const S = (g._incS = g._incS || {})[c.u] || (g._incS[c.u] = {}); let removed = false; const now = {};
        for (const x of allField(g)) { if (x === c) continue; const n = ctr(x, 'A'); now[x.u] = n; if (S[x.u] != null && n < S[x.u]) removed = true; }
        g._incS[c.u] = now;
        if (removed) { addCtr(g, c, 'A', 1); log(g, 'A Cell Incubator got an A-Counter.'); }
        (g._incN = g._incN || {})[c.u] = ctr(c, 'A');
        return false; }, res: function* () {} },
    { type: 'trig', loc: 'gy', mand: true, label: 'Distribute its A-Counters',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && (g._incN || {})[c.u] > 0,
      res: function* (g, c, p) { const n = g._incN[c.u]; g._incN[c.u] = 0; yield* placeA(g, p, n, g2 => fieldMons(g2).filter(faceUp)); } }] },
  'A Cell Scatter Burst': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isAlien(x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Alien monster?', monsOf(g, p).filter(x => faceUp(x) && isAlien(x)), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const n = lv(t); if (destroy(g, [t], { by: p, src: c }).length) yield* placeA(g, p, n, g2 => oppFaceUp(g2, p)); } }] },

  /* ===== "A ..." cards ===== */
  'A Cat of Ill Omen': { effs: [{ type: 'trig', label: 'Choose a Trap from the Deck', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c, p) => g.p[p].deck.some(isTrap),
    res: function* (g, c, p) {
      const cs = g.p[p].deck.filter(isTrap); if (!cs.length) return;
      const [x] = yield* pick(g, p, 'Choose a Trap from your Deck', cs, 1, 1, 'good'); if (!x) return;
      log(g, `${PN(g, p)} showed ${nm(x)}.`);
      const nv = [g.p[0].fz, g.p[1].fz].some(f => f && f.pos !== 'set' && nm(f) === 'Necrovalley');
      if (nv && !forbid(g, { type: 'search', p }) && (yield* yn(g, p, `Add ${nm(x)} to your hand instead (Necrovalley)?`))) { move(g, x, 'hand', { reason: 'effect' }); shuffleDeck(g, p); log(g, `${PN(g, p)} added ${nm(x)} to the hand.`); return; }
      const P = g.p[p]; P.deck.splice(P.deck.indexOf(x), 1); shuffleDeck(g, p); P.deck.push(x); log(g, `${PN(g, p)} put ${nm(x)} on top of the Deck.`); } }] },
  // The original Level counts (rulings). Not in the Damage Step.
  'A Deal with Dark Ruler': { effs: [
    { type: 'trig', loc: 'any', on: (g, ev) => { if (ev.type === 'move' && ev.wasField && ev.to === 'gy' && ev.snap && ev.snap.mon && num(D(ev.c).lv) >= 8) (g._ddr = g._ddr || [0, 0])[ev.prevCtrl] = g.turnNo; return false; }, res: function* () {} },
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g._ddr && g._ddr[p] === g.turnNo && freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].deck].some(x => nm(x) === 'Berserk Dragon'),
      res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => nm(x) === 'Berserk Dragon'); if (!cs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon Berserk Dragon', cs, 1, 1, 'good'); if (!x) return; const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } }] },
  'A Feather of the Phoenix': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c),
    cost: function* (g, c, p) { yield* discard1(g, p, c); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which card from your GY to the top of your Deck?', g.p[p].gy, 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy') return; if (L.isExtraD(D(t))) { move(g, t, 'extra', { reason: 'effect' }); log(g, `${nm(t)} returned to the Extra Deck.`); } else { move(g, t, 'deckTop', { reason: 'effect' }); log(g, `${nm(t)} was put on top of the Deck.`); } } }] },
  // ENGINE: no "can't attack face-down monsters" check in attack targets. PARTIAL: this turn an attack declared on a face-down
  // monster is negated, and the attacker gets that attack back once.
  'A Feint Plan': { effs: [{ type: 'act', res: function* (g, c) { g._feint = g.turnNo; log(g, 'Face-down monsters can\'t be attacked this turn.'); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Stop the attack on a face-down monster',
      on: (g, ev, c) => ev.type === 'attack' && g._feint === g.turnNo && ev.t && ev.t.pos === 'set' && c.zone === 'gy' && !(g._feintBy && g._feintBy[g.turnNo] && g._feintBy[g.turnNo] !== c.u) && ((g._feintBy = g._feintBy || {})[g.turnNo] = c.u),
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (!g.aw || g.aw.a !== a) return; negateAttack(g); log(g, 'Face-down monsters can\'t be attacked this turn.'); if (a.flags.feintBack !== g.turnNo) { a.flags.feintBack = g.turnNo; a.attacks = Math.max(0, a.attacks - 1); a.declared = false; } } }] },
  'A Hero Emerges': { effs: [{ type: 'act', cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && g.p[p].hand.some(x => x !== c),
    res: function* (g, c, p) {
      const h = g.p[p].hand; if (!h.length) return;
      const x = h[Math.floor(g.rnd() * h.length)]; log(g, `${PN(g, opp(p))} picked ${nm(x)} at random.`);
      if (canBeSSFromHand(x) && freeM(g, p) >= 0 && !forbid(g, { type: 'ss', c: x, p, how: 'special' })) { ss(g, p, x, yield* posPick(g, p, x)); return; }
      move(g, x, 'gy', { reason: 'effect' }); log(g, `${nm(x)} was sent to the GY.`); } }] },
  'A Major Upset': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => x.pos === 'atk' && lv(x) <= 2),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute an Attack Position Level 2 or lower monster', monsOf(g, p).filter(x => x.pos === 'atk' && lv(x) <= 2), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm(x)}.`); },
    res: function* (g, c, p) { const xs = fieldMons(g).filter(x => faceUp(x) && lv(x) >= 7 && wasSS(x)); for (const x of xs) move(g, x, 'hand', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.map(nm).join(', ')} returned to the hand.`); } }] },
  'A Man with Wdjat': { effs: [{ type: 'trig', mand: true, label: 'Look at a Set card',
    on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']) || (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl),
    cond: (g, c, p) => fieldOf(g, opp(p)).some(x => x.pos === 'set'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Look at which Set card?', fieldOf(g, opp(p)).filter(x => x.pos === 'set'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.pos === 'set') log(g, `${PN(g, p)} looked at the Set card: ${nm(t)}.`); } }] },
  'A Rival Appears!': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && oppFaceUp(g, p).some(t => g.p[p].hand.some(x => canBeSSFromHand(x) && lv(x) === lv(t))),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which of their monsters?', oppFaceUp(g, p).filter(t => g.p[p].hand.some(x => canBeSSFromHand(x) && lv(x) === lv(t))), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || freeM(g, p) < 0) return; const cs = g.p[p].hand.filter(x => canBeSSFromHand(x) && lv(x) === lv(t)); if (!cs.length) return; const [x] = yield* pick(g, p, `Special Summon a Level ${lv(t)} monster from your hand`, cs, 1, 1, 'good'); if (x) ss(g, p, x, yield* posPick(g, p, x)); } }] },
  // The 2010 card text: "Return ..., and if you do, destroy ...", so the return is part of the effect, not a cost.
  'A Wingbeat of Giant Dragon': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Dragon' && lv(x) >= 5),
    res: function* (g, c, p) { const cs = monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Dragon' && lv(x) >= 5); if (!cs.length) return;
      const [x] = yield* pick(g, p, 'Return which Dragon to the hand?', cs, 1, 1, 'cost'); if (!x) return; move(g, x, 'hand', { reason: 'effect', by: p }); log(g, `${nm(x)} returned to the ${L.isExtraD(D(x)) ? 'Extra Deck' : 'hand'}.`);
      destroy(g, stOnField(g).filter(y => y !== c), { by: p, src: c }); } }] },
  'A-Team: Trap Disposal Unit': { effs: [{ type: 'quick', ds: true, label: 'Tribute: negate the Trap',
    cond: (g, c, p, x) => x.top && x.top.cardAct && isTrap(x.top.c) && x.top.p !== p && !x.top.negated,
    cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed A-Team: Trap Disposal Unit.`); },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },

  /* ===== Amazoness ===== */
  'Amazoness Archer': { effs: [{ type: 'ign', label: 'Tribute 2: 1200 damage', cond: (g, c, p) => monsOf(g, p).length >= 2,
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Tribute 2 monsters', monsOf(g, p), 2, 2, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${xs.map(nm).join(' and ')}.`); },
    res: function* (g, c, p) { damage(g, opp(p), 1200, { src: c, srcP: p }); } }] },
  // PARTIAL: "they must attack this turn, if able" isn't enforced (ENGINE: no forced attacks).
  'Amazoness Archers': { effs: [{ type: 'act', cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && monsOf(g, p).some(x => faceUp(x) && isAmz(x)),
    res: function* (g, c, p) { const o = opp(p);
      for (const x of monsOf(g, o)) if (x.pos !== 'atk') { if (x.pos === 'set') log(g, `The face-down monster was ${nm(x)}.`); x.pos = 'atk'; g.seq++; }
      const xs = monsOf(g, o).filter(faceUp); for (const x of xs) addMod(g, x, { atk: -500 });
      if (xs.length) log(g, `${PN(g, o)}'s monsters changed to Attack Position and lost 500 ATK.`); } }] },
  'Amazoness Blowpiper': { effs: [{ type: 'trig', mand: true, label: '-500 ATK', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster loses 500 ATK?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: -500, end: true }); log(g, `${name(t)} lost 500 ATK until the end of the turn.`); } } }] },
  // PARTIAL: the engine keeps hand cards in their owner's hand, so the monster taken changes owner.
  'Amazoness Chain Master': { effs: [{ type: 'trig', loc: 'gy', label: 'Pay 1500: take a monster from their hand',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => g.p[p].lp > 1500 && g.p[opp(p)].hand.length > 0,
    cost: function* (g, c, p) { pay(g, p, 1500); },
    res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand; if (!h.length) return; log(g, `${PN(g, p)} looked at ${PN(g, o)}'s hand: ${h.map(nm).join(', ')}.`);
      const ms = h.filter(isMon); if (!ms.length) return; const [x] = yield* pick(g, p, 'Add which monster to your hand?', ms, 1, 1, 'bad'); if (!x) return;
      h.splice(h.indexOf(x), 1); x.owner = p; x.ctrl = p; g.p[p].hand.push(x); g.seq++; log(g, `${PN(g, p)} added ${nm(x)} to the hand.`); } }] },
  'Amazoness Fighter': { self: { noBattleDamage: true }, effs: [] },
  'Amazoness Paladin': { self: { atk: (g, c) => 100 * monsOf(g, c.ctrl).filter(x => faceUp(x) && isAmz(x)).length }, effs: [] },
  'Amazoness Spellcaster': { effs: [
    { type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isAmz(x)) && oppFaceUp(g, p).length > 0,
      target: function* (g, c, p, L2) { const a = yield* tgt(g, p, L2, 'Which of your Amazoness monsters?', monsOf(g, p).filter(x => faceUp(x) && isAmz(x)), 1, 1, 'good'); const b = yield* tgt(g, p, L2, 'Switch original ATK with which of their monsters?', oppFaceUp(g, p), 1, 1, 'bad'); L2.t = [...a, ...b]; },
      res: function* (g, c, p, L2) { const [a, b] = L2.t; if (!a || !b || !onField(a) || !onField(b) || !faceUp(a) || !faceUp(b)) return;
        const A = baseAtk(a), B = baseAtk(b), k = ++g.seq; g._amzSw = g._amzSw || [];
        for (const [x, v] of [[a, B], [b, A]]) { g._amzSw.push({ u: x.u, old: x.flags.baseAtk, k, turn: g.turnNo }); x.flags.baseAtk = v; x.flags.amzSw = k; }
        log(g, `${name(a)} and ${name(b)} switched original ATK (${B} and ${A}).`); } },
    { type: 'trig', loc: 'any', on: (g, ev) => { if (ev.type === 'phase' && ev.ph === 'end' && g._amzSw && g._amzSw.length) { for (const s of g._amzSw) { const x = fieldMons(g).find(m => m.u === s.u); if (x && x.flags.amzSw === s.k) { if (s.old == null) delete x.flags.baseAtk; else x.flags.baseAtk = s.old; delete x.flags.amzSw; } } g._amzSw = []; } return false; }, res: function* () {} }] },
  'Amazoness Swords Woman': { effs: [], cont: { dmg: (g, src, p, n, o) => {
    if (!(o && o.battle && p === src.ctrl && faceUp(src) && g.battle && (g.battle.a === src || g.battle.t === src))) return n;
    const q = opp(p), other = g.battle.a === src ? g.battle.t : g.battle.a;
    if (g.p[q].noBattleDamage === g.turnNo || (other && other.ctrl === q && faceUp(other) && has(g, other, 'noBattleDamage'))) return 0;
    damage(g, q, n, { battle: true, src, srcP: p }); return 0; } } },
  // PARTIAL: a second face-up Tiger is destroyed by the rule; with a control change the one that arrived later may not be the one destroyed.
  'Amazoness Tiger': { self: { atk: (g, c) => 400 * monsOf(g, c.ctrl).filter(x => faceUp(x) && isAmz(x)).length },
    cont: { forbid: (g, src, a) => (a.type === 'ns' || a.type === 'ss') && a.c !== src && a.p === src.ctrl && nm(a.c) === 'Amazoness Tiger',
      grant: (g, src, c, flag) => flag === 'noAttackTarget' && c !== src && c.ctrl === src.ctrl && faceUp(c) && isAmz(c) },
    effs: [{ type: 'trig', mand: true, label: 'Only 1 Amazoness Tiger',
      on: (g, ev, c) => { if (c.flags.tigerSeq == null) c.flags.tigerSeq = ev.seq; return monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && nm(x) === 'Amazoness Tiger' && (x.flags.tigerSeq == null || x.flags.tigerSeq > c.flags.tigerSeq)); },
      res: function* (g, c) { const xs = monsOf(g, c.ctrl).filter(x => x !== c && faceUp(x) && nm(x) === 'Amazoness Tiger' && (x.flags.tigerSeq == null || x.flags.tigerSeq > c.flags.tigerSeq)); destroy(g, xs, { rule: true }); } }] },

  /* ===== Ancient Gear ===== */
  'Ancient Crimson Ape': { effs: [{ type: 'trig', mand: true, label: 'Gain 1000 LP',
    on: (g, ev, c) => ev.type === 'move' && ev.c !== c && ev.wasField && ev.destroyed && ev.to === 'gy' && ev.prevCtrl === c.ctrl && ev.snap && ev.snap.mon,
    res: function* (g, c, p) { gain(g, p, 1000); } }] },
  'Ancient Gear': { proc: { label: 'Special Summon (you control an Ancient Gear)', pos: 'atk', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && name(x) === 'Ancient Gear') }, effs: [] },
  'Ancient Gear Cannon': { effs: [{ type: 'ign', label: 'Tribute: 500 damage',
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed Ancient Gear Cannon.`); },
    res: function* (g, c, p) { if (damage(g, opp(p), 500, { src: c, srcP: p }) > 0) { addRule(g, (g2, a) => a.type === 'activate' && a.eff.type === 'act' && isTrap(a.c) && g2.phase === 'battle', { end: g.turnNo }); log(g, 'Neither player can activate Trap Cards in this Battle Phase.'); } } }] },
  // ENGINE: no way to Tribute a Spell card in a Tribute Summon. PARTIAL: with enough counters an Ancient Gear monster can be
  // summoned with "No Tribute", then this card is sent to the GY in its place (this also works for a Tribute Set).
  'Ancient Gear Castle': {
    cont: { atk: (g, src, m) => isAG(m) ? 300 : 0,
      tributes: (g, src, c, p, need) => src.ctrl === p && need > 0 && isAG(c) && ctr(src, 'gear') >= need && !((g._agf || {})[c.u] === g.turnNo) ? 0 : null },
    effs: [{ type: 'act', res: function* () {} },
      { type: 'trig', loc: 'st', on: (g, ev, c) => { if ((ev.type === 'summon' && ['normal', 'tribute'].includes(ev.how)) || ev.type === 'set') addCtr(g, c, 'gear', 1); return false; }, res: function* () {} },
      { type: 'trig', loc: 'st', mand: true, label: 'Tributed in place of monsters',
        on: (g, ev, c) => { const x = ev.type === 'summon' && ev.how === 'normal' ? ev.cs[0] : ev.type === 'set' ? ev.c : null;
          if (!x || ev.p !== c.ctrl || !isAG(x) || (ev.tribs && ev.tribs.length) || (x.tributes && x.tributes.length) || (g._agf || {})[x.u] === g.turnNo) return false;
          const need = tribStd(x); return need > 0 && ctr(c, 'gear') >= need; },
        res: function* (g, c, p) { if (!onField(c)) return; move(g, c, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Ancient Gear Castle.`); } }] },
  'Ancient Gear Drill': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isAG(x)) && g.p[p].hand.some(x => x !== c) && g.p[p].deck.some(isSpell),
    cost: function* (g, c, p) { yield* discard1(g, p, c); },
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isSpell(x) && (D(x).sub === 'Field' || freeST(g, p) >= 0)); if (!cs.length) { shuffleDeck(g, p); return; }
      const [x] = yield* pick(g, p, 'Set which Spell from your Deck?', cs, 1, 1, 'good'); if (!x) return; log(g, `${PN(g, p)} showed ${nm(x)}.`);
      if (D(x).sub === 'Field') { if (g.p[p].fz) move(g, g.p[p].fz, 'gy', { reason: 'rule' }); move(g, x, 'fz', { ctrl: p, pos: 'set', reason: 'set' }); } else move(g, x, 'st', { ctrl: p, pos: 'set', reason: 'set' });
      x.turnIn = g.turnNo; shuffleDeck(g, p); log(g, `${PN(g, p)} Set a Spell from the Deck.`);
      addRule(g, (g2, a) => a.type === 'activate' && a.c === x, { end: g.turnNo }); } }] },
  // PARTIAL: ① is an optional Spell Speed 3 response (ENGINE: no automatic negation of effects that target a card).
  // PARTIAL: the Trap negation is a Continuous Effect in the rulings; here it is a Quick Effect its controller is offered
  // (ENGINE: a static effect can't negate a Trap's resolution or destroy it).
  'Ancient Gear Engineer': { cont: atkLock, effs: [
    { type: 'quick', speed: 3, ds: true, label: 'Negate the Trap that targets it',
      cond: (g, c, p, x) => x.top && !x.top.negated && isTrap(x.top.c) && x.top.t && x.top.t.includes(c),
      target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a Spell/Trap', on: (g, ev, c) => ev.type === 'dsEnd' && ev.a === c,
      cond: (g, c, p) => stOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Ancient Gear Explosive': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isAG(x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Ancient Gear monster?', monsOf(g, p).filter(x => faceUp(x) && isAG(x)), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; const n = Math.floor(baseAtk(t) / 2); if (destroy(g, [t], { by: p, src: c }).length) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  // PARTIAL: the revealed monster may be Normal Summoned with no Tribute this turn; its standard Tribute Summon stays offered too.
  'Ancient Gear Factory': {
    cont: { loc: 'gy', tributes: (g, src, c) => (g._agf || {})[c.u] === g.turnNo ? 0 : null },
    effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c && isAG(x) && lv(x) >= 5 && lvSets(g.p[p].gy.filter(isAG), 2 * lv(x), 1).length),
      res: function* (g, c, p) {
        const hs = g.p[p].hand.filter(x => isAG(x) && lv(x) >= 5 && lvSets(g.p[p].gy.filter(isAG), 2 * lv(x), 1).length); if (!hs.length) return;
        const [x] = yield* pick(g, p, 'Reveal which Ancient Gear monster?', hs, 1, 1, 'good'); if (!x) return; log(g, `${PN(g, p)} revealed ${nm(x)}.`);
        const sets = lvSets(g.p[p].gy.filter(isAG), 2 * lv(x)); let s = sets[0];
        if (sets.length > 1) { const i = yield* choose(g, p, 'Banish which Ancient Gear monsters?', sets.map(m => m.map(y => `${nm(y)} (Lv ${lv(y)})`).join(' + '))); s = sets[i]; }
        for (const y of s) move(g, y, 'ban', { reason: 'effect' }); log(g, `${PN(g, p)} banished ${s.map(nm).join(', ')}.`);
        (g._agf = g._agf || {})[x.u] = g.turnNo; log(g, `${nm(x)} can be Normal Summoned without Tributing this turn.`); } }] },
  'Ancient Gear Fist': { effs: [equipAct(isAG, 'Equip to which Ancient Gear monster?'),
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy the monster it battled',
      on: (g, ev, c) => ev.type === 'dsEnd' && ev.a && ev.t && [ev.a.u, ev.t.u].includes(c.equipTo),
      res: function* (g, c, p, L2) { const m = equippedTo(g, c); if (!m) return; const o = L2.ev.a === m ? L2.ev.t : L2.ev.a; if (o && onField(o) && o.zone === 'm') destroy(g, [o], { by: p, src: c }); } }] },
  'Ancient Gear Gadjiltron Chimera': {
    self: { atk: (g, c) => c.flags.green ? 300 : 0 },
    effs: [
      { type: 'trig', on: (g, ev, c) => { if (evSummoned(ev, c, ['tribute']) && ev.tribs) for (const t of ev.tribs) { const n = nm(t); if (n === 'Green Gadget') c.flags.green = true; if (n === 'Red Gadget') c.flags.red = true; if (n === 'Yellow Gadget') c.flags.yellow = true; } return false; }, res: function* () {} },
      { type: 'trig', mand: true, label: '500 damage', on: (g, ev, c) => c.flags.red && ev.type === 'damage' && ev.battle && ev.direct && ev.src === c && ev.p !== c.ctrl, res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } },
      { type: 'trig', loc: 'any', mand: true, label: '700 damage', on: (g, ev, c) => !!c.flags.yellow && ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.prevCtrl !== c.ctrl, res: function* (g, c, p) { damage(g, opp(p), 700, { src: c, srcP: p }); } }] },
  'Ancient Gear Golem': { self: { piercing: true }, cont: atkLock, effs: [noSSHook] },
  'Ancient Gear Knight': { effs: [], cont: { forbid: (g, src, a) => !!src.flags.gemini && atkLock.forbid(g, src, a) } },
  'Ancient Gear Soldier': { effs: [], cont: atkLock },
  // The Equip Spell sent to the GY because its monster left the field counts as destroyed.
  'Ancient Gear Tank': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 600 : 0 }, effs: [equipAct(isAG, 'Equip to which Ancient Gear monster?'),
    { type: 'trig', loc: 'gy', mand: true, label: '600 damage', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy' && (ev.destroyed || ev.reason === 'rule'),
      res: function* (g, c, p) { damage(g, opp(p), 600, { src: c, srcP: p }); } }] },
  'Ancient Gear Workshop': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.some(isAG),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Ancient Gear monster to your hand?', g.p[p].gy.filter(isAG), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${nm(t)} to the hand.`); } } }] },

  /* ===== Ancient and Anti cards ===== */
  // PARTIAL: the attack redirect isn't done (ENGINE: attack() and damageStep() keep the attack target local).
  'Ancient Lamp': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Special Summon La Jinn',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => nm(x) === 'La Jinn the Mystical Genie of the Lamp'),
    res: function* (g, c, p) { if (!onField(c) || !faceUp(c) || freeM(g, p) < 0) return; const cs = g.p[p].hand.filter(x => nm(x) === 'La Jinn the Mystical Genie of the Lamp'); const [x] = yield* pick(g, p, 'Special Summon La Jinn', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  'Ancient Leaf': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp >= 9000 && g.p[p].deck.length >= 2,
    cost: function* (g, c, p) { pay(g, p, 2000); },
    res: function* (g, c, p) { draw(g, p, 2); } }] },
  'Ancient Rules': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => D(x).k === 'normal' && lv(x) >= 5),
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => D(x).k === 'normal' && lv(x) >= 5); if (!cs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon which Normal Monster?', cs, 1, 1, 'good'); if (x) ss(g, p, x, yield* posPick(g, p, x)); } }] },
  'Ancient Telescope': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].deck.length > 0,
    res: function* (g, c, p) { const d = g.p[opp(p)].deck; const top = d.slice(-5).reverse(); log(g, `${PN(g, p)} saw the top of ${PN(g, opp(p))}'s Deck: ${top.map(nm).join(', ')}.`); } }] },
  'Anti Raigeki': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p, x) => spellTrapAct(x.top) && x.top.p !== p && !x.top.negated && nm(x.top.c) === 'Raigeki',
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; L2.data.L.negated = true; log(g, "Raigeki's effect was negated."); destroy(g, monsOf(g, opp(p)), { by: p, src: c }); } }] },
  'Anti-Aircraft Flower': { effs: [{ type: 'ign', label: 'Tribute an Insect: 800 damage', cond: (g, c, p) => monsOf(g, p).some(x => race(x) === 'Insect'),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which Insect?', monsOf(g, p).filter(x => race(x) === 'Insect'), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm(x)}.`); },
    res: function* (g, c, p) { damage(g, opp(p), 800, { src: c, srcP: p }); } }] },
  'Anti-Fusion Device': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(x => faceUp(x) && D(x).k === 'fusion'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Fusion Monster?', fieldMons(g).filter(x => faceUp(x) && D(x).k === 'fusion'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2).filter(faceUp), { by: p, src: c }); } }] },
  'Anti-Spell': { effs: [{ type: 'act', cond: (g, c, p, x) => spellTrapAct(x.top) && isSpell(x.top.c) && !x.top.negated && fieldOf(g, p).reduce((s, y) => s + ctr(y, 'spell'), 0) >= 2,
    cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1];
      for (let i = 0; i < 2; i++) { const cs = fieldOf(g, p).filter(y => ctr(y, 'spell') > 0); const [y] = yield* pick(g, p, `Remove a Spell Counter from which card? (${i + 1} of 2)`, cs, 1, 1, 'cost'); addCtr(g, y, 'spell', -1); }
      log(g, `${PN(g, p)} removed 2 Spell Counters.`); },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
});
})();
