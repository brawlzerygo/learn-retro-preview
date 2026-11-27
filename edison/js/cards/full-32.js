/* Full pool 32: Gemini, Golden, Helios, Infernity, Koa'ki Meiru, Lucky, Machina, Majestic, Mist and Morphtronic cards.
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, negate, addMod, setFaceDown,
  equip, equippedTo, link, addCtr, ctr, addRule, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv,
  baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, allCards, shuffleDeck, log, PN, has, live, opp,
  oppFaceUp, stOnField, spellTrapAct, evSummoned, battleKill, isGemini, emit, negd, tributeCands, synCombos } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const named = (c, n) => D(c).n === n;
const IC = "Iron Core of Koa'ki Meiru";
const isIC = x => named(x, IC);
const isKMMon = x => isMon(x) && /Koa'ki Meiru/.test(D(x).n);
const isInf = x => /^Infernity/.test(name(x));
const infMon = x => isMon(x) && isInf(x);
const isMorph = x => /Morphtronic/.test(name(x));
const morphMon = x => isMon(x) && isMorph(x);
const isMachina = x => isMon(x) && /Machina/.test(name(x));
const gemMon = x => isMon(x) && isGemini(x);
const ssed = x => ['special', 'synchro', 'fusion', 'ritual'].includes(x.summonType) || D(x).k === 'token';
const mainPh = g => g.phase === 'main1' || g.phase === 'main2';
const handEmpty = (g, p) => g.p[p].hand.length === 0;
const equipsOn = (g, m) => allField(g).filter(x => x.zone === 'st' && x.equipTo === m.u);
// a flag that holds for this turn only ("until the End Phase", "this turn"); writing to it later replaces it with a plain value
function tempFlag(g, c, flag, val = true) {
  const T = g.turnNo;
  Object.defineProperty(c.flags, flag, { configurable: true, enumerable: true,
    get: () => (g.turnNo === T ? val : undefined),
    set: v => { Object.defineProperty(c.flags, flag, { value: v, writable: true, configurable: true, enumerable: true }); } });
}
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?', hint = 'good') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, hint); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) { equip(g, c, t); if (L2.data.after) L2.data.after(t); } } });
// Effect Monsters (Koa'ki Meiru Hydro Barrier), as in full-04.js
function isEffMon(c) {
  const d = D(c), tx = d.tx || '';
  if (d.k === 'trap') return true;
  if (d.k === 'effect') return !(isGemini(c) && !c.flags.gemini);
  if (d.k === 'fusion' || d.k === 'synchro') return tx.split(/\r?\n/).filter(s => s.trim()).length > 1;
  if (d.k === 'ritual') return tx.replace(/^You can Ritual Summon this card with "[^"]+"\.\s*/i, '').replace(/^This card can only be Ritual Summoned[^.]*\.\s*/i, '').trim().length > 0;
  return false;
}
// a Set Trap activated as an optional trigger when its moment comes (same as full-26.js): the engine has no response
// window after a battle destruction
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });
// Trap Monsters (same as batch-7.js). ENGINE: the card keeps the Trap's data, so race()/attr() don't see its Type and Attribute.
function trapMonster(g, c, p, st) {
  if (!onField(c) || freeM(g, p) < 0) return false;
  if (!ss(g, p, c, 'def')) return false;
  c.flags.baseAtk = st.atk; c.flags.lv = st.lv; c.flags.trapMon = true; addMod(g, c, { set: st.def, which: 'def' });
  return true;
}
// a monster's position changed by a card effect: the 'pos' event that Morphtronic Map and Cord watch
function setPos(g, c, pos) { if (!onField(c) || c.pos === pos) return; c.pos = pos; g.seq++; log(g, `${name(c)} changed to ${pos === 'atk' ? 'Attack' : 'Defense'} Position.`); emit(g, { type: 'pos', c, p: c.ctrl }); }
const posChangeEv = ev => ev.type === 'pos' || (ev.type === 'flip' && !ev.battle);
// Normal Summon or Set by a card effect (Gemini Summoner): Tributes as usual, no Normal Summon used
function* effNormal(g, p, x, set) {
  const n = lv(x) >= 7 ? 2 : lv(x) >= 5 ? 1 : 0; const grp = g.group;
  if (n) { const tr = yield* pick(g, p, `Choose ${n} monster${n > 1 ? 's' : ''} to Tribute`, tributeCands(g, p), n, n, 'cost'); for (const t of tr) move(g, t, 'gy', { reason: 'tribute', by: p, group: grp }); if (tr.length) log(g, `${PN(g, p)} Tributed ${tr.map(t => D(t).n).join(', ')}.`); }
  if (freeM(g, p) < 0 || x.zone !== 'hand') return;
  move(g, x, 'm', { ctrl: p, pos: set ? 'set' : 'atk', reason: set ? 'set' : 'summon', group: grp });
  x.summonType = n ? 'tribute' : 'normal';
  if (set) { log(g, `${PN(g, p)} Set a monster.`); emit(g, { type: 'set', c: x, p }, grp); return; }
  log(g, `${PN(g, p)} ${n ? 'Tribute' : 'Normal'} Summoned ${name(x)}.`);
  const ev = emit(g, { type: 'summon', cs: [x], how: x.summonType, p, byEffect: true }, grp); g.sw = { cs: [x], p, how: x.summonType, group: ev.group };
}
/* Koa'ki Meiru maintenance (same as batch-6.js). PARTIAL: a maintenance cost is not an effect; here it runs as a mandatory
 trigger on the chain. */
