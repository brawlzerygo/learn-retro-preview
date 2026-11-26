/* Goat 101: the format. Lessons 1 to 7, drafted 2026-11-23.
 Our own words, never the Edison course's sentences. Every format fact comes from a source in research/sources.md,
 named on the page where it matters. Write apostrophes only inside backtick strings. */
window.GOAT_LESSONS_101 = function ({ cn, call }) {
  const src = (items) => `<p class="srcnote">Sources: ${items.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`).join(', ')}.</p>`;
  const GF = (page, label) => [label || `goatformat.com, ${page}`, `https://www.goatformat.com/${page}`];
  const YPD = ['YGOPRODeck, An Introduction to Goat Format', 'https://ygoprodeck.com/an-introduction-to-goat-format/'];
  return [
  {
    n: 1, title: 'Welcome to 2005', sub: 'What Goat format is, where the name comes from, and why people still play it.', min: 6,
    cards: ['Scapegoat', 'Metamorphosis', 'Thousand-Eyes Restrict', 'Chaos Sorcerer', 'Black Luster Soldier - Envoy of the Beginning'],
    html: `
<div class="goals"><h4>What you will learn</h4><ul><li>What a format is, and what makes Goat one</li><li>Where the name comes from</li><li>Why so many players still choose it today</li></ul></div>
<h2>What is a format?</h2>
<p>A format is a set of rules for which cards you may use. Today's official game adds new cards every few months and changes its banlist often. A <b>retro format</b> does the opposite: it freezes the game at one moment in the past, with the cards and rules of that time, and keeps it there.</p>
<h2>Goat: the game as it stood in 2005</h2>
<p>Goat format is Yu-Gi-Oh! as it was played at big tournaments in the summer of 2005. The cards are the ones released up to that point, and the banlist is the official one from April 2005. Konami no longer supports it. Players run it themselves, with their own events and rules site.</p>
<h2>Where the name comes from</h2>
<p>The format is named after ${cn('Scapegoat')}, a Quick-Play Spell that puts four Sheep Tokens on your field at once. It was everywhere in 2005. The most popular deck of the time, Goat Control, paired it with ${cn('Metamorphosis')}: send one Sheep Token away and bring out a Level 1 Fusion, ${cn('Thousand-Eyes Restrict')}, which can take your opponent's monster for itself.</p>
${call('analogy', 'Think of it like this', `<p>Four sheep that can't attack sound useless. In Goat they are shields, Tributes and Fusion fuel all at once. That is the kind of puzzle this format is full of.</p>`)}
<h2>Why people still play it</h2>
<ul>
<li><b>Every card counts.</b> Games are slower and more careful than modern Yu-Gi-Oh!. Winning usually comes from making good trades and ending up with more cards than your opponent.</li>
<li><b>It never changes.</b> No new sets, no new banlists. Once you learn it, your knowledge keeps its value.</li>
<li><b>Many decks can play.</b> Control decks, aggressive Warrior decks, Burn and more all have a place.</li>
<li><b>It is cheap to build.</b> Most decks cost little next to a modern one, with a few pricey exceptions like ${cn('Black Luster Soldier - Envoy of the Beginning')}.</li>
<li><b>It is alive.</b> The community runs regular tournaments, including a yearly World Championship, and plays online on DuelingBook.</li>
</ul>
<h2>Famous faces</h2>
<p>A handful of cards shape almost every Goat game. You'll meet them properly in lesson 6, but here is a first look.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Scapegoat')}</td><td>Four tokens out of nowhere, on either player's turn.</td></tr>
<tr><td>${cn('Thousand-Eyes Restrict')}</td><td>Steals a monster and stops other monsters from attacking.</td></tr>
<tr><td>${cn('Chaos Sorcerer')}</td><td>Comes out from your hand and removes a monster from play.</td></tr>
<tr><td>${cn('Black Luster Soldier - Envoy of the Beginning')}</td><td>3000 ATK, removes a monster or attacks twice.</td></tr>
</tbody></table></div>
<div class="recap"><h2>Recap</h2><ul><li>A retro format freezes the card pool and rules at one point in time.</li><li>Goat is the summer of 2005, with the April 2005 banlist.</li><li>It is named after Scapegoat and the Goat Control deck built around it.</li><li>People play it for its careful, card-by-card games, its fixed pool and its active community.</li></ul></div>
${src([GF('whatisgoat.html', 'goatformat.com, What is Goat Format?'), GF('whygoat.html', 'goatformat.com, Why Goat?'), YPD])}`,
    flash: [
      ['What does a retro format do?', 'It freezes the cards and rules at one moment in the past.'],
      ['Which card is Goat format named after?', 'Scapegoat.'],
      ['Which banlist does Goat use?', 'The official TCG list from April 2005.'],
      ['What did Goat Control pair with Scapegoat?', 'Metamorphosis, to turn a Sheep Token into Thousand-Eyes Restrict.'],
      ['Who runs Goat format today?', 'The players themselves. Konami no longer supports it.']
    ]
  },
  {
    n: 2, title: 'How a Goat Match Works', sub: 'Best of three, siding, deck sizes and the 2005 rules that differ from today.', min: 7,
    cards: ['Scapegoat', 'Thousand-Eyes Restrict'],
    html: `
