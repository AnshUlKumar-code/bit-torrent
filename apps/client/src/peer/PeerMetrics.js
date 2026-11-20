/**
 * PeerMetrics - Real-time BitTorrent Swarm & Peer Performance Analyzer
 * Contributed by @AnirudhSharma-code (Backend)
 */

class PeerMetrics {
    constructor() {
        this.metrics = new Map();
        this.globalStats = {
            totalUploaded: 0,
            totalDownloaded: 0,
            peakSpeed: 0,
            activePeers: 0
        };
    }

    /**
     * Record chunk transfer event
     */
    recordTransfer(peerId, { type, bytes, durationMs = 1 }) {
        if (!this.metrics.has(peerId)) {
            this.metrics.set(peerId, {
                uploadedBytes: 0,
                downloadedBytes: 0,
                transfersCount: 0,
                lastSeen: Date.now(),
                avgSpeedBytesPerSec: 0,
                latencyMs: 0
            });
        }

        const peer = this.metrics.get(peerId);
        peer.lastSeen = Date.now();
        peer.transfersCount++;

        const currentSpeed = (bytes / (durationMs / 1000));

        if (type === "upload") {
            peer.uploadedBytes += bytes;
            this.globalStats.totalUploaded += bytes;
        } else if (type === "download") {
            peer.downloadedBytes += bytes;
            this.globalStats.totalDownloaded += bytes;
            if (currentSpeed > this.globalStats.peakSpeed) {
                this.globalStats.peakSpeed = currentSpeed;
            }
        }

        // Exponential moving average for speed
        peer.avgSpeedBytesPerSec = peer.avgSpeedBytesPerSec === 0
            ? currentSpeed
            : (peer.avgSpeedBytesPerSec * 0.7) + (currentSpeed * 0.3);

        return peer;
    }

    /**
     * Calculate swarm health score (0 - 100)
     */
    calculateSwarmHealth(seedersCount, leechersCount, pieceCompletionRate = 1.0) {
        if (seedersCount === 0 && leechersCount === 0) return 0;
        const total = seedersCount + leechersCount;
        const seederRatio = seedersCount / Math.max(1, total);
        const healthScore = Math.min(100, Math.round((seederRatio * 60) + (pieceCompletionRate * 40)));
        return healthScore;
    }

    /**
     * Get snapshot of metrics for all peers
     */
    getSummary() {
        this.globalStats.activePeers = this.metrics.size;
        return {
            ...this.globalStats,
            peers: Array.from(this.metrics.entries()).map(([peerId, data]) => ({
                peerId,
                ...data
            }))
        };
    }

    /**
     * Reset or prune inactive peers
     */
    pruneInactive(timeoutMs = 5 * 60 * 1000) {
        const now = Date.now();
        for (const [peerId, data] of this.metrics.entries()) {
            if (now - data.lastSeen > timeoutMs) {
                this.metrics.delete(peerId);
            }
        }
    }
}

module.exports = new PeerMetrics();
