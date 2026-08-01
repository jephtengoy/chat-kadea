<<<<<<< HEAD
# Capstone-1-Kadea-Chat-Clone-Whatsapp-Web-
# Kadea Chat

## Vue d'ensemble

Kadea Chat est une application de chat simple construite avec des pages HTML et des scripts JavaScript côté client. Le projet utilise Tailwind CSS pour le style et stocke certaines informations utilisateur dans `localStorage`.

## Arborescence

- `html/`
  - `chat.html` : interface principale de chat avec liste de conversations et zone de messages.
  - `connexion.html` : page de connexion.
  - `prorfil.html` : page de profil utilisateur.
  - `registre .html` : page d'inscription (note : le nom de fichier contient un espace, ce qui doit être corrigé). 
- `js/`
  - `chat.js` : script de la page de chat.
  - `login.js` : gestion du formulaire de connexion.
  - `profil.js` : gestion de l'affichage du profil et de la déconnexion.
  - `registre.js` : gestion du formulaire d'inscription.

## Description des pages

### `html/chat.html`
- Affiche une barre latérale, une liste de conversations et une zone de discussion.
- Charge `chat.js` pour afficher des conversations et envoyer des messages.
- Attends un utilisateur connecté dans `localStorage` (`user` et `token`).

### `html/connexion.html`
- Formulaire de connexion avec email et mot de passe.
- Redirige vers une page d'accueil ou de chat après authentification.
- Charge `js/login.js`.

### `html/prorfil.html`
- Montre les informations du profil connecté (`fullName`, `email`).
- Autorise la déconnexion.
- Charge `js/profil.js`.

### `html/registre .html`
- Formulaire d'inscription avec nom complet, email, mot de passe et confirmation.
- Charge `js/registre.js`.
- Nécessite correction du nom de fichier et du chemin de script.

## Composants JavaScript

### `js/chat.js`
- Vérifie la présence d'un utilisateur connecté.
- Charge les workspaces depuis une API distante.
- Affiche des conversations dans la barre latérale.
- Ajoute la gestion de l'envoi de messages côté client.

### `js/login.js`
- Récupère les valeurs `email` et `password`.
- Appelle l'API d'authentification.
- Stocke le `token` et l'objet `user` dans `localStorage`.
- Redirige vers `home.html` (doit probablement être remplacé par `chat.html`).

### `js/profil.js`
- Vérifie la connexion de l'utilisateur.
- Affiche les données stockées dans `localStorage`.
- Gère la déconnexion.

### `js/registre.js`
- Valide le formulaire d'inscription.
- Appelle l'API d'enregistrement.
- Affiche un message de succès ou d'erreur.
- Contient des erreurs de syntaxe et de structure qui doivent être corrigées.

## Problèmes connus

1. `html/registre .html` contient un espace dans son nom de fichier.
2. Les liens vers les pages utilisent parfois des chemins absolus incorrects (`/html/registre .html`, `/html/connexion.html`) et doivent être adaptés au dossier du projet.
3. `js/login.js` redirige vers `home.html`, qui n'existe pas dans le projet. Il faut probablement rediriger vers `chat.html`.
4. `js/registre.js` a des fonctions imbriquées mal placées et un `event` non défini dans `registerUser(event)`.
5. `html/prorfil.html` pointe vers `profile.js`, alors que le fichier JS s’appelle `profil.js`.

## Conseils pour reprendre le projet

- Corriger les noms de fichiers et les chemins relatifs avant de tester.
- Vérifier que chaque page HTML importe le bon script JS.
- Assurer que l’API utilisée par `BASE_URL` est disponible et que la clé API est valide.
- Ajouter une page `home.html` ou rediriger vers `chat.html` depuis la connexion.
- Tester les interactions depuis `connexion.html`, `registre .html`, `chat.html` et `prorfil.html`.

## Installation et démarrage

Ce projet est statique. Il suffit d'ouvrir les pages HTML dans un navigateur ou de lancer un serveur local si nécessaire.

### Exemple en local
- Ouvrir `html/connexion.html` dans le navigateur.
- Naviguer vers `html/registre .html` pour créer un compte.
- Se connecter puis accéder à `html/chat.html`.

## Remarques pour le développeur suivant

- Le code est conçu pour fonctionner avec une API distante (`https://kadea-chat-api.onrender.com`).
- Les données utilisateur sont gérées uniquement dans `localStorage`, sans backend propre au projet.
- Pour rendre l'application plus solide, implémenter la gestion des erreurs réseau, le chargement des conversations dynamiques et la validation côté serveur.

