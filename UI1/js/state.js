/**
 * state.js — Global application state
 */

// API Configuration
const normalizeApiBaseUrl = (value) => String(value).trim().replace(/\/+$/, "");

const resolveApiBaseUrl = () => {
  const override =
    window.GOODCHECK_API_BASE_URL ||
    localStorage.getItem("GOODCHECK_API_BASE_URL");

  if (override) {
    return normalizeApiBaseUrl(override);
  }

  if (window.location.protocol.startsWith("http")) {
    if (window.location.port === "5050") {
      return `${window.location.origin}/api`;
    }

    return `${window.location.protocol}//${window.location.hostname}:5050/api`;
  }

  return "http://localhost:5050/api";
};

export const API_BASE_URL = resolveApiBaseUrl();

// Current user
export let currentUser = null;
export function setCurrentUserState(user) {
  currentUser = user;
}

// Products
export let products = [];
export let filteredProducts = [];
export let productCollectionMeta = {
  total: 0,
  pages: 0,
  currentPage: 1,
  perPage: 12,
};
export function setProducts(list) {
  products = list;
}
export function appendProducts(list) {
  products = [...products, ...list];
}
export function setFilteredProducts(list) {
  filteredProducts = list;
}
export function setProductCollectionMeta(meta = {}) {
  productCollectionMeta = {
    total: Number(meta.total || 0),
    pages: Number(meta.pages || 0),
    currentPage: Number(meta.currentPage || 1),
    perPage: Number(meta.perPage || 12),
  };
}

// Favorites (Set of product IDs)
export const favorites = new Set();
export function addFavoriteId(id) {
  favorites.add(id);
}
export function removeFavoriteId(id) {
  favorites.delete(id);
}
export function toggleFavoriteId(id) {
  if (favorites.has(id)) {
    favorites.delete(id);
  } else {
    favorites.add(id);
  }
}
export function setFavoriteIds(ids) {
  favorites.clear();
  ids.forEach((id) => favorites.add(id));
}

// Category definitions. Keep values in sync with backend/app/constants.py.
export const categories = [
  {
    value: "Graphics Card",
    title: "High-Performance GPUs",
    description: "Built for smooth 2K and 4K gaming.",
    trend: "+18%",
    icon: "cpu",
    image:
      "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=900&q=80",
  },
  {
    value: "CPU",
    title: "Processors",
    description: "Ideal for editing, rendering, and multitasking.",
    trend: "+9%",
    icon: "activity",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
  },
  {
    value: "Streaming Gear",
    title: "Creator Gear",
    description: "Mics, cameras, and capture tools for live production.",
    trend: "+24%",
    icon: "radio",
    image:
      "https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?auto=format&fit=crop&w=900&q=80",
  },
  {
    value: "Gaming Gear",
    title: "Keyboards and Mice",
    description: "Premium switches, custom builds, and competitive peripherals.",
    trend: "+12%",
    icon: "mouse-pointer",
    image:
      "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=80",
  },
  {
    value: "Monitor",
    title: "144Hz+ Displays",
    description: "Fast refresh, strong color, and solid value.",
    trend: "+5%",
    icon: "monitor",
    image:
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80",
  },
  {
    value: "Storage",
    title: "SSD / NAS",
    description: "Move large files faster and keep projects reliable.",
    trend: "+15%",
    icon: "hard-drive",
    image:
      "https://images.unsplash.com/photo-1591799265444-d66432b91588?auto=format&fit=crop&w=900&q=80",
  },
];
