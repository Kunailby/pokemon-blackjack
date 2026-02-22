/**
 * Pokemon Blackjack Game Logic Service
 * HP values = card numbers
 * 400 HP = Blackjack
 * 300 HP = Dealer stops
 */
export declare const HP_GOAL = 400;
export declare const DEALER_STAND_HP = 300;
/**
 * Calculate total HP from cards
 */
export declare const calculateTotalHP: (cardHPs: number[]) => number;
/**
 * Check if hand is blackjack (400 HP)
 */
export declare const isBlackjack: (totalHP: number) => boolean;
/**
 * Check if hand is bust (over 400 HP)
 */
export declare const isBust: (totalHP: number) => boolean;
/**
 * Categorize card by HP
 */
export declare const categorizeCard: (hp: number) => "low" | "medium-low" | "medium" | "medium-high" | "high";
/**
 * Determine game outcome
 */
export interface GameResult {
    playerResult: 'win' | 'loss' | 'push';
    playerFinalHP: number;
    dealerFinalHP: number;
}
export declare const determineOutcome: (playerHP: number, dealerHP: number) => GameResult;
/**
 * Determine if dealer should hit
 */
export declare const shouldDealerHit: (dealerHP: number) => boolean;
//# sourceMappingURL=GameLogic.d.ts.map