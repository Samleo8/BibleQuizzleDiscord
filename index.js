/**
 * @brief NodeJS Discord Bot that is port of Telegram Bible Quizzle bot
 * @ref https: //www.sitepoint.com/discord-bot-node-js/
 * 
 * Uses discord.js
 */

// Setup
// TODO: remove when full deployment to heroku
require('dotenv')
    .config();

const fs = require('fs');

const Discord = require('discord.js');
const bot = new Discord.Client();

bot.commands = new Discord.Collection();
const botCommands = require('./commands');

// Get token from secret file
const TOKEN = process.env.BOT_TOKEN;
bot.login(TOKEN);

bot.on('ready', () => {
    console.info(`Logged in as ${bot.user.tag}!`);
});

// Get constants from file
const {
    cmdChar,
    welcomeMessage,
    categories,
    regex
} = require('./constants.js');

let i, j;

/*==================WELCOME MESSAGE===================*/
// Bot Commands
Object.keys(botCommands)
    .map(key => {
        bot.commands.set(cmdChar + botCommands[key].name, botCommands[key]);
    });

// Make Category Array from `categories`
let catEmbed = new Discord.MessageEmbed()
    .setTitle("Categories")
    .setDescription("Send a category with `!category <valid category>`");

// First row is single "All" button
catEmbed.addField(categories[0], "📖 Category: " + categories[0].toLowerCase(), false);

for (i = 1; i < categories.length; i++) {
    catEmbed.addField(categories[i], "📖 Category: " + categories[i].toLowerCase(), true);
}

// Initialise question object
let questions = {};
compileQuestionsList = () => {
    questions["all"] = JSON.parse(fs.readFileSync('questions.json', 'utf8'));

    let all_questions = questions["all"];

    for (i in all_questions) {
        let _cats = all_questions[i].categories;
        if (_cats == null) continue;

        for (j = 0; j < _cats.length; j++) {
            let _cat = _cats[j].toString();
            if (questions[_cat] === undefined) {
                // Key doesn't exist, create empty array
                questions[_cat] = [];
            }

            questions[_cat].push(all_questions[i]);
        }
    }
};

compileQuestionsList();

/*==================WELCOME MESSAGE===================*/

// Welcome message (if applicable)
bot.on('guildCreate', guild => {
    guild.channels.find('quizzle', 'game', 'games')
        .send(welcomeMessage);
})

// Message and Command handling
bot.on('message', (msg) => {
    const args = msg.content.split(/ +/);
    const command = args.shift()
        .toLowerCase();

    // Don't listen to bots
    if (msg.author.bot) return;

    // Commands
    if (msg.content.startsWith(cmdChar)) {
        console.info(`Called command: ${command}`);

        if (command == `${cmdChar}start`) {
            msg.reply(catEmbed);
        }
        else if (!bot.commands.has(command)) {
            msg.reply(`${command} is an invalid command. Send ${cmdChar}help for valid commands.`);
            return;
        }
        else {
            try {
                bot.commands.get(command)
                    .execute(msg, args);
            }
            catch (error) {
                console.error(error);
                msg.reply('Oops, there was an error trying to execute that command!');
            }
        }
    }
    // Normal message (game)
    else {
        // console.info("Read message");
    }
});
