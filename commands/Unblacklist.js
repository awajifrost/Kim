// src/commands/unblacklistserver.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Blacklist = require('../models/Blacklist');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unblacklistserver')
        .setDescription('Retirer un serveur de la liste noire des partenariats')
        .addStringOption(option =>
            option.setName('serverid')
                .setDescription('ID du serveur à retirer de la liste noire')
                .setRequired(true)),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const serverId = interaction.options.getString('serverid');

        // Chercher le serveur dans la liste noire
        let blacklistEntry = await Blacklist.findOne({ guildId, blacklistedServerId: serverId });
        if (!blacklistEntry) {
            const notFoundEmbed = new EmbedBuilder()
                .setTitle('Serveur non trouvé dans la Blacklist')
                .setDescription(`Le serveur \`${serverId}\` n'est pas dans la liste noire.`)
                .setColor(0xff0000);

            await interaction.reply({ embeds: [notFoundEmbed], ephemeral: true });
            return;
        }

        // Supprimer l'entrée de la liste noire
        await Blacklist.deleteOne({ guildId, blacklistedServerId: serverId });

        const successEmbed = new EmbedBuilder()
            .setTitle('Serveur Retiré de la Blacklist')
            .setDescription(`Le serveur \`${serverId}\` a été retiré de la liste noire.`)
            .setColor(0x00ff00);

        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    },
};
