(function () {
  var leadForm = document.getElementById("lead-form");
  var waNumber = document.body.dataset.whatsapp || "972552902934";

  function buildMessage(data) {
    var name = data.get("name") || "";
    var contact = data.get("contact") || "";
    var path = data.get("path") || "";
    var purpose = data.get("purpose") || "";
    var message = (data.get("message") || "").trim();
    var budget = data.get("budget") || "";

    var lines = [
      "שלום גל, הגעתי דרך האתר ואשמח לבדוק התאמה לתהליך.",
      "שם: " + name,
      "טלפון/אימייל: " + contact,
      "מסלול מעניין: " + path,
      "עבור: " + purpose
    ];
    if (message) lines.push("כמה מילים: " + message);
    if (budget) lines.push("טווח תקציב: " + budget);
    return lines.join("\n");
  }

  if (leadForm) {
    var submitBtn = leadForm.querySelector(".lead-submit");
    var successEl = leadForm.querySelector(".js-lead-success");
    var submitted = false;

    leadForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (submitted) return;
      if (!leadForm.checkValidity()) {
        leadForm.reportValidity();
        return;
      }
      submitted = true;
      if (submitBtn) submitBtn.disabled = true;

      var data = new FormData(leadForm);
      var message = buildMessage(data);
      var url = "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(message);
      window.open(url, "_blank", "noopener,noreferrer");

      if (successEl) successEl.hidden = false;
    });

    leadForm.addEventListener("input", function () {
      if (!submitted) return;
      submitted = false;
      if (submitBtn) submitBtn.disabled = false;
      if (successEl) successEl.hidden = true;
    });

    leadForm.addEventListener("change", function () {
      if (!submitted) return;
      submitted = false;
      if (submitBtn) submitBtn.disabled = false;
      if (successEl) successEl.hidden = true;
    });
  }

  // Path-card selection: clicking a work card fills the form's path select and scrolls to it.
  document.querySelectorAll(".js-path-select").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var path = btn.dataset.path || "";
      var select = leadForm && leadForm.querySelector("select[name='path']");
      if (select && path) {
        var matched = Array.prototype.some.call(select.options, function (opt) {
          return opt.value === path;
        });
        if (matched) select.value = path;
      }
      updateStickyPath();
      var target = document.getElementById("inquiry-form");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      var nameField = leadForm && leadForm.querySelector("input[name='name']");
      if (nameField) window.setTimeout(function () { nameField.focus(); }, 400);
    });
  });

  // Intro video: click-to-play, no autoplay on load. Supports a local file or an external embed URL.
  var introVideo = document.querySelector(".js-intro-video");
  var introVideoPlay = document.querySelector(".js-intro-video-play");
  if (introVideo && introVideoPlay) {
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
  }

  function toEmbedUrl(url) {
    var youtubeMatch = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([\w-]+)/);
    if (youtubeMatch) return "https://www.youtube.com/embed/" + youtubeMatch[1];
    var vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return "https://player.vimeo.com/video/" + vimeoMatch[1];
    return url;
  }

  // Mobile sticky CTA: appears once the hero is scrolled past.
  var stickyCta = document.querySelector(".js-sticky-cta");
  var stickyCtaPath = document.querySelector(".js-sticky-cta-path");
  var hero = document.querySelector(".commission-hero");

  function updateStickyPath() {
    if (!stickyCtaPath) return;
    var select = leadForm && leadForm.querySelector("select[name='path']");
    stickyCtaPath.textContent = select && select.value ? select.value : "";
  }

  if (stickyCta && hero && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          stickyCta.hidden = entry.isIntersecting;
        });
      },
      { threshold: 0 }
    );
    observer.observe(hero);
  }

  if (leadForm) {
    leadForm.addEventListener("change", function (e) {
      if (e.target.name === "path") updateStickyPath();
    });
  }
})();
