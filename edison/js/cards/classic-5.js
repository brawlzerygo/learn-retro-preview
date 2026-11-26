/* Classic 5: Duelist Kingdom and Battle City Traps and Spells (build/classic_batch_5.json). Card scripts for js/engine.js
 (see build/CARD_SCRIPTS.md), registered for Goat only (E.addScripts(obj, 'goat')), for the classic cards in
 play/data/classic-cards.js, played by Goat-era rules. Each card is written from its text in the batch file. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, takeControl, setFaceDown, negate, addMod,
  equip, negateAttack, endBattle, addRule, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk,
  monsOf, stOf, allField, fieldMons, freeM, freeST, nFreeM, shuffleDeck, log, PN, has, live, opp, oppFaceUp, emit, stat,
  spellTrapAct, coin, dice, winDuel } = L;
const atk = L.atk, def = L.def;

const named = (c, n) => D(c).n === n;
const tx = c => D(c).ps || D(c).tx || '';
const UMIS = ['Umi', 'A Legendary Ocean'];
const umiUp = g => allField(g).some(x => faceUp(x) && UMIS.includes(D(x).n));
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); };
const toAtk = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos === 'atk') return; c.pos = 'atk'; g.seq++; log(g, `${name(c)} was changed to Attack Position.`); };
const mainPhase = g => g.phase === 'main1' || g.phase === 'main2';
const burnText = c => { const t = tx(c).replace(/[^.]*battle damage[^.]*\.?/gi, ''); return /inflict[^.]*damage|damage to (both|each|your)|takes? [^.]*damage/i.test(t); };

/* A Trap that answers a moment with no response window in the engine (a battle destruction, a Set):
 a trigger that only fires while the card is Set (and wasn't Set this turn). It flips the card face-up, counts as a
 Trap Card activation at Spell Speed 2 (Solemn Judgment can negate it), and sends the card to the GY after it resolves.
 ENGINE: no response window after a monster is destroyed by battle or Set, so these Traps act as optional triggers. */
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  // the event is kept on the card too: the engine sets L.ev only after cost and target have run
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });

/* A battle worked out inside a card (an attack switched to a new target or a new attacker).
 PARTIAL: the engine keeps the attack target in attack(), so the original attack is negated and this battle has no
 Damage Step windows of its own; damage and destruction follow the normal battle rules. */
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
// end the current attack declaration (its replacement battle is worked out by the card)
const stopAttack = g => { negateAttack(g); g.aw = null; };

// An Equip Trap (Kunai with Chain, Metalmorph): it stays on the field equipped (L.keep stops the Normal Trap going to the GY).
function equipTrap(g, c, t, L2) { if (!onField(c) || !t || !onField(t) || !faceUp(t) || t.zone !== 'm') return false; equip(g, c, t); L2.keep = true; return true; }

// Spell/Trap continuous lock on one monster (Shadow Spell, Spellbinding Circle): the held monster's u is c.flags.hold.
const holdLock = { forbid: (g, src, a) => (a.type === 'attack' || a.type === 'pos') && a.c && a.c.u === src.flags.hold };
const holdAct = (filter, text) => ({ type: 'act', cond: (g, c, p) => monsOf(g, opp(p)).some(filter),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, monsOf(g, opp(p)).filter(filter), 1, 1, 'bad'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !onField(c) || !filter(t)) return; c.flags.hold = t.u; log(g, `${name(c)} holds ${t.pos === 'set' ? 'a face-down monster' : name(t)}.`); if (g.aw && g.aw.a === t) stopAttack(g); } });
const holdGone = destroyedOnly => ({ type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 },
  on: (g, ev, c) => faceUp(c) && c.flags.hold && ev.type === 'move' && ev.c.u === c.flags.hold && ev.wasField && ev.to !== 'm' && (!destroyedOnly || ev.destroyed),
  res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } });

