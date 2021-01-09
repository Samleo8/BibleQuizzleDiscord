const Discord = require("discord.js");

module.exports = {
    name: 'quack',
    description: "Easter egg: Trolling with quack",
    execute (msg, args) {
        const attachment = new Discord.MessageAttachment('./img/quack.jpg');

        msg.reply(
            "Did you mean !quick ?",
            attachment);

        return;
    },
};
