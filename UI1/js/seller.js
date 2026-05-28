import { deleteProductApi, getMyListings, getMyOrders, updateOrderStatus, getToken } from "./api.js";
import { switchAuthTab } from "./auth.js";
import { showToast } from "./notifications.js";
import { currentUser } from "./state.js";
import { formatPrice, refreshIcons, timeAgo } from "./utils.js";
import { openProductDetailModal } from "./ui.js";

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

let listingStatusFilter = "all";

const setSellerHubVisibility = (isVisible) => {
  const modal = byId("sellerHubModal");
  modal?.classList.toggle("is-visible", isVisible);
  modal?.setAttribute("aria-hidden", isVisible ? "false" : "true");
};

const openAuthForSeller = () => {
  const authModal = byId("authModal");
  authModal?.classList.add("is-visible");
  authModal?.setAttribute("aria-hidden", "false");
  switchAuthTab("login");
  refreshIcons();
  showToast("Please sign in with your seller account.", "info");
};

const renderSellerLoading = () => {
  const body = byId("sellerHubBody");
  if (!body) return;

  body.innerHTML = `
    <div class="chat-empty-state">
      <i data-lucide="briefcase-business"></i>
      <h4>Loading seller hub</h4>
      <p>Preparing your listing status, review notes, and image gallery.</p>
    </div>
  `;
  refreshIcons();
};

