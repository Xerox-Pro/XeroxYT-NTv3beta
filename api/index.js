import express from "express";
import { Innertube } from "youtubei.js";

const app = express();

// CORS設定
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// YouTubeクライアントの作成ヘルパー
const createYoutube = async () => {
  return await Innertube.create({ 
    lang: "ja", 
    location: "JP",
  });
};

// -------------------------------------------------------------------
// 動画詳細 API (/api/video)
// -------------------------------------------------------------------
app.get('/api/video', async (req, res) => {
  try {
    const youtube = await createYoutube();
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing video id" });

    const info = await youtube.getInfo(id);

    // 関連動画取得ロジック
    let allCandidates = [];
    
    const addCandidates = (source) => {
        if (Array.isArray(source)) allCandidates.push(...source);
    };

    addCandidates(info.watch_next_feed);
    addCandidates(info.related_videos);
    
    try {
      let continuationCount = 0;
      let currentFeed = info; 
      const seenIds = new Set();
      const relatedVideos = [];
      const MAX_VIDEOS = 50;

      for (const video of allCandidates) {
         if(video.id) seenIds.add(video.id);
         relatedVideos.push(video);
      }

      while (relatedVideos.length < MAX_VIDEOS && continuationCount < 2) {
          if (typeof currentFeed.getWatchNextContinuation === 'function') {
              currentFeed = await currentFeed.getWatchNextContinuation();
              if (currentFeed && Array.isArray(currentFeed.watch_next_feed)) {
                  for (const video of currentFeed.watch_next_feed) {
                      if (relatedVideos.length >= MAX_VIDEOS) break;
                      if (video.id && !seenIds.has(video.id)) {
                          seenIds.add(video.id);
                          relatedVideos.push(video);
                      }
                  }
              }
          } else {
              break;
          }
          continuationCount++;
      }
      info.watch_next_feed = relatedVideos;

    } catch (e) {
      console.warn('[API] Continuation failed, returning basic info:', e.message);
    }

    if (info.secondary_info) info.secondary_info.watch_next_feed = [];
    info.related_videos = [];
    info.related = [];

    res.status(200).json(info);
    
  } catch (err) {
    console.error('Error in /api/video:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------------
// 検索 API (/api/search)
// -------------------------------------------------------------------
app.get('/api/search', async (req, res) => {
  try {
    const youtube = await createYoutube();
    const { q: query, page = '1' } = req.query;
    if (!query) return res.status(400).json({ error: "Missing search query" });

    const targetPage = parseInt(page);
    const ITEMS_PER_PAGE = 50; // ユーザーリクエストにより50件に設定
    
    let search = await youtube.search(query);
    
    let allVideos = [...(search.videos || [])];
    let allShorts = [...(search.shorts || [])];
    let allChannels = [...(search.channels || [])];
    let allPlaylists = [...(search.playlists || [])];

    // 指定ページ分までデータを確保するために続きを取得
    const requiredCount = targetPage * ITEMS_PER_PAGE;
    
    let continuationAttempts = 0;
    // 50件ずつ取得しようとすると回数が必要になるため、制限を緩める
    const MAX_ATTEMPTS = 20;

    while (allVideos.length < requiredCount && search.has_continuation && continuationAttempts < MAX_ATTEMPTS) {
        search = await search.getContinuation();
        if (search.videos) allVideos.push(...search.videos);
        if (search.shorts) allShorts.push(...search.shorts);
        if (search.channels) allChannels.push(...search.channels);
        if (search.playlists) allPlaylists.push(...search.playlists);
        continuationAttempts++;
    }

    const startIndex = (targetPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;

    const pagedVideos = allVideos.slice(startIndex, endIndex);
    
    // 2ページ目以降は動画のみ返す（重複防止とパフォーマンスのため）
    const pagedShorts = targetPage === 1 ? allShorts : [];
    const pagedChannels = targetPage === 1 ? allChannels : [];
    const pagedPlaylists = targetPage === 1 ? allPlaylists : [];

    // まだ動画が残っているか、続きが取得可能なら次ページありとする
    const hasMore = allVideos.length > endIndex || search.has_continuation;

    res.status(200).json({
        videos: pagedVideos,
        shorts: pagedShorts,
        channels: pagedChannels,
        playlists: pagedPlaylists,
        nextPageToken: hasMore ? String(targetPage + 1) : undefined
    });
  } catch (err) { 
      console.error('Error in /api/search:', err); 
      res.status(500).json({ error: err.message }); 
  }
});

// -------------------------------------------------------------------
// コメント API (/api/comments)
// -------------------------------------------------------------------
app.get('/api/comments', async (req, res) => {
  try {
    const youtube = await createYoutube();
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing video id" });
    
    const limit = 300;
    let commentsSection = await youtube.getComments(id);
    let allComments = commentsSection.contents || [];
    
    let attempts = 0;
    while (allComments.length < limit && commentsSection.has_continuation && attempts < 5) {
      commentsSection = await commentsSection.getContinuation();
      if (commentsSection.contents) {
        allComments = allComments.concat(commentsSection.contents);
      }
      attempts++;
    }

    res.status(200).json({
      comments: allComments.slice(0, limit).map(c => ({
        text: c.comment?.content?.text ?? null,
        comment_id: c.comment?.comment_id ?? null,
        published_time: c.comment?.published_time?.text ?? c.comment?.published_time ?? null,
        author: { 
            id: c.comment?.author?.id ?? null, 
            name: c.comment?.author?.name?.text ?? c.comment?.author?.name ?? null, 
            thumbnails: c.comment?.author?.thumbnails ?? [] 
        },
        like_count: c.comment?.like_count?.toString() ?? '0',
        reply_count: c.comment?.reply_count?.toString() ?? '0',
        is_pinned: c.comment?.is_pinned ?? false
      }))
    });
  } catch (err) { 
    console.error('Error in /api/comments:', err); 
    res.status(500).json({ error: err.message }); 
  }
});

// -------------------------------------------------------------------
// チャンネル API (/api/channel)
// -------------------------------------------------------------------
app.get('/api/channel', async (req, res) => {
  try {
    const youtube = await createYoutube();
    const { id, page = '1' } = req.query;
    if (!id) return res.status(400).json({ error: "Missing channel id" });

    const channel = await youtube.getChannel(id);
    
    let videosFeed = await channel.getVideos();
    let videosToReturn = videosFeed.videos || [];

    const targetPage = parseInt(page);
    
    // ページネーションロジック修正: 
    // 指定されたページの動画「のみ」を取得して返すように変更
    // 以前は全ページの動画を累積して返していたため、重複が発生していた
    if (targetPage > 1) {
        for (let i = 1; i < targetPage; i++) {
            if (videosFeed.has_continuation) {
                videosFeed = await videosFeed.getContinuation();
                videosToReturn = videosFeed.videos || [];
            } else {
                videosToReturn = []; // 続きがない場合
                break;
            }
        }
    }
    
    const title = channel.metadata?.title || channel.header?.title?.text || channel.header?.author?.name || null;
    let avatar = channel.metadata?.avatar || channel.header?.avatar || channel.header?.author?.thumbnails || null;
    
    if (Array.isArray(avatar) && avatar.length > 0) {
        avatar = avatar[0].url;
    } else if (typeof avatar === 'object' && avatar?.url) {
        avatar = avatar.url;
    }

    // バナー抽出ロジックの強化
    let banner = channel.metadata?.banner || channel.header?.banner || null;
    if (Array.isArray(banner) && banner.length > 0) {
        banner = banner[0].url;
    } else if (typeof banner === 'object' && banner?.url) {
        banner = banner.url;
    } else if (typeof banner !== 'string') {
        banner = null; 
    }

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
      page: targetPage, 
      videos: videosToReturn,
      nextPageToken: videosFeed.has_continuation ? String(targetPage + 1) : undefined
    });

  } catch (err) { 
      console.error('Error in /api/channel:', err); 
      res.status(500).json({ error: err.message }); 
  }
});

// -------------------------------------------------------------------
// チャンネルホーム Proxy API (/api/channel-home-proxy)
// -------------------------------------------------------------------
app.get('/api/channel-home-proxy', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing channel id" });

    // 外部APIからデータを取得
    const response = await fetch(`https://siawaseok.duckdns.org/api/channel/${id}`);
    if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch from external API" });
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
      console.error('Error in /api/channel-home-proxy:', err);
      res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------------
// チャンネル Shorts API (/api/channel-shorts)
// -------------------------------------------------------------------
app.get('/api/channel-shorts', async (req, res) => {
  try {
    const youtube = await createYoutube();
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing channel id" });

    const channel = await youtube.getChannel(id);
    const shortsFeed = await channel.getShorts();
    
    let shorts = [];
    
    if (shortsFeed.videos) {
        shorts = shortsFeed.videos;
    } else if (shortsFeed.contents && Array.isArray(shortsFeed.contents)) {
        const tabContent = shortsFeed.contents[0];
        if (tabContent && tabContent.contents) {
            shorts = tabContent.contents;
        }
    }

    res.status(200).json(shorts);
  } catch (err) { 
      console.error('Error in /api/channel-shorts:', err); 
      res.status(500).json({ error: err.message }); 
  }
});

// -------------------------------------------------------------------
// チャンネル Playlists API (/api/channel-playlists)
// -------------------------------------------------------------------
app.get('/api/channel-playlists', async (req, res) => {
  try {
    const youtube = await createYoutube();
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing channel id" });

    const channel = await youtube.getChannel(id);
    const playlistsFeed = await channel.getPlaylists();
    
    let playlists = [];
    
    if (playlistsFeed.playlists) {
        playlists = playlistsFeed.playlists;
    } 
    else if (playlistsFeed.items) {
        playlists = playlistsFeed.items;
    }
    else if (playlistsFeed.contents && Array.isArray(playlistsFeed.contents)) {
        const tabContent = playlistsFeed.contents[0];
        if (tabContent && tabContent.contents) {
             playlists = tabContent.contents;
        }
    }

    res.status(200).json({ playlists: playlists });
  } catch (err) { 
      console.error('Error in /api/channel-playlists:', err); 
      res.status(500).json({ error: err.message }); 
  }
});

// -------------------------------------------------------------------
// 再生リスト API (/api/playlist)
// -------------------------------------------------------------------
app.get('/api/playlist', async (req, res) => {
  try {
    const youtube = await createYoutube();
    const { id: playlistId } = req.query;
    if (!playlistId) return res.status(400).json({ error: "Missing playlist id" });

    const playlist = await youtube.getPlaylist(playlistId);
    if (!playlist.info?.id) return res.status(404).json({ error: "Playlist not found"});
    
    res.status(200).json(playlist);
  } catch (err) { 
      console.error('Error in /api/playlist:', err); 
      res.status(500).json({ error: err.message }); 
  }
});

// -------------------------------------------------------------------
// 急上昇 API (/api/fvideo)
// -------------------------------------------------------------------
app.get('/api/fvideo', async (req, res) => {
  try {
    const youtube = await createYoutube();
    const trending = await youtube.getTrending("Music");
    res.status(200).json(trending);
  } catch (err) { 
      console.error('Error in /api/fvideo:', err); 
      res.status(500).json({ error: err.message }); 
  }
});

export default app;