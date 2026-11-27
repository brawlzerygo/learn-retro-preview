/* Full pool batch 46: Van'Dalgyon the Dark Dragon Lord to Zone Eater (build/batches/full/full-46.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Every card here is Edison-only, so each is one
 shared script from its Edison text and rulings. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, pay, mill, search, addMod, equip, link, addCtr, ctr,
  negate, negateAttack, addRule, tokens, token, fusionSummon, canFusion, ritualSummon, canRitual, winDuel,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField,
  fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, live, opp, oppFaceUp, stOnField, evSummoned,
  battleKill, emit, forbid, stat, negd, isGemini } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const isTuner = x => isMon(x) && !!D(x).tu;
const isSaber = x => /Saber/.test(name(x));
const isXSaber = x => /X-Saber/.test(name(x));
const isSpirit = x => isMon(x) && /Spirit/.test(D(x).ab || '');
const isLightsworn = x => /Lightsworn/.test(name(x));
const sanctuary = g => allField(g).some(x => faceUp(x) && named(x, 'The Sanctuary in the Sky'));
const res0 = g => g.resolvingL || null;
// a monster of this card's controller's opponent was destroyed by battle by this card (with or without being sent to the GY)
const killedByBattle = (ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.prevCtrl !== c.ctrl;
// this card on the field was destroyed by battle and sent to the GY
const battleToGY = (ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.wasField && ev.to === 'gy';
const dealtBattleDmg = (ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl && ev.n > 0;
function discard1(g, p) { return function* () { const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${D(x).n}.`); } }; }
// change a monster's battle position by an effect: a face-down monster becomes face-up Attack Position (Flip Effects don't activate)
function chgPos(g, m) {
  if (!onField(m) || m.zone !== 'm') return;
  const from = m.pos;
  if (from === 'set') { m.pos = 'atk'; log(g, `${D(m).n} was turned face-up in Attack Position.`); }
  else { m.pos = from === 'atk' ? 'def' : 'atk'; log(g, `${name(m)} was changed to ${m.pos === 'atk' ? 'Attack' : 'Defense'} Position.`); }
  g.seq++; emit(g, { type: 'pos', c: m, p: m.ctrl, from });
}
const ritualEffs = rn => [{ type: 'act', tags: { ss: 1 },
  cond: (g, c, p) => canRitual(g, p, { monster: x => named(x, rn) }),
  res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, rn) }); } }];

/* Summon locks: "Cannot be Special Summoned", "Must be Special Summoned with ..." and "Must first be Special Summoned by ...".
 One duel-long rule, installed by the first event any of these cards sees (as full-04.js). A card that was properly summoned
 by its own rule is marked (c.f46nomi) so it can come back from the GY or banished later.
 Effects that Special Summon are told apart by the chain link resolving now (g.resolvingL): a summon rule of the card's own
 runs outside any chain link. ENGINE: no general "can't be Special Summoned" flag yet; a card's cond can still offer a summon
 that this rule then stops at resolution. */
const LOCKS = {
  'Vanity\'s Ruler': () => true,
  'Victory Dragon': () => true,
  'Vennominaga the Deity of Poisonous Snakes': (g, a) => !!res0(g) && !named(res0(g).c, 'Rise of the Snake Deity') && res0(g).c !== a.c,
  'Vennominon the King of Poisonous Snakes': (g, a) => { const r = res0(g); return !!r && isMon(r.c) && r.c !== a.c && r.eff.type !== 'act'; },
  'Water Dragon': (g, a) => !!res0(g) && !named(res0(g).c, 'Bonding - H2O'),
  // only ever by its own procedure (ruling)
  'Woodland Archer': (g, a) => ['gy', 'ban', 'deck'].includes(a.c.zone) || (a.c.zone === 'hand' && !!res0(g)),
  // its own procedure first; once properly summoned it can be revived
  'Yamato-no-Kami': (g, a) => (['gy', 'ban'].includes(a.c.zone) && !a.c.f46nomi) || (['hand', 'deck'].includes(a.c.zone) && !!res0(g)),
  'VW-Tiger Catapult': (g, a) => (a.c.zone === 'extra' && a.how !== 'fusion') || (['gy', 'ban'].includes(a.c.zone) && !a.c.f46nomi),
  'VWXYZ-Dragon Catapult Cannon': (g, a) => (a.c.zone === 'extra' && a.how !== 'fusion') || (['gy', 'ban'].includes(a.c.zone) && !a.c.f46nomi),
  // PARTIAL: only its Ritual Summon is checked (by "Zera Ritual"); other effects that would Special Summon it from the hand aren't
  'Zera the Mant': (g, a) => a.how === 'ritual' && !(res0(g) && named(res0(g).c, 'Zera Ritual')),
};
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: (g, ev, c) => {
    if (!g.f46lock) { g.f46lock = true; addRule(g, (g2, a) => { if (a.type !== 'ss' || !a.c || a.c.id == null) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); }
    if (ev.type === 'summon' && ev.cs.includes(c) && !ev.byEffect) c.f46nomi = true;
    return false; } };

/* What a Counter Trap of `owner` negated: read when the resolved Counter Trap leaves the field (the negated links are still
 on the chain under it). Each negated link is counted once. */
function counterResolved(ev, owner) {
  return ev.type === 'move' && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && isTrap(ev.c) && D(ev.c).sub === 'Counter' && ev.prevCtrl === owner;
}
function counterNegs(g, ev, owner) {
  if (!counterResolved(ev, owner)) return [];
  ev.f46 = ev.f46 || {};
  if (!ev.f46[owner]) {
    const ks = [];
    for (const L2 of g.chain) if (L2.negated && L2.negBy === owner && L2.p !== owner && !L2.f46seen) {
      L2.f46seen = true;
      if (L2.cardAct && isSpell(L2.c)) ks.push('spell'); else if (L2.cardAct && isTrap(L2.c)) ks.push('trap'); else if (isMon(L2.c) && L2.eff.type !== 'act') ks.push('monster');
    }
    ev.f46[owner] = ks;
  }
  return ev.f46[owner];
}

/* Union monsters (port of full-29.js): once per turn equip to a monster you control, or unequip and Special Summon in Attack
 Position; a monster has at most 1 Union; "if the equipped monster would be destroyed, destroy this card instead". */
