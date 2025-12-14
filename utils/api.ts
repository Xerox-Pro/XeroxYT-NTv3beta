import type { Video, VideoDetails, Channel, ChannelDetails, ApiPlaylist, Comment, PlaylistDetails, SearchResults, HomeVideo, HomePlaylist, ChannelHomeData } from '../types';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import relativeTime from 'dayjs/plugin/relativeTime';

// Day.jsの日本語化と相対時間プラグインの有効化
dayjs.extend(relativeTime);
dayjs.locale('ja');

// --- CACHING LOGIC ---
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface CacheItem {
    data: any;
    expiry: number;
}

const cache = {
    get: (key: string): any | null => {
        try {
            const itemStr = localStorage.getItem(key);
            if (!itemStr) return null;
            const item: CacheItem = JSON.parse(itemStr);
            if (new Date().getTime() > item.expiry) {
                localStorage.removeItem(key);
                return null;
            }
            return item.data;
        } catch (error) {
            console.error(`Cache read error for key "${key}":`, error);
            return null;
        }
    },
    set: (key: string, value: any, ttl: number = CACHE_TTL): void => {
        try {
            if (value === undefined) return;
            const item: CacheItem = { data: value, expiry: new Date().getTime() + ttl };
            localStorage.setItem(key, JSON.stringify(item));
        } catch (error) {
            console.error(`Cache write error for key "${key}":`, error);
        }
    },
};


// --- HELPER FUNCTIONS ---

export const formatJapaneseNumber = (raw: number | string): string => {
  const num = typeof raw === 'string' ? parseInt(raw.replace(/,/g, ''), 10) : raw;
  if (isNaN(num)) return '0';
  if (num >= 100000000) return `${(num / 100000000).toFixed(1).replace('.0', '')}億`;
  if (num >= 10000) return `${(num / 10000).toFixed(1).replace('.0', '')}万`;
  return num.toLocaleString();
};

export const formatJapaneseDate = (dateText: string): string => {
  if (!dateText) return '';
  if (!dateText.includes('ago')) {
    return dateText;
  }
  const match = dateText.match(/(\d+)\s+(year|month|week|day|hour|minute|second)s?/);
  if (match) {
    const num = parseInt(match[1], 10);
    const unit = match[2] as 'year'|'month'|'day'|'hour'|'minute'|'second';
    return dayjs().subtract(num, unit).fromNow();
  }
  return dateText;
};

export const formatDuration = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "0:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const parseDuration = (iso: string, text: string): number => {
    if (iso) {
        const matches = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (matches) {
            const h = parseInt(matches[1] || '0', 10);
            const m = parseInt(matches[2] || '0', 10);
            const s = parseInt(matches[3] || '0', 10);
            return h * 3600 + m * 60 + s;
        }
    }
    if (text) {
         const parts = text.split(':').map(p => parseInt(p, 10));
         if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
         if (parts.length === 2) return parts[0] * 60 + parts[1];
         if (parts.length === 1) return parts[0];
    }
    return 0;
}

// --- API FETCHER & PLAYER CONFIG ---

const apiFetch = async (endpoint: string) => {
    const response = await fetch(`/api/${endpoint}`);
    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        console.error("Failed to parse JSON response from endpoint:", endpoint, "Response text:", text);
        throw new Error(`Server returned a non-JSON response for endpoint: ${endpoint}`);
    }
    if (!response.ok) {
        throw new Error(data.error || `Request failed for ${endpoint} with status ${response.status}`);
    }
    return data;
};

let playerConfigParams: string | null = null;
export async function getPlayerConfig(): Promise<string> {
    if (playerConfigParams) return playerConfigParams;
    try {
        const response = await fetch('https://raw.githubusercontent.com/siawaseok3/wakame/master/video_config.json');
        const config = await response.json();
        const decodedParams = (config.params || '').replace(/&amp;/g, '&');
        playerConfigParams = decodedParams;
        return playerConfigParams;
    } catch (error) {
        console.error("Error fetching player config:", error);
        return '?autoplay=1&rel=0';
    }
}

