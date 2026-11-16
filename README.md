# saloon-LH

Gestion du saloon RP sur Last Horizon.

## Structure

- `frontend/` : Vue 3, TypeScript et Vite.
- `backend/` : API REST Node.js et Express.
- `compose.yaml` : MariaDB local avec volume persistant.

## Développement

Prérequis : Node.js 22.12 ou plus récent (ou une version prise en charge par Vite) et Docker Compose.

1. Démarrer MariaDB depuis la racine :

   ```sh
   docker compose up -d
   ```

2. Dans un premier terminal, configurer et démarrer l'API :

   ```sh
   cd backend
   cp .env.example .env
   npm ci
   # Définir API_KEY dans .env (au moins 32 caractères aléatoires).
   npm run migrate
   npm run dev
   ```

3. Dans un second terminal, démarrer le frontend :

   ```sh
   cd frontend
   npm ci
   npm run dev
   ```

Ouvrir l'URL affichée par Vite. Le serveur de développement transmet les requêtes `/api` à l'API sur le port 3000. `GET /api/health` vérifie la connexion à MariaDB et renvoie 503 si la base est indisponible.

Pour arrêter la base : `docker compose down`. Le volume reste conservé ; `docker compose down -v` supprime aussi les données.
Le volume PostgreSQL précédent n'est pas migré automatiquement vers MariaDB.

## API CRUD

Exécuter `npm run migrate` depuis `backend/` après configuration de la base et avant le démarrage de l'API ; cette initialisation est réexécutable et ne supprime pas les données. Les droits de création de tables sont nécessaires.

Les ressources `/api/saloons`, `/api/utilisateurs`, `/api/ingredients`, `/api/produits` et `/api/entreprises` proposent `GET` (liste), `POST` (création), et `GET`, `PUT`, `DELETE` sur `/:id`. Les corps et réponses sont en JSON. `PUT` remplace les champs, sauf le mot de passe utilisateur qui reste inchangé lorsqu'il est omis. Les créations répondent 201, les suppressions 204 ; une référence invalide, une suppression référencée ou un login déjà utilisé répond 409. Un saloon référencé ne peut pas être supprimé.

Champs acceptés :

- saloons : `nom`, `ville`
- utilisateurs : `nom`, `prenom`, `login`, `password`, `grade`, `saloon_id`, `admin`
- ingredients : `nom`, `type`
- produits : `nom`, `saloon_id`, `revente`
- entreprises : `nom`, `type`, `nom_patron`, `bp_patron` (texte)

Les champs sont obligatoires, sauf `saloon_id` pour un produit, qui peut être omis ou `null` pour un produit commun à tous les saloons. Les identifiants sont des entiers positifs ; `admin` et `revente` sont des booléens JSON. Les grades sont `employé`, `contremaitre`, `co-patron` et `patron`. Les types sont `ferme`, `herboriste`, `distillerie`, `general-store`, et aussi `cueillette` pour les ingrédients. Les mots de passe sont hachés avec scrypt et ne sont jamais renvoyés dans les réponses.

Toutes les routes CRUD exigent `Authorization: Bearer <API_KEY>`, avec une clé d'au moins 32 caractères ; elles répondent 503 si elle n'est pas configurée. Générer par exemple une clé avec `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Cette clé partagée donne accès à toutes les opérations : elle est destinée aux clients backend de confiance, pas à une application navigateur. Utiliser TLS et ne pas l'exposer publiquement. Elle ne constitue pas une authentification des utilisateurs ni une gestion des droits par grade. La route de santé reste publique.

Les tests s'exécutent avec `cd backend && npm test`. Pour les tests d'intégration, définir `TEST_DATABASE_URL` vers une base MariaDB **dédiée aux tests** avec droits de création de tables, puis lancer `npm test`.

## Production

Construire le frontend avec `cd frontend && npm ci && npm run build`, puis servir `frontend/dist` avec un serveur web. Configurer ce serveur ou un proxy inverse pour transmettre `/api` au backend sur la même origine.

Installer le backend avec `cd backend && npm ci --omit=dev` et le démarrer avec `npm start`. Fournir `DATABASE_URL` via l'environnement du déploiement, avec l'URL MariaDB distante et les paramètres TLS requis par le fournisseur (par exemple `?ssl=true` pour activer TLS avec vérification du certificat), ainsi que `PORT` si nécessaire. Ne pas utiliser les identifiants locaux en production ni commettre de fichier `.env`.
Configurer une `API_KEY` secrète et exécuter `npm run migrate` avant le démarrage.

La route de santé est limitée à 60 requêtes par minute et par adresse, en mémoire pour chaque instance de l'API. Derrière un proxy, l'adresse du proxy est utilisée par défaut : adapter la configuration de confiance Express à la topologie de déploiement si une limitation par client est nécessaire.

## Branches

- `main` : code prêt pour la production.
- `develop` : intégration du développement en cours ; créer les branches de travail à partir de `develop` et ouvrir les demandes de fusion vers celle-ci.

Si `develop` n'existe pas encore sur le dépôt distant, un mainteneur peut la créer depuis `main` après intégration du squelette. Les versions validées de `develop` sont ensuite fusionnées dans `main` pour la production.
