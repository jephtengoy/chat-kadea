// Configuration API partagée pour toutes les pages JavaScript
const BASE_URL = "https://kadea-chat-api.onrender.com";
const WORKSPACE = "wksp_44c1514c047f31568d5b24dac66e5a98";

function getApiHeaders(contentType = "application/json", includeAuth = false) {
    const headers = {
        "Content-Type": contentType,
        "x-api-key": WORKSPACE,
    };

    if (includeAuth) {
        const token = localStorage.getItem("token");
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
    }

    return headers;
}

function decodeJwtPayload(token) {
    try {
        const part = String(token).split(".")[1];
        if (!part) return null;
        const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
        const json = decodeURIComponent(
            atob(normalized)
                .split("")
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function normalizeUser(raw) {
    if (!raw || typeof raw !== "object") return null;

    const fullName =
        raw.fullName ||
        raw.fullname ||
        raw.name ||
        raw.username ||
        [raw.firstName || raw.first_name, raw.lastName || raw.last_name]
            .filter(Boolean)
            .join(" ")
            .trim() ||
        "";

    const email = raw.email || raw.Email || raw.mail || "";
    const id = raw._id || raw.id || raw.userId || raw.sub || null;

    // Ne pas traiter un objet "session" (token seul) comme un user
    if (!fullName && !email && !id) return null;

    return {
        ...raw,
        _id: id,
        id,
        fullName: fullName || email || "Utilisateur",
        email,
        avatarUrl: raw.avatarUrl || raw.avatar || raw.photo || "",
    };
}

function extractToken(payload) {
    const root = payload?.data ?? payload;
    return (
        root?.token ||
        root?.accessToken ||
        root?.access_token ||
        payload?.token ||
        null
    );
}

function extractUser(payload, token) {
    const root = payload?.data ?? payload;

    const candidates = [
        root?.user,
        root?.data?.user,
        root?.profile,
        root?.account,
        payload?.user,
        // parfois les infos sont directement dans data
        root,
    ];

    for (const candidate of candidates) {
        const user = normalizeUser(candidate);
        if (user && (user.fullName !== "Utilisateur" || user.email || user._id)) {
            // Si fullName est juste le fallback email ok
            if (user.email || (user.fullName && user.fullName !== "Utilisateur") || user._id) {
                // Éviter de prendre l'objet qui ne contient que token/message
                if (candidate?.token && !candidate?.email && !candidate?.fullName && !candidate?.name) {
                    continue;
                }
                return user;
            }
        }
    }

    const jwtUser = normalizeUser(decodeJwtPayload(token || extractToken(payload)));
    if (jwtUser) return jwtUser;

    return null;
}

function saveSession(payload) {
    const token = extractToken(payload);
    if (!token) {
        throw new Error("Réponse API invalide : token manquant.");
    }

    const user = extractUser(payload, token);
    if (!user) {
        throw new Error("Réponse API invalide : utilisateur manquant.");
    }

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
}

function getStoredUser() {
    try {
        return normalizeUser(JSON.parse(localStorage.getItem("user")));
    } catch {
        return null;
    }
}

function requireAuth(redirectTo = "Index.html") {
    const token = localStorage.getItem("token");
    const user = getStoredUser();

    if (!token || !user) {
        clearSession();
        window.location.href = redirectTo;
        return null;
    }

    return { token, user };
}

function getUserDisplayName(person) {
    const normalized = normalizeUser(person) || person;
    return (
        normalized?.fullName ||
        normalized?.fullname ||
        normalized?.name ||
        normalized?.username ||
        normalized?.email ||
        "Utilisateur"
    );
}

async function parseApiResponse(response) {
    let body = null;

    try {
        body = await response.json();
    } catch {
        body = null;
    }

    if (!response.ok) {
        const message =
            body?.message ||
            body?.errors?.[0]?.message ||
            "Une erreur est survenue.";
        throw new Error(message);
    }

    return body;
}
