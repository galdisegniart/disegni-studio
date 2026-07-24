(function () {
  document.querySelectorAll(".artwork-gallery").forEach(function (gallery) {
    var mainImage = gallery.querySelector(".js-product-gallery-main");
    var thumbnails = gallery.querySelectorAll(".js-product-gallery-thumb");
    if (!mainImage || !thumbnails.length) return;

    var lightbox = document.createElement("div");
    lightbox.className = "product-lightbox";
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", "תצוגת תמונה מוגדלת");
    lightbox.innerHTML = '<button class="product-lightbox-close" type="button" aria-label="סגירת התמונה המוגדלת">×</button><img alt="">';
    document.body.appendChild(lightbox);

    var lightboxImage = lightbox.querySelector("img");
    var closeButton = lightbox.querySelector(".product-lightbox-close");

    function setEnlargementMode() {
      gallery.classList.toggle("is-lightbox-enabled", mainImage.getAttribute("data-zoom-enabled") !== "true");
    }

    function closeLightbox() {
      lightbox.classList.remove("is-open");
      document.body.classList.remove("product-lightbox-lock");
    }

    setEnlargementMode();

    thumbnails.forEach(function (thumbnail) {
      thumbnail.addEventListener("click", function () {
        var nextImage = thumbnail.getAttribute("data-image");
        if (!nextImage) return;

        mainImage.src = nextImage;
        mainImage.alt = thumbnail.getAttribute("data-alt") || "";
        mainImage.setAttribute("data-zoom-enabled", thumbnail.getAttribute("data-zoom") === "true" ? "true" : "false");
        setEnlargementMode();

        thumbnails.forEach(function (item) {
          var isActive = item === thumbnail;
          item.classList.toggle("is-active", isActive);
          if (isActive) {
            item.setAttribute("aria-current", "true");
          } else {
            item.removeAttribute("aria-current");
          }
        });
      });
    });

    gallery.querySelector(".artwork-stage").addEventListener("click", function () {
      if (mainImage.getAttribute("data-zoom-enabled") === "true") return;
      lightboxImage.src = mainImage.src;
      lightboxImage.alt = mainImage.alt;
      lightbox.classList.add("is-open");
      document.body.classList.add("product-lightbox-lock");
      closeButton.focus();
    });

    closeButton.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeLightbox();
    });
  });
})();