const hasUnion = (g, m) => allField(g).some(x => x.zone === 'st' && x.equipTo === m.u && x.flags.union);
function unionEffs(okTarget, text) {
  const cands = (g, c, p) => monsOf(g, p).filter(x => x !== c && faceUp(x) && okTarget(x) && !hasUnion(g, x));
  return [
    { type: 'ign', label: 'Equip to a monster',
      cond: (g, c, p) => c.used.union !== g.turnNo && freeST(g, p) >= 0 && cands(g, c, p).length > 0,
      after: (g, c) => { c.used.union = g.turnNo; },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, cands(g, c, p), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !okTarget(t) || c.zone !== 'm' || !faceUp(c) || freeST(g, p) < 0 || hasUnion(g, t)) return;
        move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); c.equipTo = t.u; c.flags.union = true; log(g, `${D(c).n} was equipped to ${name(t)}.`); } },
    { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Unequip and Special Summon',
      cond: (g, c, p) => c.used.union !== g.turnNo && !!c.equipTo && !!c.flags.union && freeM(g, p) >= 0,
      after: (g, c) => { c.used.union = g.turnNo; },
      res: function* (g, c, p) { if (c.zone !== 'st' || !c.equipTo) return; c.equipTo = null; c.flags.union = false; ss(g, p, c, 'atk'); } }];
}
const unionCont = (a, d) => ({
  atk: (g, src, m) => src.zone === 'st' && src.flags.union && src.equipTo === m.u ? a : 0,
  def: (g, src, m) => src.zone === 'st' && src.flags.union && src.equipTo === m.u ? d : 0,
  replaceDestroy: (g, src, m, o) => {
    if (o.rule || src.zone !== 'st' || src.equipTo !== m.u || !src.flags.union) return false;
    move(g, src, 'gy', { reason: o.battle ? 'battle' : 'effect', destroyed: true, by: o.by }); log(g, `${D(src).n} was destroyed instead of ${name(m)}.`); return true; } });

// Contact Fusions: Special Summoned from the Extra Deck by banishing the listed monsters you control (face-down ones too)
function contactProc(names) {
  const have = (g, p, n) => monsOf(g, p).filter(x => named(x, n));
  return { extra: true, how: 'fusion', label: `Special Summon (banish ${names.join(' + ')})`,
    cond: (g, c, p) => names.every(n => have(g, p, n).length > 0),
    cost: function* (g, c, p, grp) {
      const out = [];
      for (const n of names) { const cs = have(g, p, n); const [x] = cs.length > 1 ? yield* pick(g, p, `Banish which ${n}?`, cs, 1, 1, 'cost') : cs; if (x) out.push(x); }
      for (const x of out) move(g, x, 'ban', { reason: 'cost', by: p, group: grp });
      log(g, `${PN(g, p)} banished ${out.map(x => D(x).n).join(' and ')}.`); } };
}

/* A Trap with no response window in the engine at its moment (after battle damage): a trigger that only fires while the card
 is Set (and wasn't Set this turn). It turns face-up, counts as a Trap Card activation at Spell Speed 2 and goes to the GY
 after it resolves (port of classic-5.js trapTrig). ENGINE: no response window after battle damage. */
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });

/* "Destroy this card if ..." kept up by the card itself. PARTIAL: done as a mandatory trigger (it uses a chain link) checked at
 every game event while the card is face-up, not as a rule with no chain. */
const selfDestroyIf = (test, why) => ({ type: 'trig', mand: true, label: why, tags: { destroy: 1 },
  on: (g, ev, c) => onField(c) && faceUp(c) && !g.chain.some(L2 => L2.c === c) && test(g, c),
  res: function* (g, c, p) { if (onField(c) && faceUp(c) && test(g, c)) { log(g, `${name(c)} is destroyed by its own effect.`); destroy(g, [c], { by: p }); } } });

// Combinations of Tuners in a GY whose Levels add up to n, at most k cards
function tunerSets(g, p, n, k) {
  const pool = g.p[p].gy.filter(isTuner), out = [];
  const rec = (i, cur, s) => { if (out.length >= 10) return; if (s === n && cur.length) { out.push(cur.slice()); return; } if (s >= n || cur.length >= k) return;
    for (let j = i; j < pool.length; j++) { cur.push(pool[j]); rec(j + 1, cur, s + lv(pool[j])); cur.pop(); } };
  rec(0, [], 0); return out;
}
const varietyOk = (g, p, x) => faceUp(x) && D(x).k === 'synchro' && tunerSets(g, p, lv(x), nFreeM(g, p) + 1).length > 0;

