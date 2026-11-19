
const startPeerServer = require("../peer/PeerServer");
const { announce } = require("../tracker/TrackerClient");
const downloadFile = require("./DownloadManager");

function waitForServer(server) {
    return new Promise((resolve, reject) => {
        if (server.listening) {
            resolve();
            return;
        }

        server.once("listening", resolve);
        server.once("error", reject);
    });
}

async function downloadFromTracker({
    torrent,
    peerId,
    peerPort,
    downloadDir
}) {
    let server;
    let heartbeat;

    try {
        const pieceCount = Math.ceil(
            torrent.length / torrent.pieceLength
        );

        server = startPeerServer(
            peerPort,
            torrent.infoHash,
            peerId,
            {
                downloadDir,
                fileName: torrent.name,
                pieceCount
            }
        );

        await waitForServer(server);

        console.log("Peer server started on port:", peerPort);

        // Register downloader with tracker.
        const trackerResponse = await announce(
            torrent.infoHash,
            peerId,
            peerPort
        );

        if (!trackerResponse.success) {
            throw new Error("Tracker registration failed");
        }

        // Refresh registration every 45 seconds.
        heartbeat = setInterval(async () => {
            try {
                await announce(
                    torrent.infoHash,
                    peerId,
                    peerPort
                );

                console.log("Downloader heartbeat sent:", peerId);
            } catch (error) {
                console.log(
                    "Downloader heartbeat failed:",
                    error.message
                );
            }
        }, 45 * 1000);

        server.once("close", () => {
            clearInterval(heartbeat);
            console.log("Downloader heartbeat stopped:", peerId);
        });

        const peers = trackerResponse.peers || [];

        console.log("Peers discovered:", peers.length);

        // Keep only usable peers.
        const usablePeers = peers.filter(
            peer =>
                peer.ip &&
                Number.isInteger(peer.port) &&
                peer.port > 0 &&
                peer.port !== peerPort
        );

        if (usablePeers.length === 0) {
            throw new Error(
                "No usable peers found. Ask another peer to seed this torrent."
            );
        }

        console.log("Usable peers:", usablePeers.length);

        // Download pieces concurrently from the available peers.
        const result = await downloadFile({
            peers: usablePeers,
            torrent,
            downloadDir,
            peerId
        });

        console.log("Download completed successfully.");

        return {
            ...result,
            server,
            infoHash: torrent.infoHash
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

module.exports = downloadFromTracker;