<div class="goals"><h4>What you will learn</h4><ul><li>How a match is played and won</li><li>What changes between games of a match</li><li>The 2005 rules a modern player gets wrong</li></ul></div>
<h2>A match is best of three</h2>
<p>At a tournament you don't play one Duel against an opponent, you play a <b>match</b>. Whoever takes two Duels first takes the match. Goat events don't use match draws: matches are played out to two wins.</p>
<h2>Between games: the Side Deck</h2>
<p>After the first Duel you may swap cards between your Side Deck and your Main or Fusion Deck, one for one, so your counts stay the same. This lets you bring in answers to what your opponent showed you. In 2005 rules the Side Deck is either empty or exactly 15 cards, though few events check that today.</p>
<h2>Deck sizes in 2005</h2>
<div class="tbl-wrap"><table><thead><tr><th>Deck</th><th>Size</th><th>Description</th></tr></thead><tbody>
<tr><td>Main Deck</td><td>40 or more</td><td>2005 rules set no top limit, but DuelingBook stops at 60, and almost everyone plays 40.</td></tr>
<tr><td>Fusion Deck</td><td>No limit</td><td>Fusion monsters only. Online simulators may cap it.</td></tr>
<tr><td>Side Deck</td><td>0 or 15</td><td>Traded in after a Duel ends.</td></tr>
</tbody></table></div>
<h2>The 2005 rules that catch modern players</h2>
<p>If you learned Yu-Gi-Oh! in recent years, a few things work differently in Goat. Here are the big ones.</p>
<div class="tbl-wrap"><table><thead><tr><th>Rule</th><th>Description</th></tr></thead><tbody>
<tr><td>First turn</td><td>The player going first draws in their first Draw Phase, but can't attack that turn.</td></tr>
<tr><td>Fusion Deck</td><td>There is no Extra Monster Zone and no Synchro, Xyz, Pendulum or Link monsters. Fusions go to your regular Monster Zones.</td></tr>
<tr><td>One Field Spell</td><td>Only one Field Spell can be face-up for both players. Playing a second one wipes out the first.</td></tr>
<tr><td>Priority</td><td>After a summon or a Chain finishes, the turn player gets the first chance to act again.</td></tr>
<tr><td>The Damage Step</td><td>Very strict. Almost nothing can be used while an attack is being worked out.</td></tr>
<tr><td>Old rulings</td><td>Cards are ruled the way a head judge would have ruled them in 2005, even when today's rulings differ.</td></tr>
</tbody></table></div>
${call('rule', 'More in Goat 201', `<p>Priority, the order of triggers in a Chain and the Damage Step get their own lesson in Goat 201, lesson 8. For now it is enough to know they work a little differently.</p>`)}
<h2>Where to play</h2>
<p>Most Goat games today happen online on DuelingBook, which has a Goat room and a deck builder limited to the Goat card pool. In person, local groups and the community's own events run on the same rules.</p>
${call('mistake', 'Common mistakes', `<ul><li>Skipping your first draw out of habit when you go first.</li><li>Looking for an Extra Monster Zone. There isn't one.</li><li>Siding in a card without siding one out.</li></ul>`)}
<div class="recap"><h2>Recap</h2><ul><li>A match is won by the first player to win two Duels.</li><li>Side Deck cards come in after a Duel, each one replacing a card that goes out.</li><li>Main Deck 40 or more (60 online), Fusion Deck any size, Side Deck 0 or 15.</li><li>The first player draws, Fusions use regular zones, and 2005 rulings apply.</li></ul></div>
${src([GF('basics.html', 'goatformat.com, Goat Format Rules'), GF('rules.html', 'goatformat.com, Rules and Policies'), GF('gettingintogoat.html', 'goatformat.com, Getting Into Goat')])}`,
    flash: [
      ['How many Duel wins does it take to win a match?', 'Two.'],
      ['How many cards can a Side Deck have in 2005 rules?', 'Exactly 0 or exactly 15.'],
      ['Is there an Extra Monster Zone in Goat?', 'No. Fusions go to your regular Monster Zones.'],
      ['Going first in Goat, do you draw on your first turn? Can you attack?', 'You draw, but you can\u2019t attack that turn.'],
      ['Where do most people play Goat online?', 'DuelingBook.'],
      ['You side in 2 cards. What else must you do?', 'Side out 2 cards, so your deck sizes stay the same.']
    ]
  },
  {
    n: 3, title: 'Reading 2005 Card Text', sub: 'Old words, missing limits, and how to tell what a card did in 2005.', min: 7,
    cards: ['Sangan', 'Chaos Sorcerer', 'Mystical Space Typhoon', 'Breaker the Magical Warrior'],
    html: `
