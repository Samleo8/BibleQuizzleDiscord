const Constants = require('../../constants.js');

module.exports = {
    name: 'help',
    description: "Send help message",
    execute (msg, args) {
        msg.reply(Constants.helpMessage);
        return;
    },
};
