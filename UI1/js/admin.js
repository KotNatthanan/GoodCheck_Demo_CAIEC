import {
  getAdminClaims,
  getAdminLogs,
  getAdminOrders,
  getAdminOverview,
  getAdminProducts,
  getAdminRiskDashboard,
  getAdminUsers,
  getVerificationEvents,
  getToken,
  moderateProduct,
  submitVerificationFeedback,
  updateAdminClaim,
  updateAdminOrderStatus,
  updateAdminUser,
} from "./api.js";
import { switchAuthTab } from "./auth.js";
import { showToast } from "./notifications.js";
import { currentUser } from "./state.js";
import { formatPrice, refreshIcons, timeAgo } from "./utils.js";

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

let productFilter = "pending";
let productSearch = "";
let userStatusFilter = "all";
let userTypeFilter = "all";
let userSearch = "";
let claimStatusFilter = "open";

const riskClass = (level = "low") => `risk-badge risk-badge--${level}`;
const riskLabel = (risk) => `${String(risk?.level || "low").toUpperCase()} ${Number(risk?.score || 0)}%`;

const setAdminModalVisibility = (isVisible) => {
  const modal = byId("adminModal");
  modal?.classList.toggle("is-visible", isVisible);
  modal?.setAttribute("aria-hidden", isVisible ? "false" : "true");
};

const openAuthForAdmin = () => {
  const authModal = byId("authModal");
  authModal?.classList.add("is-visible");
  authModal?.setAttribute("aria-hidden", "false");
  switchAuthTab("login");
  refreshIcons();
  showToast("Please sign in with an admin account.", "info");
};

const renderAdminLoading = () => {
  const body = byId("adminPanelBody");
  if (!body) return;

  body.innerHTML = `
    <div class="chat-empty-state">
      <i data-lucide="shield-check"></i>
      <h4>Loading admin console</h4>
      <p>Preparing moderation queues, user controls, and audit logs.</p>
    </div>
  `;
  refreshIcons();
};

const renderProductCards = (products) => {
  if (!products.length) {
    return `
      <div class="admin-empty">
        <p>No listings match the current moderation filters.</p>
      </div>
    `;
  }

  return products
    .map((product) => {
      const sellerName =
        product.seller?.full_name || product.seller?.username || "Seller";
      const galleryImages =
        product.image_urls && product.image_urls.length
          ? product.image_urls
          : [product.image_url || "https://picsum.photos/seed/admin-product/900/600"];
      return `
        <article class="admin-card admin-product-card">
          <div class="admin-product-card__media">
            <img
              src="${escapeHtml(galleryImages[0])}"
              alt="${escapeHtml(product.title)}"
              loading="lazy"
            />
          </div>
          ${
            galleryImages.length > 1
              ? `
                <div class="admin-product-card__gallery">
                  ${galleryImages
                    .slice(0, 4)
                    .map(
                      (imageUrl, index) => `
                        <img
                          src="${escapeHtml(imageUrl)}"
                          alt="${escapeHtml(product.title)} image ${index + 1}"
                          loading="lazy"
                        />
                      `
                    )
                    .join("")}
                </div>
              `
              : ""
          }
          <div class="admin-card__top">
            <div>
              <p class="eyebrow">${escapeHtml(product.moderation_status || "pending")}</p>
              <h4>${escapeHtml(product.title)}</h4>
              <p class="muted">${escapeHtml(sellerName)} · ${escapeHtml(product.category)}</p>
            </div>
            <div class="admin-badges">
              <span class="${riskClass(product.risk?.level)}">${riskLabel(product.risk)}</span>
              <span class="badge">${formatPrice(product.price)}</span>
              <span class="badge">${escapeHtml(product.status || "available")}</span>
              <span class="badge">${galleryImages.length} image${galleryImages.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <div class="risk-reason-list">
            ${(product.risk?.reasons || []).slice(0, 3).map(reason => `<span>${escapeHtml(reason)}</span>`).join("")}
          </div>
          <p>${escapeHtml(product.description || "No description provided.")}</p>
          <div class="admin-meta-row">
            <span><i data-lucide="map-pin"></i>${escapeHtml(product.location || "Unknown location")}</span>
            <span><i data-lucide="shield-check"></i>${product.seller?.is_verified ? "Verified seller" : "Not verified"}</span>
          </div>
          <label class="admin-field">
            <span>Moderation note</span>
            <textarea data-product-note-id="${product.id}" rows="3" placeholder="Explain the admin decision or what the seller should fix.">${escapeHtml(product.moderation_note || "")}</textarea>
          </label>
          <div class="admin-actions">
            <button class="primary-btn" data-admin-product-action="approved" data-product-id="${product.id}">
              <i data-lucide="check-circle"></i>
              Approve
            </button>
            <button class="outline-btn" data-admin-product-action="rejected" data-product-id="${product.id}">
              <i data-lucide="x-circle"></i>
              Reject
            </button>
            <button class="ghost-btn" data-admin-product-action="hidden" data-product-id="${product.id}">
              <i data-lucide="eye-off"></i>
              Hide
            </button>
          </div>
        </article>
      `;
    })
    .join("");
};

