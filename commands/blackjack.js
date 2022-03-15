const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const { username, password, database } = require('../config.json');
var mysql = require('mysql');
var rate = 1.25;

var gameState = new Array();

module.exports = {
	data: new SlashCommandBuilder()
		.setName('blackjack')
		.setDescription('Play a game of blackjack.')
        .addIntegerOption(option => 
            option.setName('amount')
            .setDescription('The amount you wish to put forward.')
            .setRequired(true)),
	async execute(interaction) {
        if(interaction.options.get('amount').value > 500) {
            interaction.reply({content: "Welp... That wager was too high. The maximum you can gamble is 500.", ephemeral: true});
            return;
        }

        if(interaction.options.get('amount').value < 100 && interaction.options.get('amount').value != 0) {
            interaction.reply({content: "Welp... That wager was too low. The minimum you can gamble is 100.", ephemeral: true});
            return;
        }

        for(var i = 0; i < gameState.length; i++) {
            if(gameState[i].playerId == interaction.user.id){
                gameState.splice(i, 1);
            }
        }
		game = new Game(interaction.user.id, interaction.options.get('amount').value);
        if(interaction.options.get('amount').value != 0) {
            var paid = await handlePayment(interaction.user.id, -Math.abs(interaction.options.get('amount').value));
        }else {
            var paid = true;
        }
        
        if(paid != true) {
            interaction.reply({content: "Welp... You are too broke to play based on the amount you entered.", ephemeral: true});
            return;
        }
        
        const embed = new MessageEmbed().setColor("#0099ff").setTitle('Blackjack').setDescription(interaction.user.username + ": " + game.printPlayerPublicHand() + "\n" + "House: " + game.printHousePublicHand());
        const playerEmbed = new MessageEmbed().setColor("#0099ff").setTitle('Your hand').setDescription(game.printPlayerHand());
        const row = new MessageActionRow().addComponents(
            new MessageButton().setCustomId("hit").setLabel("Hit").setStyle("PRIMARY"),
            new MessageButton().setCustomId("stand").setLabel("Stand").setStyle("DANGER"),
        );
        game.saveGame();
        await interaction.reply({ embeds:[embed], ephemeral: true });
        await interaction.followUp({ embeds:[playerEmbed], components: [row], ephemeral: true });
	},
};

module.exports.hit = hit;
module.exports.stand = stand;

async function handlePayment(playerId, balance) {
    var pool = mysql.createPool({
        connectionLimit: 10,
        host:'localhost',
        user:username,
        password:password,
        database:database
    });
    var date = new Date().toISOString().slice(0, 19).replace('T', ' ');

    return new Promise(function(resolve, reject){
        pool.query('INSERT IGNORE INTO `currency`(`id`) VALUES (?)', playerId);
        pool.query('SELECT * FROM `currency` WHERE id = ?', [playerId], function(error, results, fields) {
            resolve(results)
        });
    }).then(function(results){
        var playerBalance = results[0].balance + balance;
        if(balance > 0){
            pool.query('UPDATE `currency` SET `balance` = ? WHERE id = ?', [playerBalance, playerId]);
            pool.query('INSERT INTO transactions(`user_id`, `amount`, `date`, `source`) VALUES (?, ?, ?, ?)', [playerId, balance, date, "blackjack"]);
            return true;
        }
        if(playerBalance < 0) {
            return false;
        }
        pool.query('UPDATE `currency` SET `balance` = ? WHERE id = ?', [playerBalance, playerId]);
        pool.query('INSERT INTO transactions(`user_id`, `amount`, `date`, `source`) VALUES (?, ?, ?, ?)', [playerId, balance, date, "blackjack"]);
        return true;
    });
}

