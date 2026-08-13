document.querySelectorAll(".catalog-filters").forEach(function (group) {
  const buttons = group.querySelectorAll(".catalog-filter");
  const grid = document.querySelector(".artwork-grid");
  const cards = grid ? grid.querySelectorAll(".artwork-card") : [];

  function applyFilter(filter) {
    buttons.forEach(function (b) {
      const active = b.dataset.filter === filter;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    cards.forEach(function (card) {
      const show = filter === "all" || card.dataset.category === filter;
      card.hidden = !show;
    });
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyFilter(btn.dataset.filter);
    });
  });

  // Lets a nav link (e.g. /collections/apparel/?category=women) land
  // pre-filtered, without needing a separate page per category.
  const requestedCategory = new URLSearchParams(window.location.search).get("category");
  if (requestedCategory && group.querySelector('[data-filter="' + requestedCategory + '"]')) {
    applyFilter(requestedCategory);
  }
});
