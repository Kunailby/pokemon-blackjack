import { ICard } from '../models/Card';
/**
 * Scrape Pokemon cards from pkmncards.com
 * NOTE: This is a basic scraper. Actual implementation may need adjustments
 * based on website structure changes.
 */
interface ScrapedCardData {
    name: string;
    hp: number;
    imageUrl: string;
    pokemonId: string;
    setName: string;
    cardNumber: string;
}
/**
 * Scrape cards from a specific set
 */
export declare const scrapeCardsFromSet: (setUrl: string) => Promise<ScrapedCardData[]>;
/**
 * Save scraped cards to database
 */
export declare const saveScrappedCards: (cards: ScrapedCardData[]) => Promise<ICard[]>;
/**
 * Seed sample Pokemon cards (for development/testing)
 */
export declare const seedSampleCards: () => Promise<(import("mongoose").Document<unknown, {}, ICard, {}, {}> & ICard & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
})[]>;
export {};
//# sourceMappingURL=CardScraper.d.ts.map