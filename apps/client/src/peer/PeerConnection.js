
const net = require("net");
const {
    createHandshake,
    parseHandshake
} = require("./Handshake");

const {
    MESSAGE_TYPES,
    createMessage
} = require("./WireProtocol");

const attachPeerMessageHandler = require("./PeerMessageHandler");

function connectToPeer(
    ip,
    port,
    infoHash,
    peerId,
    options = {}
) {
    return new Promise((resolve, reject) => {
        const socket = net.connect(port, ip);

        const pieceCount = options.pieceCount || 1;
        const callbacks = options.callbacks || {};

        let received = Buffer.alloc(0);
        let handshakeCompleted = false;

        socket.setTimeout(10000);

        function handleData(data) {
            received = Buffer.concat([received, data]);

            if (received.length < 68) return;

            try {
                const handshake = parseHandshake(
                    received.subarray(0, 68)
                );

                if (handshake.infoHash !== infoHash) {
                    throw new Error("Info hash mismatch");
                }

                handshakeCompleted = true;

                const remainingData = received.subarray(68);

                socket.removeListener("data", handleData);

                console.log("Handshake verified:", handshake.peerId);

                // Start processing BitTorrent messages.
                const handler = attachPeerMessageHandler(
                    socket,
                    pieceCount,
                    remainingData,
                    callbacks
                );

                // Tell the remote peer we want its pieces.
                socket.write(
                    createMessage(MESSAGE_TYPES.INTERESTED)
                );

                console.log("INTERESTED message sent");

                socket.setTimeout(0);

                resolve({
                    socket,
                    handshake,
                    handler
                });

            } catch (error) {
                socket.destroy();
                reject(error);
            }
        }

        socket.on("connect", () => {
            console.log("Connected to peer:", ip, port);

            socket.write(createHandshake(infoHash, peerId));
        });

        socket.on("data", handleData);

        socket.on("timeout", () => {
            socket.destroy();

            if (!handshakeCompleted) {
                reject(new Error("Peer connection timed out"));
            }
        });

        socket.on("error", error => {
            if (!handshakeCompleted) {
                reject(error);
            }
        });
    });
}

module.exports = connectToPeer;
