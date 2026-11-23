/* Learn Edison computer player (first version, 2026-11-20). Built on js/engine.js.
 For each decision it copies the duel (E.clone), tries every choice, plays the copy forward until the next free
 action, and scores the position. It never sees hidden cards: in every copy the opponent's hand, face-down cards
 and Deck are swapped for blank stand-ins, and its own Deck is shuffled,, so it plays like a person who only knows what they can see.
 Levels: easy (often picks at random and never looks ahead in effects), normal (tries every choice), hard (also
 looks one more move ahead in its own turn, and respects the opponent's Set cards when attacking). */
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
function cardValue(g, c, onField) {
  const d = E().data(c); const n = d.n;
  if (n === 'Unknown card') return 1000;
  if (d.k === 'spell' || d.k === 'trap') return VALUE[n] || 750;
  const A = onField ? E().atk(g, c) : parseInt(d.atk, 10) || 0, Df = onField ? E().def(g, c) : parseInt(d.def, 10) || 0;
  if (d.k === 'token') return 150 + A * 0.6 + Df * 0.2;
  const stats = 400 + A * 0.75 + Df * 0.15;
  if (onField) return stats + (FIELD_BONUS[n] || 0);
  return Math.max(VALUE[n] || 0, stats + (d.k === 'effect' ? 150 : 0));
}
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
    for (const c of P.st) if (c) v += c.pos === 'set' ? (p === me ? cardValue(g, c) * 0.9 : 850) : 500;
    v += P.hand.length * (p === me ? 0 : 750);
    if (p === me) for (const c of P.hand) v += cardValue(g, c) * 0.8;
    v += Math.min(P.gy.length, 10) * 15;
    s += sign * v;
  }
  // board pressure: their strongest face-up attacker against my best
  const best = p => Math.max(0, ...g.p[p].m.filter(c => c && c.pos === 'atk').map(c => E().atk(g, c)));
  s += (best(me) - best(1 - me)) * 0.2;
  return s;
}
/* Hide what `me` can't see: the opponent's hand, face-down cards, and both Decks become stand-ins. */
let UNKNOWN = null, HIDE_SEED = 1;
function setupUnknown() {
  if (UNKNOWN) return; const E0 = E();
  E0.init([...root.EDISON_CARDS, { id: 'unk-mon', n: 'Unknown card', k: 'normal', a: 'EARTH', r: 'Warrior', lv: 4, atk: '1000', def: '1200' }, { id: 'unk-st', n: 'Unknown card', k: 'trap', sub: 'Normal' }]);
  UNKNOWN = true;
}
function hide(h, me) {
  const o = h.p[1 - me];
  for (const c of o.hand) c.id = 'unk-mon';
  for (const c of o.m) if (c && c.pos === 'set') c.id = 'unk-mon';
  for (const c of o.st) if (c && c.pos === 'set') c.id = 'unk-st';
  for (const c of o.deck) c.id = 'unk-mon';
  const d = h.p[me].deck; let a = HIDE_SEED >>> 0; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
}
/* Rebuild the real position, hide what `me` can't see (the same way every time within one decision), then play
 the given answers. Lines are always rebuilt from the real game, never from a copy that has stand-ins in it. */
function play(g, me, seq) { const h = E().clone(g); hide(h, me); for (const k of seq) E().act(h, k); return h; }
function sim(g, me, keys, depth, pre = []) {
  let h;
  try { h = play(g, me, [...pre, keys]); rollout(h, me); } catch (e) { return -1e6; }
  let v = evaluate(h, me);
  if (depth > 0 && h.prompt && h.prompt.p === me && h.prompt.type === 'idle' && h.turnNo === g.turnNo) {
    const line = h.history.slice(g.history.length);
    const opts = candidates(h, h.prompt).slice(0, 14); let best = -Infinity;
    for (const k of opts) best = Math.max(best, sim(g, me, k, depth - 1, line));
    if (best > v) v = best;
  }
  return v;
}
function rollout(h, me) { // play forward until the next free action or a real choice for `me`
  for (let n = 0; n < 60 && h.prompt; n++) {
    const pr = h.prompt;
    if (pr.type === 'idle') return;
    if (pr.p === me && pr.type === 'respond') return;
    E().act(h, defaultAnswer(h, pr));
  }
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
/* Attack order: with their Set cards in play, attack with the weakest monster that still wins first. */
function attackBias(g, me, keys, level) {
  const k = keys[0]; if (!k.startsWith('atk:')) return 0;
  const [, au, tu] = k.split(':'); const a = findCard(g, +au); if (!a) return 0;
  const sets = g.p[1 - me].st.filter(c => c && c.pos === 'set').length;
  let b = 0;
  if (sets && level === 'hard') b -= E().atk(g, a) * 0.04 * sets;
  if (tu !== 'd') { const t = findCard(g, +tu); if (t && t.pos === 'set') b -= level === 'hard' ? 150 : 60; }
  return b;
}
AI.decide = function (g, me, level = 'normal') {
  setupUnknown(); HIDE_SEED = Math.floor(Math.random() * 2 ** 31);
  const pr = g.prompt;
  const cands = candidates(g, pr);
  if (cands.length === 1) return cands[0];
  if (level === 'easy' && Math.random() < 0.45) {
    if (pr.type === 'respond' && Math.random() < 0.6) return ['pass'];
    if (pr.type === 'idle') { const act = cands.filter(k => !['end', 'endbp'].includes(k[0])); if (act.length && Math.random() < 0.7) return act[Math.floor(Math.random() * act.length)]; }
    return cands[Math.floor(Math.random() * cands.length)];
  }
  if (pr.type === 'pick' && pr.opts.some(o => { const c = findCard(g, o.u); return c && c.zone === 'deck' && c.owner !== me; })) return defaultAnswer(g, pr);
  const depth = level === 'hard' && pr.type === 'idle' ? 1 : 0;
  let best = null, bestV = -Infinity;
  for (const k of cands) {
    let v = sim(g, me, k, depth) + attackBias(g, me, k, level);
    if (k[0] === 'pass') v += 5; // break ties toward keeping cards
    if (k[0] === 'end' || k[0] === 'endbp') v += 2;
    if (level === 'easy') v += (Math.random() - 0.5) * 900;
    if (v > bestV) { bestV = v; best = k; }
  }
  return best || defaultAnswer(g, pr);
};
AI.evaluate = evaluate;
root.EdisonAI = AI;
})(typeof window !== 'undefined' ? window : globalThis);
