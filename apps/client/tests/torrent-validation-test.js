const encode = require("../src/torrent/BencodeEncoder");
const parseTorrent = require("../src/torrent/TorrentParser");

function testInvalidTorrent(name, info) {
    const torrent = {
        announce: "http://localhost:4000/announce",
        info
    };

    try {
        parseTorrent(encode(torrent));
        console.log("FAIL:", name);
    } catch (error) {
        console.log("PASS:", name, "=>", error.message);
    }
}

const validInfo = {
    name: "movie.mp4",
    length: 1000000,
    "piece length": 262144,
    pieces: Buffer.alloc(80, 1)
};

// Test 1: Invalid piece length
testInvalidTorrent("Zero piece length", {
    ...validInfo,
    "piece length": 0
});

// Test 2: Missing name
const { name, ...withoutName } = validInfo;
testInvalidTorrent("Missing name", withoutName);

// Test 3: Incomplete SHA-1 hash
testInvalidTorrent("Invalid piece hash length", {
    ...validInfo,
    pieces: Buffer.alloc(21, 1)
});

// Test 4: Incorrect number of piece hashes
testInvalidTorrent("Incorrect piece count", {
    ...validInfo,
    pieces: Buffer.alloc(20, 1)
});

// Test 5: Negative file size
testInvalidTorrent("Negative file size", {
    ...validInfo,
    length: -100
});
// Test 6: Zero-byte file
// Test 6: Zero-byte file should be accepted
const emptyTorrent = {
    announce: "http://localhost:4000/announce",
    info: {
        name: "empty.txt",
        length: 0,
        "piece length": 262144,
        pieces: Buffer.alloc(0)
    }
};

try {
    parseTorrent(encode(emptyTorrent));
    console.log("PASS: Zero-byte file accepted");
} catch (error) {
    console.log("FAIL: Zero-byte file =>", error.message);
}
// Test 7: Valid multi-file torrent
const validMultiFileTorrent = {
    announce: "http://localhost:4000/announce",
    info: {
        name: "MyFolder",
        "piece length": 262144,
        pieces: Buffer.alloc(80, 1),
        files: [
            {
                length: 600000,
                path: [Buffer.from("movie.mp4")]
            },
            {
                length: 400000,
                path: [Buffer.from("subtitles.srt")]
            }
        ]
    }
};

try {
    const result = parseTorrent(encode(validMultiFileTorrent));

    if (result.totalLength === 1000000) {
        console.log("PASS: Valid multi-file torrent");
    } else {
        console.log("FAIL: Incorrect total file size");
    }
} catch (error) {
    console.log("FAIL: Valid multi-file torrent =>", error.message);
}

// Test 8: Invalid multi-file path
testInvalidTorrent("Missing multi-file path", {
    name: "MyFolder",
    "piece length": 262144,
    pieces: Buffer.alloc(80, 1),
    files: [
        {
            length: 1000000,
            path: []
        }
    ]
});
// Test 9: Empty path component
testInvalidTorrent("Empty path component", {
    name: "MyFolder",
    "piece length": 262144,
    pieces: Buffer.alloc(80, 1),
    files: [
        {
            length: 1000000,
            path: [Buffer.from("")]
        }
    ]
});