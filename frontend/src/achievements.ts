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
  hand: { name: string; hp: number; types: string[]; rarity: string; id: string }[];
  playerTotal: number;
  dealerTotal: number;
  dealerBusted: boolean;
  bet: number;
  chipsBeforeBet: number;
  chipsAfterWin: number;        // chipsBeforeBet + bet (total chips after 2× payout)
  isBlackjack: boolean;
  hitCount: number;
  winStreak: number;
  dealerFinalHandSize: number;  // 3 = dealer stood immediately; >3 = drew extra cards
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

// ── All 106 achievements ──────────────────────────────────────────────────────
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
  { id: 'all_metal',        name: 'Steel Curtain',       description: 'Win with only Metal type cards',                    icon: '⚙️' },
  { id: 'pure_dragon',      name: 'Pure Dragon',         description: 'Win with only Dragon type cards',                   icon: '🐲' },
  { id: 'fairy_tale',       name: 'Fairy Tale',          description: 'Win with only Fairy type cards',                    icon: '🌙' },
  { id: 'dragon_tamer',     name: 'Dragon Tamer',        description: 'Win with at least one Dragon type card',            icon: '🐉' },
  { id: 'fairy_dust',       name: 'Fairy Dust',          description: 'Win with at least one Fairy type card',             icon: '🧚' },
  { id: 'starter_pack',     name: 'Starter Pack',        description: 'Win with Fire, Water, and Grass all in hand',       icon: '🌟' },
  { id: 'scorched_earth',   name: 'Scorched Earth',      description: 'Win with 3 or more Fire type cards in hand',        icon: '🌋' },
  { id: 'full_coverage',    name: 'Full Coverage',       description: 'Win with 5 or more different types in one hand',    icon: '🌐' },
  { id: 'fire_and_steel',   name: 'Fire & Steel',        description: 'Win with both Fire and Metal type cards in hand',   icon: '⚒️' },

  // ── Rarity ─────────────────────────────────────────────────────────────────
  { id: 'common_sense',     name: 'Common Sense',        description: 'Win with only Common rarity cards',                 icon: '⚪' },
  { id: 'hidden_gems',      name: 'Hidden Gems',         description: 'Win with only Uncommon rarity cards',               icon: '🔵' },
  { id: 'rare_breed',       name: 'Rare Breed',          description: 'Win with only Rare or better cards',                icon: '⭐' },
  { id: 'holo_dreams',      name: 'Holo Dreams',         description: 'Win with 2 or more Holo Rare cards in hand',        icon: '✨' },
  { id: 'secret_found',     name: 'Secret Found',        description: 'Win with a Secret Rare card in hand',               icon: '🌠' },
  { id: 'ultra_instinct',   name: 'Ultra Instinct',      description: 'Win with an Ultra Rare card in hand',               icon: '💫' },
  { id: 'humble_victory',   name: 'Humble Victory',      description: 'Win with 4 or more Common cards in one hand',       icon: '🙏' },
  { id: 'full_holo',        name: 'Full Holo',           description: 'Win with every card being Holo Rare or better',     icon: '🌟' },
  { id: 'mixed_bag',        name: 'Mixed Bag',           description: 'Win with cards spanning 3 or more different rarities', icon: '🎭' },

  // ── HP & Score ─────────────────────────────────────────────────────────────
  { id: 'blackjack',        name: 'Blackjack!',          description: 'Win with exactly 400 HP on the initial 2-card deal',icon: '🎰' },
  { id: 'close_to_perfect', name: 'Close to Perfect',    description: 'Win with 390–399 HP total',                         icon: '💯' },
  { id: 'danger_zone',      name: 'Danger Zone',         description: 'Win with 375 HP or more',                           icon: '⚠️' },
  { id: 'by_a_thread',      name: 'By a Thread',         description: 'Beat the Gym Leader by 10 HP or less',              icon: '🧵' },
  { id: 'total_domination', name: 'Total Domination',    description: 'Beat the Gym Leader by 200+ HP, or force a bust',   icon: '👑' },
  { id: 'low_roller_win',   name: 'Low Roller',          description: 'Win with under 150 HP total while the Gym Leader busts', icon: '🎲' },
  { id: 'beefy_hand',       name: 'Beefy Hand',          description: 'Win with a single card worth 200+ HP in your hand', icon: '💪' },
  { id: 'photo_finish',     name: 'Photo Finish',        description: 'Win by exactly 1 HP',                               icon: '📸' },
  { id: 'peak_perfection',  name: 'Peak Perfection',     description: 'Hit your way to exactly 400 HP (3+ cards)',         icon: '🎯' },
  { id: 'overachiever',     name: 'Overachiever',        description: 'Win with 2 cards totalling 200+ HP',                icon: '🦾' },
  { id: 'tag_team',         name: 'Tag Team',            description: 'Win with 2 or more cards sharing the exact same HP', icon: '👯' },
  { id: 'glass_cannon',     name: 'Glass Cannon',        description: 'Win with a ≤20 HP card and a ≥250 HP card in hand', icon: '💣' },
  { id: 'the_wall',         name: 'The Wall',            description: 'Win with 3 or more cards each having 100+ HP',      icon: '🧱' },
  { id: 'underdogs',        name: 'Underdogs',           description: 'Win with every card having 50 HP or less',          icon: '🐭' },
  { id: 'all_different',    name: 'All Different',       description: 'Win where every card in your hand has a unique HP value', icon: '🎨' },
  { id: 'century_club',     name: 'Century Club',        description: 'Win with a card having exactly 100 HP',             icon: '💯' },
  { id: 'cold_read',        name: 'Cold Read',           description: 'Win without hitting once AND with 350+ HP total',   icon: '❄️' },

  // ── Betting ────────────────────────────────────────────────────────────────
  { id: 'high_roller',      name: 'High Roller',         description: 'Win with a $100 bet',                               icon: '💰' },
  { id: 'big_gamble',       name: 'Big Gamble',          description: 'Win with a $50 bet',                                icon: '🎰' },
  { id: 'bargain_hunter',   name: 'Bargain Hunter',      description: 'Win with a $10 bet',                                icon: '💲' },
  { id: 'playing_it_safe',  name: 'Playing It Safe',     description: 'Win with a $5 bet',                                 icon: '🛡️' },
  { id: 'all_in',           name: 'All In',              description: 'Win after betting 75% or more of your chips',       icon: '🤞' },
  { id: 'loan_shark',       name: 'Loan Shark',          description: 'Win after betting your entire chip stack',           icon: '🦈' },
  { id: 'chip_2k',          name: 'High Earner',         description: 'Accumulate 2,000 chips',                            icon: '🤑' },
  { id: 'chip_5k',          name: 'Wealthy Trainer',     description: 'Accumulate 5,000 chips',                            icon: '💵' },
  { id: 'chip_10k',         name: 'Pokémon Champion',    description: 'Accumulate 10,000 chips',                           icon: '🏆' },

  // ── Dealer / Situation ─────────────────────────────────────────────────────
  { id: 'gym_buster',       name: 'Gym Buster',          description: 'Win because the Gym Leader busted',                 icon: '💥' },
  { id: 'no_sweat',         name: 'No Sweat',            description: 'Win without hitting once — stand on your first 2 cards', icon: '😎' },
  { id: 'last_stand',       name: 'Last Stand',          description: 'Win with a $5 bet when you had exactly $5',         icon: '🏴' },
  { id: 'gym_leader_frozen',name: 'Gym Leader Frozen',   description: 'Win while the Gym Leader stood on their opening 3 cards', icon: '🧊' },
  { id: 'double_barrel',    name: 'Double Barrel',       description: 'Win while the Gym Leader drew 2 or more extra cards', icon: '🎯' },

  // ── Specific Pokémon ───────────────────────────────────────────────────────
  { id: 'pika_win',         name: 'Pika-Win!',           description: 'Win with Pikachu in your hand',                     icon: '⚡' },
  { id: 'legendary_duel',   name: 'Legendary Duel',      description: 'Win with a card worth 250+ HP in your hand',        icon: '🏆' },
  { id: 'tiny_titan',       name: 'Tiny Titan',          description: 'Win with a card worth 30 HP or less in your hand',  icon: '🐣' },
  { id: 'eevee_lution',     name: 'Eevee-lution',        description: 'Win with Eevee or any of its evolutions in hand',   icon: '🦊' },
  { id: 'pseudo_legendary', name: 'Pseudo-Legendary',    description: 'Win with a pseudo-legendary Pokémon in hand',       icon: '🌟' },
  { id: 'baby_power',       name: 'Baby Power',          description: 'Win with a baby Pokémon in hand',                   icon: '🍼' },
  { id: 'ex_factor',        name: 'EX Factor',           description: 'Win with an EX or GX card in your hand',            icon: '💎' },
  { id: 'vmax_pull',        name: 'VMAX Pull',           description: 'Win with a VMAX or VSTAR card in your hand',        icon: '🃏' },
  { id: 'twin_spirits',     name: 'Twin Spirits',        description: 'Win with 2 or more cards from the same Pokémon species', icon: '👥' },

  // ── Dex — unique species ───────────────────────────────────────────────────
  { id: 'first_catch',      name: 'First Catch!',        description: 'Add your first Pokémon to the Pokédex',             icon: '🎣' },
  { id: 'collector',        name: 'Collector',           description: 'Catch 10 unique Pokémon',                           icon: '📦' },
  { id: 'master_trainer',   name: 'Master Trainer',      description: 'Catch 25 unique Pokémon',                           icon: '📚' },
  { id: 'gotta_catch_em',   name: "Gotta Catch 'Em All", description: 'Catch 50 unique Pokémon',                           icon: '🏅' },
  { id: 'dex_75',           name: 'Dedicated Collector', description: 'Catch 75 unique Pokémon',                           icon: '📋' },
  { id: 'dex_100',          name: 'Century Catcher',     description: 'Catch 100 unique Pokémon',                          icon: '🎖️' },

  // ── Dex — total catches ────────────────────────────────────────────────────
  { id: 'dex_150',          name: 'Card Hoarder',        description: 'Collect 150 Pokémon cards in your Pokédex',         icon: '📇' },
  { id: 'dex_200',          name: 'Archivist',           description: 'Collect 200 Pokémon cards in your Pokédex',         icon: '🗂️' },
  { id: 'dex_250',          name: 'Encyclopedist',       description: 'Collect 250 Pokémon cards in your Pokédex',         icon: '📖' },
  { id: 'dex_300',          name: 'Living Pokédex',      description: 'Collect 300 Pokémon cards in your Pokédex',         icon: '🌐' },
  { id: 'dex_400',          name: 'Card Mountain',       description: 'Collect 400 Pokémon cards in your Pokédex',         icon: '🏔️' },
  { id: 'dex_500',          name: 'Card Avalanche',      description: 'Collect 500 Pokémon cards in your Pokédex',         icon: '🌊' },

  // ── Starters ───────────────────────────────────────────────────────────────
  { id: 'starters_kanto',   name: 'OG Trio',             description: 'Catch all 3 Kanto starters (Bulbasaur, Charmander, Squirtle lines)',   icon: '🔴' },
  { id: 'starters_johto',   name: 'Johto Journey',       description: 'Catch all 3 Johto starters (Chikorita, Cyndaquil, Totodile lines)',    icon: '🌿' },
  { id: 'starters_hoenn',   name: 'Hoenn Heroes',        description: 'Catch all 3 Hoenn starters (Treecko, Torchic, Mudkip lines)',         icon: '🌊' },
  { id: 'starters_sinnoh',  name: 'Sinnoh Legends',      description: 'Catch all 3 Sinnoh starters (Turtwig, Chimchar, Piplup lines)',       icon: '❄️' },
  { id: 'starters_unova',   name: 'Unova United',        description: 'Catch all 3 Unova starters (Snivy, Tepig, Oshawott lines)',           icon: '⚫' },
  { id: 'starters_kalos',   name: 'Kalos Collection',    description: 'Catch all 3 Kalos starters (Chespin, Fennekin, Froakie lines)',       icon: '🥐' },
  { id: 'starters_alola',   name: 'Alolan Spirit',       description: 'Catch all 3 Alola starters (Rowlet, Litten, Popplio lines)',          icon: '🌺' },
  { id: 'starters_galar',   name: 'Galar Gang',          description: 'Catch all 3 Galar starters (Grookey, Scorbunny, Sobble lines)',       icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'starters_paldea',  name: 'Paldea Pioneers',     description: 'Catch all 3 Paldea starters (Sprigatito, Fuecoco, Quaxly lines)',     icon: '🌸' },

  // ── Comeback ───────────────────────────────────────────────────────────────
  { id: 'comeback_kid',     name: 'Comeback Kid',        description: 'Win a hand after being nearly broke (under $10)',   icon: '🦅' },

  // ── Streaks ────────────────────────────────────────────────────────────────
  { id: 'on_a_roll',        name: 'On a Roll',           description: 'Win 3 hands in a row',                              icon: '🎳' },
  { id: 'unstoppable',      name: 'Unstoppable',         description: 'Win 5 hands in a row',                              icon: '🚀' },
  { id: 'lucky_7',          name: 'Lucky 7',             description: 'Win 7 hands in a row',                              icon: '🍀' },
  { id: 'champions_run',    name: "Champion's Run",      description: 'Win 10 hands in a row',                             icon: '🌋' },
  { id: 'legendary_streak', name: 'Legendary Streak',    description: 'Win 15 hands in a row',                             icon: '🌟' },

  // ── Meta ───────────────────────────────────────────────────────────────────
  { id: 'achievement_hunter', name: 'Achievement Hunter', description: 'Unlock 25 achievements',                           icon: '🎖️' },
  { id: 'half_century',     name: 'Half Century',        description: 'Unlock 50 achievements',                            icon: '🏆' },
];

