/* Full pool batch 07: Dragon support, Element monsters, Elemental HEROes and the Neos Fusions, Emissaries.
 Card scripts for js/engine.js (see build/CARD_SCRIPTS.md, "Full pool"). Shared scripts (Edison text) unless noted. */
(function () {
'use strict';
const E = window.EdisonEngine, L = E.lib;
const { pick, tgt, yn, choose, move, destroy, ss, draw, damage, gain, pay, mill, search, takeControl, setFaceDown, negate, addMod,
  equip, equippedTo, link, addCtr, ctr, negateAttack, endBattle, addRule, token, tokens, fusionSummon, canFusion, ritualSummon, canRitual,
  name, D, isMon, isST, isSpell, isTrap, onField, faceUp, attr, race, lv, baseAtk, monsOf, stOf, fieldOf, allField, fieldMons,
  freeM, freeST, nFreeM, allCards, shuffleDeck, log, PN, has, live, opp, oppFaceUp, stOnField, spellTrapAct, evSummoned,
  fromFieldToGY, battleKill, isGemini } = L;
const atk = L.atk, def = L.def, forbid = L.forbid, negd = L.negd, isEHERO = L.isEHERO;

/* ---------- shared helpers ---------- */
const nm = x => D(x).n;
const is = n => x => nm(x) === n;
const named = (c, n) => D(c).n === n;
const ATT4 = ['WIND', 'WATER', 'FIRE', 'EARTH'];
// Doriado and Electrum are also WIND, WATER, FIRE and EARTH while face-up.
// ENGINE: attr() has no override hook, so only the cards in this file see the extra Attributes.
const attrsOf = (g, c) => { const a = [attr(c)]; if (onField(c) && faceUp(c) && ['Elemental Mistress Doriado', 'Elemental HERO Electrum'].includes(nm(c)) && !negd(g, c)) a.push(...ATT4); return a; };
const attrOn = (g, a) => fieldMons(g).some(x => faceUp(x) && attrsOf(g, x).includes(a));
// Dragonic Attack makes the equipped monster a Dragon. ENGINE: race() has no override, so only this file's Dragon checks see it.
const isDragon = (g, c) => race(c) === 'Dragon' || (onField(c) && allField(g).some(s => nm(s) === 'Dragonic Attack' && faceUp(s) && s.equipTo === c.u));
const ehMon = x => isMon(x) && /^Elemental HERO/.test(nm(x));
const toDef = (g, c) => { if (!onField(c) || c.zone !== 'm' || c.pos !== 'atk') return; c.pos = 'def'; g.seq++; log(g, `${name(c)} was changed to Defense Position.`); };
const foeOf = (g, c) => (g.battle ? (g.battle.a === c ? g.battle.t : g.battle.t === c ? g.battle.a : null) : null);
const flip = (label, more) => ({ type: 'trig', mand: true, faceDownOk: true, label, on: (g, ev, c) => ev.type === 'flip' && ev.c === c, ...more });
function* discard1(g, p, text) { const [x] = yield* pick(g, p, text || 'Discard 1 card', g.p[p].hand, 1, 1, 'cost'); if (x) { move(g, x, 'gy', { reason: 'discard' }); log(g, `${PN(g, p)} discarded ${name(x)}.`); } return x; }
function randomHandKill(g, p) { const h = g.p[opp(p)].hand; if (!h.length) return; const x = h[Math.floor(g.rnd() * h.length)]; move(g, x, 'gy', { reason: 'effect', destroyed: true, by: p }); log(g, `${name(x)} in ${PN(g, opp(p))}'s hand was destroyed at random.`); }
const canSS = (g, p, x) => !forbid(g, { type: 'ss', c: x, p, how: 'special' });

/* Contact Fusions (the Neos Fusions): shuffle the named face-up monsters you control into the Deck. */
function contactSets(g, p, preds) {
  const pool = monsOf(g, p).filter(faceUp), out = [];
  const rec = (i, used) => { if (out.length > 6) return; if (i === preds.length) { out.push(used.slice()); return; } for (const x of pool) if (!used.includes(x) && preds[i](x)) { used.push(x); rec(i + 1, used); used.pop(); } };
  rec(0, []);
  const seen = new Set(); return out.filter(m => { const k = m.map(x => x.u).sort().join(','); if (seen.has(k)) return false; seen.add(k); return true; });
}
function contactProc(names) {
  const preds = names.map(is);
  return { extra: true, label: `Special Summon (shuffle ${names.map(n => n.replace(/^(Elemental HERO|Neo-Spacian) /, '')).join(' + ')})`,
    cond: (g, c, p) => contactSets(g, p, preds).length > 0,
    cost: function* (g, c, p, grp) {
      const cs = contactSets(g, p, preds); let mats = cs[0];
      if (cs.length > 1) { const i = yield* choose(g, p, 'Shuffle which monsters into the Deck?', cs.map(m => m.map(nm).join(' + '))); mats = cs[i]; }
      for (const m of mats) move(g, m, 'deck', { reason: 'fusion', group: grp });
      log(g, `${PN(g, p)} shuffled ${mats.map(nm).join(' + ')} into the Deck.`);
      c.flags.f07contact = true;
    } };
}
const NEOS = 'Elemental HERO Neos';
// The Neos Fusions don't use Polymerization: their tx recipe would let fusionSummon() use them, so they get materials nothing matches.
// Flame Wingman, Shining Flare Wingman and Steam Healer keep explicit mats: their Edison text (ps) leaves out the materials.
const NO_POLY = [() => false, () => false];
const toExtra = (g, c) => { if (!onField(c)) return false; move(g, c, 'extra', { reason: 'effect' }); log(g, `${nm(c)} was shuffled into the Extra Deck.`); return true; };
const endShuffle = (more = {}) => ({ type: 'trig', mand: true, label: 'Shuffle into the Extra Deck', on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end',
  res: function* (g, c) { toExtra(g, c); }, ...more });
// "If this card destroys a monster by battle and sends it to the GY": the destroyed monster's original ATK.
const wingDamage = (label, heal) => ({ type: 'trig', mand: true, label, on: (g, ev, c) => battleKill(ev, c) && ev.prevCtrl !== c.ctrl,
  res: function* (g, c, p, L2) { const t = L2.ev.c; if (!isMon(t)) return; const n = baseAtk(t); if (heal) gain(g, p, n); else damage(g, opp(p), n, { src: c, srcP: p }); } });

/* ---------- summon rules and bookkeeping (one rule per duel, kept up by the HOOK effect on every card here) ---------- */
// Must be Fusion Summoned and Cannot be Special Summoned by other ways.
const FUS_ONLY = new Set(['Elemental HERO Darkbright', 'Elemental HERO Divine Neos', 'Elemental HERO Electrum', 'Elemental HERO Flame Wingman',
  'Elemental HERO Inferno', 'Elemental HERO Mudballman', 'Elemental HERO Necroid Shaman', 'Elemental HERO Phoenix Enforcer', 'Elemental HERO Plasma Vice',
  'Elemental HERO Rampart Blaster', 'Elemental HERO Shining Flare Wingman', 'Elemental HERO Shining Phoenix Enforcer', 'Elemental HERO Steam Healer',
  'Elemental HERO Tempest', 'Elemental HERO Thunder Giant', 'Elemental HERO Wild Wingman', 'Elemental HERO Wildedge']);
// "Must first be Special Summoned" by its own way: it can come back from the GY or banished pile once summoned properly.
const FIRST = new Set(['Dragon Master Knight', 'Elemental HERO Aqua Neos', 'Elemental HERO Chaos Neos', 'Elemental HERO Dark Neos', 'Elemental HERO Flare Neos',
  'Elemental HERO Glow Neos', 'Elemental HERO Magma Neos', 'Elemental HERO Marine Neos', 'Elemental HERO Storm Neos', 'Elemental Mistress Doriado']);
const ELEM_WIND = new Set(['Element Doom', 'Element Dragon', 'Element Magician']);
const ELEM_EARTH = new Set(['Element Doom', 'Element Saurus', 'Element Soldier']);
const ELEM_WATER = new Set(['Element Magician', 'Element Soldier', 'Element Valkyrie']);
function f07Rule(g, a) {
  if (a.type === 'ss') {
    const n = nm(a.c), z = a.c.zone, st = g.f07;
    if (FUS_ONLY.has(n)) return !(a.how === 'fusion' && z === 'extra');
    if (n === 'Elemental HERO Air Neos') return !(z === 'extra' && a.how === 'fusion'); // only by its own rule (the menu check passes how 'fusion')
    if (n === 'Dragon Master Knight') return z === 'extra' ? a.how !== 'fusion' : !st.proper[a.c.u];
    if (n === 'Elemental Mistress Doriado') return z === 'hand' || z === 'deck' ? a.how !== 'ritual' : !st.proper[a.c.u]; // PARTIAL: any Ritual Spell can summon her, not only Doriado's Blessing
    if (FIRST.has(n)) return z === 'extra' ? a.how !== 'fusion' : !st.proper[a.c.u];
    if (n === 'Emissary from Pandemonium' || n === 'Elemental HERO Neo Bubbleman') return true;
    if (n === 'Elemental HERO Poison Rose') return st.roseBud !== g.group; // PARTIAL: allowed only in the same action that sent a Rose Bud from the field
    if (n === 'Dragon Ice' && fieldMons(g).some(x => x !== a.c && faceUp(x) && nm(x) === 'Dragon Ice')) return true;
  }
  if ((a.type === 'ns' || a.type === 'set') && a.c) {
    const n = nm(a.c);
    if (n === 'Dragon Ice' && fieldMons(g).some(x => faceUp(x) && nm(x) === 'Dragon Ice')) return true;
  }
  // Element Doom / Saurus / Soldier with an EARTH monster on the field: the destroyed monster's effects are negated
  if (a.type === 'activate' && a.c && a.c.zone === 'gy' && a.c.flags && a.c.flags.f07neg) return true;
  return false;
}
function hub(g, ev) {
  if (!g.f07) { g.f07 = { seq: -1, proper: {}, roseBud: -1 }; addRule(g, f07Rule); }
  const st = g.f07; if (st.seq === ev.seq) return; st.seq = ev.seq;
  if (ev.type === 'summon') for (const c of ev.cs) {
    const n = nm(c);
    if ((ev.how === 'fusion' && (FIRST.has(n) || FUS_ONLY.has(n))) || (ev.how === 'ritual') || c.flags.f07contact) st.proper[c.u] = true;
    // Emissary from Pandemonium Summoned with 1 Tribute: Level 5, original ATK and DEF halved
    if (n === 'Emissary from Pandemonium' && ['normal', 'tribute'].includes(ev.how) && (c.tributes || []).length === 1) { c.flags.baseAtk = 1300; c.flags.lv = 5; c.flags.f07half = true; }
  }
  if (ev.type === 'set' && ev.c && nm(ev.c) === 'Emissary from Pandemonium' && (ev.c.tributes || []).length === 1) { ev.c.flags.baseAtk = 1300; ev.c.flags.lv = 5; ev.c.flags.f07half = true; }
  // Elemental HERO Necroshade: the first Level 5+ Elemental HERO Normal Summoned (or Set) without Tributes uses it up
  if ((ev.type === 'summon' && ev.how === 'normal') || ev.type === 'set') { const c = ev.type === 'set' ? ev.c : ev.cs[0];
    if (c && isEHERO(c) && lv(c) >= 5 && !(c.tributes || []).length) { const ns = g.p[ev.p].gy.find(x => nm(x) === 'Elemental HERO Necroshade' && !x.flags.f07used); if (ns) ns.flags.f07used = true; } }
  if (ev.type === 'move') {
    if (['extra', 'deck', 'hand'].includes(ev.to)) delete st.proper[ev.c.u];
    if (ev.from === 'gy' && ev.c.flags) delete ev.c.flags.f07neg;
    if (ev.wasField && nm(ev.c) === 'Rose Bud') st.roseBud = g.group;
    const k = ev.killer;
    if (ev.battle && ev.destroyed && k && isMon(ev.c)) {
      // WIND: it can attack once more after destroying an opponent's monster
      if (ELEM_WIND.has(nm(k)) && ev.prevCtrl !== k.ctrl) k.flags.f07kill = g.turnNo;
      if (ELEM_EARTH.has(nm(k)) && onField(k) && faceUp(k) && !negd(g, k) && attrOn(g, 'EARTH') && !['normal', 'token'].includes(D(ev.c).k) && ev.c.zone === 'gy') ev.c.flags.f07neg = true;
    }
  }
  // Elemental HERO Wildedge: the monsters it attacked this turn
  if (ev.type === 'attack' && ev.a && nm(ev.a) === 'Elemental HERO Wildedge' && ev.t) { const w = ev.a; if (!w.flags.f07wild || w.flags.f07wild.turn !== g.turnNo) w.flags.f07wild = { turn: g.turnNo, us: [] }; w.flags.f07wild.us.push(ev.t.u); }
  // Elemental HERO Chaos Neos (2 Heads): the negation lasts for the rest of the turn
  if (ev.type === 'phase' && ev.ph === 'end') for (const x of fieldMons(g)) if (x.flags.f07chaos != null) { x.flags.f07chaos = null; x.flags.negated = false; g.seq++; }
  // WATER: control of Element Magician / Soldier / Valkyrie can't switch.
  // PARTIAL / ENGINE: takeControl() has no forbid check, so a monster that changed control while a WATER monster was on the field goes straight back.
  for (const x of fieldMons(g)) if (ELEM_WATER.has(nm(x)) && faceUp(x)) {
    const lock = !negd(g, x) && attrOn(g, 'WATER');
    if (lock && x.flags.f07ctrl != null && x.ctrl !== x.flags.f07ctrl && freeM(g, x.flags.f07ctrl) >= 0) { const back = x.flags.f07ctrl; x.flags.ctrlUntil = null; x.flags.ctrlFrom = null; takeControl(g, back, x, false); log(g, `Control of ${name(x)} can't switch.`); }
    x.flags.f07ctrl = x.ctrl;
  }
}
const HOOK = { type: 'trig', loc: 'any', on: (g, ev) => { hub(g, ev); return false; }, res: function* () {} };

/* Element monsters: each Attribute on the field turns on one effect. */
function element(o) {
  return { self: {
    atk: o.fire ? (g, c) => attrOn(g, 'FIRE') ? 500 : 0 : undefined,
    maxAttacks: o.wind ? (g, c) => (c.flags.f07kill === g.turnNo && attrOn(g, 'WIND')) || c.flags.extraAttack === g.turnNo ? 2 : 1 : undefined,
  }, effs: [] };
}

const S = {
  /* ===== Dragon support ===== */
  // Ported from classic-5.js. Face-up Dragons go to Defense Position (also ones that arrive later) and can't change position.
  'Dragon Capture Jar': {
    cont: { forbid: (g, src, a) => a.type === 'pos' && a.c && faceUp(a.c) && isDragon(g, a.c) },
    effs: [{ type: 'act', res: function* (g) { for (const m of fieldMons(g)) if (faceUp(m) && isDragon(g, m)) toDef(g, m); } },
      { type: 'trig', loc: 'st', on: (g, ev, c) => { if (faceUp(c)) for (const m of fieldMons(g)) if (m.pos === 'atk' && isDragon(g, m)) toDef(g, m); return false; }, res: function* () {} }] },
  // Optional trigger (can miss the timing, not in the Damage Step); discarding is a cost, and it can discard itself to come back from the GY.
  'Dragon Ice': { effs: ['hand', 'gy'].map(z => ({ type: 'trig', loc: z, when: true, tags: { ss: 1 }, label: 'Discard: Special Summon Dragon Ice',
    on: (g, ev, c) => ev.type === 'summon' && ev.p !== c.owner && !['normal', 'tribute', 'flip', 'gemini'].includes(ev.how) && !g.inDS,
    cond: (g, c, p) => g.p[p].hand.length > 0 && (freeM(g, p) >= 0) && canSS(g, p, c),
    cost: function* (g, c, p) { yield* discard1(g, p, 'Discard 1 card'); },
    res: function* (g, c, p) { if ((c.zone === 'hand' || c.zone === 'gy') && freeM(g, p) >= 0) ss(g, p, c); } })) },
  'Dragon Manipulator': { effs: [flip('Take control of a Dragon', {
    cond: (g, c, p) => oppFaceUp(g, p).some(x => isDragon(g, x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Take control of which Dragon until the End Phase?', oppFaceUp(g, p).filter(x => isDragon(g, x)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && t.ctrl !== p && isDragon(g, t)) takeControl(g, p, t, true); } })] },
  'Dragon Master Knight': {
    self: { atk: (g, c) => 500 * monsOf(g, c.ctrl).filter(x => x !== c && faceUp(x) && isDragon(g, x)).length }, effs: [] },
  // Ported from classic-2.js.
  'Dragon Piper': { effs: [flip('Destroy Dragon Capture Jar', {
    res: function* (g, c, p) { const jars = allField(g).filter(x => faceUp(x) && named(x, 'Dragon Capture Jar')); if (!jars.length) return;
      if (!destroy(g, jars, { by: p }).length) return;
      const ds = fieldMons(g).filter(x => faceUp(x) && isDragon(g, x) && x.pos !== 'atk'); for (const x of ds) { x.pos = 'atk'; g.seq++; L.emit(g, { type: 'pos', c: x, p }); }
      if (ds.length) log(g, `${ds.map(name).join(', ')} changed to Attack Position.`); } })] },
  // Ported from classic-3.js: mandatory, Normal or Flip Summon.
  'Dragon Seeker': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy a face-up Dragon',
    on: (g, ev, c) => evSummoned(ev, c, ['normal', 'tribute', 'flip']),
    cond: g => fieldMons(g).some(x => faceUp(x) && isDragon(g, x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up Dragon?', fieldMons(g).filter(x => faceUp(x) && isDragon(g, x)), 1, 1, 'bad'); },
    res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && isDragon(g, t)) destroy(g, [t], { by: p, src: c }); } }] },
  'Dragon Treasure': { cont: { atk: (g, src, m) => src.equipTo === m.u && isDragon(g, m) ? 300 : 0, def: (g, src, m) => src.equipTo === m.u && isDragon(g, m) ? 300 : 0 },
    effs: [{ type: 'act', cond: g => fieldMons(g).some(x => faceUp(x) && isDragon(g, x)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Dragon Treasure to which Dragon?', fieldMons(g).filter(x => faceUp(x) && isDragon(g, x)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && isDragon(g, t)) equip(g, c, t); } }] },
  // The mode (and the target for the second one) is chosen on activation.
  "Dragon's Gunfire": { effs: [{ type: 'act', label: "Dragon's Gunfire",
    cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isDragon(g, x)),
    target: function* (g, c, p, L2) {
      const ts = fieldMons(g).filter(x => faceUp(x) && def(g, x) <= 800);
      const m = ts.length ? yield* choose(g, p, "Dragon's Gunfire: choose an effect", ['Inflict 800 damage', 'Destroy a monster with 800 or less DEF']) : 0;
      L2.data.mode = m; if (m === 1) { L2.tags = { destroy: 1 }; yield* tgt(g, p, L2, 'Destroy which monster with 800 or less DEF?', ts, 1, 1, 'bad'); } },
    res: function* (g, c, p, L2) { if (!L2.data.mode) { damage(g, opp(p), 800, { src: c, srcP: p }); return; } const t = live(L2)[0]; if (t && faceUp(t) && def(g, t) <= 800) destroy(g, [t], { by: p, src: c }); } }] },
  // Doesn't target; materials are picked and banished on resolution.
  "Dragon's Mirror": { effs: [{ type: 'act', tags: { ss: 1 },
    cond: (g, c, p) => (freeM(g, p) >= 0 || monsOf(g, p).length > 0) && canFusion(g, p, { from: ['m', 'gy'], filter: fx => race(fx) === 'Dragon' }),
    res: function* (g, c, p) { yield* fusionSummon(g, p, { from: ['m', 'gy'], banish: true, filter: fx => race(fx) === 'Dragon' }); } }] },
  "Dragon's Rage": { cont: { grant: (g, src, c, flag) => flag === 'piercing' && c.ctrl === src.ctrl && faceUp(c) && isDragon(g, c) },
    effs: [{ type: 'act', res: function* () {} }] },
  'Dragonic Attack': { cont: { atk: (g, src, m) => src.equipTo === m.u ? 500 : 0, def: (g, src, m) => src.equipTo === m.u ? 500 : 0 },
    // PARTIAL: "treated as Dragon" is only seen by the Dragon checks in this file (ENGINE: no Type override in race()).
    effs: [{ type: 'act', cond: g => fieldMons(g).some(x => faceUp(x) && race(x) === 'Warrior'),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Equip Dragonic Attack to which Warrior?', fieldMons(g).filter(x => faceUp(x) && race(x) === 'Warrior'), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && race(t) === 'Warrior') equip(g, c, t); } }] },
  'Dragonic Guard': { effs: [
    { type: 'trig', mand: true, label: 'Place a Dragonic Counter',
      on: (g, ev, c) => (ev.type === 'summon' && ['normal', 'tribute', 'gemini'].includes(ev.how)) || (ev.type === 'set' && ev.c && isMon(ev.c)),
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addCtr(g, c, 'dragonic', 1); log(g, `Dragonic Guard has ${ctr(c, 'dragonic')} Dragonic Counter${ctr(c, 'dragonic') > 1 ? 's' : ''}.`); } } },
    { type: 'ign', tags: { ss: 1 }, label: 'Send to the GY: summon a Dragon',
      cond: (g, c, p) => faceUp(c) && ctr(c, 'dragonic') > 0 && g.p[p].deck.some(x => isMon(x) && race(x) === 'Dragon' && lv(x) <= ctr(c, 'dragonic') && canSS(g, p, x)),
      cost: function* (g, c, p, L2) { L2.data.n = ctr(c, 'dragonic'); move(g, c, 'gy', { reason: 'cost' }); },
      res: function* (g, c, p, L2) { const cs = g.p[p].deck.filter(x => isMon(x) && race(x) === 'Dragon' && lv(x) <= L2.data.n && canSS(g, p, x)); if (!cs.length || freeM(g, p) < 0) { shuffleDeck(g, p); return; }
        const [x] = yield* pick(g, p, `Special Summon a Level ${L2.data.n} or lower Dragon from your Deck`, cs, 1, 1, 'good'); if (x) ss(g, p, x); shuffleDeck(g, p); } }] },
  // Chained right to an opponent's monster effect that targets and destroys your cards; the targets are the cost.
  'Dragonic Knight': { effs: [{ type: 'quick', loc: 'hand', tags: { ss: 1 }, label: 'Send the targets: Special Summon',
    cond: (g, c, p, x) => !!(x.top && !x.top.negated && x.top.p !== p && isMon(x.top.c) && !x.top.cardAct && x.top.tags && x.top.tags.destroy
      && x.top.t.some(t => onField(t) && t.ctrl === p) && (freeM(g, p) >= 0 || x.top.t.some(t => t.zone === 'm' && t.ctrl === p)) && canSS(g, p, c)),
    cost: function* (g, c, p) { const top = g.chain[g.chain.length - 1]; const ts = top.t.filter(t => onField(t) && t.ctrl === p); for (const t of ts) move(g, t, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${ts.map(nm).join(', ')} to the GY.`); },
    res: function* (g, c, p) { if (c.zone === 'hand' && freeM(g, p) >= 0) ss(g, p, c); } }] },

  /* ===== Element monsters ===== */
  'Element Doom': element({ earth: true, wind: true }),
  'Element Dragon': element({ fire: true, wind: true }),
  'Element Magician': element({ water: true, wind: true }),
  'Element Saurus': element({ fire: true, earth: true }),
  'Element Soldier': element({ water: true, earth: true }),
  'Element Valkyrie': element({ fire: true, water: true }),
  // Banishing the monster is part of the effect, not a cost.
  'Elemental Absorber': { cont: { forbid: (g, src, a) => a.type === 'attack' && a.c && a.c.ctrl !== src.ctrl && src.flags.f07abs && attr(a.c) === src.flags.f07abs },
    effs: [{ type: 'act', cond: (g, c, p) => g.p[p].hand.some(isMon),
      res: function* (g, c, p) { const ms = g.p[p].hand.filter(isMon); if (!ms.length) return; const [x] = yield* pick(g, p, 'Banish which monster from your hand?', ms, 1, 1, 'cost'); if (!x) return;
        move(g, x, 'ban', { reason: 'effect' }); log(g, `${PN(g, p)} banished ${name(x)}.`); if (onField(c)) { c.flags.f07abs = attr(x); g.seq++; log(g, `${attr(x)} monsters ${PN(g, opp(p))} controls can't declare an attack.`); } } }] },
  'Elemental Burst': { effs: [{ type: 'act', tags: { destroy: 1 },
    cond: (g, c, p) => burstSets(g, p).length > 0 && fieldOf(g, opp(p)).length > 0,
    cost: function* (g, c, p) { const cs = burstSets(g, p); let ms = cs[0]; if (cs.length > 1) { const i = yield* choose(g, p, 'Tribute which monsters?', cs.map(m => m.map(x => faceUp(x) ? name(x) : 'face-down ' + nm(x)).join(' + '))); ms = cs[i]; }
      const names = ms.map(nm); for (const x of ms) move(g, x, 'gy', { reason: 'cost', by: p }); log(g, `${PN(g, p)} Tributed ${names.join(', ')}.`); },
    res: function* (g, c, p) { destroy(g, fieldOf(g, opp(p)), { by: p, src: c }); } }] },

  /* ===== Elemental HEROes ===== */
  'Elemental HERO Air Neos': { mats: NO_POLY, proc: contactProc([NEOS, 'Neo-Spacian Air Hummingbird']),
    self: { atk: (g, c) => { const me = g.p[c.ctrl].lp, them = g.p[opp(c.ctrl)].lp; return me < them ? them - me : 0; } },
    effs: [endShuffle()] },
  'Elemental HERO Aqua Neos': { mats: NO_POLY, proc: contactProc([NEOS, 'Neo-Spacian Aqua Dolphin']),
    effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Discard: destroy a random card in their hand', cond: (g, c, p) => g.p[p].hand.length > 0 && g.p[opp(p)].hand.length > 0,
      cost: function* (g, c, p) { yield* discard1(g, p); }, res: function* (g, c, p) { randomHandKill(g, p); } }, endShuffle()] },
  'Elemental HERO Bladedge': { self: { piercing: true }, effs: [] },
  'Elemental HERO Chaos Neos': { mats: NO_POLY, proc: contactProc([NEOS, 'Neo-Spacian Dark Panther', 'Neo-Spacian Glow Moss']),
    effs: [endShuffle({ opt: true, label: 'Shuffle into the Extra Deck and Set every monster',
      res: function* (g, c) { if (!toExtra(g, c)) return; const ms = fieldMons(g).filter(faceUp); for (const x of ms) setFaceDown(g, x); } }),
    { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Toss a coin 3 times', cond: g => g.phase === 'main1',
      res: function* (g, c, p) { let h = 0; for (let i = 0; i < 3; i++) if (L.coin(g, p)) h++; log(g, `${h} Head${h === 1 ? '' : 's'}.`);
        if (h === 3) destroy(g, monsOf(g, opp(p)), { by: p });
        else if (h === 2) { for (const x of monsOf(g, opp(p)).filter(faceUp)) { x.flags.negated = true; x.flags.f07chaos = g.turnNo; } g.seq++; log(g, `The effects of ${PN(g, opp(p))}'s face-up monsters are negated this turn.`); }
        else if (h === 1) { const ms = monsOf(g, p); for (const x of ms) move(g, x, 'hand', { reason: 'effect', by: p }); if (ms.length) log(g, `${ms.map(nm).join(', ')} returned to the hand.`); } } }] },
  'Elemental HERO Dark Neos': { mats: NO_POLY, proc: contactProc([NEOS, 'Neo-Spacian Dark Panther']),
    cont: { negates: (g, src, x) => src.flags.f07dn === x.u },
    effs: [{ type: 'ign', label: "Negate a monster's effect",
      cond: (g, c, p) => !(c.flags.f07dn && fieldMons(g).some(x => x.u === c.flags.f07dn)) && fieldMons(g).some(x => x !== c && faceUp(x) && !['normal', 'token'].includes(D(x).k)),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Negate the effect of which monster?', fieldMons(g).filter(x => x !== c && faceUp(x) && !['normal', 'token'].includes(D(x).k)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && faceUp(c)) { c.flags.f07dn = t.u; g.seq++; log(g, `${name(t)}'s effect is negated while ${PN(g, p)} controls Elemental HERO Dark Neos.`); } } },
    endShuffle()] },
  'Elemental HERO Darkbright': { self: { piercing: true },
    effs: [{ type: 'trig', mand: true, label: 'Change to Defense Position', on: (g, ev, c) => ev.type === 'dsEnd' && ev.a === c,
      res: function* (g, c, p) { if (onField(c) && c.pos === 'atk') { toDef(g, c); L.emit(g, { type: 'pos', c, p }); } } },
    { type: 'trig', loc: 'any', mand: true, tags: { destroy: 1 }, label: 'Destroy a monster', on: (g, ev, c) => ev.type === 'move' && ev.c === c && ev.wasField && ev.destroyed,
      cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  // PARTIAL: it gains the 500 ATK but not the banished monster's effects (ENGINE: no effect copying).
  'Elemental HERO Divine Neos': { mats: [isNeosX, isNSp, isHEROm, x => isNeosX(x) || isNSp(x) || isHEROm(x), x => isNeosX(x) || isNSp(x) || isHEROm(x)],
    effs: [{ type: 'ign', opt: true, label: 'Banish a Neos or HERO: +500 ATK',
      cond: (g, c, p) => g.p[p].gy.some(x => isMon(x) && (isNeosX(x) || isNSp(x) || isHEROm(x))),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Banish a Neos, Neo-Spacian or HERO monster from your GY', g.p[p].gy.filter(x => isMon(x) && (isNeosX(x) || isNSp(x) || isHEROm(x))), 1, 1, 'cost'); move(g, x, 'ban', { reason: 'cost' }); log(g, `${PN(g, p)} banished ${nm(x)}.`); },
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 500 }); log(g, `${name(c)} gained 500 ATK.`); } } }] },
  'Elemental HERO Electrum': {
    self: { atk: (g, c) => { const mine = attrsOf(g, c); return 300 * monsOf(g, opp(c.ctrl)).filter(x => faceUp(x) && attrsOf(g, x).some(a => mine.includes(a))).length; } },
    effs: [{ type: 'trig', mand: true, label: 'Shuffle all banished cards into the Deck', on: (g, ev, c) => evSummoned(ev, c, ['fusion']),
      res: function* (g) { const bs = allCards(g, 'ban'); for (const x of bs) move(g, x, L.isExtraD(D(x)) ? 'extra' : 'deck', { reason: 'effect' }); if (bs.length) log(g, `${bs.length} banished card${bs.length > 1 ? 's were' : ' was'} shuffled into the Deck.`); } }] },
  // Ported from goat-3.js (Goat keeps that one). Edison: the original ATK, even if it left the GY.
  'Elemental HERO Flame Wingman': { mats: [is('Elemental HERO Avian'), is('Elemental HERO Burstinatrix')], effs: [wingDamage('Damage equal to its ATK')] },
  'Elemental HERO Flare Neos': { mats: NO_POLY, proc: contactProc([NEOS, 'Neo-Spacian Flare Scarab']), self: { atk: g => 400 * stOnField(g).length }, effs: [endShuffle()] },
  'Elemental HERO Glow Neos': { mats: NO_POLY, proc: contactProc([NEOS, 'Neo-Spacian Glow Moss']),
    self: { cantAttack: (g, c) => c.flags.f07noAtk === g.turnNo, directAttack: (g, c) => c.flags.f07direct === g.turnNo },
    effs: [endShuffle(), { type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy a face-up card', cond: (g, c, p) => g.phase === 'main1' && fieldOf(g, opp(p)).some(faceUp),
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up card?', fieldOf(g, opp(p)).filter(faceUp), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (!t || !faceUp(t)) return; const kind = isMon(t) ? 'm' : isSpell(t) ? 's' : 't', tok = D(t).k === 'token';
        if (!destroy(g, [t], { by: p }).length || !onField(c) || !faceUp(c)) return;
        if (kind === 'm' && !tok) { c.flags.f07noAtk = g.turnNo; log(g, "Elemental HERO Glow Neos can't attack this turn."); }
        else if (kind === 's') { c.flags.f07direct = g.turnNo; log(g, 'Elemental HERO Glow Neos can attack directly this turn.'); }
        else if (kind === 't') { toDef(g, c); L.emit(g, { type: 'pos', c, p }); } } }] },
  'Elemental HERO Heat': { self: { atk: (g, c) => 200 * monsOf(g, c.ctrl).filter(x => faceUp(x) && isEHERO(x)).length }, effs: [] },
  'Elemental HERO Inferno': {
    self: { atk: (g, c) => { if (!g.inDS) return 0; const f = foeOf(g, c); return f && onField(f) && attrsOf(g, f).includes('WATER') ? 1000 : 0; } }, effs: [] },
  'Elemental HERO Knospe': {
    self: { noAttackTarget: (g, c) => monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && isEHERO(x)), directAttack: (g, c) => monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && isEHERO(x)) },
    effs: [{ type: 'trig', mand: true, label: '+100 ATK, -100 DEF', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 100, def: -100 }); log(g, 'Elemental HERO Knospe gained 100 ATK and lost 100 DEF.'); } } }] },
  'Elemental HERO Lady Heat': { effs: [{ type: 'trig', mand: true, label: '200 damage per Elemental HERO',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'end' && ev.tp === c.ctrl,
    res: function* (g, c, p) { const n = monsOf(g, p).filter(x => faceUp(x) && isEHERO(x)).length; if (n) damage(g, opp(p), 200 * n, { src: c, srcP: p }); } }] },
  // PARTIAL: "If this card is shuffled into the Extra Deck this way" is resolved as part of the same effect, not a new trigger.
  'Elemental HERO Magma Neos': { mats: NO_POLY, proc: contactProc([NEOS, 'Neo-Spacian Flare Scarab', 'Neo-Spacian Grand Mole']), self: { atk: g => 400 * allField(g).length },
    effs: [endShuffle({ opt: true, label: 'Shuffle into the Extra Deck: return every card to the hand',
      res: function* (g, c, p) { if (!toExtra(g, c)) return; const cs = allField(g); for (const x of cs) move(g, x, 'hand', { reason: 'effect', by: p }); if (cs.length) log(g, 'Every card on the field returned to the hand.'); } })] },
  'Elemental HERO Marine Neos': { mats: NO_POLY, proc: contactProc([NEOS, 'Neo-Spacian Marine Dolphin']),
    effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy a random card in their hand', cond: (g, c, p) => g.p[opp(p)].hand.length > 0,
      res: function* (g, c, p) { randomHandKill(g, p); } }] },
  'Elemental HERO Mudballman': { effs: [] },
  'Elemental HERO Necroid Shaman': {
    effs: [{ type: 'trig', mand: true, tags: { destroy: 1, ss: 1 }, label: 'Destroy a monster, then revive one for them', on: (g, ev, c) => evSummoned(ev, c),
      cond: (g, c, p) => monsOf(g, opp(p)).length > 0,
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which monster?', monsOf(g, opp(p)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { if (!destroy(g, live(L2), { by: p }).length) return; const q = opp(p);
        const cs = g.p[q].gy.filter(x => isMon(x) && canSS(g, q, x)); if (!cs.length || freeM(g, q) < 0) return;
        const [x] = yield* pick(g, p, `Special Summon which monster from ${PN(g, q)}'s GY to their side?`, cs, 1, 1, 'bad'); if (!x) return;
        const pos = (yield* choose(g, p, `${nm(x)}: which position?`, ['Attack Position', 'Defense Position'])) ? 'def' : 'atk'; ss(g, q, x, pos); } }] },
  'Elemental HERO Necroshade': { cont: { loc: 'gy', tributes: (g, src, c, p, need) => src.owner === p && !src.flags.f07used && need > 0 && isEHERO(c) && lv(c) >= 5 ? 0 : null }, effs: [] },
  // Its Edison text: "Cannot be Normal Summoned or Set or Special Summoned", so it never reaches the field. The battle effect is kept for completeness.
  'Elemental HERO Neo Bubbleman': { effs: [{ type: 'trig', mand: true, tags: { destroy: 1 }, label: 'Destroy the monster it battled',
    on: (g, ev, c) => ev.type === 'dsEnd' && (ev.a === c || ev.t === c) && !!(ev.a && ev.t),
    res: function* (g, c, p, L2) { const o = L2.ev.a === c ? L2.ev.t : L2.ev.a; if (o && onField(o) && o.ctrl !== p) destroy(g, [o], { by: p }); } }] },
  'Elemental HERO Phoenix Enforcer': { self: { noBattleDestroy: true }, effs: [] },
  'Elemental HERO Plasma Vice': { self: { piercing: true },
    effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Discard: destroy an Attack Position monster', cond: (g, c, p) => g.p[p].hand.length > 0 && monsOf(g, opp(p)).some(x => x.pos === 'atk'),
      cost: function* (g, c, p) { yield* discard1(g, p); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Attack Position monster?', monsOf(g, opp(p)).filter(x => x.pos === 'atk'), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && t.pos === 'atk') destroy(g, [t], { by: p }); } }] },
  // PARTIAL: "can only target Poison Rose for attacks" can't stop attacks on face-down monsters (noAttackTarget is checked on face-up ones).
  'Elemental HERO Poison Rose': { cont: { grant: (g, src, c, flag) => flag === 'noAttackTarget' && c !== src && c.ctrl === src.ctrl && nm(c) !== 'Elemental HERO Poison Rose' },
    effs: [{ type: 'trig', mand: true, label: '+200 ATK, -200 DEF', on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl,
      res: function* (g, c) { if (onField(c) && faceUp(c)) { addMod(g, c, { atk: 200, def: -200 }); log(g, 'Elemental HERO Poison Rose gained 200 ATK and lost 200 DEF.'); } } }] },
  // PARTIAL / ENGINE: monsters can only attack in Attack Position, so its Defense Position attack is a Battle Phase effect that deals
  // half its ATK as direct battle damage and uses up its attack (no attack declaration, so attack-declaration cards can't answer it).
  'Elemental HERO Rampart Blaster': {
    effs: [{ type: 'quick', label: 'Attack from Defense Position',
      cond: (g, c, p, x) => !x.top && g.phase === 'battle' && g.tp === p && !g.inDS && !g.aw && c.pos === 'def' && faceUp(c) && c.attacks < 1 && !monsOf(g, opp(p)).length && !g.noBP[p] && !forbid(g, { type: 'attack', c }),
      res: function* (g, c, p) { if (!onField(c) || !faceUp(c) || monsOf(g, opp(p)).length) return; c.attacks++; log(g, 'Elemental HERO Rampart Blaster attacked directly from Defense Position.');
        damage(g, opp(p), Math.floor(atk(g, c) / 2), { battle: true, src: c, srcP: p, direct: true }); } }] },
  'Elemental HERO Shining Flare Wingman': { mats: [is('Elemental HERO Flame Wingman'), is('Elemental HERO Sparkman')],
    self: { atk: (g, c) => 300 * g.p[c.ctrl].gy.filter(x => /^Elemental HERO/.test(nm(x))).length }, effs: [wingDamage('Damage equal to its ATK')] },
  'Elemental HERO Shining Phoenix Enforcer': {
    self: { noBattleDestroy: true, atk: (g, c) => 300 * g.p[c.ctrl].gy.filter(x => /^Elemental HERO/.test(nm(x))).length }, effs: [] },
  'Elemental HERO Steam Healer': { mats: [is('Elemental HERO Burstinatrix'), is('Elemental HERO Bubbleman')], effs: [wingDamage('Gain LP equal to its ATK', true)] },
  // PARTIAL: the "shuffled into the Extra Deck this way" part resolves with the same effect, not as a new trigger.
  'Elemental HERO Storm Neos': { mats: NO_POLY, proc: contactProc([NEOS, 'Neo-Spacian Air Hummingbird', 'Neo-Spacian Aqua Dolphin']),
    effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Destroy every Spell and Trap', cond: g => stOnField(g).length > 0,
      res: function* (g, c, p) { destroy(g, stOnField(g), { by: p }); } },
    endShuffle({ label: 'Shuffle into the Extra Deck: shuffle the field into the Deck',
      res: function* (g, c, p) { if (!toExtra(g, c)) return; const cs = allField(g); for (const x of cs) move(g, x, 'deck', { reason: 'effect', by: p }); if (cs.length) log(g, 'Every card on the field was shuffled into the Deck.'); } })] },
  'Elemental HERO Tempest': {
    cont: { grant: (g, src, c, flag) => flag === 'noBattleDestroy' && (src.flags.f07tp || []).includes(c.u) },
    effs: [{ type: 'ign', label: 'Send a card: protect a monster',
      cond: (g, c, p) => fieldOf(g, p).some(x => x !== c && D(x).k !== 'token') && monsOf(g, p).some(x => !(c.flags.f07tp || []).includes(x.u)),
      cost: function* (g, c, p) { const [x] = yield* pick(g, p, 'Send which card you control to the GY?', fieldOf(g, p).filter(x => x !== c && D(x).k !== 'token'), 1, 1, 'cost'); const n = faceUp(x) ? name(x) : 'a face-down card'; move(g, x, 'gy', { reason: 'cost' }); log(g, `${PN(g, p)} sent ${n} to the GY.`); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, "Which monster can't be destroyed by battle?", monsOf(g, p).filter(x => !(c.flags.f07tp || []).includes(x.u)), 1, 1, 'good'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && onField(c) && faceUp(c)) { (c.flags.f07tp || (c.flags.f07tp = [])).push(t.u); g.seq++; log(g, `${faceUp(t) ? name(t) : 'The face-down monster'} can't be destroyed by battle while Elemental HERO Tempest is face-up.`); } } }] },
  'Elemental HERO Thunder Giant': {
    effs: [{ type: 'ign', opt: true, tags: { destroy: 1 }, label: 'Discard: destroy a weaker monster',
      cond: (g, c, p) => g.p[p].hand.length > 0 && fieldMons(g).some(x => faceUp(x) && baseAtk(x) < atk(g, c)),
      cost: function* (g, c, p) { yield* discard1(g, p); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which face-up monster?', fieldMons(g).filter(x => faceUp(x) && baseAtk(x) < atk(g, c)), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { const t = live(L2)[0]; if (t && faceUp(t) && onField(c) && faceUp(c) && baseAtk(t) < atk(g, c)) destroy(g, [t], { by: p }); } }] },
  'Elemental HERO Voltic': { effs: [{ type: 'trig', when: true, tags: { ss: 1 }, label: 'Special Summon a banished Elemental HERO',
    on: (g, ev, c) => ev.type === 'damage' && ev.battle && ev.src === c && ev.p !== c.ctrl && ev.n > 0,
    cond: (g, c, p) => freeM(g, p) >= 0 && g.p[p].ban.some(x => ehMon(x) && canSS(g, p, x)),
    target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Special Summon which banished Elemental HERO?', g.p[p].ban.filter(x => ehMon(x) && canSS(g, p, x)), 1, 1, 'good'); },
    res: function* (g, c, p, L2) { const t = L2.t[0]; if (t && t.zone === 'ban') ss(g, p, t); } }] },
  'Elemental HERO Wild Wingman': {
    effs: [{ type: 'ign', tags: { destroy: 1 }, label: 'Discard: destroy a Spell/Trap', cond: (g, c, p) => g.p[p].hand.length > 0 && stOnField(g).length > 0,
      cost: function* (g, c, p) { yield* discard1(g, p); },
      target: function* (g, c, p, L2) { yield* tgt(g, p, L2, 'Destroy which Spell/Trap?', stOnField(g), 1, 1, 'bad'); },
      res: function* (g, c, p, L2) { destroy(g, live(L2), { by: p }); } }] },
  // One attack on each of the opponent's monsters; no direct attack after attacking a monster.
  'Elemental HERO Wildedge': {
    self: {
      maxAttacks: (g, c) => { const w = c.flags.f07wild && c.flags.f07wild.turn === g.turnNo ? c.flags.f07wild.us : []; const left = monsOf(g, opp(c.ctrl)).filter(x => !w.includes(x.u)).length; return Math.max(1, w.length + left); },
      attackOk: (g, c, t) => { const w = c.flags.f07wild && c.flags.f07wild.turn === g.turnNo ? c.flags.f07wild.us : []; return !w.includes(t.u); } },
    effs: [] },
  // PARTIAL: "unaffected by Trap effects" only covers destruction by Traps (the engine's unaffectedTraps flag).
  // ENGINE: destroy() checks the flag only when the Trap passes { src: c }; most Trap scripts (Mirror Force, Torrential Tribute,
  // Trap Hole, Bottomless Trap Hole in engine.js) don't yet, so in play those still destroy Wildheart.
  'Elemental HERO Wildheart': { self: { unaffectedTraps: true }, effs: [] },
  // An optional trigger in your Standby Phase.
  'Elemental HERO Woodsman': { effs: [{ type: 'trig', opt: true, label: 'Add Polymerization',
    on: (g, ev, c) => ev.type === 'phase' && ev.ph === 'standby' && ev.tp === c.ctrl,
    cond: (g, c, p) => [...g.p[p].deck, ...g.p[p].gy].some(is('Polymerization')),
    res: function* (g, c, p) { const inGy = g.p[p].gy.filter(is('Polymerization')), inDeck = g.p[p].deck.some(is('Polymerization')) && !forbid(g, { type: 'search', p });
      let fromGy = inGy.length && !inDeck; if (inGy.length && inDeck) fromGy = (yield* choose(g, p, 'Add Polymerization from where?', ['Deck', 'GY'])) === 1;
      if (fromGy) { move(g, inGy[0], 'hand', { reason: 'effect' }); log(g, `${PN(g, p)} added Polymerization from the GY to the hand.`); }
      else if (inDeck) yield* search(g, p, is('Polymerization'), 'Add Polymerization from your Deck'); } }] },
  // Ritual Summon only (summon rule in f07Rule); also WIND, WATER, FIRE and EARTH while face-up (seen by this file's cards only, see attrsOf).
  'Elemental Mistress Doriado': { effs: [] },
  'Elemental Recharge': { effs: [{ type: 'act', cond: (g, c, p) => monsOf(g, p).some(x => faceUp(x) && isEHERO(x)),
    res: function* (g, c, p) { gain(g, p, 1000 * monsOf(g, p).filter(x => faceUp(x) && isEHERO(x)).length); } }] },
  // 1 Tribute is allowed; then it is Level 5 with 1300/900 original stats (set in hub()). Can't be Special Summoned.
  // PARTIAL: Setting it with 1 Tribute is also offered (the ruling says it can't be Set that way); turned face-down, it keeps the halved stats.
  'Emissary from Pandemonium': { self: { tributes: () => [1], def: (g, c) => c.flags.f07half ? -900 : 0 }, effs: [] },
  // Ported from goat-5.js: mandatory, each player picks from their own Deck.
  'Emissary of the Afterlife': { effs: [{ type: 'trig', loc: 'gy', mand: true, label: 'Each player adds a Normal Monster',
    on: (g, ev, c) => fromFieldToGY(ev, c),
    res: function* (g, c, p) { for (const q of [p, opp(p)]) { if (forbid(g, { type: 'search', p: q })) continue;
      yield* search(g, q, x => isMon(x) && D(x).k === 'normal' && lv(x) <= 3, 'Add a Level 3 or lower Normal Monster from your Deck to your hand'); } } }] },
  'Emissary of the Oasis': {
    self: { noAttackTarget: (g, c) => monsOf(g, c.ctrl).some(x => x !== c && faceUp(x) && lowNormal(x)) },
    cont: { dmg: (g, src, p, n, o) => o.battle && p === src.ctrl && g.battle && [g.battle.a, g.battle.t].some(x => x && onField(x) && faceUp(x) && lowNormal(x)) ? 0 : undefined } },
};
function isNeosX(x) { return (/Neos/.test(nm(x)) && !/^Neo-Spacian/.test(nm(x))) || /Neo Space/.test(nm(x)); }
function isNSp(x) { return /^Neo-Spacian/.test(nm(x)); }
function isHEROm(x) { return /HERO/.test(nm(x)); }
function lowNormal(x) { return ['normal', 'token'].includes(D(x).k) && lv(x) <= 3; }
// Elemental Burst: one WIND, WATER, FIRE and EARTH monster you control (Doriado can be one of them).
function burstSets(g, p) {
  const ms = monsOf(g, p), out = [];
  const rec = (i, used) => { if (out.length > 6) return; if (i === ATT4.length) { out.push(used.slice()); return; }
    for (const x of ms) if (!used.includes(x) && (faceUp(x) ? attrsOf(g, x) : [attr(x)]).includes(ATT4[i])) { used.push(x); rec(i + 1, used); used.pop(); } };
  rec(0, []);
  const seen = new Set(); return out.filter(m => { const k = m.map(x => x.u).sort().join(','); if (seen.has(k)) return false; seen.add(k); return true; });
}
for (const k in S) S[k].effs = [...(S[k].effs || []), HOOK];
E.addScripts(S);
})();
