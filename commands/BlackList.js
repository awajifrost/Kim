const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Blacklist = require('../models/Blacklist');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Afficher la liste des serveurs blacklistés pour les partenariats'),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const blacklist = await Blacklist.find({ guildId });

        if (blacklist.length === 0) {
            const noBlacklistEmbed = new EmbedBuilder()
                .setColor(0x231e28)
                .setTitle('Liste des serveurs blacklistés')
                .setDescription('Aucun serveur n\'est actuellement blacklisté.');

            await interaction.reply({ embeds: [noBlacklistEmbed], ephemeral: true });
            return;
        }

        const blacklistEmbed = new EmbedBuilder()
            .setColor(0x231e28)
            .setTitle('Serveurs blacklistés')
            .setDescription(blacklist.map(entry => `**Serveur ID:** ${entry.blacklistedServerId}\n**Raison:** ${entry.reason}`).join('\n\n'))
            .setTimestamp();

        await interaction.reply({ embeds: [blacklistEmbed], ephemeral: true });
    },
};