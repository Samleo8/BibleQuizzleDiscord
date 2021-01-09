const Discord = require("discord.js");

module.exports = {
    name: 'suggest',
    description: "Suggest something!",
    execute (msg, args) {
        const suggestionFormURL =
            "https://forms.gle/aqZ3MK8QrBGzv9PEA";

        const suggestionText = "Suggest new questions and answers here: " + suggestionFormURL + " !";

        msg.reply(suggestionText);
        return;
    },
};
