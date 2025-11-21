import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import process from 'process';

// Vercel environment: process.cwd() is usually the task root.
// The binary should be at the root if included via vercel.json
const ytdlpPath = path.resolve(process.cwd(), 'yt-dlp_linux');
const PROXY_URL = "http://ytproxy-siawaseok.duckdns.org:3007";

export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { videoId } = req.query;
  if (!videoId) {
    return res.status(400).json({ error: '有効なVideo IDを指定してください。' });
  }

  // 1. Debugging: Log path and existence
  console.log(`[Stream API] Looking for yt-dlp at: ${ytdlpPath}`);
  
  if (!fs.existsSync(ytdlpPath)) {
      console.error(`[Stream API] Error: yt-dlp binary NOT found at ${ytdlpPath}`);
      // Attempt fallback check (sometimes vercel structure varies)
      const fallbackPath = path.join(process.cwd(), 'api', 'yt-dlp_linux');
      if (fs.existsSync(fallbackPath)) {
          console.log(`[Stream API] Found at fallback: ${fallbackPath}`);
          // Update path if found in fallback
      } else {
          return res.status(500).json({ error: "Server Configuration Error: yt-dlp binary missing." });
      }
  }

  // 2. Permissions: Ensure executable
  try {
      fs.chmodSync(ytdlpPath, 0o755);
  } catch (e) {
      console.warn(`[Stream API] Warning: chmod failed: ${e.message}`);
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  // 3. Arguments: Add --no-cache-dir for read-only FS
  const args = [
      '--proxy', PROXY_URL, 
      '--no-cache-dir', 
      '--dump-json', 
      youtubeUrl
  ];

  console.log(`[Stream API] Executing: ${ytdlpPath} ${args.join(' ')}`);

  execFile(ytdlpPath, args, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
    if (error) {
      console.error("[Stream API] Execution Error:", error);
      console.error("[Stream API] Stderr:", stderr);
      return res.status(500).json({ error: "動画情報の取得に失敗しました。", details: stderr || error.message });
    }

    try {
      const info = JSON.parse(stdout);

      // Logic from your working script:
      
      // 1. Combined MP4 (Video + Audio)
      const combinedFormats = info.formats.filter(f =>
        f.vcodec !== 'none' && f.acodec !== 'none' && f.ext === 'mp4' &&
        (f.protocol === 'https' || f.protocol === 'http')
      );

      // 2. Sort by height desc
      combinedFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
      
      // 3. Streaming URL (Best available)
      const streamingFormat = combinedFormats[0];

      // 4. Audio Only
      const audioOnlyFormats = info.formats.filter(f =>
        f.vcodec === 'none' && f.acodec !== 'none' &&
        (f.protocol === 'https' || f.protocol === 'http')
      );
      audioOnlyFormats.sort((a,b) => (b.abr || 0) - (a.abr || 0));
      const bestAudio = audioOnlyFormats.find(f => f.ext === 'm4a') || audioOnlyFormats[0];

      // 5. 1080p Video Only
      const video1080pFormat = info.formats.find(f =>
        f.height === 1080 && f.vcodec !== 'none' && f.acodec === 'none' && f.ext === 'mp4' &&
        (f.protocol === 'https' || f.protocol === 'http')
      );

      res.status(200).json({
        streamingUrl: streamingFormat ? streamingFormat.url : null,
        streamType: 'mp4',
        combinedFormats: combinedFormats.map(f => ({
          quality: f.format_note || `${f.height}p`, 
          container: f.ext, 
          url: f.url
        })),
        audioOnlyFormat: bestAudio ? {
          quality: `${Math.round(bestAudio.abr || 0)}kbps`, 
          container: bestAudio.ext, 
          url: bestAudio.url
        } : null,
        separate1080p: video1080pFormat ? {
          video: { quality: '1080p (映像のみ)', container: 'mp4', url: video1080pFormat.url },
          audio: bestAudio ? { quality: `${Math.round(bestAudio.abr || 0)}kbps (音声のみ)`, container: bestAudio.ext, url: bestAudio.url } : null
        } : null
      });

    } catch (parseError) {
      console.error("[Stream API] JSON Parse Error:", parseError);
      res.status(500).json({ error: "データの解析に失敗しました。", details: parseError.message });
    }
  });
}