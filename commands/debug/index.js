const {
    ADMIN_ID
} = require("../../constants.js");

const Main = require("../../index.js");

module.exports = {
    name: 'debug',
    description: "debug",
    execute (msg, args) {
        Main.sendAdminJSONRanking(msg);

        return;
    },
};
