/* Full pool batch 14: Ryu Kokki to Soul-Absorbing Bone Tower (build/batches/full/full-14.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text; cards with a
 Goat-only script elsewhere (Ryu Kokki, Ryu Senshi, Secret Barrel, Shadow Ghoul, Shadow of Eyes, Shadow Spell, Shield & Sword,
 Sinister Serpent, Skull Dice, Skull Invitation, Skull-Mark Ladybug) are ported here as the shared version; the Goat-only
 scripts keep winning while Goat is loaded. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, addMod,
  equip, link, addCtr, ctr, negateAttack, addRule, tokens, coin, dice,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned,
  isGemini, stat, num, forbid, emit, isExtraD } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const txt = c => D(c).tx || '';
const isFlipMon = c => isMon(c) && (!!D(c).flip || /Flip/.test(D(c).ab || ''));
const isNormalMon = c => isMon(c) && (D(c).k === 'normal' || isGemini(c));
const baseDef = c => num(D(c).def);
// a monster changes battle position by a card effect (logged and announced, no chain)
function flipPos(g, c, to) {
  if (!onField(c) || c.zone !== 'm' || !faceUp(c)) return;
  const from = c.pos; to = to || (c.pos === 'atk' ? 'def' : 'atk'); if (from === to) return;
  c.pos = to; g.seq++; log(g, `${name(c)} was changed to ${to === 'atk' ? 'Attack' : 'Defense'} Position.`);
  emit(g, { type: 'pos', c, p: c.ctrl, from });
}
// "Cannot be Special Summoned by other ways": ENGINE: there is no generic "can't be Special Summoned" flag, so only
// Special Summons from the GY are blocked (build/ENGINE_TODO.md).
const noSSFromGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src };
// Negate the effect of a chain link (the card still resolves as negated; destroyIt also destroys the card).
function negLink(g, T, p, destroyIt) { if (!T || T.negated) return; T.negated = true; T.negBy = p; log(g, `${name(T.c)}'s effect was negated.`); if (destroyIt && onField(T.c)) destroy(g, [T.c], { by: p }); }
// "Negate X effects that target this card": a Spell Speed 3 response to the link that targets it.
// ENGINE: no hook when a link picks its targets or before it resolves, so this is offered as an optional response.
const negTargeting = (pred, label, destroyIt) => ({ type: 'quick', speed: 3, ds: true, label,
  cond: (g, c, p, x) => { const t = x.top; return !!(t && !t.negated && t.c !== c && (t.t || []).includes(c) && faceUp(c) && pred(g, c, t)); },
  target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
  res: function* (g, c, p, L2) { if (onField(c) && faceUp(c)) negLink(g, L2.data.L, p, destroyIt); } });
// "Unaffected by your opponent's Spell effects": their Spells can't target it.
// Spells that don't target (Dark Hole, Raigeki): the engine's unaffectedSpells destruction check, read against the chain
// link resolving now (g.resolvingL), so only the opponent's Spells pass it by. PARTIAL: covers targeting and destruction.
const noOppSpells = { cantBeTargeted: true, targetFilter: (g, x, L2) => !!L2 && !!L2.c && isSpell(L2.c) && L2.p !== x.ctrl,
  unaffectedSpells: (g, c) => !!g.resolvingL && g.resolvingL.p !== c.ctrl };
// LV monsters: send this face-up card to the GY; Special Summon the next LV from the hand or Deck
function* lvUp(g, c, p, next) {
  const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, next)); if (!cs.length || freeM(g, p) < 0) return;
  const [x] = yield* pick(g, p, `Special Summon ${next} from your hand or Deck`, cs, 1, 1, 'good');
  if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); }
}
const lvCost = function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${name(c)} to the GY.`); };

/* A Trap that answers a moment with no response window in the engine (a destruction, a Set), ported from classic-5.js:
 a trigger that only fires while the card is Set (and wasn't Set this turn). It flips the card face-up, counts as a Trap
 Card activation at Spell Speed 2 (Solemn Judgment can negate it), and sends the card to the GY after it resolves.
 ENGINE: no response window after a monster is destroyed or Set, so these Traps act as optional triggers. */
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });

// Spell/Trap continuous lock on one monster (Shadow Spell), from classic-5.js: the held monster's u is c.flags.hold.
const holdLock = { forbid: (g, src, a) => (a.type === 'attack' || a.type === 'pos') && a.c && a.c.u === src.flags.hold };
const holdGone = { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 },
  on: (g, ev, c) => faceUp(c) && c.flags.hold && ev.type === 'move' && ev.c.u === c.flags.hold && ev.wasField && ev.to !== 'm',
  res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } };

// "It can attack directly this turn" (Shadow Delver): a direct-attack flag cleared at the End Phase by any copy of the card.
const directClear = { type: 'trig', loc: 'any', res: noop,
  on: (g, ev) => { if (ev.type === 'phase' && ev.ph === 'end') for (const m of fieldMons(g)) if (m.flags.f14dir && m.flags.f14dir <= g.turnNo) { m.flags.f14dir = 0; m.flags.directAttack = false; } return false; } };
// Secret Pass to the Treasures: the direct attack only while the monster has 1000 or less ATK (a guard against loops)
let PASSING = 0;
const passAtkOk = (g, c) => { if (PASSING) return false; PASSING++; try { return stat(g, c, 'atk') <= 1000; } finally { PASSING--; } };

