CREATE TABLE IF NOT EXISTS saloons (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  ville VARCHAR(255) NOT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS utilisateurs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  prenom VARCHAR(255) NOT NULL,
  login VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  grade ENUM('employé', 'contremaitre', 'co-patron', 'patron') NOT NULL,
  saloon_id INT UNSIGNED NOT NULL,
  admin BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_utilisateurs_saloon FOREIGN KEY (saloon_id) REFERENCES saloons(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ingredients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  type ENUM('ferme', 'herboriste', 'distillerie', 'general-store', 'cueillette') NOT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS produits (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  saloon_id INT UNSIGNED NULL,
  revente BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_produits_saloon FOREIGN KEY (saloon_id) REFERENCES saloons(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entreprises (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  type ENUM('ferme', 'herboriste', 'distillerie', 'general-store') NOT NULL,
  nom_patron VARCHAR(255) NOT NULL,
  bp_patron VARCHAR(255) NOT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
