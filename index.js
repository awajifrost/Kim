const { Client, GatewayIntentBits, Partials, Collection, InteractionType, ButtonStyle, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ComponentType } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const GuildConfig = require('./models/GuildConfig');
const MonitoredMessage = require('./models/monitoredMessage');
const { handleButtonClick, handleModalSubmit } = require('./handlers/interactionHandler');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Connecté à MongoDB');
    })
    .catch((err) => {
        console.error('Erreur de connexion à MongoDB:', err);
    });

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

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

client.on('inviteDelete', async invite => {
    await MonitoredMessage.deleteMany({ inviteCode: invite.code });
});

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

client.on('guildMemberAdd', member => {
    const role = member.guild.roles.cache.get(process.env.ROLE_NEW_MEMBER);
    if (role) {
        member.roles.add(role).catch(console.error);
    }
});

client.on('messageCreate', async message => {
    if (message.channel.id !== process.env.CHANNEL_ID || message.author.bot) return;

    console.log(`Message reçu : ${message.content}`);
});

client.login(process.env.TOKEN);
