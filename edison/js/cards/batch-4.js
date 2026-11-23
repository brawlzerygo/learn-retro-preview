/* Batch 4: Diva FLIP, Gemini, Gravekeeper, Hopeless Dragon, Kuraz, Machina Gadget, Machina Roid, Quickdraw Volcanic,
 TeleDAD, Alien. Card scripts for js/engine.js (see build/CARD_SCRIPTS.md). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, setFaceDown, negate, addMod,
  equip, equippedTo, link, addCtr, ctr, negateAttack, endBattle, addRule, token, tokens, fusionSummon, canFusion, ritualSummon, canRitual,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned,
  fromFieldToGY, battleKill, isGemini } = L;
const atk = L.atk, def = L.def;
const forbid = L.forbid, emit = L.emit, tributeCands = L.tributeCands, isExtraD = L.isExtraD, negd = L.negd;

/* ---------- shared helpers for this batch ---------- */
// ENGINE: statics() is cached by g.seq, and turning a Set card face-up emits no event, so a Continuous card's cont would
// stay invisible until the next event. touch() invalidates the cache when a Continuous card resolves.
const touch = g => { g.seq++; };
const NSS = ['normal', 'tribute', 'special', 'synchro', 'fusion', 'ritual']; // "Normal/Special Summoned"
const nm = c => D(c).n;
const gem = c => !!c.flags.gemini; // a Gemini treated as an Effect Monster
const isAlien = c => /Alien/.test(name(c));
const isRoid = c => /roid/i.test(D(c).n) && !/android/i.test(D(c).n);
const isGK = c => /^Gravekeeper's/.test(name(c));
const normalInGY = c => isMon(c) && (D(c).k === 'normal' || isGemini(c));
const isEffectMon = c => isMon(c) && !['normal', 'token'].includes(D(c).k) && D(c).ab !== 'non-Synchro' && !(isGemini(c) && !gem(c));
const fieldSpells = g => [g.p[0].fz, g.p[1].fz].filter(Boolean);
// Necrovalley face-up on the field
const nvUp = g => fieldSpells(g).some(x => faceUp(x) && nm(x) === 'Necrovalley');
// Necrovalley's 3rd effect: an effect that targets a card in the GY is negated at resolution
function nvNeg(g, c) { if (!nvUp(g)) return false; log(g, `Necrovalley negated ${name(c)}'s effect.`); return true; }
// Imperial Iron Wall / Necrovalley: can cards be banished (from the GY)?
const noBanish = (g, from) => forbid(g, { type: 'banish', from });
const aCount = g => fieldMons(g).concat(stOnField(g)).reduce((s, x) => s + ctr(x, 'A'), 0);
function* removeA(g, p, n) { // remove n A-Counters from cards on the field (the player picks)
  for (let i = 0; i < n; i++) {
    const cs = allField(g).filter(x => ctr(x, 'A') > 0); if (!cs.length) return false;
    const [x] = yield* pick(g, p, `Remove an A-Counter from which card? (${i + 1} of ${n})`, cs, 1, 1, 'cost');
    addCtr(g, x, 'A', -1);
  }
  log(g, `${PN(g, p)} removed ${n} A-Counter${n > 1 ? 's' : ''}.`); return true;
}
// Can this monster be Normal Summoned at all (from the hand)?
const canNS = c => { const d = D(c); return isMon(c) && !isExtraD(d) && !['token', 'ritual'].includes(d.k) && !/Cannot be Normal Summoned/i.test(d.ps || d.tx || ''); };
const tribFor = c => lv(c) >= 7 ? 2 : lv(c) >= 5 ? 1 : 0;
const nsOk = (g, p, c) => { const n = tribFor(c), t = tributeCands(g, p).length; return t >= n && (n > 0 || freeM(g, p) >= 0) && !forbid(g, { type: 'ns', c, p }); };
/* A Normal Summon/Set done during an effect's resolution (Ultimate Offering, Mausoleum of the Emperor). No summon negation window.
 o.noTrib: summon without Tributing (Mausoleum); o.setOk: may Set instead. */
function* effectNS(g, p, cands, o = {}) {
  if (!cands.length) return null;
  const [c] = yield* pick(g, p, o.text || 'Normal Summon or Set which monster?', cands, 1, 1, 'good'); if (!c) return null;
  let set = false;
  if (o.setOk && !forbid(g, { type: 'set', c, p })) set = (yield* choose(g, p, `${name(c)}: Summon or Set?`, ['Normal Summon', 'Set face-down'])) === 1;
  const need = o.noTrib ? 0 : tribFor(c); let tribs = [];
  const grp = g.group;
  if (need) { tribs = yield* pick(g, p, `Choose ${need} monster${need > 1 ? 's' : ''} to Tribute`, tributeCands(g, p), need, need, 'cost'); for (const t of tribs) move(g, t, 'gy', { reason: 'tribute', by: p, group: grp, tributeFor: c.u }); if (tribs.length) log(g, `${PN(g, p)} Tributed ${tribs.map(x => D(x).n).join(', ')}.`); }
  if (freeM(g, p) < 0 || c.zone !== 'hand') return null;
  move(g, c, 'm', { ctrl: p, pos: set ? 'set' : 'atk', reason: set ? 'set' : 'summon', group: grp });
  c.summonType = tribs.length ? 'tribute' : 'normal'; c.tributes = tribs.map(t => t.u);
  if (set) { log(g, `${PN(g, p)} Set a monster.`); emit(g, { type: 'set', c, p }, grp); return c; }
  log(g, `${PN(g, p)} ${tribs.length ? 'Tribute' : 'Normal'} Summoned ${name(c)}.`);
  const ev = emit(g, { type: 'summon', cs: [c], how: c.summonType, p, tribs }, grp);
  g.sw = { cs: [c], p, how: c.summonType, group: ev.group };
  return c;
}
/* Synchro materials for Synchro Monsters whose material line the engine can't read (they use noSynchro + this proc).
 A Gemini "Tuned Magician" treated as an Effect Monster counts as a Tuner here. */
const isTuner = (g, c) => !!D(c).tu || (nm(c) === 'Tuned Magician' && gem(c) && !negd(g, c));
function synMats(g, p, level, tunerF, nonF) {
  const mons = monsOf(g, p).filter(faceUp), out = [];
  for (let mask = 1; mask < (1 << mons.length) && out.length < 8; mask++) {
    const ms = mons.filter((_, i) => mask & (1 << i)); if (ms.length < 2) continue;
    const tun = ms.filter(x => isTuner(g, x)), non = ms.filter(x => !isTuner(g, x));
    if (tun.length !== 1 || !non.length || !tunerF(tun[0]) || !non.every(nonF)) continue;
    if (ms.reduce((s, x) => s + lv(x), 0) !== level) continue;
    out.push(ms);
  }
  return out;
}
function synProc(level, tunerF, nonF) {
  return { extra: true, how: 'synchro', label: 'Synchro Summon',
    cond: (g, c, p) => synMats(g, p, level, tunerF, nonF).length > 0,
    cost: function* (g, c, p, grp) {
      const cs = synMats(g, p, level, tunerF, nonF); let mats = cs[0];
      if (cs.length > 1) mats = cs[yield* choose(g, p, `Synchro Summon ${name(c)} with which monsters?`, cs.map(m => m.map(name).join(' + ')))];
      for (const m of mats) move(g, m, 'gy', { reason: 'synchro', by: p, group: grp });
      log(g, `${PN(g, p)} sent ${mats.map(m => D(m).n).join(' + ')} to the GY for a Synchro Summon.`);
    } };
}
// "until the end of the opponent's 3rd turn": the turn number it runs through
const thirdTurn = (g, p) => g.turnNo + (g.tp === p ? 5 : 4);

