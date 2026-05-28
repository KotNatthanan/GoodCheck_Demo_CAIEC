/**
 * tour.js — Onboarding tour for first-time visitors
 */
import { t } from "./i18n.js";
import { refreshIcons } from "./utils.js";

const TOUR_KEY = "goodcheck_tour_seen";

const STEPS = [
  {
    icon: "rocket",
    titleKey: "tour.welcome_title",
    descKey: "tour.welcome_desc",
    illustration: "sparkles",
  },
  {
    icon: "shopping-bag",
    titleKey: "tour.step1_title",
    descKey: "tour.step1_desc",
    illustration: "package-search",
  },
  {
    icon: "filter",
    titleKey: "tour.step2_title",
    descKey: "tour.step2_desc",
    illustration: "search",
  },
  {
    icon: "globe",
    titleKey: "tour.step3_title",
    descKey: "tour.step3_desc",
    illustration: "languages",
  },
  {
    icon: "banknote",
    titleKey: "tour.step4_title",
    descKey: "tour.step4_desc",
    illustration: "badge-dollar-sign",
  },
  {
    icon: "check-circle",
    titleKey: "tour.step5_title",
    descKey: "tour.step5_desc",
    illustration: "party-popper",
  },
];

let currentStep = 0;

const renderStep = () => {
  const step = STEPS[currentStep];
  const body = document.getElementById("tourBody");
  const dots = document.getElementById("tourDots");
  const prevBtn = document.getElementById("tourPrev");
  const nextBtn = document.getElementById("tourNext");
  const progress = document.getElementById("tourProgress");

  if (!body) return;

  body.innerHTML = `
    <div class="tour-step">
      <div class="tour-step__icon">
        <i data-lucide="${step.illustration}"></i>
      </div>
      <h3>${t(step.titleKey)}</h3>
      <p>${t(step.descKey)}</p>
      <small class="muted">${t("tour.step_of", { current: currentStep + 1, total: STEPS.length })}</small>
    </div>
  `;

  // Progress bar
  const pct = ((currentStep + 1) / STEPS.length) * 100;
  progress.style.setProperty("--tour-progress", `${pct}%`);

  // Dots
  dots.innerHTML = STEPS.map(
    (_, i) =>
      `<button class="tour-dot ${i === currentStep ? "is-active" : ""}" type="button" data-step="${i}" aria-label="Step ${i + 1}"></button>`
  ).join("");

  dots.querySelectorAll(".tour-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      currentStep = Number(dot.dataset.step);
      renderStep();
    });
  });

  // Buttons
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  prevBtn.textContent = isFirst ? t("tour.btn_skip") : t("tour.btn_prev");
  nextBtn.textContent = isLast ? t("tour.btn_done") : t("tour.btn_next");

  refreshIcons();
};

const closeTour = () => {
  const overlay = document.getElementById("tourOverlay");
  overlay.classList.remove("is-visible");
  overlay.setAttribute("aria-hidden", "true");
  localStorage.setItem(TOUR_KEY, "true");
};

const openTour = () => {
  const overlay = document.getElementById("tourOverlay");
  currentStep = 0;
  overlay.classList.add("is-visible");
  overlay.setAttribute("aria-hidden", "false");
  renderStep();
};

export const initTour = () => {
  const overlay = document.getElementById("tourOverlay");
  const closeBtn = document.getElementById("tourClose");
  const prevBtn = document.getElementById("tourPrev");
  const nextBtn = document.getElementById("tourNext");

  if (!overlay) return;

  closeBtn?.addEventListener("click", closeTour);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeTour();
  });

  prevBtn?.addEventListener("click", () => {
    if (currentStep === 0) {
      closeTour();
    } else {
      currentStep--;
      renderStep();
    }
  });

  nextBtn?.addEventListener("click", () => {
    if (currentStep === STEPS.length - 1) {
      closeTour();
    } else {
      currentStep++;
      renderStep();
    }
  });

  // Show on first visit
  const hasSeen = localStorage.getItem(TOUR_KEY);
  if (!hasSeen) {
    setTimeout(() => openTour(), 1500);
  }
};

// Allow manual re-opening
window.openGoodCheckTour = openTour;
