// src/events/messageCreate.js
const GuildConfig = require('../models/GuildConfig');
const MonitoredMessage = require('../models/monitoredMessage');
const Blacklist = require('../models/Blacklist');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    execute: async (message, client) => {
        if (message.author.bot) return;

        const config = await GuildConfig.findOne({ guildId: message.guild.id });

        if (!config || message.channel.id !== config.channelId) return;

        if (!message.member.roles.cache.has(config.cmRoleId)) {
            await message.delete();
            await message.author.send(`${message.author}, seuls les membres avec le rôle autorisé peuvent poster des partenariats.`);
            return;
        }

        // Pattern to detect Discord invites
        const discordInvitePattern = /(?:https?:\/\/)?(?:www\.)?(discord\.gg\/|discord\.com\/invite\/)([a-zA-Z0-9]+)/;
        const match = message.content.match(discordInvitePattern);

        if (!match) return; // No valid invite found in the message

        const inviteCode = match[2]; // Extract the invite code

        try {
            const invite = await client.fetchInvite(inviteCode);

            // Check if the server is blacklisted
            const blacklistedServer = await Blacklist.findOne({ guildId: message.guild.id, blacklistedServerId: invite.guild.id });
            if (blacklistedServer) {
                await message.delete();
                const embed = new EmbedBuilder()
                    .setTitle('Serveur Blacklisté')
                    .setDescription('Le serveur que vous avez partagé est blacklisté pour les partenariats.')
                    .addFields({ name: 'Raison', value: blacklistedServer.reason || 'Aucune raison spécifiée' })
                    .setColor(0xff0000);

                await message.author.send({ embeds: [embed] }).catch(() => {
                    const warning = message.channel.send(`${message.author}, le serveur que vous avez partagé est blacklisté pour les partenariats, mais je ne peux pas vous envoyer un MP.`);
                    setTimeout(() => warning.delete(), 30000);
                });
                return;
            }

            // Check if the server meets the minimum member requirement
            if (invite.memberCount < config.minMembersRequired) {
                await message.delete();
                const warning = await message.channel.send(`L'invitation a été supprimée car le serveur n'a pas au moins ${config.minMembersRequired} membres.`);
                setTimeout(() => warning.delete(), 60000);
                return;
            }

            // Send the embed for the partnership
            const embed = new EmbedBuilder()
                .setTitle(config.embedConfig.title || 'Titre par défaut')
                .setDescription(config.embedConfig.description || 'Description par défaut')
                .setColor(0x231e28)
                .setImage(config.embedConfig.image || null)
                .setThumbnail(config.embedConfig.thumbnail || null)
                .setFooter({ text: `Serveur: ${invite.guild.name}, Membres: ${invite.memberCount}` });

            await message.channel.send({ content: config.embedConfig.mentionRoleId ? `<@&${config.embedConfig.mentionRoleId}>` : '', embeds: [embed] });

            // Save the message for monitoring
            const monitoredMessage = new MonitoredMessage({
                guildId: message.guild.id,
                channelId: message.channel.id,
                messageId: message.id,
                inviteCode: inviteCode
            });
            await monitoredMessage.save();

            // Set a timer to check the invite validity after a delay
            setTimeout(async () => {
                try {
                    await client.fetchInvite(inviteCode);
                } catch (error) {
                    if (error.message === 'Invalid Invite') {
                        await message.delete();
                        const warning = await message.channel.send('L\'invitation est devenue invalide et le message a été supprimé.');
                        setTimeout(() => warning.delete(), 60000);

                        await MonitoredMessage.deleteOne({ messageId: message.id });
                    } else {
                        console.error('Erreur lors de la vérification de l\'invitation:', error);
                    }
                }
            }, 60000); // 1-minute delay before checking the invite

        } catch (error) {
            if (error.message === 'Invalid Invite') {
                await message.delete();
                const warning = await message.channel.send('L\'invitation est invalide et a été supprimée.');
                setTimeout(() => warning.delete(), 60000);
            } else {
                console.error('Erreur lors de la récupération de l\'invitation:', error);
            }
        }
    },
};