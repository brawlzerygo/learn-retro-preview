/* Full pool batch 03 (build/batches/full/full-03.md): Black Luster Soldier to Chaos-End Master.
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts (Edison text and rulings);
 cards that also have a goat-only script keep it in Goat. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, setFaceDown, negate, addMod,
  equip, equippedTo, addCtr, ctr, negateAttack, addRule, fusionSummon, canFusion,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, allCards, shuffleDeck, log, PN, has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned,
  battleKill, tributeCands, isExtraD, num, emit } = L;
const atk = L.atk, def = L.def;

/* ----- helpers for this batch ----- */
const named = (c, ...ns) => ns.includes(D(c).n);
const noop = { type: 'act', res: function* () {} };
const isEHERO = c => /^Elemental HERO/.test(name(c));
const bubbleman = c => faceUp(c) && named(c, 'Elemental HERO Bubbleman');
// a monster flipped face-up by an effect (its Flip effect triggers)
const flipUp = (g, c, pos) => { c.pos = pos; g.seq++; log(g, `${name(c)} was flipped face-up.`); emit(g, { type: 'flip', c, p: c.ctrl }); };
// where a monster last came to the field from (Burning Skull Head, Card of Safe Return, Call of the Reaper)
function cameFrom(g, x) { for (let i = g.events.length - 1; i >= 0; i--) { const e = g.events[i]; if (e.type === 'move' && e.c === x && e.to === 'm') return e.from; } return null; }
// "If this card destroys an opponent's monster by battle" (no "and sends it to the GY")
const killedByBattle = (ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.prevCtrl !== c.ctrl;
// monsters an effect may Special Summon from the hand or Deck (not Special Summon-only monsters)
const ssable = c => isMon(c) && !isExtraD(D(c)) && !['ritual', 'token'].includes(D(c).k) && !/Cannot be Special Summoned|Must (first )?be Special Summoned/i.test(D(c).tx || '');
const tx = c => D(c).tx || '';
// Equip Spells
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?', o = {}) => ({ type: 'act',
  cond: (g, c, p) => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, o.hint || 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c) && equip(g, c, t) && o.post) o.post(g, c, p, L2, t); } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
// would monster m lose the battle now (before destruction is applied)?
function losesBattle(g, m) {
  const b = g.battle; if (!b || !b.t) return false; const { a, t } = b;
  if (m === a) { if (t.pos !== 'atk') return false; const A = atk(g, a), T = atk(g, t); return T > A || (T === A && (A > 0 || T === 0)); }
  if (m === t) { const A = atk(g, a); if (t.pos === 'atk') { const T = atk(g, t); return A > T || (A === T && (A > 0 || T === 0)); } return A > def(g, t); }
  return false;
}
// "Cannot be Normal Summoned/Set" and "Must be Special Summoned (from your hand) by ...": the card data's Edison text is a
// placeholder for these cards, so the engine's text check can't see it. A duel-long rule is put in the first time one of
// these cards sees any event.
const NO_NS = ['Black Luster Soldier - Envoy of the Beginning', 'Blue-Eyes Shining Dragon', 'Blue-Eyes Toon Dragon'];
const HAND_ONLY_SS = ['Blue-Eyes Shining Dragon'];
const summonRules = { type: 'trig', loc: 'any', res: function* () {}, on: (g) => {
  if (!g.full03Rules) { g.full03Rules = true; addRule(g, (g2, a) => a.c && a.c.id && (((a.type === 'ns' || a.type === 'set') && NO_NS.includes(D(a.c).n)) || (a.type === 'ss' && HAND_ONLY_SS.includes(D(a.c).n) && a.c.zone !== 'hand'))); }
  return false; } };
