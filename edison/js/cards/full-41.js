/* Full pool batch 41: Magnetic Mosquito to Noisy Gnat (build/batches/full/full-41.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings.
 Cards with a Goat-only script elsewhere (Morphing Jar #2 and Mushroom Man #2 in full-25.js, Mesmeric Control and Multiply in
 classic-4.js, Negate Attack in classic-5.js) are ported here under their Edison names; the Goat-only ones still win under Goat. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, takeControl, negate, addMod, equip, equippedTo, link,
  addCtr, ctr, negateAttack, endBattle, addRule, tokens, search, mill, dice, winDuel, name, D, isMon, isST, isSpell, isTrap, isExtraD,
  onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN,
  has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned, battleKill, emit, forbid, num } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
const flip = (label, more) => ({ type: 'trig', mand: true, faceDownOk: true, label, on: (g, ev, c) => ev.type === 'flip' && ev.c === c, ...more });
const setPos = (g, c, pos) => { if (!onField(c) || c.zone !== 'm' || c.pos === pos) return; const from = c.pos; c.pos = pos; g.seq++; log(g, `${name(c)} was changed to ${pos === 'atk' ? 'Attack' : 'Defense'} Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from }); };
const fieldSpellUp = g => g.p.some(P => P.fz && faceUp(P.fz));
const sanctuary = g => allField(g).some(x => faceUp(x) && named(x, 'The Sanctuary in the Sky'));
const isTuner = c => !!(D(c).tu || c.flags.f41tuner);
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) equip(g, c, t); } });
// give a monster back to a player (control change); no free zone sends it to the GY
function giveBack(g, m, to) {
  if (!onField(m) || m.ctrl === to) return;
  if (freeM(g, to) >= 0) { takeControl(g, to, m, false); m.flags.ctrlUntil = null; m.flags.ctrlFrom = null; }
  else move(g, m, 'gy', { reason: 'rule' });
}

/* "Cannot be Special Summoned" and "Must be Special Summoned (from your hand) ... Cannot be Special Summoned by other ways".
 ENGINE: no general "can't be Special Summoned" flag, so one duel-long rule is installed by the first event any of these cards sees.
 PARTIAL: an effect that Special Summons one of the hand-only monsters from the hand is not stopped. */
const LOCKS = {
  'Minoan Centaur': () => true,
  'Montage Dragon': a => a.c.zone !== 'hand',
  'Neos Wiseman': a => a.c.zone !== 'hand',
  // once properly summoned it may come back from the GY or banished pile
  'Malefic Blue-Eyes White Dragon': a => a.c.zone !== 'hand' && !(['gy', 'ban'].includes(a.c.zone) && a.c.f41nomi),
};
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: (g, ev, c) => {
    if (!g.f41lock) { g.f41lock = true; addRule(g, (g2, a) => { if (a.type !== 'ss' || !a.c || !a.c.id) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(a); }); }
    if (ev.type === 'summon' && ev.cs.includes(c) && c.flags.f41proc) c.f41nomi = true;
    return false; } };

// Synchro Summon with a named Tuner (Moon Dragon Quilla: "Supay"); a monster made a Tuner by Natural Tune counts here
function synMats(g, p, sx, tunerOk) {
  const mons = monsOf(g, p).filter(faceUp), out = [], Lv = num(D(sx).lv);
  for (let mask = 1; mask < (1 << mons.length) && out.length < 12; mask++) {
    const mats = mons.filter((_, i) => mask & (1 << i)); if (mats.length < 2) continue;
    if (mats.reduce((s, c) => s + lv(c), 0) !== Lv) continue;
    if (mats.some(t => isTuner(t) && tunerOk(t) && mats.filter(x => x !== t).every(x => !isTuner(x)))) out.push(mats);
  }
  return out;
}
const synProc = tunerOk => ({ extra: true, how: 'synchro', label: 'Synchro Summon',
  cond: (g, c, p) => synMats(g, p, c, tunerOk).length > 0,
  cost: function* (g, c, p, grp) { const cs = synMats(g, p, c, tunerOk); let mats = cs[0];
    if (cs.length > 1) { const i = yield* choose(g, p, `Synchro Summon ${name(c)} with which monsters?`, cs.map(m => m.map(name).join(' + '))); mats = cs[i]; }
    for (const m of mats) move(g, m, 'gy', { reason: 'synchro', by: p, group: grp });
    log(g, `${PN(g, p)} sent ${mats.map(m => D(m).n).join(' + ')} to the GY for a Synchro Summon.`); } });

/* Spell resolutions a face-up monster sees (Mythical Beast Cerberus). A Spell Card activation counts once its chain link has
 left the chain without being negated. A link is noticed when it is on the chain (or resolving) during any game event; a Spell
 activated from the hand is also noticed by its own activation, and counts when it reaches the GY by rule (Normal, Quick-Play)
 or is still face-up once the chain is empty (Continuous, Equip, Field). PARTIAL: a Set Spell flipped up whose chain makes
 no game event at all is missed. Returns how many resolved since the last call. */
