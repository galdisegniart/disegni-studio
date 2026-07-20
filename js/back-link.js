(function () {
  var ref = document.referrer;
  if (!ref) return;
  var url;
  try {
    url = new URL(ref);
  } catch (e) {
    return;
  }
  if (url.origin !== window.location.origin) return;
  if (url.pathname.indexOf("/shop") !== 0) return;

  document.querySelectorAll(".js-back-link").forEach(function (link) {
    link.setAttribute("href", "/shop/");
    var label = link.querySelector(".js-back-label");
    if (label) label.textContent = "חזרה לחנות";
  });
})();
