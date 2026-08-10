(function () {
  var form = document.getElementById("bit-payment-form");
  if (!form) return;

  // Posts straight to the Worker, which stores the pending record itself -
  // the old Make webhook only forwarded here after duplicating the same
  // validation, and its scenario slot is needed for Grow checkout.
  var WEBHOOK_URL = "https://disegni-cms-oauth.galdisegniart.workers.dev/bit-receipts/submit";

  // Silently remembers name/phone/email in this browser after a successful
  // submission, so a returning customer doesn't have to retype them. Never
  // shown to the customer as a choice - just quietly pre-filled.
  var REMEMBERED_KEY = "disegniBitPaymentContact";

  function prefillRememberedContact() {
    var saved;
    try {
      saved = JSON.parse(localStorage.getItem(REMEMBERED_KEY) || "null");
    } catch (e) {
      saved = null;
    }
    if (!saved) return;
    ["customerName", "phone", "email"].forEach(function (field) {
      var input = form.elements[field];
      if (input && !input.value && saved[field]) input.value = saved[field];
    });
  }

  function rememberContact(payload) {
    try {
      localStorage.setItem(
        REMEMBERED_KEY,
        JSON.stringify({
          customerName: payload.customerName,
          phone: payload.phone,
          email: payload.email,
        })
      );
    } catch (e) {}
  }

  prefillRememberedContact();

  var submitBtn = form.querySelector(".lead-submit");
  var successEl = form.querySelector(".js-bit-payment-success");
  var errorEl = form.querySelector(".js-bit-payment-error");

  function setError(message) {
    if (!errorEl) return;
    if (message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    } else {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitBtn && submitBtn.disabled) return;

    setError("");
    if (successEl) successEl.hidden = true;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var data = new FormData(form);
    var amountValue = parseFloat(data.get("amount"));
    if (!(amountValue > 0)) {
      setError("סכום ששולם חייב להיות מספר חיובי.");
      return;
    }

    var payload = {
      customerName: (data.get("customerName") || "").trim(),
      phone: (data.get("phone") || "").trim(),
      email: (data.get("email") || "").trim(),
      amount: amountValue,
      paymentDate: (data.get("paymentDate") || "").trim(),
      description: (data.get("description") || "").trim(),
      bitReference: (data.get("bitReference") || "").trim(),
    };

    if (submitBtn) submitBtn.disabled = true;

    fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, status: response.status, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          if (result.data && result.data.code === "duplicate_bit_reference") {
            setError("האסמכתה הזו כבר נשלחה. אם זו טעות, אפשר ליצור קשר ונבדוק יחד.");
            return;
          }
          if (result.status === 429) {
            setError("נשלחו יותר מדי בקשות. נסו שוב בעוד כמה דקות.");
            return;
          }
          throw new Error("submit failed");
        }
        rememberContact(payload);
        if (successEl) successEl.hidden = false;
        form.reset();
      })
      .catch(function () {
        setError("אירעה שגיאה בשליחה. הפרטים שהוזנו נשמרו - נסו שוב בעוד רגע.");
      })
      .finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });

  form.addEventListener("input", function () {
    if (successEl) successEl.hidden = true;
  });
})();
