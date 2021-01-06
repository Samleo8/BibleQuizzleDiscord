module.exports = {
    name: 'penguins',
    description: "Who doesn't love penguins?",
    execute (msg, args) {
        msg.reply('Cute and cuddly!');
        msg.channel.send('Cute and cuddly!');

        return;
    },
};