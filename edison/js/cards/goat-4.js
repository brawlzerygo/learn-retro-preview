/* Goat 4: the Metamorphosis Fusion Deck (Dark Balter, Dark Blade, Gatling Dragon, Ryu Senshi, ...), Ben Kei OTK, Stall Burn
 and the singles of build/batches/goat-4.txt. Card scripts for js/engine.js (see build/CARD_SCRIPTS.md), registered for Goat
 only (E.addScripts(obj, 'goat')). Each card follows its summer 2005 behavior; the texts in goat/data/cards.js read the same
 way for these cards unless a comment says otherwise. The Fusion Monsters here reach the field through Metamorphosis,
 Dimension Fusion or a revival, so their "Fusion Summon only with ..." lines don't come up. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, move, destroy, ss, draw, damage, gain, pay, search, addRule, equip, name, D, isMon, isSpell, isTrap,
  onField, faceUp, attr, race, monsOf, stOf, allField, fieldMons, freeST, nFreeM, shuffleDeck, log, PN, live, opp, stat,
  evSummoned, fromFieldToGY } = L;

const named = (c, n) => D(c).n === n;
const isEffectMon = c => isMon(c) && (D(c).k === 'effect' || /Effect/.test(D(c).ab || ''));
const isFlipMon = c => isMon(c) && (!!D(c).flip || /Flip/.test(D(c).ab || ''));
const equipsOn = (g, m) => allField(g).filter(x => x.zone === 'st' && x.equipTo === m.u);
// Negate the effect of a chain link (the card still resolves as negated; destroyIt also destroys the card).
function negLink(g, T, p, destroyIt) { if (!T || T.negated) return; T.negated = true; T.negBy = p; log(g, `${name(T.c)}'s effect was negated.`); if (destroyIt && onField(T.c)) destroy(g, [T.c], { by: p }); }
// An Equip Spell: target a face-up monster (filter), equip it at resolution. Bonuses go in the card's cont.
const equipAct = (filter = () => true, text = 'Equip to which face-up monster?') => ({ type: 'act',
  cond: g => fieldMons(g).some(m => faceUp(m) && filter(m)),
  target: function* (g, c, p, L2) { yield* tgt(g, p, L2, text, fieldMons(g).filter(m => faceUp(m) && filter(m)), 1, 1, 'good'); },
  res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && filter(t) && onField(c)) { equip(g, c, t); c.flags.eqU = t.u; } } });
const eqBonus = (a, d) => ({ atk: (g, src, m) => src.equipTo === m.u ? a : 0, def: (g, src, m) => src.equipTo === m.u ? d : 0 });
// "Negate any Trap/Spell effects that target this card": offered as a response to the link that targets it.
// ENGINE: continuous negation of a targeting card isn't automatic (no hook when a link picks its targets), so the
// controller uses it as an optional response at Spell Speed 3. PARTIAL: optional, and it is a chain link here.
const negTargeting = (isKind, label) => ({ type: 'quick', speed: 3, ds: true, label,
  cond: (g, c, p, x) => { const t = x.top; return !!(t && !t.negated && isKind(t.c) && t.c !== c && (t.t || []).includes(c) && faceUp(c)); },
  target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
  res: function* (g, c, p, L2) { negLink(g, L2.data.L, p, true); } });
// Ojama King: the opponent's Monster Zones it locks, chosen automatically (empty zones first, lowest first).
function kingZones(g, c) {
  const o = opp(c.ctrl); if (c.flags.ojamaZones && c.flags.ojamaZones.p === o) return c.flags.ojamaZones;
  const zs = [0, 1, 2, 3, 4].sort((a, b) => (!!g.p[o].m[a] - !!g.p[o].m[b]) || a - b).slice(0, 3);
  c.flags.ojamaZones = { p: o, zs }; return c.flags.ojamaZones;
}
// Barrel Behind the Door: does this link's card text inflict effect damage? (battle-damage sentences are left out)
const burnText = c => { const t = (D(c).tx || '').replace(/[^.]*battle damage[^.]*\.?/gi, ''); return /inflict[^.]*damage|damage to (both|each|your)|takes? [^.]*damage/i.test(t); };

E.addScripts({
  /* ----- Fusion Monsters (Metamorphosis targets) ----- */
  // "When a Normal Spell Card is activated, negate the effect by paying 1000 Life Points." Any player's Normal Spell, no limit.
  // "The effect of an Effect Monster that this monster destroys as a result of battle is negated": the destroyed monster's
  // effects can't activate from where it went (Sangan, Mystic Tomato and so on) for the rest of the turn.
  // PARTIAL: Flip effects of a face-down monster it attacks still resolve (they activate before the monster is destroyed).
  'Dark Balter the Terrible': { effs: [
    { type: 'quick', label: 'Pay 1000: negate the Normal Spell',
      cond: (g, c, p, x) => { const t = x.top; return !!(t && t.cardAct && isSpell(t.c) && D(t.c).sub === 'Normal' && !t.negated) && g.p[p].lp > 1000; },
      cost: function* (g, c, p, L2) { pay(g, p, 1000); L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { negLink(g, L2.data.L, p, false); } },
    { type: 'trig', loc: 'any', on: (g, ev, c) => {
      if (ev.type === 'move' && ev.battle && ev.destroyed && ev.killer === c && ev.c !== c && isEffectMon(ev.c)) {
        const v = ev.c, zone = v.zone; log(g, `${D(v).n}'s effect is negated.`);
        addRule(g, (g2, a) => a.type === 'activate' && a.c === v && v.zone === zone, { end: g.turnNo });
      }
      return false; }, res: function* () {} }] },
  // "Each time this card inflicts Battle Damage to your opponent, you can select up to 3 Monster Cards from your opponent's
  // Graveyard and remove them from play."
  'Dark Blade the Dragon Knight': { effs: [{ type: 'trig', label: 'Banish up to 3 monsters from their GY',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
    cond: (g, c, p) => g.p[opp(p)].gy.some(isMon),
    res: function* (g, c, p) { const xs = yield* pick(g, p, 'Banish up to 3 monsters from their GY', g.p[opp(p)].gy.filter(isMon), 1, 3, 'bad');
      for (const x of xs) move(g, x, 'ban', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.map(name).join(', ')} ${xs.length > 1 ? 'were' : 'was'} banished.`); } }] },
  'Flame Ghost': { effs: [] },
  'Karbonala Warrior': { effs: [] },
  'Master of Oz': { effs: [] },
  // "Once per turn: toss a coin 3 times and destroy as many monsters on the field as possible, but not more than the number of heads."
  // The controller picks which monsters (this card included, if it likes).
  'Gatling Dragon': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Toss 3 coins: destroy monsters',
    cond: g => fieldMons(g).length > 0,
    res: function* (g, c, p) { const coins = [0, 1, 2].map(() => g.rnd() < 0.5); const h = coins.filter(Boolean).length;
      log(g, `Coins: ${coins.map(x => x ? 'heads' : 'tails').join(', ')}.`);
      const ms = fieldMons(g), n = Math.min(h, ms.length); if (!n) return;
      const xs = yield* pick(g, p, `Destroy ${n} monster${n > 1 ? 's' : ''}`, ms, n, n, 'bad'); destroy(g, xs, { by: p }); } }] },
  // "When a Normal Trap Card is activated: You can pay 1000 LP; negate that effect. This card must be face-up on the field
  // to activate and to resolve this effect. Negate the effects of any Spell Card that targets this card and destroy it."
  'Ryu Senshi': { effs: [
    { type: 'quick', ds: true, label: 'Pay 1000: negate the Normal Trap',
      cond: (g, c, p, x) => { const t = x.top; return !!(t && t.cardAct && isTrap(t.c) && D(t.c).sub === 'Normal' && !t.negated) && g.p[p].lp > 1000; },
      cost: function* (g, c, p, L2) { pay(g, p, 1000); L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { if (onField(c) && faceUp(c)) negLink(g, L2.data.L, p, false); } },
    negTargeting(isSpell, 'Negate the Spell targeting it')] },
  // "Negate the effects of Flip Effect Monsters. Negate any Trap effects that target this card, and destroy that Trap Card."
  'Fiend Skull Dragon': { cont: { negates: (g, src, c) => isFlipMon(c) },
    effs: [negTargeting(isTrap, 'Negate the Trap targeting it')] },
  // "Select up to 3 of your opponent's Monster Card Zones. The selected zones cannot be used."
  // PARTIAL: the 3 zones are picked automatically (their empty zones first). A monster that lands in a locked zone is moved
  // to a free unlocked one; control changes (Snatch Steal) ignore the lock.
  'Ojama King': {
    cont: { forbid: (g, src, a) => ['ns', 'set', 'ss'].includes(a.type) && a.p === opp(src.ctrl) && (() => { const Z = kingZones(g, src); return !g.p[Z.p].m.some((x, i) => !x && !Z.zs.includes(i)); })() },
    effs: [{ type: 'trig', on: (g, ev, c) => {
      if (evSummoned(ev, c) || (ev.type === 'flip' && ev.c === c)) { c.flags.ojamaZones = null; const Z = kingZones(g, c); log(g, `${PN(g, Z.p)}'s Monster Zones ${Z.zs.map(i => i + 1).join(', ')} can't be used.`); }
      if (ev.type === 'move' && ev.to === 'm' && ev.c !== c && ev.c.ctrl === opp(c.ctrl) && onField(c) && faceUp(c)) {
        const Z = kingZones(g, c), row = g.p[Z.p].m, i = row.indexOf(ev.c);
        if (i >= 0 && Z.zs.includes(i)) { const j = row.findIndex((x, k) => !x && !Z.zs.includes(k)); if (j >= 0) { row[i] = null; row[j] = ev.c; g.seq++; } }
      }
      return false; }, res: function* () {} }] },
  // "If this card is Special Summoned: Destroy all other monsters you control. Neither player can Summon monsters."
  // Sets are still allowed (a Set is not a Summon). PARTIAL: Flip Summons aren't stopped (no forbid action for a Flip Summon).
  'The Last Warrior from Another Planet': { cont: { forbid: (g, src, a) => a.type === 'ns' || a.type === 'ss' },
    effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy your other monsters',
      on: (g, ev, c) => evSummoned(ev, c, ['special', 'fusion', 'ritual']),
      res: function* (g, c, p) { const xs = monsOf(g, p).filter(x => x !== c); if (xs.length) destroy(g, xs, { by: p }); } }] },

  /* ----- Effect Monsters ----- */
  // "After damage calculation, when this card is destroyed by battle with an opponent's monster: Banish that monster, also banish this card."
  // PARTIAL: the other monster is banished only if it is still on the field (if both were destroyed, only this card goes).
  'D.D. Assailant': { effs: [{ type: 'trig', loc: 'any', mand: true, label: 'Banish both monsters',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.wasField && !!ev.killer && ev.killer.ctrl !== ev.prevCtrl,
    res: function* (g, c, p, L2) { const k = L2.ev.killer;
      if (k && onField(k)) { move(g, k, 'ban', { reason: 'effect', by: p }); log(g, `${D(k).n} was banished.`); }
      if (c.zone === 'gy') { move(g, c, 'ban', { reason: 'effect', by: p }); log(g, 'D.D. Assailant was banished.'); } } }] },
  'Nimble Momonga': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Gain 1000, summon Nimble Momongas',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p) { gain(g, p, 1000);
      const cs = g.p[p].deck.filter(x => named(x, 'Nimble Momonga')); const n = Math.min(cs.length, nFreeM(g, p)); if (!n) return;
      const xs = yield* pick(g, p, 'Special Summon any number of Nimble Momonga face-down (none is fine)', cs, 0, n, 'good');
      for (const x of xs) ss(g, p, x, 'set'); shuffleDeck(g, p); } }] },
  'Solar Flare Dragon': { self: { noAttackTarget: (g, c) => monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && race(x) === 'Pyro') },
    effs: [{ type: 'trig', mand: true, label: '500 damage', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
      res: function* (g, c, p) { if (onField(c) && faceUp(c)) damage(g, opp(p), 500, { src: c, srcP: p }); } }] },
  // "For each Equip Card equipped to this card, it gains 1 additional attack during each Battle Phase."
  'Armed Samurai - Ben Kei': { self: { maxAttacks: (g, c) => 1 + equipsOn(g, c).length } },
  'Iron Blacksmith Kotetsu': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: 'Add an Equip Spell', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { yield* search(g, p, x => isSpell(x) && D(x).sub === 'Equip', 'Add an Equip Spell from your Deck to your hand'); } }] },
  // "Once per turn: You can discard 1 Spell Card, then target 1 Spell/Trap Card your opponent controls; destroy that target."
  'Chiron the Mage': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Discard a Spell: destroy a Spell/Trap',
    cond: (g, c, p) => g.p[p].hand.some(isSpell) && stOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 Spell Card', g.p[p].hand.filter(isSpell), 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  // "If this card attacks, it is changed to Defense Position at the end of the Battle Phase. You cannot change this battle
  // position until the end of your next turn." Done as it happens, with no chain link.
  'Giant Orc': { cont: { forbid: (g, src, a) => a.type === 'pos' && a.c === src && src.flags.orcLock >= g.turnNo },
    effs: [{ type: 'trig', on: (g, ev, c) => {
      if (ev.type === 'phase' && ev.ph === 'bpEnd' && ev.tp === c.ctrl && c.attacks > 0 && c.pos === 'atk' && onField(c)) {
        c.pos = 'def'; c.posChanged = true; c.flags.orcLock = g.turnNo + 2; g.seq++; log(g, 'Giant Orc changed to Defense Position.'); }
      return false; }, res: function* () {} }] },

  /* ----- Equip Spells ----- */
  // "When this card is sent from the field to the Graveyard: You can Tribute 1 monster; place this card on the top of your Deck."
  'Axe of Despair': { cont: eqBonus(1000, 0), effs: [equipAct(),
    { type: 'trig', loc: 'gy', when: true, label: 'Tribute 1 monster: put it on top of the Deck',
      on: (g, ev, c) => fromFieldToGY(ev, c), cond: (g, c, p) => c.zone === 'gy' && monsOf(g, p).length > 0,
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 monster', monsOf(g, p), 1, 1, 'cost'); if (x) { const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${nm}.`); } },
      res: function* (g, c, p) { if (c.zone === 'gy') { move(g, c, 'deckTop', { reason: 'effect' }); log(g, 'Axe of Despair was put on top of the Deck.'); } } }] },
  // "+400 ATK. Piercing. When this card leaves the field, banish the equipped monster."
  'Big Bang Shot': { cont: { ...eqBonus(400, 0), grant: (g, src, m, flag) => flag === 'piercing' && src.equipTo === m.u },
    effs: [equipAct(),
      { type: 'trig', loc: 'any', mand: true, label: 'Banish the equipped monster',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && !!(ev.snap && ev.snap.flags && ev.snap.flags.eqU),
        res: function* (g, c, p, L2) { const t = fieldMons(g).find(x => x.u === L2.ev.snap.flags.eqU); if (t) { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${D(t).n} was banished.`); } } }] },
  // "Equip only to a Warrior-Type monster. It gains 800 ATK. All WATER monsters lose 500 ATK."
  'Lightning Blade': { cont: { atk: (g, src, m) => (src.equipTo === m.u ? 800 : 0) + (src.equipTo && attr(m) === 'WATER' ? -500 : 0) },
    effs: [equipAct(m => race(m) === 'Warrior', 'Equip to which face-up Warrior?')] },
  // "+1000 ATK, -1000 DEF. During each of your Standby Phases, pay 1000 LP or destroy this card."
  'Mask of Brutality': { cont: eqBonus(1000, -1000), effs: [equipAct(),
    { type: 'trig', loc: 'st', mand: true, label: 'Pay 1000 LP or destroy it', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && !!c.equipTo,
      res: function* (g, c, p) { if (!onField(c)) return; if (g.p[p].lp > 1000 && (yield* yn(g, p, 'Pay 1000 LP to keep Mask of Brutality?'))) pay(g, p, 1000); else destroy(g, [c], { rule: true }); } }] },
  // "The equipped monster gains 800 ATK/DEF for each face-up monster you control" (you: this card's controller).
  'United We Stand': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 800 * monsOf(g, src.ctrl).filter(faceUp).length : 0, def: (g, src, m) => src.equipTo === m.u ? 800 * monsOf(g, src.ctrl).filter(faceUp).length : 0 },
    effs: [equipAct()] },

  /* ----- Spells ----- */
  // "Look at your opponent's hand. Select and discard 1 Spirit monster if Spirit monsters exist in their hand."
  'Fengsheng Mirror': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length > 0,
    res: function* (g, c, p) { const h = g.p[opp(p)].hand; log(g, `${PN(g, opp(p))}'s hand: ${h.map(name).join(', ') || 'no cards'}.`);
      const sp = h.filter(x => isMon(x) && /Spirit/.test(D(x).ab || '')); if (!sp.length) return;
      const [x] = yield* pick(g, p, 'Discard which Spirit monster?', sp, 1, 1, 'bad'); if (x) { move(g, x, 'gy', { reason: 'discard', by: p }); log(g, `${PN(g, opp(p))} discarded ${name(x)}.`); } } }] },

  /* ----- Traps ----- */
  // "When an opponent's monster declares an attack: Destroy the Attack Position monster your opponent controls with the highest ATK."
  'Widespread Ruin': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => !!g.aw && g.aw.a.ctrl !== p && monsOf(g, opp(p)).some(x => x.pos === 'atk'),
    res: function* (g, c, p) { const ms = monsOf(g, opp(p)).filter(x => x.pos === 'atk'); if (!ms.length) return;
      const top = Math.max(...ms.map(x => stat(g, x, 'atk'))); const tied = ms.filter(x => stat(g, x, 'atk') === top);
      const [t] = tied.length > 1 ? yield* pick(g, p, 'Destroy which of the tied monsters?', tied, 1, 1, 'bad') : tied; if (t) destroy(g, [t], { by: p, src: c }); } }] },
  // "Draw 2 cards and skip your next 2 Draw Phases."
  'Reckless Greed': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].deck.length >= 2,
    res: function* (g, c, p) { draw(g, p, 2); const first = g.turnNo + (g.tp === p ? 2 : 1), turns = [first, first + 2];
      addRule(g, (g2, a) => a.type === 'draw' && a.p === p && g2.phase === 'draw' && g2.tp === p && turns.includes(g2.turnNo), { end: turns[1] });
      log(g, `${PN(g, p)} skips the next 2 Draw Phases.`); } }] },
  // "Activate only when a card's effect that would inflict damage to you is activated. Your opponent takes the damage instead."
  // The link it answers must have damage in its text; while that link resolves, damage to you goes to the opponent.
  // PARTIAL: Ring of Destruction's damage to its target's controller is dealt directly (goat-1.js), so it can't be turned around.
  'Barrel Behind the Door': {
    cont: { loc: 'gy', dmg: (g, src, p, n, o) => { if (o.barrel || !o.src || !g.barrel) return; const b = g.barrel.find(x => x.by === src.u && x.p === p && x.u === o.src.u); if (!b) return;
      log(g, `Barrel Behind the Door turned the damage around.`); damage(g, opp(p), n, { ...o, barrel: true }); return 0; } },
    effs: [{ type: 'act',
      cond: (g, c, p, x) => { const t = x.top; return !!(t && !t.negated && t.c !== c && burnText(t.c)); },
      target: function* (g, c, p, L2) { L2.data.L = g.chain[g.chain.length - 1]; },
      res: function* (g, c, p, L2) { const T = L2.data.L; if (!T || T.negated) return; const res0 = T.eff.res, entry = { by: c.u, p, u: T.c.u };
        T.eff = { ...T.eff, res: function* (g2, c2, p2, L3) { (g2.barrel || (g2.barrel = [])).push(entry); try { yield* res0(g2, c2, p2, L3); } finally { g2.barrel = g2.barrel.filter(x => x !== entry); } } };
        log(g, `${PN(g, opp(p))} will take that damage instead.`); } }] },
  // "You take no battle damage from your opponent's monsters this turn. Your monsters cannot be destroyed by battle this turn."
  // The battle protection works from the GY (the card is there after it resolves) for the rest of the turn.
  'Waboku': { cont: { loc: 'gy', grant: (g, src, m, flag) => flag === 'noBattleDestroy' && m.zone === 'm' && g.p[m.ctrl].wabokuTurn === g.turnNo },
    effs: [{ type: 'act', res: function* (g, c, p) { g.p[p].noBattleDamage = g.turnNo; g.p[p].wabokuTurn = g.turnNo; g.seq++; log(g, `${PN(g, p)}'s monsters can't be destroyed by battle this turn, and ${PN(g, p)} takes no battle damage.`); } }] },
}, 'goat');
})();
