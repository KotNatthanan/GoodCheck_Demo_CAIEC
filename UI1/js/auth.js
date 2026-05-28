/**
 * auth.js — Authentication logic & auth modal
 */
import { apiCall, getToken, setToken, removeToken } from "./api.js";
import {
    currentUser,
    setCurrentUserState,
} from "./state.js";
import { showToast } from "./notifications.js";
import { refreshIcons } from "./utils.js";
import { t } from "./i18n.js";

// --- LocalStorage helpers ---
const getStoredUser = () => {
    const user = localStorage.getItem("current_user");
    return user ? JSON.parse(user) : null;
};
const storeUser = (user) =>
    localStorage.setItem("current_user", JSON.stringify(user));

const setAuthModalVisibility = (authModal, isVisible) => {
    authModal.classList.toggle("is-visible", isVisible);
    authModal.setAttribute("aria-hidden", isVisible ? "false" : "true");
};

// --- Auth API calls ---
export const register = async (username, email, password, fullName, userType) => {
    const result = await apiCall("/auth/register", "POST", {
        username,
        email,
        password,
        full_name: fullName,
        user_type: userType || "buyer",
    });
    if (result && result.access_token) {
        setToken(result.access_token);
        storeUser(result.user);
        setCurrentUserState(result.user);
    }
    return result;
};

export const login = async (email, password) => {
    const result = await apiCall("/auth/login", "POST", { email, password });
    if (result && result.access_token) {
        setToken(result.access_token);
        storeUser(result.user);
        setCurrentUserState(result.user);
    }
    return result;
};

export const logout = () => {
    removeToken();
    localStorage.removeItem("current_user");
    setCurrentUserState(null);
};

// --- Load user from storage on init ---
export const loadStoredUser = () => {
    const user = getStoredUser();
    setCurrentUserState(user);
    return user;
};

// --- UI Update ---
export const updateAuthUI = () => {
    const userName = document.getElementById("userName");
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const addProductBtn = document.getElementById("addProductBtn");
    const adminBtn = document.getElementById("openAdminPanel");
    const sellerBtn = document.getElementById("openSellerHub");
    const ordersBtn = document.getElementById("openMyOrders");
    const user = currentUser;

    if (user) {
        userName.textContent = user.username;
        userName.style.display = "inline";
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        if (adminBtn) adminBtn.style.display = user.is_admin ? "inline-flex" : "none";
        if (sellerBtn) {
            sellerBtn.style.display =
                user.user_type === "seller" || user.is_admin ? "inline-flex" : "none";
        }
        if (ordersBtn) ordersBtn.style.display = "inline-flex";
        if (addProductBtn) addProductBtn.disabled = false;
    } else {
        userName.textContent = "";
        userName.style.display = "none";
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        if (adminBtn) adminBtn.style.display = "none";
        if (sellerBtn) sellerBtn.style.display = "none";
        if (ordersBtn) ordersBtn.style.display = "none";
        if (addProductBtn) addProductBtn.disabled = true;
    }
};

// --- Auth Tab ---
export const switchAuthTab = (tab) => {
    const authTabs = document.querySelectorAll(".auth-tab");
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    authTabs.forEach((t) => t.classList.remove("active"));
    document
        .querySelector(`.auth-tab[data-tab="${tab}"]`)
        ?.classList.add("active");

    if (tab === "login") {
        loginForm.classList.add("active");
        registerForm.classList.remove("active");
    } else {
        loginForm.classList.remove("active");
        registerForm.classList.add("active");
    }
};

// --- Bind Auth Modal ---
export const bindAuthModal = () => {
    const authModal = document.getElementById("authModal");
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const closeAuthModal = document.getElementById("closeAuthModal");
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const authTabs = document.querySelectorAll(".auth-tab");

    if (
        !authModal ||
        !loginBtn ||
        !logoutBtn ||
        !closeAuthModal ||
        !loginForm ||
        !registerForm
    ) {
        return;
    }

    // Open modal
    loginBtn.addEventListener("click", () => {
        switchAuthTab("login");
        setAuthModalVisibility(authModal, true);
        refreshIcons();
    });

    // Close modal
    closeAuthModal.addEventListener("click", () => {
        setAuthModalVisibility(authModal, false);
    });
    authModal.addEventListener("click", (e) => {
        if (e.target === authModal) {
            setAuthModalVisibility(authModal, false);
        }
    });

    // Tab switching
    authTabs.forEach((tab) => {
        tab.addEventListener("click", () => switchAuthTab(tab.dataset.tab));
    });

    // Login form
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(loginForm);
        const result = await login(formData.get("email"), formData.get("password"));

        if (result && result.access_token) {
            updateAuthUI();
            setAuthModalVisibility(authModal, false);
            loginForm.reset();
            showToast(t("auth.success_login"), "success");
        } else {
            showToast(result?.message || t("auth.error_login"), "error");
        }
    });

    // Register form
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(registerForm);
        const result = await register(
            formData.get("username"),
            formData.get("email"),
            formData.get("password"),
            "",
            formData.get("user_type")
        );

        if (result && result.access_token) {
            updateAuthUI();
            setAuthModalVisibility(authModal, false);
            registerForm.reset();
            showToast(t("auth.success_register"), "success");
        } else {
            showToast(result?.message || t("auth.error_register"), "error");
        }
    });

    // Logout
    logoutBtn.addEventListener("click", () => {
        logout();
        updateAuthUI();
        showToast(t("auth.success_logout"), "info");
        location.reload();
    });
};

// Expose for inline onclick in HTML
window.switchAuthTab = switchAuthTab;
