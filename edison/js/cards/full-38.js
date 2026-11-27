/* Full pool batch 38: Eternal Dread to Ghost Gardna (build/batches/full/full-38.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, pay, search, negate, addMod, equip, addCtr, ctr, negateAttack,
  addRule, ritualSummon, canRitual, token, tokens, coin, winDuel, synCombos, name, D, isMon, isST, isSpell, isTrap, isExtraD,
  onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, nFreeM, shuffleDeck, log, PN,
  has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned, isFrog, isGemini, forbid, num, emit } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
// A battle worked out in the card (attack redirect, as full-03.js battleInstead). t is face-up.
function battleHere(g, a, t) {
  negateAttack(g);
  if (!a || !t || a.zone !== 'm' || t.zone !== 'm' || !faceUp(a) || !faceUp(t)) return;
  log(g, `${name(a)} battles ${name(t)} instead.`);
  const A = atk(g, a), ac = a.ctrl, tc = t.ctrl;
  const noDmg = q => [a, t].some(x => x.ctrl === q && faceUp(x) && has(g, x, 'noBattleDamage')) || g.p[q].noBattleDamage === g.turnNo;
  const kill = xs => { const ok = xs.filter(x => !has(g, x, 'noBattleDestroy')); if (ok.length) destroy(g, ok, { battle: true, killer: ok.length === 1 ? (ok[0] === a ? t : a) : undefined }); };
  if (t.pos === 'atk') {
    const T = atk(g, t);
    if (A > T) { if (!noDmg(tc)) damage(g, tc, A - T, { battle: true, src: a, srcP: ac }); kill([t]); }
    else if (A < T) { if (!noDmg(ac)) damage(g, ac, T - A, { battle: true, src: t, srcP: tc }); kill([a]); }
    else if (A > 0 || T === 0) kill([a, t]);
  } else {
    const Dv = def(g, t);
    if (A > Dv) { if (has(g, a, 'piercing') && !noDmg(tc)) damage(g, tc, A - Dv, { battle: true, src: a, srcP: ac }); kill([t]); }
    else if (A < Dv && !noDmg(ac)) damage(g, ac, Dv - A, { battle: true, src: t, srcP: tc });
  }
}


const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const SPECIAL = ev => !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how);
const isNormalMon = x => isMon(x) && (D(x).k === 'normal' || isGemini(x));
const isFlipMon = c => isMon(c) && (!!D(c).flip || /Flip/.test(D(c).ab || ''));
const isAvian = c => isMon(c) && faceUp(c) && name(c) === 'Elemental HERO Avian';
const toDeckOrExtra = (g, x) => move(g, x, isExtraD(D(x)) ? 'extra' : 'deck', { reason: 'effect' });
// a monster that was Special Summoned (tokens count; summonType is set by every summon)
const wasSS = c => onField(c) && isMon(c) && (c.summonType ? !['normal', 'tribute'].includes(c.summonType) : D(c).k === 'token');
// "by an opponent's card effect" (as full-26.js): the move's own `by` when given, else the turn player
const byOpp = (g, ev, c) => ev.by != null ? ev.by !== c.owner : g.tp !== c.owner;
function* discardN(g, p, n, text) { const ds = yield* pick(g, p, text, g.p[p].hand, n, n, 'cost'); for (const x of ds) move(g, x, 'gy', { reason: 'discard' }); if (ds.length) log(g, `${PN(g, p)} discarded ${ds.map(name).join(', ')}.`); return ds; }
const ritualEffs = rn => [{ type: 'act', tags: { ss: 1 },
  cond: (g, c, p) => canRitual(g, p, { monster: x => named(x, rn) }),
  res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, rn) }); } }];

/* Summon limits, as one duel rule installed by the first event any of these cards sees.
 ENGINE: no general "can't be Special Summoned" flag. "Must be Special Summoned by its own rule" is read like this: its proc
 offers the summon (cond marks it for that one check), every other Special Summon is refused. */
const procOk = (g, c) => g.f38proc && g.f38proc.u === c.u && g.f38proc.seq === g.seq;
const markProc = (g, c) => { g.f38proc = { u: c.u, seq: g.seq }; return true; };
const LOCKS = {
  'Exodius the Ultimate Forbidden Lord': (g, a) => a.type === 'ss' && !procOk(g, a.c),
  'Exxod, Master of The Guard': (g, a) => a.type === 'ss' && !procOk(g, a.c),
  'Frost and Flame Dragon': (g, a) => a.type === 'ss' && !procOk(g, a.c),
  // PARTIAL: "only by the effect of Summon Reactor SK": any Special Summon from the hand or Deck is allowed.
  'Flying Fortress SKY FIRE': (g, a) => a.type === 'ss' && !['hand', 'deck'].includes(a.c.zone),
  'Felgrand Dragon': (g, a) => a.type === 'ss' && !(a.c.zone === 'gy' && a.c.f38ff),
  'Gandora the Dragon of Destruction': (g, a) => a.type === 'ss',
  'Fog King': (g, a) => a.type === 'set',
};
function installRules(g) {
  if (g.f38rules) return; g.f38rules = true;
  addRule(g, (g2, a) => {
    if (!a.c || a.c.id == null) return false;
    if (a.type === 'ss' && a.c.f38dogra && a.c.zone !== 'extra') return true; // Gale Dogra: not properly summoned
    const d = D(a.c), f = d && LOCKS[d.n]; return !!f && f(g2, a); });
}
const lockInstall = { type: 'trig', loc: 'any', res: noop, on: (g) => { installRules(g); return false; } };

