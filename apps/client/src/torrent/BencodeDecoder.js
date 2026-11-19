function decode(data) {
    if (!Buffer.isBuffer(data)) {
        throw new Error("Input must be a Buffer");
    }

    let index = 0;

    function parse() {
        if (index >= data.length) {
            throw new Error("Invalid bencode: unexpected end of data");
        }

        const char = String.fromCharCode(data[index]);

        // Integer: i42e
        if (char === "i") {
            index++;

            const end = data.indexOf(101, index);

            if (end === -1) {
                throw new Error("Invalid bencode: unterminated integer");
            }

            const numberString = data.toString("utf8", index, end);

            if (!/^(0|-[1-9]\d*|[1-9]\d*)$/.test(numberString)) {
                throw new Error("Invalid bencode: invalid integer");
            }

            const number = Number(numberString);

            if (!Number.isSafeInteger(number)) {
                throw new Error("Invalid bencode: integer out of range");
            }

            index = end + 1;

            return number;
        }

        // List: l...e
        if (char === "l") {
            index++;

            const list = [];

            while (true) {
                if (index >= data.length) {
                    throw new Error("Invalid bencode: unterminated list");
                }

                if (data[index] === 101) {
                    index++;
                    break;
                }

                list.push(parse());
            }

            return list;
        }

        // Dictionary: d...e
        if (char === "d") {
            index++;

            const dictionary = {};

            while (true) {
                if (index >= data.length) {
                    throw new Error("Invalid bencode: unterminated dictionary");
                }

                if (data[index] === 101) {
                    index++;
                    break;
                }

                const key = parse();

                if (!Buffer.isBuffer(key)) {
                    throw new Error("Invalid bencode: dictionary key must be a string");
                }

            const keyString = key.toString("utf8");

// Check dictionary key ordering
if (Object.keys(dictionary).length > 0) {
    const previousKey = Object.keys(dictionary).pop();

    if (Buffer.compare(
        Buffer.from(previousKey),
        key
    ) >= 0) {
        throw new Error("Invalid bencode: dictionary keys not sorted");
    }
}

// Check duplicate keys
if (Object.prototype.hasOwnProperty.call(dictionary, keyString)) {
    throw new Error("Invalid bencode: duplicate dictionary key");
}

dictionary[keyString] = parse();
            }

            return dictionary;
        }

        // String: 4:spam
        const colon = data.indexOf(58, index);

        if (colon === -1) {
            throw new Error("Invalid bencode: missing string length separator");
        }

        const lengthString = data.toString("utf8", index, colon);

        if (!/^(0|[1-9]\d*)$/.test(lengthString)) {
            throw new Error("Invalid bencode: invalid string length");
        }

        const length = Number(lengthString);

        if (!Number.isSafeInteger(length)) {
            throw new Error("Invalid bencode: string length out of range");
        }

        index = colon + 1;

        if (index + length > data.length) {
            throw new Error("Invalid bencode: incomplete string");
        }

        const value = data.subarray(index, index + length);

        index += length;

        return value;
    }

    const result = parse();

    if (index !== data.length) {
        throw new Error("Invalid bencode: extra data after parsed value");
    }

    return result;
}

module.exports = decode;