// --- DATA MAPPING HELPERS ---
export const mapYoutubeiVideoToVideo = (item: any): Video | null => {
    if (!item) return null;

    // Use a chain of possible ID fields
    const videoId = item.id || item.videoId || item.content_id;
    if (!videoId || typeof videoId !== 'string') return null;

    // --- Title ---
    const title = item.title?.text ?? 
                  item.title?.simpleText ?? 
                  item.metadata?.title?.text ?? 
                  item.title ?? 
                  '無題の動画';

    // --- Thumbnails ---
    const thumbs = item.thumbnails || item.thumbnail || item.content_image;
    let thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`; // Fallback
    if (Array.isArray(thumbs) && thumbs.length > 0) {
        thumbnailUrl = thumbs[0].url;
    } else if (thumbs?.url) {
        thumbnailUrl = thumbs.url;
    }
    if (thumbnailUrl) thumbnailUrl = thumbnailUrl.split('?')[0];

    // --- Duration ---
    // Handle overlays from different item types
    const durationOverlay = (item.thumbnail_overlays || []).find((o: any) => o.type === 'ThumbnailOverlayTimeStatus');
    const duration = item.duration?.text ?? 
                     item.length?.simpleText ?? 
                     durationOverlay?.text ?? 
                     '';
    const isoDuration = `PT${item.duration?.seconds ?? 0}S`;

    // --- Views & Date ---
    let views = '視聴回数不明';
    let uploadedAt = '';

    // Standard path (CompactVideo, etc.)
    if (item.view_count?.text || item.short_view_count?.text) {
        views = item.view_count.text ?? item.short_view_count.text;
    } else if (item.views?.text) {
        views = item.views.text; // ReelItem
    }
    uploadedAt = item.published?.text ?? '';

    // LockupView path
    const metadata_rows = item.metadata?.metadata?.metadata_rows;
    if (Array.isArray(metadata_rows) && metadata_rows.length > 1) {
        // Example: [{"metadata_parts": [{"text": "oricon"}]}, {"metadata_parts": [{"text": "22万 回視聴"}, {"text": "8 年前"}]}]
        if (metadata_rows[1]?.metadata_parts?.[0]?.text?.text) {
            views = metadata_rows[1].metadata_parts[0].text.text;
        }
        if (metadata_rows[1]?.metadata_parts?.[1]?.text?.text) {
            uploadedAt = metadata_rows[1].metadata_parts[1].text.text;
        }
    }

    // --- Channel Info ---
    const author = item.author || item.channel;
    let channelName = author?.name ?? '不明なチャンネル';
    let channelId = author?.id ?? '';
    let channelAvatarUrl = author?.thumbnails?.[0]?.url ?? '';

    // LockupView path for channel name
    if (Array.isArray(metadata_rows) && metadata_rows.length > 0) {
        if (metadata_rows[0]?.metadata_parts?.[0]?.text?.text) {
            channelName = metadata_rows[0].metadata_parts[0].text.text;
        }
    }

    // --- Description ---
    const descriptionSnippet = item.description_snippet?.text ?? '';

    return {
        id: videoId,
        thumbnailUrl: thumbnailUrl,
        duration: duration,
        isoDuration: isoDuration,
        title: title,
        channelName: channelName,
        channelId: channelId,
        channelAvatarUrl: channelAvatarUrl,
        views: views,
        uploadedAt: formatJapaneseDate(uploadedAt),
        descriptionSnippet: descriptionSnippet,
    };
};

const mapYoutubeiChannelToChannel = (item: any): Channel | null => {
    if(!item?.id) return null;
    
    // Robust avatar extraction
    let thumbnails = item.thumbnails || item.author?.thumbnails || item.avatar || [];
    
    // Some API responses put the avatar directly in a 'thumbnail' property (singular)
    if (!Array.isArray(thumbnails) && typeof thumbnails === 'object' && thumbnails.url) {
        thumbnails = [thumbnails];
    }

    let avatarUrl = '';
    if (Array.isArray(thumbnails) && thumbnails.length > 0) {
        // Usually the last one is highest quality, but let's check
        const bestThumb = thumbnails[0]; 
        avatarUrl = bestThumb.url;
        // Clean up URL parameters
        if (avatarUrl) avatarUrl = avatarUrl.split('?')[0];
    }
    
    if (!avatarUrl) {
        avatarUrl = 'https://www.gstatic.com/youtube/img/creator/avatar/default_64.svg';
    }

    return {
        id: item.id,
        name: item.name || item.author?.name || item.title?.text || 'No Name',
        avatarUrl: avatarUrl,
        subscriberCount: item.subscriber_count?.text || item.video_count?.text || ''
    };
}

const mapYoutubeiPlaylistToPlaylist = (item: any): ApiPlaylist | null => {
    if(!item?.id) return null;
    return {
        id: item.id,
        title: item.title?.text || item.title,
        thumbnailUrl: item.thumbnails?.[0]?.url,
        videoCount: parseInt(item.video_count?.text?.replace(/[^0-9]/g, '') || '0'),
        author: item.author?.name,
        authorId: item.author?.id
    };
}


export interface StreamUrls {
    video_url: string;
    audio_url?: string;
}
  
export async function getStreamUrls(videoId: string): Promise<StreamUrls> {
    // FIX: Using correct path param instead of query
    return await apiFetch(`stream/${videoId}`);
}

export async function getRawStreamData(videoId: string): Promise<any> {
    // Enable caching for stream data to save bandwidth, but with shorter TTL (1 hour)
    // as streaming links often expire in 6 hours.
    const cacheKey = `stream-data-${videoId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const data = await apiFetch(`stream/${videoId}`);
    
    // Cache for 1 hour
    cache.set(cacheKey, data, 60 * 60 * 1000);
    return data;
}

// --- HOME TAB TYPES AND FUNCTIONS ---

export const mapHomeVideoToVideo = (homeVideo: HomeVideo, channelData?: Partial<ChannelDetails>): Video => {
    return {
        id: homeVideo.videoId,
        title: homeVideo.title,
        thumbnailUrl: homeVideo.thumbnail || `https://i.ytimg.com/vi/${homeVideo.videoId}/mqdefault.jpg`,
        duration: homeVideo.duration || '',
        isoDuration: '',
        channelName: homeVideo.author || channelData?.name || '',
        channelId: channelData?.id || '',
        channelAvatarUrl: homeVideo.icon || channelData?.avatarUrl || '',
        views: homeVideo.viewCount || '',
        uploadedAt: homeVideo.published || '',
        descriptionSnippet: homeVideo.description || '',
    };
};

export async function getChannelHome(channelId: string): Promise<ChannelHomeData> {
    const cacheKey = `channel-home-${channelId}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) return Promise.resolve(cachedData);

    const useProxy = localStorage.getItem('useChannelHomeProxy') !== 'false';
    
    let data;
    if (useProxy) {
        data = await apiFetch(`channel-home-proxy?id=${channelId}`);
    } else {
        const response = await fetch(`https://siawaseok.duckdns.org/api/channel/${channelId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch channel home data: ${response.status}`);
        }
        data = await response.json();
    }
    cache.set(cacheKey, data);
    return data;
}

