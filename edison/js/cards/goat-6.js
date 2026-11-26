/* Goat 6: cards for Zorc Turbo, Chaos Return, Economics FTK, Library FTK, Warrior Control, Zombie Turbo, the Stein decks,
 Last Turn, Mataza Rush, Tomato Control, Emissary Beat and Water Return.
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md), registered for Goat only (E.addScripts(obj, 'goat')).
 Each card is written from its 2005 (summer Goat format) behavior; where today's text in goat/data/cards.js reads
 differently, the 2005 reading is used and noted on the card. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, pay, search, takeControl, addMod, addRule, ritualSummon, canRitual,
  name, D, isMon, isSpell, isST, onField, faceUp, race, lv, monsOf, stOf, allField, fieldMons, freeM, nFreeM, allCards,
  shuffleDeck, log, PN, live, opp, emit, forbid, stat } = L;

const named = (c, n) => D(c).n === n;
const over = (g, winner, why) => { g.winner = winner; g.why = why; log(g, why + '.'); throw { over: true }; };
const discardRandom = (g, p) => { const h = g.p[p].hand; if (!h.length) return null; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)} at random.`); return x; };
function* discardPick(g, p, n, text, not) { const h = g.p[p].hand.filter(x => x !== not); if (!h.length) return []; const xs = yield* pick(g, p, text, h, Math.min(n, h.length), Math.min(n, h.length), 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'discard' }); if (xs.length) log(g, `${PN(g, p)} discarded ${xs.map(name).join(', ')}.`); return xs; }
function* tributeCost(g, p, text) { const [x] = yield* pick(g, p, text, monsOf(g, p), 1, 1, 'cost'); if (!x) return null; const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); return x; }
const die = g => 1 + Math.floor(g.rnd() * 6);
// "Cannot be Special Summoned from the Graveyard" (same as goat-1.js). PARTIAL: one cont per card, so it works from the GY only.
const noSSFromGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src };
// "Must be Fusion Summoned" from the Extra Deck: the engine has no cont from the Extra Deck, so the first event a card
// with that text sees while in an Extra Deck installs a duel-long rule (no Metamorphosis or Cyber-Stein for it).
// A properly summoned one can still be revived from the GY (2005 rules).
const mustFusionText = c => /Must be Fusion Summoned/i.test(D(c).tx || '');
const mustFusion = { type: 'trig', loc: 'extra', res: function* () {},
  on: (g) => { if (!g.goat6Fusion) { g.goat6Fusion = true; addRule(g, (g2, a) => a.type === 'ss' && a.c && a.c.zone === 'extra' && a.how !== 'fusion' && mustFusionText(a.c)); } return false; } };
// Whose effect moved a card? The engine doesn't record it for every move, so: the move's `by` when set, else
// an effect that resolves during the opponent's turn. PARTIAL: an opponent's Quick Effect on your own turn is missed.
const byOpp = (g, ev, c) => ev.by != null ? ev.by !== c.owner : g.tp !== c.owner;
const sentByOpp = (g, ev, c, froms) => ev.type === 'move' && ev.c === c && ev.to === 'gy' && froms.includes(ev.from) && ['effect', 'discard'].includes(ev.reason) && byOpp(g, ev, c);
const spellEcon = (g, p) => stOf(g, p).some(x => faceUp(x) && named(x, 'Spell Economics'));
const isSpecial = c => D(c).k === 'token' || (c.summonType && !['normal', 'tribute', 'flip', 'gemini'].includes(c.summonType));

E.addScripts({
  /* ----- Zorc Turbo ----- */
  'Senju of the Thousand Hands': { effs: [{ type: 'trig', when: true, label: 'Add a Ritual Monster', on: (g, ev, c) => L.evSummoned(ev, c, ['normal', 'tribute', 'flip']),
    cond: (g, c, p) => g.p[p].deck.some(x => D(x).k === 'ritual'),
    res: function* (g, c, p) { yield* search(g, p, x => D(x).k === 'ritual', 'Add which Ritual Monster to your hand?'); } }] },
  // 2005: "Once per turn, roll a die: 1-2 destroy all your opponent's monsters, 3-5 destroy 1 of their monsters, 6 destroy all of yours."
  'Dark Master - Zorc': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Roll a die',
    res: function* (g, c, p) {
      if (!onField(c)) return; const r = die(g); log(g, `${PN(g, p)} rolled a ${r}.`);
      if (r <= 2) destroy(g, monsOf(g, opp(p)), { by: p });
      else if (r <= 5) { const ms = monsOf(g, opp(p)); if (ms.length) { const [t] = yield* pick(g, p, 'Destroy which of their monsters?', ms, 1, 1, 'bad'); if (t) destroy(g, [t], { by: p }); } }
      else destroy(g, monsOf(g, p), { by: p });
    } }] },
  'Contract with the Dark Master': { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => canRitual(g, p, { monster: x => named(x, 'Dark Master - Zorc') }),
    res: function* (g, c, p) { yield* ritualSummon(g, p, { monster: x => named(x, 'Dark Master - Zorc') }); } }] },
  // 2005: "This card can only be Special Summoned by Fusion Summon. When a Spell Card is activated, you can discard 1 card
  // to negate it and destroy it. Gains 500 ATK for every Dragon on the field and in either Graveyard."
  'Dark Paladin': {
    self: { atk: (g, c) => 500 * (fieldMons(g).filter(x => faceUp(x) && race(x) === 'Dragon').length + allCards(g, 'gy').filter(x => isMon(x) && race(x) === 'Dragon').length) },
    effs: [mustFusion,
      { type: 'quick', ds: true, label: 'Discard: negate the Spell',
        cond: (g, c, p, x) => !!(x.top && x.top.cardAct && isSpell(x.top.c) && !x.top.negated) && g.p[p].hand.length > 0,
        cost: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; yield* discardPick(g, p, 1, 'Discard 1 card'); },
        res: function* (g, c, p, L2) { if (!onField(c) || !faceUp(c)) return; L2.data.L.negBy = p; L.negate(g, L2.data.L, true); } }] },

  /* ----- Chaos Return, Soul Control ----- */
  // 2005: "Roll a die twice during your Main Phase. Select 1 result and destroy 1 face-up monster with that Level. Once per turn."
  'Roulette Barrel': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Roll 2 dice: destroy a monster', cond: g => fieldMons(g).some(faceUp),
    res: function* (g, c, p) {
      const a = die(g), b = die(g); log(g, `${PN(g, p)} rolled a ${a} and a ${b}.`);
      const i = a === b ? 0 : yield* choose(g, p, 'Use which result?', ['Level ' + a, 'Level ' + b]); const n = i ? b : a;
      const ms = fieldMons(g).filter(x => faceUp(x) && lv(x) === n); if (!ms.length) { log(g, `No face-up Level ${n} monster.`); return; }
      const [t] = yield* pick(g, p, `Destroy which Level ${n} monster?`, ms, 1, 1, 'bad'); if (t) destroy(g, [t], { by: p });
    } }] },
  'Twin-Headed Thunder Dragon': { effs: [] }, // no effect; summoned by Metamorphosis or Cyber-Stein in these decks

  /* ----- Economics FTK, Library FTK ----- */
  // PARTIAL: the 2005 printing read only "Offer 1 monster on your side of the field as a Tribute to inflict 500 points of
  // damage"; the Toon rules in today's text (no attack the turn it is summoned, dies with Toon World, direct attacks) came later.
  'Toon Cannon Soldier': { effs: [{ type: 'ign', label: 'Tribute: 500 damage', cond: (g, c, p) => monsOf(g, p).length > 0,
    cost: function* (g, c, p) { yield* tributeCost(g, p, 'Tribute 1 monster'); },
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  'Mass Driver': { effs: [{ type: 'act', res: function* () {} },
    { type: 'ign', loc: 'st', label: 'Tribute: 400 damage', cond: (g, c, p) => monsOf(g, p).length > 0,
      cost: function* (g, c, p) { yield* tributeCost(g, p, 'Tribute 1 monster'); },
      res: function* (g, c, p) { damage(g, opp(p), 400, { src: c, srcP: p }); } }] },
  // ENGINE: L.pay has no hook, so only Toon World (this file) skips its LP cost. Premature Burial, Brain Control and the
  // other Spells scripted elsewhere still pay while Spell Economics is face-up.
  'Spell Economics': { effs: [{ type: 'act', res: function* () {} }] },
  'Toon Table of Contents': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.some(x => /Toon/.test(D(x).n)),
    res: function* (g, c, p) { yield* search(g, p, x => /Toon/.test(D(x).n), 'Add which "Toon" card to your hand?'); } }] },
  'Toon World': { effs: [{ type: 'act', cond: (g, c, p) => spellEcon(g, p) || g.p[p].lp > 1000,
    cost: function* (g, c, p) { if (spellEcon(g, p)) log(g, `${PN(g, p)} paid no LP (Spell Economics).`); else pay(g, p, 1000); },
    res: function* () {} }] },

  /* ----- Warrior Control ----- */
  // 2005: "If this face-up card is removed from play, Special Summon it during the End Phase of this turn." Once per turn.
  'D.D. Survivor': { effs: [{ type: 'trig', loc: 'ban', mand: true, opt: true, tags: { ss: 1 }, label: 'Return from banishment',
    on: (g, ev, c) => {
      if (ev.type === 'move' && ev.c === c && ev.to === 'ban' && ev.wasField && ev.snap && ev.snap.faceUp && ev.prevCtrl === c.owner) c.flags.ddsurv = g.turnNo;
      return ev.type === 'phase' && ev.ph === 'end' && c.flags.ddsurv === g.turnNo;
    },
    cond: (g, c) => freeM(g, c.owner) >= 0,
    res: function* (g, c, p) { if (c.zone === 'ban') ss(g, c.owner, c, 'atk'); } }] },
  // Opponent's monsters that attack while it is face-up lose half their ATK (taken when the attack is declared) until it leaves.
  'Mirror Wall': { effs: [
    { type: 'act', res: function* (g, c, p) { const b = g.aw || g.battle; if (b && b.a && b.a.ctrl !== p) halve(g, c, b.a); } },
    { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'attack' && ev.a.ctrl !== c.ctrl && faceUp(c)) halve(g, c, ev.a); return false; }, res: function* () {} },
    { type: 'trig', loc: 'any', on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.wasField) for (const m of fieldMons(g)) m.mods = m.mods.filter(x => x.mw !== c.u); return false; }, res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, label: 'Pay 2000 LP or destroy it', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 2000 && (yield* yn(g, p, 'Pay 2000 LP to keep Mirror Wall?'))) pay(g, p, 2000); else destroy(g, [c], { rule: true }); } }] },
  'Robbin\' Goblin': { effs: [{ type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', mand: true, label: 'Random discard', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.p !== c.ctrl && ev.src && ev.src.ctrl === c.ctrl && onField(ev.src),
      cond: (g, c, p) => g.p[opp(p)].hand.length > 0,
      res: function* (g, c, p) { discardRandom(g, opp(p)); } }] },

  /* ----- Zombie Turbo ----- */
  // 2005: "When this card is sent from your hand or Deck to the Graveyard by an effect of a card controlled by your opponent, Special Summon it."
  'Despair from the Dark': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon itself',
    on: (g, ev, c) => sentByOpp(g, ev, c, ['hand', 'deck']), cond: (g, c, p) => freeM(g, p) >= 0,
    res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c, 'atk'); } }] },
  'Regenerating Mummy': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Return to the hand',
    on: (g, ev, c) => sentByOpp(g, ev, c, ['hand']),
    res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} returned Regenerating Mummy to the hand.`); } } }] },
  'Slate Warrior': { effs: [
    { type: 'trig', mand: true, faceDownOk: true, label: '+500 ATK and DEF', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500, def: 500 }); log(g, `${name(c)} gained 500 ATK and DEF.`); } } },
    { type: 'trig', loc: 'gy', mand: true, label: 'The attacker loses 500', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy' && !!ev.killer,
      res: function* (g, c, p, L2) { const k = L2.ev.killer; if (k && onField(k) && faceUp(k)) { addMod(g, k, { atk: -500, def: -500 }); log(g, `${name(k)} lost 500 ATK and DEF.`); } } }] },

  /* ----- Stein decks, Last Turn ----- */
  // 2005: "Pay 5000 Life Points to Special Summon 1 Fusion Monster from your Fusion Deck in face-up Attack Position." No limit.
  'Cyber-Stein': { effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Pay 5000: summon a Fusion',
    cond: (g, c, p) => g.p[p].lp > 5000 && freeM(g, p) >= 0 && steinTargets(g, p).length > 0,
    cost: function* (g, c, p) { pay(g, p, 5000); },
    res: function* (g, c, p) { const fs = steinTargets(g, p); if (!fs.length || freeM(g, p) < 0) return; const [f] = yield* pick(g, p, 'Special Summon which Fusion Monster?', fs, 1, 1, 'good'); if (f) ss(g, p, f, 'atk'); } }] },
  // 2005: "Discard 1 random card from your hand to destroy all Special Summoned monsters on the field. Neither player can Special Summon monsters."
  // ENGINE: the shared Scapegoat script makes its Sheep Tokens without asking forbid(), so Jowgen does not stop Scapegoat.
  'Jowgen the Spiritualist': { cont: { forbid: (g, src, a) => a.type === 'ss' },
    effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Random discard: destroy Special Summoned monsters',
      cond: (g, c, p) => g.p[p].hand.length > 0 && fieldMons(g).some(isSpecial),
      cost: function* (g, c, p) { discardRandom(g, p); },
      res: function* (g, c, p) { destroy(g, fieldMons(g).filter(isSpecial), { by: p }); } }] },
  // PARTIAL: the forced attack is worked out inside the card (no Damage Step windows; Flip effects of a face-down
  // selected monster do activate). The End Phase check ends the duel: one monster alone on the field wins, else a draw.
  'Last Turn': { effs: [
    { type: 'act', cond: (g, c, p) => g.tp !== p && g.p[p].lp <= 1000 && monsOf(g, p).length > 0,
      res: function* (g, c, p) {
        const o = opp(p); const [m] = yield* pick(g, p, 'Select 1 monster you control', monsOf(g, p), 1, 1, 'good');
        const rest = allField(g).filter(x => x !== m && x !== c);
        for (const x of rest) move(g, x, 'gy', { reason: 'effect', by: p });
        for (const q of [p, o]) for (const x of g.p[q].hand.slice()) move(g, x, 'gy', { reason: 'effect', by: p });
        log(g, 'Every other card on the field and in both hands went to the GY.');
        g.lastTurn = { turn: g.turnNo, u: c.u };
        const ms = g.p[o].deck.filter(x => isMon(x) && !['ritual', 'token'].includes(D(x).k) && !/Cannot be Special Summoned/i.test(D(x).tx || ''));
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
    { type: 'trig', loc: 'any', res: function* () {},
      on: (g, ev, c) => {
        // the End Phase of that turn, or (activated during the End Phase itself) the first event of the next turn
        if (g.lastTurn && g.lastTurn.u === c.u && ((ev.type === 'phase' && ev.ph === 'end' && g.lastTurn.turn === g.turnNo) || g.turnNo > g.lastTurn.turn)) {
          g.lastTurn = null; const all = allField(g);
          if (all.length === 1 && isMon(all[0]) && all[0].zone === 'm') over(g, all[0].ctrl, `Last Turn: ${PN(g, all[0].ctrl)}'s monster is alone on the field`);
          over(g, -1, 'Last Turn: no monster is alone on the field, so the duel is a draw');
        }
        return false;
      } }] },
  'Self-Destruct Button': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].lp - g.p[p].lp >= 7000,
    res: function* (g) { g.p[0].lp = 0; g.p[1].lp = 0; log(g, 'Both players’ Life Points became 0.'); over(g, -1, 'Both players hit 0 LP'); } }] },
  'Mokey Mokey King': { effs: [{ type: 'trig', loc: 'any', when: true, tags: { ss: 1 }, label: 'Summon Mokey Mokey from the GY',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.to !== 'm',
    cond: (g, c) => freeM(g, c.owner) >= 0 && g.p[c.owner].gy.some(x => named(x, 'Mokey Mokey')),
    res: function* (g, c) { const p = c.owner; for (const x of g.p[p].gy.filter(y => named(y, 'Mokey Mokey'))) { if (freeM(g, p) < 0) break; ss(g, p, x, 'atk'); } } }] },

  /* ----- Mataza Rush, Tomato Control, Emissary Beat, Water Return ----- */
  // PARTIAL: the engine's takeControl has no "can't switch control" check, so Mataza goes straight back to its owner
  // after the control effect resolves (the control Spell or Trap is still used up).
  'Mataza the Zapper': { self: { maxAttacks: () => 2 },
    effs: [{ type: 'trig', res: function* () {}, on: (g, ev, c) => {
      if (faceUp(c) && c.zone === 'm' && c.ctrl !== c.owner && freeM(g, c.owner) >= 0) { takeControl(g, c.owner, c, false); log(g, `Control of ${name(c)} can't switch: it went back to ${PN(g, c.owner)}.`); }
      return false; } }] },
  // 2005: "Cannot be Special Summoned from the Graveyard. Once per turn, you can send 1 card from your hand to the Graveyard
  // to select 1 monster in your Graveyard and Special Summon it."
  'The Creator': { cont: noSSFromGY,
    effs: [{ type: 'ign', opt: true, tags: { ss: 1 }, label: 'Send a card: revive a monster',
      cond: (g, c, p) => g.p[p].hand.length > 0 && freeM(g, p) >= 0 && g.p[p].gy.some(x => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' })),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send 1 card from your hand to the GY', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${name(x)} to the GY.`); } },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which monster from your GY?', g.p[p].gy.filter(x => isMon(x) && !forbid(g, { type: 'ss', c: x, p, how: 'special' })), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') ss(g, p, t, 'atk'); } }] },
  // 2005: "FLIP: Select and destroy 2 face-down Spell or Trap Cards on the field." Needs 2 to select.
  'Greenkappa': { effs: [{ type: 'trig', mand: true, faceDownOk: true, tags: { destroy: 1 }, label: 'Destroy 2 Set Spells/Traps',
    on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    cond: g => allField(g).filter(x => isST(x) && x.pos === 'set').length >= 2,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which 2 Set Spells/Traps?', allField(g).filter(x => isST(x) && x.pos === 'set'), 2, 2, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  // PARTIAL: Spell activations (cards and effects) are blocked and Spell effects on the chain are negated, but the static
  // effects of Spells already face-up (Swords of Revealing Light, equips) keep applying, like Jinzo in goat-2.js.
  'Spell Canceller': { cont: { forbid: (g, src, a) => a.type === 'activate' && isSpell(a.c), negates: (g, src, c) => isSpell(c) } },
  // 2005: "When this face-up card on the field is returned to your Deck, Special Summon 1 Level 3 or lower monster from your Deck."
  'Serpentine Princess': { effs: [{ type: 'trig', loc: 'deck', mand: true, tags: { ss: 1 }, label: 'Summon a Level 3 or lower monster',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.snap && ev.snap.faceUp && (ev.to === 'deck' || ev.to === 'deckTop'),
    cond: (g, c, p) => freeM(g, p) >= 0 && princessTargets(g, p).length > 0,
    res: function* (g, c, p) { const ms = princessTargets(g, p); if (ms.length && freeM(g, p) >= 0) { const [x] = yield* pick(g, p, 'Special Summon which Level 3 or lower monster?', ms, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } shuffleDeck(g, p); } }] },
}, 'goat');

function halve(g, wall, m) {
  if (!onField(m) || !faceUp(m) || m.mods.some(x => x.mw === wall.u)) return;
  const a = stat(g, m, 'atk'), cut = a - Math.floor(a / 2); if (!cut) return;
  m.mods.push({ atk: -cut, mw: wall.u, turn: g.turnNo }); log(g, `${name(m)}'s ATK was halved by Mirror Wall.`);
}
function steinTargets(g, p) { return g.p[p].extra.filter(f => D(f).k === 'fusion' && !mustFusionText(f) && !forbid(g, { type: 'ss', c: f, p, how: 'special' })); }
function princessTargets(g, p) { return g.p[p].deck.filter(x => isMon(x) && lv(x) <= 3 && !['ritual', 'token'].includes(D(x).k) && !forbid(g, { type: 'ss', c: x, p, how: 'special' })); }
})();
