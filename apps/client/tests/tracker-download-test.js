
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const startPeerServer = require("../src/peer/PeerServer");
const { announce } = require("../src/tracker/TrackerClient");
const { savePiece } = require("../src/storage/PieceStorage");
const downloadFromTracker = require("../src/download/TrackerDownload");

const downloadDir = path.resolve(
    __dirname,
    "../../../data/downloads"
);

async function waitForServer(server) {
    if (server.listening) return;

    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });
}

async function main() {
    const data = Buffer.from("Hello BitTorrent");

    const pieceHash = crypto
        .createHash("sha1")
        .update(data)
        .digest();

    const infoHash = crypto
        .createHash("sha1")
        .update("tracker-download-test")
        .digest("hex");

    const torrent = {
        name: "tracker-test.txt",
        length: data.length,
        pieceLength: data.length,
        pieces: pieceHash,
        infoHash
    };

    const seederId = "seeder001";
    const leecherId = "leecher001";

    let seederServer;
    let leecherServer;

    try {
        fs.mkdirSync(downloadDir, { recursive: true });

        // Prepare the file pieces that the seeder will share.
        savePiece(
            downloadDir,
            "tracker-seed.txt",
            0,
            data,
            pieceHash
        );

        // Start the seeder's peer server.
        seederServer = startPeerServer(
            5012,
            infoHash,
            seederId,
            {
                downloadDir,
                fileName: "tracker-seed.txt",
                pieceCount: 1
            }
        );

        await waitForServer(seederServer);

        // Register the seeder with the tracker.
        await announce(infoHash, seederId, 5012);

        console.log("Seeder registered with tracker");

        // Discover the seeder and download automatically.
        const result = await downloadFromTracker({
            torrent,
            peerId: leecherId,
            peerPort: 5013,
            downloadDir
        });

        leecherServer = result.server;

        const downloadedData = fs.readFileSync(
            result.outputPath,
            "utf8"
        );

        console.log("FINAL RESULT:", result);
        console.log("DOWNLOADED CONTENT:", downloadedData);

        if (downloadedData !== data.toString("utf8")) {
            throw new Error("Downloaded content does not match");
        }

        console.log("PASS: Automatic tracker download works");

    } catch (error) {
        console.log("TEST FAILED:", error.message);
    } finally {
        if (leecherServer) leecherServer.close();
        if (seederServer) seederServer.close();
    }
}

main();
