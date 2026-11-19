
const fs = require("fs");
const path = require("path");

const parseTorrent = require("../src/torrent/TorrentParser");
const startPeerServer = require("../src/peer/PeerServer");
const { announce } = require("../src/tracker/TrackerClient");
const { savePiece } = require("../src/storage/PieceStorage");

async function main() {
    const root = path.resolve(__dirname, "../../..");

    const sourcePath = path.join(root, "sample.txt");
    const torrentPath = path.join(
        root,
        "data/torrents/sample.torrent"
    );

    const downloadDir = path.join(
        root,
        "data/downloads/seeder"
    );

    const sourceData = fs.readFileSync(sourcePath);
    const torrent = parseTorrent(fs.readFileSync(torrentPath));

    if (sourceData.length !== torrent.length) {
        throw new Error("Source file size mismatch");
    }

    const pieceCount = Math.ceil(
        torrent.length / torrent.pieceLength
    );

    for (let i = 0; i < pieceCount; i++) {
        const start = i * torrent.pieceLength;
        const end = Math.min(
            start + torrent.pieceLength,
            sourceData.length
        );

        savePiece(
            downloadDir,
            torrent.name,
            i,
            sourceData.subarray(start, end),
            torrent.pieces.subarray(i * 20, (i + 1) * 20)
        );
    }

    const server = startPeerServer(
        5014,
        torrent.infoHash,
        "persistentseed1",
        {
            downloadDir,
            fileName: torrent.name,
            pieceCount
        }
    );

    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    await announce(torrent.infoHash, "persistentseed1", 5014);

    console.log("Seeder registered successfully.");
    console.log("Seeder is running on port 5014.");
    console.log("Keep this terminal open.");

    server.on("close", () => {
        console.log("Seeder stopped.");
    });
}

main().catch(error => {
    console.error("Seeder error:", error.message);
    process.exitCode = 1;
});
