/* Full pool batch 45: Swallow's Nest to Vampire's Curse (build/batches/full/full-45.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, takeControl, setFaceDown, addMod,
  equip, addRule, tokens, ritualSummon, canRitual, coin, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv,
  baseAtk, monsOf, stOf, allField, fieldMons, freeM, freeST, nFreeM, shuffleDeck, log, PN, has, live, opp, oppFaceUp,
  stOnField, spellTrapAct, evSummoned, fromFieldToGY, battleKill, forbid, stat, negd, num, isGemini, synCombos } = L;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
const ATTRS = ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND'];
const origDef = x => x.flags && x.flags.tokAtk != null ? num(D(x).def) : num(D(x).def);
// a hidden observer: on() does its work and never triggers
const watch = fn => ({ type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { fn(g, ev, c); return false; } });
// "When this card is destroyed by battle and sent to the GY"
const battleToGY = (ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy';
const posOf = function* (g, p, x) { const i = yield* choose(g, p, `${D(x).n}: which position?`, ['Attack Position', 'Defense Position']); return i ? 'def' : 'atk'; };
// Equip Spells: target a face-up monster that passes filter, equip it at resolution
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?', after) => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c) && equip(g, c, t) && after) after(g, c, t); } });
const eqOf = (g, c) => c.equipTo ? fieldMons(g).find(m => m.u === c.equipTo) || null : null;
// The engine lets a monster attack directly when every monster of the opponent "can't be attacked". By the rules it can't
// attack at all then (unless it can attack directly). Twilight Rose Knight adds that check while it applies (as full-26.js).
const noTargetLeft = (g, q) => monsOf(g, q).length > 0 && monsOf(g, q).every(m => faceUp(m) && has(g, m, 'noAttackTarget'));
const attackLock = (g, src, a) => a.type === 'attack' && a.c && a.c.ctrl !== src.ctrl && noTargetLeft(g, src.ctrl) && !has(g, a.c, 'directAttack');
const byOpp = (g, ev, c) => ev.by != null ? ev.by !== c.owner : g.tp !== c.owner;
// Monsters that can be Normal Summoned (Valhalla can't Special Summon a "Special Summon Monster")
const nsMonster = x => isMon(x) && !['ritual', 'fusion', 'synchro', 'token'].includes(D(x).k) && !/Cannot be Normal Summoned|must (?:first )?be Special Summoned|can only be Special Summoned/i.test(D(x).tx || '');
const isSix = x => isMon(x) && /Six Samurai/.test(D(x).n);
const isGB = x => isMon(x) && /^Gladiator Beast/.test(D(x).n);
const isKoaki = x => isMon(x) && /Koa'ki Meiru/.test(D(x).n);

/* A Trap that answers a moment with no response window in the engine (same as full-26.js): a trigger that only fires while
 the card is Set (and wasn't Set this turn). It flips the card face-up, counts as a Trap Card activation at Spell Speed 2,
 and sends the card to the GY after it resolves. */
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });

/* Control changes: the engine's takeControl() emits no event, so Trojan Blast compares who controls each monster at every
 event (cached per event). A change seen is {m, from, to}. */
function ctrlScan(g) {
  if (g.f45cs && g.f45cs.seq === g.seq) return g.f45cs.ch;
  const prev = g.f45cm || {}, now = {}, ch = [];
  for (const m of fieldMons(g)) { now[m.u] = m.ctrl; if (prev[m.u] != null && prev[m.u] !== m.ctrl) ch.push({ m, from: prev[m.u], to: m.ctrl }); }
  g.f45cm = now; g.f45cs = { seq: g.seq, ch }; return ch;
}

/* Torapart: a Synchro Monster that used it as material carries a mark (flags, so it ends when the monster is flipped face-down
 or leaves the field). When it attacks, its controller's opponent can't activate Traps until the Damage Step ends. */
function toraLock(g) {
  if (g.f45toraRule) return; g.f45toraRule = true;
  addRule(g, (g2, a) => {
    if (a.type !== 'activate' || !a.c || !isTrap(a.c) || !g2.f45tl) return false;
    const A = g2.f45tl.a; const live2 = (g2.aw && g2.aw.a === A) || (g2.battle && g2.battle.a === A);
    return !!live2 && a.p !== g2.f45tl.p;
  });
}

/* Tyler the Great Warrior: "Cannot be Special Summoned", one duel-long rule installed by the first event the card sees.
 ENGINE: no general "can't be Special Summoned" flag. */
function tylerLock(g) {
  if (g.f45tyler) return; g.f45tyler = true;
  addRule(g, (g2, a) => a.type === 'ss' && !!a.c && !!a.c.id && !!D(a.c) && D(a.c).n === 'Tyler the Great Warrior');
}