async function stand(interaction) {
    for(var i = 0; i < gameState.length; i++) {
        if(gameState[i].playerId == interaction.user.id) {
            var game = gameState[i];
            game.houseTurn();
            if(calculateWeight(game.getHouseHand()) > 21) {
                const embed = new MessageEmbed().setColor("#0099ff").setTitle(interaction.user.username + ' won! House went bust.').setDescription("You won: " + ((game.wager * rate) - game .wager) + " hidden bucks \n" + interaction.user.username + ": " + game.printPlayerHand() + "\n" + "House: " + game.printHouseHand());
                interaction.reply({ embeds:[ embed ] });
                gameState.splice(i, 1);
                handlePayment(interaction.user.id, (game.wager * rate));
                return;
            }
            if(calculateWeight(game.getPlayerHand()) > calculateWeight(game.getHouseHand())) {
                const embed = new MessageEmbed().setColor("#0099ff").setTitle(interaction.user.username + ' won! You had more points than house.').setDescription("You won: " + ((game.wager * rate) - game .wager) + " hidden bucks \n" + interaction.user.username + ": " + game.printPlayerHand() + "\n" + "House: " + game.printHouseHand());
                interaction.reply({ embeds:[ embed ] });
                gameState.splice(i, 1);
                handlePayment(interaction.user.id, (game.wager * rate));
                return;
            }
            if(calculateWeight(game.getPlayerHand()) == calculateWeight(game.getHouseHand())) {
                const embed = new MessageEmbed().setColor("#0099ff").setTitle(interaction.user.username + ' drew?').setDescription("Your payment of " + game.wager + " hidden bucks has been refunded. \n" + interaction.user.username + ": " + game.printPlayerHand() + "\n" + "House: " + game.printHouseHand());
                interaction.reply({ embeds:[ embed ] });
                gameState.splice(i, 1);
                handlePayment(interaction.user.id, game.wager);
                return;
            }
            const embed = new MessageEmbed().setColor("#0099ff").setTitle(interaction.user.username + ' lost... The house had more points.').setDescription("You lose: " + game.wager + " hidden bucks \n" + interaction.user.username + ": " + game.printPlayerHand() + "\n" + "House: " + game.printHouseHand());
            interaction.reply({ embeds:[ embed ] });
            gameState.splice(i, 1);
        }
    }
}

async function hit(interaction) {
    for(var i = 0; i < gameState.length; i++) {
        if(gameState[i].playerId == interaction.user.id) {
            var game = gameState[i];
            game.playerHit();
            var playerWeight = calculateWeight(game.getPlayerHand());
            if(playerWeight <= 20) {
                const embed = new MessageEmbed().setColor("#0099ff").setTitle('Blackjack').setDescription(interaction.user.username + ": " + game.printPlayerPublicHand() + "\n" + "House: " + game.printHousePublicHand());
                const playerEmbed = new MessageEmbed().setColor("#0099ff").setTitle('Your hand').setDescription(game.printPlayerHand());
                const row = new MessageActionRow().addComponents(
                    new MessageButton().setCustomId("hit").setLabel("Hit").setStyle("PRIMARY"),
                    new MessageButton().setCustomId("stand").setLabel("Stand").setStyle("DANGER"),
                );
                await interaction.reply({ embeds:[embed], ephemeral: true });
                await interaction.followUp({ embeds:[playerEmbed], components: [row], ephemeral: true });
            }else if(playerWeight == 21){
                const embed = new MessageEmbed().setColor("#0099ff").setTitle('Blackjack').setDescription(interaction.user.username + ": " + game.printPlayerPublicHand() + "\n" + "House: " + game.printHousePublicHand());
                const playerEmbed = new MessageEmbed().setColor("#0099ff").setTitle(interaction.user.username + '... Won?! I think they cheated.').setDescription("You stole: " + ((game.wager * rate) - game.wager) + " hidden bucks \n" + "You just got super lucky with that 21. \nYou had: " + game.printPlayerHand() + "\nHouse had: " + game.printHouseHand());
                gameState.splice(i, 1);
                handlePayment(interaction.user.id, (game.wager * rate));
                await interaction.reply({ embeds:[embed], ephemeral: true });
                await interaction.followUp({ embeds:[playerEmbed], ephemeral: false });
            }else {
                const embed = new MessageEmbed().setColor("#0099ff").setTitle('Blackjack').setDescription(interaction.user.username + ": " + game.printPlayerPublicHand() + "\n" + "House: " + game.printHousePublicHand());
                const playerEmbed = new MessageEmbed().setColor("#0099ff").setTitle(interaction.user.username + ' lost. What a loser.').setDescription("You lose: " + game.wager + " hidden bucks \n" + interaction.user.username + ": " + game.printPlayerHand() + "\n" + "House: " + game.printHouseHand());
                gameState.splice(i, 1);
                await interaction.reply({ embeds:[embed], ephemeral: true });
                await interaction.followUp({ embeds:[playerEmbed], ephemeral: false });
            }
        }
    }
}

