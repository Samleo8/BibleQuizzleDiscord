const Discord = require("discord.js");

module.exports = {
    name: 'hugs',
    description: "Easter egg: hugs",
    execute (msg, args) {
        const attachment = new Discord.MessageAttachment('./img/penguinhugs.gif');

        msg.reply("Penguin Hugs!", attachment);

        return;
    },
};
