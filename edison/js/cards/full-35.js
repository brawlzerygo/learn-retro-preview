/* Full pool batch 35: Advanced Ritual Art to Breath of Light (build/batches/full/full-35.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, takeControl, negate, addMod,
  equip, link, addCtr, ctr, negateAttack, endBattle, addRule, tokens, name, D, isMon, isST, isSpell, isTrap, isExtraD, onField,
  faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck,
  log, PN, has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned, fromFieldToGY, battleKill, emit, forbid, negd, num,
  isGemini } = L;
const atk = L.atk, def = L.def;
const shown = (g, c) => (c.zone === 'm' || c.zone === 'st') && c.pos === 'set' ? 'a face-down monster' : name(c);

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
const SPECIAL = ['special', 'synchro', 'fusion', 'ritual'];
// Normal Monsters: a Gemini is one while face-up on the field (until Gemini Summoned) or in the GY
const normalNow = x => isMon(x) && (D(x).k === 'normal' || (isGemini(x) && (x.zone === 'gy' || (onField(x) && !x.flags.gemini))));
const toAtk = (g, m) => {
  if (!onField(m) || m.zone !== 'm' || m.pos === 'atk') return;
  const was = m.pos; m.pos = 'atk'; g.seq++;
  if (was === 'set') { log(g, `The face-down monster was ${name(m)}. It is now in Attack Position.`); emit(g, { type: 'flip', c: m, p: m.ctrl }); }
  else log(g, `${name(m)} was changed to Attack Position.`);
  emit(g, { type: 'pos', c: m, p: m.ctrl, from: was });
};
const toDef = (g, m) => { if (!onField(m) || m.zone !== 'm' || m.pos !== 'atk') return; m.pos = 'def'; g.seq++; log(g, `${name(m)} was changed to Defense Position.`); emit(g, { type: 'pos', c: m, p: m.ctrl, from: 'atk' }); };
// the other monster in the battle this card is in, during the Damage Step
const foe = (g, c) => { if (!g.inDS || !g.battle) return null; const b = g.battle; return b.a === c ? b.t : b.t === c ? b.a : null; };
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) equip(g, c, t); } });
// "When the equipped monster destroys an opponent's monster by battle and sends it to the GY"
const eqKill = (ev, c) => ev.type === 'move' && ev.battle && ev.killer && c.equipTo && ev.killer.u === c.equipTo && ev.to === 'gy' && ev.c.zone === 'gy' && ev.prevCtrl !== c.ctrl;
const randomDiscard = (g, q) => { const h = g.p[q].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, q)} discarded ${name(x)} at random.`); };
const isXSaber = x => /X-Saber/.test(name(x));
const isSixSam = x => isMon(x) && /Six Samurai/.test(name(x));
const isFL = x => isMon(x) && /^Fortune Lady/.test(name(x));
const isBoss = x => isMon(x) && (/^B\.E\.S\./.test(D(x).n) || D(x).n === 'Big Core');
const spellHolder = (x, self) => faceUp(x) && x !== self && /Spell Counter/.test(D(x).ps || D(x).tx || '') && !named(x, 'Alchemist of Black Spells');
// a discard by the hand size limit (End Phase, empty chain, the turn player left with 6 or more cards) is the game rule
const ruleDiscard = (g, ev) => g.phase === 'end' && !g.chain.length && ev.c.owner === g.tp && g.p[g.tp].hand.length >= 6;

/* Advanced Ritual Art: Normal Monsters in the Deck whose Levels add up exactly (grouped by name so the list stays short) */
function artCombos(g, p, rm, limit = 12) {
  const L2 = lv(rm), groups = new Map();
  for (const x of g.p[p].deck) if (isMon(x) && D(x).k === 'normal' && lv(x) > 0) { const k = D(x).n; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
  const gs = [...groups.values()], out = [];
  const rec = (i, sum, cur) => {
    if (out.length >= limit) return;
    if (sum === L2) { if (cur.length) out.push(cur.slice()); return; }
    if (i >= gs.length || sum > L2) return;
    const l = lv(gs[i][0]);
    for (let k = Math.min(gs[i].length, Math.floor((L2 - sum) / l)); k >= 0; k--) { cur.push(...gs[i].slice(0, k)); rec(i + 1, sum + k * l, cur); cur.splice(cur.length - k, k); }
  };
  rec(0, 0, []); return out;
}
const artRituals = (g, p) => g.p[p].hand.filter(x => isMon(x) && D(x).k === 'ritual' && !forbid(g, { type: 'ss', c: x, p, how: 'ritual' }) && artCombos(g, p, x, 1).length);

/* Avalanching Aussa / Blazing Hiita: Tribute 1 monster of the Attribute (cost) to Special Summon 1 from the hand. The monster
 is destroyed when the summoner leaves the field face-up (not if she was face-down, or it was flipped face-down). */
const summoner = (A, self) => ({ effs: [
  { type: 'ign', opt: true, tags: { ss: 1 }, label: `Tribute a ${A}: summon a ${A} from your hand`,
    cond: (g, c, p) => monsOf(g, p).some(x => x !== c && attr(x) === A) && g.p[p].hand.some(x => isMon(x) && attr(x) === A && !isExtraD(D(x)) && D(x).k !== 'ritual' && canSS(g, p, x)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, `Tribute which ${A} monster?`, monsOf(g, p).filter(x => x !== c && attr(x) === A), 1, 1, 'cost'); if (x) { const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); } },
    res: function* (g, c, p) {
      if (freeM(g, p) < 0) return; const xs = g.p[p].hand.filter(x => isMon(x) && attr(x) === A && !isExtraD(D(x)) && D(x).k !== 'ritual' && canSS(g, p, x)); if (!xs.length) return;
      const [x] = yield* pick(g, p, `Special Summon which ${A} monster from your hand?`, xs, 1, 1, 'good');
      if (x && ss(g, p, x, 'atk') && onField(c) && faceUp(c)) { (c.flags.f35kids || (c.flags.f35kids = [])).push(x.u); x.flags.f35par = c.u; } } },
  { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the summoned monster',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.faceUp && !!ev.snap.flags && !!(ev.snap.flags.f35kids || []).length,
    res: function* (g, c, p, L2) { const us = L2.ev.snap.flags.f35kids; destroy(g, fieldMons(g).filter(m => us.includes(m.u) && faceUp(m) && m.flags.f35par === c.u), { by: p, src: c }); } }] });

