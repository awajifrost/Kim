const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Blacklist = require('../models/Blacklist');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklistserver')
        .setDescription('Ajouter un serveur à la liste noire des partenariats')
        .addStringOption(option =>
            option.setName('serverid')
                .setDescription('ID du serveur à blacklister')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Raison du blacklist')
                .setRequired(true)),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const serverId = interaction.options.getString('serverid');
        const reason = interaction.options.getString('reason');

        let existingEntry = await Blacklist.findOne({ guildId, blacklistedServerId: serverId });
        if (existingEntry) {
            const existingEmbed = new EmbedBuilder()
                .setTitle('Serveur déjà blacklisté')
                .setDescription(`Le serveur \`${serverId}\` est déjà dans la liste noire.`)
                .addFields({ name: 'Raison', value: existingEntry.reason })
                .setColor(0x231e28);

            await interaction.reply({ embeds: [existingEmbed], ephemeral: true });
            return;
        }

        const blacklistEntry = new Blacklist({
            guildId,
            blacklistedServerId: serverId,
            reason: reason,
            blacklistedBy: interaction.user.id,
        });

        await blacklistEntry.save();

        const successEmbed = new EmbedBuilder()
            .setTitle('Serveur Ajouté à la Blacklist')
            .setDescription(`Le serveur \`${serverId}\` a été ajouté à la liste noire.`)
            .addFields({ name: 'Raison', value: reason })
            .setColor(0x231e28);

        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    },
};