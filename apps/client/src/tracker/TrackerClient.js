const axios = require("axios");
const config = require("../config");
const decode = require("../torrent/BencodeDecoder");

function urlEncodeBytes(buf) {
    let str = "";
    for (let i = 0; i < buf.length; i++) {
        const byte = buf[i];
        if (
            (byte >= 0x30 && byte <= 0x39) ||
            (byte >= 0x41 && byte <= 0x5a) ||
            (byte >= 0x61 && byte <= 0x7a) ||
            byte === 0x2e || byte === 0x2d || byte === 0x5f || byte === 0x7e
        ) {
            str += String.fromCharCode(byte);
        } else {
            str += "%" + byte.toString(16).padStart(2, "0").toUpperCase();
        }
    }
    return str;
}

function parseCompactPeers(buffer) {
    const peers = [];
    for (let i = 0; i + 6 <= buffer.length; i += 6) {
        const ip = `${buffer[i]}.${buffer[i + 1]}.${buffer[i + 2]}.${buffer[i + 3]}`;
        const port = buffer.readUInt16BE(i + 4);
        if (port > 0 && port <= 65535) {
            peers.push({ ip, port });
        }
    }
    return peers;
}

function parseDictionaryPeers(list) {
    const peers = [];
    for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const ip = item.ip ? item.ip.toString("utf8") : null;
        const port = item.port;
        const peerId = item["peer id"] ? item["peer id"].toString("latin1") : null;
        if (ip && port) {
            peers.push({ ip, port, peerId });
        }
    }
    return peers;
}

async function announce(infoHash, peerId, port, options = {}) {
    let trackerUrl = options.trackerUrl || config.trackerUrl;

    if (!trackerUrl || (!trackerUrl.startsWith("http://") && !trackerUrl.startsWith("https://"))) {
        throw new Error(`Unsupported tracker protocol (only HTTP/HTTPS supported): ${trackerUrl}`);
    }

    // Auto-normalize tracker URL: ensure /announce endpoint is present if omitted
    try {
        const parsed = new URL(trackerUrl);
        if (!parsed.pathname.endsWith("/announce")) {
            parsed.pathname = (parsed.pathname === "/" ? "" : parsed.pathname) + "/announce";
            trackerUrl = parsed.toString();
        }
    } catch {
        if (!trackerUrl.includes("/announce")) {
            trackerUrl = `${trackerUrl.replace(/\/+$/, "")}/announce`;
        }
    }

    const infoHashBuf = Buffer.isBuffer(infoHash)
        ? infoHash
        : Buffer.from(infoHash, "hex");

    const peerIdBuf = Buffer.isBuffer(peerId)
        ? peerId
        : Buffer.from(peerId, "utf8");

    const params = [
        `info_hash=${urlEncodeBytes(infoHashBuf)}`,
        `peer_id=${urlEncodeBytes(peerIdBuf)}`,
        `port=${port}`,
        `uploaded=${options.uploaded || 0}`,
        `downloaded=${options.downloaded || 0}`,
        `left=${options.left ?? 0}`,
        `compact=1`,
        `numwant=50`
    ];

    if (options.event) {
        params.push(`event=${encodeURIComponent(options.event)}`);
    }

    const separator = trackerUrl.includes("?") ? "&" : "?";
    const fullUrl = `${trackerUrl}${separator}${params.join("&")}`;

    try {
        // 1. Try standard BEP 3 HTTP GET announce
        const response = await axios.get(fullUrl, {
            responseType: "arraybuffer",
            timeout: 10000,
            headers: {
                "User-Agent": "uTorrent/1.0.0 (BitTorrent BEP 3)"
            }
        });

        const dataBuffer = Buffer.from(response.data);

        // Check if bencoded (BEP 3 specification)
        if (dataBuffer.length > 0 && dataBuffer[0] === 100) {
            const decoded = decode(dataBuffer);

            if (decoded["failure reason"]) {
                const reason = Buffer.isBuffer(decoded["failure reason"])
                    ? decoded["failure reason"].toString("utf8")
                    : decoded["failure reason"];
                throw new Error(`Tracker error: ${reason}`);
            }

            let peers = [];
            if (Buffer.isBuffer(decoded.peers)) {
                peers = parseCompactPeers(decoded.peers);
            } else if (Array.isArray(decoded.peers)) {
                peers = parseDictionaryPeers(decoded.peers);
            }

            return {
                success: true,
                interval: decoded.interval || 1800,
                complete: decoded.complete || 0,
                incomplete: decoded.incomplete || 0,
                peers
            };
        }

        // Check if JSON response (legacy tracker compatibility)
        if (dataBuffer.length > 0 && dataBuffer[0] === 123) {
            const json = JSON.parse(dataBuffer.toString("utf8"));
            return {
                success: json.success !== false,
                peers: json.peers || []
            };
        }

        throw new Error("Unknown tracker response format");

    } catch (error) {
        // If standard GET fails, fallback to legacy JSON POST (for backwards compatibility with internal servers)
        if (error.response && (error.response.status === 404 || error.response.status === 405)) {
            try {
                const hexHash = infoHashBuf.toString("hex");
                const postResponse = await axios.post(
                    trackerUrl,
                    {
                        infoHash: hexHash,
                        peerId: typeof peerId === "string" ? peerId : peerId.toString("utf8"),
                        port
                    },
                    { timeout: 8000 }
                );
                return postResponse.data;
            } catch (postError) {
                throw new Error(`Tracker announce failed: ${postError.message}`);
            }
        }

        throw error;
    }
}

module.exports = {
    announce,
    urlEncodeBytes,
    parseCompactPeers
};
