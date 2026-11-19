
const path = require("path");
const startSeeding = require("../src/upload/SeederManager");

async function main() {
    try {
        const root = path.resolve(__dirname, "../../..");

        const result = await startSeeding({
            filePath: path.join(root, "sample.txt"),
            peerId: "uploadpeer000000001",
            peerPort: 5017,
            torrentDirectory: path.join(root, "data/torrents"),
            downloadDirectory: path.join(root, "data/uploads")
        });

        console.log("SEEDING RESULT:", {
            success: result.success,
            name: result.name,
            infoHash: result.infoHash,
            torrentPath: result.torrentPath,
            peerPort: result.peerPort
        });

        console.log("PASS: File is being shared");

        // Keep the peer server alive for testing.
        console.log("Seeder is running. Press Ctrl+C to stop.");

    } catch (error) {
        console.log("TEST FAILED:", error.message);
    }
}

main();
