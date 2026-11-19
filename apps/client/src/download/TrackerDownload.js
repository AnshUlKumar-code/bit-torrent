
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

    try {
        const pieceCount = Math.ceil(
            torrent.length / torrent.pieceLength
        );

        // Start our own peer server.
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

        // Register ourselves with the tracker.
        const trackerResponse = await announce(
            torrent.infoHash,
            peerId,
            peerPort
        );

        if (!trackerResponse.success) {
            throw new Error("Tracker registration failed");
        }

        const peers = trackerResponse.peers || [];

        console.log("Peers discovered:", peers.length);

        if (peers.length === 0) {
            throw new Error(
                "No other peers found. Ask another peer to seed this torrent."
            );
        }

        // Select the first available peer.
        const peer = peers.find(
            item => item.ip && item.port && item.port !== peerPort
        );

        if (!peer) {
            throw new Error("No usable peer found");
        }

        console.log("Connecting to peer:", peer.ip, peer.port);

        // Download the file from that peer.
        const result = await downloadFile({
            peer,
            torrent,
            downloadDir,
            peerId
        });

        console.log("Download completed successfully");

        return {
            ...result,
            server
        };

    } catch (error) {
        if (server) {
            server.close();
        }

        throw error;
    }
}

module.exports = downloadFromTracker;
