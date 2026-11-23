/* Batch 5: Anti-Meta, Assault Mode, Batteryman, Black Salvo, Bushi, Cloudian, Codarus, Crystal Beast. Card scripts for js/engine.js (see build/CARD_SCRIPTS.md). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, setFaceDown, negate, addMod,
  equip, equippedTo, link, addCtr, ctr, negateAttack, endBattle, addRule, token, tokens, fusionSummon, canFusion, ritualSummon, canRitual,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned,
  fromFieldToGY, battleKill, isGemini, isExtraD, emit } = L;
const atk = L.atk, def = L.def;

/* ----- shared helpers ----- */
const isBatt = c => /^Batteryman/.test(D(c).n);
const isCloud = c => /^Cloudian/.test(D(c).n);
const isCB = c => /^Crystal Beast/.test(D(c).n);
const isCBMon = c => isCB(c) && isMon(c);
const cbST = (g, p) => g.p[p].st.filter(x => x && faceUp(x) && isCB(x)); // "Crystal Beast" cards in your Spell & Trap Zone
const UMI = ['Umi', 'A Legendary Ocean', 'Forgotten Temple of the Deep'];
const isUmi = c => faceUp(c) && UMI.includes(D(c).n);
// face-up Continuous Spells, counting Crystal Beast monsters placed as Continuous Spells
const contSpells = (g, p) => stOf(g, p).filter(x => faceUp(x) && ((isSpell(x) && D(x).sub === 'Continuous') || isMon(x)));
const fog = c => ctr(c, 'fog');
/* Place a Crystal Beast monster face-up in the Spell & Trap Zone as a Continuous Spell. The caller emits one cbPlace event (Crystal Tree). */
function placeCB(g, p, x) {
  if (freeST(g, p) < 0) return false;
  const from = x.zone; move(g, x, 'st', { ctrl: p, pos: 'up', reason: 'effect' });
  if (from === 'deck') shuffleDeck(g, p);
  log(g, `${PN(g, p)} placed ${D(x).n} in the Spell & Trap Zone as a Continuous Spell.`);
  return true;
}
const cbPlaced = (g, p) => emit(g, { type: 'cbPlace', p });
/* The Crystal Beast rule: "If this face-up card is destroyed in a Monster Zone, you can place it face-up in your Spell & Trap Zone". */
// PARTIAL: the engine has no replacement effects, so the card reaches the GY first and is then placed from there (other "sent to the GY" effects can still see it).
const cbStay = { type: 'trig', loc: 'gy', label: 'Place it as a Continuous Spell',
  on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField && ev.from === 'm' && ev.to === 'gy' && ev.snap && ev.snap.faceUp,
  cond: (g, c, p) => c.zone === 'gy' && freeST(g, p) >= 0,
  res: function* (g, c, p) { if (c.zone === 'gy' && placeCB(g, p, c)) cbPlaced(g, p); } };
/* Cloudian rules shared by the four Fog monsters */
const cloudSelf = { noBattleDestroy: true };
const cloudDoom = { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroyed in face-up Defense Position',
  // PARTIAL: "destroy it" is a rule-like effect; here it runs as a chain link after the next event (position changes emit no event).
  on: (g, ev, c) => c.zone === 'm' && faceUp(c) && c.pos === 'def' && ev.type !== 'damage',
  cond: (g, c) => onField(c) && faceUp(c) && c.pos === 'def',
  res: function* (g, c, p) { if (onField(c) && faceUp(c) && c.pos === 'def') destroy(g, [c], { by: p }); } };
const cloudFog = { type: 'trig', mand: true, label: 'Place Fog Counters', on: (g, ev, c) => evSummoned(ev, c, ['normal']),
  res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; const n = fieldMons(g).filter(x => faceUp(x) && isCloud(x)).length; addCtr(g, c, 'fog', n); log(g, `${n} Fog Counter${n === 1 ? ' was' : 's were'} placed on ${name(c)}.`); } };
function removeFogOwn(g, c, n) { addCtr(g, c, 'fog', -n); log(g, `${n} Fog Counter${n === 1 ? ' was' : 's were'} removed from ${name(c)}.`); }

