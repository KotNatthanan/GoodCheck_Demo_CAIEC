/**
 * filters.js — Filter, search, and product pagination logic
 */
import {
    products,
    filteredProducts,
    productCollectionMeta,
    setProducts,
    appendProducts,
    setFilteredProducts,
    setProductCollectionMeta,
    categories,
} from "./state.js";
import { loadProducts, getLocations } from "./api.js";
import {
    renderProducts,
    renderFeaturedProduct,
    highlightCategory,
    renderProductSkeletons,
} from "./ui.js";
import { t, getCurrency, convertPrice, getLocale } from "./i18n.js";
import { refreshIcons } from "./utils.js";
import { showToast } from "./notifications.js";

const PAGE_SIZE = 12;

// --- DOM refs ---
const searchInput = () => document.getElementById("searchInput");
const categoryFilter = () => document.getElementById("categoryFilter");
const locationFilter = () => document.getElementById("locationFilter");
const conditionFilter = () => document.getElementById("conditionFilter");
const priceFilter = () => document.getElementById("priceFilter");
const sortFilter = () => document.getElementById("sortFilter");
const resultCount = () => document.getElementById("productResultCount");
const activeFilterBar = () => document.getElementById("activeFilterBar");
const activeFilterSummaryText = () => document.getElementById("activeFilterSummaryText");
const activeFilterChips = () => document.getElementById("activeFilterChips");
const productLoadMore = () => document.getElementById("productLoadMore");
const loadMoreProductsBtn = () => document.getElementById("loadMoreProductsBtn");
const productPaginationSummary = () => document.getElementById("productPaginationSummary");

let searchDebounceTimer = null;
let isLoadingMore = false;
let lastAppliedSignature = "";

const getFilterState = () => ({
    search: searchInput()?.value.trim() || "",
    category: categoryFilter()?.value || "",
    location: locationFilter()?.value || "",
    condition: conditionFilter()?.value || "",
    price: priceFilter()?.value || "",
    sort: sortFilter()?.value || "newest",
});

const getDefaultValue = (key) => (key === "sort" ? "newest" : "");

const setFilterValue = (key, value) => {
    if (key === "search" && searchInput()) searchInput().value = value;
    if (key === "category" && categoryFilter()) categoryFilter().value = value;
    if (key === "location" && locationFilter()) locationFilter().value = value;
    if (key === "condition" && conditionFilter()) conditionFilter().value = value;
    if (key === "price" && priceFilter()) priceFilter().value = value;
    if (key === "sort" && sortFilter()) sortFilter().value = value || "newest";
};

const resetFilterValues = () => {
    setFilterValue("search", "");
    setFilterValue("category", "");
    setFilterValue("location", "");
    setFilterValue("condition", "");
    setFilterValue("price", "");
    setFilterValue("sort", "newest");
    highlightCategory("");
};

const getOptionLabel = (selectEl, fallback) =>
    selectEl?.selectedOptions?.[0]?.textContent?.trim() || fallback;

const getPriceBounds = (priceValue) => {
    if (priceValue === "0-5000") return { priceMin: 0, priceMax: 5000 };
    if (priceValue === "5000-15000") return { priceMin: 5000, priceMax: 15000 };
    if (priceValue === "15000-30000") return { priceMin: 15000, priceMax: 30000 };
    if (priceValue === "30000+") return { priceMin: 30000, priceMax: "" };
    return { priceMin: "", priceMax: "" };
};

const getFilterSignature = (state) =>
    JSON.stringify({
        search: state.search,
        category: state.category,
        location: state.location,
        condition: state.condition,
        price: state.price,
        sort: state.sort,
    });

const hasMoreProducts = () => productCollectionMeta.currentPage < productCollectionMeta.pages;

const setLoadMoreState = (isLoading) => {
    const button = loadMoreProductsBtn();
    if (!button) return;

    button.dataset.loading = isLoading ? "true" : "false";
    button.disabled = isLoading || !hasMoreProducts();
    button.innerHTML = isLoading
        ? `<i data-lucide="loader-2"></i><span>${t("products.loading_more")}</span>`
        : `<i data-lucide="chevrons-down"></i><span>${t("products.load_more")}</span>`;
    refreshIcons();
};

const renderProductPagination = () => {
    const container = productLoadMore();
    const summary = productPaginationSummary();
    const button = loadMoreProductsBtn();
    if (!container || !summary || !button) return;

    const total = productCollectionMeta.total || 0;
    const loaded = products.length;
    const hasProducts = loaded > 0;

    container.hidden = !hasProducts;
    if (!hasProducts) {
        summary.textContent = "";
        return;
    }

    summary.textContent = hasMoreProducts()
        ? t("products.loaded_progress", { loaded, total })
        : t("products.all_loaded", { count: total || loaded });

    button.hidden = !hasMoreProducts();
    setLoadMoreState(button.dataset.loading === "true");
};

