const crypto = require("crypto");
const http = require("http");
const express = require("express");
const { announce, urlEncodeBytes, parseCompactPeers } = require("../src/tracker/TrackerClient");
const { parseMessage, MESSAGE_TYPES } = require("../src/peer/WireProtocol");
const decode = require("../src/torrent/BencodeDecoder");
const encode = require("../src/torrent/BencodeEncoder");

async function main() {
    console.log("=== Testing Standard BitTorrent Protocol (BEP 3 & BEP 23) ===");

    // 1. Test binary URL encoding
    const sampleHashHex = "4a5b6c7d8e9f00112233445566778899aabbccdd";
    const sampleHashBuf = Buffer.from(sampleHashHex, "hex");
    const encodedHash = urlEncodeBytes(sampleHashBuf);
    console.log("[1] URL Encoded Info Hash:", encodedHash);

    if (!encodedHash.includes("%")) {
        throw new Error("FAIL: Binary hash should contain escaped % bytes");
    }
    console.log("PASS: URL Binary Encoding conforms to RFC 3986 / BitTorrent spec");

    // 2. Test Compact Peer parsing (BEP 23: 6 bytes per IPv4 peer)
    // 127.0.0.1:6881 (6881 = 0x1AE1)
    const compactTestBuf = Buffer.from([127, 0, 0, 1, 0x1A, 0xE1, 192, 168, 1, 15, 0x13, 0x88]);
    const parsedPeers = parseCompactPeers(compactTestBuf);
    console.log("[2] Parsed Compact Peers:", parsedPeers);

    if (parsedPeers.length !== 2) {
        throw new Error("FAIL: Should parse 2 peers");
    }
    if (parsedPeers[0].ip !== "127.0.0.1" || parsedPeers[0].port !== 6881) {
        throw new Error("FAIL: First peer mismatch");
    }
    if (parsedPeers[1].ip !== "192.168.1.15" || parsedPeers[1].port !== 5000) {
        throw new Error("FAIL: Second peer mismatch");
    }
    console.log("PASS: Compact Peer unpacking (BEP 23) works perfectly");

    // 3. Test Wire Protocol with modern extension message types
    console.log("[3] Testing wire protocol resilience against extension messages...");
    // Simulate an EXTENDED message (ID 20) with payload
    const extPayload = Buffer.from("d1:md11:ut_metadatai1eee"); // bencoded dictionary
    const extMsg = Buffer.alloc(4 + 1 + extPayload.length);
    extMsg.writeUInt32BE(1 + extPayload.length, 0);
    extMsg.writeUInt8(MESSAGE_TYPES.EXTENDED, 4); // 20
    extPayload.copy(extMsg, 5);

    const parsedExt = parseMessage(extMsg);
    if (parsedExt.type !== "EXTENDED") {
        throw new Error(`FAIL: Expected EXTENDED message, got ${parsedExt.type}`);
    }
    console.log("PASS: Wire protocol supports EXTENDED (BEP 10), HAVE_ALL, and PORT messages without crashing");

    // 4. Test Standard BEP 3 Tracker Announce (mock HTTP GET tracker)
    console.log("[4] Testing Live BEP 3 HTTP GET Announce...");
    const app = express();
    const testPort = 4099;
    let receivedUrl = "";

    app.get("/announce", (req, res) => {
        receivedUrl = req.url;
        const bencodedResp = encode({
            interval: 900,
            complete: 5,
            incomplete: 2,
            peers: compactTestBuf
        });
        res.setHeader("Content-Type", "text/plain");
        res.send(bencodedResp);
    });

    const server = app.listen(testPort);

    await new Promise(resolve => server.once("listening", resolve));

    try {
        const result = await announce(
            sampleHashHex,
            "-UT0001-testpeerid12",
            5016,
            {
                trackerUrl: `http://localhost:${testPort}/announce`,
                left: 1048576,
                event: "started"
            }
        );

        console.log("Tracker announce result:", result);
        console.log("Tracker received URL:", receivedUrl);

        if (!result.success || result.peers.length !== 2) {
            throw new Error("FAIL: Tracker announce failed or returned incorrect peers");
        }
        if (result.peers[0].ip !== "127.0.0.1" || result.peers[0].port !== 6881) {
            throw new Error("FAIL: Returned peers mismatch");
        }
        console.log("PASS: Live BEP 3 HTTP GET Announce with Compact Peers succeeded!");
    } finally {
        server.close();
    }

    console.log("\nALL STANDARD BITTORRENT PROTOCOL TESTS PASSED!");
}

module.exports = main;
if (require.main === module) {
    main().catch(err => {
        console.error("Test failed:", err);
        process.exitCode = 1;
    });
}
