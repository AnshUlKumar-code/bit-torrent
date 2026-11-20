/**
 * TrackerMetrics - Swarm Density & Announce Rate Diagnostics
 * Contributed by @AnirudhSharma-code (Backend)
 */

class TrackerMetrics {
    constructor() {
        this.totalAnnounces = 0;
        this.activeSwarms = new Set();
        this.eventsCount = {
            started: 0,
            completed: 0,
            stopped: 0,
            regular: 0
        };
        this.startTime = Date.now();
    }

    recordAnnounce(infoHash, event) {
        this.totalAnnounces++;
        this.activeSwarms.add(infoHash);

        if (event && this.eventsCount[event] !== undefined) {
            this.eventsCount[event]++;
        } else {
            this.eventsCount.regular++;
        }
    }

    getStats() {
        const uptimeSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
        return {
            totalAnnounces: this.totalAnnounces,
            activeSwarmsCount: this.activeSwarms.size,
            announcesPerSecond: parseFloat((this.totalAnnounces / uptimeSeconds).toFixed(2)),
            events: this.eventsCount,
            uptimeSeconds
        };
    }
}

module.exports = new TrackerMetrics();
