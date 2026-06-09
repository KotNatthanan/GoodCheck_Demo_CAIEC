/**
 * app.js — Application entry point (ES Module)
 *
 * Imports all modules and initialises the application.
 */
import { initI18n, onLocaleChange, applyI18n } from "./js/i18n.js";
import { loadStoredUser, updateAuthUI, bindAuthModal } from "./js/auth.js";
import { getFavoriteIds, getMyProfile, getToken } from "./js/api.js";
import { setCurrentUserState, setFavoriteIds } from "./js/state.js";
import {
  renderHeroStats,
  renderCategories,
  bindProductModal,
  bindProductDetailModal,
  handleProductFormSubmit,
  bindHelpers,
  openProductDetailModal
} from "./js/ui.js";
import { bindChatModal } from "./js/chat.js";
import { bindAdminPanel } from "./js/admin.js";
import { bindSellerHub } from "./js/seller.js";
import {
  populateCategoryOptions,
  renderLocationOptions,
  bindFilters,
  applyFilters,
  populatePriceOptions,
} from "./js/filters.js";
import { refreshIcons } from "./js/utils.js";
import { initTour } from "./js/tour.js";
import { bindPaymentModal } from "./js/payment.js";
import { bindOrdersModal } from "./js/orders.js";

window.openProductDetail = openProductDetailModal;

const init = async () => {
  // Initialise i18n first — load locale JSON + translate static DOM
  await initI18n();

  // Set year
  const yearEl = document.getElementById("currentYear");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Restore logged-in user
  loadStoredUser();

  if (getToken()) {
    try {
      const profile = await getMyProfile();
      if (profile && !profile.error) {
        setCurrentUserState(profile);
        localStorage.setItem("current_user", JSON.stringify(profile));
      }
    } catch (_) {
      /* no-op */
    }
  }

  updateAuthUI();

  // Load favorites from backend
  if (getToken()) {
    try {
      const ids = await getFavoriteIds();
      setFavoriteIds(ids);
    } catch (_) {
      /* no-op */
    }
  }

  // Setup UI
  populateCategoryOptions();
  renderCategories();
  await renderLocationOptions();
  bindFilters();
  bindHelpers();
  bindProductModal();
  bindProductDetailModal();
  bindAuthModal();
  bindChatModal();
  bindAdminPanel();
  bindSellerHub();
  bindPaymentModal();
  bindOrdersModal();
  handleProductFormSubmit();

  // Initial data load
  await applyFilters();
  renderHeroStats();
  refreshIcons();

  // Init onboarding tour
  initTour();

  // Re-render dynamic content when language or currency changes
  onLocaleChange(async () => {
    populateCategoryOptions();
    renderCategories();
    renderHeroStats();
    populatePriceOptions();
    await applyFilters();
    refreshIcons();
  });
};

document.addEventListener("DOMContentLoaded", init);
