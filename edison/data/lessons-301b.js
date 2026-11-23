/* Edison 301 lessons (25-30), written from the site's card data, rulings and deck lists. */
window.EDISON_LESSONS_301B=function(h){const {cn,call}=h;return [

{n:25,title:'Gladiator Beasts',sub:'Attack, then swap your monster for a fresh one from the Deck.',min:5,
cards:['Gladiator Beast Laquari','Gladiator Beast Bestiari','Gladiator Beast Darius','Test Tiger','Gladiator Beast Gyzarus','Gladiator Beast Heraklinos','Gladiator Beast War Chariot','Elemental HERO Prisma'],
html:`
<div class="goals"><h4>What you will learn</h4><ul><li>How a Gladiator Beast "tags out" after battle</li><li>Why the Deck needs its monsters to battle and survive</li><li>The two Contact Fusions and how the deck reaches them</li><li>How to play against it</li></ul></div>
<h2>The idea: tag out after battle</h2>
<p>Almost every Gladiator Beast has the same second effect. At the end of the Battle Phase, if it battled, you can shuffle it into your Deck. Then you Special Summon a different Gladiator Beast from your Deck.</p>
<p>That new monster is "Special Summoned by the effect of a Gladiator Beast monster." This matters. Each Gladiator Beast has a first effect that only works when it arrives this way.</p>
${call('analogy','Think of it like this',`<p>A tag team in wrestling. One fighter steps in, takes the hit, then tags a partner who jumps in fresh. The partner gets a bonus move on the way in.</p>`)}
<p>The Gladiator Beast list is a <b>Rogue</b> deck in our data: playable and dangerous, but the odds are against it. <a href="#deck-Gladiator%20Beast">Open the Gladiator Beast list</a> to follow along.</p>
<h2>The core cards</h2>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Copies</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Gladiator Beast Laquari')}</td><td>2</td><td>Level 4 with 1800 ATK. Its original ATK becomes 2100 when a Gladiator Beast effect summons it.</td></tr>
<tr><td>${cn('Gladiator Beast Equeste')}</td><td>2</td><td>Tagged in: returns a Gladiator Beast card from your GY to your hand.</td></tr>
<tr><td>${cn('Gladiator Beast Samnite')}</td><td>2</td><td>Tagged in, then it destroys a monster by battle: add a Gladiator Beast card from your Deck.</td></tr>
<tr><td>${cn('Gladiator Beast Retiari')}</td><td>2</td><td>Tagged in: banish 1 card from your opponent's GY.</td></tr>
<tr><td>${cn('Gladiator Beast Bestiari')}</td><td>1</td><td>Limited. Tagged in: destroy 1 Spell or Trap on the field.</td></tr>
<tr><td>${cn('Gladiator Beast Murmillo')}</td><td>1</td><td>Tagged in: destroy 1 face-up monster.</td></tr>
<tr><td>${cn('Gladiator Beast Darius')}</td><td>1</td><td>Tagged in: revive a Gladiator Beast from your GY, with its effects negated.</td></tr>
<tr><td>${cn('Test Tiger')}</td><td>3</td><td>Summons itself if you control a Gladiator Beast. Tribute it to swap one without battling.</td></tr>
<tr><td>${cn('Gladiator Beast War Chariot')}</td><td>2</td><td>Counter Trap. While you control a Gladiator Beast, negate and destroy a monster effect.</td></tr>
<tr><td>${cn('Elemental HERO Prisma')}</td><td>2</td><td>Sends a Fusion Material from the Deck to the GY and takes its name until the End Phase.</td></tr>
</tbody></table></div>
<p>The rest of the Main Deck protects the battles: 3 ${cn('Shrink')}, 3 ${cn('Book of Moon')} and 3 ${cn('Dimensional Prison')}. Shrink halves a monster's original ATK, so your Gladiator Beast can win the fight and survive to tag out.</p>
${call('rule','Edison rulings for the tag out',`<ul><li>"Battled" means the monster was in damage calculation. If its attack is negated, it can't tag out.</li><li>You need a Gladiator Beast left in your Deck to use it.</li><li>${cn('Royal Oppression')} can negate it. The monster has already been shuffled into the Deck, so nothing comes out.</li><li>${cn('Skill Drain')} does not stop it.</li></ul>`)}
<h2>Swapping without battle, and Contact Fusion</h2>
<p>${cn('Test Tiger')} is the deck's shortcut. If you control a face-up Gladiator Beast, you can Special Summon Tiger from your hand. Then Tribute Tiger to shuffle a Gladiator Beast back into the Deck and summon another. The new one counts as summoned by a Gladiator Beast effect, so its bonus works. You can even do this in your Main Phase, before you attack.</p>
<p>${cn('Rescue Cat')} (1, Limited) sends itself to the GY to summon two Level 3 or lower Beasts from the Deck. In this list that means Samnite and Test Tiger. They are destroyed in the End Phase. But a Samnite that battles can tag out at the end of the Battle Phase first.</p>
<p>The Extra Deck holds two <b>Contact Fusions</b>. You don't use Polymerization. You shuffle the listed monsters you control into the Deck.</p>
<div class="tbl-wrap"><table><thead><tr><th>Fusion</th><th>Materials</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Gladiator Beast Gyzarus')}</td><td>Bestiari + 1</td><td>Level 6. When summoned, destroy up to 2 cards. Its tag out brings 2 Gladiator Beasts.</td></tr>
<tr><td>${cn('Gladiator Beast Heraklinos')}</td><td>Laquari + 2</td><td>Level 8, 3000 ATK. Discard 1 card to negate and destroy any Spell or Trap activation.</td></tr>
</tbody></table></div>
<p>Prisma helps here. Reveal Gyzarus, send Bestiari from your Deck to the GY, and Prisma's name becomes "Gladiator Beast Bestiari" until the End Phase. Now Prisma plus any Gladiator Beast can become Gyzarus.</p>
<p>There are no Tuners in the Main Deck. The 3 ${cn('Stardust Dragon')} in the Extra Deck are for ${cn('Starlight Road')} (2 copies), which summons Stardust from the Extra Deck.</p>
<h2>How to play against it</h2>
<ul>
<li><b>Stop the battle.</b> ${cn('Dimensional Prison')} banishes the attacker before damage calculation, so it never battles and never tags out.</li>
<li><b>Stop the summon.</b> ${cn('Royal Oppression')} and ${cn('Fossil Dyna Pachycephalo')} stop Special Summons. Against Gladiator Beasts, that stops the whole engine.</li>
<li><b>Set it face-down.</b> ${cn('Book of Moon')} makes a monster "forget" it was summoned by a Gladiator Beast. Darius also stops targeting its revived monster.</li>
<li><b>Mind War Chariot.</b> While they control a Gladiator Beast, your monster effects can be negated. Spells and Traps get around it, but Heraklinos can negate those.</li>
<li><b>A Normal Summon gets no bonus.</b> A Gladiator Beast that was Normal Summoned has no first effect. Hit it before it battles.</li>
</ul>
${call('mistake','Common mistake',`<p>Attacking into a Gladiator Beast with a monster it can beat. Every battle it wins also gives it a tag out. Make it attack into your traps instead.</p>`)}
<div class="recap"><h2>Recap</h2><ul><li>A Gladiator Beast that battled can shuffle itself back and summon another at the end of the Battle Phase.</li><li>The new one gets a bonus effect because a Gladiator Beast summoned it.</li><li>Test Tiger swaps without battle. Prisma helps make Gyzarus.</li><li>Stop it by stopping the battle or the Special Summon.</li></ul></div>`,
flash:[
["What does a Gladiator Beast need to tag out at the end of the Battle Phase?","It must have battled (been in damage calculation), and there must be another Gladiator Beast in your Deck."],
["Your opponent Normal Summons Gladiator Beast Bestiari. Does it destroy a Spell or Trap?","No. Its first effect only works when a Gladiator Beast effect Special Summons it."],
["How does Dimensional Prison stop a tag out?","It banishes the attacker when the attack is declared, so the monster never battles."],
["Royal Oppression negates a tag out. What happens to the monster that tagged out?","It stays in the Deck. It was shuffled in as a cost, and no new monster is summoned."],
["How does Elemental HERO Prisma help make Gladiator Beast Gyzarus?","It reveals Gyzarus, sends Bestiari from the Deck to the GY, and takes Bestiari's name, so it can be one of the materials."],
["Why does a Gladiator Beast deck with no Tuners run Stardust Dragon?","Starlight Road summons Stardust Dragon from the Extra Deck."]
]},

{n:26,title:'Machina Gadgets, Zombies and Dragons',sub:'Three second-tier decks, each with its own engine.',min:7,
cards:['Green Gadget','Machina Fortress','Deep Sea Diva','Goblin Zombie','Revived King Ha Des','Red-Eyes Darkness Metal Dragon','The White Stone of Legend','Debris Dragon'],
html:`
<div class="goals"><h4>What you will learn</h4><ul><li>How Machina Gadget keeps its hand full of Machines</li><li>How Diva Zombie recycles its Graveyard</li><li>How Dragon Turbo draws cards and brings back big Dragons</li><li>Which cards hurt each deck</li></ul></div>
<h2>Machina Gadget: one Machine finds the next</h2>
<p><a href="#deck-Machina%20Gadget">The Machina Gadget list</a> is a <b>Contender</b> in our data: seen as playable, with few big finishes so far. Every monster in it is a Machine. The data also has a separate <a href="#deck-Machina">Machina list</a> rated Competitive.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Copies</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Green Gadget')}</td><td>3</td><td>When Normal or Special Summoned: add Red Gadget from your Deck.</td></tr>
<tr><td>${cn('Red Gadget')}</td><td>3</td><td>When Normal or Special Summoned: add Yellow Gadget from your Deck.</td></tr>
<tr><td>${cn('Yellow Gadget')}</td><td>3</td><td>When Normal or Special Summoned: add Green Gadget from your Deck.</td></tr>
<tr><td>${cn('Machina Fortress')}</td><td>3</td><td>Discard Machines with Levels adding to 8 or more to summon it from hand or GY.</td></tr>
<tr><td>${cn('Machina Gearframe')}</td><td>3</td><td>When Normal Summoned: add a Machina monster. Equips to a Machine as a shield.</td></tr>
<tr><td>${cn('Machina Peacekeeper')}</td><td>2</td><td>A Union shield. When destroyed and sent to the GY: add a Union monster.</td></tr>
<tr><td>${cn('Solidarity')}</td><td>2</td><td>If your GY has only one original monster Type, your monsters of that Type gain 800 ATK.</td></tr>
<tr><td>${cn('Smashing Ground')}</td><td>3</td><td>Destroys your opponent's face-up monster with the highest DEF.</td></tr>
</tbody></table></div>
<p>The plan is steady pressure. Each Gadget you summon puts the next one in your hand, so you never run out of monsters. Two Gadgets in hand are Level 4 + 4 = 8, enough to discard for Machina Fortress (2500 ATK). Fortress can come back from the GY the same way. When it is destroyed by battle, it destroys a card your opponent controls. Because the GY holds only Machines, Solidarity keeps giving +800 ATK.</p>
<p><b>Against it:</b> the Gadget searches are triggers on a Normal Summon, so ${cn('Pulling the Rug')} negates them and destroys the Gadget. ${cn('Thunder King Rai-Oh')} stops all adding from the Deck except by drawing. Also watch ${cn('Chimeratech Fortress Dragon')}: it can use Machines on <b>either</b> field. With ${cn('Cyber Dragon')}, you can fuse their Machines away.</p>
<h2>Diva Zombie: the Graveyard is a second hand</h2>
<p><a href="#deck-Diva%20Zombie">The Diva Zombie list</a> is <b>Competitive</b>: strong enough to win big events, but seen less often. Its cousin, <a href="#deck-TeleDAD">TeleDAD</a>, shares many of the Zombies.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Copies</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Caius the Shadow Monarch')}</td><td>3</td><td>Tribute Summoned: banish 1 card. 1000 damage if it was a DARK monster.</td></tr>
<tr><td>${cn('Deep Sea Diva')}</td><td>2</td><td>Level 2 Tuner. When Normal Summoned: summon a Level 3 or lower Sea Serpent from the Deck.</td></tr>
<tr><td>${cn('Goblin Zombie')}</td><td>2</td><td>Sent from the field to the GY: add a Zombie with 1200 or less DEF from your Deck.</td></tr>
<tr><td>${cn('Pyramid Turtle')}</td><td>2</td><td>Destroyed by battle: summon a Zombie with 2000 or less DEF from your Deck.</td></tr>
<tr><td>${cn('Book of Life')}</td><td>2</td><td>Revive a Zombie from your GY and banish a monster from your opponent's GY.</td></tr>
<tr><td>${cn('Zombie Master')}</td><td>1</td><td>Send a monster from hand to the GY: revive a Level 4 or lower Zombie from any GY.</td></tr>
<tr><td>${cn('Mezuki')}</td><td>1</td><td>Banish it from your GY to revive a Zombie from your GY.</td></tr>
<tr><td>${cn('Plaguespreader Zombie')}</td><td>1</td><td>Level 2 Tuner. Returns from the GY if you put a card from hand on top of your Deck.</td></tr>
<tr><td>${cn('Dark Armed Dragon')}</td><td>1</td><td>Summoned from the hand by having exactly 3 DARKs in your GY. Banishes DARKs to destroy cards.</td></tr>
</tbody></table></div>
<p>Most of these monsters are DARK, which fills the GY for Dark Armed Dragon. The Zombies keep coming back: Goblin Zombie finds Mezuki, Zombie Master or Plaguespreader, and they revive each other. ${cn('Burial from a Different Dimension')} returns banished monsters, like a used Mezuki, to the GY.</p>
<p>Two Synchros only take ${cn('Plaguespreader Zombie')} as the Tuner, plus non-Tuner Zombies. Plaguespreader (Level 2) and a Level 4 Zombie make Level 6:</p>
<ul><li>${cn('Revived King Ha Des')}: monsters your Zombies destroy by battle have their effects negated, even in the GY.</li><li>${cn('Doomkaiser Dragon')}: when Special Summoned, takes a Zombie from your opponent's GY.</li></ul>
<p>Deep Sea Diva gives a second body. In this list the only Sea Serpent it can summon is the other Diva. Two monsters from one Normal Summon can mean one Tribute for Caius and one Tuner left over.</p>
${call('rule','Remember the recipe',`<p>Two Divas are both Tuners. A Synchro needs exactly one Tuner, so two Divas alone can't Synchro Summon together.</p>`)}
<p><b>Against it:</b> attack the Graveyard. ${cn('D.D. Crow')} banishes a card from the GY at Quick speed. ${cn('Soul Release')} banishes up to 5. ${cn('Shadow-Imprisoning Mirror')} negates DARK monster effects on the field and in the GY. ${cn('Mask of Restrict')} stops Caius's Tribute Summon.</p>
<h2>Dragon Turbo: draw, discard, bring them back</h2>
<p><a href="#deck-Dragon%20Turbo">The Dragon Turbo list</a> is <b>Competitive</b>. A related list, <a href="#deck-Dragon%20Aggro">Dragon Aggro</a>, is Rogue.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Copies</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Red-Eyes Darkness Metal Dragon')}</td><td>3</td><td>Banish a face-up Dragon you control to summon it. Then revive a Dragon from hand or GY.</td></tr>
<tr><td>${cn('Blue-Eyes White Dragon')}</td><td>3</td><td>Level 8, 3000 ATK. Discarded for Trade-In, then brought back.</td></tr>
<tr><td>${cn('The White Stone of Legend')}</td><td>3</td><td>Level 1 Tuner. When sent to the GY: add Blue-Eyes White Dragon from your Deck.</td></tr>
<tr><td>${cn('Debris Dragon')}</td><td>3</td><td>Tuner. Normal Summoned: revive a monster with 500 or less ATK, effects negated.</td></tr>
<tr><td>${cn('Cards of Consonance')}</td><td>3</td><td>Discard a Dragon Tuner with 1000 or less ATK: draw 2.</td></tr>
<tr><td>${cn('Trade-In')}</td><td>3</td><td>Discard a Level 8 monster: draw 2.</td></tr>
<tr><td>${cn('Super Rejuvenation')}</td><td>3</td><td>In the End Phase, draw 1 for each Dragon you discarded or Tributed this turn.</td></tr>
<tr><td>${cn('Upstart Goblin')}</td><td>3</td><td>Draw 1. Your opponent gains 1000 LP.</td></tr>
</tbody></table></div>
<p>The draw spells turn into a full GY. Cards of Consonance discards White Stone, which then adds a Blue-Eyes. Trade-In discards that Blue-Eyes. Super Rejuvenation counts both discards. ${cn('Future Fusion')} (1) can reveal ${cn('Five-Headed Dragon')} and send five Dragons from the Deck to the GY.</p>
<p>Then Red-Eyes Darkness Metal Dragon cashes in. You need a face-up Dragon to banish. Debris Dragon can be that Dragon, or it can revive White Stone (300 ATK) to be it. ${cn('Instant Fusion')} can also make one: ${cn('Darkfire Dragon')} is a Level 4 Dragon Fusion. Once Red-Eyes is out, it revives a Blue-Eyes from the GY. In Edison, you can use several Red-Eyes in one turn.</p>
<p><b>Against it:</b> ${cn("Koa'ki Meiru Drago")} stops LIGHT and DARK Special Summons, which covers Red-Eyes and Blue-Eyes. ${cn('Royal Oppression')} and ${cn('Fossil Dyna Pachycephalo')} stop Special Summons too. ${cn('Thunder King Rai-Oh')} stops White Stone's search. ${cn('D.D. Crow')} can banish a Blue-Eyes before Red-Eyes revives it.</p>
<h2>The three side by side</h2>
<div class="tbl-wrap"><table><thead><tr><th>Deck</th><th>Tier</th><th>Description</th></tr></thead><tbody>
<tr><td>Machina Gadget</td><td>Contender</td><td>Searches keep the hand full. Big Machines and Solidarity win fights.</td></tr>
<tr><td>Diva Zombie</td><td>Competitive</td><td>Uses the GY as a second hand. Zombie Synchros and Caius do the damage.</td></tr>
<tr><td>Dragon Turbo</td><td>Competitive</td><td>Draws hard, fills the GY with Dragons, then revives them.</td></tr>
</tbody></table></div>
${call('key','The pattern',`<p>Find what each engine needs. Gadgets need summon triggers and searches. Zombies need the Graveyard. Dragons need Special Summons. Take that away and the deck slows down.</p>`)}
<div class="recap"><h2>Recap</h2><ul><li>Each Gadget searches the next one. Two Gadgets in hand summon Machina Fortress.</li><li>Diva Zombie revives Zombies over and over and makes Plaguespreader Synchros.</li><li>Dragon Turbo draws by discarding Dragons, then Red-Eyes Darkness Metal Dragon brings them back.</li><li>Answer each deck by cutting off what its engine needs.</li></ul></div>`,
flash:[
["You Normal Summon Green Gadget. What does it add to your hand?","Red Gadget. Red adds Yellow, and Yellow adds Green."],
["How do two Gadgets in hand help summon Machina Fortress?","They are Level 4 + 4 = 8. Fortress is summoned by discarding Machines whose Levels add to 8 or more."],
["Which Tuner do Revived King Ha Des and Doomkaiser Dragon require?","Plaguespreader Zombie, plus one or more non-Tuner Zombies."],
["Why does Dragon Turbo run Cards of Consonance with The White Stone of Legend?","Consonance discards White Stone to draw 2, and White Stone in the GY adds a Blue-Eyes White Dragon."],
["What does Red-Eyes Darkness Metal Dragon need to be Special Summoned from the hand?","You banish 1 face-up Dragon you control."],
["Name a side card that hurts Diva Zombie and say why.","D.D. Crow or Soul Release, because the deck revives monsters from the Graveyard. Shadow-Imprisoning Mirror also works, since most of its monsters are DARK."]
]},

{n:27,title:'Key Interactions',sub:'Which cards beat which, in one place.',min:5,
cards:['Royal Oppression','Starlight Road','Solemn Judgment','Stardust Dragon','Thunder King Rai-Oh','Fossil Dyna Pachycephalo','Book of Moon','Mask of Restrict'],
html:`
<div class="goals"><h4>What you will learn</h4><ul><li>What stops a Synchro Summon, and what doesn't</li><li>How to answer Royal Oppression</li><li>What Starlight Road and Stardust Dragon can stop</li><li>A handful of Edison rulings that decide games</li></ul></div>
<h2>What stops a Synchro Summon</h2>
<p>A Synchro Summon is a Special Summon. So cards that stop Special Summons stop Synchros. Some cards stop the Summon itself. Others only answer the monster once it is out.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Stops it?</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Solemn Judgment')}</td><td>Yes</td><td>Pay half your LP to negate the Summon and destroy the monster.</td></tr>
<tr><td>${cn('Royal Oppression')}</td><td>Yes</td><td>Pay 800 LP to negate a Special Summon and destroy the monster.</td></tr>
<tr><td>${cn('Thunder King Rai-Oh')}</td><td>Yes</td><td>Send it to the GY to negate a Special Summon that doesn't use the Chain.</td></tr>
<tr><td>${cn('Fossil Dyna Pachycephalo')}</td><td>Yes</td><td>While face-up, no one can Special Summon. Flipped face-up, it destroys all Special Summoned monsters.</td></tr>
<tr><td>${cn("Vanity's Fiend")}</td><td>Yes</td><td>While it is on the field, no one can Special Summon.</td></tr>
<tr><td>${cn('Bottomless Trap Hole')}</td><td>After</td><td>Answers the Synchro once it is out, if it has 1500 or more ATK.</td></tr>
<tr><td>${cn('Torrential Tribute')}</td><td>After</td><td>Destroys all monsters after any Summon, the new Synchro included.</td></tr>
<tr><td>${cn('Mask of Restrict')}</td><td>No</td><td>Synchro Materials are sent to the GY, not Tributed. Mask only stops Tributes.</td></tr>
</tbody></table></div>
${call('rule','Edison rulings',`<ul><li>Rai-Oh can negate a Synchro Summon or ${cn('Cyber Dragon')} summoning itself. It can't negate a monster summoned by a card effect, like ${cn('Call of the Haunted')}.</li><li>Solemn Judgment can't negate a monster effect that starts a Chain, such as ${cn('Gorz the Emissary of Darkness')} summoning itself.</li></ul>`)}
${call('mistake','Watch your own cards',`<p>Royal Oppression, Fossil Dyna and Vanity's Fiend stop <b>both</b> players. If you play them, your own Synchros stop too.</p>`)}
<h2>Answering Royal Oppression</h2>
<p>${cn('Royal Oppression')} is a Continuous Trap. Whenever a monster would be Special Summoned, or a card or effect that could Special Summon is activated, <b>either player</b> can pay 800 LP to negate it. Here is how to get past it.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Mystical Space Typhoon')}</td><td>Destroy it. MST is a Quick-Play Spell, so you can use it at the right moment.</td></tr>
<tr><td>${cn('Dust Tornado')}</td><td>Destroy it, then Set a Spell or Trap from your hand.</td></tr>
<tr><td>${cn('Heavy Storm')}</td><td>Destroys it along with every other Spell and Trap.</td></tr>
<tr><td>${cn('Royal Decree')}</td><td>Negates all other Trap effects on the field, Royal Oppression included.</td></tr>
<tr><td>${cn('Trap Stun')}</td><td>Negates all other Trap effects for this turn. Use it, then make your Summons.</td></tr>
<tr><td>${cn('Solemn Judgment')}</td><td>Negate Royal Oppression when it is activated.</td></tr>
<tr><td>${cn('Brionac, Dragon of the Ice Barrier')}</td><td>Returns cards on the field to the hand, if Brionac is already on the field.</td></tr>
</tbody></table></div>
${call('rule','Edison rulings for Royal Oppression',`<ul><li>It can't be used in the Damage Step.</li><li>It can negate cards that <i>could</i> Special Summon, like ${cn('Starlight Road')}.</li><li>It can negate a Gladiator Beast tag out. The monster stays in the Deck.</li></ul>`)}
<h2>Starlight Road and Stardust Dragon</h2>
<p>${cn('Starlight Road')} works only when a card or effect would destroy <b>2 or more</b> cards you control. It negates that effect, destroys the card, then lets you Special Summon ${cn('Stardust Dragon')} from your Extra Deck.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Road stops it?</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Heavy Storm')}</td><td>Yes</td><td>If 2 or more of your Spells and Traps would be destroyed (Storm itself doesn't count).</td></tr>
<tr><td>${cn('Mirror Force')}</td><td>Yes</td><td>If you have 2 or more Attack Position monsters.</td></tr>
<tr><td>${cn('Torrential Tribute')}</td><td>Yes</td><td>If 2 or more of your monsters would be destroyed.</td></tr>
<tr><td>${cn('Black Rose Dragon')}</td><td>Yes</td><td>Its "destroy all cards" effect, if you have 2 or more cards.</td></tr>
<tr><td>${cn('Mystical Space Typhoon')}</td><td>No</td><td>Destroys only 1 card.</td></tr>
<tr><td>${cn('Brionac, Dragon of the Ice Barrier')}</td><td>No</td><td>Returns cards to the hand. It doesn't destroy.</td></tr>
<tr><td>${cn('Caius the Shadow Monarch')}</td><td>No</td><td>Banishes 1 card. It doesn't destroy.</td></tr>
</tbody></table></div>
<p>${cn('Stardust Dragon')} is the other side of the same idea. Tribute it to negate any card or effect that <b>would destroy</b> a card on the field. It doesn't matter how many. But it can't stop cards that bounce, banish or send to the GY without destroying, like Brionac, Caius, ${cn('Dimensional Prison')} or ${cn('Dark End Dragon')}.</p>
${call('rule','Edison rulings',`<ul><li>Road must be chained right to the card that would destroy 2 or more of your cards, and it must be certain they would be destroyed.</li><li>A Stardust Dragon summoned by Road was not Synchro Summoned. If it is later sent to the GY or banished, it can't be summoned again.</li><li>Stardust can only negate effects that would surely destroy a card.</li></ul>`)}
<h2>Quick rulings worth knowing</h2>
<div class="tbl-wrap"><table><thead><tr><th>Cards</th><th>Description</th></tr></thead><tbody>
<tr><td>Book of Moon vs Caius</td><td>Caius targets "1 card on the field," so a Set monster is still banished.</td></tr>
<tr><td>Book of Moon vs Plaguespreader</td><td>Once Set, Plaguespreader is no longer banished when it leaves the field.</td></tr>
<tr><td>Pulling the Rug vs Caius</td><td>Caius triggers on a Normal Summon (a Tribute Summon counts), so Rug can negate it.</td></tr>
<tr><td>Pulling the Rug vs D.D. Crow</td><td>No. Rug only stops effects triggered by a Normal Summon.</td></tr>
<tr><td>D.D. Crow vs Machina Fortress</td><td>Fortress's Summon doesn't use the Chain, so Crow can't respond to it.</td></tr>
<tr><td>Bottomless vs a weaker monster</td><td>If the monster has under 1500 ATK when Bottomless resolves, nothing happens.</td></tr>
<tr><td>Dimensional Prison vs a negated attack</td><td>If the attack is negated or the position changes, the monster isn't banished.</td></tr>
</tbody></table></div>
<p>For the full list, open <a href="#rulings">Rulings</a> and <a href="#errata">Errata</a>. Every card you tap in this lesson also shows its own Edison rulings.</p>
<div class="recap"><h2>Recap</h2><ul><li>Solemn, Royal Oppression, Rai-Oh, Fossil Dyna and Vanity's Fiend stop a Synchro Summon. Mask of Restrict doesn't.</li><li>Destroy Royal Oppression with MST or Dust Tornado, or negate it with Royal Decree or Trap Stun.</li><li>Starlight Road needs 2 or more of your cards to be destroyed.</li><li>Stardust stops destruction, not bouncing or banishing.</li></ul></div>`,
flash:[
["Does Mask of Restrict stop a Synchro Summon?","No. Synchro Materials are sent to the GY, not Tributed."],
["Your opponent controls Royal Oppression. Can you use it to stop their Special Summon?","Yes. Either player can pay 800 LP to use it."],
["Your opponent activates Mystical Space Typhoon on your Spell. Can you chain Starlight Road?","No. Road needs a card that would destroy 2 or more cards you control."],
["Can Stardust Dragon negate Brionac's effect?","No. Brionac returns cards to the hand. Stardust only negates effects that would destroy."],
["Your opponent Sets your monster with Book of Moon in response to Caius. Is it still banished?","Yes. Caius targets 1 card on the field, so a Set monster is still banished."],
["Can Thunder King Rai-Oh negate a monster summoned by Call of the Haunted?","No. Rai-Oh only negates Summons that don't use the Chain, like a Synchro Summon."]
]},

{n:28,title:'Playing Around Traps',sub:'What each trap needs, and how to read and bluff with Set cards.',min:5,
cards:['Mirror Force','Dimensional Prison','Bottomless Trap Hole','Torrential Tribute','Solemn Judgment','Mystical Space Typhoon','Gorz the Emissary of Darkness'],
html:`
<div class="goals"><h4>What you will learn</h4><ul><li>What each common trap needs before it can be used</li><li>How to make plays that a trap can't punish</li><li>How to read your opponent's Set cards</li><li>How to bluff with your own</li></ul></div>
<h2>Every trap has a trigger</h2>
<p>A trap can't be used whenever your opponent wants. Each one needs a certain event to happen first. If you know the event, you can choose not to give it to them.</p>
<p>The "Decks" column counts the 55 lists in our data that run the card in the Main or Side Deck.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Decks</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('Mirror Force')}</td><td>43 of 55</td><td>Needs your attack. Destroys all your Attack Position monsters.</td></tr>
<tr><td>${cn('Solemn Judgment')}</td><td>40 of 55</td><td>Needs a Summon or a Spell/Trap activation. Costs half their LP.</td></tr>
<tr><td>${cn('Bottomless Trap Hole')}</td><td>36 of 55</td><td>Needs you to Summon a monster with 1500 or more ATK. Banishes it.</td></tr>
<tr><td>${cn('Torrential Tribute')}</td><td>36 of 55</td><td>Needs any Summon. Destroys all monsters on the field.</td></tr>
<tr><td>${cn('Dimensional Prison')}</td><td>31 of 55</td><td>Needs your attack. Banishes the attacker.</td></tr>
<tr><td>${cn('Trap Dustshoot')}</td><td>31 of 55</td><td>Needs you to hold 4 or more cards. Shuffles a monster from your hand into the Deck.</td></tr>
<tr><td>${cn('Starlight Road')}</td><td>27 of 55</td><td>Needs a card that would destroy 2 or more of their cards.</td></tr>
<tr><td>${cn('Pulling the Rug')}</td><td>24 of 55</td><td>Needs an effect triggered by a Normal Summon. Negates it and destroys the monster.</td></tr>
<tr><td>${cn('Royal Oppression')}</td><td>21 of 55</td><td>Needs a Special Summon, or a card that could Special Summon.</td></tr>
<tr><td>${cn('Compulsory Evacuation Device')}</td><td>14 of 55</td><td>Needs nothing. Returns any monster to the hand.</td></tr>
</tbody></table></div>
${call('rule','Two rules from earlier lessons',`<ul><li>A Trap can't be activated the turn it is Set. ${cn('Dust Tornado')} lets your opponent Set a card during your turn, but that card can't be used until a later turn.</li><li>Some threats sit in the hand, not on the field. ${cn('Gorz the Emissary of Darkness')} (26 of 55 lists) comes out when its owner takes damage while controlling no cards.</li></ul>`)}
<h2>Making plays a trap can't punish</h2>
<p>You can't play around every trap at once. Pick the one that would hurt most, and give your opponent the worst possible use of it.</p>
<ul>
<li><b>Attack with your least important monster first.</b> Mirror Force and Dimensional Prison both trigger on an attack. Let them hit the monster you care about least.</li>
<li><b>Keep monsters in Defense Position when you won't attack.</b> Mirror Force only destroys Attack Position monsters.</li>
<li><b>Summon a small monster first.</b> A monster under 1500 ATK can't be hit by Bottomless Trap Hole. If they use Torrential Tribute on it, you lose less.</li>
<li><b>Don't overextend.</b> Torrential Tribute destroys every monster. Two strong monsters are often enough. A third one is only more to lose.</li>
<li><b>Remove Set cards one at a time.</b> If your opponent has 2 or more Set cards, ${cn('Heavy Storm')} gives Starlight Road a target. ${cn('Mystical Space Typhoon')} only destroys one card, so Road can't respond.</li>
<li><b>Think before an empty-field attack.</b> If your opponent controls no cards, your damage can bring out Gorz. Make sure you can handle a 2700 ATK monster.</li>
</ul>
${call('key','Remove first, then play',`<p>Spell and Trap removal is everywhere: ${cn('Mystical Space Typhoon')} is in 54 of 55 lists, Heavy Storm in 47, Dust Tornado in 40. Clear a Set card before your big play when you can.</p>`)}
<h2>Reading Set cards</h2>
<p>A Set card isn't a mystery. Your opponent's choices give you clues. These are ways to think, not sure answers.</p>
<ol class="steps">
<li><div><b>Count them.</b> One Set card limits what can go wrong. Three Set cards means several threats, or some bluffs.</div></li>
<li><div><b>Watch what they let through.</b> If a big Summon resolved with no response, Solemn Judgment, Bottomless and Torrential are less likely. They may also be saving one.</div></li>
<li><div><b>Watch what they protected.</b> If they used MST on your card instead of holding it, their own Set card may not be a Quick-Play.</div></li>
<li><div><b>Check the GY and the banlist.</b> Mirror Force, Solemn Judgment and Torrential Tribute are Limited. If one is already in the GY, there are no more.</div></li>
<li><div><b>Test with a cheap play.</b> Attack with a weak monster or Summon a small one. Their answer tells you what they hold.</div></li>
</ol>
<h2>Bluffing</h2>
<p>Your opponent reads your Set cards the same way. You can use that.</p>
<ul>
<li><b>Set cards you can't use yet.</b> A Set card that does nothing can still make your opponent slow down.</li>
<li><b>Set Quick-Plays.</b> ${cn('Book of Moon')} and MST can be Set like Traps. Your opponent can't tell which is which.</li>
<li><b>Act the same every time.</b> If you pause only when you hold a trap, your opponent learns to read the pause.</li>
</ul>
${call('mistake','Common mistake',`<p>Being too scared of Set cards. If you never attack into one, your opponent's bluff wins the game for free. Play around the one trap that would hurt most, then make your play.</p>`)}
<div class="recap"><h2>Recap</h2><ul><li>Each trap needs a trigger: an attack, a Summon, a Special Summon, or 2 or more cards being destroyed.</li><li>Attack with your least important monster first, and summon small before big.</li><li>Use MST, not Heavy Storm, when Starlight Road might be Set.</li><li>Read Set cards by what your opponent did, and Set your own Quick-Plays to bluff.</li></ul></div>`,
flash:[
["Which two common traps need you to attack?","Mirror Force and Dimensional Prison."],
["Why summon a monster with under 1500 ATK first?","Bottomless Trap Hole can't hit it, and if they use Torrential Tribute on it, you lose less."],
["Your opponent has 3 Set cards. Why use MST instead of Heavy Storm?","Heavy Storm would destroy 2 or more of their cards, which lets Starlight Road negate it and summon Stardust Dragon."],
["Your opponent Set a card with Dust Tornado during your turn. Can they use it this turn?","No. A Trap can't be activated the turn it is Set."],
["Your opponent controls no cards. What hand card should you think about before attacking?","Gorz the Emissary of Darkness. It can be Special Summoned when they take damage while controlling no cards."],
["How can you bluff with Book of Moon?","Set it. Your opponent can't tell a Set Quick-Play Spell from a Set Trap."]
]},

{n:29,title:'Side Decking',sub:'What to swap in between games, using the cards real lists side.',min:4,
cards:['D.D. Crow','Cyber Dragon','Dust Tornado','Pulling the Rug','Fossil Dyna Pachycephalo','Royal Oppression','Nobleman of Crossout','Mask of Restrict'],
html:`
<div class="goals"><h4>What you will learn</h4><ul><li>What the Side Deck is for</li><li>The side cards our deck lists use most, and what each one answers</li><li>How to choose what goes in and what comes out</li></ul></div>
<h2>What the Side Deck is for</h2>
<p>A match is several games against the same opponent. After game 1, you know what deck they play. Your Side Deck holds up to 15 cards you can swap into your Main Deck between games. You take a card out for every card you put in.</p>
${call('analogy','Think of it like this',`<p>A football team watches the first half, then changes its plan at halftime. The players on the bench are your Side Deck.</p>`)}
<p>Your Main Deck is built to do well against everything. Your Side Deck holds cards that are great against one deck and weak against the rest.</p>
<h2>The most common side cards</h2>
<p>We counted the Side Decks of all 55 lists in our data. These are the cards most of them run.</p>
<div class="tbl-wrap"><table><thead><tr><th>Card</th><th>Lists</th><th>Description</th></tr></thead><tbody>
<tr><td>${cn('D.D. Crow')}</td><td>34</td><td>Discard it to banish a card from your opponent's GY at Quick speed. Against GY decks.</td></tr>
<tr><td>${cn('Cyber Dragon')}</td><td>34</td><td>Summons itself if only your opponent controls a monster. Also a Machine for Chimeratech.</td></tr>
<tr><td>${cn('Dust Tornado')}</td><td>33</td><td>Destroys a Spell or Trap. Against decks with many Continuous cards and traps.</td></tr>
<tr><td>${cn('Pulling the Rug')}</td><td>24</td><td>Negates an effect triggered by a Normal Summon and destroys the monster.</td></tr>
<tr><td>${cn('Fossil Dyna Pachycephalo')}</td><td>20</td><td>Stops all Special Summons while face-up. Against Synchro and summon-heavy decks.</td></tr>
<tr><td>${cn('Royal Oppression')}</td><td>14</td><td>Pay 800 LP to negate a Special Summon. Against Synchro and summon-heavy decks.</td></tr>
<tr><td>${cn('Nobleman of Crossout')}</td><td>14</td><td>Destroys and banishes a Set monster. Hits Flip monsters and face-down walls.</td></tr>
<tr><td>${cn('Starlight Road')}</td><td>14</td><td>Stops cards that destroy 2 or more of yours, like Heavy Storm or Black Rose.</td></tr>
<tr><td>${cn('Mask of Restrict')}</td><td>14</td><td>No one can Tribute. Against Monarchs and Tribute Summons.</td></tr>
<tr><td>${cn('Lightning Vortex')}</td><td>12</td><td>Discard 1 card to destroy all your opponent's face-up monsters. Against swarms.</td></tr>
<tr><td>${cn('Soul Release')}</td><td>11</td><td>Banish up to 5 cards from any GY. Against GY decks.</td></tr>
<tr><td>${cn('Compulsory Evacuation Device')}</td><td>10</td><td>Returns a monster to the hand. A Synchro goes back to the Extra Deck.</td></tr>
<tr><td>${cn('Mind Crush')}</td><td>10</td><td>Name a card. If it's in their hand, they discard every copy. If not, you discard 1.</td></tr>
</tbody></table></div>
<p>A few more show up against one kind of deck: ${cn('Light-Imprisoning Mirror')} (8 lists) for LIGHT decks like Lightsworn, ${cn('Shadow-Imprisoning Mirror')} (7) for DARK decks, and ${cn('Trap Stun')} (7) against trap-heavy decks.</p>
${call('rule','Card text check',`<p>${cn('Compulsory Evacuation Device')} returns a monster to the hand. A Synchro or Fusion Monster can't go to the hand, so it goes back to the Extra Deck. That is why it is good against Synchro decks.</p>`)}
<h2>Group them by the problem they solve</h2>
<div class="tbl-wrap"><table><thead><tr><th>Problem</th><th>Description</th></tr></thead><tbody>
<tr><td>Graveyard decks</td><td>D.D. Crow, Soul Release. For Zombies, Vayu Turbo and Lightsworn.</td></tr>
<tr><td>Special Summons</td><td>Fossil Dyna, Royal Oppression. For Synchro swarms and Dragons.</td></tr>
<tr><td>Summon triggers</td><td>Pulling the Rug. For Caius, Gadgets and other "when Normal Summoned" effects.</td></tr>
<tr><td>Tributes</td><td>Mask of Restrict. For Monarch decks.</td></tr>
<tr><td>Face-down monsters</td><td>Nobleman of Crossout. For Flip monsters and decks that Set walls.</td></tr>
<tr><td>Spells and Traps</td><td>Dust Tornado, Trap Stun. For trap-heavy and Continuous card decks.</td></tr>
</tbody></table></div>
<h2>How to side, step by step</h2>
<ol class="steps">
<li><div><b>Name their engine.</b> What does their deck need most? The Graveyard, Special Summons, Tributes or searches? Lesson 26 shows how to find it.</div></li>
<li><div><b>Pick your side cards for it.</b> Use the table above. Bring in only cards that hit what their deck needs.</div></li>
<li><div><b>Take out your weakest cards for this matchup.</b> A card that does nothing against them is the first to go. For example, Mask of Restrict is weak against a deck that never Tributes.</div></li>
<li><div><b>Check your own deck still works.</b> Fossil Dyna and Royal Oppression stop your Synchros too. Don't side them in if your own plan needs Special Summons.</div></li>
<li><div><b>Put it back after the match.</b> Return to your main 40 before you face the next opponent.</div></li>
</ol>
${call('key','A real example',`<p>The <a href="#deck-Machina%20Gadget">Machina Gadget</a> Side Deck has 2 ${cn('Rivalry of Warlords')}. It lets each player control only one Type of monster. Every monster in Machina Gadget is a Machine, so it barely hurts them. A deck that mixes Types loses monsters.</p>`)}
${call('mistake','Common mistake',`<p>Siding in too many cards. If you change half your deck, your engine stops working. A few strong swaps beat many small ones.</p>`)}
<p>Two creators made full guides on this. Watch E3 Yu-Gi-Oh's "How To Sideboard in Edison Format" and IMNerd (Frazier Smith)'s "Side Decking 101" in the <a href="#library">Library</a>.</p>
<div class="recap"><h2>Recap</h2><ul><li>Between games, swap Side Deck cards in, one out for each one in.</li><li>D.D. Crow, Cyber Dragon and Dust Tornado are the most common side cards in our lists.</li><li>Side for what their engine needs, and take out what does nothing against them.</li><li>Check that your side cards don't stop your own deck.</li></ul></div>`,
flash:[
["What is the Side Deck for?","Up to 15 cards you can swap into your Main Deck between games of a match, to answer the deck you are facing."],
["Which side card did the most lists in our data run, together with Cyber Dragon?","D.D. Crow, in 34 of the 55 lists."],
["Name two side cards against Graveyard decks.","D.D. Crow and Soul Release."],
["Why be careful siding in Fossil Dyna Pachycephalo?","While it is face-up, neither player can Special Summon, so it stops your own Synchros too."],
["Why is Compulsory Evacuation Device good against Synchro decks?","A Synchro returned to the hand goes back to the Extra Deck instead."],
["Why does Rivalry of Warlords barely hurt Machina Gadget?","Every monster in the deck is a Machine, so they lose nothing when only one Type is allowed."]
]},

