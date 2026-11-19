const PROTOCOL = "BitTorrent protocol";

function createHandshake(infoHash, peerId) {
    const handshake = Buffer.alloc(68);

    handshake.writeUInt8(PROTOCOL.length, 0);
    handshake.write(PROTOCOL, 1);

    // Reserved bytes (8 bytes) are already zero.

    Buffer.from(infoHash, "hex").copy(handshake, 28);
    Buffer.from(peerId, "utf8").copy(handshake, 48, 0, 20);

    return handshake;
}

function parseHandshake(buffer) {
    if (buffer.length !== 68) {
        throw new Error("Invalid handshake length");
    }

    const protocolLength = buffer.readUInt8(0);
    const protocol = buffer.toString("utf8", 1, 1 + protocolLength);

    if (protocol !== PROTOCOL) {
        throw new Error("Invalid BitTorrent protocol");
    }

    return {
        infoHash: buffer.subarray(28, 48).toString("hex"),
        peerId: buffer.subarray(48, 68).toString("utf8")
    };
}

module.exports = {
    createHandshake,
    parseHandshake
};