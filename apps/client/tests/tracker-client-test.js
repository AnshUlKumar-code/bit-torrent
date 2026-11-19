const { announce } = require("../src/tracker/TrackerClient");

async function test() {
    const result = await announce(
        "3b794d3092cb05d09f15cadc4210fbf33b717081",
        "client001",
        5003
    );

    console.log("Success:", result.success);
    console.log("Discovered peers:", result.peers);
}

test().catch(console.error);