/**
 * Pokemon Blackjack Game Logic Service
 * HP values = card numbers
 * 400 HP = Blackjack
 * 300 HP = Dealer stops
 */

export const HP_GOAL = 400; // Blackjack
export const DEALER_STAND_HP = 300;

/**
 * Calculate total HP from cards
 */
export const calculateTotalHP = (cardHPs: number[]): number => {
  return cardHPs.reduce((sum, hp) => sum + hp, 0);
};

/**
 * Check if hand is blackjack (400 HP)
 */
export const isBlackjack = (totalHP: number): boolean => {
  return totalHP === HP_GOAL;
};

/**
 * Check if hand is bust (over 400 HP)
 */
export const isBust = (totalHP: number): boolean => {
  return totalHP > HP_GOAL;
};

/**
 * Categorize card by HP
 */
export const categorizeCard = (hp: number): 'low' | 'medium-low' | 'medium' | 'medium-high' | 'high' => {
  if (hp >= 30 && hp <= 60) return 'low';
  if (hp >= 70 && hp <= 90) return 'medium-low';
  if (hp >= 100 && hp <= 140) return 'medium';
  if (hp >= 150 && hp <= 200) return 'medium-high';
  if (hp > 200) return 'high';
  return 'low'; // default
};

/**
 * Determine game outcome
 */
export interface GameResult {
  playerResult: 'win' | 'loss' | 'push';
  playerFinalHP: number;
  dealerFinalHP: number;
}

export const determineOutcome = (playerHP: number, dealerHP: number): GameResult => {
  const playerBust = isBust(playerHP);
  const dealerBust = isBust(dealerHP);
  const playerBlackjack = isBlackjack(playerHP);
  const dealerBlackjack = isBlackjack(dealerHP);

  let result: 'win' | 'loss' | 'push' = 'push';

  if (playerBust) {
    result = 'loss'; // Player busts, dealer wins
  } else if (dealerBust) {
    result = 'win'; // Dealer busts, player wins
  } else if (playerBlackjack && !dealerBlackjack) {
    result = 'win'; // Player blackjack, dealer doesn't
  } else if (dealerBlackjack && !playerBlackjack) {
    result = 'loss'; // Dealer blackjack, player doesn't
  } else if (playerHP > dealerHP) {
    result = 'win'; // Player closer to 400
  } else if (dealerHP > playerHP) {
    result = 'loss'; // Dealer closer to 400
  } else {
    result = 'push'; // Same HP
  }

  return {
    playerResult: result,
    playerFinalHP: playerHP,
    dealerFinalHP: dealerHP
  };
};

/**
 * Determine if dealer should hit
 */
export const shouldDealerHit = (dealerHP: number): boolean => {
  return dealerHP < DEALER_STAND_HP;
};
