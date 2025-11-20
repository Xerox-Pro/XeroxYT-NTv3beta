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
    // 署名エラー対策: キャッシュを使用しない設定にする場合などがあればここに記述
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
    
    // 署名エラーが出てもメタデータは返せるようにする
    try {
      // 関連動画の続きを取得（失敗してもメイン情報は返す）
      let continuationCount = 0;
      // 現在のFeedを保持
      let currentFeed = info; 
      
      // すでに取得済みのIDを記録
      const seenIds = new Set();
      const relatedVideos = [];
      const MAX_VIDEOS = 50;

      // 既存候補から抽出
      for (const video of allCandidates) {
         if(video.id) seenIds.add(video.id);
         relatedVideos.push(video);
      }

      // 足りなければ続きを取得
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
      
      // 整形したリストを上書き
      info.watch_next_feed = relatedVideos;

    } catch (e) {
      console.warn('[API] Continuation failed, returning basic info:', e.message);
    }

    // 不要なデータを削減してレスポンス
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
    const { q: query } = req.query;
    if (!query) return res.status(400).json({ error: "Missing search query" });

    const search = await youtube.search(query);
    
    // v9以降は .videos, .shorts などがgetterとして用意されていることが多い
    // ない場合は raw データを返す
    res.status(200).json({
        videos: search.videos || [],
        shorts: search.shorts || [],
        channels: search.channels || [],
        playlists: search.playlists || []
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
    
    // 続きのコメントを取得
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
// チャンネル API (/api/channel) - 【重要】修正箇所
// -------------------------------------------------------------------
app.get('/api/channel', async (req, res) => {
  try {
    const youtube = await createYoutube();
    const { id, page = '1' } = req.query;
    if (!id) return res.status(400).json({ error: "Missing channel id" });

    const channel = await youtube.getChannel(id);
    
    // 最初の動画リストを取得
    let videosFeed = await channel.getVideos();
    
    // 動画を蓄積するための配列を用意（videosFeed.videosは読み取り専用なので上書きしない）
    let allVideos = [...(videosFeed.videos || [])];

    // ページネーション処理
    const targetPage = parseInt(page);
    // 1ページ目は既に取得しているので、2ページ目以降を取得
    for (let i = 1; i < targetPage; i++) {
      if (videosFeed.has_continuation) {
        // 次のフィードを取得して更新
        videosFeed = await videosFeed.getContinuation();
        // 新しい動画を追加
        if (videosFeed.videos) {
            allVideos.push(...videosFeed.videos);
        }
      } else {
        break;
      }
    }
    
    // メタデータの抽出
    const title = channel.metadata?.title || channel.header?.title?.text || channel.header?.author?.name || null;
    let avatar = channel.metadata?.avatar || channel.header?.avatar || channel.header?.author?.thumbnails || null;
    
    // アバターURLの正規化
    if (Array.isArray(avatar) && avatar.length > 0) {
        avatar = avatar[0].url;
    } else if (typeof avatar === 'object' && avatar?.url) {
        avatar = avatar.url;
    }

    // バナーURLの正規化
    let banner = channel.metadata?.banner || channel.header?.banner || null;
    if (Array.isArray(banner) && banner.length > 0) {
        banner = banner[0].url;
    } else if (typeof banner === 'object' && banner?.url) {
        banner = banner.url;
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
      videos: allVideos // 蓄積した配列を返す
    });

  } catch (err) { 
      console.error('Error in /api/channel:', err); 
      // エラーでもJSONを返せるようにする
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
    
    // .videos getter が存在する場合はそれを使う（バージョンによる互換性確保）
    // 存在しない場合は contents[0].contents 等の深いネストを探す
    let shorts = [];
    
    if (shortsFeed.videos) {
        shorts = shortsFeed.videos;
    } else if (shortsFeed.contents && Array.isArray(shortsFeed.contents)) {
        // Tab -> RichGrid -> contents のような構造を想定
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
    
    // .playlists getter がある場合
    if (playlistsFeed.playlists) {
        playlists = playlistsFeed.playlists;
    } 
    // .items getter がある場合
    else if (playlistsFeed.items) {
        playlists = playlistsFeed.items;
    }
    // 構造を手動で掘る場合
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