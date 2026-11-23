/* Step 0: How to play Yu-Gi-Oh! (Goat course). Written fresh for Goat in our own words, never reusing the Edison
 course's sentences. Facts about cards come from data/cards.js; rules facts from the sources in research/sources.md.
 Lessons are {n, title, sub, min, cards:[card names], html, flash:[[question, answer]]}; n is a string so Step 0 never
 mixes with numbered lessons. Write apostrophes only inside backtick strings. */
window.GOAT_STEP0 = function ({ cn, call }) {
  const skip = `<div class="skipbar"><span>Played Yu-Gi-Oh! before? You can skip the basics.</span><a class="btn small" href="#lesson-1">Go to Goat 101 →</a></div>`;
  return [
  {
    n: '0.1', title: 'The Goal of the Game', sub: 'What Yu-Gi-Oh! is, how a game is won, and what each player brings.', min: 6,
    cards: ['Summoned Skull', 'Exodia the Forbidden One', 'Pot of Greed'],
    html: `${skip}
<div class="goals"><h4>What you will learn</h4><ul><li>What happens in a game of Yu-Gi-Oh!</li><li>The three ways a game can end</li><li>The three piles of cards you bring</li></ul></div>
<h2>Two players, two decks</h2>
<p>Yu-Gi-Oh! is a card game for two people. Each of you brings your own deck, built ahead of time from cards you chose. A single game is called a <b>Duel</b>.</p>
<p>You and your opponent take turns. On your turn you put cards on the table, attack with your monsters and try to break through whatever your opponent set up. On their turn, they do the same to you.</p>
<h2>Life Points</h2>
<p>Each player starts the Duel with <b>8000 Life Points</b>, or LP for short. Think of LP as your health bar. Attacks and some card effects take LP away. Some cards give it back.</p>
${call('analogy', 'Think of it like this', `<p>A Duel is a race. You are trying to push your opponent's number down to zero before they do it to you, while also protecting your own.</p>`)}
<h2>How you win</h2>
<p>There are three ways a Duel ends.</p>
<div class="tbl-wrap"><table><thead><tr><th>Way to win</th><th>Description</th></tr></thead><tbody>
<tr><td>LP reach 0</td><td>Your opponent's Life Points drop to zero. This is how nearly every Duel ends.</td></tr>
<tr><td>Empty Deck</td><td>Your opponent needs to draw a card and has none left.</td></tr>
<tr><td>A card says so</td><td>A few cards win on their own. ${cn('Exodia the Forbidden One')} wins if you hold it and its four limbs in your hand.</td></tr>
</tbody></table></div>
<h2>Your three decks</h2>
<div class="tbl-wrap"><table><thead><tr><th>Deck</th><th>Size</th><th>Description</th></tr></thead><tbody>
<tr><td>Main Deck</td><td>40 or more</td><td>The cards you shuffle and draw from. Most players use exactly 40.</td></tr>
<tr><td>Fusion Deck</td><td>Any number</td><td>Special Fusion monsters that sit to the side. You never draw them. Lesson 0.4 shows how they come out.</td></tr>
<tr><td>Side Deck</td><td>0 or 15</td><td>Extra options kept aside, traded into your deck after a game ends.</td></tr>
</tbody></table></div>
<p>Why 40 and not more? A smaller deck means you see your best cards more often. If you have one ${cn('Pot of Greed')} in 40 cards, you find it sooner than in 60.</p>
<p>Three is the most copies of one card a deck may hold. A list called the banlist lowers that for some cards. Goat 101 covers that list.</p>
<h2>Starting the Duel</h2>
<ol class="steps">
<li><div>Both players shuffle their Main Deck and set it face-down.</div></li>
<li><div>Decide who goes first. A coin flip or a dice roll is the usual way.</div></li>
<li><div>Each player draws <b>5 cards</b>. That is your starting hand.</div></li>
</ol>
${call('rule', 'Newer than Goat?', `<p>Today's game calls the Fusion Deck the Extra Deck and puts more kinds of monsters in it. In Goat, it only ever holds Fusion monsters.</p>`)}
<div class="recap"><h2>Recap</h2><ul><li>A Duel is two players, each with their own deck, taking turns.</li><li>Both start with 8000 LP and a hand of 5.</li><li>Win by taking your opponent to 0 LP, by them running out of cards to draw, or by a card like Exodia.</li><li>Main Deck of 40 or more, a Fusion Deck to the side, and a Side Deck of 0 or 15.</li></ul></div>`,
    flash: [
      ['How many Life Points do you start a Duel with?', '8000.'],
      ['How many cards are in your starting hand?', '5.'],
      ['What is the most common way to win a Duel?', 'Bringing your opponent to 0 Life Points.'],
      ['You need to draw and your Deck is empty. What happens?', 'You lose the Duel.'],
      ['What goes in the Fusion Deck?', 'Fusion monsters only. You never draw from it.'],
      ['How many copies of one card can you play?', 'Up to 3, unless the banlist allows fewer.']
    ]
  },
  {
    n: '0.2', title: 'Reading a Card', sub: 'Monsters, Spells and Traps, and every part of a monster card.', min: 7,
    cards: ['Summoned Skull', 'Sangan', 'Thousand Dragon', 'Pot of Greed', 'Mirror Force'],
    html: `${skip}
<div class="goals"><h4>What you will learn</h4><ul><li>How to tell the three kinds of cards apart</li><li>The kinds of monster frames</li><li>What every number and symbol on a monster means</li></ul></div>
<h2>Three kinds of cards</h2>
<p>Every card is a Monster, a Spell or a Trap. The color of the frame around the picture tells you which.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card type</th><th>Frame color</th><th>Description</th><th>Example</th></tr></thead><tbody>
<tr><td>Monster</td><td>Several colors</td><td>Goes on the field to attack and to block attacks.</td><td>${cn('Summoned Skull')}</td></tr>
<tr><td>Spell</td><td>Green</td><td>Does something when you play it. You use most of them on your turn.</td><td>${cn('Pot of Greed')}</td></tr>
<tr><td>Trap</td><td>Purple-pink</td><td>Placed face-down first, then sprung later, usually during your opponent's turn.</td><td>${cn('Mirror Force')}</td></tr>
</tbody></table></div>
<h2>Monster frames</h2>
<p>Monsters come in a few frame colors. Each color tells you something about how the monster works.</p>
<div class="tbl-wrap"><table><thead><tr><th>Frame</th><th>Color</th><th>Description</th></tr></thead><tbody>
<tr><td>Normal</td><td>Yellow</td><td>No effect. The text box is just a bit of flavor. ${cn('Summoned Skull')} is one.</td></tr>
<tr><td>Effect</td><td>Orange</td><td>Has an ability written in its text box. ${cn('Sangan')} is one.</td></tr>
<tr><td>Fusion</td><td>Violet</td><td>Lives in the Fusion Deck and is made from other monsters. ${cn('Thousand Dragon')} is one.</td></tr>
<tr><td>Ritual</td><td>Blue</td><td>Needs a matching Ritual Spell to come out. Rare in Goat decks.</td></tr>
</tbody></table></div>
<h2>The parts of a monster</h2>
<p>Open ${cn('Summoned Skull')} to follow along.</p>
<ul>
<li><b>Name</b>, across the top.</li>
<li><b>Attribute</b>, the round symbol at the top right. There are six: DARK, LIGHT, EARTH, WATER, FIRE and WIND. Some cards care about Attributes, so they matter more than they look.</li>
<li><b>Level</b>, the row of stars. Summoned Skull has 6. Higher Levels are harder to bring out, as lesson 0.4 shows.</li>
<li><b>Type</b>, the word in square brackets at the top of the text box, such as [Fiend].</li>
<li><b>Text box</b>, with the effect or the flavor text.</li>
<li><b>ATK and DEF</b> at the bottom: how hard it hits, and how well it holds when attacked.</li>
</ul>
${call('analogy', 'Think of it like this', `<p>ATK is the sword and DEF is the shield. Which one counts depends on the position the monster sits in, which lesson 0.5 explains.</p>`)}
<h2>Spells and Traps have kinds too</h2>
<p>Under the name, a Spell or Trap shows a small icon for its kind. A card with no icon is a plain Normal Spell or Normal Trap.</p>
<div class="tbl-wrap"><table><thead><tr><th>Kind</th><th>Description</th></tr></thead><tbody>
<tr><td>Normal</td><td>Used once, then sent to the Graveyard.</td></tr>
<tr><td>Quick-Play Spell</td><td>A Spell fast enough to use on either turn once it is Set.</td></tr>
<tr><td>Continuous</td><td>Remains face-up and its effect lasts.</td></tr>
<tr><td>Equip Spell</td><td>Attaches to a monster and changes it.</td></tr>
<tr><td>Field Spell</td><td>Changes the whole table. Only one can be face-up at a time.</td></tr>
<tr><td>Counter Trap</td><td>The fastest card in the game, made to stop other cards.</td></tr>
</tbody></table></div>
${call('rule', 'Old printings', `<p>Cards from the early years sometimes say <b>"Magic Card"</b> instead of Spell Card. They are the same thing.</p>`)}
<div class="recap"><h2>Recap</h2><ul><li>Monsters fight. Green Spells act when played. Purple-pink Traps get Set and sprung later.</li><li>Yellow monsters have no effect, orange ones do, violet ones are Fusions.</li><li>Every monster shows its name, Attribute, Level, Type, text box, ATK and DEF.</li><li>Spells and Traps come in kinds like Quick-Play, Continuous and Equip.</li></ul></div>`,
    flash: [
      ['What color frame does a Spell Card have?', 'Green.'],
      ['A monster has a yellow frame. What does that tell you?', 'It is a Normal monster with no effect.'],
      ['What do the stars on a monster show?', 'Its Level.'],
      ['Name the six Attributes.', 'DARK, LIGHT, EARTH, WATER, FIRE and WIND.'],
      ['An old card says "Magic Card". What is it?', 'A Spell Card. "Magic" was the early name.'],
      ['Where do violet-framed monsters start the Duel?', 'In the Fusion Deck.']
    ]
  },
  {
    n: '0.3', title: 'The Field and the Turn', sub: 'Where every card goes, and the six phases each turn moves through.', min: 7,
    cards: ['Pot of Greed', 'Mystical Space Typhoon'],
    html: `${skip}
<div class="goals"><h4>What you will learn</h4><ul><li>The parts of the table each player uses</li><li>The six phases of a turn, in order</li><li>What is allowed in each phase</li></ul></div>
<h2>Your side of the table</h2>
<p>The table is called the <b>field</b>. Each player has their own half with the same spaces, called zones.</p>
<div class="tbl-wrap"><table><thead><tr><th>Zone</th><th>Number</th><th>Description</th></tr></thead><tbody>
<tr><td>Monster Zones</td><td>5</td><td>Where your monsters go, face-up or face-down.</td></tr>
<tr><td>Spell &amp; Trap Zones</td><td>5</td><td>Home for your Spells and Traps, shown or hidden.</td></tr>
<tr><td>Field Zone</td><td>1</td><td>For a Field Spell. Only one Field Spell can be face-up on the whole table.</td></tr>
<tr><td>Deck</td><td>1 pile</td><td>Your Main Deck, face-down. You draw off the top.</td></tr>
<tr><td>Graveyard</td><td>1 pile</td><td>Face-up pile for used and destroyed cards. Your opponent is free to check it too.</td></tr>
<tr><td>Fusion Deck</td><td>1 pile</td><td>Face-down, and only you may look at it.</td></tr>
</tbody></table></div>
<p>Cards that are <b>removed from play</b> go face-up into a separate pile of their own, apart from the Graveyard. Lesson 3 of Goat 101 has more on that wording.</p>
${call('analogy', 'Think of it like this', `<p>The Graveyard is not the end of a card. Plenty of cards fish things back out of it. Removed from play is closer to gone for good.</p>`)}
<h2>A turn, phase by phase</h2>
<p>Every turn walks through the same six phases. You can't go back to an earlier one.</p>
<ol class="steps">
<li><div><b>Draw Phase.</b> Take the top card of your Deck.</div></li>
<li><div><b>Standby Phase.</b> A checkpoint. Any card that mentions the Standby Phase does its thing at this point. Most turns, nothing happens here.</div></li>
<li><div><b>Main Phase 1.</b> The busy part: summon monsters, play Spells, Set cards face-down.</div></li>
<li><div><b>Battle Phase.</b> Attack with your monsters if you want. You can skip it.</div></li>
<li><div><b>Main Phase 2.</b> A second chance to do Main Phase things, now that you have seen how the attacks went.</div></li>
<li><div><b>End Phase.</b> Effects that last "until the end of the turn" stop. A hand bigger than 6 cards gets trimmed back to 6.</div></li>
</ol>
<p>Then the other player takes a full turn of their own, starting with their Draw Phase.</p>
${call('rule', 'The very first turn', `<p>In Goat, the player who goes first <b>does</b> draw in their first Draw Phase, so they begin that turn with 6 cards. Many newer rule sets skip that draw. Goat keeps it. What they can't do is attack: there is no Battle Phase on the very first turn of the Duel.</p>`)}
<h2>What you can do in a Main Phase</h2>
<ul>
<li>Normal Summon or Set one monster. Just one per turn (lesson 0.4).</li>
<li>Special Summon, as many times as your cards allow.</li>
<li>Play Spells from your hand, and Set Spells and Traps face-down.</li>
<li>Change a monster's position, once per monster per turn.</li>
<li>Use monster effects that say you can.</li>
</ul>
${call('mistake', 'Easy to forget', `<ul><li>Main Phase 2 exists. Summoning after your attacks keeps your opponent guessing.</li><li>The hand limit is 6, checked in your End Phase.</li></ul>`)}
<div class="recap"><h2>Recap</h2><ul><li>Each side has 5 Monster Zones, 5 Spell &amp; Trap Zones, a Field Zone, a Deck, a Graveyard and a Fusion Deck.</li><li>The phases run Draw, Standby, Main 1, Battle, Main 2 and End.</li><li>Going first still gets you a draw in Goat, but no attacks that turn.</li><li>End your turn with 6 cards or fewer in hand.</li></ul></div>`,
    flash: [
      ['List the six phases in order.', 'Draw, Standby, Main Phase 1, Battle, Main Phase 2, End.'],
      ['How many Monster Zones does each player have?', '5, plus 5 Spell & Trap Zones.'],
      ['Does the first player draw a card on their first turn in Goat?', 'Yes. They start that turn with 6 cards.'],
      ['Can the player going first attack on the first turn of the Duel?', 'No. That turn has no Battle Phase.'],
      ['Can your opponent look through your Graveyard?', 'Yes. It is a public, face-up pile.'],
      ['What is the most cards you can hold at the end of your turn?', '6. Discard down to 6 in the End Phase.'],
      ['How many Field Spells can be face-up at once?', 'One for the whole table.']
    ]
  },
  {
    n: '0.4', title: 'Summoning Monsters', sub: 'The Normal Summon, Tributes, Setting, flipping, Special Summons and Fusions.', min: 9,
    cards: ['Summoned Skull', 'Dark Magician', 'Man-Eater Bug', 'Polymerization', 'Thousand Dragon', 'Time Wizard', 'Baby Dragon'],
    html: `${skip}
<div class="goals"><h4>What you will learn</h4><ul><li>The one Normal Summon you get each turn</li><li>How Tributes pay for big monsters</li><li>Setting, Flip Summons and Flip effects</li><li>Special Summons and Fusion Summons</li></ul></div>
<h2>One Normal Summon a turn</h2>
<p>Once per turn, in either Main Phase, you can put a monster from your hand onto the field, face-up and upright. This is called a <b>Normal Summon</b>. It is the main way monsters reach the field, and you only get one each turn, so pick it with care.</p>
<h2>Bigger monsters need Tributes</h2>
<p>Monsters of Level 4 or lower come out for free. Higher Levels ask you to send monsters you already control to the Graveyard first. That payment is called a <b>Tribute</b>.</p>
<div class="tbl-wrap"><table><thead><tr><th>Level</th><th>Tributes</th><th>Example</th></tr></thead><tbody>
<tr><td>1 to 4</td><td>None</td><td>Most of your deck.</td></tr>
<tr><td>5 or 6</td><td>1 monster</td><td>${cn('Summoned Skull')}</td></tr>
<tr><td>7 or more</td><td>2 monsters</td><td>${cn('Dark Magician')}</td></tr>
</tbody></table></div>
<p>A Tribute Summon still uses up your one Normal Summon for the turn.</p>
<h2>Setting a monster</h2>
<p>Instead of a Normal Summon, you can <b>Set</b> the monster: place it face-down, turned sideways, in Defense Position. Doing this spends your Normal Summon for the turn. Your opponent can see that something is there, but not what it is.</p>
<h2>Flipping it up</h2>
<p>On a later turn, you may turn your hidden monster face-up and upright, which is called a <b>Flip Summon</b>. It doesn't use your Normal Summon, but you can't do it on the same turn you Set the monster.</p>
<p>Some monsters have a <b>Flip effect</b>, marked "FLIP:" in the text. Any way the card ends up face-up sets it off: flipping it yourself, an attack on it, or another card's effect. ${cn('Man-Eater Bug')} destroys a monster when it flips.</p>
${call('analogy', 'Think of it like this', `<p>A Set Flip monster is a landmine. Attacking it is how your opponent steps on it.</p>`)}
<h2>Special Summons</h2>
<p>When a card's text puts a monster onto the field, that is a <b>Special Summon</b>. There is no limit on these each turn: if your cards allow five of them, you can make five. Some strong monsters can only be Special Summoned, and their text tells you how.</p>
<h2>Fusion Summons</h2>
<p>Fusion monsters wait in your Fusion Deck. To bring one out you usually play ${cn('Polymerization')}, then send the exact monsters the Fusion lists from your hand or field to the Graveyard. The Fusion monster then comes out, and this counts as a Special Summon.</p>
<p>For example, ${cn('Thousand Dragon')} lists ${cn('Time Wizard')} and ${cn('Baby Dragon')}. With both in hand and Polymerization, you send all three away and get Thousand Dragon from the Fusion Deck.</p>
${call('mistake', 'Common mistakes', `<ul><li>Normal Summoning in face-up Defense Position. A Normal Summon is always face-up Attack. Defense means Setting it face-down.</li><li>Flip Summoning a monster the same turn you Set it.</li><li>Thinking a Tribute Summon is free of the once-a-turn limit. It is not.</li></ul>`)}
<div class="recap"><h2>Recap</h2><ul><li>Each turn: a single Normal Summon or Set.</li><li>Level 5 or 6 needs 1 Tribute, Level 7 or more needs 2.</li><li>A Flip Summon waits a turn. Flip effects trigger whenever the card turns face-up.</li><li>Special Summons have no limit. Fusions come from the Fusion Deck with cards like Polymerization.</li></ul></div>`,
    flash: [
      ['How many Normal Summons do you get per turn?', 'One. Setting a monster counts as your Normal Summon.'],
      ['How many Tributes does a Level 7 monster need?', 'Two.'],
      ['Can you Normal Summon a monster in face-up Defense Position?', 'No. Face-up means Attack Position. To defend, Set it face-down.'],
      ['Can a monster be Set and Flip Summoned in the same turn?', 'No. The Flip Summon has to wait for a later turn.'],
      ['Your face-down Man-Eater Bug is attacked. Does its effect happen?', 'Yes. It turns face-up, so its FLIP effect goes off.'],
      ['Does a Fusion Summon use your Normal Summon?', 'No. It is a Special Summon.']
    ]
  },
  {
    n: '0.5', title: 'Battle', sub: 'Positions, attacking, the damage math and direct attacks.', min: 8,
    cards: ['Summoned Skull', 'Big Shield Gardna', 'Sangan'],
    html: `${skip}
<div class="goals"><h4>What you will learn</h4><ul><li>Attack Position and Defense Position</li><li>What happens when monsters fight</li><li>When you can attack the player directly</li></ul></div>
<h2>Two positions</h2>
<p>A monster sits upright in <b>Attack Position</b> or sideways in <b>Defense Position</b>. Upright, its ATK counts. Sideways, its DEF counts when it is attacked.</p>
<p>In a Main Phase, you may switch a face-up monster between the two, once per turn. Not on the turn it arrived, though.</p>
<h2>Declaring an attack</h2>
<p>In your Battle Phase, each of your Attack Position monsters can attack once. You pick one of your monsters and one of the opponent's monsters to hit. Defense Position monsters can't attack.</p>
<h2>The math</h2>
<p>Only the attacker's ATK matters on your side. On the other side, it depends on the defender's position.</p>
<div class="tbl-wrap"><table><thead><tr><th>Defender</th><th>Result</th><th>Description</th></tr></thead><tbody>
<tr><td>Attack Position</td><td>Higher ATK wins</td><td>The weaker one is destroyed, and its owner loses LP equal to the gap. A tie destroys both, and no one loses LP.</td></tr>
<tr><td>Defense Position</td><td>ATK against DEF</td><td>If ATK is higher, the defender is destroyed but its owner loses no LP. If DEF is higher, the attacker's owner loses the gap. A tie changes nothing.</td></tr>
</tbody></table></div>
${call('key', 'Worked example', `<p>${cn('Summoned Skull')}, 2500 ATK, attacks ${cn('Sangan')} in Attack Position, 1000 ATK. Sangan is destroyed and its owner loses 1500 LP.</p><p>Now Summoned Skull attacks ${cn('Big Shield Gardna')} in Defense Position, 2600 DEF. Nothing is destroyed, and the attacker's owner loses 100 LP.</p>`)}
<h2>Attacking a face-down monster</h2>
<p>If you attack a Set monster, it is turned face-up first and then the battle is worked out with its DEF. Any Flip effect on it triggers, which is the risk of attacking blind.</p>
<h2>Direct attacks</h2>
<p>When your opponent controls no monsters at all, your monster can attack them directly. All of its ATK comes off their Life Points.</p>
${call('mistake', 'Common mistakes', `<ul><li>Taking damage when your Defense Position monster is destroyed. You don't: only the monster goes.</li><li>Attacking with a monster in Defense Position. It has to be in Attack Position.</li><li>Switching position the turn a monster was summoned.</li></ul>`)}
<div class="recap"><h2>Recap</h2><ul><li>Upright is Attack Position (ATK counts), sideways is Defense Position (DEF counts).</li><li>Attack against attack: the weaker monster is destroyed and its owner takes the gap.</li><li>Attack against defense: no damage to the defender's owner, but a higher DEF hurts the attacker's owner.</li><li>No monsters means a direct attack for full ATK.</li></ul></div>`,
    flash: [
      ['Attack Position battle: 1800 ATK hits 1200 ATK. Result?', 'The 1200 ATK monster goes to the Graveyard, and its owner takes 600 damage.'],
      ['A 1800 ATK monster attacks a 2000 DEF monster in Defense Position. What happens?', 'Nothing is destroyed. The attacker’s owner loses 200 LP.'],
      ['Two monsters with the same ATK battle in Attack Position. What happens?', 'Both are destroyed and no one loses LP.'],
      ['Your Defense Position monster is destroyed by an attack. Do you lose LP?', 'No.'],
      ['When can you attack your opponent directly?', 'When they control no monsters.'],
      ['Can a monster in Defense Position attack?', 'No.']
    ]
  },
  {
    n: '0.6', title: 'Spells, Traps and Chains', sub: 'Setting cards, springing Traps, and what happens when cards answer each other.', min: 9,
    cards: ['Mirror Force', 'Mystical Space Typhoon', 'Sakuretsu Armor', 'Book of Moon', 'Trap Hole'],
    html: `${skip}
<div class="goals"><h4>What you will learn</h4><ul><li>How to play and Set Spells and Traps</li><li>When a Trap can be used</li><li>What a Chain is, and why it resolves backwards</li><li>Spell Speed, in plain words</li></ul></div>
<h2>Playing a Spell</h2>
<p>In your Main Phase you can play a Spell straight from your hand: place it face-up in a Spell &amp; Trap Zone and do what it says. A Normal Spell then goes to the Graveyard. Or place it face-down and save it.</p>
<h2>Setting a Trap</h2>
<p>A Trap can't be played from your hand. First you Set it face-down in your Main Phase. Starting with the <b>next</b> turn, you can flip it up whenever its condition happens, even in the middle of your opponent's turn.</p>
${call('key', 'Example', `<p>You Set ${cn('Sakuretsu Armor')}. On your opponent's turn their monster attacks. You flip Sakuretsu Armor up, and it destroys the attacker before the attack lands.</p>`)}
<h2>Chains: cards answering cards</h2>
<p>When a card is used, the other player gets a chance to answer it with a card of their own. Then the first player can answer that, and so on. This stack of answers is a <b>Chain</b>. Each card in it is a Chain Link.</p>
<p>Once neither player adds anything, the Chain resolves <b>from the last link back to the first</b>.</p>
${call('key', 'Example', `<p>Your opponent attacks and you flip ${cn('Mirror Force')} (Chain Link 1). They answer with ${cn('Mystical Space Typhoon')} on your Mirror Force (Chain Link 2). The Chain resolves backwards: Mystical Space Typhoon destroys Mirror Force first. Mirror Force was already used, though, so it still resolves and destroys their Attack Position monsters. Destroying a card that is already in a Chain does not stop it. Only cards that say "negate" do that.</p>`)}
<h2>Spell Speed</h2>
<p>Cards and effects are rated 1, 2 or 3 for speed. A reply has to be at least as fast as the card it answers.</p>
<div class="tbl-wrap"><table><thead><tr><th>Speed</th><th>Cards</th><th>Description</th></tr></thead><tbody>
<tr><td>1</td><td>Most Spells, most monster effects</td><td>Can start a Chain but never answer one.</td></tr>
<tr><td>2</td><td>Quick-Play Spells, Traps</td><td>Can answer Speed 1 or 2.</td></tr>
<tr><td>3</td><td>Counter Traps</td><td>Can answer anything. Nothing but another Counter Trap can reply to one.</td></tr>
</tbody></table></div>
<p>So ${cn('Book of Moon')}, a Quick-Play Spell, can answer your opponent's Trap Card, but a Normal Spell like ${cn('Pot of Greed')} can never be played in reply to anything.</p>
${call('mistake', 'Common mistakes', `<ul><li>Springing a Trap the same turn you Set it. You must wait a turn.</li><li>Thinking destroying a used Trap stops it. Only negation stops it.</li><li>Answering a Trap with a Normal Spell. Too slow.</li></ul>`)}
<div class="recap"><h2>Recap</h2><ul><li>Spells can be played from the hand on your turn. Traps must be Set first and wait a turn.</li><li>Cards used in answer to each other form a Chain, which resolves last to first.</li><li>You can only answer with a card of equal or higher Spell Speed.</li><li>Destroying a card in a Chain does not stop it. Negating does.</li></ul></div>`,
    flash: [
      ['You Set a Trap during your turn. When is the earliest you can flip it?', 'Your opponent\u2019s next turn.'],
      ['In what order does a Chain resolve?', 'Backwards: the last card added goes first.'],
      ['Your Mirror Force is in a Chain and gets destroyed by MST. Does Mirror Force still work?', 'Yes. Only negation stops a card that was already used.'],
      ['What Spell Speed are Quick-Play Spells and normal Traps?', 'Speed 2.'],
      ['Which cards are Spell Speed 3?', 'Counter Traps.'],
      ['Can a Normal Spell be played in answer to a Trap?', 'No. It is Spell Speed 1.']
    ]
  },
  {
    n: '0.7', title: 'A Practice Turn', sub: 'Two short turns played step by step, using everything from Step 0.', min: 8,
    cards: ['Pot of Greed', 'Man-Eater Bug', 'Sakuretsu Armor', 'Summoned Skull', 'Sangan'],
    html: `${skip}
<div class="goals"><h4>What you will learn</h4><ul><li>How the phases fit together in a real turn</li><li>How a Set monster and a Set Trap protect you</li><li>How to read a board and plan your next move</li></ul></div>
<p>Two players, Ana and Ben, start a Duel. Both have 8000 LP. Ana won the coin flip and goes first. Follow each step and check it against the earlier lessons.</p>
<h2>Turn 1: Ana</h2>
<ol class="steps">
<li><div><b>Draw Phase.</b> Ana draws, so she has 6 cards: ${cn('Pot of Greed')}, ${cn('Man-Eater Bug')}, ${cn('Sakuretsu Armor')}, ${cn('Summoned Skull')}, ${cn('Sangan')} and a second Sakuretsu Armor.</div></li>
<li><div><b>Main Phase 1.</b> She plays Pot of Greed from her hand and draws 2 cards. Pot of Greed goes to her Graveyard. She now has 7 cards.</div></li>
<li><div>She uses her Normal Summon to <b>Set</b> Man-Eater Bug face-down in Defense Position. If Ben attacks it, its Flip effect will destroy a monster.</div></li>
<li><div>She Sets one Sakuretsu Armor face-down in her Spell &amp; Trap Zone. From Ben's turn on, it can stop an attack.</div></li>
<li><div><b>No Battle Phase.</b> This is the first turn of the Duel, so Ana can't attack. Her monster is face-down in Defense Position anyway.</div></li>
<li><div><b>End Phase.</b> Ana counts her hand: 5 cards. That is under 6, so she keeps them all.</div></li>
</ol>
<h2>Turn 2: Ben</h2>
<ol class="steps">
<li><div><b>Draw Phase.</b> Ben draws his 6th card.</div></li>
<li><div><b>Main Phase 1.</b> Ben Normal Summons a Level 4 monster with 1800 ATK in Attack Position.</div></li>
<li><div><b>Battle Phase.</b> He sees one face-down monster and one face-down Spell or Trap. He decides to attack the Set monster.</div></li>
<li><div>Ana flips Sakuretsu Armor in response to the attack. It destroys Ben's attacker. The attack never happens, and her Man-Eater Bug stays hidden for later.</div></li>
<li><div><b>Main Phase 2.</b> Ben has used his Normal Summon, so he Sets two cards in his Spell &amp; Trap Zones and ends his turn.</div></li>
</ol>
${call('analogy', 'What Ben could have done', `<p>Ben knew a face-down card could be a Trap. Some players hold back and Set a monster of their own instead of attacking into an unknown board. Goat is full of decisions like this one, and Goat 201 teaches how to weigh them.</p>`)}
<h2>Reading the board after turn 2</h2>
<div class="tbl-wrap"><table><thead><tr><th>Player</th><th>Field</th><th>Hand</th><th>Life Points</th></tr></thead><tbody>
<tr><td>Ana</td><td>Set Man-Eater Bug</td><td>5 cards</td><td>8000</td></tr>
<tr><td>Ben</td><td>2 Set Spells or Traps</td><td>3 cards</td><td>8000</td></tr>
</tbody></table></div>
<p>Nobody has lost LP yet, but Ana is ahead. She traded one Trap for Ben's monster, and she still has a hidden monster and more cards in hand. In Goat, being ahead on cards is often worth more than being ahead on Life Points.</p>
<div class="recap"><h2>Recap</h2><ul><li>Draw, then use your Main Phase to summon or Set and to place your Spells and Traps.</li><li>A Set monster and a Set Trap make your opponent guess.</li><li>A Trap can stop an attack before it hits.</li><li>Count cards, not just Life Points, to see who is ahead.</li></ul></div>`,
    flash: [
      ['Ana Sets Man-Eater Bug. Has she used her Normal Summon?', 'Yes. Setting a monster counts as the Normal Summon.'],
      ['Could Ana activate her Sakuretsu Armor on her own first turn?', 'No. A Trap waits a turn after being Set.'],
      ['Why didn\u2019t Ana attack on turn 1?', 'The player going first can\u2019t attack on the first turn of the Duel.'],
      ['After turn 2, who is ahead and why?', 'Ana. She traded one card for Ben’s monster and still has more cards on the field and in hand.'],
      ['Ben has used his Normal Summon. Can he still Set Spells and Traps?', 'Yes. Setting Spells and Traps has no once-a-turn limit.']
    ]
  }
  ];
};
