require("dotenv").config();

const port = process.env.PORT || process.env.CLIENT_PORT || 3000;
const hostUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

module.exports = {
    port,
    trackerUrl: process.env.TRACKER_URL || `${hostUrl}`,
    downloadDir: process.env.DOWNLOAD_DIR || "../../data/downloads",
    torrentDir: process.env.TORRENT_DIR || "../../data/torrents"
};
