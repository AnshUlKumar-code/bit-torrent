
const encode = require("../src/torrent/BencodeEncoder");
const parseTorrent = require("../src/torrent/TorrentParser");

const torrentData = {
    announce: "http://localhost:4000/announce",

    info: {
        name: "movie.mp4",
        length: 1000000,
        "piece length": 262144,
        pieces: Buffer.alloc(80, 1)
    }
};

const torrentBuffer = encode(torrentData);

const result = parseTorrent(torrentBuffer);

console.log("Torrent Name:", result.name);
console.log("Tracker URL:", result.announce);
console.log("File Size:", result.length);
console.log("Piece Length:", result.pieceLength);
console.log("Pieces Buffer:", Buffer.isBuffer(result.pieces));
console.log("Info Hash:", result.infoHash);

const passed =
    result.name === "movie.mp4" &&
    result.announce === "http://localhost:4000/announce" &&
    result.length === 1000000 &&
    result.pieceLength === 262144 &&
    Buffer.isBuffer(result.pieces) &&
    result.pieces.length === 80 &&
    result.infoHash.length === 40;

console.log(passed ? "PASS" : "FAIL");
