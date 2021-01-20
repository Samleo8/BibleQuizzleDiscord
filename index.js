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

module.exports = {
    name: "biblequizzle",
    bot: bot
};

bot.commands = new Discord.Collection();
const botCommands = require('./commands');

// Get token from secret file
const TOKEN = process.env.BOT_TOKEN;
bot.login(TOKEN);

let adminUser;

bot.on('ready', () => {
    console.info(`Logged in as ${bot.user.tag}!`);

    // Fetch the ADMIN ID and store in cache immediately
    bot.users.fetch(ADMIN_ID)
        .then((user) => {
            adminUser = user;
        });
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
    quickGameSettings,
    embedColor,
    embedFooter,
    logoAttachment,
    ADMIN_ID
} = require('./constants.js');
const {
    asStrikeThroughStr
} = require('./format.js');

let i, j;

// Template Embed
const templateEmbed = new Discord.MessageEmbed()
    .setColor(embedColor)
    .attachFiles(logoAttachment)
    // .setURL(githubURL)
    .setAuthor("Bible Quizzle", logoURL, githubURL)
    .setThumbnail(logoURL)
    .setFooter(embedFooter)
    .setTimestamp()

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
        "global_leaderboard": [],
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
        // console.log(Game.idle.questions + " " + Game.idle.threshold);
        stopGame(msg, args);
    }

    // Handling of question selection
    if (Game.question.id_list.length == 0) {
        // console.log("Reloading questions for category " + Game.category);

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
        () => nextHint(msg, args),
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
// NOTE: catEmojis is over populated
const catEmojis = ['📖', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🅰️', '🅱'];
const catEmbed = new Discord.MessageEmbed(templateEmbed)
    .setTitle("Categories")
    .setDescription(
        "Choose a valid category with `!category <valid category name>` or by clicking the associated emoji below");
const categoriesAsCode = [];

// First row is single "All" button
// Dynamically reate categories as code array as well as the catEmbed fields
for (i = 0; i < categories.length; i++) {
    categoriesAsCode.push(
        categories[i].toLowerCase()
        .replace(regex.non_alphanum, "_")
    );

    catEmbed.addField(
        catEmojis[i] + " " + categories[i],
        Format.asCodeStr(categoriesAsCode[i]),
        (i != 0) // first line is non-inline
    );
}

let _sendCatEmbed = (msg, str) => {
    msg.reply(str, catEmbed)
        .then(
            async (sentEmbed) => {
                // Enforce order
                try {
                    const filter =
                        (reactions, user) => {
                            return catEmojis.includes(reactions.emoji.name) && !user.bot;
                        };

                    const collector = sentEmbed.createReactionCollector(filter, {
                        max: 1,
                        time: maxTime
                    });

                    collector.on('collect', (reaction, user) => {
                        const clickedEmoji = reaction.emoji.name;

                        console.info("User", user.username, "reacted with:", clickedEmoji);
                        const clickedIndex = catEmojis.indexOf(clickedEmoji);

                        if (clickedIndex != -1) {
                            setCategory(sentEmbed, [categoriesAsCode[clickedIndex]]);
                        }
                    });

                    collector.on('end', (reaction, user) => {
                        console.info(`Either hit max responses or no responses after ${maxTime/1000}s`);
                    });

                    // Bot will send the reactions at the end
                    for (ii = 0; ii < categories.length; ii++)
                        await sentEmbed.react(catEmojis[ii]);
                }
                catch (err) {
                    console.error("One of the reactions failed: ", err);
                }
            }
        );
};

let chooseCategory = (msg, _) => {
    Game.status = 'choosing_category';

    _sendCatEmbed(msg, `Please choose a category or start a ${Format.asCmdStr("quick")} game:`);
};

let setCategory = (msg, args) => {
    if (Game.status != "choosing_category") {
        msg.reply("A game is already in progress!");
        return;
    }

    if (args.length < 1) {
        _sendCatEmbed(msg, "Please choose a proper category:");
        return;
    }

    const heardString = args.join(" ");
    const newCategory = heardString.toLowerCase()
        .replace(regex.non_alphanum, "_");

    if (newCategory == null || !questions.hasOwnProperty(newCategory)) {
        _sendCatEmbed(msg, `Invalid category *${heardString}*. Please choose a proper one:`);
        return;
    }

    // Different category: reset list
    if (newCategory != Game.category) {
        // console.log("Question reset for category " + newCategory);
        Game.question.id_list = [];
    }

    Game.category = newCategory;

    msg.reply(`Category ${Format.asBoldStr(heardString)} chosen!`);
    chooseRounds(msg);
};

const roundsEmojis = ["🕐", "🕑", "🕔", "🕙"];
const roundsNumbers = [10, 20, 50, 100];

const roundsEmbed = new Discord.MessageEmbed(templateEmbed)
    .setTitle("Rounds")
    .setDescription(
        `Choose number of rounds/questions with ${Format.asCmdStr("rounds <number of rounds>")}\n` +
        "Or click one of the emojis below."
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
                    const filter =
                        (reactions, user) => {
                            return roundsEmojis.includes(reactions.emoji.name) && !user.bot;
                        };

                    const collector = sentEmbed.createReactionCollector(filter, {
                        max: 1,
                        time: maxTime
                    });

                    collector.on('collect', (reaction, user) => {
                        const clickedEmoji = reaction.emoji.name;

                        console.info("User", user.username, "reacted with:", clickedEmoji);
                        const clickedIndex = roundsEmojis.indexOf(clickedEmoji);

                        if (clickedIndex != -1) {
                            setRounds(sentEmbed, [roundsNumbers[clickedIndex]]);
                        }
                    });

                    collector.on('end', (reaction, user) => {
                        console.info(`Either hit max responses or no repsonses after ${maxTime/1000}s`);
                    });

                    // Bot will send reactions
                    for (ii in roundsEmojis)
                        await sentEmbed.react(roundsEmojis[ii]);
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

_getUserID = (msg) => {
    return msg.author.id;
}

const hintEmoji = "❔";
const nextEmoji = "⏭️";

_showQuestion = (msg, questionText, categoriesText, hintText) => {
    // Build the question embed
    let questionEmbed = new Discord.MessageEmbed(templateEmbed)
        .setTitle(`Question ${Game.rounds.current} of ${Game.rounds.total}`)

    questionEmbed.addField(
        questionText,
        `[${Format.asItalicStr(categoriesText)}]`
    );

    // Show hint text as code
    if (hintText != null) {
        const hintTextFormatted = hintText.split("")
            .join(" ");

        questionEmbed.addField(`Hint ${Game.hints.current} of ${Game.hints.total}`, Format.asCodeStr(
                hintTextFormatted),
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
                    const filter =
                        (reactions, user) => {
                            return [hintEmoji, nextEmoji].includes(reactions.emoji.name) &&
                                !user.bot
                        };

                    const questionWaitTime = Game.interval * 1.5 * 1000; // a bit extra time
                    const collector = sentEmbed.createReactionCollector(filter, {
                        max: Game.nexts.total,
                        time: questionWaitTime
                    });

                    collector.on('collect', (reaction, user) => {
                        const clickedEmoji = reaction.emoji.name;
                        console.info("User", user.username, "reacted with:", clickedEmoji);

                        const newArgs = {
                            "author": user,
                        };

                        if (clickedEmoji == hintEmoji) {
                            nextHintForced(msg, newArgs);
                        }
                        else if (clickedEmoji == nextEmoji) {
                            nextCommand(msg, newArgs);
                        }
                    });

                    collector.on('end', (reaction, user) => {
                        console.info(
                            `Either hit max responses, or no response after ${questionWaitTime/1000}s`
                        );
                    });

                    // Bot sends reactions after collectors initialised
                    await sentEmbed.react(hintEmoji);
                    await sentEmbed.react(nextEmoji);
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

    const answerEmbed = new Discord.MessageEmbed(templateEmbed)
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
            const answererName = answerers[i].name;
            const answererID = answerers[i].id;

            scoreboardText += `${Format.asBoldStr(answererName)} +${score}\n`;

            // Update leaderboard
            if (Game.leaderboard[answererID] === undefined) {
                // Player doesn't exist in scoreboard, create empty object
                Game.leaderboard[answererID] = {
                    "id": answererID,
                    "score": 0, // score set at 0
                    "name": answererName
                };
            }

            Game.leaderboard[answererID].score = parseInt(Game.leaderboard[answererID].score + score);
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
nextHintForced = (msg, args) => {
    // NOTE: args can either be from a message command or from an emoji click
    let username;

    if (args.length != undefined) console.log(args.length, args.has("username"));

    if (args != null && args.length != undefined && args.has("username")) {
        username = args.username;
    }
    else {
        username = _getName(msg);
    }

    msg.reply(`${username} asked for a ${Format.asCmdStr("hint")}`);

    nextHint(msg, args);
}

// Hint Handler
nextHint = (msg, args) => {
    if (Game.status != "active")
        return; // if it's `active_wait` also return because it means that there's no question at the point in time

    // Clear timeout first
    clearTimeout(Game.timer);

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

        // remove revealed character from `unrevealedIndex` array
        Game.hints.unrevealedIndex.splice(r, 1);
    }
    hint = hint.join("")
        .toString();

    _showQuestion(msg, questionText, categoriesText, hint);

    Game.hints.text = hint; // save back into `Game` object

    // Create new handler every `interval` seconds
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

    let id, username;
    if (args != null && args.length != undefined && args.hasOwnProperty("author")) {
        id = _getUserID(args);
        username = _getName(args);
    }
    else {
        id = _getUserID(msg);
        username = _getName(msg);
    }

    msg.reply(`${username} voted to ${Format.asCmdStr("skip")}`);

    Game.nexts.current[id] = 1;

    if (Object.keys(Game.nexts.current)
        .length >= Game.nexts.total || msg.guild === null)
        return _showAnswer(msg);

    // TODO: To show hint or not to show?
    // return nextHint(msg, args);
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

    const scoreEmbed = new Discord.MessageEmbed(templateEmbed)
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

//--Sort Leaderboard
_sortLeaderboard = () => {
    Game.global_leaderboard.sort(function(a, b) {
        return b.score - a.score;
    });
};

// --Get global ranking
_getGlobalRanking = () => {
    // Check if file exists; if not, create it to prevent problems with access permissions
    if (!fs.existsSync("leaderboard.json")) {
        console.log("leaderboard.json doesn't exist... creating file..");

        fs.writeFileSync(
            'leaderboard.json',
            JSON.stringify(Game.global_leaderboard, null, 4)
        );

        console.log("File leaderboard.json created!");
        return Game.global_leaderboard;
    }

    // Retrieve data from leaderboard.json
    Game.global_leaderboard = JSON.parse(fs.readFileSync('leaderboard.json', 'utf8'));

    return Game.global_leaderboard;
};

// --Get ranking of individual user by `user_id`
_getRanking = (user_id, msg) => {
    // First retrieve array data from leaderboard.json
    _getGlobalRanking();

    if (user_id == null) return;

    // Find the user's data in the array
    let ind = Game.global_leaderboard.findIndex((item, i) => {
        return item.id == user_id;
    });

    if (ind == -1) {
        // Data of user doesn't exist:
        // Add it to the leaderboard array
        const user_name = (Game.leaderboard != null && Game.leaderboard.hasOwnProperty(user_id)) ? Game.leaderboard[
            user_id].name : _getName(msg);

        Game.global_leaderboard.push({
            "id": user_id,
            "name": user_name,
            "score": 0
        });

        // Sort and save
        _sortLeaderboard();

        let data = JSON.stringify(Game.global_leaderboard, null, 4);

        console.log("Global leaderboard: " + data);

        fs.writeFileSync('leaderboard.json', data);

        console.log("File written for new user " + user_id + ", data: " + data);

        // Return new index
        ind = Game.global_leaderboard.findIndex((item, i) => {
            return item.id == user_id;
        });

        return ind;
    }
    else {
        return ind;
    }
};

// --Update leaderboard for user `user_id` with score `score`
_setRankingIndividual = (user_id, score, msg) => {
    if (user_id == null) return;

    let ind = _getRanking(user_id, msg);

    // Change score
    if (!isNaN(parseInt(score)) && !isNaN(parseInt(ind))) {
        Game.global_leaderboard[ind].score += score;
    }
};

// Set multiple rankings at once to save time on constantly sorting
// Also generate the output text
_setGlobalRanking = (scoreboardArr, msg) => {
    let scoreboardText = "";

    // First sort the top scorers from `scoreboardArr` in descending order (highest score first)
    scoreboardArr.sort(function(a, b) {
        return b.score - a.score;
    });

    // Then loop through sorted scoreboard array to set individual ranking
    for (i = 0; i < scoreboardArr.length; i++) {
        scoreboardText += Format.asBoldStr(
                parseInt(i + 1) + ". " + scoreboardArr[i].name
            ) +
            Format.asItalicStr(
                "(" + scoreboardArr[i].score + " points)"
            ) + "\n";

        _setRankingIndividual(scoreboardArr[i].id, scoreboardArr[i].score, msg);
    }

    // Sort and save
    _sortLeaderboard();

    fs.writeFileSync(
        'leaderboard.json',
        JSON.stringify(Game.global_leaderboard, null, 4)
    );

    // TODO: Fix issue #15, then remove
    _sendAdminJSONRanking(msg);

    return scoreboardText;
};

// TODO: Ranking text
_showRanking = (msg, args) => {
    let ind = _getRanking(_getUserID(msg), msg);
    // Note that `Game.global_leaderboard` is already updated in the `_getGlobalRanking()` function embedded in `_getRanking()`

    let leaderboardText = '';
    for (i = 0; i < Math.min(Game.global_leaderboard.length, 20); i++) {
        if (ind == i) leaderboardText += "👉 ";

        switch (i) {
            case 0:
                leaderboardText += "🥇 ";
                break;
            case 1:
                leaderboardText += "🥈 ";
                break;
            case 2:
                leaderboardText += "🥉 ";
                break;
            default:
                leaderboardText += Format.asBoldStr(parseInt(i + 1)
                    .toString());
        }

        leaderboardText += Format.asBoldStr(Game.global_leaderboard[i].name) + " ";
        leaderboardText += Game.global_leaderboard[i].score;

        if (ind == i) leaderboardText += " 👈";

        leaderboardText += "\n";
    }

    // User is not part of the top 20
    if (ind >= 20) {
        leaderboardText += Format.asBoldStr("👉 " + Game.global_leaderboard[ind].name + " " + Format.asItalicStr(
            "(" +
            Game.global_leaderboard[ind].score + " points)") + " 👈");
    }

    const leaderboardEmbed = new Discord.MessageEmbed(templateEmbed)
        .setTitle("🏆 Global Ranking 🏆")
        .setDescription(leaderboardText);

    msg.reply(leaderboardEmbed);
};

// Send admin the ranking JSON
let prevSentAdminMessage = null;

_sendAdminJSONRanking = (msg) => {
    _getGlobalRanking();

    if (adminUser == null) return;

    const messageContent = JSON.stringify(Game.global_leaderboard, null, 4);

    // Delete any old messages sent by the bot
    if (prevSentAdminMessage) {
        prevSentAdminMessage.delete();
    }

    // Send message and pin it
    adminUser.send(messageContent)
        .then((messageReturn) => {
            prevSentAdminMessage = messageReturn;
            messageReturn.pin();
        }, (failureReason) => {
            console.log('Failed to send leaderboard debug message: ' + failureReason, "ERROR")
        });
};

module.exports.sendAdminJSONRanking = (msg) => {
    _sendAdminJSONRanking(msg);
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
    execute: nextHintForced
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

bot.commands.set(cmdChar + "ranking", {
    execute: _showRanking
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
    const msgText = msg.content;
    const args = msgText.split(/ +/);
    const command = args.shift()
        .toLowerCase();

    // Don't listen to bots
    if (msg.author.bot) return;

    // Ignore empty messages
    if (msg == null) return;

    // Commands
    if (msg.content.startsWith(cmdChar)) {
        console.info(`Called command: ${command}`);

        if (!bot.commands.has(command)) {
            msg.reply(
                `\`${command}\` is an invalid command. Send ${Format.asCmdStr("help")} for valid commands.`
            );
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
    else if (Game.status == "active") {
        // Strip non alphanumeric characters from messages and answers
        const messageText = msgText.replace(regex.non_alphanum, "")
            .toLowerCase();
        const answer = _getAnswer()
            .replace(regex.non_alphanum, "")
            .toLowerCase();

        Game.idle.reset();

        // Message contains answer!
        if (messageText.indexOf(answer) != -1) {
            // Get necessary information
            const name = _getName(msg);
            const user_id = _getUserID(msg);

            Game.question.answerer.push({
                "id": user_id,
                "name": name
            });

            _showAnswer(msg);
        }
    }
});
