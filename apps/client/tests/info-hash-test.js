
const calculateInfoHash = require("../src/torrent/InfoHash");

const input = Buffer.from("hello world");

const hash = calculateInfoHash(input);

console.log("Info Hash:", hash);
console.log("Hash length:", hash.length);

console.log(
    hash.length === 40 ? "PASS" : "FAIL"
);
