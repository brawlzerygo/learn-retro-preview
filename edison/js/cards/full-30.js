/* Full pool batch 30: Barrier Statues to D - Time (build/batches/full/full-30.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text and rulings. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, takeControl, negate, addMod, equip, addCtr, ctr,
  endBattle, addRule, tokens, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf,
  fieldOf, allField, fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp, oppFaceUp, stOnField,
  spellTrapAct, evSummoned, emit, forbid, stat, negd, num, isEHERO } = L;
const atk = L.atk;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const actNoop = { type: 'act', res: noop };
const isDHERO = x => /^Destiny HERO/.test(name(x));
const isCB = x => /^Crystal Beast/.test(D(x).n);
const isCBMon = x => isMon(x) && isCB(x);
const cbST = (g, p) => g.p[p].st.filter(x => x && faceUp(x) && isCB(x)); // "Crystal Beast" cards in your Spell & Trap Zone
const isCloud = x => /^Cloudian/.test(name(x));
const isKoaki = x => isMon(x) && /Koa'ki Meiru/.test(name(x));
const fogOnField = g => fieldMons(g).reduce((s, x) => s + ctr(x, 'fog'), 0);
const canSS = (g, p, x) => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' });
const neoSpace = g => [g.p[0].fz, g.p[1].fz].some(x => x && faceUp(x) && named(x, 'Neo Space'));
const mainPh = g => ['main1', 'main2'].includes(g.phase);

// change a monster's battle position by an effect (a face-down monster is flipped into Attack Position; its Flip effect can activate)
function flipPos(g, t) {
  if (!onField(t) || t.zone !== 'm') return;
  if (t.pos === 'set') { t.pos = 'atk'; g.seq++; log(g, `The face-down monster was ${name(t)}. It is now in Attack Position.`); emit(g, { type: 'flip', c: t, p: t.ctrl }); return; }
  const from = t.pos; t.pos = from === 'atk' ? 'def' : 'atk'; g.seq++;
  log(g, `${name(t)} was changed to ${t.pos === 'atk' ? 'Attack' : 'Defense'} Position.`); emit(g, { type: 'pos', c: t, p: t.ctrl, from });
}
const toDef = (g, t) => { if (onField(t) && t.zone === 'm' && t.pos === 'atk') flipPos(g, t); };

// A Trap that activates when something happens (same as full-26.js): offered as an optional trigger while Set.
// ENGINE: no response window after a battle destruction or a monster leaving the field (build/ENGINE_TODO.md).
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });

// Summon locks: one duel-long rule, installed by the first event any of these cards sees (a trig that never fires; as full-04.js).
const LOCKS = {
  // "This card Cannot be Special Summoned"
  'Cloudian - Ghost Fog': () => true,
  // "Must first be Special Summoned (from your hand) by banishing 1 Cloudian": from the GY or banished only once properly summoned.
  // PARTIAL: an effect that Special Summons it from the hand is not stopped.
  'Cloudian - Storm Dragon': (g, a) => ['deck', 'extra'].includes(a.c.zone) || (['gy', 'ban'].includes(a.c.zone) && !a.c.f30nomi),
  // "Cannot be Special Summoned except by Fusion Summon"
  'Cyberdark Dragon': (g, a) => a.how !== 'fusion',
};
const lockInstall = { type: 'trig', loc: 'any', res: noop,
  on: (g) => { if (!g.f30lock) { g.f30lock = true; addRule(g, (g2, a) => { if (a.type !== 'ss' || !a.c || !a.c.id) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); } return false; } };

/* ----- Barrier Statues ----- */
const statue = at => ({ cont: { forbid: (g, src, a) => a.type === 'ss' && !!a.c && attr(a.c) !== at }, effs: [] });

