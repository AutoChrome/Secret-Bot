const { username, password, database } = require('../config.json');
var mysql = require('mysql');

class User {
    constructor(id) {
        this.connection = mysql.createConnection({
            host:'localhost',
            user:username,
            password:password,
            database:database
        });
        this.id = id;
        this.balance = 0;
    }

    getBalance() {
        this.connection.connect();
        this.connection.query('SELECT * FROM `currency` WHERE id = ?', this.id, function(error, results, fields){
            console.log(results);
            this.balance = results[0].balance;
        });
        this.connection.end();
    }

    setBalance(balance){
        connection.query('UPDATE `currency` SET `balance` = ? WHERE id = ?', [balance, interaction.user.id], function(error, results, fields) {
            console.log(results);
            if(results.affectedRows > 0) {
                interaction.reply("Your daily cash has been paid! Enjoy.");
            }
        });
        connection.query('UPDATE `daily` SET `lastCheck` = ? WHERE id = ?', [d.getDate(), interaction.user.id], function(error, results, fields){
            if(results.affectedRows > 0) {
                return;
            }
        });
    }
}

module.exports = User;