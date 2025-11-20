import type { Video, VideoDetails, Channel, ChannelDetails, ApiPlaylist, Comment, PlaylistDetails, SearchResults, HomeVideo, HomePlaylist, ChannelHomeData } from '../types';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import relativeTime from 'dayjs/plugin/relativeTime';

// Day.jsの日本語化と相対時間プラグインの有効化
dayjs.extend(relativeTime);
dayjs.locale('ja');

// --- HELPER FUNCTIONS ---

const formatJapaneseNumber = (raw: number | string): string => {
  const num = typeof raw === 'string' ? parseInt(raw.replace(/,/g, ''), 10) : raw;
  if (isNaN(num)) return '0';
  if (num >= 100000000) return `${(num / 100000000).toFixed(1).replace('.0', '')}億`;
  if (num >= 10000) return `${(num / 10000).toFixed(1).replace('.0', '')}万`;
  return num.toLocaleString();
};

const formatJapaneseDate = (dateText: string): string => {
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

const formatDuration = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "0:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

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
const mapYoutubeiVideoToVideo = (item: any): Video | null => {
    if (!item?.id) return null;
    
    let views = '視聴回数不明';
    if (item.view_count?.text) {
        views = `${formatJapaneseNumber(item.view_count.text)}回視聴`;
    } else if (item.short_view_count?.text) {
        views = item.short_view_count.text;
    } else if (item.views?.text) {
        // Handle ReelItem shorts views
        views = item.views.text;
    }

    return {
        id: item.id,
        thumbnailUrl: item.thumbnails?.[0]?.url.split('?')[0] ?? `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        duration: item.duration?.text ?? '',
        isoDuration: `PT${item.duration?.seconds ?? 0}S`,
        title: item.title?.text ?? item.title ?? '無題の動画',
        channelName: item.author?.name ?? item.channel?.name ?? '不明なチャンネル',
        channelId: item.author?.id ?? item.channel?.id ?? '',
        channelAvatarUrl: item.author?.thumbnails?.[0]?.url ?? item.channel?.thumbnails?.[0]?.url ?? '',
        views: views,
        uploadedAt: formatJapaneseDate(item.published?.text ?? ''),
        descriptionSnippet: item.description_snippet?.text ?? '',
    };
};

const mapYoutubeiChannelToChannel = (item: any): Channel | null => {
    if(!item?.id) return null;
    return {
        id: item.id,
        name: item.name || item.author?.name || 'No Name',
        avatarUrl: item.thumbnails?.[0]?.url || '',
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
    return await apiFetch(`stream?id=${videoId}`);
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
    const useProxy = localStorage.getItem('useChannelHomeProxy') !== 'false';
    
    if (useProxy) {
        return await apiFetch(`channel-home-proxy?id=${channelId}`);
    } else {
        const response = await fetch(`https://siawaseok.duckdns.org/api/channel/${channelId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch channel home data: ${response.status}`);
        }
        return await response.json();
    }
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

export async function getVideoDetails(videoId: string): Promise<VideoDetails> {
    const data = await apiFetch(`video?id=${videoId}`);
    
    if (data.playability_status?.status !== 'OK' && !data.primary_info) {
        throw new Error(data.playability_status?.reason ?? 'この動画は利用できません。');
    }
    const primary = data.primary_info;
    const secondary = data.secondary_info;
    const basic = data.basic_info;

    const channel: Channel = {
        id: secondary?.owner?.author?.id ?? '',
        name: secondary?.owner?.author?.name ?? '不明なチャンネル',
        avatarUrl: secondary?.owner?.author?.thumbnails?.[0]?.url ?? '',
        subscriberCount: secondary?.owner?.subscriber_count?.text ?? '非公開',
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

    return {
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
        relatedVideos: relatedVideos,
    };
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

    return {
        id: channelId,
        name: channel.name ?? 'No Name',
        avatarUrl: avatarUrl,
        subscriberCount: channel.subscriberCount ?? '非公開',
        bannerUrl: channel.banner?.url || channel.banner,
        description: channel.description ?? '',
        videoCount: parseInt(channel.videoCount?.replace(/,/g, '') ?? '0'),
        handle: channel.name,
    };
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
    const data = await apiFetch(`channel-shorts?id=${channelId}`);
    const videos: Video[] = Array.isArray(data) ? data.map(mapYoutubeiVideoToVideo).filter((v): v is Video => v !== null) : [];
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
    const data = await apiFetch(`playlist?id=${playlistId}`);
    if (!data.info?.id) throw new Error(`Playlist with ID ${playlistId} not found.`);
    const videos = (data.videos || []).map(mapYoutubeiVideoToVideo).filter((v): v is Video => v !== null);
    return {
        title: data.info.title,
        author: data.info.author?.name ?? '不明',
        authorId: data.info.author?.id ?? '',
        description: data.info.description ?? '',
        videos: videos
    };
}