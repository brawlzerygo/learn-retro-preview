/* Full pool batch 11: Levia-Dragon - Daedalus to Mind Wipe (build/batches/full/full-11.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text; cards with a
 Goat-only script elsewhere (Light of Intervention, Machine Conversion Factory, Machine King, Magic Jammer, Magical Hats,
 Magical Labyrinth, Magical Marionette, Mask of Brutality, Mask of Darkness, Mask of Dispel, Mask of the Accursed,
 Mask of Weakness, Master of Oz, Metal Dragon) are ported here as the shared version. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, setFaceDown, negate, addMod,
  equip, addCtr, ctr, negateAttack, addRule, takeControl, coin,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, nFreeM, shuffleDeck, log, PN, live, opp, stOnField, spellTrapAct, evSummoned, fromFieldToGY, stat, negd, emit, has, num, oppFaceUp } = L;

const named = (c, n) => D(c).n === n;
// Edison text: the PSCT line when there is one, else the card text
const txt = c => { const d = D(c); return d.ps && !/^No (?:Edison|rulings)/.test(d.ps) ? d.ps : d.tx || ''; };
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'atk' }); };
function* discardPick(g, p, n, text, not) { const h = g.p[p].hand.filter(x => x !== not); if (!h.length) return []; const xs = yield* pick(g, p, text, h, Math.min(n, h.length), Math.min(n, h.length), 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'discard' }); if (xs.length) log(g, `${PN(g, p)} discarded ${xs.map(name).join(', ')}.`); return xs; }
// Equip Spells
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?', hint = 'good') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, hint); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) equip(g, c, t); } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
const eqOf = (g, c) => c.equipTo ? fieldMons(g).find(x => x.u === c.equipTo) || null : null;
const noop = { type: 'act', res: function* () {} };
// Spell Counters each time a Spell Card resolves (as goat-7.js): a Normal or Quick-Play Spell as it leaves for the GY after
// resolving; Continuous, Equip and Field Spells as they are activated from the hand.
// PARTIAL: a Set Continuous/Equip/Field Spell flipped up adds none, and a negated Normal Spell still adds one.
const spellCtr = (n = 1, loc) => ({ type: 'trig', loc, res: function* () {}, on: (g, ev, c) => {
  if (ev.type !== 'move' || ev.c === c || !isSpell(ev.c)) return false;
  const stays = ['Continuous', 'Equip', 'Field'].includes(D(ev.c).sub);
  if ((!stays && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule') || (stays && ev.from === 'hand' && ev.reason === 'activate')) { addCtr(g, c, 'spell', n); log(g, `${name(c)} got ${n > 1 ? n + ' Spell Counters' : 'a Spell Counter'} (${ctr(c, 'spell')}).`); }
  return false; } });
// Can this face-up card hold a Spell Counter? (read from its text: "place ... Spell Counter ... on this card / on it", with its max)
function spellRoom(c) {
  const t = txt(c); if (!/Spell Counter/.test(t) || !/(?:place|put)[^.]*Spell Counters?[^.]*on (?:this card|it)\b/i.test(t)) return false;
  const m = t.match(/\(max(?:imum)?\.?\s*(\d+)\)|maximum (?:of )?(\d+)/i); if (m) return ctr(c, 'spell') < +(m[1] || m[2]);
  return true;
}
// Synchro Summons with material rules the engine's reader doesn't know (as batch-2.js).
function synMats(g, p, sx, o) {
  const mons = monsOf(g, p).filter(c => faceUp(c) && !(D(c).n === 'Blackwing - Vayu the Emblem of Honor' && !c.flags.negated));
  const Lv = lv(sx), out = [], n = mons.length;
  for (let mask = 1; mask < (1 << n) && out.length < 12; mask++) {
    const mats = mons.filter((_, i) => mask & (1 << i)); if (mats.length < 2) continue;
    if (mats.reduce((s, c) => s + lv(c), 0) !== Lv) continue;
    if (mats.some(t => D(t).tu && o.tuner(t) && mats.filter(x => x !== t).every(x => o.non(x) && !D(x).tu))) out.push(mats);
  }
  return out;
}
const synProc = o => ({ extra: true, how: 'synchro', label: 'Synchro Summon',
  cond: (g, c, p) => synMats(g, p, c, o).length > 0,
  cost: function* (g, c, p, grp) { const cs = synMats(g, p, c, o); let mats = cs[0];
    if (cs.length > 1) { const i = yield* choose(g, p, `Synchro Summon ${name(c)} with which monsters?`, cs.map(m => m.map(name).join(' + '))); mats = cs[i]; }
    for (const m of mats) move(g, m, 'gy', { reason: 'synchro', by: p, group: grp });
    log(g, `${PN(g, p)} sent ${mats.map(m => D(m).n).join(' + ')} to the GY for a Synchro Summon.`); } });
// A Special Summon in the Damage Step opens no "when summoned" window.
function ssx(g, ...a) { const r = ss(g, ...a); if (g.inDS) g.sw = null; return r; }
// A battle worked out by the card (as classic-5.js): the engine's attack() keeps its target local. ENGINE: attack redirect.
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
// Union monsters (as full-02.js): once per turn equip to a monster you control, or unequip and Special Summon in Attack Position.
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
const unionCont = { replaceDestroy: (g, src, m, o) => {
  if (o.rule || !o.battle || src.zone !== 'st' || src.equipTo !== m.u || !src.flags.union) return false;
  move(g, src, 'gy', { reason: 'battle', destroyed: true, by: o.by }); log(g, `${D(src).n} was destroyed instead of ${name(m)}.`); return true; } };
const isUmi = c => faceUp(c) && ['Umi', 'A Legendary Ocean'].includes(D(c).n);
const sanctuary = g => allField(g).some(x => faceUp(x) && named(x, 'The Sanctuary in the Sky'));
const isPsy = c => isMon(c) && race(c) === 'Psychic';
let REFLECT = 0;

E.addScripts({
  'Levia-Dragon - Daedalus': { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Send Umi: destroy all other cards',
    cond: (g, c, p) => stOf(g, p).some(isUmi),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which face-up Umi to the GY?', stOf(g, p).filter(isUmi), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
    // Resolves even if this card left the field or was turned face-down (it is never destroyed by its own effect).
    res: function* (g, c, p) { destroy(g, allField(g).filter(x => x !== c), { by: p, src: c }); } }] },
  // ENGINE: no Arcana Force monster has a script yet, so "choose the effect without tossing a coin" is only kept as a flag
  // (g.lightBarrier[p] is true while it applies) for those scripts to read.
  'Light Barrier': { effs: [noop,
    { type: 'trig', loc: 'fz', mand: true, label: 'Toss a coin', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; const h = coin(g, p); c.flags.lbOff = !h; if (!h) log(g, 'Light Barrier is negated until the next Standby Phase.'); } },
    { type: 'trig', loc: 'fz', on: (g, ev, c) => { (g.lightBarrier || (g.lightBarrier = [false, false]))[c.ctrl] = faceUp(c) && !c.flags.lbOff; return false; }, res: function* () {} },
    { type: 'trig', loc: 'fz', mand: true, label: 'Gain LP',
      on: (g, ev, c) => !c.flags.lbOff && ev.type === 'move' && ev.battle && ev.destroyed && ev.prevCtrl !== c.ctrl && !!ev.killer && /^Arcana Force/.test(D(ev.killer).n) && (onField(ev.killer) ? ev.killer.ctrl : ev.killer.owner) === c.ctrl,
      res: function* (g, c, p, L2) { gain(g, p, num(D(L2.ev.c).atk)); } }] },
  // PARTIAL: while it is face-up, a LIGHT Normal Monster that needs 2 Tributes can be Tribute Summoned with 1, but the
  // engine lets any one monster be that Tribute (not only this card).
  'Light Effigy': { cont: { tributes: (g, src, c, p, need) => src.ctrl === p && need === 2 && D(c).k === 'normal' && attr(c) === 'LIGHT' ? 1 : null } },
  // PARTIAL: Synchro Summoned with its own rule (non-Tuners must be LIGHT), always in Attack Position.
  'Light End Dragon': { noSynchro: true, proc: synProc({ tuner: () => true, non: c => attr(c) === 'LIGHT' }),
    effs: [{ type: 'trig', label: 'Lose 500: the other monster loses 1500',
      on: (g, ev, c) => ev.type === 'attack' && ((ev.a === c && !!ev.t) || ev.t === c),
      cond: (g, c) => stat(g, c, 'atk') >= 500 && stat(g, c, 'def') >= 500,
      res: function* (g, c, p, L2) { if (!onField(c) || !faceUp(c) || stat(g, c, 'atk') < 500 || stat(g, c, 'def') < 500) return;
        addMod(g, c, { atk: -500, def: -500 }); log(g, `${name(c)} lost 500 ATK and DEF.`);
        const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; if (o && onField(o) && faceUp(o)) { addMod(g, o, { atk: -1500, def: -1500, end: true }); log(g, `${name(o)} lost 1500 ATK and DEF.`); } } }] },
  'Light Laser': { effs: [equipAct(m => attr(m) === 'LIGHT' && race(m) === 'Warrior', 'Equip to which face-up LIGHT Warrior?'),
    { type: 'trig', loc: 'st', mand: true, label: 'Banish the monster it battled',
      on: (g, ev, c) => ev.type === 'dsEnd' && !!c.equipTo && !!ev.t && (ev.a.u === c.equipTo || ev.t.u === c.equipTo),
      res: function* (g, c, p, L2) { const o = L2.ev.a.u === c.equipTo ? L2.ev.t : L2.ev.a; if (o && onField(o) && o.zone === 'm') { move(g, o, 'ban', { reason: 'effect', by: p }); log(g, `${D(o).n} was banished.`); } } }] },
  // ENGINE: no face-up Defense Normal Summon, and a face-down Special Summon isn't turned face-up; Setting is blocked and
  // Book of Moon style "turn face-down" cards can't be activated.
  'Light of Intervention': { cont: { forbid: (g, src, a) => (a.type === 'set' && a.c && isMon(a.c)) ||
      (a.type === 'activate' && a.c && (['Book of Moon', 'Darkness Approaches'].includes(D(a.c).n) || /face-down/i.test((a.eff && a.eff.label) || ''))) },
    effs: [noop] },
  'Light of Judgment': { effs: [{ type: 'act',
    cond: (g, c, p) => sanctuary(g) && g.p[p].hand.some(x => isMon(x) && attr(x) === 'LIGHT') && (g.p[opp(p)].hand.length > 0 || fieldMons(g).concat(stOf(g, opp(p))).some(x => x.ctrl === opp(p))),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 LIGHT monster', g.p[p].hand.filter(x => isMon(x) && attr(x) === 'LIGHT'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand, f = allField(g).filter(x => x.ctrl === o);
      const modes = []; if (h.length) modes.push('Look at their hand and discard 1 card'); if (f.length) modes.push('Send 1 card they control to the GY'); if (!modes.length) return;
      const i = modes.length > 1 ? yield* choose(g, p, 'Light of Judgment: which effect?', modes) : 0;
      if (/hand/.test(modes[i])) { log(g, `${PN(g, o)}'s hand: ${h.map(name).join(', ')}.`); const [x] = yield* pick(g, p, 'Discard which card?', h, 1, 1, 'bad'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, o)} discarded ${name(x)}.`); } }
      else { const [x] = yield* pick(g, p, 'Send which card to the GY?', f, 1, 1, 'bad'); if (x && onField(x)) { move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${D(x).n} was sent to the GY.`); } } } }] },
  'Light of Redemption': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp > 800 && g.p[p].ban.some(x => isMon(x) && attr(x) === 'LIGHT' && !x.faceDown),
    cost: function* (g, c, p) { pay(g, p, 800); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which banished LIGHT monster to your hand?', g.p[p].ban.filter(x => isMon(x) && attr(x) === 'LIGHT' && !x.faceDown), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'ban') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },
  // A Lightsworn mill: one batch-2.js marks (g.lsMill) or one made while a Lightsworn monster's effect resolves (Ryko, in engine.js).
  'Light Spiral': { effs: [noop,
    { type: 'trig', loc: 'st', mand: true, label: 'Banish the top card of their Deck',
      on: (g, ev, c) => { if (ev.type !== 'move' || ev.from !== 'deck' || ev.to !== 'gy' || ev.c.owner !== c.ctrl || c.flags.lspGrp === ev.group) return false;
        const rl = g.resolvingL; if (!(g.lsMill || (rl && rl.c && isMon(rl.c) && /Lightsworn/.test(D(rl.c).n)))) return false; c.flags.lspGrp = ev.group; return true; },
      res: function* (g, c, p) { const d = g.p[opp(p)].deck; if (!d.length) return; const x = d[d.length - 1]; move(g, x, 'ban', { reason: 'effect', by: p }); log(g, `${name(x)} was banished from the top of ${PN(g, opp(p))}'s Deck.`); } }] },
  // Junk Counters are placed as it happens (Continuous Effect, no chain), 2 per destruction however many Machines.
  'Machine Assembly Line': { cont: { atk: (g, src, c) => faceUp(c) && race(c) === 'Machine' ? 200 : 0 },
    effs: [noop,
      { type: 'trig', loc: 'st', on: (g, ev, c) => {
        if (ev.type === 'move' && ev.destroyed && ev.wasField && ev.from === 'm' && ev.snap && ev.snap.faceUp && ev.snap.race === 'Machine' && c.flags.junkGrp !== ev.group) { c.flags.junkGrp = ev.group; addCtr(g, c, 'junk', 2); log(g, `Machine Assembly Line got 2 Junk Counters (${ctr(c, 'junk')}).`); }
        return false; }, res: function* () {} },
      { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Send it: revive a Machine',
        cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && race(x) === 'Machine' && lv(x) <= ctr(c, 'junk')),
        cost: function* (g, c, p, L2) { L2.data.n = ctr(c, 'junk'); move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Machine Assembly Line to the GY.`); },
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Machine?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Machine' && lv(x) <= L2.data.n), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  'Machine Conversion Factory': { cont: eqBonus(300, 300), effs: [equipAct(m => race(m) === 'Machine', 'Equip to which face-up Machine?')] },
  'Machine King': { self: { atk: g => 100 * fieldMons(g).filter(x => faceUp(x) && race(x) === 'Machine').length } },
  'Machine King Prototype': { self: {
    atk: (g, c) => 100 * fieldMons(g).filter(x => x !== c && faceUp(x) && race(x) === 'Machine').length,
    def: (g, c) => 100 * fieldMons(g).filter(x => x !== c && faceUp(x) && race(x) === 'Machine').length } },
  // Attacks each opponent's monster once (self.maxAttacks / attackOk, as Asura Priest); the opponent takes no battle damage from its battles.
  'Machine Lord Ur': {
    self: {
      maxAttacks: (g, c) => { const hit = c.flags.urTurn === g.turnNo ? c.flags.urHit : []; const rest = monsOf(g, opp(c.ctrl)).filter(m => !hit.includes(m.u)).length; return c.attacks + (rest || (c.attacks ? 0 : 1)); },
      attackOk: (g, c, t) => !(c.flags.urTurn === g.turnNo && c.flags.urHit.includes(t.u)) },
    cont: { dmg: (g, src, p, n, o) => o.battle && p !== src.ctrl && !negd(g, src) && g.battle && (g.battle.a === src || g.battle.t === src) ? 0 : undefined },
    effs: [{ type: 'trig', on: (g, ev, c) => { if (ev.type === 'attack' && ev.a === c && ev.t) { if (c.flags.urTurn !== g.turnNo) { c.flags.urTurn = g.turnNo; c.flags.urHit = []; } c.flags.urHit.push(ev.t.u); } return false; }, res: function* () {} }] },
  'Mad Archfiend': { self: { piercing: true },
    effs: [{ type: 'trig', mand: true, label: 'Change to Defense Position', on: (g, ev, c) => ev.type === 'attack' && ev.t === c && c.pos === 'atk',
      res: function* (g, c) { toDef(g, c); } }] },
  'Mad Reloader': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Send 2, draw 2',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p) { if (g.p[p].hand.length < 2) { log(g, `${PN(g, p)} can't send exactly 2 cards.`); return; }
      const xs = yield* pick(g, p, 'Send 2 cards from your hand to the GY', g.p[p].hand, 2, 2, 'cost');
      const grp = g.group; for (const x of xs) move(g, x, 'gy', { reason: 'effect', group: grp }); log(g, `${PN(g, p)} sent ${xs.map(name).join(' and ')} to the GY.`); draw(g, p, 2); } }] },
  'Mad Sword Beast': { self: { piercing: true } },
  'Magic Drain': { effs: [{ type: 'act',
    cond: (g, c, p, x) => spellTrapAct(x.top) && isSpell(x.top.c) && x.top.p !== p && !x.top.negated,
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L, o = T.p; const sp = g.p[o].hand.filter(isSpell);
      if (sp.length && (yield* yn(g, o, 'Discard 1 Spell Card to negate Magic Drain?'))) { const [x] = yield* pick(g, o, 'Discard which Spell Card?', sp, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, o)} discarded ${name(x)}. Magic Drain's effect was negated.`); return; } }
      T.negBy = p; negate(g, T, true); } }] },
  'Magic Formula': { cont: eqBonus(700, 0), effs: [equipAct(m => ['Dark Magician', 'Dark Magician Girl'].includes(name(m)), 'Equip to which Dark Magician or Dark Magician Girl?'),
    { type: 'trig', loc: 'gy', mand: true, label: 'Gain 1000 LP', on: (g, ev, c) => fromFieldToGY(ev, c),
      res: function* (g, c, p, L2) { gain(g, L2.ev.prevCtrl != null ? L2.ev.prevCtrl : c.owner, 1000); } }] },
  'Magic Hole Golem': { effs: [{ type: 'ign', opt: true, label: 'Halve ATK: attack directly',
    cond: (g, c, p) => monsOf(g, p).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which of your face-up monsters?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
    // "only the selected monster can attack" applies from activation; 2 Golems on different monsters stop both.
    after: (g, c, p, L2) => { const u = L2.t[0] && L2.t[0].u; g.onlyAttacker[p] = g.onlyAttacker[p] && g.onlyAttacker[p] !== u ? -1 : u; },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const A = stat(g, t, 'atk'); addMod(g, t, { atk: -(A - Math.floor(A / 2)), end: true });
      t.flags.directAttack = true; t.flags.golemDA = g.turnNo; log(g, `${name(t)}'s ATK was halved and it can attack directly this turn.`); } },
    { type: 'trig', loc: 'any', on: (g, ev) => { if (ev.type === 'phase' && ev.ph === 'end') for (const m of fieldMons(g)) if (m.flags.golemDA) { m.flags.golemDA = 0; m.flags.directAttack = false; } return false; }, res: function* () {} }] },
  'Magic Jammer': { effs: [{ type: 'act',
    cond: (g, c, p, x) => spellTrapAct(x.top) && isSpell(x.top.c) && !x.top.negated && g.p[p].hand.length > 0,
    cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; yield* discardPick(g, p, 1, 'Discard 1 card'); },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  // The counter stays on the Spell Card; this card's replacement works from the GY (PARTIAL: not if this card leaves the GY).
  'Magic Reflector': {
    cont: { loc: 'gy', replaceDestroy: (g, src, c, o) => { if (o.rule || o.battle || c.zone !== 'st' || ctr(c, 'reflector') < 1) return false; addCtr(g, c, 'reflector', -1); log(g, `A counter was removed from ${name(c)} instead.`); return true; } },
    effs: [{ type: 'act', cond: (g, c, p) => stOf(g, p).some(x => x !== c && faceUp(x) && x.zone === 'st' && (isSpell(x) || isMon(x))),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Place a counter on which face-up Spell Card?', stOf(g, p).filter(x => x !== c && faceUp(x) && x.zone === 'st' && (isSpell(x) || isMon(x))), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addCtr(g, t, 'reflector', 1); log(g, `${name(t)} got a counter.`); } } }] },
  'Magical Arm Shield': { effs: [
    { type: 'act', cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p) && monsOf(g, p).length > 0 && freeM(g, p) >= 0 && oppFaceUp(g, p).some(m => m !== g.aw.a),
      target: function* (g, c, p, L2) { L2.data.a = g.aw.a; yield* tgt(g, p, L2, 'Take control of which face-up monster?', oppFaceUp(g, p).filter(m => m !== g.aw.a), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0], a = L2.data.a; if (!t || !faceUp(t) || t.ctrl === p) return; const from = t.ctrl;
        if (!takeControl(g, p, t, false)) return; (g.mas || (g.mas = [])).push({ by: c.u, u: t.u, from });
        if (g.aw && g.aw.a === a) stopAttack(g); if (onField(a)) { log(g, `${name(t)} is attacked instead.`); miniBattle(g, a, t); } } },
    { type: 'trig', loc: 'any', mand: true, label: 'Control returns',
      on: (g, ev, c) => ev.type === 'phase' && (ev.ph === 'bpEnd' || ev.ph === 'end') && !!g.mas && g.mas.some(e => e.by === c.u),
      res: function* (g, c) { for (const e of g.mas.filter(e => e.by === c.u)) { const t = fieldMons(g).find(x => x.u === e.u); if (t && t.ctrl !== e.from) { if (freeM(g, e.from) >= 0) takeControl(g, e.from, t, false); else move(g, t, 'gy', { reason: 'rule' }); } }
        g.mas = g.mas.filter(e => e.by !== c.u); } }] },
  // ENGINE: no moment "before you draw" in the Draw Phase. PARTIAL: used right after the normal draw, the drawn card goes back on top of the Deck.
  'Magical Blast': { effs: [
    { type: 'act', res: function* (g, c, p) { damage(g, opp(p), 200 * monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Spellcaster').length, { src: c, srcP: p }); } },
    { type: 'trig', loc: 'gy', opt: true, label: 'Give up the draw: add this card',
      on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && g.phase === 'draw' && g.tp === c.owner && ev.c.owner === c.owner,
      res: function* (g, c, p, L2) { const x = L2.ev.c; if (c.zone !== 'gy') return; if (x.zone === 'hand') move(g, x, 'deckTop', { reason: 'rule' }); move(g, c, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} gave up the draw and added Magical Blast to the hand.`); } }] },
  // ENGINE: ③ (pay a Spell Counter cost from this card instead) has no cost hook, so it isn't done.
  'Magical Citadel of Endymion': { self: { replaceDestroy: (g, c, o) => { if (o.rule || o.battle || ctr(c, 'spell') < 1) return false; addCtr(g, c, 'spell', -1); log(g, 'Magical Citadel of Endymion removed a Spell Counter instead of being destroyed.'); return true; } },
    effs: [noop, spellCtr(1, 'fz'),
      // ② the counters on destroyed cards (remembered from the last event, since a card loses its counters as it leaves)
      { type: 'trig', loc: 'fz', on: (g, ev, c) => {
        const seen = c.flags.endyCtr || {};
        if (ev.type === 'move' && ev.destroyed && ev.wasField && ev.c !== c && seen[ev.c.u] > 0) { addCtr(g, c, 'spell', seen[ev.c.u]); log(g, `Magical Citadel of Endymion got ${seen[ev.c.u]} Spell Counter(s) (${ctr(c, 'spell')}).`); }
        const now = {}; for (const x of allField(g)) if (ctr(x, 'spell')) now[x.u] = ctr(x, 'spell'); c.flags.endyCtr = now; return false; }, res: function* () {} }] },
  'Magical Dimension': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Spellcaster') && g.p[p].hand.some(x => isMon(x) && race(x) === 'Spellcaster'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which monster you control to Tribute?', monsOf(g, p), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.ctrl !== p) return; move(g, t, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(t).n}.`);
      const sc = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Spellcaster'); if (!sc.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which Spellcaster from your hand?', sc, 1, 1, 'good'); if (!x || !ss(g, p, x, 'atk')) return;
      if (fieldMons(g).length && (yield* yn(g, p, 'Destroy 1 monster on the field?'))) { const [d] = yield* pick(g, p, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); if (d) { destroy(g, [d], { by: p, src: c }); g.sw = null; } } } }] },
  'Magical Exemplar': { effs: [spellCtr(2),
    { type: 'ign', opt: true, tags: { ss: 1 }, label: 'Remove counters: summon a Spellcaster',
      cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].gy].some(x => isMon(x) && race(x) === 'Spellcaster' && lv(x) >= 1 && lv(x) <= ctr(c, 'spell')),
      cost: function* (g, c, p, L2) { const lvs = [...new Set([...g.p[p].hand, ...g.p[p].gy].filter(x => isMon(x) && race(x) === 'Spellcaster' && lv(x) >= 1 && lv(x) <= ctr(c, 'spell')).map(lv))].sort((a, b) => a - b);
        const i = lvs.length > 1 ? yield* choose(g, p, 'Remove how many Spell Counters?', lvs.map(String)) : 0; L2.data.n = lvs[i]; addCtr(g, c, 'spell', -L2.data.n); log(g, `Magical Exemplar removed ${L2.data.n} Spell Counter(s).`); },
      res: function* (g, c, p, L2) { const cs = [...g.p[p].hand, ...g.p[p].gy].filter(x => isMon(x) && race(x) === 'Spellcaster' && lv(x) === L2.data.n); if (!cs.length || freeM(g, p) < 0) return;
        const [x] = yield* pick(g, p, `Special Summon a Level ${L2.data.n} Spellcaster from your hand or GY`, cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  'Magical Explosion': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.length === 0,
    res: function* (g, c, p) { damage(g, opp(p), 200 * g.p[p].gy.filter(isSpell).length, { src: c, srcP: p }); } }] },
  'Magical Hats': { effs: [
    { type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => g.tp !== p && g.phase === 'battle' && !g.inDS && monsOf(g, p).length > 0 && nFreeM(g, p) >= 2 && g.p[p].deck.filter(isST).length >= 2,
      res: function* (g, c, p) {
        if (!monsOf(g, p).length || nFreeM(g, p) < 2) return;
        const [m] = yield* pick(g, p, 'Choose 1 monster you control', monsOf(g, p), 1, 1, 'good');
        const sts = g.p[p].deck.filter(isST); if (sts.length < 2) return;
        const xs = yield* pick(g, p, 'Choose 2 Spell/Trap Cards from your Deck', sts, 2, 2, 'cost');
        if (m && faceUp(m)) setFaceDown(g, m);
        const made = [];
        for (const x of xs) if (ss(g, p, x, 'set')) { x.flags.baseAtk = 0; addMod(g, x, { set: 0, which: 'def' }); x.flags.hatsBy = c.u; made.push(x); }
        shuffleDeck(g, p);
        const cards = [m, ...made].filter(x => x && onField(x) && x.zone === 'm'); const zs = cards.map(x => g.p[p].m.indexOf(x));
        for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(g.rnd() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
        cards.forEach((x, i) => { g.p[p].m[zs[i]] = x; }); g.seq++;
        log(g, `${PN(g, p)} shuffled the face-down cards.`); } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the Hats',
      on: (g, ev, c) => ev.type === 'phase' && (ev.ph === 'bpEnd' || ev.ph === 'end') && fieldMons(g).some(x => x.flags.hatsBy === c.u),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.flags.hatsBy === c.u), { by: p }); } }] },
  'Magical Labyrinth': { effs: [equipAct(m => name(m) === 'Labyrinth Wall', 'Equip to which Labyrinth Wall?'),
    { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Tribute the Wall: summon Wall Shadow',
      cond: (g, c, p) => { const m = eqOf(g, c); return !!m && m.ctrl === p && g.p[p].deck.some(x => named(x, 'Wall Shadow')); },
      cost: function* (g, c, p) { const m = eqOf(g, c); if (m) { move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(m).n}.`); } },
      res: function* (g, c, p) { if (freeM(g, p) < 0) return; const cs = g.p[p].deck.filter(x => named(x, 'Wall Shadow')); const [x] = yield* pick(g, p, 'Special Summon Wall Shadow from your Deck', cs, 1, 1, 'good'); if (x) ss(g, p, x); shuffleDeck(g, p); } }] },
  'Magical Mallet': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c),
    res: function* (g, c, p) { const h = g.p[p].hand; if (!h.length) return; const xs = yield* pick(g, p, 'Shuffle which cards into your Deck?', h, 1, h.length, 'cost');
      for (const x of xs) move(g, x, 'deck', { reason: 'effect' }); log(g, `${PN(g, p)} shuffled ${xs.length} card${xs.length > 1 ? 's' : ''} into the Deck.`); draw(g, p, xs.length); } }] },
  'Magical Marionette': { self: { atk: (g, c) => 200 * ctr(c, 'spell') },
    effs: [spellCtr(1),
      { type: 'ign', tags: { destroy: 1 }, label: 'Remove 2 Spell Counters: destroy a monster', cond: (g, c) => ctr(c, 'spell') >= 2 && fieldMons(g).length > 0,
        cost: function* (g, c) { addCtr(g, c, 'spell', -2); log(g, 'Magical Marionette removed 2 Spell Counters.'); },
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  // PARTIAL: which cards can hold a Spell Counter is read from their text ("place ... Spell Counter ... on this card / on it", with a max).
  'Magical Plant Mandragola': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Place Spell Counters', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g) { const xs = allField(g).filter(x => faceUp(x) && spellRoom(x)); for (const x of xs) addCtr(g, x, 'spell', 1); if (xs.length) log(g, `${xs.map(name).join(', ')} got a Spell Counter.`); } }] },
  // Gemini: once Gemini Summoned, battle damage its controller would take from its battles goes to the opponent instead.
  'Magical Reflect Slime': { cont: { dmg: (g, src, p, n, o) => {
    if (REFLECT || !o.battle || p !== src.ctrl || !src.flags.gemini || negd(g, src) || !g.battle || (g.battle.a !== src && g.battle.t !== src)) return undefined;
    REFLECT++; try { log(g, 'Magical Reflect Slime sends the battle damage back.'); damage(g, opp(p), n, { ...o, srcP: p }); } finally { REFLECT--; } return 0; } } },
  // PARTIAL: "can't attack directly" blocks its attacks while the opponent has no monsters (a replayed attack can still go direct).
  'Magical Scientist': { effs: [
    { type: 'ign', tags: { ss: 1 }, label: 'Pay 1000: summon a Fusion Monster',
      cond: (g, c, p) => g.p[p].lp > 1000 && freeM(g, p) >= 0 && g.p[p].extra.some(x => D(x).k === 'fusion' && lv(x) <= 6),
      cost: function* (g, c, p) { pay(g, p, 1000); },
      res: function* (g, c, p) { const fs = g.p[p].extra.filter(x => D(x).k === 'fusion' && lv(x) <= 6); if (!fs.length || freeM(g, p) < 0) return;
        const [x] = yield* pick(g, p, 'Special Summon which Level 6 or lower Fusion Monster?', fs, 1, 1, 'good'); if (!x) return;
        const i = yield* choose(g, p, `${name(x)}: which position?`, ['Attack Position', 'Defense Position']);
        if (!ss(g, p, x, i ? 'def' : 'atk')) return; x.flags.sci = g.turnNo;
        addRule(g, (g2, a) => a.type === 'attack' && a.c === x && x.flags.sci === g2.turnNo && monsOf(g2, opp(x.ctrl)).length === 0, { end: g.turnNo }); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return the Fusion Monster',
      on: (g, ev) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(x => x.flags.sci === g.turnNo),
      res: function* (g) { for (const x of fieldMons(g).filter(x => x.flags.sci === g.turnNo)) { move(g, x, 'deck', { reason: 'effect' }); log(g, `${D(x).n} returned to the Extra Deck.`); } } }] },
  // Continuous Effect (no chain). PARTIAL: a hand card sent to the GY as a cost counts as a discard.
  'Magical Thorn': { effs: [noop,
    { type: 'trig', loc: 'st', on: (g, ev, c) => {
      if (ev.type === 'move' && ev.from === 'hand' && ev.to === 'gy' && ['discard', 'cost'].includes(ev.reason) && ev.c.owner === opp(c.ctrl) && g.p[ev.c.owner].lp > 0) { log(g, 'Magical Thorn inflicts 500 damage.'); damage(g, ev.c.owner, 500, { src: c, srcP: c.ctrl }); }
      return false; }, res: function* () {} }] },
  'Malevolent Catastrophe': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p),
    res: function* (g, c, p) { destroy(g, stOnField(g).filter(x => x !== c), { by: p, src: c }); } }] },
  'Malevolent Nuzzler': { cont: eqBonus(700, 0), effs: [equipAct(),
    { type: 'trig', loc: 'gy', when: true, label: 'Pay 500: put it on top of your Deck',
      on: (g, ev, c) => fromFieldToGY(ev, c), cond: (g, c, p) => g.p[p].lp > 500,
      cost: function* (g, c, p) { pay(g, p, 500); },
      res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'deckTop', { reason: 'effect' }); log(g, 'Malevolent Nuzzler was put on top of the Deck.'); } } }] },
  'Malice Ascendant': { effs: [{ type: 'trig', mand: true, label: 'Send cards from their Deck', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl,
    res: function* (g, c, p) { const n = g.p[p].gy.filter(x => named(x, 'Malice Ascendant')).length; if (n) L.mill(g, opp(p), n); } }] },
  'Malice Dispersion': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => g.p[p].hand.some(x => x !== c),
    cost: function* (g, c, p) { yield* discardPick(g, p, 1, 'Discard 1 card', c); },
    res: function* (g, c, p) { destroy(g, stOnField(g).filter(x => faceUp(x) && isTrap(x) && D(x).sub === 'Continuous'), { by: p, src: c }); } }] },
  // ENGINE: a move doesn't record which card's effect caused it. PARTIAL: counts a card effect that sends it from the field to
  // the GY while a face-up Continuous Spell is on the field.
  'Malice Doll of Demise': { effs: [
    { type: 'trig', loc: 'gy', on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy' && ['effect', 'cost'].includes(ev.reason) && !ev.battle && stOnField(g).some(x => faceUp(x) && isSpell(x) && D(x).sub === 'Continuous')) c.flags.dollT = g.turnNo; return false; }, res: function* () {} },
    { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon this card',
      on: (g, ev, c) => { if (ev.type !== 'phase' || ev.ph !== 'standby' || ev.tp !== c.owner || !c.flags.dollT || g.turnNo <= c.flags.dollT) return false; c.flags.dollT = 0; return true; },
      res: function* (g, c, p) { if (c.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, c, 'atk'); } }] },
  'Mask of Brutality': { cont: eqBonus(1000, -1000), effs: [equipAct(),
    { type: 'trig', loc: 'st', mand: true, label: 'Pay 1000 LP or destroy it', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && !!c.equipTo,
      res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 1000 && (yield* yn(g, p, 'Pay 1000 LP to keep Mask of Brutality?'))) pay(g, p, 1000); else destroy(g, [c], { rule: true }); } }] },
  'Mask of Darkness': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Add a Trap from the GY', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c, p) => g.p[p].gy.some(isTrap),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Trap from your GY to your hand?', g.p[p].gy.filter(isTrap), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },
  'Mask of Dispel': { effs: [
    { type: 'act', cond: (g, c, p) => allField(g).some(x => x !== c && faceUp(x) && isSpell(x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which face-up Spell Card?', allField(g).filter(x => x !== c && faceUp(x) && isSpell(x)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!onField(c)) return; if (!t || !faceUp(t)) { move(g, c, 'gy', { reason: 'rule' }); return; } c.flags.dispel = t.u; log(g, `Mask of Dispel selected ${name(t)}.`); } },
    { type: 'trig', loc: 'st', mand: true, label: '500 damage', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && !!c.flags.dispel,
      res: function* (g, c, p) { const t = allField(g).find(x => x.u === c.flags.dispel); if (t && onField(c)) damage(g, t.ctrl, 500, { src: c, srcP: p }); } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy Mask of Dispel', on: (g, ev, c) => ev.type === 'move' && ev.wasField && c.flags.dispel === ev.c.u && ev.to !== 'm' && ev.to !== 'st',
      res: function* (g, c) { if (onField(c)) destroy(g, [c], { rule: true }); } }] },
  'Mask of the Accursed': {
    cont: { grant: (g, src, m, flag) => flag === 'cantAttack' && src.equipTo === m.u },
    effs: [equipAct(() => true, 'Equip Mask of the Accursed to which monster?', 'bad'),
      { type: 'trig', loc: 'st', mand: true, opt: true, label: '500 damage', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && !!c.equipTo,
        res: function* (g, c, p) { const t = eqOf(g, c); if (t && onField(c)) damage(g, t.ctrl, 500, { src: c, srcP: p }); } }] },
  'Mask of Weakness': { effs: [{ type: 'act', label: 'Attacker loses 700 ATK',
    cond: (g, c, p) => !!(g.aw && g.aw.a && g.aw.a.ctrl !== p),
    target: function* (g, c, p, L2) { L2.t = [g.aw.a]; },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: -700, end: true }); log(g, `${name(t)} lost 700 ATK.`); } } }] },
  // ENGINE: "can't be Special Summoned except by its own rule" is only enforced from the GY (no generic flag).
  // The Mask of Remnants is only equipped here; taking control is that card's own effect.
  'Masked Beast Des Gardius': {
    proc: { label: 'Special Summon (Tribute 2, incl. Grand Tiki Elder or Melchid)',
      cond: (g, c, p) => monsOf(g, p).length >= 2 && monsOf(g, p).some(x => ['Grand Tiki Elder', 'Melchid the Four-Face Beast'].includes(D(x).n)),
      cost: function* (g, c, p, grp) { const key = monsOf(g, p).filter(x => ['Grand Tiki Elder', 'Melchid the Four-Face Beast'].includes(D(x).n));
        const [a] = yield* pick(g, p, 'Tribute Grand Tiki Elder or Melchid the Four-Face Beast', key, 1, 1, 'cost');
        const [b] = yield* pick(g, p, 'Tribute 1 more monster', monsOf(g, p).filter(x => x !== a), 1, 1, 'cost');
        for (const x of [a, b]) if (x) move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${[a, b].filter(Boolean).map(x => D(x).n).join(' and ')}.`); } },
    cont: { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src },
    effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Equip The Mask of Remnants', on: (g, ev, c) => fromFieldToGY(ev, c),
      cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'The Mask of Remnants')) && freeST(g, p) >= 0 && fieldMons(g).some(faceUp),
      res: function* (g, c, p) { const ms = g.p[p].deck.filter(x => named(x, 'The Mask of Remnants')); const ts = fieldMons(g).filter(faceUp); if (!ms.length || !ts.length || freeST(g, p) < 0) return;
        const [t] = yield* pick(g, p, 'Equip The Mask of Remnants to which monster?', ts, 1, 1, 'bad'); if (!t) return;
        move(g, ms[0], 'st', { ctrl: p, pos: 'up', reason: 'equip' }); equip(g, ms[0], t); shuffleDeck(g, p); } }] },
  'Masked Chopper': { effs: [{ type: 'trig', loc: 'any', mand: true, label: '2000 damage',
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.prevCtrl !== (onField(c) ? c.ctrl : c.owner),
    res: function* (g, c, p) { damage(g, opp(p), 2000, { src: c, srcP: p }); } }] },
  'Masked Dragon': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon a Dragon',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && race(x) === 'Dragon' && baseAtk(x) <= 1500),
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Dragon' && baseAtk(x) <= 1500); const [x] = yield* pick(g, p, 'Special Summon a Dragon with 1500 or less ATK from your Deck', cs, 1, 1, 'good'); if (x) ssx(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  'Masked Sorcerer': { effs: [{ type: 'trig', mand: true, label: 'Draw 1 card', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    res: function* (g, c, p) { draw(g, p, 1); } }] },
  'Master Gig': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Pay 1000: destroy monsters',
    cond: (g, c, p) => g.p[p].lp > 1000 && monsOf(g, p).filter(x => faceUp(x) && isPsy(x)).length <= monsOf(g, opp(p)).length,
    cost: function* (g, c, p) { pay(g, p, 1000); },
    res: function* (g, c, p) { const n = monsOf(g, p).filter(x => faceUp(x) && isPsy(x)).length, ms = monsOf(g, opp(p)); if (!n || n > ms.length) return;
      const xs = yield* pick(g, p, `Destroy ${n} of their monster${n > 1 ? 's' : ''}`, ms, n, n, 'bad'); destroy(g, xs, { by: p }); } }] },
  // ENGINE: "can't be Special Summoned except by its own rule" is only enforced from the GY.
  'Master Monk': { self: { maxAttacks: () => 2 },
    proc: { label: 'Special Summon (Tribute Monk Fighter)', cond: (g, c, p) => monsOf(g, p).some(x => named(x, 'Monk Fighter')),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Tribute Monk Fighter', monsOf(g, p).filter(x => named(x, 'Monk Fighter')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Monk Fighter.`); } } },
    cont: { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src } },
  'Master of Oz': { effs: [] },
  'Metal Detector': { effs: [{ type: 'act',
    cond: (g, c, p, x) => spellTrapAct(x.top) && isTrap(x.top.c) && D(x.top.c).sub === 'Continuous' && !x.top.negated,
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    // PARTIAL: the chained Continuous Trap's effect is negated, and no Continuous Trap can activate effects for the rest of the turn.
    // ENGINE: a Spell/Trap's continuous effects (cont) can't be negated, so those still apply.
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, false);
      addRule(g, (g2, a) => a.type === 'activate' && a.c && isTrap(a.c) && D(a.c).sub === 'Continuous', { end: g.turnNo }); log(g, 'Continuous Trap Cards are negated this turn.'); } }] },
  'Metal Dragon': { mats: [x => /^Steel Ogre Grotto #?1$/.test(D(x).n), x => named(x, 'Lesser Dragon')], effs: [] },
  'Metal Shooter': { self: { atk: (g, c) => 800 * ctr(c, 'shooter'),
      replaceDestroy: (g, c, o) => { if (o.battle || o.rule || ctr(c, 'shooter') < 1) return false; addCtr(g, c, 'shooter', -1); log(g, `Metal Shooter removed a counter instead (${ctr(c, 'shooter')} left).`); return true; } },
    effs: [{ type: 'trig', mand: true, label: 'Place 2 counters', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
      res: function* (g, c) { if (onField(c)) { addCtr(g, c, 'shooter', 2); log(g, 'Metal Shooter got 2 counters.'); } } }] },
  // PARTIAL: the equipped monster is unaffected by every Spell's destruction (the engine's unaffectedSpells check can't tell whose Spell it is).
  'Metallizing Parasite - Lunatite': {
    cont: { ...unionCont, grant: (g, src, m, flag) => flag === 'unaffectedSpells' && src.zone === 'st' && !!src.flags.union && src.equipTo === m.u },
    effs: unionEffs(() => true, 'Equip Lunatite to which monster?') },
  'Mind Haxorz': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp > 500,
    cost: function* (g, c, p) { pay(g, p, 500); },
    res: function* (g, c, p) { const o = opp(p); log(g, `${PN(g, o)}'s hand: ${g.p[o].hand.map(name).join(', ') || 'no cards'}.`);
      const sets = fieldOf(g, o).filter(x => x.pos === 'set'); log(g, `${PN(g, o)}'s Set cards: ${sets.map(x => D(x).n).join(', ') || 'none'}.`); } }] },
  'Mind Master': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Pay 800, Tribute a Psychic: summon a Psychic',
    cond: (g, c, p) => g.p[p].lp > 800 && monsOf(g, p).some(x => isPsy(x) && !named(x, 'Mind Master')) && g.p[p].deck.some(x => isPsy(x) && lv(x) <= 4),
    cost: function* (g, c, p) { pay(g, p, 800); const [x] = yield* pick(g, p, 'Tribute 1 Psychic monster', monsOf(g, p).filter(x => isPsy(x) && !named(x, 'Mind Master')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    res: function* (g, c, p) { if (freeM(g, p) < 0) return; const cs = g.p[p].deck.filter(x => isPsy(x) && lv(x) <= 4); const [x] = yield* pick(g, p, 'Special Summon a Level 4 or lower Psychic from your Deck', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  // ENGINE: no revealed-hand state; the hand is logged when this card is summoned.
  'Mind on Air': { effs: [{ type: 'trig', on: (g, ev, c) => { if (ev.type === 'summon' && ev.cs.includes(c) && faceUp(c)) log(g, `${PN(g, opp(c.ctrl))}'s hand: ${g.p[opp(c.ctrl)].hand.map(name).join(', ') || 'no cards'}.`); return false; }, res: function* () {} }] },
  'Mind Over Matter': { effs: [{ type: 'act', negSummon: true,
    cond: (g, c, p, x) => monsOf(g, p).some(isPsy) && ((!x.top && !!g.attempt && g.attempt.how !== 'flip') || (spellTrapAct(x.top) && !x.top.negated)),
    cost: function* (g, c, p, L2) { L2.data.mode = g.chain.length ? 'link' : 'summon'; L2.data.L = g.chain[g.chain.length - 1];
      const [x] = yield* pick(g, p, 'Tribute 1 Psychic monster', monsOf(g, p).filter(isPsy), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${x.pos === 'set' ? 'a face-down monster' : D(x).n}.`); } },
    res: function* (g, c, p, L2) { if (L2.data.mode === 'summon') { if (g.attempt) { g.attempt.negated = true; log(g, 'The summon was negated.'); } } else { L2.data.L.negBy = p; negate(g, L2.data.L, true); } } }] },
  'Mind Trust': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(m => lv(m) >= 2 && g.p[p].gy.some(x => isMon(x) && D(x).tu && lv(x) <= Math.floor(lv(m) / 2))),
    cost: function* (g, c, p, L2) { const [m] = yield* pick(g, p, 'Tribute 1 Level 2 or higher monster', monsOf(g, p).filter(m => lv(m) >= 2 && g.p[p].gy.some(x => isMon(x) && D(x).tu && lv(x) <= Math.floor(lv(m) / 2))), 1, 1, 'cost');
      L2.data.lv = lv(m); move(g, m, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${m.pos === 'set' ? 'a face-down monster' : D(m).n}.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Tuner from your GY?', g.p[p].gy.filter(x => isMon(x) && D(x).tu && lv(x) <= Math.floor(L2.data.lv / 2)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },
  'Mind Wipe': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length <= 3,
    res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand.slice(); for (const x of h) move(g, x, 'deck', { reason: 'effect', by: p }); log(g, `${PN(g, o)} shuffled ${h.length} card${h.length === 1 ? '' : 's'} into the Deck.`); if (h.length) draw(g, o, h.length); } }] },
});
})();
