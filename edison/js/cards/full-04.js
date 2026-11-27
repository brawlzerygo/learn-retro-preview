/* Full pool 04: Chaos Emperor Dragon, Cocoon, Contract, Crimson, Curse, Cyber and D.D. cards.
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts (Edison text and rulings);
 Goat keeps its own goat-only scripts where one exists (classic-*.js, goat-*.js), which win while Goat is loaded. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, takeControl, negate, addMod,
  negateAttack, addRule, ritualSummon, canRitual, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv,
  baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, live, opp,
  oppFaceUp, stOnField, spellTrapAct, evSummoned, emit, forbid, stat, num, isExtraD } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const ownOrCtrl = c => onField(c) ? c.ctrl : c.owner;
// cards of the zones a player can see in a duel
const everyCard = g => { const out = []; for (const P of g.p) for (const z of ['hand', 'deck', 'gy', 'ban', 'extra']) out.push(...P[z]); out.push(...allField(g)); return out; };
// a Normal Spell/Trap that is face-up on the field is the one resolving right now (Attack Reflector Unit, Photon Generator Unit)
const resolving = (g, p, n) => stOf(g, p).some(x => faceUp(x) && named(x, n));
// "Cannot be Normal Summoned/Set" and "Cannot be Special Summoned except ...". The engine reads "Cannot be Normal Summoned"
// from the ps line, which here says "No Edison-Accurate PSCT", so these locks are one duel-long rule, installed by the
// first event any of these cards sees (a trig that never fires).
const LOCKS = {
  // must first be Special Summoned from the hand by its own rule; once properly summoned it can be revived (c.f04nomi)
  // PARTIAL: an effect that Special Summons it from the hand is not stopped.
  'Chaos Emperor Dragon - Envoy of the End': (g, a) => a.type !== 'ss' || ['deck', 'extra'].includes(a.c.zone) || (['gy', 'ban'].includes(a.c.zone) && !a.c.f04nomi),
  'Cyber Barrier Dragon': (g, a) => a.type !== 'ss' || !resolving(g, a.p, 'Attack Reflector Unit'),
  'Cyber Laser Dragon': (g, a) => a.type !== 'ss' || !resolving(g, a.p, 'Photon Generator Unit'),
  // only by its own rule, never from the GY or banished. PARTIAL: an effect that Special Summons it from the hand is not stopped.
  'Cyber Eltanin': (g, a) => a.type !== 'ss' || a.c.zone !== 'hand',
};
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: (g) => { if (!g.f04lock) { g.f04lock = true; addRule(g, (g2, a) => { if (!a.c || !['ns', 'set', 'ss'].includes(a.type)) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); } return false; } };
// Cyber Kirin, Cocoon Veil (no effect damage this turn) and Crimson Fire (reflect it). damage() only reads statics, so each of
// these cards carries the same hook as a GY static (it is in the GY once used). One answer per damage call.
// PARTIAL: if every such card leaves the GY that turn, the effect stops.
const dmgHook = (g, src, p, n, o) => {
  if (o.battle) return undefined;
  const k = `${g.seq}|${p}|${n}`; if (o._f04 && o._f04.k === k) return o._f04.r;
  let r;
  const z = g.f04zero || {};
  if (z[p] === g.turnNo) { log(g, `${PN(g, p)} took no effect damage.`); r = 0; }
  else {
    const cf = (g.f04crimson || []).find(e => e.p === p && e.turn === g.turnNo && !g.chain.includes(e.L) && (o.src ? o.src.u === e.u : onField(e.c)));
    if (cf) { o._f04 = { k, r: 0 }; log(g, `Crimson Fire turned the damage back on ${PN(g, opp(p))}.`); damage(g, opp(p), 2 * n, { src: cf.fire, srcP: p }); r = 0; }
  }
  o._f04 = { k, r }; return r;
};
// Effect Monsters (Curse of Anubis): Effect, Flip, Union and the rest, Fusions and Synchros with text after the materials,
// Rituals with text past their summon line, and Trap Monsters
function isEffMon(c) {
  const d = D(c), tx = d.tx || '';
  if (d.k === 'trap') return true;
  if (d.k === 'effect') return true;
  if (d.k === 'fusion' || d.k === 'synchro') return tx.split(/\r?\n/).filter(s => s.trim()).length > 1;
  if (d.k === 'ritual') return tx.replace(/^You can Ritual Summon this card with "[^"]+"\.\s*/i, '').replace(/^This card can only be Ritual Summoned[^.]*\.\s*/i, '').trim().length > 0;
  return false;
}
const ritualEffs = rn => [{ type: 'act', tags: { ss: 1 },
  cond: (g, c, p) => canRitual(g, p, { monster: x => named(x, rn) }),
  res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, rn) }); } }];
