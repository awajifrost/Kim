# Étape 1 : Utiliser une image officielle de Node.js
FROM node:18

# Étape 2 : Créer et définir le répertoire de travail
WORKDIR /app

# Étape 3 : Copier les fichiers de package.json et package-lock.json
COPY package*.json ./

# Étape 4 : Forcer npm à être utilisé
RUN corepack disable && npm install

# Étape 5 : Copier le reste des fichiers
COPY . .

# Étape 6 : Exposer le port sur lequel l'application va tourner (exemple : 4000)
EXPOSE 4000

# Étape 7 : Lancer l'application avec npm
CMD ["npm", "start"]
