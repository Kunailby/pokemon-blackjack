"use strict";
/**
 * Pokemon Blackjack Game Logic Service
 * HP values = card numbers
 * 400 HP = Blackjack
 * 300 HP = Dealer stops
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldDealerHit = exports.determineOutcome = exports.categorizeCard = exports.isBust = exports.isBlackjack = exports.calculateTotalHP = exports.DEALER_STAND_HP = exports.HP_GOAL = void 0;
exports.HP_GOAL = 400; // Blackjack
exports.DEALER_STAND_HP = 300;
/**
 * Calculate total HP from cards
 */
const calculateTotalHP = (cardHPs) => {
    return cardHPs.reduce((sum, hp) => sum + hp, 0);
};
exports.calculateTotalHP = calculateTotalHP;
/**
 * Check if hand is blackjack (400 HP)
 */
const isBlackjack = (totalHP) => {
    return totalHP === exports.HP_GOAL;
};
exports.isBlackjack = isBlackjack;
/**
 * Check if hand is bust (over 400 HP)
 */
const isBust = (totalHP) => {
    return totalHP > exports.HP_GOAL;
};
exports.isBust = isBust;
/**
 * Categorize card by HP
 */
const categorizeCard = (hp) => {
    if (hp >= 30 && hp <= 60)
        return 'low';
    if (hp >= 70 && hp <= 90)
        return 'medium-low';
    if (hp >= 100 && hp <= 140)
        return 'medium';
    if (hp >= 150 && hp <= 200)
        return 'medium-high';
    if (hp > 200)
        return 'high';
    return 'low'; // default
};
exports.categorizeCard = categorizeCard;
const determineOutcome = (playerHP, dealerHP) => {
    const playerBust = (0, exports.isBust)(playerHP);
    const dealerBust = (0, exports.isBust)(dealerHP);
    const playerBlackjack = (0, exports.isBlackjack)(playerHP);
    const dealerBlackjack = (0, exports.isBlackjack)(dealerHP);
    let result = 'push';
    if (playerBust) {
        result = 'loss'; // Player busts, dealer wins
    }
    else if (dealerBust) {
        result = 'win'; // Dealer busts, player wins
    }
    else if (playerBlackjack && !dealerBlackjack) {
        result = 'win'; // Player blackjack, dealer doesn't
    }
    else if (dealerBlackjack && !playerBlackjack) {
        result = 'loss'; // Dealer blackjack, player doesn't
    }
    else if (playerHP > dealerHP) {
        result = 'win'; // Player closer to 400
    }
    else if (dealerHP > playerHP) {
        result = 'loss'; // Dealer closer to 400
    }
    else {
        result = 'push'; // Same HP
    }
    return {
        playerResult: result,
        playerFinalHP: playerHP,
        dealerFinalHP: dealerHP
    };
};
exports.determineOutcome = determineOutcome;
/**
 * Determine if dealer should hit
 */
const shouldDealerHit = (dealerHP) => {
    return dealerHP < exports.DEALER_STAND_HP;
};
exports.shouldDealerHit = shouldDealerHit;
//# sourceMappingURL=GameLogic.js.map