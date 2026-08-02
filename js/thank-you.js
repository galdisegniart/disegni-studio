(function () {
  var WORKER_ORIGIN = "https://disegni-cms-oauth.galdisegniart.workers.dev";
  var POLL_ATTEMPTS = 5;
  var POLL_DELAY_MS = 3000;

  localStorage.removeItem("disegniCart");
  localStorage.removeItem("disegniCartOrderId");

  document.querySelectorAll(".js-cart-count").forEach(function (badge) {
    badge.textContent = "0";
    badge.hidden = true;
  });

  var section = document.querySelector("[data-thank-you]");
  if (!section) return;

  var headingEl = section.querySelector("[data-thank-you-heading]");
  var leadEl = section.querySelector("[data-thank-you-lead]");

  function showState(state) {
    if (headingEl) headingEl.textContent = section.dataset["heading" + state] || "";
    if (leadEl) leadEl.textContent = section.dataset["lead" + state] || "";
  }

  var orderId = new URLSearchParams(window.location.search).get("order");
  if (!orderId) {
    // Some payment providers don't preserve query params on redirect back;
    // fall back to what cart.js stashed right before sending the browser
    // to the payment page.
    orderId = sessionStorage.getItem("disegniGrowOrderId");
  }
  sessionStorage.removeItem("disegniGrowOrderId");

  if (!orderId) {
    showState("Notfound");
    return;
  }

  function checkStatus(attemptsLeft) {
    fetch(WORKER_ORIGIN + "/orders/status?orderId=" + encodeURIComponent(orderId))
      .then(function (res) {
        if (!res.ok) throw new Error("status " + res.status);
        return res.json();
      })
      .then(function (data) {
        var status = data && data.status;
        if (status === "paid") {
          showState("Paid");
          return;
        }
        if (status === "failed" || status === "cancelled") {
          showState("Failed");
          return;
        }
        // created / pending / refunded / unknown: keep polling a few times,
        // then settle on "pending" rather than ever claiming success we
        // haven't actually verified.
        if (attemptsLeft > 0) {
          setTimeout(function () {
            checkStatus(attemptsLeft - 1);
          }, POLL_DELAY_MS);
        } else {
          showState("Pending");
        }
      })
      .catch(function () {
        if (attemptsLeft > 0) {
          setTimeout(function () {
            checkStatus(attemptsLeft - 1);
          }, POLL_DELAY_MS);
        } else {
          showState("Notfound");
        }
      });
  }

  checkStatus(POLL_ATTEMPTS);
})();