const renderUserCards = (users) => {
  if (!users.length) {
    return `
      <div class="admin-empty">
        <p>No users match the current filters.</p>
      </div>
    `;
  }

  return users
    .map((user) => `
      <article class="admin-card admin-user-card">
        <div class="admin-card__top">
          <div>
            <h4>${escapeHtml(user.full_name || user.username)}</h4>
            <p class="muted">${escapeHtml(user.email)} · ${escapeHtml(user.user_type)}</p>
          </div>
          <div class="admin-badges">
            ${user.is_admin ? '<span class="trust-badge">Admin</span>' : ""}
            ${user.is_verified ? '<span class="trust-badge">Verified</span>' : '<span class="badge">Unverified</span>'}
            <span class="badge">${escapeHtml(user.account_status || "active")}</span>
          </div>
        </div>
        <div class="admin-metrics">
          <span>Listings ${user.product_count || 0}</span>
          <span>Purchases ${user.purchase_count || 0}</span>
          <span>Sales ${user.sales_count || 0}</span>
          <span>Joined ${user.created_at ? timeAgo(user.created_at) : "-"}</span>
        </div>
        <div class="admin-user-form">
          <label class="admin-field">
            <span>Account status</span>
            <select data-user-status-id="${user.id}">
              <option value="active" ${user.account_status === "active" ? "selected" : ""}>Active</option>
              <option value="suspended" ${user.account_status === "suspended" ? "selected" : ""}>Suspended</option>
            </select>
          </label>
          <label class="admin-toggle">
            <input type="checkbox" data-user-verified-id="${user.id}" ${user.is_verified ? "checked" : ""} />
            <span>Verified account</span>
          </label>
        </div>
        <label class="admin-field">
          <span>Admin notes</span>
          <textarea data-user-note-id="${user.id}" rows="3" placeholder="Explain why this account is being monitored, verified, or suspended.">${escapeHtml(user.admin_notes || "")}</textarea>
        </label>
        <div class="admin-actions">
          <button class="primary-btn" data-action="save-user" data-user-id="${user.id}">
            <i data-lucide="save"></i>
            Save User Settings
          </button>
        </div>
      </article>
    `)
    .join("");
};

const renderLogs = (logs) => {
  if (!logs.length) {
    return `
      <div class="admin-empty">
        <p>No moderation actions recorded yet.</p>
      </div>
    `;
  }

  return logs
    .map((log) => `
      <article class="admin-log-item">
        <div>
          <strong>${escapeHtml(log.action)}</strong>
          <p>${escapeHtml(log.note || "No note attached.")}</p>
        </div>
        <small>${escapeHtml(log.target_type)} #${log.target_id} · ${log.created_at ? timeAgo(log.created_at) : ""}</small>
      </article>
    `)
    .join("");
};

