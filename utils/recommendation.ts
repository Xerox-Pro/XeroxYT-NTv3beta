
import type { Video, Channel } from '../types';
import { searchVideos, getExternalRelatedVideos } from './api';
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
 * 2. Fetch related content for ALL 10 seeds using external API (siawaseok.duckdns.org).
 * 3. Fallback to search if history is empty.
 * 4. Shuffle.
 */
export const getXraiRecommendations = async (sources: RecommendationSource): Promise<Video[]> => {
    const { 
        watchHistory, 
        subscribedChannels,
        ngKeywords,
        ngChannels
    } = sources;

    let candidates: Video[] = [];
    
    // Flag to skip strict keyword filtering if we used the direct related API
    let isDirectRecommendation = false;

    if (watchHistory.length > 0) {
        // Pick 10 random videos from history as seeds
        const historySample = shuffleArray(watchHistory).slice(0, 10);
        
        // Fetch related videos for each seed using the new external API
        // This aligns with the requirement: "randomly select 10 videos and fetch recommendations from the link"
        const relatedPromises = historySample.map(v => 
            getExternalRelatedVideos(v.id).catch(() => [])
        );
        
        const nestedResults = await Promise.all(relatedPromises);
        candidates = nestedResults.flat();
        isDirectRecommendation = true;
    } else if (subscribedChannels.length > 0) {
        // Fallback to subscriptions if no history
        const subSample = shuffleArray(subscribedChannels).slice(0, 5);
        const seeds = subSample.map(c => `${c.name} videos`);
        
        const searchPromises = seeds.map(query => 
            searchVideos(query, '1').then(res => res.videos).catch(() => [])
        );
        
        const nestedResults = await Promise.all(searchPromises);
        candidates = nestedResults.flat();
    } else {
        // Cold start
        const seeds = ["Trending Japan", "Popular Music", "Gaming", "Cooking", "Vlog"];
        const searchPromises = seeds.map(query => 
            searchVideos(query, '1').then(res => res.videos).catch(() => [])
        );
        const nestedResults = await Promise.all(searchPromises);
        candidates = nestedResults.flat();
    }

    // Deduplicate by ID
    const seenIds = new Set<string>();
    candidates = candidates.filter(v => {
        if (seenIds.has(v.id)) return false;
        seenIds.add(v.id);
        return true;
    });

    // --- STRICT FILTERING (Relevance Check) ---
    // Only apply strict keyword filtering if we used the SEARCH method (fallback).
    // If we used the direct related API, we assume the API returns relevant content and skip strict keyword matching
    // to avoid filtering out good but poorly titled recommendations.
    if (!isDirectRecommendation && watchHistory.length > 0) {
        // Build an allowlist of keywords from user history (Title + Channel Name)
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

    // --- NG FILTERING (Safety) ---
    candidates = candidates.filter(v => {
        const fullText = `${v.title} ${v.channelName}`.toLowerCase();
        if (ngKeywords.some(ng => fullText.includes(ng.toLowerCase()))) return false;
        if (ngChannels.includes(v.channelId)) return false;
        return true;
    });

    // --- SHUFFLING ---
    return shuffleArray(candidates);
};
