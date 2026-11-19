
const {
    parseMessage,
    parseHaveMessage,
    parsePieceMessage
} = require("./WireProtocol");

const { hasPiece } = require("./Bitfield");

function attachPeerMessageHandler(
    socket,
    pieceCount,
    initialData = Buffer.alloc(0),
    callbacks = {}
) {
    let received = initialData;

    function processMessages() {
        while (received.length >= 4) {
            const messageLength = received.readUInt32BE(0);
            const totalLength = 4 + messageLength;

            if (received.length < totalLength) {
                return;
            }

            const messageBuffer = received.subarray(0, totalLength);
            received = received.subarray(totalLength);

            try {
                const message = parseMessage(messageBuffer);

                switch (message.type) {
                    case "BITFIELD": {
                        const bitfield = message.payload;

                        if (bitfield.length !== Math.ceil(pieceCount / 8)) {
                            throw new Error("Invalid bitfield length");
                        }

                        console.log("Received BITFIELD:", bitfield.toString("hex"));

                        const availablePieces = [];

                        for (let i = 0; i < pieceCount; i++) {
                            if (hasPiece(bitfield, i)) {
                                availablePieces.push(i);
                            }
                        }

                        console.log("Available pieces:", availablePieces);

                        callbacks.onBitfield?.(availablePieces, bitfield);
                        break;
                    }

                    case "HAVE": {
                        const pieceIndex = parseHaveMessage(message.payload);

                        if (pieceIndex >= pieceCount) {
                            throw new Error("Invalid piece index");
                        }

                        console.log("Peer has piece:", pieceIndex);
                        callbacks.onHave?.(pieceIndex);
                        break;
                    }

                    case "UNCHOKE":
                        console.log("Peer unchoked us");
                        callbacks.onUnchoke?.();
                        break;

                    case "CHOKE":
                        console.log("Peer choked us");
                        callbacks.onChoke?.();
                        break;

                    case "PIECE": {
                        const piece = parsePieceMessage(message.payload);

                        console.log(
                            "Received piece block:",
                            piece.pieceIndex,
                            "at",
                            piece.begin
                        );

                        callbacks.onPiece?.(piece);
                        break;
                    }

                    case "KEEP_ALIVE":
                        break;

                    default:
                        callbacks.onMessage?.(message);
                        break;
                }
            } catch (error) {
                console.log("Message handling error:", error.message);
                socket.destroy();
                return;
            }
        }
    }

    socket.on("data", (data) => {
        received = Buffer.concat([received, data]);
        processMessages();
    });

    socket.on("error", (error) => {
        console.log("Peer socket error:", error.message);
    });

    // Process any data received along with the handshake.
    processMessages();

    return {
        getAvailableData: () => received
    };
}

module.exports = attachPeerMessageHandler;
