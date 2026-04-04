// ── Achievement definitions + check logic ────────────────────────────────────

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface UnlockedAchievement {
  id: string;
  unlockedAt: string; // ISO date string
}

export interface WinContext {
  hand: { name: string; hp: number; types: string[]; rarity: string }[];
  playerTotal: number;
  dealerTotal: number;
  dealerBusted: boolean;
  bet: number;
  chipsBeforeBet: number;
  isBlackjack: boolean;
  hitCount: number;
  winStreak: number;
}

// ── Rarity tier helper ────────────────────────────────────────────────────────
function rarityTier(rarity: string): 'common' | 'uncommon' | 'rare' | 'holo' | 'ultra' | 'secret' {
  const r = rarity.toLowerCase();
  if (r.includes('secret') || r.includes('hyper') || r.includes('special illustration') || r.includes('rainbow')) return 'secret';
  if (r.includes('ultra') || r.includes('full art') || r.includes('radiant') || r.includes('amazing')) return 'ultra';
  if (r.includes('holo') || r.includes('prism') || r.includes('shiny') || r.includes('shining')) return 'holo';
  if (r.includes('rare')) return 'rare';
  if (r.includes('uncommon')) return 'uncommon';
  return 'common';
}

// ── All 53 achievements ───────────────────────────────────────────────────────
export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Hand Size ──────────────────────────────────────────────────────────────
  { id: 'two_hit_wonder',   name: 'Two-Hit Wonder',    description: 'Win with exactly 2 cards',        icon: '✌️' },
  { id: 'hat_trick',        name: 'Hat Trick',          description: 'Win with exactly 3 cards',        icon: '🎩' },
  { id: 'four_of_a_kind',   name: 'Four of a Kind',     description: 'Win with exactly 4 cards',        icon: '🃏' },
  { id: 'full_bench',       name: 'Full Bench',          description: 'Win with exactly 5 cards',        icon: '🖐️' },
  { id: 'marathon',         name: 'Marathon',            description: 'Win with 6 or more cards',        icon: '🏃' },

  // ── Types ──────────────────────────────────────────────────────────────────
  { id: 'mono_type',        name: 'Mono-type',           description: 'Win with all cards sharing the same type',          icon: '🎯' },
  { id: 'type_duo',         name: 'Type Duo',            description: 'Win with exactly 2 different types',                icon: '⚖️' },
  { id: 'type_trio',        name: 'Type Trio',           description: 'Win with exactly 3 different types',                icon: '🔺' },
  { id: 'rainbow_hand',     name: 'Rainbow Hand',        description: 'Win with 4 or more different types in one hand',    icon: '🌈' },
  { id: 'fire_starter',     name: 'Fire Starter',        description: 'Win with only Fire type cards',                     icon: '🔥' },
  { id: 'flood_warning',    name: 'Flood Warning',       description: 'Win with only Water type cards',                    icon: '💧' },
  { id: 'overgrowth',       name: 'Overgrowth',          description: 'Win with only Grass type cards',                    icon: '🌿' },
  { id: 'mind_games',       name: 'Mind Games',          description: 'Win with only Psychic type cards',                  icon: '🔮' },
  { id: 'static',           name: 'Static',              description: 'Win with only Lightning type cards',                icon: '⚡' },
  { id: 'iron_fist',        name: 'Iron Fist',           description: 'Win with only Fighting type cards',                 icon: '👊' },
  { id: 'shadow_hand',      name: 'Shadow Hand',         description: 'Win with only Darkness type cards',                 icon: '🌑' },
  { id: 'colorless_classic',name: 'Colorless Classic',   description: 'Win with only Colorless type cards',                icon: '⚪' },
  { id: 'dragon_tamer',     name: 'Dragon Tamer',        description: 'Win with at least one Dragon type card',            icon: '🐉' },
  { id: 'fairy_dust',       name: 'Fairy Dust',          description: 'Win with at least one Fairy type card',             icon: '🧚' },
  { id: 'starter_pack',     name: 'Starter Pack',        description: 'Win with Fire, Water, and Grass all in hand',       icon: '🌟' },

  // ── Rarity ─────────────────────────────────────────────────────────────────
  { id: 'common_sense',     name: 'Common Sense',        description: 'Win with only Common rarity cards',                 icon: '⚪' },
  { id: 'hidden_gems',      name: 'Hidden Gems',         description: 'Win with only Uncommon rarity cards',               icon: '🔵' },
  { id: 'rare_breed',       name: 'Rare Breed',          description: 'Win with only Rare or better cards',                icon: '⭐' },
  { id: 'holo_dreams',      name: 'Holo Dreams',         description: 'Win with 2 or more Holo Rare cards in hand',        icon: '✨' },
  { id: 'secret_found',     name: 'Secret Found',        description: 'Win with a Secret Rare card in hand',               icon: '🌠' },
  { id: 'ultra_instinct',   name: 'Ultra Instinct',      description: 'Win with an Ultra Rare card in hand',               icon: '💫' },
  { id: 'humble_victory',   name: 'Humble Victory',      description: 'Win with 4 or more Common cards in one hand',       icon: '🙏' },

  // ── HP & Score ─────────────────────────────────────────────────────────────
  { id: 'blackjack',        name: 'Blackjack!',          description: 'Win with exactly 400 HP on the initial 2-card deal',icon: '🎰' },
  { id: 'close_to_perfect', name: 'Close to Perfect',    description: 'Win with 390–399 HP total',                         icon: '💯' },
  { id: 'danger_zone',      name: 'Danger Zone',         description: 'Win with 375 HP or more',                           icon: '⚠️' },
  { id: 'by_a_thread',      name: 'By a Thread',         description: 'Beat the Gym Leader by 10 HP or less',              icon: '🧵' },
  { id: 'total_domination', name: 'Total Domination',    description: 'Beat the Gym Leader by 200+ HP, or force a bust',   icon: '👑' },
  { id: 'low_roller_win',   name: 'Low Roller',          description: 'Win with under 150 HP total while the Gym Leader busts', icon: '🎲' },
  { id: 'beefy_hand',       name: 'Beefy Hand',          description: 'Win with a single card worth 200+ HP in your hand', icon: '💪' },

  // ── Betting ────────────────────────────────────────────────────────────────
  { id: 'high_roller',      name: 'High Roller',         description: 'Win with a $100 bet',                               icon: '💰' },
  { id: 'big_gamble',       name: 'Big Gamble',          description: 'Win with a $50 bet',                                icon: '🎰' },
  { id: 'playing_it_safe',  name: 'Playing It Safe',     description: 'Win with a $5 bet',                                 icon: '🛡️' },
  { id: 'all_in',           name: 'All In',              description: 'Win after betting 75% or more of your chips',       icon: '🤞' },
  { id: 'loan_shark',       name: 'Loan Shark',          description: 'Win after betting your entire chip stack',           icon: '🦈' },

  // ── Dealer / Situation ─────────────────────────────────────────────────────
  { id: 'gym_buster',       name: 'Gym Buster',          description: 'Win because the Gym Leader busted',                 icon: '💥' },
  { id: 'no_sweat',         name: 'No Sweat',            description: 'Win without hitting once — stand on your first 2 cards', icon: '😎' },
  { id: 'last_stand',       name: 'Last Stand',          description: 'Win with a $5 bet when you had exactly $5',         icon: '🏴' },

  // ── Specific Pokémon ───────────────────────────────────────────────────────
  { id: 'pika_win',         name: 'Pika-Win!',           description: 'Win with Pikachu in your hand',                     icon: '⚡' },
  { id: 'legendary_duel',   name: 'Legendary Duel',      description: 'Win with a card worth 250+ HP in your hand',        icon: '🏆' },
  { id: 'tiny_titan',       name: 'Tiny Titan',          description: 'Win with a card worth 30 HP or less in your hand',  icon: '🐣' },

  // ── Dex ────────────────────────────────────────────────────────────────────
  { id: 'first_catch',      name: 'First Catch!',        description: 'Add your first Pokémon to the Pokédex',             icon: '🎣' },
  { id: 'collector',        name: 'Collector',           description: 'Catch 10 unique Pokémon',                           icon: '📦' },
  { id: 'master_trainer',   name: 'Master Trainer',      description: 'Catch 25 unique Pokémon',                           icon: '📚' },
  { id: 'gotta_catch_em',   name: "Gotta Catch 'Em All", description: 'Catch 50 unique Pokémon',                           icon: '🏅' },

  // ── Comeback ───────────────────────────────────────────────────────────────
  { id: 'comeback_kid',     name: 'Comeback Kid',        description: 'Win a hand after being nearly broke (under $10)',   icon: '🦅' },

  // ── Streaks ────────────────────────────────────────────────────────────────
  { id: 'on_a_roll',        name: 'On a Roll',           description: 'Win 3 hands in a row',                              icon: '🎳' },
  { id: 'unstoppable',      name: 'Unstoppable',         description: 'Win 5 hands in a row',                              icon: '🚀' },
  { id: 'champions_run',    name: "Champion's Run",      description: 'Win 10 hands in a row',                             icon: '🌋' },
];

