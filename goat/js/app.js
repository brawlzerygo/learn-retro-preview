/* ============ STORAGE (safe) ============ */
const store={
  get(k,d){try{const v=localStorage.getItem('goat:'+k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem('goat:'+k,JSON.stringify(v))}catch(e){}}
};

/* ============ BANLIST (April 2005 TCG, the Goat list; filled from data/cards.js below) ============ */
const BAN={F:[],L:[],S:[]};
/* ============ CARDS ============
 kind: normal | effect | synchro | fusion | spell | trap | token
 Text is a short plain-English summary of the 2010 card text, not the official wording. */
const C={};
function M(id,name,kind,attr,lv,race,atk,def,text,o={}){C[id]=Object.assign({id,name,kind,attr,lv,race,atk,def,text},o)}
function ST(id,name,kind,sub,text,o={}){C[id]=Object.assign({id,name,kind,sub,text},o)}

// Synchros
M('armory','Armory Arm','synchro','LIGHT',4,'Machine',1800,1200,'1 Tuner + 1 or more non-Tuners. Once per turn, equip it to a monster (or unequip it). The equipped monster gains 1000 ATK. When that monster destroys a monster by battle, your opponent takes damage equal to the destroyed monster\'s ATK.');
M('catastor','Ally of Justice Catastor','synchro','DARK',5,'Machine',2200,1200,'1 Tuner + 1 or more non-Tuners. When it battles a non-DARK monster, destroy that monster at the start of the Damage Step.');
M('android','Magical Android','synchro','LIGHT',5,'Psychic',2400,1700,'1 Tuner + 1 or more non-Tuners. In your End Phase, gain 600 LP for each Psychic monster you control.');
M('junkwarrior','Junk Warrior','synchro','DARK',5,'Warrior',2300,1300,'"Junk Synchron" + 1 or more non-Tuners. When Synchro Summoned, it gains ATK equal to the total ATK of your Level 2 or lower monsters.',{req:'synchron'});
M('goyo','Goyo Guardian','synchro','EARTH',6,'Warrior',2800,2000,'1 Tuner + 1 or more non-Tuners. When it destroys your opponent\'s monster by battle, you can Special Summon that monster to your field in Defense Position. In Edison, any Tuner works as material.');
M('brionac','Brionac, Dragon of the Ice Barrier','synchro','WATER',6,'Sea Serpent',2300,1400,'1 Tuner + 1 or more non-Tuners. Discard any number of cards to return that many cards on the field to the hand. In Edison it has no once-per-turn limit and can hit either side of the field.');
M('drill','Drill Warrior','synchro','EARTH',6,'Warrior',2400,1300,'1 "Synchron" Tuner + 1 or more non-Tuners. Main Phase 1: halve its ATK to attack directly. Main Phase 1: discard 1 card to banish it until your next Standby Phase. When it comes back, add 1 monster from your GY to your hand.',{req:'synchron'});
M('blackrose','Black Rose Dragon','synchro','FIRE',7,'Dragon',2400,1800,'1 Tuner + 1 or more non-Tuners. When it is Synchro Summoned, you can destroy all cards on the field. Once per turn, banish 1 Plant from your GY to switch an opponent\'s Defense Position monster to Attack Position with 0 ATK.');
M('fairy','Ancient Fairy Dragon','synchro','LIGHT',7,'Dragon',2100,3000,'1 Tuner + 1 or more non-Tuners. Once per turn, Special Summon a Level 4 or lower monster from your hand (you skip that Battle Phase). Once per turn, destroy the Field Spells on the field, gain 1000 LP, then you can add a Field Spell from your Deck.');
M('arcanite','Arcanite Magician','synchro','LIGHT',7,'Spellcaster',400,1800,'1 Tuner + 1 or more non-Tuner Spellcasters. When Synchro Summoned, it gets 2 Spell Counters. It gains 1000 ATK per counter. Remove 1 counter to destroy 1 card on the field.',{nonRace:'Spellcaster'});
M('armormaster','Blackwing Armor Master','synchro','DARK',7,'Winged Beast',2500,1500,'1 "Blackwing" Tuner + 1 or more non-Tuners. It cannot be destroyed by battle, and you take no battle damage from its battles. It can put Wedge Counters on monsters it battles, then remove them to make those monsters 0 ATK and DEF.',{req:'blackwing'});
M('stardust','Stardust Dragon','synchro','WIND',8,'Dragon',2500,2000,'1 Tuner + 1 or more non-Tuners. When a card or effect is activated that would destroy a card on the field, you can Tribute this card to negate it and destroy it. If it left the field this way, it can come back in the End Phase.');
M('thought','Thought Ruler Archfiend','synchro','DARK',8,'Psychic',2700,2300,'1 Tuner + 1 or more non-Tuners. When it destroys a monster by battle, gain LP equal to that monster\'s original ATK. When a Trap Card targets 1 Psychic monster you control, you can pay 1000 LP to negate it and destroy it.');
M('colossal','Colossal Fighter','synchro','DARK',8,'Warrior',2800,1000,'1 Tuner + 1 or more non-Tuners. Gains 100 ATK for each Warrior in both Graveyards. When it is destroyed by battle, you can Special Summon 1 Warrior from either Graveyard, including itself.');
M('rda','Red Dragon Archfiend','synchro','DARK',8,'Dragon',3000,2000,'1 Tuner + 1 or more non-Tuners. After it attacks a Defense Position monster, destroy all Defense Position monsters your opponent controls. In your End Phase, destroy your other monsters that did not attack.');
M('mistwurm','Mist Wurm','synchro','WATER',9,'Aqua',2500,1500,'1 Tuner + 2 or more non-Tuners. When it is Synchro Summoned, return up to 3 cards on the field to the hand.',{minNon:2});
M('ctfd','Chimeratech Fortress Dragon','fusion','DARK',8,'Machine',0,0,'"Cyber Dragon" + 1 or more Machines. Summon it by sending those cards from either side of the field to the GY. No Polymerization needed. Its ATK is 1000 for each material used.');
M('azero','Elemental HERO Absolute Zero','fusion','WATER',8,'Warrior',2500,2000,'1 "HERO" monster + 1 WATER monster. Gains 500 ATK for each other WATER monster on the field. When it leaves the field, destroy all monsters your opponent controls.');

// Tuners
M('plague','Plaguespreader Zombie','effect','DARK',2,'Zombie',400,200,'Tuner. If it is in your GY, put 1 card from your hand on top of your Deck to Special Summon it. If summoned this way, it is banished when it leaves the field.',{tuner:true});
M('junk','Junk Synchron','effect','DARK',3,'Warrior',1300,500,'Tuner. When Normal Summoned, Special Summon 1 Level 2 or lower monster from your GY in Defense Position. Its effects are negated.',{tuner:true,synchron:true});
M('quickdraw','Quickdraw Synchron','effect','WIND',5,'Machine',700,1400,'Tuner. Special Summon it from your hand by sending 1 monster from your hand to the GY. It counts as any "Synchron" Tuner, but it can only be used for Synchros that need a "Synchron" Tuner.',{tuner:true,synchron:true,onlySynchron:true});
M('debris','Debris Dragon','effect','WIND',4,'Dragon',1000,2000,'Tuner. When Normal Summoned, Special Summon 1 monster with 500 or less ATK from your GY in Attack Position, effects negated. It can only be material for a Dragon Synchro, and the other materials cannot be Level 4.',{tuner:true,debris:true});
M('gale','Blackwing - Gale the Whirlwind','effect','DARK',3,'Winged Beast',1300,400,'Tuner. Special Summon it from your hand if you control another "Blackwing". Once per turn, halve the ATK and DEF of 1 face-up opponent\'s monster.',{tuner:true,blackwing:true});
M('blizzard','Blackwing - Blizzard the Far North','effect','DARK',2,'Winged Beast',1300,0,'Tuner. When Normal Summoned, Special Summon 1 Level 4 or lower "Blackwing" from your GY.',{tuner:true,blackwing:true});
M('vayu','Blackwing - Vayu the Emblem of Honor','effect','DARK',1,'Winged Beast',800,0,'Tuner. From your GY, banish it plus non-Tuners in your GY to Special Summon a DARK Synchro whose Level equals their total. That Synchro\'s effects are negated. It cannot be Synchro Material any other way.',{tuner:true,blackwing:true,gyOnly:true});
M('diva','Deep Sea Diva','effect','WATER',2,'Sea Serpent',200,400,'Tuner. When Normal Summoned, Special Summon 1 Level 3 or lower Sea Serpent from your Deck.',{tuner:true});
M('krebons','Krebons','effect','DARK',2,'Psychic',1200,400,'Tuner. When it is targeted for an attack, you can pay 800 LP to negate that attack.',{tuner:true});
M('resonator','Dark Resonator','effect','DARK',3,'Fiend',1300,300,'Tuner. Once per turn, it cannot be destroyed by battle.',{tuner:true});
M('flamguard','Flamvell Guard','normal','FIRE',1,'Dragon',100,2000,'Tuner. A Normal Monster with no effect, often used as a big wall that can also become Synchro Material.',{tuner:true});

// Non-Tuners
M('dandylion','Dandylion','effect','WIND',3,'Plant',300,300,'When this card is sent to the GY, Special Summon 2 Fluff Tokens (Plant, WIND, Level 1, 0/0) in Defense Position. They cannot be Tributed for a Tribute Summon the turn they are summoned.');
M('lonefire','Lonefire Blossom','effect','FIRE',3,'Plant',500,1400,'Once per turn, Tribute 1 face-up Plant to Special Summon 1 Plant from your Deck.');
M('sangan','Sangan','effect','DARK',3,'Fiend',1000,600,'When this card is sent from the field to the GY, add 1 monster with 1500 or less ATK from your Deck to your hand.');
M('morphing','Morphing Jar','effect','EARTH',2,'Rock',700,600,'FLIP: Both players discard their hands, then draw 5 cards.');
M('cyberdragon','Cyber Dragon','effect','LIGHT',5,'Machine',2100,1600,'If your opponent controls a monster and you control none, you can Special Summon this card from your hand.');
M('caius','Caius the Shadow Monarch','effect','DARK',6,'Fiend',2400,1000,'When Tribute Summoned, banish 1 card on the field. If it was a DARK monster, deal 1000 damage to its controller.');
M('gorz','Gorz the Emissary of Darkness','effect','DARK',7,'Fiend',2700,2500,'When you take damage from an opponent\'s attack or effect while you control no cards, Special Summon it from your hand. Then gain LP or summon a token, depending on the damage type.');
M('tragoedia','Tragoedia','effect','DARK',10,'Fiend','?','?','When you take battle damage, Special Summon it from your hand. Its ATK and DEF are 600 for each card in your hand. It can steal monsters and change its Level.');
M('ryko','Ryko, Lightsworn Hunter','effect','LIGHT',2,'Beast',200,100,'FLIP: You can destroy 1 card on the field. Then send the top 3 cards of your Deck to the GY.');
M('hamster','Super-Nimble Mega Hamster','effect','EARTH',3,'Beast',1100,1800,'FLIP: Special Summon 1 Level 3 or lower monster from your Deck in face-down Defense Position.');
M('gardna','Necro Gardna','effect','DARK',3,'Warrior',600,1300,'During your opponent\'s turn, banish this card from your GY to negate 1 attack.');
M('honest','Honest','effect','LIGHT',4,'Fairy',1100,1900,'During the Damage Step, when your LIGHT monster battles, send this card from your hand to the GY. Your monster gains ATK equal to the opponent monster\'s ATK.');
M('marshmallon','Marshmallon','effect','LIGHT',3,'Fairy',300,500,'Cannot be destroyed by battle. When it is attacked face-down, the attacker takes 1000 damage.');
M('raioh','Thunder King Rai-Oh','effect','LIGHT',4,'Thunder',1900,800,'Neither player can add cards from the Deck to the hand except by drawing. Send it to the GY to negate an opponent\'s Special Summon.');
M('trooper','Card Trooper','effect','EARTH',3,'Machine',400,400,'Once per turn, send up to 3 cards from the top of your Deck to the GY. It gains 500 ATK for each. When it is destroyed, draw 1 card.');
M('ddcrow','D.D. Crow','effect','DARK',1,'Winged Beast',100,100,'Discard this card to banish 1 card from your opponent\'s GY. You can use it on either player\'s turn.');
M('treeborn','Treeborn Frog','effect','WATER',1,'Aqua',100,100,'In your Standby Phase, if it is in your GY and you control no Spells or Traps, Special Summon it. In Edison there is no once-per-turn limit.');
M('breaker','Breaker the Magical Warrior','effect','DARK',4,'Spellcaster',1600,1000,'When Normal Summoned, it gets 1 Spell Counter (+300 ATK). Remove the counter to destroy 1 Spell or Trap.');
M('dad','Dark Armed Dragon','effect','DARK',7,'Dragon',2800,1000,'Special Summon it from your hand if exactly 3 DARK monsters are in your GY. Banish 1 DARK monster from your GY to destroy 1 card on the field.');
M('sorcerer','Chaos Sorcerer','effect','DARK',6,'Spellcaster',2300,2000,'Special Summon it by banishing 1 LIGHT and 1 DARK monster from your GY. Once per turn, banish 1 face-up monster. If you do, it cannot attack that turn.');
M('jd','Judgment Dragon','effect','LIGHT',8,'Dragon',3000,2600,'Special Summon it from your hand if 4 or more different "Lightsworn" monsters are in your GY. Pay 1000 LP to destroy all other cards on the field. In your End Phase, send the top 4 cards of your Deck to the GY.');
M('lumina','Lumina, Lightsworn Summoner','effect','LIGHT',3,'Spellcaster',1000,1000,'Once per turn, discard 1 card to Special Summon 1 "Lightsworn" monster from your GY. In your End Phase, send the top 3 cards of your Deck to the GY.');
M('green','Green Gadget','effect','EARTH',4,'Machine',1400,600,'When Normal or Special Summoned, add 1 "Red Gadget" from your Deck to your hand.');
M('red','Red Gadget','effect','EARTH',4,'Machine',1300,1500,'When Normal or Special Summoned, add 1 "Yellow Gadget" from your Deck to your hand.');
M('yellow','Yellow Gadget','effect','EARTH',4,'Machine',1200,1200,'When Normal or Special Summoned, add 1 "Green Gadget" from your Deck to your hand.');
M('kalut','Blackwing - Kalut the Moon Shadow','effect','DARK',3,'Winged Beast',1400,1000,'During the Damage Step, send it from your hand to the GY. 1 "Blackwing" you control gains 1400 ATK.');
M('shura','Blackwing - Shura the Blue Flame','effect','DARK',4,'Winged Beast',1800,1200,'When it destroys a monster by battle, you can Special Summon 1 "Blackwing" with 1500 or less ATK from your Deck.');
M('bora','Blackwing - Bora the Spear','effect','DARK',4,'Winged Beast',1700,800,'Special Summon it from your hand if you control another "Blackwing". It deals piercing battle damage.');
M('mezuki','Mezuki','effect','EARTH',4,'Zombie',1700,800,'Banish this card from your GY to Special Summon 1 Zombie from your GY.');
M('zmaster','Zombie Master','effect','DARK',4,'Zombie',1800,0,'Once per turn, discard 1 monster to Special Summon 1 Level 4 or lower Zombie from either GY.');
M('stratos','Elemental HERO Stratos','effect','WIND',4,'Warrior',1800,300,'When Normal or Special Summoned, either destroy Spells/Traps (1 per HERO you control) or add 1 "HERO" from your Deck to your hand.');
M('malicious','Destiny HERO - Malicious','effect','DARK',6,'Warrior',800,800,'Banish this card from your GY to Special Summon 1 "Destiny HERO - Malicious" from your Deck.');
M('doomcaliber','Doomcaliber Knight','effect','DARK',4,'Fiend',1900,1800,'When a monster effect is activated, Tribute this card to negate it and destroy that monster.');
M('rescuecat','Rescue Cat','effect','EARTH',4,'Beast',300,100,'Send this face-up card to the GY to Special Summon 2 Level 3 or lower Beasts from your Deck. They are destroyed in the End Phase.');
M('tytannial','Tytannial, Princess of Camellias','effect','WIND',8,'Plant',2800,2600,'Tribute 1 face-up Plant to negate a card effect that targets a face-up card, and destroy that card.');
M('ladd','Light and Darkness Dragon','effect','LIGHT',8,'Dragon',2800,2400,'Negates the activation of the first Spell, Trap, or effect each chain, and loses 500 ATK/DEF each time. When destroyed, it wipes your side and revives a monster from your GY.');
M('redmd','Red-Eyes Darkness Metal Dragon','effect','DARK',10,'Dragon',2800,2400,'Special Summon it from your hand by banishing 1 face-up Dragon you control. Once per turn, Special Summon 1 Dragon from your hand or GY.');
M('reaper','Spirit Reaper','effect','DARK',3,'Zombie',300,200,'Cannot be destroyed by battle. Destroyed when targeted by an effect. When it deals battle damage, your opponent discards 1 random card.');
M('assailant','Night Assailant','effect','DARK',3,'Fiend',200,500,'FLIP: Destroy 1 monster your opponent controls. When sent from hand to GY, add 1 Flip monster from your GY to your hand.');
M('nimble','Gravekeeper\'s Spy','effect','DARK',4,'Spellcaster',1200,2000,'FLIP: Special Summon 1 "Gravekeeper\'s" monster with 1500 or less ATK from your Deck.');
M('bestiari','Gladiator Beast Bestiari','effect','WIND',4,'Winged Beast',1500,800,'When Special Summoned by a "Gladiator Beast" effect, destroy 1 Spell or Trap.');

// Classic cards used in Step 0
M('warwolf','Gene-Warped Warwolf','normal','EARTH',4,'Beast-Warrior',2000,100,'A Normal Monster with no effect. A plain Level 4 beater: no Tribute needed, and a high ATK for its Level.');
M('dmagician','Dark Magician','normal','DARK',7,'Spellcaster',2500,2100,'A Normal Monster with no effect. Level 7, so it needs 2 Tributes to Normal Summon.');
ST('axe','Axe of Despair','spell','Equip','The equipped monster gains 1000 ATK. When this card is sent from the field to the GY, you can Tribute 1 monster to put it on top of your Deck.');

// Tokens
M('fluff','Fluff Token','token','WIND',1,'Plant',0,0,'A token from Dandylion. It cannot be Tributed for a Tribute Summon the turn it is summoned. It CAN be Synchro Material.');
M('sheep','Sheep Token','token','EARTH',1,'Beast',0,0,'A token from Scapegoat. It cannot be Tributed for a Tribute Summon. It CAN be Synchro Material.');

// Spells
ST('avarice','Pot of Avarice','spell','Normal','Shuffle 5 monsters from your GY into your Deck (Synchros go to the Extra Deck), then draw 2 cards.');
ST('moon','Book of Moon','spell','Quick-Play','Change 1 face-up monster to face-down Defense Position.');
ST('smashing','Smashing Ground','spell','Normal','Destroy the face-up monster your opponent controls with the highest DEF.');
ST('storm','Heavy Storm','spell','Normal','Destroy all Spell and Trap Cards on the field.');
ST('mst','Mystical Space Typhoon','spell','Quick-Play','Destroy 1 Spell or Trap Card on the field.');
ST('trunade','Giant Trunade','spell','Normal','Return all Spell and Trap Cards on the field to their owners\' hands.');
ST('brain','Brain Control','spell','Normal','Pay 800 LP. Take control of 1 face-up monster your opponent controls until the End Phase.');
ST('mindcontrol','Mind Control','spell','Normal','Take control of 1 opponent\'s monster until the End Phase. It cannot attack or be Tributed, but it CAN be Synchro Material.');
ST('goldsarc','Gold Sarcophagus','spell','Normal','Banish 1 card from your Deck face-up. During your second Standby Phase after this, add it to your hand.');
ST('scapegoat','Scapegoat','spell','Quick-Play','Special Summon 4 Sheep Tokens (Beast, EARTH, Level 1, 0/0) in Defense Position. They cannot be Tributed for a Tribute Summon. You cannot summon other monsters the turn you activate it.');
ST('nobleman','Nobleman of Crossout','spell','Normal','Destroy and banish 1 face-down monster. If it was a Flip monster, each player banishes all copies of it from their Deck.');
ST('charge','Charge of the Light Brigade','spell','Normal','Send the top 3 cards of your Deck to the GY, then add 1 Level 4 or lower "Lightsworn" monster from your Deck to your hand.');
ST('foolish','Foolish Burial','spell','Normal','Send 1 monster from your Deck to the GY.');
ST('whirlwind','Black Whirlwind','spell','Continuous','When you Normal Summon a "Blackwing", add 1 "Blackwing" with lower ATK from your Deck to your hand.');
ST('coldwave','Cold Wave','spell','Normal','Until your next turn, neither player can play or Set Spells or Traps. Activate only at the start of Main Phase 1.');
ST('vortex','Lightning Vortex','spell','Normal','Discard 1 card. Destroy all face-up monsters your opponent controls.');
ST('reincarnation','Monster Reincarnation','spell','Normal','Discard 1 card. Add 1 monster from your GY to your hand.');
// Traps
ST('bottomless','Bottomless Trap Hole','trap','Normal','When your opponent summons a monster with 1500 or more ATK, destroy it and banish it.');
ST('prison','Dimensional Prison','trap','Normal','When an opponent\'s monster declares an attack, banish that monster.');
ST('starlight','Starlight Road','trap','Normal','When a card or effect would destroy 2 or more cards you control, negate it and destroy it. Then you can Special Summon "Stardust Dragon" from your Extra Deck.');
ST('judgment','Solemn Judgment','trap','Counter','Pay half your LP. Negate a summon, or a Spell or Trap activation, and destroy that card.');
ST('horn','Horn of Heaven','trap','Counter','Tribute 1 monster. Negate a summon and destroy that monster.');
ST('torrential','Torrential Tribute','trap','Normal','When a monster is summoned, destroy all monsters on the field.');
ST('mirror','Mirror Force','trap','Normal','When an opponent\'s monster attacks, destroy all Attack Position monsters your opponent controls.');
ST('oppression','Royal Oppression','trap','Continuous','Either player can pay 800 LP to negate a Special Summon and destroy that monster.');
ST('decree','Royal Decree','trap','Continuous','Negate the effects of all other Trap Cards on the field.');
ST('call','Call of the Haunted','trap','Continuous','Special Summon 1 monster from your GY in Attack Position. A Synchro must have been properly Synchro Summoned first.');
ST('dustshoot','Trap Dustshoot','trap','Normal','Use only if your opponent has 4 or more cards in hand. Look at their hand and shuffle 1 monster from it into their Deck.');
ST('ced','Compulsory Evacuation Device','trap','Normal','Return 1 monster on the field to the hand. Synchros go back to the Extra Deck.');
ST('icarus','Icarus Attack','trap','Normal','Tribute 1 Winged Beast to destroy 2 cards on the field.');
ST('consecrated','Consecrated Light','trap','Continuous','Neither player can summon DARK monsters, and DARK monsters cannot attack.');
ST('darkbribe','Dark Bribe','trap','Counter','Negate a Spell or Trap activation and destroy it. Your opponent draws 1 card.');
ST('skilldrain','Skill Drain','trap','Continuous','Pay 1000 LP. Negate the effects of all face-up monsters on the field.');

/* ============ REAL CARD DATA ============
 window.GOAT_CARDS comes from data/cards.js (build/build_data.py). One record per Edison-legal card:
 id, n (name), k (normal|effect|ritual|fusion|synchro|spell|trap), sub (Spell/Trap kind), a (Attribute), r (Type),
 lv, atk, def, ab (abilities, e.g. "Effect Tuner"), tu (Tuner), b (F|L|S), tx (printed text, modern wording),
 ps (Edison-accurate text), ru (Edison rulings), rb (general rulings). */
const DB=window.GOAT_CARDS||[];
for(const r of DB)if(r.b)BAN[r.b].push(r.n);
const BYID=new Map(DB.map(r=>[r.id,r]));
const BYNAME=new Map(DB.map(r=>[r.n,r]));
const LOCALIMG=new Set(window.GOAT_LOCALIMG||[]);
// All art is served from our own img/ folder (build/build_data.py --all-images). A card with no art shows an empty frame.
// ART_V is part of every image address. Raise it when art changes: browsers that cached a missing image
// (requested while the art was still uploading) then fetch a fresh copy instead of showing a blank.
const ART_V=2;
const artURL=r=>`img/${r.id}.webp?v=${ART_V}`;
const isMonR=r=>r.k!=='spell'&&r.k!=='trap';
const isExtraR=r=>r.k==='synchro'||r.k==='fusion';
const LIMIT={F:0,L:1,S:2};
const copiesAllowed=r=>r.b?LIMIT[r.b]:3;
/* Tokens aren't cards in the edisonformat.net list, so they get records here (not in DB, so card search and decks
 never list them). Their art is the official token card art from YGOPRODeck, saved in img/ like the rest; Sheep
 and Fluff Tokens come in several arts, and each token on the field takes one of them (tokenArt). */
const TOKEN_CARDS=[
  {id:73915052,n:'Sheep Token',a:'EARTH',r:'Beast',lv:1,atk:'0',def:'0',arts:[73915052,73915053,73915054,73915055],ps:'Made by Scapegoat: a Level 1 EARTH Beast with 0 ATK and 0 DEF. It can\'t be Tributed for a Tribute Summon, but it can be Synchro Material.'},
  {id:15341822,n:'Fluff Token',a:'WIND',r:'Plant',lv:1,atk:'0',def:'0',arts:[15341822,15341823],ps:'Made by Dandylion: a Level 1 WIND Plant with 0 ATK and 0 DEF. It can\'t be Tributed for a Tribute Summon the turn it appears, but it can be Synchro Material.'},
  {id:44330099,n:'Emissary of Darkness Token',a:'LIGHT',r:'Fairy',lv:7,atk:'?',def:'?',arts:[44330099],ps:'Made by Gorz the Emissary of Darkness: a Level 7 LIGHT Fairy whose ATK and DEF equal the battle damage you took.'}
];
for(const t of TOKEN_CARDS){const rec=Object.assign({k:'token',ab:'Token',tx:t.ps},t);BYID.set(t.id,rec);BYNAME.set(t.n,rec)}
const tokenArt=(x,cd)=>{const r=cd&&cd.rid&&BYID.get(cd.rid);return r&&r.arts&&x&&x.u!=null?r.arts[x.u%r.arts.length]:cd&&cd.rid};
// Link each lesson card to its real card, and take the banlist from the data when it loaded.
// The data sometimes adds a label in brackets ("Axe of Despair (Archfiend)"), so fall back to that form.
for(const k in C){const nm=C[k].name;const r=BYNAME.get(nm)||DB.find(x=>x.n.startsWith(nm+' ('));if(r)C[k].rid=r.id}
if(DB.length){for(const k of ['F','L','S'])BAN[k]=DB.filter(r=>r.b===k).map(r=>r.n).sort((a,b)=>a.localeCompare(b))}
function statLine(r){
  if(!isMonR(r))return `${r.k==='spell'?'Spell':'Trap'} · ${r.sub}`;
  const kind=r.k==='normal'?'Normal':r.k==='effect'?'Effect':r.k[0].toUpperCase()+r.k.slice(1);
  const extra=[r.tu?'Tuner':'',/Flip/.test(r.ab||'')?'Flip':'',/Gemini|Union|Spirit|Toon/.exec(r.ab||'')?.[0]||''].filter(Boolean);
  return `${r.r} / ${[kind,...extra].join(' / ')} · ${r.a} · Level ${r.lv} · ${r.atk} ATK / ${r.def} DEF`;
}
const shortLine=r=>isMonR(r)?`${r.a} · Lv ${r.lv} · ${r.atk}/${r.def}`:`${r.k==='spell'?'Spell':'Trap'} · ${r.sub}`;
const thumb=(r,extra='',cnt=0)=>`<button type="button" class="cthumb" data-rid="${r.id}" ${extra} aria-label="${esc(r.n)}"><img loading="lazy" src="${artURL(r)}" alt="">${r.b?`<span class="badge b-${r.b}">${r.b}</span>`:''}${cnt>1?`<span class="cnt">×${cnt}</span>`:''}${esc(r.n)}</button>`;

/* ============ Visual helpers ============ */
const FRAME={ritual:['#5a7cc4','#fff'],normal:['#c9a24a','#2a1f05'],effect:['#c8672a','#fff'],synchro:['#e3e7ee','#1b2030'],fusion:['#7a4aa0','#fff'],spell:['#138a74','#fff'],trap:['#a83b72','#fff'],token:['#7d8596','#fff']};
const ATTR={DARK:'linear-gradient(135deg,#2b1c45,#5b3c86)',LIGHT:'linear-gradient(135deg,#e9c454,#f7e6a3)',FIRE:'linear-gradient(135deg,#b6311f,#ee7a3c)',WATER:'linear-gradient(135deg,#1f57a6,#4fa0e4)',WIND:'linear-gradient(135deg,#21794a,#62c189)',EARTH:'linear-gradient(135deg,#6b4c2a,#b08a56)',SPELL:'linear-gradient(135deg,#0d6b5a,#2fb59a)',TRAP:'linear-gradient(135deg,#7f2455,#d0609c)'};
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
function initials(n){const w=n.replace(/["']/g,'').replace(/^(Blackwing - |Elemental HERO |Destiny HERO - )/,'').split(/[\s,-]+/).filter(Boolean);return (w[0]?.[0]||'')+(w[1]?.[0]||'')}
function typeLine(c){
  if(c.kind==='spell')return 'Spell · '+c.sub;
  if(c.kind==='trap')return 'Trap · '+c.sub;
  const parts=[c.race];
  if(c.kind==='synchro')parts.push('Synchro');
  if(c.kind==='fusion')parts.push('Fusion');
  if(c.kind==='token')parts.push('Token');
  if(c.tuner)parts.push('Tuner');
  return parts.join(' / ');
}
function tile(c,cls='',extra=''){
  if(!c)return '';
  // A real card shows as its card image only; tokens and custom cards keep the drawn tile.
  if(c.rid&&BYID.has(c.rid)){const r=BYID.get(c.rid);return `<button type="button" class="ctile pic ${cls}" data-card="${c.id}" ${extra} aria-label="${esc(r.n)}" style="background-image:url('${artURL(r)}')"></button>`}
  const [fr,ink]=FRAME[c.kind]||FRAME.effect;
  const isST=c.kind==='spell'||c.kind==='trap';
  const at=isST?(c.kind==='spell'?ATTR.SPELL:ATTR.TRAP):(ATTR[c.attr]||ATTR.EARTH);
  const stars=!isST&&c.lv?'<i></i>'.repeat(Math.min(c.lv,12)):'';
  const stats=isST?'&nbsp;':`ATK ${c.atk} · DEF ${c.def}`;
  const b=banStatus(c.name);
  return `<button type="button" class="ctile ${cls}" style="--fr:${fr};--frink:${ink};--attr:${at}" data-card="${c.id}" ${extra} aria-label="${esc(c.name)}">
    <span class="nm">${esc(c.name)}${b?` <span class="badge b-${b}">${b}</span>`:''}</span>
    ${c.rid&&BYID.has(c.rid)?`<span class="art img" style="background-image:url('${artURL(BYID.get(c.rid))}')"></span>`:`<span class="art"><em>${esc(initials(c.name))}</em></span>`}
    <span class="lv">${stars}</span>
    <span class="ty">${esc(typeLine(c))}</span>
    <span class="st">${stats}</span></button>`;
}
const c=id=>`<button type="button" class="cref" data-card="${id}">${esc(C[id].name)}</button>`;
// A tile inside another button (a board zone) must not be a button itself, or the browser splits them apart.
const tileSpan=cd=>tile(cd).replace(/^<button/,'<span').replace(/<\/button>$/,'</span>');
const tiles=ids=>`<div class="tiles">${ids.map(i=>tile(C[i])).join('')}</div>`;
function eq(ids,res,math){return `<div class="eq">${ids.map((i,n)=>(n?'<span class="op">+</span>':'')+tile(C[i],'sm')).join('')}<span class="op">=</span>${tile(C[res],'sm')}<div class="math">${math}</div></div>`}
const call=(type,tag,html)=>`<div class="call ${type}"><b class="tag">${tag}</b>${html}</div>`;
const dbLink=n=>`https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&sess=1&rp=10&keyword=${encodeURIComponent(n)}&request_locale=en`;

/* ============ LESSONS ============
 Step 0, Goat 101 and Goat 201 live in data/lessons-step0.js, lessons-101.js and lessons-201.js. Each file sets a function
 that gets the lesson helpers and returns its lessons: {n, title, sub, min, cards:[card names], html, flash:[[question, answer]]}.
 cn('Card Name') links any real card by its exact name; call(type, tag, html) makes a callout. */
function cn(name,label){const r=BYNAME.get(name);if(!r){console.warn('Lesson card not found:',name);return esc(label||name)}return `<button type="button" class="cref" data-rid="${r.id}">${esc(label||name)}</button>`}
function nameTile(name){if(C[name])return tile(C[name]);const r=BYNAME.get(name);if(!r){console.warn('Lesson card not found:',name);return ''}
  return `<button type="button" class="ctile pic" data-rid="${r.id}" aria-label="${esc(r.n)}" style="background-image:url('${artURL(r)}')"></button>`}
const lessonHelpers={cn,call,esc};
const B=(window.GOAT_STEP0||(()=>[]))(lessonHelpers);
const L=(window.GOAT_LESSONS_101||(()=>[]))(lessonHelpers);
const L2=((window.GOAT_LESSONS_201||(()=>[]))(lessonHelpers)).map(l=>Object.assign({lv:'201'},l));
const L3=[];
const levelOf=l=>typeof l.n==='string'?'0':L2.includes(l)?'201':'101';
const ALL=[...B,...L,...L2,...L3];
const lessonLabel=l=>typeof l.n==='string'?`Step ${l.n}`:`${TW().lesson} ${l.n}`;

const LOCKED=[
[5,'101','The Staples','The cards almost every Goat deck plays'],
[6,'101','The Power Monsters','Black Luster Soldier - Envoy, Chaos Sorcerer, Breaker and Thousand-Eyes Restrict'],
[7,'101','Your First Goat Game','A full game, played turn by turn'],
[8,'201','Rules That Trip People Up','Priority, triggers on a chain, the Damage Step, and the June 2005 flip rule'],
[9,'201','Card Advantage','Trading one for one, and how to get ahead'],
[10,'201','Goat Control','The deck the format is named after'],
[11,'201','Chaos Turbo and Chaos Control','Flip monsters, discards and Chaos Sorcerer'],
[12,'201','Warriors and the Aggro Decks','Hit hard and early'],
[13,'201','Burn, Empty Jar and Lockdown','Winning without fighting'],
[14,'201','Side Decking and Picking Your Deck','Changing your deck between games, and choosing one to learn']
];

const TERMS=[
['Life Points (LP)','The score you defend. Both players begin at 8000, and the first to hit 0 loses.'],
['Main Deck','The 40 or more cards you shuffle and draw from.'],
['Fusion Deck','The 2005 name for the Extra Deck. It holds Fusion monsters, which you summon instead of drawing.'],
['Side Deck','Up to 15 spare cards you may swap with Main or Fusion Deck cards between the games of a match.'],
['Normal Summon','Playing one monster from your hand face-up in Attack Position. You get one Normal Summon or Set each turn.'],
['Set','Putting a card face-down. A Set monster sits in Defense Position. A Set Trap has to wait a turn before you can use it.'],
['Tribute','Sending your own monster to the Graveyard to pay for a bigger one: one for Level 5 or 6, two for Level 7 or more.'],
['Flip Summon','Turning your face-down monster face-up into Attack Position on a later turn.'],
['Flip effect','A monster effect that happens when the card is turned face-up, by a Flip Summon, an attack or a card.'],
['Special Summon','Any summon a card lets you make. You can do as many as your cards allow.'],
['Fusion Summon','Using a card like Polymerization to send the listed monsters to the Graveyard and bring out a Fusion monster.'],
['Graveyard (GY)','Your face-up discard pile. Anyone can look through it, and many cards use what is in it.'],
['Remove from play','The 2005 wording for banish: the card goes to a pile outside the Graveyard and rarely comes back.'],
['Chain','Cards and effects played in reply to one another. The last one added resolves first.'],
['Spell Speed','How fast a card or effect is, from 1 to 3. You can only reply with Speed 2 or more, and never with a slower card.'],
['Quick-Play Spell','A Spell you can use on either turn once it is Set, or from your hand on your own turn. Book of Moon and Scapegoat are two.'],
['Cost','What you give up to use a card, like a discard or Life Points. You do not get it back if the card is stopped.'],
['Target','To point an effect at one card. Effects that hit a whole group do not target.'],
['Negate','To cancel a card or effect so it does nothing.'],
['Turn player','The player whose turn it is.'],
['Priority','In 2005 rules, the turn player gets the first chance to act after a summon or a chain finishes.'],
['Damage Step','The moment an attack actually hits. Very few cards can be used during it.'],
['Card advantage','Having more useful cards than your opponent, between your hand and your field.'],
['Plus one (+1)','A play that leaves you one card ahead of where you were, like Sangan replacing itself when it leaves the field.'],
['One-for-one','A trade where each player loses one card.'],
['Backrow','The Spells and Traps you have Set face-down.'],
['Sheep Token','A 0 ATK, 0 DEF monster made by Scapegoat. Four come out at once.'],
['Token','A monster created by a card effect. It has no real card and disappears when it leaves the field.'],
['Floater','A monster that brings out another monster or card when it leaves the field.'],
['Mill','Sending cards from the top of a Deck to the Graveyard.'],
['Control','A deck style that answers everything the opponent plays and wins slowly with more cards.'],
['Aggro','A deck style that attacks early and often to end the game before the opponent sets up.'],
['Lockdown','A deck style that stops the opponent from attacking or playing, then wins another way.']
];

/* ============ THEMES ============
 Two looks (themes/*.css). The structure and content never change; a theme swaps styles and a few words. */
const THEMES=['index'];
const THEME_WORDS={
  index:{lesson:'Lesson',sep:' / ',done:'Read'}
};
const curTheme=()=>THEMES.includes(document.documentElement.dataset.theme)?document.documentElement.dataset.theme:'index';
const TW=()=>THEME_WORDS[curTheme()];
function setTheme(t){
  if(!THEMES.includes(t))return;
  document.documentElement.dataset.theme=t;store.set('theme',t);markThemePick();
  const y=window.scrollY;route();window.scrollTo(0,y);
}
function markThemePick(){document.querySelectorAll('[data-theme-pick]').forEach(b=>{const on=b.dataset.themePick===curTheme();b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)})}
document.querySelectorAll('[data-theme-pick]').forEach(b=>b.onclick=()=>setTheme(b.dataset.themePick));
markThemePick();
// Course progress, drawn the way each theme would show it.
function progressHTML(done,total){
  const t=curTheme();
  const ranks=[[0,'New Duelist'],[1,'Rookie'],[3,'Duelist'],[6,'Expert Duelist'],[total,'Format Master']];
  const rank=ranks.filter(r=>done>=r[0]).pop()[1];
  return `<div class="rank"><span>Rank:</span><span class="rbadge">${rank}</span><span class="pips">${Array.from({length:total},(_,i)=>`<i class="${i<done?'on':''}"></i>`).join('')}</span><span>${done} of ${total} lessons read</span></div>`;
}

/* ============ ROUTER ============ */
const app=document.getElementById('app');
const done=()=>store.get('done',[]);
function setDone(n,v){let d=done().filter(x=>x!==n);if(v)d.push(n);store.set('done',d)}
/* ============ CLEAN URLS (Zack, 2026-11-22: "remove the hashes so we get proper seo") ============
 Every page has a real address (edison.learnretro.com/lessons/3-reading-card-text/, /cards/black-rose-dragon/), and
 build/prerender.mjs writes each one as its own HTML file at publish, so search engines index every page. Inside the
 app a page is still named by its old key ('lesson-3', 'card-73580471', 'deck-Name'); keyToPath and pathToKey convert.
 Old #links (#lesson-3) are rewritten to the new address on load, so every link shared before still works. */
const SITE='https://learnretro.com';
/* The site lives in a folder of learnretro.com (Zack, 2026-11-23: one domain for every format). BASE comes from
 <base href>, so the same code runs at /goat/ on the live site, the preview and the local server. */
const BASE=(document.querySelector('base')?.getAttribute('href')||'/').replace(/\/$/,'');
const slugify=x=>String(x).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
let URLMAPS=null;
function urlMaps(){
  if(URLMAPS)return URLMAPS;
  const M={card:new Map(),cardBack:new Map(),lesson:new Map(),lessonBack:new Map(),deck:new Map(),deckBack:new Map()};
  DB.forEach(r=>{if(r.k==='token')return;let x=slugify(r.n)||String(r.id);if(M.cardBack.has(x))x+='-'+r.id;M.card.set(r.id,x);M.cardBack.set(x,r.id)});
  ALL.forEach(l=>{const x=String(l.n).replace('.','-')+'-'+slugify(l.title);M.lesson.set(String(l.n),x);M.lessonBack.set(x,String(l.n))});
  (window.GOAT_DECKS||[]).forEach(d=>{const x=slugify(d.name);M.deck.set(d.name,x);M.deckBack.set(x,d.name)});
  return URLMAPS=M;
}
const PAGEKEYS=['home','course','flashcards','glossary','rules','simulator','cards','decks','builder','opponents','staples','library','banlist','rulings','errata','duel'];
function isRouteKey(k){return PAGEKEYS.includes(k)||/^(lesson|deck|opponents|rules|card)-./.test(k)}
function keyToPath(k){
  const M=urlMaps();
  if(!k||k==='home')return BASE+'/';
  return BASE+keyPath(k,M);
}
function keyPath(k,M){
  if(k.startsWith('lesson-'))return `/lessons/${M.lesson.get(k.slice(7))||k.slice(7)}/`;
  if(k.startsWith('deck-')){const n=decodeURIComponent(k.slice(5));return `/decks/${M.deck.get(n)||slugify(n)}/`}
  if(k.startsWith('card-'))return `/cards/${M.card.get(+k.slice(5))||k.slice(5)}/`;
  if(k.startsWith('opponents-'))return `/opponents/${k.slice(10)}/`;
  if(k.startsWith('rules-'))return `/rules/${k.slice(6)}/`;
  return `/${k}/`;
}
function pathToKey(p){
  const M=urlMaps();if(BASE){if(p===BASE)p='/';else if(p.startsWith(BASE+'/'))p=p.slice(BASE.length);else return null}
  const seg=decodeURI(p).replace(/index\.html$/,'').split('/').filter(x=>x&&x!=='.');
  if(!seg.length)return 'home';
  const [a,b]=seg;
  if(seg.length===1)return isRouteKey(a)?a:null;
  if(a==='lessons')return 'lesson-'+(M.lessonBack.get(b)||b.replace(/^(\d+)-(\d+)-.*$/,'$1.$2').replace(/^(\d+)-.*$/,'$1'));
  if(a==='decks'){const n=M.deckBack.get(b);return n?'deck-'+encodeURIComponent(n):'decks'}
  if(a==='cards'){const id=M.cardBack.get(b)||(/^\d+$/.test(b)&&BYID.has(+b)?+b:null);return id?'card-'+id:'cards'}
  if(a==='opponents')return 'opponents-'+b;
  if(a==='rules')return 'rules-'+b;
  return null;
}
// build/prerender.mjs sets __KEY to render a page without touching the address (Chrome throttles history updates).
function curKey(){return window.__KEY||pathToKey(location.pathname)||'home'}
function go(k,replace){const p=keyToPath(k);if(location.pathname!==p||location.hash)history[replace?'replaceState':'pushState'](null,'',p);route()}
/* Links in the pages still say href="#key"; linkify turns them into real addresses (what search engines follow). */
function linkify(root){root.querySelectorAll('a[href^="#"]').forEach(a=>{const k=a.getAttribute('href').slice(1);if(isRouteKey(k)){a.dataset.k=k;a.setAttribute('href',keyToPath(k))}})}
document.addEventListener('click',e=>{
  if(e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  const a=e.target.closest('a[href]');if(!a||a.target==='_blank'||a.hasAttribute('download')||a.closest('[data-rid],[data-card]'))return;
  const h=a.getAttribute('href');let k=null;
  if(h.startsWith('#')){k=h.slice(1);if(!isRouteKey(k))return}
  else{const u=new URL(a.href,location.href);if(u.origin!==location.origin)return;k=pathToKey(u.pathname);if(!k)return}
  e.preventDefault();go(k);
});
window.addEventListener('popstate',route);
// An old link (#lesson-3) or a 404 fallback lands here: move it to its real address first.
(function(){const k=location.hash.slice(1);if(k&&isRouteKey(decodeURIComponent(k)))history.replaceState(null,'',keyToPath(decodeURIComponent(k)))})();
/* Each page gets its own title, description and canonical address, which the pre-render bakes into the HTML. */
function setMeta(title,desc,key){
  document.title=title;
  const m=document.querySelector('meta[name="description"]');if(m)m.setAttribute('content',desc);
  const c=document.querySelector('link[rel="canonical"]');if(c)c.setAttribute('href',SITE+keyToPath(key));
}
const PAGEMETA={home:['Learn Goat Format: Yu-Gi-Oh! as It Was in 2005','A free course for Goat format Yu-Gi-Oh!: lessons from your first summon to tournament decks, every Goat-legal card, deck lists and the April 2005 banlist.'],
  course:['The Goat Format Course: Step 0, 101 and 201','Every lesson in order: the Yu-Gi-Oh! basics, the 2005 rules and cards, the staples, how to think and the top decks of Goat format.'],
  flashcards:['Goat Format Flashcards','Every quiz question from the Goat course, to drill until it sticks.'],
  glossary:['Goat Format Glossary','Every Yu-Gi-Oh! term used in Goat format, explained in plain words.'],
  rules:['Goat Format Rules: How a Duel Works in 2005','The 2005 Yu-Gi-Oh! rules in plain words: deck building, the turn, summoning, battle, the Damage Step and chains.'],
  simulator:['Goat Practice Board','Set up any field and try plays with real Goat format cards.'],
  cards:['Goat Format Card Search: All Legal Cards','Search every Goat-legal Yu-Gi-Oh! card with its text and banlist status.'],
  decks:['Goat Format Deck Lists','Goat format deck lists, from the top decks to the most played.'],
  builder:['Goat Format Deck Builder','Build a Goat deck, check it against the April 2005 banlist and export it.'],
  opponents:['Know Your Opponent: Goat Format Matchups','Every Goat deck at a glance: how to spot it, what it wants and how to beat it, plus the matchup chart.'],
  staples:['Goat Format Staples','The cards most Goat decks play.'],
  library:['Goat Format Video Library','Goat format guides and deck videos from other creators.'],
  banlist:['The Goat Format Banlist (April 2005)','Every Forbidden, Limited and Semi-Limited card on the April 2005 Yu-Gi-Oh! banlist used in Goat format.'],
  rulings:['Goat Format Rulings','Goat rulings card by card.'],
  errata:['Goat Format Errata','Cards whose 2005 text works differently from today.'],
  duel:['Duel the Computer','Coming later.']};
function pageMeta(h){
  const T=' | Learn Retro';
  if(h.startsWith('lesson-')){const l=ALL.find(x=>String(x.n)===h.slice(7));if(l)return setMeta(`${lessonLabel(l)}: ${l.title}${T}`,l.sub||PAGEMETA.course[1],h)}
  if(h.startsWith('card-')){const r=BYID.get(+h.slice(5));if(r){const ban=r.b?{F:'Forbidden',L:'Limited',S:'Semi-Limited'}[r.b]:'Unlimited';const tx=(r.ps||r.tx||'').replace(/[①②③④⑤ⓈⒸ©●]/g,'').replace(/\s+/g,' ').trim();
    return setMeta(`${r.n}: Goat Format Card Text and Banlist${T}`,`${r.n} in Goat format (2005): ${ban}. ${tx}`.slice(0,155),h)}}
  if(h.startsWith('deck-')){const n=decodeURIComponent(h.slice(5));return setMeta(`${n} Deck List: Goat Format${T}`,`The ${n} deck list for Goat format Yu-Gi-Oh! (2005): Main, Fusion and Side Deck.`,h)}
  if(h.startsWith('opponents-')){const d=(OPP.decks||[]).find(x=>x.id===h.slice(10));if(d)return setMeta(`How to Beat ${d.name} in Goat Format${T}`,`${d.name} at a glance: how to spot it, what it wants, its strengths and weaknesses, and how to beat it.`,h)}
  if(h.startsWith('rules-')){const R=window.GOAT_RULES;const x=R&&R.sections.find(y=>y.id===h.slice(6));if(x)return setMeta(`${x.title}: Goat Format Rules${T}`,PAGEMETA.rules[1],h)}
  const m=PAGEMETA[h]||PAGEMETA.home;setMeta(h==='home'?m[0]+T:m[0]+T,m[1],PAGEMETA[h]?h:'home');
}
function route(){
  closeModal();
  const h=curKey();
  document.querySelectorAll('#nav > a').forEach(a=>a.classList.toggle('on',h===a.dataset.v));
  document.querySelectorAll('.ndrop-btn').forEach(b=>b.classList.toggle('on',b.dataset.group.split(' ').some(t=>h.startsWith(t))));
  document.querySelectorAll('.ndrop-menu a,.mnav a').forEach(a=>a.classList.toggle('on',(a.dataset.k||(a.getAttribute('href').startsWith('#')?a.getAttribute('href').slice(1):pathToKey(new URL(a.href).pathname)))===h));closeMenus();
  if(h.startsWith('lesson-')){renderLesson(h.slice(7))}
  else if(h==='flashcards')renderFlash();
  else if(h==='glossary')renderGloss();
  else if(h==='rules'||h.startsWith('rules-')){renderRules(h.slice(6));fitTables(app);linkify(document);pageMeta(h);return}
  else if(h==='simulator')renderSim();
  else if(h==='cards')renderSearch();
  else if(h==='decks')renderDecks();
  else if(h.startsWith('deck-'))renderDeck(decodeURIComponent(h.slice(5)));
  else if(h.startsWith('card-'))renderCardPage(h.slice(5));
  else if(h==='builder')renderBuilder();
  else if(h==='opponents'||h.startsWith('opponents-'))renderOpponents(h.slice(10));
  else if(h==='staples')renderStaples();
  else if(h==='library')renderLibrary();
  else if(h==='banlist')renderBanlist();
  else if(h==='rulings')renderRulings();
  else if(h==='errata')renderErrata();
  else if(h==='course')renderCourse();
  else if(h==='duel'){if(DUEL_READY())renderDuel();else renderDuelSoon()}
  else renderHome();
  fitTables(app);
  linkify(document);pageMeta(h);
  window.scrollTo(0,0);
}
/* Tables read in one line per row: a column whose cells are all short (a label, a size, a level) never wraps,
 so only the longer explaining column (usually "Description") breaks onto a second line. */
function fitTables(root){
  root.querySelectorAll('table').forEach(t=>{
    const rows=[...t.rows];if(!rows.length)return;const cols=Math.max(...rows.map(r=>r.cells.length));
    for(let c=0;c<cols;c++){const cells=rows.map(r=>r.cells[c]).filter(Boolean);
      const head=(rows[0].cells[c]?.textContent||'').trim();
      const short=cells.every(x=>x.textContent.trim().length<=24)||(head==='Card'&&cells.every(x=>x.textContent.trim().length<=40));cells.forEach(x=>x.classList.toggle('nw',short))}
  })
}

/* ============ HOME ============
 The front door: what Goat is, where to start, and one card per section that mirrors the nav menus. */
// Card of the day: a famous Goat card, changing daily (Goat has no ruling data yet, so it shows the card text).
const COD_POOL=['Scapegoat','Metamorphosis','Thousand-Eyes Restrict','Black Luster Soldier - Envoy of the Beginning','Chaos Sorcerer','Breaker the Magical Warrior','Sangan','Magician of Faith','Tsukuyomi','Airknight Parshath','Jinzo','Tribe-Infecting Virus','Book of Moon','Delinquent Duo','Graceful Charity','Pot of Greed','Mirror Force','Ring of Destruction','Torrential Tribute','Sakuretsu Armor','Thunder Dragon','Gravekeeper\'s Spy','Mystic Tomato','Spirit Reaper','Night Assailant','Exiled Force','D.D. Warrior Lady','Asura Priest','Abyss Soldier','Snatch Steal'];
function renderHome(){
  const d=done();const d101=L.filter(l=>d.includes(l.n)).length;const started=ALL.some(l=>d.includes(l.n));
  const next=(d101?L.find(l=>!d.includes(l.n)):ALL.find(l=>!d.includes(l.n)))||L[0]||B[0];
  const art=n=>{const r=BYNAME.get(n);return r?`style="background-image:url('${artURL(r)}')"`:''};
  const pool=COD_POOL.map(n=>BYNAME.get(n)).filter(Boolean);
  const cod=pool.length?pool[Math.floor(Date.now()/864e5)%pool.length]:null;
  const sec=(title,blurb,cover,links)=>`<section class="hsec"><div class="hcover" ${art(cover)}></div><div class="hbody"><h3>${title}</h3><p>${blurb}</p><div class="hlinks">${links.map(([h,t])=>`<a href="#${h}">${t} →</a>`).join('')}</div></div></section>`;
  app.innerHTML=`
  <section class="hhero">
    <div>
      <h1>Learn Goat format, from your first summon to a tournament deck.</h1>
      <p>Goat is Yu-Gi-Oh! as it was in the summer of 2005: the April 2005 banlist, a fixed card pool, and slow, thoughtful games where every card counts. This site teaches it step by step, with real cards, the banlist and the top decks.</p>
      <div class="hero-btns">${started&&next?`<a class="btn primary" href="#lesson-${next.n}">Continue: ${lessonLabel(next)}, ${esc(next.title)} →</a>`:`<a class="btn primary" href="#course">Start learning →</a>`}<a class="btn" href="#simulator">Practice board</a></div>
      <form class="hsearch" id="hsearch" role="search"><input type="search" id="hq" placeholder="Look up any card, like Scapegoat" aria-label="Search cards"><button class="btn" type="submit">Search</button></form>
    </div>
    ${cod?`<aside class="hcod"><h4>Card of the day</h4><img src="${artURL(cod)}" alt="" data-rid="${cod.id}"><b><button type="button" class="cref" data-rid="${cod.id}">${esc(cod.n)}</button></b><p>${esc((cod.tx||'').slice(0,180))}${(cod.tx||'').length>180?'…':''}</p></aside>`:''}
  </section>
  <h2 class="hh">Where to start</h2>
  <div class="hpath">
    <a href="#lesson-0.1"><span class="hnum">1</span><b>Never played?</b><span>Step 0 walks you through the whole game in seven parts, ending with a practice turn played step by step.</span></a>
    <a href="#lesson-1"><span class="hnum">2</span><b>Played before?</b><span>Goat 101 covers the 2005 rules, old card wording, the banlist, the staples and a full first game.</span></a>
    <a href="#decks"><span class="hnum">3</span><b>Want a deck?</b><span>Browse the deck lists, open one in the builder, and lay it out on the practice board.</span></a>
  </div>
  <h2 class="hh">Everything on the site</h2>
  <div class="hgrid">
    ${sec('Learn','Bite-size lessons in plain words, a quiz to close each one, flashcards, a glossary and the 2005 rules.','Scapegoat',[['course','Course'],['flashcards','Flashcards'],['rules','Rules'],['glossary','Glossary']])}
    ${sec('Cards','Every Goat-legal card with its text and art, and the April 2005 banlist.','Thousand-Eyes Restrict',[['cards','Card search'],['banlist','Banlist']])}
    ${sec('Decks','The top Goat decks and the most played ones, and a builder that checks your list.','Black Luster Soldier - Envoy of the Beginning',[['decks','All Decks'],['builder','Deck builder']])}
    ${sec('Play','Lay out any field on the practice board and try your plays.','Chaos Sorcerer',[['simulator','Practice board']])}
  </div>
  ${DB.length?`<p class="sitestats"><span><b>${DB.length.toLocaleString()}</b> cards</span><span><b>${DECKS.length}</b> decks</span><span>Banlist: <b>April 2005</b></span><span>Progress: <b>${d101} of ${L.length}</b> Goat 101 lessons</span></p>`:''}
  ${srcNote()}`;
  document.getElementById('hsearch').onsubmit=e=>{e.preventDefault();Object.assign(SS,blankFilter(),{q:document.getElementById('hq').value.trim()});store.set('search',SS);PAGE=1;go('cards')};
}

/* ============ COURSE ============ */
function renderCourse(){
  const d=done();const d101=L.filter(l=>d.includes(l.n)).length;
  const started=ALL.some(l=>d.includes(l.n));
  const next=(d101?L.find(l=>!d.includes(l.n)):ALL.find(l=>!d.includes(l.n)))||L[0]||B[0];
  const heroBtns=started&&next
    ?`<a class="btn primary" href="#lesson-${next.n}">Continue: ${lessonLabel(next)}, ${next.title} →</a>${typeof next.n==='string'?`<a class="btn" href="#lesson-1">Skip to Goat 101</a>`:''}`
    :`<a class="btn primary" href="#lesson-0.1">Never played? Start with Step 0 →</a><a class="btn" href="#lesson-1">I know the game: start Goat 101</a>`;
  const lcard=l=>`<a class="lcard ${d.includes(l.n)?'done':''}" href="#lesson-${l.n}"><span class="lnum ${typeof l.n==='string'?'wide':''}">${d.includes(l.n)?'✓':l.n}</span><span><h3>${l.title}</h3><p>${l.sub}</p><span class="pill">${l.min} min · ${l.flash.length} flashcards</span></span></a>`;
  const lock=x=>`<div class="lcard locked"><span class="lnum">${x[0]}</span><span><h3>${x[2]}</h3><p>${x[3]}</p><span class="pill">Coming soon</span></span></div>`;
  const total=L.length+L2.length+LOCKED.filter(x=>!L2.some(l=>l.n===x[0])).length;
  app.innerHTML=`
  <section class="hero">
    <h1>Learn Goat format, one step at a time.</h1>
    <p>A course on Yu-Gi-Oh! as it was played in 2005. Brand new, or back after years away? Step 0 teaches the game from the ground up. Already know how to play? Jump to Goat 101. Short lessons, plain words, flashcards and a practice board.</p>
    ${progressHTML(d101,L.length)}
    <div class="hero-btns">${heroBtns}</div>
  </section>
  <section class="level-block"><div class="level-head"><span class="level-tag zero">Step 0</span><h2>How to play Yu-Gi-Oh!</h2><p>The whole game from scratch: the goal, the cards, the turn, summoning, battle, Spells and Traps, then a practice turn. Know it already? <a href="#lesson-1">Skip to Goat 101</a>.</p></div>
  <div class="lessons">${B.map(lcard).join('')}</div></section>
  <section class="level-block"><div class="level-head"><span class="level-tag">101</span><h2>What makes Goat, Goat?</h2><p>The 2005 rules, old card wording, the card pool and banlist, the staples, the big monsters, and a first game played turn by turn.</p></div>
  <div class="lessons">${[...L.map(lcard),...LOCKED.filter(x=>x[1]==='101'&&!L.some(l=>l.n===x[0])).map(lock)].join('')}</div></section>
  <section class="level-block"><div class="level-head"><span class="level-tag">201</span><h2>How do I win?</h2><p>The tricky rules, card advantage, the top decks and how to side deck.</p></div>
  <div class="lessons">${[...L2.map(lcard),...LOCKED.filter(x=>x[1]==='201'&&!L2.some(l=>l.n===x[0])).map(lock)].join('')}</div></section>
  ${DB.length?`<p class="sitestats"><span><b>${DB.length.toLocaleString()}</b> cards</span><span><b>${DECKS.length}</b> decks</span><span>Banlist: <b>April 2005</b></span></p>`:''}`;
}

/* ============ LESSON ============ */
/* ============ KNOW YOUR OPPONENT ============
 data/opponents.js: one at-a-glance block per deck family from Goat 201 (lessons 10 to 13), and a matchup chart (Zack, 2026-11-22, for Edison;
 Goat's added 2026-11-23, Zack: "and what about deck matchups for goat?"; in Edison's words
 "seeing what deck their opponent is playing, and instantly knowing what to do"). The blocks sit in each deck lesson
 and on #opponents with the chart. A chart cell is read from the cards, not from tournament results. */
const OPP=window.GOAT_OPPONENTS||{decks:[],pairs:[]};
const OPPBY=Object.fromEntries(OPP.decks.map(d=>[d.id,d]));
const oppText=t=>esc(t).replace(/\[\[(.+?)\]\]/g,(m,n)=>cn(n.replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&')));
/* the edge of deck a against deck b: 1 favored, 0 even, -1 unfavored, with the reason */
function oppEdge(a,b){const p=OPP.pairs.find(x=>(x[0]===a&&x[1]===b)||(x[0]===b&&x[1]===a));if(!p)return null;
  const e=p[2]==='even'?0:(p[2]==='a')===(p[0]===a)?1:-1;return{e,why:p[3]}}
function glanceHTML(d){
  const li=a=>`<ul>${a.map(x=>`<li>${oppText(x)}</li>`).join('')}</ul>`;
  const others=OPP.decks.filter(o=>o.id!==d.id).map(o=>({o,...oppEdge(d.id,o.id)}));
  const names=e=>others.filter(x=>x.e===e).map(x=>`<a href="#opponents-${x.o.id}">${esc(x.o.name)}</a>`).join(', ')||'none';
  return `<section class="glance" data-deck="${d.id}"><h2>At a glance: ${esc(d.name)}</h2>
    <p class="gsub"><b>${esc(d.style)}</b> · Lists: ${d.lists.map(n=>`<a href="#deck-${encodeURIComponent(n)}">${esc(n)}</a>`).join(', ')} · <a href="#lesson-${d.lesson}">Lesson ${d.lesson}</a></p>
    <div class="ggrid">
      <div><h4>How to spot it</h4><p>${oppText(d.spot)}</p></div>
      <div><h4>What it wants</h4><p>${oppText(d.wants)}</p></div>
      <div class="g-strong"><h4>Strengths</h4>${li(d.strong)}</div>
      <div class="g-weak"><h4>Weaknesses</h4>${li(d.weak)}</div>
      <div><h4>What to expect</h4>${li(d.expect)}</div>
      <div class="g-beat"><h4>How to beat it</h4>${li(d.beat)}</div>
      <div class="g-avoid"><h4>Don't</h4>${li(d.avoid)}</div>
    </div>
    <div class="gmatch"><div><b>Good against:</b> ${names(1)}</div><div><b>Even with:</b> ${names(0)}</div><div><b>Tough against:</b> ${names(-1)}</div>
      <div class="note">Why each one: <a href="#opponents-${d.id}">the matchup chart</a>.</div></div>
  </section>`;
}
/* deck lessons: each deck's block goes under the section named after it, or at the top of the lesson */
function addGlances(main,n){
  const ds=OPP.decks.filter(d=>d.lesson===n);
  // one deck: its block opens the lesson; several (lesson 26): each goes under its own section
  ds.slice().reverse().forEach(d=>{
    const box=document.createElement('div');box.innerHTML=glanceHTML(d);const g=box.firstElementChild;
    const key=d.name.replace(/s$/,'').toLowerCase();
    const h=ds.length>1&&[...main.querySelectorAll('h2')].find(x=>x.textContent.toLowerCase().startsWith(key));
    if(h)h.after(g);else main.prepend(g);
  });
}
/* #opponents: a gallery of deck tiles (each deck's signature card art); picking one expands its at-a-glance block and
 its matchups in three plain columns (favored, even, unfavored), each with the reason. The full chart sits below,
 folded, for comparing every deck at once. Zack, 2026-11-22: "more visually sensible with card/deck arts... the
 matchup chart... can be easier to read". */
/* chart column headers: each deck's short name from data/opponents.js (`short`), else its full name */
const OPPSHORT=Object.fromEntries(OPP.decks.map(d=>[d.id,d.short||d.name]));
const MATCHWORD={1:'Favored','0':'Even','-1':'Unfavored'};
/* the artwork window of a full card image, as a CSS background (cards here are whole-card images) */
const oppArt=d=>{const r=BYNAME.get(d.art);return r?`style="background-image:url('${artURL(r)}')"`:''};
function oppRecord(id){const r={1:0,0:0,'-1':0};OPP.decks.forEach(o=>{if(o.id!==id)r[oppEdge(id,o.id).e]++});return r}
function renderOpponents(sel){
  if(!OPP.decks.length){app.innerHTML=noData();return}
  const d=OPPBY[sel];
  const tile=o=>{const r=oppRecord(o.id);return `<a class="otile ${d&&o.id===d.id?'on':''}" href="#opponents-${o.id}" aria-current="${d&&o.id===d.id?'true':'false'}">
    <span class="oart" ${oppArt(o)}></span>
    <span class="oname">${esc(o.name)}</span><span class="ostyle">${esc(o.style)}</span>
    <span class="orec" aria-label="${r[1]} favored, ${r[0]} even, ${r[-1]} unfavored"><i class="fav">${r[1]} fav</i><i class="even">${r[0]} even</i><i class="unf">${r[-1]} unfav</i></span></a>`};
  let panel='';
  if(d){
    const rows=e=>OPP.decks.filter(o=>o.id!==d.id).map(o=>({o,...oppEdge(d.id,o.id)})).filter(x=>x.e===e);
    const col=(e,cls,title,blurb)=>{const xs=rows(e);return `<section class="mcol ${cls}"><h3><span class="mdot"></span>${title} <small>${xs.length}</small></h3><p class="mblurb">${blurb}</p>
      ${xs.length?xs.map(x=>`<a class="mrow" href="#opponents-${x.o.id}"><span class="mthumb" ${oppArt(x.o)}></span><span><b>${esc(x.o.name)}</b><span class="mwhy2">${esc(x.why)}</span></span></a>`).join(''):'<p class="note">None.</p>'}</section>`};
    panel=`<div class="opanel" id="opanel">
      <div class="ohead"><span class="ohart" ${oppArt(d)}></span><div><p class="crumbs" style="margin:0">Know your opponent</p><h2>${esc(d.name)}</h2><p class="note" style="margin:0">${esc(d.style)} · taught in <a href="#lesson-${d.lesson}">Lesson ${d.lesson}</a></p></div><a class="btn oclose" href="#opponents" aria-label="Close">✕</a></div>
      ${glanceHTML(d).replace(/<div class="gmatch">[\s\S]*?<\/div>\s*<\/div>\s*<\/section>$/,'</section>').replace(/<h2>At a glance: [^<]*<\/h2>/,'')}
      <h2 class="mtitle">How ${esc(d.name)} match up</h2>
      <div class="mcols">
        ${col(1,'fav','Favored against','This deck usually has the edge.')}
        ${col(0,'even','Even with','Either side can win: it comes down to the draw and the play.')}
        ${col(-1,'unf','Unfavored against',`The other deck usually has the edge. Side for it.`)}
      </div></div>`;
  }
  const chart=`<div class="mchart-wrap"><table class="mchart2" aria-label="All matchups: each row's deck against each column's deck">
    <thead><tr><th class="corner">Row deck vs. column deck</th>${OPP.decks.map(o=>`<th scope="col"><span class="mthumb sm" ${oppArt(o)}></span>${esc(OPPSHORT[o.id])}</th>`).join('')}</tr></thead>
    <tbody>${OPP.decks.map(r=>`<tr class="${d&&r.id===d.id?'on':''}"><th scope="row"><a href="#opponents-${r.id}"><span class="mthumb sm" ${oppArt(r)}></span>${esc(r.name)}</a></th>${OPP.decks.map(c=>{if(r.id===c.id)return '<td class="self"><span>·</span></td>';
      const x=oppEdge(r.id,c.id),k=x.e===1?'fav':x.e===-1?'unf':'even';
      return `<td class="${k}"><button type="button" class="mcell" data-r="${r.id}" data-c="${c.id}" aria-label="${esc(r.name)} against ${esc(c.name)}: ${MATCHWORD[x.e]}. Show why">${MATCHWORD[x.e]}</button></td>`}).join('')}</tr>`).join('')}</tbody></table></div>`;
  app.innerHTML=`<div class="pagehead"><div><h1>Know your opponent</h1><p class="note" style="margin:4px 0 0;max-width:780px">Sit down, see what your opponent is playing, and know what to do. Pick their deck: how to spot it, what it's good at, what it's weak to, how to beat it, and how it matches up against every other deck.</p></div></div>
    <div class="ogrid" role="list">${OPP.decks.map(o=>`<div role="listitem">${tile(o)}</div>`).join('')}</div>
    <p class="note okey">Each deck shows how many matchups it's favored in, even in and unfavored in. Pick one to see them.</p>
    ${panel}
    <details class="mall" ${d?'':'open'}><summary>All matchups at once</summary>
      <p class="note" style="max-width:780px">Read across a row. Green means the row's deck is favored against the column's deck, red means it's unfavored, grey is even. Click any square to see why.</p>
      ${chart}
      <div class="mlist"><label class="mlpick">Show matchups for <select id="mlsel">${OPP.decks.map(o=>`<option value="${o.id}" ${(d?o.id===d.id:o===OPP.decks[0])?'selected':''}>${esc(o.name)}</option>`).join('')}</select></label><div id="mlrows"></div></div></details>
    <p class="note" style="margin-top:16px;max-width:780px">Where a goatformat.com or YGOPRODeck article gives a verdict, the chart follows it, tagged like [S1]. A matchup without a tag is our call from the cards and the deck lists on this site: which deck's common and side cards hit the other deck's engine. A good player on the weaker side still wins plenty of games. Card advantage: <a href="#lesson-9">Lesson 9</a>. What to side in: <a href="#lesson-14">Lesson 14</a>.</p>
    ${(OPP.sources||[]).length?`<p class="srcnote" style="max-width:780px">Sources: ${OPP.sources.map(([k,t,u])=>`[${k}] <a href="${u}" target="_blank" rel="noopener">${esc(t)}</a>`).join('; ')}.</p>`:''}`;
  oppPopover();oppList();
  if(d)setTimeout(()=>{const p=document.getElementById('opanel');if(p)window.scrollTo({top:p.getBoundingClientRect().top+window.scrollY-72,behavior:'auto'})},30);
}

/* On phones the full chart is a list (Zack, 2026-11-23: the chart "looks broken and doesn't work on mobile"): pick a
 deck, and every matchup shows with its verdict and the reason, no tapping needed. CSS swaps it in under 701 px. */
function oppList(){
  const sel=document.getElementById('mlsel'),box=document.getElementById('mlrows');if(!sel||!box)return;
  const draw=()=>{const id=sel.value,me=OPPBY[id];
    const xs=OPP.decks.filter(o=>o.id!==id).map(o=>({o,...oppEdge(id,o.id)})).sort((a,b)=>b.e-a.e);
    box.innerHTML=xs.map(x=>{const k=x.e===1?'fav':x.e===-1?'unf':'even';
      return `<a class="mlrow ${k}" href="#opponents-${x.o.id}"><span class="mthumb" ${oppArt(x.o)}></span><span class="mlbody"><span class="mlhead"><b>vs ${esc(x.o.name)}</b><i>${MATCHWORD[x.e]}</i></span><span class="mwhy2">${esc(x.why)}</span></span></a>`}).join('')};
  sel.onchange=draw;draw();
}

/* The explainer card on the full chart: click or tap a square to see both decks, the verdict and the reason (click
 only, no hover: Zack, 2026-11-22). It stays until another click elsewhere, Escape, or a scroll. */
function oppPopover(){
  let pop=document.getElementById('mpop');
  if(!pop){pop=document.createElement('div');pop.id='mpop';pop.setAttribute('role','dialog');pop.hidden=true;document.body.appendChild(pop);
    document.addEventListener('click',e=>{if(!pop.hidden&&!pop.contains(e.target)&&!e.target.closest('.mcell'))hide()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
    window.addEventListener('scroll',()=>{if(!pop.hidden)hide()},{passive:true});
    window.addEventListener('popstate',()=>hide());}
  let pinned=null;
  function hide(){pop.hidden=true;pinned=null;document.querySelectorAll('.mcell.on').forEach(b=>b.classList.remove('on'))}
  function show(b,pin){
    const r=OPPBY[b.dataset.r],c=OPPBY[b.dataset.c],x=oppEdge(r.id,c.id),k=x.e===1?'fav':x.e===-1?'unf':'even';
    document.querySelectorAll('.mcell.on').forEach(z=>z.classList.remove('on'));b.classList.add('on');
    pop.className=k;pop.innerHTML=`<div class="mp-decks"><span class="mthumb" ${oppArt(r)}></span><b>${esc(r.name)}</b><span class="mp-vs">vs</span><span class="mthumb" ${oppArt(c)}></span><b>${esc(c.name)}</b></div>
      <p class="mp-verdict"><span class="mdot"></span>${x.e===0?'Even matchup':(x.e===1?'Favored for ':'Unfavored for ')+esc(r.name)}</p>
      <p class="mp-why">${esc(x.why)}</p>
      <p class="mp-links"><a href="#opponents-${r.id}">Open ${esc(r.name)}</a> · <a href="#opponents-${c.id}">Open ${esc(c.name)}</a></p>`;
    pop.hidden=false;pinned=pin?b:null;
    const R=b.getBoundingClientRect(),W=Math.min(340,innerWidth-24),H=pop.offsetHeight;pop.style.width=W+'px';
    let left=Math.max(12,Math.min(innerWidth-W-12,R.left+R.width/2-W/2)),top=R.bottom+8;
    if(top+H>innerHeight-12)top=Math.max(12,R.top-H-8);
    pop.style.left=left+'px';pop.style.top=top+'px';
  }
  app.querySelectorAll('.mcell').forEach(b=>{
    b.addEventListener('click',e=>{e.stopPropagation();if(pinned===b)hide();else show(b,true)});
  });
}

function renderLesson(key){
  const idx=ALL.findIndex(x=>String(x.n)===key);if(idx<0){renderCourse();return}
  const l=ALL[idx];const n=l.n;const basics=typeof n==='string';
  const isDone=done().includes(n);const prev=ALL[idx-1],next=ALL[idx+1];
  const sep=TW().sep;const lvl=levelOf(l);const grp=lvl==='201'?L2:lvl==='301'?L3:L;
  const crumb=basics?`Step 0: The Basics${sep}Part ${B.indexOf(l)+1} of ${B.length}`:`Goat ${lvl}${sep}${TW().lesson} ${n} (${grp.indexOf(l)+1} of ${grp.length})`;
  // Wide layout: the reading column on the left (kept to a comfortable line length), and a sticky sidebar
  // with the lesson's cards, its goals and an "On this page" list. On narrow screens the sidebar sits on top.
  app.innerHTML=`<article class="lesson wide">
    <header class="lhead"><div class="crumbs"><a href="#course">Course</a>${TW().sep}${crumb}</div>
      <h1>${l.title}</h1><p class="sub">${l.sub} <span class="pill">${l.min} min · ${l.flash.length} flashcards</span></p></header>
    <div class="lgrid">
      <div class="lmain">${l.html}</div>
      <aside class="lside" aria-label="Lesson overview">
        ${l.cards.length?`<section class="sbox"><h4>Cards in this lesson</h4><div class="stiles">${l.cards.map(i=>C[i]?tile(C[i]):nameTile(i)).join('')}</div><p class="note" style="margin:6px 0 0">Tap a card for its text and art.</p></section>`:''}
        <div id="lgoals"></div>
        <section class="sbox stoc" id="ltoc"><h4>On this page</h4></section>
      </aside>
    </div>
    <section class="lesson-fc"><h2>Check yourself</h2><p class="note">Tap a question to see the answer. <a href="#flashcards" id="fclink">Practice these in Flashcards</a></p><div class="qa-grid" id="lfc"></div></section>
    <div class="lesson-foot">
      ${prev?`<a class="btn" href="#lesson-${prev.n}">← ${lessonLabel(prev)}</a>`:'<span></span>'}
      <button class="btn ${isDone?'':'primary'}" id="mark">${isDone?'✓ Done (tap to undo)':'Mark lesson done'}</button>
      ${next?`<a class="btn" href="#lesson-${next.n}">${lessonLabel(next)} →</a>`:`<a class="btn" href="#course">Back to course</a>`}
    </div></article>`;
  const main=app.querySelector('.lmain');
  // Goals move to the sidebar.
  const goals=main.querySelector('.goals');if(goals){goals.classList.add('sbox');document.getElementById('lgoals').replaceWith(goals)}
  addGlances(main,n);
  // Callouts that follow each other sit side by side instead of stacking.
  let run=[];const flush=()=>{if(run.length>1){const g=document.createElement('div');g.className='callgrid';run[0].before(g);run.forEach(c=>g.appendChild(c))}run=[]};
  [...main.children].forEach(el=>{if(el.classList.contains('call'))run.push(el);else flush()});flush();
  // "On this page": one entry per section heading.
  const toc=document.getElementById('ltoc');const hs=[...main.querySelectorAll('h2')];
  if(hs.length<2)toc.remove();else hs.forEach((h,k)=>{h.id='sec-'+k;const b=document.createElement('button');b.type='button';b.textContent=h.textContent;b.onclick=()=>h.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});toc.appendChild(b)});
  document.getElementById('mark').onclick=()=>{setDone(n,!isDone);if(!isDone&&next)go('lesson-'+next.n);else renderLesson(String(n))};
  document.getElementById('fclink').onclick=()=>store.set('fcset',String(n));
  // Lesson quiz as a grid of question cards; tap one to show its answer.
  document.getElementById('lfc').innerHTML=l.flash.map(f=>`<button type="button" class="qa" aria-expanded="false"><span class="q">${esc(f[0])}</span><span class="a">${esc(f[1])}</span><small>Tap to see the answer</small></button>`).join('');
  app.querySelectorAll('.qa').forEach(b=>b.onclick=()=>{const on=!b.classList.contains('show');b.classList.toggle('show',on);b.setAttribute('aria-expanded',on)});
  fitTables(app);
}

/* ============ FLASHCARDS ============ */
function allCards(){return ALL.flatMap(l=>l.flash.map((f,i)=>({id:`L${l.n}-${i}`,q:f[0],a:f[1],lesson:l.n,label:lessonLabel(l)})))}
function mountFlash(el,deck,full){
  let i=0,flip=false;const known=new Set(store.get('known',[]));
  function draw(){
    if(!deck.length){el.innerHTML='<p class="note">No cards in this set.</p>';return}
    const f=deck[i];
    el.innerHTML=`<div class="fc-wrap">
      <div class="fc ${flip?'flip':''}" id="fcard" tabindex="0" role="button" aria-label="Flip card">
        <div class="fc-in"><div class="fc-face"><small>${f.label} · Question ${i+1} of ${deck.length}</small><div class="q">${esc(f.q)}</div><small style="margin-top:auto">Tap to see the answer</small></div>
        <div class="fc-face back"><small>Answer</small><div class="a">${esc(f.a)}</div></div></div></div>
      <div class="fc-nav">
        <button class="btn" id="fprev" ${i===0?'disabled':''}>← Back</button>
        <button class="btn" id="fagain">Again</button>
        <button class="btn primary" id="fgot">${known.has(f.id)?'✓ Known':'Got it'}</button>
      </div>
      ${full?`<p class="note">${[...known].filter(k=>deck.some(d=>d.id===k)).length} of ${deck.length} marked as known in this set.</p>`:''}</div>`;
    const fc=el.querySelector('#fcard');
    fc.onclick=()=>{flip=!flip;fc.classList.toggle('flip',flip)};
    fc.onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();fc.click()}};
    el.querySelector('#fprev').onclick=()=>{i=Math.max(0,i-1);flip=false;draw()};
    el.querySelector('#fagain').onclick=()=>{known.delete(f.id);store.set('known',[...known]);i=(i+1)%deck.length;flip=false;draw()};
    el.querySelector('#fgot').onclick=()=>{known.add(f.id);store.set('known',[...known]);i=(i+1)%deck.length;flip=false;draw()};
  }
  draw();
}
function renderFlash(){
  const sel=store.get('fcset','all');
  app.innerHTML=`<div class="read"><h1 style="font-size:32px;margin-bottom:6px">Flashcards</h1>
  <p class="note">Every quiz question from the course. Mark the ones you know, and repeat the rest.</p>
  <div class="fc-top" style="margin:14px 0"><label for="fcsel"><b>Set</b></label>
    <select id="fcsel"><option value="all">All lessons</option><option value="basics" ${sel==='basics'?'selected':''}>All of Step 0: The Basics</option>${ALL.map(l=>`<option value="${l.n}" ${String(sel)===String(l.n)?'selected':''}>${lessonLabel(l)}: ${l.title}</option>`).join('')}<option value="unknown" ${sel==='unknown'?'selected':''}>Only cards I don't know yet</option></select>
    <button class="btn small" id="shuf">Shuffle</button><button class="btn small" id="resetk">Reset known</button></div>
  <div id="fcmount"></div></div>`;
  const s=document.getElementById('fcsel');if(sel==='all')s.value='all';
  function load(shuffle){
    const v=s.value;store.set('fcset',v);const known=new Set(store.get('known',[]));
    let deck=allCards();
    if(v==='unknown')deck=deck.filter(d=>!known.has(d.id));else if(v==='basics')deck=deck.filter(d=>typeof d.lesson==='string');else if(v!=='all')deck=deck.filter(d=>String(d.lesson)===v);
    if(shuffle)deck=deck.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
    mountFlash(document.getElementById('fcmount'),deck,true);
  }
  s.onchange=()=>load(false);document.getElementById('shuf').onclick=()=>load(true);
  document.getElementById('resetk').onclick=()=>{store.set('known',[]);load(false)};
  load(false);
}

/* ============ GLOSSARY ============ */
function renderGloss(){
  // Terms only: cards live in Card search, the banlist on its own page.
  let q='';
  app.innerHTML=`<div class="read" style="max-width:980px"><h1 style="font-size:32px;margin-bottom:6px">Glossary</h1>
  <p class="note">Every term used in the course, in plain words.</p>
  <div class="gl-top"><input type="search" id="gq" placeholder="Search terms" aria-label="Search terms"></div>
  <div id="gres" style="margin-top:12px"></div></div>`;
  const out=document.getElementById('gres');
  function draw(){
    const m=x=>x.toLowerCase().includes(q.toLowerCase());
    const t=TERMS.filter(x=>m(x[0])||m(x[1])).sort((a,b)=>a[0].localeCompare(b[0]));
    out.innerHTML=t.length?`<div class="terms">${t.map(x=>`<div class="term"><b>${x[0]}</b><p>${x[1]}</p></div>`).join('')}</div>`:'<p class="note">No term matches that search.</p>';
  }
  document.getElementById('gq').oninput=e=>{q=e.target.value;draw()};
  draw();
}

/* ============ CARD MODAL ============ */
const modal=document.getElementById('modal');
function closeModal(){modal.innerHTML='';if(typeof deckDirty!=='undefined'&&deckDirty&&curKey()==='builder')renderBuilder()}
// A card with no art on the image server shows an empty frame instead of a broken-image icon.
// An image that fails gets one retry (a network hiccup or an old cached error), then shows an empty frame.
document.addEventListener('error',e=>{const t=e.target;if(t.tagName!=='IMG')return;
  if(!t.dataset.retried){t.dataset.retried='1';const src=t.getAttribute('src');setTimeout(()=>{t.src=src+(src.includes('?')?'&':'?')+'r='+Date.now()},600);return}
  t.style.opacity='0'},true);
function openModal(html,onMount){
  // In fullscreen only the board is shown, so pop-ups have to live inside it.
  const host=document.fullscreenElement||document.body;if(modal.parentNode!==host)host.appendChild(modal);
  modal.innerHTML=`<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  document.getElementById('scrim').onclick=e=>{if(e.target.id==='scrim')closeModal()};
  modal.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  if(onMount)onMount(modal.querySelector('.sheet'));
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
function bigCard(cd){
  const [fr,ink]=FRAME[cd.kind]||FRAME.effect;
  const isST=cd.kind==='spell'||cd.kind==='trap';
  const at=isST?(cd.kind==='spell'?ATTR.SPELL:ATTR.TRAP):(ATTR[cd.attr]||ATTR.EARTH);
  const attrLabel=isST?(cd.kind==='spell'?'SPELL':'TRAP'):(cd.attr||'');
  const stars=isST?`<span>[${esc(cd.kind==='spell'?'Spell':'Trap')} Card · ${esc(cd.sub)}]</span>`:'<i></i>'.repeat(Math.min(cd.lv||0,12));
  const tl=isST?'':`<b class="tl">[${esc(typeLine(cd))}]</b>`;
  const ad=isST?'':`<div class="ad">ATK/${cd.atk} &nbsp; DEF/${cd.def}</div>`;
  return `<div class="bigcard" style="--fr:${fr};--frink:${ink};--attr:${at}">
    <div class="bn"><h3>${esc(cd.name)}</h3><span class="attr">${attrLabel}</span></div>
    <div class="stars">${stars}</div>
    <div class="bart"><em>${esc(initials(cd.name))}</em></div>
    <div class="tx">${tl}<p>${esc(cd.text)}</p>${ad}</div></div>`;
}
/* Real card view: art, Edison text, rulings, banlist. lessonCard adds the course's plain-English summary. */
function cardViewHTML(r,lessonCard,page){
  const ban=r.b?{F:'Forbidden',L:'Limited (1 copy)',S:'Semi-Limited (2 copies)'}[r.b]:'Unlimited (3 copies)';
  const edison=r.ps||r.tx;const differs=r.ps&&r.tx&&r.ps.replace(/\s/g,'')!==r.tx.replace(/\s/g,'');
  const inDeck=builderCount(r.id);
  return `${page?'':'<button class="closex" data-close aria-label="Close">×</button>'}<div class="cv">
    <img class="cimg" src="${artURL(r)}" alt="${esc(r.n)}">
    <div>
      ${page?`<h1 class="cvh">${esc(r.n)}</h1>`:`<h3>${esc(r.n)}</h3>`}
      <div class="meta">${esc(statLine(r))}</div>
      <p style="margin:0">Banlist: <b>${ban}</b>${r.b?` <span class="badge b-${r.b}">${r.b}</span>`:''}</p>
      ${stapleShare(r.id)?`<p style="margin:2px 0 0">Staple: <b>in ${stapleShare(r.id)}% of decks</b> <a class="badge b-st" href="#staples" title="See all staples">Staple</a></p>`:''}
      <h4>Card text</h4>
      <p class="ctext">${esc(edison)}</p>
      ${differs?`<details><summary>Printed text (newer wording)</summary><div class="rul">${esc(r.tx)}</div></details>`:''}
      ${lessonCard?`<h4>In plain English</h4><p class="rul">${esc(lessonCard.text)}</p>`:''}
      ${r.ru?`<h4>Goat rulings</h4><p class="rul">${esc(r.ru)}</p>`:''}
      ${r.rb?`<details><summary>General rulings</summary><div class="rul">${esc(r.rb)}</div></details>`:''}
      <div class="links">
        ${r.k==='token'?'':`<button class="btn small primary" id="cv-add">+ Add to my deck${inDeck?` (${inDeck} in it)`:''}</button>`}
        ${r.k==='token'?'':`<a class="btn small" href="https://edisonformat.net/card?name=${encodeURIComponent(r.n)}" target="_blank" rel="noopener">edisonformat.net ↗</a>
        <a class="btn small" href="${dbLink(r.n)}" target="_blank" rel="noopener">Official database ↗</a>`}
        ${page||r.k==='token'?'':`<a class="btn small" href="#card-${r.id}" data-close>Card page</a>`}
      </div>
      <p class="note" id="cv-msg" style="margin:6px 0 0"></p>
    </div></div>`;
}
function wireCardView(r){
  if(document.getElementById('cv-add'))document.getElementById('cv-add').onclick=()=>{const m=addToDeck(r.id,isExtraR(r)?'extra':'main');document.getElementById('cv-msg').textContent=m;const n=builderCount(r.id);document.getElementById('cv-add').textContent=`+ Add to my deck${n?` (${n} in it)`:''}`};
}
function showReal(rid,lessonCard){
  const r=BYID.get(+rid);if(!r)return;
  openModal(cardViewHTML(r,lessonCard));linkify(modal);
  modal.querySelector('.sheet').classList.add('wide');
  document.getElementById('scrim').style.alignItems='center';
  wireCardView(r);
}
/* A card's own page (/cards/<name>/): the same view as the pop-up, for search engines and shared links. */
function renderCardPage(id){
  const r=BYID.get(+id);if(!r){renderSearch();return}
  const lc=Object.values(C).find(c=>c.rid===r.id&&c.kind!=='token');
  app.innerHTML=`<div class="cardpage"><p class="crumbs"><a href="#cards">Card search</a> › ${esc(r.n)}</p>${cardViewHTML(r,lc||null,true)}</div>`;
  wireCardView(r);
}
function showCard(id,cd){
  cd=cd||C[id];if(!cd)return;
  if(cd.rid&&BYID.has(cd.rid)){showReal(cd.rid,C[cd.id]&&cd.kind!=='token'?cd:null);return}
  const b=banStatus(cd.name);
  const bl=b?{F:'Forbidden',L:'Limited (1)',S:'Semi-Limited (2)'}[b]:(cd.kind==='token'?'Token':cd.race==='Custom'||cd.text.startsWith('Custom')?'Custom card':'Unlimited (3)');
  openModal(`<button class="closex zoom-x" data-close aria-label="Close">×</button><div class="zoom">${bigCard(cd)}
  <p class="meta">Banlist: <b>${bl}</b>${b?` <span class="badge b-${b}">${b}</span>`:''}</p>
  <p class="note" style="text-align:center;margin:0">Plain-English summary of the card. Tap outside the card to close.</p>
  ${C[cd.id]&&cd.kind!=='token'?`<a class="btn small" href="${dbLink(cd.name)}" target="_blank" rel="noopener">See the real card in the official database ↗</a>`:''}</div>`);
  document.getElementById('scrim').classList.add('zoomed');
  modal.querySelector('.bigcard').onclick=closeModal;
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-card]');
  if(t&&!t.closest('.board')&&!t.closest('.hand')&&!t.closest('.pick-list')){e.preventDefault();showCard(t.dataset.card);return}
  const r=e.target.closest('[data-rid]');
  if(r){e.preventDefault();showReal(r.dataset.rid)}
});

/* ============ CARD SEARCH ============ */
const ATTRS=['DARK','LIGHT','EARTH','WATER','FIRE','WIND','DIVINE'];
const RACES=[...new Set(DB.filter(isMonR).map(r=>r.r))].sort();
const ABILS=['Tuner','Synchro','Fusion','Ritual','Normal','Effect','Flip','Gemini','Union','Spirit','Toon'];
const SUBS=['Normal','Quick-Play','Continuous','Equip','Field','Ritual','Counter'];
const blankFilter=()=>({q:'',where:'name',kind:'',staple:'',attr:'',race:'',ab:'',sub:'',ban:'',lvMin:'',lvMax:'',atkMin:'',atkMax:'',defMin:'',defMax:'',sort:'name'});
let STAPLE_IDS=null;const stapleIds=()=>STAPLE_IDS||(STAPLE_IDS=new Set(stapleData('all').rows.map(x=>x.r.id)));
// A card's staple share (percent of all decks), or 0 if it isn't a staple. Shown in the card view.
let STAPLE_PCT=null;const stapleShare=id=>{if(!STAPLE_PCT)STAPLE_PCT=new Map(stapleData('all').rows.map(x=>[x.r.id,Math.round(x.share*100)]));return STAPLE_PCT.get(id)||0};
const num=v=>{const x=parseInt(v,10);return isNaN(x)?null:x};
function cardMatch(r,s){
  if(s.q){const q=s.q.toLowerCase();const hay=s.where==='text'?r.n+' '+(r.ps||'')+' '+r.tx:r.n;if(!hay.toLowerCase().includes(q))return false}
  if(s.staple&&!stapleIds().has(r.id))return false;
  const mon=isMonR(r);
  if(s.kind==='monster'&&!mon)return false;
  if(s.kind==='spell'&&r.k!=='spell')return false;
  if(s.kind==='trap'&&r.k!=='trap')return false;
  if(s.kind==='extra'&&!isExtraR(r))return false;
  if(s.kind==='main'&&isExtraR(r))return false;
  if(s.attr&&r.a!==s.attr)return false;
  if(s.race&&r.r!==s.race)return false;
  if(s.ab){if(!mon)return false;const ab=r.ab||'';
    if(s.ab==='Tuner'&&!r.tu)return false;
    if(['Synchro','Fusion','Ritual','Normal'].includes(s.ab)&&r.k!==s.ab.toLowerCase())return false;
    if(s.ab==='Effect'&&(r.k==='normal'||!(ab.includes('Effect')||r.k==='effect')))return false;
    if(['Flip','Gemini','Union','Spirit','Toon'].includes(s.ab)&&!ab.includes(s.ab))return false}
  if(s.sub&&(mon||r.sub!==s.sub))return false;
  if(s.ban==='3'?!!r.b:s.ban&&r.b!==s.ban)return false;
  for(const [f,lo,hi] of [['lv','lvMin','lvMax'],['atk','atkMin','atkMax'],['def','defMin','defMax']]){
    const a=num(s[lo]),b=num(s[hi]);if(a===null&&b===null)continue;
    const v=mon?num(r[f]):null;if(v===null)return false;if(a!==null&&v<a)return false;if(b!==null&&v>b)return false}
  return true;
}
function searchCards(s){
  const list=DB.filter(r=>cardMatch(r,s));
  const key={lv:r=>num(r.lv)??-1,atk:r=>num(r.atk)??-1,def:r=>num(r.def)??-1}[s.sort];
  return key?list.sort((a,b)=>key(b)-key(a)||a.n.localeCompare(b.n)):list.sort((a,b)=>a.n.localeCompare(b.n));
}
function filterForm(s,compact){
  const opt=(arr,val,label)=>`<option value="">${label}</option>`+arr.map(a=>{const [v,t]=Array.isArray(a)?a:[a,a];return `<option value="${esc(v)}" ${v===val?'selected':''}>${esc(t)}</option>`}).join('');
  const sel=(f,arr,label)=>`<select data-f="${f}" aria-label="${label}">${opt(arr,s[f],label)}</select>`;
  const rng=(lbl,lo,hi)=>`<label>${lbl}<span class="pair"><input type="number" data-f="${lo}" value="${esc(s[lo])}" placeholder="min" aria-label="${lbl} minimum"><input type="number" data-f="${hi}" value="${esc(s[hi])}" placeholder="max" aria-label="${lbl} maximum"></span></label>`;
  const more=`<div class="frow">${sel('attr',ATTRS,'Any Attribute')}${sel('race',RACES,'Any Type')}${sel('ab',ABILS,'Any ability')}${sel('sub',SUBS,'Any Spell/Trap kind')}${sel('ban',[['F','Forbidden'],['L','Limited'],['S','Semi-Limited'],['3','Unlimited']],'Any banlist status')}${compact?'':sel('sort',[['lv','Sort by Level'],['atk','Sort by ATK'],['def','Sort by DEF']],'Sort by name')}</div>
    <div class="rng">${rng('Level','lvMin','lvMax')}${rng('ATK','atkMin','atkMax')}${rng('DEF','defMin','defMax')}</div>`;
  return `<div class="filters">
    <div class="frow"><input type="search" data-f="q" value="${esc(s.q)}" placeholder="Search cards" aria-label="Search cards"><select data-f="where" aria-label="Search in">${[['name','Name only'],['text','Name and text']].map(([v,t])=>`<option value="${v}" ${s.where===v?'selected':''}>${t}</option>`).join('')}</select></div>
    <div class="frow">${sel('kind',[['monster','Monsters'],['spell','Spells'],['trap','Traps'],['main','Main Deck cards'],['extra','Extra Deck monsters']],'All cards')}${sel('staple',[['yes','Staples only']],'Staples and others')}<button class="btn small" data-reset type="button">Reset</button></div>
    <details ${compact||window.innerWidth<720?'':'open'}><summary>More filters</summary>${more}</details>
  </div>`;
}
function bindFilters(root,s,cb){
  root.querySelectorAll('[data-f]').forEach(el=>{el.oninput=el.onchange=()=>{s[el.dataset.f]=el.value;cb()}});
  root.querySelector('[data-reset]').onclick=()=>{Object.assign(s,blankFilter());root.querySelectorAll('[data-f]').forEach(el=>{el.value=s[el.dataset.f]});cb()};
}
const noData=()=>`<div class="read"><h1 style="font-size:30px">Card data did not load</h1><p>The card list lives in <code>data/cards.js</code>. Run <code>python3 build/build_data.py</code> to build it, then reload this page.</p></div>`;
const srcNote=()=>`<p class="srcnote">Card data and art come from <a href="https://ygoprodeck.com" target="_blank" rel="noopener">YGOPRODeck</a>${window.GOAT_META?`, copied ${window.GOAT_META.built}`:''}; the card pool and banlist follow <a href="https://www.goatformat.com/cardpool.html" target="_blank" rel="noopener">goatformat.com</a>. Card text and images are © Konami.</p>`;
let SS=Object.assign(blankFilter(),store.get('search',{}));
let PAGE=1,PER=[25,50,100].includes(store.get('searchper',25))?store.get('searchper',25):25;
function renderSearch(){
  if(!DB.length){app.innerHTML=noData();return}
  app.innerHTML=`<h1 style="font-size:32px;margin-bottom:4px">Card Search</h1>
  <p class="note" style="margin:0">All ${DB.length.toLocaleString()} Goat-legal cards. Tap a card for its text and art.</p>
  ${filterForm(SS,false)}<div class="pager" id="pgtop"></div><div class="cthumbs" id="res"></div><div class="pager" id="pgbot"></div>${srcNote()}`;
  bindFilters(app,SS,()=>{PAGE=1;store.set('search',SS);drawRes()});
  drawRes();
}
// Results come in pages: 25, 50 or 100 at a time (25 by default), with the same pager above and below.
function drawRes(scroll){
  const list=searchCards(SS);const pages=Math.max(1,Math.ceil(list.length/PER));PAGE=Math.min(Math.max(1,PAGE),pages);
  const from=(PAGE-1)*PER;
  document.getElementById('res').innerHTML=list.slice(from,from+PER).map(r=>thumb(r)).join('')||'<p class="note">No cards match. Try fewer filters.</p>';
  const nums=[];for(let p=1;p<=pages;p++){if(p===1||p===pages||Math.abs(p-PAGE)<=2)nums.push(p);else if(nums[nums.length-1]!=='…')nums.push('…')}
  const pager=`<span class="rcount">${list.length?`${(from+1).toLocaleString()}–${Math.min(from+PER,list.length).toLocaleString()} of ${list.length.toLocaleString()} cards`:'0 cards'}</span>
    <span class="pgnums">${pages>1?`<button class="btn small" data-pg="${PAGE-1}" ${PAGE===1?'disabled':''} aria-label="Previous page">‹ Prev</button>${nums.map(p=>p==='…'?'<span class="pgdots">…</span>':`<button class="btn small ${p===PAGE?'primary':''}" data-pg="${p}" ${p===PAGE?'aria-current="page"':''}>${p}</button>`).join('')}<button class="btn small" data-pg="${PAGE+1}" ${PAGE===pages?'disabled':''} aria-label="Next page">Next ›</button>`:''}</span>
    <label class="pgper">Show <select data-per aria-label="Cards per page">${[25,50,100].map(n=>`<option ${n===PER?'selected':''}>${n}</option>`).join('')}</select></label>`;
  ['pgtop','pgbot'].forEach(id=>{const el=document.getElementById(id);el.innerHTML=pager;
    el.querySelectorAll('[data-pg]').forEach(b=>b.onclick=()=>{PAGE=+b.dataset.pg;drawRes(id==='pgbot')});
    el.querySelector('[data-per]').onchange=e=>{PER=+e.target.value;store.set('searchper',PER);PAGE=1;drawRes()}});
  if(scroll)document.getElementById('pgtop').scrollIntoView({block:'start'});
}

/* ============ STARTER DECKS ============ */
const DECKS=window.GOAT_DECKS||[];
const TIERS=[['A','Tier A','The strongest decks on goatformat.com\u2019s 2020 tier list.'],['B','Tier B','Strong decks from the same list, most of them combo or burn.'],['C','Tier C','Playable decks from the same list, and Warriors, a long-time favorite with its own guide.'],['D','Tier D','Lower on the 2020 list, but they still win events.'],['T','More tournament decks','Other decks that have placed at Goat events, most played first. Each is the best-placing list of its deck on Format Library, a site that archives tournament decklists. They aren\u2019t on the 2020 tier list.']];
function coverCard(d){
  const n=new Map;for(const id of d.main){const r=BYID.get(id);if(r&&isMonR(r))n.set(id,(n.get(id)||0)+1)}
  let best=null,bn=0;for(const [id,c] of n)if(c>bn){best=id;bn=c}
  return BYID.get(best||d.extra[0]||d.main[0]);
}
function grouped(ids){
  const m=new Map;for(const i of ids)m.set(i,(m.get(i)||0)+1);
  const ord=r=>r.k==='spell'?2:r.k==='trap'?3:r.k==='fusion'?0:r.k==='synchro'?1:0;
  return [...m].map(([id,n])=>({r:BYID.get(id),n})).filter(x=>x.r).sort((a,b)=>ord(a.r)-ord(b.r)||(isExtraR(a.r)&&isExtraR(b.r)?(a.r.lv-b.r.lv):0)||a.r.n.localeCompare(b.r.n));
}
function renderDecks(){
  if(!DECKS.length){app.innerHTML=noData();return}
  app.innerHTML=`<h1 style="font-size:32px;margin-bottom:4px">All Decks</h1>
  <p class="note" style="margin:0;max-width:700px">The top Goat decks and the most played ones, each credited to where it comes from. Open one to see the list, draw a test hand, or copy it into the Deck Builder.</p>
  ${TIERS.map(([tag,title,blurb])=>{const ds=DECKS.filter(d=>d.tier===tag);if(!ds.length)return '';
    return `<section class="level-block"><div class="level-head"><h2>${title}</h2><p>${blurb}</p></div><div class="deckgrid">${ds.map(d=>{const cv=coverCard(d);
      return `<a class="deckcard" href="#deck-${encodeURIComponent(d.name)}"><span class="cover" style="background-image:url('${cv?artURL(cv):''}')"></span>${esc(d.name)}<small>${d.main.length} main${d.extra.length?` · ${d.extra.length} fusion`:''}${d.side.length?` · ${d.side.length} side`:''}</small></a>`}).join('')}</div></section>`}).join('')}
  ${srcNote()}`;
}
function renderDeck(name){
  const d=DECKS.find(x=>x.name===name);if(!d){renderDecks();return}
  const g=grouped(d.main);const part=f=>g.filter(x=>f(x.r));const cnt=a=>a.reduce((s,x)=>s+x.n,0);
  const mons=part(isMonR),sp=part(r=>r.k==='spell'),tr=part(r=>r.k==='trap');
  const grid=a=>`<div class="cthumbs sm">${a.map(x=>thumb(x.r,'',x.n)).join('')}</div>`;
  const tier=TIERS.find(t=>t[0]===d.tier);
  app.innerHTML=`<div class="crumbs"><a href="#decks">All Decks</a> · ${tier?tier[1]:''}</div>
  <div class="dhead"><h1 style="font-size:32px">${esc(d.name)}</h1><div class="frow">
    <button class="btn small primary" id="dopen">Open in Deck Builder</button><button class="btn small" id="dhand">Test hand</button><button class="btn small" id="dydk">Download .ydk</button></div></div>
  <section class="dsec"><h2>Main Deck (${d.main.length})</h2>
    <h3>Monsters (${cnt(mons)})</h3>${grid(mons)}<h3>Spells (${cnt(sp)})</h3>${grid(sp)}<h3>Traps (${cnt(tr)})</h3>${grid(tr)}</section>
  ${d.extra.length?`<section class="dsec"><h2>Fusion Deck (${d.extra.length})</h2>${grid(grouped(d.extra))}</section>`:''}
  ${d.side.length?`<section class="dsec"><h2>Side Deck (${d.side.length})</h2>${grid(grouped(d.side))}</section>`:''}
  <p class="srcnote">List: ${esc(d.by||'')}. From <a href="${esc(d.src||'')}" target="_blank" rel="noopener">${esc((d.src||'').replace(/^https:\/\/(www\.)?/,''))}</a>.${d.note?' '+esc(d.note):''}${d.tier==='T'?'':' Tiers follow goatformat.com\u2019s 2020 tier list.'}</p>
  ${srcNote()}`;
  document.getElementById('dopen').onclick=()=>{loadIntoBuilder({name:d.name,main:[...d.main],extra:[...d.extra],side:[...d.side]});go('builder')};
  document.getElementById('dhand').onclick=()=>testHand(d.main);
  document.getElementById('dydk').onclick=()=>downloadText(d.name+'.ydk',toYDK(d));
}
function testHand(main){
  if(main.length<6){openModal(`<button class="closex" data-close aria-label="Close">×</button><h3>Test hand</h3><p>Add at least 6 cards to the Main Deck first.</p>`);return}
  const draw=()=>{const deck=[...main];for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}return deck.slice(0,6)};
  const show=()=>{openModal(`<button class="closex" data-close aria-label="Close">×</button><h3>Test hand</h3><div class="meta">Your 5-card opening hand plus your first draw. In Goat, the first player draws on turn 1 too.</div>
    <div class="handrow">${draw().map(id=>thumb(BYID.get(id))).join('')}</div><div class="actions"><button class="btn primary" id="redraw">Draw a new hand</button></div>`);
    modal.querySelector('.sheet').classList.add('wide');document.getElementById('redraw').onclick=show};
  show();
}
const toYDK=d=>['#created by Learn Retro','#main',...d.main,'#extra',...d.extra,'!side',...d.side].join('\n')+'\n';
function downloadText(name,text){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));
  a.download=name.replace(/[\\/:*?"<>|]/g,'');document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
}
const ID_ALIAS={83011277:83011278};
// Reads a .ydk file, or a plain list like "3 Sangan" / "Sangan x3" (Extra Deck monsters go to the Extra Deck).
function parseDeck(text){
  const d={main:[],extra:[],side:[]},unknown=[];let sec=null;
  if(/#main/.test(text)){
    for(let line of text.split(/\r?\n/)){line=line.trim();
      if(line==='#main')sec='main';else if(line==='#extra')sec='extra';else if(line==='!side')sec='side';
      else if(/^\d+$/.test(line)&&sec){const id=ID_ALIAS[+line]||+line;if(BYID.has(id))d[sec].push(id);else unknown.push(line)}}
  }else{
    sec='main';
    for(let line of text.split(/\r?\n/)){line=line.trim();if(!line)continue;
      if(/^side/i.test(line)){sec='side';continue}if(/^(main|extra|monsters?|spells?|traps?)\b/i.test(line)&&!/\d/.test(line)){if(sec!=='side')sec='main';continue}
      const m=line.match(/^(\d+)\s*x?\s+(.+)$/i)||line.match(/^(.+?)\s+x?(\d+)$/i);
      const [n,nm]=m?(/^\d+$/.test(m[1])?[+m[1],m[2]]:[+m[2],m[1]]):[1,line];
      const r=BYNAME.get(nm.trim())||DB.find(x=>x.n.toLowerCase()===nm.trim().toLowerCase());
      if(!r){unknown.push(line);continue}
      for(let i=0;i<n;i++)(sec==='side'?d.side:isExtraR(r)?d.extra:d.main).push(r.id)}
  }
  return {d,unknown};
}

/* ============ RULES MENU: BANLIST, RULINGS, ERRATA ============ */
// Section menus. Each opens under its button with fixed positioning, so the nav's sideways scroll on phones can't clip it.
function closeMenus(){document.querySelectorAll('.ndrop-menu.open').forEach(m=>m.classList.remove('open'));document.querySelectorAll('.ndrop-btn').forEach(b=>b.setAttribute('aria-expanded','false'))}
document.querySelectorAll('.ndrop-btn').forEach(btn=>btn.onclick=e=>{e.stopPropagation();const m=document.getElementById(btn.dataset.menu);const was=m.classList.contains('open');closeMenus();if(was)return;
  const b=btn.getBoundingClientRect();m.style.top=(b.bottom+6)+'px';m.style.left=Math.max(8,Math.min(b.left,window.innerWidth-236))+'px';
  m.classList.add('open');btn.setAttribute('aria-expanded','true');m.querySelector('a').focus()});
document.addEventListener('click',e=>{if(!e.target.closest('.ndrop-menu'))closeMenus()});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const open=document.querySelector('.ndrop-menu.open');if(open){closeMenus();document.querySelector(`[data-menu="${open.id}"]`).focus()}});
window.addEventListener('scroll',closeMenus,{passive:true});
/* Phone menu (Zack, 2026-11-23: "there is no hamburger menu on phones"): under 861 px (phones and tablets) the four section menus fold into
 one button; its panel lists every page under its section, built from the desktop menus so the two never drift apart. */
(function(){
  const btn=document.getElementById('mburger'),nav=document.getElementById('mnav');if(!btn||!nav)return;
  nav.innerHTML=`<a class="mhome" href="./">Home</a>`+[...document.querySelectorAll('.ndrop-btn')].map(b=>{const m=document.getElementById(b.dataset.menu);
    return `<section><h5>${b.textContent.replace('▾','').trim()}</h5>${[...m.querySelectorAll('a')].map(a=>`<a href="${a.getAttribute('href')}">${a.firstChild.textContent.trim()}<small>${a.querySelector('small')?.textContent||''}</small></a>`).join('')}</section>`}).join('')+`<section class="msoc"><h5>Follow Learn Retro</h5>${document.querySelector('.hsoc').innerHTML.replace(/aria-label="Learn Retro on (\w+)"([^>]*)>([\s\S]*?)<\/a>/g,'aria-label="Learn Retro on $1"$2>$3<span>$1</span></a>')}</section>`;
  const top=document.querySelector('header.top');
  const set=o=>{if(o)nav.style.setProperty('--mtop',Math.max(0,top.getBoundingClientRect().bottom)+'px');document.documentElement.classList.toggle('mnav-open',o);nav.hidden=!o;btn.setAttribute('aria-expanded',String(o));btn.setAttribute('aria-label',o?'Close menu':'Open menu');btn.classList.toggle('open',o)};
  btn.onclick=e=>{e.stopPropagation();set(nav.hidden)};
  nav.addEventListener('click',e=>{if(e.target.closest('a'))set(false)});
  document.addEventListener('click',e=>{if(!nav.hidden&&!e.target.closest('#mnav,#mburger'))set(false)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!nav.hidden){set(false);btn.focus()}});
  window.addEventListener('resize',()=>{if(nav.hidden)return;if(innerWidth>860)set(false);else nav.style.setProperty('--mtop',Math.max(0,top.getBoundingClientRect().bottom)+'px')});
})();
/* Format switcher (Zack, 2026-11-23: "clean navigation though with clear distinction on which site theyre on, and maybe
 an easy toggle so switch between formats"). The format name beside the logo opens a menu of every format, plus All
 formats (the hub) and the Blog. Switching keeps you in the same section when the other format has it (Card search,
 Banlist, Course...); a lesson, card or deck opens the other format's home. The same list shows at the top of the
 phone menu. A new format is a new line in #fmtmenu in index.html, on every format site. */
(function(){
  const sw=document.querySelector('.fmtsw'),btn=document.getElementById('fmtbtn'),menu=document.getElementById('fmtmenu');if(!sw||!btn||!menu)return;
  const SHARED=['course','flashcards','glossary','rules','cards','staples','banlist','decks','builder','simulator'];
  const links=[...menu.querySelectorAll('a[data-fmt]')];
  links.forEach(a=>{a.dataset.base=a.getAttribute('href');if(a.dataset.fmt===sw.dataset.fmt)a.setAttribute('aria-current','page')});
  const target=a=>{if(a.dataset.fmt===sw.dataset.fmt)return a.dataset.base;const k=curKey();return SHARED.includes(k)?a.dataset.base+k+'/':a.dataset.base};
  const aim=()=>document.querySelectorAll('#fmtmenu a[data-fmt],#mnav a[data-fmt]').forEach(a=>{a.dataset.base=a.dataset.base||a.getAttribute('href');a.setAttribute('href',target(a))});
  const set=o=>{menu.hidden=!o;btn.setAttribute('aria-expanded',String(o));sw.classList.toggle('open',o);if(o)aim()};
  btn.onclick=e=>{e.stopPropagation();set(menu.hidden)};
  document.addEventListener('click',e=>{if(!menu.hidden&&!e.target.closest('.fmtsw'))set(false)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){set(false);btn.focus()}});
  const nav=document.getElementById('mnav');
  if(nav){nav.insertAdjacentHTML('afterbegin',`<section class="mfmt"><h5>Format</h5>${links.map(a=>`<a data-fmt="${a.dataset.fmt}" href="${a.dataset.base}"${a.hasAttribute('aria-current')?' aria-current="page"':''}><i class="fdot"></i>${a.querySelector('b').textContent}<small>${a.querySelector('small').textContent}</small></a>`).join('')}<a href="/">All formats</a></section>`);
    document.getElementById('mburger')?.addEventListener('click',aim)}
})();
/* ============ SITE SEARCH (Zack, 2026-11-17) ============
   One box in the header searches everything: pages, lessons (titles and text), cards, decks, glossary terms and
   Library videos. Results show as you type, grouped by kind; arrows and Enter pick one, Esc closes. */
let SIDX=null;
function siteIndex(){
  if(SIDX)return SIDX;
  const strip=h=>String(h||'').replace(/<[^>]+>/g,' ').replace(/\$\{[^}]*\}/g,' ').replace(/&[a-z]+;/g,' ').replace(/\s+/g,' ').trim();
  const pages=[{t:'Home',s:'Start here',href:'#home'},...[...document.querySelectorAll('.ndrop-menu a')].map(a=>({t:a.firstChild.textContent.trim(),s:a.querySelector('small')?.textContent||'',href:a.getAttribute('href')}))];
  const lessons=ALL.map(l=>{const body=strip(l.html);return{t:`${lessonLabel(l)}: ${l.title}`,s:l.sub,href:'#lesson-'+l.n,body,low:body.toLowerCase()}});
  const terms=TERMS.map(([t,d])=>({t,s:d,href:'#glossary',q:t}));
  const rules=((window.GOAT_RULES||{}).sections||[]).map(x=>{const body=strip(x.html);return{t:x.title,s:'Rules',href:'#rules-'+x.id,body,low:body.toLowerCase()}});
  const LIB=window.GOAT_LIBRARY;const vids=[];
  if(LIB)(LIB.sections||[]).forEach(sec=>(sec.videos||[]).forEach(v=>{if(!vids.some(x=>x.id===v.id))vids.push({id:v.id,t:v.t,s:`${LIB.channels[v.ch]?.name||''} · ${v.len}`,href:'https://www.youtube.com/watch?v='+v.id,ext:1})}));
  const decks=DECKS.map(d=>({t:d.name,s:`${d.tier==="T"?"Tournament":"Tier "+d.tier} deck · ${d.main.length} cards`,href:'#deck-'+encodeURIComponent(d.name)}));
  return SIDX={pages,lessons,rules,terms,vids,decks};
}
function sCardLine(r){const ban={F:'Forbidden',L:'Limited',S:'Semi-Limited'}[r.b];const cap=w=>w?w[0].toUpperCase()+w.slice(1):'';
  const base=r.k==='spell'||r.k==='trap'?`${r.sub&&r.sub!=='Normal'?r.sub+' ':''}${cap(r.k)}`:`Level ${r.lv} ${r.a||''} ${r.r||''} ${r.k==='effect'||r.k==='normal'?'monster':cap(r.k)}`.replace(/\s+/g,' ');
  return ban?`${base} · ${ban}`:base}
function sScore(name,q){const n=name.toLowerCase();if(n===q)return 0;if(n.startsWith(q))return 1;if(new RegExp('\\b'+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(n))return 2;if(n.includes(q))return 3;
  const w=q.split(/\s+/).filter(Boolean);return w.length>1&&w.every(x=>n.includes(x))?4:9}
function sMark(text,q){const t=esc(text);const i=t.toLowerCase().indexOf(esc(q).toLowerCase());return i<0?t:t.slice(0,i)+'<mark>'+t.slice(i,i+esc(q).length)+'</mark>'+t.slice(i+esc(q).length)}
function sTop(list,q,key,n){return list.map(x=>[sScore(key(x),q),x]).filter(([sc])=>sc<9).sort((a,b)=>a[0]-b[0]||key(a[1]).length-key(b[1]).length).slice(0,n).map(([,x])=>x)}
function siteSearch(raw){
  const q=raw.trim().toLowerCase(),box=document.getElementById('sres');
  if(q.length<2){box.classList.remove('open');box.innerHTML='';document.getElementById('sq').setAttribute('aria-expanded','false');return}
  const I=siteIndex(),out=[];
  const row=(href,title,sub,img,extra='')=>`<a href="${href}" ${extra} role="option">${img?`<img loading="lazy" src="${img}" alt="">`:''}<span><b>${sMark(title,q)}</b>${sub?`<small>${sub}</small>`:''}</span></a>`;
  const pg=sTop(I.pages,q,x=>x.t,3);if(pg.length)out.push('<h5>Pages</h5>'+pg.map(x=>row(x.href,x.t,esc(x.s))).join(''));
  const cardHits=DB.map(r=>[sScore(r.n,q),r]).filter(([sc])=>sc<9);
  if(cardHits.length){cardHits.sort((a,b)=>a[0]-b[0]||a[1].n.length-b[1].n.length);
    out.push('<h5>Cards</h5>'+cardHits.slice(0,6).map(([,r])=>row('#',r.n,esc(sCardLine(r)),artURL(r),`data-rid="${r.id}"`)).join(''));
    if(cardHits.length>6)out.push(`<a href="#cards" class="sall" data-sall="1">See all ${cardHits.length} cards matching "${esc(raw.trim())}"</a>`)}
  let ls=sTop(I.lessons,q,x=>x.t,4);
  if(ls.length<4)ls=ls.concat(I.lessons.filter(x=>!ls.includes(x)&&x.low.includes(q)).slice(0,Math.max(0,4-ls.length)).map(x=>({...x,hit:1})));
  if(ls.length)out.push('<h5>Lessons</h5>'+ls.map(x=>{let sub=esc(x.s);if(x.hit){const i=x.low.indexOf(q),a=Math.max(0,i-40);sub=(a?'…':'')+sMark(x.body.slice(a,i+q.length+60),q)+'…'}return row(x.href,x.t,sub)}).join(''));
  let rs=sTop(I.rules,q,x=>x.t,3);
  if(rs.length<3)rs=rs.concat(I.rules.filter(x=>!rs.includes(x)&&x.low.includes(q)).slice(0,Math.max(0,3-rs.length)).map(x=>({...x,hit:1})));
  if(rs.length)out.push('<h5>Rules</h5>'+rs.map(x=>{let sub='Rules';if(x.hit){const i=x.low.indexOf(q),a=Math.max(0,i-40);sub=(a?'…':'')+sMark(x.body.slice(a,i+q.length+60),q)+'…'}return row(x.href,x.t,sub)}).join(''));
  const dk=sTop(I.decks,q,x=>x.t,4);if(dk.length)out.push('<h5>Decks</h5>'+dk.map(x=>row(x.href,x.t,esc(x.s))).join(''));
  const tm=sTop(I.terms,q,x=>x.t,4);if(tm.length)out.push('<h5>Glossary</h5>'+tm.map(x=>row(x.href,x.t,esc(x.s),'',`data-gq="${esc(x.q)}"`)).join(''));
  const vd=sTop(I.vids,q,x=>x.t,3);if(vd.length)out.push('<h5>Library videos</h5>'+vd.map(x=>row(x.href,x.t+' ↗',esc(x.s),'img/lib/'+x.id+'.jpg','target="_blank" rel="noopener"')).join(''));
  box.innerHTML=out.join('')||`<div class="snone">Nothing found for "${esc(raw.trim())}".</div>`;
  box.classList.add('open');document.getElementById('sq').setAttribute('aria-expanded','true');box.scrollTop=0;
}
(function(){
  const inp=document.getElementById('sq'),box=document.getElementById('sres');
  const close=()=>{box.classList.remove('open');inp.setAttribute('aria-expanded','false')};
  const done=()=>{close();inp.value='';inp.blur()};
  inp.addEventListener('input',()=>siteSearch(inp.value));
  inp.addEventListener('focus',()=>{if(inp.value.trim().length>1)siteSearch(inp.value)});
  inp.addEventListener('keydown',e=>{
    const items=[...box.querySelectorAll('a')];let i=items.findIndex(a=>a.classList.contains('on'));
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!items.length)return;items[i]?.classList.remove('on');
      i=e.key==='ArrowDown'?(i+1)%items.length:(i<=0?items.length-1:i-1);items[i].classList.add('on');items[i].scrollIntoView({block:'nearest'})}
    else if(e.key==='Enter'){e.preventDefault();(items[i]||items[0])?.click()}
    else if(e.key==='Escape'){done()}
  });
  box.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;
    if(a.dataset.rid){done();return}             // the page-wide [data-rid] handler opens the card
    if(a.dataset.sall){e.preventDefault();Object.assign(SS,blankFilter(),{q:inp.value.trim()});store.set('search',SS);PAGE=1;done();go('cards');return}
    if(a.dataset.gq){e.preventDefault();const term=a.dataset.gq;done();go('glossary');setTimeout(()=>{const g=document.getElementById('gq');if(g){g.value=term;g.dispatchEvent(new Event('input'))}},60);return}
    if(a.target==='_blank'){close();return}
    done()});
  document.addEventListener('click',e=>{if(!e.target.closest('#ssearch'))close()});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!/input|textarea|select/i.test(document.activeElement.tagName)&&!document.activeElement.isContentEditable){e.preventDefault();inp.focus()}});
})();


/* Staples: worked out from the starter decks, not hand-picked. A card's share is the number of decks that run it
 (Main, Extra or Side) out of the decks counted; it is a staple at 25% or more. */
let STAPLE_SCOPE='all';
function stapleData(scope){
  const decks=scope==='top'?DECKS.filter(d=>d.tier==='A'):DECKS;
  const use=new Map();
  for(const d of decks){const counts=new Map();for(const id of [...d.main,...d.extra,...d.side])counts.set(id,(counts.get(id)||0)+1);
    for(const [id,n] of counts){const u=use.get(id)||{decks:0,copies:0};u.decks++;u.copies+=n;use.set(id,u)}}
  const rows=[...use].map(([id,u])=>({r:BYID.get(id),share:u.decks/decks.length,avg:u.copies/u.decks,decks:u.decks})).filter(x=>x.r&&x.share>=.25).sort((a,b)=>b.share-a.share||a.r.n.localeCompare(b.r.n));
  return {rows,n:decks.length};
}
function renderStaples(){
  if(!DECKS.length){app.innerHTML=noData();return}
  const {rows,n}=stapleData(STAPLE_SCOPE);
  const groups=[['Monsters',x=>isMonR(x.r)&&!isExtraR(x.r)],['Spells',x=>x.r.k==='spell'],['Traps',x=>x.r.k==='trap'],['Fusion Deck',x=>isExtraR(x.r)]];
  const card=x=>`<div class="stp">${thumb(x.r)}<div class="stbar" role="img" aria-label="In ${Math.round(x.share*100)}% of decks"><i style="width:${Math.round(x.share*100)}%"></i></div><small>${Math.round(x.share*100)}% of decks · ${x.avg.toFixed(1).replace('.0','')} ${x.avg<1.05?'copy':'copies'} avg</small></div>`;
  app.innerHTML=`<div class="pagehead"><div><h1>Staples</h1><p class="note" style="margin:4px 0 0;max-width:760px">The cards that show up across many Goat decks. Each one's share is how many of the ${n} decks counted run it (Main, Fusion or Side Deck), with the average copies those decks play. Cards in 25% or more of decks are listed.</p></div>
    <div class="chips" role="group" aria-label="Decks to count"><button class="chip ${STAPLE_SCOPE==='all'?'on':''}" data-scope="all">All ${DECKS.length} decks</button><button class="chip ${STAPLE_SCOPE==='top'?'on':''}" data-scope="top">Tier A decks only</button></div></div>
    ${groups.map(([t,f])=>{const g=rows.filter(f);return g.length?`<section class="bsec"><h2>${t} <span class="note">(${g.length})</span></h2><div class="stgrid">${g.map(card).join('')}</div></section>`:''}).join('')}
    <p class="note" style="margin-top:20px">Deck lists show how each strategy is built, so a card that only one archetype plays won't appear here even if that deck is strong. The <a href="#banlist">banlist</a> caps how many copies anyone can play.</p>${srcNote()}`;
  app.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{STAPLE_SCOPE=b.dataset.scope;renderStaples()});
}

/* Library: other creators' videos (data/library.js, hand-picked). Each links to YouTube and credits its channel. */
function renderLibrary(){
  const LIB=window.GOAT_LIBRARY;if(!LIB){app.innerHTML=noData();return}
  const fmt=n=>n>=1e6?(n/1e6).toFixed(1).replace('.0','')+'M':n>=1e3?Math.round(n/1e3)+'K':String(n);
  const vid=v=>{const c=LIB.channels[v.ch];return `<a class="vcard" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">
    <span class="vthumb"><img loading="lazy" src="img/lib/${v.id}.jpg" alt=""><span class="vlen">${v.len}</span></span>
    <b>${esc(v.t)}</b><small>${esc(c.name)} · ${fmt(v.views)} views · ${esc(v.year)}</small></a>`};
  app.innerHTML=`<div class="pagehead"><div><h1>Library</h1><p class="note" style="margin:4px 0 0;max-width:760px">Videos made by Edison creators, picked from their most viewed and most helpful guides. Every video plays on YouTube on the creator's own channel. If one helps you, give it a like and subscribe.</p></div></div>
  <div class="chgrid">${Object.values(LIB.channels).map(c=>`<a class="chcard" href="${c.url}" target="_blank" rel="noopener"><b>${esc(c.name)}</b><small>${esc(c.handle)} on YouTube ↗</small><span>${esc(c.about)}</span></a>`).join('')}</div>
  ${LIB.sections.map(sec=>`<section class="bsec"><h2>${esc(sec.title)}</h2><p class="note" style="margin:-4px 0 12px">${esc(sec.blurb)}</p><div class="vgrid">${sec.videos.map(vid).join('')}</div></section>`).join('')}
  <section class="bsec"><h2>Series to follow</h2><div class="chgrid">${LIB.series.map(x=>`<a class="chcard" href="${x.url}" target="_blank" rel="noopener"><b>${esc(x.name)}</b><small>${esc(LIB.channels[x.ch].name)} ↗</small><span>${esc(x.about)}</span></a>`).join('')}</div></section>
  <p class="srcnote">Videos, titles and thumbnails belong to their creators and are shown here to point you to them. View counts as of ${LIB.checked}.</p>`;
}

/* Rules (#rules, #rules-<section>): how Edison is played, from data/rules.js (our own words; sources credited). */
function renderRules(jump){
  const R=window.GOAT_RULES;if(!R){app.innerHTML=noData();return}
  app.innerHTML=`<div class="rules"><div class="pagehead"><div><h1>Rules</h1><p class="note" style="margin:4px 0 0;max-width:760px">How a duel works under the 2005 rules, in plain words. Start with "Goat at a glance" if you learned the game recently.</p></div></div>
  <nav class="rtoc" aria-label="Sections">${R.sections.map((x,i)=>`<a href="#rules-${x.id}" data-rj="${x.id}"><span>${i+1}</span>${esc(x.title)}</a>`).join('')}</nav>
  ${R.sections.map((x,i)=>`<section class="rsec lesson" id="r-${x.id}"><h2><span class="rn">${i+1}</span>${esc(x.title)}</h2>${x.html}<p class="rsrc">Source: ${esc(x.src)}</p></section>`).join('')}
  <p class="srcnote">Written in our own words from ${R.sources.map(s=>`<a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a> (${esc(s.note)})`).join(' and ')}. Read the full rulebook there if you want every detail. Card names are © Konami.</p></div>`;
  app.querySelectorAll('[data-rj]').forEach(a=>a.onclick=e=>{e.preventDefault();history.replaceState(null,'',keyToPath('rules-'+a.dataset.rj));document.getElementById('r-'+a.dataset.rj).scrollIntoView({behavior:'smooth',block:'start'})});
  const t=jump&&document.getElementById('r-'+jump);
  if(t)requestAnimationFrame(()=>t.scrollIntoView({block:'start'}));else window.scrollTo(0,0);
}

let BANQ='';
function renderBanlist(){
  if(!DB.length){app.innerHTML=noData();return}
  const tiers=[['F','Forbidden','0 copies: not allowed in your Main, Fusion or Side Deck.'],['L','Limited','1 copy across your Main, Fusion and Side Deck.'],['S','Semi-Limited','2 copies across your Main, Fusion and Side Deck.']];
  app.innerHTML=`<div class="pagehead"><div><h1>Banlist</h1><p class="note" style="margin:4px 0 0">The TCG Forbidden and Limited List from April 2005, the one Goat uses, unchanged. Every card not listed is allowed at 3. Source: <a href="https://www.goatformat.com/cardpool.html" target="_blank" rel="noopener">goatformat.com</a>.</p></div>
    <input type="search" id="banq" placeholder="Find a card on the list" aria-label="Find a card on the banlist" value="${esc(BANQ)}" style="min-width:min(240px,100%)"></div>
    <div id="banbody"></div>${srcNote()}`;
  const draw=()=>{const q=BANQ.toLowerCase();
    document.getElementById('banbody').innerHTML=tiers.map(([k,t,d])=>{const list=DB.filter(r=>r.b===k&&r.n.toLowerCase().includes(q)).sort((a,b)=>a.n.localeCompare(b.n));
      return `<section class="bsec"><h2><span class="badge b-${k}">${k}</span>${t} <span class="note">(${list.length}${q?` matching`:''})</span></h2><p class="note" style="margin:-4px 0 10px">${d}</p>${list.length?`<div class="cthumbs sm">${list.map(r=>thumb(r)).join('')}</div>`:'<p class="note">None match.</p>'}</section>`}).join('')};
  document.getElementById('banq').oninput=e=>{BANQ=e.target.value;draw()};draw();
}

// The rules articles on edisonformat.net, linked rather than copied.
const RULE_TOPICS=['Frequently-Asked-Questions','Does-this-card-Target','Substep-Triggers','Ryko','Major-Rulings','Battle-Phase','Both-Those-Them','Conjunctions','Damage-Step','Damage-Substeps','First-Turn-Draw','Ignition-Priority','Missing-the-Timing','Priority','SEGOC-And-Early-Trigger','Minor-Rulings','Changing-Control','End-of-Turn-Discard','Paying-Life-Points','Phase-Triggers','Prohibition','Single-Field-Spell','Trigger-Locations','Union-Monsters','Gemini-Monsters','Zero-ATK-monsters'];
let RULQ='',rulShown=40;
function renderRulings(){
  if(!DB.length){app.innerHTML=noData();return}
  const withR=DB.filter(r=>r.ru);
  app.innerHTML=`<div class="pagehead"><div><h1>Rulings</h1><p class="note" style="margin:4px 0 0">Edison rulings for ${withR.length.toLocaleString()} cards. Search by card name or by words in a ruling.</p></div>
    <input type="search" id="rulq" placeholder="Search rulings" aria-label="Search rulings" value="${esc(RULQ)}" style="min-width:min(240px,100%)"></div>
    <section class="sbox" style="margin-top:14px"><h4>Rules topics on edisonformat.net</h4><p class="note" style="margin:0">Longer write-ups on how the 2010 rules work. Lesson 10 covers the basics of priority, triggers and the Damage Step.</p>
      <div class="topics">${RULE_TOPICS.map(t=>`<a href="https://edisonformat.net/rules/compendium/${t}" target="_blank" rel="noopener">${t.replace(/-/g,' ')} ↗</a>`).join('')}</div></section>
    <div class="rcount" id="rulc" style="margin-top:16px"></div><div class="rgrid" id="rulbody"></div><div id="rulmore" style="text-align:center;margin-top:16px"></div>${srcNote()}`;
  const draw=()=>{const q=RULQ.toLowerCase();
    const list=withR.filter(r=>!q||r.n.toLowerCase().includes(q)||r.ru.toLowerCase().includes(q)).sort((a,b)=>{const an=a.n.toLowerCase().includes(q),bn=b.n.toLowerCase().includes(q);return (bn-an)||a.n.localeCompare(b.n)});
    document.getElementById('rulc').textContent=`${list.length.toLocaleString()} card${list.length===1?'':'s'}`;
    document.getElementById('rulbody').innerHTML=list.slice(0,rulShown).map(r=>`<div class="rcard"><img loading="lazy" src="${artURL(r)}" alt="" data-rid="${r.id}"><div><h3><button type="button" data-rid="${r.id}">${esc(r.n)}</button>${r.b?` <span class="badge b-${r.b}">${r.b}</span>`:''}</h3><p class="rul">${esc(r.ru)}</p></div></div>`).join('')||'<p class="note">No rulings match.</p>';
    const more=document.getElementById('rulmore');more.innerHTML=list.length>rulShown?`<button class="btn">Show more (${(list.length-rulShown).toLocaleString()} left)</button>`:'';
    if(more.firstChild)more.firstChild.onclick=()=>{rulShown+=40;draw()}};
  document.getElementById('rulq').oninput=e=>{RULQ=e.target.value;rulShown=40;draw()};draw();
}

function renderErrata(){
  const E=window.GOAT_ERRATA||[];
  app.innerHTML=`<div class="pagehead"><div><h1>Errata</h1><p class="note" style="margin:4px 0 0;max-width:720px">Card text has changed since 2010. These commonly played cards work differently in Edison than their current text says. Lesson 10 explains why.</p></div></div>
    <div class="rgrid">${E.map(e=>{const r=e.id&&BYID.get(e.id);return `<div class="rcard">${r?`<img loading="lazy" src="${artURL(r)}" alt="" data-rid="${r.id}">`:'<span></span>'}<div><h3>${r?`<button type="button" data-rid="${r.id}">${esc(e.n)}</button>`:esc(e.n)}</h3>
      <div class="lbl">How it works in Edison</div><p class="rul">${esc(e.what)}</p>${e.text?`<details style="margin-top:6px"><summary class="note" style="cursor:pointer">Edison card text</summary><p class="rul" style="margin-top:4px">${esc(e.text)}</p></details>`:''}</div></div>`}).join('')}</div>${srcNote()}`;
}

/* ============ DECK BUILDER ============ */
let BS=(()=>{const s=store.get('builder',null);return s&&s.cur?s:{cur:{name:'My deck',main:[],extra:[],side:[]},saved:{}}})();
let BF=Object.assign(blankFilter(),store.get('bfilter',{}));
var deckDirty=false;
const bsave=()=>store.set('builder',BS);
const zoneName=z=>({main:'Main Deck',extra:'Extra Deck',side:'Side Deck'})[z];
function builderCount(id){const d=BS.cur;return [...d.main,...d.extra,...d.side].filter(x=>x===id).length}
function addToDeck(id,zone){
  const r=BYID.get(+id);const d=BS.cur;if(!r)return 'Unknown card.';
  if(r.b==='F')return `${r.n} is Forbidden in Goat.`;
  if(builderCount(r.id)>=copiesAllowed(r))return `You already have ${copiesAllowed(r)} ${copiesAllowed(r)===1?'copy':'copies'}, the most allowed.`;
  if(zone==='main'&&isExtraR(r))zone='extra';
  if(zone==='extra'&&!isExtraR(r))zone='main';
  const cap={main:60,extra:15,side:15}[zone];
  if(d[zone].length>=cap)return `The ${zoneName(zone)} is full (${cap} cards).`;
  d[zone].push(r.id);bsave();deckDirty=true;return `Added ${r.n} to the ${zoneName(zone)}.`;
}
function removeFromDeck(id,zone){const a=BS.cur[zone];const i=a.indexOf(id);if(i>-1){a.splice(i,1);bsave()}}
function loadIntoBuilder(d){BS.cur={name:d.name,main:[...d.main],extra:[...d.extra],side:[...d.side]};bsave()}
function deckIssues(d){
  const out=[];
  if(d.main.length<40)out.push(`The Main Deck needs at least 40 cards (it has ${d.main.length}).`);
  if(d.main.length>60)out.push('Over 60 cards: 2005 rules allow it, but online simulators like DuelingBook stop at 60.');
  // 2005 rules set no size limit on the Fusion Deck (goatformat.com/basics.html, rule 2).
  if(d.side.length>15)out.push('The Side Deck can have at most 15 cards.');
  const all=new Map;for(const id of [...d.main,...d.extra,...d.side])all.set(id,(all.get(id)||0)+1);
  for(const [id,n] of all){const r=BYID.get(id);if(!r)continue;
    if(r.b==='F')out.push(`${r.n} is Forbidden.`);else if(n>copiesAllowed(r))out.push(`${r.n}: ${n} copies, but only ${copiesAllowed(r)} allowed.`)}
  if(d.main.some(id=>isExtraR(BYID.get(id)||{})))out.push('Fusion monsters belong in the Fusion Deck.');
  return out;
}
function bthumb(r,z,n){return `<button type="button" class="cthumb" data-bz="${z}" data-bid="${r.id}" aria-label="${esc(r.n)}, ${n} in ${zoneName(z)}"><img loading="lazy" src="${artURL(r)}" alt="">${r.b?`<span class="badge b-${r.b}">${r.b}</span>`:''}${n>1?`<span class="cnt">×${n}</span>`:''}${esc(r.n)}</button>`}
function renderBuilder(){
  if(!DB.length){app.innerHTML=noData();return}
  deckDirty=false;
  const d=BS.cur;const issues=deckIssues(d);
  const zone=z=>{const g=grouped(d[z]);const n=d[z].length;
    const range={main:'40 to 60',extra:'up to 15',side:'up to 15'}[z];
    const ok=z==='main'?n>=40&&n<=60:n<=15;
    const sub=z==='main'&&n?` · ${d.main.filter(id=>isMonR(BYID.get(id))).length} monsters, ${d.main.filter(id=>BYID.get(id).k==='spell').length} spells, ${d.main.filter(id=>BYID.get(id).k==='trap').length} traps`:'';
    return `<div><div class="zonehead"><h3>${zoneName(z)}</h3><span class="${ok?'okc':'badc'}">${n} (${range})${sub}</span></div>
      ${n?`<div class="cthumbs sm">${g.map(x=>bthumb(x.r,z,x.n)).join('')}</div>`:`<p class="note" style="margin:0">Empty.</p>`}</div>`};
  const savedNames=Object.keys(BS.saved).sort((a,b)=>a.localeCompare(b));
  app.innerHTML=`<div class="dhead"><h1 style="font-size:30px">Deck Builder</h1>
    <select id="bload" aria-label="Open a deck"><option value="">Open a deck…</option>
      ${savedNames.length?`<optgroup label="My saved decks">${savedNames.map(n=>`<option value="s:${esc(n)}">${esc(n)}</option>`).join('')}</optgroup>`:''}
      <optgroup label="All Decks">${DECKS.map(x=>`<option value="d:${esc(x.name)}">${esc(x.name)}</option>`).join('')}</optgroup></select></div>
  <div class="builder">
    <section class="bpanel" aria-label="Find cards"><b>Find cards</b>${filterForm(BF,true)}<div class="rcount" id="brc" aria-live="polite" style="margin:0"></div><div class="bres" id="bres"></div></section>
    <section class="bpanel" aria-label="Your deck">
      <div class="frow"><input type="text" id="bname" value="${esc(d.name)}" aria-label="Deck name" style="flex:1;min-width:150px">
        <button class="btn small primary" id="bsave">Save</button><button class="btn small" id="bnew">New</button>${BS.saved[d.name]?'<button class="btn small" id="bdel">Delete</button>':''}</div>
      <div class="frow"><button class="btn small" id="bimp">Import</button><button class="btn small" id="bexp">Export .ydk</button><button class="btn small" id="bhand">Test hand</button><button class="btn small" id="bclr">Clear</button></div>
      <div id="bmsg" class="note" aria-live="polite"></div>
      ${issues.length?`<ul class="issues">${issues.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`:`<p class="okc" style="margin:0">✓ This deck is legal for Goat.</p>`}
      ${zone('main')}${zone('extra')}${zone('side')}
    </section>
  </div>
  <p class="note">Tap + to add a card (Fusion monsters go to the Fusion Deck) or S for the Side Deck. Tap a card's name for its text. Tap a card in your deck to move or remove it. Decks save in this browser.</p>
  ${srcNote()}`;
  const msg=t=>{document.getElementById('bmsg').textContent=t};
  const results=()=>{
    const list=searchCards(BF);const lim=80;
    document.getElementById('brc').textContent=`${list.length.toLocaleString()} card${list.length===1?'':'s'}${list.length>lim?`, showing the first ${lim}`:''}`;
    document.getElementById('bres').innerHTML=list.slice(0,lim).map(r=>`<div class="brow"><img loading="lazy" src="${artURL(r)}" alt=""><button class="bn" data-rid="${r.id}"><b>${esc(r.n)}</b><small>${r.b?`<span class="badge b-${r.b}">${r.b}</span> `:''}${esc(shortLine(r))}</small></button><button class="btn" data-add="${r.id}" aria-label="Add ${esc(r.n)} to ${isExtraR(r)?'Extra':'Main'} Deck">+</button><button class="btn" data-side="${r.id}" aria-label="Add ${esc(r.n)} to Side Deck">S</button></div>`).join('')||'<p class="note">No cards match.</p>';
  };
  bindFilters(app.querySelector('.bpanel'),BF,()=>{store.set('bfilter',BF);results()});
  results();
  const keepScroll=f=>{const el=document.getElementById('bres');const y=el?el.scrollTop:0;const wy=window.scrollY;f();renderBuilder();const el2=document.getElementById('bres');if(el2)el2.scrollTop=y;window.scrollTo(0,wy)};
  document.getElementById('bres').onclick=e=>{
    const a=e.target.closest('[data-add]'),s=e.target.closest('[data-side]');
    if(a){let m;keepScroll(()=>{m=addToDeck(+a.dataset.add,'main')});msg(m)}
    else if(s){let m;keepScroll(()=>{m=addToDeck(+s.dataset.side,'side')});msg(m)}
  };
  app.querySelectorAll('[data-bz]').forEach(b=>b.onclick=()=>zoneActions(+b.dataset.bid,b.dataset.bz));
  document.getElementById('bname').onchange=e=>{d.name=e.target.value.trim()||'My deck';bsave()};
  document.getElementById('bsave').onclick=()=>{d.name=document.getElementById('bname').value.trim()||'My deck';BS.saved[d.name]={name:d.name,main:[...d.main],extra:[...d.extra],side:[...d.side]};bsave();renderBuilder();document.getElementById('bmsg').textContent=`Saved "${d.name}".`};
  document.getElementById('bnew').onclick=()=>{if(d.main.length+d.extra.length+d.side.length&&!BS.saved[d.name]&&!confirm('Start a new deck? This one is not saved.'))return;loadIntoBuilder({name:'New deck',main:[],extra:[],side:[]});renderBuilder()};
  const del=document.getElementById('bdel');if(del)del.onclick=()=>{if(confirm(`Delete the saved deck "${d.name}"?`)){delete BS.saved[d.name];bsave();renderBuilder()}};
  document.getElementById('bclr').onclick=()=>{if(confirm('Remove every card from this deck?')){d.main=[];d.extra=[];d.side=[];bsave();renderBuilder()}};
  document.getElementById('bexp').onclick=()=>downloadText((d.name||'deck')+'.ydk',toYDK(d));
  document.getElementById('bhand').onclick=()=>testHand(d.main);
  document.getElementById('bimp').onclick=importDeck;
  document.getElementById('bload').onchange=e=>{const v=e.target.value;if(!v)return;
    const src=v.startsWith('s:')?BS.saved[v.slice(2)]:DECKS.find(x=>x.name===v.slice(2));if(src){loadIntoBuilder(src);renderBuilder()}};
}
function zoneActions(id,z){
  const r=BYID.get(id);if(!r)return;
  const other=z==='side'?(isExtraR(r)?'extra':'main'):'side';
  const btns=[['View card',()=>setTimeout(()=>showReal(id),0)],[`Add 1 more`,()=>{const m=addToDeck(id,z);if(!m.startsWith('Added'))alert(m)}],['Remove 1',()=>removeFromDeck(id,z)],[`Move 1 to the ${zoneName(other)}`,()=>{const cap={main:60,extra:15,side:15}[other];if(BS.cur[other].length>=cap){alert(`The ${zoneName(other)} is full.`);return}removeFromDeck(id,z);BS.cur[other].push(id);bsave()}],['Remove all copies',()=>{BS.cur[z]=BS.cur[z].filter(x=>x!==id);bsave()}]];
  openModal(`<button class="closex" data-close aria-label="Close">×</button><h3>${esc(r.n)}</h3><div class="meta">${builderCount(id)} in this deck · ${esc(shortLine(r))}</div><div class="actions">${btns.map((b,i)=>`<button class="btn ${i===0?'primary':''}" data-a="${i}">${b[0]}</button>`).join('')}</div>`,el=>{
    el.querySelectorAll('[data-a]').forEach(x=>x.onclick=()=>{const f=btns[+x.dataset.a][1];closeModal();f();if(+x.dataset.a>0)renderBuilder()});
  });
}
function importDeck(){
  openModal(`<button class="closex" data-close aria-label="Close">×</button><h3>Import a deck</h3>
    <div class="meta">Paste a .ydk file (from DuelingBook, EDOPro or edisonformat.net) or a list like "3 Sangan". Or pick a .ydk file. This replaces the deck you have open.</div>
    <textarea id="impt" placeholder="#main&#10;12345678&#10;…"></textarea>
    <div class="frow" style="margin-top:8px"><input type="file" id="impf" accept=".ydk,.txt" aria-label="Pick a .ydk file"></div>
    <div class="actions"><button class="btn primary" id="impgo">Import</button></div><p class="note" id="impmsg"></p>`,el=>{
    let fname='';
    el.querySelector('#impf').onchange=e=>{const f=e.target.files[0];if(!f)return;fname=f.name.replace(/\.(ydk|txt)$/i,'');f.text().then(t=>{el.querySelector('#impt').value=t})};
    el.querySelector('#impgo').onclick=()=>{
      const {d,unknown}=parseDeck(el.querySelector('#impt').value);
      if(!d.main.length&&!d.extra.length&&!d.side.length){el.querySelector('#impmsg').textContent='No cards found. Check the text and try again.';return}
      loadIntoBuilder({name:fname||'Imported deck',...d});closeModal();renderBuilder();
      document.getElementById('bmsg').textContent=unknown.length?`Imported. ${unknown.length} line${unknown.length===1?'':'s'} not recognized (not Goat-legal or misspelled): ${unknown.slice(0,5).join(', ')}${unknown.length>5?'…':''}`:'Imported.';
    };
  });
}

/* ============ ARENA: the board layout shared by the practice board and the duel ============
 Master Duel's approach: the field covers the screen, and everything else floats over it. The arena spans the
 full window width below the site header (or the whole screen in fullscreen). The "arena stone" playmat sits in
 the middle with each side's Deck, GY, Extra Deck and Field zones beside its card rows; the hand runs along the
 bottom with every card fully visible. Overlays: the opponent's LP top-right, yours bottom-left, the action
 buttons bottom-right, the log behind a button, and a slim top bar with the title and tools. Card size comes
 from the window (fitArena) so all of it fits without scrolling. */
let LOGOPEN=false;
/* Master Duel-style interaction: tapping a card opens a small menu on the card itself, and choosing where it
 goes lights up the zones it can go to; tapping a lit zone places it. ARM holds the card being placed
 (practice board); the duel keeps the same thing in G.ui {mode:'place'}. Esc or tapping away cancels. */
let ARM=null;
function closePop(){const p=document.getElementById('apop');if(p)p.remove()}
function popMenu(anchor,title,btns,sub){
  closePop();const host=document.getElementById('arena')||document.body;
  const d=document.createElement('div');d.id='apop';d.className='apop';d.setAttribute('role','menu');d.setAttribute('aria-label',title);
  d.innerHTML=`<div class="aptitle">${esc(title)}${sub?`<small>${sub}</small>`:''}</div>${btns.map((b,i)=>`<button type="button" class="btn ${b[2]||''}" data-pa="${i}" role="menuitem">${b[0]}</button>`).join('')}`;
  host.appendChild(d);
  const r=anchor.getBoundingClientRect();const w=d.offsetWidth,h=d.offsetHeight;
  let left=r.left+r.width/2-w/2;left=Math.max(8,Math.min(left,window.innerWidth-w-8));
  let top=r.top-h-10;if(top<8)top=Math.min(window.innerHeight-h-8,r.bottom+10);
  d.style.left=left+'px';d.style.top=top+'px';
  d.querySelectorAll('[data-pa]').forEach(b=>b.onclick=e=>{e.stopPropagation();const f=btns[+b.dataset.pa][1];closePop();f()});
  const outside=e=>{if(!d.isConnected){document.removeEventListener('pointerdown',outside,true);return}if(!d.contains(e.target)){document.removeEventListener('pointerdown',outside,true);closePop()}};
  setTimeout(()=>document.addEventListener('pointerdown',outside,true),0);
  const first=d.querySelector('[data-pa]');if(first)first.focus({preventScroll:true});
}
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(document.getElementById('apop')){closePop();return}
  if(ARM&&curKey()==='simulator'){ARM=null;renderSim()}else if(typeof G!=='undefined'&&G&&G.ui&&G.ui.mode==='place'&&curKey()==='duel'){G.ui=null;renderDuel()}});
const BACK=`img/back.webp?v=${ART_V}`;
function pileZ(attrs,label,count,img,back){
  return `<button type="button" class="zone pz" ${attrs} aria-label="${label}${count!=null?`, ${count} cards`:''}">${img?`<span class="zimg" style="background-image:url('${img}')"></span>`:back&&count?`<span class="cback"></span>`:`<span class="pzicon" aria-hidden="true">${label==='GY'?'⚰':label==='Field'?'▣':label==='Banished'?'⊘':'▤'}</span>`}<span class="pcount">${label}${count!=null?` ${count}`:''}</span></button>`}
function lpPanel(who,sub,inputId,lp,isTurn,extra){
  return `<div class="lpbox ${isTurn?'turn':''}"><span class="who">${who}</span>${sub?`<span class="sub">${esc(sub)}</span>`:''}<label class="lpv"><span>LP</span><input type="number" id="${inputId}" value="${lp}" step="100" aria-label="${who} Life Points"></label>${extra||''}</div>`}
function arenaHTML(o){
  return `<div class="abar"><b class="atitle">${o.title}</b>${o.sub?`<span class="asub">${o.sub}</span>`:''}<span class="atools">${o.tools||''}<button class="abtn" id="fsbtn" type="button">${isFull()?'Exit fullscreen':'⛶ Fullscreen'}</button></span></div>
  <div class="astage">
    <div class="amat">
      <div class="ahalf opp">
        <div class="arow">${o.opp.deck}${o.oppST}${o.opp.extra}</div>
        <div class="arow">${o.opp.gy}${o.oppM}${o.opp.field}</div>
      </div>
      <div class="astrip"><span class="phase">${o.strip}</span></div>
      <div class="ahalf you">
        <div class="arow">${o.you.field}${o.youM}${o.you.gy}</div>
        <div class="arow">${o.you.extra}${o.youST}${o.you.deck}</div>
      </div>
    </div>
    <div class="ahand" aria-label="Your hand">${o.hand}</div>
  </div>
  <div class="aov lp-opp">${o.oppPanel}</div>
  <div class="aov lp-you">${o.youPanel}</div>
  <div class="aov aacts">${o.actions}<button class="abtn" id="logbtn" type="button" aria-expanded="${LOGOPEN}">${LOGOPEN?'Hide log':'Log'}</button></div>
  <div class="aov alog ${LOGOPEN?'open':''}" id="alog" aria-live="polite">${o.log}</div>${o.hint?`<div class="aov ahint" role="region" aria-label="Hint">${o.hint}</div>`:''}`;
}
const isFull=()=>{const a=document.getElementById('arena');return !!a&&(document.fullscreenElement===a||a.classList.contains('max'))};
// Re-rendering keeps the same arena element, so fullscreen survives every move.
function mountArena(inner){
  let a=document.getElementById('arena');
  if(a&&isFull())a.innerHTML=inner;else{app.innerHTML=`<div class="arena" id="arena">${inner}</div>`;a=document.getElementById('arena')}
  fitArena();const b=document.getElementById('fsbtn');if(b)b.onclick=toggleFS;
  const lb=document.getElementById('logbtn');if(lb)lb.onclick=()=>{LOGOPEN=!LOGOPEN;document.getElementById('alog').classList.toggle('open',LOGOPEN);lb.textContent=LOGOPEN?'Hide log':'Log';lb.setAttribute('aria-expanded',LOGOPEN)};
}
function toggleFS(){
  const a=document.getElementById('arena');if(!a)return;
  if(isFull()){if(document.fullscreenElement)document.exitFullscreen();a.classList.remove('max');document.body.classList.remove('noscroll');setTimeout(afterFS,60);return}
  const fallback=()=>{a.classList.add('max');document.body.classList.add('noscroll');afterFS()};
  // Some browsers (and embedded views) refuse or ignore real fullscreen: then the board fills the window instead.
  if(a.requestFullscreen){a.requestFullscreen().then(afterFS).catch(fallback);setTimeout(()=>{if(!document.fullscreenElement&&!a.classList.contains('max'))fallback()},500)}else fallback();
}
function afterFS(){const host=document.fullscreenElement||document.body;if(modal.parentNode!==host)host.appendChild(modal);fitArena();const b=document.getElementById('fsbtn');if(b)b.textContent=isFull()?'Exit fullscreen':'⛶ Fullscreen'}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement){const a=document.getElementById('arena');if(a)a.classList.remove('max');document.body.classList.remove('noscroll')}afterFS()});
function fitArena(){
  const a=document.getElementById('arena');if(!a)return;
  const narrow=window.innerWidth<820;const full=isFull();
  const top=a.getBoundingClientRect().top+window.scrollY;
  const H=full?window.innerHeight:Math.max(560,window.innerHeight-top);
  a.style.height=narrow&&!full?'auto':H+'px';
  const W=a.clientWidth;
  const bar=a.querySelector('.abar');const barH=bar?bar.offsetHeight:40;
  // Height budget: top bar, four card rows with gaps and the centre strip, then the whole hand (hand cards are 1.05x a zone).
  const byH=(H-barH-36-30-24-12)/(4*86/59+1.05*86/59*0.94);
  // Width budget: leave room for the corner overlays beside the mat.
  const side=narrow?0:192;
  const byW=(W-2*side-6*10-40)/7;
  const cw=Math.floor(Math.max(40,Math.min(narrow?(W-56)/7:Math.min(byH,byW),200)));
  a.style.setProperty('--cw',cw+'px');
  // The mat spreads across the free width: wider gaps between zones, up to about half a card.
  const gx=narrow?5:Math.round(Math.max(10,Math.min((W-2*side-44-7*cw)/6,cw*.95)));
  a.style.setProperty('--gx',gx+'px');
}
window.addEventListener('resize',()=>fitArena());

