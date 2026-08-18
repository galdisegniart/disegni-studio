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
    var touchHandled = false;

    function toggleDropdown() {
      var expanded = dropdownToggle.getAttribute("aria-expanded") === "true";
      dropdownToggle.setAttribute("aria-expanded", String(!expanded));
      dropdown.classList.toggle("open", !expanded);
    }

    // The jump happens the instant the button takes focus on touch (mobile
    // browsers auto-scroll a newly-focused button into view), before any of
    // our click-handler code runs. Stop that focus from happening at all by
    // preventing touchstart's default, and handle the tap ourselves on
    // touchend instead of the click that would otherwise follow - a plain
    // click listener never fires once touchstart's default is prevented.
    dropdownToggle.addEventListener(
      "touchstart",
      function (e) {
        e.preventDefault();
      },
      { passive: false }
    );

    dropdownToggle.addEventListener("touchend", function (e) {
      e.preventDefault();
      touchHandled = true;
      toggleDropdown();
      window.setTimeout(function () {
        touchHandled = false;
      }, 500);
    });

    // Keyboard/mouse path: focus here is expected and fine, no jump risk.
    dropdownToggle.addEventListener("click", function () {
      if (touchHandled) return;
      toggleDropdown();
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
