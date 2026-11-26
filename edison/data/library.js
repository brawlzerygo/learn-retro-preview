/* Library: Learn Retro's own Edison videos (Zack, 2026-11-25: "remove imnerd and e3s videos for now, and just do
 ours"). The course episodes on the Learn Retro YouTube channel, newest course step last. The creator picks (IMNerd,
 E3 Yu-Gi-Oh) that were here from 2026-11-17 are in git history if they come back.
 To add a video: a line with its YouTube id, its title as published, the channel key, its length and the course step
 it covers (step: the lesson it starts at, shown on the course page too). Then save its thumbnail as img/lib/<id>.jpg
 (480x270, from video/out/youtube/<ep>-thumb.png). */
window.EDISON_LIBRARY={
  checked:'2026-11-25',
  channels:{
    lr:{name:'Learn Retro Yu-Gi-Oh!',handle:'@LearnRetro',url:'https://www.youtube.com/@LearnRetro',about:'Our own channel: the Edison course as video lessons, built from the same lessons as this site.'}
  },
  sections:[
    {title:'The Edison course on video',blurb:'The course lessons as videos. Watch along, then do the lessons and quizzes here.',videos:[
      {id:'cZvV0nYQ3Ak',t:'How to Play Edison Format: The Best Way Back Into Yu-Gi-Oh!',ch:'lr',len:'13:41',step:'Step 0',lesson:'0.1',about:'The basics of Yu-Gi-Oh!, then what Edison format is.'},
      {id:'b8W50hHzJVk',t:'Edison Format Explained: How Yu-Gi-Oh! Played in 2010',ch:'lr',len:'34:12',step:'101',lesson:'1',about:'Edison 101: how a match works, Synchros, the Extra Deck, the staples and the banlist.'}
    ]}
  ],
  series:[]
};
