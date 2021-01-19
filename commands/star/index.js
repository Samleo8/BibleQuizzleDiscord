const Discord = require("discord.js");

module.exports = {
    name: 'star',
    description: "Star of Bethlehem",
    execute (msg, args) {
        const attachment = new Discord.MessageAttachment('./img/star.jpg');

        msg.reply(attachment);

        return;
    },
};
