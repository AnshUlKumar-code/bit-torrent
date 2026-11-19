const express = require("express");
const { addPeer, getPeers } = require("./services/PeerRegistry");

const app = express();
const PORT = 4000;

app.use(express.json());

app.post("/announce", (req, res) => {
    const { infoHash, peerId, port } = req.body;

    if (!infoHash || !peerId || !port) {
        return res.status(400).json({
            success: false,
            message: "infoHash, peerId and port are required"
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

app.listen(PORT, () => {
    console.log(`Tracker running on port ${PORT}`);
});