function calculateWeight(hand) {
    var weight = 0;
    for(var j = 0; j < hand.length; j++) {
        weight += hand[j].weight;
    }

    for(var j = 0; j < hand.length; j++) {
        if(hand[j].value == "Ace"){
            if(weight > 21) {
                weight -= 10;
            }
        }
    }

    return weight;
}

class Deck {
    constructor() {
        var suits = ["Spades", "Hearts", "Diamonds", "Clubs"];
        var values = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King", "Ace"];
        this.cards = new Array();
        for (var i = 0 ; i < values.length; i++)
        {
            for(var x = 0; x < suits.length; x++)
            {
                var weight = parseInt(values[i]);
                if (values[i] == "Jack" || values[i] == "Queen" || values[i] == "King")
                    weight = 10;
                if (values[i] == "Ace")
                    weight = 11;
                this.cards.push(new Card(suits[x], values[i], weight));
            }
        }

        this.shuffle();
    }

    shuffle() {
        var m = this.cards.length, t, i;

        var amount = 208;

        while(amount) {
            if(m == 0){
                m = this.cards.length;
            }
            i = Math.floor(Math.random() * m--);

            t = this.cards[m];
            this.cards[m] = this.cards[i];
            this.cards[i] = t;
            amount--;
        }
    }
    
    drawCard(){
        var card = this.cards.pop();

        return card;
    }

    length(){
        return this.cards.length;
    }
}

class Card {
    constructor(suit, value, weight) {
        this.suit = suit;
        this.value = value;
        this.weight = weight;
    }
}

class Game {
    constructor(player, wager) {
        this.playerId = player;
        this.wager = wager;
        this.deck = new Deck();
        this.playerHand = new Array();
        this.houseHand = new Array();
        for(var i = 0; i < 2; i++) {
            this.playerHand.push(this.deck.drawCard());
            this.houseHand.push(this.deck.drawCard());
        }
    }

    houseTurn() {
        if(calculateWeight(this.houseHand) >= 17) return;
        this.houseHand.push(this.deck.drawCard());
        this.houseTurn();
    }

    playerHit(){
        this.playerHand.push(this.deck.drawCard());
    }

    househit(){
        this.houseHand.push(this.deck.drawCard());
    }

    printPlayerPublicHand(){
        var hand = "";
        for(var i = 0; i < this.playerHand.length; i++){
            if(i == 0){
                hand += this.playerHand[i].value + " of " + this.playerHand[i].suit + ", ";
            }else {
                hand += " HIDDEN,";
            }
        }
        return hand.slice(0, -1);
    }

    printPlayerHand(){
        var hand = "";
        for(var i = 0; i < this.playerHand.length; i++){
            hand += this.playerHand[i].value + " of " + this.playerHand[i].suit + ", ";
        }
        return hand.slice(0, -2);
    }

    printHousePublicHand(){
        var hand = "";
        for(var i = 0; i < this.houseHand.length; i++){
            if(i == 0){
                hand += this.houseHand[i].value + " of " + this.houseHand[i].suit + ", ";
            }else {
                hand += " HIDDEN";
            }
        }
        return hand;
    }

    printHouseHand(){
        var hand = "";
        for(var i = 0; i < this.houseHand.length; i++){
            hand += this.houseHand[i].value + " of " + this.houseHand[i].suit + ", ";
        }
        return hand.slice(0, -2);
    }

    getPlayerHand(){
        return this.playerHand;
    }

    getHouseHand(){
        return this.houseHand;
    }

    saveGame(playerId){
        for(var i = 0; i < gameState.length; i++) {
            if(gameState[i].playerId == playerId) {
                gameState[i] = this;
                return;
            }
        }
        gameState.push(this);
    }
}