const renderRiskDashboard = (riskDashboard = {}) => {
  const summary = riskDashboard.summary || {};
  const riskyProducts = riskDashboard.risky_products || [];
  const duplicateGroups = riskDashboard.duplicate_image_groups || [];

  return `
    <div class="admin-summary-grid">
      <article class="admin-summary-card">
        <small>High-risk listings</small>
        <strong>${summary.high_risk_listings || 0}</strong>
        <span>Listings requiring immediate review</span>
      </article>
      <article class="admin-summary-card">
        <small>Duplicate image groups</small>
        <strong>${summary.duplicate_image_groups || 0}</strong>
        <span>Potential reposts or copied listing images</span>
      </article>
      <article class="admin-summary-card">
        <small>Escrow value held</small>
        <strong>${formatPrice(summary.escrow_holding_value || 0)}</strong>
        <span>Protected order value not released yet</span>
      </article>
      <article class="admin-summary-card">
        <small>AI reviewed pairs</small>
        <strong>${summary.ai_reviewed_pairs || 0}</strong>
        <span>${summary.feedback_accuracy == null ? "Feedback accuracy pending" : `${summary.feedback_accuracy}% feedback accuracy`}</span>
      </article>
    </div>
    <div class="admin-card-grid">
      <article class="admin-card">
        <div class="admin-card__top">
          <div>
            <p class="eyebrow">Risk Queue</p>
            <h4>Listings to inspect first</h4>
          </div>
        </div>
        <div class="risk-list">
          ${
            riskyProducts.length
              ? riskyProducts.slice(0, 6).map(product => `
                <div class="risk-row">
                  <div>
                    <strong>${escapeHtml(product.title)}</strong>
                    <p>${escapeHtml(product.seller?.username || product.seller?.full_name || "Seller")} · ${escapeHtml(product.category || "")}</p>
                  </div>
                  <span class="${riskClass(product.risk?.level)}">${riskLabel(product.risk)}</span>
                </div>
              `).join("")
              : `<div class="admin-empty admin-empty--compact"><p>No elevated listing risks detected.</p></div>`
          }
        </div>
      </article>
      <article class="admin-card">
        <div class="admin-card__top">
          <div>
            <p class="eyebrow">Image Reuse</p>
            <h4>Duplicate image signals</h4>
          </div>
        </div>
        <div class="risk-list">
          ${
            duplicateGroups.length
              ? duplicateGroups.slice(0, 4).map(group => `
                <div class="risk-row">
                  <img src="${escapeHtml(group.image_url)}" alt="Duplicate listing evidence" loading="lazy" />
                  <div>
                    <strong>${group.products.length} listings share this image</strong>
                    <p>${group.products.map(product => `#${product.id} ${escapeHtml(product.title)}`).join(" · ")}</p>
                  </div>
                </div>
              `).join("")
              : `<div class="admin-empty admin-empty--compact"><p>No duplicate product images found.</p></div>`
          }
        </div>
      </article>
    </div>
  `;
};

const renderVerificationEvents = (eventsPayload = {}) => {
  const events = eventsPayload.events || [];
  if (!events.length) {
    return `<div class="admin-empty"><p>No AI verification events recorded yet. Run Compare Images to build the dataset.</p></div>`;
  }

  return `
    <div class="admin-card-grid">
      ${events.map((event) => `
        <article class="admin-card verification-event-card">
          <div class="admin-card__top">
            <div>
              <p class="eyebrow">Event #${event.id} · ${event.created_at ? timeAgo(event.created_at) : ""}</p>
              <h4>${escapeHtml(String(event.verdict || "").replace(/_/g, " "))}</h4>
              <p class="muted">${escapeHtml(event.product_category || "Unknown category")} · ${escapeHtml(event.image1_name || "Image 1")} vs ${escapeHtml(event.image2_name || "Image 2")}</p>
            </div>
            <div class="admin-badges">
              <span class="badge">${event.overall_similarity}% visual</span>
              <span class="badge">${event.same_item_confidence}% same item</span>
              ${event.feedback_label ? `<span class="trust-badge">${escapeHtml(event.feedback_label)}</span>` : `<span class="badge">No feedback</span>`}
            </div>
          </div>
          <p>${escapeHtml(event.reasoning || "No reasoning recorded.")}</p>
          <div class="admin-actions">
            <button class="outline-btn" data-verification-feedback="correct" data-event-id="${event.id}">Correct</button>
            <button class="outline-btn" data-verification-feedback="wrong" data-event-id="${event.id}">Wrong</button>
            <button class="ghost-btn" data-verification-feedback="needs_review" data-event-id="${event.id}">Needs review</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
};

