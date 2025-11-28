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

export interface HomeFeed {
    videos: Video[];
    shorts: Video[];
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

const isShortVideo = (v: Video): boolean => {
    const seconds = parseDuration(v.isoDuration, v.duration);
    return (seconds > 0 && seconds <= 60) || v.title.toLowerCase().includes('#shorts');
};

export const getXraiRecommendations = async (sources: RecommendationSource): Promise<HomeFeed> => {
    const { 
        watchHistory, 
        subscribedChannels,
        ngKeywords,
        ngChannels,
        hiddenVideos,
        negativeKeywords
    } = sources;

    const TARGET_VIDEOS = 50;
    const TRENDING_VIDEO_RATIO = 0.40;
    const TARGET_SHORTS = 20;

    const seenIds = new Set<string>(hiddenVideos.map(v => v.id));
    const ngChannelIds = new Set(ngChannels.map(c => c.id));

    const filterAndDedupe = (videos: Video[]): Video[] => {
        return videos.filter(v => {
            if (seenIds.has(v.id)) return false;
            seenIds.add(v.id);

            const fullText = `${v.title} ${v.channelName}`.toLowerCase();

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

    // 1. Fetch Personalized Seeds
    let personalizedSeeds: string[] = [];
    if (watchHistory.length > 0) {
        const historySample = shuffleArray(watchHistory).slice(0, 5);
        personalizedSeeds = historySample.map(v => `${cleanTitleForSearch(v.title)} related`);
    } else if (subscribedChannels.length > 0) {
        const subSample = shuffleArray(subscribedChannels).slice(0, 3);
        personalizedSeeds = subSample.map(c => `${c.name} videos`);
    } else {
        personalizedSeeds = ["Music", "Gaming", "Vlog"];
    }

    // 2. Fetch Content
    const trendingPromise = getRecommendedVideos().then(res => res.videos).catch(() => []);
    const searchPromises = personalizedSeeds.map(query => 
        searchVideos(query, '1').then(res => ({ videos: res.videos, shorts: res.shorts })).catch(() => ({ videos: [], shorts: [] }))
    );
    
    const [trendingContent, personalizedResults] = await Promise.all([trendingPromise, Promise.all(searchPromises)]);

    const personalizedVideos = personalizedResults.flatMap(r => r.videos);
    const personalizedShorts = personalizedResults.flatMap(r => r.shorts);

    // 3. Separate & Filter Trending Content
    const trendingVideos: Video[] = [];
    const trendingShorts: Video[] = [];
    for (const v of trendingContent) {
        if (isShortVideo(v)) {
            trendingShorts.push(v);
        } else {
            trendingVideos.push(v);
        }
    }

    // 4. Mix Videos
    const cleanTrendingVideos = filterAndDedupe(trendingVideos);
    const cleanPersonalizedVideos = filterAndDedupe(personalizedVideos);
    const numTrending = Math.floor(TARGET_VIDEOS * TRENDING_VIDEO_RATIO);
    const numPersonalized = TARGET_VIDEOS - numTrending;
    
    const finalVideos = shuffleArray([
        ...shuffleArray(cleanTrendingVideos).slice(0, numTrending),
        ...shuffleArray(cleanPersonalizedVideos).slice(0, numPersonalized)
    ]);

    // 5. Mix Shorts
    const finalShorts = shuffleArray([
        ...filterAndDedupe(trendingShorts),
        ...filterAndDedupe(personalizedShorts)
    ]).slice(0, TARGET_SHORTS);

    return { videos: finalVideos, shorts: finalShorts };
};


export const getXraiShorts = async (sources: RecommendationSource & { seenIds?: string[] }): Promise<Video[]> => {
    const { 
        watchHistory, 
        shortsHistory,
        subscribedChannels,
        hiddenVideos,
        ngChannels,
        ngKeywords,
        negativeKeywords,
        seenIds = []
    } = sources;

    const TARGET_COUNT = 40;
    const POPULAR_RATIO = 0.75;

    const allSeenIds = new Set([
        ...(shortsHistory || []).map(v => v.id),
        ...hiddenVideos.map(v => v.id),
        ...seenIds
    ]);
    const ngChannelIds = new Set(ngChannels.map(c => c.id));
    
    const filterAndDedupe = (videos: Video[]): Video[] => {
        return videos.filter(v => {
            if (allSeenIds.has(v.id)) return false;
            
            const fullText = `${v.title} ${v.channelName}`.toLowerCase();
            if (ngKeywords.some(ng => fullText.includes(ng.toLowerCase()))) return false;
            if (ngChannelIds.has(v.channelId)) return false;

            const vKeywords = [...extractKeywords(v.title), ...extractKeywords(v.channelName)];
            let negativeScore = 0;
            vKeywords.forEach(k => {
                if (negativeKeywords.has(k)) negativeScore += (negativeKeywords.get(k) || 0);
            });
            if (negativeScore > 2) return false;

            allSeenIds.add(v.id); // Add to seen set after passing all checks
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

    if (finalFeed.length === 0 && popularShortsRaw.length > 0) {
        return shuffleArray(popularShortsRaw.filter(v => !allSeenIds.has(v.id))).slice(0, 20);
    }

    return shuffleArray(finalFeed);
};
