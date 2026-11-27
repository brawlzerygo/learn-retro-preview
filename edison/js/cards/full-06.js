/* Full pool batch 06: Dark Master - Zorc to Double-Edged Sword Technique.
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). One shared script per card, written from the
 2010 (Edison) text and rulings; cards with a goat-only script elsewhere keep it for Goat, and this one is their Edison copy. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, mill, search, setFaceDown, negate, addMod, equip,
  addCtr, ctr, name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, monsOf, stOf, fieldOf, allField,
  fieldMons, freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, live, opp, stOnField, evSummoned, battleKill,
  emit, dice, forbid } = L;
const atk = L.atk, def = L.def;

/* ----- helpers ----- */
const named = (c, n) => D(c).n === n;
const txt = c => { const d = D(c); return ((d.ps && /①/.test(d.ps)) ? d.ps + '\n' : '') + (d.tx || ''); };
const isUmi = c => c && faceUp(c) && (name(c) === 'Umi' || named(c, 'A Legendary Ocean'));
const umiOn = g => [g.p[0].fz, g.p[1].fz].some(isUmi);
const isDHero = c => isMon(c) && /^Destiny HERO/.test(name(c));
const isGB = c => isMon(c) && /^Gladiator Beast/.test(name(c));
const sixSam = c => isMon(c) && /Six Samurai/.test(name(c));
const scorp = c => /Dark Scorpion/.test(D(c).n);
const ATTRS = ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND'];
const TYPES = ['Aqua', 'Beast', 'Beast-Warrior', 'Dinosaur', 'Dragon', 'Fairy', 'Fiend', 'Fish', 'Insect', 'Machine', 'Plant', 'Psychic',
  'Pyro', 'Reptile', 'Rock', 'Sea Serpent', 'Spellcaster', 'Thunder', 'Warrior', 'Winged Beast', 'Zombie'];
const flipUp = (g, c, pos) => { c.pos = pos; g.seq++; log(g, `${name(c)} was flipped face-up.`); emit(g, { type: 'flip', c, p: c.ctrl }); };
function* discard(g, p, n, text, not) { const h = g.p[p].hand.filter(x => x !== not); const xs = yield* pick(g, p, text, h, n, n, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'discard' }); if (xs.length) log(g, `${PN(g, p)} discarded ${xs.map(name).join(', ')}.`); return xs; }
// "Cannot be Special Summoned" style. PARTIAL: one cont per card, so it only blocks a Special Summon from the GY.
const noSSFromGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src };
// A Special Summon-only monster (Nomi) that can be revived once it was properly summoned: c.used.proper (kept across zones).
const nomiGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src && !src.used.proper };
// Marks every summoned monster as properly summoned (used by the Dimension cards, Desert Twister, Destiny End Dragoon).
const markProper = { type: 'trig', loc: 'any', on: (g, ev) => { if (ev.type === 'summon') for (const x of ev.cs) x.used.proper = true; return false; }, res: function* () {} };
const noSSAtAll = c => /Cannot be Special Summoned(?! except)/i.test(D(c).tx || '') || /Cannot be Special Summoned except/i.test(D(c).tx || '');
const ssOnly = c => ['fusion', 'synchro', 'ritual'].includes(D(c).k) || /Cannot be Normal Summoned/i.test(D(c).tx || '');
// Can this banished monster come back with a Dimension card? (face-up, and properly summoned if it is Special Summon-only)
const dimOk = c => isMon(c) && !c.flags.faceDownBan && !(noSSAtAll(c) && /except/i.test(D(c).tx || '')) && (!ssOnly(c) || c.used.proper);
/* Fusion and Synchro Materials, for De-Fusion and De-Synchro: each material in the GY and the summoned monster share a
 mark (the summon's event group). A material that leaves the GY loses its mark, so it can't come back even if it returns. */
const matHook = { type: 'trig', loc: 'any', res: function* () {},
  on: (g, ev) => {
    if (ev.type === 'move') {
      if (ev.from === 'gy' && ev.c.flags.matGroup != null) delete ev.c.flags.matGroup;
      if (ev.to === 'gy' && (ev.reason === 'synchro' || ev.reason === 'fusion') && ev.c.zone === 'gy') ev.c.flags.matGroup = ev.group;
    } else if (ev.type === 'summon' && (ev.how === 'synchro' || ev.how === 'fusion')) {
      for (const x of ev.cs) { x.flags.matGroup = ev.group; x.flags.matN = g.events.filter(e => e.type === 'move' && e.group === ev.group && e.reason === ev.how).length; }
    }
    return false;
  } };
function* returnAndRevive(g, p, t, kind) {
  const grp = t.flags.matGroup, n = t.flags.matN || 0, oldUs = t.flags.fusionMats;
  move(g, t, 'extra', { reason: 'effect', by: p }); log(g, `${D(t).n} returned to the Extra Deck.`);
  let mats = grp != null ? g.p[p].gy.filter(x => x.flags.matGroup === grp) : [];
  if (grp == null && oldUs && oldUs.length) { mats = oldUs.map(u => g.p[p].gy.find(x => x.u === u)); if (mats.some(x => !x)) return; }
  else if (!n || mats.length !== n) return;
  if (!mats.length || nFreeM(g, p) < mats.length || mats.some(x => forbid(g, { type: 'ss', c: x, p, how: 'special' }))) return;
  if (!(yield* yn(g, p, `Special Summon ${mats.map(name).join(' and ')} from your GY (${kind} Materials)?`))) return;
  const grp2 = g.group; for (const m of mats) ss(g, p, m, 'atk', { group: grp2 });
}
// Dice rolled by this batch's cards honor Dice Re-Roll (g.reroll[p] = {turn, used}).
// PARTIAL: dice rolled by cards in other files don't check it.
function* roll(g, p) {
  let n = dice(g, p);
  for (const q of [p, opp(p)]) {
    const r = g.reroll && g.reroll[q];
    if (r && r.turn === g.turnNo && !r.used && (yield* yn(g, q, `${PN(g, p)} rolled a ${n}. Use Dice Re-Roll to roll again?`))) { r.used = true; log(g, `${PN(g, q)} used Dice Re-Roll.`); n = dice(g, p); }
  }
  return n;
}
const rollsDice = c => /\broll(s|ed)?\b[^.]*\b(die|dice)\b|\b(die|dice)\b[^.]*\broll/i.test(txt(c));
/* A Trap that responds to something with no response window (copied from classic-5.js): an optional trigger while it is Set. */
const trapTrig = o => ({ type: 'trig', loc: 'any', label: o.label,
  on: (g, ev, c) => { if (!(c.zone === 'st' && c.pos === 'set' && c.turnIn !== g.turnNo && o.on(g, ev, c))) return false; if (!c.flags.tev || c.flags.tev.group !== ev.group) c.flags.tev = ev; return true; },
  cond: (g, c, p, x) => c.zone === 'st' && c.pos === 'set' && (!o.cond || o.cond(g, c, p, x)),
  cost: function* (g, c, p, L2) { L2.ev = L2.ev || c.flags.tev; c.pos = 'up'; g.seq++; L2.cardAct = true; L2.speed = 2; L2.tags = o.tags || {}; if (o.cost) yield* o.cost(g, c, p, L2); },
  target: o.target,
  res: function* (g, c, p, L2) { if (onField(c)) yield* o.res(g, c, p, L2); if (onField(c) && c.zone === 'st') move(g, c, 'gy', { reason: 'rule' }); } });
