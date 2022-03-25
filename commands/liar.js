const { SlashCommandBuilder } = require('@discordjs/builders');
const { username, password, database } = require('../config.json');
var mysql = require('mysql');
const client = require('../index.js');
const { MessageActionRow, MessageButton } = require('discord.js');
const { prependOnceListener } = require('../index.js');

var gameState;
var timeOut = 60;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('liar')
		.setDescription(`Start a game of liar's dice.`)
        .addIntegerOption(option => 
            option.setName('amount')
            .setDescription('The amount you wish to put forward.')
            .setRequired(true))
        .addUserOption(option =>
            option.setName('two')
            .setRequired(true)
            .setDescription('Second player you wish to challenge.'))
        .addUserOption(option =>
            option.setName('three')
            .setRequired(false)
            .setDescription('Second player you wish to challenge.'))
        .addUserOption(option =>
            option.setName('four')
            .setRequired(false)
            .setDescription('Second player you wish to challenge.')),
	async execute(interaction) {
        var user = interaction.options.get('two').user;

        if(interaction.user.id == user.id) {
            interaction.reply({ content:'You cannot challenge yourself to this game.', ephemeral: true });
            return;
        }
        
        if(user.bot == true){
            interaction.reply({ content:'You cannot challenge a bot to this game.', ephemeral: true });
            return;
        }

        var playerIds = [interaction.user.id, interaction.options.get('two').user.id];
        var players = [];

        players.push({id:interaction.user.id, dice:[], wins:0, status:false}, {id:user.id, dice:[], wins:0, status:false});

        if(interaction.options.get('three')){
            var playerThree = interaction.options.get('three').user;
            players.push({id:playerThree.id, dice:[], wins:0, status:false});
            playerIds.push(playerThree.id);
        }

        if(interaction.options.get('four')) {
            var playerFour = interaction.options.get('four').user;
            players.push({id:playerFour.id, dice:[], wins:0, status:false});
            playerIds.push(playerFour.id);
        }

        if(interaction.options.get('amount').value < 100 && interaction.options.get('amount').value != 0){
            interaction.reply({content: 'The minimum wager must be 100. Use 0 to play a free game.', ephemeral:true});
            return;
        }

        if(interaction.options.get('amount').value > 500) {
            interaction.reply({content: 'The maximum wager for this game is 500.', ephemeral:true});
            return;
        }

        var balance = await handlePayment(playerIds, -Math.abs(interaction.options.get('amount').value));

        if(balance == false) {
            interaction.reply({content: 'One of the specified users could not afford this wager.', ephemeral:true});
            return;
        }

        var game = new Game(interaction.user.id, players, interaction.options.get("amount").value, interaction.channelId);

        if(game.status == false) {
            interaction.reply("There was an error creating the game.");
            return;
        }else {
            const row = new MessageActionRow().addComponents(
                new MessageButton().setCustomId("liarAccept").setLabel("Accept").setStyle("PRIMARY"),
                new MessageButton().setCustomId("liarReject").setLabel("Reject").setStyle("DANGER"),
            );
            interaction.reply({content: "Accept?", components:[row]});
            setTimeout(function(){
                if(gameState.gameStarted == false) {
                    var ids = [];
                    for(var i = 0; i < gameState.players.length; i++) {
                        ids.push(gameState.players[i].id);
                    }
                    handlePayment(ids, gameState.wager, "refund");
                    console.log("Players refunded.");
                    gameState.channel.send(`Players did not accept, cancelling game and refunding wagers. <@${gameState.playerId}> ${gameState.playerMentions}`);
                    gameState = undefined;
                }
            }, timeOut * 1000);
        }
	},
};

module.exports.acceptChallenge = acceptChallenge;
module.exports.rejectChallenge = rejectChallenge;
module.exports.turn = turn;
module.exports.showDice = showDice;

class Game {
    constructor(playerId, players, wager, channelId) {
        if(gameState !== undefined) {
            this.status = false;
            return false;
        }
        this.status = true;
        this.gameStarted = false;
        this.playerId = playerId;
        this.players = players;
        this.wager = wager;
        this.channel = client.channels.cache.get(channelId);
        this.playerMentions = ``;
        this.turn = this.players[0].id;
        this.round = 1;
        this.lastWager = {playerId:0, face:0, amount:0};
        for(var i = 1; i < players.length; i++) {
            this.playerMentions += `<@${players[i].id}> `;
        }
        this.playerMentions.slice(0, -1);
        this.channel.send(`<@${playerId}> has challenged the following user(s) to a game of Liar's Dice: ${this.playerMentions}. Players have up to a minute to accept. \n **The stakes are: ${this.wager}**`);
        gameState = this;
        
    }

