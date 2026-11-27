/* Full pool batch 40: Indomitable Fighter Lei Lei to Magnet Circle LV2 (build/batches/full/full-40.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings.
 Kunai with Chain (classic-5.js) and Lesser Fiend (full-24.js) had Goat-only scripts; they are ported here as the shared
 version (the Goat-only ones still win under Goat). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, search, takeControl, negate, addMod,
  equip, addRule, tokens, ritualSummon, canRitual, negateAttack, name, D, isMon, isST, isSpell, isTrap, isExtraD, onField, faceUp,
  attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN,
  has, live, opp, oppFaceUp, stOnField, evSummoned, battleKill, emit, forbid, negd, num, ctr, isGemini, tributeCands } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const txt = c => D(c).ps || D(c).tx || '';
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'atk' }); };
const toAtk = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'def') return; c.pos = 'atk'; g.seq++; log(g, `${name(c)} was changed to Attack Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'def' }); };
const isSpirit = c => isMon(c) && /Spirit/.test(D(c).ab || '');
const isLS = c => /Lightsworn/.test(D(c).n);
const isFL = c => isMon(c) && /^Fortune Lady/.test(D(c).n);
const isGB = c => /Gladiator Beast/.test(D(c).n);
const isMorph = c => /Morphtronic/.test(D(c).n);
// a Normal Monster: a Normal card, or a Gemini that hasn't been Gemini Summoned (treated as Normal on the field and in the GY)
const isNormal = c => isMon(c) && (D(c).k === 'normal' || (isGemini(c) && !(onField(c) && c.flags.gemini)));
// an Effect Monster (Inverse Universe): Effect cards (Geminis only once Gemini Summoned), Fusions/Synchros/Rituals with effect text
function isEffMon(c) {
  const d = D(c), tx = d.tx || '';
  if (d.k === 'effect') return !(isGemini(c) && !c.flags.gemini);
  if (d.k === 'fusion' || d.k === 'synchro') return tx.split(/\r?\n/).filter(s => s.trim()).length > 1;
  if (d.k === 'ritual') return tx.replace(/^You can Ritual Summon this card with "[^"]+"\.\s*/i, '').replace(/^This card can only be Ritual Summoned[^.]*\.\s*/i, '').trim().length > 0;
  return d.k === 'trap';
}
// Special Summon 1 card from the listed zones
function* ssFrom(g, p, f, text, zones, pos = 'atk') {
  const cs = zones.flatMap(z => g.p[p][z]).filter(x => f(x) && canSS(g, p, x)); if (!cs.length || freeM(g, p) < 0) { if (zones.includes('deck')) shuffleDeck(g, p); return null; }
  const [x] = yield* pick(g, p, text, cs, 1, 1, 'good'); let done = false;
  if (x) { const fromDeck = x.zone === 'deck'; done = ss(g, p, x, pos); if (fromDeck) shuffleDeck(g, p); }
  return done ? x : null;
}
function randomDiscard(g, p) {
  const h = g.p[p].hand; if (!h.length) return null;
  const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${D(x).n} at random.`); return x;
}
// hand-limit discards in the End Phase aren't by a card effect (same check as full-35.js)
// a card whose text inflicts damage (Lifeforce Harmonizer); cards that might not inflict damage are left out (rulings)
const burns = c => !['Wave-Motion Cannon', 'Thestalos the Firestorm Monarch'].includes(D(c).n) && /inflicts? [^.]*damage|damage to your opponent|takes? \d+ damage/i.test(txt(c).replace(/battle damage/gi, ''));
const ruleDiscard = (g, ev) => g.phase === 'end' && !g.chain.length && !g.resolvingL && ev.c.owner === g.tp && g.p[g.tp].hand.length >= 6;
// "by an opponent's card effect": the move's own `by` when given, else the turn player (as full-26.js)
const byOpp = (g, ev, c) => ev.by != null ? ev.by !== c.owner : g.tp !== c.owner;
// Spirit return (as full-09.js): during the End Phase of the turn it was Normal Summoned or flipped face-up
const spiritReturn = { type: 'trig', mand: true, label: 'Return to the hand',
  on: (g, ev, c) => {
    if ((ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how)) || (ev.type === 'flip' && ev.c === c)) c.flags.spirit = g.turnNo;
    return ev.type === 'phase' && ev.ph === 'end' && c.flags.spirit === g.turnNo; },
  res: function* (g, c) { if (onField(c) && faceUp(c)) { c.flags.spirit = null; move(g, c, 'hand', { reason: 'effect' }); log(g, `${name(c)} returned to the hand.`); } } };
// Summon locks read from the card name. ENGINE: no general "can't be Special Summoned" flag.
const LOCKS = {
  'Izanami': (g, a) => a.type === 'ss',
  'Kinka-byo': (g, a) => a.type === 'ss',
  // only by its own rule from the hand. PARTIAL: an effect that Special Summons it from the hand is not stopped.
  'Kasha': (g, a) => a.type === 'ss' && a.c.zone !== 'hand',
  // ENGINE: no per-summon Tribute filter; the Tribute Summon is only blocked while no DARK monster could be Tributed.
  'Lich Lord, King of the Underworld': (g, a) => (a.type === 'ns' || a.type === 'set') && !tributeCands(g, a.p).some(x => faceUp(x) && attr(x) === 'DARK') && tributeCands(g, a.p).length > 0,
};
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: g => { if (!g.f40lock) { g.f40lock = true; addRule(g, (g2, a) => { if (!a.c || !['ns', 'set', 'ss'].includes(a.type)) return false; const f = LOCKS[D(a.c).n]; return !!f && f(g2, a); }); } return false; } };
const ritualAct = rn => ({ effs: [{ type: 'act', tags: { ss: 1 },
  cond: (g, c, p) => canRitual(g, p, { monster: x => named(x, rn) }),
  res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, rn) }); } }] });
// An Equip Trap (as classic-5.js): it stays on the field equipped.
function equipTrap(g, c, t, L2) { if (!onField(c) || !t || !onField(t) || !faceUp(t) || t.zone !== 'm') return false; equip(g, c, t); L2.keep = true; return true; }
/* "After a Chain with 3 or more Links resolves" (Iris, Lightning Punisher). The engine has no event for the end of a chain, so
 the card watches events emitted while a chain resolves: events inside a link's resolution (the resolving link is known), and a
 Normal Spell/Trap going to the GY after it resolved (it was the link just above the ones still waiting). Link 1 of the chain keeps
 a record of the highest link seen and the names of the links, and once a chain of 3+ with no repeated name is seen the trigger
 goes pending; pending triggers start their own chain after the whole chain has resolved.
 PARTIAL: a chain whose links make no game event is not seen; if the first event comes from a lower link, the names of the links
 above it can't be checked for repeats; the card only has to be on the field when it is seen. */
const chain3 = { type: 'trig', mand: true,
  on: (g, ev, c) => {
    const R = g.resolvingL; let top = null, k = 0;
    if (R && R.link) { top = R; k = R.link; }
    else if (g.chain.length && ev.type === 'move' && ev.reason === 'rule' && ev.from === 'st' && ev.to === 'gy' && isST(ev.c)) { k = g.chain.length + 1; top = { link: k, c: ev.c }; }
    if (!top) return false;
    const base = g.chain[0] || R; if (!base) return false; const rec = base.f40c || (base.f40c = { max: 0, names: [], fired: {} });
    for (const x of [...g.chain, top]) if (x.link && !rec.names[x.link]) rec.names[x.link] = D(x.c).n;
    rec.max = Math.max(rec.max, k);
    if (rec.max < 3 || rec.fired[c.u]) return false;
    const ns = rec.names.filter(Boolean); if (new Set(ns).size !== ns.length) return false;
    rec.fired[c.u] = true; return true; } };

E.addScripts({
  /* ----- I ----- */
  // At the end of a Battle Phase in which it attacked, it goes to Defense Position, and its position can't be changed by hand
  // until the end of its controller's next turn.
  'Indomitable Fighter Lei Lei': {
    cont: { forbid: (g, src, a) => a.type === 'pos' && a.c === src && src.flags.f40lei != null && g.turnNo <= src.flags.f40lei + 2 },
    effs: [{ type: 'trig', mand: true, label: 'Change to Defense Position',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'bpEnd' && c.ctrl === g.tp && c.attacks > 0 && c.pos === 'atk',
      res: function* (g, c) { if (onField(c) && c.pos === 'atk') { toDef(g, c); c.flags.f40lei = g.turnNo; } } }] },
  'Indomitable Gladiator Beast': { effs: [
    { type: 'act', ds: true, cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isGB(x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Gladiator Beast gains 500 ATK?', monsOf(g, p).filter(x => faceUp(x) && isGB(x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: 500, end: true }); log(g, `${name(t)} gained 500 ATK until the End Phase.`); } } },
    { type: 'ign', loc: 'gy', label: 'Shuffle 2 Gladiator Beast cards: return this card to the hand',
      cond: (g, c, p) => g.p[p].gy.filter(x => x !== c && isGB(x)).length >= 2,
      cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Shuffle which 2 Gladiator Beast cards into the Deck?', g.p[p].gy.filter(x => x !== c && isGB(x)), 2, 2, 'cost');
        for (const x of xs) move(g, x, 'deck', { reason: 'cost', by: p }); log(g, `${PN(g, p)} shuffled ${xs.map(x => D(x).n).join(' and ')} into the Deck.`); },
      res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} returned Indomitable Gladiator Beast to the hand.`); } } }] },
  'Infinity Dark': { effs: [{ type: 'trig', when: true, label: 'Change the position of a face-up monster',
    on: (g, ev, c) => ev.type === 'attack' && ev.a === c && !!c.flags.gemini,
    cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change the position of which face-up monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; if (t.pos === 'atk') toDef(g, t); else toAtk(g, t); } }] },
  // Sent from the field to the GY by a card effect (not a cost): take control of a Defense Position monster. With no free zone,
  // the target is destroyed (ruling).
  'Informer Spider': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Take control of a Defense Position monster',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy' && ev.reason === 'effect',
    cond: (g, c, p) => monsOf(g, opp(p)).some(x => x.pos !== 'atk'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which Defense Position monster?', monsOf(g, opp(p)).filter(x => x.pos !== 'atk'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.ctrl === p || t.pos === 'atk') return; if (freeM(g, p) >= 0) takeControl(g, p, t, false); else destroy(g, [t], { by: p }); } }] },
  // The turn a face-up Fortune Lady of its activator was destroyed (watched by any copy of this card). In its activator's next
  // Standby Phase it Special Summons up to 2 Fortune Ladies from the hand (its own chain link, from the GY).
  'Inherited Fortune': { effs: [
    { type: 'act', cond: (g, c, p) => !!g.f40fl && g.f40fl[p] === g.turnNo,
      res: function* (g, c, p) { (c.f40if || (c.f40if = [])).push({ p, t: g.turnNo }); log(g, `${PN(g, p)} can Special Summon Fortune Ladies in their next Standby Phase.`); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => {
      if (ev.type === 'move' && ev.wasField && ev.destroyed && ev.snap && ev.snap.faceUp && isFL(ev.c)) (g.f40fl || (g.f40fl = {}))[ev.prevCtrl] = g.turnNo;
      return false; } },
    { type: 'trig', loc: 'any', mand: true, tags: { ss: 1 }, label: 'Special Summon up to 2 Fortune Ladies',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && !!c.f40if && c.f40if.some(e => e.p === ev.tp && e.t < g.turnNo),
      res: function* (g, c, p) {
        c.f40if = (c.f40if || []).filter(e => !(e.p === p && e.t < g.turnNo));
        const n = Math.min(2, nFreeM(g, p)); const xs = g.p[p].hand.filter(x => isFL(x) && canSS(g, p, x)); if (!n || !xs.length) return;
        const pk = yield* pick(g, p, 'Special Summon up to 2 Fortune Ladies from your hand', xs, 0, n, 'good');
        for (const x of pk) if (x.zone === 'hand') ss(g, p, x, 'atk'); } }] },
  'Inmato': { effs: [{ type: 'quick', label: 'Tribute: draw 2 cards',
    cond: (g, c, p, x) => !g.inDS && !!x.top && x.top.p !== p && isST(x.top.c) && (x.top.t || []).some(t => t !== c && t.zone === 'm' && faceUp(t) && race(t) === 'Plant'),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Inmato.`); },
    res: function* (g, c, p) { draw(g, p, 2); } }] },
  // PARTIAL: the equipped Fusion never returns to the Extra Deck in the End Phase (the option is always taken).
  'Instant Neo Space': {
    cont: { forbid: (g, src, a) => a.type === 'activate' && a.eff && a.eff.type === 'trig' && a.c && src.equipTo === a.c.u && g.phase === 'end' && /Extra Deck/i.test(a.eff.label || '') },
    effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && D(m).k === 'fusion' && /"Elemental HERO Neos"/i.test(D(m).tx || '')),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which Neos Fusion Monster?', monsOf(g, p).filter(m => faceUp(m) && D(m).k === 'fusion' && /"Elemental HERO Neos"/i.test(D(m).tx || '')), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && equip(g, c, t)) c.f40eq = t.u; } },
    { type: 'trig', loc: 'any', tags: { ss: 1 }, label: 'Special Summon Elemental HERO Neos',
      on: (g, ev, c) => {
        if (ev.type !== 'move') return false;
        if (ev.c === c && ev.wasField && ev.destroyed) c.f40dead = ev.group;
        if (c.f40eq && ev.c.u === c.f40eq && ev.wasField && ev.to !== 'm') { c.f40eq = null; c.f40lost = ev.group; return true; }
        return false; },
      cond: (g, c, p, x) => c.f40dead !== (x.ev && x.ev.group) && freeM(g, p) >= 0 && ['hand', 'deck', 'gy'].some(z => g.p[p][z].some(y => named(y, 'Elemental HERO Neos'))),
      res: function* (g, c, p) { yield* ssFrom(g, p, x => named(x, 'Elemental HERO Neos'), 'Special Summon Elemental HERO Neos', ['hand', 'deck', 'gy']); } }] },
  'Intercept': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.sw && g.sw.p !== p && g.sw.how === 'tribute' && g.sw.cs.some(x => onField(x) && (x.tributes || []).length === 1),
    target: function* (g, c, p, L2) { L2.t = g.sw.cs.filter(x => onField(x)); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.ctrl !== p) takeControl(g, p, t, false); } }] },
  // Swap control of the two targets. PARTIAL: with all 10 Monster Zones full the swap can't be done.
  'Interdimensional Warp': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).length > 0 && monsOf(g, opp(p)).some(x => ctr(x, 'A') > 0),
    target: function* (g, c, p, L2) {
      const [a] = yield* pick(g, p, 'Choose a monster you control', monsOf(g, p), 1, 1, 'cost');
      const [b] = yield* pick(g, p, 'Choose an opponent\'s monster with an A-Counter', monsOf(g, opp(p)).filter(x => ctr(x, 'A') > 0), 1, 1, 'bad');
      L2.t = [a, b]; },
    res: function* (g, c, p, L2) {
      const [a, b] = L2.t; if (!a || !b || !onField(a) || !onField(b) || a.ctrl !== p || b.ctrl === p) return;
      if (freeM(g, p) >= 0) { takeControl(g, p, b, false); takeControl(g, opp(p), a, false); }
      else if (freeM(g, opp(p)) >= 0) { takeControl(g, opp(p), a, false); takeControl(g, p, b, false); }
      else log(g, 'No Monster Zone was free to switch control.'); } }] },
  // A monster that attacks it while it is in Attack Position comes under its controller's control at the end of the Battle
  // Phase. PARTIAL: it also works if Interplanetary Invader A was destroyed by that attack.
  'Interplanetary Invader A': { effs: [{ type: 'trig', loc: 'any', mand: true, label: 'Gain control of the attacker',
    on: (g, ev, c) => {
      if (ev.type === 'attack' && ev.t === c && c.zone === 'm' && c.pos === 'atk') (g.f40inv || (g.f40inv = [])).push({ c: c.u, p: c.ctrl, a: ev.a.u, turn: g.turnNo });
      return ev.type === 'phase' && ev.ph === 'bpEnd' && (g.f40inv || []).some(e => e.c === c.u && e.turn === g.turnNo); },
    res: function* (g, c) {
      const es = (g.f40inv || []).filter(e => e.c === c.u && e.turn === g.turnNo); g.f40inv = (g.f40inv || []).filter(e => !es.includes(e));
      for (const e of es) { const a = fieldMons(g).find(x => x.u === e.a); if (a && a.ctrl !== e.p) takeControl(g, e.p, a, false); } } }] },
  'Introduction to Gallantry': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length >= 5,
    res: function* (g, c, p) { randomDiscard(g, opp(p)); } }] },
  // The switched values are frozen with set modifiers while the monster stays face-up (rulings).
  'Inverse Universe': { effs: [{ type: 'act', ds: true, cond: g => fieldMons(g).some(x => faceUp(x) && isEffMon(x)),
    res: function* (g) { const ms = fieldMons(g).filter(x => faceUp(x) && isEffMon(x));
      for (const m of ms) { const A = atk(g, m), Dv = def(g, m); addMod(g, m, { set: Dv, which: 'atk' }); addMod(g, m, { set: A, which: 'def' }); }
      g.seq++; if (ms.length) log(g, 'The ATK and DEF of every face-up Effect Monster were switched.'); } }] },
  'Iris, the Earth Mother': { effs: [{ ...chain3, label: 'Draw 1 card', res: function* (g, c, p) { draw(g, p, 1); } }] },
  // ENGINE: no Type changes, so "become Plant during your turns" does nothing. The draw works.
  'Ivy Shackles': { effs: [actNoop,
    { type: 'trig', loc: 'gy', mand: true, label: 'Draw 1 card',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'st' && ev.to === 'gy' && ev.destroyed && !ev.battle && ev.snap && ev.snap.faceUp && ev.prevCtrl === c.owner && byOpp(g, ev, c),
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  // PARTIAL: while it is face-up, its controller's Spirits never return to the hand in the End Phase (the option is always taken).
  'Izanagi': {
    proc: { label: 'Special Summon (banish a Spirit from your hand)', cond: (g, c, p) => g.p[p].hand.some(x => x !== c && isSpirit(x)),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish which Spirit monster from your hand?', g.p[p].hand.filter(x => x !== c && isSpirit(x)), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } } },
    cont: { forbid: (g, src, a) => a.type === 'activate' && a.eff && a.eff.type === 'trig' && a.c && isSpirit(a.c) && a.c.ctrl === src.ctrl && g.phase === 'end' && /return/i.test(a.eff.label || '') && /hand/i.test(a.eff.label || '') } },
  'Izanami': { effs: [lockInstall, spiritReturn,
    { type: 'trig', when: true, label: 'Discard 1 card: add a Spirit from your GY',
      on: (g, ev, c) => (ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how)) || (ev.type === 'flip' && ev.c === c),
      cond: (g, c, p) => g.p[p].hand.length > 0 && g.p[p].gy.some(isSpirit),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard which card?', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${D(x).n}.`); } },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Spirit monster from your GY?', g.p[p].gy.filter(isSpirit), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} added ${D(t).n} to the hand.`); } } }] },

  /* ----- J ----- */
  'Javelin Beetle': { effs: [] },
  'Javelin Beetle Pact': ritualAct('Javelin Beetle'),
  // Any card sent from its controller's Deck to the GY while a "Lightsworn" card's effect resolves is remembered for the turn
  // (watched by any copy of this card, wherever it is).
  'Jenis, Lightsworn Mender': { effs: [
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => {
      if (ev.type === 'move' && ev.from === 'deck' && ev.to === 'gy' && ev.reason !== 'cost' && g.resolvingL && isLS(g.resolvingL.c)) (g.f40ls || (g.f40ls = {}))[ev.c.owner] = g.turnNo;
      return false; } },
    { type: 'trig', mand: true, label: 'Deal 500 damage and gain 500 LP',
      // once per End Phase: at its start if a mill already happened, else as soon as one happens during it (Lightsworn End Phase mills)
      on: (g, ev, c) => {
        if (g.phase !== 'end' || !g.f40ls || g.f40ls[c.ctrl] !== g.turnNo || c.flags.f40jen === g.turnNo) return false;
        if (!((ev.type === 'phase' && ev.ph === 'end') || ev.type === 'move')) return false;
        c.flags.f40jen = g.turnNo; return true; },
      res: function* (g, c, p) { if (damage(g, opp(p), 500, { src: c, srcP: p }) > 0) gain(g, p, 500); } }] },
  // You can only control 1. Its own Special Summon from the hand in Attack Position; if summoned that way, in the opponent's next
  // End Phase it targets a face-up monster of theirs and both go back to the hand.
  'Jester Confit': {
    cont: { forbid: (g, src, a) => ['ns', 'set', 'ss'].includes(a.type) && a.c && a.c !== src && named(a.c, 'Jester Confit') && a.p === src.ctrl },
    proc: { label: 'Special Summon in Attack Position', pos: 'atk',
      cond: (g, c, p) => !monsOf(g, p).some(x => faceUp(x) && named(x, 'Jester Confit')),
      cost: function* (g, c) { c.flags.f40jc = g.turnNo; } },
    effs: [{ type: 'trig', mand: true, label: 'Return it and a face-up monster to the hand',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp !== c.ctrl && c.flags.f40jc != null && c.flags.f40jc < g.turnNo,
      target: function* (g, c, p, L2) { c.flags.f40jc = null; if (oppFaceUp(g, p).length) yield* tgt(g, p, L2, 'Return which face-up monster to the hand?', oppFaceUp(g, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c) || !faceUp(c)) return;
        move(g, t, 'hand', { reason: 'effect', by: p }); move(g, c, 'hand', { reason: 'effect', by: p }); log(g, `${D(t).n} and Jester Confit returned to the hand.`); } }] },
  'Jester Lord': { self: { atk: (g, c) => fieldMons(g).length === 1 ? 1000 * (g.p[0].st.filter(Boolean).length + g.p[1].st.filter(Boolean).length) : 0 } },
  // ENGINE: Traps can't be activated from the hand. When it is chosen as an attack target, its controller can Set Traps from the
  // hand that can be activated during this attack; any still Set when the attack is over go back to the hand.
  'Jetroid': { effs: [
    { type: 'trig', when: true, label: 'Ready Traps from your hand',
      on: (g, ev, c) => ev.type === 'attack' && ev.t === c && ev.a.ctrl !== c.ctrl,
      cond: (g, c, p) => freeST(g, p) >= 0 && g.p[p].hand.some(isTrap),
      res: function* (g, c, p) {
        const xs = g.p[p].hand.filter(isTrap); const n = Math.min(xs.length, g.p[p].st.filter(z => !z).length); if (!n) return;
        const pk = yield* pick(g, p, 'Which Traps from your hand can be activated during this attack?', xs, 1, n, 'good');
        for (const x of pk) { if (freeST(g, p) < 0) break; move(g, x, 'st', { ctrl: p, pos: 'set', reason: 'effect', by: p }); x.turnIn = g.turnNo - 1; x.flags.f40jet = true; }
        log(g, `${PN(g, p)} readied ${pk.length} Trap Card${pk.length > 1 ? 's' : ''} from the hand.`); } },
    { type: 'trig', loc: 'any', res: noop, on: (g) => {
      if (g.aw || g.chain.length) return false;
      for (const x of allField(g)) if (x.zone === 'st' && x.pos === 'set' && x.flags.f40jet) { x.flags.f40jet = false; move(g, x, 'hand', { reason: 'rule' }); log(g, `${PN(g, x.owner)} took back a Trap not used with Jetroid.`); }
      return false; } }] },
  'Junk Barrage': { effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Junk Barrage to which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c)) equip(g, c, t); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Deal half the destroyed monster\'s ATK',
      on: (g, ev, c) => { if (!faceUp(c) || !c.equipTo) return false; const m = fieldMons(g).find(x => x.u === c.equipTo); return !!m && battleKill(ev, m); },
      res: function* (g, c, p, L2) { const t = L2.ev.c; const n = Math.floor(baseAtk(t) / 2); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  'Junk Box': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && isMorph(x) && lv(x) <= 4 && canSS(g, p, x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Morphtronic from your GY?', g.p[p].gy.filter(x => isMon(x) && isMorph(x) && lv(x) <= 4 && canSS(g, p, x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && ss(g, p, t, 'atk')) (c.f40jb || (c.f40jb = [])).push({ u: t.u, turnIn: t.turnIn, turn: g.turnNo }); } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the Morphtronic',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && (c.f40jb || []).some(e => e.turn === g.turnNo),
      res: function* (g, c, p) { const es = (c.f40jb || []).filter(e => e.turn === g.turnNo); c.f40jb = (c.f40jb || []).filter(e => e.turn !== g.turnNo);
        destroy(g, fieldMons(g).filter(m => faceUp(m) && es.some(e => e.u === m.u && e.turnIn === m.turnIn)), { by: p }); } }] },
  'Jurassic World': { cont: { atk: (g, src, m) => faceUp(m) && race(m) === 'Dinosaur' ? 300 : 0, def: (g, src, m) => faceUp(m) && race(m) === 'Dinosaur' ? 300 : 0 }, effs: [actNoop] },
  'Justi-Break': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && !!g.aw.t && g.aw.t.ctrl === p && faceUp(g.aw.t) && isNormal(g.aw.t),
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => !(m.pos === 'atk' && isNormal(m))), { by: p, src: c }); } }] },
  'Jutte Fighter': { effs: [{ type: 'ign', opt: true, label: 'Change an Attack Position monster to Defense Position',
    cond: (g, c, p) => monsOf(g, opp(p)).some(x => x.pos === 'atk'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change which Attack Position monster to Defense Position?', monsOf(g, opp(p)).filter(x => x.pos === 'atk'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) toDef(g, t); } }] },

  /* ----- K ----- */
  'Kahkki, Guerilla of Dark World': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy a monster',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'hand' && ev.to === 'gy' && ev.reason === 'discard' && !ruleDiscard(g, ev),
    cond: g => fieldMons(g).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Karma Cut': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && oppFaceUp(g, p).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard which card?', g.p[p].hand.filter(x => x !== c), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${D(x).n}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which face-up monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) {
      const t = live(L2)[0]; if (!t || !faceUp(t) || t.ctrl === p) return; const n = name(t);
      move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${n} was banished.`);
      const xs = g.p[opp(p)].gy.filter(x => D(x).n === n); for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: p });
      if (xs.length) log(g, `${xs.length} more ${n} in the GY ${xs.length > 1 ? 'were' : 'was'} banished.`); } }] },
  'Kasha': {
    proc: { label: 'Special Summon (you control 2 Zombies)', cond: (g, c, p) => monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Zombie').length >= 2 },
    effs: [lockInstall, { type: 'trig', mand: true, label: 'Shuffle every other monster into the Deck',
      on: (g, ev, c) => evSummoned(ev, c),
      res: function* (g, c) {
        const xs = fieldMons(g).filter(x => x !== c); let n = 0;
        for (const x of xs) { if (!onField(x)) continue; if (faceUp(x) && D(x).r === 'Zombie') n++; move(g, x, 'deck', { reason: 'effect', by: c.ctrl }); }
        if (xs.length) log(g, `${xs.length} monster${xs.length > 1 ? 's were' : ' was'} shuffled into the Deck.`);
        if (onField(c) && faceUp(c)) { c.flags.baseAtk = 1000 * n; g.seq++; log(g, `Kasha's ATK became ${1000 * n}.`); } } }] },
  'Kid Guard': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && monsOf(g, p).some(x => faceUp(x) && named(x, 'Hero Kid')),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which Hero Kid?', monsOf(g, p).filter(x => faceUp(x) && named(x, 'Hero Kid')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Hero Kid.`); } },
    res: function* (g, c, p) { if (g.aw) negateAttack(g); yield* search(g, p, x => isMon(x) && /^Elemental HERO/.test(D(x).n), 'Add which Elemental HERO monster?'); } }] },
  // PARTIAL: no window during damage calculation; the 2000 applies through the whole Damage Step of a battle with a Warrior.
  'Kinetic Soldier (Cipher Soldier)': { self: {
    atk: (g, c) => { const b = g.battle; if (!g.inDS || !b || !b.t || (b.a !== c && b.t !== c)) return 0; const o = b.a === c ? b.t : b.a; return onField(o) && race(o) === 'Warrior' ? 2000 : 0; },
    def: (g, c) => { const b = g.battle; if (!g.inDS || !b || !b.t || (b.a !== c && b.t !== c)) return 0; const o = b.a === c ? b.t : b.a; return onField(o) && race(o) === 'Warrior' ? 2000 : 0; } } },
  "King's Knight": { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: "Special Summon Jack's Knight",
    on: (g, ev, c) => evSummoned(ev, c, ['normal']) && monsOf(g, c.ctrl).some(x => faceUp(x) && named(x, "Queen's Knight")),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => named(x, "Jack's Knight")),
    res: function* (g, c, p) { yield* ssFrom(g, p, x => named(x, "Jack's Knight"), "Special Summon Jack's Knight", ['deck']); } }] },
  'Kinka-byo': { effs: [lockInstall, spiritReturn,
    { type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon a Level 1 monster from your GY',
      on: (g, ev, c) => (ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how)) || (ev.type === 'flip' && ev.c === c),
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && lv(x) === 1 && canSS(g, p, x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Level 1 monster from your GY?', g.p[p].gy.filter(x => isMon(x) && lv(x) === 1 && canSS(g, p, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && ss(g, p, t, 'atk') && onField(c) && faceUp(c)) c.flags.f40kinka = t.u; } },
    { type: 'trig', loc: 'any', mand: true, label: 'Banish the summoned monster',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && !!ev.snap && !!ev.snap.flags && !!ev.snap.flags.f40kinka && fieldMons(g).some(m => m.u === ev.snap.flags.f40kinka),
      res: function* (g, c, p, L2) { const m = fieldMons(g).find(x => x.u === L2.ev.snap.flags.f40kinka); if (m) { move(g, m, 'ban', { reason: 'effect' }); log(g, `${D(m).n} was banished.`); } } }] },
  'Knight of the Red Lotus': {
    proc: { label: 'Special Summon (banish 2 Normal Monsters from your GY)', cond: (g, c, p) => g.p[p].gy.filter(isNormal).length === 3,
      cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Banish which 2 Normal Monsters from your GY?', g.p[p].gy.filter(isNormal), 2, 2, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${xs.map(x => D(x).n).join(' and ')}.`); } },
    effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Special Summon a Level 4 or lower Normal Monster from your GY',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isNormal(x) && lv(x) <= 4 && canSS(g, p, x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Normal Monster from your GY?', g.p[p].gy.filter(x => isNormal(x) && lv(x) <= 4 && canSS(g, p, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  // An Equip Trap (port of classic-5.js): change the attacker to Defense Position, equip for 500 ATK, or both.
  'Kunai with Chain': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 500 : 0 },
    effs: [{ type: 'act',
      cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p && g.aw.a.pos === 'atk') || monsOf(g, p).some(faceUp),
      target: function* (g, c, p, L2) {
        const canA = !!(g.aw && g.aw.a.ctrl !== p && g.aw.a.pos === 'atk'), canE = monsOf(g, p).some(faceUp);
        const modes = []; if (canA) modes.push('a'); if (canE) modes.push('e'); if (canA && canE) modes.push('ae');
        const lab = { a: 'Change the attacker to Defense Position', e: 'Equip to your monster (+500 ATK)', ae: 'Both' };
        const i = modes.length > 1 ? yield* choose(g, p, 'Kunai with Chain: which effect?', modes.map(m => lab[m])) : 0;
        L2.data.mode = modes[i]; if (L2.data.mode.includes('a')) L2.data.a = g.aw.a;
        if (L2.data.mode.includes('e')) { const [m] = yield* pick(g, p, 'Equip to which of your face-up monsters?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); L2.data.e = m; }
        L2.t = [L2.data.a, L2.data.e].filter(Boolean); },
      res: function* (g, c, p, L2) { if (L2.data.a && onField(L2.data.a)) toDef(g, L2.data.a); if (L2.data.e) equipTrap(g, c, L2.data.e, L2); } }] },
  // Control changes make no event: the change is noticed at the next game event. PARTIAL: the discard can come a little late.
  'Kunoichi': { effs: [{ type: 'trig', mand: true, label: 'Its new controller discards 1 random card',
    on: (g, ev, c) => { if (!faceUp(c)) return false; const prev = c.flags.f40ctrl; c.flags.f40ctrl = c.ctrl; return prev != null && prev !== c.ctrl; },
    res: function* (g, c, p) { randomDiscard(g, p); } }] },
  // PARTIAL: no window during damage calculation; it is used in the Damage Step window just before it. Kuribon goes back to
  // the hand, so the battle ends with no damage (the ruling's "destroyed by battle" isn't kept).
  'Kuribon': { effs: [{ type: 'quick', ds: true, label: 'Return to the hand: the attacker\'s controller gains LP',
    cond: (g, c, p) => g.inDS && !!g.battle && g.battle.t === c && g.battle.a.ctrl !== p && onField(g.battle.a) && !g.chain.some(x => x.c === c),
    res: function* (g, c, p) { const a = g.battle && g.battle.a; if (!onField(c) || !a || !onField(a)) return; gain(g, a.ctrl, atk(g, a)); move(g, c, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} returned Kuribon to the hand.`); } }] },

  /* ----- L ----- */
  // After a Counter Trap resolves (it goes to the GY), 2 banished Fairies come back to the hand.
  // PARTIAL: done as a trigger with its own chain link, and a negated Counter Trap counts too.
  'Layard the Liberator': { effs: [{ type: 'trig', mand: true, label: 'Add 2 banished Fairies to the hand',
    on: (g, ev) => ev.type === 'move' && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && isTrap(ev.c) && D(ev.c).sub === 'Counter',
    cond: (g, c, p) => g.p[p].ban.filter(x => isMon(x) && race(x) === 'Fairy').length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which 2 banished Fairies to your hand?', g.p[p].ban.filter(x => isMon(x) && race(x) === 'Fairy'), 2, 2, 'good'); },
    res: function* (g, c, p, L2) { for (const x of L2.t) if (x.zone === 'ban') { move(g, x, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} added ${D(x).n} to the hand.`); } } }] },
  // Port of full-24.js: a monster it destroys by battle is marked after damage calculation so it is banished.
  'Lesser Fiend (Archfiend)': { effs: [{ type: 'trig', res: noop, on: (g, ev, c) => {
    if (ev.type === 'afterCalc' && (ev.a === c || ev.t === c)) { const o = ev.a === c ? ev.t : ev.a; if (o && onField(o) && o.flags.battleDoomed) { o.flags.banishOnLeave = true; o.flags.f40lf = true; } }
    if (ev.type === 'dsEnd' && (ev.a === c || ev.t === c)) for (const o of [ev.a, ev.t]) if (o && o !== c && onField(o) && o.flags.f40lf) { o.flags.banishOnLeave = false; o.flags.f40lf = false; }
    return false; } }] },
  // Tributed by a card effect (a cost, a Ritual Tribute, an effect's Tribute; not a Tribute Summon or Synchro): back to the hand.
  'Lich Lord, King of the Underworld': { effs: [lockInstall, { type: 'trig', loc: 'gy', mand: true, label: 'Add it to the hand',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && ((ev.reason === 'ritual') || (ev.wasField && (ev.reason === 'cost' || (ev.reason === 'tribute' && ev.tributeFor == null)))),
    res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} added Lich Lord, King of the Underworld to the hand.`); } } }] },
  'Life Equalizer': { effs: [{ type: 'act', cond: g => Math.abs(g.p[0].lp - g.p[1].lp) >= 8000,
    res: function* (g) { g.p[0].lp = 3000; g.p[1].lp = 3000; log(g, 'Both players\' LP became 3000.'); } }] },
  // Answers an opponent's activation whose text inflicts damage on the other player (read from the card's text).
  'Lifeforce Harmonizer': { effs: [{ type: 'quick', loc: 'hand', label: 'Discard: negate the damage effect',
    cond: (g, c, p, x) => !!x.top && x.top.p !== p && !x.top.negated && burns(x.top.c),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded Lifeforce Harmonizer.`); },
    res: function* (g, c, p) { const top = g.chain[g.chain.length - 1]; if (!top || top.p === p) return; top.negBy = p; negate(g, top, true); } }] },
  'Lightning Punisher': { effs: [{ ...chain3, tags: { destroy: 1 }, label: 'Destroy 1 card your opponent controls',
    cond: (g, c, p) => fieldOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Lightsworn Barrier': { effs: [actNoop,
    { type: 'quick', loc: 'st', label: 'Send the top 2 cards: negate the attack',
      // once per attack: it answers the attack being targeted, so it can't be chained to itself again and again
      cond: (g, c, p) => !!g.aw && !!g.aw.t && g.aw.t.ctrl === p && isLS(g.aw.t) && g.aw.a.ctrl !== p && g.p[p].deck.length >= 2 && !(g.aw.f40lb || []).includes(c.u),
      cost: function* (g, c, p) { g.aw.f40lb = (g.aw.f40lb || []).concat(c.u); const xs = g.p[p].deck.slice(-2).reverse(); for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${xs.map(x => D(x).n).join(', ')} from the Deck to the GY.`); },
      target: function* (g, c, p, L2) { L2.t = [g.aw.a]; },
      res: function* (g, c, p, L2) { const a = L2.t[0]; if (g.aw && g.aw.a === a && onField(a)) negateAttack(g); } }] },
  'Lightsworn Sabre': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 700 : 0 },
    effs: [{ type: 'act', cond: g => fieldMons(g).some(m => faceUp(m) && isLS(m)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which Lightsworn monster?', fieldMons(g).filter(m => faceUp(m) && isLS(m)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && isLS(t) && onField(c)) equip(g, c, t); } },
    { type: 'trig', loc: 'gy', when: true, label: 'Equip it to a Lightsworn monster',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'deck' && ev.to === 'gy' && ev.reason !== 'cost',
      cond: (g, c, p) => freeST(g, p) >= 0 && monsOf(g, p).some(m => faceUp(m) && isLS(m)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Lightsworn Sabre to which Lightsworn monster?', monsOf(g, p).filter(m => faceUp(m) && isLS(m)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || c.zone !== 'gy' || freeST(g, p) < 0) return;
        move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'effect', by: p }); if (!equip(g, c, t)) move(g, c, 'gy', { reason: 'rule' }); } }] },
  // ENGINE: a card can't be made a Tuner (synCombos reads the printed Tuner flag), so this only logs the choice.
  'Lightwave Tuning': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && lv(m) === 4 && attr(m) === 'LIGHT'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Level 4 LIGHT monster becomes a Tuner?', monsOf(g, p).filter(m => faceUp(m) && lv(m) === 4 && attr(m) === 'LIGHT'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { t.flags.f40tuner = true; log(g, `${name(t)} is treated as a Tuner.`); } } }] },
  // PARTIAL: the Tokens can be Tributed for anything (the engine's no-Tribute flag would also stop Tribute Summons).
  'Limit Impulse': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.p[p].hand.filter(x => x !== c).length >= 2,
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Send which 2 cards from your hand to the GY?', g.p[p].hand.filter(x => x !== c), 2, 2, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${xs.map(x => D(x).n).join(' and ')} to the GY.`); },
    res: function* (g, c, p) { if (nFreeM(g, p) < 2) { log(g, 'Not enough Monster Zones for the Soul Tokens.'); return; } tokens(g, p, { n: 'Soul Token', a: 'DARK', r: 'Fiend', lv: 1, atk: 0, def: 0 }, 2, 'atk'); } }] },
  // Linked to its monster (if either leaves the field the other is destroyed); a change to Defense Position destroys both.
  'Limit Reverse': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && baseAtk(x) <= 1000 && canSS(g, p, x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which monster with 1000 or less ATK?', g.p[p].gy.filter(x => isMon(x) && baseAtk(x) <= 1000 && canSS(g, p, x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && onField(c) && ss(g, p, t, 'atk')) L.link(g, c, t); } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy it and Limit Reverse',
      on: (g, ev, c) => ev.type === 'pos' && !!c.linkTo && ev.c.u === c.linkTo && ev.c.pos !== 'atk',
      res: function* (g, c, p) { const t = fieldMons(g).find(x => x.u === c.linkTo); destroy(g, [t, c].filter(Boolean), { by: p }); } }] },
  // PARTIAL: by the listed text it has no effect when activated; it can be activated just to send itself to the GY.
  'Limiter Overload': { effs: [actNoop,
    { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon Speed Warrior',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy',
      cond: (g, c, p) => freeM(g, p) >= 0 && ['hand', 'deck', 'gy'].some(z => g.p[p][z].some(x => named(x, 'Speed Warrior'))),
      res: function* (g, c, p) { yield* ssFrom(g, p, x => named(x, 'Speed Warrior'), 'Special Summon Speed Warrior', ['hand', 'deck', 'gy']); } }] },
  'Lineage of Destruction': { effs: [
    { type: 'act', cond: (g, c, p) => !!g.f40lin && g.f40lin[p] === g.turnNo && monsOf(g, p).some(m => faceUp(m) && lv(m) === 8 && !(m.flags.extraAttack === g.turnNo)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Level 8 monster can attack twice?', monsOf(g, p).filter(m => faceUp(m) && lv(m) === 8 && !(m.flags.extraAttack === g.turnNo)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { t.flags.extraAttack = g.turnNo; log(g, `${name(t)} can attack twice this turn.`); } } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => {
      if (ev.type === 'move' && ev.wasField && ev.destroyed && ev.snap && ev.snap.mon && ev.snap.pos !== 'atk') {
        const who = ev.battle ? (ev.killer ? ev.killer.ctrl : null) : ev.by; if (who != null && who !== ev.prevCtrl) (g.f40lin || (g.f40lin = {}))[who] = g.turnNo; }
      return false; } }] },
  'Linear Accelerator Cannon': { effs: [{ type: 'act', tags: {},
    cond: (g, c, p) => monsOf(g, p).length > 0 && !allCards(g, 'gy').concat(allField(g), g.p[p].hand, g.p[p].deck, g.p[p].ban).some(x => x !== c && x.owner === p && isSpell(x) && Object.keys(x.used || {}).some(k => x.used[k] === g.turnNo && (L.effsOf(x)[+k] || {}).type === 'act')),
    cost: function* (g, c, p, L2) {
      addRule(g, (g2, a) => a.type === 'activate' && a.p === p && a.c && a.c !== c && isSpell(a.c) && a.eff && a.eff.type === 'act', { end: g.turnNo });
      const [x] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p), 1, 1, 'cost'); if (!x) return;
      L2.data.n = D(x).k === 'trap' ? 0 : x.flags.tokAtk != null ? x.flags.tokAtk : baseAtk(x);
      const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); },
    res: function* (g, c, p, L2) { const n = Math.floor((L2.data.n || 0) / 2); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  'Lycanthrope': { effs: [{ type: 'trig', mand: true, label: 'Deal 200 damage for each Normal Monster in your GY',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    res: function* (g, c, p) { const n = 200 * g.p[p].gy.filter(isNormal).length; if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },

  /* ----- M ----- */
  'Magicat': { effs: [{ type: 'trig', loc: 'gy', label: 'Return a Spell from your GY to the top of the Deck',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && ev.reason === 'synchro',
    cond: (g, c, p) => { const s = g.sw && g.sw.how === 'synchro' ? g.sw.cs[0] : monsOf(g, p).find(x => x.summonType === 'synchro' && x.turnIn === g.turnNo); return !!s && race(s) === 'Spellcaster' && g.p[p].gy.some(isSpell); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which Spell to the top of your Deck?', g.p[p].gy.filter(isSpell), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'deckTop', { reason: 'effect', by: p }); log(g, `${PN(g, p)} placed ${D(t).n} on top of the Deck.`); } } }] },
  'Magician of Black Chaos': { effs: [] },   // Ritual Summoned with Black Magic Ritual (full-02.js)
  "Magician's Valkyria": { cont: { grant: (g, src, c, flag) => flag === 'noAttackTarget' && c !== src && c.zone === 'm' && c.ctrl === src.ctrl && faceUp(c) && race(c) === 'Spellcaster' && !negd(g, src) } },
  'Magicians Unite': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).filter(m => m.pos === 'atk' && race(m) === 'Spellcaster').length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Spellcaster becomes 3000 ATK?', monsOf(g, p).filter(m => m.pos === 'atk' && race(m) === 'Spellcaster'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) {
      const t = live(L2)[0]; const keep = t ? t.u : null;
      if (t && faceUp(t)) { addMod(g, t, { set: 3000, which: 'atk', end: true }); log(g, `${name(t)}'s ATK became 3000 this turn.`); }
      addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.ctrl === p && a.c.u !== keep && race(a.c) === 'Spellcaster', { end: g.turnNo }); } }] },
  'Magna Drago': { effs: [{ type: 'trig', mand: true, label: 'Gain 200 ATK',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 200 }); log(g, `${name(c)} gained 200 ATK.`); } } }] },
  'Magna-Slash Dragon': { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Send a Continuous Spell: destroy a Spell/Trap',
    cond: (g, c, p) => g.p[p].st.some(x => x && faceUp(x) && isSpell(x) && D(x).sub === 'Continuous') && stOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which face-up Continuous Spell to the GY?', g.p[p].st.filter(x => x && faceUp(x) && isSpell(x) && D(x).sub === 'Continuous'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell or Trap Card?', stOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Magnet Circle LV2': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Machine' && lv(x) <= 2 && canSS(g, p, x) && !isExtraD(D(x)) && D(x).k !== 'ritual'),
    res: function* (g, c, p) { yield* ssFrom(g, p, x => race(x) === 'Machine' && lv(x) <= 2 && D(x).k !== 'ritual', 'Special Summon which Level 2 or lower Machine?', ['hand']); } }] },
});
})();
