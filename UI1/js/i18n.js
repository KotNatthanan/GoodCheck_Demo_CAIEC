/**
 * i18n.js — Lightweight internationalisation engine for GoodCheck
 *
 * Features:
 *   - Translation: t(key, params) → localised string
 *   - Currency:    getCurrency(), setCurrency() → ASEAN-ready display currency toggle
 *   - Theme:       getTheme(), setTheme() → dark/light mode
 *   - DOM:         applyI18n() → auto-translate [data-i18n] elements
 */

const STORAGE_KEY = "goodcheck_locale";
const CURRENCY_KEY = "goodcheck_currency";
const THEME_KEY = "goodcheck_theme";
const DEFAULT_LOCALE = "en";
const DEFAULT_CURRENCY = "THB";
const DEFAULT_THEME = "dark";
const SUPPORTED_LOCALES = ["en", "th"];
const SUPPORTED_CURRENCIES = ["THB", "USD", "SGD", "MYR", "IDR"];
const SUPPORTED_THEMES = ["dark", "light"];

let currentLocale = DEFAULT_LOCALE;
let currentCurrency = DEFAULT_CURRENCY;
let currentTheme = DEFAULT_THEME;
let translations = {};
let onChangeCallbacks = [];

/* ── helpers ───────────────────────────────────────────────── */

const interpolate = (str, params = {}) => {
  let result = str;
  for (const [key, value] of Object.entries(params)) {
    result = result.replaceAll(`{${key}}`, String(value));
  }
  return result;
};

/* ── core i18n API ─────────────────────────────────────────── */

export const getLocale = () => currentLocale;

export const t = (key, fallback, params) => {
  if (typeof fallback === "object" && fallback !== null && !params) {
    params = fallback;
    fallback = undefined;
  }
  const raw = translations[key] ?? fallback ?? key;
  return params ? interpolate(raw, params) : raw;
};

