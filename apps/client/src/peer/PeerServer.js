
const net = require("net");
const {
    createHandshake,
    parseHandshake
} = require("./Handshake");

const {
    MESSAGE_TYPES,
    createMessage,
    parseMessage,
    parseRequestMessage,
    createPieceMessage
} = require("./WireProtocol");

const {
    readPiece
} = require("../storage/PieceStorage");

const {
    createBitfield,
    setPiece
} = require("./Bitfield");

function startPeerServer(port, infoHash, peerId, options = {}) {
    const {
        downloadDir,
        fileName,
        pieceCount = 1
    } = options;

    const server = net.createServer((socket) => {
        console.log("Peer connected:", socket.remoteAddress);

        let received = Buffer.alloc(0);
        let handshakeCompleted = false;
        let isChoked = true;

        socket.on("data", (data) => {
            received = Buffer.concat([received, data]);

            if (!handshakeCompleted && received.length >= 68) {
                try {
                    console.log(
    "Raw handshake bytes:",
    received.subarray(0, 24).toString("hex")
);
                    const handshake = parseHandshake(
                        received.subarray(0, 68)
                    );

                    if (handshake.infoHash !== infoHash) {
                        throw new Error("Info hash mismatch");
                    }

                    handshakeCompleted = true;
                    received = received.subarray(68);

                    console.log("Handshake verified");

                    socket.write(createHandshake(infoHash, peerId));

                    if (downloadDir && fileName) {
                        const bitfield = createBitfield(pieceCount);

                        for (let i = 0; i < pieceCount; i++) {
                            try {
                                readPiece(downloadDir, fileName, i);
                                setPiece(bitfield, i);
                            } catch (error) {
                                // Piece is not available.
                            }
                        }

                        socket.write(
                            createMessage(
                                MESSAGE_TYPES.BITFIELD,
                                bitfield
                            )
                        );

                        console.log("BITFIELD sent:", bitfield);
                    }
                } catch (error) {
                    console.log("Handshake failed:", error.message);
                    socket.destroy();
                    return;
                }
            }

            while (handshakeCompleted && received.length >= 4) {
                const messageLength = received.readUInt32BE(0);
                const totalLength = 4 + messageLength;

                if (received.length < totalLength) break;

                const messageBuffer = received.subarray(0, totalLength);
                received = received.subarray(totalLength);

                try {
                    const message = parseMessage(messageBuffer);

                    switch (message.type) {
                        case "INTERESTED":
                            console.log("Peer is interested");
                            isChoked = false;
                            socket.write(
                                createMessage(MESSAGE_TYPES.UNCHOKE)
                            );
                            break;

                        case "REQUEST": {
                            if (isChoked || !downloadDir || !fileName) break;

                            const { pieceIndex, begin, length } =
                                parseRequestMessage(message.payload);

                            if (length < 1 || length > 16384 || begin < 0) {
                                throw new Error("Invalid block request");
                            }

                            const piece = readPiece(
                                downloadDir,
                                fileName,
                                pieceIndex
                            );

                            if (begin + length > piece.length) {
                                throw new Error("Invalid block range");
                            }

                            const block = piece.subarray(begin, begin + length);

                            socket.write(
                                createPieceMessage(pieceIndex, begin, block)
                            );

                            console.log("Uploaded piece:", pieceIndex);
                            break;
                        }

                        case "KEEP_ALIVE":
                            break;

                        default:
                            console.log("Received:", message.type);
                    }
                } catch (error) {
                    console.log("Message error:", error.message);
                    socket.destroy();
                    break;
                }
            }
        });

        socket.on("error", error => {
            console.log("Socket error:", error.message);
        });
    });

    server.listen(port, "0.0.0.0", () => {
        console.log(`Peer server listening on 0.0.0.0:${port}`);
    });

    return server;
}

module.exports = startPeerServer;
