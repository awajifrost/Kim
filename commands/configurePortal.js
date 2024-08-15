const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const guildConfig = require('../models/GuildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configureportal')
        .setDescription('Configurer les alertes et la catégorie pour les portails')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('ID de la catégorie pour ce portail')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('threshold')
                .setDescription('Seuil de membres pour passer à la catégorie suivante')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('alertuser')
                .setDescription('Utilisateur à alerter en cas d\'invitation invalide')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Titre pour l\'embed')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Description pour l\'embed')
                .setRequired(true)),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const categoryId = interaction.options.getString('category');
        const threshold = interaction.options.getInteger('threshold');
        const alertUser = interaction.options.getUser('alertuser');
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');

        let config = await guildConfig.findOne({ guildId });
        if (!config) {
            config = new guildConfig({
                guildId,
                categoryId,
                memberThreshold: threshold,
                alertUserIds: [alertUser.id],
                embedConfig: {
                    title: title,
                    description: description,
                },
            });
        } else {
            config.categoryId = categoryId;
            config.memberThreshold = threshold;
            // S'assurer que alertUserIds est initialisé
            if (!config.alertUserIds) {
                config.alertUserIds = [];
            }
            if (!config.alertUserIds.includes(alertUser.id)) {
                config.alertUserIds.push(alertUser.id);
            }
            config.embedConfig.title = title;
            config.embedConfig.description = description;
        }

        await config.save();

        // Créer un embed pour la réponse
        const embed = new EmbedBuilder()
            .setColor(0x231e28)
            .setTitle('Configuration mise à jour')
            .setDescription('Les paramètres du portail ont été mis à jour avec succès.');

        // Ajouter les champs de manière sécurisée
        if (categoryId) {
            embed.addFields({ name: 'Catégorie', value: categoryId, inline: true });
        }
        if (threshold !== null && threshold !== undefined) {
            embed.addFields({ name: 'Seuil de Membres', value: threshold.toString(), inline: true });
        }
        if (alertUser) {
            embed.addFields({ name: 'Utilisateur Alerté', value: alertUser.tag, inline: true });
        }
        if (title) {
            embed.addFields({ name: 'Titre de l\'Embed', value: title, inline: true });
        }
        if (description) {
            embed.addFields({ name: 'Description de l\'Embed', value: description, inline: true });
        }

        // Répondre avec l'embed de manière éphemère
        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};