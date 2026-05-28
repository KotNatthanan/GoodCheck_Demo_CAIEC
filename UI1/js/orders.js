/**
 * orders.js — Buyer "My Orders" modal with inspection timeline
 */
import { addSellerReview, createBuyerClaim, getMyOrders, updateOrderStatus } from "./api.js";
import { getToken } from "./api.js";
import { showToast } from "./notifications.js";
import { formatPrice, refreshIcons, timeAgo } from "./utils.js";
import { t } from "./i18n.js";

const byId = (id) => document.getElementById(id);
const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const getDisplayName = (user) => user?.full_name || user?.username || t("orders.seller_fallback");
const renderStars = (rating = 0) => {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  return `${"★".repeat(safeRating)}${"☆".repeat(5 - safeRating)}`;
};
const CLAIM_STATUS_LABELS = () => ({
  open: t("orders.claim_status_open"),
  reviewing: t("orders.claim_status_reviewing"),
  resolved_refund: t("orders.claim_status_resolved_refund"),
  resolved_release: t("orders.claim_status_resolved_release"),
  rejected: t("orders.claim_status_rejected"),
});

const STATUS_LABELS = () => ({
  pending_payment:    t("orders.status_pending_payment"),
  paid:               t("orders.status_paid"),
  seller_shipped:     t("orders.status_seller_shipped"),
  inspection:         t("orders.status_inspection"),
  inspection_passed:  t("orders.status_inspection_passed"),
  delivered:          t("orders.status_delivered"),
  completed:          t("orders.status_completed"),
  cancelled:          t("orders.status_cancelled"),
});

const STATUS_STEPS = () => [
  { key: "paid",              label: t("orders.step_paid"),              icon: "credit-card" },
  { key: "seller_shipped",    label: t("orders.step_seller_shipped"),    icon: "package" },
  { key: "inspection",        label: t("orders.step_inspection"),        icon: "shield-check" },
  { key: "inspection_passed", label: t("orders.step_inspection_passed"), icon: "badge-check" },
  { key: "delivered",         label: t("orders.step_delivered"),         icon: "truck" },
  { key: "completed",         label: t("orders.step_completed"),         icon: "check-circle" },
];

const stepIndex = (status) => STATUS_STEPS().findIndex((s) => s.key === status);

// ─────────────────────────────────────────────
//  Visibility
// ─────────────────────────────────────────────
const setVisible = (isVisible) => {
  const modal = byId("ordersModal");
  modal?.classList.toggle("is-visible", isVisible);
  modal?.setAttribute("aria-hidden", isVisible ? "false" : "true");
};

export const openOrdersModal = async () => {
  if (!getToken()) {
    showToast(t("orders.sign_in_required"), "info");
    byId("loginBtn")?.click();
    return;
  }
  setVisible(true);
  await loadOrders();
};

export const closeOrdersModal = () => setVisible(false);

// ─────────────────────────────────────────────
//  Load & Render
// ─────────────────────────────────────────────
const loadOrders = async () => {
  const body = byId("ordersModalBody");
  if (!body) return;

  body.innerHTML = `<div class="chat-empty-state"><i data-lucide="loader"></i><h4>${t("orders.loading")}</h4></div>`;
  refreshIcons();

  const result = await getMyOrders("buyer");
  if (!result || result.error) {
    body.innerHTML = `<div class="chat-empty-state"><i data-lucide="triangle-alert"></i><h4>${t("orders.error")}</h4><p>${result?.message || t("orders.error_retry")}</p></div>`;
    refreshIcons();
    return;
  }

  const orders = result.orders || [];
  if (!orders.length) {
    body.innerHTML = `<div class="chat-empty-state"><i data-lucide="package-search"></i><h4>${t("orders.empty_title")}</h4><p>${t("orders.empty_desc")}</p></div>`;
    refreshIcons();
    return;
  }

  body.innerHTML = `<div class="orders-list">${orders.map(renderOrderCard).join("")}</div>`;
  bindOrderActions();
  refreshIcons();
};

