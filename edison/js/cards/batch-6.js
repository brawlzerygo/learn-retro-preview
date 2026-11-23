/* Batch 6: Dark Gaia, Earthbound Immortal, Fortune Lady, Insect, Koa'ki Meiru, Neo-Spacian.
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md). */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, setFaceDown, negate, addMod,
  equip, equippedTo, link, addCtr, ctr, negateAttack, endBattle, addRule, token, tokens, fusionSummon, canFusion, ritualSummon, canRitual,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned,
  fromFieldToGY, battleKill, isGemini } = L;
const atk = L.atk, def = L.def;

/* ----- shared helpers ----- */
const IC = "Iron Core of Koa'ki Meiru";
const isIC = x => D(x).n === IC;
const isKM = x => /Koa'ki Meiru/.test(D(x).n);
const isKMMon = x => isMon(x) && isKM(x);
const isEI = x => isMon(x) && /^Earthbound Immortal/.test(D(x).n);
const isFL = x => isMon(x) && /^Fortune Lady/.test(D(x).n);
const isNS = x => isMon(x) && /^Neo-Spacian/.test(D(x).n);
const isInsect = x => isMon(x) && race(x) === 'Insect';
const noNormal = { loc: 'hand', forbid: (g, src, a) => (a.type === 'ns' || a.type === 'set') && a.c === src };
const noFieldSpell = g => ![g.p[0].fz, g.p[1].fz].some(f => f && f.pos !== 'set');
const rawAtk = x => D(x).atk === '?' ? Infinity : baseAtk(x);

/* Koa'ki Meiru maintenance: during your End Phase, send an Iron Core (or sendPred) from the hand to the GY,
 or reveal a card that matches revealPred, or this card is destroyed.
 PARTIAL: a maintenance cost is not an effect; here it runs as a mandatory trigger on the chain (so it can be
 responded to, and Skill Drain stops it). */
