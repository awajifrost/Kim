// src/commands/configurepartner.js
const {
    SlashCommandBuilder,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
    InteractionType,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('configurepartner')
        .setDescription('Configurer le salon de partenariat et les paramètres'),

    async execute(interaction) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('base_config')
                    .setLabel('Configuration de Base')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('advanced_config')
                    .setLabel('Configuration Avancée')
                    .setStyle(ButtonStyle.Secondary)
            );

        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle('Configurer le partenariat')
            .setDescription('Cliquez sur un bouton pour configurer les paramètres :');

        await interaction.reply({ 
            embeds: [embed], 
            components: [row], 
            ephemeral: true // Réponse éphémère
        });
    },

    handleButtonClick: async (interaction) => {
        if (interaction.isButton()) {
            let modal;
            if (interaction.customId === 'base_config') {
                modal = new ModalBuilder()
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
            } else if (interaction.customId === 'advanced_config') {
                modal = new ModalBuilder()
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
            }

            if (modal) {
                await interaction.showModal(modal);
            }
        }
    },

    handleModalSubmit: async (interaction) => {
        if (interaction.type === InteractionType.ModalSubmit) {
            const guildId = interaction.guild.id;

            let config = await GuildConfig.findOne({ guildId });
            if (!config) {
                config = new GuildConfig({ guildId });
            }

            if (interaction.customId === 'base_config_modal') {
                config.channelId = interaction.fields.getTextInputValue('channel');
                config.minMembersRequired = parseInt(interaction.fields.getTextInputValue('minmembers'), 10);
                config.cmRoleId = interaction.fields.getTextInputValue('cmrole');

                await config.save();

                const baseConfigEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Configuration de Base')
                    .setDescription(`Salon: <#${config.channelId}>\nMin Membres: ${config.minMembersRequired}\nRôle CM: <@&${config.cmRoleId}>`);

                await interaction.reply({ embeds: [baseConfigEmbed], ephemeral: true });
            } else if (interaction.customId === 'advanced_config_modal') {
                config.embedConfig = {
                    title: interaction.fields.getTextInputValue('embedtitle') || null,
                    description: interaction.fields.getTextInputValue('embeddescription') || null,
                    image: interaction.fields.getTextInputValue('embedimage') || null,
                    thumbnail: interaction.fields.getTextInputValue('thumbnail') || null,
                    mentionRoleId: interaction.fields.getTextInputValue('mentionrole') || null
                };

                await config.save();

                const channel = await interaction.client.channels.fetch(config.channelId);
                const embed = new EmbedBuilder()
                    .setTitle(config.embedConfig.title || 'Titre par défaut')
                    .setDescription(config.embedConfig.description || 'Description par défaut')
                    .setImage(config.embedConfig.image || null)
                    .setThumbnail(config.embedConfig.thumbnail || null)
                    .setColor(0x231e28)
                    .setFooter({ text: 'Partenaire' });

                if (config.embedConfig.mentionRoleId) {
                    embed.addFields({ name: 'Rôle à Mentionner', value: `<@&${config.embedConfig.mentionRoleId}>` });
                }

                await channel.send({ embeds: [embed] });
                await interaction.reply({ 
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('Configuration Avancée')
                            .setDescription('La configuration avancée a été mise à jour et affichée dans le salon de partenariat.')
                    ],
                    ephemeral: true 
                });
            }
        }
    }
};