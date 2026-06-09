import { compareSides } from "./api.js";

const $ = (id) => document.getElementById(id);

const SIDES = ["front", "back", "left", "right"];
const GROUPS = ["listing", "incoming"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const inputId = (group, side) => `cmp${cap(group)}${cap(side)}`;
const prevId = (group, side) => `prev${cap(group)}${cap(side)}`;

const objectUrls = new WeakMap();

// Escape any dynamic value before it touches innerHTML.
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function verdictColor(v) {
  return {
    SAME_ITEM: "#16a34a",
    SAME_PRODUCT: "#2563eb",
    SAME_TYPE: "#d97706",
    DIFFERENT: "#dc2626",
    REVIEW: "#7c3aed",
  }[v] || "#6b7280";
}

const label = (v) => esc(String(v || "UNKNOWN").replace(/_/g, " "));

// ---------- Previews ----------
function previewFile(input, previewEl) {
  const file = input.files && input.files[0];

  const prev = objectUrls.get(previewEl);
  if (prev) { URL.revokeObjectURL(prev); objectUrls.delete(previewEl); }

  if (!file) { previewEl.innerHTML = ""; return; }

  const url = URL.createObjectURL(file);
  objectUrls.set(previewEl, url);
  previewEl.innerHTML = `<img src="${esc(url)}" alt="preview"
    style="width:100%;max-height:140px;object-fit:cover;border-radius:8px">`;
}

// ---------- Collect ----------
function collect(group) {
  const out = {};
  for (const side of SIDES) {
    const input = $(inputId(group, side));
    const file = input && input.files && input.files[0];
    if (file) out[side] = file;
  }
  return out;
}

function missingSlots(listing, incoming) {
  const missing = [];
  for (const side of SIDES) {
    if (!listing[side]) missing.push(`Listing ${cap(side)}`);
    if (!incoming[side]) missing.push(`Received ${cap(side)}`);
  }
  return missing;
}

// ---------- Run ----------
async function runCompare() {
  const listing = collect("listing");
  const incoming = collect("incoming");

  const missing = missingSlots(listing, incoming);
  if (missing.length) {
    alert(`Please add all 8 photos. Missing:\n- ${missing.join("\n- ")}`);
    return;
  }

  const btn = $("runCompareBtn");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "<span>Analyzing…</span>";

  try {
    const result = await compareSides(listing, incoming);
    renderResult(result);
  } catch (err) {
    renderResult({ error: true, message: (err && err.message) || "Network error" });
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
    if (window.lucide) window.lucide.createIcons();
  }
}

// ---------- Render ----------
function renderSide(side, r) {
  const color = verdictColor(r.verdict);
  const attrRows = (r.matched_attributes || []).map(a => `
    <tr><td>${esc(a.attribute)}</td><td>${esc(a.image1_value)}</td><td>${esc(a.image2_value)}</td>
    <td style="text-align:center">${a.matches ? "✓" : "✗"}</td></tr>`).join("");
  const list = (arr) => (arr || []).map(x => `<li>${esc(x)}</li>`).join("") || "<li>—</li>";

  return `
    <div class="cmp-side">
      <div class="cmp-side-head">
        <span class="cmp-pill" style="background:${color}">${esc(side)} · ${label(r.verdict)}</span>
        <span class="cmp-conf">${esc(r.same_item_confidence)}% same-item · ${esc(r.overall_similarity)}% similar</span>
      </div>
      <p class="cmp-reason">${esc(r.reasoning)}</p>
      <table class="cmp-table">
        <thead><tr><th>Attribute</th><th>Listing</th><th>Received</th><th>Match</th></tr></thead>
        <tbody>${attrRows}</tbody>
      </table>
      <div class="cmp-lists">
        <div><h5>Distinguishing details</h5><ul>${list(r.distinguishing_details)}</ul></div>
        <div><h5>Differences</h5><ul>${list(r.differences)}</ul></div>
      </div>
    </div>`;
}

function renderResult(data) {
  const el = $("compareResult");
  el.hidden = false;

  if (!data || data.error) {
    el.innerHTML = `<p class="cmp-err">Error: ${esc((data && data.message) || "Something went wrong")}</p>`;
    return;
  }

  const fv = data.final_verdict || "UNKNOWN";
  const color = verdictColor(fv);

  const flags = [];
  (data.diff_sides || []).forEach(s =>
    flags.push(`<span class="cmp-flag" style="background:#dc2626">differs: ${esc(s)}</span>`));
  (data.detail_sides || []).forEach(s =>
    flags.push(`<span class="cmp-flag" style="background:#16a34a">confirmed: ${esc(s)}</span>`));
  Object.keys(data.errors || {}).forEach(s =>
    flags.push(`<span class="cmp-flag" style="background:#6b7280">error: ${esc(s)}</span>`));

  const perSide = data.per_side || {};
  const sideCards = SIDES
    .filter(s => perSide[s])
    .map(s => renderSide(s, perSide[s]))
    .join("");

  el.innerHTML = `
    <div class="cmp-final" style="border-color:${color}">
      <strong style="color:${color}">${label(fv)}</strong>
      <div class="cmp-final-meta">
        <span>min ${esc(data.min_confidence)}%</span>
        <span>mean ${esc(data.mean_confidence)}%</span>
      </div>
    </div>
    ${flags.length ? `<div class="cmp-flags">${flags.join("")}</div>` : ""}
    ${sideCards}
  `;
}

// ---------- Boot ----------
function wireUp() {
  for (const group of GROUPS) {
    for (const side of SIDES) {
      const input = $(inputId(group, side));
      const preview = $(prevId(group, side));
      if (input && preview) {
        input.addEventListener("change", (e) => previewFile(e.target, preview));
      }
    }
  }
  const btn = $("runCompareBtn");
  if (btn) btn.addEventListener("click", runCompare);
  if (window.lucide) window.lucide.createIcons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireUp);
} else {
  wireUp();
}