// would this monster be destroyed by the battle now? (Shield Warrior; face-down monsters can't be judged yet)
function wouldDie(g, m) {
  const b = g.battle; if (!b || !b.t || !onField(m) || m.zone !== 'm') return false;
  const { a, t } = b; if (t.pos === 'set') return false;
  const A = stat(g, a, 'atk');
  if (m === a) return t.pos === 'atk' && stat(g, t, 'atk') >= A;
  if (m === t) return t.pos === 'atk' ? A >= stat(g, t, 'atk') : A > stat(g, t, 'def');
  return false;
}
// the battle damage player p took in the battle that just ended (Sinister Seeds)
function lastBattleDamage(g, p) {
  for (let i = g.events.length - 1; i >= 0; i--) { const e = g.events[i]; if (e.type === 'dsStart') return 0; if (e.type === 'damage' && e.battle && e.p === p) return e.n; }
  return 0;
}
// Skull Conductor: one or two Zombies in the hand whose printed ATK adds up to exactly 2000 (no "?" ATK)
function conductorSets(g, p, not) {
  const zs = g.p[p].hand.filter(x => x !== not && isMon(x) && race(x) === 'Zombie' && /^\d+$/.test(String(D(x).atk)) && !forbid(g, { type: 'ss', c: x, p, how: 'special' }));
  const out = [], free = nFreeM(g, p);
  for (const x of zs) if (num(D(x).atk) === 2000 && free >= 1) out.push([x]);
  for (let i = 0; i < zs.length; i++) for (let j = i + 1; j < zs.length; j++) if (num(D(zs[i]).atk) + num(D(zs[j]).atk) === 2000 && free >= 2) out.push([zs[i], zs[j]]);
  return out;
}
const bambooOn = (g, m) => stOnField(g).some(x => faceUp(x) && x.equipTo === m.u && /Bamboo Sword/.test(D(x).n));
const lvFour = (g, p, x) => isMon(x) && lv(x) === 4 && !isExtraD(D(x)) && !['ritual', 'token'].includes(D(x).k) && !/Cannot be Special Summoned|Must be Special Summoned|Cannot be Normal Summoned/i.test(txt(x)) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });

/* ----- Sasuke Samurai #2 and Skull Knight #2 (shared with their Goat names) ----- */
const sasuke2 = { effs: [{ type: 'ign', opt: true, label: 'Pay 800: no Spells or Traps this turn',
  cond: (g, c, p) => g.p[p].lp > 800,
  cost: function* (g, c, p) { pay(g, p, 800); },
  res: function* (g, c, p) { addRule(g, (g2, a) => a.type === 'activate' && a.c && isST(a.c), { end: g.turnNo }); log(g, 'Spell and Trap Cards can’t be activated until the End Phase.'); } }] };
// "If you Tribute Summon (or Tribute Set) a Fiend by Tributing this monster": the player who Tributed it Summons another
// copy from their Deck. A monster Tributed from the opponent's side (Soul Exchange) doesn't count (ruling 2).
const tribEvent = (g, c) => g.events.slice().reverse().find(e => e.type === 'move' && e.c === c && e.reason === 'tribute');
const skullKnight2 = { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon another copy',
  on: (g, ev, c) => {
    let m = null;
    if (ev.type === 'summon' && ev.how === 'tribute' && ev.tribs && ev.tribs.includes(c)) m = ev.cs[0];
    else if (ev.type === 'set' && ev.c.tributes && ev.c.tributes.includes(c.u)) m = ev.c;
    if (!m || race(m) !== 'Fiend') return false;
    const te = tribEvent(g, c); return !!te && te.prevCtrl === ev.p; },
  res: function* (g, c, p, L2) { const q = L2.ev ? L2.ev.p : p; const cs = g.p[q].deck.filter(x => named(x, D(c).n)); if (!cs.length || freeM(g, q) < 0) { shuffleDeck(g, q); return; }
    const [x] = yield* pick(g, q, `Special Summon ${D(c).n} from your Deck`, cs, 1, 1, 'good'); if (x) ss(g, q, x, 'atk'); shuffleDeck(g, q); } }] };