// ── Win-based achievement checks ─────────────────────────────────────────────
export function checkWinAchievements(ctx: WinContext, already: UnlockedAchievement[]): string[] {
  const done = new Set(already.map(a => a.id));
  const earned: string[] = [];
  const earn = (id: string) => { if (!done.has(id)) earned.push(id); };

  const { hand, playerTotal, dealerTotal, dealerBusted, bet, chipsBeforeBet, isBlackjack, hitCount, winStreak } = ctx;
  const types      = hand.flatMap(c => c.types);
  const uniqueTypes = new Set(types);
  const tiers      = hand.map(c => rarityTier(c.rarity));

  // ── Hand size
  if (hand.length === 2) earn('two_hit_wonder');
  if (hand.length === 3) earn('hat_trick');
  if (hand.length === 4) earn('four_of_a_kind');
  if (hand.length === 5) earn('full_bench');
  if (hand.length >= 6)  earn('marathon');

  // ── Types
  if (uniqueTypes.size === 1) earn('mono_type');
  if (uniqueTypes.size === 2) earn('type_duo');
  if (uniqueTypes.size === 3) earn('type_trio');
  if (uniqueTypes.size >= 4)  earn('rainbow_hand');
  if (hand.every(c => c.types[0] === 'Fire'))       earn('fire_starter');
  if (hand.every(c => c.types[0] === 'Water'))      earn('flood_warning');
  if (hand.every(c => c.types[0] === 'Grass'))      earn('overgrowth');
  if (hand.every(c => c.types[0] === 'Psychic'))    earn('mind_games');
  if (hand.every(c => c.types[0] === 'Lightning'))  earn('static');
  if (hand.every(c => c.types[0] === 'Fighting'))   earn('iron_fist');
  if (hand.every(c => c.types[0] === 'Darkness'))   earn('shadow_hand');
  if (hand.every(c => c.types[0] === 'Colorless'))  earn('colorless_classic');
  if (hand.some(c => c.types.includes('Dragon')))   earn('dragon_tamer');
  if (hand.some(c => c.types.includes('Fairy')))    earn('fairy_dust');
  if (['Fire', 'Water', 'Grass'].every(t => hand.some(c => c.types.includes(t)))) earn('starter_pack');

  // ── Rarity
  if (tiers.every(t => t === 'common'))                                     earn('common_sense');
  if (tiers.every(t => t === 'uncommon'))                                   earn('hidden_gems');
  if (tiers.every(t => !['common', 'uncommon'].includes(t)))                earn('rare_breed');
  if (tiers.filter(t => ['holo', 'ultra', 'secret'].includes(t)).length >= 2) earn('holo_dreams');
  if (tiers.some(t => t === 'secret'))                                      earn('secret_found');
  if (tiers.some(t => t === 'ultra' || t === 'secret'))                     earn('ultra_instinct');
  if (tiers.filter(t => t === 'common').length >= 4)                        earn('humble_victory');

  // ── HP & Score
  if (isBlackjack)                                              earn('blackjack');
  if (!isBlackjack && playerTotal >= 390 && playerTotal <= 399) earn('close_to_perfect');
  if (playerTotal >= 375)                                       earn('danger_zone');
  if (!dealerBusted && playerTotal - dealerTotal <= 10)         earn('by_a_thread');
  if (dealerBusted || playerTotal - dealerTotal >= 200)         earn('total_domination');
  if (dealerBusted && playerTotal < 150)                        earn('low_roller_win');
  if (hand.some(c => c.hp >= 200))                              earn('beefy_hand');

  // ── Betting
  if (bet >= 100) earn('high_roller');
  if (bet >= 50)  earn('big_gamble');
  if (bet === 5)  earn('playing_it_safe');
  if (chipsBeforeBet > 0 && bet >= chipsBeforeBet * 0.75) earn('all_in');
  if (chipsBeforeBet > 0 && bet === chipsBeforeBet)        earn('loan_shark');

  // ── Dealer / Situation
  if (dealerBusted)                     earn('gym_buster');
  if (hitCount === 0)                   earn('no_sweat');
  if (chipsBeforeBet === 5 && bet === 5) earn('last_stand');

  // ── Specific Pokémon
  if (hand.some(c => c.name.toLowerCase().startsWith('pikachu'))) earn('pika_win');
  if (hand.some(c => c.hp >= 250)) earn('legendary_duel');
  if (hand.some(c => c.hp <= 30))  earn('tiny_titan');

  // ── Comeback
  if (chipsBeforeBet < 10) earn('comeback_kid');

  // ── Streaks
  if (winStreak >= 3)  earn('on_a_roll');
  if (winStreak >= 5)  earn('unstoppable');
  if (winStreak >= 10) earn('champions_run');

  return earned;
}

// ── Dex milestone checks (called whenever dex size changes) ──────────────────
export function checkDexAchievements(dexSize: number, already: UnlockedAchievement[]): string[] {
  const done = new Set(already.map(a => a.id));
  const earned: string[] = [];
  const earn = (id: string) => { if (!done.has(id)) earned.push(id); };

  if (dexSize >= 1)  earn('first_catch');
  if (dexSize >= 10) earn('collector');
  if (dexSize >= 25) earn('master_trainer');
  if (dexSize >= 50) earn('gotta_catch_em');

  return earned;
}