    /**
     * Prints all the players dice.
     * @return {String}      The string that is returned.
     */

    printHand(){
        var print = ``;
        for(var i = 0; i < this.players.length; i++) {
            print += this.players[i].dice + "\n";
        }

        return print;
    };

    /**
     * Starts a new round when called. Randomizes dice in all players hand.
     */
    newRound(){
        if(gameState.round == 3) {
            for(var i = 0; i < gameState.players.length; i++) {
                if(((gameState.players[i].wins / 3) * 100) > 50){
                    var winner = gameState.players[i];
                }
            }
            gameState.channel.send({content:`Game has ended! The winner is: <@${winner.id}>`});
            gameState = undefined;
            return;
        }
        var game = gameState;
        for(var i = 0; i < game.players.length; i++) {
            game.players[i].dice = [];
            if(game.players.length == 2){
                for(var diceCount = 0; diceCount < 7; diceCount++) {
                    game.players[i].dice.push(randomIntFromInterval(1, 6));
                }
            }else{
                for(var diceCount = 0; diceCount < 5; diceCount++) {
                    game.players[i].dice.push(randomIntFromInterval(1, 6));
                }
            }
            game.players[i].dice = sortDice(game.players[i].dice);
        }
        game.lastWager = {playerId:0, face:0, amount:0};
        game.round = (game.round+1);
        game.turn = game.players[0].id;
        gameState = game;
        turn();
    }
}

/**
     * Handles a payment transaction.
     * @param  {ArrayList} players  All the players in the game.
     * @param  {Number} wager       The wager associated with the game.
     * @return {Boolean}            Returns true or false if players could handle the payment or if a transaction was successful.
     */
async function handlePayment(players, wager, reason = "liar") {
    var pool = mysql.createPool({
        connectionLimit: 10,
        supportBigNumbers: true,
        host:'localhost',
        user:username,
        password:password,
        database:database
    });

    if(wager == 0){
        return true;
    }

    var query = 'SELECT * FROM `currency` WHERE id = ?';

    for(var i = 1; i < players.length; i++) {
        query += " OR id = ?";
    }

    return new Promise(function(resolve, reject){
        pool.query(query, players, function(error, results, fields) {
            resolve(results)
        });
    }).then(function(results){
        for(var i = 0; i < results.length; i++) {
            var balance = results[i].balance + wager;
            if(balance < 0){
                return false;
            }
        }

        var date = new Date().toISOString().slice(0, 19).replace('T', ' ');
        for(var i = 0; i < results.length; i++) {
            var balance = results[i].balance + wager;
            pool.query('UPDATE `currency` SET `balance`=? WHERE id=?', [balance, results[i].id]);
            pool.query('INSERT INTO transactions(`user_id`, `amount`, `date`, `source`) VALUES (?, ?, ?, ?)', [results[i].id, wager, date, reason]);
        }
        return true;
    });
}

