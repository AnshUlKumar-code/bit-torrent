const fs = require("fs");
const parseTorrent = require("../src/torrent/TorrentParser");

const buffer = fs.readFileSync("data/torrents/sample.torrent");

const torrent = parseTorrent(buffer);

console.log("Name:", torrent.name);
console.log("Size:", torrent.totalLength);
console.log("Info Hash:", torrent.infoHash);
console.log("PASS: Generated torrent parsed successfully");