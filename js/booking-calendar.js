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
    var timesCol = root.querySelector("[data-cal-times]");
    var timesLabel = root.querySelector("[data-cal-date-label]");
    var timesList = root.querySelector("[data-cal-times-list]");
    var groupSelect = root.querySelector("[data-group-size-select]");
    var resetBtn = root.querySelector("[data-booking-reset]");
    var summaryDetails = root.querySelector("[data-booking-summary]");
    var summaryList = root.querySelector("[data-booking-summary-list]");
    var ctaLink = root.querySelector("[data-booking-cta]");

    var waBase = root.getAttribute("data-wa-base") || "";
    var cardTitle = root.getAttribute("data-card-title") || "";

    var selectedIso = null;
    var selectedTime = null;

    function groupOption() {
      return groupSelect ? groupSelect.selectedOptions[0] : null;
    }

    function updateCta() {
      var hasSelection = selectedIso && selectedTime;
      if (resetBtn) resetBtn.hidden = !hasSelection;

      if (!hasSelection) {
        if (ctaLink) {
          ctaLink.setAttribute("aria-disabled", "true");
          ctaLink.removeAttribute("href");
        }
        if (summaryDetails) summaryDetails.hidden = true;
        return;
      }

      var entries = byDate[selectedIso] || [];
      var entry = entries.filter(function (e) {
        return e.time === selectedTime;
      })[0];
      if (!entry) return;

      var option = groupOption();
      var msg = "שלום גל, הגעתי דרך האתר ואשמח לקבוע מקום ב" + cardTitle + " בתאריך " + (entry.dateLabel || selectedIso) + ", בשעה " + entry.time + ".";
      if (option) {
        msg += " כמות משתתפים: " + option.dataset.label + " (" + option.dataset.price + ").";
      }

      if (ctaLink) {
        ctaLink.href = waBase + encodeURIComponent(msg);
        ctaLink.removeAttribute("aria-disabled");
      }

      if (summaryDetails && summaryList) {
        summaryList.innerHTML = "";
        var rows = [
          ["תאריך", entry.dateLabel || selectedIso],
          ["שעה", entry.time]
        ];
        if (option) rows.push(["בחירה", option.dataset.label + " — " + option.dataset.price]);
        rows.forEach(function (pair) {
          var dt = document.createElement("dt");
          dt.textContent = pair[0];
          var dd = document.createElement("dd");
          dd.textContent = pair[1];
          summaryList.appendChild(dt);
          summaryList.appendChild(dd);
        });
        summaryDetails.hidden = false;
      }
    }

    function showTimes(iso) {
      var entries = byDate[iso] || [];
      if (!entries.length) return;

      selectedIso = iso;
      selectedTime = null;
      timesList.innerHTML = "";
      timesLabel.textContent = "זמינות ב: " + (entries[0].dateLabel || iso);

      entries.forEach(function (entry) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "calendar-time-btn";
        btn.textContent = entry.time;
        btn.addEventListener("click", function () {
          var current = timesList.querySelectorAll(".calendar-time-btn.is-selected");
          for (var j = 0; j < current.length; j++) current[j].classList.remove("is-selected");
          btn.classList.add("is-selected");
          selectedTime = entry.time;
          updateCta();
        });
        timesList.appendChild(btn);
      });

      timesCol.hidden = false;
      updateCta();
    }

    function selectDay(btn, iso) {
      var current = grid.querySelectorAll(".calendar-day.is-selected");
      for (var j = 0; j < current.length; j++) current[j].classList.remove("is-selected");
      btn.classList.add("is-selected");
      showTimes(iso);
    }

    function reset() {
      selectedIso = null;
      selectedTime = null;
      timesCol.hidden = true;
      var current = grid.querySelectorAll(".calendar-day.is-selected");
      for (var j = 0; j < current.length; j++) current[j].classList.remove("is-selected");
      if (groupSelect) groupSelect.selectedIndex = 0;
      updateCta();
    }

    function render(selectIso) {
      grid.innerHTML = "";
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

    if (groupSelect) {
      groupSelect.addEventListener("change", updateCta);
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", reset);
    }

    render();
    updateCta();
  }

  document.querySelectorAll("[data-calendar-root]").forEach(initCalendar);
})();
