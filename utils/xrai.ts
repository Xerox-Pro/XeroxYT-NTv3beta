
import type { Video, Channel } from '../types';

// --- Types ---

interface UserProfile {
  keywords: Map<string, number>;
}

interface UserSources {
  watchHistory: Video[];
  searchHistory: string[];
  subscribedChannels: Channel[];
}

interface ScoringContext {
  ngKeywords: string[];
  ngChannels: string[];
  watchHistory: Video[];
}

// --- Keyword Extraction (Simple Version) ---

const JAPANESE_STOP_WORDS = new Set([
  'の', 'に', 'は', 'を', 'が', 'で', 'です', 'ます', 'こと', 'もの', 'これ', 'それ', 'あれ',
  'いる', 'する', 'ある', 'ない', 'から', 'まで', 'と', 'も', 'や', 'など', 'さん', 'ちゃん'
]);
const ENGLISH_STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of',
  'it', 'you', 'he', 'she', 'they', 'we', 'i', 'and', 'or', 'but', 'by', 'with'
]);

const extractKeywords = (text: string): string[] => {
  if (!text) return [];
  const cleanedText = text
    .toLowerCase()
    .replace(/[\p{S}\p{P}\p{Z}\p{C}]/gu, ' ') 
    .replace(/[\[\]\(\)【】『』「」・、。!?#]/g, ' ');

  const words = cleanedText.split(/\s+/).filter(word => word.length > 1);

  const keywords = words.filter(word => {
    if (JAPANESE_STOP_WORDS.has(word) || ENGLISH_STOP_WORDS.has(word)) {
      return false;
    }
    if (/^\d+$/.test(word)) {
      return false;
    }
    return true;
  });

  return Array.from(new Set(keywords));
};

// --- User Profile Builder ---

export const buildUserProfile = (sources: UserSources): UserProfile => {
  const keywords = new Map<string, number>();

  const addKeywords = (text: string, weight: number) => {
    extractKeywords(text).forEach(kw => {
      keywords.set(kw, (keywords.get(kw) || 0) + weight);
    });
  };

  sources.searchHistory.forEach((term, index) => {
    const weight = 3.0 * Math.exp(-index / 5); // 最近の検索ほど指数関数的に高い評価
    addKeywords(term, weight);
  });

  sources.watchHistory.forEach((video, index) => {
    const weight = 2.0 * Math.exp(-index / 10); // 最近の視聴ほど高い評価
    addKeywords(video.title, weight);
    addKeywords(video.channelName, weight * 0.8);
    addKeywords(video.descriptionSnippet || '', weight * 0.5);
  });

  sources.subscribedChannels.forEach(channel => {
    addKeywords(channel.name, 1.5);
  });
  
  return { keywords };
};

// --- Scoring and Ranking ---

const parseUploadedAt = (uploadedAt: string): number => {
    if (!uploadedAt) return 999;
    const text = uploadedAt.toLowerCase();
    const numMatch = text.match(/(\d+)/);
    const num = numMatch ? parseInt(numMatch[1], 10) : 0;

    if (text.includes('分前') || text.includes('時間前')) return 0;
    if (text.includes('日前')) return num;
    if (text.includes('週間前')) return num * 7;
    if (text.includes('か月前')) return num * 30;
    if (text.includes('年前')) return num * 365;
    return 999; // パース不能 or 古い
};

export const rankVideos = (
  videos: Video[],
  userProfile: UserProfile,
  context: ScoringContext
): Video[] => {
  const scoredVideos: { video: Video; score: number }[] = [];
  const seenIds = new Set<string>(context.watchHistory.map(v => v.id));

  for (const video of videos) {
    if (!video || !video.id || seenIds.has(video.id)) continue;
    
    const fullText = `${video.title} ${video.channelName} ${video.descriptionSnippet || ''}`.toLowerCase();

    if (context.ngKeywords.some(ng => fullText.includes(ng.toLowerCase()))) continue;
    if (context.ngChannels.includes(video.channelId)) continue;
    
    // 1. 関連度スコア (Relevance)
    let relevanceScore = 0;
    const videoKeywords = new Set(extractKeywords(fullText));
    videoKeywords.forEach(kw => {
      if (userProfile.keywords.has(kw)) {
        relevanceScore += userProfile.keywords.get(kw)!;
      }
    });

    // 2. 人気度スコア (Popularity)
    const views = parseInt(video.views.replace(/[^0-9]/g, ''), 10);
    const popularityScore = !isNaN(views) ? Math.log10(views + 1) : 0;

    // 3. 鮮度スコア (Freshness)
    const daysAgo = parseUploadedAt(video.uploadedAt);
    const freshnessScore = Math.max(0, 1.0 - (daysAgo / 60)) * 5; // 直近2ヶ月以内の動画にボーナス

    // 4. 最終スコア計算 (重み付け)
    const finalScore = (relevanceScore * 1.5) + (popularityScore * 0.3) + (freshnessScore * 1.0);
    
    scoredVideos.push({ video, score: finalScore });
    seenIds.add(video.id);
  }

  scoredVideos.sort((a, b) => b.score - a.score);

  // 5. 多様性の確保 (Diversity)
  const finalRankedList: Video[] = [];
  const channelCount = new Map<string, number>();
  const MAX_FROM_SAME_CHANNEL = 3;

  for (const { video } of scoredVideos) {
    const count = channelCount.get(video.channelId) || 0;
    if (count < MAX_FROM_SAME_CHANNEL) {
      finalRankedList.push(video);
      channelCount.set(video.channelId, count + 1);
    }
  }

  return finalRankedList;
};
