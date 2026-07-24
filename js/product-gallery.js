(function () {
  document.querySelectorAll(".artwork-gallery").forEach(function (gallery) {
    var mainImage = gallery.querySelector(".js-product-gallery-main");
    var thumbnails = gallery.querySelectorAll(".js-product-gallery-thumb");
    if (!mainImage || !thumbnails.length) return;

    thumbnails.forEach(function (thumbnail) {
      thumbnail.addEventListener("click", function () {
        var nextImage = thumbnail.getAttribute("data-image");
        if (!nextImage) return;

        mainImage.src = nextImage;
        mainImage.alt = thumbnail.getAttribute("data-alt") || "";

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
  });
})();