/* Dark Scorpions: "When this card inflicts Battle Damage to your opponent, you can activate 1 of these effects". */
const scorpion = (label, modes) => ({ effs: [{ type: 'trig', when: true, label,
  on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
  cond: (g, c, p) => modes.some(m => m.ok(g, c, p)),
  target: function* (g, c, p, L2) {
    const ms = modes.filter(m => m.ok(g, c, p)); const i = ms.length > 1 ? yield* choose(g, p, `${D(c).n}: which effect?`, ms.map(m => m.label)) : 0;
    L2.data.m = modes.indexOf(ms[i]); if (ms[i].target) yield* ms[i].target(g, c, p, L2); },
  res: function* (g, c, p, L2) { yield* modes[L2.data.m].res(g, c, p, L2); } }] });
// Does this chain link destroy a monster on the field? (Destruction Jammer)
// PARTIAL: read from the link's targets and its card text, so an effect that "may" destroy a monster can be caught too.
const destroysMonster = (g, L2) => !!(L2 && L2.tags && L2.tags.destroy && !L2.negated && (L2.cardAct || !isST(L2.c)) &&
  ((L2.t || []).some(t => t && t.zone === 'm') || (!(L2.t || []).length && /destroy[^.]*\b(monsters?|cards? on the field|all cards)\b|monsters?[^.]*\bdestroyed\b/i.test(txt(L2.c)))));