/* ============ SIMULATOR ============ */
let uid=1;
const blankSide=()=>({lp:8000,m:[null,null,null,null,null],st:[null,null,null,null,null],field:null,gy:[],ban:[],deck:[],hand:[],extra:[],deckName:''});
const TOOLBOX=['armory','catastor','android','goyo','brionac','drill','blackrose','fairy','stardust','thought','colossal','rda','mistwurm','ctfd','armormaster'];
const inst=(id,pos)=>({u:uid++,id,pos:pos||'atk'});
const PRESETS={
  empty:{label:'Empty board',build(){}},
  black:{label:'Lesson 4: Black Rose',build(s){s.you.m[1]=inst('plague');s.you.m[3]=inst('cyberdragon');s.opp.m[2]=inst('goyo');s.opp.st[1]={u:uid++,id:'bottomless',pos:'set'};s.hand=[inst('moon'),inst('mst')]}},
  sheep:{label:'Lesson 6: Scapegoat',build(s){s.you.m[0]=inst('junk');s.you.m[1]=inst('sheep','def');s.you.m[2]=inst('sheep','def');s.you.m[3]=inst('sheep','def');s.you.m[4]=inst('sheep','def');s.opp.m[2]=inst('cyberdragon')}},
  dandy:{label:'Lesson 6: Dandylion',build(s){s.hand=[inst('quickdraw'),inst('dandylion'),inst('debris'),inst('storm')];s.opp.st[0]={u:uid++,id:'oppression',pos:'set'};s.opp.m[1]=inst('raioh')}},
};
function newSim(p='empty'){const s={you:blankSide(),opp:blankSide(),hand:[],extra:TOOLBOX.map(i=>inst(i)),log:[],custom:{},turn:1,normalDone:false,rules:S0RULES()};PRESETS[p].build(s);s.log.push('Loaded: '+PRESETS[p].label);return s}
/* Practice board rules (Zack, 2026-11-17): the board starts in Free setup; "Rules: on" makes it play by the game's rules. Turns with one Normal
 Summon each, Tributes by Level, Extra Deck monsters only by Synchro Summon, no Defense-Position Normal Summons,
 position changes once a turn and not the turn a monster arrived, Traps Set first. "Free setup" turns the checks off
 for building scenarios (the lesson setups). Effects aren't automated, so anything only an effect can do is offered
 and labeled "by a card effect". */