// ── Pseudo-legendary Pokémon names ────────────────────────────────────────────
const PSEUDO_LEGENDARIES = [
  'dragonite', 'tyranitar', 'salamence', 'metagross', 'garchomp',
  'hydreigon', 'goodra', 'kommo-o', 'dragapult', 'baxcalibur',
];

// ── Baby Pokémon names ────────────────────────────────────────────────────────
const BABIES = [
  'pichu', 'cleffa', 'igglybuff', 'togepi', 'smoochum', 'elekid', 'magby',
  'tyrogue', 'azurill', 'wynaut', 'budew', 'chingling', 'bonsly', 'mime jr',
  'happiny', 'munchlax', 'riolu', 'mantyke', 'toxel',
];

// ── Eeveelutions ──────────────────────────────────────────────────────────────
const EEVEELUTIONS = [
  'eevee', 'vaporeon', 'jolteon', 'flareon', 'espeon',
  'umbreon', 'leafeon', 'glaceon', 'sylveon',
];

// ── Win-based achievement checks ─────────────────────────────────────────────
export function checkWinAchievements(ctx: WinContext, already: UnlockedAchievement[]): string[] {
  const done = new Set(already.map(a => a.id));
  const earned: string[] = [];
  const earn = (id: string) => { if (!done.has(id) && !earned.includes(id)) earned.push(id); };

  const {
    hand, playerTotal, dealerTotal, dealerBusted, bet,
    chipsBeforeBet, chipsAfterWin, isBlackjack, hitCount,
    winStreak, dealerFinalHandSize,
  } = ctx;
  const types       = hand.flatMap(c => c.types);
  const uniqueTypes = new Set(types);
  const tiers       = hand.map(c => rarityTier(c.rarity));

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
  if (uniqueTypes.size >= 5)  earn('full_coverage');
  if (hand.every(c => c.types[0] === 'Fire'))       earn('fire_starter');
  if (hand.every(c => c.types[0] === 'Water'))      earn('flood_warning');
  if (hand.every(c => c.types[0] === 'Grass'))      earn('overgrowth');
  if (hand.every(c => c.types[0] === 'Psychic'))    earn('mind_games');
  if (hand.every(c => c.types[0] === 'Lightning'))  earn('static');
  if (hand.every(c => c.types[0] === 'Fighting'))   earn('iron_fist');
  if (hand.every(c => c.types[0] === 'Darkness'))   earn('shadow_hand');
  if (hand.every(c => c.types[0] === 'Colorless'))  earn('colorless_classic');
  if (hand.every(c => c.types[0] === 'Metal'))      earn('all_metal');
  if (hand.every(c => c.types[0] === 'Dragon'))     earn('pure_dragon');
  if (hand.every(c => c.types[0] === 'Fairy'))      earn('fairy_tale');
  if (hand.some(c => c.types.includes('Dragon')))   earn('dragon_tamer');
  if (hand.some(c => c.types.includes('Fairy')))    earn('fairy_dust');
  if (['Fire', 'Water', 'Grass'].every(t => hand.some(c => c.types.includes(t)))) earn('starter_pack');
  if (hand.filter(c => c.types.includes('Fire')).length >= 3)  earn('scorched_earth');
  if (hand.some(c => c.types.includes('Fire')) && hand.some(c => c.types.includes('Metal'))) earn('fire_and_steel');

  // ── Rarity
  if (tiers.every(t => t === 'common'))                                          earn('common_sense');
  if (tiers.every(t => t === 'uncommon'))                                        earn('hidden_gems');
  if (tiers.every(t => !['common', 'uncommon'].includes(t)))                     earn('rare_breed');
  if (tiers.filter(t => ['holo', 'ultra', 'secret'].includes(t)).length >= 2)   earn('holo_dreams');
  if (tiers.some(t => t === 'secret'))                                           earn('secret_found');
  if (tiers.some(t => t === 'ultra' || t === 'secret'))                          earn('ultra_instinct');
  if (tiers.filter(t => t === 'common').length >= 4)                             earn('humble_victory');
  if (tiers.every(t => ['holo', 'ultra', 'secret'].includes(t)))                 earn('full_holo');
  const uniqueTiers = new Set(tiers);
  if (uniqueTiers.size >= 3)                                                     earn('mixed_bag');

  // ── HP & Score
  if (isBlackjack)                                               earn('blackjack');
  if (!isBlackjack && playerTotal >= 390 && playerTotal <= 399)  earn('close_to_perfect');
  if (playerTotal >= 375)                                        earn('danger_zone');
  if (!dealerBusted && playerTotal - dealerTotal <= 10)          earn('by_a_thread');
  if (!dealerBusted && playerTotal - dealerTotal === 1)          earn('photo_finish');
  if (dealerBusted || playerTotal - dealerTotal >= 200)          earn('total_domination');
  if (dealerBusted && playerTotal < 150)                         earn('low_roller_win');
  if (hand.some(c => c.hp >= 200))                               earn('beefy_hand');
  if (!isBlackjack && playerTotal === 400 && hand.length >= 3)   earn('peak_perfection');
  if (hand.length === 2 && playerTotal >= 200)                   earn('overachiever');
  const hpValues = hand.map(c => c.hp);
  if (hpValues.some((v, i) => hpValues.indexOf(v) !== i))        earn('tag_team');
  if (hand.some(c => c.hp <= 20) && hand.some(c => c.hp >= 250)) earn('glass_cannon');
  if (hand.filter(c => c.hp >= 100).length >= 3)                 earn('the_wall');
  if (hand.every(c => c.hp <= 50))                               earn('underdogs');
  const uniqueHPs = new Set(hpValues);
  if (uniqueHPs.size === hand.length && hand.length >= 3)         earn('all_different');
  if (hand.some(c => c.hp === 100))                              earn('century_club');
  if (hitCount === 0 && playerTotal >= 350)                      earn('cold_read');

  // ── Betting
  if (bet >= 100) earn('high_roller');
  if (bet >= 50)  earn('big_gamble');
  if (bet === 10) earn('bargain_hunter');
  if (bet === 5)  earn('playing_it_safe');
  if (chipsBeforeBet > 0 && bet >= chipsBeforeBet * 0.75) earn('all_in');
  if (chipsBeforeBet > 0 && bet === chipsBeforeBet)        earn('loan_shark');
  if (chipsAfterWin >= 2000)  earn('chip_2k');
  if (chipsAfterWin >= 5000)  earn('chip_5k');
  if (chipsAfterWin >= 10000) earn('chip_10k');

  // ── Dealer / Situation
  if (dealerBusted)                      earn('gym_buster');
  if (hitCount === 0)                    earn('no_sweat');
  if (chipsBeforeBet === 5 && bet === 5) earn('last_stand');
  if (dealerFinalHandSize === 3)         earn('gym_leader_frozen');
  if (dealerFinalHandSize >= 5)          earn('double_barrel');

  // ── Specific Pokémon
  if (hand.some(c => c.name.toLowerCase().startsWith('pikachu'))) earn('pika_win');
  if (hand.some(c => c.hp >= 250)) earn('legendary_duel');
  if (hand.some(c => c.hp <= 30))  earn('tiny_titan');
  if (hand.some(c => EEVEELUTIONS.some(e => c.name.toLowerCase().startsWith(e)))) earn('eevee_lution');
  if (hand.some(c => PSEUDO_LEGENDARIES.some(p => c.name.toLowerCase().startsWith(p)))) earn('pseudo_legendary');
  if (hand.some(c => BABIES.some(b => c.name.toLowerCase().startsWith(b)))) earn('baby_power');
  if (hand.some(c => /\b(EX|GX)\b/i.test(c.name))) earn('ex_factor');
  if (hand.some(c => /\b(VMAX|VSTAR)\b/i.test(c.name))) earn('vmax_pull');
  // Twin spirits: 2+ cards with the same base Pokémon name (strip set suffixes)
  const baseName = (n: string) => n.replace(/\s+(EX|GX|V|VMAX|VSTAR|BREAK|LV\.X|δ)(\s|$)/gi, '').trim().toLowerCase();
  const baseNames = hand.map(c => baseName(c.name));
  if (baseNames.some((n, i) => baseNames.indexOf(n) !== i)) earn('twin_spirits');

  // ── Comeback
  if (chipsBeforeBet < 10) earn('comeback_kid');

  // ── Streaks
  if (winStreak >= 3)  earn('on_a_roll');
  if (winStreak >= 5)  earn('unstoppable');
  if (winStreak >= 7)  earn('lucky_7');
  if (winStreak >= 10) earn('champions_run');
  if (winStreak >= 15) earn('legendary_streak');

  // ── Meta: check after main loop (count includes current batch)
  const totalUnlocked = done.size + earned.length;
  if (totalUnlocked >= 25) earn('achievement_hunter');
  if (totalUnlocked >= 50) earn('half_century');

  return earned;
}

