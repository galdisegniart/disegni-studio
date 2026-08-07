(function () {
  var WORKER_ORIGIN = "https://disegni-cms-oauth.galdisegniart.workers.dev";
  var HEB_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
  var HEB_WEEKDAYS = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "יום שבת"];

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function isoOf(year, monthIndex, day) {
    return year + "-" + pad2(monthIndex + 1) + "-" + pad2(day);
  }

  function toDateObj(iso) {
    return new Date(iso + "T00:00:00");
  }

  function dateLabelOf(dateObj) {
    return HEB_WEEKDAYS[dateObj.getDay()] + ", " + dateObj.getDate() + " ב" + HEB_MONTHS[dateObj.getMonth()];
  }

  // "18:00–20:00" -> 1080. Mirrors slotStartMinutes() in the Worker so the
  // calendar and the server agree on what counts as too late in the day.
  function slotStartMinutes(time) {
    var match = /^\s*(\d{1,2}):(\d{2})/.exec(String(time || ""));
    if (!match) return null;
    var hours = Number(match[1]);
    var minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  // Generates every future date (starting tomorrow) within the booking
  // window whose weekday matches a recurring rule, then drops any
  // date+time already reserved by someone else or starting past the cutoff.
  function buildByDate(rules, windowWeeks, blocked, maxStartTime) {
    var byDate = {};
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var blockedSet = {};
    (blocked || []).forEach(function (b) {
      if (b && b.date && b.time) blockedSet[b.date + "|" + b.time] = true;
    });

    var maxStartMinutes = slotStartMinutes(maxStartTime);

    var totalDays = windowWeeks * 7;
    for (var i = 1; i <= totalDays; i++) {
      var d = new Date(today);
      d.setDate(d.getDate() + i);
      var weekday = d.getDay();
      var iso = isoOf(d.getFullYear(), d.getMonth(), d.getDate());
      var dateLabel = dateLabelOf(d);

      rules.forEach(function (rule) {
        if (Number(rule.weekday) !== weekday) return;
        if (blockedSet[iso + "|" + rule.time]) return;
        var startMinutes = slotStartMinutes(rule.time);
        if (startMinutes === null) return;
        if (maxStartMinutes !== null && startMinutes > maxStartMinutes) return;
        if (!byDate[iso]) byDate[iso] = [];
        byDate[iso].push({ date: iso, dateLabel: dateLabel, time: rule.time });
      });
    }

    return byDate;
  }

  function initCalendar(root) {
    var rulesEl = root.querySelector("[data-calendar-rules]");
    if (!rulesEl) return;

    var rules;
    try {
      rules = JSON.parse(rulesEl.textContent);
    } catch (e) {
      return;
    }
    if (!rules || !rules.length) return;

    var windowWeeks = Number(root.getAttribute("data-booking-window-weeks")) || 8;
    var workshopSlug = root.getAttribute("data-workshop-slug") || "";
    var cardTitle = root.getAttribute("data-card-title") || "";

    var maxStartTime = root.getAttribute("data-max-start-time") || "";

    fetch(WORKER_ORIGIN + "/bookings/blocked-dates")
      .then(function (response) {
        return response.ok ? response.json() : { blocked: [] };
      })
      .catch(function () {
        return { blocked: [] };
      })
      .then(function (result) {
        startCalendar(buildByDate(rules, windowWeeks, result.blocked || [], maxStartTime));
      });

    function startCalendar(byDate) {
      var sortedDates = Object.keys(byDate).sort();
      if (!sortedDates.length) return;

      var firstAvailable = sortedDates[0];
      var initialTarget = toDateObj(firstAvailable);
      var viewYear = initialTarget.getFullYear();
      var viewMonth = initialTarget.getMonth();

      var monthLabel = root.querySelector("[data-cal-month-label]");
      var grid = root.querySelector("[data-cal-grid]");
      var prevMonthBtn = root.querySelector("[data-cal-prev]");
      var nextMonthBtn = root.querySelector("[data-cal-next]");
      var nextAvailableBtn = root.querySelector("[data-cal-next-available]");
      var timesCol = root.querySelector("[data-cal-times]");
      var timesLabel = root.querySelector("[data-cal-date-label]");
      var timesList = root.querySelector("[data-cal-times-list]");
      var timesShowMoreBtn = root.querySelector("[data-cal-times-show-more]");
      var groupSelect = root.querySelector("[data-group-size-select]");
      var resetBtn = root.querySelector("[data-booking-reset]");
      var summaryDetails = root.querySelector("[data-booking-summary]");
      var summaryList = root.querySelector("[data-booking-summary-list]");
      var nextStepBtn = root.querySelector("[data-booking-next]");

      var flowSection = document.querySelector(".booking-flow-section");
      var confirmSection = document.querySelector("[data-booking-confirm]");
      var successSection = document.querySelector("[data-booking-success]");
      var confirmDetails = document.querySelector("[data-booking-confirm-details]");
      var confirmTotal = document.querySelector("[data-booking-confirm-total]");
      var confirmCta = document.querySelector("[data-booking-confirm-cta]");
      var confirmError = document.querySelector("[data-booking-confirm-error]");
      var successDetails = document.querySelector("[data-booking-success-details]");
      var consentBox = document.querySelector("[data-booking-consent]");
      var nameField = document.querySelector("[data-booking-name]");
      var phoneField = document.querySelector("[data-booking-phone]");
      var emailField = document.querySelector("[data-booking-email]");
      var backLink = document.querySelector("[data-booking-back]");

      function syncConsent() {
        if (!confirmCta) return;
        var ok = !consentBox || consentBox.checked;
        confirmCta.setAttribute("aria-disabled", ok ? "false" : "true");
        confirmCta.classList.toggle("is-disabled", !ok);
      }

      if (consentBox) {
        consentBox.addEventListener("change", syncConsent);
      }

      var selectedIso = null;
      var selectedTime = null;

      function groupOption() {
        return groupSelect ? groupSelect.selectedOptions[0] : null;
      }

      function currentEntry() {
        if (!selectedIso || !selectedTime) return null;
        var entries = byDate[selectedIso] || [];
        return entries.filter(function (e) {
          return e.time === selectedTime;
        })[0] || null;
      }

      function updateSelection() {
        var hasSelection = selectedIso && selectedTime;
        if (resetBtn) resetBtn.hidden = !hasSelection;
        if (nextStepBtn) nextStepBtn.disabled = !hasSelection;

        if (!hasSelection) {
          if (summaryDetails) summaryDetails.hidden = true;
          return;
        }

        var entry = currentEntry();
        if (!entry) return;
        var option = groupOption();

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

      function goToConfirm() {
        var entry = currentEntry();
        if (!entry) return;
        var option = groupOption();

        if (confirmDetails) {
          confirmDetails.innerHTML = "";
          var rows = [
            ["סדנה", cardTitle],
            ["תאריך", entry.dateLabel || selectedIso],
            ["שעה", entry.time]
          ];
          if (option) rows.push(["בחירה", option.dataset.label]);
          rows.forEach(function (pair) {
            var dt = document.createElement("dt");
            dt.textContent = pair[0];
            var dd = document.createElement("dd");
            dd.textContent = pair[1];
            confirmDetails.appendChild(dt);
            confirmDetails.appendChild(dd);
          });
        }

        if (confirmTotal) {
          confirmTotal.textContent = option ? option.dataset.price : "";
        }
        if (confirmError) {
          confirmError.hidden = true;
          confirmError.textContent = "";
        }
        syncConsent();

        if (flowSection) flowSection.hidden = true;
        if (confirmSection) confirmSection.hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      function backToFlow() {
        if (confirmSection) confirmSection.hidden = true;
        if (flowSection) flowSection.hidden = false;
      }

      function setConfirmError(message) {
        if (!confirmError) return;
        if (message) {
          confirmError.textContent = message;
          confirmError.hidden = false;
        } else {
          confirmError.textContent = "";
          confirmError.hidden = true;
        }
      }

      function submitBooking() {
        var entry = currentEntry();
        if (!entry) return;

        if (consentBox && !consentBox.checked) {
          setConfirmError("יש לאשר את התקנון לפני שריון המקום.");
          consentBox.focus();
          return;
        }

        var name = nameField ? nameField.value.trim() : "";
        var phone = phoneField ? phoneField.value.trim() : "";
        var email = emailField ? emailField.value.trim() : "";

        if (name.length < 2) {
          setConfirmError("יש להזין שם מלא.");
          if (nameField) nameField.focus();
          return;
        }
        if (!/^0\d{8,9}$/.test(phone)) {
          setConfirmError("יש להזין מספר טלפון ישראלי תקין (לדוגמה 0501234567).");
          if (phoneField) phoneField.focus();
          return;
        }

        var option = groupOption();
        setConfirmError("");
        if (confirmCta) {
          confirmCta.disabled = true;
          confirmCta.textContent = "משריין...";
        }

        fetch(WORKER_ORIGIN + "/bookings/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workshopSlug: workshopSlug,
            date: entry.date,
            time: entry.time,
            customerName: name,
            phone: phone,
            email: email,
            groupLabel: option ? option.dataset.label : ""
          })
        })
          .then(function (response) {
            return response.json().then(function (data) {
              return { ok: response.ok, status: response.status, data: data };
            });
          })
          .then(function (result) {
            if (!result.ok) {
              if (result.status === 409 || (result.data && result.data.error === "slot_taken")) {
                setConfirmError("המועד הזה נתפס הרגע על ידי מישהי אחרת - חוזרים ליומן לבחור מועד אחר.");
                setTimeout(function () {
                  backToFlow();
                  reset();
                  location.reload();
                }, 1800);
                return;
              }
              throw new Error("booking failed");
            }

            if (successDetails) {
              successDetails.textContent = cardTitle + " · " + (entry.dateLabel || entry.date) + " · " + entry.time;
            }
            if (confirmSection) confirmSection.hidden = true;
            if (successSection) successSection.hidden = false;
            window.scrollTo({ top: 0, behavior: "smooth" });
          })
          .catch(function () {
            setConfirmError("אירעה שגיאה בשריון המקום. הפרטים שהוזנו נשמרו - נסו שוב בעוד רגע.");
          })
          .finally(function () {
            if (confirmCta) {
              confirmCta.disabled = false;
              confirmCta.innerHTML = "קביעה עכשיו <span>←</span>";
            }
          });
      }

      if (confirmCta) {
        confirmCta.addEventListener("click", submitBooking);
      }

      // Matches the reference calendar's two-column layout of 5 rows before
      // it collapses the rest behind "צפייה בכל המפגשים".
      var TIMES_INITIAL_VISIBLE = 10;

      function showTimes(iso) {
        var entries = byDate[iso] || [];
        if (!entries.length) return;

        selectedIso = iso;
        selectedTime = null;
        timesList.innerHTML = "";
        timesLabel.textContent = "זמינות ב: " + (entries[0].dateLabel || iso);

        entries.forEach(function (entry, index) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "calendar-time-btn";
          btn.textContent = entry.time;
          if (index >= TIMES_INITIAL_VISIBLE) btn.hidden = true;
          btn.addEventListener("click", function () {
            var current = timesList.querySelectorAll(".calendar-time-btn.is-selected");
            for (var j = 0; j < current.length; j++) current[j].classList.remove("is-selected");
            btn.classList.add("is-selected");
            selectedTime = entry.time;
            updateSelection();
          });
          timesList.appendChild(btn);
          // Pre-selects the first available time, matching the reference
          // calendar's default so a single tap on the day is often enough.
          if (index === 0) btn.click();
        });

        if (timesShowMoreBtn) {
          timesShowMoreBtn.hidden = entries.length <= TIMES_INITIAL_VISIBLE;
        }

        timesCol.hidden = false;
      }

      if (timesShowMoreBtn) {
        timesShowMoreBtn.addEventListener("click", function () {
          var hiddenBtns = timesList.querySelectorAll(".calendar-time-btn[hidden]");
          for (var j = 0; j < hiddenBtns.length; j++) hiddenBtns[j].hidden = false;
          timesShowMoreBtn.hidden = true;
        });
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
        updateSelection();
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
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "calendar-day";
          btn.textContent = String(d);

          if (byDate[iso]) {
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

      prevMonthBtn.addEventListener("click", function () {
        viewMonth -= 1;
        if (viewMonth < 0) {
          viewMonth = 11;
          viewYear -= 1;
        }
        render();
      });

      nextMonthBtn.addEventListener("click", function () {
        viewMonth += 1;
        if (viewMonth > 11) {
          viewMonth = 0;
          viewYear += 1;
        }
        render();
      });

      if (nextAvailableBtn) {
        nextAvailableBtn.addEventListener("click", function () {
          var d = toDateObj(firstAvailable);
          viewYear = d.getFullYear();
          viewMonth = d.getMonth();
          render(firstAvailable);
        });
      }

      if (groupSelect) {
        groupSelect.addEventListener("change", updateSelection);
      }

      if (resetBtn) {
        resetBtn.addEventListener("click", reset);
      }

      if (nextStepBtn) {
        nextStepBtn.addEventListener("click", goToConfirm);
      }

      if (backLink) {
        backLink.addEventListener("click", function (e) {
          e.preventDefault();
          backToFlow();
        });
      }

      render();
      updateSelection();
    }
  }

  document.querySelectorAll("[data-calendar-root]").forEach(initCalendar);
})();