// Free setup is the default (Zack, 2026-11-17); a reset keeps whatever the player last chose.
const S0RULES=()=>typeof S==='undefined'||!S?false:S.rules===true;
let S=store.get('sim2',null); // 'sim2': the board starts blank (older saves under 'sim' are ignored)
if(!S||!S.you){S=newSim()}else{if(S.turn==null){S.turn=1;S.normalDone=false}if(S.rules==null||!store.get('freedefault',false))S.rules=false;store.set('freedefault',true);for(const k of ['you','opp'])for(const f of ['deck','hand','extra'])if(!Array.isArray(S[k][f]))S[k][f]=[];uid=Math.max(1,...JSON.stringify(S).match(/"u":(\d+)/g)?.map(x=>+x.slice(4))||[1])+1}
let selMode=false,sel=[];
function save(){store.set('sim2',S)}
function getC(x){return C[x.id]||S.custom[x.id]||simCard(x.id)}
/* Any real card on the board: id "r<passcode>". A card the lessons already describe keeps its lesson entry
 (hand-checked Synchro rules); every other card gets its material rules read from its Edison text. */
const SIMCACHE={};
const LESSON_BY_RID=Object.fromEntries(Object.values(C).filter(c=>c.rid).map(c=>[c.rid,c.id]));
function simCard(id){
  if(typeof id!=='string'||id[0]!=='r')return null;
  if(SIMCACHE[id])return SIMCACHE[id];
  const r=BYID.get(+id.slice(1));if(!r)return null;
  const text=r.ps||r.tx||'';const first=text.split('\n')[0];
  const o={id,rid:r.id,name:r.n,text:text,kind:r.k==='ritual'?'ritual':r.k};
  if(isMonR(r)){Object.assign(o,{attr:r.a,lv:+r.lv||0,race:r.r,atk:r.atk,def:r.def,tuner:!!r.tu});
    if(r.tu&&/Synchron/.test(r.n))o.synchron=true;
    if(r.tu&&/^Blackwing/.test(r.n))o.blackwing=true;
    if(r.k==='synchro'){
      if(/"[^"]*Synchron" (Tuner|\+)|1 "Synchron" Tuner/i.test(first))o.req='synchron';
      if(/"Blackwing" Tuner/i.test(first))o.req='blackwing';
      if(/2 or more non-Tuner|2\+ non-Tuner/i.test(first))o.minNon=2;
      const nr=first.match(/non-Tuner ([A-Z][A-Za-z-]+?)(?:-Type)?(?: monsters?|s)\b/);if(nr&&RACES.includes(nr[1]))o.nonRace=nr[1];
    }
  }else o.sub=r.sub;
  return SIMCACHE[id]=o;
}
const simId=rid=>LESSON_BY_RID[rid]||'r'+rid;
function log(m){S.log.unshift(m);S.log=S.log.slice(0,30)}
const isMon=cd=>!['spell','trap'].includes(cd.kind);

