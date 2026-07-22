(function () {
  var CART_KEY = "disegniCart";
  var CURRENCY_KEY = "disegniCurrency";

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge();
  }

  function getCurrency() {
    return localStorage.getItem(CURRENCY_KEY) === "USD" ? "USD" : "ILS";
  }

  function setCurrency(value) {
    localStorage.setItem(CURRENCY_KEY, value);
  }

  function formatPrice(item, currency) {
    if (currency === "USD") return "$" + item.priceUSD;
    return item.priceILS + " ₪";
  }

  function sizeLabel(item, currency) {
    return currency === "USD" ? item.labelIn : item.labelCm;
  }

  function updateCartBadge() {
    var count = getCart().reduce(function (sum, item) {
      return sum + item.qty;
    }, 0);
    document.querySelectorAll(".js-cart-count").forEach(function (el) {
      el.textContent = count;
      el.hidden = count === 0;
    });
  }

  function getActiveChipGroup(wrap) {
    var groups = wrap.querySelectorAll(".js-size-chip-group");
    for (var i = 0; i < groups.length; i++) {
      if (!groups[i].hidden) return groups[i];
    }
    return groups[0];
  }

  function getActiveChip(group) {
    if (!group) return null;
    return group.querySelector(".js-size-chip.active") || group.querySelector(".js-size-chip:not([disabled])");
  }

  function addToCart(item) {
    var cart = getCart();
    var existing = cart.find(function (line) {
      return line.artworkSlug === item.artworkSlug && line.sizeId === item.sizeId && line.material === item.material;
    });
    if (existing) {
      existing.qty += item.qty;
    } else {
      cart.push(item);
    }
    saveCart(cart);
  }

  function removeFromCart(index) {
    var cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
    renderCartPage();
  }

  function setQty(index, qty) {
    var cart = getCart();
    if (!cart[index]) return;
    cart[index].qty = Math.max(1, qty);
    saveCart(cart);
    renderCartPage();
  }

  function renderCartPage() {
    var root = document.getElementById("cart-root");
    if (!root) return;
    var cart = getCart();
    var currency = getCurrency();
    var itemsEl = document.getElementById("cart-items");
    var emptyEl = document.getElementById("cart-empty");
    var summaryEl = document.getElementById("cart-summary");

    document.querySelectorAll(".js-currency-toggle").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.currency === currency);
    });

    if (cart.length === 0) {
      itemsEl.innerHTML = "";
      emptyEl.hidden = false;
      summaryEl.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    summaryEl.hidden = false;

    itemsEl.innerHTML = cart
      .map(function (item, index) {
        return (
          '<li class="cart-line">' +
          '<div class="cart-line-info">' +
          "<strong>" + item.artworkName + "</strong>" +
          '<span>' + item.materialName + ' · ' + sizeLabel(item, currency) + "</span>" +
          "</div>" +
          '<div class="cart-line-qty">' +
          '<button type="button" class="js-qty-minus" data-index="' + index + '" aria-label="הפחתת כמות">−</button>' +
          '<span>' + item.qty + '</span>' +
          '<button type="button" class="js-qty-plus" data-index="' + index + '" aria-label="הוספת כמות">+</button>' +
          "</div>" +
          '<div class="cart-line-price">' + formatPrice(item, currency) + "</div>" +
          '<button type="button" class="cart-line-remove js-remove" data-index="' + index + '" aria-label="הסרה מהעגלה">✕</button>' +
          "</li>"
        );
      })
      .join("");

    var subtotal = cart.reduce(function (sum, item) {
      var price = currency === "USD" ? item.priceUSD : item.priceILS;
      return sum + price * item.qty;
    }, 0);

    var shipping = 0;
    var shippingLabel = "";
    if (currency === "ILS") {
      var flat = parseFloat(root.dataset.shippingFlat || "0");
      var threshold = parseFloat(root.dataset.shippingThreshold || "0");
      shipping = subtotal >= threshold ? 0 : flat;
      shippingLabel = shipping === 0 ? "חינם" : shipping + " ₪";
    } else {
      shippingLabel = "כלול במחיר";
    }

    var total = subtotal + shipping;

    document.getElementById("cart-subtotal").textContent = (currency === "USD" ? "$" + subtotal : subtotal + " ₪");
    document.getElementById("cart-shipping").textContent = shippingLabel;
    document.getElementById("cart-total").textContent = (currency === "USD" ? "$" + total : total + " ₪");

    var waLines = cart
      .map(function (item) {
        return "- " + item.artworkName + " (" + item.materialName + ", " + sizeLabel(item, currency) + ") × " + item.qty;
      })
      .join("\n");
    var message =
      "שלום גל, אשמח להזמין הדפסים אמנותיים:\n" +
      waLines +
      "\nסה\"כ: " + (currency === "USD" ? "$" + total : total + " ₪") +
      "\nביצעתי/אבצע העברה בנקאית לפרטים באתר.";
    var waBtn = document.getElementById("cart-whatsapp");
    if (waBtn) {
      var waNumber = document.body.dataset.whatsapp || "972552902934";
      waBtn.href = "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(message);
    }
  }

  document.addEventListener("click", function (e) {
    var addBtn = e.target.closest(".js-add-to-cart");
    if (addBtn) {
      var wrap = addBtn.closest("[data-artwork-slug]");
      var group = getActiveChipGroup(wrap);
      var chip = getActiveChip(group);
      if (!chip) return;
      addToCart({
        artworkSlug: wrap.dataset.artworkSlug,
        artworkName: wrap.dataset.artworkName,
        material: group.dataset.material,
        materialName: group.dataset.materialName,
        sizeId: chip.dataset.sizeId,
        labelIn: chip.dataset.labelIn,
        labelCm: chip.dataset.labelCm,
        priceILS: parseFloat(chip.dataset.priceIls),
        priceUSD: parseFloat(chip.dataset.priceUsd),
        qty: 1,
      });
      window.location.href = "/cart/";
      return;
    }

    var currencyBtn = e.target.closest(".js-currency-toggle");
    if (currencyBtn) {
      setCurrency(currencyBtn.dataset.currency);
      renderSizeChips();
      renderCartPage();
      document.querySelectorAll("[data-artwork-slug]").forEach(updateLivePrice);
      return;
    }

    var materialCard = e.target.closest(".js-material-card");
    if (materialCard) {
      var cardWrap = materialCard.closest("[data-artwork-slug]");
      var material = materialCard.dataset.material;
      cardWrap.querySelectorAll(".js-material-card").forEach(function (btn) {
        btn.classList.toggle("active", btn.dataset.material === material);
      });
      cardWrap.querySelectorAll(".js-size-chip-group").forEach(function (group) {
        group.hidden = group.dataset.material !== material;
      });
      var newGroup = getActiveChipGroup(cardWrap);
      newGroup.querySelectorAll(".js-size-chip").forEach(function (c, i) {
        c.classList.toggle("active", c === getActiveChip(newGroup));
      });
      var noteEl = cardWrap.querySelector(".js-print-order-note");
      if (noteEl) noteEl.textContent = newGroup.dataset.note;
      updateLivePrice(cardWrap);
      return;
    }

    var sizeChip = e.target.closest(".js-size-chip");
    if (sizeChip && !sizeChip.disabled) {
      var chipGroup = sizeChip.closest(".js-size-chip-group");
      chipGroup.querySelectorAll(".js-size-chip").forEach(function (c) {
        c.classList.toggle("active", c === sizeChip);
      });
      var chipWrap = sizeChip.closest("[data-artwork-slug]");
      updateLivePrice(chipWrap);
      return;
    }

    var minusBtn = e.target.closest(".js-qty-minus");
    if (minusBtn) {
      var cart1 = getCart();
      var i1 = parseInt(minusBtn.dataset.index, 10);
      setQty(i1, cart1[i1].qty - 1);
      return;
    }

    var plusBtn = e.target.closest(".js-qty-plus");
    if (plusBtn) {
      var cart2 = getCart();
      var i2 = parseInt(plusBtn.dataset.index, 10);
      setQty(i2, cart2[i2].qty + 1);
      return;
    }

    var removeBtn = e.target.closest(".js-remove");
    if (removeBtn) {
      removeFromCart(parseInt(removeBtn.dataset.index, 10));
      return;
    }
  });

  function updateLivePrice(wrap) {
    var priceEl = wrap.querySelector(".js-live-price");
    if (!priceEl) return;
    var group = getActiveChipGroup(wrap);
    var chip = getActiveChip(group);
    if (!chip) return;
    var currency = getCurrency();
    var unitPrice = currency === "USD" ? parseFloat(chip.dataset.priceUsd) : parseFloat(chip.dataset.priceIls);
    priceEl.textContent = currency === "USD" ? "$" + unitPrice : unitPrice + " ₪";
  }

  function renderSizeChips() {
    var currency = getCurrency();
    document.querySelectorAll(".js-currency-toggle").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.currency === currency);
    });
    document.querySelectorAll(".js-size-chip").forEach(function (chip) {
      var label = currency === "USD" ? chip.dataset.labelIn : chip.dataset.labelCm;
      var labelEl = chip.querySelector(".js-size-chip-label");
      if (labelEl) labelEl.textContent = label;
    });
  }

  updateCartBadge();
  renderSizeChips();
  renderCartPage();
  document.querySelectorAll("[data-artwork-slug]").forEach(updateLivePrice);
})();