E.addScripts({
  /* ----- V ----- */
  // PARTIAL: the ② effects resolve as part of the Special Summon (no new chain), each target is picked as it resolves, and the
  // "1 Trigger Effect in the hand per chain" limit isn't kept across several copies.
  'Van\'Dalgyon the Dark Dragon Lord': { effs: [{ type: 'trig', loc: 'hand', tags: { ss: 1 }, label: 'Special Summon this card',
    on: (g, ev, c) => { if (g.inDS) return false; const ks = counterNegs(g, ev, c.owner); if (!ks.length) return false; c.f46vdk = ks; return true; },
    cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) {
      const ks = c.f46vdk || []; c.f46vdk = null;
      if (c.zone !== 'hand' || !ss(g, p, c, 'atk')) return;
      if (ks.includes('spell')) damage(g, opp(p), 1500, { src: c, srcP: p });
      if (ks.includes('trap') && fieldOf(g, opp(p)).length) { const [t] = yield* pick(g, p, 'Destroy which card your opponent controls?', fieldOf(g, opp(p)), 1, 1, 'bad'); if (t) destroy(g, [t], { by: p, src: c }); }
      if (ks.includes('monster') && freeM(g, p) >= 0) { const cs = g.p[p].gy.filter(x => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' })); if (cs.length) { const [t] = yield* pick(g, p, 'Special Summon which monster from your GY?', cs, 1, 1, 'good'); if (t) ss(g, p, t, 'atk'); } } } }] },
  'Vanguard of the Dragon': { effs: [
    { type: 'ign', label: 'Send a Dragon: +300 ATK', cond: (g, c, p) => g.p[p].hand.some(x => isMon(x) && race(x) === 'Dragon'),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send a Dragon monster from your hand to the GY', g.p[p].hand.filter(x => isMon(x) && race(x) === 'Dragon'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 300 }); log(g, `${name(c)} gained 300 ATK.`); } } },
    { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon a Dragon Normal Monster',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy' && ev.prevCtrl === c.owner && !ev.battle && ev.reason !== 'cost' && ev.by != null && ev.by !== c.owner,
      cond: (g, c, p) => freeM(g, p) >= 0 && allCards(g, 'gy').some(x => D(x).k === 'normal' && race(x) === 'Dragon'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Dragon Normal Monster from either GY?', allCards(g, 'gy').filter(x => D(x).k === 'normal' && race(x) === 'Dragon'), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  // PARTIAL: every other link is negated, even one whose activation can't be negated (Stumbling style rulings).
  'Vanity\'s Call': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.chain.length >= 3 && g.p[p].lp > 1,
    cost: function* (g, c, p) { pay(g, p, Math.floor(g.p[p].lp / 2)); },
    res: function* (g, c, p) { for (const L2 of g.chain.slice()) if (L2.c !== c && !L2.negated) { L2.negBy = p; negate(g, L2, true); } } }] },
  'Vanity\'s Ruler': { cont: { forbid: (g, src, a) => a.type === 'ss' && a.p !== src.ctrl },
    effs: [lockInstall] },
  // Negates an inherent summon (Normal, Flip, Synchro, a summon by a card's own rule) with no chain going.
  'Vanquishing Light': { effs: [{ type: 'act', negSummon: true, tags: { destroy: 1 },
    cond: (g, c, p, x) => !x.top && !!g.attempt && monsOf(g, p).some(isLightsworn),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 Lightsworn monster', monsOf(g, p).filter(isLightsworn), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    res: function* (g) { if (g.attempt) { g.attempt.negated = true; log(g, 'The summon was negated.'); } } }] },
  'Variety Comes Out': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => varietyOk(g, p, x)),
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Return which Synchro Monster to the Extra Deck?', monsOf(g, p).filter(x => varietyOk(g, p, x)), 1, 1, 'cost'); if (!x) return;
      L2.data.lv = lv(x); move(g, x, 'extra', { reason: 'cost', by: p }); log(g, `${PN(g, p)} returned ${D(x).n} to the Extra Deck.`); },
    target: function* (g, c, p, L2) { const sets = tunerSets(g, p, L2.data.lv || 0, nFreeM(g, p)); if (!sets.length) { L2.t = []; return; }
      const i = sets.length > 1 ? yield* choose(g, p, 'Special Summon which Tuners?', sets.map(s => s.map(x => `${D(x).n} (Lv ${lv(x)})`).join(' + '))) : 0; L2.t = sets[i]; },
    after: (g, c, p) => { addRule(g, (g2, a) => a.type === 'ss' && a.how === 'synchro' && a.p === p, { end: g.turnNo }); },
    res: function* (g, c, p, L2) { for (const t of L2.t) if (t.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, t, 'atk'); } }] },
  // PARTIAL: "its effects can't be negated" isn't kept (ENGINE: no "can't be negated" flag); "can't be destroyed by card effects"
  // lasts while it stays face-up.
  'Vehicroid Connection Zone': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => canFusion(g, p, { filter: fx => /Vehicroid/.test(D(fx).n) }),
    res: function* (g, c, p) { const fx = yield* fusionSummon(g, p, { filter: x => /Vehicroid/.test(D(x).n) }); if (fx && onField(fx)) { fx.flags.noEffectDestroy = true; log(g, `${name(fx)} can't be destroyed by card effects.`); } } }] },
  'Veil of Darkness': { effs: [actNoop,
    { type: 'trig', loc: 'st', label: 'Send drawn DARK monsters: draw 1',
      on: (g, ev, c) => { if (!(ev.type === 'move' && ev.reason === 'draw' && ev.to === 'hand' && g.phase === 'draw' && g.tp === c.ctrl && ev.c.owner === c.ctrl && isMon(ev.c) && attr(ev.c) === 'DARK')) return false; ev.c.f46veil = g.turnNo; return true; },
      cond: (g, c, p) => g.p[p].hand.some(x => x.f46veil === g.turnNo && isMon(x) && attr(x) === 'DARK'),
      res: function* (g, c, p) {
        const cs = g.p[p].hand.filter(x => x.f46veil === g.turnNo && isMon(x) && attr(x) === 'DARK'); if (!cs.length) return;
        const xs = yield* pick(g, p, 'Reveal and send which drawn DARK monsters to the GY?', cs, 1, cs.length, 'cost');
        for (const x of xs) x.f46veil = 0;
        const gone = xs.filter(x => x.zone === 'hand'); if (!gone.length) return;
        for (const x of gone) move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${PN(g, p)} sent ${gone.map(x => D(x).n).join(', ')} to the GY.`);
        if (g.p[p].deck.length && gone.some(x => x.zone === 'gy') && (yield* yn(g, p, 'Draw 1 card with Veil of Darkness?'))) draw(g, p, 1); } }] },
  // PARTIAL: "unaffected by Spell/Trap effects and other Effect Monsters' effects" covers targeting and destruction only
  // (ENGINE: no general "unaffected" check for ATK changes, bouncing, banishing or control).
  'Vennominaga the Deity of Poisonous Snakes': {
    self: { atk: (g, c) => 500 * g.p[c.ctrl].gy.filter(x => isMon(x) && race(x) === 'Reptile').length,
      unaffectedSpells: true, unaffectedTraps: true, cantBeTargeted: true, targetFilter: (g, x, L2) => L2.c !== x,
      noEffectDestroy: (g, c) => !!res0(g) && res0(g).c !== c },
    effs: [lockInstall,
      { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Banish a Reptile: Special Summon this card',
        on: (g, ev, c) => battleToGY(ev, c),
        cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => x !== c && isMon(x) && race(x) === 'Reptile'),
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish 1 other Reptile from your GY', g.p[p].gy.filter(x => x !== c && isMon(x) && race(x) === 'Reptile'), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
        res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c, 'atk'); } },
      { type: 'trig', mand: true, label: 'Place a Hyper-Venom Counter', on: (g, ev, c) => dealtBattleDmg(ev, c),
        res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; addCtr(g, c, 'venom', 1); g.seq++; const n = ctr(c, 'venom'); log(g, `${name(c)} has ${n} Hyper-Venom Counter${n > 1 ? 's' : ''}.`);
          if (n >= 3) winDuel(g, p, `${PN(g, p)} won with 3 Hyper-Venom Counters on Vennominaga`); } }] },
  // "Unaffected by Venom Swamp": no Venom Swamp script uses counters in this engine yet, so nothing to stop.
  'Vennominon the King of Poisonous Snakes': {
    self: { atk: (g, c) => 500 * g.p[c.ctrl].gy.filter(x => isMon(x) && race(x) === 'Reptile').length },
    effs: [lockInstall,
      { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Banish a Reptile: Special Summon this card',
        on: (g, ev, c) => battleToGY(ev, c),
        cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => x !== c && isMon(x) && race(x) === 'Reptile'),
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish 1 other Reptile from your GY', g.p[p].gy.filter(x => x !== c && isMon(x) && race(x) === 'Reptile'), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
        res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c, 'atk'); } }] },
  // The return to the hand replaces the battle destruction; the rest resolves as a trigger right after.
  // PARTIAL: the Evil Token is Summoned in Attack Position.
  'Vicious Claw': {
    cont: { atk: (g, src, m) => src.zone === 'st' && src.equipTo === m.u ? 300 : 0,
      replaceDestroy: (g, src, m, o) => {
        if (!o.battle || src.zone !== 'st' || src.equipTo !== m.u) return false;
        const other = g.battle ? (g.battle.a === m ? g.battle.t : g.battle.a) : null;
        src.f46claw = { p: src.ctrl, other: other ? other.u : null };
        log(g, `Vicious Claw returned to the hand instead of ${name(m)} being destroyed.`);
        move(g, src, 'hand', { reason: 'effect' }); return true; } },
    effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Vicious Claw to which monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) equip(g, c, t); } },
      { type: 'trig', loc: 'hand', mand: true, tags: { destroy: 1 }, label: 'Destroy a monster, 600 damage, Evil Token',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'hand' && !!c.f46claw,
        res: function* (g, c) {
          const r = c.f46claw; c.f46claw = null; if (!r) return; const p = r.p, u = c.u, owner = c.owner;
          addRule(g, (g2, a) => (a.type === 'activate' || a.type === 'setST') && a.c && a.c.u === u, { end: g.turnNo });
          log(g, `${PN(g, owner)} can't use that Vicious Claw from the hand this turn.`);
          const cs = fieldMons(g).filter(x => x.u !== r.other);
          if (cs.length) { const [t] = yield* pick(g, p, 'Destroy which monster?', cs, 1, 1, 'bad'); if (t && destroy(g, [t], { by: p, src: c }).length) damage(g, opp(p), 600, { src: c, srcP: p }); }
          tokens(g, opp(p), { n: 'Evil Token', a: 'DARK', r: 'Fiend', lv: 7, atk: 2500, def: 2500 }, 1, 'atk'); } }] },
  'Victoria': {
    cont: { grant: (g, src, m, flag) => flag === 'noAttackTarget' && m !== src && m.ctrl === src.ctrl && m.zone === 'm' && faceUp(m) && race(m) === 'Fairy' },
    effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Special Summon a Dragon from their GY',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[opp(p)].gy.some(x => isMon(x) && race(x) === 'Dragon'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Dragon from your opponent\'s GY?', g.p[opp(p)].gy.filter(x => isMon(x) && race(x) === 'Dragon'), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  // Tribute Summon only with 3 Dragons: offered only while you control 3 or more Dragon monsters.
  // PARTIAL: "Win the Match" is a duel win here. The engine's Tribute pick can't be limited to Dragons, so with 3 Dragons and other monsters a non-Dragon can still be picked.
  'Victory Dragon': { self: { tribExact: 3 }, effs: [lockInstall, { type: 'trig', loc: 'any', res: noop,
    on: (g) => { if (!g.f46vd) { g.f46vd = true; addRule(g, (g2, a) => (a.type === 'ns' || a.type === 'set') && !!a.c && named(a.c, 'Victory Dragon') && monsOf(g2, a.p).filter(x => race(x) === 'Dragon').length < 3); } return false; } }] },
  // The Option Token follows Victory Viper's ATK/DEF through Victory Viper's own continuous effect, and leaves with it.
  // PARTIAL: if Victory Viper is turned face-down the token stays (as 0/0).
  'Victory Viper XX03': {
    cont: { atk: (g, src, m) => m.flags.f46opt === src.u && m !== src ? stat(g, src, 'atk') : 0,
      def: (g, src, m) => m.flags.f46opt === src.u && m !== src ? stat(g, src, 'def') : 0 },
    effs: [{ type: 'trig', mand: true, label: 'Choose an effect',
      on: (g, ev, c) => killedByBattle(ev, c),
      target: function* (g, c, p, L2) {
        const sts = stOnField(g).filter(faceUp);
        const opts = ['This card gains 400 ATK', ...(sts.length ? ['Destroy a face-up Spell/Trap'] : []), 'Special Summon an Option Token'];
        const i = yield* choose(g, p, 'Victory Viper XX03: activate which effect?', opts); L2.data.mode = opts[i];
        if (L2.data.mode.startsWith('Destroy')) { yield* tgt(g, p, L2, 'Destroy which face-up Spell/Trap?', sts, 1, 1, 'bad'); L2.tags = { destroy: 1 }; } },
      res: function* (g, c, p, L2) { const m = L2.data.mode || '';
        if (m.startsWith('This')) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 400 }); log(g, `${name(c)} gained 400 ATK.`); } }
        else if (m.startsWith('Destroy')) destroy(g, live(L2), { by: p, src: c });
        else if (onField(c) && faceUp(c)) { const tk = token(g, p, { n: 'Option Token', a: attr(c), r: race(c), lv: lv(c), atk: 0, def: 0 }, 'atk'); if (tk) { tk.flags.f46opt = c.u; g.seq++; log(g, `${PN(g, p)} Special Summoned an Option Token.`); emit(g, { type: 'summon', cs: [tk], how: 'special', p, byEffect: true }); } } } },
      { type: 'trig', loc: 'any', mand: true, label: 'Remove the Option Tokens',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to !== 'm' && fieldMons(g).some(x => x.flags.f46opt === c.u),
        res: function* (g, c) { const ts = fieldMons(g).filter(x => x.flags.f46opt === c.u); for (const t of ts) move(g, t, 'gy', { reason: 'rule' }); if (ts.length) log(g, `${ts.length} Option Token${ts.length > 1 ? 's were' : ' was'} removed from the field.`); } }] },
  'Violet Witch': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Add a Plant with 1500 or less DEF',
    on: (g, ev, c) => battleToGY(ev, c),
    res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && race(x) === 'Plant' && L.num(D(x).def) <= 1500, 'Add a Plant monster with 1500 or less DEF'); } }] },
  'Viper\'s Rebirth': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(isMon) && g.p[p].gy.filter(isMon).every(x => race(x) === 'Reptile') && g.p[p].gy.some(x => isMon(x) && !isTuner(x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which non-Tuner monster from your GY?', g.p[p].gy.filter(x => isMon(x) && !isTuner(x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && ss(g, p, t, 'atk')) { c.f46vr = { u: t.u, turnIn: t.turnIn, turn: g.turnNo }; log(g, `${name(t)} will be destroyed in the End Phase.`); } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the revived monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!c.f46vr && c.f46vr.turn === g.turnNo,
      res: function* (g, c, p) { const r = c.f46vr; c.f46vr = null; const t = r && fieldMons(g).find(x => x.u === r.u && x.turnIn === r.turnIn); if (t) destroy(g, [t], { by: p, src: c }); } }] },
  'Virus Cannon': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => D(x).k !== 'token'),
    cost: function* (g, c, p, L2) { const cs = monsOf(g, p).filter(x => D(x).k !== 'token'); const xs = yield* pick(g, p, 'Tribute any number of monsters (not Tokens)', cs, 1, cs.length, 'cost');
      const grp = g.group; for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); L2.data.n = xs.length; log(g, `${PN(g, p)} Tributed ${xs.map(x => D(x).n).join(', ')}.`); },
    res: function* (g, c, p, L2) { const o = opp(p), sp = g.p[o].deck.filter(isSpell); const n = Math.min(L2.data.n || 0, sp.length);
      if (!n) { log(g, `${PN(g, o)} has no Spells in the Deck.`); return; }
      const xs = n === sp.length ? sp : yield* pick(g, o, `Send ${n} Spell${n > 1 ? 's' : ''} from your Deck to the GY`, sp, n, n, 'cost');
      for (const x of xs) move(g, x, 'gy', { reason: 'effect', by: p }); shuffleDeck(g, o); log(g, `${PN(g, o)} sent ${xs.map(x => D(x).n).join(', ')} from the Deck to the GY.`); } }] },
  'Viser Des': {
    self: { noBattleDestroy: (g, c) => !!c.flags.f46vd && fieldMons(g).some(x => x.u === c.flags.f46vd.u && x.turnIn === c.flags.f46vd.turnIn) },
    effs: [{ type: 'trig', mand: true, label: 'Target a monster to destroy later',
      on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']), cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which monster your opponent controls?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !onField(c) || !faceUp(c)) return; c.flags.f46vd = { u: t.u, turnIn: t.turnIn, n: 0 }; g.seq++; log(g, `${t.pos === 'set' ? 'The face-down monster' : name(t)} will be destroyed during ${PN(g, p)}'s third Standby Phase from now.`); } },
      { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the targeted monster',
        on: (g, ev, c) => { const r = c.flags.f46vd; if (!r || ev.type !== 'phase' || ev.ph !== 'standby' || ev.tp !== c.ctrl) return false;
          if (!fieldMons(g).some(x => x.u === r.u && x.turnIn === r.turnIn)) { c.flags.f46vd = null; return false; } r.n++; return r.n >= 3; },
        res: function* (g, c, p) { const r = c.flags.f46vd; if (!r || !onField(c)) return; c.flags.f46vd = null; const t = fieldMons(g).find(x => x.u === r.u && x.turnIn === r.turnIn); if (t) destroy(g, [t], { by: p, src: c }); } }] },
  // PARTIAL: a Counter Trap negated without being destroyed still counts as resolved.
  'Voltanis the Adjudicator': { effs: [
    { type: 'trig', loc: 'hand', tags: { ss: 1 }, label: 'Tribute all your monsters: Special Summon this card',
      on: (g, ev, c) => !g.inDS && counterResolved(ev, c.owner),
      cond: (g, c, p) => monsOf(g, p).length > 0,
      cost: function* (g, c, p) { const ms = monsOf(g, p); c.f46volt = ms.filter(x => faceUp(x) && race(x) === 'Fairy').length;
        const grp = g.group; for (const x of ms) move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${ms.map(x => D(x).n).join(', ')}.`); },
      res: function* (g, c, p) { const n = c.f46volt || 0; c.f46volt = 0; if (c.zone !== 'hand' || freeM(g, p) < 0) return; c.f46voltN = n; if (!ss(g, p, c, 'atk')) c.f46voltN = 0; } },
    { type: 'trig', tags: { destroy: 1 }, label: 'Destroy cards for each Fairy Tributed',
      on: (g, ev, c) => { if (!(ev.type === 'summon' && ev.cs.includes(c) && c.f46voltN)) return false; c.flags.f46voltN = c.f46voltN; c.f46voltN = 0; return true; },
      cond: (g, c, p) => !g.inDS && (c.flags.f46voltN || 0) > 0 && fieldOf(g, opp(p)).length > 0,
      res: function* (g, c, p) { const n = c.flags.f46voltN || 0; c.flags.f46voltN = 0; const cs = fieldOf(g, opp(p)); if (!n || !cs.length) return;
        const xs = yield* pick(g, p, `Destroy up to ${n} card${n > 1 ? 's' : ''} your opponent controls`, cs, 1, Math.min(n, cs.length), 'bad'); destroy(g, xs, { by: p, src: c }); } }] },
  'Voltic Kong': { effs: [{ type: 'trig', mand: true, label: 'Send cards from the top of their Deck',
    on: (g, ev, c) => dealtBattleDmg(ev, c),
    res: function* (g, c, p) { const n = monsOf(g, p).filter(x => faceUp(x) && attr(x) === 'LIGHT').length; if (n) mill(g, opp(p), n); } }] },
  'Vortex Trooper': { effs: [
    { type: 'trig', when: true, label: 'Shuffle 2 cards into the Deck, draw 2',
      on: (g, ev, c) => evSummoned(ev, c, ['normal']), cond: (g, c, p) => g.p[p].hand.length >= 2,
      res: function* (g, c, p) { if (g.p[p].hand.length < 2) return; const xs = yield* pick(g, p, 'Shuffle 2 cards from your hand into the Deck', g.p[p].hand, 2, 2, 'cost');
        for (const x of xs) move(g, x, 'deck', { reason: 'effect', by: p }); log(g, `${PN(g, p)} shuffled 2 cards into the Deck.`); draw(g, p, 2); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Draw 1 card',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField,
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  'VW-Tiger Catapult': { mats: [() => false, () => false], proc: contactProc(['V-Tiger Jet', 'W-Wing Catapult']),
    effs: [lockInstall, { type: 'ign', label: 'Discard: change a monster\'s position',
      cond: (g, c, p) => g.p[p].hand.length > 0 && monsOf(g, opp(p)).length > 0,
      cost: function* (g, c, p) { yield* discard1(g, p)(); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change the position of which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) chgPos(g, t); } }] },
  // PARTIAL: the banish effect is optional here (the ruling says it must be used if the opponent has a card).
  'VWXYZ-Dragon Catapult Cannon': { mats: [() => false, () => false], proc: contactProc(['VW-Tiger Catapult', 'XYZ-Dragon Cannon']),
    effs: [lockInstall,
      { type: 'ign', opt: true, label: 'Banish a card your opponent controls', cond: (g, c, p) => fieldOf(g, opp(p)).length > 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which card?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished.`); } } },
      { type: 'trig', when: true, label: 'Change the attack target\'s position',
        on: (g, ev, c) => ev.type === 'attack' && ev.a === c && !!ev.t,
        target: function* (g, c, p, L2) { const t = g.aw && g.aw.t; if (t && onField(t)) yield* tgt(g, p, L2, 'Change the attack target\'s position', [t], 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) chgPos(g, t); } }] },
  'W-Wing Catapult': { cont: unionCont(400, 400), effs: unionEffs(x => named(x, 'V-Tiger Jet'), 'Equip W-Wing Catapult to which V-Tiger Jet?') },

  /* ----- W ----- */
  'War-Lion Ritual': { effs: ritualEffs('Super War-Lion') },
  'Warm Worm': { effs: [{ type: 'trig', loc: 'any', mand: true, label: 'Send their top 3 cards to the GY',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField,
    res: function* (g, c, p) { mill(g, opp(p), 3); } }] },
  'Water Dragon': {
    cont: { atk: (g, src, m) => m.zone === 'm' && faceUp(m) && (attr(m) === 'FIRE' || race(m) === 'Pyro') ? -1e6 : 0 },
    effs: [lockInstall,
      { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon 2 Hydrogeddon and 1 Oxygeddon',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField && ev.to === 'gy',
        cond: (g, c, p) => nFreeM(g, p) >= 3 && g.p[p].gy.filter(x => named(x, 'Hydrogeddon')).length >= 2 && g.p[p].gy.some(x => named(x, 'Oxygeddon')),
        target: function* (g, c, p, L2) { const hs = yield* pick(g, p, 'Target 2 Hydrogeddon', g.p[p].gy.filter(x => named(x, 'Hydrogeddon')), 2, 2, 'good'); const os = yield* pick(g, p, 'Target 1 Oxygeddon', g.p[p].gy.filter(x => named(x, 'Oxygeddon')), 1, 1, 'good'); L2.t = [...hs, ...os]; },
        res: function* (g, c, p, L2) { for (const t of L2.t) if (t.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, t, 'atk'); } }] },
  'Water Hazard': { effs: [actNoop,
    { type: 'ign', loc: 'st', opt: true, tags: { ss: 1 }, label: 'Special Summon a Level 4 or lower WATER',
      cond: (g, c, p) => monsOf(g, p).length === 0 && freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && attr(x) === 'WATER' && lv(x) <= 4),
      res: function* (g, c, p) { if (monsOf(g, p).length) return; const cs = g.p[p].hand.filter(x => isMon(x) && attr(x) === 'WATER' && lv(x) <= 4); if (!cs.length) return;
        const [x] = yield* pick(g, p, 'Special Summon which Level 4 or lower WATER monster?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  'Weed Out': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.p[p].lp > 500 && fieldMons(g).some(x => x.pos === 'atk' && lv(x) === 3),
    cost: function* (g, c, p) { pay(g, p, 500); },
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.pos === 'atk' && faceUp(x) && lv(x) === 3), { by: p, src: c }); } }] },
  'Weeping Idol': { effs: [{ type: 'ign', loc: 'hand', tags: { ss: 1 }, label: 'Banish a Tuner: Special Summon this card',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(isTuner),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish 1 Tuner from your GY', g.p[p].gy.filter(isTuner), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
    res: function* (g, c, p) { if (c.zone === 'hand') ss(g, p, c, 'atk'); } }] },
  'Wetlands': { cont: { atk: (g, src, m) => m.zone === 'm' && faceUp(m) && race(m) === 'Aqua' && attr(m) === 'WATER' && lv(m) <= 2 ? 1200 : 0 }, effs: [actNoop] },
  'Whirlwind Weasel': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Opponent can\'t activate Spells/Traps',
    on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { const o = opp(p); addRule(g, (g2, a) => a.type === 'activate' && a.p === o && a.c && isST(a.c) && a.eff && a.eff.type === 'act', { end: g.turnNo }); log(g, `${PN(g, o)} can't activate Spell or Trap Cards this turn.`); } }] },
  // PARTIAL: its tie works both ways through link() (either one leaving the field destroys the other).
  'Wicked Rebirth': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => g.p[p].lp > 800 && freeM(g, p) >= 0 && g.p[p].gy.some(x => D(x).k === 'synchro'),
    cost: function* (g, c, p) { pay(g, p, 800); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Synchro Monster from your GY?', g.p[p].gy.filter(x => D(x).k === 'synchro'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0];
      if (!t || t.zone !== 'gy' || !onField(c) || !ss(g, p, t, 'atk', { negate: true })) { if (onField(c)) move(g, c, 'gy', { reason: 'rule' }); return; }
      link(g, c, t); const u = t.u; addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.u === u, { end: g.turnNo }); log(g, `${name(t)}'s effects are negated and it can't attack this turn.`); } }] },
  // The 2 monsters are held on the card (c.f46dud). PARTIAL: its destructions use a chain link.
  'Widespread Dud': { effs: [{ type: 'act', cond: g => fieldMons(g).filter(x => x.pos === 'atk' && faceUp(x)).length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select 2 Attack Position monsters', fieldMons(g).filter(x => x.pos === 'atk' && faceUp(x)), 2, 2, 'bad'); },
    res: function* (g, c, p, L2) { const ts = live(L2).filter(faceUp); if (!onField(c) || !ts.length) { if (onField(c)) move(g, c, 'gy', { reason: 'rule' }); return; } c.f46dud = ts.map(x => ({ u: x.u, turnIn: x.turnIn })); g.seq++; log(g, `${ts.map(name).join(' and ')} ${ts.length > 1 ? 'were' : 'was'} selected.`); } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy this card',
      on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.c !== c && !!c.f46dud && c.f46dud.some(r => r.u === ev.c.u),
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the selected monsters',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !!c.f46dud,
      res: function* (g, c, p) { const rs = c.f46dud || []; c.f46dud = null; const ts = fieldMons(g).filter(x => rs.some(r => r.u === x.u && r.turnIn === x.turnIn)); if (ts.length) destroy(g, ts, { by: p, src: c }); } }] },
  'Wild Fire': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.p[p].lp > 500 && stOf(g, p).some(x => x !== c && faceUp(x) && /Blaze Accelerator/.test(name(x))) && fieldMons(g).length > 0 && !forbid(g, { type: 'ss', c: { id: null, owner: p, flags: {}, zone: 'tok' }, p, how: 'special' }),
    cost: function* (g, c, p) { pay(g, p, 500); },
    target: function* (g, c, p, L2) { const bs = stOf(g, p).filter(x => x !== c && faceUp(x) && /Blaze Accelerator/.test(name(x))); L2.t = bs.length > 1 ? yield* pick(g, p, 'Destroy which Blaze Accelerator card?', bs, 1, 1, 'cost') : bs; },
    res: function* (g, c, p, L2) { const b = live(L2).filter(faceUp)[0]; if (!b) return; destroy(g, [b], { by: p, src: c });
      const ms = fieldMons(g); if (!ms.length) return; destroy(g, ms, { by: p, src: c });
      tokens(g, p, { n: 'Wild Fire Token', a: 'FIRE', r: 'Pyro', lv: 3, atk: 1000, def: 1000 }, 1, 'atk');
      addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.ctrl === p, { end: g.turnNo }); log(g, `${PN(g, p)} can't declare an attack this turn.`); } }] },
  // PARTIAL: the other Tribute isn't checked to be Wind Effigy itself (as Dark Effigy, full-05.js).
  'Wind Effigy': { cont: { tributes: (g, src, c, p, need) => src.ctrl === p && D(c).k === 'normal' && attr(c) === 'WIND' && need === 2 && !negd(g, src) ? 1 : null } },
  'Wolf in Sheep\'s Clothing': { effs: [trapTrig({ label: 'Special Summon Level 1 monsters', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.direct && ev.p === c.ctrl && ev.srcP !== c.ctrl && ev.n > 0,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && lv(x) === 1 && g.p[p].deck.some(y => D(y).n === D(x).n)),
    cost: function* (g, c, p, L2) { const cs = g.p[p].hand.filter(x => isMon(x) && lv(x) === 1 && g.p[p].deck.some(y => D(y).n === D(x).n)); const [x] = yield* pick(g, p, 'Reveal a Level 1 monster in your hand', cs, 1, 1, 'good'); L2.data.x = x; if (x) log(g, `${PN(g, p)} revealed ${D(x).n}.`); },
    res: function* (g, c, p, L2) { const x = L2.data.x; if (!x || x.zone !== 'hand') return; const y = g.p[p].deck.find(z => D(z).n === D(x).n);
      ss(g, p, x, 'atk'); if (y) { if (freeM(g, p) >= 0) ss(g, p, y, 'atk'); else { move(g, y, 'gy', { reason: 'rule' }); log(g, `${D(y).n} was sent to the GY.`); } shuffleDeck(g, p); } } })] },
  'Wonder Clover': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].hand.some(x => x !== c && isMon(x) && race(x) === 'Plant' && lv(x) === 4) && monsOf(g, p).some(faceUp),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send a Level 4 Plant monster from your hand to the GY', g.p[p].hand.filter(x => x !== c && isMon(x) && race(x) === 'Plant' && lv(x) === 4), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster can attack twice?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; t.flags.extraAttack = g.turnNo; const u = t.u;
      addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.ctrl === p && a.c.u !== u, { end: g.turnNo }); log(g, `${name(t)} can attack twice this turn; ${PN(g, p)}'s other monsters can't attack.`); } }] },
  // Only the trigger from the GY: the card has no effect when activated.
  'Wonder Garage': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon a "roid" monster',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField && ev.to === 'gy' && ev.snap && !ev.snap.faceUp,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Machine' && lv(x) <= 4 && /roid/.test(D(x).n)),
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Machine' && lv(x) <= 4 && /roid/.test(D(x).n)); if (!cs.length) return;
      const [x] = yield* pick(g, p, 'Special Summon which "roid" monster?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  'Woodland Archer': { proc: { label: 'Special Summon (2+ Normal Monsters in your GY)', cond: (g, c, p) => g.p[p].gy.filter(x => D(x).k === 'normal').length >= 2 },
    effs: [lockInstall, { type: 'ign', label: 'Tribute: add a Gemini monster', cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && isGemini(x)),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Woodland Archer.`); },
      res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && isGemini(x), 'Add a Gemini monster'); } }] },
  'Wrath of Neos': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && name(x) === 'Elemental HERO Neos'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which Elemental HERO Neos?', monsOf(g, p).filter(x => faceUp(x) && name(x) === 'Elemental HERO Neos'), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; move(g, t, 'deck', { reason: 'effect', by: p }); log(g, `${D(t).n} was shuffled into the Deck.`);
      destroy(g, allField(g).filter(x => x !== c), { by: p, src: c }); } }] },
  // The targets are picked when it activates; if either is missing, the effect does nothing.
  'Wroughtweiler': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Add an Elemental HERO and Polymerization',
    on: (g, ev, c) => battleToGY(ev, c),
    target: function* (g, c, p, L2) { const hs = g.p[p].gy.filter(x => /^Elemental HERO/.test(D(x).n)), ps = g.p[p].gy.filter(x => named(x, 'Polymerization'));
      if (!hs.length || !ps.length) { L2.t = []; return; } const [h] = yield* pick(g, p, 'Target 1 Elemental HERO in your GY', hs, 1, 1, 'good'); const [q] = yield* pick(g, p, 'Target 1 Polymerization in your GY', ps, 1, 1, 'good'); L2.t = [h, q].filter(Boolean); },
    res: function* (g, c, p, L2) { if (L2.t.length < 2 || L2.t.some(x => x.zone !== 'gy')) return; for (const x of L2.t) move(g, x, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} added ${L2.t.map(x => D(x).n).join(' and ')} to the hand.`); } }] },

  /* ----- X, Y, Z ----- */
  'X-Saber Axel': { effs: [{ type: 'trig', mand: true, label: 'Draw 1 card',
    on: (g, ev, c) => ev.type === 'move' && ev.c !== c && ev.battle && ev.destroyed && ev.to === 'gy' && ev.wasField && ev.snap && /Saber/.test(ev.snap.name),
    res: function* (g, c, p) { if (onField(c) && faceUp(c)) draw(g, p, 1); } }] },
  'X-Saber Uruz': { effs: [{ type: 'trig', when: true, label: 'Tribute: return the destroyed monster to the Deck',
    on: (g, ev, c) => { if (!battleKill(ev, c)) return false; c.f46uz = ev.c; return true; },
    cond: (g, c) => !!c.f46uz && c.f46uz.zone === 'gy',
    cost: function* (g, c, p, L2) { L2.data.x = c.f46uz; c.f46uz = null; move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed X-Saber Uruz.`); },
    res: function* (g, c, p, L2) { const x = L2.data.x; if (x && x.zone === 'gy') { move(g, x, 'deckTop', { reason: 'effect', by: p }); log(g, `${D(x).n} was put on top of the Deck.`); } } }] },
  'XX-Saber Gardestrike': { proc: { label: 'Special Summon (2+ X-Sabers in your GY)', cond: (g, c, p) => monsOf(g, p).length === 0 && g.p[p].gy.filter(x => isMon(x) && isXSaber(x)).length >= 2 } },
  'XX-Saber Garsem': {
    self: { atk: (g, c) => 200 * monsOf(g, c.ctrl).filter(x => faceUp(x) && isXSaber(x)).length },
    effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Add an X-Saber monster',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !ev.battle && ev.to === 'gy',
      res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && isXSaber(x), 'Add an X-Saber monster'); } }] },
  'Yamato-no-Kami': { proc: { label: 'Special Summon (banish a Spirit from your GY)', cond: (g, c, p) => g.p[p].gy.some(isSpirit),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish 1 Spirit monster from your GY', g.p[p].gy.filter(isSpirit), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } } },
    effs: [lockInstall,
      { type: 'trig', mand: true, label: 'Return to the hand',
        on: (g, ev, c) => { if (ev.type === 'summon' && ev.cs.includes(c) && !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how)) c.flags.f46ss = g.turnNo; return ev.type === 'phase' && ev.ph === 'end' && c.flags.f46ss === g.turnNo; },
        res: function* (g, c) { if (onField(c) && faceUp(c)) { move(g, c, 'hand', { reason: 'effect' }); log(g, `${D(c).n} returned to the hand.`); } } },
      { type: 'trig', tags: { destroy: 1 }, label: 'Destroy a Spell/Trap',
        on: (g, ev, c) => killedByBattle(ev, c), cond: (g, c, p) => stOf(g, opp(p)).length > 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOf(g, opp(p)), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Yellow Baboon, Archer of the Forest': { effs: [{ type: 'trig', loc: 'hand', tags: { ss: 1 }, label: 'Banish 2 Beasts: Special Summon this card',
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.wasField && ev.to === 'gy' && ev.c.zone === 'gy' && ev.prevCtrl === c.owner && ev.snap && ev.snap.race === 'Beast',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.filter(x => isMon(x) && race(x) === 'Beast').length >= 2,
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Banish 2 Beasts from your GY', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Beast'), 2, 2, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${xs.map(x => D(x).n).join(' and ')}.`); },
    res: function* (g, c, p) { if (c.zone === 'hand') ss(g, p, c, 'atk'); } }] },
  'Yu-Jo Friendship': { effs: [{ type: 'act',
    res: function* (g, c, p) { const o = opp(p); const unity = g.p[p].hand.some(x => named(x, 'Unity'));
      let ok = false; if (unity) { log(g, `${PN(g, p)} showed Unity, so the handshake must be accepted.`); ok = true; } else ok = yield* yn(g, o, 'Accept the handshake? (both players\' LP become half of the total)');
      if (!ok) { log(g, `${PN(g, o)} refused the handshake.`); return; }
      const n = Math.floor((g.p[0].lp + g.p[1].lp) / 2); g.p[0].lp = n; g.p[1].lp = n; g.seq++; log(g, `The handshake was accepted: both players now have ${n} LP.`); } }] },
  'Zeman the Ape King': {
    cont: { forbid: (g, src, a) => a.type === 'activate' && a.p !== src.ctrl && a.c && isST(a.c) && a.eff && a.eff.type === 'act' && ((g.aw && g.aw.a === src) || (g.battle && g.inDS && g.battle.a === src)) },
    effs: [{ type: 'trig', label: 'Send a monster: negate the attack',
      on: (g, ev, c) => ev.type === 'attack' && ev.p !== c.ctrl,
      cond: (g, c, p) => g.p[p].hand.some(isMon) || monsOf(g, p).length > 0,
      cost: function* (g, c, p) { const cs = [...g.p[p].hand.filter(isMon), ...monsOf(g, p)]; const [x] = yield* pick(g, p, 'Send 1 monster from your hand or field to the GY', cs, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
      target: function* (g, c, p, L2) { const a = g.aw && g.aw.a; if (a && onField(a)) yield* tgt(g, p, L2, 'Target the attacking monster', [a], 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const a = live(L2)[0]; if (a && g.aw && g.aw.a === a) negateAttack(g); } }] },
  'Zera Ritual': { effs: ritualEffs('Zera the Mant') },
  'Zera the Mant': { effs: [lockInstall] },
  'Zeradias, Herald of Heaven': { effs: [
    { type: 'ign', loc: 'hand', label: 'Discard: add The Sanctuary in the Sky', cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'The Sanctuary in the Sky')),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded Zeradias, Herald of Heaven.`); },
      res: function* (g, c, p) { yield* search(g, p, x => named(x, 'The Sanctuary in the Sky'), 'Add The Sanctuary in the Sky'); } },
    selfDestroyIf(g => !sanctuary(g), 'Destroyed without The Sanctuary in the Sky')] },
  // Its protection is kept by the card in the GY. PARTIAL: if Zero Gardna leaves the GY that turn, its monsters lose the protection.
  'Zero Gardna': {
    cont: { loc: 'gy', grant: (g, src, m, flag) => flag === 'noBattleDestroy' && !!src.f46zg && src.f46zg === g.turnNo && m.ctrl === src.owner && m.zone === 'm' },
    effs: [{ type: 'quick', label: 'Tribute: no battle destruction or damage this turn',
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Zero Gardna.`); },
      res: function* (g, c, p) { c.f46zg = g.turnNo; g.p[p].noBattleDamage = g.turnNo; g.seq++; log(g, `${PN(g, p)}'s monsters can't be destroyed by battle and ${PN(g, p)} takes no battle damage this turn.`); } }] },
  'Zeta Reticulant': {
    proc: { label: 'Special Summon (Tribute 1 Eva Token)', cond: (g, c, p) => monsOf(g, p).some(x => name(x) === 'Eva Token'),
      cost: function* (g, c, p, grp) { const cs = monsOf(g, p).filter(x => name(x) === 'Eva Token'); const [x] = cs.length > 1 ? yield* pick(g, p, 'Tribute which Eva Token?', cs, 1, 1, 'cost') : cs; if (x) { move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} Tributed an Eva Token.`); } } },
    effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon an Eva Token',
      on: (g, ev, c) => ev.type === 'move' && ev.to === 'ban' && ev.wasField && ev.prevCtrl !== c.owner && !!ev.snap && ev.snap.mon,
      cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { if (c.zone === 'gy') tokens(g, p, { n: 'Eva Token', a: 'DARK', r: 'Fiend', lv: 2, atk: 500, def: 500 }, 1, 'atk'); } }] },
  'Zombie Mammoth': { effs: [
    selfDestroyIf((g, c) => !g.p[c.ctrl].gy.some(x => isMon(x) && race(x) === 'Zombie'), 'Destroyed with no Zombie in the GY'),
    // a face-up Zombie Mammoth destroyed by a card effect (not by battle: ruling)
    { type: 'trig', loc: 'any', mand: true, label: 'Damage to its controller',
      on: (g, ev, c) => { if (!(ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField && !ev.battle && ev.snap && ev.snap.faceUp)) return false; c.f46mam = ev.prevCtrl; return true; },
      res: function* (g, c) { const q = c.f46mam; c.f46mam = null; if (q != null) damage(g, q, baseAtk(c), { src: c, srcP: q }); } }] },
  // The attacked monster is recorded in the duel (g.f46ze) and destroyed in the End Phase of the 5th turn after the attack.
  'Zone Eater': { effs: [{ type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the monster it attacked',
    on: (g, ev, c) => {
      if (ev.type === 'dsEnd' && ev.a === c && ev.t && onField(ev.t) && ev.t.zone === 'm') { g.f46ze = (g.f46ze || []).filter(r => r.u !== ev.t.u); g.f46ze.push({ u: ev.t.u, turnIn: ev.t.turnIn, at: g.turnNo + 5 }); return false; }
      return ev.type === 'phase' && ev.ph === 'end' && (g.f46ze || []).some(r => r.at === g.turnNo && fieldMons(g).some(x => x.u === r.u && x.turnIn === r.turnIn)); },
    res: function* (g, c, p) { const rs = (g.f46ze || []).filter(r => r.at === g.turnNo); g.f46ze = (g.f46ze || []).filter(r => r.at !== g.turnNo);
      const ts = fieldMons(g).filter(x => rs.some(r => r.u === x.u && r.turnIn === x.turnIn)); if (ts.length) destroy(g, ts, { by: p, src: c }); } }] },
});
})();