const renderListingCards = (products) => {
  if (!products.length) {
    return `
      <div class="seller-empty">
        <p>No listings match the current filter.</p>
      </div>
    `;
  }

  return products
    .map((product) => {
      const galleryCount = (product.image_urls || []).length || (product.image_url ? 1 : 0);
      const moderationLabel = product.moderation_status || "pending";
      const adminNote = product.moderation_note || "";
      const isApproved = moderationLabel === "approved";

      return `
        <article class="seller-card">
          <div class="seller-card__media">
            <img
              src="${escapeHtml(product.image_url || "https://picsum.photos/seed/seller-listing/900/600")}"
              alt="${escapeHtml(product.title)}"
              loading="lazy"
            />
          </div>
          <div class="seller-card__content">
            <div class="seller-card__top">
              <div>
                <p class="eyebrow">${escapeHtml(moderationLabel)}</p>
                <h4>${escapeHtml(product.title)}</h4>
                <p class="muted">${escapeHtml(product.category)} · ${escapeHtml(product.location)}</p>
              </div>
              <div class="seller-card__badges">
                <span class="badge">${formatPrice(product.price)}</span>
                <span class="badge">${galleryCount} image${galleryCount === 1 ? "" : "s"}</span>
              </div>
            </div>
            <div class="seller-card__meta">
              <span><i data-lucide="clock-3"></i>${product.created_at ? timeAgo(product.created_at) : "Just added"}</span>
              <span><i data-lucide="shield-check"></i>${isApproved ? "Live on marketplace" : "Waiting for review"}</span>
            </div>
            <p>${escapeHtml(product.description || "No additional details yet.")}</p>
            ${
              adminNote
                ? `
                  <div class="seller-note seller-note--${escapeHtml(moderationLabel)}">
                    <strong>Admin note</strong>
                    <p>${escapeHtml(adminNote)}</p>
                  </div>
                `
                : `
                  <div class="seller-note">
                    <strong>Status note</strong>
                    <p>${
                      isApproved
                        ? "This listing is approved and visible on the public marketplace."
                        : "This listing is not public yet. The admin team will review the product details and images first."
                    }</p>
                  </div>
                `
            }
            <div class="seller-actions">
              ${
                isApproved
                  ? `
                    <button class="outline-btn" data-seller-action="open-public" data-product-id="${product.id}">
                      <i data-lucide="external-link"></i>
                      Open Public View
                    </button>
                  `
                  : ""
              }
              <button class="ghost-btn" data-seller-action="delete-listing" data-product-id="${product.id}">
                <i data-lucide="trash-2"></i>
                Delete Listing
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
};

const renderSellerHub = (payload) => {
  const body = byId("sellerHubBody");
  if (!body) return;

  const totals = payload.totals || {};
  const products = payload.products || [];

  body.innerHTML = `
    <div class="seller-shell">
      <section class="seller-section">
        <div class="section-header">
          <div>
            <p class="eyebrow">Overview</p>
            <h2>Seller dashboard</h2>
          </div>
          <button class="ghost-btn" id="refreshSellerHub">
            <i data-lucide="refresh-cw"></i>
            Refresh
          </button>
        </div>
        <div class="seller-overview-grid">
          <article class="seller-overview-card">
            <small>Total listings</small>
            <strong>${totals.all || 0}</strong>
            <span>Everything you have submitted to the marketplace</span>
          </article>
          <article class="seller-overview-card">
            <small>Pending review</small>
            <strong>${totals.pending || 0}</strong>
            <span>Listings waiting for admin approval</span>
          </article>
          <article class="seller-overview-card">
            <small>Approved</small>
            <strong>${totals.approved || 0}</strong>
            <span>Listings currently visible on the public marketplace</span>
          </article>
          <article class="seller-overview-card">
            <small>Needs changes</small>
            <strong>${(totals.rejected || 0) + (totals.hidden || 0)}</strong>
            <span>Listings that need updates before going live again</span>
          </article>
        </div>
      </section>

      <section class="seller-section">
        <div class="section-header">
          <div>
            <p class="eyebrow">Your Listings</p>
            <h2>Status, images, and moderation notes</h2>
          </div>
        </div>
        <div class="seller-toolbar">
          <label class="admin-field">
            <span>Review status</span>
            <select id="sellerHubStatusFilter">
              <option value="all" ${listingStatusFilter === "all" ? "selected" : ""}>All</option>
              <option value="pending" ${listingStatusFilter === "pending" ? "selected" : ""}>Pending</option>
              <option value="approved" ${listingStatusFilter === "approved" ? "selected" : ""}>Approved</option>
              <option value="rejected" ${listingStatusFilter === "rejected" ? "selected" : ""}>Rejected</option>
              <option value="hidden" ${listingStatusFilter === "hidden" ? "selected" : ""}>Hidden</option>
            </select>
          </label>
        </div>
        <div class="seller-card-grid">
          ${renderListingCards(products)}
        </div>
      </section>

      <section class="seller-section" id="sellerOrdersSection">
        <div class="section-header">
          <div>
            <p class="eyebrow">Incoming Orders</p>
            <h2>Ship items to GoodCheck</h2>
          </div>
        </div>
        <div id="sellerOrdersList"><div class="chat-empty-state"><p>Loading orders…</p></div></div>
      </section>
    </div>
  `;

  byId("refreshSellerHub")?.addEventListener("click", () => {
    loadSellerHub();
  });

  byId("sellerHubStatusFilter")?.addEventListener("change", (event) => {
    listingStatusFilter = event.target.value;
    loadSellerHub();
  });

  document.querySelectorAll("[data-seller-action='open-public']").forEach((button) => {
    button.addEventListener("click", () => {
      const productId = Number(button.dataset.productId);
      closeSellerHub();
      openProductDetailModal(productId);
    });
  });

  document.querySelectorAll("[data-seller-action='delete-listing']").forEach((button) => {
    button.addEventListener("click", async () => {
      const productId = Number(button.dataset.productId);
      const confirmed = window.confirm("Delete this listing permanently?");
      if (!confirmed) return;

      const result = await deleteProductApi(productId);
      if (!result || result.error) {
        showToast(result?.message || "Unable to delete this listing.", "error");
        return;
      }

      showToast(result.message || "Listing deleted successfully.", "success");
      const { applyFilters } = await import("./filters.js");
      await applyFilters();
      await loadSellerHub();
    });
  });

  refreshIcons();

  // Load seller orders async
  loadSellerOrders();
};

const loadSellerOrders = async () => {
  const container = byId("sellerOrdersList");
  if (!container) return;
  const result = await getMyOrders("seller");
  const orders = result?.orders || [];
  const relevant = orders.filter(o => ["paid", "seller_shipped", "inspection", "inspection_passed", "delivered"].includes(o.status));
  if (!relevant.length) {
    container.innerHTML = `<div class="seller-empty"><p>No active orders requiring action.</p></div>`;
    refreshIcons();
    return;
  }
  const STATUS_LABEL = {
    paid: "Awaiting Shipment to GoodCheck",
    seller_shipped: "Shipped — GoodCheck Reviewing",
    inspection: "Under GoodCheck Inspection",
    inspection_passed: "Inspection Passed",
    delivered: "Delivered to Buyer",
  };
  container.innerHTML = `<div class="seller-card-grid">${relevant.map(o => `
    <article class="seller-order-row">
      <div class="seller-order-row__left">
        <strong>Order #${o.id}</strong>
        <p>${o.product?.title || ""}</p>
        <span class="badge order-status-badge--${o.status}">${STATUS_LABEL[o.status] || o.status}</span>
      </div>
      <div class="seller-order-row__right">
        ${o.status === "paid"
          ? `<button class="primary-btn" data-ship-order-id="${o.id}"><i data-lucide="package"></i> Mark as Shipped to GoodCheck</button>`
          : ""}
      </div>
    </article>
  `).join("")}</div>`;

  container.querySelectorAll("[data-ship-order-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const orderId = Number(btn.dataset.shipOrderId);
      btn.disabled = true;
      btn.textContent = "Updating…";
      const result = await updateOrderStatus(orderId, "seller_shipped");
      if (result?.error) {
        showToast(result.message || "Unable to update order.", "error");
      } else {
        showToast("Order marked as shipped to GoodCheck!", "success");
        await loadSellerOrders();
      }
    });
  });
  refreshIcons();
};

const renderSellerError = (message) => {
  const body = byId("sellerHubBody");
  if (!body) return;

  body.innerHTML = `
    <div class="chat-empty-state">
      <i data-lucide="triangle-alert"></i>
      <h4>Unable to load seller hub</h4>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
  refreshIcons();
};

const loadSellerHub = async () => {
  renderSellerLoading();
  const result = await getMyListings({ moderation_status: listingStatusFilter, limit: 60 });

  if (!result || result.error) {
    renderSellerError(result?.message || "Please try again in a moment.");
    return;
  }

  renderSellerHub(result);
};

export const openSellerHub = async () => {
  if (!getToken()) {
    openAuthForSeller();
    return;
  }

  if (!currentUser || (currentUser.user_type !== "seller" && !currentUser.is_admin)) {
    showToast("This dashboard is available for seller accounts only.", "error");
    return;
  }

  setSellerHubVisibility(true);
  await loadSellerHub();
};

export const closeSellerHub = () => {
  setSellerHubVisibility(false);
};

export const bindSellerHub = () => {
  const openBtn = byId("openSellerHub");
  const closeBtn = byId("closeSellerHubModal");
  const modal = byId("sellerHubModal");

  openBtn?.addEventListener("click", () => {
    openSellerHub();
  });

  closeBtn?.addEventListener("click", closeSellerHub);
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeSellerHub();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSellerHub();
    }
  });
};