function zoneHTML(side,kind,i){
  const x=S[side][kind][i];const aside=ARM&&(ARM.side||'you');
  const cls=`zone ${kind==='st'?'st':''}${ARM&&side===aside&&ARM.kind===kind&&!x?' can':''}${ARM&&ARM.kind==='trib'&&side===aside&&kind==='m'&&x?(ARM.picked.includes(x.u)?' sel':' can'):''}`;
  if(!x)return `<button class="${cls}" data-z="${side}|${kind}|${i}" aria-label="Empty ${kind==='m'?'monster':'Spell/Trap'} zone"><span class="zl">${kind==='m'?'Monster':'S/T'}</span></button>`;
  const cd=getC(x);const isSel=sel.includes(x.u);
  const def=x.pos==='def'||(x.pos==='set'&&kind==='m');
  const inner=x.pos==='set'?`<span class="facedown">${side==='you'?esc(cd.name):'Set'}</span>`:cd.rid?`<span class="zimg" style="background-image:url('${artURL({id:tokenArt(x,cd)})}')"></span>`:tileSpan(cd);
  const badges=isMon(cd)&&x.pos!=='set'&&cd.lv?`<span class="lvbadge">Lv ${cd.lv}</span>${cd.tuner?'<span class="tbadge">T</span>':''}`:'';
  return `<button class="${cls} ${def?'def':''} ${isSel?'sel':''}" data-z="${side}|${kind}|${i}" aria-label="${esc(cd.name)}">${badges}${inner}</button>`;
}
function renderSim(){
  const zones=(side,kind)=>[0,1,2,3,4].map(i=>zoneHTML(side,kind,i)).join('');
  const top=a=>{const x=a[a.length-1];const cd=x&&getC(x);return cd&&cd.rid?artURL({id:cd.rid}):null};
  const slots=side=>{const P=S[side];const f=P.field?getC(P.field):null;return {
    deck:pileZ(`data-pile="${side}|deck"`,'Deck',P.deck.length,null,true),
    gy:pileZ(`data-pile="${side}|gy"`,'GY',P.gy.length,top(P.gy)),
    extra:pileZ(`data-pile="${side}|extra"`,'Extra',side==='you'?S.extra.length:S.opp.extra.length,null,true),
    field:pileZ(`data-pile="${side}|field"`+(ARM&&ARM.kind==='field'&&side===(ARM.side||'you')?' data-can="1"':''),'Field',null,f&&f.rid?artURL({id:f.rid}):null)}};
  const hand=S.hand.length?S.hand.map(x=>{const cd=getC(x);return cd.rid?`<button type="button" class="himg${ARM&&ARM.u===x.u?' armed':''}" data-h="${x.u}" aria-label="${esc(cd.name)}" style="background-image:url('${artURL({id:cd.rid})}')"></button>`:tile(cd,'',`data-h="${x.u}"`)}).join(''):'<span class="empty">Your hand is empty. Use "+ Add to hand".</span>';
  mountArena(arenaHTML({
    title:'Practice Board',sub:'Build any hand or field. Tap an empty zone to add a card, tap a card for actions.',
    tools:`<button class="abtn" id="rulesbtn" type="button" aria-pressed="${!RULES()}" title="Free setup lets you place any card anywhere, for building scenarios">${RULES()?'Rules: on':'Free setup: on'}</button><button class="abtn" id="loaddecks" type="button">Load decks</button><select id="preset" aria-label="Load a setup">${Object.entries(PRESETS).map(([k,p])=>`<option value="${k}">${p.label}</option>`).join('')}</select><button class="btn small" id="loadp">Load</button>`,
    oppPanel:lpPanel('Opponent',S.opp.deckName,'lpo',S.opp.lp,false,`<div class="lpbtns"><button class="abtn" data-pile="opp|hand">Hand ${S.opp.hand.length}</button><button class="abtn" data-pile="opp|ban">Banished ${S.opp.ban.length}</button></div>`),
    youPanel:lpPanel('You',S.you.deckName,'lpy',S.you.lp,true,`<div class="lpbtns"><span class="lpstat">Hand ${S.hand.length}</span><button class="abtn" data-pile="you|ban">Banished ${S.you.ban.length}</button></div>`),
    opp:slots('opp'),you:slots('you'),oppST:zones('opp','st'),oppM:zones('opp','m'),youM:zones('you','m'),youST:zones('you','st'),
    strip:ARM?(ARM.kind==='trib'?`Pick ${ARM.need} monster${ARM.need>1?'s':''} to Tribute (${ARM.picked.length}/${ARM.need}) · Esc to cancel`:'Tap a glowing zone to place the card · Esc to cancel'):RULES()?`Turn ${S.turn} · ${S.normalDone?'Normal Summon used':'Normal Summon available'}`:'Free setup: rules are off',
    actions:`${selMode?synPanel():''}${RULES()?'<button class="btn primary" id="endturn">End turn</button>':''}<button class="btn ${RULES()?'':'primary'}" id="addhand">+ Add to hand</button><button class="btn ${selMode?'primary':''}" id="synbtn">${selMode?'Cancel Synchro':'⭐ Synchro Summon'}</button><button class="btn" id="tokbtn">+ Token</button><button class="btn" id="clr">Clear board</button>`,
    log:S.log.map(l=>`<div>${esc(l)}</div>`).join('')||'<div>Nothing yet.</div>',
    hand}));
  bindSim();
}
function synMats(){const out=[];for(const z of S.you.m){if(z&&sel.includes(z.u))out.push(z)}return out}
function checkSyn(mats,sx){
  const syn=getC(sx);if(syn.kind!=='synchro')return {ok:false,why:'Fusion: not a Synchro'};
  const cds=mats.map(getC);
  if(mats.some(m=>m.pos==='set'))return {ok:false,why:'Materials must be face-up'};
  const tun=cds.filter(c=>c.tuner);const non=cds.filter(c=>!c.tuner);
  if(tun.length!==1)return {ok:false,why:tun.length?'Use exactly 1 Tuner':'Needs 1 Tuner'};
  const minNon=syn.minNon||1;if(non.length<minNon)return {ok:false,why:`Needs ${minNon}+ non-Tuner${minNon>1?'s':''}`};
  const sum=cds.reduce((a,c)=>a+(c.lv||0),0);
  if(sum!==syn.lv)return {ok:false,why:`Levels total ${sum}, needs ${syn.lv}`};
  const t=tun[0];
  if(t.gyOnly)return {ok:false,why:`${t.name} only works from the GY`};
  if(syn.req==='synchron'&&!t.synchron)return {ok:false,why:'Needs a "Synchron" Tuner'};
  if(syn.req==='blackwing'&&!t.blackwing)return {ok:false,why:'Needs a "Blackwing" Tuner'};
  if(t.onlySynchron&&syn.req!=='synchron')return {ok:false,why:'Quickdraw only makes "Synchron" Synchros'};
  if(t.debris&&(syn.race!=='Dragon'||non.some(c=>c.lv===4)))return {ok:false,why:'Debris: Dragon Synchro only, no Level 4 partners'};
  if(syn.nonRace&&non.some(c=>c.race!==syn.nonRace))return {ok:false,why:`Non-Tuners must be ${syn.nonRace}s`};
  return {ok:true};
}
function synPanel(){
  const mats=synMats();const cds=mats.map(getC);
  const sum=cds.reduce((a,c)=>a+(c.lv||0),0);const tn=cds.filter(c=>c.tuner).length;
  const opts=S.extra.map(x=>({x,r:checkSyn(mats,x)})).filter(o=>getC(o.x).kind==='synchro').sort((a,b)=>(b.r.ok-a.r.ok)||(getC(a.x).lv-getC(b.x).lv));
  return `<div class="synpanel"><div class="note">Tap your face-up monsters to choose materials.</div>
  <div class="sum">${mats.length?`${cds.map(c=>c.lv).join(' + ')} = Level ${sum}`:'No materials chosen'} · ${tn} Tuner${tn===1?'':'s'}</div>
  <div class="synlist">${mats.length?opts.map(o=>{const cd=getC(o.x);return `<div class="synopt ${o.r.ok?'ok':''}"><span><b>${esc(cd.name)}</b> (Lv ${cd.lv})<small>${o.r.ok?'Ready to summon':esc(o.r.why)}</small></span>${o.r.ok?`<button class="btn small primary" data-syn="${o.x.u}">Summon</button>`:''}</div>`}).join(''):''}</div></div>`;
}
function findZone(u){for(const side of ['you','opp'])for(const k of ['m','st']){const i=S[side][k].findIndex(z=>z&&z.u===u);if(i>-1)return {side,k,i}}if(S.you.field&&S.you.field.u===u)return {side:'you',k:'field'};if(S.opp.field&&S.opp.field.u===u)return {side:'opp',k:'field'};return null}
function removeFromField(u){const z=findZone(u);if(!z)return null;let x;if(z.k==='field'){x=S[z.side].field;S[z.side].field=null}else{x=S[z.side][z.k][z.i];S[z.side][z.k][z.i]=null}return {x,z}}
function sendTo(x,owner,dest){
  const cd=getC(x);x.pos='atk';
  if(cd.kind==='token'){log(`${cd.name} vanished (tokens never leave the field).`);return}
  const toExtra=(cd.kind==='synchro'||cd.kind==='fusion')&&(dest==='hand'||dest==='deck');
  if(toExtra){(owner==='you'?S.extra:S.opp.extra).push(x);log(`${cd.name} went back to ${owner==='you'?'your':"the opponent's"} Extra Deck.`);return}
  if(dest==='gy'){S[owner].gy.push(x);log(`${cd.name} was sent to the GY.`)}
  else if(dest==='ban'){S[owner].ban.push(x);log(`${cd.name} was banished.`)}
  else if(dest==='hand'){(owner==='you'?S.hand:S.opp.hand).push(x);log(`${cd.name} returned to ${owner==='you'?'your':"the opponent's"} hand.`)}
  else if(dest==='deck'){S[owner].deck.push(x);shuffle(S[owner].deck);log(`${cd.name} was shuffled into the Deck.`)}
}
function place(side,kind,i,x){
  const cd=getC(x);
  if(kind==='field'||(cd.kind==='spell'&&cd.sub==='Field')){if(S[side].field)sendTo(S[side].field,side,'gy');S[side].field=x;return true}
  if(i==null||S[side][kind][i]){i=S[side][kind].findIndex(z=>!z)}
  if(i<0){log('No free zone there.');return false}
  S[side][kind][i]=x;return true;
}
// Load a deck for each side: the Main Deck is shuffled into the Deck zone, the Extra Deck fills the Extra zone,
// and both players can draw an opening hand. The field starts empty.
function loadDecksDialog(){
  const opts=sel=>`<option value="">No deck</option>`+deckChoices().map(c=>`<option value="${esc(c.key)}" ${c.key===sel?'selected':''}>${esc(c.name)}</option>`).join('');
  const last=store.get('simdecks',{you:'d:Blackwing',opp:'d:Vayu Turbo',hand:true});
  openModal(`<button class="closex" data-close aria-label="Close">×</button><h3>Load decks</h3><div class="meta">Each Main Deck is shuffled into its Deck zone and each Extra Deck into its Extra zone. This clears the board.</div>
    <div class="form"><label>Your deck<select id="ld-you">${opts(last.you)}</select></label><label>Opponent's deck<select id="ld-opp">${opts(last.opp)}</select></label>
    <label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="ld-hand" ${last.hand?'checked':''}> Both players draw 5 cards</label></div>
    <div class="actions"><button class="btn primary" id="ld-go">Load decks</button></div>`,el=>{
    el.querySelector('#ld-go').onclick=()=>{
      const v={you:el.querySelector('#ld-you').value,opp:el.querySelector('#ld-opp').value,hand:el.querySelector('#ld-hand').checked};store.set('simdecks',v);
      S=newSim('empty');S.extra=[];
      for(const side of ['you','opp']){const key=v[side];if(!key)continue;const d=deckChoices().find(c=>c.key===key);if(!d)continue;
        S[side].deck=shuffle(d.d.main.map(id=>inst(simId(id))));const ex=d.d.extra.map(id=>inst(simId(id)));if(side==='you')S.extra=ex;else S.opp.extra=ex;S[side].deckName=d.name;
        log(`${side==='you'?'You':'The opponent'} loaded ${d.name}.`);if(v.hand)drawCards(side,5)}
      if(!v.you)S.extra=TOOLBOX.map(i=>inst(i));
      closeModal();selMode=false;sel=[];save();renderSim();
    };
  });
}
function bindSim(){
  const after=()=>{save();renderSim()};
  document.getElementById('lpo').onchange=e=>{S.opp.lp=+e.target.value||0;save()};
  document.getElementById('lpy').onchange=e=>{S.you.lp=+e.target.value||0;save()};
  document.getElementById('loadp').onclick=()=>{S=newSim(document.getElementById('preset').value);selMode=false;sel=[];after()};
  document.getElementById('loaddecks').onclick=loadDecksDialog;
  document.getElementById('rulesbtn').onclick=()=>{S.rules=!RULES();ARM=null;log(RULES()?'Rules are on: the board follows the game rules.':'Free setup is on: place any card anywhere.');after()};
  const et=document.getElementById('endturn');if(et)et.onclick=()=>{S.turn++;S.normalDone=false;S.you.m.forEach(z=>{if(z)z.posChanged=false});S.opp.m.forEach(z=>{if(z)z.posChanged=false});log(`Turn ${S.turn} begins. Your Normal Summon is available again.`);after()};
  document.getElementById('clr').onclick=()=>{S=newSim('empty');selMode=false;sel=[];after()};
  document.getElementById('addhand').onclick=()=>picker({dest:'hand'});
  document.getElementById('tokbtn').onclick=()=>picker({dest:'you|m',tab:'tokens'});
  document.getElementById('synbtn').onclick=()=>{selMode=!selMode;sel=[];renderSim()};
  app.querySelectorAll('[data-syn]').forEach(b=>b.onclick=()=>{
    const ex=S.extra.find(x=>x.u==b.dataset.syn);const cd=getC(ex);const mats=synMats();
    const freed=S.you.m.findIndex(z=>z&&z.u===mats[0].u);
    mats.forEach(m=>{removeFromField(m.u);sendTo(m,'you','gy')});
    S.extra=S.extra.filter(x=>x!==ex);ex.pos='atk';ex.turn=S.turn;ex.posChanged=false;S.you.m[freed]=ex;
    log(`Synchro Summoned ${cd.name} using ${mats.map(m=>getC(m).name).join(' + ')}.`);
    selMode=false;sel=[];after();
  });
  app.querySelectorAll('[data-z]').forEach(b=>b.onclick=()=>{
    const [side,kind,i]=b.dataset.z.split('|');const x=S[side][kind][+i];
    if(ARM){
      if(ARM.kind==='trib'){if(side===(ARM.side||'you')&&kind==='m'&&x){ARM.picked=ARM.picked.includes(x.u)?ARM.picked.filter(u=>u!==x.u):[...ARM.picked,x.u];if(ARM.picked.length===ARM.need)tributeArmed();after()}else{ARM=null;renderSim()}return}
      if(b.classList.contains('can')){placeArmed(kind,+i);after()}else{ARM=null;renderSim()}return}
    if(selMode){if(side==='you'&&kind==='m'&&x){const cd=getC(x);if(x.pos==='set'){log('Face-down monsters cannot be Synchro Material.');renderSim();return}if(!cd.lv){return}sel=sel.includes(x.u)?sel.filter(u=>u!==x.u):[...sel,x.u];renderSim()}return}
    if(!x){if(RULES()){popMenu(b,'Empty zone',[['Turn on Free setup to place any card',()=>{S.rules=false;save();renderSim()}]],'In a game, cards come from the hand. Tap a card in your hand.');return}picker({dest:`${side}|${kind}|${i}`})}else fieldActions(x,side,kind,b);
  });
  app.querySelectorAll('[data-h]').forEach(b=>b.onclick=()=>{if(ARM&&ARM.u==b.dataset.h){ARM=null;renderSim();return}ARM=null;handActions(S.hand.find(x=>x.u==b.dataset.h),b)});
  app.querySelectorAll('[data-pile]').forEach(b=>b.onclick=()=>{if(ARM&&b.dataset.can){placeArmed('field');after();return}if(ARM){ARM=null;renderSim();return}pileView(...b.dataset.pile.split('|'))});
  const st=document.querySelector('.astrip .phase');if(st)st.classList.toggle('hint',!!ARM);
}
function sheetBtns(title,sub,btns,anchor){
  // On a wide screen the menu opens on the card itself; on a phone it's a sheet.
  if(anchor&&window.innerWidth>=820){popMenu(anchor,title,btns.map(b=>[b[0],()=>{b[1]();save();renderSim()},b[2]]),sub);return}
  openModal(`<button class="closex" data-close aria-label="Close">×</button><h3>${esc(title)}</h3><div class="meta">${sub}</div><div class="actions">${btns.map((b,i)=>`<button class="btn ${b[2]||''}" data-a="${i}">${b[0]}</button>`).join('')}</div>`,el=>{
    el.querySelectorAll('[data-a]').forEach(x=>x.onclick=()=>{const f=btns[+x.dataset.a][1];closeModal();f();save();renderSim()});
  });
}
function readBtn(cd){return ['🔍 Enlarge card',()=>setTimeout(()=>showCard(cd.id,cd),0)]}
const RULES=()=>S.rules===true;
const isExtraCd=cd=>cd.kind==='synchro'||cd.kind==='fusion';
// Summon rules are read from the card's Edison text (the course's own summaries are plain English).
const realText=cd=>{const r=cd.rid&&BYID.get(cd.rid);return r?(r.ps||r.tx||''):(cd.text||'')};
const noNormal=cd=>/Cannot be Normal Summon|Must (first )?be Special Summoned/i.test(realText(cd));
const selfSummon=cd=>/Special Summon this card|Special Summon it|Must (first )?be Special Summoned/i.test(realText(cd))&&!isExtraCd(cd);
const tribsFor=cd=>cd.lv>=7?2:cd.lv>=5?1:0;
const byEffect=t=>RULES()?`${t} (by a card effect)`:t;
function fieldActions(x,side,kind,anchor){
  const cd=getC(x);const mon=kind==='m';const rules=RULES();const mine=side==='you';
  const b=[readBtn(cd)];let sub=`${mine?'Your':'Opponent\'s'} ${mon?'monster':'Spell/Trap'}${cd.lv?` · Level ${cd.lv}`:''}${cd.tuner?' · Tuner':''}`;
  if(mon){
    const fresh=x.turn===S.turn;const canMove=!rules||(mine&&!fresh&&!x.posChanged);
    if(x.pos==='set'){
      if(canMove)b.push(['Flip Summon',()=>{x.pos='atk';x.posChanged=true;log(`${cd.name} was Flip Summoned. Apply its FLIP effect if it has one.`)},'primary']);
      else if(rules&&mine)sub+=fresh?' · Set this turn: Flip Summon next turn':' · Already changed position this turn';
    }else if(canMove){
      b.push([x.pos==='atk'?'Switch to Defense':'Switch to Attack',()=>{x.pos=x.pos==='atk'?'def':'atk';x.posChanged=true;log(`${cd.name} is now in ${x.pos==='atk'?'Attack':'Defense'} Position.`)}]);
    }else if(rules&&mine)sub+=fresh?' · Arrived this turn: can change position next turn':' · Already changed position this turn';
    if(rules&&!mine)sub+=' · The opponent decides its position';
    if(x.pos!=='set')b.push([byEffect('Turn face-down'),()=>{x.pos='set';log(`${cd.name} was turned face-down.`)}]);
    if(!rules&&x.pos!=='set')b.push([x.pos==='atk'?'Set to Defense':'Set to Attack',()=>{x.pos=x.pos==='atk'?'def':'atk'}]);
    const other=mine?'opp':'you';
    b.push([byEffect(mine?'Give control to the opponent':'Take control'),()=>{removeFromField(x.u);if(!place(other,'m',null,x))place(side,'m',null,x);else log(`${cd.name} changed control.`)}]);
  }else{
    if(x.pos==='set'){
      const trapWait=rules&&x.turn===S.turn&&(cd.kind==='trap'||cd.sub==='Quick-Play');
      if(!trapWait)b.push(['Activate',()=>{x.pos='atk';log(`${cd.name} was activated. Apply its effect, then send it to the GY unless it stays on the field.`)},'primary']);
      else sub+=' · Set this turn: activate it from the next turn';
    }else if(!rules)b.push(['Set face-down',()=>{x.pos='set';log(`${cd.name} was Set.`)}]);
  }
  b.push([rules?'Send to GY (resolved or destroyed)':'Destroy / send to GY',()=>{removeFromField(x.u);sendTo(x,side,'gy')}]);
  b.push([byEffect('Banish'),()=>{removeFromField(x.u);sendTo(x,side,'ban')}]);
  b.push([byEffect('Return to hand'),()=>{removeFromField(x.u);sendTo(x,side,'hand')}]);
  sheetBtns(cd.name,sub,b,anchor);
}
function handActions(x,anchor){
  const cd=getC(x);const take=()=>{S.hand=S.hand.filter(h=>h!==x)};
  const arm=(mode,kind,extra)=>()=>{ARM=Object.assign({u:x.u,mode,kind,side:'you'},extra||{});renderSim()};
  const b=[];let sub='In your hand';
  if(isMon(cd)){
    if(!RULES())b.push(['Summon (Attack)',arm('atk','m'),'primary'],['Summon (Defense)',arm('def','m')],['Set face-down',arm('set','m')]);
    else{
      const need=tribsFor(cd);const mine=S.you.m.filter(Boolean).length;
      if(noNormal(cd))sub='Can’t be Normal Summoned';
      else if(S.normalDone)sub='Normal Summon already used this turn';
      else if(need&&mine<need)sub=`Needs ${need} Tribute${need>1?'s':''}: you control ${mine} monster${mine===1?'':'s'}`;
      else if(need)b.push([`Tribute Summon (${need})`,arm('atk','trib',{need,picked:[]}),'primary'],[`Tribute Set (${need})`,arm('set','trib',{need,picked:[]})]);
      else b.push(['Normal Summon',arm('atk','m',{normal:true}),'primary'],['Set face-down',arm('set','m',{normal:true})]);
      if(selfSummon(cd))b.push(['Special Summon by its own effect (check its condition)',arm('atk','m')]);
    }
  }
  else if(cd.sub==='Field')b.push(['Activate in the Field Zone',arm('atk','field'),'primary']);
  else if(cd.kind==='trap')b.push(['Set face-down',arm('set','st'),'primary'],...(RULES()?[]:[['Activate',arm('atk','st')]]));
  else b.push(['Activate',arm('atk','st'),'primary'],['Set face-down',arm('set','st')]);
  b.push([byEffect('Discard to GY'),()=>{take();S.you.gy.push(x);log(`Discarded ${cd.name}.`);if(x.id==='dandylion'){addTokens('fluff',2)}}]);
  b.push([byEffect('Banish'),()=>{take();S.you.ban.push(x);log(`Banished ${cd.name} from hand.`)}]);
  if(!RULES())b.push(['Remove from hand',()=>{take();log(`Removed ${cd.name}.`)}]);
  b.push(readBtn(cd));
  sheetBtns(cd.name,sub,b,anchor);
}
// Place the armed hand card in the zone the player tapped.
function placeArmed(kind,i){
  const side=ARM.side||'you';const hand=side==='you'?S.hand:S.opp.hand;
  const x=hand.find(h=>h.u===ARM.u);if(!x){ARM=null;return}const cd=getC(x);const mode=ARM.mode;
  hand.splice(hand.indexOf(x),1);x.pos=mode;x.turn=S.turn;x.posChanged=false;if(ARM.normal&&side==='you')S.normalDone=true;
  if(kind==='field'){if(S.you.field)sendTo(S.you.field,'you','gy');S.you.field=x;log(`Activated ${cd.name} in the Field Zone.`)}
  else{S[side][kind][i]=x;const who=side==='you'?'You':'The opponent';log(kind==='m'?(mode==='set'?`${who} Set a monster.`:`${who} summoned ${cd.name}.`):(mode==='set'?`${who} Set a card.`:`${who} activated ${cd.name}.`))}
  ARM=null;
}
// Tribute Summon: the picked monsters go to the GY and the new monster takes the first freed zone.
function tributeArmed(){
  const side=ARM.side||'you';const hand=side==='you'?S.hand:S.opp.hand;const x=hand.find(h=>h.u===ARM.u);if(!x){ARM=null;return}
  const cd=getC(x);const P=S[side];let zi=-1;
  ARM.picked.forEach(u=>{const k=P.m.findIndex(z=>z&&z.u===u);if(zi<0)zi=k;const y=P.m[k];P.m[k]=null;sendTo(y,side,'gy')});
  hand.splice(hand.indexOf(x),1);x.pos=ARM.mode;x.turn=S.turn;x.posChanged=false;P.m[zi]=x;if(side==='you')S.normalDone=true;
  log(`${side==='you'?'You':'The opponent'} Tribute ${ARM.mode==='set'?'Set a monster':'Summoned '+cd.name}.`);ARM=null;
}
function addTokens(id,n){let made=0;for(let k=0;k<n;k++){if(place('you','m',null,inst(id,'def')))made++}if(made)log(`${C[id].name} ×${made} appeared${id==='fluff'?' from Dandylion':''}.`)}
// Cards shown as their art in a grid (pile views, the card picker): a card without art keeps its drawn tile.
function artGrid(items,attr){
  return `<div class="pick-grid">${items.map(({key,cd})=>`<button type="button" class="pick-c" ${attr}="${key}" aria-label="${esc(cd.name)}">${cd.rid?`<span class="pimg" style="background-image:url('${artURL({id:cd.rid})}')"></span>`:`<span class="pimg ptile">${tileSpan(cd)}</span>`}<small>${esc(cd.name)}</small></button>`).join('')}</div>`}
