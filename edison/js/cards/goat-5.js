/* Goat 5: Water Return, Drain Burn, Gearfried, Flip Control, Emissary Beat, Tiger Stun, Bazoo Return, Soul Control,
 Stein Horus, Last Turn and the Fusion Monsters many Goat decks keep in the Fusion Deck (King Dragun, Dark Flare Knight, ...).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md), registered for Goat only (E.addScripts(obj, 'goat')).
 Written from each card's 2005 (summer Goat format) behavior; where today's text in goat/data/cards.js reads
 differently, the 2005 reading is used and noted. Fusion Monsters with no effect get an empty script: the engine reads
 their materials from the first line of their text. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, choose, move, destroy, ss, damage, gain, mill, search, setFaceDown, addRule, negate, tokens, equip,
  name, D, isMon, isSpell, isTrap, onField, faceUp, attr, race, lv, monsOf, allField, fieldMons, freeM, stOnField,
  log, PN, live, opp, oppFaceUp, emit, forbid, stat, evSummoned, fromFieldToGY, spellTrapAct } = L;

const named = (c, n) => D(c).n === n;
const vanilla = { effs: [] }; // a Fusion Monster with no effect
function* discardPick(g, p, n, text, not) { const h = g.p[p].hand.filter(x => x !== not); if (!h.length) return []; const xs = yield* pick(g, p, text, h, Math.min(n, h.length), Math.min(n, h.length), 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'discard' }); if (xs.length) log(g, `${PN(g, p)} discarded ${xs.map(name).join(', ')}.`); return xs; }
const waterGY = (g, p) => g.p[p].gy.filter(x => isMon(x) && attr(x) === 'WATER');
// Equip Cards equipped to monster c (Equip Spells, Snatch Steal, monsters used as Equip Cards)
const equipsOn = (g, c) => allField(g).filter(x => x.zone === 'st' && x.equipTo === c.u);
const isKingDragun = (g, x) => x.zone === 'm' && faceUp(x) && named(x, 'King Dragun') && !x.flags.negated;
// "Once per turn, you can change this card to face-down Defense Position" (same limits as Stealth Bird in goat-2.js).
const selfFaceDown = { type: 'ign', opt: true, label: 'Turn face-down', cond: (g, c) => c.turnIn !== g.turnNo && !c.posChanged,
  res: function* (g, c) { if (onField(c) && faceUp(c)) { setFaceDown(g, c); c.posChanged = true; } } };

E.addScripts({
  /* ----- Water Return ----- */
  'Aqua Spirit': {
    proc: { label: 'Special Summon (banish a WATER from your GY)', cond: (g, c, p) => waterGY(g, p).length > 0,
      cost: function* (g, c, p, grp) { const [x] = yield* pick(g, p, 'Banish a WATER monster from your GY', waterGY(g, p), 1, 1, 'cost'); if (x) { move(g, x, 'ban', { reason: 'cost', group: grp }); log(g, `${PN(g, p)} banished ${name(x)}.`); } } },
    effs: [{ type: 'trig', label: 'Change a monster’s position', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl,
      cond: (g, c, p) => oppFaceUp(g, p).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Change the battle position of which monster?', oppFaceUp(g, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || t.zone !== 'm') return;
        t.pos = t.pos === 'atk' ? 'def' : 'atk'; t.posChanged = true; g.seq++;
        addRule(g, (g2, a) => a.type === 'pos' && a.c === t, { end: g.turnNo }); // it must stay this way for the rest of the turn
        log(g, `${name(t)} changed to ${t.pos === 'atk' ? 'Attack' : 'Defense'} Position.`); emit(g, { type: 'pos', c: t, p }); } }] },
  'Lekunga': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Banish 2 WATER: summon a Lekunga Token',
    cond: (g, c, p) => waterGY(g, p).length >= 2 && freeM(g, p) >= 0,
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Banish 2 WATER monsters from your GY', waterGY(g, p), 2, 2, 'cost'); for (const x of xs) move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${xs.map(name).join(' and ')}.`); },
    res: function* (g, c, p) { tokens(g, p, { n: 'Lekunga Token', a: 'WATER', r: 'Plant', lv: 2, atk: 700, def: 700 }, 1, 'atk'); } }] },
  // 2005: mandatory ("Special Summon 1 Mirage Knight"), as today's text.
  'Dark Flare Knight': { self: { noBattleDamage: true },
    effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Summon Mirage Knight',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
      res: function* (g, c, p) { const cs = [...g.p[p].hand, ...g.p[p].deck].filter(x => named(x, 'Mirage Knight')); if (!cs.length || freeM(g, p) < 0) return;
        const [x] = yield* pick(g, p, 'Special Summon Mirage Knight from your hand or Deck', cs, 1, 1, 'good');
        if (x) { const fromDeck = x.zone === 'deck'; ss(g, p, x, 'atk'); if (fromDeck) L.shuffleDeck(g, p); } } }] },
  'Deepsea Shark': vanilla,
  'Humanoid Worm Drake': vanilla,
  'Roaring Ocean Snake': vanilla,
  // 2005: "Your opponent cannot target Dragon-Type monsters on the field with card effects. Once per turn, you can
  // Special Summon 1 Dragon-Type monster from your hand." The lock covers every Dragon on the field, both sides.
  // PARTIAL: King Dragun itself is exact (its targetFilter knows who targets). Other Dragons are untargetable for both
  // players, so King Dragun's controller can't target a Dragon with their own effects either.
  // ENGINE: cont.grant gets no chain link, so it can't tell who is targeting (only the target's own self.targetFilter can).
  'King Dragun': {
    self: { targetFilter: (g, x, L2) => fieldMons(g).some(k => isKingDragun(g, k) && L2.p !== k.ctrl) },
    cont: { grant: (g, src, c, flag) => flag === 'cantBeTargeted' && c.zone === 'm' && faceUp(c) && race(c) === 'Dragon' },
    effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Summon a Dragon from your hand',
      cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Dragon' && !forbid(g, { type: 'ss', c: x, p, how: 'special' })),
      res: function* (g, c, p) { const cs = g.p[p].hand.filter(x => isMon(x) && race(x) === 'Dragon'); if (!cs.length || freeM(g, p) < 0) return;
        const [x] = yield* pick(g, p, 'Special Summon which Dragon from your hand?', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },

  /* ----- Drain Burn and other Fusion Decks ----- */
  // 2005: "Discard 1 card to negate the activation of a Spell Card and destroy it."
  'Magic Jammer': { effs: [{ type: 'act',
    cond: (g, c, p, x) => spellTrapAct(x.top) && isSpell(x.top.c) && !x.top.negated && g.p[p].hand.length > 0,
    cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; yield* discardPick(g, p, 1, 'Discard 1 card'); },
    res: function* (g, c, p, L2) { L2.data.L.negBy = p; negate(g, L2.data.L, true); } }] },
  'Black Skull Dragon': vanilla,
  'Empress Judge': vanilla,
  'Fusionist': vanilla,
  'Sanwitch': vanilla,
  'Thousand Dragon': vanilla,
  'Warrior of Tradition': vanilla,
  'Giltia the D. Knight': vanilla,
  'Gaia the Dragon Champion': vanilla,

  /* ----- Gearfried ----- */
  // 2005: "When an Equip Card is equipped to this card, destroy the Equip Card." Mandatory.
  // Checked on the Equip Spell's activation and on every later event, so an equip that lands without an event (a Set
  // Equip Spell turned face-up) is caught at the next event.
  'Gearfried the Iron Knight': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the Equip Card',
    on: (g, ev, c) => equipsOn(g, c).length > 0 || (ev.type === 'move' && ev.to === 'st' && ev.reason === 'activate' && isSpell(ev.c) && D(ev.c).sub === 'Equip'),
    cond: (g, c) => equipsOn(g, c).length > 0,
    res: function* (g, c, p) { if (onField(c) && faceUp(c)) destroy(g, equipsOn(g, c), { by: p, src: c }); } }] },
  // 2005: "When this card is destroyed by a card effect while equipped to a monster, look at your opponent's hand and
  // discard 1 card from it." The equip is noted on the card (c.flags.smoke), so the trigger sees it in the move's snapshot.
  'Smoke Grenade of the Thief': { effs: [
    { type: 'act', cond: g => fieldMons(g).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Smoke Grenade of the Thief to which monster?', fieldMons(g).filter(faceUp), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.zone === 'm' && equip(g, c, t)) c.flags.smoke = t.u; } },
    { type: 'trig', loc: 'any', mand: true, label: 'Discard from their hand',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && !ev.battle && ev.reason === 'effect' && !!(ev.snap && ev.snap.flags && ev.snap.flags.smoke),
      res: function* (g, c, p) { const o = opp(p), h = g.p[o].hand; if (!h.length) return; log(g, `${PN(g, p)} looked at ${PN(g, o)}'s hand.`);
        const [x] = yield* pick(g, p, 'Discard which card from their hand?', h, 1, 1, 'bad'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, o)} discarded ${name(x)}.`); } } }] },

  /* ----- Flip Control, Clown Control, Heavy Slump ----- */
  // PARTIAL: it can't turn itself face-down the turn it was summoned or changed position (the usual position-change limit).
  'Golem Sentry': { effs: [selfFaceDown,
    { type: 'trig', mand: true, label: 'Return a monster to the hand', on: (g, ev, c) => evSummoned(ev, c, ['flip']),
      cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which of their monsters to the hand?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone === 'm') { const n = faceUp(t) ? name(t) : 'A face-down monster'; move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${n} returned to the hand.`); } } }] },
  'Mask of Darkness': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Add a Trap from the GY', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: (g, c, p) => g.p[p].gy.some(isTrap),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Trap from your GY to your hand?', g.p[p].gy.filter(isTrap), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },

  /* ----- Emissary Beat ----- */
  // 2005: mandatory; each player picks from their own Deck.
  'Emissary of the Afterlife': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Each player adds a Normal Monster',
    on: (g, ev, c) => fromFieldToGY(ev, c),
    res: function* (g, c, p) { for (const q of [p, opp(p)]) { if (forbid(g, { type: 'search', p: q })) continue;
      yield* search(g, q, x => isMon(x) && D(x).k === 'normal' && lv(x) <= 3, 'Add a Level 3 or lower Normal Monster from your Deck to your hand'); } } }] },
  // 2005: "Discard 1 card from your hand. Return 1 monster on the field to the top of its owner's Deck."
  'Back to Square One': { effs: [{ type: 'act', cond: (g, c, p) => fieldMons(g).length > 0 && g.p[p].hand.some(x => x !== c),
    cost: function* (g, c, p) { yield* discardPick(g, p, 1, 'Discard 1 card', c); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Put which monster on top of its owner’s Deck?', fieldMons(g), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.zone !== 'm') return; const n = faceUp(t) ? name(t) : 'A face-down monster';
      move(g, t, 'deckTop', { reason: 'effect', by: p }); log(g, `${n} was put on top of the Deck.`); } }] },

  /* ----- Tiger Stun ----- */
  // PARTIAL: monsters can't be Set and the cards that turn a monster face-down can't be activated (Book of Moon, and any
  // effect labeled "Turn ... face-down": Tsukuyomi, Stealth Bird, Golem Sentry). A Special Summon in face-down Defense
  // Position (The Shallow Grave, Cyber Jar) isn't stopped.
  // ENGINE: no Normal Summon in face-up Defense Position, so "it must be Normal Summoned in face-up Defense Position"
  // becomes a Normal Summon in Attack Position.
  'Light of Intervention': { cont: { forbid: (g, src, a) => (a.type === 'set' && a.c && isMon(a.c)) ||
      (a.type === 'activate' && a.c && (named(a.c, 'Book of Moon') || /turn .*face-down/i.test((a.eff && a.eff.label) || ''))) },
    effs: [{ type: 'act', res: function* () {} }] },

  /* ----- Bazoo Return ----- */
  'Dark Scorpion - Cliff the Trap Remover': { effs: [{ type: 'trig', when: true, label: 'Destroy a Spell/Trap or mill 2',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    target: function* (g, c, p, L2) {
      const st = stOnField(g), modes = ['Send the top 2 cards of their Deck to the GY']; if (st.length) modes.unshift('Destroy 1 Spell/Trap on the field');
      const i = modes.length > 1 ? yield* choose(g, p, 'Cliff the Trap Remover: which effect?', modes) : 0;
      L2.data.mode = /Destroy/.test(modes[i]) ? 'destroy' : 'mill';
      if (L2.data.mode === 'destroy') yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', st, 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { if (L2.data.mode === 'destroy') destroy(g, live(L2), { by: p, src: c }); else mill(g, opp(p), 2); } }] },

  /* ----- Soul Control, Emissary Beat ----- */
  // 2005: "Discard this card from your hand to reduce the Battle Damage you take from 1 attack to 0" (a Quick Effect,
  // used in the Damage Step). The battle is marked (g.battle.kuriboh); the card in the GY turns that battle's damage to 0.
  'Kuriboh': { cont: { loc: 'gy', dmg: (g, src, p, n, o) => o.battle && p === src.owner && g.battle && g.battle.kuriboh && g.battle.kuriboh.includes(p) ? 0 : n },
    effs: [{ type: 'quick', loc: 'hand', ds: true, label: 'Discard: no battle damage',
      cond: (g, c, p) => g.inDS && !!g.battle && g.battle.a.ctrl !== p && !(g.battle.kuriboh && g.battle.kuriboh.includes(p)),
      cost: function* (g, c, p, L2) { L2.data.b = g.battle; move(g, c, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded Kuriboh.`); },
      res: function* (g, c, p, L2) { const b = L2.data.b; if (b && g.battle === b) { (b.kuriboh || (b.kuriboh = [])).push(p); log(g, `${PN(g, p)} will take no battle damage from this battle.`); } } }] },

  /* ----- Stein Horus ----- */
  'Token Thanksgiving': { effs: [{ type: 'act', cond: g => fieldMons(g).some(x => D(x).k === 'token'),
    res: function* (g, c, p) { const out = destroy(g, fieldMons(g).filter(x => D(x).k === 'token'), { by: p, src: c }); if (out.length) gain(g, p, 800 * out.length); } }] },

  /* ----- Last Turn ----- */
  // 2005: "Offer 1 monster on your side of the field as a Tribute to inflict damage to your opponent's Life Points equal to
  // half the ATK of the Tributed monster." No once-per-turn limit in 2005 (today's text adds one). Catapult Turtle can
  // Tribute itself, and Sheep Tokens can be Tributed (it is a cost, not a Tribute Summon).
  'Catapult Turtle': { effs: [{ type: 'ign', label: 'Tribute a monster: damage',
    cond: (g, c, p) => monsOf(g, p).length > 0,
    cost: function* (g, c, p, L2) { const [m] = yield* pick(g, p, 'Tribute which monster?', monsOf(g, p), 1, 1, 'cost'); if (!m) return;
      L2.data.n = Math.floor(stat(g, m, 'atk') / 2); const nm = m.pos === 'set' ? 'a face-down monster' : name(m);
      move(g, m, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); },
    res: function* (g, c, p, L2) { if (L2.data.n > 0) damage(g, opp(p), L2.data.n, { src: c, srcP: p }); } }] },
}, 'goat');
})();
