/* Full pool batch 39: Gigantic Cephalotus to Imprisoned Queen Archfiend (build/batches/full/full-39.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings.
 Hannibal Necromancer has a Goat-only script in classic-3.js; it is ported here as the shared version (the Goat one still wins
 under Goat). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, setFaceDown, negate, addMod,
  equip, link, addCtr, ctr, endBattle, addRule, token, tokens, name, D, isMon, isST, isSpell, isTrap, isExtraD, onField, faceUp,
  attr, race, lv, baseAtk, monsOf, stOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, live, opp,
  oppFaceUp, stOnField, spellTrapAct, evSummoned, battleKill, isGemini, emit, forbid, stat, negd, num } = L;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const ATK = (g, c) => stat(g, c, 'atk');
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from: 'atk' }); };
const flipPos = (g, c) => { if (!onField(c) || c.zone !== 'm' || !faceUp(c)) return; const from = c.pos; c.pos = from === 'atk' ? 'def' : 'atk'; g.seq++; log(g, `${name(c)} was changed to ${c.pos === 'atk' ? 'Attack' : 'Defense'} Position.`); emit(g, { type: 'pos', c, p: c.ctrl, from }); };
const discardRandom = (g, p, reason = 'discard') => { const h = g.p[p].hand; if (!h.length) return null; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason }); log(g, `${PN(g, p)} ${reason === 'discard' ? 'discarded' : 'sent'} ${name(x)} ${reason === 'discard' ? 'at random' : 'from the hand to the GY at random'}.`); return x; };
// back to the Deck: Extra Deck monsters go to the Extra Deck
const toDeck = (g, x) => move(g, x, isExtraD(D(x)) ? 'extra' : 'deck', { reason: 'effect' });
function toBottom(g, x) { if (isExtraD(D(x))) { move(g, x, 'extra', { reason: 'effect' }); return; } move(g, x, 'deckTop', { reason: 'effect' }); const d = g.p[x.owner].deck; const i = d.indexOf(x); if (i >= 0) { d.splice(i, 1); d.unshift(x); } }
const flip = (label, more) => ({ type: 'trig', mand: true, faceDownOk: true, label, on: (g, ev, c) => ev.type === 'flip' && ev.c === c, ...more });
const isSpecialHow = how => !['normal', 'tribute', 'flip', 'gemini'].includes(how);
// "by an effect of a card controlled by your opponent" (as full-26.js): the move's own `by` when given, else the turn player.
const byOpp = (g, ev, c) => ev.by != null ? ev.by !== c.owner : g.tp !== c.owner;
// Dark World: discarded from the hand to the GY by a card effect (a cost discard counts). The hand size limit doesn't (as full-36.js).
// PARTIAL: a script that sends a hand card to the GY for a cost with reason 'cost' (not a discard) also counts.
const dwDiscard = (g, ev, c) => {
  if (!(ev.type === 'move' && ev.c === c && ev.from === 'hand' && ev.to === 'gy' && ['discard', 'cost'].includes(ev.reason))) return false;
  if (g.phase === 'end' && ev.by == null && g.tp === c.owner && g.p[c.owner].hand.length >= 6 && !g.chain.length) return false;
  return true; };
// Spirit return: during the End Phase of the turn it was Normal Summoned or flipped face-up (as full-23.js)
const spiritReturn = { type: 'trig', mand: true, label: 'Return to the hand',
  on: (g, ev, c) => {
    if ((ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how)) || (ev.type === 'flip' && ev.c === c)) c.flags.spirit = g.turnNo;
    return ev.type === 'phase' && ev.ph === 'end' && c.flags.spirit === g.turnNo; },
  res: function* (g, c) { if (onField(c) && faceUp(c)) { move(g, c, 'hand', { reason: 'effect' }); log(g, `${name(c)} returned to the hand.`); } } };
// "Cannot be Special Summoned" and "must first be Special Summoned (from your hand) by its own rule": one duel-long rule installed by
// the first event any of these cards sees (as full-04.js). ENGINE: no general "can't be Special Summoned" flag.
// PARTIAL (Gigastone Omega, Grinder Golem, Hamon): an effect that Special Summons them from the hand is not stopped.
const firstProper = (g, a) => a.type === 'ss' && (['deck', 'extra'].includes(a.c.zone) || (['gy', 'ban'].includes(a.c.zone) && !a.c.f39nomi));
const LOCKS = {
  'Gigastone Omega': firstProper,
  'Grinder Golem': firstProper,
  'Gilford the Legend': (g, a) => a.type === 'ss',
  'Gundari': (g, a) => a.type === 'ss',
  'Immortal Ruler': (g, a) => a.type === 'ss',
  'Hamon, Lord of Striking Thunder': (g, a) => a.type === 'ss' && a.c.zone !== 'hand',
};
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: (g) => { if (!g.f39lock) { g.f39lock = true; addRule(g, (g2, a) => { if (!a.c || !a.c.id || a.type !== 'ss') return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); } return false; } };
// a summon by the card's own rule marks it, so it can later come back from the GY (c.f39nomi is a card property, so it lasts)
const nomiMark = { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'summon' && ev.cs.includes(c) && c.f39proc != null && c.f39proc === ev.group) { c.f39nomi = true; c.f39proc = null; } return false; } };
const noSSFromGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src };
// Archfiend upkeep (as full-28.js): pay or destroy; Pandemonium removes the cost
const archCost = n => ({ type: 'trig', mand: true, label: `Pay ${n} LP`, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
  res: function* (g, c, p) { if (!onField(c) || allField(g).some(x => faceUp(x) && named(x, 'Pandemonium'))) return; if (g.p[p].lp > n) pay(g, p, n); else destroy(g, [c], { by: p }); } });
// Equip Spells (as full-26.js)
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) equip(g, c, t); } });
// Gemini "attack all monsters once each" (as full-19.js), only while Gemini Summoned
function hitThisTurn(g, c) { return new Set(g.events.filter(e => e.type === 'attack' && e.a === c && e.turn === g.turnNo && e.t).map(e => e.t.u)); }
const isHarpieLady = x => isMon(x) && (named(x, 'Harpie Lady') || /name is (always )?treated as "Harpie Lady"/.test(D(x).ps || D(x).tx || ''));
const isLS = x => isMon(x) && /Lightsworn/.test(D(x).n);
const isGB = x => /Gladiator Beast/.test(D(x).n);
const face = (g, x) => x.pos === 'set' ? 'a face-down monster' : name(x);

E.addScripts({
  /* ----- Gi ----- */
  // Gains 200 ATK at once (no chain) each time a Plant monster goes from the field to the GY (it must still be a Plant there).
  'Gigantic Cephalotus': { effs: [{ type: 'trig', res: noop,
    on: (g, ev, c) => {
      if (ev.type === 'move' && ev.c !== c && ev.wasField && ev.to === 'gy' && ev.c.zone === 'gy' && ev.snap && ev.snap.mon && ev.snap.race === 'Plant' && race(ev.c) === 'Plant') {
        addMod(g, c, { atk: 200 }); log(g, 'Gigantic Cephalotus gained 200 ATK.'); }
      return false; } }] },
  'Gigastone Omega': {
    proc: { label: 'Special Summon (banish 2 EARTHs from your GY)',
      cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && attr(x) === 'EARTH').length >= 2,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Banish 2 EARTH monsters from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'EARTH'), 2, 2, 'cost');
        for (const x of xs) move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${xs.map(name).join(' and ')}.`); c.f39proc = grp; } },
    effs: [lockInstall, nomiMark,
      { type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy their Spells/Traps',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.from === 'm' && ev.to === 'gy' && ev.snap && ev.snap.faceUp && ev.prevCtrl === c.owner && !ev.battle && ['effect', 'cost'].includes(ev.reason),
        res: function* (g, c, p) { destroy(g, stOf(g, opp(p)), { by: p, src: c }); } }] },
  // PARTIAL: the Equip Spells' own "equip only to" limits are not checked (any face-up Warrior you control takes them).
  'Gilford the Legend': { effs: [lockInstall,
    { type: 'trig', when: true, label: 'Equip Equip Spells from your GY',
      on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
      cond: (g, c, p) => freeST(g, p) >= 0 && g.p[p].gy.some(x => isSpell(x) && D(x).sub === 'Equip') && monsOf(g, p).some(x => faceUp(x) && race(x) === 'Warrior'),
      res: function* (g, c, p) {
        let eqs = g.p[p].gy.filter(x => isSpell(x) && D(x).sub === 'Equip'); const n = Math.min(eqs.length, g.p[p].st.filter(z => !z).length); if (!n) return;
        if (eqs.length > n) eqs = yield* pick(g, p, `Equip which ${n} Equip Spell${n > 1 ? 's' : ''}?`, eqs, n, n, 'good');
        for (const eq of eqs) {
          const ws = monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Warrior'); if (!ws.length || freeST(g, p) < 0 || eq.zone !== 'gy') break;
          const [t] = yield* pick(g, p, `Equip ${name(eq)} to which Warrior?`, ws, 1, 1, 'good'); if (!t) break;
          move(g, eq, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p }); equip(g, eq, t);
        } } }] },
  // You can Tribute 3 to Tribute Summon it; then it destroys every monster the opponent controls.
  // PARTIAL: a Set with 3 Tributes is not blocked (it just gets no effect).
  'Gilford the Lightning': { self: { tributes: () => [3] },
    effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy all their monsters',
      on: (g, ev, c) => evSummoned(ev, c, ['tribute']) && ev.tribs && ev.tribs.length === 3,
      res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)), { by: p, src: c }); } }] },
  'Give and Take': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, opp(p)) >= 0 && g.p[p].gy.some(x => canSS(g, opp(p), x) && !isExtraD(D(x))) && monsOf(g, p).some(faceUp),
    res: function* (g, c, p) {
      const cs = g.p[p].gy.filter(x => isMon(x) && !isExtraD(D(x))); if (!cs.length || freeM(g, opp(p)) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which monster to your opponent’s field?', cs, 1, 1, 'cost'); if (!x) return;
      if (!ss(g, opp(p), x, 'def')) return;
      const mine = monsOf(g, p).filter(faceUp); if (!mine.length) return;
      const [m] = yield* pick(g, p, `Which monster gains ${lv(x)} Levels?`, mine, 1, 1, 'good'); if (!m) return;
      m.flags.lv = lv(m) + lv(x); m.flags.lvUntil = true; log(g, `${name(m)} is Level ${m.flags.lv} until the End Phase.`); } }] },
  'Gladiator\'s Return': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].gy.filter(isGB).length >= 3,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Shuffle which 3 Gladiator Beast cards into the Deck?', g.p[p].gy.filter(isGB), 3, 3, 'cost'); },
    res: function* (g, c, p, L2) {
      if (L2.t.length < 3 || L2.t.some(x => x.zone !== 'gy')) { log(g, 'A target left the GY, so Gladiator’s Return had no effect.'); return; }
      for (const x of L2.t) toDeck(g, x); shuffleDeck(g, p); log(g, `${PN(g, p)} shuffled ${L2.t.map(x => D(x).n).join(', ')} into the Deck.`);
      draw(g, p, 1); } }] },
  'Glorious Illusion': { effs: [{ type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isLS(x) && canSS(g, p, x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Lightsworn monster?', g.p[p].gy.filter(isLS), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy' || !onField(c)) return; if (ss(g, p, t, 'atk')) link(g, c, t); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Send the top 2 cards to the GY',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) mill(g, p, 2); } }] },

  /* ----- Go ----- */
  // Ruling: it still resolves with 4 cards in hand; the 5-card check is at activation.
  'Goe Goe the Gallant Ninja': { effs: [{ type: 'trig', mand: true, label: 'Opponent discards 2 at random',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl && g.p[ev.p].hand.length >= 5,
    res: function* (g, c, p) { discardRandom(g, opp(p)); discardRandom(g, opp(p)); } }] },
  'Goggle Golem': { self: { atk: (g, c) => c.flags.gemini ? 2100 - num(D(c).atk) : 0 } },
  'Goka, the Pyre of Malice': {
    proc: { label: 'Special Summon (you control a FIRE monster)',
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && attr(x) === 'FIRE'),
      cost: function* (g, c, p, grp) { c.f39goka = grp; } },
    effs: [
      { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a FIRE monster you control',
        on: (g, ev, c) => evSummoned(ev, c, ['special']) && c.f39goka != null && c.f39goka === ev.group,
        cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && attr(x) === 'FIRE'),
        target: function* (g, c, p, L2) { c.f39goka = null; yield* tgt(g, p, L2, 'Destroy which FIRE monster you control?', monsOf(g, p).filter(x => faceUp(x) && attr(x) === 'FIRE'), 1, 1, 'cost'); },
        res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } },
      { type: 'trig', mand: true, tags: { ss: 1 }, label: 'Special Summon a Fireball Token',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
        res: function* (g, c, p) { tokens(g, p, { n: 'Fireball Token', a: 'FIRE', r: 'Pyro', lv: 1, atk: 100, def: 100 }, 1, 'def'); } },
      { type: 'ign', label: 'Tribute a FIRE: +500 ATK',
        cond: (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x) && attr(x) === 'FIRE'),
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which FIRE monster?', monsOf(g, p).filter(x => x !== c && faceUp(x) && attr(x) === 'FIRE'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
        res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500, end: true }); log(g, `${name(c)} gained 500 ATK.`); } } }] },
  // Only when an opponent's card effect discards it: Special Summon it, then destroy up to 2 targeted cards.
  'Goldd, Wu-Lord of Dark World': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1, destroy: 1 }, label: 'Special Summon it and destroy up to 2 cards',
    on: (g, ev, c) => dwDiscard(g, ev, c) && byOpp(g, ev, c),
    cond: (g, c, p) => freeM(g, p) >= 0,
    target: function* (g, c, p, L2) { const cs = L.fieldOf(g, opp(p)); if (cs.length) yield* tgt(g, p, L2, 'Destroy up to 2 of their cards (you can pick none)', cs, 0, 2, 'bad'); },
    res: function* (g, c, p, L2) { if (c.zone !== 'gy' || !ss(g, p, c, 'atk')) return; const ts = live(L2); if (ts.length) destroy(g, ts, { by: p, src: c }); } }] },
  'Gonogo': { effs: [{ type: 'trig', mand: true, label: 'Turn the monster face-down',
    on: (g, ev, c) => { if (ev.type !== 'dsEnd' || !(ev.a === c || ev.t === c)) return false; const o = ev.a === c ? ev.t : ev.a; return !!o && onField(o) && o.zone === 'm' && o.ctrl !== c.ctrl && faceUp(o); },
    res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; if (o && onField(o) && o.zone === 'm' && faceUp(o)) setFaceDown(g, o); } }] },
  // Each player keeps 1 Attribute of face-up monsters. Summons of a monster with another Attribute are blocked; a monster that
  // still arrives with the wrong Attribute (flipped face-up, several at once) is destroyed.
  // PARTIAL: a Tribute Summon is allowed whenever the monster needs Tributes; a face-down Special Summon with the wrong Attribute
  // is blocked; control changes are not checked; the later destruction uses a chain link.
  'Gozen Match': {
    cont: { forbid: (g, src, a) => {
      if (!['ns', 'ss'].includes(a.type) || !a.c || !a.c.id) return false;
      const at = attr(a.c); const mine = monsOf(g, a.p).filter(x => faceUp(x) && x !== a.c); if (!mine.length || mine.every(x => attr(x) === at)) return false;
      if (a.type === 'ns' && lv(a.c) >= 5) return false;
      return true; } },
    effs: [{ type: 'act',
      res: function* (g, c, p) {
        for (const q of [p, opp(p)]) {
          const ms = monsOf(g, q).filter(faceUp); const ats = [...new Set(ms.map(attr))]; if (ats.length < 2) continue;
          const i = yield* choose(g, q, 'Gozen Match: keep which Attribute?', ats); const keep = ats[i];
          const out = ms.filter(x => attr(x) !== keep); const grp = g.group;
          for (const x of out) move(g, x, 'gy', { reason: 'effect', by: p, group: grp });
          log(g, `${PN(g, q)} kept ${keep} monsters and sent ${out.map(x => D(x).n).join(', ')} to the GY.`);
        } } },
      { type: 'trig', loc: 'st', mand: true, label: 'Destroy monsters with the wrong Attribute',
        on: (g, ev, c) => wrongAttr(g, ev).length > 0,
        res: function* (g, c, p, L2) { const xs = wrongAttr(g, L2.ev); if (xs.length) destroy(g, xs, { rule: true }); } }] },
  'Gragonith, Lightsworn Dragon': {
    self: { piercing: true, atk: (g, c) => 300 * new Set(g.p[c.ctrl].gy.filter(isLS).map(x => D(x).n)).size, def: (g, c) => 300 * new Set(g.p[c.ctrl].gy.filter(isLS).map(x => D(x).n)).size },
    effs: [{ type: 'trig', mand: true, label: 'Send the top 3 cards to the GY',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) mill(g, p, 3); } }] },

  /* ----- Gr ----- */
  'Grand Convergence': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => stOf(g, p).some(x => faceUp(x) && named(x, 'Macro Cosmos')),
    res: function* (g, c, p) { damage(g, opp(p), 300, { src: c, srcP: p }); destroy(g, fieldMons(g), { by: p, src: c }); } }] },
  // The selected monster can't attack or be Tributed while this card stays face-up.
  // PARTIAL: Tributes for a card's cost (scripts that pick from the field) are not blocked, only Tribute Summons.
  'Grapple Blocker': {
    cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && src.flags.f39gt === a.c.u },
    effs: [
      { type: 'trig', when: true, label: 'Lock a monster',
        on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
        cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster can’t attack or be Tributed?', monsOf(g, opp(p)), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !onField(c) || !faceUp(c)) return; c.flags.f39gt = t.u; t.flags.noTribute = true; t.flags.f39gb = c.u; log(g, `${face(g, t)} can't attack or be Tributed while Grapple Blocker is face-up.`); } },
      { type: 'trig', mand: true, label: 'Pay 500 LP or destroy it',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
        res: function* (g, c, p) { if (!onField(c) || !faceUp(c)) return; const canPay = g.p[p].lp > 500; const i = canPay ? yield* choose(g, p, 'Grapple Blocker: pay 500 LP or destroy it?', ['Pay 500 LP', 'Destroy Grapple Blocker']) : 1; if (i === 0) pay(g, p, 500); else destroy(g, [c], { by: p }); } },
      // the lock ends when this card leaves the field or is turned face-down
      { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { for (const m of fieldMons(g)) if (m.flags.f39gb === c.u && !(faceUp(c) && c.zone === 'm' && c.flags.f39gt === m.u)) { delete m.flags.f39gb; delete m.flags.noTribute; } return false; } }] },
  'Grass Phantom': { self: { atk: (g, c) => 500 * g.p[c.ctrl].gy.filter(x => named(x, 'Grass Phantom')).length } },
  'Grasschopper': { self: {
    maxAttacks: (g, c) => { if (!c.flags.gemini) return 1; const hit = hitThisTurn(g, c); const rest = monsOf(g, opp(c.ctrl)).filter(m => !hit.has(m.u)).length; return c.attacks + (rest || (c.attacks ? 0 : 1)); },
    attackOk: (g, c, t) => !c.flags.gemini || !hitThisTurn(g, c).has(t.u) } },
  'Gravi-Crush Dragon': { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Send a Continuous Spell: destroy a monster',
    cond: (g, c, p) => stOf(g, p).some(x => faceUp(x) && isSpell(x) && D(x).sub === 'Continuous') && monsOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which face-up Continuous Spell to the GY?', stOf(g, p).filter(x => faceUp(x) && isSpell(x) && D(x).sub === 'Continuous'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Gravitic Orb': { effs: [flip('Change their monsters’ positions', {
    res: function* (g, c, p) { const ms = oppFaceUp(g, p); for (const m of ms) flipPos(g, m); } })] },
  'Gravity Behemoth': {
    self: { tributes: (g, c, p) => g.turnNo > 1 && allField(g).length === 0 ? [0] : [] },
    effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Destroy all Field Spells',
      cond: (g, c) => !c.attacks && !!(g.p[0].fz || g.p[1].fz),
      after: (g, c) => { addRule(g, (g2, a) => a.type === 'attack' && a.c === c, { end: g.turnNo }); log(g, `${name(c)} can't attack this turn.`); },
      res: function* (g, c, p) { destroy(g, [g.p[0].fz, g.p[1].fz].filter(Boolean), { by: p, src: c }); } }] },
  // From the hand or the GY, when a face-up Beast you control is destroyed and sent to the GY (not in the Damage Step).
  'Green Baboon, Defender of the Forest': { effs: ['hand', 'gy'].map(loc => ({ type: 'trig', loc, when: true, tags: { ss: 1 }, label: 'Pay 1000 LP: Special Summon it',
    on: (g, ev, c) => ev.type === 'move' && ev.destroyed && ev.wasField && ev.to === 'gy' && ev.c.zone === 'gy' && !ev.battle && !g.inDS && ev.snap && ev.snap.faceUp && ev.snap.mon && ev.snap.race === 'Beast' && ev.prevCtrl === c.owner,
    cond: (g, c, p) => g.p[p].lp > 1000 && freeM(g, p) >= 0,
    cost: function* (g, c, p) { pay(g, p, 1000); },
    res: function* (g, c, p) { if (['hand', 'gy'].includes(c.zone)) ss(g, p, c, 'atk'); } })) },
  'Gren, Tactician of Dark World': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy a Spell/Trap',
    on: (g, ev, c) => dwDiscard(g, ev, c),
    cond: g => stOnField(g).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOnField(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  // Special Summoned from the hand to the opponent's field by summoning 2 Grinder Tokens on your side. The first Token comes as
  // the cost; the card then lands on your side and moves across as the summon happens, and the second Token takes its zone.
  // PARTIAL: the summon is shown on your side first, and only the first Token is part of the summon window.
  'Grinder Golem': {
    proc: { label: 'Special Summon to the opponent’s field (2 Grinder Tokens)',
      cond: (g, c, p) => nFreeM(g, p) >= 2 && freeM(g, opp(p)) >= 0 && g.ns[p] === 0,
      cost: function* (g, c, p, grp) {
        tokens(g, p, { n: 'Grinder Token', a: 'DARK', r: 'Fiend', lv: 1, atk: 0, def: 0 }, 1, 'atk');
        c.f39proc = grp; c.f39gg = p;
        addRule(g, (g2, a) => ['ns', 'set'].includes(a.type) && a.p === p, { end: g.turnNo }); log(g, `${PN(g, p)} can't Normal Summon or Set this turn.`); } },
    effs: [lockInstall, nomiMark,
      { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
        if (c.f39gg == null) return false;
        const p = c.f39gg;
        if (ev.type === 'summon' && ev.cs.includes(c)) { c.f39gg = null; if (onField(c) && c.ctrl === p && freeM(g, opp(p)) >= 0) takeControl(g, opp(p), c, false); token(g, p, { n: 'Grinder Token', a: 'DARK', r: 'Fiend', lv: 1, atk: 0, def: 0 }, 'atk'); log(g, `${PN(g, p)} Special Summoned a Grinder Token.`); }
        else if (ev.type === 'move' && ev.c === c && ev.wasField) { c.f39gg = null; token(g, p, { n: 'Grinder Token', a: 'DARK', r: 'Fiend', lv: 1, atk: 0, def: 0 }, 'atk'); log(g, `${PN(g, p)} Special Summoned a Grinder Token.`); }
        return false; } }] },
  'Ground Spider': { effs: [{ type: 'trig', opt: true, label: 'Change the summoned monsters to Defense Position',
    on: (g, ev, c) => ev.type === 'summon' && ev.p !== c.ctrl && ev.how !== 'flip' && c.pos === 'def' && !g.inDS && ev.cs.some(x => onField(x) && x.zone === 'm' && x.pos === 'atk'),
    res: function* (g, c, p, L2) { for (const x of L2.ev.cs) toDef(g, x); } }] },
  'Guard Dog': { effs: [flip('Opponent can’t Special Summon this turn', {
    res: function* (g, c, p) { const o = opp(p); addRule(g, (g2, a) => a.type === 'ss' && a.p === o, { end: g.turnNo }); log(g, `${PN(g, o)} can't Special Summon for the rest of this turn.`); } })] },
  // Draw 1 the first time the selected monster is changed to Defense Position this turn.
  // PARTIAL: the draw is a chain link of its own and comes after the chain (a monster turned face-down by Book of Moon is seen
  // at the next game event).
  'Guard Penalty': { effs: [{ type: 'act',
      cond: g => fieldMons(g).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which monster?', fieldMons(g), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; (g.f39gp || (g.f39gp = [])).push({ src: c.u, u: t.u, p, last: t.pos, turn: g.turnNo }); log(g, `If ${face(g, t)} is changed to Defense Position this turn, ${PN(g, p)} draws 1 card.`); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Draw 1 card',
      on: (g, ev, c) => {
        if (!g.f39gp) return false;
        for (const e of g.f39gp) {
          if (e.src !== c.u || e.done) continue;
          if (e.turn !== g.turnNo) { e.done = true; continue; }
          const m = fieldMons(g).find(x => x.u === e.u); if (!m) { e.done = true; continue; }
          if (e.last === 'atk' && (m.pos === 'def' || m.pos === 'set')) { e.done = true; c.f39gpP = e.p; return true; }
          e.last = m.pos;
        }
        return false; },
      res: function* (g, c) { const p = c.f39gpP; if (p == null) return; c.f39gpP = null; draw(g, p, 1); } }] },
  'Gundari': { effs: [lockInstall, spiritReturn,
    { type: 'trig', mand: true, label: 'Return both monsters to the hand',
      on: (g, ev, c) => { if (ev.type !== 'dsStart' || !(ev.a === c || ev.t === c)) return false; const o = ev.a === c ? ev.t : ev.a; return !!o && D(o).k === 'synchro'; },
      res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; const xs = [c, o].filter(x => x && onField(x) && x.zone === 'm'); const grp = g.group;
        for (const x of xs) move(g, x, 'hand', { reason: 'effect', by: p, group: grp }); if (xs.length) log(g, `${xs.map(x => D(x).n).join(' and ')} returned to the hand.`); } }] },
  // Once per turn it isn't destroyed by battle (applied automatically, the first time it would be).
  'Gyroid': { self: { replaceDestroy: (g, c, o) => { if (!o.battle || c.flags.f39gyro === g.turnNo) return false; c.flags.f39gyro = g.turnNo; log(g, 'Gyroid was not destroyed by battle.'); return true; } } },

  /* ----- Ha ----- */
  // The Battle Phase ends, or their monsters' ATK is halved until the end of the Battle Phase: the opponent chooses.
  'Half or Nothing': { effs: [{ type: 'act',
      cond: (g, c, p) => g.phase === 'battle' && g.tp !== p && !g.inDS,
      res: function* (g, c, p) {
        const o = opp(p); const ms = monsOf(g, o).filter(faceUp);
        const i = ms.length ? yield* choose(g, o, 'Half or Nothing: choose one', ['Halve the ATK of all your monsters', 'End the Battle Phase']) : 1;
        if (i === 1) { endBattle(g); return; }
        for (const m of ms) { const A = ATK(g, m); addMod(g, m, { atk: -(A - Math.floor(A / 2)), end: true, f39hon: true }); }
        log(g, `${PN(g, o)}'s monsters had their ATK halved until the end of the Battle Phase.`); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { if (ev.type === 'phase' && ev.ph === 'bpEnd') for (const m of fieldMons(g)) if (m.mods.some(x => x.f39hon)) m.mods = m.mods.filter(x => !x.f39hon); return false; } }] },
  // PARTIAL: face-down monsters can still be attacked while it is in Defense Position (ENGINE: no attack-target rule for them).
  'Hamon, Lord of Striking Thunder': {
    proc: { label: 'Special Summon (send 3 Continuous Spells)',
      cond: (g, c, p) => stOf(g, p).filter(x => faceUp(x) && isSpell(x) && D(x).sub === 'Continuous').length >= 3,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Send which 3 face-up Continuous Spells to the GY?', stOf(g, p).filter(x => faceUp(x) && isSpell(x) && D(x).sub === 'Continuous'), 3, 3, 'cost');
        for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} sent ${xs.map(x => D(x).n).join(', ')} to the GY.`); } },
    cont: { grant: (g, src, m, flag) => flag === 'noAttackTarget' && src.pos === 'def' && m !== src && m.zone === 'm' && m.ctrl === src.ctrl && !negd(g, src) },
    effs: [lockInstall,
      { type: 'trig', mand: true, label: '1000 damage', on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
        res: function* (g, c, p) { damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },
  // Not a cost: each player sends 2 cards from the hand, then draws 2.
  'Hand Destruction': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].hand.filter(x => x !== c).length >= 2 && g.p[opp(p)].hand.length >= 2 && g.p[0].deck.length >= 2 && g.p[1].deck.length >= 2,
    res: function* (g, c, p) {
      if (g.p[p].hand.length < 2 || g.p[opp(p)].hand.length < 2) { log(g, 'A player had fewer than 2 cards in hand, so nothing happened.'); return; }
      const picks = [];
      for (const q of [p, opp(p)]) picks.push([q, yield* pick(g, q, 'Send 2 cards from your hand to the GY', g.p[q].hand, 2, 2, 'cost')]);
      const grp = g.group;
      for (const [q, xs] of picks) { for (const x of xs) move(g, x, 'gy', { reason: 'effect', by: p, group: grp }); log(g, `${PN(g, q)} sent ${xs.map(name).join(' and ')} to the GY.`); }
      draw(g, p, 2); draw(g, opp(p), 2); } }] },
  // Destroyed by an attacking monster: it becomes an Equip Card on that monster (-1800 ATK); when that monster is destroyed and
  // this card goes to the GY, it can come back.
  'Handcuffs Dragon': {
    cont: { atk: (g, src, m) => src.zone === 'st' && src.equipTo === m.u ? -1800 : 0 },
    effs: [
      { type: 'trig', loc: 'gy', when: true, label: 'Equip it to the attacker',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy' && ev.killer && ev.killer.ctrl !== c.owner && !!g.battle && g.battle.a === ev.killer,
        cond: (g, c, p, x) => freeST(g, p) >= 0 && onField(x.ev.killer) && faceUp(x.ev.killer),
        res: function* (g, c, p, L2) { const k = L2.ev.killer; if (c.zone !== 'gy' || !onField(k) || !faceUp(k) || k.zone !== 'm' || freeST(g, p) < 0) return;
          move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p }); c.equipTo = k.u; c.f39eq = k.u; c.f39hd = null; log(g, `Handcuffs Dragon was equipped to ${name(k)} (-1800 ATK).`); } },
      { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c.u === c.f39eq && ev.wasField && ev.destroyed) c.f39hd = ev.group; return false; } },
      { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon it',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'st' && ev.to === 'gy' && c.f39hd != null && c.f39hd === ev.group,
        cond: (g, c, p) => freeM(g, p) >= 0,
        res: function* (g, c, p) { c.f39hd = null; if (c.zone === 'gy') ss(g, p, c, 'atk'); } }] },
  // No effect damage to its controller this turn. The lock lives on the card in the GY.
  // PARTIAL: if this card leaves the GY that turn, the effect stops.
  'Hanewata': {
    cont: { loc: 'gy', dmg: (g, src, p, n, o) => { if (o.battle || !g.f39hane || g.f39hane[p] !== g.turnNo || n <= 0) return undefined; log(g, `${PN(g, p)} took no effect damage.`); return 0; } },
    effs: [{ type: 'quick', loc: 'hand', label: 'Discard: no effect damage this turn',
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded Hanewata.`); },
      res: function* (g, c, p) { g.f39hane = g.f39hane || {}; g.f39hane[p] = g.turnNo; log(g, `${PN(g, p)} takes no effect damage this turn.`); } }] },
  // Port of classic-3.js (Edison text: only a Normal Summon places the counter).
  'Hannibal Necromancer': { effs: [
    { type: 'trig', mand: true, label: 'Place a Spell Counter', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
      res: function* (g, c) { if (onField(c) && ctr(c, 'spell') < 1) { addCtr(g, c, 'spell', 1); log(g, `${name(c)} got a Spell Counter.`); } } },
    { type: 'ign', tags: { destroy: 1 }, label: 'Remove a counter: destroy a Trap',
      cond: (g, c) => ctr(c, 'spell') >= 1 && allField(g).some(x => x.zone === 'st' && isTrap(x) && faceUp(x)),
      cost: function* (g, c) { addCtr(g, c, 'spell', -1); log(g, `${name(c)} removed its Spell Counter.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up Trap?', allField(g).filter(x => x.zone === 'st' && isTrap(x) && faceUp(x)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Hard-sellin\' Goblin': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', mand: true, label: 'Return a Spell/Trap to the hand',
      on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.p !== c.ctrl && ev.src && ev.src.ctrl === c.ctrl && onField(ev.src),
      cond: (g, c, p) => g.p[opp(p)].st.some(Boolean),
      res: function* (g, c, p) { const cs = g.p[opp(p)].st.filter(Boolean); if (!cs.length) return; const [x] = yield* pick(g, p, 'Return which card to its owner’s hand?', cs, 1, 1, 'bad'); if (x) { move(g, x, 'hand', { reason: 'effect', by: p }); log(g, `${D(x).n} returned to the hand.`); } } }] },
  'Hard-sellin\' Zombie': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', mand: true, label: 'Return a card from their GY to the Deck',
      on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.p !== c.ctrl && ev.src && ev.src.ctrl === c.ctrl && onField(ev.src),
      cond: (g, c, p) => g.p[opp(p)].gy.length > 0,
      res: function* (g, c, p) { const cs = g.p[opp(p)].gy; if (!cs.length) return; const [x] = yield* pick(g, p, 'Return which card to the bottom of their Deck?', cs, 1, 1, 'bad'); if (x) { toBottom(g, x); log(g, `${D(x).n} went to the bottom of the Deck.`); } } }] },
  'Harvest Angel of Wisdom': { effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Add a Counter Trap',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => g.p[p].gy.some(x => isTrap(x) && D(x).sub === 'Counter'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Counter Trap to your hand?', g.p[p].gy.filter(x => isTrap(x) && D(x).sub === 'Counter'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },
  'Hate Buster': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!(g.aw && g.aw.t && g.aw.a && g.aw.a.ctrl !== p && g.aw.t.ctrl === p && faceUp(g.aw.t) && race(g.aw.t) === 'Fiend'),
    target: function* (g, c, p, L2) { L2.t = [g.aw.a, g.aw.t]; },
    res: function* (g, c, p, L2) {
      const [a, t] = L2.t; const xs = [a, t].filter(x => x && onField(x)); const tok = a && D(a).k === 'token';
      const out = destroy(g, xs, { by: p, src: c });
      if (out.includes(a) && out.includes(t) && !tok) damage(g, opp(p), num(D(a).atk), { src: c, srcP: p }); } }] },
  'Healing Wave Generator': { effs: [{ type: 'ign', opt: true, label: 'Gain LP (Level x 100)',
    cond: (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Gain LP equal to which monster’s Level x 100?', monsOf(g, p).filter(x => x !== c && faceUp(x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) gain(g, p, 100 * lv(t)); } }] },
  'Hecatrice': { effs: [{ type: 'ign', loc: 'hand', label: 'Discard: add Valhalla',
    cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'Valhalla, Hall of the Fallen')),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded Hecatrice.`); },
    res: function* (g, c, p) { yield* search(g, p, x => named(x, 'Valhalla, Hall of the Fallen'), 'Add Valhalla, Hall of the Fallen'); } }] },
  'Herald of Creation': { effs: [{ type: 'ign', opt: true, label: 'Discard: add a Level 7+ monster',
    cond: (g, c, p) => g.p[p].hand.length > 0 && g.p[p].gy.some(x => isMon(x) && lv(x) >= 7),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Level 7 or higher monster?', g.p[p].gy.filter(x => isMon(x) && lv(x) >= 7), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },
  'Herald of Green Light': { effs: [{ type: 'quick', loc: 'hand', ds: true, label: 'Negate the Spell',
    cond: (g, c, p, x) => !!x.top && spellTrapAct(x.top) && isSpell(x.top.c) && !x.top.negated && x.top.p !== p && g.p[p].hand.some(y => y !== c && isMon(y) && race(y) === 'Fairy'),
    cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; const [x] = yield* pick(g, p, 'Send which other Fairy to the GY?', g.p[p].hand.filter(y => y !== c && isMon(y) && race(y) === 'Fairy'), 1, 1, 'cost');
      const grp = g.group; move(g, c, 'gy', { reason: 'cost', group: grp }); if (x) move(g, x, 'gy', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} sent Herald of Green Light${x ? ' and ' + D(x).n : ''} to the GY.`); },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  'Herculean Power': { effs: [{ type: 'act', res: noop },
    { type: 'ign', loc: 'st', opt: true, tags: { ss: 1 }, label: 'Special Summon a Gemini',
      cond: (g, c, p) => monsOf(g, p).length === 0 && monsOf(g, opp(p)).length > 0 && freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && isGemini(x) && lv(x) <= 4 && canSS(g, p, x)),
      res: function* (g, c, p) {
        if (monsOf(g, p).length || !monsOf(g, opp(p)).length) { log(g, 'The conditions no longer held, so nothing was summoned.'); return; }
        const cs = g.p[p].hand.filter(x => isMon(x) && isGemini(x) && lv(x) <= 4); const [x] = yield* pick(g, p, 'Special Summon which Gemini monster?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  'HERO\'s Bond': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => fieldMons(g).some(x => faceUp(x) && L.isHERO(x)) && nFreeM(g, p) >= 2 && g.p[p].hand.filter(x => isMon(x) && L.isEHERO(x) && lv(x) <= 4 && canSS(g, p, x)).length >= 2,
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isMon(x) && /^Elemental HERO/.test(D(x).n) && lv(x) <= 4); if (cs.length < 2 || nFreeM(g, p) < 2) return;
      const xs = yield* pick(g, p, 'Special Summon which 2 Elemental HEROes?', cs, 2, 2, 'good'); for (const x of xs) ss(g, p, x, 'atk'); } }] },
  'Hero\'s Rule 2': { effs: [{ type: 'act',
    cond: (g, c, p, x) => !!x.top && !x.top.negated && (x.top.t || []).some(t => t && t.zone === 'gy'),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  'Hidden Soldiers': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => !!g.sw && g.sw.p !== p && ['normal', 'tribute', 'flip', 'gemini'].includes(g.sw.how) && freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && lv(x) <= 4 && attr(x) === 'DARK' && canSS(g, p, x)),
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isMon(x) && lv(x) <= 4 && attr(x) === 'DARK'); if (!cs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon which DARK monster?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  // Its Token goes to the opponent's side. When that Token is destroyed by battle with a Plant, its controller sends 1 card from the
  // hand to the GY. PARTIAL: that send is a chain link (it should not start a chain).
  'Horseytail': { effs: [
    { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Horseytail Token to the opponent',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
      cond: (g, c, p) => freeM(g, opp(p)) >= 0,
      res: function* (g, c, p) { tokens(g, opp(p), { n: 'Horseytail Token', a: 'WIND', r: 'Plant', lv: 1, atk: 0, def: 0 }, 1, 'def'); } },
    { type: 'trig', loc: 'any', mand: true, label: 'The Token’s controller sends 1 card to the GY',
      on: (g, ev, c) => {
        if (!(ev.type === 'move' && ev.to === 'gone' && ev.battle && ev.destroyed && D(ev.c).n === 'Horseytail Token' && ev.killer && race(ev.killer) === 'Plant')) return false;
        g.f39ht = g.f39ht || {}; if (g.f39ht[ev.seq]) return false; g.f39ht[ev.seq] = true; c.f39htP = ev.prevCtrl; return true; },
      res: function* (g, c) { const q = c.f39htP; c.f39htP = null; if (q == null || !g.p[q].hand.length) return; const [x] = yield* pick(g, q, 'Send 1 card from your hand to the GY', g.p[q].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'effect' }); log(g, `${PN(g, q)} sent ${name(x)} from the hand to the GY.`); } } }] },
  'Hunter Owl': { self: {
    atk: (g, c) => 500 * monsOf(g, c.ctrl).filter(x => faceUp(x) && attr(x) === 'WIND').length,
    noAttackTarget: (g, c) => monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && attr(x) === 'WIND') } },
  'Hunting Instinct': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => !!g.sw && !g.inDS && isSpecialHow(g.sw.how) && g.sw.cs.some(x => onField(x) && x.ctrl !== p) && freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Dinosaur' && canSS(g, p, x)),
    res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Dinosaur'); if (!cs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon which Dinosaur?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  /* ----- Hy ----- */
  // Up to 3 attacks; each attack declaration Tributes 1 Aqua monster (as classic-3.js's tributeToAttack, the Tribute is the cost
  // of the attack). With no Aqua to Tribute it can't attack.
  'Hydra Viper': {
    self: { maxAttacks: () => 3, cantAttack: (g, c) => !monsOf(g, c.ctrl).some(x => x !== c && race(x) === 'Aqua') },
    effs: [{ type: 'trig', mand: true, label: 'Tribute 1 Aqua monster to attack', on: (g, ev, c) => ev.type === 'attack' && ev.a === c,
      cost: function* (g, c, p) {
        const cs = monsOf(g, p).filter(x => x !== c && race(x) === 'Aqua'); if (!cs.length) return;
        const [x] = yield* pick(g, p, 'Tribute 1 Aqua monster to attack with Hydra Viper', cs, 1, 1, 'cost');
        if (x) { const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${nm} to attack.`); } },
      res: noop }] },
  'Hydro Pressure Cannon': {
    effs: [equipAct(m => lv(m) <= 3 && attr(m) === 'WATER', 'Equip to which Level 3 or lower WATER monster?'),
      { type: 'trig', loc: 'st', mand: true, label: 'Send a random card from their hand to the GY',
        on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer && ev.killer.u === c.equipTo && ev.prevCtrl !== ev.killer.ctrl,
        cond: (g, c, p) => g.p[opp(p)].hand.length > 0,
        res: function* (g, c, p) { discardRandom(g, opp(p), 'effect'); } }] },
  'Hydrogeddon': { effs: [{ type: 'trig', tags: { ss: 1 }, label: 'Special Summon a Hydrogeddon',
    on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => named(x, 'Hydrogeddon') && canSS(g, p, x)),
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => named(x, 'Hydrogeddon')); if (!cs.length || freeM(g, p) < 0) { shuffleDeck(g, p); return; } ss(g, p, cs[0], 'atk'); shuffleDeck(g, p); } }] },
  // The monsters it summons are destroyed when it leaves the field (rule-style, right after it leaves).
  'Hysteric Party': { effs: [{ type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => g.p[p].hand.some(x => x !== c) && freeM(g, p) >= 0 && g.p[p].gy.some(x => isHarpieLady(x) && canSS(g, p, x)),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand.filter(x => x !== c), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
      res: function* (g, c, p) {
        const out = [];
        for (const x of g.p[p].gy.filter(isHarpieLady)) { if (freeM(g, p) < 0) break; if (ss(g, p, x, 'atk')) out.push(x.u); }
        if (onField(c)) c.flags.f39hp = out; } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.faceUp && ev.snap.flags && ev.snap.flags.f39hp) {
        for (const m of fieldMons(g)) if (ev.snap.flags.f39hp.includes(m.u)) g.laterDestroy.push(m); }
      return false; } }] },

  /* ----- I ----- */
  'Ice Master': {
    proc: { label: 'Special Summon (Tribute 2 WATER monsters)',
      cond: (g, c, p) => monsOf(g, p).filter(x => attr(x) === 'WATER').length >= 2,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Tribute which 2 WATER monsters?', monsOf(g, p).filter(x => attr(x) === 'WATER'), 2, 2, 'cost');
        for (const x of xs) move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${xs.map(x => D(x).n).join(' and ')}.`); } },
    effs: [
      { type: 'ign', opt: true, label: 'Place an Ice Counter',
        cond: g => fieldMons(g).some(faceUp),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Place an Ice Counter on which monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addCtr(g, t, 'ice', 1); log(g, `${name(t)} got an Ice Counter.`); } } },
      { type: 'ign', tags: { destroy: 1 }, label: 'Tribute: destroy monsters with Ice Counters',
        cond: (g, c) => fieldMons(g).some(x => x !== c && ctr(x, 'ice') > 0),
        cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Ice Master.`); },
        res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => ctr(x, 'ice') > 0), { by: p }); } }] },
  'Ice Queen': { cont: noSSFromGY, effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Add a Spell from your GY',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy' && ev.snap && ev.snap.faceUp && ev.prevCtrl === c.owner,
    cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && race(x) === 'Spellcaster').length >= 3 && g.p[p].gy.some(isSpell),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Spell to your hand?', g.p[p].gy.filter(isSpell), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { if (g.p[p].gy.filter(x => isMon(x) && race(x) === 'Spellcaster').length < 3) { log(g, 'Ice Queen needs 3 Spellcasters in the GY to resolve.'); return; }
      const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },
  // ENGINE: Flip Summons can't be forbidden, so "You can't Summon monsters" doesn't stop them.
  'Ido the Supreme Magical Force': {
    cont: { forbid: (g, src, a) => ['ns', 'set', 'ss'].includes(a.type) && a.p === src.ctrl },
    effs: [
      { type: 'trig', loc: 'gy', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !ev.battle && ev.to === 'gy') c.f39ido = g.turnNo + 1; return false; } },
      { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1, destroy: 1 }, label: 'Special Summon it and destroy your other monsters',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && c.f39ido === g.turnNo,
        res: function* (g, c, p) { c.f39ido = null; if (c.zone !== 'gy') return; const others = monsOf(g, p).slice(); if (!ss(g, p, c, 'atk')) return; destroy(g, others, { by: p, src: c }); } }] },
  'Il Blud': { effs: [
    { type: 'ign', opt: true, gemini: true, tags: { ss: 1 }, label: 'Special Summon a Zombie',
      cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...allCards(g, 'gy')].some(x => isMon(x) && race(x) === 'Zombie' && canSS(g, p, x)),
      res: function* (g, c, p) {
        const cs = [...g.p[p].hand, ...allCards(g, 'gy')].filter(x => isMon(x) && race(x) === 'Zombie'); if (!cs.length || freeM(g, p) < 0) return;
        const [x] = yield* pick(g, p, 'Special Summon which Zombie from your hand or either GY?', cs, 1, 1, 'good');
        if (x && ss(g, p, x, 'atk') && onField(c)) (c.flags.f39blud || (c.flags.f39blud = [])).push(x.u); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.flags && ev.snap.flags.f39blud) for (const m of fieldMons(g)) if (ev.snap.flags.f39blud.includes(m.u) && race(m) === 'Zombie') g.laterDestroy.push(m);
      return false; } }] },
  'Immortal Ruler': { effs: [lockInstall,
    { type: 'ign', label: 'Tribute: add Zombie World',
      cond: (g, c, p) => g.p[p].gy.some(x => named(x, 'Zombie World')),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Immortal Ruler.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Zombie World?', g.p[p].gy.filter(x => named(x, 'Zombie World')), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added Zombie World to the hand.`); } } }] },
  'Imprisoned Queen Archfiend': { effs: [archCost(1000),
    { type: 'trig', loc: 'gy', mand: true, label: 'A Level 4 or lower Fiend gains 1000 ATK',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner,
      cond: g => allField(g).some(x => faceUp(x) && named(x, 'Pandemonium')) && fieldMons(g).some(x => faceUp(x) && race(x) === 'Fiend' && lv(x) <= 4),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Level 4 or lower Fiend gains 1000 ATK?', fieldMons(g).filter(x => faceUp(x) && race(x) === 'Fiend' && lv(x) <= 4), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { if (c.zone !== 'gy' || !allField(g).some(x => faceUp(x) && named(x, 'Pandemonium'))) return; const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: 1000, end: true }); log(g, `${name(t)} gained 1000 ATK.`); } } }] },
});

// Gozen Match: monsters that just arrived face-up with an Attribute their controller already has none of.
function wrongAttr(g, ev) {
  let news = [];
  if (ev.type === 'summon') news = ev.cs; else if (ev.type === 'flip') news = [ev.c]; else return [];
  news = news.filter(x => onField(x) && x.zone === 'm' && faceUp(x)); if (!news.length) return [];
  const out = [];
  for (const q of [0, 1]) {
    const mine = monsOf(g, q).filter(faceUp); const arrived = news.filter(x => x.ctrl === q); if (!arrived.length) continue;
    const old = mine.filter(x => !arrived.includes(x)); const keep = old.length ? attr(old[0]) : attr(arrived[0]);
    for (const x of arrived) if (attr(x) !== keep) out.push(x);
  }
  return out;
}
})();
