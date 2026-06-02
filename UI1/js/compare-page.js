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

function previewFile(input, previewEl) {

  const file = input.files && input.files[0];
  if (!file) {
    previewEl.innerHTML = "";
    return;
  }

  previewEl.innerHTML = `
    <img src="${URL.createObjectURL(file)}"
         alt="preview"
         style="width:100%;max-height:240px;object-fit:cover;">
  `;
}
function verdictColor(v) {
  return { SAME_ITEM:"#16a34a", SAME_PRODUCT:"#2563eb", SAME_TYPE:"#d97706", DIFFERENT:"#dc2626" }[v] || "#6b7280";
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

async function runCompare() {
  const f1 = $("compareImage1").files && $("compareImage1").files[0];
  const f2 = $("compareImage2").files && $("compareImage2").files[0];
  if (!f1 || !f2) { alert("Please select both images."); return; }

  const btn = $("runCompareBtn");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "<span>Analyzing…</span>";
  const result = await compareImages(f1, f2);
  renderResult(result);

  btn.disabled = false;
  btn.innerHTML = original;
  if (window.lucide) window.lucide.createIcons();
}

function wireUp() {
  const i1 = $("compareImage1");
  const i2 = $("compareImage2");
  if (i1) i1.addEventListener("change", (e) => previewFile(e.target, $("comparePreview1")));
  if (i2) i2.addEventListener("change", (e) => previewFile(e.target, $("comparePreview2")));
  const btn = $("runCompareBtn");
  if (btn) btn.addEventListener("click", runCompare);
  if (window.lucide) window.lucide.createIcons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireUp);
} else {
  wireUp();
}
