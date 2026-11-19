
function encode(value) {
    // Integer
    if (Number.isInteger(value)) {
        return Buffer.from(`i${value}e`);
    }
    // Binary data (Buffer)
if (Buffer.isBuffer(value)) {
    return Buffer.concat([
        Buffer.from(`${value.length}:`),
        value
    ]);
}

    // String
    if (typeof value === "string") {
        const buffer = Buffer.from(value);

        return Buffer.concat([
            Buffer.from(`${buffer.length}:`),
            buffer
        ]);
    }

    // List
    if (Array.isArray(value)) {
        const items = value.map(item => encode(item));

        return Buffer.concat([
            Buffer.from("l"),
            ...items,
            Buffer.from("e")
        ]);
    }

    // Dictionary
    if (typeof value === "object" && value !== null) {
        const keys = Object.keys(value).sort();

        const items = [];

        for (const key of keys) {
            items.push(encode(key));
            items.push(encode(value[key]));
        }

        return Buffer.concat([
            Buffer.from("d"),
            ...items,
            Buffer.from("e")
        ]);
    }

    throw new Error("Unsupported data type");
}

module.exports = encode;
