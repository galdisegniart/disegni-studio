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
    if (status) status.textContent = "תודה! חוות הדעת התקבלה ותועלה לאחר בדיקה קצרה.";
    form.reset();
    form.querySelectorAll(".review-rating-buttons button").forEach(function (b) {
      b.classList.remove("is-active");
      b.setAttribute("aria-pressed", "false");
    });
  });
});
