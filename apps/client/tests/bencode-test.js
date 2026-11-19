
const decode = require("../src/torrent/BencodeDecoder");

const tests = [
    ["i42e", 42],
    ["4:spam", Buffer.from("spam")],
    [
        "l4:spam4:eggse",
        [Buffer.from("spam"), Buffer.from("eggs")]
    ],
    [
        "d3:cow3:mooe",
        { cow: Buffer.from("moo") }
    ]
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

for (const [input, expected] of tests) {
    const actual = decode(Buffer.from(input));

    const passed =
        JSON.stringify(normalize(actual)) ===
        JSON.stringify(normalize(expected));

    console.log(passed ? "PASS" : "FAIL", input);
}
// Invalid Bencode tests
const invalidTests = [
    ["i03e", "Invalid integer"],
    ["i+5e", "Invalid integer"],
    ["i-0e", "Invalid integer"],
    ["4:spa", "Incomplete string"],
    ["l4:spam", "Unterminated list"],
    ["d3:cow3:moo", "Unterminated dictionary"],
    ["i42eextra", "Extra trailing data"]
];

for (const [input, description] of invalidTests) {
    try {
        decode(Buffer.from(input));
        console.log("FAIL:", description);
    } catch (error) {
        console.log("PASS:", description);
    }
}
// Dictionary ordering tests

const validDictionary = "d3:cat3:dog3:cow3:mooe";

try {
    decode(Buffer.from(validDictionary));
    console.log("PASS: Sorted dictionary accepted");
} catch (error) {
    console.log("FAIL: Sorted dictionary", error.message);
}

const invalidDictionary = "d3:cow3:moo3:cat3:doge";

try {
    decode(Buffer.from(invalidDictionary));
    console.log("FAIL: Unsorted dictionary accepted");
} catch (error) {
    console.log("PASS: Unsorted dictionary rejected");
}