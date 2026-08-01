(function () {
  function toEmbedUrl(url) {
    var youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([\w-]+)/);
    if (youtubeMatch) return "https://www.youtube.com/embed/" + youtubeMatch[1];
    var vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return "https://player.vimeo.com/video/" + vimeoMatch[1];
    return url;
  }

  // Click-to-play, no autoplay on load. Supports a local file or an external embed URL (YouTube/Vimeo).
  document.querySelectorAll(".js-intro-video").forEach(function (introVideo) {
    var introVideoPlay = introVideo.querySelector(".js-intro-video-play");
    if (!introVideoPlay) return;

    introVideoPlay.addEventListener("click", function () {
      var file = introVideo.dataset.videoFile;
      var url = introVideo.dataset.videoUrl;
      var media;
      if (file) {
        media = document.createElement("video");
        media.src = file;
        media.controls = true;
        media.playsInline = true;
        media.autoplay = true;
      } else if (url) {
        var embedUrl = toEmbedUrl(url);
        media = document.createElement("iframe");
        media.src = embedUrl + (embedUrl.indexOf("?") > -1 ? "&" : "?") + "autoplay=1";
        media.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
        media.setAttribute("allowfullscreen", "");
        media.setAttribute("title", "סרטון הסבר");
      }
      if (media) {
        introVideo.appendChild(media);
        introVideo.classList.add("is-playing");
      }
    });
  });
})();
