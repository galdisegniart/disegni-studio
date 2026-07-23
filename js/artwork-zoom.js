(function () {
  var ZOOM = 2.2;
  var LENS_SIZE = 220;

  function initZoom(figure) {
    var img = figure.querySelector("img");
    if (!img) return;
    if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    var frame = document.createElement("div");
    frame.className = "artwork-zoom-frame";
    img.parentNode.insertBefore(frame, img);
    frame.appendChild(img);

    var lens = document.createElement("div");
    lens.className = "artwork-zoom-lens";
    lens.style.width = LENS_SIZE + "px";
    lens.style.height = LENS_SIZE + "px";
    lens.style.backgroundImage = "url('" + img.src + "')";
    frame.appendChild(lens);

    function moveLens(clientX, clientY) {
      var rect = img.getBoundingClientRect();
      var x = clientX - rect.left;
      var y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        hideLens();
        return;
      }

      var half = LENS_SIZE / 2;
      lens.style.left = x - half + "px";
      lens.style.top = y - half + "px";
      lens.style.backgroundSize = rect.width * ZOOM + "px " + rect.height * ZOOM + "px";
      lens.style.backgroundPosition = -(x * ZOOM - half) + "px " + -(y * ZOOM - half) + "px";
      lens.classList.add("is-active");
      frame.classList.add("is-zooming");
    }

    function hideLens() {
      lens.classList.remove("is-active");
      frame.classList.remove("is-zooming");
    }

    frame.addEventListener("mousemove", function (e) {
      moveLens(e.clientX, e.clientY);
    });
    frame.addEventListener("mouseleave", hideLens);
  }

  document.querySelectorAll(".artwork-stage").forEach(initZoom);
})();