<div class="goals"><h4>What you will learn</h4><ul><li>The old words on Goat-era cards and what they mean now</li><li>Why a card's modern text can mislead you</li><li>The everyday words of card text: destroy, send, target, cost</li></ul></div>
<h2>Old words, same meaning</h2>
<p>Cards printed before 2006 use wording that has since changed. The cards still work the same way. Here is a translation table.</p>
<div class="tbl-wrap"><table><thead><tr><th>2005 wording</th><th>Today</th><th>Description</th></tr></thead><tbody>
<tr><td>Remove from play</td><td>Banish</td><td>The card goes face-up to its own pile outside the Graveyard.</td></tr>
<tr><td>Magic Card</td><td>Spell Card</td><td>Early printings only.</td></tr>
<tr><td>Fusion Deck</td><td>Extra Deck</td><td>The pile your Fusion monsters wait in.</td></tr>
<tr><td>Select</td><td>Target</td><td>Old cards often say "select" where newer ones say "target".</td></tr>
</tbody></table></div>
<h2>Modern text can add limits</h2>
<p>Over the years Konami reworded many old cards and sometimes added limits they didn't have in 2005. Goat plays cards the way they worked back then, so the newest text is not always the right one.</p>
${call('key', 'Example: Sangan', `<p>Today's text for ${cn('Sangan')} says you can use its effect only once per turn, and you can't use the card you fetch for the rest of that turn. The 2005 card carries neither restriction. Every time Sangan leaves the field for the Graveyard, you search your Deck for any monster whose ATK is 1500 or lower and put it in your hand. In Goat, that is how it works.</p>`)}
<p>When a card seems weaker than people say, check whether its modern text added something. The card pages on this site show the current wording from the card database, so treat any "once per turn" on an old card with care.</p>
<h2>The everyday words</h2>
<div class="tbl-wrap"><table><thead><tr><th>Word</th><th>Description</th></tr></thead><tbody>
<tr><td>Destroy</td><td>The card is sent to the Graveyard by an effect or a battle. Some cards protect against this.</td></tr>
<tr><td>Send to the Graveyard</td><td>Moves a card there without destroying it, so "when destroyed" effects don't trigger.</td></tr>
<tr><td>Remove from play</td><td>Away from the Graveyard, where most cards can't reach it. ${cn('Chaos Sorcerer')} does this.</td></tr>
<tr><td>Target or select</td><td>The card points at one specific card. ${cn('Mystical Space Typhoon')} picks one Spell or Trap.</td></tr>
<tr><td>Cost</td><td>The price of using a card, such as Life Points, a discard or a Tribute. It stays spent even if the card fails.</td></tr>
<tr><td>Negate</td><td>Cancels a card or effect so it does nothing.</td></tr>
<tr><td>Counter</td><td>A marker placed on a card. ${cn('Breaker the Magical Warrior')} gets a Spell Counter and can remove it to destroy a Spell or Trap.</td></tr>
</tbody></table></div>
${call('mistake', 'Common mistakes', `<ul><li>Reading "remove from play" as "destroy". The card skips the Graveyard entirely.</li><li>Applying a modern "once per turn" to an old card without checking.</li></ul>`)}
<div class="recap"><h2>Recap</h2><ul><li>Remove from play means banish. Magic Card means Spell Card. Fusion Deck means Extra Deck.</li><li>Goat uses how cards worked in 2005, so newer text can add limits that don't apply.</li><li>Destroy and send to the Graveyard are not the same thing.</li><li>Costs stay paid when a card is stopped.</li></ul></div>
${src([GF('rules.html', 'goatformat.com, Rules and Policies'), GF('basics.html', 'goatformat.com, Goat Format Rules')])}`,
    flash: [
      ['What does "remove from play" mean today?', 'Banish.'],
      ['In Goat, is Sangan limited to once per turn?', 'No. Its 2005 text has no such limit.'],
      ['Is "send to the Graveyard" the same as "destroy"?', 'No. A sent card was not destroyed, so "when destroyed" effects don’t trigger.'],
      ['You paid 1000 LP for a card that got negated. Are the 1000 LP returned?', 'No. Costs stay paid.'],
      ['What did early cards call Spell Cards?', 'Magic Cards.']
    ]
  },
  {
    n: 4, title: 'The Card Pool and the Banlist', sub: 'Which cards are legal, and the April 2005 Forbidden and Limited List.', min: 7,
    cards: ['Monster Reborn', 'Dark Hole', 'Raigeki', 'Pot of Greed', 'Graceful Charity', 'Nobleman of Crossout'],
    html: `
