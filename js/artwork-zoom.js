(function () {
  var ZOOM = 2.2;
  var LENS_SIZE = 160;

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

      var figRect = figure.getBoundingClientRect();
      var half = LENS_SIZE / 2;
      var lensX = Math.max(half, Math.min(figRect.width - half, clientX - figRect.left));
      var lensY = Math.max(half, Math.min(figRect.height - half, clientY - figRect.top));

      lens.style.left = (lensX - half) + "px";
      lens.style.top = (lensY - half) + "px";
      lens.style.backgroundSize = (rect.width * ZOOM) + "px " + (rect.height * ZOOM) + "px";
      lens.style.backgroundPosition = -(x * ZOOM - half) + "px " + -(y * ZOOM - half) + "px";
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
