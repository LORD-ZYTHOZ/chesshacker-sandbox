import { Chess } from 'chess.js';
import { SquareChange, Move, GameState } from '../types.js';

export class ChessValidator {
  private chess: Chess;
  private moveConfirmationFrames: Map<string, number> = new Map();
  private readonly CONFIRMATION_REQUIRED = 2;
  private readonly MIN_SQUARE_CHANGES = 3;

  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  /**
   * Match detected changes to legal moves
   * Requires 2-frame confirmation and minimum 3 square changes
   */
  findLegalMove(changes: SquareChange[]): Move | null {
    // Must have at least 3 square changes
    if (changes.length < this.MIN_SQUARE_CHANGES) {
      return null;
    }

    // Get all legal moves in current position
    const legalMoves = this.chess.moves({ verbose: true });

    // Try to match changes to a legal move
    for (const move of legalMoves) {
      if (this.matchesChanges(move, changes)) {
        // Check if this move needs confirmation
        const moveKey = `${move.from}${move.to}`;
        const confirmations = (this.moveConfirmationFrames.get(moveKey) || 0) + 1;
        this.moveConfirmationFrames.set(moveKey, confirmations);

        if (confirmations >= this.CONFIRMATION_REQUIRED) {
          // Move confirmed, clear confirmations
          this.moveConfirmationFrames.clear();

          // Make the move
          this.chess.move(move);

          return {
            from: move.from,
            to: move.to,
            promotion: move.promotion,
            san: move.san,
            uci: `${move.from}${move.to}${move.promotion || ''}`,
            fen: this.chess.fen()
          };
        }
      }
    }

    return null;
  }

  private matchesChanges(move: any, changes: SquareChange[]): boolean {
    // Expected changes for a move:
    // 1. Source square becomes empty
    // 2. Destination square gets the piece
    // 3. Captures: destination square changes from opponent piece to our piece
    // 4. Castling: king moves 2 squares, rook moves
    // 5. En passant: pawn moves diagonally, captured pawn square becomes empty

    const fromChange = changes.find(c => c.square === move.from);
    const toChange = changes.find(c => c.square === move.to);

    if (!fromChange || !toChange) {
      return false;
    }

    // From square should be empty now
    if (fromChange.now !== '') {
      return false;
    }

    // To square should have the piece that moved
    const expectedPiece = this.getPieceNotation(move.color, move.piece);
    if (toChange.now !== expectedPiece) {
      return false;
    }

    return true;
  }

  private getPieceNotation(color: 'w' | 'b', piece: string): string {
    return `${color}${piece.toUpperCase()}`;
  }

  /**
   * Get current game state
   */
  getGameState(): GameState {
    return {
      fen: this.chess.fen(),
      pgn: this.chess.pgn(),
      isCheckmate: this.chess.isCheckmate(),
      isStalemate: this.chess.isStalemate(),
      isDraw: this.chess.isDraw(),
      isCheck: this.chess.isCheck(),
      turn: this.chess.turn(),
      moveHistory: this.getMoveHistory()
    };
  }

  private getMoveHistory(): Move[] {
    const history = this.chess.history({ verbose: true });
    return history.map(move => ({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion || ''}`,
      fen: move.after
    }));
  }

  /**
   * Load position from FEN
   */
  loadFen(fen: string): void {
    this.chess.load(fen);
  }

  /**
   * Reset to starting position
   */
  reset(): void {
    this.chess.reset();
    this.moveConfirmationFrames.clear();
  }

  /**
   * Undo last move
   */
  undo(): Move | null {
    const move = this.chess.undo();
    if (!move) return null;

    return {
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion || ''}`,
      fen: this.chess.fen()
    };
  }
}
