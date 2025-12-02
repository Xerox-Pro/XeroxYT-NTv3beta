import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { getVideoDetails, getPlayerConfig, getComments, getVideosByIds } from '../utils/api';
import type { VideoDetails, Video, Comment } from '../types';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useHistory } from '../contexts/HistoryContext';
import { usePlaylist } from '../contexts/PlaylistContext';
import VideoPlayerPageSkeleton from '../components/skeletons/VideoPlayerPageSkeleton';
import RelatedVideoCard from '../components/RelatedVideoCard';
import PlaylistModal from '../components/PlaylistModal';
import CommentComponent from '../components/Comment';
import PlaylistPanel from '../components/PlaylistPanel';
import { LikeIcon, SaveIcon } from '../components/icons/Icons';

const VideoPlayerPage: React.FC = () => {
    const { videoId } = useParams<{ videoId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const playlistId = searchParams.get('list');

    const [videoDetails, setVideoDetails] = useState<VideoDetails | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
    const [playerParams, setPlayerParams] = useState<string | null>(null);
    const [playlistVideos, setPlaylistVideos] = useState<Video[]>([]);
    
    const [isShuffle, setIsShuffle] = useState(searchParams.get('shuffle') === '1');
    const [isLoop, setIsLoop] = useState(searchParams.get('loop') === '1');

    const { isSubscribed, subscribe, unsubscribe } = useSubscription();
    const { addVideoToHistory } = useHistory();
    const { playlists, reorderVideosInPlaylist } = usePlaylist();

    const currentPlaylist = useMemo(() => {
        if (!playlistId) return null;
        return playlists.find(p => p.id === playlistId) || null;
    }, [playlistId, playlists]);

    useEffect(() => {
        setIsShuffle(searchParams.get('shuffle') === '1');
        setIsLoop(searchParams.get('loop') === '1');
    }, [searchParams]);
    
    useEffect(() => {
        const fetchPlayerParams = async () => {
            setPlayerParams(await getPlayerConfig());
        };
        fetchPlayerParams();
    }, []);

    useEffect(() => {
        const fetchPlaylistVideos = async () => {
            if (currentPlaylist) {
                if (currentPlaylist.videoIds.length > 0) {
                    const fetchedVideos = await getVideosByIds(currentPlaylist.videoIds);
                    const videoMap = new Map(fetchedVideos.map(v => [v.id, v]));
                    const orderedVideos = currentPlaylist.videoIds.map(id => videoMap.get(id)).filter((v): v is Video => !!v);
                    setPlaylistVideos(orderedVideos);
                } else {
                    setPlaylistVideos([]);
                }
            } else {
                 setPlaylistVideos([]);
            }
        };
        fetchPlaylistVideos();
    }, [currentPlaylist]);

    useEffect(() => {
        const fetchVideoData = async () => {
            if (!videoId) return;
            
            setIsLoading(true);
            setError(null);
            setVideoDetails(null);
            setComments([]);
            window.scrollTo(0, 0);

            try {
                const detailsPromise = getVideoDetails(videoId);
                const commentsPromise = getComments(videoId);
                
                const [details, commentsData] = await Promise.all([detailsPromise, commentsPromise]);
                
                setVideoDetails(details);
                setComments(commentsData);
                addVideoToHistory(details);

            } catch (err: any) {
                setError(err.message || '動画の読み込みに失敗しました。');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchVideoData();
    }, [videoId, addVideoToHistory]);

    const shuffledPlaylistVideos = useMemo(() => {
        if (!isShuffle || playlistVideos.length === 0) return playlistVideos;
        const currentIndex = playlistVideos.findIndex(v => v.id === videoId);
        if (currentIndex === -1) return [...playlistVideos].sort(() => Math.random() - 0.5);
        const otherVideos = [...playlistVideos.slice(0, currentIndex), ...playlistVideos.slice(currentIndex + 1)];
        const shuffledOthers = otherVideos.sort(() => Math.random() - 0.5);
        return [playlistVideos[currentIndex], ...shuffledOthers];
    }, [isShuffle, playlistVideos, videoId]);

    const iframeSrc = useMemo(() => {
        if (!videoDetails?.id || !playerParams) return '';
        let src = `https://www.youtubeeducation.com/embed/${videoDetails.id}`;
        let params = playerParams.startsWith('?') ? playerParams.substring(1) : playerParams;
        if (currentPlaylist && playlistVideos.length > 0) {
            const videoIdList = (isShuffle ? shuffledPlaylistVideos : playlistVideos).map(v => v.id);
            const playlistString = videoIdList.join(',');
            params += `&playlist=${playlistString}`;
            if(isLoop) params += `&loop=1`;
        }
        return `${src}?${params}`;
    }, [videoDetails, playerParams, currentPlaylist, playlistVideos, isShuffle, isLoop, shuffledPlaylistVideos]);
    
    const updateUrlParams = (key: string, value: string | null) => {
        const newSearchParams = new URLSearchParams(searchParams);
        if (value === null) newSearchParams.delete(key);
        else newSearchParams.set(key, value);
        setSearchParams(newSearchParams, { replace: true });
    };

    const toggleShuffle = () => {
        const newShuffleState = !isShuffle;
        setIsShuffle(newShuffleState);
        updateUrlParams('shuffle', newShuffleState ? '1' : null);
    };

    const toggleLoop = () => {
        const newLoopState = !isLoop;
        setIsLoop(newLoopState);
        updateUrlParams('loop', newLoopState ? '1' : null);
    };

    const handlePlaylistReorder = (startIndex: number, endIndex: number) => {
        if (!playlistId) return;
        reorderVideosInPlaylist(playlistId, startIndex, endIndex);
    };

    if (isLoading || playerParams === null) {
        return <VideoPlayerPageSkeleton />;
    }

    if (error && !videoDetails) {
        return (
            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-grow lg:w-2/3">
                    <div className="aspect-video bg-yt-black rounded-xl overflow-hidden">
                        {videoId && playerParams && (
                             <iframe src={`https://www.youtubeeducation.com/embed/${videoId}${playerParams}`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe>
                        )}
                    </div>
                    <div className="mt-4 p-4 rounded-lg bg-red-100 dark:bg-red-900/50 text-black dark:text-yt-white">
                        <h2 className="text-lg font-bold mb-2 text-red-500">動画情報の取得エラー</h2>
                        <p>{error}</p>
                    </div>
                </div>
                <div className="lg:w-1/3 lg:max-w-sm flex-shrink-0">
                    <div className="bg-yt-light dark:bg-yt-dark-gray p-4 rounded-xl text-center"><p className="font-semibold">関連動画の読み込みに失敗しました。</p></div>
                </div>
            </div>
        );
    }

    if (!videoDetails) {
        return null;
    }
    
    const subscribed = isSubscribed(videoDetails.channel.id);
    const handleSubscriptionToggle = () => {
        if (subscribed) unsubscribe(videoDetails.channel.id);
        else subscribe(videoDetails.channel);
    };

    const videoForPlaylistModal: Video = {
      id: videoDetails.id, title: videoDetails.title, thumbnailUrl: videoDetails.thumbnailUrl,
      channelName: videoDetails.channelName, channelId: videoDetails.channelId,
      duration: videoDetails.duration, isoDuration: videoDetails.isoDuration,
      views: videoDetails.views, uploadedAt: videoDetails.uploadedAt,
      channelAvatarUrl: videoDetails.channelAvatarUrl,
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-grow lg:w-2/3">
                <div className="aspect-video bg-yt-black rounded-xl overflow-hidden">
                     <iframe src={iframeSrc} key={iframeSrc} title={videoDetails.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe>
                </div>
                <h1 className="text-xl font-bold mt-4">{videoDetails.title}</h1>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4">
                    <div className="flex items-center mb-4 sm:mb-0">
                        <Link to={`/channel/${videoDetails.channel.id}`} className="flex items-center">
                            <img src={videoDetails.channel.avatarUrl} alt={videoDetails.channel.name} className="w-10 h-10 rounded-full" />
                            <div className="ml-3">
                                <p className="font-semibold">{videoDetails.channel.name}</p>
                                <p className="text-sm text-yt-light-gray">{videoDetails.channel.subscriberCount}</p>
                            </div>
                        </Link>
                         <button onClick={handleSubscriptionToggle} className={`ml-6 font-semibold px-4 h-9 rounded-full text-sm flex items-center transform transition-transform duration-150 active:scale-95 ${subscribed ? 'bg-yt-light dark:bg-yt-dark-gray text-black dark:text-white' : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90'}`}>
                            {subscribed ? '登録済み' : 'チャンネル登録'}
                        </button>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="flex items-center bg-yt-light dark:bg-yt-dark-gray rounded-full h-9 px-4 py-2">
                            <LikeIcon />
                            <span className="ml-2 text-sm font-semibold">{videoDetails.likes}</span>
                        </div>
                        <button onClick={() => setIsPlaylistModalOpen(true)} className="flex items-center bg-yt-light dark:bg-yt-dark-gray rounded-full h-9 px-4 hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10">
                            <SaveIcon />
                            <span className="ml-2 text-sm font-semibold">保存</span>
                        </button>
                    </div>
                </div>
                <div className="mt-4 bg-yt-light dark:bg-yt-dark-gray p-3 rounded-xl cursor-pointer" onClick={() => setIsDescriptionExpanded(prev => !prev)}>
                    <p className="font-semibold text-sm">{videoDetails.views} • {videoDetails.uploadedAt}</p>
                    <p className={`text-sm mt-2 whitespace-pre-wrap ${!isDescriptionExpanded ? 'line-clamp-3' : ''}`} dangerouslySetInnerHTML={{ __html: videoDetails.description }} />
                    <button className="font-semibold text-sm mt-2">
                        {isDescriptionExpanded ? '一部を表示' : 'もっと見る'}
                    </button>
                </div>
                 <div className="mt-6">
                    <h2 className="text-xl font-bold">{comments.length.toLocaleString()}件のコメント</h2>
                    <div className="mt-4">
                        {comments.map(comment => (
                            <CommentComponent key={comment.comment_id} comment={comment} />
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="lg:w-1/3 lg:max-w-sm flex-shrink-0">
                {currentPlaylist && videoId ? (
                    <PlaylistPanel playlist={currentPlaylist} authorName={currentPlaylist.authorName} videos={playlistVideos} currentVideoId={videoId} isShuffle={isShuffle} isLoop={isLoop} toggleShuffle={toggleShuffle} toggleLoop={toggleLoop} onReorder={handlePlaylistReorder} />
                ) : (
                    videoDetails.relatedVideos.length > 0 && (
                        <div className="flex flex-col space-y-3">
                            {videoDetails.relatedVideos.map(video => (
                                <RelatedVideoCard key={video.id} video={video} />
                            ))}
                        </div>
                    )
                )}
            </div>
            {isPlaylistModalOpen && (
                <PlaylistModal isOpen={isPlaylistModalOpen} onClose={() => setIsPlaylistModalOpen(false)} video={videoForPlaylistModal} />
            )}
        </div>
    );
};

export default VideoPlayerPage;
