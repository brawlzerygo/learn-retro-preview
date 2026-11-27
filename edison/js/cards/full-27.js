/* Full pool batch 27: Sage's Stone to Stop Defense (build/batches/full/full-27.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings.
 Cards with a Goat-only script elsewhere (Sakuretsu Armor, Salamandra, Sanga of the Thunder, Sanwitch, Self-Destruct Button,
 Senju of the Thousand Hands, Serial Spell, Serpentine Princess, Shift, Silver Bow and Arrow, Skilled Dark Magician,
 Skilled White Magician, Slate Warrior, Smoke Grenade of the Thief, Snatch Steal, Solar Flare Dragon, Spellbinding Circle,
 St. Joan, Stealth Bird, Stone Statue of the Aztecs, Stop Defense) are ported here as the shared version; the Goat-only
 ones still win under Goat. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, takeControl, setFaceDown, negate, addMod,
  equip, negateAttack, addRule, addCtr, ctr, tokens, ritualSummon, canRitual, coin, dice, name, D, isMon, isST, isSpell, isTrap,
  isExtraD, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM,
  shuffleDeck, log, PN, has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned, emit, forbid, stat, negd, num } = L;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'atk' }); };
const toAtk = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos === 'atk') return; c.pos = 'atk'; g.seq++; log(g, `${name(c)} was changed to Attack Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'def' }); };
const over = (g, winner, why) => { g.winner = winner; g.why = why; log(g, why + '.'); throw { over: true }; };
const isSpirit = c => isMon(c) && /Spirit/.test(D(c).ab || '');
const SS_HOWS = ['special', 'fusion', 'synchro', 'ritual'];
const specialSummoned = c => D(c).k === 'token' || SS_HOWS.includes(c.summonType);

// Equip Spells: target a face-up monster that passes filter, equip it at resolution
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?', more = {}) => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { if (more.pre) yield* more.pre(g, c, p, L2); yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c) && equip(g, c, t) && more.post) more.post(g, c, p, L2, t); } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });

// Coin tosses with Second Coin Toss: once per turn (for each player, by the card's name) you may redo all of your coin flips.
// ENGINE: only the coin tosses in this file (Sand Gambler) check Second Coin Toss; the engine's own coin() has no redo hook.
function* tossCoins(g, p, n) {
  const flip = () => Array.from({ length: n }, () => coin(g, p));
  let r = flip();
  const sct = stOf(g, p).find(x => faceUp(x) && named(x, 'Second Coin Toss'));
  g.f27sct = g.f27sct || [0, 0];
  if (sct && g.f27sct[p] !== g.turnNo && (yield* yn(g, p, 'Use Second Coin Toss to redo the coin toss?'))) {
    g.f27sct[p] = g.turnNo; log(g, `${PN(g, p)} redid the coin toss with Second Coin Toss.`); r = flip(); }
  return r;
}

// Skilled Magicians: a Spell Counter as each Spell resolves (seen as a Normal or Quick-Play Spell leaves the Spell/Trap Zone
// for the GY after it resolves; a negated one is destroyed instead). No chain link.
// PARTIAL: Continuous, Equip and Field Spells stay on the field, so their counter is placed when they are activated from
// the hand (not when they resolve, and not for a Set one turned face-up).
const spellCounter3 = { type: 'trig', res: noop, on: (g, ev, c) => {
  if (ev.type !== 'move' || !isSpell(ev.c) || ctr(c, 'spell') >= 3) return false;
  const lasting = ['Continuous', 'Equip', 'Field'].includes(D(ev.c).sub);
  if ((ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && !lasting) || (ev.from === 'hand' && ev.reason === 'activate' && lasting)) {
    addCtr(g, c, 'spell', 1); g.seq++; log(g, `${name(c)} got a Spell Counter (${ctr(c, 'spell')}).`); }
  return false; } };
const skilled = (target) => ({ effs: [spellCounter3,
  { type: 'ign', tags: { ss: 1 }, label: `Tribute: summon ${target}`,
    cond: (g, c, p) => ctr(c, 'spell') >= 3 && [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].some(x => named(x, target) && canSS(g, p, x)),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(c).n}.`); },
    res: function* (g, c, p) { if (freeM(g, p) < 0) return; const cs = [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].filter(x => named(x, target) && canSS(g, p, x)); if (!cs.length) return;
      const [x] = yield* pick(g, p, `Special Summon ${target} from your hand, Deck or GY`, cs, 1, 1, 'good'); if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } } }] });

// Sanga of the Thunder (port of classic-2.js): in the opponent's turn, when it is attacked, the attacker's ATK is 0 for that
// damage calculation; once while face-up (the mark is in c.flags, which reset when it leaves the field or turns face-down).
// ENGINE: no window during damage calculation, so it is used in the Damage Step windows before it.
const guardian = [
  { type: 'quick', ds: true, label: 'Make the attacker’s ATK 0',
    cond: (g, c, p) => g.inDS && g.battle && g.battle.t === c && g.tp !== c.ctrl && !c.flags.guardUsed && g.battle.a && onField(g.battle.a) && !g.battle.a.mods.some(m => m.guardZero),
    target: function* (g, c, p, L2) { L2.t = [g.battle.a]; },
    after: (g, c) => { c.flags.guardUsed = true; },
    res: function* (g, c, p, L2) { const a = live(L2)[0]; if (!a || a.zone !== 'm' || !g.battle) return; addMod(g, a, { set: 0, which: 'atk', end: true, guardZero: true }); g.seq++; log(g, `${name(a)}'s ATK became 0 for damage calculation.`); } },
  { type: 'trig', res: noop, on: (g, ev) => { if ((ev.type === 'afterCalc' || ev.type === 'dsEnd') && ev.a && ev.a.mods.some(m => m.guardZero)) { ev.a.mods = ev.a.mods.filter(m => !m.guardZero); g.seq++; } return false; } }];

// Serial Spell (port of goat-2.js)
function* discardAll(g, p) { const h = g.p[p].hand.slice(); for (const x of h) move(g, x, 'gy', { reason: 'discard', by: p }); if (h.length) log(g, `${PN(g, p)} discarded ${h.length} card${h.length > 1 ? 's' : ''}.`); }

// Serpentine Princess (port of goat-6.js)
function princessTargets(g, p) { return g.p[p].deck.filter(x => isMon(x) && lv(x) <= 3 && !['ritual', 'token'].includes(D(x).k) && !forbid(g, { type: 'ss', c: x, p, how: 'special' })); }

/* A battle worked out inside a card (port of classic-5.js, for Shift).
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
const stopAttack = g => { negateAttack(g); g.aw = null; };

// Spellbinding Circle (port of classic-5.js): the held monster's u is c.flags.hold
const holdLock = { forbid: (g, src, a) => (a.type === 'attack' || a.type === 'pos') && a.c && a.c.u === src.flags.hold };

// Shadowknight Archfiend's die (same shape as full-20.js): offered as a Spell Speed 3 response to the opponent's effect
// that targets it. PARTIAL: the roll is optional here (the engine has no hook at resolution of a targeting effect).
const archDice = (hits, label) => ({ type: 'quick', speed: 3, ds: true, label,
  cond: (g, c, p, x) => { const T = x.top; return !!T && !T.negated && T.p !== p && !(T.f27dice || []).includes(c.u) && (T.t || []).includes(c) && onField(c) && faceUp(c); },
  target: function* (g, c, p, L2) { const T = g.chain[g.chain.length - 1]; (T.f27dice || (T.f27dice = [])).push(c.u); L2.data.L = T; },
  res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated) return; const n = dice(g, p); if (hits.includes(n)) { T.negBy = p; negate(g, T, true); } else log(g, 'Nothing happened.'); } });

// Union monsters (Second Goblin): the equip and the unequip share one use a turn (c.used.union)
const hasUnion = (g, m) => allField(g).some(x => x.zone === 'st' && x.equipTo === m.u && x.flags.union);

// Sebek's Blessing: the last direct-attack battle damage of this Battle Phase (cleared by the next attack declaration)
const sebekWatch = { type: 'trig', loc: 'any', res: noop, on: (g, ev) => {
  if (ev.type === 'damage' && ev.battle && ev.direct && ev.srcP != null && ev.p !== ev.srcP) g.f27dd = { p: ev.srcP, n: ev.n, turn: g.turnNo };
  else if (ev.type === 'attack' || (ev.type === 'phase' && ev.ph === 'bpEnd')) g.f27dd = null;
  return false; } };

E.addScripts({
  /* ----- Sa ----- */
  "Sage's Stone": { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && monsOf(g, p).some(x => faceUp(x) && named(x, 'Dark Magician Girl')) && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Dark Magician') && canSS(g, p, x)),
    res: function* (g, c, p) { if (freeM(g, p) < 0) return; const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Dark Magician') && canSS(g, p, x)); if (!cs.length) return;
      const [x] = yield* pick(g, p, 'Special Summon Dark Magician from your hand or Deck', cs, 1, 1, 'good'); if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } } }] },
  // Targets the attacker; a face-down attacker (Book of Moon chained) is not destroyed (ruling).
  'Sakuretsu Armor': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p,
    target: function* (g, c, p, L2) { L2.t = [g.aw.a]; },
    res: function* (g, c, p, L2) { destroy(g, live(L2).filter(faceUp), { by: p, src: c }); } }] },
  'Salamandra': { cont: eqBonus(700, 0), effs: [equipAct(m => attr(m) === 'FIRE', 'Equip to which face-up FIRE monster?')] },
  // Ignition, once per turn: 3 coins. All Heads: destroy all the opponent's monsters; all Tails: destroy all of yours.
  'Sand Gambler': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Toss 3 coins',
    res: function* (g, c, p) { const r = yield* tossCoins(g, p, 3);
      if (r.every(Boolean)) destroy(g, monsOf(g, opp(p)), { by: p, src: c });
      else if (r.every(x => !x)) destroy(g, monsOf(g, p), { by: p, src: c });
      else log(g, 'Nothing happened.'); } }] },
  'Sanga of the Thunder': { effs: guardian },
  'Sanwitch': { effs: [] }, // Fusion Monster with no effect ("Sangan" + "Witch of the Black Forest" read from its text)
  // ENGINE: no Attribute override, so the chosen Attribute is only noted and logged (attr() still reads the card data).
  'Scroll of Bewitchment': { effs: [equipAct(() => true, 'Equip Scroll of Bewitchment to which monster?', {
    pre: function* (g, c, p, L2) { const A = ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND']; L2.data.attr = A[yield* choose(g, p, 'Select 1 Attribute', A)]; },
    post: (g, c, p, L2, t) => { c.flags.f27attr = L2.data.attr; log(g, `${name(t)} is treated as ${L2.data.attr} (Scroll of Bewitchment).`); } })] },
  // PARTIAL: the face-down cards are shown in the log (both players see the log), not only to the activating player.
  'Seal of the Ancients': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp > 1000,
    cost: function* (g, c, p) { pay(g, p, 1000); },
    res: function* (g, c, p) { const fd = fieldOf(g, opp(p)).filter(x => x.pos === 'set');
      log(g, fd.length ? `${PN(g, p)} looked at ${PN(g, opp(p))}'s face-down cards: ${fd.map(x => D(x).n).join(', ')}.` : `${PN(g, opp(p))} has no face-down cards.`); } }] },
  // After your monster inflicts battle damage by a direct attack, during that Battle Phase (until the next attack).
  "Sebek's Blessing": { effs: [sebekWatch, { type: 'act', ds: true,
    cond: (g, c, p) => g.phase === 'battle' && !!g.f27dd && g.f27dd.p === p && g.f27dd.turn === g.turnNo,
    target: function* (g, c, p, L2) { L2.data.n = g.f27dd.n; },
    res: function* (g, c, p, L2) { gain(g, p, L2.data.n); } }] },
  // ENGINE: the redo is only offered for coin tosses that go through this file's helper (Sand Gambler), see tossCoins.
  'Second Coin Toss': { effs: [actNoop] },
  // Union with Giant Orc (Edison union rules). While equipped, the equipped monster's position can be changed once per
  // turn; if the equipped monster would be destroyed by battle, this card is destroyed instead.
  'Second Goblin': {
    cont: { replaceDestroy: (g, src, m, o) => { if (!o.battle || src.zone !== 'st' || src.equipTo !== m.u || !src.flags.union) return false;
      move(g, src, 'gy', { reason: 'battle', destroyed: true, by: o.by }); log(g, `Second Goblin was destroyed instead of ${name(m)}.`); return true; } },
    effs: [
      { type: 'ign', label: 'Equip to Giant Orc',
        cond: (g, c, p) => c.used.union !== g.turnNo && freeST(g, p) >= 0 && monsOf(g, p).some(x => x !== c && faceUp(x) && named(x, 'Giant Orc') && !hasUnion(g, x)),
        after: (g, c) => { c.used.union = g.turnNo; },
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Second Goblin to which Giant Orc?', monsOf(g, p).filter(x => x !== c && faceUp(x) && named(x, 'Giant Orc') && !hasUnion(g, x)), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || t.ctrl !== p || c.zone !== 'm' || !faceUp(c) || freeST(g, p) < 0 || hasUnion(g, t)) return;
          move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); c.equipTo = t.u; c.flags.union = true; g.seq++; log(g, `Second Goblin was equipped to ${name(t)}.`); } },
      { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Unequip and Special Summon',
        cond: (g, c, p) => c.used.union !== g.turnNo && !!c.equipTo && !!c.flags.union && freeM(g, p) >= 0,
        after: (g, c) => { c.used.union = g.turnNo; },
        res: function* (g, c, p) { if (c.zone !== 'st' || !c.equipTo || !c.flags.union) return; c.equipTo = null; c.flags.union = false; ss(g, p, c, 'atk'); } },
      { type: 'ign', loc: 'st', opt: true, label: 'Change the equipped monster’s position',
        cond: (g, c) => !!c.flags.union && fieldMons(g).some(m => m.u === c.equipTo && faceUp(m)),
        res: function* (g, c) { const m = fieldMons(g).find(x => x.u === c.equipTo); if (!m || !faceUp(m) || !c.flags.union) return; if (m.pos === 'atk') toDef(g, m); else toAtk(g, m); } }] },
  // Activated while your LP are 7000 or more below the opponent's; still resolves if the gap closes (ruling). The duel is a draw.
  'Self-Destruct Button': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].lp - g.p[p].lp >= 7000,
    res: function* (g) { g.p[0].lp = 0; g.p[1].lp = 0; log(g, 'Both players’ LP became 0.'); over(g, -1, 'Both players hit 0 LP'); } }] },
  'Senju of the Thousand Hands': { effs: [{ type: 'trig', when: true, label: 'Add a Ritual Monster', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute', 'flip']),
    cond: (g, c, p) => g.p[p].deck.some(x => D(x).k === 'ritual'),
    res: function* (g, c, p) { yield* search(g, p, x => D(x).k === 'ritual', 'Add which Ritual Monster to your hand?'); } }] },
  // ENGINE: no Standby Phase response window, so it is an optional trigger at the start of your Standby Phase.
  // PARTIAL: the top card is shown in the log, which both players see.
  'Senri Eye': { effs: [actNoop,
    { type: 'trig', loc: 'st', opt: true, label: 'Pay 100: look at the top card of their Deck',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      cond: (g, c, p) => g.p[p].lp > 100 && g.p[opp(p)].deck.length > 0,
      cost: function* (g, c, p) { pay(g, p, 100); },
      res: function* (g, c, p) { const d = g.p[opp(p)].deck, top = d[d.length - 1]; if (top) log(g, `${PN(g, p)} looked at the top card of ${PN(g, opp(p))}'s Deck: ${D(top).n}.`); } }] },
  // Chained straight to your own Normal Spell: discard your whole hand (cost); this card's effect becomes that Spell's.
  'Serial Spell': { effs: [{ type: 'act',
    cond: (g, c, p, x) => { const t = x.top; return !!(t && t.p === p && t.cardAct && isSpell(t.c) && D(t.c).sub === 'Normal' && !t.negated && t.c !== c) && g.p[p].hand.some(y => y !== c); },
    cost: function* (g, c, p, L2) { L2.data.orig = g.chain[g.chain.length - 1]; yield* discardAll(g, p); },
    target: function* (g, c, p, L2) { const o = L2.data.orig; L2.tags = o.tags || {}; if (o.eff.target) yield* o.eff.target(g, c, p, L2); },
    res: function* (g, c, p, L2) { const o = L2.data.orig; log(g, `Serial Spell copies ${name(o.c)}.`); yield* o.eff.res(g, c, p, L2); } }] },
  'Serpentine Princess': { effs: [{ type: 'trig', loc: 'deck', mand: true, tags: { ss: 1 }, label: 'Summon a Level 3 or lower monster',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.faceUp && (ev.to === 'deck' || ev.to === 'deckTop'),
    res: function* (g, c, p) { const ms = princessTargets(g, p); if (ms.length && freeM(g, p) >= 0) { const [x] = yield* pick(g, p, 'Special Summon which Level 3 or lower monster from your Deck?', ms, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } shuffleDeck(g, p); } }] },
  'Servant of Catabolism': { self: { directAttack: true } },
  'Shadowknight Archfiend': {
    cont: { dmg: (g, src, p, n, o) => o.battle && o.src === src && p !== src.ctrl && !negd(g, src) ? Math.floor(n / 2) : undefined },
    effs: [{ type: 'trig', mand: true, label: 'Pay 900 LP', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 900) pay(g, p, 900); else destroy(g, [c], { by: p, rule: true }); } },
      archDice([3], 'Roll a die (3 negates and destroys)')] },
  // Only the Monster Zones count (ruling).
  'Shadowslayer': { self: { directAttack: (g, c) => { const ms = monsOf(g, opp(c.ctrl)); return ms.length > 0 && ms.every(m => m.pos !== 'atk'); } } },
  // Tributing 1 monster is the cost; the opponent picks their Tribute at resolution (no Summon).
  'Share the Pain': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).length > 0 && monsOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    res: function* (g, c, p) { const o = opp(p); if (!monsOf(g, o).length) return; const [x] = yield* pick(g, o, 'Tribute which of your monsters?', monsOf(g, o), 1, 1, 'cost');
      if (x) { move(g, x, 'gy', { reason: 'tribute', by: o }); log(g, `${PN(g, o)} Tributed ${D(x).n}.`); } } }] },
  // ENGINE: attack redirects (port of classic-5.js). PARTIAL: "an appropriate target" isn't checked beyond being another
  // monster you control; a switched attack is worked out by the card.
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
  // Once per turn, pay 300 (cost): your face-down Defense monsters are shuffled among their zones.
  // PARTIAL: the new order is random instead of chosen (the engine's zones have no hidden identity to the opponent anyway).
  'Shifting Shadows': { effs: [actNoop,
    { type: 'ign', loc: 'st', opt: true, label: 'Pay 300: rearrange your face-down monsters',
      cond: (g, c, p) => g.p[p].lp > 300 && monsOf(g, p).filter(m => m.pos === 'set').length >= 2,
      cost: function* (g, c, p) { pay(g, p, 300); },
      res: function* (g, c, p) { const Z = g.p[p].m, idx = Z.map((m, i) => m && m.pos === 'set' ? i : -1).filter(i => i >= 0); if (idx.length < 2) return;
        const cs = idx.map(i => Z[i]); for (let i = cs.length - 1; i > 0; i--) { const j = Math.floor(g.rnd() * (i + 1)); [cs[i], cs[j]] = [cs[j], cs[i]]; }
        idx.forEach((zi, k) => { Z[zi] = cs[k]; }); g.seq++; log(g, `${PN(g, p)} rearranged ${idx.length} face-down monsters.`); } }] },
  // Ritual Summoned with Shinato's Ark. When it destroys a Defense Position monster by battle and sends it to the GY:
  // damage equal to that monster's original ATK (mandatory).
  'Shinato, King of a Higher Plane': { effs: [{ type: 'trig', mand: true, label: 'Damage equal to the original ATK',
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.killer === c && ev.to === 'gy' && !!ev.snap && ev.snap.pos !== 'atk' && isMon(ev.c),
    res: function* (g, c, p, L2) { const n = D(L2.ev.c).k === 'token' ? 0 : num(D(L2.ev.c).atk); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  "Shinato's Ark": { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => canRitual(g, p, { monster: x => named(x, 'Shinato, King of a Higher Plane') }),
    res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, 'Shinato, King of a Higher Plane') }); } }] },
  // "Cannot be Normal Summoned/Set" is read from the text. First Special Summoned from the hand by banishing 1 WIND from your GY.
  'Silpheed': {
    proc: { label: 'Special Summon (banish a WIND from your GY)', cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'WIND'),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish which WIND monster from your GY?', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'WIND'), 1, 1, 'cost');
        if (x) { move(g, x, 'ban', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } } },
    effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Opponent discards a random card',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
      res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, opp(p))} discarded ${name(x)} at random.`); } }] },
  'Silver Bow and Arrow': { cont: eqBonus(300, 300), effs: [equipAct(m => race(m) === 'Fairy', 'Equip to which face-up Fairy monster?')] },
  'Skilled Dark Magician': skilled('Dark Magician'),
  'Skilled White Magician': skilled('Buster Blader'),
  'Slate Warrior': { effs: [
    { type: 'trig', mand: true, faceDownOk: true, label: '+500 ATK and DEF', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500, def: 500 }); log(g, `${name(c)} gained 500 ATK and DEF.`); } } },
    { type: 'trig', loc: 'gy', mand: true, label: 'The monster that destroyed it loses 500', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.wasField && !!ev.killer,
      res: function* (g, c, p, L2) { const k = L2.ev.killer; if (k && onField(k) && faceUp(k)) { addMod(g, k, { atk: -500, def: -500 }); log(g, `${name(k)} lost 500 ATK and DEF.`); } } }] },
  // Destroyed by an effect while on the field (with the equipped monster too, per the rulings; not when it is just sent to
  // the GY because the monster left). The equip is noted on the card (c.flags.smoke), so the trigger sees it in the snapshot.
  'Smoke Grenade of the Thief': { effs: [
    equipAct(() => true, 'Equip Smoke Grenade of the Thief to which monster?', { post: (g, c, p, L2, t) => { c.flags.smoke = t.u; } }),
    { type: 'trig', loc: 'any', mand: true, label: 'Discard from their hand',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !ev.battle && ev.reason === 'effect' && !!(ev.snap && ev.snap.flags && ev.snap.flags.smoke),
      res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand; if (!h.length) return; log(g, `${PN(g, p)} looked at ${PN(g, o)}'s hand: ${h.map(x => D(x).n).join(', ')}.`);
        const [x] = yield* pick(g, p, 'Discard which card from their hand?', h, 1, 1, 'bad'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, o)} discarded ${name(x)}.`); } } }] },
  // Control lasts while it stays equipped; the opponent gains 1000 LP in each of their Standby Phases.
  'Snatch Steal': { effs: [
    { type: 'act', cond: (g, c, p) => oppFaceUp(g, p).length > 0 && freeM(g, p) >= 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || t.ctrl === p || !onField(c)) return; const from = t.ctrl; if (!takeControl(g, p, t, false)) return; c.equipTo = t.u; c.flags.snatch = { u: t.u, from }; log(g, `Snatch Steal was equipped to ${name(t)}.`); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Opponent gains 1000 LP', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl && !!c.equipTo,
      res: function* (g, c, p) { gain(g, opp(p), 1000); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Control returns', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.flags && ev.snap.flags.snatch,
      res: function* (g, c, p, L2) { const s = L2.ev.snap.flags.snatch; const t = fieldMons(g).find(x => x.u === s.u); if (!t || t.ctrl === s.from) return;
        if (freeM(g, s.from) >= 0) takeControl(g, s.from, t, false); else move(g, t, 'gy', { reason: 'rule' }); } }] },
  /* ----- So ----- */
  'Sogen': { cont: { atk: (g, src, m) => ['Warrior', 'Beast-Warrior'].includes(race(m)) ? 200 : 0, def: (g, src, m) => ['Warrior', 'Beast-Warrior'].includes(race(m)) ? 200 : 0 }, effs: [actNoop] },
  'Solar Flare Dragon': { self: { noAttackTarget: (g, c) => monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && race(x) === 'Pyro') },
    effs: [{ type: 'trig', mand: true, label: '500 damage', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  'Solar Ray': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && attr(m) === 'LIGHT'),
    res: function* (g, c, p) { const n = 600 * monsOf(g, p).filter(m => faceUp(m) && attr(m) === 'LIGHT').length; if (n) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  // 500 LP each time you draw (one gain for cards drawn together).
  'Solemn Wishes': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Gain 500 LP', on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && ev.to === 'hand' && ev.c.owner === c.ctrl,
      res: function* (g, c, p) { gain(g, p, 500); } }] },
  // PARTIAL: "skip" is done as a rule: nothing can be activated in your next Standby Phase (Standby Phase triggers don't
  // happen); the engine still runs the phase (Gold Sarcophagus still counts it).
  "Solomon's Lawbook": { effs: [{ type: 'act',
    res: function* (g, c, p) { const T = g.turnNo + (g.tp === p ? 2 : 1);
      addRule(g, (g2, a) => a.type === 'activate' && g2.phase === 'standby' && g2.tp === p && g2.turnNo === T, { end: T });
      log(g, `${PN(g, p)} skips their next Standby Phase.`); } }] },
  // ENGINE: "Cannot be Special Summoned by other ways" is not enforced (no generic flag); "Cannot be Normal Summoned/Set"
  // is read from the text. Negating a Trap Card activation is not once per turn (the text has no limit).
  'Sorcerer of Dark Magic': {
    proc: { label: 'Special Summon (Tribute 2 Level 6+ Spellcasters)', cond: (g, c, p) => monsOf(g, p).filter(m => lv(m) >= 6 && race(m) === 'Spellcaster').length >= 2,
      cost: function* (g, c, p, grp) { const ts = yield* pick(g, p, 'Tribute 2 Level 6 or higher Spellcasters', monsOf(g, p).filter(m => lv(m) >= 6 && race(m) === 'Spellcaster'), 2, 2, 'cost');
        for (const t of ts) move(g, t, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${ts.map(t => D(t).n).join(' and ')}.`); } },
    effs: [{ type: 'quick', ds: true, tags: { destroy: 1 }, label: 'Negate the Trap Card',
      cond: (g, c, p, x) => spellTrapAct(x.top) && isTrap(x.top.c) && !x.top.negated,
      target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { const T = L2.data.L; if (!onField(c) || !faceUp(c) || !T || !g.chain.includes(T) || T.negated) return; T.negBy = p; negate(g, T, true); } }] },
  'Sparks': { effs: [{ type: 'act', res: function* (g, c, p) { damage(g, opp(p), 200, { src: c, srcP: p }); } }] },
  // Both players can have at most 5 cards on the field: summons, Sets and card activations from the hand are blocked at 5,
  // and a player over 5 (from an effect) sends the extra cards to the GY.
  // PARTIAL: a Synchro or Tribute that frees zones first is still blocked at 5; Scapegoat style multi-summons are checked
  // only by their first card.
  'Spatial Collapse': {
    cont: { forbid: (g, src, a) => {
      if (!['ns', 'set', 'ss', 'setST', 'activate'].includes(a.type) || a.p == null) return false;
      if (a.type === 'activate' && !(a.c && a.c.zone === 'hand' && isST(a.c))) return false;
      return fieldOf(g, a.p).length >= 5; } },
    effs: [{ type: 'act', cond: g => fieldOf(g, 0).length <= 5 && fieldOf(g, 1).length <= 5, res: noop },
      { type: 'trig', loc: 'st', mand: true, label: 'Send cards over 5 to the GY', on: (g, ev, c) => ev.type === 'move' && [0, 1].some(q => fieldOf(g, q).length > 5),
        res: function* (g, c, p) { for (const q of [p, opp(p)]) { const n = fieldOf(g, q).length - 5; if (n <= 0) continue;
          const xs = yield* pick(g, q, `Send ${n} of your cards to the GY (Spatial Collapse)`, fieldOf(g, q), n, n, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'rule' }); log(g, `${PN(g, q)} sent ${xs.map(x => D(x).n).join(', ')} to the GY.`); } } }] },
  // FLIP, delayed: when it is sent to the GY after being flipped, each player may Special Summon 1 monster from their own GY
  // (not this card) in Attack Position or face-down Defense Position.
  'Spear Cretin': { effs: [
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'flip' && ev.c === c) c.f27fl = true; else if (ev.type === 'move' && ev.c === c && ev.to === 'm') c.f27fl = false; return false; } },
    { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Each player revives a monster',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy' && !!c.f27fl,
      res: function* (g, c, p) { c.f27fl = false;
        for (const q of [g.tp, opp(g.tp)]) { if (freeM(g, q) < 0) continue; const cs = g.p[q].gy.filter(x => x !== c && canSS(g, q, x) && !isExtraD(D(x)) || (x !== c && isExtraD(D(x)) && canSS(g, q, x) && x.f26proper));
          if (!cs.length) continue; const [x] = yield* pick(g, q, 'Special Summon a monster from your GY? (optional)', cs, 0, 1, 'good'); if (!x) continue;
          const i = yield* choose(g, q, `${D(x).n}: which position?`, ['Attack Position', 'Face-down Defense Position']); ss(g, q, x, i ? 'set' : 'atk'); } } }] },
  'Spear Dragon': { self: { piercing: true },
    effs: [{ type: 'trig', mand: true, label: 'Change to Defense Position', on: (g, ev, c) => ev.type === 'dsEnd' && ev.a === c && c.pos === 'atk',
      res: function* (g, c) { toDef(g, c); } }] },
  // Discarding 1 card is the cost. Face-down Special Summoned monsters are destroyed too (ruling); Tokens count.
  'Special Hurricane': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && fieldMons(g).some(specialSummoned),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand.filter(x => x !== c), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(specialSummoned), { by: p, src: c }); } }] },
  'Spellbinding Circle': { cont: holdLock, effs: [
    { type: 'act', cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !onField(c)) return; c.flags.hold = t.u; g.seq++; log(g, `${name(c)} holds ${t.pos === 'set' ? 'a face-down monster' : name(t)}.`); if (g.aw && g.aw.a === t) stopAttack(g); } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy Spellbinding Circle',
      on: (g, ev, c) => faceUp(c) && !!c.flags.hold && ev.type === 'move' && ev.c.u === c.flags.hold && ev.wasField && ev.to !== 'm' && ev.destroyed,
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  // Quick-Play: put the top 3 cards back in the order you choose (the first one picked goes on top).
  'Spellbook Organization': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length > 0,
    res: function* (g, c, p) { const d = g.p[p].deck, k = Math.min(3, d.length); const top = d.slice(d.length - k).reverse(); log(g, `${PN(g, p)} looked at the top ${k} card${k > 1 ? 's' : ''} of the Deck.`);
      const order = []; let left = top.slice();
      while (left.length > 1) { const [x] = yield* pick(g, p, `Which card goes ${order.length ? 'next' : 'on top'}?`, left, 1, 1, 'good'); if (!x) break; order.push(x); left = left.filter(y => y !== x); }
      order.push(...left); d.splice(d.length - k, k, ...order.slice().reverse()); g.seq++; log(g, `${PN(g, p)} put them back on top of the Deck.`); } }] },
  // Ignition from the hand (Spell Speed 1, ruling): pay 500 while Pyramid of Light is face-up on the field.
  // ENGINE: "Cannot be Special Summoned from the GY" is not enforced (no generic flag).
  'Sphinx Teleia': {
    self: { cantAttack: (g, c) => c.turnIn === g.turnNo && ['normal', 'tribute', 'special'].includes(c.summonType) },
    effs: [{ type: 'ign', loc: 'hand', tags: { ss: 1 }, label: 'Pay 500: Special Summon',
      cond: (g, c, p) => g.p[p].lp > 500 && freeM(g, p) >= 0 && stOnField(g).some(x => faceUp(x) && named(x, 'Pyramid of Light')),
      cost: function* (g, c, p) { pay(g, p, 500); },
      res: function* (g, c, p) { if (c.zone === 'hand' && freeM(g, p) >= 0) ss(g, p, c, 'atk'); } },
      { type: 'trig', mand: true, label: 'Damage equal to half its DEF',
        on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.killer === c && !!ev.snap && ev.snap.pos !== 'atk' && isMon(ev.c),
        res: function* (g, c, p, L2) { const n = Math.floor((L2.ev.snap.def || 0) / 2); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  // The Gaia monsters you control inflict piercing damage; Gaia the Dragon Champion's piercing damage draws 2, then discards 1.
  'Spiral Spear Strike': {
    cont: { grant: (g, src, c, flag) => flag === 'piercing' && c.zone === 'm' && c.ctrl === src.ctrl && ['Gaia The Fierce Knight', 'Swift Gaia the Fierce Knight', 'Gaia the Dragon Champion'].includes(D(c).n) },
    effs: [actNoop, { type: 'trig', loc: 'st', mand: true, label: 'Draw 2, then discard 1',
      on: (g, ev, c) => ev.type === 'damage' && ev.battle && !!ev.src && ev.src.ctrl === c.ctrl && ev.p !== c.ctrl && named(ev.src, 'Gaia the Dragon Champion') && !!g.battle && !!g.battle.t && g.battle.t.pos !== 'atk',
      res: function* (g, c, p) { draw(g, p, 2); const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } } }] },
  // Each time your Spirit monster returns from the field to your hand: 1 of the opponent's monsters returns to the hand.
  // Pay 500 in each of your Standby Phases, or destroy this card (your choice).
  "Spirit's Invitation": { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Return 1 of their monsters to the hand',
      on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.to === 'hand' && isSpirit(ev.c) && ev.prevCtrl === c.ctrl && ev.c.owner === c.ctrl,
      res: function* (g, c, p) { const ms = monsOf(g, opp(p)); if (!ms.length) return; const [x] = yield* pick(g, p, 'Return which of their monsters to the hand?', ms, 1, 1, 'bad');
        if (x && onField(x)) { move(g, x, 'hand', { reason: 'effect', by: p }); log(g, `${D(x).n} returned to the ${isExtraD(D(x)) ? 'Extra Deck' : 'hand'}.`); } } },
    { type: 'trig', loc: 'st', mand: true, label: 'Pay 500 LP or destroy this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 500 && (yield* yn(g, p, "Pay 500 LP to keep Spirit's Invitation?"))) pay(g, p, 500); else destroy(g, [c], { by: p }); } }] },
  // ENGINE: "This card's activation and effect can't be negated" isn't enforced (no hook in negate()).
  'Spiritualism': { effs: [{ type: 'act', cond: (g, c, p) => stOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which Spell/Trap to the hand?', stOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone !== 'm') { move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${D(t).n} returned to ${PN(g, t.owner)}'s hand.`); } } }] },
  // 500 LP each time monsters return from the field to the hand (once for monsters returned together; cumulative copies).
  'Spring of Rebirth': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Gain 500 LP', on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.to === 'hand' && !!ev.snap && ev.snap.mon,
      res: function* (g, c, p) { gain(g, p, 500); } }] },
  'St. Joan': { effs: [] }, // Fusion Monster with no effect
  'Stamping Destruction': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && race(m) === 'Dragon') && stOnField(g).some(x => x !== c),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOnField(g).filter(x => x !== c), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; const q = t.ctrl; if (destroy(g, [t], { by: p, src: c }).length) damage(g, q, 500, { src: c, srcP: p }); } }] },
  'Star Boy': { cont: { atk: (g, src, m) => attr(m) === 'WATER' ? 500 : attr(m) === 'FIRE' ? -400 : 0 } },
  // Only from the field: when this Set card is destroyed and sent to the GY, a Wicked Token. It can't be activated while Set.
  'Statue of the Wicked': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon a Wicked Token',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy' && !!ev.snap && !ev.snap.faceUp,
    cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) { tokens(g, p, { n: 'Wicked Token', a: 'DARK', r: 'Fiend', lv: 4, atk: 1000, def: 1000 }, 1, 'atk'); } }] },
  // On the opponent's attack declaration: select 1 of your face-up monsters; this turn their monsters can only attack it.
  // The current attack is stopped so it can be declared again (the replay). ENGINE: forced attacks ("must attack the
  // selected monster with all face-up monsters") aren't enforced. If the selected monster leaves, they can't attack.
  'Staunch Defender': {
    cont: { loc: 'gy',
      grant: (g, src, c, flag) => { const s = g.f27sd; return flag === 'noAttackTarget' && !!s && s.turn === g.turnNo && c.zone === 'm' && c.ctrl === s.p && c.u !== s.u; },
      forbid: (g, src, a) => { const s = g.f27sd; return a.type === 'attack' && !!s && s.turn === g.turnNo && a.c && a.c.ctrl !== s.p && !fieldMons(g).some(m => m.u === s.u && m.ctrl === s.p); } },
    effs: [{ type: 'act', cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && monsOf(g, p).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which of your face-up monsters?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); L2.data.a = g.aw.a; },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; g.f27sd = { p, u: t.u, turn: g.turnNo }; g.seq++; log(g, `This turn ${PN(g, opp(p))} can only attack ${name(t)}.`);
        const a = L2.data.a; if (g.aw && g.aw.a === a && g.aw.t !== t) { stopAttack(g); if (a.attacks > 0) a.attacks--; log(g, `${name(a)} can declare its attack again.`); } } }] },
  'Stealth Bird': { effs: [
    { type: 'ign', opt: true, label: 'Turn face-down', cond: (g, c) => c.turnIn !== g.turnNo && !c.posChanged,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { setFaceDown(g, c); c.posChanged = true; } } },
    { type: 'trig', mand: true, label: '1000 damage', on: (g, ev, c) => evSummoned(ev, c, ['flip']),
      res: function* (g, c, p) { damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },
  // A non-Machine monster that attacks this card is destroyed in the End Phase of its controller's 2nd turn after the attack
  // (the attack turn doesn't count), unless it left the field or was turned face-down (its mark is in its flags).
  'Steel Scorpion': { effs: [{ type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the monster that attacked it',
    on: (g, ev, c) => {
      if (ev.type === 'afterCalc' && ev.t === c && ev.a && onField(ev.a) && race(ev.a) !== 'Machine' && onField(c) && !negd(g, c)) { ev.a.flags.f27sc = { u: c.u, p: ev.a.ctrl, t: g.turnNo, n: 0 }; return false; }
      if (ev.type !== 'phase' || ev.ph !== 'end') return false;
      let hit = false; for (const m of fieldMons(g)) { const s = m.flags.f27sc; if (s && s.u === c.u && ev.tp === s.p && g.turnNo > s.t && s.last !== g.turnNo) { s.last = g.turnNo; s.n++; if (s.n >= 2) hit = true; } }
      return hit; },
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => m.flags.f27sc && m.flags.f27sc.u === c.u && m.flags.f27sc.n >= 2 && faceUp(m)), { by: c.ctrl }); } }] },
  'Steel Shell': { cont: eqBonus(400, -200), effs: [equipAct(m => attr(m) === 'WATER', 'Equip to which face-up WATER monster?')] },
  // -200 ATK in each of your Standby Phases (counted on the card, no chain link).
  'Stim-Pack': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 700 - 200 * (src.flags.stim || 0) : 0 },
    effs: [equipAct(), { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.equipTo) { c.flags.stim = (c.flags.stim || 0) + 1; g.seq++; log(g, 'The monster equipped with Stim-Pack lost 200 ATK.'); } return false; } }] },
  'Stone Statue of the Aztecs': { cont: { dmg: (g, src, p, n, o) => o && o.battle && g.battle && g.battle.t === src && g.battle.a && g.battle.a.ctrl === p && p !== src.ctrl && !negd(g, src) ? n * 2 : undefined } },
  // A face-down monster is flipped face-up (Flip effects activate), not Flip Summoned (ruling).
  'Stop Defense': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, opp(p)).some(m => m.pos !== 'atk'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change which Defense Position monster to Attack Position?', monsOf(g, opp(p)).filter(m => m.pos !== 'atk'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.pos === 'atk') return;
      if (t.pos === 'set') { t.pos = 'atk'; g.seq++; log(g, `${name(t)} was flipped face-up in Attack Position.`); emit(g, { type: 'flip', c: t, p: t.ctrl }); } else toAtk(g, t); } }] },
});
})();
