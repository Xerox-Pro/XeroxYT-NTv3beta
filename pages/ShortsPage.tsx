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

// Re-created Chevron Icons - Increased size (approx 1.7x) and bolder design
const ChevronUpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="fill-current text-white w-14 h-14 drop-shadow-lg">
        <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/>
    </svg>
);

const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="fill-current text-white w-14 h-14 drop-shadow-lg">
        <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
    </svg>
);

const ShortsPage: React.FC = () => {
    // FIX: Explicitly type the `useParams` hook to resolve type inference issue.
    const params = useParams<{ videoId?: string; '*': string }>();
    // Handle both /shorts/:videoId and /shorts/* patterns
    const videoId = params.videoId || params['*']; 
    
    const location = useLocation();
    const navigate = useNavigate();
    const context = location.state?.context as { type: 'channel' | 'home' | 'search', channelId?: string } | undefined;

    const [videos, setVideos] = useState<Video[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
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

    const sendCommand = (iframe: HTMLIFrameElement | null, command: 'playVideo' | 'pauseVideo') => {
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func: command, args: [] }),
                '*'
            );
        }
    };
    
    // --- Data Fetching and State Sync Logic ---
    useEffect(() => {
        const handleDataFetchAndSync = async () => {
            // Case 1: Video ID exists in URL and is already in our list.
            if (videoId && videos.length > 0) {
                const targetIndex = videos.findIndex(v => v.id === videoId);
                if (targetIndex !== -1) {
                    if (currentIndex !== targetIndex) {
                        setCurrentIndex(targetIndex);
                    }
                    return; // Done. No need to fetch.
                }
            }
            
            // Case 2: We need to fetch data. This will show a loading spinner.
            // This happens on first load, or when navigating to a video not in the current list.
            setIsLoading(true);
            setError(null);
            
            try {
                if (!playerParams) {
                    const params = await getPlayerConfig();
                    setPlayerParams(params);
                }

                let fetchedShorts: Video[] = [];
                let initialIndex = 0;

                if (context?.type === 'channel' && context.channelId) {
                    // Channel Context: Fetch all shorts for the channel
                    const { videos: channelShorts } = await getChannelShorts(context.channelId);
                    fetchedShorts = channelShorts;
                    if (videoId) {
                        const idx = fetchedShorts.findIndex(v => v.id === videoId);
                        initialIndex = idx !== -1 ? idx : 0;
                    }
                } else {
                    // Recommendation Context
                    const shorts = await getXraiShorts({ 
                        searchHistory, watchHistory, shortsHistory, subscribedChannels, 
                        ngKeywords, ngChannels, hiddenVideos, negativeKeywords, 
                        page: 1,
                        seenIds: videoId ? [videoId] : []
                    });
                    fetchedShorts = shorts;
                }

                // If a specific videoId is requested (and not found in initial fetch), get its details and prepend it.
                if (videoId && !fetchedShorts.some(v => v.id === videoId)) {
                    try {
                        const detail = await getVideoDetails(videoId);
                        fetchedShorts.unshift(detail);
                        initialIndex = 0;
                    } catch (e) {
                        console.warn("Could not fetch details for requested video, may not exist.", e);
                    }
                }
                
                if (fetchedShorts.length === 0 && !videoId) {
                    setError("ショート動画が見つかりませんでした。");
                }
                
                seenVideoIdsRef.current = new Set(fetchedShorts.map(v => v.id));
                setVideos(fetchedShorts);
                setCurrentIndex(initialIndex >= 0 ? initialIndex : 0);

            } catch (err: any) {
                setError(err.message || 'ショート動画の読み込みに失敗しました。');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        handleDataFetchAndSync();
    }, [videoId, context]); // This single effect now controls all data and view state based on URL
    
    const fetchMoreShorts = useCallback(async () => {
        if (isFetchingMore || (context?.type === 'channel')) return;
        setIsFetchingMore(true);
        try {
            // FIX: Explicitly type `currentSeenIds` to avoid type inference issues.
            const currentSeenIds: string[] = Array.from(seenVideoIdsRef.current);
            
            const shorts = await getXraiShorts({ 
                searchHistory, watchHistory, shortsHistory, subscribedChannels, 
                ngKeywords, ngChannels, hiddenVideos, negativeKeywords, 
                page: Math.floor(videos.length / 30) + 1, 
                seenIds: currentSeenIds
            });
            
            const newUniqueShorts = shorts.filter(s => !seenVideoIdsRef.current.has(s.id));
            if (newUniqueShorts.length > 0) {
                 newUniqueShorts.forEach(s => seenVideoIdsRef.current.add(s.id));
                 setVideos(prev => [...prev, ...newUniqueShorts]);
            }
        } catch (e) { console.error(e); } 
        finally { setIsFetchingMore(false); }
    }, [isFetchingMore, context, videos.length, searchHistory, watchHistory, shortsHistory, subscribedChannels, ngKeywords, ngChannels, hiddenVideos, negativeKeywords]);

    // --- Pre-fetching & URL Update Logic ---
    useEffect(() => {
        const currentVideo = videos[currentIndex];
        if (currentVideo && currentVideo.id !== videoId) {
            navigate(`/shorts/${currentVideo.id}`, { replace: true, state: location.state });
        }
        
        // Pre-fetch more videos if buffer is low
        const remainingVideos = videos.length - 1 - currentIndex;
        if (remainingVideos < 15 && !isFetchingMore && !isLoading && context?.type !== 'channel') {
            fetchMoreShorts();
        }
    }, [currentIndex, videos, videoId, navigate, location.state, isFetchingMore, isLoading, context, fetchMoreShorts]);
    
    // History saving
    useEffect(() => {
        const video = videos[currentIndex];
        if (!video) return;
        const durationSec = parseDuration(video.isoDuration, video.duration);
        const timeoutMs = durationSec > 0 ? (durationSec * 1000) / 2 : 10000; // Save after 50% watched or 10s
        const historyTimer = setTimeout(() => {
            addShortToHistory(video);
        }, timeoutMs);
        return () => clearTimeout(historyTimer);
    }, [currentIndex, videos, addShortToHistory]);
    
    // Event Handlers
    const handleNext = useCallback(() => {
        setCurrentIndex(prevIndex => {
            const newIndex = Math.min(prevIndex + 1, videos.length - 1);
            if (newIndex === prevIndex) return prevIndex;

            const prevVideo = videos[prevIndex];
            if (prevVideo) {
                const prevIframe = iframeRefs.current.get(prevVideo.id);
                sendCommand(prevIframe || null, 'pauseVideo');
            }

            const nextVideo = videos[newIndex];
            if (nextVideo) {
                setTimeout(() => {
                    const nextIframe = iframeRefs.current.get(nextVideo.id);
                    sendCommand(nextIframe || null, 'playVideo');
                }, 50); 
            }

            return newIndex;
        });
    }, [videos]);

    const handlePrev = useCallback(() => {
        setCurrentIndex(prevIndex => {
            const newIndex = Math.max(prevIndex - 1, 0);
            if (newIndex === prevIndex) return prevIndex;

            const prevVideo = videos[prevIndex];
            if (prevVideo) {
                const prevIframe = iframeRefs.current.get(prevVideo.id);
                sendCommand(prevIframe || null, 'pauseVideo');
            }

            const nextVideo = videos[newIndex];
            if (nextVideo) {
                setTimeout(() => {
                    const nextIframe = iframeRefs.current.get(nextVideo.id);
                    sendCommand(nextIframe || null, 'playVideo');
                }, 50);
            }

            return newIndex;
        });
    }, [videos]);
    
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

    // Reset comments when index changes
    useEffect(() => {
        setShowComments(false);
        setComments([]);
    }, [currentIndex]);

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

    const getParamsForVideo = (videoId: string) => {
        if (!playerParams) return '';
        let params = playerParams.replace(/&?autoplay=[01]/g, "") + "&playsinline=1&autoplay=0&enablejsapi=1";
        params += `&loop=1&playlist=${videoId}`;
        return params;
    };
    
    if (isLoading && videos.length === 0) return <div className="flex justify-center items-center h-[calc(100vh-64px)]"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-yt-blue"></div></div>;
    if (error) return <div className="text-center text-red-500 bg-red-100 dark:bg-red-900/50 p-4 rounded-lg m-4">{error}</div>;
    if (videos.length === 0 || !playerParams) return <div className="text-center p-8">No shorts found.</div>;

    return (
        <div className={`shorts-container flex justify-center items-center h-[calc(100vh-3.5rem)] w-full overflow-hidden relative ${theme.includes('glass') ? 'bg-transparent' : 'bg-yt-white dark:bg-yt-black'}`}>
            <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className={`absolute left-4 md:left-[calc(50%-25rem)] top-1/2 -translate-y-1/2 z-20 p-4 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-sm transition-all shadow-lg flex items-center justify-center ${currentIndex === 0 ? 'opacity-0 cursor-not-allowed' : 'opacity-70 hover:opacity-100 hover:scale-110 active:scale-95'}`}
                title="前の動画"
            >
                <ChevronUpIcon />
            </button>

            <div className="relative flex items-center justify-center gap-4 h-full w-full max-w-7xl mx-auto px-2 sm:px-4">
                <div className="relative h-[85vh] max-h-[900px] aspect-[9/16] rounded-2xl shadow-2xl overflow-hidden bg-black flex-shrink-0 z-10">
                     {videos.map((video, index) => {
                         // Render previous, current, and next 10 videos for pre-loading
                         if (index < currentIndex -1 || index > currentIndex + 10) return null;
                         
                         const isActive = index === currentIndex;
                         
                         return (
                             <div 
                                key={video.id} 
                                className="absolute inset-0 w-full h-full"
                                style={{ 
                                    transform: `translateY(${(index - currentIndex) * 100}%)`,
                                    transition: 'transform 0.4s ease-out',
                                    visibility: isActive ? 'visible' : 'hidden', // Hide non-active for performance
                                }}
                             >
                                 <ShortsPlayer 
                                    ref={(el) => {
                                        if (el) iframeRefs.current.set(video.id, el);
                                        else iframeRefs.current.delete(video.id);
                                    }}
                                    id={video.id}
                                    video={video} 
                                    playerParams={getParamsForVideo(video.id)} 
                                    onLoad={(e) => {
                                        if (index !== currentIndex) {
                                            sendCommand(e.currentTarget, 'pauseVideo');
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
                             ) : <div className="text-center text-yt-light-gray py-10">コメントはありません。</div> }
                         </div>
                    </div>
                )}
            </div>

            <button
                onClick={handleNext}
                disabled={currentIndex >= videos.length - 1 && !isFetchingMore}
                className={`absolute right-4 md:right-[calc(50%-25rem)] top-1/2 -translate-y-1/2 z-20 p-4 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-sm transition-all shadow-lg flex items-center justify-center ${currentIndex >= videos.length - 1 && !isFetchingMore ? 'opacity-0 cursor-not-allowed' : 'opacity-70 hover:opacity-100 hover:scale-110 active:scale-95'}`}
                title="次の動画"
            >
                <ChevronDownIcon />
            </button>
        </div>
    );
};
export default ShortsPage;