// Dimension Fortress Weapon: does activating this effect send cards from the Deck to the GY?
const millsDeck = c => /\b(from|of) (your|their|the|each player's|either player's|his|its owner's) (own )?Deck to the (GY|Graveyard)\b|\btop \S+ cards? of (your|their|the) Deck\b[^.]*\bto the (GY|Graveyard)\b/i.test(txt(c));

E.addScripts({
  /* ----- Dark Master - Zorc (port of goat-6.js) ----- */
  // "Once per turn: roll a die: 1-2 destroy all monsters your opponent controls, 3-5 destroy 1 of them, 6 destroy all monsters you control" (Zorc too).
  'Dark Master - Zorc': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Roll a die',
    res: function* (g, c, p) {
      if (!onField(c)) return; const r = yield* roll(g, p);
      if (r <= 2) destroy(g, monsOf(g, opp(p)), { by: p });
      else if (r <= 5) { const ms = monsOf(g, opp(p)); if (ms.length) { const [t] = yield* pick(g, p, 'Destroy which of their monsters?', ms, 1, 1, 'bad'); if (t) destroy(g, [t], { by: p }); } }
      else destroy(g, monsOf(g, p), { by: p });
    } }] },

  /* ----- Dark Scorpions ----- */
  'Dark Scorpion - Chick the Yellow': { ...scorpion('Bounce a card or check their top card', [
    { label: 'Return 1 card on the field to the hand', ok: g => allField(g).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which card to the hand?', allField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) { move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${D(t).n} returned to the hand.`); } } },
    { label: 'Look at the top card of their Deck', ok: (g, c, p) => g.p[opp(p)].deck.length > 0,
      res: function* (g, c, p) { const d = g.p[opp(p)].deck; if (!d.length) return; const x = d[d.length - 1];
        const i = yield* choose(g, p, `The top card of their Deck is ${D(x).n}. Put it where?`, ['Leave it on top', 'Put it on the bottom']);
        if (i) { d.pop(); d.unshift(x); g.seq++; log(g, `${PN(g, p)} put the top card of ${PN(g, opp(p))}'s Deck on the bottom.`); } else log(g, `${PN(g, p)} looked at the top card of ${PN(g, opp(p))}'s Deck and left it there.`); } }]) },
  'Dark Scorpion - Cliff the Trap Remover': { ...scorpion('Destroy a Spell/Trap or mill 2', [
    { label: 'Destroy 1 Spell/Trap on the field', ok: g => stOnField(g).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOnField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } },
    { label: 'Send the top 2 cards of their Deck to the GY', ok: () => true, res: function* (g, c, p) { mill(g, opp(p), 2); } }]) },
  'Dark Scorpion - Gorg the Strong': { ...scorpion('Spin a monster or mill 1', [
    { label: 'Return 1 of their monsters to the top of the Deck', ok: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which monster to the top of the Deck?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t) { move(g, t, 'deckTop', { reason: 'effect', by: p }); log(g, `${D(t).n} was put on top of the Deck.`); } } },
    { label: 'Send the top card of their Deck to the GY', ok: () => true, res: function* (g, c, p) { mill(g, opp(p), 1); } }]) },
  'Dark Scorpion - Meanae the Thorn': { ...scorpion('Add a Dark Scorpion card', [
    { label: 'Add 1 Dark Scorpion card from your Deck', ok: (g, c, p) => g.p[p].deck.some(scorp),
      res: function* (g, c, p) { yield* search(g, p, scorp, 'Add which Dark Scorpion card?'); } },
    { label: 'Add 1 Dark Scorpion card from your GY', ok: (g, c, p) => g.p[p].gy.some(scorp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Dark Scorpion card from your GY?', g.p[p].gy.filter(scorp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} from the GY to the hand.`); } } }]) },

  /* ----- Darkness ----- */
  // PARTIAL: the engine has no face-down Attack Position, so the monster is always Set in face-down Defense Position.
  'Darkness Approaches': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.filter(x => x !== c).length >= 2 && fieldMons(g).some(faceUp),
    cost: function* (g, c, p) { yield* discard(g, p, 2, 'Discard 2 cards', c); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Set which face-up monster?', fieldMons(g).filter(faceUp), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) setFaceDown(g, t); } }] },
  // "Cannot be Special Summoned" (PARTIAL: only from the GY, see noSSFromGY). Attacks twice, piercing.
  'Darkness Destroyer': { cont: noSSFromGY, self: { maxAttacks: () => 2, piercing: true }, effs: [] },
  // PARTIAL: its summon rule runs as an optional trigger from the hand when the opponent's monster declares an attack
  // (it uses a chain link); the engine replays the attack after it arrives.
  'Darkness Neosphere': { cont: noSSFromGY, self: { noBattleDestroy: true },
    effs: [{ type: 'trig', loc: 'hand', tags: { ss: 1 }, label: 'Special Summon (send 2 Fiends to the GY)',
      on: (g, ev, c) => ev.type === 'attack' && ev.p !== c.owner,
      cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && race(x) === 'Fiend') && g.p[p].hand.some(x => x !== c && isMon(x) && race(x) === 'Fiend'),
      cost: function* (g, c, p) {
        const [a] = yield* pick(g, p, 'Send a Fiend you control to the GY', monsOf(g, p).filter(x => faceUp(x) && race(x) === 'Fiend'), 1, 1, 'cost');
        const [b] = yield* pick(g, p, 'Send a Fiend from your hand to the GY', g.p[p].hand.filter(x => x !== c && isMon(x) && race(x) === 'Fiend'), 1, 1, 'cost');
        const grp = g.group; for (const x of [a, b]) if (x) move(g, x, 'gy', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} sent ${[a, b].filter(Boolean).map(x => D(x).n).join(' and ')} to the GY.`); },
      res: function* (g, c, p) { if (c.zone === 'hand') ss(g, p, c, 'atk'); } },
      { type: 'ign', opt: true, label: 'Return your face-up Traps to the hand', cond: (g, c, p) => stOf(g, p).some(x => faceUp(x) && isTrap(x)),
        res: function* (g, c, p) { const ts = stOf(g, p).filter(x => faceUp(x) && isTrap(x)); for (const t of ts) move(g, t, 'hand', { reason: 'effect' }); if (ts.length) log(g, `${PN(g, p)} returned ${ts.map(x => D(x).n).join(', ')} to the hand.`); } }] },

  /* ----- De- cards ----- */
  // Port of classic-4.js: the Fusion Materials are found from the summon (matHook) or Polymerization's note.
  'De-Fusion': { effs: [{ type: 'act', cond: g => fieldMons(g).some(m => faceUp(m) && D(m).k === 'fusion'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which Fusion Monster to the Extra Deck?', fieldMons(g).filter(m => faceUp(m) && D(m).k === 'fusion'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) yield* returnAndRevive(g, p, t, 'Fusion'); } }, matHook] },
  // Port of classic-4.js.
  'De-Spell': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c) => stOnField(g).some(x => x !== c && (x.pos === 'set' || isSpell(x))),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which Spell or Set card?', stOnField(g).filter(x => x !== c && (x.pos === 'set' || isSpell(x))), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; if (t.pos === 'set') log(g, `The Set card was ${D(t).n}.`); if (isSpell(t)) destroy(g, [t], { by: p, src: c }); } }] },
  'De-Synchro': { effs: [{ type: 'act', cond: g => fieldMons(g).some(m => faceUp(m) && D(m).k === 'synchro'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which Synchro Monster to the Extra Deck?', fieldMons(g).filter(m => faceUp(m) && D(m).k === 'synchro'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) yield* returnAndRevive(g, p, t, 'Synchro'); } }, matHook] },

  /* ----- Deepsea ----- */
  'Deepsea Macrotrema': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'WATER monsters gain 500 ATK',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to === 'gy',
    res: function* (g, c, p) { const ws = monsOf(g, p).filter(x => faceUp(x) && attr(x) === 'WATER'); for (const x of ws) addMod(g, x, { atk: 500, end: true }); if (ws.length) log(g, `${PN(g, p)}'s WATER monsters gained 500 ATK.`); } }] },
  // The card data's tx spells the second material "TonGYo", so the recipe can't be read and is given here.
  'Deepsea Shark': { mats: [x => D(x).n === 'Bottom Dweller', x => D(x).n === 'Tongyo'], effs: [] },
  // PARTIAL: "unaffected by Spells" covers destruction by Spells only (the engine's unaffectedSpells flag).
  'Deepsea Warrior': { self: { unaffectedSpells: g => umiOn(g) }, effs: [] },

  /* ----- Des cards ----- */
  'Des Counterblow': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy the direct attacker',
      on: (g, ev) => ev.type === 'damage' && ev.battle && ev.direct && ev.src && ev.src.zone === 'm',
      res: function* (g, c, p, L2) { const a = L2.ev.src; if (a && onField(a)) destroy(g, [a], { by: p, src: c }); } }] },
  'Des Croaking': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => monsOf(g, p).filter(x => faceUp(x) && name(x) === 'Des Frog').length >= 3 && fieldOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { destroy(g, fieldOf(g, opp(p)), { by: p, src: c }); } }] },
  // Union: once per turn, equip to your Vampiric Orchis or unequip and Special Summon in Attack Position.
  'Des Dendle': {
    cont: { replaceDestroy: (g, src, m, o) => { if (!src.flags.union || src.equipTo !== m.u || !o.battle || src.zone !== 'st') return false; destroy(g, [src], { quietLog: false }); log(g, `${name(m)} survived: Des Dendle was destroyed instead.`); return true; } },
    effs: [
      { type: 'ign', label: 'Equip to Vampiric Orchis',
        cond: (g, c, p) => c.used.union !== g.turnNo && freeST(g, p) >= 0 && monsOf(g, p).some(x => x !== c && faceUp(x) && name(x) === 'Vampiric Orchis' && !stOf(g, p).some(s => s.equipTo === x.u && s.flags.union)),
        after: (g, c) => { c.used.union = g.turnNo; },
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Des Dendle to which Vampiric Orchis?', monsOf(g, p).filter(x => x !== c && faceUp(x) && name(x) === 'Vampiric Orchis' && !stOf(g, p).some(s => s.equipTo === x.u && s.flags.union)), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c) || c.zone !== 'm' || freeST(g, p) < 0) return; move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip' }); c.equipTo = t.u; c.flags.union = true; log(g, `Des Dendle was equipped to ${name(t)}.`); } },
      { type: 'ign', loc: 'st', tags: { ss: 1 }, label: 'Unequip and Special Summon', cond: (g, c, p) => c.used.union !== g.turnNo && !!c.equipTo && !!c.flags.union && freeM(g, p) >= 0,
        after: (g, c) => { c.used.union = g.turnNo; },
        res: function* (g, c, p) { if (c.zone !== 'st' || !c.equipTo) return; c.equipTo = null; ss(g, p, c, 'atk'); } },
      { type: 'trig', loc: 'st', mand: true, tags: { ss: 1 }, label: 'Special Summon a Wicked Plant Token',
        on: (g, ev, c) => c.flags.union && ev.type === 'move' && ev.battle && ev.destroyed && ev.killer && ev.killer.u === c.equipTo && ev.prevCtrl !== c.ctrl,
        res: function* (g, c, p) { L.tokens(g, p, { n: 'Wicked Plant Token', a: 'EARTH', r: 'Plant', lv: 1, atk: 800, def: 800 }, 1, 'atk'); } }] },
  'Des Feral Imp': { effs: [{ type: 'trig', mand: true, label: 'Shuffle a card from your GY into the Deck', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    target: function* (g, c, p, L2) { if (g.p[p].gy.length) yield* tgt(g, p, L2, 'Shuffle which card from your GY into the Deck?', g.p[p].gy, 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'deck', { reason: 'effect' }); log(g, `${D(t).n} was shuffled into the Deck.`); } } }] },
  'Des Frog': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon Des Frogs',
    on: (g, ev, c) => evSummoned(ev, c, ['tribute']),
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].gy.some(x => named(x, 'T.A.D.P.O.L.E.')) && [...g.p[p].hand, ...g.p[p].deck].some(x => named(x, 'Des Frog')),
    res: function* (g, c, p) {
      const n = Math.min(g.p[p].gy.filter(x => named(x, 'T.A.D.P.O.L.E.')).length, nFreeM(g, p)); // counted at resolution
      const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Des Frog'));
      if (n && cs.length) { const xs = yield* pick(g, p, `Special Summon up to ${n} Des Frog`, cs, 1, n, 'good'); const grp = g.group; for (const x of xs) ss(g, p, x, 'atk', { group: grp }); }
      shuffleDeck(g, p); } }] },
  'Des Kangaroo': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the attacker',
    on: (g, ev, c) => ev.type === 'afterCalc' && ev.t === c && ev.tWasDef && ev.a && onField(ev.a) && atk(g, ev.a) < def(g, c),
    res: function* (g, c, p, L2) { const a = L2.ev.a; if (a && onField(a)) destroy(g, [a], { by: p }); } }] },
  // Port of goat-2.js.
  'Des Koala': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: '400 damage per card in their hand', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { damage(g, opp(p), 400 * g.p[opp(p)].hand.length, { src: c, srcP: p }); } }] },
  'Des Mosquito': {
    self: { atk: (g, c) => 500 * ctr(c, 'mosquito'),
      replaceDestroy: (g, c, o) => { if (!o.battle || ctr(c, 'mosquito') < 1) return false; addCtr(g, c, 'mosquito', -1); g.seq++; log(g, `Des Mosquito removed a counter instead of being destroyed.`); return true; } },
    effs: [{ type: 'trig', mand: true, label: 'Place 2 counters', on: (g, ev, c) => evSummoned(ev, c) && !['flip', 'gemini'].includes(ev.how),
      res: function* (g, c) { if (onField(c)) { addCtr(g, c, 'mosquito', 2); g.seq++; log(g, 'Des Mosquito got 2 counters.'); } } }] },
  // PARTIAL: "each time a Normal or Quick-Play Spell resolves" is read as one leaving the Spell/Trap Zone for the GY after
  // its chain link, so a negated one counts too.
  'Des Volstgalph': { effs: [
    { type: 'trig', mand: true, label: '500 damage', on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
      res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } },
    { type: 'trig', mand: true, label: '+200 ATK',
      on: (g, ev) => ev.type === 'move' && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && isSpell(ev.c) && ['Normal', 'Quick-Play'].includes(D(ev.c).sub),
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 200, end: true }); log(g, 'Des Volstgalph gained 200 ATK.'); } } }] },
  // Port of goat-7.js: effect damage to its controller becomes 0.
  'Des Wombat': { cont: { dmg: (g, src, p, n, o) => p === src.ctrl && !(o && o.battle) ? 0 : n }, effs: [] },

  /* ----- Desert ----- */
  // PARTIAL: it always saves the Insect (no yes/no), one Insect per Desert Protector, even if it is destroyed at the same time.
  'Desert Protector': { self: { def: g => 300 * stOnField(g).length },
    cont: { replaceDestroy: (g, src, m, o) => { if (g._dpBusy || o.rule || m === src || m.zone !== 'm' || m.ctrl !== src.ctrl || !faceUp(m) || race(m) !== 'Insect' || !onField(src)) return false;
      g._dpBusy = true; let n; try { n = destroy(g, [src], { by: src.ctrl }).length; } finally { g._dpBusy = false; }
      if (!n) return false; log(g, `${name(m)} survived: Desert Protector was destroyed instead.`); return true; } },
    effs: [] },
  // Port of goat-2.js: face-down monsters are flipped, so their Flip effects activate.
  'Desert Sunlight': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => x.pos !== 'def'),
    res: function* (g, c, p) { for (const x of monsOf(g, p)) { if (x.pos === 'set') flipUp(g, x, 'def'); else if (x.pos === 'atk') { x.pos = 'def'; g.seq++; emit(g, { type: 'pos', c: x, p }); } } log(g, `${PN(g, p)}'s monsters were changed to face-up Defense Position.`); } }] },
  'Desert Twister': { cont: nomiGY,
    proc: { label: 'Special Summon (banish 2 WIND and 1 EARTH)', cond: (g, c, p) => g.p[p].gy.filter(x => isMon(x) && attr(x) === 'WIND').length >= 2 && g.p[p].gy.some(x => isMon(x) && attr(x) === 'EARTH'),
      cost: function* (g, c, p, grp) {
        const w = yield* pick(g, p, 'Banish 2 WIND monsters from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'WIND'), 2, 2, 'cost');
        const [e] = yield* pick(g, p, 'Banish 1 EARTH monster from your GY', g.p[p].gy.filter(x => isMon(x) && attr(x) === 'EARTH'), 1, 1, 'cost');
        for (const x of [...w, e]) if (x) move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${[...w, e].filter(Boolean).map(x => D(x).n).join(', ')}.`); } },
    effs: [markProper, { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Discard 1: destroy a Spell/Trap',
      cond: (g, c, p) => g.p[p].hand.length > 0 && stOnField(g).length > 0,
      cost: function* (g, c, p) { yield* discard(g, p, 1, 'Discard 1 card'); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOnField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },

  /* ----- Destiny ----- */
  // Port of classic-1.js. The Edison rulings say the rest are destroyed when one leaves the field.
  'Destiny Board': { effs: [
    { type: 'act', res: function* (g, c, p) { boardWin(g, p); } },
    { type: 'trig', loc: 'st', mand: true, opt: true, label: 'Place a Spirit Message',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp !== c.ctrl,
      cond: (g, c, p) => freeST(g, p) >= 0 && msgsOn(g, p).length < 4,
      res: function* (g, c, p) {
        if (!onField(c) || !faceUp(c) || freeST(g, p) < 0) return;
        const have = new Set(msgsOn(g, p).map(x => msgKey(D(x).n))); const next = MSGS.find(n => !have.has(n)); if (!next) return;
        const x = g.p[p].hand.find(y => msgKey(D(y).n) === next) || g.p[p].deck.find(y => msgKey(D(y).n) === next);
        if (!x) { log(g, `${PN(g, p)} has no ${next} to place.`); return; }
        const fromDeck = x.zone === 'deck'; move(g, x, 'st', { ctrl: p, pos: 'up', reason: 'effect' }); if (fromDeck) shuffleDeck(g, p);
        log(g, `${PN(g, p)} placed ${next} with Destiny Board.`); boardWin(g, p); } },
    { type: 'trig', loc: 'any', mand: true, label: 'Destroy the Board and Messages',
      on: (g, ev, c) => ev.type === 'move' && ev.wasField && !ev.dboard && isBoardPart(ev.c) && ev.to !== 'st' && (ev.c === c || (onField(c) && ev.prevCtrl === c.ctrl)),
      res: function* (g, c, p) { const who = onField(c) ? c.ctrl : p; const xs = stOf(g, who).filter(isBoardPart); if (!xs.length) return;
        const grp = g.group; for (const x of xs) move(g, x, 'gy', { reason: 'effect', destroyed: true, dboard: true, group: grp }); log(g, `${xs.map(name).join(', ')} ${xs.length > 1 ? 'were' : 'was'} destroyed.`); } }] },
  'Destiny Draw': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 2 && g.p[p].hand.some(isDHero),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard a Destiny HERO', g.p[p].hand.filter(isDHero), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    res: function* (g, c, p) { draw(g, p, 2); } }] },
  'Destiny End Dragoon': { cont: nomiGY,
    effs: [markProper,
      { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy a monster (no Battle Phase)',
        cond: (g, c, p) => monsOf(g, opp(p)).length > 0 && !(g.phase === 'main2' && g.goBattle),
        after: (g, c, p) => { g.noBP[p] = true; },
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t) return; const up = faceUp(t), A = up ? atk(g, t) : 0;
          if (destroy(g, [t], { by: p }).length && up && A > 0) damage(g, opp(p), A, { src: c, srcP: p }); } },
      { type: 'trig', loc: 'gy', opt: true, tags: { ss: 1 }, label: 'Banish a Destiny HERO: Special Summon this card',
        on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner,
        cond: (g, c, p) => c.used.proper && freeM(g, p) >= 0 && g.p[p].gy.some(x => x !== c && isDHero(x)),
        cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish a Destiny HERO from your GY', g.p[p].gy.filter(x => x !== c && isDHero(x)), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${D(x).n}.`); } },
        res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c, 'atk'); } }] },
  'Destiny Mirage': { effs: [
    { type: 'trig', loc: 'any', on: (g, ev) => { if (ev.type === 'move' && ev.destroyed && ev.wasField && ev.to === 'gy' && ev.snap && /^Destiny HERO/.test(ev.snap.name)) ev.c.used.dhDead = g.turnNo; return false; }, res: function* () {} },
    trapTrig({ label: 'Special Summon the destroyed Destiny HEROes', tags: { ss: 1 },
      on: (g, ev, c) => ev.type === 'move' && ev.destroyed && !ev.battle && ev.wasField && ev.to === 'gy' && ev.prevCtrl === c.ctrl && ev.by === opp(c.ctrl) && ev.snap && /^Destiny HERO/.test(ev.snap.name),
      cond: (g, c, p) => freeM(g, p) >= 0,
      res: function* (g, c, p) { const xs = allCards(g, 'gy').filter(x => isDHero(x) && x.used.dhDead === g.turnNo); const n = Math.min(xs.length, nFreeM(g, p));
        const pickd = n < xs.length ? yield* pick(g, p, `Special Summon ${n} Destiny HEROes`, xs, n, n, 'good') : xs; const grp = g.group; for (const x of pickd) ss(g, p, x, 'atk', { group: grp }); } })] },
  'Destiny Signal': { effs: [trapTrig({ label: 'Special Summon a Destiny HERO', tags: { ss: 1 },
    on: (g, ev, c) => ev.type === 'move' && ev.battle && ev.destroyed && ev.wasField && ev.to === 'gy' && ev.prevCtrl === c.ctrl && ev.snap && ev.snap.mon,
    cond: (g, c, p) => freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].deck].some(x => isDHero(x) && lv(x) <= 4),
    res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => isDHero(x) && lv(x) <= 4); const [x] = yield* pick(g, p, 'Special Summon a Level 4 or lower Destiny HERO', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } })] },

  /* ----- Destruction ----- */
  'Destruction Cyclone': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy face-down and non-WIND monsters',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p) { destroy(g, fieldMons(g).filter(x => !faceUp(x) || attr(x) !== 'WIND'), { by: p }); } }] },
  'Destruction Jammer': { effs: [{ type: 'act', cond: (g, c, p, x) => g.p[p].hand.length > 0 && destroysMonster(g, x.top),
    cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; yield* discard(g, p, 1, 'Discard 1 card'); },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  'Destruction of Destiny': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 3,
    res: function* (g, c, p) { const out = mill(g, p, 3); const n = out.filter(isST).length; if (n) damage(g, p, 1000 * n, { src: c, srcP: p }); } }] },
  // The attacker is marked; this card in the GY checks it after damage calculation and destroys it at the end of the Damage Step.
  'Destruction Punch': { effs: [
    { type: 'act', ds: true, tags: { destroy: 1 },
      cond: (g, c, p) => { const b = g.aw || (g.inDS && g.battle); return !!(b && b.a && b.a.ctrl !== p && b.t && b.t.ctrl === p && b.t.pos !== 'atk'); },
      target: function* (g, c, p, L2) { const b = g.aw || g.battle; L2.data.a = b.a; },
      res: function* (g, c, p, L2) { const a = L2.data.a; if (a && onField(a)) { a.flags.dpunch = { u: c.u, turn: g.turnNo }; log(g, `${name(a)} will be destroyed if its ATK is lower than the DEF it attacks.`); } } },
    { type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy the attacker',
      on: (g, ev, c) => {
        const mk = ev.a && ev.a.flags && ev.a.flags.dpunch; if (!mk || mk.u !== c.u || mk.turn !== g.turnNo) return false;
        if (ev.type === 'afterCalc') { if (ev.t && ev.tWasDef && atk(g, ev.a) < def(g, ev.t)) mk.doom = true; return false; }
        return ev.type === 'dsEnd' && mk.doom && onField(ev.a); },
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (a && onField(a)) destroy(g, [a], { by: p, src: c }); } }] },
  'Destruction Ring': { effs: [{ type: 'act', tags: { destroy: 1 }, cond: (g, c, p) => monsOf(g, p).some(faceUp),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which of your face-up monsters?', monsOf(g, p).filter(faceUp), 1, 1, 'cost'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; if (!destroy(g, [t], { by: p, src: c }).length) return;
      damage(g, opp(p), 1000, { src: c, srcP: p }); damage(g, p, 1000, { src: c, srcP: p }); } }] },

  /* ----- Dice ----- */
  'Dice Jar': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Both players roll a die', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) {
      let a = 0, b = 0; for (let i = 0; i < 10 && a === b; i++) { a = yield* roll(g, p); b = yield* roll(g, opp(p)); }
      if (a === b) return; const loser = a < b ? p : opp(p), win = Math.max(a, b);
      damage(g, loser, win === 6 ? 6000 : win * 500, { src: c, srcP: p }); } }] },
  'Dice Re-Roll': { effs: [{ type: 'act', cond: (g, c, p) => !(g.reroll && g.reroll[p] && g.reroll[p].turn === g.turnNo),
    res: function* (g, c, p) { g.reroll = g.reroll || {}; g.reroll[p] = { turn: g.turnNo, used: false }; log(g, `${PN(g, p)} can have one die roll made again this turn.`); } }] },
  'Dice Try!': { effs: [{ type: 'act',
    cond: (g, c, p, x) => !!(x.top && x.top.p !== p && !x.top.negated && (x.top.cardAct || isMon(x.top.c)) && rollsDice(x.top.c)),
    target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },

  /* ----- Different Dimension ----- */
  // Stays on the field; during your 2nd Standby Phase after activation it is destroyed and the banished card is added to your hand.
  'Different Dimension Capsule': { effs: [
    { type: 'act', cond: (g, c, p) => g.p[p].deck.length > 0,
      res: function* (g, c, p, L2) { const [x] = yield* pick(g, p, 'Banish which card from your Deck face-down?', g.p[p].deck, 1, 1, 'good');
        if (x) { move(g, x, 'ban', { reason: 'effect' }); x.flags.faceDownBan = true; c.flags.ddc = { u: x.u, n: 0 }; L2.keep = true; log(g, `${PN(g, p)} banished a card from the Deck face-down.`); } shuffleDeck(g, p); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Add the banished card',
      on: (g, ev, c) => { if (!(ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.flags.ddc)) return false; c.flags.ddc.n++; return c.flags.ddc.n >= 2; },
      res: function* (g, c, p) { if (!onField(c) || !c.flags.ddc) return; const u = c.flags.ddc.u; destroy(g, [c], { by: p });
        const x = g.p[p].ban.find(y => y.u === u); if (x) { delete x.flags.faceDownBan; move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(x)} to the hand.`); } } }] },
  // PARTIAL: the "doesn't target it" check needs the destroying card passed as the source (o.src); it is read from that
  // card's text (no "target"/"select"). A Spell/Trap that doesn't pass its source still destroys it.
  'Different Dimension Dragon': { self: {
      noBattleDestroy: (g, c) => { const b = g.battle; if (!b) return false; const o = b.a === c ? b.t : b.a; return !!(o && atk(g, o) <= 1900); },
      replaceDestroy: (g, c, o) => { if (o.battle || o.rule || !o.src || !isST(o.src) || /\b(target|select)/i.test(txt(o.src))) return false; log(g, `Different Dimension Dragon was not destroyed.`); return true; } },
    effs: [] },
  'Different Dimension Gate': { effs: [
    { type: 'act', cond: (g, c, p) => monsOf(g, p).length > 0 && monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { const [a] = yield* tgt(g, p, L2, 'Banish which of your monsters?', monsOf(g, p), 1, 1, 'cost'); const [b] = yield* tgt(g, p, L2, 'Banish which of their monsters?', monsOf(g, opp(p)), 1, 1, 'bad'); L2.t = [a, b].filter(Boolean); },
      res: function* (g, c, p, L2) { const rec = [];
        for (const t of live(L2)) { if (t.zone !== 'm') continue; const r = { u: t.u, pos: t.pos, side: t.ctrl }; move(g, t, 'ban', { reason: 'effect', by: p }); if (t.zone === 'ban') { if (r.pos === 'set') t.flags.faceDownBan = true; rec.push(r); } log(g, `${D(t).n} was banished.`); }
        if (onField(c)) c.flags.ddg = rec; } },
    { type: 'trig', loc: 'gy', mand: true, label: 'Return the banished monsters',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy' && ev.snap && ev.snap.flags && ev.snap.flags.ddg && ev.snap.flags.ddg.length,
      res: function* (g, c, p, L2) { const grp = g.group;
        for (const r of L2.ev.snap.flags.ddg) { const x = allCards(g, 'ban').find(y => y.u === r.u); if (!x) continue; delete x.flags.faceDownBan;
          if (freeM(g, r.side) < 0) { move(g, x, 'gy', { reason: 'rule' }); log(g, `${D(x).n} had no zone and went to the GY.`); continue; }
          move(g, x, 'm', { ctrl: r.side, pos: r.pos === 'set' ? 'set' : r.pos, reason: 'summon', group: grp }); log(g, `${r.pos === 'set' ? 'A face-down monster' : D(x).n} returned to the field.`); } } }] },
  'Dimension Distortion': { effs: [markProper, { type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => g.p[p].gy.length === 0 && freeM(g, p) >= 0 && allCards(g, 'ban').some(dimOk),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which banished monster?', allCards(g, 'ban').filter(dimOk), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'ban') ss(g, p, t, 'atk'); } }] },
  'Dimension Explosion': { effs: [markProper, { type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && D(x).k === 'fusion') && g.p[p].ban.some(dimOk) && g.p[opp(p)].ban.some(dimOk) && freeM(g, opp(p)) >= 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Return a face-up Fusion Monster to the Extra Deck', monsOf(g, p).filter(x => faceUp(x) && D(x).k === 'fusion'), 1, 1, 'cost'); if (x) { move(g, x, 'extra', { reason: 'cost' }); log(g, `${PN(g, p)} returned ${D(x).n} to the Extra Deck.`); } },
    target: function* (g, c, p, L2) { const a = yield* pick(g, p, 'Choose up to 2 of your banished monsters', g.p[p].ban.filter(dimOk), 1, 2, 'good'); const b = yield* pick(g, opp(p), 'Choose up to 2 of your banished monsters', g.p[opp(p)].ban.filter(dimOk), 1, 2, 'good'); L2.t = [...a, ...b]; },
    res: function* (g, c, p, L2) { const grp = g.group; for (const t of L2.t) if (t.zone === 'ban' && freeM(g, t.owner) >= 0) ss(g, t.owner, t, 'atk', { group: grp }); } }] },
  // ENGINE: the engine's mill() and search(..., 'gy') can't be stopped, so mandatory effects still send cards from the Deck.
  // It stops the activation of effects that would send cards from the Deck to the GY (optional ones and costs, read from the text).
  'Dimension Fortress Weapon': { cont: { forbid: (g, src, a) => a.type === 'activate' && a.c && a.eff && !a.eff.mand && !/FLIP:/.test(D(a.c).tx || '') && millsDeck(a.c) }, effs: [] },
  // Port of goat-2.js, with the Edison rulings: only face-up banished monsters, Special Summon-only ones only if properly summoned.
  'Dimension Fusion': { effs: [markProper, { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.p[p].lp > 2000 && allCards(g, 'ban').some(dimOk) && (freeM(g, p) >= 0 || freeM(g, opp(p)) >= 0),
    cost: function* (g, c, p) { L.pay(g, p, 2000); },
    res: function* (g, c, p) { for (const q of [p, opp(p)]) { const ms = g.p[q].ban.filter(x => dimOk(x) && !forbid(g, { type: 'ss', c: x, p: q, how: 'special' })); const n = Math.min(ms.length, nFreeM(g, q)); if (!n) continue;
      const xs = n < ms.length ? yield* pick(g, q, `Special Summon ${n} of your banished monsters`, ms, n, n, 'good') : ms; const grp = g.group; for (const x of xs) ss(g, q, x, 'atk', { group: grp }); } } }] },
  // Edison ruling: up to 3 cards (not only monsters) from the opponent's GY.
  'Dimension Jar': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Both players banish up to 3 cards', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { for (const q of [p, opp(p)]) { const gy = g.p[opp(q)].gy; if (!gy.length) continue; const xs = yield* pick(g, q, 'Banish up to 3 cards from your opponent’s GY', gy, 0, 3, 'bad');
      for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: q }); if (xs.length) log(g, `${PN(g, q)} banished ${xs.map(x => D(x).n).join(', ')}.`); } } }] },
  // The battle is marked; this card in the GY sends that battle's damage to the attacker's controller.
  'Dimension Wall': { cont: { loc: 'gy', dmg: (g, src, p, n, o) => {
      const w = g.dimWall; if (!(n > 0 && o && o.battle && w && w.p === p && w.turn === g.turnNo && g.battle && g.battle.a && g.battle.a.u === w.a && src.u === w.c)) return n;
      damage(g, opp(p), n, { battle: true, src: o.src, srcP: p, direct: o.direct }); return 0; } },
    effs: [{ type: 'act', cond: (g, c, p) => !!(g.aw && g.aw.a && g.aw.a.ctrl !== p),
      target: function* (g, c, p, L2) { L2.data.a = g.aw.a; },
      res: function* (g, c, p, L2) { const a = L2.data.a; if (a && onField(a)) { g.dimWall = { p, a: a.u, c: c.u, turn: g.turnNo }; log(g, `${PN(g, opp(p))} will take the battle damage from this attack.`); } } }] },

  /* ----- Divine ----- */
  'Divine Dragon Aquabizarre': { effs: [{ type: 'ign', opt: true, label: 'Tribute a WATER: return a Spell to the Deck',
    cond: (g, c, p) => monsOf(g, p).some(x => x !== c && faceUp(x) && attr(x) === 'WATER') && g.p[p].gy.some(x => isSpell(x) && ['Continuous', 'Field'].includes(D(x).sub)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 other face-up WATER monster', monsOf(g, p).filter(x => x !== c && faceUp(x) && attr(x) === 'WATER'), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${D(x).n}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which Continuous or Field Spell to the top of your Deck?', g.p[p].gy.filter(x => isSpell(x) && ['Continuous', 'Field'].includes(D(x).sub)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'deckTop', { reason: 'effect' }); log(g, `${D(t).n} was put on top of the Deck.`); } } }] },
  'Divine Knight Ishzark': { effs: [{ type: 'trig', mand: true, label: 'Banish the destroyed monster',
    on: (g, ev, c) => ev.type === 'afterCalc' && ev.t && ((ev.a === c && ev.t.flags.battleDoomed) || (ev.t === c && ev.a.flags.battleDoomed)),
    res: function* (g, c, p, L2) { const v = L2.ev.a === c ? L2.ev.t : L2.ev.a; if (v && onField(v)) { move(g, v, 'ban', { reason: 'effect', by: p }); log(g, `${D(v).n} was banished.`); } } }] },
  'Divine Wrath': { effs: [{ type: 'act',
    cond: (g, c, p, x) => !!(x.top && !x.top.negated && !x.top.cardAct && isMon(x.top.c) && x.top.c.zone !== 'st' && g.p[p].hand.length > 0),
    cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; yield* discard(g, p, 1, 'Discard 1 card'); },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },

  /* ----- DNA ----- */
  'DNA Checkup': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => x.pos === 'set') && g.p[0].deck.length >= 2 && g.p[1].deck.length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Select which of your face-down monsters?', monsOf(g, p).filter(x => x.pos === 'set'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.pos !== 'set') return;
      const a = yield* choose(g, opp(p), 'Declare an Attribute', ATTRS); const rest = ATTRS.filter((_, i) => i !== a); const b = yield* choose(g, opp(p), 'Declare a second Attribute', rest);
      const dec = [ATTRS[a], rest[b]]; log(g, `${PN(g, opp(p))} declared ${dec.join(' and ')}. The monster was ${D(t).n} (${attr(t)}).`);
      if (dec.includes(attr(t))) draw(g, opp(p), 2); else draw(g, p, 2); } }] },
  // ENGINE: no Type change hook in race(), so the declared Type is only noted.
  'DNA Surgery': { effs: [{ type: 'act', res: function* (g, c, p) { const i = yield* choose(g, p, 'Declare a Type', TYPES); c.flags.dna = TYPES[i]; log(g, `${PN(g, p)} declared ${TYPES[i]}: all face-up monsters become that Type.`); } }] },
  // ENGINE: no Attribute change hook in attr(), so the declared Attribute is only noted.
  'DNA Transplant': { effs: [{ type: 'act', res: function* (g, c, p) { const i = yield* choose(g, p, 'Declare an Attribute', ATTRS); c.flags.dna = ATTRS[i]; log(g, `${PN(g, p)} declared ${ATTRS[i]}: all face-up monsters become that Attribute.`); } }] },

  /* ----- Double ----- */
  'Double Attack': { effs: [{ type: 'act',
    cond: (g, c, p) => { const ms = monsOf(g, p).filter(faceUp); return ms.length > 0 && g.p[p].hand.some(x => x !== c && isMon(x) && ms.some(m => lv(m) < lv(x))); },
    cost: function* (g, c, p, L2) { const ms = monsOf(g, p).filter(faceUp); const [x] = yield* pick(g, p, 'Discard a monster', g.p[p].hand.filter(x => x !== c && isMon(x) && ms.some(m => lv(m) < lv(x))), 1, 1, 'cost'); L2.data.lv = lv(x); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which monster can attack twice?', monsOf(g, p).filter(m => faceUp(m) && lv(m) < L2.data.lv), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t)) { t.flags.extraAttack = g.turnNo; log(g, `${name(t)} can attack twice this turn.`); } } }] },
  // PARTIAL: the copied Spell's own targets and costs are chosen when Double Spell resolves.
  'Double Spell': { effs: [{ type: 'act',
    cond: (g, c, p) => g.p[p].hand.some(x => x !== c && isSpell(x)) && g.p[opp(p)].gy.some(x => dsOk(g, c, p, x)),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard a Spell Card', g.p[p].hand.filter(x => x !== c && isSpell(x)), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Use which Spell from their GY?', g.p[opp(p)].gy.filter(x => dsOk(g, c, p, x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (!t || t.zone !== 'gy') return;      const effs = (scriptOf(t) || {}).effs || []; const ei = effs.findIndex(e => e.type === 'act'); if (ei < 0) return; const eff = effs[ei];
      const sub = D(t).sub, stays = ['Continuous', 'Equip', 'Field'].includes(sub) || named(t, 'Swords of Revealing Light');
      if (stays) { if (sub === 'Field') { if (g.p[p].fz) move(g, g.p[p].fz, 'gy', { reason: 'rule' }); move(g, t, 'fz', { ctrl: p, pos: 'up', reason: 'effect' }); } else { if (freeST(g, p) < 0) return; move(g, t, 'st', { ctrl: p, pos: 'up', reason: 'effect' }); } }
      log(g, `${PN(g, p)} used ${name(t)} with Double Spell.`);
      const L3 = { c: t, eff, ei, p, speed: 1, t: [], data: {}, negated: false, cardAct: false, tags: eff.tags || {}, link: L2.link };
      if (eff.cost) yield* eff.cost(g, t, p, L3); if (eff.target) yield* eff.target(g, t, p, L3); yield* eff.res(g, t, p, L3);
      if (sub === 'Equip' && onField(t) && !t.equipTo) move(g, t, 'gy', { reason: 'rule' }); } }] },
  // One extra Normal Summon or Set this turn (only one per turn from this card): g.ns is lowered once.
  'Double Summon': { effs: [{ type: 'act', cond: (g, c, p) => !(g.dblSum && g.dblSum[p] === g.turnNo),
    res: function* (g, c, p) { g.dblSum = g.dblSum || {}; g.dblSumDone = g.dblSumDone || {}; g.dblSum[p] = g.turnNo;
      if (g.ns[p] >= 1) { g.ns[p]--; g.dblSumDone[p] = g.turnNo; } log(g, `${PN(g, p)} can Normal Summon or Set twice this turn.`); } },
    { type: 'trig', loc: 'any', res: function* () {}, on: (g, ev) => {
      const q = ev.p; if (q == null || !g.dblSum || g.dblSum[q] !== g.turnNo || g.dblSumDone[q] === g.turnNo) return false;
      if ((ev.type === 'summon' && ['normal', 'tribute', 'gemini'].includes(ev.how)) || (ev.type === 'set' && ev.c && ev.c.zone === 'm')) { if (g.ns[q] >= 1) { g.ns[q]--; g.dblSumDone[q] = g.turnNo; } }
      return false; } }] },
  'Double Tag Team': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => !!(g.sw && g.sw.p === p && !['normal', 'tribute', 'flip', 'gemini'].includes(g.sw.how) && g.sw.cs.some(x => onField(x) && isGB(x))) && freeM(g, p) >= 0 && [...g.p[p].hand, ...g.p[p].deck].some(x => isGB(x) && lv(x) <= 4),
    res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => isGB(x) && lv(x) <= 4); const [x] = yield* pick(g, p, 'Special Summon a Level 4 or lower Gladiator Beast', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  // PARTIAL: it is not destroyed when control of the monster changes; with two equipped monsters the engine lets the
  // opponent attack directly instead of not at all.
  'Double Tool C&D': {
    cont: {
      atk: (g, src, m) => src.equipTo === m.u && g.tp === src.ctrl ? 1000 : 0,
      grant: (g, src, m, flag) => flag === 'noAttackTarget' && !!src.equipTo && g.tp !== src.ctrl && m.zone === 'm' && m.ctrl === src.ctrl && m.u !== src.equipTo && fieldMons(g).some(x => x.u === src.equipTo),
      negates: (g, src, m) => g.tp === src.ctrl && g.phase === 'battle' && !!src.equipTo && m.flags.cdNeg === src.u + ':' + g.turnNo },
    effs: [
      { type: 'act', cond: (g, c, p) => monsOf(g, p).some(cdOk),
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Double Tool C&D to which monster?', monsOf(g, p).filter(cdOk), 1, 1, 'good'); },
        res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.ctrl === p && cdOk(t)) equip(g, c, t); } },
      { type: 'trig', loc: 'st', res: function* () {}, on: (g, ev, c) => { if (ev.type === 'attack' && ev.t && c.equipTo && ev.a.u === c.equipTo && g.tp === c.ctrl) { ev.t.flags.cdNeg = c.u + ':' + g.turnNo; g.seq++; } return false; } },
      { type: 'trig', loc: 'st', mand: true, tags: { destroy: 1 }, label: 'Destroy the monster it battled',
        on: (g, ev, c) => ev.type === 'dsEnd' && g.tp !== c.ctrl && !!c.equipTo && ev.t && ev.t.u === c.equipTo && ev.a && onField(ev.a) && ev.a.ctrl !== c.ctrl,
        res: function* (g, c, p, L2) { const a = L2.ev.a; if (a && onField(a)) destroy(g, [a], { by: p, src: c }); } }] },
  // PARTIAL: the End Phase destruction uses a chain link (it should not start a chain).
  'Double-Edged Sword Technique': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.p[p].gy.filter(sixSam).length >= 2 && nFreeM(g, p) >= 2,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which 2 Six Samurai monsters?', g.p[p].gy.filter(sixSam), 2, 2, 'good'); },
      res: function* (g, c, p, L2) { const grp = g.group; for (const t of L2.t) if (t.zone === 'gy' && ss(g, p, t, 'atk', { group: grp })) t.flags.dest = c.u; } },
    { type: 'trig', loc: 'gy', mand: true, tags: { destroy: 1 }, label: 'Destroy them and take damage',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && fieldMons(g).some(x => x.flags.dest === c.u),
      res: function* (g, c, p) { const xs = fieldMons(g).filter(x => x.flags.dest === c.u); const A = new Map(xs.map(x => [x, faceUp(x) ? atk(g, x) : 0]));
        const out = destroy(g, xs, { by: p }); const n = out.reduce((s, x) => s + (A.get(x) || 0), 0); if (n) damage(g, p, n, { src: c, srcP: p }); } }] },
});

/* ----- helpers that need the scripts ----- */
// PARTIAL (Double Spell): the shared script is used, also in Goat, where a goat-only script of the copied Spell isn't reachable.
function scriptOf(c) { return E.SCRIPTS[D(c).n] || null; }
function dsOk(g, c, p, x) {
  if (!isSpell(x) || named(x, 'Double Spell')) return false; const effs = (scriptOf(x) || {}).effs || []; const eff = effs.find(e => e.type === 'act'); if (!eff) return false;
  const sub = D(x).sub; const freeNeed = c.zone === 'hand' ? 2 : 1;
  if (['Continuous', 'Equip'].includes(sub) || named(x, 'Swords of Revealing Light')) { if (g.p[p].st.filter(z => !z).length < freeNeed) return false; }
  try { return !eff.cond || !!eff.cond(g, x, p, { top: null, mode: 'idle' }); } catch (e) { return false; }
}
function cdOk(m) { return faceUp(m) && (name(m) === 'Power Tool Dragon' || (lv(m) >= 4 && race(m) === 'Machine' && /Morphtronic/.test(name(m)))); }
/* Destiny Board (classic-1.js) */
// Goat names them Spirit Message "I", Edison Spirit Message I: compared without the quotes so both formats work
const msgKey = n => String(n).replace(/"/g, '');
const MSGS = ['Spirit Message I', 'Spirit Message N', 'Spirit Message A', 'Spirit Message L'];
function isBoardPart(c) { return named(c, 'Destiny Board') || MSGS.includes(msgKey(D(c).n)); }
function msgsOn(g, p) { return stOf(g, p).filter(x => faceUp(x) && MSGS.includes(msgKey(D(x).n))); }
function boardWin(g, p) { const have = new Set(msgsOn(g, p).map(x => msgKey(D(x).n))); if (stOf(g, p).some(x => faceUp(x) && named(x, 'Destiny Board')) && MSGS.every(n => have.has(n))) L.winDuel(g, p, `${PN(g, p)} spelled FINAL with Destiny Board and won`); }
})();
