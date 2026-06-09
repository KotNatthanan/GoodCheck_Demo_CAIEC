import { compareImages, getToken, submitVerificationFeedback } from "./api.js";

const $ = (id) => document.getElementById(id);
let currentVerificationEventId = null;

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

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

function renderResult(data) {
  const el = $("compareResult");
  el.hidden = false;
  if (data.error) {
    currentVerificationEventId = null;
    el.innerHTML = `<p style="color:#dc2626">Error: ${escapeHtml(data.message || "Something went wrong")}</p>`;
    return;
  }
  currentVerificationEventId = data.verification_event_id || null;
  const attrRows = (data.matched_attributes || []).map(a => `
    <tr><td>${escapeHtml(a.attribute)}</td><td>${escapeHtml(a.image1_value)}</td><td>${escapeHtml(a.image2_value)}</td>
    <td style="text-align:center">${a.matches ? "✓" : "✗"}</td></tr>`).join("");
  const list = (arr) => (arr || []).map(x => `<li>${escapeHtml(x)}</li>`).join("") || "<li>—</li>";
  el.innerHTML = `
    <div class="compare-verdict" style="border-color:${verdictColor(data.verdict)}">
      <strong style="color:${verdictColor(data.verdict)}">${escapeHtml(String(data.verdict || "").replace(/_/g," "))}</strong>
      <span>${escapeHtml(data.product_category || "")}</span>
    </div>
    <div class="compare-scores">
      <div><label>Overall similarity</label><strong>${data.overall_similarity}%</strong></div>
      <div><label>Same-item confidence</label><strong>${data.same_item_confidence}%</strong></div>
      <div><label>Same physical item?</label><strong>${data.is_same_item ? "Yes" : "No"}</strong></div>
    </div>
    <p class="compare-reasoning">${escapeHtml(data.reasoning || "")}</p>
    <table class="compare-table">
      <thead><tr><th>Attribute</th><th>Image 1</th><th>Image 2</th><th>Match</th></tr></thead>
      <tbody>${attrRows}</tbody>
    </table>
    <div class="compare-lists">
      <div><h4>Distinguishing details</h4><ul>${list(data.distinguishing_details)}</ul></div>
      <div><h4>Differences</h4><ul>${list(data.differences)}</ul></div>
    </div>
    <div class="compare-feedback">
      <div>
        <strong>AI feedback loop</strong>
        <p>${currentVerificationEventId ? `Event #${currentVerificationEventId} saved with ${escapeHtml(data.model || "Gemini")}.` : "This result was not saved."}</p>
      </div>
      <div class="compare-feedback__actions">
        <button class="outline-btn" data-feedback-label="correct" ${!currentVerificationEventId ? "disabled" : ""}>Correct</button>
        <button class="outline-btn" data-feedback-label="wrong" ${!currentVerificationEventId ? "disabled" : ""}>Wrong</button>
        <button class="ghost-btn" data-feedback-label="needs_review" ${!currentVerificationEventId ? "disabled" : ""}>Needs review</button>
      </div>
      <small>${getToken() ? "Admin feedback updates the verification dataset." : "Sign in as an admin to save feedback."}</small>
    </div>`;

  el.querySelectorAll("[data-feedback-label]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!currentVerificationEventId) return;
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "Saving...";
      const result = await submitVerificationFeedback(currentVerificationEventId, {
        feedback_label: button.dataset.feedbackLabel,
      });
      if (result?.error) {
        alert(result.message || "Unable to save feedback. Sign in as an admin first.");
        button.disabled = false;
        button.textContent = originalText;
        return;
      }
      button.textContent = "Saved";
    });
  });
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
