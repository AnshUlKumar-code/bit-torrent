
const fs = require("fs");
const path = require("path");

const createTorrent = require("../torrent/TorrentCreator");
const parseTorrent = require("../torrent/TorrentParser");
const startPeerServer = require("../peer/PeerServer");
const { announce } = require("../tracker/TrackerClient");
const { savePiece } = require("../storage/PieceStorage");

async function startSeeding({
    filePath,
    peerId,
    peerPort,
    torrentDirectory,
    downloadDirectory
}) {
    let server;
    let heartbeat;

    try {
        if (!fs.existsSync(filePath)) {
            throw new Error("Source file does not exist");
        }

        fs.mkdirSync(torrentDirectory, { recursive: true });
        fs.mkdirSync(downloadDirectory, { recursive: true });

        const torrentPath = path.join(
            torrentDirectory,
            `${path.parse(filePath).name}.torrent`
        );

        createTorrent(filePath, torrentPath);

        const torrent = parseTorrent(
            fs.readFileSync(torrentPath)
        );

        const fileData = fs.readFileSync(filePath);

        const pieceCount = Math.ceil(
            torrent.length / torrent.pieceLength
        );

        for (let i = 0; i < pieceCount; i++) {
            const start = i * torrent.pieceLength;
            const end = Math.min(
                start + torrent.pieceLength,
                fileData.length
            );

            const expectedHash = torrent.pieces.subarray(
                i * 20,
                (i + 1) * 20
            );

            savePiece(
                downloadDirectory,
                torrent.name,
                i,
                fileData.subarray(start, end),
                expectedHash
            );
        }

        server = startPeerServer(
            peerPort,
            torrent.infoHash,
            peerId,
            {
                downloadDir: downloadDirectory,
                fileName: torrent.name,
                pieceCount
            }
        );

        await new Promise((resolve, reject) => {
            server.once("listening", resolve);
            server.once("error", reject);
        });

        // Register the seeder immediately.
        await announce(
            torrent.infoHash,
            peerId,
            peerPort
        );

        console.log("File is now being shared:", torrent.name);

        // Refresh registration every 45 seconds.
        heartbeat = setInterval(async () => {
            try {
                await announce(
                    torrent.infoHash,
                    peerId,
                    peerPort
                );

                console.log("Seeder heartbeat sent:", peerId);
            } catch (error) {
                console.log("Heartbeat failed:", error.message);
            }
        }, 45 * 1000);

        // Stop heartbeat when the peer server closes.
        server.once("close", () => {
            clearInterval(heartbeat);
            console.log("Seeder heartbeat stopped:", peerId);
        });

        return {
            success: true,
            name: torrent.name,
            infoHash: torrent.infoHash,
            torrentPath,
            peerId,
            peerPort,
            server
        };

    } catch (error) {
        if (heartbeat) {
            clearInterval(heartbeat);
        }

        if (server) {
            server.close();
        }

        throw error;
    }
}

module.exports = startSeeding;