E.addScripts({
  /* ----- Anti-Meta ----- */
  'Breaker the Magical Warrior': { self: { atk: (g, c) => 300 * ctr(c, 'spell') },
    effs: [
      { type: 'trig', mand: true, label: 'Place a Spell Counter', on: (g, ev, c) => evSummoned(ev, c, ['normal']),
        res: function* (g, c) { if (onField(c) && faceUp(c) && ctr(c, 'spell') < 1) { addCtr(g, c, 'spell', 1); log(g, `A Spell Counter was placed on ${name(c)}.`); } } },
      { type: 'ign', tags: { destroy: 1 }, label: 'Remove a Spell Counter: destroy a Spell/Trap',
        cond: (g, c) => ctr(c, 'spell') >= 1 && stOnField(g).length > 0,
        cost: function* (g, c) { addCtr(g, c, 'spell', -1); log(g, `A Spell Counter was removed from ${name(c)}.`); },
        target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which Spell/Trap?', stOnField(g), 1, 1, 'bad'); },
        res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'King Tiger Wanghu': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy monsters with 1400 or less ATK',
    on: (g, ev, c) => ev.type === 'summon' && ev.how !== 'flip' && ev.cs.some(x => x !== c && onField(x) && faceUp(x) && atk(g, x) <= 1400),
    res: function* (g, c, p, L) { if (!onField(c) || !faceUp(c)) return; destroy(g, L.ev.cs.filter(x => onField(x) && faceUp(x) && atk(g, x) <= 1400), { by: p }); } }] },

  /* ----- Assault Mode ----- */
  'Assault Beast': { effs: [{ type: 'ign', loc: 'hand', label: 'Discard: add Assault Mode Activate',
    cond: (g, c, p) => g.p[p].deck.some(x => D(x).n === 'Assault Mode Activate'),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${D(c).n}.`); },
    res: function* (g, c, p) { yield* search(g, p, x => D(x).n === 'Assault Mode Activate', 'Add Assault Mode Activate'); } }] },
  'Arcane Apprentice': { effs: [{ type: 'trig', loc: 'gy', label: 'Add Assault Mode Activate',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.reason === 'synchro' && ev.to === 'gy',
    cond: (g, c, p) => g.p[p].deck.some(x => D(x).n === 'Assault Mode Activate'),
    res: function* (g, c, p) { yield* search(g, p, x => D(x).n === 'Assault Mode Activate', 'Add Assault Mode Activate'); } }] },
  // Scripted from its Edison text (tx): it negates any activation, not only destroying ones.
  'Stardust Dragon Assault Mode': {
    // PARTIAL: only blocked from being summoned out of the hand; a copy milled to the GY could be revived by other cards.
    cont: { loc: 'hand', forbid: (g, src, a) => a.c === src && ['ns', 'set', 'ss'].includes(a.type) },
    effs: [
      { type: 'quick', label: 'Tribute to negate', speed: 2,
        cond: (g, c, p, x) => x.top && !x.top.negated && x.top.c !== c,
        cost: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; g.stardust = g.stardust || {}; g.stardust[c.u] = g.turnNo; move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(c).n}.`); },
        res: function* (g, c, p, L) { L.data.L.negBy = p; negate(g, L.data.L, true); } },
      { type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Return to the field', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && g.stardust && g.stardust[c.u] === g.turnNo,
        cond: (g, c, p) => freeM(g, p) >= 0, res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c); } },
      { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon Stardust Dragon',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField && ev.from === 'm',
        cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => D(x).n === 'Stardust Dragon'),
        target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon Stardust Dragon from your GY', g.p[p].gy.filter(x => D(x).n === 'Stardust Dragon'), 1, 1, 'good'); },
        res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  'Assault Mode Activate': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(s => D(s).k === 'synchro' && g.p[p].deck.some(x => / Assault Mode$/.test(D(x).n) && D(x).n.includes(D(s).n))),
    cost: function* (g, c, p, L) { const [s] = yield* pick(g, p, 'Tribute which Synchro Monster?', monsOf(g, p).filter(s => D(s).k === 'synchro' && g.p[p].deck.some(x => / Assault Mode$/.test(D(x).n) && D(x).n.includes(D(s).n))), 1, 1, 'cost'); L.data.n = D(s).n; move(g, s, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(s).n}.`); },
    res: function* (g, c, p, L) { const cands = g.p[p].deck.filter(x => / Assault Mode$/.test(D(x).n) && D(x).n.includes(L.data.n)); if (!cands.length || freeM(g, p) < 0) { shuffleDeck(g, p); return; } const [x] = yield* pick(g, p, 'Special Summon which Assault Mode monster?', cands, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },

  /* ----- Batteryman ----- */
  'Batteryman Industrial Strength': {
    proc: { label: 'Special Summon (banish 2 Batteryman from your GY)', cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && isBatt(x)).length >= 2,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Banish 2 Batteryman monsters from your GY', g.p[p].gy.filter(x => isMon(x) && isBatt(x)), 2, 2, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${xs.map(x => D(x).n).join(', ')}.`); } },
    cont: { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src },
    effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy a monster and a Spell/Trap',
      cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && race(x) === 'Thunder') && fieldMons(g).length > 0 && stOnField(g).length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish a Thunder monster from your GY', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Thunder'), 1, 1, 'cost'); move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${D(x).n}.`); },
      target: function* (g, c, p, L) { const [m] = yield* pick(g, p, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); const [s] = yield* pick(g, p, 'Destroy which Spell/Trap?', stOnField(g), 1, 1, 'bad'); L.t = [m, s].filter(Boolean); },
      res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'Batteryman Charger': { self: { atk: (g, c) => 300 * monsOf(g, c.ctrl).filter(x => faceUp(x) && race(x) === 'Thunder').length, def: (g, c) => 300 * monsOf(g, c.ctrl).filter(x => faceUp(x) && race(x) === 'Thunder').length },
    effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon a Batteryman', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
      cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].deck].some(x => isMon(x) && isBatt(x) && D(x).n !== 'Batteryman Charger' && D(x).n !== 'Batteryman Industrial Strength'),
      res: function* (g, c, p) { const cands = [...g.p[p].hand, ...g.p[p].deck].filter(x => isMon(x) && isBatt(x) && D(x).n !== 'Batteryman Charger' && D(x).n !== 'Batteryman Industrial Strength'); const [x] = yield* pick(g, p, 'Special Summon a Batteryman from your hand or Deck', cands, 1, 1, 'good'); if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x); if (fromDeck) shuffleDeck(g, p); } } }] },
  'Batteryman Micro-Cell': { effs: [
    { type: 'trig', tags: { ss: 1 }, faceDownOk: true, mand: true, label: 'Special Summon a Batteryman',
      on: (g, ev, c) => { if (ev.type === 'flip' && ev.c === c) { c.flags.mcFlipped = true; return true; } return false; },
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && isBatt(x) && lv(x) <= 4 && D(x).n !== 'Batteryman Micro-Cell'),
      res: function* (g, c, p) { const cands = g.p[p].deck.filter(x => isMon(x) && isBatt(x) && lv(x) <= 4 && D(x).n !== 'Batteryman Micro-Cell'); const [x] = yield* pick(g, p, 'Special Summon a Level 4 or lower Batteryman from your Deck', cands, 1, 1, 'good'); if (x) ss(g, p, x); shuffleDeck(g, p); } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Draw 1 card',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy' && ev.snap && ev.snap.flags && ev.snap.flags.mcFlipped,
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  'Batteryman AA': { self: {
    atk: (g, c) => { const aa = monsOf(g, c.ctrl).filter(x => faceUp(x) && D(x).n === 'Batteryman AA'); return aa.every(x => x.pos === 'atk') ? 1000 * aa.length : 0; },
    def: (g, c) => { const aa = monsOf(g, c.ctrl).filter(x => faceUp(x) && D(x).n === 'Batteryman AA'); return aa.every(x => x.pos === 'def') ? 1000 * aa.length : 0; } } },
  'Battery Charger': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.p[p].lp > 500 && freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && isBatt(x) && D(x).n !== 'Batteryman Industrial Strength'),
    cost: function* (g, c, p) { pay(g, p, 500); },
    res: function* (g, c, p) { const cands = g.p[p].gy.filter(x => isMon(x) && isBatt(x)); const [x] = yield* pick(g, p, 'Special Summon a Batteryman from your GY', cands, 1, 1, 'good'); if (x) ss(g, p, x); } }] },

  /* ----- Black Salvo ----- */
  'Black Salvo': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Revive a Level 4 DARK Machine', on: (g, ev, c) => evSummoned(ev, c, ['normal']),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && lv(x) === 4 && attr(x) === 'DARK' && race(x) === 'Machine'),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon a Level 4 DARK Machine from your GY', g.p[p].gy.filter(x => isMon(x) && lv(x) === 4 && attr(x) === 'DARK' && race(x) === 'Machine'), 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'def', { negate: true }); } }] },
  'Dekoichi the Battlechanted Locomotive': { effs: [{ type: 'trig', mand: true, label: 'Draw', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { const n = 1 + monsOf(g, p).filter(x => faceUp(x) && D(x).n === 'Bokoichi the Freightening Car').length; draw(g, p, Math.min(n, g.p[p].deck.length) || 1); } }] },
  'Overload Fusion': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => ovGeneric(g, p) || ovDragonOk(g, p),
    res: function* (g, c, p) {
      const gen = ovGeneric(g, p), dr = ovDragonOk(g, p); if (!gen && !dr) return;
      let useDragon = dr && !gen; if (dr && gen) useDragon = (yield* choose(g, p, 'Fusion Summon which monster?', ['Chimeratech Overdragon', 'Another DARK Machine Fusion'])) === 0;
      if (!useDragon) { yield* fusionSummon(g, p, { from: ['m', 'gy'], banish: true, filter: fx => attr(fx) === 'DARK' && race(fx) === 'Machine' && D(fx).n !== 'Chimeratech Overdragon' }); return; }
      const pool = ovPool(g, p); const fx = g.p[p].extra.find(x => D(x).n === 'Chimeratech Overdragon');
      const [cd] = yield* pick(g, p, 'Banish which Cyber Dragon?', pool.filter(x => D(x).n === 'Cyber Dragon'), 1, 1, 'cost');
      const mach = pool.filter(x => x !== cd && race(x) === 'Machine');
      const ms = yield* pick(g, p, 'Banish which Machine monsters (1 or more)?', mach, 1, mach.length, 'good');
      const grp = g.group; const mats = [cd, ...ms];
      for (const m of mats) move(g, m, 'ban', { reason: 'fusion', group: grp });
      log(g, `${PN(g, p)} banished ${mats.map(x => D(x).n).join(' + ')} as Fusion Material.`);
      if (freeM(g, p) >= 0) ss(g, p, fx, 'atk', { how: 'fusion', group: grp }); } }] },
  'Chimeratech Overdragon': { mats: [x => D(x).n === 'Cyber Dragon', x => race(x) === 'Machine'],
    // PARTIAL: Polymerization-style summons through fusionSummon use exactly 2 materials (its recipe is "1 or more"); Overload Fusion lets you pick any number.
    effs: [
      { type: 'trig', mand: true, label: 'Send all your other cards to the GY',
        on: (g, ev, c) => { if (!evSummoned(ev, c, ['fusion'])) return false; const n = g.events.filter(e => e.type === 'move' && e.reason === 'fusion' && e.group === ev.group).length || 2; c.flags.baseAtk = 800 * n; c.flags.ovMats = n; addMod(g, c, { def: 800 * n }); log(g, `Chimeratech Overdragon's original ATK/DEF became ${800 * n}.`); return true; },
        res: function* (g, c, p) { const xs = fieldOf(g, p).filter(x => x !== c); for (const x of xs) move(g, x, 'gy', { reason: 'effect', by: p }); if (xs.length) log(g, `${PN(g, p)} sent ${xs.length} card(s) to the GY.`); } },
      // ENGINE: canAttack() allows at most 2 attacks a turn (flags.extraAttack); Overdragon should attack monsters once per material.
      { type: 'trig', on: (g, ev, c) => { if (ev.type === 'attack' && ev.a === c && !ev.direct && (c.flags.ovMats || 0) >= 2) c.flags.extraAttack = g.turnNo; return false; }, res: function* () {} }] },

  /* ----- Bushi ----- */
  'Destiny HERO - Dasher': { effs: [
    { type: 'ign', opt: true, label: 'Tribute a monster: +1000 ATK', cond: (g, c, p) => monsOf(g, p).some(x => x !== c),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p).filter(x => x !== c), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 1000, end: true }); log(g, `${name(c)} gained 1000 ATK.`); } } },
    // PARTIAL / ENGINE: there is no "end of the Battle Phase" event, so Dasher changes to Defense Position right after its attack's Damage Step.
    { type: 'trig', on: (g, ev, c) => { if (ev.type === 'dsEnd' && ev.a === c && onField(c) && faceUp(c) && c.pos === 'atk') { c.pos = 'def'; log(g, `${name(c)} changed to Defense Position.`); } return false; }, res: function* () {} },
    { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Reveal the drawn monster: Special Summon Dasher',
      on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && ev.to === 'hand' && ev.c.owner === c.owner && isMon(ev.c) && g.phase === 'draw' && g.tp === c.owner && !(g.dasherUsed && g.dasherUsed[c.u]),
      cond: (g, c, p) => freeM(g, p) >= 0,
      cost: function* (g, c, p, L) { g.dasherUsed = g.dasherUsed || {}; g.dasherUsed[c.u] = true; if (L.ev && L.ev.c) log(g, `${PN(g, p)} revealed ${D(L.ev.c).n}.`); },
      res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c); } }] },
  // PARTIAL / ENGINE: "can't be Tributed, except for the Tribute Summon of a Warrior" is not applied (tributeCands has no per-summon check).
  'The Immortal Bushi': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon from the GY',
    // PARTIAL: an Ignition Effect in the Standby Phase in the real game; here it is offered as an optional trigger at the start of your Standby Phase.
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner,
    cond: (g, c, p) => freeM(g, p) >= 0 && monsOf(g, p).length === 0 && g.p[p].gy.filter(isMon).every(x => race(x) === 'Warrior'),
    res: function* (g, c, p) { if (c.zone === 'gy' && monsOf(g, p).length === 0) ss(g, p, c); } }] },
  'Magic Planter': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 2 && stOf(g, p).some(x => x !== c && faceUp(x) && isTrap(x) && D(x).sub === 'Continuous'),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which face-up Continuous Trap to the GY?', stOf(g, p).filter(x => x !== c && faceUp(x) && isTrap(x) && D(x).sub === 'Continuous'), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); },
    res: function* (g, c, p) { draw(g, p, 2); } }] },
  'Imperial Custom': { cont: {
      grant: (g, src, c, flag) => flag === 'noEffectDestroy' && c !== src && isST(c) && isTrap(c) && D(c).sub === 'Continuous' && faceUp(c) && D(c).n !== 'Imperial Custom',
      forbid: (g, src, a) => a.type === 'activate' && a.c !== src && a.p === src.ctrl && a.eff && a.eff.type === 'act' && D(a.c).n === 'Imperial Custom' },
    effs: [{ type: 'act', res: function* () {} }] },
  'Scrubbed Raid': { effs: [{ type: 'act', res: function* () {} },
    { type: 'quick', loc: 'st', label: 'Send a card: end the Battle Phase', cond: (g, c, p) => g.phase === 'battle' && !g.inDS && fieldOf(g, p).some(x => x !== c),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which card you control to the GY?', fieldOf(g, p).filter(x => x !== c), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); },
      res: function* (g) { if (g.phase === 'battle') endBattle(g); } }] },
  'Jar of Greed': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 1, res: function* (g, c, p) { draw(g, p, 1); } }] },
  'Uria, Lord of Searing Flames': {
    proc: { label: 'Special Summon (send 3 face-up Traps to the GY)', cond: (g, c, p) => stOf(g, p).filter(x => faceUp(x) && isTrap(x)).length >= 3,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Send 3 face-up Traps you control to the GY', stOf(g, p).filter(x => faceUp(x) && isTrap(x)), 3, 3, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} sent ${xs.map(x => D(x).n).join(', ')} to the GY.`); } },
    self: { atk: (g, c) => 1000 * g.p[c.ctrl].gy.filter(x => isTrap(x) && D(x).sub === 'Continuous').length },
    cont: { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src },
    effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy a Set Spell/Trap',
      cond: (g, c, p) => stOf(g, opp(p)).some(x => x.pos === 'set'),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which Set Spell/Trap?', stOf(g, opp(p)).filter(x => x.pos === 'set'), 1, 1, 'bad'); },
      after: (g, c, p, L) => { addRule(g, (g2, a) => a.type === 'activate' && isST(a.c) && g2.chain.includes(L), { end: g.turnNo }); },
      res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'The Transmigration Prophecy': { effs: [{ type: 'act', cond: (g) => allCards(g, 'gy').length >= 2,
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Shuffle which 2 cards from the GYs into the Deck?', allCards(g, 'gy'), 2, 2, 'bad'); },
    res: function* (g, c, p, L) { const ts = L.t.filter(t => t.zone === 'gy'); for (const t of ts) move(g, t, isExtraD(D(t)) ? 'extra' : 'deck', { reason: 'effect', by: p }); if (ts.length) log(g, `${ts.map(x => D(x).n).join(', ')} ${ts.length > 1 ? 'were' : 'was'} shuffled into the Deck.`); } }] },
  'Wall of Revealing Light': {
    cont: { forbid: (g, src, a) => a.type === 'attack' && a.c.ctrl !== src.ctrl && atk(g, a.c) <= (src.flags.wall || 0) },
    effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp > 1000,
      cost: function* (g, c, p) { const k = Math.min(8, Math.floor((g.p[p].lp - 1) / 1000)); const i = yield* choose(g, p, 'Pay how many LP?', [...Array(k).keys()].map(i => String(1000 * (i + 1)))); const n = 1000 * (i + 1); pay(g, p, n); c.flags.wall = n; },
      res: function* (g, c, p) { if (g.aw && g.aw.a && g.aw.a.ctrl !== p && onField(c) && atk(g, g.aw.a) <= (c.flags.wall || 0)) negateAttack(g); } }] },
  // PARTIAL: Field Spells can't be Set in this engine, so under Anti-Spell Fragrance they can't be activated at all.
  'Anti-Spell Fragrance': { cont: { forbid: (g, src, a) => a.type === 'activate' && a.eff && a.eff.type === 'act' && isSpell(a.c) && (a.c.zone === 'hand' || a.c.turnIn === g.turnNo || (g.tp !== a.p && a.c.turnIn === g.turnNo - 1)) },
    effs: [{ type: 'act', res: function* () {} }] },

  /* ----- Cloudian ----- */
  'Cloudian - Altus': { self: cloudSelf, effs: [cloudDoom, cloudFog,
    { type: 'ign', label: 'Remove 3 Fog Counters: random discard', cond: (g, c, p) => fieldMons(g).reduce((s, x) => s + fog(x), 0) >= 3 && g.p[opp(p)].hand.length > 0,
      cost: function* (g, c, p) { for (let n = 3; n > 0;) { const hs = fieldMons(g).filter(x => fog(x) > 0); if (!hs.length) break; const [x] = yield* pick(g, p, `Remove a Fog Counter from which card? (${n} left)`, hs, 1, 1, 'cost'); removeFogOwn(g, x, 1); n--; } },
      res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, opp(p))} discarded ${name(x)} at random.`); } }] },
  'Cloudian - Cirrostratus': { self: cloudSelf, effs: [cloudDoom, cloudFog,
    { type: 'ign', tags: { destroy: 1 }, label: 'Remove 2 Fog Counters: destroy a monster', cond: (g, c) => fog(c) >= 2 && fieldMons(g).length > 0,
      cost: function* (g, c) { removeFogOwn(g, c, 2); },
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'Cloudian - Turbulence': { self: cloudSelf, effs: [cloudDoom, cloudFog,
    { type: 'ign', tags: { ss: 1 }, label: 'Remove 1 Fog Counter: summon Smoke Ball',
      cond: (g, c, p) => fog(c) >= 1 && freeM(g, p) >= 0 && [...g.p[p].deck, ...allCards(g, 'gy')].some(x => D(x).n === 'Cloudian - Smoke Ball'),
      cost: function* (g, c) { removeFogOwn(g, c, 1); },
      res: function* (g, c, p) { const cands = [...g.p[p].deck, ...allCards(g, 'gy')].filter(x => D(x).n === 'Cloudian - Smoke Ball'); const [x] = yield* pick(g, p, 'Special Summon which Cloudian - Smoke Ball?', cands, 1, 1, 'good'); if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x); if (fromDeck) shuffleDeck(g, p); } } }] },
  'Cloudian - Acid Cloud': { self: cloudSelf, effs: [cloudDoom, cloudFog,
    { type: 'ign', tags: { destroy: 1 }, label: 'Remove 2 Fog Counters: destroy a Spell/Trap', cond: (g, c) => fog(c) >= 2 && stOnField(g).length > 0,
      cost: function* (g, c) { removeFogOwn(g, c, 2); },
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which Spell/Trap?', stOnField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'Crystal Seer': { effs: [{ type: 'trig', mand: true, label: 'Look at the top 2 cards', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { const dk = g.p[p].deck; if (dk.length < 2) return; const top = dk.slice(-2); const [x] = yield* pick(g, p, 'Add which card to your hand? (the other goes to the bottom)', top, 1, 1, 'good'); if (!x) return; const other = top.find(y => y !== x); move(g, x, 'hand', { reason: 'effect' }); const i = dk.indexOf(other); if (i >= 0) { dk.splice(i, 1); dk.unshift(other); } log(g, `${PN(g, p)} added a card to the hand and put the other on the bottom of the Deck.`); } }] },
  'Messenger of Peace': { cont: { forbid: (g, src, a) => a.type === 'attack' && atk(g, a.c) >= 1500 },
    effs: [{ type: 'act', res: function* () {} },
      { type: 'trig', loc: 'st', mand: true, label: 'Pay 100 LP or destroy this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && faceUp(c),
        res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 100 && (yield* yn(g, p, 'Pay 100 LP to keep Messenger of Peace?'))) pay(g, p, 100); else destroy(g, [c], { by: p, rule: true }); } }] },
  'Begone, Knave!': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, label: 'Return the monster to the hand', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src && isMon(ev.src) && faceUp(c),
      res: function* (g, c, p, L) { const m = L.ev.src; if (m && onField(m)) { move(g, m, 'hand', { reason: 'effect', by: p }); log(g, `${D(m).n} returned to the hand.`); } } }] },
  'Herald of Purple Light': { effs: [{ type: 'quick', loc: 'hand', ds: true, label: 'Negate a Trap',
    cond: (g, c, p, x) => spellTrapAct(x.top) && isTrap(x.top.c) && x.top.p !== p && !x.top.negated && g.p[p].hand.some(y => y !== c && isMon(y) && race(y) === 'Fairy'),
    cost: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; const [y] = yield* pick(g, p, 'Send which other Fairy from your hand to the GY?', g.p[p].hand.filter(y => y !== c && isMon(y) && race(y) === 'Fairy'), 1, 1, 'cost'); move(g, c, 'gy', { reason: 'cost' }); move(g, y, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(c).n} and ${D(y).n} to the GY.`); },
    res: function* (g, c, p, L) { L.data.L.negBy = p; negate(g, L.data.L, true); } }] },
  'Seven Tools of the Bandit': { effs: [{ type: 'act',
    cond: (g, c, p, x) => spellTrapAct(x.top) && isTrap(x.top.c) && !x.top.negated && g.p[p].lp > 1000,
    cost: function* (g, c, p) { pay(g, p, 1000); },
    target: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L) { L.data.L.negBy = p; negate(g, L.data.L, true); } }] },

  /* ----- Codarus ----- */
  'Codarus': { effs: [{ type: 'ign', label: 'Send Umi: send 2 of their cards to the GY',
    cond: (g, c, p) => stOf(g, p).some(isUmi) && fieldOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which face-up "Umi" to the GY?', stOf(g, p).filter(isUmi), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Send up to 2 of their cards to the GY', fieldOf(g, opp(p)), 1, 2, 'bad'); },
    res: function* (g, c, p, L) { const ts = live(L); for (const t of ts) move(g, t, 'gy', { reason: 'effect', by: p }); if (ts.length) log(g, `${ts.map(x => D(x).n).join(', ')} ${ts.length > 1 ? 'were' : 'was'} sent to the GY.`); } }] },
  'Warrior of Atlantis': { effs: [{ type: 'ign', loc: 'hand', label: 'Discard: add A Legendary Ocean',
    cond: (g, c, p) => g.p[p].deck.some(x => D(x).n === 'A Legendary Ocean'),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${D(c).n}.`); },
    res: function* (g, c, p) { yield* search(g, p, x => D(x).n === 'A Legendary Ocean', 'Add A Legendary Ocean'); } }] },
  'Mother Grizzly': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 }, ds: true, label: 'Special Summon a WATER',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && attr(x) === 'WATER' && baseAtk(x) <= 1500),
    res: function* (g, c, p) { const cands = g.p[p].deck.filter(x => isMon(x) && attr(x) === 'WATER' && baseAtk(x) <= 1500); const [x] = yield* pick(g, p, 'Special Summon a WATER with 1500 or less ATK from your Deck', cands, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  // ENGINE: lv() has no hook for continuous Level changes, so "reduce the Level of WATER monsters by 1" is not applied (the ATK/DEF part is).
  'A Legendary Ocean': { cont: { atk: (g, src, c) => attr(c) === 'WATER' ? 200 : 0, def: (g, src, c) => attr(c) === 'WATER' ? 200 : 0 },
    effs: [{ type: 'act', res: function* () {} }] },
  // Its name counts as "Umi" for Codarus (isUmi in this file); the engine's name() is not changed.
  'Forgotten Temple of the Deep': { effs: [{ type: 'act', res: function* () {} },
    { type: 'quick', loc: 'st', opt: true, label: 'Banish a Level 4 or lower Fish, Sea Serpent or Aqua',
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && lv(x) <= 4 && ['Fish', 'Sea Serpent', 'Aqua'].includes(race(x))),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Banish which monster until your End Phase?', monsOf(g, p).filter(x => faceUp(x) && lv(x) <= 4 && ['Fish', 'Sea Serpent', 'Aqua'].includes(race(x))), 1, 1, 'cost'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !onField(c)) return; move(g, t, 'ban', { reason: 'effect', by: p }); c.flags.temple = [...(c.flags.temple || []), t.u]; log(g, `${D(t).n} was banished until ${PN(g, p)}'s End Phase.`); } },
    { type: 'trig', loc: 'st', mand: true, tags: { ss: 1 }, label: 'Return the banished monsters',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl && faceUp(c) && (c.flags.temple || []).length > 0,
      res: function* (g, c, p) { const us = c.flags.temple || []; c.flags.temple = []; for (const u of us) { const x = allCards(g, 'ban').find(y => y.u === u); if (!x) continue; if (freeM(g, p) >= 0) ss(g, p, x); else move(g, x, 'gy', { reason: 'rule' }); } } }] },
  'Spiritual Water Art - Aoi': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => attr(x) === 'WATER' && faceUp(x)) && g.p[opp(p)].hand.length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which WATER monster?', monsOf(g, p).filter(x => attr(x) === 'WATER' && faceUp(x)), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
    res: function* (g, c, p) { const h = g.p[opp(p)].hand; log(g, `${PN(g, p)} looked at ${PN(g, opp(p))}'s hand.`); if (!h.length) return; const [x] = yield* pick(g, p, 'Send which card from their hand to the GY?', h, 1, 1, 'bad'); if (x) { move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${D(x).n} was sent to the GY.`); } } }] },

  /* ----- Crystal Beast ----- */
  'Crystal Beast Sapphire Pegasus': { effs: [
    { type: 'trig', when: true, label: 'Place a Crystal Beast', on: (g, ev, c) => evSummoned(ev, c),
      cond: (g, c, p) => freeST(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].some(isCBMon),
      res: function* (g, c, p) { const cands = [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].filter(isCBMon); const [x] = yield* pick(g, p, 'Place which Crystal Beast as a Continuous Spell?', cands, 1, 1, 'good'); if (x && placeCB(g, p, x)) cbPlaced(g, p); } },
    cbStay] },
  'Crystal Beast Topaz Tiger': { self: { atk: (g, c) => g.inDS && g.battle && g.battle.a === c && g.battle.t ? 400 : 0 }, effs: [cbStay] },
  // ENGINE: attack() keeps the attack target in a local variable, so a card can't redirect an attack. Amber Mammoth's first effect is not scripted.
  'Crystal Beast Amber Mammoth': { effs: [cbStay] },
  'Crystal Beast Ruby Carbuncle': { effs: [
    { type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon Crystal Beasts', on: (g, ev, c) => evSummoned(ev, c, ['special']),
      cond: (g, c, p) => freeM(g, p) >= 0 && cbST(g, p).some(isMon),
      res: function* (g, c, p) { let cands = cbST(g, p).filter(isMon); const n = Math.min(nFreeM(g, p), cands.length); if (!n) return; if (cands.length > n) cands = yield* pick(g, p, `Special Summon which ${n} Crystal Beast(s)?`, cands, n, n, 'good'); for (const x of cands) ss(g, p, x); } },
    cbStay] },
  'Dragon Queen of Tragic Endings': {
    proc: { label: 'Special Summon (3 face-up Continuous Spells)', cond: (g, c, p) => contSpells(g, p).length >= 3 },
    effs: [
      { type: 'trig', mand: true, label: 'Discard and draw', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl && g.battle && g.battle.a === c,
        res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand; if (h.length) { const [x] = yield* pick(g, o, 'Send which card from your hand to the GY?', h, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${PN(g, o)} sent ${D(x).n} to the GY.`); } } if (g.p[p].deck.length) draw(g, p, 1); } },
      { type: 'trig', loc: 'gy', on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.to === 'gy') c.flags.dqField = !!ev.wasField; return false; }, res: function* () {} },
      { type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon from the GY',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner && c.flags.dqField,
        cond: (g, c, p) => freeM(g, p) >= 0 && contSpells(g, p).length > 0,
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which face-up Continuous Spell to the GY?', contSpells(g, p), 1, 1, 'cost'); if (!x) return; move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); },
        res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c); } }] },
  'Crystal Beacon': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => cbST(g, p).length >= 2 && freeM(g, p) >= 0 && g.p[p].deck.some(isCBMon),
    res: function* (g, c, p) { if (cbST(g, p).length < 2 || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon a Crystal Beast from your Deck', g.p[p].deck.filter(isCBMon), 1, 1, 'good'); if (x) ss(g, p, x); shuffleDeck(g, p); } }] },
  // ENGINE: activatable() and emit() never look at the Field Zone, so the 3+, 4+ and 5 effects below can't be activated yet. The 1+ and 2+ effects work.
  // PARTIAL: the 2+ halving is applied automatically to the first battle damage each turn (it is optional on the card).
  'Ancient City - Rainbow Ruins': {
    self: { noEffectDestroy: (g, c) => cbST(g, c.ctrl).length >= 1 },
    cont: { dmg: (g, src, p, n, o) => { if (p === src.ctrl && o.battle && cbST(g, p).length >= 2 && src.flags.halved !== g.turnNo) { src.flags.halved = g.turnNo; log(g, 'Ancient City - Rainbow Ruins halved the battle damage.'); return Math.floor(n / 2); } return n; } },
    effs: [{ type: 'act', res: function* () {} },
      { type: 'quick', loc: 'fz', label: 'Send a Crystal Beast: negate a Spell/Trap',
        cond: (g, c, p, x) => cbST(g, p).length >= 3 && spellTrapAct(x.top) && !x.top.negated && monsOf(g, p).some(y => faceUp(y) && isCBMon(y)),
        cost: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; const [y] = yield* pick(g, p, 'Send which Crystal Beast monster to the GY?', monsOf(g, p).filter(y => faceUp(y) && isCBMon(y)), 1, 1, 'cost'); move(g, y, 'gy', { reason: 'cost' }); },
        res: function* (g, c, p, L) { if (cbST(g, p).length < 3) return; L.data.L.negBy = p; negate(g, L.data.L, true); } },
      { type: 'ign', loc: 'fz', opt: true, label: 'Draw 1 card', cond: (g, c, p) => cbST(g, p).length >= 4 && g.p[p].deck.length > 0,
        res: function* (g, c, p) { if (cbST(g, p).length >= 4) draw(g, p, 1); } },
      { type: 'ign', loc: 'fz', opt: true, tags: { ss: 1 }, label: 'Special Summon a Crystal Beast', cond: (g, c, p) => cbST(g, p).length >= 5 && freeM(g, p) >= 0,
        target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which Crystal Beast?', cbST(g, p).filter(isMon), 1, 1, 'good'); },
        res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'st' && cbST(g, p).length >= 5) ss(g, p, t); } }] },
  'Rare Value': { effs: [{ type: 'act', cond: (g, c, p) => cbST(g, p).length >= 2 && g.p[p].deck.length >= 2,
    res: function* (g, c, p) { const cs = cbST(g, p); if (!cs.length) return; const [x] = yield* pick(g, opp(p), `Choose a Crystal Beast card for ${PN(g, p)} to send to the GY`, cs, 1, 1, 'bad'); if (!x) return; move(g, x, 'gy', { reason: 'effect' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); if (x.zone === 'gy') draw(g, p, 2); } }] },
  'Crystal Tree': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'cbPlace' && faceUp(c)) { addCtr(g, c, 'crystal', 1); log(g, `A Crystal Counter was placed on ${name(c)}.`); } return false; }, res: function* () {} },
    { type: 'ign', loc: 'st', label: 'Send this card: place Crystal Beasts',
      cond: (g, c, p) => { const n = ctr(c, 'crystal'); return n >= 1 && g.p[p].deck.filter(isCBMon).length >= n && nFreeST(g, p) + 1 >= n; },
      cost: function* (g, c, p, L) { L.data.n = ctr(c, 'crystal'); move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Crystal Tree to the GY.`); },
      res: function* (g, c, p, L) { const n = Math.min(L.data.n, nFreeST(g, p)); const cands = g.p[p].deck.filter(isCBMon); if (!n || !cands.length) return; const xs = yield* pick(g, p, `Place ${n} Crystal Beast(s) from your Deck`, cands, Math.min(n, cands.length), Math.min(n, cands.length), 'good'); let any = false; for (const x of xs) any = placeCB(g, p, x) || any; if (any) cbPlaced(g, p); shuffleDeck(g, p); } }] },
  'Crystal Blessing': { effs: [{ type: 'act', cond: (g, c, p) => nFreeST(g, p) - (c.zone === 'hand' ? 1 : 0) >= 1 && g.p[p].gy.some(isCBMon),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Place up to 2 Crystal Beasts from your GY', g.p[p].gy.filter(isCBMon), 1, Math.max(1, Math.min(2, nFreeST(g, p))), 'good'); },
    res: function* (g, c, p, L) { let ts = L.t.filter(t => t.zone === 'gy'); if (!nFreeST(g, p)) return; if (ts.length > nFreeST(g, p)) ts = yield* pick(g, p, 'Place which Crystal Beast?', ts, nFreeST(g, p), nFreeST(g, p), 'good'); let any = false; for (const t of ts) any = placeCB(g, p, t) || any; if (any) cbPlaced(g, p); } }] },
  'Crystal Release': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 800 : 0 },
    effs: [{ type: 'act', cond: (g) => fieldMons(g).some(x => faceUp(x) && isCBMon(x)),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Equip Crystal Release to which Crystal Beast?', fieldMons(g).filter(x => faceUp(x) && isCBMon(x)), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (t && faceUp(t) && isCBMon(t)) equip(g, c, t); } },
    { type: 'trig', loc: 'gy', when: true, label: 'Place a Crystal Beast from your Deck', on: (g, ev, c) => fromFieldToGY(ev, c),
      cond: (g, c, p) => freeST(g, p) >= 0 && g.p[p].deck.some(isCBMon),
      res: function* (g, c, p) { const [x] = yield* pick(g, p, 'Place which Crystal Beast from your Deck?', g.p[p].deck.filter(isCBMon), 1, 1, 'good'); if (x && placeCB(g, p, x)) cbPlaced(g, p); } }] },
  'Crystal Raigeki': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => cbST(g, p).length > 0 && fieldOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Crystal Beast card to the GY?', cbST(g, p), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); },
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which card?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
});

/* Overload Fusion helpers */
function ovPool(g, p) { return [...monsOf(g, p), ...g.p[p].gy.filter(isMon)]; }
function ovGeneric(g, p) { return canFusion(g, p, { from: ['m', 'gy'], filter: fx => attr(fx) === 'DARK' && race(fx) === 'Machine' && D(fx).n !== 'Chimeratech Overdragon' }); }
function ovDragonOk(g, p) {
  if (!g.p[p].extra.some(x => D(x).n === 'Chimeratech Overdragon')) return false;
  const pool = ovPool(g, p); const cd = pool.find(x => D(x).n === 'Cyber Dragon');
  if (!cd || !pool.some(x => x !== cd && race(x) === 'Machine')) return false;
  return freeM(g, p) >= 0 || monsOf(g, p).length > 0;
}
function nFreeST(g, p) { return g.p[p].st.filter(z => !z).length; }
})();
