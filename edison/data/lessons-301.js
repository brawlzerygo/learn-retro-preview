/* Edison 301 lessons (18-24), written from the site's card data, rulings and deck lists. */
window.EDISON_LESSONS_301=function(h){const {cn,call}=h;return [

/* ---------------- 17 Deck Styles ---------------- */
{n:18,title:'Deck Styles',sub:'Aggro, control, combo and stun: what each one wants, and how to spot it.',min:4,
cards:['Blackwing - Bora the Spear','Dimensional Prison','Quickdraw Synchron','Treeborn Frog','Royal Oppression','Skill Drain','Thunder King Rai-Oh','Pulling the Rug'],
html:`
<div class="goals"><h4>What you will learn</h4><ul><li>The four main deck styles in Edison</li><li>How to tell which style you are facing in the first few turns</li><li>The kind of card that beats each style</li></ul></div>
<h2>Four ways to win</h2>
<p>Every deck wants to bring your Life Points to 0. They just take different roads to get there. Most decks lean on one of four styles.</p>
<div class="tbl-wrap"><table><thead><tr><th>Style</th><th>Example decks</th><th>Description</th></tr></thead><tbody>
<tr><td>Aggro</td><td>Blackwing, Diva Hero Beat</td><td>Puts strong attackers on the field early and hits you every turn.</td></tr>
<tr><td>Control</td><td>Gladiator Beast, Gemini</td><td>Runs lots of removal and Traps. Trades card for card and wins late.</td></tr>
<tr><td>Combo</td><td>Quickdraw Plant, Junk Frog, Lightsworn</td><td>Chains card effects together to build a big board in one turn.</td></tr>
<tr><td>Stun</td><td>Hero Beat, Anti-Meta</td><td>Locks the game with cards that stop both players from doing something.</td></tr>
</tbody></table></div>
<p>Real decks mix styles. Blackwing is mostly aggro, but it also runs 13 Traps. Hero Beat attacks with plain beaters, but its Traps lock the game. Use the style as a first guess, not a final answer.</p>
${call('analogy','Think of it like this',`<p>Aggro is a sprinter. Control is a marathon runner. Combo builds a machine and then flips the switch. Stun locks the door and fights you in the hallway.</p>`)}
<h2>How each style looks in a deck list</h2>
<p>You can often guess a style just by counting card types in the <a href="#decks">deck lists</a>.</p>
<div class="tbl-wrap"><table><thead><tr><th>Deck</th><th>Monsters</th><th>Spells</th><th>Traps</th><th>Description</th></tr></thead><tbody>
<tr><td>Blackwing</td><td>19</td><td>8</td><td>13</td><td>Many attackers that summon each other, backed by Traps.</td></tr>
<tr><td>Junk Frog</td><td>25</td><td>12</td><td>3</td><td>Lots of monsters, few Traps. Its combo works best with an empty back row.</td></tr>
<tr><td>Hero Beat</td><td>12</td><td>11</td><td>17</td><td>Few monsters, many Traps, including 2 Royal Oppression and 2 Skill Drain.</td></tr>
<tr><td>Gemini</td><td>15</td><td>8</td><td>17</td><td>More Traps than monsters. Most of its cards answer yours.</td></tr>
</tbody></table></div>
<h2>How to tell what you face</h2>
<p>You rarely see a deck list in a real game. Watch what your opponent does in the first two turns.</p>
<div class="tbl-wrap"><table><thead><tr><th>What you see</th><th>Likely style</th><th>Description</th></tr></thead><tbody>
<tr><td>A 1700+ attacker and 1 or 2 set cards</td><td>Aggro</td><td>They want to start dealing damage right away.</td></tr>
<tr><td>Many Special Summons in one turn</td><td>Combo</td><td>Cards like ${cn('Quickdraw Synchron')} and tokens turn into Synchros fast.</td></tr>
<tr><td>Three or four set cards, one monster</td><td>Control</td><td>They plan to answer each of your plays one at a time.</td></tr>
<tr><td>A face-up lock card</td><td>Stun</td><td>${cn('Royal Oppression')}, ${cn('Skill Drain')} or ${cn('Thunder King Rai-Oh')} on the field.</td></tr>
<tr><td>Cards sent from the Deck to the GY</td><td>Combo</td><td>Lightsworn and Vayu Turbo fill their Graveyard on purpose.</td></tr>
<tr><td>${cn('Treeborn Frog')} in the GY, no back row</td><td>Combo</td><td>Frog Monarchs. Treeborn only comes back if they control no Spells or Traps.</td></tr>
</tbody></table></div>
<h2>What beats each style</h2>
<p>Once you know the style, you know which of your cards matter most.</p>
<ul>
<li><b>Against aggro:</b> Traps that stop attacks, like ${cn('Dimensional Prison')} and Mirror Force. Monsters that stop a direct attack, like Battle Fader. Make every attack cost them a card.</li>
<li><b>Against control:</b> Do not dump your hand onto the field. Play one threat at a time and keep the rest. Spells that clear Traps, like Heavy Storm, matter more.</li>
<li><b>Against combo:</b> Stop the first step. A combo needs every link. ${cn('Pulling the Rug')} negates an effect that starts when a monster is Normal Summoned. Royal Oppression negates Special Summons. Solemn Judgment can stop the Synchro at the end.</li>
<li><b>Against stun:</b> Remove the lock before you commit. Mystical Space Typhoon and Dust Tornado are your keys. Until then, play cards the lock does not touch.</li>
</ul>
${call('key','The big idea',`<p>Ask two questions every game: "What does my opponent need to happen?" and "Which of my cards stops that?" Save that card for the right moment.</p>`)}
<h2>The Side Deck follows the styles</h2>
<p>Side Decks are built to fight styles. Look at the <a href="#deck-Blackwing">Blackwing list</a>. Its Side Deck holds 2 Royal Oppression, 2 Fossil Dyna Pachycephalo and 2 Pulling the Rug. All of them hurt combo decks that Special Summon a lot or use Normal Summon effects.</p>
<p>The next six lessons look at real decks one by one. For each, you will learn its engine, its plan, and how to beat it. The <a href="#library">Library</a> has side decking guides by E3 Yu-Gi-Oh and IMNerd (Frazier Smith) if you want more.</p>
${call('mistake','Common mistakes',`<ul><li>Siding cards that beat a style your opponent is not playing.</li><li>Playing the same way against every deck. Your plan changes with theirs.</li><li>Guessing a style from one card. Wait for two or three clues.</li></ul>`)}
<div class="recap"><h2>Recap</h2><ul><li>Aggro hits early, control wins late, combo builds a big turn, stun locks the game.</li><li>Most decks mix two styles.</li><li>Watch the first two turns: set cards, Special Summons, lock cards and the Graveyard.</li><li>Pick your answers by what the opponent needs to happen.</li></ul></div>`,
flash:[
['Your opponent Special Summons four times on turn 1 and ends with two Synchros. What style is that?','Combo.'],
['Your opponent sets four cards and one monster and passes. What two styles could it be?','Control or stun.'],
['Name three lock cards that point to a stun deck.','Any three of: Royal Oppression, Skill Drain, Thunder King Rai-Oh, Royal Decree, Vanity\'s Fiend, Fossil Dyna Pachycephalo.'],
['What is the best time to stop a combo deck?','At the first step. A combo needs every link, so stopping the start stops the whole turn.'],
['Against a control deck, should you play your whole hand at once?','No. Play one threat at a time so one answer does not clear all of your cards.'],
['Why does Pulling the Rug help against many combo decks?','It negates monster effects that start when a monster is Normal Summoned, which many combos begin with.']
]},

/* ---------------- 18 Blackwings ---------------- */
{n:19,title:'Blackwings',sub:'A flock of DARK birds that summon each other and win the battle.',min:6,
cards:['Black Whirlwind','Blackwing - Shura the Blue Flame','Blackwing - Bora the Spear','Blackwing - Blizzard the Far North','Blackwing - Kalut the Moon Shadow','Blackwing - Vayu the Emblem of Honor','Icarus Attack','Blackwing Armor Master','Blackwing Armed Wing'],
html:`
<div class="goals"><h4>What you will learn</h4><ul><li>How the Blackwing engine finds and summons its own cards</li><li>Which Synchros the deck makes, and how</li><li>What Blackwings are weak to, and how to play against them</li></ul></div>
<h2>The deck</h2>
<p>Blackwings are DARK Winged Beasts. They are listed in the Best tier on this site. Their plan is simple: put two or three attackers on the field in one turn, win every battle, and turn spare birds into Synchros. <a href="#deck-Blackwing">Open the Blackwing list</a> to follow along.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Copies</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Black Whirlwind')}</td><td>2</td><td>When you Normal Summon a Blackwing, add a Blackwing with less ATK from your Deck.</td></tr>
<tr><td>${cn('Blackwing - Shura the Blue Flame')}</td><td>3</td><td>1800 ATK. When it destroys a monster in battle, Special Summon a 1500-or-less Blackwing from the Deck.</td></tr>
<tr><td>${cn('Blackwing - Bora the Spear')}</td><td>3</td><td>1700 ATK with piercing. Special Summons itself if you control another Blackwing.</td></tr>
<tr><td>${cn('Blackwing - Sirocco the Dawn')}</td><td>3</td><td>Level 5, 2000 ATK. No Tribute needed if only your opponent controls a monster.</td></tr>
<tr><td>${cn('Blackwing - Blizzard the Far North')}</td><td>3</td><td>Level 2 Tuner. When Normal Summoned, revives a Level 4 or lower Blackwing.</td></tr>
<tr><td>${cn('Blackwing - Kalut the Moon Shadow')}</td><td>3</td><td>Discard it in the Damage Step: a battling Blackwing gains 1400 ATK.</td></tr>
<tr><td>${cn('Blackwing - Vayu the Emblem of Honor')}</td><td>2</td><td>From the GY, banishes itself and a Blackwing to bring out a Blackwing Synchro.</td></tr>
<tr><td>${cn('Blackwing - Gale the Whirlwind')}</td><td>1</td><td>Level 3 Tuner. Special Summons itself next to a Blackwing. Halves a monster's ATK and DEF.</td></tr>
<tr><td>${cn('Icarus Attack')}</td><td>3</td><td>Trap. Tribute a Winged Beast to destroy 2 cards on the field.</td></tr>
<tr><td>${cn('Dark Armed Dragon')}</td><td>1</td><td>Comes out with exactly 3 DARKs in the GY. Banishes DARKs to destroy cards.</td></tr>
</tbody></table></div>
<p>The rest is a strong Trap line: 3 Dimensional Prison, 2 Bottomless Trap Hole, Mirror Force, Solemn Judgment, Trap Dustshoot, and 2 Legacy of Yata-Garasu to draw.</p>
<h2>The engine</h2>
<p>Blackwings find each other. The order of ATK values is the secret. ${cn('Black Whirlwind')} only finds a bird with <b>less</b> ATK than the one you just Normal Summoned.</p>
<div class="tbl-wrap"><table><thead><tr><th>You Normal Summon</th><th>ATK</th><th>Black Whirlwind can add</th></tr></thead><tbody>
<tr><td>Sirocco</td><td>2000</td><td>Shura, Bora, Kalut, Gale, Blizzard or Vayu</td></tr>
<tr><td>Shura</td><td>1800</td><td>Bora, Kalut, Gale, Blizzard or Vayu</td></tr>
<tr><td>Bora</td><td>1700</td><td>Kalut, Gale, Blizzard or Vayu</td></tr>
<tr><td>Blizzard</td><td>1300</td><td>Vayu</td></tr>
</tbody></table></div>
<p>Here is a common turn. It uses only the cards' own text.</p>
<ol class="steps">
<li><div>With Black Whirlwind face-up, Normal Summon ${cn('Blackwing - Shura the Blue Flame','Shura')}. Whirlwind adds Bora (1700 is less than 1800).</div></li>
<li><div>You control a Blackwing, so Special Summon ${cn('Blackwing - Bora the Spear','Bora')} from your hand. It does not start a Chain.</div></li>
<li><div>Attack. If Shura destroys a monster and sends it to the GY, Special Summon a Blackwing with 1500 or less ATK from your Deck, like Gale. Its effects are negated, but it can still be Synchro Material.</div></li>
<li><div>In Main Phase 2, Synchro Summon with Gale (3) and Bora (4): a Level 7, like ${cn('Blackwing Armor Master')} or Black Rose Dragon.</div></li>
</ol>
${call('rule','Ordering two triggers',`<p>A ruling for ${cn('Blackwing - Blizzard the Far North','Blizzard')}: when you Normal Summon it with Black Whirlwind face-up, both effects trigger. Put Blizzard as Chain Link 1 and Whirlwind as Chain Link 2. Now your opponent can only respond to Whirlwind, so cards like Pulling the Rug and Royal Oppression cannot be used on Blizzard's revive.</p>`)}
<h2>The Synchros</h2>
<p>The Extra Deck holds the usual toolbox plus five Blackwing Synchros. Those need a <b>Blackwing</b> Tuner (Blizzard or Gale).</p>
<div class="tbl-wrap"><table><thead><tr><th>Synchro</th><th>Level</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Blackwing Armed Wing')} (2)</td><td>6</td><td>2300 ATK, gains 500 when attacking a Defense monster, and pierces.</td></tr>
<tr><td>${cn('Blackwing Armor Master')} (2)</td><td>7</td><td>Can't be destroyed by battle, and you take no battle damage from its fights.</td></tr>
<tr><td>${cn('Blackwing - Silverwind the Ascendant','Silverwind the Ascendant')} (1)</td><td>8</td><td>Needs 2+ non-Tuners. Destroys up to 2 monsters with DEF below its ATK.</td></tr>
</tbody></table></div>
<p>${cn('Blackwing - Vayu the Emblem of Honor','Vayu')} gives a second way in. It can't be Synchro Material. Instead, from the GY it banishes itself and a non-Tuner Blackwing, then Special Summons a Blackwing Synchro of their total Level. Vayu (1) plus Sirocco (5) makes Armed Wing (6). That Synchro has its effects negated, and it is not treated as Synchro Summoned, so it can't be revived later.</p>
${call('key','Why Kalut matters',`<p>${cn('Blackwing - Kalut the Moon Shadow','Kalut')} works in the Damage Step, even during damage calculation. Any Blackwing in battle might really have 1400 more ATK. Your 2400 monster is not safe from a 1700 Bora if they hold a card.</p>`)}
<h2>Hybrid: Blackwings with Dark Grepher</h2>
<p>The <a href="#deck-Hybrid">Hybrid list</a>, also in the Best tier, is a Blackwing variant. It keeps the birds and Black Whirlwind, but adds 3 Dark Grepher, 3 Vayu, Burial from a Different Dimension, 2 Royal Oppression and 2 Dark Bribe. Dark Grepher can discard a DARK to send another DARK from the Deck to the GY, like Vayu or Sirocco. That sets up Vayu faster. Burial returns banished monsters to the GY so Vayu can be used again. Lesson 22 covers this idea in full.</p>
<h2>Weaknesses and how to play against it</h2>
<p>These all follow from the cards' text:</p>
<ul>
<li><b>Everything is DARK.</b> Consecrated Light stops both players from summoning DARKs or attacking with them.</li>
<li><b>Bora, Gale and Vayu Special Summon.</b> ${cn('Royal Oppression')}, ${cn('Fossil Dyna Pachycephalo')} and Vanity's Fiend shut them off. Blizzard can't be Special Summoned at all.</li>
<li><b>The engine starts with a Normal Summon.</b> Pulling the Rug negates Blizzard's revive.</li>
<li><b>Vayu and Dark Armed Dragon banish from the GY.</b> Kycoo the Ghost Destroyer says your opponent can't banish cards from either GY.</li>
<li><b>It must attack to win.</b> Dimensional Prison and Mirror Force hit it hard. Destroy Black Whirlwind with Mystical Space Typhoon or Dust Tornado to slow the searches.</li>
</ul>
${call('mistake','Common mistakes against Blackwings',`<ul><li>Forgetting Kalut. Assume a battling Blackwing can gain 1400 ATK while they have cards in hand.</li><li>Setting a weak monster in front of Bora or Armed Wing. Both pierce.</li><li>Counting their field only. Shura can pull a new bird from the Deck mid-battle.</li></ul>`)}
<p>Want to see it played? The <a href="#library">Library</a> has Blackwing guides by E3 Yu-Gi-Oh and IMNerd (Frazier Smith).</p>
<div class="recap"><h2>Recap</h2><ul><li>Black Whirlwind turns each Normal Summon into a search for a lower-ATK bird.</li><li>Bora and Gale Special Summon themselves next to another Blackwing.</li><li>Blizzard and Gale are the Tuners for Armed Wing, Armor Master and Silverwind. Vayu gives a second route.</li><li>Fight them with DARK locks, Special Summon locks, Pulling the Rug and battle Traps.</li></ul></div>`,
flash:[
['You Normal Summon Shura with Black Whirlwind face-up. Name a card Whirlwind can add.','Bora, Kalut, Gale, Blizzard or Vayu. Each has less than 1800 ATK.'],
['When can Bora the Spear Special Summon itself?','When you control another Blackwing monster.'],
['Vayu and Sirocco are in your GY. What can Vayu bring out?','A Level 6 Blackwing Synchro, Blackwing Armed Wing, with its effects negated.'],
['Can a Synchro brought out by Vayu be revived later with Call of the Haunted?','No. It was not Synchro Summoned.'],
['Why should you worry when a Blackwing attacks into your bigger monster?','Kalut can be discarded in the Damage Step to give it 1400 more ATK.'],
['Name a card that stops Blackwings from even attacking.','Consecrated Light. Neither player can summon or attack with DARK monsters.']
]},

/* ---------------- 19 Quickdraw Plants ---------------- */
{n:20,title:'Quickdraw Plants',sub:'Tokens, Plants and Synchron Tuners: a combo deck built on Dandylion.',min:5,
cards:['Quickdraw Synchron','Dandylion','Debris Dragon','Lonefire Blossom','Tytannial, Princess of Camellias','Drill Warrior','Junk Archer','Ancient Fairy Dragon','Pot of Avarice'],
html:`
<div class="goals"><h4>What you will learn</h4><ul><li>How Quickdraw Synchron, Dandylion and Debris Dragon build Synchros</li><li>The Level math for the deck's main Synchros</li><li>The Volcanic version, and how to beat both</li></ul></div>
<h2>The deck</h2>
<p>You met this engine in Lesson 6. According to edisonformat.com, a Quickdraw deck called Quickdraw Dandywarrior won the April 2010 tournament in Edison that the format is named after. On this site the <a href="#deck-Quickdraw%20Plant">Quickdraw Plant list</a> is listed as a Rogue deck.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Copies</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Quickdraw Synchron')}</td><td>2</td><td>Level 5 Tuner. Special Summons itself by sending another monster from your hand to the GY.</td></tr>
<tr><td>${cn('Dandylion')}</td><td>2</td><td>When sent to the GY from anywhere, makes 2 Level 1 Fluff Tokens.</td></tr>
<tr><td>${cn('Debris Dragon')}</td><td>2</td><td>Level 4 Tuner. When Normal Summoned, revives a 500-or-less ATK monster from your GY.</td></tr>
<tr><td>${cn('Lonefire Blossom')}</td><td>2</td><td>Tribute a face-up Plant to Special Summon a Plant from your Deck.</td></tr>
<tr><td>${cn('Tytannial, Princess of Camellias')}</td><td>1</td><td>Level 8 Plant. Tribute a face-up Plant to negate a card that targets.</td></tr>
<tr><td>Ryko, Lightsworn Hunter</td><td>3</td><td>Flip: destroy a card, then send the top 3 of your Deck to the GY.</td></tr>
<tr><td>Super-Nimble Mega Hamster</td><td>2</td><td>Flip: Special Summon a Level 3 or lower Beast, like Ryko, from the Deck face-down.</td></tr>
<tr><td>${cn('Pot of Avarice')}</td><td>3</td><td>Shuffle 5 monsters from the GY into the Deck, then draw 2.</td></tr>
<tr><td>Caius the Shadow Monarch</td><td>2</td><td>Tribute Summon to banish a card.</td></tr>
</tbody></table></div>
<p>It also runs Card Trooper, Light and Darkness Dragon, Night Assailant, Morphing Jar, Sangan, and a full Trap line.</p>
<h2>The rules of the two Tuners</h2>
<p>Both Tuners come with limits written on the card. The whole deck is built around them.</p>
<ul>
<li><b>${cn('Quickdraw Synchron','Quickdraw')}</b> can only be Synchro Material for a monster that lists a "Synchron" Tuner. In this Extra Deck that means ${cn('Drill Warrior')}, Turbo Warrior, ${cn('Junk Archer')} and Nitro Warrior.</li>
<li><b>${cn('Debris Dragon','Debris')}</b> can only be material for a <b>Dragon</b> Synchro, and the other materials can't be Level 4. That means Black Rose Dragon, ${cn('Ancient Fairy Dragon')}, Iron Chain Dragon, Stardust Dragon and Red Dragon Archfiend.</li>
</ul>
<div class="tbl-wrap"><table><thead><tr><th>Materials</th><th>Level</th><th>Description</th></tr></thead><tbody>
<tr><td>Quickdraw + 1 Fluff</td><td>6</td><td>Drill Warrior or Turbo Warrior</td></tr>
<tr><td>Quickdraw + 2 Fluff or Ryko</td><td>7</td><td>Junk Archer or Nitro Warrior</td></tr>
<tr><td>Debris + Ryko</td><td>6</td><td>Iron Chain Dragon</td></tr>
<tr><td>Debris + Dandylion or Lonefire</td><td>7</td><td>Black Rose Dragon or Ancient Fairy Dragon</td></tr>
<tr><td>Debris + Dandylion + Fluff</td><td>8</td><td>Stardust Dragon or Red Dragon Archfiend</td></tr>
</tbody></table></div>
<h2>A sample turn</h2>
<p>Your hand has Quickdraw Synchron, Dandylion and Debris Dragon.</p>
<ol class="steps">
<li><div>Use Quickdraw's effect: send Dandylion from your hand to the GY and Special Summon Quickdraw. Dandylion makes 2 Fluff Tokens.</div></li>
<li><div>Synchro Summon Drill Warrior with Quickdraw (5) and 1 Fluff (1).</div></li>
<li><div>Normal Summon Debris Dragon. Revive Dandylion (300 ATK) in Attack Position with its effects negated.</div></li>
<li><div>Synchro Summon Ancient Fairy Dragon with Debris (4) and Dandylion (3). Dandylion is in the GY again, off the field, so it makes 2 more Fluff Tokens.</div></li>
<li><div>You end with Drill Warrior, Ancient Fairy Dragon and 3 Fluff Tokens from three cards.</div></li>
</ol>
${call('rule','Black Rose and Dandylion',`<p>If you Synchro Summon Black Rose Dragon using Dandylion, Black Rose's "destroy all cards" can only be Chain Link 2. Dandylion's tokens are summoned after everything is destroyed, so they survive.</p>`)}
<p>${cn('Lonefire Blossom','Lonefire')} adds more. Fluff Tokens are WIND Plants, so Lonefire can Tribute one to bring ${cn('Tytannial, Princess of Camellias','Tytannial')} or another Dandylion from the Deck. Tytannial then guards the board by Tributing a Plant to negate targeting cards. Late in the game, ${cn('Pot of Avarice')} shuffles used monsters back so you can draw them again.</p>
<h2>The Volcanic version</h2>
<p>The <a href="#deck-Quickdraw%20Volcanic">Quickdraw Volcanic list</a> (listed as a Contender deck) swaps the Plants for Pyros. Quickdraw sends ${cn('Volcanic Shell')} from the hand to the GY. Shell in the GY can pay 500 LP to add another Shell from the Deck. ${cn('Blaze Accelerator')} sends a Pyro with 500 or less ATK from your hand, like Shell, to destroy a monster. Volcanic Rocket adds Blaze Accelerator when it is Summoned. The list also runs 2 Royal Decree, which negates all other Trap effects on the field.</p>
<h2>Weaknesses and how to play against it</h2>
<ul>
<li><b>Special Summons everywhere.</b> ${cn('Royal Oppression')} can negate Quickdraw's effect, the tokens and the Synchro. Fossil Dyna Pachycephalo and Vanity's Fiend stop Special Summons outright.</li>
<li><b>Debris needs a Normal Summon.</b> Pulling the Rug negates its revive and destroys it.</li>
<li><b>Synchros can be stopped as they land.</b> Thunder King Rai-Oh can negate a Synchro Summon. Solemn Judgment can too.</li>
<li><b>Tytannial only stops cards that target.</b> Use cards that don't target, like Black Rose Dragon or Heavy Storm, against a Tytannial board.</li>
</ul>
${call('mistake','Common mistakes against Quickdraw',`<ul><li>Destroying Dandylion. Destroyed or sent anywhere to the GY, it still makes tokens.</li><li>Thinking Quickdraw can make Stardust Dragon. It can't. Stardust needs a generic Tuner.</li><li>Ignoring the Fluff Tokens. Each one is a Level for the next Synchro.</li></ul>`)}
<p>E3 Yu-Gi-Oh has a full Quickdraw Dandywarrior guide in the <a href="#library">Library</a>.</p>
<div class="recap"><h2>Recap</h2><ul><li>Quickdraw makes only "Synchron" Synchros. Debris makes only Dragon Synchros.</li><li>Dandylion makes 2 tokens every time it reaches the GY, from anywhere.</li><li>Lonefire and Tytannial use Plants, and Fluff Tokens are Plants.</li><li>Special Summon locks, Pulling the Rug and summon negation beat it.</li></ul></div>`,
flash:[
['Quickdraw Synchron (Level 5) and a Fluff Token are on your field. What can you make?','A Level 6 that lists a "Synchron" Tuner: Drill Warrior or Turbo Warrior.'],
['Can Debris Dragon and a Level 4 monster make a Level 8 Dragon?','No. Debris Dragon\'s other materials can\'t be Level 4.'],
['Dandylion is used as Synchro Material. What happens?','It goes to the GY and makes 2 Fluff Tokens.'],
['Why can Lonefire Blossom Tribute a Fluff Token?','Fluff Tokens are Plants, and Lonefire Tributes a face-up Plant.'],
['Name a card that stops a Quickdraw turn before it starts.','Royal Oppression, Fossil Dyna Pachycephalo or Vanity\'s Fiend, since the deck Special Summons a lot.'],
['What does the Volcanic version use Quickdraw\'s cost on?','Volcanic Shell, which can then search another Shell from the GY.']
]},

/* ---------------- 20 Lightsworn ---------------- */
{n:21,title:'Lightsworn',sub:'A deck that throws its own cards into the Graveyard, on purpose.',min:4,
cards:['Lyla, Lightsworn Sorceress','Wulf, Lightsworn Beast','Judgment Dragon','Garoth, Lightsworn Warrior','Celestia, Lightsworn Angel','Lumina, Lightsworn Summoner','Solar Recharge','Charge of the Light Brigade','Necro Gardna'],
html:`
<div class="goals"><h4>What you will learn</h4><ul><li>Why Lightsworn sends its own cards to the Graveyard</li><li>How Wulf, Garoth and Judgment Dragon reward the mill</li><li>The cards that beat Lightsworn</li></ul></div>
<h2>The deck</h2>
<p>Lightsworn monsters are LIGHT. Most of them send cards from the top of your Deck to the GY at the end of your turn. Players call that "milling." The <a href="#deck-Lightsworn">Lightsworn list</a> is listed as a Competitive deck on this site.</p>
${call('analogy','Think of it like this',`<p>Most decks treat the Graveyard as a trash can. Lightsworn treats it as a second hand. Every card that falls in is a resource.</p>`)}
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Copies</th><th>Description</th></tr></thead><tbody>
<tr><td>Ryko, Lightsworn Hunter</td><td>3</td><td>Flip: destroy a card, then mill 3.</td></tr>
<tr><td>${cn('Wulf, Lightsworn Beast')}</td><td>3</td><td>2100 ATK. If it is sent from your Deck to the GY, it Special Summons itself.</td></tr>
<tr><td>${cn('Solar Recharge')}</td><td>3</td><td>Discard a Lightsworn monster: draw 2, then mill 2.</td></tr>
<tr><td>${cn('Judgment Dragon')}</td><td>2</td><td>Summoned with 4+ Lightsworn of different names in the GY. Pay 1000 LP to destroy all other cards.</td></tr>
<tr><td>${cn('Celestia, Lightsworn Angel')}</td><td>2</td><td>Tribute Summon it with a Lightsworn: mill 4, then destroy up to 2 of your opponent's cards.</td></tr>
<tr><td>Jain, Lightsworn Paladin</td><td>2</td><td>1800 ATK beater, 2100 while attacking a monster. Mills 2.</td></tr>
<tr><td>Monster Reincarnation</td><td>2</td><td>Discard 1 card to add a monster from your GY to your hand.</td></tr>
<tr><td>${cn('Lyla, Lightsworn Sorceress')}</td><td>1</td><td>Switches to Defense to destroy a Spell or Trap. Mills 3.</td></tr>
<tr><td>${cn('Garoth, Lightsworn Warrior')}</td><td>1</td><td>If another Lightsworn's effect mills you, mill 2 more and draw 1 per Lightsworn milled.</td></tr>
<tr><td>${cn('Lumina, Lightsworn Summoner')}</td><td>1</td><td>Discard 1: revive a Level 4 or lower Lightsworn. Mills 3.</td></tr>
<tr><td>${cn('Charge of the Light Brigade')}</td><td>1</td><td>Mill 3, then add a Level 4 or lower Lightsworn from the Deck.</td></tr>
</tbody></table></div>
<p>The list also has Aurkus, Ehren, Necro Gardna, Plaguespreader Zombie, Card Trooper, 2 Honest, 2 Royal Decree and Cold Wave.</p>
<h2>The engine: mill, then cash in</h2>
<p>Here is how much each card sends from the Deck to the GY.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Cards milled</th><th>When</th></tr></thead><tbody>
<tr><td>Lyla, Lumina, Ehren</td><td>3</td><td>Your End Phase, if face-up</td></tr>
<tr><td>Jain, Aurkus</td><td>2</td><td>Your End Phase, if face-up</td></tr>
<tr><td>Judgment Dragon</td><td>4</td><td>Your End Phase, if face-up</td></tr>
<tr><td>Ryko</td><td>3</td><td>When flipped</td></tr>
<tr><td>Celestia</td><td>4</td><td>As the cost of its effect</td></tr>
<tr><td>Charge, Solar Recharge</td><td>3 or 2</td><td>When played</td></tr>
</tbody></table></div>
<p>Every mill can hit something good:</p>
<ul>
<li><b>${cn('Wulf, Lightsworn Beast','Wulf')}</b> lands on the field for free.</li>
<li><b>${cn('Necro Gardna')}</b> can be banished from the GY on your opponent's turn to negate an attack.</li>
<li><b>Plaguespreader Zombie</b> revives itself if you put a card from your hand on top of the Deck. It is a Tuner, and Lyla and Lumina are Spellcasters, so it can make Tempest Magician (Level 6).</li>
<li><b>Each Lightsworn with a new name</b> counts toward ${cn('Judgment Dragon')}.</li>
</ul>
${call('rule','When Garoth draws',`<p>${cn('Garoth, Lightsworn Warrior','Garoth')} only triggers when cards are sent by the <b>effect</b> of another Lightsworn <b>monster</b>. Celestia mills as a cost, so Garoth does not trigger from it. Spells like Solar Recharge are not monsters, so they do not trigger it either.</p>`)}
<h2>The plan</h2>
<p>Lightsworn plays a steady game. Early on, it summons a Lightsworn, mills at the End Phase, and uses Solar Recharge and Charge to draw and dig. Wulf and Necro Gardna make the mill pay off. Once four different Lightsworn names are in the GY, Judgment Dragon can come out from the hand. It can pay 1000 LP to destroy every other card on the field, and then attack with 3000 ATK.</p>
${call('key','The cost of the mill',`<p>A 40-card Deck shrinks fast. Lyla and Judgment Dragon alone send 7 cards a turn. Long games can end with a Lightsworn player running out of cards, so they need to win before that.</p>`)}
<h2>Weaknesses and how to play against it</h2>
<ul>
<li><b>Light-Imprisoning Mirror</b> negates LIGHT monster effects activated on the field or in the GY. That covers the End Phase mills, Wulf and Judgment Dragon's effect.</li>
<li><b>Graveyard removal.</b> D.D. Crow and Soul Release banish cards from the GY. Fewer Lightsworn names there means no Judgment Dragon.</li>
<li><b>Special Summon locks.</b> ${cn('Royal Oppression')}, Fossil Dyna Pachycephalo and Vanity's Fiend stop Wulf, Lumina's revive and Judgment Dragon.</li>
<li><b>Big summons.</b> Bottomless Trap Hole hits Judgment Dragon, Celestia and Wulf.</li>
</ul>
${call('mistake','Common mistakes against Lightsworn',`<ul><li>Putting your whole hand on the field. Judgment Dragon can clear it all. Keep cards back.</li><li>Forgetting Necro Gardna in their GY. Plan for one attack to be negated.</li><li>Counting their GY loosely. Count the different Lightsworn names. Three means one more mill could bring Judgment Dragon.</li></ul>`)}
<div class="recap"><h2>Recap</h2><ul><li>Lightsworn mills itself at the End Phase and with Ryko, Celestia, Charge and Solar Recharge.</li><li>Wulf, Necro Gardna and Plaguespreader turn milled cards into value.</li><li>Four different Lightsworn names in the GY unlock Judgment Dragon.</li><li>Light-Imprisoning Mirror, GY removal and Special Summon locks hurt it most.</li></ul></div>`,
flash:[
['Wulf is milled by Lyla\'s End Phase effect. What happens?','Wulf Special Summons itself, because it was sent from the Deck to the GY.'],
['What does Judgment Dragon need in the GY to be Special Summoned?','4 or more Lightsworn monsters with different names.'],
['Does Garoth draw when Celestia mills 4 cards?','No. Celestia mills as a cost, and Garoth needs another Lightsworn\'s effect.'],
['Why is Light-Imprisoning Mirror strong against Lightsworn?','It negates LIGHT monster effects activated on the field or in the GY, like the mills, Wulf and Judgment Dragon.'],
['Your opponent has 3 different Lightsworn names in the GY. Why be careful?','One more name lets them Special Summon Judgment Dragon and wipe the field.'],
['What is the risk of milling so much?','The Deck runs out fast, so long games can end with them unable to draw.']
]},

/* ---------------- 21 Vayu Turbo ---------------- */
{n:22,title:'Vayu Turbo',sub:'Fill the Graveyard with DARKs, then pull Synchros out of it.',min:5,
cards:['Blackwing - Vayu the Emblem of Honor','Blackwing - Sirocco the Dawn','Armageddon Knight','Dark Grepher','Blackwing Armed Wing','Plaguespreader Zombie','Burial from a Different Dimension','Dark Armed Dragon','Super-Nimble Mega Hamster'],
html:`
<div class="goals"><h4>What you will learn</h4><ul><li>What "turbo" means, and how this deck fills its Graveyard</li><li>How Vayu and Sirocco make Armed Wing, and what comes next</li><li>How to slow Vayu Turbo down</li></ul></div>
<h2>The deck</h2>
<p>Vayu Turbo uses only a few Blackwings. It does not search with Black Whirlwind. It sends Vayu and Sirocco straight to the Graveyard and summons Synchros from there. "Turbo" means it races to set this up. The <a href="#deck-Vayu%20Turbo">Vayu Turbo list</a> is listed in the Best tier on this site.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Copies</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Blackwing - Vayu the Emblem of Honor')}</td><td>3</td><td>From the GY, banishes itself and a non-Tuner Blackwing for a Blackwing Synchro.</td></tr>
<tr><td>${cn('Blackwing - Sirocco the Dawn')}</td><td>3</td><td>Level 5 DARK. Vayu's partner: 1 + 5 = Level 6.</td></tr>
<tr><td>${cn('Armageddon Knight')}</td><td>2</td><td>When Summoned, send a DARK monster from your Deck to the GY.</td></tr>
<tr><td>${cn('Dark Grepher')}</td><td>2</td><td>Special Summon it by discarding a Level 5+ DARK. Discard a DARK to send a DARK from Deck to GY.</td></tr>
<tr><td>Ryko, Lightsworn Hunter</td><td>3</td><td>Flip: destroy a card, then mill 3.</td></tr>
<tr><td>${cn('Super-Nimble Mega Hamster')}</td><td>2</td><td>Flip: Special Summon a Level 3 or lower Beast from the Deck face-down, like Ryko.</td></tr>
<tr><td>Caius the Shadow Monarch</td><td>2</td><td>Tribute Summon: banish a card, 1000 damage if it was DARK.</td></tr>
<tr><td>${cn('Plaguespreader Zombie')}</td><td>1</td><td>Level 2 Tuner. Revives itself from the GY by putting a card from your hand on top of the Deck.</td></tr>
<tr><td>${cn('Burial from a Different Dimension')}</td><td>1</td><td>Returns up to 3 banished monsters to the GY.</td></tr>
<tr><td>${cn('Dark Armed Dragon')}</td><td>1</td><td>Comes out with exactly 3 DARKs in the GY. Banishes DARKs to destroy cards.</td></tr>
</tbody></table></div>
<p>It also runs Gale, Card Trooper, Spirit Reaper, Reinforcement of the Army (for Armageddon Knight or Dark Grepher, both Level 4 Warriors), Allure of Darkness, Royal Oppression and a Trap line.</p>
<h2>The engine</h2>
<p>Vayu needs two things in the GY: itself and a non-Tuner Blackwing. In this deck, that Blackwing is Sirocco.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Description</th></tr></thead><tbody>
<tr><td>Armageddon Knight</td><td>Sends Vayu or Sirocco from the Deck when Summoned.</td></tr>
<tr><td>Dark Grepher (summon)</td><td>Discard Sirocco, a Level 5 DARK, to Special Summon Grepher.</td></tr>
<tr><td>Dark Grepher (effect)</td><td>Discard a DARK, then send Vayu or Sirocco from the Deck.</td></tr>
<tr><td>Ryko, Card Trooper</td><td>Mill the top of the Deck and hope to hit pieces.</td></tr>
<tr><td>Burial</td><td>Puts banished Vayu and Sirocco back in the GY to use again.</td></tr>
</tbody></table></div>
<p>Here is one turn that follows the cards' text. Your hand has Armageddon Knight, Dark Grepher and Sirocco.</p>
<ol class="steps">
<li><div>Normal Summon ${cn('Armageddon Knight')}. Send Vayu from your Deck to the GY.</div></li>
<li><div>Discard Sirocco to Special Summon ${cn('Dark Grepher')}. Sirocco and Vayu are both in the GY.</div></li>
<li><div>Use Vayu: banish Vayu and Sirocco and Special Summon ${cn('Blackwing Armed Wing')} (1 + 5 = 6) from the Extra Deck. Its effects are negated, but it still has 2300 ATK.</div></li>
<li><div>You control three monsters: 1400, 1700 and 2300 ATK. That is a lot of damage from three cards.</div></li>
</ol>
<h2>What comes after Armed Wing</h2>
<p>Armed Wing is a Level 6 non-Tuner on the field. That opens more doors:</p>
<ul>
<li>${cn('Plaguespreader Zombie','Plaguespreader')} (2) + Armed Wing (6) = Level 8: Stardust Dragon, Colossal Fighter, Thought Ruler Archfiend or Dark End Dragon. Dark End needs DARK non-Tuners, and Armed Wing is DARK.</li>
<li>Armed Wing is a Blackwing, so Gale can Special Summon itself next to it. Gale (3) + Dark Grepher (4) = Level 7, like Blackwing Armor Master.</li>
<li>Armed Wing can be a Tribute for Caius.</li>
</ul>
${call('rule','Vayu rulings to know',`<ul><li>The Synchro is not Synchro Summoned. It can't be revived later by effects like Goyo Guardian.</li><li>If Royal Oppression is chained to Vayu's effect, Vayu is not banished. It can try again later that turn.</li><li>If the Synchro can't be summoned when the effect resolves, Vayu and the target are still banished.</li></ul>`)}
${call('key','Exactly 3 DARKs',`<p>${cn('Dark Armed Dragon')} needs <b>exactly</b> 3 DARK monsters in the GY. A deck that sends many DARKs there can go past 3. Vayu banishing two DARKs helps bring the count back down.</p>`)}
<h2>Weaknesses and how to play against it</h2>
<ul>
<li><b>It lives in the Graveyard.</b> D.D. Crow can banish Vayu or Sirocco from the GY before they are used. Soul Release banishes up to 5 cards. Kycoo the Ghost Destroyer stops your opponent from banishing from either GY, which turns off Vayu and Dark Armed Dragon.</li>
<li><b>It Special Summons.</b> ${cn('Royal Oppression')}, Fossil Dyna Pachycephalo and Vanity's Fiend stop Vayu, Dark Grepher and Plaguespreader.</li>
<li><b>Almost all DARK.</b> Consecrated Light stops DARKs from being summoned or attacking.</li>
<li><b>Normal Summon triggers.</b> Pulling the Rug negates Armageddon Knight's effect when it is Normal Summoned.</li>
</ul>
${call('mistake','Common mistakes against Vayu Turbo',`<ul><li>Watching only the field. Count Vayus and Siroccos in their GY every turn.</li><li>Using D.D. Crow on a random card. Save it for Vayu or Sirocco.</li><li>Forgetting Burial. Banished Vayus can come back to the GY at Quick-Play speed.</li></ul>`)}
<p>IMNerd (Frazier Smith) has a full Vayu Turbo episode of "Teach Me How to Cook" in the <a href="#library">Library</a>.</p>
<div class="recap"><h2>Recap</h2><ul><li>Vayu Turbo sends Vayu and Sirocco to the GY with Armageddon Knight, Dark Grepher and mills.</li><li>Vayu + Sirocco makes a Level 6 Armed Wing with its effects negated.</li><li>Armed Wing then helps make Level 7 and 8 Synchros, or feeds Caius.</li><li>GY removal, Special Summon locks and Consecrated Light slow it down.</li></ul></div>`,
flash:[
['What two cards does Vayu need in the GY to make Blackwing Armed Wing?','Vayu itself and a Level 5 non-Tuner Blackwing, Sirocco the Dawn.'],
['How can Dark Grepher be Special Summoned?','By discarding a Level 5 or higher DARK monster, like Sirocco.'],
['What does Burial from a Different Dimension do for this deck?','It returns banished Vayu and Sirocco to the GY so Vayu can be used again.'],
['Armed Wing (Level 6) and Plaguespreader Zombie are on your field. What Level can you make?','Level 8, like Stardust Dragon, Colossal Fighter or Dark End Dragon.'],
['Your opponent has 4 DARKs in the GY. Can they summon Dark Armed Dragon?','No. It needs exactly 3 DARK monsters in the GY.'],
['Name a card that stops Vayu without touching the field.','D.D. Crow or Soul Release to banish it, or Kycoo the Ghost Destroyer to stop banishing from the GY.']
]},

/* ---------------- 22 HEROs ---------------- */
{n:23,title:'HEROs',sub:'Four HERO decks, one toolkit: Miracle Fusion, Absolute Zero and friends.',min:5,
cards:['Elemental HERO Stratos','E - Emergency Call','Miracle Fusion','Elemental HERO Absolute Zero','Deep Sea Diva','Destiny HERO - Malicious','Elemental HERO Neos Alius','Hero Blast','Skill Drain'],
html:`
<div class="goals"><h4>What you will learn</h4><ul><li>The HERO cards every HERO deck shares</li><li>How Diva Hero, Diva Hero Beat and Hero Beat use them differently</li><li>How to handle Elemental HERO Absolute Zero</li></ul></div>
<h2>Four decks, one toolkit</h2>
<p>This site lists four HERO decks. They share a core of searchers and fusions, then go different ways.</p>
<div class="tbl-wrap"><table><thead><tr><th>Deck</th><th>Tier</th><th>Description</th></tr></thead><tbody>
<tr><td><a href="#deck-Diva%20Hero">Diva Hero</a></td><td>Competitive</td><td>Deep Sea Diva and Destiny HERO - Malicious for fast Synchros.</td></tr>
<tr><td><a href="#deck-Diva%20Hero%20Beat">Diva Hero Beat</a></td><td>Competitive</td><td>Diva plus Gemini beaters and lots of Traps.</td></tr>
<tr><td><a href="#deck-Hero%20Beat">Hero Beat</a></td><td>Rogue</td><td>Gemini beaters behind Skill Drain and Royal Oppression.</td></tr>
<tr><td><a href="#deck-Hero%20Frog">Hero Frog</a></td><td>Best</td><td>Frogs and Monarchs with a HERO fusion package. See Lesson 24.</td></tr>
</tbody></table></div>
<h2>The shared toolkit</h2>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('E - Emergency Call')}</td><td>Adds an Elemental HERO from your Deck to your hand.</td></tr>
<tr><td>${cn('Elemental HERO Stratos')}</td><td>On Summon: add a HERO from the Deck, or destroy Spells/Traps (one per other face-up HERO).</td></tr>
<tr><td>Elemental HERO Ocean</td><td>Each Standby Phase, returns a HERO from your field or GY to your hand.</td></tr>
<tr><td>${cn('Miracle Fusion')}</td><td>Banishes materials from your field or GY to Fusion Summon an Elemental HERO Fusion.</td></tr>
<tr><td>${cn('Elemental HERO Absolute Zero')}</td><td>Fusion of 1 HERO + 1 WATER. When it leaves the field, destroy all your opponent's monsters.</td></tr>
<tr><td>Elemental HERO Gaia</td><td>Fusion of 1 Elemental HERO + 1 EARTH. Halves a monster's ATK and gains it.</td></tr>
</tbody></table></div>
<p>Miracle Fusion is the glue. It takes materials from the GY, so a HERO and a WATER monster that died earlier become Absolute Zero later. Ocean is both a HERO and a WATER, so Ocean alone in the GY with any other HERO is enough.</p>
${call('key','Absolute Zero is a trap for removal',`<p>${cn('Elemental HERO Absolute Zero','Absolute Zero')} destroys all your monsters when it leaves the field. That includes being destroyed, bounced, banished or returned to the Extra Deck. The ruling exception: if it is <b>face-down</b> when it leaves, nothing happens. Book of Moon it first, then remove it.</p>`)}
<h2>Diva Hero</h2>
<p>${cn('Deep Sea Diva')} is a Level 2 Tuner. When Normal Summoned, it Special Summons a Level 3 or lower Sea Serpent from the Deck: Spined Gillman (Level 3) or another Diva. ${cn('Destiny HERO - Malicious')} is a Level 6 DARK. From the GY, it banishes itself to Special Summon another Malicious from the Deck.</p>
<ol class="steps">
<li><div>Discard Malicious to Special Summon Dark Grepher. Then banish that Malicious from the GY to Special Summon a second Malicious from the Deck.</div></li>
<li><div>Normal Summon Deep Sea Diva and Special Summon Spined Gillman.</div></li>
<li><div>Diva (2) + Malicious (6) = Level 8, like Stardust Dragon. Or Diva (2) + Gillman (3) = Level 5, like Ally of Justice Catastor.</div></li>
</ol>
<p>The list adds Plaguespreader Zombie (another Level 2 Tuner), 3 Caius, Dark Armed Dragon and Future Fusion. Future Fusion reveals a Fusion and sends its materials from your Deck to the GY, like a Malicious and a WATER monster for Absolute Zero. Those cards are then ready for Malicious's effect and Miracle Fusion.</p>
<h2>Hero Beat and Diva Hero Beat</h2>
<p>${cn('Elemental HERO Neos Alius','Neos Alius')} is a Gemini monster. It is a Normal Monster on the field and in the GY until you Normal Summon it a second time. Hero Beat uses that:</p>
<ul>
<li><b>Gemini Spark</b> Tributes a face-up Level 4 Gemini to destroy a card and draw 1.</li>
<li><b>${cn('Hero Blast')}</b> returns an Elemental HERO Normal Monster from the GY, like Alius, to your hand. Then it destroys an opponent's monster with ATK equal to or lower than it, so up to 1900.</li>
<li><b>Honest</b> gives a battling LIGHT monster the ATK of its opponent. Alius, Captain Gold and Thunder King are LIGHT.</li>
</ul>
<p>Hero Beat is a stun deck. It runs 2 ${cn('Skill Drain')}, 2 Royal Oppression and Thunder King Rai-Oh. Skill Drain negates the effects of face-up monsters. Alius is a plain Normal Monster on the field anyway, so it barely cares. Thunder King stops searching except by drawing. Captain Gold adds Skyscraper, which gives an Elemental HERO 1000 ATK when it attacks a bigger monster. Its Extra Deck has three each of Absolute Zero, Gaia, Superalloy Beast Raptinus, Chimeratech Fortress Dragon and Stardust Dragon. Stardust can arrive through Starlight Road.</p>
<p>Diva Hero Beat mixes both ideas. It runs 3 Diva, 2 Gillman, 3 Alius, 3 Gemini Spark and 14 Traps. Its Extra Deck adds Sea Dragon Lord Gishilnodon, which needs a Tuner plus exactly one Level 3 non-Tuner. Diva and Gillman fit that.</p>
<h2>Weaknesses and how to play against them</h2>
<ul>
<li><b>Searching.</b> Thunder King Rai-Oh stops E - Emergency Call, Stratos's search and Reinforcement of the Army.</li>
<li><b>Banishing from the GY.</b> Kycoo the Ghost Destroyer stops Miracle Fusion's GY materials and Malicious's effect.</li>
<li><b>Normal Summon triggers.</b> Pulling the Rug negates Deep Sea Diva and a Normal Summoned Stratos.</li>
<li><b>Diva Hero is mostly DARK.</b> Malicious, Caius, Dark Grepher and Dark Armed Dragon all fall to Consecrated Light.</li>
<li><b>Hero Beat locks you.</b> Save Mystical Space Typhoon or Dust Tornado for Skill Drain or Royal Oppression.</li>
</ul>
${call('mistake','Common mistakes against HEROs',`<ul><li>Destroying a face-up Absolute Zero while you have monsters out. Flip it face-down first, or clear your own board.</li><li>Ignoring their GY. Miracle Fusion can use it at any time.</li><li>Attacking a LIGHT monster when they hold a card. Honest can match your ATK.</li></ul>`)}
<p>E3 Yu-Gi-Oh has a Diva Hero guide and a Hero Beat guide in the <a href="#library">Library</a>.</p>
<div class="recap"><h2>Recap</h2><ul><li>All HERO decks share E - Emergency Call, Stratos, Miracle Fusion and Absolute Zero.</li><li>Diva Hero uses Diva and Malicious for quick Level 5 and Level 8 Synchros.</li><li>Hero Beat uses Gemini beaters behind Skill Drain and Royal Oppression.</li><li>Flip Absolute Zero face-down before you remove it.</li></ul></div>`,
flash:[
['What does Miracle Fusion use as Fusion Material?','Monsters on your field or in your GY, which it banishes.'],
['Absolute Zero is bounced to the Extra Deck. Does its effect trigger?','Yes. It triggers whenever it leaves the field face-up, even back to the Extra Deck.'],
['How do you remove Absolute Zero without losing your monsters?','Flip it face-down first, for example with Book of Moon. Then it does not trigger when it leaves.'],
['You Normal Summon Deep Sea Diva. What can you Special Summon?','A Level 3 or lower Sea Serpent from your Deck, like Spined Gillman or another Diva.'],
['Why does Skill Drain barely hurt Neos Alius?','Alius is treated as a Normal Monster on the field unless Normal Summoned again.'],
['Which card stops HERO searches like E - Emergency Call?','Thunder King Rai-Oh. Neither player can add cards from the Deck except by drawing.']
]},

/* ---------------- 23 Frog Monarchs ---------------- */
{n:24,title:'Frog Monarchs',sub:'Frogs that come back every turn, used to Tribute Summon Monarchs.',min:6,
cards:['Treeborn Frog','Swap Frog','Substitoad','Dupe Frog','Junk Synchron','Caius the Shadow Monarch','Raiza the Storm Monarch','Enemy Controller','Battle Fader'],
html:`
<div class="goals"><h4>What you will learn</h4><ul><li>How Frogs give you free Tributes for Monarchs</li><li>How Junk Synchron turns Frogs into Synchros</li><li>Why the deck runs so few Traps, and how to beat it</li></ul></div>
<h2>The deck</h2>
<p>Monarchs are Level 6 monsters with an effect when they are Tribute Summoned. Each needs one Tribute. Frogs supply those Tributes, turn after turn. The <a href="#deck-Junk%20Frog">Junk Frog list</a> and the <a href="#deck-Hero%20Frog">Hero Frog list</a> are both listed in the Best tier on this site.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Copies</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Treeborn Frog')}</td><td>2</td><td>In your Standby Phase, comes back from the GY if you control no Spells or Traps.</td></tr>
<tr><td>${cn('Swap Frog')}</td><td>3</td><td>Discard a WATER to summon it. On Summon, sends a Level 2 or lower WATER Aqua to the GY.</td></tr>
<tr><td>${cn('Substitoad')}</td><td>3</td><td>Tribute a monster to Special Summon a Frog from the Deck. Frogs can't be destroyed by battle.</td></tr>
<tr><td>${cn('Dupe Frog')}</td><td>2</td><td>Opponents can only attack it. Leaving the field for the GY, it adds a Frog.</td></tr>
<tr><td>${cn('Junk Synchron')}</td><td>3</td><td>Level 3 Tuner. When Normal Summoned, revives a Level 2 or lower monster in Defense.</td></tr>
<tr><td>${cn('Caius the Shadow Monarch')}</td><td>3</td><td>Banishes a card. 1000 damage if it was a DARK monster.</td></tr>
<tr><td>${cn('Raiza the Storm Monarch')}</td><td>2</td><td>Puts a card on top of its owner's Deck. This is mandatory.</td></tr>
<tr><td>Mobius the Frost Monarch</td><td>1</td><td>Destroys up to 2 Spells or Traps.</td></tr>
<tr><td>${cn('Enemy Controller')}</td><td>2</td><td>Change a monster's position, or Tribute a monster to take control of one until the End Phase.</td></tr>
<tr><td>${cn('Battle Fader')}</td><td>2</td><td>When a monster attacks you directly, Special Summon it and end the Battle Phase.</td></tr>
</tbody></table></div>
<p>Junk Frog also runs Unifrog, Tragoedia, Gorz, Dark Armed Dragon, 2 Gold Sarcophagus, Scapegoat, Cold Wave, 2 Threatening Roar and only one Mirror Force.</p>
<h2>Treeborn Frog: the free Tribute</h2>
<p>${cn('Treeborn Frog','Treeborn')} is the heart of the deck. Tribute it for a Monarch, and it waits in the GY. Next Standby Phase, if you control no Spells or Traps, it Special Summons itself. In Edison this effect is not once per turn.</p>
${call('analogy','Think of it like this',`<p>Treeborn is a boomerang. You throw it away to pay for a Monarch, and it flies back on your next turn, ready to be thrown again.</p>`)}
<p>That explains the deck list. Junk Frog has 12 Spells and only 3 Traps. Most Spells are used right away and leave the field. A Trap sits set on the field, and a set card stops Treeborn from coming back.</p>
${call('key','The Monarch loop',`<ol class="steps"><li><div>Standby Phase: Treeborn returns from the GY.</div></li><li><div>Main Phase: Tribute Treeborn to Tribute Summon a Monarch. Its effect removes one of your opponent's cards.</div></li><li><div>Next turn, do it again. Each loop is a free card.</div></li></ol>`)}
<h2>The Frog engine and Junk Synchron</h2>
<p>The other Frogs move cards around to set up Treeborn and Synchros.</p>
<ul>
<li><b>${cn('Swap Frog')}</b> can be Special Summoned by discarding another WATER, like Treeborn. When it is summoned, it can send a Level 2 or lower WATER Aqua from the Deck to the GY, like Treeborn or Dupe Frog. It can also return a monster you control to your hand to let you Normal Summon one more Frog that turn.</li>
<li><b>${cn('Substitoad')}</b> Tributes a monster to Special Summon any Frog from the Deck.</li>
<li><b>${cn('Dupe Frog')}</b> adds a Frog from the Deck or GY when it goes from the field to the GY. Ruling: if Dupe is Tributed for Substitoad's cost, it misses the timing and adds nothing.</li>
</ul>
<p>Here is a short turn from the cards' text. Your hand has Swap Frog, Treeborn Frog and Junk Synchron.</p>
<ol class="steps">
<li><div>Discard Treeborn Frog to Special Summon Swap Frog. Treeborn is now in the GY, ready to return.</div></li>
<li><div>Swap Frog's summon effect sends Dupe Frog from the Deck to the GY.</div></li>
<li><div>Normal Summon ${cn('Junk Synchron')}. Revive Treeborn (Level 1) in Defense Position with its effects negated.</div></li>
<li><div>Junk (3) + Swap (2) + Treeborn (1) = Level 6: Goyo Guardian or Brionac. Treeborn goes back to the GY and can return next Standby.</div></li>
</ol>
<p>Junk Synchron also makes Junk Warrior (Level 5, with any Level 2 Frog), which gains the ATK of all your Level 2 and lower monsters. Junk (3) + Treeborn (1) makes Armory Arm (Level 4).</p>
<h2>Defense and the Hero Frog version</h2>
<p>Frog Monarchs defend without Traps. Dupe Frog forces attacks into itself, and Substitoad keeps Frogs from being destroyed by battle. Battle Fader stops a direct attack and ends the Battle Phase. Tragoedia comes out from the hand when you take battle damage. Threatening Roar stops attacks for a turn.</p>
<p>Hero Frog keeps the Frogs and Monarchs, and adds a HERO package from Lesson 23. Frogs are WATER, so Miracle Fusion can banish a HERO and a Frog from the GY to make Absolute Zero. It runs 3 copies of it. Evil HERO Infernal Prodigy draws a card at the End Phase if it was Tributed for a HERO Tribute Summon, like Evil HERO Malicious Edge. It also plays 3 Raigeki Break and Soul Exchange.</p>
<h2>Weaknesses and how to play against it</h2>
<ul>
<li><b>Treeborn in the GY.</b> D.D. Crow or Soul Release banishes it. The loop stops.</li>
<li><b>Special Summons.</b> Royal Oppression, Fossil Dyna Pachycephalo and Vanity's Fiend stop Treeborn, Swap Frog and Substitoad. Monarchs are Tribute Summoned, so these do not stop them.</li>
<li><b>Summon triggers.</b> A Tribute Summon is a kind of Normal Summon, so Pulling the Rug can negate a Monarch's effect. It also stops Junk Synchron. Solemn Judgment and Bottomless Trap Hole hit Monarchs as they land.</li>
<li><b>The battle wall.</b> Remove Substitoad or Dupe Frog with an effect before you attack.</li>
</ul>
${call('mistake','Common mistakes against Frogs',`<ul><li>Attacking into Dupe Frog with Substitoad on the field. Frogs can't be destroyed by battle.</li><li>Leaving Treeborn in the GY when you hold D.D. Crow. Banish it before their Standby Phase.</li><li>Attacking directly into an empty field with no plan for Battle Fader or Tragoedia.</li></ul>`)}
<p>IMNerd (Frazier Smith) teaches this deck in his "Frog School" series in the <a href="#library">Library</a>.</p>
<div class="recap"><h2>Recap</h2><ul><li>Treeborn Frog returns each Standby Phase if you control no Spells or Traps, giving free Tributes.</li><li>Caius, Raiza and Mobius each remove a card when Tribute Summoned.</li><li>Swap Frog, Substitoad, Dupe Frog and Junk Synchron set up the GY and make Synchros.</li><li>Banish Treeborn, lock Special Summons and use Pulling the Rug to beat it.</li></ul></div>`,
flash:[
['When can Treeborn Frog Special Summon itself?','During your Standby Phase, from the GY, if you control no Spells or Traps and no other Treeborn Frog.'],
['Why does Junk Frog run only 3 Traps?','A set Trap stays on the field, and Treeborn Frog can\'t return while you control a Spell or Trap.'],
['Junk Synchron, Swap Frog and Treeborn Frog are on your field. What Level can you make?','Level 6 (3 + 2 + 1), like Goyo Guardian or Brionac.'],
['Dupe Frog is Tributed for Substitoad\'s effect. Does Dupe add a Frog?','No. Tributing it is a cost, so Dupe misses the timing.'],
['Does Royal Oppression stop a Monarch from being Tribute Summoned?','No. Royal Oppression stops Special Summons, and a Tribute Summon is a Normal Summon.'],
['What is the cleanest way to break the Treeborn loop?','Banish Treeborn Frog from the GY, for example with D.D. Crow or Soul Release.']
]}
]};
