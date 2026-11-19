const createAssembler = require("./PieceAssembler");
const verifyPiece = require("../verification/PieceVerifier");
const { savePiece } = require("../storage/PieceStorage");

function downloadPiece({
    downloadDir,
    fileName,
    pieceIndex,
    pieceLength,
    expectedHash,
    blocks
}) {
    const assembler = createAssembler(pieceLength);

    for (const block of blocks) {
        assembler.addBlock(block.begin, block.data);
    }

    if (!assembler.isComplete()) {
        throw new Error("Piece download incomplete");
    }

    const piece = assembler.getPiece();

    if (!verifyPiece(piece, expectedHash)) {
        throw new Error("Piece verification failed");
    }

    savePiece(
        downloadDir,
        fileName,
        pieceIndex,
        piece,
        expectedHash
    );

    return {
        success: true,
        pieceIndex,
        size: piece.length
    };
}

module.exports = downloadPiece;