const bindAdminActions = () => {
  byId("adminProductFilter")?.addEventListener("change", (event) => {
    productFilter = event.target.value;
    loadAdminPanel();
  });

  byId("adminProductSearchBtn")?.addEventListener("click", () => {
    productSearch = byId("adminProductSearch")?.value?.trim() || "";
    loadAdminPanel();
  });

  byId("adminUserStatusFilter")?.addEventListener("change", (event) => {
    userStatusFilter = event.target.value;
    loadAdminPanel();
  });

  byId("adminUserTypeFilter")?.addEventListener("change", (event) => {
    userTypeFilter = event.target.value;
    loadAdminPanel();
  });

  byId("adminUserSearchBtn")?.addEventListener("click", () => {
    userSearch = byId("adminUserSearch")?.value?.trim() || "";
    loadAdminPanel();
  });

  byId("adminClaimStatusFilter")?.addEventListener("change", (event) => {
    claimStatusFilter = event.target.value;
    loadAdminClaims();
  });

  document.querySelectorAll("[data-admin-product-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const productId = Number(button.dataset.productId);
      const moderationStatus = button.dataset.adminProductAction;
      const note = byId(`product-note-${productId}`) || document.querySelector(`[data-product-note-id="${productId}"]`);
      const moderationNote = note?.value?.trim() || "";

      const result = await moderateProduct(productId, {
        moderation_status: moderationStatus,
        moderation_note: moderationNote,
      });

      if (!result || result.error) {
        showToast(result?.message || "Unable to update listing moderation.", "error");
        return;
      }

      showToast(result.message || "Listing moderation updated.", "success");
      await loadAdminPanel();
    });
  });

  document.querySelectorAll("[data-action='save-user']").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = Number(button.dataset.userId);
      const accountStatus =
        document.querySelector(`[data-user-status-id="${userId}"]`)?.value || "active";
      const isVerified = Boolean(
        document.querySelector(`[data-user-verified-id="${userId}"]`)?.checked
      );
      const adminNotes =
        document.querySelector(`[data-user-note-id="${userId}"]`)?.value?.trim() || "";

      const result = await updateAdminUser(userId, {
        account_status: accountStatus,
        is_verified: isVerified,
        admin_notes: adminNotes,
      });

      if (!result || result.error) {
        showToast(result?.message || "Unable to update user status.", "error");
        return;
      }

      showToast(result.message || "User status updated.", "success");
      await loadAdminPanel();
    });
  });

  document.querySelectorAll("[data-verification-feedback]").forEach((button) => {
    button.addEventListener("click", async () => {
      const eventId = Number(button.dataset.eventId);
      const feedbackLabel = button.dataset.verificationFeedback;
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "Saving…";

      const result = await submitVerificationFeedback(eventId, {
        feedback_label: feedbackLabel,
      });

      if (!result || result.error) {
        showToast(result?.message || "Unable to save verification feedback.", "error");
        button.disabled = false;
        button.textContent = originalText;
        return;
      }

      showToast("Verification feedback saved.", "success");
      await loadAdminPanel();
    });
  });

  refreshIcons();
};

