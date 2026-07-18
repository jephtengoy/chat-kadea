const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const submitBtn = loginForm.querySelector('button[type="submit"]');

// Déjà connecté → aller au chat
if (localStorage.getItem("token") && getStoredUser()) {
    window.location.href = "chat.html";
}

loginForm.addEventListener("submit", loginUser);

async function loginUser(event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.className = "hidden";
    message.textContent = "";

    if (!email || !password) {
        showMessage("Tous les champs sont obligatoires.", "error");
        return;
    }

    setLoading(true);

    try {
        const data = await login(email, password);
        saveSession(data);
        showMessage("Connexion réussie !", "success");

        setTimeout(() => {
            window.location.href = "chat.html";
        }, 800);
    } catch (error) {
        showMessage(error.message || "Email ou mot de passe incorrect.", "error");
    } finally {
        setLoading(false);
    }
}

async function login(email, password) {
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ email, password }),
    });

    return parseApiResponse(response);
}

function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? "Connexion..." : "Se connecter";
}

function showMessage(text, type) {
    message.textContent = text;
    message.classList.remove("hidden");

    if (type === "success") {
        message.className = "mb-4 p-3 rounded-lg bg-green-100 text-green-700";
    } else {
        message.className = "mb-4 p-3 rounded-lg bg-red-100 text-red-700";
    }
}
