/**
 * @brief NodeJS Discord Bot that is port of Telegram Bible Quizzle bot
 * @ref https: //www.sitepoint.com/discord-bot-node-js/
 * 
 * Uses discord.js
 */
require('dotenv')
    .config();

// Setup
const Discord = require('discord.js');
const bot = new Discord.Client();

bot.commands = new Discord.Collection();
const botCommands = require('./commands');

// Get token from secret file
const TOKEN = process.env.TOKEN;

bot.login(TOKEN);

bot.on('ready', () => {
    console.info(`Logged in as ${bot.user.tag}!`);
});

// Bot Commands
const cmdChar = '!';

Object.keys(botCommands)
    .map(key => {
        bot.commands.set(cmdChar + botCommands[key].name, botCommands[key]);
    });

bot.on('message', (msg) => {
    const args = msg.content.split(/ +/);
    const command = args.shift()
        .toLowerCase();

    // TODO: Allow other message reading
    if (!bot.commands.has(command)) {
        console.info('Read message');
        return;
    }

    console.info(`Called command: ${command}`);

    try {
        bot.commands.get(command)
            .execute(msg, args);
    }
    catch (error) {
        console.error(error);
        msg.reply('there was an error trying to execute that command!');
    }
});
