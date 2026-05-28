/**
 * utils.js — Shared utility functions
 */
import { t, getLocale, getCurrency, convertPrice } from "./i18n.js";

/**
 * Refresh Lucide icons in the DOM
 */
export const refreshIcons = () => {
    if (window.lucide?.createIcons) {
        lucide.createIcons();
    }
};

/**
 * Format price with locale-aware currency display.
 * Converts from THB to the user's selected currency.
 */
export const formatPrice = (value) => {
    const currency = getCurrency();
    const converted = convertPrice(value);
    const locale = getLocale() === "th" ? "th-TH" : "en-US";
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: currency === "USD" ? 2 : 0,
    }).format(converted);
};

/**
 * Format relative time from ISO string, using i18n translation keys.
 */
export const timeAgo = (isoString) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t("time.just_added", "Just added");
    if (minutes < 60) return t("time.min_ago", { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("time.hr_ago", { n: hours });
    const days = Math.floor(hours / 24);
    if (days < 30) {
        return days === 1
            ? t("time.day_ago", { n: days })
            : t("time.days_ago", { n: days });
    }
    const months = Math.floor(days / 30);
    return months === 1
        ? t("time.month_ago", { n: months })
        : t("time.months_ago", { n: months });
};

/**
 * Format a date string using locale-aware Intl.DateTimeFormat.
 * Returns e.g. "28 Mar 2026" (en) or "28 มี.ค. 2569" (th)
 */
export const formatDate = (isoString) => {
    if (!isoString) return "";
    const locale = getLocale() === "th" ? "th-TH" : "en-US";
    return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(isoString));
};

/**
 * Format full date+time using locale-aware Intl.DateTimeFormat.
 * Returns e.g. "28 Mar 2026, 14:30" (en) or "28 มี.ค. 2569, 14:30" (th)
 */
export const formatDateTime = (isoString) => {
    if (!isoString) return "";
    const locale = getLocale() === "th" ? "th-TH" : "en-US";
    return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(isoString));
};
