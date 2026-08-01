(function () {
  var HEB_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function isoOf(year, monthIndex, day) {
    return year + "-" + pad2(monthIndex + 1) + "-" + pad2(day);
  }

  function toDateObj(iso) {
    return new Date(iso + "T00:00:00");
  }

  function initCalendar(root) {
    var slotsEl = root.querySelector("[data-calendar-slots]");
    if (!slotsEl) return;

    var slots;
    try {
      slots = JSON.parse(slotsEl.textContent);
    } catch (e) {
      return;
    }
    if (!slots || !slots.length) return;

    var byDate = {};
    slots.forEach(function (s) {
      if (!s || !s.date) return;
      if (!byDate[s.date]) byDate[s.date] = [];
      byDate[s.date].push(s);
    });

    var sortedDates = Object.keys(byDate).sort();
    if (!sortedDates.length) return;

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    // Same-day booking isn't offered through the site - earliest bookable date is tomorrow.
    var firstAvailable = sortedDates.filter(function (iso) {
      return toDateObj(iso) > today;
    })[0];

    var initialTarget = firstAvailable ? toDateObj(firstAvailable) : today;
    var viewYear = initialTarget.getFullYear();
    var viewMonth = initialTarget.getMonth();

    var monthLabel = root.querySelector("[data-cal-month-label]");
    var grid = root.querySelector("[data-cal-grid]");
    var prevBtn = root.querySelector("[data-cal-prev]");
    var nextBtn = root.querySelector("[data-cal-next]");
    var nextAvailableBtn = root.querySelector("[data-cal-next-available]");
    var timesWrap = root.querySelector("[data-cal-times]");
    var timesLabel = root.querySelector("[data-cal-date-label]");
    var timesList = root.querySelector("[data-cal-times-list]");

    var waBase = root.getAttribute("data-wa-base") || "";
    var cardTitle = root.getAttribute("data-card-title") || "";
    var groupSelect = root.querySelector("[data-group-size-select]");
    var currentIso = null;

    function showTimes(iso) {
      var entries = byDate[iso] || [];
      if (!entries.length) return;

      currentIso = iso;
      timesList.innerHTML = "";
      timesLabel.textContent = entries[0].dateLabel || iso;

      var groupOption = groupSelect ? groupSelect.selectedOptions[0] : null;

      entries.forEach(function (entry) {
        var link = document.createElement("a");
        link.className = "calendar-time-btn";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        var msg = "שלום גל, הגעתי דרך האתר ואשמח לקבוע מקום ב" + cardTitle + " בתאריך " + (entry.dateLabel || iso) + ", בשעה " + entry.time + ".";
        if (groupOption) {
          msg += " כמות משתתפים: " + groupOption.dataset.label + " (" + groupOption.dataset.price + ").";
        }
        link.href = waBase + encodeURIComponent(msg);
        link.textContent = entry.time;
        timesList.appendChild(link);
      });

      timesWrap.hidden = false;
    }

    if (groupSelect) {
      groupSelect.addEventListener("change", function () {
        if (currentIso) showTimes(currentIso);
      });
    }

    function selectDay(btn, iso) {
      var current = grid.querySelectorAll(".calendar-day.is-selected");
      for (var j = 0; j < current.length; j++) current[j].classList.remove("is-selected");
      btn.classList.add("is-selected");
      showTimes(iso);
    }

    function render(selectIso) {
      grid.innerHTML = "";
      timesWrap.hidden = true;
      monthLabel.textContent = HEB_MONTHS[viewMonth] + " " + viewYear;

      var firstOfMonth = new Date(viewYear, viewMonth, 1);
      var startWeekday = firstOfMonth.getDay();
      var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

      for (var i = 0; i < startWeekday; i++) {
        var empty = document.createElement("span");
        empty.className = "calendar-day calendar-day-empty";
        grid.appendChild(empty);
      }

      for (var d = 1; d <= daysInMonth; d++) {
        var iso = isoOf(viewYear, viewMonth, d);
        var dateObj = new Date(viewYear, viewMonth, d);
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "calendar-day";
        btn.textContent = String(d);

        if (byDate[iso] && dateObj > today) {
          btn.classList.add("is-available");
          btn.addEventListener("click", (function (dayBtn, dayIso) {
            return function () {
              selectDay(dayBtn, dayIso);
            };
          })(btn, iso));

          if (selectIso && iso === selectIso) {
            btn.classList.add("is-selected");
          }
        } else {
          btn.disabled = true;
          btn.classList.add("is-disabled");
        }

        grid.appendChild(btn);
      }

      if (selectIso && byDate[selectIso]) {
        showTimes(selectIso);
      }
    }

    prevBtn.addEventListener("click", function () {
      viewMonth -= 1;
      if (viewMonth < 0) {
        viewMonth = 11;
        viewYear -= 1;
      }
      render();
    });

    nextBtn.addEventListener("click", function () {
      viewMonth += 1;
      if (viewMonth > 11) {
        viewMonth = 0;
        viewYear += 1;
      }
      render();
    });

    if (nextAvailableBtn) {
      if (!firstAvailable) {
        nextAvailableBtn.hidden = true;
      } else {
        nextAvailableBtn.addEventListener("click", function () {
          var d = toDateObj(firstAvailable);
          viewYear = d.getFullYear();
          viewMonth = d.getMonth();
          render(firstAvailable);
        });
      }
    }

    render(firstAvailable);
  }

  document.querySelectorAll("[data-calendar-root]").forEach(initCalendar);
})();
