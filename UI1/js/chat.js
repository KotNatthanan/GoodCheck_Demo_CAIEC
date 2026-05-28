import {
  getToken,
  getConversations,
  getConversationDetail,
  sendChatMessage,
  startConversation,
} from "./api.js";
import { switchAuthTab } from "./auth.js";
import { currentUser } from "./state.js";
import { showToast } from "./notifications.js";
import { formatPrice, refreshIcons, timeAgo } from "./utils.js";

let conversations = [];
let activeConversationId = null;
let pendingProduct = null;

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

const getDisplayName = (user) => {
  if (!user) return "User";
  return user.full_name || user.username || "User";
};

const setChatModalVisibility = (isVisible) => {
  const modal = byId("chatModal");
  modal?.classList.toggle("is-visible", isVisible);
  modal?.setAttribute("aria-hidden", isVisible ? "false" : "true");
};

const openAuthModalForChat = (message) => {
  const authModal = byId("authModal");
  authModal?.classList.add("is-visible");
  authModal?.setAttribute("aria-hidden", "false");
  switchAuthTab("login");
  refreshIcons();
  showToast(message || "Please sign in to use messages.", "info");
};

const renderSidebarLoading = () => {
  const list = byId("chatConversationList");
  const count = byId("chatConversationCount");
  if (count) count.textContent = "Loading...";
  if (!list) return;

  list.innerHTML = Array.from({ length: 4 })
    .map(
      () => `
        <article class="chat-conversation-item chat-conversation-item--skeleton" aria-hidden="true">
          <div class="skeleton-line skeleton-line--title"></div>
          <div class="skeleton-line skeleton-line--short"></div>
        </article>
      `,
    )
    .join("");
};

const renderPanelMessage = (title, description, icon = "messages-square") => {
  const panel = byId("chatPanelContent");
  if (!panel) return;

  panel.innerHTML = `
    <div class="chat-empty-state">
      <i data-lucide="${icon}"></i>
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(description)}</p>
    </div>
  `;
  refreshIcons();
};

const renderConversationList = () => {
  const list = byId("chatConversationList");
  const count = byId("chatConversationCount");
  if (!list) return;

  if (count) {
    count.textContent = `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`;
  }

  if (!conversations.length) {
    list.innerHTML = `
      <div class="chat-conversation-empty">
        No messages yet. Open a listing and contact the seller to start.
      </div>
    `;
    return;
  }

  list.innerHTML = conversations
    .map((conversation) => {
      const counterpart = getDisplayName(conversation.counterpart);
      const isActive = conversation.id === activeConversationId;
      return `
        <button
          class="chat-conversation-item ${isActive ? "is-active" : ""}"
          data-conversation-id="${conversation.id}"
        >
          <div class="chat-conversation-item__top">
            <strong>${escapeHtml(counterpart)}</strong>
            <span>${conversation.last_message_at ? timeAgo(conversation.last_message_at) : ""}</span>
          </div>
          <p>${escapeHtml(conversation.product?.title || "Product conversation")}</p>
          <small>${escapeHtml(conversation.last_message_preview || "No messages yet.")}</small>
        </button>
      `;
    })
    .join("");

  list.querySelectorAll("[data-conversation-id]").forEach((item) => {
    item.addEventListener("click", async () => {
      await openConversation(Number(item.dataset.conversationId));
    });
  });
};

const renderStartComposer = (product) => {
  const panel = byId("chatPanelContent");
  if (!panel) return;

  panel.innerHTML = `
    <div class="chat-compose-card">
      <div class="chat-thread__header">
        <div>
          <p class="eyebrow">New Conversation</p>
          <h3>Message ${escapeHtml(getDisplayName(product.seller))}</h3>
          <p class="muted">About: ${escapeHtml(product.title)}</p>
        </div>
        <span class="badge">${formatPrice(product.price || 0)}</span>
      </div>
      <div class="chat-compose-card__meta">
        <span><i data-lucide="shield-check"></i>${product.seller?.is_verified ? "Verified seller" : "Marketplace seller"}</span>
        <span><i data-lucide="map-pin"></i>${escapeHtml(product.location || "Location pending")}</span>
      </div>
      <form id="chatStartForm" class="chat-reply-form">
        <label>
          Start the conversation
          <textarea
            name="content"
            rows="5"
            placeholder="Hi, is this item still available? Could you share more about condition, accessories, and pickup or shipping?"
            required
          ></textarea>
        </label>
        <button type="submit" class="primary-btn">
          <i data-lucide="send"></i>
          Send First Message
        </button>
      </form>
    </div>
  `;

  const form = byId("chatStartForm");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const content = String(formData.get("content") || "").trim();
    if (!content) return;

    const result = await startConversation({ product_id: product.id, content });
    if (!result || result.error || !result.conversation) {
      showToast(
        result?.message || "Unable to start the conversation.",
        "error",
      );
      return;
    }

    pendingProduct = null;
    showToast(
      result.message || "Conversation started successfully.",
      "success",
    );
    await loadConversations({ focusConversationId: result.conversation.id });
  });

  refreshIcons();
};

