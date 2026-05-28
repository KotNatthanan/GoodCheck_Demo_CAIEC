/**
 * ui.js — All UI rendering functions + Product Detail Modal
 */
import {
  products,
  favorites,
  categories,
  currentUser,
  productCollectionMeta,
  toggleFavoriteId,
} from "./state.js";
import { formatPrice, refreshIcons, timeAgo } from "./utils.js";
import {
  getToken,
  getProductDetail,
  addFavoriteApi,
  removeFavoriteApi,
  createOrder,
  addReview,
  uploadProductImage,
} from "./api.js";
import { switchAuthTab } from "./auth.js";
import { showToast } from "./notifications.js";
import { openChatModalForProduct } from "./chat.js";
import { t } from "./i18n.js";
import { openPaymentModal } from "./payment.js";

const getSellerName = (seller) => {
  if (!seller || typeof seller === "string") {
    return seller || "Seller";
  }
  return seller.full_name || seller.username || "Seller";
};
const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const renderStars = (rating = 0) => {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  return `${"★".repeat(safeRating)}${"☆".repeat(5 - safeRating)}`;
};

const byId = (id) => document.getElementById(id);
const DEFAULT_LISTING_IMAGE =
  "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=900&q=60";
const MAX_PRODUCT_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_COUNT = 6;
let listingPreviewObjectUrls = [];

const scrollToSection = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const revokeListingPreviewObjectUrls = () => {
  listingPreviewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  listingPreviewObjectUrls = [];
};

const setListingImagePreview = (images = [], message = "") => {
  const card = byId("productImagePreviewCard");
  const grid = byId("productImagePreviewGrid");
  const label = byId("productImagePreviewLabel");
  if (!card || !grid || !label) return;

  const hasImages = images.length > 0;
  card.classList.toggle("is-empty", !hasImages);
  grid.innerHTML = hasImages
    ? images
        .map(
          (image, index) => `
            <figure class="listing-image-preview__item ${index === 0 ? "is-cover" : ""}">
              <img src="${image.src}" alt="${image.label}" loading="lazy" />
              <figcaption>${index === 0 ? t("image.cover") : t("image.gallery", { n: index + 1 })}</figcaption>
            </figure>
          `
        )
        .join("")
    : "";
  label.textContent =
    message ||
    (hasImages
      ? t("image.ready", { n: images.length, s: images.length === 1 ? "" : "s" })
      : t("modal.no_images"));
};

const resetListingImagePreview = () => {
  revokeListingPreviewObjectUrls();
  setListingImagePreview();
};

const syncListingImagePreview = () => {
  const fileInput = byId("productImageFile");
  const urlInput = byId("productImageUrl");
  const files = Array.from(fileInput?.files || []).slice(0, MAX_PRODUCT_IMAGE_COUNT);

  if (files.length) {
    revokeListingPreviewObjectUrls();
    listingPreviewObjectUrls = files.map((file) => URL.createObjectURL(file));
    const previewImages = listingPreviewObjectUrls.map((src, index) => ({
      src,
      label: files[index]?.name || `Listing image ${index + 1}`,
    }));
    const externalUrl = String(urlInput?.value || "").trim();

    if (externalUrl) {
      previewImages.push({ src: externalUrl, label: "Hosted image" });
    }

    setListingImagePreview(
      previewImages,
      t("image.selected", {
        n: files.length,
        s: files.length === 1 ? "" : "s",
        extra: externalUrl ? t("image.plus_hosted") : "",
      })
    );
    return;
  }

  const externalUrl = String(urlInput?.value || "").trim();
  if (externalUrl) {
    setListingImagePreview(
      [{ src: externalUrl, label: "Hosted image" }],
      t("image.hosted_preview")
    );
    return;
  }

  resetListingImagePreview();
};

const bindListingImageInputs = () => {
  const fileInput = byId("productImageFile");
  const urlInput = byId("productImageUrl");
  const previewGrid = byId("productImagePreviewGrid");

  if (!fileInput || fileInput.dataset.bound === "true") return;

  fileInput.addEventListener("change", syncListingImagePreview);
  urlInput?.addEventListener("input", syncListingImagePreview);
  previewGrid?.addEventListener(
    "error",
    () => {
      if (fileInput.files?.length) return;
      setListingImagePreview([], t("image.load_error"));
    },
    true
  );

  fileInput.dataset.bound = "true";
  resetListingImagePreview();
};