const getActiveFilters = () => {
    const state = getFilterState();

    return [
        state.search && {
            key: "search",
            label: t("filters.search_chip", { value: state.search }),
        },
        state.category && {
            key: "category",
            label: `${t("filters.category")}: ${state.category}`,
        },
        state.location && {
            key: "location",
            label: `${t("filters.location")}: ${state.location}`,
        },
        state.condition && {
            key: "condition",
            label: `${t("filters.condition")}: ${getOptionLabel(conditionFilter(), state.condition)}`,
        },
        state.price && {
            key: "price",
            label: `${t("filters.price_range")}: ${getOptionLabel(priceFilter(), state.price)}`,
        },
        state.sort !== "newest" && {
            key: "sort",
            label: `${t("filters.sort_by")}: ${getOptionLabel(sortFilter(), state.sort)}`,
        },
    ].filter(Boolean);
};

const renderShortcutState = () => {
    const state = getFilterState();
    document.querySelectorAll("[data-filter-shortcut]").forEach((button) => {
        const key = button.dataset.filterShortcut;
        const value = button.dataset.value || "";
        button.classList.toggle("is-active", state[key] === value);
    });
};

const renderActiveFilterState = (resultTotal = productCollectionMeta.total || filteredProducts.length) => {
    const bar = activeFilterBar();
    const summary = activeFilterSummaryText();
    const chips = activeFilterChips();

    if (!bar || !summary || !chips) {
        renderShortcutState();
        return;
    }

    const active = getActiveFilters();
    if (!active.length) {
        bar.hidden = true;
        summary.textContent = "";
        chips.innerHTML = "";
        renderShortcutState();
        return;
    }

    bar.hidden = false;
    summary.textContent = t("filters.active_summary", {
        results: resultTotal,
        count: active.length,
        s: active.length === 1 ? "" : "s",
    });

    chips.innerHTML = [
        ...active.map(
            (item) => `
                <button class="filter-chip" type="button" data-clear-filter="${item.key}">
                  <span>${item.label}</span>
                  <i data-lucide="x"></i>
                </button>
            `
        ),
        `
            <button class="filter-chip filter-chip--clear" type="button" data-clear-filter="all">
              <span>${t("filters.clear_all")}</span>
              <i data-lucide="rotate-ccw"></i>
            </button>
        `,
    ].join("");

    chips.querySelectorAll("[data-clear-filter]").forEach((button) => {
        button.addEventListener("click", async () => {
            const target = button.dataset.clearFilter;
            if (target === "all") {
                resetFilterValues();
            } else {
                setFilterValue(target, getDefaultValue(target));
                if (target === "category") highlightCategory("");
            }
            await applyFilters();
        });
    });

    renderShortcutState();
    refreshIcons();
};

const bindQuickFilterShortcuts = () => {
    document.querySelectorAll("[data-filter-shortcut]").forEach((button) => {
        if (button.dataset.bound === "true") return;

        button.addEventListener("click", async () => {
            const key = button.dataset.filterShortcut;
            const value = button.dataset.value || "";
            const state = getFilterState();
            const nextValue = state[key] === value ? getDefaultValue(key) : value;

            setFilterValue(key, nextValue);
            if (key === "category") highlightCategory(nextValue);
            await applyFilters();
        });

        button.dataset.bound = "true";
    });
};

const bindProductPagination = () => {
    const button = loadMoreProductsBtn();
    if (!button || button.dataset.bound === "true") return;

    button.addEventListener("click", async () => {
        if (isLoadingMore || !hasMoreProducts()) return;
        isLoadingMore = true;
        try {
            await applyFilters({ append: true });
        } finally {
            isLoadingMore = false;
        }
    });

    button.dataset.bound = "true";
    setLoadMoreState(false);
};

// --- Populate category dropdown ---
export const populateCategoryOptions = () => {
    const catFilter = categoryFilter();
    const current = catFilter?.value || "";
    const options =
        `<option value="">${t("filters.all")}</option>` +
        categories
            .map((cat) => `<option value="${cat.value}">${cat.value}</option>`)
            .join("");
    catFilter.innerHTML = options;
    catFilter.value = current;

    const modalCatSelect = document.querySelector("#productForm select[name='category']");
    if (modalCatSelect) {
        const modalCurrent = modalCatSelect.value;
        modalCatSelect.innerHTML = categories
            .map((cat) => `<option value="${cat.value}">${cat.value}</option>`)
            .join("");
        modalCatSelect.value = modalCurrent;
    }
};

