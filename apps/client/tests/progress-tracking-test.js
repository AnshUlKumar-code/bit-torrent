const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const parseTorrent = require("../src/torrent/TorrentParser");
const createTorrent = require("../src/torrent/TorrentCreator");
const startPeerServer = require("../src/peer/PeerServer");
const { savePiece } = require("../src/storage/PieceStorage");
const downloadFile = require("../src/download/DownloadManager");

async function main() {
    console.log("Running Progress Tracking Unit Test...");

    const testDir = path.resolve(__dirname, "../../../data/downloads/progress-test");
    fs.mkdirSync(testDir, { recursive: true });

    // Create a 512 KB payload (2 pieces of 256 KB)
    const pieceLength = 256 * 1024;
    const testData = crypto.randomBytes(pieceLength * 2);

    const pieceHashes = [
        crypto.createHash("sha1").update(testData.subarray(0, pieceLength)).digest(),
        crypto.createHash("sha1").update(testData.subarray(pieceLength)).digest()
    ];

    const torrent = {
        name: "progress-test.bin",
        length: testData.length,
        pieceLength,
        pieces: Buffer.concat(pieceHashes),
        infoHash: crypto.randomBytes(20).toString("hex")
    };

    // Store pieces for seeder
    savePiece(testDir, torrent.name, 0, testData.subarray(0, pieceLength), pieceHashes[0]);
    savePiece(testDir, torrent.name, 1, testData.subarray(pieceLength), pieceHashes[1]);

    // Start peer server
    const seederPort = 5020;
    const seederServer = startPeerServer(
        seederPort,
        torrent.infoHash,
        "-UT0001-progressseeder",
        {
            downloadDir: testDir,
            fileName: torrent.name,
            pieceCount: 2
        }
    );

    await new Promise((resolve, reject) => {
        seederServer.once("listening", resolve);
        seederServer.once("error", reject);
    });

    const progressReports = [];
    const clientDownloadDir = path.join(testDir, "client");

    try {
        const result = await downloadFile({
            peers: [{ ip: "127.0.0.1", port: seederPort }],
            torrent,
            downloadDir: clientDownloadDir,
            peerId: "-UT0001-progressleecher",
            onProgress: (progress) => {
                console.log("Progress reported:", progress);
                progressReports.push(progress);
            }
        });

        console.log("Download result:", result);

        if (progressReports.length === 0) {
            throw new Error("FAIL: onProgress callback was never called");
        }

        const lastReport = progressReports[progressReports.length - 1];
        if (lastReport.completedPieces !== 2 || lastReport.progress !== 100) {
            throw new Error(`FAIL: Final progress report invalid: ${JSON.stringify(lastReport)}`);
        }

        const downloadedData = fs.readFileSync(result.outputPath);
        if (!downloadedData.equals(testData)) {
            throw new Error("FAIL: Downloaded file content mismatch");
        }

        console.log("PASS: Progress tracking verified successfully! All pieces downloaded and verified.");
    } finally {
        seederServer.close();
    }
}

module.exports = main;
if (require.main === module) {
    main().catch(err => {
        console.error("Test failed:", err);
        process.exitCode = 1;
    });
}
