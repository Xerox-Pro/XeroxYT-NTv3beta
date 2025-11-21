
import type { Video, Channel } from '../types';
import { searchVideos, getVideoDetails, getChannelVideos, getRecommendedVideos } from './api';
import { buildUserProfile, rankVideos } from './xrai';

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

// --- XRAI v2 Recommendation Engine ---

export const getXraiRecommendations = async (sources: RecommendationSource): Promise<Video[]> => {
    const { 
        watchHistory, 
        searchHistory, 
        subscribedChannels, 
    } = sources;

    const userProfile = buildUserProfile({
        watchHistory,
        searchHistory,
        subscribedChannels,
    });
    
    const candidatePromises: Promise<Video[]>[] = [];

    // Source A: Deep Related Video Walk (High Priority)
    if (watchHistory.length > 0) {
        const recentVideos = shuffleArray(watchHistory.slice(0, 5)).slice(0, 3);
        recentVideos.forEach(video => {
            candidatePromises.push(
                getVideoDetails(video.id)
                    .then(details => (details.relatedVideos || []).slice(0, 15))
                    .catch(() => [])
            );
        });
    }

    // Source B: Interest-based Search
    const topKeywords = [...userProfile.keywords.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(entry => entry[0]);
    
    topKeywords.forEach(keyword => {
        candidatePromises.push(
            searchVideos(keyword, '1')
                .then(res => res.videos.slice(0, 10))
                .catch(() => [])
        );
    });

    // Source C: Subscribed Channel's Recent Videos
    if (subscribedChannels.length > 0) {
        const randomSubs = shuffleArray(subscribedChannels).slice(0, 5);
        randomSubs.forEach(sub => {
            candidatePromises.push(
                getChannelVideos(sub.id)
                    .then(res => res.videos.slice(0, 5))
                    .catch(() => [])
            );
        });
    }

    // Source D: Fallback (General recommendations)
    if (candidatePromises.length < 3) {
         candidatePromises.push(
            getRecommendedVideos()
                .then(res => res.videos.slice(0, 20))
                .catch(() => [])
        );
    }

    const results = await Promise.allSettled(candidatePromises);
    let allCandidates: Video[] = [];
    results.forEach(result => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            allCandidates.push(...result.value);
        }
    });

    const rankedVideos = rankVideos(allCandidates, userProfile, {
        ngKeywords: sources.ngKeywords,
        ngChannels: sources.ngChannels,
        watchHistory: sources.watchHistory,
    });
    
    return rankedVideos.slice(0, 50);
};


// --- Legacy Recommendation Engine ---

/**
 * 従来のシンプルなYouTube風の推薦を生成する。
 * youtubei.jsが提供するデフォルトのホームフィードを使用する。
 */
export const getLegacyRecommendations = async (): Promise<Video[]> => {
    try {
        const { videos } = await getRecommendedVideos();
        return videos;
    } catch (error) {
        console.error("Failed to fetch legacy recommendations:", error);
        return [];
    }
}
