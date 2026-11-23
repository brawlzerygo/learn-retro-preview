/* Batch 2: Lightsworn, Machina, Amaryllis, Cat, Dragon Aggro, Fairy. Card scripts for js/engine.js (see build/CARD_SCRIPTS.md). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, setFaceDown, negate, addMod,
  equip, equippedTo, link, addCtr, ctr, negateAttack, endBattle, addRule, token, tokens, fusionSummon, canFusion, ritualSummon, canRitual,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned,
  fromFieldToGY, battleKill, isGemini, negd, forbid } = L;
const atk = L.atk, def = L.def;

/* ----- local helpers ----- */
const isLS = c => /Lightsworn/.test(D(c).n);
const isPlant = c => isMon(c) && race(c) === 'Plant';
const isFairy = c => isMon(c) && race(c) === 'Fairy';
const isMachine = c => isMon(c) && race(c) === 'Machine';
const isXSaber = c => /X-Saber/.test(name(c));
const isEquipSpell = c => D(c).k === 'spell' && D(c).sub === 'Equip';
const noSS = c => /Cannot be Special Summoned/i.test(D(c).ps || D(c).tx || '');
const endPhaseOf = (ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl;
const contOn = (g, src) => !negd(g, src); // a monster's continuous effect applies only while it isn't negated (Skill Drain)
const trapStunned = g => g.trapStun === g.turnNo;
/* Lightsworn mills: remember whose Lightsworn effect is sending cards, so Garoth can see it */
function lsMill(g, p, n, c) { const prev = g.lsMill; g.lsMill = { p, n: D(c).n }; try { return mill(g, p, n); } finally { g.lsMill = prev; } }
function millCost(g, p, n) { const out = []; for (let i = 0; i < n && g.p[p].deck.length; i++) { const x = g.p[p].deck[g.p[p].deck.length - 1]; move(g, x, 'gy', { reason: 'cost' }); out.push(x); } if (out.length) log(g, `${PN(g, p)} sent ${out.map(name).join(', ')} from the Deck to the GY.`); return out; }
function* discard1(g, p, cands, text) { const [x] = yield* pick(g, p, text || 'Discard a card', cands, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } return x; }
function randomDiscard(g, p) { const h = g.p[p].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)} at random.`); }
/* The Lightsworn End Phase mill: mandatory, only while face-up on the field. */
const lsEnd = n => ({ type: 'trig', mand: true, on: (g, ev, c) => endPhaseOf(ev, c),
  res: function* (g, c, p) { if (onField(c) && faceUp(c)) lsMill(g, p, n, c); } });
/* Synchro Summons with material restrictions the engine's reader doesn't know. */
function synMats(g, p, sx, o) {
  const mons = monsOf(g, p).filter(c => faceUp(c) && !(D(c).n === 'Blackwing - Vayu the Emblem of Honor' && !c.flags.negated));
  const Lv = lv(sx), out = [], n = mons.length;
  for (let mask = 1; mask < (1 << n) && out.length < 12; mask++) {
    const mats = mons.filter((_, i) => mask & (1 << i)); if (mats.length < 2) continue;
    if (mats.reduce((s, c) => s + lv(c), 0) !== Lv) continue;
    const okSet = mats.some(t => D(t).tu && o.tuner(t) && mats.filter(x => x !== t).every(x => o.non(x) && (o.tunerAsNon || !D(x).tu)));
    if (okSet) out.push(mats);
  }
  return out;
}
const synProc = o => ({ extra: true, how: 'synchro', label: 'Synchro Summon',
  cond: (g, c, p) => synMats(g, p, c, o).length > 0,
  cost: function* (g, c, p, grp) { const cs = synMats(g, p, c, o); let mats = cs[0];
    if (cs.length > 1) { const i = yield* choose(g, p, `Synchro Summon ${name(c)} with which monsters?`, cs.map(m => m.map(name).join(' + '))); mats = cs[i]; }
    for (const m of mats) move(g, m, 'gy', { reason: 'synchro', by: p, group: grp });
    log(g, `${PN(g, p)} sent ${mats.map(m => D(m).n).join(' + ')} to the GY for a Synchro Summon.`); } });
/* Ignition-style Special Summon from the Deck */
function* ssFromDeck(g, p, filter, text, pos = 'atk', o = {}) {
  const cands = g.p[p].deck.filter(x => isMon(x) && filter(x) && !noSS(x)); if (!cands.length) { shuffleDeck(g, p); return null; }
  const [x] = yield* pick(g, p, text, cands, 1, 1, 'good'); if (x && !ssx(g, p, x, pos, o)) { shuffleDeck(g, p); return null; } shuffleDeck(g, p); return x;
}
/* A Special Summon in the Damage Step opens no "when summoned" window (Bottomless, Torrential): clear g.sw so it can't go stale. */
function ssx(g, ...a) { const r = ss(g, ...a); if (g.inDS) g.sw = null; return r; }
const takenFromBattle = (ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy';

E.addScripts({
  /* ----- Lightsworn ----- */
  'Aurkus, Lightsworn Druid': {
    // ENGINE: "neither player can target Lightsworn monsters" needs a targeting check inside tgt(); the self flag below is not read by the engine yet.
    self: { cantBeTargeted: true },
    effs: [lsEnd(2)] },
  'Celestia, Lightsworn Angel': { effs: [{ type: 'trig', when: true, tags: { destroy: 1 }, label: 'Send 4, destroy up to 2 cards',
    on: (g, ev, c) => evSummoned(ev, c, ['tribute']) && (ev.tribs || []).some(isLS),
    cond: (g, c, p) => g.p[p].deck.length >= 4 && fieldOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { millCost(g, p, 4); },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy up to 2 cards your opponent controls', fieldOf(g, opp(p)), 1, 2, 'bad'); },
    res: function* (g, c, p, L) { destroy(g, live(L), { by: p, src: c }); } }] },
  'Ehren, Lightsworn Monk': { effs: [
    // PARTIAL: a Set monster shuffled this way doesn't get its Flip effect afterwards.
    { type: 'trig', mand: true, on: (g, ev, c) => ev.type === 'dsStart' && ev.a === c && ev.t && ev.t.pos !== 'atk',
      res: function* (g, c, p, L) { const t = L.ev.t; if (t && onField(t) && t.pos !== 'atk') { const n = D(t).n; move(g, t, 'deck', { reason: 'effect', by: p }); log(g, `${n} was shuffled into the Deck.`); } } },
    lsEnd(3)] },
  'Garoth, Lightsworn Warrior': { effs: [{ type: 'trig', mand: true,
    // PARTIAL: only sees mills from this batch's Lightsworn scripts (Ryko in engine.js doesn't mark its mill).
    on: (g, ev, c) => ev.type === 'move' && ev.from === 'deck' && ev.to === 'gy' && ev.reason === 'effect' && g.lsMill && g.lsMill.p === c.ctrl && g.lsMill.n !== 'Garoth, Lightsworn Warrior',
    cond: (g, c, p) => g.p[p].deck.length > 0,
    res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; const out = lsMill(g, p, 2, c); const n = out.filter(x => isMon(x) && isLS(x)).length; if (n) draw(g, p, n); } }] },
  'Jain, Lightsworn Paladin': { self: { atk: (g, c) => g.inDS && g.battle && g.battle.a === c && g.battle.t && g.battle.t.ctrl !== c.ctrl ? 300 : 0 }, effs: [lsEnd(2)] },
  'Judgment Dragon': { proc: { label: 'Special Summon (4+ Lightsworn names in your GY)', cond: (g, c, p) => new Set(g.p[p].gy.filter(x => isMon(x) && isLS(x)).map(x => D(x).n)).size >= 4 },
    effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Pay 1000: destroy all other cards',
      cond: (g, c, p) => g.p[p].lp > 1000 && allField(g).some(x => x !== c),
      cost: function* (g, c, p) { pay(g, p, 1000); },
      res: function* (g, c, p) { destroy(g, allField(g).filter(x => x !== c), { by: p }); } },
    lsEnd(4)] },
  'Lumina, Lightsworn Summoner': { effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Discard: revive a Lightsworn',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.length > 0 && g.p[p].gy.some(x => isMon(x) && isLS(x) && lv(x) <= 4),
      cost: function* (g, c, p) { yield* discard1(g, p, g.p[p].hand); },
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon a Level 4 or lower Lightsworn from your GY', g.p[p].gy.filter(x => isMon(x) && isLS(x) && lv(x) <= 4), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') ssx(g, p, t); } },
    lsEnd(3)] },
  'Lyla, Lightsworn Sorceress': { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Go to Defense: destroy a Spell/Trap',
      cond: (g, c, p) => c.pos === 'atk' && stOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which Spell/Trap?', stOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L) {
        if (!onField(c) || !faceUp(c) || c.pos !== 'atk') return;
        c.pos = 'def'; c.flags.lyla = true; log(g, `${name(c)} changed to Defense Position.`);
        addRule(g, (g2, a) => a.type === 'pos' && a.c === c && !!c.flags.lyla, { end: g.turnNo + 2 });
        destroy(g, live(L), { by: p }); } },
    lsEnd(3)] },
  'Necro Gardna': { effs: [
    { type: 'quick', loc: 'gy', label: 'Banish: negate the next attack',
      cond: (g, c, p) => g.tp !== p && !['main2', 'end'].includes(g.phase) && !g.inDS,
      cost: function* (g, c, p) { move(g, c, 'ban', { reason: 'cost' }); },
      res: function* (g, c, p) { if (g.aw && g.aw.a.ctrl !== p) { negateAttack(g); return; } c.flags.necro = g.turnNo; log(g, 'The next attack this turn will be negated.'); } },
    { type: 'trig', loc: 'ban', mand: true, on: (g, ev, c) => ev.type === 'attack' && ev.p !== c.owner && c.flags.necro === g.turnNo,
      res: function* (g, c) { c.flags.necro = 0; negateAttack(g); } }] },
  'Wulf, Lightsworn Beast': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'deck' && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) { if (c.zone === 'gy') ssx(g, p, c); } }] },
  'Charge of the Light Brigade': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].deck.length >= 4 && !forbid(g, { type: 'search', p }) && g.p[p].deck.some(x => isMon(x) && isLS(x) && lv(x) <= 4),
    cost: function* (g, c, p) { millCost(g, p, 3); },
    res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && isLS(x) && lv(x) <= 4, 'Add a Level 4 or lower Lightsworn'); } }] },
  'Monster Reincarnation': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && g.p[p].gy.some(isMon),
    cost: function* (g, c, p) { yield* discard1(g, p, g.p[p].hand.filter(x => x !== c)); },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Add which monster from your GY to your hand?', g.p[p].gy.filter(isMon), 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },
  'Solar Recharge': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].deck.length >= 4 && g.p[p].hand.some(x => x !== c && isMon(x) && isLS(x)),
    cost: function* (g, c, p) { yield* discard1(g, p, g.p[p].hand.filter(x => x !== c && isMon(x) && isLS(x)), 'Discard a Lightsworn monster'); },
    res: function* (g, c, p) { draw(g, p, 2); mill(g, p, 2); } }] },

  /* ----- Machina ----- */
  'Machina Gearframe': { effs: [
    { type: 'trig', when: true, on: (g, ev, c) => evSummoned(ev, c, ['normal']),
      cond: (g, c, p) => !forbid(g, { type: 'search', p }) && g.p[p].deck.some(x => isMon(x) && /Machina/.test(D(x).n) && D(x).n !== 'Machina Gearframe'),
      res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && /Machina/.test(D(x).n) && D(x).n !== 'Machina Gearframe', 'Add a Machina monster'); } },
    // ENGINE: ③ "destroy this card instead" needs a destruction-replacement hook.
    { type: 'ign', label: 'Equip to a Machine',
      cond: (g, c, p) => c.used[1] !== g.turnNo && c.used[2] !== g.turnNo && freeST(g, p) >= 0 && monsOf(g, p).some(x => x !== c && faceUp(x) && race(x) === 'Machine' && !unionOn(g, x)),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Equip Machina Gearframe to which Machine?', monsOf(g, p).filter(x => x !== c && faceUp(x) && race(x) === 'Machine' && !unionOn(g, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !faceUp(t) || t.ctrl !== p || !onField(c) || c.zone !== 'm' || freeST(g, p) < 0) return; move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); equip(g, c, t); } },
    { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Unequip and Special Summon',
      cond: (g, c, p) => c.used[1] !== g.turnNo && c.used[2] !== g.turnNo && !!c.equipTo && freeM(g, p) >= 0,
      res: function* (g, c, p) { if (c.zone !== 'st') return; c.equipTo = null; ssx(g, p, c, 'atk'); } }] },
  'Machina Fortress': { effs: [
    { type: 'ign', loc: 'hand', tags: { ss: 1 }, label: 'Discard Machines: Special Summon', cond: (g, c, p) => fortressOk(g, c, p),
      cost: function* (g, c, p) { yield* fortressCost(g, c, p); }, res: function* (g, c, p) { if (['hand', 'gy'].includes(c.zone)) ssx(g, p, c); } },
    { type: 'ign', loc: 'gy', tags: { ss: 1 }, label: 'Discard Machines: Special Summon', cond: (g, c, p) => fortressOk(g, c, p),
      cost: function* (g, c, p) { yield* fortressCost(g, c, p); }, res: function* (g, c, p) { if (c.zone === 'gy') ssx(g, p, c); } },
    { type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => takenFromBattle(ev, c) && ev.destroyed,
      cond: (g, c, p) => fieldOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which card?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }],
    // ENGINE: ② (look at the hand and discard 1 before an opponent's targeting monster effect resolves) needs a "before resolving" hook.
  },
  'Machina Force': {
    // PARTIAL: "must be Special Summoned by Commander Covington" isn't enforced (Covington has no script yet). The 1000 LP is paid as the attack is declared.
    cont: { forbid: (g, src, a) => a.type === 'attack' && a.c === src && contOn(g, src) && g.p[src.ctrl].lp <= 1000 },
    effs: [
      { type: 'trig', mand: true, on: (g, ev, c) => { if (ev.type === 'attack' && ev.a === c) pay(g, c.ctrl, 1000); return false; }, res: function* () {} },
      { type: 'ign', tags: { ss: 1 }, label: 'Send to GY: summon Soldier, Sniper, Defender',
        cond: (g, c, p) => nFreeM(g, p) + 1 >= 3 && FORCE3.every(n => g.p[p].gy.some(x => D(x).n === n)),
        cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); },
        target: function* (g, c, p, L) { L.t = FORCE3.map(n => g.p[p].gy.find(x => D(x).n === n)).filter(Boolean); },
        res: function* (g, c, p, L) { if (nFreeM(g, p) < 3 || !L.t.every(t => t.zone === 'gy')) return; for (const t of L.t) ssx(g, p, t); } }] },
  'Scrap Recycler': { effs: [
    { type: 'trig', when: true, on: (g, ev, c) => evSummoned(ev, c, ['normal', 'special']), cond: (g, c, p) => g.p[p].deck.some(isMachine),
      res: function* (g, c, p) { yield* search(g, p, isMachine, 'Send a Machine from your Deck to the GY', 'gy'); } },
    { type: 'ign', opt: true, label: 'Return 2 EARTH Machines: draw 1',
      cond: (g, c, p) => g.p[p].deck.length >= 0 && g.p[p].gy.filter(x => isMachine(x) && lv(x) === 4 && attr(x) === 'EARTH').length >= 2,
      cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Shuffle 2 Level 4 EARTH Machines into the Deck', g.p[p].gy.filter(x => isMachine(x) && lv(x) === 4 && attr(x) === 'EARTH'), 2, 2, 'cost'); for (const x of xs) move(g, x, 'deck', { reason: 'cost' }); log(g, `${PN(g, p)} shuffled ${xs.map(name).join(', ')} into the Deck.`); },
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  'Avenging Knight Parshath': { noSynchro: true, proc: synProc({ tuner: () => true, non: c => attr(c) === 'LIGHT' }),
    self: { piercing: true },
    effs: [{ type: 'ign', opt: true, label: 'Change a monster’s position', cond: (g, c, p) => oppFaceUp(g, p).length > 0,
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Change the position of which monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (t && faceUp(t)) { t.pos = t.pos === 'atk' ? 'def' : 'atk'; log(g, `${name(t)} changed to ${t.pos === 'atk' ? 'Attack' : 'Defense'} Position.`); } } }] },
  'XX-Saber Gottoms': { noSynchro: true, proc: synProc({ tuner: () => true, non: c => attr(c) === 'EARTH', tunerAsNon: true }),
    effs: [{ type: 'ign', label: 'Tribute an X-Saber: random discard',
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isXSaber(x)) && g.p[opp(p)].hand.length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute an X-Saber monster', monsOf(g, p).filter(x => faceUp(x) && isXSaber(x)), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
      res: function* (g, c, p) { randomDiscard(g, opp(p)); } }] },

  /* ----- Amaryllis / Plants ----- */
  'Botanical Lion': {
    // ENGINE: "control of this card can't switch" needs a check in takeControl().
    self: { atk: (g, c) => 300 * monsOf(g, c.ctrl).filter(x => faceUp(x) && race(x) === 'Plant').length } },
  'Dandylion': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy',
    cond: (g, c, p) => nFreeM(g, p) >= 2,
    res: function* (g, c, p) { if (nFreeM(g, p) >= 2) { tokens(g, p, { n: 'Fluff Token', a: 'WIND', r: 'Plant', lv: 1, atk: 0, def: 0 }, 2, 'def', { noTribute: true }); if (g.inDS) g.sw = null; } } }] },
  'Lonefire Blossom': { effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Tribute a Plant: summon a Plant',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Plant') && g.p[p].deck.some(x => isPlant(x) && !noSS(x)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute a face-up Plant', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Plant'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    res: function* (g, c, p) { if (freeM(g, p) >= 0) yield* ssFromDeck(g, p, isPlant, 'Special Summon a Plant from your Deck'); } }] },
  'Lord Poison': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 },
    on: (g, ev, c) => takenFromBattle(ev, c) && ev.destroyed,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isPlant(x) && D(x).n !== 'Lord Poison'),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which Plant from your GY?', g.p[p].gy.filter(x => isPlant(x) && D(x).n !== 'Lord Poison'), 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') ssx(g, p, t); } }] },
  'Morphing Jar': { effs: [{ type: 'trig', mand: true, on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { for (const q of [p, opp(p)]) { const h = g.p[q].hand.slice(); for (const x of h) move(g, x, 'gy', { reason: 'discard' }); if (h.length) log(g, `${PN(g, q)} discarded ${h.length} card(s).`); } for (const q of [p, opp(p)]) draw(g, q, 5); } }] },
  'Phoenixian Cluster Amaryllis': {
    // PARTIAL: "can't be Special Summoned except by its own effect" is checked while it is in the GY (and Lonefire skips it); from the hand other Special Summons aren't blocked.
    cont: { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src && g.amaOwn !== src.u },
    effs: [
      { type: 'trig', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'afterCalc' && ev.a === c,
        res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } },
      { type: 'trig', loc: 'gy', mand: true, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField && ev.to === 'gy' && ev.prevCtrl === c.owner,
        res: function* (g, c, p) { damage(g, opp(p), 800, { src: c, srcP: p }); } },
      { type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Banish a Plant: Special Summon this card',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.owner,
        cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => x !== c && isPlant(x)),
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish a Plant from your GY', g.p[p].gy.filter(x => x !== c && isPlant(x)), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${name(x)}.`); } },
        res: function* (g, c, p) { if (c.zone !== 'gy') return; g.amaOwn = c.u; try { ssx(g, p, c, 'def'); } finally { g.amaOwn = null; } } }] },
  'Tytannial, Princess of Camellias': { effs: [{ type: 'quick', ds: true, label: 'Tribute a Plant: negate',
    cond: (g, c, p, x) => x.top && !x.top.negated && (x.top.t || []).some(t => t && onField(t)) && monsOf(g, p).some(m => faceUp(m) && race(m) === 'Plant'),
    cost: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; const [x] = yield* pick(g, p, 'Tribute a face-up Plant', monsOf(g, p).filter(m => faceUp(m) && race(m) === 'Plant'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    res: function* (g, c, p, L) { L.data.L.negBy = p; negate(g, L.data.L, true); } }] },
  'D.D.R. - Different Dimension Reincarnation': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => x !== c) && g.p[p].ban.some(isMon),
    cost: function* (g, c, p) { yield* discard1(g, p, g.p[p].hand.filter(x => x !== c)); },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which banished monster?', g.p[p].ban.filter(isMon), 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = L.t[0]; if (!t || t.zone !== 'ban' || !onField(c)) return; if (ssx(g, p, t, 'atk') && equip(g, c, t)) link(g, c, t); } }] },
  'Hidden Armory': { effs: [{ type: 'act',
    cond: (g, c, p) => g.ns[p] < 1 && g.p[p].deck.length >= 1 && [...g.p[p].deck, ...g.p[p].gy].some(isEquipSpell),
    cost: function* (g, c, p) { millCost(g, p, 1); },
    after: (g, c, p) => { addRule(g, (g2, a) => (a.type === 'ns' || a.type === 'set') && a.p === p, { end: g.turnNo }); },
    res: function* (g, c, p) {
      const fromDeck = forbid(g, { type: 'search', p }) ? [] : g.p[p].deck.filter(isEquipSpell);
      const cands = [...g.p[p].gy.filter(isEquipSpell), ...fromDeck]; if (!cands.length) return;
      const [x] = yield* pick(g, p, 'Add an Equip Spell from your Deck or GY', cands, 1, 1, 'good');
      if (x) { const wasDeck = x.zone === 'deck'; move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(x)} to the hand.`); if (wasDeck) shuffleDeck(g, p); } } }] },
  'Mark of the Rose': { effs: [
    // PARTIAL: the Mark isn't destroyed if the monster is turned face-down.
    { type: 'act', cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(isPlant) && monsOf(g, opp(p)).length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish a Plant from your GY', g.p[p].gy.filter(isPlant), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${name(x)}.`); } },
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Equip Mark of the Rose to which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (t && onField(c) && equip(g, c, t) && t.ctrl !== p) takeControl(g, p, t, false); } },
    { type: 'trig', loc: 'st', mand: true, on: (g, ev, c) => endPhaseOf(ev, c) && faceUp(c) && !!equippedTo(g, c) && equippedTo(g, c).ctrl === c.ctrl,
      res: function* (g, c, p) { const t = equippedTo(g, c); if (t && t.ctrl === p) takeControl(g, opp(p), t, false); } },
    { type: 'trig', loc: 'st', mand: true, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && faceUp(c) && !!equippedTo(g, c) && equippedTo(g, c).ctrl !== c.ctrl,
      res: function* (g, c, p) { const t = equippedTo(g, c); if (t && t.ctrl !== p) takeControl(g, p, t, false); } }] },
  'Queen of Thorns': { noSynchro: true, proc: synProc({ tuner: () => true, non: c => race(c) === 'Plant' }),
    // PARTIAL: the 1000 LP is paid as a non-Plant arrives from the hand (not as a cost before it); you can't summon one with 1000 LP or less.
    cont: { forbid: (g, src, a) => contOn(g, src) && ((a.type === 'ns' && a.c.zone === 'hand') || (a.type === 'ss' && a.c.zone === 'hand')) && a.c.id && race(a.c) !== 'Plant' && g.p[a.p].lp <= 1000 },
    effs: [{ type: 'trig', mand: true, on: (g, ev, c) => { if (ev.type === 'move' && ev.from === 'hand' && ev.to === 'm' && ev.reason === 'summon' && isMon(ev.c) && race(ev.c) !== 'Plant') pay(g, ev.c.ctrl, 1000); return false; }, res: function* () {} }] },
  'Volcanic Counter': { effs: [{ type: 'trig', loc: 'gy', mand: true, on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.p === c.owner,
    res: function* (g, c, p, L) { if (c.zone !== 'gy') return; move(g, c, 'ban', { reason: 'effect' }); log(g, 'Volcanic Counter was banished.'); if (g.p[p].gy.some(x => isMon(x) && attr(x) === 'FIRE' && D(x).n !== 'Volcanic Counter')) damage(g, opp(p), L.ev.n, { src: c, srcP: p }); } }] },
  'Fiend Comedian': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= g.p[opp(p)].gy.length,
    res: function* (g, c, p) { const call = yield* choose(g, p, 'Call the coin toss', ['Heads', 'Tails']); const coin = g.rnd() < 0.5 ? 0 : 1; log(g, `The coin landed on ${coin ? 'Tails' : 'Heads'}.`);
      if (call === coin) { const gy = g.p[opp(p)].gy.slice(); for (const x of gy) move(g, x, 'ban', { reason: 'effect', by: p }); log(g, `${gy.length} card(s) in ${PN(g, opp(p))}'s GY were banished.`); }
      else mill(g, p, g.p[opp(p)].gy.length); } }] },
  'Magic Cylinder': { effs: [{ type: 'act', cond: (g, c, p) => g.aw && g.aw.a.ctrl !== p,
    target: function* (g, c, p, L) { L.t = [g.aw.a]; },
    res: function* (g, c, p, L) { negateAttack(g); const t = live(L)[0]; if (t && faceUp(t)) damage(g, t.ctrl, atk(g, t), { src: c, srcP: p }); } }] },
  'Skill Drain': {
    // ENGINE: a monster effect already on the chain when Skill Drain starts applying still resolves (resolveChain only checks c.flags.negated).
    cont: { negates: (g, src, c) => !trapStunned(g) && isMon(c) && c.zone === 'm' && faceUp(c) },
    effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp > 1000, cost: function* (g, c, p) { pay(g, p, 1000); }, res: function* () {} }] },

  /* ----- Cat ----- */
  'Summoner Monk': { effs: [
    { type: 'trig', mand: true, on: (g, ev, c) => { if (ev.type === 'summon' && ev.cs.includes(c)) c.flags.noTribute = true; return evSummoned(ev, c, ['normal', 'flip']); },
      res: function* (g, c) { if (onField(c) && c.pos === 'atk') { c.pos = 'def'; log(g, `${name(c)} changed to Defense Position.`); } } },
    { type: 'ign', opt: true, tags: { ss: 1 }, label: 'Discard a Spell: summon a Level 4',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(isSpell) && g.p[p].deck.some(x => isMon(x) && lv(x) === 4 && !noSS(x)),
      cost: function* (g, c, p) { yield* discard1(g, p, g.p[p].hand.filter(isSpell), 'Discard a Spell'); },
      res: function* (g, c, p) { const x = yield* ssFromDeck(g, p, x => lv(x) === 4, 'Special Summon a Level 4 monster from your Deck'); if (x) addRule(g, (g2, a) => a.type === 'attack' && a.c === x, { end: g.turnNo }); } }] },
  'Rescue Cat': { effs: [
    { type: 'ign', tags: { ss: 1 }, label: 'Send to GY: summon 2 Beasts',
      cond: (g, c, p) => nFreeM(g, p) + 1 >= 2 && g.p[p].deck.filter(x => isMon(x) && race(x) === 'Beast' && lv(x) <= 3 && !noSS(x)).length >= 2,
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); },
      res: function* (g, c, p) {
        const cands = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Beast' && lv(x) <= 3 && !noSS(x)); if (cands.length < 2 || nFreeM(g, p) < 2) { shuffleDeck(g, p); return; }
        const xs = yield* pick(g, p, 'Special Summon 2 Level 3 or lower Beasts', cands, 2, 2, 'good');
        for (const x of xs) if (ssx(g, p, x, 'atk')) x.flags.rescueEnd = g.turnNo;
        shuffleDeck(g, p); } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(x => x.flags.rescueEnd === g.turnNo && x.owner === c.owner) && !g.p[c.owner].gy.concat(g.p[c.owner].ban, g.p[c.owner].hand, g.p[c.owner].deck, fieldMons(g)).some(y => y !== c && D(y).n === 'Rescue Cat' && y.u < c.u),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.flags.rescueEnd === g.turnNo && x.owner === c.owner), { by: p }); } }] },
  'X-Saber Airbellum': { effs: [{ type: 'trig', mand: true, on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.direct && ev.src === c,
    res: function* (g, c, p) { randomDiscard(g, opp(p)); } }] },
  'Chaos Sorcerer': { proc: { label: 'Special Summon (banish a LIGHT and a DARK)', cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'LIGHT') && g.p[p].gy.some(x => isMon(x) && attr(x) === 'DARK'),
      cost: function* (g, c, p, grp) { const [l] = yield* pick(g, p, 'Banish a LIGHT monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT'), 1, 1, 'cost'); const [d] = yield* pick(g, p, 'Banish a DARK monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK'), 1, 1, 'cost'); for (const x of [l, d]) if (x) move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${[l, d].filter(Boolean).map(name).join(' and ')}.`); } },
    effs: [{ type: 'ign', opt: true, label: 'Banish a face-up monster',
      cond: (g, c, p) => fieldMons(g).some(x => x !== c && faceUp(x)) || fieldMons(g).some(faceUp),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Banish which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
      after: (g, c) => { addRule(g, (g2, a) => a.type === 'attack' && a.c === c, { end: g.turnNo }); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (t && faceUp(t)) { const n = D(t).n; move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${n} was banished.`); } } }] },
  'Arcanite Magician': { noSynchro: true, proc: synProc({ tuner: () => true, non: c => race(c) === 'Spellcaster' }),
    self: { atk: (g, c) => 1000 * ctr(c, 'spell') },
    effs: [
      { type: 'trig', mand: true, on: (g, ev, c) => evSummoned(ev, c, ['synchro']), res: function* (g, c) { if (onField(c)) { addCtr(g, c, 'spell', 2); log(g, 'Arcanite Magician got 2 Spell Counters.'); } } },
      { type: 'ign', tags: { destroy: 1 }, label: 'Remove a Spell Counter: destroy a card',
        cond: (g, c, p) => fieldOf(g, p).some(x => ctr(x, 'spell') > 0) && fieldOf(g, opp(p)).length > 0,
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Remove a Spell Counter from which card?', fieldOf(g, p).filter(x => ctr(x, 'spell') > 0), 1, 1, 'cost'); if (x) { addCtr(g, x, 'spell', -1); log(g, `${PN(g, p)} removed a Spell Counter from ${name(x)}.`); } },
        target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which card?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
        res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'Iron Chain Dragon': { effs: [
    { type: 'ign', label: 'Banish Iron Chains for ATK', cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && /Iron Chain/.test(D(x).n)),
      res: function* (g, c, p) { const xs = g.p[p].gy.filter(x => isMon(x) && /Iron Chain/.test(D(x).n)); for (const x of xs) move(g, x, 'ban', { reason: 'effect' }); if (!xs.length) return; log(g, `${PN(g, p)} banished ${xs.length} Iron Chain monster(s).`); if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 200 * xs.length, end: true }); log(g, `Iron Chain Dragon gained ${200 * xs.length} ATK.`); } } },
    { type: 'trig', mand: true, on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
      res: function* (g, c, p) { mill(g, opp(p), 3); } }] },
  'Thunder King Rai-Oh': {
    cont: { forbid: (g, src, a) => a.type === 'search' && contOn(g, src) },
    effs: [{ type: 'quick', negSummon: true, label: 'Send to GY: negate the Special Summon',
      cond: (g, c, p, x) => !x.top && g.attempt && g.attempt.p !== p && !['normal', 'tribute', 'flip'].includes(g.attempt.how) && !g.attempt.negated,
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); },
      res: function* (g) { if (g.attempt) { g.attempt.negated = true; log(g, 'The Special Summon was negated.'); } } }] },
  'Trap Stun': { effs: [{ type: 'act',
    // PARTIAL: Traps activated later this turn can't be activated at all (instead of being activated and negated); Traps already on the chain are negated.
    res: function* (g, c, p) {
      g.trapStun = g.turnNo;
      for (const L2 of g.chain) if (isTrap(L2.c) && L2.c !== c && !L2.negated) { L2.negated = true; log(g, `${name(L2.c)}'s effect was negated.`); }
      addRule(g, (g2, a) => a.type === 'activate' && isTrap(a.c) && a.c !== c, { end: g.turnNo });
      log(g, 'Trap effects are negated this turn.'); } }] },

  /* ----- Dragon Aggro ----- */
  'Exploder Dragon': {
    cont: { dmg: (g, src, p, n, o) => (o.battle && g.battle && g.battle.a === src && contOn(g, src) ? 0 : n) },
    effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => takenFromBattle(ev, c) && ev.destroyed && !!ev.killer,
      res: function* (g, c, p, L) { const k = L.ev.killer; if (k && onField(k) && faceUp(k)) destroy(g, [k], { by: p }); } }] },
  'Soul Taker': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which face-up monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { const t = live(L).filter(faceUp); if (destroy(g, t, { by: p, src: c }).length) gain(g, opp(p), 1000); } }] },

  /* ----- Fairy ----- */
  'Freed the Brave Wanderer': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Banish 2 LIGHTs: destroy a stronger monster',
    cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT').length >= 2 && fieldMons(g).some(x => faceUp(x) && atk(g, x) > atk(g, c)),
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Banish 2 LIGHT monsters from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT'), 2, 2, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${xs.map(name).join(', ')}.`); },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which monster?', fieldMons(g).filter(x => faceUp(x) && atk(g, x) > atk(g, c)), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { const me = onField(c) && faceUp(c) ? atk(g, c) : 1700; destroy(g, live(L).filter(x => faceUp(x) && atk(g, x) > me), { by: p }); } }] },
  'Archlord Kristya': {
    proc: { label: 'Special Summon (exactly 4 Fairies in your GY)', cond: (g, c, p) => g.p[p].gy.filter(isFairy).length === 4,
      cost: function* (g, c) { c.flags.kristya = true; } },
    cont: { forbid: (g, src, a) => a.type === 'ss' && contOn(g, src) },
    effs: [
      { type: 'trig', mand: true, on: (g, ev, c) => evSummoned(ev, c, ['special']) && !!c.flags.kristya,
        cond: (g, c, p) => g.p[p].gy.some(isFairy),
        target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Add which Fairy from your GY to your hand?', g.p[p].gy.filter(isFairy), 1, 1, 'good'); },
        res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } },
      // PARTIAL: ④ isn't a true replacement: Kristya lands in the GY first, then goes to the top of the Deck right away.
      { type: 'trig', loc: 'gy', mand: true, on: (g, ev, c) => fromFieldToGY(ev, c) && ((ev.snap && ev.snap.faceUp) || ev.battle),
        res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'deckTop', { reason: 'effect' }); log(g, 'Archlord Kristya returned to the top of the Deck.'); } } }] },
  'Shining Angel': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 }, on: (g, ev, c) => takenFromBattle(ev, c) && ev.destroyed,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && attr(x) === 'LIGHT' && baseAtk(x) <= 1500 && !noSS(x)),
    res: function* (g, c, p) { yield* ssFromDeck(g, p, x => attr(x) === 'LIGHT' && baseAtk(x) <= 1500, 'Special Summon a LIGHT with 1500 or less ATK from your Deck'); } }] },
  'Nova Summoner': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 }, on: (g, ev, c) => takenFromBattle(ev, c) && ev.destroyed,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => novaOk(g, x)),
    res: function* (g, c, p) { yield* ssFromDeck(g, p, x => novaOk(g, x), 'Special Summon from your Deck'); } }] },
  'Dimensional Alchemist': { effs: [
    { type: 'ign', opt: true, label: 'Banish the top card: +500 ATK', cond: (g, c, p) => g.p[p].deck.length > 0,
      res: function* (g, c, p) { const P = g.p[p]; if (!P.deck.length) return; const x = P.deck[P.deck.length - 1]; move(g, x, 'ban', { reason: 'effect' }); log(g, `${PN(g, p)} banished ${name(x)} from the top of the Deck.`); if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500, end: true }); log(g, 'Dimensional Alchemist gained 500 ATK.'); } } },
    { type: 'trig', loc: 'gy', when: true, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField && ev.to === 'gy' && ev.prevCtrl === c.owner,
      cond: (g, c, p) => g.p[p].ban.some(isMon),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Return which banished monster to your hand?', g.p[p].ban.filter(isMon), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'ban') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${name(t)} returned to the hand.`); } } }] },
  'Herald of Orange Light': { effs: [{ type: 'quick', loc: 'hand', ds: true, label: 'Send with a Fairy: negate',
    cond: (g, c, p, x) => x.top && !x.top.negated && x.top.p !== p && isMon(x.top.c) && x.top.eff.type !== 'act' && g.p[p].hand.some(y => y !== c && isFairy(y)),
    cost: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; const [y] = yield* pick(g, p, 'Send which other Fairy to the GY?', g.p[p].hand.filter(y => y !== c && isFairy(y)), 1, 1, 'cost'); move(g, c, 'gy', { reason: 'cost' }); if (y) move(g, y, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(c)}${y ? ' and ' + name(y) : ''} to the GY.`); },
    res: function* (g, c, p, L) { L.data.L.negBy = p; negate(g, L.data.L, true); } }] },
  'Ancient Sacred Wyvern': { noSynchro: true, proc: synProc({ tuner: c => attr(c) === 'LIGHT', non: () => true }),
    self: { atk: (g, c) => g.p[c.ctrl].lp - g.p[opp(c.ctrl)].lp },
    effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Pay 1000: Special Summon this card',
      on: (g, ev, c) => takenFromBattle(ev, c) && ev.destroyed,
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].lp > 1000,
      cost: function* (g, c, p) { pay(g, p, 1000); },
      res: function* (g, c, p) { if (c.zone === 'gy') ssx(g, p, c); } }] },
  'Shadow-Imprisoning Mirror': {
    // PARTIAL: DARK monster effects on the field or in the GY can't be activated (instead of activating and being negated).
    // ENGINE: Trigger effects don't check forbid(), so DARK Trigger effects still go through; needs an activation hook.
    cont: { forbid: (g, src, a) => !trapStunned(g) && a.type === 'activate' && isMon(a.c) && attr(a.c) === 'DARK' && (onField(a.c) || a.c.zone === 'gy') && a.eff.type !== 'act' },
    effs: [{ type: 'act', res: function* () {} }] },
});

/* Helpers used above (hoisted functions). */
function unionOn(g, m) { return allField(g).some(x => x.equipTo === m.u && isMon(x)); }
function fortressPool(g, c, p) { return g.p[p].hand.filter(x => isMachine(x)); }
function fortressOk(g, c, p) { if (freeM(g, p) < 0) return false; return fortressPool(g, c, p).reduce((s, x) => s + lv(x), 0) >= 8; }
function* fortressCost(g, c, p) {
  let sum = 0; const out = [];
  for (let i = 0; i < 8 && sum < 8; i++) {
    const left = fortressPool(g, c, p).filter(x => !out.includes(x)); if (!left.length) break;
    const [x] = yield* pick(g, p, `Discard Machines with total Levels of 8 or more (${sum} so far)`, left, 1, 1, 'cost'); if (!x) break;
    out.push(x); sum += lv(x);
  }
  for (const x of out) move(g, x, 'gy', { reason: 'cost' });
  log(g, `${PN(g, p)} discarded ${out.map(name).join(', ')}.`);
}
const FORCE3 = ['Machina Soldier', 'Machina Sniper', 'Machina Defender'];
function novaOk(g, x) {
  if (!isMon(x) || noSS(x)) return false;
  const sanct = allField(g).some(f => faceUp(f) && D(f).n === 'The Sanctuary in the Sky');
  return (race(x) === 'Fairy' && attr(x) === 'LIGHT' && baseAtk(x) <= 1500) || (sanct && D(x).n === 'Airknight Parshath');
}

/* Fluff Tokens can't be Tributed for a Tribute Summon the turn they arrive: lift the block on a later turn. */
E.addScripts({ 'Fluff Token': { effs: [{ type: 'trig', on: (g, ev, c) => { if (ev.type === 'phase' && c.flags.noTribute && c.turnIn !== g.turnNo) c.flags.noTribute = false; return false; }, res: function* () {} }] } });
})();