{n:30,title:'Choosing Your Deck',sub:'Pick one deck, then learn it until you know every card.',min:3,
cards:['Stardust Dragon','Mystical Space Typhoon','Brionac, Dragon of the Ice Barrier','Black Rose Dragon','Chimeratech Fortress Dragon','Heavy Storm'],
html:`
<div class="goals"><h4>What you will learn</h4><ul><li>What the deck tiers on this site mean</li><li>How to pick a deck that fits you</li><li>A plan to learn one deck well, using the site's tools</li></ul></div>
<h2>The tiers</h2>
<p>The site has 55 deck lists. Each one has a tier.</p>
<div class="tbl-wrap"><table><thead><tr><th>Tier</th><th>Lists</th><th>Description</th></tr></thead><tbody>
<tr><td>Best</td><td>5</td><td>The decks that win and show up the most.</td></tr>
<tr><td>Competitive</td><td>6</td><td>Strong enough to win big events, but seen less often.</td></tr>
<tr><td>Rogue</td><td>10</td><td>Playable and dangerous, but the odds are against them.</td></tr>
<tr><td>Contender</td><td>10</td><td>Seen as playable, with few big finishes so far.</td></tr>
<tr><td>Casual</td><td>24</td><td>Fan favorites and fun decks.</td></tr>
</tbody></table></div>
<p>The top two tiers, and where this course covers them:</p>
<div class="tbl-wrap"><table><thead><tr><th>Deck</th><th>Tier</th><th>Description</th></tr></thead><tbody>
<tr><td><a href="#deck-Blackwing">Blackwing</a></td><td>Best</td><td>A midrange swarm. <a href="#lesson-19">Lesson 19</a>.</td></tr>
<tr><td><a href="#deck-Vayu%20Turbo">Vayu Turbo</a></td><td>Best</td><td>Synchro Summons from the Graveyard. <a href="#lesson-22">Lesson 22</a>.</td></tr>
<tr><td><a href="#deck-Hero%20Frog">Hero Frog</a></td><td>Best</td><td>HEROs with Frogs. <a href="#lesson-23">Lesson 23</a> and <a href="#lesson-24">Lesson 24</a>.</td></tr>
<tr><td><a href="#deck-Junk%20Frog">Junk Frog</a></td><td>Best</td><td>Frogs with Synchros. <a href="#lesson-24">Lesson 24</a>.</td></tr>
<tr><td><a href="#deck-Hybrid">Hybrid</a></td><td>Best</td><td>Open the list to see its cards.</td></tr>
<tr><td><a href="#deck-Lightsworn">Lightsworn</a></td><td>Competitive</td><td>Mills itself for Judgment Dragon. <a href="#lesson-21">Lesson 21</a>.</td></tr>
<tr><td><a href="#deck-Diva%20Hero">Diva Hero</a></td><td>Competitive</td><td>HEROs with Deep Sea Diva. <a href="#lesson-23">Lesson 23</a>.</td></tr>
<tr><td><a href="#deck-Diva%20Hero%20Beat">Diva Hero Beat</a></td><td>Competitive</td><td>A Beat build of Diva Hero. <a href="#lesson-23">Lesson 23</a>.</td></tr>
<tr><td><a href="#deck-Diva%20Zombie">Diva Zombie</a></td><td>Competitive</td><td>Zombies from the Graveyard. <a href="#lesson-26">Lesson 26</a>.</td></tr>
<tr><td><a href="#deck-Dragon%20Turbo">Dragon Turbo</a></td><td>Competitive</td><td>Draws, discards and revives Dragons. <a href="#lesson-26">Lesson 26</a>.</td></tr>
<tr><td><a href="#deck-Machina">Machina</a></td><td>Competitive</td><td>Machina monsters. <a href="#lesson-26">Lesson 26</a> covers the Gadget version.</td></tr>
</tbody></table></div>
${call('key','Tier is not everything',`<p>A Best deck you don't understand loses to a Rogue deck you know by heart. Pick a strong deck, but pick one you want to play many times.</p>`)}
<h2>Pick a deck that fits you</h2>
<p>Lesson 18 sorted decks into styles: aggro, control, combo and stun. Ask yourself a few questions.</p>
<ul>
<li><b>Do you like to win by battle?</b> Look at decks built around attacking, like Gladiator Beasts (Lesson 25).</li>
<li><b>Do you like long turns with many steps?</b> Look at decks with a big engine, like Vayu Turbo or Dragon Turbo.</li>
<li><b>Do you like to answer what your opponent does?</b> Look at control decks with many traps.</li>
<li><b>Do you like to stop the other deck from playing?</b> Look at stun decks with cards like Royal Oppression.</li>
</ul>
<p>Whatever you pick, many cards carry over. ${cn('Stardust Dragon')} is in all 55 lists. ${cn('Mystical Space Typhoon')} is in 54. ${cn('Brionac, Dragon of the Ice Barrier')}, ${cn('Black Rose Dragon')} and ${cn('Chimeratech Fortress Dragon')} are in 49. See them all on <a href="#staples">Staples</a>.</p>
<h2>Learn it well: a plan</h2>
<ol class="steps">
<li><div><b>Read the list.</b> Open it from <a href="#decks">All Decks</a>. Tap each card you don't know and read its Edison text and rulings.</div></li>
<li><div><b>Draw test hands.</b> Press "Test hand" on the deck page. Ask: what is my best first turn with these 6 cards?</div></li>
<li><div><b>Copy it to the builder.</b> Press "Open in Deck Builder" to make your own copy in the <a href="#builder">Deck Builder</a>. Change it only after you know why each card is there.</div></li>
<li><div><b>Practice the combos.</b> Load the deck on the <a href="#simulator">practice board</a> and play out your best turns by hand.</div></li>
<li><div><b>Play games.</b> Play people as much as you can: friends, online, or at locals.</div></li>
<li><div><b>Watch the experts.</b> The <a href="#library">Library</a> has deck guides for Blackwings, Quickdraw, Dragons, Diva Hero, Hero Beat, Vayu Turbo and Frogs.</div></li>
<li><div><b>Learn your side.</b> Know which Side Deck cards come in against each top deck (Lesson 29).</div></li>
</ol>
${call('mistake','Common mistake',`<p>Switching decks after every loss. Each switch starts your learning over. Stay with one deck long enough to know why you lost.</p>`)}
<div class="recap"><h2>Recap</h2><ul><li>The site has 55 lists in five tiers, from Best to Casual.</li><li>Pick a strong deck in a style you enjoy.</li><li>Learn it with test hands, the builder, the board and duels.</li><li>Stay with one deck long enough to really know it.</li></ul></div>`,
flash:[
["How many deck lists are in the Best tier on this site?","5: Blackwing, Vayu Turbo, Hybrid, Hero Frog and Junk Frog."],
["What does the Rogue tier mean?","Playable and dangerous, but the odds are against them."],
["Which card is in every one of the 55 deck lists?","Stardust Dragon."],
["Where do you make your own copy of a deck list?","Press \"Open in Deck Builder\" on the deck page."],
["Why is switching decks after every loss a bad habit?","Each switch starts your learning over, so you never learn one deck well."]
]}

]};