// --- Populate price range options based on active currency ---
export const populatePriceOptions = () => {
    const pf = priceFilter();
    if (!pf) return;
    const currency = getCurrency();
    const locale = getLocale() === "th" ? "th-TH" : "en-US";
    const money = (thbValue) => new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: ["USD", "SGD"].includes(currency) ? 2 : 0,
    }).format(convertPrice(thbValue));

    const current = pf.value;
    pf.innerHTML = [
        `<option value="">${t("filters.all")}</option>`,
        `<option value="0-5000">${t("filters.price_below_dynamic", { value: money(5000) })}</option>`,
        `<option value="5000-15000">${t("filters.price_range_dynamic", { min: money(5000), max: money(15000) })}</option>`,
        `<option value="15000-30000">${t("filters.price_range_dynamic", { min: money(15000), max: money(30000) })}</option>`,
        `<option value="30000+">${t("filters.price_above_dynamic", { value: money(30000) })}</option>`,
    ].join("");
    pf.value = current;
};

// --- Populate location dropdown from API ---
export const renderLocationOptions = async () => {
    const locFilter = locationFilter();
    const locations = await getLocations();

    const current = locFilter.value;
    locFilter.innerHTML =
        `<option value="">${t("filters.all")}</option>` +
        locations.map((loc) => `<option value="${loc}">${loc}</option>`).join("");
    locFilter.value = current;

    const modalLocSelect = document.querySelector("#productForm select[name='location']");
    if (modalLocSelect) {
        const modalCurrent = modalLocSelect.value;
        modalLocSelect.innerHTML = locations
            .map((loc) => `<option value="${loc}">${loc}</option>`)
            .join("");
        modalLocSelect.value = modalCurrent;
    }
};

// --- Apply all filters ---
export const applyFilters = async ({ append = false } = {}) => {
    const state = getFilterState();
    const filterSignature = getFilterSignature(state);
    const term = state.search.toLowerCase();
    const categoryValue = state.category;
    const { priceMin, priceMax } = getPriceBounds(state.price);
    const shouldAppend = append && filterSignature === lastAppliedSignature;
    const nextPage = shouldAppend ? productCollectionMeta.currentPage + 1 : 1;

    const sortMap = {
        newest: { sort_by: "created_at", sort_order: "desc" },
        price_asc: { sort_by: "price", sort_order: "asc" },
        price_desc: { sort_by: "price", sort_order: "desc" },
        rating_desc: { sort_by: "rating", sort_order: "desc" },
    };

    const filters = {
        search: term || "",
        category: categoryValue || "",
        location: state.location || "",
        condition: state.condition || "",
        price_min: priceMin,
        price_max: priceMax,
        page: nextPage,
        per_page: PAGE_SIZE,
        ...(sortMap[state.sort] || sortMap.newest),
    };

    if (!shouldAppend) {
        renderProductSkeletons();
    } else {
        setLoadMoreState(true);
    }

    try {
        const result = await loadProducts(filters);
        if (!result || result.error) {
            if (!shouldAppend) {
                setProducts([]);
                setFilteredProducts([]);
                setProductCollectionMeta({
                    total: 0,
                    pages: 0,
                    currentPage: 1,
                    perPage: PAGE_SIZE,
                });
                renderProducts([]);
                renderFeaturedProduct([]);
                updateResultCount(0, true);
                renderActiveFilterState(0);
                renderProductPagination();
                highlightCategory(categoryValue);
            } else {
                showToast(result?.message || t("products.load_more_error"), "error");
            }
            return;
        }

        const incomingProducts = Array.isArray(result.products) ? result.products : [];
        if (shouldAppend) {
            appendProducts(incomingProducts);
        } else {
            setProducts(incomingProducts);
        }

        setFilteredProducts(products);
        setProductCollectionMeta({
            total: result.total || products.length,
            pages: result.pages || 1,
            currentPage: result.current_page || nextPage,
            perPage: result.per_page || PAGE_SIZE,
        });
        lastAppliedSignature = filterSignature;

        renderProducts(products);
        renderFeaturedProduct(products.length ? products : []);
        updateResultCount(productCollectionMeta.total, false);
        renderActiveFilterState(productCollectionMeta.total);
        renderProductPagination();
        highlightCategory(categoryValue);
    } finally {
        if (shouldAppend) {
            setLoadMoreState(false);
        }
    }
};

const updateResultCount = (count, hasError = false) => {
    const el = resultCount();
    if (!el) return;
    if (hasError) {
        el.textContent = t("filters.error_loading");
        return;
    }
    el.textContent = t("filters.result_count", { count, s: count === 1 ? "" : "s" });
};

// --- Bind filter events ---
export const bindFilters = () => {
    const form = document.getElementById("filterForm");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearTimeout(searchDebounceTimer);
        await applyFilters();
    });

    populatePriceOptions();
    bindQuickFilterShortcuts();
    bindProductPagination();

    searchInput().addEventListener("input", () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            applyFilters();
        }, 250);
    });

    [categoryFilter(), locationFilter(), conditionFilter(), priceFilter(), sortFilter()].forEach(
        (el) => el.addEventListener("change", applyFilters)
    );

    document.getElementById("resetFilters").addEventListener("click", () => {
        clearTimeout(searchDebounceTimer);
        resetFilterValues();
        applyFilters();
    });

    renderShortcutState();
    renderProductPagination();
};
