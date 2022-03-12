const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('blackjack')
		.setDescription('Test command'),
	async execute(interaction) {
        
		game = new Game(interaction.user.id);
	},
};

class Deck {
    constructor() {
        var suits = ["Spades", "Hearts", "Diamonds", "Clubs"];
        var values = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
        this.cards = new Array();
        for (var i = 0 ; i < values.length; i++)
        {
            for(var x = 0; x < suits.length; x++)
            {
                var weight = parseInt(values[i]);
                if (values[i] == "J" || values[i] == "Q" || values[i] == "K")
                    weight = 10;
                if (values[i] == "A")
                    weight = 11;
                this.cards.push(new Card(suits[x], values[i], weight));
            }
        }

        this.shuffle();
    }

    shuffle() {
        var m = this.cards.length, t, i;

        while(m) {
            i = Math.floor(Math.random() * m--);

            t = this.cards[m];
            this.cards[m] = this.cards[i];
            this.cards[i] = t;
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
    constructor(player) {
        this.playerId = player;
        this.deck = new Deck();
        this.playerHand = new Array();
        this.houseHand = new Array();
        for(var i = 0; i < 2; i++) {
            this.playerHand.push(this.deck.drawCard());
            this.houseHand.push(this.deck.drawCard());
        }
        console.log(this.playerHand);
        console.log(this.deck.length());
    }
}