<div class="goals"><h4>What you will learn</h4><ul><li>Which cards are legal in Goat</li><li>What Forbidden, Limited and Semi-Limited mean</li><li>The cards on the April 2005 list you'll hear about most</li></ul></div>
<h2>The card pool</h2>
<p>Goat follows a single cutoff: every card that was legal at big tournaments on August 17, 2005. That takes in every main set from Legend of Blue Eyes White Dragon through The Lost Millennium, plus the starter decks and promo cards of that time. Exarion Universe and Cybernetic Revolution came out around then but are <b>not</b> legal in the standard version of Goat.</p>
${call('rule', 'Other versions exist', `<p>Some groups play a version with Exarion Universe added, and a few others. This site teaches the standard one, which goatformat.com and DuelingBook use.</p>`)}
<p>Classics like ${cn('Pot of Greed')} are in. Nothing from 2006 or later is. The <a href="#cards">Card search</a> on this site holds only Goat-legal cards, so anything you find there is in the pool.</p>
<h2>Three limits</h2>
<div class="tbl-wrap"><table><thead><tr><th>Status</th><th>Copies</th><th>Description</th></tr></thead><tbody>
<tr><td>Forbidden</td><td>0</td><td>Can't be played at all.</td></tr>
<tr><td>Limited</td><td>1</td><td>One copy in your Main, Fusion and Side Deck combined.</td></tr>
<tr><td>Semi-Limited</td><td>2</td><td>Up to two copies.</td></tr>
<tr><td>Unlimited</td><td>3</td><td>Every card not on the list.</td></tr>
</tbody></table></div>
<h2>The April 2005 list</h2>
<p>Goat uses the official TCG list that took effect in April 2005, unchanged: 17 Forbidden cards, 41 Limited and 15 Semi-Limited. The full list is on the <a href="#banlist">Banlist</a> page.</p>
<p>A few Forbidden cards stand out because they are famous elsewhere: ${cn('Monster Reborn')}, ${cn('Dark Hole')} and ${cn('Raigeki')} are all off the table. That shapes the whole format: without them, wiping the board or bringing a monster back takes much more work.</p>
<p>Limited cards show up in nearly every deck at one copy. ${cn('Pot of Greed')} draws 2 cards for nothing, and ${cn('Graceful Charity')} draws 3 and discards 2. ${cn('Nobleman of Crossout')}, which removes a Set monster from play, is Semi-Limited.</p>
${call('analogy', 'Think of it like this', `<p>The Limited list is a shopping list. Most Goat decks pick up the same one-of power cards first, then fill the rest of the deck with their own plan.</p>`)}
<div class="recap"><h2>Recap</h2><ul><li>Goat-legal cards are those legal on August 17, 2005: through The Lost Millennium, not Exarion Universe or Cybernetic Revolution.</li><li>Forbidden is 0 copies, Limited 1, Semi-Limited 2, everything else 3.</li><li>The April 2005 list has 17 Forbidden, 41 Limited and 15 Semi-Limited cards.</li><li>Monster Reborn, Dark Hole and Raigeki are Forbidden.</li></ul></div>
${src([GF('cardpool.html', 'goatformat.com, Card Pool and Banlist'), YPD])}`,
    flash: [
      ['What date sets the Goat card pool?', 'August 17, 2005: every card legal at big events that day.'],
      ['Is Cybernetic Revolution legal in standard Goat?', 'No. Neither is Exarion Universe.'],
      ['How many copies of a Limited card can you play?', 'One, across Main, Fusion and Side Deck.'],
      ['Is Monster Reborn legal in Goat?', 'No. It is Forbidden.'],
      ['Which banlist does Goat use, and is it changed?', 'The April 2005 TCG list, unchanged.'],
      ['How many cards are Forbidden on the Goat list?', '17.']
    ]
  },
  {
    n: 5, title: 'The Staples', sub: 'The cards almost every Goat deck plays, and what each one does for you.', min: 9,
    cards: ['Pot of Greed', 'Graceful Charity', 'Heavy Storm', 'Ring of Destruction', 'Snatch Steal', 'Sangan', 'Book of Moon', 'Nobleman of Crossout', 'Mirror Force', 'Delinquent Duo', 'Sinister Serpent', 'Torrential Tribute'],
    html: `