// "Cyber Dragon" for the Cyber Fusions here: Proto-Cyber Dragon on the field, Cyber Dragon Zwei in the GY or after its effect.
// ENGINE: name() can't be changed by a script, so other cards that ask for "Cyber Dragon" don't see Zwei or Proto.
const cyberDragon = x => named(x, 'Cyber Dragon') || name(x) === 'Cyber Dragon' || (named(x, 'Proto-Cyber Dragon') && onField(x)) || (named(x, 'Cyber Dragon Zwei') && (x.zone === 'gy' || (onField(x) && !!x.flags.f04zwei)));
const isChrysalis = x => isMon(x) && /^Chrysalis/.test(D(x).n);
const nsOf = x => { const m = (D(x).tx || '').match(/"(Neo-Spacian [^"]+)"/); return m ? m[1] : null; };
// Neo-Spacian names in a GY (Marine Dolphin and Twinkle Moss also carry the names of Aqua Dolphin and Glow Moss)
function nsNames(g, p) {
  const s = new Set();
  for (const x of g.p[p].gy) if (isMon(x) && /^Neo-Spacian/.test(D(x).n)) { s.add(D(x).n); if (named(x, 'Neo-Spacian Marine Dolphin')) s.add('Neo-Spacian Aqua Dolphin'); if (named(x, 'Neo-Spacian Twinkle Moss')) s.add('Neo-Spacian Glow Moss'); }
  return s;
}
const equipCards = g => allField(g).filter(x => x.zone === 'st' && faceUp(x) && x.equipTo && fieldMons(g).some(m => m.u === x.equipTo));
const noSSText = c => /Cannot be Special Summoned|Must be Special Summoned|Cannot be Normal Summoned/i.test(D(c).tx || '');
const mustFusionText = c => /Must be Fusion Summoned|Cannot be Special Summoned/i.test(D(c).tx || '');
const steinTargets = (g, p) => g.p[p].extra.filter(f => D(f).k === 'fusion' && !mustFusionText(f) && !forbid(g, { type: 'ss', c: f, p, how: 'special' }));
// has this player activated a card or effect this turn? (every activation stamps c.used with the turn number)
const actedThisTurn = (g, p) => everyCard(g).some(c => ownOrCtrl(c) === p && c.used && Object.values(c.used).includes(g.turnNo));
// Trap Monsters (same as batch-7.js): the card moves to a Monster Zone and gets its monster stats.
// PARTIAL: its Attribute and Type stay blank (ENGINE: attr()/race() can't be set by a script), and its Spell & Trap Zone isn't held.
function trapMonster(g, c, p, st) {
  if (!onField(c) || freeM(g, p) < 0) return false;
  if (!ss(g, p, c, 'def')) return false;
  c.flags.baseAtk = st.atk; c.flags.lv = st.lv; c.flags.trapMon = true; addMod(g, c, { set: st.def, which: 'def' });
  return true;
}
function toBottom(g, x) { move(g, x, 'deckTop', { reason: 'effect' }); const d = g.p[x.owner].deck; const i = d.indexOf(x); if (i >= 0) { d.splice(i, 1); d.unshift(x); } }

