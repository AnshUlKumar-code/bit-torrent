
const express = require("express");
const config = require("./config");

const createTorrent = require("./torrent/TorrentCreator");
const parseTorrent = require("./torrent/TorrentParser");
const downloadTorrent = require("./download/TorrentDownload");
const startSeeding = require("./upload/SeederManager");

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

app.use(express.json());

const activePeerServers = new Map();
const activeTorrents = new Map();

const torrentDirectory = path.resolve(
    process.cwd(),
    config.torrentDir
);

const downloadDirectory = path.resolve(
    process.cwd(),
    config.downloadDir
);

const webPublicDirectory = path.resolve(__dirname, "../../web/public");
if (fs.existsSync(webPublicDirectory)) {
    app.use(express.static(webPublicDirectory));
}

// Embedded BitTorrent Tracker Registry for cloud deployments
const embeddedTrackerPeers = new Map();
const TRACKER_PEER_TIMEOUT = 2 * 60 * 1000;

function extractInfoHashFromUrl(rawUrl) {
    const match = rawUrl.match(/[?&]info_hash=([^&]+)/);
    if (!match) return null;
    const rawVal = match[1];

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

// BEP 3 / BEP 23 HTTP GET Announce
app.get("/announce", (req, res) => {
    const infoHash = extractInfoHashFromUrl(req.originalUrl || req.url);
    const peerId = req.query.peer_id;
    const port = parseInt(req.query.port, 10);
    const isCompact = req.query.compact == 1 || req.query.compact === "1" || req.query.compact === true || !req.query.compact;

    if (!infoHash || !peerId || isNaN(port) || port < 1 || port > 65535) {
        res.setHeader("Content-Type", "text/plain");
        return res.status(400).send("d14:failure reason44:Missing or invalid info_hash, peer_id, or porte");
    }

    let clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "127.0.0.1";
    if (clientIp.includes(",")) clientIp = clientIp.split(",")[0].trim();
    clientIp = clientIp.replace(/^.*:/, "");
    if (!clientIp || clientIp === "1") clientIp = "127.0.0.1";

    if (!embeddedTrackerPeers.has(infoHash)) {
        embeddedTrackerPeers.set(infoHash, new Map());
    }
    const peersMap = embeddedTrackerPeers.get(infoHash);
    peersMap.set(peerId, { peerId, port, ip: clientIp, lastSeen: Date.now() });

    const now = Date.now();
    for (const [pId, p] of peersMap.entries()) {
        if (now - p.lastSeen > TRACKER_PEER_TIMEOUT) {
            peersMap.delete(pId);
        }
    }

    const peersList = [];
    for (const p of peersMap.values()) {
        if (p.peerId !== peerId) {
            peersList.push(p);
        }
    }

    const encodeBencode = require("./torrent/BencodeEncoder");

    if (isCompact) {
        const compactBuffer = Buffer.alloc(peersList.length * 6);
        let offset = 0;

        for (const p of peersList) {
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

        res.setHeader("Content-Type", "text/plain");
        return res.send(encodeBencode(responsePayload));
    }

    const responsePayload = {
        interval: 1800,
        "min interval": 300,
        complete: 1,
        incomplete: 0,
        peers: peersList.map(p => ({
            "peer id": Buffer.from(p.peerId, "latin1"),
            ip: Buffer.from(p.ip, "utf8"),
            port: p.port
        }))
    };

    res.setHeader("Content-Type", "text/plain");
    return res.send(encodeBencode(responsePayload));
});

app.post("/announce", (req, res) => {
    const { infoHash, peerId, port } = req.body;
    if (!infoHash || !peerId || !port) {
        return res.status(400).json({ success: false, message: "Missing params" });
    }
    if (!embeddedTrackerPeers.has(infoHash)) {
        embeddedTrackerPeers.set(infoHash, new Map());
    }
    embeddedTrackerPeers.get(infoHash).set(peerId, { peerId, port, ip: req.ip, lastSeen: Date.now() });
    const peers = [];
    for (const p of embeddedTrackerPeers.get(infoHash).values()) {
        if (p.peerId !== peerId) peers.push({ peerId: p.peerId, port: p.port, ip: p.ip });
    }
    res.json({ success: true, peers });
});

// Health API
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "uTorrent client backend is running"
    });
});

