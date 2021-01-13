const cmdChar = "!";

module.exports = {
    name: "format",
    cmdChar: cmdChar,
    asBoldStr: (str) => {
        return "**" + str + "**";
    },
    asItalicStr: (str) => {
        return "*" + str + "*";
    },
    asCodeStr: (str) => {
        return "`" + str + "`";
    },
    asUnderlinedStr: (str) => {
        return "__" + str + "__";
    },
    asStrikeThroughStr: (str) => {
        return "~~" + str + "~~";
    },
    asCmdStr: (str) => {
        return module.exports.asCodeStr(cmdChar + str);
    }
};
