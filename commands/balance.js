const { SlashCommandBuilder } = require('@discordjs/builders');
const { username, password, database } = require('../config.json');
var mysql = require('mysql');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('balance')
		.setDescription('Check your current balance.'),
	async execute(interaction) {
        var connection = mysql.createConnection({
            host:'localhost',
            user:username,
            password:password,
            database:database
        });
        connection.connect();

        connection.query('INSERT IGNORE INTO `currency`(`id`) VALUES (?)', [interaction.user.id]);

        connection.query('SELECT * FROM `currency` WHERE id = ?', [interaction.user.id], function(error, results, fields){
            interaction.reply({ content: `Your balance is: ${results[0].balance}`, ephemeral: false });
        });

        connection.end();
	},
};