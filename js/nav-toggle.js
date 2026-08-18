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

    // Blocking touchstart's default (to stop focus) has twice made the
    // button stop responding on the real device - abandoned. Plain click
    // is the reliable baseline; blur-on-focus is a harmless best-effort
    // attempt at the scroll jump that doesn't risk breaking the tap itself.
    dropdownToggle.addEventListener("focus", function () {
      dropdownToggle.blur();
    });

    dropdownToggle.addEventListener("click", function () {
      var expanded = dropdownToggle.getAttribute("aria-expanded") === "true";
      dropdownToggle.setAttribute("aria-expanded", String(!expanded));
      dropdown.classList.toggle("open", !expanded);
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

  // Temporary on-screen debug overlay, active only with ?navdebug in the
  // URL. Shows live scrollTop/focus/event data so the mobile nav jump can
  // be diagnosed without a computer. Safe to delete once solved.
  if (location.search.indexOf("navdebug") !== -1) {
    var panel = document.createElement("div");
    panel.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:99999;" +
      "max-height:40vh;overflow-y:auto;background:rgba(0,0,0,0.92);" +
      "color:#0f0;font:11px/1.4 monospace;padding:6px;white-space:pre-wrap;";
    document.body.appendChild(panel);
    var t0 = performance.now();
    function log(msg) {
      var line = document.createElement("div");
      line.textContent = (performance.now() - t0).toFixed(0) + "ms  " + msg;
      panel.appendChild(line);
      panel.scrollTop = panel.scrollHeight;
    }
    log("debug ready. nav.scrollTop=" + nav.scrollTop);
    nav.addEventListener("scroll", function () {
      log("nav SCROLL -> scrollTop=" + nav.scrollTop);
    });
    window.addEventListener(
      "scroll",
      function () {
        log("window SCROLL -> scrollY=" + window.scrollY);
      },
      true
    );
    nav.querySelectorAll(".nav-dropdown-toggle").forEach(function (btn) {
      ["touchstart", "touchend", "focus", "blur", "click"].forEach(function (evt) {
        btn.addEventListener(
          evt,
          function () {
            log(
              btn.getAttribute("aria-label") +
                " " +
                evt +
                "  nav.scrollTop=" +
                nav.scrollTop +
                "  active=" +
                (document.activeElement === btn)
            );
          },
          true
        );
      });
    });
  }
})();
