
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
    downloadDir,
    peers: initialPeers = [],
    onProgress
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

        // Collect candidate tracker URLs: torrent metadata first, then fallback to config
        const candidateTrackers = [];
        if (torrent.announceList && torrent.announceList.length > 0) {
            candidateTrackers.push(...torrent.announceList);
        } else if (torrent.announce) {
            candidateTrackers.push(torrent.announce);
        }
        if (!candidateTrackers.includes(config.trackerUrl)) {
            candidateTrackers.push(config.trackerUrl);
        }

        let trackerResponse = null;
        let activeTrackerUrl = config.trackerUrl;

        for (const candidate of candidateTrackers) {
            if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
                continue;
            }

            try {
                console.log("Contacting tracker:", candidate);
                const resp = await announce(
                    torrent.infoHash,
                    peerId,
                    peerPort,
                    {
                        trackerUrl: candidate,
                        left: torrent.length,
                        event: "started"
                    }
                );

                if (resp && resp.success !== false) {
                    trackerResponse = resp;
                    activeTrackerUrl = candidate;
                    console.log(`Discovered ${resp.peers ? resp.peers.length : 0} peers from ${candidate}`);
                    if (resp.peers && resp.peers.length > 0) {
                        break;
                    }
                }
            } catch (err) {
                console.log(`Announce to ${candidate} failed:`, err.message);
            }
        }

        if (!trackerResponse) {
            throw new Error("Failed to contact any tracker from torrent announce list");
        }

        const heartbeatInterval = Math.min(trackerResponse.interval || 45, 60);

        // Refresh registration periodically
        heartbeat = setInterval(async () => {
            try {
                await announce(
                    torrent.infoHash,
                    peerId,
                    peerPort,
                    {
                        trackerUrl: activeTrackerUrl,
                        left: torrent.length
                    }
                );

                console.log("Downloader heartbeat sent:", peerId);
            } catch (error) {
                console.log(
                    "Downloader heartbeat failed:",
                    error.message
                );
            }
        }, heartbeatInterval * 1000);

        server.once("close", () => {
            clearInterval(heartbeat);
            console.log("Downloader heartbeat stopped:", peerId);
        });

        const discoveredPeers = trackerResponse.peers || [];
        const combinedPeers = [...initialPeers, ...discoveredPeers];

        console.log("Total peers available (initial + discovered):", combinedPeers.length);

        // Keep only usable peers.
        const usablePeers = combinedPeers.filter(
            peer =>
                peer.ip &&
                Number.isInteger(peer.port) &&
                peer.port > 0 &&
                peer.port !== peerPort
        );

        if (usablePeers.length === 0) {
            throw new Error(
                "No usable peers found. Ask another peer to seed this torrent or supply direct peers."
            );
        }

        console.log("Usable peers:", usablePeers.length);

        // Download pieces concurrently from available peers while simultaneously seeding downloaded pieces
        const result = await downloadFile({
            peers: usablePeers,
            torrent,
            downloadDir,
            peerId,
            onProgress,
            onPieceDownloaded: (pieceIndex) => {
                if (server && typeof server.broadcastHave === "function") {
                    server.broadcastHave(pieceIndex);
                }
            }
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
