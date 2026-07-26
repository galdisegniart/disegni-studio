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

  function formatAmount(value, currency) {
    var amount = Math.round(Number(value) * 100) / 100;
    return currency === "USD" ? "$" + amount.toFixed(2) : amount + " ₪";
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
      return line.artworkSlug === item.artworkSlug &&
        line.sizeId === item.sizeId &&
        line.material === item.material &&
        (line.frame || "none") === (item.frame || "none");
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

  function isGrowTestEligible(cart, currency) {
    if (new URLSearchParams(window.location.search).get("payment-test") !== "orin") return false;
    if (currency !== "ILS" || cart.length === 0) return false;
    return cart.every(function (item) {
      return item.artworkSlug === "orin" &&
        ["poster", "framed-print", "canvas"].indexOf(item.productType) !== -1 &&
        Number.isInteger(item.qty) &&
        item.qty >= 1 &&
        item.qty <= 10;
    });
  }

  function hasVariantShipping(cart, currency) {
    var suffix = currency === "USD" ? "USD" : "ILS";
    return cart.length > 0 && cart.every(function (item) {
      return Number.isFinite(Number(item["shippingFirst" + suffix])) &&
        Number.isFinite(Number(item["shippingAdditional" + suffix])) &&
        !!item.productType;
    });
  }

  function calculateVariantShipping(cart, currency) {
    var suffix = currency === "USD" ? "USD" : "ILS";
    var groups = {};

    cart.forEach(function (item) {
      var key = item.productType;
      if (!groups[key]) groups[key] = [];
      for (var index = 0; index < item.qty; index += 1) {
        groups[key].push({
          first: Number(item["shippingFirst" + suffix]),
          additional: Number(item["shippingAdditional" + suffix]),
        });
      }
    });

    var total = Object.keys(groups).reduce(function (sum, key) {
      var units = groups[key].sort(function (a, b) {
        return b.first - a.first;
      });
      if (!units.length) return sum;
      return sum + units[0].first + units.slice(1).reduce(function (groupSum, unit) {
        return groupSum + unit.additional;
      }, 0);
    }, 0);

    return Math.round(total * 100) / 100;
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
      span.textContent = item.materialName + " · " + sizeLabel(item, currency) +
        (item.frameName ? " · " + item.frameName : "");
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
    if (hasVariantShipping(cart, currency)) {
      shipping = calculateVariantShipping(cart, currency);
      shippingLabel = formatAmount(shipping, currency);
    } else if (currency === "ILS") {
      var flat = parseFloat(root.dataset.shippingFlat || "0");
      var threshold = parseFloat(root.dataset.shippingThreshold || "0");
      shipping = subtotal >= threshold ? 0 : flat;
      shippingLabel = shipping === 0 ? "חינם" : shipping + " ₪";
    } else {
      shippingLabel = "כלול במחיר";
    }

    var total = subtotal + shipping;

    document.getElementById("cart-subtotal").textContent = formatAmount(subtotal, currency);
    document.getElementById("cart-shipping").textContent = shippingLabel;
    document.getElementById("cart-total").textContent = formatAmount(total, currency);

    var waLines = cart
      .map(function (item) {
        return "- " + item.artworkName + " (" + item.materialName + ", " + sizeLabel(item, currency) +
          (item.frameName ? ", " + item.frameName : "") + ") × " + item.qty;
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
          productType: item.productType || "",
          catalogNumber: item.catalogNumber || "",
          frame: item.frame || "none",
          frameName: item.frameName || "",
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
    var growBtn = document.getElementById("cart-grow-checkout");
    var growError = document.getElementById("cart-grow-error");
    var growNote = document.getElementById("cart-grow-note");
    var bankNote = document.getElementById("cart-bank-note");
    var bankDetails = document.getElementById("cart-bank-details");
    var growEligible = isGrowTestEligible(cart, currency);
    if (growBtn) growBtn.hidden = !growEligible;
    if (growNote) growNote.hidden = !growEligible;
    if (waBtn) waBtn.hidden = growEligible;
    if (bankNote) bankNote.hidden = growEligible;
    if (bankDetails) bankDetails.hidden = growEligible;
    if (growError && !growEligible) {
      growError.hidden = true;
      growError.textContent = "";
    }
  }

  document.addEventListener("click", async function (e) {
    var addBtn = e.target.closest(".js-add-to-cart");
    if (addBtn) {
      var wrap = addBtn.closest("[data-artwork-slug]");
      var option = getSelectedProductOption(wrap);
      if (!option || option.disabled || !option.value) return;
      var qtyEl = wrap.querySelector(".js-order-qty");
      var orderQty = qtyEl ? parseInt(qtyEl.textContent, 10) || 1 : 1;
      addToCart({
        artworkSlug: wrap.dataset.artworkSlug,
        artworkName: wrap.dataset.artworkName,
        material: option.dataset.material,
        materialName: option.dataset.materialName,
        productType: option.dataset.productType || "",
        frame: option.dataset.frame || "none",
        frameName: option.dataset.frameName || "",
        sizeId: option.dataset.sizeId,
        catalogNumber: option.dataset.catalogNumber || "",
        labelIn: option.dataset.labelIn,
        labelCm: option.dataset.labelCm,
        priceILS: parseFloat(option.dataset.priceIls),
        priceUSD: parseFloat(option.dataset.priceUsd),
        shippingFirstILS: parseFloat(option.dataset.shippingFirstIls),
        shippingAdditionalILS: parseFloat(option.dataset.shippingAdditionalIls),
        shippingFirstUSD: parseFloat(option.dataset.shippingFirstUsd),
        shippingAdditionalUSD: parseFloat(option.dataset.shippingAdditionalUsd),
        qty: orderQty,
      });
      window.location.href = "/cart/";
      return;
    }

    var currencyBtn = e.target.closest(".js-currency-toggle");
    if (currencyBtn) {
      setCurrency(currencyBtn.dataset.currency);
      document.querySelectorAll(".js-currency-toggle").forEach(function (btn) {
        btn.classList.toggle("active", btn.dataset.currency === getCurrency());
      });
      document.querySelectorAll("[data-artwork-slug]").forEach(function (w) {
        if (isPrintfulDriven(w)) populatePrintfulSizes(w);
        else populateSizeOptions(w);
        updateLivePrice(w);
      });
      renderCartPage();
      return;
    }

    var orderQtyMinus = e.target.closest(".js-order-qty-minus");
    if (orderQtyMinus) {
      var owrap = orderQtyMinus.closest("[data-artwork-slug]");
      var oqtyEl = owrap.querySelector(".js-order-qty");
      oqtyEl.textContent = Math.max(1, (parseInt(oqtyEl.textContent, 10) || 1) - 1);
      updateLivePrice(owrap);
      return;
    }

    var orderQtyPlus = e.target.closest(".js-order-qty-plus");
    if (orderQtyPlus) {
      var pwrap = orderQtyPlus.closest("[data-artwork-slug]");
      var pqtyEl = pwrap.querySelector(".js-order-qty");
      pqtyEl.textContent = (parseInt(pqtyEl.textContent, 10) || 1) + 1;
      updateLivePrice(pwrap);
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

    var growBtn = e.target.closest("#cart-grow-checkout");
    if (growBtn) {
      var growForm = document.getElementById("cart-customer-form");
      if (growForm && !growForm.reportValidity()) return;

      var growCart = getCart();
      if (!isGrowTestEligible(growCart, getCurrency())) return;

      var growCustomer = getCustomer();
      var growError = document.getElementById("cart-grow-error");
      var originalLabel = growBtn.innerHTML;
      growBtn.disabled = true;
      growBtn.textContent = "יוצר קישור תשלום...";
      if (growError) {
        growError.hidden = true;
        growError.textContent = "";
      }

      try {
        var paymentResponse = await fetch(
          "https://disegni-cms-oauth.galdisegniart.workers.dev/payments/grow/create",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              artworkSlug: "orin",
              items: growCart.map(function (item) {
                return {
                  productType: item.productType,
                  sizeId: item.sizeId,
                  quantity: item.qty,
                };
              }),
              customer: {
                fullName: growCustomer.name || "",
                phone: growCustomer.phone || "",
                email: growCustomer.email || "",
                address: growCustomer.address || "",
              },
            }),
          }
        );
        var paymentBody = await paymentResponse.json();
        if (!paymentResponse.ok || !paymentBody.paymentUrl) {
          throw new Error("לא ניתן ליצור כרגע קישור תשלום.");
        }
        window.location.assign(paymentBody.paymentUrl);
      } catch (error) {
        if (growError) {
          growError.textContent = error.message || "אירעה שגיאה ביצירת התשלום.";
          growError.hidden = false;
        }
        growBtn.disabled = false;
        growBtn.innerHTML = originalLabel;
      }
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
    if (e.target.classList.contains("js-size-select")) {
      var sizeWrap = e.target.closest("[data-artwork-slug]");
      if (isPrintfulDriven(sizeWrap)) {
        updateLivePrice(sizeWrap);
        notifyProductGallery(sizeWrap);
        return;
      }
    }
    if (e.target.classList.contains("js-style-select")) {
      var swrap = e.target.closest("[data-artwork-slug]");
      if (!swrap) return;
      if (isPrintfulDriven(swrap)) {
        populatePrintfulSizes(swrap);
        updateLivePrice(swrap);
        notifyProductGallery(swrap);
        return;
      }
      populateSizeOptions(swrap);
      var snoteEl = swrap.querySelector(".js-print-order-note");
      if (snoteEl) snoteEl.textContent = "";
      updateLivePrice(swrap);
      return;
    }
    if (!e.target.classList.contains("js-size-select")) return;
    var wrap = e.target.closest("[data-artwork-slug]");
    if (!wrap) return;
    var noteEl = wrap.querySelector(".js-print-order-note");
    var option = e.target.options[e.target.selectedIndex];
    if (noteEl && option) noteEl.textContent = option.dataset.note || "";
    updateLivePrice(wrap);
  });

  function isPrintfulDriven(wrap) {
    return !!(wrap && wrap.querySelector(".js-printful-options"));
  }

  function getPrintfulOptions(wrap) {
    var data = wrap.querySelector(".js-printful-options");
    if (!data) return [];
    try {
      return JSON.parse(data.textContent) || [];
    } catch (e) {
      return [];
    }
  }

  function uniqueBy(items, key) {
    var seen = {};
    return items.filter(function (item) {
      var value = item[key];
      if (seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  function populatePrintfulTypes(wrap) {
    var select = wrap.querySelector(".js-style-select");
    var previous = select.value;
    var types = uniqueBy(getPrintfulOptions(wrap), "productType");
    var typeOrder = { poster: 0, canvas: 1, "framed-print": 2 };
    types.sort(function (a, b) {
      return typeOrder[a.productType] - typeOrder[b.productType];
    });
    select.innerHTML = '<option value="">בחרו סוג הדפס</option>';
    types.forEach(function (item) {
      var option = document.createElement("option");
      option.value = item.productType;
      option.textContent = item.productTypeName;
      select.appendChild(option);
    });
    select.value = types.some(function (item) { return item.productType === previous; }) ? previous : "";
    select.disabled = false;
    populatePrintfulSizes(wrap);
  }

  function populatePrintfulSizes(wrap) {
    var productType = wrap.querySelector(".js-style-select").value;
    var select = wrap.querySelector(".js-size-select");
    var previous = select.value;
    var currency = getCurrency();
    var variants = getPrintfulOptions(wrap).filter(function (item) {
      return item.productType === productType;
    });
    variants.sort(function (a, b) {
      return parseInt(a.sizeId, 10) - parseInt(b.sizeId, 10);
    });
    select.innerHTML = '<option value="">בחרו גודל</option>';
    variants.forEach(function (item) {
      var option = document.createElement("option");
      option.value = item.productId + ":" + (item.syncVariantId || item.sizeId);
      option.textContent = currency === "USD" ? item.labelIn : item.labelCm;
      option.dataset.material = item.style;
      option.dataset.materialName = item.productTypeName;
      option.dataset.productType = item.productType;
      option.dataset.frame = item.frame;
      option.dataset.frameColor = item.frameColor || (item.frame === "framed" ? "black" : "");
      option.dataset.frameName = "";
      option.dataset.sizeId = item.sizeId;
      option.dataset.catalogNumber = item.catalogNumber || "";
      option.dataset.labelIn = item.labelIn;
      option.dataset.labelCm = item.labelCm;
      option.dataset.priceIls = item.priceILS || "";
      option.dataset.priceUsd = item.priceUSD || "";
      option.dataset.shippingFirstIls = item.shippingFirstILS || "";
      option.dataset.shippingAdditionalIls = item.shippingAdditionalILS || "";
      option.dataset.shippingFirstUsd = item.shippingFirstUSD || "";
      option.dataset.shippingAdditionalUsd = item.shippingAdditionalUSD || "";
      option.dataset.productId = item.productId;
      option.dataset.syncVariantId = item.syncVariantId || "";
      select.appendChild(option);
    });
    var matching = variants.some(function (item) {
      return item.productId + ":" + (item.syncVariantId || item.sizeId) === previous;
    });
    select.value = matching ? previous : "";
    select.disabled = !productType;
  }

  function getSelectedProductOption(wrap) {
    var select = wrap.querySelector(".js-size-select");
    return select && select.options[select.selectedIndex];
  }

  function notifyProductGallery(wrap) {
    var styleSelect = wrap.querySelector(".js-style-select");
    var option = getSelectedProductOption(wrap);
    if (!styleSelect || !styleSelect.value) return;

    document.dispatchEvent(new CustomEvent("product-options:change", {
      detail: {
        order: wrap,
        productType: styleSelect.value,
        sizeId: option && option.value ? option.dataset.sizeId || "" : "",
        frameColor: option && option.value ? option.dataset.frameColor || "" : ""
      }
    }));
  }

  document.addEventListener("product-gallery:select", function (event) {
    var detail = event.detail || {};
    var grid = detail.gallery && detail.gallery.closest(".artwork-detail-grid");
    var wrap = grid && grid.querySelector("[data-artwork-slug]");
    if (!wrap || !isPrintfulDriven(wrap) || !detail.productType) return;

    var styleSelect = wrap.querySelector(".js-style-select");
    var sizeSelect = wrap.querySelector(".js-size-select");
    styleSelect.value = detail.productType;
    populatePrintfulSizes(wrap);

    if (detail.sizeId) {
      var matchingOption = Array.prototype.find.call(sizeSelect.options, function (option) {
        var colorMatches = !detail.frameColor ||
          !option.dataset.frameColor ||
          option.dataset.frameColor === detail.frameColor;
        return option.dataset.sizeId === detail.sizeId && colorMatches;
      });
      if (matchingOption) sizeSelect.value = matchingOption.value;
    }

    updateLivePrice(wrap);
  });

  function populateSizeOptions(wrap) {
    var styleSelect = wrap.querySelector(".js-style-select");
    var sizeSelect = wrap.querySelector(".js-size-select");
    var dataSelect = wrap.querySelector(".js-size-data");
    if (!styleSelect || !sizeSelect || !dataSelect) return;

    var material = styleSelect.value;
    var previousValue = sizeSelect.value;
    sizeSelect.innerHTML = "";

    if (!material) {
      sizeSelect.disabled = true;
      var ph = document.createElement("option");
      ph.value = "";
      ph.textContent = "בחרו סגנון קודם";
      ph.selected = true;
      sizeSelect.appendChild(ph);
      return;
    }

    sizeSelect.disabled = false;
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "בחרו גודל";
    sizeSelect.appendChild(placeholder);

    var currency = getCurrency();
    var matched = false;
    Array.prototype.forEach.call(dataSelect.options, function (opt) {
      if (opt.dataset.material !== material) return;
      var clone = document.createElement("option");
      clone.value = opt.value;
      clone.dataset.material = opt.dataset.material;
      clone.dataset.materialName = opt.dataset.materialName;
      clone.dataset.note = opt.dataset.note;
      clone.dataset.sizeId = opt.dataset.sizeId;
      clone.dataset.labelIn = opt.dataset.labelIn;
      clone.dataset.labelCm = opt.dataset.labelCm;
      clone.dataset.priceIls = opt.dataset.priceIls;
      clone.dataset.priceUsd = opt.dataset.priceUsd;
      if (opt.disabled) clone.disabled = true;
      var label = currency === "USD" ? opt.dataset.labelIn : opt.dataset.labelCm;
      clone.textContent = label + (opt.disabled ? " (אזל)" : "");
      if (opt.value === previousValue) matched = true;
      sizeSelect.appendChild(clone);
    });

    sizeSelect.value = matched ? previousValue : "";
  }

  function updateLivePrice(wrap) {
    var priceEl = wrap.querySelector(".js-live-price");
    var addButton = wrap.querySelector(".js-add-to-cart");
    var option = getSelectedProductOption(wrap);
    if (!priceEl) return;
    if (!option || !option.value) {
      priceEl.textContent = "—";
      if (addButton) addButton.disabled = true;
      return;
    }
    var qtyEl = wrap.querySelector(".js-order-qty");
    var qty = qtyEl ? parseInt(qtyEl.textContent, 10) || 1 : 1;
    var currency = getCurrency();
    var unitPrice = currency === "USD" ? parseFloat(option.dataset.priceUsd) : parseFloat(option.dataset.priceIls);
    if (!Number.isFinite(unitPrice)) {
      priceEl.textContent = "—";
      if (addButton) addButton.disabled = true;
      return;
    }
    var total = unitPrice * qty;
    priceEl.textContent = currency === "USD" ? "$" + total : total + " ₪";
    if (addButton) addButton.disabled = false;
  }

  updateCartBadge();
  document.querySelectorAll(".js-currency-toggle").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.currency === getCurrency());
  });
  loadCustomerForm();
  renderCartPage();
  document.querySelectorAll("[data-artwork-slug]").forEach(function (wrap) {
    if (isPrintfulDriven(wrap)) populatePrintfulTypes(wrap);
    updateLivePrice(wrap);
  });
})();
