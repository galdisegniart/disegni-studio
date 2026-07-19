document.querySelectorAll(".catalog-filters").forEach(function (group) {
  const buttons = group.querySelectorAll(".catalog-filter");
  const grid = document.querySelector(".artwork-grid");
  const cards = grid ? grid.querySelectorAll(".artwork-card") : [];
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      buttons.forEach(function (b) {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      const filter = btn.dataset.filter;
      cards.forEach(function (card) {
        const show = filter === "all" || card.dataset.category === filter;
        card.hidden = !show;
      });
    });
  });
});