E.addScripts({
  /* ----- S ----- */
  // Tributing the Winged Beast is the cost; its Level on the field is what the Deck monster must match.
  "Swallow's Nest": { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Winged Beast' && g.p[p].deck.some(y => isMon(y) && race(y) === 'Winged Beast' && lv(y) === lv(x) && canSS(g, p, y))),
    cost: function* (g, c, p, L2) {
      const xs = monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Winged Beast' && g.p[p].deck.some(y => isMon(y) && race(y) === 'Winged Beast' && lv(y) === lv(x)));
      const [x] = yield* pick(g, p, 'Tribute which Winged Beast?', xs, 1, 1, 'cost'); if (!x) return;
      L2.data.lv = lv(x); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
    res: function* (g, c, p, L2) { if (freeM(g, p) < 0 || L2.data.lv == null) return;
      const xs = g.p[p].deck.filter(y => isMon(y) && race(y) === 'Winged Beast' && lv(y) === L2.data.lv && canSS(g, p, y));
      if (!xs.length) { shuffleDeck(g, p); return; }
      const [x] = yield* pick(g, p, `Special Summon which Level ${L2.data.lv} Winged Beast from your Deck?`, xs, 1, 1, 'good');
      if (x) ss(g, p, x, yield* posOf(g, p, x)); shuffleDeck(g, p); } }] },
  "Swiftstrike Armor": { effs: [actNoop,
    { type: 'trig', loc: 'st', tags: { ss: 1 }, label: 'Reveal the drawn Six Samurai and Special Summon it',
      on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && ev.to === 'hand' && g.phase === 'draw' && g.tp === c.ctrl && ev.c.owner === c.ctrl && isSix(ev.c),
      cond: (g, c, p, x) => freeM(g, p) >= 0 && x.ev.c.zone === 'hand' && canSS(g, p, x.ev.c),
      res: function* (g, c, p, L2) { const x = L2.ev.c; if (!onField(c) || x.zone !== 'hand' || freeM(g, p) < 0) return; log(g, `${PN(g, p)} revealed ${D(x).n}.`); ss(g, p, x, yield* posOf(g, p, x)); } }] },
  // The monster is marked in its flags: turned face-down (flags cleared) or gone, it isn't destroyed (rulings).
  'Swing of Memories': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => D(x).k === 'normal' && canSS(g, p, x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Normal Monster from your GY?', g.p[p].gy.filter(x => D(x).k === 'normal' && canSS(g, p, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && ss(g, p, t, 'atk')) { t.flags.f45swing = g.turnNo; t.flags.f45swingBy = c.u; } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the monster it summoned',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(m => m.flags.f45swing === g.turnNo && m.flags.f45swingBy === c.u),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => m.flags.f45swing === g.turnNo && m.flags.f45swingBy === c.u), { by: p }); } }] },
  // Targets 1 of 3 (or more) same-named monsters in your GY; when this card is destroyed, the monster is destroyed (a bounce doesn't).
  'Symbol of Heritage': { effs: [
    { type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && canSS(g, p, x) && g.p[p].gy.filter(y => isMon(y) && D(y).n === D(x).n).length >= 3),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which monster?', g.p[p].gy.filter(x => isMon(x) && canSS(g, p, x) && g.p[p].gy.filter(y => isMon(y) && D(y).n === D(x).n).length >= 3), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && onField(c) && ss(g, p, t, 'atk')) { equip(g, c, t); c.flags.f45soh = t.u; } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the equipped monster',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.snap && ev.snap.flags && ev.snap.flags.f45soh,
      res: function* (g, c, p, L2) { const t = fieldMons(g).find(x => x.u === L2.ev.snap.flags.f45soh); if (t) destroy(g, [t], { by: p }); } }] },
  'Synchronized Realm': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Inflict 500 damage',
      on: (g, ev, c) => ev.type === 'summon' && ev.how === 'synchro' && ev.p === c.ctrl,
      res: function* (g, c, p) { if (onField(c)) damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  'Synthesis Spell': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => canRitual(g, p, { monster: x => named(x, 'Lycanthrope') }),
    res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, 'Lycanthrope') }); } }] },
  // PARTIAL: no "resolved" event, so a Counter Trap that is sent to the GY after its chain link (not destroyed) counts, even if
  // it was negated without being destroyed. The Token comes once the chain is over, not mid-chain.
  'Synthetic Seraphim': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, tags: { ss: 1 }, label: 'Special Summon a Synthetic Seraphim Token',
      on: (g, ev, c) => ev.type === 'move' && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && isTrap(ev.c) && D(ev.c).sub === 'Counter' && ev.c !== c,
      cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { if (onField(c)) tokens(g, p, { n: 'Synthetic Seraphim Token', a: 'LIGHT', r: 'Fairy', lv: 1, atk: 300, def: 300 }, 1, 'def'); } }] },

  /* ----- T ----- */
  'T.A.D.P.O.L.E.': { effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Add T.A.D.P.O.L.E.s from your Deck',
    on: (g, ev, c) => battleToGY(ev, c) && ev.prevCtrl === c.owner,
    cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'T.A.D.P.O.L.E.')) && !forbid(g, { type: 'search', p }),
    res: function* (g, c, p) { const xs = g.p[p].deck.filter(x => named(x, 'T.A.D.P.O.L.E.')); if (!xs.length || forbid(g, { type: 'search', p })) return;
      const ys = yield* pick(g, p, 'Add how many T.A.D.P.O.L.E.s to your hand?', xs, 1, xs.length, 'good');
      for (const y of ys) move(g, y, 'hand', { reason: 'effect', by: p });
      if (ys.length) log(g, `${PN(g, p)} added ${ys.length} T.A.D.P.O.L.E.${ys.length > 1 ? 's' : ''} from the Deck to the hand.`); shuffleDeck(g, p); } }] },
  // The Dinosaur is the target; the opponent's monsters are chosen at resolution.
  'Tail Swipe': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Dinosaur' && lv(x) >= 5),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Level 5 or higher Dinosaur?', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Dinosaur' && lv(x) >= 5), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || race(t) !== 'Dinosaur') return;
      const xs = monsOf(g, opp(p)).filter(x => x.pos === 'set' || lv(x) < lv(t)); if (!xs.length) return;
      const ys = yield* pick(g, p, 'Return up to 2 monsters to the hand', xs, 1, 2, 'bad');
      for (const y of ys) move(g, y, 'hand', { reason: 'effect', by: p });
      if (ys.length) log(g, `${ys.map(D).map(d => d.n).join(', ')} returned to the hand.`); } }] },
  // ENGINE: no hook for LP costs, so "You don't have to pay LP to activate its effect(s)" does nothing.
  // PARTIAL: only the return to the hand works.
  'Telekinetic Charging Cell': { effs: [
    equipAct(m => race(m) === 'Psychic', 'Equip to which face-up Psychic monster?', (g, c, t) => { c.f45eq = t.u; }),
    { type: 'trig', loc: 'gy', when: true, label: 'Pay 1000 LP: return it to the hand',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'st' && ev.to === 'gy' && !!c.f45eq && g.events.some(e => e.type === 'move' && e.group === ev.group && e.c && e.c.u === c.f45eq && e.destroyed),
      cond: (g, c, p) => g.p[p].lp > 1000 && c.zone === 'gy',
      cost: function* (g, c, p) { pay(g, p, 1000); },
      res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} returned Telekinetic Charging Cell to the hand.`); } } }] },
  // Not a chain link (ruling). PARTIAL: the choice is automatic: it saves its controller's face-up Psychic monsters while the
  // LP allow; when several Psychics are destroyed at once only the first is saved, and it can save a Psychic destroyed
  // together with itself.
  'Telekinetic Shocker': { cont: { replaceDestroy: (g, src, c, o) => {
    if (c === src || !onField(src) || src.zone !== 'm' || !faceUp(src) || negd(g, src)) return false;
    if (!isMon(c) || c.zone !== 'm' || !faceUp(c) || race(c) !== 'Psychic' || c.ctrl !== src.ctrl || g.p[src.ctrl].lp <= 500) return false;
    pay(g, src.ctrl, 500); log(g, `Telekinetic Shocker was destroyed instead of ${name(c)}.`);
    move(g, src, 'gy', { reason: 'effect', destroyed: true, by: src.ctrl }); return true; } } },
  'Telepathic Power': { effs: [trapTrig({ label: 'Destroy the attacker and gain LP', tags: { destroy: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.prevCtrl === c.ctrl && !!ev.snap && ev.snap.race === 'Psychic' && !!ev.killer && !!g.battle && ev.killer === g.battle.a && ev.killer.ctrl !== c.ctrl,
    cond: (g, c, p, x) => !!x.ev && !!x.ev.killer && onField(x.ev.killer),
    target: function* (g, c, p, L2) { L2.t = [L2.ev.killer]; },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; const a = faceUp(t) ? stat(g, t, 'atk') : 0; if (destroy(g, [t], { by: p, src: c }).length) gain(g, p, a); } })] },
  // Paying 800 is the cost. Once per turn.
  'Teleport': { effs: [actNoop,
    { type: 'ign', loc: 'st', opt: true, tags: { ss: 1 }, label: 'Pay 800: Special Summon a Psychic',
      cond: (g, c, p) => freeM(g, p) >= 0 && monsOf(g, p).length === 0 && monsOf(g, opp(p)).length > 0 && g.p[p].lp > 800 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Psychic' && canSS(g, p, x)),
      cost: function* (g, c, p) { pay(g, p, 800); },
      res: function* (g, c, p) { if (freeM(g, p) < 0) return; const xs = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Psychic' && canSS(g, p, x)); if (!xs.length) return;
        const [x] = yield* pick(g, p, 'Special Summon which Psychic from your hand?', xs, 1, 1, 'good'); if (x) ss(g, p, x, yield* posOf(g, p, x)); } }] },
  // Monsters that came from the GY are marked on the card object (kept through a face-down flip, cleared when they leave).
  'Temple of the Sun': { cont: { atk: (g, src, m) => m.ctrl === src.ctrl && m.f45gy ? 300 : 0 },
    effs: [actNoop, watch((g, ev) => { if (ev.type !== 'move' || !ev.c) return; if (ev.from === 'gy' && ev.to === 'm') ev.c.f45gy = true; else if (ev.wasField && ev.to !== 'm') ev.c.f45gy = false; })] },
  // ENGINE: "unaffected by Traps" covers destruction only.
  'Tenkabito Shien': { self: { unaffectedTraps: true } },
  // ENGINE: no forced attacks and no per-target attack limits. PARTIAL: their Level 4 or lower monsters aren't made to attack;
  // when one declares an attack on anything but your face-up Terra Firma, the attack is negated (once per monster the
  // attack is given back, so it can attack Terra Firma instead).
  'Terra Firma Gravity': { effs: [
    { type: 'act', cond: (g, c, p) => g.phase === 'battle' && g.tp !== p && monsOf(g, p).some(x => faceUp(x) && named(x, 'Elemental HERO Terra Firma')),
      res: function* (g, c, p) { g.f45tfg = { p, turn: g.turnNo }; log(g, `${PN(g, opp(p))}'s Level 4 or lower monsters can only attack Elemental HERO Terra Firma this turn.`); } },
    watch((g, ev) => {
      if (ev.type !== 'attack' || !g.f45tfg || g.f45tfg.turn !== g.turnNo || g.f45tfgSeq === ev.seq || ev.p === g.f45tfg.p || lv(ev.a) > 4) return;
      const tf = monsOf(g, g.f45tfg.p).filter(x => faceUp(x) && named(x, 'Elemental HERO Terra Firma')); if (!tf.length || tf.includes(ev.t)) return;
      g.f45tfgSeq = ev.seq; g.attackNegated = true;
      if (ev.a.flags.f45tfg !== g.turnNo) { ev.a.flags.f45tfg = g.turnNo; ev.a.attacks = Math.max(0, ev.a.attacks - 1); }
      log(g, `${name(ev.a)} must attack Elemental HERO Terra Firma.`); })] },
  // Chained directly to the opponent's Spell Card activation (Chain Link 2 only); paying 1000 is the cost.
  'Terrible Deal': { effs: [{ type: 'act',
    cond: (g, c, p, x) => !!x.top && g.chain.length === 1 && x.top.p !== p && spellTrapAct(x.top) && isSpell(x.top.c) && g.p[p].lp > 1000 && g.p[opp(p)].hand.length > 0,
    cost: function* (g, c, p) { pay(g, p, 1000); },
    res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)];
      move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, opp(p))} discarded ${D(x).n} at random.`); } }] },
  'Test Ape': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon a Gladiator Beast from your Deck',
    on: (g, ev, c) => battleToGY(ev, c),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isGB(x) && lv(x) <= 4 && canSS(g, p, x)),
    res: function* (g, c, p) { if (freeM(g, p) < 0) return; const xs = g.p[p].deck.filter(x => isGB(x) && lv(x) <= 4 && canSS(g, p, x)); if (!xs.length) return;
      const [x] = yield* pick(g, p, 'Special Summon which Gladiator Beast?', xs, 1, 1, 'good'); if (x) ss(g, p, x, yield* posOf(g, p, x)); shuffleDeck(g, p); } }] },
  'Tethys, Goddess of Light': { effs: [{ type: 'trig', when: true, ds: true, label: 'Reveal the drawn Fairy: draw 1 card',
    on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && ev.to === 'hand' && ev.c.owner === c.ctrl && isMon(ev.c) && race(ev.c) === 'Fairy',
    cond: (g, c, p, x) => g.p[p].deck.length > 0 && x.ev.c.zone === 'hand',
    res: function* (g, c, p, L2) { if (L2.ev && L2.ev.c) log(g, `${PN(g, p)} revealed ${D(L2.ev.c).n}.`); draw(g, p, 1); } }] },
  // The ATK/DEF loss is a chain link after damage calculation and lasts while that monster stays face-up.
  'Thorn of Malice': {
    cont: { atk: (g, src, m) => src.equipTo === m.u ? 600 : 0,
      grant: (g, src, m, flag) => {
        if (!src.equipTo) return false;
        if (flag === 'piercing') return src.equipTo === m.u;
        if (flag === 'noBattleDestroy' && g.battle && m.ctrl !== src.ctrl) { const e = eqOf(g, src); return !!e && ((g.battle.a === e && g.battle.t === m) || (g.battle.t === e && g.battle.a === m)); }
        return false; } },
    effs: [equipAct(m => named(m, 'Black Rose Dragon') || race(m) === 'Plant', 'Equip to Black Rose Dragon or a Plant'),
      { type: 'trig', loc: 'st', mand: true, label: 'The attacked monster loses 600 ATK and DEF',
        on: (g, ev, c) => ev.type === 'afterCalc' && !!ev.t && !!c.equipTo && ev.a.u === c.equipTo,
        res: function* (g, c, p, L2) { const t = L2.ev.t; if (t && onField(t) && faceUp(t)) { addMod(g, t, { atk: -600, def: -600 }); log(g, `${name(t)} lost 600 ATK and DEF.`); } } }] },
  'Tiger Dragon': { effs: [{ type: 'trig', when: true, tags: { destroy: 1 }, label: 'Destroy up to 2 Set Spells/Traps',
    on: (g, ev, c) => evSummoned(ev, c, ['tribute']) && (ev.tribs || []).some(x => isMon(x) && race(x) === 'Dragon'),
    cond: (g, c, p) => stOf(g, opp(p)).some(x => x.pos === 'set'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy up to 2 Set cards', stOf(g, opp(p)).filter(x => x.pos === 'set'), 1, 2, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2).filter(x => x.pos === 'set'), { by: p }); } }] },
  // Only if it was Tribute Summoned (not Tribute Set): marked in its flags on the summon.
  'Tongue Twister': { effs: [
    watch((g, ev, c) => { if (evSummoned(ev, c, ['tribute'])) c.flags.f45tt = true; }),
    { type: 'trig', loc: 'gy', mand: true, label: 'Draw 2 cards and banish it',
      on: (g, ev, c) => fromFieldToGY(ev, c) && !!ev.snap && !!ev.snap.flags && !!ev.snap.flags.f45tt,
      res: function* (g, c, p) { draw(g, p, 2); if (c.zone === 'gy') { move(g, c, 'ban', { reason: 'effect', by: p }); log(g, 'Tongue Twister was banished.'); } } }] },
  // The material limit is a Summon rule (as batch-1's synLegal): a non-Warrior Synchro whose every material combo needs
  // Torapart can't be Synchro Summoned. PARTIAL: when other combos exist, the engine's combo list may still offer one with it.
  'Torapart': { cont: { forbid: (g, src, a) => a.type === 'ss' && a.how === 'synchro' && !!a.c && a.c.zone === 'extra' && a.p === src.ctrl && src.zone === 'm' && faceUp(src)
      && race(a.c) !== 'Warrior' && (() => { const cs = synCombos(g, a.p, a.c); return cs.length > 0 && cs.every(m => m.includes(src)); })() },
    effs: [watch((g, ev, c) => {
    if (!g.f45toraRule) toraLock(g);
    if (ev.type === 'summon' && ev.how === 'synchro' && g.events.some(e => e.type === 'move' && e.c === c && e.reason === 'synchro' && e.group === ev.group)) for (const x of ev.cs) if (x) x.flags.f45tora = true;
    if (ev.type === 'attack' && ev.a && ev.a.flags.f45tora && c.zone === 'gy' && g.events.some(e => e.type === 'move' && e.c === c && e.reason === 'synchro')) g.f45tl = { a: ev.a, p: ev.p };
  })] },
  // The change to Defense Position is no chain link (ruling). ENGINE: monsters can't attack from Defense Position, so its
  // "can attack while in Defense Position" isn't there.
  'Total Defense Shogun': { effs: [watch((g, ev, c) => {
    if (evSummoned(ev, c, ['normal', 'tribute', 'flip']) && onField(c) && c.pos === 'atk') { c.pos = 'def'; g.seq++; log(g, 'Total Defense Shogun was changed to Defense Position.'); } })] },
  // PARTIAL: as 2 Tributes for a Dragon, any 1 monster can be Tributed while Totem Dragon is face-up (same hook as Kaiser Sea Horse).
  'Totem Dragon': { cont: { tributes: (g, s, c, p, need) => need === 2 && s.ctrl === p && c !== s && isMon(c) && race(c) === 'Dragon' ? 1 : null },
    effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon it from the GY',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner,
      cond: (g, c, p) => c.zone === 'gy' && freeM(g, p) >= 0 && monsOf(g, p).length === 0 && g.p[p].gy.filter(isMon).every(x => race(x) === 'Dragon') && canSS(g, p, c),
      res: function* (g, c, p) { if (c.zone === 'gy' && monsOf(g, p).length === 0) ss(g, p, c, 'atk', { banishOnLeave: true }); } }] },
  // ENGINE: Flip Summons aren't a forbid action, so only Normal Summons are stopped.
  'Tour of Doom': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Toss a coin',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; const o = opp(p);
        if (coin(g, p)) { const T = g.turnNo; addRule(g, (g2, a) => a.type === 'ns' && a.p === o && g2.turnNo === T, { end: T }); log(g, `${PN(g, o)} can't Normal Summon this turn.`); }
        else { const T = g.turnNo + 1; addRule(g, (g2, a) => a.type === 'ns' && a.p === p && g2.turnNo === T, { end: T }); log(g, `${PN(g, p)} can't Normal Summon during their next turn.`); } } }] },
  // PARTIAL: Setting it in the Spell & Trap Zone is offered as an effect of the card in the hand (it opens a chain link).
  'Toy Magician': { effs: [
    { type: 'ign', loc: 'hand', label: 'Set it in the Spell & Trap Zone', cond: (g, c, p) => freeST(g, p) >= 0 && !forbid(g, { type: 'setST', c, p }),
      cost: function* (g, c, p) { move(g, c, 'st', { ctrl: p, pos: 'set', reason: 'set' }); log(g, `${PN(g, p)} Set a card.`); }, res: noop },
    watch((g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.from === 'st' && ev.to === 'gy' && ev.destroyed && !ev.battle && byOpp(g, ev, c)) c.f45toy = g.turnNo; }),
    { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon it',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.f45toy === g.turnNo,
      cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { c.f45toy = null; if (c.zone === 'gy') ss(g, p, c, 'atk'); } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy Spells and Traps',
      on: (g, ev, c) => evSummoned(ev, c, ['flip']),
      cond: g => stOnField(g).length > 0,
      res: function* (g, c, p) { const n = fieldMons(g).filter(x => faceUp(x) && named(x, 'Toy Magician')).length; const xs = stOnField(g); if (!n || !xs.length) return;
        const k = Math.min(n, xs.length); const ys = yield* pick(g, p, `Destroy ${k} Spell/Trap Card${k > 1 ? 's' : ''}`, xs, k, k, 'bad'); destroy(g, ys, { by: p }); } }] },
  // Sending the Winged Kuriboh and 2 cards is the cost; the card can be activated with no LV10 left (ruling).
  'Transcendent Wings': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => named(x, 'Winged Kuriboh')) && g.p[p].hand.filter(x => x !== c).length >= 2,
    cost: function* (g, c, p) {
      const [k] = yield* pick(g, p, 'Send which Winged Kuriboh?', monsOf(g, p).filter(x => named(x, 'Winged Kuriboh')), 1, 1, 'cost');
      const hs = yield* pick(g, p, 'Send 2 cards from your hand to the GY', g.p[p].hand.filter(x => x !== c), 2, 2, 'cost');
      const grp = g.group; if (k) move(g, k, 'gy', { reason: 'cost', by: p, group: grp }); for (const x of hs) move(g, x, 'gy', { reason: 'cost', by: p, group: grp });
      log(g, `${PN(g, p)} sent Winged Kuriboh and ${hs.map(x => D(x).n).join(', ')} to the GY.`); },
    res: function* (g, c, p) { if (freeM(g, p) < 0) return; const xs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Winged Kuriboh LV10'));
      if (!xs.length) { log(g, 'No Winged Kuriboh LV10 to Special Summon.'); shuffleDeck(g, p); return; }
      const [x] = yield* pick(g, p, 'Special Summon Winged Kuriboh LV10', xs, 1, 1, 'good'); if (x) ss(g, p, x, yield* posOf(g, p, x)); shuffleDeck(g, p); } }] },
  // ENGINE: no "banish instead" hook in move(). PARTIAL: a card sent from the GY to the Deck is banished right after it
  // arrives; Pot of Avarice and the like can still be activated.
  'Transmigration Break': { effs: [actNoop, { type: 'trig', loc: 'st', res: noop,
    on: (g, ev, c) => { if (ev.type === 'move' && ev.from === 'gy' && ['deck', 'deckTop', 'extra'].includes(ev.to) && !negd(g, c) && ['deck', 'extra'].includes(ev.c.zone)) { move(g, ev.c, 'ban', { reason: 'effect' }); log(g, `${D(ev.c).n} was banished instead (Transmigration Break).`); } return false; } }] },
  // Activated in response to an effect that returns this Set card to the hand: one that targets it and says "hand",
  // or one that bounces every Spell/Trap. PARTIAL: read from the card text of the chain link it answers.
  'Treasure Map': { effs: [{ type: 'act',
    cond: (g, c, p, x) => !!x.top && g.p[p].deck.length >= 2 && (() => { const tx = D(x.top.c).tx || '';
      return (x.top.t || []).includes(c) && /hand/i.test(tx) || /Spell (?:and|&) Trap Cards? on the field to (?:the|their owners'?) hands?|Giant Trunade/i.test(tx + D(x.top.c).n); })(),
    res: function* (g, c, p) { draw(g, p, 2); if (!g.p[p].hand.length) return; const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand, 1, 1, 'cost');
      if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${D(x).n}.`); } } }] },
  'Tree Otter': { effs: [{ type: 'ign', opt: true, label: '+1000 ATK',
    cond: (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x) && race(x) === 'Beast'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster gains 1000 ATK?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { if (!monsOf(g, p).some(x => x !== c && faceUp(x) && race(x) === 'Beast')) return; const t = live(L2)[0];
      if (t && faceUp(t)) { addMod(g, t, { atk: 1000, end: true }); log(g, `${name(t)} gained 1000 ATK.`); } } }] },
  // Sending Blaze Accelerator is the activation cost; sending the Pyro is part of the effect (rulings), not once per turn.
  'Tri-Blaze Accelerator': { effs: [
    { type: 'act', cond: (g, c, p) => monsOf(g, p).length >= 0 && stOf(g, p).some(x => x !== c && faceUp(x) && named(x, 'Blaze Accelerator')),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Blaze Accelerator to the GY?', stOf(g, p).filter(x => x !== c && faceUp(x) && named(x, 'Blaze Accelerator')), 1, 1, 'cost');
        if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent Blaze Accelerator to the GY.`); } },
      res: noop },
    { type: 'ign', loc: 'st', tags: { destroy: 1 }, label: 'Send a Pyro: destroy a monster',
      cond: (g, c, p) => g.p[p].hand.some(x => isMon(x) && race(x) === 'Pyro') && monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const xs = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Pyro'); if (!xs.length) return;
        const [x] = yield* pick(g, p, 'Send which Pyro from your hand to the GY?', xs, 1, 1, 'cost'); if (!x) return;
        move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`);
        const T = g.turnNo; addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.ctrl === p && g2.turnNo === T, { end: T });
        const t = live(L2)[0]; if (t) destroy(g, [t], { by: p, src: c }); damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  // The equipped monster must have destroyed a Level 5 or higher monster by battle this turn (marked when it happens).
  'Trial of the Princesses': {
    cont: { atk: (g, src, m) => src.equipTo === m.u ? 800 : 0 },
    effs: [equipAct(m => named(m, 'White Magician Pikeru') || named(m, 'Ebon Magician Curran'), 'Equip to White Magician Pikeru or Ebon Magician Curran'),
      watch((g, ev, c) => { if (ev.type === 'move' && ev.battle && ev.destroyed && ev.killer && c.equipTo && ev.killer.u === c.equipTo && ev.snap && ev.snap.lv >= 5) ev.killer.flags.f45trial = g.turnNo; }),
      { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Tribute both: Special Summon a Princess',
        cond: (g, c, p) => { const m = eqOf(g, c); if (!m || m.ctrl !== p || m.flags.f45trial !== g.turnNo) return false; const pn = named(m, 'White Magician Pikeru') ? 'Princess Pikeru' : 'Princess Curran';
          return [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, pn)); },
        cost: function* (g, c, p, L2) { const m = eqOf(g, c); L2.data.pn = named(m, 'White Magician Pikeru') ? 'Princess Pikeru' : 'Princess Curran';
          move(g, c, 'gy', { reason: 'cost', by: p }); if (onField(m)) move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(m).n} and Trial of the Princesses.`); },
        res: function* (g, c, p, L2) { if (freeM(g, p) < 0) return; const xs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, L2.data.pn)); if (!xs.length) return;
          const [x] = yield* pick(g, p, `Special Summon ${L2.data.pn}`, xs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  'Tricky Spell 4': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && named(x, 'The Tricky')) && monsOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which The Tricky to the GY?', monsOf(g, p).filter(x => faceUp(x) && named(x, 'The Tricky')), 1, 1, 'cost');
      if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent The Tricky to the GY.`); } },
    res: function* (g, c, p) { const n = Math.min(monsOf(g, opp(p)).length, nFreeM(g, p)); if (!n) return;
      for (const t of tokens(g, p, { n: 'Tricky Token', a: 'WIND', r: 'Spellcaster', lv: 5, atk: 2000, def: 1200 }, n, 'def')) t.flags.cantAttack = true; } }] },
  'Tricular': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon Bicular',
    on: (g, ev, c) => battleToGY(ev, c),
    cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Bicular') && canSS(g, p, x)),
    res: function* (g, c, p) { if (freeM(g, p) < 0) return; const xs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Bicular') && canSS(g, p, x)); if (!xs.length) return;
      const [x] = yield* pick(g, p, 'Special Summon Bicular', xs, 1, 1, 'good'); if (x) ss(g, p, x, yield* posOf(g, p, x)); shuffleDeck(g, p); } }] },
  // The turn player Summons first; each player may decline (rulings).
  'Triggered Summon': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => !!g.sw && ['special', 'synchro', 'fusion', 'ritual'].includes(g.sw.how) && g.sw.cs.some(x => onField(x) && x.ctrl === opp(p)) && (freeM(g, p) >= 0 || freeM(g, opp(p)) >= 0),
    res: function* (g, c, p) {
      for (const q of [g.tp, opp(g.tp)]) {
        if (freeM(g, q) < 0) continue; const xs = g.p[q].hand.filter(x => isMon(x) && lv(x) <= 4 && nsMonster(x) && canSS(g, q, x)); if (!xs.length) continue;
        if (!(yield* yn(g, q, 'Special Summon a Level 4 or lower monster from your hand? (Triggered Summon)'))) continue;
        const [x] = yield* pick(g, q, 'Special Summon which monster?', xs, 1, 1, 'good'); if (x) ss(g, q, x, yield* posOf(g, q, x)); } } }] },
  // Not targeting: the monster is chosen at resolution. A face-down one deals no damage (ruling).
  'Trojan Blast': { effs: [watch(g => { ctrlScan(g); }),
    trapTrig({ label: 'Destroy the monster that changed control', tags: { destroy: 1 },
      on: (g, ev, c) => { const ch = ctrlScan(g).filter(e => e.from === c.ctrl && e.to === opp(c.ctrl) && e.m.owner === c.ctrl); if (!ch.length) return false; c.f45tb = ch.map(e => e.m.u); return true; },
      cond: (g, c, p) => fieldMons(g).some(m => (c.f45tb || []).includes(m.u) && m.ctrl === opp(p)),
      res: function* (g, c, p) { const xs = fieldMons(g).filter(m => (c.f45tb || []).includes(m.u) && m.ctrl === opp(p)); if (!xs.length) return;
        const [t] = yield* pick(g, p, 'Destroy which monster?', xs, 1, 1, 'bad'); if (!t) return;
        const a = faceUp(t) ? stat(g, t, 'atk') : 0; if (destroy(g, [t], { by: p, src: c }).length && a) damage(g, opp(p), a, { src: c, srcP: p }); } })] },
  'Trojan Gladiator Beast': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, opp(p)) >= 0 && g.p[p].hand.some(x => isGB(x) && canSS(g, opp(p), x)),
    res: function* (g, c, p) { const o = opp(p); const xs = g.p[p].hand.filter(x => isGB(x) && canSS(g, o, x));
      if (xs.length && freeM(g, o) >= 0) { const [x] = yield* pick(g, p, "Special Summon which Gladiator Beast to your opponent's side?", xs, 1, 1, 'cost'); if (x) ss(g, o, x, yield* posOf(g, p, x)); }
      draw(g, p, 1); } }] },
  // The destroyed monster becomes an Equip Card (its own effects don't apply there). Its original ATK is added.
  'Truckroid': {
    self: { atk: (g, c) => stOf(g, c.ctrl).filter(x => x.equipTo === c.u && x.flags.f45truck).reduce((s, x) => s + baseAtk(x), 0) },
    effs: [{ type: 'trig', mand: true, label: 'Equip the destroyed monster',
      on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
      cond: (g, c, p, x) => x.ev.c.zone === 'gy' && onField(c) && faceUp(c),
      res: function* (g, c, p, L2) { const t = L2.ev.c; if (t.zone !== 'gy' || !onField(c) || !faceUp(c) || freeST(g, p) < 0) return;
        move(g, t, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); t.equipTo = c.u; t.flags.f45truck = true; t.flags.negated = true; g.seq++;
        log(g, `${D(t).n} was equipped to Truckroid.`); } }] },
  // ① The monsters its owner controls are noted at the first event of the opponent's Battle Phase (no "start of the Battle
  // Phase" event); each one destroyed by battle and sent to the GY is noted. ② and ③ as written.
  // PARTIAL: a monster summoned before the opponent's first action in that Battle Phase counts as there at its start.
  'Tualatin': {
    cont: { forbid: (g, src, a) => !!src.flags.f45attr && ['ns', 'ss'].includes(a.type) && a.p !== src.ctrl && !!a.c && !!D(a.c) && attr(a.c) === src.flags.f45attr && !negd(g, src) },
    effs: [watch((g, ev, c) => {
      if (g.phase !== 'battle' || g.tp === c.owner) return;
      if (!c.f45tua || c.f45tua.turn !== g.turnNo) c.f45tua = { turn: g.turnNo, us: monsOf(g, c.owner).map(x => x.u), dead: [] };
      if (ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && c.f45tua.us.includes(ev.c.u)) c.f45tua.dead.push(ev.c.u); }),
      { type: 'trig', loc: 'hand', tags: { ss: 1 }, label: 'Special Summon it from your hand',
        on: (g, ev, c) => { const r = c.f45tua; return ev.type === 'dsEnd' && g.tp !== c.owner && !!r && r.turn === g.turnNo && r.us.length >= 2 && r.us.every(u => r.dead.includes(u)) && [ev.a, ev.t].some(x => x && r.dead.includes(x.u)); },
        cond: (g, c, p) => c.zone === 'hand' && freeM(g, p) >= 0 && canSS(g, p, c),
        res: function* (g, c, p) { if (c.zone !== 'hand' || freeM(g, p) < 0) return; c.f45tuaSS = true; if (!ss(g, p, c, yield* posOf(g, p, c))) c.f45tuaSS = false; } },
      { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Choose an Attribute: destroy those monsters',
        on: (g, ev, c) => evSummoned(ev, c) && !!c.f45tuaSS,
        res: function* (g, c, p) { c.f45tuaSS = false; const i = yield* choose(g, p, 'Choose an Attribute', ATTRS); const a = ATTRS[i];
          log(g, `${PN(g, p)} chose ${a}.`); if (onField(c) && faceUp(c)) c.flags.f45attr = a;
          destroy(g, fieldMons(g).filter(x => faceUp(x) && attr(x) === a), { by: p }); } }] },
  // Targets a Tuner sent to the opponent's GY for that Synchro Summon.
  'Tuner Capture': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => !!g.sw && g.sw.how === 'synchro' && g.sw.p !== p && freeM(g, p) >= 0 && tunerMats(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Tuner?', tunerMats(g, p), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, t, 'atk'); } }] },
  // The monster is chosen at resolution; its protection lasts through the End Phase of the next turn (flags, so it ends if it
  // leaves the field or is turned face-down).
  "Tuner's Barrier": { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && D(x).tu),
    res: function* (g, c, p) { const xs = monsOf(g, p).filter(x => faceUp(x) && D(x).tu); if (!xs.length) return;
      const [t] = yield* pick(g, p, 'Protect which Tuner?', xs, 1, 1, 'good'); if (!t) return; const until = g.turnNo + 1;
      for (const f of ['noBattleDestroy', 'noEffectDestroy']) Object.defineProperty(t.flags, f, { get: () => g.turnNo <= until, enumerable: true, configurable: true });
      log(g, `${name(t)} can't be destroyed by battle or card effects until the end of the next turn.`); } }] },
  // Takes control for good; a destroyed monster is banished, and this card is destroyed when the monster leaves the field.
  "Tuner's Scheme": { effs: [
    { type: 'act', cond: (g, c, p) => !!g.sw && g.sw.cs.some(x => onField(x) && x.ctrl === opp(p) && D(x).k === 'synchro') && freeM(g, p) >= 0,
      target: function* (g, c, p, L2) { L2.t = g.sw.cs.filter(x => onField(x) && x.ctrl === opp(p) && D(x).k === 'synchro').slice(0, 1); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !onField(c) || t.ctrl === p) return; if (takeControl(g, p, t, false)) { g.seq++; c.f45sch = t.u; } } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy this card',
      on: (g, ev, c) => {
        if (ev.type === 'move' && c.f45sch && ev.c.u === c.f45sch && ev.wasField) {
          if (ev.destroyed && ev.to === 'gy' && ev.c.zone === 'gy') { move(g, ev.c, 'ban', { reason: 'effect', by: c.ctrl }); log(g, `${D(ev.c).n} was banished.`); }
          return true; }
        return false; },
      res: function* (g, c, p) { c.f45sch = null; if (onField(c)) destroy(g, [c], { by: p }); } }] },
  // ENGINE: synCombos reads lv() only, so "treated as a Level 2 monster for a Synchro Summon" isn't there.
  'Tuningware': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Draw 1 card',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.reason === 'synchro' && ev.to === 'gy',
    res: function* (g, c, p) { draw(g, p, 1); } }] },
  // Tributing a Warrior (face-down or a Token too) Special Summons it with the Warrior's original ATK added.
  'Turret Warrior': {
    self: { atk: (g, c) => c.flags.f45tur || 0 },
    proc: { label: 'Special Summon (Tribute a Warrior)', cond: (g, c, p) => monsOf(g, p).some(x => race(x) === 'Warrior' && !x.flags.noTribute),
      cost: function* (g, c, p, grp) { const [t] = yield* pick(g, p, 'Tribute which Warrior?', monsOf(g, p).filter(x => race(x) === 'Warrior' && !x.flags.noTribute), 1, 1, 'cost'); if (!t) return;
        const a = t.flags.tokAtk != null ? t.flags.tokAtk : num(D(t).atk); move(g, t, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${D(t).n}.`); c.flags.f45tur = a; } } },
  'Twilight Rose Knight': {
    cont: { grant: (g, src, m, flag) => flag === 'noAttackTarget' && m.zone === 'm' && m.ctrl === src.ctrl && faceUp(m) && race(m) === 'Plant' && !negd(g, src),
      forbid: (g, src, a) => !negd(g, src) && attackLock(g, src, a) },
    effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon a Level 4 or lower Plant',
      on: (g, ev, c) => evSummoned(ev, c, ['normal']),
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Plant' && lv(x) <= 4 && canSS(g, p, x)),
      res: function* (g, c, p) { if (freeM(g, p) < 0) return; const xs = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Plant' && lv(x) <= 4 && canSS(g, p, x)); if (!xs.length) return;
        const [x] = yield* pick(g, p, 'Special Summon which Plant from your hand?', xs, 1, 1, 'good'); if (x) ss(g, p, x, yield* posOf(g, p, x)); } }] },
  'Tyler the Great Warrior': { effs: [watch(g => { tylerLock(g); }),
    { type: 'trig', mand: true, label: "Inflict the destroyed monster's ATK as damage",
      on: (g, ev, c) => battleKill(ev, c),
      res: function* (g, c, p, L2) { const n = (L2.ev.snap && L2.ev.snap.atk) || 0; if (n) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  'Tyranno Infinity': { self: { atk: (g, c) => 1000 * g.p[c.ctrl].ban.filter(x => isMon(x) && race(x) === 'Dinosaur').length } },

  /* ----- U ----- */
  'UFOroid': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon a Machine with 1500 or less ATK',
    on: (g, ev, c) => battleToGY(ev, c),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && race(x) === 'Machine' && baseAtk(x) <= 1500 && canSS(g, p, x)),
    res: function* (g, c, p) { if (freeM(g, p) < 0) return; const xs = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Machine' && baseAtk(x) <= 1500 && canSS(g, p, x)); if (!xs.length) return;
      const [x] = yield* pick(g, p, 'Special Summon which Machine?', xs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  // ATK/DEF = the 2 Fusion Materials' original ATK, set when it is Fusion Summoned (0 when summoned another way, ruling).
  'UFOroid Fighter': { mats: [x => D(x).n === 'UFOroid' || name(x) === 'UFOroid', x => race(x) === 'Warrior'],
    self: { atk: (g, c) => c.flags.f45ufo || 0, def: (g, c) => c.flags.f45ufo || 0 },
    effs: [watch((g, ev, c) => {
      if (!evSummoned(ev, c, ['fusion'])) return;
      const ms = g.events.filter(e => e.type === 'move' && e.group === ev.group && e.reason === 'fusion' && e.c !== c).map(e => e.c);
      const n = ms.reduce((s, x) => s + (x.flags && x.flags.tokAtk != null ? x.flags.tokAtk : num(D(x).atk)), 0);
      c.flags.f45ufo = n; g.seq++; log(g, `UFOroid Fighter's ATK and DEF became ${n}.`); })] },
  'Umbral Soul': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy face-down and non-DARK monsters',
    on: (g, ev, c) => battleToGY(ev, c),
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.pos === 'set' || attr(x) !== 'DARK'), { by: p }); } }] },
  // The ATK counts only during this Battle Phase; the opponent takes no battle damage this turn (no other monster can attack).
  'Union Attack': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster gains the ATK?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return;
      const n = monsOf(g, p).filter(x => x !== t && x.pos === 'atk').reduce((s, x) => s + stat(g, x, 'atk'), 0); const T = g.turnNo;
      t.mods.push({ get atk() { return g.phase === 'battle' && g.turnNo === T ? n : 0; }, end: true, turn: T });
      g.p[opp(p)].noBattleDamage = T;
      addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.ctrl === p && a.c !== t && g2.turnNo === T, { end: T });
      log(g, `${name(t)} gains ${n} ATK during this Battle Phase. Other monsters can't attack.`); } }] },
  'Unity': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).length > 0,
    res: function* (g, c, p) { const xs = monsOf(g, p).filter(faceUp); if (!xs.length) return;
      const [t] = yield* pick(g, p, 'Which monster?', xs, 1, 1, 'good'); if (!t) return;
      const n = monsOf(g, p).filter(faceUp).reduce((s, x) => s + origDef(x), 0); addMod(g, t, { set: n, which: 'def', end: true }); log(g, `${name(t)}'s DEF became ${n}.`); } }] },
  // Gemini monsters already treated as Effect Monsters are left alone (ruling).
  'Unleash Your Power!': { effs: [
    { type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isGemini(x) && !x.flags.gemini),
      target: function* (g, c, p, L2) { L2.data.us = monsOf(g, p).filter(x => faceUp(x) && isGemini(x) && !x.flags.gemini).map(x => x.u); },
      res: function* (g, c, p, L2) { for (const x of monsOf(g, p)) if (faceUp(x) && L2.data.us.includes(x.u) && !x.flags.gemini) { x.flags.gemini = true; x.flags.f45uyp = g.turnNo; x.flags.f45uypBy = c.u; log(g, `${name(x)} is treated as an Effect Monster.`); } g.seq++; } },
    { type: 'trig', loc: 'any', mand: true, label: 'Set the Gemini monsters',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(x => faceUp(x) && x.flags.f45uyp === g.turnNo && x.flags.f45uypBy === c.u),
      res: function* (g, c) { for (const x of fieldMons(g).filter(x => faceUp(x) && x.flags.f45uyp === g.turnNo && x.flags.f45uypBy === c.u)) setFaceDown(g, x); } }] },
  // PARTIAL: done as a change from the monster's original ATK, so a doubling or halving (Megamorph) isn't applied to the new value.
  'Unstable Evolution': {
    cont: { atk: (g, src, m) => { if (src.equipTo !== m.u) return 0; const a = g.p[src.ctrl].lp, b = g.p[opp(src.ctrl)].lp; return a < b ? 2400 - baseAtk(m) : a > b ? 1000 - baseAtk(m) : 0; } },
    effs: [equipAct()] },
  'Updraft': { effs: [{ type: 'act',
    cond: g => allField(g).some(x => L.ctr(x, 'fog') > 0),
    res: function* (g, c, p) { let n = 0; for (const x of allField(g)) { const k = L.ctr(x, 'fog'); if (k) { n += k; L.addCtr(g, x, 'fog', -k); } }
      g.seq++; log(g, `${n} Fog Counter${n === 1 ? ' was' : 's were'} removed.`); if (n) damage(g, opp(p), 300 * n, { src: c, srcP: p }); } }] },
  // Returning Iron Core is the cost (so not while Transmigration Break is face-up, ruling); the summon doesn't target.
  'Urgent Synthesis': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, "Iron Core of Koa'ki Meiru")) && [...g.p[p].hand, ...g.p[p].gy].some(x => isKoaki(x) && lv(x) <= 4 && canSS(g, p, x))
      && !allField(g).some(x => faceUp(x) && named(x, 'Transmigration Break') && !negd(g, x)),
    cost: function* (g, c, p) { const x = g.p[p].gy.find(y => named(y, "Iron Core of Koa'ki Meiru")); if (x) { move(g, x, 'deck', { reason: 'cost', by: p }); log(g, `${PN(g, p)} returned Iron Core of Koa'ki Meiru to the Deck.`); } },
    res: function* (g, c, p) { if (freeM(g, p) < 0) return; const xs = [...g.p[p].hand, ...g.p[p].gy].filter(x => isKoaki(x) && lv(x) <= 4 && canSS(g, p, x)); if (!xs.length) return;
      const [x] = yield* pick(g, p, "Special Summon which Koa'ki Meiru monster?", xs, 1, 1, 'good'); if (x) ss(g, p, x, yield* posOf(g, p, x)); } }] },
  // Synchro Summons at resolution with monsters you control (not in the Damage Step).
  'Urgent Tuning': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => g.phase === 'battle' && !g.inDS && synTargets(g, p).length > 0,
    res: function* (g, c, p) { const xs = synTargets(g, p); if (!xs.length) return;
      const [sx] = yield* pick(g, p, 'Synchro Summon which monster?', xs, 1, 1, 'good'); if (!sx) return;
      const cs = synCombos(g, p, sx); if (!cs.length) return; let mats = cs[0];
      if (cs.length > 1) { const i = yield* choose(g, p, `Synchro Summon ${D(sx).n} with which monsters?`, cs.map(m => m.map(name).join(' + '))); mats = cs[i]; }
      const pos = yield* posOf(g, p, sx); const grp = g.group;
      for (const m of mats) move(g, m, 'gy', { reason: 'synchro', by: p, group: grp });
      log(g, `${PN(g, p)} sent ${mats.map(m => D(m).n).join(' + ')} to the GY for a Synchro Summon.`);
      if (freeM(g, p) >= 0) ss(g, p, sx, pos, { how: 'synchro', group: grp }); } }] },
  'Valhalla, Hall of the Fallen': { effs: [actNoop,
    { type: 'ign', loc: 'st', opt: true, tags: { ss: 1 }, label: 'Special Summon a Fairy from your hand',
      cond: (g, c, p) => monsOf(g, p).length === 0 && freeM(g, p) >= 0 && g.p[p].hand.some(x => race(x) === 'Fairy' && nsMonster(x) && canSS(g, p, x)),
      res: function* (g, c, p) { if (monsOf(g, p).length) return; const xs = g.p[p].hand.filter(x => race(x) === 'Fairy' && nsMonster(x) && canSS(g, p, x)); if (!xs.length) return;
        const [x] = yield* pick(g, p, 'Special Summon which Fairy from your hand?', xs, 1, 1, 'good'); if (x) ss(g, p, x, yield* posOf(g, p, x)); } }] },
  // Paying 500 is the cost; it returns in the next turn's Standby Phase (not if it left the GY) and then gains 500 ATK.
  "Vampire's Curse": { effs: [
    { type: 'trig', loc: 'gy', when: true, label: 'Pay 500 LP: return next Standby Phase',
      on: (g, ev, c) => battleToGY(ev, c),
      cond: (g, c, p) => g.p[p].lp > 500,
      cost: function* (g, c, p) { pay(g, p, 500); },
      res: function* (g, c) { if (c.zone === 'gy') { c.f45vc = g.turnNo + 1; log(g, "Vampire's Curse will return in the next Standby Phase."); } } },
    { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon it',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && c.f45vc === g.turnNo,
      cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { c.f45vc = null; if (c.zone !== 'gy') return; c.f45vcSS = true; if (!ss(g, p, c, 'atk')) c.f45vcSS = false; } },
    { type: 'trig', mand: true, label: '+500 ATK',
      on: (g, ev, c) => evSummoned(ev, c) && !!c.f45vcSS,
      res: function* (g, c) { c.f45vcSS = false; if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500 }); log(g, "Vampire's Curse gained 500 ATK."); } } }] },
});

// Tuners sent to the opponent's GY for the Synchro Summon that is the last summon (Tuner Capture)
function tunerMats(g, p) {
  if (!g.sw) return [];
  return g.events.filter(e => e.type === 'move' && e.group === g.sw.group && e.reason === 'synchro' && e.c && e.c.zone === 'gy' && e.c.owner === opp(p) && D(e.c).tu).map(e => e.c)
    .filter((x, i, a) => a.indexOf(x) === i && canSS(g, p, x));
}
// Synchro Monsters that can be Synchro Summoned now with monsters you control (Urgent Tuning)
function synTargets(g, p) {
  if (freeM(g, p) < 0 && !monsOf(g, p).length) return [];
  return g.p[p].extra.filter(x => D(x).k === 'synchro' && !(E.SCRIPTS[D(x).n] && E.SCRIPTS[D(x).n].noSynchro) && !forbid(g, { type: 'ss', c: x, p, how: 'synchro' }) && synCombos(g, p, x).length > 0);
}
})();
