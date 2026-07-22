document.addEventListener("click", function (e) {
  var modal = document.getElementById("sold-out-modal");
  if (!modal) return;

  if (e.target.closest(".js-original-sold-out")) {
    modal.hidden = false;
    return;
  }

  if (e.target.closest(".js-sold-out-close") || e.target === modal) {
    modal.hidden = true;
  }
});
