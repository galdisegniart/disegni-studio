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
      // Mobile browsers auto-scroll a focused button into view when the
      // layout around it changes height; re-pin the nav's scroll position
      // so opening a dropdown expands downward instead of jumping the list.
      var lockedScrollTop = nav.scrollTop;
      requestAnimationFrame(function () {
        nav.scrollTop = lockedScrollTop;
        requestAnimationFrame(function () {
          nav.scrollTop = lockedScrollTop;
        });
      });
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNav();
    if (e.key === "Tab" && nav.classList.contains("open")) {
      var focusable = [toggle].concat(
        Array.prototype.slice.call(
          nav.querySelectorAll(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        )
      );
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
})();
