const net = require("net");
const startPeerServer = require("../src/peer/PeerServer");
const { createHandshake, parseHandshake } = require("../src/peer/Handshake");

const infoHash = "3b794d3092cb05d09f15cadc4210fbf33b717081";

const server = startPeerServer(5004, infoHash, "peer001");

const client = net.createConnection({ port: 5004 }, () => {
    console.log("Connected to peer001");

    client.write(createHandshake(infoHash, "peer002"));
});

let received = Buffer.alloc(0);

client.on("data", (data) => {
    received = Buffer.concat([received, data]);

    if (received.length >= 68) {
        console.log("Server handshake:", parseHandshake(received.subarray(0, 68)));

        client.end();
        server.close();
    }
});

client.on("error", console.error);