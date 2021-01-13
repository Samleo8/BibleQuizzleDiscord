module.exports = {
    name: "format",
    asBoldStr: (str) => {
        return "**" + str + "**";
    },
    asItalicStr: (str) => {
        return "*" + str + "*";
    },
    asCodeStr: (str) => {
        return "`" + str + "`";
    },
    asCmdStr: (str) => {
        return _asCodeStr(cmdChar + str);
    }
};