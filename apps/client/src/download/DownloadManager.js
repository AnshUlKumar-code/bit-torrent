
const fs = require("fs");
const path = require("path");

const downloadFromPeer = require("./PeerDownload");
const { assembleFile } = require("../storage/PieceStorage");

async function downloadFile({
    peer,
    torrent,
    downloadDir,
    peerId
}) {
    const {
        name,
        length,
        pieceLength,
        pieces,
        infoHash
    } = torrent;

    const pieceCount = Math.ceil(length / pieceLength);
    const expectedHashes = [];

    for (let i = 0; i < pieces.length; i += 20) {
        expectedHashes.push(pieces.subarray(i, i + 20));
    }

    if (expectedHashes.length !== pieceCount) {
        throw new Error("Invalid torrent piece metadata");
    }

    fs.mkdirSync(downloadDir, { recursive: true });

    console.log("Starting download:", name);
    console.log("Total pieces:", pieceCount);

    for (let i = 0; i < pieceCount; i++) {
        const actualPieceLength = Math.min(
            pieceLength,
            length - i * pieceLength
        );

        console.log(`Downloading piece ${i + 1}/${pieceCount}`);

        await downloadFromPeer({
            ip: peer.ip,
            port: peer.port,
            infoHash,
            peerId,
            pieceCount,
            pieceIndex: i,
            pieceLength: actualPieceLength,
            expectedHash: expectedHashes[i],
            downloadDir,
            fileName: name
        });

        console.log(`Piece ${i + 1} completed`);
    }

    const outputPath = path.join(
        downloadDir,
        `${name}.downloaded`
    );

    const assembledSize = assembleFile(
        downloadDir,
        name,
        pieceCount,
        outputPath
    );

    console.log("File assembled successfully:", outputPath);

    return {
        success: true,
        name,
        size: assembledSize,
        outputPath
    };
}

module.exports = downloadFile;
