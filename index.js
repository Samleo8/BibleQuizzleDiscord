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
    maxTime,
    githubURL,
    suggestURL,
    logoURL,
    quickGameSettings
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

    const isQuickText = (args.length == 1 && args[0] == 'quick') ? "quick " : "";

    msg.reply(
        `Starting ${isQuickText}game with category ${Format.asBoldStr(Game.category)} and ${Format.asBoldStr(Game.rounds.total)} rounds!`
    );

    nextQuestion(msg);
};

startQuickGame = (msg, args) => {
    if (Game.status.indexOf("active") != -1) return;

    Game.category = quickGameSettings.category;
    Game.rounds.total = quickGameSettings.rounds;
    args = ['quick'];

    startGame(msg, args);
}

// Next Question handler
nextQuestion = (msg, args) => {
    // Invalid state
    if (Game.status.indexOf("active") == -1 || Game.category == null || !questions.hasOwnProperty(Game.category))
        return;

    Game.status = "active";

    // Handling of rounds
    // Check if any user input, if not stop
    Game.rounds.current++;
    if (Game.rounds.current > Game.rounds.total) {
        stopGame(msg, args);
        return;
    }

    Game.idle.questions++;
    if (Game.idle.questions > Game.idle.threshold) {
        // log(Game.idle.questions + " " + Game.idle.threshold);
        stopGame(msg, args);
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
const catEmbed = new Discord.MessageEmbed()
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

    msg.reply(`Please choose a category or start a ${Format.asCmdStr("quick")} game:`, catEmbed);
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

const roundsEmbed = new Discord.MessageEmbed()
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
                            const msg = collected.first();
                            const clickedEmoji = msg.emoji.name;

                            console.info("User clicked on emoji:", clickedEmoji);
                            const clickedIndex = roundsEmojis.indexOf(clickedEmoji);

                            if (clickedIndex != -1) {
                                setRounds(sentEmbed, [roundsNumbers[clickedIndex]]);
                            }
                        })
                        .catch((err) => {
                            console.info(`${err}: No response after ${maxTime/1000}s`);
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
            msg.reply("Please choose a category first.", catEmbed);
        }
        else {
            msg.reply(
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

const hintEmoji = "❔";
const nextEmoji = "⏭️";

_showQuestion = (msg, questionText, categoriesText, hintText) => {
    // Build the question embed
    let questionEmbed = new Discord.MessageEmbed()
        .setAuthor("Bible Quizzle", logoURL, githubURL)
        .setTitle(`Question ${Game.rounds.current} of ${Game.rounds.total}`)

    questionEmbed.addField(
        questionText,
        `[${Format.asItalicStr(categoriesText)}]`
    );

    // Show hint text as code
    if (hintText != null) {
        questionEmbed.addField(`Hint ${Game.hints.current} of ${Game.hints.total}`, Format.asCodeStr(hintText),
            false);
    }

    // Help text
    questionEmbed.addField(`${hintEmoji} Need a hint?`,
        `Get a hint (lower score) by sending ${Format.asCmdStr("hint")} or clicking the ${hintEmoji} emoji below.`,
        true);
    questionEmbed.addField(`${nextEmoji} Want to skip?`,
        `Vote to skip by sending ${Format.asCmdStr("skip")} or clicking the ${nextEmoji} emoji below.\nIf ${Game.nexts.total} or more people vote to skip, this question will be skipped completely.`,
        true);

    // Send and react with emojis
    msg.reply(questionEmbed)
        .then(
            async (sentEmbed) => {
                // Enforce order
                try {
                    await sentEmbed.react(hintEmoji);
                    await sentEmbed.react(nextEmoji);

                    await sentEmbed.awaitReactions(
                            (reactions) => [hintEmoji, nextEmoji].includes(reactions.emoji.name), {
                                max: 1
                            })
                        .then((collected) => {
                            const msg = collected.first();
                            const clickedEmoji = msg.emoji.name;

                            if (clickedEmoji == hintEmoji) {
                                nextHint(msg, _);
                            }
                            else if (clickedEmoji == nextEmoji) {
                                nextCommand(msg, _);
                            }
                        })
                        .catch((err) => {
                            console.info(`${err}: No response after ${maxTime/1000}s`);
                        });
                }
                catch (err) {
                    console.error("One of the reactions failed: ", err);
                }
            }
        );
};

// TODO: Embedded thing for this
_showAnswer = (msg) => {
    const answerers = Library.removeDuplicates(Game.question.answerer);

    const answerEmbed = new Discord.MessageEmbed()
        .setAuthor("Bible Quizzle", logoURL, githubURL)
        .setTitle(`Results: Round ${Game.rounds.current} of ${Game.rounds.total}`)

    if (Game.question.answerer.length == 0) {
        answerEmbed.addField(
            `😥 Oh no, nobody got it right`,
            `💡 The answer was: ${Format.asItalicStr(_getAnswer())} 💡\n` +
            `${Format.asItalicStr("Bible Reference: " + _getReference())}`,
            false
        );
    }
    else {
        let scoreboardText = "";
        let score = Game.hints.points[Game.hints.current];
        for (i = 0; i < answerers.length; i++) {
            // TODO: may need to update API
            scoreboardText += `${Format.asBoldStr(answerers[i].name)} +${score}\n`;

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

        answerEmbed.addField(
            `✅ Correct!`,
            `💡 ${Format.asBoldStr(_getAnswer())} 💡\n` +
            Format.asItalicStr("Bible Reference: " + _getReference()),
            false
        );

        answerEmbed.addField(
            `🏅 Scorer(s) 🏅`,
            scoreboardText,
            false
        );
    }

    msg.reply(answerEmbed);

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

/*==================HINTS AND NEXTS===================*/
// Hint Handler
nextHint = (msg, args) => {
    if (Game.status != "active")
        return; // if it's `active_wait` also return because it means that there's no question at the point in time

    /*Total of 4 hints:
        - -1%    |    Only the question     |    100pts
        - 0%    |    No. of characters     |    -5pts
        - 20%    |    20% chars shown     |    -10pts
        - 50%    |    50% chars shown     |    -20pts
        - 80%    |     80% chars shown     |    -30pts
    */
    Game.hints.current++;
    Game.idle.reset();

    if (Game.hints.current >= Game.hints.total) {
        _showAnswer(msg);
        return;
    }

    // Display Question
    let questionText = _getQuestion();
    let categoriesText = _getCategories();
    let answerText = _getAnswer();

    // Hint generation
    let hint = Game.hints.text.split("");
    let hints_given = Game.hints.current;
    let r = 0,
        ind = 0;

    for (i = 0; i < Game.hints.charsToReveal[hints_given]; i++) {
        r = Library.getRandomInt(0, Game.hints.unrevealedIndex.length -
            1); // get random number to pick index `ind` from the `Game.hints.unrevealedIndex` array.

        if (Game.hints.unrevealedIndex.length <= 0) break;

        // get a random index `ind` so the character at `ind` will be revealed. pick from `unrevealedIndex` arrray so as to avoid repeat revealing and revealing of non-alphanumberic characters
        ind = Game.hints.unrevealedIndex[r];

        hint[ind] = answerText[ind]; // reveal character at index `ind`

        Game.hints.unrevealedIndex.splice(r, 1); // remove revealed character from `unrevealedIndex` array
    }
    hint = hint.join(" ")
        .toString();

    _showQuestion(msg, questionText, categoriesText, hint);

    Game.hints.text = hint; // save back into `Game` object

    // Create new handler every `interval` seconds
    clearTimeout(Game.timer);
    Game.timer = setTimeout(
        () => nextHint(msg, args),
        Game.interval * 1000
    );
};

// Next Command and Action (from inline buttons and keyboard)
nextCommand = (msg, args) => {
    if (Game.status != "active")
        return; // if it's `active_wait` also return because it means that there's no question at the point in time

    Game.idle.reset();

    // TODO: Get ID properly
    let id = (msg.callbackQuery == undefined || msg.callbackQuery.from == undefined || msg.callbackQuery.from.id ==
            undefined) ?
        msg.message.from.id : msg.callbackQuery.from.id;

    Game.nexts.current[id] = 1;

    if (Object.keys(Game.nexts.current)
        .length >= Game.nexts.total || msg.chat.type == "private")
        return _showAnswer(msg);

    return nextHint(msg, args);
};

/*================STOPPING AND SCORES===================*/
// TODO: Displaying of scores
displayScores = (msg) => {
    let scoreboardText = "";
    let scoreboardArr = [];

    // Push all stored info from `Game.leaderboard` into `scoreboardArr`
    for (i in Game.leaderboard) {
        if (!Game.leaderboard.hasOwnProperty(i)) continue;

        scoreboardArr.push(Game.leaderboard[i]);
    }

    const scoreEmbed = new Discord.MessageEmbed()
        .setAuthor("Bible Quizzle", logoURL, githubURL)
        .setTitle("Scores")
        .setDescription("");

    // Handler for when nobody played but the game is stopped
    if (scoreboardArr.length == 0) {
        scoreEmbed.addField(
            "⁉️ Everybody's a winner?!? ⁉️",
            "(\'cos nobody played... 😞)",
            false
        );
    }
    else {
        // Set global rankings and obtain appropriate text
        scoreboardText += _setGlobalRanking(scoreboardArr, msg);

        // Show the top scorers with a keyboard to start the game
        scoreEmbed.addField(
            "🏆 Top Scorers 🏆",
            scoreboardText,
            false
        );

        scoreEmbed.addField(
            "📋 Feedback",
            `Suggest more questions and answers [here](${suggestURL})`,
            true
        );

        scoreEmbed.addField(
            "📊 Rankings",
            `View your spot on the global ranking with ${Format.asCmdStr("ranking")}`,
            true
        );

        scoreEmbed.addField(
            "🎮 Play Again",
            `${Format.asCmdStr("start")} a new game or a ${Format.asCmdStr("quick")} one!`,
            true
        );
    }

    msg.reply(scoreEmbed);
};

// Stop Game function
stopGame = (msg) => {
    clearTimeout(Game.timer);

    if (Game.status.indexOf("active") != -1) displayScores(msg);

    resetGame();
    Game.status = "choosing_category";
};

/*==================MESSAGE HANDLING===================*/
// Other commands
bot.commands.set(cmdChar + "start", {
    execute: initGame
});

bot.commands.set(cmdChar + "quick", {
    execute: startQuickGame
});

bot.commands.set(cmdChar + "hint", {
    execute: nextHint
});

bot.commands.set(cmdChar + "next", {
    execute: nextCommand
});

bot.commands.set(cmdChar + "category", {
    execute: setCategory
});

bot.commands.set(cmdChar + "rounds", {
    execute: setRounds
});

bot.commands.set(cmdChar + "stop", {
    execute: stopGame
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
            msg.reply(
                `\`${command}\` is an invalid command. Send ${Format.asCmdStr("help")} for valid commands.`);
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
