const Discord = require("discord.js");
const { cmdChar } = require("../../format");

module.exports = {
    name: 'eggs',
    description: "Easter eggs!",
    execute (msg, args) {
        const attachment = new Discord.MessageAttachment('./img/egg.gif');
        const eggCaption =
            `Congrats on finding your first easter egg!\n\nEaster eggs are fun secret commands, like ${cmdChar}eggs, that will send cute photos or gifs like this one. They range from cute typos to random words and expressions.\n\nHappy hunting!\n`;

        msg.reply(
            eggCaption,
            attachment);

        return;
    },
};
