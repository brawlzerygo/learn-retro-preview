/* Full pool batch 16: The A. Forces to The World Tree (build/batches/full/full-16.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text; cards with a
 Goat-only script elsewhere (The Big March of Animals, The Creator, The Dark Door, The Eye of Truth, The Fiend Megacyber,
 The Flute of Summoning Dragon, The Last Warrior from Another Planet, The Legendary Fisherman, The Masked Beast,
 The Shallow Grave, The Unfriendly Amazon, The Wicked Worm Beast) are ported here as the shared version. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, negate, addMod, equip, addCtr, ctr,
  endBattle, addRule, ritualSummon, canRitual, coin, winDuel, name, D, isMon, isST, isSpell, isTrap, onField, faceUp,
  attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM, shuffleDeck, log, PN,
  live, opp, evSummoned, fromFieldToGY, stat, negd, forbid, tributeCands, isExtraD, emit } = L;
const atk = L.atk;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const TYPES = ['Aqua', 'Beast', 'Beast-Warrior', 'Dinosaur', 'Dragon', 'Fairy', 'Fiend', 'Fish', 'Insect', 'Machine', 'Plant',
  'Psychic', 'Pyro', 'Reptile', 'Rock', 'Sea Serpent', 'Spellcaster', 'Thunder', 'Warrior', 'Winged Beast', 'Zombie'];
const canSS = (g, p, x) => !forbid(g, { type: 'ss', c: x, p, how: 'special' });
// "lose LP" is not damage: no damage hooks, and the duel ends at 0
function loseLP(g, p, n) { g.p[p].lp = Math.max(0, g.p[p].lp - n); log(g, `${PN(g, p)} lost ${n} LP.`); if (g.p[p].lp <= 0) winDuel(g, opp(p), `${PN(g, p)} hit 0 LP`); }
// both players take the same damage at once (a draw if both hit 0)
function bothDamage(g, n, src, srcP) {
  if (g.p[0].lp <= n && g.p[1].lp <= n) { g.p[1].lp -= n; log(g, `${PN(g, 1)} took ${n} damage.`); damage(g, 0, n, { src, srcP }); return; }
  damage(g, srcP, n, { src, srcP }); damage(g, opp(srcP), n, { src, srcP });
}
const tribute = (g, p, x, why) => { const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${nm}${why ? ' ' + why : ''}.`); };
function* discard1(g, p, not, text = 'Discard 1 card') { const h = g.p[p].hand.filter(x => x !== not); if (!h.length) return null; const [x] = yield* pick(g, p, text, h, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } return x; }
// Effect Monsters (same reading as full-04.js): Effect, Flip and the rest, Fusions/Synchros with text past the materials, Rituals with text past their summon line
function isEffMon(c) {
  const d = D(c), tx = d.tx || '';
  if (d.k === 'trap' || d.k === 'effect') return true;
  if (d.k === 'fusion' || d.k === 'synchro') return tx.split(/\r?\n/).filter(s => s.trim()).length > 1;
  if (d.k === 'ritual') return tx.replace(/^You can Ritual Summon this card with "[^"]+"\.\s*/i, '').replace(/^This card can only be Ritual Summoned[^.]*\.\s*/i, '').trim().length > 0;
  return false;
}
const umiOn = g => [g.p[0].fz, g.p[1].fz].some(f => f && faceUp(f) && (named(f, 'Umi') || named(f, 'A Legendary Ocean')));
const lordUp = g => fieldMons(g).some(m => faceUp(m) && named(m, 'Lord of D.'));
const noNS = x => /Cannot be Normal Summoned/i.test(D(x).tx || '');
// subsets of cards whose Levels add up to n
function lvSets(cards, n, limit = 12) { const out = []; const rec = (i, cur, s) => { if (out.length >= limit) return; if (s === n && cur.length) { out.push(cur.slice()); return; } if (s >= n) return; for (let j = i; j < cards.length; j++) { cur.push(cards[j]); rec(j + 1, cur, s + lv(cards[j])); cur.pop(); } }; rec(0, [], 0); return out; }

/* Summon locks read from the text ("Cannot be Special Summoned", "can only be Special Summoned by ..."): one duel-long rule,
 installed by the first event any of these cards sees (a trig that never fires). */
const LOCKS = {
  'The Big Saturn': (g, a) => a.c.zone === 'hand' || a.c.zone === 'deck',
  'The Creator': (g, a) => a.c.zone === 'gy',
  // only by its own rule from the hand; once properly summoned it can be revived. PARTIAL: an effect that Special Summons it from the hand is not stopped.
  'The Rock Spirit': (g, a) => ['deck', 'extra'].includes(a.c.zone) || (['gy', 'ban'].includes(a.c.zone) && !a.c.f16nomi),
  // "Cannot be Special Summoned": the hand is left open for the 3-Tribute summon rule below (it runs as a summon proc).
  // PARTIAL: an effect that Special Summons one of these from the hand is not stopped.
  'The Wicked Avatar': (g, a) => a.c.zone !== 'hand',
  'The Wicked Dreadroot': (g, a) => a.c.zone !== 'hand',
  'The Wicked Eraser': (g, a) => a.c.zone !== 'hand',
};
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: (g) => { if (!g.f16lock) { g.f16lock = true; addRule(g, (g2, a) => { if (a.type !== 'ss' || !a.c) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); } return false; } };
// The Wicked gods: "Cannot be Normal Summoned or Set except by Tributing 3 monsters". The engine reads "Cannot be Normal
// Summoned" from the text and offers no Normal Summon, so this is a summon rule from the hand that uses the Normal Summon,
// Tributes 3 and counts as a Tribute Summon (Solemn Judgment can negate it).
// PARTIAL: it can't be Set this way, and the log line says "Special Summoned".
const wickedProc = { label: 'Tribute Summon (Tribute 3 monsters)', how: 'tribute',
  cond: (g, c, p) => g.ns[p] < 1 && !g.noSummon[p] && tributeCands(g, p).length >= 3 && !forbid(g, { type: 'ns', c, p }),
  cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, `Tribute 3 monsters for ${name(c)}`, tributeCands(g, p), 3, 3, 'cost'); g.ns[p]++;
    for (const x of xs) move(g, x, 'gy', { reason: 'tribute', by: p, group: grp, tributeFor: c.u }); c.tributes = xs.map(x => x.u);
    log(g, `${PN(g, p)} Tributed ${xs.map(x => D(x).n).join(', ')} to Tribute Summon ${name(c)}.`); } };