E.addScripts({
  /* ----- Traps ----- */
  // Continuous: face-up Dragons are put in Defense Position (also any that arrive later) and can't change position.
  'Dragon Capture Jar': {
    cont: { forbid: (g, src, a) => a.type === 'pos' && a.c && faceUp(a.c) && race(a.c) === 'Dragon' },
    effs: [{ type: 'act', res: function* (g) { for (const m of fieldMons(g)) if (faceUp(m) && race(m) === 'Dragon') toDef(g, m); } },
      { type: 'trig', loc: 'st', on: (g, ev, c) => { if (faceUp(c)) for (const m of fieldMons(g)) if (m.pos === 'atk' && race(m) === 'Dragon') toDef(g, m); return false; }, res: function* () {} }] },
  'Gift of The Mystical Elf': { effs: [{ type: 'act', res: function* (g, c, p) { gain(g, p, 300 * fieldMons(g).length); } }] },
  // The negation lasts the turn (kept on the game; the GY copy carries it). PARTIAL: it ends early if this card leaves the GY.
  "Gorgon's Eye": { cont: { loc: 'gy', negates: (g, src, c) => g.gorgonEye === g.turnNo && c.zone === 'm' && (c.pos === 'def' || c.pos === 'set') },
    effs: [{ type: 'act', res: function* (g) { g.gorgonEye = g.turnNo; g.seq++; log(g, 'Effects of Defense Position monsters are negated this turn.'); } }] },
  // PARTIAL: the Spell is Set in your Spell/Trap Zone (you can activate it this turn like a card in your hand, but a
  // Quick-Play can't be activated the turn it is Set); if it is still Set at the End Phase it goes back to its owner's GY.
  // Using it costs 2000 damage. Field Spells are left out (they need the Field Zone).
  'Graverobber': { effs: [
    { type: 'act', cond: (g, c, p) => freeST(g, p) >= 0 && g.p[opp(p)].gy.some(x => isSpell(x) && D(x).sub !== 'Field'),
      res: function* (g, c, p) { const cs = g.p[opp(p)].gy.filter(x => isSpell(x) && D(x).sub !== 'Field'); if (!cs.length || freeST(g, p) < 0) return;
        const [x] = yield* pick(g, p, 'Take which Spell from their GY?', cs, 1, 1, 'good'); if (!x) return;
        move(g, x, 'st', { ctrl: p, pos: 'set', reason: 'effect', by: p }); x.turnIn = g.turnNo - 1; x.flags.robbedBy = c.u; x.flags.robbedTurn = g.turnNo;
        log(g, `${PN(g, p)} took ${name(x)} from the GY to use this turn.`); } },
    // the taken Spell was used (turned face-up to activate): its user takes 2000 damage once
    { type: 'trig', loc: 'any', mand: true, label: 'Take 2000 damage',
      on: (g, ev, c) => { let due = false; for (const x of allField(g)) if (x.zone === 'st' && faceUp(x) && x.flags.robbedBy === c.u && !x.flags.robbedPaid) { x.flags.robbedPaid = true; due = true; } return due; },
      res: function* (g, c) { damage(g, c.owner, 2000, { src: c, srcP: c.owner }); } },
    { type: 'trig', loc: 'any', mand: true,
      on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'end') for (const x of allField(g)) if (x.zone === 'st' && x.pos === 'set' && x.flags.robbedBy === c.u && x.flags.robbedTurn === g.turnNo) { move(g, x, 'gy', { reason: 'rule' }); log(g, `${D(x).n} went back to the GY.`); } return false; },
      res: function* () {} }] },
  'Horn of Heaven': { effs: [{ type: 'act', negSummon: true,
    cond: (g, c, p, x) => !x.top && !!g.attempt && monsOf(g, p).some(m => !g.attempt.cs.includes(m)),
    cost: function* (g, c, p) { const [m] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p).filter(m => !g.attempt.cs.includes(m)), 1, 1, 'cost'); if (m) { const nm = m.pos === 'set' ? 'a face-down monster' : name(m); move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); } },
    res: function* (g) { if (g.attempt) { g.attempt.negated = true; log(g, 'The summon was negated.'); } } }] },
  'Kunai with Chain': { effs: [{ type: 'act',
    cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p && g.aw.a.pos === 'atk') || monsOf(g, p).some(faceUp),
    target: function* (g, c, p, L2) {
      const canA = !!(g.aw && g.aw.a.ctrl !== p && g.aw.a.pos === 'atk'), canE = monsOf(g, p).some(faceUp);
      const modes = []; if (canA) modes.push('a'); if (canE) modes.push('e'); if (canA && canE) modes.push('ae');
      const lab = { a: 'Change the attacker to Defense Position', e: 'Equip to your monster (+500 ATK)', ae: 'Both' };
      const i = modes.length > 1 ? yield* choose(g, p, 'Kunai with Chain: which effect?', modes.map(m => lab[m])) : 0;
      L2.data.mode = modes[i]; if (L2.data.mode.includes('a')) L2.data.a = g.aw.a;
      if (L2.data.mode.includes('e')) { const [m] = yield* pick(g, p, 'Equip to which of your face-up monsters?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); L2.data.e = m; }
      L2.t = [L2.data.a, L2.data.e].filter(Boolean); },
    res: function* (g, c, p, L2) { if (L2.data.a && onField(L2.data.a)) toDef(g, L2.data.a); if (L2.data.e) equipTrap(g, c, L2.data.e, L2); } }],
    cont: { atk: (g, src, m) => src.equipTo === m.u ? 500 : 0 } },
  'Magical Hats': { effs: [
    { type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => g.tp !== p && g.phase === 'battle' && !g.inDS && monsOf(g, p).length > 0 && nFreeM(g, p) >= 2 && g.p[p].deck.filter(isST).length >= 2,
      res: function* (g, c, p) {
        if (!monsOf(g, p).length || nFreeM(g, p) < 2) return;
        const [m] = yield* pick(g, p, 'Choose 1 monster you control', monsOf(g, p), 1, 1, 'good');
        const sts = g.p[p].deck.filter(isST); if (sts.length < 2) return;
        const xs = yield* pick(g, p, 'Choose 2 Spell/Trap Cards from your Deck', sts, 2, 2, 'cost');
        if (m && faceUp(m)) setFaceDown(g, m);
        const made = [];
        for (const x of xs) if (ss(g, p, x, 'set')) { x.flags.baseAtk = 0; addMod(g, x, { set: 0, which: 'def' }); x.flags.hatsBy = c.u; made.push(x); }
        shuffleDeck(g, p);
        // shuffle the three cards among their zones
        const cards = [m, ...made].filter(x => x && onField(x) && x.zone === 'm'); const zs = cards.map(x => g.p[p].m.indexOf(x));
        for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(g.rnd() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
        cards.forEach((x, i) => { g.p[p].m[zs[i]] = x; }); g.seq++;
        log(g, `${PN(g, p)} shuffled the face-down cards.`); } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the Hats',
      on: (g, ev, c) => (ev.type === 'phase' && ev.ph === 'bpEnd' || ev.type === 'phase' && ev.ph === 'end') && fieldMons(g).some(x => x.flags.hatsBy === c.u),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.flags.hatsBy === c.u), { by: p }); } }] },
  'Negate Attack': { effs: [{ type: 'act', cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p), res: function* (g) { endBattle(g); } }] },
  'Shadow Spell': { cont: { ...holdLock, atk: (g, src, m) => m.u === src.flags.hold ? -700 : 0 },
    effs: [holdAct(faceUp, 'Target which face-up monster?'), holdGone(false)] },
  // Trigger-style Trap (see trapTrig): when the opponent Sets a monster.
  'Shadow of Eyes': { effs: [trapTrig({ label: 'Flip the Set monster',
    on: (g, ev, c) => ev.type === 'set' && ev.p !== c.ctrl,
    target: function* (g, c, p, L2) { L2.t = [L2.ev.c]; },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone === 'm' && t.pos === 'set') { t.pos = 'atk'; g.seq++; log(g, `${name(t)} was changed to face-up Attack Position.`); } } })] },
  'Spellbinding Circle': { cont: holdLock, effs: [holdAct(() => true, 'Target which monster?'), holdGone(true)] },
  // ENGINE: no revealed-hand state, so the hand reveal is only logged when the card is activated.
  'The Eye of Truth': { effs: [
    { type: 'act', res: function* (g, c, p) { const h = g.p[opp(p)].hand; log(g, `${PN(g, opp(p))}'s hand: ${h.length ? h.map(x => D(x).n).join(', ') : 'empty'}.`); } },
    { type: 'trig', loc: 'st', mand: true, opt: true, label: 'Opponent gains 1000 LP',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl && g.p[ev.tp].hand.some(isSpell),
      res: function* (g, c, p) { const o = opp(p); log(g, `${PN(g, o)}'s hand: ${g.p[o].hand.map(x => D(x).n).join(', ')}.`); if (g.p[o].hand.some(isSpell)) gain(g, o, 1000); } }] },
  'Time Machine': { effs: [trapTrig({ label: 'Special Summon the destroyed monster', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && ev.wasField && isMon(ev.c),
    cond: (g, c, p, x) => x.ev.c.zone === 'gy' && freeM(g, x.ev.prevCtrl) >= 0,
    target: function* (g, c, p, L2) { L2.data.x = L2.ev.c; },
    res: function* (g, c, p, L2) { const x = L2.data.x, q = L2.ev.prevCtrl; if (x.zone !== 'gy') return; const pos = L2.ev.snap && L2.ev.snap.pos === 'atk' ? 'atk' : 'def'; ss(g, q, x, pos); } })] },
  // PARTIAL: the engine doesn't know each Equip Card's legal targets, so no Equip is destroyed as "incorrect";
  // every Equip Card simply moves to the target (Snatch Steal's control stays where it was).
  'Collected Power': { effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp) && allField(g).some(x => x.zone === 'st' && x.equipTo),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip all Equip Cards to which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const eqs = allField(g).filter(x => x.zone === 'st' && x.equipTo && x.equipTo !== t.u); for (const x of eqs) x.equipTo = t.u; g.seq++; if (eqs.length) log(g, `${eqs.map(name).join(', ')} ${eqs.length > 1 ? 'were' : 'was'} equipped to ${name(t)}.`); } }] },
  // "No damage until the end of the next turn" is kept on the game and read from this card in the GY.
  // PARTIAL: it ends early if this card leaves the GY.
  'Crush Card Virus': { cont: { loc: 'gy', dmg: (g, src, p, n) => g.ccv && g.ccv.p === p && g.turnNo <= g.ccv.until ? 0 : n },
    effs: [{ type: 'act', tags: { destroy: 1 },
      cond: (g, c, p) => monsOf(g, p).some(m => attr(m) === 'DARK' && stat(g, m, 'atk') <= 1000),
      cost: function* (g, c, p) { const [m] = yield* pick(g, p, 'Tribute a DARK monster with 1000 or less ATK', monsOf(g, p).filter(m => attr(m) === 'DARK' && stat(g, m, 'atk') <= 1000), 1, 1, 'cost'); if (m) { move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(m).n}.`); } },
      res: function* (g, c, p) {
        const o = opp(p); g.ccv = { p: o, until: g.turnNo + 1 }; log(g, `${PN(g, o)} takes no damage until the end of the next turn.`);
        const h = g.p[o].hand; log(g, `${PN(g, p)} looked at ${PN(g, o)}'s hand: ${h.length ? h.map(x => D(x).n).join(', ') : 'empty'}.`);
        destroy(g, monsOf(g, o).filter(m => stat(g, m, 'atk') >= 1500), { by: p, src: c });
        const hx = h.filter(x => isMon(x) && baseAtk(x) >= 1500);
        for (const x of hx) move(g, x, 'gy', { reason: 'effect', destroyed: true, by: p });
        if (hx.length) log(g, `${hx.map(x => D(x).n).join(', ')} ${hx.length > 1 ? 'were' : 'was'} destroyed in the hand.`);
        const dk = g.p[o].deck.filter(x => isMon(x) && baseAtk(x) >= 1500);
        if (dk.length) { const xs = yield* pick(g, o, 'Destroy up to 3 monsters with 1500 or more ATK in your Deck?', dk, 0, 3, 'cost');
          for (const x of xs) move(g, x, 'gy', { reason: 'effect', destroyed: true, by: o });
          if (xs.length) log(g, `${PN(g, o)} destroyed ${xs.map(x => D(x).n).join(', ')} in the Deck.`); shuffleDeck(g, o); } } }] },
  'Dark Renewal': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => !!(g.sw && g.sw.p !== p && g.sw.how !== 'flip' && g.sw.cs.some(x => onField(x) && x.ctrl !== p)) && monsOf(g, p).some(m => faceUp(m) && race(m) === 'Spellcaster'),
    target: function* (g, c, p, L2) {
      const [a] = yield* pick(g, p, 'Target which summoned monster?', g.sw.cs.filter(x => onField(x) && x.ctrl !== p), 1, 1, 'bad');
      const [b] = yield* pick(g, p, 'Target which of your Spellcasters?', monsOf(g, p).filter(m => faceUp(m) && race(m) === 'Spellcaster'), 1, 1, 'cost');
      L2.t = [a, b].filter(Boolean); },
    res: function* (g, c, p, L2) {
      const ts = live(L2); if (ts.length < 2) return;
      for (const x of ts) move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${ts.map(x => D(x).n).join(' and ')} were sent to the GY.`);
      const cs = [...g.p[p].deck, ...g.p[p].gy].filter(x => isMon(x) && attr(x) === 'DARK' && race(x) === 'Spellcaster' && D(x).k !== 'ritual');
      if (!cs.length || freeM(g, p) < 0 || !(yield* yn(g, p, 'Special Summon a DARK Spellcaster from your Deck or GY?'))) return;
      const [x] = yield* pick(g, p, 'Special Summon which DARK Spellcaster?', cs, 1, 1, 'good'); if (!x) return;
      const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } }] },
  // PARTIAL: the new attack is worked out by the card (miniBattle), against the original target.
  'Dark Spirit of the Silent': { effs: [{ type: 'act',
    cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p && monsOf(g, opp(p)).some(m => faceUp(m) && m !== g.aw.a)),
    target: function* (g, c, p, L2) { L2.data.a = g.aw.a; L2.data.t = g.aw.t; L2.t = [g.aw.a]; },
    res: function* (g, c, p, L2) {
      if (g.aw && g.aw.a === L2.data.a) stopAttack(g); log(g, 'The attack was negated.');
      const cs = monsOf(g, opp(p)).filter(m => faceUp(m) && m !== L2.data.a); if (!cs.length) return;
      const [n] = yield* pick(g, p, 'Which of their monsters attacks instead?', cs, 1, 1, 'bad'); if (!n) return;
      toAtk(g, n); n.attacks++; miniBattle(g, n, L2.data.t && onField(L2.data.t) ? L2.data.t : null); } }] },
  // PARTIAL: as a monster it has no Type or Attribute (the engine can't change them) and it frees its Spell/Trap Zone.
  'Embodiment of Apophis': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => mainPhase(g) && freeM(g, p) >= 0,
    res: function* (g, c, p) { if (!onField(c) || freeM(g, p) < 0) return; const i = yield* choose(g, p, 'Embodiment of Apophis: which position?', ['Attack Position', 'Defense Position']);
      if (!ss(g, p, c, i ? 'def' : 'atk')) return; c.flags.baseAtk = 1600; c.flags.lv = 4; c.flags.trapMon = true; addMod(g, c, { set: 1800, which: 'def' }); } }] },
  'Energy Drain': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which of your face-up monsters?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const n = 200 * g.p[opp(p)].hand.length; if (!n) return; addMod(g, t, { atk: n, def: n, end: true }); log(g, `${name(t)} gained ${n} ATK and DEF.`); } }] },
  'Exchange of the Spirit': { effs: [{ type: 'act',
    cond: (g, c, p) => !(g.exSpirit && g.exSpirit[p]) && g.p[0].gy.length >= 15 && g.p[1].gy.length >= 15 && g.p[p].lp > 1000,
    cost: function* (g, c, p) { pay(g, p, 1000); (g.exSpirit || (g.exSpirit = [false, false]))[p] = true; },
    res: function* (g) {
      for (const q of [0, 1]) { const P = g.p[q]; const d = P.deck, gy = P.gy; P.deck = gy; P.gy = d; for (const x of P.deck) x.zone = 'deck'; for (const x of P.gy) x.zone = 'gy'; shuffleDeck(g, q); }
      g.seq++; log(g, 'Both players swapped their Graveyard and Deck.'); } }] },
  // The call is a fair coin: right half the time.
  'Fairy Box': { effs: [
    { type: 'act', res: function* () {} },
    { type: 'quick', loc: 'st', label: 'Toss a coin',
      cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p && g.aw.fairy !== c.u),
      target: function* (g, c, p, L2) { g.aw.fairy = c.u; L2.t = [g.aw.a]; },
      res: function* (g, c, p, L2) { const a = live(L2)[0]; if (!a || !faceUp(a)) return; const call = g.rnd() < 0.5; log(g, `${PN(g, p)} called ${call ? 'Heads' : 'Tails'}.`);
        if (coin(g, p) === call) { addMod(g, a, { set: 0, which: 'atk', end: true, fairy: c.u }); log(g, `${name(a)}'s ATK became 0.`); } else log(g, 'The call was wrong.'); } },
    { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'bpEnd') for (const m of fieldMons(g)) m.mods = m.mods.filter(x => x.fairy !== c.u); return false; }, res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, label: 'Pay 500 LP or destroy this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 500 && (yield* yn(g, p, 'Pay 500 LP to keep Fairy Box?'))) pay(g, p, 500); else destroy(g, [c], { by: p }); } }] },
  // PARTIAL: the switched attack is worked out by the card (miniBattle).
  'Jam Defender': { effs: [
    { type: 'act', res: function* () {} },
    { type: 'quick', loc: 'st', label: 'Switch the attack to Revival Jam',
      cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p && g.aw.t && g.aw.t.ctrl === p && monsOf(g, p).some(m => faceUp(m) && named(m, 'Revival Jam') && m !== g.aw.t)),
      target: function* (g, c, p, L2) { L2.data.a = g.aw.a; yield* tgt(g, p, L2, 'Switch the attack to which Revival Jam?', monsOf(g, p).filter(m => faceUp(m) && named(m, 'Revival Jam') && m !== g.aw.t), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const j = live(L2)[0], a = L2.data.a; if (!j || !onField(a)) return; if (g.aw && g.aw.a === a) stopAttack(g); log(g, `The attack was switched to ${name(j)}.`); miniBattle(g, a, j); } }] },
  'Judgment of Anubis': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p, x) => spellTrapAct(x.top) && !x.top.negated && x.top.p !== p && isSpell(x.top.c) && /destroy[^.]*(Spell|Trap)/i.test(tx(x.top.c)) && g.p[p].hand.length > 0,
    cost: function* (g, c, p) { const [d] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand, 1, 1, 'cost'); if (d) { move(g, d, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${D(d).n}.`); } },
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; T.negBy = p; negate(g, T, true);
      const ms = oppFaceUp(g, p); if (!ms.length || !(yield* yn(g, p, 'Destroy a face-up monster and inflict damage equal to its ATK?'))) return;
      const [m] = yield* pick(g, p, 'Destroy which face-up monster?', ms, 1, 1, 'bad'); if (!m) return; const n = stat(g, m, 'atk');
      if (destroy(g, [m], { by: p, src: c }).length && n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  'Lightforce Sword': { effs: [
    { type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length > 0,
      res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)];
        move(g, x, 'ban', { reason: 'effect', by: p }); (g.lfs || (g.lfs = [])).push({ by: c.u, u: x.u, o, n: 0, turn: -1 }); log(g, `A random card from ${PN(g, o)}'s hand was banished face-down.`); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return the banished card',
      on: (g, ev, c) => { if (ev.type !== 'phase' || ev.ph !== 'standby' || !g.lfs) return false; let due = false;
        for (const e of g.lfs) if (e.by === c.u && e.o === ev.tp && e.turn !== g.turnNo) { e.turn = g.turnNo; e.n++; if (e.n >= 4) due = true; } return due; },
      res: function* (g, c, p) { for (const e of g.lfs.filter(e => e.by === c.u && e.n >= 4)) { const x = g.p[e.o].ban.find(y => y.u === e.u); if (x) { move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, e.o)} got the banished card back.`); } }
        g.lfs = g.lfs.filter(e => !(e.by === c.u && e.n >= 4)); } }] },
  // PARTIAL: the new battle is worked out by the card (miniBattle). Control returns at the end of the Battle Phase.
  'Magical Arm Shield': { effs: [
    { type: 'act', cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p) && monsOf(g, p).length > 0 && freeM(g, p) >= 0 && oppFaceUp(g, p).some(m => m !== g.aw.a),
      target: function* (g, c, p, L2) { L2.data.a = g.aw.a; yield* tgt(g, p, L2, 'Take control of which face-up monster?', oppFaceUp(g, p).filter(m => m !== g.aw.a), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0], a = L2.data.a; if (!t || !faceUp(t) || t.ctrl === p) return; const from = t.ctrl;
        if (!takeControl(g, p, t, false)) return; (g.mas || (g.mas = [])).push({ by: c.u, u: t.u, from });
        if (g.aw && g.aw.a === a) stopAttack(g); if (onField(a)) { log(g, `${name(t)} is attacked instead.`); miniBattle(g, a, t); } } },
    { type: 'trig', loc: 'any', mand: true, label: 'Control returns',
      on: (g, ev, c) => ev.type === 'phase' && (ev.ph === 'bpEnd' || ev.ph === 'end') && !!g.mas && g.mas.some(e => e.by === c.u),
      res: function* (g, c) { for (const e of g.mas.filter(e => e.by === c.u)) { const t = fieldMons(g).find(x => x.u === e.u); if (t && t.ctrl !== e.from) { if (freeM(g, e.from) >= 0) takeControl(g, e.from, t, false); else move(g, t, 'gy', { reason: 'rule' }); } }
        g.mas = g.mas.filter(e => e.by !== c.u); } }] },
  'Metalmorph': { effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { equipTrap(g, c, live(L2)[0], L2); } }],
    // "During damage calculation only": read in the Damage Step, when the equipped monster is the attacker.
    cont: { atk: (g, src, m) => src.equipTo !== m.u ? 0 : 300 + (g.inDS && g.battle && g.battle.a === m && g.battle.t && onField(g.battle.t) ? Math.floor(stat(g, g.battle.t, 'atk') / 2) : 0),
      def: (g, src, m) => src.equipTo === m.u ? 300 : 0 } },
  // Cards drawn while the targeted draw effect resolves (the next resolution after this one) go straight to the GY.
  'Muko': { effs: [
    { type: 'act', cond: (g, c, p, x) => !!(x.top && !x.top.negated && x.top.c !== c && /\bdraws? (\d|a card|one|two|three|cards?)\b|\bdraw until\b/i.test(tx(x.top.c)) && !/Draw Phase/i.test(tx(x.top.c).replace(/draw \d/ig, ''))),
      res: function* (g) { g.muko = { group: g.group + 1, turn: g.turnNo }; } },
    { type: 'trig', loc: 'any', on: (g, ev) => {
      if (ev.type === 'move' && ev.reason === 'draw' && g.muko && g.muko.turn === g.turnNo && ev.group === g.muko.group && ev.c.zone === 'hand') { log(g, `${PN(g, ev.c.owner)} drew ${D(ev.c).n}, and Muko sent it to the GY.`); move(g, ev.c, 'gy', { reason: 'discard' }); }
      return false; }, res: function* () {} }] },
  'Multiple Destruction': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[0].hand.length >= 3 && g.p[1].hand.length >= 3 && !(g.multiDes && g.multiDes[p] === g.turnNo),
    cost: function* (g, c, p) { (g.multiDes || (g.multiDes = [null, null]))[p] = g.turnNo; },
    res: function* (g, c, p) {
      let n = 0;
      for (const q of [g.tp, opp(g.tp)]) { const h = g.p[q].hand.slice(); for (const x of h) { move(g, x, 'deckTop', { reason: 'effect' }); const d = g.p[q].deck; d.splice(d.indexOf(x), 1); d.unshift(x); } n += h.length; if (h.length) log(g, `${PN(g, q)} put ${h.length} cards on the bottom of the Deck.`); }
      const lose = Math.max(1, n) * 300; g.p[p].lp -= lose; log(g, `${PN(g, p)} lost ${lose} LP.`);
      if (g.p[p].lp <= 0) { g.p[p].lp = 0; winDuel(g, opp(p), `${PN(g, p)} hit 0 LP`); }
      for (const q of [g.tp, opp(g.tp)]) draw(g, q, 5); } }] },
  // The Spell's effect is applied to the other player: its resolving player is swapped (its p and opp(p) trade places).
  // PARTIAL: which Spells "target 1 player" is read from the text (draws, LP, damage, discards, not "both" or "each" player).
  'Mystical Refpanel': { effs: [{ type: 'act',
    cond: (g, c, p, x) => !!(spellTrapAct(x.top) && !x.top.negated && isSpell(x.top.c) && !/both players|each player/i.test(tx(x.top.c)) && /\bdraw|Life Points|LP|damage|discard/i.test(tx(x.top.c))),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; if (!g.chain.includes(T)) return; T.p = opp(T.p); log(g, `${name(T.c)}'s effect now applies to the other player.`); } }] },
  'Rope of Life': { effs: [trapTrig({ label: 'Discard your hand: revive the monster', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && ev.wasField && isMon(ev.c) && ev.c.owner === c.ctrl,
    cond: (g, c, p, x) => g.p[p].hand.length > 0 && x.ev.c.zone === 'gy' && freeM(g, p) >= 0,
    cost: function* (g, c, p) { const h = g.p[p].hand.slice(); for (const x of h) move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${h.length} card${h.length > 1 ? 's' : ''}.`); },
    target: function* (g, c, p, L2) { L2.data.x = L2.ev.c; },
    res: function* (g, c, p, L2) { const x = L2.data.x; if (x.zone !== 'gy' || !ss(g, p, x, 'atk')) return; addMod(g, x, { atk: 800 }); log(g, `${name(x)} gained 800 ATK.`); } })] },
  // PARTIAL: "an appropriate target" isn't checked beyond being another monster you control; a switched attack is worked out by the card.
  'Shift': { effs: [{ type: 'act',
    cond: (g, c, p, x) => {
      if (x.top) return spellTrapAct(x.top) && !x.top.negated && x.top.p !== p && x.top.t && x.top.t.length === 1 && x.top.t[0].zone === 'm' && x.top.t[0].ctrl === p && monsOf(g, p).length > 1;
      return !!(g.aw && g.aw.a.ctrl !== p && g.aw.t && g.aw.t.ctrl === p && monsOf(g, p).length > 1); },
    target: function* (g, c, p, L2) {
      if (g.chain.length) { const T = g.chain[g.chain.length - 1]; L2.data.L = T; const old = T.t[0]; const fu = faceUp(old);
        const cs = monsOf(g, p).filter(m => m !== old && (!fu || faceUp(m))); yield* tgt(g, p, L2, 'Switch the target to which monster?', cs.length ? cs : monsOf(g, p).filter(m => m !== old), 1, 1, 'good'); }
      else { L2.data.a = g.aw.a; yield* tgt(g, p, L2, 'Switch the attack to which monster?', monsOf(g, p).filter(m => m !== g.aw.t), 1, 1, 'good'); } },
    res: function* (g, c, p, L2) { const n = live(L2)[0]; if (!n) return;
      if (L2.data.L) { const T = L2.data.L; if (g.chain.includes(T)) { T.t = [n]; log(g, `${name(T.c)} now targets ${n.pos === 'set' ? 'a face-down monster' : name(n)}.`); } return; }
      const a = L2.data.a; if (!onField(a)) return; if (g.aw && g.aw.a === a) stopAttack(g); log(g, 'The attack target was switched.'); miniBattle(g, a, n); } }] },
  'Skull Dice': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { const n = dice(g, p) * 100; for (const m of monsOf(g, opp(p)).filter(faceUp)) addMod(g, m, { atk: -n, def: -n, end: true }); log(g, `${PN(g, opp(p))}'s monsters lost ${n} ATK and DEF.`); } }] },
  // The cards sent since the last time it applied are counted on the card, then the damage is dealt per owner.
  'Skull Invitation': { effs: [
    { type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, label: '300 damage per card sent to the GY',
      on: (g, ev, c) => { if (!faceUp(c) || ev.type !== 'move' || ev.to !== 'gy' || ev.c === c) return false; const s = c.flags.skull || (c.flags.skull = [0, 0]); s[ev.c.owner]++; return true; },
      res: function* (g, c) { const s = c.flags.skull || [0, 0]; c.flags.skull = [0, 0];
        for (const q of [g.tp, opp(g.tp)]) if (s[q]) damage(g, q, 300 * s[q], { src: c, srcP: c.ctrl }); } }] },
  'Time Seal': { effs: [{ type: 'act', res: function* (g, c, p) { const o = opp(p), when = g.tp === o ? g.turnNo + 2 : g.turnNo + 1;
    addRule(g, (g2, a) => a.type === 'draw' && a.p === o && g2.phase === 'draw' && g2.turnNo === when, { end: when });
    log(g, `${PN(g, o)} skips the Draw Phase of their next turn.`); } }] },
  'Tornado Wall': {
    cont: { dmg: (g, src, p, n, o) => (o && o.battle && p === src.ctrl && umiUp(g) && g.battle && g.battle.a && g.battle.a.ctrl !== p) ? 0 : n },
    effs: [{ type: 'act', cond: g => umiUp(g), res: function* () {} },
      { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => faceUp(c) && ev.type === 'move' && ev.wasField && UMIS.includes(D(ev.c).n) && !umiUp(g),
        res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },

  /* ----- Spells ----- */
  'Vengeful Bog Spirit': { effs: [{ type: 'act', res: function* () {} }],
    cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && (a.c.turnIn === g.turnNo && a.c.summonType || g.events.some(e => e.type === 'summon' && e.turn === g.turnNo && e.cs.includes(a.c))) } },
  'Umi': { effs: [{ type: 'act', res: function* () {} }],
    cont: { atk: (g, src, c) => umiMod(c), def: (g, src, c) => umiMod(c) } },
  'Thousand Knives': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && named(m, 'Dark Magician')) && monsOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { if (!monsOf(g, p).some(m => faceUp(m) && named(m, 'Dark Magician'))) return; destroy(g, live(L2), { by: p, src: c }); } }] },
  'The Flute of Summoning Dragon': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => lordUp(g) && freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Dragon'),
    res: function* (g, c, p) { if (!lordUp(g)) return; const cs = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Dragon' && D(x).k !== 'ritual'); if (!cs.length) return;
      const xs = yield* pick(g, p, 'Special Summon up to 2 Dragons from your hand', cs, 1, Math.min(2, nFreeM(g, p)), 'good'); for (const x of xs) ss(g, p, x, 'atk'); } }] },
  'The Dark Door': { effs: [{ type: 'act', res: function* () {} }],
    cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && g.events.some(e => e.type === 'attack' && e.turn === g.turnNo && e.a !== a.c) } },
  // PARTIAL: 1 Trap Set this turn can be activated (the first Set Trap that is activated or leaves its Set state uses it up).
  'Temple of the Kings': { effs: [
    { type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', on: (g, ev, c) => {
      if (!faceUp(c)) return false; const T = g.temple && g.temple.turn === g.turnNo && g.temple.by === c.u ? g.temple : null;
      if (T && T.us.some(u => !allField(g).some(x => x.u === u && x.zone === 'st' && x.pos === 'set'))) { for (const u of T.us) { const x = allField(g).find(y => y.u === u && y.pos === 'set'); if (x) x.turnIn = g.turnNo; } T.us = []; T.done = true; }
      if (ev.type === 'move' && ev.to === 'st' && ev.reason === 'set' && isTrap(ev.c) && ev.c.ctrl === c.ctrl && !(T && T.done)) {
        const t2 = T || (g.temple = { turn: g.turnNo, by: c.u, us: [] }); ev.c.turnIn = g.turnNo - 1; t2.us.push(ev.c.u); }
      return false; }, res: function* () {} },
    { type: 'ign', loc: 'st', opt: true, tags: { ss: 1 }, label: 'Send Serket and this card: Special Summon',
      cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && named(m, 'Mystical Beast of Serket')) && templeTargets(g, p).length > 0,
      cost: function* (g, c, p) { const [m] = yield* pick(g, p, 'Send which Mystical Beast of Serket?', monsOf(g, p).filter(m => faceUp(m) && named(m, 'Mystical Beast of Serket')), 1, 1, 'cost'); if (m) move(g, m, 'gy', { reason: 'cost', by: p }); move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent Mystical Beast of Serket and Temple of the Kings to the GY.`); },
      res: function* (g, c, p) { const cs = templeTargets(g, p); if (!cs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon which monster?', cs, 1, 1, 'good'); if (!x) return; const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } }] },
  'Stop Defense': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, opp(p)).some(m => m.pos !== 'atk'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change which Defense Position monster to Attack Position?', monsOf(g, opp(p)).filter(m => m.pos !== 'atk'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.pos === 'atk') return;
      if (t.pos === 'set') { t.pos = 'atk'; g.seq++; log(g, `${name(t)} was flipped face-up in Attack Position.`); emit(g, { type: 'flip', c: t, p: t.ctrl }); } else toAtk(g, t); } }] },
  'Silent Doom': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => D(x).k === 'normal'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Normal Monster?', g.p[p].gy.filter(x => D(x).k === 'normal'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy') return; if (ss(g, p, t, 'def')) t.flags.cantAttack = true; } }] },
  'Roulette Spider': { effs: [{ type: 'act', cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p),
    target: function* (g, c, p, L2) { L2.data.a = g.aw.a; L2.data.t = g.aw.t; L2.t = [g.aw.a]; },
    res: function* (g, c, p, L2) {
      const a = L2.data.a; const n = dice(g, p); const o = opp(p);
      if (n === 1) { const h = Math.floor(g.p[p].lp / 2); g.p[p].lp -= h; log(g, `${PN(g, p)}'s LP were halved.`); return; }
      if (n === 6) { if (onField(a)) destroy(g, [a], { by: p, src: c }); return; }
      if (!onField(a) || a.zone !== 'm') return;
      if (n === 5) { if (g.aw && g.aw.a === a) stopAttack(g); log(g, 'The attack was negated.'); const v = stat(g, a, 'atk'); if (v > 0) damage(g, o, v, { src: c, srcP: p }); return; }
      if (n === 2) { if (g.aw && g.aw.a === a) stopAttack(g); log(g, 'The attack became a direct attack.'); miniBattle(g, a, null); return; }
      const cs = n === 3 ? monsOf(g, p) : monsOf(g, o).filter(m => m !== a);
      if (!cs.length) { log(g, 'Nothing happened.'); return; }
      const [t] = yield* pick(g, p, n === 3 ? 'Switch the attack to which of your monsters?' : 'Switch the attack to which of their monsters?', cs, 1, 1, n === 3 ? 'good' : 'bad');
      if (!t) return; if (g.aw && g.aw.a === a) stopAttack(g); log(g, 'The attack target was switched.'); miniBattle(g, a, t); } }] },
  // The effect damage of that Trap's resolution (the next one after this card) becomes 0.
  'Ring of Defense': { cont: { loc: 'gy', dmg: (g, src, p, n, o) => (!o || !o.battle) && g.ringDef && g.ringDef.turn === g.turnNo && g.ringDef.group === g.group ? 0 : n },
    effs: [{ type: 'act', cond: (g, c, p, x) => !!(x.top && !x.top.negated && isTrap(x.top.c) && burnText(x.top.c)),
      res: function* (g) { g.ringDef = { group: g.group + 1, turn: g.turnNo }; } }] },
  'Return of the Doomed': { effs: [
    { type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c && isMon(x)),
      cost: function* (g, c, p) { const [d] = yield* pick(g, p, 'Discard 1 Monster Card', g.p[p].hand.filter(x => x !== c && isMon(x)), 1, 1, 'cost'); if (d) { move(g, d, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${D(d).n}.`); } },
      res: function* (g, c, p) { (g.rotd || (g.rotd = [])).push({ by: c.u, p, turn: g.turnNo }); log(g, `${PN(g, p)} will get back a monster destroyed by battle at the end of the turn.`); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return a monster to the hand',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!g.rotd && g.rotd.some(e => e.by === c.u && e.turn === g.turnNo),
      res: function* (g, c) { for (const e of g.rotd.filter(e => e.by === c.u && e.turn === g.turnNo)) {
        const seen = new Set(); const cs = g.events.filter(v => v.type === 'move' && v.battle && v.destroyed && v.to === 'gy' && v.turn === g.turnNo && v.c.owner === e.p && v.c.zone === 'gy' && isMon(v.c)).map(v => v.c).filter(x => !seen.has(x.u) && seen.add(x.u));
        if (!cs.length) continue; const [x] = yield* pick(g, e.p, 'Return which monster to your hand?', cs, 1, 1, 'good');
        if (x && x.zone === 'gy') { move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, e.p)} returned ${D(x).n} to the hand.`); } }
        g.rotd = g.rotd.filter(e => e.by !== c.u); } }] },
  'Raigeki': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)), { by: p, src: c }); } }] },
  // A Normal Spell that stays on the field (L.keep) until the end of the opponent's second turn.
  "Nightmare's Steelcage": { cont: { forbid: (g, src, a) => a.type === 'attack' },
    effs: [{ type: 'act', res: function* (g, c, p, L2) { if (onField(c)) { L2.keep = true; c.flags.cage = 0; log(g, 'No monsters can attack.'); } } },
      { type: 'trig', loc: 'st', mand: true, label: 'Count the turn', on: (g, ev, c) => faceUp(c) && c.flags.cage != null && ev.type === 'phase' && ev.ph === 'end' && ev.tp !== c.ctrl,
        res: function* (g, c) { if (!onField(c)) return; c.flags.cage++; if (c.flags.cage >= 2) { move(g, c, 'gy', { reason: 'rule' }); log(g, "Nightmare's Steelcage left the field."); } } }] },
}, 'goat');

function umiMod(c) { const r = race(c); return ['Fish', 'Sea Serpent', 'Thunder', 'Aqua'].includes(r) ? 200 : ['Machine', 'Pyro'].includes(r) ? -200 : 0; }
function lordUp(g) { return fieldMons(g).some(m => faceUp(m) && named(m, 'Lord of D.')); }
function templeTargets(g, p) { return [...g.p[p].hand, ...g.p[p].deck].filter(x => isMon(x) && !['ritual', 'token'].includes(D(x).k)).concat(g.p[p].extra.filter(x => D(x).k === 'fusion')); }
})();
