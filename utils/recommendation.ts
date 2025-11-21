
import type { Video, Channel } from '../types';
import { searchVideos, getVideoDetails, getChannelVideos, getRecommendedVideos, getExternalRelatedVideos } from './api';
import { buildUserProfile, rankVideos, inferTopInterests, type UserProfile } from './xrai';

// --- Types ---

interface RecommendationSource {
    searchHistory: string[];
    watchHistory: Video[];
    subscribedChannels: Channel[];
    preferredGenres: string[];
    preferredChannels: string[];
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

/**
 * XRAI v4 Recommendation Engine
 * Based on "Deep Neural Networks for YouTube Recommendations" (Covington et al., 2016)
 * 
 * Architecture:
 * 1. Candidate Generation (Retrieval):
 *    - Collaborative Filtering Proxy: Using "Related Videos" of recent history (Item-to-Item co-visitation).
 *    - Content-Based: Search results from inferred interests.
 *    - Freshness: Recent uploads from subscriptions.
 * 
 * 2. Ranking:
 *    - Scored by "Predicted Watch Time" rather than just Click Probability.
 *    - Features: Semantics (Vector), Freshness (Example Age), Engagement.
 */
export const getXraiRecommendations = async (sources: RecommendationSource): Promise<Video[]> => {
    const { 
        watchHistory, 
        searchHistory, 
        subscribedChannels, 
        preferredGenres,
        page
    } = sources;

    // --- PHASE 1: CANDIDATE GENERATION (Retrieval) ---
    // Goal: Broadly select high-recall candidates from different sources.

    const candidatePromises: Promise<Video[]>[] = [];

    // Source A: Collaborative Filtering Proxy (Related Videos)
    // The paper relies on "users who watched X also watched Y". 
    // We use the API's `relatedVideos` of the user's *most recent* and *most frequently watched* content as a proxy for this.
    if (watchHistory.length > 0) {
        // 1. The very last video watched (Immediate context)
        candidatePromises.push(
            getExternalRelatedVideos(watchHistory[0].id).catch(() => [])
        );

        // 2. A random video from the last 10 (Discovery within comfort zone)
        if (watchHistory.length > 1) {
            const randomRecent = watchHistory[Math.floor(Math.random() * Math.min(watchHistory.length, 10))];
            candidatePromises.push(
                getExternalRelatedVideos(randomRecent.id).catch(() => [])
            );
        }
    }

    // Source B: Semantic Search (Inferred Interests)
    // Extract latent concepts from user history + explicit preferences
    const userProfile = buildUserProfile({
        watchHistory,
        searchHistory,
        subscribedChannels,
    });
    
    const inferredTopics = inferTopInterests(userProfile, 4); // Top 4 concepts
    const activeTopics = Array.from(new Set([...preferredGenres, ...inferredTopics])).slice(0, 5);

    if (activeTopics.length > 0) {
        // Create a dense query to fetch "New" and "Relevant" content
        // We rotate topics based on page number to ensure variety across infinite scroll
        const topicIndex = (page - 1) % activeTopics.length;
        const focusTopic = activeTopics[topicIndex];
        
        // Query 1: Fresh content for the topic
        candidatePromises.push(
            searchVideos(`${focusTopic}`, String(page))
                .then(res => res.videos)
                .catch(() => [])
        );
        
        // Query 2: "New" content (Discovery) - only on first page or every 3rd page
        if (page === 1 || page % 3 === 0) {
             candidatePromises.push(
                searchVideos(`${focusTopic} new`, '1')
                    .then(res => res.videos)
                    .catch(() => [])
            );
        }
    } else if (page === 1) {
        // Cold Start: Generic trending in Japan
        candidatePromises.push(
            searchVideos("Japan trending", '1').then(res => res.videos).catch(() => [])
        );
    }

    // Source C: Subscriptions (The "Subscribe" Signal)
    // The paper notes subscribed channels are a strong signal of interest.
    if (subscribedChannels.length > 0) {
        // Pick 2 random channels to check for recent updates
        const randomSubs = shuffleArray(subscribedChannels).slice(0, 2);
        randomSubs.forEach(sub => {
            candidatePromises.push(
                getChannelVideos(sub.id).then(res => res.videos.slice(0, 8)).catch(() => [])
            );
        });
    }

    // Fetch all candidates
    const nestedCandidates = await Promise.all(candidatePromises);
    const rawCandidates = nestedCandidates.flat();

    // Deduplication (Key Step)
    const uniqueCandidates = Array.from(new Map(rawCandidates.map(v => [v.id, v])).values());
    
    // Remove videos already watched (Filtering)
    const historyIds = new Set(watchHistory.map(v => v.id));
    const candidates = uniqueCandidates.filter(v => !historyIds.has(v.id));

    // --- PHASE 2: RANKING ---
    // Goal: Score candidates by "Predicted Watch Time".
    
    const rankedVideos = rankVideos(candidates, userProfile, {
        ngKeywords: sources.ngKeywords,
        ngChannels: sources.ngChannels,
        watchHistory: sources.watchHistory,
        // If the user has no specific preference, we simulate a mix of discovery and comfort
        mode: sources.preferredGenres.length > 0 ? 'discovery' : 'comfort'
    });

    // Return top ranked results
    return rankedVideos.slice(0, 50);
};

// --- Legacy Engine (Fallback) ---

export const getLegacyRecommendations = async (): Promise<Video[]> => {
    try {
        const { videos } = await getRecommendedVideos();
        return shuffleArray(videos); 
    } catch (error) {
        console.error("Failed to fetch legacy recommendations:", error);
        return [];
    }
}
