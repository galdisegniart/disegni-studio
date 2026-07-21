document.addEventListener("click", function (e) {
  var btn = e.target.closest(".js-share");
  if (!btn) return;

  var shareData = {
    title: btn.dataset.shareTitle || document.title,
    text: btn.dataset.shareText || "",
    url: window.location.href,
  };

  if (navigator.share) {
    navigator.share(shareData).catch(function () {});
    return;
  }

  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(shareData.url)
      .then(function () {
        var original = btn.querySelector(".js-share-label");
        if (!original) return;
        var prev = original.textContent;
        original.textContent = "הקישור הועתק!";
        setTimeout(function () {
          original.textContent = prev;
        }, 2000);
      })
      .catch(function () {
        window.prompt("העתיקו את הקישור:", shareData.url);
      });
    return;
  }

  window.prompt("העתיקו את הקישור:", shareData.url);
});
