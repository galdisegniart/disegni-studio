(function () {
  var KEY = "disegniLastList";
  var lastPath = null;

  try {
    lastPath = sessionStorage.getItem(KEY);
  } catch (e) {
    lastPath = null;
  }

  if (!lastPath) {
    var ref = document.referrer;
    if (ref) {
      try {
        var url = new URL(ref);
        if (url.origin === window.location.origin && url.pathname.indexOf("/collections") === 0) {
          lastPath = url.pathname;
        }
      } catch (e) {
        lastPath = null;
      }
    }
  }

  if (!lastPath || lastPath.indexOf("/collections") !== 0) return;

  var labelText = "חזרה לחנות";
  if (lastPath.indexOf("/collections/originals") === 0) {
    labelText = "חזרה למקוריות זמינות";
  }

  document.querySelectorAll(".js-back-link").forEach(function (link) {
    link.setAttribute("href", lastPath);
    var label = link.querySelector(".js-back-label");
    if (label) label.textContent = labelText;
  });
})();
