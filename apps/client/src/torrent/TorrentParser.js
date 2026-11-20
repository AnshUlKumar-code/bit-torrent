
const decode = require("./BencodeDecoder");
const extractInfoBuffer = require("./BencodeInfoExtractor");
const calculateInfoHash = require("./InfoHash");

function parseTorrent(buffer) {
    const torrent = decode(buffer);

    if (!torrent.info || typeof torrent.info !== "object") {
        throw new Error("Invalid torrent: info dictionary missing");
    }

    const info = torrent.info;

    // Validate torrent name
    if (!Buffer.isBuffer(info.name) || info.name.length === 0) {
        throw new Error("Invalid torrent: name missing");
    }

    // Validate piece length
    const pieceLength = info["piece length"];

    if (!Number.isSafeInteger(pieceLength) || pieceLength <= 0) {
        throw new Error("Invalid torrent: invalid piece length");
    }

    // Validate piece hashes
  if (!Buffer.isBuffer(info.pieces)) {
    throw new Error("Invalid torrent: pieces missing");
}

    if (info.pieces.length % 20 !== 0) {
        throw new Error("Invalid torrent: incomplete SHA-1 hash");
    }

    // Validate single-file or multi-file metadata
    const isSingleFile = Number.isSafeInteger(info.length) &&
        info.length >= 0;

    const isMultiFile = Array.isArray(info.files) &&
        info.files.length > 0;

    if (isSingleFile === isMultiFile) {
        throw new Error("Invalid torrent: invalid file metadata");
    }

    const totalLength = isSingleFile
    ? info.length
    : info.files.reduce((total, file) => {

        if (!file || typeof file !== "object") {
            throw new Error("Invalid torrent: invalid file entry");
        }

        if (
            !Number.isSafeInteger(file.length) ||
            file.length < 0
        ) {
            throw new Error("Invalid torrent: invalid file length");
        }

        if (
            !Array.isArray(file.path) ||
            file.path.length === 0
        ) {
            throw new Error("Invalid torrent: invalid file path");
        }

        for (const part of file.path) {
            if (!Buffer.isBuffer(part) || part.length === 0) {
                throw new Error("Invalid torrent: invalid path component");
            }
        }

        return total + file.length;

    }, 0);

    if (!Number.isSafeInteger(totalLength)) {
        throw new Error("Invalid torrent: total file size is invalid");
    }

    // Verify expected number of piece hashes
    const expectedPieces = Math.ceil(totalLength / pieceLength);

    if (info.pieces.length !== expectedPieces * 20) {
        throw new Error("Invalid torrent: piece hash count mismatch");
    }

    const infoBuffer = extractInfoBuffer(buffer);
    const infoHash = calculateInfoHash(infoBuffer);

    const announce = torrent.announce
        ? torrent.announce.toString("utf8")
        : null;

    const announceList = [];
    if (Array.isArray(torrent["announce-list"])) {
        for (const tier of torrent["announce-list"]) {
            if (Array.isArray(tier)) {
                for (const url of tier) {
                    if (url) announceList.push(url.toString("utf8"));
                }
            } else if (tier) {
                announceList.push(tier.toString("utf8"));
            }
        }
    }

    if (announce && !announceList.includes(announce)) {
        announceList.unshift(announce);
    }

    return {
        announce,
        announceList,

        name: info.name.toString(),

        pieceLength,

        pieces: info.pieces,

        length: isSingleFile ? info.length : null,

        files: info.files || null,

        totalLength,

        infoHash
    };
}

module.exports = parseTorrent;
