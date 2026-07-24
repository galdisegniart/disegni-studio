(function () {
  var CART_KEY = "disegniCart";
  var CURRENCY_KEY = "disegniCurrency";
  var CUSTOMER_KEY = "disegniCustomer";
  var CART_ORDER_ID_KEY = "disegniCartOrderId";
  var LAST_ORDER_KEY = "disegniLastOrder";

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

  function getCustomer() {
    try {
      return JSON.parse(localStorage.getItem(CUSTOMER_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveCustomer(customer) {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
  }

  function generateOrderId() {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var stamp = String(d.getFullYear()).slice(-2) + pad(d.getMonth() + 1) + pad(d.getDate());
    var rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return "GD-" + stamp + "-" + rand;
  }

  function getOrCreateOrderId(key) {
    var id = localStorage.getItem(key);
    if (!id) {
      id = generateOrderId();
      localStorage.setItem(key, id);
    }
    return id;
  }

  function clearOrderId(key) {
    localStorage.removeItem(key);
  }

  function saveLastOrder(order) {
    localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
  }

  function customerLinesText(customer) {
    return (
      "\n\nפרטי לקוח:" +
      "\nשם: " + (customer.name || "") +
      "\nטלפון: " + (customer.phone || "") +
      (customer.email ? "\nדוא\"ל: " + customer.email : "") +
      "\nכתובת למשלוח: " + (customer.address || "")
    );
  }

  function updateOriginalWhatsAppLinks() {
    var links = document.querySelectorAll(".js-original-whatsapp");
    if (!links.length) return;
    var customer = getCustomer();
    var waNumber = document.body.dataset.whatsapp || "972552902934";
    links.forEach(function (link) {
      var slug = link.dataset.artworkSlug || "original";
      var price = parseFloat(link.dataset.price || "0");
      var orderId = getOrCreateOrderId("disegniOriginalOrderId:" + slug);

      saveLastOrder({
        orderId: orderId,
        createdAt: new Date().toISOString(),
        kind: "original",
        currency: "ILS",
        items: [{
          artworkSlug: slug,
          artworkName: link.dataset.artworkName || "",
          qty: 1,
          unitPrice: price,
          lineTotal: price,
        }],
        customer: customer,
        subtotal: price,
        shipping: 0,
        total: price,
      });

      var base = link.dataset.baseMessage || "";
      var message = "מספר הזמנה: " + orderId + "\n\n" + base + customerLinesText(customer);
      link.href = "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(message);
    });
  }

  function loadCustomerForm() {
    var form = document.getElementById("cart-customer-form");
    if (!form) return;
    var customer = getCustomer();
    var nameInput = document.getElementById("customer-name");
    var phoneInput = document.getElementById("customer-phone");
    var emailInput = document.getElementById("customer-email");
    var addressInput = document.getElementById("customer-address");
    if (nameInput) nameInput.value = customer.name || "";
    if (phoneInput) phoneInput.value = customer.phone || "";
    if (emailInput) emailInput.value = customer.email || "";
    if (addressInput) addressInput.value = customer.address || "";
    updateOriginalWhatsAppLinks();

    form.addEventListener("input", function () {
      saveCustomer({
        name: nameInput ? nameInput.value : "",
        phone: phoneInput ? phoneInput.value : "",
        email: emailInput ? emailInput.value : "",
        address: addressInput ? addressInput.value : "",
      });
      renderCartPage();
      updateOriginalWhatsAppLinks();
    });
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
    var customerForm = document.getElementById("cart-customer-form");

    document.querySelectorAll(".js-currency-toggle").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.currency === currency);
    });

    if (cart.length === 0) {
      itemsEl.innerHTML = "";
      emptyEl.hidden = false;
      summaryEl.hidden = true;
      if (customerForm) customerForm.hidden = true;
      clearOrderId(CART_ORDER_ID_KEY);
      return;
    }
    emptyEl.hidden = true;
    summaryEl.hidden = false;
    if (customerForm) customerForm.hidden = false;

    itemsEl.innerHTML = "";
    cart.forEach(function (item, index) {
      var li = document.createElement("li");
      li.className = "cart-line";

      var info = document.createElement("div");
      info.className = "cart-line-info";
      var strong = document.createElement("strong");
      strong.textContent = item.artworkName;
      var span = document.createElement("span");
      span.textContent = item.materialName + " · " + sizeLabel(item, currency);
      info.appendChild(strong);
      info.appendChild(span);

      var qtyWrap = document.createElement("div");
      qtyWrap.className = "cart-line-qty";
      var minusBtn = document.createElement("button");
      minusBtn.type = "button";
      minusBtn.className = "js-qty-minus";
      minusBtn.dataset.index = index;
      minusBtn.setAttribute("aria-label", "הפחתת כמות");
      minusBtn.textContent = "−";
      var qtySpan = document.createElement("span");
      qtySpan.textContent = item.qty;
      var plusBtn = document.createElement("button");
      plusBtn.type = "button";
      plusBtn.className = "js-qty-plus";
      plusBtn.dataset.index = index;
      plusBtn.setAttribute("aria-label", "הוספת כמות");
      plusBtn.textContent = "+";
      qtyWrap.appendChild(minusBtn);
      qtyWrap.appendChild(qtySpan);
      qtyWrap.appendChild(plusBtn);

      var priceDiv = document.createElement("div");
      priceDiv.className = "cart-line-price";
      priceDiv.textContent = formatPrice(item, currency);

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "cart-line-remove js-remove";
      removeBtn.dataset.index = index;
      removeBtn.setAttribute("aria-label", "הסרה מהעגלה");
      removeBtn.textContent = "✕";

      li.appendChild(info);
      li.appendChild(qtyWrap);
      li.appendChild(priceDiv);
      li.appendChild(removeBtn);
      itemsEl.appendChild(li);
    });

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
    var customer = getCustomer();
    var orderId = getOrCreateOrderId(CART_ORDER_ID_KEY);

    saveLastOrder({
      orderId: orderId,
      createdAt: new Date().toISOString(),
      kind: "prints",
      currency: currency,
      items: cart.map(function (item) {
        var unitPrice = currency === "USD" ? item.priceUSD : item.priceILS;
        return {
          artworkSlug: item.artworkSlug,
          artworkName: item.artworkName,
          material: item.material,
          materialName: item.materialName,
          sizeId: item.sizeId,
          sizeLabel: sizeLabel(item, currency),
          qty: item.qty,
          unitPrice: unitPrice,
          lineTotal: unitPrice * item.qty,
        };
      }),
      customer: customer,
      subtotal: subtotal,
      shipping: shipping,
      total: total,
    });

    var customerLines =
      "\n\nפרטי לקוח:" +
      "\nשם: " + (customer.name || "") +
      "\nטלפון: " + (customer.phone || "") +
      (customer.email ? "\nדוא\"ל: " + customer.email : "") +
      "\nכתובת למשלוח: " + (customer.address || "");
    var message =
      "שלום גל, אשמח להזמין הדפסים אמנותיים:\n" +
      "מספר הזמנה: " + orderId + "\n" +
      waLines +
      "\nסה\"כ: " + (currency === "USD" ? "$" + total : total + " ₪") +
      customerLines +
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
      var select = wrap.querySelector(".js-size-select");
      var option = select.options[select.selectedIndex];
      if (!option || option.disabled) return;
      addToCart({
        artworkSlug: wrap.dataset.artworkSlug,
        artworkName: wrap.dataset.artworkName,
        material: option.dataset.material,
        materialName: option.dataset.materialName,
        sizeId: option.dataset.sizeId,
        labelIn: option.dataset.labelIn,
        labelCm: option.dataset.labelCm,
        priceILS: parseFloat(option.dataset.priceIls),
        priceUSD: parseFloat(option.dataset.priceUsd),
        qty: 1,
      });
      window.location.href = "/cart/";
      return;
    }

    var currencyBtn = e.target.closest(".js-currency-toggle");
    if (currencyBtn) {
      setCurrency(currencyBtn.dataset.currency);
      renderSizeOptions();
      renderCartPage();
      document.querySelectorAll("[data-artwork-slug]").forEach(updateLivePrice);
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

    var waBtn2 = e.target.closest("#cart-whatsapp, .js-original-whatsapp");
    if (waBtn2) {
      var form = document.getElementById("cart-customer-form");
      if (form && !form.reportValidity()) {
        e.preventDefault();
      }
      return;
    }
  });

  document.addEventListener("change", function (e) {
    if (!e.target.classList.contains("js-size-select")) return;
    var wrap = e.target.closest("[data-artwork-slug]");
    if (!wrap) return;
    var noteEl = wrap.querySelector(".js-print-order-note");
    var option = e.target.options[e.target.selectedIndex];
    if (noteEl && option) noteEl.textContent = option.dataset.note;
    updateLivePrice(wrap);
  });

  function updateLivePrice(wrap) {
    var priceEl = wrap.querySelector(".js-live-price");
    var select = wrap.querySelector(".js-size-select");
    if (!priceEl || !select) return;
    var option = select.options[select.selectedIndex];
    if (!option || !option.value) {
      priceEl.textContent = "—";
      return;
    }
    var currency = getCurrency();
    var unitPrice = currency === "USD" ? parseFloat(option.dataset.priceUsd) : parseFloat(option.dataset.priceIls);
    priceEl.textContent = currency === "USD" ? "$" + unitPrice : unitPrice + " ₪";
  }

  function renderSizeOptions() {
    var currency = getCurrency();
    document.querySelectorAll(".js-currency-toggle").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.currency === currency);
    });
    document.querySelectorAll(".js-size-select option").forEach(function (option) {
      if (!option.value) return;
      var label = currency === "USD" ? option.dataset.labelIn : option.dataset.labelCm;
      var disabledSuffix = option.disabled ? " (אזל)" : "";
      option.textContent = option.dataset.materialName + " — " + label + disabledSuffix;
    });
  }

  updateCartBadge();
  renderSizeOptions();
  loadCustomerForm();
  renderCartPage();
  document.querySelectorAll("[data-artwork-slug]").forEach(updateLivePrice);
})();
