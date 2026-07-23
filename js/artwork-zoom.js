(function () {
  var ZOOM = 2.2;
  var LENS_SIZE = 220;

  function initZoom(figure) {
    var img = figure.querySelector("img");
    if (!img) return;

    var lens = document.createElement("div");
    lens.className = "artwork-zoom-lens";
    lens.style.width = LENS_SIZE + "px";
    lens.style.height = LENS_SIZE + "px";
    lens.style.backgroundImage = "url('" + img.src + "')";
    figure.appendChild(lens);

    function moveLens(clientX, clientY) {
      var rect = img.getBoundingClientRect();
      var x = clientX - rect.left;
      var y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        hideLens();
        return;
      }

      var half = LENS_SIZE / 2;
      var halfSrc = half / ZOOM;

      // Screen position: clamp to the image's own rect so the lens never spills onto letterboxing.
      var lensX = Math.max(half, Math.min(rect.width - half, x));
      var lensY = Math.max(half, Math.min(rect.height - half, y));
      lens.style.left = lensX - half + (rect.left - figure.getBoundingClientRect().left) + "px";
      lens.style.top = lensY - half + (rect.top - figure.getBoundingClientRect().top) + "px";

      // Sampled source point: clamp separately so the magnified view never shows past the image edge.
      var srcX = Math.max(halfSrc, Math.min(rect.width - halfSrc, x));
      var srcY = Math.max(halfSrc, Math.min(rect.height - halfSrc, y));
      lens.style.backgroundSize = rect.width * ZOOM + "px " + rect.height * ZOOM + "px";
      lens.style.backgroundPosition = -(srcX * ZOOM - half) + "px " + -(srcY * ZOOM - half) + "px";
      lens.classList.add("is-active");
    }

    function hideLens() {
      lens.classList.remove("is-active");
    }

    figure.addEventListener("mousemove", function (e) {
      moveLens(e.clientX, e.clientY);
    });
    figure.addEventListener("mouseleave", hideLens);

    figure.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      moveLens(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    figure.addEventListener("touchmove", function (e) {
      if (e.touches.length !== 1) return;
      moveLens(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    }, { passive: false });
    figure.addEventListener("touchend", hideLens);
  }

  document.querySelectorAll(".artwork-stage").forEach(initZoom);
})();