// the Damage Step battle partner of c
const partner = (g, c) => g.inDS && g.battle ? (g.battle.a === c ? g.battle.t : g.battle.t === c ? g.battle.a : null) : null;
// The Wicked Avatar / Dreadroot read other monsters' ATK; guards against loops
let AV = 0, DR = 0, EH = 0;
const avatarBoost = (g, c) => { if (AV) return 0; AV++; try { let m = 0; for (const x of fieldMons(g)) if (x !== c && faceUp(x) && !named(x, 'The Wicked Avatar')) m = Math.max(m, stat(g, x, 'atk')); return m + 100; } finally { AV--; } };
// Dreadroot halves every other monster; with 2 Dreadroots each halves the other and the rest are quartered: one source does all of it.
const dreadHalf = which => (g, src, m) => {
  if (DR || !onField(m) || m.zone !== 'm' || !faceUp(m)) return 0;
  const ds = fieldMons(g).filter(x => x !== m && faceUp(x) && named(x, 'The Wicked Dreadroot') && !negd(g, x)).sort((a, b) => a.u - b.u);
  if (!ds.length || ds[0] !== src) return 0;
  DR++; let v; try { v = stat(g, m, which); } finally { DR--; }
  const f = 2 ** ds.length; return -(v - Math.floor(v / f));
};
// The Emperor's Holiday: takes back what each face-up Equip Card adds. Only the first copy applies (the rest have nothing left to negate).
// PARTIAL: only ATK/DEF changes are undone (granted flags, control and links of Equip Cards still apply), and the Equip
// Card's shared script is read (a Goat-only Equip script is not seen).
const holidayOff = which => (g, src, m) => {
  if (EH) return 0;
  const hs = allField(g).filter(x => faceUp(x) && named(x, "The Emperor's Holiday")).sort((a, b) => a.u - b.u);
  if (hs[0] !== src) return 0;
  let v = 0; EH++;
  try { for (const x of allField(g)) { if (x.zone !== 'st' || !faceUp(x) || !x.equipTo) continue; const sc = E.SCRIPTS[D(x).n];
    if (sc && sc.cont && !sc.cont.loc && sc.cont[which]) v -= sc.cont[which](g, x, m) || 0;
    if (which === 'atk' && named(x, 'Armory Arm') && x.equipTo === m.u) v -= 1000; } } finally { EH--; }
  return v;
};
// A Trap that answers a moment with no response window in the engine (same as classic-5.js trapTrig): an optional trigger
// while the card is Set (and wasn't Set this turn). It flips the card face-up as a Trap Card activation and goes to the GY after.
// ENGINE: no response window after a monster is destroyed by battle.
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label, tags: o.tags,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });
// The First Sarcophagus: the Sarcophagi it placed (by unique id) live on the First card itself
const sarcCards = (g, c) => (c.f16sarc || []).map(u => allField(g).find(x => x.u === u)).filter(Boolean);
function sarcNext(g, c, p) {
  const have = sarcCards(g, c).map(x => D(x).n);
  const n = !have.includes('The Second Sarcophagus') ? 'The Second Sarcophagus' : !have.includes('The Third Sarcophagus') ? 'The Third Sarcophagus' : null;
  if (!n || freeST(g, p) < 0) return null;
  return [...g.p[p].hand, ...g.p[p].deck].find(x => named(x, n)) || null;
}
// The Dragon's Bead: the highest Trap link on the chain that targets a face-up Dragon (it may chain above other links,
// such as its own flip). Resolved Traps can't be negated (rulings): only links still on the chain are looked at.
const beadLink = g => { for (let i = g.chain.length - 1; i >= 0; i--) { const t = g.chain[i]; if (!t.negated && isTrap(t.c) && !named(t.c, "The Dragon's Bead") && (t.t || []).some(m => onField(m) && m.zone === 'm' && faceUp(m) && race(m) === 'Dragon')) return t; } return null; };
const isDW = x => isMon(x) && D(x).n.includes('Dark World');
const isLV = x => isMon(x) && / LV\d/.test(D(x).n);
const maidenPrey = (g, p) => g.p[p].gy.filter(x => isMon(x) && g.events.some(e => e.type === 'move' && e.c === x && e.turn === g.turnNo && e.battle && e.destroyed && e.to === 'gy' && e.prevCtrl === p));
const plantUp = x => onField(x) && x.zone === 'm' && faceUp(x) && race(x) === 'Plant';
// The World Tree costs
const treeCost = n => function* (g, c, p) { addCtr(g, c, 'flower', -n); log(g, `${PN(g, p)} removed ${n} Flower Counter${n > 1 ? 's' : ''} from The World Tree.`); };