function maint(revealText, revealPred) {
  return { type: 'trig', mand: true, label: 'Maintenance cost', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
    res: function* (g, c, p) {
      if (!onField(c) || !faceUp(c)) return;
      const h = g.p[p].hand, send = h.filter(isIC), rev = revealPred ? h.filter(revealPred) : [];
      const opts = [], kinds = [];
      if (send.length) { opts.push("Send an Iron Core of Koa'ki Meiru to the GY"); kinds.push('s'); }
      if (rev.length) { opts.push(revealText); kinds.push('r'); }
      opts.push(`Let ${name(c)} be destroyed`); kinds.push('d');
      const k = kinds[opts.length > 1 ? yield* choose(g, p, `${name(c)}: pay its maintenance cost?`, opts) : 0];
      if (k === 's') { const [x] = yield* pick(g, p, 'Send which card to the GY?', send, 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY to keep ${name(c)}.`); }
      else if (k === 'r') { const [x] = yield* pick(g, p, 'Reveal which card?', rev, 1, 1, 'cost'); log(g, `${PN(g, p)} revealed ${name(x)} to keep ${name(c)}.`); }
      else destroy(g, [c], { by: p, rule: true });
    } };
}
// Helios: "If this card is destroyed by battle and sent to the GY, Special Summon it during the End Phase, and it gains X ATK and DEF"
const heliosBanished = g => allCards(g, 'ban').filter(isMon).length;
const heliosRevive = bonus => [
  { type: 'trig', loc: 'gy', on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy') c.flags.hRev = g.turnNo; return false; }, res: noop },
  { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon it again',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.hRev === g.turnNo,
    cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) { if (c.zone === 'gy' && ss(g, p, c)) { addMod(g, c, { atk: bonus, def: bonus }); log(g, `${name(c)} gained ${bonus} ATK and DEF.`); } } }];
const heliosProc = need => ({ label: `Special Summon (Tribute ${need})`,
  cond: (g, c, p) => monsOf(g, p).some(x => named(x, need)),
  cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, `Tribute which ${need}?`, monsOf(g, p).filter(x => named(x, need)), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${need}.`); } });
// Majestic Synchros: "Majestic Dragon" + the named Synchro + 1 non-Tuner
function majMats(g, p, sx, need) {
  const ms = monsOf(g, p).filter(faceUp), out = [];
  for (const a of ms.filter(x => named(x, 'Majestic Dragon'))) for (const b of ms.filter(x => named(x, need)))
    for (const x of ms) if (x !== a && x !== b && !D(x).tu && lv(a) + lv(b) + lv(x) === lv(sx)) out.push([a, b, x]);
  return out;
}
const majProc = need => ({ extra: true, how: 'synchro', label: 'Synchro Summon',
  cond: (g, c, p) => majMats(g, p, c, need).length > 0,
  cost: function* (g, c, p, grp) { const cs = majMats(g, p, c, need); let mats = cs[0];
    if (cs.length > 1) { const i = yield* choose(g, p, `Synchro Summon ${name(c)} with which monsters?`, cs.map(m => m.map(name).join(' + '))); mats = cs[i]; }
    for (const m of mats) move(g, m, 'gy', { reason: 'synchro', by: p, group: grp });
    log(g, `${PN(g, p)} sent ${mats.map(m => D(m).n).join(' + ')} to the GY for a Synchro Summon.`); } });
const majNegTarget = (g, p) => oppFaceUp(g, p).filter(x => !negd(g, x));
// "During the End Phase: Target 1 <name> in your GY; return this card from the field to the Extra Deck, then Special Summon that target."
const majReturn = need => ({ type: 'trig', mand: true, tags: { ss: 1 }, label: `Return it, summon ${need}`,
  on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end',
  target: function* (g, c, p, L2) { L2.t = []; const cs = g.p[p].gy.filter(x => named(x, need)); if (cs.length) yield* tgt(g, p, L2, `Target which ${need}?`, cs, 1, 1, 'good'); },
  res: function* (g, c, p, L2) { if (!onField(c)) return; move(g, c, 'extra', { reason: 'effect' }); log(g, `${name(c)} returned to the Extra Deck.`);
    const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } });
// Majestic Mechs and the tributeless Level 5/6s: "if Summoned this way"
const noTribSummon = c => c.summonType === 'normal';
// Gemini Imps: does this effect make the Imps' controller discard? PARTIAL: read from the card's text.
function makesDiscard(Lk) {
  const tx = D(Lk.c).tx || '';
  return tx.split(/(?<=\.)\s+/).some(s => /discard/i.test(s) && /(opponent|each player|both players)/i.test(s));
}

E.addScripts({
  /* ===== Gemini ===== */
  'Gemini Booster': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 700 : 0 },
    effs: [{ type: 'act', ds: true,
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && gemMon(x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Gemini Booster to which Gemini monster?', monsOf(g, p).filter(x => faceUp(x) && gemMon(x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.ctrl === p && onField(c) && equip(g, c, t)) { L2.keep = true; c.flags.gbEq = true; } } },
    { type: 'trig', loc: 'gy', mand: true, label: 'A Gemini becomes an Effect Monster',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy' && ev.snap && ev.snap.flags && ev.snap.flags.gbEq && (ev.destroyed || ev.reason === 'rule'),
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && gemMon(x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Gemini monster becomes an Effect Monster?', monsOf(g, p).filter(x => faceUp(x) && gemMon(x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { t.flags.gemini = true; log(g, `${name(t)} is now treated as an Effect Monster.`); } } }] },
  'Gemini Counter': { effs: [{ type: 'act',
    cond: (g, c, p, x) => x.top && spellTrapAct(x.top) && isSpell(x.top.c) && x.top.p !== p && !x.top.negated && monsOf(g, p).some(m => faceUp(m) && gemMon(m)),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; yield* tgt(g, p, L2, 'Turn which Gemini monster face-down?', monsOf(g, p).filter(m => faceUp(m) && gemMon(m)), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) setFaceDown(g, t); L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  'Gemini Imps': { effs: [{ type: 'quick', loc: 'hand', tags: { destroy: 1 }, label: 'Send to GY: negate a discard',
    cond: (g, c, p, x) => x.top && x.top.p !== p && !x.top.negated && makesDiscard(x.top),
    cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Gemini Imps to the GY.`); },
    res: function* (g, c, p, L2) { const T = L2.data.L; T.negBy = p; negate(g, T, false); if (onField(T.c) && destroy(g, [T.c], { by: p }).length) draw(g, p, 1); } }] },
  'Gemini Lancer': { self: { piercing: (g, c) => !!c.flags.gemini }, effs: [] },
  'Gemini Scorpion': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon a Gemini from your hand',
    on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute', 'special', 'synchro', 'fusion', 'ritual']),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => gemMon(x) && lv(x) <= 4),
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => gemMon(x) && lv(x) <= 4); const [x] = yield* pick(g, p, 'Special Summon a Level 4 or lower Gemini monster', cs, 1, 1, 'good'); if (x) ss(g, p, x); } }] },
  'Gemini Summoner': { effs: [
    // "The first time this card would be destroyed by battle each turn" (as Gemini Soldier: applied when damage calculation dooms it)
    { type: 'trig', on: (g, ev, c) => { if (ev.type === 'afterCalc' && (ev.a === c || ev.t === c) && c.flags.battleDoomed && c.flags.gsumSafe !== g.turnNo) { c.flags.battleDoomed = false; c.flags.gsumSafe = g.turnNo; log(g, 'Gemini Summoner was not destroyed by battle.'); } return false; }, res: noop },
    { type: 'quick', opt: true, label: 'Pay 500: summon a Gemini',
      cond: (g, c, p) => g.phase === 'end' && g.tp !== p && g.p[p].lp > 500 && (g.p[p].hand.some(x => gemMon(x) && (lv(x) < 5 || tributeCands(g, p).length >= (lv(x) >= 7 ? 2 : 1)) && (freeM(g, p) >= 0 || lv(x) >= 5)) || monsOf(g, p).some(x => faceUp(x) && gemMon(x) && !x.flags.gemini)),
      cost: function* (g, c, p) { pay(g, p, 500); },
      res: function* (g, c, p) {
        const hs = g.p[p].hand.filter(gemMon), fs = monsOf(g, p).filter(x => faceUp(x) && gemMon(x) && !x.flags.gemini);
        const [x] = yield* pick(g, p, 'Summon which Gemini monster?', [...hs, ...fs], 1, 1, 'good'); if (!x) return;
        if (x.zone === 'm') { if (!faceUp(x)) return; x.flags.gemini = true; log(g, `${PN(g, p)} Gemini Summoned ${name(x)}.`); const ev = emit(g, { type: 'summon', cs: [x], how: 'gemini', p, byEffect: true }); g.sw = { cs: [x], p, how: 'gemini', group: ev.group }; return; }
        const set = (yield* choose(g, p, `${name(x)}: Normal Summon or Set?`, ['Normal Summon', 'Set'])) === 1;
        yield* effNormal(g, p, x, set); } }] },
  'Gemini Trap Hole': { effs: [trapTrig({ label: 'Destroy all their monsters', tags: { destroy: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && ev.snap && gemMon(ev.c) && ev.snap.flags && ev.snap.flags.gemini,
    cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)), { by: p, src: c }); } })] },

  /* ===== Golden ===== */
  'Golden Bamboo Sword': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].deck.length >= 2 && stOf(g, p).some(x => x !== c && faceUp(x) && isSpell(x) && /Bamboo Sword/.test(name(x)) && (D(x).sub === 'Equip' || x.equipTo)),
    res: function* (g, c, p) { draw(g, p, 2); } }] },
  'Golden Flying Fish': { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Tribute a Fish: destroy a card',
    cond: (g, c, p) => monsOf(g, p).some(x => x !== c && race(x) === 'Fish') && allField(g).length > 1,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which Fish monster?', monsOf(g, p).filter(x => x !== c && race(x) === 'Fish'), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', allField(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  'Golden Homunculus': { self: { atk: (g, c) => 300 * g.p[c.ctrl].ban.length, def: (g, c) => 300 * g.p[c.ctrl].ban.length }, effs: [] },
  // ENGINE: no Standby Phase response window; offered as a trigger at the start of your Standby Phase
  'Golden Ladybug': { effs: [{ type: 'trig', loc: 'hand', label: 'Reveal it: gain 500 LP',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner,
    cost: function* (g, c, p) { log(g, `${PN(g, p)} revealed Golden Ladybug.`); },
    res: function* (g, c, p) { gain(g, p, 500); } }] },

  /* ===== H, Helios ===== */
  'H - Heated Heart': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster gains 500 ATK?', monsOf(g, p).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; addMod(g, t, { atk: 500, end: true }); tempFlag(g, t, 'piercing'); log(g, `${name(t)} gained 500 ATK and inflicts piercing damage this turn.`); } }] },
  'Helios - The Primordial Sun': { self: { atk: g => 100 * heliosBanished(g), def: g => 100 * heliosBanished(g) }, effs: [] },
  'Helios Duo Megistus': { proc: heliosProc('Helios - The Primordial Sun'),
    self: { atk: g => 200 * heliosBanished(g), def: g => 200 * heliosBanished(g) }, effs: heliosRevive(300) },
  'Helios Trice Megistus': { proc: heliosProc('Helios Duo Megistus'),
    self: { atk: g => 300 * heliosBanished(g), def: g => 300 * heliosBanished(g), maxAttacks: (g, c) => monsOf(g, opp(c.ctrl)).length ? 2 : 1 }, effs: heliosRevive(500) },

  /* ===== Infernity ===== */
  'Infernity Archfiend': { effs: [
    { type: 'trig', loc: 'hand', when: true, tags: { ss: 1 }, label: 'Reveal it: Special Summon it',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.reason === 'draw' && g.p[c.owner].hand.every(x => x === c || g.events.some(e => e.type === 'move' && e.c === x && e.reason === 'draw' && e.group === ev.group)),
      cond: (g, c, p) => freeM(g, p) >= 0,
      cost: function* (g, c, p) { log(g, `${PN(g, p)} revealed Infernity Archfiend.`); },
      res: function* (g, c, p) { if (c.zone === 'hand') ss(g, p, c); } },
    { type: 'trig', when: true, label: 'Add an Infernity card',
      on: (g, ev, c) => evSummoned(ev, c, ['special', 'synchro', 'fusion', 'ritual']),
      cond: (g, c, p) => handEmpty(g, p) && g.p[p].deck.some(isInf),
      res: function* (g, c, p) { if (handEmpty(g, p)) yield* search(g, p, isInf, 'Add an Infernity card'); } }] },
  'Infernity Beast': { effs: [], cont: { forbid: (g, src, a) => a.type === 'activate' && a.p !== src.ctrl && a.eff.type === 'act' && isST(a.c) && handEmpty(g, src.ctrl) &&
    ((g.aw && g.aw.a === src) || (g.battle && g.battle.a === src)) } },
  'Infernity Dwarf': { effs: [], cont: { grant: (g, src, c, flag) => flag === 'piercing' && c.zone === 'm' && c.ctrl === src.ctrl && handEmpty(g, src.ctrl) } },
  'Infernity Force': { effs: [{ type: 'act', tags: { destroy: 1, ss: 1 },
    cond: (g, c, p) => g.aw && g.aw.t && g.aw.t.ctrl === p && onField(g.aw.t) && faceUp(g.aw.t) && infMon(g.aw.t) && handEmpty(g, p) && onField(g.aw.a),
    target: function* (g, c, p, L2) { const a = g.aw.a; const gy = g.p[p].gy.filter(infMon); let x = null;
      if (gy.length) [x] = yield* pick(g, p, 'Target which Infernity monster in your GY?', gy, 1, 1, 'good');
      L2.t = [a]; L2.data.gy = x; },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); const x = L2.data.gy; if (x && x.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, x); } }] },
  'Infernity Guardian': { self: { noBattleDestroy: (g, c) => handEmpty(g, c.ctrl), noEffectDestroy: (g, c) => handEmpty(g, c.ctrl) }, effs: [] },
  'Infernity Necromancer': { effs: [
    { type: 'trig', mand: true, label: 'Change to Defense Position', on: (g, ev, c) => evSummoned(ev, c, ['normal']),
      res: function* (g, c) { if (onField(c) && faceUp(c)) setPos(g, c, 'def'); } },
    { type: 'ign', opt: true, tags: { ss: 1 }, label: 'Special Summon an Infernity from your GY',
      cond: (g, c, p) => handEmpty(g, p) && freeM(g, p) >= 0 && g.p[p].gy.some(x => infMon(x) && !named(x, 'Infernity Necromancer')),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Infernity monster?', g.p[p].gy.filter(x => infMon(x) && !named(x, 'Infernity Necromancer')), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },

  /* ===== Koa'ki Meiru ===== */
  // PARTIAL: Doom stops LIGHT and DARK monster effects from being activated in the Main Phase, instead of negating them
  // as they activate. ENGINE: no hook that sees an activation as it happens.
  "Koa'ki Meiru Doom": { effs: [maint('Reveal a Fiend monster', x => isMon(x) && race(x) === 'Fiend')],
    cont: { forbid: (g, src, a) => a.type === 'activate' && mainPh(g) && a.eff && a.eff.type !== 'act' && isMon(a.c) && ['LIGHT', 'DARK'].includes(attr(a.c)) } },
  // PARTIAL: the replacement is always used when a Koa'ki Meiru monster can be banished (no prompt inside destruction)
  "Koa'ki Meiru Ghoulungulate": { effs: [maint('Reveal a Zombie monster', x => isMon(x) && race(x) === 'Zombie')],
    cont: { replaceDestroy: (g, src, c, o) => {
      if (o.rule || c.zone !== 'm' || c.ctrl !== src.ctrl || !isKMMon(c)) return false;
      const x = g.p[src.ctrl].gy.find(isKMMon); if (!x) return false;
      move(g, x, 'ban', { reason: 'effect' }); log(g, `${PN(g, src.ctrl)} banished ${D(x).n} so ${name(c)} was not destroyed.`); return true; } } },
  "Koa'ki Meiru Gravirose": { effs: [maint('Reveal a Plant monster', x => isMon(x) && race(x) === 'Plant'),
    { type: 'trig', label: 'Send a Level 3 or lower monster from the Deck to the GY',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && lv(x) <= 3),
      res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && lv(x) <= 3, 'Send a Level 3 or lower monster to the GY', 'gy'); } }] },
  "Koa'ki Meiru Hydro Barrier": { effs: [
    { type: 'ign', label: 'Iron Core to the Deck: negate Effect Monsters',
      cond: (g, c, p) => g.p[p].hand.some(isIC),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Put an Iron Core on top of your Deck', g.p[p].hand.filter(isIC), 1, 1, 'cost'); move(g, x, 'deckTop', { reason: 'cost' }); log(g, `${PN(g, p)} put Iron Core of Koa'ki Meiru on top of the Deck.`); },
      res: function* (g, c, p) { (g.f32hydro = g.f32hydro || []).push({ p, turn: g.turnNo }); hydroApply(g); log(g, "Face-up Effect Monsters other than Koa'ki Meiru have their effects negated until the next Standby Phase of " + PN(g, p) + '.'); } },
    // keeps the negation on monsters Summoned or flipped while it lasts, and ends it in that player's next Standby Phase
    { type: 'trig', loc: 'any', on: (g, ev, c) => { if (g.f32hydro && g.f32hydro.length) hydroTick(g, ev); return false; }, res: noop }] },
  "Koa'ki Meiru Ice": { effs: [maint('Reveal a Continuous Spell', x => isSpell(x) && D(x).sub === 'Continuous'),
    { type: 'ign', tags: { destroy: 1 }, label: 'Send a card: destroy a Special Summoned monster',
      cond: (g, c, p) => g.p[p].hand.length > 0 && fieldMons(g).some(ssed),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which card from your hand to the GY?', g.p[p].hand, 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Special Summoned monster?', fieldMons(g).filter(ssed), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  "Koa'ki Meiru Sea Panther": { effs: [maint('Reveal a WATER monster', x => isMon(x) && attr(x) === 'WATER'),
    { type: 'ign', opt: true, label: 'Send an Iron Core: a Spell to the Deck top',
      cond: (g, c, p) => g.p[p].hand.some(isIC) && g.p[p].gy.some(isSpell),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Iron Core to the GY?', g.p[p].hand.filter(isIC), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent Iron Core of Koa'ki Meiru to the GY.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which Spell Card to the top of your Deck?', g.p[p].gy.filter(isSpell), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'deckTop', { reason: 'effect' }); log(g, `${PN(g, p)} put ${name(t)} on top of the Deck.`); } } }] },
  "Koa'ki Meiru Speeder": { effs: [maint('Reveal a Machine monster', x => isMon(x) && race(x) === 'Machine'),
    { type: 'trig', label: 'Reveal the Iron Core: draw 1 more',
      on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && g.phase === 'draw' && isIC(ev.c) && ev.c.owner === c.ctrl,
      cond: (g, c, p, x) => x.ev.c.zone === 'hand' && g.p[p].deck.length > 0,
      cost: function* (g, c, p) { log(g, `${PN(g, p)} revealed Iron Core of Koa'ki Meiru.`); },
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  "Koa'ki Meiru Valafar": {
    // PARTIAL: with a Koa'ki Meiru on your field it can be Tribute Summoned with 1 Tribute, but the Tribute can be any monster
    self: { tributes: (g, c, p) => monsOf(g, p).some(isKMMon) ? [1] : [], piercing: true,
      replaceDestroy: (g, c, o) => { if (o.battle || o.rule) return false; const src = o.src || (g.resolvingL ? g.resolvingL.c : null); return !!src && isTrap(src); } },
    effs: [maint('', null)] },
  "Koa'ki Meiru War Arms": {
    self: { atk: (g, c) => Math.floor(equipsOn(g, c).filter(x => x.flags.f32arms === c.u && isMon(x)).reduce((s, x) => s + baseAtk(x), 0) / 2),
      replaceDestroy: (g, c, o) => { if (!o.battle) return false; const es = equipsOn(g, c).filter(x => x.flags.f32arms === c.u); if (!es.length) return false;
        destroy(g, es, { by: c.ctrl }); log(g, `${name(c)} was not destroyed by battle.`); return true; } },
    effs: [maint('Reveal a Warrior monster', x => isMon(x) && race(x) === 'Warrior'),
      { type: 'ign', opt: true, label: 'Equip a Warrior from your GY',
        cond: (g, c, p) => L.freeST(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && race(x) === 'Warrior' && lv(x) <= 3),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip which Level 3 or lower Warrior?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Warrior' && lv(x) <= 3), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy' || !onField(c) || !faceUp(c) || L.freeST(g, p) < 0) return;
          move(g, t, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); t.flags.f32arms = c.u; equip(g, t, c); } }] },

  /* ===== Level Limit, Lucky ===== */
  'Level Limit - Area A': { // PARTIAL: positions are fixed at each game event, as Level Limit - Area B
    cont: { forbid: (g, src, a) => a.type === 'pos' && a.c.pos === 'atk' && lv(a.c) <= 3 },
    effs: [{ type: 'act', res: function* (g) { const ch = areaA(g); if (ch.length) log(g, `${ch.map(name).join(', ')} changed to Attack Position.`); } },
      { type: 'trig', loc: 'st', on: (g, ev, c) => { if (faceUp(c)) areaA(g); return false; }, res: noop }] },
  // PARTIAL: used as a Quick Effect in response to the coin-tossing monster effect (a trigger in the real game), and
  // the card is drawn as the coin lands, not after that effect has fully resolved.
  'Lucky Chance': { effs: [actNoop,
    { type: 'quick', loc: 'st', label: 'Call the coin toss',
      cond: (g, c, p, x) => x.top && !x.top.cardAct && isMon(x.top.c) && !x.top.negated && c.f32lcChain !== g.chain[0] && oneCoin(x.top.c),
      cost: function* (g, c, p, L2) { L2.data.T = g.chain[g.chain.length - 1]; c.f32lcChain = g.chain[0]; },
      res: function* (g, c, p, L2) {
        const call = (yield* choose(g, p, 'Call the coin toss', ['Heads', 'Tails'])) === 0; log(g, `${PN(g, p)} called ${call ? 'Heads' : 'Tails'}.`);
        const T = L2.data.T, orig = g.rnd;
        g.rnd = function () { const v = orig(); if (g.resolvingL === T) { g.rnd = orig; if ((v < 0.5) === call) { log(g, `${PN(g, p)} called it right (Lucky Chance).`); draw(g, p, 1); } } else if (!g.chain.includes(T)) g.rnd = orig; return v; }; } }] },
  'Lucky Cloud': { effs: [{ type: 'act', res: function* (g, c, p) { (g.f32cloud = g.f32cloud || []).push({ p, turn: g.turnNo }); log(g, `${PN(g, p)} will draw 2 cards in the End Phase if 2 Cloudians with the same name were Summoned this turn.`); } },
    // records Cloudian summons this turn (any copy of Lucky Cloud anywhere sees them), and draws in the End Phase
    { type: 'trig', loc: 'any', on: (g, ev, c) => { if (ev.type === 'summon' && g.f32cloudSeq !== ev.seq) { g.f32cloudSeq = ev.seq;
        const s = g.f32cs && g.f32cs.turn === g.turnNo ? g.f32cs : (g.f32cs = { turn: g.turnNo, n: [{}, {}] });
        for (const x of ev.cs) if (/^Cloudian/.test(name(x))) s.n[ev.p][name(x)] = (s.n[ev.p][name(x)] || 0) + 1; }
      return false; }, res: noop },
    { type: 'trig', loc: 'any', mand: true, label: 'Draw 2 cards',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.zone === 'gy' && (g.f32cloud || []).some(e => e.p === c.owner && e.turn === g.turnNo && !e.done),
      cond: (g, c, p) => !!(g.f32cs && g.f32cs.turn === g.turnNo && Object.values(g.f32cs.n[p]).some(n => n >= 2)),
      res: function* (g, c, p) { const e = (g.f32cloud || []).find(x => x.p === p && x.turn === g.turnNo && !x.done); if (!e) return; e.done = true; draw(g, p, 2); } }] },
  'Lucky Iron Axe': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 500 : 0 },
    effs: [equipAct(),
      { type: 'trig', loc: 'gy', mand: true, label: 'Draw 1 card',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !ev.battle && ev.to === 'gy' && ev.snap && ev.snap.faceUp && ev.prevCtrl === c.owner &&
          (ev.by != null ? ev.by : g.resolvingL ? g.resolvingL.p : null) === opp(c.owner),
        res: function* (g, c, p) { draw(g, p, 1); } }] },
  'Lucky Pied Piper': { effs: [{ type: 'trig', mand: true, label: 'Draw 1 card',
    on: (g, ev, c) => battleKill(ev, c) && !!c.flags.gemini && ev.prevCtrl !== c.ctrl,
    res: function* (g, c, p) { draw(g, p, 1); } }] },

  /* ===== Machina, Machine King ===== */
  'Machina Armored Unit': { effs: [actNoop,
    { type: 'trig', loc: 'st', when: true, opt: true, tags: { ss: 1 }, label: 'Special Summon a weaker Machine',
      on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && ev.c.owner === c.ctrl && ev.snap && ev.snap.race === 'Machine' && race(ev.c) === 'Machine',
      cond: (g, c, p, x) => freeM(g, p) >= 0 && x.ev.c.zone === 'gy' && g.p[p].deck.some(y => isMon(y) && race(y) === 'Machine' && attr(y) === attr(x.ev.c) && baseAtk(y) < baseAtk(x.ev.c)),
      res: function* (g, c, p, L2) { const d = L2.ev.c; if (d.zone !== 'gy') return;
        const cs = g.p[p].deck.filter(y => isMon(y) && race(y) === 'Machine' && attr(y) === attr(d) && baseAtk(y) < baseAtk(d)); if (!cs.length) return;
        const [x] = yield* pick(g, p, 'Special Summon which Machine from your Deck?', cs, 1, 1, 'good'); if (x) ss(g, p, x); shuffleDeck(g, p); } }] },
  'Machina Defender': { effs: [{ type: 'trig', mand: true, label: 'Add Commander Covington',
    on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { yield* search(g, p, x => named(x, 'Commander Covington'), 'Add Commander Covington'); } }] },
  'Machina Sniper': { effs: [], cont: { grant: (g, src, c, flag) => flag === 'noAttackTarget' && c.zone === 'm' && isMachina(c) && !named(c, 'Machina Sniper') } },
  'Machina Soldier': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon a Machina from your hand',
    on: (g, ev, c) => evSummoned(ev, c, ['normal']) && monsOf(g, c.ctrl).every(x => x === c),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMachina(x) && !named(x, 'Machina Soldier')),
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isMachina(x) && !named(x, 'Machina Soldier')); const [x] = yield* pick(g, p, 'Special Summon which Machina monster?', cs, 1, 1, 'good'); if (x) ss(g, p, x); } }] },
  // ENGINE: as a monster it keeps the Trap's data, so other cards don't see it as a Machine or EARTH monster
  'Machine King - 3000 B.C.': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => !g.summoned[p] && (freeM(g, p) >= 0),
      res: function* (g, c, p) { if (!trapMonster(g, c, p, { atk: 1000, def: 1000, lv: 4 })) return;
        const u = c.u; addRule(g, (g2, a) => (a.type === 'ns' || a.type === 'ss') && a.p === p && (!a.c || a.c.u !== u), { end: g.turnNo }); } },
    { type: 'ign', opt: true, label: 'Tribute a Machine: gain its ATK',
      cond: (g, c, p) => c.zone === 'm' && monsOf(g, p).some(x => x !== c && race(x) === 'Machine'),
      cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Tribute which Machine monster?', monsOf(g, p).filter(x => x !== c && race(x) === 'Machine'), 1, 1, 'cost'); L2.data.a = atk(g, x); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
      res: function* (g, c, p, L2) { if (onField(c) && faceUp(c) && c.zone === 'm') { addMod(g, c, { atk: L2.data.a, end: true }); log(g, `${name(c)} gained ${L2.data.a} ATK.`); } } }] },

  /* ===== Majestic ===== */
  // PARTIAL: a Synchro Summon of another monster is blocked only when every material set needs Majestic Dragon
  'Majestic Dragon': { effs: [], cont: { forbid: (g, src, a) => {
    if (a.type !== 'ss' || a.how !== 'synchro' || !a.c || a.c.zone !== 'extra' || a.p !== src.ctrl || /Majestic/.test(D(a.c).n)) return false;
    const cs = synCombos(g, a.p, a.c); return cs.length > 0 && cs.every(m => m.includes(src)); } } },
  'Majestic Red Dragon': { noSynchro: true, proc: majProc('Red Dragon Archfiend'), self: { noEffectDestroy: true },
    effs: [
      { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy all Defense Position monsters',
        on: (g, ev, c) => ev.type === 'afterCalc' && ev.a === c,
        res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.pos !== 'atk'), { by: p }); } },
      { type: 'ign', opt: true, label: "Negate a monster: gain its ATK",
        cond: (g, c, p) => majNegTarget(g, p).length > 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Negate which monster?', majNegTarget(g, p), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || negd(g, t)) return; tempFlag(g, t, 'negated'); g.seq++; log(g, `${name(t)}'s effects were negated until the End Phase.`);
          if (onField(c) && faceUp(c)) { const a = atk(g, t); addMod(g, c, { atk: a, end: true }); log(g, `${name(c)} gained ${a} ATK.`); } } },
      majReturn('Red Dragon Archfiend')] },
  'Majestic Star Dragon': { noSynchro: true, proc: majProc('Stardust Dragon'),
    effs: [
      { type: 'quick', tags: { destroy: 1 }, label: 'Tribute: negate and destroy their cards',
        cond: (g, c, p, x) => x.top && x.top.p !== p && !x.top.negated,
        cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed Majestic Star Dragon.`); },
        res: function* (g, c, p, L2) { const T = L2.data.L; T.negBy = p; negate(g, T, false); destroy(g, fieldOf(g, opp(p)), { by: p }); } },
      // PARTIAL: every field effect of the negated monster can be used this turn, not just 1 of them
      { type: 'ign', opt: true, label: "Negate a monster: copy its effects",
        cond: (g, c, p) => majNegTarget(g, p).length > 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Negate which monster?', majNegTarget(g, p), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || negd(g, t)) return; tempFlag(g, t, 'negated'); if (isGemini(t)) t.flags.gemini = true; g.seq++;
          log(g, `${name(t)}'s effects were negated until the End Phase.`);
          if (onField(c) && faceUp(c)) { tempFlag(g, c, 'copyEffs', D(t).n); log(g, `${name(c)} can use ${D(t).n}'s effects this turn.`); } } },
      majReturn('Stardust Dragon')] },
  // PARTIAL: it can also be Set with 1 Tribute
  'Majestic Mech - Goryu': { self: { tributes: () => [1], piercing: true },
    effs: [{ type: 'trig', mand: true, label: 'Send it to the GY',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.summonType === 'tribute' && (c.tributes || []).length === 1,
      res: function* (g, c) { if (onField(c)) { move(g, c, 'gy', { reason: 'effect' }); log(g, `${D(c).n} was sent to the GY.`); } } }] },
  // PARTIAL (Ohka, Mist Archfiend, Goku En): the no-Tribute rule also lets them be Set without a Tribute
  'Majestic Mech - Ohka': { self: { tributes: () => [0] },
    effs: [{ type: 'trig', mand: true, label: 'Send it to the GY',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && noTribSummon(c),
      res: function* (g, c) { if (onField(c)) { move(g, c, 'gy', { reason: 'effect' }); log(g, `${D(c).n} was sent to the GY.`); } } }] },
  'Majestic Mech - Senku': { effs: [
    { type: 'trig', on: (g, ev, c) => { if (evSummoned(ev, c)) c.f32sum = g.turnNo; return false; }, res: noop },
    { type: 'trig', mand: true, label: 'Draw 1 card', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.direct && ev.src === c && ev.p !== c.ctrl,
      res: function* (g, c, p) { draw(g, p, 1); } },
    { type: 'trig', mand: true, label: 'Send it to the GY',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.f32sum === g.turnNo,
      res: function* (g, c) { if (onField(c)) { move(g, c, 'gy', { reason: 'effect' }); log(g, 'Majestic Mech - Senku was sent to the GY.'); } } }] },
  'Malevolent Mech - Goku En': { self: { tributes: () => [0] },
    effs: [{ type: 'trig', mand: true, opt: true, label: 'Send it to the GY and take damage',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && noTribSummon(c),
      cond: (g, c) => onlyZombie(g, c),
      res: function* (g, c, p) { if (!onField(c) || !onlyZombie(g, c)) return; const who = c.ctrl; move(g, c, 'gy', { reason: 'effect' }); log(g, 'Malevolent Mech - Goku En was sent to the GY.'); damage(g, who, baseAtk(c), { src: c, srcP: who }); } }] },

  /* ===== Mist ===== */
  'Mist Archfiend': { self: { tributes: () => [0] },
    effs: [{ type: 'trig', mand: true, opt: true, tags: { destroy: 1 }, label: 'Destroy it and take 1000 damage',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && noTribSummon(c),
      res: function* (g, c) { if (!onField(c)) return; const who = c.ctrl; if (destroy(g, [c], { by: who }).length) damage(g, who, 1000, { src: c, srcP: who }); } }] },
  'Mist Body': { cont: { grant: (g, src, m, flag) => flag === 'noBattleDestroy' && src.equipTo === m.u }, effs: [equipAct()] },
  'Mist Valley Shaman': { effs: [{ type: 'ign', opt: true, label: 'Return a monster: +500 ATK',
    cond: (g, c, p) => monsOf(g, p).some(x => x !== c),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Return which monster to the hand?', monsOf(g, p).filter(x => x !== c), 1, 1, 'cost'); const n = D(x).n; move(g, x, 'hand', { reason: 'cost' }); log(g, `${PN(g, p)} returned ${n} to the hand.`); },
    res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500, end: true }); log(g, 'Mist Valley Shaman gained 500 ATK.'); } } }] },
  'Mist Valley Soldier': { effs: [{ type: 'trig', mand: true, label: 'Return the monster it battled',
    on: (g, ev, c) => { if (ev.type !== 'dsEnd' || (ev.a !== c && ev.t !== c)) return false; const o = ev.a === c ? ev.t : ev.a; return !!o && onField(o) && o.ctrl !== c.ctrl; },
    res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; if (o && onField(o) && o.ctrl !== p) { const n = name(o); move(g, o, 'hand', { reason: 'effect' }); log(g, `${n} returned to its owner's hand.`); } } }] },
  'Mist Valley Thunderbird': { effs: [{ type: 'trig', loc: 'hand', mand: true, tags: { ss: 1 }, label: 'Special Summon it',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'hand' && ev.snap && ev.snap.faceUp,
    cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) { if (c.zone === 'hand' && ss(g, p, c)) tempFlag(g, c, 'cantAttack'); } }] },

  /* ===== Morphtronic ===== */
  'Morphtronic Accelerator': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.p[p].deck.length > 0 && g.p[p].hand.some(x => x !== c && morphMon(x)) && allField(g).some(x => x !== c),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', allField(g).filter(x => x !== c), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const hs = g.p[p].hand.filter(morphMon); if (!hs.length) return;
      const [x] = yield* pick(g, p, 'Return which Morphtronic monster to the Deck?', hs, 1, 1, 'cost'); move(g, x, 'deck', { reason: 'effect' }); log(g, `${PN(g, p)} shuffled ${D(x).n} into the Deck.`);
      if (destroy(g, live(L2), { by: p }).length) draw(g, p, 1); } }] },
  'Morphtronic Cameran': { cont: { grant: (g, src, c, flag) => flag === 'cantBeTargeted' && src.pos === 'def' && c.zone === 'm' && morphMon(c) },
    effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon a Morphtronic',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.snap && ev.snap.pos === 'atk' && !negdSnap(g, ev),
      cond: (g, c, p) => freeM(g, p) >= 0 && camCands(g, p).length > 0,
      res: function* (g, c, p) { const cs = camCands(g, p); if (!cs.length) return; const [x] = yield* pick(g, p, 'Special Summon which Morphtronic?', cs, 1, 1, 'good'); if (x) ss(g, p, x); } }] },
  'Morphtronic Clocken': { self: { atk: (g, c) => c.pos === 'atk' ? 500 * ctr(c, 'morph') : 0 },
    effs: [{ type: 'ign', opt: true, label: 'Place a Morph Counter', cond: (g, c) => c.pos === 'def',
      res: function* (g, c) { if (onField(c)) { addCtr(g, c, 'morph', 1); log(g, `Morphtronic Clocken got a Morph Counter (${ctr(c, 'morph')}).`); } } },
    { type: 'ign', label: 'Tribute it: 1000 damage per counter', cond: (g, c) => c.pos === 'def' && ctr(c, 'morph') > 0,
      cost: function* (g, c, p, L2) { L2.data.n = ctr(c, 'morph'); move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Morphtronic Clocken.`); },
      res: function* (g, c, p, L2) { damage(g, opp(p), 1000 * L2.data.n, { src: c, srcP: p }); } }] },
  'Morphtronic Cord': { effs: [equipAct(morphMon, 'Equip to which Morphtronic monster?'),
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy a Spell or Trap',
      on: (g, ev, c) => posChangeEv(ev) && c.equipTo && ev.c.u === c.equipTo,
      cond: g => stOnField(g).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell or Trap Card?', stOnField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  'Morphtronic Datatron': { effs: [
    { type: 'ign', opt: true, label: 'Tribute a monster: 600 damage', cond: (g, c, p) => c.pos === 'atk' && monsOf(g, p).length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
      res: function* (g, c, p) { damage(g, opp(p), 600, { src: c, srcP: p }); } },
    { type: 'ign', opt: true, label: '300 damage', cond: (g, c) => c.pos === 'def',
      res: function* (g, c, p) { damage(g, opp(p), 300, { src: c, srcP: p }); } }] },
  'Morphtronic Engine': { cont: { atk: (g, src, m) => src.equipTo === m.u ? baseAtk(m) : 0 },
    effs: [{ type: 'act',
      cond: g => fieldMons(g).some(m => faceUp(m) && morphMon(m) && lv(m) === 3),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which Level 3 Morphtronic?', fieldMons(g).filter(m => faceUp(m) && morphMon(m) && lv(m) === 3), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && equip(g, c, t)) { c.flags.engAct = g.turnNo; c.flags.engN = 0; } } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy it and take damage',
      on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.flags.engAct != null && g.turnNo > c.flags.engAct && c.flags.engSeen !== g.turnNo) { c.flags.engSeen = g.turnNo; c.flags.engN++; return c.flags.engN === 2; } return false; },
      res: function* (g, c, p) { const m = equippedTo(g, c); const a = m ? baseAtk(m) : 0; if (destroy(g, [c], { by: p }).length && a) damage(g, p, a, { src: c, srcP: p }); } }] },
  'Morphtronic Magnen': { self: { attackOk: (g, c, t) => { if (c.pos !== 'atk') return true; const fu = oppFaceUp(g, c.ctrl); if (!fu.length) return true; const hi = Math.max(...fu.map(x => atk(g, x))); return faceUp(t) && atk(g, t) === hi; } },
    // PARTIAL: in Defense Position, face-down monsters beside it can still be attacked
    effs: [], cont: { grant: (g, src, c, flag) => flag === 'noAttackTarget' && src.pos === 'def' && c !== src && c.zone === 'm' && c.ctrl === src.ctrl,
      forbid: (g, src, a) => a.type === 'attack' && src.pos === 'def' && a.c.ctrl !== src.ctrl && monsOf(g, src.ctrl).every(x => faceUp(x) && has(g, x, 'noAttackTarget')) && !has(g, a.c, 'directAttack') } },
  'Morphtronic Magnen Bar': { cont: { forbid: (g, src, a) => a.type === 'attack' && src.pos === 'def' && a.c.ctrl === src.ctrl },
    effs: [{ type: 'ign', opt: true, label: 'Gain the ATK of your other 2 monsters',
      cond: (g, c, p) => g.phase === 'main1' && c.pos === 'atk' && (() => { const o = monsOf(g, p).filter(x => x !== c); return o.length === 2 && o.every(x => x.pos === 'atk'); })(),
      cost: function* (g, c, p, L2) { L2.data.ms = monsOf(g, p).filter(x => x !== c); },
      res: function* (g, c, p, L2) { const ms = L2.data.ms.filter(x => onField(x) && x.ctrl === p);
        const us = ms.map(x => x.u); addRule(g, (g2, a) => a.type === 'attack' && us.includes(a.c.u), { end: g.turnNo });
        if (!onField(c) || !faceUp(c)) return; const n = ms.reduce((s, x) => s + atk(g, x), 0); addMod(g, c, { atk: n, end: true }); log(g, `Morphtronic Magnen Bar gained ${n} ATK. The other 2 monsters can't attack this turn.`); } }] },
  'Morphtronic Map': { cont: { atk: (g, src, m) => morphMon(m) ? 300 * ctr(src, 'morph') : 0 },
    effs: [actNoop,
      { type: 'trig', loc: 'fz', on: (g, ev, c) => { if (posChangeEv(ev) && c.flags.mapGrp !== ev.group) { c.flags.mapGrp = ev.group; addCtr(g, c, 'morph', 1); } return false; }, res: noop },
      { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon a Morphtronic from your GY',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy',
        cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(morphMon),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Morphtronic?', g.p[p].gy.filter(morphMon), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  'Morphtronic Mix-up': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).filter(x => faceUp(x) && morphMon(x)).length >= 2 && fieldOf(g, opp(p)).length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select 2 cards your opponent controls', fieldOf(g, opp(p)), 2, 2, 'bad'); },
    res: function* (g, c, p, L2) { const ts = live(L2).filter(x => x.ctrl === opp(p)); if (!ts.length) return;
      const [x] = ts.length > 1 ? yield* pick(g, opp(p), 'Morphtronic Mix-up: destroy which of your cards?', ts, 1, 1, 'cost') : ts; if (x) destroy(g, [x], { by: p }); } }] },
  'Morphtronic Monitron': { effs: [actNoop,
    { type: 'trig', loc: 'st', when: true, label: 'Change it to Defense Position',
      on: (g, ev, c) => ev.type === 'summon' && !g.inDS && ev.cs.some(x => morphMon(x) && onField(x) && x.pos === 'atk'),
      res: function* (g, c, p, L2) { const cs = L2.ev.cs.filter(x => morphMon(x) && onField(x) && x.pos === 'atk'); if (!cs.length) return;
        const [x] = cs.length > 1 ? yield* pick(g, p, 'Change which Morphtronic to Defense Position?', cs, 1, 1) : cs; if (x) setPos(g, x, 'def'); } }] },
  'Morphtronic Repair Unit': { cont: { forbid: (g, src, a) => a.type === 'pos' && src.equipTo === a.c.u },
    effs: [{ type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => x !== c && morphMon(x)) && g.p[p].gy.some(morphMon),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Morphtronic from your hand to the GY?', g.p[p].hand.filter(morphMon), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Morphtronic from your GY?', g.p[p].gy.filter(morphMon), 1, 1, 'good'); },
      // when this card leaves the field the monster is destroyed (link); if the monster leaves, this card goes too
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy' || !onField(c)) return; if (ss(g, p, t) && equip(g, c, t)) link(g, c, t); } }] },
  'Morphtronic Rusty Engine': { effs: [
    { ...equipAct(morphMon, 'Equip to which Morphtronic monster?'),
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && morphMon(t) && onField(c) && equip(g, c, t)) c.f32eq = t; } },
    { type: 'trig', loc: 'any', mand: true, label: 'Damage to each player',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ['gy', 'ban'].includes(ev.to) && !!c.f32eq && g.events.some(e => e.type === 'move' && e.c === c.f32eq && e.destroyed && e.wasField && e.group === ev.group),
      res: function* (g, c, p) { const m = c.f32eq; c.f32eq = null; const n = m ? baseAtk(m) : 0; if (n) { damage(g, p, n, { src: c, srcP: p }); damage(g, opp(p), n, { src: c, srcP: p }); } } }] },
  'Morphtronic Videon': { self: { atk: (g, c) => c.pos === 'atk' ? 800 * equipsOn(g, c).length : 0, def: (g, c) => c.pos === 'def' ? 800 * equipsOn(g, c).length : 0 }, effs: [] },
});