const renderAdminPanel = (overview, productQueue, users, logs, riskDashboard, verificationEvents) => {
  const body = byId("adminPanelBody");
  if (!body) return;

  body.innerHTML = `
    <div class="admin-shell">
      <section class="admin-section">
        <div class="section-header">
          <div>
            <p class="eyebrow">Overview</p>
            <h2>Admin standards dashboard</h2>
          </div>
          <button class="ghost-btn" id="refreshAdminPanel">
            <i data-lucide="refresh-cw"></i>
            Refresh
          </button>
        </div>
        <div class="admin-summary-grid">
          <article class="admin-summary-card">
            <small>Pending listings</small>
            <strong>${overview.products?.pending || 0}</strong>
            <span>Require moderation before going live</span>
          </article>
          <article class="admin-summary-card">
            <small>Suspended users</small>
            <strong>${overview.users?.suspended || 0}</strong>
            <span>Buyer and seller accounts currently disabled</span>
          </article>
          <article class="admin-summary-card">
            <small>Items at GoodCheck</small>
            <strong>${(overview.orders?.seller_shipped || 0) + (overview.orders?.inspection || 0)}</strong>
            <span>Orders awaiting inspection or already in review</span>
          </article>
          <article class="admin-summary-card">
            <small>Open claims</small>
            <strong>${(overview.claims?.open || 0) + (overview.claims?.reviewing || 0)}</strong>
            <span>Buyer protection issues waiting on a decision</span>
          </article>
          <article class="admin-summary-card">
            <small>Chat messages</small>
            <strong>${overview.engagement?.chat_messages || 0}</strong>
            <span>Total message volume across the marketplace</span>
          </article>
          <article class="admin-summary-card">
            <small>AI reviewed pairs</small>
            <strong>${overview.impact?.ai_reviewed_pairs || 0}</strong>
            <span>Image comparisons stored for model improvement</span>
          </article>
          <article class="admin-summary-card">
            <small>Admin time saved</small>
            <strong>${overview.impact?.estimated_admin_minutes_saved || 0}m</strong>
            <span>Estimated manual image triage avoided</span>
          </article>
        </div>
      </section>

      <section class="admin-section">
        <div class="section-header">
          <div>
            <p class="eyebrow">Fraud Intelligence</p>
            <h2>Risk signals and impact metrics</h2>
          </div>
        </div>
        ${renderRiskDashboard(riskDashboard)}
      </section>

      <section class="admin-section">
        <div class="section-header">
          <div>
            <p class="eyebrow">Listing Moderation</p>
            <h2>Seller posting queue</h2>
          </div>
        </div>
        <div class="admin-toolbar">
          <label class="admin-field">
            <span>Status</span>
            <select id="adminProductFilter">
              <option value="pending" ${productFilter === "pending" ? "selected" : ""}>Pending</option>
              <option value="approved" ${productFilter === "approved" ? "selected" : ""}>Approved</option>
              <option value="rejected" ${productFilter === "rejected" ? "selected" : ""}>Rejected</option>
              <option value="hidden" ${productFilter === "hidden" ? "selected" : ""}>Hidden</option>
              <option value="all" ${productFilter === "all" ? "selected" : ""}>All</option>
            </select>
          </label>
          <label class="admin-field admin-field--grow">
            <span>Search listings</span>
            <input id="adminProductSearch" type="search" value="${escapeHtml(productSearch)}" placeholder="Search by title, category, or seller" />
          </label>
          <button class="outline-btn" id="adminProductSearchBtn">
            <i data-lucide="search"></i>
            Apply
          </button>
        </div>
        <div class="admin-card-grid">
          ${renderProductCards(productQueue.products || [])}
        </div>
      </section>

      <section class="admin-section">
        <div class="section-header">
          <div>
            <p class="eyebrow">User Oversight</p>
            <h2>Buyer and seller controls</h2>
          </div>
        </div>
        <div class="admin-toolbar">
          <label class="admin-field">
            <span>Account status</span>
            <select id="adminUserStatusFilter">
              <option value="all" ${userStatusFilter === "all" ? "selected" : ""}>All</option>
              <option value="active" ${userStatusFilter === "active" ? "selected" : ""}>Active</option>
              <option value="suspended" ${userStatusFilter === "suspended" ? "selected" : ""}>Suspended</option>
            </select>
          </label>
          <label class="admin-field">
            <span>User type</span>
            <select id="adminUserTypeFilter">
              <option value="all" ${userTypeFilter === "all" ? "selected" : ""}>All</option>
              <option value="buyer" ${userTypeFilter === "buyer" ? "selected" : ""}>Buyer</option>
              <option value="seller" ${userTypeFilter === "seller" ? "selected" : ""}>Seller</option>
            </select>
          </label>
          <label class="admin-field admin-field--grow">
            <span>Search users</span>
            <input id="adminUserSearch" type="search" value="${escapeHtml(userSearch)}" placeholder="Search by username, email, or name" />
          </label>
          <button class="outline-btn" id="adminUserSearchBtn">
            <i data-lucide="search"></i>
            Apply
          </button>
        </div>
        <div class="admin-card-grid">
          ${renderUserCards(users.users || [])}
        </div>
      </section>

      <section class="admin-section">
        <div class="section-header">
          <div>
            <p class="eyebrow">Inspection Workflow</p>
            <h2>Orders at GoodCheck</h2>
          </div>
        </div>
        <div id="adminOrdersList"><div class="admin-empty"><p>Loading…</p></div></div>
      </section>

      <section class="admin-section">
        <div class="section-header">
          <div>
            <p class="eyebrow">Buyer Protection</p>
            <h2>Claims queue</h2>
          </div>
        </div>
        <div class="admin-toolbar">
          <label class="admin-field">
            <span>Claim status</span>
            <select id="adminClaimStatusFilter">
              <option value="open" ${claimStatusFilter === "open" ? "selected" : ""}>Open</option>
              <option value="reviewing" ${claimStatusFilter === "reviewing" ? "selected" : ""}>Reviewing</option>
              <option value="resolved_refund" ${claimStatusFilter === "resolved_refund" ? "selected" : ""}>Refund approved</option>
              <option value="resolved_release" ${claimStatusFilter === "resolved_release" ? "selected" : ""}>Funds released</option>
              <option value="rejected" ${claimStatusFilter === "rejected" ? "selected" : ""}>Rejected</option>
              <option value="all" ${claimStatusFilter === "all" ? "selected" : ""}>All</option>
            </select>
          </label>
        </div>
        <div id="adminClaimsList"><div class="admin-empty"><p>Loading…</p></div></div>
      </section>

      <section class="admin-section">
        <div class="section-header">
          <div>
            <p class="eyebrow">AI Verification Dataset</p>
            <h2>Recent image comparison events</h2>
          </div>
        </div>
        ${renderVerificationEvents(verificationEvents)}
      </section>

      <section class="admin-section">
        <div class="section-header">
          <div>
            <p class="eyebrow">Audit Trail</p>
            <h2>Recent admin actions</h2>
          </div>
        </div>
        <div class="admin-log-list">
          ${renderLogs(logs.logs || [])}
        </div>
      </section>
    </div>
  `;

  byId("refreshAdminPanel")?.addEventListener("click", () => {
    loadAdminPanel();
  });

  bindAdminActions();
  loadAdminOrders();
  loadAdminClaims();
  refreshIcons();
};

