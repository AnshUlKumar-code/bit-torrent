const express = require("express");
const config = require("./config");
const createTorrent = require("./torrent/TorrentCreator");

const path = require("path");

const app = express();

app.use(express.json());

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "uTorrent client backend is running"
    });
});
app.post("/api/torrents/create", (req, res) => {
    try {
        const { filePath } = req.body;

        if (!filePath) {
            return res.status(400).json({
                success: false,
                message: "File path is required"
            });
        }

        const outputPath = path.join(
            config.torrentDir,
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

app.listen(config.port, () => {
    console.log(`Client backend running at http://localhost:${config.port}`);
});