/* ----- Chrysalis: Tribute this card while Neo Space is on the field to summon its Neo-Spacian from the hand or Deck ----- */
const chrysalis = ns => ({ effs: [{ type: 'ign', tags: { ss: 1 }, label: `Tribute: Special Summon ${ns}`,
  cond: (g, c, p) => neoSpace(g) && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, ns) && canSS(g, p, x)),
  cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(c).n}.`); },
  res: function* (g, c, p) {
    if (!neoSpace(g)) { log(g, 'Neo Space is gone, so nothing was summoned.'); return; }   // ruling: Neo Space must still be there
    const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, ns)); if (!cs.length || freeM(g, p) < 0) { shuffleDeck(g, p); return; }
    const [x] = yield* pick(g, p, `Special Summon ${ns} from your hand or Deck`, cs, 1, 1, 'good');
    if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } } }] });

/* ----- Cloudians ----- */
// "If this card is in face-up Defense Position, destroy it." (as batch-5.js: a mandatory trigger after the next event that shows it,
// which includes the position-change, flip and summon events). PARTIAL: it uses a chain link.
const cloudDoom = { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroyed in face-up Defense Position',
  on: (g, ev, c) => c.zone === 'm' && faceUp(c) && c.pos === 'def' && ev.type !== 'damage',
  cond: (g, c) => onField(c) && faceUp(c) && c.pos === 'def',
  res: function* (g, c, p) { if (onField(c) && faceUp(c) && c.pos === 'def') destroy(g, [c], { by: p }); } };
function* placeFog(g, p, n) {
  for (let i = 0; i < n; i++) {
    const ms = fieldMons(g).filter(faceUp); if (!ms.length) return;
    const [x] = yield* pick(g, p, `Place a Fog Counter on which monster? (${n - i} left)`, ms, 1, 1, 'good');
    if (x) { addCtr(g, x, 'fog', 1); log(g, `A Fog Counter was placed on ${name(x)}.`); }
  }
  g.seq++;
}
// Cloudian Tokens can only be Tributed for a Cloudian's Tribute Summon. PARTIAL: tributeCands can't see which monster is being
// summoned, so they count as Tributes while their controller holds a Level 5 or higher Cloudian (and not otherwise).
function cloudTokenLock(g, t) {
  try { Object.defineProperty(t.flags, 'noTribute', { configurable: true, enumerable: true, get: () => !(onField(t) && g.p[t.ctrl].hand.some(x => isMon(x) && isCloud(x) && lv(x) >= 5)) }); }
  catch (e) { t.flags.noTribute = true; }
}

/* ----- Crystal Beasts ----- */
// "If this face-up card is destroyed while in a Monster Zone, you can place it face-up in your Spell & Trap Zone instead."
// Same as batch-5.js's Crystal Beasts (cbStay), so they all play alike and Crystal Pair still sees the card reach the GY.
// PARTIAL: the engine's replacement hook can't ask, so the card reaches the GY first and is then placed from there.
const cbStay = { type: 'trig', loc: 'gy', label: 'Place it as a Continuous Spell',
  on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.destroyed && ev.wasField && ev.from === 'm' && ev.to === 'gy' && ev.snap && ev.snap.faceUp,
  cond: (g, c, p) => c.zone === 'gy' && freeST(g, p) >= 0,
  res: function* (g, c, p) { if (c.zone === 'gy' && placeCB(g, p, c)) emit(g, { type: 'cbPlace', p }); } };
function placeCB(g, p, x) {
  if (freeST(g, p) < 0) return false;
  const from = x.zone; move(g, x, 'st', { ctrl: p, pos: 'up', reason: 'effect' }); if (from === 'deck') shuffleDeck(g, p);
  log(g, `${PN(g, p)} placed ${D(x).n} in the Spell & Trap Zone as a Continuous Spell.`); return true;
}

/* ----- Cyberdark ----- */
// the Dragon equipped by this card's own effect
const cdEq = (g, c) => stOf(g, c.ctrl).find(x => x.equipTo === c.u && isMon(x) && x.f30cd === c.u) || null;
function cdEquip(g, c, p, x) {
  if (!x || x.zone !== 'gy' || !onField(c) || !faceUp(c) || freeST(g, p) < 0) return false;
  move(g, x, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p }); x.equipTo = c.u; x.f30cd = c.u; g.seq++;
  log(g, `${D(x).n} was equipped to ${name(c)}.`); return true;
}
const cdReplace = (g, c, o) => { if (!o.battle) return false; const eq = cdEq(g, c); if (!eq) return false;
  move(g, eq, 'gy', { reason: 'effect', destroyed: true, noLater: true }); log(g, `${D(eq).n} was destroyed instead of ${name(c)}.`); g.seq++; return true; };
const cdSmall = x => isMon(x) && race(x) === 'Dragon' && lv(x) <= 3;
const cdEquipTrig = { type: 'trig', mand: true, label: 'Equip a Level 3 or lower Dragon from your GY', on: (g, ev, c) => evSummoned(ev, c, ['normal']),
  cond: (g, c, p) => g.p[p].gy.some(cdSmall),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip which Level 3 or lower Dragon from your GY?', g.p[p].gy.filter(cdSmall), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { cdEquip(g, c, p, L2.t[0]); } };
const cdLord = c => isMon(c) && ['Cyberdark Horn', 'Cyberdark Edge', 'Cyberdark Keel'].includes(D(c).n);

// Cyber Dragon, or a Fusion Monster that lists it as a material (Cybernetic Hidden Technology)
const listsCyber = x => named(x, 'Cyber Dragon') || name(x) === 'Cyber Dragon' || (D(x).k === 'fusion' && /"Cyber Dragon"/.test((D(x).ps || D(x).tx || '').split('\n')[0]));

E.addScripts({
  /* ----- Barrier Statues ----- */
  'Barrier Statue of the Abyss': statue('DARK'),
  'Barrier Statue of the Drought': statue('EARTH'),
  'Barrier Statue of the Heavens': statue('LIGHT'),
  'Barrier Statue of the Inferno': statue('FIRE'),
  'Barrier Statue of the Stormwinds': statue('WIND'),
  'Barrier Statue of the Torrent': statue('WATER'),

  // Exact for attacks. PARTIAL / ENGINE: cont.grant gets no chain link, so its other face-up monsters can't be targeted by any card
  // effect while it is face-up (the text only stops the opponent's Spell/Trap effects).
  'Belial - Marquis of Darkness': {
    cont: { grant: (g, src, c, flag) => (flag === 'noAttackTarget' || flag === 'cantBeTargeted') && c.zone === 'm' && c.ctrl === src.ctrl && faceUp(c) && !named(c, 'Belial - Marquis of Darkness') },
    effs: [] },

  /* ----- Blackwings ----- */
  'Blackwing - Elphin the Raven': {
    self: { tributes: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && L.isBW(x)) ? [0] : [] },
    effs: [{ type: 'trig', when: true, label: 'Change a monster\'s battle position', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
      cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change the battle position of which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) flipPos(g, t); } }] },
  'Blackwing - Fane the Steel Chain': { self: { directAttack: true },
    effs: [{ type: 'trig', mand: true, label: 'Change an Attack Position monster to Defense',
      on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.direct && ev.src === c && ev.p !== c.ctrl,
      cond: (g, c, p) => monsOf(g, opp(p)).some(x => x.pos === 'atk'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change which Attack Position monster to Defense Position?', monsOf(g, opp(p)).filter(x => x.pos === 'atk'), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) toDef(g, t); } }] },
  // PARTIAL: the "next battle damage is 0" shield sits on this card in the GY, so it ends if the card leaves the GY that turn.
  'Blackwing - Mistral the Silver Shield': {
    cont: { loc: 'gy', dmg: (g, src, p, n, o) => { if (!o.battle || n <= 0 || p !== src.owner || !g.f30mis || g.f30mis[p] !== g.turnNo) return undefined; g.f30mis[p] = null; log(g, `Mistral reduced the battle damage to ${PN(g, p)} to 0.`); return 0; } },
    effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Next battle damage this turn becomes 0',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy',
      res: function* (g, c, p) { g.f30mis = g.f30mis || {}; g.f30mis[p] = g.turnNo; log(g, `The next battle damage ${PN(g, p)} would take this turn becomes 0.`); } }] },

  'Bonding - H2O': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).filter(x => named(x, 'Hydrogeddon')).length >= 2 && monsOf(g, p).some(x => named(x, 'Oxygeddon'))
      && [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].some(x => named(x, 'Water Dragon') && canSS(g, p, x)),
    cost: function* (g, c, p) {
      const hs = yield* pick(g, p, 'Tribute 2 Hydrogeddon', monsOf(g, p).filter(x => named(x, 'Hydrogeddon')), 2, 2, 'cost');
      const [o] = yield* pick(g, p, 'Tribute 1 Oxygeddon', monsOf(g, p).filter(x => named(x, 'Oxygeddon')), 1, 1, 'cost');
      const grp = g.group; for (const x of [...hs, o].filter(Boolean)) move(g, x, 'gy', { reason: 'cost', by: p, group: grp });
      log(g, `${PN(g, p)} Tributed 2 Hydrogeddon and 1 Oxygeddon.`); },
    res: function* (g, c, p) {
      const cs = [...g.p[p].hand, ...g.p[p].deck, ...g.p[p].gy].filter(x => named(x, 'Water Dragon')); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon Water Dragon from your hand, Deck or GY', cs, 1, 1, 'good');
      if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } } }] },
  'Boot-Up Soldier - Dread Dynamo': { self: { atk: (g, c) => monsOf(g, c.ctrl).some(x => faceUp(x) && /Gadget/.test(name(x))) ? 2000 : 0 }, effs: [] },
  'Change of Hero - Reflector Ray': { effs: [trapTrig({ label: 'Inflict damage equal to its Level x 300',
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.wasField && ev.to === 'gy' && ev.prevCtrl === c.ctrl && D(ev.c).k === 'fusion' && /^Elemental HERO/.test(D(ev.c).n),
    target: function* (g, c, p, L2) { L2.data.n = num(D(L2.ev.c).lv) * 300; },
    res: function* (g, c, p, L2) { damage(g, opp(p), L2.data.n, { src: c, srcP: p }); } })] },

  /* ----- Chrysalis ----- */
  'Chrysalis Chicky': chrysalis('Neo-Spacian Air Hummingbird'),
  'Chrysalis Dolphin': chrysalis('Neo-Spacian Aqua Dolphin'),
  'Chrysalis Larva': chrysalis('Neo-Spacian Flare Scarab'),
  'Chrysalis Mole': chrysalis('Neo-Spacian Grand Mole'),
  'Chrysalis Pantail': chrysalis('Neo-Spacian Dark Panther'),
  'Chrysalis Pinny': chrysalis('Neo-Spacian Glow Moss'),

  /* ----- Chthonian ----- */
  // PARTIAL / ENGINE: name() can't be changed by a script, so cards "treated as" another name (Cyber Harpie Lady) only count by their own name.
  'Chthonian Alliance': {
    cont: { atk: (g, src, m) => src.equipTo === m.u ? 800 * fieldMons(g).filter(x => x !== m && faceUp(x) && name(x) === name(m)).length : 0 },
    effs: [{ type: 'act', cond: g => fieldMons(g).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c)) equip(g, c, t); } }] },
  // Not when the monster is destroyed by an effect in the Damage Step, or with chain links still left to resolve (rulings).
  'Chthonian Blast': { effs: [trapTrig({ label: 'Destroy the lowest ATK monster', tags: { destroy: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.destroyed && ev.wasField && ev.from === 'm' && ev.to === 'gy' && ev.prevCtrl === c.ctrl && ev.snap && ev.snap.faceUp
      && (ev.battle || !g.inDS) && !g.chain.length,
    cond: g => fieldMons(g).some(faceUp),
    res: function* (g, c, p) {
      const ms = fieldMons(g).filter(faceUp); if (!ms.length) return;
      const lo = Math.min(...ms.map(x => atk(g, x))); const cs = ms.filter(x => atk(g, x) === lo);
      const [t] = cs.length > 1 ? yield* pick(g, p, 'Destroy which monster with the lowest ATK?', cs, 1, 1, 'bad') : cs; if (!t) return;
      const a = atk(g, t); if (!destroy(g, [t], { by: p, src: c }).length) return;
      const n = Math.floor(a / 2); if (n > 0) { damage(g, p, n, { src: c, srcP: p }); damage(g, opp(p), n, { src: c, srcP: p }); } } })] },
  'Chthonian Emperor Dragon': { self: { maxAttacks: (g, c) => c.flags.gemini ? 2 : 1 }, effs: [] },
  'Chthonian Polymer': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.sw && g.sw.p !== p && g.sw.how === 'fusion' && g.sw.cs.some(x => onField(x) && x.ctrl !== p) && monsOf(g, p).length > 0,
    cost: function* (g, c, p, L2) { L2.data.cs = g.sw.cs.slice(); const [x] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    target: function* (g, c, p, L2) { L2.t = L2.data.cs.filter(x => onField(x) && x.ctrl !== p); },
    res: function* (g, c, p, L2) { const t = live(L2).find(x => x.ctrl !== p); if (t) takeControl(g, p, t, false); } }] },
  // The damage is effect damage equal to the battle damage its controller took in that battle.
  'Chthonian Soldier': { effs: [
    { type: 'trig', faceDownOk: true, res: noop, on: (g, ev, c) => { if (ev.type === 'damage' && ev.battle && ev.p === c.ctrl && g.battle && (g.battle.t === c || g.battle.a === c)) g.f30cs = { u: c.u, n: ev.n, turn: g.turnNo }; return false; } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Inflict the same battle damage to the opponent',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.wasField && ev.to === 'gy' && !!ev.killer && !!g.battle && g.battle.a === ev.killer && ev.killer.ctrl !== ev.prevCtrl
        && !!g.f30cs && g.f30cs.u === c.u && g.f30cs.turn === g.turnNo && g.f30cs.n > 0,
      target: function* (g, c, p, L2) { L2.data.n = g.f30cs.n; g.f30cs = null; },
      res: function* (g, c, p, L2) { damage(g, opp(p), L2.data.n, { src: c, srcP: p }); } }] },

  /* ----- Cloudians ----- */
  'Cloudian - Eye of the Typhoon': { self: { noBattleDestroy: true }, effs: [cloudDoom,
    { type: 'trig', mand: true, label: 'Change the positions of all non-Cloudian monsters', on: (g, ev, c) => ev.type === 'attack' && ev.a === c,
      cond: g => fieldMons(g).some(x => faceUp(x) && !isCloud(x)),
      res: function* (g) { for (const x of fieldMons(g).filter(x => faceUp(x) && !isCloud(x))) flipPos(g, x); } }] },
  'Cloudian - Ghost Fog': {
    cont: { dmg: (g, src, p, n, o) => o.battle && g.battle && (g.battle.a === src || g.battle.t === src) ? 0 : undefined },
    effs: [lockInstall,
      { type: 'trig', loc: 'gy', mand: true, label: 'Distribute Fog Counters',
        on: (g, ev, c) => { if (!(ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.wasField && ev.to === 'gy' && !!ev.killer)) return false; c.f30k = ev.killer; return true; },
        target: function* (g, c, p, L2) { L2.data.n = c.f30k ? lv(c.f30k) : 0; },
        res: function* (g, c, p, L2) { yield* placeFog(g, p, L2.data.n); } }] },
  // PARTIAL: with 2 or more WATER monsters it offers extra Tributes (up to all of your WATER monsters), but the engine doesn't check
  // that the extra Tributes are WATER, and the offer is also made when Setting. Fog Counters: 1 for each WATER monster Tributed.
  'Cloudian - Nimbusman': { self: { noBattleDestroy: true, atk: g => 500 * fogOnField(g),
    tributes: (g, c, p) => { const n = monsOf(g, p).filter(x => faceUp(x) && attr(x) === 'WATER').length; const out = []; for (let i = 2; i <= n; i++) out.push(i); return out; } },
    effs: [cloudDoom,
      { type: 'trig', mand: true, label: 'Place Fog Counters', on: (g, ev, c) => evSummoned(ev, c, ['tribute']) && (ev.tribs || []).some(x => attr(x) === 'WATER'),
        res: function* (g, c, p, L2) { if (!onField(c) || !faceUp(c)) return; const n = (L2.ev.tribs || []).filter(x => attr(x) === 'WATER').length; addCtr(g, c, 'fog', n); g.seq++; log(g, `${n} Fog Counter${n === 1 ? ' was' : 's were'} placed on ${name(c)}.`); } }] },
  'Cloudian - Poison Cloud': { effs: [
    { type: 'trig', faceDownOk: true, res: noop, on: (g, ev, c) => { if (ev.type === 'dsStart' && (ev.a === c || ev.t === c)) c.flags.f30up = faceUp(c); return false; } },
    { type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy the monster that destroyed it',
      on: (g, ev, c) => { if (!(ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.wasField && ev.to === 'gy' && !!ev.killer && !!(ev.snap && ev.snap.flags && ev.snap.flags.f30up))) return false; c.f30k = ev.killer; return true; },
      target: function* (g, c, p, L2) { L2.data.k = c.f30k; },
      res: function* (g, c, p, L2) { const k = L2.data.k; if (k && onField(k) && destroy(g, [k], { by: p }).length) damage(g, opp(p), 800, { src: c, srcP: p }); } }] },
  'Cloudian - Sheep Cloud': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon 2 Cloudian Tokens',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.wasField && ev.to === 'gy',
    res: function* (g, c, p) { const ts = tokens(g, p, { n: 'Cloudian Token', a: 'WATER', r: 'Fairy', lv: 1, atk: 0, def: 0 }, 2, 'def'); for (const t of ts) cloudTokenLock(g, t); } }] },
  'Cloudian - Storm Dragon': {
    proc: { label: 'Special Summon (banish a Cloudian from your GY)',
      cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && isCloud(x)),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish which Cloudian from your GY?', g.p[p].gy.filter(x => isMon(x) && isCloud(x)), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } c.f30proc = true; } },
    self: { noBattleDestroy: true },
    effs: [lockInstall, cloudDoom,
      { type: 'trig', on: (g, ev, c) => { if (ev.type === 'summon' && ev.cs.includes(c) && c.f30proc) { c.f30nomi = true; c.f30proc = false; } return false; }, res: noop },
      { type: 'ign', opt: true, label: 'Place a Fog Counter', cond: g => fieldMons(g).some(faceUp),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Place a Fog Counter on which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addCtr(g, t, 'fog', 1); g.seq++; log(g, `A Fog Counter was placed on ${name(t)}.`); } } }] },
  'Cloudian Squall': { effs: [actNoop,
    { type: 'trig', loc: 'st', mand: true, label: 'Place a Fog Counter on every face-up monster', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c) { if (!onField(c) || !faceUp(c)) return; const ms = fieldMons(g).filter(faceUp); for (const x of ms) addCtr(g, x, 'fog', 1); g.seq++; if (ms.length) log(g, 'A Fog Counter was placed on every face-up monster.'); } }] },

  // PARTIAL: the discard that saves it is made automatically (the replacement hook can't ask).
  'Colosseum - Cage of the Gladiator Beasts': {
    cont: {
      atk: (g, src, m) => /^Gladiator Beast/.test(name(m)) ? 100 * ctr(src, 'colo') : 0,
      def: (g, src, m) => /^Gladiator Beast/.test(name(m)) ? 100 * ctr(src, 'colo') : 0,
      replaceDestroy: (g, src, v, o) => {
        if (v !== src || o.battle || o.rule) return false;
        const x = g.p[src.ctrl].hand.find(y => named(y, 'Colosseum - Cage of the Gladiator Beasts')); if (!x) return false;
        move(g, x, 'gy', { reason: 'discard', by: src.ctrl, noLater: true }); log(g, `${PN(g, src.ctrl)} discarded a Colosseum so the Colosseum on the field wasn't destroyed.`); return true; } },
    effs: [actNoop,
      { type: 'trig', loc: 'fz', mand: true, label: 'Place a counter',
        on: (g, ev, c) => { if (ev.type === 'move' && ev.to === 'm' && ev.from === 'deck' && ev.reason === 'summon') { c.f30n = (c.f30n || 0) + 1; return true; } return false; },
        res: function* (g, c) { const n = c.f30n || 1; c.f30n = 0; if (!onField(c) || !faceUp(c)) return; addCtr(g, c, 'colo', n); g.seq++; log(g, `${n} counter${n > 1 ? 's were' : ' was'} placed on Colosseum (${ctr(c, 'colo')} in all).`); } }] },

  /* ----- Koa'ki Meiru ----- */
  'Core Blast': { effs: [actNoop,
    { type: 'trig', loc: 'st', opt: true, tags: { destroy: 1 }, label: 'Destroy cards until they match your monsters',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isKoaki(x)) && monsOf(g, opp(p)).length > monsOf(g, p).length && fieldOf(g, opp(p)).length > monsOf(g, p).length,
      res: function* (g, c, p) { const n = fieldOf(g, opp(p)).length - monsOf(g, p).length; if (n <= 0) return;
        const xs = yield* pick(g, p, `Destroy ${n} card${n > 1 ? 's' : ''} your opponent controls`, fieldOf(g, opp(p)), n, n, 'bad'); destroy(g, xs, { by: p, src: c }); } }] },
  'Core Blaster': { effs: [
    { type: 'act', cond: g => fieldMons(g).some(m => faceUp(m) && isKoaki(m)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip to which Koa\'ki Meiru monster?', fieldMons(g).filter(m => faceUp(m) && isKoaki(m)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && isKoaki(t) && onField(c) && equip(g, c, t)) c.f30eqU = t.u; } },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy the LIGHT or DARK monster',
      on: (g, ev, c) => { if (ev.type !== 'dsStart' || !c.equipTo || !ev.t) return false; const m = ev.a.u === c.equipTo ? ev.a : ev.t.u === c.equipTo ? ev.t : null; if (!m) return false; const o = m === ev.a ? ev.t : ev.a; return ['LIGHT', 'DARK'].includes(attr(o)); },
      res: function* (g, c, p, L2) { const m = L2.ev.a.u === c.equipTo ? L2.ev.a : L2.ev.t; const o = m === L2.ev.a ? L2.ev.t : L2.ev.a; if (o && onField(o)) destroy(g, [o], { by: p, src: c }); } },
    { type: 'trig', loc: 'gy', when: true, label: 'Return Core Blaster to the hand',
      on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && c.f30eqU != null) { c.f30eqU = null; return true; } if (ev.type === 'move' && ev.c === c) c.f30eqU = null; return false; },
      res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} returned Core Blaster to the hand.`); } } }] },
  'Core Compression': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].hand.some(x => named(x, "Iron Core of Koa'ki Meiru")) && g.p[p].hand.some(isKoaki) && g.p[p].deck.length >= 2,
    cost: function* (g, c, p) {
      const [r] = yield* pick(g, p, "Reveal Iron Core of Koa'ki Meiru", g.p[p].hand.filter(x => named(x, "Iron Core of Koa'ki Meiru")), 1, 1, 'good'); if (r) log(g, `${PN(g, p)} revealed Iron Core of Koa'ki Meiru.`);
      const [x] = yield* pick(g, p, "Discard 1 Koa'ki Meiru monster", g.p[p].hand.filter(isKoaki), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    res: function* (g, c, p) { draw(g, p, 2); } }] },

  /* ----- Counters ----- */
  'Counter Cleaner': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].lp > 500,
    cost: function* (g, c, p) { pay(g, p, 500); },
    res: function* (g) { for (const x of allField(g)) { x.ctr = {}; if (x.flags.wedge) x.flags.wedge = 0; } g.seq++; log(g, 'All counters on the field were removed.'); } }] },
  'Counter Counter': { effs: [{ type: 'act',
    cond: (g, c, p, x) => spellTrapAct(x.top) && !x.top.negated && isTrap(x.top.c) && D(x.top.c).sub === 'Counter',
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  'Counter Gem': { effs: [
    { type: 'act', cond: (g, c, p) => g.p[p].gy.some(isCBMon),   // other Spell/Trap cards are not needed to activate it
      res: function* (g, c, p) {
        const xs = g.p[p].st.filter(x => x && x !== c); const grp = g.group;
        for (const x of xs) move(g, x, 'gy', { reason: 'effect', by: p, group: grp, noLater: true });
        if (xs.length) log(g, `${PN(g, p)} sent ${xs.length} card${xs.length > 1 ? 's' : ''} from the Spell & Trap Zone to the GY.`);
        const room = g.p[p].st.filter(z => !z).length; const cs = g.p[p].gy.filter(isCBMon);
        const n = Math.min(room, cs.length);
        if (n) { const ps = n < cs.length ? yield* pick(g, p, `Place ${n} Crystal Beast monster${n > 1 ? 's' : ''} from your GY`, cs, n, n, 'good') : cs.slice(0, n); for (const x of ps) placeCB(g, p, x); emit(g, { type: 'cbPlace', p }); }
        c.f30gem = g.turnNo; } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy your face-up Crystal Beast cards',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.f30gem === g.turnNo,
      res: function* (g, c) { c.f30gem = null; const p = c.owner; const xs = fieldOf(g, p).filter(x => faceUp(x) && isCB(x)); if (xs.length) destroy(g, xs, { by: p, src: c }); } }] },

  /* ----- Crystal Beasts ----- */
  'Crystal Abundance': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => cbST(g, p).length >= 4,
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Send 4 Crystal Beast cards from your Spell & Trap Zone to the GY', cbST(g, p), 4, 4, 'cost'); const grp = g.group; for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} sent 4 Crystal Beast cards to the GY.`); },
    res: function* (g, c, p) {
      const all = allField(g).filter(x => x !== c); const theirs = new Set(fieldOf(g, opp(p)).map(x => x.u)); const grp = g.group;
      for (const x of all) if (onField(x)) move(g, x, 'gy', { reason: 'effect', by: p, group: grp, noLater: true });
      const oppSent = all.filter(x => theirs.has(x.u) && x.zone === 'gy').length;   // tokens vanish and don't count
      log(g, `Every card on the field was sent to the GY (${oppSent} of ${PN(g, opp(p))}'s).`);
      const cs = g.p[p].gy.filter(x => isCBMon(x) && canSS(g, p, x)); const k = Math.min(oppSent, cs.length, nFreeM(g, p));
      if (!k) return;
      const ps = yield* pick(g, p, `Special Summon ${k} Crystal Beast monster${k > 1 ? 's' : ''} from your GY`, cs, k, k, 'good');
      for (const x of ps) ss(g, p, x, 'atk'); } }] },
  // The Battle Damage of a direct attack made with its own effect is halved (its ATK first, then halved: ruling).
  'Crystal Beast Amethyst Cat': {
    self: { directAttack: true },
    cont: { dmg: (g, src, p, n, o) => o.battle && o.src === src && o.direct && src.flags.f30cat === g.turnNo && p !== src.ctrl ? Math.floor(n / 2) : undefined },
    effs: [cbStay, { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'attack' && ev.a === c) c.flags.f30cat = ev.direct && monsOf(g, opp(c.ctrl)).length > 0 ? g.turnNo : null; return false; } }] },
  'Crystal Beast Cobalt Eagle': {
    effs: [cbStay, { type: 'ign', opt: true, label: 'Return a Crystal Beast card to the top of the Deck',
      cond: (g, c, p) => fieldOf(g, p).some(x => faceUp(x) && isCB(x) && x.zone !== 'fz'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which face-up Crystal Beast card to the top of the Deck?', fieldOf(g, p).filter(x => faceUp(x) && isCB(x) && x.zone !== 'fz'), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { move(g, t, 'deckTop', { reason: 'effect', by: p }); log(g, `${D(t).n} was returned to the top of the Deck.`); } } }] },
  'Crystal Beast Emerald Tortoise': {
    effs: [cbStay, { type: 'ign', opt: true, label: 'Change a monster that attacked to Defense',
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && x.pos === 'atk' && x.attacks > 0),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change which monster that attacked this turn to Defense Position?', monsOf(g, p).filter(x => faceUp(x) && x.pos === 'atk' && x.attacks > 0), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) toDef(g, t); } }] },
  'Crystal Pair': { effs: [trapTrig({ label: 'Place a Crystal Beast from your Deck',
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.wasField && ev.to === 'gy' && ev.prevCtrl === c.ctrl && isCBMon(ev.c),
    cond: (g, c, p) => g.p[p].st.some(x => !x) && g.p[p].deck.some(isCBMon),
    res: function* (g, c, p) {
      const cs = g.p[p].deck.filter(isCBMon); if (!cs.length || freeST(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Place which Crystal Beast from your Deck?', cs, 1, 1, 'good');
      if (x && placeCB(g, p, x)) { emit(g, { type: 'cbPlace', p }); g.p[p].noBattleDamage = g.turnNo; log(g, `${PN(g, p)} takes no battle damage for the rest of this turn.`); } } })] },
  'Crystal Promise': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && cbST(g, p).some(x => isMon(x) && canSS(g, p, x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Crystal Beast from your Spell & Trap Zone?', cbST(g, p).filter(isMon), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone === 'st') ss(g, p, t, 'atk'); } }] },

  /* ----- Cyberdark ----- */
  'Cyberdark Dragon': {
    self: { atk: (g, c) => { const eq = cdEq(g, c); return (eq ? baseAtk(eq) : 0) + 100 * g.p[c.ctrl].gy.filter(isMon).length; }, replaceDestroy: cdReplace },
    effs: [lockInstall,
      { type: 'trig', mand: true, label: 'Equip a Dragon from your GY', on: (g, ev, c) => evSummoned(ev, c) && !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how),
        cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && race(x) === 'Dragon'),
        res: function* (g, c, p) { const cs = g.p[p].gy.filter(x => isMon(x) && race(x) === 'Dragon'); if (!cs.length) return; const [x] = yield* pick(g, p, 'Equip which Dragon from your GY?', cs, 1, 1, 'good'); cdEquip(g, c, p, x); } }] },
  // Its ATK is halved during damage calculation when it attacks directly with its own effect.
  // PARTIAL: halved for the whole Damage Step of that attack (no damage calculation window).
  'Cyberdark Edge': {
    self: { directAttack: true, replaceDestroy: cdReplace,
      atk: (g, c) => { const eq = cdEq(g, c); let v = eq ? baseAtk(eq) : 0;
        if (!c._f30g && g.inDS && g.battle && g.battle.a === c && !g.battle.t && c.flags.f30edge === g.turnNo) { c._f30g = true; try { const tot = stat(g, c, 'atk'); v -= tot - Math.floor(tot / 2); } finally { c._f30g = false; } }
        return v; } },
    effs: [cdEquipTrig,
      { type: 'trig', res: noop, on: (g, ev, c) => { if (ev.type === 'attack' && ev.a === c) c.flags.f30edge = ev.direct && monsOf(g, opp(c.ctrl)).length > 0 ? g.turnNo : null; return false; } }] },
  'Cyberdark Horn': { self: { piercing: true, replaceDestroy: cdReplace, atk: (g, c) => { const eq = cdEq(g, c); return eq ? baseAtk(eq) : 0; } }, effs: [cdEquipTrig] },
  'Cyberdark Keel': { self: { replaceDestroy: cdReplace, atk: (g, c) => { const eq = cdEq(g, c); return eq ? baseAtk(eq) : 0; } },
    effs: [cdEquipTrig,
      // triggers at the end of the Damage Step even if Keel was destroyed too (ruling)
      { type: 'trig', loc: 'any', mand: true, label: 'Your opponent takes 300 damage',
        on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.wasField && ev.prevCtrl !== c.ctrl && ['m', 'gy'].includes(c.zone),
        res: function* (g, c, p) { damage(g, opp(p), 300, { src: c, srcP: p }); } }] },
  'Cyberdark Impact!': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => g.p[p].extra.some(x => named(x, 'Cyberdark Dragon') && !forbid(g, { type: 'ss', c: x, p, how: 'fusion' }))
      && ['Cyberdark Horn', 'Cyberdark Edge', 'Cyberdark Keel'].every(n => [...g.p[p].hand, ...g.p[p].gy, ...monsOf(g, p)].some(x => named(x, n)))
      && (freeM(g, p) >= 0 || monsOf(g, p).some(cdLord)),
    res: function* (g, c, p) {
      const mats = [];
      for (const n of ['Cyberdark Horn', 'Cyberdark Edge', 'Cyberdark Keel']) {
        const cs = [...g.p[p].hand, ...g.p[p].gy, ...monsOf(g, p)].filter(x => named(x, n)); if (!cs.length) return;
        const [x] = cs.length > 1 ? yield* pick(g, p, `Return which ${n} to the Deck?`, cs, 1, 1, 'cost') : cs; if (!x) return; mats.push(x);
      }
      const fx = g.p[p].extra.find(x => named(x, 'Cyberdark Dragon')); if (!fx) return;
      const grp = g.group; for (const x of mats) move(g, x, 'deck', { reason: 'fusion', by: p, group: grp });
      log(g, `${PN(g, p)} returned Cyberdark Horn, Edge and Keel to the Deck as Fusion Material.`);
      if (freeM(g, p) >= 0) ss(g, p, fx, 'atk', { how: 'fusion', group: grp }); } }] },

  /* ----- Cybernetic ----- */
  'Cybernetic Cyclopean': { self: { atk: (g, c) => g.p[c.ctrl].hand.length === 0 ? 1000 : 0 }, effs: [] },
  'Cybernetic Hidden Technology': { effs: [actNoop,
    { type: 'quick', loc: 'st', tags: { destroy: 1 }, label: 'Send a Cyber Dragon: destroy the attacker',
      cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && onField(g.aw.a) && monsOf(g, p).some(x => faceUp(x) && listsCyber(x)),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Cyber Dragon or Cyber Dragon Fusion to the GY?', monsOf(g, p).filter(x => faceUp(x) && listsCyber(x)), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
      target: function* (g, c, p, L2) { L2.t = g.aw && onField(g.aw.a) ? [g.aw.a] : []; },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'Cybernetic Magician': { effs: [{ type: 'ign', label: 'Discard: a monster\'s ATK becomes 2000',
    cond: (g, c, p) => g.p[p].hand.length > 0 && fieldMons(g).some(x => faceUp(x) && atk(g, x) !== 2000),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which face-up monster\'s ATK becomes 2000?', fieldMons(g).filter(x => faceUp(x) && atk(g, x) !== 2000), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { addMod(g, t, { set: 2000, which: 'atk', end: true }); log(g, `${name(t)}'s ATK became 2000 until the End Phase.`); } } }] },
  // PARTIAL: the return in the End Phase and the destruction in the next Standby Phase each use a chain link (rulings: no chain).
  'Cybernetic Zone': { effs: [
    { type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && D(x).k === 'fusion' && race(x) === 'Machine'),
      res: function* (g, c, p) {
        const cs = monsOf(g, p).filter(x => faceUp(x) && D(x).k === 'fusion' && race(x) === 'Machine'); if (!cs.length) return;
        const [x] = yield* pick(g, p, 'Banish which Machine Fusion Monster until the End Phase?', cs, 1, 1, 'good'); if (!x) return;
        move(g, x, 'ban', { reason: 'effect', by: p }); log(g, `${D(x).n} was banished until the End Phase.`);
        c.f30z = { u: x.u, p, turn: g.turnNo }; } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return the banished Fusion Monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!c.f30z && c.f30z.turn === g.turnNo,
      res: function* (g, c) { const z = c.f30z; c.f30z = null; const x = g.p[z.p].ban.find(y => y.u === z.u); if (!x || freeM(g, z.p) < 0) return;
        move(g, x, 'm', { ctrl: z.p, pos: 'atk', reason: 'effect' }); addMod(g, x, { set: 2 * atk(g, x), which: 'atk' });
        log(g, `${D(x).n} returned to the field with its ATK doubled.`); c.f30die = { u: x.u, p: z.p, turnIn: x.turnIn }; } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the returned monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && !!c.f30die && ev.tp === c.f30die.p && g.turnNo > c.f30die.turnIn,
      res: function* (g, c) { const z = c.f30die; c.f30die = null; const x = monsOf(g, z.p).find(y => y.u === z.u && y.turnIn === z.turnIn); if (x) destroy(g, [x], { by: z.p, src: c }); } }] },

  /* ----- D - ----- */
  // A Normal Trap that stays on the field as an Equip Card.
  'D - Chain': {
    cont: { atk: (g, src, m) => src.equipTo === m.u ? 500 : 0 },
    effs: [
      { type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isDHERO(x)),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip D - Chain to which Destiny HERO?', monsOf(g, p).filter(x => faceUp(x) && isDHERO(x)), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && equip(g, c, t)) L2.keep = true; } },
      { type: 'trig', loc: 'st', mand: true, label: 'Inflict 500 damage',
        on: (g, ev, c) => !!c.equipTo && ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && !!ev.killer && ev.killer.u === c.equipTo && ev.prevCtrl !== c.ctrl,
        res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  'D - Counter': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.aw && !!g.aw.t && g.aw.a.ctrl !== p && g.aw.t.ctrl === p && faceUp(g.aw.t) && isDHERO(g.aw.t),
    target: function* (g, c, p, L2) { L2.t = [g.aw.a]; },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  'D - Formation': { effs: [actNoop,
    { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => { if (ev.type === 'move' && ev.destroyed && ev.wasField && ev.from === 'm' && ev.prevCtrl === c.ctrl && ev.snap && ev.snap.faceUp && /^Destiny HERO/.test(ev.snap.name) && faceUp(c)) { addCtr(g, c, 'd', 1); g.seq++; log(g, `A D Counter was placed on D - Formation (${ctr(c, 'd')}).`); } return false; } },
    { type: 'trig', loc: 'st', when: true, label: 'Send this card: add 2 cards with that name',
      on: (g, ev, c) => { if (!(ev.type === 'summon' && ev.p === c.ctrl && mainPh(g) && ev.cs.some(x => onField(x) && faceUp(x)))) return false; c.f30cs = ev.cs.filter(x => onField(x) && faceUp(x)); return true; },
      cond: (g, c, p) => c.zone === 'st' && faceUp(c) && ctr(c, 'd') >= 2,
      cost: function* (g, c, p, L2) { L2.data.cs = (c.f30cs || []).slice(); move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent D - Formation to the GY.`); },
      target: function* (g, c, p, L2) { const ns = [...new Set(L2.data.cs.map(x => D(x).n))]; L2.data.n = ns.length > 1 ? ns[yield* choose(g, p, 'Add cards with which monster\'s name?', ns)] : ns[0]; },
      res: function* (g, c, p, L2) {
        const n = L2.data.n; const deckOk = !forbid(g, { type: 'search', p });
        const cs = [...(deckOk ? g.p[p].deck : []), ...g.p[p].gy].filter(x => D(x).n === n); if (!cs.length) return;
        const xs = yield* pick(g, p, `Add up to 2 copies of ${n} from your Deck and/or GY`, cs, 1, 2, 'good');
        let fromDeck = false; for (const x of xs) { if (x.zone === 'deck') fromDeck = true; move(g, x, 'hand', { reason: 'effect', by: p }); }
        if (fromDeck) shuffleDeck(g, p); if (xs.length) log(g, `${PN(g, p)} added ${xs.length} ${n} to the hand.`); } }] },
  'D - Fortune': { effs: [{ type: 'act',
    cond: (g, c, p) => !!g.aw && !g.aw.t && g.aw.a.ctrl !== p && g.p[p].gy.some(x => isMon(x) && isDHERO(x)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish which Destiny HERO from your GY?', g.p[p].gy.filter(x => isMon(x) && isDHERO(x)), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
    res: function* (g) { if (g.phase === 'battle') endBattle(g); } }] },
  'D - Shield': {
    cont: { grant: (g, src, m, flag) => flag === 'noBattleDestroy' && src.equipTo === m.u },
    effs: [{ type: 'act',
      cond: (g, c, p) => !!g.aw && !!g.aw.t && g.aw.a.ctrl !== p && g.aw.t.ctrl === p && faceUp(g.aw.t) && g.aw.t.pos === 'atk' && isDHERO(g.aw.t),
      target: function* (g, c, p, L2) { L2.t = [g.aw.t]; },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; toDef(g, t); if (onField(c) && equip(g, c, t)) L2.keep = true; } }] },
  'D - Spirit': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => !monsOf(g, p).some(x => faceUp(x) && isDHERO(x)) && freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && isDHERO(x) && lv(x) <= 4 && canSS(g, p, x)),
    res: function* (g, c, p) {
      if (monsOf(g, p).some(x => faceUp(x) && isDHERO(x)) || freeM(g, p) < 0) return;
      const cs = g.p[p].hand.filter(x => isMon(x) && isDHERO(x) && lv(x) <= 4); if (!cs.length) return;
      const [x] = yield* pick(g, p, 'Special Summon which Level 4 or lower Destiny HERO from your hand?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },
  'D - Time': { effs: [trapTrig({ label: 'Add a Destiny HERO from your Deck',
    on: (g, ev, c) => ev.type === 'move' && ev.wasField && ev.from === 'm' && ev.to !== 'm' && ev.prevCtrl === c.ctrl && ev.snap && ev.snap.faceUp && /^Elemental HERO/.test(ev.snap.name),
    target: function* (g, c, p, L2) { L2.data.lv = num(D(L2.ev.c).lv); },
    res: function* (g, c, p, L2) { const n = L2.data.lv; yield* search(g, p, x => isMon(x) && isDHERO(x) && lv(x) <= n, `Add a Destiny HERO of Level ${n} or lower from your Deck`); } })] },
});
})();