// FLIP: take control of a Fiend until the End Phase
const shadowTamer = { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Take control of a Fiend', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
  cond: (g, c, p) => oppFaceUp(g, p).some(x => race(x) === 'Fiend') && freeM(g, p) >= 0,
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which Fiend?', oppFaceUp(g, p).filter(x => race(x) === 'Fiend'), 1, 1, 'bad'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && race(t) === 'Fiend' && t.ctrl !== p) takeControl(g, p, t, true); } }] };

E.addScripts({
  /* ----- Ryu ----- */
  // Port of goat-3.js. It still applies if Ryu Kokki itself was destroyed by the battle (ruling), so it looks from the GY too.
  'Ryu Kokki': { effs: [{ type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the Warrior or Spellcaster',
    on: (g, ev, c) => ev.type === 'dsEnd' && (ev.a === c || ev.t === c) && (c.zone === 'm' || c.zone === 'gy') && (() => { const o = ev.a === c ? ev.t : ev.a; return !!o && onField(o) && faceUp(o) && ['Warrior', 'Spellcaster'].includes(race(o)); })(),
    res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; if (o && onField(o) && o.zone === 'm') destroy(g, [o], { by: p, src: c }); } }] },
  // Port of goat-4.js. PARTIAL: the Spell negation (not optional on the card) is a Spell Speed 3 response here.
  'Ryu Senshi': { effs: [
    { type: 'quick', ds: true, label: 'Pay 1000: negate the Normal Trap',
      cond: (g, c, p, x) => { const t = x.top; return !!(t && t.cardAct && isTrap(t.c) && D(t.c).sub === 'Normal' && !t.negated) && g.p[p].lp > 1000; },
      cost: function* (g, c, p, L2) { pay(g, p, 1000); L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { if (onField(c) && faceUp(c)) negLink(g, L2.data.L, p, false); } },
    negTargeting((g, c, t) => isSpell(t.c), 'Negate the Spell targeting it', true)] },
  // Mandatory, every kind of Summon (face-up only). It can pick itself.
  'Ryu-Kishin Clown': { effs: [{ type: 'trig', mand: true, label: 'Change a monster’s position',
    on: (g, ev, c) => evSummoned(ev, c) && faceUp(c), cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change the battle position of which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) flipPos(g, t); } }] },

  /* ----- Sasuke Samurai ----- */
  // The face-down monster is destroyed before it is flipped, so there is no damage calculation (the Damage Step ends).
  'Sasuke Samurai': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the face-down monster',
    on: (g, ev, c) => ev.type === 'dsStart' && ev.a === c && !!ev.t && ev.t.pos === 'set',
    res: function* (g, c, p, L2) { const t = L2.ev.t; if (t && onField(t) && t.pos === 'set') destroy(g, [t], { by: p, src: c }); } }] },
  'Sasuke Samurai 2': sasuke2,
  'Sasuke Samurai 3': { effs: [{ type: 'trig', mand: true, label: 'Opponent draws to 7',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    res: function* (g, c, p) { const o = opp(p), n = 7 - g.p[o].hand.length; if (n > 0) draw(g, o, n); } }] },
  // At the start of the Damage Step (ruling), before a face-down monster is flipped.
  'Sasuke Samurai 4': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Toss a coin',
    on: (g, ev, c) => ev.type === 'dsStart' && (ev.a === c || ev.t === c) && !!ev.t,
    res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; if (!o || !onField(o)) return;
      const call = yield* choose(g, p, 'Call the coin toss', ['Heads', 'Tails']); log(g, `${PN(g, p)} called ${call ? 'Tails' : 'Heads'}.`);
      const heads = coin(g, p); if (heads === (call === 0)) destroy(g, [o], { by: p, src: c }); else log(g, 'The call was wrong.'); } }] },

  /* ----- Secret ----- */
  // Port of goat-2.js: counted when it resolves, so a card chained to it still counts.
  'Secret Barrel': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length + fieldOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { const n = g.p[opp(p)].hand.length + fieldOf(g, opp(p)).length; if (n) damage(g, opp(p), 200 * n, { src: c, srcP: p }); } }] },
  // The direct attack is allowed only while the monster has 1000 or less ATK. PARTIAL: it works from the GY, so the
  // effect stops if Secret Pass leaves the GY that turn.
  'Secret Pass to the Treasures': {
    cont: { loc: 'gy', grant: (g, src, c, flag) => flag === 'directAttack' && onField(c) && c.flags.f14pass === g.turnNo && passAtkOk(g, c) },
    effs: [{ type: 'act', cond: (g, c, p) => g.phase === 'main1' && g.turnNo > 1 && monsOf(g, p).some(x => faceUp(x) && atk(g, x) <= 1000),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster can attack directly?', monsOf(g, p).filter(x => faceUp(x) && atk(g, x) <= 1000), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { t.flags.f14pass = g.turnNo; log(g, `${name(t)} can attack directly this turn.`); } } }] },
  // Spell Card activations only (ruling: Spell effects like Magical Blast's still work). Face-up Spellcasters count.
  'Secret Village of the Spellcasters': {
    cont: { forbid: (g, src, a) => {
      if (a.type !== 'activate' || !a.c || !isSpell(a.c) || !a.eff || a.eff.type !== 'act') return false;
      const sc = q => monsOf(g, q).some(m => faceUp(m) && race(m) === 'Spellcaster'), me = src.ctrl;
      if (a.p === opp(me) && sc(me) && !sc(opp(me))) return true;
      if (a.p === me && !sc(me)) return true;
      return false; } },
    effs: [{ type: 'act', res: noop }] },

  /* ----- Shadow ----- */
  'Shadow Delver': { effs: [directClear, { type: 'ign', opt: true, gemini: true, label: 'A DARK can attack directly',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && lv(x) <= 4 && attr(x) === 'DARK'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Level 4 or lower DARK can attack directly?', monsOf(g, p).filter(x => faceUp(x) && lv(x) <= 4 && attr(x) === 'DARK'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { t.flags.directAttack = true; t.flags.f14dir = g.turnNo; log(g, `${name(t)} can attack directly this turn.`); } } }] },
  'Shadow Ghoul': { self: { atk: (g, c) => 100 * g.p[c.ctrl].gy.filter(isMon).length } },
  // Port of classic-5.js. Also when monsters are Special Summoned face-down (ruling).
  'Shadow of Eyes': { effs: [trapTrig({ label: 'Change the Set monster to Attack Position',
    on: (g, ev, c) => (ev.type === 'set' && ev.p !== c.ctrl && isMon(ev.c)) || (ev.type === 'summon' && ev.p !== c.ctrl && ev.cs.some(x => x.zone === 'm' && x.pos === 'set')),
    cond: (g, c, p) => monsOf(g, opp(p)).some(x => x.pos === 'set'),
    target: function* (g, c, p, L2) { const ev = L2.ev; const cs = (ev.type === 'set' ? [ev.c] : ev.cs).filter(x => onField(x) && x.pos === 'set' && x.ctrl !== p);
      yield* tgt(g, p, L2, 'Change which Set monster to Attack Position?', cs.length ? cs : monsOf(g, opp(p)).filter(x => x.pos === 'set'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone === 'm' && t.pos === 'set') { t.pos = 'atk'; g.seq++; log(g, `${name(t)} was changed to face-up Attack Position.`); emit(g, { type: 'pos', c: t, p: t.ctrl, from: 'set' }); } } })] },
  // Port of classic-5.js: targets a face-up monster the opponent controls.
  'Shadow Spell': { cont: { ...holdLock, atk: (g, src, m) => m.u === src.flags.hold ? -700 : 0 },
    effs: [{ type: 'act', cond: (g, c, p) => oppFaceUp(g, p).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which face-up monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !onField(c) || !faceUp(t)) return; c.flags.hold = t.u; log(g, `Shadow Spell holds ${name(t)}.`); if (g.aw && g.aw.a === t) { negateAttack(g); g.aw = null; } } },
      holdGone] },
  // "Always treated as an Archfiend card": its name carries "Archfiend" already.
  'Shadow Tamer (Archfiend)': shadowTamer,

  /* ----- Shield ----- */
  // Port of classic-4.js: swaps the original values; changes from other cards still apply on top.
  'Shield & Sword': { effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
    res: function* (g, c, p) { for (const m of fieldMons(g).filter(faceUp)) { const d = baseDef(m) - baseAtk(m); if (d) addMod(g, m, { atk: d, def: -d, end: true }); } log(g, 'The original ATK and DEF of every face-up monster were switched.'); } }] },
  'Shield Crush': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(x => x.pos !== 'atk'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Defense Position monster?', fieldMons(g).filter(x => x.pos !== 'atk'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2).filter(x => x.pos !== 'atk'), { by: p, src: c }); } }] },
  'Shield Spear': { effs: [{ type: 'act', ds: true, cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster gains 400 ATK and DEF?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: 400, def: 400, end: true }); log(g, `${name(t)} gained 400 ATK and DEF.`); } } }] },
  // PARTIAL: no window during damage calculation, so it is used in the Damage Step windows, once the monsters are face-up.
  'Shield Warrior': { effs: [
    { type: 'quick', loc: 'gy', ds: true, label: 'Banish: your monsters survive this battle',
      cond: (g, c, p) => g.inDS && !!g.battle && [g.battle.a, g.battle.t].some(m => m && m.ctrl === p && wouldDie(g, m)),
      cost: function* (g, c, p) { move(g, c, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished Shield Warrior.`); },
      res: function* (g, c, p) { if (!g.battle) return; for (const m of [g.battle.a, g.battle.t]) if (m && onField(m) && m.ctrl === p) { m.flags.noBattleDestroy = true; m.flags.f14sw = true; } log(g, `${PN(g, p)}'s monsters can't be destroyed by this battle.`); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { if (ev.type === 'dsEnd') for (const m of fieldMons(g)) if (m.flags.f14sw) { m.flags.f14sw = false; m.flags.noBattleDestroy = false; } return false; } }] },
  // Twice per turn: the first two battle destructions each turn don't happen.
  'Shield Wing': { self: { replaceDestroy: (g, c, o) => {
    if (!o || !o.battle) return false;
    const s = c.flags.f14wing && c.flags.f14wing.t === g.turnNo ? c.flags.f14wing : (c.flags.f14wing = { t: g.turnNo, n: 0 });
    if (s.n >= 2) return false; s.n++; log(g, 'Shield Wing was not destroyed by battle.'); return true; } } },
  'Shield Worm': { effs: [{ type: 'trig', mand: true, label: 'Defense Position and mill',
    on: (g, ev, c) => evSummoned(ev, c) && faceUp(c),
    res: function* (g, c, p) { if (onField(c)) flipPos(g, c, 'def'); const n = monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Insect').length; if (n) mill(g, opp(p), n); } }] },
  'Shooting Star Bow - Ceal': {
    cont: { atk: (g, src, m) => src.equipTo === m.u ? -1000 : 0, grant: (g, src, m, flag) => flag === 'directAttack' && src.equipTo === m.u },
    effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c)) equip(g, c, t); } }] },

  /* ----- Silent ----- */
  'Silent Abyss': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy face-down and non-WATER monsters',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.pos === 'set' || attr(x) !== 'WATER'), { by: p, src: c }); } }] },
  'Silent Doom': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(isNormalMon),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Normal Monster?', g.p[p].gy.filter(isNormalMon), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && ss(g, p, t, 'def')) { t.flags.cantAttack = true; log(g, `${name(t)} can't attack.`); } } }] },
  // ENGINE: a negated Continuous card's own static effects (cont) still apply; its activated and trigger effects are blocked.
  'Silent Insect': {
    cont: {
      negates: (g, src, c) => isST(c) && onField(c) && faceUp(c) && D(c).sub === 'Continuous',
      forbid: (g, src, a) => a.type === 'activate' && a.c && isST(a.c) && onField(a.c) && faceUp(a.c) && D(a.c).sub === 'Continuous' && a.eff && a.eff.type !== 'act' },
    effs: [{ type: 'trig', mand: true, label: 'Change to Defense Position',
      on: (g, ev, c) => evSummoned(ev, c, ['normal', 'flip']) && faceUp(c),
      res: function* (g, c) { if (onField(c)) flipPos(g, c, 'def'); } }] },
  'Silent Magician LV4': { self: { atk: (g, c) => 500 * ctr(c, 'spell') },
    effs: [
      { type: 'trig', mand: true, label: 'Place a Spell Counter',
        on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && ev.to === 'hand' && ev.c.owner === opp(c.ctrl) && ctr(c, 'spell') < 5,
        res: function* (g, c) { if (!onField(c) || !faceUp(c) || ctr(c, 'spell') >= 5) return; addCtr(g, c, 'spell', 1); log(g, `Silent Magician LV4 has ${ctr(c, 'spell')} Spell Counter${ctr(c, 'spell') > 1 ? 's' : ''}.`); if (ctr(c, 'spell') === 5) c.flags.f14five = g.turnNo; } },
      // only in the Standby Phase of your next turn after the 5th counter
      { type: 'trig', tags: { ss: 1 }, label: 'Send it: summon Silent Magician LV8',
        on: (g, ev, c) => { if (!(ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.flags.f14five && c.flags.f14five < g.turnNo)) return false; c.flags.f14five = -1; return ctr(c, 'spell') >= 5; },
        cond: (g, c, p) => [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Silent Magician LV8')),
        cost: lvCost, res: function* (g, c, p) { yield* lvUp(g, c, p, 'Silent Magician LV8'); } }] },
  'Silent Magician LV8': { self: noOppSpells, cont: noSSFromGY, effs: [] },
  'Silent Strider': { effs: [{ type: 'ign', loc: 'hand', label: 'Send it: a monster loses 1 Level',
    cond: g => fieldMons(g).some(x => faceUp(x) && lv(x) > 1),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent Silent Strider to the GY.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Reduce the Level of which monster?', fieldMons(g).filter(x => faceUp(x) && lv(x) > 1), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && lv(t) > 1) { const n = lv(t) - 1; t.flags.lv = n; t.flags.lvUntil = true; log(g, `${name(t)} is Level ${n} until the End Phase.`); } } }] },
  // PARTIAL: the Spell negation is an optional Spell Speed 3 response (see negTargeting).
  'Silent Swordsman LV3': { effs: [
    negTargeting((g, c, t) => isSpell(t.c) && t.p !== c.ctrl, 'Negate the Spell targeting it', false),
    { type: 'trig', on: (g, ev, c) => { if (ev.type === 'flip' && ev.c === c) c.flags.f14flip = g.turnNo; return false; }, res: noop },
    { type: 'trig', tags: { ss: 1 }, label: 'Send it: summon Silent Swordsman LV5',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.turnIn !== g.turnNo && c.flags.f14flip !== g.turnNo,
      cond: (g, c, p) => [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Silent Swordsman LV5')),
      cost: lvCost, res: function* (g, c, p) { yield* lvUp(g, c, p, 'Silent Swordsman LV5'); } }] },
  'Silent Swordsman LV5': { self: noOppSpells,
    effs: [
      { type: 'trig', on: (g, ev, c) => { if (ev.type === 'damage' && ev.battle && ev.direct && ev.src === c && ev.p !== c.ctrl) c.flags.f14hit = g.turnNo; return false; }, res: noop },
      { type: 'trig', tags: { ss: 1 }, label: 'Send it: summon Silent Swordsman LV7',
        on: (g, ev, c) => { if (!(ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.flags.f14hit && c.flags.f14hit < g.turnNo)) return false; c.flags.f14hit = 0; return true; },
        cond: (g, c, p) => [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Silent Swordsman LV7')),
        cost: lvCost, res: function* (g, c, p) { yield* lvUp(g, c, p, 'Silent Swordsman LV7'); } }] },
  // PARTIAL: Spell Cards and effects on the field can't be activated at all (the engine can't let a Spell resolve negated
  // on its own); Spell effects that work from the GY are left alone. ENGINE: static effects of face-up Spells still apply.
  'Silent Swordsman LV7': {
    cont: {
      negates: (g, src, c) => isSpell(c) && onField(c),
      forbid: (g, src, a) => a.type === 'activate' && a.c && isSpell(a.c) && ['hand', 'st', 'fz'].includes(a.c.zone) },
    // its GY lock is a duel-long rule, installed by the first event the card sees
    effs: [{ type: 'trig', loc: 'any', res: noop, on: g => { if (!g.f14lv7) { g.f14lv7 = true; addRule(g, (g2, a) => a.type === 'ss' && a.c && a.c.zone === 'gy' && named(a.c, 'Silent Swordsman LV7')); } return false; } }] },

  /* ----- Sinister ----- */
  'Sinister Seeds': { effs: [trapTrig({ label: 'Special Summon Sinister Seed Tokens', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.wasField && ev.prevCtrl === c.ctrl && ev.snap && ev.snap.pos === 'atk' && lastBattleDamage(g, c.ctrl) >= 500,
    cond: (g, c, p, x) => { const n = Math.floor(lastBattleDamage(g, p) / 500); return n >= 1 && nFreeM(g, p) >= n; },
    cost: function* (g, c, p, L2) { L2.data.n = Math.floor(lastBattleDamage(g, p) / 500); },
    res: function* (g, c, p, L2) { const n = Math.min(L2.data.n || 0, nFreeM(g, p)); if (n > 0) tokens(g, p, { n: 'Sinister Seed Token', a: 'DARK', r: 'Plant', lv: 1, atk: 100, def: 100 }, n, 'def'); } })] },
  // Original 2010 text: "During your Standby Phase, if this card is in your Graveyard, you can return it to your hand."
  // No once-per-turn and no banish in the opponent's End Phase (both added by later errata).
  'Sinister Serpent': { effs: [
    { type: 'trig', loc: 'gy', label: 'Add it to your hand', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner,
      res: function* (g, c, p) { if (c.zone !== 'gy') return; move(g, c, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} added Sinister Serpent to the hand.`); } }] },
  'Sinister Sprocket': { effs: [{ type: 'trig', loc: 'gy', tags: { destroy: 1 }, label: 'Destroy a face-up Spell or Trap',
    on: (g, ev, c) => ev.type === 'summon' && ev.how === 'synchro' && attr(ev.cs[0]) === 'DARK' && c.zone === 'gy' && g.events.some(e => e.type === 'move' && e.c === c && e.reason === 'synchro' && e.group === ev.group),
    cond: g => stOnField(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up Spell or Trap?', stOnField(g).filter(faceUp), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2).filter(faceUp), { by: p, src: c }); } }] },

  /* ----- Skull ----- */
  // PARTIAL: the die roll is an optional Spell Speed 3 response to the opponent's link that targets it (ENGINE: no hook
  // before a link resolves).
  'Skull Archfiend of Lightning': { effs: [
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Pay 500 LP or destroy this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 500) pay(g, p, 500); else destroy(g, [c], { by: p }); } },
    { type: 'quick', speed: 3, ds: true, label: 'Roll a die',
      cond: (g, c, p, x) => { const t = x.top; return !!(t && !t.negated && t.p !== p && t.c !== c && (t.t || []).includes(c) && faceUp(c) && !(t.data && t.data.f14die)); },
      target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; L2.data.L.data.f14die = true; },
      res: function* (g, c, p, L2) { if (!onField(c) || !faceUp(c)) return; const n = dice(g, p); if ([1, 3, 6].includes(n)) negLink(g, L2.data.L, p, true); } }] },
  // The self-destruction also happens in the opponent's Battle Phase (ruling).
  'Skull Conductor': { effs: [
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy this card', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'bpEnd' && faceUp(c),
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) destroy(g, [c], { by: p }); } },
    { type: 'ign', loc: 'hand', tags: { ss: 1 }, label: 'Send it: summon Zombies with 2000 ATK',
      cond: (g, c, p) => conductorSets(g, p, c).length > 0,
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent Skull Conductor to the GY.`); },
      res: function* (g, c, p) { const sets = conductorSets(g, p, null); if (!sets.length) return;
        const i = sets.length > 1 ? yield* choose(g, p, 'Special Summon which Zombies?', sets.map(s => s.map(x => D(x).n).join(' + '))) : 0;
        for (const x of sets[i]) if (x.zone === 'hand') ss(g, p, x, 'atk'); } }] },
  // Port of classic-5.js
  'Skull Dice': { effs: [{ type: 'act', ds: true, cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    res: function* (g, c, p) { const n = dice(g, p) * 100; for (const m of oppFaceUp(g, p)) addMod(g, m, { atk: -n, def: -n, end: true }); log(g, `${PN(g, opp(p))}'s monsters lost ${n} ATK and DEF.`); } }] },
  // PARTIAL: "instead of a normal draw" is done after the draw: the drawn card goes back on top of the Deck and
  // Burning Skull Head comes from the GY (ENGINE: no draw replacement hook).
  'Skull Flame': { effs: [
    { type: 'ign', opt: true, tags: { ss: 1 }, label: 'Special Summon Burning Skull Head',
      cond: (g, c, p) => g.phase === 'main1' && freeM(g, p) >= 0 && g.p[p].hand.some(x => named(x, 'Burning Skull Head')),
      after: (g, c, p) => { g.noBP[p] = true; },
      res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => named(x, 'Burning Skull Head')); if (!cs.length) return; const [x] = yield* pick(g, p, 'Special Summon Burning Skull Head', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } },
    { type: 'trig', label: 'Add Burning Skull Head instead of drawing',
      on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && ev.phase === 'draw' && ev.c.owner === c.ctrl && g.tp === c.ctrl,
      cond: (g, c, p) => g.p[p].gy.some(x => named(x, 'Burning Skull Head')),
      res: function* (g, c, p, L2) { const cs = g.p[p].gy.filter(x => named(x, 'Burning Skull Head')); if (!cs.length) return;
        const dr = L2.ev && L2.ev.c; if (dr && dr.zone === 'hand') move(g, dr, 'deckTop', { reason: 'effect' });
        move(g, cs[0], 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added Burning Skull Head from the GY instead of drawing.`); } }] },
  // Ritual Summoned with Novox's Prayer (that Ritual Spell's own script).
  'Skull Guardian': { effs: [] },
  // Port of classic-5.js: the cards sent since it last applied are counted, then the damage goes to each owner.
  'Skull Invitation': { effs: [
    { type: 'act', res: noop },
    { type: 'trig', loc: 'st', mand: true, label: '300 damage per card sent to the GY',
      on: (g, ev, c) => { if (!faceUp(c) || ev.type !== 'move' || ev.to !== 'gy' || ev.c === c) return false; const s = c.flags.skull || (c.flags.skull = [0, 0]); s[ev.c.owner]++; return true; },
      res: function* (g, c) { const s = c.flags.skull || [0, 0]; c.flags.skull = [0, 0];
        for (const q of [g.tp, opp(g.tp)]) if (s[q]) damage(g, q, 300 * s[q], { src: c, srcP: c.ctrl }); } }] },
  'Skull Knight': { effs: [] },
  'Skull Knight 2': skullKnight2,
  // A Spell Speed 2 effect of the face-up Trap; banishing the monsters is the cost.
  'Skull Lair': { effs: [{ type: 'act', res: noop },
    { type: 'quick', loc: 'st', tags: { destroy: 1 }, label: 'Banish monsters: destroy a monster of that Level',
      cond: (g, c, p) => { const n = g.p[p].gy.filter(isMon).length; return fieldMons(g).some(m => faceUp(m) && lv(m) >= 1 && lv(m) <= n); },
      cost: function* (g, c, p, L2) { const n = g.p[p].gy.filter(isMon).length; const lvs = [...new Set(fieldMons(g).filter(m => faceUp(m) && lv(m) >= 1 && lv(m) <= n).map(lv))].sort((a, b) => a - b);
        const i = lvs.length > 1 ? yield* choose(g, p, 'Banish how many monsters?', lvs.map(String)) : 0; const k = lvs[i];
        const xs = yield* pick(g, p, `Banish ${k} monster${k > 1 ? 's' : ''} from your GY`, g.p[p].gy.filter(isMon), k, k, 'cost');
        for (const x of xs) move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${xs.length} monster${xs.length > 1 ? 's' : ''}.`); L2.data.k = k; },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, `Destroy which Level ${L2.data.k} monster?`, fieldMons(g).filter(m => faceUp(m) && lv(m) === L2.data.k), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { if (!onField(c)) return; destroy(g, live(L2).filter(m => faceUp(m) && lv(m) === L2.data.k), { by: p, src: c }); } }] },
  // Port of classic-3.js: from anywhere it is sent to the GY.
  'Skull-Mark Ladybug': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Gain 1000 LP',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy',
    res: function* (g, c, p) { gain(g, p, 1000); } }] },

  /* ----- Snake ----- */
  'Snake Deity\'s Command': { effs: [{ type: 'act',
    cond: (g, c, p, x) => spellTrapAct(x.top) && isSpell(x.top.c) && x.top.p !== p && !x.top.negated && g.p[p].hand.some(h => isMon(h) && /Venom/.test(D(h).n)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Show a Venom monster from your hand', g.p[p].hand.filter(h => isMon(h) && /Venom/.test(D(h).n)), 1, 1, 'cost'); if (x) log(g, `${PN(g, p)} showed ${D(x).n}.`); },
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; if (!T) return; T.negBy = p; L.negate(g, T, true); } }] },
  'Snake Fang': { effs: [{ type: 'act', ds: true, cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster loses 500 DEF?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { def: -500, end: true }); log(g, `${name(t)} lost 500 DEF.`); } } }] },
  'Snake Rain': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && g.p[p].deck.filter(x => isMon(x) && race(x) === 'Reptile').length >= 4,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand.filter(x => x !== c), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Reptile'); if (cs.length < 4) return;
      const xs = yield* pick(g, p, 'Send 4 Reptiles from your Deck to the GY', cs, 4, 4, 'good'); for (const x of xs) move(g, x, 'gy', { reason: 'effect' }); log(g, `${PN(g, p)} sent ${xs.map(name).join(', ')} to the GY.`); shuffleDeck(g, p); } }] },
  // Not in the Damage Step (ruling), so not after a battle.
  'Snake Whistle': { effs: [trapTrig({ label: 'Special Summon a Reptile', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.destroyed && !ev.battle && ev.wasField && ev.prevCtrl === c.ctrl && ev.snap && ev.snap.mon && ev.snap.race === 'Reptile' && !g.inDS,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && race(x) === 'Reptile' && lv(x) <= 4),
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Reptile' && lv(x) <= 4 && !forbid(g, { type: 'ss', c: x, p, how: 'special' })); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon a Level 4 or lower Reptile from your Deck', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } })] },

  /* ----- Sonic ----- */
  'Sonic Bird': { effs: [{ type: 'trig', when: true, label: 'Add a Ritual Spell', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'flip']),
    cond: (g, c, p) => g.p[p].deck.some(x => isSpell(x) && D(x).sub === 'Ritual'),
    res: function* (g, c, p) { yield* search(g, p, x => isSpell(x) && D(x).sub === 'Ritual', 'Add a Ritual Spell from your Deck'); } }] },
  'Sonic Chick': { self: { noBattleDestroy: (g, c) => { const b = g.battle; if (!b) return false; const o = b.a === c ? b.t : b.t === c ? b.a : null; return !!o && atk(g, o) >= 1900; } } },
  // Until the end of the End Phase of the next turn: Spell Card activations only (ruling).
  'Sonic Jammer': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Opponent can’t activate Spells', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { const o = opp(p); addRule(g, (g2, a) => a.type === 'activate' && a.p === o && a.c && isSpell(a.c) && a.eff && a.eff.type === 'act', { end: g.turnNo + 1 }); log(g, `${PN(g, o)} can't activate Spell Cards until the end of the next turn.`); } }] },
  'Sonic Shooter': {
    self: { directAttack: (g, c) => !g.p[opp(c.ctrl)].st.some(Boolean) },
    cont: { dmg: (g, src, p, n, o) => o && o.battle && o.direct && o.src === src && p !== src.ctrl && !g.p[p].st.some(Boolean) ? baseAtk(src) : undefined } },

  /* ----- Soul ----- */
  // Trigger Continuous Spell: 500 LP for each card banished since it last applied.
  'Soul Absorption': { effs: [
    { type: 'act', res: noop },
    { type: 'trig', loc: 'st', mand: true, label: 'Gain 500 LP for each banished card',
      on: (g, ev, c) => { if (!faceUp(c) || ev.type !== 'move' || ev.to !== 'ban') return false; c.flags.f14sa = (c.flags.f14sa || 0) + 1; return true; },
      res: function* (g, c, p) { const n = c.flags.f14sa || 0; c.flags.f14sa = 0; if (n) gain(g, p, 500 * n); } }] },
  // You pick first (the target), then the opponent picks one of yours when it is activated (ruling).
  'Soul Demolition': { effs: [{ type: 'act', res: noop },
    { type: 'quick', loc: 'st', label: 'Pay 500: both banish a monster from the GY',
      cond: (g, c, p) => g.p[p].lp > 500 && monsOf(g, p).some(m => faceUp(m) && race(m) === 'Fiend') && g.p[p].gy.some(isMon) && g.p[opp(p)].gy.some(isMon),
      cost: function* (g, c, p) { pay(g, p, 500); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish which monster from their GY?', g.p[opp(p)].gy.filter(isMon), 1, 1, 'bad');
        const [x] = yield* pick(g, opp(p), 'Banish which monster from their GY?', g.p[p].gy.filter(isMon), 1, 1, 'bad'); L2.data.o = x; },
      res: function* (g, c, p, L2) { if (!onField(c)) return; for (const x of [L2.t[0], L2.data.o]) if (x && x.zone === 'gy') { move(g, x, 'ban', { reason: 'effect', by: p }); log(g, `${name(x)} was banished.`); } } }] },
  // PARTIAL: destroying it in the second Standby Phase is a chain link here (the card says it doesn't start a chain).
  'Soul Devouring Bamboo Sword': { effs: [
    { type: 'act', cond: g => fieldMons(g).some(m => faceUp(m) && bambooOn(g, m)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which monster with a Bamboo Sword?', fieldMons(g).filter(m => faceUp(m) && bambooOn(g, m)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; c.flags.f14sb = 0; if (t && onField(c)) { c.flags.hold = t.u; log(g, `Soul Devouring Bamboo Sword selected ${name(t)}.`); } } },
    { type: 'trig', loc: 'st', mand: true, label: 'Opponent skips the next Draw Phase',
      on: (g, ev, c) => faceUp(c) && c.flags.hold && ev.type === 'damage' && ev.battle && ev.src && ev.src.u === c.flags.hold && ev.p !== ev.src.ctrl && bambooOn(g, ev.src),
      res: function* (g, c, p, L2) { const o = L2.ev.p, when = g.tp === o ? g.turnNo + 2 : g.turnNo + 1;
        addRule(g, (g2, a) => a.type === 'draw' && a.p === o && g2.phase === 'draw' && g2.turnNo === when, { end: when }); log(g, `${PN(g, o)} skips the next Draw Phase.`); } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy this card',
      on: (g, ev, c) => { if (!(faceUp(c) && ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl)) return false; c.flags.f14sb = (c.flags.f14sb || 0) + 1; return c.flags.f14sb >= 2; },
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  'Soul of Fire': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && race(x) === 'Pyro') && !monsOf(g, p).some(m => m.declared),
    after: (g, c, p) => { addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.ctrl === p, { end: g.turnNo }); },
    res: function* (g, c, p) { if (g.p[opp(p)].deck.length) draw(g, opp(p), 1);
      const cs = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Pyro'); if (!cs.length) return;
      const [x] = yield* pick(g, p, 'Banish which Pyro monster from your Deck?', cs, 1, 1, 'good'); if (!x) return;
      move(g, x, 'ban', { reason: 'effect', by: p }); log(g, `${PN(g, p)} banished ${name(x)}.`); shuffleDeck(g, p);
      const n = Math.floor(baseAtk(x) / 2); if (n) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  // Once properly Special Summoned by its own rule it can be revived (ruling). PARTIAL: an effect that Special Summons it
  // from the hand or Deck first is not stopped (ENGINE: no generic "can't be Special Summoned" flag).
  'Soul of Purity and Light': {
    proc: { label: 'Special Summon (banish 2 LIGHTs from your GY)', cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT').length >= 2,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Banish 2 LIGHT monsters from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'LIGHT'), 2, 2, 'cost');
        for (const x of xs) move(g, x, 'ban', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} banished ${xs.map(name).join(' and ')}.`); c.flags.f14proc = true; } },
    cont: { atk: (g, src, m) => m.ctrl !== src.ctrl && faceUp(m) && g.phase === 'battle' && g.tp === m.ctrl ? -300 : 0 },
    effs: [{ type: 'trig', loc: 'gy', res: noop, on: () => false },
      { type: 'trig', on: (g, ev, c) => { if (ev.type === 'summon' && ev.cs.includes(c) && c.flags.f14proc) c.f14proper = true; return false; }, res: noop },
      { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (!g.f14purity) { g.f14purity = true; addRule(g, (g2, a) => a.type === 'ss' && a.c && named(a.c, 'Soul of Purity and Light') && ['gy', 'ban'].includes(a.c.zone) && !a.c.f14proper); } return false; } }] },
  'Soul of the Pure': { effs: [{ type: 'act', res: function* (g, c, p) { gain(g, p, 800); } }] },
  'Soul Resurrection': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(isNormalMon),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Normal Monster in Defense Position?', g.p[p].gy.filter(isNormalMon), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && onField(c) && ss(g, p, t, 'def')) link(g, c, t); } }] },
  'Soul Reversal': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.some(isFlipMon),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which Flip monster to the top of your Deck?', g.p[p].gy.filter(isFlipMon), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'deckTop', { reason: 'effect', by: p }); log(g, `${name(t)} was put on top of the Deck.`); } } }] },
  'Soul Rope': { effs: [trapTrig({ label: 'Pay 1000: Special Summon a Level 4 monster', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.destroyed && !ev.battle && ev.wasField && ev.to === 'gy' && ev.prevCtrl === c.ctrl && ev.snap && ev.snap.mon && !g.inDS,
    cond: (g, c, p) => g.p[p].lp > 1000 && freeM(g, p) >= 0 && g.p[p].deck.some(x => lvFour(g, p, x)),
    cost: function* (g, c, p) { pay(g, p, 1000); },
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => lvFour(g, p, x)); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon a Level 4 monster from your Deck', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } })] },
  'Soul-Absorbing Bone Tower': {
    self: { noAttackTarget: (g, c) => monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && race(x) === 'Zombie') },
    effs: [{ type: 'trig', mand: true, label: 'Send the top 2 cards of their Deck to the GY',
      on: (g, ev, c) => ev.type === 'summon' && !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how) && ev.cs.some(x => onField(x) && faceUp(x) && race(x) === 'Zombie'),
      res: function* (g, c, p) { mill(g, opp(p), 2); } }] },
});

/* ----- Goat-only names ----- */
E.addScripts({
  'Sasuke Samurai #2': sasuke2,
  'Skull Knight #2': skullKnight2,
  'Shadow Tamer': shadowTamer,
}, 'goat');
})();
