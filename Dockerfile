# Étape 1 : Utiliser une image de base officielle Node.js
FROM node:18

# Étape 2 : Créer et définir le répertoire de travail
WORKDIR /app

# Étape 3 : Copier les fichiers du projet dans l'image
COPY package*.json ./

# Étape 4 : Installer les dépendances
RUN npm install

# Étape 5 : Copier le reste des fichiers de votre projet
COPY . .

# Étape 6 : Exposer le port sur lequel votre app va tourner (ex: 3000)
EXPOSE 4000

# Étape 7 : Lancer l'application Node.js
CMD ["npm", "start"]