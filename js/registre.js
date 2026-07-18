const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");
const submitBtn = registerForm.querySelector('button[type="submit"]');

registerForm.addEventListener("submit", registerUser);

async function registerUser(event) {
    event.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    message.className = "hidden";
    message.textContent = "";

    if (!fullName || !email || !password || !confirmPassword) {
        showMessage("Tous les champs sont obligatoires.", "error");
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage("Veuillez entrer une adresse email valide.", "error");
        return;
    }

    if (password.length < 6) {
        showMessage("Le mot de passe doit contenir au moins 6 caractères.", "error");
        return;
    }

    if (password !== confirmPassword) {
        showMessage("Les mots de passe ne correspondent pas.", "error");
        return;
    }

    setLoading(true);

    try {
        await register({ fullName, email, password });
        showMessage("Compte créé avec succès ! Redirection...", "success");
        registerForm.reset();

        setTimeout(() => {
            window.location.href = "Index.html";
        }, 1200);
    } catch (error) {
        showMessage(error.message || "Erreur lors de l'inscription.", "error");
    } finally {
        setLoading(false);
    }
}

async function register(user) {
    const response = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify(user),
    });

    return parseApiResponse(response);
}

function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? "Création..." : "Créer un compte";
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
