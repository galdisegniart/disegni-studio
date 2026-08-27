(function () {
  var WORKER_ORIGIN = "https://disegni-cms-oauth.galdisegniart.workers.dev";
  var GEO_CACHE_KEY = "disegniGeoCountry";
  var GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  var LOCALE_CHOICE_KEY = "disegniLocaleChoice";

  var toggle = document.querySelector(".header-lang-toggle");
  var isEnPage = document.documentElement.lang === "en";

  // Once someone manually uses the toggle, remember their choice so the
  // logic below never overrides a real person's own decision again.
  if (toggle) {
    toggle.addEventListener("click", function () {
      try {
        localStorage.setItem(LOCALE_CHOICE_KEY, toggle.getAttribute("lang"));
      } catch (e) {}
    });
  }

  if (!isEnPage) return; // Hebrew pages always show the English toggle, nothing to decide here

  var explicitChoice = null;
  try {
    explicitChoice = localStorage.getItem(LOCALE_CHOICE_KEY);
  } catch (e) {}
  if (explicitChoice) return;

  function applyCountry(country) {
    if (country !== "IL") {
      if (toggle) toggle.hidden = true;
      return;
    }
    if (toggle) toggle.hidden = false;
    // In Israel and the browser itself is set to Hebrew - very likely a
    // Hebrew reader landing on the English default, so send them to the
    // Hebrew version once rather than making them find the toggle.
    var browserLangs = navigator.languages || [navigator.language || ""];
    var looksHebrew = browserLangs.some(function (lang) {
      return /^he/i.test(lang);
    });
    if (looksHebrew) {
      window.location.replace("/he" + window.location.pathname + window.location.search);
    }
  }

  var cachedRaw = null;
  try {
    cachedRaw = localStorage.getItem(GEO_CACHE_KEY);
  } catch (e) {}

  if (cachedRaw) {
    try {
      var cached = JSON.parse(cachedRaw);
      if (cached && Date.now() - cached.time < GEO_CACHE_TTL_MS) {
        applyCountry(cached.country);
        return;
      }
    } catch (e) {}
  }

  // Hide by default until the country is known, so a non-Israel visitor
  // never sees the Hebrew option flash on before disappearing.
  if (toggle) toggle.hidden = true;

  fetch(WORKER_ORIGIN + "/geo")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var country = (data && data.country) || null;
      try {
        localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ country: country, time: Date.now() }));
      } catch (e) {}
      applyCountry(country);
    })
    .catch(function () {
      // Network hiccup - fail open rather than permanently hiding a real
      // feature over a transient error.
      if (toggle) toggle.hidden = false;
    });
})();
