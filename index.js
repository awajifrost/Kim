const { Client, GatewayIntentBits, Partials, Collection, InteractionType, ButtonStyle, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ComponentType } = require('discord.js');
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

// Ajout des événements personnalisés pour la vérification des nouveaux membres
client.on('guildMemberAdd', member => {
    // Ajouter le rôle de nouveau membre automatiquement
    const role = member.guild.roles.cache.get(process.env.ROLE_NEW_MEMBER);
    if (role) {
        member.roles.add(role).catch(console.error);
    }
});

client.on('messageCreate', async message => {
    if (message.channel.id !== process.env.CHANNEL_ID || message.author.bot) return;

    if (message.content.toLowerCase() === "j'accepte") {
        const embed = new EmbedBuilder()
            .setTitle('Vérification - Étape 1')
            .setDescription('Quel pseudonyme souhaitez-vous avoir ? (Sans caractères spéciaux)')
            .setColor('#00ff00');

        const embedMessage = await message.reply({ embeds: [embed] });

        const filter = msg => msg.author.id === message.author.id && /^[a-zA-Z0-9]+$/.test(msg.content);
        const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] })
            .catch(() => message.reply('Temps écoulé. Veuillez recommencer la vérification.'));

        if (collected) {
            const newNickname = '★' + collected.first().content;

            try {
                await message.member.setNickname(newNickname);
                const response = await message.reply(`Votre pseudonyme a été changé en ${newNickname}`);
                collected.first().delete(); // Supprimer la réponse de l'utilisateur
                setTimeout(() => response.delete(), 10000); // Supprimer après 10 secondes

                // Supprimer l'embed de l'étape précédente
                embedMessage.delete();

                // Passer à l'étape 2
                askBehaviorQuestion(message);
            } catch (err) {
                console.error(err);
                message.reply('Impossible de changer votre pseudo. Veuillez contacter un administrateur.');
            }
        }
    }
});

async function askBehaviorQuestion(message) {
    const embed = new EmbedBuilder()
        .setTitle('Vérification - Étape 2')
        .setDescription('Si un membre vous insulte ou fait quelque chose que vous considérez comme de l\'abus, que faites-vous ?')
        .setColor('#ffcc00');

    const embedMessage = await message.reply({ embeds: [embed] });

    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('behaviorSelect')
                .setPlaceholder('Sélectionnez une option')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Je le signale au staff de la communauté')
                        .setValue('good'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Je l\'insulte en retour')
                        .setValue('bad1'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Je le menace')
                        .setValue('bad2'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Je l\'harcèle')
                        .setValue('bad3'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Je m\'en prends à lui')
                        .setValue('bad4'),
                )
        );

    // Envoyer seulement une fois (ajout de components)
    const reply = await embedMessage.edit({ components: [row] });

    const filter = interaction => interaction.customId === 'behaviorSelect' && interaction.user.id === message.author.id;
    const collected = await message.channel.awaitMessageComponent({ filter, componentType: ComponentType.StringSelect, time: 60000 })
        .catch(() => message.reply('L\'interaction a expiré. Veuillez recommencer.'));

    if (collected) {
        if (collected.values[0] === 'good') {
            const response = await collected.reply('Bonne réponse ! Passons à l\'étape suivante.');
            setTimeout(() => response.delete(), 10000); // Supprimer après 10 secondes
            embedMessage.delete(); // Supprimer l'embed précédent
            askRespectQuestion(message);
        } else {
            const response = await collected.reply('Vous avez échoué la vérification. Un membre du staff va examiner votre cas.');
            setTimeout(() => response.delete(), 10000); // Supprimer après 10 secondes
            embedMessage.delete(); // Supprimer l'embed précédent
        }
    }
}

async function askRespectQuestion(message) {
    const embed = new EmbedBuilder()
        .setTitle('Vérification - Étape 3')
        .setDescription('Respecterez-vous la communauté et son règlement ?')
        .setColor('#00ff00');

    const embedMessage = await message.reply({ embeds: [embed] });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('yesRespect')
                .setLabel('Oui')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('noRespect')
                .setLabel('Non')
                .setStyle(ButtonStyle.Danger)
        );

    const reply = await embedMessage.edit({ components: [row] });

    const filter = interaction => (interaction.customId === 'yesRespect' || interaction.customId === 'noRespect') && interaction.user.id === message.author.id;
    const collected = await message.channel.awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 60000 });

    if (collected) {
        if (collected.customId === 'yesRespect') {
            const roleVerified = message.guild.roles.cache.get(process.env.ROLE_VERIFIED);
            const roleNewMember = message.guild.roles.cache.get(process.env.ROLE_NEW_MEMBER);
            if (roleVerified && roleNewMember) {
                await message.member.roles.remove(roleNewMember); // Retirer le rôle de nouveau membre
                await message.member.roles.add(roleVerified); // Ajouter le rôle vérifié
                const response = await collected.reply('Bienvenue dans la communauté ! Vous avez maintenant accès au serveur.');
                setTimeout(() => response.delete(), 10000); // Supprimer après 10 secondes
                embedMessage.delete(); // Supprimer l'embed précédent
            }
        } else {
            const response = await collected.reply('Vous avez refusé de respecter le règlement. Un membre du staff prendra en charge votre cas.');
            setTimeout(() => response.delete(), 10000); // Supprimer après 10 secondes
            embedMessage.delete(); // Supprimer l'embed précédent
        }
    }
}

// Supprimer automatiquement tous les messages du bot après 5 minutes
client.on('messageCreate', message => {
    if (message.author.bot) {
        setTimeout(() => message.delete().catch(console.error), 300000); // 300 000 millisecondes = 5 minutes
    }
});

// Connexion à Discord
client.login(process.env.TOKEN);