// --- EXPORTED API FUNCTIONS ---

export async function getRecommendedVideos(): Promise<{ videos: Video[] }> {
    const data = await apiFetch('fvideo');
    const videos = data.videos?.map(mapYoutubeiVideoToVideo).filter((v): v is Video => v !== null) ?? [];
    return { videos };
}

// Updated searchVideos to accept page token and return filtered results
export async function searchVideos(query: string, pageToken = '1', channelId?: string): Promise<SearchResults> {
    const data = await apiFetch(`search?q=${encodeURIComponent(query)}&page=${pageToken}`);
    
    const videos: Video[] = Array.isArray(data.videos) ? data.videos.map(mapYoutubeiVideoToVideo).filter((v): v is Video => v !== null) : [];
    const shorts: Video[] = Array.isArray(data.shorts) ? data.shorts.map(mapYoutubeiVideoToVideo).filter((v): v is Video => v !== null) : [];
    const channels: Channel[] = Array.isArray(data.channels) ? data.channels.map(mapYoutubeiChannelToChannel).filter((c): c is Channel => c !== null) : [];
    const playlists: ApiPlaylist[] = Array.isArray(data.playlists) ? data.playlists.map(mapYoutubeiPlaylistToPlaylist).filter((p): p is ApiPlaylist => p !== null) : [];

    let filteredVideos = videos;
    if (channelId) {
        filteredVideos = videos.filter(v => v.channelId === channelId);
    }
    return { videos: filteredVideos, shorts, channels, playlists, nextPageToken: data.nextPageToken };
}

