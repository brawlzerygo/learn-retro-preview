/* Classic 2: Duelist Kingdom and Battle City effect monsters (build/classic_batch_2.json).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md), registered for Goat only (E.addScripts(obj, 'goat')),
 written from each card's text in the batch file and played by Goat rules. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, search, addMod, addRule, name, D, isMon, isSpell, isTrap,
  onField, faceUp, race, baseAtk, monsOf, stOf, allField, fieldMons, freeM, freeST, shuffleDeck, log, PN, live, opp,
  oppFaceUp, stat, num, forbid, winDuel, coin } = L;

const named = (c, n) => D(c).n === n;
const ATK = (g, c) => stat(g, c, 'atk');
// "Must first be Special Summoned (by its own way)": once it has come out from the hand or Deck, it can be revived later.
// The mark (c.nomi) stays on the card object, so it lasts through the GY. Until then it can't be Special Summoned from the GY.
const nomiLock = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src && !src.nomi };
const nomiMark = { type: 'trig', on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.to === 'm' && ['hand', 'deck'].includes(ev.from)) c.nomi = true; return false; }, res: function* () {} };
// "by an effect of a card controlled by your opponent": the move's own `by` when the effect gave one, else the turn player.
// PARTIAL: most discard and mill helpers don't pass `by`, so an effect without it counts as the turn player's.
const byOpp = (g, ev, c) => ev.by != null ? ev.by !== c.owner : g.tp !== c.owner;
// Flip effect shape
const flip = (label, more) => ({ type: 'trig', mand: true, faceDownOk: true, label, on: (g, ev, c) => ev.type === 'flip' && ev.c === c, ...more });
// Kazejin, Sanga, Suijin: the attacker's ATK becomes 0 for this damage calculation, once while face-up.
// PARTIAL: the engine has no window during damage calculation, so it is used in the Damage Step windows of the battle;
// the 0 lasts until damage calculation is done (removed at afterCalc).
const guardian = [
  { type: 'quick', ds: true, label: 'Make the attacker’s ATK 0',
    cond: (g, c, p) => g.inDS && g.battle && g.battle.t === c && g.tp !== c.ctrl && !c.flags.guardUsed && g.battle.a && onField(g.battle.a) && !g.battle.a.mods.some(m => m.guardZero),
    target: function* (g, c, p, L2) { L2.t = [g.battle.a]; },
    after: (g, c) => { c.flags.guardUsed = true; },
    res: function* (g, c, p, L2) { const a = live(L2)[0]; if (!a || a.zone !== 'm' || !g.battle) return; addMod(g, a, { set: 0, which: 'atk', end: true, guardZero: true }); g.seq++; log(g, `${name(a)}'s ATK became 0 for damage calculation.`); } },
  { type: 'trig', on: (g, ev) => { if ((ev.type === 'afterCalc' || ev.type === 'dsEnd') && ev.a && ev.a.mods.some(m => m.guardZero)) { ev.a.mods = ev.a.mods.filter(m => !m.guardZero); g.seq++; } return false; }, res: function* () {} },
];
// Metalzoa and Red-Eyes Black Metal Dragon: Tribute the base monster equipped with Metalmorph, Special Summon from the Deck.
// ENGINE: no idle action for an inherent Special Summon from the Deck. PARTIAL: it is offered as an optional trigger from the
// Deck, at your Standby Phase, the end of your Battle Phase, and the first game event of each of your Main Phases while the
// equipped monster is there.
const metalBase = (g, p, base) => monsOf(g, p).find(m => faceUp(m) && name(m) === base && allField(g).some(s => named(s, 'Metalmorph') && faceUp(s) && s.equipTo === m.u));
const metalSummon = base => ({ type: 'trig', loc: 'deck', tags: { ss: 1 }, label: `Tribute ${base}: Special Summon from the Deck`,
  on: (g, ev, c) => {
    if (g.tp !== c.owner || !metalBase(g, c.owner, base)) return false;
    if (ev.type === 'phase' && (ev.ph === 'standby' || ev.ph === 'bpEnd') && ev.tp === c.owner) return true;
    if (['main1', 'main2'].includes(g.phase) && ev.type !== 'phase') { const k = g.turnNo + g.phase; if (c.flags.metalAsk === k) return false; c.flags.metalAsk = k; return true; }
    return false;
  },
  cond: (g, c, p) => !!metalBase(g, p, base) && !forbid(g, { type: 'ss', c, p, how: 'special' }),
  cost: function* (g, c, p) { const m = metalBase(g, p, base); if (m) { move(g, m, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${base}.`); } },
  res: function* (g, c, p) { if (c.zone !== 'deck' || freeM(g, p) < 0) return; c.nomi = true; ss(g, p, c, 'atk'); shuffleDeck(g, p); } });
const HARPIE = ['Harpie Lady', 'Harpie Lady 1', 'Harpie Lady 2', 'Harpie Lady 3', 'Cyber Harpie Lady'];
const castleUp = g => fieldMons(g).some(x => faceUp(x) && named(x, 'Castle of Dark Illusions'));
const battleguard = other => ({ atk: (g, c) => 500 * monsOf(g, c.ctrl).filter(x => faceUp(x) && named(x, other)).length });
const equipCards = g => allField(g).filter(x => x.zone === 'st' && faceUp(x) && x.equipTo && fieldMons(g).some(m => m.u === x.equipTo));
const cocoonOf = (g, m) => allField(g).find(x => named(x, 'Cocoon of Evolution') && x.zone === 'st' && x.equipTo === m.u && x.flags.cocoon);

E.addScripts({
  // PARTIAL: the attack redirect isn't done. ENGINE: attack() and damageStep() keep the attack target local (build/ENGINE_TODO.md).
  'Ancient Lamp': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Special Summon La Jinn',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => named(x, 'La Jinn the Mystical Genie of the Lamp')),
    res: function* (g, c, p) { if (!onField(c) || !faceUp(c) || freeM(g, p) < 0) return; const cs = g.p[p].hand.filter(x => named(x, 'La Jinn the Mystical Genie of the Lamp')); const [x] = yield* pick(g, p, 'Special Summon La Jinn', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  'Barrel Dragon': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Toss 3 coins: destroy a monster',
    cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which of their monsters?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { let h = 0; for (let i = 0; i < 3; i++) if (coin(g, p)) h++; log(g, `${h} of 3 coins came up Heads.`); if (h >= 2) destroy(g, live(L2), { by: p, src: c }); } }] },
  // PARTIAL: it goes to a Spell & Trap Zone of the attacker's controller (if it stayed in its own zone, the engine would still
  // calculate damage against it). With no free zone there, nothing happens.
  'Blast Sphere': { effs: [
    { type: 'trig', mand: true, faceDownOk: true, label: 'Equip to the attacker',
      on: (g, ev, c) => ev.type === 'dsStart' && ev.t === c && c.pos === 'set' && ev.a && ev.a.ctrl !== c.ctrl,
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (!onField(c) || c.zone !== 'm' || !a || !onField(a) || a.zone !== 'm') return; const q = a.ctrl; if (freeST(g, q) < 0) return;
        move(g, c, 'st', { ctrl: q, pos: 'up', reason: 'equip', by: p }); c.equipTo = a.u; c.flags.blast = true; log(g, `Blast Sphere was equipped to ${name(a)}.`); } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy the equipped monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && c.flags.blast && ev.tp !== c.owner && !!c.equipTo,
      res: function* (g, c, p) { const m = fieldMons(g).find(x => x.u === c.equipTo); if (!m) return; const n = ATK(g, m); if (destroy(g, [m], { by: c.owner }).length) damage(g, opp(c.owner), n, { src: c, srcP: c.owner }); } }] },
  // PARTIAL: the boost is on every face-up Zombie while this card is face-up, including Zombies that arrive later.
  'Castle of Dark Illusions': {
    cont: { atk: (g, src, m) => src.flags.castle && race(m) === 'Zombie' ? 200 * src.flags.castle : 0, def: (g, src, m) => src.flags.castle && race(m) === 'Zombie' ? 200 * src.flags.castle : 0 },
    effs: [flip('Zombies gain 200 ATK and DEF', { res: function* (g, c) { if (onField(c) && faceUp(c)) { c.flags.castle = 1; g.seq++; log(g, 'Zombie monsters gained 200 ATK and DEF.'); } } }),
      { type: 'trig', mand: true, label: 'Zombies gain 200 more', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.flags.castle && c.flags.castle < 5,
        res: function* (g, c) { if (onField(c) && faceUp(c) && c.flags.castle < 5) { c.flags.castle++; g.seq++; log(g, 'Zombie monsters gained 200 more ATK and DEF.'); } } }] },
  'Cocoon of Evolution': {
    cont: { atk: (g, src, m) => src.flags.cocoon && src.equipTo === m.u ? -baseAtk(m) : 0, def: (g, src, m) => src.flags.cocoon && src.equipTo === m.u ? 2000 - num(D(m).def) : 0 },
    effs: [{ type: 'ign', loc: 'hand', label: 'Equip to Petit Moth',
      cond: (g, c, p) => freeST(g, p) >= 0 && monsOf(g, p).some(m => faceUp(m) && named(m, 'Petit Moth')),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which Petit Moth?', monsOf(g, p).filter(m => faceUp(m) && named(m, 'Petit Moth')), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || c.zone !== 'hand' || freeST(g, p) < 0) return;
        move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p }); c.equipTo = t.u; c.flags.cocoon = true; c.flags.cocoonTurns = 0; g.seq++; log(g, `Cocoon of Evolution was equipped to ${name(t)}.`); } },
      // counts its controller's turns (Larvae Moth), no chain link
      { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.flags.cocoon) c.flags.cocoonTurns = (c.flags.cocoonTurns || 0) + 1; return false; }, res: function* () {} }] },
  'Copycat': { effs: [{ type: 'trig', mand: true, label: 'Copy original ATK and DEF', on: (g, ev, c) => ev.type === 'summon' && ev.cs.includes(c),
    cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Copy which of their face-up monsters?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c) || !faceUp(c)) return;
      addMod(g, c, { set: baseAtk(t), which: 'atk' }); addMod(g, c, { set: num(D(t).def), which: 'def' }); g.seq++; log(g, `Copycat became ${baseAtk(t)} ATK and ${num(D(t).def)} DEF.`); } }] },
  'Crass Clown': { effs: [{ type: 'trig', mand: true, label: 'Return a monster to the hand',
    on: (g, ev, c) => ev.type === 'pos' && ev.c === c && c.pos === 'atk',
    cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { const ms = monsOf(g, opp(p)); if (!ms.length) return; const [x] = yield* pick(g, p, 'Return which of their monsters to the hand?', ms, 1, 1, 'bad'); if (x) { const n = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'hand', { reason: 'effect', by: p }); log(g, `${n} returned to the hand.`); } } }] },
  // Summoned by Time Wizard (below), from the hand or Deck.
  'Dark Sage': { cont: nomiLock, effs: [nomiMark,
    { type: 'trig', mand: true, label: 'Add a Spell from the Deck', on: (g, ev, c) => ev.type === 'summon' && ev.cs.includes(c) && c.flags.darkSage,
      res: function* (g, c, p) { yield* search(g, p, isSpell, 'Add which Spell to your hand?'); } }] },
  'Dark-Eyes Illusionist': { cont: { forbid: (g, src, a) => a.type === 'attack' && src.flags.illus && a.c.u === src.flags.illus },
    effs: [flip('A monster can’t attack', {
      cond: g => fieldMons(g).length > 1,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster can’t attack?', fieldMons(g).filter(x => x !== c), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone === 'm' && onField(c) && faceUp(c)) { c.flags.illus = t.u; g.seq++; log(g, `${t.pos === 'set' ? 'The face-down monster' : name(t)} can't attack while Dark-Eyes Illusionist is face-up.`); } } })] },
  'Dragon Piper': { effs: [flip('Destroy Dragon Capture Jar', {
    res: function* (g, c, p) { const jars = allField(g).filter(x => faceUp(x) && named(x, 'Dragon Capture Jar')); if (!jars.length) return;
      if (!destroy(g, jars, { by: p }).length) return;
      const ds = fieldMons(g).filter(x => faceUp(x) && race(x) === 'Dragon' && x.pos !== 'atk'); for (const x of ds) { x.pos = 'atk'; g.seq++; L.emit(g, { type: 'pos', c: x, p }); }
      if (ds.length) log(g, `${ds.map(name).join(', ')} changed to Attack Position.`); } })] },
  'Electric Snake': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Draw 2 cards',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'hand' && ev.to === 'gy' && ev.reason === 'discard' && byOpp(g, ev, c),
    res: function* (g, c, p) { draw(g, p, 2); } }] },
  'Flying Elephant': {
    self: { replaceDestroy: (g, c, o) => { if (o.battle || o.rule || g.tp === c.ctrl || c.flags.elephant === g.turnNo) return false; if (o.by != null && o.by === c.ctrl) return false;
      c.flags.elephant = g.turnNo; log(g, 'Flying Elephant was not destroyed.'); return true; } },
    effs: [{ type: 'trig', mand: true, label: 'Win by a direct attack next turn', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp !== c.ctrl && c.flags.elephant === g.turnNo,
      res: function* (g, c) { if (onField(c)) { c.flags.elephantWin = g.turnNo + 1; log(g, 'If Flying Elephant deals battle damage by a direct attack next turn, its controller wins.'); } } },
    { type: 'trig', mand: true, label: 'Win the Duel', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.direct && ev.src === c && ev.p !== c.ctrl && c.flags.elephantWin === g.turnNo,
      res: function* (g, c, p) { winDuel(g, p, `${PN(g, p)} won with Flying Elephant`); } }] },
  'Gate Guardian': { cont: nomiLock,
    proc: { label: 'Special Summon (Tribute Sanga, Kazejin and Suijin)',
      cond: (g, c, p) => ['Sanga of the Thunder', 'Kazejin', 'Suijin'].every(n => monsOf(g, p).some(m => faceUp(m) && named(m, n))),
      cost: function* (g, c, p, grp) { const ts = ['Sanga of the Thunder', 'Kazejin', 'Suijin'].map(n => monsOf(g, p).find(m => faceUp(m) && named(m, n))).filter(Boolean);
        for (const t of ts) move(g, t, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Sanga of the Thunder, Kazejin and Suijin.`); c.nomi = true; } },
    effs: [nomiMark] },
  // Summoned with Elegant Egotist.
  'Harpie Lady Sisters': { cont: nomiLock, effs: [nomiMark] },
  'Harpie\'s Pet Dragon': { self: { atk: (g, c) => 300 * fieldMons(g).filter(x => faceUp(x) && HARPIE.includes(name(x))).length, def: (g, c) => 300 * fieldMons(g).filter(x => faceUp(x) && HARPIE.includes(name(x))).length } },
  'Jigen Bakudan': { effs: [flip('Arm the bomb', { res: function* (g, c) { if (onField(c) && faceUp(c)) { c.flags.jigen = true; log(g, 'Jigen Bakudan is armed.'); } } }),
    { type: 'trig', tags: { destroy: 1 }, label: 'Tribute it: destroy your monsters, burn', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.flags.jigen,
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Jigen Bakudan.`); },
      res: function* (g, c, p) { const ms = monsOf(g, p); const at = new Map(ms.map(m => [m, faceUp(m) ? ATK(g, m) : 0]));
        const gone = destroy(g, ms, { by: p }); const n = Math.floor(gone.reduce((s, m) => s + (at.get(m) || 0), 0) / 2); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  'Kazejin': { effs: guardian },
  'Sanga of the Thunder': { effs: guardian },
  'Suijin': { effs: guardian },
  'Larvae Moth': { cont: nomiLock,
    proc: { label: 'Special Summon (Tribute Petit Moth in its Cocoon)',
      cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && named(m, 'Petit Moth') && (cocoonOf(g, m) || {}).flags && cocoonOf(g, m).flags.cocoonTurns >= 2),
      cost: function* (g, c, p, grp) { const ms = monsOf(g, p).filter(m => faceUp(m) && named(m, 'Petit Moth') && cocoonOf(g, m) && cocoonOf(g, m).flags.cocoonTurns >= 2);
        const [m] = yield* pick(g, p, 'Tribute which Petit Moth?', ms, 1, 1, 'cost'); if (m) { move(g, m, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Petit Moth.`); } c.nomi = true; } },
    effs: [nomiMark] },
  'Lava Battleguard': { self: battleguard('Swamp Battleguard') },
  'Swamp Battleguard': { self: battleguard('Lava Battleguard') },
  'Metalzoa': { cont: nomiLock, effs: [nomiMark, metalSummon('Zoa')] },
  'Red-Eyes Black Metal Dragon': { cont: nomiLock, effs: [nomiMark, metalSummon('Red-Eyes Black Dragon')] },
  'Penguin Knight': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Shuffle the GY into the Deck',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.from === 'deck' && ev.to === 'gy' && ev.reason !== 'cost' && byOpp(g, ev, c),
    res: function* (g, c, p) { const P = g.p[p]; const n = P.gy.length; for (const x of P.gy.slice()) { x.zone = 'deck'; x.pos = null; P.deck.push(x); } P.gy.length = 0; shuffleDeck(g, p); g.seq++; log(g, `${PN(g, p)} shuffled ${n} cards from the GY into the Deck.`); } }] },
  'Pumpking the King of Ghosts': {
    self: { atk: (g, c) => { if (!castleUp(g)) { c.flags.pump = 0; return 0; } return 100 + 100 * (c.flags.pump || 0); }, def: (g, c) => castleUp(g) ? 100 + 100 * (c.flags.pump || 0) : 0 },
    effs: [{ type: 'trig', mand: true, label: 'Gain 100 ATK and DEF', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && castleUp(g) && (c.flags.pump || 0) < 4,
      cond: g => castleUp(g),
      res: function* (g, c) { if (onField(c) && faceUp(c) && castleUp(g) && (c.flags.pump || 0) < 4) { c.flags.pump = (c.flags.pump || 0) + 1; g.seq++; log(g, `${name(c)} gained 100 ATK and DEF.`); } } }] },
  'Reaper of the Cards': { effs: [flip('Destroy a Trap', {
    cond: g => allField(g).some(x => x.zone !== 'm' && (x.pos === 'set' || isTrap(x))),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which Trap (or Set card)?', allField(g).filter(x => x.zone !== 'm' && (x.pos === 'set' || isTrap(x))), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; if (t.pos === 'set') log(g, `${PN(g, p)} looked at the Set card: ${name(t)}.`);
      if (isTrap(t)) destroy(g, [t], { by: p, src: c }); else log(g, `${name(t)} isn't a Trap, so it stays.`); } })] },
  'Shadow Ghoul': { self: { atk: (g, c) => 100 * g.p[c.ctrl].gy.filter(isMon).length } },
  'Skelengel': { effs: [flip('Draw 1 card', { res: function* (g, c, p) { draw(g, p, 1); } })] },
  'The Wicked Worm Beast': { effs: [{ type: 'trig', mand: true, label: 'Return to the hand', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
    res: function* (g, c) { if (onField(c) && faceUp(c) && c.zone === 'm') { move(g, c, 'hand', { reason: 'effect' }); log(g, 'The Wicked Worm Beast returned to the hand.'); } } }] },
  'Time Wizard': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Toss a coin',
    res: function* (g, c, p) {
      const call = yield* choose(g, p, 'Call the coin toss', ['Heads', 'Tails']); log(g, `${PN(g, p)} called ${call ? 'Tails' : 'Heads'}.`);
      const right = coin(g, p) === (call === 0);
      if (right) {
        log(g, `${PN(g, p)} called it right.`); destroy(g, monsOf(g, opp(p)), { by: p });
        // Dark Sage: Tribute Dark Magician right after a right call
        const dm = monsOf(g, p).filter(m => faceUp(m) && named(m, 'Dark Magician'));
        const sages = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Dark Sage'));
        if (dm.length && sages.length && !forbid(g, { type: 'ss', c: sages[0], p, how: 'special' }) && (yield* yn(g, p, 'Tribute Dark Magician to Special Summon Dark Sage?'))) {
          const [m] = dm.length > 1 ? yield* pick(g, p, 'Tribute which Dark Magician?', dm, 1, 1, 'cost') : dm;
          const [s] = sages.length > 1 ? yield* pick(g, p, 'Special Summon which Dark Sage?', sages, 1, 1, 'good') : sages;
          move(g, m, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Dark Magician.`);
          const fromDeck = s.zone === 'deck'; s.flags.darkSage = true; s.nomi = true; ss(g, p, s, 'atk'); if (fromDeck) shuffleDeck(g, p);
        }
      } else {
        log(g, `${PN(g, p)} called it wrong.`); const ms = monsOf(g, p); const at = new Map(ms.map(m => [m, faceUp(m) ? ATK(g, m) : 0]));
        const gone = destroy(g, ms, { by: p }); const n = Math.floor(gone.reduce((s, m) => s + (at.get(m) || 0), 0) / 2); if (n > 0) damage(g, p, n, { src: c, srcP: p });
      } } }] },
  // Summoned with Magical Labyrinth.
  'Wall Shadow': { cont: nomiLock, effs: [nomiMark] },
  'White Magical Hat': { effs: [{ type: 'trig', mand: true, label: 'Random discard', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    res: function* (g, c, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, opp(p))} discarded ${name(x)} at random.`); } }] },
  // Original 2005 text: no once-per-turn and no lock on the added card's name (both added by later errata).
  'Witch of the Black Forest': { effs: [{ type: 'trig', mand: true, label: 'Add a monster with 1500 or less DEF', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy',
    loc: 'gy', cond: (g, c, p) => !forbid(g, { type: 'search', p }),
    res: function* (g, c, p) { yield* search(g, p, m => isMon(m) && num(D(m).def) <= 1500 && D(m).def !== '?', 'Add which monster with 1500 or less DEF?'); } }] },
  'Berfomet': { effs: [{ type: 'trig', when: true, label: 'Add Gazelle', on: (g, ev, c) => ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute', 'flip'].includes(ev.how),
    cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'Gazelle the King of Mythical Beasts')),
    res: function* (g, c, p) { yield* search(g, p, x => named(x, 'Gazelle the King of Mythical Beasts'), 'Add Gazelle the King of Mythical Beasts'); } }] },
  'Boar Soldier': { self: { atk: (g, c) => monsOf(g, opp(c.ctrl)).length ? -1000 : 0 },
    effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy this card', on: (g, ev, c) => ev.type === 'summon' && ev.cs.includes(c) && ['normal', 'tribute'].includes(ev.how),
      res: function* (g, c, p) { if (onField(c)) destroy(g, [c], { by: p }); } }] },
  'Cockroach Knight': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Return to the top of the Deck', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy',
    res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'deckTop', { reason: 'effect' }); log(g, 'Cockroach Knight returned to the top of the Deck.'); } } }] },
  'Cyber Raider': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy or take an Equip Card', on: (g, ev, c) => ev.type === 'summon' && ev.cs.includes(c),
    cond: g => equipCards(g).length > 0,
    target: function* (g, c, p, L2) {
      const i = freeST(g, p) >= 0 ? yield* choose(g, p, 'Cyber Raider: which effect?', ['Destroy an Equip Card', 'Equip an Equip Card to this card']) : 0; L2.data.take = i === 1;
      const es = equipCards(g).filter(x => !L2.data.take || x.equipTo !== c.u);
      yield* tgt(g, p, L2, L2.data.take ? 'Equip which Equip Card to Cyber Raider?' : 'Destroy which Equip Card?', es.length ? es : equipCards(g), 1, 1, L2.data.take ? 'good' : 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.zone !== 'st') return;
      if (!L2.data.take) { destroy(g, [t], { by: p, src: c }); return; }
      if (!onField(c) || !faceUp(c) || c.zone !== 'm' || (t.ctrl !== p && freeST(g, p) < 0)) return;
      if (t.ctrl !== p) move(g, t, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p });
      t.equipTo = c.u; g.seq++; log(g, `${name(t)} was equipped to Cyber Raider.`); } }] },
  'D.D. Warrior': { effs: [{ type: 'trig', mand: true, label: 'Banish both monsters', on: (g, ev, c) => ev.type === 'afterCalc' && ev.t && (ev.a === c || ev.t === c),
    res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; const bs = [o, c].filter(x => x && onField(x) && x.zone === 'm');
      for (const x of bs) { x.flags.battleDoomed = false; move(g, x, 'ban', { reason: 'effect', by: p }); } if (bs.length) log(g, `${bs.map(x => D(x).n).join(' and ')} ${bs.length > 1 ? 'were' : 'was'} banished.`); } }] },
}, 'goat');
})();
