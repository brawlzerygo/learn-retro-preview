/* Full pool batch 10: Hyper Hammerhead to Level Warrior (build/batches/full/full-10.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text; cards with a
 Goat-only script elsewhere (Insect Barrier, Insect Soldiers of the Sky, Iron Blacksmith Kotetsu, Jinzo, Judgment of Anubis,
 Kaiser Glider, King Dragun, Last Turn, Last Will, Lava Battleguard, Lava Golem) are ported here as the shared version;
 the Goat-only scripts still win while Goat is loaded. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, setFaceDown, negate, addMod,
  equip, equippedTo, addCtr, ctr, negateAttack, addRule, tokens, dice,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned,
  battleKill, isGemini, stat, num, emit, forbid, isExtraD } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const tx = c => D(c).ps || D(c).tx || '';
const holder = c => onField(c) ? c.ctrl : c.owner;
const isIronChain = x => isMon(x) && /Iron Chain/.test(name(x));
const isLV = x => isMon(x) && / LV\d+$/.test(D(x).n);
const isRedEyes = x => /^Red-Eyes B(?:lack|\.) Dragon$/.test(name(x));
const isSixSam = x => /Six Samurai/.test(name(x));
const isKoaki = x => /Koa'ki Meiru/.test(name(x));
const spellAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) equip(g, c, t); } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
const pos2 = function* (g, p, x) { const i = yield* choose(g, p, `${name(x)}: which position?`, ['Attack Position', 'Defense Position']); return i ? 'def' : 'atk'; };
function* discardOne(g, p, cands, text) { const [x] = yield* pick(g, p, text, cands, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } return x; }
const toHand = (g, x, p) => { const n = x.pos === 'set' ? 'A face-down card' : name(x); move(g, x, 'hand', { reason: 'effect', by: p }); log(g, `${n} returned to the hand.`); };
// "Cannot be Special Summoned" for a card that is in the GY (the hand is covered by the card's summon rules)
// ENGINE: no general "can't be Special Summoned" flag; this only stops it leaving the GY.
const noSSFromGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src };
// Jinzo style Trap lock. PARTIAL: a face-up Continuous Trap's static effect still applies (statics aren't negated for
// Spells/Traps); its activations, Trap triggers and Trap Monsters' effects are stopped.
const trapLock = { forbid: (g, src, a) => a.type === 'activate' && a.c && isTrap(a.c), negates: (g, src, c) => isTrap(c) && onField(c) };
// "Cannot declare an attack unless you Tribute 1 monster" (port of classic-3.js).
// PARTIAL: the Tribute is a mandatory trigger at the attack declaration (a chain link); it can't attack with no other monster.
const tributeToAttack = {
  self: { cantAttack: (g, c) => !monsOf(g, c.ctrl).some(x => x !== c) },
  eff: { type: 'trig', mand: true, label: 'Tribute 1 monster to attack', on: (g, ev, c) => ev.type === 'attack' && ev.a === c,
    cost: function* (g, c, p) {
      const cs = monsOf(g, p).filter(x => x !== c); if (!cs.length) return;
      const [x] = yield* pick(g, p, `Tribute 1 monster to attack with ${name(c)}`, cs, 1, 1, 'cost');
      if (x) { const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${nm} to attack.`); } },
    res: noop } };
// Spell Counters for each Spell Card activated (port of goat-7.js): a Normal/Quick-Play Spell is counted as it leaves the
// field after resolving, a Continuous/Equip/Field Spell as it is activated from the hand.
// PARTIAL: a negated Normal Spell still counts, and a Set Continuous Spell flipped face-up is not seen.
const spellCounter = { type: 'trig', on: (g, ev, c) => {
  // a Spell already face-up when this card arrives (the Ritual Spell that summoned it) was activated before it was on the field
  if (ev.type === 'move' && ev.c === c && ev.to === 'm') { c.f10skip = allField(g).filter(x => isSpell(x) && faceUp(x)).map(x => x.u); return false; }
  if (ev.type !== 'move' || !isSpell(ev.c) || (c.f10skip || []).includes(ev.c.u)) return false;
  const stays = ['Continuous', 'Equip', 'Field'].includes(D(ev.c).sub);
  if ((!stays && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule') || (stays && ev.from === 'hand' && ev.reason === 'activate')) { addCtr(g, c, 'spell', 1); log(g, `${name(c)} got a Spell Counter (${ctr(c, 'spell')}).`); }
  return false; }, res: noop };
// monsters destroyed by battle this turn (Lady Panther): stamped on the card object, which keeps it after it leaves the field
const bkMark = { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { if (ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy') ev.c.f10bk = g.turnNo; return false; } };
const over = (g, winner, why) => { g.winner = winner; g.why = why; log(g, why + '.'); throw { over: true }; };
const lwFrom = c => isMon(c) && !isExtraD(D(c)) && !['ritual', 'token'].includes(D(c).k) && baseAtk(c) <= 1500 && !/Cannot be (Normal|Special) Summoned/i.test(tx(c));
// the minimum Tributes a Normal Summon of this monster takes (Kaiser Colosseum)
const tribs = c => { const l = lv(c); return l >= 7 ? 2 : l >= 5 ? 1 : 0; };
const lvBase = n => { const m = n.match(/^(.*) LV(\d+)$/); return m ? { base: m[1], lv: +m[2] } : null; };

E.addScripts({
  /* ----- Hyper ----- */
  // At the end of the Damage Step: the opponent's monster that battled it goes back to the hand if it is still there.
  // It resolves even if Hyper Hammerhead was destroyed (ruling), so it watches from anywhere.
  'Hyper Hammerhead': { effs: [{ type: 'trig', loc: 'any', mand: true, label: 'Return the monster it battled',
    on: (g, ev, c) => { if (ev.type !== 'dsEnd' || !ev.t || (ev.a !== c && ev.t !== c)) return false; const o = ev.a === c ? ev.t : ev.a; return onField(o) && o.zone === 'm' && o.ctrl !== holder(c); },
    res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; if (o && onField(o) && o.zone === 'm') toHand(g, o, p); } }] },
  // PARTIAL: "only with Assault Mode Activate" is enforced in the hand (it can't be Special Summoned from there).
  'Hyper Psychic Blaster Assault Mode': {
    cont: { loc: 'hand', forbid: (g, src, a) => a.c === src && ['ns', 'set', 'ss'].includes(a.type) },
    effs: [
      { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
        if (ev.type === 'afterCalc' && ev.t && (ev.a === c || ev.t === c)) { const o = ev.a === c ? ev.t : ev.a; g.f10hpb = { u: c.u, seq: ev.seq, d: onField(o) ? def(g, o) : num(D(o).def), a: onField(o) ? atk(g, o) : baseAtk(o) }; }
        return false; } },
      { type: 'trig', loc: 'any', mand: true, label: 'Damage equal to its DEF, gain its ATK',
        on: (g, ev, c) => ev.type === 'dsEnd' && ev.t && (ev.a === c || ev.t === c) && !!g.f10hpb && g.f10hpb.u === c.u,
        res: function* (g, c, p) { const r = g.f10hpb; g.f10hpb = null; if (!r) return; if (r.d > 0) damage(g, opp(p), r.d, { src: c, srcP: p }); gain(g, p, r.a); } },
      { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon Hyper Psychic Blaster',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField && ev.from === 'm',
        cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, 'Hyper Psychic Blaster')),
        res: function* (g, c, p) { const cs = g.p[p].gy.filter(x => named(x, 'Hyper Psychic Blaster')); if (!cs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon Hyper Psychic Blaster from your GY', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  // The Synchro Monster is found through the summon that used this card. The banish during the End Phase rides on a flag
  // that leaves with the monster (flipped face-down or off the field: no banish, as the rulings say).
  // PARTIAL: the End Phase banish uses a chain link (the card text starts none).
  'Hyper Synchron': { effs: [
    { type: 'trig', loc: 'gy', mand: true, label: 'The Dragon gains 800 ATK',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.reason === 'synchro' && ev.to === 'gy',
      cond: (g, c, p, x) => { const e = g.events.find(e => e.type === 'summon' && e.how === 'synchro' && e.group === x.ev.group); return !!e && e.cs.some(m => onField(m) && faceUp(m) && race(m) === 'Dragon'); },
      res: function* (g, c, p, L2) { const e = g.events.find(e => e.type === 'summon' && e.how === 'synchro' && e.group === L2.ev.group); if (!e) return;
        for (const m of e.cs) if (onField(m) && faceUp(m) && race(m) === 'Dragon') { addMod(g, m, { atk: 800 }); m.flags.f10hyper = c.u; log(g, `${name(m)} gained 800 ATK. It is banished during the End Phase.`); } } },
    { type: 'trig', loc: 'any', mand: true, label: 'Banish the Synchro Monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(m => faceUp(m) && m.flags.f10hyper === c.u),
      res: function* (g, c, p) { for (const m of fieldMons(g).filter(m => faceUp(m) && m.flags.f10hyper === c.u)) { move(g, m, 'ban', { reason: 'effect', by: p }); log(g, `${D(m).n} was banished.`); } } }] },

  /* ----- Infernal and Inferno ----- */
  'Infernal Dragon': { effs: [
    // "if this card attacked this turn": a flag that a face-down flip wipes (ruling) and a control change keeps
    { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'attack' && ev.a === c) c.flags.f10att = g.turnNo; return false; } },
    { type: 'trig', mand: true, opt: true, tags: { destroy: 1 }, label: 'Destroy this card',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.flags.f10att === g.turnNo,
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) destroy(g, [c], { by: p }); } },
    { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Tribute 1 monster: Special Summon this card',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy',
      cond: (g, c, p) => monsOf(g, p).length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 monster', monsOf(g, p), 1, 1, 'cost'); if (x) { const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); } },
      res: function* (g, c, p) { if (c.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, c, 'atk'); } }] },
  'Infernal Flame Emperor': { cont: noSSFromGY,
    effs: [{ type: 'trig', when: true, tags: { destroy: 1 }, label: 'Banish FIRE monsters: destroy Spells/Traps',
      on: (g, ev, c) => evSummoned(ev, c, ['tribute']),
      cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'FIRE') && stOnField(g).length > 0,
      res: function* (g, c, p) {
        const fires = g.p[p].gy.filter(x => isMon(x) && attr(x) === 'FIRE'); const sts = stOnField(g); if (!fires.length || !sts.length) return;
        const xs = yield* pick(g, p, 'Banish up to 5 FIRE monsters from your GY', fires, 1, Math.min(5, fires.length, sts.length), 'cost');
        for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: p }); log(g, `${PN(g, p)} banished ${xs.map(x => D(x).n).join(', ')}.`);
        const left = stOnField(g); if (!left.length) return;
        const ds = yield* pick(g, p, `Destroy ${Math.min(xs.length, left.length)} Spell/Trap Card(s)`, left, Math.min(xs.length, left.length), Math.min(xs.length, left.length), 'bad');
        destroy(g, ds, { by: p, src: c }); } }] },
  // The Normal Summon is offered as its own summon rule (Tribute Summon, discarding the rest of the hand as the cost).
  // PARTIAL: it is logged as a Special Summon of type "tribute", it can't be Set this way, and the summon counts as the
  // turn's Normal Summon. A plain Normal Summon or Set is blocked.
  'Infernal Incinerator': {
    self: { atk: (g, c) => 200 * monsOf(g, opp(c.ctrl)).length - 500 * monsOf(g, c.ctrl).filter(x => x !== c).length },
    cont: { loc: 'hand', forbid: (g, src, a) => a.c === src && (a.type === 'ns' || a.type === 'set') },
    proc: { label: 'Tribute Summon (discard your hand, Tribute a 2000+ ATK monster)', how: 'tribute',
      cond: (g, c, p) => g.ns[p] < 1 && !g.noSummon[p] && g.p[p].hand.some(x => x !== c) && monsOf(g, p).some(x => faceUp(x) && atk(g, x) >= 2000),
      cost: function* (g, c, p, grp) {
        const rest = g.p[p].hand.filter(x => x !== c); for (const x of rest) move(g, x, 'gy', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} discarded ${rest.length} card(s).`);
        const [t] = yield* pick(g, p, 'Tribute 1 monster with 2000 or more ATK', monsOf(g, p).filter(x => faceUp(x) && atk(g, x) >= 2000), 1, 1, 'cost');
        if (t) { move(g, t, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${D(t).n}.`); }
        g.ns[p]++; } } },
  'Inferno': {
    proc: { label: 'Special Summon (banish a FIRE monster from your GY)', cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && attr(x) === 'FIRE'),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish 1 FIRE monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'FIRE'), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } } },
    effs: [{ type: 'trig', mand: true, label: '1500 damage', on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
      res: function* (g, c, p) { damage(g, opp(p), 1500, { src: c, srcP: p }); } }] },
  // The "can't attack" part applies when it resolves (Magic Jammer stops it, the rulings say). The damage uses the
  // original ATK read at activation, so it resolves even if the Red-Eyes is gone.
  'Inferno Fire Blast': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isRedEyes(x)) && !monsOf(g, p).some(x => isRedEyes(x) && (x.attacks || x.declared)),
    target: function* (g, c, p, L2) { const [t] = yield* tgt(g, p, L2, 'Target which Red-Eyes B. Dragon?', monsOf(g, p).filter(x => faceUp(x) && isRedEyes(x)), 1, 1, 'good'); L2.data.n = t ? baseAtk(t) : 0; },
    res: function* (g, c, p, L2) {
      addRule(g, (g2, a) => a.type === 'attack' && a.c && a.c.ctrl === p && isRedEyes(a.c), { end: g.turnNo }); log(g, 'Red-Eyes B. Dragon can’t attack this turn.');
      if (L2.data.n) damage(g, opp(p), L2.data.n, { src: c, srcP: p }); } }] },
  'Inferno Hammer': { effs: [{ type: 'trig', when: true, label: 'Turn a monster face-down',
    on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
    cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Turn which face-up monster face-down?', oppFaceUp(g, p), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.zone === 'm') setFaceDown(g, t); } }] },
  // Quick-Play: right after exactly 1 face-up monster with 1500 or less ATK is Special Summoned to your field (not a Token).
  'Inferno Reckless Summon': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => { const sw = g.sw; if (!sw || sw.p !== p || sw.cs.length !== 1 || ['normal', 'tribute', 'flip', 'gemini'].includes(sw.how)) return false;
      const x = sw.cs[0]; return onField(x) && faceUp(x) && x.ctrl === p && D(x).k !== 'token' && atk(g, x) <= 1500 && oppFaceUp(g, p).some(m => D(m).k !== 'token'); },
    target: function* (g, c, p, L2) { L2.data.n = D(g.sw.cs[0]).n; },
    res: function* (g, c, p, L2) {
      const pull = (q, n) => { const cs = [...g.p[q].hand, ...g.p[q].deck, ...g.p[q].gy].filter(x => isMon(x) && D(x).n === n); let k = 0; for (const x of cs) { if (freeM(g, q) < 0) break; if (ss(g, q, x, 'atk')) k++; } shuffleDeck(g, q); return k; };
      pull(p, L2.data.n);
      const o = opp(p), ms = oppFaceUp(g, p).filter(m => D(m).k !== 'token'); if (!ms.length) return;
      const [m] = yield* pick(g, o, 'Choose 1 of your face-up monsters: Special Summon its copies', ms, 1, 1, 'good');
      if (m) pull(o, D(m).n); } }] },
  // PARTIAL: the engine opens no window right after damage calculation, so it can be activated in a later window of the
  // same turn, as long as no other attack was declared since the damage.
  'Inferno Tempest': { effs: [{ type: 'act',
    cond: (g, c, p) => { let dmg = -1, atkSeq = -1; for (const e of g.events) { if (e.turn !== g.turnNo) continue; if (e.type === 'damage' && e.battle && e.p === p && e.n >= 3000) dmg = e.seq; if (e.type === 'attack') atkSeq = e.seq; } return dmg > 0 && dmg > atkSeq; },
    res: function* (g, c, p) { let n = 0; for (const q of [0, 1]) for (const z of ['deck', 'gy']) for (const x of g.p[q][z].filter(isMon)) { move(g, x, 'ban', { reason: 'effect', by: p }); n++; }
      shuffleDeck(g, 0); shuffleDeck(g, 1); log(g, `${n} monster(s) in the Decks and GYs were banished.`); } }] },

  /* ----- Insect ----- */
  'Insect Barrier': { cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && a.c.ctrl !== src.ctrl && faceUp(a.c) && race(a.c) === 'Insect' }, effs: [{ type: 'act', res: noop }] },
  'Insect Imitation': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(m => g.p[p].deck.some(x => isMon(x) && race(x) === 'Insect' && lv(x) === lv(m) + 1)),
    cost: function* (g, c, p, L2) { const [m] = yield* pick(g, p, 'Tribute 1 monster', monsOf(g, p).filter(m => g.p[p].deck.some(x => isMon(x) && race(x) === 'Insect' && lv(x) === lv(m) + 1)), 1, 1, 'cost');
      if (m) { L2.data.lv = lv(m); const nm = m.pos === 'set' ? 'a face-down monster' : name(m); move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); } },
    res: function* (g, c, p, L2) { const cs = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Insect' && lv(x) === L2.data.lv + 1); if (!cs.length || freeM(g, p) < 0) { shuffleDeck(g, p); return; }
      const [x] = yield* pick(g, p, `Special Summon a Level ${L2.data.lv + 1} Insect from your Deck`, cs, 1, 1, 'good'); if (x) ss(g, p, x, yield* pos2(g, p, x)); shuffleDeck(g, p); } }] },
  'Insect Neglect': { effs: [{ type: 'act', res: noop },
    { type: 'trig', loc: 'st', when: true, label: 'Banish an Insect: negate the attack',
      on: (g, ev, c) => ev.type === 'attack' && ev.a.ctrl !== c.ctrl,
      cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && race(x) === 'Insect'),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish 1 Insect monster from your GY', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Insect'), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
      res: function* (g, c, p, L2) { if (g.aw && g.aw.a === L2.ev.a) negateAttack(g); } }] },
  // The opponent's face-up Defense Position Insects are put back in Attack Position at every game event (no chain).
  // PARTIAL: a face-down Insect flipped by an attack changes after damage calculation, not before.
  'Insect Princess': { effs: [
    { type: 'trig', res: noop, on: (g, ev, c) => { for (const m of monsOf(g, opp(c.ctrl))) if (m.pos === 'def' && race(m) === 'Insect') { m.pos = 'atk'; g.seq++; log(g, `${name(m)} was changed to Attack Position.`); } return false; } },
    { type: 'trig', mand: true, label: 'Gain 500 ATK', on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.snap && ev.snap.race === 'Insect',
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500 }); log(g, `${name(c)} gained 500 ATK.`); } } }] },
  // Port of classic-3.js. One token in the End Phase if it destroyed an opponent's monster by battle this turn.
  'Insect Queen': {
    self: { ...tributeToAttack.self, atk: g => 200 * fieldMons(g).filter(x => faceUp(x) && race(x) === 'Insect').length },
    effs: [tributeToAttack.eff,
      { type: 'trig', mand: true, opt: true, tags: { ss: 1 }, label: 'Summon an Insect Monster Token',
        on: (g, ev, c) => { if (ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.prevCtrl !== c.ctrl) c.flags.queenKill = g.turnNo;
          return ev.type === 'phase' && ev.ph === 'end' && c.flags.queenKill === g.turnNo; },
        cond: (g, c, p) => freeM(g, p) >= 0,
        res: function* (g, c, p) { if (onField(c)) tokens(g, p, { n: 'Insect Monster Token', a: 'EARTH', r: 'Insect', lv: 1, atk: 100, def: 100 }, 1, 'atk'); } }] },
  'Insect Soldiers of the Sky': { self: { atk: (g, c) => g.inDS && g.battle && g.battle.a === c && g.battle.t && faceUp(g.battle.t) && attr(g.battle.t) === 'WIND' ? 1000 : 0 } },

  /* ----- Iron ----- */
  'Iron Blacksmith Kotetsu': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Add an Equip Spell', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { yield* search(g, p, x => isSpell(x) && D(x).sub === 'Equip', 'Add an Equip Spell from your Deck to your hand'); } }] },
  'Iron Chain Blaster': { effs: [{ type: 'ign', opt: true, label: 'Send an Iron Chain monster: 800 damage',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isIronChain(x)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send 1 face-up Iron Chain monster you control to the GY', monsOf(g, p).filter(x => faceUp(x) && isIronChain(x)), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
    res: function* (g, c, p) { damage(g, opp(p), 800, { src: c, srcP: p }); } }] },
  // The boost lasts while Coil is face-up on the field (its flags clear when it leaves or is turned face-down).
  'Iron Chain Coil': {
    cont: { atk: (g, src, m) => (src.flags.f10coil || []).some(e => e.u === m.u && e.ti === m.turnIn) ? 300 : 0, def: (g, src, m) => (src.flags.f10coil || []).some(e => e.u === m.u && e.ti === m.turnIn) ? 300 : 0 },
    effs: [{ type: 'ign', opt: true, label: 'An Iron Chain monster gains 300 ATK and DEF',
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isIronChain(x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target 1 face-up Iron Chain monster you control', monsOf(g, p).filter(x => faceUp(x) && isIronChain(x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c) || !faceUp(c)) return; (c.flags.f10coil || (c.flags.f10coil = [])).push({ u: t.u, ti: t.turnIn }); g.seq++; log(g, `${name(t)} gained 300 ATK and DEF.`); } }] },
  'Iron Chain Repairman': {
    self: { cantAttack: (g, c) => c.flags.f10noatk === g.turnNo },
    effs: [
      { type: 'trig', mand: true, label: '300 damage', on: (g, ev, c) => battleKill(ev, c), res: function* (g, c, p) { damage(g, opp(p), 300, { src: c, srcP: p }); } },
      { type: 'ign', opt: true, tags: { ss: 1 }, label: 'Special Summon an Iron Chain monster from your GY',
        cond: (g, c, p) => !c.attacks && !c.declared && freeM(g, p) >= 0 && g.p[p].gy.some(x => isIronChain(x) && lv(x) <= 4 && !named(x, 'Iron Chain Repairman')),
        cost: function* (g, c) { c.flags.f10noatk = g.turnNo; },
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Iron Chain monster from your GY?', g.p[p].gy.filter(x => isIronChain(x) && lv(x) <= 4 && !named(x, 'Iron Chain Repairman')), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, t, yield* pos2(g, p, t)); } }] },
  // The monster card becomes an Equip Card on an opponent's monster (-800 ATK/DEF). When that monster is destroyed by battle
  // and sent to the GY, its controller sends cards from the top of their Deck equal to its Level.
  'Iron Chain Snake': {
    cont: { atk: (g, src, m) => src.zone === 'st' && src.equipTo === m.u ? -800 : 0, def: (g, src, m) => src.zone === 'st' && src.equipTo === m.u ? -800 : 0 },
    effs: [
      { type: 'ign', label: 'Equip to an opponent’s monster',
        cond: (g, c, p) => freeST(g, p) >= 0 && oppFaceUp(g, p).length > 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Iron Chain Snake to which face-up monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || c.zone !== 'm' || freeST(g, p) < 0) return;
          move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p }); c.equipTo = t.u; c.flags.f10eq = t.u; g.seq++; log(g, `Iron Chain Snake was equipped to ${name(t)}.`); } },
      { type: 'trig', loc: 'any', mand: true, label: 'Send cards from the Deck to the GY',
        on: (g, ev, c) => { if (ev.type === 'move' && c.zone === 'st' && c.flags.f10eq && ev.c.u === c.flags.f10eq && ev.wasField && ev.battle && ev.destroyed && ev.to === 'gy') { c.f10mill = { p: ev.prevCtrl, n: ev.snap ? ev.snap.lv : lv(ev.c) }; return true; } return false; },
        res: function* (g, c) { const m = c.f10mill; c.f10mill = null; if (m && m.n > 0) mill(g, m.p, m.n); } }] },
  // PARTIAL: the ATK loss applies through the whole Damage Step, and sending this card instead is automatic (no prompt).
  "Iron Core Armor": {
    cont: { atk: (g, src, m) => { const e = equippedTo(g, src); if (!e || !g.inDS || !g.battle || m === e) return 0; const b = g.battle; return (b.a === e && b.t === m) || (b.t === e && b.a === m) ? -100 * lv(e) : 0; },
      replaceDestroy: (g, src, c, o) => { if (!onField(src) || src.equipTo !== c.u || g.phase !== 'end') return false; move(g, src, 'gy', { reason: 'effect' }); log(g, `${PN(g, src.ctrl)} sent Iron Core Armor to the GY instead.`); return true; } },
    effs: [spellAct(isKoaki, "Equip to which Koa'ki Meiru monster?")] },
  "Iron Core Immediate Disposal": { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.some(x => named(x, "Iron Core of Koa'ki Meiru")),
    res: function* (g, c, p) { yield* search(g, p, x => named(x, "Iron Core of Koa'ki Meiru"), "Send Iron Core of Koa'ki Meiru to the GY", 'gy'); } }] },

  /* ----- Jinzo ----- */
  'Jinzo': { cont: trapLock },
  'Jinzo - Lord': { cont: trapLock,
    // ENGINE: no general "can't be Special Summoned" flag; only its own rule is offered from the hand.
    proc: { label: 'Special Summon (send a face-up Jinzo to the GY)', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && named(x, 'Jinzo')),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Send 1 face-up Jinzo you control to the GY', monsOf(g, p).filter(x => faceUp(x) && named(x, 'Jinzo')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} sent Jinzo to the GY.`); } } },
    effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy all face-up Traps',
      cond: g => stOnField(g).some(x => faceUp(x) && isTrap(x)),
      res: function* (g, c, p) { const n = destroy(g, stOnField(g).filter(x => faceUp(x) && isTrap(x)), { by: p }).length; if (n) damage(g, opp(p), 300 * n, { src: c, srcP: p }); } }] },
  // The Special Summoned Jinzo carries a flag that a face-down flip wipes (ruling). PARTIAL: its End Phase destruction uses a chain link.
  'Jinzo - Returner': { self: { directAttack: true }, effs: [
    { type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon Jinzo from your GY',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, 'Jinzo')),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Jinzo from your GY?', g.p[p].gy.filter(x => named(x, 'Jinzo')), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && ss(g, p, t, 'atk')) t.flags.f10ret = p + 1; } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the Special Summoned Jinzo',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(m => faceUp(m) && m.flags.f10ret === ev.tp + 1 && m.ctrl === ev.tp),
      res: function* (g, c, p, L2) { const tp = L2.ev.tp; destroy(g, fieldMons(g).filter(m => faceUp(m) && m.flags.f10ret === tp + 1 && m.ctrl === tp), { by: p }); } }] },
  'Jinzo 7': { self: { directAttack: true } },

  /* ----- Judgment ----- */
  'Judgment of Anubis': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p, x) => spellTrapAct(x.top) && !x.top.negated && x.top.p !== p && isSpell(x.top.c) && /destroy[^.]*(Spell|Trap)/i.test(tx(x.top.c)) && g.p[p].hand.length > 0,
    cost: function* (g, c, p) { yield* discardOne(g, p, g.p[p].hand, 'Discard 1 card'); },
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; T.negBy = p; negate(g, T, true);
      const ms = oppFaceUp(g, p); if (!ms.length || !(yield* yn(g, p, 'Destroy a face-up monster and inflict damage equal to its ATK?'))) return;
      const [m] = yield* pick(g, p, 'Destroy which face-up monster?', ms, 1, 1, 'bad'); if (!m) return; const n = stat(g, m, 'atk');
      if (destroy(g, [m], { by: p, src: c }).length && n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  // Monsters flipped face-up while it is face-up get a mark; manual position changes of marked monsters are blocked
  // (card effects set positions directly and still work, as the ruling says).
  'Judgment of the Desert': {
    cont: { forbid: (g, src, a) => a.type === 'pos' && a.c && a.c.flags.f10desert },
    effs: [{ type: 'act', res: noop },
      { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => { if (ev.type === 'flip' && ev.c && onField(ev.c)) ev.c.flags.f10desert = true; return false; } }] },
  // The locks come from a temporary rule; the negation from this card's own GY static (it is in the GY once resolved).
  // PARTIAL: Flip Summons are not stopped (ENGINE: Flip Summon is no forbid action), and the static effects of face-up
  // Continuous Spells/Traps still apply.
  'Judgment of the Pharaoh': {
    cont: { loc: 'gy', negates: (g, src, c) => (g.f10ph || []).some(e => e.turn === g.turnNo && onField(c) && c.ctrl === e.o && ((e.k === 0 && isMon(c)) || (e.k === 1 && isST(c)))) },
    effs: [{ type: 'act',
      cond: (g, c, p) => g.p[p].gy.some(x => named(x, 'Yu-Jo Friendship') || named(x, 'Unity')),
      cost: function* (g, c, p) { pay(g, p, Math.floor(g.p[p].lp / 2)); },
      target: function* (g, c, p, L2) { const ks = [], ls = [];
        if (g.p[p].gy.some(x => named(x, 'Yu-Jo Friendship'))) { ks.push(0); ls.push('Yu-Jo Friendship: lock their monsters'); }
        if (g.p[p].gy.some(x => named(x, 'Unity'))) { ks.push(1); ls.push('Unity: lock their Spells and Traps'); }
        L2.data.k = ks[ks.length > 1 ? yield* choose(g, p, 'Which effect?', ls) : 0]; },
      res: function* (g, c, p, L2) { const o = opp(p), k = L2.data.k;
        (g.f10ph || (g.f10ph = [])).push({ turn: g.turnNo, o, k }); g.seq++;
        if (k === 0) { addRule(g, (g2, a) => a.p === o && (['ns', 'set', 'ss'].includes(a.type) || (a.type === 'activate' && a.c && isMon(a.c))), { end: g.turnNo }); log(g, `${PN(g, o)} can't summon or use monster effects this turn.`); }
        else { addRule(g, (g2, a) => a.p === o && ((a.type === 'activate' && a.c && isST(a.c)) || a.type === 'setST'), { end: g.turnNo }); log(g, `${PN(g, o)}'s Spells and Traps are negated this turn.`); } } }] },
  'Judgment of Thunder': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.sw && g.sw.p === p && g.sw.cs.some(x => onField(x) && faceUp(x) && race(x) === 'Thunder') && fieldOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card your opponent controls?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },

  /* ----- Kaiser ----- */
  // While its controller has a monster, the opponent can't summon past that monster count (a Tribute Summon counts its
  // Tributes; taking control is still allowed, the rulings say).
  'Kaiser Colosseum': {
    cont: { forbid: (g, src, a) => { if (!['ns', 'set', 'ss'].includes(a.type) || a.p !== opp(src.ctrl)) return false; const mine = monsOf(g, src.ctrl).length; if (!mine) return false;
      const after = monsOf(g, a.p).length + 1 - (a.type === 'ss' || !a.c || !D(a.c) ? 0 : tribs(a.c)); return after > mine; } },
    effs: [{ type: 'act', res: noop }] },
  'Kaiser Dragon': { effs: [] },
  // Port of classic-3.js: it also triggers when destroyed in the hand or Deck (Edison ruling).
  'Kaiser Glider': {
    self: { noBattleDestroy: (g, c) => { const b = g.battle; if (!b || (b.a !== c && b.t !== c)) return false; const o = b.a === c ? b.t : b.a; return !!o && onField(o) && faceUp(o) && atk(g, o) === atk(g, c); } },
    effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Return a monster to the hand',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.to === 'gy',
      cond: g => fieldMons(g).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which monster to the hand?', fieldMons(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone === 'm') toHand(g, t, p); } }] },
  // PARTIAL: with a face-up Kaiser Sea Horse, a LIGHT monster needs 1 Tribute, but any monster can be that Tribute.
  'Kaiser Sea Horse': { cont: { tributes: (g, s, c, p, need) => need === 2 && s.ctrl === p && c !== s && attr(c) === 'LIGHT' ? 1 : null } },

  /* ----- King ----- */
  // Port of goat-5.js (same Edison text). PARTIAL: other Dragons are untargetable for both players.
  'King Dragun': {
    self: { targetFilter: (g, x, L2) => fieldMons(g).some(k => k.zone === 'm' && faceUp(k) && named(k, 'King Dragun') && !k.flags.negated && L2.p !== k.ctrl) },
    cont: { grant: (g, src, c, flag) => flag === 'cantBeTargeted' && c.zone === 'm' && faceUp(c) && race(c) === 'Dragon' },
    effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Summon a Dragon from your hand',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Dragon' && !forbid(g, { type: 'ss', c: x, p, how: 'special' })),
      res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Dragon'); if (!cs.length || freeM(g, p) < 0) return;
        const [x] = yield* pick(g, p, 'Special Summon which Dragon from your hand?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  // From the hand it is a summon rule; from the GY it is offered as an effect. PARTIAL: the GY version uses a chain link.
  'King of the Beasts': {
    cont: { loc: 'hand', forbid: (g, src, a) => a.c === src && ['ns', 'ss'].includes(a.type) && fieldMons(g).some(x => faceUp(x) && named(x, 'King of the Beasts')) },
    proc: { label: 'Special Summon (Tribute a face-up Moja)', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && named(x, 'Moja')),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Tribute 1 face-up Moja', monsOf(g, p).filter(x => faceUp(x) && named(x, 'Moja')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} Tributed Moja.`); } } },
    effs: [{ type: 'ign', loc: 'gy', tags: { ss: 1 }, label: 'Tribute Moja: Special Summon from the GY',
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && named(x, 'Moja')) && !fieldMons(g).some(x => faceUp(x) && named(x, 'King of the Beasts')),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 face-up Moja', monsOf(g, p).filter(x => faceUp(x) && named(x, 'Moja')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Moja.`); } },
      res: function* (g, c, p) { if (c.zone === 'gy' && freeM(g, p) >= 0 && !fieldMons(g).some(x => faceUp(x) && named(x, 'King of the Beasts'))) ss(g, p, c, 'atk'); } }] },
  // PARTIAL: the count is added to its ATK (its printed ATK is ?), so Megamorph style "original ATK" effects don't see it.
  'King of the Skull Servants': {
    self: { atk: (g, c) => 1000 * g.p[c.ctrl].gy.filter(x => named(x, 'King of the Skull Servants') || named(x, 'Skull Servant')).length },
    effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Banish a Skull Servant: Special Summon this card',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
      cond: (g, c, p) => g.p[p].gy.some(x => x !== c && (named(x, 'King of the Skull Servants') || named(x, 'Skull Servant'))),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish 1 other King of the Skull Servants or Skull Servant from your GY', g.p[p].gy.filter(x => x !== c && (named(x, 'King of the Skull Servants') || named(x, 'Skull Servant'))), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
      res: function* (g, c, p) { if (c.zone === 'gy' && freeM(g, p) >= 0) ss(g, p, c, 'atk'); } }] },
  // ENGINE: ① (a substitute for any 1 listed Fusion Material) needs a name change hook in the Fusion material check.
  'King of the Swamp': { effs: [{ type: 'ign', loc: 'hand', label: 'Discard: add Polymerization',
    cond: (g, c, p) => g.p[p].deck.some(x => named(x, 'Polymerization')),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded King of the Swamp.`); },
    res: function* (g, c, p) { yield* search(g, p, x => named(x, 'Polymerization'), 'Add Polymerization from your Deck to your hand'); } }] },
  'King Pyron': { effs: [{ type: 'ign', opt: true, gemini: true, label: '1000 damage', res: function* (g, c, p) { damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },

  /* ----- Lady ----- */
  'Lady Assailant of Flames': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Banish 3 cards: 800 damage',
    on: (g, ev, c) => ev.type === 'flip' && ev.c === c, cond: (g, c, p) => g.p[p].deck.length >= 3,
    res: function* (g, c, p) { const d = g.p[p].deck; if (d.length < 3) return; for (let i = 0; i < 3; i++) move(g, d[d.length - 1], 'ban', { reason: 'effect', by: p }); log(g, `${PN(g, p)} banished the top 3 cards of the Deck.`); damage(g, opp(p), 800, { src: c, srcP: p }); } }] },
  'Lady Ninja Yae': { effs: [{ type: 'ign', label: 'Discard a WIND: return their Spells/Traps',
    cond: (g, c, p) => g.p[p].hand.some(x => isMon(x) && attr(x) === 'WIND') && stOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { yield* discardOne(g, p, g.p[p].hand.filter(x => isMon(x) && attr(x) === 'WIND'), 'Discard 1 WIND monster'); },
    res: function* (g, c, p) { const xs = stOf(g, opp(p)); for (const x of xs) move(g, x, 'hand', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.length} Spell/Trap Card(s) returned to ${PN(g, opp(p))}'s hand.`); } }] },
  // Same shape as Crimson Sentry (full-04.js): used before the battle, it returns the next one destroyed this turn.
  'Lady Panther': { effs: [bkMark,
    { type: 'ign', label: 'Tribute: return a battle-destroyed monster to the Deck',
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Lady Panther.`); },
      res: function* (g, c, p) { const cs = g.p[p].gy.filter(x => isMon(x) && x !== c && x.f10bk === g.turnNo);
        if (!cs.length) { c.f10pend = g.turnNo; log(g, 'The next monster of theirs destroyed by battle this turn goes on top of the Deck.'); return; }
        const [x] = yield* pick(g, p, 'Return which monster to the top of your Deck?', cs, 1, 1, 'good'); if (x) { move(g, x, 'deckTop', { reason: 'effect' }); log(g, `${D(x).n} went on top of the Deck.`); } } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return the destroyed monster',
      on: (g, ev, c) => { if (ev.type !== 'move' || !ev.battle || !ev.destroyed || ev.to !== 'gy') return false;
        if (c.f10pend === g.turnNo && ev.c.owner === c.owner && isMon(ev.c)) { c.f10pend = null; c.f10pendT = ev.c; return true; } return false; },
      res: function* (g, c) { const x = c.f10pendT; c.f10pendT = null; if (x && x.zone === 'gy') { move(g, x, 'deckTop', { reason: 'effect' }); log(g, `${D(x).n} went on top of the Deck.`); } } }] },

  /* ----- Last ----- */
  'Last Day of Witch': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(x => faceUp(x) && race(x) === 'Spellcaster'),
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => faceUp(x) && race(x) === 'Spellcaster'), { by: p, src: c }); } }] },
  // PARTIAL: Ancient City - Rainbow Ruins is placed in the Field Zone (not activated, so nothing can respond to it).
  // The opponent's face-up Field Spell is destroyed (one Field Spell on the field, 2010 rules).
  'Last Resort': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && g.p[p].deck.some(x => named(x, 'Ancient City - Rainbow Ruins')),
    target: function* (g, c, p, L2) { const f = g.p[opp(p)].fz; L2.data.had = !!(f && faceUp(f)); },
    res: function* (g, c, p, L2) { const cs = g.p[p].deck.filter(x => named(x, 'Ancient City - Rainbow Ruins')); if (!cs.length) { shuffleDeck(g, p); return; }
      const [x] = yield* pick(g, p, 'Activate Ancient City - Rainbow Ruins from your Deck', cs, 1, 1, 'good'); if (!x) return;
      if (g.p[p].fz) destroy(g, [g.p[p].fz], { rule: true });
      move(g, x, 'fz', { ctrl: p, pos: 'up', reason: 'activate' }); shuffleDeck(g, p); log(g, `${PN(g, p)} activated Ancient City - Rainbow Ruins from the Deck.`);
      const of = g.p[opp(p)].fz; if (of && faceUp(of)) destroy(g, [of], { rule: true });
      if (L2.data.had) draw(g, opp(p), 1); } }] },
  // Port of goat-6.js. PARTIAL: the forced attack is worked out inside the card (no Damage Step windows). The End Phase
  // check ends the duel: one monster alone on the field wins, else a draw.
  'Last Turn': { effs: [
    { type: 'act', cond: (g, c, p) => g.tp !== p && g.p[p].lp <= 1000 && monsOf(g, p).length > 0,
      res: function* (g, c, p) {
        const o = opp(p); const [m] = yield* pick(g, p, 'Select 1 monster you control', monsOf(g, p), 1, 1, 'good');
        const rest = allField(g).filter(x => x !== m && x !== c);
        for (const x of rest) move(g, x, 'gy', { reason: 'effect', by: p });
        for (const q of [p, o]) for (const x of g.p[q].hand.slice()) move(g, x, 'gy', { reason: 'effect', by: p });
        log(g, 'Every other card on the field and in both hands went to the GY.');
        g.lastTurn = { turn: g.turnNo, u: c.u };
        const ms = g.p[o].deck.filter(x => isMon(x) && !['ritual', 'token'].includes(D(x).k) && !/Cannot be Special Summoned/i.test(tx(x)));
        if (!ms.length || freeM(g, o) < 0) return;
        const [x] = yield* pick(g, o, 'Special Summon which monster from your Deck?', ms, 1, 1, 'good'); shuffleDeck(g, o);
        if (!x || !ss(g, o, x, 'atk')) return;
        if (!m || !onField(m) || !onField(x)) return;
        x.attacks = 1; log(g, `${name(x)} attacks ${m.pos === 'set' ? 'a face-down monster' : name(m)}.`);
        if (m.pos === 'set') { m.pos = 'def'; g.seq++; log(g, `The face-down monster was ${name(m)}.`); emit(g, { type: 'flip', c: m, p, battle: true }); }
        const A = stat(g, x, 'atk'); let dead = [];
        if (m.pos === 'atk') { const T = stat(g, m, 'atk'); if (A > T) dead = [[m, x]]; else if (A < T) dead = [[x, m]]; else if (A > 0) dead = [[m, x], [x, m]]; }
        else if (A > stat(g, m, 'def')) dead = [[m, x]];
        for (const [v, k] of dead) destroy(g, [v], { battle: true, killer: k });
        log(g, 'Battle damage from this battle is 0.');
      } },
    { type: 'trig', loc: 'any', res: noop,
      on: (g, ev, c) => {
        if (g.lastTurn && g.lastTurn.u === c.u && ((ev.type === 'phase' && ev.ph === 'end' && g.lastTurn.turn === g.turnNo) || g.turnNo > g.lastTurn.turn)) {
          g.lastTurn = null; const all = allField(g);
          if (all.length === 1 && isMon(all[0]) && all[0].zone === 'm') over(g, all[0].ctrl, `Last Turn: ${PN(g, all[0].ctrl)}'s monster is alone on the field`);
          over(g, -1, 'Last Turn: no monster is alone on the field, so the duel is a draw');
        }
        return false; } }] },
  // Port of goat-7.js. PARTIAL: the Special Summon happens when it resolves, not at a later moment of your choice.
  'Last Will': { effs: [
    { type: 'trig', loc: 'any', on: (g, ev) => { if (ev.type === 'move' && ev.wasField && ev.to === 'gy' && ev.snap && ev.snap.mon && ev.prevCtrl === ev.c.owner) (g.lastWill || (g.lastWill = {}))[ev.c.owner] = g.turnNo; return false; }, res: noop },
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.lastWill && g.lastWill[p] === g.turnNo && freeM(g, p) >= 0 && g.p[p].deck.some(lwFrom),
      res: function* (g, c, p) { const cs = g.p[p].deck.filter(x => lwFrom(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' }));
        if (cs.length && freeM(g, p) >= 0) { const [x] = yield* pick(g, p, 'Special Summon a monster with 1500 or less ATK from your Deck', cs, 1, 1, 'good');
          if (x) ss(g, p, x, yield* pos2(g, p, x)); }
        shuffleDeck(g, p); } }] },

  /* ----- Lava ----- */
  'Lava Battleguard': { self: { atk: (g, c) => 500 * monsOf(g, c.ctrl).filter(x => faceUp(x) && named(x, 'Swamp Battleguard')).length } },
  'Lava Dragon': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Tribute: summon 2 Level 3 or lower Dragons',
    cond: (g, c, p) => c.pos === 'def' && nFreeM(g, p) >= 1 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Dragon' && lv(x) <= 3) && g.p[p].gy.some(x => isMon(x) && race(x) === 'Dragon' && lv(x) <= 3),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Lava Dragon.`); },
    res: function* (g, c, p) {
      const h = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Dragon' && lv(x) <= 3), y = g.p[p].gy.filter(x => x !== c && isMon(x) && race(x) === 'Dragon' && lv(x) <= 3);
      if (!h.length || !y.length || nFreeM(g, p) < 2) { log(g, 'Lava Dragon’s effect could not Special Summon both Dragons.'); return; }
      const [a] = yield* pick(g, p, 'Special Summon a Level 3 or lower Dragon from your hand', h, 1, 1, 'good');
      const [b] = yield* pick(g, p, 'Special Summon a Level 3 or lower Dragon from your GY', y, 1, 1, 'good');
      if (a) ss(g, p, a, 'atk'); if (b && b.zone === 'gy') ss(g, p, b, 'atk'); } }] },
  // Port of goat-2.js.
  'Lava Golem': {
    proc: { label: 'Special Summon to their field (Tribute 2 of their monsters)', cond: (g, c, p) => monsOf(g, opp(p)).length >= 2 && g.ns[p] < 1,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Tribute 2 monsters your opponent controls', monsOf(g, opp(p)), 2, 2, 'bad');
        for (const x of xs) move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed 2 of ${PN(g, opp(p))}'s monsters.`);
        c.flags.lavaTo = opp(p); addRule(g, (g2, a) => (a.type === 'ns' || a.type === 'set') && a.p === p, { end: g.turnNo }); } },
    effs: [
      { type: 'trig', on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.to === 'm' && c.flags.lavaTo != null) { const to = c.flags.lavaTo; c.flags.lavaTo = null; if (c.ctrl !== to) takeControl(g, to, c, false); } return false; }, res: noop },
      { type: 'trig', mand: true, label: 'Take 1000 damage', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
        res: function* (g, c, p) { damage(g, p, 1000, { src: c, srcP: p }); } }] },

  /* ----- Legendary ----- */
  'Legendary Black Belt': { cont: {},
    effs: [spellAct(m => ['Chu-Ske the Mouse Fighter', 'Monk Fighter', 'Master Monk'].includes(name(m)), 'Equip to which monster?'),
      { type: 'trig', loc: 'st', mand: true, label: 'Damage equal to its DEF',
        on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && ev.killer && c.equipTo && ev.killer.u === c.equipTo && ev.prevCtrl !== c.ctrl && ev.c.zone === 'gy',
        res: function* (g, c, p, L2) { const n = num(D(L2.ev.c).def); if (n > 0) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  'Legendary Ebon Steed': {
    cont: { ...eqBonus(200, 200), replaceDestroy: (g, src, c, o) => { if (!onField(src) || src.equipTo !== c.u) return false; return destroy(g, [src], { by: o.by }).length > 0; } },
    effs: [spellAct(isSixSam, 'Equip to which Six Samurai monster?')] },
  'Legendary Fiend': { effs: [{ type: 'trig', mand: true, opt: true, label: 'Gain 700 ATK', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 700 }); log(g, `${name(c)} gained 700 ATK.`); } } }] },
  'Legendary Flame Lord': { effs: [spellCounter,
    { type: 'ign', tags: { destroy: 1 }, label: 'Remove 3 Spell Counters: destroy all other monsters',
      cond: (g, c) => ctr(c, 'spell') >= 3 && fieldMons(g).some(x => x !== c),
      cost: function* (g, c) { addCtr(g, c, 'spell', -3); log(g, 'Legendary Flame Lord removed 3 Spell Counters.'); },
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => x !== c), { by: p }); } }] },
  'Legendary Sword': { cont: eqBonus(300, 300), effs: [spellAct(m => race(m) === 'Warrior', 'Equip to which Warrior?')] },

  /* ----- Level ----- */
  // The Level change is a flag; on the field it ends with the turn (lvUntil), in the hand a watcher clears it next turn.
  'Level Conversion Lab': { effs: [
    { type: 'trig', loc: 'any', res: noop, on: (g) => { for (const P of g.p) for (const x of P.hand) if (x.flags.f10lab != null && x.flags.f10lab !== g.turnNo) { x.flags.lv = null; x.flags.lvUntil = null; x.flags.f10lab = null; } return false; } },
    { type: 'act', cond: (g, c, p) => g.p[p].hand.some(isMon),
      res: function* (g, c, p) { const ms = g.p[p].hand.filter(isMon); if (!ms.length) return;
        const [x] = yield* pick(g, p, 'Show which monster in your hand?', ms, 1, 1, 'good'); if (!x) return; log(g, `${PN(g, p)} showed ${name(x)}.`);
        const n = dice(g, p);
        if (n === 1) { move(g, x, 'gy', { reason: 'effect', by: p }); log(g, `${name(x)} was sent to the GY.`); }
        else { x.flags.lv = n; x.flags.lvUntil = true; x.flags.f10lab = g.turnNo; log(g, `${name(x)} is Level ${n} this turn.`); } } }] },
  'Level Down': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: g => fieldMons(g).some(x => faceUp(x) && isLV(x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which face-up LV monster?', fieldMons(g).filter(x => faceUp(x) && isLV(x)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const k = lvBase(D(t).n), o = t.owner;
      move(g, t, 'deck', { reason: 'effect', by: p }); log(g, `${D(t).n} was shuffled into the Deck.`); if (!k) return;
      const cs = g.p[o].gy.filter(x => { const b = lvBase(D(x).n); return isMon(x) && b && b.base === k.base && b.lv < k.lv; }); if (!cs.length || freeM(g, o) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which lower LV monster?', cs, 1, 1, 'good'); if (x) ss(g, o, x, 'atk'); } }] },
  // The summoned monster can't attack and its effects are negated this turn (this card's GY static; a face-down flip ends it).
  'Level Modulation': {
    cont: { loc: 'gy', negates: (g, src, c) => c.flags.f10mod === g.turnNo, forbid: (g, src, a) => a.type === 'attack' && a.c && a.c.flags.f10mod === g.turnNo },
    effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.p[opp(p)].deck.length >= 2 && freeM(g, p) >= 0 && g.p[p].gy.some(isLV),
      res: function* (g, c, p) { draw(g, opp(p), 2); const cs = g.p[p].gy.filter(isLV); if (!cs.length || freeM(g, p) < 0) return;
        const [x] = yield* pick(g, p, 'Special Summon which LV monster from your GY?', cs, 1, 1, 'good'); if (x && ss(g, p, x, 'atk')) { x.flags.f10mod = g.turnNo; g.seq++; } } }] },
  'Level Retuner': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && lv(x) > 1),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target 1 face-up monster you control', monsOf(g, p).filter(x => faceUp(x) && lv(x) > 1), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const l = lv(t);
      const n = l > 2 ? 1 + (yield* choose(g, p, `Reduce ${name(t)}'s Level by how much?`, ['1', '2'])) : 1;
      t.flags.lv = Math.max(1, l - n); t.flags.lvUntil = null; log(g, `${name(t)} is now Level ${t.flags.lv}.`); } }] },
  'Level Tuning': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(faceUp),
    res: function* (g, c, p) { const ms = monsOf(g, p).filter(x => faceUp(x) && lv(x) > 0); for (const m of ms) { m.flags.lv = Math.max(1, lv(m) - 1); m.flags.lvUntil = true; } if (ms.length) log(g, `${PN(g, p)}'s face-up monsters lost 1 Level until the End Phase.`); } }] },
  'Level Up!': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && isLV(m) && [...g.p[p].hand, ...g.p[p].deck].some(x => isMon(x) && x !== m && D(x).n !== D(m).n && tx(m).includes(`"${D(x).n}"`))),
    cost: function* (g, c, p, L2) {
      const ms = monsOf(g, p).filter(m => faceUp(m) && isLV(m) && [...g.p[p].hand, ...g.p[p].deck].some(x => isMon(x) && D(x).n !== D(m).n && tx(m).includes(`"${D(x).n}"`)));
      const [m] = yield* pick(g, p, 'Send which face-up LV monster to the GY?', ms, 1, 1, 'cost'); if (!m) return;
      L2.data.txt = tx(m); L2.data.n = D(m).n; move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(m).n} to the GY.`); },
    res: function* (g, c, p, L2) { if (!L2.data.txt) return; const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => isMon(x) && D(x).n !== L2.data.n && L2.data.txt.includes(`"${D(x).n}"`));
      if (!cs.length || freeM(g, p) < 0) { shuffleDeck(g, p); return; }
      const [x] = yield* pick(g, p, 'Special Summon which monster (ignoring its Summoning conditions)?', cs, 1, 1, 'good');
      if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } else shuffleDeck(g, p); } }] },
  // PARTIAL: with no monsters on the field its Normal Summon is always as a Level 2 monster (no choice).
  'Level Warrior': {
    proc: { label: 'Special Summon as a Level 4 monster', cond: (g, c, p) => monsOf(g, p).length === 0 && monsOf(g, opp(p)).length > 0,
      cost: function* (g, c) { c.flags.lv = 4; log(g, 'Level Warrior is Special Summoned as a Level 4 monster.'); } },
    effs: [{ type: 'trig', res: noop, on: (g, ev, c) => { if (evSummoned(ev, c, ['normal']) && !fieldMons(g).some(x => x !== c)) { c.flags.lv = 2; log(g, 'Level Warrior was Normal Summoned as a Level 2 monster.'); } return false; } }] },
});

/* Goat-only cards in this batch */
E.addScripts({
  'Jinzo #7': { self: { directAttack: true } },
}, 'goat');
})();