export async function getExternalRelatedVideos(videoId: string): Promise<Video[]> {
    try {
        const response = await fetch(`https://siawaseok.duckdns.org/api/video2/${videoId}`);
        if (!response.ok) return [];
        
        // Check if the response is actually JSON before parsing
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
             // If it's not JSON (e.g. 404 page HTML), return empty safely
             return [];
        }

        const data = await response.json();
        
        // Handle various response structures (array, object with items, object with related_videos)
        const items = Array.isArray(data) ? data : (data.items || data.related_videos || []);
        
        return items.map((item: any) => {
            // If item is already in our internal Video format (likely from a previous proxy transformation)
            if (item.id && item.thumbnailUrl && item.channelName) {
                return item as Video;
            }
            // Otherwise map from YoutubeI/raw format
            return mapYoutubeiVideoToVideo(item);
        }).filter((v: any): v is Video => v !== null);
    } catch (e) {
        console.warn("Failed to fetch external related videos silently:", e);
        return [];
    }
}

export async function getVideoDetails(videoId: string): Promise<VideoDetails> {
    const cacheKey = `video-details-${videoId}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) return Promise.resolve(cachedData);

    const data = await apiFetch(`video?id=${videoId}`);
    
    if (data.playability_status?.status !== 'OK' && !data.primary_info) {
        throw new Error(data.playability_status?.reason ?? 'この動画は利用できません。');
    }
    const primary = data.primary_info;
    const secondary = data.secondary_info;
    const basic = data.basic_info;

    // --- 複数チャンネル（コラボレーター）解析ロジック ---
    let collaborators: Channel[] = [];
    let channelId = secondary?.owner?.author?.id ?? '';
    let channelName = secondary?.owner?.author?.name ?? '不明なチャンネル';
    let channelAvatar = secondary?.owner?.author?.thumbnails?.[0]?.url ?? '';
    const subscriberCount = secondary?.owner?.subscriber_count?.text ?? '非公開';

    // メインの著者名が "N/A" または 不明な場合、コラボレーターリストを探す
    if (channelName === 'N/A' || !channelName) {
        try {
            const listItems = secondary?.owner?.author?.endpoint?.payload?.panelLoadingStrategy?.inlineContent?.dialogViewModel?.customContent?.listViewModel?.listItems;
            
            if (Array.isArray(listItems)) {
                collaborators = listItems.map((item: any) => {
                    const vm = item.listItemViewModel;
                    if (!vm) return null;
                    
                    const title = vm.title?.content || '';
                    const avatar = vm.leadingAccessory?.avatarViewModel?.image?.sources?.[0]?.url || '';
                    
                    // channelIdの抽出 (endpoint内または直接)
                    let cId = '';
                    const browseEndpoint = vm.rendererContext?.commandContext?.onTap?.innertubeCommand?.browseEndpoint || 
                                           vm.title?.commandRuns?.[0]?.onTap?.innertubeCommand?.browseEndpoint ||
                                           vm.leadingAccessory?.avatarViewModel?.endpoint?.innertubeCommand?.browseEndpoint;
                                           
                    if (browseEndpoint?.browseId) {
                        cId = browseEndpoint.browseId;
                    }

                    // サブタイトルから登録者数を抽出 (例: "@Nanatsukaze_ • チャンネル登録者数 4.4万人")
                    const subText = vm.subtitle?.content || '';
                    const subCountMatch = subText.match(/チャンネル登録者数\s+(.+)$/);
                    const subCount = subCountMatch ? subCountMatch[1] : '';

                    return {
                        id: cId,
                        name: title,
                        avatarUrl: avatar,
                        subscriberCount: subCount
                    } as Channel;
                }).filter((c: any): c is Channel => c !== null && c.id !== '');

                // コラボレーターが見つかった場合、最初の1人をメインチャンネルとして扱う
                if (collaborators.length > 0) {
                    channelId = collaborators[0].id;
                    channelName = collaborators[0].name;
                    channelAvatar = collaborators[0].avatarUrl;
                }
            }
        } catch (e) {
            console.error("Failed to parse collaborators:", e);
        }
    }

    const channel: Channel = {
        id: channelId,
        name: channelName,
        avatarUrl: channelAvatar,
        subscriberCount: subscriberCount,
    };
    
    let rawRelated = data.watch_next_feed || [];
    if (!rawRelated.length) rawRelated = data.secondary_info?.watch_next_feed || [];
    if (!rawRelated.length) rawRelated = data.related_videos || [];
    if (!rawRelated.length) {
        const overlays = data.player_overlays || data.playerOverlays;
        if (overlays) {
            const endScreen = overlays.end_screen || overlays.endScreen;
            if (endScreen && Array.isArray(endScreen.results)) {
                rawRelated = endScreen.results;
            }
        }
    }

    const relatedVideos = rawRelated
        .map(mapYoutubeiVideoToVideo)
        .filter((v): v is Video => v !== null && v.id.length === 11);

    const details: VideoDetails = {
        id: videoId,
        thumbnailUrl: basic?.thumbnail?.[0]?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: formatDuration(basic?.duration ?? 0),
        isoDuration: `PT${basic?.duration ?? 0}S`,
        title: primary?.title?.text ?? '無題の動画',
        channelName: channel.name,
        channelId: channel.id,
        channelAvatarUrl: channel.avatarUrl,
        views: primary?.view_count?.text ? `${primary.view_count.text}回視聴` : '0回視聴',
        uploadedAt: formatJapaneseDate(primary?.relative_date?.text ?? ''),
        description: secondary?.description?.text?.replace(/\n/g, '<br />') ?? '',
        likes: formatJapaneseNumber(basic?.like_count ?? 0),
        dislikes: '0',
        channel: channel,
        collaborators: collaborators.length > 0 ? collaborators : undefined,
        relatedVideos: relatedVideos,
    };

    cache.set(cacheKey, details);
    return details;
}

export async function getComments(videoId: string): Promise<Comment[]> {
    const data = await apiFetch(`comments?id=${videoId}`);
    return (data.comments as Comment[]) ?? [];
}

export async function getVideosByIds(videoIds: string[]): Promise<Video[]> {
    if (videoIds.length === 0) return [];
    const promises = videoIds.map(id => getVideoDetails(id).catch(err => {
        console.error(`Failed to fetch video ${id}`, err);
        return null;
    }));
    const results = await Promise.all(promises);
    return results.filter((v): v is Video => v !== null);
}

export async function getChannelDetails(channelId: string): Promise<ChannelDetails> {
    const cacheKey = `channel-details-${channelId}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) return Promise.resolve(cachedData);

    const data = await apiFetch(`channel?id=${channelId}`);
    const channel = data.channel;
    if (!channel) throw new Error(`Channel with ID ${channelId} not found.`);

    // FIX: Handle avatarURL correctly whether it is a string (from API normalization) or object/array
    let avatarUrl = '';
    if (typeof channel.avatar === 'string') {
        avatarUrl = channel.avatar;
    } else if (Array.isArray(channel.avatar) && channel.avatar.length > 0) {
        avatarUrl = channel.avatar[0].url;
    } else if (typeof channel.avatar === 'object' && channel.avatar?.url) {
        avatarUrl = channel.avatar.url;
    }

    const details: ChannelDetails = {
        id: channelId,
        name: channel.name ?? 'No Name',
        avatarUrl: avatarUrl,
        subscriberCount: channel.subscriberCount ?? '非公開',
        bannerUrl: channel.banner?.url || channel.banner,
        description: channel.description ?? '',
        videoCount: parseInt(channel.videoCount?.replace(/,/g, '') ?? '0'),
        handle: channel.name,
    };
    cache.set(cacheKey, details);
    return details;
}

