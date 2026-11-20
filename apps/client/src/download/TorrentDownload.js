
const fs = require("fs");

const parseTorrent = require("../torrent/TorrentParser");
const downloadFromTracker = require("./TrackerDownload");

async function downloadTorrent({
    torrentPath,
    peerId,
    peerPort,
    downloadDir,
    peers = [],
    onProgress
}) {
    if (!fs.existsSync(torrentPath)) {
        throw new Error("Torrent file not found: " + torrentPath);
    }

    console.log("Reading torrent:", torrentPath);

    const torrentBuffer = fs.readFileSync(torrentPath);

    // Parse the actual .torrent file.
    const torrent = parseTorrent(torrentBuffer);

    console.log("Torrent parsed successfully");
    console.log("File name:", torrent.name);
    console.log("File size:", torrent.length);
    console.log("Info hash:", torrent.infoHash);

    // Discover peers and download the file.
    return downloadFromTracker({
        torrent,
        peerId,
        peerPort,
        downloadDir,
        peers,
        onProgress
    });
}

module.exports = downloadTorrent;
