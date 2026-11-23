/* Learn Retro: Google Analytics behind a consent banner (Zack, 2026-11-23: "GA4 + consent banner").
   One file for the whole domain, served at /consent.js and loaded by the hub, the blog, /edison/ and /goat/.
   - GA loads only after the visitor clicks Accept, and only on the live site (learnretro.com), never on the
     preview or a local copy, so tests never count as visits.
   - The choice is kept in this browser (localStorage "lr:consent" = "yes" | "no"); /privacy/ can reopen the banner.
   - Edison and Goat change pages without reloading; GA4's enhanced measurement counts those page changes itself. */
(function () {
  var GA_ID = 'G-E5F52MTX9D'; // the learnretro.com web stream's measurement ID
  var KEY = 'lr:consent';
  var LIVE = location.hostname === 'learnretro.com' || location.hostname === 'www.learnretro.com';

  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  var loaded = false;
  function loadGA() {
    if (loaded || !LIVE || !/^G-[A-Z0-9]+$/.test(GA_ID)) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA_ID);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }

  var css = '#lr-consent{position:fixed;left:12px;right:12px;bottom:12px;z-index:10000;max-width:560px;margin:0 auto;' +
    'background:#211914;color:#f6eee6;border:1px solid rgba(246,238,230,.18);border-radius:10px;padding:14px 16px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.35);font:14px/1.5 "Atkinson Hyperlegible",Verdana,sans-serif}' +
    '#lr-consent p{margin:0 0 10px}#lr-consent a{color:#f59e0b}' +
    '#lr-consent .b{display:flex;gap:10px;flex-wrap:wrap}' +
    '#lr-consent button{font:700 14px/1 Verdana,sans-serif;min-height:44px;padding:0 18px;border-radius:8px;cursor:pointer;' +
    'border:1px solid rgba(246,238,230,.3);background:transparent;color:#f6eee6}' +
    '#lr-consent button.y{background:#e2602a;border-color:#e2602a;color:#fff}' +
    '#lr-consent button:focus-visible{outline:2px solid #f59e0b;outline-offset:2px}';

  function close() { var b = document.getElementById('lr-consent'); if (b) b.remove(); }
  function open() {
    if (document.getElementById('lr-consent')) return;
    if (!document.getElementById('lr-consent-css')) {
      var st = document.createElement('style'); st.id = 'lr-consent-css'; st.textContent = css; document.head.appendChild(st);
    }
    var d = document.createElement('div');
    d.id = 'lr-consent'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Cookie choice');
    d.innerHTML = '<p>Can we count your visit? We use Google Analytics cookies to see which lessons people use, ' +
      'so we know what to build next. No ads. <a href="/privacy/">Privacy</a></p>' +
      '<div class="b"><button class="y" type="button">Accept</button><button class="n" type="button">Decline</button></div>';
    d.querySelector('.y').onclick = function () { set('yes'); close(); loadGA(); };
    d.querySelector('.n').onclick = function () {
      var was = get(); set('no'); close();
      if (was === 'yes') { // a changed mind: drop GA's cookies and stop counting from the next page load
        document.cookie.split(';').forEach(function (k) {
          var n = k.split('=')[0].trim();
          if (/^_ga/.test(n)) ['', '; domain=.learnretro.com', '; domain=learnretro.com'].forEach(function (dm) {
            document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + dm;
          });
        });
        location.reload();
      }
    };
    document.body.appendChild(d);
  }

  window.lrConsent = { open: open, choice: get };
  var c = get();
  if (c === 'yes') loadGA();
  else if (c !== 'no') {
    if (document.body) open(); else document.addEventListener('DOMContentLoaded', open);
  }
})();
