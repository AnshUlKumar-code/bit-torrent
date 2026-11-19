require("dotenv").config();

module.exports = {
    port: process.env.CLIENT_PORT || 3000,
    trackerUrl: process.env.TRACKER_URL || "http://localhost:4000",
    downloadDir: process.env.DOWNLOAD_DIR || "../../data/downloads",
    torrentDir: process.env.TORRENT_DIR || "../../data/torrents"
};