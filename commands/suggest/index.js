const {
    suggestURL
} = require("../../constants.js");

module.exports = {
    name: 'suggest',
    description: "Suggest something!",
    execute (msg, args) {
        const suggestionText = "Suggest new questions and answers here: " + suggestURL + " !";

        msg.reply(suggestionText);
        return;
    },
};