function pileList(side,p){return p==='extra'?(side==='you'?S.extra:S.opp.extra):p==='hand'?S.opp.hand:S[side][p]}
function drawCards(side,n){const P=S[side];let k=0;for(;k<n&&P.deck.length;k++){const x=P.deck.pop();(side==='you'?S.hand:P.hand).push(x)}log(`${side==='you'?'You':'The opponent'} drew ${k} card${k===1?'':'s'}.`)}
function pileView(side,p){
  if(p==='field'){const f=S[side].field;if(f)fieldActionsField(f,side);else picker({dest:`${side}|field`});return}
  const list=pileList(side,p);const names={gy:'Graveyard',ban:'Banished',extra:'Extra Deck',deck:'Deck',hand:'hand'};
  const who=side==='you'?'Your':"Opponent's";
  const shown=p==='deck'?[...list].sort((a,b)=>getC(a).name.localeCompare(getC(b).name)):list;
  const tools=p==='deck'?`<div class="actions" style="grid-template-columns:repeat(3,1fr)"><button class="btn" data-dk="1">Draw 1</button><button class="btn" data-dk="5">Draw 5</button><button class="btn" data-dk="shuffle">Shuffle</button></div>`:p==='extra'?'<div class="actions"><button class="btn" id="addex">+ Add a card to the Extra Deck</button></div>':'';
  openModal(`<button class="closex" data-close aria-label="Close">×</button><h3>${who} ${names[p]} (${list.length})</h3><div class="meta">${p==='deck'?'Shown in name order. Tap a card to move it.':'Tap a card to move it.'}</div>${tools}
  ${list.length?artGrid(shown.map(x=>({key:x.u,cd:getC(x)})),'data-u'):'<p class="note">Empty.</p>'}`,el=>{
    el.classList.add('wide');
    el.querySelectorAll('[data-dk]').forEach(b=>b.onclick=()=>{const v=b.dataset.dk;closeModal();if(v==='shuffle'){shuffle(S[side].deck);log(`${who} Deck was shuffled.`)}else drawCards(side,+v);save();renderSim()});
    el.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>{
      const x=list.find(y=>y.u==b.dataset.u);const cd=getC(x);const take=()=>{const i=list.indexOf(x);list.splice(i,1)};
      const ex=cd.kind==='synchro'||cd.kind==='fusion';const btns=[readBtn(cd)];
      if(p==='hand'){ // the opponent's hand: play it like your own
        if(isMon(cd)&&!ex){const need=RULES()?tribsFor(cd):0;
          if(need){const have=S.opp.m.filter(Boolean).length;if(have>=need)btns.push([`Tribute Summon (${need})`,()=>{ARM={u:x.u,mode:'atk',kind:'trib',side:'opp',need,picked:[]}},'primary'],[`Tribute Set (${need})`,()=>{ARM={u:x.u,mode:'set',kind:'trib',side:'opp',need,picked:[]}}]);}
          else btns.push(['Summon in Attack Position',()=>{ARM={u:x.u,mode:'atk',kind:'m',side:'opp'}},'primary'],['Set face-down',()=>{ARM={u:x.u,mode:'set',kind:'m',side:'opp'}}])}
        else if(!isMon(cd)){if(!(RULES()&&cd.kind==='trap'))btns.push(['Activate',()=>{ARM={u:x.u,mode:'atk',kind:cd.sub==='Field'?'field':'st',side:'opp'}},'primary']);btns.push(['Set face-down',()=>{ARM={u:x.u,mode:'set',kind:'st',side:'opp'}}])}
        btns.push(['Discard to GY',()=>{take();S[side].gy.push(x);log(`The opponent discarded ${cd.name}.`)}],['Return to Deck',()=>{take();S[side].deck.push(x);shuffle(S[side].deck);log('A card went back into the opponent\'s Deck.')}]);
      }else{
        if(p==='extra'&&RULES()){
          if(cd.kind==='synchro'&&side==='you')btns.push(['Synchro Summon with monsters on the field',()=>{selMode=true;sel=[];log(`Pick a Tuner and non-Tuners whose Levels add up to ${cd.lv} for ${cd.name}.`)},'primary']);
          else if(cd.kind==='fusion')btns.push(['Needs Polymerization or its own summon rule: use Free setup',()=>{}]);
        }else if(isMon(cd)&&(p!=='deck'||!ex))btns.push([p==='extra'?'Special Summon to the field':byEffect('Special Summon'),()=>{take();x.pos='atk';x.turn=S.turn;x.posChanged=false;if(place(side,'m',null,x))log(`Special Summoned ${cd.name} from the ${names[p]}.`);else list.push(x)},'primary']);
        if(p!=='extra'&&!ex)btns.push(['Add to hand',()=>{take();(side==='you'?S.hand:S.opp.hand).push(x);log(`${cd.name} was added to ${side==='you'?'your':"the opponent's"} hand.`)}]);
        if(p!=='gy')btns.push(['Send to GY',()=>{take();S[side].gy.push(x);log(`${cd.name} was sent to the GY.`)}]);
        if(p!=='ban')btns.push(['Banish',()=>{take();S[side].ban.push(x);log(`${cd.name} was banished.`)}]);
      }
      btns.push(['Remove',()=>{take();log(`Removed ${cd.name}.`)}]);
      sheetBtns(cd.name,`${who} ${names[p]}`,btns);
    });
    const ad=el.querySelector('#addex');if(ad)ad.onclick=()=>picker({dest:side==='you'?'extra':'oppextra',tab:'synchro'});
  });
}
function fieldActionsField(x,side){const cd=getC(x);sheetBtns(cd.name,'Field Spell',[['Send to GY',()=>{S[side].field=null;sendTo(x,side,'gy')}],readBtn(cd)])}
function picker(opt){
  let tab=opt.tab||'all',q='';
  const destLabel=d=>{if(d==='hand')return 'your hand';if(d==='extra')return 'your Extra Deck';if(d==='oppextra')return "the opponent's Extra Deck";const [s,k]=d.split('|');return `${s==='you'?'your':'the opponent\'s'} ${k==='m'?'monster zone':k==='st'?'Spell/Trap zone':'Field Zone'}`};
  openModal(`<button class="closex" data-close aria-label="Close">×</button><h3>Add a card</h3><div class="meta">Goes to ${destLabel(opt.dest)}.</div>
  <input type="search" id="pq" placeholder="Search cards" aria-label="Search cards" style="width:100%">
  <div class="tabs" id="ptabs">${[['all','All'],['monster','Monsters'],['tuner','Tuners'],['synchro','Synchros'],['spell','Spells'],['trap','Traps'],['tokens','Tokens'],['custom','Custom card']].map(([k,t])=>`<button class="chip ${k===tab?'on':''}" data-t="${k}">${t}</button>`).join('')}</div>
  <div id="pbody"></div>`,el=>{
    const body=el.querySelector('#pbody');el.classList.add('wide');
    const add=id=>{
      const x=inst(id);const cd=getC(x);closeModal();
      if(opt.dest==='hand'){S.hand.push(x);log(`Added ${cd.name} to your hand.`)}
      else if(opt.dest==='extra'){S.extra.push(x);log(`Added ${cd.name} to your Extra Deck.`)}
      else if(opt.dest==='oppextra'){S.opp.extra.push(x);log(`Added ${cd.name} to the opponent's Extra Deck.`)}
      else{const [s,k,i]=opt.dest.split('|');let kind=k;if(k==='field')kind='field';else if(isMon(cd))kind='m';else kind='st';
        if(cd.kind==='token'){x.pos='def'}
        if(kind==='st'&&s==='opp')x.pos='set';
        if(place(s,kind,kind===k?(i!=null?+i:null):null,x))log(`Placed ${cd.name} on ${s==='you'?'your':'the opponent\'s'} field.`)}
      save();renderSim();
    };
    function draw(){
      if(tab==='custom'){
        body.innerHTML=`<form class="form" id="cform"><label for="cn">Name<input type="text" id="cn" required placeholder="My monster"></label>
        <div class="two"><label for="ck">Kind<select id="ck"><option value="effect">Monster</option><option value="tuner">Tuner monster</option><option value="synchro">Synchro (goes to Extra Deck)</option><option value="spell">Spell</option><option value="trap">Trap</option></select></label>
        <label for="cl">Level<input type="number" id="cl" min="1" max="12" value="4"></label></div>
        <div class="two"><label for="ca">ATK<input type="number" id="ca" value="1500" step="100"></label><label for="cd">DEF<input type="number" id="cd" value="1000" step="100"></label></div>
        <label for="cat">Attribute<select id="cat">${['DARK','LIGHT','EARTH','WATER','FIRE','WIND'].map(a=>`<option>${a}</option>`).join('')}</select></label>
        <button class="btn primary" type="submit">Add card</button></form>`;
        body.querySelector('#cform').onsubmit=e=>{e.preventDefault();
          const k=body.querySelector('#ck').value;const id='x'+(uid++);
          const base={id,name:body.querySelector('#cn').value.trim()||'Custom card',text:'Custom card made on the practice board.'};
          if(k==='spell'||k==='trap')Object.assign(base,{kind:k,sub:'Normal'});
          else Object.assign(base,{kind:k==='tuner'?'effect':k,tuner:k==='tuner',lv:+body.querySelector('#cl').value||1,atk:+body.querySelector('#ca').value||0,def:+body.querySelector('#cd').value||0,attr:body.querySelector('#cat').value,race:'Custom'});
          S.custom[id]=base;
          if(k==='synchro'&&opt.dest!=='extra'){opt.dest='extra'}
          add(id);
        };return;
      }
      if(tab==='tokens'){
        body.innerHTML=`<div class="pick-list">${['fluff','sheep'].map(id=>`<button class="pick" data-id="${id}"><span class="dot" style="background:${FRAME.token[0]}"></span>${C[id].name}<small>Lv 1 · 0/0</small></button>`).join('')}</div>
        <form class="form" id="tform" style="margin-top:10px"><div class="two"><label for="tl">Custom token Level<input type="number" id="tl" min="1" max="12" value="1"></label><label for="ta">ATK<input type="number" id="ta" value="0" step="100"></label></div><button class="btn" type="submit">Add custom token</button></form>`;
        body.querySelector('#tform').onsubmit=e=>{e.preventDefault();const id='x'+(uid++);const lv=+body.querySelector('#tl').value||1;const atk=+body.querySelector('#ta').value||0;S.custom[id]={id,name:`Token (Lv ${lv})`,kind:'token',lv,atk,def:0,attr:'EARTH',race:'Token',text:'A custom token.'};add(id)};
      }else{
        // Every Goat-legal card. With no search, the lesson cards come first so the usual pieces are one tap away.
        const f=Object.assign(blankFilter(),{q,kind:{monster:'main',spell:'spell',trap:'trap',synchro:'extra'}[tab]||'',ab:tab==='tuner'?'Tuner':''});
        if(tab==='monster')f.kind='monster';
        let list=searchCards(f).filter(r=>tab!=='monster'||!isExtraR(r));
        if(!q){const les=new Set(Object.keys(LESSON_BY_RID).map(Number));list=[...list.filter(r=>les.has(r.id)),...list.filter(r=>!les.has(r.id))]}
        const lim=60;
        body.innerHTML=`<p class="note" style="margin:4px 0 0">${list.length.toLocaleString()} card${list.length===1?'':'s'}${list.length>lim?`. Showing ${lim}: type to narrow it down.`:''}</p>${artGrid(list.slice(0,lim).map(r=>{const cd=getC({id:simId(r.id)});return {key:cd.id,cd}}),'data-id')||'<p class="note">No match. Try the Custom card tab.</p>'}`;
      }
      body.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>add(b.dataset.id));
    }
    el.querySelector('#pq').oninput=e=>{q=e.target.value;if(tab==='custom'||tab==='tokens'){tab='all';el.querySelectorAll('#ptabs .chip').forEach(x=>x.classList.toggle('on',x.dataset.t==='all'))}draw()};
    el.querySelector('#ptabs').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;tab=b.dataset.t;el.querySelectorAll('#ptabs .chip').forEach(x=>x.classList.toggle('on',x===b));draw()};
    draw();
  });
}

