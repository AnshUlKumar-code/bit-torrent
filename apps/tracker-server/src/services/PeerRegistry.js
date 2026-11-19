const torrents = new Map();

function addPeer(infoHash, peer) {
    if (!torrents.has(infoHash)) {
        torrents.set(infoHash, new Map());
    }

    torrents.get(infoHash).set(peer.peerId, peer);
}

function getPeers(infoHash, requestingPeerId) {
    if (!torrents.has(infoHash)) {
        return [];
    }

    return Array.from(torrents.get(infoHash).values())
        .filter(peer => peer.peerId !== requestingPeerId);
}
module.exports = {
    addPeer,
    getPeers
};