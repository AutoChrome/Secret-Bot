const { SlashCommandBuilder } = require('@discordjs/builders');
const { username, password, database } = require('../config.json');
var mysql = require('mysql');
const { MessageEmbed } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('transactions')
		.setDescription('Show your recent transactions'),
	async execute(interaction) {
        var connection = mysql.createConnection({
            host:'localhost',
            user:username,
            password:password,
            database:database
        });
        connection.connect();

        connection.query('INSERT IGNORE INTO `currency`(`id`) VALUES (?)', [interaction.user.id]);

        connection.query('SELECT * FROM `transactions` WHERE `user_id` = ? ORDER BY date DESC LIMIT 5', [interaction.user.id], function(error, results, fields){
            var description = 'Source\n';
            var embeds = new MessageEmbed();
            embeds.setColor(getRandomColor());
            embeds.setTitle('Transactions');
            for(var i = results.length; i != 0; i--) {
                var transaction = results[i - 1];
                var date = new Date(transaction.date);
                var dateString = date.getFullYear() + "/" + date.getMonth() + "/" + date.getDay();
                var amount = String(transaction.amount);
                var repeat = 0;
                repeat += transaction.source.length;
                description += "**" + transaction.source + "**" + ".".repeat(30 - repeat) + amount + " " + dateString + "\n";
                embeds.addField("**" + transaction.source.charAt(0).toUpperCase() + transaction.source.slice(1) + "**", "Amount: " + amount + "\n Date: " + dateString, false);
            }
            interaction.reply({ embeds: [embeds], ephemeral: false });
        });

        connection.end();
	},
};

function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }