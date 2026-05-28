/**
 * payment.js — Credit card payment modal (mockup) + order creation flow
 */
import { createOrder, payOrder } from "./api.js";
import { getToken } from "./api.js";
import { showToast } from "./notifications.js";
import { refreshIcons } from "./utils.js";
import { formatPrice } from "./utils.js";
import { openOrdersModal } from "./orders.js";
import { t } from "./i18n.js";

const byId = (id) => document.getElementById(id);

let _product = null;
let _step = 1; // 1 = shipping, 2 = card

// ─────────────────────────────────────────────
//  Open / Close
// ─────────────────────────────────────────────
export const openPaymentModal = (product) => {
  if (!getToken()) {
    showToast(t("payment.sign_in_required"), "info");
    const loginBtn = byId("loginBtn");
    loginBtn?.click();
    return;
  }
  _product = product;
  _step = 1;
  renderPaymentModal();
  const modal = byId("paymentModal");
  modal?.classList.add("is-visible");
  modal?.setAttribute("aria-hidden", "false");
  refreshIcons();
};

const closePaymentModal = () => {
  const modal = byId("paymentModal");
  modal?.classList.remove("is-visible");
  modal?.setAttribute("aria-hidden", "true");
  _product = null;
  _step = 1;
};

// ─────────────────────────────────────────────
//  Render
// ─────────────────────────────────────────────
const renderPaymentModal = () => {
  const body = byId("paymentModalBody");
  if (!body || !_product) return;

  const price = formatPrice(_product.price);

  body.innerHTML = `
    <div class="pay-product-bar">
      <img src="${_product.image_url || "https://picsum.photos/seed/pay/120/90"}" alt="${_product.title}" />
      <div>
        <p class="eyebrow">${_product.category}</p>
        <strong>${_product.title}</strong>
        <p class="price-tag">${price}</p>
      </div>
    </div>

    <div class="pay-steps">
      <div class="pay-step ${_step === 1 ? "is-active" : _step > 1 ? "is-done" : ""}">
        <span>1</span> ${t("payment.step_shipping")}
      </div>
      <div class="pay-step-line"></div>
      <div class="pay-step ${_step === 2 ? "is-active" : ""}">
        <span>2</span> ${t("payment.step_payment")}
      </div>
    </div>

    ${_step === 1 ? renderShippingStep() : renderCardStep(price)}
  `;

  // Step 1 events
  const shippingForm = byId("shippingForm");
  shippingForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    _step = 2;
    renderPaymentModal();
  });

  // Step 2 events
  const cardForm = byId("cardPayForm");
  cardForm?.addEventListener("submit", handlePaySubmit);
  bindCardPreviewListeners();
  refreshIcons();
};

const renderShippingStep = () => `
  <form id="shippingForm" class="pay-form">
    <h4>${t("payment.shipping_title")}</h4>
    <label>
      <span>${t("payment.field_fullname")}</span>
      <input type="text" name="name" required placeholder="${t("payment.field_fullname_placeholder")}" />
    </label>
    <label>
      <span>${t("payment.field_phone")}</span>
      <input type="tel" name="phone" required placeholder="${t("payment.field_phone_placeholder")}" />
    </label>
    <label class="field-span-2">
      <span>${t("payment.field_address")}</span>
      <textarea name="address" rows="3" required placeholder="${t("payment.field_address_placeholder")}"></textarea>
    </label>
    <label>
      <span>${t("payment.field_city")}</span>
      <input type="text" name="city" required placeholder="${t("payment.field_city_placeholder")}" />
    </label>
    <label>
      <span>${t("payment.field_postal")}</span>
      <input type="text" name="postal" required placeholder="${t("payment.field_postal_placeholder")}" maxlength="5" />
    </label>
    <button type="submit" class="primary-btn field-span-2">
      <i data-lucide="arrow-right"></i> ${t("payment.btn_continue")}
    </button>
  </form>
`;

const renderCardStep = (price) => `
  <div class="pay-card-preview" id="cardPreview">
    <div class="pay-card-preview__chip"></div>
    <div class="pay-card-preview__number" id="previewNumber">•••• •••• •••• ••••</div>
    <div class="pay-card-preview__row">
      <div>
        <small>${t("payment.card_holder_label")}</small>
        <span id="previewName">${t("payment.card_holder_label").toUpperCase()}</span>
      </div>
      <div>
        <small>${t("payment.card_expires_label")}</small>
        <span id="previewExpiry">MM/YY</span>
      </div>
      <div class="pay-card-preview__brand">
        <i data-lucide="credit-card"></i>
      </div>
    </div>
  </div>

  <form id="cardPayForm" class="pay-form">
    <h4>${t("payment.card_title")}</h4>
    <label class="field-span-2">
      <span>${t("payment.field_card_number")}</span>
      <input type="text" id="cardNumber" name="card_number" maxlength="19"
             placeholder="1234 5678 9012 3456" autocomplete="cc-number" required />
    </label>
    <label class="field-span-2">
      <span>${t("payment.field_card_name")}</span>
      <input type="text" id="cardName" name="card_name" placeholder="${t("payment.field_card_name_placeholder")}"
             autocomplete="cc-name" required />
    </label>
    <label>
      <span>${t("payment.field_expiry")}</span>
      <input type="text" id="cardExpiry" name="card_expiry" maxlength="5"
             placeholder="MM/YY" autocomplete="cc-exp" required />
    </label>
    <label>
      <span>${t("payment.field_cvv")}</span>
      <input type="text" id="cardCvv" name="card_cvv" maxlength="4"
             placeholder="•••" autocomplete="cc-csc" required />
    </label>
    <div class="pay-secure-badge">
      <i data-lucide="lock"></i>
      <span>${t("payment.ssl_badge")}</span>
    </div>
    <button type="button" class="ghost-btn" id="payBackBtn">
      <i data-lucide="arrow-left"></i> ${t("payment.btn_back")}
    </button>
    <button type="submit" class="primary-btn" id="paySubmitBtn">
      <i data-lucide="shield-check"></i> ${t("payment.btn_pay", { price })}
    </button>
  </form>
`;

