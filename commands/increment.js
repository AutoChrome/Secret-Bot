const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('increment')
		.setDescription('Someone has done the wrong move again.'),
	async execute(interaction) {
		await interaction.reply('Pong!');
	},
};