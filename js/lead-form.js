const leadForm = document.getElementById("lead-form");
if (leadForm) {
  leadForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const data = new FormData(leadForm);
    const artwork = data.get("artwork");
    const purpose = data.get("purpose");
    const timeline = data.get("timeline");
    const message =
      "שלום גל, הגעתי דרך האתר. מתעניין/ת ב-" + artwork +
      ", עבור: " + purpose +
      ", מועד רצוי: " + timeline + ".";
    const url = "https://wa.me/972552902934?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener,noreferrer");
  });
}
