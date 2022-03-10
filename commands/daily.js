const { SlashCommandBuilder } = require('@discordjs/builders');
const { username, password, database } = require('../config.json');
var mysql = require('mysql');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('daily')
		.setDescription('Grab your daily cash from the government..'),
	async execute(interaction) {
        var connection = mysql.createConnection({
            host:'localhost',
            user:username,
            password:password,
            database:database
        });
        const d = new Date();
        var giveDaily = false;
        connection.connect();
        connection.query('INSERT IGNORE INTO `currency`(`id`) VALUES (?)', [interaction.user.id]);
        connection.query('INSERT IGNORE INTO `daily`(`id`, `lastCheck`) VALUES (?, ?)', [interaction.user.id, d.getDate()-1]);
        connection.end();

        var pool = mysql.createPool({
            connectionLimit: 10,
            host:'localhost',
            user:username,
            password:password,
            database:database
        });

        pool.query('SELECT currency.id, currency.balance, daily.lastCheck FROM `currency` JOIN daily ON currency.id = daily.id WHERE currency.id = ?', interaction.user.id, function(error, results, fields){
            if(results[0].lastCheck == d.getDate()){
                interaction.reply("You've already had your daily cash. Don't be greedy.");
                return;
            }
            balance = results[0].balance + 100;
            pool.query('UPDATE `currency` SET `balance` = ? WHERE id = ?', [balance, interaction.user.id], function(error, users, fields){
                pool.query('UPDATE `daily` SET lastCheck = ? where id = ?', [d.getDate(), interaction.user.id]);
                interaction.reply("Your daily balance has been updated. Enjoy!");
            });
        });
	},
};