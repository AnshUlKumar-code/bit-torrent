function encode(value) {
    if (Number.isInteger(value)) {
        return Buffer.from(`i${value}e`);
    }

    if (Buffer.isBuffer(value)) {
        return Buffer.concat([
            Buffer.from(`${value.length}:`),
            value
        ]);
    }

    if (typeof value === "string") {
        const buffer = Buffer.from(value, "utf8");
        return Buffer.concat([
            Buffer.from(`${buffer.length}:`),
            buffer
        ]);
    }

    if (Array.isArray(value)) {
        const items = value.map(item => encode(item));
        return Buffer.concat([
            Buffer.from("l"),
            ...items,
            Buffer.from("e")
        ]);
    }

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

    throw new Error("Unsupported data type for bencoding: " + typeof value);
}

module.exports = encode;
