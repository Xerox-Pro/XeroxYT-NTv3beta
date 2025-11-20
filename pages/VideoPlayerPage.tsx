import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { getVideoDetails, getPlayerConfig, getComments, getVideosByIds, getStreamUrls } from '../utils/api';
import type { VideoDetails, Video, Comment } from '../types';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useHistory } from '../contexts/HistoryContext';
import { usePlaylist } from '../contexts/PlaylistContext';
import VideoPlayerPageSkeleton from '../components/skeletons/VideoPlayerPageSkeleton';
import RelatedVideoCard from '../components/RelatedVideoCard';
import PlaylistModal from '../components/PlaylistModal';
import CommentComponent from '../components/Comment';
import PlaylistPanel from '../components/PlaylistPanel';
import StreamingPlayer from '../components/StreamingPlayer';
import { LikeIcon, SaveIcon, MoreIconHorizontal } from '../components/icons/Icons';

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
    
    const [playerType, setPlayerType] = useState<'edu' | 'stream'>('edu');
    const [streamUrls, setStreamUrls] = useState<{ video_url: string; audio_url?: string } | null>(null);
    const [isLoadingStream, setIsLoadingStream] = useState(false);
    const [streamError, setStreamError] = useState<string | null>(null);

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
            setPlayerType('edu');
            setStreamUrls(null);
            setStreamError(null);
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
    
    useEffect(() => {
        if (playerType === 'stream' && videoId && !streamUrls && !streamError) {
          const fetchStreamUrls = async () => {
            setIsLoadingStream(true);
            try {
              const urls = await getStreamUrls(videoId);
              setStreamUrls(urls);
              if (urls.video_url) {
                window.open(urls.video_url, '_blank');
              }
            } catch (err: any) {
              setStreamError(err.message || 'ストリームURLの取得に失敗しました。');
              console.error(err);
            } finally {
              setIsLoadingStream(false);
            }
          };
          fetchStreamUrls();
        }
      }, [playerType, videoId, streamUrls, streamError]);

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
        <div className="flex flex-col lg:flex-row gap-6 max-w-[1700px] mx-auto">
            <div className="flex-grow lg:w-2/3">
                {/* Player Container */}
                <div className="aspect-video bg-yt-black rounded-xl overflow-hidden shadow-lg">
                    {playerType === 'edu' ? (
                        <iframe src={iframeSrc} key={iframeSrc} title={videoDetails.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe>
                    ) : (
                        <>
                            {isLoadingStream && (
                                <div className="w-full h-full flex flex-col justify-center items-center text-white">
                                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yt-blue"></div>
                                    <p className="mt-4">ストリームを準備中...</p>
                                </div>
                            )}
                            {streamError && <div className="w-full h-full flex justify-center items-center text-red-400 bg-red-900/50 p-4">{streamError}</div>}
                            {streamUrls && <StreamingPlayer videoUrl={streamUrls.video_url} audioUrl={streamUrls.audio_url} />}
                        </>
                    )}
                </div>

                {/* Title */}
                <div className="mt-3">
                    <h1 className="text-xl font-bold text-black dark:text-white line-clamp-2">{videoDetails.title}</h1>
                </div>

                {/* Channel & Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-2 gap-4">
                    {/* Left Side: Channel Info */}
                    <div className="flex items-center min-w-0">
                        <Link to={`/channel/${videoDetails.channel.id}`} className="flex-shrink-0">
                            <img src={videoDetails.channel.avatarUrl} alt={videoDetails.channel.name} className="w-10 h-10 rounded-full object-cover" />
                        </Link>
                        <div className="ml-3 flex flex-col mr-6">
                            <Link to={`/channel/${videoDetails.channel.id}`} className="font-bold text-base text-black dark:text-white hover:text-opacity-80 truncate">
                                {videoDetails.channel.name}
                            </Link>
                            <span className="text-xs text-yt-light-gray">{videoDetails.channel.subscriberCount}</span>
                        </div>
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

                    {/* Right Side: Actions */}
                    <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
                         {/* Like Button */}
                        <div className="flex items-center bg-yt-light dark:bg-[#272727] rounded-full h-9 hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f] transition-colors">
                            <button className="flex items-center px-4 h-full border-r border-yt-light-gray/20">
                                <LikeIcon />
                                <span className="ml-2 text-sm font-semibold">{videoDetails.likes}</span>
                            </button>
                             {/* Dislike placeholder (visual only) */}
                            <button className="px-4 h-full rounded-r-full">
                                <div className="transform rotate-180">
                                   <LikeIcon />
                                </div>
                            </button>
                        </div>

                        {/* Share/Save Button */}
                        <button onClick={() => setIsPlaylistModalOpen(true)} className="flex items-center bg-yt-light dark:bg-[#272727] rounded-full h-9 px-4 hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f] transition-colors whitespace-nowrap">
                            <SaveIcon />
                            <span className="ml-2 text-sm font-semibold">保存</span>
                        </button>
                        
                        {/* More Button */}
                        <button className="flex items-center justify-center bg-yt-light dark:bg-[#272727] rounded-full w-9 h-9 hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f] transition-colors flex-shrink-0">
                            <MoreIconHorizontal />
                        </button>
                    </div>
                </div>

                {/* Description Box */}
                <div className={`mt-4 bg-yt-light dark:bg-[#272727] p-3 rounded-xl text-sm cursor-pointer hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f] transition-colors ${isDescriptionExpanded ? '' : 'h-28 overflow-hidden relative'}`} onClick={() => setIsDescriptionExpanded(prev => !prev)}>
                     <div className="font-semibold mb-1">
                        {videoDetails.views}  •  {videoDetails.uploadedAt}
                    </div>
                    <div className="whitespace-pre-wrap break-words text-black dark:text-white">
                        <div dangerouslySetInnerHTML={{ __html: videoDetails.description }} />
                    </div>
                     {!isDescriptionExpanded && (
                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-yt-light dark:from-[#272727] to-transparent flex items-end p-3 font-semibold">
                            もっと見る
                        </div>
                    )}
                    {isDescriptionExpanded && (
                         <div className="font-semibold mt-2">一部を表示</div>
                    )}
                </div>

                {/* Comments Section */}
                 <div className="mt-6">
                    <div className="flex items-center mb-6">
                        <h2 className="text-xl font-bold">{comments.length.toLocaleString()}件のコメント</h2>
                        <div className="ml-8 flex items-center cursor-pointer">
                             <span className="material-icons text-xl mr-2">sort</span>
                             <span className="font-semibold text-sm">並べ替え</span>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {comments.map(comment => (
                            <CommentComponent key={comment.comment_id} comment={comment} />
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Secondary Column: Recommendations / Playlist */}
            <div className="lg:w-1/3 lg:max-w-[400px] flex-shrink-0">
                {/* Player Type Switcher (moved here for better layout) */}
                <div className="flex items-center space-x-2 mb-4 overflow-x-auto pb-2">
                     <button
                        onClick={() => setPlayerType('edu')}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${playerType === 'edu' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-yt-light dark:bg-[#272727] hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f]'}`}
                    >
                        すべて
                    </button>
                    <button
                        onClick={() => setPlayerType('stream')}
                         className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${playerType === 'stream' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-yt-light dark:bg-[#272727] hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f]'}`}
                    >
                        関連動画
                    </button>
                </div>

                {currentPlaylist && videoId ? (
                    <PlaylistPanel playlist={currentPlaylist} authorName={currentPlaylist.authorName} videos={playlistVideos} currentVideoId={videoId} isShuffle={isShuffle} isLoop={isLoop} toggleShuffle={toggleShuffle} toggleLoop={toggleLoop} onReorder={handlePlaylistReorder} />
                ) : (
                    videoDetails.relatedVideos.length > 0 && (
                        <div className="flex flex-col space-y-2">
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
