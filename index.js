/**
 * @brief NodeJS Discord Bot that is port of Telegram Bible Quizzle bot
 * @ref https: //www.sitepoint.com/discord-bot-node-js/
 * 
 * Uses discord.js
 */

// Setup
require('dotenv')
    .config();
const fs = require('fs');

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

// Help Messages
const cmdChar = '!';

const welcomeMessage =
    `Welcome to Bible Quizzle, a fast-paced Bible trivia game similar to Quizzarium!\n\nTo begin the game, type !start in the bot\'s private chat, or in the group. For more information and a list of all commands, type ${cmdChar}help`;

const helpMessage =
    `Bible Quizzle is a fast-paced Bible trivia game. Once the game is started, the bot will send a question. Send in your open-ended answer and the bot will give you points for the right answer. The faster you answer, the more points you get! Each question has a 50 second timer, and hints will be given every 10 seconds. Alternatively, you can call for a /hint but that costs points. Note that for all answers, numbers are in digit (0-9) form.\n\n` +
    `${cmdChar}start - Starts a new game.\n` +
    `${cmdChar}quick - Starts a quick game of 10 rounds with category \'all\'.\n` +
    `${cmdChar}hint - Shows a hint and fasts-forwards timing.\n` +
    `${cmdChar}next - Similar to /hint, except that if 2 or more people use this command, the question is skipped entirely.\n` +
    `${cmdChar}stop - Stops the game.\n` +
    `${cmdChar}ranking - Displays the global rankings (top 10), as well as your own.\n` +
    `${cmdChar}suggest - Suggest questions and answers for the game (external link)!\n` +
    `${cmdChar}eggs - Hmm, what could this be?\n` +
    `${cmdChar}help - Displays this help message.\n`;

    // Bot Commands
Object.keys(botCommands)
    .map(key => {
        bot.commands.set(cmdChar + botCommands[key].name, botCommands[key]);
    });

bot.on('message', (msg) => {
    const args = msg.content.split(/ +/);
    const command = args.shift()
        .toLowerCase();

    // Don't listen to bots
    if (msg.author.bot) return;

    console.info(`Called command: ${command}`);

    // TODO: Allow other message reading
    if (!bot.commands.has(command)) {
        // console.info('Read message');
        return;
    }

    try {
        bot.commands.get(command)
            .execute(msg, args);
    }
    catch (error) {
        console.error(error);
        msg.reply('there was an error trying to execute that command!');
    }
});