// ─────────────────────────────────────────────
//  Card Preview Live Binding
// ─────────────────────────────────────────────
const bindCardPreviewListeners = () => {
  const cardNumber = byId("cardNumber");
  const cardName = byId("cardName");
  const cardExpiry = byId("cardExpiry");
  const backBtn = byId("payBackBtn");

  cardNumber?.addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 16);
    e.target.value = v.replace(/(.{4})/g, "$1 ").trim();
    const preview = byId("previewNumber");
    if (preview) {
      const padded = v.padEnd(16, "•");
      preview.textContent = padded.replace(/(.{4})/g, "$1 ").trim();
    }
  });

  cardName?.addEventListener("input", (e) => {
    const preview = byId("previewName");
    if (preview) preview.textContent = e.target.value.toUpperCase() || "YOUR NAME";
  });

  cardExpiry?.addEventListener("input", (e) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
    e.target.value = v;
    const preview = byId("previewExpiry");
    if (preview) preview.textContent = v || "MM/YY";
  });

  backBtn?.addEventListener("click", () => {
    _step = 1;
    renderPaymentModal();
  });
};

// ─────────────────────────────────────────────
//  Submit
// ─────────────────────────────────────────────
const handlePaySubmit = async (e) => {
  e.preventDefault();
  if (!_product) return;

  const submitBtn = byId("paySubmitBtn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = t("payment.processing");
  }

  // Step 1: create order
  const orderResult = await createOrder({
    product_id: _product.id,
    shipping_address: getShippingAddressText(),
    note: "",
  });

  if (!orderResult || orderResult.error) {
    showToast(orderResult?.message || t("payment.error_create"), "error");
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = `<i data-lucide="shield-check"></i> ${t("payment.btn_pay", { price: formatPrice(_product?.price || 0) })}`; }
    refreshIcons();
    return;
  }

  // Step 2: pay
  const form = byId("cardPayForm");
  const fd = new FormData(form);
  const payResult = await payOrder(orderResult.order.id, {
    card_number: fd.get("card_number"),
    card_name: fd.get("card_name"),
    card_expiry: fd.get("card_expiry"),
    card_cvv: fd.get("card_cvv"),
  });

  if (!payResult || payResult.error) {
    showToast(payResult?.message || t("payment.error_pay"), "error");
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = `<i data-lucide="shield-check"></i> ${t("payment.btn_pay", { price: formatPrice(_product?.price || 0) })}`; }
    refreshIcons();
    return;
  }

  // Success
  closePaymentModal();
  showPaymentSuccess(payResult.order);
};

const getShippingAddressText = () => {
  const form = byId("shippingForm");
  if (!form) return "";
  const fd = new FormData(form);
  return [fd.get("name"), fd.get("phone"), fd.get("address"), fd.get("city"), fd.get("postal")]
    .filter(Boolean).join(", ");
};

const showPaymentSuccess = (order) => {
  const modal = byId("paymentModal");
  const body = byId("paymentModalBody");
  if (!body) return;

  body.innerHTML = `
    <div class="pay-success">
      <div class="pay-success__icon">
        <i data-lucide="check-circle"></i>
      </div>
      <h3>${t("payment.success_title")}</h3>
      <p>${t("payment.success_desc", { id: order.id })}<br>
         ${t("payment.success_note")}</p>
      <div class="pay-success__timeline">
        <div class="pay-tl-step is-done"><span>✓</span> ${t("payment.tl_payment")}</div>
        <div class="pay-tl-step"><span>2</span> ${t("payment.tl_seller_shipped")}</div>
        <div class="pay-tl-step"><span>3</span> ${t("payment.tl_inspection")}</div>
        <div class="pay-tl-step"><span>4</span> ${t("payment.tl_shipped")}</div>
      </div>
      <div class="pay-success__actions">
        <button class="primary-btn" id="viewMyOrdersBtn">
          <i data-lucide="package"></i> ${t("payment.btn_track")}
        </button>
        <button class="ghost-btn" id="closePaymentSuccess">${t("payment.btn_close")}</button>
      </div>
    </div>
  `;

  modal?.classList.add("is-visible");
  modal?.setAttribute("aria-hidden", "false");
  refreshIcons();

  byId("viewMyOrdersBtn")?.addEventListener("click", () => {
    closePaymentModal();
    openOrdersModal();
  });
  byId("closePaymentSuccess")?.addEventListener("click", closePaymentModal);
};

// ─────────────────────────────────────────────
//  Bind
// ─────────────────────────────────────────────
export const bindPaymentModal = () => {
  const modal = byId("paymentModal");
  const closeBtn = byId("closePaymentModal");

  closeBtn?.addEventListener("click", closePaymentModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closePaymentModal();
  });
};
