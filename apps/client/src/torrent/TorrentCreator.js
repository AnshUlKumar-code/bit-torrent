const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const encode = require("./BencodeEncoder");

function createTorrent(
    filePath,
    outputPath,
    announceUrl = "http://localhost:4000/announce"
) {
    const fileData = fs.readFileSync(filePath);
    const pieceLength = 256 * 1024;

    const pieceHashes = [];

    // Split file and calculate SHA-1 hash of each piece
    for (let i = 0; i < fileData.length; i += pieceLength) {
        const piece = fileData.subarray(i, i + pieceLength);

        const hash = crypto
            .createHash("sha1")
            .update(piece)
            .digest();

        pieceHashes.push(hash);
    }

    // Build torrent info dictionary
    const info = {
        name: Buffer.from(path.basename(filePath)),
        length: fileData.length,
        "piece length": pieceLength,
        pieces: Buffer.concat(pieceHashes)
    };

    const torrent = {
        announce: Buffer.from(announceUrl),
        info
    };

    const torrentBuffer = encode(torrent);

    fs.writeFileSync(outputPath, torrentBuffer);

    const infoHash = crypto
        .createHash("sha1")
        .update(encode(info))
        .digest("hex");

    return {
        name: path.basename(filePath),
        size: fileData.length,
        pieceCount: pieceHashes.length,
        infoHash,
        outputPath
    };
}

module.exports = createTorrent;