/* Full pool batch 42: Obelisk the Tormentor to Rallis the Star Bird (build/batches/full/full-42.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings.
 Obelisk the Tormentor (classic-1.js) and Panther Warrior (classic-3.js) have Goat-only scripts; they are ported here as the
 shared version, and the Goat-only ones still win under Goat. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, takeControl, negate, addMod, equip,
  negateAttack, addRule, tokens, coin, name, D, isMon, isST, isSpell, isTrap, isExtraD, onField, faceUp, attr, race, lv,
  baseAtk, monsOf, stOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp,
  oppFaceUp, stOnField, spellTrapAct, evSummoned, emit, forbid, stat, negd, num, isGemini } = L;
const atk = L.atk;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const canSS = (g, p, x) => isMon(x) && !isExtraD(D(x)) && D(x).k !== 'ritual' && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
const origAtk = c => c.flags && c.flags.tokAtk != null ? c.flags.tokAtk : baseAtk(c);
const printedAtk = c => Math.max(0, num(D(c).atk));
const toPos = (g, m, pos, p) => { if (!onField(m) || m.zone !== 'm' || m.pos === pos) return; const from = m.pos; m.pos = pos; g.seq++; log(g, `${name(m)} was changed to ${pos === 'atk' ? 'Attack' : 'Defense'} Position.`); emit(g, { type: 'pos', c: m, p, from }); };
function* tributeN(g, p, n, text, not) {
  const cs = monsOf(g, p).filter(x => x !== not && !x.flags.noTribute);
  const xs = yield* pick(g, p, text, cs, n, n, 'cost');
  for (const x of xs) { const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); }
  return xs;
}
// Equip Spells: target a face-up monster that passes filter (and belongs to the activator when mine), equip it at resolution
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?', mine = false, after) => ({ type: 'act',
  cond: (g, c, p) => fieldMons(g).some(m => faceUp(m) && filter(m) && (!mine || m.ctrl === p)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m) && (!mine || m.ctrl === p)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && (!mine || t.ctrl === p) && onField(c) && equip(g, c, t) && after) after(g, c, t); } });
// "Cyber Dragon" (same as full-04.js): Proto-Cyber Dragon counts while on the field.
const cyberDragon = x => named(x, 'Cyber Dragon') || name(x) === 'Cyber Dragon' || (named(x, 'Proto-Cyber Dragon') && onField(x));
// "by a card effect" spell activations (same as full-15.js): a Normal or Quick-Play Spell as it goes to the GY after resolving,
// a Continuous, Equip or Field Spell as it is activated from the hand. Returns the player who activated it, or -1.
// PARTIAL: a Set Continuous, Equip or Field Spell flipped face-up to activate is not seen (no engine event).
const STAYS = ['Continuous', 'Equip', 'Field'];
const gem = x => isMon(x) && (/Gemini/.test(D(x).ab || '') || isGemini(x));
function spellActBy(ev) {
  if (ev.type !== 'move' || !isSpell(ev.c)) return -1;
  const stays = STAYS.includes(D(ev.c).sub);
  if (!stays && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule') return ev.prevCtrl;
  if (stays && ev.from === 'hand' && ev.reason === 'activate') return ev.c.ctrl;
  return -1;
}

/* A Trap that answers a moment with no response window in the engine (same as full-26.js): a trigger that only fires while
 the card is Set (and wasn't Set this turn). It flips the card face-up, counts as a Trap Card activation at Spell Speed 2,
 and sends the card to the GY after it resolves.
 ENGINE: no response window after a monster is destroyed by battle (Option Hunter). */
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });

/* Union monsters (same as full-37.js): once per turn equip to a monster you control, or unequip and Special Summon in
 Attack Position; a monster has at most 1 Union. anyDestroy: "if the equipped monster would be destroyed" (Oilman), else
 only "by battle" (Protective Soul Ailin). */
const glassOn = g => !!(g.full02 && g.full02.glass === g.turnNo);
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
      cond: (g, c, p) => c.used.union !== g.turnNo && !!c.equipTo && !!c.flags.union && freeM(g, p) >= 0 && !glassOn(g),
      after: (g, c) => { c.used.union = g.turnNo; },
      res: function* (g, c, p) { if (c.zone !== 'st' || !c.equipTo) return; c.equipTo = null; c.flags.union = false; ss(g, p, c, 'atk'); } }];
}
const unionCont = anyDestroy => ({ replaceDestroy: (g, src, m, o) => {
  if ((!o.battle && !anyDestroy) || o.rule || src.zone !== 'st' || src.equipTo !== m.u || !src.flags.union || glassOn(g)) return false;
  move(g, src, 'gy', { reason: o.battle ? 'battle' : 'effect', destroyed: true, by: o.by }); log(g, `${D(src).n} was destroyed instead of ${name(m)}.`); return true; } });

/* Duel-long summon rules, installed by the first event any card of this batch sees (a trig that never fires).
 ENGINE: no general "can't be Special Summoned" flag; these locks stand in for it. */
