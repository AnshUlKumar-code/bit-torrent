const path = require("path");
require("dotenv").config();

const port = process.env.PORT || process.env.CLIENT_PORT || 3000;
const hostUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

const projectRoot = path.resolve(__dirname, "../../../");

const defaultTracker = hostUrl.endsWith("/announce") ? hostUrl : `${hostUrl}/announce`;

module.exports = {
    port,
    trackerUrl: process.env.TRACKER_URL || defaultTracker,
    downloadDir: process.env.DOWNLOAD_DIR || path.join(projectRoot, "data/downloads"),
    torrentDir: process.env.TORRENT_DIR || path.join(projectRoot, "data/torrents")
};
