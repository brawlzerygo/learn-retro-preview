/* Full pool batch 05: Dark Balter the Terrible to Dark-Piercing Light.
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts (Edison and Goat) unless noted. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, setFaceDown, negate, addMod,
  equip, equippedTo, link, addCtr, ctr, negateAttack, endBattle, addRule, token, tokens, fusionSummon, canFusion, ritualSummon, canRitual,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned,
  fromFieldToGY, battleKill, negd, stat, emit, forbid } = L;
const atk = L.atk, def = L.def;

/* ----- small helpers for this batch ----- */
const named = (c, n) => D(c).n === n;
const isEffectMon = c => isMon(c) && (D(c).k === 'effect' || /Effect/.test(D(c).ab || ''));
const isNormalSpell = c => isSpell(c) && D(c).sub === 'Normal';
const darkMon = c => isMon(c) && attr(c) === 'DARK';
// negate an effect (not the activation) of a chain link, optionally destroying the card
function negLink(g, T, p, destroyIt) { if (!T || T.negated) return; T.negated = true; T.negBy = p; log(g, `${name(T.c)}'s effect was negated.`); if (destroyIt && onField(T.c)) destroy(g, [T.c], { by: p }); }
function* discardPick(g, p, n, text, not) { const h = g.p[p].hand.filter(x => x !== not); if (!h.length) return []; const xs = yield* pick(g, p, text, h, Math.min(n, h.length), Math.min(n, h.length), 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'discard', by: p }); if (xs.length) log(g, `${PN(g, p)} discarded ${xs.map(name).join(', ')}.`); return xs; }
function randomDiscard(g, p, by) { const h = g.p[p].hand; if (!h.length) return null; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard', by }); log(g, `${PN(g, p)} discarded ${name(x)} at random.`); return x; }
const fromHandDeck = (g, p, n) => [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, n));
function* ssFromHandDeck(g, p, n, text) { const cs = fromHandDeck(g, p, n); if (!cs.length || freeM(g, p) < 0) return null; const [x] = yield* pick(g, p, text, cs, 1, 1, 'good'); if (!x) return null; const fromDeck = x.zone === 'deck'; const ok = ss(g, p, x); if (fromDeck) shuffleDeck(g, p); return ok ? x : null; }
// "Negate the effects of monsters destroyed by battle": the destroyed monster can't activate effects while it stays
// in the zone it was sent to (GY effects included, reset once it leaves). The rule drops itself when it leaves.
function negKill(g, v) {
  const zone = v.zone; let dead = false; log(g, `${D(v).n}'s effects are negated.`);
  addRule(g, (g2, a) => { if (dead) return false; if (v.zone !== zone) { dead = true; return false; } return a.type === 'activate' && a.c === v; });
}
const killedHere = (ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.c !== c && ev.prevCtrl !== c.ctrl;
// a Spell/Trap activation that is the top chain link
const topSpellAct = top => !!(top && top.cardAct && isSpell(top.c) && !top.negated);
// Dark Spirit of the Silent: a battle worked out by the card (from classic-5.js)
const toAtk = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos === 'atk') return; c.pos = 'atk'; g.seq++; log(g, `${name(c)} was changed to Attack Position.`); };
const stopAttack = g => { negateAttack(g); g.aw = null; };
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

/* Summon locks. The Edison card data has no text for these cards, so the engine's "Cannot be Normal Summoned" reader
 can't see it. One duel-long rule, installed by the first event any of these cards sees, blocks their Normal Summon/Set
 and the Special Summons their text rules out. In Goat, cards that keep their own Goat script are left to it. */
const GOAT_OWN = ['Dark Necrofear', 'Dark Sage', 'Dark Paladin'];
const LOCKS = {
  // PARTIAL: "cannot be Special Summoned by other ways": only Special Summons from the hand are allowed, so another
  // effect that Special Summons from the hand isn't blocked.
  'Dark Eradicator Warlock': { ns: true, ss: (g, a) => a.c.zone !== 'hand' },
  // Knight's Title is face-up in its Spell/Trap Zone while it resolves.
  'Dark Magician Knight': { ns: true, ss: (g, a) => !stOf(g, a.p).some(x => faceUp(x) && named(x, "Knight's Title")) },
  // Must first be Special Summoned from the hand by its own rule (nomiOk); after that it can be revived.
  'Dark Necrofear': { ns: true, ss: (g, a) => !a.c.nomiOk && a.c.zone !== 'hand' },
  // Time Wizard's script marks a properly summoned Dark Sage (c.nomi).
  'Dark Sage': { ns: true, ss: (g, a) => !a.c.nomi },
  'Dark Paladin': { ss: (g, a) => a.how !== 'fusion' },
  'Dark General Freed': { ss: () => true },
  'Dark Ruler Ha Des': { ss: (g, a) => a.c.zone === 'gy' },
};
const lockEff = { type: 'trig', loc: 'any', res: function* () {},
  on: (g) => {
    if (!g.f05lock) {
      g.f05lock = true;
      addRule(g, (g2, a) => {
        if (!a.c || !a.c.id) return false; const d = D(a.c); if (!d) return false; const lk = LOCKS[d.n]; if (!lk) return false;
        if (E.format() === 'goat' && GOAT_OWN.includes(d.n)) return false;
        if ((a.type === 'ns' || a.type === 'set') && lk.ns) return true;
        if (a.type === 'ss' && lk.ss && lk.ss(g2, a)) return true;
        return false;
      });
    }
    return false; } };

/* Spell Counter each time a Spell is activated and resolves (as goat-7.js): a Normal or Quick-Play Spell as it leaves for
 the GY after resolving; Continuous, Equip and Field Spells as they are activated from the hand.
 PARTIAL: a Set Continuous/Equip/Field Spell flipped up adds no counter. */
