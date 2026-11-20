const MESSAGE_TYPES = {
    CHOKE: 0,
    UNCHOKE: 1,
    INTERESTED: 2,
    NOT_INTERESTED: 3,
    HAVE: 4,
    BITFIELD: 5,
    REQUEST: 6,
    PIECE: 7,
    CANCEL: 8,
    PORT: 9,
    SUGGEST_PIECE: 13,
    HAVE_ALL: 14,
    HAVE_NONE: 15,
    REJECT_REQUEST: 16,
    ALLOWED_FAST: 17,
    EXTENDED: 20
};

function createMessage(type, payload = Buffer.alloc(0)) {
    const length = 1 + payload.length;
    const message = Buffer.alloc(4 + length);

    message.writeUInt32BE(length, 0);
    message.writeUInt8(type, 4);
    payload.copy(message, 5);

    return message;
}

function parseMessage(buffer) {
    if (buffer.length < 4) {
        throw new Error("Incomplete message");
    }

    const length = buffer.readUInt32BE(0);

    if (length === 0) {
        return { type: "KEEP_ALIVE" };
    }

    if (buffer.length < 4 + length) {
        throw new Error("Incomplete message");
    }

    const type = buffer.readUInt8(4);

    const messageType = Object.keys(MESSAGE_TYPES)
        .find(key => MESSAGE_TYPES[key] === type);

    return {
        type: messageType || "UNKNOWN",
        rawType: type,
        payload: buffer.subarray(5, 4 + length)
    };
}

function createHaveMessage(pieceIndex) {
    const payload = Buffer.alloc(4);
    payload.writeUInt32BE(pieceIndex, 0);

    return createMessage(MESSAGE_TYPES.HAVE, payload);
}

function parseHaveMessage(payload) {
    if (payload.length !== 4) {
        throw new Error("Invalid HAVE message");
    }

    return payload.readUInt32BE(0);
}

function createRequestMessage(pieceIndex, begin, length) {
    const payload = Buffer.alloc(12);

    payload.writeUInt32BE(pieceIndex, 0);
    payload.writeUInt32BE(begin, 4);
    payload.writeUInt32BE(length, 8);

    return createMessage(MESSAGE_TYPES.REQUEST, payload);
}

function parseRequestMessage(payload) {
    if (payload.length !== 12) {
        throw new Error("Invalid REQUEST message");
    }

    return {
        pieceIndex: payload.readUInt32BE(0),
        begin: payload.readUInt32BE(4),
        length: payload.readUInt32BE(8)
    };
}

function createPieceMessage(pieceIndex, begin, block) {
    const payload = Buffer.alloc(8 + block.length);

    payload.writeUInt32BE(pieceIndex, 0);
    payload.writeUInt32BE(begin, 4);
    block.copy(payload, 8);

    return createMessage(MESSAGE_TYPES.PIECE, payload);
}

function parsePieceMessage(payload) {
    if (payload.length < 8) {
        throw new Error("Invalid PIECE message");
    }

    return {
        pieceIndex: payload.readUInt32BE(0),
        begin: payload.readUInt32BE(4),
        block: payload.subarray(8)
    };
}

module.exports = {
    MESSAGE_TYPES,
    createMessage,
    parseMessage,
    createHaveMessage,
    parseHaveMessage,
    createRequestMessage,
    parseRequestMessage,
    createPieceMessage,
    parsePieceMessage
};