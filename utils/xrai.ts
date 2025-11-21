
import type { Video, Channel } from '../types';

// --- Types ---

export interface UserProfile {
  keywords: Map<string, number>;
  magnitude: number;
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
  mode?: 'discovery' | 'comfort';
}

// --- Keyword Extraction ---

const JAPANESE_STOP_WORDS = new Set([
  'の', 'に', 'は', 'を', 'が', 'で', 'です', 'ます', 'こと', 'もの', 'これ', 'それ', 'あれ',
  'いる', 'する', 'ある', 'ない', 'から', 'まで', 'と', 'も', 'や', 'など', 'さん', 'ちゃん',
  'about', 'and', 'the', 'to', 'a', 'of', 'in', 'for', 'on', 'with', 'as', 'at', 'movie', 'video',
  'official', 'channel', 'music', 'mv', 'pv', 'tv'
]);

const segmenter = (typeof Intl !== 'undefined' && (Intl as any).Segmenter) 
    ? new (Intl as any).Segmenter('ja', { granularity: 'word' }) 
    : null;

const extractKeywords = (text: string): string[] => {
  if (!text) return [];
  const cleanedText = text.toLowerCase();
  let words: string[] = [];

  if (segmenter) {
      const segments = segmenter.segment(cleanedText);
      for (const segment of segments) {
          if (segment.isWordLike) words.push(segment.segment);
      }
  } else {
      words = cleanedText.replace(/[\p{S}\p{P}\p{Z}\p{C}]/gu, ' ').split(/\s+/).filter(w => w.length > 0);
  }

  return Array.from(new Set(words.filter(word => {
    if (word.length <= 1 && !/^[a-zA-Z0-9]$/.test(word)) return false;
    if (JAPANESE_STOP_WORDS.has(word)) return false;
    if (/^\d+$/.test(word)) return false; 
    return true;
  })));
};

const containsJapanese = (text: string): boolean => {
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
};

const calculateMagnitude = (vector: Map<string, number>): number => {
    let sumSq = 0;
    for (const val of vector.values()) sumSq += val * val;
    return Math.sqrt(sumSq);
};

// --- User Profile Construction ---

export const buildUserProfile = (sources: UserSources): UserProfile => {
  const keywords = new Map<string, number>();

  const addKeywords = (text: string, weight: number) => {
    extractKeywords(text).forEach(kw => {
      keywords.set(kw, (keywords.get(kw) || 0) + weight);
    });
  };

  // Recent searches have high intent
  sources.searchHistory.slice(0, 30).forEach((term, index) => {
    addKeywords(term, 8.0 * Math.exp(-index / 10)); 
  });

  // Watch history (Implicit feedback)
  sources.watchHistory.slice(0, 50).forEach((video, index) => {
    const recencyWeight = 5.0 * Math.exp(-index / 15);
    addKeywords(video.title, recencyWeight);
    addKeywords(video.channelName, recencyWeight * 1.5);
  });

  // Subscriptions (Explicit feedback)
  sources.subscribedChannels.forEach(channel => {
    addKeywords(channel.name, 3.0);
  });
  
  return { keywords, magnitude: calculateMagnitude(keywords) };
};