export async function getChannelVideos(channelId: string, pageToken = '1'): Promise<{ videos: Video[], nextPageToken?: string }> {
    const page = parseInt(pageToken, 10);
    const data = await apiFetch(`channel?id=${channelId}&page=${page}`);
    
    const channelMeta = data.channel;
    let avatarUrl = '';
    if (channelMeta?.avatar) {
        if (typeof channelMeta.avatar === 'string') {
            avatarUrl = channelMeta.avatar;
        } else if (Array.isArray(channelMeta.avatar) && channelMeta.avatar.length > 0) {
            avatarUrl = channelMeta.avatar[0].url;
        } else if (typeof channelMeta.avatar === 'object' && channelMeta.avatar.url) {
            avatarUrl = channelMeta.avatar.url;
        }
    }

    const videos = data.videos?.map((item: any) => {
        const video = mapYoutubeiVideoToVideo(item);
        if (video) {
            if (channelMeta?.name) video.channelName = channelMeta.name;
            if (channelMeta?.id) video.channelId = channelMeta.id;
            if (avatarUrl) video.channelAvatarUrl = avatarUrl;
        }
        return video;
    }).filter((v): v is Video => v !== null) ?? [];
    
    const hasMore = videos.length > 0;
    return { videos, nextPageToken: hasMore ? String(page + 1) : undefined };
}

