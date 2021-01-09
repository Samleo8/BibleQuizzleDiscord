const Discord = require("discord.js");

module.exports = {
    name: 'penguins',
    description: "Who doesn't love penguins?",
    execute (msg, args) {
        const attachment = new Discord.MessageAttachment('./img/waddlingpenguin.gif');

        msg.reply("Did you know? Not all penguins live in Antarctica; in fact, the Galápagos penguin lives near the equator in Ecuador!", attachment);

        return;
    },
};