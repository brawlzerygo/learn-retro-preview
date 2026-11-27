/* Full pool batch 17: The Agent of Creation - Venus to Ultimate Tyranno (build/batches/full/full-17.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings.
 Cards with a Goat-only script elsewhere (Thousand Dragon, Thousand Knives, Thousand-Eyes Restrict, Thunder Dragon,
 Time Seal, Time Wizard, Toon Cannon Soldier, Toon Mermaid, Toon Table of Contents, Toon World, Tornado Wall,
 Twin-Headed Thunder Dragon) are ported here as the shared version. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, pay, search, negate, addMod, equip, equippedTo,
  negateAttack, addRule, fusionRecipe, coin, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv,
  monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, shuffleDeck, log, PN, has, live, opp, oppFaceUp, stOnField,
  spellTrapAct, evSummoned, tributeCands, isExtraD, emit, forbid, negd, stat } = L;
const atk = L.atk, def = L.def;

/* ----- helpers for this batch ----- */
const named = (c, ...ns) => ns.includes(D(c).n);
const noop = function* () {};
const txt = c => { const d = D(c); return d.ps && !/^No (?:Edison|rulings)/.test(d.ps) ? d.ps : d.tx || ''; };
const sanctuary = (g, p) => stOf(g, p).some(x => faceUp(x) && named(x, 'The Sanctuary in the Sky'));
const lpDiff = (g, p) => g.p[p].lp - g.p[opp(p)].lp;
const isNormalMon = c => isMon(c) && D(c).k === 'normal';
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'atk' }); };
const discardRandom = (g, p) => { const h = g.p[p].hand; if (!h.length) return null; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)} at random.`); return x; };
function* discardPick(g, p, n, text, not) { const h = g.p[p].hand.filter(x => x !== not); if (!h.length) return []; const xs = yield* pick(g, p, text, h, Math.min(n, h.length), Math.min(n, h.length), 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'discard' }); if (xs.length) log(g, `${PN(g, p)} discarded ${xs.map(name).join(', ')}.`); return xs; }
function* tributeOne(g, p, text, cands) { const [x] = yield* pick(g, p, text, cands || monsOf(g, p), 1, 1, 'cost'); if (!x) return null; const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); return x; }
// where a monster last came to the field from
function cameFrom(g, x) { for (let i = g.events.length - 1; i >= 0; i--) { const e = g.events[i]; if (e.type === 'move' && e.c === x && e.to === 'm') return e.from; } return null; }
// Does this card's effect inflict effect damage? (read from its text; battle damage doesn't count)
const dmgText = c => /inflict[^.]*damage|damage[^.]*(?:to your opponent|to you\b|to each player|to both players|to its controller|to the controller)|takes? [^.]*damage/i.test(txt(c).replace(/(?:piercing )?battle damage/gi, ''));
// A plain monster nothing special restricts, to test general Special Summon locks without a card's own conditions.
const PLAIN = 'Mystical Shine Ball';
// Special Summon "ignoring its Summoning conditions": the summon locks on the player still count, the card's own don't.
function ssIgnoring(g, p, c, pos = 'atk') {
  if (freeM(g, p) < 0) return false;
  const plain = E.cards().find(x => x.n === PLAIN);
  if (forbid(g, { type: 'ss', c: { ...c, id: plain ? plain.id : c.id, flags: {} }, p, how: 'special' })) { log(g, `${name(c)} can’t be Special Summoned right now.`); return false; }
  const grp = g.group;
  move(g, c, 'm', { ctrl: p, pos, reason: 'summon', group: grp }); c.summonType = 'special'; c.attacks = 0;
  log(g, `${PN(g, p)} Special Summoned ${name(c)}${pos === 'def' ? ' in Defense Position' : ''}.`);
  const ev = emit(g, { type: 'summon', cs: [c], how: 'special', p, byEffect: true }, grp);
  g.sw = { cs: [c], p, how: 'special', group: ev.group };
  return true;
}

/* Summon locks, one duel-long rule put in by the first event any of these cards sees.
 ENGINE: no general "can't be Special Summoned" flag; these are the closest versions. */
const LOCKS = {
  // PARTIAL: "only by its own procedure": any Special Summon from the hand is allowed.
  'Thousand-Eyes Jellyfish': a => a.c.zone !== 'hand',
  'Trap Eater': a => a.c.zone !== 'hand',
  // Must be Fusion Summoned; the rulings say it can't be revived from the GY or banishment either.
  'Ultimate Ancient Gear Golem': a => a.how !== 'fusion',
};
const lockEff = { type: 'trig', loc: 'any', res: noop, on: (g) => {
  if (!g.f17lock) { g.f17lock = true; addRule(g, (g2, a) => a.type === 'ss' && a.c && a.c.id != null && D(a.c) && LOCKS[D(a.c).n] && LOCKS[D(a.c).n](a)); }
  return false; } };

/* "The effects of the monster this card destroys are negated" (Ultimate Obedient Fiend, Twin-Headed Wolf).
 On the field: the doomed monster is negated before its Flip effect or on-field triggers can activate (afterCalc comes
 before the Flip event). In the GY: a duel-long rule stops its activations for the rest of that turn. */
const negRule = g => { if (!g.f17neg) { g.f17neg = true; addRule(g, (g2, a) => a.type === 'activate' && a.c && a.c.flags && a.c.flags.f17neg === g2.turnNo && !onField(a.c)); } };
function battleNegator(test, gyToo) {
  return { type: 'trig', res: noop, on: (g, ev, c) => {
    if (ev.type === 'afterCalc' && (ev.a === c || ev.t === c)) { const o = ev.a === c ? ev.t : ev.a; if (o && onField(o) && o.flags.battleDoomed && test(g, c, o)) { o.flags.negated = true; c.flags.f17kill = o.u; } }
    if (gyToo && ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.c.u === c.flags.f17kill && ev.to !== 'm') { negRule(g); ev.c.flags.f17neg = g.turnNo; }
    return false; } };
}

/* Traps that answer a moment with no response window in the engine (a battle destruction, a Standby Phase):
 a trigger that only fires while the card is Set (and wasn't Set this turn). It flips the card face-up, counts as a
 Trap Card activation at Spell Speed 2, and sends the card to the GY after it resolves (as classic-5.js).
 ENGINE: no response window after a battle destruction or in the Standby Phase. */
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });

/* ----- Toons ----- */
const isToon = c => /Toon/.test(D(c).ab || '') || /treated as a "Toon" card/.test(D(c).tx || '');
const toonWorld = (g, p) => stOf(g, p).some(x => faceUp(x) && named(x, 'Toon World'));
const oppToon = (g, c) => monsOf(g, opp(c.ctrl)).some(x => faceUp(x) && isToon(x));
const toonDies = { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroyed with Toon World',
  on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.destroyed && named(ev.c, 'Toon World') && ev.prevCtrl === c.ctrl,
  res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } };
// Special Summon Toons (Toon Mermaid style): from the hand by Tributing n monsters while you control Toon World;
// o.noWait / o.noCost for the ones whose text has no "can't attack that turn" / 500 LP attack cost.
function toonSS(n, o = {}) {
  return {
    proc: { label: n ? `Special Summon (Tribute ${n}, Toon World)` : 'Special Summon (Toon World)',
      cond: (g, c, p) => toonWorld(g, p) && tributeCands(g, p).length >= n,
      cost: n ? function* (g, c, p, grp) { const xs = yield* pick(g, p, `Tribute ${n} monster${n > 1 ? 's' : ''}`, tributeCands(g, p), n, n, 'cost');
        for (const x of xs) move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${xs.map(x => x.pos === 'set' ? 'a face-down monster' : name(x)).join(' and ')}.`); } : null },
    self: {
      ...(o.noWait ? {} : { cantAttack: (g, c) => c.turnIn === g.turnNo }),
      ...(o.noCost ? {} : { attackCost: () => 500 }),
      directAttack: (g, c) => !oppToon(g, c),
      attackOk: (g, c, t) => !oppToon(g, c) || (faceUp(t) && isToon(t)),
      ...(o.self || {}),
    },
    effs: [toonDies, ...(o.effs || [])],
  };
}
// Normal-Summonable Toons: can't attack the turn they are Summoned; direct attacks while you control Toon World and the
// opponent controls no Toons.
function toonN(o = {}) {
  return { ...o,
    self: { cantAttack: (g, c) => c.turnIn === g.turnNo, directAttack: (g, c) => toonWorld(g, c.ctrl) && !oppToon(g, c), ...(o.self || {}) },
    effs: [toonDies, ...(o.effs || [])] };
}
// "If this card attacks, it is changed to Defense Position at the end of the Battle Phase. Its battle position can't be
// changed until the End Phase of your next turn." (as full-08.js Goblin Attack Force)
const goblinLock = (more = {}) => ({ ...more,
  cont: { ...(more.cont || {}), forbid: (g, src, a) => a.type === 'pos' && a.c === src && src.flags.gobLock >= g.turnNo },
  effs: [{ type: 'trig', res: noop, on: (g, ev, c) => {
    if (ev.type === 'dsStart' && ev.a === c) c.flags.gobAtk = g.turnNo;
    if (ev.type === 'phase' && ev.ph === 'bpEnd' && c.flags.gobAtk === g.turnNo && onField(c)) { c.flags.gobAtk = 0; c.flags.gobLock = g.turnNo + 2; toDef(g, c); }
    return false; } }, ...(more.effs || [])] });
