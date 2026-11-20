
const test = require("node:test");
const assert = require("node:assert/strict");

const {
    addPeer,
    getPeers,
    cleanExpiredPeers
} = require("../apps/tracker-server/src/services/PeerRegistry");

test("should add a peer and return it", () => {
    const infoHash = "torrent1";

    addPeer(infoHash, {
        peerId: "peer1",
        ip: "127.0.0.1",
        port: 6881
    });

    const peers = getPeers(infoHash, "peer2");

    assert.equal(peers.length, 1);
    assert.equal(peers[0].peerId, "peer1");
});

test("should not return the requesting peer", () => {
    const infoHash = "torrent2";

    addPeer(infoHash, {
        peerId: "peer1",
        ip: "127.0.0.1",
        port: 6881
    });

    const peers = getPeers(infoHash, "peer1");

    assert.equal(peers.length, 0);
});

test("should remove expired peers", () => {
    const infoHash = "torrent3";

    addPeer(infoHash, {
        peerId: "peer1",
        ip: "127.0.0.1",
        port: 6881
    });

    cleanExpiredPeers(Date.now() + 3 * 60 * 1000);

    const peers = getPeers(infoHash, "peer2");

    assert.equal(peers.length, 0);
});
