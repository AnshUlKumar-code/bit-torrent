
const express = require("express");

const {
    addPeer,
    getPeers,
    cleanExpiredPeers
} = require("./services/PeerRegistry");

const app = express();
const PORT = 4000;

app.use(express.json());

app.post("/announce", (req, res) => {
    const { infoHash, peerId, port } = req.body;

    if (
        typeof infoHash !== "string" ||
        !/^[a-fA-F0-9]{40}$/.test(infoHash) ||
        typeof peerId !== "string" ||
        !peerId ||
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
    ) {
        return res.status(400).json({
            success: false,
            message: "Valid infoHash, peerId and port are required"
        });
    }

    const peer = {
        peerId,
        port,
        ip: req.ip
    };

    addPeer(infoHash, peer);

    res.json({
        success: true,
        peers: getPeers(infoHash, peerId)
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Tracker server is running"
    });
});

// Remove inactive peers every 30 seconds.
const cleanupInterval = setInterval(() => {
    cleanExpiredPeers();
}, 30 * 1000);

cleanupInterval.unref();

app.listen(PORT, () => {
    console.log(`Tracker running on port ${PORT}`);
    console.log("Inactive peer timeout: 2 minutes");
});