/* ============ DUEL THE COMPUTER (on the rules engine, 2026-11-20) ============
 The duel runs on js/engine.js: every rule and every scripted card effect is automatic. The page only shows the
 board and answers the engine's prompts: your free actions (tap a card for its menu), responses (Activate or Pass),
 picks (tap the glowing cards), and yes/no or option choices (buttons). The computer (js/ai.js) answers its own
 prompts, a short pause apart so you can follow. Cards from decks beyond the 5 Best decks may play without their
 effect until they are scripted; the setup screen marks which decks are fully automated. */
const DIFFS={easy:['Easy','Often plays at random and walks into traps.'],normal:['Normal','Tries every play it has and picks the one that leaves it best off.'],hard:['Hard','Also looks a move further ahead and attacks carefully into Set cards.']};
let G=null;
let DSET=Object.assign({you:'d:Blackwing',cpu:'random',diff:'normal',first:'random'},store.get('duelsetup',{}));
const dnum=v=>{const x=parseInt(v,10);return isNaN(x)?0:x};
const dAtk=x=>dnum(getC(x).atk),dDef=x=>dnum(getC(x).def);
const isMonC=cd=>!['spell','trap'].includes(cd.kind);
const tribNeeded=cd=>cd.lv>=7?2:cd.lv>=5?1:0;
const freeZone=a=>a.findIndex(z=>!z);
const EG=()=>window.EdisonEngine;
let ENGINE_READY=false;
function engineReady(){if(!ENGINE_READY&&window.EdisonEngine){EG().init(DB);ENGINE_READY=true}return ENGINE_READY}
function deckChoices(){const saved=Object.values(BS.saved||{}).filter(d=>d.main.length>=20).map(d=>({key:'s:'+d.name,name:d.name+' (yours)',d}));return [...saved,...DECKS.map(d=>({key:'d:'+d.name,name:d.name,d}))]}
const deckAuto=d=>engineReady()&&[...d.main,...(d.extra||[])].every(id=>{const r=BYID.get(id);return !r||EG().scripted(r.n)});
function pickDeck(key){const all=deckChoices();if(key==='random'){const auto=all.filter(c=>c.key.startsWith('d:')&&deckAuto(c.d));const pool=auto.length?auto:all.filter(c=>c.key.startsWith('d:'));return pool[Math.floor(Math.random()*pool.length)]}return all.find(c=>c.key===key)||all.find(c=>c.key.startsWith('d:'))}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function startDuel(){
  engineReady();
  const you=pickDeck(DSET.you),cpu=pickDeck(DSET.cpu);
  const first=DSET.first==='you'?0:DSET.first==='cpu'?1:Math.round(Math.random());
  const g=EG().newDuel({decks:[{name:you.name,main:you.d.main,extra:you.d.extra||[]},{name:cpu.name,main:cpu.d.main,extra:cpu.d.extra||[]}],first,names:['You','The computer']});
  G={g,level:DSET.diff,sel:[],hint:false,lastTurn:0,busy:false,auto:[deckAuto(you.d),deckAuto(cpu.d)]};
  duelStep();
}
/* Run the computer's prompts, a short pause apart; stop on the player's prompt. */
function duelStep(){
  if(!G)return;const g=G.g;
  if(G.lastTurn!==g.turnNo){G.hint=false;G.lastTurn=g.turnNo}
  clearTimeout(G.timer);
  if(g.prompt&&g.prompt.p===1){G.busy=true;renderDuel();const mine=G;
    G.timer=setTimeout(()=>{if(G!==mine)return;let k;try{k=EdisonAI.decide(g,1,G.level)}catch(e){console.error(e);k=[g.prompt.opts.find(o=>o.key==='pass'||o.key==='end'||o.key==='endbp')?.key||g.prompt.opts[0].key]}
      EG().act(g,k);duelStep()},g.prompt.type==='idle'?650:450);return}
  G.busy=false;renderDuel();
}
function duelAct(keys){if(!G||G.busy)return;closePop();if(modal.innerHTML)closeModal();G.sel=[];EG().act(G.g,keys);duelStep()}
const eFind=u=>{const g=G.g;for(const P of g.p)for(const z of ['hand','m','st','gy','ban','deck','extra'])for(const c of P[z])if(c&&c.u===u)return c;if(g.p[0].fz&&g.p[0].fz.u===u)return g.p[0].fz;if(g.p[1].fz&&g.p[1].fz.u===u)return g.p[1].fz;return null};
const TOKEN_ART={'tok-sheep':73915052,'tok-sheep-token':73915052,'tok-gorz':44330099,'tok-emissary-of-darkness-token':44330099,'tok-fluff-token':15341822};
const eNoArt=c=>typeof c.id==='string'&&c.id.startsWith('tok-')&&!TOKEN_ART[c.id];
const eArt=c=>{if(eNoArt(c))return BACK;const id=TOKEN_ART[c.id]||c.id;const r=BYID.get(id);if(r&&r.arts)return artURL({id:r.arts[c.u%r.arts.length]});return artURL({id})};
const eShow=c=>{if(eNoArt(c))return;const id=TOKEN_ART[c.id]||c.id;if(BYID.has(id))setTimeout(()=>showReal(id),0)};
/* ---- turn hints (Zack, 2026-11-17: "tooltips each turn that the player can reveal to see what they should do") ----
 The hint panel reads the engine's position through a small view (hintView) shaped like the first duel's state, so
 the teaching steps below work unchanged; it also shows the play the computer itself would pick in your seat. */
