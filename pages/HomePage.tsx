
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import VideoGrid from '../components/VideoGrid';
import { getRecommendedVideos } from '../utils/api';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSearchHistory } from '../contexts/SearchHistoryContext';
import { useHistory } from '../contexts/HistoryContext';
import { usePreference } from '../contexts/PreferenceContext';
import { getDeeplyAnalyzedRecommendations } from '../utils/recommendation';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import type { Video } from '../types';
import { SearchIcon } from '../components/icons/Icons';

const HomePage: React.FC = () => {
    const [recommendedVideos, setRecommendedVideos] = useState<Video[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    const { subscribedChannels } = useSubscription();
    const { searchHistory } = useSearchHistory();
    const { history: watchHistory } = useHistory();
    const { preferredGenres, preferredChannels } = usePreference();

    // ユーザーが「新規（データなし）」かどうかを判定
    const isNewUser = useMemo(() => {
        // デフォルトで1つのチャンネル(Xerox)が登録されているため、1より大きい場合を「ユーザーが登録した」とみなす
        const hasSubscriptions = subscribedChannels.length > 1;
        const hasSearchHistory = searchHistory.length > 0;
        const hasWatchHistory = watchHistory.length > 0;
        const hasPreferences = preferredGenres.length > 0 || preferredChannels.length > 0;

        return !(hasSubscriptions || hasSearchHistory || hasWatchHistory || hasPreferences);
    }, [subscribedChannels, searchHistory, watchHistory, preferredGenres, preferredChannels]);

    const loadRecommendations = useCallback(async (pageNum: number) => {
        const isInitial = pageNum === 1;
        if (isInitial) {
            setIsLoading(true);
        } else {
            setIsFetchingMore(true);
        }
        
        try {
            let newVideos: Video[] = [];

            // 深い分析に基づくレコメンデーションを取得
            const analyzedVideos = await getDeeplyAnalyzedRecommendations({
                searchHistory,
                watchHistory,
                subscribedChannels,
                preferredGenres,
                preferredChannels,
                page: pageNum
            });

            newVideos = [...analyzedVideos];

            // フォールバック: 分析結果が少ない場合のみ急上昇を取得（初回のみ）
            if (newVideos.length < 10 && isInitial) {
                try {
                    const { videos: trendingVideos } = await getRecommendedVideos();
                    newVideos = [...newVideos, ...trendingVideos];
                } catch (trendingError) {
                    console.warn("Failed to load trending videos", trendingError);
                }
            }
            
            setRecommendedVideos(prev => {
                const existingIds = new Set(prev.map(v => v.id));
                const uniqueNewVideos = newVideos.filter(v => !existingIds.has(v.id));
                return isInitial ? uniqueNewVideos : [...prev, ...uniqueNewVideos];
            });

        } catch (err: any) {
            if (isInitial) {
                setError(err.message || '動画の読み込みに失敗しました。');
            }
            console.error(err);
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, [subscribedChannels, searchHistory, watchHistory, preferredGenres, preferredChannels]);

    useEffect(() => {
        setPage(1);
        setRecommendedVideos([]);
        setError(null);
        
        // データが何もない新規ユーザーの場合は、APIリクエストを行わずにガイドを表示する
        if (isNewUser) {
            setIsLoading(false);
        } else {
            loadRecommendations(1);
        }
    }, [isNewUser, preferredGenres, preferredChannels]);

    const loadMore = () => {
        if (!isFetchingMore && !isLoading && !isNewUser) {
            const nextPage = page + 1;
            setPage(nextPage);
            loadRecommendations(nextPage);
        }
    };

    const lastElementRef = useInfiniteScroll(loadMore, true, isFetchingMore || isLoading);

    // 新規ユーザー、または動画がない場合のガイド表示
    if ((isNewUser || (recommendedVideos.length === 0 && !isLoading))) {
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
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {error && <div className="text-red-500 text-center mb-4">{error}</div>}
            <VideoGrid videos={recommendedVideos} isLoading={isLoading} />
            
            {!isLoading && recommendedVideos.length > 0 && (
                <div ref={lastElementRef} className="h-20 flex justify-center items-center">
                    {isFetchingMore && <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yt-blue"></div>}
                </div>
            )}
        </div>
    );
};

export default HomePage;
