
const crypto = require("crypto");

function calculateInfoHash(infoBuffer) {
    return crypto
        .createHash("sha1")
        .update(infoBuffer)
        .digest("hex");
}

module.exports = calculateInfoHash;
