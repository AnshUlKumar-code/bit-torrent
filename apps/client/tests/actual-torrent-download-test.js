
const fs = require("fs");
const path = require("path");

const parseTorrent = require("../src/torrent/TorrentParser");
const startPeerServer = require("../src/peer/PeerServer");
const { announce } = require("../src/tracker/TrackerClient");
const { savePiece } = require("../src/storage/PieceStorage");
const downloadTorrent = require("../src/download/TorrentDownload");

const root = path.resolve(__dirname, "../../..");

const sourcePath = path.join(root, "sample.txt");
const torrentPath = path.join(root, "data/torrents/sample.torrent");
const downloadDir = path.join(
    root,
    "data/downloads/actual-torrent-test"
);

async function waitForServer(server) {
    if (server.listening) return;

    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });
}

async function main() {
    let seederServer;
    let leecherServer;

    try {
        const sourceData = fs.readFileSync(sourcePath);
        const torrent = parseTorrent(fs.readFileSync(torrentPath));

        if (sourceData.length !== torrent.length) {
            throw new Error("Source file size does not match torrent");
        }

        const pieceHashes = [];

        for (let i = 0; i < torrent.pieces.length; i += 20) {
            pieceHashes.push(torrent.pieces.subarray(i, i + 20));
        }

        const pieceCount = Math.ceil(
            torrent.length / torrent.pieceLength
        );

        if (pieceHashes.length !== pieceCount) {
            throw new Error("Torrent piece count is invalid");
        }

        fs.mkdirSync(downloadDir, { recursive: true });

        // Prepare the seeder's pieces.
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
                pieceHashes[i]
            );
        }

        // Start the seeder.
        seederServer = startPeerServer(
            5014,
            torrent.infoHash,
            "actualseed01",
            {
                downloadDir,
                fileName: torrent.name,
                pieceCount
            }
        );

        await waitForServer(seederServer);

        // Register the seeder with the tracker.
        await announce(
            torrent.infoHash,
            "actualseed01",
            5014
        );

        console.log("Actual torrent seeder registered");

        // Download using the real .torrent file.
        const result = await downloadTorrent({
            torrentPath,
            peerId: "actualleecher1",
            peerPort: 5015,
            downloadDir
        });

        leecherServer = result.server;

        const downloadedData = fs.readFileSync(
            result.outputPath
        );

        if (!downloadedData.equals(sourceData)) {
            throw new Error("Downloaded file does not match original");
        }

        console.log("Downloaded file:", result.outputPath);
        console.log("Downloaded size:", downloadedData.length);
        console.log("PASS: Actual torrent download works");

    } catch (error) {
        console.log("TEST FAILED:", error.message);
    } finally {
        if (leecherServer) leecherServer.close();
        if (seederServer) seederServer.close();
    }
}

main();
