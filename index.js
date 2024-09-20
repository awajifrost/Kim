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

    const acceptPhrases = ["j'accepte", "j’accepte"]; // Variantes avec apostrophe classique et apostrophe spéciale

    if (acceptPhrases.includes(message.content.toLowerCase())) {
        console.log(`Message d'acceptation reçu de ${message.author.username}`);

        const embed = new EmbedBuilder()
            .setTitle('Vérification - Étape 1')
            .setDescription('Quel pseudonyme souhaitez-vous avoir ? (Sans caractères spéciaux)')
            .setColor('#00ff00');

        const embedMessage = await message.reply({ embeds: [embed] });

        const filter = msg => msg.author.id === message.author.id && /^[a-zA-Z0-9 ]+$/.test(msg.content);
        const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] })
            .catch(() => {
                console.log('Aucune réponse reçue ou temps écoulé pour l\'étape 1.');
                return message.reply('Temps écoulé. Veuillez recommencer la vérification.');
            });

        if (collected) {
            const newNickname = '𐙚 ' + collected.first().content;
            console.log(`Pseudo proposé par l'utilisateur : ${newNickname}`);

            try {
                await message.member.setNickname(newNickname);
                const response = await message.reply(`Votre pseudonyme a été changé en ${newNickname}`);
                collected.first().delete();
                setTimeout(() => response.delete(), 10000);

                embedMessage.delete();
                askBehaviorQuestion(message); // Passer à l'étape suivante
            } catch (err) {
                console.error(`Erreur lors du changement de pseudo : ${err}`);
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

    const reply = await embedMessage.edit({ components: [row] });

    const filter = interaction => interaction.customId === 'behaviorSelect' && interaction.user.id === message.author.id;
    const collected = await message.channel.awaitMessageComponent({ filter, componentType: ComponentType.StringSelect, time: 60000 })
        .catch(() => message.reply('L\'interaction a expiré. Veuillez recommencer.'));

    if (collected) {
        if (collected.values[0] === 'good') {
            const response = await collected.reply('Bonne réponse ! Passons à l\'étape suivante.');
            setTimeout(() => response.delete(), 10000);
            embedMessage.delete();
            askRespectQuestion(message);
        } else {
            const response = await collected.reply('Vous avez échoué la vérification. Un membre du staff va examiner votre cas.');
            setTimeout(() => response.delete(), 10000);
            embedMessage.delete();
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
                await message.member.roles.remove(roleNewMember);
                await message.member.roles.add(roleVerified);
                const response = await collected.reply('Bienvenue dans la communauté ! Vous avez maintenant accès au serveur.');
                setTimeout(() => response.delete(), 10000);
                embedMessage.delete();
                await message.delete(); // Suppression du message "j'accepte" après vérification
            }
        } else {
            const response = await collected.reply('Vous avez refusé de respecter le règlement. Un membre du staff prendra en charge votre cas.');
            setTimeout(() => response.delete(), 10000);
            embedMessage.delete();
        }
    }
}

client.login(process.env.TOKEN);
