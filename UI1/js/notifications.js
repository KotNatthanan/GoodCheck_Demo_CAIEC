/**
 * notifications.js — Lightweight toast notifications
 */

const TOAST_STACK_ID = "toastStack";

const ensureToastStack = () => {
  let stack = document.getElementById(TOAST_STACK_ID);
  if (stack) return stack;

  stack = document.createElement("div");
  stack.id = TOAST_STACK_ID;
  stack.className = "toast-stack";
  stack.setAttribute("aria-live", "polite");
  stack.setAttribute("aria-atomic", "true");
  document.body.appendChild(stack);
  return stack;
};

export const showToast = (message, type = "info", duration = 3200) => {
  if (!message) return;

  const stack = ensureToastStack();
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", "status");

  const body = document.createElement("div");
  body.className = "toast__body";
  body.textContent = message;

  const closeBtn = document.createElement("button");
  closeBtn.className = "toast__close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Dismiss notification");
  closeBtn.textContent = "×";

  const dismiss = () => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 220);
  };

  closeBtn.addEventListener("click", dismiss);

  toast.append(body, closeBtn);
  stack.appendChild(toast);

  window.requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  window.setTimeout(dismiss, duration);
};
