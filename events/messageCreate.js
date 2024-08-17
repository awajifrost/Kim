const GuildConfig = require('../models/GuildConfig');
const MonitoredMessage = require('../models/monitoredMessage');
const Blacklist = require('../models/Blacklist');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    execute: async (message, client) => {
        console.log('Message reçu:', message.content); // Log le message reçu

        if (message.author.bot) {
            console.log('Message ignoré car envoyé par un bot.');
            return;
        }

        const config = await GuildConfig.findOne({ guildId: message.guild.id });
        if (!config) {
            console.log('Pas de configuration trouvée pour ce serveur.');
            return;
        }

        if (message.channel.id !== config.channelId) {
            console.log(`Message envoyé dans un canal non autorisé: ${message.channel.id}`);
            return;
        }

        if (!message.member.roles.cache.has(config.cmRoleId)) {
            console.log(`L'utilisateur n'a pas le rôle requis: ${config.cmRoleId}`);
            await message.delete();
            await message.author.send(`${message.author}, seuls les membres avec le rôle autorisé peuvent poster des partenariats.`);
            return;
        }

        console.log('L\'utilisateur a le rôle requis et le message est dans le bon canal.');

        const discordInvitePattern = /(?:https?:\/\/)?(?:www\.)?(discord\.gg\/|discord\.com\/invite\/)([a-zA-Z0-9]+)/;
        const match = message.content.match(discordInvitePattern);

        if (!match) {
            console.log('Aucune invitation Discord trouvée dans le message.');
            return; // Aucune invitation trouvée
        }

        const inviteCode = match[2];
        console.log(`Invitation détectée: ${inviteCode}`);

        try {
            const invite = await client.fetchInvite(inviteCode);
            console.log('Invitation validée:', invite.guild.name);

            const blacklistedServer = await Blacklist.findOne({ guildId: message.guild.id, blacklistedServerId: invite.guild.id });
            if (blacklistedServer) {
                console.log(`Le serveur est blacklisté: ${invite.guild.name}`);
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

            if (invite.memberCount < config.minMembersRequired) {
                console.log(`Le serveur n'a pas le nombre minimum de membres: ${invite.memberCount}`);
                await message.delete();
                const warning = await message.channel.send(`L'invitation a été supprimée car le serveur n'a pas au moins ${config.minMembersRequired} membres.`);
                setTimeout(() => warning.delete(), 60000);
                return;
            }

            console.log('Toutes les conditions sont remplies. Envoi de l\'embed.');

            const embed = new EmbedBuilder()
                .setTitle(config.embedConfig.title || 'Titre par défaut')
                .setDescription(config.embedConfig.description || 'Description par défaut')
                .setColor(0x231e28)
                .setImage(config.embedConfig.image || null)
                .setThumbnail(config.embedConfig.thumbnail || null)
                .setFooter({ text: `Serveur: ${invite.guild.name}, Membres: ${invite.memberCount}` });

            await message.channel.send({ content: config.embedConfig.mentionRoleId ? `<@&${config.embedConfig.mentionRoleId}>` : '', embeds: [embed] });

            console.log('Embed envoyé avec succès.');

            const monitoredMessage = new MonitoredMessage({
                guildId: message.guild.id,
                channelId: message.channel.id,
                messageId: message.id,
                inviteCode: inviteCode
            });
            await monitoredMessage.save();

            console.log('Message monitoré sauvegardé.');

            setTimeout(async () => {
                try {
                    await client.fetchInvite(inviteCode);
                } catch (error) {
                    if (error.message === 'Invalid Invite') {
                        console.log('L\'invitation est devenue invalide.');
                        await message.delete();
                        const warning = await message.channel.send('L\'invitation est devenue invalide et le message a été supprimé.');
                        setTimeout(() => warning.delete(), 60000);

                        await MonitoredMessage.deleteOne({ messageId: message.id });
                    } else {
                        console.error('Erreur lors de la vérification de l\'invitation:', error);
                    }
                }
            }, 60000); // Délai de 1 minute avant de vérifier l'invitation

        } catch (error) {
            console.error('Erreur lors de la récupération de l\'invitation:', error.message);
            if (error.message === 'Invalid Invite') {
                await message.delete();
                const warning = await message.channel.send('L\'invitation est invalide et a été supprimée.');
                setTimeout(() => warning.delete(), 60000);
            }
        }
    },
};
