const Discord = require("discord.js");

module.exports = {
    name: 'sads',
    description: "Easter egg: Don't be sads",
    execute (msg, args) {
        const attachment = new Discord.MessageAttachment('./img/jesuswept.jpg');

        msg.reply(
            "It's ok to be sad sometimes... Do you need !hugs ?",
            attachment);

        return;
    },
};
