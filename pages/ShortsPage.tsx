
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import ShortsPlayer from '../components/ShortsPlayer';
import { getPlayerConfig, getComments, parseDuration, getChannelShorts, getVideoDetails } from '../utils/api';
import { getXraiShorts } from '../utils/recommendation';
import type { Video, Comment } from '../types';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSearchHistory } from '../contexts/SearchHistoryContext';
import { useHistory } from '../contexts/HistoryContext';
import { usePreference } from '../contexts/PreferenceContext';
import { LikeIcon, CommentIcon, CloseIcon, BlockIcon, TrashIcon } from '../components/icons/Icons';
import CommentComponent from '../components/Comment';
import { useTheme } from '../hooks/useTheme';

// Re-created Chevron Icons for better visibility
const ChevronUpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" className="fill-current text-white w-8 h-8">
        <path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
    </svg>
);

const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" className="fill-current text-white w-8 h-8">
        <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6 6z"/>
    </svg>
);

const ShortsPage: React.FC = () => {
    const { videoId } = useParams<{ videoId: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const context = location.state?.context as { type: 'channel' | 'home' | 'search', channelId?: string } | undefined;

    const [videos, setVideos] = useState<Video[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playerParams, setPlayerParams] = useState<string | null>(null);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [areCommentsLoading, setAreCommentsLoading] = useState(false);

    const { theme } = useTheme();
    const { subscribedChannels } = useSubscription();
    const { searchHistory } = useSearchHistory();
    const { history: watchHistory, shortsHistory, addShortToHistory } = useHistory();
    const { ngKeywords, ngChannels, hiddenVideos, negativeKeywords, addHiddenVideo, addNgChannel } = usePreference();
    
    const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());
    
    const seenVideoIdsRef = useRef<Set<string>>(new Set());

    // --- Pre-loading Logic ---
    // Mount the previous, current, and next video for seamless navigation.
    const getVisibleIndices = () => {
        const indices = [currentIndex];
        if (currentIndex > 0) {
            indices.unshift(currentIndex - 1); // Previous
        }
        if (currentIndex < videos.length - 1) {
            indices.push(currentIndex + 1); // Next
        }
        return indices;
    };

    const sendCommand = (iframe: HTMLIFrameElement, command: 'playVideo' | 'pauseVideo') => {
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: command, args: '' }),
                '*'
            );
        }
    };

    useEffect(() => {
        const currentVideo = videos[currentIndex];
        if (!currentVideo) return;

        iframeRefs.current.forEach((iframe, id) => {
            if (id === currentVideo.id) {
                sendCommand(iframe, 'playVideo');
            } else {
                sendCommand(iframe, 'pauseVideo');
            }
        });
    }, [currentIndex, videos]);

    const fetchMoreShorts = useCallback(async () => {
        if (isFetchingMore) return;
        setIsFetchingMore(true);
        try {
            if (!context || context.type !== 'channel') {
                const currentSeenIds = Array.from(seenVideoIdsRef.current) as string[];
                
                const shorts = await getXraiShorts({ 
                    searchHistory, watchHistory, shortsHistory, subscribedChannels, 
                    ngKeywords, ngChannels, hiddenVideos, negativeKeywords, 
                    page: Math.floor(videos.length / 20) + 1,
                    seenIds: currentSeenIds
                });
                
                setVideos(prev => {
                    const existingIds = new Set(prev.map(v => v.id));
                    const newUniqueShorts = shorts.filter(s => !existingIds.has(s.id));
                    newUniqueShorts.forEach(s => seenVideoIdsRef.current.add(s.id));
                    return [...prev, ...newUniqueShorts];
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsFetchingMore(false);
        }
    }, [isFetchingMore, context, videos.length, searchHistory, watchHistory, shortsHistory, subscribedChannels, ngKeywords, ngChannels, hiddenVideos, negativeKeywords]);

    // Initial Data Fetch Logic
    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                const params = await getPlayerConfig();
                setPlayerParams(params);

                if (context?.type === 'channel' && context.channelId) {
                    const { videos: channelShorts } = await getChannelShorts(context.channelId);
                    
                    let initialIndex = 0;
                    if (videoId) {
                        const idx = channelShorts.findIndex(v => v.id === videoId);
                        if (idx !== -1) {
                            initialIndex = idx;
                        } else {
                            try {
                                const detail = await getVideoDetails(videoId);
                                channelShorts.unshift(detail);
                                initialIndex = 0;
                            } catch (e) {
                                console.warn("Could not fetch detail for initial video", e);
                            }
                        }
                    }
                    
                    seenVideoIdsRef.current = new Set(channelShorts.map(v => v.id));
                    setVideos(channelShorts);
                    setCurrentIndex(initialIndex);
                } 
                else {
                    const shorts = await getXraiShorts({ 
                        searchHistory, watchHistory, shortsHistory, subscribedChannels, 
                        ngKeywords, ngChannels, hiddenVideos, negativeKeywords, 
                        page: 1,
                        seenIds: []
                    });

                    let initialList = shorts;
                    if (videoId) {
                        const existingIdx = shorts.findIndex(v => v.id === videoId);
                        if (existingIdx !== -1) {
                            const [target] = shorts.splice(existingIdx, 1);
                            initialList = [target, ...shorts];
                        } else {
                            try {
                                const detail = await getVideoDetails(videoId);
                                initialList = [detail, ...shorts];
                            } catch (e) {
                                console.warn("Could not fetch detail for requested video", e);
                            }
                        }
                    }
                    
                    if (initialList.length === 0) setError("ショート動画が見つかりませんでした。");
                    else {
                        seenVideoIdsRef.current = new Set(initialList.map(v => v.id));
                        setVideos(initialList);
                    }
                    setCurrentIndex(0);
                }
            } catch (err: any) {
                setError(err.message || 'ショート動画の読み込みに失敗しました。');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        if (videos.length === 0) {
            init();
        }
    }, [videoId, context]);

    // --- Pre-fetching Logic ---
    useEffect(() => {
        if (videos.length > 0 && context?.type !== 'channel') {
            const remainingVideos = videos.length - 1 - currentIndex;
            if (remainingVideos < 15 && !isFetchingMore && !isLoading) {
                fetchMoreShorts();
            }
        }
    }, [currentIndex, videos.length, isFetchingMore, isLoading, context, fetchMoreShorts]);

    // Update URL
    useEffect(() => {
        if (videos[currentIndex] && videos[currentIndex].id !== videoId) {
            navigate(`/shorts/${videos[currentIndex].id}`, { replace: true, state: location.state });
        }
    }, [currentIndex, videos, navigate, videoId, location.state]);

    const handleNext = useCallback(() => {
        setCurrentIndex(prev => {
            if (prev < videos.length - 1) {
                return prev + 1;
            }
            return prev;
        });
    }, [videos.length]);

    const handlePrev = useCallback(() => {
        setCurrentIndex(prev => {
            if (prev > 0) {
                return prev - 1;
            }
            return prev;
        });
    }, []);
    
    // Reset comments
    useEffect(() => {
        setShowComments(false);
        setComments([]);
    }, [currentIndex]);
    
    const getParamsForVideo = (index: number, videoId: string) => {
        if (!playerParams) return '';
        let params = playerParams.replace(/&?autoplay=[01]/g, "") + "&playsinline=1&autoplay=0&enablejsapi=1";
        params += `&loop=1&playlist=${videoId}`;
        return params;
    };

    // History saving
    useEffect(() => {
        const video = videos[currentIndex];
        if (!video) return;
        const durationSec = parseDuration(video.isoDuration, video.duration);
        const timeoutMs = durationSec > 0 ? (durationSec * 1000) / 2 : 10000;
        const historyTimer = setTimeout(() => {
            addShortToHistory(video);
        }, timeoutMs);
        return () => clearTimeout(historyTimer);
    }, [currentIndex, videos, addShortToHistory]);
    
    const handleToggleComments = async () => {
        const willBeOpen = !showComments;
        setShowComments(willBeOpen);
        if (willBeOpen && comments.length === 0 && videos[currentIndex]) {
            setAreCommentsLoading(true);
            try {
                const data = await getComments(videos[currentIndex].id);
                setComments(data);
            } catch (e) { console.error("Failed to fetch comments", e); } 
            finally { setAreCommentsLoading(false); }
        }
    };
    
    const handleNotInterested = () => {
        const video = videos[currentIndex];
        if(!video) return;
        addHiddenVideo({ id: video.id, title: video.title, channelName: video.channelName });
        handleNext();
    };

    const handleBlockChannel = () => {
        const video = videos[currentIndex];
        if(!video) return;
        addNgChannel({ id: video.channelId, name: video.channelName, avatarUrl: video.channelAvatarUrl });
        handleNext();
    };

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (wheelTimeoutRef.current) return;
            if (e.deltaY > 5) handleNext();
            else if (e.deltaY < -5) handlePrev();
            wheelTimeoutRef.current = setTimeout(() => { wheelTimeoutRef.current = null; }, 200);
        };
        const container = document.querySelector('.shorts-container');
        if(container) container.addEventListener('wheel', handleWheel, { passive: false });
        return () => { 
            if(container) container.removeEventListener('wheel', handleWheel);
            if(wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
        };
    }, [handleNext, handlePrev]);

    if (isLoading) return <div className="flex justify-center items-center h-[calc(100vh-64px)]"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-yt-blue"></div></div>;
    if (error) return <div className="text-center text-red-500 bg-red-100 dark:bg-red-900/50 p-4 rounded-lg m-4">{error}</div>;
    if (videos.length === 0 || !playerParams) return <div className="text-center p-8">No shorts found.</div>;

    const visibleIndices = getVisibleIndices();

    return (
        <div className={`shorts-container flex justify-center items-center h-[calc(100vh-3.5rem)] w-full overflow-hidden relative ${theme.includes('glass') ? 'bg-transparent' : 'bg-yt-white dark:bg-yt-black'}`}>
            <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className={`absolute left-4 md:left-[calc(50%-25rem)] top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-sm transition-all shadow-lg hidden md:flex items-center justify-center ${currentIndex === 0 ? 'opacity-0 cursor-not-allowed' : 'opacity-70 hover:opacity-100 hover:scale-110 active:scale-95'}`}
                title="前の動画"
            >
                <ChevronUpIcon />
            </button>

            <div className="relative flex items-center justify-center gap-4 h-full w-full max-w-7xl mx-auto px-2 sm:px-4">
                {/* Main Player Container - Renders list but hides non-active */}
                <div className="relative h-[85vh] max-h-[900px] aspect-[9/16] rounded-2xl shadow-2xl overflow-hidden bg-black flex-shrink-0 z-10">
                     {videos.map((video, index) => {
                         // Unmount if too far away to save memory
                         if (Math.abs(currentIndex - index) > 1) return null;
                         
                         const isActive = index === currentIndex;
                         
                         return (
                             <div 
                                key={video.id} 
                                className="absolute inset-0 w-full h-full"
                                style={{ 
                                    visibility: isActive ? 'visible' : 'hidden',
                                    zIndex: isActive ? 2 : 1, // Active on top
                                }}
                             >
                                 <ShortsPlayer 
                                    ref={(el) => {
                                        if (el) iframeRefs.current.set(video.id, el);
                                        else iframeRefs.current.delete(video.id);
                                    }}
                                    id={video.id}
                                    video={video} 
                                    playerParams={getParamsForVideo(index, video.id)} 
                                    onLoad={(e) => {
                                        if (index === currentIndex) {
                                            const iframe = e.currentTarget;
                                            sendCommand(iframe, 'playVideo');
                                        }
                                    }}
                                 />
                             </div>
                         );
                     })}
                </div>

                {/* Right Side Controls */}
                <div className="flex flex-col gap-5 z-10 absolute right-4 bottom-20 md:static md:bottom-auto">
                    <div className="flex flex-col gap-3">
                        <button onClick={() => {}} className="flex flex-col items-center p-3 rounded-full bg-yt-light/50 dark:bg-yt-light-black/50 hover:bg-yt-light dark:hover:bg-yt-light-black backdrop-blur-sm transition-all group">
                            <LikeIcon /><span className="text-xs font-semibold text-black dark:text-white mt-1 hidden md:block">高評価</span>
                        </button>
                        <button onClick={handleToggleComments} className={`flex flex-col items-center p-3 rounded-full bg-yt-light/50 dark:bg-yt-light-black/50 hover:bg-yt-light dark:hover:bg-yt-light-black backdrop-blur-sm transition-all group ${showComments ? 'bg-white text-black hover:bg-white/90' : ''}`}>
                            <CommentIcon /><span className="text-xs font-semibold text-black dark:text-white mt-1 hidden md:block">コメント</span>
                        </button>
                        <button onClick={handleNotInterested} className="flex flex-col items-center p-3 rounded-full bg-yt-light/50 dark:bg-yt-light-black/50 hover:bg-yt-light dark:hover:bg-yt-light-black backdrop-blur-sm transition-all group">
                            <TrashIcon /><span className="text-xs font-semibold text-black dark:text-white mt-1 hidden md:block">興味なし</span>
                        </button>
                        <button onClick={handleBlockChannel} className="flex flex-col items-center p-3 rounded-full bg-yt-light/50 dark:bg-yt-light-black/50 hover:bg-yt-light dark:hover:bg-yt-light-black backdrop-blur-sm transition-all group">
                            <BlockIcon /><span className="text-xs font-semibold text-black dark:text-white mt-1 hidden md:block">非表示</span>
                        </button>
                    </div>
                </div>

                {/* Comment Drawer */}
                {showComments && (
                    <div className="absolute inset-0 md:static md:w-[360px] md:h-[85vh] md:max-h-[900px] glass-panel rounded-2xl shadow-2xl flex flex-col animate-scale-in z-20 bg-white/95 dark:bg-black/95 md:bg-transparent">
                         <div className="flex items-center justify-between p-4 border-b border-white/20">
                             <h3 className="font-bold text-black dark:text-white">コメント {comments.length > 0 && `(${comments.length})`}</h3>
                             <button onClick={() => setShowComments(false)} className="p-2 hover:bg-white/10 rounded-full"><CloseIcon /></button>
                         </div>
                         <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                             {areCommentsLoading ? <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yt-blue"></div></div>
                             : comments.length > 0 ? (
                                 <div className="space-y-2">
                                     {comments.map((comment, idx) => ( <div key={idx} className="bg-black/5 dark:bg-white/5 rounded-lg p-2 backdrop-blur-sm"><CommentComponent comment={comment} /></div> ))}
                                 </div>
                             ) : <div className="text-center text-yt-light-gray py-10">コメントはありません</div> }
                         </div>
                    </div>
                )}
            </div>

            <button
                onClick={handleNext}
                disabled={currentIndex >= videos.length - 1 && !isFetchingMore}
                className={`absolute right-4 md:right-[calc(50%-25rem)] top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-sm transition-all shadow-lg hidden md:flex items-center justify-center ${currentIndex >= videos.length - 1 && !isFetchingMore ? 'opacity-0 cursor-not-allowed' : 'opacity-70 hover:opacity-100 hover:scale-110 active:scale-95'}`}
                title="次の動画"
            >
                <ChevronDownIcon />
            </button>
        </div>
    );
};
export default ShortsPage;
