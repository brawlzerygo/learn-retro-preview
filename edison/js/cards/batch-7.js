/* Batch 7: X-Saber, Monster Mash, Morphtronic, Ojama, Psychic, Relinquished, Six Samurai, Spaceship, Uria.
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, setFaceDown, negate, addMod,
  equip, equippedTo, link, addCtr, ctr, negateAttack, endBattle, addRule, token, tokens, fusionSummon, canFusion, ritualSummon, canRitual,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned,
  fromFieldToGY, battleKill, isGemini, synCombos, negd, num } = L;
const atk = L.atk, def = L.def;

/* ----- small helpers for this batch ----- */
const isMorph = c => /Morphtronic/.test(name(c));
const morphMon = c => isMon(c) && isMorph(c);
const isOjama = c => /Ojama/.test(name(c));
const sixSam = c => isMon(c) && /Six Samurai/.test(name(c));
const xSaber = c => isMon(c) && /X-Saber/.test(name(c));
const otherSam = (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x) && sixSam(x) && name(x) !== name(c));
const lightMach = c => isMon(c) && attr(c) === 'LIGHT' && race(c) === 'Machine';
const isEquipSpell = c => isSpell(c) && D(c).sub === 'Equip';
const isRitualSpell = c => isSpell(c) && D(c).sub === 'Ritual';
// "If this card destroys an opponent's monster by battle" (no "and sends it to the GY")
const killedByBattle = (ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.prevCtrl !== c.owner;
// a Spell/Trap card or monster that can't be Special Summoned: blocks revival from the GY
const noSSFromGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src };
// Synchro Summon with a material rule the engine's text reader can't parse ("non-Tuner Psychics")
function synProc(nonOk) {
  const combos = (g, p, c) => synCombos(g, p, c).filter(m => m.filter(x => !D(x).tu).every(nonOk));
  return { extra: true, how: 'synchro', label: 'Synchro Summon',
    cond: (g, c, p) => combos(g, p, c).length > 0,
    cost: function* (g, c, p, grp) { const cs = combos(g, p, c); let mats = cs[0]; if (cs.length > 1) { const i = yield* choose(g, p, `Synchro Summon ${name(c)} with which monsters?`, cs.map(m => m.map(name).join(' + '))); mats = cs[i]; }
      for (const m of mats) move(g, m, 'gy', { reason: 'synchro', by: p, group: grp }); log(g, `${PN(g, p)} sent ${mats.map(m => D(m).n).join(' + ')} to the GY for a Synchro Summon.`); } };
}
// Trap Monsters: the card moves to a Monster Zone and gets its monster stats
function trapMonster(g, c, p, st) {
  if (!onField(c) || freeM(g, p) < 0) return false;
  if (!ss(g, p, c, 'def')) return false;
  c.flags.baseAtk = st.atk; c.flags.lv = st.lv; c.flags.trapMon = true; addMod(g, c, { set: st.def, which: 'def' });
  return true;
}
// would this monster lose the battle now? (used before the destruction is applied)
function losesBattle(g, c, a, t) {
  if (!t) return false;
  if (c === a) { if (t.pos !== 'atk') return false; const A = atk(g, a), T = atk(g, t); return T > A || (T === A && (A > 0 || T === 0)); }
  if (c === t) { const A = atk(g, a); if (t.pos === 'atk') { const T = atk(g, t); return A > T || (A === T && (A > 0 || T === 0)); } return A > def(g, t); }
  return false;
}
// counters stored in flags, so they can be read from the move event's snapshot after the card left the field
const bushido = (g, p) => stOf(g, p).reduce((s, x) => s + (faceUp(x) && x.flags.bushido || 0), 0);
function removeBushido(g, p, n) { for (const x of stOf(g, p)) { if (!n) break; const k = Math.min(n, x.flags.bushido || 0); if (k) { x.flags.bushido -= k; n -= k; } } }
const isShienEff = c => isMon(c) && /Shien/.test(name(c)) && D(c).k === 'effect';
// cards whose effects negate Trap effects (Double Snare)
const NEG_TRAP = ['Jinzo', 'Royal Decree', 'Tyrant Dragon', 'Sorcerer of Dark Magic', 'Fiend Skull Dragon', "The Dragon's Bead", 'Jinzo - Returner'];
// Spells/Traps that destroy without targeting (Fake Trap, Morphtronic Forcefield)
const ST_WIPE = ['Heavy Storm', "Harpie's Feather Duster"];
const MON_WIPE = ['Dark Hole', 'Raigeki', 'Torrential Tribute', 'Lightning Vortex', 'Mirror Force', 'Offerings to the Doomed', 'Fissure'];
// cards whose activation targets a card in the GY (The End of Anubis)
const GY_TARGET = ['Monster Reborn', 'Call of the Haunted', 'Premature Burial', 'Dark Grepher', 'Symbols of Duty', 'Magician of Faith', 'Pot of Avarice', 'Return of the Doomed'];

const relEq = (g, c) => onField(c) ? g.p[c.ctrl].st.find(x => x && x.equipTo === c.u && isMon(x)) || null : null;
const birPool = (g, p) => [...g.p[p].hand.filter(x => isMon(x) && D(x).n !== 'Relinquished' && lv(x) >= 1), ...monsOf(g, p).filter(x => lv(x) >= 1),
  ...g.p[p].gy.filter(x => D(x).n === 'Djinn Releaser of Rituals')];
const poleTop = g => { const ms = fieldMons(g).filter(faceUp); if (!ms.length) return []; const hi = Math.max(...ms.map(x => atk(g, x))); return ms.filter(x => atk(g, x) === hi); };
const areaB = g => { const ch = fieldMons(g).filter(x => x.pos === 'atk' && lv(x) >= 4); for (const x of ch) x.pos = 'def'; return ch; };

