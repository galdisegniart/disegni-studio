(function () {
  var form = document.getElementById("bit-payment-form");
  if (!form) return;

  // Posts straight to the Worker, which stores the pending record itself -
  // the old Make webhook only forwarded here after duplicating the same
  // validation, and its scenario slot is needed for Grow checkout.
  var WEBHOOK_URL = "https://disegni-cms-oauth.galdisegniart.workers.dev/bit-receipts/submit";
  var EXTRACT_URL = "https://disegni-cms-oauth.galdisegniart.workers.dev/bit-receipts/extract";
  var MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

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

  // Optional screenshot-to-form autofill. Purely a convenience layer -
  // manual typing stays available and every field it fills remains editable.
  var screenshotInput = document.getElementById("bit-payment-screenshot");
  var uploadStatusEl = document.querySelector(".js-bit-upload-status");

  function setUploadStatus(message, state) {
    if (!uploadStatusEl) return;
    if (!message) {
      uploadStatusEl.hidden = true;
      uploadStatusEl.removeAttribute("data-state");
      return;
    }
    uploadStatusEl.textContent = message;
    uploadStatusEl.hidden = false;
    if (state) {
      uploadStatusEl.setAttribute("data-state", state);
    } else {
      uploadStatusEl.removeAttribute("data-state");
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(reader.error);
      };
      reader.readAsDataURL(file);
    });
  }

  function handleScreenshotFile(file) {
    if (!/^image\//.test(file.type)) {
      setUploadStatus("הקובץ שנבחר אינו תמונה. אפשר למלא את הטופס ידנית.", "error");
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setUploadStatus("הקובץ גדול מדי (עד 5MB). אפשר למלא את הטופס ידנית.", "error");
      return;
    }

    setUploadStatus("קורא את הפרטים...", null);

    readFileAsDataUrl(file)
      .then(function (dataUrl) {
        return fetch(EXTRACT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        });
      })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, status: response.status, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          if (result.status === 429) {
            setUploadStatus("נשלחו יותר מדי בקשות. נסו שוב בעוד כמה דקות, או מלאו ידנית.", "error");
            return;
          }
          setUploadStatus("לא הצלחנו לקרוא את התמונה. אפשר למלא/לתקן ידנית.", "error");
          return;
        }

        var extracted = (result.data && result.data.extracted) || {};
        var confidence = result.data && result.data.confidence;
        var filledAny = false;

        ["customerName", "phone", "email", "amount", "paymentDate", "description", "bitReference"].forEach(
          function (field) {
            var value = extracted[field];
            if (value === undefined || value === null || String(value).trim() === "") return;
            var input = form.elements[field];
            if (!input) return;
            input.value = value;
            filledAny = true;
          }
        );

        if (confidence === "full") {
          setUploadStatus("הפרטים זוהו ומולאו אוטומטית - כדאי לבדוק לפני שליחה.", "ok");
        } else if (filledAny) {
          setUploadStatus("לא הצלחנו לזהות הכל - אפשר למלא/לתקן את שאר השדות ידנית.", "error");
        } else {
          setUploadStatus("לא הצלחנו לזהות פרטים בתמונה. אפשר למלא ידנית.", "error");
        }
      })
      .catch(function () {
        setUploadStatus("אירעה שגיאה בקריאת התמונה. אפשר למלא ידנית.", "error");
      });
  }

  if (screenshotInput) {
    screenshotInput.addEventListener("change", function () {
      var file = screenshotInput.files && screenshotInput.files[0];
      screenshotInput.value = "";
      if (!file) return;
      handleScreenshotFile(file);
    });
  }

  // Same autofill, triggered by pasting an image (Ctrl+V on desktop, "paste"
  // from a long-press menu on mobile) instead of picking a file.
  var pasteTarget = document.querySelector(".js-bit-paste-target");
  if (pasteTarget) {
    pasteTarget.addEventListener("paste", function (event) {
      var items = (event.clipboardData && event.clipboardData.items) || [];
      var imageItem = Array.prototype.find.call(items, function (item) {
        return item.kind === "file" && /^image\//.test(item.type);
      });
      if (!imageItem) return;
      event.preventDefault();
      var file = imageItem.getAsFile();
      if (file) handleScreenshotFile(file);
    });
  }

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
