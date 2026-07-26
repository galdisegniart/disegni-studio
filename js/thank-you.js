(function () {
  localStorage.removeItem("disegniCart");
  localStorage.removeItem("disegniCartOrderId");

  document.querySelectorAll(".js-cart-count").forEach(function (badge) {
    badge.textContent = "0";
    badge.hidden = true;
  });
})();