const bindMobileNavigation = () => {
  const nav = document.querySelector(".top-nav");
  const panel = byId("topNavPanel");
  const toggle = byId("navMobileToggleBtn");

  if (!nav || !panel || !toggle || toggle.dataset.bound === "true") return;

  const isMobileViewport = () => window.matchMedia("(max-width: 960px)").matches;

  const setMenuState = (isOpen) => {
    const shouldOpen = isMobileViewport() ? isOpen : false;
    nav.classList.toggle("is-menu-open", shouldOpen);
    panel.hidden = isMobileViewport() ? !shouldOpen : false;
    toggle.setAttribute("aria-expanded", String(shouldOpen));

    const icon = toggle.querySelector("[data-lucide]");
    if (icon) {
      icon.setAttribute("data-lucide", shouldOpen ? "x" : "menu");
      refreshIcons();
    }
  };

  toggle.addEventListener("click", () => {
    setMenuState(!nav.classList.contains("is-menu-open"));
  });

  panel
    .querySelectorAll(".nav-links a, .nav-text-btn, .nav-signin-btn, .nav-cta-btn")
    .forEach((element) => {
      element.addEventListener("click", () => {
        if (isMobileViewport()) setMenuState(false);
      });
    });

  document.addEventListener("click", (event) => {
    if (!isMobileViewport()) return;
    if (!nav.contains(event.target)) {
      setMenuState(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isMobileViewport()) {
      setMenuState(false);
    }
  });

  window.addEventListener("resize", () => {
    setMenuState(nav.classList.contains("is-menu-open"));
  });

  toggle.dataset.bound = "true";
  setMenuState(false);
};

// ========================
//   Hero Stats
// ========================
export const renderHeroStats = () => {
  const container = document.getElementById("heroStats");
  const listingCount = productCollectionMeta.total || products.length;
  const stats = [
    { value: listingCount.toString(), label: t("hero_stats.verified_listings") },
    { value: "98%", label: t("hero_stats.satisfaction") },
    { value: "12 hrs", label: t("hero_stats.close_time") },
  ];

  container.innerHTML = stats
    .map(
      (stat) => `
      <div class="stat-card">
        <strong>${stat.value}</strong>
        <small>${stat.label}</small>
      </div>
    `
    )
    .join("");
};

// ========================
//   Categories
// ========================
export const renderCategories = () => {
  const container = document.getElementById("categoryList");
  container.innerHTML = categories
    .map(
      (cat) => `
      <article class="category-card" data-category="${cat.value}">
        <div class="category-card__media">
          <img src="${cat.image}" alt="${cat.title}" loading="lazy" />
          <div class="category-card__icon">
            <i data-lucide="${cat.icon}"></i>
          </div>
        </div>
        <div class="eyebrow">${cat.trend}</div>
        <h3>${cat.title}</h3>
        <p class="tag">${cat.description}</p>
      </article>
    `
    )
    .join("");

  container.querySelectorAll(".category-card").forEach((card) => {
    card.addEventListener("click", () => {
      const value = card.dataset.category;
      document.getElementById("categoryFilter").value = value;
      highlightCategory(value);
      import("./filters.js").then((m) => m.applyFilters());
    });
  });
};

export const highlightCategory = (value) => {
  const container = document.getElementById("categoryList");
  container.querySelectorAll(".category-card").forEach((card) => {
    const isActive = Boolean(value) && card.dataset.category === value;
    card.classList.toggle("is-active", isActive);
  });
};

// ========================
//   Product Grid
// ========================
export const renderProductSkeletons = (count = 6) => {
  const productGrid = document.getElementById("productGrid");
  const emptyState = document.getElementById("emptyState");

  if (!productGrid) return;
  if (emptyState) emptyState.hidden = true;

  productGrid.innerHTML = Array.from({ length: count })
    .map(
      () => `
        <article class="product-card product-card--skeleton" aria-hidden="true">
          <div class="product-card__top">
            <div class="skeleton-line skeleton-line--title"></div>
            <div class="skeleton-circle"></div>
          </div>
          <div class="skeleton-block skeleton-block--image"></div>
          <div class="product-meta">
            <span class="skeleton-line skeleton-line--meta"></span>
            <span class="skeleton-line skeleton-line--meta"></span>
          </div>
          <div class="price-row">
            <div class="skeleton-line skeleton-line--price"></div>
            <div class="skeleton-chip"></div>
          </div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line skeleton-line--short"></div>
          <div class="tag-list">
            <span class="skeleton-chip"></span>
            <span class="skeleton-chip"></span>
            <span class="skeleton-chip"></span>
          </div>
          <div class="product-card__footer">
            <div class="seller">
              <div class="skeleton-line skeleton-line--meta"></div>
              <div class="skeleton-line skeleton-line--short"></div>
            </div>
            <div class="skeleton-button"></div>
          </div>
        </article>
      `
    )
    .join("");
};

export const renderProducts = (list) => {
  const productGrid = document.getElementById("productGrid");
  const emptyState = document.getElementById("emptyState");

  if (!list.length) {
    productGrid.innerHTML = "";
    emptyState.hidden = false;
    refreshIcons();
    return;
  }

  emptyState.hidden = true;
  productGrid.innerHTML = list
    .map((item) => {
      const isFavorite = favorites.has(item.id);
      const specBadges =
        (item.specs || []).map((spec) => `<span>${spec}</span>`).join("") ||
        `<span>${t("product.specs_updating")}</span>`;

      const seller = item.seller || {};
      const sellerName = getSellerName(seller);
      const sellerTrustBadge = seller?.is_verified
        ? `<span class="trust-badge">${t("product.verified_seller")}</span>`
        : "";
      const listingHighlights = [item.condition, seller?.is_verified ? t("product.verified_seller") : null]
        .filter(Boolean)
        .map((label) =>
          label === t("product.verified_seller")
            ? `<span class="trust-badge">${label}</span>`
            : `<span>${label}</span>`
        )
        .join("");

      const warrantyText = item.warranty || t("product.warranty_none");

      return `
        <article class="product-card" data-product-id="${item.id}">
          <div class="product-card__top">
            <div>
              <p class="eyebrow">${item.category}</p>
              <h3>${item.title}</h3>
            </div>
            <button class="favorite-btn ${isFavorite ? "is-active" : ""}" data-action="favorite" data-product-id="${item.id}" aria-label="${t("product.add_favorite")}">
              <i data-lucide="heart"></i>
            </button>
          </div>
          <img
            src="${item.image_url || "https://picsum.photos/seed/product/900/600"}"
            alt="${item.title}"
            loading="lazy"
            decoding="async"
          />
          <div class="product-meta">
            <span><i data-lucide="map-pin"></i><span class="location-flag">${t("location.flag_th")}</span>${item.location}</span>
            <span><i data-lucide="clock-3"></i>${item.created_at ? timeAgo(item.created_at) : t("product.just_added")}</span>
          </div>
          <div class="price-row">
            <p class="price-tag">${formatPrice(item.price)}</p>
            <span class="badge">${t("product.warranty_label", { value: warrantyText })}</span>
          </div>
          <p>${item.description || ""}</p>
          <div class="tag-list">${listingHighlights}${specBadges}</div>
          <div class="product-card__footer">
            <div class="seller">
              <strong>${sellerName}</strong>
              <small>${t("product.rating_label", { value: (item.rating || 5).toFixed(2) })}</small>
              ${sellerTrustBadge}
            </div>
            <button class="outline-btn" data-action="detail" data-product-id="${item.id}">
              <i data-lucide="info"></i>
              ${t("product.details_btn")}
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  // Favorite buttons
  productGrid.querySelectorAll("[data-action='favorite']").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const targetId = Number(btn.dataset.productId);
      handleToggleFavorite(targetId);
    });
  });

  // Detail buttons
  productGrid.querySelectorAll("[data-action='detail']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = Number(btn.dataset.productId);
      openProductDetailModal(targetId);
    });
  });

  refreshIcons();
};

// ========================
//   Featured Product
// ========================
export const renderFeaturedProduct = (list) => {
  const container = document.getElementById("featuredProduct");
  if (!list.length) {
    container.innerHTML = `<p>${t("highlight.no_deal")}</p>`;
    return;
  }

  const candidate = [...list].sort((a, b) => {
    if (b.rating === a.rating) return a.price - b.price;
    return b.rating - a.rating;
  })[0];

  const seller = candidate.seller || {};
  const sellerName = getSellerName(seller);

  container.innerHTML = `
    <img
      src="${candidate.image_url || "https://picsum.photos/seed/product/900/600"}"
      alt="${candidate.title}"
      loading="lazy"
      decoding="async"
    />
    <div>
      <p class="eyebrow">${candidate.category}</p>
      <h3>${candidate.title}</h3>
      <p>${candidate.description || ""}</p>
      <ul>
        <li>${t("product.seller_label", { name: sellerName })}</li>
        <li>${t("product.rating_label", { value: (candidate.rating || 5).toFixed(2) })}</li>
        <li>${t("product.warranty_label", { value: candidate.warranty || t("product.warranty_none") })}</li>
        <li>${formatPrice(candidate.price)}</li>
      </ul>
    </div>
    <div class="cta-actions">
      <button class="primary-btn" data-featured-id="${candidate.id}">
        <i data-lucide="zap"></i> ${t("highlight.reserve")}
      </button>
      <button class="ghost-btn" data-featured-id="${candidate.id}" data-action="detail">
        <i data-lucide="arrow-up-right"></i> ${t("highlight.view_details")}
      </button>
    </div>
  `;

  container.querySelectorAll("[data-featured-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.featuredId);
      openProductDetailModal(id);
    });
  });

  refreshIcons();
};

// ========================
//   Toggle Favorite
// ========================
const handleToggleFavorite = async (productId) => {
  if (!getToken()) {
    showToast(t("toast.sign_in_required"), "info");
    return;
  }

  const isRemoving = favorites.has(productId);
  const result = isRemoving
    ? await removeFavoriteApi(productId)
    : await addFavoriteApi(productId);

  if (!result || result.error) {
    showToast(result?.message || t("toast.favorite_error"), "error");
    return;
  }

  toggleFavoriteId(productId);
  showToast(
    result.message || (isRemoving ? t("toast.favorite_removed") : t("toast.favorite_added")),
    "success"
  );

  // Re-render current product list
  const { filteredProducts } = await import("./state.js");
  renderProducts(filteredProducts);
};

// ========================
//  Product Detail Modal
// ========================
export const openProductDetailModal = async (productId) => {
  const modal = document.getElementById("productDetailModal");
  const body = document.getElementById("productDetailBody");

  body.innerHTML = `<div style="text-align:center;padding:40px"><p>${t("products.loading")}</p></div>`;
  modal.classList.add("is-visible");
  modal.setAttribute("aria-hidden", "false");

  const product = await getProductDetail(productId);
  if (!product || product.error) {
    body.innerHTML = `<p>${t("toast.product_error")}</p>`;
    showToast(product?.message || t("toast.product_error"), "error");
    return;
  }

  const seller = product.seller || {};
  const sellerName = getSellerName(seller);
  const reviews = product.reviews || [];
  const sellerReviews = product.seller_reviews || [];
  const galleryImages =
    product.image_urls && product.image_urls.length
      ? product.image_urls
      : [product.image_url || "https://picsum.photos/seed/product/900/600"].filter(Boolean);
  const coverImage = galleryImages[0] || "https://picsum.photos/seed/product/900/600";
  const listedText = product.created_at ? timeAgo(product.created_at) : t("product.just_added");
  const sellerVerified = Boolean(seller?.is_verified);
  const sellerBadge = sellerVerified
    ? `<span class="trust-badge">${t("product.verified_seller")}</span>`
    : `<span class="badge">${t("product.standard_seller")}</span>`;
  const protectionCopy = product.warranty
    ? t("product.protection_warranty", { value: product.warranty })
    : t("product.protection_default");
  const availabilityLabel =
    product.status === "sold"
      ? t("product.status_sold")
      : product.status === "reserved"
        ? t("product.status_reserved")
        : t("product.status_ready");
  const conditionPills = [
    product.condition,
    sellerVerified ? t("product.priority_seller") : t("product.community_listing"),
    `${product.total_reviews || 0} review${product.total_reviews === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .map((label) => `<span>${label}</span>`)
    .join("");

  const inspectionCards = [
    {
      icon: "shield-check",
      title: t("product.listing_overview"),
      value: sellerVerified ? t("product.verification_verified") : t("product.verification_standard"),
      note: t("product.verification_note"),
    },
    {
      icon: "clock-3",
      title: t("product.listing_status"),
      value: sellerVerified ? t("product.service_verified") : t("product.service_standard"),
      note: t("product.service_note"),
    },
    {
      icon: "truck",
      title: t("product.protection_summary"),
      value: t("product.handoff_value"),
      note: t("product.handoff_note"),
    },
  ]
    .map(
      (item) => `
        <article class="detail-insight-card">
          <div class="detail-insight-card__icon">
            <i data-lucide="${item.icon}"></i>
          </div>
          <div>
            <small>${item.title}</small>
            <strong>${item.value}</strong>
            <p>${item.note}</p>
          </div>
        </article>
      `
    )
    .join("");

  const sellerSummary = [
    { label: t("product.marketplace_rating"), value: `${(seller.rating || 5).toFixed(2)} / 5.00` },
    { label: t("product.seller_feedback_label"), value: t("product.seller_review_count", { count: seller.total_reviews || 0 }) },
    { label: t("product.listing_status"), value: availabilityLabel },
    { label: t("product.coverage"), value: product.warranty || t("product.inspection_backed") },
  ]
    .map(
      (item) => `
        <div class="detail-summary-item">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
        </div>
      `
    )
    .join("");

  const fulfillmentChecklist = [
    t("product.fulfillment1"),
    t("product.fulfillment2"),
    t("product.fulfillment3"),
  ]
    .map((item) => `<li><i data-lucide="check-circle"></i><span>${item}</span></li>`)
    .join("");

  const specsList = (product.specs || [])
    .map((s) => `<span>${s}</span>`)
    .join("");

  const reviewsHtml = reviews.length
    ? reviews
      .map(
        (r) => `
        <div class="detail-review">
          <div class="detail-review__header">
            <strong>${r.reviewer?.username || "User"}</strong>
            <span class="detail-review__stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
          </div>
          <p>${r.comment || ""}</p>
          <small class="muted">${r.created_at ? timeAgo(r.created_at) : ""}</small>
        </div>
      `
      )
      .join("")
    : `<p class='muted'>${t("product.no_reviews")}</p>`;
  const sellerReviewsHtml = sellerReviews.length
    ? sellerReviews
      .map(
        (review) => `
        <div class="detail-review detail-review--compact">
          <div class="detail-review__header">
            <strong>${escapeHtml(review.reviewer?.full_name || review.reviewer?.username || "Buyer")}</strong>
            <span class="detail-review__stars">${renderStars(review.rating)}</span>
          </div>
          ${review.comment ? `<p>${escapeHtml(review.comment)}</p>` : `<p class="muted">${t("product.seller_review_no_comment")}</p>`}
          <small class="muted">${review.created_at ? timeAgo(review.created_at) : ""}</small>
        </div>
      `
      )
      .join("")
    : `<p class='muted'>${t("product.no_seller_reviews")}</p>`;

  const isFav = favorites.has(product.id);
  const isOwner = currentUser && currentUser.id === seller.id;

  body.innerHTML = `
    <div class="detail-grid">
      <div class="detail-main">
        <div class="detail-image">
          <img
            id="detailMainImage"
            src="${coverImage}"
            alt="${product.title}"
          />
          <div class="detail-image__overlay">
            ${sellerVerified ? `<span class="trust-badge">${t("product.verified_seller")}</span>` : `<span class="badge">${t("product.inspection_queue")}</span>`}
            <span class="badge">${availabilityLabel}</span>
          </div>
        </div>
        ${
          galleryImages.length > 1
            ? `
              <div class="detail-thumb-row">
                ${galleryImages
                  .map(
                    (imageUrl, index) => `
                      <button
                        class="detail-thumb ${index === 0 ? "is-active" : ""}"
                        type="button"
                        data-detail-image="${imageUrl}"
                        aria-label="${t("image.gallery", { n: index + 1 })}"
                      >
                        <img src="${imageUrl}" alt="${product.title} image ${index + 1}" loading="lazy" />
                      </button>
                    `
                  )
                  .join("")}
              </div>
            `
            : ""
        }
        <div class="detail-info">
          <p class="eyebrow">${product.category}</p>
          <h2>${product.title}</h2>
          <div class="detail-price-row">
            <p class="price-tag detail-price-tag">${formatPrice(product.price)}</p>
            <span class="badge">${t("product.listed", { time: listedText })}</span>
          </div>

          <div class="detail-meta-grid">
            <div><i data-lucide="map-pin"></i> <span>${product.location}</span></div>
            <div><i data-lucide="package"></i> <span>${product.condition}</span></div>
            <div><i data-lucide="shield-check"></i> <span>${t("product.warranty_label", { value: product.warranty || t("product.warranty_none") })}</span></div>
            <div><i data-lucide="eye"></i> <span>${t("product.views", { count: product.views || 0 })}</span></div>
            <div><i data-lucide="star"></i> <span>${(product.rating || 5).toFixed(1)} (${product.total_reviews || 0} reviews)</span></div>
          </div>

          <div class="tag-list detail-signal-list">${conditionPills}</div>

          <div class="detail-copy-section">
            <h4>${t("product.listing_overview")}</h4>
            <p>${product.description || t("product.no_description")}</p>
          </div>

          ${specsList ? `<div class="detail-copy-section"><h4>${t("product.tech_highlights")}</h4><div class="tag-list">${specsList}</div></div>` : ""}

          <div class="detail-copy-section">
            <h4>${t("product.inspection_standards")}</h4>
            <div class="detail-insight-grid">${inspectionCards}</div>
          </div>
        </div>
      </div>

      <aside class="detail-sidebar">
        <div class="detail-sidecard detail-sidecard--accent">
          <small>${t("product.ready_to_purchase")}</small>
          <strong>${formatPrice(product.price)}</strong>
          <p>${t("product.buyer_protection_copy")}</p>
          <div class="detail-actions">
            ${!isOwner
      ? `<button class="primary-btn" id="detailOrderBtn">
                   <i data-lucide="shopping-cart"></i> ${t("product.place_order")}
                 </button>`
      : ""
    }
            ${!isOwner
      ? `<button class="ghost-btn" id="detailChatBtn">
                   <i data-lucide="message-square"></i> ${t("product.message_seller")}
                 </button>`
      : ""
    }
            <button class="outline-btn ${isFav ? "is-active" : ""}" id="detailFavBtn">
              <i data-lucide="heart"></i> ${isFav ? t("product.remove_favorite") : t("product.add_favorite")}
            </button>
          </div>
        </div>

        <div class="detail-sidecard">
          <div class="detail-sidecard__header">
            <div>
              <small>${t("product.seller_profile")}</small>
              <h4>${sellerName}</h4>
            </div>
            ${sellerBadge}
          </div>
          <p class="detail-sidecard__body">${t("product.seller_trust_copy")}</p>
          <div class="detail-summary-list">${sellerSummary}</div>
        </div>

        <div class="detail-sidecard">
          <div class="detail-sidecard__header">
            <div>
              <small>${t("product.seller_feedback_label")}</small>
              <h4>${t("product.seller_feedback_title")}</h4>
            </div>
            <span class="badge">${t("product.seller_review_badge", { count: seller.total_reviews || 0 })}</span>
          </div>
          <p class="detail-sidecard__body">${t("product.seller_feedback_copy")}</p>
          <div class="detail-review-list">${sellerReviewsHtml}</div>
        </div>

        <div class="detail-sidecard">
          <h4>${t("product.protection_summary")}</h4>
          <p class="detail-sidecard__body">${protectionCopy}</p>
          <ul class="detail-checklist">${fulfillmentChecklist}</ul>
        </div>
      </aside>
    </div>

    <div class="detail-reviews-section">
      <h3>${t("product.reviews_title", { count: reviews.length })}</h3>
      ${reviewsHtml}

      ${getToken() && !isOwner
      ? `
        <div class="detail-add-review">
          <h4>${t("product.write_review")}</h4>
          <form id="detailReviewForm">
            <label>
              ${t("product.review_rating")}
              <select name="rating" required>
                <option value="5">⭐⭐⭐⭐⭐ (5)</option>
                <option value="4">⭐⭐⭐⭐ (4)</option>
                <option value="3">⭐⭐⭐ (3)</option>
                <option value="2">⭐⭐ (2)</option>
                <option value="1">⭐ (1)</option>
              </select>
            </label>
            <label>
              ${t("product.review_comment")}
              <textarea name="comment" rows="2" placeholder="${t("product.review_placeholder")}"></textarea>
            </label>
            <button type="submit" class="primary-btn">
              <i data-lucide="send"></i> ${t("product.review_submit")}
            </button>
          </form>
        </div>
      `
      : ""
    }
    </div>
  `;

  refreshIcons();

  document.querySelectorAll("[data-detail-image]").forEach((button) => {
    button.addEventListener("click", () => {
      const mainImage = byId("detailMainImage");
      if (!mainImage) return;

      mainImage.src = button.dataset.detailImage;
      document.querySelectorAll("[data-detail-image]").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
    });
  });

  // --- Bind detail modal actions ---
  const orderBtn = document.getElementById("detailOrderBtn");
  if (orderBtn) {
    orderBtn.addEventListener("click", () => {
      closeProductDetailModal();
      openPaymentModal(product);
    });
  }

  const favBtn = document.getElementById("detailFavBtn");
  if (favBtn) {
    favBtn.addEventListener("click", async () => {
      if (!getToken()) {
        handleToggleFavorite(product.id);
        return;
      }
      await handleToggleFavorite(product.id);
      openProductDetailModal(product.id);
    });
  }

  const chatBtn = document.getElementById("detailChatBtn");
  if (chatBtn) {
    chatBtn.addEventListener("click", async () => {
      closeProductDetailModal();
      await openChatModalForProduct(product);
    });
  }

  const reviewForm = document.getElementById("detailReviewForm");
  if (reviewForm) {
    reviewForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(reviewForm);
      const result = await addReview(product.id, {
        rating: Number(fd.get("rating")),
        comment: fd.get("comment"),
      });
      if (result && result.review) {
        showToast(t("toast.review_success"), "success");
        openProductDetailModal(product.id); // refresh
      } else {
        showToast(result?.message || t("toast.review_error"), "error");
      }
    });
  }
};

export const closeProductDetailModal = () => {
  const modal = document.getElementById("productDetailModal");
  modal.classList.remove("is-visible");
  modal.setAttribute("aria-hidden", "true");
};

export const bindProductDetailModal = () => {
  const modal = document.getElementById("productDetailModal");
  const closeBtn = document.getElementById("closeProductDetail");

  closeBtn?.addEventListener("click", closeProductDetailModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeProductDetailModal();
  });
};

// ========================
//   Product Form Modal
// ========================
export const openProductModal = () => {
  if (!getToken()) {
    const authModal = document.getElementById("authModal");
    authModal.classList.add("is-visible");
    authModal.setAttribute("aria-hidden", "false");
    switchAuthTab("login");
    refreshIcons();
    showToast(t("toast.sign_in_to_order"), "info");
    return;
  }
  const modal = document.getElementById("productModal");
  modal.classList.add("is-visible");
  modal.setAttribute("aria-hidden", "false");
  bindListingImageInputs();
  syncListingImagePreview();
};

export const closeProductModal = () => {
  const modal = document.getElementById("productModal");
  modal.classList.remove("is-visible");
  modal.setAttribute("aria-hidden", "true");
};

export const bindProductModal = () => {
  const addBtn = document.getElementById("addProductBtn");
  const closeBtn = document.getElementById("closeModal");
  const modal = document.getElementById("productModal");

  addBtn?.addEventListener("click", openProductModal);
  closeBtn?.addEventListener("click", closeProductModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeProductModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeProductModal();
      closeProductDetailModal();
    }
  });
};

