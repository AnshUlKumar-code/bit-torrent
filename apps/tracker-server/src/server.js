
const express = require("express");

const {
    addPeer,
    getPeers,
    cleanExpiredPeers
} = require("./services/PeerRegistry");

const encode = require("./services/BencodeEncoder");

const app = express();
const PORT = 4000;

app.use(express.json());

function extractInfoHashFromUrl(rawUrl) {
    const match = rawUrl.match(/[?&]info_hash=([^&]+)/);
    if (!match) return null;
    const rawVal = match[1];

    // Decode URL-encoded binary bytes
    const bytes = [];
    for (let i = 0; i < rawVal.length; i++) {
        if (rawVal[i] === "%" && i + 2 < rawVal.length) {
            bytes.push(parseInt(rawVal.substring(i + 1, i + 3), 16));
            i += 2;
        } else {
            bytes.push(rawVal.charCodeAt(i));
        }
    }
    const buf = Buffer.from(bytes);
    if (buf.length === 20) {
        return buf.toString("hex").toLowerCase();
    }
    if (/^[a-fA-F0-9]{40}$/.test(rawVal)) {
        return rawVal.toLowerCase();
    }
    return null;
}

// Standard BitTorrent BEP 3 & BEP 23 HTTP GET Announce
app.get("/announce", (req, res) => {
    const infoHash = extractInfoHashFromUrl(req.originalUrl || req.url);
    const peerId = req.query.peer_id;
    const port = parseInt(req.query.port, 10);
    const isCompact = req.query.compact == 1 || req.query.compact === "1" || req.query.compact === true || !req.query.compact;

    if (!infoHash || !peerId || isNaN(port) || port < 1 || port > 65535) {
        const errorBencoded = encode({
            "failure reason": "Missing or invalid info_hash, peer_id, or port"
        });
        res.setHeader("Content-Type", "text/plain");
        return res.status(400).send(errorBencoded);
    }

    let clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "127.0.0.1";
    if (clientIp.includes(",")) clientIp = clientIp.split(",")[0].trim();
    clientIp = clientIp.replace(/^.*:/, "");
    if (!clientIp || clientIp === "1") clientIp = "127.0.0.1";

    const peer = {
        peerId: typeof peerId === "string" ? peerId : peerId.toString("latin1"),
        port,
        ip: clientIp
    };

    addPeer(infoHash, peer);

    const peers = getPeers(infoHash, peer.peerId);

    // Compact format (BEP 23): 6 bytes per peer (4 bytes IPv4 + 2 bytes Port)
    if (isCompact) {
        const compactBuffer = Buffer.alloc(peers.length * 6);
        let offset = 0;

        for (const p of peers) {
            let ipStr = (p.ip || "127.0.0.1").replace(/^.*:/, "");
            if (!ipStr || ipStr === "1") ipStr = "127.0.0.1";
            const octets = ipStr.split(".").map(Number);

            if (octets.length === 4 && !octets.some(isNaN)) {
                octets.forEach((octet, i) => compactBuffer.writeUInt8(octet, offset + i));
                compactBuffer.writeUInt16BE(p.port, offset + 4);
                offset += 6;
            }
        }

        const responsePayload = {
            interval: 1800,
            "min interval": 300,
            complete: 1,
            incomplete: 0,
            peers: compactBuffer.subarray(0, offset)
        };

        const encoded = encode(responsePayload);
        res.setHeader("Content-Type", "text/plain");
        return res.send(encoded);
    }

    // Standard BEP 3 Dictionary format
    const responsePayload = {
        interval: 1800,
        "min interval": 300,
        complete: 1,
        incomplete: 0,
        peers: peers.map(p => ({
            "peer id": Buffer.from(p.peerId, "latin1"),
            ip: Buffer.from(p.ip, "utf8"),
            port: p.port
        }))
    };

    const encoded = encode(responsePayload);
    res.setHeader("Content-Type", "text/plain");
    return res.send(encoded);
});

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
