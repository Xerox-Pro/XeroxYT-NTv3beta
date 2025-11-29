import React, { useState, useEffect, useCallback } from 'react';
// FIX: Use named imports for react-router-dom components and hooks.
import { useParams, Link } from 'react-router-dom';
import { getChannelDetails, getChannelVideos, getChannelHome, mapHomeVideoToVideo, getPlayerConfig, getChannelShorts } from '../utils/api';
import type { ChannelDetails, Video, Channel, ChannelHomeData } from '../types';
import VideoGrid from '../components/VideoGrid';
import VideoCard from '../components/VideoCard';
import ShortsCard from '../components/ShortsCard';
import { useSubscription } from '../contexts/SubscriptionContext';
import { usePreference } from '../contexts/PreferenceContext';
import HorizontalScrollContainer from '../components/HorizontalScrollContainer';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { BlockIcon } from '../components/icons/Icons';

type Tab = 'home' | 'videos' | 'shorts';

const ChannelPage: React.FC = () => {
    const { channelId } = useParams<{ channelId: string }>();
    const [channelDetails, setChannelDetails] = useState<ChannelDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('home');

    const [homeData, setHomeData] = useState<ChannelHomeData | null>(null);
    const [videos, setVideos] = useState<Video[]>([]);
    const [shorts, setShorts] = useState<Video[]>([]);
    
    const [videosPageToken, setVideosPageToken] = useState<string | undefined>('1');
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [isTabLoading, setIsTabLoading] = useState(false);
    const [playerParams, setPlayerParams] = useState<string | null>(null);
    
    const { isSubscribed, subscribe, unsubscribe } = useSubscription();
    const { addNgChannel, removeNgChannel, isNgChannel } = usePreference();

    useEffect(() => {
        const loadInitialDetails = async () => {
            if (!channelId) return;
            setIsLoading(true);
            setError(null);
            setVideos([]);
            setShorts([]);
            setHomeData(null);
            setVideosPageToken('1');
            setActiveTab('home');
            
            const paramsPromise = getPlayerConfig();
            const detailsPromise = getChannelDetails(channelId);
            
            try {
                const [params, details] = await Promise.all([paramsPromise, detailsPromise]);
                setPlayerParams(params);
                setChannelDetails(details);
            } catch (err: any) {
                setError(err.message || 'チャンネルデータの読み込みに失敗しました。');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        loadInitialDetails();
    }, [channelId]);
    
    const fetchTabData = useCallback(async (tab: Tab, pageToken?: string) => {
        if (!channelId || (isFetchingMore && tab === 'videos')) return;
        
        if (pageToken && pageToken !== '1') {
            setIsFetchingMore(true);
        } else {
            setIsTabLoading(true);
        }

        try {
            switch (tab) {
                case 'home':
                    if (!homeData) {
                         const hData = await getChannelHome(channelId);
                         setHomeData(hData);
                    }
                    break;
                case 'videos':
                    const vData = await getChannelVideos(channelId, pageToken);
                    const enrichedVideos = vData.videos.map(v => ({
                        ...v,
                        channelName: channelDetails?.name || v.channelName,
                        channelAvatarUrl: channelDetails?.avatarUrl || v.channelAvatarUrl,
                        channelId: channelDetails?.id || v.channelId
                    }));
                    setVideos(prev => pageToken && pageToken !== '1' ? [...prev, ...enrichedVideos] : enrichedVideos);
                    setVideosPageToken(vData.nextPageToken);
                    break;
                case 'shorts':
                    if (shorts.length === 0) {
                        const sData = await getChannelShorts(channelId);
                        const enrichedShorts = sData.videos.map(v => ({
                            ...v,
                            channelName: channelDetails?.name || v.channelName,
                            channelAvatarUrl: channelDetails?.avatarUrl || v.channelAvatarUrl,
                            channelId: channelDetails?.id || v.channelId,
                        }));
                        setShorts(enrichedShorts);
                    }
                    break;
            }
        } catch (err: any) {
            console.error(`Failed to load ${tab}`, err);
            if(tab === 'home') {
                const useProxy = localStorage.getItem('useChannelHomeProxy') !== 'false';
                if (!useProxy) {
                    if (window.confirm(`外部APIからのデータ取得に失敗しました。\nProxy経由に切り替えて再試行しますか？\n(設定メニューからも変更可能です)`)) {
                        localStorage.setItem('useChannelHomeProxy', 'true');
                        window.location.reload();
                    }
                } else {
                    console.warn("Home tab fetch failed even with proxy.");
                }
            } else {
                setError(`[${tab}] タブの読み込みに失敗しました。`);
            }
        } finally {
            setIsTabLoading(false);
            setIsFetchingMore(false);
        }
    }, [channelId, isFetchingMore, homeData, channelDetails, shorts.length]);
    
    useEffect(() => {
        if (channelId && !isLoading) {
            if (activeTab === 'home' && !homeData) {
                fetchTabData('home');
            } else if (activeTab === 'videos' && videos.length === 0) {
                fetchTabData('videos', '1');
            } else if (activeTab === 'shorts' && shorts.length === 0) {
                fetchTabData('shorts');
            }
        }
    }, [activeTab, channelId, isLoading, fetchTabData, videos.length, homeData, shorts.length]);

    const handleLoadMore = useCallback(() => {
        if (activeTab === 'videos' && videosPageToken && !isFetchingMore) {
            fetchTabData('videos', videosPageToken);
        }
    }, [activeTab, videosPageToken, isFetchingMore, fetchTabData]);

    const lastElementRef = useInfiniteScroll(handleLoadMore, !!videosPageToken, isFetchingMore || isLoading);

    if (isLoading) return <div className="text-center p-8">チャンネル情報を読み込み中...</div>;
    if (error && !channelDetails) return <div className="text-center text-red-500 bg-red-100 dark:bg-red-900/50 p-4 rounded-lg">{error}</div>;
    if (!channelDetails) return null;

    const subscribed = isSubscribed(channelDetails.id);
    const blocked = isNgChannel(channelDetails.id);

    const handleSubscriptionToggle = () => {
        if (!channelDetails.avatarUrl) return;
        const channel: Channel = {
            id: channelDetails.id,
            name: channelDetails.name,
            avatarUrl: channelDetails.avatarUrl,
            subscriberCount: channelDetails.subscriberCount
        };
        if (subscribed) {
            unsubscribe(channel.id);
        } else {
            subscribe(channel);
        }
    };

    const handleBlockToggle = () => {
        if (blocked) {
            if (window.confirm('このチャンネルのブロックを解除しますか？')) {
                removeNgChannel(channelDetails.id);
            }
        } else {
            if (window.confirm('このチャンネルをブロックしますか？\n検索結果やおすすめに表示されなくなります。')) {
                addNgChannel({
                    id: channelDetails.id,
                    name: channelDetails.name,
                    avatarUrl: channelDetails.avatarUrl || ''
                });
                if (subscribed) unsubscribe(channelDetails.id);
            }
        }
    };

    const TabButton: React.FC<{tab: Tab, label: string}> = ({tab, label}) => (
        <button 
            onClick={() => setActiveTab(tab)}
            className={`px-4 sm:px-6 py-3 font-semibold text-sm sm:text-base border-b-2 transition-colors whitespace-nowrap ${activeTab === tab ? 'border-black dark:border-white text-black dark:text-white' : 'border-transparent text-yt-light-gray hover:text-black dark:hover:text-white'}`}
        >
            {label}
        </button>
    );

    const renderHomeTab = () => {
        if (isTabLoading && !homeData) return <div className="text-center p-8">読み込み中...</div>;
        
        if (!homeData) {
             return (
                <div className="text-center p-8 text-yt-light-gray">
                    ホームコンテンツを表示できませんでした。<br/>
                    <button onClick={() => setActiveTab('videos')} className="text-yt-blue hover:underline mt-2">動画タブを見る</button>
                </div>
             );
        }
        
        return (
            <div className="flex flex-col gap-6 pb-10">
                {homeData.topVideo && (
                    <div className="flex flex-col md:flex-row gap-4 md:gap-6 border-b border-yt-spec-light-20 dark:border-yt-spec-20 pb-6">
                         <div className="w-full md:w-[360px] lg:w-[420px] aspect-video rounded-xl overflow-hidden flex-shrink-0 bg-yt-black shadow-lg">
                            {playerParams ? (
                                <iframe 
                                    src={`https://www.youtubeeducation.com/embed/${homeData.topVideo.videoId}${playerParams}`}
                                    title={homeData.topVideo.title}
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    className="w-full h-full"
                                ></iframe>
                            ) : (
                                <Link to={`/watch/${homeData.topVideo.videoId}`}>
                                    <img src={homeData.topVideo.thumbnail} alt={homeData.topVideo.title} className="w-full h-full object-cover" />
                                </Link>
                            )}
                        </div>
                        <div className="flex-1 py-1 md:py-2 min-w-0">
                            <Link to={`/watch/${homeData.topVideo.videoId}`}>
                                <h3 className="text-base md:text-xl font-bold mb-1 md:mb-2 line-clamp-2 leading-snug">{homeData.topVideo.title}</h3>
                            </Link>

                            <div className="flex items-center text-xs md:text-sm text-yt-light-gray font-medium mb-3">
                                <span>{homeData.topVideo.viewCount}</span>
                                <span className="mx-1">•</span>
                                <span>{homeData.topVideo.published}</span>
                            </div>
                            
                            <p className="text-sm text-yt-light-gray line-clamp-2">
                                {homeData.topVideo.description?.replace(/<br\s*\/?>/gi, ' ')}
                            </p>
                        </div>
                    </div>
                )}

                {homeData.playlists
                    .filter(playlist => 
                        playlist.playlistId && 
                        playlist.items && 
                        playlist.items.length > 0 &&
                        !playlist.title.includes('リリース') && 
                        !playlist.title.includes('Releases')
                    )
                    .map((playlist, index) => (
                    <div key={`${playlist.playlistId}-${index}`}>
                        <div className="flex items-center justify-between mb-2 md:mb-4">
                            <h3 className="text-lg md:text-xl font-bold">{playlist.title}</h3>
                        </div>
                        <HorizontalScrollContainer>
                            {playlist.items.map(video => (
                                <div key={video.videoId} className="w-44 md:w-56 flex-shrink-0">
                                    <VideoCard video={mapHomeVideoToVideo(video, channelDetails)} hideChannelInfo />
                                </div>
                            ))}
                        </HorizontalScrollContainer>
                         <hr className="mt-4 md:mt-6 border-yt-spec-light-20 dark:border-yt-spec-20" />
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="max-w-[1750px] mx-auto px-4 sm:px-6">
            {channelDetails.bannerUrl && (
                <div className="w-full aspect-[6/1] md:aspect-[6/1.2] lg:aspect-[6.2/1] rounded-xl overflow-hidden mb-6 shadow-md">
                    <img src={channelDetails.bannerUrl} alt="Channel Banner" className="w-full h-full object-cover" />
                </div>
            )}

            <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 mb-4 md:mb-6">
                <div className="flex-shrink-0">
                    <img src={channelDetails.avatarUrl} alt={channelDetails.name} className="w-20 h-20 md:w-32 md:h-32 rounded-full object-cover border border-yt-spec-light-20 dark:border-yt-spec-20 shadow-lg" />
                </div>
                <div className="flex-1 text-center md:text-left min-w-0">
                    <h1 className="text-2xl md:text-4xl font-bold mb-1 md:mb-2 tracking-tight">{channelDetails.name}</h1>
                    <div className="text-yt-light-gray text-sm md:text-base mb-3 flex flex-wrap justify-center md:justify-start gap-x-2">
                         <span>{channelDetails.handle}</span>
                    </div>
                    <p className="text-yt-light-gray text-sm line-clamp-1 mb-4 max-w-2xl cursor-pointer mx-auto md:mx-0" onClick={() => alert(channelDetails.description)}>
                        {channelDetails.description}
                    </p>
                    <div className="flex items-center justify-center md:justify-start gap-3">
                        <button 
                            onClick={handleSubscriptionToggle} 
                            className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${
                                subscribed 
                                ? 'bg-yt-light dark:bg-[#272727] text-black dark:text-white hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f]' 
                                : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90'
                            }`}
                        >
                            {subscribed ? '登録済み' : 'チャンネル登録'}
                        </button>

                        <button
                            onClick={handleBlockToggle}
                            className={`p-2 rounded-full transition-colors ${blocked ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-white' : 'bg-yt-light dark:bg-[#272727] text-black dark:text-white hover:bg-red-100 hover:text-red-600'}`}
                            title={blocked ? 'ブロック解除' : 'このチャンネルをブロック'}
                        >
                            <BlockIcon />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex border-b border-yt-spec-light-20 dark:border-yt-spec-20 mb-6 overflow-x-auto no-scrollbar">
                <TabButton tab="home" label="ホーム" />
                <TabButton tab="videos" label="動画" />
                <TabButton tab="shorts" label="ショート" />
            </div>

            {activeTab === 'home' && renderHomeTab()}
            
            {activeTab === 'videos' && (
                <div>
                     <VideoGrid videos={videos} isLoading={isTabLoading} hideChannelInfo />
                     {isFetchingMore && <div className="text-center py-4"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yt-blue mx-auto"></div></div>}
                     <div ref={lastElementRef} className="h-10" />
                </div>
            )}
            
            {activeTab === 'shorts' && (
                <div>
                    {isTabLoading && shorts.length === 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
                            {Array.from({ length: 12 }).map((_, index) => (
                                <div key={index} className="w-full aspect-[9/16] rounded-xl bg-yt-light dark:bg-yt-dark-gray animate-pulse"></div>
                            ))}
                        </div>
                    ) : shorts.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
                            {shorts.map(short => (
                                <ShortsCard 
                                    key={short.id} 
                                    video={short} 
                                    context={{ type: 'channel', channelId: channelDetails.id }} 
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-8 text-yt-light-gray">このチャンネルにはショート動画がありません。</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ChannelPage;