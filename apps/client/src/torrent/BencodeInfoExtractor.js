
function readStringEnd(buffer, start) {
    const colon = buffer.indexOf(58, start);

    if (colon === -1) {
        throw new Error("Invalid Bencode string");
    }

    const lengthText = buffer.toString("ascii", start, colon);

    if (!/^(0|[1-9]\d*)$/.test(lengthText)) {
        throw new Error("Invalid string length");
    }

    const length = Number(lengthText);
    const end = colon + 1 + length;

    if (!Number.isSafeInteger(length) || end > buffer.length) {
        throw new Error("String exceeds buffer");
    }

    return end;
}

function skipValue(buffer, start) {
    if (start >= buffer.length) {
        throw new Error("Unexpected end of Bencode");
    }

    const char = buffer[start];

    // String
    if (char >= 48 && char <= 57) {
        return readStringEnd(buffer, start);
    }

    // Integer
    if (char === 105) {
        const end = buffer.indexOf(101, start);

        if (end === -1) {
            throw new Error("Invalid integer");
        }

        return end + 1;
    }

    // List or dictionary
    if (char === 108 || char === 100) {
        let index = start + 1;

        while (index < buffer.length && buffer[index] !== 101) {
            index = skipValue(buffer, index);
        }

        if (index >= buffer.length) {
            throw new Error("Unterminated list or dictionary");
        }

        return index + 1;
    }

    throw new Error("Invalid Bencode value");
}

function extractInfoBuffer(buffer) {
    if (buffer[0] !== 100) {
        throw new Error("Torrent root must be a dictionary");
    }

    let index = 1;

    while (index < buffer.length && buffer[index] !== 101) {
        const keyEnd = readStringEnd(buffer, index);

        const key = buffer.toString(
            "utf8",
            buffer.indexOf(58, index) + 1,
            keyEnd
        );

        const valueStart = keyEnd;
        const valueEnd = skipValue(buffer, valueStart);

        if (key === "info") {
            if (buffer[valueStart] !== 100) {
                throw new Error("Info must be a dictionary");
            }

            return buffer.subarray(valueStart, valueEnd);
        }

        index = valueEnd;
    }

    throw new Error("Info dictionary not found");
}

module.exports = extractInfoBuffer;
