const fs = require('node:fs');
const { Client, Intents, Collection } = require('discord.js');
const { Routes } = require('discord-api-types/v10');
const { token, clientId, guildId, username, password, database } = require('./config.json');
var mysql = require('mysql');
const { REST } = require('@discordjs/rest');
const rest = new REST({ version: '10' }).setToken(token);
const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]});
module.exports = client;
client.commands = new Collection();
const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for(const file of commandFiles) {
    const commandName = file.split(".")[0];
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());

    console.log(`Attempting to load command ${commandName}`)
    client.commands.set(commandName, command);
}

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);

client.once('ready', () => {
    console.log('Ready!');
});

client.on('interactionCreate', async interaction => {
    if(!interaction.isCommand()){
        if(!interaction.isButton()) return;
        if(interaction.customId == "hit") {
            var game = require('./commands/blackjack.js');
            game.hit(interaction);
        }else if(interaction.customId == "stand") {
            var game = require('./commands/blackjack.js');
            game.stand(interaction);
        }else if(interaction.customId == "liarAccept") {
            var game = require('./commands/liar.js');
            var checkGame = game.acceptChallenge(interaction);
            if(checkGame) {
                game.turn();
            }
        }else if(interaction.customId == "liarReject") {
            var game = require('./commands/liar.js');
            game.rejectChallenge(interaction);
        }else if(interaction.customId == "liarDice") {
            var game = require('./commands/liar.js');
            game.showDice(interaction);
        }
    }else {
        const command = client.commands.get(interaction.commandName);

        if(!command) return;
    
        try {
            await command.execute(interaction);
        }catch(error) {
            console.error(error);
            await interaction.reply({content: 'There was an error while executing this command!', ephemeral: true});
        }
    }
});

client.login(token);