
const fs = require("fs");
const path = require("path");

const downloadFromPeer = require("./PeerDownload");

const {
    readPiece,
    assembleFile
} = require("../storage/PieceStorage");

const verifyPiece = require("../verification/PieceVerifier");

const MAX_RETRIES = 3;
const MAX_PARALLEL_DOWNLOADS = 3;

async function downloadFile({
    peers,
    peer,
    torrent,
    downloadDir,
    peerId,
    onProgress,
    onPieceDownloaded
}) {
    // Support either a peer list or one individual peer.
    const availablePeers = Array.isArray(peers)
        ? peers
        : peer
            ? [peer]
            : [];

    if (availablePeers.length === 0) {
        throw new Error("No peers available for downloading");
    }

    const {
        name,
        length,
        pieceLength,
        pieces,
        infoHash
    } = torrent;

    if (
        !Buffer.isBuffer(pieces) ||
        !Number.isSafeInteger(length) ||
        length < 0 ||
        !Number.isSafeInteger(pieceLength) ||
        pieceLength <= 0
    ) {
        throw new Error("Invalid torrent metadata");
    }

    const pieceCount = Math.ceil(length / pieceLength);
    const expectedHashes = [];

    for (let i = 0; i < pieces.length; i += 20) {
        expectedHashes.push(pieces.subarray(i, i + 20));
    }

    if (expectedHashes.length !== pieceCount) {
        throw new Error("Invalid torrent piece metadata");
    }

    fs.mkdirSync(downloadDir, { recursive: true });

    console.log("Starting download:", name);
    console.log("Total pieces:", pieceCount);
    console.log("Available peers:", availablePeers.length);
    console.log("Maximum parallel downloads:", MAX_PARALLEL_DOWNLOADS);

    availablePeers.forEach((item, index) => {
        console.log(`Peer ${index + 1}: ${item.ip}:${item.port}`);
    });

    let skippedPieces = 0;
    let downloadedPieces = 0;
    let nextPieceIndex = 0;
    let bytesDownloadedSinceStart = 0;
    const startTime = Date.now();

    function reportProgress() {
        if (typeof onProgress === "function") {
            const completedPieces = downloadedPieces + skippedPieces;
            const progress = pieceCount > 0 ? (completedPieces / pieceCount) * 100 : 0;
            const elapsedSeconds = Math.max((Date.now() - startTime) / 1000, 0.001);
            const speed = Math.round(bytesDownloadedSinceStart / elapsedSeconds);

            onProgress({
                downloadedPieces,
                skippedPieces,
                totalPieces: pieceCount,
                completedPieces,
                progress: parseFloat(progress.toFixed(2)),
                speed,
                bytesDownloaded: bytesDownloadedSinceStart,
                peersCount: availablePeers.length
            });
        }
    }

    reportProgress();

    const failedPieces = [];

    async function downloadPiece(i) {
        const actualPieceLength = Math.min(
            pieceLength,
            length - i * pieceLength
        );

        // Skip this piece if it already exists and is valid.
        try {
            const existingPiece = readPiece(downloadDir, name, i);

            if (
                existingPiece.length === actualPieceLength &&
                verifyPiece(existingPiece, expectedHashes[i])
            ) {
                console.log(`Skipping piece ${i}: already verified`);
                skippedPieces++;
                reportProgress();
                return;
            }
        } catch (error) {
            // Piece does not exist. Download it.
        }

        console.log(`Downloading piece ${i}`);

        let downloadedSuccessfully = false;
        let lastError;

        // Try every peer, with up to MAX_RETRIES attempts per peer.
        const totalAttempts = availablePeers.length * MAX_RETRIES;

        for (let attempt = 1; attempt <= totalAttempts; attempt++) {
            // Rotate peers so different pieces use different seeders.
            const peerIndex = (i + attempt - 1) % availablePeers.length;
            const selectedPeer = availablePeers[peerIndex];

            try {
                console.log(
                    `Piece ${i}: attempt ${attempt}/${totalAttempts} using ${selectedPeer.ip}:${selectedPeer.port}`
                );

                await downloadFromPeer({
                    ip: selectedPeer.ip,
                    port: selectedPeer.port,
                    infoHash,
                    peerId,
                    pieceCount,
                    pieceIndex: i,
                    pieceLength: actualPieceLength,
                    expectedHash: expectedHashes[i],
                    downloadDir,
                    fileName: name
                });

                const downloadedPiece = readPiece(
                    downloadDir,
                    name,
                    i
                );

                if (
                    downloadedPiece.length !== actualPieceLength ||
                    !verifyPiece(downloadedPiece, expectedHashes[i])
                ) {
                    throw new Error(`Piece ${i} failed verification`);
                }

                downloadedSuccessfully = true;
                downloadedPieces++;
                bytesDownloadedSinceStart += actualPieceLength;
                reportProgress();
                if (typeof onPieceDownloaded === "function") {
                    onPieceDownloaded(i);
                }

                console.log(
                    `Piece ${i} completed from ${selectedPeer.ip}:${selectedPeer.port}`
                );

                break;

            } catch (error) {
                lastError = error;

                console.log(
                    `Piece ${i} failed with ${selectedPeer.ip}:${selectedPeer.port}:`,
                    error.message
                );
            }
        }

        if (!downloadedSuccessfully) {
            failedPieces.push({
                piece: i,
                error: lastError?.message || "Unknown error"
            });
        }
    }

    // Each worker downloads a different piece.
    async function worker() {
        while (true) {
            const pieceIndex = nextPieceIndex++;

            if (pieceIndex >= pieceCount) {
                return;
            }

            await downloadPiece(pieceIndex);
        }
    }

    const workerCount = Math.min(
        MAX_PARALLEL_DOWNLOADS,
        pieceCount
    );

    await Promise.all(
        Array.from({ length: workerCount }, () => worker())
    );

    if (failedPieces.length > 0) {
        throw new Error(
            "Some pieces could not be downloaded:\n" +
            failedPieces.map(
                item => `Piece ${item.piece}: ${item.error}`
            ).join("\n")
        );
    }

    // Assemble the file after every piece has been verified.
    const outputPath = path.join(downloadDir, name);

    const assembledSize = assembleFile(
        downloadDir,
        name,
        pieceCount,
        outputPath
    );

    if (assembledSize !== length) {
        throw new Error(
            "Assembled file size does not match torrent metadata"
        );
    }

    console.log("File assembled successfully:", outputPath);
    console.log("Newly downloaded pieces:", downloadedPieces);
    console.log("Skipped verified pieces:", skippedPieces);

    reportProgress();

    return {
        success: true,
        name,
        size: assembledSize,
        outputPath,
        downloadedPieces,
        skippedPieces
    };
}

module.exports = downloadFile;
