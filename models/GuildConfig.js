// src/models/guildConfig.js
const mongoose = require('mongoose');

const guildConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String }, // Salon de partenariat
    minMembersRequired: { type: Number }, // Nombre minimum de membres requis
    cmRoleId: { type: String }, // Rôle CM
    categoryId: { type: String }, // ID de la catégorie pour les portails
    memberThreshold: { type: Number }, // Seuil de membres pour les portails
    alertUserIds: { type: [String] }, // Utilisateurs à alerter en cas d'invitation invalide
    embedConfig: {
        title: { type: String }, // Titre de l'embed
        description: { type: String }, // Description de l'embed
        image: { type: String }, // URL de l'image de l'embed (optionnel)
        thumbnail: { type: String }, // URL du thumbnail de l'embed (optionnel)
        mentionRoleId: { type: String } // ID du rôle à mentionner dans l'embed (optionnel)
    }
});

module.exports = mongoose.models.GuildConfig || mongoose.model('GuildConfig', guildConfigSchema);