const session = requireAuth();
const user = session?.user;

function initials(name) {
    return String(name || "?")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || "")
        .join("") || "?";
}

if (user) {
    const displayName = getUserDisplayName(user);

    document.getElementById("fullName").textContent = displayName;
    document.getElementById("email").textContent = user.email || "";
    document.getElementById("profileName").textContent = displayName;
    document.getElementById("profileEmail").textContent = user.email || "";

    const avatarEl = document.getElementById("profileAvatar");
    const avatarUrl = user.avatarUrl || user.avatar || "";

    if (avatarUrl) {
        avatarEl.innerHTML = `<img src="${avatarUrl}" alt="" class="w-full h-full object-cover" onerror="this.remove(); this.parentElement.textContent='${initials(displayName)}';">`;
    } else {
        avatarEl.textContent = initials(displayName);
    }
}

function logout() {
    clearSession();
    window.location.href = "Index.html";
}

document.getElementById("logoutButton")?.addEventListener("click", logout);
document.getElementById("logoutBtn")?.addEventListener("click", logout);
document.getElementById("logoutBtnMobile")?.addEventListener("click", logout);
