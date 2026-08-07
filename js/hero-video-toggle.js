(function () {
  var video = document.querySelector(".js-hero-video");
  var toggle = document.querySelector(".js-hero-video-toggle");
  if (!video || !toggle) return;

  var pauseIcon = toggle.querySelector(".hero-video-toggle-icon-pause");
  var playIcon = toggle.querySelector(".hero-video-toggle-icon-play");
  var srLabel = toggle.querySelector(".sr-only");

  function setPaused(isPaused) {
    toggle.setAttribute("aria-pressed", String(isPaused));
    pauseIcon.hidden = isPaused;
    playIcon.hidden = !isPaused;
    srLabel.textContent = isPaused ? "הפעלת הסרטון" : "השהיית הסרטון";
  }

  toggle.addEventListener("click", function () {
    if (video.paused) {
      video.play();
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  });
})();