<div class="goals"><h4>What you will learn</h4><ul><li>What a staple is, and why Goat has so many</li><li>The staple Spells, Traps and monsters, one by one</li><li>Why each one earns its slot</li></ul></div>
<h2>What makes a card a staple</h2>
<p>A staple is a card that shows up in most decks no matter what those decks are trying to do. Goat has a lot of them because so many of the best cards are generic: they draw cards, remove anything, or steal monsters, so every deck wants them.</p>
<p>The counts below come from the 12 deck lists in tiers A to D on this site, which are taken from goatformat.com's deck guides. A card counts once per deck that runs it.</p>
<h2>Spells</h2>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Decks</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Pot of Greed')}</td><td>12 of 12</td><td>Draw 2. One card turns into two, for free.</td></tr>
<tr><td>${cn('Graceful Charity')}</td><td>12 of 12</td><td>Draw 3, then discard 2. You see more of your deck and keep the best.</td></tr>
<tr><td>${cn('Heavy Storm')}</td><td>10 of 12</td><td>Wipes out all Spell and Trap Cards on both sides of the table.</td></tr>
<tr><td>${cn('Snatch Steal')}</td><td>9 of 12</td><td>Takes your opponent's monster for as long as it stays equipped. They gain 1000 LP each of their Standby Phases.</td></tr>
<tr><td>${cn('Book of Moon')}</td><td>8 of 12</td><td>A Quick-Play Spell that turns a face-up monster face-down. It stops an attack, and it resets your own Flip monsters.</td></tr>
<tr><td>${cn('Nobleman of Crossout')}</td><td>8 of 12</td><td>Destroys a face-down monster and removes it from play. A Flip monster hit this way also loses its copies from both Decks.</td></tr>
<tr><td>${cn('Delinquent Duo')}</td><td>7 of 12</td><td>Pay 1000 LP: your opponent discards one card at random and one of their choice.</td></tr>
<tr><td>${cn('Mystical Space Typhoon')}</td><td>7 of 12</td><td>Destroys one Spell or Trap, on either player's turn once Set.</td></tr>
</tbody></table></div>
${call('rule', 'All on the banlist', `<p>Pot of Greed, Graceful Charity, Heavy Storm, Snatch Steal, Delinquent Duo and Mystical Space Typhoon are Limited, so a deck runs one of each. Nobleman of Crossout is Semi-Limited. Book of Moon isn't on the list, so decks often play all three.</p>`)}
<h2>Traps</h2>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Decks</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Ring of Destruction')}</td><td>10 of 12</td><td>Destroys a face-up monster and deals damage equal to its ATK to both players.</td></tr>
<tr><td>${cn('Mirror Force')}</td><td>8 of 12</td><td>When your opponent attacks, destroy every Attack Position monster they control.</td></tr>
<tr><td>${cn('Torrential Tribute')}</td><td>7 of 12</td><td>Springs on any summon and clears all monsters from both sides.</td></tr>
<tr><td>${cn('Sakuretsu Armor')}</td><td>5 of 12</td><td>Destroys the monster that just declared an attack.</td></tr>
<tr><td>${cn('Trap Dustshoot')}</td><td>5 of 12</td><td>Only when your opponent holds 4 or more cards: look at their hand and shuffle a monster from it back into their Deck.</td></tr>
</tbody></table></div>
${call('key', 'Ring of Destruction in 2005', `<p>Today's text only works on your opponent's turn, only on a monster whose ATK is no higher than their LP, and once a turn. The 2005 printing had none of those limits, and Goat plays the 2005 version. That makes it a finisher too: if both players are low, the player who survives the damage wins.</p>`)}
<h2>Monsters</h2>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Decks</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Black Luster Soldier - Envoy of the Beginning')}</td><td>8 of 12</td><td>The strongest monster in the format. Lesson 6.</td></tr>
<tr><td>${cn('Breaker the Magical Warrior')}</td><td>8 of 12</td><td>Destroys a Spell or Trap and stays behind as a 1600 ATK body. Lesson 6.</td></tr>
<tr><td>${cn('Sangan')}</td><td>8 of 12</td><td>Leaves the field, and you search your Deck for a monster with 1500 or less ATK.</td></tr>
<tr><td>${cn('Chaos Sorcerer')}</td><td>7 of 12</td><td>Comes out free from the hand and removes a face-up monster from play. Lesson 6.</td></tr>
<tr><td>${cn('Sinister Serpent')}</td><td>5 of 12</td><td>A Level 1 monster that keeps coming back to your hand from the Graveyard.</td></tr>
</tbody></table></div>
${call('key', 'Sinister Serpent in 2005', `<p>Its 2005 text lets you return it from the Graveyard to your hand in each of your Standby Phases. That makes it free discard fodder for cards like Graceful Charity, and a Level 1 Tribute for Metamorphosis, again and again.</p>`)}
<h2>Why these cards and not others</h2>
<p>Look at what they have in common. Pot of Greed and Graceful Charity make your hand better. Heavy Storm, Mystical Space Typhoon and Breaker clear Traps. Snatch Steal and Ring of Destruction handle the biggest monster on the field. Sangan and Sinister Serpent replace themselves. None of them care what deck you play, so every deck starts with them and builds around them.</p>
${call('mistake', 'Common mistakes', `<ul><li>Using Heavy Storm while your own Set cards could be used first. Chain them before it resolves, or wait.</li><li>Playing Delinquent Duo into a hand of one card. It takes two only when they hold two or more.</li></ul>`)}
<div class="recap"><h2>Recap</h2><ul><li>A staple is a generic card that most decks play.</li><li>Pot of Greed and Graceful Charity are in all 12 site decks.</li><li>Most staples are Limited, so each deck plays one copy.</li><li>Ring of Destruction and Sinister Serpent work the 2005 way: no once-a-turn limits.</li></ul></div>
${src([GF('home/transition-sidedecking-for-goat-format', 'goatformat.com, Transition Sidedecking'), GF('home/introduction-to-goat-format-power-cards-part-2', 'goatformat.com, Power Cards Part 2'), GF('decks.html', 'goatformat.com, deck guides')])}`,
    flash: [
      ['Which two staples are in all 12 goatformat.com guide lists on this site?', 'Pot of Greed and Graceful Charity.'],
      ['What does Book of Moon do to your own Flip monster?', 'Turns it face-down again, so it can be flipped and used again.'],
      ['Who takes damage from Ring of Destruction?', 'Both players, equal to the destroyed monster’s ATK.'],
      ['When can Trap Dustshoot be used?', 'Only when your opponent holds 4 or more cards.'],
      ['What happens to Snatch Steal’s owner’s opponent each Standby Phase?', 'The player who lost the monster gains 1000 LP in each of their Standby Phases.'],
      ['Why is Sinister Serpent so useful in Goat?', 'It returns from the Graveyard to your hand every Standby Phase, so it is free discard fodder and a Level 1 Tribute.']
    ]
  },
  {
    n: 6, title: 'The Power Monsters', sub: 'Black Luster Soldier, Chaos Sorcerer, Breaker and Thousand-Eyes Restrict.', min: 9,
    cards: ['Black Luster Soldier - Envoy of the Beginning', 'Chaos Sorcerer', 'Breaker the Magical Warrior', 'Thousand-Eyes Restrict', 'Metamorphosis', 'Scapegoat', 'Tribe-Infecting Virus', 'Jinzo', 'Airknight Parshath'],
    html: `
