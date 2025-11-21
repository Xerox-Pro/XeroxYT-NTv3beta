
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import VideoGrid from '../components/VideoGrid';
import ShortsShelf from '../components/ShortsShelf';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSearchHistory } from '../contexts/SearchHistoryContext';
import { useHistory } from '../contexts/HistoryContext';
import { usePreference } from '../contexts/PreferenceContext';
import { useAi } from '../contexts/AiContext';
import { getXraiRecommendations, getLegacyRecommendations } from '../utils/recommendation';
import { buildUserProfile, inferTopInterests } from '../utils/xrai';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import type { Video } from '../types';
import { SearchIcon, SaveIcon, DownloadIcon } from '../components/icons/Icons';
import { searchVideos } from '../utils/api';

// Helper to parse duration string to seconds
const parseDuration = (iso: string, text: string): number => {
    if (iso) {
        const matches = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (matches) {
            const h = parseInt(matches[1] || '0', 10);
            const m = parseInt(matches[2] || '0', 10);
            const s = parseInt(matches[3] || '0', 10);
            return h * 3600 + m * 60 + s;
        }
    }
    if (text) {
         const parts = text.split(':').map(p => parseInt(p, 10));
         if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
         if (parts.length === 2) return parts[0] * 60 + parts[1];
         if (parts.length === 1) return parts[0];
    }
    return 0;
}

const MAX_FEED_VIDEOS = 500;

