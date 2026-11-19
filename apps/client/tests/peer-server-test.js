const net = require("net");
const startPeerServer = require("../src/peer/PeerServer");

const server = startPeerServer(5001);

const client = net.createConnection(
    { port: 5001 },
    () => {
        console.log("Connected to peer server");
        client.write("Hello from peer001");
    }
);

client.on("close", () => {
    server.close();
});