function maint(revealText, revealPred, sendText, sendPred) {
  return { type: 'trig', mand: true, label: 'Maintenance cost', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
    res: function* (g, c, p) {
      if (!onField(c) || !faceUp(c)) return;
      const h = g.p[p].hand, send = h.filter(x => isIC(x) || (sendPred && sendPred(x))), rev = revealPred ? h.filter(revealPred) : [];
      const opts = [], kinds = [];
      if (send.length) { opts.push(sendText); kinds.push('s'); }
      if (rev.length) { opts.push(revealText); kinds.push('r'); }
      opts.push(`Let ${name(c)} be destroyed`); kinds.push('d');
      const k = kinds[opts.length > 1 ? yield* choose(g, p, `${name(c)}: pay its maintenance cost?`, opts) : 0];
      if (k === 's') { const [x] = yield* pick(g, p, 'Send which card to the GY?', send, 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY to keep ${name(c)}.`); }
      else if (k === 'r') { const [x] = yield* pick(g, p, 'Reveal which card?', rev, 1, 1, 'cost'); log(g, `${PN(g, p)} revealed ${name(x)} to keep ${name(c)}.`); }
      else destroy(g, [c], { by: p, rule: true });
    } };
}
const ICsend = 'Send an Iron Core of Koa\'ki Meiru to the GY';

/* Earthbound Immortal shared parts */
const eiSelf = { noAttackTarget: true, directAttack: true };
const eiCont = {
  // only 1 Earthbound Immortal on the field
  forbid: (g, src, a) => {
    if ((a.type === 'ns' || a.type === 'set' || a.type === 'ss') && a.c && a.c !== src && a.c.id && isEI(a.c)) return true;
    // ruling: if the opponent's only monsters can't be attack targets, they can't attack (unless they attack directly by an effect)
    if (a.type === 'attack' && a.c.ctrl !== src.ctrl && monsOf(g, src.ctrl).every(x => faceUp(x) && has(g, x, 'noAttackTarget')) && !has(g, a.c, 'directAttack')) return true;
    return false;
  } };
const eiSelfDestroy = { type: 'trig', mand: true, label: 'No Field Spell: destroy this card',
  on: (g, ev, c) => noFieldSpell(g),
  cond: (g, c) => onField(c) && faceUp(c) && noFieldSpell(g) && !has(g, c, 'noEffectDestroy'),
  res: function* (g, c, p) { if (onField(c) && faceUp(c) && noFieldSpell(g)) { c.flags.selfDestroy = true; destroy(g, [c], { by: p }); } } };

/* Dark Fusion monsters: their materials, for Dark Calling only (their `mats` block other Fusion cards). */
const DF = {
  'Evil HERO Dark Gaia': [x => race(x) === 'Fiend', x => race(x) === 'Rock'],
  'Evil HERO Malicious Fiend': [x => D(x).n === 'Evil HERO Malicious Edge', x => race(x) === 'Fiend' && lv(x) >= 6],
};
const dfRecipe = fx => DF[D(fx).n] || (D(fx).k === 'fusion' && /Special Summoned with "Dark Fusion"/i.test(D(fx).tx || '') ? L.fusionRecipe(fx) : null);
function dfCombos(preds, pool, limit = 8) {
  const out = [];
  const rec = (i, used) => { if (out.length >= limit) return; if (i === preds.length) { out.push(used.slice()); return; } for (const c of pool) if (!used.includes(c) && isMon(c) && preds[i](c)) { used.push(c); rec(i + 1, used); used.pop(); } };
  rec(0, []);
  const seen = new Set(); return out.filter(m => { const k = m.map(c => c.u).sort().join(','); if (seen.has(k)) return false; seen.add(k); return true; });
}
const dcPool = (g, p) => [...g.p[p].hand, ...g.p[p].gy].filter(isMon);
const dcTargets = (g, p) => g.p[p].extra.filter(fx => { const r = dfRecipe(fx); return r && dfCombos(r, dcPool(g, p), 1).length; });

/* Underground Arachnid's equipped monster */
const eqMon = (g, c) => g.p[c.ctrl].st.find(x => x && isMon(x) && x.equipTo === c.u) || null;
/* Would this monster be destroyed by this battle? (after damage calculation) */
function losesBattle(g, c, a, t) {
  if (c === a) return !!t && t.pos === 'atk' && atk(g, t) >= atk(g, c);
  if (c === t) return c.pos === 'atk' ? atk(g, a) >= atk(g, c) : atk(g, a) > def(g, c);
  return false;
}
/* Fortune Lady Level up */
const flLevelUp = (opt) => ({ type: 'trig', mand: true, opt, label: 'Level up', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
  res: function* (g, c) { if (onField(c) && faceUp(c) && lv(c) < 12) { c.flags.lv = lv(c) + 1; log(g, `${name(c)} is now Level ${lv(c)}.`); } } });
const flStats = n => ({ atk: (g, c) => lv(c) * n, def: (g, c) => lv(c) * n });

E.addScripts({
  /* ===== Dark Gaia ===== */
  // PARTIAL: the engine's Tribute rules are fixed, so this is a summon rule that counts as your Normal Summon
  // (Attack Position only, no Set; the log calls it a Special Summon). ENGINE: a hook for alternative Tribute counts.
  'Big Piece Golem': { effs: [], proc: { label: 'Normal Summon without Tributes', how: 'normal',
    cond: (g, c, p) => g.ns[p] < 1 && !g.noSummon[p] && monsOf(g, p).length === 0 && monsOf(g, opp(p)).length > 0 && !L.forbid(g, { type: 'ns', c, p }),
    cost: function* (g, c, p) { g.ns[p]++; } } },
  'Dark Calling': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && dcTargets(g, p).length > 0,
    res: function* (g, c, p) {
      const fs = dcTargets(g, p); if (!fs.length || freeM(g, p) < 0) return;
      const [fx] = yield* pick(g, p, 'Fusion Summon which monster with Dark Calling?', fs, 1, 1, 'good'); if (!fx) return;
      const cs = dfCombos(dfRecipe(fx), dcPool(g, p)); let mats = cs[0];
      if (cs.length > 1) { const i = yield* choose(g, p, 'Banish which Fusion Materials?', cs.map(m => m.map(x => D(x).n + (x.zone === 'hand' ? ' (hand)' : ' (GY)')).join(' + '))); mats = cs[i]; }
      const sum = mats.reduce((s, x) => s + baseAtk(x), 0), grp = g.group;
      for (const m of mats) move(g, m, 'ban', { reason: 'fusion', group: grp });
      log(g, `${PN(g, p)} banished ${mats.map(x => D(x).n).join(' + ')}.`);
      if (D(fx).n === 'Evil HERO Dark Gaia') fx.flags.baseAtk = sum;
      fx.flags.darkFusion = true;
      ss(g, p, fx, 'atk', { how: 'fusion', group: grp });
    } }] },
  'Elemental HERO Terra Firma': { mats: [x => D(x).n === 'Elemental HERO Ocean', x => D(x).n === 'Elemental HERO Woodsman'],
    effs: [{ type: 'ign', label: 'Tribute a HERO: gain its ATK',
      cond: (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x) && /^Elemental HERO/.test(name(x))),
      cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Tribute which Elemental HERO?', monsOf(g, p).filter(x => x !== c && faceUp(x) && /^Elemental HERO/.test(name(x))), 1, 1, 'cost'); L2.data.a = atk(g, x); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); },
      res: function* (g, c, p, L2) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: L2.data.a, end: true }); log(g, `${name(c)} gained ${L2.data.a} ATK.`); } } }] },
  // PARTIAL: original ATK is set by Dark Calling only, and stays while its effects are negated.
  'Evil HERO Dark Gaia': { mats: [() => false, () => false],
    effs: [{ type: 'trig', when: true, label: 'Change their Defense monsters to Attack', on: (g, ev, c) => ev.type === 'attack' && ev.a === c,
      cond: (g, c, p) => monsOf(g, opp(p)).some(x => x.pos !== 'atk'),
      res: function* (g, c, p) { for (const x of monsOf(g, opp(p))) if (x.pos !== 'atk') { x.pos = 'atk'; log(g, `${name(x)} was changed to Attack Position.`); } } }] },
  // PARTIAL: "each monster must attack this card, if able" is not forced (ENGINE: forced attacks); the opponent's other
  // targets are removed, and their monsters change to Attack Position at their first attack declaration of the turn.
  // Also not enforced: it can't be Special Summoned from the GY or banished.
  'Evil HERO Malicious Fiend': { mats: [() => false, () => false],
    cont: { grant: (g, src, c, flag) => flag === 'noAttackTarget' && c !== src && c.ctrl === src.ctrl && g.tp !== src.ctrl && g.phase === 'battle' },
    effs: [{ type: 'trig', mand: true, label: 'Their monsters change to Attack Position',
      on: (g, ev, c) => ev.type === 'attack' && ev.p !== c.ctrl && c.flags.mfTurn !== g.turnNo,
      res: function* (g, c, p) { c.flags.mfTurn = g.turnNo; for (const x of monsOf(g, opp(p))) if (x.pos !== 'atk') { x.pos = 'atk'; log(g, `${name(x)} was changed to Attack Position.`); } } }] },
  // PARTIAL: ENGINE: no "end of the Battle Phase" event, so it triggers at the end of each Damage Step it was in.
  'Multiple Piece Golem': { mats: [x => D(x).n === 'Big Piece Golem', x => D(x).n === 'Medium Piece Golem'],
    effs: [
      { type: 'trig', mand: true, on: (g, ev, c) => { if (evSummoned(ev, c, ['fusion'])) c.flags.mats = g.events.filter(e => e.type === 'move' && e.reason === 'fusion' && e.group === ev.group).map(e => e.c); return false; }, res: function* () {} },
      { type: 'trig', label: 'Return to the Extra Deck', on: (g, ev, c) => ev.type === 'dsEnd' && (ev.a === c || ev.t === c),
        res: function* (g, c, p) {
          if (!onField(c)) return; const mats = c.flags.mats || [];
          move(g, c, 'extra', { reason: 'effect' }); log(g, `${D(c).n} returned to the Extra Deck.`);
          if (mats.length && mats.every(m => m.zone === 'gy' && m.owner === p) && nFreeM(g, p) >= mats.length && (yield* yn(g, p, 'Special Summon its Fusion Materials from your GY?')))
            for (const m of mats) ss(g, p, m);
        } }] },

  /* ===== Earthbound Immortal ===== */
  'Earthbound Immortal Aslla piscu': { self: eiSelf, cont: eiCont, effs: [eiSelfDestroy,
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy their face-up monsters',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.faceUp && !(ev.snap.flags && ev.snap.flags.selfDestroy),
      res: function* (g, c, p) { const out = destroy(g, oppFaceUp(g, p), { by: p, src: c }); if (out.length) damage(g, opp(p), 800 * out.length, { src: c, srcP: p }); } }] },
  // PARTIAL: it doesn't trigger when destroyed in the hand or Deck.
  'Earthbound Immortal Ccarayhua': { self: eiSelf, cont: eiCont, effs: [eiSelfDestroy,
    { type: 'trig', loc: 'any', mand: true, ds: true, tags: { destroy: 1 }, label: 'Destroy all cards on the field',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !ev.battle && !(ev.snap && ev.snap.flags && ev.snap.flags.selfDestroy),
      res: function* (g, c, p) { destroy(g, allField(g), { by: p, src: c }); } }] },
  // ENGINE: Tribute counts are fixed in the engine. Closest: Tribute this card alone to Tribute Summon a Level 7+ DARK
  // from your hand (your Normal Summon). This summon has no Solemn Judgment window.
  'Double Coston': { effs: [{ type: 'ign', label: 'Tribute as 2: summon a DARK',
    cond: (g, c, p) => g.ns[p] < 1 && !g.noSummon[p] && g.p[p].hand.some(x => isMon(x) && attr(x) === 'DARK' && lv(x) >= 7 && !/Cannot be Normal Summoned/i.test(D(x).tx || '') && !L.forbid(g, { type: 'ns', c: x, p })),
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Tribute Summon which DARK monster?', g.p[p].hand.filter(x => isMon(x) && attr(x) === 'DARK' && lv(x) >= 7 && !/Cannot be Normal Summoned/i.test(D(x).tx || '')), 1, 1, 'good'); L2.data.x = x; g.ns[p]++; move(g, c, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed Double Coston as 2 Tributes.`); },
    res: function* (g, c, p, L2) { const x = L2.data.x; if (!x || x.zone !== 'hand' || freeM(g, p) < 0) return; const grp = g.group;
      move(g, x, 'm', { ctrl: p, pos: 'atk', reason: 'summon', group: grp }); x.summonType = 'tribute'; x.tributes = [c.u];
      log(g, `${PN(g, p)} Tribute Summoned ${name(x)}.`);
      const ev = L.emit(g, { type: 'summon', cs: [x], how: 'tribute', p, tribs: [c] }, grp); g.sw = { cs: [x], p, how: 'tribute', group: ev.group }; } }] },
  'Marionette Mite': { effs: [{ type: 'ign', loc: 'hand', label: 'Discard: take a Fiend or Zombie',
    cond: (g, c, p) => freeM(g, p) >= 0 && oppFaceUp(g, p).some(x => ['Fiend', 'Zombie'].includes(race(x))),
    cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded Marionette Mite.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which Fiend or Zombie?', oppFaceUp(g, p).filter(x => ['Fiend', 'Zombie'].includes(race(x))), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.ctrl !== p && ['Fiend', 'Zombie'].includes(race(t))) takeControl(g, p, t, true); } }] },
  'Revival of the Immortals': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(isEI),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Earthbound Immortal?', g.p[p].gy.filter(isEI), 1, 1, 'good'); },
    // its "no battle damage from attacks involving it" can only matter on this turn, when it can't attack
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && ss(g, p, t)) addRule(g, a => a.type === 'attack' && a.c === t, { end: g.turnNo }); } }] },
  'Earthbound Wave': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p, x) => spellTrapAct(x.top) && x.top.p !== p && !x.top.negated && monsOf(g, p).some(m => faceUp(m) && isEI(m)),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  'Earthbound Whirlwind': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).some(m => faceUp(m) && isEI(m)) && stOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { destroy(g, stOf(g, opp(p)), { by: p, src: c }); } }] },
  'Hardened Armed Dragon': { proc: { label: 'Special Summon (send a Level 8+ monster)',
      cond: (g, c, p) => g.p[p].hand.some(x => x !== c && isMon(x) && lv(x) >= 8),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Send a Level 8 or higher monster from your hand to the GY', g.p[p].hand.filter(x => x !== c && isMon(x) && lv(x) >= 8), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); } },
    // not an activated effect: the Level 7+ monster it was Tributed for can't be destroyed by card effects
    effs: [{ type: 'trig', loc: 'gy', mand: true, on: (g, ev, c) => { if (ev.type === 'summon' && ev.how === 'tribute' && ev.tribs && ev.tribs.includes(c)) for (const m of ev.cs) if (lv(m) >= 7) m.flags.noEffectDestroy = true; return false; }, res: function* () {} }] },

  /* ===== Fortune Lady ===== */
  'Fortune Lady Dark': { self: flStats(400), effs: [flLevelUp(false),
    { type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon a Fortune Lady from the GY',
      on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.to === 'gy' && ev.killer && ev.killer.ctrl === c.ctrl && ev.prevCtrl !== c.ctrl && isFL(ev.killer) && ev.c.zone === 'gy',
      cond: (g, c, p, x) => freeM(g, p) >= 0 && onField(x.ev.killer) && faceUp(x.ev.killer) && g.p[p].gy.some(isFL),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Fortune Lady from your GY?', g.p[p].gy.filter(isFL), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  'Fortune Lady Light': { self: flStats(200), effs: [flLevelUp(true),
    { type: 'trig', loc: 'any', when: true, tags: { ss: 1 }, label: 'Special Summon a Fortune Lady from the Deck',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.reason === 'effect',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(isFL),
      res: function* (g, c, p) { const [x] = yield* pick(g, p, 'Special Summon which Fortune Lady from your Deck?', g.p[p].deck.filter(isFL), 1, 1, 'good'); if (x) ss(g, p, x); shuffleDeck(g, p); } }] },
  'Fortune Lady Wind': { self: flStats(300), effs: [flLevelUp(false),
    { type: 'trig', when: true, tags: { destroy: 1 }, label: 'Destroy Spells/Traps',
      on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
      cond: (g, c, p) => { const n = monsOf(g, p).filter(x => faceUp(x) && isFL(x)).length; return n > 0 && stOf(g, opp(p)).length >= n; },
      res: function* (g, c, p) { const n = Math.min(monsOf(g, p).filter(x => faceUp(x) && isFL(x)).length, stOf(g, opp(p)).length); if (!n) return; const ts = yield* pick(g, p, `Destroy ${n} Spell/Trap card(s)`, stOf(g, opp(p)), n, n, 'bad'); destroy(g, ts, { by: p }); } }] },
  'Fortune Lady Water': { self: flStats(300), effs: [flLevelUp(true),
    { type: 'trig', ds: true, label: 'Draw 2',
      on: (g, ev, c) => evSummoned(ev, c) && !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how),
      cond: (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x) && isFL(x) && D(x).n !== 'Fortune Lady Water') && g.p[p].deck.length >= 2,
      res: function* (g, c, p) { draw(g, p, 2); } }] },
  'Rai-Mei': { effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Add a Level 2 or lower LIGHT',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
    cond: (g, c, p) => g.p[p].deck.some(x => isMon(x) && attr(x) === 'LIGHT' && lv(x) <= 2),
    res: function* (g, c, p) { yield* search(g, p, x => isMon(x) && attr(x) === 'LIGHT' && lv(x) <= 2, 'Add a Level 2 or lower LIGHT monster'); } }] },
  "Fortune's Future": { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].ban.some(isFL) && g.p[p].deck.length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which banished Fortune Lady to the GY?', g.p[p].ban.filter(isFL), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'ban') { move(g, t, 'gy', { reason: 'effect' }); log(g, `${name(t)} returned to the GY.`); draw(g, p, 2); } } }] },
  // ENGINE: the engine collects Trigger Effects from the m, st, hand, gy, ban, deck and extra zones, not the Field Zone (fz),
  // so these triggers only work once fz is scanned too. The return in the Standby Phase is also on this card (loc any).
  'Future Visions': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'fz', mand: true, label: 'Banish the Normal Summoned monster',
      on: (g, ev, c) => faceUp(c) && ev.type === 'summon' && ['normal', 'tribute'].includes(ev.how),
      res: function* (g, c, p, L2) { if (!onField(c) || !faceUp(c)) return; for (const m of L2.ev.cs) if (onField(m) && faceUp(m)) { const q = m.ctrl; move(g, m, 'ban', { reason: 'effect', by: p }); m.flags.fvReturn = { p: q, from: g.turnNo }; g.fv = g.fv || []; g.fv.push(m.u); log(g, `${D(m).n} was banished until ${PN(g, q)}'s next Standby Phase.`); } } },
    { type: 'trig', loc: 'any', mand: true, label: 'Return the banished monster',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && (g.fv || []).length > 0 && allCards(g, 'ban').some(m => g.fv.includes(m.u) && m.flags.fvReturn && m.flags.fvReturn.p === ev.tp && m.flags.fvReturn.from < g.turnNo),
      res: function* (g, c, p, L2) { for (const m of allCards(g, 'ban').filter(m => g.fv.includes(m.u) && m.flags.fvReturn && m.flags.fvReturn.p === L2.ev.tp && m.flags.fvReturn.from < g.turnNo)) { const q = m.flags.fvReturn.p; g.fv = g.fv.filter(u => u !== m.u); m.flags.fvReturn = null; if (freeM(g, q) >= 0) { move(g, m, 'm', { ctrl: q, pos: 'atk', reason: 'summon' }); log(g, `${name(m)} returned to the field.`); } } } }] },

  /* ===== Insect ===== */
  'Koa\'ki Meiru Beetle': { effs: [maint('Reveal an Insect monster', isInsect, ICsend),
    { type: 'trig', mand: true, label: 'Change it to Defense Position',
      on: (g, ev, c) => ev.type === 'summon' && !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how) && ev.cs.some(x => onField(x) && x.pos === 'atk' && ['LIGHT', 'DARK'].includes(attr(x))),
      res: function* (g, c, p, L2) { for (const x of L2.ev.cs) if (onField(x) && x.pos === 'atk' && ['LIGHT', 'DARK'].includes(attr(x))) { x.pos = 'def'; log(g, `${name(x)} was changed to Defense Position.`); } } }] },
  // PARTIAL: "can't be Special Summoned by other ways" is not enforced.
  'Aztekipede, the Worm Warrior': { cont: noNormal,
    proc: { label: 'Special Summon (banish an Insect from your GY)', cond: (g, c, p) => g.p[p].gy.some(isInsect),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish an Insect from your GY', g.p[p].gy.filter(isInsect), 1, 1, 'cost'); move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${name(x)}.`); } },
    effs: [{ type: 'trig', mand: true, label: 'Send their top card to the GY', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
      res: function* (g, c, p) { mill(g, opp(p), 1); } }] },
  'Cross-Sword Beetle': { effs: [], cont: { grant: (g, src, c, flag) => flag === 'piercing' && c.ctrl === src.ctrl && faceUp(c) && race(c) === 'Insect' && monsOf(g, src.ctrl).some(x => x !== src && faceUp(x) && race(x) === 'Insect') } },
  'Spyder Spider': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon an Insect from the GY',
    on: (g, ev, c) => battleKill(ev, c) && ev.snap && ev.snap.pos !== 'atk',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => isInsect(x) && lv(x) <= 4),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which Level 4 or lower Insect?', g.p[p].gy.filter(x => isInsect(x) && lv(x) <= 4), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t); } }] },
  'Flying Kamakiri 1': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon a WIND',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && attr(x) === 'WIND' && rawAtk(x) <= 1500),
    res: function* (g, c, p) { const [x] = yield* pick(g, p, 'Special Summon a WIND monster with 1500 or less ATK', g.p[p].deck.filter(x => isMon(x) && attr(x) === 'WIND' && rawAtk(x) <= 1500), 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  'Bee List Soldier': { effs: [{ type: 'ign', label: 'Tribute 2 Insects: draw 2',
    cond: (g, c, p) => g.p[p].deck.length >= 2 && monsOf(g, p).some(x => x !== c && faceUp(x) && race(x) === 'Insect' && D(x).n !== 'Bee List Soldier'),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute which other Insect?', monsOf(g, p).filter(x => x !== c && faceUp(x) && race(x) === 'Insect' && D(x).n !== 'Bee List Soldier'), 1, 1, 'cost'); move(g, c, 'gy', { reason: 'cost' }); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed Bee List Soldier and ${D(x).n}.`); },
    res: function* (g, c, p) { draw(g, p, 2); } }] },
  'Arsenal Bug': { effs: [], self: { atk: (g, c) => monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && race(x) === 'Insect') ? 0 : -1000,
    def: (g, c) => monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && race(x) === 'Insect') ? 0 : -1000 } },
  'Howling Insect': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Special Summon an Insect',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isInsect(x) && rawAtk(x) <= 1500),
    res: function* (g, c, p) { const [x] = yield* pick(g, p, 'Special Summon an Insect with 1500 or less ATK', g.p[p].deck.filter(x => isInsect(x) && rawAtk(x) <= 1500), 1, 1, 'good'); if (x) ss(g, p, x); shuffleDeck(g, p); } }] },
  'Gokipon': { effs: [{ type: 'trig', loc: 'gy', when: true, label: 'Add an Insect',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
    cond: (g, c, p) => g.p[p].deck.some(x => isInsect(x) && rawAtk(x) <= 1500),
    res: function* (g, c, p) { yield* search(g, p, x => isInsect(x) && rawAtk(x) <= 1500, 'Add an Insect with 1500 or less ATK'); } }] },
  'Man-Eater Bug': { effs: [{ type: 'trig', mand: true, faceDownOk: true, tags: { destroy: 1 }, on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    target: function* (g, c, p, L2) { const cands = fieldMons(g); if (cands.length) yield* tgt(g, p, L2, 'Destroy which monster?', cands, 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  // PARTIAL: it runs as a mandatory trigger (the Insect's controller then chooses to search), and two Insects destroyed
  // at once give one search.
  'Verdant Sanctuary': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, label: 'Add an Insect of the same Level',
      on: (g, ev, c) => faceUp(c) && ev.type === 'move' && ev.wasField && ev.destroyed && ev.to === 'gy' && ev.snap && ev.snap.faceUp && ev.snap.race === 'Insect' && isMon(ev.c),
      res: function* (g, c, p, L2) { const x = L2.ev.c, q = L2.ev.prevCtrl, n = lv(x);
        if (!g.p[q].deck.some(y => isInsect(y) && lv(y) === n)) return;
        if (yield* yn(g, q, `Verdant Sanctuary: add a Level ${n} Insect from your Deck?`)) yield* search(g, q, y => isInsect(y) && lv(y) === n, `Add a Level ${n} Insect`); } }] },
  'Lair Wire': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => g.p[p].gy.some(isInsect) && monsOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish an Insect from your GY', g.p[p].gy.filter(isInsect), 1, 1, 'cost'); move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${name(x)}.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },
  // PARTIAL: the battle replacement is automatic (it always destroys the equipped monster instead).
  'Underground Arachnid': {
    cont: { forbid: (g, src, a) => a.type === 'activate' && a.p !== src.ctrl && a.eff && a.eff.type === 'act' && isST(a.c) && ((g.aw && g.aw.a === src) || (g.battle && g.battle.a === src)) },
    self: { noBattleDestroy: (g, c) => !!eqMon(g, c) },
    effs: [
      { type: 'ign', opt: true, label: 'Equip one of their monsters',
        cond: (g, c, p) => !eqMon(g, c) && freeST(g, p) >= 0 && oppFaceUp(g, p).length > 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip which monster to Underground Arachnid?', oppFaceUp(g, p), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || t.zone !== 'm' || !onField(c) || eqMon(g, c) || freeST(g, p) < 0) return;
          move(g, t, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); t.equipTo = c.u; t.flags.negated = true; log(g, `${D(t).n} was equipped to Underground Arachnid.`); } },
      { type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the equipped monster instead',
        on: (g, ev, c) => ev.type === 'afterCalc' && (ev.a === c || ev.t === c) && !!eqMon(g, c) && losesBattle(g, c, ev.a, ev.t),
        res: function* (g, c, p) { const m = eqMon(g, c); if (m) destroy(g, [m], { by: p }); } }] },

  /* ===== Koa'ki Meiru ===== */
  'Giant Rat': { effs: [{ type: 'trig', loc: 'gy', tags: { ss: 1 }, label: 'Special Summon an EARTH',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && attr(x) === 'EARTH' && rawAtk(x) <= 1500),
    res: function* (g, c, p) { const [x] = yield* pick(g, p, 'Special Summon an EARTH monster with 1500 or less ATK', g.p[p].deck.filter(x => isMon(x) && attr(x) === 'EARTH' && rawAtk(x) <= 1500), 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  "Koa'ki Meiru Boulder": { effs: [{ type: 'trig', loc: 'gy', when: true, label: "Add an Iron Core or a Koa'ki Meiru",
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.to === 'gy',
    cond: (g, c, p) => g.p[p].deck.some(x => isIC(x) || (isKMMon(x) && lv(x) <= 4)),
    res: function* (g, c, p) { yield* search(g, p, x => isIC(x) || (isKMMon(x) && lv(x) <= 4), "Add an Iron Core or a Level 4 or lower Koa'ki Meiru"); } }] },
  "Koa'ki Meiru Crusader": { effs: [maint('Reveal a Beast-Warrior', x => isMon(x) && race(x) === 'Beast-Warrior', ICsend),
    { type: 'trig', loc: 'any', label: "Return a Koa'ki Meiru card to the hand",
      on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.killer === c && ev.prevCtrl !== c.owner && (c.zone === 'm' || c.zone === 'gy'),
      cond: (g, c, p) => g.p[p].gy.some(isKM),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, "Return which Koa'ki Meiru card to your hand?", g.p[p].gy.filter(isKM), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },
  "Koa'ki Meiru Guardian": { effs: [maint('Reveal a Rock monster', x => isMon(x) && race(x) === 'Rock', ICsend),
    { type: 'quick', label: 'Tribute: negate a monster effect', tags: { destroy: 1 },
      cond: (g, c, p, x) => x.top && !x.top.negated && !x.top.cardAct && isMon(x.top.c) && x.top.c !== c,
      cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; move(g, c, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} Tributed Koa'ki Meiru Guardian.`); },
      res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  "Koa'ki Meiru Maximus": { cont: noNormal,
    proc: { label: 'Special Summon (banish an Iron Core from your hand)', cond: (g, c, p) => g.p[p].hand.some(isIC),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish an Iron Core from your hand', g.p[p].hand.filter(isIC), 1, 1, 'cost'); move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${name(x)}.`); } },
    effs: [maint('', null, "Send an Iron Core or a Koa'ki Meiru monster to the GY", isKMMon),
      { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy a card', cond: (g, c, p) => fieldOf(g, opp(p)).length > 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which card?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  // PARTIAL: the 1-Tribute Summon is a summon rule here that counts as your Normal Summon (the log calls it a Special
  // Summon). ENGINE: a hook for alternative Tribute counts.
  "Koa'ki Meiru Rooklord": {
    proc: { label: "Tribute Summon (Tribute 1 Koa'ki Meiru)", how: 'tribute',
      cond: (g, c, p) => g.ns[p] < 1 && !g.noSummon[p] && monsOf(g, p).some(isKMMon) && !L.forbid(g, { type: 'ns', c, p }),
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, "Tribute which Koa'ki Meiru monster?", monsOf(g, p).filter(isKMMon), 1, 1, 'cost'); g.ns[p]++; move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    effs: [maint('Reveal a Warrior monster', x => isMon(x) && race(x) === 'Warrior', ICsend),
      { type: 'trig', when: true, tags: { destroy: 1 }, label: 'Destroy up to 2 cards',
        on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute']),
        cond: (g, c, p) => g.p[p].gy.some(isKM) && fieldOf(g, opp(p)).length > 0,
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, "Banish a Koa'ki Meiru card from your GY", g.p[p].gy.filter(isKM), 1, 1, 'cost'); move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${name(x)}.`); },
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy up to 2 cards', fieldOf(g, opp(p)), 1, 2, 'bad'); },
        res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  "Koa'ki Meiru Tornado": { effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Destroy their Special Summoned monsters',
    cond: (g, c, p) => g.p[p].hand.some(isIC) && monsOf(g, opp(p)).some(x => ['special', 'synchro', 'fusion', 'ritual'].includes(x.summonType)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Put an Iron Core on top of your Deck', g.p[p].hand.filter(isIC), 1, 1, 'cost'); move(g, x, 'deckTop', { reason: 'cost' }); log(g, `${PN(g, p)} put Iron Core of Koa'ki Meiru on top of the Deck.`); },
    res: function* (g, c, p) { destroy(g, monsOf(g, opp(p)).filter(x => ['special', 'synchro', 'fusion', 'ritual'].includes(x.summonType)), { by: p }); } }] },
  "Koa'ki Meiru Urnight": { effs: [maint('Reveal a Beast-Warrior', x => isMon(x) && race(x) === 'Beast-Warrior', ICsend),
    { type: 'ign', opt: true, tags: { ss: 1 }, label: "Reveal an Iron Core: summon a Koa'ki Meiru",
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(isIC) && g.p[p].deck.some(x => isKMMon(x) && lv(x) <= 4 && D(x).n !== "Koa'ki Meiru Urnight"),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Reveal an Iron Core from your hand', g.p[p].hand.filter(isIC), 1, 1, 'cost'); log(g, `${PN(g, p)} revealed ${name(x)}.`); },
      res: function* (g, c, p) { const cands = g.p[p].deck.filter(x => isKMMon(x) && lv(x) <= 4 && D(x).n !== "Koa'ki Meiru Urnight"); const [x] = yield* pick(g, p, "Special Summon a Level 4 or lower Koa'ki Meiru from your Deck", cands, 1, 1, 'good'); if (x) ss(g, p, x); shuffleDeck(g, p); } }] },
  'Core Transport Unit': { effs: [{ type: 'act', res: function* () {} },
    { type: 'ign', loc: 'st', opt: true, label: 'Discard: add an Iron Core',
      cond: (g, c, p) => g.p[p].hand.length > 0 && g.p[p].deck.some(isIC),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard a card', g.p[p].hand, 1, 1, 'cost'); move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); },
      res: function* (g, c, p) { yield* search(g, p, isIC, "Add Iron Core of Koa'ki Meiru"); } }] },
  // PARTIAL: the card is drawn first; choosing "instead of drawing" puts that card back on top of the Deck.
  "Iron Core of Koa'ki Meiru": { effs: [{ type: 'trig', loc: 'gy', label: 'Add Iron Core to the hand',
    on: (g, ev, c) => ev.type === 'move' && ev.reason === 'draw' && ev.phase === 'draw' && ev.c !== c && ev.c.owner === c.owner && g.tp === c.owner,
    cost: function* (g, c, p, L2) {
      const km = g.p[p].hand.filter(isKMMon);
      const dr = g.events.slice().reverse().find(e => e.type === 'move' && e.reason === 'draw' && e.c.owner === p);
      L2.data.drawn = dr && dr.c;
      L2.data.mode = km.length ? yield* choose(g, p, 'Iron Core: how?', ['Instead of drawing (put the drawn card back)', "Send a Koa'ki Meiru monster from your hand"]) : 0;
      if (L2.data.mode === 1) { const [x] = yield* pick(g, p, "Send which Koa'ki Meiru monster to the GY?", km, 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); }
    },
    res: function* (g, c, p, L2) {
      if (c.zone !== 'gy') return;
      if (L2.data.mode === 0) { const d = L2.data.drawn; if (d && d.zone === 'hand') { move(g, d, 'deckTop', { reason: 'effect' }); log(g, `${PN(g, p)} put the drawn card back on top of the Deck.`); } }
      move(g, c, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added Iron Core of Koa'ki Meiru from the GY to the hand.`);
    } }] },
  // ENGINE: Field Zone (fz) triggers are not collected by the engine yet (see Future Visions), so its maintenance and
  // search only work once fz is scanned. PARTIAL: the search is offered to this card's controller only.
  'Iron Core Specimen Lab': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'fz', mand: true, label: 'Maintenance cost', on: (g, ev, c) => faceUp(c) && ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; const ic = g.p[p].hand.filter(isIC);
        if (ic.length && (yield* yn(g, p, 'Reveal an Iron Core to keep Iron Core Specimen Lab?'))) { log(g, `${PN(g, p)} revealed Iron Core of Koa'ki Meiru.`); return; }
        destroy(g, [c], { by: p, rule: true }); } },
    { type: 'trig', loc: 'fz', label: "Add a Koa'ki Meiru monster",
      on: (g, ev, c) => faceUp(c) && ev.type === 'move' && ev.wasField && ev.destroyed && ev.phase === 'end' && ev.c.owner === c.ctrl && ev.snap && isKM(ev.c) && ev.snap.mon,
      cond: (g, c, p) => g.p[p].deck.some(isKMMon),
      res: function* (g, c, p) { yield* search(g, p, isKMMon, "Add a Koa'ki Meiru monster"); } }] },
  // PARTIAL: it is linked like Call of the Haunted (the monster leaving the field in any way destroys this card).
  'Core Reinforcement': { effs: [{ type: 'act', tags: { ss: 1 },
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(isKMMon),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, "Special Summon which Koa'ki Meiru monster?", g.p[p].gy.filter(isKMMon), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && onField(c) && ss(g, p, t, 'atk')) { link(g, c, t); g.coreRein = g.coreRein || {}; g.coreRein[c.u] = t.u; } else if (onField(c)) move(g, c, 'gy', { reason: 'rule' }); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Take damage',
      on: (g, ev, c) => ev.type === 'move' && ev.destroyed && ev.wasField && g.coreRein && g.coreRein[c.u] === ev.c.u && ev.phase === 'end' && g.tp === c.ctrl && onField(c),
      res: function* (g, c, p, L2) { const n = L2.ev.snap ? L2.ev.snap.atk : 0; if (n) damage(g, p, n, { src: c, srcP: p }); } }] },
  'Iron Core Luster': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p, x) => spellTrapAct(x.top) && x.top.p !== p && !x.top.negated && g.p[p].hand.some(isIC),
    cost: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Reveal an Iron Core from your hand', g.p[p].hand.filter(isIC), 1, 1, 'cost'); log(g, `${PN(g, p)} revealed ${name(x)}.`); L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  'B. Skull Dragon (Archfiend)': { mats: [x => /Summoned Skull/.test(D(x).n), x => /^Red-Eyes B(lack|\.) Dragon$/.test(D(x).n)], effs: [] },
  'Blue-Eyes Ultimate Dragon': { mats: [0, 1, 2].map(() => x => D(x).n === 'Blue-Eyes White Dragon'), effs: [] },
  'Flame Swordsman': { mats: [x => D(x).n === 'Flame Manipulator', x => D(x).n === 'Masaki the Legendary Swordsman'], effs: [] },
  "Koa'ki Meiru Powerhand": {
    cont: { negates: (g, src, x) => src.flags.pwVs === x.u && src.flags.pwTurn === g.turnNo && g.phase === 'battle' && x.zone === 'm' },
    effs: [maint('Reveal a Normal Trap', x => isTrap(x) && D(x).sub === 'Normal', ICsend),
      // marks the LIGHT or DARK monster it battles this Battle Phase (no activation)
      { type: 'trig', mand: true, on: (g, ev, c) => { if (ev.type === 'attack' && ev.t && (ev.a === c || ev.t === c)) { const o = ev.a === c ? ev.t : ev.a; if (['LIGHT', 'DARK'].includes(attr(o))) { c.flags.pwVs = o.u; c.flags.pwTurn = g.turnNo; } } return false; }, res: function* () {} }] },

  /* ===== Neo-Spacian ===== */
  'Cross Porter': { effs: [
    { type: 'ign', label: 'Send a monster: summon a Neo-Spacian', cond: (g, c, p) => monsOf(g, p).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Send which monster you control to the GY?', monsOf(g, p), 1, 1, 'cost'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.ctrl !== p) return; move(g, t, 'gy', { reason: 'effect', by: p, cpSelf: t === c }); log(g, `${D(t).n} was sent to the GY.`);
        if (t.zone !== 'gy') return; const ns = g.p[p].hand.filter(isNS); if (ns.length && freeM(g, p) >= 0) { const [x] = yield* pick(g, p, 'Special Summon which Neo-Spacian from your hand?', ns, 1, 1, 'good'); if (x) ss(g, p, x); } } },
    { type: 'trig', loc: 'gy', when: true, label: 'Add a Neo-Spacian',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && !ev.cpSelf,
      cond: (g, c, p) => g.p[p].deck.some(isNS),
      res: function* (g, c, p) { yield* search(g, p, isNS, 'Add a Neo-Spacian monster'); } }] },
  'Neo-Spacian Aqua Dolphin': { effs: [{ type: 'ign', opt: true, label: 'Discard: look at their hand',
    cond: (g, c, p) => g.p[p].hand.length > 0 && g.p[opp(p)].hand.length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard a card', g.p[p].hand, 1, 1, 'cost'); move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); },
    res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand; log(g, `${PN(g, p)} looked at ${PN(g, o)}'s hand.`); const mons = h.filter(isMon); if (!mons.length) return;
      const [x] = yield* pick(g, p, 'Choose a monster in their hand', mons, 1, 1, 'bad'); if (!x) return;
      const a = rawAtk(x), best = Math.max(-1, ...monsOf(g, p).filter(faceUp).map(m => atk(g, m)));
      if (best >= a) { move(g, x, 'gy', { reason: 'effect', destroyed: true, by: p }); log(g, `${name(x)} was destroyed.`); damage(g, o, 500, { src: c, srcP: p }); }
      else damage(g, p, 500, { src: c, srcP: p }); } }] },
  // ENGINE: copying another card's name and effects needs the engine to look scripts up by a changeable name.
  // PARTIAL: the effect activates and targets, but the copy is not applied.
  'Neo-Spacian Dark Panther': { effs: [{ type: 'ign', opt: true, label: "Copy a monster's name and effects",
    cond: (g, c, p) => oppFaceUp(g, p).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Copy which monster?', oppFaceUp(g, p), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c)) log(g, `Neo-Spacian Dark Panther copies ${name(t)} until the End Phase (the copy isn't automated yet).`); } }] },
  // PARTIAL: the Spell result turns the attack into direct battle damage at once (no new Damage Step).
  'Neo-Spacian Glow Moss': { effs: [{ type: 'trig', mand: true, label: 'Opponent draws and shows a card',
    on: (g, ev, c) => ev.type === 'attack' && (ev.a === c || ev.t === c),
    res: function* (g, c, p, L2) { const o = opp(p); draw(g, o, 1); const x = g.p[o].hand[g.p[o].hand.length - 1]; if (!x) return; log(g, `${PN(g, o)} showed ${name(x)}.`);
      if (isMon(x)) endBattle(g);
      else if (isSpell(x)) { if (L2.ev.a === c && L2.ev.t && onField(c) && c.pos === 'atk' && g.aw && (yield* yn(g, p, 'Change it to a direct attack?'))) { negateAttack(g); g.aw = null; damage(g, o, atk(g, c), { battle: true, src: c, srcP: p, direct: true }); } }
      else if (onField(c)) { c.pos = 'def'; log(g, `${name(c)} was changed to Defense Position.`); } } }] },
  'Convert Contact': { effs: [{ type: 'act',
    cond: (g, c, p) => monsOf(g, p).length === 0 && g.p[p].hand.some(isNS) && g.p[p].deck.some(isNS) && g.p[p].deck.length >= 3,
    res: function* (g, c, p) { const h = g.p[p].hand.filter(isNS), d = g.p[p].deck.filter(isNS); if (!h.length || !d.length) return;
      const [a] = yield* pick(g, p, 'Send a Neo-Spacian from your hand to the GY', h, 1, 1, 'cost');
      const [b] = yield* pick(g, p, 'Send a Neo-Spacian from your Deck to the GY', d, 1, 1, 'good');
      const grp = g.group; move(g, a, 'gy', { reason: 'effect', group: grp }); move(g, b, 'gy', { reason: 'effect', group: grp }); shuffleDeck(g, p);
      log(g, `${PN(g, p)} sent ${D(a).n} and ${D(b).n} to the GY.`); draw(g, p, 2); } }] },
});
})();