E.addScripts({
  /* ----- Monster Mash ----- */
  'Gallis the Star Beast': { effs: [{ type: 'ign', loc: 'hand', tags: { ss: 1 }, label: 'Reveal: send the top card',
    cond: (g, c, p) => g.p[p].deck.length > 0 && freeM(g, p) >= 0,
    cost: function* (g, c, p) { log(g, `${PN(g, p)} revealed Gallis the Star Beast.`); },
    res: function* (g, c, p) {
      const [x] = mill(g, p, 1); if (!x) return;
      if (isMon(x)) { damage(g, opp(p), lv(x) * 200, { src: c, srcP: p }); if (c.zone === 'hand') ss(g, p, c); }
      else if (c.zone === 'hand') { move(g, c, 'gy', { reason: 'effect', destroyed: true, by: p }); log(g, 'Gallis the Star Beast was destroyed.'); } } }] },
  'Magical Merchant': { effs: [{ type: 'trig', faceDownOk: true, mand: true, on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) {
      const deck = g.p[p].deck; let i = deck.length - 1; while (i >= 0 && !isST(deck[i])) i--;
      if (i < 0) { shuffleDeck(g, p); log(g, `${PN(g, p)} found no Spell or Trap and shuffled the Deck.`); return; }
      const st = deck[i], rest = deck.slice(i + 1);
      move(g, st, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(st)} to the hand.`);
      for (const x of rest) move(g, x, 'gy', { reason: 'effect' }); if (rest.length) log(g, `${PN(g, p)} sent ${rest.length} card(s) from the Deck to the GY.`); } }] },
  'Witch of the Black Rose': { cont: noSSFromGY, // PARTIAL: "Cannot be Special Summoned" is enforced from the GY only
    effs: [{ type: 'trig', mand: true, on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
      cond: (g, c, p) => fieldOf(g, p).every(x => x === c),
      res: function* (g, c, p) { const before = g.p[p].hand.length; draw(g, p, 1); const x = g.p[p].hand.length > before ? g.p[p].hand[g.p[p].hand.length - 1] : null; if (!x) return;
        log(g, `${PN(g, p)} showed ${name(x)}.`); if (isMon(x)) return;
        move(g, x, 'gy', { reason: 'effect' }); if (onField(c)) destroy(g, [c], { by: p }); } }] },
  'Darklord Zerato': { // ENGINE: the 1-Tribute summon (4+ DARKs with different names in the GY) needs a hook in tribNeed; it Tribute Summons with 2 here
    effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Send a DARK: destroy their monsters',
      cond: (g, c, p) => g.p[p].hand.some(x => isMon(x) && attr(x) === 'DARK') && monsOf(g, opp(p)).length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send a DARK monster from your hand to the GY', g.p[p].hand.filter(x => isMon(x) && attr(x) === 'DARK'), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); c.flags.zerato = g.turnNo; },
      res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)), { by: p }); } },
    { type: 'trig', mand: true, opt: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.zerato === g.turnNo,
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  'The End of Anubis': { effs: [], // PARTIAL: blocks activations from the GY and of cards that target the GY; Trigger Effects that start in the GY (Sangan) are not stopped
    cont: { forbid: (g, src, a) => a.type === 'activate' && (a.c.zone === 'gy' || a.eff.loc === 'gy' || GY_TARGET.includes(D(a.c).n)) } },

  /* ----- Morphtronic ----- */
  'Morphtronic Boarden': { effs: [], cont: { grant: (g, src, c, flag) => c.ctrl === src.ctrl && c.zone === 'm' && morphMon(c) &&
    ((flag === 'directAttack' && src.pos === 'atk') || (flag === 'noBattleDestroy' && src.pos === 'def' && c !== src)) } },
  'Morphtronic Boomboxen': { effs: [
    { type: 'trig', on: (g, ev, c) => { if (ev.type === 'attack' && ev.a === c && c.pos === 'atk') c.flags.extraAttack = g.turnNo; return false; }, res: function* () {} },
    { type: 'trig', when: true, opt: true, label: 'Negate the attack',
      on: (g, ev, c) => ev.type === 'attack' && c.pos === 'def' && ev.t && ev.t.ctrl === c.ctrl && faceUp(ev.t) && morphMon(ev.t),
      res: function* (g, c, p) { negateAttack(g); } }] },
  'Morphtronic Celfon': { effs: [
    { type: 'ign', opt: true, tags: { ss: 1 }, label: 'Roll a die: summon a Morphtronic',
      cond: (g, c, p) => c.pos === 'atk' && freeM(g, p) >= 0 && g.p[p].deck.some(x => morphMon(x) && lv(x) <= 4),
      res: function* (g, c, p) { const n = 1 + Math.floor(g.rnd() * 6); log(g, `${PN(g, p)} rolled a ${n}.`);
        const top = g.p[p].deck.slice(-n), cands = top.filter(x => morphMon(x) && lv(x) <= 4);
        if (cands.length && freeM(g, p) >= 0) { const [x] = yield* pick(g, p, 'Special Summon which Morphtronic?', cands, 1, 1, 'good'); if (x) ss(g, p, x); }
        shuffleDeck(g, p); } },
    { type: 'ign', opt: true, label: 'Roll a die: look at the top cards', cond: (g, c, p) => c.pos === 'def' && g.p[p].deck.length > 0,
      res: function* (g, c, p) { const n = 1 + Math.floor(g.rnd() * 6); log(g, `${PN(g, p)} rolled a ${n} and looked at the top ${Math.min(n, g.p[p].deck.length)} card(s) of the Deck.`); } }] },
  'Morphtronic Radion': { effs: [], cont: {
    atk: (g, src, c) => src.pos === 'atk' && c.ctrl === src.ctrl && morphMon(c) ? 800 : 0,
    def: (g, src, c) => src.pos === 'def' && c.ctrl === src.ctrl && morphMon(c) ? 1000 : 0 } },
  'Morphtronic Remoten': { effs: [
    { type: 'ign', opt: true, label: 'Banish a Morphtronic: search the same Level',
      cond: (g, c, p) => c.pos === 'atk' && g.p[p].gy.some(x => morphMon(x) && g.p[p].deck.some(y => morphMon(y) && lv(y) === lv(x))),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Target a Morphtronic in your GY', g.p[p].gy.filter(x => morphMon(x) && g.p[p].deck.some(y => morphMon(y) && lv(y) === lv(x))), 1, 1, 'cost'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (!t || t.zone !== 'gy') return; const n = lv(t); move(g, t, 'ban', { reason: 'effect' }); log(g, `${PN(g, p)} banished ${name(t)}.`);
        yield* search(g, p, x => morphMon(x) && lv(x) === n, `Add a Level ${n} Morphtronic monster`); } },
    { type: 'ign', opt: true, label: 'Send a Morphtronic: add one from the GY',
      cond: (g, c, p) => c.pos === 'def' && g.p[p].hand.some(x => morphMon(x) && g.p[p].gy.some(y => morphMon(y) && lv(y) === lv(x))),
      res: function* (g, c, p) { const hs = g.p[p].hand.filter(x => morphMon(x) && g.p[p].gy.some(y => morphMon(y) && lv(y) === lv(x))); if (!hs.length) return;
        const [x] = yield* pick(g, p, 'Send which Morphtronic from your hand to the GY?', hs, 1, 1, 'cost'); move(g, x, 'gy', { reason: 'effect' });
        const gs = g.p[p].gy.filter(y => y !== x && morphMon(y) && lv(y) === lv(x)); if (!gs.length) return;
        const [y] = yield* pick(g, p, 'Add which Morphtronic from your GY?', gs, 1, 1, 'good'); move(g, y, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(y)} to the hand.`); } }] },
  'Morphtronic Scopen': { effs: [
    { type: 'ign', opt: true, tags: { ss: 1 }, label: 'Summon a Level 4 Morphtronic',
      cond: (g, c, p) => c.pos === 'atk' && freeM(g, p) >= 0 && g.p[p].hand.some(x => morphMon(x) && lv(x) === 4),
      res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => morphMon(x) && lv(x) === 4); if (!cs.length) return; const [x] = yield* pick(g, p, 'Special Summon which Morphtronic?', cs, 1, 1, 'good');
        if (x && ss(g, p, x)) { x.flags.scopenBy = c.u; x.flags.scopenT = g.turnNo; } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(x => x.flags.scopenBy === c.u && x.flags.scopenT === g.turnNo),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x.flags.scopenBy === c.u && x.flags.scopenT === g.turnNo), { by: p }); } },
    // PARTIAL: the Level 4 in face-up Defense Position is refreshed on every game event; a plain position change shows it at the next event
    { type: 'trig', loc: 'any', on: (g, ev, c) => {
      const want = c.zone === 'm' && c.pos === 'def' && !negd(g, c);
      if (want && !c.flags.scopenLv) { c.flags.lv = 4; c.flags.scopenLv = true; } else if (!want && c.flags.scopenLv) { c.flags.lv = null; c.flags.scopenLv = false; }
      return false; }, res: function* () {} }] },
  'Morphtronic Slingen': { // ENGINE: the Defense Position "destroy another Morphtronic instead" needs a destruction replacement hook
    effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Tribute a Morphtronic: destroy a card',
      cond: (g, c, p) => c.pos === 'atk' && monsOf(g, p).some(x => morphMon(x) && D(x).n !== 'Morphtronic Slingen') && allField(g).length > 1,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute a Morphtronic monster', monsOf(g, p).filter(x => morphMon(x) && D(x).n !== 'Morphtronic Slingen'), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
      target: function* (g, c, p, L) { const cs = allField(g); if (cs.length) yield* tgt(g, p, L, 'Destroy which card?', cs, 1, 1, 'bad'); },
      res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'Machine Duplication': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && monsOf(g, p).some(x => faceUp(x) && race(x) === 'Machine' && atk(g, x) <= 500 && g.p[p].deck.some(y => D(y).n === D(x).n)),
    target: function* (g, c, p, L) { const [t] = yield* tgt(g, p, L, 'Target a Machine with 500 or less ATK', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Machine' && atk(g, x) <= 500 && g.p[p].deck.some(y => D(y).n === D(x).n)), 1, 1, 'good'); L.data.n = t && D(t).n; },
    res: function* (g, c, p, L) { const cs = g.p[p].deck.filter(y => D(y).n === L.data.n); const n = Math.min(2, cs.length, nFreeM(g, p)); if (!n) return;
      const xs = yield* pick(g, p, `Special Summon up to ${n} ${L.data.n}`, cs, 1, n, 'good'); for (const x of xs) ss(g, p, x); shuffleDeck(g, p); } }] },
  'Morphtronic Bind': { effs: [{ type: 'act', res: function* () {} }],
    cont: { forbid: (g, src, a) => (a.type === 'attack' || a.type === 'pos') && a.c.ctrl !== src.ctrl && lv(a.c) >= 4 && monsOf(g, src.ctrl).some(x => faceUp(x) && morphMon(x)) } },
  'Reaper on the Nightmare': { // PARTIAL: "destroy this card after an effect that targets it resolves" is hard-coded for Spirit Reaper only (ENGINE: chain resolution hook)
    self: { noBattleDestroy: true, directAttack: true },
    effs: [{ type: 'trig', mand: true, on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.direct && ev.src === c,
      res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, opp(p))} discarded ${name(x)} at random.`); } }] },
  'G.B. Hunter': { effs: [] }, // ENGINE: "cards on the field can't be returned to the Deck" needs a forbid action for moves to the Deck/Extra Deck
  'Morphtronic Forcefield': { effs: [{ type: 'act',
    cond: (g, c, p, x) => { const top = x.top; if (!spellTrapAct(top) || top.negated || !(top.tags && top.tags.destroy)) return false;
      const mine = monsOf(g, p).filter(m => faceUp(m) && morphMon(m)); if (!mine.length) return false;
      if (!g.p[p].deck.some(isMorph)) return false;
      if (top.t.some(t => mine.includes(t))) return true;
      if (top.data && Array.isArray(top.data.cs) && top.data.cs.some(t => mine.includes(t))) return true; // Bottomless Trap Hole style
      const n = D(top.c).n; if (n === 'Mirror Force') return mine.some(m => m.pos === 'atk'); return MON_WIPE.includes(n) && n !== 'Fissure'; },
    target: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L) { L.data.L.negBy = p; negate(g, L.data.L, true); yield* search(g, p, isMorph, 'Add a Morphtronic card'); } }] },

  /* ----- Ojama ----- */
  'Ojama Blue': { effs: [{ type: 'trig', loc: 'gy', when: true, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
    cond: (g, c, p) => g.p[p].deck.filter(isOjama).length >= 2,
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(isOjama); if (cs.length < 2) return; const xs = yield* pick(g, p, 'Add 2 Ojama cards to your hand', cs, 2, 2, 'good');
      for (const x of xs) move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${xs.map(name).join(' and ')} to the hand.`); shuffleDeck(g, p); } }] },
  'Ojamagic': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'gy', mand: true, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && (ev.from === 'hand' || ev.wasField),
      res: function* (g, c, p) { const want = ['Ojama Green', 'Ojama Yellow', 'Ojama Black']; const found = want.map(n => g.p[p].deck.find(x => D(x).n === n));
        if (found.some(x => !x)) { log(g, `${PN(g, p)} didn't have all three Ojamas in the Deck.`); shuffleDeck(g, p); return; }
        if (L.forbid(g, { type: 'search', p })) return;
        for (const x of found) move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added Ojama Green, Ojama Yellow and Ojama Black to the hand.`); shuffleDeck(g, p); } }] },
  'Ojama Country': { // ENGINE: activatable() never looks at the Field Zone, so the Special Summon effect below is never offered
    effs: [{ type: 'act', res: function* () {} },
      { type: 'ign', loc: 'fz', opt: true, tags: { ss: 1 }, label: 'Send an Ojama: revive an Ojama',
        cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(isOjama) && g.p[p].gy.some(x => isMon(x) && isOjama(x)),
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send an Ojama card from your hand to the GY', g.p[p].hand.filter(isOjama), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); },
        target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which Ojama?', g.p[p].gy.filter(x => isMon(x) && isOjama(x)), 1, 1, 'good'); },
        res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy' && onField(c)) ss(g, p, t); } }],
    cont: { // original ATK and DEF switch while you control a face-up Ojama
      atk: (g, src, c) => monsOf(g, src.ctrl).some(x => faceUp(x) && isMon(x) && isOjama(x)) ? num(D(c).def) - baseAtk(c) : 0,
      def: (g, src, c) => monsOf(g, src.ctrl).some(x => faceUp(x) && isMon(x) && isOjama(x)) ? baseAtk(c) - num(D(c).def) : 0 } },
  'Symbols of Duty': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => D(x).k === 'normal') ,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send a Normal Monster you control to the GY', monsOf(g, p).filter(x => D(x).k === 'normal'), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); },
    target: function* (g, c, p, L) { const cs = allCards(g, 'gy').filter(isMon); if (cs.length) yield* tgt(g, p, L, 'Special Summon which monster from either GY?', cs, 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = L.t[0]; if (!t || t.zone !== 'gy' || !onField(c)) return; if (ss(g, p, t) && equip(g, c, t)) link(g, c, t); } }] },
  'Power Tool Dragon': { // ENGINE: "send an equipped Equip Spell instead" needs a destruction replacement hook
    effs: [{ type: 'ign', opt: true, label: 'Reveal 3 Equip Spells',
      cond: (g, c, p) => g.p[p].deck.filter(isEquipSpell).length >= 3 && !L.forbid(g, { type: 'search', p }),
      res: function* (g, c, p) { const cs = g.p[p].deck.filter(isEquipSpell); if (cs.length < 3) return;
        const xs = yield* pick(g, p, 'Reveal 3 Equip Spells from your Deck', cs, 3, 3, 'good'); log(g, `${PN(g, p)} revealed ${xs.map(name).join(', ')}.`);
        const x = xs[Math.floor(g.rnd() * xs.length)]; move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, opp(p))} picked one at random; ${PN(g, p)} added it to the hand.`); shuffleDeck(g, p); } }] },
  'Ojama Knight': { effs: [], mats: [c => isOjama(c), c => isOjama(c)],
    // PARTIAL: modelled as "the opponent can use at most 3 Monster Zones"
    cont: { forbid: (g, src, a) => a.p === opp(src.ctrl) && monsOf(g, a.p).length >= 3 &&
      (((a.type === 'ns' || a.type === 'set') && lv(a.c) <= 4) || (a.type === 'ss' && !['synchro', 'fusion'].includes(a.how))) } },
  'Dragoness the Wicked Knight': { effs: [] },

  /* ----- Psychic ----- */
  'Overdrive Teleporter': { cont: noSSFromGY, // PARTIAL: "Cannot be Special Summoned" is enforced from the GY only
    effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Pay 2000: summon 2 Psychics',
      cond: (g, c, p) => !c.flags.odt && g.p[p].lp > 2000 && nFreeM(g, p) >= 2 && g.p[p].deck.filter(x => isMon(x) && lv(x) === 3 && race(x) === 'Psychic').length >= 2,
      cost: function* (g, c, p) { c.flags.odt = true; pay(g, p, 2000); },
      res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => isMon(x) && lv(x) === 3 && race(x) === 'Psychic'); if (cs.length < 2 || nFreeM(g, p) < 2) return;
        const xs = yield* pick(g, p, 'Special Summon 2 Level 3 Psychics', cs, 2, 2, 'good'); for (const x of xs) ss(g, p, x); shuffleDeck(g, p); } }] },
  'Psychic Commander': { effs: [{ type: 'quick', ds: true, label: 'Pay LP: weaken their monster',
    cond: (g, c, p) => { const b = g.battle; if (!g.inDS || !b || !b.a || !b.t) return false; const mine = [b.a, b.t].find(x => x.ctrl === p && faceUp(x) && race(x) === 'Psychic'); const o = [b.a, b.t].find(x => x.ctrl !== p);
      return mine && o && onField(o) && g.p[p].lp > 100 && c.flags.cmd !== `${g.turnNo}:${b.a.u}:${b.a.attacks}`; },
    cost: function* (g, c, p, L) { const b = g.battle; c.flags.cmd = `${g.turnNo}:${b.a.u}:${b.a.attacks}`; L.data.o = [b.a, b.t].find(x => x.ctrl !== p); L.t = [L.data.o];
      const max = Math.min(5, Math.floor((g.p[p].lp - 1) / 100)); const i = yield* choose(g, p, 'Pay how much LP?', [...Array(max).keys()].map(k => String((k + 1) * 100))); L.data.n = (i + 1) * 100; pay(g, p, L.data.n); },
    res: function* (g, c, p, L) { const o = L.data.o; if (o && onField(o) && faceUp(o)) { addMod(g, o, { atk: -L.data.n, def: -L.data.n, end: true }); log(g, `${name(o)} lost ${L.data.n} ATK and DEF.`); } } }] },
  'Mind Protector': { cont: { forbid: (g, src, a) => a.type === 'attack' && atk(g, a.c) <= 2000 && race(a.c) !== 'Psychic' },
    effs: [{ type: 'trig', mand: true, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 500 && (yield* yn(g, p, 'Pay 500 LP to keep Mind Protector?'))) pay(g, p, 500); else destroy(g, [c], { by: p }); } }] },
  'Level Eater': { // PARTIAL: "can't be Tributed except for a Tribute Summon" is not enforced
    effs: [{ type: 'ign', loc: 'gy', tags: { ss: 1 }, label: 'Lower a Level: Special Summon',
      cond: (g, c, p) => freeM(g, p) >= 0 && monsOf(g, p).some(x => faceUp(x) && lv(x) >= 5),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Lower the Level of which monster?', monsOf(g, p).filter(x => faceUp(x) && lv(x) >= 5), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !faceUp(t) || lv(t) <= 1) return; t.flags.lv = lv(t) - 1; log(g, `${name(t)} is now Level ${lv(t)}.`); if (c.zone === 'gy') ss(g, p, c); } }] },
  'Brain Research Lab': { // ENGINE: activatable() never looks at the Field Zone, so the extra Normal Summon below is never offered
    // PARTIAL: only offered after your Normal Summon; placing a counter instead of paying LP is not automated
    effs: [{ type: 'act', res: function* () {} },
      { type: 'ign', loc: 'fz', opt: true, label: 'Extra Normal Summon of a Psychic',
        cond: (g, c, p) => g.ns[p] >= 1 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Psychic'),
        res: function* (g, c, p) { if (!onField(c)) return; g.ns[p] = 0; c.flags.psy = (c.flags.psy || 0) + 1; const t = g.turnNo;
          addRule(g, (g2, a) => (a.type === 'ns' && a.p === p && race(a.c) !== 'Psychic') || (a.type === 'set' && a.p === p), { end: t });
          log(g, `${PN(g, p)} can Normal Summon a Psychic monster once more this turn. Brain Research Lab has ${c.flags.psy} Psychic Counter(s).`); } },
      { type: 'trig', loc: 'any', mand: true, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.flags && ev.snap.flags.psy > 0,
        res: function* (g, c, p, L) { damage(g, L.ev.prevCtrl, 1000 * L.ev.snap.flags.psy, { src: c, srcP: L.ev.prevCtrl }); } }] },
  'Psychic Lifetrancer': { effs: [{ type: 'ign', opt: true, label: 'Banish a Psychic: gain 1200 LP',
    cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && race(x) === 'Psychic'),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish a Psychic from your GY', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Psychic'), 1, 1, 'cost'); move(g, x, 'ban', { reason: 'cost' }); },
    res: function* (g, c, p) { gain(g, p, 1200); } }] },
  'Hyper Psychic Blaster': { noSynchro: true, proc: synProc(x => race(x) === 'Psychic'), self: { piercing: true },
    effs: [{ type: 'trig', on: (g, ev, c) => { if (ev.type === 'afterCalc' && ev.a === c && ev.t && ev.tWasDef) { const d = onField(ev.t) ? def(g, ev.t) : num(D(ev.t).def); const diff = atk(g, c) - d; c.flags.hpb = diff > 0 ? diff : 0; } return false; }, res: function* () {} },
      { type: 'trig', loc: 'any', mand: true, on: (g, ev, c) => ev.type === 'dsEnd' && ev.a === c && c.flags.hpb > 0,
        res: function* (g, c, p) { const n = c.flags.hpb; c.flags.hpb = 0; gain(g, p, n); } }] },

  /* ----- Relinquished ----- */
  'Relinquished': {
      self: { atk: (g, c) => { const e = relEq(g, c); return e ? num(D(e).atk) : 0; }, def: (g, c) => { const e = relEq(g, c); return e ? num(D(e).def) : 0; },
        noBattleDestroy: (g, c) => !!relEq(g, c) },
      effs: [
        { type: 'ign', opt: true, label: 'Equip a monster',
          cond: (g, c, p) => !relEq(g, c) && freeST(g, p) >= 0 && monsOf(g, opp(p)).length > 0,
          target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Equip which monster to Relinquished?', monsOf(g, opp(p)), 1, 1, 'bad'); },
          res: function* (g, c, p, L) { const t = live(L)[0]; if (!t) return;
            if (!onField(c) || !faceUp(c) || freeST(g, p) < 0 || relEq(g, c)) { move(g, t, 'gy', { reason: 'effect', by: p }); log(g, `${D(t).n} was sent to the GY.`); return; }
            move(g, t, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); t.equipTo = c.u; log(g, `${D(t).n} was equipped to Relinquished.`); } },
        { type: 'trig', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'afterCalc' && (ev.a === c || ev.t === c),
          cond: (g, c, p, x) => !!relEq(g, c) && losesBattle(g, c, x.ev.a, x.ev.t),
          res: function* (g, c, p) { const e = relEq(g, c); if (e) destroy(g, [e], { by: p }); } },
        { type: 'trig', mand: true, on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.p === c.ctrl && g.battle && (g.battle.a === c || g.battle.t === c) && !!relEq(g, c),
          res: function* (g, c, p, L) { damage(g, opp(p), L.ev.n, { src: c, srcP: p }); } }] },
  'Djinn Releaser of Rituals': { // PARTIAL: banishing it from the GY works with Black Illusion Ritual only (the engine's ritualSummon() uses hand and field)
    effs: [{ type: 'trig', loc: 'any', on: (g, ev, c) => {
      if (ev.type === 'move' && ev.c === c && ev.reason === 'ritual') { c.flags.ritGrp = ev.group; c.flags.ritBy = ev.by != null ? ev.by : g.tp; }
      else if (ev.type === 'summon' && ev.how === 'ritual' && c.flags.ritGrp === ev.group && ev.cs[0]) {
        const rm = ev.cs[0], u = rm.u, who = ev.p; c.flags.ritGrp = null;
        addRule(g, (g2, a) => a.type === 'ss' && a.p === 1 - who && fieldMons(g2).some(x => x.u === u && faceUp(x) && x.zone === 'm'));
        log(g, `${PN(g, 1 - who)} can't Special Summon while ${name(rm)} is face-up.`); }
      return false; }, res: function* () {} }] },
  'Manju of the Ten Thousand Hands': { effs: [{ type: 'trig', when: true, on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute', 'flip']),
    cond: (g, c, p) => g.p[p].deck.some(x => D(x).k === 'ritual' || isRitualSpell(x)),
    res: function* (g, c, p) { yield* search(g, p, x => D(x).k === 'ritual' || isRitualSpell(x), 'Add a Ritual Monster or Ritual Spell'); } }] },
  'Black Illusion Ritual': { effs: [{ type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => g.p[p].hand.some(x => D(x).n === 'Relinquished') && birPool(g, p).length > 0 && (freeM(g, p) >= 0 || monsOf(g, p).length > 0),
      res: function* (g, c, p) {
        const rms = g.p[p].hand.filter(x => D(x).n === 'Relinquished'), ps = birPool(g, p); if (!rms.length || !ps.length) return;
        const rm = rms[0]; const [t] = yield* pick(g, p, 'Tribute a monster for Relinquished (Djinn in the GY is banished)', ps, 1, 1, 'cost'); if (!t) return;
        const grp = g.group; move(g, t, t.zone === 'gy' ? 'ban' : 'gy', { reason: 'ritual', by: p, group: grp }); log(g, `${PN(g, p)} ${t.zone === 'ban' ? 'banished' : 'Tributed'} ${D(t).n} for a Ritual Summon.`);
        if (freeM(g, p) < 0 || rm.zone !== 'hand') return; ss(g, p, rm, 'atk', { how: 'ritual', group: grp }); } }] },
  'Preparation of Rites': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.some(x => D(x).k === 'ritual' && lv(x) <= 7),
    res: function* (g, c, p) { const x = yield* search(g, p, x => D(x).k === 'ritual' && lv(x) <= 7, 'Add a Level 7 or lower Ritual Monster'); if (!x) return;
      const rs = g.p[p].gy.filter(isRitualSpell); if (rs.length && (yield* yn(g, p, 'Add a Ritual Spell from your GY?'))) { const [y] = yield* pick(g, p, 'Add which Ritual Spell?', rs, 1, 1, 'good'); move(g, y, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(y)} to the hand.`); } } }] },

  /* ----- Six Samurai ----- ENGINE (Irou, Zanji, Yaichi, Kamon): "destroy another Six Samurai instead" needs a destruction replacement hook */
  'Grandmaster of the Six Samurai': {
    proc: { cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && sixSam(x)) && !monsOf(g, p).some(x => faceUp(x) && D(x).n === 'Grandmaster of the Six Samurai'), label: 'Special Summon (you control a Six Samurai)' },
    cont: { forbid: (g, src, a) => (a.type === 'ns' || a.type === 'ss') && a.p === src.ctrl && a.c !== src && a.c.id && D(a.c) && D(a.c).n === 'Grandmaster of the Six Samurai' },
    effs: [{ type: 'trig', loc: 'any', mand: true, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && !ev.battle && ev.by != null && ev.by !== c.owner,
      cond: (g, c, p) => g.p[p].gy.some(sixSam),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Add which Six Samurai from your GY?', g.p[p].gy.filter(sixSam), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },
  'Hand of the Six Samurai': { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Tribute a Six Samurai: destroy a monster',
    cond: (g, c, p) => monsOf(g, p).some(x => x !== c && sixSam(x)) && fieldMons(g).length >= 2,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute a Six Samurai monster', monsOf(g, p).filter(x => sixSam(x) && faceUp(x)), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
    target: function* (g, c, p, L) { const cs = fieldMons(g); if (cs.length) yield* tgt(g, p, L, 'Destroy which monster?', cs, 1, 1, 'bad'); },
    res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
  'The Six Samurai - Irou': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'dsStart' && ev.a === c && ev.t && ev.t.pos === 'set',
    cond: (g, c, p) => otherSam(g, c, p),
    res: function* (g, c, p, L) { const t = L.ev.t; if (t && onField(t) && otherSam(g, c, p)) destroy(g, [t], { by: p }); } }] },
  'The Six Samurai - Zanji': { effs: [{ type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'dsEnd' && ev.a === c && ev.t && onField(ev.t),
    cond: (g, c, p) => otherSam(g, c, p),
    res: function* (g, c, p, L) { const t = L.ev.t; if (t && onField(t) && otherSam(g, c, p)) destroy(g, [t], { by: p }); } }] },
  'The Six Samurai - Yaichi': { self: { cantAttack: (g, c) => c.flags.yaichi === g.turnNo },
    effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy a Set Spell/Trap',
      cond: (g, c, p) => otherSam(g, c, p) && stOnField(g).some(x => x.pos === 'set'),
      cost: function* (g, c) { c.flags.yaichi = g.turnNo; },
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which Set card?', stOnField(g).filter(x => x.pos === 'set'), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { if (otherSam(g, c, p)) destroy(g, live(L).filter(x => x.pos === 'set'), { by: p }); } }] },
  'The Six Samurai - Kamon': { self: { cantAttack: (g, c) => c.flags.kamon === g.turnNo },
    effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy a face-up Spell/Trap',
      cond: (g, c, p) => otherSam(g, c, p) && stOnField(g).some(faceUp),
      cost: function* (g, c) { c.flags.kamon = g.turnNo; },
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which face-up Spell/Trap?', stOnField(g).filter(faceUp), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { if (otherSam(g, c, p)) destroy(g, live(L).filter(faceUp), { by: p }); } }] },
  'Six Samurai United': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'summon' && faceUp(c) && !['flip', 'gemini'].includes(ev.how) && ev.cs.some(sixSam)) c.flags.bushido = Math.min(2, (c.flags.bushido || 0) + 1); return false; }, res: function* () {} },
    { type: 'ign', loc: 'st', label: 'Send to the GY: draw', cond: (g, c, p) => (c.flags.bushido || 0) > 0,
      cost: function* (g, c, p, L) { L.data.n = c.flags.bushido || 0; move(g, c, 'gy', { reason: 'cost' }); },
      res: function* (g, c, p, L) { draw(g, p, L.data.n); } }] },
  'Gateway of the Six': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'summon' && faceUp(c) && !['flip', 'gemini'].includes(ev.how) && ev.cs.some(sixSam)) c.flags.bushido = (c.flags.bushido || 0) + 2; return false; }, res: function* () {} },
    { type: 'ign', loc: 'st', label: '2 counters: +500 ATK',
      cond: (g, c, p) => bushido(g, p) >= 2 && fieldMons(g).some(x => faceUp(x) && (sixSam(x) || isShienEff(x))),
      cost: function* (g, c, p) { removeBushido(g, p, 2); },
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Which monster gains 500 ATK?', fieldMons(g).filter(x => faceUp(x) && (sixSam(x) || isShienEff(x))), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (t && faceUp(t) && onField(c)) { addMod(g, t, { atk: 500, end: true }); log(g, `${name(t)} gained 500 ATK.`); } } },
    { type: 'ign', loc: 'st', label: '4 counters: add a Six Samurai',
      cond: (g, c, p) => bushido(g, p) >= 4 && [...g.p[p].deck, ...g.p[p].gy].some(sixSam),
      cost: function* (g, c, p) { removeBushido(g, p, 4); },
      res: function* (g, c, p) { if (!onField(c)) return; const cs = [...g.p[p].deck, ...g.p[p].gy].filter(sixSam).filter(x => x.zone === 'gy' || !L.forbid(g, { type: 'search', p })); if (!cs.length) return;
        const [x] = yield* pick(g, p, 'Add a Six Samurai from your Deck or GY', cs, 1, 1, 'good'); const fromDeck = x.zone === 'deck'; move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(x)} to the hand.`); if (fromDeck) shuffleDeck(g, p); } },
    { type: 'ign', loc: 'st', tags: { ss: 1 }, label: '6 counters: revive a Shien',
      cond: (g, c, p) => bushido(g, p) >= 6 && freeM(g, p) >= 0 && g.p[p].gy.some(isShienEff),
      cost: function* (g, c, p) { removeBushido(g, p, 6); },
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which Shien monster?', g.p[p].gy.filter(isShienEff), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy' && onField(c)) ss(g, p, t); } }] },

  /* ----- Spaceship ----- */
  'Blue Thunder T-45': { effs: [{ type: 'trig', loc: 'any', mand: true, tags: { ss: 1 }, on: (g, ev, c) => killedByBattle(ev, c), cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) { const t = token(g, p, { n: 'Thunder Option Token', a: 'LIGHT', r: 'Machine', lv: 4, atk: 1500, def: 1500 }, 'atk', { noTribute: true });
      if (t) { log(g, `${PN(g, p)} Special Summoned a Thunder Option Token.`); const ev = L.emit(g, { type: 'summon', cs: [t], how: 'special', p, byEffect: true }); g.sw = { cs: [t], p, how: 'special', group: ev.group }; } } }] },
  'Falchion Beta': { effs: [{ type: 'trig', loc: 'any', mand: true, on: (g, ev, c) => killedByBattle(ev, c),
    cond: (g, c, p) => g.p[p].deck.some(x => lightMach(x) && baseAtk(x) <= 1200) || (freeM(g, p) >= 0 && g.p[p].gy.some(x => lightMach(x) && baseAtk(x) <= 1200)),
    target: function* (g, c, p, L) { const canA = g.p[p].deck.some(x => lightMach(x) && baseAtk(x) <= 1200), canB = freeM(g, p) >= 0 && g.p[p].gy.some(x => lightMach(x) && baseAtk(x) <= 1200);
      L.data.mode = canA && canB ? yield* choose(g, p, 'Falchion Beta: choose an effect', ['Send a LIGHT Machine from the Deck to the GY', 'Special Summon a LIGHT Machine from the GY']) : canA ? 0 : 1;
      if (L.data.mode === 1) { L.tags = { ss: 1 }; yield* tgt(g, p, L, 'Special Summon which LIGHT Machine?', g.p[p].gy.filter(x => lightMach(x) && baseAtk(x) <= 1200), 1, 1, 'good'); } },
    res: function* (g, c, p, L) { if (L.data.mode === 0) yield* search(g, p, x => lightMach(x) && baseAtk(x) <= 1200, 'Send a LIGHT Machine with 1200 or less ATK to the GY', 'gy');
      else { const t = L.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } } }] },
  'Jade Knight': { cont: { grant: (g, src, c, flag) => flag === 'unaffectedTraps' && src.pos === 'atk' && c.ctrl === src.ctrl && c.zone === 'm' && faceUp(c) && race(c) === 'Machine' && atk(g, c) <= 1200 },
    // PARTIAL: the protection is "unaffected by Trap destruction" (destroy() checks it for face-up cards)
    effs: [{ type: 'trig', on: (g, ev, c) => { if (ev.type === 'attack' && (ev.t === c || ev.a === c)) c.flags.jkUp = faceUp(c); return false; }, res: function* () {} },
      { type: 'trig', loc: 'gy', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy' && ev.snap && ev.snap.flags && ev.snap.flags.jkUp,
        cond: (g, c, p) => g.p[p].deck.some(x => lightMach(x) && lv(x) === 4),
        res: function* (g, c, p) { yield* search(g, p, x => lightMach(x) && lv(x) === 4, 'Add a Level 4 LIGHT Machine'); } }] },
  'Lord British Space Fighter': { effs: [{ type: 'trig', loc: 'any', mand: true, on: (g, ev, c) => killedByBattle(ev, c),
    target: function* (g, c, p, L) {
      const opts = [], labels = [];
      if (onField(c) && c.flags.lbAgain !== g.turnNo) { opts.push(0); labels.push('Attack again'); }
      if (allField(g).some(x => x.pos === 'set')) { opts.push(1); labels.push('Destroy a Set card'); }
      if (freeM(g, p) >= 0) { opts.push(2); labels.push('Special Summon a Multi Token'); }
      if (!opts.length) { L.data.mode = -1; return; }
      L.data.mode = opts.length > 1 ? opts[yield* choose(g, p, 'Lord British Space Fighter: choose an effect', labels)] : opts[0];
      if (L.data.mode === 0) c.flags.lbAgain = g.turnNo;
      if (L.data.mode === 1) { L.tags = { destroy: 1 }; yield* tgt(g, p, L, 'Destroy which Set card?', allField(g).filter(x => x.pos === 'set'), 1, 1, 'bad'); }
      if (L.data.mode === 2) L.tags = { ss: 1 }; },
    res: function* (g, c, p, L) {
      if (L.data.mode === 0 && onField(c)) { c.flags.extraAttack = g.turnNo; log(g, 'Lord British Space Fighter can attack again.'); }
      if (L.data.mode === 1) destroy(g, live(L).filter(x => x.pos === 'set'), { by: p });
      if (L.data.mode === 2) tokens(g, p, { n: 'Multi Token', a: 'LIGHT', r: 'Machine', lv: 4, atk: 1200, def: 1200 }, 1, 'atk'); } }] },
  'Creature Swap': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).length > 0 && monsOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { const o = opp(p); if (!monsOf(g, p).length || !monsOf(g, o).length) return;
      const [a] = yield* pick(g, p, 'Give which of your monsters?', monsOf(g, p), 1, 1, 'cost');
      const [b] = yield* pick(g, o, 'Give which of your monsters?', monsOf(g, o), 1, 1, 'cost');
      if (!a || !b || !onField(a) || !onField(b)) return;
      const ia = g.p[p].m.indexOf(a), ib = g.p[o].m.indexOf(b); g.p[p].m[ia] = b; g.p[o].m[ib] = a; a.ctrl = o; b.ctrl = p;
      for (const x of [a, b]) { x.flags.ctrlUntil = null; x.flags.ctrlFrom = null; x.posChanged = true; }
      log(g, `${PN(g, p)} and ${PN(g, o)} switched control of ${L.shown(g, a)} and ${L.shown(g, b)}.`); } }] },
  'Rush Recklessly': { effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Which monster gains 700 ATK?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (t && faceUp(t)) { addMod(g, t, { atk: 700, end: true }); log(g, `${name(t)} gained 700 ATK.`); } } }] },
  'Macro Cosmos': { // ENGINE: "any card sent to the GY is banished instead" needs a hook in move()
    effs: [{ type: 'act', res: function* (g, c, p) {
      const hs = [...g.p[p].hand, ...g.p[p].deck].filter(x => D(x).n === 'Helios - The Primordial Sun');
      if (!hs.length || freeM(g, p) < 0 || !(yield* yn(g, p, 'Special Summon Helios - The Primordial Sun?'))) return;
      const [x] = yield* pick(g, p, 'Special Summon which Helios?', hs, 1, 1, 'good'); const fromDeck = x.zone === 'deck'; ss(g, p, x); if (fromDeck) shuffleDeck(g, p); } }] },

  /* ----- Uria ----- */
  'Des Lacooda': { effs: [
    { type: 'ign', opt: true, label: 'Turn face-down', cond: (g, c, p) => c.turnIn !== g.turnNo && !c.posChanged,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { setFaceDown(g, c); c.posChanged = true; } } },
    { type: 'trig', mand: true, on: (g, ev, c) => evSummoned(ev, c, ['flip']), res: function* (g, c, p) { draw(g, p, 1); } }] },
  'Mage Power': { effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Equip Mage Power to which monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = live(L)[0]; if (t && faceUp(t)) equip(g, c, t); } }],
    cont: { atk: (g, src, m) => src.equipTo === m.u ? 500 * stOf(g, src.ctrl).length : 0, def: (g, src, m) => src.equipTo === m.u ? 500 * stOf(g, src.ctrl).length : 0 } },
  'Gravity Bind': { effs: [{ type: 'act', res: function* (g) { if (g.aw && g.aw.a && lv(g.aw.a) >= 4) negateAttack(g); } }],
    cont: { forbid: (g, src, a) => a.type === 'attack' && lv(a.c) >= 4 } },
  'Metal Reflect Slime': { // PARTIAL: as a monster it has no Type/Attribute and its Spell/Trap Zone is freed
    self: { cantAttack: true },
    effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { trapMonster(g, c, p, { atk: 0, def: 3000, lv: 10 }); } }] },
  'Nightmare Wheel': { cont: { forbid: (g, src, a) => (a.type === 'attack' || a.type === 'pos') && a.c.u === src.flags.wheel },
    effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Target which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L) { const t = live(L)[0]; if (!t || !onField(c)) return; c.flags.wheel = t.u; log(g, `Nightmare Wheel holds ${t.pos === 'set' ? 'a face-down monster' : name(t)}.`); if (g.aw && g.aw.a === t) negateAttack(g); } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => faceUp(c) && c.flags.wheel && ev.type === 'move' && ev.c.u === c.flags.wheel && ev.wasField && ev.to !== 'm',
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } },
    { type: 'trig', loc: 'st', mand: true, opt: true, on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && faceUp(c) && c.flags.wheel && fieldMons(g).some(x => x.u === c.flags.wheel),
      res: function* (g, c, p) { if (onField(c) && fieldMons(g).some(x => x.u === c.flags.wheel)) damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  'Pole Position': { // PARTIAL: the highest-ATK monster ignores Spell destruction only; Spell ATK changes still apply
      cont: { grant: (g, src, c, flag) => flag === 'unaffectedSpells' && c.zone === 'm' && faceUp(c) && poleTop(g).includes(c) },
      effs: [{ type: 'act', res: function* () {} },
        { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.faceUp,
          res: function* (g, c, p) { destroy(g, poleTop(g), { by: p }); } }] },
  'Zoma the Spirit': { // PARTIAL: as a monster it has no Type/Attribute and its Spell/Trap Zone is freed
    effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { trapMonster(g, c, p, { atk: 1800, def: 500, lv: 4 }); } },
    { type: 'trig', loc: 'any', mand: true, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.snap && ev.snap.flags && ev.snap.flags.trapMon && ev.killer,
      res: function* (g, c, p, L) { const k = L.ev.killer; const n = onField(k) ? atk(g, k) : baseAtk(k); damage(g, opp(L.ev.prevCtrl), n, { src: c, srcP: L.ev.prevCtrl }); } }] },
  'Double Snare': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => allField(g).some(x => faceUp(x) && NEG_TRAP.includes(D(x).n)),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy which card?', allField(g).filter(x => faceUp(x) && NEG_TRAP.includes(D(x).n)), 1, 1, 'bad'); },
    res: function* (g, c, p, L) { destroy(g, live(L).filter(faceUp), { by: p }); } }] },
  'Cloak and Dagger': { effs: [{ type: 'act', res: function* (g, c, p) {
      if (!onField(c)) return; const o = opp(p), P = g.p[o];
      const ns = [...new Set([...P.deck, ...P.hand, ...P.gy, ...P.ban, ...P.extra, ...monsOf(g, o)].filter(isMon).map(x => D(x).n))].sort().slice(0, 40);
      if (!ns.length) return; const i = yield* choose(g, p, 'Declare a monster card name', ns); c.flags.cad = ns[i]; log(g, `${PN(g, p)} declared ${ns[i]}.`); } },
    { type: 'trig', loc: 'st', mand: true, on: (g, ev, c) => faceUp(c) && c.flags.cad && ((ev.type === 'summon' && ev.p !== c.ctrl && ev.cs.some(x => D(x).n === c.flags.cad)) || (ev.type === 'flip' && ev.c.ctrl !== c.ctrl && D(ev.c).n === c.flags.cad)),
      res: function* (g, c, p, L) { const cs = (L.ev.cs || [L.ev.c]).filter(x => onField(x) && D(x).n === c.flags.cad);
        for (const x of cs) move(g, x, 'ban', { reason: 'effect', by: p }); if (onField(c)) move(g, c, 'ban', { reason: 'effect' }); log(g, `${[...cs.map(x => D(x).n), 'Cloak and Dagger'].join(', ')} ${cs.length ? 'were' : 'was'} banished.`); } }] },
  'Fake Trap': { effs: [{ type: 'act',
    cond: (g, c, p, x) => { const top = x.top; if (!top || top.p === p || top.negated || !(top.tags && top.tags.destroy)) return false;
      const mine = stOf(g, p).filter(t => t !== c && isTrap(t)); if (!mine.length) return false;
      return top.t.some(t => mine.includes(t)) || ST_WIPE.includes(D(top.c).n); },
    target: function* (g, c, p, L) { L.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L) {
      const L2 = L.data.L, prot = stOf(g, p).filter(t => t !== c && isTrap(t) && t.zone === 'st'); if (!prot.length) return;
      L2.t = L2.t.filter(t => !prot.includes(t));
      const orig = L2.eff; // the traps are out of reach while that effect resolves
      L2.eff = { ...orig, res: function* (g2, c2, p2, LL) {
        const saved = []; for (const t of prot) if (t.zone === 'st') { const a = g.p[t.ctrl].st, i = a.indexOf(t); if (i >= 0) { a[i] = null; saved.push([t, i]); } }
        try { yield* orig.res(g2, c2, p2, LL); } finally { for (const [t, i] of saved) { const a = g.p[t.ctrl].st; if (!a[i]) a[i] = t; else { const j = a.findIndex(z => !z); if (j >= 0) a[j] = t; else move(g, t, 'gy', { reason: 'rule' }); } } } } };
      if (onField(c)) destroy(g, [c], { by: p }); log(g, `${PN(g, p)}'s Trap Cards are protected.`); } }] },

  /* ----- X-Saber ----- */
  'XX-Saber Emmersblade': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => xSaber(x) && lv(x) <= 4),
    res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => xSaber(x) && lv(x) <= 4); if (!cs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon an X-Saber from your Deck', cs, 1, 1, 'good'); if (x) ss(g, p, x); shuffleDeck(g, p); } }] },
  'XX-Saber Fulhelmknight': { effs: [
    { type: 'trig', label: 'Negate the attack', on: (g, ev, c) => ev.type === 'attack' && ev.p !== c.ctrl && !c.flags.fulUsed,
      cost: function* (g, c, p, L) { c.flags.fulUsed = true; L.t = [g.aw && g.aw.a].filter(Boolean); },
      res: function* (g, c, p) { negateAttack(g); } },
    { type: 'trig', loc: 'any', tags: { ss: 1 }, on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.snap && ev.snap.pos !== 'atk',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => xSaber(x) && lv(x) <= 4),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which X-Saber?', g.p[p].gy.filter(x => xSaber(x) && lv(x) <= 4), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  'X-Saber Galahad': { self: { atk: (g, c) => { const b = g.battle; if (!g.inDS || !b) return 0; if (b.a === c && b.t) return 300; if (b.t === c && b.a && b.a.ctrl !== c.ctrl) return -500; return 0; } },
    effs: [{ type: 'trig', label: 'Tribute a Saber: negate the attack', on: (g, ev, c) => ev.type === 'attack' && ev.t === c,
      cond: (g, c, p) => monsOf(g, p).some(x => x !== c && isMon(x) && /Saber/.test(name(x))),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute a Saber monster', monsOf(g, p).filter(x => x !== c && isMon(x) && /Saber/.test(name(x))), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
      res: function* (g) { negateAttack(g); } }] },
  'XX-Saber Ragigura': { effs: [{ type: 'trig', when: true, on: (g, ev, c) => evSummoned(ev, c) && !['flip', 'gemini'].includes(ev.how),
    cond: (g, c, p) => g.p[p].gy.some(xSaber),
    target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Add which X-Saber from your GY?', g.p[p].gy.filter(xSaber), 1, 1, 'good'); },
    res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },
  'Level Limit - Area B': { // PARTIAL: positions are fixed at each game event; a monster can't be changed back to Attack Position
      cont: { forbid: (g, src, a) => a.type === 'pos' && a.c.pos === 'def' && lv(a.c) >= 4 },
      effs: [{ type: 'act', res: function* (g, c) { const ch = areaB(g); if (ch.length) log(g, `${ch.map(name).join(', ')} changed to Defense Position.`); } },
        { type: 'trig', loc: 'st', on: (g, ev, c) => { if (faceUp(c)) areaB(g); return false; }, res: function* () {} }] },
  'XX-Saber Faultroll': { cont: noSSFromGY,
    proc: { cond: (g, c, p) => monsOf(g, p).filter(x => faceUp(x) && xSaber(x)).length >= 2, label: 'Special Summon (you control 2 X-Sabers)' },
    effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Revive a Level 4 or lower X-Saber',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => xSaber(x) && lv(x) <= 4),
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Special Summon which X-Saber?', g.p[p].gy.filter(x => xSaber(x) && lv(x) <= 4), 1, 1, 'good'); },
      res: function* (g, c, p, L) { const t = L.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  'XX-Saber Hyunlei': { noSynchro: true, proc: synProc(xSaber),
    effs: [{ type: 'trig', when: true, tags: { destroy: 1 }, on: (g, ev, c) => evSummoned(ev, c, ['synchro']), cond: g => stOnField(g).length > 0,
      target: function* (g, c, p, L) { yield* tgt(g, p, L, 'Destroy up to 3 Spells/Traps', stOnField(g), 1, 3, 'bad'); },
      res: function* (g, c, p, L) { destroy(g, live(L), { by: p }); } }] },
});
// ENGINE: activatable() reads SC(x).effs.some(...) for every face-up Spell/Trap-zone card; a monster equipped by Relinquished
// (or Destiny HERO - Plasma) whose script has no effs (Cyber Dragon) crashed it. Give every script an effs list.
for (const k in E.SCRIPTS) if (E.SCRIPTS[k] && !E.SCRIPTS[k].effs) E.SCRIPTS[k].effs = [];
})();
