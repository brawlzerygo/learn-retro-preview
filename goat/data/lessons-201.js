/* Goat 201: playing to win. Lessons 8 to 14, drafted 2026-11-23. Our own words, never the Edison course's
 sentences. Rules facts from goatformat.com and YGOPRODeck (research/sources.md); deck facts from goatformat.com's
 deck guides and the site's own deck lists (data/decks.js). Write apostrophes only inside backtick strings. */
window.GOAT_LESSONS_201 = function ({ cn, call }) {
  const src = (items) => `<p class="srcnote">Sources: ${items.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`).join(', ')}.</p>`;
  const GF = (page, label) => [label, `https://www.goatformat.com/${page}`];
  const YPD = ['YGOPRODeck, An Introduction to Goat Format', 'https://ygoprodeck.com/an-introduction-to-goat-format/'];
  const deck = (name) => `<a href="#deck-${encodeURIComponent(name)}">${name}</a>`;
  return [
  {
    n: 8, title: 'Rules That Trip People Up', sub: 'Priority, triggers on a Chain, the Damage Step, replays and the June 2005 rule.', min: 9,
    cards: ['Book of Moon', 'Breaker the Magical Warrior', 'Tsukuyomi', 'Magician of Faith', 'Call of the Haunted'],
    html: `
<div class="goals"><h4>What you will learn</h4><ul><li>Who gets to act first after a summon</li><li>The order of effects that trigger together</li><li>What you can and can't do during the Damage Step</li><li>Replays, and the June 2005 position rule</li></ul></div>
<p>Goat is played the way a head judge ruled it in 2005. Most rules match the modern game, but a handful don't, and they decide games. These are the ones to know.</p>
<h2>Priority: the turn player goes first</h2>
<p>When a summon or a Chain finishes, the turn player gets the first chance to do something next. They can use a fast card, or a monster's Ignition effect, before the opponent gets a turn to respond.</p>
${call('key', 'Why it matters', `<p>You Normal Summon ${cn('Breaker the Magical Warrior')}. Thanks to priority, you can remove its counter and aim at a Set card right away. Your opponent never gets a window to turn Breaker face-down with Book of Moon before its effect starts.</p>`)}
<h2>Effects that trigger at the same time</h2>
<p>Sometimes two or more effects trigger from one event, for example when Mirror Force destroys two monsters that each have a "when destroyed" effect. In Goat they go on the Chain in the order their events happened, earliest first. The last link resolves first, as always.</p>
<h2>The Damage Step</h2>
<p>The Damage Step is the stretch of an attack where the damage is worked out. In 2005 it is split into six parts, and each part allows only one Chain.</p>
<p>The big difference: during the Damage Step, the only cards you can use are monster effects that negate an activation. No Quick-Play Spells, no Normal Traps, no Continuous Trap effects. If you want to stop an attack with ${cn('Book of Moon')} or a Trap, do it when the attack is declared, not after.</p>
${call('mistake', 'A common slip', `<p>Waiting to see whether the attacker flips your Set monster before you respond. By then you are in the Damage Step, and your Traps are locked out.</p>`)}
<h2>Replays</h2>
<p>If the number of monsters your opponent controls changes after you declare an attack, for example because ${cn('Call of the Haunted')} brings one back, you get a replay: choose a new target or stop the attack. In Goat, a replay counts as a brand-new attack declaration, so cards that respond to an attack being declared can be used again.</p>
<h2>The June 2005 position rule</h2>
<p>Before June 2005, a monster turned face-down by a card effect couldn't be flipped back up that turn, because the move counted as its one position change. After the change, it no longer counts. Standard Goat uses the newer rule.</p>
<p>That is what lets a deck turn its own ${cn('Magician of Faith')} face-down with ${cn('Book of Moon')} or ${cn('Tsukuyomi')} and use its Flip effect again. YGOPRODeck's introduction points to this rule as the reason Goat Control works at all.</p>
<h2>Smaller rules</h2>
<ul>
<li>Two 0 ATK monsters that battle in Attack Position are both destroyed.</li>
<li>You can't pay a Life Point cost that would take you to 0 or below. Chain Energy is the only exception.</li>
<li>Only one face-up Field Spell exists for the whole table.</li>
</ul>
<div class="recap"><h2>Recap</h2><ul><li>After a summon or a Chain, the turn player acts first.</li><li>Effects that trigger together go on the Chain in the order they happened.</li><li>In the Damage Step only monster effects that negate an activation can be used.</li><li>A replay is a new attack declaration.</li><li>Being turned face-down by a card doesn't use up a monster's position change.</li></ul></div>
${src([GF('basics.html', 'goatformat.com, Goat Format Rules'), GF('rules.html', 'goatformat.com, Rules and Policies'), YPD])}`,
    flash: [
      ['A summon has just finished on your turn. Who acts first?', 'You, the turn player.'],
      ['Can you use Book of Moon during the Damage Step in Goat?', 'No. Only monster effects that negate an activation can be used then.'],
      ['How many Chains can happen in each part of the 2005 Damage Step?', 'One.'],
      ['Your attack target changes because a monster was revived. Is the new attack a fresh declaration?', 'Yes. In Goat a replay counts as a new attack declaration.'],
      ['Two 0 ATK monsters battle in Attack Position. What happens?', 'Both are destroyed.'],
      ['Why can Goat Control reuse Magician of Faith?', 'Since June 2005, being turned face-down by a card doesn’t use up its position change, so it can be flipped again.']
    ]
  },
  {
    n: 9, title: 'Card Advantage', sub: 'Trading one for one, finding free pluses, and reading your opponent.', min: 10,
    cards: ['Pot of Greed', 'Sangan', 'Breaker the Magical Warrior', 'Delinquent Duo', 'Graceful Charity', 'Sinister Serpent', 'Snatch Steal', 'Dust Tornado'],
    html: `
<div class="goals"><h4>What you will learn</h4><ul><li>How to count who is ahead</li><li>What a one-for-one trade and a plus one are</li><li>Which Goat cards give you something for free</li><li>How to read your opponent and play around their cards</li></ul></div>
<h2>Goat is a numbers game</h2>
<p>Games in Goat are long. A single game can run close to 20 turns, and big swings are rare. So the question every turn is: after this play, will I have more cards than my opponent, or fewer? Count the cards in your hand plus the cards on your field. Whoever holds more good cards is usually the one who wins.</p>
${call('analogy', 'Think of it like this', `<p>Each card is a coin. A good trade swaps one of your coins for one of theirs. A great play gets you two of theirs for one of yours, or a coin for nothing.</p>`)}
<h2>One-for-one</h2>
<p>Most plays are one-for-one: you spend a card to remove one of theirs. Sakuretsu Armor for an attacker, Mystical Space Typhoon for a Set card. Neither player gets ahead. Goat players trade like this for many turns and wait for a chance to get ahead.</p>
<h2>Plus one</h2>
<p>A plus one (+1) is any play that leaves you a card ahead. Some cards do it on their own:</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Pot of Greed')}</td><td>One card in, two cards out.</td></tr>
<tr><td>${cn('Delinquent Duo')}</td><td>One card, two of theirs discarded (if they hold two or more).</td></tr>
<tr><td>${cn('Breaker the Magical Warrior')}</td><td>Destroys a Set card and stays on the field.</td></tr>
<tr><td>${cn('Sangan')}</td><td>Trades itself away, then fetches a monster from your Deck.</td></tr>
<tr><td>${cn('Snatch Steal')}</td><td>Their monster becomes your monster.</td></tr>
<tr><td>Magician of Faith</td><td>Flips and returns a Spell, so it is two cards from one.</td></tr>
</tbody></table></div>
<p>According to YGOPRODeck's introduction, getting more than one card ahead in a single turn rarely happens in Goat, and it often decides the game when it does.</p>
<h2>Good discards</h2>
<p>${cn('Graceful Charity')} draws three and throws two away, so on its own it doesn't gain a card. It gets better when the discards help you. ${cn('Sinister Serpent')} comes back to your hand next Standby Phase, so discarding it costs nothing. goatformat.com's power card guide notes players differ on timing: some fire Graceful Charity early, others hold it until they have a discard like that.</p>
<h2>Reading your opponent</h2>
<ul>
<li><b>Their discards talk.</b> If a Graceful Charity sends away a LIGHT and a DARK monster, a Chaos monster may be coming.</li>
<li><b>Set cards on a turn they could have attacked</b> often mean a Trap that stops attacks.</li>
<li><b>Count what is left.</b> Most staples are Limited. Once you have seen their Mirror Force, there isn't another.</li>
</ul>
<h2>Playing around Traps</h2>
<p>Make a smaller play first to draw out a Trap, then make the big one. goatformat.com's article on ${cn('Dust Tornado')} against Snatch Steal makes the same point from the other side: you don't have to answer a card the moment it is played. Sometimes it is better to wait until your opponent has spent more on the play, and then break it.</p>
${call('mistake', 'Common mistakes', `<ul><li>Chasing Life Points instead of cards. Damage matters at the end, cards matter all game.</li><li>Using a removal card on a small threat, then having nothing for the big one.</li><li>Dumping your hand onto the field into a possible Torrential Tribute or Mirror Force.</li></ul>`)}
<div class="recap"><h2>Recap</h2><ul><li>Count hand plus field to see who is ahead.</li><li>One-for-one trades keep things even. A plus one puts you ahead.</li><li>Pot of Greed, Delinquent Duo, Breaker, Sangan, Snatch Steal and Magician of Faith all gain cards.</li><li>Read discards and Set cards, and bait Traps before your big play.</li></ul></div>
${src([YPD, GF('home/introduction-to-goat-format-power-cards-part-2', 'goatformat.com, Power Cards Part 2'), GF('home/can-i-play-3-of-a-flip', 'goatformat.com, Can I Play 3 of a Flip?'), GF('home/dust-tornado-vs-snatch-steal', 'goatformat.com, Dust Tornado vs Snatch Steal')])}`,
    flash: [
      ['How do you count who is ahead?', 'Cards in hand plus cards on the field.'],
      ['What is a plus one?', 'A play that leaves you one card ahead of before.'],
      ['Why is Breaker the Magical Warrior a plus one?', 'It destroys a Spell or Trap and stays on the field as a monster.'],
      ['When is Graceful Charity at its best?', 'When the discards help you, like Sinister Serpent, which returns to your hand.'],
      ['Your opponent discards a LIGHT and a DARK monster. What should you expect?', 'A Chaos monster, like Chaos Sorcerer or Black Luster Soldier.'],
      ['Why make a smaller play before your big one?', 'To draw out a Trap, so your big play is safe.']
    ]
  },
  {
    n: 10, title: 'Goat Control', sub: 'The deck the format is named after: Scapegoat, Metamorphosis and Thousand-Eyes Restrict.', min: 10,
    cards: ['Scapegoat', 'Metamorphosis', 'Thousand-Eyes Restrict', 'Tsukuyomi', 'Magician of Faith', 'Asura Priest', 'Airknight Parshath', 'Dekoichi the Battlechanted Locomotive', 'Trap Dustshoot'],
    html: `
<div class="goals"><h4>What you will learn</h4><ul><li>How Goat Control wins</li><li>Its key cards and loops</li><li>How to play it, and how to beat it</li></ul></div>
<p>See the full list: ${deck('Goat Control')}, the build Lolmarcus took to 7th place at the 2020 Goat Format World Championship.</p>
<h2>The plan</h2>
<p>Goat Control wins slowly. It answers everything, gets a little ahead each turn, and finishes once the opponent runs out of cards.</p>
<ul>
<li>${cn('Scapegoat')} protects its Life Points with four Sheep Tokens.</li>
<li>${cn('Metamorphosis')} turns a token, or any Level 1, into ${cn('Thousand-Eyes Restrict')}.</li>
<li>Flip monsters like ${cn('Magician of Faith')} and ${cn('Dekoichi the Battlechanted Locomotive')} gain cards, and ${cn('Tsukuyomi')} and Book of Moon turn them face-down to use again.</li>
<li>Some lists add Tribute monsters, like ${cn('Airknight Parshath')}, to press for damage.</li>
</ul>
<h2>Key cards in the list</h2>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Copies</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Metamorphosis')}</td><td>3</td><td>Turns a Level 1 into Restrict.</td></tr>
<tr><td>${cn('Scapegoat')}</td><td>2</td><td>Shields your Life Points and feeds Metamorphosis. The tokens can't be Tributed for a Tribute Summon.</td></tr>
<tr><td>Book of Moon</td><td>3</td><td>Stops attacks and resets Flip monsters.</td></tr>
<tr><td>${cn('Asura Priest')}</td><td>3</td><td>Attacks every monster your opponent controls once each, which clears tokens.</td></tr>
<tr><td>${cn('Tsukuyomi')}</td><td>2</td><td>Turns a face-up monster face-down, then returns to your hand at the end of the turn.</td></tr>
<tr><td>${cn('Trap Dustshoot')}</td><td>2</td><td>Strips a monster from a big hand and shows you their plays.</td></tr>
</tbody></table></div>
${call('rule', 'Spirit monsters', `<p>Asura Priest and Tsukuyomi are Spirits. They can't be Special Summoned, and they return to your hand in the End Phase of the turn they were Normal Summoned or flipped. That means you can use their effect again next turn.</p>`)}
<h2>How to play it</h2>
<ol class="steps">
<li><div>Early on, Set monsters and Traps and trade one for one. Don't rush.</div></li>
<li><div>Use Scapegoat on your opponent's turn, ideally in their End Phase.</div></li>
<li><div>Attack with what you have, then bring out Restrict in Main Phase 2.</div></li>
<li><div>Use Tsukuyomi and Book of Moon on your own Flip monsters to keep drawing and recycling Spells.</div></li>
</ol>
<h2>Strengths and weaknesses</h2>
<p>goatformat.com's guide describes the deck as flexible and rewarding for skilled players, and still strong when the decks around it are aggressive. It also says other decks have since passed it as the best, partly because it reacts more than it acts.</p>
<h2>Beating it</h2>
<ul>
<li>Asura Priest, or any card that hits every monster, clears Sheep Tokens.</li>
<li>Book of Moon or Ring of Destruction answer Restrict without battle.</li>
<li>Pressure early, before Restrict lands. Its flip-and-recycle loops need time.</li>
</ul>
<div class="recap"><h2>Recap</h2><ul><li>Goat Control wins slowly by gaining cards and locking the board with Restrict.</li><li>Scapegoat, Metamorphosis and Restrict are the heart of it.</li><li>Flip monsters plus Book of Moon and Tsukuyomi keep it ahead.</li><li>Beat it with pressure, token clearing and non-battle answers to Restrict.</li></ul></div>
${src([GF('goat-control.html', 'goatformat.com, Goat Control guide'), YPD])}`,
    flash: [
      ['How does Goat Control usually win?', 'Slowly, by gaining cards each turn and locking the board with Thousand-Eyes Restrict.'],
      ['What does Asura Priest do?', 'It can attack each monster your opponent controls once, which clears tokens.'],
      ['What happens to a Spirit monster at the end of the turn it was Normal Summoned?', 'It returns to your hand.'],
      ['When should Goat Control use Scapegoat?', 'On the opponent’s turn, ideally in their End Phase.'],
      ['Name two ways to answer Thousand-Eyes Restrict without battle.', 'Ring of Destruction destroys it. Book of Moon flips it face-down, and Snatch Steal takes it.']
    ]
  },
  {
    n: 11, title: 'Chaos Turbo and Chaos Control', sub: 'Thunder Dragon, discard Traps and the Chaos monsters.', min: 10,
    cards: ['Chaos Sorcerer', 'Thunder Dragon', 'Raigeki Break', 'Gravekeeper\'s Spy', 'Mystic Tomato', 'Night Assailant', 'Kycoo the Ghost Destroyer', 'Skilled White Magician', 'Dekoichi the Battlechanted Locomotive'],
    html: `
<div class="goals"><h4>What you will learn</h4><ul><li>How Chaos Turbo fills its Graveyard and wins</li><li>How Chaos Control mixes in the Goat Control engine</li><li>How to play against both</li></ul></div>
<h2>Chaos Turbo</h2>
<p>See the list: ${deck('Chaos Turbo')}, Riccardo Lari's winning deck from the 2020 Goat Format World Championship. goatformat.com's news in 2026 calls Chaos Turbo the most popular deck in the format.</p>
<p>It plays no Scapegoat and no Metamorphosis. Instead it runs Flip monsters and cards that like being discarded, so its Graveyard fills with LIGHT and DARK monsters for ${cn('Chaos Sorcerer')} and Black Luster Soldier.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Copies</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Thunder Dragon')}</td><td>3</td><td>Discard it to add up to two more from your Deck. A LIGHT monster in the Graveyard and two cards in hand from one.</td></tr>
<tr><td>${cn('Raigeki Break')}</td><td>3</td><td>Discard a card to destroy any card on the field. Thunder Dragon makes a cheap discard.</td></tr>
<tr><td>${cn('Gravekeeper\'s Spy')}</td><td>3</td><td>A DARK Flip monster that summons another Gravekeeper's monster from the Deck.</td></tr>
<tr><td>${cn('Mystic Tomato')}</td><td>2</td><td>When destroyed in battle, summons a DARK monster with 1500 or less ATK from the Deck.</td></tr>
<tr><td>${cn('Night Assailant')}</td><td>2</td><td>A Flip monster that destroys a monster, and if discarded, returns a Flip monster to your hand.</td></tr>
<tr><td>${cn('Kycoo the Ghost Destroyer')}</td><td>1</td><td>Stops your opponent removing cards from either Graveyard, which shuts off their own Chaos monsters.</td></tr>
</tbody></table></div>
${call('key', 'A chain of searches', `<p>The guide points out how the monsters feed each other: Mystic Tomato can fetch Sangan, and Sangan can fetch Sinister Serpent or a Flip monster for Book of Moon to reuse.</p>`)}
<h2>Chaos Control</h2>
<p>See the lists: ${deck('Chaos Control')} and ${deck('Thunder Dragon Chaos Control')}, the second from Dale Bellido's 2nd place at the 2020 World Championship. Chaos Control is a blend: the Goat Control core of Scapegoat, Metamorphosis and Flip monsters, plus Chaos Sorcerer and Black Luster Soldier.</p>
<p>LIGHT and DARK monsters such as Sangan, Breaker, Tsukuyomi, Magician of Faith and ${cn('Skilled White Magician')} do double duty. The game starts slow, then Chaos Sorcerer and Thousand-Eyes Restrict take over. The guide notes the deck has trouble with an opponent's Scapegoat, which is why a single Asura Priest is in the list.</p>
<h2>Playing against Chaos decks</h2>
<ul>
<li>Watch their Graveyard. No LIGHT or no DARK means no Chaos monster this turn.</li>
<li>${cn('Kycoo the Ghost Destroyer')} and other cards that remove Graveyard monsters cut off their fuel.</li>
<li>Trap Dustshoot can catch a Chaos monster in their hand before it lands.</li>
<li>Against Chaos Turbo, keep your hand small enough that its discard Traps hurt less, and remember Raigeki Break hits Set cards too.</li>
</ul>
<div class="recap"><h2>Recap</h2><ul><li>Chaos Turbo fills its Graveyard with Thunder Dragon and Flip monsters, then lands Chaos monsters.</li><li>Raigeki Break turns spare cards into removal.</li><li>Chaos Control adds the Chaos monsters to the Goat Control core.</li><li>Starve both of LIGHT and DARK Graveyard monsters.</li></ul></div>
${src([GF('chaos-turbo.html', 'goatformat.com, Chaos Turbo guide'), GF('chaos-control.html', 'goatformat.com, Chaos Control guide'), GF('', 'goatformat.com news')])}`,
    flash: [
      ['Does Chaos Turbo play Scapegoat and Metamorphosis?', 'No.'],
      ['What does Thunder Dragon do when discarded?', 'Adds up to two Thunder Dragon from your Deck to your hand.'],
      ['Why does Chaos Turbo like Raigeki Break?', 'It needs a discard, and Thunder Dragon or Night Assailant make good ones.'],
      ['What does Kycoo the Ghost Destroyer stop?', 'Your opponent removing cards from either Graveyard, so they can’t summon Chaos monsters.'],
      ['What is Chaos Control?', 'The Goat Control core plus Chaos Sorcerer and Black Luster Soldier.']
    ]
  },
  {
    n: 12, title: 'Warriors and the Aggro Decks', sub: 'Warrior, Chaos Recruiter and Zombie: hit hard before the opponent sets up.', min: 9,
    cards: ['Reinforcement of the Army', 'D.D. Warrior Lady', 'Mystic Swordsman LV2', 'Blade Knight', 'Exiled Force', 'Don Zaloog', 'Shining Angel', 'Pyramid Turtle', 'Ryu Kokki', 'Royal Decree'],
    html: `
<div class="goals"><h4>What you will learn</h4><ul><li>What an aggro deck is</li><li>How Warrior, Chaos Recruiter and Zombie press for damage</li><li>How to slow them down</li></ul></div>
<p>Aggro decks attack early and often. They want to end the game, or leave you too far behind, before a control deck can settle in.</p>
<h2>Warrior</h2>
<p>See the lists: ${deck('Warrior')} (Sean Montague, 4th place, Clash of Champions) and ${deck('Chaos Warrior')} (Lukaz, winner of the first Patreon World Championship Qualifier, March 2021).</p>
<ul>
<li>${cn('Reinforcement of the Army')} searches the right Warrior for the job.</li>
<li>${cn('Mystic Swordsman LV2')} destroys a face-down monster it attacks before damage, so Set Flip monsters never get to flip.</li>
<li>${cn('D.D. Warrior Lady')} removes both itself and the monster it battled from play.</li>
<li>${cn('Exiled Force')} Tributes itself to destroy any monster.</li>
<li>${cn('Blade Knight')} gains 400 ATK when its owner holds one card or fewer, and when it is your only monster it stops the effects of Flip monsters it destroys in battle.</li>
<li>${cn('Don Zaloog')} makes your opponent discard at random, or mills two cards, when it hits.</li>
<li>A heavy Trap line: Solemn Judgment, Trap Dustshoot and Sakuretsu Armor.</li>
</ul>
<p>goatformat.com's guide notes the weak spot: Warriors gain few cards on their own, so they rely on winning battles.</p>
<h2>Chaos Recruiter</h2>
<p>See the list: ${deck('Chaos Recruiter')}. ${cn('Shining Angel')} and Mystic Tomato summon a new monster from the Deck when destroyed in battle, so every trade fills the Graveyard with LIGHT and DARK monsters for three Chaos Sorcerers and Black Luster Soldier. Asura Priest clears tokens, and because it goes back to the hand each turn, a board wipe on your opponent's turn has fewer monsters to hit.</p>
<h2>Zombie</h2>
<p>See the list: ${deck('Zombie')}, Delinkquent's winning list from Format Library Championship 17. ${cn('Pyramid Turtle')} and Giant Rat summon a new monster from the Deck when destroyed in battle, Pyramid Turtle reaching big Zombies like ${cn('Ryu Kokki')}, Book of Life revives them, and three ${cn('Royal Decree')} turn off the Traps that would stop the attacks.</p>
<h2>Beating aggro</h2>
<ul>
<li>Traps that stop attacks and wipe the board, like Mirror Force and Torrential Tribute, hit aggro hardest.</li>
<li>Scapegoat buys turns.</li>
<li>Thousand-Eyes Restrict stops every attack while it stands.</li>
<li>Against Mystic Swordsman LV2, don't rely only on Set Flip monsters.</li>
</ul>
<div class="recap"><h2>Recap</h2><ul><li>Aggro decks win by attacking before control decks settle.</li><li>Warrior uses Reinforcement of the Army to find the right attacker, backed by many Traps.</li><li>Chaos Recruiter and Zombie use monsters that summon more monsters when destroyed.</li><li>Board wipes, Scapegoat and Restrict slow aggro down.</li></ul></div>
${src([GF('warrior.html', 'goatformat.com, Warrior guide'), GF('chaos-recruiter.html', 'goatformat.com, Chaos Recruiter guide'), GF('zombie.html', 'goatformat.com, Zombie guide')])}`,
    flash: [
      ['What does Reinforcement of the Army do?', 'Adds a Level 4 or lower Warrior from your Deck to your hand.'],
      ['Why is Mystic Swordsman LV2 strong against Flip decks?', 'It destroys a face-down monster it attacks before damage, so the Flip effect never happens.'],
      ['What is the Warrior deck’s weak spot?', 'It gains few cards on its own and depends on winning battles.'],
      ['Why does the Zombie list play Royal Decree?', 'To turn off the Traps that would stop its attacks.'],
      ['Name two cards that hit aggro decks hard.', 'Mirror Force and Torrential Tribute (also Scapegoat and Thousand-Eyes Restrict).']
    ]
  },
  {
    n: 13, title: 'Burn, Empty Jar and Lockdown', sub: 'Decks that win without winning battles.', min: 10,
    cards: ['Des Koala', 'Just Desserts', 'Ojama Trio', 'Secret Barrel', 'Gravity Bind', 'Messenger of Peace', 'Wave-Motion Cannon', 'Book of Taiyou', 'Cyber Jar', 'Reasoning', 'Royal Decree', 'Jinzo'],
    html: `
<div class="goals"><h4>What you will learn</h4><ul><li>How Burn and Lockdown Burn deal damage without attacking</li><li>How Empty Jar and Reasoning Gate win in one big turn</li><li>The cards that stop them</li></ul></div>
<h2>Burn</h2>
<p>See the list: ${deck('Burn')}. It deals damage with card effects. ${cn('Des Koala')} burns for each card in your hand, ${cn('Just Desserts')} for each monster you control, and ${cn('Secret Barrel')} for every card in your hand and on your field. ${cn('Ojama Trio')} puts three tokens on <i>your</i> field, which feeds Just Desserts and Secret Barrel and takes up your Monster Zones. Big Shield Gardna and Desert Sunlight protect its Life Points.</p>
<h2>Lockdown Burn</h2>
<p>See the list: ${deck('Lockdown Burn')}. It stops you attacking first: ${cn('Gravity Bind')} stops Level 4 and higher monsters, ${cn('Messenger of Peace')} stops monsters with 1500 or more ATK, and Level Limit - Area B forces Level 4 and higher monsters into Defense Position. Then ${cn('Wave-Motion Cannon')} grows by 1000 damage for each of its owner's Standby Phases, and Nightmare Wheel, Lava Golem and Stealth Bird chip away.</p>
<h2>Empty Jar</h2>
<p>See the list: ${deck('Empty Jar')}. It wins in one turn by making you draw your whole Deck. ${cn('Book of Taiyou')} flips ${cn('Cyber Jar')} or Morphing Jar face-up, Book of Moon and The Shallow Grave set them up again, and every flip refills both players' hands from their Decks. To finish, Card Destruction plus Serial Spell empties your Deck. The guide notes a careful player can hold the combo back and wait for the right turn.</p>
<h2>Reasoning Gate</h2>
<p>See the list: ${deck('Reasoning Gate')}. ${cn('Reasoning')} and Monster Gate dig through the Deck and summon a monster, sending the other cards they pass to the Graveyard. Chaos Sorcerer and Black Luster Soldier come out, Dimension Fusion brings back removed monsters, and Scapegoat stalls until the kill. The guide calls it fragile: discard and disruption break it.</p>
<h2>Stopping them</h2>
<div class="tbl-wrap"><table><thead><tr><th>Deck</th><th>Cards that hurt it</th></tr></thead><tbody>
<tr><td>Burn, Lockdown Burn</td><td>${cn('Royal Decree')}, ${cn('Jinzo')}, Dust Tornado, Giant Trunade, Mobius the Frost Monarch</td></tr>
<tr><td>Empty Jar</td><td>Solemn Judgment, Cursed Seal of the Forbidden Spell, Spell Canceller, Compulsory Evacuation Device, Mind Crush</td></tr>
<tr><td>Reasoning Gate</td><td>Spell Canceller, Jowgen the Spiritualist, Trap Dustshoot, Mind Crush, Scapegoat, Waboku, Threatening Roar</td></tr>
</tbody></table></div>
${call('key', 'Pressure helps too', `<p>None of these decks want a long fight against a fast opponent. Attacking early forces them to use their stall cards before they are ready.</p>`)}
<div class="recap"><h2>Recap</h2><ul><li>Burn wins through effect damage. Lockdown Burn stops your attacks first.</li><li>Empty Jar makes you draw your whole Deck in one turn.</li><li>Reasoning Gate digs out Chaos monsters and wins in one turn, but breaks under disruption.</li><li>Trap and Spell stoppers, plus early pressure, beat them.</li></ul></div>
${src([GF('burn.html', 'goatformat.com, Burn guide'), GF('lockdown-burn.html', 'goatformat.com, Lockdown Burn guide'), GF('empty-jar.html', 'goatformat.com, Empty Jar guide'), GF('reasoning-gate-otk.html', 'goatformat.com, Reasoning Gate guide'), GF('home/sidedecking-for-alt-win-burn-combo-in-goat-format', 'goatformat.com, Sidedecking for Alt-Win, Burn and Combo')])}`,
    flash: [
      ['Why does Ojama Trio help a Burn deck?', 'It puts three tokens on the opponent’s field, which fuels Just Desserts and Secret Barrel and clogs their Monster Zones.'],
      ['What does Gravity Bind stop?', 'Level 4 and higher monsters from attacking.'],
      ['How does Empty Jar win?', 'By making its opponent draw their whole Deck in one turn.'],
      ['Which card shuts off Burn’s Traps?', 'Royal Decree (Jinzo does too).'],
      ['What breaks Reasoning Gate?', 'Disruption: discard, Spell Canceller, Jowgen, Mind Crush, or cards that stop its kill turn.']
    ]
  },
  {
    n: 14, title: 'Side Decking and Picking Your Deck', sub: 'Changing your deck between games, and choosing one to learn.', min: 9,
    cards: ['Royal Decree', 'Kycoo the Ghost Destroyer', 'Mystic Swordsman LV2', 'Creature Swap', 'Trap Dustshoot', 'Blade Knight'],
    html: `
<div class="goals"><h4>What you will learn</h4><ul><li>A simple method for building a Side Deck</li><li>How to swap cards between games</li><li>How to pick your first Goat deck</li></ul></div>
<h2>What the Side Deck is for</h2>
<p>After the first game of a match you know what your opponent plays. Your 15 Side Deck cards let you swap in answers to it, one card in for one card out.</p>
<h2>Four steps to a Side Deck</h2>
<p>goatformat.com's side decking guide lays out a method in four steps:</p>
<ol class="steps">
<li><div><b>List what can come out.</b> Every Main Deck card that could leave in games 2 and 3.</div></li>
<li><div><b>List your hard matchups.</b> Note how often you expect to face each one.</div></li>
<li><div><b>List answers, then cut.</b> Drop answers that clash with your own deck or don't do enough.</div></li>
<li><div><b>Write a chart.</b> For each matchup, what comes in and what goes out, and whether you are going first or second.</div></li>
</ol>
${call('key', 'One example from the guide', `<p>Goat Control against Thunder Dragon Chaos: in come ${cn('Blade Knight')}, ${cn('Mystic Swordsman LV2')}, two ${cn('Creature Swap')} and two ${cn('Trap Dustshoot')}. Out go Airknight Parshath, a Tsukuyomi, two Sakuretsu Armor and two Dust Tornado.</p>`)}
<h2>Watch out for clashes</h2>
<p>A card that is great in one deck can hurt another. The guide's example is ${cn('Royal Decree')}: strong against Burn, but in a Warrior deck full of Traps it would shut off your own cards.</p>
<p>Flexible decks like Goat Control can swap many cards. Decks with one narrow plan have fewer slots to change.</p>
<h2>Common side cards</h2>
<div class="tbl-wrap"><table><thead><tr><th>Facing</th><th>Cards</th></tr></thead><tbody>
<tr><td>Chaos decks</td><td>${cn('Kycoo the Ghost Destroyer')}, Blade Knight, Mystic Swordsman LV2, Creature Swap, Mind Control, Trap Dustshoot</td></tr>
<tr><td>Warrior</td><td>Zombyra the Dark, Mystic Swordsman LV2, Mind Control, Deck Devastation Virus</td></tr>
<tr><td>Burn</td><td>Royal Decree, Jinzo, Dust Tornado, Giant Trunade, Mobius the Frost Monarch</td></tr>
<tr><td>Combo</td><td>Spell Canceller, Cursed Seal of the Forbidden Spell, Mind Crush, Trap Dustshoot</td></tr>
</tbody></table></div>
<h2>Another approach: change decks entirely</h2>
<p>Some players side all 15 cards into a different deck for games 2 and 3, for example from Goat Control into Thunder Dragon Chaos. Your opponent sides for the deck they saw, so their answers miss. The risk, as the guide notes, is that you give up your answers to combo decks.</p>
<h2>Picking your first deck</h2>
<p>YGOPRODeck's introduction calls Goat Control the best deck and the one a new player should pick up, while warning that it takes a lot of skill to master. It also suggests keeping one-turn kill and alternate win decks for fun rather than as your main deck. Whatever you choose, play one deck many times. Knowing your own deck well matters more than having the best one.</p>
<div class="recap"><h2>Recap</h2><ul><li>Side cards swap in one for one between games.</li><li>Build it in four steps: what can come out, hard matchups, answers, a chart.</li><li>Watch for side cards that clash with your own deck.</li><li>Start with Goat Control, and stick with one deck while you learn.</li></ul></div>
${src([GF('home/four-steps-for-better-side-decking-in-goat-format', 'goatformat.com, Four Steps for Better Side Decking'), GF('home/transition-sidedecking-for-goat-format', 'goatformat.com, Transition Sidedecking'), GF('home/sidedecking-for-alt-win-burn-combo-in-goat-format', 'goatformat.com, Sidedecking for Alt-Win, Burn and Combo'), YPD])}`,
    flash: [
      ['How many cards can a Side Deck hold?', '15 (or none).'],
      ['What are the four steps to a Side Deck?', 'List what can come out, list your hard matchups, list and cut answers, then write a chart.'],
      ['Why might Royal Decree be a bad side card in a Warrior deck?', 'It would shut off the deck’s own Traps.'],
      ['What is transition side decking?', 'Swapping all 15 cards to turn your deck into a different deck for games 2 and 3.'],
      ['Which deck does YGOPRODeck suggest for new players?', 'Goat Control.']
    ]
  }
  ];
};