const HomePage: React.FC = () => {
    const [feed, setFeed] = useState<Video[]>([]);
    const [shortsFeed, setShortsFeed] = useState<Video[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [hasNextPage, setHasNextPage] = useState(true);
    
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiMode, setAiMode] = useState(false);

    const seenIdsRef = useRef<Set<string>>(new Set());
    const isAiAugmentedRef = useRef(false);
    
    // Ref to track feed length without triggering re-renders/dependency changes
    const feedLengthRef = useRef(0);

    const { subscribedChannels } = useSubscription();
    const { searchHistory } = useSearchHistory();
    const { history: watchHistory } = useHistory();
    const { preferredGenres, preferredChannels, ngKeywords, ngChannels, exportUserData, importUserData, useXrai } = usePreference();
    const { getAiRecommendations, initializeEngine, isLoaded, isLoading: isAiLoading, discoveryVideoCache } = useAi();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Update feed length ref whenever feed changes
    useEffect(() => {
        feedLengthRef.current = feed.length;
    }, [feed.length]);

    // Automatically initialize AI engine in background for standard recommendations
    useEffect(() => {
        if (!isLoaded && !isAiLoading) {
            initializeEngine().catch(e => console.warn("Background AI init failed", e));
        }
    }, [isLoaded, isAiLoading, initializeEngine]);

    const isNewUser = useMemo(() => {
        const hasSubscriptions = subscribedChannels.length > 1;
        const hasSearchHistory = searchHistory.length > 0;
        const hasWatchHistory = watchHistory.length > 0;
        const hasPreferences = preferredGenres.length > 0;
        return !(hasSubscriptions || hasSearchHistory || hasWatchHistory || hasPreferences);
    }, [subscribedChannels, searchHistory, watchHistory, preferredGenres]);

    // Logic to inject AI Discovery videos into the standard feed
    const augmentFeedWithAi = useCallback(async () => {
        if (isAiAugmentedRef.current || aiMode || feedLengthRef.current === 0) return;
        
        isAiAugmentedRef.current = true;

        try {
            let aiVideos: Video[] = [];

            // Use cached videos if available (Prevents flickering on reload/nav)
            if (discoveryVideoCache.current.length > 0) {
                aiVideos = discoveryVideoCache.current;
            } else {
                let queries: string[] = [];

                if (isLoaded) {
                    // AI Strategy: Generate queries based on user profile
                    queries = await getAiRecommendations();
                } else {
                    // Fallback Strategy: Heuristic "Thinking"
                    const profile = buildUserProfile({
                        watchHistory,
                        searchHistory: searchHistory.slice(0, 5),
                        subscribedChannels: subscribedChannels.slice(0, 5)
                    });
                    
                    const interests = inferTopInterests(profile, 6);
                    
                    if (interests.length >= 2) {
                        const queryMix = `${interests[0]} OR ${interests[1]}`;
                        queries.push(queryMix);
                        const topInterest = interests[0];
                        queries.push(`${topInterest} おすすめ related`);
                        queries.push(`${topInterest} new trending`);
                    } else if (interests.length === 1) {
                        queries.push(`${interests[0]} similar related`);
                        queries.push(`${interests[0]} mix`);
                    } else if (watchHistory.length > 0) {
                        const recent = watchHistory[0];
                        queries.push(`${recent.channelName} related`);
                    }
                }

                if (queries.length > 0) {
                    const query = queries[Math.floor(Math.random() * queries.length)];
                    console.log(`[Discovery] Searching for: ${query}`);
                    
                    const searchRes = await searchVideos(query, '1');
                    aiVideos = searchRes.videos.slice(0, 10).map(v => ({...v, isAiRecommended: true}));
                    aiVideos = aiVideos.sort(() => Math.random() - 0.5);
                    discoveryVideoCache.current = aiVideos;
                }
            }

            if (aiVideos.length > 0) {
                setFeed(currentFeed => {
                    if (currentFeed.some(v => v.isAiRecommended)) return currentFeed;
                    const existingIds = new Set(currentFeed.map(v => v.id));
                    const newAiVideos = aiVideos.filter(v => !existingIds.has(v.id));
                    const videosToAppend = newAiVideos.slice(0, Math.ceil(currentFeed.length / 5));
                    if (videosToAppend.length > 0) {
                        return [...currentFeed, ...videosToAppend];
                    }
                    return currentFeed;
                });
            }
        } catch (e) {
            console.warn("AI augmentation background task failed", e);
        }
    }, [getAiRecommendations, aiMode, discoveryVideoCache, isLoaded, watchHistory, searchHistory, subscribedChannels]);

    // Trigger AI Augmentation (or Fallback) when feed is ready
    useEffect(() => {
        if (!isNewUser && !aiMode && feed.length > 0) {
            augmentFeedWithAi();
        }
    }, [isNewUser, aiMode, feed.length, augmentFeedWithAi]);


    const loadRecommendations = useCallback(async (pageNum: number) => {
        if (aiMode) return;
        
        // Stop loading if we hit the limit (Using Ref to prevent dependency loop)
        if (feedLengthRef.current >= MAX_FEED_VIDEOS) {
            setHasNextPage(false);
            setIsFetchingMore(false);
            return;
        }

        const isInitial = pageNum === 1;
        if (isInitial) {
            setIsLoading(true);
            isAiAugmentedRef.current = false; // Reset AI augmentation flag on refresh
            discoveryVideoCache.current = []; // Clear cache on hard refresh
        } else {
            setIsFetchingMore(true);
        }
        
        try {
            // 1. Base Recommendations (Heuristic / XRAI)
            let rawVideos: Video[];
            if (useXrai) {
                rawVideos = await getXraiRecommendations({
                    searchHistory, watchHistory, subscribedChannels,
                    preferredGenres, preferredChannels, ngKeywords, ngChannels,
                    page: pageNum
                });
                setHasNextPage(feedLengthRef.current < MAX_FEED_VIDEOS); 
            } else {
                if (pageNum > 1) {
                    setIsFetchingMore(false);
                    setHasNextPage(false);
                    return;
                }
                rawVideos = await getLegacyRecommendations();
                setHasNextPage(false);
            }

            const newVideos: Video[] = [];
            const newShorts: Video[] = [];

            for (const v of rawVideos) {
                if (seenIdsRef.current.has(v.id)) continue;
                seenIdsRef.current.add(v.id);

                const seconds = parseDuration(v.isoDuration, v.duration);
                const isShort = (seconds > 0 && seconds <= 60) || v.title.toLowerCase().includes('#shorts');

                if (isShort) {
                    newShorts.push(v);
                } else {
                    newVideos.push(v);
                }
            }

            if (isInitial) {
                setFeed(newVideos);
                setShortsFeed(newShorts);
            } else {
                setFeed(prev => {
                    const combined = [...prev, ...newVideos];
                    if (combined.length >= MAX_FEED_VIDEOS) {
                         setHasNextPage(false);
                         return combined.slice(0, MAX_FEED_VIDEOS);
                    }
                    return combined;
                });
                setShortsFeed(prev => [...prev, ...newShorts]);
            }

        } catch (err: any) {
            if (isInitial) {
                setError(err.message || '動画の読み込みに失敗しました。');
            }
            console.error(err);
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, [subscribedChannels, searchHistory, watchHistory, preferredGenres, preferredChannels, ngKeywords, ngChannels, useXrai, aiMode]); // Removed feed.length dependency

    useEffect(() => {
        if (!aiMode) {
            setPage(1);
            setFeed([]);
            setShortsFeed([]);
            seenIdsRef.current.clear();
            setError(null);
            setHasNextPage(true);
            feedLengthRef.current = 0;
            
            loadRecommendations(1);
        }
    }, [loadRecommendations, aiMode]);
    
    const triggerAiCurator = async () => {
        setAiMode(true);
        setIsAiGenerating(true);
        setIsLoading(true);
        setFeed([]);
        setShortsFeed([]);
        seenIdsRef.current.clear();

        try {
            const queries = await getAiRecommendations();
            console.log("AI Generated Queries:", queries);
            
            const searchPromises = queries.map(q => searchVideos(q, '1').then(res => res.videos));
            const results = await Promise.all(searchPromises);
            const merged = results.flat();
            
            const unique = Array.from(new Map(merged.map(v => [v.id, v])).values());
            const shuffled = unique.sort(() => Math.random() - 0.5);
            
            setFeed(shuffled);
            setHasNextPage(false);

        } catch (e) {
            console.error(e);
            setError("AIおすすめの生成に失敗しました");
            setAiMode(false);
        } finally {
            setIsAiGenerating(false);
            setIsLoading(false);
        }
    }

    const loadMore = () => {
        if (!isFetchingMore && !isLoading && hasNextPage && !aiMode && feedLengthRef.current < MAX_FEED_VIDEOS) {
            const nextPage = page + 1;
            setPage(nextPage);
            loadRecommendations(nextPage);
        }
    };

    const lastElementRef = useInfiniteScroll(loadMore, hasNextPage, isFetchingMore || isLoading);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await importUserData(file);
        }
    };

    if (isNewUser && feed.length === 0 && !isLoading && !aiMode) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in">
                <div className="bg-yt-light dark:bg-yt-spec-10 p-6 rounded-full mb-6">
                    <SearchIcon />
                </div>
                <h2 className="text-2xl font-bold mb-4 text-black dark:text-white">まずは動画を探してみましょう</h2>
                <p className="text-yt-light-gray text-base max-w-lg mb-8 leading-relaxed">
                    検索してチャンネル登録したり、動画を閲覧すると、<br />
                    ここにあなたへのおすすめ動画が表示されるようになります。<br />
                    <br />
                    上の検索バーから、好きなキーワードで検索してみてください！
                </p>
                <div className="flex gap-4">
                    <button 
                        onClick={exportUserData}
                        className="flex items-center gap-2 px-4 py-2 bg-yt-light dark:bg-yt-spec-10 rounded-lg hover:bg-gray-200 dark:hover:bg-yt-spec-20 transition-colors text-sm font-medium"
                    >
                        <DownloadIcon />
                        設定をエクスポート
                    </button>
                    <button 
                        onClick={handleImportClick}
                        className="flex items-center gap-2 px-4 py-2 bg-yt-light dark:bg-yt-spec-10 rounded-lg hover:bg-gray-200 dark:hover:bg-yt-spec-20 transition-colors text-sm font-medium"
                    >
                        <SaveIcon />
                        データを復元
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".json" 
                        onChange={handleFileChange} 
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="pb-10">
             <div className="sticky top-14 bg-yt-white/95 dark:bg-yt-black/95 backdrop-blur-md z-20 pb-2 pt-2 mb-4 -mx-4 px-4 border-b border-yt-spec-light-10 dark:border-yt-spec-10">
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                     <button 
                        onClick={() => setAiMode(false)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${!aiMode ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-yt-light dark:bg-yt-spec-10 hover:bg-gray-200 dark:hover:bg-yt-spec-20'}`}
                     >
                        すべて
                     </button>
                     <button 
                        onClick={triggerAiCurator}
                        disabled={isAiGenerating}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${aiMode ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg' : 'bg-yt-light dark:bg-yt-spec-10 hover:bg-gray-200 dark:hover:bg-yt-spec-20'}`}
                     >
                        {isAiGenerating ? <div className="animate-spin h-3 w-3 border-2 border-white rounded-full border-t-transparent"/> : '✨'}
                        AIキュレーター
                     </button>
                     {preferredGenres.map(g => (
                         <button key={g} className="px-3 py-1.5 bg-yt-light dark:bg-yt-spec-10 rounded-lg text-sm font-medium whitespace-nowrap hover:bg-gray-200 dark:hover:bg-yt-spec-20">
                             {g}
                         </button>
                     ))}
                </div>
            </div>

            {error && <div className="text-red-500 text-center mb-4">{error}</div>}
            
            {aiMode && !isLoading && feed.length > 0 && (
                 <div className="mb-8 px-4 mt-8 pt-4 bg-yt-light/30 dark:bg-white/5 rounded-xl border border-yt-spec-light-10 dark:border-yt-spec-10 backdrop-blur-sm">
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">
                        AIキュレーターの選定
                    </h2>
                    <p className="text-sm text-yt-light-gray mt-1 pb-2">
                        ローカルLLMがあなたの興味に基づいて生成したプレイリストです。
                    </p>
                </div>
            )}
            
            {(shortsFeed.length > 0 || (isLoading && !aiMode)) && !aiMode && (
                <div className="mb-8">
                    <ShortsShelf shorts={shortsFeed} isLoading={isLoading && shortsFeed.length === 0} />
                    <hr className="border-yt-spec-light-20 dark:border-yt-spec-20 mt-6" />
                </div>
            )}

            <VideoGrid videos={feed} isLoading={isLoading && feed.length === 0} />

            {isFetchingMore && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-8 mt-8">
                    {Array.from({ length: 10 }).map((_, index) => (
                         <div key={index} className="flex flex-col animate-pulse">
                            <div className="w-full aspect-video bg-yt-light dark:bg-yt-dark-gray rounded-xl mb-3"></div>
                            <div className="flex gap-3">
                                <div className="w-9 h-9 rounded-full bg-yt-light dark:bg-yt-dark-gray"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-yt-light dark:bg-yt-dark-gray rounded w-3/4"></div>
                                    <div className="h-4 bg-yt-light dark:bg-yt-dark-gray rounded w-1/2"></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!isLoading && hasNextPage && !aiMode && (
                <div ref={lastElementRef} className="h-20 flex justify-center items-center">
                     {feed.length >= MAX_FEED_VIDEOS && (
                        <p className="text-yt-light-gray text-sm">これ以上の動画は表示されません（上限500件）</p>
                     )}
                </div>
            )}
        </div>
    );
};

export default HomePage;
