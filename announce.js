/* Learn Retro: the announcement bar across the top of every page (Zack, 2026-11-24: "add a banner to the site
   announcing the duel simulator is live", "top of the site"). One file for the whole domain, served at /announce.js
   and loaded by the hub, the blog, /edison/ and /goat/. It sits above the header and scrolls away with the page.
   The x hides it in this browser (localStorage "lr:announce" = the message's ID); a new message gets a new ID, so it
   shows again. */
(function () {
  var ID = 'play-live-1';
  var KEY = 'lr:announce';
  try { if (localStorage.getItem(KEY) === ID) return; } catch (e) {}

  var css = '#lr-announce{display:flex;align-items:center;justify-content:center;gap:10px;position:relative;z-index:30;' +
    'background:#16110e;color:#fbfaf7;padding:8px 44px;text-align:center;' +
    'font:14px/1.4 "Atkinson Hyperlegible",Verdana,sans-serif;border-bottom:2px solid #e2602a}' +
    '#lr-announce p{margin:0}#lr-announce strong{color:#f59e0b}' +
    '#lr-announce a.go{color:#fff;background:#e2602a;border-radius:6px;padding:4px 12px;font-weight:700;' +
    'text-decoration:none;white-space:nowrap}' +
    '#lr-announce a.go:hover{background:#c2410c}' +
    '#lr-announce a:focus-visible,#lr-announce button:focus-visible{outline:2px solid #f59e0b;outline-offset:2px}' +
    '#lr-announce button{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:32px;height:32px;' +
    'border:0;background:transparent;color:#fbfaf7;font:20px/1 Verdana,sans-serif;cursor:pointer;opacity:.75}' +
    '#lr-announce button:hover{opacity:1}' +
    '@media (max-width:640px){#lr-announce{gap:8px;padding:6px 40px 6px 12px;font-size:13px}#lr-announce .l{display:none}#lr-announce a.go{padding:4px 10px}}';

  function show() {
    if (document.getElementById('lr-announce')) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var d = document.createElement('div');
    d.id = 'lr-announce'; d.setAttribute('role', 'region'); d.setAttribute('aria-label', 'Announcement');
    d.innerHTML = '<p><strong>New:</strong> <span class="l">the Learn Retro </span>duel simulator is live!<span class="l"> Play Edison or Goat against the computer.</span></p>' +
      '<a class="go" href="https://play.learnretro.com/" target="_blank" rel="noopener">Play now</a>' +
      '<button type="button" aria-label="Hide this message">×</button>';
    d.querySelector('button').onclick = function () {
      try { localStorage.setItem(KEY, ID); } catch (e) {}
      d.remove();
    };
    document.body.insertBefore(d, document.body.firstChild);
  }
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
})();
