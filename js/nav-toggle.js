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

    // Mobile browsers auto-scroll a tapped button into view once it takes
    // focus, which is what causes the category list to jump up when its
    // dropdown opens. Stop the button from taking focus on touch/pointer
    // interaction in the first place (it stays focusable for keyboard use),
    // so there's nothing for the browser to "follow" with a scroll.
    ["pointerdown", "touchstart"].forEach(function (evtName) {
      dropdownToggle.addEventListener(
        evtName,
        function (e) {
          e.preventDefault();
        },
        { passive: false }
      );
    });

    dropdownToggle.addEventListener("click", function () {
      var expanded = dropdownToggle.getAttribute("aria-expanded") === "true";
      dropdownToggle.setAttribute("aria-expanded", String(!expanded));
      dropdown.classList.toggle("open", !expanded);
      // Belt-and-suspenders: also re-pin the nav's scroll position on every
      // frame for the duration of the open transition, in case something
      // still nudges it (e.g. keyboard activation, which does focus).
      var lockedScrollTop = nav.scrollTop;
      var repinStart = performance.now();
      (function repin(now) {
        nav.scrollTop = lockedScrollTop;
        if (now - repinStart < 400) requestAnimationFrame(repin);
      })(repinStart);
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