const renderThread = (conversation) => {
  const panel = byId("chatPanelContent");
  if (!panel) return;

  const counterpart = getDisplayName(conversation.counterpart);
  const messages = conversation.messages || [];
  const product = conversation.product || {};
  const messagesHtml = messages.length
    ? messages
        .map((message) => {
          const isMine = Number(message.sender_id) === Number(currentUser?.id);
          return `
          <article class="chat-message ${isMine ? "is-mine" : ""}">
            <div class="chat-message__meta">
              <strong>${isMine ? "You" : escapeHtml(getDisplayName(message.sender))}</strong>
              <span>${message.created_at ? timeAgo(message.created_at) : ""}</span>
            </div>
            <div class="chat-message__bubble">${escapeHtml(message.content)}</div>
          </article>
        `;
        })
        .join("")
    : `
      <div class="chat-empty-state chat-empty-state--thread">
        <i data-lucide="message-square-plus"></i>
        <h4>No messages yet</h4>
        <p>Send the first message to start this conversation.</p>
      </div>
    `;

  panel.innerHTML = `
    <div class="chat-thread">
      <div class="chat-thread__header">
        <div>
          <p class="eyebrow">Active Conversation</p>
          <h3>${escapeHtml(counterpart)}</h3>
          <p class="muted">${escapeHtml(product.title || "Product listing")}</p>
        </div>
        <div class="chat-thread__summary">
          <span class="badge">${formatPrice(product.price || 0)}</span>
          <span class="badge">${escapeHtml(product.status || "available")}</span>
        </div>
      </div>
      <div class="chat-thread__meta">
        <span><i data-lucide="box"></i>${escapeHtml(product.category || "General listing")}</span>
        <span><i data-lucide="map-pin"></i>${escapeHtml(product.location || "Location pending")}</span>
      </div>
      <div id="chatMessageList" class="chat-message-list">${messagesHtml}</div>
      <form id="chatReplyForm" class="chat-reply-form">
        <label>
          Reply
          <textarea
            name="content"
            rows="3"
            placeholder="Type your message"
            required
          ></textarea>
        </label>
        <button type="submit" class="primary-btn">
          <i data-lucide="send"></i>
          Send Message
        </button>
      </form>
    </div>
  `;

  const messageList = byId("chatMessageList");
  if (messageList) {
    messageList.scrollTop = messageList.scrollHeight;
  }

  const replyForm = byId("chatReplyForm");
  replyForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(replyForm);
    const content = String(formData.get("content") || "").trim();
    if (!content) return;

    const result = await sendChatMessage(conversation.id, { content });
    if (!result || result.error) {
      showToast(result?.message || "Unable to send the message.", "error");
      return;
    }

    replyForm.reset();
    showToast(result.message || "Message sent successfully.", "success");
    await loadConversations({ focusConversationId: conversation.id });
  });

  refreshIcons();
};

const openConversation = async (conversationId) => {
  activeConversationId = conversationId;
  renderConversationList();
  renderPanelMessage(
    "Loading conversation...",
    "Fetching the latest messages.",
    "messages-square",
  );

  const result = await getConversationDetail(conversationId);
  if (!result || result.error) {
    renderPanelMessage(
      "Unable to load conversation",
      result?.message || "Please try again.",
      "triangle-alert",
    );
    return;
  }

  renderThread(result);
  renderConversationList();
};

const loadConversations = async ({ focusConversationId = null } = {}) => {
  const result = await getConversations();
  if (!result || result.error) {
    conversations = [];
    renderConversationList();
    renderPanelMessage(
      "Unable to load inbox",
      result?.message || "Please try again in a moment.",
      "triangle-alert",
    );
    return;
  }

  conversations = result.conversations || [];
  renderConversationList();

  if (focusConversationId) {
    await openConversation(focusConversationId);
    return;
  }

  if (pendingProduct) {
    const existingConversation = conversations.find(
      (conversation) =>
        Number(conversation.product?.id) === Number(pendingProduct.id),
    );
    if (existingConversation) {
      pendingProduct = null;
      await openConversation(existingConversation.id);
      return;
    }

    renderStartComposer(pendingProduct);
    return;
  }

  if (
    activeConversationId &&
    conversations.some(
      (conversation) => conversation.id === activeConversationId,
    )
  ) {
    await openConversation(activeConversationId);
    return;
  }

  if (conversations.length) {
    await openConversation(conversations[0].id);
    return;
  }

  renderPanelMessage(
    "Your inbox is empty",
    "Open any product listing and click Message Seller to start a conversation.",
    "message-square-plus",
  );
};

export const openChatModal = async () => {
  if (!getToken()) {
    openAuthModalForChat("Please sign in to access your inbox.");
    return;
  }

  pendingProduct = null;
  setChatModalVisibility(true);
  renderSidebarLoading();
  renderPanelMessage(
    "Loading inbox...",
    "Preparing your buyer and seller messages.",
    "messages-square",
  );
  refreshIcons();
  await loadConversations();
};

export const openChatModalForProduct = async (product) => {
  if (!getToken()) {
    openAuthModalForChat("Please sign in to message the seller.");
    return;
  }

  if (!product?.id || !product?.seller?.id) {
    showToast("Unable to open this conversation right now.", "error");
    return;
  }

  pendingProduct = product;
  activeConversationId = null;
  setChatModalVisibility(true);
  renderSidebarLoading();
  renderPanelMessage(
    "Preparing chat...",
    "Loading the seller context and your inbox.",
    "messages-square",
  );
  refreshIcons();
  await loadConversations();
};

export const closeChatModal = () => {
  setChatModalVisibility(false);
};

export const bindChatModal = () => {
  const openBtn = byId("openChatInbox");
  const closeBtn = byId("closeChatModal");
  const modal = byId("chatModal");

  openBtn?.addEventListener("click", () => {
    openChatModal();
  });

  closeBtn?.addEventListener("click", closeChatModal);
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeChatModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeChatModal();
    }
  });
};