const battleDmgTo = (ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl;

/* ----- Hex-Sealed Fusions ----- */
// Fusion Monsters of that Attribute whose recipe the field can make with this card standing in for any one material.
// ENGINE: no substitute Fusion Material hook, so the first effect (using it in a Fusion Summon) isn't done.
function hexSets(g, c, p, at) {
  const pool = monsOf(g, p).filter(x => x !== c && faceUp(x)), out = [];
  for (const fx of g.p[p].extra) {
    if (D(fx).k !== 'fusion' || attr(fx) !== at || /Must be Fusion Summoned|Cannot be Special Summoned/i.test(D(fx).tx || '')) continue;
    if (forbid(g, { type: 'ss', c: fx, p, how: 'special' })) continue;
    const preds = fusionRecipe(fx); if (!preds) continue;
    for (let i = 0; i < preds.length; i++) {
      const rest = preds.filter((_, j) => j !== i);
      const rec = (k, used) => { if (k === rest.length) return used.slice(); for (const x of pool) if (!used.includes(x) && rest[k](x)) { used.push(x); const r = rec(k + 1, used); if (r) return r; used.pop(); } return null; };
      const m = rec(0, []); if (m) { out.push({ fx, mats: [c, ...m] }); break; }
    }
  }
  return out;
}
const hexFusion = at => ({ effs: [{ type: 'ign', tags: { ss: 1 }, label: `Tribute materials: summon a ${at} Fusion`,
  cond: (g, c, p) => faceUp(c) && hexSets(g, c, p, at).length > 0,
  cost: function* (g, c, p, L2) {
    const sets = hexSets(g, c, p, at); if (!sets.length) return;
    const [fx] = yield* pick(g, p, `Special Summon which ${at} Fusion Monster?`, sets.map(s => s.fx), 1, 1, 'good');
    const s = sets.find(x => x.fx === fx); L2.data.fx = fx;
    for (const x of s.mats) move(g, x, 'gy', { reason: 'tribute', by: p });
    log(g, `${PN(g, p)} Tributed ${s.mats.map(x => D(x).n).join(' + ')}.`);
  },
  res: function* (g, c, p, L2) { const fx = L2.data.fx; if (fx && fx.zone === 'extra') ss(g, p, fx, 'atk'); } }] });

/* ----- Thousand-Eyes Restrict (as goat-1.js) ----- */
const eyeEquip = (g, c) => allField(g).find(x => x.zone === 'st' && isMon(x) && x.equipTo === c.u) || null;
const eqStat = (g, e, which) => e.flags.f17fd ? 0 : stat(g, e, which);

/* ----- Needles: destroy the attacker at the end of the Damage Step ----- */
const needles = (beats) => ({ effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the attacking monster',
  on: (g, ev, c) => {
    if (ev.type === 'afterCalc' && ev.t === c && ev.a && ev.tWasDef) c.flags.needle = beats(def(g, c), atk(g, ev.a)) ? ev.a.u : 0;
    return ev.type === 'dsEnd' && ev.t === c && ev.a && c.flags.needle === ev.a.u;
  },
  res: function* (g, c, p, L2) { c.flags.needle = 0; const a = L2.ev.a; if (a && onField(a)) destroy(g, [a], { by: p }); } }] });

