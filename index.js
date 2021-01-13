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

module.exports = {
    name: "biblequizzle"
};

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

// Load libraries and other files
const Library = require('./index.lib.js');
const Format = require('./format.js');

// Get constants from file
const {
    cmdChar,
    welcomeMessage,
    welcomeChannels,
    categories,
    regex,
    maxTime
} = require('./constants.js');

let i, j;

/*==================WELCOME MESSAGE===================*/
// Bot Commands
// From ./commands folder
Object.keys(botCommands)
    .map(key => {
        bot.commands.set(cmdChar + botCommands[key].name, botCommands[key]);
    });

// NOTE: Other commands at the end

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

/*================ACTUAL GAMEPLAY=================*/
// Initialise Game object
let Game;
module.exports.Game = Game;

resetGame = () => {
    let previousQuestionList = [];
    if (Game != null && Game.hasOwnProperty("question") && Game.question.hasOwnProperty("id_list")) {
        previousQuestionList = Game.question.id_list;
    }

    Game = {
        "status": "choosing_category", // choosing_category, choosing_rounds, active_wait, active
        "category": null,
        "rounds": {
            "current": 0,
            "total": 10
        },
        "question": {
            "id": 0, // id of question
            "id_list": [], // store all the question ids to prevent repeat
            "answerer": [] // person who answered the question: [ persons' name ] | [] (skipped)
        },
        "hints": {
            "text": "",
            "current": 0,
            "total": 4,
            "charsToReveal": [],
            "unrevealedIndex": [],
            "points": [10, 8, 5, 3, 1]
        },
        "nexts": {
            "current": {}, // object of people who put next
            "total": 2
        },
        "timer": null,
        "interval": 10, // in seconds
        "leaderboard": {},
        "global_leaderboard": null,
        "idle": {
            "questions": 0, // number of questions for which there is no user input
            "threshold": 3, // number of questions before terminating game
            "reset": function() {
                this.questions = 0;
            }
        }
    };

    Game.question.id_list = previousQuestionList;
};

resetGame();

// Start Game function
startGame = (msg, args) => {
    Game.status = "active";
    Game.rounds.current = 0;
    Game.idle.reset();

    msg.reply(
        `Starting game with category ${Format.asBoldStr(Game.category)} and ${Format.asBoldStr(Game.rounds.total)} rounds!`);

    nextQuestion(msg);
};

// Next Question handler
nextQuestion = (msg) => {
    console.log("Game started");

    // Invalid state
    if (Game.status.indexOf("active") == -1 || Game.category == null || !questions.hasOwnProperty(Game.category))
        return;

    Game.status = "active";

    // Handling of rounds
    // Check if any user input, if not stop
    Game.rounds.current++;
    if (Game.rounds.current > Game.rounds.total) {
        stopGame(msg);
        return;
    }

    Game.idle.questions++;
    if (Game.idle.questions > Game.idle.threshold) {
        // log(Game.idle.questions + " " + Game.idle.threshold);
        stopGame(msg);
    }

    // Handling of question selection
    if (Game.question.id_list.length == 0) {
        // log("Reloading questions for category " + Game.category);

        // Populate the id_list array with to now allow for repeats again
        for (i = 0; i < questions[Game.category].length; i++) {
            Game.question.id_list.push(i);
        }
    }

    let id_ind = Library.getRandomInt(0, Game.question.id_list.length - 1);
    Game.question.id = Game.question.id_list[id_ind];
    Game.question.id_list.splice(id_ind, 1);

    // Reset nexts and hints

    /*Total of 4 hints:
        - -1%    |    Only the question     |    10pts
        - 0%    |    No. of characters     |    8pts
        - 20%    |    20% chars shown     |    5pts
        - 50%    |    50% chars shown     |    3pts
        - 80%    |     80% chars shown     |    1pts
    */

    Game.nexts.current = {};
    Game.hints.current = 0;

    Game.question.answerer = [];

    // Settings no. of chars to reveal for each hint interval
    let answer = _getAnswer();
    let hints_array = [0, 0, 0.2, 0.5, 0.8]; // base percentage, starting index from 1
    for (i = 2; i < hints_array.length; i++) {
        // -Getting total number of alpha-numeric characters revealed in hint
        hints_array[i] = Math.floor(hints_array[i] * answer.match(regex.alphanum)
            .length);

        // -Getting total number of NEW characters that'll need to be revealed in this hint
        hints_array[i] -= hints_array[i - 1];
    }
    Game.hints.charsToReveal = hints_array;

    // Setting indexes in answer that needs to be revealed
    Game.hints.unrevealedIndex = [];
    for (i = 0; i < answer.length; i++) {
        if (answer[i].match(regex.alphanum)) { // ie is alphanumberic
            Game.hints.unrevealedIndex.push(i);
        }
    }

    // Set hint as all underscores
    Game.hints.text = answer.replace(regex.alphanum, "_");

    // Display Question
    let questionText = _getQuestion();
    let categoriesText = _getCategories();

    _showQuestion(msg, questionText, categoriesText);

    // Handling of timer: Hint handler every `interval` seconds
    clearTimeout(Game.timer);
    Game.timer = setTimeout(
        () => nextHint(msg),
        Game.interval * 1000
    );
};

