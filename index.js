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

// Supprimer la fonction de vérification des invitations
// Vous avez décidé de ne plus vérifier les invitations périodiquement et de gérer cela uniquement dans le messageCreate

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
