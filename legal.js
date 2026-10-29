// Privacy and Terms: Bahasa Malaysia first, English on the toggle. Shares the
// app's language choice (hfrun_lang); ?lang=en opens the English version.
(function () {
  var q = new URLSearchParams(location.search).get('lang'), saved;
  try { saved = localStorage.getItem('hfrun_lang'); } catch (e) {}
  function show(l) {
    l = l === 'en' ? 'en' : 'ms';
    document.documentElement.lang = l;
    document.querySelectorAll('section[lang]').forEach(function (s) { s.hidden = s.lang !== l; });
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.lang === l); });
  }
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { show(b.dataset.lang); try { localStorage.setItem('hfrun_lang', b.dataset.lang); } catch (e) {} });
  });
  show(q || saved || 'ms');
})();
