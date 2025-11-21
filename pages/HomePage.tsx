
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import VideoGrid from '../components/VideoGrid';
import ShortsShelf from '../components/ShortsShelf';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSearchHistory } from '../contexts/SearchHistoryContext';
import { useHistory } from '../contexts/HistoryContext';
import { usePreference } from '../contexts/PreferenceContext';
import { getXraiRecommendations, getLegacyRecommendations } from '../utils/recommendation';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import type { Video } from '../types';
import { SearchIcon, SaveIcon, DownloadIcon } from '../components/icons/Icons';

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

const HomePage: React.FC = () => {
    const [feed, setFeed] = useState<Video[]>([]);
    const [shortsFeed, setShortsFeed] = useState<Video[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [hasNextPage, setHasNextPage] = useState(true);

    const seenIdsRef = useRef<Set<string>>(new Set());

    const { subscribedChannels } = useSubscription();
    const { searchHistory } = useSearchHistory();
    const { history: watchHistory } = useHistory();
    const { preferredGenres, preferredChannels, ngKeywords, ngChannels, exportUserData, importUserData, useXrai } = usePreference();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isNewUser = useMemo(() => {
        const hasSubscriptions = subscribedChannels.length > 1;
        const hasSearchHistory = searchHistory.length > 0;
        const hasWatchHistory = watchHistory.length > 0;
        const hasPreferences = preferredGenres.length > 0;
        return !(hasSubscriptions || hasSearchHistory || hasWatchHistory || hasPreferences);
    }, [subscribedChannels, searchHistory, watchHistory, preferredGenres]);

    const loadRecommendations = useCallback(async (pageNum: number) => {
        const isInitial = pageNum === 1;
        if (isInitial) {
            setIsLoading(true);
        } else {
            setIsFetchingMore(true);
        }
        
        try {
            let rawVideos: Video[];

            if (useXrai) {
                // Use the advanced XRAI v2 engine
                rawVideos = await getXraiRecommendations({
                    searchHistory, watchHistory, subscribedChannels,
                    preferredGenres, preferredChannels, ngKeywords, ngChannels,
                    page: pageNum
                });
                setHasNextPage(rawVideos.length > 0); // XRAI can potentially generate infinitely
            } else {
                // Use the legacy engine (one-shot, no pagination)
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
                setFeed(prev => [...prev, ...newVideos]);
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
    }, [subscribedChannels, searchHistory, watchHistory, preferredGenres, preferredChannels, ngKeywords, ngChannels, useXrai]);

    useEffect(() => {
        setPage(1);
        setFeed([]);
        setShortsFeed([]);
        seenIdsRef.current.clear();
        setError(null);
        setHasNextPage(true);
        
        loadRecommendations(1);
    }, [loadRecommendations]);

    const loadMore = () => {
        if (!isFetchingMore && !isLoading && hasNextPage) {
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

    if (isNewUser && feed.length === 0 && !isLoading) {
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
            {error && <div className="text-red-500 text-center mb-4">{error}</div>}
            
            {shortsFeed.length > 0 && (
                <div className="mb-8">
                    <ShortsShelf shorts={shortsFeed} isLoading={false} />
                    <hr className="border-yt-spec-light-20 dark:border-yt-spec-20 mt-6" />
                </div>
            )}

            <VideoGrid videos={feed} isLoading={false} />

            {(isLoading || isFetchingMore) && (
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

            {!isLoading && hasNextPage && feed.length > 0 && (
                <div ref={lastElementRef} className="h-20 flex justify-center items-center" />
            )}
        </div>
    );
};

export default HomePage;
