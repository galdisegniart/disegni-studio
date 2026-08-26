(function () {
  var form = document.getElementById("footer-contact-form");
  if (!form) return;

  var waNumber = document.body.dataset.whatsapp || "972552902934";
  var submitBtn = form.querySelector(".lead-submit");
  var successEl = form.querySelector(".js-footer-contact-success");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var data = new FormData(form);
    var firstName = (data.get("firstName") || "").trim();
    var lastName = (data.get("lastName") || "").trim();
    var email = (data.get("email") || "").trim();
    var phone = (data.get("phone") || "").trim();
    var message = (data.get("message") || "").trim();

    var isEn = document.documentElement.lang === "en";
    var lines = isEn
      ? [
          "Hi Gal, I found you through the website and would love to get in touch.",
          "Name: " + (firstName + " " + lastName).trim(),
          "Phone: " + phone,
          "Email: " + email
        ]
      : [
          "שלום גל, הגעתי דרך האתר ואשמח ליצור קשר.",
          "שם: " + (firstName + " " + lastName).trim(),
          "טלפון: " + phone,
          "אימייל: " + email
        ];
    if (message) lines.push((isEn ? "Message: " : "הודעה: ") + message);

    var url = "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(lines.join("\n"));
    window.open(url, "_blank", "noopener,noreferrer");

    if (successEl) successEl.hidden = false;
    form.reset();
    if (submitBtn) submitBtn.disabled = false;
  });

  form.addEventListener("input", function () {
    if (successEl) successEl.hidden = true;
  });
})();