E.addScripts({
  /* ----- A ----- */
  // The Normal Monsters are sent from the Deck (not Tributed), so Ascending Soul doesn't see them.
  'Advanced Ritual Art': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && artRituals(g, p).length > 0,
    res: function* (g, c, p) {
      const rms = artRituals(g, p); if (!rms.length || freeM(g, p) < 0) return;
      const [rm] = yield* pick(g, p, 'Ritual Summon which monster?', rms, 1, 1, 'good'); if (!rm) return;
      const cs = artCombos(g, p, rm); if (!cs.length) return; let mats = cs[0];
      if (cs.length > 1) { const i = yield* choose(g, p, 'Send which Normal Monsters from your Deck?', cs.map(m => m.map(x => `${D(x).n} (Lv ${lv(x)})`).join(' + '))); mats = cs[i]; }
      const grp = g.group; for (const x of mats) move(g, x, 'gy', { reason: 'effect', by: p, group: grp });
      log(g, `${PN(g, p)} sent ${mats.map(x => D(x).n).join(', ')} from the Deck to the GY.`);
      ss(g, p, rm, 'atk', { how: 'ritual', group: grp }); shuffleDeck(g, p); } }] },
  // The 3000 damage when it leaves the field face-up is a continuous effect, run here as a mandatory trigger.
  'Aegis of Gaia': { effs: [{ type: 'act', res: function* (g, c, p) { gain(g, p, 3000); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Take 3000 damage',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && !!ev.snap && ev.snap.faceUp,
      res: function* (g, c, p, L2) { damage(g, L2.ev.prevCtrl, 3000, { src: c, srcP: L2.ev.prevCtrl }); } }] },
  // Read from the GY, where the card is once it resolved. PARTIAL: if every copy leaves the GY that turn, the protection stops.
  'Aegis of the Ocean Dragon Lord': {
    cont: { loc: 'gy', grant: (g, src, m, flag) => (flag === 'noBattleDestroy' || flag === 'noEffectDestroy') && !!g.f35ocean && g.f35ocean[m.ctrl] === g.turnNo && m.zone === 'm' && faceUp(m) && attr(m) === 'WATER' && lv(m) <= 3 },
    effs: [{ type: 'act', res: function* (g, c, p) { (g.f35ocean || (g.f35ocean = {}))[p] = g.turnNo; log(g, `${PN(g, p)}'s face-up Level 3 or lower WATER monsters can't be destroyed this turn.`); } }] },
  'Against the Wind': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && /^Blackwing/.test(D(x).n)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Blackwing from your GY to your hand?', g.p[p].gy.filter(x => isMon(x) && /^Blackwing/.test(D(x).n)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy') return; const A = baseAtk(t);
      if (A > 0 && !damage(g, p, A, { src: c, srcP: p })) return;   // ruling: no damage taken (Des Wombat), no card added
      if (t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} added ${D(t).n} to the hand.`); } } }] },
  // PARTIAL: "a card you can place a Spell Counter on" is read from the card's text (it mentions Spell Counters); no cap is checked.
  'Alchemist of Black Spells': { effs: [{ type: 'ign', opt: true, label: 'To Defense: place a Spell Counter',
    cond: (g, c, p) => c.pos === 'atk' && fieldOf(g, p).some(x => spellHolder(x, c)),
    res: function* (g, c, p) { if (!onField(c) || c.pos !== 'atk') return; toDef(g, c);
      const xs = fieldOf(g, p).filter(x => spellHolder(x, c)); if (!xs.length) return;
      const [x] = yield* pick(g, p, 'Place a Spell Counter on which card?', xs, 1, 1, 'good'); if (x && onField(x)) { addCtr(g, x, 'spell', 1); log(g, `${name(x)} got a Spell Counter.`); } } }] },
  // PARTIAL: "original ATK becomes 0" is a -original ATK modifier until the End Phase, so it stacks the same way with other changes.
  'Alchemy Cycle': { effs: [
    { type: 'act', cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && baseAtk(m) > 0),
      res: function* (g, c, p) { const ms = monsOf(g, p).filter(m => faceUp(m) && baseAtk(m) > 0); for (const m of ms) addMod(g, m, { atk: -baseAtk(m), end: true });
        c.f35cyc = { turn: g.turnNo, us: ms.map(m => m.u) }; if (ms.length) log(g, `The original ATK of ${PN(g, p)}'s face-up monsters became 0 until the End Phase.`); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Draw 1 card',
      on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && !!c.f35cyc && c.f35cyc.turn === g.turnNo && c.f35cyc.us.includes(ev.c.u),
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  // ENGINE: no forced attacks ("it must attack this turn, if able"); the monster is only changed to Attack Position.
  'All-Out Attacks': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Change it to Attack Position',
      on: (g, ev, c) => ev.type === 'summon' && SPECIAL.includes(ev.how),
      res: function* (g, c, p, L2) { for (const m of L2.ev.cs) if (onField(m) && m.zone === 'm') { toAtk(g, m); m.flags.f35mustAtk = g.turnNo; } } }] },
  'Ally of Justice Garadholg': { self: { atk: (g, c) => { const o = foe(g, c); return o && attr(o) === 'LIGHT' ? 200 : 0; } } },
  'Ally of Justice Rudra': { self: { atk: (g, c) => { const o = foe(g, c); return o && attr(o) === 'LIGHT' ? 700 : 0; } } },
  // ENGINE: no general "can't be Special Summoned except by Fusion Summon" flag.
  'Ambulance Rescueroid': { effs: [{ type: 'trig', when: true, opt: true, tags: { ss: 1 }, label: 'Special Summon the destroyed monster',
    on: (g, ev, c) => ev.type === 'move' && ev.c !== c && ev.battle && ev.destroyed && ev.wasField && ev.to === 'gy' && ev.prevCtrl === c.ctrl && !!ev.snap && ev.snap.mon,
    cond: (g, c, p, x) => freeM(g, p) >= 0 && x.ev.c.zone === 'gy' && canSS(g, p, x.ev.c),
    res: function* (g, c, p, L2) { const t = L2.ev.c; if (t.zone === 'gy') ss(g, p, t, 'def'); } }] },
  // Every "roid" added at the same time can be summoned (ruling: Expressroid's 2 cards).
  'Ambulanceroid': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon the added roid',
    on: (g, ev, c) => { if (!(ev.type === 'move' && ev.from === 'gy' && ev.to === 'hand' && ev.c.owner === c.ctrl && isMon(ev.c) && /roid/.test(D(ev.c).n))) return false;
      if (!c.f35amb || c.f35amb.group !== ev.group) c.f35amb = { group: ev.group, cs: [] }; c.f35amb.cs.push(ev.c); return true; },
    cond: (g, c, p) => freeM(g, p) >= 0 && !!c.f35amb && c.f35amb.cs.some(x => x.zone === 'hand' && canSS(g, p, x)),
    res: function* (g, c, p) { for (const x of (c.f35amb ? c.f35amb.cs : [])) if (x.zone === 'hand' && freeM(g, p) >= 0 && canSS(g, p, x)) ss(g, p, x, 'atk'); } }] },
  'Ambush Fangs': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.aw && !!g.aw.t && g.aw.a.ctrl !== p && g.aw.t.ctrl === p && faceUp(g.aw.t) && /Venom/.test(name(g.aw.t)),
    target: function* (g, c, p, L2) { L2.data.a = g.aw.a; },
    res: function* (g, c, p, L2) { if (g.attackNegated) return; const a = L2.data.a; endBattle(g);
      if (a && onField(a)) { addCtr(g, a, 'venom', 1); log(g, `${name(a)} got a Venom Counter.`); } } }] },
  // The listed material Defender of the Sea matches no card in the pool. The TCG printing reads Ground Attacker Bugroth + Mother Grizzly.
  'Amphibious Bugroth': { mats: [c => D(c).n === 'Ground Attacker Bugroth', c => ['Mother Grizzly', 'Defender of the Sea'].includes(D(c).n)], effs: [] },
  'Amulet of Ambition': {
    cont: { atk: (g, src, m) => { if (src.equipTo !== m.u) return 0; const o = foe(g, m); return o && lv(o) > lv(m) ? 500 * (lv(o) - lv(m)) : 0; } },
    effs: [equipAct(normalNow, 'Equip to which Normal Monster?'),
      { type: 'trig', loc: 'gy', when: true, label: 'Place it on top of your Deck',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy',
        res: function* (g, c) { if (c.zone === 'gy') { move(g, c, 'deckTop', { reason: 'effect' }); log(g, 'Amulet of Ambition was placed on top of the Deck.'); } } }] },
  // ENGINE: no second Battle Phase. PARTIAL: in the opponent's next Battle Phase each of their monsters can attack one more time.
  'An Unfortunate Report': { effs: [
    { type: 'act', res: function* (g, c, p) { (g.f35rep || (g.f35rep = [])).push({ q: opp(p), turn: g.turnNo, early: g.tp === opp(p) && ['draw', 'standby', 'main1'].includes(g.phase) }); log(g, `${PN(g, opp(p))} conducts their next Battle Phase twice.`); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (!g.f35rep || !g.f35rep.length || !['attack', 'phase'].includes(ev.type)) return false;
      const due = e => g.tp === e.q && (g.turnNo > e.turn || e.early);
      if (ev.type === 'attack') { for (const e of g.f35rep) if (due(e) && ev.p === e.q) for (const m of monsOf(g, e.q)) m.flags.extraAttack = g.turnNo; }
      else if (ev.ph === 'bpEnd') g.f35rep = g.f35rep.filter(e => !due(e));
      return false; } }] },
  // The gained effect stays while it is face-up after its Tribute Summon (lost when turned face-down).
  'Angel O7': {
    cont: { forbid: (g, src, a) => !!src.flags.f35o7 && !negd(g, src) && a.type === 'activate' && !!a.c && isMon(a.c) && D(a.c).k !== 'normal' && !!a.eff && a.eff.type !== 'act' },
    effs: [{ type: 'trig', on: (g, ev, c) => { if (evSummoned(ev, c, ['tribute'])) c.flags.f35o7 = true; return false; }, res: noop }] },
  // ENGINE: no general "can't be Special Summoned" flag ("only by its own procedure").
  'Anteatereatingant': {
    proc: { label: 'Special Summon (send 2 Spells/Traps you control to the GY)', cond: (g, c, p) => stOf(g, p).length >= 2,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Send which 2 Spells/Traps you control to the GY?', stOf(g, p), 2, 2, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} sent ${xs.length} Spell/Trap card(s) to the GY.`); } },
    self: { cantAttack: (g, c) => c.flags.f35noAtk === g.turnNo },
    effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Destroy a Spell/Trap (no attack this turn)',
      cond: (g, c, p) => g.turnNo > 1 && !c.attacks && !has(g, c, 'cantAttack') && stOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOf(g, opp(p)), 1, 1, 'bad'); },
      after: (g, c) => { c.flags.f35noAtk = g.turnNo; },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  // PARTIAL: the Level is updated at each game event (ENGINE: no hook for ongoing Level changes in lv()).
  'Apocatequil': { effs: [
    { type: 'trig', res: noop, on: (g, ev, c) => {
      const tun = monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && D(x).tu);
      if (tun && !c.flags.lv) { c.flags.lv = 5; c.flags.f35apo = true; } else if (!tun && c.flags.f35apo) { c.flags.lv = null; c.flags.f35apo = false; }
      return false; } },
    { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon Oracle of the Sun',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, 'Oracle of the Sun')),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Oracle of the Sun?', g.p[p].gy.filter(x => named(x, 'Oracle of the Sun')), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  // The card comes back in the End Phase of the opponent's next turn (not this one, even on their turn); a card that left
  // the banished pile in between doesn't.
  'Appointer of the Red Lotus': { effs: [
    { type: 'act', cond: (g, c, p) => g.p[p].lp > 2000 && g.p[p].hand.length > 0 && g.p[opp(p)].hand.length > 0,
      cost: function* (g, c, p) { pay(g, p, 2000); log(g, `${PN(g, p)} revealed ${g.p[p].hand.map(name).join(', ')}.`); },
      res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand; if (!h.length) return; log(g, `${PN(g, p)} looked at ${PN(g, o)}'s hand.`);
        const [x] = yield* pick(g, p, 'Banish which card from their hand?', h, 1, 1, 'bad'); if (!x) return;
        move(g, x, 'ban', { reason: 'effect', by: p }); log(g, `${D(x).n} was banished until ${PN(g, o)}'s next End Phase.`);
        (c.f35lot || (c.f35lot = [])).push({ u: x.u, x, o, turn: g.turnNo }); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return the banished card',
      on: (g, ev, c) => {
        if (!c.f35lot || !c.f35lot.length) return false;
        if (ev.type === 'move' && ev.from === 'ban') { c.f35lot = c.f35lot.filter(e => e.u !== ev.c.u || ev.c.zone === 'ban'); return false; }
        return ev.type === 'phase' && ev.ph === 'end' && c.f35lot.some(e => ev.tp === e.o && g.turnNo > e.turn); },
      res: function* (g, c) { const due = (c.f35lot || []).filter(e => g.tp === e.o && g.turnNo > e.turn); c.f35lot = (c.f35lot || []).filter(e => !due.includes(e));
        for (const e of due) if (e.x.zone === 'ban') { move(g, e.x, 'hand', { reason: 'effect' }); log(g, `${D(e.x).n} returned to ${PN(g, e.o)}'s hand.`); } } }] },
  'Aquarian Alessa': { effs: [{ type: 'trig', mand: true, label: 'Random discard',
    on: (g, ev, c) => !!c.flags.gemini && battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
    res: function* (g, c, p) { randomDiscard(g, opp(p)); } }] },
  // Placing the counter starts no chain: it happens as the Spellcaster is destroyed (one counter per destruction, max. 4).
  'Arcane Barrier': { effs: [actNoop,
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
      if (ev.type === 'move' && ev.destroyed && ev.wasField && ev.snap && ev.snap.faceUp && ev.snap.mon && ev.snap.race === 'Spellcaster' && c.flags.f35grp !== ev.group && !negd(g, c)) {
        c.flags.f35grp = ev.group; if (ctr(c, 'spell') < 4) { addCtr(g, c, 'spell', 1); log(g, `Arcane Barrier got a Spell Counter (${ctr(c, 'spell')}).`); } }
      return false; } },
    { type: 'ign', loc: 'st', label: 'Send it and a Spellcaster: draw',
      cond: (g, c, p) => ctr(c, 'spell') > 0 && monsOf(g, p).some(x => faceUp(x) && race(x) === 'Spellcaster'),
      cost: function* (g, c, p, L2) { L2.data.n = ctr(c, 'spell'); const [x] = yield* pick(g, p, 'Send which face-up Spellcaster to the GY?', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Spellcaster'), 1, 1, 'cost');
        const grp = g.group; move(g, c, 'gy', { reason: 'cost', by: p, group: grp }); if (x) move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} sent Arcane Barrier${x ? ' and ' + D(x).n : ''} to the GY.`); },
      res: function* (g, c, p, L2) { draw(g, p, L2.data.n); } }] },
  // ENGINE: no general "can't be Special Summoned except with Assault Mode Activate" flag.
  'Arcanite Magician Assault Mode': { self: { atk: (g, c) => 1000 * ctr(c, 'spell') },
    effs: [
      { type: 'trig', mand: true, label: 'Place 2 Spell Counters', on: (g, ev, c) => evSummoned(ev, c, SPECIAL),
        res: function* (g, c) { if (onField(c) && faceUp(c)) { addCtr(g, c, 'spell', 2); log(g, `${name(c)} got 2 Spell Counters.`); } } },
      { type: 'ign', tags: { destroy: 1 }, label: 'Remove 2 Spell Counters: destroy all their cards',
        cond: (g, c, p) => ctr(c, 'spell') >= 2 && fieldOf(g, opp(p)).length > 0,
        cost: function* (g, c, p) { addCtr(g, c, 'spell', -2); log(g, `${PN(g, p)} removed 2 Spell Counters.`); },
        res: function* (g, c, p) { destroy(g, fieldOf(g, opp(p)), { by: p }); } },
      { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon Arcanite Magician',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy',
        cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, 'Arcanite Magician')),
        res: function* (g, c, p) { const xs = g.p[p].gy.filter(x => named(x, 'Arcanite Magician')); if (!xs.length || freeM(g, p) < 0) return;
          const [x] = yield* pick(g, p, 'Special Summon which Arcanite Magician?', xs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  // Its own summon rule only (the empty recipe keeps Polymerization from summoning it).
  'Armityle the Chaos Phantasm': { mats: [() => false, () => false],
    proc: { extra: true, label: 'Special Summon (banish Uria, Hamon and Raviel)',
      cond: (g, c, p) => ['Uria, Lord of Searing Flames', 'Hamon, Lord of Striking Thunder', 'Raviel, Lord of Phantasms'].every(n => monsOf(g, p).some(x => faceUp(x) && named(x, n))),
      cost: function* (g, c, p, grp) { const xs = ['Uria, Lord of Searing Flames', 'Hamon, Lord of Striking Thunder', 'Raviel, Lord of Phantasms'].map(n => monsOf(g, p).find(x => faceUp(x) && named(x, n))).filter(Boolean);
        for (const x of xs) move(g, x, 'ban', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} banished ${xs.map(x => D(x).n).join(', ')}.`); } },
    self: { noBattleDestroy: true, atk: (g, c) => g.tp === c.ctrl ? 10000 : 0 }, effs: [] },
  // The monsters Tributed for the Ritual Summon are seen through their moves in the same group as the summon.
  'Ascending Soul': { effs: [actNoop,
    { type: 'trig', loc: 'st', when: true, opt: true, label: 'Add a Tributed monster to your hand',
      on: (g, ev, c) => {
        if (ev.type === 'move' && ev.reason === 'ritual' && ev.to === 'gy') { if (!c.f35asc || c.f35asc.group !== ev.group) c.f35asc = { group: ev.group, us: [] }; c.f35asc.us.push(ev.c.u); return false; }
        return ev.type === 'summon' && ev.how === 'ritual' && !!c.f35asc && c.f35asc.group === ev.group; },
      cond: (g, c, p) => !!c.f35asc && g.p[p].gy.some(x => c.f35asc.us.includes(x.u)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Tributed monster to your hand?', g.p[p].gy.filter(x => c.f35asc.us.includes(x.u)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${PN(g, p)} added ${D(t).n} to the hand.`); } } }] },
  // A Normal Trap that stays on the field as an Equip Card (+800 ATK, draws on a battle destruction).
  'At One With the Sword': {
    cont: { atk: (g, src, m) => src.equipTo === m.u ? 800 : 0 },
    effs: [{ type: 'act', cond: (g, c, p) => { const ms = monsOf(g, p); return ms.length === 1 && faceUp(ms[0]) && isXSaber(ms[0]); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which X-Saber?', monsOf(g, p).filter(m => faceUp(m) && isXSaber(m)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && equip(g, c, t)) L2.keep = true; } },
      { type: 'trig', loc: 'st', mand: true, label: 'Draw 1 card', on: (g, ev, c) => eqKill(ev, c), res: function* (g, c, p) { draw(g, p, 1); } }] },
  // PARTIAL: Fairies Special Summoned by 2 effects in one chain inflict 600 once, not once per effect.
  'Athena': { effs: [
    { type: 'trig', mand: true, label: '600 damage', on: (g, ev, c) => ev.type === 'summon' && ev.cs.some(x => x !== c && isMon(x) && faceUp(x) && race(x) === 'Fairy'),
      res: function* (g, c, p) { damage(g, opp(p), 600, { src: c, srcP: p }); } },
    { type: 'ign', opt: true, tags: { ss: 1 }, label: 'Send a Fairy: revive a Fairy',
      cond: (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x) && race(x) === 'Fairy' && !named(x, 'Athena')),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which face-up Fairy to the GY?', monsOf(g, p).filter(x => x !== c && faceUp(x) && race(x) === 'Fairy' && !named(x, 'Athena')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Fairy from your GY?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Fairy' && !named(x, 'Athena') && canSS(g, p, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  'Automatic Laser': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.sw && g.sw.p !== p && ['normal', 'tribute', 'gemini', ...SPECIAL].includes(g.sw.how) && g.sw.cs.some(x => onField(x) && faceUp(x) && atk(g, x) >= 1000) && g.p[p].hand.some(x => named(x, "Iron Core of Koa'ki Meiru")),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, "Reveal Iron Core of Koa'ki Meiru", g.p[p].hand.filter(x => named(x, "Iron Core of Koa'ki Meiru")), 1, 1, 'cost'); if (x) log(g, `${PN(g, p)} revealed ${D(x).n}.`); },
    target: function* (g, c, p, L2) { L2.data.cs = g.sw.cs.slice(); },
    res: function* (g, c, p, L2) { destroy(g, L2.data.cs.filter(x => onField(x) && faceUp(x) && atk(g, x) >= 1000), { by: p, src: c }); } }] },
  'Avalanching Aussa': { ...summoner('EARTH', 'Avalanching Aussa') },
  'Axe of Despair (Archfiend)': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 1000 : 0 },
    effs: [equipAct(),
      { type: 'trig', loc: 'gy', when: true, label: 'Tribute 1 monster: put it on top of the Deck',
        on: (g, ev, c) => fromFieldToGY(ev, c), cond: (g, c, p) => c.zone === 'gy' && monsOf(g, p).length > 0,
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 monster', monsOf(g, p), 1, 1, 'cost'); if (x) { const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); } },
        res: function* (g, c) { if (c.zone === 'gy') { move(g, c, 'deckTop', { reason: 'effect' }); log(g, `${D(c).n} was put on top of the Deck.`); } } }] },

  /* ----- B ----- */
  'Babycerasaurus': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon a Dinosaur',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && !ev.battle && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && race(x) === 'Dinosaur' && lv(x) <= 4 && canSS(g, p, x)),
    res: function* (g, c, p) { const xs = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Dinosaur' && lv(x) <= 4 && canSS(g, p, x)); if (!xs.length || freeM(g, p) < 0) { shuffleDeck(g, p); return; }
      const [x] = yield* pick(g, p, 'Special Summon which Level 4 or lower Dinosaur from your Deck?', xs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  // One of each name, none with a name you already control; with too few zones you pick which.
  'Backs to the Wall': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => g.p[p].lp > 100 && freeM(g, p) >= 0 && g.p[p].gy.some(isSixSam),
    cost: function* (g, c, p) { pay(g, p, g.p[p].lp - 100); },
    res: function* (g, c, p) {
      const have = new Set(monsOf(g, p).filter(faceUp).map(name)); const reps = new Map();
      for (const x of g.p[p].gy) if (isSixSam(x) && !have.has(D(x).n) && !reps.has(D(x).n) && canSS(g, p, x)) reps.set(D(x).n, x);
      let xs = [...reps.values()]; const n = nFreeM(g, p); if (!xs.length || !n) return;
      if (xs.length > n) xs = yield* pick(g, p, `Special Summon which ${n} Six Samurai monster${n > 1 ? 's' : ''}?`, xs, n, n, 'good');
      const grp = g.group; for (const x of xs) ss(g, p, x, 'atk', { group: grp }); } }] },
  'Bamboo Scrap': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => race(x) === 'Plant') && nFreeM(g, opp(p)) >= 2,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which Plant monster?', monsOf(g, p).filter(x => race(x) === 'Plant'), 1, 1, 'cost'); if (x) { const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); } },
    res: function* (g, c, p) { tokens(g, opp(p), { n: 'Plant Token', a: 'EARTH', r: 'Plant', lv: 1, atk: 800, def: 500 }, 2, 'def'); } }] },
  // The bonus is counted once for all copies (the first face-up Batteryman C applies it).
  'Batteryman C': { cont: {
    atk: (g, src, m) => { const bs = monsOf(g, src.ctrl).filter(x => named(x, 'Batteryman C')); if (bs.find(x => faceUp(x) && !x.flags.negated) !== src || negd(g, src)) return 0; return m.ctrl === src.ctrl && race(m) === 'Machine' && bs.every(x => x.pos === 'atk') ? 500 * bs.length : 0; },
    def: (g, src, m) => { const bs = monsOf(g, src.ctrl).filter(x => named(x, 'Batteryman C')); if (bs.find(x => faceUp(x) && !x.flags.negated) !== src || negd(g, src)) return 0; return m.ctrl === src.ctrl && race(m) === 'Machine' && bs.every(x => x.pos !== 'atk') ? 500 * bs.length : 0; } } },
  'Batteryman D': { cont: { grant: (g, src, m, flag) => flag === 'noAttackTarget' && m !== src && m.zone === 'm' && m.ctrl === src.ctrl && faceUp(m) && race(m) === 'Thunder' && !named(m, 'Batteryman D') && !negd(g, src) } },
  'Battlestorm': { self: { atk: (g, c) => 100 * monsOf(g, c.ctrl).filter(x => faceUp(x) && race(x) === 'Winged Beast').length },
    effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy a Spell/Trap',
      cond: (g, c, p) => monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Winged Beast').length >= 3 && stOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { if (monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Winged Beast').length < 3) { log(g, 'Battlestorm needs 3 Winged Beast monsters to resolve.'); return; } destroy(g, live(L2), { by: p, src: c }); } }] },
  'Beelze Frog': { self: { atk: (g, c) => 300 * g.p[c.ctrl].gy.filter(x => named(x, 'T.A.D.P.O.L.E.')).length } },
  // PARTIAL: a discard is told from a cost by the move's reason ('discard' vs 'cost'); a script that discards for a cost
  // with reason 'discard' still triggers it. The hand size limit doesn't.
  'Beiige, Vanguard of Dark World': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon it',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'hand' && ev.to === 'gy' && ev.reason === 'discard' && !ruleDiscard(g, ev),
    cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c, 'atk'); } }] },
  'Bending Destiny': { effs: [
    { type: 'act', negSummon: true,
      cond: (g, c, p, x) => { const ms = monsOf(g, p).filter(faceUp); if (!ms.length || !ms.every(isFL)) return false;
        return (!x.top && !!g.attempt && ['normal', 'tribute'].includes(g.attempt.how)) || (spellTrapAct(x.top) && !x.top.negated); },
      target: function* (g, c, p, L2) { L2.data.mode = g.chain.length ? 'link' : 'summon'; L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) {
        let x = null;
        if (L2.data.mode === 'summon') { if (!g.attempt) return; g.attempt.negated = true; log(g, 'The Normal Summon was negated.'); x = g.attempt.cs[0]; }
        else { const T = L2.data.L; T.negBy = p; negate(g, T, false); x = T.c; }
        if (x && onField(x)) { move(g, x, 'ban', { reason: 'effect', by: p }); log(g, `${D(x).n} was banished until the End Phase.`); (c.f35bd || (c.f35bd = [])).push({ x, turn: g.turnNo }); } } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return the banished card',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!c.f35bd && c.f35bd.some(e => e.turn === g.turnNo),
      res: function* (g, c) { const due = c.f35bd.filter(e => e.turn === g.turnNo); c.f35bd = c.f35bd.filter(e => e.turn > g.turnNo);
        for (const e of due) if (e.x.zone === 'ban') { move(g, e.x, 'hand', { reason: 'effect' }); log(g, `${D(e.x).n} returned to ${PN(g, e.x.owner)}'s hand.`); } } }] },
  'Berfomet': { effs: [{ type: 'trig', when: true, label: 'Add Gazelle', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute', 'flip']),
    cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'Gazelle the King of Mythical Beasts')),
    res: function* (g, c, p) { yield* search(g, p, x => named(x, 'Gazelle the King of Mythical Beasts'), 'Add Gazelle the King of Mythical Beasts'); } }] },
  'Berserker Crush': { effs: [{ type: 'act', ds: true,
    cond: (g, c, p) => g.p[p].gy.some(isMon) && monsOf(g, p).some(x => faceUp(x) && named(x, 'Winged Kuriboh')),
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Banish which monster from your GY?', g.p[p].gy.filter(isMon), 1, 1, 'good'); if (!x) return; L2.data.a = baseAtk(x); L2.data.d = num(D(x).def); move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${D(x).n}.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Winged Kuriboh?', monsOf(g, p).filter(x => faceUp(x) && named(x, 'Winged Kuriboh')), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || L2.data.a == null) return; addMod(g, t, { set: L2.data.a, which: 'atk', end: true }); addMod(g, t, { set: L2.data.d, which: 'def', end: true }); log(g, `${name(t)} has ${L2.data.a} ATK and ${L2.data.d} DEF this turn.`); } }] },
  'Berserking': { effs: [actNoop,
    { type: 'quick', loc: 'st', opt: true, label: 'Move half the ATK between 2 Beasts',
      cond: (g, c, p) => ((g.tp === p && ['main1', 'main2'].includes(g.phase)) || (g.tp !== p && g.phase === 'battle' && !g.inDS)) && fieldMons(g).filter(x => faceUp(x) && race(x) === 'Beast').length >= 2,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select 2 face-up Beast monsters', fieldMons(g).filter(x => faceUp(x) && race(x) === 'Beast'), 2, 2, 'good'); },
      res: function* (g, c, p, L2) { const ts = live(L2).filter(x => faceUp(x) && race(x) === 'Beast'); if (ts.length < 2) return;
        const [lo] = yield* pick(g, p, 'Which one loses half its ATK?', ts, 1, 1, 'bad'); const hi = ts.find(x => x !== lo); const h = Math.floor(atk(g, lo) / 2);
        addMod(g, lo, { atk: -h, end: true }); addMod(g, hi, { atk: h, end: true }); log(g, `${name(lo)} lost ${h} ATK and ${name(hi)} gained ${h} ATK.`); } }] },
  'Bicular': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon Unicycular',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Unicycular')),
    res: function* (g, c, p) { const xs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Unicycular')); if (!xs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which Unicycular (hand or Deck)?', xs, 1, 1, 'good'); if (!x) return; const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } }] },
  'Birthright': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => normalNow(x) && canSS(g, p, x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Normal Monster from your GY?', g.p[p].gy.filter(x => normalNow(x) && canSS(g, p, x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && onField(c) && ss(g, p, t, 'atk')) link(g, c, t); } }] },
  'Bitelon': { self: { piercing: true } },
  // The column: this card's zone, your Monster Zone in front of it and the opponent's two zones facing them.
  'Blasting Fuse': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => { const i = g.p[p].st.indexOf(c); return i >= 0 && !!g.p[p].m[i] && !!g.p[opp(p)].m[4 - i] && !!g.p[opp(p)].st[4 - i]; },
    target: function* (g, c, p, L2) { L2.data.i = g.p[p].st.indexOf(c); },
    res: function* (g, c, p, L2) { const i = L2.data.i; if (i == null || i < 0) return; destroy(g, [g.p[p].m[i], g.p[opp(p)].m[4 - i], g.p[opp(p)].st[4 - i], g.p[p].st[i]].filter(Boolean), { by: p, src: c }); } }] },
  'Blazing Hiita': { ...summoner('FIRE', 'Blazing Hiita') },
  'Blizzard Dragon': { effs: [{ type: 'ign', opt: true, label: 'Lock a monster',
    cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, "Which monster can't attack or change position?", monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; const u = t.u, tin = t.turnIn;
      addRule(g, (g2, a) => (a.type === 'attack' || a.type === 'pos') && !!a.c && a.c.u === u && a.c.turnIn === tin && onField(a.c), { end: g.turnNo + 1 });
      log(g, `${shown(g, t)} can't attack or change its battle position until the end of ${PN(g, opp(p))}'s next turn.`); } }] },
  'Blizzard Warrior': { effs: [{ type: 'trig', mand: true, label: 'Look at the top card of their Deck',
    on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
    res: function* (g, c, p) { const d = g.p[opp(p)].deck; if (!d.length) return; const x = d[d.length - 1]; log(g, `${PN(g, p)} looked at the top card of ${PN(g, opp(p))}'s Deck.`);
      const i = yield* choose(g, p, `Their top card is ${D(x).n}. Put it where?`, ['Top of the Deck', 'Bottom of the Deck']);
      if (i === 1) { d.splice(d.indexOf(x), 1); d.unshift(x); log(g, 'The card went to the bottom of the Deck.'); } else log(g, 'The card went back on top of the Deck.'); } }] },
  'Blizzed, Defender of the Ice Barrier': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Draw 1 card',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p) { draw(g, p, 1); } }] },
  // Counts each of your turns it was face-up on your field (the turn it was summoned is the first).
  'Blockman': { effs: [
    { type: 'trig', res: noop, on: (g, ev, c) => { if (faceUp(c) && g.tp === c.ctrl) { const s = c.flags.f35bt || (c.flags.f35bt = []); if (!s.includes(g.turnNo)) s.push(g.turnNo); } return false; } },
    { type: 'ign', tags: { ss: 1 }, label: 'Tribute: Special Summon Block Tokens',
      cond: (g, c, p) => (c.flags.f35bt || []).length > 0,
      cost: function* (g, c, p, L2) { L2.data.n = (c.flags.f35bt || []).length || 1; move(g, c, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Blockman.`); },
      res: function* (g, c, p, L2) { const ts = tokens(g, p, { n: 'Block Token', a: 'EARTH', r: 'Rock', lv: 4, atk: 1000, def: 1500 }, Math.min(L2.data.n, nFreeM(g, p)), 'def'); for (const t of ts) t.flags.cantAttack = true; } }] },
  // PARTIAL: the engine doesn't say whose effect Special Summoned a monster, so any effect that Special Summons it
  // from the GY counts (the text asks for a Zombie monster's effect).
  'Bone Crusher': { effs: [
    { type: 'trig', res: noop, on: (g, ev, c) => {
      if (ev.type === 'move' && ev.c === c && ev.to === 'm') c.f35from = ev.from;
      if (evSummoned(ev, c, ['special'])) c.flags.f35ssT = g.turnNo;
      return false; } },
    { type: 'trig', when: true, tags: { destroy: 1 }, label: 'Destroy a Spell/Trap',
      on: (g, ev, c) => evSummoned(ev, c, ['special']) && !!ev.byEffect && c.f35from === 'gy',
      cond: (g, c, p) => stOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } },
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy this card',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.f35ssT === g.turnNo,
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  // The turn player picks first; the monsters are destroyed in the End Phase of the next turn.
  'Bone Temple Block': { effs: [
    { type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => g.p[p].hand.length > 0 && [g.p[0], g.p[1]].some(P => P.gy.some(x => isMon(x) && lv(x) <= 4)),
      res: function* (g, c, p) {
        if (!g.p[p].hand.length) return; const [d] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand, 1, 1, 'cost'); if (!d) return;
        move(g, d, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${D(d).n}.`);
        const order = g.tp === p ? [p, opp(p)] : [opp(p), p]; const due = g.turnNo + 1;
        for (const q of order) {
          const xs = g.p[opp(q)].gy.filter(x => isMon(x) && lv(x) <= 4 && canSS(g, q, x)); if (!xs.length || freeM(g, q) < 0) continue;
          const [x] = yield* pick(g, q, `Special Summon which Level 4 or lower monster from ${PN(g, opp(q))}'s GY?`, xs, 1, 1, 'good');
          if (x && ss(g, q, x, 'atk')) { x.flags.f35btb = due; (c.f35btb || (c.f35btb = [])).push({ u: x.u, due }); } } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the summoned monsters',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!c.f35btb && c.f35btb.some(e => e.due === g.turnNo),
      res: function* (g, c, p) { const us = c.f35btb.filter(e => e.due === g.turnNo).map(e => e.u); c.f35btb = c.f35btb.filter(e => e.due > g.turnNo);
        destroy(g, fieldMons(g).filter(m => us.includes(m.u) && m.flags.f35btb === g.turnNo), { by: p, src: c }); } }] },
  'Boss Rush': {
    cont: { forbid: (g, src, a) => (a.type === 'ns' || a.type === 'set') && a.p === src.ctrl && !negd(g, src) },
    effs: [{ type: 'act', cond: (g, c, p) => !g.ns[p], res: noop },
      { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.destroyed && ev.wasField && ev.to === 'gy' && isBoss(ev.c)) c.flags.f35boss = g.turnNo; return false; } },
      { type: 'trig', loc: 'st', opt: true, tags: { ss: 1 }, label: 'Special Summon a B.E.S. or Big Core',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.f35boss === g.turnNo,
        cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isBoss(x) && canSS(g, p, x)),
        res: function* (g, c, p) { const xs = g.p[p].deck.filter(x => isBoss(x) && canSS(g, p, x)); if (!xs.length || freeM(g, p) < 0) { shuffleDeck(g, p); return; }
          const [x] = yield* pick(g, p, 'Special Summon which B.E.S. or Big Core from your Deck?', xs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  'Botanical Girl': { effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Add a Plant with 1000 or less DEF',
    on: (g, ev, c) => fromFieldToGY(ev, c),
    cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && race(x) === 'Plant' && num(D(x).def) <= 1000),
    res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && race(x) === 'Plant' && num(D(x).def) <= 1000, 'Add a Plant monster with 1000 or less DEF'); } }] },
  // No chain: the draw happens as the resolved Counter Trap leaves the field.
  // PARTIAL: a Counter Trap negated without being destroyed is counted too.
  'Bountiful Artemis': { effs: [{ type: 'trig', res: noop, on: (g, ev, c) => {
    if (ev.type === 'move' && ev.wasField && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && isTrap(ev.c) && D(ev.c).sub === 'Counter' && ev.snap && ev.snap.faceUp && g.p[c.ctrl].deck.length) {
      log(g, 'Bountiful Artemis draws a card.'); draw(g, c.ctrl, 1); }
    return false; } }] },
  // Control lasts while this card is face-up on the field.
  'Brainwashing Beam': { effs: [
    { type: 'act', cond: (g, c, p) => freeM(g, p) >= 0 && monsOf(g, opp(p)).some(x => ctr(x, 'A') > 0),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which monster with an A-Counter?', monsOf(g, opp(p)).filter(x => ctr(x, 'A') > 0), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && ctr(t, 'A') > 0 && onField(c) && t.ctrl !== p && takeControl(g, p, t, false)) c.flags.f35bb = t.u; } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Remove an A-Counter',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl && !!c.flags.f35bb,
      res: function* (g, c) { const m = fieldMons(g).find(x => x.u === c.flags.f35bb); if (!m) return; addCtr(g, m, 'A', -1); log(g, `An A-Counter was removed from ${name(m)}.`); if (!ctr(m, 'A') && onField(c)) destroy(g, [c], { by: c.ctrl }); } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy Brainwashing Beam',
      on: (g, ev, c) => ev.type === 'move' && !!c.flags.f35bb && ev.c.u === c.flags.f35bb && ev.wasField && ev.destroyed,
      res: function* (g, c) { if (onField(c)) destroy(g, [c], { by: c.ctrl }); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Control returns',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && !!ev.snap && !!ev.snap.flags && !!ev.snap.flags.f35bb && fieldMons(g).some(m => m.u === ev.snap.flags.f35bb && m.ctrl !== m.owner),
      res: function* (g, c, p, L2) { const m = fieldMons(g).find(x => x.u === L2.ev.snap.flags.f35bb); if (!m || m.ctrl === m.owner) return;
        if (freeM(g, m.owner) >= 0) { takeControl(g, m.owner, m, false); log(g, `${name(m)} returned to ${PN(g, m.owner)}.`); } else move(g, m, 'gy', { reason: 'rule' }); } }] },
  // Fusion Materials are seen through their moves in the same group as the Fusion Summon (or Polymerization's own note).
  'Branch!': { effs: [actNoop,
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (ev.type === 'move' && ev.reason === 'fusion') { if (!g.f35fm || g.f35fm.group !== ev.group) g.f35fm = { group: ev.group, us: [] }; g.f35fm.us.push(ev.c.u); }
      else if (ev.type === 'summon' && ev.how === 'fusion' && g.f35fm && g.f35fm.group === ev.group) for (const x of ev.cs) x.f35mats = g.f35fm.us.slice();
      return false; } },
    { type: 'trig', loc: 'st', when: true, tags: { ss: 1 }, label: 'Special Summon a Fusion Material',
      on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.destroyed && ev.to === 'gy' && !!ev.snap && ev.snap.mon && D(ev.c).k === 'fusion',
      cond: (g, c, p, x) => { const ev = x.ev; const us = ev.c.f35mats || (ev.snap.flags && ev.snap.flags.fusionMats) || []; c.f35us = us; return freeM(g, p) >= 0 && g.p[p].gy.some(y => us.includes(y.u) && canSS(g, p, y)); },
      target: function* (g, c, p, L2) { const us = c.f35us || []; yield* tgt(g, p, L2, 'Special Summon which Fusion Material from your GY?', g.p[p].gy.filter(y => us.includes(y.u) && canSS(g, p, y)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  // Destroyed in your 3rd End Phase counting the one of the turn it was activated (not an effect).
  'Break! Draw!': { effs: [{ ...equipAct(m => race(m) === 'Machine', 'Equip to which Machine?'),
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && race(t) === 'Machine' && onField(c) && equip(g, c, t)) c.flags.f35n = 0; } },
    { type: 'trig', loc: 'st', mand: true, label: 'Draw 1 card', on: (g, ev, c) => eqKill(ev, c), res: function* (g, c, p) { draw(g, p, 1); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Destroy Break! Draw!',
      on: (g, ev, c) => { if (!(ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl && c.flags.f35n != null)) return false; c.flags.f35n++; return c.flags.f35n >= 3; },
      res: function* (g, c) { if (onField(c)) destroy(g, [c], { rule: true }); } }] },
  'Breakthrough!': {
    cont: { loc: 'gy', grant: (g, src, m, flag) => flag === 'directAttack' && !!src.f35bt && src.f35bt.turn === g.turnNo && src.f35bt.kill && src.f35bt.us.includes(m.u) && onField(m) && m.ctrl === src.f35bt.p },
    effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isSixSam(x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which Six Samurai monster?', monsOf(g, p).filter(x => faceUp(x) && isSixSam(x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return;
        c.f35bt = { p, turn: g.turnNo, u: t.u, kill: false, us: monsOf(g, p).filter(x => faceUp(x) && (isSixSam(x) || named(x, 'Great Shogun Shien'))).map(x => x.u) };
        log(g, `If ${name(t)} destroys a monster by battle, ${PN(g, p)}'s Six Samurai can attack directly this turn.`); } },
      { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { const e = c.f35bt;
        if (e && !e.kill && e.turn === g.turnNo && ev.type === 'move' && ev.battle && ev.destroyed && ev.killer && ev.killer.u === e.u && ev.prevCtrl !== e.p) { e.kill = true; g.seq++; log(g, "Breakthrough! lets the Six Samurai attack directly."); }
        return false; } }] },
  'Breath of Light': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(x => faceUp(x) && race(x) === 'Rock'),
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => faceUp(x) && race(x) === 'Rock'), { by: p, src: c }); } }] },
});
})();