const renderOrderCard = (order) => {
  const isCancelled = order.status === "cancelled";
  const isPendingPayment = order.status === "pending_payment";
  const currentStep = stepIndex(order.status);
  const steps = STATUS_STEPS();
  const label = STATUS_LABELS()[order.status] || order.status;
  const sellerName = escapeHtml(getDisplayName(order.seller));

  const timelineHtml = isCancelled || isPendingPayment ? "" : `
    <div class="order-timeline">
      ${steps.map((step, i) => `
        <div class="order-tl-step ${i <= currentStep ? "is-done" : ""} ${i === currentStep ? "is-active" : ""}">
          <div class="order-tl-step__dot">
            <i data-lucide="${step.icon}"></i>
          </div>
          <span>${step.label}</span>
        </div>
      `).join("")}
    </div>
  `;

  const trackingNote = order.tracking_note
    ? `<div class="order-tracking-note"><i data-lucide="info"></i> <span>${order.tracking_note}</span></div>`
    : "";

  const cancelBtn = ["pending_payment", "paid"].includes(order.status)
    ? `<button class="ghost-btn order-cancel-btn" data-order-id="${order.id}">
         <i data-lucide="x-circle"></i> ${t("orders.btn_cancel")}
       </button>` : "";
  const claimPanel = ["delivered", "completed"].includes(order.status)
    ? renderBuyerClaimPanel(order, sellerName)
    : "";

  const reviewPanel = order.status === "completed"
    ? renderSellerReviewPanel(order, sellerName)
    : "";

  return `
    <article class="order-card ${isCancelled ? "order-card--cancelled" : ""}">
      <div class="order-card__top">
        <div class="order-card__info">
          <p class="eyebrow">Order #${order.id}</p>
          <strong>${order.product?.title || "Product"}</strong>
          <small class="muted">${order.created_at ? timeAgo(order.created_at) : ""}</small>
        </div>
        <div class="order-card__right">
          <p class="price-tag">${formatPrice(order.total_price)}</p>
          <span class="order-status-badge order-status-badge--${order.status}">${label}</span>
        </div>
      </div>
      ${timelineHtml}
      ${trackingNote}
      ${order.payment_last4 ? `<p class="muted" style="font-size:0.82rem">${t("orders.paid_with_card", { last4: order.payment_last4 })}</p>` : ""}
      ${claimPanel}
      ${reviewPanel}
      <div class="order-card__actions">${cancelBtn}</div>
    </article>
  `;
};

const renderBuyerClaimPanel = (order, sellerName) => {
  const claim = order.buyer_claim;
  if (claim) {
    const statusLabel = CLAIM_STATUS_LABELS()[claim.status] || claim.status;
    return `
      <section class="order-review-panel order-review-panel--claim-submitted">
        <div class="order-review-panel__header">
          <div>
            <p class="eyebrow">${t("orders.claim_submitted_label")}</p>
            <strong>${t("orders.claim_submitted_title")}</strong>
          </div>
          <span class="claim-status-badge claim-status-badge--${claim.status}">${statusLabel}</span>
        </div>
        <p class="order-review-panel__copy">${t("orders.claim_submitted_copy", { seller: sellerName })}</p>
        <div class="order-review-note">
          <strong>${t(`orders.claim_reason_${claim.reason}`)}</strong>
          <p>${escapeHtml(claim.details)}</p>
          ${
            claim.admin_note
              ? `<div class="order-claim-admin-note">
                   <small>${t("orders.claim_admin_note")}</small>
                   <p>${escapeHtml(claim.admin_note)}</p>
                 </div>`
              : ""
          }
        </div>
      </section>
    `;
  }

  return `
    <section class="order-review-panel order-review-panel--claim">
      <div class="order-review-panel__header">
        <div>
          <p class="eyebrow">${t("orders.claim_ready_label")}</p>
          <strong>${t("orders.claim_ready_title")}</strong>
        </div>
        <span class="badge">${t("orders.claim_ready_badge")}</span>
      </div>
      <p class="order-review-panel__copy">${t("orders.claim_prompt", { seller: sellerName })}</p>
      <form class="order-review-form" data-order-claim-form="${order.id}">
        <label>
          ${t("orders.claim_reason")}
          <select name="reason" required>
            <option value="damaged_in_transit">${t("orders.claim_reason_damaged_in_transit")}</option>
            <option value="not_as_described">${t("orders.claim_reason_not_as_described")}</option>
            <option value="missing_parts">${t("orders.claim_reason_missing_parts")}</option>
            <option value="functionality_issue">${t("orders.claim_reason_functionality_issue")}</option>
            <option value="seller_misrepresentation">${t("orders.claim_reason_seller_misrepresentation")}</option>
            <option value="other">${t("orders.claim_reason_other")}</option>
          </select>
        </label>
        <label>
          ${t("orders.claim_details")}
          <textarea name="details" rows="4" minlength="10" required placeholder="${t("orders.claim_placeholder")}"></textarea>
        </label>
        <button type="submit" class="outline-btn">
          <i data-lucide="shield-alert"></i> ${t("orders.claim_submit")}
        </button>
      </form>
    </section>
  `;
};