const ADMIN_ORDER_ACTIONS = {
  seller_shipped: [{ status: "inspection", label: "Start Inspection", cls: "primary-btn" }, { status: "cancelled", label: "Cancel", cls: "ghost-btn" }],
  inspection:     [{ status: "inspection_passed", label: "Pass Inspection ✓", cls: "primary-btn" }, { status: "cancelled", label: "Fail & Cancel", cls: "outline-btn" }],
  inspection_passed: [{ status: "delivered", label: "Mark as Delivered 🚚", cls: "primary-btn" }],
  delivered: [{ status: "completed", label: "Complete Order", cls: "primary-btn" }],
};

const STATUS_LABEL_ADMIN = {
  pending_payment: "Pending Payment",
  paid: "Paid",
  seller_shipped: "Seller Shipped → GoodCheck",
  inspection: "Under Inspection",
  inspection_passed: "Inspection Passed",
  delivered: "Delivered to Buyer",
  completed: "Completed",
  cancelled: "Cancelled",
};

const CLAIM_ACTIONS = {
  open: [
    { status: "reviewing", label: "Start Review", cls: "primary-btn" },
    { status: "resolved_refund", label: "Approve Refund", cls: "outline-btn" },
    { status: "resolved_release", label: "Release Funds", cls: "ghost-btn" },
    { status: "rejected", label: "Reject Claim", cls: "ghost-btn" },
  ],
  reviewing: [
    { status: "resolved_refund", label: "Approve Refund", cls: "primary-btn" },
    { status: "resolved_release", label: "Release Funds", cls: "outline-btn" },
    { status: "rejected", label: "Reject Claim", cls: "ghost-btn" },
  ],
};

const CLAIM_STATUS_LABELS = {
  open: "Open",
  reviewing: "Under Review",
  resolved_refund: "Refund Approved",
  resolved_release: "Funds Released",
  rejected: "Rejected",
};

