// ================MISC. FUNCTIONS=================// 
// Get random integer: [min,max]
getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Get random float: [min,max)
getRandomFloatExcl = (min, max) => {
    return Math.random() * (max - min) + min;
};

// Remove duplicates in array
removeDuplicates = (_array) => {
    let _i, _j, arr = [];
    let found = false;
    for (_i = 0; _i < _array.length; _i++) {
        found = false;
        for (_j = 0; _j < arr.length; _j++) {
            if (_array[_i] == arr[_j] || (JSON.stringify(_array[_i]) == JSON.stringify(arr[_j]) && typeof _array[
                        _i] ==
                    typeof arr[_j])) {
                found = true;
                break;
            }
        }
        if (!found) arr.push(_array[_i]);
    }

    return arr;
};

// Convert to title case
String.prototype.toTitleCase = function() {
    var i, j, str, lowers, uppers;
    str = this.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
        return txt.charAt(0)
            .toUpperCase() + txt.substr(1)
            .toLowerCase();
    });

    // Certain minor words should be left lowercase unless
    // they are the first or last words in the string
    lowers = ['A', 'An', 'The', 'And', 'But', 'Or', 'For', 'Nor', 'As', 'At',
		'By', 'For', 'From', 'In', 'Into', 'Near', 'Of', 'On', 'Onto', 'To', 'With'
	];
    for (i = 0, j = lowers.length; i < j; i++)
        str = str.replace(new RegExp('\\s' + lowers[i] + '\\s', 'g'),
            function(txt) {
                return txt.toLowerCase();
            });

    // Certain words such as initialisms or acronyms should be left uppercase
    uppers = ['Id', 'Tv'];
    for (i = 0, j = uppers.length; i < j; i++)
        str = str.replace(new RegExp('\\b' + uppers[i] + '\\b', 'g'),
            uppers[i].toUpperCase());

    return str;
};

/* CONVERSION OF EXCEL QUESTIONS TO JSON:

// Array Creation of JSON formatted q&a
a = [ (_input_) ]

arr = []; keys = ["question","answer","categories","reference"]; 

for(i in a){
    obj = {};
    b = a[i].split("\t");
    for(j=0;j<keys.length;j++){
        if(j!=2) obj[keys[j]] = b[j].toString();
        else obj[keys[j]] = b[j].toLowerCase().split(", ").join(",").split(" ").join("_").split("/").join("_").split(",");
    } arr.push(obj);
    // console.log(JSON.stringify(obj,null,2));
}

console.log(JSON.stringify(arr,null,2));

// Formatting for easier copying
x = JSON.stringify(arr);
for(i in keys){
    k = keys[i].toString();
    r = new RegExp('"'+k+'":',"gi");
    x = x.replace(r,'\n\t"'+k+'":')
}
x = x.split("[{").join("{").split("}]").join("\n}");
x.split("},{").join("\n},\n{");

*/