const proper = c => ['gy', 'ban'].includes(c.zone) && c.f42proper;
const LOCKS = {
  // "Requires 3 Tributes to Normal Summon (Cannot be Normal Set)"
  'Obelisk the Tormentor': (g, a) => a.type === 'set',
  // "Must first be Special Summoned by its own effect": only while its own effect resolves, or revived once properly summoned
  'Orichalcos Shunoros': (g, a) => a.type === 'ss' && !(g.resolvingL && g.resolvingL.c === a.c) && !proper(a.c),
  // "Must first be Special Summoned (from your hand) by Tributing 1 Petit Moth": from the hand, or revived once properly summoned.
  // PARTIAL: an effect that Special Summons it from the hand is not stopped.
  'Perfectly Ultimate Great Moth': (g, a) => a.type === 'ss' && a.c.zone !== 'hand' && !proper(a.c),
  // "There can only be 1 face-up Rai-Jin on the field". PARTIAL: a Flip Summon of a second one isn't stopped.
  'Rai-Jin': (g, a) => ['ns', 'ss'].includes(a.type) && fieldMons(g).some(x => x !== a.c && faceUp(x) && named(x, 'Rai-Jin')),
};
const lockEff = { type: 'trig', loc: 'any', res: noop, on: (g, ev) => {
  if (!g.f42lock) { g.f42lock = true; addRule(g, (g2, a) => { if (!a.c || a.c.id == null || !['ns', 'set', 'ss'].includes(a.type)) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); }
  if (ev.type === 'summon') for (const x of ev.cs) if (x && LOCKS[D(x).n] && x.summonType === 'special' && !(g.resolvingL && g.resolvingL.c !== x && D(x).n === 'Orichalcos Shunoros')) x.f42proper = true;
  return false; } };

/* Watchers (no chain link): a card property f42bat = the turn it was destroyed by battle and sent to the GY, cleared when it
 leaves the GY (Over Limit, Paladin of the Cursed Dragon); f42toDef = the turn a monster was changed to Defense Position
 (Prevention Star). */
const watch = { type: 'trig', loc: 'any', res: noop, on: (g, ev) => {
  if (ev.type === 'move') {
    if (ev.from === 'gy' && ev.to !== 'gy') ev.c.f42bat = null;
    if (ev.to === 'gy' && ev.battle && ev.destroyed && ev.wasField && ev.c.zone === 'gy') ev.c.f42bat = g.turnNo;
  }
  if (ev.type === 'pos' && ev.c && ev.c.pos === 'def' && onField(ev.c)) ev.c.flags.f42toDef = g.turnNo;
  return false; } };

/* Obelisk (port of classic-1.js). "This card's Normal Summon can't be negated. When Normal Summoned, cards and effects can't be
 activated." PARTIAL: the lock lasts while the engine still treats the summon as the last thing that happened (g.sw). */
const godLock = {
  forbid: (g, src, a) => a.type === 'activate' && a.c !== src && (
    (g.attempt && g.attempt.cs.includes(src) && ['normal', 'tribute'].includes(g.attempt.how)) ||
    (g.sw && g.sw.cs.includes(src) && ['normal', 'tribute'].includes(g.sw.how))),
};

/* Panther Warrior (port of classic-3.js): "can't declare an attack unless you Tribute 1 monster".
 PARTIAL: the engine has no attack cost that can prompt, so the Tribute is a mandatory trigger at the attack declaration
 (it uses a chain link); the monster can't attack while you control no other monster to Tribute. */
const tributeToAttack = {
  self: { cantAttack: (g, c) => !monsOf(g, c.ctrl).some(x => x !== c && !x.flags.noTribute) },
  eff: { type: 'trig', mand: true, label: 'Tribute 1 monster to attack', on: (g, ev, c) => ev.type === 'attack' && ev.a === c,
    cost: function* (g, c, p) { yield* tributeN(g, p, 1, `Tribute 1 monster to attack with ${name(c)}`, c); },
    res: noop },
};

/* Obsidian Dragon: "Negate the effects of Spell and Trap Cards that target only 1 face-up DARK monster you control, and destroy
 them." A Continuous Effect: checked whenever its controller is offered a response (right after a card is activated), with no
 chain link; an Equip Card already equipped to such a monster is destroyed the same way.
 ENGINE: no hook runs as a card is activated, so this is done from Obsidian Dragon's response check. */
function obsidianScan(g, c) {
  if (c.zone !== 'm' || !faceUp(c) || negd(g, c)) return;
  const darkMine = t => t && isMon(t) && t.zone === 'm' && faceUp(t) && attr(t) === 'DARK' && t.ctrl === c.ctrl;
  for (const L2 of g.chain.slice()) {
    if (L2.negated || L2.f42obs || !isST(L2.c)) continue;
    const ts = (L2.t || []).filter(Boolean);
    if (ts.length !== 1 || !darkMine(ts[0])) continue;
    L2.f42obs = true; L2.negBy = c.ctrl; log(g, `Obsidian Dragon negates ${name(L2.c)}.`); negate(g, L2, true);
  }
  for (const x of stOnField(g)) {
    if (!faceUp(x) || !x.equipTo || g.chain.some(L2 => L2.c === x)) continue;
    const m = fieldMons(g).find(y => y.u === x.equipTo);
    if (darkMine(m)) { log(g, `Obsidian Dragon negates ${name(x)}.`); destroy(g, [x], { by: c.ctrl }); }
  }
}

/* Ogre of the Scarlet Sorrow: direct attacks declared this turn (g.f42dir: {turn, n, first, last}) */
const dirWatch = { type: 'trig', loc: 'any', res: noop, on: (g, ev) => {
  if (ev.type !== 'attack' || !ev.direct) return false;
  if (!g.f42dir || g.f42dir.turn !== g.turnNo) g.f42dir = { turn: g.turnNo, n: 0, first: null, last: -1 };
  if (g.f42dir.last !== ev.seq) { g.f42dir.last = ev.seq; g.f42dir.n++; if (g.f42dir.n === 1) g.f42dir.first = ev.a.u; }
  return false; } };

/* Prideful Roar: its ATK boost ends with damage calculation (stripped at the end of the Damage Step) */
const roarStrip = { type: 'trig', loc: 'any', res: noop, on: (g, ev) => {
  if (ev.type === 'dsEnd' || !g.inDS) for (const m of fieldMons(g)) if (m.mods.some(x => x.f42roar)) { m.mods = m.mods.filter(x => !x.f42roar); g.seq++; }
  return false; } };

/* Rallis the Star Bird: banished by its own effect, it comes back at the start of its owner's next Battle Phase.
 ENGINE: no event at the start of the Battle Phase; the return is done when the Battle Phase's first response check runs. */
function rallisBack(g, c) {
  const r = c.f42rallis;
  if (!r || c.zone !== 'ban' || g.phase !== 'battle' || g.tp !== c.owner || g.turnNo <= r.turn || g.chain.length || g.inDS) return;
  c.f42rallis = null;
  if (freeM(g, c.owner) < 0) { move(g, c, 'gy', { reason: 'effect', destroyed: true }); log(g, 'Rallis the Star Bird had no zone to return to and was destroyed.'); return; }
  move(g, c, 'm', { ctrl: c.owner, pos: 'atk', reason: 'effect' }); c.summonType = 'special'; c.attacks = 0;
  log(g, 'Rallis the Star Bird returned to the field.');
}

// Ceremonial Tokens can only be Tributed for an Earthbound Immortal. PARTIAL: while their controller holds an Earthbound
// Immortal monster in hand they can be Tributed for any Tribute Summon. ENGINE: no per-summon Tribute filter and no
// "can't be Synchro Material" hook.
const isEI = x => isMon(x) && /^Earthbound Immortal/.test(D(x).n);

E.addScripts({
  /* ----- O ----- */
  'Obelisk the Tormentor': { cont: godLock,
    self: { tribExact: 3, cantBeTargeted: true, cantAttack: (g, c) => c.flags.obeliskUsed === g.turnNo },
    effs: [lockEff,
      { type: 'trig', mand: true, opt: true, label: 'Send it to the GY',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!c.summonType && !['normal', 'tribute'].includes(c.summonType),
        res: function* (g, c) { if (onField(c)) { move(g, c, 'gy', { reason: 'effect' }); log(g, `${name(c)} was sent to the GY.`); } } },
      { type: 'ign', tags: { destroy: 1 }, label: 'Tribute 2: destroy their monsters',
        cond: (g, c, p) => monsOf(g, p).filter(x => x !== c && !x.flags.noTribute).length >= 2 && monsOf(g, opp(p)).length > 0,
        cost: function* (g, c, p) { yield* tributeN(g, p, 2, 'Tribute 2 monsters', c); },
        after: (g, c) => { c.flags.obeliskUsed = g.turnNo; },
        res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)), { by: p, src: c }); } }] },
  // The ATK of the monster it battles, as it is during damage calculation.
  'Obnoxious Celtic Guard': { self: { noBattleDestroy: (g, c) => { const b = g.battle; if (!b) return false; const o = b.a === c ? b.t : b.t === c ? b.a : null; return !!o && onField(o) && atk(g, o) >= 1900; } } },
  'Obsidian Dragon': { effs: [{ type: 'quick', ds: true, label: 'Obsidian Dragon',
    cond: (g, c) => { obsidianScan(g, c); return false; }, res: noop }] },
  "Ocean's Keeper": { self: { piercing: true },
    effs: [{ type: 'trig', loc: 'any', mand: true, label: 'Add Thousand-Eyes Jellyfish or Cranium Fish',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.battle && ev.destroyed,
      res: function* (g, c, p) { yield* search(g, p, x => named(x, 'Thousand-Eyes Jellyfish') || named(x, 'Cranium Fish'), 'Add Thousand-Eyes Jellyfish or Cranium Fish to your hand'); } }] },
  'Offering to the Immortals': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && !g.aw.t && g.p[p].lp <= 3000 && nFreeM(g, p) >= 2 && g.p[p].deck.some(x => /Earthbound Immortal/.test(D(x).n)),
    res: function* (g, c, p) {
      negateAttack(g);
      if (nFreeM(g, p) < 2) return;
      const ts = tokens(g, p, { n: 'Ceremonial Token', a: 'EARTH', r: 'Rock', lv: 1, atk: 0, def: 0 }, 2, 'def');
      for (const t of ts) Object.defineProperty(t.flags, 'noTribute', { configurable: true, enumerable: true, get: () => !g.p[t.ctrl].hand.some(isEI) });
      if (ts.length < 2) return;
      yield* search(g, p, x => /Earthbound Immortal/.test(D(x).n), 'Add an Earthbound Immortal card to your hand'); } }] },
  'Ogre of the Scarlet Sorrow': {
    cont: { grant: (g, src, m, flag) => flag === 'noAttackTarget' && src.flags.f42ogre === g.turnNo && m !== src && m.ctrl === src.ctrl },
    effs: [dirWatch, { type: 'trig', loc: 'hand', when: true, tags: { ss: 1 }, label: 'Special Summon this card',
      on: (g, ev, c) => ev.type === 'attack' && ev.direct && ev.p !== c.owner && g.tp !== c.owner && !!g.f42dir && g.f42dir.turn === g.turnNo && g.f42dir.n === 2 && g.f42dir.last === ev.seq,
      cond: (g, c, p) => freeM(g, p) >= 0 && canSS(g, p, c),
      res: function* (g, c, p) {
        if (c.zone !== 'hand' || !ss(g, p, c, 'atk')) return;
        const f = g.f42dir && fieldMons(g).find(x => x.u === g.f42dir.first);
        if (f && faceUp(f)) { const A = atk(g, f), Dv = stat(g, f, 'def'); addMod(g, c, { set: A, which: 'atk' }); addMod(g, c, { set: Dv, which: 'def' }); log(g, `Ogre of the Scarlet Sorrow became ${A} ATK and ${Dv} DEF.`); }
        c.flags.f42ogre = g.turnNo; g.seq++; } }] },
  'Oilman': { cont: unionCont(true),
    effs: [...unionEffs(x => race(x) === 'Machine', 'Equip Oilman to which Machine?'),
      { type: 'trig', loc: 'st', mand: true, label: 'Draw 1 card',
        on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && !!c.flags.union && !!ev.killer && ev.killer.u === c.equipTo && ev.prevCtrl !== c.ctrl,
        res: function* (g, c, p) { draw(g, p, 1); } }] },
  'Ojamuscle': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: g => fieldMons(g).some(m => faceUp(m) && named(m, 'Ojama King')),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which face-up Ojama King?', fieldMons(g).filter(m => faceUp(m) && named(m, 'Ojama King')), 1, 1, 'good'); },
    res: function* (g, c, p, L2) {
      const k = L2.t[0];
      const gone = destroy(g, fieldMons(g).filter(m => m !== k && faceUp(m) && /Ojama/.test(name(m))), { by: p });
      if (k && onField(k) && faceUp(k) && gone.length) { addMod(g, k, { atk: 1000 * gone.length }); g.seq++; log(g, `${name(k)} gained ${1000 * gone.length} ATK.`); } } }] },
  // "The equipped monster can't attack the turn you activate this effect" (the Goggles hold the turn).
  'Omega Goggles': {
    cont: { forbid: (g, src, a) => a.type === 'attack' && !!src.equipTo && a.c.u === src.equipTo && src.flags.f42goggles === g.turnNo },
    effs: [equipAct(() => true, 'Equip to which of your face-up monsters?', true),
      { type: 'ign', loc: 'st', opt: true, label: 'Look at a random card in their hand',
        cond: (g, c, p) => !!c.equipTo && g.p[opp(p)].hand.length > 0,
        after: (g, c) => { c.flags.f42goggles = g.turnNo; g.seq++; },
        res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; log(g, `${PN(g, p)} looked at a random card in ${PN(g, opp(p))}'s hand: ${D(x).n}.`); } }] },
  // ENGINE: no response window after a battle destruction, so it is offered as the monster goes to the GY (see trapTrig).
  'Option Hunter': { effs: [trapTrig({ label: 'Gain LP equal to its original ATK',
    on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.battle && ev.destroyed && ev.to === 'gy' && ev.prevCtrl === c.ctrl && isMon(ev.c),
    res: function* (g, c, p, L2) { const x = L2.ev && L2.ev.c; if (x) gain(g, p, printedAtk(x)); } })] },
  'Oracle of the Sun': { proc: { label: 'Special Summon (only they control a monster)', cond: (g, c, p) => monsOf(g, p).length === 0 && monsOf(g, opp(p)).length > 0 },
    effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Add Fire Ant Ascator or Supay',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy',
      cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'Fire Ant Ascator') || named(x, 'Supay')),
      res: function* (g, c, p) { yield* search(g, p, x => named(x, 'Fire Ant Ascator') || named(x, 'Supay'), 'Add Fire Ant Ascator or Supay to your hand'); } }] },
  'Orb of Yasaka': {
    effs: [equipAct(m => /Spirit/.test(D(m).ab || ''), 'Equip to which face-up Spirit monster?', false, (g, c, t) => { c.f42orb = t.u; }),
      { type: 'trig', loc: 'st', mand: true, label: 'Gain LP',
        on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && !!ev.killer && ev.killer.u === c.equipTo && ev.prevCtrl !== ev.killer.ctrl,
        res: function* (g, c, p, L2) { gain(g, p, printedAtk(L2.ev.c)); } },
      { type: 'trig', loc: 'gy', mand: true, label: 'Return Orb of Yasaka to the hand',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'st' && ev.to === 'gy' && !ev.destroyed && c.f42orb != null && g.p[c.owner].hand.some(x => x.u === c.f42orb),
        res: function* (g, c, p) { c.f42orb = null; if (c.zone === 'gy') { move(g, c, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} returned Orb of Yasaka to the hand.`); } } }] },
  'Orbital Bombardment': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(m => /^Alien/.test(D(m).n)) && stOnField(g).some(x => x !== c),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Alien monster to the GY?', monsOf(g, p).filter(m => /^Alien/.test(D(m).n)), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell or Trap Card?', stOnField(g).filter(x => x !== c), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  'Orichalcos Shunoros': {
    self: { atk: (g, c) => 1000 * monsOf(g, opp(c.ctrl)).length },
    cont: { grant: (g, src, m, flag) => flag === 'noEffectDestroy' && faceUp(m) && D(m).k === 'normal' && lv(m) === 4 },
    effs: [lockEff, { type: 'trig', loc: 'hand', tags: { ss: 1 }, label: 'Special Summon this card',
      on: (g, ev, c) => {
        if (ev.type !== 'dsEnd') return false;
        for (let i = g.events.length - 1; i >= 0; i--) { const e = g.events[i]; if (e.type === 'dsStart') break;
          if (e.type === 'move' && e.battle && e.destroyed && e.wasField && D(e.c).k === 'normal' && e.prevCtrl === c.owner) return true; }
        return false; },
      cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { if (c.zone === 'hand') ss(g, p, c, 'atk'); } }] },
  'Oshaleon': {
    cont: { grant: (g, src, m, flag) => flag === 'noAttackTarget' && src.pos === 'atk' && m.ctrl === src.ctrl && !(faceUp(m) && name(m) === 'Oshaleon') },
    effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Add a Reptile with 500 or less ATK',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.battle && ev.destroyed && ev.to === 'gy',
      cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && race(x) === 'Reptile' && printedAtk(x) <= 500 && num(D(x).atk) >= 0),
      res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && race(x) === 'Reptile' && printedAtk(x) <= 500 && num(D(x).atk) >= 0, 'Add a Reptile with 500 or less ATK to your hand'); } }] },
  'Over Destiny': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(t => isMon(t) && /^Destiny HERO/.test(D(t).n) && g.p[p].deck.some(x => /^Destiny HERO/.test(D(x).n) && canSS(g, p, x) && lv(x) <= Math.floor(lv(t) / 2))),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which Destiny HERO in your GY?', g.p[p].gy.filter(t => isMon(t) && /^Destiny HERO/.test(D(t).n) && g.p[p].deck.some(x => /^Destiny HERO/.test(D(x).n) && canSS(g, p, x) && lv(x) <= Math.floor(lv(t) / 2))), 1, 1, 'good'); },
    res: function* (g, c, p, L2) {
      const t = L2.t[0]; if (!t || t.zone !== 'gy' || freeM(g, p) < 0) return; const n = Math.floor(lv(t) / 2);
      const xs = g.p[p].deck.filter(x => /^Destiny HERO/.test(D(x).n) && canSS(g, p, x) && lv(x) <= n); if (!xs.length) { shuffleDeck(g, p); return; }
      const [x] = yield* pick(g, p, 'Special Summon which Destiny HERO from your Deck?', xs, 1, 1, 'good');
      if (x && ss(g, p, x, 'atk')) x.flags.f42od = g.turnNo; shuffleDeck(g, p); } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the summoned Destiny HERO',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.owner === ev.tp && monsOf(g, c.owner).some(m => m.flags.f42od === g.turnNo),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => m.flags.f42od === g.turnNo), { by: p }); } }] },
  'Over Limit': { effs: [watch, { type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => g.p[p].lp > 500 && freeM(g, p) >= 0 && allCards(g, 'gy').some(x => D(x).k === 'normal' && x.f42bat === g.turnNo && printedAtk(x) <= 1000 && canSS(g, p, x)),
    cost: function* (g, c, p) { pay(g, p, 500); },
    res: function* (g, c, p) {
      let xs = allCards(g, 'gy').filter(x => D(x).k === 'normal' && x.f42bat === g.turnNo && printedAtk(x) <= 1000 && canSS(g, p, x));
      const n = Math.min(xs.length, nFreeM(g, p)); if (!n) return;
      if (xs.length > n) xs = yield* pick(g, p, `Special Summon which ${n} Normal Monster${n > 1 ? 's' : ''}?`, xs, n, n, 'good');
      for (const x of xs) if (x.zone === 'gy') ss(g, p, x, 'atk'); } }] },
  'Overdoom Line': { effs: [
    { type: 'act', res: function* (g, c) { c.flags.f42cd = 0; } },
    { type: 'trig', loc: 'st', mand: true, label: 'Plant gains 1000 ATK',
      on: (g, ev, c) => ev.type === 'move' && ev.from === 'gy' && ev.to === 'm' && ev.c.ctrl === c.ctrl && race(ev.c) === 'Plant' && faceUp(ev.c),
      res: function* (g, c, p, L2) { const m = L2.ev.c; if (onField(c) && faceUp(c) && onField(m) && faceUp(m)) { m.flags.f42doom = c.u; g.seq++; log(g, `${name(m)} gains 1000 ATK while Overdoom Line is face-up.`); } } },
    // destroyed in its controller's 2nd End Phase after activation (counted as a trigger with a chain link)
    { type: 'trig', loc: 'st', mand: true, label: 'Destroy Overdoom Line',
      on: (g, ev, c) => { if (ev.type !== 'phase' || ev.ph !== 'end' || ev.tp !== c.ctrl || c.flags.f42cd == null) return false; c.flags.f42cd++; return c.flags.f42cd >= 2; },
      res: function* (g, c) { if (onField(c)) destroy(g, [c], { rule: true }); } }],
    cont: { atk: (g, src, m) => m.flags.f42doom === src.u ? 1000 : 0 } },
  'Overwhelm': { effs: [{ type: 'act',
    cond: (g, c, p, x) => { const T = x.top; if (!T || T.negated) return false;
      if (!monsOf(g, p).some(m => faceUp(m) && lv(m) >= 7 && m.summonType === 'tribute')) return false;
      return (spellTrapAct(T) && isTrap(T.c)) || (isMon(T.c) && T.eff.type !== 'act'); },
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; T.negBy = p; negate(g, T, false); if (onField(T.c) || ['hand', 'gy'].includes(T.c.zone)) { if (onField(T.c)) destroy(g, [T.c], { by: p }); else { move(g, T.c, 'gy', { reason: 'effect', destroyed: true, by: p }); log(g, `${name(T.c)} was destroyed.`); } } } }] },
  'Overworked': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: g => fieldMons(g).some(m => faceUp(m) && atk(g, m) > origAtk(m)),
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => faceUp(m) && atk(g, m) > origAtk(m)), { by: p }); } }] },
  "Owner's Seal": { effs: [{ type: 'act',
    res: function* (g, c, p) {
      for (const m of fieldMons(g).filter(x => x.ctrl !== x.owner)) {
        if (!onField(m)) continue;
        if (freeM(g, m.owner) >= 0) { takeControl(g, m.owner, m, false); m.flags.ctrlUntil = null; m.flags.ctrlFrom = null; g.seq++; }
        else { move(g, m, 'gy', { reason: 'rule' }); log(g, `${name(m)} was sent to the GY.`); }
      } } }] },
  'Oxygeddon': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Each player takes 800 damage',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.battle && ev.destroyed && ev.to === 'gy' && !!ev.killer && race(ev.killer) === 'Pyro',
    res: function* (g, c, p) {
      // simultaneous: if both would drop to 0, the duel is a draw
      const q = opp(p);
      if (g.p[p].lp <= 800 && g.p[q].lp <= 800) { g.p[p].lp -= 800; log(g, `${PN(g, p)} took 800 damage.`); damage(g, q, 800, { src: c, srcP: p }); return; }
      if (g.p[p].lp <= 800) { damage(g, q, 800, { src: c, srcP: p }); damage(g, p, 800, { src: c, srcP: p }); return; }
      damage(g, p, 800, { src: c, srcP: p }); damage(g, q, 800, { src: c, srcP: p }); } }] },

  /* ----- P ----- */
  'Paladin of the Cursed Dragon': { effs: [watch, { type: 'ign', opt: true, tags: { ss: 1 }, label: 'Special Summon a Zombie from their GY',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[opp(p)].gy.some(x => isMon(x) && race(x) === 'Zombie' && lv(x) <= 4 && x.f42bat != null && canSS(g, p, x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Zombie from their GY?', g.p[opp(p)].gy.filter(x => isMon(x) && race(x) === 'Zombie' && lv(x) <= 4 && x.f42bat != null && canSS(g, p, x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  'Pandaborg': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Pay 800 LP: Special Summon a Level 4 Psychic',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => g.p[p].lp > 800,
    cost: function* (g, c, p) { pay(g, p, 800); },
    res: function* (g, c, p) {
      if (freeM(g, p) < 0) return;
      const xs = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Psychic' && lv(x) === 4 && canSS(g, p, x)); if (!xs.length) { shuffleDeck(g, p); return; }
      const [x] = yield* pick(g, p, 'Special Summon which Level 4 Psychic from your Deck?', xs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  'Panther Warrior': { self: tributeToAttack.self, effs: [tributeToAttack.eff] },
  'Paralyzing Chain': { effs: [actNoop, { type: 'trig', loc: 'st', mand: true, label: 'Inflict 300 damage',
    on: (g, ev, c) => ev.type === 'move' && ev.from === 'deck' && ev.to === 'gy' && ev.reason === 'effect' && ev.c.owner !== c.ctrl,
    res: function* (g, c, p) { damage(g, opp(p), 300, { src: c, srcP: p }); } }] },
  'Parasitic Ticky': { self: { atk: (g, c) => 500 * fieldMons(g).filter(x => D(x).k === 'token').length, def: (g, c) => 500 * fieldMons(g).filter(x => D(x).k === 'token').length } },
  // The Gladiator Beast goes back to the Deck as part of the effect (not a cost).
  'Parry': { effs: [{ type: 'act',
    cond: (g, c, p, x) => spellTrapAct(x.top) && isTrap(x.top.c) && !x.top.negated && g.p[p].hand.some(h => /Gladiator Beast/.test(D(h).n)),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) {
      const hs = g.p[p].hand.filter(h => /Gladiator Beast/.test(D(h).n));
      const [x] = yield* pick(g, p, 'Return which Gladiator Beast card to the Deck?', hs, 1, 1, 'cost');
      if (x) { move(g, x, 'deck', { reason: 'effect' }); log(g, `${PN(g, p)} showed and returned ${D(x).n} to the Deck.`); }
      const T = L2.data.L; T.negBy = p; negate(g, T, true); } }] },
  'Patroid': { effs: [{ type: 'ign', opt: true, label: 'Look at a face-down card',
    cond: (g, c, p) => fieldMons(g).concat(stOnField(g)).some(x => x.ctrl === opp(p) && x.pos === 'set'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Look at which face-down card?', [...monsOf(g, opp(p)), ...stOf(g, opp(p))].filter(x => x.pos === 'set'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.pos === 'set') log(g, `${PN(g, p)} looked at the face-down card: ${D(t).n}.`); } }] },
  'Perfectly Ultimate Great Moth': {
    proc: { label: 'Special Summon (Tribute Petit Moth in its Cocoon)',
      cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && named(m, 'Petit Moth') && stOnField(g).some(x => named(x, 'Cocoon of Evolution') && x.equipTo === m.u && x.flags.cocoon && x.flags.cocoonTurns >= 6)),
      cost: function* (g, c, p, grp) { const ms = monsOf(g, p).filter(m => faceUp(m) && named(m, 'Petit Moth') && stOnField(g).some(x => named(x, 'Cocoon of Evolution') && x.equipTo === m.u && x.flags.cocoon && x.flags.cocoonTurns >= 6));
        const [m] = yield* pick(g, p, 'Tribute which Petit Moth?', ms, 1, 1, 'cost'); if (m) { move(g, m, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Petit Moth.`); } c.f42proper = true; } },
    effs: [lockEff] },
  'Phalanx Pike': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 900 * allCards(g, 'gy').filter(x => D(x).n === name(m)).length : 0 },
    effs: [equipAct()] },
  'Phantasmal Martyrs': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => g.p[p].hand.filter(x => x !== c).length >= 2 && nFreeM(g, p) >= 3 && monsOf(g, p).some(m => faceUp(m) && (named(m, 'Uria, Lord of Searing Flames') || named(m, 'Hamon, Lord of Striking Thunder'))),
    cost: function* (g, c, p) { const h = g.p[p].hand.slice(); for (const x of h) move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent the whole hand to the GY.`); },
    res: function* (g, c, p) { if (nFreeM(g, p) < 3) return; tokens(g, p, { n: 'Phantasmal Martyr Token', a: 'DARK', r: 'Fiend', lv: 1, atk: 0, def: 0 }, 3, 'atk'); } }] },
  'Phoenix Gearfried': { effs: [
    { type: 'trig', tags: { ss: 1 }, label: 'Special Summon a Gemini from your GY',
      on: (g, ev, c) => !!c.flags.gemini && spellActBy(ev) === opp(c.ctrl),
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => gem(x) && canSS(g, p, x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Gemini monster from your GY?', g.p[p].gy.filter(x => gem(x) && canSS(g, p, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } },
    { type: 'quick', gemini: true, label: 'Send an Equip Card: negate',
      cond: (g, c, p, x) => { const T = x.top; return !!T && !T.negated && spellTrapAct(T) && (T.t || []).some(t => t && isMon(t) && t.zone === 'm') && stOf(g, p).some(e => faceUp(e) && !!e.equipTo); },
      cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; const [e] = yield* pick(g, p, 'Send which face-up Equip Card to the GY?', stOf(g, p).filter(e => faceUp(e) && !!e.equipTo), 1, 1, 'cost'); if (e) { move(g, e, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(e).n} to the GY.`); } },
      res: function* (g, c, p, L2) { const T = L2.data.L; T.negBy = p; negate(g, T, true); } }] },
  'Phoenixian Seed': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Send it: Special Summon Phoenixian Cluster Amaryllis',
    cond: (g, c, p) => g.p[p].hand.some(x => named(x, 'Phoenixian Cluster Amaryllis')),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Phoenixian Seed to the GY.`); },
    res: function* (g, c, p) { if (freeM(g, p) < 0) return; const xs = g.p[p].hand.filter(x => named(x, 'Phoenixian Cluster Amaryllis')); const [x] = yield* pick(g, p, 'Special Summon Phoenixian Cluster Amaryllis', xs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  // Cyber Laser Dragon's own lock (full-04.js) lets it be Special Summoned while this card is face-up and resolving.
  'Photon Generator Unit': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).filter(m => faceUp(m) && cyberDragon(m) && !m.flags.noTribute).length >= 2 && [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].some(x => named(x, 'Cyber Laser Dragon')),
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Tribute 2 Cyber Dragons', monsOf(g, p).filter(m => faceUp(m) && cyberDragon(m) && !m.flags.noTribute), 2, 2, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${xs.map(x => D(x).n).join(' and ')}.`); },
    res: function* (g, c, p) {
      if (freeM(g, p) < 0) return;
      const xs = [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].filter(x => named(x, 'Cyber Laser Dragon')); if (!xs.length) return;
      const [x] = yield* pick(g, p, 'Special Summon Cyber Laser Dragon from where?', xs, 1, 1, 'good'); if (!x) return;
      const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } }] },
  // When all your monsters have the same ATK, none can be attacked; the engine would then allow a direct attack, so attacks are blocked.
  'Pixie Ring': { effs: [actNoop],
    cont: {
      grant: (g, src, m, flag) => { if (flag !== 'noAttackTarget' || m.ctrl !== src.ctrl || !faceUp(m)) return false;
        const ms = monsOf(g, src.ctrl); if (ms.filter(x => x.pos === 'atk').length < 2) return false;
        const fu = ms.filter(faceUp); const lo = Math.min(...fu.map(x => atk(g, x))); return atk(g, m) === lo; },
      forbid: (g, src, a) => { if (a.type !== 'attack' || !a.c || a.c.ctrl === src.ctrl || has(g, a.c, 'directAttack')) return false;
        const ms = monsOf(g, src.ctrl); return ms.length > 0 && ms.every(m => faceUp(m) && has(g, m, 'noAttackTarget')); } } },
  'Plague Wolf': { effs: [
    { type: 'ign', opt: true, label: 'Double its ATK',
      res: function* (g, c) { if (!onField(c) || !faceUp(c)) return; addMod(g, c, { set: 2 * baseAtk(c), which: 'atk', end: true }); c.flags.f42wolf = g.turnNo; g.seq++; log(g, `Plague Wolf's ATK became ${2 * baseAtk(c)}.`); } },
    { type: 'trig', mand: true, opt: true, tags: { destroy: 1 }, label: 'Destroy Plague Wolf',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.f42wolf === g.turnNo,
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  // A Normal Trap that stays on the field as an Equip Card.
  'Plant Food Chain': {
    cont: { atk: (g, src, m) => src.flags.f42pfc && src.equipTo === m.u ? 500 : 0 },
    effs: [{ type: 'act',
      cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && race(m) === 'Plant'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which face-up Plant?', monsOf(g, p).filter(m => faceUp(m) && race(m) === 'Plant'), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && race(t) === 'Plant' && t.ctrl === p && onField(c) && equip(g, c, t)) { c.flags.f42pfc = true; L2.keep = true; g.seq++; } } },
    { type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon a Plant from your GY',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'st' && ev.destroyed && !ev.battle && !!ev.snap && !!ev.snap.flags && !!ev.snap.flags.f42pfc,
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && race(x) === 'Plant' && canSS(g, p, x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Plant from your GY?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Plant' && canSS(g, p, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  'Pollinosis': { effs: [{ type: 'act', negSummon: true,
    cond: (g, c, p, x) => monsOf(g, p).some(m => race(m) === 'Plant' && !m.flags.noTribute) &&
      ((!x.top && !!g.attempt && g.attempt.how !== 'flip') || (spellTrapAct(x.top) && !x.top.negated)),
    cost: function* (g, c, p, L2) { L2.data.mode = g.chain.length ? 'link' : 'summon'; L2.data.L = g.chain[g.chain.length - 1];
      const [m] = yield* pick(g, p, 'Tribute a Plant monster', monsOf(g, p).filter(m => race(m) === 'Plant' && !m.flags.noTribute), 1, 1, 'cost');
      if (m) { const nm = m.pos === 'set' ? 'a face-down monster' : D(m).n; move(g, m, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); } },
    res: function* (g, c, p, L2) { if (L2.data.mode === 'summon') { if (g.attempt) { g.attempt.negated = true; log(g, 'The summon was negated.'); } } else { L2.data.L.negBy = p; negate(g, L2.data.L, true); } } }] },
  'Portable Battery Pack': { effs: [
    { type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => nFreeM(g, p) >= 2 && g.p[p].gy.filter(x => isMon(x) && /Batteryman/.test(D(x).n) && canSS(g, p, x)).length >= 2,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which 2 Batteryman monsters?', g.p[p].gy.filter(x => isMon(x) && /Batteryman/.test(D(x).n) && canSS(g, p, x)), 2, 2, 'good'); },
      res: function* (g, c, p, L2) {
        if (!onField(c)) return; let xs = L2.t.filter(x => x.zone === 'gy');
        if (xs.length > nFreeM(g, p)) xs = yield* pick(g, p, 'Special Summon which Batteryman?', xs, nFreeM(g, p), nFreeM(g, p), 'good');
        for (const x of xs) if (ss(g, p, x, 'atk')) x.flags.f42pbp = c.u;
        if (fieldMons(g).some(m => m.flags.f42pbp === c.u)) { c.flags.f42pbpOn = true; g.seq++; } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the Batteryman monsters',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && fieldMons(g).some(m => m.flags.f42pbp === c.u),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => m.flags.f42pbp === c.u), { by: p }); } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy Portable Battery Pack',
      on: (g, ev, c) => !!c.flags.f42pbpOn && !fieldMons(g).some(m => m.flags.f42pbp === c.u),
      res: function* (g, c, p) { if (onField(c)) { c.flags.f42pbpOn = false; destroy(g, [c], { by: p }); } } }] },
  'Powered Tuner': { self: { atk: g => 500 * fieldMons(g).filter(x => faceUp(x) && D(x).tu).length } },
  'Pragtical': { effs: [] }, // Fusion Monster with no effect; the recipe is read from its text
  'Prepare to Strike Back': { effs: [actNoop, { type: 'trig', loc: 'st', mand: true, label: 'Toss a coin',
    on: (g, ev, c) => ev.type === 'attack' && !!ev.t && ev.p !== c.ctrl && ev.t.ctrl === c.ctrl && faceUp(ev.t) && ev.t.pos === 'def',
    res: function* (g, c, p, L2) {
      const t = L2.ev.t, a = L2.ev.a; if (!onField(t) || !faceUp(t)) return;
      const call = yield* choose(g, p, 'Call the coin toss', ['Heads', 'Tails']); const h = coin(g, p);
      if ((call === 0) === h) { log(g, `${PN(g, p)} called it right.`); toPos(g, t, 'atk', p); }
      else { log(g, `${PN(g, p)} called it wrong.`); const n = onField(a) ? atk(g, a) - stat(g, t, 'def') : 0; if (n > 0) damage(g, p, n, { src: c, srcP: p }); } } }] },
  'Prevention Star': {
    cont: { forbid: (g, src, a) => ['attack', 'pos'].includes(a.type) && !!src.equipTo && !!a.c && a.c.u === src.flags.f42sel },
    effs: [watch, { type: 'act',
      cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && m.flags.f42toDef === g.turnNo) && monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) {
        const [m] = yield* pick(g, p, 'Equip to which of your monsters?', monsOf(g, p).filter(m => faceUp(m) && m.flags.f42toDef === g.turnNo), 1, 1, 'good');
        const [s] = yield* tgt(g, p, L2, 'Select which of their monsters?', monsOf(g, opp(p)), 1, 1, 'bad');
        L2.t = [m, s].filter(Boolean); L2.data.m = m; L2.data.s = s; },
      res: function* (g, c, p, L2) { const m = L2.data.m, s = L2.data.s; if (!m || !onField(m) || !faceUp(m) || m.ctrl !== p || !onField(c) || !equip(g, c, m)) return;
        c.flags.f42eq = m.u; if (s && onField(s) && s.zone === 'm') { c.flags.f42sel = s.u; log(g, `${s.pos === 'set' ? 'The face-down monster' : name(s)} can't attack or change its battle position.`); } g.seq++; } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Banish the selected monster',
      on: (g, ev, c) => { if (ev.type !== 'move' || ev.c !== c || ev.from !== 'st' || ev.to !== 'gy' || ev.destroyed || !ev.snap || !ev.snap.flags || !ev.snap.flags.f42sel) return false;
        const eu = ev.snap.flags.f42eq; return g.events.some(e => e.type === 'move' && e.c.u === eu && e.destroyed && e.group === ev.group); },
      res: function* (g, c, p, L2) { const u = L2.ev.snap.flags.f42sel; const s = fieldMons(g).find(x => x.u === u); if (s) { move(g, s, 'ban', { reason: 'effect', by: p }); log(g, `${D(s).n} was banished.`); } } }] },
  'Pride of the Weak': { effs: [actNoop, { type: 'trig', loc: 'st', mand: true, label: 'Draw 2 cards',
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && ev.c.zone === 'gy' && !!ev.killer && ev.killer.ctrl === c.ctrl && ev.prevCtrl !== c.ctrl && lv(ev.killer) <= 2 && g.p[c.ctrl].hand.length === 0,
    res: function* (g, c, p) { if (!g.p[p].hand.length) draw(g, p, 2); } }] },
  // ENGINE: no window during damage calculation; it is activated in the Damage Step windows (the boost ends with that battle).
  'Prideful Roar': { effs: [roarStrip, { type: 'act', ds: true,
    cond: (g, c, p) => { const b = g.battle; if (!g.inDS || !b || !b.t) return false; const m = b.a.ctrl === p ? b.a : b.t, o = m === b.a ? b.t : b.a;
      return m.ctrl === p && o.ctrl !== p && faceUp(m) && faceUp(o) && atk(g, o) > atk(g, m) && g.p[p].lp > atk(g, o) - atk(g, m); },
    cost: function* (g, c, p, L2) { const b = g.battle; const m = b.a.ctrl === p ? b.a : b.t, o = m === b.a ? b.t : b.a; const n = atk(g, o) - atk(g, m); L2.data = { m, o, n }; pay(g, p, n); },
    res: function* (g, c, p, L2) { const { m, o, n } = L2.data; if (!onField(m) || !faceUp(m) || !onField(o) || atk(g, m) > atk(g, o)) return;
      addMod(g, m, { atk: n + 300, end: true, f42roar: true }); g.seq++; log(g, `${name(m)} gained ${n + 300} ATK for damage calculation.`); } }] },
  'Prime Material Falcon': { effs: [{ type: 'quick', ds: true, label: 'Discard: negate the effect',
    cond: (g, c, p, x) => { const T = x.top; if (!T || T.negated || !isMon(T.c) || T.eff.type === 'act' || !(T.tags && T.tags.destroy) || !g.p[p].hand.length) return false;
      return (T.t || []).some(t => t && isST(t) && onField(t)) || /destroy[^.]*(Spell|Trap)/i.test(D(T.c).tx || ''); },
    cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; const [x] = yield* pick(g, p, 'Send 1 card from your hand to the GY', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
    res: function* (g, c, p, L2) { const T = L2.data.L; T.negBy = p; negate(g, T, true); } }] },
  'Prometheus, King of the Shadows': { effs: [{ type: 'trig', mand: true, label: 'Banish DARK monsters for ATK',
    on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
    res: function* (g, c, p) {
      const ds = g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK'); if (!ds.length) return;
      const xs = yield* pick(g, p, 'Banish 1 or more DARK monsters from your GY', ds, 1, ds.length, 'good');
      for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: p }); if (xs.length) log(g, `${PN(g, p)} banished ${xs.map(x => D(x).n).join(', ')}.`);
      if (xs.length && onField(c) && faceUp(c)) { addMod(g, c, { atk: 400 * xs.length, end: true }); log(g, `Prometheus, King of the Shadows gained ${400 * xs.length} ATK.`); } } }] },
  'Proof of Powerlessness': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && lv(m) >= 7),
    res: function* (g, c, p) {
      destroy(g, monsOf(g, opp(p)).filter(m => faceUp(m) && lv(m) <= 5), { by: p });
      addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.ctrl === p && !has(g2, a.c, 'unaffectedTraps'), { end: g.turnNo }); log(g, `${PN(g, p)}'s monsters can't attack this turn.`); } }] },
  'Protective Soul Ailin': { cont: unionCont(false),
    effs: [...unionEffs(x => named(x, 'Indomitable Fighter Lei Lei'), 'Equip Protective Soul Ailin to which Indomitable Fighter Lei Lei?'),
      { type: 'ign', loc: 'st', opt: true, label: 'Change the equipped monster\'s battle position',
        cond: (g, c, p) => !!c.flags.union && monsOf(g, p).some(m => m.u === c.equipTo && faceUp(m)),
        res: function* (g, c, p) { const m = monsOf(g, p).find(x => x.u === c.equipTo); if (m && faceUp(m)) toPos(g, m, m.pos === 'atk' ? 'def' : 'atk', p); } }] },
  // ENGINE: name() can't be changed by a script, so only the Cyber cards of full-04.js and this batch read it as "Cyber Dragon".
  'Proto-Cyber Dragon': { effs: [] },
  // ENGINE: a Field Spell can't copy another Field Spell's effects (c.flags.copyEffs copies monster effects only), and
  // its name can't change. PARTIAL: the cost is paid and nothing more happens.
  'Pseudo Space': { effs: [actNoop, { type: 'ign', loc: 'fz', opt: true, label: 'Banish a Field Spell from your GY',
    cond: (g, c, p) => g.p[p].gy.some(x => isSpell(x) && D(x).sub === 'Field'),
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Banish which Field Spell from your GY?', g.p[p].gy.filter(x => isSpell(x) && D(x).sub === 'Field'), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost' }); L2.data.n = D(x).n; log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
    res: function* (g, c, p, L2) { if (L2.data.n) log(g, `Pseudo Space is treated as ${L2.data.n} until the End Phase.`); } }] },
  'Psychokinesis': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && race(m) === 'Psychic') && allField(g).some(x => x !== c),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', allField(g).filter(x => x !== c), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { if (destroy(g, live(L2), { by: p }).length) damage(g, p, 1000, { src: c, srcP: p }); } }] },
  'Pursuit Chaser': { effs: [{ type: 'trig', mand: true, label: 'Inflict 500 damage',
    on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.battle && ev.destroyed && ev.to === 'gy' && ev.c !== c && !!ev.snap && ev.snap.pos !== 'atk' && ev.snap.mon,
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  "Queen's Bodyguard": { cont: { grant: (g, src, m, flag) => flag === 'noAttackTarget' && m.ctrl === src.ctrl && faceUp(m) && /^Allure Queen/.test(name(m)) } },
  'Quick Charger': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && /Batteryman/.test(D(x).n) && lv(x) <= 4).length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which 2 Batteryman monsters to your hand?', g.p[p].gy.filter(x => isMon(x) && /Batteryman/.test(D(x).n) && lv(x) <= 4), 2, 2, 'good'); },
    res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'hand', { reason: 'effect' }); if (xs.length) log(g, `${PN(g, p)} added ${xs.map(x => D(x).n).join(' and ')} to the hand.`); } }] },
  'Quillbolt Hedgehog': { effs: [{ type: 'ign', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon from the GY',
    cond: (g, c, p) => freeM(g, p) >= 0 && monsOf(g, p).some(m => faceUp(m) && D(m).tu),
    res: function* (g, c, p) { if (c.zone === 'gy' && monsOf(g, p).some(m => faceUp(m) && D(m).tu)) ss(g, p, c, 'atk', { banishOnLeave: true }); } }] },

  /* ----- R ----- */
  'Rai-Jin': {
    cont: { atk: (g, src, m) => m.ctrl === src.ctrl && attr(m) === 'LIGHT' ? 100 * g.p[src.ctrl].gy.filter(x => isMon(x) && attr(x) === 'LIGHT').length : 0 },
    effs: [lockEff, { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy 1 LIGHT monster you control',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      res: function* (g, c, p) { const ms = monsOf(g, p).filter(m => faceUp(m) && attr(m) === 'LIGHT'); if (!ms.length) return; const [x] = yield* pick(g, p, 'Destroy which LIGHT monster you control?', ms, 1, 1, 'cost'); if (x) destroy(g, [x], { by: p }); } }] },
  'Rain Storm': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && /^Cloudian/.test(name(m)) && atk(g, m) >= 1000),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which Cloudian?', monsOf(g, p).filter(m => faceUp(m) && /^Cloudian/.test(name(m)) && atk(g, m) >= 1000), 1, 1, 'good'); },
    res: function* (g, c, p, L2) {
      const t = live(L2)[0]; if (!t || !faceUp(t)) return; const A = atk(g, t); if (A < 1000) return;
      const opts = A >= 2000 ? ['1000: destroy 1 Spell or Trap', '2000: destroy 2 cards'] : ['1000: destroy 1 Spell or Trap'];
      const i = yield* choose(g, p, 'Reduce its ATK by how much?', opts);
      addMod(g, t, { atk: i ? -2000 : -1000 }); g.seq++; log(g, `${name(t)} lost ${i ? 2000 : 1000} ATK.`);
      const cs = i ? fieldMons(g).concat(stOnField(g)).filter(x => x.ctrl === opp(p)) : stOf(g, opp(p));
      if (!cs.length) return; const xs = yield* pick(g, p, i ? 'Destroy which 2 cards?' : 'Destroy which Spell or Trap?', cs, Math.min(i ? 2 : 1, cs.length), i ? 2 : 1, 'bad');
      destroy(g, xs, { by: p }); } }] },
  'Rallis the Star Bird': {
    self: { atk: (g, c) => { const b = g.battle; if (!g.inDS || !b || (b.a !== c && b.t !== c)) return 0; const o = b.a === c ? b.t : b.a; return o && onField(o) && faceUp(o) ? 200 * lv(o) : 0; } },
    effs: [{ type: 'trig', mand: true, label: 'Banish it until your next Battle Phase',
      on: (g, ev, c) => ev.type === 'dsEnd' && ev.a === c,
      res: function* (g, c, p) { if (!onField(c) || c.zone !== 'm') return; const turn = g.turnNo, own = c.owner; move(g, c, 'ban', { reason: 'effect', by: p }); c.f42rallis = { turn, own }; log(g, 'Rallis the Star Bird was banished until the next Battle Phase.'); } },
      { type: 'quick', loc: 'ban', label: 'Rallis returns', cond: (g, c) => { rallisBack(g, c); return false; }, res: noop }] },
});
})();
