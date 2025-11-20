import express from "express";
import { Innertube } from "youtubei.js";

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// 動画詳細 API (/api/video)
app.get('/api/video', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing video id" });

    const info = await youtube.getInfo(id);

    // 関連動画を最大50件取得するロジック
    let allCandidates = [];
    
    const addCandidates = (source) => {
        if (Array.isArray(source)) {
            allCandidates.push(...source);
        }
    };

    addCandidates(info.watch_next_feed);
    addCandidates(info.related_videos);
    if (info.secondary_info) {
        addCandidates(info.secondary_info.watch_next_feed);
    }
    addCandidates(info.related);

    const overlays = info.player_overlays || info.playerOverlays;
    if (overlays) {
        const endScreen = overlays.end_screen || overlays.endScreen;
        if (endScreen && Array.isArray(endScreen.results)) {
            addCandidates(endScreen.results);
        }
    }

    const relatedVideos = [];
    const seenIds = new Set();
    const MAX_VIDEOS = 50;

    for (const video of allCandidates) {
        if (relatedVideos.length >= MAX_VIDEOS) break;
        if (!video) continue;
        const videoId = video.id || video.videoId;
        if (typeof videoId === 'string' && videoId.length === 11 && !seenIds.has(videoId)) {
            seenIds.add(videoId);
            relatedVideos.push(video);
        }
    }

    let continuationCount = 0;
    while (relatedVideos.length < MAX_VIDEOS && continuationCount < 5) {
        try {
            if (typeof info.getWatchNextContinuation === 'function') {
                const nextInfo = await info.getWatchNextContinuation();
                if (nextInfo && Array.isArray(nextInfo.watch_next_feed)) {
                    let addedCount = 0;
                    for (const video of nextInfo.watch_next_feed) {
                        if (relatedVideos.length >= MAX_VIDEOS) break;
                        const videoId = video.id || video.videoId;
                        if (typeof videoId === 'string' && videoId.length === 11 && !seenIds.has(videoId)) {
                            seenIds.add(videoId);
                            relatedVideos.push(video);
                            addedCount++;
                        }
                    }
                    if (addedCount === 0) break;
                } else {
                    break; 
                }
            } else {
                break; 
            }
        } catch (e) {
            console.log('Failed to fetch continuation:', e.message);
            break;
        }
        continuationCount++;
    }

    info.watch_next_feed = relatedVideos;
    if (info.secondary_info) info.secondary_info.watch_next_feed = [];
    info.related_videos = [];
    info.related = [];

    res.status(200).json(info);
    
  } catch (err) {
    console.error('Error in /api/video:', err);
    res.status(500).json({ error: err.message });
  }
});

// 検索 API (/api/search) - カテゴリ分け対応
app.get('/api/search', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const { q: query } = req.query;
    if (!query) return res.status(400).json({ error: "Missing search query" });

    const search = await youtube.search(query);
    
    // youtubei.js の search 結果は getter で各タイプを取得可能
    // ただしバージョンによって挙動が違うため、念のため安全に取得する
    
    const videos = search.videos || [];
    const shorts = search.shorts || [];
    const channels = search.channels || [];
    const playlists = search.playlists || [];

    // 一部の動画を追加取得（ページネーションは動画メインで行うが、今回は初回ロードでカテゴリを分ける）
    // 必要であればここで search.getContinuation() を呼んで動画を増やすことも可能だが、
    // UX向上のため、まずは各カテゴリの初期結果を返す

    res.status(200).json({
        videos,
        shorts,
        channels,
        playlists
    });
  } catch (err) { 
      console.error('Error in /api/search:', err); 
      res.status(500).json({ error: err.message }); 
  }
});

// -------------------------------------------------------------------
// その他のAPI
// -------------------------------------------------------------------
app.get('/api/comments', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing video id" });
    const limit = 300;
    let commentsSection = await youtube.getComments(id);
    let allComments = commentsSection.contents || [];
    while (allComments.length < limit && commentsSection.has_continuation) {
      commentsSection = await commentsSection.getContinuation();
      allComments = allComments.concat(commentsSection.contents);
    }
    res.status(200).json({
      comments: allComments.slice(0, limit).map(c => ({
        text: c.comment?.content?.text ?? null, comment_id: c.comment?.comment_id ?? null, published_time: c.comment?.published_time ?? null,
        author: { id: c.comment?.author?.id ?? null, name: c.comment?.author?.name ?? null, thumbnails: c.comment?.author?.thumbnails ?? [] },
        like_count: c.comment?.like_count?.toString() ?? '0', reply_count: c.comment?.reply_count?.toString() ?? '0', is_pinned: c.comment?.is_pinned ?? false
      }))
    });
  } catch (err) { console.error('Error in /api/comments:', err); res.status(500).json({ error: err.message }); }
});
app.get('/api/channel', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const { id, page = '1' } = req.query;
    if (!id) return res.status(400).json({ error: "Missing channel id" });
    const channel = await youtube.getChannel(id);
    let videosFeed = await channel.getVideos();
    for (let i = 1; i < parseInt(page); i++) {
      if (videosFeed.has_continuation) {
        videosFeed = await videosFeed.getContinuation();
      } else {
        videosFeed.videos = [];
        break;
      }
    }
    
    // Extract metadata with fallbacks
    const title = channel.metadata?.title || channel.header?.title?.text || null;
    const avatar = channel.metadata?.avatar || channel.header?.avatar || null;
    const banner = channel.metadata?.banner || channel.header?.banner || null;

    res.status(200).json({
      channel: {
        id: channel.id, 
        name: title, 
        description: channel.metadata?.description || null,
        avatar: avatar, 
        banner: banner,
        subscriberCount: channel.metadata?.subscriber_count?.pretty || '非公開', 
        videoCount: channel.metadata?.videos_count?.text ?? channel.metadata?.videos_count ?? '0'
      },
      page: parseInt(page), 
      videos: videosFeed.videos || []
    });
  } catch (err) { console.error('Error in /api/channel:', err); res.status(500).json({ error: err.message }); }
});
app.get('/api/channel-shorts', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing channel id" });
    const channel = await youtube.getChannel(id);
    const shorts = await channel.getShorts();
    res.status(200).json(shorts.videos);
  } catch (err) { console.error('Error in /api/channel-shorts:', err); res.status(500).json({ error: err.message }); }
});
app.get('/api/channel-playlists', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing channel id" });
    const channel = await youtube.getChannel(id);
    const playlists = await channel.getPlaylists();
    res.status(200).json(playlists);
  } catch (err) { console.error('Error in /api/channel-playlists:', err); res.status(500).json({ error: err.message }); }
});
app.get('/api/playlist', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const { id: playlistId } = req.query;
    if (!playlistId) return res.status(400).json({ error: "Missing playlist id" });
    const playlist = await youtube.getPlaylist(playlistId);
    if (!playlist.info?.id) return res.status(404).json({ error: "Playlist not found"});
    res.status(200).json(playlist);
  } catch (err) { console.error('Error in /api/playlist:', err); res.status(500).json({ error: err.message }); }
});
app.get('/api/fvideo', async (req, res) => {
  try {
    const youtube = await Innertube.create({ lang: "ja", location: "JP" });
    const trending = await youtube.getTrending("Music");
    res.status(200).json(trending);
  } catch (err) { console.error('Error in /api/fvideo:', err); res.status(500).json({ error: err.message }); }
});

export default app;