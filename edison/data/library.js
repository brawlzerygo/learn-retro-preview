/* Library: videos other creators made for learning Edison. Hand-picked (not built by build_data.py) from each
 channel's most viewed and most useful guide videos. Views and ages as read from YouTube on 2026-11-17.
 To add a video: copy a line into the right section with its YouTube id, the title exactly as the creator wrote
 it, the channel key, length, views and age. Then save its thumbnail:
   curl -o img/lib/<id>.jpg https://i.ytimg.com/vi/<id>/mqdefault.jpg */
window.EDISON_LIBRARY={
  checked:'2026-11-17',
  channels:{
    imn:{name:'IMNerd (Frazier Smith)',handle:'@imnerdpodcast',url:'https://www.youtube.com/@imnerdpodcast',about:'YCS champion Frazier Smith: tier lists, deck schools, the "Teach Me How to Cook" deck series and tournament matches.'},
    e3:{name:'E3 Yu-Gi-Oh',handle:'@E3YuGiOh',url:'https://www.youtube.com/@E3YuGiOh',about:'Beginner guides, rulings, deck guides, tier lists and big Edison events.'}
  },
  sections:[
    {title:'Start here',blurb:'New to Edison? Watch these first.',videos:[
      {id:'6FK1sv7Jmj8',t:"Complete Beginner's Guide & Intro to Edison Format",ch:'e3',len:'12:36',views:66838,year:'4 years ago'},
      {id:'HaYrAyE-QIk',t:'Rulings & Errata you NEED TO KNOW to play Edison Format Yu-Gi-Oh!™',ch:'e3',len:'26:08',views:36345,year:'5 years ago'},
      {id:'7lPg6Jcxekk',t:"The YCS Champion's Guide to Becoming Better at Edison Format | Yu-Gi-Oh",ch:'imn',len:'35:27',views:29281,year:'2 years ago'},
      {id:'dAX7q2Mesz0',t:'How Edison Format Became The Biggest Format Of Yu-Gi-Oh! (+Really Big Announcement)',ch:'e3',len:'31:18',views:12051,year:'3 years ago'}
    ]},
    {title:'The meta: top decks and tier lists',blurb:'Which decks are strong right now, and why.',videos:[
      {id:'fuTxFjarcck',t:'Top 5 Decks in Edison Format 2026 Edition | Yugioh',ch:'imn',len:'29:17',views:122250,year:'10 months ago'},
      {id:'iKuQpmvAdcg',t:'The State of Edison Format 2026 ft @SackPhase & @Meta-Foes | Yugioh',ch:'imn',len:'2:04:00',views:52066,year:'3 months ago'},
      {id:'K5G7EuaDuTw',t:'The YCS Champion Edison Format Tier List 2026 Edition | Yu-Gi-Oh',ch:'imn',len:'55:17',views:29294,year:'2 months ago'},
      {id:'b0vBe4SZh4s',t:'The Definitive Edison Format 2024 Tier List (November)',ch:'e3',len:'1:15:27',views:22389,year:'1 year ago'}
    ]},
    {title:'Deck guides',blurb:'How the main strategies play, from the people who play them best.',videos:[
      {id:'gTd0_R070jI',t:'The ULTIMATE Blackwing Guide for Edison Format [HD]',ch:'e3',len:'25:16',views:18406,year:'4 years ago'},
      {id:'Hb6XD00i5TQ',t:'Understanding Blackwings at a High Level ft ProStorm (Part One) | Yugioh Edison Format',ch:'imn',len:'32:53',views:15288,year:'1 year ago'},
      {id:'KcMY3pLZnBs',t:'The ULTIMATE Quickdraw Dandywarrior Guide for Edison Format [HD]',ch:'e3',len:'42:14',views:27642,year:'4 years ago'},
      {id:'8UINGxxplso',t:'The ULTIMATE GUIDE To Dragon Decks in Edison Format',ch:'e3',len:'37:42',views:23284,year:'3 years ago'},
      {id:'NSbZJTCgAgY',t:'The ULTIMATE Diva Hero Guide For Edison Format [HD]',ch:'e3',len:'35:31',views:17025,year:'4 years ago'},
      {id:'s53W6a0V1lQ',t:'The BEST Way To play Hero Beat in Edison Format',ch:'e3',len:'1:01:43',views:11275,year:'3 years ago'},
      {id:'Sv8InBOV5Sg',t:'Yugioh Edison Format | Teach Me How to Cook ft Eric Shen @SackPhase| Vayu Turbo "Sizzle 41" Ep27',ch:'imn',len:'1:33:57',views:15824,year:'1 year ago'},
      {id:'VxbgBee_nZY',t:'Frog School Chapter 1: Frog Monarchs (The Basics) | Yugioh Edison Format',ch:'imn',len:'54:11',views:12193,year:'1 year ago'},
      {id:'Xc1BgRnz5Xw',t:'Frog School Chapter 2: Basic Combo Lines | Yugioh Edison Format',ch:'imn',len:'47:50',views:15237,year:'1 year ago'},
      {id:'Kp2r5E2T_-o',t:"The Beginner's Guide to Frog OTK | Frog School Chapter 3 | Yugioh Edison Format",ch:'imn',len:'1:10:10',views:13343,year:'7 months ago'}
    ]},
    {title:'Playing better',blurb:'Side decking and match play.',videos:[
      {id:'zLyYn3OEecc',t:'How To Sideboard in Edison Format',ch:'e3',len:'38:55',views:18679,year:'3 years ago'},
      {id:'CC0Ah34BJP0',t:"Frazier Smith's Side Decking 101 - YGO Edison Format",ch:'imn',len:'52:28',views:9820,year:'3 years ago'}
    ]}
  ],
  series:[
    {ch:'imn',name:'Teach Me How to Cook',about:'Long deck techs with the players who built each list.',url:'https://www.youtube.com/@imnerdpodcast/search?query=teach%20me%20how%20to%20cook'},
    {ch:'imn',name:'The Master & the Disaster',about:'Podcast episodes on recent results and new decks.',url:'https://www.youtube.com/@imnerdpodcast/search?query=master%20and%20the%20disaster'},
    {ch:'e3',name:'Tier lists',about:'Regular rankings of every competitive deck.',url:'https://www.youtube.com/@E3YuGiOh/search?query=tier%20list'}
  ]
};
