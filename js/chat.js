const conversationList = document.getElementById("conversationList");
const currentUserNameEl = document.getElementById("currentUserName");
const chatHeaderInfo = document.getElementById("chatHeaderInfo");
const receiverName = document.getElementById("receiverName");
const receiverAvatar = document.getElementById("receiverAvatar");
const receiverStatus = document.getElementById("receiverStatus");
const messagesEl = document.getElementById("messages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const searchInput = document.getElementById("searchInput");
const logoutBtn = document.getElementById("logoutBtn");
const logoutBtnMobile = document.getElementById("logoutBtnMobile");
const backToContacts = document.getElementById("backToContacts");
const contactsPanel = document.getElementById("contactsPanel");
const chatPanel = document.getElementById("chatPanel");
const syncBadge = document.getElementById("syncBadge");

const POLL_MESSAGES_MS = 2000;
const POLL_CONTACTS_MS = 8000;

const session = requireAuth();
let currentUser = session?.user;
let currentUserId = getUserId(currentUser);

if (currentUserNameEl) {
    currentUserNameEl.textContent = getDisplayName(currentUser);
}

let contacts = [];
let conversations = [];
let activeContact = null;
let activeConversationId = null;
let knownMessageIds = new Set();
let pendingOptimistic = new Map(); // fingerprint -> tempId
let messagePollTimer = null;
let contactsPollTimer = null;
let isPollingMessages = false;
let isSending = false;

bindLogout(logoutBtn);
bindLogout(logoutBtnMobile);

backToContacts?.addEventListener("click", showContactsPanel);

searchInput.addEventListener("input", () => {
    renderContacts(searchInput.value.trim().toLowerCase());
});

messageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await sendMessage();
});

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        stopMessagePolling();
        stopContactsPolling();
    } else {
        if (activeConversationId) {
            refreshMessagesQuiet();
            startMessagePolling();
        }
        startContactsPolling();
        refreshContactsQuiet();
    }
});

window.addEventListener("resize", () => {
    if (window.innerWidth >= 768) {
        contactsPanel.classList.remove("mobile-hidden");
        chatPanel.classList.remove("mobile-hidden");
        chatPanel.classList.add("flex");
        chatPanel.classList.remove("hidden");
    } else if (!activeContact) {
        showContactsPanel();
    }
});

showContactsPanel();
showContactSkeletons();
initChat();

function bindLogout(btn) {
    btn?.addEventListener("click", () => {
        clearSession();
        window.location.href = "Index.html";
    });
}

function showContactsPanel() {
    if (window.innerWidth >= 768) return;
    contactsPanel.classList.remove("mobile-hidden");
    chatPanel.classList.add("mobile-hidden");
    chatPanel.classList.remove("flex");
    chatPanel.classList.add("hidden");
}

function showChatPanel() {
    if (window.innerWidth >= 768) {
        chatPanel.classList.remove("hidden");
        chatPanel.classList.add("flex");
        return;
    }
    contactsPanel.classList.add("mobile-hidden");
    chatPanel.classList.remove("mobile-hidden");
    chatPanel.classList.remove("hidden");
    chatPanel.classList.add("flex");
}

async function initChat() {
    try {
        setSyncing(true);
        await refreshCurrentUser();
        if (currentUserNameEl) {
            currentUserNameEl.textContent = getDisplayName(currentUser);
        }

        await Promise.all([loadContacts(), loadConversations()]);
        renderContacts();
        startContactsPolling();
    } catch (error) {
        conversationList.innerHTML = `
            <div class="p-4 text-center text-red-500 text-sm">
                ${escapeHtml(error.message || "Impossible de charger les contacts.")}
                <button type="button" id="retryLoad" class="block mx-auto mt-3 text-blue-600 underline">
                    Réessayer
                </button>
            </div>
        `;
        document.getElementById("retryLoad")?.addEventListener("click", () => {
            showContactSkeletons();
            initChat();
        });
    } finally {
        setSyncing(false);
    }
}

function showContactSkeletons(count = 6) {
    conversationList.innerHTML = Array.from({ length: count }, () => `
        <div class="p-4 border-b flex items-center gap-3">
            <div class="skeleton w-12 h-12 rounded-full shrink-0"></div>
            <div class="flex-1 space-y-2">
                <div class="skeleton h-3 rounded w-2/3"></div>
                <div class="skeleton h-2.5 rounded w-1/2"></div>
            </div>
        </div>
    `).join("");
}

