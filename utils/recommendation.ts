
import type { Video, Channel } from '../types';
import { searchVideos } from './api';
import { extractKeywords } from './xrai';

// --- Types ---

interface RecommendationSource {
    searchHistory: string[];
    watchHistory: Video[];
    subscribedChannels: Channel[];
    ngKeywords: string[];
    ngChannels: string[];
    page: number;
}

// --- Helpers ---

const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

// Helper to clean up titles for better search queries
const cleanTitleForSearch = (title: string): string => {
    // Remove common noise like brackets, official, etc.
    return title.replace(/【.*?】|\[.*?\]|\(.*?\)/g, '').trim().split(' ').slice(0, 4).join(' ');
};

/**
 * XRAI: Random History-Based Recommendation Engine
 * 
 * Logic:
 * 1. Pick 10 random videos from watch history as "seeds".
 * 2. Search for related content for ALL 10 seeds.
 * 3. Strict Keyword Matching: Videos must match history keywords to be relevant.
 * 4. Shuffle.
 */
export const getXraiRecommendations = async (sources: RecommendationSource): Promise<Video[]> => {
    const { 
        watchHistory, 
        subscribedChannels,
        ngKeywords,
        ngChannels
    } = sources;

    // --- 1. SEED SELECTION ---
    let seeds: string[] = [];
    
    if (watchHistory.length > 0) {
        // Pick 10 random videos from history
        const historySample = shuffleArray(watchHistory).slice(0, 10);
        seeds = historySample.map(v => `${cleanTitleForSearch(v.title)} related`);
    } else if (subscribedChannels.length > 0) {
        // Fallback to subscriptions if no history
        const subSample = shuffleArray(subscribedChannels).slice(0, 5);
        seeds = subSample.map(c => `${c.name} videos`);
    } else {
        // Cold start
        seeds = ["Trending Japan", "Popular Music", "Gaming", "Cooking", "Vlog"];
    }

    // --- 2. CANDIDATE GENERATION (High Volume) ---
    // Fetch results for ALL seeds concurrently
    const searchPromises = seeds.map(query => 
        searchVideos(query, '1').then(res => res.videos).catch(() => [])
    );
    
    const nestedResults = await Promise.all(searchPromises);
    let candidates = nestedResults.flat();
    
    // Deduplicate
    const seenIds = new Set<string>();
    candidates = candidates.filter(v => {
        if (seenIds.has(v.id)) return false;
        seenIds.add(v.id);
        return true;
    });

    // --- 3. STRICT FILTERING (Relevance Check) ---
    // If we have history, only show videos that match keywords from history.
    if (watchHistory.length > 0) {
        // Build an allowlist of keywords from user history (Title + Channel Name)
        // We take a large sample of recent history to build this profile
        const historyKeywords = new Set<string>();
        watchHistory.slice(0, 50).forEach(v => {
            extractKeywords(v.title).forEach(k => historyKeywords.add(k));
            extractKeywords(v.channelName).forEach(k => historyKeywords.add(k));
        });
        
        // Add subscription names to allowlist
        subscribedChannels.forEach(c => {
            extractKeywords(c.name).forEach(k => historyKeywords.add(k));
        });

        // FILTER: Candidate must have at least one overlapping keyword with history
        candidates = candidates.filter(candidate => {
            const titleKeywords = extractKeywords(candidate.title);
            const channelKeywords = extractKeywords(candidate.channelName);
            
            // Check intersection
            const isRelevant = [...titleKeywords, ...channelKeywords].some(k => historyKeywords.has(k));
            return isRelevant;
        });
    }

    // --- 4. NG FILTERING (Safety) ---
    candidates = candidates.filter(v => {
        const fullText = `${v.title} ${v.channelName}`.toLowerCase();
        if (ngKeywords.some(ng => fullText.includes(ng.toLowerCase()))) return false;
        if (ngChannels.includes(v.channelId)) return false;
        return true;
    });

    // --- 5. SHUFFLING ---
    return shuffleArray(candidates);
};