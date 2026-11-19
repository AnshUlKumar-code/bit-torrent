const fs = require("fs");
const path = require("path");
const verifyPiece = require("../verification/PieceVerifier");

function savePiece(downloadDir, fileName, pieceIndex, pieceData, expectedHash) {
    if (!verifyPiece(pieceData, expectedHash)) {
        throw new Error("Piece verification failed");
    }

    const pieceDir = path.join(downloadDir, fileName);

    fs.mkdirSync(pieceDir, { recursive: true });

    const piecePath = path.join(pieceDir, `${pieceIndex}.piece`);

    fs.writeFileSync(piecePath, pieceData);

    return piecePath;
}

function readPiece(downloadDir, fileName, pieceIndex) {
    const piecePath = path.join(
        downloadDir,
        fileName,
        `${pieceIndex}.piece`
    );

    return fs.readFileSync(piecePath);
}

function assembleFile(downloadDir, fileName, pieceCount, outputPath) {
    const pieces = [];

    for (let i = 0; i < pieceCount; i++) {
        pieces.push(readPiece(downloadDir, fileName, i));
    }

    const completeFile = Buffer.concat(pieces);

    fs.writeFileSync(outputPath, completeFile);

    return completeFile.length;
}

module.exports = {
    savePiece,
    readPiece,
    assembleFile
};