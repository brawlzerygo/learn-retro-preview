/* Classic 3: Duelist Kingdom and Battle City effect monsters (build/classic_batch_3.json).
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md), registered for Goat only (E.addScripts(obj, 'goat')),
 written from each card's text in the batch file and played by Goat-era rules. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, move, destroy, ss, damage, gain, pay, search, takeControl, addMod, addCtr, ctr, addRule, tokens,
  name, D, isMon, isTrap, onField, faceUp, attr, race, lv, monsOf, allField, fieldMons, freeM, freeST, nFreeM,
  shuffleDeck, log, PN, live, opp, oppFaceUp, battleKill, fromFieldToGY, emit, forbid, stat } = L;

const named = (c, n) => D(c).n.toLowerCase() === n.toLowerCase();
const atkOf = (g, c) => stat(g, c, 'atk');
// "Cannot declare an attack unless you Tribute 1 monster" (Panther Warrior, Insect Queen).
// PARTIAL: the engine has no attack cost that can prompt, so the Tribute is a mandatory trigger at the attack declaration
// (it uses a chain link); the monster can't attack while you control no other monster to Tribute.
const tributeToAttack = {
  self: { cantAttack: (g, c) => !monsOf(g, c.ctrl).some(x => x !== c) },
  eff: { type: 'trig', mand: true, label: 'Tribute 1 monster to attack', on: (g, ev, c) => ev.type === 'attack' && ev.a === c,
    cost: function* (g, c, p) {
      const cs = monsOf(g, p).filter(x => x !== c); if (!cs.length) return;
      const [x] = yield* pick(g, p, `Tribute 1 monster to attack with ${name(c)}`, cs, 1, 1, 'cost');
      if (x) { const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${nm} to attack.`); }
    },
    res: function* () {} },
};
// a monster in the GY that "must first be Special Summoned" its own way: c.nomiOk is set by that summon (a card property, not a flag, so it lasts)
const nomiGY = { loc: 'gy', forbid: (g, src, a) => a.type === 'ss' && a.c === src && !src.nomiOk };
// "after damage calculation: return the attacking monster to the hand" (Kelbek, Wall of Illusion). It still happens if this card was destroyed by that battle.
const bounceAttacker = { type: 'trig', loc: 'any', mand: true, label: 'Return the attacker to the hand',
  on: (g, ev, c) => ev.type === 'dsEnd' && ev.t === c && ev.a && ev.a.ctrl !== (onField(c) ? c.ctrl : c.owner),
  res: function* (g, c, p, L2) { const a = L2.ev.a; if (a && onField(a) && a.zone === 'm') { const n = name(a); move(g, a, 'hand', { reason: 'effect', by: p }); log(g, `${n} returned to the hand.`); } } };
const umiOn = g => [g.p[0].fz, g.p[1].fz].some(f => f && faceUp(f) && (named(f, 'Umi') || named(f, 'A Legendary Ocean')));
const MAGNETS = ['Alpha The Magnet Warrior', 'Beta The Magnet Warrior', 'Gamma the Magnet Warrior'];

E.addScripts({
  'Dark Magician Girl': { self: { atk: (g, c) => 300 * [...g.p[0].gy, ...g.p[1].gy].filter(x => named(x, 'Dark Magician') || named(x, 'Magician of Black Chaos')).length } },

  'Dark Necrofear': {
    proc: { label: 'Special Summon (banish 3 Fiends from your GY)',
      cond: (g, c, p) => c.zone === 'hand' && g.p[p].gy.filter(x => isMon(x) && race(x) === 'Fiend').length >= 3,
      cost: function* (g, c, p, grp) {
        const xs = yield* pick(g, p, 'Banish 3 Fiend monsters from your GY', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Fiend'), 3, 3, 'cost');
        for (const x of xs) move(g, x, 'ban', { reason: 'cost', group: grp });
        log(g, `${PN(g, p)} banished ${xs.map(name).join(', ')}.`); c.nomiOk = true;
      } },
    cont: nomiGY,
    effs: [
      { type: 'trig', loc: 'gy', mand: true, label: 'Equip to and take control of a monster',
        on: (g, ev, c) => {
          if (ev.type === 'move' && ev.c === c && ev.from === 'm' && ev.to === 'gy' && ev.destroyed && ev.prevCtrl === c.owner) {
            const byOpp = ev.battle ? ev.killer && ev.killer.ctrl !== c.owner : ev.by != null && ev.by !== c.owner;
            if (byOpp) c.flags.necro = g.turnNo;
          }
          return ev.type === 'phase' && ev.ph === 'end' && c.flags.necro === g.turnNo;
        },
        cond: (g, c, p) => oppFaceUp(g, p).length > 0 && freeST(g, p) >= 0 && freeM(g, p) >= 0,
        target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Dark Necrofear to which of their monsters?', oppFaceUp(g, p), 1, 1, 'bad'); },
        res: function* (g, c, p, L2) {
          c.flags.necro = null;
          const t = live(L2)[0]; if (!t || !faceUp(t) || t.ctrl === p || c.zone !== 'gy' || freeST(g, p) < 0 || freeM(g, p) < 0) return;
          const from = t.ctrl;
          move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p });
          c.equipTo = t.u; c.flags.necroEq = { u: t.u, from }; c.flags.negated = true;
          log(g, `Dark Necrofear was equipped to ${name(t)}.`);
          takeControl(g, p, t, false);
        } },
      { type: 'trig', loc: 'any', mand: true, label: 'Control returns',
        on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.from === 'st' && ev.snap && ev.snap.flags && ev.snap.flags.necroEq,
        res: function* (g, c, p, L2) { const s = L2.ev.snap.flags.necroEq; const t = fieldMons(g).find(x => x.u === s.u); if (!t || t.ctrl === s.from) return;
          if (freeM(g, s.from) >= 0) takeControl(g, s.from, t, false); else move(g, t, 'gy', { reason: 'rule' }); } }] },

  'Dark Zebra': { effs: [{ type: 'trig', mand: true, label: 'Change to Defense Position',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl && c.pos === 'atk' && monsOf(g, c.ctrl).length === 1,
    res: function* (g, c) { if (!onField(c) || c.pos !== 'atk' || monsOf(g, c.ctrl).length !== 1) return; c.pos = 'def'; c.posChanged = true; g.seq++; log(g, `${name(c)} changed to Defense Position.`); } }] },

  'Dragon Seeker': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a face-up Dragon',
    on: (g, ev, c) => L.evSummoned(ev, c, ['normal', 'tribute', 'flip']),
    cond: g => fieldMons(g).some(x => faceUp(x) && race(x) === 'Dragon'),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up Dragon?', fieldMons(g).filter(x => faceUp(x) && race(x) === 'Dragon'), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && race(t) === 'Dragon') destroy(g, [t], { by: p, src: c }); } }] },

  'Drillago': { self: { directAttack: (g, c) => { const f = [...monsOf(g, opp(c.ctrl)), ...L.stOf(g, opp(c.ctrl))]; return f.length > 0 && f.every(x => x.zone === 'm' && faceUp(x) && atkOf(g, x) >= 1600); } } },

  'Flying Kamakiri #1': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Summon a WIND from the Deck',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].deck.some(x => isMon(x) && attr(x) === 'WIND' && L.baseAtk(x) <= 1500),
    res: function* (g, c, p) { if (freeM(g, p) < 0) return; const cs = g.p[p].deck.filter(x => isMon(x) && attr(x) === 'WIND' && L.baseAtk(x) <= 1500 && D(x).k !== 'ritual');
      const [x] = yield* pick(g, p, 'Special Summon a WIND monster with 1500 or less ATK from your Deck', cs, 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); shuffleDeck(g, p); } }] },

  'Gernia': { effs: [{ type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Special Summon itself',
    on: (g, ev, c) => {
      if (ev.type === 'move' && ev.c === c && ev.from === 'm' && ev.to === 'gy' && ev.destroyed && !ev.battle && ev.snap && ev.snap.faceUp && ev.prevCtrl === c.owner && ev.by != null && ev.by !== c.owner) c.flags.gernia = g.turnNo;
      if (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner && c.flags.gernia != null && g.turnNo > c.flags.gernia) { c.flags.gernia = null; return true; }
      return false;
    },
    res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c, 'atk'); } }] },

  'Hannibal Necromancer': { effs: [
    { type: 'trig', mand: true, label: 'Place a Spell Counter', on: (g, ev, c) => L.evSummoned(ev, c, ['normal', 'tribute']),
      res: function* (g, c) { if (onField(c) && ctr(c, 'spell') < 1) { addCtr(g, c, 'spell', 1); log(g, `${name(c)} got a Spell Counter.`); } } },
    { type: 'ign', tags: { destroy: 1 }, label: 'Remove a counter: destroy a Trap',
      cond: (g, c) => ctr(c, 'spell') >= 1 && allField(g).some(x => x.zone === 'st' && isTrap(x) && faceUp(x)),
      cost: function* (g, c) { addCtr(g, c, 'spell', -1); log(g, `${name(c)} removed its Spell Counter.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up Trap?', allField(g).filter(x => x.zone === 'st' && isTrap(x) && faceUp(x)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p, src: c }); } }] },

  'Hayabusa Knight': { self: { maxAttacks: () => 2 } },

  'Holding Arms': {
    self: {
      noBattleDestroy: (g, c) => !!holdTarget(g, c),
      noEffectDestroy: (g, c) => !!holdTarget(g, c),
    },
    cont: {
      forbid: (g, src, a) => a.type === 'attack' && a.c && a.c.u === src.flags.hold && faceUp(a.c),
      negates: (g, src, c) => c.u === src.flags.hold && c.zone === 'm' && faceUp(c),
    },
    effs: [{ type: 'trig', mand: true, label: 'Hold a monster',
      on: (g, ev, c) => ev.type === 'summon' && ev.cs.includes(c) && ev.how !== 'flip',
      cond: (g, c, p) => oppFaceUp(g, p).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Hold which of their face-up monsters?', oppFaceUp(g, p), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t) || !onField(c) || !faceUp(c)) return; c.flags.hold = t.u; log(g, `${name(t)} can't attack and its effects are negated.`); } }] },

  'Holding Legs': { effs: [
    { type: 'trig', mand: true, label: 'Return Set Spells and Traps', on: (g, ev, c) => ev.type === 'summon' && ev.cs.includes(c),
      cond: g => allField(g).some(x => (x.zone === 'st' || x.zone === 'fz') && x.pos === 'set'),
      res: function* (g) { const xs = allField(g).filter(x => (x.zone === 'st' || x.zone === 'fz') && x.pos === 'set'); for (const x of xs) move(g, x, 'hand', { reason: 'effect' }); if (xs.length) log(g, `${xs.length} Set card${xs.length > 1 ? 's were' : ' was'} returned to the hand.`); } },
    { type: 'ign', loc: 'gy', label: 'Banish: lock a Set card',
      cond: (g, c, p) => L.stOf(g, opp(p)).some(x => x.pos === 'set'),
      cost: function* (g, c, p) { move(g, c, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished Holding Legs.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Which of their Set cards can’t be activated?', L.stOf(g, opp(p)).filter(x => x.pos === 'set'), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || t.pos !== 'set') return; const tin = t.turnIn;
        addRule(g, (g2, a) => a.type === 'activate' && a.c === t && onField(t) && t.turnIn === tin, { end: g.tp === p ? g.turnNo + 1 : g.turnNo });
        log(g, `That Set card can't be activated until the end of ${PN(g, opp(p))}'s next turn.`); } }] },

  'Insect Queen': {
    self: { ...tributeToAttack.self, atk: g => 200 * fieldMons(g).filter(x => faceUp(x) && race(x) === 'Insect').length },
    effs: [tributeToAttack.eff,
      { type: 'trig', mand: true, opt: true, label: 'Summon an Insect Monster Token',
        on: (g, ev, c) => {
          if (battleKill(ev, c) && ev.prevCtrl !== c.ctrl) c.flags.queenKill = g.turnNo;
          return ev.type === 'phase' && ev.ph === 'end' && c.flags.queenKill === g.turnNo;
        },
        cond: (g, c, p) => freeM(g, p) >= 0,
        res: function* (g, c, p) { tokens(g, p, { n: 'Insect Monster Token', a: 'EARTH', r: 'Insect', lv: 1, atk: 100, def: 100 }, 1, 'atk'); } }] },

  'Insect Soldiers of the Sky': { self: { atk: (g, c) => g.inDS && g.battle && g.battle.a === c && g.battle.t && faceUp(g.battle.t) && attr(g.battle.t) === 'WIND' ? 1000 : 0 } },

  'Kaiser Glider': {
    self: { noBattleDestroy: (g, c) => { const b = g.battle; if (!b || (b.a !== c && b.t !== c)) return false; const o = b.a === c ? b.t : b.a; return !!o && onField(o) && faceUp(o) && atkOf(g, o) === atkOf(g, c); } },
    effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Return a monster to the hand',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed && ev.to === 'gy',
      cond: g => fieldMons(g).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Return which monster to the hand?', fieldMons(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.zone === 'm') { const n = t.pos === 'set' ? 'A face-down monster' : name(t); move(g, t, 'hand', { reason: 'effect', by: p }); log(g, `${n} returned to the hand.`); } } }] },

  'Kelbek': { effs: [bounceAttacker] },

  'Keldo': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Shuffle 2 cards into their Deck',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
    cond: (g, c, p) => g.p[opp(p)].gy.length > 0,
    target: function* (g, c, p, L2) { const n = Math.min(2, g.p[opp(p)].gy.length); yield* tgt(g, p, L2, 'Shuffle which 2 cards from their GY into their Deck?', g.p[opp(p)].gy, n, n, 'bad'); },
    res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); for (const x of xs) move(g, x, 'deck', { reason: 'effect', by: p }); if (xs.length) log(g, `${xs.map(name).join(', ')} went back into ${PN(g, opp(p))}'s Deck.`); } }] },

  'Kiseitai': { effs: [
    { type: 'trig', mand: true, faceDownOk: true, label: 'Become an Equip Card',
      on: (g, ev, c) => ev.type === 'attack' && ev.t === c && c.pos === 'set' && ev.a.ctrl !== c.ctrl,
      res: function* (g, c, p, L2) { const a = L2.ev.a; if (c.zone !== 'm' || c.pos !== 'set' || !onField(a) || freeST(g, p) < 0) return;
        move(g, c, 'st', { ctrl: p, pos: 'up', reason: 'equip', by: p }); c.equipTo = a.u; /* not flagged negated: that stopped its Standby LP gain (2026-11-26 review) */
        log(g, `Kiseitai became an Equip Card equipped to ${name(a)}.`); L.negateAttack(g); } },
    { type: 'trig', loc: 'st', mand: true, label: 'Gain half its ATK',
      on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp !== c.ctrl && !!c.equipTo && fieldMons(g).some(x => x.u === c.equipTo),
      res: function* (g, c, p) { const m = fieldMons(g).find(x => x.u === c.equipTo); if (m) gain(g, p, Math.floor(atkOf(g, m) / 2)); } }] },

  'Leghul': { self: { directAttack: true } },

  'Legion the Fiend Jester': { effs: [
    // PARTIAL: the extra Tribute Summon is an Ignition effect here, so it uses a chain link and gets no summon negation window.
    { type: 'ign', opt: true, label: 'Extra Tribute Summon a Spellcaster',
      cond: (g, c, p) => !g.noSummon[p] && g.p[p].hand.some(x => legionOk(g, p, x)),
      res: function* (g, c, p) {
        const cs = g.p[p].hand.filter(x => legionOk(g, p, x)); if (!cs.length) return;
        const [m] = yield* pick(g, p, 'Tribute Summon which Spellcaster?', cs, 1, 1, 'good'); if (!m) return;
        const need = lv(m) >= 7 ? 2 : 1;
        const tribs = yield* pick(g, p, `Choose ${need} monster${need > 1 ? 's' : ''} to Tribute`, legionTribs(g, p), need, need, 'cost');
        if (tribs.length < need) return;
        const grp = g.group;
        for (const t of tribs) move(g, t, 'gy', { reason: 'tribute', by: p, group: grp, tributeFor: m.u });
        log(g, `${PN(g, p)} Tributed ${tribs.map(x => x.snapName || D(x).n).join(', ')}.`);
        if (freeM(g, p) < 0) return;
        move(g, m, 'm', { ctrl: p, pos: 'atk', reason: 'summon', group: grp }); m.summonType = 'tribute'; m.tributes = tribs.map(t => t.u); m.attacks = 0;
        log(g, `${PN(g, p)} Tribute Summoned ${name(m)}.`);
        const ev = emit(g, { type: 'summon', cs: [m], how: 'tribute', p, tribs }, grp);
        g.sw = { cs: [m], p, how: 'tribute', group: ev.group };
      } },
    { type: 'trig', loc: 'gy', opt: true, label: 'Add a Spellcaster Normal Monster',
      on: (g, ev, c) => fromFieldToGY(ev, c),
      cond: (g, c, p) => [...g.p[p].deck, ...g.p[p].gy].some(legionAdd),
      res: function* (g, c, p) {
        const noSearch = forbid(g, { type: 'search', p });
        const cs = [...(noSearch ? [] : g.p[p].deck), ...g.p[p].gy].filter(legionAdd); if (!cs.length) return;
        const [x] = yield* pick(g, p, 'Add which Spellcaster Normal Monster to your hand?', cs, 1, 1, 'good');
        if (x) { const fromDeck = x.zone === 'deck'; move(g, x, 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added ${name(x)} to the hand.`); if (fromDeck) shuffleDeck(g, p); } } }] },

  'Lord of D.': { cont: { grant: (g, src, c, flag) => flag === 'cantBeTargeted' && c.zone === 'm' && faceUp(c) && race(c) === 'Dragon' } },

  'Machine King': { self: { atk: g => 100 * fieldMons(g).filter(x => faceUp(x) && race(x) === 'Machine').length } },

  'Maha Vailo': { self: { atk: (g, c) => 500 * allField(g).filter(x => x.zone === 'st' && x.equipTo === c.u).length } },

  // ENGINE: a Trap can't be activated from the hand. PARTIAL: the effect Sets 1 Trap from your hand, and it can be activated this turn.
  // Original 2005 text: "When this card is destroyed and sent to the Graveyard, you can activate Trap Cards from your hand
  // during the turn it was destroyed." So: only when destroyed, any number of Traps, no once-per-turn (all later errata).
  'Makyura the Destructor': { effs: [{ type: 'trig', loc: 'gy', label: 'Ready Traps from the hand',
    on: (g, ev, c) => fromFieldToGY(ev, c) && ev.from === 'm' && !!ev.destroyed,
    cond: (g, c, p) => freeST(g, p) >= 0 && g.p[p].hand.some(isTrap),
    res: function* (g, c, p) { const n = 5 - g.p[p].st.filter(Boolean).length; if (n <= 0) return;
      const xs = yield* pick(g, p, 'Which Traps do you want to be able to activate this turn?', g.p[p].hand.filter(isTrap), 1, Math.min(n, g.p[p].hand.filter(isTrap).length), 'good');
      let k = 0; for (const x of xs) { if (freeST(g, p) < 0) break; move(g, x, 'st', { ctrl: p, pos: 'set', reason: 'set' }); x.turnIn = g.turnNo - 1; k++; }
      if (k) log(g, `${PN(g, p)} Set ${k === 1 ? 'a Trap' : k + ' Traps'} from the hand. They can be activated this turn.`); } }] },

  'Mudora': { self: { atk: (g, c) => 200 * g.p[c.ctrl].gy.filter(x => isMon(x) && race(x) === 'Fairy').length } },

  'Panther Warrior': { self: tributeToAttack.self, effs: [tributeToAttack.eff] },

  // PARTIAL: the last part ("all monsters your opponent controls become Insect-Type") isn't done.
  // ENGINE: no hook changes a monster's Type.
  'Parasite Paracide': { effs: [
    { type: 'trig', mand: true, faceDownOk: true, label: 'Shuffle into their Deck', on: (g, ev, c) => ev.type === 'flip' && ev.c === c,
      res: function* (g, c, p) {
        if (!onField(c)) return; const o = opp(p), own = c.owner;
        move(g, c, 'deck', { reason: 'effect', by: p });
        if (o !== own) { const a = g.p[own].deck, i = a.indexOf(c); if (i >= 0) a.splice(i, 1); g.p[o].deck.push(c); c.owner = o; c.paraFrom = own; }
        c.flags.para = true; shuffleDeck(g, o);
        log(g, `Parasite Paracide was shuffled face-up into ${PN(g, o)}'s Deck.`);
      } },
    { type: 'trig', loc: 'hand', mand: true, label: 'Infest the drawer',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.reason === 'draw' && c.flags.para,
      res: function* (g, c, p) {
        c.flags.para = false; if (c.zone !== 'hand') return;
        const back = c.paraFrom;
        if (ss(g, p, c, 'def') && back != null) { c.owner = back; c.paraFrom = null; }
        damage(g, p, 1000, { src: c, srcP: opp(p) });
      } }] },

  'Pinch Hopper': { effs: [{ type: 'trig', loc: 'gy', when: true, tags: { ss: 1 }, label: 'Summon an Insect from the hand',
    on: (g, ev, c) => fromFieldToGY(ev, c) && ev.prevCtrl === c.owner,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].hand.some(x => isMon(x) && race(x) === 'Insect' && D(x).k !== 'ritual'),
    res: function* (g, c, p) { if (freeM(g, p) < 0) return; const [x] = yield* pick(g, p, 'Special Summon which Insect from your hand?', g.p[p].hand.filter(x => isMon(x) && race(x) === 'Insect' && D(x).k !== 'ritual'), 1, 1, 'good'); if (x) ss(g, p, x, 'atk'); } }] },

  'Puppet Master': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Pay 2000: revive 2 Fiends',
    on: (g, ev, c) => L.evSummoned(ev, c, ['tribute']),
    cond: (g, c, p) => g.p[p].lp > 2000 && nFreeM(g, p) >= 2 && g.p[p].gy.filter(x => isMon(x) && race(x) === 'Fiend').length >= 2,
    cost: function* (g, c, p) { pay(g, p, 2000); },
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which 2 Fiends from your GY?', g.p[p].gy.filter(x => isMon(x) && race(x) === 'Fiend'), 2, 2, 'good'); },
    res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); const done = [];
      for (const x of xs) if (ss(g, p, x, 'atk')) done.push(x);
      if (done.length) addRule(g, (g2, a) => a.type === 'attack' && done.includes(a.c), { end: g.turnNo }); } }] },

  'Revival Jam': { effs: [
    { type: 'trig', loc: 'gy', when: true, label: 'Pay 1000: revive next Standby Phase',
      on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.battle && ev.destroyed && ev.to === 'gy',
      cond: (g, c, p) => g.p[p].lp > 1000,
      cost: function* (g, c, p) { pay(g, p, 1000); },
      res: function* (g, c, p) { if (c.zone === 'gy') { c.flags.jamAt = g.turnNo; log(g, 'Revival Jam will return in the next Standby Phase.'); } } },
    { type: 'trig', loc: 'gy', mand: true, tags: { ss: 1 }, label: 'Revival Jam returns',
      on: (g, ev, c) => { if (ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.owner && c.flags.jamAt != null && g.turnNo > c.flags.jamAt) { c.flags.jamAt = null; return true; } return false; },
      res: function* (g, c, p) { if (c.zone === 'gy') ss(g, p, c, 'def'); } }] },

  'Rocket Warrior': {
    self: {
      noBattleDestroy: (g, c) => g.phase === 'battle' && g.tp === c.ctrl,
      noBattleDamage: (g, c) => g.phase === 'battle' && g.tp === c.ctrl,
    },
    effs: [{ type: 'trig', mand: true, label: 'Target loses 500 ATK', on: (g, ev, c) => ev.type === 'afterCalc' && ev.a === c && !!ev.t,
      res: function* (g, c, p, L2) { const t = L2.ev.t; if (t && onField(t) && faceUp(t) && t.zone === 'm') { addMod(g, t, { atk: -500, end: true }); log(g, `${name(t)} lost 500 ATK.`); } } }] },

  'Skull-Mark Ladybug': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Gain 1000 LP',
    on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.to === 'gy',
    res: function* (g, c, p) { gain(g, p, 1000); } }] },

  'Stone Statue of the Aztecs': { cont: { dmg: (g, src, p, n, o) => o && o.battle && g.battle && g.battle.t === src && g.battle.a && g.battle.a.ctrl === p && p !== src.ctrl ? n * 2 : n } },

  'The Fiend Megacyber': { proc: { label: 'Special Summon (they control 2 more monsters)', cond: (g, c, p) => monsOf(g, opp(p)).length >= monsOf(g, p).length + 2 } },

  'The Legendary Fisherman': { self: { unaffectedSpells: g => umiOn(g), noAttackTarget: g => umiOn(g) } }, // PARTIAL: "unaffected by Spells" covers destruction only (the engine's unaffectedSpells flag)

  'The Unfriendly Amazon': { effs: [{ type: 'trig', mand: true, label: 'Tribute 1 monster or be destroyed',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    res: function* (g, c, p) {
      if (!onField(c)) return;
      const cs = monsOf(g, p).filter(x => x !== c);
      if (cs.length && (yield* yn(g, p, 'Tribute 1 other monster to keep The Unfriendly Amazon?'))) {
        const [x] = yield* pick(g, p, 'Tribute which monster?', cs, 1, 1, 'cost');
        if (x) { const nm = x.pos === 'set' ? 'a face-down monster' : name(x); move(g, x, 'gy', { reason: 'tribute', by: p }); log(g, `${PN(g, p)} Tributed ${nm} for The Unfriendly Amazon.`); return; }
      }
      destroy(g, [c], { rule: true });
    } }] },

  'Valkyrion the Magna Warrior': {
    proc: { label: 'Special Summon (Tribute Alpha, Beta and Gamma)',
      cond: (g, c, p) => c.zone === 'hand' && MAGNETS.every(n => [...g.p[p].hand, ...monsOf(g, p)].some(x => named(x, n))),
      cost: function* (g, c, p, grp) {
        const xs = [];
        for (const n of MAGNETS) { const [x] = yield* pick(g, p, `Tribute ${n}`, [...g.p[p].hand, ...monsOf(g, p)].filter(x => named(x, n)), 1, 1, 'cost'); if (x) xs.push(x); }
        for (const x of xs) move(g, x, 'gy', { reason: 'tribute', by: p, group: grp });
        log(g, `${PN(g, p)} Tributed ${xs.map(x => D(x).n).join(', ')}.`); c.nomiOk = true;
      } },
    cont: nomiGY,
    effs: [{ type: 'ign', tags: { ss: 1 }, label: 'Tribute: summon Alpha, Beta and Gamma',
      cond: (g, c, p) => nFreeM(g, p) >= 2 && MAGNETS.every(n => g.p[p].gy.some(x => named(x, n))),
      cost: function* (g, c, p) { move(g, c, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed Valkyrion the Magna Warrior.`); },
      target: function* (g, c, p, L2) { const ts = []; for (const n of MAGNETS) { const [x] = yield* pick(g, p, `Target ${n} in your GY`, g.p[p].gy.filter(x => named(x, n)), 1, 1, 'good'); if (x) ts.push(x); } L2.t = ts; },
      res: function* (g, c, p, L2) { const xs = L2.t.filter(x => x.zone === 'gy'); if (xs.length > nFreeM(g, p)) return; for (const x of xs) ss(g, p, x, 'atk'); } }] },

  'Wall of Illusion': { effs: [bounceAttacker] },

  'Zolga': { effs: [{ type: 'trig', loc: 'any', mand: true, label: 'Owner gains 2000 LP',
    on: (g, ev, c) => ev.type === 'summon' && ev.how === 'tribute' && Array.isArray(ev.tribs) && ev.tribs.includes(c),
    res: function* (g, c) { gain(g, c.owner, 2000); } }] },
}, 'goat');

function holdTarget(g, c) { const u = c.flags.hold; if (!u) return null; return fieldMons(g).find(x => x.u === u && faceUp(x)) || null; }
function legionTribs(g, p) { return monsOf(g, p).filter(x => D(x).n !== 'Sheep Token' && !x.flags.noTribute); }
function legionOk(g, p, x) {
  if (!isMon(x) || race(x) !== 'Spellcaster' || lv(x) < 5 || ['ritual', 'fusion', 'synchro', 'token'].includes(D(x).k)) return false;
  if (/Cannot be Normal Summoned/i.test(D(x).tx || '')) return false;
  if (forbid(g, { type: 'ns', c: x, p })) return false;
  return legionTribs(g, p).length >= (lv(x) >= 7 ? 2 : 1);
}
function legionAdd(x) { return D(x).k === 'normal' && race(x) === 'Spellcaster'; }
})();