export async function getChannelShorts(channelId: string): Promise<{ videos: Video[] }> {
    const data = await apiFetch(`shorts?id=${channelId}`);
    
    // Data can come in different shapes depending on youtubei.js version and channel type
    const contents = data?.current_tab?.content?.contents 
                     || data?.contents?.tabs?.[1]?.content?.contents
                     || [];

    const videos: Video[] = contents.map((item: any) => {
        const lockup = item.content || item.richItem?.content; // Handle both direct content and RichItem wrappers
        if (lockup?.type !== 'ShortsLockupView') return null;

        const videoId = lockup.on_tap?.innertubeCommand?.payload?.videoId;
        if (!videoId) return null;
        
        let thumbnailUrl = lockup.thumbnail?.sources?.[0]?.url || '';
        if (thumbnailUrl) thumbnailUrl = thumbnailUrl.split('?')[0];

        return {
            id: videoId,
            title: lockup.overlay_metadata?.primaryText?.content || 'Untitled Short',
            thumbnailUrl: thumbnailUrl,
            views: lockup.overlay_metadata?.secondaryText?.content || '',
            duration: '', // Shorts cards don't have duration
            isoDuration: '',
            uploadedAt: '', // Not available on shorts card
            channelName: '', // Will be filled in by calling component (ChannelPage)
            channelId: '',
            channelAvatarUrl: '',
        } as Video;
    }).filter((v: Video | null): v is Video => v !== null);

    return { videos };
}

export async function getChannelPlaylists(channelId: string): Promise<{ playlists: ApiPlaylist[] }> {
    const data = await apiFetch(`channel-playlists?id=${channelId}`);
    // Use mapYoutubeiPlaylistToPlaylist for correct data mapping of raw API response
    const playlists: ApiPlaylist[] = (data.playlists || [])
        .map(mapYoutubeiPlaylistToPlaylist)
        .filter((p): p is ApiPlaylist => p !== null);
    return { playlists };
}

export async function getPlaylistDetails(playlistId: string): Promise<PlaylistDetails> {
    const cacheKey = `playlist-details-${playlistId}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) return Promise.resolve(cachedData);

    const data = await apiFetch(`playlist?id=${playlistId}`);
    if (!data.info?.id) throw new Error(`Playlist with ID ${playlistId} not found.`);
    const videos = (data.videos || []).map(mapYoutubeiVideoToVideo).filter((v): v is Video => v !== null);
    
    const details = {
        title: data.info.title,
        author: data.info.author?.name ?? '不明',
        authorId: data.info.author?.id ?? '',
        description: data.info.description ?? '',
        videos: videos
    };

    cache.set(cacheKey, details);
    return details;
}