export const inferTopInterests = (profile: UserProfile, limit: number = 6): string[] => {
    return [...profile.keywords.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(e => e[0])
        .slice(0, limit);
};

// --- Feature Engineering (Based on PDF) ---

// 1. Example Age (Freshness)
// The PDF states freshness is crucial. The model fits to the upload time distribution.
// We simulate this with a decay function that favors new content but doesn't kill evergreen content.
const calculateFreshnessBias = (uploadedAt: string): number => {
    if (!uploadedAt) return 0.5;
    const text = uploadedAt.toLowerCase();
    const numMatch = text.match(/(\d+)/);
    const num = numMatch ? parseInt(numMatch[1], 10) : 0;
    
    let daysAgo = 365;
    if (text.includes('分') || text.includes('min')) daysAgo = 0;
    else if (text.includes('時間') || text.includes('hour')) daysAgo = num / 24;
    else if (text.includes('日') || text.includes('day')) daysAgo = num;
    else if (text.includes('週') || text.includes('week')) daysAgo = num * 7;
    else if (text.includes('月') || text.includes('month')) daysAgo = num * 30;
    else if (text.includes('年') || text.includes('year')) daysAgo = num * 365;

    // Gaussian-like decay: High for recent, slow tail for older
    // e.g. 0 days = 1.0, 7 days = ~0.8, 30 days = ~0.5, 1 year = ~0.1
    return Math.exp(-0.02 * daysAgo); 
};

// 2. Predicted Watch Time Proxy
// The PDF's objective function is "Expected Watch Time".
// We don't have the model, so we approximate: Duration * (Probability of Watching)
// Probability is inferred from: Views (Social Proof) + Likes + Relevance
const parseDurationSeconds = (iso: string, text: string): number => {
    if (iso) {
        const matches = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (matches) {
            return (parseInt(matches[1]||'0')*3600) + (parseInt(matches[2]||'0')*60) + parseInt(matches[3]||'0');
        }
    }
    if (text) {
         const parts = text.split(':').map(p => parseInt(p, 10));
         if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
         if (parts.length === 2) return parts[0] * 60 + parts[1];
    }
    return 600; // Default 10 mins
};

const parseViewCount = (viewStr: string): number => {
    if (!viewStr) return 0;
    let mult = 1;
    if (viewStr.includes('万')) mult = 10000;
    else if (viewStr.includes('億')) mult = 100000000;
    else if (viewStr.toUpperCase().includes('K')) mult = 1000;
    else if (viewStr.toUpperCase().includes('M')) mult = 1000000;
    const num = parseFloat(viewStr.match(/(\d+(\.\d+)?)/)?.[0] || '0');
    return num * mult;
};

// --- Ranking Logic ---

export const rankVideos = (
  videos: Video[],
  userProfile: UserProfile,
  context: ScoringContext
): Video[] => {
  const scoredVideos: { video: Video; score: number }[] = [];

  for (const video of videos) {
    if (!video?.id) continue;
    
    const fullText = `${video.title} ${video.channelName} ${video.descriptionSnippet || ''}`.toLowerCase();
    
    // Hard Filters (Safety)
    if (context.ngKeywords.some(ng => fullText.includes(ng.toLowerCase()))) continue;
    if (context.ngChannels.includes(video.channelId)) continue;
    
    // Language Bias
    if (!containsJapanese(fullText)) {
         // Heavy penalty for non-Japanese unless explicitly searched
         continue; 
    }

    // --- Feature 1: Semantic Relevance (Cosine Similarity) ---
    // Represents "p(click)" to some extent
    let dotProduct = 0;
    let videoVecMagSq = 0;
    const videoKeywords = extractKeywords(fullText);
    
    videoKeywords.forEach(kw => {
        const weight = 1; // TF could be improved
        videoVecMagSq += weight * weight;
        if (userProfile.keywords.has(kw)) {
            dotProduct += userProfile.keywords.get(kw)! * weight;
        }
    });

    let relevance = 0;
    if (userProfile.magnitude > 0 && videoVecMagSq > 0) {
        relevance = dotProduct / (userProfile.magnitude * Math.sqrt(videoVecMagSq));
    }

    // --- Feature 2: Freshness (Example Age) ---
    const freshness = calculateFreshnessBias(video.uploadedAt);

    // --- Feature 3: Engagement / Popularity ---
    // Represents global probability of being good
    const views = parseViewCount(video.views);
    // Log normalization for views (diminishing returns)
    const popularity = Math.log10(views + 1) / 10; // Roughly 0.0 to 1.0

    // --- Feature 4: Estimated Video Length Value ---
    // PDF emphasizes "Watch Time". Longer videos (if relevant) yield more watch time.
    // However, very short videos (clickbait) are penalized in main recs.
    const durationSec = parseDurationSeconds(video.isoDuration, video.duration);
    let durationScore = 1.0;
    if (durationSec < 60) durationScore = 0.6; // Penalize shorts in main feed
    else if (durationSec > 600) durationScore = 1.2; // Boost long form slightly

    // --- Final Score Calculation (Weighted Logistic Regression Simulation) ---
    // Score = (Relevance * W1) * (Freshness * W2) * (Popularity * W3) * DurationMod
    
    // Base Score
    let score = (relevance * 5.0) + (freshness * 2.0) + (popularity * 1.0);
    
    // Multiplicative Boosts
    score *= durationScore;

    // Collaborative Filtering Simulation Boost
    // If the video's channel matches a channel in recent history, boost significantly
    if (context.watchHistory.some(w => w.channelId === video.channelId)) {
        score *= 1.3;
    }

    // Random noise for exploration (epsilon-greedy)
    score *= (0.95 + Math.random() * 0.1);

    scoredVideos.push({ video, score });
  }

  // Sort by Final Score (Predicted Value)
  scoredVideos.sort((a, b) => b.score - a.score);

  // Diversity Filter: Don't show too many from same channel
  const finalRanked: Video[] = [];
  const channelCounts = new Map<string, number>();
  const MAX_PER_CHANNEL = 2;

  for (const { video } of scoredVideos) {
    const count = channelCounts.get(video.channelId) || 0;
    if (count < MAX_PER_CHANNEL) {
      finalRanked.push(video);
      channelCounts.set(video.channelId, count + 1);
    }
  }

  return finalRanked;
};
