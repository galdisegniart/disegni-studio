document.querySelectorAll(".review-rating-buttons").forEach(function (group) {
  const buttons = group.querySelectorAll("button");
  const hiddenInput = group.parentElement.querySelector('input[type="hidden"]');
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const rating = Number(btn.dataset.rating);
      buttons.forEach(function (b) {
        const active = Number(b.dataset.rating) <= rating;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
      if (hiddenInput) hiddenInput.value = rating;
    });
  });
});

document.querySelectorAll(".review-form").forEach(function (form) {
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const status = form.querySelector(".review-form-status");
    const isEn = document.documentElement.lang === "en";
    const formData = new FormData(form);

    fetch("https://disegni-cms-oauth.galdisegniart.workers.dev/leads/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formType: "workshop-review",
        name: formData.get("reviewer") || "",
        message: formData.get("review") || "",
        rating: formData.get("rating") || "",
        context: form.dataset.workshop || "",
        locale: isEn ? "en" : "he",
        pageUrl: location.href
      })
    }).catch(function () {});

    if (status) {
      status.textContent = isEn
        ? "Thank you! Your review was received and will be posted after a quick check."
        : "תודה! חוות הדעת התקבלה ותועלה לאחר בדיקה קצרה.";
    }
    form.reset();
    form.querySelectorAll(".review-rating-buttons button").forEach(function (b) {
      b.classList.remove("is-active");
      b.setAttribute("aria-pressed", "false");
    });
  });
});
