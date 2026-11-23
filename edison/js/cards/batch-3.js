/* Batch 3: Fish OTK, Flamvell, Gladiator Beast, Hero Beat, Norleras, Quickdraw Plant, Ancient Gear.
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, setFaceDown, negate, addMod,
  equip, equippedTo, link, addCtr, ctr, negateAttack, endBattle, addRule, token, tokens, fusionSummon, canFusion, ritualSummon, canRitual,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned,
  fromFieldToGY, battleKill, isGemini } = L;
const atk = L.atk, def = L.def, num = L.num, isFrog = L.isFrog, isEHERO = L.isEHERO;

/* ---------- shared helpers ---------- */
const nm = x => D(x).n;
const isGB = x => /^Gladiator Beast/.test(nm(x));
const gbMon = x => isMon(x) && isGB(x);
const isGK = x => isMon(x) && /^Gravekeeper's/.test(nm(x));
const isAG = x => isMon(x) && /^Ancient Gear/.test(nm(x));
const isFish = x => isMon(x) && race(x) === 'Fish';
const hasAb = (x, s) => (D(x).ab || '').split(' ').includes(s);
const mon = x => isMon(x) && !L.isExtraD(D(x));
function* posPick(g, p, x) { const i = yield* choose(g, p, `${nm(x)}: which position?`, ['Attack Position', 'Defense Position']); return i ? 'def' : 'atk'; }
/* "Special Summoned by the effect of a Gladiator Beast monster": the flag is set before the summon so "when summoned" checks see it. */
function gbSS(g, p, x, pos = 'atk') { x.flags.gb = true; const ok = ss(g, p, x, pos); if (!ok) delete x.flags.gb; return ok; }
const byGB = (ev, c) => evSummoned(ev, c) && c.flags.gb;
/* Remembers that this monster was in damage calculation this turn (for the Gladiator Beast tag out). */
const battledHook = { type: 'trig', on: (g, ev, c) => { if (ev.type === 'afterCalc' && (ev.a === c || ev.t === c)) c.flags.battled = g.turnNo; return false; }, res: function* () {} };
/* Tag out. PARTIAL: the engine has no "end of the Battle Phase" moment, so it is a Quick Effect the turn player can use in the
 Battle Step after this card battled; using it ends the Battle Phase, so the new monster can't attack. ENGINE: end-of-Battle-Phase triggers. */
function tagOut(self, n = 1, except = self) {
  return { type: 'quick', label: 'Tag out', tags: { ss: 1 },
    cond: (g, c, p, x) => !x.top && g.phase === 'battle' && g.tp === p && !g.inDS && !g.aw && c.flags.battled === g.turnNo
      && g.p[p].deck.filter(y => gbMon(y) && nm(y) !== except).length >= n && nFreeM(g, p) + 1 >= n,
    cost: function* (g, c, p) { move(g, c, 'deck', { reason: 'cost' }); log(g, `${PN(g, p)} shuffled ${nm(c)} into the ${L.isExtraD(D(c)) ? 'Extra Deck' : 'Deck'}.`); },
    res: function* (g, c, p) {
      for (let i = 0; i < n; i++) {
        const cands = g.p[p].deck.filter(y => gbMon(y) && nm(y) !== except); if (!cands.length || freeM(g, p) < 0) break;
        const [x] = yield* pick(g, p, 'Special Summon a Gladiator Beast from your Deck', cands, 1, 1, 'good'); if (!x) break;
        gbSS(g, p, x, yield* posPick(g, p, x));
      }
      shuffleDeck(g, p); g.bpEnd = true; log(g, 'The Battle Phase ended.');
    } };
}
/* Contact Fusion: shuffle the listed monsters you control into the Deck. preds: one test per material. */
function contactSets(g, p, preds) {
  const pool = monsOf(g, p).filter(faceUp), out = [];
  const rec = (i, used) => { if (out.length > 6) return; if (i === preds.length) { out.push(used.slice()); return; } for (const x of pool) if (!used.includes(x) && preds[i](x)) { used.push(x); rec(i + 1, used); used.pop(); } };
  rec(0, []);
  const seen = new Set(); return out.filter(m => { const k = m.map(x => x.u).sort().join(','); if (seen.has(k)) return false; seen.add(k); return true; });
}
function contactProc(preds, label) {
  return { extra: true, label, cond: (g, c, p) => contactSets(g, p, preds).length > 0,
    cost: function* (g, c, p, grp) {
      const cs = contactSets(g, p, preds); let mats = cs[0];
      if (cs.length > 1) { const i = yield* choose(g, p, 'Shuffle which monsters into the Deck?', cs.map(m => m.map(nm).join(' + '))); mats = cs[i]; }
      for (const m of mats) move(g, m, 'deck', { reason: 'fusion', group: grp });
      log(g, `${PN(g, p)} shuffled ${mats.map(nm).join(' + ')} into the Deck.`);
    } };
}
/* Synchro Summon with a named Tuner (or Quickdraw Synchron in its place) + 1 or more non-Tuners. */
function synSets(g, p, sx, tuners) {
  const mons = monsOf(g, p).filter(faceUp), Lv = num(D(sx).lv), out = [];
  const tun = mons.filter(x => D(x).tu && tuners.includes(nm(x))), non = mons.filter(x => !D(x).tu);
  for (const t of tun) for (let mask = 1; mask < (1 << non.length); mask++) {
    const ms = non.filter((_, i) => mask & (1 << i));
    if (ms.reduce((s, x) => s + lv(x), lv(t)) === Lv) out.push([t, ...ms]);
    if (out.length > 8) return out;
  }
  return out;
}
function synProc(tuners) {
  return { extra: true, how: 'synchro', label: 'Synchro Summon', cond: (g, c, p) => synSets(g, p, c, tuners).length > 0,
    cost: function* (g, c, p, grp) {
      const cs = synSets(g, p, c, tuners); let mats = cs[0];
      if (cs.length > 1) { const i = yield* choose(g, p, `Synchro Summon ${nm(c)} with which monsters?`, cs.map(m => m.map(nm).join(' + '))); mats = cs[i]; }
      for (const m of mats) move(g, m, 'gy', { reason: 'synchro', by: p, group: grp });
      log(g, `${PN(g, p)} sent ${mats.map(nm).join(' + ')} to the GY for a Synchro Summon.`);
    } };
}
const cantSSFromGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src }; // PARTIAL: only blocks a Special Summon from the GY
const skyUp = g => [g.p[0].fz, g.p[1].fz].some(f => f && f.pos !== 'set' && nm(f) === 'Skyscraper');
const atkLock = { forbid: (g, src, a) => a.type === 'activate' && a.eff.type === 'act' && isST(a.c) && a.p !== src.ctrl && ((g.aw && g.aw.a === src) || (g.battle && g.battle.a === src)) };
/* "Sent to the GY is banished instead" as a follow-up chain link. ENGINE: a replacement rule in move(). */
function banishInstead(test) {
  return { type: 'trig', mand: true,
    on: (g, ev, c) => { if (faceUp(c) && ev.type === 'move' && ev.to === 'gy' && ev.c !== c && test(ev.c)) { (g._toBan = g._toBan || []).push(ev.c); return true; } return false; },
    cond: (g, c) => faceUp(c) && (g._toBan || []).some(x => x.zone === 'gy'),
    res: function* (g, c, p) { const xs = (g._toBan || []).filter(x => x.zone === 'gy'); g._toBan = []; for (const x of xs) move(g, x, 'ban', { reason: 'effect' }); if (xs.length) log(g, `${xs.map(nm).join(', ')} ${xs.length > 1 ? 'were' : 'was'} banished instead (${nm(c)}).`); } };
}