function showMessagesLoader() {
    messagesEl.innerHTML = `
        <div class="flex flex-col items-center justify-center mt-16 gap-3 text-gray-400">
            <div class="spinner"></div>
            <p class="text-sm">Chargement des messages...</p>
        </div>
    `;
}

function setSyncing(active) {
    if (!syncBadge) return;
    syncBadge.classList.toggle("hidden", !active);
}

function getUserId(person) {
    if (!person) return null;
    return person._id || person.id || person.userId || null;
}

function getDisplayName(person) {
    return getUserDisplayName(person);
}

function getMessageId(msg) {
    const id = msg?._id || msg?.id || msg?.messageId;
    if (id) return String(id);
    return null;
}

function getMessageContent(msg) {
    return String(msg?.content || msg?.text || msg?.message || "").trim();
}

function getMessageSenderId(msg) {
    return String(
        getUserId(msg?.sender) || msg?.senderId || msg?.userId || ""
    );
}

function messageFingerprint(msg) {
    return `${getMessageSenderId(msg)}::${getMessageContent(msg)}`;
}

function dedupeMessageList(list) {
    const seen = new Set();
    const result = [];

    list.forEach((msg) => {
        const id = getMessageId(msg);
        const key = id || `${messageFingerprint(msg)}::${msg?.createdAt || ""}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push(msg);
    });

    return result;
}

function isCurrentUser(person) {
    if (!person) return false;

    const personId = getUserId(person);
    if (currentUserId && personId && String(personId) === String(currentUserId)) {
        return true;
    }

    const myEmail = String(currentUser?.email || "").trim().toLowerCase();
    const theirEmail = String(person?.email || "").trim().toLowerCase();
    return Boolean(myEmail && theirEmail && myEmail === theirEmail);
}

async function refreshCurrentUser() {
    try {
        const response = await fetch(`${BASE_URL}/auth/me`, {
            method: "GET",
            headers: getApiHeaders("application/json", true),
        });
        const payload = await parseApiResponse(response);
        const me = extractUser(payload, localStorage.getItem("token"));
        if (me) {
            currentUser = me;
            currentUserId = getUserId(me);
            localStorage.setItem("user", JSON.stringify(me));
        }
    } catch (error) {
        console.warn("Profil courant:", error.message);
    }
}

function getInitials(name) {
    return String(name || "?")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "?";
}

function avatarColor(seed) {
    const colors = [
        "#128C7E", "#075E54", "#25D366", "#34B7F1",
        "#EC407A", "#AB47BC", "#5C6BC0", "#26A69A",
        "#FFA726", "#EF5350",
    ];
    const text = String(seed || "user");
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function buildAvatarHtml(person, sizeClass = "w-12 h-12") {
    const name = getDisplayName(person);
    const id = getUserId(person) || name;
    const color = avatarColor(id);
    const initials = getInitials(name);
    const avatarUrl = person?.avatarUrl || person?.avatar || "";

    const fallback = `
        <div class="${sizeClass} rounded-full flex items-center justify-center text-white font-semibold shrink-0"
            style="background:${color}">
            ${escapeHtml(initials)}
        </div>
    `;

    if (!avatarUrl) return fallback;

    return `
        <div class="${sizeClass} rounded-full overflow-hidden shrink-0 bg-gray-200 relative">
            <img
                src="${escapeAttr(avatarUrl)}"
                alt="${escapeAttr(name)}"
                class="w-full h-full object-cover"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="w-full h-full items-center justify-center text-white font-semibold absolute inset-0"
                style="background:${color}; display:none;">
                ${escapeHtml(initials)}
            </div>
        </div>
    `;
}

function setReceiverHeader(person) {
    if (!person) {
        chatHeaderInfo.classList.add("hidden");
        receiverName.textContent = "";
        receiverAvatar.innerHTML = "";
        return;
    }

    chatHeaderInfo.classList.remove("hidden");
    receiverName.textContent = getDisplayName(person);
    receiverStatus.textContent = "● En ligne";
    receiverAvatar.innerHTML = buildAvatarHtml(person, "w-9 h-9 sm:w-10 sm:h-10");
}

function setChatEnabled(enabled) {
    messageInput.disabled = !enabled;
    sendBtn.disabled = !enabled || isSending;
    if (enabled && window.innerWidth >= 768) messageInput.focus();
}

async function loadContacts() {
    const response = await fetch(`${BASE_URL}/users`, {
        method: "GET",
        headers: getApiHeaders("application/json", true),
    });

    const payload = await parseApiResponse(response);
    contacts = normalizeList(payload).filter((person) => !isCurrentUser(person));
}

async function loadConversations() {
    try {
        const response = await fetch(`${BASE_URL}/conversations`, {
            method: "GET",
            headers: getApiHeaders("application/json", true),
        });
        const payload = await parseApiResponse(response);
        conversations = normalizeList(payload);
    } catch (error) {
        console.warn("Conversations:", error.message);
        conversations = [];
    }
}

async function refreshContactsQuiet() {
    try {
        const prevIds = contacts.map((c) => getUserId(c)).join(",");
        await loadContacts();
        const nextIds = contacts.map((c) => getUserId(c)).join(",");
        if (prevIds !== nextIds) {
            renderContacts(searchInput.value.trim().toLowerCase());
        }
    } catch {
        // silencieux
    }
}

function normalizeList(payload) {
    const raw = payload?.data ?? payload;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.users)) return raw.users;
    if (Array.isArray(raw?.conversations)) return raw.conversations;
    if (Array.isArray(raw?.messages)) return raw.messages;
    if (Array.isArray(raw?.items)) return raw.items;
    return [];
}

function renderContacts(filter = "") {
    conversationList.innerHTML = "";

    const filtered = contacts.filter((person) => {
        const name = getDisplayName(person).toLowerCase();
        const email = String(person?.email || "").toLowerCase();
        return !filter || name.includes(filter) || email.includes(filter);
    });

    if (filtered.length === 0) {
        conversationList.innerHTML = `
            <div class="p-6 text-center text-gray-400 text-sm">
                ${contacts.length === 0
                    ? "Aucun autre compte pour le moment."
                    : "Aucun contact trouvé."}
            </div>
        `;
        return;
    }

    filtered.forEach((person) => {
        try {
            const item = document.createElement("button");
            item.type = "button";
            item.className =
                "w-full text-left p-3 sm:p-4 border-b hover:bg-gray-50 active:bg-gray-100 flex items-center gap-3 transition";

            if (activeContact && getUserId(activeContact) === getUserId(person)) {
                item.classList.add("bg-blue-50");
            }

            item.innerHTML = `
                ${buildAvatarHtml(person)}
                <div class="min-w-0 flex-1">
                    <h3 class="font-semibold truncate text-sm sm:text-base">${escapeHtml(getDisplayName(person))}</h3>
                    <p class="text-xs sm:text-sm text-gray-500 truncate">${escapeHtml(person?.email || "")}</p>
                </div>
            `;

            item.addEventListener("click", () => openChatWith(person));
            conversationList.appendChild(item);
        } catch (error) {
            console.warn("Contact ignoré:", error);
        }
    });
}

async function openChatWith(person) {
    activeContact = person;
    knownMessageIds = new Set();
    pendingOptimistic = new Map();
    setReceiverHeader(person);
    setChatEnabled(false);
    showChatPanel();
    showMessagesLoader();
    renderContacts(searchInput.value.trim().toLowerCase());

    try {
        const conversation = await getOrCreatePrivateConversation(person);
        activeConversationId = extractConversationId(conversation);

        if (!activeConversationId) {
            await loadConversations();
            const retry = await getOrCreatePrivateConversation(person);
            activeConversationId = extractConversationId(retry);
        }

        if (!activeConversationId) {
            messagesEl.innerHTML = `
                <div class="text-center text-gray-500 mt-10 text-sm">
                    Aucun message. Dites bonjour !
                </div>
            `;
            setChatEnabled(false);
            return;
        }

        setChatEnabled(true);
        await loadMessages(activeConversationId, { replace: true });
        startMessagePolling();
    } catch (error) {
        console.warn("Ouverture chat:", error.message);
        messagesEl.innerHTML = `
            <div class="text-center text-gray-500 mt-10 text-sm">
                Aucun message. Dites bonjour !
            </div>
        `;
        setChatEnabled(Boolean(activeConversationId));
    }
}

function extractConversationId(conv) {
    if (!conv) return null;
    if (typeof conv === "string") return conv;

    return (
        conv._id ||
        conv.id ||
        conv.conversationId ||
        conv.conversation?._id ||
        conv.conversation?.id ||
        null
    );
}

async function getOrCreatePrivateConversation(person) {
    const otherId = getUserId(person);
    if (!otherId) throw new Error("Identifiant du contact manquant.");

    await loadConversations();

    const existing = findPrivateConversationWith(otherId);
    if (existing) return existing;

    const attempts = [
        [String(otherId)],
        currentUserId ? [String(currentUserId), String(otherId)] : null,
    ].filter(Boolean);

    let lastError = null;

    for (const participantIds of attempts) {
        try {
            const response = await fetch(`${BASE_URL}/conversations`, {
                method: "POST",
                headers: getApiHeaders("application/json", true),
                body: JSON.stringify({
                    type: "private",
                    name: getDisplayName(person),
                    participantIds,
                }),
            });

            const payload = await parseApiResponse(response);
            const created =
                payload?.data?.conversation ??
                payload?.data ??
                payload;

            if (created) {
                conversations.push(created);
                return created;
            }
        } catch (error) {
            lastError = error;
            await loadConversations();
            const found = findPrivateConversationWith(otherId);
            if (found) return found;
        }
    }

    const fallback = findPrivateConversationWith(otherId);
    if (fallback) return fallback;

    throw lastError || new Error("Création de conversation échouée.");
}

function findPrivateConversationWith(otherId) {
    return conversations.find((conv) => {
        if (String(conv?.type || "").toLowerCase() === "group") return false;

        const participants =
            conv?.participants ||
            conv?.participantIds ||
            conv?.members ||
            [];

        const ids = participants.map((p) =>
            getUserId(typeof p === "object" ? p : { id: p })
        );

        return ids.some((id) => String(id) === String(otherId));
    });
}

async function fetchMessages(conversationId) {
    const response = await fetch(
        `${BASE_URL}/conversations/${conversationId}/messages`,
        {
            method: "GET",
            headers: getApiHeaders("application/json", true),
        }
    );

    const payload = await parseApiResponse(response);
    let list = normalizeList(payload);

    if (list.length === 0 && payload?.data?.messages) {
        list = payload.data.messages;
    }

    return sortMessages(list);
}

function sortMessages(list) {
    return [...list].sort((a, b) => {
        const da = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const db = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return da - db;
    });
}

async function loadMessages(conversationId, { replace = false } = {}) {
    const list = dedupeMessageList(await fetchMessages(conversationId));

    if (replace || knownMessageIds.size === 0) {
        renderMessages(list, { replace: true });
        return;
    }

    const nearBottom =
        messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;

    let added = 0;
    list.forEach((msg) => {
        if (ingestMessage(msg)) added += 1;
    });

    if (added > 0 && nearBottom) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }
}

function renderMessages(list, { replace = true } = {}) {
    if (replace) {
        messagesEl.innerHTML = "";
        knownMessageIds = new Set();
        pendingOptimistic = new Map();
    }

    const unique = dedupeMessageList(list);

    if (!unique.length) {
        messagesEl.innerHTML = `
            <div class="text-center text-gray-500 mt-10 text-sm">
                Aucun message. Dites bonjour !
            </div>
        `;
        return;
    }

    unique.forEach((msg) => {
        try {
            ingestMessage(msg);
        } catch (error) {
            console.warn("Message ignoré:", error);
        }
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
}

/** Ajoute un message ou fusionne avec un optimiste. Retourne true si DOM modifié. */
function ingestMessage(msg) {
    const id = getMessageId(msg);
    const fingerprint = messageFingerprint(msg);

    if (id && knownMessageIds.has(id)) return false;

    // Message réel qui correspond à un envoi optimiste → on met à jour la bulle existante
    if (id && pendingOptimistic.has(fingerprint)) {
        const tempId = pendingOptimistic.get(fingerprint);
        const row = messagesEl.querySelector(`[data-msg-id="${cssEscape(tempId)}"]`);
        if (row) {
            knownMessageIds.delete(tempId);
            knownMessageIds.add(id);
            row.dataset.msgId = id;
            pendingOptimistic.delete(fingerprint);
            return false;
        }
        pendingOptimistic.delete(fingerprint);
    }

    // Déjà affiché via optimiste (même contenu / expéditeur) sans id serveur encore
    if (!id && pendingOptimistic.has(fingerprint)) return false;

    if (messagesEl.querySelector(".text-center")) {
        messagesEl.innerHTML = "";
    }

    appendMessageBubble(msg);
    return true;
}

function appendMessageBubble(msg) {
    const id = getMessageId(msg) || `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (knownMessageIds.has(id)) return;

    knownMessageIds.add(id);

    const senderId = getMessageSenderId(msg);
    const isMine = String(senderId) === String(currentUserId);
    const content = getMessageContent(msg);
    const time = formatTime(msg?.createdAt || msg?.updatedAt);

    const row = document.createElement("div");
    row.dataset.msgId = id;
    row.dataset.fingerprint = messageFingerprint(msg);
    row.className = `flex ${isMine ? "justify-end" : "justify-start"}`;

    row.innerHTML = `
        <div class="${isMine ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"} rounded-2xl px-3 sm:px-4 py-2 max-w-[85%] sm:max-w-[75%] shadow-sm">
            <p class="whitespace-pre-wrap break-words text-sm sm:text-base">${escapeHtml(content)}</p>
            ${time ? `<p class="text-[10px] mt-1 opacity-70 text-right">${escapeHtml(time)}</p>` : ""}
        </div>
    `;

    messagesEl.appendChild(row);
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !activeConversationId || isSending) return;

    isSending = true;
    sendBtn.disabled = true;

    const tempId = `temp-${Date.now()}`;
    const optimistic = {
        _id: tempId,
        content: text,
        senderId: currentUserId,
        createdAt: new Date().toISOString(),
    };
    const fingerprint = messageFingerprint(optimistic);

    if (messagesEl.querySelector(".text-center")) {
        messagesEl.innerHTML = "";
    }

    pendingOptimistic.set(fingerprint, tempId);
    appendMessageBubble(optimistic);
    messageInput.value = "";
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
        const response = await fetch(
            `${BASE_URL}/conversations/${activeConversationId}/messages`,
            {
                method: "POST",
                headers: getApiHeaders("application/json", true),
                body: JSON.stringify({ content: text }),
            }
        );

        const payload = await parseApiResponse(response);
        const created = payload?.data?.message ?? payload?.data ?? payload;
        const realMsg = {
            ...created,
            content: getMessageContent(created) || text,
            senderId: getMessageSenderId(created) || currentUserId,
            createdAt: created?.createdAt || optimistic.createdAt,
        };

        // Fusionne temp → id réel (évite le doublon au prochain poll)
        ingestMessage(realMsg);

        // Si l'API n'a pas renvoyé d'id clair, on garde le temp jusqu'au poll
        if (!getMessageId(realMsg) && pendingOptimistic.get(fingerprint) === tempId) {
            // le poll fera la fusion via fingerprint
        }
    } catch (error) {
        const row = messagesEl.querySelector(`[data-msg-id="${cssEscape(tempId)}"]`);
        row?.remove();
        knownMessageIds.delete(tempId);
        pendingOptimistic.delete(fingerprint);
        messageInput.value = text;
        alert(error.message || "Impossible d'envoyer le message.");
    } finally {
        isSending = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(String(value));
    return String(value).replace(/"/g, '\\"');
}

async function refreshMessagesQuiet() {
    if (!activeConversationId || isPollingMessages) return;
    isPollingMessages = true;
    setSyncing(true);
    try {
        await loadMessages(activeConversationId, { replace: false });
    } catch {
        // silencieux
    } finally {
        isPollingMessages = false;
        setSyncing(false);
    }
}

function startMessagePolling() {
    stopMessagePolling();
    messagePollTimer = setInterval(() => {
        if (document.hidden) return;
        refreshMessagesQuiet();
    }, POLL_MESSAGES_MS);
}

function stopMessagePolling() {
    if (messagePollTimer) {
        clearInterval(messagePollTimer);
        messagePollTimer = null;
    }
}

function startContactsPolling() {
    stopContactsPolling();
    contactsPollTimer = setInterval(() => {
        if (document.hidden) return;
        refreshContactsQuiet();
    }, POLL_CONTACTS_MS);
}

function stopContactsPolling() {
    if (contactsPollTimer) {
        clearInterval(contactsPollTimer);
        contactsPollTimer = null;
    }
}

function formatTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
}

window.addEventListener("beforeunload", () => {
    stopMessagePolling();
    stopContactsPolling();
});
