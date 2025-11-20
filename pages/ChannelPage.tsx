import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getChannelDetails, getChannelVideos, getChannelHome, mapHomeVideoToVideo } from '../utils/api';
import type { ChannelDetails, Video, Channel, ChannelHomeData, HomePlaylist } from '../types';
import VideoGrid from '../components/VideoGrid';
import VideoCard from '../components/VideoCard';
import VideoCardSkeleton from '../components/icons/VideoCardSkeleton';
import { useSubscription } from '../contexts/SubscriptionContext';
import HorizontalScrollContainer from '../components/HorizontalScrollContainer';

type Tab = 'home' | 'videos';

const useInfiniteScroll = (callback: () => void, hasMore: boolean) => {
    const observer = useRef<IntersectionObserver | null>(null);
    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                callback();
            }
        });
        if (node) observer.current.observe(node);
    }, [callback, hasMore]);
    return lastElementRef;
};

const ChannelPage: React.FC = () => {
    const { channelId } = useParams<{ channelId: string }>();
    const [channelDetails, setChannelDetails] = useState<ChannelDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('home');

    const [homeData, setHomeData] = useState<ChannelHomeData | null>(null);
    const [videos, setVideos] = useState<Video[]>([]);
    
    const [videosPageToken, setVideosPageToken] = useState<string | undefined>('1');
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [isTabLoading, setIsTabLoading] = useState(false);
    
    const { isSubscribed, subscribe, unsubscribe } = useSubscription();

    useEffect(() => {
        const loadInitialDetails = async () => {
            if (!channelId) return;
            setIsLoading(true);
            setError(null);
            setVideos([]);
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
            }
        } catch (err) {
            console.error(`Failed to load ${tab}`, err);
            if(tab === 'home') {
                // Don't show critical error for home tab failure, just show empty or log it
                console.warn("Home tab fetch failed, staying empty.");
            } else {
                setError(`[${tab}] タブの読み込みに失敗しました。`);
            }
        } finally {
            setIsTabLoading(false);
            setIsFetchingMore(false);
        }
    }, [channelId, isFetchingMore, homeData, channelDetails]);
    
    useEffect(() => {
        if (channelId && !isLoading) {
            if (activeTab === 'home' && !homeData) {
                fetchTabData('home');
            } else if (activeTab === 'videos' && videos.length === 0) {
                fetchTabData('videos', '1');
            }
        }
    }, [activeTab, channelId, isLoading, fetchTabData, videos.length, homeData]);

    const handleLoadMore = useCallback(() => {
        if (activeTab === 'videos' && videosPageToken && !isFetchingMore) {
            fetchTabData('videos', videosPageToken);
        }
    }, [activeTab, videosPageToken, isFetchingMore, fetchTabData]);

    const lastElementRef = useInfiniteScroll(handleLoadMore, !!videosPageToken);

    if (isLoading) return <div className="text-center p-8">チャンネル情報を読み込み中...</div>;
    if (error && !channelDetails) return <div className="text-center text-red-500 bg-red-100 dark:bg-red-900/50 p-4 rounded-lg">{error}</div>;
    if (!channelDetails) return null;

    const subscribed = isSubscribed(channelDetails.id);
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

    const TabButton: React.FC<{tab: Tab, label: string}> = ({tab, label}) => (
        <button 
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-semibold text-base border-b-2 transition-colors ${activeTab === tab ? 'border-black dark:border-white text-black dark:text-white' : 'border-transparent text-yt-light-gray hover:text-black dark:hover:text-white'}`}
        >
            {label}
        </button>
    );

    const renderHomeTab = () => {
        if (!homeData) {
             // If user disabled proxy or loading failed gracefully
             return <div className="p-8 text-center text-yt-light-gray">ホームコンテンツを表示できません。Proxy設定を確認してください。</div>;
        }
        
        return (
            <div className="flex flex-col gap-10 pb-10">
                {/* Featured Video */}
                {homeData.topVideo && (
                    <div className="flex flex-col md:flex-row gap-6 border-b border-yt-spec-light-20 dark:border-yt-spec-20 pb-8">
                        <div className="w-full md:w-[420px] flex-shrink-0">
                             <Link to={`/watch/${homeData.topVideo.videoId}`}>
                                <div className="aspect-video rounded-xl overflow-hidden bg-yt-dark-gray relative group">
                                    <img 
                                        src={`https://i.ytimg.com/vi/${homeData.topVideo.videoId}/hqdefault.jpg`} 
                                        alt={homeData.topVideo.title} 
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute bottom-1 right-1 bg-black bg-opacity-80 text-white text-xs px-1.5 py-0.5 rounded-md">
                                        {homeData.topVideo.duration}
                                    </div>
                                </div>
                             </Link>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-medium mb-2">
                                <Link to={`/watch/${homeData.topVideo.videoId}`} className="hover:text-black dark:hover:text-white text-black dark:text-white line-clamp-2">
                                    {homeData.topVideo.title}
                                </Link>
                            </h2>
                             <div className="text-sm text-yt-light-gray mb-2">
                                <span>{homeData.topVideo.viewCount}</span>
                                <span className="mx-1">•</span>
                                <span>{homeData.topVideo.published}</span>
                            </div>
                            {homeData.topVideo.description && (
                                <div className="text-sm text-yt-light-gray line-clamp-4 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: homeData.topVideo.description }} />
                            )}
                        </div>
                    </div>
                )}

                {/* Playlists Shelves (Horizontal Scrolling) */}
                {homeData.playlists.map((playlist: HomePlaylist, index) => (
                    <div key={index} className="flex flex-col gap-4">
                        <h3 className="text-xl font-bold flex items-center px-2">
                            {playlist.playlistId ? (
                                <Link to={`/playlist/${playlist.playlistId}`} className="hover:text-yt-light-gray transition-colors">
                                    {playlist.title}
                                </Link>
                            ) : (
                                <span>{playlist.title}</span>
                            )}
                        </h3>
                        
                        <HorizontalScrollContainer>
                             {playlist.items.map(item => {
                                // Check if the item is a channel based on ID format (UC...)
                                if (item.videoId.startsWith('UC')) {
                                    const iconUrl = item.icon?.startsWith('//') ? `https:${item.icon}` : item.icon;
                                    return (
                                        <Link key={item.videoId} to={`/channel/${item.videoId}`} className="flex-shrink-0 w-32 sm:w-40 flex flex-col items-center justify-start group p-2 snap-start">
                                            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden mb-3 bg-yt-light-gray/20 border border-yt-spec-light-10 dark:border-yt-spec-20">
                                                {iconUrl ? (
                                                    <img src={iconUrl} alt={item.title} className="w-full h-full object-cover" />
                                                ) : (
                                                     <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-yt-light-gray">
                                                        {item.title.charAt(0)}
                                                     </div>
                                                )}
                                            </div>
                                            <h3 className="text-sm sm:text-base font-bold text-center line-clamp-2 text-black dark:text-white group-hover:text-yt-light-gray transition-colors">
                                                {item.title}
                                            </h3>
                                            <p className="text-xs text-yt-light-gray text-center mt-1 line-clamp-1">
                                                {item.viewCount}
                                            </p>
                                            <div className="mt-3 px-4 py-1.5 bg-yt-light dark:bg-yt-spec-10 text-black dark:text-white text-xs font-semibold rounded-full hover:bg-yt-spec-20 transition-colors">
                                                チャンネル登録
                                            </div>
                                        </Link>
                                    );
                                }

                                // Standard Video Card
                                return (
                                    <div key={item.videoId} className="flex-shrink-0 w-[260px] snap-start">
                                        <VideoCard 
                                            video={mapHomeVideoToVideo(item, channelDetails)} 
                                            hideChannelInfo={true} 
                                        />
                                    </div>
                                 );
                             })}
                        </HorizontalScrollContainer>

                        {index < homeData.playlists.length - 1 && <hr className="border-yt-spec-light-20 dark:border-yt-spec-20 mt-2 mx-2" />}
                    </div>
                ))}
                
                {homeData.playlists.length === 0 && !homeData.topVideo && (
                    <div className="text-center py-10 text-yt-light-gray">
                        ホームコンテンツがありません。
                    </div>
                )}
            </div>
        );
    };

    const renderTabContent = () => {
        const isInitialTabLoading = isTabLoading && (
            (activeTab === 'videos' && videos.length === 0) ||
            (activeTab === 'home' && !homeData)
        );

        if (isInitialTabLoading) {
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8 mt-8">
                    {Array.from({ length: 10 }).map((_, index) => <VideoCardSkeleton key={index} />)}
                </div>
            );
        }

        switch (activeTab) {
            case 'home':
                return renderHomeTab();
            case 'videos':
                return videos.length > 0 ? (
                    <>
                        <div className="mt-6">
                             <VideoGrid videos={videos} isLoading={false} hideChannelInfo={true} />
                        </div>
                        <div ref={lastElementRef} className="h-20 flex justify-center items-center">
                            {isFetchingMore && <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yt-blue"></div>}
                        </div>
                    </>
                ) : <div className="text-center p-8 text-yt-light-gray">このチャンネルには動画がありません。</div>;
            default:
                return null;
        }
    };

    // Prioritize homeData banner but fallback to extracted channel details banner.
    // Ensure we check for non-empty strings.
    const displayBanner = (homeData?.banner && homeData.banner.trim() !== "") ? homeData.banner : channelDetails.bannerUrl;
    
    const displayAvatar = homeData?.avatar || channelDetails.avatarUrl;
    const displayName = homeData?.title || channelDetails.name;
    const displayDescription = homeData?.description || channelDetails.description;

    return (
        <div className="max-w-[1284px] mx-auto px-4 sm:px-6 lg:px-8">
            {/* Banner */}
            {displayBanner && (
                <div className="w-full aspect-[6/1] rounded-xl overflow-hidden mb-6 bg-yt-dark-gray">
                    <img src={displayBanner} alt={`${displayName} banner`} className="w-full h-full object-cover" />
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start mb-4">
                {/* Avatar */}
                <div className="mr-6 flex-shrink-0">
                     <img src={displayAvatar} alt={displayName} className="w-24 h-24 sm:w-40 sm:h-40 rounded-full object-cover" />
                </div>
                
                {/* Info & Actions */}
                <div className="flex-1 flex flex-col justify-center pt-2">
                    <h1 className="text-2xl sm:text-4xl font-bold mb-2">{displayName}</h1>
                    
                    <div className="text-sm text-yt-light-gray flex flex-wrap items-center gap-x-2 mb-3">
                        {channelDetails.handle && <span className="font-medium text-black dark:text-white">@{channelDetails.handle}</span>}
                        {channelDetails.subscriberCount && channelDetails.subscriberCount !== '非公開' && (
                            <>
                                <span className="text-xs">•</span>
                                <span>チャンネル登録者数 {channelDetails.subscriberCount}</span>
                            </>
                        )}
                        {channelDetails.videoCount > 0 && (
                            <>
                                <span className="text-xs">•</span>
                                <span>動画 {channelDetails.videoCount.toLocaleString()}本</span>
                            </>
                        )}
                    </div>

                    {displayDescription && (
                        <p className="text-sm text-yt-light-gray mb-4 line-clamp-1 cursor-pointer hover:text-black dark:hover:text-white transition-colors max-w-3xl">
                            {displayDescription.split('\n')[0]}
                             <span className="ml-1 font-semibold text-black dark:text-white">...他</span>
                        </p>
                    )}
                    
                    <div className="mt-1">
                         <button 
                            onClick={handleSubscriptionToggle}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                subscribed 
                                ? 'bg-yt-light dark:bg-[#272727] text-black dark:text-white hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f]' 
                                : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90'
                            }`}
                        >
                            {subscribed ? '登録済み' : 'チャンネル登録'}
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-yt-spec-light-20 dark:border-yt-spec-20 mb-6">
                <nav className="flex space-x-2">
                    <TabButton tab="home" label="ホーム" />
                    <TabButton tab="videos" label="動画" />
                </nav>
            </div>

            {/* Content */}
            <div>
                {renderTabContent()}
            </div>
        </div>
    );
};

export default ChannelPage;