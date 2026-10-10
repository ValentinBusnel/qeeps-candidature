# Candidature Qeeps — Valentin Busnel

Landing page de candidature aux couleurs de Qeeps : CV, projets, parcours, formulaire de contact
et une page **Charte graphique** complète (`/charte-graphique`).

- **Front** : React 18 + TypeScript + Vite + React Router (`client/`)
- **Back** : Node.js + Express + TypeScript (`server/`)
- **Base de données** : MongoDB via Mongoose

## Démarrage

Prérequis : Node.js ≥ 20, et Docker (ou une base MongoDB, par ex. MongoDB Atlas gratuit).

```bash
npm install                      # installe client + serveur (workspaces)
cp server/.env.example server/.env
npm run db:up                    # lance MongoDB dans Docker (port 27017)
npm run seed                     # remplit la base avec le contenu de server/src/data/seed-data.ts
npm run dev                      # API sur :4000 + site sur http://localhost:5173
```

Sans MongoDB, l'API démarre quand même et sert le contenu de `seed-data.ts` en mémoire
(seul le formulaire de contact a besoin de la base).

## Administration

Tout le contenu se modifie sur **http://localhost:5173/admin** : profil, textes de la page,
compétences, expériences, formation, chiffres, projets (photos et vidéos), messages reçus,
médiathèque, couleurs et compte.

- Sans `ADMIN_PASSWORD`, le compte admin se crée depuis le site : au premier démarrage, le serveur affiche dans ses journaux un lien `/admin/connexion?cle=…` à usage unique (sinon il est créé à partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
  dans `server/.env`. Ensuite, email et mot de passe se changent dans *Admin > Compte*.
- Les fichiers du site (images, vidéos, PDF, logos) sont stockés dans MongoDB (GridFS) et servis sur `/uploads`. Seuls les fichiers utilisés par le site y sont repris ; « Fichiers » dans l'admin signale ceux qui ne servent plus et permet de faire le ménage.
- `server/src/data/seed-data.ts` ne sert qu'à remplir une base vide ; `npm run seed` remet tout à zéro.
- Sécurité : mots de passe hachés (scrypt), session signée dans un cookie httpOnly,
  protection CSRF, 5 tentatives de connexion max par quart d'heure.

### Utilisateurs et rôles

Depuis l'admin (menu du compte → **Utilisateurs**), un administrateur invite quelqu'un par son email avec l'un de ces rôles :

- **Administrateur** : peut tout modifier et gérer les accès ;
- **Lecture seule** : consulte tout l'admin, mais rien ne peut être modifié (le serveur refuse toute modification).

La personne invitée reçoit un lien (valable 7 jours, à usage unique) pour choisir son mot de passe. Le même bouton envoie un lien de nouveau mot de passe à un compte existant.

Envoi des emails (facultatif) : Railway bloque le SMTP, on passe donc par une API HTTP.

| Variable | Rôle |
| --- | --- |
| `BREVO_API_KEY` | clé API Brevo (offre gratuite ; l'expéditeur peut être une adresse vérifiée, ex. Gmail) |
| `RESEND_API_KEY` | ou clé API Resend (nécessite un domaine vérifié) |
| `MAIL_FROM` | adresse d'expédition (vérifiée chez le service choisi) |
| `MAIL_FROM_NAME` | nom affiché, par défaut « Valentin Busnel » |

Sans ces variables, l'admin affiche le lien d'invitation à copier et transmettre soi-même.

## API

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/api/health` | État du serveur et de la base |
| GET | `/api/profile` | Profil / CV |
| GET | `/api/projects` | Projets triés |
| GET | `/api/settings` | Couleurs personnalisées |
| POST | `/api/messages` | Message du formulaire de contact (stocké dans MongoDB) |
| POST | `/api/auth/login` · `/logout`, GET `/api/auth/me` | Connexion admin |
| * | `/api/admin/...` | CRUD protégé : profile, projects, messages, uploads, settings, account |

Pour lire les messages reçus : `docker exec -it qeeps-candidature-mongo mongosh qeeps-candidature --eval "db.messages.find()"`.

## Notes

- La page porte `noindex` : elle n'apparaît pas dans les moteurs de recherche, on la partage par lien.
- Police : Poppins (Google Fonts, licence OFL, gratuite).
- Le logo et les visuels officiels de Qeeps ne sont pas reproduits ; le footer précise qu'il s'agit d'une candidature personnelle.

## Mise en ligne (Railway)

Un seul service Node sert l'API **et** le site (`client/dist`), avec MongoDB (contenu **et** fichiers : aucun disque à prévoir).

1. Sur Railway : *New Project → Deploy from GitHub repo* (ce dépôt), puis *+ New → Database → MongoDB*.
2. Variables du service :

   | Variable | Valeur |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | `${{MongoDB.MONGO_URL}}` (référence vers la base Railway) |
   | `CLIENT_ORIGIN` | l'adresse publique du site (ex. `https://….up.railway.app`) |
   | `SESSION_SECRET` | 64 caractères aléatoires |
   | `ADMIN_EMAIL` | email proposé pour le compte admin (le mot de passe se choisit sur le site via le lien 🔑 des journaux) |

3. *Settings → Networking → Generate Domain*.

`railway.json` fixe la construction (`npm run build`) et le démarrage (`npm start`).

### Contenu embarqué

`server/content/` contient l'état du site (profil, projets, réglages) et les fichiers réellement
utilisés (vidéos, PDF). Au premier démarrage sur une base vide, le site est recréé à l'identique
et les fichiers sont repris dans la base de données. Pour mettre à jour ce contenu avant un nouveau déploiement
sur une base neuve : `npm run content:export` (base locale démarrée), puis commit.
