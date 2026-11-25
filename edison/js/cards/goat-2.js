/* Goat 2: the four tier B Goat decks (Burn, Lockdown Burn, Empty Jar, Reasoning Gate).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md), registered for Goat only (E.addScripts(obj, 'goat')).
 Written from each card's 2005 (summer Goat format) behavior; where today's text in goat/data/cards.js reads
 differently, the 2005 reading is used and noted. Cards these decks share with tier A are in goat-1.js. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, takeControl, setFaceDown, addCtr, ctr, addRule,
  tokens, equip, name, D, isMon, isSpell, isTrap, isExtraD, onField, faceUp, lv, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, nFreeM, shuffleDeck, log, PN, live, opp, emit, forbid, stat, evSummoned, battleKill } = L;

const named = (c, n) => D(c).n === n;
const flipUp = (g, c, pos) => { c.pos = pos; g.seq++; log(g, `${name(c)} was flipped face-up.`); emit(g, { type: 'flip', c, p: c.ctrl }); };
const isEffectMon = c => isMon(c) && (D(c).k === 'effect' || /Effect/.test(D(c).ab || ''));
const canNS = c => isMon(c) && !isExtraD(D(c)) && !['ritual', 'token'].includes(D(c).k) && !/Cannot be Normal Summoned/i.test(D(c).tx || '');
const noSSText = c => /Cannot be Special Summoned/i.test(D(c).tx || '');
function* discardAll(g, p) { const h = g.p[p].hand.slice(); for (const x of h) move(g, x, 'gy', { reason: 'discard' }); if (h.length) log(g, `${PN(g, p)} discarded ${h.length} card${h.length > 1 ? 's' : ''}.`); }
// Excavate from the top until a monster that can be Normal Summoned/Set; returns [monster or null, the other cards]
function excavate(g, p) { const deck = g.p[p].deck, out = []; for (let i = deck.length - 1; i >= 0; i--) { const x = deck[i]; if (canNS(x)) return [x, out]; out.push(x); } return [null, out]; }
const sendAll = (g, xs) => { for (const x of xs) if (x.zone === 'deck') move(g, x, 'gy', { reason: 'effect' }); };
// Spell Counter watchers: a counter each time a Spell resolves (seen as it leaves the Spell/Trap Zone for the GY), no chain link.
// PARTIAL: Continuous, Equip and Field Spells stay on the field after resolving, so they don't add a counter.
const spellCounter = (max) => ({ type: 'trig', on: (g, ev, c) => { if (ev.type === 'move' && ev.from === 'st' && ev.to === 'gy' && ev.reason === 'rule' && isSpell(ev.c) && !['Continuous', 'Equip', 'Field'].includes(D(ev.c).sub) && (!max || ctr(c, 'spell') < max)) { addCtr(g, c, 'spell', 1); log(g, `${name(c)} got a Spell Counter (${ctr(c, 'spell')}).`); } return false; }, res: function* () {} });

E.addScripts({
  /* ----- Burn ----- */
  // PARTIAL: negating a Spell that targets it while face-down isn't done (the engine has no "Spell activated" event or face-down
  // Quick Effects). Being attacked does switch it to Attack Position at the end of the Damage Step.
  'Big Shield Gardna': { effs: [{ type: 'trig', faceDownOk: true, on: (g, ev, c) => { if (ev.type === 'dsEnd' && ev.t === c && onField(c) && c.pos !== 'atk') { c.pos = 'atk'; g.seq++; log(g, 'Big Shield Gardna changed to Attack Position.'); } return false; }, res: function* () {} }] },
  // 2005: "FLIP: Destroy all monsters on the field. Both players pick up the top 5 cards of their Decks, Special Summon every
  // Level 4 or lower monster among them in face-up Attack or face-down Defense Position, and add the rest to the hand."
  'Cyber Jar': { effs: [{ type: 'trig', mand: true, faceDownOk: true, tags: { destroy: 1, ss: 1 }, label: 'Destroy all monsters', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) {
      destroy(g, fieldMons(g), { by: p });
      for (const q of [p, opp(p)]) {
        const top = g.p[q].deck.slice(-5).reverse(); if (!top.length) continue;
        log(g, `${PN(g, q)} revealed ${top.map(name).join(', ')}.`);
        for (const x of top) {
          if (isMon(x) && lv(x) <= 4 && !['ritual', 'token'].includes(D(x).k) && !noSSText(x) && freeM(g, q) >= 0) {
            const i = yield* choose(g, q, `${name(x)}: which position?`, ['Face-up Attack Position', 'Face-down Defense Position']);
            if (ss(g, q, x, i ? 'set' : 'atk')) continue;
          }
          if (x.zone === 'deck') move(g, x, 'hand', { reason: 'effect' });
        }
      }
    } }] },
  'Des Koala': { effs: [{ type: 'trig', mand: true, faceDownOk: true, label: '400 damage per card in their hand', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
    res: function* (g, c, p) { damage(g, opp(p), 400 * g.p[opp(p)].hand.length, { src: c, srcP: p }); } }] },
  'Giant Germ': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: '500 damage, summon Giant Germs', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    res: function* (g, c, p) { damage(g, opp(p), 500, { src: c, srcP: p });
      const cs = g.p[p].deck.filter(x => named(x, 'Giant Germ')); const n = Math.min(cs.length, nFreeM(g, p)); if (!n) return;
      const xs = yield* pick(g, p, 'Special Summon any number of Giant Germ from your Deck (none is fine)', cs, 0, n, 'good');
      for (const x of xs) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },
  // 2005: flips every face-down Defense Position monster face-up (no Flip effects), then 500 damage for each Effect Monster on the field.
  'Ceasefire': { effs: [{ type: 'act', cond: g => fieldMons(g).some(x => x.pos === 'set' || (faceUp(x) && isEffectMon(x))),
    res: function* (g, c, p) { for (const x of fieldMons(g)) if (x.pos === 'set') { x.pos = 'def'; g.seq++; }
      log(g, 'All face-down monsters were turned face-up.'); const n = fieldMons(g).filter(isEffectMon).length; if (n) damage(g, opp(p), 500 * n, { src: c, srcP: p }); } }] },
  // 2005: "Change all monsters on your side of the field to face-up Defense Position." Face-down ones are flipped, so their Flip effects activate.
  'Desert Sunlight': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => x.pos !== 'def'),
    res: function* (g, c, p) { for (const x of monsOf(g, p)) { if (x.pos === 'set') flipUp(g, x, 'def'); else if (x.pos === 'atk') { x.pos = 'def'; g.seq++; } } } }] },
  'Just Desserts': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { damage(g, opp(p), 500 * monsOf(g, opp(p)).length, { src: c, srcP: p }); } }] },
  // The Tokens remember which Ojama Trio made them; that card (in the GY) deals the 300 when one is destroyed.
  // PARTIAL: if that Ojama Trio has left the GY, the 300 damage is missed.
  'Ojama Trio': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => nFreeM(g, opp(p)) >= 3,
    res: function* (g, c, p) { const ts = tokens(g, opp(p), { n: 'Ojama Token', a: 'LIGHT', r: 'Beast', lv: 2, atk: 0, def: 1000 }, 3, 'def', { noTribute: true }); for (const t of ts) t.flags.ojama = c.u; } },
    { type: 'trig', loc: 'gy', mand: true, label: '300 damage', on: (g, ev, c) => ev.type === 'move' && ev.destroyed && ev.wasField && ev.snap && ev.snap.flags && ev.snap.flags.ojama === c.u,
      res: function* (g, c, p, L2) { damage(g, L2.ev.prevCtrl, 300, { src: c, srcP: p }); } }] },
  'Secret Barrel': { effs: [{ type: 'act', cond: (g, c, p) => g.p[opp(p)].hand.length + fieldOf(g, opp(p)).length > 0,
    res: function* (g, c, p) { damage(g, opp(p), 200 * (g.p[opp(p)].hand.length + fieldOf(g, opp(p)).length), { src: c, srcP: p }); } }] },

  /* ----- Lockdown Burn ----- */
  // Summoned to the opponent's field by Tributing 2 of their monsters; its controller takes 1000 in each of their Standby Phases.
  'Lava Golem': {
    proc: { label: 'Special Summon to their field (Tribute 2 of their monsters)', cond: (g, c, p) => monsOf(g, opp(p)).length >= 2,
      cost: function* (g, c, p, grp) { const xs = yield* pick(g, p, 'Tribute 2 monsters your opponent controls', monsOf(g, opp(p)), 2, 2, 'bad');
        for (const x of xs) move(g, x, 'gy', { reason: 'tribute', by: p, group: grp }); log(g, `${PN(g, p)} Tributed 2 of ${PN(g, opp(p))}'s monsters.`);
        c.flags.lavaTo = opp(p); addRule(g, (g2, a) => (a.type === 'ns' || a.type === 'set') && a.p === p, { end: g.turnNo }); } },
    effs: [
      // hand it over as it lands (before the summon window), with no chain link
      { type: 'trig', on: (g, ev, c) => { if (ev.type === 'move' && ev.c === c && ev.to === 'm' && c.flags.lavaTo != null) { const to = c.flags.lavaTo; c.flags.lavaTo = null; if (c.ctrl !== to) takeControl(g, to, c, false); } return false; }, res: function* () {} },
      { type: 'trig', mand: true, label: 'Take 1000 damage', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
        res: function* (g, c, p) { if (onField(c)) damage(g, c.ctrl, 1000, { src: c, srcP: c.ctrl }); } }] },
  // PARTIAL: it can't turn itself face-down the turn it was summoned or changed position (the usual position-change limit).
  'Stealth Bird': { effs: [
    { type: 'ign', opt: true, label: 'Turn face-down', cond: (g, c) => c.turnIn !== g.turnNo && !c.posChanged,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { setFaceDown(g, c); c.posChanged = true; } } },
    { type: 'trig', mand: true, label: '1000 damage', on: (g, ev, c) => evSummoned(ev, c, ['flip']),
      res: function* (g, c, p) { damage(g, opp(p), 1000, { src: c, srcP: p }); } }] },
  // Stays on the field until the End Phase of the opponent's 3rd turn; flips their face-down monsters (Flip effects activate).
  'Swords of Revealing Light': { cont: { forbid: (g, src, a) => a.type === 'attack' && a.c.ctrl !== src.ctrl },
    effs: [{ type: 'act', after: (g, c, p, L2) => { L2.keep = true; },
      res: function* (g, c, p, L2) { L2.keep = true; for (const x of monsOf(g, opp(p))) if (x.pos === 'set') flipUp(g, x, 'def'); log(g, `${PN(g, opp(p))}'s monsters can't attack.`); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Count a turn', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp !== c.ctrl,
      res: function* (g, c, p) { if (!onField(c)) return; addCtr(g, c, 'swords', 1); if (ctr(c, 'swords') >= 3) destroy(g, [c], { rule: true }); } }] },
  'Wave-Motion Cannon': { effs: [
    { type: 'act', res: function* () {} },
    { type: 'trig', loc: 'st', on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && faceUp(c)) addCtr(g, c, 'wave', 1); return false; }, res: function* () {} },
    { type: 'ign', loc: 'st', label: 'Send it: 1000 damage per Standby Phase', cond: (g, c) => ctr(c, 'wave') > 0,
      cost: function* (g, c, p, L2) { L2.data.n = ctr(c, 'wave'); move(g, c, 'gy', { reason: 'cost' }); },
      res: function* (g, c, p, L2) { damage(g, opp(p), 1000 * L2.data.n, { src: c, srcP: p }); } }] },

  /* ----- Empty Jar ----- */
  'A Feather of the Phoenix': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c),
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Discard 1 card', g.p[p].hand.filter(x => x !== c), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which card from your GY to the top of your Deck?', g.p[p].gy, 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'deckTop', { reason: 'effect' }); log(g, `${name(t)} was put on top of the Deck.`); } } }] },
  'Book of Taiyou': { effs: [{ type: 'act', cond: g => fieldMons(g).some(x => x.pos === 'set'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Flip which face-down monster face-up?', fieldMons(g).filter(x => x.pos === 'set'), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.pos === 'set') flipUp(g, t, 'atk'); } }] },
  // 2005: pay 800, revive in Attack Position and equip; when this card is destroyed, destroy the monster (a bounce doesn't).
  'Premature Burial': { effs: [
    { type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.p[p].lp > 800 && freeM(g, p) >= 0 && g.p[p].gy.some(isMon),
      cost: function* (g, c, p) { pay(g, p, 800); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which monster from your GY?', g.p[p].gy.filter(isMon), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy' && onField(c) && ss(g, p, t, 'atk')) { equip(g, c, t); c.flags.pb = t.u; } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy the equipped monster', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.snap && ev.snap.flags && ev.snap.flags.pb,
      res: function* (g, c, p, L2) { const t = fieldMons(g).find(x => x.u === L2.ev.snap.flags.pb); if (t) destroy(g, [t], { by: p }); } }] },
  // Chained to your own Normal Spell: discard your whole hand; this card's effect becomes that Spell's, with its own targets.
  'Serial Spell': { effs: [{ type: 'act',
    cond: (g, c, p, x) => { const t = x.top; return !!(t && t.p === p && t.cardAct && isSpell(t.c) && D(t.c).sub === 'Normal' && !t.negated && t.c !== c) && g.p[p].hand.some(y => y !== c); },
    cost: function* (g, c, p, L2) { L2.data.orig = g.chain[g.chain.length - 1]; yield* discardAll(g, p); },
    target: function* (g, c, p, L2) { const o = L2.data.orig; if (o.eff.target) yield* o.eff.target(g, c, p, L2); },
    res: function* (g, c, p, L2) { const o = L2.data.orig; log(g, `Serial Spell copies ${name(o.c)}.`); yield* o.eff.res(g, c, p, L2); } }] },
  'Reload': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(x => x !== c),
    res: function* (g, c, p) { const h = g.p[p].hand.slice(); for (const x of h) move(g, x, 'deck', { reason: 'effect' }); shuffleDeck(g, p); log(g, `${PN(g, p)} shuffled ${h.length} card${h.length > 1 ? 's' : ''} into the Deck.`); draw(g, p, Math.min(h.length, g.p[p].deck.length)); } }] },
  'The Shallow Grave': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => [p, opp(p)].some(q => g.p[q].gy.some(isMon)),
    res: function* (g, c, p) { for (const q of [p, opp(p)]) { const ms = g.p[q].gy.filter(isMon); if (!ms.length || freeM(g, q) < 0) continue; const [x] = yield* pick(g, q, 'Special Summon which monster from your GY face-down?', ms, 1, 1, 'good'); if (x) ss(g, q, x, 'set'); } } }] },
  'Spell Reproduction': { effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.filter(x => x !== c && isSpell(x)).length >= 2,
    cost: function* (g, c, p) { const xs = yield* pick(g, p, 'Send 2 Spells from your hand to the GY', g.p[p].hand.filter(x => x !== c && isSpell(x)), 2, 2, 'cost'); for (const x of xs) move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${xs.map(name).join(' and ')} to the GY.`); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Spell from your GY to your hand?', g.p[p].gy.filter(isSpell), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } }] },

  /* ----- Reasoning Gate ----- */
  'Blowback Dragon': { effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Toss 3 coins: destroy a card', cond: (g, c, p) => fieldOf(g, opp(p)).length > 0,
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Target which card?', fieldOf(g, opp(p)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const coins = [0, 1, 2].map(() => g.rnd() < 0.5); const h = coins.filter(Boolean).length; log(g, `Coins: ${coins.map(x => x ? 'heads' : 'tails').join(', ')}.`); if (h >= 2) destroy(g, live(L2), { by: p }); } }] },
  // 2005: "When this card is Normal or Special Summoned, you can add 1 Spell from your GY to your hand during the End Phase.
  // When this card destroys a monster by battle, remove that monster from play. If this card would leave the field, remove it from play instead."
  'Dark Magician of Chaos': { effs: [
    { type: 'trig', label: 'Add a Spell from the GY', on: (g, ev, c) => { if (evSummoned(ev, c) && ev.how !== 'flip') { c.flags.dmoc = g.turnNo; c.flags.banishOnLeave = true; } if (ev.type === 'flip' && ev.c === c) c.flags.banishOnLeave = true; return ev.type === 'phase' && ev.ph === 'end' && c.flags.dmoc === g.turnNo; },
      cond: (g, c, p) => g.p[p].gy.some(isSpell),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Add which Spell from your GY to your hand?', g.p[p].gy.filter(isSpell), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'gy') { move(g, t, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(t)} to the hand.`); } } },
    { type: 'trig', mand: true, label: 'Banish the destroyed monster', on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
      res: function* (g, c, p, L2) { const t = L2.ev.c; if (t.zone === 'gy') { move(g, t, 'ban', { reason: 'effect', by: p }); log(g, `${name(t)} was banished.`); } } }] },
  // PARTIAL: Trap activations (cards and effects) are blocked; the static effects of Continuous Traps already face-up
  // (Gravity Bind's attack lock) keep applying, since the engine can't negate a Spell/Trap's static effect yet.
  'Jinzo': { cont: { forbid: (g, src, a) => a.type === 'activate' && isTrap(a.c) } },
  'Magical Marionette': { self: { atk: (g, c) => 200 * ctr(c, 'spell') },
    effs: [spellCounter(0),
      { type: 'ign', tags: { destroy: 1 }, label: 'Remove 2 Spell Counters: destroy a monster', cond: (g, c) => ctr(c, 'spell') >= 2 && fieldMons(g).length > 0,
        cost: function* (g, c) { addCtr(g, c, 'spell', -2); log(g, 'Magical Marionette removed 2 Spell Counters.'); },
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', fieldMons(g), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  'Sacred Crane': { effs: [{ type: 'trig', mand: true, label: 'Draw 1 card', on: (g, ev, c) => evSummoned(ev, c, ['special', 'fusion', 'ritual']),
    res: function* (g, c, p) { if (g.p[p].deck.length) draw(g, p, 1); } }] },
  // 2005: pay 2000; both players Special Summon as many of their banished monsters as they can.
  'Dimension Fusion': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => g.p[p].lp > 2000 && g.p[p].ban.some(isMon) && freeM(g, p) >= 0,
    cost: function* (g, c, p) { pay(g, p, 2000); },
    res: function* (g, c, p) { for (const q of [p, opp(p)]) { const ms = g.p[q].ban.filter(x => isMon(x) && !forbid(g, { type: 'ss', c: x, p: q, how: 'special' })); const n = Math.min(ms.length, nFreeM(g, q)); if (!n) continue;
      const xs = n < ms.length ? yield* pick(g, q, `Special Summon ${n} of your banished monsters`, ms, n, n, 'good') : ms; for (const x of xs) ss(g, q, x, 'atk'); } } }] },
  'Monster Gate': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => monsOf(g, p).length > 0,
    cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Tribute 1 monster', monsOf(g, p), 1, 1, 'cost'); move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${x.pos === 'set' ? 'a face-down monster' : name(x)}.`); },
    res: function* (g, c, p) { const [m, rest] = excavate(g, p); log(g, `${PN(g, p)} excavated ${rest.length + (m ? 1 : 0)} card${rest.length + (m ? 1 : 0) === 1 ? '' : 's'}.`);
      sendAll(g, rest); if (m && !ss(g, p, m, 'atk') && m.zone === 'deck') move(g, m, 'gy', { reason: 'effect' }); } }] },
  'Reasoning': { effs: [{ type: 'act', tags: { ss: 1 }, cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.length > 0,
    res: function* (g, c, p) { const o = opp(p); const i = yield* choose(g, o, 'Reasoning: declare a Level', Array.from({ length: 12 }, (_, k) => 'Level ' + (k + 1))); const lvD = i + 1; log(g, `${PN(g, o)} declared Level ${lvD}.`);
      const [m, rest] = excavate(g, p); sendAll(g, rest);
      if (!m) return; if (lv(m) === lvD) { move(g, m, 'gy', { reason: 'effect' }); log(g, `${name(m)} was Level ${lvD}, so it went to the GY.`); return; }
      if (!ss(g, p, m, 'atk') && m.zone === 'deck') move(g, m, 'gy', { reason: 'effect' }); } }] },
}, 'goat');
})();
