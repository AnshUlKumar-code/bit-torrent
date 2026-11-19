const crypto = require("crypto");

function verifyPiece(pieceData, expectedHash) {
    const actualHash = crypto
        .createHash("sha1")
        .update(pieceData)
        .digest();

    return actualHash.equals(expectedHash);
}

module.exports = verifyPiece;