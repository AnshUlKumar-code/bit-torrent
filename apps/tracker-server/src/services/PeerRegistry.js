
const torrents = new Map();

const PEER_TIMEOUT = 2 * 60 * 1000; // 2 minutes

function addPeer(infoHash, peer) {
    if (!torrents.has(infoHash)) {
        torrents.set(infoHash, new Map());
    }

    const peers = torrents.get(infoHash);

    peers.set(peer.peerId, {
        ...peer,
        lastSeen: Date.now()
    });
}

function cleanExpiredPeers(now = Date.now()) {
    for (const [infoHash, peers] of torrents.entries()) {
        for (const [peerId, peer] of peers.entries()) {
            if (now - peer.lastSeen > PEER_TIMEOUT) {
                peers.delete(peerId);
                console.log("Removed inactive peer:", peerId);
            }
        }

        if (peers.size === 0) {
            torrents.delete(infoHash);
        }
    }
}

function getPeers(infoHash, requestingPeerId) {
    cleanExpiredPeers();

    if (!torrents.has(infoHash)) {
        return [];
    }

    const uniquePeers = new Map();

    for (const peer of torrents.get(infoHash).values()) {
        if (peer.peerId === requestingPeerId) {
            continue;
        }

        // Use IP + port as the unique peer identity.
        const peerKey = `${peer.ip}:${peer.port}`;

        // Keep only one entry for each IP and port.
        uniquePeers.set(peerKey, peer);
    }

    return Array.from(uniquePeers.values()).map(
        ({ lastSeen, ...peer }) => peer
    );
}

module.exports = {
    addPeer,
    getPeers,
    cleanExpiredPeers
};
