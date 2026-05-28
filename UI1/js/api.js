/**
 * api.js — API helper and all backend API calls
 */
import { API_BASE_URL } from "./state.js";

// --- Token helpers ---
export const getToken = () => localStorage.getItem("access_token");
export const setToken = (token) =>
    localStorage.setItem("access_token", token);
export const removeToken = () => localStorage.removeItem("access_token");

// --- Generic API call ---
export const apiCall = async (endpoint, method = "GET", data = null) => {
    const options = {
        method,
        headers: { "Content-Type": "application/json" },
    };

    const token = getToken();
    if (token) {
        options.headers["Authorization"] = `Bearer ${token}`;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 401) {
                removeToken();
                localStorage.removeItem("current_user");
            }
            return {
                error: true,
                status: response.status,
                message:
                    payload.message ||
                    payload.msg ||
                    `Request failed with status ${response.status}.`,
            };
        }
        return payload;
    } catch (error) {
        console.error("API Call Error:", error);
        return {
            error: true,
            message: error.message || "Network error. Please try again.",
        };
    }
};

// --- Product APIs ---
export const loadProducts = async (filters = {}) => {
    const params = new URLSearchParams({
        page: filters.page || 1,
        per_page: filters.per_page || 12,
        search: filters.search || "",
        category: filters.category || "",
        location: filters.location || "",
        condition: filters.condition || "",
        price_min: filters.price_min ?? "",
        price_max: filters.price_max ?? "",
        sort_by: filters.sort_by || "created_at",
        sort_order: filters.sort_order || "desc",
    });

    return await apiCall(`/products?${params.toString()}`);
};

export const getProductDetail = async (productId) => {
    return await apiCall(`/products/${productId}`);
};

export const getMyProfile = async () => {
    return await apiCall("/auth/profile");
};

export const createProduct = async (productData) => {
    return await apiCall("/products", "POST", productData);
};

export const getMyListings = async (filters = {}) => {
    const params = new URLSearchParams({
        moderation_status: filters.moderation_status || "all",
        limit: filters.limit || 50,
    });
    return await apiCall(`/products/my-listings?${params.toString()}`);
};

export const deleteProductApi = async (productId) => {
    return await apiCall(`/products/${productId}`, "DELETE");
};

export const uploadProductImage = async (files) => {
    const formData = new FormData();
    if (Array.isArray(files)) {
        files.forEach(f => formData.append("images", f));
    } else {
        formData.append("images", files);
    }

    const headers = {};
    const token = getToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/products/upload-image`, {
            method: "POST",
            headers,
            body: formData,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 401) {
                removeToken();
                localStorage.removeItem("current_user");
            }
            return {
                error: true,
                status: response.status,
                message:
                    payload.message ||
                    payload.msg ||
                    `Upload failed with status ${response.status}.`,
            };
        }
        return payload;
    } catch (error) {
        console.error("Upload Error:", error);
        return {
            error: true,
            message: error.message || "Unable to upload the image right now.",
        };
    }
};

export const getCategories = async () => {
    const result = await apiCall("/products/categories");
    return result && result.categories ? result.categories : [];
};

export const getLocations = async () => {
    const result = await apiCall("/products/locations");
    return result && result.locations ? result.locations : [];
};

// --- Favorite APIs ---
export const getFavoriteIds = async () => {
    const result = await apiCall("/favorites/ids");
    return result && result.favorite_ids ? result.favorite_ids : [];
};

export const addFavoriteApi = async (productId) => {
    return await apiCall(`/favorites/${productId}`, "POST");
};

export const removeFavoriteApi = async (productId) => {
    return await apiCall(`/favorites/${productId}`, "DELETE");
};

// --- Order APIs ---
export const createOrder = async (orderData) => {
    return await apiCall("/orders", "POST", orderData);
};

export const getMyOrders = async (role = "buyer") => {
    return await apiCall(`/orders?role=${role}`);
};

export const createBuyerClaim = async (orderId, claimData) => {
    return await apiCall(`/orders/${orderId}/claim`, "POST", claimData);
};

// --- Chat APIs ---
export const getConversations = async () => {
    return await apiCall("/chats");
};

export const getConversationDetail = async (conversationId) => {
    return await apiCall(`/chats/${conversationId}`);
};

export const startConversation = async (payload) => {
    return await apiCall("/chats", "POST", payload);
};

export const sendChatMessage = async (conversationId, payload) => {
    return await apiCall(`/chats/${conversationId}/messages`, "POST", payload);
};

// --- Admin APIs ---
export const getAdminOverview = async () => {
    return await apiCall("/admin/overview");
};

export const getAdminProducts = async (filters = {}) => {
    const params = new URLSearchParams({
        moderation_status: filters.moderation_status || "pending",
        search: filters.search || "",
        limit: filters.limit || 12,
    });
    return await apiCall(`/admin/products?${params.toString()}`);
};

export const moderateProduct = async (productId, payload) => {
    return await apiCall(`/admin/products/${productId}/moderation`, "PUT", payload);
};

export const getAdminUsers = async (filters = {}) => {
    const params = new URLSearchParams({
        account_status: filters.account_status || "all",
        user_type: filters.user_type || "all",
        search: filters.search || "",
        limit: filters.limit || 12,
    });
    return await apiCall(`/admin/users?${params.toString()}`);
};

export const updateAdminUser = async (userId, payload) => {
    return await apiCall(`/admin/users/${userId}/status`, "PUT", payload);
};

export const getAdminClaims = async (filters = {}) => {
    const params = new URLSearchParams({
        status: filters.status || "open",
        limit: filters.limit || 20,
    });
    return await apiCall(`/admin/claims?${params.toString()}`);
};

export const updateAdminClaim = async (claimId, payload) => {
    return await apiCall(`/admin/claims/${claimId}`, "PUT", payload);
};

export const getAdminLogs = async (limit = 20) => {
    return await apiCall(`/admin/logs?limit=${limit}`);
};

// --- Review APIs ---
export const addReview = async (productId, reviewData) => {
    return await apiCall(`/products/${productId}/reviews`, "POST", reviewData);
};

export const addSellerReview = async (orderId, reviewData) => {
    return await apiCall(`/orders/${orderId}/seller-review`, "POST", reviewData);
};

// --- Payment API ---
export const payOrder = async (orderId, cardData) => {
    return await apiCall(`/orders/${orderId}/pay`, "POST", cardData);
};

export const updateOrderStatus = async (orderId, status, trackingNote = "") => {
    return await apiCall(`/orders/${orderId}/status`, "PUT", { status, tracking_note: trackingNote });
};

// --- Admin Order APIs ---
export const getAdminOrders = async (filters = {}) => {
    const params = new URLSearchParams({
        status: filters.status || "all",
        limit: filters.limit || 30,
    });
    return await apiCall(`/admin/orders?${params.toString()}`);
};

export const updateAdminOrderStatus = async (orderId, status, trackingNote = "") => {
    return await apiCall(`/admin/orders/${orderId}/status`, "PUT", { status, tracking_note: trackingNote });
};
