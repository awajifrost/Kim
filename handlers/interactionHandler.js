const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig'); // Utilisation de GuildConfig

// Fonction pour gérer les clics sur les boutons
async function handleButtonClick(interaction) {
    if (interaction.customId === 'base_config') {
        const modal = new ModalBuilder()
            .setCustomId('base_config_modal')
            .setTitle('Configuration de Base')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('channel')
                        .setLabel('Salon de partenariat')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Entrez l\'ID du salon')
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('minmembers')
                        .setLabel('Nombre minimum de membres requis')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Entrez le nombre minimum de membres')
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('cmrole')
                        .setLabel('Rôle CM')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Entrez l\'ID du rôle CM')
                        .setRequired(true)
                )
            );

        await interaction.showModal(modal);
    } else if (interaction.customId === 'advanced_config') {
        const modal = new ModalBuilder()
            .setCustomId('advanced_config_modal')
            .setTitle('Configuration Avancée')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('embedtitle')
                        .setLabel('Titre de l\'embed')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Entrez le titre de l\'embed')
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('embeddescription')
                        .setLabel('Description de l\'embed')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Entrez la description de l\'embed')
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('embedimage')
                        .setLabel('URL de l\'image de l\'embed (optionnel)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Entrez l\'URL de l\'image (optionnel)')
                        .setRequired(false)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('thumbnail')
                        .setLabel('URL du thumbnail de l\'embed (optionnel)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Entrez l\'URL du thumbnail (optionnel)')
                        .setRequired(false)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('mentionrole')
                        .setLabel('Rôle à mentionner')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Entrez l\'ID du rôle à mentionner (optionnel)')
                        .setRequired(false)
                )
            );

        await interaction.showModal(modal);
    }
}

// Fonction pour gérer les soumissions de modales
async function handleModalSubmit(interaction) {
    const guildId = interaction.guild.id;

    if (interaction.customId === 'base_config_modal') {
        const channelId = interaction.fields.getTextInputValue('channel');
        const minMembers = parseInt(interaction.fields.getTextInputValue('minmembers'), 10);
        const cmRoleId = interaction.fields.getTextInputValue('cmrole');

        let config = await GuildConfig.findOne({ guildId });
        if (!config) {
            config = new GuildConfig({
                guildId,
                channelId,
                minMembersRequired: minMembers,
                cmRoleId
            });
        } else {
            config.channelId = channelId;
            config.minMembersRequired = minMembers;
            config.cmRoleId = cmRoleId;
        }

        await config.save();
        await interaction.reply(`Configuration de base mise à jour : Salon: ${channelId}, Minimum de membres: ${minMembers}`);
    } else if (interaction.customId === 'advanced_config_modal') {
        const embedTitle = interaction.fields.getTextInputValue('embedtitle');
        const embedDescription = interaction.fields.getTextInputValue('embeddescription');
        const embedImage = interaction.fields.getTextInputValue('embedimage') || null;
        const thumbnail = interaction.fields.getTextInputValue('thumbnail') || null;
        const mentionRoleId = interaction.fields.getTextInputValue('mentionrole') || null;

        let config = await GuildConfig.findOne({ guildId });
        if (config) {
            config.embedConfig = {
                title: embedTitle,
                description: embedDescription,
                image: embedImage,
                thumbnail: thumbnail,
                mentionRoleId: mentionRoleId
            };
            await config.save();

            const channel = await interaction.client.channels.fetch(config.channelId);
            const embed = new EmbedBuilder()
                .setTitle(embedTitle)
                .setDescription(embedDescription)
                .setImage(embedImage ? embedImage : null)
                .setThumbnail(thumbnail ? thumbnail : null);

            if (mentionRoleId) {
                embed.addFields({ name: 'Rôle à Mentionner', value: `<@&${mentionRoleId}>` });
            }

            await channel.send({ embeds: [embed] });
            await interaction.reply('Configuration avancée mise à jour et affichée dans le salon de partenariat.');
        } else {
            await interaction.reply('Aucune configuration trouvée pour cette guilde.');
        }
    }
}

module.exports = { handleButtonClick, handleModalSubmit };