// UI1/js/chatbot.js — floating support chatbot
import { askChatbot } from "./api.js";

const history = [];
const $ = (id) => document.getElementById(id);

function mount() {
  const wrap = document.createElement("div");
  wrap.id = "gcChatbot";
  wrap.className = "gc-bot";
  wrap.innerHTML = `
    <button id="gcBotToggle" class="gc-bot__toggle" aria-label="Open chat">
      <i data-lucide="message-circle"></i>
    </button>
    <div id="gcBotPanel" class="gc-bot__panel" hidden>
      <div class="gc-bot__header">
        <strong>GoodCheck Assistant</strong>
        <button id="gcBotClose" class="gc-bot__close" aria-label="Close">&times;</button>
      </div>
      <div id="gcBotMessages" class="gc-bot__messages">
        <div class="gc-bot__msg gc-bot__msg--bot">
          Hi! Ask me about products, recommendations, your orders, or how GoodCheck works.
        </div>
      </div>
      <div class="gc-bot__input">
        <input id="gcBotText" type="text" placeholder="Ask anything..." autocomplete="off" />
        <button id="gcBotSend" class="primary-btn">Send</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const panel = $("gcBotPanel");
  $("gcBotToggle").addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) $("gcBotText").focus();
  });
  $("gcBotClose").addEventListener("click", () => (panel.hidden = true));
  $("gcBotSend").addEventListener("click", send);
  $("gcBotText").addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  if (window.lucide) window.lucide.createIcons();
}

function addMsg(text, who) {
  const box = $("gcBotMessages");
  const msg = document.createElement("div");
  msg.className = `gc-bot__msg gc-bot__msg--${who}`;
  msg.textContent = text;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
  return msg;
}

async function send() {
  const input = $("gcBotText");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  addMsg(text, "user");
  history.push({ role: "user", text });

  const thinking = addMsg("…", "bot");
  $("gcBotSend").disabled = true;

  const res = await askChatbot(text, history);

  if (res.error) {
    thinking.textContent = "Sorry, I hit an error: " + (res.message || "please try again");
  } else {
    thinking.textContent = res.reply;
    history.push({ role: "assistant", text: res.reply });
  }
  $("gcBotSend").disabled = false;
  $("gcBotText").focus();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}