function spellsResolved(g, ev, c) {
  const W = c.flags.f41sp || (c.flags.f41sp = {}); let n = 0;
  const links = g.chain.slice(); if (g.resolvingL) links.push(g.resolvingL);
  for (const L2 of links) if (L2 && L2.cardAct && isSpell(L2.c)) { const w = W[L2.c.u]; if (!w) W[L2.c.u] = { L: L2, c: L2.c }; else if (!w.L) w.L = L2; else if (w.L !== L2) W[L2.c.u] = { L: L2, c: L2.c }; }
  if (ev.type === 'move' && ev.reason === 'activate' && isSpell(ev.c) && !W[ev.c.u]) W[ev.c.u] = { L: null, c: ev.c, seq: ev.seq };
  for (const k of Object.keys(W)) {
    const w = W[k];
    if (w.L) { if (g.chain.includes(w.L) || g.resolvingL === w.L) continue; delete W[k]; if (!w.L.negated) n++; continue; }
    if (ev.type === 'move' && ev.c === w.c && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule') { delete W[k]; n++; continue; }
    if (ev.seq > w.seq && !g.chain.length && !g.resolvingL) { delete W[k]; if (onField(w.c) && faceUp(w.c)) n++; }
  }
  return n;
}

E.addScripts({
  'Magnetic Mosquito': { effs: [flip('Destroy all face-up Machine monsters', { tags: { destroy: 1 },
    res: function* (g, c, p) { const xs = fieldMons(g).filter(m => faceUp(m) && race(m) === 'Machine'); if (xs.length) destroy(g, xs, { by: p }); } })] },

  'Maiden of Macabre': { self: { atk: (g, c) => 200 * ctr(c, 'spell') },
    effs: [{ type: 'trig', mand: true, label: 'Place a Spell Counter',
      on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.killer === c && ev.wasField && ev.snap && ev.snap.ctrl !== c.ctrl,
      res: function* (g, c) { if (!onField(c) || !faceUp(c)) return; addCtr(g, c, 'spell', 1); log(g, `Maiden of Macabre got a Spell Counter (${ctr(c, 'spell')}).`); } }] },

  // Main Phase 1 only (ruling); the Battle Phase lock applies on activation
  'Makiu, the Magical Mist': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.phase === 'main1' && monsOf(g, p).some(m => faceUp(m) && (named(m, 'Summoned Skull (Archfiend)') || name(m) === 'Summoned Skull' || race(m) === 'Thunder')),
    after: (g, c, p) => { g.noBP[p] = true; log(g, `${PN(g, p)} can't conduct the Battle Phase this turn.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which Summoned Skull or Thunder monster?', monsOf(g, p).filter(m => faceUp(m) && (named(m, 'Summoned Skull (Archfiend)') || name(m) === 'Summoned Skull' || race(m) === 'Thunder')), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const n = atk(g, t);
      const xs = monsOf(g, opp(p)).filter(m => def(g, m) <= n); if (xs.length) destroy(g, xs, { by: p, src: c }); } }] },

  'Malefic Blue-Eyes White Dragon': {
    proc: { label: 'Special Summon (banish Blue-Eyes White Dragon from the Deck)',
      cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'Blue-Eyes White Dragon')) && !fieldMons(g).some(m => faceUp(m) && /^Malefic/.test(D(m).n)),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish which Blue-Eyes White Dragon from your Deck?', g.p[p].deck.filter(x => named(x, 'Blue-Eyes White Dragon')), 1, 1, 'cost');
        if (x) { move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished Blue-Eyes White Dragon from the Deck.`); } shuffleDeck(g, p); c.flags.f41proc = true; } },
    cont: { forbid: (g, src, a) => (a.type === 'attack' && a.c && a.c !== src && a.c.ctrl === src.ctrl) ||
      (['ss', 'ns'].includes(a.type) && a.c && a.c !== src && a.c.id && /^Malefic/.test(D(a.c).n)) },
    // PARTIAL: "destroy this card" with no face-up Field Spell is a chain link here, not instant
    effs: [lockInstall,
      { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroyed: no Field Spell',
        on: (g, ev, c) => { if (c.flags.f41doom || fieldSpellUp(g)) return false; c.flags.f41doom = true; return true; },
        res: function* (g, c, p) { c.flags.f41doom = false; if (onField(c) && faceUp(c) && !fieldSpellUp(g)) destroy(g, [c], { by: p }); } }] },

  'Malfunction': { effs: [{ type: 'act',
    cond: (g, c, p, x) => !!x.top && spellTrapAct(x.top) && isTrap(x.top.c) && g.p[p].lp > 500,
    cost: function* (g, c, p) { pay(g, p, 500); },
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; if (!T) return; T.negBy = p; negate(g, T, false);
      if (onField(T.c) && T.c.zone === 'st') { T.c.pos = 'set'; T.keep = true; g.seq++; log(g, `${D(T.c).n} was Set again.`); } } }] },

  // PARTIAL: a chain is seen through the game events made while it resolves; a chain of links that make none is missed
  'Man Beast of Ares': { effs: [{ type: 'trig', res: noop,
    on: (g, ev, c) => {
      if (g.chain.length >= 2 || (g.resolvingL && g.resolvingL.link >= 2)) c.flags.f41chain = true;
      // a resolved Spell/Trap link leaving for the GY while another link still waits: the chain had 2 or more links
      else if (g.chain.length >= 1 && ev.type === 'move' && ev.reason === 'rule' && ev.from === 'st' && ev.to === 'gy') c.flags.f41chain = true;
      else if (c.flags.f41chain && !g.chain.length && !g.resolvingL) { c.flags.f41chain = false; addMod(g, c, { atk: 500 }); log(g, 'Man Beast of Ares gained 500 ATK.'); }
      return false; } }] },

  // ENGINE: no Standby Phase response window, so this is offered as an optional trigger at the start of the opponent's Standby Phase
  'Maniacal Servant': { effs: [{ type: 'trig', opt: true, label: 'Banish DARK monsters: gain DEF',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl,
    cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'DARK'),
    cost: function* (g, c, p, L2) { const cs = g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK');
      const xs = yield* pick(g, p, 'Banish which DARK monsters from your GY?', cs, 1, cs.length, 'cost');
      for (const x of xs) move(g, x, 'ban', { reason: 'cost', by: p }); L2.data.n = xs.length; log(g, `${PN(g, p)} banished ${xs.length} DARK monster${xs.length > 1 ? 's' : ''}.`); },
    res: function* (g, c, p, L2) { if (!onField(c) || !faceUp(c)) return; addMod(g, c, { def: 500 * L2.data.n, end: true }); log(g, `Maniacal Servant gained ${500 * L2.data.n} DEF.`); } }] },

  'Marshmallon': { self: { noBattleDestroy: true },
    effs: [{ type: 'trig', mand: true, label: '1000 damage to the attacker',
      on: (g, ev, c) => ev.type === 'afterCalc' && ev.t === c && ev.flipped,
      res: function* (g, c, p, L2) { const a = L2.ev && L2.ev.a; damage(g, a ? a.ctrl : opp(p), 1000, { src: c, srcP: p }); } }] },

  // PARTIAL: a face-down monster can't be given "can't be attacked", so it stays a legal target
  'Marshmallon Glasses': { cont: { grant: (g, src, c, flag) => flag === 'noAttackTarget' && c.zone === 'm' && c.ctrl === src.ctrl && !named(c, 'Marshmallon') && monsOf(g, src.ctrl).some(m => named(m, 'Marshmallon')) },
    effs: [actNoop] },

  'Mass Hypnosis': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && /^Alien/.test(D(m).n)) && freeM(g, p) >= 0 && monsOf(g, opp(p)).some(m => ctr(m, 'A') > 0),
    target: function* (g, c, p, L2) { const cs = monsOf(g, opp(p)).filter(m => ctr(m, 'A') > 0); yield* tgt(g, p, L2, 'Take control of which monsters with A-Counters?', cs, 1, Math.min(3, nFreeM(g, p)), 'bad'); },
    res: function* (g, c, p, L2) { if (onField(c)) c.flags.f41turn = g.turnNo;
      for (const t of live(L2)) if (t.ctrl !== p && ctr(t, 'A') > 0 && takeControl(g, p, t, false)) t.flags.f41hyp = true; } },
    { type: 'trig', loc: 'st', mand: true, label: 'Destroyed in the End Phase',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.f41turn === g.turnNo,
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } },
    // control goes back when the monster loses its A-Counter (ruling); a monster turned face-down stays
    { type: 'trig', loc: 'any', res: noop, on: (g) => { for (const m of fieldMons(g)) if (m.flags.f41hyp && faceUp(m) && ctr(m, 'A') === 0 && m.ctrl !== m.owner) { m.flags.f41hyp = false; giveBack(g, m, m.owner); } return false; } }] },

  // Its halved ATK/DEF and Level 2 last until its controller's next Standby Phase (no chain)
  'Max Warrior': { self: {
      atk: (g, c) => g.inDS && g.battle && g.battle.a === c && g.battle.t ? 400 : 0,
      def: (g, c) => c.flags.f41def != null ? c.flags.f41def - num(D(c).def) : 0 },
    effs: [{ type: 'trig', mand: true, label: 'Halve original ATK/DEF, Level 2',
      on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.killer === c && ev.wasField && ev.snap && ev.snap.ctrl !== c.ctrl,
      res: function* (g, c) { if (!onField(c) || !faceUp(c)) return;
        c.flags.baseAtk = Math.floor(baseAtk(c) / 2); c.flags.f41def = Math.floor((c.flags.f41def != null ? c.flags.f41def : num(D(c).def)) / 2); c.flags.lv = 2; c.flags.f41max = true;
        log(g, `Max Warrior became Level 2 with ${c.flags.baseAtk} original ATK.`); } },
    { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.flags.f41max) { c.flags.baseAtk = null; c.flags.f41def = null; c.flags.lv = null; c.flags.f41max = false; log(g, 'Max Warrior returned to normal.'); } return false; } }] },

  'Maximum Six': { effs: [{ type: 'trig', mand: true, label: 'Roll a die: gain ATK',
    on: (g, ev, c) => evSummoned(ev, c, ['tribute']),
    res: function* (g, c, p) { const n = L.dice(g, p); if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 200 * n }); log(g, `Maximum Six gained ${200 * n} ATK.`); } } }] },

  'Mecha Bunny': { effs: [flip('500 damage to a card\'s controller', {
    cond: g => allField(g).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select a card: its controller takes 500 damage', allField(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) damage(g, t.ctrl, 500, { src: c, srcP: p }); } }),
    { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon a Mecha Bunny face-down',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => named(x, 'Mecha Bunny')),
      res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => named(x, 'Mecha Bunny')); if (!cs.length || freeM(g, p) < 0) return; ss(g, p, cs[0], 'set'); shuffleDeck(g, p); } }] },

  'Mechanical Hound': { cont: { forbid: (g, src, a) => a.type === 'activate' && a.p !== src.ctrl && a.c && isSpell(a.c) && a.eff && a.eff.type === 'act' && g.p[src.ctrl].hand.length === 0 } },

  'Medium Piece Golem': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon Small Piece Golem',
    on: (g, ev, c) => evSummoned(ev, c),
    cond: (g, c, p) => freeM(g, p) >= 0 && monsOf(g, p).some(m => faceUp(m) && named(m, 'Big Piece Golem')) && g.p[p].deck.some(x => named(x, 'Small Piece Golem')),
    res: function* (g, c, p) { if (!monsOf(g, p).some(m => faceUp(m) && named(m, 'Big Piece Golem')) || freeM(g, p) < 0) return;
      const cs = g.p[p].deck.filter(x => named(x, 'Small Piece Golem')); if (!cs.length) return; ss(g, p, cs[0], 'atk', { negate: true }); shuffleDeck(g, p); } }] },

  'Mei-Kou, Master of Barriers': { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Tribute: destroy a Continuous Spell/Trap',
    cond: g => stOnField(g).some(x => faceUp(x) && D(x).sub === 'Continuous'),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Mei-Kou, Master of Barriers.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Continuous Spell or Trap?', stOnField(g).filter(x => faceUp(x) && D(x).sub === 'Continuous'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },

  // A Counter Trap that leaves the field after its chain link (by rule) has resolved; one seen negated on the chain doesn't count
  'Meltiel, Sage of the Sky': { effs: [{ type: 'trig', mand: true, label: 'Gain 1000 LP',
    on: (g, ev, c) => {
      const W = c.flags.f41ct || (c.flags.f41ct = {});
      for (const L2 of [...g.chain, g.resolvingL]) if (L2 && L2.cardAct && isTrap(L2.c) && D(L2.c).sub === 'Counter') W[L2.c.u] = L2;
      if (!(ev.type === 'move' && isTrap(ev.c) && D(ev.c).sub === 'Counter' && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule')) return false;
      const L2 = W[ev.c.u]; delete W[ev.c.u]; return !(L2 && L2.negated); },
    res: function* (g, c, p) { gain(g, p, 1000); if (!sanctuary(g) || !fieldOf2(g, opp(p)).length) return;
      const [x] = yield* pick(g, p, 'Destroy which card your opponent controls?', fieldOf2(g, opp(p)), 1, 1, 'bad'); if (x) destroy(g, [x], { by: p }); } }] },

  'Memory Crusher': { effs: [{ type: 'trig', mand: true, label: 'Damage for their Extra Deck',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.direct && ev.src === c && ev.p !== c.ctrl,
    res: function* (g, c, p) { const n = 100 * g.p[opp(p)].extra.length; if (n) damage(g, opp(p), n, { src: c, srcP: p }); } }] },

  // The equipped monster's own effects stop while it is an Equip Card (flags.negated). The ③ replacement is always taken.
  'Mermaid Archer': { self: {
      atk: (g, c) => archerEq(g, c) ? 800 : 0,
      replaceDestroy: (g, c) => { const eq = archerEq(g, c); if (!eq) return false; move(g, eq, 'gy', { reason: 'effect', destroyed: true }); log(g, `${D(eq).n} was destroyed instead of Mermaid Archer.`); return true; } },
    effs: [{ type: 'ign', opt: true, label: 'Equip a Level 3 or lower monster',
      cond: (g, c, p) => !archerEq(g, c) && freeST(g, p) >= 0 && monsOf(g, p).some(m => m !== c && faceUp(m) && lv(m) <= 3 && D(m).k !== 'token'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip which face-up Level 3 or lower monster?', monsOf(g, p).filter(m => m !== c && faceUp(m) && lv(m) <= 3 && D(m).k !== 'token'), 1, 1, 'cost'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || t.zone !== 'm' || !onField(c) || !faceUp(c) || archerEq(g, c) || freeST(g, p) < 0) return;
        move(g, t, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p }); t.equipTo = c.u; t.flags.f41arch = true; t.flags.negated = true; g.seq++;
        log(g, `${D(t).n} was equipped to Mermaid Archer.`); } }] },

  // Port of classic-4.js. PARTIAL: Flip Summons aren't blocked (ENGINE: Flip Summon isn't a forbid action).
  'Mesmeric Control': { effs: [{ type: 'act',
    res: function* (g, c, p) { const o = opp(p); addRule(g, (g2, a) => a.type === 'pos' && a.c && a.c.ctrl === o, { startOf: p }); log(g, `${PN(g, o)} can't change battle positions during the next turn.`); } }] },

  // Tributed face-up for the Tribute Summon of a DARK monster: 3 Metabo Tokens for its owner (even from the banished pile)
  'Metabo Globster': { effs: [{ type: 'trig', loc: 'any', mand: true, tags: { ss: 1 }, label: 'Summon 3 Metabo Tokens',
    on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.reason === 'tribute') c.f41up = !!(ev.snap && ev.snap.faceUp);
      return ev.type === 'summon' && ev.how === 'tribute' && (ev.tribs || []).includes(c) && !!c.f41up && attr(ev.cs[0]) === 'DARK'; },
    res: function* (g, c, p) { c.f41up = false; const n = Math.min(3, nFreeM(g, p)); if (n) tokens(g, p, { n: 'Metabo Token', a: 'DARK', r: 'Fiend', lv: 1, atk: 0, def: 0 }, n, 'def', { noTribute: true }); } }] },

  // PARTIAL: "instead of the normal draw" happens after the draw: the drawn card goes back on top of the Deck
  'Meteor Flare': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[opp(p)].lp > 3000 && g.p[p].hand.filter(x => x !== c).length >= 2,
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Send 2 cards from your hand to the GY', g.p[p].hand.filter(x => x !== c), 2, 2, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${xs.map(name).join(' and ')} to the GY.`); },
    res: function* (g, c, p) { damage(g, opp(p), 2000, { src: c, srcP: p }); } },
    { type: 'trig', loc: 'gy', label: 'Add Meteor Flare instead of drawing',
      on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && ev.phase === 'draw' && g.tp === c.owner && ev.c.owner === c.owner && ev.turn === g.turnNo,
      res: function* (g, c, p, L2) { if (c.zone !== 'gy') return; const x = L2.ev && L2.ev.c; if (x && x.zone === 'hand') move(g, x, 'deckTop', { reason: 'effect' });
        move(g, c, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added Meteor Flare to the hand instead of drawing.`); } }] },

  'Minefieldriller': { effs: [{ type: 'trig', loc: 'any', when: true, label: 'Add a Field Spell from the GY',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.faceUp && ev.prevCtrl === c.owner && ['hand', 'gy', 'ban'].includes(ev.to),
    cond: (g, c, p) => g.p[p].gy.some(x => isSpell(x) && D(x).sub === 'Field'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Field Spell to your hand?', g.p[p].gy.filter(x => isSpell(x) && D(x).sub === 'Field'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} added ${D(t).n} to the hand.`); } } }] },

  // ENGINE: Levels can only be set, not changed by a lasting effect, so the target's Level is set one lower and put back when this card leaves
  'Miniaturize': { cont: { atk: (g, src, m) => m.u === src.flags.f41min ? -1000 : 0 },
    effs: [{ type: 'act',
      cond: g => fieldMons(g).some(m => faceUp(m) && baseAtk(m) > 1000 && lv(m) > 0),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which monster?', fieldMons(g).filter(m => faceUp(m) && baseAtk(m) > 1000 && lv(m) > 0), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c)) { if (onField(c)) move(g, c, 'gy', { reason: 'rule' }); return; }
        c.flags.f41min = t.u; t.flags.lv = Math.max(1, lv(t) - 1); t.flags.f41minLv = c.u; log(g, `${name(t)} lost 1 Level and 1000 ATK.`); } },
      { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
        if (ev.type !== 'move' || !ev.wasField) return false;
        if (ev.c === c) { for (const m of fieldMons(g)) if (m.flags.f41minLv === c.u) { m.flags.f41minLv = null; m.flags.lv = null; } }
        else if (onField(c) && c.flags.f41min === ev.c.u) { c.flags.f41min = null; g.laterDestroy.push(c); }
        return false; } }] },

  'Minoan Centaur': { effs: [lockInstall, { type: 'ign', tags: { ss: 1 }, label: 'Tribute: summon 2 Beast-Warrior Normal Monsters',
    cond: (g, c, p) => nFreeM(g, p) + 1 >= 2 && g.p[p].deck.filter(x => D(x).k === 'normal' && race(x) === 'Beast-Warrior' && lv(x) === 4).length >= 2,
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Minoan Centaur.`); },
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => D(x).k === 'normal' && race(x) === 'Beast-Warrior' && lv(x) === 4 && canSS(g, p, x)); const n = Math.min(2, cs.length, nFreeM(g, p)); if (!n) return;
      const xs = yield* pick(g, p, `Special Summon ${n} Level 4 Beast-Warrior Normal Monster${n > 1 ? 's' : ''}`, cs, n, n, 'good'); for (const x of xs) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },

  'Miraculous Descent': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].ban.some(x => isMon(x) && race(x) === 'Fairy' && canSS(g, p, x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which banished Fairy?', g.p[p].ban.filter(x => isMon(x) && race(x) === 'Fairy' && canSS(g, p, x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'ban' || !onField(c)) { if (onField(c)) move(g, c, 'gy', { reason: 'rule' }); return; }
      if (ss(g, p, t, 'atk')) link(g, c, t); else move(g, c, 'gy', { reason: 'rule' }); } }] },

  'Miraculous Rebirth': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => { if (g.chain.length < 3 || freeM(g, p) < 0) return false; const ns = g.chain.map(x => name(x.c)); if (new Set(ns).size !== ns.length) return false;
      return allCards(g, 'gy').some(x => canSS(g, p, x)); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which monster from either GY?', allCards(g, 'gy').filter(x => canSS(g, p, x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },

  'Misfortune': { effs: [{ type: 'act',
    cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    after: (g, c, p) => { addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.ctrl === p && !has(g2, a.c, 'unaffectedSpells'), { end: g.turnNo }); log(g, `${PN(g, p)}'s monsters can't attack this turn.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which face-up monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.ctrl !== p) { const n = Math.floor(baseAtk(t) / 2); if (n) damage(g, opp(p), n, { src: c, srcP: p }); } } }] },

  'Moja': { effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Add a Level 4 Beast from the GY',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
    cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && race(x) === 'Beast' && lv(x) === 4),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Level 4 Beast to your hand?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Beast' && lv(x) === 4), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} added ${D(t).n} to the hand.`); } } }] },

  // Once per turn the battle destruction is replaced; at the end of that Damage Step the equipped monster gains 300 ATK
  // (kept on this card, so it goes away if this card is unequipped)
  'Molting Escape': {
    cont: { atk: (g, src, m) => src.equipTo === m.u ? 300 * (src.flags.f41n || 0) : 0,
      replaceDestroy: (g, src, m, o) => { if (!o.battle || src.equipTo !== m.u || src.flags.f41turn === g.turnNo) return false;
        src.flags.f41turn = g.turnNo; src.flags.f41pend = true; log(g, `${name(m)} wasn't destroyed (Molting Escape).`); return true; } },
    effs: [equipAct(m => race(m) === 'Reptile', 'Equip to which face-up Reptile monster?'),
      { type: 'trig', loc: 'st', mand: true, label: 'Gain 300 ATK',
        on: (g, ev, c) => ev.type === 'dsEnd' && !!c.flags.f41pend,
        res: function* (g, c) { c.flags.f41pend = false; if (!onField(c) || !equippedTo(g, c)) return; c.flags.f41n = (c.flags.f41n || 0) + 1; log(g, `${name(equippedTo(g, c))} gained 300 ATK.`); } }] },

  'Montage Dragon': { self: { atk: (g, c) => c.flags.f41mont || 0 },
    proc: { label: 'Special Summon (send 3 monsters from your hand)',
      cond: (g, c, p) => g.p[p].hand.filter(x => x !== c && isMon(x)).length >= 3,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Send which 3 monsters from your hand to the GY?', g.p[p].hand.filter(x => x !== c && isMon(x)), 3, 3, 'cost');
        const n = xs.reduce((s, x) => s + num(D(x).lv), 0); for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p, group: grp });
        log(g, `${PN(g, p)} sent ${xs.map(name).join(', ')} to the GY.`); c.flags.f41mont = n * 300; c.flags.f41proc = true; } },
    effs: [lockInstall] },

  'Moon Dragon Quilla': { noSynchro: true, proc: synProc(t => named(t, 'Supay')),
    effs: [{ type: 'trig', mand: true, label: 'Gain LP: half the attacker\'s ATK',
      on: (g, ev, c) => ev.type === 'attack' && ev.t === c,
      res: function* (g, c, p, L2) { const a = L2.ev && L2.ev.a; if (a && onField(a) && faceUp(a)) gain(g, p, Math.floor(atk(g, a) / 2)); } },
    { type: 'trig', loc: 'any', mand: true, tags: { ss: 1 }, label: 'Special Summon Sun Dragon Inti',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField,
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, 'Sun Dragon Inti') && canSS(g, p, x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Sun Dragon Inti?', g.p[p].gy.filter(x => named(x, 'Sun Dragon Inti') && canSS(g, p, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },

  'Mormolith': { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Tribute an EARTH monster: destroy monsters',
    cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && attr(m) === 'EARTH'),
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Tribute which face-up EARTH monster?', monsOf(g, p).filter(m => faceUp(m) && attr(m) === 'EARTH'), 1, 1, 'cost');
      L2.data.n = atk(g, x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n} (${L2.data.n} ATK).`); },
    res: function* (g, c, p, L2) { const xs = fieldMons(g).filter(m => faceUp(m) && def(g, m) <= L2.data.n); if (xs.length) destroy(g, xs, { by: p }); } }] },

  // Port of full-25.js's Goat "Morphing Jar #2". This card stays on the field and does not count (Edison rulings). Tokens vanish, Fusions and Synchros go to the Extra Deck, and neither counts.
  'Morphing Jar 2': { effs: [flip('Shuffle every monster into the Deck', {
    res: function* (g, c, p) {
      const n = [0, 0]; const grp = g.group;
      for (const m of fieldMons(g)) { if (m === c) continue; const tok = D(m).k === 'token', ex = isExtraD(D(m)); const o = m.owner; move(g, m, 'deck', { reason: 'effect', by: p, group: grp }); if (!tok && !ex) n[o]++; }
      for (const q of [0, 1]) shuffleDeck(g, q);
      log(g, 'Every monster on the field was shuffled into the Deck.');
      for (const q of [g.tp, opp(g.tp)]) {
        const deck = g.p[q].deck, out = []; let k = 0;
        while (k < n[q] && out.length < deck.length) { const x = deck[deck.length - 1 - out.length]; out.push(x); if (isMon(x)) k++; }
        if (out.length) log(g, `${PN(g, q)} excavated ${out.map(x => D(x).n).join(', ')}.`);
        for (const x of out) { if (x.zone !== 'deck') continue; if (isMon(x) && !isExtraD(D(x)) && D(x).k !== 'ritual' && lv(x) <= 4 && freeM(g, q) >= 0 && canSS(g, q, x)) ss(g, q, x, 'set'); }
        for (const x of out) if (x.zone === 'deck') move(g, x, 'gy', { reason: 'effect', by: p, group: g.group });
      } } })] },

  // Targets the attacker and the attack target (ruling); the position changes only if the attacker is still there
  'Morphtransition': { effs: [{ type: 'act',
    cond: (g, c, p) => !!(g.aw && g.aw.t && g.aw.t.ctrl === p && faceUp(g.aw.t) && /^Morphtronic/.test(name(g.aw.t)) && g.aw.a.ctrl !== p),
    target: function* (g, c, p, L2) { L2.t = [g.aw.a, g.aw.t]; },
    res: function* (g, c, p, L2) { const [a, t] = L2.t; negateAttack(g); if (a && onField(a) && t && onField(t) && t.ctrl === p) setPos(g, t, t.pos === 'atk' ? 'def' : 'atk'); } }] },

  'Mosaic Manticore': { effs: [{ type: 'trig', mand: true, tags: { ss: 1 }, label: 'Special Summon its Tributes',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.summonType === 'tribute' && c.turnIn !== g.turnNo && !c.flags.f41mm && (c.tributes || []).length > 0,
    res: function* (g, c, p) { c.flags.f41mm = true;
      let cs = allCards(g, 'gy').filter(x => (c.tributes || []).includes(x.u) && canSS(g, p, x)); const n = Math.min(cs.length, nFreeM(g, p)); if (!n) return;
      if (cs.length > n) cs = yield* pick(g, p, `Special Summon which ${n === 1 ? 'monster' : n + ' monsters'}?`, cs, n, n, 'good');
      for (const x of cs) if (ss(g, p, x, 'atk', { negate: true })) x.flags.cantAttack = true; } }] },

  // "Only Insect monsters in your GY": an empty GY counts as none that aren't
  'Mother Spider': { proc: { label: 'Special Summon (send 2 of their Defense Position monsters)',
    cond: (g, c, p) => g.p[p].gy.every(x => !isMon(x) || race(x) === 'Insect') && monsOf(g, opp(p)).filter(m => faceUp(m) && m.pos === 'def').length >= 2,
    cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Send which 2 face-up Defense Position monsters to the GY?', monsOf(g, opp(p)).filter(m => faceUp(m) && m.pos === 'def'), 2, 2, 'bad');
      for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} sent ${xs.map(x => D(x).n).join(' and ')} to the GY.`); } } },

  // Port of classic-4.js
  'Multiply': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && name(m) === 'Kuriboh'),
    cost: function* (g, c, p) { const [m] = yield* pick(g, p, 'Tribute which Kuriboh?', monsOf(g, p).filter(m => faceUp(m) && name(m) === 'Kuriboh'), 1, 1, 'cost'); if (m) { move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Kuriboh.`); } },
    res: function* (g, c, p) { const n = nFreeM(g, p); if (n) tokens(g, p, { n: 'Kuriboh Token', a: 'DARK', r: 'Fiend', lv: 1, atk: 300, def: 200 }, n, 'def', { noTribute: true }); } }] },

  // Port of full-25.js's Goat "Mushroom Man #2": LP lost, not damage
  'Mushroom Man 2': { effs: [
    { type: 'trig', mand: true, label: 'Lose 300 LP', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; g.p[p].lp -= 300; log(g, `${PN(g, p)} lost 300 LP.`); if (g.p[p].lp <= 0) { g.p[p].lp = 0; winDuel(g, opp(p), `${PN(g, p)} hit 0 LP`); } } },
    { type: 'trig', label: 'Pay 500 LP: give control to the opponent', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      cond: (g, c, p) => g.p[p].lp > 500 && freeM(g, opp(p)) >= 0,
      cost: function* (g, c, p) { pay(g, p, 500); },
      res: function* (g, c, p) { if (onField(c) && c.ctrl === p) takeControl(g, opp(p), c, false); } }] },

  // ENGINE: attack redirect. Closest version: Mindmaster's attack is negated and the monster taken can then declare its own
  // attack this Battle Phase; it goes back at the end of the Battle Phase (or the End Phase).
  // PARTIAL: the monster taken isn't stopped from attacking directly.
  'Mutant Mindmaster': { effs: [{ type: 'trig', when: true, label: 'Take an Attack Position monster to attack with',
    on: (g, ev, c) => ev.type === 'attack' && ev.a === c,
    cond: (g, c, p) => freeM(g, p) >= 0 && monsOf(g, opp(p)).some(m => faceUp(m) && m.pos === 'atk' && !has(g, m, 'cantAttack')),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which Attack Position monster?', monsOf(g, opp(p)).filter(m => faceUp(m) && m.pos === 'atk' && !has(g, m, 'cantAttack')), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || t.pos !== 'atk' || t.ctrl === p) return;
      if (takeControl(g, p, t, true)) { t.flags.f41mind = t.owner; t.attacks = 0;
        // PARTIAL: "It can't attack your opponent directly": with no monster to attack it can't attack at all
        addRule(g, (g2, a) => a.type === 'attack' && a.c === t && t.flags.f41mind != null && !monsOf(g2, opp(t.ctrl)).length, { end: g.turnNo }); if (g.aw && g.aw.a === c) { negateAttack(g); log(g, `${name(t)} attacks instead of Mutant Mindmaster.`); } } } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { if (ev.type === 'phase' && ev.ph === 'bpEnd') for (const m of fieldMons(g)) if (m.flags.f41mind != null) { const o = m.flags.f41mind; m.flags.f41mind = null; giveBack(g, m, o); } return false; } }] },

  'Mythical Beast Cerberus': { self: { atk: (g, c) => 500 * ctr(c, 'spell') },
    effs: [{ type: 'trig', res: noop, on: (g, ev, c) => {
      const n = spellsResolved(g, ev, c); if (n) { addCtr(g, c, 'spell', n); log(g, `Mythical Beast Cerberus got ${n > 1 ? n + ' Spell Counters' : 'a Spell Counter'} (${ctr(c, 'spell')}).`); }
      if (ev.type === 'afterCalc' && (ev.a === c || ev.t === c)) c.flags.f41bat = g.turnNo;
      if (ev.type === 'phase' && ev.ph === 'bpEnd' && c.flags.f41bat === g.turnNo) { c.flags.f41bat = null; if (ctr(c, 'spell')) { addCtr(g, c, 'spell', -ctr(c, 'spell')); log(g, 'Mythical Beast Cerberus lost its Spell Counters.'); } }
      return false; } }] },

  'Nanobreaker': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the Level 3 or lower monster',
    on: (g, ev, c) => ev.type === 'dsStart' && ev.a === c && !!ev.t && faceUp(ev.t) && lv(ev.t) <= 3,
    res: function* (g, c, p, L2) { const t = L2.ev.t; if (t && onField(t) && faceUp(t) && lv(t) <= 3) destroy(g, [t], { by: p }); } }] },

  'Natural Disaster': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: '500 damage',
      on: (g, ev, c) => ev.type === 'move' && ev.destroyed && !ev.battle && ev.wasField && ev.to === 'gy' && ev.prevCtrl === opp(c.ctrl) && !!g.resolvingL && isMon(g.resolvingL.c) && /^Cloudian/.test(D(g.resolvingL.c).n),
      res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },

  // ENGINE: Synchro Summons read Tuners from the card data; the engine's own Synchro check ignores Natural Tune (scripts that
  // check c.flags.f41tuner, like this file's, see it). PARTIAL until the engine has a "treated as a Tuner" flag.
  'Natural Tune': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && D(m).k === 'normal' && lv(m) <= 4),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Normal Monster becomes a Tuner?', monsOf(g, p).filter(m => faceUp(m) && D(m).k === 'normal' && lv(m) <= 4), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { t.flags.f41tuner = true; log(g, `${name(t)} is treated as a Tuner.`); } } }] },

  // ENGINE: no hook to reflect effect damage. Closest version: while this card is in the GY on the turn it resolved, effect damage
  // the opponent's effects would deal its activator is dealt to the opponent instead. PARTIAL: it stops if this card leaves the GY.
  'Nature\'s Reflection': {
    cont: { loc: 'gy', dmg: (g, src, p, n, o) => {
      if (o.battle || n <= 0 || !(g.f41nr || []).some(e => e.p === p && e.turn === g.turnNo)) return undefined;
      const by = o.srcP != null ? o.srcP : o.src && onField(o.src) ? o.src.ctrl : o.src ? o.src.owner : g.resolvingL ? g.resolvingL.p : null;
      if (by !== opp(p)) return undefined;
      log(g, 'Nature\'s Reflection turned the damage back.'); damage(g, opp(p), n, { src: o.src, srcP: p }); return 0; } },
    effs: [{ type: 'act', res: function* (g, c, p) { (g.f41nr || (g.f41nr = [])).push({ p, turn: g.turnNo }); log(g, `Effect damage to ${PN(g, p)} from the opponent's effects goes back to them this turn.`); } }] },

  'Necroface': { self: { atk: (g, c) => 100 * (c.flags.f41nf || 0) },
    effs: [{ type: 'trig', mand: true, label: 'Shuffle all banished cards into the Deck',
      on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
      res: function* (g, c, p) { let n = 0; const grp = g.group;
        for (const q of [0, 1]) for (const x of g.p[q].ban.slice()) { if (isExtraD(D(x))) move(g, x, 'extra', { reason: 'effect', by: p, group: grp }); else { move(g, x, 'deck', { reason: 'effect', by: p, group: grp }); n++; } }
        log(g, `${n} banished card${n === 1 ? ' was' : 's were'} shuffled into the Deck.`); if (onField(c) && faceUp(c)) c.flags.f41nf = (c.flags.f41nf || 0) + n; } },
    { type: 'trig', loc: 'any', mand: true, label: 'Each player banishes the top 5 cards of the Deck',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'ban',
      res: function* (g, c, p) { for (const q of [0, 1]) { const d = g.p[q].deck; const xs = d.slice(-5); for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: p }); if (xs.length) log(g, `${PN(g, q)} banished the top ${xs.length} card${xs.length > 1 ? 's' : ''} of the Deck.`); } } }] },

  'Needlebug Nest': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 5, res: function* (g, c, p) { mill(g, p, 5); } }] },

  // Its conditions are only checked to activate it (ruling)
  'Nega-Ton Corepanel': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p, x) => !!x.top && isMon(x.top.c) && x.top.eff.type !== 'act' && monsOf(g, p).some(m => faceUp(m) && /^Koa'ki Meiru/.test(name(m))) && g.p[p].gy.some(y => named(y, 'Iron Core of Koa\'ki Meiru')),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; if (!T) return; T.negBy = p; negate(g, T, true); } }] },

  // Port of classic-5.js, targeting the attacker
  'Negate Attack': { effs: [{ type: 'act', cond: (g, c, p) => !!(g.aw && g.aw.a.ctrl !== p),
    target: function* (g, c, p, L2) { L2.t = [g.aw.a]; },
    res: function* (g) { endBattle(g); } }] },

  'Neos Force': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 800 : 0 },
    effs: [equipAct(m => named(m, 'Elemental HERO Neos'), 'Equip to which Elemental HERO Neos?'),
      { type: 'trig', loc: 'st', mand: true, label: 'Damage: the destroyed monster\'s original ATK',
        on: (g, ev, c) => { const m = equippedTo(g, c); return !!m && battleKill(ev, m); },
        res: function* (g, c, p, L2) { const x = L2.ev.c; if (x && x.zone === 'gy') { const n = baseAtk(x); if (n) damage(g, opp(p), n, { src: c, srcP: p }); } } },
      { type: 'trig', loc: 'st', mand: true, label: 'Shuffle into the Deck',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end',
        res: function* (g, c, p) { if (onField(c)) { move(g, c, 'deck', { reason: 'effect', by: p }); log(g, 'Neos Force was shuffled into the Deck.'); } } }] },

  'Neos Wiseman': { self: { noEffectDestroy: true },
    proc: { label: 'Special Summon (send Elemental HERO Neos and Yubel)',
      cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && named(m, 'Elemental HERO Neos')) && monsOf(g, p).some(m => faceUp(m) && named(m, 'Yubel')),
      cost: function* (g, c, p, grp) {
        const [a] = yield* pick(g, p, 'Send which Elemental HERO Neos?', monsOf(g, p).filter(m => faceUp(m) && named(m, 'Elemental HERO Neos')), 1, 1, 'cost');
        const [b] = yield* pick(g, p, 'Send which Yubel?', monsOf(g, p).filter(m => faceUp(m) && named(m, 'Yubel')), 1, 1, 'cost');
        for (const x of [a, b]) if (x) move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} sent Elemental HERO Neos and Yubel to the GY.`); c.flags.f41proc = true; } },
    effs: [lockInstall,
      { type: 'trig', mand: true, label: 'Damage and LP from the monster it battled',
        on: (g, ev, c) => ev.type === 'dsEnd' && !!ev.t && (ev.a === c || ev.t === c),
        res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; if (!o) return;
          let A, Dv;
          if (onField(o) && o.zone === 'm') { if (!faceUp(o) || o.ctrl === p) return; A = atk(g, o); Dv = def(g, o); }
          else if (o.zone === 'gy') { A = baseAtk(o); Dv = num(D(o).def); } else return;
          if (A) damage(g, opp(p), A, { src: c, srcP: p }); if (Dv) gain(g, p, Dv); } }] },

  // "The same name": Neo-Spacian Marine Dolphin and Twinkle Moss also carry the names of Aqua Dolphin and Glow Moss
  'NEX': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && /^Neo-Spacian/.test(name(m)) && nexTargets(g, p, name(m)).length),
    res: function* (g, c, p) { const cs = monsOf(g, p).filter(m => faceUp(m) && /^Neo-Spacian/.test(name(m)) && nexTargets(g, p, name(m)).length); if (!cs.length) return;
      const [m] = yield* pick(g, p, 'Send which Neo-Spacian monster to the GY?', cs, 1, 1, 'cost'); const nm = name(m);
      move(g, m, 'gy', { reason: 'effect', by: p }); log(g, `${PN(g, p)} sent ${nm} to the GY.`);
      const fs = nexTargets(g, p, nm); if (!fs.length || freeM(g, p) < 0) return;
      const [f] = yield* pick(g, p, 'Special Summon which monster from your Extra Deck?', fs, 1, 1, 'good');
      if (f) { g.f41nex = true; try { ss(g, p, f, 'atk'); } finally { g.f41nex = false; } } } }] },

  // Targets a face-up monster you control; a Token can't be chosen (none in the Deck)
  'Next to be Lost': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && D(m).k !== 'token'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which face-up monster?', monsOf(g, p).filter(m => faceUp(m) && D(m).k !== 'token'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const nm = name(t);
      yield* search(g, p, x => name(x) === nm, `Send which ${nm} from your Deck to the GY?`, 'gy'); } }] },

  // An Assault Mode Activate Set while this card is face-up can be activated that turn (its "Set this turn" mark is moved back).
  // PARTIAL: the mark stays moved if this card then leaves the field that turn.
  'Night Wing Sorceress': { effs: [{ type: 'trig', res: noop, on: (g, ev, c) => {
    for (const x of g.p[c.ctrl].st) if (x && x.pos === 'set' && named(x, 'Assault Mode Activate') && x.turnIn === g.turnNo) x.turnIn = g.turnNo - 1;
    return false; } }] },

  'Night\'s End Sorcerer': { effs: [{ type: 'trig', when: true, label: 'Banish up to 2 cards from their GY',
    on: (g, ev, c) => evSummoned(ev, c, ['special', 'synchro', 'fusion', 'ritual']) && c.pos !== 'set',
    cond: (g, c, p) => g.p[opp(p)].gy.length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Banish up to 2 cards from their GY', g.p[opp(p)].gy, 1, 2, 'bad'); },
    res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: p }); if (xs.length) log(g, `${PN(g, p)} banished ${xs.map(x => D(x).n).join(' and ')}.`); } }] },

  // A Normal Spell that stays face-up until the End Phase of the opponent's second turn; no monster can attack meanwhile
  'Nightmare\'s Steelcage': { cont: { forbid: (g, src, a) => a.type === 'attack' && !!src.flags.f41cage },
    effs: [{ type: 'act', res: function* (g, c, p, L2) { if (!onField(c)) return; L2.keep = true; c.flags.f41cage = 1; log(g, 'No monsters can attack.'); } },
      { type: 'trig', loc: 'st', mand: true, label: 'Sent to the GY',
        on: (g, ev, c) => { if (!(ev.type === 'phase' && ev.ph === 'end' && ev.tp !== c.ctrl && c.flags.f41cage)) return false; c.flags.f41n = (c.flags.f41n || 0) + 1; return c.flags.f41n >= 2; },
        res: function* (g, c) { if (onField(c)) { move(g, c, 'gy', { reason: 'rule' }); log(g, 'Nightmare\'s Steelcage was sent to the GY.'); } } }] },

  'Nimble Musasabi': { effs: [
    { type: 'trig', faceDownOk: true, res: noop, on: (g, ev, c) => { c.flags.noTribute = true; return false; } },
    { type: 'trig', loc: 'gy', mand: true, label: '500 damage',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
      res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p });
        const cs = g.p[p].deck.filter(x => named(x, 'Nimble Musasabi') && canSS(g, opp(p), x)); const n = Math.min(2, cs.length, nFreeM(g, opp(p)));
        if (!n || !(yield* yn(g, p, 'Special Summon Nimble Musasabi from your Deck to the opponent\'s field?'))) return;
        const xs = yield* pick(g, p, 'Special Summon how many Nimble Musasabi?', cs, 1, n, 'good'); for (const x of xs) ss(g, opp(p), x, 'atk'); shuffleDeck(g, p); } }] },

  'Nitro Synchron': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Draw 1 card',
    on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.reason === 'synchro' && ev.to === 'gy') c.f41syn = ev.group;
      return ev.type === 'summon' && ev.how === 'synchro' && c.f41syn === ev.group && ev.cs.some(x => /Nitro/.test(D(x).n)); },
    res: function* (g, c, p) { c.f41syn = null; draw(g, p, 1); } }] },

  'No Entry!!': { effs: [{ type: 'act', cond: g => fieldMons(g).some(m => m.pos === 'atk'),
    res: function* (g) { for (const m of fieldMons(g).filter(m => m.pos === 'atk')) setPos(g, m, 'def'); } }] },

  'Noisy Gnat': { effs: [{ type: 'ign', loc: 'hand', label: 'Send to the GY: a monster gains 1 Level',
    cond: g => fieldMons(g).some(faceUp),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent Noisy Gnat to the GY.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Increase which monster\'s Level?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { t.flags.lv = lv(t) + 1; t.flags.lvUntil = true; log(g, `${name(t)} became Level ${t.flags.lv}.`); } } }] },
});

/* ----- helpers used above (hoisted) ----- */
function fieldOf2(g, p) { return [...monsOf(g, p), ...stOf(g, p)]; }
function archerEq(g, c) { return stOf(g, c.ctrl).find(x => x.equipTo === c.u && x.flags.f41arch) || null; }
function nexTargets(g, p, nm) {
  return g.p[p].extra.filter(f => { if (D(f).n === nm) return true; const m = (D(f).tx || '').match(/also treated as "([^"]+)"/); return !!m && m[1] === nm; });
}
})();