<div class="goals"><h4>What you will learn</h4><ul><li>The four monsters that shape most Goat games</li><li>How each one comes out, and what it does once it lands</li><li>How to answer them</li></ul></div>
<h2>Black Luster Soldier - Envoy of the Beginning</h2>
<p>${cn('Black Luster Soldier - Envoy of the Beginning')} is a Level 8 with 3000 ATK. You can't Normal Summon it. Instead you Special Summon it from your hand by removing one LIGHT and one DARK monster in your Graveyard from play. No Tributes needed.</p>
<p>Once per turn it picks one of two things: remove a monster on the field from play (then it can't attack that turn), or, if it destroys a monster in battle, attack a second time in a row. It is Limited, and the YGOPRODeck introduction calls it the queen of the format.</p>
${call('key', 'Why LIGHT and DARK matter', `<p>Goat decks are built so their Graveyard fills with both: Sangan and Breaker are DARK, Magician of Faith and Shining Angel are LIGHT. That is why so many staples share those two Attributes.</p>`)}
<h2>Chaos Sorcerer</h2>
<p>${cn('Chaos Sorcerer')} comes out the same way, for one LIGHT and one DARK from your Graveyard. It has 2300 ATK, and once per turn it removes a face-up monster from play, giving up its attack that turn. It isn't on the banlist, so decks built around it play two or three.</p>
<h2>Breaker the Magical Warrior</h2>
<p>${cn('Breaker the Magical Warrior')} gets a Spell Counter when it is Normal Summoned, which gives it 300 more ATK. Remove the counter to destroy one Spell or Trap. One card clears a Set card and still leaves a 1600 ATK monster on the field. It only gets the counter from a Normal Summon, so a Breaker that is Set and flipped later has no counter.</p>
<h2>Thousand-Eyes Restrict</h2>
<p>${cn('Thousand-Eyes Restrict')} is a Level 1 Fusion with 0 ATK. Hardly anyone uses its Fusion materials. Instead they play ${cn('Metamorphosis')}: Tribute a Level 1 monster and Special Summon a Fusion of the same Level from the Fusion Deck. A Sheep Token from ${cn('Scapegoat')}, Sinister Serpent or Magician of Faith all work.</p>
<p>Once it lands, no other monster on the field can attack or change its position, yours included. Once per turn it takes one of your opponent's monsters and equips it, copying that monster's ATK and DEF. If Restrict would be destroyed in battle, the equipped monster goes instead.</p>
${call('analogy', 'Think of it like this', `<p>Restrict is a wall that also steals. Your opponent loses a monster, can't attack with the rest, and has to find an answer that isn't battle.</p>`)}
<h2>Other big names</h2>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Tribe-Infecting Virus')}</td><td>Discard a card and name a Type: every face-up monster of that Type is destroyed.</td></tr>
<tr><td>${cn('Jinzo')}</td><td>While it is face-up, no one can use Trap Cards.</td></tr>
<tr><td>${cn('Airknight Parshath')}</td><td>A Level 5 that deals piercing damage and draws a card each time it hits your opponent.</td></tr>
</tbody></table></div>
<h2>Answering them</h2>
<ul>
<li>Answers outside of battle: Ring of Destruction, Snatch Steal and Book of Moon. Sakuretsu Armor only works when a monster declares an attack.</li>
<li>Book of Moon on Restrict turns it face-down, which ends the lock and drops the stolen monster to the Graveyard.</li>
<li>Black Luster Soldier and Chaos Sorcerer need a LIGHT and a DARK in the Graveyard. Cards that remove monsters from the Graveyard, like ${cn('Kycoo the Ghost Destroyer')}, slow them down.</li>
</ul>
${call('mistake', 'Common mistakes', `<ul><li>Attacking with your other monsters after summoning Thousand-Eyes Restrict. They can't. Attack first, then bring it out in Main Phase 2.</li><li>Setting Breaker and expecting a counter when it flips.</li></ul>`)}
<div class="recap"><h2>Recap</h2><ul><li>Black Luster Soldier and Chaos Sorcerer each need one LIGHT and one DARK removed from your Graveyard.</li><li>Black Luster Soldier removes a monster or attacks twice. Chaos Sorcerer removes a face-up monster.</li><li>Breaker destroys a Spell or Trap and stays as a 1600 ATK monster.</li><li>Thousand-Eyes Restrict comes from Metamorphosis, stops all other attacks and steals a monster.</li></ul></div>
${src([YPD, GF('goat-control.html', 'goatformat.com, Goat Control guide'), GF('chaos-control.html', 'goatformat.com, Chaos Control guide')])}`,
    flash: [
      ['How do you summon Black Luster Soldier - Envoy of the Beginning?', 'Special Summon it from your hand by removing 1 LIGHT and 1 DARK monster in your Graveyard from play.'],
      ['Chaos Sorcerer removes a monster. Can it still attack that turn?', 'No.'],
      ['Your Breaker was Set and later flipped up. Does it get a Spell Counter?', 'No. Only a Normal Summon gives it the counter.'],
      ['How do most decks bring out Thousand-Eyes Restrict?', 'With Metamorphosis, Tributing a Level 1 monster such as a Sheep Token.'],
      ['Thousand-Eyes Restrict is on your field. Can your other monsters attack?', 'No. No other monster on the field can attack or change position.'],
      ['How can Book of Moon answer Thousand-Eyes Restrict?', 'It turns Restrict face-down, which ends its lock and sends the stolen monster to the Graveyard.']
    ]
  },
  {
    n: 7, title: 'Your First Goat Game', sub: 'Seven turns of a real game, step by step, with the reasons behind each play.', min: 12,
    cards: ['Magician of Faith', 'Pot of Greed', 'Scapegoat', 'Book of Moon', 'Mirror Force', 'Metamorphosis', 'Thousand-Eyes Restrict', 'Blade Knight', 'Exiled Force'],
    html: `
<div class="goals"><h4>What you will learn</h4><ul><li>How the staples and power monsters work together in a game</li><li>How to reuse a Flip monster</li><li>When to use Scapegoat, and when to bring out Thousand-Eyes Restrict</li></ul></div>
<p>Ana plays a Goat Control deck. Ben plays a Warrior deck. Both start at 8000 LP. Ana goes first. Every play below follows the 2005 rules from lessons 2 to 6, so try to call each move before you read it.</p>
<h2>Turn 1: Ana</h2>
<ol class="steps">
<li><div><b>Draw.</b> Ana starts with ${cn('Scapegoat')}, ${cn('Magician of Faith')}, ${cn('Book of Moon')}, Sakuretsu Armor, ${cn('Pot of Greed')} and Breaker the Magical Warrior (6 cards).</div></li>
<li><div><b>Main Phase 1.</b> Pot of Greed draws Metamorphosis and Sangan (7 cards).</div></li>
<li><div>She Sets Magician of Faith in Defense Position, then Sets Sakuretsu Armor and Scapegoat (4 cards left).</div></li>
<li><div>No Battle Phase on the first turn. Ana ends with Book of Moon, Breaker, Metamorphosis and Sangan in hand.</div></li>
</ol>
<h2>Turn 2: Ben</h2>
<ol class="steps">
<li><div>Ben draws (6 cards) and Normal Summons ${cn('Blade Knight')}, 1600 ATK.</div></li>
<li><div>He attacks the face-down monster. Ana flips Sakuretsu Armor and destroys Blade Knight before the attack lands.</div></li>
<li><div>In Main Phase 2 Ben Sets two cards: Sakuretsu Armor and Call of the Haunted (3 cards left).</div></li>
</ol>
<h2>Turn 3: Ana</h2>
<ol class="steps">
<li><div>Ana draws Nobleman of Crossout (5 cards).</div></li>
<li><div>She Flip Summons Magician of Faith. Its Flip effect returns a Spell from her Graveyard to her hand. She picks Pot of Greed, plays it again and draws Graceful Charity and Mirror Force (7 cards).</div></li>
<li><div>She Normal Summons Breaker (1900 ATK with its counter), then removes the counter to destroy one of Ben's Set cards: his Sakuretsu Armor. Breaker drops to 1600.</div></li>
<li><div><b>Battle.</b> Breaker attacks directly. Ben answers with Call of the Haunted, bringing Blade Knight back in Attack Position. The number of monsters changed, so Ana gets a replay: she can pick a new target or stop. Breaker and Blade Knight both have 1600 ATK, and she would rather keep Breaker, so she stops.</div></li>
<li><div><b>Main Phase 2.</b> Ana Sets Mirror Force, then plays Book of Moon on her <b>own</b> Magician of Faith. It was Flip Summoned this turn, so she couldn't change its position by hand, but a card effect can. Now it is face-down, ready to flip again (4 cards left).</div></li>
</ol>
${call('key', 'The Goat Control loop', `<p>Magician of Faith brings back a Spell, and Book of Moon turns it face-down so it can do it again. Under the June 2005 rules, being turned face-down by a card doesn't use up the monster's position change. Goat Control is built on loops like this one.</p>`)}
<h2>Turn 4: Ben</h2>
<ol class="steps">
<li><div>Ben draws (4 cards) and Normal Summons ${cn('Exiled Force')}, then Tributes it to destroy Breaker.</div></li>
<li><div>Blade Knight attacks the face-down Magician of Faith. Ana flips ${cn('Mirror Force')}: Blade Knight is destroyed, and Call of the Haunted goes with it, since its monster left the field.</div></li>
<li><div>Ben Sets one card and ends his turn (2 cards).</div></li>
<li><div>In Ben's End Phase, Ana activates Scapegoat. Four Sheep Tokens arrive in Defense Position.</div></li>
</ol>
${call('key', 'Why the End Phase?', `<p>Scapegoat stops you from summoning other monsters the turn you use it. Using it at the end of your opponent's turn costs you nothing, and the tokens are ready for your own turn.</p>`)}
<h2>Turn 5: Ana</h2>
<ol class="steps">
<li><div>Ana draws Tsukuyomi (5 cards). She Flip Summons Magician of Faith again and gets Pot of Greed back once more. Pot of Greed draws Heavy Storm and Black Luster Soldier (7 cards).</div></li>
<li><div>Heavy Storm destroys Ben's Set card, a second Sakuretsu Armor.</div></li>
<li><div>Black Luster Soldier stays in her hand. Her Graveyard has a DARK monster (Breaker) but no LIGHT one yet.</div></li>
<li><div><b>Battle.</b> Ben has no monsters, so Magician of Faith attacks directly for 300. Ben is at 7700.</div></li>
<li><div><b>Main Phase 2.</b> Now ${cn('Metamorphosis')}: she Tributes one Sheep Token and brings out ${cn('Thousand-Eyes Restrict')}. She waited until after the Battle Phase, because once Restrict is out her other monsters can't attack (5 cards left).</div></li>
</ol>
<h2>Turn 6: Ben</h2>
<ol class="steps">
<li><div>Ben draws (3 cards) and Normal Summons D.D. Warrior Lady. Restrict stops it from attacking.</div></li>
<li><div>He Sets one card and ends his turn (1 card).</div></li>
</ol>
<h2>Turn 7: Ana</h2>
<ol class="steps">
<li><div>Ana draws (6 cards). Restrict equips D.D. Warrior Lady and becomes 1500 ATK, 1600 DEF.</div></li>
<li><div>Restrict attacks directly. Ben flips his Set card, Waboku, and takes no battle damage this turn.</div></li>
</ol>
<h2>Where the game stands</h2>
<div class="tbl-wrap"><table><thead><tr><th>Player</th><th>Field</th><th>Hand</th><th>Life Points</th></tr></thead><tbody>
<tr><td>Ana</td><td>Restrict (with D.D. Warrior Lady), Magician of Faith, 3 Sheep Tokens</td><td>6</td><td>8000</td></tr>
<tr><td>Ben</td><td>Nothing</td><td>1</td><td>7700</td></tr>
</tbody></table></div>
<p>After seven turns Ben has lost only 300 LP, yet he is far behind: one card in hand against six, and nothing on the field. That is a typical Goat game. The player with more cards nearly always wins in the end, and Ana's job now is to keep her lock and grind Ben down.</p>
${call('mistake', 'What Ben could have done better', `<ul><li>Attacking into two Set cards on turn 4 walked into Mirror Force.</li><li>Playing his monsters one at a time into Ana's Traps gave her a one-for-one trade every turn while her Magician of Faith kept refilling her hand.</li></ul>`)}
<div class="recap"><h2>Recap</h2><ul><li>Magician of Faith and Book of Moon make a loop that reuses your best Spells.</li><li>Use Scapegoat at the end of your opponent's turn.</li><li>Attack first, then bring out Thousand-Eyes Restrict in Main Phase 2.</li><li>Count cards, not Life Points, to see who is winning.</li></ul></div>`,
    flash: [
      ['Ana Flip Summoned Magician of Faith this turn. Can Book of Moon still turn it face-down?', 'Yes. The no-change rule only covers changing position by hand, not card effects.'],
      ['Why does Ana use Scapegoat in Ben’s End Phase?', 'Scapegoat stops you summoning other monsters that turn, so using it on the opponent’s turn costs nothing.'],
      ['Ben’s Call of the Haunted brings back a monster during Ana’s attack. What can Ana do?', 'She gets a replay: choose a new target, or stop attacking.'],
      ['Why didn’t Ana summon Thousand-Eyes Restrict before her Battle Phase on turn 5?', 'Restrict stops all other monsters from attacking, so her Magician of Faith couldn’t have attacked.'],
      ['Why couldn’t Ana summon Black Luster Soldier on turn 5?', 'Her Graveyard had no LIGHT monster yet.'],
      ['What happened to Call of the Haunted when Mirror Force destroyed Blade Knight?', 'It was destroyed too, because its monster left the field.']
    ]
  }
  ];
};