// Spell Counters for each Spell Card that resolves (as goat-7.js). PARTIAL: a Set Continuous, Equip or Field Spell flipped
// to activate adds none, and a Normal Spell whose activation was negated still adds one (the engine has no resolve event).
const spellCounter = { type: 'trig', on: (g, ev, c) => {
  if (ev.type !== 'move' || !isSpell(ev.c)) return false;
  const stays = ['Continuous', 'Equip', 'Field'].includes(D(ev.c).sub);
  if ((!stays && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule') || (stays && ev.from === 'hand' && ev.reason === 'activate')) { addCtr(g, c, 'spell', 1); log(g, `${name(c)} got a Spell Counter (${ctr(c, 'spell')}).`); }
  return false; }, res: function* () {} };
// A battle worked out in the card: the engine's attack() keeps its target local, so an attack redirect negates the declared
// attack and the attacker battles the new target here (as classic-4.js Eye of Illusion). ENGINE: attack redirect.
function battleInstead(g, a, t) {
  negateAttack(g);
  if (!a || !t || a.zone !== 'm' || t.zone !== 'm' || !faceUp(a)) return;
  log(g, `${name(a)} battles ${t.pos === 'set' ? 'a face-down monster' : name(t)} instead.`);
  if (t.pos === 'set') flipUp(g, t, 'def');
  const A = atk(g, a), ac = a.ctrl, tc = t.ctrl;
  const noDmg = q => [a, t].some(x => x.ctrl === q && faceUp(x) && has(g, x, 'noBattleDamage')) || g.p[q].noBattleDamage === g.turnNo;
  if (t.pos === 'atk') {
    const T = atk(g, t);
    if (A > T) { if (!noDmg(tc)) damage(g, tc, A - T, { battle: true, src: a, srcP: ac }); destroy(g, [t], { battle: true, killer: a }); }
    else if (A < T) { if (!noDmg(ac)) damage(g, ac, T - A, { battle: true, src: t, srcP: tc }); destroy(g, [a], { battle: true, killer: t }); }
    else if (A > 0 || T === 0) destroy(g, [a, t], { battle: true });
  } else {
    const Dv = def(g, t);
    if (A > Dv) { if (has(g, a, 'piercing') && !noDmg(tc)) damage(g, tc, A - Dv, { battle: true, src: a, srcP: ac }); destroy(g, [t], { battle: true, killer: a }); }
    else if (A < Dv && !noDmg(ac)) damage(g, ac, Dv - A, { battle: true, src: t, srcP: tc });
  }
}
// Toons (as classic-1.js)
const isToon = c => /Toon/.test(D(c).ab || '') || /treated as a "Toon" card/.test(tx(c));
const toonWorld = (g, p) => stOf(g, p).some(x => faceUp(x) && named(x, 'Toon World'));
// Union monsters: the monster each one is equipped to (one Union at a time)
const unionOn = (g, m) => allField(g).some(x => x.equipTo === m.u && isMon(x));
// chain link helpers
const chainNames = g => g.chain.map(x => D(x.c).n);
const chainHasDup = g => { const ns = chainNames(g); return ns.some((n, i) => ns.indexOf(n) !== i); };
// Chain Detonation / Chain Healing: where the card goes after it resolves
function chainReturn(g, c, L2) {
  if (!onField(c)) return;
  if (L2.link >= 4) { move(g, c, 'hand', { reason: 'effect' }); log(g, `${name(c)} returned to the hand (Chain Link ${L2.link}).`); }
  else if (L2.link >= 2) { move(g, c, 'deck', { reason: 'effect' }); log(g, `${name(c)} was shuffled into the Deck (Chain Link ${L2.link}).`); }
}
// all cards with a name in a player's hand and Deck (and Extra Deck for Fusion/Synchro names)
const sameName = (g, q, n) => [...g.p[q].hand, ...g.p[q].deck, ...g.p[q].extra].filter(x => D(x).n === n);
const chainEnergies = g => allField(g).filter(x => faceUp(x) && named(x, 'Chain Energy'));

E.addScripts({
  /* ----- B ----- */
  // Ported from goat-1.js. Edison: the banish can target itself; it can't be activated after this card declared an attack
  // this turn; the second attack comes when it destroys a monster by battle (sent to the GY or not).
  // PARTIAL: "Must first be Special Summoned" is not tracked, so it can be revived without a proper summon first.
  'Black Luster Soldier - Envoy of the Beginning': {
    proc: { label: 'Special Summon (banish a LIGHT and a DARK)',
      cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'LIGHT') && g.p[p].gy.some(x => isMon(x) && attr(x) === 'DARK'),
      cost: function* (g, c, p, grp) {
        const [l] = yield* pick(g, p, 'Banish a LIGHT monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT'), 1, 1, 'cost');
        const [d] = yield* pick(g, p, 'Banish a DARK monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK'), 1, 1, 'cost');
        for (const x of [l, d]) if (x) move(g, x, 'ban', { reason: 'cost', group: grp });
        log(g, `${PN(g, p)} banished ${[l, d].filter(Boolean).map(name).join(' and ')}.`); } },
    self: { cantAttack: (g, c) => c.flags.envoyBanish === g.turnNo },
    effs: [summonRules,
      { type: 'ign', label: 'Banish a monster',
        cond: (g, c, p) => c.flags.envoyUsed !== g.turnNo && !c.declared && fieldMons(g).length > 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which monster?', fieldMons(g).filter(x => x !== c).length ? fieldMons(g).filter(x => x !== c) : [c], 1, 1, 'bad'); },
        after: (g, c) => { c.flags.envoyUsed = g.turnNo; c.flags.envoyBanish = g.turnNo; },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone === 'm') { const n = D(t).n; move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${n} was banished.`); } } },
      { type: 'trig', label: 'Attack again', on: (g, ev, c) => killedByBattle(ev, c) && !!g.battle && g.battle.a === c,
        cond: (g, c) => c.flags.envoyUsed !== g.turnNo && onField(c),
        after: (g, c) => { c.flags.envoyUsed = g.turnNo; },
        res: function* (g, c) { if (onField(c) && faceUp(c)) { c.flags.extraAttack = g.turnNo; log(g, `${name(c)} can make a second attack in a row.`); } } }] },
  // "If any Spell or Trap Card(s) are Chained": a mandatory trigger after the chain, once per chain.
  // PARTIAL: a chained S/T is seen when it is activated from the hand or when a Normal S/T leaves the field after resolving
  // (the engine has no chain event); a Set Continuous or Equip card chained at Chain Link 2+ is missed.
  'Blast Asmodian': { effs: [{ type: 'trig', mand: true, label: '500 damage',
    on: (g, ev, c) => {
      const L1 = g.chain[0]; if (!L1 || ev.type !== 'move' || !isST(ev.c)) return false;
      const chained = (ev.from === 'hand' && ev.reason === 'activate' && g.chain.length >= 1) || (ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && g.chain.length >= 1);
      if (!chained) return false;
      L1.asmo = L1.asmo || []; if (L1.asmo.includes(c.u)) return false; L1.asmo.push(c.u); return true; },
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  'Blast Held by a Tribute': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && g.aw.a.summonType === 'tribute',
    res: function* (g, c, p) { const out = destroy(g, monsOf(g, opp(p)).filter(x => x.pos === 'atk'), { by: p, src: c }); if (out.length) damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },
  // PARTIAL: the engine has no response window in the Standby Phase, so the effect is offered as an optional trigger at the
  // start of your Standby Phase.
  'Blast Juggler': { effs: [{ type: 'trig', tags: { destroy: 1 }, label: 'Tribute: destroy 2 monsters',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    cond: (g, c) => fieldMons(g).filter(x => x !== c && faceUp(x) && atk(g, x) <= 1000).length >= 2,
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Blast Juggler.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy 2 face-up monsters with 1000 or less ATK', fieldMons(g).filter(x => faceUp(x) && atk(g, x) <= 1000), 2, 2, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2).filter(x => faceUp(x) && atk(g, x) <= 1000), { by: p }); } }] },
  'Blast Magician': { effs: [spellCounter,
    { type: 'ign', tags: { destroy: 1 }, label: 'Remove Spell Counters: destroy a monster',
      cond: (g, c) => ctr(c, 'spell') > 0 && fieldMons(g).some(x => faceUp(x) && atk(g, x) <= 700 * ctr(c, 'spell')),
      cost: function* (g, c, p, L2) { const max = ctr(c, 'spell'); const opts = []; for (let n = 1; n <= max; n++) if (fieldMons(g).some(x => faceUp(x) && atk(g, x) <= 700 * n)) opts.push(n);
        const i = yield* choose(g, p, 'Remove how many Spell Counters?', opts.map(n => `${n} (up to ${700 * n} ATK)`)); L2.data.n = opts[i]; addCtr(g, c, 'spell', -L2.data.n); log(g, `${PN(g, p)} removed ${L2.data.n} Spell Counter${L2.data.n > 1 ? 's' : ''}.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, `Destroy which face-up monster with ${700 * L2.data.n} or less ATK?`, fieldMons(g).filter(x => faceUp(x) && atk(g, x) <= 700 * L2.data.n), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && atk(g, t) <= 700 * L2.data.n) destroy(g, [t], { by: p }); } }] },
  // Ported from classic-2.js. PARTIAL: it goes to a Spell & Trap Zone of the attacker's controller; with no free zone there,
  // nothing happens.
  'Blast Sphere': { effs: [
    { type: 'trig', mand: true, faceDownOk: true, label: 'Equip to the attacker',
      on: (g, ev, c) => ev.type === 'dsStart' && ev.t === c && c.pos === 'set' && !!ev.a && ev.a.ctrl !== c.ctrl,
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (c.zone !== 'm' || !a || a.zone !== 'm') return; const q = a.ctrl; if (freeST(g, q) < 0) return;
        move(g, c, 'st', { ctrl: q, pos: 'up', reason: 'equip', by: p }); c.equipTo = a.u; c.flags.blast = true; log(g, `Blast Sphere was equipped to ${name(a)}.`); } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy the equipped monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && c.flags.blast && ev.tp !== c.owner && !!c.equipTo,
      res: function* (g, c) { const m = fieldMons(g).find(x => x.u === c.equipTo); if (!m) return; const n = atk(g, m); if (destroy(g, [m], { by: c.owner }).length) damage(g, opp(c.owner), n, { src: c, srcP: c.owner }); } }] },
  // A Normal Trap that stays on the field as an Equip Card (L.keep).
  'Blast with Chain': { cont: eqBonus(500, 0), effs: [
    { type: 'act', ds: true, cond: (g, c, p) => monsOf(g, p).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Blast with Chain to which monster?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.ctrl === p && onField(c) && equip(g, c, t)) { c.flags.bwc = true; L2.keep = true; g.seq++; } } },
    { type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy a card',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !ev.battle && ev.snap && ev.snap.flags && ev.snap.flags.bwc,
      cond: g => allField(g).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', allField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Blue Medicine': { effs: [{ type: 'act', res: function* (g, c, p) { gain(g, p, 400); } }] },
  'Blue-Eyes Shining Dragon': {
    proc: { label: 'Special Summon (Tribute Blue-Eyes Ultimate Dragon)', cond: (g, c, p) => monsOf(g, p).some(x => named(x, 'Blue-Eyes Ultimate Dragon')),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Tribute Blue-Eyes Ultimate Dragon', monsOf(g, p).filter(x => named(x, 'Blue-Eyes Ultimate Dragon')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Blue-Eyes Ultimate Dragon.`); } } },
    self: { atk: (g, c) => 300 * g.p[c.ctrl].gy.filter(x => isMon(x) && race(x) === 'Dragon').length },
    effs: [summonRules,
      { type: 'quick', ds: true, label: 'Negate an effect that targets it',
        cond: (g, c, p, x) => !!x.top && !x.top.negated && Array.isArray(x.top.t) && x.top.t.includes(c),
        target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
        res: function* (g, c, p, L2) { if (L2.data.L && !L2.data.L.negated) { L2.data.L.negBy = p; negate(g, L2.data.L, false); } } }] },
  // Ported from classic-1.js (toon(2)).
  'Blue-Eyes Toon Dragon': {
    proc: { label: 'Special Summon (Tribute 2, Toon World)', cond: (g, c, p) => toonWorld(g, p) && tributeCands(g, p).length >= 2,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Tribute 2 monsters', monsOf(g, p), 2, 2, 'cost');
        for (const x of xs) move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${xs.map(x => x.pos === 'set' ? 'a face-down monster' : name(x)).join(' and ')}.`); } },
    self: {
      cantAttack: (g, c) => c.turnIn === g.turnNo,
      attackCost: () => 500,
      directAttack: (g, c) => !monsOf(g, opp(c.ctrl)).some(x => faceUp(x) && isToon(x)),
      attackOk: (g, c, t) => !monsOf(g, opp(c.ctrl)).some(x => faceUp(x) && isToon(x)) || (faceUp(t) && isToon(t)),
    },
    effs: [summonRules, { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroyed with Toon World',
      on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.destroyed && named(ev.c, 'Toon World') && ev.prevCtrl === c.ctrl,
      res: function* (g, c) { if (onField(c)) destroy(g, [c], { rule: true }); } }] },
  // The End Phase flip is a mandatory trigger of this card (from any zone), kept on g.eclipse.
  'Book of Eclipse': { effs: [
    { type: 'act', cond: g => fieldMons(g).some(faceUp),
      res: function* (g, c, p) { const ms = fieldMons(g).filter(faceUp); for (const m of ms) setFaceDown(g, m); g.eclipse = g.eclipse || []; g.eclipse.push({ u: c.u, p, turn: g.turnNo }); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Flip their monsters face-up',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!g.eclipse && g.eclipse.some(e => e.u === c.u && e.turn === g.turnNo),
      res: function* (g, c) { const e = g.eclipse.find(x => x.u === c.u && x.turn === g.turnNo); g.eclipse = g.eclipse.filter(x => x !== e); if (!e) return;
        const o = opp(e.p), ms = monsOf(g, o).filter(m => m.pos === 'set'); for (const m of ms) flipUp(g, m, 'def');
        if (ms.length) { log(g, `${PN(g, o)} draws ${ms.length} card${ms.length > 1 ? 's' : ''} (Book of Eclipse).`); draw(g, o, Math.min(ms.length, g.p[o].deck.length)); } } }] },
  // Ported from classic-4.js.
  'Book of Secret Arts': { cont: eqBonus(300, 300), effs: [equipAct(m => race(m) === 'Spellcaster', 'Equip to which face-up Spellcaster?')] },
  // Ported from goat-2.js (Edison: into Attack Position).
  'Book of Taiyou': { effs: [{ type: 'act', cond: g => fieldMons(g).some(x => x.pos === 'set'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Flip which face-down monster into Attack Position?', fieldMons(g).filter(x => x.pos === 'set'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.pos === 'set') flipUp(g, t, 'atk'); } }] },
  'Brain Crusher': { effs: [
    { type: 'trig', on: (g, ev, c) => { if (battleKill(ev, c) && ev.prevCtrl !== c.ctrl) (c.flags.bcK = c.flags.bcK || []).push({ x: ev.c, turn: g.turnNo, ctrl: c.ctrl }); return false; }, res: function* () {} },
    { type: 'trig', opt: true, tags: { ss: 1 }, label: 'Special Summon a monster it destroyed',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && (c.flags.bcK || []).some(k => k.turn === g.turnNo && k.ctrl === c.ctrl),
      cond: (g, c, p) => freeM(g, p) >= 0 && (c.flags.bcK || []).some(k => k.turn === g.turnNo && k.ctrl === p && k.x.zone === 'gy'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which destroyed monster?', (c.flags.bcK || []).filter(k => k.turn === g.turnNo && k.ctrl === p && k.x.zone === 'gy').map(k => k.x), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  'Brain Golem': {
    cont: { negates: (g, src, c) => c !== src && c.zone === 'm' && faceUp(c) && isMon(c) && attr(c) === 'LIGHT' },
    effs: [{ type: 'trig', mand: true, label: 'Attack once again',
      on: (g, ev, c) => battleKill(ev, c) && ev.snap && ev.snap.attr === 'LIGHT' && !!g.battle && g.battle.a === c,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { c.flags.maxAttacks = c.attacks + 1; c.flags.maxAttacksTurn = g.turnNo; log(g, `${name(c)} can attack once again.`); } } }] },
  // The control lasts while it is equipped (c.used.bjack keeps the monster's id across its moves).
  'Brain Jacker': { effs: [
    { type: 'trig', mand: true, faceDownOk: true, label: 'Equip and take control',
      on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
      cond: (g, c, p) => !c.flags.battleDoomed && monsOf(g, opp(p)).length > 0 && freeST(g, p) >= 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Brain Jacker to which of their monsters?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.zone !== 'm' || t.ctrl === p || c.zone !== 'm' || freeST(g, p) < 0) return;
        move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p }); c.equipTo = t.u; c.used.bjack = t.u; log(g, `Brain Jacker was equipped to ${name(t)}.`); takeControl(g, p, t, false); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Opponent gains 500 LP',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && !!c.used.bjack && !!c.equipTo && ev.tp !== c.ctrl,
      res: function* (g, c) { gain(g, opp(c.ctrl), 500); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Control returns',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'st' && ev.wasField && !!c.used.bjack,
      res: function* (g, c) { const u = c.used.bjack; c.used.bjack = null; const m = fieldMons(g).find(x => x.u === u); if (m && m.ctrl !== m.owner) { if (!takeControl(g, m.owner, m, false)) move(g, m, 'gy', { reason: 'rule' }); } } }] },
  'Bubble Blaster': {
    cont: { ...eqBonus(800, 0),
      replaceDestroy: (g, src, c, o) => { if (!o.battle || src.equipTo !== c.u || !onField(src)) return false; log(g, `Bubble Blaster was destroyed instead of ${name(c)}.`); destroy(g, [src], { quietLog: true }); return true; },
      dmg: (g, src, p, n, o) => { const m = equippedTo(g, src); return o.battle && m && m.ctrl === p && losesBattle(g, m) ? 0 : n; } },
    effs: [equipAct(m => named(m, 'Elemental HERO Bubbleman'), 'Equip to which Elemental HERO Bubbleman?')] },
  // Each player over 5 picks what to send; all are sent at once.
  'Bubble Crash': { effs: [{ type: 'act',
    cond: (g, c) => [0, 1].some(q => g.p[q].hand.length + fieldOf(g, q).filter(x => x !== c).length >= 6),
    res: function* (g, c, p) { const out = [];
      for (const q of [p, opp(p)]) { const pool = [...g.p[q].hand, ...fieldOf(g, q).filter(x => x !== c)]; const n = pool.length - 5; if (n <= 0) continue;
        const xs = yield* pick(g, q, `Send ${n} card${n > 1 ? 's' : ''} from your hand and field to the GY`, pool, n, n, 'cost'); out.push(...xs); }
      const grp = g.group; for (const x of out) move(g, x, 'gy', { reason: 'effect', by: p, group: grp, noLater: true });
      if (out.length) log(g, `${out.length} card${out.length > 1 ? 's were' : ' was'} sent to the GY by Bubble Crash.`); } }] },
  // ENGINE: Trap Cards can't be activated from the hand. PARTIAL: you Set 1 Trap from your hand, and it can be activated
  // this turn (as if it had been Set before this turn).
  'Bubble Illusion': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(bubbleman),
    res: function* (g, c, p) { const ts = g.p[p].hand.filter(isTrap); if (!ts.length || freeST(g, p) < 0) { log(g, `${PN(g, p)} can activate 1 Trap Card from the hand this turn.`); return; }
      const [x] = yield* pick(g, p, 'Set which Trap from your hand (it can be activated this turn)?', ts, 1, 1, 'good'); if (!x) return;
      move(g, x, 'st', { ctrl: p, pos: 'set', reason: 'set' }); x.turnIn = g.turnNo - 1; log(g, `${PN(g, p)} Set a Trap that can be activated this turn.`); } }] },
  'Bubble Shuffle': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => bubbleman(x) && x.pos === 'atk') && monsOf(g, opp(p)).some(x => x.pos === 'atk') && g.p[p].hand.some(x => isMon(x) && isEHERO(x)),
    target: function* (g, c, p, L2) {
      const [b] = yield* pick(g, p, 'Target which Elemental HERO Bubbleman?', monsOf(g, p).filter(x => bubbleman(x) && x.pos === 'atk'), 1, 1, 'cost');
      const [o] = yield* pick(g, p, 'Target which of their Attack Position monsters?', monsOf(g, opp(p)).filter(x => x.pos === 'atk'), 1, 1, 'bad');
      L2.t = [b, o].filter(Boolean); L2.data.b = b; L2.data.o = o; },
    res: function* (g, c, p, L2) { const { b, o } = L2.data;
      if (!b || !o || b.zone !== 'm' || o.zone !== 'm' || b.pos !== 'atk' || o.pos !== 'atk' || !bubbleman(b)) return;
      for (const m of [b, o]) { m.pos = 'def'; g.seq++; log(g, `${name(m)} changed to Defense Position.`); emit(g, { type: 'pos', c: m, p: m.ctrl }); }
      move(g, b, 'gy', { reason: 'effect', by: p, tribute: true }); log(g, `${PN(g, p)} Tributed Elemental HERO Bubbleman.`);
      const hs = g.p[p].hand.filter(x => isMon(x) && isEHERO(x) && ssable(x)); if (!hs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which Elemental HERO from your hand?', hs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  'Burning Algae': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Opponent gains 1000 LP',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy',
    res: function* (g, c, p) { gain(g, opp(p), 1000); } }] },
  // Union (Edison text): once per turn equip to your Freezing Beast or unequip and Special Summon in Attack Position.
  'Burning Beast': {
    cont: { replaceDestroy: (g, src, c, o) => { if (!o.battle || !src.flags.union || src.equipTo !== c.u || src.zone !== 'st') return false; log(g, `Burning Beast was destroyed instead of ${name(c)}.`); destroy(g, [src], { quietLog: true }); return true; } },
    effs: [
      { type: 'ign', label: 'Equip to Freezing Beast',
        cond: (g, c, p) => c.used.union !== g.turnNo && freeST(g, p) >= 0 && monsOf(g, p).some(x => x !== c && faceUp(x) && named(x, 'Freezing Beast') && !unionOn(g, x)),
        after: (g, c) => { c.used.union = g.turnNo; },
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Burning Beast to which Freezing Beast?', monsOf(g, p).filter(x => x !== c && faceUp(x) && named(x, 'Freezing Beast') && !unionOn(g, x)), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || c.zone !== 'm' || !faceUp(c) || freeST(g, p) < 0 || unionOn(g, t)) return; move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); c.equipTo = t.u; c.flags.union = true; log(g, `Burning Beast was equipped to ${name(t)}.`); } },
      { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Unequip and Special Summon',
        cond: (g, c, p) => c.used.union !== g.turnNo && !!c.flags.union && !!c.equipTo && freeM(g, p) >= 0,
        after: (g, c) => { c.used.union = g.turnNo; },
        res: function* (g, c, p) { if (c.zone !== 'st' || !c.equipTo) return; c.equipTo = null; ss(g, p, c, 'atk'); } },
      { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy a face-up Spell/Trap',
        on: (g, ev, c) => ev.type === 'damage' && ev.battle && !!ev.src && !!c.flags.union && ev.src.u === c.equipTo && ev.p !== ev.src.ctrl,
        cond: g => stOnField(g).some(x => faceUp(x) && isST(x)),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up Spell/Trap?', stOnField(g).filter(x => faceUp(x) && isST(x)), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { destroy(g, live(L2).filter(faceUp), { by: p }); } }] },
  // Ported from classic-4.js.
  'Burning Land': { effs: [{ type: 'act',
      res: function* (g, c, p) { const fz = allField(g).filter(x => x.zone === 'fz'); if (fz.length) destroy(g, fz, { by: p, src: c }); } },
    { type: 'trig', loc: 'st', mand: true, label: 'The turn player takes 500 damage', on: (g, ev) => ev.type === 'phase' && ev.ph === 'standby',
      res: function* (g, c, p, L2) { damage(g, L2.ev.tp, 500, { src: c, srcP: p }); } }] },
  'Burning Skull Head': { effs: [
    { type: 'trig', mand: true, label: '1000 damage', on: (g, ev, c) => evSummoned(ev, c) && !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how) && cameFrom(g, c) === 'hand',
      res: function* (g, c, p) { damage(g, opp(p), 1000, { src: c, srcP: p }); } },
    { type: 'ign', label: 'Banish itself: return Skull Flame', cond: (g, c, p) => allCards(g, 'ban').some(x => named(x, 'Skull Flame')),
      cost: function* (g, c, p) { move(g, c, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished Burning Skull Head.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which banished Skull Flame to the GY?', allCards(g, 'ban').filter(x => named(x, 'Skull Flame')), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'ban') { move(g, t, 'gy', { reason: 'effect' }); log(g, 'Skull Flame returned to the GY.'); } } }] },
  'Burning Spear': { cont: eqBonus(400, -200), effs: [equipAct(m => attr(m) === 'FIRE', 'Equip to which face-up FIRE monster?')] },
  'Burst Breath': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => race(x) === 'Dragon'),
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Tribute 1 Dragon monster', monsOf(g, p).filter(x => race(x) === 'Dragon'), 1, 1, 'cost'); if (!x) return;
      L2.data.n = faceUp(x) ? atk(g, x) : baseAtk(x); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n} (${L2.data.n} ATK).`); },
    res: function* (g, c, p, L2) { const n = L2.data.n || 0; destroy(g, fieldMons(g).filter(x => faceUp(x) && def(g, x) <= n), { by: p, src: c }); } }] },
  'Burst Return': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && named(x, 'Elemental HERO Burstinatrix')) && fieldMons(g).some(x => faceUp(x) && isEHERO(x) && !named(x, 'Elemental HERO Burstinatrix')),
    res: function* (g, c, p) { const ms = fieldMons(g).filter(x => faceUp(x) && isEHERO(x) && !named(x, 'Elemental HERO Burstinatrix'));
      for (const m of ms) move(g, m, 'hand', { reason: 'effect', by: p }); if (ms.length) log(g, `${ms.map(x => D(x).n).join(', ')} returned to the hand.`); } }] },
  'Burst Stream of Destruction': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && named(x, 'Blue-Eyes White Dragon')) && monsOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)), { by: p, src: c });
      addRule(g, (g2, a) => a.type === 'attack' && a.c.ctrl === p && named(a.c, 'Blue-Eyes White Dragon'), { end: g.turnNo }); log(g, 'Blue-Eyes White Dragon can\'t attack this turn.'); } }] },
  'Butterfly Dagger - Elma': { cont: eqBonus(300, 0), effs: [
    equipAct(() => true, 'Equip to which face-up monster?', { post: (g, c) => { c.flags.elma = true; } }),
    { type: 'trig', loc: 'gy', when: true, label: 'Return it to the hand',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.snap && ev.snap.flags && ev.snap.flags.elma,
      res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} returned Butterfly Dagger - Elma to the hand.`); } } }] },

  /* ----- C ----- */
  // PARTIAL: a monster counts as revived by Monster Reborn when it is Special Summoned while a face-up Monster Reborn is on the
  // field (it is resolving).
  'Call of Darkness': {
    cont: { forbid: (g, src, a) => a.type === 'activate' && named(a.c, 'Monster Reborn') },
    effs: [noop, { type: 'trig', loc: 'st', mand: true, label: 'Send the revived monster to the GY',
      on: (g, ev) => ev.type === 'summon' && ev.how === 'special' && allField(g).some(x => x.zone === 'st' && x.pos === 'up' && named(x, 'Monster Reborn')),
      res: function* (g, c, p, L2) { const ms = L2.ev.cs.filter(x => x.zone === 'm'); for (const m of ms) move(g, m, 'gy', { reason: 'effect', by: p }); if (ms.length) log(g, `${ms.map(x => D(x).n).join(', ')} was sent to the GY.`); } }] },
  // PARTIAL: see battleInstead (the redirected battle is worked out in the card, so Damage Step effects don't get a window).
  'Call of the Earthbound': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && monsOf(g, p).some(x => !(faceUp(x) && has(g, x, 'noAttackTarget'))),
    res: function* (g, c, p) { if (!g.aw) return; const a = g.aw.a, cur = g.aw.t; const cs = monsOf(g, p).filter(x => !(faceUp(x) && has(g, x, 'noAttackTarget'))); if (!cs.length) return;
      const [t] = yield* pick(g, p, 'Choose the target of the attack', cs, 1, 1, 'good'); if (!t || t === cur) { log(g, 'The attack target stays the same.'); return; }
      battleInstead(g, a, t); } }] },
  'Call of the Grave': { effs: [{ type: 'act',
    cond: (g, c, p, x) => !!x.top && x.top.cardAct && x.top.p !== p && named(x.top.c, 'Monster Reborn') && !x.top.negated,
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, false); } }] },
  'Call of the Mummy': { effs: [noop,
    { type: 'ign', loc: 'st', opt: true, tags: { ss: 1 }, label: 'Special Summon a Zombie',
      cond: (g, c, p) => monsOf(g, p).length === 0 && g.p[p].hand.some(x => race(x) === 'Zombie' && ssable(x)),
      res: function* (g, c, p) { if (monsOf(g, p).length) return; const cs = g.p[p].hand.filter(x => race(x) === 'Zombie' && ssable(x)); if (!cs.length) return;
        const [x] = yield* pick(g, p, 'Special Summon which Zombie from your hand?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  'Call of the Reaper': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => !!g.sw && g.sw.cs.some(x => x.owner === p && cameFrom(g, x) === 'gy') && freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, 'Supay', 'Fire Ant Ascator')),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which monster from your GY?', g.p[p].gy.filter(x => named(x, 'Supay', 'Fire Ant Ascator')), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  // PARTIAL: the redirect is worked out in the card (see battleInstead); its DEF boost is offered with the redirect.
  'Card Blocker': { effs: [
    { type: 'trig', mand: true, label: 'Change to Defense Position', on: (g, ev, c) => evSummoned(ev, c),
      res: function* (g, c) { if (c.zone === 'm' && c.pos === 'atk') { c.pos = 'def'; g.seq++; log(g, 'Card Blocker changed to Defense Position.'); } } },
    { type: 'trig', when: true, label: 'Change the attack target to it',
      on: (g, ev, c) => ev.type === 'attack' && !!ev.t && ev.t !== c && ev.t.ctrl === c.ctrl && faceUp(ev.t) && ev.a.ctrl !== c.ctrl,
      cond: (g, c) => !!g.aw && !g.aw.blocked && !has(g, c, 'noAttackTarget'),
      res: function* (g, c, p) { if (!g.aw || g.aw.blocked || !onField(c) || !faceUp(c)) return; g.aw.blocked = true; const a = g.aw.a;
        log(g, `${PN(g, p)} changed the attack target to Card Blocker.`);
        if (g.p[p].deck.length && (yield* yn(g, p, 'Send cards from the top of your Deck for Card Blocker\'s DEF?'))) yield* blockerDef(g, c, p);
        battleInstead(g, a, c); } },
    { type: 'trig', when: true, label: 'Send 1-3 cards: gain DEF',
      on: (g, ev, c) => ev.type === 'attack' && ev.t === c,
      cond: (g, c, p) => g.p[p].deck.length > 0,
      cost: function* (g, c, p, L2) { L2.data.n = yield* blockerMill(g, p); },
      res: function* (g, c, p, L2) { if (onField(c) && faceUp(c) && L2.data.n) { addMod(g, c, { def: 500 * L2.data.n, end: true }); log(g, `Card Blocker gained ${500 * L2.data.n} DEF.`); } } }] },
  'Card Ejector': { effs: [{ type: 'ign', opt: true, label: 'Banish a card from their GY', cond: (g, c, p) => g.p[opp(p)].gy.length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which card from their GY?', g.p[opp(p)].gy, 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished.`); } } }] },
  // Guard Counters it moves (ctr 'guardP') protect the card once each from destruction.
  // PARTIAL: that protection works while a face-up Card Guard is on the field (the engine's destruction replacement hook is a
  // field effect), not after every Card Guard has left.
  'Card Guard': {
    self: { atk: (g, c) => 300 * ctr(c, 'guard') },
    cont: { replaceDestroy: (g, src, c, o) => { if (ctr(c, 'guardP') <= 0 || !onField(c)) return false; addCtr(g, c, 'guardP', -1); addCtr(g, c, 'guard', -1); g.seq++; log(g, `A Guard Counter was removed from ${name(c)} instead.`); return true; } },
    effs: [
      { type: 'trig', mand: true, label: 'Place a Guard Counter', on: (g, ev, c) => evSummoned(ev, c) && ev.how !== 'flip',
        res: function* (g, c) { if (onField(c) && faceUp(c)) { addCtr(g, c, 'guard', 1); g.seq++; log(g, 'Card Guard got a Guard Counter.'); } } },
      { type: 'ign', opt: true, label: 'Move a Guard Counter', cond: (g, c, p) => ctr(c, 'guard') > 0 && fieldOf(g, p).some(x => x !== c && faceUp(x)),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Move the Guard Counter to which face-up card?', fieldOf(g, p).filter(x => x !== c && faceUp(x)), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c) || ctr(c, 'guard') <= 0) return;
          addCtr(g, c, 'guard', -1); if (ctr(c, 'guardP') > ctr(c, 'guard')) addCtr(g, c, 'guardP', -1);
          addCtr(g, t, 'guard', 1); addCtr(g, t, 'guardP', 1); g.seq++; log(g, `The Guard Counter moved to ${name(t)}.`); } }] },
  // Ported from classic-4.js.
  'Card of Safe Return': { effs: [noop,
    { type: 'trig', loc: 'st', when: true, label: 'Draw 1 card',
      on: (g, ev, c) => ev.type === 'summon' && !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how) && ev.cs.some(x => x.owner === c.ctrl && cameFrom(g, x) === 'gy'),
      cond: (g, c, p) => g.p[p].deck.length > 0, res: function* (g, c, p) { if (onField(c)) draw(g, p, 1); } }] },
  // Ported from classic-4.js. Edison: banishing is the cost, and you need at least 1 other card on your field or in your hand.
  'Card of Sanctity': { effs: [{ type: 'act',
    cond: (g, c, p) => fieldOf(g, p).some(x => x !== c) || g.p[p].hand.some(x => x !== c),
    cost: function* (g, c, p) { const out = [...fieldOf(g, p).filter(x => x !== c), ...g.p[p].hand.filter(x => x !== c)]; const grp = g.group; for (const x of out) move(g, x, 'ban', { reason: 'cost', by: p, group: grp });
      if (out.length) log(g, `${PN(g, p)} banished ${out.length} card${out.length > 1 ? 's' : ''}.`); },
    res: function* (g, c, p) { const n = 2 - g.p[p].hand.length; if (n > 0) draw(g, p, n); } }] },
  'Card Rotator': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && monsOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send 1 card from your hand to the GY', g.p[p].hand.filter(x => x !== c), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); } },
    res: function* (g, c, p) { for (const m of monsOf(g, opp(p))) { if (m.pos === 'set') flipUp(g, m, 'atk'); else { m.pos = m.pos === 'atk' ? 'def' : 'atk'; g.seq++; emit(g, { type: 'pos', c: m, p: m.ctrl }); } }
      log(g, `The battle positions of ${PN(g, opp(p))}'s monsters were changed.`); } }] },
  'Card Shuffle': { effs: [noop,
    { type: 'ign', loc: 'st', opt: true, label: 'Pay 300: shuffle a Deck', cond: (g, c, p) => g.p[p].lp > 300,
      cost: function* (g, c, p) { pay(g, p, 300); },
      res: function* (g, c, p) { const i = yield* choose(g, p, 'Shuffle which Deck?', ['Your Deck', 'Your opponent\'s Deck']); const q = i ? opp(p) : p; shuffleDeck(g, q); log(g, `${PN(g, q)}'s Deck was shuffled.`); } }] },
  // PARTIAL: the engine has no response window in the Standby Phase, so it is an optional trigger at its start.
  'Card Trader': { effs: [noop,
    { type: 'trig', loc: 'st', opt: true, label: 'Shuffle a card in: draw 1',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      cond: (g, c, p) => g.p[p].hand.length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Shuffle which card from your hand into the Deck?', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'deck', { reason: 'cost' }); log(g, `${PN(g, p)} shuffled a card into the Deck.`); } },
      res: function* (g, c, p) { if (g.p[p].deck.length) draw(g, p, 1); } }] },
  'Castle Gate': { self: { noBattleDestroy: true },
    effs: [{ type: 'ign', opt: true, label: 'Tribute: damage equal to its ATK',
      cond: (g, c, p) => c.pos === 'atk' && monsOf(g, p).some(x => x !== c && lv(x) <= 5),
      cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Tribute a Level 5 or lower monster', monsOf(g, p).filter(x => x !== c && lv(x) <= 5), 1, 1, 'cost'); if (!x) return;
        L2.data.n = num(D(x).atk); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
      res: function* (g, c, p, L2) { if (L2.data.n > 0) damage(g, opp(p), L2.data.n, { src: c, srcP: p }); } }] },
  // Ported from classic-2.js. PARTIAL: the boost is on every face-up Zombie while this card is face-up, including Zombies that
  // arrive later.
  'Castle of Dark Illusions': {
    cont: { atk: (g, src, m) => src.flags.castle && race(m) === 'Zombie' ? 200 * src.flags.castle : 0, def: (g, src, m) => src.flags.castle && race(m) === 'Zombie' ? 200 * src.flags.castle : 0 },
    effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Zombies gain 200 ATK and DEF', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
        res: function* (g, c) { if (onField(c) && faceUp(c)) { c.flags.castle = 1; g.seq++; log(g, 'Zombie monsters gained 200 ATK and DEF.'); } } },
      { type: 'trig', mand: true, label: 'Zombies gain 200 more', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.flags.castle && c.flags.castle < 5,
        res: function* (g, c) { if (onField(c) && faceUp(c) && c.flags.castle < 5) { c.flags.castle++; g.seq++; log(g, 'Zombie monsters gained 200 more ATK and DEF.'); } } }] },
  'Castle Walls': { effs: [{ type: 'act', ds: true, cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster gains 500 DEF?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { def: 500, end: true }); log(g, `${name(t)} gained 500 DEF.`); } } }] },
  // The damage comes as a mandatory trigger after the chain. PARTIAL: a Normal or Counter Trap counts when it leaves the field
  // after resolving (also when its effect was negated but the card wasn't destroyed); a Continuous Trap counts when it is seen
  // on the chain at a game event (the engine has no resolve event).
  'Chain Burst': { effs: [noop,
    { type: 'trig', loc: 'st', mand: true, label: '1000 damage to the Trap\'s player',
      on: (g, ev, c) => {
        const S = c.used.cb || (c.used.cb = { seen: [], due: [] });
        for (const L2 of g.chain) if (L2.cardAct && isTrap(L2.c) && L2.c !== c && !S.seen.includes(L2)) S.seen.push(L2);
        let fire = false;
        S.seen = S.seen.filter(L2 => { if (g.chain.includes(L2)) return true; if (!L2.negated && (D(L2.c).sub === 'Continuous' || L2.keep)) { S.due.push(L2.p); fire = true; } return false; });
        if (ev.type === 'move' && ev.c !== c && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && isTrap(ev.c) && D(ev.c).sub !== 'Continuous') { S.due.push(ev.snap ? ev.snap.ctrl : ev.c.owner); fire = true; }
        return fire; },
      res: function* (g, c) { const S = c.used.cb; const due = S ? S.due.splice(0) : []; for (const q of due) damage(g, q, 1000, { src: c, srcP: c.ctrl }); } }] },
  'Chain Destruction': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.sw && g.sw.cs.some(x => x.zone === 'm' && faceUp(x) && atk(g, x) <= 2000),
    target: function* (g, c, p, L2) { const [t] = yield* tgt(g, p, L2, 'Target which summoned monster?', g.sw.cs.filter(x => x.zone === 'm' && faceUp(x) && atk(g, x) <= 2000), 1, 1, 'bad'); if (t) { L2.data.n = D(t).n; L2.data.q = t.ctrl; } },
    res: function* (g, c, p, L2) { const { n, q } = L2.data; if (!n) return; const xs = sameName(g, q, n); const grp = g.group;
      for (const x of xs) { const fromDeck = x.zone === 'deck'; move(g, x, 'gy', { reason: 'effect', destroyed: true, by: p, group: grp }); if (fromDeck) shuffleDeck(g, q); }
      log(g, xs.length ? `${xs.length} cop${xs.length > 1 ? 'ies' : 'y'} of ${n} in ${PN(g, q)}'s hand and Deck ${xs.length > 1 ? 'were' : 'was'} destroyed.` : `${PN(g, q)} had no other ${n}.`); shuffleDeck(g, q); } }] },
  'Chain Detonation': { effs: [{ type: 'act',
    res: function* (g, c, p, L2) { damage(g, opp(p), 500, { src: c, srcP: p }); chainReturn(g, c, L2); } }] },
  'Chain Disappearance': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.sw && g.sw.cs.some(x => x.zone === 'm' && faceUp(x) && atk(g, x) <= 1000),
    target: function* (g, c, p, L2) { L2.data.cs = g.sw.cs.slice(); },
    res: function* (g, c, p, L2) { const ms = L2.data.cs.filter(x => x.zone === 'm' && faceUp(x) && atk(g, x) <= 1000); if (!ms.length) return;
      const ns = [...new Set(ms.map(x => D(x).n))]; for (const m of ms) move(g, m, 'ban', { reason: 'effect', by: p }); log(g, `${ns.join(', ')} ${ms.length > 1 ? 'were' : 'was'} banished.`);
      const o = opp(p); const xs = ns.flatMap(n => sameName(g, o, n)); for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: p }); shuffleDeck(g, o);
      if (xs.length) log(g, `${PN(g, o)} banished ${xs.length} more card${xs.length > 1 ? 's' : ''} with the same name from the hand and Deck.`); } }] },
  // Ported from goat-7.js. PARTIAL: the 500 is paid as each card leaves the hand (not as a cost before it), and actions are
  // blocked while a player couldn't pay (500 LP or less for each face-up Chain Energy).
  'Chain Energy': {
    cont: { forbid: (g, src, a) => {
      if (a.p == null || g.p[a.p].lp > 500 * chainEnergies(g).length) return false;
      if (a.type === 'ns' || a.type === 'set' || a.type === 'setST') return true;
      if (a.type === 'ss') return !!(a.c && a.c.zone === 'hand');
      if (a.type === 'activate') return a.c.zone === 'hand' && a.eff.type === 'act' && a.c !== src;
      return false; } },
    effs: [noop,
      { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'move' && ev.c !== c && ev.from === 'hand' && ['m', 'st', 'fz'].includes(ev.to)) pay(g, ev.c.ctrl, 500); return false; }, res: function* () {} }] },
  'Chain Healing': { effs: [{ type: 'act',
    res: function* (g, c, p, L2) { gain(g, p, 500); chainReturn(g, c, L2); } }] },
  // ENGINE: the engine's Fusion Summon helper has no hook for "banish materials from the field, Deck, hand or GY instead".
  // PARTIAL: at resolution its controller may send a Polymerization from the hand to the GY (standing in for activating it) and
  // Fusion Summon by banishing materials from the field, hand, Deck or GY; that monster is destroyed in the End Phase.
  // You can't attack this turn either way.
  'Chain Material': { effs: [
    { type: 'act', cond: (g, c, p) => g.tp === p && g.phase === 'main1',
      res: function* (g, c, p) {
        addRule(g, (g2, a) => a.type === 'attack' && a.c.ctrl === p, { end: g.turnNo }); g.chainMaterial = { p, turn: g.turnNo };
        log(g, `${PN(g, p)} can't attack this turn and may banish Fusion Materials from the field, hand, Deck or GY.`);
        const poly = g.p[p].hand.find(x => named(x, 'Polymerization')); const from = ['m', 'hand', 'deck', 'gy'];
        if (!poly || !(freeM(g, p) >= 0 || monsOf(g, p).length) || !canFusion(g, p, { from })) return;
        if (!(yield* yn(g, p, 'Use a Polymerization from your hand to Fusion Summon with Chain Material now?'))) return;
        move(g, poly, 'gy', { reason: 'effect' }); log(g, `${PN(g, p)} used Polymerization.`);
        const fx = yield* fusionSummon(g, p, { from, banish: true }); shuffleDeck(g, p); if (fx) fx.flags.chainMat = g.turnNo; } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the Fusion Monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(x => x.flags.chainMat === g.turnNo),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.flags.chainMat === g.turnNo), { by: p }); } }] },
  'Chain Strike': { effs: [{ type: 'act',
    cond: (g, c, p, x) => !!x.top && !chainHasDup(g),
    res: function* (g, c, p, L2) { damage(g, opp(p), 400 * L2.link, { src: c, srcP: p }); } }] },
  // PARTIAL: the engine counts Normal Summons in g.ns; this card lets that count go two below its limit once per turn
  // (3 Normal Summons/Sets in all).
  'Chain Summoning': { effs: [{ type: 'act',
    cond: (g, c, p) => g.chain.length >= 2 && !chainHasDup(g),
    res: function* (g, c, p) { if (g.chainSum && g.chainSum[p] === g.turnNo) return; (g.chainSum = g.chainSum || {})[p] = g.turnNo; if (g.tp !== p) { log(g, 'Chain Summoning was activated on the opponent\'s turn.'); return; }
      g.ns[p] -= 2; log(g, `${PN(g, p)} can conduct up to 3 Normal Summons or Sets this turn.`); } }] },
  'Chain Thrasher': { effs: [], self: { maxAttacks: (g, c) => 1 + g.p[c.ctrl].gy.filter(x => named(x, 'Chain Thrasher')).length } },
  'Chaos Burst': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && monsOf(g, p).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 monster', monsOf(g, p), 1, 1, 'cost'); if (x) { const n = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${n}.`); } },
    target: function* (g, c, p, L2) { L2.t = g.aw ? [g.aw.a] : []; },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone === 'm' && destroy(g, [t], { by: p, src: c }).length) damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },
  // PARTIAL: it is a continuous negation; the engine has no hook for it, so it is applied (no prompt) the next time its
  // controller could respond: every monster effect on the chain whose only target is this card is negated.
  'Chaos Command Magician': { effs: [{ type: 'quick', ds: true, speed: 3, label: 'Negate',
    cond: (g, c, p) => { for (const L2 of g.chain) if (!L2.negated && isMon(L2.c) && L2.eff.type !== 'act' && Array.isArray(L2.t) && L2.t.length === 1 && L2.t[0] === c && L2.c !== c) { L2.negated = true; L2.negBy = p; log(g, `Chaos Command Magician negated ${name(L2.c)}'s effect.`); } return false; },
    res: function* () {} }] },
  'Chaos End': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => allCards(g, 'ban').filter(x => x.owner === p).length >= 7 && fieldMons(g).length > 0,
    res: function* (g, c, p) { destroy(g, fieldMons(g), { by: p, src: c }); } }] },
  'Chaos Greed': { effs: [{ type: 'act',
    cond: (g, c, p) => allCards(g, 'ban').filter(x => x.owner === p).length >= 4 && g.p[p].gy.length === 0,
    res: function* (g, c, p) { draw(g, p, 2); } }] },
  'Chaos Necromancer': { effs: [], self: { atk: (g, c) => 300 * g.p[c.ctrl].gy.filter(isMon).length } },
  'Chaos-End Master': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon from the Deck',
    on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => ssable(x) && lv(x) >= 5 && baseAtk(x) <= 1600),
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => ssable(x) && lv(x) >= 5 && baseAtk(x) <= 1600); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon a Level 5 or higher monster with 1600 or less ATK', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
});

// Card Blocker's DEF boost: choose 1 to 3, send that many from the top of the Deck (a cost).
function* blockerMill(g, p) {
  const max = Math.min(3, g.p[p].deck.length); if (!max) return 0;
  const i = yield* choose(g, p, 'Send how many cards from the top of your Deck?', ['1', '2', '3'].slice(0, max)); const n = i + 1;
  const out = []; for (let k = 0; k < n && g.p[p].deck.length; k++) { const x = g.p[p].deck[g.p[p].deck.length - 1]; move(g, x, 'gy', { reason: 'cost' }); out.push(x); }
  log(g, `${PN(g, p)} sent ${out.map(name).join(', ')} from the Deck to the GY.`); return out.length;
}
function* blockerDef(g, c, p) { const n = yield* blockerMill(g, p); if (n && onField(c) && faceUp(c)) { addMod(g, c, { def: 500 * n, end: true }); log(g, `Card Blocker gained ${500 * n} DEF.`); } }
})();
