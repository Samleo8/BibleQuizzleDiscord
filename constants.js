const Discord = require('discord.js');
const Format = require('./format.js');

module.exports = {
    name: "constants"
};

// Channels where welcome message would be sent
const welcomeChannels = ['quizzle', 'biblequizzle', 'game', 'games'];

// Welcome message
const welcomeMessage =
    `Welcome to Bible Quizzle, a fast-paced Bible trivia game similar to Quizzarium!\n\nTo begin the game, type ${Format.asCmdStr("start")} in the bot\'s private chat, or in the group. For more information and a list of all commands, type ${Format.asCmdStr("help")}`;

// Help message when !help is sent
const helpMessage =
    `Bible Quizzle is a fast-paced Bible trivia game. Once the game is started, the bot will send a question. Send in your open-ended answer and the bot will give you points for the right answer. The faster you answer, the more points you get! Each question has a 50 second timer, and hints will be given every 10 seconds. Alternatively, you can call for a ${Format.asCmdStr("hint")} but that costs points. Note that for all answers, numbers are in digit (0-9) form.\n\n` +
    `${Format.asCmdStr("start")} - Starts a new game.\n` +
    `${Format.asCmdStr("quick")} - Starts a quick game of 10 rounds with category \'all\'.\n` +
    `${Format.asCmdStr("hint")} - Shows a hint and fasts-forwards timing.\n` +
    `${Format.asCmdStr("next")} - Similar to /hint, except that if 2 or more people use this command, the question is skipped entirely.\n` +
    `${Format.asCmdStr("stop")} - Stops the game.\n` +
    `${Format.asCmdStr("ranking")} - Displays the global rankings (top 10), as well as your own.\n` +
    `${Format.asCmdStr("suggest")} - Suggest questions and answers for the game (external link)!\n` +
    `${Format.asCmdStr("eggs")} - Hmm, what could this be?\n` +
    `${Format.asCmdStr("help")} - Displays this help message.\n`;

// Quiz Categories
const categories = ["All", "Old Testament", "New Testament", "Gospels", "Prophets", "Miracles", "Exodus",
    "Kings/Judges"];

// Special RegEx stuff
const regex = {
    alphanum: new RegExp("[A-Z0-9]", "gi"),
    non_alphanum: new RegExp("[^A-Z0-9]", "gi")
};

// Suggestion form URL
const suggestURL = "https://forms.gle/aqZ3MK8QrBGzv9PEA";

// URL to GitHub repo
const githubURL = "https://github.com/Samleo8/BibleQuizzleDiscord";

// Logo
// TODO: Make one!
const logoImageURL = './img/logo.png';
const logoAttachment = new Discord.MessageAttachment(logoImageURL, 'logo.png');
const logoURL = "attachment://logo.png";

// Color for Embed
const embedColor = "BLUE";

// Footer text for embeds
const embedFooter = "© Samuel Leong | Created for CMU IVCF";

const ADMIN_ID = "383880031786762254";

// Settings for Quick Game
const quickGameSettings = {
    category: "all",
    rounds: 10
};

// Maximum time before reaction wait timeout
const maxTime = 5 * 60000; // NOTE: in milliseconds

// Export all constants
module.exports.cmdChar = Format.cmdChar;
module.exports.welcomeChannels = welcomeChannels;
module.exports.welcomeMessage = welcomeMessage;
module.exports.helpMessage = helpMessage;
module.exports.regex = regex;
module.exports.categories = categories;
module.exports.embedColor = embedColor;
module.exports.embedFooter = embedFooter;
module.exports.logoImageURL = logoImageURL;
module.exports.logoAttachment = logoAttachment;
module.exports.logoURL = logoURL;
module.exports.githubURL = githubURL;
module.exports.suggestURL = suggestURL;
module.exports.quickGameSettings = quickGameSettings;
module.exports.maxTime = maxTime;
module.exports.ADMIN_ID = ADMIN_ID;