function turn() {
    const row = new MessageActionRow().addComponents(
        new MessageButton().setCustomId("liarDice").setLabel("Show Dice").setStyle("PRIMARY"),
    );
    gameState.channel.send({content:`Round: ${gameState.round}/3. It's now <@${gameState.turn}>'s turn. Either user the command !wager <Amount> <Face> or !liar to call the user a liar! \n Current wager: Amount: ${gameState.lastWager.amount} Face: ${gameState.lastWager.face}`, components:[row]});
    const filter = m => m.content.includes('!wager') || m.content.includes('!liar');
    const collector = gameState.channel.createMessageCollector({ filter, time: 60000 });

    collector.on('collect', m => {
        if(gameState.turn == m.author.id) {
            var temp = m.content.split(' ');
            var wager = {playerId:m.author.id, face:temp[2], amount:temp[1]};
            if(m.content == "!liar") {
                if(gameState.lastWager.face == 0 || gameState.lastWager.amount == 0) {
                    m.reply({content:"You can't call someone a liar when no one has taken a turn yet!", ephemeral:true});
                    return;
                }

                var count = 0;
                for(var i = 0; i < gameState.players.length; i++) {
                    for(var j = 0; j < gameState.players[i].dice.length; j++){
                        if(gameState.players[i].dice[j] == gameState.lastWager.face) {
                            count++;
                        }
                    }
                }

                if(count >= gameState.lastWager.amount) {
                    //Player was not lying, enough dice was in the game.
                    var playerHands = gameState.printHand();
                    for(var i = 0; i < gameState.players.length; i++){
                        if(gameState.players[i].id == gameState.lastWager.playerId) {
                            gameState.players[i].wins += 1;
                            break;
                        }
                    }
                    m.reply({content:`Player was not lying. Dice:\n${playerHands}\n**Press the Show Dice button. New round has started.**`});
                }else {
                    var playerHands = gameState.printHand();
                    for(var i = 0; i < gameState.players.length; i++){
                        if(gameState.players[i].id == m.author.id) {
                            gameState.players[i].wins += 1;
                            break;
                        }
                    }
                    m.reply({content:`Player was lying. Dice: \n${playerHands}`});
                }
                gameState.newRound();
                collector.stop();
                return;
            }

            if(m.content.split(' ').length < 3) {
                m.reply({content:'Incorrect command. Either use !wager <Amount> <Face> or !liar', ephemeral:true});
                return;
            }

            if(wager.face > 6) {
                m.reply({content:'The face value must be below 6. !wager <Amount> <Face>', ephemeral:true});
                return;
            }

            if(wager.face < gameState.lastWager.face) {
                m.reply({content:'The face value must be the same or higher than the last wager. !wager <Amount> <Face>', ephemeral:true});
                return;
            }

            if(wager.face == gameState.lastWager.face && wager.amount <= gameState.lastWager.amount) {
                m.reply({content:'The amount must be higher than the last wager or be a higher face value. !wager <Amount> <Face>', ephemeral:true});
                return;
            }

            gameState.lastWager = wager;
            gameState.turn = nextTurn(gameState.players, gameState.turn);

            collector.stop();
            turn();
        }
    });
}

function nextTurn(players, current) {
    for(var i = 0; i < players.length; i++){
        if(players[i].id == current){
            if(i == players.length-1) {
                return players[0].id;
            }else {
                return players[(i+1)].id;
            }
        }
    }
}

function acceptChallenge(interaction) {
    var playerId = interaction.user.id;
    if(gameState === undefined){
        interaction.reply("A game is currently not active.");
        return false;
    }

    var startGame = true;

    for(var i = 0; i < gameState.players.length; i++) {
        if(playerId == gameState.players[i].id) {
            gameState.players[i].status = true;

            if(!gameState.players[i].dice.length > 0) {
                if(gameState.players.length == 2) {
                    for(var diceCount = 0; diceCount < 7; diceCount++) {
                        gameState.players[i].dice.push(randomIntFromInterval(1, 6));
                    }
                }else {
                    for(var diceCount = 0; diceCount < 5; diceCount++) {
                        gameState.players[i].dice.push(randomIntFromInterval(1, 6));
                    }
                }
                
            }
    
            gameState.players[i].dice = sortDice(gameState.players[i].dice);
            interaction.reply({content:`Your dice are: ${gameState.players[i].dice}`, ephemeral:true});
            
        }

        if(gameState.players[i].status == false) {
            startGame = false;
        }

    }

    gameState.gameStarted = true;

    return startGame;
}

function rejectChallenge(interaction) {
    if(gameState === undefined){
        interaction.reply("A game is currently not active.");
        return false;
    }

    var playerIds = [];

    var playerMentions = ``;

    for(var i = 0; i < gameState.players.length; i++){
        if(gameState.players[i].id == interaction.user.id) {
            if(gameState.players[i].status == true) {
                interaction.reply({content:`You can't reject a game after accepting.`, ephemeral:true});
                return;
            }
        }
        playerIds.push(gameState.players[i].id);
        playerMentions += `<@${gameState.players[i].id}> `;
    }

    handlePayment(playerIds, gameState.wager, "refund");

    playerMentions += `The game of Liar's dice has been cancelled. All money has been refunded.`;
    interaction.reply(playerMentions);
    gameState = undefined;
    return;
}

function randomIntFromInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min)
}

function sortDice(dice) {
    for(var i = 0; i < dice.length; i++) {
        for(var j = 0; j < dice.length; j++) {
            if(dice[j] > dice[j+1]) {
                var temp = dice[j];
                dice[j] = dice[j+1];
                dice[j+1] = temp;
            }
        }
    }

    return dice;
}

function showDice(interaction){
    for(var i = 0; i < gameState.players.length; i++) {
        if(gameState.players[i].id == interaction.user.id) {
            interaction.reply({content:`Your dice are: ${gameState.players[i].dice}`, ephemeral:true});
            return;
        }
    }
}