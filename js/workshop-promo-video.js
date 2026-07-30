(function () {
  var media = document.querySelector(".js-promo-video");
  var playBtn = document.querySelector(".js-promo-video-play");
  if (!media || !playBtn) return;

  function toEmbedUrl(url, type) {
    if (type === "youtube") {
      var m = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([\w-]+)/);
      return m ? "https://www.youtube.com/embed/" + m[1] : url;
    }
    if (type === "vimeo") {
      var v = url.match(/vimeo\.com\/(\d+)/);
      return v ? "https://player.vimeo.com/video/" + v[1] : url;
    }
    return url;
  }

  playBtn.addEventListener("click", function () {
    var type = media.dataset.videoType;
    var file = media.dataset.videoFile;
    var url = media.dataset.videoUrl;
    var el;

    if (type === "local" && file) {
      el = document.createElement("video");
      el.src = file;
      el.controls = true;
      el.playsInline = true;
      el.autoplay = true;
    } else if (url) {
      var embedUrl = toEmbedUrl(url, type);
      el = document.createElement("iframe");
      el.src = embedUrl + (embedUrl.indexOf("?") > -1 ? "&" : "?") + "autoplay=1";
      el.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
      el.setAttribute("allowfullscreen", "");
      el.setAttribute("title", "סרטון פרומו");
    }

    if (el) {
      media.appendChild(el);
      media.classList.add("is-playing");
    }
  });
})();