E.addScripts({
  /* ===== Fish OTK ===== */
  // ENGINE: Synchro material condition (all other materials must be WATER) is not checked by synCombos.
  'Fishborg Blaster': { effs: [{ type: 'ign', loc: 'gy', tags: { ss: 1 }, label: 'Discard: Special Summon from the GY',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.length > 0 && monsOf(g, p).some(x => faceUp(x) && attr(x) === 'WATER' && lv(x) <= 3),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard a card', g.p[p].hand, 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${nm(x)}.`); },
    res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c); } }] },
  'Flip Flop Frog': { effs: [
    { type: 'ign', opt: true, label: 'Set this card',
      res: function* (g, c) { if (onField(c) && faceUp(c)) { setFaceDown(g, c); c.posChanged = true; } } },
    { type: 'trig', when: true, label: 'Return monsters to the hand', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
      cond: (g, c, p) => fieldMons(g).length > 0,
      res: function* (g, c, p) { const n = monsOf(g, p).filter(x => faceUp(x) && isFrog(x)).length; if (!n) return;
        const ts = yield* pick(g, p, `Return up to ${n} monster(s) to the hand`, fieldMons(g), 1, n, 'bad');
        for (const t of ts) move(g, t, 'hand', { reason: 'effect', by: p }); if (ts.length) log(g, `${ts.map(nm).join(', ')} returned to the hand.`); } }] },
  'Metabo-Shark': { effs: [{ type: 'trig', when: true, on: (g, ev, c) => evSummoned(ev, c, ['normal']),
    cond: (g, c, p) => g.p[p].gy.filter(isFish).length >= 2,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Shuffle which 2 Fish into the Deck?', g.p[p].gy.filter(isFish), 2, 2, 'good'); },
    res: function* (g, c, p, L) { const ts = L.t.filter(x => x.zone === 'gy'); for (const t of ts) move(g, t, 'deck', { reason: 'effect' }); if (ts.length) log(g, `${ts.map(nm).join(', ')} shuffled into the Deck.`); } }] },
  'Oyster Meister': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 },
    on: (g, ev, c) => fromFieldToGY(ev, c) && !(ev.destroyed && ev.battle), cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) { tokens(g, p, { n: 'Oyster Token', a: 'WATER', r: 'Fish', lv: 1, atk: 0, def: 0 }, 1, 'def'); } }] },
  // ENGINE: Synchro material condition (all other materials must be Fish) is not checked by synCombos.
  'Royal Swamp Eel': { effs: [] },
  'Superancient Deepsea King Coelacanth': { effs: [
    { type: 'ign', opt: true, tags: { ss: 1 }, label: 'Discard: summon Fish from the Deck',
      cond: (g, c, p) => g.p[p].hand.length > 0 && freeM(g, p) >= 0 && g.p[p].deck.some(x => isFish(x) && lv(x) <= 4),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard a card', g.p[p].hand, 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${nm(x)}.`); },
      res: function* (g, c, p) {
        let cands = g.p[p].deck.filter(x => isFish(x) && lv(x) <= 4); const n = Math.min(cands.length, nFreeM(g, p)); if (!n) return;
        if (cands.length > n) cands = yield* pick(g, p, `Special Summon ${n} Fish from your Deck`, cands, n, n, 'good');
        for (const x of cands) if (ss(g, p, x, 'atk', { negate: true })) x.flags.cantAttack = true;
        shuffleDeck(g, p); } },
    { type: 'quick', ds: true, label: 'Tribute a Fish: negate', tags: { destroy: 1 },
      cond: (g, c, p, x) => x.top && !x.top.negated && x.top.p !== undefined && x.top.t && x.top.t.includes(c) && monsOf(g, p).some(y => y !== c && faceUp(y) && isFish(y)),
      cost: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; const [y] = yield* pick(g, p, 'Tribute a Fish', monsOf(g, p).filter(y => y !== c && faceUp(y) && isFish(y)), 1, 1, 'cost'); move(g, y, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${nm(y)}.`); },
      res: function* (g, c, p, L) { L.data.L.negBy = p; negate(g, L.data.L, true); } }] },
  'Moray of Greed': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 3 && g.p[p].hand.filter(x => isMon(x) && attr(x) === 'WATER').length >= 2,
    res: function* (g, c, p) { const w = g.p[p].hand.filter(x => isMon(x) && attr(x) === 'WATER'); if (w.length < 2) return;
      const xs = yield* pick(g, p, 'Shuffle 2 WATER monsters into the Deck', w, 2, 2, 'cost'); for (const x of xs) move(g, x, 'deck', { reason: 'effect' });
      log(g, `${PN(g, p)} shuffled 2 WATER monsters into the Deck.`); draw(g, p, 3); } }] },
  'Salvage': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && attr(x) === 'WATER' && baseAtk(x) <= 1500).length >= 2,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Add which 2 WATER monsters to your hand?', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'WATER' && baseAtk(x) <= 1500), 2, 2, 'good'); },
    res: function* (g, c, p, L) { const ts = L.t.filter(x => x.zone === 'gy'); for (const t of ts) move(g, t, 'hand', { reason: 'effect' }); if (ts.length) log(g, `${PN(g, p)} added ${ts.map(nm).join(', ')} to the hand.`); } }] },
  // PARTIAL: "Cannot be Special Summoned" only blocks a Special Summon from the GY.
  'Dark Dust Spirit': { cont: cantSSFromGY, effs: [
    { type: 'trig', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => { const hit = evSummoned(ev, c, ['normal', 'tribute']) || (ev.type === 'flip' && ev.c === c); if (hit) c.flags.spirit = g.turnNo; return hit; },
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x !== c && faceUp(x)), { by: p }); } },
    { type: 'trig', mand: true, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.spirit === g.turnNo,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { move(g, c, 'hand', { reason: 'effect' }); log(g, 'Dark Dust Spirit returned to the hand.'); } } }] },
  // PARTIAL: "also DARK" needs attr() to read the field (ENGINE). The mandatory negation is offered as an optional Quick Effect
  // (ENGINE: mandatory Quick Effects). "Cannot be Special Summoned" only blocks a Special Summon from the GY.
  'Light and Darkness Dragon': { cont: cantSSFromGY, effs: [
    { type: 'quick', ds: true, label: 'Negate (lose 500 ATK/DEF)',
      cond: (g, c, p, x) => x.top && !x.top.negated && (spellTrapAct(x.top) || (!x.top.cardAct && isMon(x.top.c))) && !g.chain.some(l => l.c === c) && atk(g, c) >= 500 && def(g, c) >= 500,
      cost: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L) { if (!onField(c) || !faceUp(c) || atk(g, c) < 500 || def(g, c) < 500) return; addMod(g, c, { atk: -500, def: -500 }); log(g, 'Light and Darkness Dragon lost 500 ATK and DEF.'); L.data.L.negBy = p; negate(g, L.data.L, false); } },
    { type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField && ev.to === 'gy',
      target: function* (g, c, p, L) { const cs = g.p[p].gy.filter(x => x !== c && isMon(x)); if (cs.length) yield* tgt(g, p, L, 'Special Summon which monster from your GY?', cs, 1, 1, 'good'); },
      res: function* (g, c, p, L) { destroy(g, fieldOf(g, p), { by: p }); const t = L.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  'Twister': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => g.p[p].lp > 500 && stOnField(g).some(x => x !== c && faceUp(x)),
    cost: function* (g, c, p) { pay(g, p, 500); },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which face-up Spell/Trap?', stOnField(g).filter(x => x !== c && faceUp(x)), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { destroy(g, live(L).filter(faceUp), { by: p }); } }] },

  /* ===== Flamvell ===== */
  'Flamvell Firedog': { effs: [{ type: 'trig', tags: { ss: 1 }, on: (g, ev, c) => battleKill(ev, c) && ev.c.owner !== c.ctrl,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && attr(x) === 'FIRE' && num(D(x).def) <= 200 && nm(x) !== 'Flamvell Firedog'),
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isMon(x) && attr(x) === 'FIRE' && num(D(x).def) <= 200 && nm(x) !== 'Flamvell Firedog'); const [x] = yield* pick(g, p, 'Special Summon a FIRE with 200 or less DEF', cs, 1, 1, 'good'); if (x) ss(g, p, x); shuffleDeck(g, p); } }] },
  'Flamvell Magician': { self: { atk: (g, c) => monsOf(g, c.ctrl).some(x => faceUp(x) && /^Ally of Justice/.test(name(x))) ? 400 : 0 }, effs: [] },
  "Gravekeeper's Descendant": { effs: [{ type: 'ign', tags: { destroy: 1 }, label: "Tribute a Gravekeeper's: destroy a card",
    cond: (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x) && isGK(x)) && fieldOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, "Tribute a face-up Gravekeeper's monster", monsOf(g, p).filter(x => x !== c && faceUp(x) && isGK(x)), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${nm(x)}.`); },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which card?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { destroy(g, live(L).filter(x => x.ctrl !== p), { by: p }); } }] },
  "Gravekeeper's Spy": { effs: [{ type: 'trig', mand: true, faceDownOk: true, tags: { ss: 1 }, on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isGK(x) && baseAtk(x) <= 1500),
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isGK(x) && baseAtk(x) <= 1500); const [x] = yield* pick(g, p, "Special Summon a Gravekeeper's with 1500 or less ATK", cs, 1, 1, 'good'); if (x && freeM(g, p) >= 0) ss(g, p, x, yield* posPick(g, p, x)); shuffleDeck(g, p); } }] },
  'Rekindling': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && attr(x) === 'FIRE' && num(D(x).def) === 200),
      res: function* (g, c, p) {
        let cs = g.p[p].gy.filter(x => isMon(x) && attr(x) === 'FIRE' && num(D(x).def) === 200 && !/Cannot be Special Summoned/i.test(D(x).ps || D(x).tx || ''));
        const n = Math.min(cs.length, nFreeM(g, p)); if (!n) return;
        if (cs.length > n) cs = yield* pick(g, p, `Special Summon ${n} FIRE monsters`, cs, n, n, 'good');
        for (const x of cs) if (ss(g, p, x)) { x.flags.rekindleBy = c.u; x.flags.rekindleTurn = g.turnNo; } } },
    // the End Phase banish, run from Rekindling in the GY. PARTIAL: it is skipped if Rekindling has left the GY.
    { type: 'trig', loc: 'gy', mand: true, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(x => x.flags.rekindleBy === c.u && x.flags.rekindleTurn === g.turnNo),
      res: function* (g, c) { const xs = fieldMons(g).filter(x => x.flags.rekindleBy === c.u && x.flags.rekindleTurn === g.turnNo); for (const x of xs) move(g, x, 'ban', { reason: 'effect' }); if (xs.length) log(g, `${xs.map(nm).join(', ')} ${xs.length > 1 ? 'were' : 'was'} banished (Rekindling).`); } }] },

  /* ===== Gladiator Beast ===== */
  'Gladiator Beast Laquari': { self: { atk: (g, c) => c.flags.gb ? 300 : 0 }, effs: [battledHook, tagOut('Gladiator Beast Laquari')] },
  'Gladiator Beast Equeste': { effs: [battledHook, tagOut('Gladiator Beast Equeste'),
    { type: 'trig', mand: true, on: (g, ev, c) => byGB(ev, c), cond: (g, c, p) => g.p[p].gy.some(isGB),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Return which Gladiator Beast card to your hand?', g.p[p].gy.filter(isGB), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${nm(t)} to the hand.`); } } }] },
  'Gladiator Beast Samnite': { effs: [battledHook, tagOut('Gladiator Beast Samnite'),
    { type: 'trig', on: (g, ev, c) => battleKill(ev, c) && c.flags.gb && ev.c.owner !== c.ctrl, cond: (g, c, p) => g.p[p].deck.some(isGB),
      res: function* (g, c, p) { yield* search(g, p, isGB, 'Add a Gladiator Beast card from your Deck'); } }] },
  'Gladiator Beast Retiari': { effs: [battledHook, tagOut('Gladiator Beast Retiari'),
    { type: 'trig', when: true, on: (g, ev, c) => byGB(ev, c), cond: (g, c, p) => g.p[opp(p)].gy.length > 0,
      target: function* (g, c, p, L) { yield* tgt(g, p, L, "Banish which card from your opponent's GY?", g.p[opp(p)].gy, 1, 1, 'bad'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${nm(t)} was banished.`); } } }] },
  'Gladiator Beast Darius': {
    cont: { negates: (g, src, c) => c.flags.dariusBy === src.u && faceUp(c) },
    effs: [battledHook, tagOut('Gladiator Beast Darius'),
      { type: 'trig', when: true, tags: { ss: 1 }, on: (g, ev, c) => byGB(ev, c), cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(gbMon),
        target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which Gladiator Beast from your GY?', g.p[p].gy.filter(gbMon), 1, 1, 'good'); },
        res: function* (g, c, p, L) { const t = L.t[0]; if (!t || t.zone !== 'gy') return; if (onField(c) && faceUp(c)) t.flags.dariusBy = c.u; if (!gbSS(g, p, t)) delete t.flags.dariusBy; } },
      { type: 'trig', loc: 'any', mand: true, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && fieldMons(g).some(x => x.flags.dariusBy === c.u),
        res: function* (g, c) { for (const x of fieldMons(g).filter(x => x.flags.dariusBy === c.u)) { move(g, x, 'deck', { reason: 'effect' }); log(g, `${nm(x)} was shuffled into the Deck.`); } } }] },
  'Gladiator Beast Bestiari': { effs: [battledHook, tagOut('Gladiator Beast Bestiari'),
    { type: 'trig', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => byGB(ev, c), cond: g => stOnField(g).length > 0,
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which Spell/Trap?', stOnField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'Gladiator Beast Murmillo': { effs: [battledHook, tagOut('Gladiator Beast Murmillo'),
    { type: 'trig', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => byGB(ev, c), cond: g => fieldMons(g).some(faceUp),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { destroy(g, live(L).filter(faceUp), { by: p }); } }] },
  'Test Tiger': {
    proc: { label: 'Special Summon (you control a Gladiator Beast)', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && gbMon(x)) },
    effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Tribute: swap a Gladiator Beast',
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && gbMon(x)) && g.p[p].deck.some(gbMon),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed Test Tiger.`); },
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Shuffle which Gladiator Beast into the Deck?', monsOf(g, p).filter(x => faceUp(x) && gbMon(x)), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !faceUp(t)) return; move(g, t, 'deck', { reason: 'effect' }); log(g, `${nm(t)} was shuffled into the Deck.`);
        const cs = g.p[p].deck.filter(gbMon); if (!cs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon a Gladiator Beast from your Deck', cs, 1, 1, 'good'); if (x) gbSS(g, p, x, yield* posPick(g, p, x)); shuffleDeck(g, p); } }] },
  // PARTIAL: the name change needs name() to read it (ENGINE: temporary name changes); the monster is still sent.
  'Elemental HERO Prisma': { effs: [{ type: 'ign', opt: true, label: 'Send a Fusion Material to the GY',
    cond: (g, c, p) => g.p[p].extra.some(f => D(f).k === 'fusion' && fusionNames(f).some(n => g.p[p].deck.some(x => isMon(x) && nm(x) === n))),
    res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return;
      const fs = g.p[p].extra.filter(f => D(f).k === 'fusion' && fusionNames(f).some(n => g.p[p].deck.some(x => isMon(x) && nm(x) === n))); if (!fs.length) return;
      const [f] = yield* pick(g, p, 'Reveal which Fusion Monster?', fs, 1, 1, 'good'); log(g, `${PN(g, p)} revealed ${nm(f)}.`);
      const names = fusionNames(f); const x = yield* search(g, p, x => isMon(x) && names.includes(nm(x)), 'Send which listed monster to the GY?', 'gy');
      if (x && onField(c)) { c.flags.prismaName = nm(x); c.flags.prismaTurn = g.turnNo; log(g, `Elemental HERO Prisma's name became ${nm(x)} until the End Phase.`); } } }] },
  // Shrink: the original ATK becomes half, then other changes apply on top. A second Shrink does nothing more.
  'Shrink': { effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Halve the original ATK of which monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !faceUp(t) || t.mods.some(m => m.shrink)) return; const b = baseAtk(t) + (t.flags.gb && nm(t) === 'Gladiator Beast Laquari' ? 300 : 0); addMod(g, t, { atk: -(b - Math.ceil(b / 2)), end: true, shrink: true }); log(g, `${name(t)}'s original ATK became ${Math.ceil(b / 2)}.`); } }] },
  'Gladiator Beast War Chariot': { effs: [{ type: 'act',
    cond: (g, c, p, x) => x.top && !x.top.negated && !x.top.cardAct && isMon(x.top.c) && monsOf(g, p).some(y => faceUp(y) && gbMon(y)),
    target: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L) { L.data.L.negBy = p; negate(g, L.data.L, true); } }] },
  'Gladiator Beast Gyzarus': {
    proc: contactProc([x => nm(x) === 'Gladiator Beast Bestiari', gbMon], 'Special Summon (shuffle Bestiari + 1 Gladiator Beast)'),
    effs: [battledHook, tagOut('Gladiator Beast Gyzarus', 2, 'Gladiator Beast Bestiari'),
      { type: 'trig', when: true, tags: { destroy: 1 }, label: 'Destroy up to 2 cards', on: (g, ev, c) => evSummoned(ev, c), cond: g => allField(g).length > 1,
        target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy up to 2 cards', allField(g).filter(x => x !== c), 1, 2, 'bad'); },
        res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'Gladiator Beast Heraklinos': {
    proc: contactProc([x => nm(x) === 'Gladiator Beast Laquari', gbMon, gbMon], 'Special Summon (shuffle Laquari + 2 Gladiator Beasts)'),
    effs: [{ type: 'quick', ds: true, label: 'Discard: negate a Spell/Trap',
      cond: (g, c, p, x) => spellTrapAct(x.top) && !x.top.negated && g.p[p].hand.length > 0,
      cost: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; const [y] = yield* pick(g, p, 'Discard a card', g.p[p].hand, 1, 1, 'cost'); move(g, y, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${nm(y)}.`); },
      res: function* (g, c, p, L) { L.data.L.negBy = p; negate(g, L.data.L, true); } }] },
  'Elemental HERO Grand Neos': {
    proc: contactProc([x => nm(x) === 'Elemental HERO Neos', x => nm(x) === 'Neo-Spacian Grand Mole'], 'Special Summon (shuffle Neos + Grand Mole)'),
    effs: [{ type: 'ign', opt: true, label: 'Return a monster to the hand', cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Return which monster to the hand?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (t) { move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${D(t).n} returned to the hand.`); } } },
    { type: 'trig', mand: true, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end',
      res: function* (g, c) { if (onField(c)) { move(g, c, 'extra', { reason: 'effect' }); log(g, 'Elemental HERO Grand Neos was shuffled into the Extra Deck.'); } } }] },
  'Gladiator Beast Hoplomus': { self: { def: (g, c) => c.flags.gb ? 300 : 0 }, effs: [battledHook, tagOut('Gladiator Beast Hoplomus')] },
  'Neo-Spacian Grand Mole': { effs: [{ type: 'trig', label: 'Return both battling monsters to the hand',
    on: (g, ev, c) => ev.type === 'dsStart' && (ev.a === c || ev.t === c) && !!ev.a && !!ev.t,
    res: function* (g, c, p, L) { const o = L.ev.a === c ? L.ev.t : L.ev.a; if (!onField(c) || !o || !onField(o)) return; move(g, o, 'hand', { reason: 'effect', by: p }); move(g, c, 'hand', { reason: 'effect', by: p }); log(g, `${D(o).n} and Neo-Spacian Grand Mole returned to the hand.`); } }] },
  'Hedge Guard': { effs: [
    { type: 'quick', loc: 'hand', ds: true, label: 'Halve ATK: survive this battle',
      cond: (g, c, p) => g.inDS && g.battle && g.battle.t && [g.battle.a, g.battle.t].some(x => x && x.ctrl === p && onField(x) && faceUp(x)),
      cost: function* (g, c, p, L) { L.data.m = [g.battle.a, g.battle.t].find(x => x && x.ctrl === p); move(g, c, 'gy', { reason: 'cost' }); },
      res: function* (g, c, p, L) { const m = L.data.m; if (!m || !onField(m) || !faceUp(m)) return; const A = atk(g, m); addMod(g, m, { atk: -(A - Math.ceil(A / 2)), end: true }); m.flags.noBattleDestroy = true; m.flags.hedgeBy = c.u; log(g, `${name(m)}'s ATK was halved and it can't be destroyed by this battle.`); } },
    { type: 'trig', loc: 'gy', on: (g, ev, c) => { if (ev.type === 'dsEnd') for (const m of fieldMons(g)) if (m.flags.hedgeBy === c.u) { delete m.flags.noBattleDestroy; delete m.flags.hedgeBy; } return false; }, res: function* () {} }] },
  // ENGINE: the engine collects no triggers from the Field Zone, so the ② (destroy attackers) is written but does not fire yet.
  // PARTIAL: it is set for the End Phase, not the end of the Battle Phase.
  'Ancient Forest': { effs: [
    { type: 'act', res: function* (g, c, p) { for (const m of fieldMons(g)) if (m.pos !== 'atk') { if (m.pos === 'set') log(g, `The face-down monster was ${nm(m)}.`); m.pos = 'atk'; } log(g, 'All Defense Position monsters changed to Attack Position.'); } },
    { type: 'trig', loc: 'fz', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(x => x.declared),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.declared), { by: p }); } }] },
  // ENGINE: a replacement rule in move(); here a follow-up chain link banishes monsters that reached the GY.
  'Dimensional Fissure': { effs: [{ type: 'act', res: function* () {} }, { ...banishInstead(isMon), loc: 'st' }] },
  'Trap Hole': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.sw && g.events.length && g.events[g.events.length - 1].group === g.sw.group && g.sw.p !== p && ['normal', 'tribute', 'flip'].includes(g.sw.how) && g.sw.cs.length === 1 && onField(g.sw.cs[0]) && faceUp(g.sw.cs[0]) && atk(g, g.sw.cs[0]) >= 1000,
    target: function* (g, c, p, L) { L.t = g.sw ? [g.sw.cs[0]] : []; },
    res: function* (g, c, p, L) { destroy(g, live(L).filter(x => faceUp(x) && atk(g, x) >= 1000), { by: p }); } }] },

  /* ===== Hero Beat ===== */
  // PARTIAL: the ② self-destruction is a mandatory trigger checked after events, not an instant rule.
  'Elemental HERO Captain Gold': { effs: [
    { type: 'ign', loc: 'hand', label: 'Discard: add Skyscraper', cond: (g, c, p) => g.p[p].deck.some(x => nm(x) === 'Skyscraper'),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded Elemental HERO Captain Gold.`); },
      res: function* (g, c, p) { yield* search(g, p, x => nm(x) === 'Skyscraper', 'Add Skyscraper'); } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ['move', 'summon', 'phase'].includes(ev.type) && !skyUp(g), cond: (g, c) => !skyUp(g) && onField(c) && faceUp(c),
      res: function* (g, c, p) { if (onField(c) && faceUp(c) && !skyUp(g)) destroy(g, [c], { by: p }); } }] },
  'Skyscraper': { effs: [{ type: 'act', res: function* () {} }],
    cont: { atk: (g, src, c) => { const b = g.battle; if (!g.inDS || !b || b.a !== c || !b.t || !isEHERO(c) || g._sky) return 0; g._sky = true; try { return atk(g, b.t) > atk(g, c) ? 1000 : 0; } finally { g._sky = false; } } } },

  /* ===== Norleras ===== */
  'Sky Scourge Norleras': { cont: cantSSFromGY,
    proc: { label: 'Special Summon (banish 1 LIGHT Fairy + 3 DARK Fiends)',
      cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'LIGHT' && race(x) === 'Fairy') && g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK' && race(x) === 'Fiend').length >= 3,
      cost: function* (g, c, p, grp) { const [a] = yield* pick(g, p, 'Banish a LIGHT Fairy from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT' && race(x) === 'Fairy'), 1, 1, 'cost');
        const ds = yield* pick(g, p, 'Banish 3 DARK Fiends from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK' && race(x) === 'Fiend'), 3, 3, 'cost');
        for (const x of [a, ...ds]) move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${[a, ...ds].map(nm).join(', ')}.`); } },
    effs: [{ type: 'ign', label: 'Pay 1000: send all hands and fields to the GY', cond: (g, c, p) => g.p[p].lp > 1000,
      cost: function* (g, c, p) { pay(g, p, 1000); },
      res: function* (g, c, p) { const grp = g.group; const xs = [...g.p[0].hand, ...g.p[1].hand, ...allField(g)]; for (const x of xs) move(g, x, 'gy', { reason: 'effect', by: p, group: grp, noLater: true });
        if (xs.length) { log(g, 'Every card in both hands and on the field was sent to the GY.'); draw(g, p, 1); } } }] },
  'The Dark Creator': {
    proc: { label: 'Special Summon (5+ DARKs in your GY, no monsters)', cond: (g, c, p) => monsOf(g, p).length === 0 && g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK').length >= 5 },
    effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Banish a DARK: revive a DARK',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK').length >= 2,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish a DARK from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK'), 1, 1, 'cost'); move(g, x, 'ban', { reason: 'cost' }); },
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which DARK from your GY?', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK'), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  // PARTIAL: copies the name and original ATK only; ENGINE: copying another card's effects (scripts are looked up by printed name).
  'Phantom of Chaos': {
    cont: { dmg: (g, src, p, n, o) => o.battle && p !== src.ctrl && !src.flags.poc && g.battle && (g.battle.a === src || g.battle.t === src) ? 0 : n },
    effs: [{ type: 'ign', opt: true, label: 'Copy a monster in the GY',
      cond: (g, c, p) => g.p[p].gy.some(x => D(x).k === 'effect' && !isGemini(x)),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Banish which Effect Monster to copy?', g.p[p].gy.filter(x => D(x).k === 'effect' && !isGemini(x)), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (!t || t.zone !== 'gy' || !onField(c) || !faceUp(c)) return; move(g, t, 'ban', { reason: 'effect' });
        c.flags.baseAtk = baseAtk(t); c.flags.poc = g.turnNo; c.flags.pocName = nm(t); log(g, `Phantom of Chaos copied ${nm(t)} (${baseAtk(t)} ATK) until the End Phase.`); } },
    { type: 'trig', on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'end' && c.flags.poc) { delete c.flags.baseAtk; delete c.flags.poc; delete c.flags.pocName; } return false; }, res: function* () {} }] },

  /* ===== Quickdraw Plant ===== */
  'Night Assailant': { effs: [
    { type: 'trig', mand: true, faceDownOk: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'flip' && ev.c === c, cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } },
    { type: 'trig', loc: 'gy', mand: true, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'hand' && ev.to === 'gy',
      cond: (g, c, p) => g.p[p].gy.some(x => x !== c && isMon(x) && hasAb(x, 'Flip')),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Return which Flip monster to your hand?', g.p[p].gy.filter(x => x !== c && isMon(x) && hasAb(x, 'Flip')), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${nm(t)} to the hand.`); } } }] },
  // ENGINE: the Synchron substitution only works for the Synchros scripted here (their own summon rule); the engine's generic
  // Synchro Summon still lets Quickdraw Synchron be material for any Synchro.
  'Quickdraw Synchron': { effs: [{ type: 'ign', loc: 'hand', tags: { ss: 1 }, label: 'Send a monster: Special Summon',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => x !== c && isMon(x)),
    res: function* (g, c, p) { if (c.zone !== 'hand' || freeM(g, p) < 0) return; const ms = g.p[p].hand.filter(x => x !== c && isMon(x)); if (!ms.length) return;
      const [x] = yield* pick(g, p, 'Send a monster from your hand to the GY', ms, 1, 1, 'cost'); move(g, x, 'gy', { reason: 'effect' }); log(g, `${PN(g, p)} sent ${nm(x)} to the GY.`); ss(g, p, c); } }] },
  'Drill Warrior': { noSynchro: true, proc: synProc(['Drill Synchron', 'Quickdraw Synchron']),
    self: { directAttack: (g, c) => c.flags.drillDirect === g.turnNo },
    effs: [
      { type: 'ign', opt: true, label: 'Halve ATK: attack directly', cond: g => g.phase === 'main1',
        res: function* (g, c) { if (!onField(c) || !faceUp(c)) return; const A = atk(g, c); addMod(g, c, { atk: -(A - Math.ceil(A / 2)) }); c.flags.drillDirect = g.turnNo; log(g, 'Drill Warrior halved its ATK and can attack directly this turn.'); } },
      { type: 'ign', opt: true, label: 'Discard: banish until your next Standby Phase', cond: (g, c, p) => g.p[p].hand.length > 0,
        res: function* (g, c, p) { if (!g.p[p].hand.length) return; const [x] = yield* pick(g, p, 'Discard a card', g.p[p].hand, 1, 1, 'cost'); move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${nm(x)}.`);
          if (onField(c)) { move(g, c, 'ban', { reason: 'effect' }); c.flags.drillRet = { p: c.owner, turn: g.turnNo }; log(g, 'Drill Warrior was banished.'); } } },
      { type: 'trig', loc: 'ban', mand: true, tags: { ss: 1 }, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && c.flags.drillRet && ev.tp === c.flags.drillRet.p && g.turnNo > c.flags.drillRet.turn,
        res: function* (g, c, p) { if (c.zone !== 'ban') return; delete c.flags.drillRet; const o = c.owner;
          if (freeM(g, o) < 0 || !ss(g, o, c)) { move(g, c, 'gy', { reason: 'rule' }); return; }
          const ms = g.p[o].gy.filter(isMon); if (ms.length) { const [x] = yield* pick(g, o, 'Add a monster from your GY to your hand', ms, 1, 1, 'good'); if (x) { move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, o)} added ${nm(x)} to the hand.`); } } } }] },
  'Junk Archer': { noSynchro: true, proc: synProc(['Junk Synchron', 'Quickdraw Synchron']),
    effs: [{ type: 'ign', opt: true, label: 'Banish a monster until the End Phase', cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Banish which monster until the End Phase?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (!t) return; const pos = t.pos, ctrl = t.ctrl; move(g, t, 'ban', { reason: 'effect', by: p });
        if (t.zone === 'ban') { t.flags.archerBy = c.u; t.flags.archerTurn = g.turnNo; t.flags.archerPos = pos; t.flags.archerCtrl = ctrl; } log(g, `${D(t).n} was banished until the End Phase.`); } },
    { type: 'trig', loc: 'any', mand: true, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && allCards(g, 'ban').some(x => x.flags.archerBy === c.u && x.flags.archerTurn === g.turnNo),
      res: function* (g, c) { for (const x of allCards(g, 'ban').filter(x => x.flags.archerBy === c.u && x.flags.archerTurn === g.turnNo)) { const f = x.flags; x.flags = {};
        if (freeM(g, f.archerCtrl) >= 0) { move(g, x, 'm', { ctrl: f.archerCtrl, pos: f.archerPos, reason: 'effect' }); log(g, `${x.pos === 'set' ? 'A face-down monster' : nm(x)} returned to the field.`); }
        else { move(g, x, 'gy', { reason: 'rule' }); log(g, `${nm(x)} was sent to the GY (no free zone).`); } } } }] },
  // PARTIAL: Spell activations are seen when a Spell is activated from the hand or a Normal/Quick-Play Spell leaves after resolving;
  // the second attack is a normal extra attack, not forced onto the changed monster.
  'Nitro Warrior': { noSynchro: true, proc: synProc(['Nitro Synchron', 'Quickdraw Synchron']),
    self: { atk: (g, c) => c.flags.nitro && g.inDS && g.battle && g.battle.a === c ? 1000 : 0 },
    effs: [
      { type: 'trig', on: (g, ev, c) => {
          if (ev.type === 'move' && g.tp === c.ctrl && ev.c.ctrl === c.ctrl && isSpell(ev.c) && c.flags.nitroTurn !== g.turnNo && (ev.reason === 'activate' || (ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && ['Normal', 'Quick-Play'].includes(D(ev.c).sub) && !ev.destroyed))) { c.flags.nitro = true; c.flags.nitroTurn = g.turnNo; }
          if (ev.type === 'afterCalc' && ev.a === c) c.flags.nitro = false;
          return false; }, res: function* () {} },
      { type: 'trig', opt: true, label: 'Second attack', on: (g, ev, c) => battleKill(ev, c) && g.battle && g.battle.a === c,
        cond: (g, c, p) => monsOf(g, opp(p)).some(x => faceUp(x) && x.pos === 'def'),
        target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Change which Defense Position monster to Attack Position?', monsOf(g, opp(p)).filter(x => faceUp(x) && x.pos === 'def'), 1, 1, 'bad'); },
        res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !faceUp(t) || t.pos !== 'def') return; t.pos = 'atk'; log(g, `${name(t)} changed to Attack Position.`); if (onField(c)) { c.flags.extraAttack = g.turnNo; log(g, 'Nitro Warrior can attack again.'); } } }] },
  // ENGINE: "can't be targeted by Level 6 or lower monsters' effects" is not enforced by tgt().
  'Turbo Warrior': { noSynchro: true, proc: synProc(['Turbo Synchron', 'Quickdraw Synchron']),
    self: { cantBeTargeted: true },
    effs: [
      { type: 'trig', mand: true, on: (g, ev, c) => ev.type === 'attack' && ev.a === c && ev.t && faceUp(ev.t) && D(ev.t).k === 'synchro' && lv(ev.t) >= 6,
        res: function* (g, c, p, L) { const t = g.aw ? g.aw.t : L.ev.t; if (!t || !onField(t) || !faceUp(t)) return; const A = atk(g, t); addMod(g, t, { atk: -(A - Math.ceil(A / 2)), end: true, turbo: c.u }); log(g, `${name(t)}'s ATK was halved.`); } },
      { type: 'trig', on: (g, ev, c) => { if (ev.type === 'dsEnd' && ev.a === c && ev.t) ev.t.mods = ev.t.mods.filter(m => m.turbo !== c.u); return false; }, res: function* () {} }] },
  'System Down': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp > 1000 && [...monsOf(g, opp(p)).filter(faceUp), ...g.p[opp(p)].gy].some(x => isMon(x) && race(x) === 'Machine'),
    cost: function* (g, c, p) { pay(g, p, 1000); },
    res: function* (g, c, p) { const xs = [...monsOf(g, opp(p)).filter(faceUp), ...g.p[opp(p)].gy].filter(x => isMon(x) && race(x) === 'Machine'); for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.map(nm).join(', ')} ${xs.length > 1 ? 'were' : 'was'} banished.`); } }] },
  "Gottoms' Emergency Call": { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => nFreeM(g, p) >= 2 && fieldMons(g).some(x => faceUp(x) && /^X-Saber/.test(name(x))) && allCards(g, 'gy').filter(x => isMon(x) && /^X-Saber/.test(nm(x))).length >= 2,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which 2 X-Sabers?', allCards(g, 'gy').filter(x => isMon(x) && /^X-Saber/.test(nm(x))), 2, 2, 'good'); },
    res: function* (g, c, p, L) { if (L.t.length < 2 || L.t.some(x => x.zone !== 'gy') || nFreeM(g, p) < 2) return; for (const t of L.t) ss(g, p, t); } }] },
  'Swallow Flip': { effs: [{ type: 'act',
    cond: (g, c, p, x) => x.top && !x.top.negated && !x.top.cardAct && isMon(x.top.c) && x.top.eff.type === 'trig' && x.top.ev && x.top.ev.type === 'summon' && !['normal', 'tribute', 'flip', 'gemini'].includes(x.top.ev.how),
    target: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L) { L.data.L.negBy = p; negate(g, L.data.L, true); } }] },

  /* ===== Ancient Gear ===== */
  // ENGINE: the ③ "destroy this card instead" substitution needs a destruction replacement hook.
  'Machina Peacekeeper': { effs: [
    { type: 'trig', loc: 'gy', when: true, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy',
      cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && hasAb(x, 'Union')),
      res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && hasAb(x, 'Union'), 'Add a Union monster from your Deck'); } },
    { type: 'ign', label: 'Equip to a Machine',
      cond: (g, c, p) => c.used.union !== g.turnNo && freeST(g, p) >= 0 && monsOf(g, p).some(x => x !== c && faceUp(x) && race(x) === 'Machine' && !stOf(g, p).some(s => s.equipTo === x.u && s.flags.union)),
      after: (g, c) => { c.used.union = g.turnNo; },
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Equip Machina Peacekeeper to which Machine?', monsOf(g, p).filter(x => x !== c && faceUp(x) && race(x) === 'Machine' && !stOf(g, p).some(s => s.equipTo === x.u && s.flags.union)), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !faceUp(t) || !onField(c) || c.zone !== 'm' || freeST(g, p) < 0) return; move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); c.equipTo = t.u; c.flags.union = true; log(g, `Machina Peacekeeper was equipped to ${name(t)}.`); } },
    { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Unequip and Special Summon', cond: (g, c, p) => c.used.union !== g.turnNo && !!c.equipTo && freeM(g, p) >= 0,
      after: (g, c) => { c.used.union = g.turnNo; },
      res: function* (g, c, p) { if (c.zone !== 'st' || !c.equipTo) return; c.equipTo = null; ss(g, p, c, 'atk'); } }] },
  'Ancient Gear Gadjiltron Dragon': { cont: atkLock,
    self: { piercing: (g, c) => !!c.flags.green },
    effs: [
      { type: 'trig', on: (g, ev, c) => { if (evSummoned(ev, c, ['tribute']) && ev.tribs) for (const t of ev.tribs) { const n = nm(t); if (n === 'Green Gadget') c.flags.green = true; if (n === 'Red Gadget') c.flags.red = true; if (n === 'Yellow Gadget') c.flags.yellow = true; } return false; }, res: function* () {} },
      { type: 'trig', mand: true, on: (g, ev, c) => c.flags.red && ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl, res: function* (g, c, p) { damage(g, opp(p), 400, { src: c, srcP: p }); } },
      { type: 'trig', mand: true, on: (g, ev, c) => c.flags.yellow && battleKill(ev, c) && ev.c.owner !== c.ctrl, res: function* (g, c, p) { damage(g, opp(p), 600, { src: c, srcP: p }); } }] },
  // PARTIAL: "Cannot be Special Summoned" is not enforced (its field effect uses the card's one static slot); negation of a
  // destroyed monster's GY Trigger Effects needs the engine (ENGINE: negating triggers in the GY). Flip effects are negated.
  'Ancient Gear Beast': {
    cont: { forbid: (g, src, a) => atkLock.forbid(g, src, a) || (a.type === 'activate' && a.c.zone === 'gy' && (g._agbNeg || []).includes(a.c.u)) },
    effs: [{ type: 'trig', on: (g, ev, c) => {
        if (ev.type === 'afterCalc' && ev.a === c && ev.t && ev.t.flags.battleDoomed) ev.t.flags.negated = true;
        if (battleKill(ev, c)) (g._agbNeg = g._agbNeg || []).push(ev.c.u);
        if (ev.type === 'move' && ev.from === 'gy' && g._agbNeg) g._agbNeg = g._agbNeg.filter(u => u !== ev.c.u);
        return false; }, res: function* () {} }] },
  'Terraforming': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.some(x => isSpell(x) && D(x).sub === 'Field'),
    res: function* (g, c, p) { yield* search(g, p, x => isSpell(x) && D(x).sub === 'Field', 'Add a Field Spell'); } }] },
  // ENGINE: ① (1 less Tribute for Ancient Gear monsters) needs tribNeed() support.
  'Geartown': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy',
      cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].some(isAG),
      res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].filter(isAG); if (!cs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon an Ancient Gear monster', cs, 1, 1, 'good'); if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x); if (fromDeck) shuffleDeck(g, p); } } }] },
  // ENGINE: ① (every monster becomes a Zombie) needs race() to read it; ② blocks face-up Tribute Summons of non-Zombies.
  'Zombie World': { effs: [{ type: 'act', res: function* () {} }],
    cont: { forbid: (g, src, a) => a.type === 'ns' && lv(a.c) >= 5 && race(a.c) !== 'Zombie' } },
  'Limiter Removal': { effs: [
    { type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Machine'),
      res: function* (g, c, p) { const ms = monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Machine'); for (const m of ms) { addMod(g, m, { atk: atk(g, m), end: true }); m.flags.limiterBy = c.u; m.flags.limiterTurn = g.turnNo; } if (ms.length) log(g, `${ms.map(name).join(', ')} doubled ATK.`); } },
    // PARTIAL: the End Phase destruction runs from Limiter Removal in the GY, so it is skipped if the card left the GY.
    { type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(x => x.flags.limiterBy === c.u && x.flags.limiterTurn === g.turnNo),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.flags.limiterBy === c.u && x.flags.limiterTurn === g.turnNo), { by: p }); } }] },
  // ENGINE: a replacement rule in move(); here a follow-up chain link banishes cards that reached the GY.
  'Banisher of the Radiance': { effs: [banishInstead(() => true)] },
});

function fusionNames(f) { const first = (D(f).tx || D(f).ps || '').split('\n')[0]; return [...first.matchAll(/"([^"]+)"/g)].map(m => m[1]); }
})();
