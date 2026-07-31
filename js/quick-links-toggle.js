(function () {
  var rail = document.querySelector(".quick-links-rail");
  var toggle = rail ? rail.querySelector(".quick-links-toggle") : null;
  if (!rail || !toggle) return;

  function close() {
    rail.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", function () {
    var open = rail.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("click", function (e) {
    if (!rail.contains(e.target)) close();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });
})();
