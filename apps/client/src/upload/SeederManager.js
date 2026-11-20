
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

        // Collect candidate tracker URLs
        const candidateTrackers = [];
        if (torrent.announceList && torrent.announceList.length > 0) {
            candidateTrackers.push(...torrent.announceList);
        } else if (torrent.announce) {
            candidateTrackers.push(torrent.announce);
        }

        const clientConfig = require("../config");
        if (clientConfig.trackerUrl && !candidateTrackers.includes(clientConfig.trackerUrl)) {
            candidateTrackers.push(clientConfig.trackerUrl);
        }

        // Also add embedded client tracker as fallback
        const embeddedTracker = `http://127.0.0.1:${clientConfig.port || 3000}/announce`;
        if (!candidateTrackers.includes(embeddedTracker)) {
            candidateTrackers.push(embeddedTracker);
        }

        let activeTrackerUrl = null;

        for (const candidate of candidateTrackers) {
            try {
                console.log("Seeder registering with tracker:", candidate);
                await announce(
                    torrent.infoHash,
                    peerId,
                    peerPort,
                    {
                        trackerUrl: candidate,
                        left: 0,
                        event: "completed"
                    }
                );
                activeTrackerUrl = candidate;
                console.log(`Successfully registered seeder with: ${candidate}`);
                break;
            } catch (err) {
                console.warn(`Tracker registration to ${candidate} failed (${err.message}). Trying fallback...`);
            }
        }

        console.log("File is now being shared by seeder:", torrent.name, "Port:", peerPort);

        // Refresh registration every 45 seconds if a tracker is active
        if (activeTrackerUrl) {
            heartbeat = setInterval(async () => {
                try {
                    await announce(
                        torrent.infoHash,
                        peerId,
                        peerPort,
                        {
                            trackerUrl: activeTrackerUrl,
                            left: 0
                        }
                    );
                    console.log("Seeder heartbeat sent:", peerId);
                } catch (error) {
                    console.log("Heartbeat failed:", error.message);
                }
            }, 45 * 1000);
        }

        // Stop heartbeat when the peer server closes.
        server.once("close", () => {
            if (heartbeat) clearInterval(heartbeat);
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
