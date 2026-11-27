/* Full pool batch 13: Power Bond to Royal Writ of Taxation (build/batches/full/full-13.md).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts from the Edison text; cards with a
 Goat-only script elsewhere (Red Medicine, Red-Eyes Black Metal Dragon, Return of the Doomed, Revival Jam, Ring of Destruction,
 Ring of Magnetism, Royal Magical Library) are ported here as the shared version. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, search, setFaceDown, negate, addMod,
  equip, link, addCtr, ctr, negateAttack, addRule, tokens, token, fusionSummon, canFusion, ritualSummon, canRitual,
  name, D, isMon, isST, isSpell, isTrap, isExtraD, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, nFreeM, shuffleDeck, log, PN, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned, battleKill, emit, forbid } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const noop = function* () {};
const isRitualMon = c => isMon(c) && D(c).k === 'ritual';
const isCB = c => isMon(c) && /^Crystal Beast/.test(D(c).n);
const isUC = c => isMon(c) && (named(c, 'Rainbow Dragon') || named(c, 'Rainbow Dark Dragon') || /always treated as an "Ultimate Crystal"/.test(D(c).tx || ''));
const isREBD = c => ['Red-Eyes Black Dragon', 'Red-Eyes B. Dragon'].includes(name(c));
const isFlipMon = c => isMon(c) && (/Flip/.test(D(c).ab || '') || /^FLIP:/.test(D(c).tx || ''));
const toDeck = (g, x, p) => move(g, x, isExtraD(D(x)) ? 'extra' : 'deck', { reason: 'effect', by: p });
// "Crystal Beast" cards with different names on your field and/or GY (Rainbow Dragon, Rainbow Gravity)
const cbNames = (g, p) => new Set([...fieldOf(g, p).filter(faceUp), ...g.p[p].gy].filter(isCB).map(x => D(x).n));
// a monster that can be Special Summoned from the hand by an effect
const ssable = c => isMon(c) && !['ritual', 'fusion', 'synchro', 'token'].includes(D(c).k) && !/Cannot be (Normal|Special) Summoned|Must be Special Summoned/i.test(D(c).tx || '');
// does this card's effect inflict effect damage? (read from its text; battle damage doesn't count)
const dmgText = c => /inflict[^.]*damage|damage[^.]*(?:to your opponent|to you\b|to each player|to both players|to its controller|to the controller)|takes? [^.]*damage/i.test((D(c).tx || '').replace(/(?:piercing )?battle damage/gi, ''));
function* discardPick(g, p, n, text, not, filter = () => true) { const h = g.p[p].hand.filter(x => x !== not && filter(x)); if (!h.length) return []; const xs = yield* pick(g, p, text, h, Math.min(n, h.length), Math.min(n, h.length), 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'discard' }); if (xs.length) log(g, `${PN(g, p)} discarded ${xs.map(name).join(', ')}.`); return xs; }
// Equip Spells
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?', o = {}) => {
  const cands = (g, p) => (o.own ? monsOf(g, p) : fieldMons(g)).filter(m => faceUp(m) && filter(m));
  return { type: 'act', cond: (g, c, p) => cands(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, cands(g, p), 1, 1, o.hint || 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c) && equip(g, c, t)) { c.flags.eqU = t.u; if (o.post) yield* o.post(g, c, p, t); } } };
};
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
const eqMon = (g, c) => c.equipTo ? fieldMons(g).find(x => x.u === c.equipTo) || null : null;
// A Set Trap with no response window in the engine for its moment: offered as an optional trigger while Set (as D.D. Trap Hole).
const setTrap = c => c.zone === 'st' && c.pos === 'set';
const flipUpCost = function* (g, c, p) { c.pos = 'up'; g.seq++; log(g, `${PN(g, p)} activated ${name(c)}.`); };
const trapToGY = (g, c) => { if (onField(c)) move(g, c, 'gy', { reason: 'rule' }); };
// every summoned monster is marked as properly summoned (kept across zones: revivals of Nomi monsters)
const markProper = { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { if (ev.type === 'summon') for (const x of ev.cs) if (x) x.f13proper = true; return false; } };

/* Summon locks. "Cannot be Normal Summoned" is read by the engine from the text; the Special Summon limits are one duel-long
 rule, installed by the first event any of these cards sees. g.f13ign is the card a "ignoring the Summoning conditions"
 effect is summoning right now. */
const trialRecent = g => g.events.slice(-12).some(e => e.type === 'move' && e.c && named(e.c, 'Trial of the Princesses') && e.to === 'gy' && e.turn === g.turnNo);
const revived = a => ['gy', 'ban'].includes(a.c.zone) && a.c.f13proper;
const LOCKS = {
  // PARTIAL: Trial of the Princesses is seen as the card just sent to the GY this turn (it is Tributed as the cost).
  'Princess Curran': (g, a) => !((['hand', 'deck'].includes(a.c.zone) && trialRecent(g)) || revived(a)),
  'Princess Pikeru': (g, a) => !((['hand', 'deck'].includes(a.c.zone) && trialRecent(g)) || revived(a)),
  'Red Dragon Archfiend Assault Mode': (g, a) => !((['hand', 'deck'].includes(a.c.zone) && stOf(g, a.p).some(x => faceUp(x) && named(x, 'Assault Mode Activate'))) || revived(a)),
  // must first be Special Summoned from the hand by its own rule. PARTIAL: an effect that Special Summons it from the hand is not stopped.
  'Rainbow Dragon': (g, a) => !(g.f13ign === a.c.u || a.c.zone === 'hand' || revived(a)),
  'Rainbow Dark Dragon': (g, a) => !(g.f13ign === a.c.u || a.c.zone === 'hand' || revived(a)),
  'Red-Eyes Black Metal Dragon': (g, a) => !(g.f13ign === a.c.u || revived(a)),
  // "cannot be Special Summoned by other ways". PARTIAL: an effect that Special Summons it from the hand is not stopped.
  'Red-Eyes Darkness Dragon': (g, a) => a.c.zone !== 'hand',
  'Rainbow Neos': (g, a) => a.how !== 'fusion',
};
const lockEff = { type: 'trig', loc: 'any', res: noop, on: (g) => {
  if (!g.f13lock) { g.f13lock = true; addRule(g, (g2, a) => { if (a.type !== 'ss' || !a.c || a.c.id == null) return false; const d = D(a.c); const f = d && LOCKS[d.n]; return !!f && f(g2, a); }); }
  return false; } };