// Get available files (torrents in data/torrents and sample files in root)
app.get("/api/torrents/available-files", (req, res) => {
    try {
        const torrents = fs.existsSync(torrentDirectory)
            ? fs.readdirSync(torrentDirectory).filter(f => f.toLowerCase().endsWith(".torrent"))
            : [];

        const rootDir = path.resolve(__dirname, "../../../");
        const rootFiles = fs.readdirSync(rootDir).filter(f => {
            try {
                const stat = fs.statSync(path.join(rootDir, f));
                return stat.isFile() && !f.startsWith(".") && !f.endsWith(".json") && !f.endsWith(".md");
            } catch {
                return false;
            }
        });

        res.status(200).json({
            success: true,
            torrents,
            sampleFiles: rootFiles,
            torrentDirectory,
            downloadDirectory
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Create torrent API
app.post("/api/torrents/create", (req, res) => {
    try {
        let { filePath } = req.body;

        if (filePath && typeof filePath === "string") {
            filePath = filePath.trim().replace(/^["']|["']$/g, "");
        }

        if (!filePath) {
            return res.status(400).json({
                success: false,
                message: "File path is required"
            });
        }

        fs.mkdirSync(torrentDirectory, { recursive: true });

        const outputPath = path.join(
            torrentDirectory,
            `${path.parse(filePath).name}.torrent`
        );

        const result = createTorrent(filePath, outputPath);

        res.status(201).json({
            success: true,
            message: "Torrent created successfully",
            torrent: result
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Start seeding API
app.post("/api/torrents/seed", async (req, res) => {
    try {
        let { filePath, peerId, peerPort } = req.body;

        if (filePath && typeof filePath === "string") {
            filePath = filePath.trim().replace(/^["']|["']$/g, "");
        }

        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(400).json({
                success: false,
                message: "Valid source file path is required"
            });
        }

        if (!fs.statSync(filePath).isFile()) {
            return res.status(400).json({
                success: false,
                message: "Source path must be a file"
            });
        }

        const selectedPeerPort = peerPort ?? 5017;

        if (
            !Number.isInteger(selectedPeerPort) ||
            selectedPeerPort < 1024 ||
            selectedPeerPort > 65535
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid peer port"
            });
        }

        const selectedPeerId =
            peerId || "-UT0001-" + crypto.randomBytes(6).toString("hex");

        if (
            typeof selectedPeerId !== "string" ||
            Buffer.byteLength(selectedPeerId, "utf8") !== 20
        ) {
            return res.status(400).json({
                success: false,
                message: "Peer ID must be exactly 20 bytes"
            });
        }

        if (activePeerServers.has(selectedPeerId)) {
            return res.status(409).json({
                success: false,
                message: "This peer is already active"
            });
        }

        console.log("Starting seeding:", filePath);

        const result = await startSeeding({
            filePath,
            peerId: selectedPeerId,
            peerPort: selectedPeerPort,
            torrentDirectory,
            downloadDirectory
        });

        const totalSize = fs.statSync(filePath).size;
        const pieceCount = Math.ceil(totalSize / (256 * 1024));

        const torrentState = {
            infoHash: result.infoHash,
            name: result.name,
            torrentFileName: `${path.parse(filePath).name}.torrent`,
            torrentPath: result.torrentPath,
            peerId: selectedPeerId,
            peerPort: selectedPeerPort,
            status: "seeding",
            progress: 100,
            speed: 0,
            totalSize,
            downloadedPieces: pieceCount,
            skippedPieces: 0,
            totalPieces: pieceCount,
            peersCount: 0,
            outputPath: filePath,
            server: result.server,
            startedAt: Date.now(),
            completedAt: Date.now(),
            error: null
        };

        activeTorrents.set(`${result.infoHash}_${selectedPeerId}`, torrentState);

        activePeerServers.set(selectedPeerId, {
            server: result.server,
            name: result.name,
            peerPort: selectedPeerPort,
            infoHash: result.infoHash
        });

        result.server.once("close", () => {
            activePeerServers.delete(selectedPeerId);
            torrentState.status = "stopped";
        });

        res.status(200).json({
            success: true,
            message: "File is now being shared",
            seeder: {
                name: result.name,
                infoHash: result.infoHash,
                torrentPath: result.torrentPath,
                peerId: selectedPeerId,
                peerPort: selectedPeerPort
            }
        });

    } catch (error) {
        console.log("Seeding error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Download torrent API
app.post("/api/torrents/download", async (req, res) => {
    try {
        const {
            torrentFileName,
            peerId,
            peerPort,
            peers,
            sync
        } = req.body;

        if (!torrentFileName) {
            return res.status(400).json({
                success: false,
                message: "Torrent file name is required"
            });
        }

        if (
            path.basename(torrentFileName) !== torrentFileName ||
            path.extname(torrentFileName).toLowerCase() !== ".torrent"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid torrent file name"
            });
        }

        const torrentPath = path.join(
            torrentDirectory,
            torrentFileName
        );

        if (!fs.existsSync(torrentPath)) {
            return res.status(404).json({
                success: false,
                message: "Torrent file not found"
            });
        }

        const torrentBuffer = fs.readFileSync(torrentPath);
        const parsedTorrent = parseTorrent(torrentBuffer);

        const selectedPeerPort = peerPort ?? 5016;

        if (
            !Number.isInteger(selectedPeerPort) ||
            selectedPeerPort < 1024 ||
            selectedPeerPort > 65535
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid peer port"
            });
        }

        const selectedPeerId =
            peerId || "-UT0001-" + crypto.randomBytes(6).toString("hex");

        if (
            typeof selectedPeerId !== "string" ||
            Buffer.byteLength(selectedPeerId, "utf8") !== 20
        ) {
            return res.status(400).json({
                success: false,
                message: "Peer ID must be exactly 20 bytes"
            });
        }

        if (activePeerServers.has(selectedPeerId)) {
            return res.status(409).json({
                success: false,
                message: "This peer is already active"
            });
        }

        const isPortBusy = Array.from(activeTorrents.values()).some(
            t => t.peerPort === selectedPeerPort && (t.status === "downloading" || t.status === "seeding")
        );
        if (isPortBusy) {
            return res.status(409).json({
                success: false,
                message: `Port ${selectedPeerPort} is already in use by another active peer. Please choose a different port (e.g. 5018).`
            });
        }

        const pieceCount = Math.ceil(
            parsedTorrent.length / parsedTorrent.pieceLength
        );

        const torrentState = {
            infoHash: parsedTorrent.infoHash,
            name: parsedTorrent.name,
            torrentFileName,
            peerId: selectedPeerId,
            peerPort: selectedPeerPort,
            status: "downloading",
            progress: 0,
            speed: 0,
            totalSize: parsedTorrent.length,
            downloadedPieces: 0,
            skippedPieces: 0,
            totalPieces: pieceCount,
            peersCount: 0,
            server: null,
            outputPath: null,
            startedAt: Date.now(),
            completedAt: null,
            error: null
        };

        const torrentKey = `${parsedTorrent.infoHash}_${selectedPeerId}`;
        activeTorrents.set(torrentKey, torrentState);

        console.log("Starting torrent download:", torrentFileName);

        const downloadPromise = downloadTorrent({
            torrentPath,
            peerId: selectedPeerId,
            peerPort: selectedPeerPort,
            downloadDir: path.join(downloadDirectory, "client-downloads"),
            peers: Array.isArray(peers) ? peers : [],
            onProgress: (progressData) => {
                torrentState.downloadedPieces = progressData.downloadedPieces;
                torrentState.skippedPieces = progressData.skippedPieces;
                torrentState.progress = progressData.progress;
                torrentState.speed = progressData.speed;
                torrentState.peersCount = progressData.peersCount;
            }
        }).then((result) => {
            torrentState.status = "seeding";
            torrentState.progress = 100;
            torrentState.speed = 0;
            torrentState.outputPath = result.outputPath;
            torrentState.server = result.server;
            torrentState.completedAt = Date.now();

            activePeerServers.set(selectedPeerId, {
                server: result.server,
                name: result.name,
                peerPort: selectedPeerPort,
                infoHash: result.infoHash
            });

            result.server.once("close", () => {
                activePeerServers.delete(selectedPeerId);
                torrentState.status = "stopped";
            });

            return result;
        }).catch((error) => {
            console.log("Download error:", error.message);
            torrentState.status = "failed";
            torrentState.error = error.message;
            torrentState.speed = 0;
            throw error;
        });

        // If client requested synchronous execution
        if (sync === true) {
            const result = await downloadPromise;
            return res.status(200).json({
                success: true,
                message: "Torrent downloaded successfully",
                download: {
                    name: result.name,
                    size: result.size,
                    outputPath: result.outputPath,
                    peerId: selectedPeerId,
                    peerPort: selectedPeerPort
                }
            });
        }

        // Default: asynchronous response immediately
        res.status(202).json({
            success: true,
            message: "Torrent download started in background",
            torrent: {
                infoHash: parsedTorrent.infoHash,
                name: parsedTorrent.name,
                size: parsedTorrent.length,
                pieceCount,
                peerId: selectedPeerId,
                peerPort: selectedPeerPort,
                status: "downloading"
            }
        });

    } catch (error) {
        console.log("Download error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Stop sharing API
app.post("/api/torrents/stop", (req, res) => {
    try {
        const { peerId, infoHash } = req.body;

        if (!peerId && !infoHash) {
            return res.status(400).json({
                success: false,
                message: "Either peerId or infoHash is required"
            });
        }

        let targetPeerId = peerId;
        let torrent = null;

        if (infoHash) {
            for (const t of activeTorrents.values()) {
                if (t.infoHash === infoHash) {
                    torrent = t;
                    targetPeerId = t.peerId;
                    break;
                }
            }
        }

        if (!torrent && targetPeerId) {
            for (const t of activeTorrents.values()) {
                if (t.peerId === targetPeerId) {
                    torrent = t;
                    break;
                }
            }
        }

        const activePeer = targetPeerId ? activePeerServers.get(targetPeerId) : null;

        if (!activePeer && !torrent) {
            return res.status(404).json({
                success: false,
                message: "Active torrent or peer not found"
            });
        }

        if (targetPeerId) {
            activePeerServers.delete(targetPeerId);
        }

        if (torrent) {
            torrent.status = "stopped";
            torrent.speed = 0;
            if (torrent.server) {
                torrent.server.close();
                torrent.server = null;
            }
        }

        if (activePeer && activePeer.server) {
            activePeer.server.close(() => {
                console.log("Peer server stopped:", targetPeerId);
            });
        }

        res.status(200).json({
            success: true,
            message: "Sharing stopped successfully",
            peerId: targetPeerId,
            infoHash: torrent?.infoHash
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get all torrents status API (for progress tracking & UI)
app.get("/api/torrents/status", (req, res) => {
    const torrents = Array.from(activeTorrents.values()).map(
        ({ server, ...torrentInfo }) => torrentInfo
    );

    res.status(200).json({
        success: true,
        count: torrents.length,
        torrents
    });
});

// Get single torrent status API
app.get("/api/torrents/status/:infoHash", (req, res) => {
    const { infoHash } = req.params;
    let torrent = null;
    for (const t of activeTorrents.values()) {
        if (t.infoHash === infoHash) {
            torrent = t;
            break;
        }
    }

    if (!torrent) {
        return res.status(404).json({
            success: false,
            message: "Torrent not found"
        });
    }

    const { server, ...torrentInfo } = torrent;

    res.status(200).json({
        success: true,
        torrent: torrentInfo
    });
});

// Get active peers API
app.get("/api/torrents/active", (req, res) => {
    const peers = Array.from(activePeerServers.entries()).map(
        ([peerId, peer]) => ({
            peerId,
            name: peer.name,
            peerPort: peer.peerPort,
            infoHash: peer.infoHash
        })
    );

    res.status(200).json({
        success: true,
        count: peers.length,
        peers
    });
});

app.listen(config.port, () => {
    console.log(
        `Client backend running at http://localhost:${config.port}`
    );
});
