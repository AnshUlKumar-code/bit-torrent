
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
                        const minBytes = Math.ceil(pieceCount / 8);

                        if (bitfield.length < minBytes) {
                            throw new Error("Invalid bitfield length");
                        }

                        console.log("Received BITFIELD:", bitfield.subarray(0, minBytes).toString("hex"));

                        const availablePieces = [];

                        for (let i = 0; i < pieceCount; i++) {
                            if (hasPiece(bitfield, i)) {
                                availablePieces.push(i);
                            }
                        }

                        console.log("Available pieces from bitfield:", availablePieces.length);

                        callbacks.onBitfield?.(availablePieces, bitfield);
                        break;
                    }

                    case "HAVE": {
                        const pieceIndex = parseHaveMessage(message.payload);

                        if (pieceIndex >= pieceCount) {
                            console.log("Ignored HAVE for out-of-range piece:", pieceIndex);
                            break;
                        }

                        console.log("Peer has piece:", pieceIndex);
                        callbacks.onHave?.(pieceIndex);
                        break;
                    }

                    case "HAVE_ALL": {
                        console.log("Peer has ALL pieces (HAVE_ALL)");
                        const allPieces = Array.from({ length: pieceCount }, (_, i) => i);
                        callbacks.onHaveAll?.(allPieces);
                        break;
                    }

                    case "HAVE_NONE":
                        console.log("Peer has NO pieces (HAVE_NONE)");
                        callbacks.onHaveNone?.();
                        break;

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

                    case "PORT":
                    case "EXTENDED":
                    case "UNKNOWN":
                        console.log(`Received wire message: ${message.type} (id: ${message.rawType})`);
                        callbacks.onMessage?.(message);
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
