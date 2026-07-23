(function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("main-nav");
  var social = document.querySelector(".quick-links-rail");
  if (!toggle || !nav) return;

  function openNav() {
    nav.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
    if (social) social.classList.add("is-hidden");
    document.body.classList.add("nav-open-lock");
  }

  function closeNav() {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    if (social) social.classList.remove("is-hidden");
    document.body.classList.remove("nav-open-lock");
  }

  toggle.addEventListener("click", function () {
    if (nav.classList.contains("open")) {
      closeNav();
    } else {
      openNav();
    }
  });

  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", closeNav);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNav();
  });
})();
