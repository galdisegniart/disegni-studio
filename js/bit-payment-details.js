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

  var TESSERACT_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

  // The screenshot never leaves the browser - OCR runs entirely client-side
  // via Tesseract.js, loaded lazily so pages that never use the upload
  // button don't pay for it. Only the recognized text (not the image) is
  // later sent to the Worker, and only for the saved-contact keyword match.
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (loadTesseract._promise) return loadTesseract._promise;
    loadTesseract._promise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = TESSERACT_SCRIPT_URL;
      script.onload = function () {
        resolve(window.Tesseract);
      };
      script.onerror = function () {
        reject(new Error("Failed to load Tesseract.js"));
      };
      document.head.appendChild(script);
    });
    return loadTesseract._promise;
  }

  // Best-effort regex extraction from the raw OCR text, tuned against a real
  // Bit confirmation screen: amount as "₪300" (no space), a DD.MM.YY date
  // (two-digit year), and a reference number shaped like "1078-6516-06849" -
  // matched directly rather than by its "מספר אישור" label, since that label
  // can land before or after the digits in OCR's left-to-right reading of
  // the screen's right-to-left rows.
  function extractFieldsFromText(text) {
    var result = {};

    var amountMatch = /₪\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*₪/.exec(text);
    if (amountMatch) {
      var amountNum = parseFloat((amountMatch[1] || amountMatch[2]).replace(/,/g, ""));
      if (isFinite(amountNum) && amountNum > 0) result.amount = amountNum;
    }

    var dateMatch = /(\d{1,2})[./](\d{1,2})[./](\d{2,4})/.exec(text);
    if (dateMatch) {
      var day = dateMatch[1].length < 2 ? "0" + dateMatch[1] : dateMatch[1];
      var month = dateMatch[2].length < 2 ? "0" + dateMatch[2] : dateMatch[2];
      var year = dateMatch[3].length === 2 ? "20" + dateMatch[3] : dateMatch[3];
      result.paymentDate = year + "-" + month + "-" + day;
    }

    var refMatch = /(\d{3,4}-\d{3,4}-\d{4,5})/.exec(text);
    if (refMatch) result.bitReference = refMatch[1];

    return result;
  }

  // Real app screenshots (icons, colored backgrounds, small text) OCR far
  // worse than clean text on white - upscaling plus grayscale/contrast
  // meaningfully helps Tesseract on that kind of image. Falls back to the
  // original file untouched if anything here isn't supported.
  function preprocessImageForOcr(file) {
    if (typeof createImageBitmap !== "function") return Promise.resolve(file);
    return createImageBitmap(file)
      .then(function (bitmap) {
        var scale = 2;
        var canvas = document.createElement("canvas");
        canvas.width = bitmap.width * scale;
        canvas.height = bitmap.height * scale;
        var ctx = canvas.getContext("2d");
        if (!ctx) return file;
        if ("filter" in ctx) ctx.filter = "grayscale(1) contrast(1.4) brightness(1.05)";
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return canvas;
      })
      .catch(function () {
        return file;
      });
  }

  // A rough guess at the free-text note the payer wrote (for prefilling the
  // visible "description" field) - drops lines that are clearly just the
  // amount/date/labels rather than an actual note. Always editable either way.
  function extractDescriptionCandidate(text) {
    var lines = text
      .split(/\n+/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);
    var meaningful = lines.filter(function (line) {
      if (line.length < 2) return false;
      if (/^[\d.,/:\s₪+-]*$/.test(line)) return false;
      // Checked anywhere in the line, not just at the start - OCR's
      // left-to-right reading of an RTL row can put the value before the
      // label (e.g. "1078-6516-06849 מספר אישור ב-bit").
      if (/אסמכת|מספר\s*אישור|תאריך|סטטוס|שעה|Bit|בוצע|העבר|הועבר|קיבל/.test(line)) return false;
      return true;
    });
    return meaningful.join(" ").slice(0, 500);
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

    setUploadStatus("קורא את הפרטים... (יכול לקחת כמה שניות)", null);

    Promise.all([loadTesseract(), preprocessImageForOcr(file)])
      .then(function (results) {
        return results[0].recognize(results[1], "heb+eng");
      })
      .then(function (result) {
        var rawText = (result && result.data && result.data.text) || "";
        var fields = extractFieldsFromText(rawText);
        var descriptionCandidate = extractDescriptionCandidate(rawText);

        if (fields.amount != null) form.elements.amount.value = fields.amount;
        if (fields.paymentDate) form.elements.paymentDate.value = fields.paymentDate;
        if (fields.bitReference) form.elements.bitReference.value = fields.bitReference;
        if (descriptionCandidate) form.elements.description.value = descriptionCandidate;

        // Matching is server-side only, and only the raw OCR text (not the
        // image) is sent - the full text gives the best chance of containing
        // whatever keyword a saved contact was set up with.
        return fetch(EXTRACT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: rawText }),
        })
          .then(function (response) {
            return response.json().then(function (data) {
              return { ok: response.ok, status: response.status, data: data };
            });
          })
          .then(function (matchResult) {
            var matchedContact = matchResult.ok && matchResult.data && matchResult.data.matchedContact;
            if (matchedContact) {
              form.elements.customerName.value = matchedContact.firstName + " " + matchedContact.lastName;
              if (matchedContact.phone) form.elements.phone.value = matchedContact.phone;
              if (matchedContact.email) form.elements.email.value = matchedContact.email;
              if (matchedContact.serviceType) form.elements.description.value = matchedContact.serviceType;
              setUploadStatus("זוהיתם אוטומטית - כדאי לבדוק את הפרטים לפני שליחה.", "ok");
            } else {
              setUploadStatus("לא זוהתה התאמה אוטומטית - נא למלא ידנית את שאר הפרטים.", null);
            }
          })
          .catch(function () {
            // The contact match is a bonus on top of the OCR fields above,
            // which are already filled in - a network hiccup here shouldn't
            // look like total failure.
            setUploadStatus("לא זוהתה התאמה אוטומטית - נא למלא ידנית את שאר הפרטים.", null);
          });
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