let HG=null;
function hintView(){
  const g=G.g;const pr=g.prompt;
  const conv=c=>c&&({u:c.u,id:simId(TOKEN_ART[c.id]||c.id),pos:c.pos==='up'?'atk':c.pos,turn:c.turnIn,attacked:c.attacks>0,posChanged:c.posChanged});
  const side=P=>({lp:P.lp,hand:P.hand.map(conv),m:P.m.map(conv),st:P.st.map(conv),gy:P.gy.map(conv),extra:P.extra.map(conv),deck:P.deck});
  return {p:[side(g.p[0]),side(g.p[1])],phase:g.phase,turnNo:g.turnNo,normalDone:g.ns[0]>=1,ui:pr&&pr.type==='pick'&&/hand limit/.test(pr.text)?{mode:'discard'}:null};
}
const dText=x=>{const cd=getC(x);const r=cd.rid&&BYID.get(cd.rid);return (r&&(r.ps||r.tx))||cd.text||''};
const dAttr=x=>{const cd=getC(x);const r=cd.rid&&BYID.get(cd.rid);return cd.attr||(r&&r.a)||''};
const dNm=x=>getC(x).name;
const canNormalC=x=>{const cd=getC(x);return isMonC(cd)&&!['synchro','fusion','token'].includes(cd.kind)&&!/Cannot be Normal Summoned/i.test(dText(x))};
const selfSS=x=>/Special Summon this card \(from your hand\)|Must (first )?be Special Summoned \(from your hand\)|You can Special Summon this card(?! from your (GY|Graveyard))|If you take battle damage while this card is in your hand: You can Special Summon it/i.test(dText(x));
const isFlip=x=>/^\s*①?\s*FLIP:/m.test(dText(x));
const HOLD=['Gorz the Emissary of Darkness','Tragoedia','Battle Fader','Necro Gardna','Honest'];
const HTIPS={
 'Mystical Space Typhoon':'A Quick-Play. Set it and you can use it on their turn too (not the turn you Set it), for example on a card they just flipped.',
 'Heavy Storm':'Destroys every Spell and Trap on the field, yours included. Best when they have more Set cards than you.',
 'Giant Trunade':'Returns every Spell and Trap to its owner’s hand, yours too. After it resolves, Set your own cards again.',
 'Solemn Judgment':'Costs half your LP. Save it for the summon or card that would swing the duel.',
 'Mirror Force':'When one of their monsters attacks, all their Attack Position monsters are destroyed. Set it and wait.',
 'Torrential Tribute':'Destroys every monster on the field when a monster is summoned. Best when they have more monsters than you.',
 'Bottomless Trap Hole':'Destroys and banishes a monster with 1500 or more ATK as it is summoned, so it can’t come back from the GY.',
 'Dimensional Prison':'Banishes the monster that attacks.',
 'Trap Dustshoot':'Only works while they hold 4 or more cards, so it is strongest early in the duel.',
 'Book of Moon':'Turns a face-up monster face-down. It stops an attack, or turns their big monster into a Defense Position target for your attack.',
 'Call of the Haunted':'Brings back a monster from your GY in Attack Position. A strong monster or a Tuner for a Synchro is the usual pick.',
 'Starlight Road':'Stops a card that would destroy 2 or more of your cards, like Heavy Storm or Torrential Tribute, and can bring out Stardust Dragon.',
 'Brain Control':'Pay 800 LP to take a face-up monster until the End Phase. Attack with it, then Tribute it or use it for a Synchro so it never goes back.',
 'Mind Control':'Takes a monster until the End Phase. It can’t attack or be Tributed, but it is off their field while you attack.',
 'Smashing Ground':'Destroys their face-up monster with the highest DEF. You don’t pick a target, so check which one that is.',
 'Allure of Darkness':'Draw 2, then banish a DARK from your hand. With no DARK in hand you lose your whole hand, so check first.',
 'Upstart Goblin':'Draws 1 card and gives them 1000 LP.',
 'Pot of Avarice':'Needs 5 monsters in your GY. Shuffles them back and draws 2.',
 'Gold Sarcophagus':'The card you banish comes to your hand in your second Standby Phase after this. Pick a card you will want then.',
 'Dust Tornado':'A Trap: destroy one of their Spells or Traps, then you can Set a card from your hand.',
 'Compulsory Evacuation Device':'A Trap that returns a monster to the hand. A Synchro sent back goes to the Extra Deck instead.',
 'Royal Oppression':'Either player can pay 800 LP to stop a Special Summon. Strong against decks that Special Summon a lot.',
 'Gorz the Emissary of Darkness':'Keep it in your hand. When their card deals you damage while you control no cards, it can come out for free.',
 'Tragoedia':'Keep it in your hand. When you take battle damage it can come out, and it gains 600 ATK and DEF for each card in your hand.',
 'Battle Fader':'Keep it in your hand. When they attack you directly, it comes out and ends the Battle Phase.',
 'Necro Gardna':'Its effect works from the GY: on their turn, banish it to stop one attack. Discarding it is fine.',
 'Caius the Shadow Monarch':'Tribute Summon it to banish any card on the field, with 1000 damage if that card is a DARK monster.',
 'Sangan':'When it goes from the field to the GY you add a monster with 1500 or less ATK from your Deck. Losing it in battle is a fair trade.',
 'Dark Armed Dragon':'Needs exactly 3 DARKs in your GY to Special Summon. Then it can banish a DARK from your GY to destroy any card.',
 'Cyber Dragon':'If only your opponent controls a monster, Special Summon it from your hand. It doesn’t use your Normal Summon.',
 'Chaos Sorcerer':'Special Summon it by banishing a LIGHT and a DARK monster from your GY. It can banish a face-up monster, but then it can’t attack that turn.',
 'Card Trooper':'Its effect sends up to 3 cards from your Deck to the GY for 500 ATK each, and you draw a card when it is destroyed.',
 'Spirit Reaper':'Can’t be destroyed by battle, so it blocks attacks well. It is destroyed if an effect targets it.',
 'Morphing Jar':'FLIP: both players discard their hands and draw 5. Set it when your hand is small.',
 'Ryko, Lightsworn Hunter':'FLIP: destroy a card on the field. Set it and let them attack into it, or Flip Summon it yourself.',
 'Super-Nimble Mega Hamster':'FLIP: Special Summon a Level 3 or lower Beast from your Deck face-down. Set it.',
 'Plaguespreader Zombie':'A Level 2 Tuner that can come back from the GY by putting a card from your hand on top of your Deck.',
 'Thunder King Rai-Oh':'1900 ATK for a Normal Summon, and while it is face-up neither player can search their Deck.',
 'D.D. Warrior Lady':'After it battles a monster you can banish both. Good against a monster you can’t beat.',
 'Honest':'Discard it when your LIGHT monster battles to add the opposing monster’s ATK. Keep it in hand.',
};
function dSynOptions(pool,must,extra){
  const out=[];const n=pool.length;
  for(let mask=1;mask<(1<<n);mask++){const mats=pool.filter((_,i)=>mask&(1<<i));if(mats.length<2||(must&&!mats.includes(must)))continue;
    for(const ex of extra)if(getC(ex).kind==='synchro'&&checkSyn(mats,ex).ok)out.push({ex,mats})}
  return out.sort((a,b)=>dAtk(b.ex)-dAtk(a.ex));
}
function dHint(){
  const P=HG.p[0],O=HG.p[1];const steps=[];const tips=[];
  const add=(t,why,us)=>steps.push({t,why,us:(us||[]).filter(Boolean).map(x=>x.u)});
  const hand=P.hand,inH=n=>hand.find(x=>dNm(x)===n);
  const myM=P.m.filter(Boolean),opM=O.m.filter(Boolean),opUp=opM.filter(z=>z.pos!=='set'),opDown=opM.filter(z=>z.pos==='set');
  const opAtk=opUp.filter(z=>z.pos==='atk');const opST=O.st.filter(Boolean).length,myST=P.st.filter(Boolean).length;
  const opBest=opAtk.slice().sort((a,b)=>dAtk(b)-dAtk(a))[0];const opBestAtk=opBest?dAtk(opBest):0;
  const opThreat=opUp.slice().sort((a,b)=>dAtk(b)-dAtk(a))[0];
  const canBattle=HG.turnNo>1;const freeST=P.st.filter(z=>!z).length;
  const nameList=a=>a.map(dNm).join(', ');
  hand.forEach(x=>{const t=HTIPS[dNm(x)];if(t&&!tips.some(q=>q[0]===dNm(x)))tips.push([dNm(x),t])});
  // Discarding at the End Phase
  if(HG.ui&&HG.ui.mode==='discard'){
    const val=x=>{const n=dNm(x);if(n==='Necro Gardna')return -1;if(HTIPS[n])return 3000;const cd=getC(x);return isMonC(cd)?dAtk(x)+(tribNeeded(cd)?-800:0):1200};
    const w=hand.slice().sort((a,b)=>val(a)-val(b))[0];
    add(`Discard ${dNm(w)}`,dNm(w)==='Necro Gardna'?'Necro Gardna works from the GY, so discarding it costs you nothing.':'It is the card you are least likely to need. Keep your staples and your best monsters.',[w]);
    return {head:'End Phase: discard down to 6',steps,tips};
  }
  if(HG.ui&&HG.ui.mode==='target'){const a=myM.find(z=>z.u===HG.ui.u);if(a){const beat=opM.filter(z=>z.pos==='atk'?dAtk(z)<dAtk(a):z.pos==='def'&&dDef(z)<dAtk(a));
    if(!opM.length)add('Attack directly','They have no monsters, so all of its ATK goes to their LP.');
    else if(beat.length){const t=beat.sort((x,y)=>dAtk(y)-dAtk(x))[0];add(`Attack ${dNm(t)}`,t.pos==='atk'?`${dAtk(a)} ATK beats its ${dAtk(t)} ATK: it is destroyed and they take ${dAtk(a)-dAtk(t)}.`:`${dAtk(a)} ATK beats its ${dDef(t)} DEF: it is destroyed (no damage to LP in Defense Position).`,[t])}
    else if(opDown.length)add('Attack the face-down monster, or cancel','You can’t see its DEF. Nothing face-up is weaker than this attacker.',opDown);
    else add('Cancel this attack',`${dNm(a)} beats none of their monsters, so the attack would cost you.`)}
    return {head:'Choosing a target',steps,tips}}
  // Battle Phase
  if(HG.phase==='battle'){
    const atk=myM.filter(z=>z.pos==='atk'&&!z.attacked).sort((a,b)=>dAtk(a)-dAtk(b));
    if(!atk.length){add('Go to Main Phase 2','None of your monsters can attack anymore.');return {head:'Battle Phase',steps,tips}}
    if(!opM.length){const tot=atk.reduce((s,z)=>s+dAtk(z),0);
      add(tot>=O.lp?`Attack directly with everything: that is game (${tot} damage, they have ${O.lp} LP)`:`Attack directly with ${atk.length>1?'every monster':dNm(atk[0])}`,`They control no monsters, so every attack hits their LP${tot<O.lp?` for ${tot} in total`:''}.`,atk);
    }else{
      const left=atk.slice();const plan=[];
      const targets=opUp.slice().sort((a,b)=>(b.pos==='atk'?dAtk(b):dDef(b))-(a.pos==='atk'?dAtk(a):dDef(a)));
      for(const t of targets){const v=t.pos==='atk'?dAtk(t):dDef(t);const a=left.find(z=>dAtk(z)>v);if(!a)continue;left.splice(left.indexOf(a),1);plan.push([a,t])}
      plan.forEach(([a,t])=>add(`Attack ${dNm(t)} with ${dNm(a)}`,t.pos==='atk'?`${dAtk(a)} ATK beats ${dAtk(t)} ATK: it is destroyed and they take ${dAtk(a)-dAtk(t)}.`:`${dAtk(a)} ATK beats ${dDef(t)} DEF. It is in Defense Position, so it is destroyed but they take no damage.`,[a,t]));
      const clearsUp=plan.length===opUp.length;
      if(opDown.length&&left.length){const a=left[left.length-1];left.splice(left.length-1,1);
        add(`Attack the face-down monster with ${dNm(a)}`,`You can’t see its DEF, so use your strongest free attacker. Set monsters are often FLIP monsters like Ryko or Morphing Jar.`,[a,...opDown])}
      else if(clearsUp&&!opDown.length&&left.length)add(`Then attack directly with ${nameList(left)}`,'Once their field is empty, your remaining monsters hit their LP.',left);
      const idle=left.filter(z=>!steps.some(s=>s.us.includes(z.u)));
      if(idle.length)add(`Don’t attack with ${nameList(idle)}`,`${idle.length>1?'They beat':'It beats'} none of their face-up monsters, so attacking would lose ${idle.length>1?'them':'it'} or cost you LP.`,idle);
      if(!plan.length&&!opDown.length)add('Go to Main Phase 2','No attack wins right now. Keep your monsters for defense.');
    }
    if(opST)tips.unshift(['Their Set cards',`They have ${opST} Set Spell/Trap card${opST>1?'s':''}. Attack with your weaker monster first: if it is a Trap like Dimensional Prison, you lose the smaller monster.`]);
    return {head:'Battle Phase',steps,tips};
  }
  // Main Phases
  const m1=HG.phase==='main1';
  if(m1&&opST>=2&&inH('Heavy Storm'))add('Activate Heavy Storm first',`They have ${opST} Set Spell/Trap cards. Clearing them before you summon or attack means no Bottomless Trap Hole or Mirror Force can stop you.${myST?` It hits your ${myST} too.`:''}`,[inH('Heavy Storm')]);
  else if(m1&&opST>=2&&inH('Giant Trunade'))add('Activate Giant Trunade first',`It sends their ${opST} Set cards back to their hand, so none of them can stop your plays this turn.`,[inH('Giant Trunade')]);
  else if(m1&&opST&&inH('Mystical Space Typhoon'))add('Mystical Space Typhoon one of their Set cards',`Removing a Set card before you summon or attack makes your play safer.`,[inH('Mystical Space Typhoon')]);
  if(m1){const darkH=hand.some(x=>isMonC(getC(x))&&dAttr(x)==='DARK');const gyMon=P.gy.filter(x=>isMonC(getC(x))).length;
    const draw=[inH('Upstart Goblin'),darkH&&inH('Allure of Darkness'),gyMon>=5&&inH('Pot of Avarice'),inH('Reinforcement of the Army'),inH('Charge of the Light Brigade'),inH('Foolish Burial'),inH('Gold Sarcophagus')].filter(Boolean);
    if(draw.length)add(`Activate ${nameList(draw)}`,'Draw and search before you choose your summon: the new cards can change the best play.',draw);}
  // Their monster is too big
  const potential=Math.max(0,...myM.filter(z=>z.pos!=='set').map(dAtk),...(HG.normalDone?[]:hand.filter(x=>canNormalC(x)&&tribNeeded(getC(x))<=myM.length).map(dAtk)));
  if(m1&&canBattle&&opThreat&&dAtk(opThreat)>=potential){
    const bc=inH('Brain Control'),sg=inH('Smashing Ground'),mc=inH('Mind Control'),bm=inH('Book of Moon');
    const highDef=opUp.slice().sort((a,b)=>dDef(b)-dDef(a))[0];
    if(bc&&P.lp>800)add(`Brain Control ${dNm(opThreat)}`,`Nothing you have beats its ${dAtk(opThreat)} ATK. Take it for 800 LP, attack with it, then Tribute it or use it as Synchro material so it never goes back.`,[bc,opThreat]);
    else if(sg)add('Activate Smashing Ground',`It destroys their face-up monster with the highest DEF: ${dNm(highDef)} (${dDef(highDef)} DEF).`,[sg,highDef]);
    else if(mc)add(`Mind Control ${dNm(opThreat)}`,`It takes their biggest monster off their field while you attack.`,[mc,opThreat]);
    else if(bm)add(`Book of Moon ${dNm(opThreat)}`,`It turns face-down in Defense Position, so you attack its ${dDef(opThreat)} DEF instead of its ${dAtk(opThreat)} ATK.`,[bm,opThreat]);
  }
  // Special Summons from the hand that don't use the Normal Summon
  const cy=inH('Cyber Dragon'),dad=inH('Dark Armed Dragon');
  if(cy&&!myM.length&&opM.length&&freeZone(P.m)>-1)add('Special Summon Cyber Dragon','Only they control a monster, so it comes out from your hand and you still have your Normal Summon.',[cy]);
  if(dad&&P.gy.filter(x=>isMonC(getC(x))&&dAttr(x)==='DARK').length===3)add('Special Summon Dark Armed Dragon','You have exactly 3 DARKs in your GY. Then use its effect: banish a DARK from your GY to destroy any card.',[dad]);
  // Synchro with what is already on the field
  const up=myM.filter(z=>z.pos!=='set');
  const now=dSynOptions(up,null,P.extra)[0];
  if(now&&dAtk(now.ex)>Math.max(...now.mats.map(dAtk)))add(`Synchro Summon ${dNm(now.ex)}`,`${nameList(now.mats)} add up to Level ${getC(now.ex).lv}. ${dNm(now.ex)} has ${dAtk(now.ex)} ATK, more than its materials.`,now.mats);
  // The Normal Summon
  if(!HG.normalDone){
    const cands=hand.filter(x=>canNormalC(x)&&!HOLD.includes(dNm(x))&&tribNeeded(getC(x))<=myM.length&&(tribNeeded(getC(x))>0||freeZone(P.m)>-1));
    const worthIt=x=>{const n=tribNeeded(getC(x));if(!n)return true;const fod=myM.slice().sort((a,b)=>dAtk(a)-dAtk(b)).slice(0,n);return dAtk(x)>Math.max(...fod.map(dAtk))+500||dNm(x)==='Caius the Shadow Monarch'};
    const ok=cands.filter(worthIt);
    let synVia=null;if(!now&&freeZone(P.m)>-1)for(const c of ok.filter(x=>!tribNeeded(getC(x)))){const o=dSynOptions([...up,c],c,P.extra)[0];if(o&&(!synVia||dAtk(o.ex)>dAtk(synVia.ex)))synVia=o}
    if(synVia&&(canBattle?dAtk(synVia.ex)>opBestAtk:true))
      add(`Normal Summon ${dNm(synVia.mats.find(m=>hand.includes(m)))}, then Synchro Summon ${dNm(synVia.ex)}`,`${nameList(synVia.mats)} add up to Level ${getC(synVia.ex).lv} with one Tuner. ${dNm(synVia.ex)} has ${dAtk(synVia.ex)} ATK${opBestAtk?`, more than their best ${opBestAtk}`:''}.`,synVia.mats.filter(m=>hand.includes(m)));
    else if(ok.length){
      const byAtk=ok.slice().sort((a,b)=>dAtk(b)-dAtk(a)||tribNeeded(getC(a))-tribNeeded(getC(b)));
      const beaters=byAtk.filter(x=>dAtk(x)>opBestAtk);
      const flips=ok.filter(x=>isFlip(x)&&!tribNeeded(getC(x)));
      const trib=x=>{const n=tribNeeded(getC(x));return n?` by Tributing ${nameList(myM.slice().sort((a,b)=>dAtk(a)-dAtk(b)).slice(0,n))}`:''};
      if(!canBattle){const best=byAtk[0];
        if(flips.length)add(`Set ${dNm(flips[0])} face-down`,`You go first and can’t attack this turn. Its FLIP effect triggers when they attack into it or when you flip it later.`,[flips[0]]);
        else if(dAtk(best)>=1800)add(`Normal Summon ${dNm(best)}${trib(best)}`,`You can’t attack this turn, but ${dAtk(best)} ATK is hard for them to beat in battle next turn without a card effect.`,[best]);
        else{const d=ok.slice().sort((a,b)=>dDef(b)-dDef(a))[0];add(`Set ${dNm(d)} face-down`,`You go first and can’t attack this turn. A Set monster hides what it is, and in Defense Position you take no damage when it is attacked. Its ${dDef(d)} DEF is your best.`,[d])}}
      else if(!opM.length){const b=byAtk[0];add(`Normal Summon ${dNm(b)}${trib(b)}`,`They have no monsters. Summon in Attack Position and attack directly for ${dAtk(b)}.`,[b])}
      else if(!beaters.length&&myM.some(z=>z.pos==='atk'&&dAtk(z)>opBestAtk)){const strong=myM.filter(z=>z.pos==='atk').sort((a,b)=>dAtk(b)-dAtk(a))[0];const d=(flips[0])||ok.slice().sort((a,b)=>dDef(b)-dDef(a))[0];
        add(`Set ${dNm(d)} face-down`,`${dNm(strong)} already beats their monsters, and nothing in your hand would. Set ${dNm(d)} as an extra blocker in Defense Position.`,[d])}
      else if(beaters.length){const b=beaters[0];add(`Normal Summon ${dNm(b)}${trib(b)}`,opBest?`Its ${dAtk(b)} ATK beats their strongest Attack Position monster, ${dNm(opBest)} (${opBestAtk}).`:`Their monsters are in Defense Position or face-down. ${dAtk(b)} ATK is your best attacker.`,[b])}
      else{const d=(flips[0])||ok.slice().sort((a,b)=>dDef(b)-dDef(a))[0];add(`Set ${dNm(d)} face-down`,`${opBest?`Nothing in your hand beats ${dNm(opBest)} (${opBestAtk} ATK).`:'None of your monsters can attack well into their field.'} Set a monster in Defense Position so you take no damage, and look for removal.${isFlip(d)?' Its FLIP effect triggers if they attack it.':''}`,[d])}
    }else if(hand.some(x=>canNormalC(x)&&!HOLD.includes(dNm(x))))tips.unshift(['Tributes',`Your Level 5 or higher monsters need Tributes: 1 for Level 5 and 6, 2 for Level 7 and up. Summon smaller monsters first.`]);
  }
  // Back to Attack Position when the way is clear
  if(m1&&canBattle)myM.filter(z=>z.pos==='def'&&z.turn!==HG.turnNo&&!z.posChanged&&dAtk(z)>(opM.length?Math.max(opBestAtk,...opUp.filter(q=>q.pos==='def').map(dDef)):0)&&!opDown.length).forEach(z=>add(`Switch ${dNm(z)} to Attack Position`,opM.length?`Its ${dAtk(z)} ATK beats their monsters, so it can attack.`:`They have no monsters, so it can attack directly for ${dAtk(z)}.`,[z]));
  // Flip Summon
  const flipNow=myM.filter(z=>z.pos==='set'&&z.turn!==HG.turnNo&&canBattle&&m1&&(isFlip(z)||dAtk(z)>opBestAtk));
  flipNow.forEach(z=>add(`Flip Summon ${dNm(z)}`,isFlip(z)?'Flipping it triggers its FLIP effect.':`Its ${dAtk(z)} ATK beats their strongest face-up attacker, so it can attack.`,[z]));
  // Switch weak monsters to Defense (Main Phase 2)
  if(!m1)myM.filter(z=>z.pos==='atk'&&z.turn!==HG.turnNo&&!z.posChanged&&!z.attacked&&opBestAtk>dAtk(z)&&dDef(z)>=dAtk(z)).forEach(z=>add(`Switch ${dNm(z)} to Defense Position`,`${dNm(opBest)} (${opBestAtk} ATK) would beat it and deal damage. In Defense Position you take none.`,[z]));
  // Set Spells and Traps
  const setters=hand.filter(x=>{const cd=getC(x);return cd.kind==='trap'||(cd.kind==='spell'&&cd.sub==='Quick-Play')});
  const attackLater=m1&&canBattle&&(myM.some(z=>z.pos==='atk')||steps.length);
  if(setters.length&&freeST){const s=setters.slice(0,freeST);
    if(attackLater)add(`After battle, Set ${nameList(s)}`,'Set Traps in Main Phase 2. They can’t be used the turn you Set them anyway, and holding them hides your plan during battle.',s);
    else add(`Set ${nameList(s)}`,`A Trap or Quick-Play has to be Set before it can be used, and it is ready from their turn on.${s.some(x=>dNm(x)==='Trap Dustshoot')?' Trap Dustshoot needs them to hold 4 or more cards.':''}`,s)}
  if(m1&&canBattle&&(myM.some(z=>z.pos==='atk'&&!z.attacked)||steps.some(s=>/Summon|Attack Position|Brain Control|Smashing Ground|Mind Control|Book of Moon/.test(s.t))))add('Go to the Battle Phase','Attack once your summons are done. Tap Hint again there for the best attacks.');
  if(P.hand.length>6&&!m1)add('Set or use cards before you end','You hold more than 6 cards and will have to discard down to 6 at the end of your turn.');
  if(!steps.length)add('End your turn',m1&&!canBattle?'You go first and can’t attack. Nothing else in your hand helps right now.':'Nothing else here improves your position. Keep your remaining cards for later.');
  return {head:m1?'Main Phase 1':'Main Phase 2',steps,tips};
}
function hintPanel(h){
  return `<div class="hhead"><b>💡 ${esc(h.head)}</b><button type="button" class="hx" id="dhintx" aria-label="Hide the hint">×</button></div>
  <ol>${h.steps.map(s=>`<li><b>${esc(s.t)}</b><span>${esc(s.why)}</span></li>`).join('')}</ol>
  ${h.tips.length?`<div class="htips">${h.tips.slice(0,3).map(([n,t])=>`<p><b>${esc(n)}:</b> ${esc(t)}</p>`).join('')}</div>`:''}
  <p class="hnote">A suggestion from what you can see. It can’t know their hand or face-down cards.</p>`;
}
function hintPanelE(){
  HG=hintView();let h;try{h=dHint()}catch(e){console.error(e);h={head:'Hint',steps:[],tips:[]}}
  let best='';
  try{const k=EdisonAI.decide(G.g,0,'normal');const o=G.g.prompt.opts.find(x=>x.key===k[0]);if(o){const c=o.u!=null?eFind(o.u):null;best=`${o.label}${c&&o.kind!=='atk'?': '+esc(EG().name(c)):''}`}}catch(e){console.error(e)}
  return `${best?`<p class="hbest"><b>The computer's pick in your seat:</b> ${esc(best)}</p>`:''}${hintPanel(h)}`;
}
/* ---- screens ---- */
/* Duel the computer stays "coming soon" on the live site until it is fully ready (Zack, 2026-11-22). To try it in a
 browser before then, run localStorage.setItem('goat:duelpreview','1') in the console; to open it for everyone,
 make DUEL_READY return true. */
