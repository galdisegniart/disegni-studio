(function () {
  var form = document.getElementById("bit-payment-form");
  if (!form) return;

  var WEBHOOK_URL = "https://hook.eu1.make.com/d2aacql2eg4kvn4mywobklbeetdgggij";

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
        if (!response.ok) throw new Error("Webhook responded with " + response.status);
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
