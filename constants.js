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

module.exports = {
    name: "constants"
};

module.exports.cmdChar = cmdChar;
module.exports.welcomeMessage = welcomeMessage;
module.exports.helpMessage = helpMessage;