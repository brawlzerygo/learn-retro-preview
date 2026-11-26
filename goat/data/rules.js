/* The Rules page (#rules): how Goat is played, in our own words. Sources: goatformat.com (Goat Format Rules, Card
 Pool, Rules and Policies) and YGOPRODeck's Introduction to Goat Format. Every section lists where its facts came from in "src".
 All text is our own wording of the sourced facts. Draft v1 (2026-11-23). */
window.GOAT_RULES = {
  sources: [
    { name: 'goatformat.com: Goat Format Rules', url: 'https://www.goatformat.com/basics.html', note: 'the 2005 rules that differ from today' },
    { name: 'goatformat.com: Card Pool and Banlist', url: 'https://www.goatformat.com/cardpool.html', note: 'the legal sets and the April 2005 list' },
    { name: 'goatformat.com: Rules and Policies', url: 'https://www.goatformat.com/rules.html', note: 'how rulings are applied' },
    { name: 'YGOPRODeck: An Introduction to Goat Format', url: 'https://ygoprodeck.com/an-introduction-to-goat-format/', note: 'versions of the format, the June 2005 position rule' },
  ],
  sections: [
    { id: 'glance', title: 'Goat at a glance', src: 'goatformat.com, Rules and Policies and Goat Format Rules; the first-turn attack rule from Zack (2026-11-23)', html: `
<p>Goat is played the way big tournaments played it in 2005. Cards are ruled as a head judge would have ruled them then, even where today's rulings differ. Anything not listed here works as it does in the modern game.</p>
<table><tr><th>Rule</th><th>In Goat</th></tr>
<tr><td>First turn</td><td>The player going first draws in their first Draw Phase, but has no Battle Phase that turn.</td></tr>
<tr><td>Fusion Deck</td><td>Fusion monsters only, no size limit in 2005. No Extra Monster Zone.</td></tr>
<tr><td>Field Spells</td><td>One face-up Field Spell for the whole table. Playing another destroys the one already there.</td></tr>
<tr><td>Priority</td><td>After a summon or a Chain resolves, the turn player may act first.</td></tr>
<tr><td>Damage Step</td><td>Six steps, one Chain each, and only monster effects that negate an activation can be used.</td></tr>
<tr><td>Matches</td><td>Best of three. No match draws.</td></tr>
</table>` },
    { id: 'decks', title: 'Building a deck', src: 'goatformat.com, Goat Format Rules and Card Pool', html: `
<table><tr><th>Deck</th><th>Size</th><th>Description</th></tr>
<tr><td>Main Deck</td><td>40 or more</td><td>No top limit in 2005. DuelingBook stops at 60.</td></tr>
<tr><td>Fusion Deck</td><td>Any number</td><td>Fusion monsters only.</td></tr>
<tr><td>Side Deck</td><td>0 or 15</td><td>Rarely checked today.</td></tr>
</table>
<p>Up to 3 copies of a card across all three decks, fewer if the April 2005 banlist says so. The card pool is every card legal at premier events on August 17, 2005: through The Lost Millennium, without Exarion Universe or Cybernetic Revolution.</p>` },
    { id: 'chains', title: 'Priority and triggers', src: 'goatformat.com, Goat Format Rules (rules 4, 9 and 12)', html: `
<p><b>Priority:</b> once a summon or a Chain finishes, the turn player gets the first chance to act: they may use a fast effect or a monster's Ignition effect before the opponent can answer.</p>
<p><b>Triggers at the same time:</b> when several effects trigger together, they go on the Chain in the order the events happened, earlier ones first.</p>
<p><b>Replays:</b> if the number of monsters your opponent controls changes after you declare an attack, you may choose a new target or stop. A new target counts as a fresh attack declaration.</p>` },
    { id: 'damage', title: 'The Damage Step', src: 'goatformat.com, Goat Format Rules (rule 10)', html: `
<p>The Damage Step in 2005 has six steps, one more than today, and only one Chain can happen in each. During it, the only cards that can be used are monster effects that negate an activation. Quick-Play Spells, Normal Traps and Continuous Trap effects all have to wait.</p>` },
    { id: 'positions', title: 'The June 2005 position rule', src: 'YGOPRODeck, An Introduction to Goat Format', html: `
<p>Before a rule change in June 2005, a monster that a card turned face-down could not be flipped face-up again that turn, because the move counted as its one position change. After the change it no longer counts. That is what lets decks turn their own Flip monsters face-down with cards like Book of Moon and Tsukuyomi and use them again, a big part of how Goat Control works. Standard Goat uses the rules after this change.</p>` },
    { id: 'other', title: 'Other 2005 rules', src: 'goatformat.com, Goat Format Rules (rules 15, 16 and 20)', html: `
<ul>
<li>Two monsters with 0 ATK that battle in Attack Position are both destroyed.</li>
<li>You can't pay a Life Point cost that would take you to 0 or below, except for Chain Energy.</li>
<li>Embodiment of Apophis takes up both a Monster Zone and a Spell &amp; Trap Zone.</li>
</ul>` }
  ]
};
