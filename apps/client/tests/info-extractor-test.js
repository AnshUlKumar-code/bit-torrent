
const encode = require("../src/torrent/BencodeEncoder");
const extractInfoBuffer = require("../src/torrent/BencodeInfoExtractor");
const calculateInfoHash = require("../src/torrent/InfoHash");

const torrent = {
    announce: "http://localhost:4000/announce",
    info: {
        name: "movie.mp4",
        length: 1000000,
        "piece length": 262144,
        pieces: Buffer.alloc(80, 1)
    }
};

const torrentBuffer = encode(torrent);

const extractedInfo = extractInfoBuffer(torrentBuffer);

const expectedInfo = encode(torrent.info);

console.log(
    "Exact bytes preserved:",
    extractedInfo.equals(expectedInfo)
);

const hash = calculateInfoHash(extractedInfo);

console.log("Info Hash:", hash);
console.log("Hash length:", hash.length);

console.log(
    extractedInfo.equals(expectedInfo) && hash.length === 40
        ? "PASS"
        : "FAIL"
);