E.addScripts({
  /* ----- Spells and Traps ----- */
  // Cumulative: each copy adds its own 200 per Warrior/Spellcaster (face-up monsters count; a face-down one shows no Type)
  'The A. Forces': { effs: [{ type: 'act', res: noop }],
    cont: { atk: (g, src, m) => m.ctrl === src.ctrl && m.zone === 'm' && faceUp(m) && race(m) === 'Warrior' ? 200 * monsOf(g, src.ctrl).filter(x => faceUp(x) && ['Warrior', 'Spellcaster'].includes(race(x))).length : 0 } },
  'The Beginning of the End': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK').length >= 7,
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Banish 5 DARK monsters from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK'), 5, 5, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${xs.map(name).join(', ')}.`); },
    res: function* (g, c, p) { draw(g, p, 3); } }] },
  // Applied once at resolution to the face-up Beasts then (rulings); not recalculated later.
  'The Big March of Animals': { effs: [{ type: 'act', ds: true, cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Beast'),
    res: function* (g, c, p) { const bs = monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Beast'); const n = 200 * bs.length; if (!n) return;
      for (const x of bs) addMod(g, x, { atk: n, end: true }); log(g, `${PN(g, p)}'s Beasts gained ${n} ATK until the end of the turn.`); } }] },
  'The Cheerful Coffin': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c && isMon(x)),
    res: function* (g, c, p) { const ms = g.p[p].hand.filter(isMon); if (!ms.length) return; const xs = yield* pick(g, p, 'Discard up to 3 monsters from your hand', ms, 1, 3, 'cost');
      for (const x of xs) move(g, x, 'gy', { reason: 'discard', by: p }); if (xs.length) log(g, `${PN(g, p)} discarded ${xs.map(name).join(', ')}.`); } }] },
  'The Dark Door': { effs: [{ type: 'act', res: noop }],
    cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && g.phase === 'battle' && g.events.some(e => e.type === 'attack' && e.turn === g.turnNo && e.a !== a.c) } },
  // Continuous Trap: flipping it does nothing by itself; its effect (discard 1) negates a Trap that targets a face-up Dragon,
  // any number of times. Not in the Damage Step.
  "The Dragon's Bead": { effs: [{ type: 'act', res: noop },
    { type: 'quick', loc: 'st', label: 'Discard 1: negate a Trap targeting a Dragon',
      cond: (g, c, p) => !!beadLink(g) && g.p[p].hand.length > 0,
      cost: function* (g, c, p, L2) { L2.data.L = beadLink(g); yield* discard1(g, p, null, 'Discard 1 card (The Dragon’s Bead)'); },
      res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated || !g.chain.includes(T)) return; T.negBy = p; negate(g, T, true); } }] },
  "The Emperor's Holiday": { effs: [{ type: 'act', res: noop }],
    // the engine drops a negated Equip Card's lasting effects (2026-11-26), so negating the Equips takes their ATK/DEF back
    // an Equip Spell counts by its type too: equip() sets equipTo without a new event, so the engine's cached list of
    // lasting effects could still hold an Equip Spell equipped after the list was built (it stayed +500 under Holiday)
    cont: { negates: (g, src, c) => c.zone === 'st' && (!!c.equipTo || (isSpell(c) && D(c).sub === 'Equip')) } },
  // ENGINE: no revealed-hand state, so the hand is logged when the card resolves and at each check.
  'The Eye of Truth': { effs: [
    { type: 'act', res: function* (g, c, p) { const h = g.p[opp(p)].hand; log(g, `${PN(g, opp(p))}'s hand: ${h.length ? h.map(x => D(x).n).join(', ') : 'empty'}.`); } },
    { type: 'trig', loc: 'st', mand: true, opt: true, label: 'Opponent gains 1000 LP',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl && g.p[ev.tp].hand.some(isSpell),
      res: function* (g, c, p) { const o = opp(p); log(g, `${PN(g, o)}'s hand: ${g.p[o].hand.map(x => D(x).n).join(', ')}.`); if (g.p[o].hand.some(isSpell)) gain(g, o, 1000); } }] },
  // Places the Second, then the Third in each opponent's End Phase. With all 3 out they go to the GY at once and Spirit of
  // the Pharaoh is Special Summoned (no choice, rulings). If one Sarcophagus leaves the field, the rest are sent to the GY.
  'The First Sarcophagus': { effs: [{ type: 'act', res: function* (g, c) { c.f16sarc = []; } },
    { type: 'trig', loc: 'st', mand: true, label: 'Place the next Sarcophagus',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp !== c.ctrl,
      cond: (g, c, p) => !!sarcNext(g, c, p),
      res: function* (g, c, p) {
        if (!onField(c) || !faceUp(c)) return; const x = sarcNext(g, c, p); if (!x) return;
        const fromDeck = x.zone === 'deck'; move(g, x, 'st', { ctrl: p, pos: 'up', reason: 'effect', by: p }); if (fromDeck) shuffleDeck(g, p);
        (c.f16sarc || (c.f16sarc = [])).push(x.u); log(g, `${PN(g, p)} placed ${name(x)} on the field.`);
        const all = [c, ...sarcCards(g, c)];
        if (all.length < 3) return;
        const grp = g.group; for (const y of all) if (onField(y)) move(g, y, 'gy', { reason: 'effect', by: p, group: grp });
        log(g, `${PN(g, p)} sent all 3 Sarcophagus cards to the GY.`);
        const ph = [...g.p[p].hand, ...g.p[p].deck].filter(y => named(y, 'Spirit of the Pharaoh'));
        if (!ph.length || freeM(g, p) < 0) return;
        const [s] = yield* pick(g, p, 'Special Summon Spirit of the Pharaoh', ph, 1, 1, 'good'); const wasDeck = s && s.zone === 'deck';
        if (s) { g.f16pharaoh = true; try { ss(g, p, s, 'atk'); } finally { g.f16pharaoh = false; } if (wasDeck) shuffleDeck(g, p); } } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (ev.type !== 'move' || !ev.wasField || !c.f16sarc || !c.f16sarc.length) return false;
      const mine = ev.c === c ? !!(ev.snap && ev.snap.faceUp) : c.f16sarc.includes(ev.c.u);
      if (!mine) return false;
      for (const y of [c, ...sarcCards(g, c)]) if (y !== ev.c && onField(y)) g.later.push(y);
      if (ev.c === c) c.f16sarc = [];
      return false; } }] },
  'The Second Sarcophagus': { cont: { loc: 'hand', forbid: (g, src, a) => a.type === 'setST' && a.c === src }, effs: [] },
  'The Third Sarcophagus': { cont: { loc: 'hand', forbid: (g, src, a) => a.type === 'setST' && a.c === src }, effs: [] },
  'The Flute of Summoning Dragon': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => lordUp(g) && freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Dragon' && D(x).k !== 'ritual' && !noNS(x) && canSS(g, p, x)),
    res: function* (g, c, p) { if (!lordUp(g)) return; const cs = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Dragon' && D(x).k !== 'ritual' && !noNS(x)); if (!cs.length || freeM(g, p) < 0) return;
      const xs = yield* pick(g, p, 'Special Summon up to 2 Dragons from your hand', cs, 1, Math.min(2, nFreeM(g, p)), 'good'); for (const x of xs) ss(g, p, x, 'atk'); } }] },
  'The Flute of Summoning Kuriboh': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'Kuriboh') || named(x, 'Winged Kuriboh')),
    res: function* (g, c, p) {
      const cs = g.p[p].deck.filter(x => named(x, 'Kuriboh') || named(x, 'Winged Kuriboh')); if (!cs.length) return;
      const [x] = yield* pick(g, p, 'Take Kuriboh or Winged Kuriboh from your Deck', cs, 1, 1, 'good'); if (!x) return;
      const canS = freeM(g, p) >= 0 && canSS(g, p, x), canH = !forbid(g, { type: 'search', p });
      let summon = canS && !canH;
      if (canS && canH) summon = (yield* choose(g, p, `${name(x)}: add it to your hand or Special Summon it?`, ['Add to hand', 'Special Summon'])) === 1;
      if (summon) ss(g, p, x, 'def'); else if (canH) { move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(x)} from the Deck to the hand.`); }
      shuffleDeck(g, p); } }] },
  'The Forceful Sentry': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length > 0,
    res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; log(g, `${PN(g, p)} looked at ${PN(g, opp(p))}'s hand: ${h.map(x => D(x).n).join(', ')}.`);
      const [x] = yield* pick(g, p, 'Return which card to the Deck?', h, 1, 1, 'bad'); if (x) { move(g, x, 'deck', { reason: 'effect', by: p }); log(g, `${name(x)} was shuffled into the Deck.`); } } }] },
  'The Forces of Darkness': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.filter(isDW).length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which 2 Dark World monsters to your hand?', g.p[p].gy.filter(isDW), 2, 2, 'good'); },
    res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'hand', { reason: 'effect' }); if (xs.length) log(g, `${PN(g, p)} added ${xs.map(name).join(' and ')} to the hand.`); } }] },
  'The Gift of Greed': { effs: [{ type: 'act', res: function* (g, c, p) { draw(g, opp(p), 2); } }] },
  // "You and your opponent each select 1 monster ... Special Summon them in Defense Position", locked in position except by effects.
  'The Grave of Enkindling': { effs: [trapTrig({ label: 'Each player revives a monster', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && ev.wasField && ev.prevCtrl === c.ctrl && isMon(ev.c),
    cond: (g, c, p) => [p, opp(p)].some(q => freeM(g, q) >= 0 && g.p[q].gy.some(x => isMon(x) && canSS(g, q, x))),
    res: function* (g, c, p) {
      if (!g.f16enk) { g.f16enk = true; addRule(g, (g2, a) => a.type === 'pos' && a.c && !!a.c.flags.f16enk); }
      for (const q of [p, opp(p)]) { const ms = g.p[q].gy.filter(x => isMon(x) && canSS(g, q, x)); if (!ms.length || freeM(g, q) < 0) continue;
        const [x] = yield* pick(g, q, 'Special Summon which monster from your GY in Defense Position?', ms, 1, 1, 'good'); if (x && ss(g, q, x, 'def')) x.flags.f16enk = true; } } })] },
  'The Graveyard in the Fourth Dimension': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.filter(isLV).length >= 2,
    res: function* (g, c, p) { const ls = g.p[p].gy.filter(isLV); if (ls.length < 2) return; const xs = yield* pick(g, p, 'Return which 2 LV monsters to your Deck?', ls, 2, 2, 'cost');
      for (const x of xs) move(g, x, 'deck', { reason: 'effect', by: p }); shuffleDeck(g, p); log(g, `${PN(g, p)} shuffled ${xs.map(name).join(' and ')} into the Deck.`); } }] },
  'The Inexperienced Spy': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length > 0,
    res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const [x] = yield* pick(g, p, 'Look at which card in your opponent’s hand?', h, 1, 1, 'bad');
      if (x) log(g, `${PN(g, p)} looked at a card in ${PN(g, opp(p))}'s hand: ${D(x).n}.`); } }] },
  // Activated only while 5 face-up Level 2 or lower Normal Monsters (Tokens too) are out; not checked again at resolution.
  'The Law of the Normal': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).filter(x => faceUp(x) && ['normal', 'token'].includes(D(x).k) && lv(x) <= 2).length >= 5,
    res: function* (g, c, p) {
      for (const q of [p, opp(p)]) { const h = g.p[q].hand.slice(); for (const x of h) move(g, x, 'gy', { reason: 'discard', by: p }); if (h.length) log(g, `${PN(g, q)} discarded ${h.length} card${h.length > 1 ? 's' : ''}.`); }
      destroy(g, allField(g).filter(x => x !== c && !(isMon(x) && ['normal', 'token'].includes(D(x).k) && lv(x) <= 2)), { by: p, src: c }); } }] },
  // PARTIAL: cards "treated as" the same name (Harpie Lady 1 to 3) aren't matched; the name on the field is used.
  'The League of Uniform Nomenclature': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && monsOf(g, p).some(x => faceUp(x) && D(x).k === 'normal' && lv(x) <= 2),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which Normal Monster?', monsOf(g, p).filter(x => faceUp(x) && D(x).k === 'normal' && lv(x) <= 2), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t) return; const n = onField(t) ? name(t) : D(t).n; const xs = g.p[p].deck.filter(x => D(x).n === n);
      let k = 0; for (const x of xs) { if (freeM(g, p) < 0) break; if (ss(g, p, x, 'atk')) k++; } shuffleDeck(g, p); if (!k) log(g, `${PN(g, p)} had no copies to summon.`); } }] },
  // PARTIAL: the Des Gardius half (an Equip Card that takes control) is up to Masked Beast Des Gardius's own script.
  'The Mask of Remnants': { effs: [{ type: 'act',
    res: function* (g, c, p) { if (onField(c)) { move(g, c, 'deck', { reason: 'effect', by: p }); log(g, 'The Mask of Remnants was shuffled into the Deck.'); } } }] },
  'The Paths of Destiny': { effs: [{ type: 'act',
    res: function* (g, c, p) { const losers = [];
      for (const q of [p, opp(p)]) { if (coin(g, q)) gain(g, q, 2000); else losers.push(q); }
      if (losers.length === 2) bothDamage(g, 2000, c, p); else for (const q of losers) damage(g, q, 2000, { src: c, srcP: p }); } }] },
  // The Fiend is selected at activation; the monsters to banish are chosen at resolution (not a cost, rulings).
  'The Puppet Magic of Dark Ruler': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && race(x) === 'Fiend' && canSS(g, p, x) && lvSets(monsOf(g, p), lv(x), 1).length),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which Fiend in your GY?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Fiend' && canSS(g, p, x) && lvSets(monsOf(g, p), lv(x), 1).length), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy') return; const sets = lvSets(monsOf(g, p), lv(t)); if (!sets.length) return;
      let s = sets[0]; if (sets.length > 1) s = sets[yield* choose(g, p, `Banish which monsters (Levels totaling ${lv(t)})?`, sets.map(m => m.map(x => `${x.pos === 'set' ? 'face-down ' + D(x).n : name(x)} (Lv ${lv(x)})`).join(' + ')))];
      const grp = g.group; for (const x of s) move(g, x, 'ban', { reason: 'effect', by: p, group: grp }); log(g, `${PN(g, p)} banished ${s.map(x => D(x).n).join(', ')}.`);
      if (t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  'The Regulation of Tribe': { effs: [{ type: 'act',
    res: function* (g, c, p) { if (!onField(c)) return; const i = yield* choose(g, p, 'Declare a Type of monster', TYPES); c.flags.f16type = TYPES[i]; log(g, `${PN(g, p)} declared ${TYPES[i]}: those monsters can't attack.`); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Tribute 1 monster or destroy this card',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; const ms = monsOf(g, p);
        if (ms.length && (yield* yn(g, p, 'Tribute 1 monster to keep The Regulation of Tribe?'))) { const [x] = yield* pick(g, p, 'Tribute which monster?', ms, 1, 1, 'cost'); if (x) { tribute(g, p, x, 'for The Regulation of Tribe'); return; } }
        destroy(g, [c], { rule: true }); } }],
    cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && !!src.flags.f16type && race(a.c) === src.flags.f16type } },
  'The Reliable Guardian': { effs: [{ type: 'act', ds: true, cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which face-up monster gains 700 DEF?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { def: 700, end: true }); log(g, `${name(t)} gained 700 DEF until the end of the turn.`); } } }] },
  'The Sanctuary in the Sky': { effs: [{ type: 'act', res: noop }],
    cont: { dmg: (g, src, p, n, o) => o && o.battle && g.battle && [g.battle.a, g.battle.t].some(m => m && onField(m) && m.ctrl === p && faceUp(m) && race(m) === 'Fairy') ? 0 : undefined } },
  // Each time the selected monster deals battle damage to the activator's opponent this turn, they discard 1 at random
  // (one discard per hit, however many copies, rulings). The watch is kept by this card in the GY.
  'The Secret of the Bandit': { effs: [{ type: 'act', cond: g => g.phase === 'main1' && fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; if (!(t.flags.f16bandit && t.flags.f16bandit.turn === g.turnNo && t.flags.f16bandit.p === p)) t.flags.f16bandit = { p, turn: g.turnNo, u: c.u }; log(g, `${name(t)} is now The Secret of the Bandit's monster this turn.`); } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Opponent discards at random',
      on: (g, ev, c) => { if (ev.type !== 'damage' || !ev.battle || !ev.src) return false; const b = ev.src.flags && ev.src.flags.f16bandit; return !!b && b.u === c.u && b.turn === g.turnNo && ev.p === opp(b.p); },
      res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, opp(p))} discarded ${name(x)} at random.`); } }] },
  'The Selection': { effs: [{ type: 'act', negSummon: true,
    cond: (g, c, p, x) => !x.top && !!g.attempt && g.p[p].lp > 1000 && g.attempt.cs.some(s => fieldMons(g).some(m => !g.attempt.cs.includes(m) && faceUp(m) && race(m) === race(s))),
    cost: function* (g, c, p) { pay(g, p, 1000); },
    res: function* (g) { if (g.attempt) { g.attempt.negated = true; log(g, 'The summon was negated.'); } } }] },
  // Each player targets 1 monster in their own GY (both need one and a free zone, rulings), then both are Set.
  'The Shallow Grave': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => [p, opp(p)].every(q => freeM(g, q) >= 0 && g.p[q].gy.some(x => isMon(x) && canSS(g, q, x))),
    target: function* (g, c, p, L2) { const t = [];
      for (const q of [p, opp(p)]) { const [x] = yield* pick(g, q, 'Target 1 monster in your GY (The Shallow Grave)', g.p[q].gy.filter(x => isMon(x) && canSS(g, q, x)), 1, 1, 'good'); if (x) t.push(x); }
      L2.t = t; },
    res: function* (g, c, p, L2) { for (const x of L2.t) if (x.zone === 'gy') ss(g, x.owner, x, 'set'); } }] },
  'The Spell Absorbing Life': { effs: [{ type: 'act',
    cond: g => fieldMons(g).some(x => x.pos === 'set' || (faceUp(x) && isEffMon(x))),
    res: function* (g, c, p) {
      const fd = fieldMons(g).filter(x => x.pos === 'set'); for (const x of fd) { x.pos = 'def'; } if (fd.length) { g.seq++; log(g, `${fd.map(name).join(', ')} ${fd.length > 1 ? 'were' : 'was'} flipped face-up.`); }
      const n = fieldMons(g).filter(x => faceUp(x) && isEffMon(x)).length; if (n) gain(g, p, 400 * n); } }] },
  'The Warrior Returning Alive': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && race(x) === 'Warrior'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Warrior from your GY to your hand?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Warrior'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy') return; const ex = isExtraD(D(t)); move(g, t, ex ? 'extra' : 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} returned ${name(t)} to the ${ex ? 'Extra Deck' : 'hand'}.`); } }] },
  // Counters go on as Plants are destroyed (no chain). Each removal is its own Ignition Effect, and each one targets.
  'The World Tree': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
      if (ev.type === 'move' && ev.destroyed && ev.wasField && ev.snap && ev.snap.mon && ev.snap.faceUp && ev.snap.race === 'Plant' && ev.c !== c && faceUp(c)) { addCtr(g, c, 'flower', 1); log(g, `A Flower Counter was placed on The World Tree (${ctr(c, 'flower')}).`); }
      return false; } },
    { type: 'ign', loc: 'st', label: '1 counter: a Plant gains 400 ATK/DEF', cond: (g, c) => ctr(c, 'flower') >= 1 && fieldMons(g).some(plantUp), cost: treeCost(1),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Plant gains 400 ATK and DEF?', fieldMons(g).filter(plantUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && plantUp(t)) { addMod(g, t, { atk: 400, def: 400, end: true }); log(g, `${name(t)} gained 400 ATK and DEF.`); } } },
    { type: 'ign', loc: 'st', tags: { destroy: 1 }, label: '2 counters: destroy a card', cond: (g, c) => ctr(c, 'flower') >= 2 && allField(g).length > 0, cost: treeCost(2),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', allField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } },
    { type: 'ign', loc: 'st', tags: { ss: 1 }, label: '3 counters: revive a Plant', cond: (g, c, p) => ctr(c, 'flower') >= 3 && freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && race(x) === 'Plant' && canSS(g, p, x)), cost: treeCost(3),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Plant from your GY?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Plant' && canSS(g, p, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },

  /* ----- Monsters ----- */
  'The Big Saturn': { effs: [lockInstall,
    { type: 'ign', opt: true, label: 'Discard 1 and pay 1000: +1000 ATK', cond: (g, c, p) => g.p[p].hand.length > 0 && g.p[p].lp > 1000,
      cost: function* (g, c, p) { yield* discard1(g, p, null); pay(g, p, 1000); },
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 1000, end: true }); log(g, `${name(c)} gained 1000 ATK until the End Phase.`); } } },
    // only while its owner controls it (rulings); the damage is its original ATK
    { type: 'trig', loc: 'gy', mand: true, label: 'Both players take 2800 damage',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && ev.wasField && ev.destroyed && !ev.battle && ev.by === opp(c.owner) && ev.prevCtrl === c.owner,
      res: function* (g, c, p) { bothDamage(g, L.num(D(c).atk), c, p); } }] },
  'The Bistro Butcher': { effs: [{ type: 'trig', mand: true, label: 'Opponent draws 2',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p === opp(c.ctrl),
    res: function* (g, c, p) { draw(g, opp(p), 2); } }] },
  // not its original ATK (rulings); counts itself
  'The Calculator': { self: { atk: (g, c) => 300 * monsOf(g, c.ctrl).filter(faceUp).reduce((s, x) => s + lv(x), 0) } },
  // "Target 1 monster in your GY; send 1 card from your hand to the GY, and if you do, Special Summon that target."
  // The send is part of the effect (rulings). PARTIAL: flipping it face-down and up again doesn't reset its once per turn.
  'The Creator': { effs: [lockInstall,
    { type: 'ign', opt: true, tags: { ss: 1 }, label: 'Send a card: revive a monster',
      cond: (g, c, p) => g.p[p].hand.length > 0 && freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && canSS(g, p, x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which monster in your GY?', g.p[p].gy.filter(x => isMon(x) && canSS(g, p, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy' || !g.p[p].hand.length) return;
        const [x] = yield* pick(g, p, 'Send 1 card from your hand to the GY', g.p[p].hand, 1, 1, 'cost'); if (!x) return;
        move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`);
        if (t.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, t, 'atk'); } }] },
  'The Creator Incarnate': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Tribute: summon The Creator',
    cond: (g, c, p) => g.p[p].hand.some(x => named(x, 'The Creator') && canSS(g, p, x)),
    cost: function* (g, c, p) { tribute(g, p, c); },
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => named(x, 'The Creator')); if (!cs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon The Creator from your hand', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  // Counters go on in each Standby Phase (no chain); the count is kept in its flags so it can be read after it leaves.
  'The Dragon Dwelling in the Deep': { effs: [
    { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'standby') { addCtr(g, c, 'ocean', 1); c.flags.f16ocean = (c.flags.f16ocean || 0) + 1; log(g, `An Ocean Counter was placed on ${name(c)} (${c.flags.f16ocean}).`); } return false; } },
    { type: 'trig', loc: 'any', mand: true, label: 'Fish and Sea Serpents gain ATK',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.faceUp && ev.snap.flags && ev.snap.flags.f16ocean > 0,
      res: function* (g, c, p, L2) { const ev = L2.ev; const n = (ev && ev.snap.flags.f16ocean) || 0; const q = ev ? ev.prevCtrl : p; if (!n) return;
        const ms = monsOf(g, q).filter(x => faceUp(x) && ['Fish', 'Sea Serpent'].includes(race(x))); for (const x of ms) addMod(g, x, { atk: 200 * n, end: true });
        if (ms.length) log(g, `${PN(g, q)}'s Fish and Sea Serpent monsters gained ${200 * n} ATK.`); } }] },
  'The Fiend Megacyber': { proc: { label: 'Special Summon (they control 2 more monsters)', cond: (g, c, p) => monsOf(g, opp(p)).length >= monsOf(g, p).length + 2 } },
  // Ignition: Tribute it, then this turn 1 of your monsters destroyed by battle returns to the hand (now, if one already was,
  // or the next one, like Last Will).
  'The Forgiving Maiden': { effs: [{ type: 'ign', label: 'Tribute: return a monster destroyed by battle',
    cost: function* (g, c, p) { tribute(g, p, c); },
    res: function* (g, c, p) {
      const xs = maidenPrey(g, p);
      if (xs.length) { const [x] = yield* pick(g, p, 'Return which monster to your hand?', xs, 1, 1, 'good'); if (x) { move(g, x, isExtraD(D(x)) ? 'extra' : 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} returned ${name(x)} to the hand.`); } return; }
      c.f16maiden = g.turnNo; log(g, `${PN(g, p)}'s next monster destroyed by battle this turn returns to the hand.`); } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Return the destroyed monster',
      on: (g, ev, c) => c.f16maiden === g.turnNo && ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && ev.prevCtrl === c.owner && isMon(ev.c),
      res: function* (g, c, p, L2) { const x = L2.ev && L2.ev.c; c.f16maiden = null; if (x && x.zone === 'gy') { move(g, x, isExtraD(D(x)) ? 'extra' : 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} returned ${name(x)} to the hand.`); } } }] },
  'The Hunter with 7 Weapons': { self: { atk: (g, c) => { const t = partner(g, c); return t && c.flags.f16type && race(t) === c.flags.f16type ? 1000 : 0; } },
    effs: [{ type: 'trig', mand: true, label: 'Declare a Type', on: (g, ev, c) => evSummoned(ev, c, ['normal']),
      res: function* (g, c, p) { if (!onField(c)) return; const i = yield* choose(g, p, 'Declare a Type of monster', TYPES); c.flags.f16type = TYPES[i]; log(g, `${PN(g, p)} declared ${TYPES[i]}.`); } }] },
  // the owner loses 5000 only if it was face-up (rulings)
  'The Immortal of Thunder': { effs: [
    { type: 'trig', mand: true, label: 'Gain 3000 LP', on: (g, ev, c) => ev.type === 'flip' && ev.c === c, res: function* (g, c, p) { gain(g, p, 3000); } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Lose 5000 LP', on: (g, ev, c) => fromFieldToGY(ev, c) && !!ev.snap && ev.snap.faceUp,
      res: function* (g, c) { loseLP(g, c.owner, 5000); } }] },
  // PARTIAL: "appropriate" isn't checked (the engine doesn't know each Equip Spell's legal targets).
  'The Kick Man': { effs: [{ type: 'trig', when: true, label: 'Equip an Equip Spell from your GY',
    on: (g, ev, c) => evSummoned(ev, c, ['special', 'fusion', 'synchro', 'ritual']),
    cond: (g, c, p) => freeST(g, p) >= 0 && g.p[p].gy.some(x => isSpell(x) && D(x).sub === 'Equip'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip which Equip Spell from your GY?', g.p[p].gy.filter(x => isSpell(x) && D(x).sub === 'Equip'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy' || !onField(c) || !faceUp(c) || freeST(g, p) < 0) return; move(g, t, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p }); equip(g, t, c); g.seq++; } }] },
  // ENGINE: its name doesn't become "Skull Servant" in the GY (name() can't be changed by a script).
  // ENGINE: destroy() handles cards one by one, so a Dark Hole that also destroys the Lady protects only the Zombies checked
  // before her (in zone order); the Zombies should all be unaffected.
  'The Lady in Wight': { cont: { grant: (g, src, c, flag) => ['noBattleDestroy', 'unaffectedSpells', 'unaffectedTraps'].includes(flag) && c.zone === 'm' && faceUp(c) && race(c) === 'Zombie' && lv(c) <= 3 && !named(c, 'The Lady in Wight') } },
  // Sets are still allowed (a Set is not a Summon). PARTIAL: Flip Summons aren't stopped (no forbid action for a Flip Summon).
  'The Last Warrior from Another Planet': { cont: { forbid: (g, src, a) => a.type === 'ns' || a.type === 'ss' },
    effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy your other monsters',
      on: (g, ev, c) => evSummoned(ev, c, ['special', 'fusion', 'ritual', 'synchro']),
      res: function* (g, c, p) { const xs = monsOf(g, p).filter(x => x !== c); if (xs.length) destroy(g, xs, { by: p }); } }] },
  // PARTIAL: "unaffected by Spell effects" covers destruction only (the engine's unaffectedSpells flag).
  'The Legendary Fisherman': { self: { unaffectedSpells: g => umiOn(g), noAttackTarget: g => umiOn(g) } },
  'The Little Swordsman of Aile': { effs: [{ type: 'ign', label: 'Tribute 1: +700 ATK', cond: (g, c, p) => monsOf(g, p).some(x => x !== c),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p).filter(x => x !== c), 1, 1, 'cost'); if (x) tribute(g, p, x); },
    res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 700, end: true }); log(g, `${name(c)} gained 700 ATK until the end of the turn.`); } } }] },
  // Ritual Monster: Curse of the Masked Beast (scripted in full-04.js) summons it.
  'The Masked Beast': { effs: [] },
  'The Rock Spirit': { self: { atk: (g, c) => g.phase === 'battle' && g.tp !== c.ctrl ? 300 : 0 },
    proc: { label: 'Special Summon (banish an EARTH from your GY)',
      cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'EARTH'),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish 1 EARTH monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'EARTH'), 1, 1, 'cost');
        if (x) { move(g, x, 'ban', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} banished ${name(x)}.`); } c.flags.f16proc = true; } },
    effs: [lockInstall, { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'summon' && ev.cs.includes(c) && c.flags.f16proc) c.f16nomi = true; return false; } }] },
  'The Stern Mystic': { effs: [{ type: 'trig', mand: true, label: 'Reveal all face-down cards', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g) { const fd = allField(g).filter(x => x.pos === 'set'); log(g, fd.length ? `The face-down cards were revealed: ${fd.map(x => D(x).n).join(', ')}.` : 'There were no face-down cards to reveal.'); } }] },
  // works even if it was destroyed face-down (rulings); a Special Summon-only monster can't be summoned
  'The Thing in the Crater': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon a Pyro from your hand',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Pyro' && !noNS(x) && D(x).k !== 'ritual' && canSS(g, p, x)),
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Pyro' && !noNS(x) && D(x).k !== 'ritual'); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which Pyro from your hand?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  'The Tricky': { proc: { label: 'Special Summon (discard 1 card)', cond: (g, c, p) => g.p[p].hand.some(x => x !== c),
    cost: function* (g, c, p) { yield* discard1(g, p, c); } } },
  // ENGINE: Tribute counts are fixed in the engine (same as Double Coston, batch-6.js). Closest: Tribute this card alone to
  // Tribute Summon a Level 7 or higher EARTH from your hand (your Normal Summon). This summon has no Solemn Judgment window.
  'The Trojan Horse': { effs: [{ type: 'ign', label: 'Tribute as 2: summon an EARTH',
    cond: (g, c, p) => g.ns[p] < 1 && !g.noSummon[p] && g.p[p].hand.some(x => isMon(x) && attr(x) === 'EARTH' && lv(x) >= 7 && !noNS(x) && !isExtraD(D(x)) && D(x).k !== 'ritual' && !forbid(g, { type: 'ns', c: x, p })),
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Tribute Summon which EARTH monster?', g.p[p].hand.filter(x => isMon(x) && attr(x) === 'EARTH' && lv(x) >= 7 && !noNS(x) && !isExtraD(D(x)) && D(x).k !== 'ritual'), 1, 1, 'good');
      L2.data.x = x; g.ns[p]++; move(g, c, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed The Trojan Horse as 2 Tributes.`); },
    res: function* (g, c, p, L2) { const x = L2.data.x; if (!x || x.zone !== 'hand' || freeM(g, p) < 0) return; const grp = g.group;
      move(g, x, 'm', { ctrl: p, pos: 'atk', reason: 'summon', group: grp }); x.summonType = 'tribute'; x.tributes = [c.u]; x.attacks = 0;
      log(g, `${PN(g, p)} Tribute Summoned ${name(x)}.`);
      const ev = emit(g, { type: 'summon', cs: [x], how: 'tribute', p, tribs: [c] }, grp); g.sw = { cs: [x], p, how: 'tribute', group: ev.group }; } }] },
  'The Unfriendly Amazon': { effs: [{ type: 'trig', mand: true, label: 'Tribute 1 monster or be destroyed',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    res: function* (g, c, p) {
      if (!onField(c)) return;
      const cs = monsOf(g, p).filter(x => x !== c);
      if (cs.length && (yield* yn(g, p, 'Tribute 1 other monster to keep The Unfriendly Amazon?'))) {
        const [x] = yield* pick(g, p, 'Tribute which monster?', cs, 1, 1, 'cost');
        if (x) { tribute(g, p, x, 'for The Unfriendly Amazon'); return; }
      }
      destroy(g, [c], { rule: true }); } }] },
  // In Attack Position it isn't destroyed by battle; a monster that battled it (damage calculation was reached) can't
  // attack or change position by hand while she stays in Attack Position. Turning her face-down resets the list.
  'The Unhappy Girl': { self: { noBattleDestroy: (g, c) => c.pos === 'atk' },
    cont: { forbid: (g, src, a) => (a.type === 'attack' || a.type === 'pos') && a.c && src.pos === 'atk' && (src.flags.f16girl || []).includes(a.c.u) },
    effs: [{ type: 'trig', res: noop, on: (g, ev, c) => {
      if (ev.type === 'afterCalc' && (ev.a === c || ev.t === c) && c.pos === 'atk') { const o = ev.a === c ? ev.t : ev.a; if (o) (c.flags.f16girl || (c.flags.f16girl = [])).push(o.u); }
      return false; } }] },
  'The Unhappy Maiden': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'End the Battle Phase',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
    res: function* (g) { if (g.phase === 'battle') endBattle(g); } }] },
  // "Your opponent can't activate Spell or Trap Cards until the end of their 2nd turn after this card is Normal Summoned."
  'The Wicked Avatar': { proc: wickedProc,
    self: { atk: avatarBoost, def: avatarBoost },
    effs: [lockInstall, { type: 'trig', res: noop, on: (g, ev, c) => {
      if (evSummoned(ev, c, ['tribute', 'normal']) && ev.p === c.ctrl) { const o = opp(ev.p);
        addRule(g, (g2, a) => a.type === 'activate' && a.p === o && a.c && isST(a.c) && a.eff && a.eff.type === 'act', { end: g.turnNo + 3 });
        log(g, `${PN(g, o)} can't activate Spell or Trap Cards until the end of their 2nd turn from now.`); }
      return false; } }] },
  'The Wicked Dreadroot': { proc: wickedProc, cont: { atk: dreadHalf('atk'), def: dreadHalf('def') }, effs: [lockInstall] },
  'The Wicked Eraser': { proc: wickedProc,
    self: { atk: (g, c) => 1000 * fieldOf(g, opp(c.ctrl)).length, def: (g, c) => 1000 * fieldOf(g, opp(c.ctrl)).length },
    effs: [lockInstall,
      { type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy all cards on the field',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy',
        res: function* (g, c, p) { const xs = allField(g); if (xs.length) destroy(g, xs, { by: p }); } },
      { type: 'ign', tags: { destroy: 1 }, label: 'Destroy this card', res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  'The Wicked Worm Beast': { effs: [{ type: 'trig', mand: true, label: 'Return to the hand', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
    res: function* (g, c) { if (onField(c) && faceUp(c) && c.zone === 'm') { move(g, c, 'hand', { reason: 'effect' }); log(g, 'The Wicked Worm Beast returned to the hand.'); } } }] },
});
})();