const spellCounterAny = { type: 'trig', res: function* () {}, on: (g, ev, c) => {
  if (ev.type !== 'move' || !isSpell(ev.c)) return false;
  const stays = ['Continuous', 'Equip', 'Field'].includes(D(ev.c).sub);
  if ((!stays && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule') || (stays && ev.from === 'hand' && ev.reason === 'activate')) { addCtr(g, c, 'spell', 1); log(g, `${name(c)} got a Spell Counter (${ctr(c, 'spell')}).`); }
  return false; } };

const DSC = ['Don Zaloog', 'Dark Scorpion - Cliff the Trap Remover', 'Dark Scorpion - Chick the Yellow', 'Dark Scorpion - Gorg the Strong', 'Dark Scorpion - Meanae the Thorn'];
const lucius = (next, flag) => ({ type: 'trig', opt: true, tags: { ss: 1 }, label: `Send it: summon ${next}`,
  on: (g2, ev, c2) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c2.ctrl && c2.flags[flag] != null && g2.turnNo - c2.flags[flag] === 2,
  cond: (g2, c2, p2) => fromHandDeck(g2, p2, next).length > 0,
  cost: function* (g2, c2) { move(g2, c2, 'gy', { reason: 'cost' }); log(g2, `${name(c2)} was sent to the GY.`); },
  res: function* (g2, c2, p2) { const x = yield* ssFromHandDeck(g2, p2, next, `Special Summon ${next} from your hand or Deck`); if (x) x.flags.lucFrom = D(c2).n; } });
let cityGuard = false;
const shown = (g, c) => c.pos === "set" ? "A face-down monster" : name(c);

E.addScripts({
  /* ----- Fusions ----- */
  // Edison and Goat share this text. "Pay 1000 LP: negate the effect of a Normal Spell Card" is a Quick Effect (not the
  // activation, so a Continuous Normal Spell stays). The battle negation works like Dark Ruler Ha Des.
  'Dark Balter the Terrible': { effs: [
    { type: 'quick', label: 'Pay 1000: negate the Normal Spell',
      cond: (g, c, p, x) => { const t = x.top; return !!(t && t.cardAct && isNormalSpell(t.c) && !t.negated) && g.p[p].lp > 1000; },
      cost: function* (g, c, p, L2) { pay(g, p, 1000); L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { negLink(g, L2.data.L, p, false); } },
    { type: 'trig', loc: 'any', res: function* () {},
      on: (g, ev, c) => { if (killedHere(ev, c) && isEffectMon(ev.c) && (!onField(c) || !negd(g, c))) negKill(g, ev.c); return false; } }] },
  'Dark Blade the Dragon Knight': {
    effs: [{ type: 'trig', label: 'Banish up to 3 monsters from their GY',
      on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
      cond: (g, c, p) => g.p[opp(p)].gy.some(isMon),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish up to 3 monsters from their GY', g.p[opp(p)].gy.filter(isMon), 1, 3, 'bad'); },
      res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy');
        for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.map(name).join(', ')} ${xs.length > 1 ? 'were' : 'was'} banished.`); } }] },
  'Dark Flare Knight': { self: { noBattleDamage: true },
    effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Summon Mirage Knight',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
      res: function* (g, c, p) { const cs = fromHandDeck(g, p, 'Mirage Knight'); if (!cs.length || freeM(g, p) < 0) return;
        const [x] = yield* pick(g, p, 'Special Summon Mirage Knight from your hand or Deck', cs, 1, 1, 'good');
        if (x) { const fromDeck = x.zone === 'deck'; x.nomi = true; x.flags.byDFK = true; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } } }] },
  // PARTIAL: substitute Fusion Materials (Goddess with the Third Eye) aren't read.
  'Dark Paladin': {
    self: { atk: (g, c) => 500 * (fieldMons(g).filter(x => faceUp(x) && race(x) === 'Dragon').length + allCards(g, 'gy').filter(x => isMon(x) && race(x) === 'Dragon').length) },
    effs: [lockEff,
      { type: 'quick', ds: true, label: 'Discard: negate the Spell',
        cond: (g, c, p, x) => topSpellAct(x.top) && g.p[p].hand.length > 0,
        cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; yield* discardPick(g, p, 1, 'Discard 1 card'); },
        // Edison ruling: the Spell is still negated if Dark Paladin left the field or was turned face-down.
        res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },

  /* ----- monsters ----- */
  // "When this card is Normal Summoned, select and Special Summon 1 Level 3 Tuner monster from your GY. Its effects are negated."
  'Dark Bug': { effs: [{ type: 'trig', mand: true, tags: { ss: 1 }, label: 'Summon a Level 3 Tuner from the GY',
    on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && D(x).tu && lv(x) === 3),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Level 3 Tuner?', g.p[p].gy.filter(x => isMon(x) && D(x).tu && lv(x) === 3), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && ss(g, p, t, 'atk', { negate: true })) log(g, `${name(t)}'s effects are negated.`); } }] },
  'Dark Cat with White Tail': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Return 3 monsters to the hand',
    on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c, p) => monsOf(g, opp(p)).length >= 2 && monsOf(g, p).some(x => x !== c),
    target: function* (g, c, p, L2) { const a = yield* tgt(g, p, L2, 'Return which 2 of their monsters?', monsOf(g, opp(p)), 2, 2, 'bad');
      const b = yield* tgt(g, p, L2, 'Return which of your monsters?', monsOf(g, p).filter(x => x !== c), 1, 1, 'cost'); L2.t = [...a, ...b]; },
    res: function* (g, c, p, L2) { const xs = live(L2).filter(x => x.zone === 'm'); for (const x of xs) move(g, x, 'hand', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.map(x => D(x).n).join(', ')} returned to the hand.`); } }] },
  'Dark Catapulter': { effs: [
    { type: 'trig', mand: true, label: 'Place a counter',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.pos === 'def',
      res: function* (g, c) { if (onField(c) && c.pos === 'def') { addCtr(g, c, 'catapult', 1); log(g, `${name(c)} got a counter (${ctr(c, 'catapult')}).`); } } },
    { type: 'ign', tags: { destroy: 1 }, label: 'Banish cards: destroy Spells/Traps',
      cond: (g, c, p) => { const n = ctr(c, 'catapult'); return n > 0 && g.p[p].gy.length >= n && stOnField(g).length >= n; },
      cost: function* (g, c, p, L2) { const n = ctr(c, 'catapult'); L2.data.n = n; const xs = yield* pick(g, p, `Banish ${n} card${n > 1 ? 's' : ''} from your GY`, g.p[p].gy, n, n, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${xs.map(name).join(', ')}.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, `Destroy ${L2.data.n} Spell/Trap card(s)`, stOnField(g), L2.data.n, L2.data.n, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); if (onField(c)) { addCtr(g, c, 'catapult', -ctr(c, 'catapult')); log(g, `${name(c)}'s counters were removed.`); } } }] },
  'Dark Crusader': { effs: [{ type: 'ign', label: 'Send a DARK: +400 ATK',
    cond: (g, c, p) => g.p[p].hand.some(darkMon),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send a DARK monster from your hand to the GY', g.p[p].hand.filter(darkMon), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); } },
    res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 400 }); log(g, `${name(c)} gained 400 ATK.`); } } }] },
  'Dark Driceratops': { self: { piercing: true } },
  // PARTIAL: the engine's Tribute hook only changes how many Tributes are needed, so with a face-up Dark Effigy a Level 7+
  // DARK Normal Monster can be Tribute Summoned with any 1 monster, not only Dark Effigy.
  'Dark Effigy': { cont: { tributes: (g, src, c, p, need) => src.ctrl === p && D(c).k === 'normal' && attr(c) === 'DARK' && need === 2 && !negd(g, src) ? 1 : null } },
  'Dark Elf': { self: { attackCost: () => 1000 } },
  'Dark Eradicator Warlock': {
    proc: { label: 'Special Summon (Tribute Dark Magician)', cond: (g, c, p) => c.zone === 'hand' && monsOf(g, p).some(x => named(x, 'Dark Magician')),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Tribute which Dark Magician?', monsOf(g, p).filter(x => named(x, 'Dark Magician')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Dark Magician.`); } } },
    effs: [lockEff,
      // after a Normal Spell resolves it leaves the field for the GY by rule (a negated and destroyed one leaves by effect)
      { type: 'trig', mand: true, label: '1000 damage',
        on: (g, ev, c) => ev.type === 'move' && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && isNormalSpell(ev.c),
        res: function* (g, c, p) { damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },
  'Dark General Freed': {
    // The normal draw is skipped when a Level 4 DARK is in the Deck; the choice to draw or search is offered at the
    // start of the Standby Phase instead. PARTIAL: the choice is made one step late (no Draw Phase prompt in the engine).
    cont: { forbid: (g, src, a) => {
      if (a.type !== 'draw' || g.phase !== 'draw' || a.p !== src.ctrl || g.tp !== src.ctrl || negd(g, src)) return false;
      if (g.f05freed && g.f05freed.t === g.turnNo) return false;
      if (!g.p[a.p].deck.some(x => darkMon(x) && lv(x) === 4)) return false;
      g.f05freed = { t: g.turnNo, u: src.u }; return true; } },
    effs: [lockEff,
      { type: 'trig', loc: 'any', mand: true, label: 'Draw or add a Level 4 DARK',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && g.f05freed && g.f05freed.t === g.turnNo && g.f05freed.u === c.u,
        res: function* (g, c, p) {
          const ok = onField(c) && faceUp(c) && g.p[p].deck.some(x => darkMon(x) && lv(x) === 4);
          const k = ok ? yield* choose(g, p, 'Dark General Freed: instead of your normal draw?', ['Add a Level 4 DARK monster', 'Draw normally']) : 1;
          if (k === 0) yield* search(g, p, x => darkMon(x) && lv(x) === 4, 'Add which Level 4 DARK monster?'); else draw(g, p, 1); } },
      // ENGINE: no automatic negation hook, so it is an optional Spell Speed 3 response. PARTIAL: optional.
      { type: 'quick', speed: 3, ds: true, label: 'Negate the Spell targeting your DARK',
        cond: (g, c, p, x) => { const t = x.top; return !!(t && isSpell(t.c) && !t.negated && t.t && t.t.some(m => onField(m) && faceUp(m) && m.zone === 'm' && m.ctrl === p && attr(m) === 'DARK')); },
        target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
        res: function* (g, c, p, L2) { negLink(g, L2.data.L, p, true); } }] },
  'Dark Hunter': {
    self: { atk: (g, c) => { const n = g.p[c.ctrl].gy.filter(darkMon).length; return n <= 1 ? -400 : n <= 4 ? 400 : 0; } },
    effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Send it: destroy face-down monsters',
      cond: (g, c, p) => g.p[p].gy.filter(darkMon).length >= 5 && monsOf(g, opp(p)).some(x => x.pos === 'set'),
      cost: function* (g, c) { move(g, c, 'gy', { reason: 'cost' }); log(g, 'Dark Hunter was sent to the GY.'); },
      res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)).filter(x => x.pos === 'set'), { by: p, src: c }); } }] },
  'Dark Jeroid': { effs: [{ type: 'trig', mand: true, label: 'A monster loses 800 ATK',
    on: (g, ev, c) => evSummoned(ev, c),
    cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster loses 800 ATK?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: -800 }); log(g, `${name(t)} lost 800 ATK.`); } } }] },
  'Dark Lucius LV4': { effs: [
    { type: 'trig', loc: 'any', res: function* () {},
      on: (g, ev, c) => { if (killedHere(ev, c) && (!onField(c) || !negd(g, c))) { if (onField(c)) c.flags.lucKill = g.turnNo; if (isEffectMon(ev.c)) negKill(g, ev.c); } return false; } },
    lucius('Dark Lucius LV6', 'lucKill')] },
  // PARTIAL: "after this card negated your opponent's monster effect" counts any Effect Monster it destroys by battle,
  // even one whose effect would never have activated.
  'Dark Lucius LV6': { effs: [
    { type: 'trig', loc: 'any', res: function* () {},
      on: (g, ev, c) => { if (killedHere(ev, c) && onField(c) && c.flags.lucFrom === 'Dark Lucius LV4' && !negd(g, c) && isEffectMon(ev.c)) { c.flags.lucNeg = g.turnNo; negKill(g, ev.c); } return false; } },
    lucius('Dark Lucius LV8', 'lucNeg')] },
  // PARTIAL: the destroyed monster reaches the GY first and is banished by a chain link right after.
  'Dark Lucius LV8': { effs: [
    { type: 'trig', loc: 'any', res: function* () {},
      on: (g, ev, c) => { if (killedHere(ev, c) && onField(c) && c.flags.lucFrom === 'Dark Lucius LV6' && !negd(g, c)) { negKill(g, ev.c); c.flags.lucBan = (c.flags.lucBan || []).concat(ev.c.u); } return false; } },
    { type: 'trig', mand: true, label: 'Banish the destroyed monster',
      on: (g, ev, c) => killedHere(ev, c) && c.flags.lucFrom === 'Dark Lucius LV6' && ev.to === 'gy',
      res: function* (g, c, p, L2) { const t = L2.ev.c; if (t.zone === 'gy') { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${name(t)} was banished.`); } } }] },
  'Dark Magician Girl': { self: { atk: (g, c) => 300 * allCards(g, 'gy').filter(x => named(x, 'Dark Magician') || named(x, 'Magician of Black Chaos')).length } },
  'Dark Magician Knight': { effs: [lockEff,
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy 1 card',
      on: (g, ev, c) => ev.type === 'summon' && ev.cs.includes(c) && !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how),
      cond: g => allField(g).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', allField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  // Original 2004/2010 text: no once-per-turn on the End Phase Spell return (added by later errata).
  'Dark Magician of Chaos': { effs: [
    { type: 'trig', label: 'Add a Spell from the GY',
      on: (g, ev, c) => { if (evSummoned(ev, c) && ev.how !== 'flip') { c.flags.dmoc = g.turnNo; c.flags.banishOnLeave = true; } if (ev.type === 'flip' && ev.c === c) c.flags.banishOnLeave = true; return ev.type === 'phase' && ev.ph === 'end' && c.flags.dmoc === g.turnNo; },
      cond: (g, c, p) => g.p[p].gy.some(isSpell),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Spell from your GY to your hand?', g.p[p].gy.filter(isSpell), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } },
    { type: 'trig', mand: true, label: 'Banish the destroyed monster', on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
      res: function* (g, c, p, L2) { const t = L2.ev.c; if (t.zone === 'gy') { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${name(t)} was banished.`); } } }] },
  'Dark Mimic LV1': { effs: [
    { type: 'trig', mand: true, faceDownOk: true, label: 'Draw 1 card', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
      res: function* (g, c, p) { if (g.p[p].deck.length) draw(g, p, 1); } },
    { type: 'trig', opt: true, tags: { ss: 1 }, label: 'Send it: summon Dark Mimic LV3', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      cond: (g, c, p) => fromHandDeck(g, p, 'Dark Mimic LV3').length > 0,
      cost: function* (g, c) { move(g, c, 'gy', { reason: 'cost' }); },
      res: function* (g, c, p) { const x = yield* ssFromHandDeck(g, p, 'Dark Mimic LV3', 'Special Summon Dark Mimic LV3'); if (x) x.flags.mimic = true; } }] },
  'Dark Mimic LV3': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Draw', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p, L2) { const n = L2.ev.snap && L2.ev.snap.flags && L2.ev.snap.flags.mimic ? 2 : 1; draw(g, p, Math.min(n, g.p[p].deck.length) || 1); } }] },
  'Dark Necrofear': {
    proc: { label: 'Special Summon (banish 3 Fiends from your GY)',
      cond: (g, c, p) => c.zone === 'hand' && g.p[p].gy.filter(x => isMon(x) && race(x) === 'Fiend').length >= 3,
      cost: function* (g, c, p, grp) {
        const xs = yield* pick(g, p, 'Banish 3 Fiend monsters from your GY', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Fiend'), 3, 3, 'cost');
        for (const x of xs) move(g, x, 'ban', { reason: 'cost', group: grp });
        log(g, `${PN(g, p)} banished ${xs.map(name).join(', ')}.`); c.nomiOk = true;
      } },
    effs: [lockEff,
      { type: 'trig', loc: 'gy', mand: true, label: 'Equip to and take control of a monster',
        on: (g, ev, c) => {
          if (ev.type === 'move' && ev.c === c && ev.from === 'm' && ev.to === 'gy' && ev.destroyed && ev.prevCtrl === c.owner) {
            const byOpp = ev.battle ? ev.killer && ev.killer.ctrl !== c.owner : ev.by != null ? ev.by !== c.owner : g.tp !== c.owner;
            if (byOpp) c.flags.necro = g.turnNo;
          }
          return ev.type === 'phase' && ev.ph === 'end' && c.flags.necro === g.turnNo;
        },
        cond: (g, c, p) => oppFaceUp(g, p).length > 0 && freeST(g, p) >= 0 && freeM(g, p) >= 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Dark Necrofear to which of their monsters?', oppFaceUp(g, p), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) {
          c.flags.necro = null;
          const t = live(L2)[0]; if (!t || !faceUp(t) || t.ctrl === p || c.zone !== 'gy' || freeST(g, p) < 0 || freeM(g, p) < 0) return;
          const from = t.ctrl;
          move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p });
          c.equipTo = t.u; c.flags.necroEq = { u: t.u, from }; c.flags.negated = true;
          log(g, `Dark Necrofear was equipped to ${name(t)}.`);
          takeControl(g, p, t, false);
        } },
      { type: 'trig', loc: 'any', mand: true, label: 'Control returns',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.from === 'st' && ev.snap && ev.snap.flags && ev.snap.flags.necroEq,
        res: function* (g, c, p, L2) { const s = L2.ev.snap.flags.necroEq; const t = fieldMons(g).find(x => x.u === s.u); if (!t || t.ctrl === s.from) return;
          if (freeM(g, s.from) >= 0) takeControl(g, s.from, t, false); else move(g, t, 'gy', { reason: 'rule' }); } }] },
  'Dark Nephthys': { effs: [
    { type: 'ign', loc: 'hand', label: 'Banish 2 DARKs: send it to the GY',
      cond: (g, c, p) => c.zone === 'hand' && g.p[p].gy.filter(darkMon).length >= 3,
      cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Banish 2 DARK monsters from your GY', g.p[p].gy.filter(darkMon), 2, 2, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${xs.map(name).join(', ')}.`); },
      res: function* (g, c, p) { if (c.zone !== 'hand') return; move(g, c, 'gy', { reason: 'effect', by: p }); c.flags.neph = g.turnNo; log(g, 'Dark Nephthys was sent to the GY.'); } },
    { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon itself',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner && c.flags.neph != null && c.flags.neph < g.turnNo,
      res: function* (g, c, p) { c.flags.neph = null; if (c.zone === 'gy') ss(g, p, c); } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a Spell/Trap',
      on: (g, ev, c) => ev.type === 'summon' && ev.cs.includes(c) && !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how),
      cond: g => stOnField(g).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOnField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Dark Red Enchanter': { self: { atk: (g, c) => 300 * ctr(c, 'spell') },
    effs: [spellCounterAny,
      { type: 'trig', mand: true, label: 'Place 2 Spell Counters', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
        res: function* (g, c) { if (onField(c) && faceUp(c)) { addCtr(g, c, 'spell', 2); log(g, `${name(c)} got 2 Spell Counters.`); } } },
      { type: 'ign', opt: true, label: 'Remove 2 Spell Counters: random discard',
        cond: (g, c, p) => ctr(c, 'spell') >= 2 && g.p[opp(p)].hand.length > 0,
        cost: function* (g, c) { addCtr(g, c, 'spell', -2); log(g, `${name(c)} removed 2 Spell Counters.`); },
        res: function* (g, c, p) { randomDiscard(g, opp(p), p); } }] },
  'Dark Resonator': { self: { replaceDestroy: (g, c, o) => { if (!o || !o.battle || c.flags.resUsed === g.turnNo) return false; c.flags.resUsed = g.turnNo; log(g, 'Dark Resonator was not destroyed.'); return true; } } },
  'Dark Ruler Ha Des': { effs: [lockEff,
    { type: 'trig', loc: 'any', res: function* () {},
      on: (g, ev, c) => {
        if (ev.type === 'move' && ev.battle && ev.destroyed && ev.killer && ev.c !== ev.killer) {
          const k = ev.killer, own = onField(c) ? c.ctrl : c.owner;
          const ok = k === c ? (!onField(c) || (faceUp(c) && !negd(g, c))) : onField(c) && faceUp(c) && !negd(g, c) && onField(k) && k.ctrl === own && race(k) === 'Fiend';
          if (ok && ev.prevCtrl !== own) negKill(g, ev.c);
        }
        return false; } }] },
  'Dark Sage': { effs: [lockEff,
    { type: 'trig', mand: true, label: 'Add a Spell from the Deck', on: (g, ev, c) => ev.type === 'summon' && ev.cs.includes(c) && c.flags.darkSage,
      res: function* (g, c, p) { yield* search(g, p, isSpell, 'Add which Spell to your hand?'); } }] },
  'Dark Scorpion Burglars': { effs: [{ type: 'trig', mand: true, label: 'They send a Spell from the Deck to the GY',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    res: function* (g, c, p) { const o = opp(p); const cs = g.p[o].deck.filter(isSpell); if (!cs.length) { shuffleDeck(g, o); return; }
      const [x] = yield* pick(g, o, 'Send a Spell from your Deck to the GY', cs, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${PN(g, o)} sent ${name(x)} from the Deck to the GY.`); } shuffleDeck(g, o); } }] },
  'Dark Simorgh': {
    // ENGINE: attr() can't be changed, so "also WIND-Attribute" isn't applied. Setting by a card effect isn't blocked either.
    cont: { forbid: (g, src, a) => (a.type === 'set' || a.type === 'setST') && a.p !== src.ctrl },
    effs: [
      { type: 'ign', loc: 'hand', tags: { ss: 1 }, label: 'Banish a DARK and a WIND from the GY: summon',
        cond: (g, c, p) => c.zone === 'hand' && freeM(g, p) >= 0 && g.p[p].gy.some(darkMon) && g.p[p].gy.some(x => isMon(x) && attr(x) === 'WIND'),
        cost: function* (g, c, p) { const [a] = yield* pick(g, p, 'Banish a DARK monster from your GY', g.p[p].gy.filter(darkMon), 1, 1, 'cost'); const [w] = yield* pick(g, p, 'Banish a WIND monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'WIND'), 1, 1, 'cost');
          for (const x of [a, w]) if (x) move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${[a, w].filter(Boolean).map(name).join(' and ')}.`); },
        res: function* (g, c, p) { if (c.zone === 'hand') ss(g, p, c); } },
      { type: 'ign', loc: 'gy', tags: { ss: 1 }, label: 'Banish a DARK and a WIND from the hand: summon',
        cond: (g, c, p) => c.zone === 'gy' && freeM(g, p) >= 0 && g.p[p].hand.some(darkMon) && g.p[p].hand.some(x => isMon(x) && attr(x) === 'WIND'),
        cost: function* (g, c, p) { const [a] = yield* pick(g, p, 'Banish a DARK monster from your hand', g.p[p].hand.filter(darkMon), 1, 1, 'cost'); const [w] = yield* pick(g, p, 'Banish a WIND monster from your hand', g.p[p].hand.filter(x => isMon(x) && attr(x) === 'WIND'), 1, 1, 'cost');
          for (const x of [a, w]) if (x) move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${[a, w].filter(Boolean).map(name).join(' and ')}.`); },
        res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c); } }] },
  'Dark Spider': { effs: [{ type: 'ign', opt: true, label: 'An Insect gains 2 Levels',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Insect'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Insect gains 2 Levels?', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Insect'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { t.flags.lv = lv(t) + 2; t.flags.lvUntil = true; log(g, `${name(t)} is now Level ${lv(t)}.`); } } }] },
  'Dark Strike Fighter': { effs: [{ type: 'ign', opt: true, label: 'Tribute a monster: Level x 200 damage',
    cond: (g, c, p) => g.phase === 'main1' && monsOf(g, p).length > 0,
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p), 1, 1, 'cost'); if (!x) return; L2.data.n = lv(x); const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); },
    res: function* (g, c, p, L2) { if (L2.data.n) damage(g, opp(p), L2.data.n * 200, { src: c, srcP: p }); } }] },
  'Dark Tinker': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Look at the top card',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy' && ev.prevCtrl === c.owner,
    cond: (g, c, p) => g.p[p].deck.length > 0,
    res: function* (g, c, p) { const d = g.p[p].deck; if (!d.length) return; const top = d[d.length - 1];
      const k = yield* choose(g, p, `The top card is ${D(top).n}. Where does it go?`, ['Top of the Deck', 'Bottom of the Deck']);
      if (k === 1) { d.pop(); d.unshift(top); log(g, `${PN(g, p)} put the top card on the bottom of the Deck.`); } else log(g, `${PN(g, p)} left the top card on top.`); } }] },
  'Dark Verger': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon from the GY',
    on: (g, ev, c) => ev.type === 'summon' && ['normal', 'tribute'].includes(ev.how) && ev.p === c.owner && ev.cs.some(x => race(x) === 'Plant' && D(x).tu),
    cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c, 'atk'); } }] },
  'Dark Voltanis': { effs: [{ type: 'trig', loc: 'hand', tags: { ss: 1, destroy: 1 }, label: 'Tribute a DARK: Special Summon',
    on: (g, ev, c) => ev.type === 'move' && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && isTrap(ev.c) && D(ev.c).sub === 'Counter' && ev.prevCtrl === c.owner,
    cond: (g, c, p) => c.zone === 'hand' && monsOf(g, p).some(darkMon),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute a DARK monster', monsOf(g, p).filter(darkMon), 1, 1, 'cost'); if (x) { const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); } },
    res: function* (g, c, p) { if (c.zone !== 'hand' || !ss(g, p, c)) return; const cs = allField(g); if (!cs.length) return;
      const [x] = yield* pick(g, p, 'Destroy 1 card on the field', cs, 1, 1, 'bad'); if (x) destroy(g, [x], { by: p, src: c }); } }] },
  'Dark Zebra': { effs: [{ type: 'trig', mand: true, label: 'Change to Defense Position',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.pos === 'atk' && monsOf(g, c.ctrl).length === 1,
    res: function* (g, c) { if (!onField(c) || c.pos !== 'atk' || monsOf(g, c.ctrl).length !== 1) return; c.pos = 'def'; c.posChanged = true; g.seq++; log(g, `${name(c)} changed to Defense Position.`); } }] },
  'Dark-Eyes Illusionist': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'A monster can’t attack',
    on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: g => fieldMons(g).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster can’t attack?', fieldMons(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !onField(c) || !faceUp(c)) return;
      const tok = g.seq + ':' + c.u; c.flags.eye = tok; t.flags.eyeT = tok; log(g, `${shown(g, t)} can’t attack while Dark-Eyes Illusionist is face-up.`);
      addRule(g, (g2, a) => a.type === 'attack' && a.c === t && t.flags.eyeT === tok && onField(c) && faceUp(c) && c.flags.eye === tok); } }] },

  /* ----- Spells ----- */
  // A Field Spell. PARTIAL: the 1000 ATK lasts through the whole Damage Step, not only damage calculation.
  'Dark City': { effs: [{ type: 'act', res: function* () {} }],
    cont: { atk: (g, src, c) => {
      if (cityGuard || !g.inDS || !g.battle || g.battle.a !== c || !g.battle.t || !/^Destiny HERO/.test(name(c)) || !faceUp(g.battle.t)) return 0;
      cityGuard = true; try { return stat(g, c, 'atk') < stat(g, g.battle.t, 'atk') ? 1000 : 0; } finally { cityGuard = false; } } } },
  'Dark Core': { effs: [{ type: 'act',
    cond: (g, c, p) => fieldMons(g).some(faceUp) && g.p[p].hand.filter(x => x !== c).length > 0,
    cost: function* (g, c, p) { yield* discardPick(g, p, 1, 'Discard 1 card', c); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished.`); } } }] },
  // You declare from the monster names in both players' deck lists (the engine has no full card name list for a prompt).
  'Dark Designator': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].deck.length > 0,
    target: function* (g, c, p, L2) { const s = new Set(); for (const P of g.p) for (const z of ['deck', 'hand', 'gy', 'ban', 'extra']) for (const x of P[z]) if (isMon(x) && !['fusion', 'synchro'].includes(D(x).k)) s.add(D(x).n);
      for (const x of allField(g)) if (isMon(x) && !['fusion', 'synchro', 'token'].includes(D(x).k)) s.add(D(x).n);
      const ns = [...s].sort(); const k = yield* choose(g, p, 'Declare a monster card name', ns); L2.data.n = ns[k]; log(g, `${PN(g, p)} declared ${ns[k]}.`); },
    res: function* (g, c, p, L2) { const o = opp(p); const x = g.p[o].deck.find(y => D(y).n === L2.data.n);
      if (x) { move(g, x, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, o)} added ${name(x)} from the Deck to the hand.`); } else log(g, `${PN(g, o)} has no ${L2.data.n} in the Deck.`); shuffleDeck(g, o); } }] },
  // Equip Spell for a Fiend.
  'Dark Energy': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 300 : 0, def: (g, src, m) => src.equipTo === m.u ? 300 : 0 },
    effs: [{ type: 'act', cond: g => fieldMons(g).some(m => faceUp(m) && race(m) === 'Fiend'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which face-up Fiend?', fieldMons(g).filter(m => faceUp(m) && race(m) === 'Fiend'), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && race(t) === 'Fiend' && onField(c)) equip(g, c, t); } }] },
  'Dark Eruption': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.some(x => darkMon(x) && baseAtk(x) <= 1500),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which DARK monster to your hand?', g.p[p].gy.filter(x => darkMon(x) && baseAtk(x) <= 1500), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },
  'Dark Factory of Mass Production': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.filter(x => D(x).k === 'normal').length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which 2 Normal Monsters to your hand?', g.p[p].gy.filter(x => D(x).k === 'normal'), 2, 2, 'good'); },
    res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'hand', { reason: 'effect' }); if (xs.length) log(g, `${PN(g, p)} added ${xs.map(name).join(', ')} to the hand.`); } }] },
  // PARTIAL: the Fusion Monster can't be targeted by either player this turn (tgt() has no "only the opponent's effects").
  'Dark Fusion': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => canFusion(g, p, { filter: fx => race(fx) === 'Fiend' }),
      res: function* (g, c, p) { const fx = yield* fusionSummon(g, p, { filter: x => race(x) === 'Fiend' }); if (fx && onField(fx)) { fx.flags.cantBeTargeted = true; fx.flags.darkFusion = g.turnNo; log(g, `${name(fx)} can't be targeted this turn.`); } } },
    { type: 'trig', loc: 'any', res: function* () {},
      on: (g, ev) => { if (ev.type === 'phase' && ev.ph === 'end') for (const m of fieldMons(g)) if (m.flags.darkFusion === g.turnNo) { m.flags.cantBeTargeted = false; m.flags.darkFusion = null; } return false; } }] },
  'Dark Hole': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).length > 0,
    res: function* (g, c, p) { destroy(g, fieldMons(g), { by: p, src: c }); } }] },
  'Dark Magic Attack': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && named(x, 'Dark Magician')) && stOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { destroy(g, stOf(g, opp(p)), { by: p, src: c }); } }] },
  // ENGINE: Flip Summons can't be forbidden, so they aren't blocked after it.
  'Dark Magic Curtain': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => !g.summoned[p] && freeM(g, p) >= 0 && g.p[p].deck.some(x => named(x, 'Dark Magician')),
    cost: function* (g, c, p) { pay(g, p, Math.floor(g.p[p].lp / 2));
      addRule(g, (g2, a) => (a.type === 'ns' || a.type === 'ss') && a.p === p && !g2.f05curtain, { end: g.turnNo }); },
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => named(x, 'Dark Magician')); if (!cs.length) return;
      g.f05curtain = true; try { ss(g, p, cs[0]); } finally { g.f05curtain = false; } shuffleDeck(g, p); } }] },
  // Edison's random-discard wording is Dark Coffin's, Dark Deal's and Dark Red Enchanter's (randomDiscard).
  'Dark Room of Nightmare': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, label: '300 damage',
      on: (g, ev, c) => ev.type === 'damage' && !ev.battle && ev.p !== c.ctrl && !(ev.src && D(ev.src) && named(ev.src, 'Dark Room of Nightmare')),
      res: function* (g, c, p) { damage(g, opp(p), 300, { src: c, srcP: p }); } }] },
  'Dark Snake Syndrome': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, label: 'Damage to both players',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; const k = c.flags.snake || 0; c.flags.snake = k + 1; const n = 200 * Math.pow(2, k);
        // both players take it at once: if both would hit 0, the duel is a draw
        if (g.p[0].lp <= n && g.p[1].lp <= n) { g.p[opp(p)].lp -= n; log(g, `${PN(g, opp(p))} took ${n} damage.`); damage(g, p, n, { src: c, srcP: p }); }
        else { damage(g, opp(p), n, { src: c, srcP: p }); damage(g, p, n, { src: c, srcP: p }); } } }] },
  'Dark World Dealings': { effs: [{ type: 'act', cond: g => g.p[0].deck.length > 0 && g.p[1].deck.length > 0,
    res: function* (g, c, p) { draw(g, p, 1); draw(g, opp(p), 1); for (const q of [p, opp(p)]) yield* discardPick(g, q, 1, 'Discard 1 card'); } }] },
  // PARTIAL: any discard of a monster during your End Phase counts, not only the hand size discard.
  'Dark World Grimoire': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', label: 'Special Summon a discarded monster',
      on: (g, ev, c) => { if (ev.type === 'move' && ev.from === 'hand' && ev.to === 'gy' && ev.reason === 'discard' && g.phase === 'end' && g.tp === c.ctrl && ev.c.owner === c.ctrl && isMon(ev.c)) { if (!c.flags.grim || c.flags.grim.t !== g.turnNo) c.flags.grim = { t: g.turnNo, us: [] }; c.flags.grim.us.push(ev.c.u); return true; } return false; },
      cond: (g, c, p) => freeM(g, p) >= 0 && c.flags.grim && g.p[p].gy.some(x => c.flags.grim.us.includes(x.u)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which discarded monster?', g.p[p].gy.filter(x => c.flags.grim.us.includes(x.u)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  'Dark World Lightning': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => allField(g).some(x => x !== c && x.pos === 'set') && g.p[p].hand.filter(x => x !== c).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Set card?', allField(g).filter(x => x !== c && x.pos === 'set'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.pos !== 'set') return; const out = destroy(g, [t], { by: p, src: c }); if (out.length) yield* discardPick(g, p, 1, 'Discard 1 card'); } }] },
  'Dark-Piercing Light': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, opp(p)).some(x => x.pos === 'set'),
    res: function* (g, c, p) { const xs = monsOf(g, opp(p)).filter(x => x.pos === 'set'); for (const x of xs) { x.pos = 'def'; g.seq++; log(g, `${PN(g, opp(p))}'s face-down monster was ${name(x)}.`); }
      for (const x of xs) if (onField(x) && faceUp(x)) emit(g, { type: 'flip', c: x, p: x.ctrl }); } }] },

  /* ----- Traps ----- */
  // No activation: the effect starts in the GY. "If" (Edison) / "When" (Goat): mandatory either way.
  'Dark Coffin': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Your opponent discards or destroys',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'st' && ev.to === 'gy' && ev.destroyed && ev.snap && ev.snap.pos === 'set',
    res: function* (g, c, p) { const o = opp(p), canD = g.p[o].hand.length > 0, canM = monsOf(g, o).length > 0; if (!canD && !canM) return;
      const k = canD && canM ? yield* choose(g, o, 'Dark Coffin: choose one', ['Discard 1 random card', 'Destroy 1 of your monsters']) : canD ? 0 : 1;
      if (k === 0) randomDiscard(g, o, p);
      else { const [x] = yield* pick(g, o, 'Destroy which of your monsters?', monsOf(g, o), 1, 1, 'cost'); if (x) destroy(g, [x], { by: p }); } } }] },
  'Dark Cure': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, label: 'Your opponent gains LP',
      on: (g, ev, c) => ev.type === 'summon' && ev.p !== c.ctrl,
      res: function* (g, c, p, L2) { const cs = L2.ev.cs.filter(x => x && (onField(x) || x.zone === 'gy')); if (!cs.length) return;
        const [x] = cs.length > 1 ? yield* pick(g, p, 'Which summoned monster’s ATK counts?', cs, 1, 1, 'cost') : cs;
        const A = onField(x) && faceUp(x) ? atk(g, x) : baseAtk(x); gain(g, opp(p), Math.floor(A / 2)); } }] },
  'Dark Deal': { effs: [{ type: 'act',
    cond: (g, c, p, x) => { const t = x.top; return !!(t && t.p !== p && t.cardAct && isNormalSpell(t.c) && !t.negated) && g.p[p].lp > 1000 && g.p[p].hand.length > 0; },
    cost: function* (g, c, p, L2) { pay(g, p, 1000); L2.data.T = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.T; if (!T || !g.chain.includes(T)) return;
      T.eff = { ...T.eff, cost: null, target: null, res: function* (g2, c2, p2) { randomDiscard(g2, opp(p2), p2); } }; T.t = []; T.data = {};
      log(g, `${name(T.c)}'s effect became "Your opponent discards 1 random card".`); } }] },
  'Dark Illusion': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p, x) => { const t = x.top; if (!t || t.negated) return false; const kind = spellTrapAct(t) || (isMon(t.c) && !t.cardAct);
      return !!kind && (t.t || []).some(m => onField(m) && m.zone === 'm' && faceUp(m) && attr(m) === 'DARK'); },
    target: function* (g, c, p, L2) { L2.data.T = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.T; T.negBy = p; negate(g, T, true); } }] },
  'Dark Mirror Force': { effs: [{ type: 'act',
    cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p) && monsOf(g, opp(p)).some(x => x.pos !== 'atk'),
    res: function* (g, c, p) { const xs = monsOf(g, opp(p)).filter(x => x.pos !== 'atk'); for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.map(x => D(x).n).join(', ')} ${xs.length > 1 ? 'were' : 'was'} banished.`); } }] },
  // The five face-up when it resolves may attack directly this turn, for 400 battle damage each when they do.
  'Dark Scorpion Combination': {
    cont: { loc: 'gy',
      grant: (g, src, c, flag) => flag === 'directAttack' && c.flags.dsc === g.turnNo,
      dmg: (g, src, p, n, o) => o && o.battle && o.direct && o.src && o.src.flags && o.src.flags.dsc === g.turnNo ? 400 : n },
    effs: [{ type: 'act', cond: (g, c, p) => DSC.every(n => monsOf(g, p).some(x => faceUp(x) && named(x, n))),
      res: function* (g, c, p) { for (const x of monsOf(g, p)) if (faceUp(x) && DSC.includes(D(x).n)) x.flags.dsc = g.turnNo; log(g, 'The Dark Scorpions can attack directly this turn.'); } }] },
  'Dark Spirit of the Silent': { effs: [{ type: 'act',
    cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p && monsOf(g, opp(p)).some(m => faceUp(m) && m !== g.aw.a)),
    target: function* (g, c, p, L2) { L2.data.a = g.aw.a; L2.data.t = g.aw.t; L2.t = [g.aw.a]; },
    res: function* (g, c, p, L2) {
      if (g.aw && g.aw.a === L2.data.a) stopAttack(g); log(g, 'The attack was negated.');
      const cs = monsOf(g, opp(p)).filter(m => faceUp(m) && m !== L2.data.a); if (!cs.length) return;
      const [n] = yield* pick(g, p, 'Which of their monsters attacks instead?', cs, 1, 1, 'bad'); if (!n) return;
      toAtk(g, n); n.attacks++; miniBattle(g, n, L2.data.t && onField(L2.data.t) ? L2.data.t : null); } }] },
});
})();