const loadLocale = async (code) => {
  const safecode = SUPPORTED_LOCALES.includes(code) ? code : DEFAULT_LOCALE;
  try {
    const resp = await fetch(`./locales/${safecode}.json?v=${Date.now()}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    translations = await resp.json();
    currentLocale = safecode;
  } catch (err) {
    console.warn(`[i18n] Could not load locale "${safecode}":`, err);
    if (safecode !== DEFAULT_LOCALE) {
      await loadLocale(DEFAULT_LOCALE);
    }
  }
};

export const applyI18n = () => {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key) el.placeholder = t(key);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    if (key) el.innerHTML = t(key);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (key) el.setAttribute("aria-label", t(key));
  });
  document.documentElement.lang = currentLocale;
};

export const setLocale = async (code) => {
  if (!SUPPORTED_LOCALES.includes(code)) return;
  await loadLocale(code);
  localStorage.setItem(STORAGE_KEY, code);
  applyI18n();
  updateSwitcherUI();
  for (const cb of onChangeCallbacks) {
    try { await cb(code); } catch (e) { console.error("[i18n] onChange error:", e); }
  }
};

export const onLocaleChange = (cb) => {
  if (typeof cb === "function") onChangeCallbacks.push(cb);
};

/* ── currency API ──────────────────────────────────────────── */

const CURRENCY_RATES_FROM_THB = {
  THB: 1,
  USD: 0.028,
  SGD: 0.038,
  MYR: 0.13,
  IDR: 455,
};

const CURRENCY_SYMBOLS = {
  THB: "฿",
  USD: "$",
  SGD: "S$",
  MYR: "RM",
  IDR: "Rp",
};

export const getCurrency = () => currentCurrency;

export const convertPrice = (thbValue) => {
  const rate = CURRENCY_RATES_FROM_THB[currentCurrency] || 1;
  const converted = Number(thbValue || 0) * rate;
  return currentCurrency === "USD" || currentCurrency === "SGD"
    ? Math.round(converted * 100) / 100
    : Math.round(converted);
};

export const getCurrencyCode = () => currentCurrency;

export const setCurrency = (code) => {
  if (!SUPPORTED_CURRENCIES.includes(code)) return;
  currentCurrency = code;
  localStorage.setItem(CURRENCY_KEY, code);
  updateCurrencySwitcherUI();
  // Fire same callbacks to re-render prices
  for (const cb of onChangeCallbacks) {
    try { cb(currentLocale); } catch (e) { console.error("[i18n] onChange error:", e); }
  }
};

const updateCurrencySwitcherUI = () => {
  const btn = document.getElementById("currSwitcherBtn");
  if (!btn) return;
  const symbol = CURRENCY_SYMBOLS[currentCurrency] || currentCurrency;
  btn.querySelector(".curr-symbol").textContent = symbol;
  btn.querySelector(".curr-code").textContent = currentCurrency;

  document.querySelectorAll(".curr-option").forEach((opt) => {
    opt.classList.toggle("is-active", opt.dataset.currency === currentCurrency);
  });
};

const bindCurrencySwitcher = () => {
  const btn = document.getElementById("currSwitcherBtn");
  const dropdown = document.getElementById("currDropdown");
  if (!btn || !dropdown) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("is-open");
  });

  document.addEventListener("click", () => {
    dropdown.classList.remove("is-open");
  });

  dropdown.querySelectorAll(".curr-option").forEach((opt) => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      const curr = opt.dataset.currency;
      dropdown.classList.remove("is-open");
      if (curr && curr !== currentCurrency) {
        setCurrency(curr);
      }
    });
  });

  updateCurrencySwitcherUI();
};

/* ── theme API ─────────────────────────────────────────────── */

export const getTheme = () => currentTheme;

export const setTheme = (theme) => {
  if (!SUPPORTED_THEMES.includes(theme)) return;
  currentTheme = theme;
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
  updateThemeToggleUI();
};

export const toggleTheme = () => {
  setTheme(currentTheme === "dark" ? "light" : "dark");
};

const updateThemeToggleUI = () => {
  const btn = document.getElementById("themeToggleBtn");
  if (!btn) return;
  const iconName = currentTheme === "dark" ? "sun" : "moon";
  const fallbackGlyph = currentTheme === "dark" ? "☀" : "☾";

  if (window.lucide?.createIcons) {
    btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
    lucide.createIcons();
    return;
  }

  // Fallback so the control still shows a visible symbol even if Lucide
  // hasn't loaded yet or replaced the original placeholder node.
  btn.innerHTML = `<span class="theme-toggle-btn__glyph" aria-hidden="true">${fallbackGlyph}</span>`;
};

const bindThemeToggle = () => {
  const btn = document.getElementById("themeToggleBtn");
  if (!btn) return;
  btn.addEventListener("click", toggleTheme);
  updateThemeToggleUI();
};

/* ── language switcher UI ──────────────────────────────────── */

const SWITCHER_LABELS = {
  en: { flag: "🇬🇧", label: "EN" },
  th: { flag: "🇹🇭", label: "TH" },
};

const updateSwitcherUI = () => {
  const btn = document.getElementById("langSwitcherBtn");
  if (!btn) return;
  const info = SWITCHER_LABELS[currentLocale] || SWITCHER_LABELS.en;
  btn.querySelector(".lang-flag").textContent = info.flag;
  btn.querySelector(".lang-code").textContent = info.label;
  document.querySelectorAll(".lang-option").forEach((opt) => {
    opt.classList.toggle("is-active", opt.dataset.lang === currentLocale);
  });
};

const bindSwitcher = () => {
  const btn = document.getElementById("langSwitcherBtn");
  const dropdown = document.getElementById("langDropdown");
  if (!btn || !dropdown) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("is-open");
  });

  document.addEventListener("click", () => {
    dropdown.classList.remove("is-open");
  });

  dropdown.querySelectorAll(".lang-option").forEach((opt) => {
    opt.addEventListener("click", async (e) => {
      e.stopPropagation();
      const lang = opt.dataset.lang;
      dropdown.classList.remove("is-open");
      if (lang && lang !== currentLocale) {
        await setLocale(lang);
      }
    });
  });

  updateSwitcherUI();
};

/* ── SEO metadata ──────────────────────────────────────────── */

const applySEO = () => {
  // <title>
  const titleKey = t("seo.title", "GoodCheck | Trusted Marketplace for Pre-Owned Computer Gear");
  document.title = titleKey;

  // <meta name="description">
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement("meta");
    metaDesc.name = "description";
    document.head.appendChild(metaDesc);
  }
  metaDesc.content = t("seo.description", "Inspection-led marketplace for premium pre-owned computer gear.");

  // hreflang link tags
  const existingHreflang = document.querySelectorAll('link[hreflang]');
  existingHreflang.forEach((el) => el.remove());

  const baseUrl = window.location.origin + window.location.pathname;
  SUPPORTED_LOCALES.forEach((loc) => {
    const link = document.createElement("link");
    link.rel = "alternate";
    link.hreflang = loc;
    link.href = `${baseUrl}?lang=${loc}`;
    document.head.appendChild(link);
  });

  const xDefault = document.createElement("link");
  xDefault.rel = "alternate";
  xDefault.hreflang = "x-default";
  xDefault.href = baseUrl;
  document.head.appendChild(xDefault);
};

/* ── init ──────────────────────────────────────────────────── */

export const initI18n = async () => {
  // Locale
  const stored = localStorage.getItem(STORAGE_KEY);
  const preferred = SUPPORTED_LOCALES.includes(stored) ? stored : DEFAULT_LOCALE;
  await loadLocale(preferred);
  applyI18n();
  bindSwitcher();

  // Currency
  const storedCurr = localStorage.getItem(CURRENCY_KEY);
  currentCurrency = SUPPORTED_CURRENCIES.includes(storedCurr) ? storedCurr : DEFAULT_CURRENCY;
  bindCurrencySwitcher();

  // Theme
  const storedTheme = localStorage.getItem(THEME_KEY);
  currentTheme = SUPPORTED_THEMES.includes(storedTheme) ? storedTheme : DEFAULT_THEME;
  document.documentElement.setAttribute("data-theme", currentTheme);
  bindThemeToggle();

  // SEO
  applySEO();
};
