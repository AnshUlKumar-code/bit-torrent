
const connectToPeer = require("../peer/PeerConnection");
const { createRequestMessage } = require("../peer/WireProtocol");
const downloadPiece = require("./PieceDownloader");

function downloadFromPeer({
    ip,
    port,
    infoHash,
    peerId,
    pieceCount,
    pieceIndex,
    pieceLength,
    expectedHash,
    downloadDir,
    fileName
}) {
    return new Promise((resolve, reject) => {
        let socket;
        const availablePieces = new Set();
        let unchoked = false;
        let requested = false;
        let completed = false;

        const blocks = new Map();
        const blockSize = 16384;

        function fail(error) {
            if (completed) return;
            completed = true;

            if (socket) socket.destroy();

            reject(error);
        }

        function requestBlocks() {
            if (
                requested ||
                !socket ||
                !unchoked
            ) return;

            // If peer announced pieces and does not have this one:
            if (availablePieces.size > 0 && !availablePieces.has(pieceIndex)) {
                fail(new Error("Peer does not have piece " + pieceIndex));
                return;
            }

            requested = true;

            console.log("Requesting piece:", pieceIndex);

            for (let begin = 0; begin < pieceLength; begin += blockSize) {
                const length = Math.min(
                    blockSize,
                    pieceLength - begin
                );

                socket.write(
                    createRequestMessage(pieceIndex, begin, length)
                );
            }
        }

        async function connect() {
            try {
                const connection = await connectToPeer(
                    ip,
                    port,
                    infoHash,
                    peerId,
                    {
                        pieceCount,

                        callbacks: {
                            onBitfield: (pieces) => {
                                pieces.forEach(p => availablePieces.add(p));
                                requestBlocks();
                            },

                            onHave: (index) => {
                                availablePieces.add(index);
                                requestBlocks();
                            },

                            onHaveAll: (allPieces) => {
                                allPieces.forEach(p => availablePieces.add(p));
                                requestBlocks();
                            },

                            onUnchoke: () => {
                                unchoked = true;
                                requestBlocks();
                            },

                            onPiece: (piece) => {
                                if (completed) return;

                                if (piece.pieceIndex !== pieceIndex) {
                                    fail(new Error("Unexpected piece received"));
                                    return;
                                }

                                const expectedLength = Math.min(
                                    blockSize,
                                    pieceLength - piece.begin
                                );

                                if (
                                    piece.begin < 0 ||
                                    piece.begin % blockSize !== 0 ||
                                    piece.begin >= pieceLength ||
                                    piece.block.length !== expectedLength
                                ) {
                                    fail(new Error("Invalid piece block"));
                                    return;
                                }

                                blocks.set(piece.begin, piece.block);

                                console.log(
                                    "Received block:",
                                    blocks.size
                                );

                                const totalBlocks = Math.ceil(
                                    pieceLength / blockSize
                                );

                                if (blocks.size === totalBlocks) {
                                    try {
                                        const result = downloadPiece({
                                            downloadDir,
                                            fileName,
                                            pieceIndex,
                                            pieceLength,
                                            expectedHash,
                                            blocks: Array.from(
                                                blocks,
                                                ([begin, data]) => ({
                                                    begin,
                                                    data
                                                })
                                            ).sort((a, b) => a.begin - b.begin)
                                        });

                                        completed = true;
                                        socket.destroy();
                                        resolve(result);

                                    } catch (error) {
                                        fail(error);
                                    }
                                }
                            }
                        }
                    }
                );

                socket = connection.socket;
                socket.on("error", fail);

                requestBlocks();

            } catch (error) {
                fail(error);
            }
        }

        connect();
    });
}

module.exports = downloadFromPeer;
