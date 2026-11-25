/* Learn Retro computer player (first version 2026-11-20; Goat knowledge and the four levels 2026-11-24). Built on js/engine.js.
 For each decision it copies the duel (E.clone), tries every choice, plays the copy forward until the next free
 action, and scores the position. It never sees hidden cards: in every copy the opponent's hand, face-down cards
 and Deck are swapped for blank stand-ins, and its own Deck is shuffled, so it plays like a person who only knows what they can see.
 Levels: see LEVELS below (Beginner to Tournament). */
(function (root) {
'use strict';
const AI = {};
const E = () => root.EdisonEngine;
const I = () => E()._internal;
const VALUE = { // cards worth more than their stats (in or out of the hand)
  'Heavy Storm': 1700, 'Mirror Force': 1600, 'Torrential Tribute': 1600, 'Solemn Judgment': 1500, 'Brain Control': 1400, 'Mystical Space Typhoon': 1100,
  'Bottomless Trap Hole': 1300, 'Dimensional Prison': 1200, 'Book of Moon': 1100, 'Dark Armed Dragon': 2600, 'Gorz the Emissary of Darkness': 1800,
  'Royal Oppression': 1300, 'Trap Dustshoot': 900, 'Dark Bribe': 1100, 'Icarus Attack': 1300, 'Raigeki Break': 1200, 'Allure of Darkness': 1100,
  'Gold Sarcophagus': 900, 'Reinforcement of the Army': 1000, 'E - Emergency Call': 1000, 'One for One': 900, 'Scapegoat': 1100, 'Enemy Controller': 1100,
  'Miracle Fusion': 1200, 'Compulsory Evacuation Device': 1100, 'Dust Tornado': 900, 'Black Whirlwind': 1300, 'Battle Fader': 1000, 'Tragoedia': 1300,
  'Plaguespreader Zombie': 1100, 'Card Trooper': 1000, 'Spirit Reaper': 1000, 'Dupe Frog': 900, 'Treeborn Frog': 900, 'Blackwing - Kalut the Moon Shadow': 1000,
  'Caius the Shadow Monarch': 1800, 'Stardust Dragon': 2800, 'Brionac, Dragon of the Ice Barrier': 2600,
};
/* On the field a monster is worth its stats plus what its effect keeps doing there; cards like Battle Fader or Gorz
 are worth a lot in the hand and little once summoned. */
const FIELD_BONUS = { 'Dark Armed Dragon': 1400, 'Stardust Dragon': 700, 'Brionac, Dragon of the Ice Barrier': 700, 'Dark End Dragon': 500, 'Blackwing - Gale the Whirlwind': 300,
  'Card Trooper': 300, 'Spirit Reaper': 500, 'Dupe Frog': 500, 'Substitoad': 500, 'Thought Ruler Archfiend': 300, 'Blackwing Armor Master': 600, 'Goyo Guardian': 300,
  'Tragoedia': 300, 'Elemental HERO Ocean': 300, 'Swap Frog': 200, 'Blackwing - Sirocco the Dawn': 200, 'Armory Arm': 300, 'Red Dragon Archfiend': 300 };
/* Goat (2005) values (2026-11-24), from the site's Goat lessons and matchup notes (goat/data/lessons-*.js, opponents.js):
 the format is won one card at a time, so the steal (Snatch Steal), the mass removal (Heavy Storm, Mirror Force,
 Torrential, Ring of Destruction) and the cards that answer anything (Book of Moon, Nobleman, Sakuretsu, Dustshoot) are
 worth far more than a card's stats, and so are the monsters that make a plus (Sangan, Magician of Faith, Tsukuyomi,
 Breaker, D.D. Warrior Lady, Tribe-Infecting Virus, Airknight) and the two Chaos monsters. The draw cards (Pot, Graceful
 Charity, Delinquent Duo) are valued at less than what they bring in, so the computer plays them instead of holding them. */
const GOAT_VALUE = {
  'Pot of Greed': 1000, 'Graceful Charity': 900, 'Delinquent Duo': 950, 'Snatch Steal': 1500, 'Heavy Storm': 1600, 'Mirror Force': 1500,
  'Torrential Tribute': 1500, 'Ring of Destruction': 1350, 'Book of Moon': 1250, 'Scapegoat': 1350, 'Nobleman of Crossout': 1150, 'Sakuretsu Armor': 1150,
  'Trap Dustshoot': 1050, 'Raigeki Break': 1150, 'Mystical Space Typhoon': 1050, 'Dust Tornado': 950, 'Metamorphosis': 950, 'Card Destruction': 800,
  'Premature Burial': 1150, 'Call of the Haunted': 1100, 'Confiscation': 1300, 'Exiled Force': 1200, 'Solemn Judgment': 1400, 'Magic Cylinder': 1000,
  'Black Luster Soldier - Envoy of the Beginning': 2700, 'Chaos Sorcerer': 2200, 'Breaker the Magical Warrior': 1500, 'Tsukuyomi': 1350, 'Sangan': 1150,
  'Magician of Faith': 1250, 'Airknight Parshath': 1500, 'Asura Priest': 1200, 'D.D. Warrior Lady': 1300, 'Tribe-Infecting Virus': 1350,
  'Dekoichi the Battlechanted Locomotive': 1000, 'Dark Mimic LV1': 1000, 'Sinister Serpent': 600, 'Thunder Dragon': 950, 'Night Assailant': 1150,
  'Gravekeeper\'s Spy': 950, 'Mystic Tomato': 950, 'Kycoo the Ghost Destroyer': 1150, 'Magical Merchant': 950, 'Skilled White Magician': 1100,
  'Jinzo': 1700, 'Dark Magician of Chaos': 1900, 'Cyber Jar': 1200, 'Morphing Jar': 1100, 'Spirit Reaper': 1100, 'Twin-Headed Behemoth': 1100,
};
const GOAT_FIELD_BONUS = { 'Black Luster Soldier - Envoy of the Beginning': 1100, 'Chaos Sorcerer': 550, 'Thousand-Eyes Restrict': 1500, 'Airknight Parshath': 500,
  'Breaker the Magical Warrior': 150, 'Tribe-Infecting Virus': 500, 'D.D. Warrior Lady': 350, 'Asura Priest': 300, 'Sangan': 350, 'Mystic Tomato': 250,
  'Kycoo the Ghost Destroyer': 250, 'Skilled White Magician': 250, 'Jinzo': 900, 'Dark Magician of Chaos': 600, 'Spirit Reaper': 500, 'Night Assailant': 150,
  'Magician of Faith': 100, 'Sheep Token': 100 };
const CHAOS = new Set(['Black Luster Soldier - Envoy of the Beginning', 'Chaos Sorcerer']);
const goat = () => E().format && E().format() === 'goat';
let KNOW = 1; // how much of the card-value table this level knows (1 = all; lower levels see more of the plain stats)
function cardValue(g, c, onField) {
  const d = E().data(c); const n = d.n;
  if (n === 'Unknown card') return 1000;
  const G = goat(), VT = G ? GOAT_VALUE : VALUE, FB = G ? GOAT_FIELD_BONUS : FIELD_BONUS;
  const know = v => KNOW >= 1 ? v : v * KNOW + (1 - KNOW) * 750;
  if (d.k === 'spell' || d.k === 'trap') return know(VT[n] || 750);
  const A = onField ? E().atk(g, c) : parseInt(d.atk, 10) || 0, Df = onField ? E().def(g, c) : parseInt(d.def, 10) || 0;
  if (d.k === 'token') return 150 + A * 0.6 + Df * 0.2 + (G ? FB[n] || 0 : 0);
  const stats = 400 + A * 0.75 + Df * 0.15;
  if (onField) return stats + (FB[n] || 0) * KNOW;
  let v = Math.max(know(VT[n] || 0), stats + (d.k === 'effect' ? 150 : 0));
  if (G && CHAOS.has(n) && !chaosFuel(g, c.owner)) v *= 0.7; // can't be summoned yet: no LIGHT and DARK in the Graveyard
  return v;
}
/* A Set card of mine keeps most of its worth; in Goat a Set Spell that isn't a Quick-Play only waits there to be hit by
 Heavy Storm or Breaker, so it is worth less than in the hand (play it, or keep it in hand). */
function setShare(c, i) { if (!goat()) return 0.9; const d = E().data(c); return (d.k === 'trap' || d.sub === 'Quick-Play' ? 0.85 : 0.5) - (i >= 2 ? 0.08 * (i - 1) : 0); } // the 3rd Set card on is more Heavy Storm bait
function chaosFuel(g, p) { let l = 0, dk = 0; for (const c of g.p[p].gy) { const d = E().data(c); if (d.k === 'spell' || d.k === 'trap') continue; if (d.a === 'LIGHT') l++; else if (d.a === 'DARK') dk++; } return Math.min(l, dk); }
function evaluate(g, me) {
  if (g.winner != null) return g.winner === me ? 1e7 : g.winner === -1 ? 0 : -1e7;
  let s = 0;
  for (const p of [0, 1]) {
    const sign = p === me ? 1 : -1, P = g.p[p];
    let v = Math.min(P.lp, 8000) * 0.55 + Math.max(0, P.lp - 8000) * 0.15;
    if (P.lp <= 2000) v -= (2000 - P.lp) * 0.4; // low LP is extra dangerous
    for (const c of P.m) if (c) {
      if (c.pos === 'set') v += p === me ? cardValue(g, c, true) * 0.9 : 1000;
      else v += cardValue(g, c, true) * (c.ctrl !== c.owner && c.flags.ctrlUntil != null ? 0.15 : 1);
    }
    let nSet = 0;
    for (const c of P.st) if (c) v += c.pos === 'set' ? (p === me ? cardValue(g, c) * setShare(c, nSet++) : 850) : 500;
    v += P.hand.length * (p === me ? 0 : 750);
    if (p === me) for (const c of P.hand) v += cardValue(g, c) * 0.8;
    v += Math.min(P.gy.length, 10) * 15;
    s += sign * v;
  }
  // board pressure: their strongest face-up attacker against my best
  const best = p => Math.max(0, ...g.p[p].m.filter(c => c && c.pos === 'atk').map(c => E().atk(g, c)));
  s += (best(me) - best(1 - me)) * 0.2;
  if (goat()) s += goatTerms(g, me);
  return s;
}
/* Goat extras (2026-11-24), each a lesson from the site's Goat course:
 - Chaos fuel: with Black Luster Soldier or Chaos Sorcerer still to come, a LIGHT and a DARK monster in the Graveyard
   are worth something (they pay for the summon).
 - Sinister Serpent in the Graveyard comes back every turn, so it is nearly a card in hand.
 - Their Set Spells and Traps: every face-up monster I commit can walk into Mirror Force, Torrential Tribute or
   Sakuretsu Armor, so a board is discounted by what one of those would take (play around Set cards, don't overextend). */
function goatTerms(g, me) {
  let s = 0; const P = g.p[me];
  let chaosLeft = 0; for (const c of [...P.hand, ...P.deck]) if (CHAOS.has(E().data(c).n)) chaosLeft++;
  if (chaosLeft) {
    let l = 0, dk = 0; for (const c of P.gy) { const d = E().data(c); if (d.k === 'spell' || d.k === 'trap') continue; if (d.a === 'LIGHT') l++; else if (d.a === 'DARK') dk++; }
    const pairs = Math.min(l, dk, chaosLeft);
    s += pairs * 260 + Math.min(Math.max(l, dk) - pairs, 1) * 60;
  }
  for (const p of [0, 1]) for (const c of g.p[p].gy) if (E().data(c).n === 'Sinister Serpent') s += (p === me ? 1 : -1) * 450;
  const sets = g.p[1 - me].st.filter(c => c && c.pos === 'set').length;
  if (sets && TRAPRISK) {
    const mons = P.m.filter(c => c && c.pos !== 'set').map(c => cardValue(g, c, true) * (c.ctrl !== c.owner && c.flags.ctrlUntil != null ? 0.15 : 1));
    if (mons.length) {
      const tot = mons.reduce((a, b) => a + b, 0), top = Math.max(...mons);
      const pMass = 1 - Math.pow(0.82, sets), pOne = 1 - Math.pow(0.7, sets);
      s -= TRAPRISK * (pMass * (tot - top) * 0.6 + pOne * top * 0.25);
    }
  }
  return s;
}
let TRAPRISK = 1;
/* Hide what `me` can't see: the opponent's hand, face-down cards, and both Decks become stand-ins. */
let UNKNOWN = null, HIDE_SEED = 1;
function setupUnknown() { // re-inits the engine once per card list with two stand-in cards added, keeping the format (Edison or Goat)
  const E0 = E(); const base = E0.cards ? E0.cards() : root.EDISON_CARDS;
  if (UNKNOWN === base || (base && base.__withUnknown)) return;
  const list = [...base.filter(c => c.n !== 'Unknown card'), { id: 'unk-mon', n: 'Unknown card', k: 'normal', a: 'EARTH', r: 'Warrior', lv: 4, atk: '1000', def: '1200' }, { id: 'unk-st', n: 'Unknown card', k: 'trap', sub: 'Normal' }];
  list.__withUnknown = true;
  E0.init(list, { format: E0.format ? E0.format() : 'edison' });
  UNKNOWN = list;
}
function hide(h, me) {
  const o = h.p[1 - me];
  for (const c of o.hand) c.id = 'unk-mon';
  for (const c of o.m) if (c && c.pos === 'set') c.id = 'unk-mon';
  o.st.forEach((c, i) => { if (c && c.pos === 'set') c.id = TRAPPLAN && TRAPPLAN.zone === i ? TRAPPLAN.id : 'unk-st'; });
  for (const c of o.deck) c.id = 'unk-mon';
  const d = h.p[me].deck; let a = HIDE_SEED >>> 0; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
}
/* Rebuild the real position, hide what `me` can't see (the same way every time within one decision), then play
 the given answers. Lines are always rebuilt from the real game, never from a copy that has stand-ins in it. */
function play(g, me, seq) { const h = E().clone(g); hide(h, me); for (const k of seq) E().act(h, k); return h; }
let DREW = false; // set when a line drew or searched from my Deck (only then do more guesses at my Deck order matter)
let DEADLINE = Infinity; // past it, lines are no longer looked at deeper (a time limit per decision)
function sim(g, me, keys, depth, pre = [], width = 14, width2 = width) {
  let h; if (TRAPPLAN) TRAPPLAN.sprung = false;
  try { h = play(g, me, [...pre, keys]); rollout(h, me); } catch (e) { return -1e6; }
  if (h.p[me].deck.length !== g.p[me].deck.length) DREW = true;
  let v = evaluate(h, me);
  // Goat: a line that ends my turn is scored after their draw, the others before it; give that draw back so ending the
  // turn is compared fairly with doing something (otherwise it Sets or summons anything rather than pass the turn)
  if (goat() && h.turnNo > g.turnNo && h.tp !== me && g.tp === me) v += 750;
  if (depth > 0 && Date.now() < DEADLINE && h.prompt && h.prompt.p === me && h.prompt.type === 'idle' && h.turnNo === g.turnNo) {
    const line = h.history.slice(g.history.length);
    // follow-ups: every action except ending the turn (stopping here is already the value v)
    const opts = candidates(h, h.prompt).filter(k => k[0] !== 'end').slice(0, width); let best = -Infinity;
    for (const k of opts) best = Math.max(best, sim(g, me, k, depth - 1, line, width2, width2));
    if (best > v) v = best;
  }
  return v;
}
function rollout(h, me) { // play forward until the next free action or a real choice for `me`
  for (let n = 0; n < 60 && h.prompt; n++) {
    const pr = h.prompt;
    if (pr.type === 'idle') return;
    if (pr.p === me && pr.type === 'respond' && !(TRAPPLAN && TRAPPLAN.sprung)) return;
    E().act(h, TRAPPLAN && pr.type === 'respond' && pr.p !== me ? trapAnswer(h, pr, me) : defaultAnswer(h, pr));
  }
}
/* Their Set cards (2026-11-24). A stand-in Set card never does anything, so on its own the computer would attack and
 summon into every Set card as if it were a blank. The stronger levels also check their best plays against a guess that one
 of the Set cards is a common Trap of the format (Goat: Mirror Force, Sakuretsu Armor, Torrential Tribute), which the
 opponent springs when it can (Torrential only on a summon that leaves more of my monsters than theirs). The guesses come
 from the format's card pool, never from the real cards. */
const TRAP_GUESS = { goat: { q: 0.3, cards: [['Mirror Force', 0.35], ['Sakuretsu Armor', 0.35], ['Torrential Tribute', 0.3]] } }; // Goat only (an Edison list tested no better)
let TRAPPLAN = null; const TRAP_IDS = {};
function trapId(n) { const k = (E().format ? E().format() : 'edison') + ':' + n; if (!(k in TRAP_IDS)) { const c = (E().cards ? E().cards() : []).find(x => x.n === n); TRAP_IDS[k] = c ? c.id : null; } return TRAP_IDS[k]; }
function trapAnswer(h, pr, me) {
  for (const o of pr.opts) {
    if (!o.u || !TRAPPLAN || o.u !== TRAPPLAN.u) continue;
    if (TRAPPLAN.n === 'Torrential Tribute') { const mine = h.p[me].m.filter(Boolean).length, theirs = h.p[1 - me].m.filter(Boolean).length; if (mine < Math.max(1, theirs)) continue; }
    TRAPPLAN.sprung = true; return [o.key]; // from here on the line plays itself out (I don't answer their Trap)
  }
  return defaultAnswer(h, pr);
}
function defaultAnswer(g, pr) {
  if (pr.type === 'respond') return ['pass'];
  if (pr.type === 'yesno') return ['y'];
  if (pr.type === 'choose') return [pr.opts[0].key];
  if (pr.type === 'pick') {
    const cards = pr.opts.map(o => findCard(g, o.u));
    const val = c => c ? cardValue(g, c, E().onField(c)) : 0;
    const mine = c => c && (E().onField(c) ? c.ctrl : c.owner) === pr.p;
    let order;
    if (pr.hint === 'cost') order = cards.slice().sort((a, b) => (mine(b) - mine(a)) || val(a) - val(b));
    else if (pr.hint === 'bad') order = cards.slice().sort((a, b) => (mine(a) - mine(b)) || val(b) - val(a));
    else order = cards.slice().sort((a, b) => val(b) - val(a));
    const n = pr.hint === 'cost' ? pr.min : pr.max;
    return order.slice(0, Math.max(pr.min, n)).map(c => 'u' + c.u);
  }
  return [pr.opts[0].key];
}
function findCard(g, u) { for (const P of g.p) for (const z of ['hand', 'm', 'st', 'gy', 'ban', 'deck', 'extra']) for (const c of P[z]) if (c && c.u === u) return c; return null; }
function candidates(g, pr) {
  if (pr.type === 'pick') {
    if (pr.max === 1) return pr.opts.map(o => [o.key]);
    const out = []; const keys = pr.opts.map(o => o.key);
    const rec = (s, cur) => { if (out.length > 40) return; if (cur.length >= pr.min && cur.length <= pr.max && cur.length) out.push(cur.slice()); if (cur.length === pr.max) return; for (let i = s; i < keys.length; i++) { cur.push(keys[i]); rec(i + 1, cur); cur.pop(); } };
    rec(0, []); return out.length ? out : [defaultAnswer(g, pr)];
  }
  return pr.opts.map(o => [o.key]);
}
/* Four levels (Zack, 2026-11-24, for Learn Retro Play): Beginner, Intermediate, Advanced, Tournament.
 slip: how often it makes a plain mistake (a random play, or missing a response it had); noise: how much its judgment of a
 play wobbles (variety, and misreads at the low end); depth: how many of its own moves it looks ahead in its Main Phase
 (multi-step plays; the biggest single step in strength); width: how many follow-ups it tries per step; careful: respects
 Set cards when attacking; samples: how many guesses at its own Deck order it checks a drawing line against; beam: re-checks
 its best few plays one move deeper (width2 follow-ups each); know: how much of the card-value table it knows (lower levels
 lean on plain ATK and DEF, so they trade a Mirror Force like any card); trapRisk: how much it discounts a board it commits
 into their Set Spells and Traps (Goat); trapSamples/trapTop: checks its best few plays against guesses at their Set cards
 (TRAP_GUESS); budget: a soft time limit in ms (the extra checks are skipped when there is no room, so a decision stays
 well under 4 s). The old names still work: easy = Beginner, normal = Intermediate, hard = Advanced, experienced = Tournament.
 Goat, tier A decks, each level against the one below (2026-11-24, build/test_levels.js): Intermediate won 77% of 60 games,
 Advanced 65% of 60, Tournament 60% of 80 (and 62 to 64% in earlier runs of 60). */
const LEVELS = {
  beginner:     { slip: 0.5, missResponse: 0.65, noise: 1000, depth: 0, width: 14, careful: 0, samples: 1, beam: 0, know: 0.3, trapRisk: 0 },
  intermediate: { slip: 0.16, missResponse: 0.35, noise: 350, depth: 0, width: 14, careful: 0.4, samples: 1, beam: 0, know: 0.65, trapRisk: 0.4 },
  advanced:     { slip: 0.05, missResponse: 0.1, noise: 120, depth: 0, width: 6, width2: 6, careful: 1, samples: 1, beam: 3, know: 1, trapRisk: 1, budget: 600 },
  tournament:   { slip: 0, missResponse: 0, noise: 12, depth: 1, width: 14, width2: 10, careful: 1, samples: 3, beam: 6, know: 1, trapRisk: 1, trapSamples: 2, trapTop: 4, budget: 1200 },
};
// four levels since 2026-11-24 (Zack cut Experienced); old names still work
const ALIAS = { easy: 'beginner', normal: 'intermediate', hard: 'advanced', experienced: 'tournament' };
AI.LEVELS = Object.keys(LEVELS);
AI._levels = LEVELS; // the level settings, for the strength tests in build/
/* Per-format changes to a level. Edison's Advanced keeps its first settings (a full move of lookahead), which already sat
 well between Intermediate and Tournament there; Goat's Advanced looks deeper only on its best few plays. */
const FORMAT_LEVELS = { edison: { advanced: { slip: 0.05, missResponse: 0.12, noise: 110, depth: 1, width: 10, beam: 0 } } };
const levelOf = name => {
  const key = LEVELS[ALIAS[name] || name] ? ALIAS[name] || name : 'intermediate';
  const f = FORMAT_LEVELS[E().format ? E().format() : 'edison'], o = f && f[key];
  return o ? { ...LEVELS[key], ...o } : LEVELS[key];
};
/* Attack order: with their Set cards in play, attack with the weakest monster that still wins first. */
function attackBias(g, me, keys, careful) {
  const k = keys[0]; if (!k.startsWith('atk:')) return 0;
  const [, au, tu] = k.split(':'); const a = findCard(g, +au); if (!a) return 0;
  const sets = g.p[1 - me].st.filter(c => c && c.pos === 'set').length;
  let b = 0;
  if (sets) b -= E().atk(g, a) * 0.04 * sets * careful;
  if (tu !== 'd') { const t = findCard(g, +tu); if (t && t.pos === 'set') b -= 60 + 90 * careful; }
  return b;
}
/* Score every candidate the way level L sees it (no slips, no noise). Guesses at hidden cards: the first guess always;
 more guesses (samples) only for a line that drew or searched, the only lines where my Deck order changes the result. */
function scoreAll(g, me, L, cands) {
  KNOW = L.know != null ? L.know : 1; TRAPRISK = L.trapRisk != null ? L.trapRisk : 1;
  const pr = g.prompt; const depth = pr.type === 'idle' ? L.depth : 0; const w2 = L.width2 || L.width;
  const score = (k, d) => {
    const seed0 = HIDE_SEED; DREW = false;
    let v = sim(g, me, k, d, [], L.width, w2), n = 1;
    if (DREW) for (let i = 1; i < L.samples; i++) { HIDE_SEED = (seed0 + i * 7919) >>> 0; v += sim(g, me, k, d, [], L.width, w2); n++; }
    HIDE_SEED = seed0; return v / n;
  };
  const t0 = Date.now(), budget = L.budget || Infinity; DEADLINE = t0 + budget * 2;
  const room = cost => Date.now() - t0 + cost <= budget; // time left for an extra check of the best few
  const scored = cands.map(k => {
    let v = score(k, depth) + attackBias(g, me, k, L.careful);
    if (k[0] === 'pass') v += 5; // break ties toward keeping cards
    if (k[0] === 'end' || k[0] === 'endbp') v += 2;
    return { k, v };
  });
  // the best few, checked one move deeper (Advanced and Tournament)
  const per = (Date.now() - t0) / Math.max(1, cands.length);
  if (L.beam && pr.type === 'idle' && scored.length > 1 && room(per * L.beam * 4)) {
    scored.sort((a, b) => b.v - a.v);
    for (const s of scored.slice(0, L.beam)) if (s.k[0] !== 'end') s.v = Math.max(s.v, score(s.k, depth + 1) + attackBias(g, me, s.k, L.careful) + (s.k[0] === 'endbp' ? 2 : 0));
  }
  // the best few, checked again against a guess at their Set cards (TRAP_GUESS)
  const TG = TRAP_GUESS[E().format ? E().format() : 'edison'];
  const sets = []; g.p[1 - me].st.forEach((c, i) => { if (c && c.pos === 'set') sets.push({ zone: i, u: c.u }); });
  if (L.trapSamples && TG && sets.length && pr.type === 'idle' && scored.length > 1 && room(per * (L.trapTop || 3) * L.trapSamples)) {
    const w0 = Math.pow(1 - TG.q, sets.length);
    let a = (HIDE_SEED ^ 0x5bd1e995) >>> 0; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
    const plans = [];
    for (let j = 0; j < L.trapSamples; j++) {
      const st = sets[Math.floor(r() * sets.length)]; let x = r(), n = TG.cards[TG.cards.length - 1][0];
      for (const [cn, wt] of TG.cards) { if (x < wt) { n = cn; break; } x -= wt; }
      const id = trapId(n); if (id != null) plans.push({ ...st, n, id });
    }
    if (plans.length) {
      scored.sort((a, b) => b.v - a.v);
      for (const s of scored.slice(0, L.trapTop || 3)) {
        let t = 0; for (const pl of plans) { TRAPPLAN = { ...pl, sprung: false }; try { t += score(s.k, depth); } finally { TRAPPLAN = null; } }
        s.v = w0 * s.v + (1 - w0) * (t / plans.length + attackBias(g, me, s.k, L.careful) + (s.k[0] === 'pass' ? 5 : 0) + (s.k[0] === 'end' || s.k[0] === 'endbp' ? 2 : 0));
      }
    }
  }
  DEADLINE = Infinity;
  return scored;
}
AI.decide = function (g, me, level = 'intermediate') {
  const L = levelOf(level);
  setupUnknown(); HIDE_SEED = Math.floor(Math.random() * 2 ** 31);
  const pr = g.prompt;
  const cands = candidates(g, pr);
  if (cands.length === 1) return cands[0];
  // a plain mistake
  if (Math.random() < L.slip) {
    if (pr.type === 'respond' && Math.random() < 0.6) return ['pass'];
    if (pr.type === 'idle') { const act = cands.filter(k => !['end', 'endbp'].includes(k[0])); if (act.length && Math.random() < 0.7) return act[Math.floor(Math.random() * act.length)]; }
    return cands[Math.floor(Math.random() * cands.length)];
  }
  if (pr.type === 'respond' && L.missResponse && Math.random() < L.missResponse * 0.5) return ['pass']; // didn't see the response
  if (pr.type === 'pick' && pr.opts.some(o => { const c = findCard(g, o.u); return c && c.zone === 'deck' && c.owner !== me; })) return defaultAnswer(g, pr);
  const scored = scoreAll(g, me, L, cands);
  let best = null, bestV = -Infinity;
  for (const s of scored) { const v = s.v + (Math.random() - 0.5) * L.noise; if (v > bestV) { bestV = v; best = s.k; } }
  return best || defaultAnswer(g, pr);
};
/* For the game's post-match review (Learn Retro Play): every legal answer to the current prompt scored the way the
 given level scores them (no slips, no noise), and the position a line leads to, for explaining the difference.
 Keep these two signatures: play/js/worker.js uses them. */
AI.scoreMoves = function (g, me, level = 'tournament') {
  const L = levelOf(level); setupUnknown(); HIDE_SEED = Math.floor(Math.random() * 2 ** 31);
  const cands = candidates(g, g.prompt); const sc = scoreAll(g, me, L, cands);
  return cands.map(k => sc.find(s => s.k === k)).map(s => ({ k: s.k, v: s.v }));
};
AI.lineState = function (g, me, keys) { setupUnknown(); try { const h = play(g, me, [keys]); rollout(h, me); return h; } catch (e) { return null; } };
AI.evaluate = (g, me) => { const k = KNOW, t = TRAPRISK; KNOW = 1; TRAPRISK = 1; try { return evaluate(g, me); } finally { KNOW = k; TRAPRISK = t; } };
root.EdisonAI = AI;
})(typeof window !== 'undefined' ? window : globalThis);
