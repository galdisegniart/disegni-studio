(function () {
  document.querySelectorAll(".artwork-gallery").forEach(function (gallery) {
    var mainImage = gallery.querySelector(".js-product-gallery-main");
    var thumbnails = gallery.querySelectorAll(".js-product-gallery-thumb");
    var previousButton = gallery.querySelector(".js-product-gallery-prev");
    var nextButton = gallery.querySelector(".js-product-gallery-next");
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

    function activateThumbnail(thumbnail, syncProductOptions) {
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

      if (syncProductOptions && thumbnail.dataset.productType) {
        document.dispatchEvent(new CustomEvent("product-gallery:select", {
          detail: {
            gallery: gallery,
            productType: thumbnail.dataset.productType,
            sizeId: thumbnail.dataset.sizeId || "",
            frameColor: thumbnail.dataset.frameColor || ""
          }
        }));
      }
    }

    function findProductThumbnail(productType, sizeId, frameColor) {
      var exactMatch = null;
      var typeMatch = null;

      thumbnails.forEach(function (thumbnail) {
        if (thumbnail.dataset.productType !== productType) return;
        var thumbnailSize = thumbnail.dataset.sizeId || "";
        var thumbnailFrameColor = thumbnail.dataset.frameColor || "";
        var colorMatches = !frameColor || !thumbnailFrameColor || thumbnailFrameColor === frameColor;

        if (!thumbnailSize && colorMatches) typeMatch = typeMatch || thumbnail;
        if (sizeId && thumbnailSize === sizeId && colorMatches) exactMatch = thumbnail;
      });

      return exactMatch || typeMatch;
    }

    function moveGallery(direction) {
      var activeIndex = -1;

      thumbnails.forEach(function (thumbnail, index) {
        if (thumbnail.classList.contains("is-active")) activeIndex = index;
      });

      var nextIndex = (activeIndex + direction + thumbnails.length) % thumbnails.length;
      activateThumbnail(thumbnails[nextIndex], true);
      thumbnails[nextIndex].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }

    setEnlargementMode();

    thumbnails.forEach(function (thumbnail) {
      thumbnail.addEventListener("click", function () {
        activateThumbnail(thumbnail, true);
      });
    });

    if (previousButton && nextButton) {
      previousButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        moveGallery(-1);
      });

      nextButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        moveGallery(1);
      });
    }

    document.addEventListener("product-options:change", function (event) {
      var detail = event.detail || {};
      var order = gallery.closest(".artwork-detail-grid").querySelector(".print-order");
      if (!order || detail.order !== order || !detail.productType) return;

      var matchingThumbnail = findProductThumbnail(
        detail.productType,
        detail.sizeId || "",
        detail.frameColor || ""
      );
      if (matchingThumbnail) activateThumbnail(matchingThumbnail, false);
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
