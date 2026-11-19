const axios = require("axios");
const config = require("../config");

async function announce(infoHash, peerId, port) {
    const response = await axios.post(
        `${config.trackerUrl}/announce`,
        {
            infoHash,
            peerId,
            port
        }
    );

    return response.data;
}

module.exports = { announce };