// ================UI FOR START AND CHOOSING OF CATEGORIES/ROUNDS=================// 
let initGame = (msg, _) => {
    // Set category
    // console.log("Pick a category: ", categories);

    switch (Game.status) {
        case "active":
        case "active_wait":
            return msg.reply(`A game is already in progress. To stop the game, type ${Format.asCmdStr("stop")}`);
        case "choosing_cat":
        case "choosing_category":
            resetGame();
            return chooseCategory(msg);
        case "choosing_rounds":
            return chooseRounds(msg);
        default:
            Game.status = "choosing_category";
            return;
    }
};

// Make Category Embed from `categories`
let catEmbed = new Discord.MessageEmbed()
    .setTitle("Categories")
    .setDescription("Choose a valid category with `!category <valid category name>`");

// First row is single "All" button
// catEmbed.addField('\u200B', '\u200B', false); //empty line
catEmbed.addField(categories[0], "📖`" + categories[0].toLowerCase()
    .replace(regex.non_alphanum, "_") + "`", false);

for (i = 1; i < categories.length; i++) {
    catEmbed.addField(categories[i], "📖`" + categories[i].toLowerCase()
        .replace(regex.non_alphanum, "_") + "`", true);
}

let chooseCategory = (msg, _) => {
    Game.status = 'choosing_category';

    msg.reply("Please choose a category:", catEmbed);
};

let setCategory = (msg, args) => {
    if (Game.status != "choosing_category") {
        msg.reply("A game is already in progress!");
        return;
    }

    if (args.length < 1) {
        msg.reply("Please choose a proper category:", catEmbed);
        return;
    }

    const heardString = args.join(" ");
    const newCategory = heardString.toLowerCase()
        .replace(regex.non_alphanum, "_");

    if (newCategory == null || !questions.hasOwnProperty(newCategory)) {
        msg.reply(`Invalid category *${heardString}*. Please choose a proper one:`, catEmbed);
        return;
    }

    // Different category: reset list
    if (newCategory != Game.category) {
        // log("Question reset for category " + newCategory);
        Game.question.id_list = [];
    }

    Game.category = newCategory;

    msg.reply(`Category *${heardString}* chosen!`);
    chooseRounds(msg);
};

const roundsEmojis = ["🕐", "🕑", "🕔", "🕙"];
const roundsNumbers = [10, 20, 50, 100];

let roundsEmbed = new Discord.MessageEmbed()
    .setTitle("Rounds")
    .setDescription(
        `Choose number of rounds/questions with ${Format.asCmdStr("rounds <number of rounds>")}\nOr click one of the emojis below.`
    );

for (i in roundsNumbers) {
    roundsEmbed.addField(`${roundsEmojis[i]} ${roundsNumbers[i]}`, `${roundsNumbers[i]} Rounds`, true);
}

roundsEmbed.addField("Note", "Number of rounds should be an integer >= 1", false);

let _sendRoundsEmbed = (msg, str) => {
    msg.reply(str, roundsEmbed)
        .then(
            async (sentEmbed) => {
                // Enforce order
                try {
                    for (ii in roundsEmojis)
                        await sentEmbed.react(roundsEmojis[ii]);

                    await sentEmbed.awaitReactions(
                            (reactions) => roundsEmojis.includes(reactions.emoji.name), {
                                max: 1,
                                time: maxTime
                            })
                        .then((collected) => {
                            const ctx = collected.first();
                            const clickedEmoji = ctx.emoji.name;

                            console.info("User clicked on emoji:", clickedEmoji);
                            setRounds(sentEmbed, [
                                roundsNumbers[roundsEmojis.indexOf(clickedEmoji)]
                            ]);
                        })
                        .catch((err) => {
                            console.error(err);
                            console.info(`No response after ${maxTime/1000}s`);
                        });
                }
                catch (err) {
                    console.error("One of the reactions failed: ", err);
                }
            }
        );
};

let chooseRounds = (msg, _) => {
    Game.status = 'choosing_rounds';

    _sendRoundsEmbed(msg, "Please choose the number of rounds/questions:");
};

let setRounds = (msg, args) => {
    if (Game.status != "choosing_rounds") {
        if (Game.status == "choosing_category") {
            ctx.reply("Please choose a category first.", catEmbed);
        }
        else {
            ctx.reply(
                `Game is currently in progress. To stop the game and start a new one, first send ${Format.asCmdStr("stop")}`
            );
        }
        return;
    }

    let numRounds = args[0];
    if (isNaN(numRounds)) {
        _sendRoundsEmbed(msg, "Invalid: Specify a positive integer");
        return;
    }

    numRounds = parseInt(numRounds);
    if (numRounds <= 0) {
        _sendRoundsEmbed(msg, "Invalid: Number of rounds should be >= 1");
        return;
    }

    Game.rounds.total = numRounds;

    startGame(msg, args);
}

