import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getChannelDetails, getChannelVideos, getChannelPlaylists, getPlaylistDetails, getChannelShorts } from '../utils/api';
import type { ChannelDetails, Video, ApiPlaylist, Channel } from '../types';
import VideoGrid from '../components/VideoGrid';
import VideoCardSkeleton from '../components/icons/VideoCardSkeleton';
import ShortsCard from '../components/ShortsCard';
import SearchPlaylistResultCard from '../components/SearchPlaylistResultCard';
import { useSubscription } from '../contexts/SubscriptionContext';
import { usePlaylist } from '../contexts/PlaylistContext';
import { AddToPlaylistIcon } from '../components/icons/Icons';

type Tab = 'videos' | 'shorts' | 'playlists';

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
    const [activeTab, setActiveTab] = useState<Tab>('videos');

    const [videos, setVideos] = useState<Video[]>([]);
    const [shorts, setShorts] = useState<Video[]>([]);
    const [playlists, setPlaylists] = useState<ApiPlaylist[]>([]);
    
    const [videosPageToken, setVideosPageToken] = useState<string | undefined>('1');
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    const [savingPlaylistId, setSavingPlaylistId] = useState<string | null>(null);
    const [isTabLoading, setIsTabLoading] = useState(false);
    
    const { isSubscribed, subscribe, unsubscribe } = useSubscription();
    const { createPlaylist } = usePlaylist();

    useEffect(() => {
        const loadInitialDetails = async () => {
            if (!channelId) return;
            setIsLoading(true);
            setError(null);
            setVideos([]);
            setShorts([]);
            setPlaylists([]);
            setVideosPageToken('1');
            setActiveTab('videos');
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
                            channelId: channelDetails?.id || v.channelId
                        }));
                        setShorts(enrichedShorts);
                    }
                    break;
                case 'playlists':
                    if (playlists.length === 0) {
                        const pData = await getChannelPlaylists(channelId);
                        setPlaylists(pData.playlists);
                    }
                    break;
            }
        } catch (err) {
            console.error(`Failed to load ${tab}`, err);
            setError(`[${tab}] タブの読み込みに失敗しました。`);
        } finally {
            setIsTabLoading(false);
            setIsFetchingMore(false);
        }
    }, [channelId, isFetchingMore, shorts.length, playlists.length, channelDetails]);
    
    useEffect(() => {
        if (channelId && !isLoading) {
            if (activeTab === 'videos' && videos.length === 0) {
                fetchTabData('videos', '1');
            } else if (activeTab !== 'videos') {
                fetchTabData(activeTab);
            }
        }
    }, [activeTab, channelId, isLoading, fetchTabData, videos.length]);

    const handleLoadMore = useCallback(() => {
        if (activeTab === 'videos' && videosPageToken && !isFetchingMore) {
            fetchTabData('videos', videosPageToken);
        }
    }, [activeTab, videosPageToken, isFetchingMore, fetchTabData]);

    const lastElementRef = useInfiniteScroll(handleLoadMore, !!videosPageToken);

    const handleSavePlaylist = async (e: React.MouseEvent, playlist: ApiPlaylist) => {
        e.preventDefault();
        e.stopPropagation();
        if (savingPlaylistId === playlist.id || !playlist.author || !playlist.authorId) return;
        setSavingPlaylistId(playlist.id);
        try {
            const details = await getPlaylistDetails(playlist.id);
            const videoIds = details.videos.map(v => v.id);
            createPlaylist(playlist.title, videoIds, playlist.author, playlist.authorId);
            alert(`プレイリスト「${playlist.title}」をライブラリに保存しました。`);
        } catch (error) {
            console.error("Failed to save playlist:", error);
            alert("プレイリストの保存に失敗しました。");
        } finally {
            setSavingPlaylistId(null);
        }
    };
    
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

    const renderTabContent = () => {
        const isInitialTabLoading = isTabLoading && (
            (activeTab === 'videos' && videos.length === 0) ||
            (activeTab === 'shorts' && shorts.length === 0) ||
            (activeTab === 'playlists' && playlists.length === 0)
        );

        if (isInitialTabLoading) {
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8 mt-8">
                    {Array.from({ length: 10 }).map((_, index) => <VideoCardSkeleton key={index} />)}
                </div>
            );
        }

        switch (activeTab) {
            case 'videos':
                return videos.length > 0 ? (
                    <>
                        <VideoGrid videos={videos} isLoading={false} hideChannelInfo={true} />
                        <div ref={lastElementRef} className="h-20 flex justify-center items-center">
                            {isFetchingMore && <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yt-blue"></div>}
                        </div>
                    </>
                ) : <div className="text-center p-8 text-yt-light-gray">このチャンネルには動画がありません。</div>;
            case 'shorts':
                return shorts.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
                        {shorts.map(video => (
                            <ShortsCard key={video.id} video={video} />
                        ))}
                    </div>
                ) : <div className="text-center p-8 text-yt-light-gray">このチャンネルにはショート動画がありません。</div>;
            case 'playlists':
                return playlists.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {playlists.map(p => (
                            <div key={p.id} className="relative">
                                <SearchPlaylistResultCard playlist={p} />
                                <button 
                                    onClick={(e) => handleSavePlaylist(e, p)} 
                                    disabled={savingPlaylistId === p.id} 
                                    className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white opacity-0 hover:opacity-100 transition-opacity disabled:opacity-50 z-10" 
                                    title="ライブラリに保存"
                                >
                                    <AddToPlaylistIcon />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : <div className="text-center p-8 text-yt-light-gray">このチャンネルには再生リストがありません。</div>;
            default:
                return null;
        }
    };

    return (
        <div className="max-w-[1284px] mx-auto px-4 sm:px-6 lg:px-8">
            {/* Banner */}
            {channelDetails.bannerUrl && (
                <div className="w-full aspect-[6/1] rounded-xl overflow-hidden mb-6">
                    <img src={channelDetails.bannerUrl} alt={`${channelDetails.name} banner`} className="w-full h-full object-cover" />
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start mb-4">
                {/* Avatar */}
                <div className="mr-6 flex-shrink-0">
                     <img src={channelDetails.avatarUrl} alt={channelDetails.name} className="w-24 h-24 sm:w-40 sm:h-40 rounded-full object-cover" />
                </div>
                
                {/* Info & Actions */}
                <div className="flex-1 flex flex-col justify-center pt-2">
                    <h1 className="text-2xl sm:text-4xl font-bold mb-2">{channelDetails.name}</h1>
                    
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

                    {channelDetails.description && (
                        <p className="text-sm text-yt-light-gray mb-4 line-clamp-1 cursor-pointer hover:text-black dark:hover:text-white transition-colors max-w-3xl">
                            {channelDetails.description.split('\n')[0]}
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
                    <TabButton tab="videos" label="動画" />
                    <TabButton tab="shorts" label="ショート" />
                    <TabButton tab="playlists" label="再生リスト" />
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