const DUEL_READY=()=>{try{return localStorage.getItem('goat:duelpreview')==='1'}catch(e){return false}};
function renderDuelSoon(){
  /* since 2026-11-24 the duel game is its own site, play.learnretro.com (Zack: "set up play.learnretro.com for launch") */
  app.innerHTML=`<div class="read" style="max-width:720px"><h1 style="font-size:32px;margin-bottom:6px">Duel the computer</h1>
    <p style="font-size:17px">Duel the computer in Goat and Goat format at <b>Learn Retro Play</b>, our free duel game. It runs in your browser: pick a deck, pick one of four computer levels, and play with the real rules.</p>
    <p><a class="btn" href="https://play.learnretro.com/" target="_blank" rel="noopener" style="display:inline-block;margin-top:10px">Play now &rarr;</a></p></div>`;
}
function renderDuel(){if(!DB.length){app.innerHTML=noData();return}if(!window.EdisonEngine){app.innerHTML='<p class="note">Loading the duel…</p>';return}engineReady();if(!G){renderDuelSetup();return}renderDuelGame()}
function renderDuelSetup(){
  const opts=sel=>deckChoices().map(c=>`<option value="${esc(c.key)}" ${c.key===sel?'selected':''}>${esc(c.name)}${deckAuto(c.d)?' ✓':''}</option>`).join('');
  app.innerHTML=`<div class="read" style="max-width:860px"><h1 style="font-size:32px;margin-bottom:6px">Duel the computer</h1>
  <p class="note" style="margin:0 0 16px">A full duel under the April 2010 rules: chains, Spell Speed, the Damage Step and card effects all happen on their own. Every card in all 55 decks has its effect automated (decks you build yourself get a ✓ when every card in them is). The computer only knows what you could see: it never peeks at your hand or face-down cards.</p>
  <div class="dsetup">
    <label>Your deck<select id="ds-you">${opts(DSET.you)}</select></label>
    <label>Computer's deck<select id="ds-cpu"><option value="random" ${DSET.cpu==='random'?'selected':''}>Random deck ✓</option>${opts(DSET.cpu)}</select></label>
    <label>Who goes first<select id="ds-first">${[['random','Random'],['you','You'],['cpu','The computer']].map(([v,t])=>`<option value="${v}" ${DSET.first===v?'selected':''}>${t}</option>`).join('')}</select></label>
  </div>
  <h2 style="font-size:18px;margin:18px 0 8px">Difficulty</h2>
  <div class="diffs">${Object.entries(DIFFS).map(([k,[t,b]])=>`<button type="button" class="diff ${DSET.diff===k?'on':''}" data-diff="${k}"><b>${t}</b><span>${b}</span></button>`).join('')}</div>
  <div class="hero-btns" style="margin-top:18px"><button class="btn primary" id="dstart">Start the duel</button><a class="btn" href="#builder">Build your own deck</a></div></div>`;
  app.querySelectorAll('[data-diff]').forEach(b=>b.onclick=()=>{DSET.diff=b.dataset.diff;app.querySelectorAll('[data-diff]').forEach(x=>x.classList.toggle('on',x===b))});
  document.getElementById('dstart').onclick=()=>{DSET.you=document.getElementById('ds-you').value;DSET.cpu=document.getElementById('ds-cpu').value;DSET.first=document.getElementById('ds-first').value;store.set('duelsetup',DSET);startDuel()};
}
/* Which cards the current prompt lets the player use, and which are picked */
function promptCards(){
  const g=G.g,pr=g.prompt;const s=new Set();if(!pr||pr.p!==0||G.busy)return s;
  for(const o of pr.opts)if(o.u!=null)s.add(o.u);
  return s;
}
function eZone(pi,kind,i,can){
  const g=G.g,P=g.p[pi];const x=kind==='fz'?P.fz:P[kind][i];
  let cls='zone'+(kind==='st'||kind==='fz'?' st':'');
  if(!x)return `<button class="${cls}" aria-label="Empty zone" disabled></button>`;
  const down=x.pos==='set',hidden=down&&pi===1;
  if(kind==='m'&&(x.pos==='def'||down))cls+=' def';
  if(can.has(x.u))cls+=' can';if(G.sel.includes(x.u))cls+=' sel';
  const inner=down?`<span class="facedown">${hidden?'':esc(EG().name(x))}</span>`:eNoArt(x)?`<span class="etok">${esc(EG().name(x))}<small>${EG().atk(g,x)}/${EG().def(g,x)}</small></span>`:`<span class="zimg" style="background-image:url('${eArt(x)}')"></span>`;
  const badge=kind==='m'&&!down?`<span class="lvbadge">${EG().atk(g,x)}</span>`:'';
  return `<button class="${cls}" data-eu="${x.u}" aria-label="${hidden?'Face-down card':esc(EG().name(x))}">${badge}${inner}</button>`;
}
function renderDuelGame(){
  const g=G.g,P=g.p[0],O=g.p[1],pr=g.prompt,mine=pr&&pr.p===0&&!G.busy;
  const can=promptCards();
  const zones=(pi,k)=>[0,1,2,3,4].map(i=>eZone(pi,k,i,can)).join('');
  const top=a=>a.length?eArt(a[a.length-1]):null;
  const slots=pi=>{const X=g.p[pi];return {deck:pileZ('disabled','Deck',X.deck.length,null,true),gy:pileZ(`data-dp="${pi}|gy"`,'GY',X.gy.length+X.ban.length?X.gy.length:0,top(X.gy)),
    extra:pileZ(pi===0?'data-dp="0|extra"':'disabled','Extra',X.extra.length,null,true),field:X.fz?eZone(pi,'fz',0,can):pileZ(X.ban.length?`data-dp="${pi}|ban"`:'disabled','Banished',X.ban.length,top(X.ban))}};
  const phaseName={draw:'Draw Phase',standby:'Standby Phase',main1:'Main Phase 1',battle:'Battle Phase',main2:'Main Phase 2',end:'End Phase'}[g.phase]||'';
  let bar='';
  if(g.winner!=null)bar=`<p class="amsg">${g.winner===0?'You win!':g.winner===1?'The computer wins.':'The duel is a draw.'} ${esc(g.why)}.</p><button class="btn primary" id="dagain">Play again</button><button class="btn" id="dsetup">Change decks</button>`;
  else if(!mine)bar=`<p class="amsg">The computer is thinking…</p>`;
  else if(pr.type==='idle'){const glob=pr.opts.filter(o=>o.u==null);bar=`<p class="amsg">${esc(pr.text)}: tap a glowing card to use it.</p>${glob.map(o=>`<button class="btn ${o.key==='end'||o.key==='endbp'?'primary':''}" data-k="${o.key}">${esc(o.label)}</button>`).join('')}`}
  else if(pr.type==='respond')bar=`<p class="amsg">${esc(pr.text)}</p>${pr.opts.map(o=>`<button class="btn ${o.key==='pass'?'primary':''}" data-k="${o.key}">${esc(o.label)}</button>`).join('')}`;
  else if(pr.type==='yesno'||pr.type==='choose')bar=`<p class="amsg">${esc(pr.text)}</p>${pr.opts.map((o,i)=>`<button class="btn ${i===0?'primary':''}" data-k="${o.key}">${esc(o.label)}</button>`).join('')}`;
  else if(pr.type==='pick'){const n=G.sel.length;const okN=n>=pr.min&&n<=pr.max;
    bar=`<p class="amsg">${esc(pr.text)}${pr.max>1?` (${n} of ${pr.min===pr.max?pr.max:pr.min+' to '+pr.max})`:''}. Tap the glowing cards.</p>${pickOffBoard()?`<button class="btn" id="dpickopen">Show the cards</button>`:''}${pr.max>1?`<button class="btn primary" id="dpickok" ${okN?'':'disabled'}>Confirm</button>`:''}`}
  if(mine&&(pr.type==='idle'||pr.type==='respond'))bar+=`<button class="btn hintbtn${G.hint?' on':''}" id="dhint" aria-expanded="${!!G.hint}">💡 ${G.hint?'Hide hint':'Hint'}</button>`;
  const hint=mine&&G.hint&&(pr.type==='idle')?hintPanelE():'';
  const hand=P.hand.map(x=>`<button type="button" class="himg${can.has(x.u)?' can':''}${G.sel.includes(x.u)?' sel':''}" data-eu="${x.u}" aria-label="${esc(EG().name(x))}" style="background-image:url('${eArt(x)}')"></button>`).join('')||'<span class="empty">No cards in hand.</span>';
  mountArena(arenaHTML({
    title:'Duel the computer',sub:`${DIFFS[G.level][0]} · ${esc(P.deckName)} vs ${esc(O.deckName)}${G.auto[0]&&G.auto[1]?'':' · some effects not automated'}`,
    tools:`<button class="btn small" id="dsetup2">New duel</button>`,
    oppPanel:lpRO('The computer',`Hand ${O.hand.length} · Deck ${O.deck.length}`,O.lp,g.tp===1),youPanel:lpRO('You',`Deck ${P.deck.length}`,P.lp,g.tp===0),
    opp:slots(1),you:slots(0),oppST:zones(1,'st'),oppM:zones(1,'m'),youM:zones(0,'m'),youST:zones(0,'st'),
    strip:`Turn ${g.turnNo} · ${g.tp===0?'Your turn':"Computer's turn"} · ${phaseName}${g.chain.length?` · Chain ${g.chain.length}`:''}`,
    actions:bar,log:g.log.slice().reverse().map(l=>`<div>${esc(l)}</div>`).join(''),hand,hint}));
  bindDuel();
}
const lpRO=(who,sub,lp,isTurn)=>`<div class="lpbox ${isTurn?'turn':''}"><span class="who">${who}</span>${sub?`<span class="sub">${esc(sub)}</span>`:''}<div class="lpv"><span>LP</span><b class="lpnum">${lp}</b></div></div>`;
/* Cards to pick that aren't on the board or in your hand (Deck, GY, Extra Deck, banished, the opponent's hand) */
function pickOffBoard(){const pr=G.g.prompt;return pr&&pr.type==='pick'&&pr.opts.some(o=>{const c=eFind(o.u);return c&&!(EG().onField(c)||(c.zone==='hand'&&c.owner===0))})}
function openPicker(){
  const pr=G.g.prompt;
  openModal(`<button class="closex" data-close aria-label="Close">×</button><h3>${esc(pr.text)}</h3><p class="note">${pr.max>1?`Pick ${pr.min===pr.max?pr.max:pr.min+' to '+pr.max}, then confirm.`:'Tap a card to pick it.'}</p>
  <div class="cthumbs sm" style="margin-top:10px">${pr.opts.map(o=>{const c=eFind(o.u);return `<button type="button" class="cthumb ${G.sel.includes(o.u)?'on':''}" data-pk="${o.u}"><img src="${eArt(c)}" alt="">${esc(o.label)}</button>`}).join('')}</div>
  ${pr.max>1?`<div class="actions" style="margin-top:12px"><button class="btn primary" id="pkok">Confirm</button></div>`:''}`,el=>{
    el.querySelectorAll('[data-pk]').forEach(b=>b.onclick=()=>{const u=+b.dataset.pk;if(pr.max===1){closeModal();duelAct(['u'+u]);return}G.sel=G.sel.includes(u)?G.sel.filter(x=>x!==u):G.sel.length<pr.max?[...G.sel,u]:G.sel;b.classList.toggle('on',G.sel.includes(u))});
    const ok=el.querySelector('#pkok');if(ok)ok.onclick=()=>{if(G.sel.length>=pr.min&&G.sel.length<=pr.max){closeModal();duelAct(G.sel.map(u=>'u'+u))}};
  });modal.querySelector('.sheet').classList.add('wide');
}
function bindDuel(){
  const $=id=>document.getElementById(id);const on=(id,f)=>{const el=$(id);if(el)el.onclick=f};const g=G.g,pr=g.prompt;
  on('dagain',startDuel);on('dsetup',()=>{G=null;renderDuel()});on('dsetup2',()=>{if(g.winner!=null||confirm('Leave this duel and start a new one?')){clearTimeout(G.timer);G=null;renderDuel()}});
  on('dhint',()=>{G.hint=!G.hint;renderDuel()});on('dhintx',()=>{G.hint=false;renderDuel()});
  on('dpickopen',openPicker);on('dpickok',()=>{if(G.sel.length>=pr.min&&G.sel.length<=pr.max)duelAct(G.sel.map(u=>'u'+u))});
  app.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>duelAct([b.dataset.k]));
  app.querySelectorAll('[data-dp]').forEach(b=>b.onclick=()=>{const [pi,k]=b.dataset.dp.split('|');const X=g.p[+pi];
    const list=k==='extra'?X.extra:X[k];const title=`${+pi===0?'Your':"The computer's"} ${k==='gy'?'Graveyard':k==='ban'?'banished cards':'Extra Deck'} (${list.length})`;
    openModal(`<button class="closex" data-close aria-label="Close">×</button><h3>${title}</h3>${k==='gy'&&X.ban.length?`<p class="note">Banished: ${X.ban.map(c=>esc(EG().name(c))).join(', ')}</p>`:''}<div class="cthumbs sm" style="margin-top:10px">${list.slice().reverse().map(c=>`<button type="button" class="cthumb" data-vu="${c.u}"><img src="${eArt(c)}" alt="">${esc(EG().name(c))}</button>`).join('')||'<p class="note">Empty.</p>'}</div>`,el=>el.querySelectorAll('[data-vu]').forEach(b=>b.onclick=()=>{closeModal();eShow(eFind(+b.dataset.vu))}));modal.querySelector('.sheet').classList.add('wide')});
  if(pr&&pr.type==='pick'&&pickOffBoard()&&!G.busy&&pr.p===0&&!G.pickerShown){G.pickerShown=true;openPicker()}
  if(!pr||pr.type!=='pick')G.pickerShown=false;
  app.querySelectorAll('[data-eu]').forEach(b=>b.onclick=()=>{
    const u=+b.dataset.eu;const c=eFind(u);if(!c)return;const pr=g.prompt;const hidden=c.ctrl===1&&c.pos==='set'&&EG().onField(c);
    const view=hidden?[]:[['View card',()=>eShow(c)]];
    if(pr&&pr.p===0&&!G.busy&&pr.type==='pick'&&pr.opts.some(o=>o.u===u)){
      if(pr.max===1){duelAct(['u'+u]);return}
      G.sel=G.sel.includes(u)?G.sel.filter(x=>x!==u):G.sel.length<pr.max?[...G.sel,u]:G.sel;renderDuel();return}
    const mineOpts=pr&&pr.p===0&&!G.busy&&(pr.type==='idle'||pr.type==='respond')?pr.opts.filter(o=>o.u===u):[];
    const btns=[...mineOpts.map((o,i)=>[esc(o.label),()=>duelAct([o.key]),i===0?'primary':'']),...view];
    if(!btns.length)return;
    if(btns.length===1&&!mineOpts.length){eShow(c);return}
    const sub=EG().onField(c)&&c.zone==='m'&&c.pos!=='set'?`ATK ${EG().atk(g,c)} / DEF ${EG().def(g,c)}`:c.zone==='hand'?'In your hand':'';
    if(window.innerWidth>=820)popMenu(b,hidden?'Face-down card':EG().name(c),btns,sub);
    else openModal(`<button class="closex" data-close aria-label="Close">×</button><h3>${esc(hidden?'Face-down card':EG().name(c))}</h3><div class="meta">${sub}</div><div class="actions">${btns.map((x,i)=>`<button class="btn ${x[2]||''}" data-a="${i}">${x[0]}</button>`).join('')}</div>`,el=>el.querySelectorAll('[data-a]').forEach(x=>x.onclick=()=>{closeModal();btns[+x.dataset.a][1]()}));
  });
}

route();