/* ----- helpers used above (hoisted function declarations) ----- */
function oneCoin(c) { const tx = D(c).tx || ''; return /toss a coin/i.test(tx) && !/(twice|three times|3 times|\d coins|coin \d times)/i.test(tx); }
function onlyZombie(g, c) { const zs = fieldMons(g).filter(x => faceUp(x) && race(x) === 'Zombie'); return zs.length === 1 && zs[0] === c; }
function camCands(g, p) { return [...g.p[p].hand, ...g.p[p].gy].filter(x => morphMon(x) && lv(x) <= 4 && !named(x, 'Morphtronic Cameran')); }
function negdSnap(g, ev) { return !!(ev.snap && ev.snap.flags && ev.snap.flags.negated); }
function areaA(g) { const ch = fieldMons(g).filter(x => x.pos === 'def' && lv(x) <= 3); for (const x of ch) x.pos = 'atk'; return ch; }
function hydroApply(g) {
  for (const x of fieldMons(g)) if (faceUp(x) && !x.flags.negated && isEffMon(x) && !isKMMon(x)) { x.flags.negated = true; x.flags.f32hydro = true; g.seq++; }
}
function hydroTick(g, ev) {
  if (ev.type === 'phase' && ev.ph === 'standby') {
    const before = g.f32hydro.length; g.f32hydro = g.f32hydro.filter(e => !(e.p === ev.tp && g.turnNo > e.turn));
    if (g.f32hydro.length !== before && !g.f32hydro.length) { for (const x of fieldMons(g)) if (x.flags.f32hydro) { x.flags.negated = false; x.flags.f32hydro = false; } g.seq++; log(g, "Koa'ki Meiru Hydro Barrier's negation ended."); return; }
  }
  hydroApply(g);
}
})();