const CLAIM_REASON_LABELS = {
  damaged_in_transit: "Damaged in transit",
  not_as_described: "Not as described",
  missing_parts: "Missing parts or accessories",
  functionality_issue: "Functionality issue",
  seller_misrepresentation: "Seller misrepresentation",
  other: "Other",
};

const loadAdminOrders = async () => {
  const container = byId("adminOrdersList");
  if (!container) return;
  const result = await getAdminOrders({ status: "all", limit: 30 });
  const orders = (result?.orders || []).filter(o =>
    ["seller_shipped", "inspection", "inspection_passed", "delivered"].includes(o.status)
  );
  if (!orders.length) {
    container.innerHTML = `<div class="admin-empty"><p>No orders currently require inspection action.</p></div>`;
    refreshIcons();
    return;
  }
  container.innerHTML = `<div style="display:grid;gap:12px">${orders.map(o => {
    const actions = ADMIN_ORDER_ACTIONS[o.status] || [];
    return `
      <article class="admin-order-row">
        <div class="admin-order-row__info">
          <strong>Order #${o.id}</strong>
          <p>${o.product?.title || ""}</p>
          <span class="badge order-status-badge--${o.status}">${STATUS_LABEL_ADMIN[o.status] || o.status}</span>
          <span class="badge">Escrow: ${escapeHtml(o.escrow_status || "pending")}</span>
          ${o.tracking_note ? `<p class="muted" style="font-size:0.82rem;margin-top:4px">${escapeHtml(o.tracking_note)}</p>` : ""}
        </div>
        <div class="admin-order-row__actions">
          <label class="admin-field" style="min-width:200px">
            <span>Note to buyer</span>
            <input type="text" id="admin-order-note-${o.id}" placeholder="Optional note for buyer" />
          </label>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${actions.map(a => `<button class="${a.cls} admin-order-action-btn" data-order-id="${o.id}" data-new-status="${a.status}">${a.label}</button>`).join("")}
          </div>
        </div>
      </article>`;
  }).join("")}</div>`;

  container.querySelectorAll(".admin-order-action-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const orderId = Number(btn.dataset.orderId);
      const newStatus = btn.dataset.newStatus;
      const note = document.getElementById(`admin-order-note-${orderId}`)?.value?.trim() || "";
      btn.disabled = true;
      btn.textContent = "Updating…";
      const result = await updateAdminOrderStatus(orderId, newStatus, note);
      if (result?.error) {
        showToast(result.message || "Update failed.", "error");
        btn.disabled = false;
        btn.textContent = newStatus;
      } else {
        showToast(`Order #${orderId} moved to ${newStatus}.`, "success");
        await loadAdminOrders();
      }
    });
  });
  refreshIcons();
};