// ================UI FOR QUESTIONS, ANSWERS AND SCORES=================// 
_getQuestion = () => {
    if (Game.category != null && Game.question.id != null) {
        return questions[Game.category][Game.question.id]["question"].toString();
    }

    return "";
};

_getCategories = () => {
    if (Game.category != null && Game.question.id != null) {
        return questions[Game.category][Game.question.id]["categories"].join(", ")
            .split("kings_judges")
            .join("Kings and Judges")
            .split("_")
            .join(" ")
            .toString()
            .toTitleCase();
    }

    return "";
};

_getAnswer = () => {
    if (Game.category != null && Game.question.id != null)
        return questions[Game.category][Game.question.id]["answer"].toString();

    return "";
};

_getReference = () => {
    if (Game.category != null && Game.question.id != null) {
        let _q = questions[Game.category][Game.question.id]["reference"];
        if (_q != null)
            return _q.toString();
    }

    return "-nil-";
};

// Get user's name from msg
_getName = (msg) => {
    return msg.author.username;
};

// TODO: Embedded thing for this
_showQuestion = (msg, questionText, categoriesText, hintText) => {
    let questionEmbed = new Discord.MessageEmbed()
        .setAuthor("Bible Quizzle", "", githubURL)
        .setTitle(`Question ${Game.rounds.current} of ${Game.rounds.total}`)
        .setDescription(
            `[${Format.asItalicStr(categoriesText)}] ${questionText}`
        );

    if (hintText == null) {
        questionEmbed.addField();
    }
};

_showAnswer = (msg) => {
    let answerers = Library.removeDuplicates(Game.question.answerer);

    if (Game.question.answerer.length == 0) {
        msg.reply(
            "😥 <b>Oh no, nobody got it right!</b>\n" +
            "💡 The answer was: <i>" + _getAnswer() + "</i> 💡\n" +
            "<i>Bible Reference: " + _getReference() + "</i>",
            Extra.HTML()
        );
    }
    else {
        let scoreboardText = "";
        let score = Game.hints.points[Game.hints.current];
        for (i = 0; i < answerers.length; i++) {
            scoreboardText += "<b>" + answerers[i].name + "</b> +" + score + "\n";

            // Update leaderboard
            if (Game.leaderboard[answerers[i].user_id] === undefined) {
                // Player doesn't exist in scoreboard, create empty object
                Game.leaderboard[answerers[i].user_id] = {
                    "id": answerers[i].user_id,
                    "score": 0, // score set at 0
                    "name": answerers[i].name
                };
            }

            Game.leaderboard[answerers[i].user_id].score = parseInt(Game.leaderboard[answerers[i].user_id].score +
                score);
        }

        msg.reply(
            "✅ Correct!\n" +
            "💡 <b>" + _getAnswer() + "</b> 💡\n" +
            "<i>Bible Reference: " + _getReference() + "</i>\n\n" +
            "🏅 <b>Scorer(s)</b> 🏅\n" +
            scoreboardText,
            Extra.HTML()
        );
    }

    if (Game.rounds.current >= Game.rounds.total) {
        stopGame(msg);
        return;
    }

    Game.status = "active_wait";

    // Question shows after less time?
    clearTimeout(Game.timer);
    Game.timer = setTimeout(
        () => nextQuestion(msg),
        Game.interval * 1000 * 0.5
    );
};

/*==================MESSAGE HANDLING===================*/
// Other commands
bot.commands.set(cmdChar + "start", {
    execute: initGame
});

bot.commands.set(cmdChar + "category", {
    execute: setCategory
});

bot.commands.set(cmdChar + "rounds", {
    execute: setRounds
});

// Welcome message (if applicable)
let trySendWelcome = (channel) => {
    if (channel.type === "text") {
        const channelName = channel.name.replace(regex.non_alphanum, "");
        if (welcomeChannels.includes(channelName)) {
            const permissions = channel.permissionsFor(bot.user);
            if (permissions.has("VIEW_CHANNEL") && permissions.has("SEND_MESSAGES")) {
                channel.send(welcomeMessage);
                return true;
            }
        }
    }

    return false;
};

bot.on('guildCreate', (guild) => {
    let found = false;
    guild.channels.cache.map((channel) => {
        if (found) return;

        found = trySendWelcome(channel);
    });
});

bot.on("channelCreate", trySendWelcome);

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

        if (!bot.commands.has(command)) {
            msg.reply(`\`${command}\` is an invalid command. Send ${Format.asCmdStr("help")} for valid commands.`);
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
