
const express = require("express");
const config = require("./config");

const createTorrent = require("./torrent/TorrentCreator");
const downloadTorrent = require("./download/TorrentDownload");
const startSeeding = require("./upload/SeederManager");

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

app.use(express.json());

const activePeerServers = new Map();

const torrentDirectory = path.resolve(
    process.cwd(),
    config.torrentDir
);

const downloadDirectory = path.resolve(
    process.cwd(),
    config.downloadDir
);

// Health API
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "uTorrent client backend is running"
    });
});

// Create torrent API
app.post("/api/torrents/create", (req, res) => {
    try {
        const { filePath } = req.body;

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
        const { filePath, peerId, peerPort } = req.body;

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

        activePeerServers.set(selectedPeerId, {
            server: result.server,
            name: result.name,
            peerPort: selectedPeerPort,
            infoHash: result.infoHash
        });

        result.server.once("close", () => {
            activePeerServers.delete(selectedPeerId);
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
            peerPort
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

        console.log("Starting torrent download:", torrentFileName);

     const result = await downloadTorrent({
    torrentPath,
    peerId: selectedPeerId,
    peerPort: selectedPeerPort,
    downloadDir: path.join(downloadDirectory, "client-downloads")
});

        activePeerServers.set(selectedPeerId, {
            server: result.server,
            name: result.name,
            peerPort: selectedPeerPort,
            infoHash: null
        });

        result.server.once("close", () => {
            activePeerServers.delete(selectedPeerId);
        });

        res.status(200).json({
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
        const { peerId } = req.body;

        if (!peerId || typeof peerId !== "string") {
            return res.status(400).json({
                success: false,
                message: "Peer ID is required"
            });
        }

        const activePeer = activePeerServers.get(peerId);

        if (!activePeer) {
            return res.status(404).json({
                success: false,
                message: "Active peer not found"
            });
        }

        activePeerServers.delete(peerId);

        activePeer.server.close(() => {
            console.log("Peer server stopped:", peerId);
        });

        res.status(200).json({
            success: true,
            message: "Sharing stopped successfully",
            peerId
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
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