// ── Starter families per region ──────────────────────────────────────────────
// Each inner array is one evolutionary line; catching ANY member counts.
const STARTERS: Record<string, string[][]> = {
  starters_kanto:  [['Bulbasaur','Ivysaur','Venusaur'],      ['Charmander','Charmeleon','Charizard'],   ['Squirtle','Wartortle','Blastoise']],
  starters_johto:  [['Chikorita','Bayleef','Meganium'],       ['Cyndaquil','Quilava','Typhlosion'],      ['Totodile','Croconaw','Feraligatr']],
  starters_hoenn:  [['Treecko','Grovyle','Sceptile'],         ['Torchic','Combusken','Blaziken'],        ['Mudkip','Marshtomp','Swampert']],
  starters_sinnoh: [['Turtwig','Grotle','Torterra'],          ['Chimchar','Monferno','Infernape'],       ['Piplup','Prinplup','Empoleon']],
  starters_unova:  [['Snivy','Servine','Serperior'],          ['Tepig','Pignite','Emboar'],              ['Oshawott','Dewott','Samurott']],
  starters_kalos:  [['Chespin','Quilladin','Chesnaught'],     ['Fennekin','Braixen','Delphox'],          ['Froakie','Frogadier','Greninja']],
  starters_alola:  [['Rowlet','Dartrix','Decidueye'],         ['Litten','Torracat','Incineroar'],        ['Popplio','Brionne','Primarina']],
  starters_galar:  [['Grookey','Thwackey','Rillaboom'],       ['Scorbunny','Raboot','Cinderace'],        ['Sobble','Drizzile','Inteleon']],
  starters_paldea: [['Sprigatito','Floragato','Meowscarada'], ['Fuecoco','Crocalor','Skeledirge'],       ['Quaxly','Quaxwell','Quaquaval']],
};