export const handleProductFormSubmit = () => {
  const form = document.getElementById("productForm");
  bindListingImageInputs();
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const fileInput = byId("productImageFile");
    const imageFiles = Array.from(fileInput?.files || []).slice(0, MAX_PRODUCT_IMAGE_COUNT);
    const parsedSpecs = String(formData.get("specs") || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const submitButton = form.querySelector("button[type='submit']");
    const originalButtonHtml = submitButton?.innerHTML || "";

    if (imageFiles.length > MAX_PRODUCT_IMAGE_COUNT) {
      showToast(`Please upload no more than ${MAX_PRODUCT_IMAGE_COUNT} images.`, "error");
      return;
    }

    for (const imageFile of imageFiles) {
      if (imageFile?.size && imageFile.size > MAX_PRODUCT_IMAGE_SIZE) {
        showToast("Each image must be smaller than 8 MB.", "error");
        return;
      }

      if (imageFile?.size && imageFile.type && !imageFile.type.startsWith("image/")) {
        showToast("Every selected file must be an image.", "error");
        return;
      }
    }

    const imageUrls = [];
    const hostedImageUrl = String(formData.get("image_url") || "").trim();

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = `<i data-lucide="loader-2"></i> ${t("modal.submit")}`;
      refreshIcons();
    }

    if (imageFiles.length > 0) {
      const uploadResult = await uploadProductImage(imageFiles);
      if (!uploadResult || uploadResult.error) {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = originalButtonHtml;
          refreshIcons();
        }
        showToast(uploadResult?.message || "Unable to upload product images.", "error");
        return;
      }
      if (uploadResult.image_urls && uploadResult.image_urls.length > 0) {
        imageUrls.push(...uploadResult.image_urls);
      } else if (uploadResult.image_url) {
        imageUrls.push(uploadResult.image_url);
      }
    }

    if (hostedImageUrl) {
      imageUrls.push(hostedImageUrl);
    }

    const coverImage = imageUrls[0] || DEFAULT_LISTING_IMAGE;

    const productData = {
      title: formData.get("title"),
      price: Number(formData.get("price")),
      category: formData.get("category"),
      location: formData.get("location"),
      condition: formData.get("condition"),
      description: formData.get("description") || "",
      warranty: formData.get("warranty") || "Pending review",
      specs: parsedSpecs.length
        ? parsedSpecs
        : ["New member listing", "Inspection in progress"],
      image_url: coverImage,
      image_urls: imageUrls.length ? imageUrls : [DEFAULT_LISTING_IMAGE],
    };

    const { createProduct } = await import("./api.js");

    try {
      const result = await createProduct(productData);
      if (result && result.product) {
        form.reset();
        resetListingImagePreview();
        closeProductModal();
        const { applyFilters } = await import("./filters.js");
        await applyFilters();
        showToast(t("toast.order_success"), "success");
      } else {
        showToast(result?.message || t("toast.order_error"), "error");
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonHtml;
        refreshIcons();
      }
    }
  });
};

// ========================
//   Misc Helpers binding
// ========================
export const bindHelpers = () => {
  bindMobileNavigation();
  document.getElementById("exploreBtn")?.addEventListener("click", () => {
    scrollToSection("products");
  });
  document.getElementById("verifyBtn")?.addEventListener("click", () => {
    scrollToSection("trust-center");
  });
  document.getElementById("openGuide")?.addEventListener("click", () => {
    scrollToSection("standards");
  });
  document
    .getElementById("ctaSellBtn")
    ?.addEventListener("click", openProductModal);
  document.getElementById("ctaTalkBtn")?.addEventListener("click", () => {
    window.location.href =
      "mailto:hello@goodcheck.io?subject=GoodCheck%20Support%20Request";
  });
};