// Cards the engine scripts that banish (for Imperial Iron Wall) or banish from / target the GY (for Necrovalley).
const SC = n => E.SCRIPTS[n];
const effIs = (a, n, i) => nm(a.c) === n && SC(n) && SC(n).effs && SC(n).effs[i] === a.eff;
const BANISHERS = ['Dark Armed Dragon', 'Allure of Darkness', 'Bottomless Trap Hole', 'Dimensional Prison', 'Blackwing - Vayu the Emblem of Honor',
  'Miracle Fusion', 'Gold Sarcophagus', 'Cyber Valley', 'Nobleman of Extermination', 'Macro Cosmos', 'D.D. Crow', 'Nobleman of Crossout', 'Book of Life'];
const GY_BANISH = a => ['Dark Armed Dragon', 'Blackwing - Vayu the Emblem of Honor', 'D.D. Crow', 'Book of Life'].includes(nm(a.c)) || effIs(a, 'Black Rose Dragon', 1);
const GY_TARGET = a => effIs(a, 'Tragoedia', 2);

E.addScripts({
  /* ----- Diva FLIP ----- */
  'Cyber Valley': { effs: [
    { type: 'trig', label: 'Banish it: draw 1 and end the Battle Phase',
      on: (g, ev, c) => ev.type === 'attack' && ev.t === c && ev.p !== c.ctrl,
      cond: (g, c, p) => !noBanish(g) && g.p[p].deck.length > 0,
      cost: function* (g, c, p) { move(g, c, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished Cyber Valley.`); },
      res: function* (g, c, p) { draw(g, p, 1); endBattle(g); } },
    { type: 'ign', label: 'Banish it and a monster: draw 2',
      cond: (g, c, p) => !noBanish(g) && monsOf(g, p).some(x => x !== c && faceUp(x)) && g.p[p].deck.length >= 2,
      target: function* (g, c, p, L) { const [x] = yield* pick(g, p, 'Banish which other face-up monster you control?', monsOf(g, p).filter(x => x !== c && faceUp(x)), 1, 1, 'cost'); L.t = [c, x]; },
      res: function* (g, c, p, L) { const [a, b] = L.t; if (!onField(a) || !b || !onField(b) || !faceUp(b) || noBanish(g)) return; move(g, b, 'ban', { reason: 'effect' }); move(g, a, 'ban', { reason: 'effect' }); log(g, `${PN(g, p)} banished Cyber Valley and ${D(b).n}.`); draw(g, p, 2); } },
    { type: 'ign', label: 'Banish it and a hand card: GY card to Deck top',
      cond: (g, c, p) => !noBanish(g) && g.p[p].gy.length > 0 && g.p[p].hand.length > 0,
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Put which card from your GY on top of your Deck?', g.p[p].gy, 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (nvNeg(g, c)) return; if (!onField(c) || !g.p[p].hand.length || noBanish(g)) return;
        const [h] = yield* pick(g, p, 'Banish which card from your hand?', g.p[p].hand, 1, 1, 'cost');
        move(g, c, 'ban', { reason: 'effect' }); move(g, h, 'ban', { reason: 'effect' }); log(g, `${PN(g, p)} banished Cyber Valley and ${name(h)}.`);
        if (t && t.zone === 'gy') { move(g, t, 'deckTop', { reason: 'effect' }); log(g, `${D(t).n} was put on top of the Deck.`); } } }] },
  // PARTIAL: the negation is optional here (the card says it is mandatory); the engine has no mandatory Quick Effects.
  // PARTIAL: "Cannot be Special Summoned" is enforced while it is in the GY only (hand and Deck summons are not blocked).
  'Doomcaliber Knight': {
    cont: { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src },
    effs: [{ type: 'quick', ds: true, label: 'Tribute: negate a monster effect', tags: { destroy: 1 },
      cond: (g, c, p, x) => x.top && x.top.c !== c && isMon(x.top.c) && x.top.eff.type !== 'act' && !x.top.negated,
      cost: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed Doomcaliber Knight.`); },
      res: function* (g, c, p, L) { const T = L.data.L; T.negBy = p; negate(g, T, false); if (onField(T.c) && isMon(T.c) && T.c.zone === 'm') destroy(g, [T.c], { by: p, src: c }); } }] },

  /* ----- Gemini ----- */
  'Gigaplant': { effs: [{ type: 'ign', gemini: true, opt: true, tags: { ss: 1 }, label: 'Summon an Insect or Plant',
    cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].gy].some(x => isMon(x) && ['Insect', 'Plant'].includes(race(x))),
    res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].gy].filter(x => isMon(x) && ['Insect', 'Plant'].includes(race(x))); const [x] = yield* pick(g, p, 'Special Summon an Insect or Plant from your hand or GY', cs, 1, 1, 'good'); if (x) ss(g, p, x); } }] },
  'Dark Valkyria': {
    self: { atk: (g, c) => gem(c) ? 300 * ctr(c, 'spell') : 0 },
    effs: [
      { type: 'ign', gemini: true, label: 'Place a Spell Counter',
        cond: (g, c) => !c.flags.valkUsed,
        res: function* (g, c) { if (!onField(c) || !faceUp(c)) return; c.flags.valkUsed = true; addCtr(g, c, 'spell', 1); log(g, 'Dark Valkyria got a Spell Counter.'); } },
      { type: 'ign', gemini: true, tags: { destroy: 1 }, label: 'Remove a Spell Counter: destroy a monster',
        cond: (g, c) => ctr(c, 'spell') > 0 && fieldMons(g).length > 0,
        cost: function* (g, c) { addCtr(g, c, 'spell', -1); },
        target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
        res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'Blazewing Butterfly': { effs: [{ type: 'ign', gemini: true, tags: { ss: 1 }, label: 'Tribute: revive a Gemini',
    cond: (g, c, p) => g.p[p].gy.some(x => isGemini(x) && nm(x) !== 'Blazewing Butterfly'),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed Blazewing Butterfly.`); },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which Gemini from your GY?', g.p[p].gy.filter(x => isGemini(x) && nm(x) !== 'Blazewing Butterfly'), 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = L.t[0]; if (nvNeg(g, c)) return; if (t && t.zone === 'gy' && ss(g, p, t)) { t.flags.gemini = true; log(g, `${D(t).n} became an Effect Monster.`); } } }] },
  'Gemini Soldier': { effs: [
    // once per turn not destroyed by battle (applied when damage calculation dooms it; no chain)
    { type: 'trig', on: (g, ev, c) => { if (ev.type === 'afterCalc' && (ev.a === c || ev.t === c) && gem(c) && c.flags.battleDoomed && c.flags.gsSafe !== g.turnNo) { c.flags.battleDoomed = false; c.flags.gsSafe = g.turnNo; log(g, 'Gemini Soldier was not destroyed by battle.'); } return false; }, res: function* () {} },
    { type: 'trig', tags: { ss: 1 }, label: 'Summon a Gemini from the Deck',
      on: (g, ev, c) => ev.type === 'afterCalc' && (ev.a === c || ev.t === c) && gem(c),
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isGemini(x) && lv(x) <= 4 && nm(x) !== 'Gemini Soldier'),
      res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isGemini(x) && lv(x) <= 4 && nm(x) !== 'Gemini Soldier'); const [x] = yield* pick(g, p, 'Special Summon a Level 4 or lower Gemini from your Deck', cs, 1, 1, 'good'); if (x) ss(g, p, x); shuffleDeck(g, p); } }] },
  'Evocator Chevalier': { effs: [{ type: 'ign', gemini: true, tags: { destroy: 1 }, label: 'Send an Equip: destroy a card',
    cond: (g, c, p) => stOf(g, p).some(x => faceUp(x) && x.equipTo) && fieldOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which face-up Equip Card to the GY?', stOf(g, p).filter(x => faceUp(x) && x.equipTo), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which card?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  // ENGINE: the engine's Synchro check reads D(c).tu only, so a Gemini-Summoned Tuned Magician is not a Tuner for normal
  // Synchro Summons. This batch's own Synchro procs (Black Brutdrago, Gaia Knight, Gol'gar) do count it as a Tuner.
  'Tuned Magician': { effs: [] },
  // PARTIAL: only battle destruction can be replaced (no hook for "would be destroyed" by card effects).
  'Nettles': { effs: [{ type: 'trig', label: 'Destroy a Plant instead',
    on: (g, ev, c) => ev.type === 'afterCalc' && (ev.a === c || ev.t === c) && !!c.flags.battleDoomed && !(ev.flipped && ev.t === c),
    cond: (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x) && race(x) === 'Plant'),
    res: function* (g, c, p) { if (!onField(c) || !c.flags.battleDoomed) return; const cs = monsOf(g, p).filter(x => x !== c && faceUp(x) && race(x) === 'Plant'); if (!cs.length) return; const [x] = yield* pick(g, p, 'Destroy which Plant instead of Nettles?', cs, 1, 1, 'cost'); if (x && destroy(g, [x], { by: p }).length) { c.flags.battleDoomed = false; log(g, 'Nettles was not destroyed.'); } } }] },
  'Supervise': { effs: [
    { type: 'act', cond: g => fieldMons(g).some(x => faceUp(x) && isGemini(x)),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Equip Supervise to which Gemini monster?', fieldMons(g).filter(x => faceUp(x) && isGemini(x)), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !faceUp(t) || !equip(g, c, t)) return; if (!t.flags.gemini) { t.flags.gemini = true; t.flags.supervisedBy = c.u; log(g, `${name(t)} became an Effect Monster.`); } } },
    // when it leaves the field, the monster it made an Effect Monster turns back into a Normal Monster (no chain)
    { type: 'trig', loc: 'any', on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.wasField) for (const m of fieldMons(g)) if (m.flags.supervisedBy === c.u) { m.flags.gemini = false; m.flags.supervisedBy = null; if (m.ctr) m.ctr.spell = 0; } return false; }, res: function* () {} },
    { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon a Normal Monster',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy' && ev.snap && ev.snap.faceUp,
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(normalInGY),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which Normal Monster from your GY?', g.p[p].gy.filter(normalInGY), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (nvNeg(g, c)) return; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  'Reinforce Truth': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && race(x) === 'Warrior' && lv(x) <= 2),
    res: function* (g, c, p) { g.noBP[p] = true; const cs = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Warrior' && lv(x) <= 2); const [x] = yield* pick(g, p, 'Special Summon a Level 2 or lower Warrior from your Deck', cs, 1, 1, 'good'); if (x) ss(g, p, x); shuffleDeck(g, p); log(g, `${PN(g, p)} can't conduct the Battle Phase this turn.`); } }] },
  'Ultimate Offering': { effs: [{ type: 'act', res: function* (g) { touch(g); } },
    { type: 'quick', loc: 'st', label: 'Pay 500: extra Normal Summon/Set',
      cond: (g, c, p) => g.p[p].lp > 500 && !g.inDS && !g.chain.some(L => L.c === c && L.eff.type === 'act') &&
        ((g.tp === p && ['main1', 'main2'].includes(g.phase)) || (g.tp !== p && g.phase === 'battle')) &&
        g.p[p].hand.some(x => canNS(x) && nsOk(g, p, x)),
      cost: function* (g, c, p) { pay(g, p, 500); },
      res: function* (g, c, p) { yield* effectNS(g, p, g.p[p].hand.filter(x => canNS(x) && nsOk(g, p, x)), { setOk: true }); } }] },
  // PARTIAL: blocks banishing by this batch's cards and the activation of the known banishing cards (list above).
  // ENGINE: move(..., 'ban') does not check forbid({type:'banish'}), so triggers like Caius still banish.
  'Imperial Iron Wall': { effs: [{ type: 'act', res: function* (g) { touch(g); } }],
    cont: { forbid: (g, src, a) => a.type === 'banish' || (a.type === 'activate' && (BANISHERS.includes(nm(a.c)) || effIs(a, 'Black Rose Dragon', 1))) } },
  'Scrap-Iron Scarecrow': { effs: [{ type: 'act', cond: (g, c, p) => g.aw && g.aw.a.ctrl !== p,
    target: function* (g, c, p, L) { L.t = [g.aw.a]; },
    res: function* (g, c, p, L) { negateAttack(g); if (onField(c)) { L.keep = true; c.pos = 'set'; c.turnIn = g.turnNo; log(g, 'Scrap-Iron Scarecrow was Set again.'); } } }] },
  'Black Brutdrago': { noSynchro: true, proc: synProc(8, () => true, isGemini),
    effs: [
      { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Discard a Gemini: destroy a Spell/Trap',
        cond: (g, c, p) => g.p[p].hand.some(isGemini) && stOf(g, opp(p)).length > 0,
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Gemini from your hand to the GY?', g.p[p].hand.filter(isGemini), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); },
        target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which Spell/Trap?', stOf(g, opp(p)), 1, 1, 'bad'); },
        res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } },
      { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Revive a Gemini',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField && ev.to === 'gy',
        cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(isGemini),
        target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which Gemini from your GY?', g.p[p].gy.filter(isGemini), 1, 1, 'good'); },
        res: function* (g, c, p, L) { const t = L.t[0]; if (nvNeg(g, c)) return; if (t && t.zone === 'gy' && ss(g, p, t)) t.flags.gemini = true; } }] },

  /* ----- Gravekeeper ----- */
  "Gravekeeper's Assailant": { effs: [{ type: 'trig', when: true, label: 'Change a monster’s position',
    on: (g, ev, c) => ev.type === 'attack' && ev.a === c && nvUp(g),
    cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Change the battle position of which monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !faceUp(t)) return; t.pos = t.pos === 'atk' ? 'def' : 'atk'; log(g, `${name(t)} changed to ${t.pos === 'atk' ? 'Attack' : 'Defense'} Position.`); } }] },
  "Gravekeeper's Commandant": { effs: [{ type: 'ign', loc: 'hand', label: 'Discard: add Necrovalley',
    cond: (g, c, p) => g.p[p].deck.some(x => nm(x) === 'Necrovalley'),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded Gravekeeper's Commandant.`); },
    res: function* (g, c, p) { yield* search(g, p, x => nm(x) === 'Necrovalley', 'Add Necrovalley'); } }] },
  "Gravekeeper's Stele": { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && isGK(x)).length >= 2,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, "Add which 2 Gravekeeper's monsters to your hand?", g.p[p].gy.filter(x => isMon(x) && isGK(x)), 2, 2, 'good'); },
    res: function* (g, c, p, L) { const ts = L.t.filter(x => x.zone === 'gy'); for (const t of ts) move(g, t, 'hand', { reason: 'effect' }); if (ts.length) log(g, `${PN(g, p)} added ${ts.map(x => D(x).n).join(', ')} to the hand.`); } }] },
  // PARTIAL: effects that target the GY are negated for this batch's cards (checked at resolution); for other cards only the
  // activation of known GY-banishing / GY-targeting Ignition effects is blocked. ENGINE: a generic "negate if it targets the GY" hook.
  'Necrovalley': { effs: [{ type: 'act', res: function* (g) { touch(g); } }],
    cont: { atk: (g, src, c) => isGK(c) ? 500 : 0, def: (g, src, c) => isGK(c) ? 500 : 0,
      forbid: (g, src, a) => (a.type === 'banish' && a.from === 'gy') || (a.type === 'activate' && (GY_BANISH(a) || GY_TARGET(a))) } },
  'Royal Tribute': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].fz && faceUp(g.p[p].fz) && nm(g.p[p].fz) === 'Necrovalley',
    res: function* (g, c, p) { for (const q of [p, opp(p)]) { const ms = g.p[q].hand.filter(isMon); for (const x of ms) move(g, x, 'gy', { reason: 'discard' }); log(g, ms.length ? `${PN(g, q)} discarded ${ms.map(x => D(x).n).join(', ')}.` : `${PN(g, q)} had no monsters in hand.`); } } }] },
  'Rite of Spirit': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && isGK(x)),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, "Special Summon which Gravekeeper's monster?", g.p[p].gy.filter(x => isMon(x) && isGK(x)), 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  // PARTIAL: the card data lists it as a Main Deck monster; it is summoned here by its own Synchro rule from the Extra Deck
  // and can't be Normal Summoned. If returned to the hand it goes to the hand, not the Extra Deck.
  'Gaia Knight, the Force of Earth': { proc: synProc(6, () => true, () => true), effs: [],
    cont: { loc: 'hand', forbid: (g, src, a) => (a.type === 'ns' || a.type === 'set') && a.c === src } },

  /* ----- Hopeless Dragon ----- */
  // PARTIAL: "after resolving a Spell Card" is read as a Normal/Quick-Play Spell going to the GY after it resolves
  // (activated Continuous Spells don't trigger it).
  'Dark Horus': { effs: [{ type: 'trig', when: true, opt: true, tags: { ss: 1 }, label: 'Revive a Level 4 DARK',
    on: (g, ev, c) => ev.type === 'move' && ev.reason === 'rule' && ev.from === 'st' && ev.to === 'gy' && isSpell(ev.c) && ['main1', 'main2'].includes(ev.phase) && g.tp !== c.ctrl,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && lv(x) === 4 && attr(x) === 'DARK'),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which Level 4 DARK from your GY?', g.p[p].gy.filter(x => isMon(x) && lv(x) === 4 && attr(x) === 'DARK'), 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = L.t[0]; if (!onField(c) || !faceUp(c) || nvNeg(g, c)) return; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  'Electric Virus': { effs: [{ type: 'ign', loc: 'hand', label: 'Discard: take a Machine or Dragon',
    cond: (g, c, p) => freeM(g, p) >= 0 && oppFaceUp(g, p).some(x => ['Machine', 'Dragon'].includes(race(x))),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded Electric Virus.`); },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Take control of which Machine or Dragon?', oppFaceUp(g, p).filter(x => ['Machine', 'Dragon'].includes(race(x))), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (t && faceUp(t) && t.ctrl !== p && ['Machine', 'Dragon'].includes(race(t))) takeControl(g, p, t, true); } }] },
  'Eradicator Epidemic Virus': { effs: [
    { type: 'act', tags: { destroy: 1 },
      cond: (g, c, p) => monsOf(g, p).some(x => attr(x) === 'DARK' && atk(g, x) >= 2500),
      cost: function* (g, c, p, L) { const [x] = yield* pick(g, p, 'Tribute a DARK monster with 2500 or more ATK', monsOf(g, p).filter(x => attr(x) === 'DARK' && atk(g, x) >= 2500), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`);
        L.data.kind = (yield* choose(g, p, 'Declare a card type', ['Spell Cards', 'Trap Cards'])) ? 'trap' : 'spell'; log(g, `${PN(g, p)} declared ${L.data.kind === 'spell' ? 'Spell' : 'Trap'} Cards.`); },
      res: function* (g, c, p, L) { const o = opp(p), kind = L.data.kind, is = x => D(x).k === kind;
        log(g, `${PN(g, p)} looked at ${PN(g, o)}'s hand: ${g.p[o].hand.map(x => D(x).n).join(', ') || 'no cards'}.`);
        const hs = g.p[o].hand.filter(is); for (const x of hs) move(g, x, 'gy', { reason: 'effect', destroyed: true, by: p });
        const fs = destroy(g, stOf(g, o).filter(is), { by: p, quietLog: true });
        if (hs.length + fs.length) log(g, `${[...hs, ...fs].map(x => D(x).n).join(', ')} ${hs.length + fs.length > 1 ? 'were' : 'was'} destroyed.`);
        g.eev = g.eev || {}; g.eev[c.u] = { o, kind, until: thirdTurn(g, p), hits: [] }; } },
    // lingering: cards of the declared type they draw are destroyed (works while this card is in the GY)
    { type: 'trig', loc: 'any', mand: true,
      on: (g, ev, c) => { const r = g.eev && g.eev[c.u]; if (!r || ev.type !== 'move' || ev.reason !== 'draw' || ev.c.owner !== r.o || g.turnNo > r.until) return false; log(g, `${PN(g, r.o)} drew ${D(ev.c).n}.`); if (D(ev.c).k !== r.kind) return false; r.hits.push(ev.c); return true; },
      res: function* (g, c, p) { const r = g.eev && g.eev[c.u]; if (!r) return; const hs = r.hits.filter(x => x.zone === 'hand'); r.hits = []; for (const x of hs) move(g, x, 'gy', { reason: 'effect', destroyed: true, by: p }); if (hs.length) log(g, `${hs.map(x => D(x).n).join(', ')} ${hs.length > 1 ? 'were' : 'was'} destroyed by Eradicator Epidemic Virus.`); } }] },

  /* ----- Kuraz ----- */
  'Kuraz the Light Monarch': {
    self: { cantAttack: (g, c) => c.turnIn === g.turnNo && NSS.includes(c.summonType) },
    effs: [{ type: 'trig', when: true, tags: { destroy: 1 }, label: 'Destroy up to 2 cards',
      on: (g, ev, c) => evSummoned(ev, c, NSS), cond: g => allField(g).length > 0,
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy up to 2 cards', allField(g), 1, 2, 'bad'); },
      res: function* (g, c, p, L) { const ts = live(L), was = new Map(ts.map(x => [x, x.ctrl])); const ds = destroy(g, ts, { by: p });
        for (const q of [p, opp(p)]) { const n = ds.filter(x => was.get(x) === q).length; if (n && g.p[q].deck.length >= n && (yield* yn(g, q, `Draw ${n} card${n > 1 ? 's' : ''} (Kuraz)?`))) draw(g, q, n); } } }] },
  // ENGINE: the engine never collects triggers or Ignition effects from the Field Zone (emit and activatable skip P.fz), so both
  // effects below are written for loc 'fz' but do not run yet. A summon by this card's own effect is marked byGarden.
  'Black Garden': { effs: [{ type: 'act', res: function* (g) { touch(g); } },
    { type: 'trig', loc: 'fz', mand: true,
      on: (g, ev, c) => ev.type === 'summon' && !ev.byGarden && !g.gardenSS && ev.how !== 'flip' && ev.how !== 'gemini' && faceUp(c),
      res: function* (g, c, p, L) { const cs = L.ev.cs.filter(onField); for (const m of cs) if (faceUp(m)) { const A = atk(g, m); addMod(g, m, { atk: -(A - Math.floor(A / 2)) }); log(g, `${name(m)}'s ATK was halved.`); }
        if (cs.length) { const to = opp(cs[0].ctrl); const t = token(g, to, { n: 'Rose Token', a: 'DARK', r: 'Plant', lv: 2, atk: 800, def: 800 }, 'atk'); if (t) { log(g, `${PN(g, p)} Special Summoned a Rose Token to ${PN(g, to)}'s field.`); emit(g, { type: 'summon', cs: [t], how: 'special', p, byEffect: true, byGarden: true }); } } } },
    { type: 'ign', loc: 'fz', tags: { ss: 1, destroy: 1 }, label: 'Destroy Plants: revive a monster',
      cond: (g, c, p) => { const s = fieldMons(g).filter(x => faceUp(x) && race(x) === 'Plant').reduce((a, x) => a + atk(g, x), 0); return g.p[p].gy.some(x => isMon(x) && baseAtk(x) === s); },
      target: function* (g, c, p, L) { const s = fieldMons(g).filter(x => faceUp(x) && race(x) === 'Plant').reduce((a, x) => a + atk(g, x), 0); yield* tgt(g, p, L, 'Special Summon which monster from your GY?', g.p[p].gy.filter(x => isMon(x) && baseAtk(x) === s), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = L.t[0]; const pl = fieldMons(g).filter(x => race(x) === 'Plant'); const ds = destroy(g, [c, ...pl], { by: p }); if (ds.length === pl.length + 1 && t && t.zone === 'gy' && !nvNeg(g, c)) { g.gardenSS = true; try { ss(g, p, t); } finally { g.gardenSS = false; } } } }] },
  // ENGINE: Field Zone Ignition effects are not offered by activatable() (see Black Garden), so this effect doesn't run yet.
  'Mausoleum of the Emperor': { effs: [{ type: 'act', res: function* (g) { touch(g); } },
    { type: 'ign', loc: 'fz', anyPlayer: true, label: 'Pay LP: summon without Tributes',
      cond: (g, c, p) => g.tp === p && g.ns[p] < 1 && g.p[p].hand.some(x => canNS(x) && tribFor(x) > 0 && g.p[p].lp > 1000 * tribFor(x) && freeM(g, p) >= 0 && !forbid(g, { type: 'ns', c: x, p })),
      cost: function* (g, c, p, L) { const opts = [1, 2].filter(n => g.p[p].hand.some(x => canNS(x) && tribFor(x) === n) && g.p[p].lp > 1000 * n); const n = opts.length > 1 ? opts[yield* choose(g, p, 'Pay how much LP?', opts.map(n => `${n * 1000} LP (${n} Tribute${n > 1 ? 's' : ''})`))] : opts[0]; pay(g, p, 1000 * n); L.data.n = n; },
      res: function* (g, c, p, L) { if (g.ns[p] >= 1) return; const cs = g.p[p].hand.filter(x => canNS(x) && tribFor(x) === L.data.n); const m = yield* effectNS(g, p, cs, { noTrib: true, setOk: true, text: 'Normal Summon or Set which monster without Tributing?' }); if (m) g.ns[p]++; } }] },

  /* ----- Machina Gadget ----- */
  'Green Gadget': { effs: [{ type: 'trig', when: true, label: 'Add Red Gadget', on: (g, ev, c) => evSummoned(ev, c, NSS), cond: (g, c, p) => g.p[p].deck.some(x => nm(x) === 'Red Gadget'),
    res: function* (g, c, p) { yield* search(g, p, x => nm(x) === 'Red Gadget', 'Add Red Gadget'); } }] },
  'Red Gadget': { effs: [{ type: 'trig', when: true, label: 'Add Yellow Gadget', on: (g, ev, c) => evSummoned(ev, c, NSS), cond: (g, c, p) => g.p[p].deck.some(x => nm(x) === 'Yellow Gadget'),
    res: function* (g, c, p) { yield* search(g, p, x => nm(x) === 'Yellow Gadget', 'Add Yellow Gadget'); } }] },
  'Yellow Gadget': { effs: [{ type: 'trig', when: true, label: 'Add Green Gadget', on: (g, ev, c) => evSummoned(ev, c, NSS), cond: (g, c, p) => g.p[p].deck.some(x => nm(x) === 'Green Gadget'),
    res: function* (g, c, p) { yield* search(g, p, x => nm(x) === 'Green Gadget', 'Add Green Gadget'); } }] },
  'Solidarity': { effs: [{ type: 'act', res: function* (g) { touch(g); } }],
    cont: { atk: (g, src, c) => { if (c.ctrl !== src.ctrl) return 0; const ts = new Set(g.p[src.ctrl].gy.filter(isMon).map(x => D(x).r)); return ts.size === 1 && ts.has(race(c)) ? 800 : 0; } } },
  // PARTIAL: wrong-Type monsters are sent to the GY by a mandatory trigger (a chain link) after summons, not as a pure rule,
  // and Flip Summons of the wrong Type aren't blocked.
  'Rivalry of Warlords': {
    effs: [{ type: 'act', res: function* (g, c, p) { touch(g); yield* warlords(g); } },
      { type: 'trig', loc: 'st', mand: true,
        on: (g, ev, c) => faceUp(c) && (ev.type === 'summon' || ev.type === 'flip' || (ev.type === 'move' && ev.to === 'm')) && warMixed(g),
        res: function* (g) { yield* warlords(g); } }],
    cont: { forbid: (g, src, a) => { if (!['ns', 'ss'].includes(a.type) || !a.c || !isMon(a.c)) return false; const ts = new Set(monsOf(g, a.p).filter(faceUp).map(race)); if (ts.size !== 1) return false; if (a.type === 'ns' && tribFor(a.c) > 0) return false; return !ts.has(race(a.c)); } } },

  /* ----- Machina Roid ----- */
  'Expressroid': { effs: [{ type: 'trig', when: true, label: 'Add 2 "roid" monsters',
    on: (g, ev, c) => evSummoned(ev, c), cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && isRoid(x) && nm(x) !== 'Expressroid').length >= 2,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Add which 2 "roid" monsters to your hand?', g.p[p].gy.filter(x => isMon(x) && isRoid(x) && nm(x) !== 'Expressroid'), 2, 2, 'good'); },
    res: function* (g, c, p, L) { if (nvNeg(g, c)) return; const ts = L.t.filter(x => x.zone === 'gy'); for (const t of ts) move(g, t, 'hand', { reason: 'effect' }); if (ts.length) log(g, `${PN(g, p)} added ${ts.map(x => D(x).n).join(', ')} to the hand.`); } }] },
  // PARTIAL: it destroys at the start of the Damage Step, before a face-down monster is flipped, so Flip effects don't activate.
  'Drillroid': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 },
    on: (g, ev, c) => ev.type === 'dsStart' && ev.a === c && ev.t && ev.t.pos !== 'atk',
    res: function* (g, c, p, L) { const t = L.ev.t; if (t && onField(t) && t.pos !== 'atk') destroy(g, [t], { by: p, src: c }); } }] },
  'Armoroid': { effs: [{ type: 'trig', mand: true,
    on: (g, ev, c) => evSummoned(ev, c, ['tribute']) && (ev.tribs || []).some(isRoid),
    res: function* (g, c, p) { if (noBanish(g)) return; const sts = stOnField(g); for (const x of sts) move(g, x, 'ban', { reason: 'effect', by: p }); if (sts.length) log(g, `${sts.map(x => D(x).n).join(', ')} ${sts.length > 1 ? 'were' : 'was'} banished.`); } }] },
  'Nobleman of Extermination': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c) => !noBanish(g) && stOnField(g).some(x => x !== c && x.pos === 'set'),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which face-down Spell/Trap?', stOnField(g).filter(x => x !== c && x.pos === 'set'), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || t.pos !== 'set') return; const trap = isTrap(t), n = D(t).n, ban = !noBanish(g);
      if (!destroy(g, [t], { by: p, banish: ban }).length || !trap || !ban) return;
      for (const P of g.p) { const xs = P.deck.filter(x => D(x).n === n); for (const x of xs) move(g, x, 'ban', { reason: 'effect' }); }
      log(g, `Each player banished every ${n} from the Deck.`); } }] },

  /* ----- Quickdraw Volcanic ----- */
  'Volcanic Rocket': { effs: [{ type: 'trig', when: true, label: 'Add a Blaze Accelerator card',
    on: (g, ev, c) => evSummoned(ev, c), cond: (g, c, p) => [...g.p[p].deck, ...g.p[p].gy].some(x => /Blaze Accelerator/.test(nm(x))),
    res: function* (g, c, p) { const fromDeckOk = !forbid(g, { type: 'search', p }); const cs = [...(fromDeckOk ? g.p[p].deck : []), ...g.p[p].gy].filter(x => /Blaze Accelerator/.test(nm(x))); const [x] = yield* pick(g, p, 'Add a "Blaze Accelerator" card from your Deck or GY', cs, 1, 1, 'good');
      if (x) { const fromDeck = x.zone === 'deck'; move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${D(x).n} to the hand.`); if (fromDeck) shuffleDeck(g, p); } } }] },
  'Volcanic Shell': { effs: [{ type: 'ign', loc: 'gy', opt: true, label: 'Pay 500: add Volcanic Shell',
    cond: (g, c, p) => g.p[p].lp > 500 && g.p[p].deck.some(x => nm(x) === 'Volcanic Shell'),
    cost: function* (g, c, p) { pay(g, p, 500); },
    res: function* (g, c, p) { if (c.zone !== 'gy') return; yield* search(g, p, x => nm(x) === 'Volcanic Shell', 'Add Volcanic Shell'); } }] },
  'Blaze Accelerator': { effs: [{ type: 'act', res: function* (g) { touch(g); } },
    { type: 'ign', loc: 'st', tags: { destroy: 1 }, label: 'Send a Pyro: destroy a monster',
      cond: (g, c, p) => monsOf(g, opp(p)).length > 0 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Pyro' && baseAtk(x) <= 500) && !g.chain.some(L => L.c === c),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); addRule(g, (g2, a) => a.type === 'attack' && a.c.ctrl === p, { end: g.turnNo }); },
      res: function* (g, c, p, L) { const cs = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Pyro' && baseAtk(x) <= 500); if (!cs.length) return; const [x] = yield* pick(g, p, 'Send which Pyro with 500 or less ATK to the GY?', cs, 1, 1, 'cost'); move(g, x, 'gy', { reason: 'effect' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); destroy(g, live(L), { by: p, src: c }); } }] },
  'Destiny HERO - Plasma': {
    proc: { label: 'Special Summon (Tribute 3 monsters)', cond: (g, c, p) => tributeCands(g, p).length >= 3,
      cost: function* (g, c, p, grp) { const ts = yield* pick(g, p, 'Tribute 3 monsters', tributeCands(g, p), 3, 3, 'cost'); for (const t of ts) move(g, t, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${ts.map(x => D(x).n).join(', ')}.`); } },
    self: { atk: (g, c) => { const e = stOf(g, c.ctrl).find(x => x.equipTo === c.u && isMon(x)); return e ? Math.floor(baseAtk(e) / 2) : 0; } },
    cont: { negates: (g, src, c) => c.zone === 'm' && c.ctrl !== src.ctrl && faceUp(c) },
    effs: [{ type: 'ign', opt: true, label: 'Equip an opponent’s monster',
      cond: (g, c, p) => monsOf(g, opp(p)).length > 0 && freeST(g, p) >= 0 && !stOf(g, p).some(x => x.equipTo === c.u && isMon(x)),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Equip which monster to Plasma?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !onField(c) || !faceUp(c) || freeST(g, p) < 0 || stOf(g, p).some(x => x.equipTo === c.u && isMon(x))) return;
        move(g, t, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p }); t.equipTo = c.u; log(g, `${D(t).n} was equipped to Destiny HERO - Plasma.`); } }] },
  'Legendary Jujitsu Master': { effs: [
    { type: 'trig', loc: 'any', on: (g, ev, c) => { if (ev.type === 'afterCalc' && ev.t === c && ev.tWasDef) { g.jujitsu = g.jujitsu || {}; g.jujitsu[c.u] = { turn: g.turnNo, a: ev.a }; } return false; }, res: function* () {} },
    { type: 'trig', loc: 'any', mand: true,
      on: (g, ev, c) => ev.type === 'dsEnd' && ev.t === c && g.jujitsu && g.jujitsu[c.u] && g.jujitsu[c.u].a === ev.a && g.jujitsu[c.u].turn === g.turnNo,
      res: function* (g, c, p, L) { g.jujitsu[c.u] = null; const a = L.ev.a; if (a && onField(a) && a.zone === 'm') { move(g, a, 'deckTop', { reason: 'effect', by: p }); log(g, `${D(a).n} was put on top of the Deck.`); } } }] },

  /* ----- TeleDAD ----- */
  'Elemental HERO Bubbleman': {
    proc: { label: 'Special Summon (only card in hand)', cond: (g, c, p) => g.p[p].hand.length === 1 && g.p[p].hand[0] === c },
    effs: [{ type: 'trig', when: true, label: 'Draw 2',
      on: (g, ev, c) => evSummoned(ev, c), cond: (g, c, p) => fieldOf(g, p).every(x => x === c) && !g.p[p].hand.length && g.p[p].deck.length >= 2,
      res: function* (g, c, p) { if (fieldOf(g, p).some(x => x !== c) || g.p[p].hand.length) return; draw(g, p, 2); } }] },
  'Krebons': { effs: [{ type: 'trig', label: 'Pay 800: negate the attack',
    on: (g, ev, c) => ev.type === 'attack' && ev.t === c, cond: (g, c, p) => g.p[p].lp > 800,
    cost: function* (g, c, p) { pay(g, p, 800); },
    res: function* (g) { negateAttack(g); } }] },
  'Emergency Teleport': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].deck].some(x => isMon(x) && race(x) === 'Psychic' && lv(x) <= 3),
      res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => isMon(x) && race(x) === 'Psychic' && lv(x) <= 3); const [x] = yield* pick(g, p, 'Special Summon a Level 3 or lower Psychic from your hand or Deck', cs, 1, 1, 'good');
        if (x) { const fromDeck = x.zone === 'deck'; if (ss(g, p, x)) x.flags.etBy = c.u; if (fromDeck) shuffleDeck(g, p); } } },
    { type: 'trig', loc: 'any', mand: true, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(x => x.flags.etBy === c.u),
      res: function* (g, c) { const xs = fieldMons(g).filter(x => x.flags.etBy === c.u); if (noBanish(g)) return; for (const x of xs) move(g, x, 'ban', { reason: 'effect' }); if (xs.length) log(g, `${xs.map(x => D(x).n).join(', ')} ${xs.length > 1 ? 'were' : 'was'} banished (Emergency Teleport).`); } }] },
  'Telekinetic Power Well': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && race(x) === 'Psychic' && lv(x) <= 2),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which Level 2 or lower Psychics?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Psychic' && lv(x) <= 2), 1, nFreeM(g, p), 'good'); },
    res: function* (g, c, p, L) { if (nvNeg(g, c)) return; let s = 0; for (const t of L.t) if (t.zone === 'gy' && ss(g, p, t)) s += lv(t); if (s) damage(g, p, s * 300, { src: c, srcP: p }); } }] },
  // PARTIAL: the name is picked from the cards in this duel; using a declared card as Synchro or Fusion Material isn't blocked.
  'Prohibition': { effs: [{ type: 'act',
    target: function* (g, c, p, L) { const seen = new Set(), names = []; for (const q of [opp(p), p]) for (const z of ['hand', 'deck', 'extra', 'gy', 'ban']) for (const x of g.p[q][z]) { const n = D(x).n; if (!seen.has(n)) { seen.add(n); names.push(n); } } for (const x of allField(g)) if (!seen.has(D(x).n)) { seen.add(D(x).n); names.push(D(x).n); }
      if (!names.length) return; L.data.n = names[yield* choose(g, p, 'Declare a card name', names)]; log(g, `${PN(g, p)} declared ${L.data.n}.`); },
    res: function* (g, c, p, L) { if (onField(c) && L.data.n) { c.flags.prohibit = L.data.n; touch(g); } } }],
    cont: { forbid: (g, src, a) => { const n = src.flags.prohibit; if (!n || !a.c || D(a.c).n !== n) return false; if (a.type === 'activate' && a.c.zone === 'st') return false; return ['activate', 'ns', 'set', 'ss', 'setST', 'attack', 'pos'].includes(a.type); },
      negates: (g, src, c) => !!src.flags.prohibit && D(c).n === src.flags.prohibit && c.zone === 'm' } },

  /* ----- Alien ----- */
  'Alien Ammonite': { effs: [
    { type: 'trig', when: true, tags: { ss: 1 }, label: 'Revive a Level 4 or lower Alien',
      on: (g, ev, c) => evSummoned(ev, c, ['normal']), cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && isAlien(x) && lv(x) <= 4),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which Alien from your GY?', g.p[p].gy.filter(x => isMon(x) && isAlien(x) && lv(x) <= 4), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (nvNeg(g, c)) return; if (t && t.zone === 'gy' && ss(g, p, t)) t.flags.ammoBy = c.u; } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(x => x.flags.ammoBy === c.u),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.flags.ammoBy === c.u), { by: p }); } }] },
  'Alien Telepath': {
    cont: { atk: (g, src, c) => aBattle(g, c), def: (g, src, c) => aBattle(g, c) },
    effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Remove an A-Counter: destroy a Spell/Trap',
      cond: (g, c, p) => monsOf(g, opp(p)).some(x => ctr(x, 'A') > 0) && stOnField(g).length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Remove an A-Counter from which monster?', monsOf(g, opp(p)).filter(x => ctr(x, 'A') > 0), 1, 1, 'bad'); addCtr(g, x, 'A', -1); log(g, `${PN(g, p)} removed an A-Counter from ${name(x)}.`); },
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which Spell/Trap?', stOnField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'Alien Warrior': {
    cont: { atk: (g, src, c) => aBattle(g, c), def: (g, src, c) => aBattle(g, c) },
    effs: [{ type: 'trig', loc: 'gy', mand: true,
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy' && !!ev.killer,
      res: function* (g, c, p, L) { const k = L.ev.killer; if (k && onField(k) && k.zone === 'm') { addCtr(g, k, 'A', 2); log(g, `${name(k)} got 2 A-Counters.`); } } }] },
  'Code A Ancient Ruins': { effs: [{ type: 'act', res: function* (g) { touch(g); } },
    { type: 'trig', loc: 'st', mand: true,
      on: (g, ev, c) => faceUp(c) && ev.type === 'move' && ev.destroyed && ev.wasField && ev.snap && ev.snap.faceUp && ev.snap.mon && /Alien/.test(ev.snap.name),
      res: function* (g, c) { if (!onField(c)) return; addCtr(g, c, 'A', 1); log(g, 'Code A Ancient Ruins got an A-Counter.'); } },
    { type: 'ign', loc: 'st', opt: true, tags: { ss: 1 }, label: 'Remove 2 A-Counters: revive an Alien',
      cond: (g, c, p) => aCount(g) >= 2 && freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && isAlien(x)),
      cost: function* (g, c, p) { yield* removeA(g, p, 2); },
      res: function* (g, c, p) { const cs = g.p[p].gy.filter(x => isMon(x) && isAlien(x)); const [x] = yield* pick(g, p, 'Special Summon which Alien from your GY?', cs, 1, 1, 'good'); if (x) ss(g, p, x); } }] },
  'Fiendish Chain': { effs: [
    { type: 'act', cond: g => fieldMons(g).some(x => faceUp(x) && isEffectMon(x)),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Chain which Effect Monster?', fieldMons(g).filter(x => faceUp(x) && isEffectMon(x)), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !faceUp(t) || !onField(c)) return; c.flags.chainT = t.u; t.flags.negated = true; touch(g); t.flags.chainedBy = c.u; log(g, `${name(t)}'s effects are negated and it can't attack.`); } },
    // when this card leaves the field, the negation ends (no chain)
    { type: 'trig', loc: 'any', on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.wasField) for (const m of fieldMons(g)) if (m.flags.chainedBy === c.u) { m.flags.negated = false; m.flags.chainedBy = null; } return false; }, res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 },
      on: (g, ev, c) => ev.type === 'move' && ev.destroyed && ev.wasField && c.flags.chainT === ev.c.u,
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }],
    cont: { grant: (g, src, c, flag) => flag === 'cantAttack' && src.flags.chainT === c.u && c.flags.chainedBy === src.u } },
  'Offering to the Snake Deity': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Reptile') && fieldOf(g, opp(p)).length >= 2,
    target: function* (g, c, p, L) { const [r] = yield* pick(g, p, 'Target which face-up Reptile you control?', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Reptile'), 1, 1, 'cost'); const ts = yield* pick(g, p, 'Target which 2 cards your opponent controls?', fieldOf(g, opp(p)), 2, 2, 'bad'); L.t = [r, ...ts]; },
    res: function* (g, c, p, L) { if (live(L).length < 3) { log(g, 'A target left the field, so nothing happened.'); return; } destroy(g, L.t, { by: p, src: c }); } }] },
  'Planet Pollutant Virus': { effs: [
    { type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => monsOf(g, p).some(x => /Alien/.test(D(x).n)),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute an Alien monster', monsOf(g, p).filter(x => /Alien/.test(D(x).n)), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
      res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)).filter(x => faceUp(x) && !ctr(x, 'A')), { by: p, src: c }); g.ppv = g.ppv || {}; g.ppv[c.u] = { o: opp(p), until: thirdTurn(g, p) }; log(g, `${PN(g, opp(p))}'s monsters get an A-Counter when Summoned.`); } },
    // lingering: an A-Counter on each monster they Summon (no chain)
    { type: 'trig', loc: 'any', on: (g, ev, c) => { const r = g.ppv && g.ppv[c.u]; if (r && ev.type === 'summon' && ev.p === r.o && g.turnNo <= r.until) for (const m of ev.cs) if (onField(m)) addCtr(g, m, 'A', 1); return false; }, res: function* () {} }] },
  "Cosmic Fortress Gol'gar": { noSynchro: true, proc: synProc(5, x => nm(x) === 'Alien Ammonite', x => isAlien(x)),
    effs: [
      { type: 'ign', opt: true, label: 'Return Spells/Traps: place A-Counters',
        cond: g => stOnField(g).some(faceUp),
        target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Return which face-up Spells/Traps to the hand?', stOnField(g).filter(faceUp), 1, 5, 'bad'); },
        res: function* (g, c, p, L) { const ts = live(L).filter(faceUp); for (const t of ts) move(g, t, 'hand', { reason: 'effect', by: p }); if (!ts.length) return; log(g, `${ts.map(x => D(x).n).join(', ')} returned to the hand.`);
          for (let i = 0; i < ts.length; i++) { const ms = fieldMons(g).filter(faceUp); if (!ms.length) break; const [m] = yield* pick(g, p, `Place an A-Counter on which monster? (${i + 1} of ${ts.length})`, ms, 1, 1, 'bad'); addCtr(g, m, 'A', 1); log(g, `${name(m)} got an A-Counter.`); } } },
      { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Remove 2 A-Counters: destroy a card',
        cond: (g, c, p) => aCount(g) >= 2 && fieldOf(g, opp(p)).length > 0,
        cost: function* (g, c, p) { yield* removeA(g, p, 2); },
        target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which card?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
        res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  // PARTIAL: Flip Summons by the opponent are not blocked (the engine's Flip Summon option checks no forbid rule).
  'Swords of Concealing Light': { effs: [
    { type: 'act', res: function* (g, c, p) { touch(g); if (!onField(c)) return; c.flags.scl = 0; for (const m of monsOf(g, opp(p))) { if (D(m).k === 'token') { m.pos = 'def'; continue; } if (faceUp(m)) setFaceDown(g, m); } log(g, `${PN(g, opp(p))}'s monsters were changed to face-down Defense Position.`); } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 },
      on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.flags.scl != null && faceUp(c)) { c.flags.scl++; return c.flags.scl >= 2; } return false; },
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p, rule: true }); } }],
    cont: { forbid: (g, src, a) => a.type === 'pos' && a.c && a.c.ctrl !== src.ctrl } },
});

/* Rivalry of Warlords: does any player control face-up monsters of more than one Type? */
function warMixed(g) { return [0, 1].some(p => new Set(monsOf(g, p).filter(faceUp).map(race)).size > 1); }
function* warlords(g) {
  for (const p of [g.tp, 1 - g.tp]) {
    const ms = monsOf(g, p).filter(faceUp), ts = [...new Set(ms.map(race))]; if (ts.length < 2) continue;
    const keep = ts[yield* choose(g, p, 'Rivalry of Warlords: keep which Type?', ts)];
    const out = ms.filter(x => race(x) !== keep); for (const x of out) move(g, x, 'gy', { reason: 'rule' });
    log(g, `${PN(g, p)} sent ${out.map(x => D(x).n).join(', ')} to the GY (Rivalry of Warlords).`);
  }
}
/* Alien Telepath / Alien Warrior: -300 ATK/DEF per A-Counter on a monster battling an "Alien" monster. */
function aBattle(g, c) {
  const n = ctr(c, 'A'); if (!n || !g.inDS || !g.battle) return 0;
  const { a, t } = g.battle; const o = a === c ? t : t === c ? a : null;
  return o && isAlien(o) ? -300 * n : 0;
}
})();