E.addScripts({
  /* ----- Chaos Emperor Dragon ----- */
  // Counts every card sent to either GY (Edison rulings: it counts itself and both players' cards; the 2005 text said the same,
  // "for each card sent to the Graveyard", so one script serves both formats). Tokens vanish and don't count.
  'Chaos Emperor Dragon - Envoy of the End': {
    proc: { label: 'Special Summon (banish a LIGHT and a DARK)',
      cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'LIGHT') && g.p[p].gy.some(x => isMon(x) && attr(x) === 'DARK'),
      cost: function* (g, c, p, grp) {
        const [l] = yield* pick(g, p, 'Banish a LIGHT monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT'), 1, 1, 'cost');
        const [d] = yield* pick(g, p, 'Banish a DARK monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK'), 1, 1, 'cost');
        for (const x of [l, d]) if (x) move(g, x, 'ban', { reason: 'cost', group: grp });
        log(g, `${PN(g, p)} banished ${[l, d].filter(Boolean).map(name).join(' and ')}.`); c.flags.f04proc = true; } },
    effs: [lockInstall,
      { type: 'trig', on: (g, ev, c) => { if (ev.type === 'summon' && ev.cs.includes(c) && c.flags.f04proc) c.f04nomi = true; return false; }, res: noop },
      { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Pay 1000: send all hands and the field to the GY',
        cond: (g, c, p) => g.p[p].lp > 1000 && !actedThisTurn(g, p),
        cost: function* (g, c, p) { pay(g, p, 1000); },
        after: (g, c, p) => { addRule(g, (g2, a) => a.type === 'activate' && a.p === p, { end: g.turnNo }); log(g, `${PN(g, p)} can't activate other cards or effects this turn.`); },
        res: function* (g, c, p) {
          const all = [...g.p[0].hand, ...g.p[1].hand, ...allField(g)]; const grp = g.group; let n = 0;
          for (const x of all) { if (x.zone === 'gone') continue; move(g, x, 'gy', { reason: 'effect', by: p, group: grp, noLater: true }); }
          for (const x of all) if (x.zone === 'gy') n++;
          log(g, `${n} card${n === 1 ? ' was' : 's were'} sent to the GY.`);
          if (n) damage(g, opp(p), 300 * n, { src: c, srcP: p }); } }] },

  /* ----- Cocoon ----- */
  // Port of classic-2.js: the equip sets Petit Moth's ATK/DEF to Cocoon's 0/2000 and counts turns for Larvae Moth.
  'Cocoon of Evolution': {
    cont: { atk: (g, src, m) => src.flags.cocoon && src.equipTo === m.u ? -baseAtk(m) : 0, def: (g, src, m) => src.flags.cocoon && src.equipTo === m.u ? 2000 - num(D(m).def) : 0 },
    effs: [{ type: 'ign', loc: 'hand', label: 'Equip to Petit Moth',
      cond: (g, c, p) => freeST(g, p) >= 0 && monsOf(g, p).some(m => faceUp(m) && named(m, 'Petit Moth')),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which Petit Moth?', monsOf(g, p).filter(m => faceUp(m) && named(m, 'Petit Moth')), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || c.zone !== 'hand' || freeST(g, p) < 0) return;
        move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p }); c.equipTo = t.u; c.flags.cocoon = true; c.flags.cocoonTurns = 0; g.seq++; log(g, `Cocoon of Evolution was equipped to ${name(t)}.`); } },
      { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.flags.cocoon) c.flags.cocoonTurns = (c.flags.cocoonTurns || 0) + 1; return false; }, res: noop }] },
  'Cocoon Party': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => { const n = nsNames(g, p).size; return n > 0 && nFreeM(g, p) >= n && g.p[p].deck.filter(isChrysalis).length >= n; },
    res: function* (g, c, p) {
      const n = Math.min(nsNames(g, p).size, nFreeM(g, p)); const cands = g.p[p].deck.filter(isChrysalis); if (!n || !cands.length) return;
      const xs = yield* pick(g, p, `Special Summon ${n} Chrysalis monster${n > 1 ? 's' : ''} from your Deck`, cands, Math.min(n, cands.length), Math.min(n, cands.length), 'good');
      for (const x of xs) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  // Continuous Spell: the Tribute is the cost, any number of times (ruling: used like an Ignition Effect)
  'Cocoon Rebirth': { effs: [{ type: 'act', res: noop },
    { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Tribute a Chrysalis: summon its Neo-Spacian',
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isChrysalis(x) && nsOf(x) && allCards(g, 'gy').some(y => named(y, nsOf(x)) && !forbid(g, { type: 'ss', c: y, p, how: 'special' }))),
      cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Tribute which Chrysalis monster?', monsOf(g, p).filter(x => faceUp(x) && isChrysalis(x) && nsOf(x) && allCards(g, 'gy').some(y => named(y, nsOf(x)))), 1, 1, 'cost');
        L2.data.ns = nsOf(x); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
      res: function* (g, c, p, L2) { const cands = allCards(g, 'gy').filter(y => named(y, L2.data.ns)); if (!cands.length || freeM(g, p) < 0) return;
        const [x] = yield* pick(g, p, `Special Summon ${L2.data.ns} from either GY`, cands, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  // The Tribute is part of the effect (ruling), the damage lock and the Special Summon are separate parts.
  'Cocoon Veil': { cont: { loc: 'gy', dmg: dmgHook },
    effs: [{ type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isChrysalis(x) && nsOf(x) && [...g.p[p].hand, ...g.p[p].deck, ...allCards(g, 'gy')].some(y => named(y, nsOf(x)) && !forbid(g, { type: 'ss', c: y, p, how: 'special' }))),
      res: function* (g, c, p) {
        const ms = monsOf(g, p).filter(x => faceUp(x) && isChrysalis(x) && nsOf(x)); if (!ms.length) return;
        const [x] = yield* pick(g, p, 'Tribute which Chrysalis monster?', ms, 1, 1, 'cost'); if (!x) return;
        const ns = nsOf(x); move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`);
        g.f04zero = g.f04zero || {}; g.f04zero[0] = g.f04zero[1] = g.turnNo; log(g, 'Effect damage to either player is 0 this turn.');
        const cands = [...g.p[p].hand, ...g.p[p].deck, ...allCards(g, 'gy')].filter(y => named(y, ns)); if (!cands.length || freeM(g, p) < 0) return;
        const [y] = yield* pick(g, p, `Special Summon ${ns} from your hand, Deck or either GY`, cands, 1, 1, 'good');
        if (y) { const fromDeck = y.zone === 'deck'; ss(g, p, y, 'atk'); if (fromDeck) shuffleDeck(g, p); } } }] },

  /* ----- Contracts ----- */
  'Contract with Exodia': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => ['Exodia the Forbidden One', 'Right Arm of the Forbidden One', 'Left Arm of the Forbidden One', 'Right Leg of the Forbidden One', 'Left Leg of the Forbidden One'].every(n => g.p[p].gy.some(x => named(x, n))) && freeM(g, p) >= 0 && g.p[p].hand.some(x => named(x, 'Exodia Necross')),
    res: function* (g, c, p) { const xs = g.p[p].hand.filter(x => named(x, 'Exodia Necross')); if (!xs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon Exodia Necross', xs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  'Contract with the Abyss': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => canRitual(g, p, { monster: x => attr(x) === 'DARK', exact: true }),
    res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => attr(x) === 'DARK', exact: true }); } }] },
  'Contract with the Dark Master': { effs: ritualEffs('Dark Master - Zorc') },
  'Curse of the Masked Beast': { effs: ritualEffs('The Masked Beast') },

  /* ----- Crimson ----- */
  // Counter Trap. PARTIAL: "would inflict damage to you" is read from the card's text (it mentions damage).
  'Crimson Fire': { cont: { loc: 'gy', dmg: dmgHook },
    effs: [{ type: 'act',
      cond: (g, c, p, x) => spellTrapAct(x.top) && !x.top.negated && x.top.p !== p && /damage/i.test(D(x.top.c).tx || '') && monsOf(g, p).some(m => faceUp(m) && name(m) === 'Red Dragon Archfiend'),
      target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { const T = L2.data.L; if (!T) return; g.f04crimson = (g.f04crimson || []).filter(e => e.turn === g.turnNo); g.f04crimson.push({ p, u: T.c.u, c: T.c, L: T, turn: g.turnNo, fire: c }); log(g, `${PN(g, opp(p))} will take the damage from ${name(T.c)} twice over.`); } }] },
  'Crimson Ninja': { effs: [{ type: 'trig', mand: true, faceDownOk: true, tags: { destroy: 1 }, label: 'Destroy a Trap', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    target: function* (g, c, p, L2) { const cs = stOnField(g).filter(x => x.pos === 'set' || isTrap(x)); if (cs.length) yield* tgt(g, p, L2, 'Destroy which Trap (a Set card is revealed)?', cs, 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return;
      if (t.pos === 'set') { log(g, `The Set card was ${D(t).n}.`); if (isTrap(t)) destroy(g, [t], { by: p }); }
      else if (isTrap(t)) destroy(g, [t], { by: p }); } }] },
  // Returns a monster of yours destroyed by battle this turn to the bottom of the Deck. Used before the battle (ruling),
  // it returns the next one destroyed this turn.
  'Crimson Sentry': { effs: [
    { type: 'ign', label: 'Tribute: return a battle-destroyed monster',
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Crimson Sentry.`); },
      res: function* (g, c, p) { const cs = g.p[p].gy.filter(x => isMon(x) && x.f04bk === g.turnNo);
        if (!cs.length) { c.f04pend = g.turnNo; log(g, 'The next monster of theirs destroyed by battle this turn goes to the bottom of the Deck.'); return; }
        const [x] = yield* pick(g, p, 'Return which monster to the bottom of your Deck?', cs, 1, 1, 'good'); if (x) { toBottom(g, x); log(g, `${D(x).n} went to the bottom of the Deck.`); } } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return the destroyed monster',
      on: (g, ev, c) => {
        if (ev.type !== 'move' || !ev.battle || !ev.destroyed || ev.to !== 'gy') return false;
        ev.c.f04bk = g.turnNo;
        if (c.f04pend === g.turnNo && ev.c.owner === c.owner && isMon(ev.c)) { c.f04pend = null; c.f04pendT = ev.c; return true; }
        return false; },
      res: function* (g, c) { const x = c.f04pendT; c.f04pendT = null; if (x && x.zone === 'gy') { toBottom(g, x); log(g, `${D(x).n} went to the bottom of the Deck.`); } } }] },

  /* ----- Curses ----- */
  'Curse of Aging': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    res: function* (g, c, p) { const ms = oppFaceUp(g, p); for (const m of ms) addMod(g, m, { atk: -500, def: -500, end: true }); if (ms.length) log(g, `${PN(g, opp(p))}'s face-up monsters lost 500 ATK and DEF.`); } }] },
  'Curse of Anubis': { effs: [{ type: 'act',
    res: function* (g, c, p) {
      const ms = fieldMons(g).filter(m => faceUp(m) && isEffMon(m)); if (!ms.length) return;
      for (const m of ms) { if (m.pos === 'atk') { m.pos = 'def'; g.seq++; emit(g, { type: 'pos', c: m, p: m.ctrl }); } addMod(g, m, { def: -num(D(m).def), end: true }); }
      const us = new Set(ms.map(m => m.u)); addRule(g, (g2, a) => a.type === 'pos' && a.c && us.has(a.c.u), { end: g.turnNo });
      log(g, 'Every face-up Effect Monster is in Defense Position with 0 original DEF this turn.'); } }] },
  // The 1000 damage comes right after the Spell is activated, with no chain (Edison rulings). Seen through the Spell's own
  // move: activated from the hand it moves to the field; a Set Spell is caught when it leaves the field after resolving.
  // PARTIAL: a Set Continuous, Equip or Field Spell flipped face-up isn't seen (it makes no event).
  'Curse of Darkness': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
      if (ev.type !== 'move' || !isSpell(ev.c) || ev.c === c) return false;
      g.f04cod = g.f04cod || {};
      let who = null;
      if (ev.reason === 'activate' && ev.from === 'hand') { if (g.f04cod[ev.c.u] === ev.seq) return false; g.f04cod[ev.c.u] = 'act'; who = ev.c.ctrl; }
      else if (ev.reason === 'rule' && ev.wasField && ev.to === 'gy' && ev.snap && ev.snap.faceUp) { if (g.f04cod[ev.c.u] === 'act') { delete g.f04cod[ev.c.u]; return false; } who = ev.prevCtrl; }
      if (who == null || g.f04codSeq === ev.seq) return false;
      g.f04codSeq = ev.seq; log(g, 'Curse of Darkness inflicts 1000 damage.'); damage(g, who, 1000, { src: c, srcP: c.ctrl });
      return false; } }] },
  // Port of classic-4.js. Edison ruling: it is Set first and flipped face-up during your Standby Phase.
  'Curse of Fiend': { effs: [{ type: 'trig', loc: 'any', label: 'Activate Curse of Fiend',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && c.zone === 'st' && c.pos === 'set' && ev.tp === c.ctrl,
    cond: (g, c, p) => c.zone === 'st' && c.pos === 'set' && fieldMons(g).length > 0,
    cost: function* (g, c, p) { c.pos = 'up'; g.seq++; log(g, `${PN(g, p)} flipped up Curse of Fiend.`); },
    res: function* (g, c, p) {
      const changed = [];
      for (const m of fieldMons(g)) {
        if (m.pos === 'atk') { m.pos = 'def'; changed.push(m); }
        else if (m.pos === 'def') { m.pos = 'atk'; changed.push(m); }
        else if (m.pos === 'set') { m.pos = 'atk'; changed.push(m); log(g, `The face-down monster was ${name(m)}.`); emit(g, { type: 'flip', c: m, p: m.ctrl }); }
      }
      g.seq++; if (changed.length) log(g, 'Every monster switched its battle position.');
      const us = new Set(changed.map(m => m.u)); addRule(g, (g2, a) => a.type === 'pos' && a.c && us.has(a.c.u), { end: g.turnNo });
      if (onField(c)) move(g, c, 'gy', { reason: 'rule' }); } }] },
  // Counter Trap against a Spell/Trap that destroys exactly 1 Spell/Trap: it targets one (MST, Dust Tornado) or negates one
  // and destroys it (Magic Jammer, Seven Tools, Solemn, Curse of Royal). Heavy Storm and Feather Duster don't qualify.
  'Curse of Royal': { effs: [{ type: 'act',
    cond: (g, c, p, x) => { const T = x.top; if (!spellTrapAct(T) || T.negated) return false;
      if (T.tags && T.tags.destroy && T.t.length === 1 && isST(T.t[0]) && onField(T.t[0])) return true;
      const below = g.chain[g.chain.length - 2]; return /negate the activation/i.test(D(T.c).tx || '') && /destroy it/i.test(D(T.c).tx || '') && spellTrapAct(below); },
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },

  /* ----- Cyber ----- */
  'Cyber Archfiend': { effs: [
    { type: 'trig', mand: true, label: 'Draw 1 more card',
      on: (g, ev, c) => { if (ev.type === 'move' && ev.reason === 'draw' && ev.phase === 'draw' && g.tp === c.ctrl && ev.c.owner === c.ctrl && c.flags.f04arch !== g.turnNo && g.p[c.ctrl].hand.length === 1) { c.flags.f04arch = g.turnNo; return true; } return false; },
      res: function* (g, c, p) { draw(g, p, 1); } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      cond: (g, c, p) => g.p[p].hand.length > 0,
      res: function* (g, c, p) { if (onField(c) && faceUp(c) && g.p[p].hand.length > 0) destroy(g, [c], { by: p }); } }] },
  // Mandatory: the first attack the opponent declares each turn while this card is in Attack Position is negated.
  'Cyber Barrier Dragon': { effs: [lockInstall,
    { type: 'trig', mand: true, label: 'Negate the attack',
      on: (g, ev, c) => { if (ev.type === 'attack' && ev.a.ctrl !== c.ctrl && c.pos === 'atk' && c.flags.f04cbd !== g.turnNo && g.f04cbdSeq !== ev.seq) { c.flags.f04cbd = g.turnNo; g.f04cbdSeq = ev.seq; return true; } return false; },
      res: function* (g, c, p, L2) { if (g.aw && g.aw.a === L2.ev.a) { negateAttack(g); log(g, 'Cyber Barrier Dragon negated the attack.'); } } }] },
  // PARTIAL: with exactly 3 opponent's monsters only their Effect Monsters' effects are negated (ENGINE: no negation hook for
  // Spell/Trap activations or Continuous Spell/Trap effects).
  'Cyber Blader': {
    self: {
      noBattleDestroy: (g, c) => monsOf(g, opp(c.ctrl)).length === 1,
      atk: (g, c) => { if (c._f04g || monsOf(g, opp(c.ctrl)).length !== 2) return 0; c._f04g = true; try { return stat(g, c, 'atk'); } finally { c._f04g = false; } } },
    cont: { negates: (g, src, c) => c.ctrl !== src.ctrl && c.zone === 'm' && monsOf(g, opp(src.ctrl)).length === 3 },
    effs: [] },
  'Cyber Dinosaur': { effs: [{ type: 'trig', loc: 'hand', when: true, tags: { ss: 1 }, label: 'Special Summon this card',
    on: (g, ev, c) => ev.type === 'summon' && ev.p !== c.owner && !g.inDS && !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how)
      && ev.cs.some(x => g.events.some(e => e.type === 'move' && e.c === x && e.to === 'm' && e.from === 'hand' && e.group === ev.group)),
    cond: (g, c, p) => freeM(g, p) >= 0 && !g.inDS,
    ok: (g, c, p) => !g.chain.some(L2 => L2.p === p && named(L2.c, 'Cyber Dinosaur')),
    res: function* (g, c, p) { if (c.zone === 'hand') ss(g, p, c, 'atk'); } }] },
  // ENGINE: its name can't really change (name() is fixed), so only this file's Cyber Fusions read it as "Cyber Dragon".
  'Cyber Dragon Zwei': {
    self: { atk: (g, c) => g.inDS && g.battle && g.battle.a === c && g.battle.t ? 300 : 0 },
    effs: [{ type: 'ign', opt: true, label: 'Reveal a Spell: become Cyber Dragon', cond: (g, c, p) => g.p[p].hand.some(isSpell) && !c.flags.f04zwei,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Reveal which Spell?', g.p[p].hand.filter(isSpell), 1, 1, 'cost'); if (x) log(g, `${PN(g, p)} revealed ${name(x)}.`); },
      res: function* (g, c) { if (onField(c) && faceUp(c)) { c.flags.f04zwei = true; g.seq++; log(g, 'Cyber Dragon Zwei is treated as Cyber Dragon until the End Phase.'); } } },
      { type: 'trig', on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'end' && c.flags.f04zwei) c.flags.f04zwei = false; return false; }, res: noop }] },
  'Cyber Eltanin': {
    proc: { label: 'Special Summon (banish all LIGHT Machines)',
      cond: (g, c, p) => [...monsOf(g, p).filter(faceUp), ...g.p[p].gy].some(x => isMon(x) && attr(x) === 'LIGHT' && race(x) === 'Machine' || (onField(x) && D(x).k === 'token' && attr(x) === 'LIGHT' && race(x) === 'Machine')),
      cost: function* (g, c, p, grp) {
        const xs = [...monsOf(g, p).filter(faceUp), ...g.p[p].gy].filter(x => (isMon(x) || D(x).k === 'token') && attr(x) === 'LIGHT' && race(x) === 'Machine');
        for (const x of xs) move(g, x, 'ban', { reason: 'cost', group: grp });
        c.flags.f04elt = 500 * xs.length; log(g, `${PN(g, p)} banished ${xs.length} LIGHT Machine monster${xs.length === 1 ? '' : 's'}.`); } },
    self: { atk: (g, c) => c.flags.f04elt || 0, def: (g, c) => c.flags.f04elt || 0 },
    effs: [lockInstall,
      { type: 'trig', mand: true, label: 'Send all other face-up monsters to the GY', on: (g, ev, c) => evSummoned(ev, c) && ev.how !== 'normal',
        cond: (g, c) => fieldMons(g).some(x => x !== c && faceUp(x)),
        res: function* (g, c, p) { const xs = fieldMons(g).filter(x => x !== c && faceUp(x)); const grp = g.group; for (const x of xs) move(g, x, 'gy', { reason: 'effect', by: p, group: grp }); if (xs.length) log(g, `${xs.map(x => D(x).n).join(', ')} ${xs.length > 1 ? 'were' : 'was'} sent to the GY.`); } }] },
  'Cyber End Dragon': { mats: [cyberDragon, cyberDragon, cyberDragon], self: { piercing: true }, effs: [] },
  // Shown in the log, so its controller sees every card the opponent draws while it is in Attack Position.
  'Cyber Esper': { effs: [{ type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.reason === 'draw' && ev.c.owner !== c.ctrl && c.pos === 'atk') log(g, `Cyber Esper: ${PN(g, ev.c.owner)} drew ${D(ev.c).n}.`); return false; } }] },
  'Cyber Gymnast': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Discard: destroy an Attack Position monster',
    cond: (g, c, p) => g.p[p].hand.length > 0 && monsOf(g, opp(p)).some(x => x.pos === 'atk'),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Attack Position monster?', monsOf(g, opp(p)).filter(x => x.pos === 'atk'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2).filter(x => x.pos === 'atk'), { by: p }); } }] },
  // ENGINE: "This card's name is always treated as Harpie Lady" needs a name() override (classic-2.js's Harpie list knows it).
  'Cyber Harpie Lady': { effs: [] },
  // Port of goat-2.js. The turn player Special Summons first (Edison ruling).
  'Cyber Jar': { effs: [{ type: 'trig', mand: true, faceDownOk: true, tags: { destroy: 1, ss: 1 }, label: 'Destroy all monsters', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) {
      destroy(g, fieldMons(g), { by: p });
      const tops = {};
      for (const q of [g.tp, opp(g.tp)]) { tops[q] = g.p[q].deck.slice(-5).reverse(); if (tops[q].length) log(g, `${PN(g, q)} revealed ${tops[q].map(name).join(', ')}.`); }
      for (const q of [g.tp, opp(g.tp)]) for (const x of tops[q]) {
        if (x.zone !== 'deck') continue;
        if (isMon(x) && lv(x) <= 4 && !['ritual', 'token'].includes(D(x).k) && !isExtraD(D(x)) && !noSSText(x) && freeM(g, q) >= 0 && !forbid(g, { type: 'ss', c: x, p: q, how: 'special' })) {
          const i = yield* choose(g, q, `${name(x)}: which position?`, ['Face-up Attack Position', 'Face-down Defense Position']);
          if (ss(g, q, x, i ? 'set' : 'atk')) continue;
        }
        move(g, x, 'hand', { reason: 'effect' });
      } } }] },
  'Cyber Kirin': { cont: { loc: 'gy', dmg: dmgHook },
    effs: [{ type: 'ign', label: 'Tribute: no effect damage this turn',
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Cyber Kirin.`); },
      res: function* (g, c, p) { g.f04zero = g.f04zero || {}; g.f04zero[p] = g.turnNo; log(g, `Effect damage to ${PN(g, p)} is 0 this turn.`); } }] },
  'Cyber Laser Dragon': { effs: [lockInstall,
    { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy a monster with ATK or DEF at least this ATK',
      cond: (g, c, p) => fieldMons(g).some(x => faceUp(x) && (atk(g, x) >= atk(g, c) || def(g, x) >= atk(g, c))),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g).filter(x => faceUp(x) && (atk(g, x) >= atk(g, c) || def(g, x) >= atk(g, c))), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c) || !faceUp(c)) return; if (atk(g, t) >= atk(g, c) || def(g, t) >= atk(g, c)) destroy(g, [t], { by: p }); } }] },
  // Discarded at the attack declaration: the attack is negated and the Cyber Ogre gains 2000 until the end of its next battle.
  // PARTIAL: not during the Damage Step (the engine can only negate an attack in the declaration window).
  'Cyber Ogre': {
    self: { atk: (g, c) => c.flags.f04ogre ? 2000 : 0 },
    effs: [{ type: 'quick', loc: 'hand', label: 'Discard: negate the battle, +2000 ATK',
      cond: (g, c, p) => g.aw && !g.inDS && [g.aw.a, g.aw.t].some(x => x && x.ctrl === p && onField(x) && faceUp(x) && named(x, 'Cyber Ogre')),
      cost: function* (g, c, p, L2) { L2.data.m = [g.aw.a, g.aw.t].find(x => x && x.ctrl === p && onField(x) && faceUp(x) && named(x, 'Cyber Ogre')); move(g, c, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded Cyber Ogre.`); },
      res: function* (g, c, p, L2) { if (g.aw) negateAttack(g); const m = L2.data.m; if (m && onField(m) && faceUp(m)) { m.flags.f04ogre = true; m.flags.f04ogreSeq = g.seq; g.seq++; log(g, 'Cyber Ogre gains 2000 ATK until the end of its next battle.'); } } },
      { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'dsEnd' && (ev.a === c || ev.t === c) && c.flags.f04ogre) { c.flags.f04ogre = false; g.seq++; } return false; } }] },
  // PARTIAL: the half ATK is added for the whole Damage Step it attacks in (the engine has no damage calculation window).
  'Cyber Ogre 2': {
    self: { atk: (g, c) => g.inDS && g.battle && g.battle.a === c && g.battle.t && onField(g.battle.t) && faceUp(g.battle.t) ? Math.floor(atk(g, g.battle.t) / 2) : 0 }, effs: [] },
  'Cyber Ouroboros': { effs: [{ type: 'trig', loc: 'ban', when: true, label: 'Send a card from your hand: draw 1',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'ban',
    cond: (g, c, p) => g.p[p].hand.length > 0 && g.p[p].deck.length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which card from your hand to the GY?', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); } },
    res: function* (g, c, p) { draw(g, p, 1); } }] },
  // PARTIAL: the negation of a Spell/Trap that targets exactly 1 of your Machines is an optional Spell Speed 3 response
  // (ENGINE: no automatic negation hook, same as Ryu Senshi in build/ENGINE_TODO.md).
  'Cyber Phoenix': { effs: [
    { type: 'quick', speed: 3, ds: true, label: 'Negate the Spell/Trap targeting your Machine',
      cond: (g, c, p, x) => c.pos === 'atk' && spellTrapAct(x.top) && !x.top.negated && x.top.t.length === 1 && onField(x.top.t[0]) && x.top.t[0].zone === 'm' && x.top.t[0].ctrl === p && race(x.top.t[0]) === 'Machine',
      target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { if (!onField(c) || c.pos !== 'atk') return; L2.data.L.negBy = p; negate(g, L2.data.L, false); } },
    { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'attack' && (ev.a === c || ev.t === c)) c.flags.f04phx = g.turnNo; return false; } },
    { type: 'trig', loc: 'gy', when: true, label: 'Draw 1 card',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy' && ev.snap && ev.snap.flags && ev.snap.flags.f04phx === g.turnNo,
      cond: (g, c, p) => g.p[p].deck.length > 0,
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  'Cyber Prima': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy all face-up Spells', on: (g, ev, c) => evSummoned(ev, c, ['tribute']),
    cond: (g) => stOnField(g).some(x => faceUp(x) && isSpell(x)),
    res: function* (g, c, p) { destroy(g, stOnField(g).filter(x => faceUp(x) && isSpell(x)), { by: p }); } }] },
  // Port of classic-2.js. PARTIAL: an Equip Card that can't legally equip to it (Premature Burial) isn't filtered out.
  'Cyber Raider': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy or take an Equip Card', on: (g, ev, c) => ev.type === 'summon' && ev.cs.includes(c),
    cond: g => equipCards(g).length > 0,
    target: function* (g, c, p, L2) {
      const i = freeST(g, p) >= 0 && equipCards(g).some(x => x.equipTo !== c.u) ? yield* choose(g, p, 'Cyber Raider: which effect?', ['Destroy an Equip Card', 'Equip an Equip Card to this card']) : 0; L2.data.take = i === 1;
      const es = equipCards(g).filter(x => !L2.data.take || x.equipTo !== c.u);
      yield* tgt(g, p, L2, L2.data.take ? 'Equip which Equip Card to Cyber Raider?' : 'Destroy which Equip Card?', es.length ? es : equipCards(g), 1, 1, L2.data.take ? 'good' : 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.zone !== 'st') return;
      if (!L2.data.take) { destroy(g, [t], { by: p, src: c }); return; }
      if (!onField(c) || !faceUp(c) || c.zone !== 'm' || (t.ctrl !== p && freeST(g, p) < 0)) return;
      if (t.ctrl !== p) move(g, t, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p });
      t.equipTo = c.u; g.seq++; log(g, `${name(t)} was equipped to Cyber Raider.`); } }] },
  'Cyber Saurus': { effs: [] },
  'Cyber Shadow Gardna': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.tp !== p && ['main1', 'main2'].includes(g.phase) && freeM(g, p) >= 0 && !g.inDS,
      res: function* (g, c, p) { if (trapMonster(g, c, p, { atk: 0, def: 0, lv: 4 })) log(g, 'Cyber Shadow Gardna became a monster.'); } },
    // the copy can't be chained to: applied as the attack is declared
    { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'attack' && ev.t === c && ev.a.ctrl !== c.ctrl && c.flags.trapMon && onField(ev.a)) { addMod(g, c, { set: atk(g, ev.a), which: 'atk' }); addMod(g, c, { set: def(g, ev.a), which: 'def' }); g.seq++; log(g, `Cyber Shadow Gardna became ${atk(g, c)} ATK and ${def(g, c)} DEF.`); } return false; } },
    { type: 'trig', mand: true, opt: true, label: 'Set this card again', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp !== c.ctrl && c.flags.trapMon,
      res: function* (g, c, p) { if (c.zone !== 'm' || freeST(g, p) < 0) return; move(g, c, 'st', { ctrl: p, pos: 'set', reason: 'set' }); log(g, 'Cyber Shadow Gardna was Set in the Spell & Trap Zone.'); } }] },
  'Cyber Shark': { self: { tributes: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && attr(x) === 'WATER') ? [0] : [] }, effs: [] },
  'Cyber Summon Blaster': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', mand: true, label: '300 damage', on: (g, ev, c) => ev.type === 'summon' && !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how) && ev.cs.some(x => race(x) === 'Machine'),
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) damage(g, opp(p), 300, { src: c, srcP: p }); } }] },
  'Cyber Tutu': { self: { directAttack: (g, c) => { const ms = monsOf(g, opp(c.ctrl)); return ms.length > 0 && ms.every(x => faceUp(x) && atk(g, x) > atk(g, c)); } }, effs: [] },
  'Cyber Twin Dragon': { mats: [cyberDragon, cyberDragon], self: { maxAttacks: () => 2 }, effs: [] },
  // Port of goat-6.js
  'Cyber-Stein': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Pay 5000: summon a Fusion',
    cond: (g, c, p) => g.p[p].lp > 5000 && freeM(g, p) >= 0 && steinTargets(g, p).length > 0,
    cost: function* (g, c, p) { pay(g, p, 5000); },
    res: function* (g, c, p) { const fs = steinTargets(g, p); if (!fs.length || freeM(g, p) < 0) return; const [f] = yield* pick(g, p, 'Special Summon which Fusion Monster?', fs, 1, 1, 'good'); if (f) ss(g, p, f, 'atk'); } }] },

  /* ----- D.D. ----- */
  // Port of goat-4.js
  'D.D. Assailant': { effs: [{ type: 'trig', loc: 'any', mand: true, label: 'Banish both monsters',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.wasField && !!ev.killer && ev.killer.ctrl !== ev.prevCtrl,
    res: function* (g, c, p, L2) { const k = L2.ev.killer;
      if (k && onField(k)) { move(g, k, 'ban', { reason: 'effect', by: p }); log(g, `${D(k).n} was banished.`); }
      if (c.zone === 'gy') { move(g, c, 'ban', { reason: 'effect', by: p }); log(g, 'D.D. Assailant was banished.'); } } }] },
  // PARTIAL: "can't conduct the Battle Phase" removes the Battle Phase option when an event shows the condition, and
  // attacks are forbidden as a fallback (a Set D.D. Borderline flipped up makes no event).
  'D.D. Borderline': {
    cont: { forbid: (g, src, a) => a.type === 'attack' && !g.p[src.ctrl].gy.some(isSpell) },
    effs: [{ type: 'act', res: noop },
      { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
        if (!['main1', 'main2'].includes(g.phase)) return false;
        const lock = !g.p[c.ctrl].gy.some(isSpell);
        if (lock && !g.noBP[g.tp]) { g.noBP[g.tp] = true; g.f04bord = g.turnNo; }
        else if (!lock && g.f04bord === g.turnNo) { g.noBP[g.tp] = false; g.f04bord = null; }
        return false; } }] },
  // The monster it destroys by battle is banished instead of going to the GY (not when both are destroyed, ruling).
  'D.D. Crazy Beast': {
    cont: { replaceDestroy: (g, src, v, o) => {
      if (!o.battle || o.killer !== src || !onField(src) || src.flags.battleDoomed || !onField(v)) return false;
      move(g, v, 'ban', { reason: 'battle', destroyed: true, battle: true, killer: src, noLater: true }); log(g, `${D(v).n} was destroyed by battle and banished.`); return true; } },
    effs: [] },
  // PARTIAL: the name is declared from the cards in this duel (as Mind Crush in batch-1.js).
  'D.D. Designator': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c),
    target: function* (g, c, p, L2) { const o = opp(p); const names = [...new Set([...g.p[o].hand, ...g.p[o].deck, ...g.p[o].gy, ...g.p[o].ban, ...g.p[o].extra, ...fieldOf(g, o)].filter(x => D(x).k !== 'token').map(x => D(x).n))].sort();
      if (!names.length) return; const i = yield* choose(g, p, 'Declare a card name', names); L2.data.n = names[i]; log(g, `${PN(g, p)} declared ${names[i]}.`); },
    res: function* (g, c, p, L2) { const o = opp(p), n = L2.data.n; log(g, `${PN(g, p)} looked at ${PN(g, o)}'s hand.`);
      const x = n && g.p[o].hand.find(y => D(y).n === n);
      if (x) { move(g, x, 'ban', { reason: 'effect', by: p }); log(g, `${n} was banished from ${PN(g, o)}'s hand.`); return; }
      const h = g.p[p].hand; if (!h.length) return; const y = h[Math.floor(g.rnd() * h.length)]; move(g, y, 'ban', { reason: 'effect', by: p }); log(g, `${n || 'The card'} wasn't there, so ${PN(g, p)} banished ${name(y)} at random.`); } }] },
  'D.D. Dynamite': { effs: [{ type: 'act',
    res: function* (g, c, p) { const n = g.p[opp(p)].ban.length; if (n) damage(g, opp(p), 300 * n, { src: c, srcP: p }); else log(g, `${PN(g, opp(p))} has no banished cards.`); } }] },
  'D.D. Guide': { effs: [
    { type: 'trig', mand: true, label: 'Give control to the opponent', on: (g, ev, c) => evSummoned(ev, c, ['normal']),
      res: function* (g, c, p) { if (!onField(c) || c.ctrl !== p) return; if (freeM(g, opp(p)) < 0) { destroy(g, [c], { by: p }); return; } takeControl(g, opp(p), c, false); } },
    { type: 'trig', mand: true, label: 'Opponent banishes a card from your GY', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end',
      cond: (g, c, p) => g.p[p].gy.length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, opp(p), L2, `Banish which card from ${PN(g, p)}'s GY?`, g.p[p].gy, 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished.`); } } }] },
  // Its owner Special Summons it (ruling); with no free zone it is destroyed and sent to the GY.
  'D.D. Scout Plane': { effs: [{ type: 'trig', loc: 'ban', mand: true, opt: true, tags: { ss: 1 }, label: 'Return from banishment',
    on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.to === 'ban' && !ev.faceDown) c.flags.f04scout = g.turnNo; return ev.type === 'phase' && ev.ph === 'end' && c.flags.f04scout === g.turnNo; },
    res: function* (g, c) { if (c.zone !== 'ban') return; if (freeM(g, c.owner) < 0 || !ss(g, c.owner, c, 'atk')) { move(g, c, 'gy', { reason: 'effect', destroyed: true }); log(g, 'D.D. Scout Plane had nowhere to go and was sent to the GY.'); } } }] },
  // Port of goat-6.js. Banished during the End Phase, it comes back in the next turn's End Phase (Edison ruling).
  'D.D. Survivor': { effs: [{ type: 'trig', loc: 'ban', mand: true, opt: true, tags: { ss: 1 }, label: 'Return from banishment',
    on: (g, ev, c) => {
      if (ev.type === 'move' && ev.c === c && ev.to === 'ban' && ev.wasField && ev.snap && ev.snap.faceUp && ev.prevCtrl === c.owner) c.flags.ddsurv = g.phase === 'end' ? g.turnNo + 1 : g.turnNo;
      return ev.type === 'phase' && ev.ph === 'end' && c.flags.ddsurv === g.turnNo; },
    cond: (g, c) => freeM(g, c.owner) >= 0,
    res: function* (g, c) { if (c.zone === 'ban') ss(g, c.owner, c, 'atk'); } }] },
  // ENGINE: no response window after a Set (build/ENGINE_TODO.md), so it is offered as an optional trigger while Set.
  'D.D. Trap Hole': { effs: [{ type: 'trig', loc: 'any', speed: 2, tags: { destroy: 1 }, label: 'Activate D.D. Trap Hole',
    on: (g, ev, c) => {
      if (c.zone !== 'st' || c.pos !== 'set' || c.turnIn === g.turnNo || g.inDS) return false;
      let t = null;
      if (ev.type === 'set' && ev.p !== c.ctrl) t = ev.c;
      else if (ev.type === 'summon' && ev.p !== c.ctrl && ev.cs.length === 1 && ev.cs[0].pos === 'set') t = ev.cs[0];
      if (!t) return false; c.flags.f04ddth = t.u; return true; },
    cond: (g, c, p) => c.zone === 'st' && c.pos === 'set' && monsOf(g, p).length > 0 && fieldMons(g).some(x => x.u === c.flags.f04ddth && x.pos === 'set'),
    cost: function* (g, c, p) { c.pos = 'up'; g.seq++; },
    target: function* (g, c, p, L2) { const s = fieldMons(g).find(x => x.u === c.flags.f04ddth); yield* tgt(g, p, L2, 'Destroy and banish which of your monsters?', monsOf(g, p), 1, 1, 'cost'); L2.t = [s, ...L2.t].filter(Boolean); },
    res: function* (g, c, p, L2) { const [s, m] = L2.t;
      if (s && m && onField(s) && onField(m) && s.pos === 'set' && s.ctrl !== p && m.ctrl === p) destroy(g, [s, m], { by: p, banish: true, src: c });
      if (onField(c)) move(g, c, 'gy', { reason: 'rule' }); } }] },
  // Edison only here (Goat's is in classic-2.js)
  'D.D. Warrior': { effs: [{ type: 'trig', mand: true, label: 'Banish both monsters', on: (g, ev, c) => ev.type === 'afterCalc' && ev.t && (ev.a === c || ev.t === c),
    res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; const bs = [o, c].filter(x => x && onField(x) && x.zone === 'm');
      for (const x of bs) { x.flags.battleDoomed = false; move(g, x, 'ban', { reason: 'effect', by: p }); } if (bs.length) log(g, `${bs.map(x => D(x).n).join(' and ')} ${bs.length > 1 ? 'were' : 'was'} banished.`); } }] },
});
})();