function hasStarterLine(names: string[], line: string[]): boolean {
  return names.some(n => line.some(s => n.toLowerCase().includes(s.toLowerCase())));
}

// ── Dex milestone checks (called whenever dex changes) ───────────────────────
// uniqueSize  = count of distinct Pokémon names
// totalSize   = total dex entries (including duplicate catches)
// allNames    = every name in the dex (duplicates included)
export function checkDexAchievements(
  uniqueSize: number,
  totalSize: number,
  allNames: string[],
  already: UnlockedAchievement[],
): string[] {
  const done = new Set(already.map(a => a.id));
  const earned: string[] = [];
  const earn = (id: string) => { if (!done.has(id)) earned.push(id); };

  // Unique species milestones
  if (uniqueSize >= 1)   earn('first_catch');
  if (uniqueSize >= 10)  earn('collector');
  if (uniqueSize >= 25)  earn('master_trainer');
  if (uniqueSize >= 50)  earn('gotta_catch_em');
  if (uniqueSize >= 75)  earn('dex_75');
  if (uniqueSize >= 100) earn('dex_100');

  // Total catch milestones
  if (totalSize >= 150) earn('dex_150');
  if (totalSize >= 200) earn('dex_200');
  if (totalSize >= 250) earn('dex_250');
  if (totalSize >= 300) earn('dex_300');
  if (totalSize >= 400) earn('dex_400');
  if (totalSize >= 500) earn('dex_500');

  // Starter set achievements — need one Pokémon from each of the 3 lines
  for (const [id, lines] of Object.entries(STARTERS)) {
    if (lines.every(line => hasStarterLine(allNames, line))) earn(id);
  }

  return earned;
}