// Red-Eyes Black Metal Dragon (port of classic-2.js): Tribute the Red-Eyes equipped with Metalmorph, Special Summon from the Deck.
// ENGINE: no idle action for an inherent Special Summon from the Deck. PARTIAL: it is offered as an optional trigger from the
// Deck at your Standby Phase, the end of your Battle Phase, and the first game event of each of your Main Phases.
const metalBase = (g, p) => monsOf(g, p).find(m => faceUp(m) && isREBD(m) && allField(g).some(s => named(s, 'Metalmorph') && faceUp(s) && s.equipTo === m.u));
const metalSummon = { type: 'trig', loc: 'deck', tags: { ss: 1 }, label: 'Tribute Red-Eyes B. Dragon: Special Summon from the Deck',
  on: (g, ev, c) => {
    if (g.tp !== c.owner || !metalBase(g, c.owner)) return false;
    if (ev.type === 'phase' && (ev.ph === 'standby' || ev.ph === 'bpEnd') && ev.tp === c.owner) return true;
    if (['main1', 'main2'].includes(g.phase) && ev.type !== 'phase') { const k = g.turnNo + g.phase; if (c.flags.metalAsk === k) return false; c.flags.metalAsk = k; return true; }
    return false; },
  cond: (g, c, p) => !!metalBase(g, p),
  cost: function* (g, c, p) { const m = metalBase(g, p); if (m) { move(g, m, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(m).n}.`); } },
  res: function* (g, c, p) { if (c.zone !== 'deck' || freeM(g, p) < 0) return; g.f13ign = c.u; try { ss(g, p, c, 'atk'); } finally { g.f13ign = null; } shuffleDeck(g, p); } };

// Royal Magical Library (port of goat-7.js): a Spell Counter when a Spell resolves (seen as it leaves the field after
// resolving, or as a Continuous/Equip/Field Spell is activated from the hand).
const spellCounter = max => ({ type: 'trig', res: noop, on: (g, ev, c) => {
  if (ev.type !== 'move' || !isSpell(ev.c) || ctr(c, 'spell') >= max) return false;
  const stays = ['Continuous', 'Equip', 'Field'].includes(D(ev.c).sub);
  if ((!stays && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule') || (stays && ev.from === 'hand' && ev.reason === 'activate')) { addCtr(g, c, 'spell', 1); log(g, `${name(c)} got a Spell Counter (${ctr(c, 'spell')}).`); }
  return false; } });

const ritualEffs = rn => ({ type: 'act', tags: { ss: 1 },
  cond: (g, c, p) => freeM(g, p) >= 0 && canRitual(g, p, { monster: x => named(x, rn) }),
  res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, rn) }); } });

E.addScripts({
  /* ----- Power ----- */
  // PARTIAL: the bonus is a fixed number (its original ATK at the Summon), not one that follows later changes.
  'Power Bond': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && canFusion(g, p, { from: ['hand', 'm'], filter: fx => race(fx) === 'Machine' }),
      res: function* (g, c, p) { const fx = yield* fusionSummon(g, p, { from: ['hand', 'm'], filter: fx => race(fx) === 'Machine' }); if (!fx || !onField(fx)) return;
        const n = baseAtk(fx); addMod(g, fx, { atk: n }); log(g, `${name(fx)} gained ${n} ATK.`); c.f13pb = { turn: g.turnNo, n, p }; } },
    { type: 'trig', loc: 'any', mand: true, label: 'Take the Power Bond damage', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!c.f13pb && c.f13pb.turn === g.turnNo,
      res: function* (g, c) { const r = c.f13pb; c.f13pb = null; if (r && r.n > 0) damage(g, r.p, r.n, { src: c, srcP: r.p }); } }] },
  // The effect is picked at resolution (ruling). The Option Token copies Victory Viper's stats as they are now.
  // PARTIAL: the token's stats don't follow later changes, and it is destroyed (not just removed) when Victory Viper leaves.
  'Power Capsule': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && name(m) === 'Victory Viper XX03'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which Victory Viper XX03?', monsOf(g, p).filter(m => faceUp(m) && name(m) === 'Victory Viper XX03'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const v = live(L2)[0]; if (!v || !faceUp(v)) return;
      const sts = stOnField(g).filter(x => x !== c && faceUp(x));
      const opts = ['Victory Viper gains 400 ATK', ...(sts.length ? ['Destroy a face-up Spell/Trap'] : []), ...(freeM(g, p) >= 0 ? ['Special Summon an Option Token'] : [])];
      const i = yield* choose(g, p, 'Power Capsule: apply which effect?', opts); const o = opts[i];
      if (o.startsWith('Victory')) { addMod(g, v, { atk: 400 }); log(g, `${name(v)} gained 400 ATK.`); }
      else if (o.startsWith('Destroy')) { const [x] = yield* pick(g, p, 'Destroy which face-up Spell/Trap?', sts, 1, 1, 'bad'); if (x && onField(x)) destroy(g, [x], { by: p, src: c }); }
      else { const tk = token(g, p, { n: 'Option Token', a: attr(v), r: race(v), lv: lv(v), atk: 0, def: 0 }, 'atk'); if (tk) { addMod(g, tk, { set: atk(g, v), which: 'atk' }); addMod(g, tk, { set: def(g, v), which: 'def' }); link(g, tk, v); log(g, `${PN(g, p)} Special Summoned an Option Token.`); emit(g, { type: 'summon', cs: [tk], how: 'special', p, byEffect: true }); } } } }] },
  'Power Filter': { cont: { forbid: (g, src, a) => a.type === 'ss' && !!a.c && a.c.id != null && D(a.c).atk !== '?' && (a.c.flags && a.c.flags.baseAtk != null ? a.c.flags.baseAtk : L.num(D(a.c).atk)) <= 1000 },
    effs: [{ type: 'act', res: noop }] },
  'Power Injector': { effs: [{ type: 'ign', opt: true, label: 'Pay 600: Psychics gain 500 ATK', cond: (g, c, p) => g.p[p].lp > 600,
    cost: function* (g, c, p) { pay(g, p, 600); },
    res: function* (g) { const ms = fieldMons(g).filter(m => faceUp(m) && race(m) === 'Psychic'); for (const m of ms) addMod(g, m, { atk: 500, end: true }); if (ms.length) log(g, `${ms.map(name).join(', ')} gained 500 ATK.`); } }] },
  'Power Invader': { self: { tributes: (g, c, p) => monsOf(g, opp(p)).length >= 2 ? [0] : [] }, effs: [] },
  'Power of Kaishin': { cont: eqBonus(300, 300), effs: [equipAct(m => race(m) === 'Aqua', 'Equip to which Aqua monster?')] },
  // The bonus is tied to this card (lost if it leaves the field), for this turn.
  'Power Pickaxe': {
    cont: { atk: (g, src, m) => src.equipTo === m.u && src.flags.f13pick === g.turnNo ? 500 : 0 },
    effs: [equipAct(),
      { type: 'ign', loc: 'st', opt: true, label: 'Banish a monster from their GY: +500 ATK',
        cond: (g, c, p) => { const m = eqMon(g, c); return !!m && faceUp(m) && g.p[opp(p)].gy.some(x => isMon(x) && lv(x) <= lv(m)); },
        target: function* (g, c, p, L2) { const m = eqMon(g, c); yield* tgt(g, p, L2, 'Banish which monster from their GY?', g.p[opp(p)].gy.filter(x => isMon(x) && lv(x) <= lv(m)), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = L2.t[0], m = eqMon(g, c); if (!t || t.zone !== 'gy' || !m || !faceUp(m) || lv(t) > lv(m)) return;
          move(g, t, 'ban', { reason: 'effect', by: p }); c.flags.f13pick = g.turnNo; g.seq++; log(g, `${D(t).n} was banished. ${name(m)} gains 500 ATK.`); } }] },
  // Each monster it picks keeps the 400 while this card is face-up (at most 400 each); not the one picked last time.
  'Power Supplier': (() => { const key = m => m.u + ':' + m.turnIn;
    const cands = (g, c, p) => monsOf(g, p).filter(m => faceUp(m) && key(m) !== c.flags.f13supLast);
    return { cont: { atk: (g, src, m) => (src.flags.f13sup || []).includes(key(m)) && onField(m) ? 400 : 0 },
      effs: [{ type: 'ign', opt: true, label: 'A monster gains 400 ATK', cond: (g, c, p) => cands(g, c, p).length > 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster gains 400 ATK?', cands(g, c, p), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c) || !faceUp(c)) return; const k = key(t);
          c.flags.f13sup = [...new Set([...(c.flags.f13sup || []), k])]; c.flags.f13supLast = k; g.seq++; log(g, `${name(t)} gains 400 ATK while Power Supplier is face-up.`); } }] }; })(),

  /* ----- Princesses ----- */
  'Princess Curran': { effs: [lockEff, markProper, { type: 'trig', mand: true, label: '600 damage for each of their monsters', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    res: function* (g, c, p) { const n = 600 * monsOf(g, opp(p)).length; if (n) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  'Princess of Tsurugi': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: '500 damage for each of their Spells/Traps', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { const n = 500 * stOf(g, opp(p)).length; if (n) damage(g, opp(p), n, { src: c, srcP: p }); } }] },
  'Princess Pikeru': { effs: [lockEff, markProper, { type: 'trig', mand: true, label: 'Gain 800 LP for each of your monsters', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    res: function* (g, c, p) { gain(g, p, 800 * monsOf(g, p).length); } }] },

  /* ----- Raging ----- */
  // ENGINE: no response window after a chain resolves, so it is offered as an optional trigger while Set.
  // PARTIAL: "can't be changed to Defense Position by a card effect" isn't enforced (card-effect position changes don't check forbid).
  'Raging Cloudian': { effs: [{ type: 'trig', loc: 'any', speed: 2, tags: { ss: 1 }, label: 'Activate Raging Cloudian',
    on: (g, ev, c) => { if (!setTrap(c) || c.turnIn === g.turnNo || ev.type !== 'move') return false;
      if (!(ev.wasField && ev.destroyed && !ev.battle && ev.to === 'gy' && ev.prevCtrl === c.ctrl && /^Cloudian/.test(D(ev.c).n) && ev.snap && ev.snap.faceUp && ev.snap.pos === 'def')) return false;
      c.flags.f13rc = [...(c.flags.f13rc || []).filter(u => g.p[c.ctrl].gy.some(x => x.u === u)), ev.c.u]; return true; },
    cond: (g, c, p) => setTrap(c) && freeM(g, p) >= 0 && g.p[p].gy.some(x => (c.flags.f13rc || []).includes(x.u)),
    cost: flipUpCost,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Cloudian?', g.p[p].gy.filter(x => (c.flags.f13rc || []).includes(x.u)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && ss(g, p, t, 'atk')) { addCtr(g, t, 'fog', 1); log(g, `A Fog Counter was placed on ${name(t)}.`); } trapToGY(g, c); } }] },
  'Raging Earth': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy face-down and non-EARTH monsters',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => m.pos === 'set' || attr(m) !== 'EARTH'), { by: p }); } }] },
  // The summoned monster is destroyed if this card leaves the field while face-up (not if either was turned face-down).
  'Raging Eria': { effs: [
    { type: 'ign', opt: true, tags: { ss: 1 }, label: 'Tribute a WATER: Special Summon a WATER',
      cond: (g, c, p) => monsOf(g, p).some(x => x !== c && attr(x) === 'WATER') && g.p[p].hand.some(x => ssable(x) && attr(x) === 'WATER'),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which WATER monster?', monsOf(g, p).filter(x => x !== c && attr(x) === 'WATER'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
      res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => ssable(x) && attr(x) === 'WATER'); if (!cs.length || freeM(g, p) < 0) return;
        const [x] = yield* pick(g, p, 'Special Summon which WATER monster?', cs, 1, 1, 'good');
        if (x && ss(g, p, x, 'atk') && onField(c) && faceUp(c)) { x.flags.f13eria = c.u; c.flags.f13eriaKids = [...(c.flags.f13eriaKids || []), x.u]; } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the summoned monster',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.faceUp && (ev.snap.flags.f13eriaKids || []).length > 0 && fieldMons(g).some(m => m.flags.f13eria === c.u && faceUp(m)),
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => m.flags.f13eria === c.u && faceUp(m)), { by: p }); } }] },
  // A Continuous Effect (ruling): the ATK is gained with no chain link.
  'Raging Flame Sprite': { self: { directAttack: true }, effs: [{ type: 'trig', res: noop,
    on: (g, ev, c) => { if (ev.type === 'damage' && ev.battle && ev.direct && ev.src === c && ev.p !== c.ctrl && onField(c) && faceUp(c)) { addMod(g, c, { atk: 1000 }); g.seq++; log(g, 'Raging Flame Sprite gained 1000 ATK.'); } return false; } }] },
  // PARTIAL: the End Phase destruction uses a chain link (the ruling says it doesn't start a Chain).
  'Raging Mad Plants': { effs: [
    { type: 'act', ds: true, cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && race(x) === 'Plant'),
      res: function* (g, c, p) { const n = 300 * g.p[p].gy.filter(x => isMon(x) && race(x) === 'Plant').length; const ms = monsOf(g, p).filter(m => faceUp(m) && race(m) === 'Plant');
        for (const m of ms) addMod(g, m, { atk: n, end: true }); if (ms.length && n) log(g, `${PN(g, p)}'s Plant monsters gained ${n} ATK.`); c.f13mad = { turn: g.turnNo, p }; } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy your Plant monsters', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!c.f13mad && c.f13mad.turn === g.turnNo,
      res: function* (g, c) { const p = c.f13mad.p; c.f13mad = null; destroy(g, monsOf(g, p).filter(m => faceUp(m) && race(m) === 'Plant'), { by: p }); } }] },

  /* ----- Rainbow ----- */
  'Rainbow Dark Dragon': {
    proc: { label: 'Special Summon (banish 7 DARKs with different names)',
      cond: (g, c, p) => new Set(g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK').map(x => D(x).n)).size >= 7,
      cost: function* (g, c, p, grp) { const xs = [];
        for (let i = 0; i < 7; i++) { const cs = g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK' && !xs.includes(x) && !xs.some(y => D(y).n === D(x).n)); if (!cs.length) break; const [x] = yield* pick(g, p, `Banish a DARK monster with a different name (${7 - i} left)`, cs, 1, 1, 'cost'); xs.push(x); }
        for (const x of xs) move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${xs.map(name).join(', ')}.`); } },
    effs: [lockEff, markProper,
      { type: 'ign', label: 'Banish your other DARKs: +500 ATK each',
        cond: (g, c, p) => [...monsOf(g, p), ...g.p[p].gy].some(x => x !== c && isMon(x) && attr(x) === 'DARK'),
        cost: function* (g, c, p, L2) { const xs = [...monsOf(g, p).filter(x => x !== c && (faceUp(x) ? attr(x) === 'DARK' : attr(x) === 'DARK')), ...g.p[p].gy.filter(x => isMon(x) && attr(x) === 'DARK')];
          const grp = g.group; for (const x of xs) move(g, x, 'ban', { reason: 'cost', by: p, group: grp }); L2.data.n = xs.filter(x => x.zone === 'ban').length; log(g, `${PN(g, p)} banished ${xs.length} DARK monster${xs.length === 1 ? '' : 's'}.`); },
        res: function* (g, c, p, L2) { if (onField(c) && faceUp(c) && L2.data.n) { addMod(g, c, { atk: 500 * L2.data.n }); log(g, `${name(c)} gained ${500 * L2.data.n} ATK.`); } } }] },
  'Rainbow Dragon': {
    proc: { label: 'Special Summon (7 Crystal Beasts with different names)', cond: (g, c, p) => cbNames(g, p).size >= 7 },
    effs: [lockEff, markProper,
      { type: 'quick', ds: true, label: 'Send your Crystal Beasts to the GY: +1000 ATK each',
        cond: (g, c, p) => c.turnIn !== g.turnNo && monsOf(g, p).some(x => faceUp(x) && isCB(x)),
        cost: function* (g, c, p, L2) { const xs = monsOf(g, p).filter(x => faceUp(x) && isCB(x)); const grp = g.group; for (const x of xs) move(g, x, 'gy', { reason: 'cost', by: p, group: grp }); L2.data.n = xs.length; log(g, `${PN(g, p)} sent ${xs.map(x => D(x).n).join(', ')} to the GY.`); },
        res: function* (g, c, p, L2) { if (onField(c) && faceUp(c) && L2.data.n) { addMod(g, c, { atk: 1000 * L2.data.n }); log(g, `${name(c)} gained ${1000 * L2.data.n} ATK.`); } } },
      { type: 'ign', label: 'Banish your GY Crystal Beasts: shuffle the field into the Deck',
        cond: (g, c, p) => c.turnIn !== g.turnNo && g.p[p].gy.some(isCB),
        cost: function* (g, c, p) { const xs = g.p[p].gy.filter(isCB); const grp = g.group; for (const x of xs) move(g, x, 'ban', { reason: 'cost', by: p, group: grp }); log(g, `${PN(g, p)} banished ${xs.length} Crystal Beast monster${xs.length === 1 ? '' : 's'}.`); },
        res: function* (g, c, p) { const xs = allField(g); const grp = g.group; for (const x of xs) if (onField(x)) move(g, x, isExtraD(D(x)) ? 'extra' : 'deck', { reason: 'effect', by: p, group: grp, noLater: true });
          shuffleDeck(g, 0); shuffleDeck(g, 1); log(g, 'Every card on the field was shuffled into the Deck.'); } }] },
  'Rainbow Flower': { self: { directAttack: true }, effs: [] },
  'Rainbow Gravity': { effs: [markProper, { type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => cbNames(g, p).size >= 7 && freeM(g, p) >= 0 && [...g.p[p].deck, ...g.p[p].gy.filter(x => x.f13proper)].some(isUC),
    res: function* (g, c, p) { const cs = [...g.p[p].deck, ...g.p[p].gy.filter(x => x.f13proper)].filter(isUC); if (!cs.length || freeM(g, p) < 0) return;
      const [x] = yield* pick(g, p, 'Special Summon which "Ultimate Crystal" monster?', cs, 1, 1, 'good'); if (!x) return; const fromDeck = x.zone === 'deck';
      g.f13ign = x.u; try { ss(g, p, x, 'atk'); } finally { g.f13ign = null; } if (fromDeck) shuffleDeck(g, p); } }] },
  // ENGINE: replacing damage. Done with a damage hook on this card in the GY. PARTIAL: it stops if this card leaves the GY that turn.
  'Rainbow Life': {
    cont: { loc: 'gy', dmg: (g, src, p, n) => g.f13rl && g.f13rl[p] === g.turnNo ? { gain: n } : undefined },
    effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c),
      cost: function* (g, c, p) { yield* discardPick(g, p, 1, 'Discard 1 card', c); },
      res: function* (g, c, p) { (g.f13rl || (g.f13rl = {}))[p] = g.turnNo; log(g, `${PN(g, p)} gains LP instead of taking damage this turn.`); } }] },
  'Rainbow Neos': { mats: [x => name(x) === 'Elemental HERO Neos' || named(x, 'Elemental HERO Neos'), isUC],
    effs: [lockEff,
      { type: 'ign', label: 'Send a monster: shuffle their monsters into the Deck',
        cond: (g, c, p) => c.used.f13rn !== g.turnNo && monsOf(g, opp(p)).length > 0, after: (g, c) => { c.used.f13rn = g.turnNo; },
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which monster you control to the GY?', monsOf(g, p), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
        res: function* (g, c, p) { const xs = monsOf(g, opp(p)); for (const x of xs) toDeck(g, x, p); if (xs.length) log(g, `${PN(g, opp(p))}'s monsters were shuffled into the Deck.`); } },
      { type: 'ign', label: 'Send a Spell/Trap: shuffle their Spells/Traps into the Deck',
        cond: (g, c, p) => c.used.f13rn !== g.turnNo && stOf(g, p).length > 0 && stOf(g, opp(p)).length > 0, after: (g, c) => { c.used.f13rn = g.turnNo; },
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Spell/Trap you control to the GY?', stOf(g, p), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
        res: function* (g, c, p) { const xs = stOf(g, opp(p)); for (const x of xs) toDeck(g, x, p); if (xs.length) log(g, `${PN(g, opp(p))}'s Spells and Traps were shuffled into the Deck.`); } },
      { type: 'ign', label: 'Mill 1: shuffle their GY into the Deck',
        cond: (g, c, p) => c.used.f13rn !== g.turnNo && g.p[p].deck.length > 0 && g.p[opp(p)].gy.length > 0, after: (g, c) => { c.used.f13rn = g.turnNo; },
        cost: function* (g, c, p) { L.mill(g, p, 1); },
        res: function* (g, c, p) { const xs = g.p[opp(p)].gy.slice(); for (const x of xs) toDeck(g, x, p); if (xs.length) log(g, `${PN(g, opp(p))}'s GY was shuffled into the Deck.`); } }] },
  'Rainbow Path': { effs: [{ type: 'act', cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && stOf(g, p).some(x => x !== c && isCB(x)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which Crystal Beast card to the GY?', stOf(g, p).filter(x => x !== c && isCB(x)), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} sent ${D(x).n} to the GY.`); } },
    target: function* (g, c, p, L2) { L2.t = [g.aw.a]; },
    res: function* (g, c, p, L2) { const a = live(L2)[0]; if (!a || !g.aw || g.aw.a !== a) return; negateAttack(g); log(g, `${PN(g, p)} negated the attack.`);
      const cs = g.p[p].deck.filter(x => named(x, 'Rainbow Dragon') || named(x, 'Rainbow Dark Dragon'));
      if (cs.length && (yield* yn(g, p, 'Add Rainbow Dragon or Rainbow Dark Dragon from your Deck to your hand?'))) yield* search(g, p, x => named(x, 'Rainbow Dragon') || named(x, 'Rainbow Dark Dragon'), 'Add which card?'); } }] },
  // Applied from the attack declaration, with no chain, for the rest of that Battle Phase.
  'Rainbow Veil': {
    cont: { negates: (g, src, c) => g.phase === 'battle' && !!src.equipTo && c.flags.f13veil === src.u + ':' + g.turnNo && faceUp(c) },
    effs: [equipAct(),
      { type: 'trig', loc: 'st', res: noop, on: (g, ev, c) => {
        if (ev.type === 'attack' && ev.t && c.equipTo) { let o = null; if (ev.a.u === c.equipTo) o = ev.t; else if (ev.t.u === c.equipTo) o = ev.a; if (o && o.ctrl !== c.ctrl) { o.flags.f13veil = c.u + ':' + g.turnNo; g.seq++; } }
        return false; } }] },
  'Red Dragon Archfiend Assault Mode': { effs: [lockEff, markProper,
    { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy all other monsters', on: (g, ev, c) => ev.type === 'afterCalc' && ev.a === c,
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(m => m !== c), { by: p }); } },
    { type: 'trig', loc: 'any', when: true, tags: { ss: 1 }, label: 'Special Summon Red Dragon Archfiend from your GY',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed,
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, 'Red Dragon Archfiend') && x.f13proper),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Red Dragon Archfiend?', g.p[p].gy.filter(x => named(x, 'Red Dragon Archfiend') && x.f13proper), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },

  /* ----- Red ----- */
  'Red Medicine': { effs: [{ type: 'act', res: function* (g, c, p) { gain(g, p, 500); } }] },
  // Sending the cards is the cost; the same number of cards on the field are targeted.
  'Red Ogre': { effs: [{ type: 'trig', when: true, label: 'Discard to return cards to the hand', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
    cond: (g, c, p) => g.p[p].hand.length > 0 && allField(g).length > 0,
    cost: function* (g, c, p, L2) { const k = Math.min(g.p[p].hand.length, allField(g).length); const i = k > 1 ? yield* choose(g, p, 'Send how many cards from your hand?', [...Array(k).keys()].map(i => String(i + 1))) : 0;
      const xs = yield* discardPick(g, p, i + 1, `Send ${i + 1} card${i ? 's' : ''} from your hand to the GY`); L2.data.n = xs.length; },
    target: function* (g, c, p, L2) { if (L2.data.n) yield* tgt(g, p, L2, `Return ${L2.data.n} card${L2.data.n > 1 ? 's' : ''} on the field to the hand`, allField(g), L2.data.n, L2.data.n, 'bad'); },
    res: function* (g, c, p, L2) { const xs = live(L2); for (const t of xs) move(g, t, 'hand', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.map(x => D(x).n).join(', ')} returned to the hand.`); } }] },
  'Red-Eyes Black Metal Dragon': { effs: [lockEff, markProper, metalSummon] },
  'Red-Eyes Darkness Dragon': {
    proc: { label: 'Special Summon (Tribute Red-Eyes B. Dragon)', cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && isREBD(m)),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Tribute which Red-Eyes B. Dragon?', monsOf(g, p).filter(m => faceUp(m) && isREBD(m)), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } } },
    self: { atk: (g, c) => 300 * g.p[c.ctrl].gy.filter(x => isMon(x) && race(x) === 'Dragon').length },
    effs: [lockEff] },
  // PARTIAL: the 1-Tribute Summon is offered when you control a Zombie, but any monster can be Tributed and it can be Set.
  'Red-Eyes Zombie Dragon': { self: { tributes: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Zombie') ? [1] : [] },
    effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon the destroyed Zombie',
      on: (g, ev, c) => battleKill(ev, c) && ev.snap && ev.snap.race === 'Zombie' && race(ev.c) === 'Zombie',
      cond: (g, c, p, x) => freeM(g, p) >= 0 && x.ev.c.zone === 'gy',
      res: function* (g, c, p, L2) { const t = L2.ev.c; if (t.zone === 'gy') ss(g, p, t, 'atk'); } }] },

  /* ----- Release, Return, Revival ----- */
  'Release from Stone': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].ban.some(x => isMon(x) && race(x) === 'Rock' && !x.flags.faceDownBan),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which banished Rock monster?', g.p[p].ban.filter(x => isMon(x) && race(x) === 'Rock' && !x.flags.faceDownBan), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'ban' && onField(c) && ss(g, p, t, 'atk')) link(g, c, t); } }] },
  'Release Restraint': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => monsOf(g, p).some(m => named(m, 'Gearfried the Iron Knight')),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which Gearfried the Iron Knight?', monsOf(g, p).filter(m => named(m, 'Gearfried the Iron Knight')), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Gearfried the Iron Knight.`); } },
    res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Gearfried the Swordmaster')); if (!cs.length || freeM(g, p) < 0) { log(g, `${PN(g, p)} has no Gearfried the Swordmaster to summon.`); shuffleDeck(g, p); return; }
      const [x] = yield* pick(g, p, 'Special Summon which Gearfried the Swordmaster?', cs, 1, 1, 'good'); const fromDeck = x && x.zone === 'deck'; if (x) ss(g, p, x, 'atk'); if (fromDeck) shuffleDeck(g, p); } }] },
  'Release Restraint Wave': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => stOf(g, opp(p)).some(x => x.pos === 'set') && stOf(g, p).some(x => x !== c && faceUp(x) && isSpell(x) && D(x).sub === 'Equip' && x.equipTo),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which of your face-up Equip Spells?', stOf(g, p).filter(x => x !== c && faceUp(x) && isSpell(x) && D(x).sub === 'Equip' && x.equipTo), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; destroy(g, [t, ...stOf(g, opp(p)).filter(x => x.pos === 'set')], { by: p, src: c }); } }] },
  // Port of classic-5.js.
  'Return of the Doomed': { effs: [
    { type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c && isMon(x)),
      cost: function* (g, c, p) { yield* discardPick(g, p, 1, 'Discard 1 Monster Card', c, isMon); },
      res: function* (g, c, p) { (g.rotd || (g.rotd = [])).push({ by: c.u, p, turn: g.turnNo }); log(g, `${PN(g, p)} will get back a monster destroyed by battle at the end of the turn.`); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return a monster to the hand',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!g.rotd && g.rotd.some(e => e.by === c.u && e.turn === g.turnNo),
      res: function* (g, c) { for (const e of g.rotd.filter(e => e.by === c.u && e.turn === g.turnNo)) {
        const seen = new Set(); const cs = g.events.filter(v => v.type === 'move' && v.battle && v.destroyed && v.to === 'gy' && v.turn === g.turnNo && v.c.owner === e.p && v.c.zone === 'gy' && isMon(v.c)).map(v => v.c).filter(x => !seen.has(x.u) && seen.add(x.u));
        if (!cs.length) continue; const [x] = yield* pick(g, e.p, 'Return which monster to your hand?', cs, 1, 1, 'good');
        if (x && x.zone === 'gy') { move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, e.p)} returned ${D(x).n} to the hand.`); } }
        g.rotd = g.rotd.filter(e => e.by !== c.u); } }] },
  // PARTIAL: the End Phase destruction uses a chain link (the ruling says it doesn't start a Chain).
  'Return of the Six Samurai': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && /Six Samurai/.test(D(x).n)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which "Six Samurai" monster?', g.p[p].gy.filter(x => isMon(x) && /Six Samurai/.test(D(x).n)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && ss(g, p, t, 'atk')) { t.flags.f13rss = g.turnNo; c.f13rss = g.turnNo; } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the summoned monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.f13rss === g.turnNo && fieldMons(g).some(m => m.flags.f13rss === g.turnNo),
      res: function* (g, c, p) { c.f13rss = null; destroy(g, fieldMons(g).filter(m => m.flags.f13rss === g.turnNo), { by: p }); } }] },
  // Monsters destroyed this turn are marked as they go to the GY (this card watches from wherever it is).
  'Return Soul': { effs: [
    { type: 'trig', loc: 'any', res: noop, on: (g, ev) => { if (ev.type === 'move' && ev.destroyed && ev.to === 'gy' && ev.c) ev.c.f13dk = g.turnNo; return false; } },
    { type: 'act', cond: (g, c, p) => g.phase === 'end' && [...g.p[0].gy, ...g.p[1].gy].some(x => isMon(x) && x.f13dk === g.turnNo),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return up to 3 monsters destroyed this turn to the Deck', [...g.p[0].gy, ...g.p[1].gy].filter(x => isMon(x) && x.f13dk === g.turnNo), 1, 3, 'bad'); },
      res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) toDeck(g, x, p); if (xs.length) log(g, `${xs.map(x => D(x).n).join(', ')} returned to the Deck.`); } }] },
  // ENGINE: no Standby Phase response window, so it is offered at your Standby Phase as an optional effect. PARTIAL: once per Standby Phase.
  'Return Zombie': { effs: [{ type: 'trig', loc: 'gy', label: 'Pay 500: add this card to your hand',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner,
    cond: (g, c, p) => g.p[p].hand.length === 0 && g.p[p].lp > 500,
    cost: function* (g, c, p) { pay(g, p, 500); },
    res: function* (g, c, p) { if (c.zone === 'gy' && g.p[p].hand.length === 0) { move(g, c, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added Return Zombie to the hand.`); } } }] },
  'Revival Gift': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => nFreeM(g, opp(p)) >= 2 && freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && D(x).tu),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Tuner from your GY?', g.p[p].gy.filter(x => isMon(x) && D(x).tu), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk', { negate: true });
      if (nFreeM(g, opp(p)) >= 2) tokens(g, opp(p), { n: 'Gift Fiend Token', a: 'DARK', r: 'Fiend', lv: 3, atk: 1500, def: 1500 }, 2, 'def'); } }] },
  // Port of classic-3.js.
  'Revival Jam': { effs: [
    { type: 'trig', loc: 'gy', when: true, label: 'Pay 1000: revive next Standby Phase',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
      cond: (g, c, p) => g.p[p].lp > 1000,
      cost: function* (g, c, p) { pay(g, p, 1000); },
      res: function* (g, c) { if (c.zone === 'gy') { c.flags.jamAt = g.turnNo; log(g, 'Revival Jam will return in the next Standby Phase.'); } } },
    { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Revival Jam returns',
      on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner && c.flags.jamAt != null && g.turnNo > c.flags.jamAt) { c.flags.jamAt = null; return true; } return false; },
      res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c, 'def'); } }] },
  'Revival of Dokurorider': { effs: [ritualEffs('Dokurorider')] },

  /* ----- Ring ----- */
  // The Trap's link runs with its damage made 0 (a damage hook on this card in the GY, for the time that link resolves).
  'Ring of Defense': {
    cont: { loc: 'gy', dmg: (g, src, p, n, o) => g.f13rod > 0 && !o.battle ? 0 : undefined },
    effs: [{ type: 'act', ds: true, cond: (g, c, p, x) => !!x.top && !x.top.negated && isTrap(x.top.c) && dmgText(x.top.c),
      target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated || T.f13rod) return; T.f13rod = true; const orig = T.eff;
        T.eff = { ...orig, res: function* (g2, c2, p2, L3) { g2.f13rod = (g2.f13rod || 0) + 1; try { yield* orig.res(g2, c2, p2, L3); } finally { g2.f13rod--; } } };
        log(g, `The damage from ${name(T.c)} will be 0.`); } }] },
  // Edison text as listed (opponent's turn, their monster with ATK up to their LP, 1 per turn); the damage is its current ATK
  // (Edison ruling), taken by both players at the same time.
  'Ring of Destruction': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.tp !== p && !g.inDS && !(g.f13ring && g.f13ring[p] === g.turnNo) && oppFaceUp(g, p).some(m => atk(g, m) <= g.p[opp(p)].lp),
    after: (g, c, p) => { (g.f13ring || (g.f13ring = {}))[p] = g.turnNo; },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up monster?', oppFaceUp(g, p).filter(m => atk(g, m) <= g.p[opp(p)].lp), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const n = atk(g, t);
      if (!destroy(g, [t], { by: p, src: c }).length || n <= 0) return;
      const o = opp(p); g.p[o].lp -= n; log(g, `${PN(g, o)} took ${n} damage.`); emit(g, { type: 'damage', p: o, n, battle: false, src: c, srcP: p });
      damage(g, p, n, { src: c, srcP: p }); } }] },
  // Port of classic-4.js. PARTIAL: monsters that can attack directly still can (the engine has no "must attack this" rule).
  'Ring of Magnetism': { cont: { ...eqBonus(-500, -500), grant: (g, src, m, flag) => flag === 'noAttackTarget' && !!src.equipTo && m.ctrl === src.ctrl && m.u !== src.equipTo && fieldMons(g).some(x => x.u === src.equipTo && x.ctrl === src.ctrl) },
    effs: [equipAct(() => true, 'Equip to which of your face-up monsters?', { own: true, hint: 'cost' })] },

  /* ----- Ritual ----- */
  'Ritual Buster': { effs: [{ type: 'act', cond: g => !!g.sw && g.sw.how === 'ritual' && g.sw.cs.some(onField),
    res: function* (g, c, p) { const o = opp(p); addRule(g, (g2, a) => a.type === 'activate' && a.p === o && isST(a.c), { startOf: p }); log(g, `${PN(g, o)} can't activate Spell or Trap Cards until ${PN(g, p)}'s next turn.`); } }] },
  // PARTIAL: "can't be targeted by monster effects" isn't applied (tgt() has no source check), and "destroyed by monster
  // effects" only catches effects that pass their card to destroy().
  'Ritual Cage': { effs: [{ type: 'act', res: noop }],
    cont: { grant: (g, src, m, flag) => flag === 'noBattleDamage' && m.ctrl === src.ctrl && faceUp(m) && isRitualMon(m),
      replaceDestroy: (g, src, m, o) => !o.battle && !!o.src && isMon(o.src) && m.ctrl === src.ctrl && m.zone === 'm' && faceUp(m) && isRitualMon(m) } },
  'Ritual Foregone': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.p[p].lp > 1000 && freeM(g, p) >= 0 && !(g.f13rf && g.f13rf[p] === g.turnNo) && g.p[p].hand.some(isRitualMon),
      after: (g, c, p) => { (g.f13rf || (g.f13rf = {}))[p] = g.turnNo; },
      cost: function* (g, c, p) { pay(g, p, 1000); },
      res: function* (g, c, p) { const cs = g.p[p].hand.filter(isRitualMon); if (!cs.length || freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon which Ritual Monster?', cs, 1, 1, 'good');
        if (x && ss(g, p, x, 'atk')) { x.flags.cantAttack = true; x.flags.f13rf = g.turnNo; c.f13rf = g.turnNo; } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the summoned Ritual Monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && c.f13rf === g.turnNo && fieldMons(g).some(m => m.flags.f13rf === g.turnNo),
      res: function* (g, c, p) { c.f13rf = null; destroy(g, fieldMons(g).filter(m => m.flags.f13rf === g.turnNo), { by: p }); } }] },
  // PARTIAL: the battle-destroyed monster reaches the GY first, then goes to the top of the Deck (a chain link, not a replacement).
  'Ritual of Destruction': { effs: [ritualEffs('Garlandolf, King of Destruction'),
    { type: 'ign', loc: 'gy', label: 'Banish: battle-destroyed monsters go to the Deck this turn',
      cost: function* (g, c, p) { move(g, c, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished Ritual of Destruction from the GY.`); },
      res: function* (g, c, p) { c.f13rodT = g.turnNo; c.f13rodP = p; log(g, `This turn, monsters destroyed by battle with ${PN(g, p)}'s Ritual Monsters go to the top of the Deck.`); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return the destroyed monster to the top of the Deck',
      on: (g, ev, c) => c.f13rodT === g.turnNo && ev.type === 'move' && ev.battle && ev.destroyed && ev.to === 'gy' && !!ev.killer && isRitualMon(ev.killer) && (ev.killer.ctrl === c.f13rodP || ev.killer.owner === c.f13rodP),
      res: function* (g, c, p, L2) { const x = L2.ev.c; if (x.zone !== 'gy') return; if (isExtraD(D(x))) move(g, x, 'extra', { reason: 'effect' }); else move(g, x, 'deckTop', { reason: 'effect' }); log(g, `${D(x).n} went to the top of the Deck.`); } }] },
  'Ritual of Grace': { effs: [ritualEffs('Divine Grace - Northwemko'),
    { type: 'ign', loc: 'gy', label: 'Banish: a Ritual Monster can’t be targeted this turn',
      cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && isRitualMon(m)),
      cost: function* (g, c, p) { move(g, c, 'ban', { reason: 'cost', by: p }); log(g, `${PN(g, p)} banished Ritual of Grace from the GY.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which Ritual Monster?', monsOf(g, p).filter(m => faceUp(m) && isRitualMon(m)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; t.flags.cantBeTargeted = true; t.flags.f13grace = g.turnNo; c.f13grace = g.turnNo; g.seq++; log(g, `${name(t)} can't be targeted by card effects this turn.`); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'end' && c.f13grace === g.turnNo) { for (const m of fieldMons(g)) if (m.flags.f13grace === g.turnNo) { m.flags.cantBeTargeted = false; m.flags.f13grace = null; } c.f13grace = null; g.seq++; } return false; } }] },
  // ENGINE: ritualSummon() counts Tributes by Level only; there is no hook for a monster that is the entire Tribute.
  'Ritual Raven': { effs: [] },
  'Ritual Sealing': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: g => fieldMons(g).some(m => faceUp(m) && isRitualMon(m)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up Ritual Monster?', fieldMons(g).filter(m => faceUp(m) && isRitualMon(m)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2).filter(m => faceUp(m) && isRitualMon(m)), { by: p, src: c }); } }] },
  'Ritual Weapon': { cont: eqBonus(1500, 1500), effs: [equipAct(m => isRitualMon(m) && lv(m) <= 6, 'Equip to which Level 6 or lower Ritual Monster?')] },

  /* ----- Rocket, Rod ----- */
  'Rocket Jumper': { self: { directAttack: (g, c) => { const fs = fieldOf(g, opp(c.ctrl)); return fs.length > 0 && fs.every(x => x.zone === 'm' && x.pos !== 'atk'); } }, effs: [] },
  'Rocket Pilder': {
    cont: { grant: (g, src, m, flag) => flag === 'noBattleDestroy' && src.equipTo === m.u && !!g.battle && g.battle.a === m },
    effs: [equipAct(),
      { type: 'trig', loc: 'st', mand: true, label: 'The attack target loses ATK', on: (g, ev, c) => ev.type === 'dsEnd' && !!ev.t && !!c.equipTo && ev.a.u === c.equipTo,
        res: function* (g, c, p, L2) { const t = L2.ev.t, a = L2.ev.a; if (!t || !onField(t) || !faceUp(t) || t.zone !== 'm' || !onField(a)) return; const n = atk(g, a); if (!n) return; addMod(g, t, { atk: -n, end: true }); log(g, `${name(t)} lost ${n} ATK.`); } }] },
  // Edison only here (Goat keeps its classic-3.js script).
  'Rocket Warrior': {
    self: { noBattleDestroy: (g, c) => g.phase === 'battle' && g.tp === c.ctrl, noBattleDamage: (g, c) => g.phase === 'battle' && g.tp === c.ctrl },
    effs: [{ type: 'trig', mand: true, label: 'Target loses 500 ATK', on: (g, ev, c) => ev.type === 'afterCalc' && ev.a === c && !!ev.t,
      res: function* (g, c, p, L2) { const t = L2.ev.t; if (t && onField(t) && faceUp(t) && t.zone === 'm') { addMod(g, t, { atk: -500, end: true }); log(g, `${name(t)} lost 500 ATK.`); } } }] },
  // Equipping it destroys the monster's other Equip Spells (ruling). PARTIAL: the negation of a Spell that targets the equipped
  // monster is an optional Spell Speed 3 response (ENGINE: no automatic negation hook, as Ryu Senshi in build/ENGINE_TODO.md).
  "Rod of Silence - Kay'est": { cont: eqBonus(0, 500),
    effs: [equipAct(() => true, 'Equip to which face-up monster?', { post: function* (g, c, p, t) { const xs = stOnField(g).filter(x => x !== c && x.equipTo === t.u && isSpell(x)); if (xs.length) destroy(g, xs, { by: p, src: c }); } }),
      { type: 'quick', loc: 'st', speed: 3, ds: true, label: 'Negate the Spell targeting the equipped monster',
        cond: (g, c, p, x) => !!c.equipTo && !!x.top && !x.top.negated && x.top.c !== c && isSpell(x.top.c) && x.top.t.some(t => t && t.u === c.equipTo && onField(t)),
        target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
        res: function* (g, c, p, L2) { const T = L2.data.L; T.negBy = p; negate(g, T, true); } }] },

  /* ----- Royal ----- */
  'Royal Command': { effs: [{ type: 'act', res: noop }],
    cont: { forbid: (g, src, a) => a.type === 'activate' && !!a.c && isFlipMon(a.c), negates: (g, src, c) => isFlipMon(c) } },
  'Royal Firestorm Guards': { effs: [{ type: 'trig', mand: true, label: 'Shuffle 4 Pyros into the Deck: draw 2', on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
    cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && race(x) === 'Pyro').length >= 4,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target 4 Pyro monsters in your GY', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Pyro'), 4, 4, 'cost'); },
    res: function* (g, c, p, L2) { if (L2.t.length !== 4 || !L2.t.every(x => x.zone === 'gy')) return; for (const x of L2.t) toDeck(g, x, p); log(g, `${PN(g, p)} shuffled 4 Pyro monsters into the Deck.`); draw(g, p, 2); } }] },
  'Royal Keeper': { effs: [
    { type: 'ign', opt: true, label: 'Flip this card face-down', cond: (g, c) => faceUp(c) && c.turnIn !== g.turnNo && !c.posChanged,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { setFaceDown(g, c); c.posChanged = true; } } },
    { type: 'trig', mand: true, label: '+300 ATK and DEF', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 300, def: 300, end: true }); log(g, 'Royal Keeper gained 300 ATK and DEF.'); } } }] },
  'Royal Knight': { effs: [{ type: 'trig', mand: true, label: 'Gain LP equal to its DEF', on: (g, ev, c) => battleKill(ev, c),
    res: function* (g, c, p, L2) { const n = L2.ev.snap ? L2.ev.snap.def : 0; if (n) gain(g, p, n); } }] },
  'Royal Magical Library': { effs: [spellCounter(3),
    { type: 'ign', label: 'Remove 3 Spell Counters: draw 1', cond: (g, c, p) => ctr(c, 'spell') >= 3 && g.p[p].deck.length > 0,
      cost: function* (g, c) { addCtr(g, c, 'spell', -3); log(g, 'Royal Magical Library removed 3 Spell Counters.'); },
      res: function* (g, c, p) { draw(g, p, 1); } }] },
  'Royal Surrender': { effs: [{ type: 'act', cond: (g, c, p, x) => spellTrapAct(x.top) && !x.top.negated && x.top.p !== p && isTrap(x.top.c) && D(x.top.c).sub === 'Continuous',
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { const T = L2.data.L; T.negBy = p; negate(g, T, true); } }] },
  // ENGINE: no Standby Phase response window, so it is offered as an optional trigger while Set at the opponent's Standby Phase.
  // "Activated" counts any activation of a card of that name they own (each activation stamps c.used with the turn).
  'Royal Writ of Taxation': { effs: [
    { type: 'trig', loc: 'any', speed: 2, label: 'Activate Royal Writ of Taxation',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl && setTrap(c) && c.turnIn !== g.turnNo,
      cond: (g, c, p) => setTrap(c) && g.p[opp(p)].hand.length > 0,
      cost: flipUpCost,
      res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand; if (h.length) { const x = h[Math.floor(g.rnd() * h.length)];
          log(g, `${PN(g, p)} looked at ${D(x).n} in ${PN(g, o)}'s hand.`); (g.f13writ || (g.f13writ = [])).push({ u: c.u, p, o, n: D(x).n, start: g.turnNo, end: g.turnNo + 1, hit: false }); }
        trapToGY(g, c); } },
    { type: 'trig', loc: 'any', res: noop, on: (g, ev, c) => {
      if (ev.type === 'summon' && ['normal', 'tribute'].includes(ev.how) && g.f13writ) for (const r of g.f13writ) if (r.u === c.u && ev.p === r.o && ev.cs.some(x => D(x).n === r.n)) r.hit = true;
      return false; } },
    { type: 'trig', loc: 'any', mand: true, label: 'Royal Writ of Taxation: 1000 damage',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && !!g.f13writ && g.f13writ.some(r => r.u === c.u && g.turnNo >= r.end && ev.tp === r.p),
      res: function* (g, c) { const rs = g.f13writ.filter(r => r.u === c.u && g.turnNo >= r.end); g.f13writ = g.f13writ.filter(r => !rs.includes(r));
        for (const r of rs) { const all = []; for (const P of g.p) for (const z of ['hand', 'deck', 'gy', 'ban', 'extra']) all.push(...P[z]); all.push(...allField(g));
          const used = all.some(x => x.owner === r.o && D(x).n === r.n && Object.values(x.used || {}).some(t => typeof t === 'number' && t >= r.start && t <= r.end));
          if (r.hit || used) { log(g, `${r.n} was used, so ${PN(g, r.p)} takes 1000 damage.`); damage(g, r.p, 1000, { src: c, srcP: r.p }); }
          else { log(g, `${r.n} wasn't used, so ${PN(g, r.o)} takes 1000 damage.`); damage(g, r.o, 1000, { src: c, srcP: r.p }); } } } }] },
});
})();
