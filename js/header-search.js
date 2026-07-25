(function () {
  var toggle = document.querySelector(".header-search-toggle");
  var panel = document.getElementById("header-search");
  if (!toggle || !panel) return;

  var input = panel.querySelector(".js-header-search-input");
  var close = panel.querySelector(".header-search-close");
  var hint = panel.querySelector(".header-search-hint");
  var results = Array.prototype.slice.call(panel.querySelectorAll(".header-search-result"));

  function updateResults() {
    var query = input.value.trim().toLocaleLowerCase("he");
    var visibleCount = 0;

    results.forEach(function (result) {
      var text = (result.getAttribute("data-search-text") || "").toLocaleLowerCase("he");
      var visible = query.length >= 2 && text.indexOf(query) !== -1;
      result.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    if (query.length < 2) {
      hint.textContent = "הקלידו לפחות שתי אותיות";
    } else if (!visibleCount) {
      hint.textContent = "לא נמצאו תוצאות";
    } else {
      hint.textContent = visibleCount + " תוצאות";
    }
  }

  function openSearch() {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("search-open-lock");
    window.requestAnimationFrame(function () {
      input.focus();
    });
  }

  function closeSearch() {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("search-open-lock");
    input.value = "";
    updateResults();
    toggle.focus();
  }

  toggle.addEventListener("click", function () {
    var navToggle = document.querySelector(".nav-toggle");
    if (panel.hidden && navToggle && navToggle.getAttribute("aria-expanded") === "true") {
      navToggle.click();
    }
    if (panel.hidden) openSearch();
    else closeSearch();
  });

  close.addEventListener("click", closeSearch);
  input.addEventListener("input", updateResults);
  input.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;
    var firstResult = results.find(function (result) {
      return !result.hidden;
    });
    if (firstResult) firstResult.click();
  });

  panel.addEventListener("click", function (event) {
    if (event.target === panel) closeSearch();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) closeSearch();
  });
})();
