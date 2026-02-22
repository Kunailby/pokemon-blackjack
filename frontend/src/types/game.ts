export interface Card {
  _id: string;
  name: string;
  hp: number;
  setName: string;
  imageUrl: string;
  cardNumber: string;
  hpCategory: 'low' | 'medium' | 'high';
}

export interface Player {
  _id: string;
  username: string;
  hand: Card[];
  totalHP: number;
  isStanding: boolean;
}

export interface Dealer {
  hand: Card[];
  totalHP: number;
  isRevealed: boolean;
}

export interface GameTable {
  _id: string;
  players: Player[];
  dealer: Dealer;
  inviteCode: string;
  gameStatus: 'waiting' | 'playing' | 'dealer-turn' | 'finished';
  shoeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GameResult {
  playerId: string;
  username: string;
  outcome: 'win' | 'loss' | 'push' | 'bust';
  playerHP: number;
  dealerHP: number;
}
