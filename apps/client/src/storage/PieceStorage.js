
const fs = require("fs");
const path = require("path");
const verifyPiece = require("../verification/PieceVerifier");

function getPieceDirectory(downloadDir, fileName) {
    return path.join(downloadDir, ".pieces", fileName);
}

function savePiece(downloadDir, fileName, pieceIndex, pieceData, expectedHash) {
    if (!verifyPiece(pieceData, expectedHash)) {
        throw new Error("Piece verification failed");
    }

    const pieceDir = getPieceDirectory(downloadDir, fileName);

    fs.mkdirSync(pieceDir, { recursive: true });

    const piecePath = path.join(pieceDir, `${pieceIndex}.piece`);

    fs.writeFileSync(piecePath, pieceData);

    return piecePath;
}

function readPiece(downloadDir, fileName, pieceIndex) {
    const newPiecePath = path.join(
        getPieceDirectory(downloadDir, fileName),
        `${pieceIndex}.piece`
    );

    // Support older piece files created before this storage update.
    const oldPiecePath = path.join(
        downloadDir,
        fileName,
        `${pieceIndex}.piece`
    );

    if (fs.existsSync(newPiecePath)) {
        return fs.readFileSync(newPiecePath);
    }

    return fs.readFileSync(oldPiecePath);
}

function assembleFile(downloadDir, fileName, pieceCount, outputPath) {
    const pieces = [];

    for (let i = 0; i < pieceCount; i++) {
        pieces.push(readPiece(downloadDir, fileName, i));
    }

    const completeFile = Buffer.concat(pieces);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, completeFile);

    return completeFile.length;
}

module.exports = {
    savePiece,
    readPiece,
    assembleFile
};
