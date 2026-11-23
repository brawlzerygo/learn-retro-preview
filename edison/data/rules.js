/* The Rules page (#rules): how Edison is played, in our own words.
 Sources: the Official Rulebook, version 7.0 (Konami, the rulebook in use in April 2010, hosted on edisonformat.net)
 and the Edison rules list on Time Wizard Rulings (timewizzardrulings.vercel.app). Each section names its source in "src".
 Nothing here is copied: rewrite in plain words, keep the facts. Card names in examples are real Edison cards. */
window.EDISON_RULES = {
  sources: [
    { name: 'Official Rulebook, version 7.0 (Konami, 2009)', url: 'https://edisonformat.net/rules/rulebook', note: 'the rulebook in use for Edison, hosted on edisonformat.net' },
    { name: 'Time Wizard Rulings: Edison rules', url: 'https://timewizzardrulings.vercel.app/', note: 'the 2008 rules details that differ from today' },
  ],
  sections: [
    { id: 'glance', title: 'Edison at a glance', src: 'Time Wizard Rulings; Rulebook pages 24 to 31', html: `
<p>Edison is played under the rules of April 2010: the TCG rules update of 2008, close to what was later called Master Rules 1. If you learned the game recently, these are the differences that matter most.</p>
<table><tr><th>Rule</th><th>In Edison</th></tr>
<tr><td>First turn draw</td><td>The player who goes first <b>does</b> draw in their first Draw Phase, so they start their turn with 6 cards.</td></tr>
<tr><td>First turn battle</td><td>The player who goes first can't conduct a Battle Phase on their first turn.</td></tr>
<tr><td>Extra Deck</td><td>Up to 15 cards, only Synchro and Fusion Monsters. Xyz, Pendulum and Link don't exist yet.</td></tr>
<tr><td>Field Spells</td><td>Only one face-up Field Spell can be active on the whole field. A new one destroys the old one.</td></tr>
<tr><td>Banish</td><td>Cards of the time say "remove from play". It means the same thing as banish.</td></tr>
<tr><td>Quick Effects</td><td>Older cards and players call them "Multi-Trigger" effects.</td></tr>
<tr><td>Card text</td><td>Many cards work differently from their current text. See <a href="#errata">Errata</a> for the important ones.</td></tr>
</table>` },

    { id: 'decks', title: 'Building a legal deck', src: 'Rulebook pages 2 and 42', html: `
<table><tr><th>Deck</th><th>Size</th><th>What goes in it</th></tr>
<tr><td>Main Deck</td><td>40 to 60</td><td>Every monster, Spell and Trap you draw. Most players stay at 40 so they draw their best cards more often.</td></tr>
<tr><td>Extra Deck</td><td>0 to 15</td><td>Synchro and Fusion Monsters only. It doesn't count toward the 40.</td></tr>
<tr><td>Side Deck</td><td>0 to 15</td><td>Cards you swap in between duels of a match.</td></tr></table>
<ul>
<li>Up to 3 copies of a card across your Main, Extra and Side Deck combined. Cards with the same name count as the same card.</li>
<li>The <a href="#banlist">banlist</a> lowers that: Forbidden is 0, Limited is 1, Semi-Limited is 2.</li>
<li>A match is best 2 of 3 duels. Between duels you can swap any card from your Side Deck with one in your Main or Extra Deck, card for card, so your Side Deck stays the same size. Show your opponent the Side Deck count before the match and again after each swap.</li>
</ul>` },

    { id: 'start', title: 'Starting and winning a duel', src: 'Rulebook pages 24 and 25', html: `
<ol>
<li>Shuffle your Deck. Your opponent may shuffle or cut it too.</li>
<li>Put your Deck and Extra Deck face-down in their zones, and show each other your Side Deck count.</li>
<li>Rock-paper-scissors or a coin flip: the winner picks whether to go first or second. In the next duel of a match, the loser of the last duel picks.</li>
<li>Each player starts with 8000 Life Points and draws 5 cards.</li>
</ol>
<div class="call key"><b class="tag">You win when</b> your opponent's LP reach 0, your opponent has to draw with an empty Deck, or a card effect says you win. If both players hit 0 at the same time, the duel is a draw.</div>` },

    { id: 'field', title: 'The field', src: 'Rulebook pages 4 and 5', html: `
<table><tr><th>Zone</th><th>What it holds</th></tr>
<tr><td>Monster Zones (5)</td><td>Your monsters: face-up Attack Position (vertical), face-up Defense Position or face-down Defense Position (sideways).</td></tr>
<tr><td>Spell &amp; Trap Zones (5)</td><td>Spells and Traps, face-up when active or face-down when Set. A Spell that resolves still sits here until it goes to the GY.</td></tr>
<tr><td>Field Zone</td><td>Field Spells. It doesn't use one of the 5 Spell &amp; Trap Zones.</td></tr>
<tr><td>Graveyard</td><td>Face-up and public. Either player can look through it, but keep its order.</td></tr>
<tr><td>Deck Zone</td><td>Your Deck, face-down. Shuffle it after any effect that lets you search or look through it.</td></tr>
<tr><td>Extra Deck Zone</td><td>Your Extra Deck, face-down. You can look at your own any time. Old card text calls it the Fusion Deck.</td></tr></table>
<p>"Cards on the field" means everything in these zones except the Graveyard, the Deck and the Extra Deck.</p>` },

    { id: 'turn', title: 'The turn', src: 'Rulebook pages 26 to 33; Time Wizard rule 1', html: `
<table><tr><th>Phase</th><th>What happens</th></tr>
<tr><td>Draw Phase</td><td>Draw 1 card (the first player too, in Edison). After the draw, either player can use Traps and Quick-Play Spells.</td></tr>
<tr><td>Standby Phase</td><td>Cards that say "during the Standby Phase" happen here, like Treeborn Frog coming back from the GY.</td></tr>
<tr><td>Main Phase 1</td><td>Summon, Set, change positions, activate cards and effects, Set Spells and Traps, in any order.</td></tr>
<tr><td>Battle Phase</td><td>Optional. Attack with your monsters (see Battle). The first player skips it on turn 1.</td></tr>
<tr><td>Main Phase 2</td><td>Only if you had a Battle Phase. The same actions as Main Phase 1, but anything you already used (like your Normal Summon) stays used.</td></tr>
<tr><td>End Phase</td><td>"During the End Phase" effects happen, then if you hold more than 6 cards, discard down to 6.</td></tr></table>
<div class="call rule"><b class="tag">Once per turn</b>One Normal Summon or Set (a Tribute Summon counts). Flip Summons and Special Summons have no limit.</div>` },

    { id: 'summon', title: 'Summoning', src: 'Rulebook pages 12 to 17', html: `
<h3>Normal Summon, Tribute Summon and Set</h3>
<ul>
<li>A Normal Summon puts a monster from your hand face-up in Attack Position.</li>
<li>Level 5 or 6 needs 1 Tribute. Level 7 or higher needs 2. Tributes are monsters you control, face-up or face-down.</li>
<li>A Set puts it face-down in Defense Position. It uses your Normal Summon for the turn and needs the same Tributes, but it is <b>not</b> a summon.</li>
<li>You can't Normal Summon a monster face-up in Defense Position.</li>
</ul>
<h3>Flip Summon</h3>
<p>Turn your face-down monster face-up into Attack Position, not on the turn you Set it. It doesn't cost your Normal Summon. A monster flipped by an attack or a card effect isn't Flip Summoned, but its FLIP effect still happens.</p>
<h3>Special Summons</h3>
<ul>
<li>Synchro, Fusion and Ritual Summons, and summons by card effects, are Special Summons. You can do as many as you are able to.</li>
<li>A monster with its own summoning condition (like Cyber Dragon or Dark Armed Dragon) is a Special Summon Monster. Unless the card says otherwise, it goes face-up in Attack or Defense Position.</li>
<li>Monsters that must be Special Summoned a certain way (Synchro, Fusion, Ritual, Dark Armed Dragon) can't be brought back from the Graveyard by another card unless they were properly summoned first.</li>
</ul>
<h3>Synchro Summon</h3>
<ol>
<li>In your Main Phase, pick 1 face-up Tuner and any number of other face-up monsters you control whose Levels add up to exactly the Synchro Monster's Level.</li>
<li>Send them to the Graveyard. Only 1 of them can be a Tuner.</li>
<li>Put the Synchro Monster from your Extra Deck face-up in Attack or Defense Position.</li>
</ol>
<p>Some Synchros ask for more, for example a "Synchron" Tuner or 2 or more non-Tuners. The practice board checks these for you.</p>
<h3>Fusion and Ritual Summon</h3>
<p>Fusion: with the materials the Fusion Monster lists (in your hand or on your field), activate Polymerization, send the materials to the GY and put the Fusion Monster on the field. Ritual: activate the matching Ritual Spell, Tribute monsters from your hand or field whose Levels meet its requirement, then put the Ritual Monster from your hand on the field.</p>` },

    { id: 'positions', title: 'Changing battle positions', src: 'Rulebook page 29', html: `
<p>In either Main Phase you can switch a face-up monster between Attack and Defense Position, once per turn per monster. You can't switch it:</p>
<ul><li>on the turn it came to the field,</li><li>after it attacked this turn,</li><li>if you already changed its position this turn (a Flip Summon counts as that change).</li></ul>` },

    { id: 'battle', title: 'Battle', src: 'Rulebook pages 30 to 36', html: `
<p>The Battle Phase runs in steps: the <b>Start Step</b>, then a <b>Battle Step</b> (pick an attacker and a target) and a <b>Damage Step</b> for each attack, then the <b>End Step</b>. Each face-up Attack Position monster can attack once per turn. You don't have to attack with any of them.</p>
<h3>Damage</h3>
<table><tr><th>You attack</th><th>Result</th></tr>
<tr><td>Attack Position, your ATK higher</td><td>Their monster is destroyed. They take the difference.</td></tr>
<tr><td>Attack Position, ATK equal</td><td>Both are destroyed. No damage.</td></tr>
<tr><td>Attack Position, your ATK lower</td><td>Your monster is destroyed. You take the difference.</td></tr>
<tr><td>Defense Position, ATK higher than DEF</td><td>Their monster is destroyed. No damage.</td></tr>
<tr><td>Defense Position, ATK equal to DEF</td><td>Nothing is destroyed. No damage.</td></tr>
<tr><td>Defense Position, ATK lower than DEF</td><td>Nothing is destroyed. You take the difference.</td></tr>
<tr><td>No monsters on their side</td><td>A direct attack: they take your monster's full ATK.</td></tr></table>
<div class="call rule"><b class="tag">0 ATK in Edison</b>Two 0 ATK monsters in Attack Position that battle destroy each other. A 0 ATK attacker can't destroy a 0 DEF monster in Defense Position. (Time Wizard rule 13)</div>
<h3>Face-down targets</h3>
<p>When you attack a face-down monster, it is flipped face-up in Defense Position during the Damage Step, then damage is calculated against its DEF. Its FLIP effect happens after damage calculation, and it can't target a monster that was destroyed in that battle.</p>
<h3>Replays</h3>
<p>If the number of monsters on your opponent's side changes after you declared an attack but before damage (a monster removed or a new one summoned), you get a replay: attack the same or a different monster, use a different attacker, or don't attack. The first monster still counts as having declared an attack, so if you switch attackers it can't attack again this turn.</p>` },

    { id: 'damagestep', title: 'The Damage Step', src: 'Rulebook page 34; Time Wizard rule 8', html: `
<p>Few cards can be used during the Damage Step. Until damage is calculated, only Counter Traps and cards that directly change a monster's ATK or DEF can be activated (plus mandatory effects and monster effects that negate an activation). A Spell Speed 2 Spell or Trap that negates an activation can't be used here.</p>
<p>The 2010 rules split the Damage Step into seven moments:</p>
<ol>
<li><b>Start:</b> "during the Damage Step" effects begin to apply. ATK/DEF changers can be used.</li>
<li><b>Flip:</b> a face-down target turns face-up (its FLIP effect waits). ATK/DEF changers can be used.</li>
<li><b>Before damage calculation:</b> effects that say so happen, like Injection Fairy Lily or Honest. ATK/DEF changers can still be used, and this is the last chance.</li>
<li><b>Damage calculation:</b> effects that say "during damage calculation" apply. Only 1 Chain is allowed from here on.</li>
<li><b>After damage calculation:</b> damage is dealt and it is decided which monsters are destroyed, but nothing has gone to the GY yet. "If this card inflicts battle damage" effects activate, and so do Gorz the Emissary of Darkness and Tragoedia.</li>
<li><b>Resolve:</b> monsters destroyed by battle stop applying their continuous effects. "After damage calculation" effects and FLIP effects activate.</li>
<li><b>End:</b> monsters destroyed by battle go to the GY, and effects like Sangan, Mystic Tomato and Giant Rat activate.</li>
</ol>
<p>Lesson 10 walks through this with examples, and the <a href="#rulings">Rulings</a> page links edisonformat.net's longer write-ups.</p>` },

    { id: 'cards', title: 'Card types', src: 'Rulebook pages 6 to 23', html: `
<h3>Monster effects</h3>
<table><tr><th>Type</th><th>How it works</th></tr>
<tr><td>Flip</td><td>Starts with "FLIP:". Happens when the card is flipped face-up: by a Flip Summon, by being attacked while face-down, or by a card effect.</td></tr>
<tr><td>Continuous</td><td>Always on while the monster is face-up on the field. Nothing is activated.</td></tr>
<tr><td>Ignition</td><td>You choose to activate it in your Main Phase, often with a cost (discard, Tribute, pay LP).</td></tr>
<tr><td>Trigger</td><td>Activates at a set moment: "during the Standby Phase", "when this card is destroyed".</td></tr>
<tr><td>Quick</td><td>Can be activated on either player's turn, at Spell Speed 2. Older name: Multi-Trigger.</td></tr></table>
<h3>Spells</h3>
<p>Normally used in your own Main Phase. Normal and Ritual Spells go to the GY after they resolve. Continuous, Equip and Field Spells stay on the field. An Equip Spell goes to the GY if its monster leaves the field or is turned face-down. Quick-Play Spells can be used in any phase of your turn, or on your opponent's turn if you Set them first, but not on the turn you Set them. A Set Spell other than a Quick-Play can be activated the same turn you Set it, but still only in your Main Phase.</p>
<h3>Traps</h3>
<p>A Trap must be Set first and can be activated from the start of the next turn, on either player's turn. Normal Traps go to the GY after they resolve, Continuous Traps stay, and Counter Traps are made to answer other cards, usually with a cost (Solemn Judgment's half your LP).</p>
<h3>Trap Monsters</h3>
<p>A Trap that becomes a monster takes a Monster Zone and keeps its Spell &amp; Trap Zone. You can't activate it with no free Monster Zone. If Jinzo negates it, it goes back to being a Trap Card at once. When it leaves the field it counts as a Trap Card leaving. (Time Wizard rule 5)</p>` },

    { id: 'chains', title: 'Chains, Spell Speed and priority', src: 'Rulebook pages 37 to 43; Time Wizard rules 6 and 7', html: `
<p>When a card or effect is activated, the other player can respond with their own, making a Chain. Each new response is a Chain Link. When neither player adds anything, the Chain resolves backwards: the last card activated resolves first, Chain Link 1 resolves last.</p>
<table><tr><th>Spell Speed</th><th>Cards</th><th>Can respond to</th></tr>
<tr><td>1</td><td>Normal, Equip, Continuous, Field and Ritual Spells; Ignition, Trigger and Flip effects</td><td>Nothing: it can only start a Chain</td></tr>
<tr><td>2</td><td>Normal and Continuous Traps, Quick-Play Spells, Quick Effects</td><td>Spell Speed 1 or 2</td></tr>
<tr><td>3</td><td>Counter Traps</td><td>Anything. Only another Counter Trap can respond to it.</td></tr></table>
<p><b>Example:</b> you activate Heavy Storm (Chain Link 1). They respond with a Set Trap (Chain Link 2). You could answer with Solemn Judgment (Chain Link 3). Solemn resolves first and negates their Trap, then Heavy Storm resolves.</p>
<h3>Priority</h3>
<p>The turn player always gets the first chance to act in each phase and step, and after their own card is activated. Moving to the next phase passes the chance to the opponent, who can still say "before you leave this phase, I activate this".</p>
<div class="call rule"><b class="tag">Ignition priority (2010)</b>Right after a summon that didn't start a Chain, the turn player can activate an Ignition Effect as Chain Link 1 before the opponent responds. Summon Chaos Sorcerer and you can banish with it before Bottomless Trap Hole. If the summon started a Chain (Synchro Summoning with Sangan, whose effect triggers), you lose that window. (Time Wizard rule 6)</div>
<h3>Effects that trigger together (SEGOC)</h3>
<p>When several Trigger Effects activate at the same moment, they go on one Chain in this order: the turn player's mandatory ones, the opponent's mandatory ones, the turn player's optional ones, then the opponent's optional ones. Example: Tribute Sangan to summon Caius the Shadow Monarch. Sangan is Chain Link 1, Caius is Chain Link 2. (Time Wizard rule 7)</p>
<h3>What isn't on a Chain</h3>
<p>Summoning, Tributing, changing a position and paying a cost aren't activations, so nothing can be chained to them. Cards that negate a summon itself, like Solemn Judgment, are the special case.</p>` },

    { id: 'other', title: 'More rules you will run into', src: 'Rulebook pages 42 to 44; Time Wizard rules 2 to 5 and 9 to 12', html: `
<ul>
<li><b>The card wins.</b> When a card's text and the basic rules disagree, the card's text applies. For example, a monster attacks once per turn unless an effect lets it attack twice.</li>
<li><b>Public knowledge.</b> Hand size, Deck size, the Graveyards and LP are public. Answer honestly when asked. Ask before you look through your opponent's Graveyard.</li>
<li><b>Tokens</b> take a Monster Zone and must show their position clearly. They can't go anywhere but the field: if a Token would leave, it disappears.</li>
<li><b>Paying LP.</b> You can't pay a cost that would bring your LP to 0. A card with a maintenance cost you can't pay is destroyed instead.</li>
<li><b>Field Spells.</b> Only one face-up Field Spell on the field. Activating a new one destroys the old one when it resolves (Geartown can't use its effect then). Setting a Field Spell face-down destroys the old one by the rules, outside a Chain, so Geartown's effect does happen.</li>
<li><b>Phase triggers.</b> A mandatory Trigger Effect that happens in a certain phase activates again if its activation is negated, until it resolves. If its effect is negated instead (Skill Drain), it doesn't come back.</li>
<li><b>Union Monsters.</b> A monster can only have 1 Union equipped. Only a few Unions (like Armored Cybern, Machina Gearframe and Machina Peacekeeper) take the place of the monster when it would be destroyed.</li>
<li><b>Trigger locations.</b> An effect can trigger even if the card moved away from where it triggered, even into the Deck.</li>
<li><b>End of turn discard.</b> Nobody can respond to the discard down to 6.</li>
<li><b>Loops.</b> Starting an endless loop on purpose isn't allowed. If one happens by accident, the card that causes it is destroyed.</li>
<li><b>Both players choosing.</b> When an effect has both players choose something, the turn player chooses first.</li>
</ul>` },

    { id: 'terms', title: 'Words the rules use', src: 'Rulebook glossary, pages 45 to 49', html: `
<table><tr><th>Term</th><th>Meaning</th></tr>
<tr><td>Destroy</td><td>Sent to the GY by battle or by an effect that destroys. A card Tributed, discarded, sent as a cost or returned to the hand or Deck is <b>not</b> destroyed.</td></tr>
<tr><td>Send to the GY</td><td>Any move to the GY: destroying, discarding and Tributing all count.</td></tr>
<tr><td>Target</td><td>An effect targets when you pick the card as you activate it. "All cards", or a pick made while it resolves (like Smashing Ground), doesn't target.</td></tr>
<tr><td>Cost</td><td>What you pay to activate (Tribute, discard, LP). It isn't part of the effect and isn't refunded if the card is negated.</td></tr>
<tr><td>Control</td><td>A card on your side of the field is yours to use. A card taken by the opponent still returns to its owner's hand, Deck or GY.</td></tr>
<tr><td>Remove from play</td><td>Banish. It stays out for the rest of the duel unless an effect brings it back.</td></tr>
<tr><td>Original ATK/DEF</td><td>The number printed on the card. "?" counts as 0.</td></tr>
<tr><td>Search your Deck</td><td>Look through it for a card an effect allows, then shuffle. You can't activate a search if no card in your Deck fits.</td></tr>
<tr><td>Reveal</td><td>Show it to both players, then put it back. Revealing a face-down card doesn't activate it or its FLIP effect.</td></tr>
<tr><td>Set</td><td>Placed face-down. Any face-down card on the field is a Set card.</td></tr>
<tr><td>Effects that count</td><td>"Each time you draw" counts a draw of 2 cards as 1 time.</td></tr></table>
<p>More terms are in the <a href="#glossary">Glossary</a>.</p>` },
  ],
};