E.addScripts({
  'Eternal Dread': { effs: [{ type: 'act',
    res: function* (g) { const ps = allField(g).filter(x => faceUp(x) && named(x, 'Clock Tower Prison')); for (const x of ps) addCtr(g, x, 'clock', 2);
      log(g, ps.length ? `2 Clock Counters were placed on ${ps.length > 1 ? 'each Clock Tower Prison' : 'Clock Tower Prison'}.` : 'There was no Clock Tower Prison.'); } }] },
  // Continuous: +500 ATK in the Damage Step of its direct attack
  'Etoile Cyber': { self: { atk: (g, c) => g.inDS && g.battle && g.battle.a === c && !g.battle.t ? 500 : 0 }, effs: [] },
  'Everliving Underworld Cannon': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, opt: true, label: '800 damage',
      on: (g, ev, c) => ev.type === 'summon' && SPECIAL(ev) && ev.cs.some(x => onField(x) && x.ctrl === c.ctrl && race(x) === 'Zombie'),
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) damage(g, opp(p), 800, { src: c, srcP: p }); } }] },
  'Evolution Burst': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && name(x) === 'Cyber Dragon') && fieldOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
    after: (g, c, p) => { addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.ctrl === p && name(a.c) === 'Cyber Dragon', { end: g.turnNo }); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  // At the attack declaration on a Defense Position monster: -400 ATK and piercing damage this turn.
  'Exarion Universe': { self: { piercing: (g, c) => c.flags.f38pierce === g.turnNo },
    effs: [{ type: 'quick', label: 'Lose 400 ATK: piercing damage',
      cond: (g, c, p) => g.tp === p && !g.inDS && g.aw && g.aw.a === c && g.aw.t && onField(g.aw.t) && g.aw.t.pos !== 'atk' && c.flags.f38exa !== g.aw.group,
      cost: function* (g, c) { c.flags.f38exa = g.aw.group; },
      res: function* (g, c) { if (!onField(c) || !faceUp(c)) return; addMod(g, c, { atk: -400, end: true }); c.flags.f38pierce = g.turnNo; g.seq++; log(g, 'Exarion Universe lost 400 ATK and inflicts piercing damage this turn.'); } }] },
  // Original 2010 text: no once-per-Duel limit (added by later errata). The cards are swapped, not sent (no "sent to the GY" effects); Extra Deck monsters go back to the Extra Deck.
  'Exchange of the Spirit': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[0].gy.length >= 15 && g.p[1].gy.length >= 15 && g.p[p].lp > 1000,
    cost: function* (g, c, p) { pay(g, p, 1000); },
    res: function* (g) {
      for (const P of g.p) { const dk = P.deck.slice(), gy = P.gy.slice(); P.deck = []; P.gy = [];
        for (const x of dk) { x.zone = 'gy'; P.gy.push(x); }
        for (const x of gy) { if (isExtraD(D(x))) { x.zone = 'extra'; P.extra.push(x); } else { x.zone = 'deck'; P.deck.push(x); } } }
      shuffleDeck(g, 0); shuffleDeck(g, 1); g.seq++; log(g, 'Each player swapped their GY with their Deck.'); } }] },
  'Exodius the Ultimate Forbidden Lord': {
    proc: { label: 'Special Summon (shuffle all monsters in your GY into the Deck)',
      cond: (g, c, p) => g.p[p].gy.some(isMon) && markProc(g, c),
      cost: function* (g, c, p) { const xs = g.p[p].gy.filter(isMon); for (const x of xs) toDeckOrExtra(g, x); shuffleDeck(g, p); log(g, `${PN(g, p)} shuffled ${xs.length} monster${xs.length === 1 ? '' : 's'} from the GY into the Deck.`); } },
    self: { atk: (g, c) => 1000 * g.p[c.ctrl].gy.filter(isNormalMon).length },
    effs: [lockInstall,
      { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
        if (ev.type === 'summon' && ev.cs.includes(c)) c.flags.banishOnLeave = true;
        if (ev.type === 'move' && ev.from === 'gy' && ev.c.f38exo) ev.c.f38exo = false;
        return false; } },
      { type: 'trig', mand: true, label: 'Send a monster from your hand or Deck to the GY', on: (g, ev, c) => ev.type === 'attack' && ev.a === c,
        cond: (g, c, p) => [...g.p[p].hand, ...g.p[p].deck].some(isMon),
        res: function* (g, c, p) {
          const [x] = yield* pick(g, p, 'Send a monster from your hand or Deck to the GY', [...g.p[p].hand, ...g.p[p].deck].filter(isMon), 1, 1, 'good'); if (!x) return;
          const fromDeck = x.zone === 'deck'; move(g, x, 'gy', { reason: 'effect', by: p }); if (fromDeck) shuffleDeck(g, p);
          log(g, `${PN(g, p)} sent ${name(x)} to the GY.`);
          if (/Forbidden One/.test(D(x).n)) x.f38exo = true;
          const ns = new Set(g.p[p].gy.filter(y => y.f38exo && /Forbidden One/.test(D(y).n)).map(y => D(y).n));
          if (ns.size >= 5) winDuel(g, p, `${PN(g, p)} won with Exodius the Ultimate Forbidden Lord`); } }] },
  // 1 Tuner + 1 or more non-Tuner Spellcasters: its own Synchro rule so the Spellcaster limit is checked.
  // PARTIAL: always Synchro Summoned in Attack Position.
  'Explosive Magician': { noSynchro: true,
    proc: { extra: true, how: 'synchro', label: 'Synchro Summon',
      cond: (g, c, p) => synCombos(g, p, c).some(m => m.filter(x => !D(x).tu).every(x => race(x) === 'Spellcaster')),
      cost: function* (g, c, p, grp) { const cs = synCombos(g, p, c).filter(m => m.filter(x => !D(x).tu).every(x => race(x) === 'Spellcaster')); let mats = cs[0];
        if (cs.length > 1) { const i = yield* choose(g, p, 'Synchro Summon Explosive Magician with which monsters?', cs.map(m => m.map(name).join(' + '))); mats = cs[i]; }
        for (const m of mats) move(g, m, 'gy', { reason: 'synchro', by: p, group: grp }); log(g, `${PN(g, p)} sent ${mats.map(m => D(m).n).join(' + ')} to the GY for a Synchro Summon.`); } },
    effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Remove 2 Spell Counters: destroy a Spell/Trap',
      cond: (g, c, p) => fieldOf(g, p).reduce((s, x) => s + ctr(x, 'spell'), 0) >= 2 && stOf(g, opp(p)).length > 0,
      cost: function* (g, c, p) { for (let i = 0; i < 2; i++) { const [x] = yield* pick(g, p, 'Remove a Spell Counter from which card?', fieldOf(g, p).filter(y => ctr(y, 'spell') > 0), 1, 1, 'cost'); if (x) addCtr(g, x, 'spell', -1); } log(g, `${PN(g, p)} removed 2 Spell Counters.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  'Exxod, Master of The Guard': {
    proc: { label: 'Special Summon (Tribute a Sphinx monster)',
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && /Sphinx/i.test(name(x))) && markProc(g, c),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Tribute which Sphinx monster?', monsOf(g, p).filter(x => faceUp(x) && /Sphinx/i.test(name(x))), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } } },
    effs: [lockInstall,
      { type: 'trig', mand: true, label: '1000 damage', on: (g, ev, c) => ev.type === 'summon' && ev.how === 'flip' && ev.cs.some(x => attr(x) === 'EARTH' && x !== c),
        res: function* (g, c, p) { if (onField(c) && faceUp(c)) damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },
  // Banishing the Morphtronics is part of the effect (ruling), so it happens even if the target is gone.
  'Factory of 100 Machines': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Machine'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Machine gains ATK?', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Machine'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const ms = g.p[p].gy.filter(x => isMon(x) && /Morphtronic/.test(D(x).n)); for (const x of ms) move(g, x, 'ban', { reason: 'effect', by: p });
      log(g, `${PN(g, p)} banished ${ms.length} Morphtronic monster${ms.length === 1 ? '' : 's'}.`);
      const t = live(L2)[0]; if (t && faceUp(t) && ms.length) { addMod(g, t, { atk: 200 * ms.length, end: true }); log(g, `${name(t)} gained ${200 * ms.length} ATK.`); } } }] },
  'Faustian Bargain': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => fieldMons(g).some(wasSS) && g.p[p].hand.some(x => D(x).k === 'normal' && lv(x) <= 4),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Send which Special Summoned monster to the GY?', fieldMons(g).filter(wasSS), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; const ev = move(g, t, 'gy', { reason: 'effect', by: p }); log(g, `${D(t).n} was sent to the GY.`);
      if (!ev || t.zone !== 'gy') return;
      const ns = g.p[p].hand.filter(x => D(x).k === 'normal' && lv(x) <= 4); if (!ns.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon a Level 4 or lower Normal Monster from your hand', ns, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  // PARTIAL: "can't attack directly" is a lock on its attacks while the opponent has no monster it may attack.
  'Feather Shot': { effs: [{ type: 'act', cond: (g, c, p) => g.phase === 'main1' && monsOf(g, p).some(isAvian),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Elemental HERO Avian attacks more?', monsOf(g, p).filter(isAvian), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !isAvian(t)) return;
      if (g.onlyAttacker[p] && g.onlyAttacker[p] !== t.u) { g.onlyAttacker[p] = -1; log(g, 'Two Avians were chosen, so neither can attack.'); return; }
      const n = monsOf(g, p).length; g.onlyAttacker[p] = t.u;
      if (!(t.flags.maxAttacksTurn === g.turnNo)) { t.flags.maxAttacks = n; t.flags.maxAttacksTurn = g.turnNo; }
      const u = t.u; addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.u === u && !monsOf(g2, opp(a.c.ctrl)).some(m => !(faceUp(m) && has(g2, m, 'noAttackTarget'))), { end: g.turnNo });
      log(g, `${name(t)} can attack ${n} time${n === 1 ? '' : 's'} this turn, but not directly.`); } }] },
  'Feather Wind': { effs: [{ type: 'act',
    cond: (g, c, p, x) => spellTrapAct(x.top) && !x.top.negated && monsOf(g, p).some(isAvian),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  'Featherizer': { effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Send a Gemini and draw 1',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => g.p[p].deck.length >= 2 && g.p[p].deck.some(x => isMon(x) && isGemini(x)),
    res: function* (g, c, p) { const x = yield* search(g, p, x => isMon(x) && isGemini(x), 'Send a Gemini monster from your Deck to the GY', 'gy'); if (x) draw(g, p, 1); } }] },
  'Felgrand Dragon': { effs: [lockInstall,
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.to === 'gy') c.f38ff = !!ev.wasField; return false; } },
    { type: 'trig', mand: true, label: 'Gain ATK', on: (g, ev, c) => evSummoned(ev, c) && SPECIAL(ev),
      cond: (g, c, p) => g.p[p].gy.some(isMon),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which monster in your GY?', g.p[p].gy.filter(isMon), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy' || !onField(c) || !faceUp(c)) return; addMod(g, c, { atk: lv(t) * 200 }); log(g, `Felgrand Dragon gained ${lv(t) * 200} ATK.`); } }] },
  // PARTIAL: a Spell/Trap that targets a Field Spell can still be activated (it just won't destroy it).
  'Field Barrier': {
    cont: { grant: (g, src, c, flag) => flag === 'noEffectDestroy' && c.zone === 'fz',
      forbid: (g, src, a) => (a.type === 'activate' && a.eff && a.eff.type === 'act' && a.c && isSpell(a.c) && D(a.c).sub === 'Field')
        || (a.type === 'setST' && a.c && D(a.c).sub === 'Field' && !!g.p[a.p].fz) },
    effs: [{ type: 'act', cond: (g, c, p) => !stOf(g, p).some(x => x !== c && faceUp(x) && named(x, 'Field Barrier')), res: noop },
      // Heavy Storm destroys Field Barrier and a Field Spell at the same time, and the Field Spell survives (ruling): the
      // Field Spells carry the protection as a flag until the end of the destruction that removed Field Barrier.
      { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
        if (ev.type === 'move' && ev.c === c && ev.wasField) g.f38fbLeft = ev.group;
        const on = stOnField(g).some(x => faceUp(x) && named(x, 'Field Barrier'));
        for (const fz of [g.p[0].fz, g.p[1].fz]) { if (!fz) continue;
          if (on) { if (!fz.flags.noEffectDestroy) { fz.flags.noEffectDestroy = true; fz.flags.f38fb = true; } }
          else if (fz.flags.f38fb && ev.group !== g.f38fbLeft) { fz.flags.noEffectDestroy = false; fz.flags.f38fb = false; } }
        return false; } }] },
  'Field-Commander Rahz': { effs: [{ type: 'trig', mand: true, label: 'Put a Warrior on top of your Deck', on: (g, ev, c) => evSummoned(ev, c) && ev.how !== 'flip',
    cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && race(x) === 'Warrior' && lv(x) <= 4 && !named(x, 'Field-Commander Rahz')),
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Warrior' && lv(x) <= 4 && !named(x, 'Field-Commander Rahz')); if (!cs.length) return;
      const [x] = yield* pick(g, p, 'Put which Warrior on top of your Deck?', cs, 1, 1, 'good'); shuffleDeck(g, p); if (x) { move(g, x, 'deckTop', { reason: 'effect' }); log(g, `${PN(g, p)} put a Warrior on top of the Deck.`); } } }] },
  // Port of goat-4.js "Fiend Skull Dragon". PARTIAL: the Trap negation is an optional Spell Speed 3 response (ENGINE: no
  // automatic negation hook).
  // The recipe names "Lesser Fiend"; the card data calls it "Lesser Fiend (Archfiend)". No substitutes.
  'Fiend Skull Dragon (Archfiend)': { mats: [x => D(x).n === 'Cave Dragon', x => D(x).n === 'Lesser Fiend (Archfiend)'],
    cont: { negates: (g, src, c) => isFlipMon(c) },
    effs: [{ type: 'quick', speed: 3, ds: true, label: 'Negate the Trap targeting it',
      cond: (g, c, p, x) => { const t = x.top; return !!(t && !t.negated && isTrap(t.c) && (t.t || []).includes(c) && faceUp(c)); },
      target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated) return; T.negBy = p; negate(g, T, true); } }] },
  'Fiend\'s Sanctuary': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) { const t = tokens(g, p, { n: 'Metal Fiend Token', a: 'DARK', r: 'Fiend', lv: 1, atk: 0, def: 0 }, 1, 'atk'); if (!t.length) log(g, 'No token could be summoned.'); } }] },
  'Fiendish Engine Omega': { effs: [
    { type: 'trig', mand: true, label: 'Summon an Engine Token', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { tokens(g, p, { n: 'Engine Token', a: 'EARTH', r: 'Machine', lv: 1, atk: 200, def: 200 }, 1, 'atk'); } },
    { type: 'ign', opt: true, label: 'Gain 1000 ATK (destroyed in the End Phase)',
      res: function* (g, c) { if (!onField(c) || !faceUp(c)) return; addMod(g, c, { atk: 1000, end: true }); c.flags.f38omega = g.turnNo; log(g, 'Fiendish Engine Omega gained 1000 ATK.'); } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.f38omega === g.turnNo,
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  // PARTIAL: it draws only if all 5 targets were shuffled in.
  'Fifth Hope': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.filter(x => /^Elemental HERO/.test(D(x).n)).length >= 5 && g.p[p].deck.length >= 1,
    target: function* (g, c, p, L2) { L2.data.three = fieldOf(g, p).filter(x => x !== c).length === 0 && g.p[p].hand.length === 0;
      yield* tgt(g, p, L2, 'Shuffle which 5 Elemental HERO cards into the Deck?', g.p[p].gy.filter(x => /^Elemental HERO/.test(D(x).n)), 5, 5, 'cost'); },
    res: function* (g, c, p, L2) { const ts = L2.t.filter(x => x.zone === 'gy'); for (const x of ts) toDeckOrExtra(g, x); shuffleDeck(g, p); log(g, `${PN(g, p)} shuffled ${ts.length} card${ts.length === 1 ? '' : 's'} into the Deck.`);
      if (ts.length === 5) draw(g, p, L2.data.three ? 3 : 2); } }] },
  // PARTIAL: "you can destroy this card instead" is always used (no prompt inside a destruction).
  'Fighting Spirit': {
    cont: { atk: (g, src, m) => src.equipTo === m.u ? 300 * monsOf(g, opp(src.ctrl)).length : 0,
      replaceDestroy: (g, src, v, o) => { if (!o.battle || src.equipTo !== v.u || !onField(src)) return false; log(g, 'Fighting Spirit was destroyed instead.'); destroy(g, [src], { by: src.ctrl }); return true; } },
    effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Fighting Spirit to which monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c)) equip(g, c, t); } }] },
  'Fine': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.length >= 2,
    res: function* (g, c, p) { yield* discardN(g, p, Math.min(2, g.p[p].hand.length), 'Discard 2 cards'); } }] },
  // PARTIAL: the Tokens can be Tributed for any Tribute Summon (ENGINE: no per-summon Tribute limit); Flip Summons aren't blocked.
  'Fires of Doomsday': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => !g.summoned[p] && nFreeM(g, p) >= 2,
    after: (g, c, p) => { addRule(g, (g2, a) => (a.type === 'ns' || a.type === 'ss') && a.p === p && !(a.c && D(a.c) && D(a.c).n === 'Doomsday Token'), { end: g.turnNo }); },
    res: function* (g, c, p) { tokens(g, p, { n: 'Doomsday Token', a: 'DARK', r: 'Fiend', lv: 1, atk: 0, def: 0 }, 2, 'def'); } }] },
  'Firestorm Prominence': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy face-down and non-FIRE monsters',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.pos === 'set' || attr(x) !== 'FIRE'), { by: p }); } }] },
  'Firewall': { effs: [actNoop,
    { type: 'quick', loc: 'st', label: 'Banish a Pyro: negate the direct attack',
      cond: (g, c, p) => !g.inDS && g.aw && !g.aw.t && g.aw.a.ctrl !== p && !has(g, g.aw.a, 'unaffectedTraps') && g.p[p].gy.some(x => isMon(x) && race(x) === 'Pyro'),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish a Pyro monster from your GY', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Pyro'), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
      res: function* (g) { if (g.aw) negateAttack(g); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Pay 500 LP or destroy this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 500 && (yield* yn(g, p, 'Pay 500 LP to keep Firewall?'))) pay(g, p, 500); else destroy(g, [c], { by: p }); } }] },
  'Fish Depth Charge': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Fish') && fieldOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute a Fish monster', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Fish'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { if (destroy(g, live(L2), { by: p, src: c }).length) draw(g, p, 1); } }] },
  'Flash of the Forbidden Spell': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => monsOf(g, opp(p)).length === 5,
    res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)), { by: p, src: c }); } }] },
  // ENGINE: no response window after damage calculation, so it is an optional trigger while Set. "It is now the End Phase":
  // the Battle Phase ends and Main Phase 2 allows no actions.
  'Flashbang': { effs: [{ type: 'trig', loc: 'any', label: 'Activate Flashbang',
    on: (g, ev, c) => ev.type === 'afterCalc' && !ev.t && ev.a && ev.a.ctrl !== c.ctrl && c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo,
    cond: (g, c) => c.zone === 'st' && c.pos === 'set',
    cost: function* (g, c) { c.pos = 'up'; g.seq++; },
    res: function* (g, c, p) { g.bpEnd = true; const t = g.turnNo; addRule(g, (g2, a) => g2.phase === 'main2' && g2.turnNo === t && a.p === g2.tp && ['ns', 'set', 'ss', 'activate', 'setST', 'pos'].includes(a.type), { end: t });
      log(g, 'It is now the End Phase.'); if (onField(c)) move(g, c, 'gy', { reason: 'rule' }); } }] },
  'Flying Fortress SKY FIRE': { effs: [lockInstall,
    { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Send a card from your hand: destroy a card',
      cond: (g, c, p) => g.p[p].hand.length > 0 && fieldOf(g, opp(p)).length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which card from your hand to the GY?', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); } },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } },
    { type: 'quick', tags: { destroy: 1 }, label: 'Destroy the summoned monster(s), 800 damage',
      cond: (g, c, p) => g.tp !== p && !g.inDS && c.flags.f38sky !== g.turnNo && g.sw && g.sw.p !== p && g.sw.cs.some(x => onField(x) && x.ctrl !== p),
      cost: function* (g, c, p, L2) { c.flags.f38sky = g.turnNo; L2.data.cs = g.sw.cs.filter(x => onField(x) && x.ctrl !== p); },
      res: function* (g, c, p, L2) { if (destroy(g, L2.data.cs.filter(onField), { by: p }).length) damage(g, opp(p), 800, { src: c, srcP: p }); } },
    // ENGINE: no response window after a Set, so the Set part is an optional trigger.
    { type: 'trig', tags: { destroy: 1 }, label: 'Destroy the Set card, 800 damage',
      on: (g, ev, c) => ev.type === 'move' && ev.reason === 'set' && ev.c.ctrl !== c.ctrl && g.tp !== c.ctrl && !g.inDS,
      cond: (g, c, p, x) => c.flags.f38sky !== g.turnNo && onField(x.ev.c),
      cost: function* (g, c) { c.flags.f38sky = g.turnNo; },
      res: function* (g, c, p, L2) { const t = L2.ev.c; if (onField(t) && destroy(g, [t], { by: p }).length) damage(g, opp(p), 800, { src: c, srcP: p }); } }] },
  // PARTIAL: the normal draw happens, then the card goes back on top of the Deck and an Alien is added (same result).
  'Flying Saucer Muusik\'i': { effs: [{ type: 'trig', opt: true, label: 'Add an Alien instead of drawing',
    on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && ev.phase === 'draw' && g.tp === c.ctrl && ev.c.owner === c.ctrl,
    cond: (g, c, p) => g.p[p].deck.some(x => /Alien/.test(D(x).n)) && !forbid(g, { type: 'search', p }),
    res: function* (g, c, p, L2) { const x = L2.ev.c; if (x.zone === 'hand') { move(g, x, 'deckTop', { reason: 'effect' }); log(g, `${PN(g, p)} put the drawn card back on top of the Deck.`); }
      yield* search(g, p, y => /Alien/.test(D(y).n), 'Add an Alien card from your Deck'); } }] },
  'Fog Control': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && /Cloudian/.test(name(x))) && fieldMons(g).filter(faceUp).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute a Cloudian monster', monsOf(g, p).filter(x => faceUp(x) && /Cloudian/.test(name(x))), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Place 3 Fog Counters on which monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addCtr(g, t, 'fog', 3); log(g, `3 Fog Counters were placed on ${name(t)}.`); } } }] },
  // Normal Summon with 0 or 1 Tribute (PARTIAL: the standard 2 Tributes is still offered); it can't be Set.
  // "Neither player can Tribute": every monster on the field is marked as unusable for Tribute Summons while it applies.
  // PARTIAL: Tributes paid as a cost or for a Ritual aren't stopped (ENGINE: no general Tribute lock).
  'Fog King': { self: { tributes: () => [0, 1], atk: (g, c) => c.flags.f38fog || 0 },
    effs: [lockInstall,
      { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
        if (ev.type === 'summon' && ev.cs.includes(c) && ev.how === 'tribute' && ev.tribs) c.flags.f38fog = ev.tribs.reduce((s, x) => s + num(D(x).atk), 0);
        if (c.zone === 'm') { const on = fieldMons(g).some(k => named(k, 'Fog King') && faceUp(k) && !L.negd(g, k));
          for (const m of fieldMons(g)) { if (on && !m.flags.noTribute) { m.flags.noTribute = true; m.flags.f38fogT = true; } else if (!on && m.flags.f38fogT) { m.flags.noTribute = false; m.flags.f38fogT = false; } } }
        else if (!fieldMons(g).some(k => named(k, 'Fog King'))) for (const m of fieldMons(g)) if (m.flags.f38fogT) { m.flags.noTribute = false; m.flags.f38fogT = false; }
        return false; } }] },
  'Foolish Revival': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, opp(p)) >= 0 && g.p[opp(p)].gy.some(isMon),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which monster to their side?', g.p[opp(p)].gy.filter(isMon), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, opp(p), t, 'def'); } }] },
  // The negation ends in the End Phase (cleared by any copy of this card that sees the End Phase).
  'Forbidden Chalice': { effs: [{ type: 'act', ds: true, cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster gains 400 ATK and loses its effects?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; addMod(g, t, { atk: 400, end: true });
      if (t.flags.f38chalT == null) t.flags.f38chalPrev = !!t.flags.negated; t.flags.negated = true; t.flags.f38chalT = g.turnNo; g.seq++;
      log(g, `${name(t)} gained 400 ATK and its effects are negated this turn.`); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => {
      for (const m of fieldMons(g)) if (m.flags.f38chalT != null && (m.flags.f38chalT !== g.turnNo || (ev.type === 'phase' && ev.ph === 'end'))) { m.flags.negated = m.flags.f38chalPrev; m.flags.f38chalT = null; m.flags.f38chalPrev = null; g.seq++; }
      return false; } }] },
  'Fortune Lady Earth': { self: { atk: (g, c) => lv(c) * 400, def: (g, c) => lv(c) * 400 },
    effs: [{ type: 'trig', mand: true, label: 'Level up', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c) { if (onField(c) && faceUp(c) && lv(c) < 12) { c.flags.lv = lv(c) + 1; log(g, `${name(c)} is now Level ${lv(c)}.`); c.flags.f38lv = lv(c); damage(g, opp(c.ctrl), 400, { src: c, srcP: c.ctrl }); } } },
      // "When the Level of this card increases" by another effect: seen by comparing its Level at each event (its own level
      // up inflicts the damage in the same resolution). PARTIAL: that damage isn't a chain link of its own.
      { type: 'trig', mand: true, label: '400 damage', on: (g, ev, c) => { const n = lv(c), prev = c.flags.f38lv; c.flags.f38lv = n; return prev != null && n > prev; },
        res: function* (g, c, p) { damage(g, opp(p), 400, { src: c, srcP: p }); } }] },
  // PARTIAL: "by the effect of a Fortune Lady card" is read as: another Fortune Lady of yours used an effect this turn.
  'Fortune Lady Fire': { self: { atk: (g, c) => lv(c) * 200, def: (g, c) => lv(c) * 200 },
    effs: [{ type: 'trig', mand: true, opt: true, label: 'Level up', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c) { if (onField(c) && faceUp(c) && lv(c) < 12) { c.flags.lv = lv(c) + 1; log(g, `${name(c)} is now Level ${lv(c)}.`); } } },
      { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a monster and inflict its ATK',
        on: (g, ev, c) => evSummoned(ev, c) && SPECIAL(ev) && ev.byEffect && c.pos === 'atk'
          && L.allCards(g, 'gy').concat(L.allCards(g, 'm'), L.allCards(g, 'hand'), L.allCards(g, 'ban')).some(x => x !== c && x.owner === c.owner && /^Fortune Lady/.test(D(x).n) && Object.values(x.used || {}).includes(g.turnNo)),
        cond: (g, c, p) => oppFaceUp(g, p).length > 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const A = atk(g, t); if (destroy(g, [t], { by: p }).length && A > 0) damage(g, opp(p), A, { src: c, srcP: p }); } }] },
  'Fragrance Storm': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(x => faceUp(x) && race(x) === 'Plant'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Plant monster?', fieldMons(g).filter(x => faceUp(x) && race(x) === 'Plant'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { if (!destroy(g, live(L2).filter(x => race(x) === 'Plant'), { by: p, src: c }).length || !g.p[p].deck.length) return;
      draw(g, p, 1); const x = g.p[p].hand[g.p[p].hand.length - 1];
      if (x && isMon(x) && race(x) === 'Plant' && g.p[p].deck.length && (yield* yn(g, p, `Reveal ${name(x)} to draw 1 more card?`))) { log(g, `${PN(g, p)} revealed ${name(x)}.`); draw(g, p, 1); } } }] },
  'Frequency Magician': { effs: [
    { type: 'trig', mand: true, label: 'Place a Spell Counter', on: (g, ev, c) => evSummoned(ev, c, ['normal']),
      res: function* (g, c) { if (onField(c) && faceUp(c) && ctr(c, 'spell') < 1) { addCtr(g, c, 'spell', 1); log(g, 'A Spell Counter was placed on Frequency Magician.'); } } },
    { type: 'ign', label: 'Remove a Spell Counter: +500 ATK', cond: (g, c, p) => ctr(c, 'spell') > 0,
      cost: function* (g, c) { addCtr(g, c, 'spell', -1); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster gains 500 ATK?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: 500, end: true }); log(g, `${name(t)} gained 500 ATK.`); } } }] },
  'Freya, Spirit of Victory': {
    self: { noAttackTarget: (g, c) => monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && race(x) === 'Fairy' && !named(x, 'Freya, Spirit of Victory')) },
    cont: { atk: (g, src, m) => m.ctrl === src.ctrl && race(m) === 'Fairy' ? 400 : 0, def: (g, src, m) => m.ctrl === src.ctrl && race(m) === 'Fairy' ? 400 : 0 },
    effs: [] },
  'Froggy Forcefield': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.aw && g.aw.t && g.aw.t.ctrl === p && onField(g.aw.t) && faceUp(g.aw.t) && isFrog(g.aw.t) && name(g.aw.t) !== 'Frog the Jam',
    res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)).filter(x => x.pos === 'atk'), { by: p, src: c }); } }] },
  'Frost and Flame Dragon': {
    proc: { label: 'Special Summon (banish 1 FIRE and 2 WATER from your GY)',
      cond: (g, c, p) => { const gy = g.p[p].gy.filter(isMon); const w = gy.filter(x => attr(x) === 'WATER').length; return gy.some(x => attr(x) === 'FIRE') && w >= 2 && markProc(g, c); },
      cost: function* (g, c, p, grp) { const [f] = yield* pick(g, p, 'Banish a FIRE monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'FIRE'), 1, 1, 'cost');
        const ws = yield* pick(g, p, 'Banish 2 WATER monsters from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'WATER'), 2, 2, 'cost');
        const xs = [f, ...ws].filter(Boolean); for (const x of xs) move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${xs.map(name).join(', ')}.`); } },
    effs: [lockInstall,
      { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Discard: destroy a monster', cond: (g, c, p) => g.p[p].hand.length > 0 && fieldMons(g).length > 0,
        cost: function* (g, c, p) { yield* discardN(g, p, 1, 'Discard 1 card'); },
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  'Full Salvo': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.length > 0,
    res: function* (g, c, p) { const h = g.p[p].hand.slice(); for (const x of h) move(g, x, 'gy', { reason: 'effect', by: p }); if (!h.length) return;
      log(g, `${PN(g, p)} sent ${h.length} card${h.length === 1 ? '' : 's'} from the hand to the GY.`); damage(g, opp(p), 200 * h.length, { src: c, srcP: p }); } }] },
  'Future Samurai': { effs: [{ type: 'ign', opt: true, gemini: true, tags: { destroy: 1 }, label: 'Banish a monster: destroy a monster',
    cond: (g, c, p) => g.p[p].gy.some(isMon) && fieldMons(g).some(faceUp),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish a monster from your GY', g.p[p].gy.filter(isMon), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2).filter(faceUp), { by: p }); } }] },
  // Every monster is turned to Attack Position whenever anything happens while Gaap applies (Set monsters face-up, no Flip effects).
  'Gaap the Divine Soldier': {
    cont: { forbid: (g, src, a) => a.type === 'pos' },
    effs: [{ type: 'trig', res: noop, on: (g, ev, c) => {
      let n = 0; for (const m of fieldMons(g)) if (m.pos !== 'atk') { m.pos = 'atk'; n++; }
      if (n) { g.seq++; log(g, 'Gaap the Divine Soldier changed every monster to Attack Position.'); }
      return false; } },
      { type: 'ign', opt: true, label: 'Reveal Fiends: +300 ATK each', cond: (g, c, p) => g.p[p].hand.some(x => isMon(x) && race(x) === 'Fiend'),
        cost: function* (g, c, p, L2) { const xs = yield* pick(g, p, 'Reveal which Fiend monsters?', g.p[p].hand.filter(x => isMon(x) && race(x) === 'Fiend'), 1, 99, 'good'); L2.data.n = xs.length; log(g, `${PN(g, p)} revealed ${xs.map(name).join(', ')}.`); },
        res: function* (g, c, p, L2) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 300 * L2.data.n, end: true }); log(g, `Gaap gained ${300 * L2.data.n} ATK.`); } } }] },
  // The Extra Deck monster wasn't properly summoned, so it can't be Special Summoned from the GY or banishment.
  'Gale Dogra': { effs: [lockInstall,
    { type: 'ign', label: 'Pay 3000: send an Extra Deck monster to the GY', cond: (g, c, p) => g.p[p].lp > 3000 && g.p[p].extra.length > 0,
      cost: function* (g, c, p) { pay(g, p, 3000); },
      res: function* (g, c, p) { installRules(g); const [x] = yield* pick(g, p, 'Send which Extra Deck monster to the GY?', g.p[p].extra, 1, 1, 'good'); if (x) { move(g, x, 'gy', { reason: 'effect' }); x.f38dogra = true; log(g, `${PN(g, p)} sent ${D(x).n} from the Extra Deck to the GY.`); } } }] },
  'Gambler of Legend': { effs: [{ type: 'ign', opt: true, label: 'Toss a coin 3 times',
    res: function* (g, c, p) {
      let h = 0; for (let i = 0; i < 3; i++) if (coin(g, p)) h++;
      if (h === 3) destroy(g, monsOf(g, opp(p)), { by: p });
      else if (h === 2) { const hd = g.p[opp(p)].hand; if (hd.length) { const x = hd[Math.floor(g.rnd() * hd.length)]; move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, opp(p))} discarded ${name(x)} at random.`); } }
      else if (h === 1) { const cs = fieldOf(g, p); if (cs.length) { const [x] = yield* pick(g, p, 'Destroy 1 card you control', cs, 1, 1, 'cost'); destroy(g, [x], { by: p }); } }
      else { const hd = g.p[p].hand.slice(); for (const x of hd) move(g, x, 'gy', { reason: 'discard' }); if (hd.length) log(g, `${PN(g, p)} discarded the whole hand.`); } } }] },
  'Gandora the Dragon of Destruction': { effs: [lockInstall,
    { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute', 'flip'].includes(ev.how)) c.flags.f38gand = g.turnNo; return false; } },
    { type: 'ign', tags: { destroy: 1 }, label: 'Pay half your LP: destroy and banish all other cards', cond: (g, c) => allField(g).some(x => x !== c),
      cost: function* (g, c, p) { pay(g, p, Math.floor(g.p[p].lp / 2)); },
      res: function* (g, c, p) { const out = destroy(g, allField(g).filter(x => x !== c), { by: p, banish: true }); if (out.length && onField(c) && faceUp(c)) { addMod(g, c, { atk: 300 * out.length }); log(g, `Gandora gained ${300 * out.length} ATK.`); } } },
    { type: 'trig', mand: true, opt: true, label: 'Send this card to the GY', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.f38gand === g.turnNo,
      res: function* (g, c, p) { if (onField(c)) { move(g, c, 'gy', { reason: 'effect', by: p }); log(g, 'Gandora was sent to the GY.'); } } }] },
  'Garlandolf, King of Destruction': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy monsters with lower DEF',
    on: (g, ev, c) => evSummoned(ev, c, ['ritual']),
    res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; const A = atk(g, c);
      const out = destroy(g, fieldMons(g).filter(x => x !== c && faceUp(x) && def(g, x) <= A), { by: p });
      if (out.length && onField(c)) { addMod(g, c, { atk: 100 * out.length }); log(g, `Garlandolf gained ${100 * out.length} ATK.`); } } }] },
  'Garma Sword': { effs: [] },
  'Garma Sword Oath': { effs: ritualEffs('Garma Sword') },
  // PARTIAL: Flip Summons aren't blocked by the "can't Summon" lock.
  'Gateway to Dark World': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => !g.summoned[p] && freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && /Dark World/.test(D(x).n)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Dark World monster?', g.p[p].gy.filter(x => isMon(x) && /Dark World/.test(D(x).n)), 1, 1, 'good'); },
    after: (g, c, p, L2) => { const u = L2.t[0] && L2.t[0].u; addRule(g, (g2, a) => (a.type === 'ns' || a.type === 'ss') && a.p === p && !(a.c && a.c.u === u && a.c.zone === 'gy'), { end: g.turnNo }); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  // The boost lasts until the end of the next Damage Step each monster battles in (cleared by any copy of this card).
  'Gauntlet Warrior': { effs: [
    { type: 'quick', ds: true, label: 'Tribute: Warriors gain 500 ATK/DEF',
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Gauntlet Warrior.`); },
      res: function* (g, c, p) { const ws = monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Warrior'); for (const w of ws) addMod(g, w, { atk: 500, def: 500, f38gw: true });
        if (ws.length) log(g, `${ws.map(name).join(', ')} gained 500 ATK and DEF.`); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { if (ev.type === 'dsEnd') for (const x of [ev.a, ev.t]) if (x && x.mods && x.mods.some(m => m.f38gw)) x.mods = x.mods.filter(m => !m.f38gw); return false; } }] },
  // Can be treated as 2 Tributes for a LIGHT Fairy. PARTIAL: offered only when it is your only monster (the engine can't
  // tell which monster was Tributed when counting).
  'Gellenduo': { self: { noBattleDestroy: true },
    cont: { tributes: (g, src, c, p, need) => src.ctrl === p && need === 2 && attr(c) === 'LIGHT' && race(c) === 'Fairy' && monsOf(g, p).length === 1 ? 1 : null },
    effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy this card', on: (g, ev, c) => ev.type === 'damage' && ev.p === c.ctrl && ev.n > 0,
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) destroy(g, [c], { by: p }); } }] },
  'Gem Flash Energy': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Damage for Continuous Spells', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      cond: g => stOnField(g).some(x => faceUp(x) && isSpell(x) && D(x).sub === 'Continuous'),
      res: function* (g, c, p) { if (!onField(c)) return; const n = stOnField(g).filter(x => faceUp(x) && isSpell(x) && D(x).sub === 'Continuous').length; if (n) damage(g, opp(p), 300 * n, { src: c, srcP: p }); } }] },
  'Generation Shift': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => monsOf(g, p).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which of your monsters?', monsOf(g, p).filter(faceUp), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const n = D(t).n, tok = D(t).k === 'token';
      if (!destroy(g, [t], { by: p }).length || tok) return;
      yield* search(g, p, x => D(x).n === n, `Add ${n} from your Deck`); } }] },
  'Genesis Dragon': { effs: [
    { type: 'ign', opt: true, label: 'Discard a Dragon: add a Dragon from the GY',
      cond: (g, c, p) => g.p[p].hand.some(x => isMon(x) && race(x) === 'Dragon') && g.p[p].gy.some(x => isMon(x) && race(x) === 'Dragon'),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard a Dragon monster', g.p[p].hand.filter(x => isMon(x) && race(x) === 'Dragon'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Dragon from your GY?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Dragon'), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${D(t).n} to the hand.`); } } },
    { type: 'trig', loc: 'gy', when: true, label: 'Return all Dragons from your GY to the Deck',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy',
      cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && race(x) === 'Dragon'),
      res: function* (g, c, p) { const ds = g.p[p].gy.filter(x => isMon(x) && race(x) === 'Dragon'); for (const x of ds) toDeckOrExtra(g, x); shuffleDeck(g, p); log(g, `${PN(g, p)} returned ${ds.length} Dragon${ds.length === 1 ? '' : 's'} to the Deck.`); } }] },
  'Genetic Woman': { effs: [{ type: 'ign', opt: true, label: 'Pay 1000: add a banished Psychic',
    cond: (g, c, p) => g.p[p].lp > 1000 && g.p[p].ban.some(x => isMon(x) && race(x) === 'Psychic'),
    cost: function* (g, c, p) { pay(g, p, 1000); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which banished Psychic monster?', g.p[p].ban.filter(x => isMon(x) && race(x) === 'Psychic'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'ban') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${D(t).n} to the hand.`); } } }] },
  'Gernia': { effs: [
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.to === 'gy' && ev.wasField && ev.destroyed && !ev.battle && ev.snap && ev.snap.faceUp && ev.prevCtrl === c.owner && byOpp(g, ev, c)) c.flags.f38gernia = g.turnNo; return false; } },
    { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon this card',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner && c.flags.f38gernia != null && c.flags.f38gernia < g.turnNo,
      res: function* (g, c, p) { c.flags.f38gernia = null; if (c.zone === 'gy') ss(g, p, c, 'atk'); } }] },
  // ENGINE: attack redirect ("change the target to this card"): attack() keeps its target local, so the declared attack is
  // negated and the attacker battles Ghost Gardna here (as full-03.js battleInstead). PARTIAL: no Damage Step window for that battle.
  'Ghost Gardna': { effs: [
    { type: 'trig', when: true, label: 'Change the attack target to this card',
      on: (g, ev, c) => ev.type === 'attack' && !!ev.t && ev.t !== c && ev.t.ctrl === c.ctrl && faceUp(ev.t) && !!ev.a && ev.a.ctrl !== c.ctrl,
      cond: (g, c) => !!g.aw && !g.aw.blocked && faceUp(c),
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (!g.aw || g.aw.a !== a || g.aw.blocked || !onField(c) || !faceUp(c)) return; g.aw.blocked = true;
        log(g, `${PN(g, p)} changed the attack target to Ghost Gardna.`); battleHere(g, a, c); } },
    { type: 'trig', loc: 'gy', mand: true, label: 'A monster loses 1000 ATK',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster loses 1000 ATK?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: -1000, end: true }); log(g, `${name(t)} lost 1000 ATK.`); } } }] },
});

/* Tokens with effects of their own (indented so the card-file scan skips them: they aren't cards). */
E.addScripts({
    'Metal Fiend Token': {
      self: { cantAttack: true },
      // the battle damage its controller would take from its battles goes to the opponent instead
      cont: { dmg: (g, src, p, n, o) => { if (!o.battle || p !== src.ctrl || !g.battle || (g.battle.a !== src && g.battle.t !== src)) return undefined; damage(g, opp(p), n, { battle: true, src: o.src, srcP: p }); return 0; } },
      effs: [{ type: 'trig', mand: true, label: 'Pay 1000 LP or destroy this Token', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
        res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 1000 && (yield* yn(g, p, 'Pay 1000 LP to keep the Metal Fiend Token?'))) pay(g, p, 1000); else destroy(g, [c], { by: p }); } }] },
});
})();
