/**
 * Test Suite: PeerMetrics Swarm Performance
 * Contributed by @AnirudhSharma-code (Backend)
 */

const peerMetrics = require("../src/peer/PeerMetrics");

console.log("=== Testing PeerMetrics Service ===");

// 1. Record Upload & Download
peerMetrics.recordTransfer("peer-A", { type: "download", bytes: 262144, durationMs: 500 });
peerMetrics.recordTransfer("peer-A", { type: "download", bytes: 262144, durationMs: 450 });
peerMetrics.recordTransfer("peer-B", { type: "upload", bytes: 16384, durationMs: 100 });

const summary = peerMetrics.getSummary();
console.log("Active peers count:", summary.activePeers);
console.log("Total downloaded bytes:", summary.totalDownloaded);
console.log("Total uploaded bytes:", summary.totalUploaded);
console.log("Peak speed (bytes/sec):", Math.round(summary.peakSpeed));

// 2. Swarm Health Check
const health = peerMetrics.calculateSwarmHealth(3, 1, 0.95);
console.log("Swarm health score (out of 100):", health);

if (summary.totalDownloaded > 0 && health > 70) {
    console.log("✓ PeerMetrics tests passed successfully!");
} else {
    throw new Error("PeerMetrics test validation failed");
}
