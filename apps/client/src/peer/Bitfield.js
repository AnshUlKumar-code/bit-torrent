function createBitfield(pieceCount) {
    return Buffer.alloc(Math.ceil(pieceCount / 8));
}

function setPiece(bitfield, pieceIndex) {
    const byteIndex = Math.floor(pieceIndex / 8);
    const bitIndex = 7 - (pieceIndex % 8);

    bitfield[byteIndex] |= (1 << bitIndex);
}

function hasPiece(bitfield, pieceIndex) {
    const byteIndex = Math.floor(pieceIndex / 8);
    const bitIndex = 7 - (pieceIndex % 8);

    return (bitfield[byteIndex] & (1 << bitIndex)) !== 0;
}

module.exports = {
    createBitfield,
    setPiece,
    hasPiece
};