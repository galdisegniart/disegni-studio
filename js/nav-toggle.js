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
    nav.querySelectorAll(".nav-dropdown-toggle").forEach(function (dropdownToggle) {
      dropdownToggle.setAttribute("aria-expanded", "false");
    });
    nav.querySelectorAll(".nav-dropdown.open").forEach(function (dropdown) {
      dropdown.classList.remove("open");
    });
  }

  toggle.addEventListener("click", function () {
    var searchToggle = document.querySelector(".header-search-toggle");
    if (searchToggle && searchToggle.getAttribute("aria-expanded") === "true") {
      searchToggle.click();
    }
    if (nav.classList.contains("open")) {
      closeNav();
    } else {
      openNav();
    }
  });

  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", closeNav);
  });

  nav.querySelectorAll(".nav-dropdown-toggle").forEach(function (dropdownToggle) {
    var dropdown = dropdownToggle.closest(".nav-item").querySelector(".nav-dropdown");
    dropdownToggle.addEventListener("click", function () {
      var expanded = dropdownToggle.getAttribute("aria-expanded") === "true";
      dropdownToggle.setAttribute("aria-expanded", String(!expanded));
      dropdown.classList.toggle("open", !expanded);
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNav();
  });
})();