const loadAdminClaims = async () => {
  const container = byId("adminClaimsList");
  if (!container) return;

  const result = await getAdminClaims({ status: claimStatusFilter, limit: 30 });
  const claims = result?.claims || [];

  if (!claims.length) {
    container.innerHTML = `<div class="admin-empty"><p>No buyer protection claims match the current filter.</p></div>`;
    refreshIcons();
    return;
  }

  container.innerHTML = `
    <div class="admin-card-grid">
      ${claims.map((claim) => {
        const actions = CLAIM_ACTIONS[claim.status] || [];
        const buyerName = claim.buyer?.full_name || claim.buyer?.username || "Buyer";
        const sellerName = claim.seller?.full_name || claim.seller?.username || "Seller";
        return `
          <article class="admin-card admin-claim-card">
            <div class="admin-card__top">
              <div>
                <p class="eyebrow">Claim #${claim.id}</p>
                <h4>${escapeHtml(claim.product?.title || `Order #${claim.order_id}`)}</h4>
                <p class="muted">Buyer: ${escapeHtml(buyerName)} · Seller: ${escapeHtml(sellerName)}</p>
              </div>
              <div class="admin-badges">
                <span class="claim-status-badge claim-status-badge--${claim.status}">${CLAIM_STATUS_LABELS[claim.status] || claim.status}</span>
                <span class="badge">${escapeHtml(CLAIM_REASON_LABELS[claim.reason] || claim.reason)}</span>
                <span class="badge">${escapeHtml(claim.requested_resolution || "review")}</span>
              </div>
            </div>
            <div class="admin-metrics">
              <span>Order #${claim.order_id}</span>
              <span>Opened ${claim.created_at ? timeAgo(claim.created_at) : "-"}</span>
              <span>${claim.resolved_at ? `Resolved ${timeAgo(claim.resolved_at)}` : "Awaiting resolution"}</span>
            </div>
            <div class="admin-claim-card__body">
              <strong>Buyer statement</strong>
              <p>${escapeHtml(claim.details || "No details provided.")}</p>
              ${
                claim.evidence_urls?.length
                  ? `<div class="claim-evidence-list">
                       ${claim.evidence_urls.map((url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Evidence</a>`).join("")}
                     </div>`
                  : ""
              }
            </div>
            <label class="admin-field">
              <span>Admin note</span>
              <textarea data-claim-note-id="${claim.id}" rows="3" placeholder="Summarize the decision, refund handling, or next steps.">${escapeHtml(claim.admin_note || "")}</textarea>
            </label>
            ${
              actions.length
                ? `
                  <div class="admin-actions">
                    ${actions
                      .map((action) => `
                        <button class="${action.cls} admin-claim-action-btn" data-claim-id="${claim.id}" data-new-status="${action.status}">
                          ${action.label}
                        </button>
                      `)
                      .join("")}
                  </div>
                `
                : `<div class="admin-empty admin-empty--compact"><p>No further action available for this claim.</p></div>`
            }
          </article>
        `;
      }).join("")}
    </div>
  `;

  container.querySelectorAll(".admin-claim-action-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const claimId = Number(button.dataset.claimId);
      const status = button.dataset.newStatus;
      const adminNote =
        document.querySelector(`[data-claim-note-id="${claimId}"]`)?.value?.trim() || "";

      button.disabled = true;
      button.textContent = "Updating…";
      const updateResult = await updateAdminClaim(claimId, { status, admin_note: adminNote });
      if (updateResult?.error) {
        showToast(updateResult.message || "Unable to update claim.", "error");
        button.disabled = false;
        button.textContent = status;
        return;
      }

      showToast(updateResult.message || "Claim updated.", "success");
      await loadAdminClaims();
    });
  });

  refreshIcons();
};

const renderAdminError = (message) => {
  const body = byId("adminPanelBody");
  if (!body) return;

  body.innerHTML = `
    <div class="chat-empty-state">
      <i data-lucide="triangle-alert"></i>
      <h4>Unable to load admin console</h4>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
  refreshIcons();
};

const loadAdminPanel = async () => {
  renderAdminLoading();

  const [overview, productQueue, users, logs, riskDashboard, verificationEvents] = await Promise.all([
    getAdminOverview(),
    getAdminProducts({ moderation_status: productFilter, search: productSearch, limit: 12 }),
    getAdminUsers({
      account_status: userStatusFilter,
      user_type: userTypeFilter,
      search: userSearch,
      limit: 12,
    }),
    getAdminLogs(20),
    getAdminRiskDashboard(10),
    getVerificationEvents(12),
  ]);

  const firstError = [overview, productQueue, users, logs, riskDashboard, verificationEvents].find((result) => result?.error);
  if (firstError) {
    renderAdminError(firstError.message || "Please try again in a moment.");
    return;
  }

  renderAdminPanel(overview, productQueue, users, logs, riskDashboard, verificationEvents);
};

export const openAdminPanel = async () => {
  if (!getToken()) {
    openAuthForAdmin();
    return;
  }

  if (!currentUser?.is_admin) {
    showToast("This account does not have admin access.", "error");
    return;
  }

  setAdminModalVisibility(true);
  await loadAdminPanel();
};

export const closeAdminPanel = () => {
  setAdminModalVisibility(false);
};

export const bindAdminPanel = () => {
  const openBtn = byId("openAdminPanel");
  const closeBtn = byId("closeAdminModal");
  const modal = byId("adminModal");

  openBtn?.addEventListener("click", () => {
    openAdminPanel();
  });

  closeBtn?.addEventListener("click", closeAdminPanel);
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeAdminPanel();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAdminPanel();
    }
  });
};