const renderSellerReviewPanel = (order, sellerName) => {
  const review = order.seller_review;
  if (review) {
    return `
      <section class="order-review-panel order-review-panel--submitted">
        <div class="order-review-panel__header">
          <div>
            <p class="eyebrow">${t("orders.review_submitted_label")}</p>
            <strong>${t("orders.review_submitted_title")}</strong>
          </div>
          <span class="order-review-stars">${renderStars(review.rating)}</span>
        </div>
        <p class="order-review-panel__copy">${t("orders.review_submitted_copy", { seller: sellerName })}</p>
        <div class="order-review-note">
          <strong>${sellerName}</strong>
          <span class="order-review-note__stars">${renderStars(review.rating)} (${review.rating}/5)</span>
          ${review.comment ? `<p>${escapeHtml(review.comment)}</p>` : `<p>${t("orders.review_no_comment")}</p>`}
        </div>
      </section>
    `;
  }

  return `
    <section class="order-review-panel">
      <div class="order-review-panel__header">
        <div>
          <p class="eyebrow">${t("orders.review_ready_label")}</p>
          <strong>${t("orders.review_ready_title")}</strong>
        </div>
        <span class="badge">${t("orders.review_ready_badge")}</span>
      </div>
      <p class="order-review-panel__copy">${t("orders.review_prompt", { seller: sellerName })}</p>
      <form class="order-review-form" data-order-review-form="${order.id}">
        <label>
          ${t("orders.review_rating")}
          <select name="rating" required>
            <option value="5">⭐⭐⭐⭐⭐ (5)</option>
            <option value="4">⭐⭐⭐⭐ (4)</option>
            <option value="3">⭐⭐⭐ (3)</option>
            <option value="2">⭐⭐ (2)</option>
            <option value="1">⭐ (1)</option>
          </select>
        </label>
        <label>
          ${t("orders.review_comment")}
          <textarea name="comment" rows="3" placeholder="${t("orders.review_placeholder")}"></textarea>
        </label>
        <button type="submit" class="primary-btn">
          <i data-lucide="send"></i> ${t("orders.review_submit")}
        </button>
      </form>
    </section>
  `;
};

const bindOrderActions = () => {
  document.querySelectorAll(".order-cancel-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const orderId = Number(btn.dataset.orderId);
      if (!confirm(t("orders.confirm_cancel"))) return;
      const result = await updateOrderStatus(orderId, "cancelled");
      if (result?.error) {
        showToast(result.message || t("orders.cancel_error"), "error");
      } else {
        showToast(t("orders.cancel_success"), "info");
        await loadOrders();
      }
    });
  });

  document.querySelectorAll("[data-order-review-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const orderId = Number(form.dataset.orderReviewForm);
      const fd = new FormData(form);
      const result = await addSellerReview(orderId, {
        rating: Number(fd.get("rating")),
        comment: fd.get("comment"),
      });

      if (result?.seller_review) {
        showToast(t("orders.review_success"), "success");
        await loadOrders();
      } else {
        showToast(result?.message || t("orders.review_error"), "error");
      }
    });
  });

  document.querySelectorAll("[data-order-claim-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const orderId = Number(form.dataset.orderClaimForm);
      const fd = new FormData(form);
      const result = await createBuyerClaim(orderId, {
        reason: fd.get("reason"),
        details: fd.get("details"),
      });

      if (result?.buyer_claim) {
        showToast(t("orders.claim_success"), "success");
        await loadOrders();
      } else {
        showToast(result?.message || t("orders.claim_error"), "error");
      }
    });
  });
};

// ─────────────────────────────────────────────
//  Bind
// ─────────────────────────────────────────────
export const bindOrdersModal = () => {
  const closeBtn = byId("closeOrdersModal");
  const modal = byId("ordersModal");
  const openBtn = byId("openMyOrders");

  openBtn?.addEventListener("click", openOrdersModal);
  closeBtn?.addEventListener("click", closeOrdersModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeOrdersModal();
  });
};
