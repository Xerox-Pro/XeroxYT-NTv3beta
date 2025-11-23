
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { getVideoDetails, getPlayerConfig, getComments, getVideosByIds, getExternalRelatedVideos } from '../utils/api';
import type { VideoDetails, Video, Comment, Channel } from '../types';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useHistory } from '../contexts/HistoryContext';
import { usePlaylist } from '../contexts/PlaylistContext';
import VideoPlayerPageSkeleton from '../components/skeletons/VideoPlayerPageSkeleton';
import PlaylistModal from '../components/PlaylistModal';
import CommentComponent from '../components/Comment';
import PlaylistPanel from '../components/PlaylistPanel';
import RelatedVideoCard from '../components/RelatedVideoCard';
import { LikeIcon, SaveIcon, MoreIconHorizontal, ShareIcon, DislikeIcon, ChevronRightIcon } from '../components/icons/Icons';

const { useParams, Link, useSearchParams } = ReactRouterDOM;

const VideoPlayerPage: React.FC = () => {
    const { videoId } = useParams<{ videoId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const playlistId = searchParams.get('list');

    const [videoDetails, setVideoDetails] = useState<VideoDetails | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
    const [playerParams, setPlayerParams] = useState<string | null>(null);
    const [playlistVideos, setPlaylistVideos] = useState<Video[]>([]);
    const [isCollaboratorMenuOpen, setIsCollaboratorMenuOpen] = useState(false);
    const collaboratorMenuRef = useRef<HTMLDivElement>(null);
    
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
        const handleClickOutside = (event: MouseEvent) => {
            if (collaboratorMenuRef.current && !collaboratorMenuRef.current.contains(event.target as Node)) {
                setIsCollaboratorMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
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
        let isMounted = true;

        const fetchVideoData = async () => {
            if (!videoId) return;
            
            if (isMounted) {
                setIsLoading(true);
                setError(null);
                setVideoDetails(null);
                setComments([]);
                setRelatedVideos([]);
                window.scrollTo(0, 0);
            }

            // 1. Video Details (Highest Priority)
            getVideoDetails(videoId)
                .then(details => {
                    if (isMounted) {
                        setVideoDetails(details);
                        if (details.relatedVideos && details.relatedVideos.length > 0) {
                            setRelatedVideos(details.relatedVideos);
                        }
                        addVideoToHistory(details);
                        setIsLoading(false);
                    }
                })
                .catch(err => {
                    if (isMounted) {
                        setError(err.message || '動画の読み込みに失敗しました。');
                        console.error(err);
                        setIsLoading(false);
                    }
                });

            // 2. Comments (Background)
            getComments(videoId)
                .then(commentsData => {
                    if (isMounted) {
                        setComments(commentsData);
                    }
                })
                .catch(err => {
                    console.warn("Failed to fetch comments", err);
                });

            // 3. External Related Videos (Background)
            getExternalRelatedVideos(videoId)
                .then(externalRelated => {
                    if (isMounted && externalRelated && externalRelated.length > 0) {
                        setRelatedVideos(externalRelated);
                    }
                })
                .catch(extErr => {
                    console.warn("Failed to fetch external related videos", extErr);
                });
        };

        fetchVideoData();

        return () => {
            isMounted = false;
        };
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
            <div className="flex flex-col md:flex-row gap-6 max-w-[1750px] mx-auto px-4 md:px-6">
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
            </div>
        );
    }

    if (!videoDetails) {
        return null;
    }
    
    const mainChannel = videoDetails.collaborators && videoDetails.collaborators.length > 0 
        ? videoDetails.collaborators[0] 
        : videoDetails.channel;

    const subscribed = isSubscribed(mainChannel.id);
    
    const handleSubscriptionToggle = () => {
        if (subscribed) unsubscribe(mainChannel.id);
        else subscribe(mainChannel);
    };

    const videoForPlaylistModal: Video = {
      id: videoDetails.id, title: videoDetails.title, thumbnailUrl: videoDetails.thumbnailUrl,
      channelName: mainChannel.name, channelId: mainChannel.id,
      duration: videoDetails.duration, isoDuration: videoDetails.isoDuration,
      views: videoDetails.views, uploadedAt: videoDetails.uploadedAt,
      channelAvatarUrl: mainChannel.avatarUrl,
    };

    const hasCollaborators = videoDetails.collaborators && videoDetails.collaborators.length > 1;
    const collaboratorsList = videoDetails.collaborators || [];

    return (
        <div className="flex flex-col lg:flex-row gap-6 max-w-[1750px] mx-auto pt-2 md:pt-6 px-4 md:px-6 justify-center">
            {/* Main Content Column */}
            <div className="flex-1 min-w-0 max-w-full">
                {/* Video Player Area */}
                <div className="w-full aspect-video bg-yt-black rounded-xl overflow-hidden shadow-lg relative z-10">
                    <iframe src={iframeSrc} key={iframeSrc} title={videoDetails.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe>
                </div>

                <div className="">
                    {/* Title */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3 mb-2">
                         <h1 className="text-lg md:text-xl font-bold text-black dark:text-white break-words flex-1">
                            {videoDetails.title}
                        </h1>
                    </div>

                    {/* Actions Bar Container */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-2">
                        {/* Left: Channel Info & Subscribe */}
                        <div className="flex items-center justify-between md:justify-start w-full md:w-auto gap-4">
                            <div className="flex items-center min-w-0 flex-1 md:flex-initial">
                                <Link to={`/channel/${mainChannel.id}`} className="flex-shrink-0">
                                    <img src={mainChannel.avatarUrl} alt={mainChannel.name} className="w-10 h-10 rounded-full object-cover" />
                                </Link>
                                <div className="flex flex-col ml-3 mr-4 min-w-0 relative" ref={collaboratorMenuRef}>
                                    {hasCollaborators ? (
                                        <>
                                            <div 
                                                className="flex items-center cursor-pointer hover:opacity-80 group select-none"
                                                onClick={() => setIsCollaboratorMenuOpen(!isCollaboratorMenuOpen)}
                                            >
                                                <span className="font-bold text-base text-black dark:text-white truncate block max-w-[200px]">
                                                    {mainChannel.name} 他
                                                </span>
                                                <div className={`transform transition-transform duration-200 ${isCollaboratorMenuOpen ? 'rotate-90' : ''}`}>
                                                    <ChevronRightIcon />
                                                </div>
                                            </div>

                                            {/* Collaborators Dropdown */}
                                            {isCollaboratorMenuOpen && (
                                                <div className="absolute top-full left-0 mt-2 w-64 bg-yt-white dark:bg-yt-light-black rounded-lg shadow-xl border border-yt-spec-light-20 dark:border-yt-spec-20 z-50 overflow-hidden">
                                                    <div className="px-4 py-2 text-xs font-bold text-yt-light-gray border-b border-yt-spec-light-20 dark:border-yt-spec-20">
                                                        チャンネルを選択
                                                    </div>
                                                    <div className="max-h-60 overflow-y-auto">
                                                        {collaboratorsList.map(collab => (
                                                            <Link 
                                                                key={collab.id} 
                                                                to={`/channel/${collab.id}`}
                                                                className="flex items-center px-4 py-3 hover:bg-yt-spec-light-10 dark:hover:bg-yt-spec-10"
                                                                onClick={() => setIsCollaboratorMenuOpen(false)}
                                                            >
                                                                <img src={collab.avatarUrl} alt={collab.name} className="w-8 h-8 rounded-full mr-3" />
                                                                <div>
                                                                    <p className="text-sm font-semibold text-black dark:text-white">{collab.name}</p>
                                                                    {collab.subscriberCount && (
                                                                        <p className="text-xs text-yt-light-gray">{collab.subscriberCount}</p>
                                                                    )}
                                                                </div>
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <Link to={`/channel/${mainChannel.id}`} className="font-bold text-base text-black dark:text-white hover:text-opacity-80 truncate block">
                                            {mainChannel.name}
                                        </Link>
                                    )}
                                    <span className="text-xs text-yt-light-gray truncate block">{mainChannel.subscriberCount}</span>
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleSubscriptionToggle} 
                                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                                    subscribed 
                                    ? 'bg-yt-light dark:bg-[#272727] text-black dark:text-white hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f]' 
                                    : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90'
                                }`}
                            >
                                {subscribed ? '登録済み' : 'チャンネル登録'}
                            </button>
                        </div>

                        {/* Right: Action Buttons */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0 w-full md:w-auto">
                            <div className="flex items-center bg-yt-light dark:bg-[#272727] rounded-full h-9 hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f] transition-colors flex-shrink-0">
                                <button className="flex items-center px-3 sm:px-4 h-full border-r border-yt-light-gray/20 gap-2">
                                    <LikeIcon />
                                    <span className="text-sm font-semibold">{videoDetails.likes}</span>
                                </button>
                                <button className="px-3 h-full rounded-r-full">
                                    <DislikeIcon />
                                </button>
                            </div>

                            <button className="flex items-center bg-yt-light dark:bg-[#272727] rounded-full h-9 px-3 sm:px-4 hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f] transition-colors whitespace-nowrap gap-2 flex-shrink-0">
                                <ShareIcon />
                                <span className="text-sm font-semibold hidden sm:inline">共有</span>
                            </button>

                            <button 
                                onClick={() => setIsPlaylistModalOpen(true)} 
                                className="flex items-center justify-center bg-yt-light dark:bg-[#272727] rounded-full w-9 h-9 hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f] transition-colors flex-shrink-0"
                            >
                                <SaveIcon />
                            </button>

                            <button className="flex items-center justify-center bg-yt-light dark:bg-[#272727] rounded-full w-9 h-9 hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f] transition-colors flex-shrink-0">
                                <MoreIconHorizontal />
                            </button>
                        </div>
                    </div>

                    {/* Description Box */}
                    <div className={`mt-2 bg-yt-light dark:bg-[#272727] p-3 rounded-xl text-sm cursor-pointer hover:bg-[#e5e5e5] dark:hover:bg-[#3f3f3f] transition-colors ${isDescriptionExpanded ? '' : 'h-24 overflow-hidden relative'}`} onClick={() => setIsDescriptionExpanded(prev => !prev)}>
                        <div className="font-bold mb-2 text-black dark:text-white">
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
                    <div className="mt-6 hidden lg:block">
                        <div className="flex flex-col mb-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold">{comments.length.toLocaleString()}件のコメント</h2>
                            </div>
                        </div>

                        {comments.length > 0 ? (
                            <div className="space-y-4">
                                {comments.map(comment => (
                                    <CommentComponent key={comment.comment_id} comment={comment} />
                                ))}
                            </div>
                        ) : (
                             <div className="py-4 text-yt-light-gray">コメントの読み込み中、またはコメントがありません。</div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Sidebar: Playlist & Related Videos */}
            <div className="w-full lg:w-[350px] xl:w-[400px] flex-shrink-0 flex flex-col gap-4 pb-10">
                {currentPlaylist && (
                     <PlaylistPanel playlist={currentPlaylist} authorName={currentPlaylist.authorName} videos={playlistVideos} currentVideoId={videoId} isShuffle={isShuffle} isLoop={isLoop} toggleShuffle={toggleShuffle} toggleLoop={toggleLoop} onReorder={handlePlaylistReorder} />
                )}
                
                {/* Filter Chips (Visual only) */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-0">
                    <button className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black text-xs md:text-sm font-semibold rounded-lg whitespace-nowrap">すべて</button>
                    <button className="px-3 py-1.5 bg-yt-light dark:bg-[#272727] text-black dark:text-white text-xs md:text-sm font-semibold rounded-lg whitespace-nowrap hover:bg-gray-200 dark:hover:bg-gray-700">関連動画</button>
                    <button className="px-3 py-1.5 bg-yt-light dark:bg-[#272727] text-black dark:text-white text-xs md:text-sm font-semibold rounded-lg whitespace-nowrap hover:bg-gray-200 dark:hover:bg-gray-700">最近アップロードされた動画</button>
                </div>

                {/* Render Related Videos */}
                <div className="flex flex-col space-y-3">
                    {relatedVideos.length > 0 ? (
                        relatedVideos.map(video => (
                            <RelatedVideoCard key={video.id} video={video} />
                        ))
                    ) : (
                        !isLoading && <div className="text-center py-4 text-yt-light-gray">関連動画が見つかりません</div>
                    )}
                </div>

                {/* Mobile Comments Fallback */}
                <div className="block lg:hidden mt-8 border-t border-yt-spec-light-20 dark:border-yt-spec-20 pt-4">
                    <h2 className="text-lg font-bold mb-4">{comments.length.toLocaleString()}件のコメント</h2>
                    <div className="space-y-4">
                        {comments.map(comment => (
                            <CommentComponent key={comment.comment_id} comment={comment} />
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Modals */}
            {isPlaylistModalOpen && (
                <PlaylistModal isOpen={isPlaylistModalOpen} onClose={() => setIsPlaylistModalOpen(false)} video={videoForPlaylistModal} />
            )}
        </div>
    );
};

export default VideoPlayerPage;
