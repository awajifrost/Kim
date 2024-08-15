const { Client, GatewayIntentBits, Partials, Collection, InteractionType } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const GuildConfig = require('./models/GuildConfig'); // Importer le modèle GuildConfig
const MonitoredMessage = require('./models/monitoredMessage'); // Importer le modèle MonitoredMessage
const { handleButtonClick, handleModalSubmit } = require('./handlers/interactionHandler'); // Importer le gestionnaire d'interactions

// Initialiser le client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// Connexion à MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Connecté à MongoDB');
    })
    .catch((err) => {
        console.error('Erreur de connexion à MongoDB:', err);
    });

// Collection des commandes
client.commands = new Collection();

// Chargement des commandes
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// Charger les événements
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Fonction pour vérifier la validité des invitations périodiquement
async function checkInvites() {
    const monitoredMessages = await MonitoredMessage.find({});
    
    for (const monitoredMessage of monitoredMessages) {
        try {
            const message = await client.channels.cache.get(monitoredMessage.channelId).messages.fetch(monitoredMessage.messageId);
            if (message.content.includes('discord.gg/')) {
                const inviteCode = message.content.split('discord.gg/')[1].split(' ')[0];
                try {
                    const invite = await client.fetchInvite(inviteCode);
                    if (!invite) throw new Error('Invalid invite');
                } catch (error) {
                    const config = await GuildConfig.findOne({ guildId: monitoredMessage.guildId });
                    if (config) {
                        config.alertUserIds.forEach(async (userId) => {
                            const user = await client.guilds.cache.get(monitoredMessage.guildId).members.fetch(userId);
                            user.send(`Une invitation invalide a été détectée dans le salon <#${monitoredMessage.channelId}>. Code d'invitation: ${monitoredMessage.inviteCode}`);
                        });
                    }

                    // Supprimer le message invalide de la base de données
                    await MonitoredMessage.deleteOne({ messageId: monitoredMessage.messageId });
                }
            } else {
                // Supprimer le message du stockage si ce n'est pas une invitation
                await MonitoredMessage.deleteOne({ messageId: monitoredMessage.messageId });
            }
        } catch (error) {
            if (error.code === 10008) {
                // Message non trouvé, donc on le supprime de la base de données
                await MonitoredMessage.deleteOne({ messageId: monitoredMessage.messageId });
            } else {
                console.error('Erreur lors de la vérification d\'un message:', error);
            }
        }
    }
}

// Vérifier les invitations existantes lorsque le bot se connecte
client.once('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag}`);

    // Vérifier les invitations pour les messages stockés
    await checkInvites();

    // Planifier une vérification périodique des invitations
    setInterval(checkInvites, 5000); // Vérifier toutes les heures (3600000 ms)
});

// Événement de suppression d'une invitation
client.on('inviteDelete', async invite => {
    await MonitoredMessage.deleteMany({ inviteCode: invite.code }); // Supprimer les messages associés
});

// Événement d'interaction avec les commandes
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Une erreur est survenue lors de l\'exécution de cette commande!', ephemeral: true });
        }
    } else if (interaction.isButton()) {
        await handleButtonClick(interaction);
    } else if (interaction.type === InteractionType.ModalSubmit) {
        await handleModalSubmit(interaction);
    }
});

// Connexion à Discord
client.login(process.env.TOKEN);