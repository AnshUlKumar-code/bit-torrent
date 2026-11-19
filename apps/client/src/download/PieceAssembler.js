function createAssembler(pieceLength, blockSize = 16384) {
    const buffer = Buffer.alloc(pieceLength);
    const received = new Set();

    function addBlock(begin, block) {
        if (
            begin < 0 ||
            begin % blockSize !== 0 ||
            begin + block.length > pieceLength
        ) {
            throw new Error("Invalid block position");
        }

        const expectedLength = Math.min(
            blockSize,
            pieceLength - begin
        );

        if (block.length !== expectedLength) {
            throw new Error("Invalid block length");
        }

        block.copy(buffer, begin);
        received.add(begin);
    }

    function isComplete() {
        return received.size === Math.ceil(pieceLength / blockSize);
    }

    function getPiece() {
        if (!isComplete()) {
            throw new Error("Piece is incomplete");
        }

        return buffer;
    }

    return { addBlock, isComplete, getPiece };
}

module.exports = createAssembler;