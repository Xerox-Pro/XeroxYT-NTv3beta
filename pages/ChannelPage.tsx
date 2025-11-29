
import React, { useState, useEffect, useCallback } from 'react';
// FIX: Use named imports for react-router-dom components and hooks.
import { useParams, Link } from 'react-router-dom';
import { getChannelDetails, getChannelVideos, getChannelHome, mapHomeVideoToVideo, getChannelShorts, getPlayerConfig } from '../utils/api';
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
        const fetchPlayerParams = async () => {
            setPlayerParams(await getPlayerConfig());
        };
        fetchPlayerParams();
    }, []);

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
            
            try {
                const details = await getChannelDetails(channelId);
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
                    <div className="border-b border-yt-spec-light-20 dark:border-yt-spec-20 pb-8 mb-8">
                        <div className="flex flex-col lg:flex-row gap-6">
                            {/* Player on the left */}
                            <div className="lg:w-1/2 xl:w-[48%] flex-shrink-0">
                                <div className="aspect-video rounded-2xl overflow-hidden bg-yt-dark-gray shadow-lg">
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
                                        <div className="w-full h-full bg-yt-dark-gray animate-pulse"></div>
                                    )}
                                </div>
                            </div>
                            {/* Details on the right */}
                            <div className="flex flex-col justify-center">
                                <Link to={`/watch/${homeData.topVideo.videoId}`} className="block mb-2">
                                    <h2 className="text-xl font-bold text-black dark:text-white line-clamp-2 hover:opacity-80 transition-opacity">
                                        {homeData.topVideo.title}
                                    </h2>
                                </Link>
                                <div className="text-sm text-yt-light-gray mb-4 space-y-1.5">
                                    {homeData.topVideo.viewCount && <p>再生回数: {homeData.topVideo.viewCount}</p>}
                                    {homeData.topVideo.published && <p>投稿日: {homeData.topVideo.published}</p>}
                                </div>
                                {homeData.topVideo.description && (
                                    <p className="text-sm text-yt-light-gray line-clamp-4">
                                        {homeData.topVideo.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {homeData.playlists.map((playlist) => {
                    const videos = playlist.items.map(item => mapHomeVideoToVideo(item, channelDetails));
                    return (
                        <div key={playlist.playlistId}>
                            <h3 className="text-xl font-bold mb-4">{playlist.title}</h3>
                            <HorizontalScrollContainer>
                                {videos.map(video => (
                                    <div key={video.id} className="w-64 flex-shrink-0">
                                        <VideoCard video={video} hideChannelInfo={true} />
                                    </div>
                                ))}
                            </HorizontalScrollContainer>
                        </div>
                    )
                })}
            </div>
        );
    };

    const renderVideosTab = () => {
         if (isTabLoading && videos.length === 0) return <div className="text-center p-8">読み込み中...</div>;
         return (
             <div className="pb-10">
                 <VideoGrid videos={videos} isLoading={false} hideChannelInfo={true} />
                 {isFetchingMore && <div className="text-center p-4">さらに読み込み中...</div>}
                 <div ref={lastElementRef} className="h-10" />
             </div>
         );
    }
    
    const renderShortsTab = () => {
         if (isTabLoading && shorts.length === 0) return <div className="text-center p-8">読み込み中...</div>;
         if (shorts.length === 0) return <div className="text-center p-8 text-yt-light-gray">ショート動画はありません。</div>;
         
         return (
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-4 gap-y-8 pb-10">
                {shorts.map(short => (
                    <ShortsCard key={short.id} video={short} context={{ type: 'channel', channelId: channelId }}/>
                ))}
             </div>
         );
    };

    return (
        <div>
            {channelDetails.bannerUrl && (
                <div className="w-full h-32 md:h-48 lg:h-56 bg-center bg-cover rounded-b-xl shadow-inner" style={{ backgroundImage: `url(${channelDetails.bannerUrl})` }}></div>
            )}
            <div className="max-w-[1300px] mx-auto px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-12 sm:-mt-16 relative z-10">
                    <img src={channelDetails.avatarUrl} alt={channelDetails.name} className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-yt-white dark:border-yt-black object-cover bg-yt-light dark:bg-yt-dark-gray"/>
                    <div className="flex flex-col items-center sm:items-start flex-1 py-4">
                        <h1 className="text-2xl sm:text-3xl font-bold">{channelDetails.name}</h1>
                        <div className="flex items-center space-x-3 text-sm text-yt-light-gray mt-1">
                            {channelDetails.handle && <span>{channelDetails.handle}</span>}
                            <span>チャンネル登録者数 {channelDetails.subscriberCount}</span>
                            <span>{channelDetails.videoCount}本の動画</span>
                        </div>
                        <p className="text-sm text-yt-light-gray mt-2 line-clamp-2 text-center sm:text-left">
                            {channelDetails.description}
                        </p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2 pb-2">
                        <button 
                            onClick={handleSubscriptionToggle}
                            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${subscribed ? 'bg-yt-light dark:bg-yt-dark-gray hover:bg-gray-200 dark:hover:bg-gray-700' : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90'}`}
                        >
                            {subscribed ? '登録済み' : 'チャンネル登録'}
                        </button>
                        <button
                            onClick={handleBlockToggle}
                            className={`p-2 rounded-full transition-colors ${blocked ? 'bg-red-500 text-white' : 'bg-yt-light dark:bg-yt-dark-gray hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                            title={blocked ? 'チャンネルのブロックを解除' : 'チャンネルをブロック'}
                        >
                            <BlockIcon />
                        </button>
                    </div>
                </div>

                <div className="mt-4 border-b border-yt-spec-light-20 dark:border-yt-spec-20">
                    <div className="flex items-center -mb-px overflow-x-auto no-scrollbar">
                        <TabButton tab="home" label="ホーム" />
                        <TabButton tab="videos" label="動画" />
                        <TabButton tab="shorts" label="ショート" />
                    </div>
                </div>
                
                <div className="mt-6">
                    {activeTab === 'home' && renderHomeTab()}
                    {activeTab === 'videos' && renderVideosTab()}
                    {activeTab === 'shorts' && renderShortsTab()}
                </div>
            </div>
        </div>
    );
};

export default ChannelPage;