/* ----- Ultimate Insects ----- */
// "During your Standby Phase, by sending this face-up card to the GY, Special Summon 1 <next> from your hand/Deck.
// (Not the turn this card is Normal Summoned, Special Summoned, or flipped face-up.)" Offered as an optional trigger at
// the Standby Phase (ENGINE: no Standby Phase action window).
const insectUp = (from, next) => ({ type: 'trig', tags: { ss: 1 }, label: `Send to the GY: summon ${next}`,
  on: (g, ev, c) => {
    if (ev.type === 'flip' && ev.c === c) c.flags.f17up = g.turnNo;
    return ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.turnIn !== g.turnNo && c.flags.f17up !== g.turnNo;
  },
  cond: (g, c, p) => onField(c) && faceUp(c) && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, next)),
  cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${from} to the GY.`); },
  res: function* (g, c, p) {
    const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, next)); if (!cs.length || freeM(g, p) < 0) return;
    const [x] = cs.length > 1 ? yield* pick(g, p, `Special Summon ${next} from your hand or Deck`, cs, 1, 1, 'good') : cs;
    const fromDeck = x.zone === 'deck';
    if (ss(g, p, x, 'atk')) x.flags.f17insect = from;
    if (fromDeck) shuffleDeck(g, p);
  } });
const insectAura = (from, n, both) => ({
  atk: (g, src, c) => src.flags.f17insect === from && c.ctrl !== src.ctrl ? -n : 0,
  ...(both ? { def: (g, src, c) => src.flags.f17insect === from && c.ctrl !== src.ctrl ? -n : 0 } : {}) });

/* ----- Ultimate Tyranno ----- */
const tyrHit = (g, c) => new Set(c.flags.tyrT === g.turnNo ? c.flags.tyrHit || [] : []);
const tyrMax = (g, c) => { const hit = tyrHit(g, c); const rest = monsOf(g, opp(c.ctrl)).filter(m => !hit.has(m.u)).length; return c.attacks + (rest || (c.attacks ? 0 : 1)); };
const tyrCanAttack = (g, c) => onField(c) && faceUp(c) && c.zone === 'm' && c.pos === 'atk' && !negd(g, c) && !has(g, c, 'cantAttack') && c.attacks < tyrMax(g, c);

E.addScripts({
  /* ----- the Agents ----- */
  'The Agent of Creation - Venus': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Pay 500 LP: summon Mystical Shine Ball',
    cond: (g, c, p) => g.p[p].lp > 500 && freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Mystical Shine Ball')),
    cost: function* (g, c, p) { pay(g, p, 500); },
    res: function* (g, c, p) {
      const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Mystical Shine Ball')); if (!cs.length || freeM(g, p) < 0) { shuffleDeck(g, p); return; }
      const [x] = yield* pick(g, p, 'Special Summon Mystical Shine Ball from your hand or Deck', cs, 1, 1, 'good');
      const pos = (yield* choose(g, p, 'Mystical Shine Ball: which position?', ['Attack Position', 'Defense Position'])) ? 'def' : 'atk';
      const fromDeck = x.zone === 'deck'; ss(g, p, x, pos); if (fromDeck) shuffleDeck(g, p);
    } }] },
  // ENGINE: "unaffected by any Spell Cards" only covers destruction (the engine's unaffectedSpells flag).
  'The Agent of Force - Mars': { self: { unaffectedSpells: true,
    atk: (g, c) => sanctuary(g, c.ctrl) && lpDiff(g, c.ctrl) > 0 ? lpDiff(g, c.ctrl) : 0,
    def: (g, c) => sanctuary(g, c.ctrl) && lpDiff(g, c.ctrl) > 0 ? lpDiff(g, c.ctrl) : 0 } },
  // Tributing it is the cost; the damage is worked out (and The Sanctuary checked) when it resolves.
  'The Agent of Judgment - Saturn': { effs: [{ type: 'ign', label: 'Tribute: damage equal to the LP difference',
    cond: (g, c, p) => g.phase === 'main1' && lpDiff(g, p) > 0,
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed The Agent of Judgment - Saturn.`); g.noBP[p] = true; },
    res: function* (g, c, p) { if (!sanctuary(g, p)) { log(g, 'There is no face-up The Sanctuary in the Sky, so nothing happens.'); return; } const n = lpDiff(g, p); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  // The hand size "at the end of the opponent's End Phase" is read at the first event of your turn (before that turn's
  // draw or anything else adds to the hand). PARTIAL: a card added during the opponent's End Phase window after its
  // last action is counted correctly, but a card added to your hand at the very start of your turn by something other
  // than the draw is not subtracted.
  'The Agent of Wisdom - Mercury': { effs: [{ type: 'trig', mand: true, label: 'Draw 1 card',
    on: (g, ev, c) => {
      if (g.tp === c.ctrl && c.flags.mercSeen !== g.turnNo) { c.flags.mercSeen = g.turnNo; const n = g.p[c.ctrl].hand.length - (ev.type === 'move' && ev.to === 'hand' && ev.c.owner === c.ctrl ? 1 : 0); c.flags.merc = n === 0 && g.turnNo > 1 && c.turnIn < g.turnNo ? g.turnNo : 0; }
      return ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.flags.merc === g.turnNo;
    },
    res: function* (g, c, p) { draw(g, p, 1); } }] },

  /* ----- Hex-Sealed Fusions ----- */
  'The Dark - Hex-Sealed Fusion': hexFusion('DARK'),
  'The Earth - Hex-Sealed Fusion': hexFusion('EARTH'),
  'The Light - Hex-Sealed Fusion': hexFusion('LIGHT'),

  /* ----- Thousand ----- */
  'Thousand Dragon': { effs: [] },
  // PARTIAL: the +1000 is added to the current ATK/DEF (not the original), until the End Phase.
  'Thousand Energy': { effs: [
    { type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isNormalMon(x) && lv(x) === 2),
      res: function* (g, c, p) {
        const ms = monsOf(g, p).filter(x => faceUp(x) && isNormalMon(x) && lv(x) === 2);
        for (const m of ms) addMod(g, m, { atk: 1000, def: 1000, end: true });
        if (ms.length) log(g, `${ms.map(name).join(', ')} gained 1000 ATK and DEF.`);
        (g.f17energy = g.f17energy || []).push({ u: c.u, p, turn: g.turnNo });
      } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy your Level 2 Normal Monsters',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!g.f17energy && g.f17energy.some(e => e.u === c.u && e.turn === g.turnNo),
      res: function* (g, c) { const es = g.f17energy.filter(e => e.u === c.u && e.turn === g.turnNo); g.f17energy = g.f17energy.filter(e => !es.includes(e));
        for (const e of es) destroy(g, monsOf(g, e.p).filter(x => faceUp(x) && isNormalMon(x) && lv(x) === 2), { by: e.p, src: c }); } }] },
  // Dark Magician only needs to be face-up on your field (rulings: even as an Equip Card).
  'Thousand Knives': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => fieldOf(g, p).some(m => faceUp(m) && named(m, 'Dark Magician')) && monsOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Thousand Needles': needles((d, a) => d > a),
  'Two Thousand Needles': needles((d, a) => a < d),
  // Special Summoned from the hand by Tributing 1 Ocean's Keeper. ENGINE: no revealed-hand state, so the opponent's hand
  // is shown in the log when this card is summoned and at the start of each of your turns.
  'Thousand-Eyes Jellyfish': {
    proc: { label: "Special Summon (Tribute Ocean's Keeper)", cond: (g, c, p) => monsOf(g, p).some(x => named(x, "Ocean's Keeper")),
      cost: function* (g, c, p, grp) { const ks = monsOf(g, p).filter(x => named(x, "Ocean's Keeper")); const [x] = ks.length > 1 ? yield* pick(g, p, "Tribute which Ocean's Keeper?", ks, 1, 1, 'cost') : ks;
        move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Ocean's Keeper.`); } },
    effs: [lockEff, { type: 'trig', res: noop, on: (g, ev, c) => {
      if (faceUp(c) && (evSummoned(ev, c) || (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl))) { const h = g.p[opp(c.ctrl)].hand; log(g, `${PN(g, opp(c.ctrl))}'s revealed hand: ${h.length ? h.map(x => D(x).n).join(', ') : 'empty'}.`); }
      return false; } }] },
  // Ported from goat-1.js. "Other monsters on the field can't change their battle positions or attack" (position changes
  // by card effects still happen, rulings). A face-down monster equipped this way gives 0 ATK/DEF.
  // PARTIAL: Flip Summons of other monsters aren't stopped (no forbid action for a Flip Summon).
  'Thousand-Eyes Restrict': {
    self: {
      atk: (g, c) => { const e = eyeEquip(g, c); return e ? eqStat(g, e, 'atk') : 0; },
      def: (g, c) => { const e = eyeEquip(g, c); return e ? eqStat(g, e, 'def') : 0; },
      replaceDestroy: (g, c, o) => { if (!o.battle) return false; const e = eyeEquip(g, c); if (!e) return false; destroy(g, [e]); log(g, `${name(c)} survived: the equipped monster was destroyed instead.`); return true; },
    },
    cont: { forbid: (g, src, a) => (a.type === 'attack' || a.type === 'pos') && a.c !== src },
    effs: [{ type: 'ign', opt: true, label: 'Equip an opponent’s monster',
      cond: (g, c, p) => !eyeEquip(g, c) && freeST(g, p) >= 0 && monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip which of their monsters to this card?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) {
        const t = live(L2)[0]; if (!t || t.zone !== 'm' || !onField(c) || !faceUp(c) || eyeEquip(g, c) || freeST(g, p) < 0) return;
        const nm = D(t).n, fd = t.pos === 'set'; move(g, t, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p });
        t.equipTo = c.u; t.flags.negated = true; if (fd) t.flags.f17fd = true;
        log(g, `${nm} was equipped to ${name(c)}.`);
      } }] },

  /* ----- Thunder ----- */
  'Thunder Crash': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => monsOf(g, p).length > 0,
    res: function* (g, c, p) { const out = destroy(g, monsOf(g, p), { by: p, src: c }); if (out.length) damage(g, opp(p), 300 * out.length, { src: c, srcP: p }); } }] },
  // Ported from goat-1.js. Discarding it is the cost.
  'Thunder Dragon': { effs: [{ type: 'ign', loc: 'hand', label: 'Discard: add 2 Thunder Dragon',
    cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'Thunder Dragon')) && !forbid(g, { type: 'search', p }),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded Thunder Dragon.`); },
    res: function* (g, c, p) { if (forbid(g, { type: 'search', p })) return; const cs = g.p[p].deck.filter(x => named(x, 'Thunder Dragon')); if (!cs.length) return;
      const xs = yield* pick(g, p, 'Add up to 2 Thunder Dragon to your hand', cs, 1, 2, 'good'); for (const x of xs) move(g, x, 'hand', { reason: 'effect' });
      if (xs.length) log(g, `${PN(g, p)} added ${xs.length} Thunder Dragon to the hand.`); shuffleDeck(g, p); } }] },
  // Not a chain link: she is destroyed the moment a face-up non-LIGHT monster is on her controller's side.
  'Thunder Nyan Nyan': { effs: [{ type: 'trig', res: noop, on: (g, ev, c) => {
    if (g.f17nyan || !onField(c) || !faceUp(c) || c.zone !== 'm') return false;
    if (monsOf(g, c.ctrl).some(x => faceUp(x) && attr(x) !== 'LIGHT')) { g.f17nyan = true; try { destroy(g, [c], { by: c.ctrl }); } finally { g.f17nyan = false; } }
    return false; } }] },
  'Thunder of Ruler': { effs: [trapTrig({ label: 'No Battle Phase this turn',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl,
    res: function* (g, c, p) { g.noBP[g.tp] = true; log(g, `${PN(g, g.tp)} can't conduct the Battle Phase this turn.`); } })] },

  /* ----- Time ----- */
  // Ported from classic-5.js.
  'Time Machine': { effs: [trapTrig({ label: 'Special Summon the destroyed monster', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && ev.wasField && isMon(ev.c),
    cond: (g, c, p, x) => x.ev.c.zone === 'gy' && freeM(g, x.ev.prevCtrl) >= 0 && !forbid(g, { type: 'ss', c: x.ev.c, p: x.ev.prevCtrl, how: 'special' }),
    target: function* (g, c, p, L2) { L2.data.x = L2.ev.c; },
    res: function* (g, c, p, L2) { const x = L2.data.x, q = L2.ev.prevCtrl; if (x.zone !== 'gy') return; const pos = L2.ev.snap && L2.ev.snap.pos === 'atk' ? 'atk' : 'def'; ss(g, q, x, pos); } })] },
  // +3 Levels until the End Phase (taken off when the End Phase starts, so Fortune Lady level ups stay).
  'Time Passage': { effs: [
    { type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && /^Fortune Lady/.test(name(x))),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Raise the Level of which Fortune Lady?', monsOf(g, p).filter(x => faceUp(x) && /^Fortune Lady/.test(name(x))), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; t.flags.lv = lv(t) + 3; g.seq++; (g.f17tp = g.f17tp || []).push({ u: t.u, turn: g.turnNo }); log(g, `${name(t)} is now Level ${lv(t)}.`); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (ev.type === 'phase' && ev.ph === 'end' && g.f17tp && g.f17tp.length) { for (const e of g.f17tp.filter(e => e.turn <= g.turnNo)) { const m = fieldMons(g).find(x => x.u === e.u); if (m && m.flags.lv) { m.flags.lv = Math.max(1, m.flags.lv - 3); g.seq++; log(g, `${name(m)} is Level ${lv(m)} again.`); } } g.f17tp = g.f17tp.filter(e => e.turn > g.turnNo); }
      return false; } }] },
  // Ported from classic-5.js.
  'Time Seal': { effs: [{ type: 'act', res: function* (g, c, p) { const o = opp(p), when = g.tp === o ? g.turnNo + 2 : g.turnNo + 1;
    addRule(g, (g2, a) => a.type === 'draw' && a.p === o && g2.phase === 'draw' && g2.turnNo === when, { end: when });
    log(g, `${PN(g, o)} skips the Draw Phase of their next turn.`); } }] },
  // Ported from classic-2.js (with the Dark Sage follow-up its text allows right after a right call).
  'Time Wizard': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Toss a coin',
    res: function* (g, c, p) {
      const call = yield* choose(g, p, 'Call the coin toss', ['Heads', 'Tails']); log(g, `${PN(g, p)} called ${call ? 'Tails' : 'Heads'}.`);
      if (coin(g, p) === (call === 0)) {
        log(g, `${PN(g, p)} called it right.`); destroy(g, monsOf(g, opp(p)), { by: p });
        const dm = monsOf(g, p).filter(m => faceUp(m) && named(m, 'Dark Magician'));
        const sages = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Dark Sage'));
        if (dm.length && sages.length && !forbid(g, { type: 'ss', c: { ...sages[0], nomi: true }, p, how: 'special' }) && (yield* yn(g, p, 'Tribute Dark Magician to Special Summon Dark Sage?'))) {
          const [m] = dm.length > 1 ? yield* pick(g, p, 'Tribute which Dark Magician?', dm, 1, 1, 'cost') : dm;
          const [s] = sages.length > 1 ? yield* pick(g, p, 'Special Summon which Dark Sage?', sages, 1, 1, 'good') : sages;
          move(g, m, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Dark Magician.`);
          const fromDeck = s.zone === 'deck'; s.flags.darkSage = true; s.nomi = true; ss(g, p, s, 'atk'); if (fromDeck) shuffleDeck(g, p);
        }
      } else {
        log(g, `${PN(g, p)} called it wrong.`); const ms = monsOf(g, p); const at = new Map(ms.map(m => [m, faceUp(m) ? atk(g, m) : 0]));
        const gone = destroy(g, ms, { by: p }); const n = Math.floor(gone.reduce((s, m) => s + (at.get(m) || 0), 0) / 2); if (n > 0) damage(g, p, n, { src: c, srcP: p });
      } } }] },

  /* ----- Toons ----- */
  // Ported from goat-6.js, with the Edison Toon rules. Tributing 1 monster (itself included) is the cost.
  'Toon Cannon Soldier': toonN({ effs: [{ type: 'ign', label: 'Tribute: 500 damage', cond: (g, c, p) => monsOf(g, p).length > 0,
    cost: function* (g, c, p) { yield* tributeOne(g, p, 'Tribute 1 monster'); },
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] }),
  // Its text has no "can't attack that turn" and no attack cost.
  'Toon Dark Magician Girl': toonSS(1, { noWait: true, noCost: true,
    self: { atk: (g, c) => 300 * [...g.p[0].gy, ...g.p[1].gy].filter(x => named(x, 'Dark Magician', 'Magician of Black Chaos')).length } }),
  // The attack becomes a direct attack. ENGINE: attack redirect (attack() keeps its target), so the declared attack is
  // negated and the attacker's ATK is dealt to you as direct battle damage. PARTIAL: no Damage Step for that attack.
  'Toon Defense': (() => {
    const ok = (g, p) => !!(g.aw && g.aw.a && g.aw.a.ctrl !== p && g.aw.t && g.aw.t.ctrl === p && faceUp(g.aw.t) && isToon(g.aw.t) && lv(g.aw.t) <= 4 && !g.aw.toonDef);
    function* redirect(g, c, p, L2) { const a = L2.data.a; if (!a || !onField(a) || !faceUp(a) || !g.aw || g.aw.a !== a) return; g.aw.toonDef = true; negateAttack(g); log(g, `${name(a)}'s attack became a direct attack.`); damage(g, p, atk(g, a), { battle: true, src: a, srcP: a.ctrl, direct: true }); }
    return { effs: [
      { type: 'act', target: function* (g, c, p, L2) { if (ok(g, p) && (yield* yn(g, p, 'Make the attack a direct attack?'))) L2.data.a = g.aw.a; },
        res: function* (g, c, p, L2) { yield* redirect(g, c, p, L2); } },
      { type: 'quick', loc: 'st', label: 'Make the attack a direct attack', cond: (g, c, p) => ok(g, p) && !(g.chain || []).some(l => l.c === c),
        target: function* (g, c, p, L2) { L2.data.a = g.aw.a; },
        res: function* (g, c, p, L2) { yield* redirect(g, c, p, L2); } }] };
  })(),
  'Toon Gemini Elf': toonN({ effs: [{ type: 'trig', mand: true, label: 'Discard 1 random card', on: (g, ev, c) => battleDmgTo(ev, c),
    res: function* (g, c, p) { discardRandom(g, opp(p)); } }] }),
  'Toon Goblin Attack Force': goblinLock(toonN()),
  'Toon Masked Sorcerer': toonN({ effs: [{ type: 'trig', mand: true, label: 'Draw 1 card', on: (g, ev, c) => battleDmgTo(ev, c),
    res: function* (g, c, p) { draw(g, p, 1); } }] }),
  // Ported from classic-1.js (toon(0)).
  'Toon Mermaid': toonSS(0),
  // ENGINE: "always treated as an Archfiend card" (no name override).
  'Toon Summoned Skull (Archfiend)': toonSS(1),
  // Ported from goat-6.js. A "Toon" card, or Manga Ryu-Ran (rulings).
  'Toon Table of Contents': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.some(x => /Toon/.test(D(x).n) || named(x, 'Manga Ryu-Ran')) && !forbid(g, { type: 'search', p }),
    res: function* (g, c, p) { yield* search(g, p, x => /Toon/.test(D(x).n) || named(x, 'Manga Ryu-Ran'), 'Add which "Toon" card to your hand?'); } }] },
  // Ported from goat-6.js: paying 1000 LP is the cost (none while Spell Economics is face-up, the only LP hook there is).
  'Toon World': { effs: [{ type: 'act',
    cond: (g, c, p) => stOf(g, p).some(x => faceUp(x) && named(x, 'Spell Economics')) || g.p[p].lp > 1000,
    cost: function* (g, c, p) { if (stOf(g, p).some(x => faceUp(x) && named(x, 'Spell Economics'))) log(g, `${PN(g, p)} paid no LP (Spell Economics).`); else pay(g, p, 1000); },
    res: noop }] },

  /* ----- Tornado ----- */
  'Tornado': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => g.p[opp(p)].st.filter(Boolean).length >= 3,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card in their Spell & Trap Zone?', g.p[opp(p)].st.filter(Boolean), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Tornado Bird': { effs: [{ type: 'trig', mand: true, label: 'Return 2 Spells/Traps to the hand', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: g => stOnField(g).length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which 2 Spell/Trap Cards to the hand?', stOnField(g), 2, 2, 'bad'); },
    res: function* (g, c, p, L2) { const ts = live(L2); for (const t of ts) move(g, t, 'hand', { reason: 'effect', by: p }); if (ts.length) log(g, `${ts.map(t => D(t).n).join(', ')} returned to the hand.`); } }] },
  // Ported from classic-5.js. Umi or A Legendary Ocean (treated as Umi) counts.
  'Tornado Wall': (() => {
    const UMIS = ['Umi', 'A Legendary Ocean'];
    const umiUp = g => allField(g).some(x => faceUp(x) && UMIS.includes(D(x).n));
    return { cont: { dmg: (g, src, p, n, o) => (o && o.battle && p === src.ctrl && umiUp(g) && g.battle && g.battle.a && g.battle.a.ctrl !== p) ? 0 : n },
      effs: [{ type: 'act', cond: g => umiUp(g), res: noop },
        { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroyed when Umi leaves', on: (g, ev, c) => faceUp(c) && ev.type === 'move' && ev.wasField && UMIS.includes(D(ev.c).n) && !umiUp(g),
          res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] };
  })(),

  /* ----- Traps ----- */
  // Sending the opponent's face-up Trap is the cost of its own summon rule (no chain).
  'Trap Eater': { proc: { label: 'Special Summon (send their face-up Trap to the GY)',
      cond: (g, c, p) => stOf(g, opp(p)).some(x => faceUp(x) && isTrap(x)),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Send which of their face-up Trap Cards to the GY?', stOf(g, opp(p)).filter(x => faceUp(x) && isTrap(x)), 1, 1, 'bad');
        if (x) { move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } } },
    effs: [lockEff] },
  'Trap Jammer': { effs: [{ type: 'act', ds: true,
    cond: (g, c, p, x) => g.phase === 'battle' && !!x.top && !x.top.negated && x.top.p !== p && spellTrapAct(x.top) && isTrap(x.top.c),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; if (T && !T.negated) { T.negBy = p; negate(g, T, true); } } }] },
  // A face-down Spell picked this way is shown and stays (rulings: you must pick one of your own cards if theirs has none).
  'Trap Master': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a Trap Card', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: g => stOnField(g).some(x => !faceUp(x) || isTrap(x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which Trap Card (or Set card) to destroy?', stOnField(g).filter(x => !faceUp(x) || isTrap(x)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; if (isTrap(t)) destroy(g, [t], { by: p }); else log(g, `${D(t).n} isn't a Trap Card, so it stays.`); } }] },
  // The damage of the link it chains to becomes 0 (a damage hook from the GY, for that one link only, as full-08.js
  // Energy-Absorbing Monolith), then the opponent discards 1 card. PARTIAL: "an effect that inflicts damage" is read from
  // the card's text.
  'Trap of Board Eraser': {
    cont: { loc: 'gy', dmg: (g, src, p, n, o) => !o.battle && g.f17eraser && g.f17eraser.some(m => m.p === p && m.grp === g.group) ? 0 : undefined },
    effs: [{ type: 'act', cond: (g, c, p, x) => !!x.top && !x.top.negated && dmgText(x.top.c) && g.p[opp(p)].hand.length > 0,
      res: function* (g, c, p) { (g.f17eraser = g.f17eraser || []).push({ p, grp: g.group + 1 }); if (g.f17eraser.length > 8) g.f17eraser.shift(); log(g, `${PN(g, p)} will take no damage from that effect.`);
        yield* discardPick(g, opp(p), 1, 'Discard 1 card'); } }] },
  // Copies a Normal Trap's activated effect from your GY (its costs aren't paid; its targets are chosen now), then
  // banishes it. PARTIAL: the copied Trap must be activatable right now by its own condition; equip effects aren't
  // excluded by name (the scripts don't mark them).
  'Trap of Darkness': (() => {
    const actOf = t => (E.lib.effsOf(t) || []).find(e => e.type === 'act' && e.res);
    const cands = (g, c, p, x) => g.p[p].gy.filter(t => isTrap(t) && D(t).sub === 'Normal' && !named(t, 'Trap of Darkness') && (() => { const e = actOf(t); if (!e) return false; try { return !e.cond || !!e.cond(g, c, p, x || {}); } catch (er) { return false; } })());
    return { effs: [{ type: 'act',
      cond: (g, c, p, x) => g.p[p].lp <= 3000 && g.p[p].lp > 1000 && cands(g, c, p, x).length > 0,
      cost: function* (g, c, p) { pay(g, p, 1000); },
      target: function* (g, c, p, L2) {
        const cs = cands(g, c, p, { top: g.chain[g.chain.length - 1] }); if (!cs.length) return;
        const [t] = yield* pick(g, p, 'Copy which Normal Trap in your GY?', cs, 1, 1, 'good'); if (!t) return;
        log(g, `${PN(g, p)} targeted ${D(t).n} in the GY.`); const e = actOf(t); L2.data.tt = t; L2.data.e = e; L2.tags = e.tags || {};
        if (e.target) yield* e.target(g, c, p, L2);
      },
      res: function* (g, c, p, L2) {
        const t = L2.data.tt, e = L2.data.e; if (!t || t.zone !== 'gy' || !e) return;
        log(g, `Trap of Darkness applies the effect of ${D(t).n}.`);
        try { yield* e.res(g, c, p, L2); } catch (er) { if (!(er instanceof TypeError)) throw er; log(g, `${D(t).n}'s effect couldn't be applied.`); }
        if (t.zone === 'gy') { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished.`); }
      } }] };
  })(),
  'Trap of the Imperial Tomb': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.sw && g.sw.p === p && g.sw.cs.some(x => onField(x) && x.ctrl === p && x.owner !== p && race(x) === 'Zombie' && cameFrom(g, x) === 'gy') && allField(g).filter(x => x !== c).length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which 2 cards on the field?', allField(g).filter(x => x !== c), 2, 2, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  // Chains to the Trap's activation; the Trap's effect still resolves (rulings), the card itself is destroyed.
  'Trap Reactor Y FI': { effs: [{ type: 'quick', opt: true, tags: { destroy: 1 }, label: 'Destroy that Trap: 800 damage',
    cond: (g, c, p, x) => !!x.top && x.top.p !== p && spellTrapAct(x.top) && isTrap(x.top.c) && onField(x.top.c),
    target: function* (g, c, p, L2) { L2.data.t = g.chain[g.chain.length - 1].c; },
    res: function* (g, c, p, L2) { const t = L2.data.t; if (t && onField(t) && destroy(g, [t], { by: p }).length) damage(g, opp(p), 800, { src: c, srcP: p }); } }] },
  // Discarding is the cost. The first time that Trap goes to the GY it returns to its owner's hand.
  'Trap Reclamation': { effs: [
    { type: 'act', cond: (g, c, p, x) => !!x.top && x.top.p === p && spellTrapAct(x.top) && isTrap(x.top.c) && ['Normal', 'Continuous'].includes(D(x.top.c).sub) && g.p[p].hand.filter(h => h !== c).length > 0,
      cost: function* (g, c, p) { yield* discardPick(g, p, 1, 'Discard 1 card', c); },
      target: function* (g, c, p, L2) { L2.data.u = g.chain[g.chain.length - 1].c.u; },
      res: function* (g, c, p, L2) { (g.f17recl = g.f17recl || []).push({ u: L2.data.u, by: c.u }); log(g, `${PN(g, p)}'s Trap will return to the hand when it goes to the GY.`); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return that Trap to the hand',
      on: (g, ev, c) => { if (!(ev.type === 'move' && ev.to === 'gy' && g.f17recl)) return false; const e = g.f17recl.find(r => r.u === ev.c.u && r.by === c.u); if (!e) return false; g.f17recl = g.f17recl.filter(r => r !== e); c.flags.f17rx = ev.c; return true; },
      res: function* (g, c, p, L2) { const x = c.flags.f17rx || (L2.ev && L2.ev.c); if (x && x.zone === 'gy') { move(g, x, 'hand', { reason: 'effect' }); log(g, `${D(x).n} returned to ${PN(g, x.owner)}'s hand.`); } } }] },

  /* ----- Twins ----- */
  'Twin-Barrel Dragon': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Toss a coin twice',
    on: (g, ev, c) => evSummoned(ev, c), cond: (g, c, p) => fieldOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which of their cards?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const a = coin(g, p), b = coin(g, p); if (a && b) destroy(g, live(L2), { by: p }); else log(g, 'Not 2 Heads, so nothing happens.'); } }] },
  // Once per Duel for each player. PARTIAL: its ATK becomes 1000 as its original ATK; the DEF is set to 1000 as a
  // current value (the engine has no original DEF override).
  'Twin-Headed Behemoth': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon it with 1000 ATK/DEF',
    on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField && ev.to === 'gy') c.flags.behem = g.turnNo; return ev.type === 'phase' && ev.ph === 'end' && c.flags.behem === g.turnNo; },
    cond: (g, c, p) => c.zone === 'gy' && freeM(g, p) >= 0 && !(g.f17behem && g.f17behem[p]),
    cost: function* (g, c, p) { (g.f17behem = g.f17behem || {})[p] = true; },
    res: function* (g, c, p) { if (c.zone !== 'gy') return; if (ss(g, p, c, 'atk')) { c.flags.baseAtk = 1000; addMod(g, c, { set: 1000, which: 'def' }); log(g, 'Twin-Headed Behemoth has 1000 ATK and DEF.'); } } }] },
  'Twin-Headed Thunder Dragon': { effs: [] },
  'Twin-Headed Wolf': { effs: [battleNegator((g, c, o) => /Flip/.test(D(o).ab || '') && monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && race(x) === 'Fiend'), false)] },
  'Twin-Shield Defender': { effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Halve the ATK of a monster',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy' && ev.prevCtrl === c.owner,
    cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Halve the ATK of which face-up monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const A = atk(g, t); addMod(g, t, { atk: -(A - Math.floor(A / 2)), end: true }); log(g, `${name(t)}'s ATK was halved.`); } }] },
  // PARTIAL: the second attack doesn't have to come right after the first ("in a row").
  'Twin-Sword Marauder': { self: { piercing: true },
    effs: [{ type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'afterCalc' && ev.a === c && ev.tWasDef && c.flags.f17tsm !== g.turnNo) { c.flags.f17tsm = g.turnNo; c.flags.extraAttack = g.turnNo; } return false; } }] },
  // Sending a card from the hand is the cost. PARTIAL: the second attack is granted for the turn as soon as it is
  // equipped (if the Equip is destroyed mid-turn, the monster keeps that second attack this turn).
  'Twin Swords of Flashing Light - Tryce': {
    cont: { atk: (g, src, m) => src.equipTo === m.u ? -500 : 0 },
    effs: [{ type: 'act',
      cond: (g, c, p) => fieldMons(g).some(faceUp) && g.p[p].hand.filter(x => x !== c).length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send 1 card from your hand to the GY', g.p[p].hand.filter(h => h !== c), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); } },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && equip(g, c, t)) t.flags.extraAttack = g.turnNo; } },
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => { const m = faceUp(c) && equippedTo(g, c); if (m && m.flags.extraAttack !== g.turnNo) m.flags.extraAttack = g.turnNo; return false; } }] },
  // The turn player chooses (asked of them when it resolves, whoever controls this card).
  'Two-Man Cell Battle': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', mand: true, tags: { ss: 1 }, label: 'Turn player may summon a Level 4 Normal Monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end',
      cond: (g) => freeM(g, g.tp) >= 0 && g.p[g.tp].hand.some(x => isNormalMon(x) && lv(x) === 4),
      res: function* (g, c) { const q = g.tp; const cs = g.p[q].hand.filter(x => isNormalMon(x) && lv(x) === 4); if (!cs.length || freeM(g, q) < 0) return;
        if (!(yield* yn(g, q, 'Special Summon a Level 4 Normal Monster from your hand (Two-Man Cell Battle)?'))) return;
        const [x] = yield* pick(g, q, 'Special Summon which Level 4 Normal Monster?', cs, 1, 1, 'good'); if (x) ss(g, q, x, 'atk'); } }] },
  // Targets 2 of your monsters and 1 of theirs; destroying yours is part of the effect, not a cost (rulings).
  'Two-Pronged Attack': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).length >= 2 && monsOf(g, opp(p)).length >= 1,
    target: function* (g, c, p, L2) { const a = yield* tgt(g, p, L2, 'Destroy which 2 of your monsters?', monsOf(g, p), 2, 2, 'cost'); const b = yield* tgt(g, p, L2, 'Destroy which of their monsters?', monsOf(g, opp(p)), 1, 1, 'bad'); L2.t = [...a, ...b]; },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },

  /* ----- Ultimates ----- */
  'Ultimate Ancient Gear Golem': { self: { piercing: true },
    // Once it attacks, the opponent can't activate Spell/Trap Cards until the end of the Damage Step (face-up cards'
    // effects can still be used).
    cont: { forbid: (g, src, a) => a.type === 'activate' && a.p !== src.ctrl && a.eff && a.eff.type === 'act' && a.c && isST(a.c) && ((g.aw && g.aw.a === src) || (g.battle && g.battle.a === src)) },
    effs: [lockEff, { type: 'trig', loc: 'any', tags: { ss: 1 }, label: 'Special Summon Ancient Gear Golem from the GY',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField,
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, 'Ancient Gear Golem')),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Ancient Gear Golem?', g.p[p].gy.filter(x => named(x, 'Ancient Gear Golem')), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ssIgnoring(g, p, t, 'atk'); } }] },
  'Ultimate Baseball Kid': { self: { atk: (g, c) => 1000 * fieldMons(g).filter(x => x !== c && faceUp(x) && attr(x) === 'FIRE').length },
    effs: [{ type: 'ign', label: 'Send a FIRE monster: 500 damage', cond: (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x) && attr(x) === 'FIRE'),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which face-up FIRE monster to the GY?', monsOf(g, p).filter(x => x !== c && faceUp(x) && attr(x) === 'FIRE'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
      res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  // ENGINE: "unaffected by Spell Cards" only covers destruction (the engine's unaffectedSpells flag).
  'Ultimate Insect LV1': { self: { unaffectedSpells: true }, effs: [insectUp('Ultimate Insect LV1', 'Ultimate Insect LV3')] },
  'Ultimate Insect LV3': { cont: insectAura('Ultimate Insect LV1', 300), effs: [insectUp('Ultimate Insect LV3', 'Ultimate Insect LV5')] },
  'Ultimate Insect LV5': { cont: insectAura('Ultimate Insect LV3', 500), effs: [insectUp('Ultimate Insect LV5', 'Ultimate Insect LV7')] },
  'Ultimate Insect LV7': { cont: insectAura('Ultimate Insect LV5', 700, true) },
  'Ultimate Obedient Fiend': { self: { cantAttack: (g, c) => fieldOf(g, c.ctrl).length !== 1 || g.p[c.ctrl].hand.length > 0 },
    effs: [battleNegator((g, c, o) => /Effect/.test(D(o).ab || '') && D(o).k === 'effect', true)] },
  // Attacks each opponent's monster once (Asura Priest hooks). While one can still attack, your other monsters can't.
  'Ultimate Tyranno': {
    self: { maxAttacks: tyrMax, attackOk: (g, c, t) => !tyrHit(g, c).has(t.u) },
    cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && a.c !== src && a.c.ctrl === src.ctrl && g.tp === src.ctrl && g.phase === 'battle' && !named(a.c, 'Ultimate Tyranno') && tyrCanAttack(g, src) },
    effs: [{ type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'attack' && ev.a === c && ev.t) { if (c.flags.tyrT !== g.turnNo) { c.flags.tyrT = g.turnNo; c.flags.tyrHit = []; } c.flags.tyrHit.push(ev.t.u); } return false; } }] },
});
})();
