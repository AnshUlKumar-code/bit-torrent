
const encode = require("../src/torrent/BencodeEncoder");
const decode = require("../src/torrent/BencodeDecoder");

const tests = [
    42,
    "spam",
    ["spam", "eggs"],
    { cow: "moo" }
];

function normalize(value) {
    if (Buffer.isBuffer(value)) {
        return value.toString("utf8");
    }

    if (Array.isArray(value)) {
        return value.map(normalize);
    }

    if (value !== null && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, val]) => [
                key,
                normalize(val)
            ])
        );
    }

    return value;
}

for (const original of tests) {
    const encoded = encode(original);
    const decoded = decode(encoded);

    const passed =
        JSON.stringify(normalize(decoded)) ===
        JSON.stringify(normalize(original));

    console.log(
        passed ? "PASS" : "FAIL",
        original,
        "=>",
        encoded.toString()
    );
}
