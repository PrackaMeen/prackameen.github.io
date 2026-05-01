export function mountSessionChat({ mgr, statusEl = null, chatCardEl = null, messageLogEl, chatForm, chatInput }) {
  const sendBtn = chatForm.querySelector(".chat-send-btn");
  const unsubs = [];
  let wired = false;

  function setChatEnabled(isEnabled) {
    chatInput.disabled = !isEnabled;
    sendBtn.disabled = !isEnabled;
  }

  function appendMessage(envelope) {
    const isSelf = envelope.senderId === mgr.peerId;
    const isSystem = envelope.type === "system";
    const peer = mgr.peers.get(envelope.senderId);
    const senderName = peer ? (peer.nickname || envelope.senderId.slice(0, 8)) : envelope.senderId.slice(0, 8);
    const time = new Date(envelope.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const li = document.createElement("li");
    li.className = [
      "message-item",
      isSelf ? "message-item--self" : "",
      isSystem ? "message-item--system" : ""
    ].filter(Boolean).join(" ");

    li.innerHTML = `
      <span class="message-seq">#${envelope.seq}</span>
      <span class="message-sender">${escHtml(senderName)}</span>
      <span class="message-text">${escHtml(envelope.payload?.text ?? JSON.stringify(envelope.payload))}</span>
      <span class="message-ts">${time}</span>`;

    messageLogEl.appendChild(li);
    messageLogEl.scrollTop = messageLogEl.scrollHeight;
  }

  function wireSession() {
    if (wired) {
      return;
    }

    wired = true;
    unsubs.push(mgr.onMessage((envelope) => {
      if (envelope.type === "chat" || envelope.type === "system") {
        appendMessage(envelope);
      }
    }));

    mgr.onDisconnected(() => {
      setChatEnabled(false);
      if (statusEl) {
        statusEl.textContent = "Disconnected from session.";
      }
    });
  }

  function activateChat() {
    if (chatCardEl) {
      chatCardEl.hidden = false;
    }

    setChatEnabled(true);
    wireSession();
  }

  setChatEnabled(false);
  if (chatCardEl) {
    chatCardEl.hidden = true;
  }

  if (mgr.sessionId && mgr._bus) {
    activateChat();
  } else {
    mgr.onSessionReady(() => {
      activateChat();
    });
  }

  const submitHandler = async (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text) {
      return;
    }

    chatInput.value = "";

    try {
      await mgr.send("chat", { text });
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = `Send error: ${err.message}`;
      }
    }
  };

  chatForm.addEventListener("submit", submitHandler);

  return {
    dispose() {
      unsubs.forEach((unsubscribe) => unsubscribe && unsubscribe());
      chatForm.removeEventListener("submit", submitHandler);
    }
  };
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}