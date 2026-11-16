# saloon-LH

Gestion du saloon RP sur Last Horizon.

## Structure

- `frontend/` : Vue 3, TypeScript et Vite.
- `backend/` : API REST Node.js et Express.
- `compose.yaml` : PostgreSQL local avec volume persistant.

## Développement

Prérequis : Node.js 22.12 ou plus récent (ou une version prise en charge par Vite) et Docker Compose.

1. Démarrer PostgreSQL depuis la racine :

   ```sh
   docker compose up -d
   ```

2. Dans un premier terminal, configurer et démarrer l'API :

   ```sh
   cd backend
   cp .env.example .env
   npm ci
   npm run dev
   ```

3. Dans un second terminal, démarrer le frontend :

   ```sh
   cd frontend
   npm ci
   npm run dev
   ```

Ouvrir l'URL affichée par Vite. Le serveur de développement transmet les requêtes `/api` à l'API sur le port 3000. `GET /api/health` vérifie la connexion à PostgreSQL et renvoie 503 si la base est indisponible.

Pour arrêter la base : `docker compose down`. Le volume reste conservé ; `docker compose down -v` supprime aussi les données.

## Production

Construire le frontend avec `cd frontend && npm ci && npm run build`, puis servir `frontend/dist` avec un serveur web. Configurer ce serveur ou un proxy inverse pour transmettre `/api` au backend sur la même origine.

Installer le backend avec `cd backend && npm ci --omit=dev` et le démarrer avec `npm start`. Fournir `DATABASE_URL` via l'environnement du déploiement, avec l'URL PostgreSQL distante et les paramètres TLS requis par le fournisseur (par exemple `sslmode=verify-full`), ainsi que `PORT` si nécessaire. Ne pas utiliser les identifiants locaux en production ni commettre de fichier `.env`.

## Branches

- `main` : code prêt pour la production.
- `develop` : intégration du développement en cours ; créer les branches de travail à partir de `develop` et ouvrir les demandes de fusion vers celle-ci.

Si `develop` n'existe pas encore sur le dépôt distant, un mainteneur peut la créer depuis `main` après intégration du squelette. Les versions validées de `develop` sont ensuite fusionnées dans `main` pour la production.
