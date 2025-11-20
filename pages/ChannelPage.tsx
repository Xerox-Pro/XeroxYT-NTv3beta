import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getChannelDetails, getChannelVideos, getChannelPlaylists, getPlaylistDetails, getChannelShorts } from '../utils/api';
import type { ChannelDetails, Video, ApiPlaylist, Channel } from '../types';
import VideoGrid from '../components/VideoGrid';
import VideoCardSkeleton from '../components/icons/VideoCardSkeleton';
import { useSubscription } from '../contexts/SubscriptionContext';
import { usePlaylist } from '../contexts/PlaylistContext';
import { PlaylistIcon, AddToPlaylistIcon } from '../components/icons/Icons';

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
                    // Backfill channel info if missing
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
                         // Backfill channel info if missing
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
        if (channelId && !isLoading) { // Ensure channel details are loaded before fetching tab data
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

    const handleSavePlaylist = async (playlist: ApiPlaylist) => {
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
            className={`px-4 py-2 font-semibold text-sm ${activeTab === tab ? 'border-b-2 border-black dark:border-white' : 'text-yt-light-gray'}`}
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
                ) : <div className="text-center p-8">このチャンネルには動画がありません。</div>;
            case 'shorts':
                return shorts.length > 0 ? <VideoGrid videos={shorts} isLoading={false} hideChannelInfo={true} /> : <div className="text-center p-8">このチャンネルにはショート動画がありません。</div>;
            case 'playlists':
                return playlists.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {playlists.map(p => (
                            <div key={p.id} className="group relative">
                                <Link to={`/playlist/${p.id}`}>
                                    <div className="relative aspect-video bg-yt-dark-gray rounded-lg overflow-hidden">
                                        {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt={p.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-yt-gray" />}
                                        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                                            <div className="text-center text-white"><PlaylistIcon /><p className="font-semibold">{p.videoCount} 本の動画</p></div>
                                        </div>
                                    </div>
                                    <h3 className="font-semibold mt-2">{p.title}</h3>
                                </Link>
                                <button onClick={() => handleSavePlaylist(p)} disabled={savingPlaylistId === p.id} className="absolute top-2 right-2 p-2 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50" title="ライブラリに保存">
                                    <AddToPlaylistIcon />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : <div className="text-center p-8">このチャンネルには再生リストがありません。</div>;
            default:
                return null;
        }
    };

    return (
        <div>
            {channelDetails.bannerUrl && (
                <div className="w-full h-32 md:h-48 lg:h-56 mb-4">
                    <img src={channelDetails.bannerUrl} alt={`${channelDetails.name} banner`} className="w-full h-full object-cover" />
                </div>
            )}
            <div className="flex flex-col sm:flex-row items-center px-4 mb-6">
                <img src={channelDetails.avatarUrl} alt={channelDetails.name} className="w-20 h-20 sm:w-32 sm:h-32 rounded-full mr-0 sm:mr-6 mb-4 sm:mb-0" />
                <div className="flex-1 text-center sm:text-left">
                    <h1 className="text-2xl font-bold">{channelDetails.name}</h1>
                    <div className="text-sm text-yt-light-gray mt-1 flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-x-2">
                        {channelDetails.handle && <span>@{channelDetails.handle}</span>}
                        {channelDetails.subscriberCount && channelDetails.subscriberCount !== '非公開' && <span>チャンネル登録者数 {channelDetails.subscriberCount}</span>}
                        {channelDetails.videoCount > 0 && <span>動画 {channelDetails.videoCount.toLocaleString()}本</span>}
                    </div>
                    {channelDetails.description && (
                        <p className="text-sm text-yt-light-gray mt-2 line-clamp-2">
                            {channelDetails.description.split('\n')[0]}
                        </p>
                    )}
                </div>
                 <button 
                  onClick={handleSubscriptionToggle}
                  className={`mt-4 sm:mt-0 font-semibold px-4 h-10 rounded-full text-sm flex items-center transform transition-transform duration-150 active:scale-95 ${subscribed ? 'bg-yt-light dark:bg-yt-dark-gray text-black dark:text-white' : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90'}`}
                >
                  {subscribed ? '登録済み' : 'チャンネル登録'}
                </button>
            </div>
            
            <div className="border-b border-yt-spec-light-20 dark:border-yt-spec-20">
                <nav className="flex space-x-4">
                    <TabButton tab="videos" label="動画" />
                    <TabButton tab="shorts" label="ショート" />
                    <TabButton tab="playlists" label="再生リスト" />
                </nav>
            </div>

            <div className="mt-6">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default ChannelPage;