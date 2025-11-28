import type { Video, Channel } from '../types';
import { searchVideos, getRecommendedVideos, parseDuration } from './api';
import { extractKeywords } from './xrai';
import type { BlockedChannel, HiddenVideo } from '../contexts/PreferenceContext';

interface RecommendationSource {
    searchHistory: string[];
    watchHistory: Video[];
    shortsHistory?: Video[];
    subscribedChannels: Channel[];
    ngKeywords: string[];
    ngChannels: BlockedChannel[];
    hiddenVideos: HiddenVideo[];
    negativeKeywords: Map<string, number>;
    page: number;
}

const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const cleanTitleForSearch = (title: string): string => {
    return title.replace(/【.*?】|\[.*?\]|\(.*?\)/g, '').trim().split(' ').slice(0, 4).join(' ');
};

export const getXraiRecommendations = async (sources: RecommendationSource): Promise<Video[]> => {
    const { 
        watchHistory, 
        subscribedChannels,
        ngKeywords,
        ngChannels,
        hiddenVideos,
        negativeKeywords
    } = sources;

    const TARGET_COUNT = 50; // Target number of videos to return per batch
    const TRENDING_RATIO = 0.40; // 40%

    // 1. Fetch Personalized Videos
    let personalizedSeeds: string[] = [];
    if (watchHistory.length > 0) {
        const historySample = shuffleArray(watchHistory).slice(0, 5);
        personalizedSeeds = historySample.map(v => `${cleanTitleForSearch(v.title)} related`);
    } else if (subscribedChannels.length > 0) {
        const subSample = shuffleArray(subscribedChannels).slice(0, 3);
        personalizedSeeds = subSample.map(c => `${c.name} videos`);
    } else {
        personalizedSeeds = ["Music", "Gaming", "Vlog"]; // Fallback seeds
    }

    const searchPromises = personalizedSeeds.map(query => 
        searchVideos(query, '1').then(res => res.videos).catch(() => [])
    );
    const personalizedResults = await Promise.all(searchPromises);
    let personalizedCandidates = personalizedResults.flat();
    
    // 2. Fetch Trending/Popular Videos
    const trendingPromise = getRecommendedVideos().then(res => res.videos).catch(() => []);
    const trendingVideos = await trendingPromise;

    // 3. Combine and Filter
    const hiddenVideoIdsSet = new Set(hiddenVideos.map(v => v.id));
    const seenIds = new Set<string>(hiddenVideoIdsSet);
    
    const filterAndDedupe = (videos: Video[]): Video[] => {
        return videos.filter(v => {
            if (seenIds.has(v.id)) return false;
            seenIds.add(v.id);

            const fullText = `${v.title} ${v.channelName}`.toLowerCase();
            const ngChannelIds = new Set(ngChannels.map(c => c.id));

            if (ngKeywords.some(ng => fullText.includes(ng.toLowerCase()))) return false;
            if (ngChannelIds.has(v.channelId)) return false;

            const vKeywords = [...extractKeywords(v.title), ...extractKeywords(v.channelName)];
            let negativeScore = 0;
            vKeywords.forEach(k => {
                if (negativeKeywords.has(k)) {
                    negativeScore += (negativeKeywords.get(k) || 0);
                }
            });
            if (negativeScore > 2) return false;
            
            return true;
        });
    };

    const cleanTrending = filterAndDedupe(trendingVideos);
    const cleanPersonalized = filterAndDedupe(personalizedCandidates);

    // 4. Mix according to ratio
    const numTrending = Math.floor(TARGET_COUNT * TRENDING_RATIO);
    const numPersonalized = TARGET_COUNT - numTrending;

    const finalTrending = shuffleArray(cleanTrending).slice(0, numTrending);
    const finalPersonalized = shuffleArray(cleanPersonalized).slice(0, numPersonalized);

    const finalFeed = [...finalTrending, ...finalPersonalized];
    
    return shuffleArray(finalFeed);
};


export const getXraiShorts = async (sources: RecommendationSource): Promise<Video[]> => {
    const { 
        watchHistory, 
        shortsHistory,
        subscribedChannels,
        hiddenVideos,
        ngChannels,
        ngKeywords,
        negativeKeywords
    } = sources;

    const TARGET_COUNT = 40;
    const POPULAR_RATIO = 0.75; // 75%

    const isShortVideo = (v: Video): boolean => {
        const seconds = parseDuration(v.isoDuration, v.duration);
        return (seconds > 0 && seconds <= 60) || v.title.toLowerCase().includes('#shorts');
    };

    const historyIds = new Set((shortsHistory || []).map(v => v.id));
    const hiddenVideoIdsSet = new Set(hiddenVideos.map(v => v.id));
    const ngChannelIds = new Set(ngChannels.map(c => c.id));
    const seenIds = new Set<string>();

    const filterAndDedupe = (videos: Video[]): Video[] => {
        return videos.filter(v => {
            if (historyIds.has(v.id) || hiddenVideoIdsSet.has(v.id) || seenIds.has(v.id)) return false;
            
            const fullText = `${v.title} ${v.channelName}`.toLowerCase();
            if (ngKeywords.some(ng => fullText.includes(ng.toLowerCase()))) return false;
            if (ngChannelIds.has(v.channelId)) return false;

            const vKeywords = [...extractKeywords(v.title), ...extractKeywords(v.channelName)];
            let negativeScore = 0;
            vKeywords.forEach(k => {
                if (negativeKeywords.has(k)) negativeScore += (negativeKeywords.get(k) || 0);
            });
            if (negativeScore > 2) return false;

            seenIds.add(v.id);
            return true;
        });
    };

    const popularPromise = getRecommendedVideos().then(res => res.videos.filter(isShortVideo)).catch(() => []);
    
    let personalizedSeeds: string[] = [];
    if (shortsHistory && shortsHistory.length > 0) {
        personalizedSeeds = shuffleArray(shortsHistory).slice(0, 4).map(v => `${cleanTitleForSearch(v.title)} #shorts`);
    } else if (watchHistory.length > 0) {
        personalizedSeeds = shuffleArray(watchHistory).slice(0, 4).map(v => `${cleanTitleForSearch(v.title)} #shorts`);
    } else {
        personalizedSeeds = ["Funny #shorts", "Gaming #shorts"];
    }

    const personalizedPromises = personalizedSeeds.map(query => 
        searchVideos(query, '1').then(res => [...res.videos, ...res.shorts].filter(isShortVideo)).catch(() => [])
    );
    
    const [popularShortsRaw, personalizedShortsNested] = await Promise.all([
        popularPromise,
        Promise.all(personalizedPromises)
    ]);
    const personalizedShortsRaw = personalizedShortsNested.flat();

    const cleanPopular = filterAndDedupe(popularShortsRaw);
    const cleanPersonalized = filterAndDedupe(personalizedShortsRaw);
    
    const numPopular = Math.floor(TARGET_COUNT * POPULAR_RATIO);
    const numPersonalized = TARGET_COUNT - numPopular;

    const finalPopular = shuffleArray(cleanPopular).slice(0, numPopular);
    const finalPersonalized = shuffleArray(cleanPersonalized).slice(0, numPersonalized);

    const finalFeed = [...finalPopular, ...finalPersonalized];

    if (finalFeed.length === 0) {
        return shuffleArray(popularShortsRaw.filter(v => !historyIds.has(v.id))).slice(0, 20);
    }

    return shuffleArray(finalFeed);
};