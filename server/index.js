// ─────────────────────────────────────────────────────────────
// PartnerHub API — Express + SQLite
// Porta: 3001 (Nginx faz proxy de /api/* para cá)
// ─────────────────────────────────────────────────────────────
'use strict';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const Database = require('better-sqlite3');
const cron    = require('node-cron');
const path    = require('path');
const fs      = require('fs');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcrypt');
const { google } = require('googleapis');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');

const PORT   = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'partnerhub.db');

// ── Banco de Dados ──────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Checkpoint ao encerrar — garante que WAL seja gravado no arquivo principal antes do container parar
process.on('SIGTERM', () => {
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch {}
  process.exit(0);
});
process.on('SIGINT', () => {
  try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch {}
  process.exit(0);
});

// Inicializar schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Migrações incrementais — colunas que podem não existir em DBs antigos
for (const m of [
  'ALTER TABLE videos ADD COLUMN transcript TEXT',
  'ALTER TABLE automation_rules ADD COLUMN comment_reply TEXT',
  'ALTER TABLE automation_rules ADD COLUMN dm_button_text TEXT',
  'ALTER TABLE automation_rules ADD COLUMN dm_button_url TEXT',
  `CREATE TABLE IF NOT EXISTS flows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trigger_keyword TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    steps TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS flow_pending (
    sender_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    flow_id TEXT NOT NULL,
    next_step_index INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sender_id, payload)
  )`,
  `CREATE TABLE IF NOT EXISTS webhook_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT,
    sender_id TEXT,
    content TEXT,
    rule_matched TEXT,
    replied INTEGER DEFAULT 0,
    error TEXT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS flow_cooldown (
    sender_id TEXT NOT NULL,
    flow_id TEXT NOT NULL,
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sender_id, flow_id)
  )`,
  `CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT NOT NULL,
    flow_id TEXT NOT NULL,
    opted_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',
    UNIQUE(sender_id, flow_id)
  )`,
  'ALTER TABLE flows ADD COLUMN cooldown_hours INTEGER DEFAULT 24',
  'ALTER TABLE subscribers ADD COLUMN name TEXT',
  'ALTER TABLE subscribers ADD COLUMN profile_pic TEXT',
]) {
  try { db.exec(m); } catch {}
}


// ── Express ─────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

// Todas as rotas sob /api
const router = express.Router();

// ── Helpers ─────────────────────────────────────────────────
function ok(res, data) {
  return res.json(data);
}
function err(res, msg, status = 500) {
  return res.status(status).json({ error: msg });
}

// ── 1. YouTube Channel Stats (API ao vivo) ──────────────────
router.get('/channel-stats', async (req, res) => {
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${process.env.YOUTUBE_CHANNEL_ID}&key=${process.env.YOUTUBE_API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.items?.length > 0) return ok(res, data.items[0].statistics);
    return err(res, 'Canal não encontrado', 404);
  } catch (e) { return err(res, e.message); }
});

// ── 1.5 YouTube Channel Growth (últimos vídeos) ────────────
router.get('/channel-growth', async (req, res) => {
  try {
    const uploadsId = process.env.YOUTUBE_CHANNEL_ID.replace('UC', 'UU');
    const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=10&key=${process.env.YOUTUBE_API_KEY}`;
    const plResp = await fetch(plUrl);
    const plData = await plResp.json();

    if (plData.items?.length > 0) {
      const ids = plData.items.map(i => i.snippet.resourceId.videoId).join(',');
      const stUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids}&key=${process.env.YOUTUBE_API_KEY}`;
      const stResp = await fetch(stUrl);
      const stData = await stResp.json();
      if (stData.items) {
        const chart = stData.items.reverse().map(v => ({
          name: v.snippet.title.length > 15 ? v.snippet.title.slice(0, 15) + '...' : v.snippet.title,
          views: parseInt(v.statistics.viewCount || '0', 10),
          likes: parseInt(v.statistics.likeCount || '0', 10),
        }));
        return ok(res, chart);
      }
    }
    return err(res, 'Erro ao buscar vídeos');
  } catch (e) { return err(res, e.message); }
});

// ── 1.6 YouTube Channel History (DB) ───────────────────────
router.get('/channel-history', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM youtube_history ORDER BY date ASC').all();
    const chart = rows.map(r => {
      const p = r.date.split('-');
      return { name: `${p[2]}/${p[1]}`, inscritos: r.subscribers, views: r.views };
    });
    return ok(res, chart);
  } catch (e) { return err(res, e.message); }
});

// ── 1.7 Meta Ads Stats (API ao vivo) ────────────────────────
router.get('/meta-ads-stats', async (req, res) => {
  try {
    if (!process.env.META_ACCESS_TOKEN || !process.env.META_AD_ACCOUNT_ID) {
      return err(res, 'Configuração da Meta ausente', 400);
    }
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const end   = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    const fbUrl = `https://graph.facebook.com/v19.0/${process.env.META_AD_ACCOUNT_ID}/insights?time_range={"since":"${start}","until":"${end}"}&fields=spend,actions,cpc,cpm,ctr&access_token=${process.env.META_ACCESS_TOKEN}`;
    const resp = await fetch(fbUrl);
    const data = await resp.json();
    if (data.error) return err(res, data.error.message);
    if (data.data?.length > 0) {
      const s = data.data[0];
      const la = s.actions?.find(a => a.action_type === 'lead') || s.actions?.find(a => a.action_type === 'offsite_conversion.fb_pixel_lead');
      const leads = la ? parseInt(la.value, 10) : 0;
      const spend = parseFloat(s.spend || 0);
      return ok(res, { spend, leads, cpl: leads > 0 ? spend / leads : 0 });
    }
    return ok(res, { spend: 0, leads: 0, cpl: 0 });
  } catch (e) { return err(res, e.message); }
});

// ── 1.7.1 Meta History (DB) ─────────────────────────────────
router.get('/meta-history', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM meta_history ORDER BY date ASC').all();
    const chart = rows.map(r => ({
      name: r.date.split('-').slice(1).reverse().join('/'),
      spend: r.spend, leads: r.leads, cpl: r.cpl
    }));
    return ok(res, chart);
  } catch (e) { return err(res, e.message); }
});

// ── 1.8 Instagram Stats (API ao vivo) ──────────────────────
router.get('/instagram-stats', async (req, res) => {
  try {
    if (!process.env.META_ACCESS_TOKEN || !process.env.META_IG_ACCOUNT_ID) {
      return err(res, 'Configuração do Instagram ausente', 400);
    }
    const token = process.env.META_ACCESS_TOKEN;
    const igId  = process.env.META_IG_ACCOUNT_ID;
    const today = new Date();
    const since = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const until = today.toISOString().split('T')[0];

    const [profileResp, reachResp, aggResp] = await Promise.all([
      fetch(`https://graph.facebook.com/v19.0/${igId}?fields=username,followers_count,media_count&access_token=${token}`),
      fetch(`https://graph.facebook.com/v19.0/${igId}/insights?metric=reach&period=day&since=${since}&until=${until}&access_token=${token}`),
      fetch(`https://graph.facebook.com/v19.0/${igId}/insights?metric=profile_views,accounts_engaged,total_interactions,follows_and_unfollows&metric_type=total_value&period=day&since=${since}&until=${until}&access_token=${token}`)
    ]);

    const profile = await profileResp.json();
    const reach   = await reachResp.json();
    const agg     = await aggResp.json();

    const totalReach = reach.data?.[0]?.values?.reduce((a, v) => a + v.value, 0) || 0;
    const find = name => agg.data?.find(m => m.name === name)?.total_value?.value || 0;
    const reachChart = (reach.data?.[0]?.values || []).slice(-7).map(v => ({
      name: new Date(v.end_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      alcance: v.value
    }));

    return ok(res, {
      username: profile.username || '',
      followers: profile.followers_count || 0,
      media_count: profile.media_count || 0,
      reach: totalReach,
      profile_views: find('profile_views'),
      accounts_engaged: find('accounts_engaged'),
      total_interactions: find('total_interactions'),
      new_followers: find('follows_and_unfollows'),
      reach_chart: reachChart,
      engagement_rate: totalReach > 0 ? (find('total_interactions') / totalReach) * 100 : 0,
      conversion_rate: find('profile_views') > 0 ? (find('follows_and_unfollows') / find('profile_views')) * 100 : 0,
      retention_rate: totalReach > 0 ? (find('profile_views') / totalReach) * 100 : 0
    });
  } catch (e) { return err(res, e.message); }
});

// ── 1.8.2 Instagram Posts (API ao vivo) ─────────────────────
router.get('/instagram-posts', async (req, res) => {
  try {
    if (!process.env.META_ACCESS_TOKEN || !process.env.META_IG_ACCOUNT_ID) {
      return err(res, 'Configuração do Instagram ausente', 400);
    }
    const token = process.env.META_ACCESS_TOKEN;
    const igId  = process.env.META_IG_ACCOUNT_ID;
    const limit = parseInt(req.query.limit || '12', 10);

    // Fetch latest media
    const url = `https://graph.facebook.com/v19.0/${igId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,comments_count,like_count&limit=${limit}&access_token=${token}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.error) return err(res, data.error.message);

    // Optional: fetch insights for each media. Let's do it to get reach, saves etc.
    const posts = data.data || [];
    
    const detailedPosts = await Promise.all(posts.map(async (post) => {
      try {
        let metrics = 'impressions,reach,saved';
        // Some metrics are specific to media type
        if (post.media_type === 'VIDEO') {
          // 'video_views' is often available for videos
          metrics = 'impressions,reach,saved,video_views';
        }
        const insUrl = `https://graph.facebook.com/v19.0/${post.id}/insights?metric=${metrics}&access_token=${token}`;
        const insResp = await fetch(insUrl);
        const insData = await insResp.json();
        
        let insights = {};
        if (insData.data) {
          insData.data.forEach((m) => {
            insights[m.name] = m.values?.[0]?.value || 0;
          });
        }
        return { ...post, insights };
      } catch (e) {
        return { ...post, insights: {} };
      }
    }));

    return ok(res, detailedPosts);
  } catch (e) { return err(res, e.message); }
});

// ── Instagram Posts DB endpoints ─────────────────────────────

// POST /instagram-posts/sync — fetch from API and upsert to DB
router.post('/instagram-posts/sync', async (req, res) => {
  try {
    if (!process.env.META_ACCESS_TOKEN || !process.env.META_IG_ACCOUNT_ID) {
      return err(res, 'Configuração do Instagram ausente', 400);
    }
    const token = process.env.META_ACCESS_TOKEN;
    const igId  = process.env.META_IG_ACCOUNT_ID;
    const limit = parseInt(req.query.limit || '24', 10);

    const url = `https://graph.facebook.com/v19.0/${igId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,comments_count,like_count&limit=${limit}&access_token=${token}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) return err(res, data.error.message);

    const posts = data.data || [];
    const upsert = db.prepare(`
      INSERT INTO instagram_posts (id, caption, media_type, media_url, thumbnail_url, permalink, posted_at, like_count, comments_count, reach, impressions, saved, video_views, synced_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        caption=excluded.caption, media_url=excluded.media_url, thumbnail_url=excluded.thumbnail_url,
        like_count=excluded.like_count, comments_count=excluded.comments_count,
        reach=excluded.reach, impressions=excluded.impressions, saved=excluded.saved,
        video_views=excluded.video_views, synced_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
    `);

    let synced = 0;
    await Promise.all(posts.map(async (post) => {
      let metrics = 'impressions,reach,saved';
      if (post.media_type === 'VIDEO') metrics += ',video_views';
      try {
        const insResp = await fetch(`https://graph.facebook.com/v19.0/${post.id}/insights?metric=${metrics}&access_token=${token}`);
        const insData = await insResp.json();
        const ins = {};
        if (insData.data) insData.data.forEach(m => { ins[m.name] = m.values?.[0]?.value || 0; });
        upsert.run(post.id, post.caption || null, post.media_type, post.media_url || null, post.thumbnail_url || null,
          post.permalink || null, post.timestamp || null,
          post.like_count || 0, post.comments_count || 0,
          ins.reach || 0, ins.impressions || 0, ins.saved || 0, ins.video_views || 0);
        synced++;
      } catch {}
    }));

    return ok(res, { synced, total: posts.length });
  } catch (e) { return err(res, e.message); }
});

// GET /instagram-posts/db — posts stored in DB
router.get('/instagram-posts/db', (req, res) => {
  try {
    const tag  = req.query.tag || null;
    const rows = db.prepare('SELECT * FROM instagram_posts ORDER BY posted_at DESC').all();
    const posts = rows
      .map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') }))
      .filter(r => !tag || r.tags.includes(tag));
    return ok(res, posts);
  } catch (e) { return err(res, e.message); }
});

// PATCH /instagram-posts/:id/tags — update tags
router.patch('/instagram-posts/:id/tags', (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;
    if (!Array.isArray(tags)) return err(res, 'tags deve ser um array', 400);
    db.prepare('UPDATE instagram_posts SET tags=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(JSON.stringify(tags), id);
    return ok(res, { ok: true });
  } catch (e) { return err(res, e.message); }
});

// POST /instagram-posts/:id/transcribe — transcribe and save
router.post('/instagram-posts/:id/transcribe', async (req, res) => {
  try {
    const { id } = req.params;
    const post = db.prepare('SELECT * FROM instagram_posts WHERE id=?').get(id);
    if (!post) return err(res, 'Post não encontrado', 404);
    if (post.media_type !== 'VIDEO') return err(res, 'Transcrição disponível apenas para vídeos', 400);
    if (!process.env.GEMINI_API_KEY) return err(res, 'GEMINI_API_KEY não configurada', 500);
    if (!post.media_url) return err(res, 'URL do vídeo não disponível', 400);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = 'Transcreva fielmente todo o áudio/fala deste vídeo em português. Inclua apenas o texto transcrito, sem timestamps ou metadados. Se o vídeo estiver em outro idioma, transcreva e depois traduza para o português.';

    const videoResp = await fetch(post.media_url);
    if (!videoResp.ok) return err(res, 'Erro ao baixar o vídeo do Instagram', 500);
    const arrayBuf = await videoResp.arrayBuffer();
    const videoBuffer = Buffer.from(arrayBuf);
    if (videoBuffer.length > 20 * 1024 * 1024) return err(res, 'Vídeo muito grande para transcrição (limite 20MB)', 400);

    const result = await model.generateContent([
      { inlineData: { mimeType: 'video/mp4', data: videoBuffer.toString('base64') } },
      prompt,
    ]);
    const transcript = result.response.text();

    db.prepare('UPDATE instagram_posts SET transcript=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(transcript, id);
    return ok(res, { transcript });
  } catch (e) { return err(res, e.message); }
});

// ── Etiquetas (ig_tags) ──────────────────────────────────────

// GET /ig-tags
router.get('/ig-tags', (req, res) => {
  try {
    const tags = db.prepare('SELECT name, color, created_at FROM ig_tags ORDER BY name ASC').all();
    const posts = db.prepare('SELECT tags FROM instagram_posts').all();
    const usage = {};
    for (const p of posts) {
      for (const t of JSON.parse(p.tags || '[]')) usage[t] = (usage[t] || 0) + 1;
    }
    return ok(res, tags.map(t => ({ ...t, usage: usage[t.name] || 0 })));
  } catch (e) { return err(res, e.message); }
});

// POST /ig-tags
router.post('/ig-tags', (req, res) => {
  try {
    const { name, color } = req.body || {};
    if (!name?.trim()) return err(res, 'name é obrigatório', 400);
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
    db.prepare('INSERT INTO ig_tags (name, color) VALUES (?, ?) ON CONFLICT(name) DO NOTHING').run(slug, color || '#E1306C');
    return ok(res, { name: slug, color: color || '#E1306C' });
  } catch (e) { return err(res, e.message); }
});

// PATCH /ig-tags/:name — rename and/or recolor
router.patch('/ig-tags/:name', (req, res) => {
  try {
    const old = req.params.name;
    const { name: newName, color } = req.body || {};
    if (newName && newName !== old) {
      const slug = newName.trim().toLowerCase().replace(/\s+/g, '-');
      const posts = db.prepare("SELECT id, tags FROM instagram_posts WHERE tags LIKE ?").all(`%"${old}"%`);
      const upPost = db.prepare('UPDATE instagram_posts SET tags=?, updated_at=CURRENT_TIMESTAMP WHERE id=?');
      for (const p of posts) {
        const tags = JSON.parse(p.tags || '[]').map((t) => t === old ? slug : t);
        upPost.run(JSON.stringify(tags), p.id);
      }
      db.prepare('INSERT INTO ig_tags (name, color) SELECT ?, COALESCE(?, color) FROM ig_tags WHERE name=?').run(slug, color || null, old);
      db.prepare('DELETE FROM ig_tags WHERE name=?').run(old);
    } else if (color) {
      db.prepare('UPDATE ig_tags SET color=? WHERE name=?').run(color, old);
    }
    return ok(res, { ok: true });
  } catch (e) { return err(res, e.message); }
});

// DELETE /ig-tags/:name
router.delete('/ig-tags/:name', (req, res) => {
  try {
    const { name } = req.params;
    const posts = db.prepare("SELECT id, tags FROM instagram_posts WHERE tags LIKE ?").all(`%"${name}"%`);
    const upPost = db.prepare('UPDATE instagram_posts SET tags=?, updated_at=CURRENT_TIMESTAMP WHERE id=?');
    for (const p of posts) {
      const tags = JSON.parse(p.tags || '[]').filter((t) => t !== name);
      upPost.run(JSON.stringify(tags), p.id);
    }
    db.prepare('DELETE FROM ig_tags WHERE name=?').run(name);
    return ok(res, { ok: true });
  } catch (e) { return err(res, e.message); }
});

// GET /instagram-posts/tag-stats — aggregate metrics per tag
router.get('/instagram-posts/tag-stats', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM instagram_posts').all();
    const tagMap = {};
    for (const row of rows) {
      const tags = JSON.parse(row.tags || '[]');
      const reach = row.reach || row.impressions || 0;
      const er = reach > 0 ? ((row.like_count + row.comments_count) / reach) * 100 : 0;
      for (const tag of tags) {
        if (!tagMap[tag]) tagMap[tag] = { tag, count: 0, totalReach: 0, totalLikes: 0, totalComments: 0, totalEr: 0, totalSaved: 0 };
        tagMap[tag].count++;
        tagMap[tag].totalReach += reach;
        tagMap[tag].totalLikes += row.like_count || 0;
        tagMap[tag].totalComments += row.comments_count || 0;
        tagMap[tag].totalSaved += row.saved || 0;
        tagMap[tag].totalEr += er;
      }
    }
    const stats = Object.values(tagMap).map(t => ({
      ...t,
      avgReach: t.count > 0 ? Math.round(t.totalReach / t.count) : 0,
      avgEr: t.count > 0 ? parseFloat((t.totalEr / t.count).toFixed(2)) : 0,
    })).sort((a, b) => b.count - a.count);
    return ok(res, stats);
  } catch (e) { return err(res, e.message); }
});

// ── 1.9 Total Impact (DB) ────────────────────────────────────
router.get('/total-impact', (req, res) => {
  try {
    const year = new Date().getFullYear().toString();
    const yt     = db.prepare('SELECT SUM(views) as tv FROM youtube_history WHERE date LIKE ?').get(`${year}%`);
    const ig     = db.prepare('SELECT SUM(reach) as tr FROM instagram_history WHERE date LIKE ?').get(`${year}%`);
    const meta   = db.prepare('SELECT SUM(spend) as ts, SUM(leads) as tl FROM meta_history WHERE date LIKE ?').get(`${year}%`);
    const latYt  = db.prepare('SELECT subscribers FROM youtube_history ORDER BY date DESC LIMIT 1').get();
    const latIg  = db.prepare('SELECT followers FROM instagram_history ORDER BY date DESC LIMIT 1').get();

    return ok(res, {
      year: {
        reach: (yt?.tv || 0) + (ig?.tr || 0),
        leads: meta?.tl || 0,
        investment: meta?.ts || 0
      },
      community: {
        total: (latYt?.subscribers || 0) + (latIg?.followers || 0),
        youtube: latYt?.subscribers || 0,
        instagram: latIg?.followers || 0
      }
    });
  } catch (e) { return err(res, e.message); }
});

// ── YouTube Analytics (Growth) ───────────────────────────────
router.get('/youtube-analytics', async (req, res) => {
  try {
    const refreshToken = process.env.YOUTUBE_ANALYTICS_REFRESH_TOKEN;
    if (!refreshToken) return err(res, 'YouTube Analytics não autorizado. Acesse /api/auth/youtube', 403);

    const months = parseInt(req.query.months || '12', 10);
    const authClient = getYtOAuthClient();
    const ytAnalytics = google.youtubeAnalytics({ version: 'v2', auth: authClient });
    const ytData      = google.youtube({ version: 'v3', auth: authClient });

    const chRes = await ytData.channels.list({ part: 'id', mine: true });
    const channelId = chRes.data.items?.[0]?.id;
    if (!channelId) return err(res, 'Canal não encontrado', 404);

    const endDate   = new Date(); endDate.setDate(1);
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - months);

    const sd = startDate.toISOString().split('T')[0];
    const ed = endDate.toISOString().split('T')[0];

    const SOURCE_LABELS = {
      YT_SEARCH: 'Pesquisa YouTube', SUGGESTED_VIDEO: 'Vídeos Sugeridos',
      BROWSE_FEATURES: 'Página Inicial / Navegação', EXTERNAL: 'Sites Externos',
      NOTIFICATION: 'Notificações', PLAYLIST: 'Playlists',
      NO_LINK_OTHER_: 'Outros / Direto', SUBSCRIBER: 'Feed de Inscrições',
      YT_CHANNEL: 'Página do Canal', END_SCREEN: 'Tela Final',
      SHORTS: 'YouTube Shorts',
    };

    // Query básica — sempre disponível
    const [basicRes, sourcesRes, impressionsRes] = await Promise.allSettled([
      ytAnalytics.reports.query({
        ids: `channel==${channelId}`, startDate: sd, endDate: ed, sort: 'month',
        dimensions: 'month',
        metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost',
      }),
      ytAnalytics.reports.query({
        ids: `channel==${channelId}`, startDate: sd, endDate: ed, sort: '-views',
        dimensions: 'insightTrafficSourceType',
        metrics: 'views',
      }),
      // Impressões/CTR — só disponível para canais no YPP (≥1k inscritos)
      ytAnalytics.reports.query({
        ids: `channel==${channelId}`, startDate: sd, endDate: ed, sort: 'month',
        dimensions: 'month',
        metrics: 'impressions,impressionsClickThroughRate',
      }),
    ]);

    const basicRows = basicRes.status === 'fulfilled' ? basicRes.value.data.rows || [] : [];
    const impressionsRows = impressionsRes.status === 'fulfilled' ? impressionsRes.value.data.rows || [] : [];
    const impressionsMap = Object.fromEntries(impressionsRows.map(r => [r[0].slice(0, 7), { impressions: r[1] || 0, ctr: parseFloat(((r[2] || 0) * 100).toFixed(2)) }]));

    const monthly = basicRows.map(r => {
      const key = r[0].slice(0, 7);
      const imp = impressionsMap[key] || { impressions: 0, ctr: 0 };
      return {
        name:            key,
        views:           r[1] || 0,
        watchTimeHours:  Math.round((r[2] || 0) / 60),
        avgViewDuration: Math.round(r[3] || 0),
        subsGained:      r[4] || 0,
        subsLost:        r[5] || 0,
        impressions:     imp.impressions,
        ctr:             imp.ctr,
      };
    });

    const trafficRaw = sourcesRes.status === 'fulfilled' ? sourcesRes.value.data.rows || [] : [];
    const trafficTotal = trafficRaw.reduce((s, r) => s + (r[1] || 0), 0);
    const trafficSources = trafficRaw.map(r => ({
      source: SOURCE_LABELS[r[0]] || r[0],
      views:  r[1] || 0,
      pct:    trafficTotal > 0 ? parseFloat(((r[1] / trafficTotal) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.views - a.views);

    const hasImpressions = impressionsRows.length > 0;
    const summary = {
      impressions:     hasImpressions ? monthly.reduce((s, r) => s + r.impressions, 0) : null,
      ctr:             hasImpressions && monthly.length ? parseFloat((monthly.reduce((s, r) => s + r.ctr, 0) / monthly.length).toFixed(2)) : null,
      watchTimeHours:  monthly.reduce((s, r) => s + r.watchTimeHours, 0),
      avgViewDuration: monthly.length ? Math.round(monthly.reduce((s, r) => s + r.avgViewDuration, 0) / monthly.length) : 0,
      subsGained:      monthly.reduce((s, r) => s + r.subsGained, 0),
      subsLost:        monthly.reduce((s, r) => s + r.subsLost, 0),
    };

    return ok(res, { summary, monthly, trafficSources, hasImpressions });
  } catch (e) { return err(res, e.message); }
});

// ── 2. YouTube Top Videos (DB) ───────────────────────────────
router.get('/youtube-top-videos', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, title, youtube_id, views, likes, pillar, created_at FROM videos ORDER BY views DESC LIMIT 10').all();
    return ok(res, rows);
  } catch (e) { return err(res, e.message); }
});

// ── 2.1 YouTube Monthly Stats (DB) ──────────────────────────
router.get('/youtube-monthly-stats', (req, res) => {
  try {
    const year = new Date().getFullYear().toString();
    const rows = db.prepare(
      `SELECT strftime('%Y-%m', date) as month, MAX(subscribers) as subscribers, MAX(views) as views
       FROM youtube_history WHERE date LIKE ? GROUP BY month ORDER BY month ASC`
    ).all(`${year}%`);
    return ok(res, rows.map(r => ({ name: r.month, inscritos: r.subscribers || 0, views: r.views || 0 })));
  } catch (e) { return err(res, e.message); }
});

// ── 2.2 YouTube Upload Frequency (DB) ───────────────────────
router.get('/youtube-upload-frequency', (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
       FROM videos GROUP BY month ORDER BY month DESC LIMIT 12`
    ).all();
    return ok(res, rows);
  } catch (e) { return err(res, e.message); }
});

// ── 2.3 Instagram Monthly Reach (DB) ────────────────────────
router.get('/instagram-monthly', (req, res) => {
  try {
    const year = new Date().getFullYear().toString();
    const rows = db.prepare(
      `SELECT strftime('%Y-%m', date) as month, SUM(reach) as total_reach, MAX(followers) as followers
       FROM instagram_history WHERE date LIKE ? GROUP BY month ORDER BY month ASC`
    ).all(`${year}%`);
    return ok(res, rows.map(r => ({ name: r.month, alcance: r.total_reach || 0, seguidores: r.followers || 0 })));
  } catch (e) { return err(res, e.message); }
});

// ── 1.8.1 Instagram History (DB) ────────────────────────────
router.get('/instagram-history', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM instagram_history ORDER BY date ASC').all();
    return ok(res, rows.map(r => ({
      name: r.date.split('-').slice(1).reverse().join('/'),
      alcance: r.reach, seguidores: r.followers
    })));
  } catch (e) { return err(res, e.message); }
});

// ── 3. Videos CRUD ───────────────────────────────────────────
router.get('/videos', (req, res) => {
  try {
    return ok(res, db.prepare('SELECT * FROM videos ORDER BY created_at DESC').all());
  } catch (e) { return err(res, e.message); }
});

router.post('/videos', (req, res) => {
  try {
    const { id, title, youtube_id, pillar, status, tags, journey_stage, focus_keyword, persona, pain_point, problem_solved } = req.body;
    const exists = db.prepare('SELECT id FROM videos WHERE id = ?').get(id);
    if (exists) {
      db.prepare(
        'UPDATE videos SET title=?, youtube_id=?, pillar=?, status=?, tags=?, journey_stage=?, focus_keyword=?, persona=?, pain_point=?, problem_solved=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
      ).run(title, youtube_id || null, pillar, status, tags || null, journey_stage || null, focus_keyword || null, persona || null, pain_point || null, problem_solved || null, id);
    } else {
      db.prepare(
        'INSERT INTO videos (id, title, youtube_id, pillar, status, tags, journey_stage, focus_keyword, persona, pain_point, problem_solved) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
      ).run(id, title, youtube_id || null, pillar, status, tags || null, journey_stage || null, focus_keyword || null, persona || null, pain_point || null, problem_solved || null);
    }
    return ok(res, { success: true });
  } catch (e) { return err(res, e.message); }
});

router.delete('/videos/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
    return ok(res, { success: true });
  } catch (e) { return err(res, e.message); }
});

// ── 4. Financial Goals CRUD ──────────────────────────────────
router.get('/financial-goals', (req, res) => {
  try {
    return ok(res, db.prepare('SELECT * FROM financial_goals ORDER BY id ASC').all());
  } catch (e) { return err(res, e.message); }
});

router.post('/financial-goals', (req, res) => {
  try {
    const { id, target_revenue } = req.body;
    const exists = db.prepare('SELECT id FROM financial_goals WHERE id = ?').get(id);
    if (exists) {
      db.prepare('UPDATE financial_goals SET target_revenue=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(target_revenue || 0, id);
    } else {
      db.prepare('INSERT INTO financial_goals (id, target_revenue) VALUES (?, ?)').run(id, target_revenue || 0);
    }
    return ok(res, { success: true });
  } catch (e) { return err(res, e.message); }
});

// ── 5. Transactions CRUD ─────────────────────────────────────
router.get('/transactions', (req, res) => {
  try {
    return ok(res, db.prepare('SELECT * FROM transactions ORDER BY date DESC, created_at DESC').all());
  } catch (e) { return err(res, e.message); }
});

router.post('/transactions', (req, res) => {
  try {
    const { id, date, type, amount, description, category } = req.body;
    const exists = db.prepare('SELECT id FROM transactions WHERE id = ?').get(id);
    if (exists) {
      db.prepare('UPDATE transactions SET date=?, type=?, amount=?, description=?, category=? WHERE id=?').run(date, type, amount, description, category || null, id);
    } else {
      db.prepare('INSERT INTO transactions (id, date, type, amount, description, category) VALUES (?,?,?,?,?,?)').run(id, date, type, amount, description, category || null);
    }
    return ok(res, { success: true });
  } catch (e) { return err(res, e.message); }
});

router.delete('/transactions/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
    return ok(res, { success: true });
  } catch (e) { return err(res, e.message); }
});

// ── 6. Automation Rules CRUD ─────────────────────────────────
router.get('/automation-rules', (req, res) => {
  try {
    return ok(res, db.prepare('SELECT * FROM automation_rules ORDER BY created_at DESC').all());
  } catch (e) { return err(res, e.message); }
});

router.post('/automation-rules', (req, res) => {
  try {
    const { id, trigger_keyword, response_message, comment_reply, dm_button_text, dm_button_url, active } = req.body;
    db.prepare(`INSERT OR REPLACE INTO automation_rules
      (id, trigger_keyword, response_message, comment_reply, dm_button_text, dm_button_url, active)
      VALUES (?,?,?,?,?,?,?)`)
      .run(id || Math.random().toString(36).slice(7), trigger_keyword, response_message,
        comment_reply || null, dm_button_text || null, dm_button_url || null, active ?? 1);
    return ok(res, { success: true });
  } catch (e) { return err(res, e.message); }
});

router.delete('/automation-rules/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM automation_rules WHERE id = ?').run(req.params.id);
    return ok(res, { success: true });
  } catch (e) { return err(res, e.message); }
});

// ── Flows CRUD ────────────────────────────────────────────────
router.get('/flows', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM flows ORDER BY created_at DESC').all();
    return ok(res, rows.map(r => ({ ...r, steps: JSON.parse(r.steps || '[]') })));
  } catch (e) { return err(res, e.message); }
});

router.post('/flows', (req, res) => {
  try {
    const { id, name, trigger_keyword, steps, active, cooldown_hours } = req.body;
    const fid = id || Math.random().toString(36).slice(2, 9);
    db.prepare(`INSERT OR REPLACE INTO flows (id, name, trigger_keyword, steps, active, cooldown_hours, updated_at)
      VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)`)
      .run(fid, name, trigger_keyword, JSON.stringify(steps || []), active ?? 1, cooldown_hours ?? 24);
    return ok(res, { id: fid });
  } catch (e) { return err(res, e.message); }
});

router.patch('/flows/:id/toggle', (req, res) => {
  try {
    const flow = db.prepare('SELECT active FROM flows WHERE id=?').get(req.params.id);
    if (!flow) return err(res, 'Flow não encontrado', 404);
    db.prepare('UPDATE flows SET active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(flow.active ? 0 : 1, req.params.id);
    return ok(res, { success: true });
  } catch (e) { return err(res, e.message); }
});

router.delete('/flows/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM flows WHERE id=?').run(req.params.id);
    return ok(res, { success: true });
  } catch (e) { return err(res, e.message); }
});

// ── 6.1 Webhook Log (leitura) ─────────────────────────────────
router.get('/webhook-log', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const rows = db.prepare('SELECT * FROM webhook_log ORDER BY received_at DESC LIMIT ?').all(limit);
    return ok(res, rows);
  } catch (e) { return err(res, e.message); }
});

// ── 6.2 Subscribers ───────────────────────────────────────────
router.get('/subscribers', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT s.id, s.sender_id, s.flow_id, s.opted_in_at, s.status, s.name, s.profile_pic,
             f.name as flow_name, f.trigger_keyword
      FROM subscribers s
      LEFT JOIN flows f ON f.id = s.flow_id
      ORDER BY s.opted_in_at DESC
      LIMIT 500
    `).all();
    return ok(res, rows);
  } catch (e) { return err(res, e.message); }
});

// Backfill de perfis para subscribers sem nome
router.post('/subscribers/enrich', async (req, res) => {
  try {
    const subs = db.prepare("SELECT DISTINCT sender_id FROM subscribers WHERE name IS NULL").all();
    if (subs.length === 0) return ok(res, { enriched: 0, total: 0 });
    const pageToken = process.env.META_PAGE_TOKEN || process.env.META_ACCESS_TOKEN;
    let enriched = 0;
    for (const sub of subs) {
      try {
        const r = await fetch(`https://graph.facebook.com/v19.0/${sub.sender_id}?fields=name,first_name,last_name,profile_pic&access_token=${pageToken}`);
        const p = await r.json();
        if (!p.error && p.name) {
          db.prepare('UPDATE subscribers SET name=?, profile_pic=? WHERE sender_id=?')
            .run(p.name, p.profile_pic || null, sub.sender_id);
          enriched++;
        }
        await sleep(100);
      } catch { /* pula */ }
    }
    return ok(res, { enriched, total: subs.length });
  } catch (e) { return err(res, e.message); }
});

router.get('/subscribers/counts', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT flow_id, COUNT(*) as total
      FROM subscribers WHERE status='active'
      GROUP BY flow_id
    `).all();
    return ok(res, rows);
  } catch (e) { return err(res, e.message); }
});

// ── 6.3 Broadcast ─────────────────────────────────────────────
router.post('/flows/:id/broadcast', (req, res) => {
  try {
    const { message, image_url } = req.body;
    if (!message && !image_url) return err(res, 'message ou image_url obrigatório', 400);

    const flow = db.prepare('SELECT * FROM flows WHERE id=?').get(req.params.id);
    if (!flow) return err(res, 'Flow não encontrado', 404);

    const subs = db.prepare("SELECT sender_id FROM subscribers WHERE flow_id=? AND status='active'").all(req.params.id);
    if (subs.length === 0) return ok(res, { sent: 0, errors: 0, total: 0 });

    setImmediate(async () => {
      let sent = 0, errors = 0;
      for (const sub of subs) {
        try {
          const payload = image_url
            ? { attachment: { type: 'image', payload: { url: image_url, is_reusable: true } } }
            : { text: message };
          const d = await sendDM(sub.sender_id, payload);
          if (d.error) { errors++; console.error('[Broadcast]', d.error.message); }
          else {
            sent++;
            if (image_url && message) await sendDM(sub.sender_id, { text: message });
          }
          await sleep(250);
        } catch (e) { errors++; }
      }
      console.log(`[Broadcast] Flow ${req.params.id}: ${sent}/${subs.length} enviados, ${errors} erros`);
    });

    return ok(res, { total: subs.length, status: 'processing' });
  } catch (e) { return err(res, e.message); }
});

// ── 7. Sync YouTube All (sob demanda) ────────────────────────
router.post('/sync-youtube-all', async (req, res) => {
  try {
    const result = await syncYouTubeVideos();
    return ok(res, result);
  } catch (e) { return err(res, e.message); }
});

// ── 8. Sync All Stats (snapshot manual) ─────────────────────
router.post('/sync-all-stats', async (req, res) => {
  try {
    await syncAllHistoricalData();
    return ok(res, { success: true });
  } catch (e) { return err(res, e.message); }
});

// ── Health check ─────────────────────────────────────────────
router.get('/health', (req, res) => {
  return ok(res, { status: 'ok', db: DB_PATH });
});

// ── My Video Stats (para Benchmark) ─────────────────────────
router.get('/my-video-stats', async (req, res) => {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const channelId = process.env.YOUTUBE_CHANNEL_ID;
    if (!apiKey || !channelId) return err(res, 'YouTube não configurado', 500);

    const uploadsId = channelId.replace('UC', 'UU');
    const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=30&key=${apiKey}`;
    const plResp = await fetch(plUrl);
    const plData = await plResp.json();
    if (!plData.items?.length) return ok(res, []);

    const ids = plData.items.map(i => i.snippet.resourceId.videoId).join(',');
    const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${ids}&key=${apiKey}`;
    const vResp = await fetch(vUrl);
    const vData = await vResp.json();
    if (!vData.items) return ok(res, []);

    const videos = vData.items.map(v => {
      const views    = parseInt(v.statistics.viewCount    || '0', 10);
      const likes    = parseInt(v.statistics.likeCount   || '0', 10);
      const comments = parseInt(v.statistics.commentCount || '0', 10);
      return {
        id: v.id,
        title: v.snippet.title,
        publishedAt: v.snippet.publishedAt,
        thumbnail: v.snippet.thumbnails?.medium?.url || '',
        views, likes, comments,
        duration: v.contentDetails?.duration || '',
        engagementRate: views > 0 ? parseFloat(((likes + comments) / views * 100).toFixed(2)) : 0,
        url: `https://www.youtube.com/watch?v=${v.id}`,
      };
    }).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    return ok(res, videos);
  } catch (e) { return err(res, e.message); }
});

// ── 9. Competitor Channel Analysis ───────────────────────────
// Cache em memória: { [channelId]: { data, expiresAt } }
const competitorCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

function parseChannelInput(input) {
  if (!input) return null;
  const s = input.trim();
  // UC... channel ID direto
  if (/^UC[\w-]{22}$/.test(s)) return { type: 'id', value: s };
  // URL com /channel/UC...
  const chanMatch = s.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
  if (chanMatch) return { type: 'id', value: chanMatch[1] };
  // URL com /@handle ou /c/handle ou /user/handle
  const handleMatch = s.match(/youtube\.com\/(?:@|c\/|user\/)?([\w.-]+)/);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };
  // @handle sem URL
  if (s.startsWith('@')) return { type: 'handle', value: s.slice(1) };
  // qualquer outra string tratada como handle
  return { type: 'handle', value: s };
}

router.get('/competitor-channel', async (req, res) => {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return err(res, 'YouTube API key não configurada', 500);

    const input = req.query.id || req.query.handle || req.query.url || '';
    const maxResults = Math.min(parseInt(req.query.maxResults || '20', 10), 50);

    const parsed = parseChannelInput(input);
    if (!parsed) return err(res, 'Informe um canal válido (URL, @handle ou Channel ID)', 400);

    // ── Resolver Channel ID ────────────────────────────────
    let channelId = '';
    if (parsed.type === 'id') {
      channelId = parsed.value;
    } else {
      // forHandle retorna canal cujo handle corresponde
      const hUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${parsed.value}&key=${apiKey}`;
      const hRes = await fetch(hUrl);
      const hData = await hRes.json();
      if (hData.items?.length > 0) {
        channelId = hData.items[0].id;
      } else {
        // Fallback: forUsername (canais antigos)
        const uUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${parsed.value}&key=${apiKey}`;
        const uRes = await fetch(uUrl);
        const uData = await uRes.json();
        if (uData.items?.length > 0) {
          channelId = uData.items[0].id;
        } else {
          return err(res, `Canal "@${parsed.value}" não encontrado`, 404);
        }
      }
    }

    // ── Cache hit? ─────────────────────────────────────────
    const cached = competitorCache.get(channelId);
    if (cached && cached.expiresAt > Date.now()) {
      return ok(res, cached.data);
    }

    // ── Buscar Info do Canal ───────────────────────────────
    const chanUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${apiKey}`;
    const chanRes = await fetch(chanUrl);
    const chanData = await chanRes.json();
    if (!chanData.items?.length) return err(res, 'Canal não encontrado', 404);

    const ch = chanData.items[0];
    const channelInfo = {
      id: ch.id,
      title: ch.snippet.title,
      description: ch.snippet.description,
      customUrl: ch.snippet.customUrl || '',
      publishedAt: ch.snippet.publishedAt,
      thumbnail: ch.snippet.thumbnails?.high?.url || ch.snippet.thumbnails?.default?.url || '',
      country: ch.snippet.country || '',
      subscribers: parseInt(ch.statistics.subscriberCount || '0', 10),
      totalViews: parseInt(ch.statistics.viewCount || '0', 10),
      videoCount: parseInt(ch.statistics.videoCount || '0', 10),
    };

    // ── Buscar Top Vídeos (search por viewCount) ───────────
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=viewCount&type=video&maxResults=${maxResults}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    let videos = [];
    if (searchData.items?.length > 0) {
      const videoIds = searchData.items.map(i => i.id.videoId).join(',');

      // ── Buscar Estatísticas Detalhadas ─────────────────
      const vidUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds}&key=${apiKey}`;
      const vidRes = await fetch(vidUrl);
      const vidData = await vidRes.json();

      if (vidData.items) {
        videos = vidData.items.map(v => {
          const views   = parseInt(v.statistics.viewCount    || '0', 10);
          const likes   = parseInt(v.statistics.likeCount   || '0', 10);
          const comments = parseInt(v.statistics.commentCount || '0', 10);
          const engRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

          return {
            id: v.id,
            title: v.snippet.title,
            publishedAt: v.snippet.publishedAt,
            thumbnail: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url || '',
            views,
            likes,
            comments,
            engagementRate: parseFloat(engRate.toFixed(2)),
            duration: v.contentDetails?.duration || '',
            url: `https://www.youtube.com/watch?v=${v.id}`,
          };
        });

        // Ordenar por views descrescente
        videos.sort((a, b) => b.views - a.views);
      }
    }

    const result = { channel: channelInfo, videos, fetchedAt: new Date().toISOString() };

    // ── Salvar no cache ────────────────────────────────────
    competitorCache.set(channelId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

    return ok(res, result);
  } catch (e) { return err(res, e.message); }
});

// ── 9.1 Instagram Competitor Analysis ─────────────────────────
// Cache: { [username]: { data, expiresAt } }
const igCompetitorCache = new Map();

router.get('/instagram-competitor', async (req, res) => {
  try {
    const token = process.env.META_ACCESS_TOKEN;
    const igId  = process.env.META_IG_ACCOUNT_ID;
    if (!token || !igId) return err(res, 'Instagram não configurado', 500);

    const username = req.query.username || '';
    if (!username) return err(res, 'Informe um @username do Instagram', 400);
    const cleanUsername = username.replace('@', '').trim();

    // Cache check
    const cached = igCompetitorCache.get(cleanUsername);
    if (cached && cached.expiresAt > Date.now()) return ok(res, cached.data);

    // Instagram Business Discovery API
    // Must be queried ON the user's IG id
    const fields = 'business_discovery.username(' + cleanUsername + '){username,name,profile_picture_url,biography,followers_count,media_count,media{id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,comments_count,like_count}}';
    
    const url = `https://graph.facebook.com/v19.0/${igId}?fields=${fields}&access_token=${token}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.error) {
      return err(res, data.error.error_user_title || 'Não foi possível acessar dados desse perfil. Ele pode não ser uma conta Comercial/Criador.', 404);
    }

    const bd = data.business_discovery;
    if (!bd) return err(res, 'Perfil não encontrado', 404);

    const channel = {
      id: bd.username,
      title: bd.name || bd.username,
      description: bd.biography || '',
      thumbnail: bd.profile_picture_url || '',
      subscribers: bd.followers_count || 0,
      videoCount: bd.media_count || 0,
      customUrl: bd.username,
      totalViews: 0 // Not applicable for IG account wide stats without insights
    };

    let videos = [];
    if (bd.media && bd.media.data) {
      videos = bd.media.data.map(m => {
        const likes = m.like_count || 0;
        const comments = m.comments_count || 0;
        const totalEng = likes + comments;
        // Engagement rate based on followers
        const engRate = channel.subscribers > 0 ? (totalEng / channel.subscribers) * 100 : 0;
        return {
          id: m.id,
          title: m.caption || '(Sem legenda)',
          publishedAt: m.timestamp,
          thumbnail: m.media_type === 'VIDEO' ? (m.thumbnail_url || m.media_url) : m.media_url,
          views: 0,
          likes,
          comments,
          engagementRate: parseFloat(engRate.toFixed(2)),
          duration: m.media_type,
          url: m.permalink,
          media_url: m.media_type === 'VIDEO' ? (m.media_url || null) : null,
        };
      });
    }

    const result = { channel, videos, fetchedAt: new Date().toISOString() };
    igCompetitorCache.set(cleanUsername, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

    return ok(res, result);

  } catch (e) { return err(res, e.message); }
});

// ── 9.2 AI Competitor Analysis (Google Gemini) ──────────────────
router.post('/analyze-competitor', async (req, res) => {
  try {
    const { platform, channelName, videos } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return err(res, 'Chave da API do Google Gemini (GEMINI_API_KEY) não configurada no servidor.', 400);
    }

    if (!videos || videos.length === 0) {
      return err(res, 'Nenhum vídeo/post fornecido para análise', 400);
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Fast and free tier

    // Sort by most engagement (likes/comments) or views to get the best ones
    const topContent = videos.slice(0, 15).map((v, i) => {
      return `${i + 1}. Título/Legenda: "${v.title}"\n   Métricas: ${v.views ? v.views + ' views, ' : ''}${v.likes} curtidas, ${v.comments} comentários, ${v.engagementRate}% engajamento.\n   Data: ${v.publishedAt}`;
    }).join('\n\n');

    const prompt = `Você é um estrategista de conteúdo digital e expert em social media.
Eu vou te passar os melhores posts/vídeos recentes do concorrente "${channelName}" na plataforma ${platform === 'youtube' ? 'YouTube' : 'Instagram'}.

Aqui estão os conteúdos mais populares deles recentemente:
${topContent}

Com base nesses dados:
1. Padrões de Sucesso: Quais são os padrões que você percebe nos títulos/legendas de maior sucesso? (ex: estilo de escrita, formato, gatilhos mentais)
2. Tópicos em Alta: Quais parecem ser os temas ou palavras-chave que mais geram engajamento?
3. Ideias Acionáveis: Me dê 3 ideias práticas de conteúdos ou formatos que eu posso criar para o meu próprio perfil com base no que está funcionando para eles.

Responda em um formato de Markdown limpo e fácil de ler, usando negrito para destaques e bullet points. Seja direto e estratégico.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return ok(res, { analysis: text });
  } catch (e) { return err(res, e.message); }
});

// ── 9.3 Transcrição de vídeo próprio (Content tab) ────────────
router.post('/transcribe-video', async (req, res) => {
  try {
    const { youtube_id, video_id } = req.body || {};
    if (!youtube_id) return err(res, 'youtube_id é obrigatório', 400);
    if (!process.env.GEMINI_API_KEY) return err(res, 'GEMINI_API_KEY não configurada', 500);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      { fileData: { mimeType: 'video/mp4', fileUri: `https://www.youtube.com/watch?v=${youtube_id}` } },
      'Transcreva fielmente todo o áudio/fala deste vídeo em português. Inclua apenas o texto transcrito, sem timestamps ou metadados. Se o vídeo estiver em outro idioma, transcreva e depois traduza para o português.',
    ]);

    const transcript = result.response.text();

    if (video_id) {
      db.prepare('UPDATE videos SET transcript = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(transcript, video_id);
    }

    return ok(res, { transcript });
  } catch (e) { return err(res, e.message); }
});

// ── 9.4 Transcrição de vídeo de concorrente ───────────────────
router.post('/transcribe-competitor-video', async (req, res) => {
  try {
    const { platform, youtube_id, media_id } = req.body || {};
    if (!process.env.GEMINI_API_KEY) return err(res, 'GEMINI_API_KEY não configurada', 500);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = 'Transcreva fielmente todo o áudio/fala deste vídeo em português. Inclua apenas o texto transcrito, sem timestamps ou metadados. Se o vídeo estiver em outro idioma, transcreva e depois traduza para o português.';

    if (platform === 'instagram') {
      const { media_url } = req.body || {};
      if (!media_url) return err(res, 'URL do vídeo não disponível para este post', 400);

      // Baixa o vídeo e envia como inline data ao Gemini
      const videoResp = await fetch(media_url);
      if (!videoResp.ok) return err(res, 'Erro ao baixar o vídeo do Instagram', 500);
      const arrayBuf = await videoResp.arrayBuffer();
      const videoBuffer = Buffer.from(arrayBuf);
      if (videoBuffer.length > 20 * 1024 * 1024) return err(res, 'Vídeo muito grande para transcrição (limite 20MB)', 400);

      const result = await model.generateContent([
        { inlineData: { mimeType: 'video/mp4', data: videoBuffer.toString('base64') } },
        prompt,
      ]);
      return ok(res, { transcript: result.response.text() });
    }

    // YouTube
    if (!youtube_id) return err(res, 'youtube_id é obrigatório para YouTube', 400);
    const result = await model.generateContent([
      { fileData: { mimeType: 'video/mp4', fileUri: `https://www.youtube.com/watch?v=${youtube_id}` } },
      prompt,
    ]);
    return ok(res, { transcript: result.response.text() });
  } catch (e) { return err(res, e.message); }
});

// ── Calendário de Conteúdo ────────────────────────────────────

router.get('/calendar', (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);

    // Itens planejados manualmente
    const planned = db.prepare(
      "SELECT * FROM content_calendar WHERE planned_date LIKE ? ORDER BY planned_date ASC"
    ).all(`${month}%`);

    // Posts Instagram sincronizados (têm data precisa de publicação)
    const igPosts = db.prepare(
      "SELECT id, caption, media_type, posted_at, tags FROM instagram_posts WHERE substr(posted_at,1,7)=? ORDER BY posted_at ASC"
    ).all(month);

    const items = [
      ...planned.map(p => ({ ...p, source: 'planned', tags: JSON.parse(p.tags || '[]') })),
      ...igPosts.map(p => ({
        id: `ig_${p.id}`,
        source: 'instagram',
        title: p.caption ? p.caption.slice(0, 100) : '(Sem legenda)',
        channel: 'instagram',
        format: p.media_type === 'VIDEO' ? 'reel' : p.media_type === 'CAROUSEL_ALBUM' ? 'carrossel' : 'foto',
        planned_date: p.posted_at ? p.posted_at.slice(0, 10) : null,
        status: 'published',
        tags: JSON.parse(p.tags || '[]'),
        notes: null,
      })),
    ].filter(i => i.planned_date);

    return ok(res, { items });
  } catch (e) { return err(res, e.message); }
});

router.post('/calendar', (req, res) => {
  try {
    const { title, channel, format, planned_date, notes, tags } = req.body || {};
    if (!title || !channel || !format || !planned_date) return err(res, 'Campos obrigatórios ausentes', 400);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    db.prepare('INSERT INTO content_calendar (id,title,channel,format,planned_date,notes,tags) VALUES (?,?,?,?,?,?,?)')
      .run(id, title, channel, format, planned_date, notes || null, JSON.stringify(tags || []));
    return ok(res, { id });
  } catch (e) { return err(res, e.message); }
});

router.put('/calendar/:id', (req, res) => {
  try {
    const { title, channel, format, planned_date, notes, tags } = req.body || {};
    db.prepare('UPDATE content_calendar SET title=?,channel=?,format=?,planned_date=?,notes=?,tags=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(title, channel, format, planned_date, notes || null, JSON.stringify(tags || []), req.params.id);
    return ok(res, { ok: true });
  } catch (e) { return err(res, e.message); }
});

router.patch('/calendar/:id/status', (req, res) => {
  try {
    const { status } = req.body || {};
    db.prepare('UPDATE content_calendar SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, req.params.id);
    return ok(res, { ok: true });
  } catch (e) { return err(res, e.message); }
});

router.delete('/calendar/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM content_calendar WHERE id=?').run(req.params.id);
    return ok(res, { ok: true });
  } catch (e) { return err(res, e.message); }
});

// ── Goals / OKRs ─────────────────────────────────────────────

function resolveCurrentValue(metric) {
  const today = new Date().toISOString().slice(0, 7); // YYYY-MM
  try {
    switch (metric) {
      case 'instagram_followers':
        return db.prepare('SELECT followers FROM instagram_history ORDER BY date DESC LIMIT 1').get()?.followers || 0;
      case 'youtube_subscribers':
        return db.prepare('SELECT subscribers FROM youtube_history ORDER BY date DESC LIMIT 1').get()?.subscribers || 0;
      case 'instagram_reach_monthly':
        return db.prepare("SELECT SUM(reach) as v FROM instagram_history WHERE date LIKE ?").get(`${today}%`)?.v || 0;
      case 'youtube_views_monthly':
        return db.prepare("SELECT SUM(views) as v FROM youtube_history WHERE date LIKE ?").get(`${today}%`)?.v || 0;
      case 'posts_instagram_monthly':
        return db.prepare("SELECT COUNT(*) as v FROM instagram_posts WHERE substr(posted_at,1,7)=?").get(today)?.v || 0;
      case 'videos_youtube_monthly': {
        const latest = db.prepare('SELECT videos FROM youtube_history ORDER BY date DESC LIMIT 1').get()?.videos || 0;
        const prev   = db.prepare('SELECT videos FROM youtube_history WHERE date < ? ORDER BY date DESC LIMIT 1').get(`${today}-01`)?.videos || latest;
        return Math.max(latest - prev, 0);
      }
      case 'meta_leads_monthly':
        return db.prepare("SELECT SUM(leads) as v FROM meta_history WHERE date LIKE ?").get(`${today}%`)?.v || 0;
      case 'revenue_monthly':
        return db.prepare("SELECT SUM(amount) as v FROM transactions WHERE type='income' AND date LIKE ?").get(`${today}%`)?.v || 0;
      default:
        return 0;
    }
  } catch { return 0; }
}

router.get('/goals', (req, res) => {
  try {
    const goals = db.prepare('SELECT * FROM goals ORDER BY created_at ASC').all();
    return ok(res, goals.map(g => ({ ...g, current_value: resolveCurrentValue(g.metric) })));
  } catch (e) { return err(res, e.message); }
});

router.post('/goals', (req, res) => {
  try {
    const { label, metric, target_value, deadline, notes } = req.body || {};
    if (!label || !metric || target_value == null || !deadline) return err(res, 'Campos obrigatórios ausentes', 400);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const baseline = resolveCurrentValue(metric);
    db.prepare('INSERT INTO goals (id,label,metric,target_value,baseline_value,deadline,notes) VALUES (?,?,?,?,?,?,?)')
      .run(id, label, metric, target_value, baseline, deadline, notes || null);
    return ok(res, { id, baseline_value: baseline });
  } catch (e) { return err(res, e.message); }
});

router.put('/goals/:id', (req, res) => {
  try {
    const { label, target_value, deadline, notes } = req.body || {};
    db.prepare('UPDATE goals SET label=?,target_value=?,deadline=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(label, target_value, deadline, notes || null, req.params.id);
    return ok(res, { ok: true });
  } catch (e) { return err(res, e.message); }
});

router.delete('/goals/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM goals WHERE id=?').run(req.params.id);
    return ok(res, { ok: true });
  } catch (e) { return err(res, e.message); }
});

// ── Auth ─────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'changeme-set-in-env';

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// POST /api/auth/login — público
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const expectedUser = process.env.ADMIN_USERNAME || 'admin';
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || '';

  if (!username || !password)
    return res.status(400).json({ error: 'Usuário e senha obrigatórios' });

  if (username !== expectedUser)
    return res.status(401).json({ error: 'Credenciais inválidas' });

  const valid = await bcrypt.compare(password, passwordHash);
  if (!valid)
    return res.status(401).json({ error: 'Credenciais inválidas' });

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '30d' });
  return res.json({ token });
});

// ── YouTube Analytics OAuth + Backfill ───────────────────────
const YT_REDIRECT_URI = (process.env.APP_BASE_URL || 'https://dash.amzcursos.com') + '/api/auth/youtube/callback';

function getYtOAuthClient() {
  const clientId     = process.env.YOUTUBE_ANALYTICS_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_ANALYTICS_CLIENT_SECRET;
  const client = new google.auth.OAuth2(clientId, clientSecret, YT_REDIRECT_URI);
  if (process.env.YOUTUBE_ANALYTICS_REFRESH_TOKEN) {
    client.setCredentials({ refresh_token: process.env.YOUTUBE_ANALYTICS_REFRESH_TOKEN });
  }
  return client;
}

// Público: inicia fluxo OAuth do YouTube Analytics
app.get('/api/auth/youtube', (req, res) => {
  const client = getYtOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/yt-analytics.readonly',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
  });
  res.redirect(url);
});

// Público: callback OAuth — salva token e dispara backfill
app.get('/api/auth/youtube/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.send(`<h2>Erro OAuth: ${error}</h2>`);
  try {
    const client = getYtOAuthClient();
    const { tokens } = await client.getToken(code);
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) return res.send('<h2>Erro: refresh_token não retornado. Tente novamente.</h2>');

    // Salva no .env
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('YOUTUBE_ANALYTICS_REFRESH_TOKEN=')) {
      envContent = envContent.replace(/YOUTUBE_ANALYTICS_REFRESH_TOKEN=.*/m, `YOUTUBE_ANALYTICS_REFRESH_TOKEN=${refreshToken}`);
    } else {
      envContent += `\nYOUTUBE_ANALYTICS_REFRESH_TOKEN=${refreshToken}`;
    }
    fs.writeFileSync(envPath, envContent);
    process.env.YOUTUBE_ANALYTICS_REFRESH_TOKEN = refreshToken;

    // Dispara backfills em background
    backfillYouTube().catch(e => console.error('[backfill YT]', e.message));
    backfillInstagram().catch(e => console.error('[backfill IG]', e.message));

    res.send(`<h2 style="font-family:sans-serif;color:#4ade80;padding:2rem">
      ✅ YouTube Analytics autorizado!<br>
      <small style="color:#aaa;font-size:1rem">Importando dados históricos em background — pode fechar esta aba.</small>
    </h2>`);
  } catch (e) {
    console.error('[OAuth callback]', e.message);
    res.send(`<h2>Erro: ${e.message}</h2>`);
  }
});

// ── Backfill YouTube Analytics ────────────────────────────────
async function backfillYouTube() {
  console.log('[backfill YT] Iniciando...');
  const authClient = getYtOAuthClient();
  const ytAnalytics = google.youtubeAnalytics({ version: 'v2', auth: authClient });
  const ytData      = google.youtube({ version: 'v3', auth: authClient });

  // Descobre channel ID autenticado
  const chRes = await ytData.channels.list({ part: 'id,statistics', mine: true });
  const ch = chRes.data.items?.[0];
  if (!ch) throw new Error('Canal não encontrado');
  const channelId = ch.id;
  const currentSubs = parseInt(ch.statistics.subscriberCount || '0', 10);
  const currentViews = parseInt(ch.statistics.viewCount || '0', 10);
  const currentVideos = parseInt(ch.statistics.videoCount || '0', 10);

  // Com dimension=month a API exige que start e end sejam sempre YYYY-MM-01
  const endDate = new Date();
  endDate.setDate(1); // primeiro dia do mês atual (inclui dados até o mês anterior completo)
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 18);

  const report = await ytAnalytics.reports.query({
    ids:       `channel==${channelId}`,
    startDate: startDate.toISOString().split('T')[0],
    endDate:   endDate.toISOString().split('T')[0],
    metrics:   'views,subscribersGained,subscribersLost',
    dimensions:'month',
    sort:      'month',
  });

  const rows = report.data.rows || [];
  if (!rows.length) { console.log('[backfill YT] Sem dados retornados'); return; }

  // Reconstrói contagem de inscritos retroativamente a partir do valor atual
  let runSubs = currentSubs;
  let runViews = currentViews;
  const monthly = [...rows].reverse().map(([month, views, gained, lost]) => {
    const entry = { month, subs: Math.max(0, runSubs), views: Math.max(0, runViews) };
    runSubs  -= (gained - lost);
    runViews -= views;
    return entry;
  }).reverse();

  // Insere ou atualiza no banco
  const upsert = db.prepare(`
    INSERT INTO youtube_history (date, subscribers, views, videos)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET subscribers=excluded.subscribers, views=excluded.views, videos=excluded.videos
  `);
  const insertMany = db.transaction((rows) => {
    for (const r of rows) upsert.run(r.month + '-01', r.subs, r.views, currentVideos);
  });
  insertMany(monthly);
  db.pragma('wal_checkpoint(TRUNCATE)');
  console.log(`[backfill YT] ${monthly.length} meses importados.`);
}

// ── Backfill Instagram ────────────────────────────────────────
async function backfillInstagram() {
  console.log('[backfill IG] Iniciando...');
  const token = process.env.META_ACCESS_TOKEN;
  const igId  = process.env.META_IG_ACCOUNT_ID;
  if (!token || !igId) throw new Error('Meta não configurado');

  // Seguidores atuais
  const profileResp = await fetch(`https://graph.facebook.com/v19.0/${igId}?fields=followers_count,media_count&access_token=${token}`);
  const profile = await profileResp.json();
  const currentFollowers = profile.followers_count || 0;

  // Busca reach diário dos últimos 12 meses e agrega por mês
  const endDate   = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 11);
  startDate.setDate(1);

  const since = Math.floor(startDate.getTime() / 1000);
  const until = Math.floor(endDate.getTime() / 1000);

  // Instagram limita a 30 dias por requisição — busca mês a mês
  const byMonth = {};
  for (let i = 11; i >= 0; i--) {
    const mStart = new Date();
    mStart.setDate(1);
    mStart.setMonth(mStart.getMonth() - i);
    const mEnd = new Date(mStart);
    mEnd.setMonth(mEnd.getMonth() + 1);
    mEnd.setDate(0); // último dia do mês

    const s = Math.floor(mStart.getTime() / 1000);
    const u = Math.floor(mEnd.getTime() / 1000);
    const key = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, '0')}`;

    const url = `https://graph.facebook.com/v19.0/${igId}/insights?metric=reach&period=day&since=${s}&until=${u}&access_token=${token}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) { console.warn(`[backfill IG] ${key}:`, data.error.message); continue; }

    let monthReach = 0;
    for (const metric of (data.data || [])) {
      for (const val of (metric.values || [])) monthReach += (val.value || 0);
    }
    byMonth[key] = { reach: monthReach };
  }

  const upsert = db.prepare(`
    INSERT INTO instagram_history (date, followers, reach, profile_views)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET followers=excluded.followers, reach=excluded.reach, profile_views=excluded.profile_views
  `);
  const insertMany = db.transaction((entries) => {
    for (const [month, vals] of entries) {
      upsert.run(month + '-01', currentFollowers, vals.reach, 0);
    }
  });
  const entries = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));
  insertMany(entries);
  db.pragma('wal_checkpoint(TRUNCATE)');
  console.log(`[backfill IG] ${entries.length} meses importados.`);
}

// Dispara backfill manualmente (exige JWT)
app.post('/api/backfill', requireAuth, async (req, res) => {
  res.json({ message: 'Backfill iniciado em background' });
  backfillYouTube().catch(e => console.error('[backfill YT]', e.message));
  backfillInstagram().catch(e => console.error('[backfill IG]', e.message));
});

// ── Instagram Webhook (público) ───────────────────────────────

// GET — verificação solicitada pela Meta ao cadastrar o callback
app.get('/api/webhook/instagram', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    console.log('[Webhook] Verificação Meta concluída');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// POST — recebe eventos de comentários e DMs
app.post('/api/webhook/instagram', (req, res) => {
  const appSecret = process.env.META_APP_SECRET;
  if (appSecret) {
    const sig = req.headers['x-hub-signature-256'];
    if (!sig) {
      console.warn('[Webhook] Requisição sem assinatura rejeitada');
      return res.sendStatus(403);
    }
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody || '').digest('hex');
    try {
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        console.warn('[Webhook] Assinatura inválida rejeitada');
        return res.sendStatus(403);
      }
    } catch {
      return res.sendStatus(403);
    }
  }
  res.sendStatus(200);
  processWebhookEvent(req.body).catch(e => console.error('[Webhook] Erro ao processar evento:', e.message));
});

function matchFlow(text) {
  const flows = db.prepare("SELECT * FROM flows WHERE active = 1").all();
  const lower = text.toLowerCase();
  const flow  = flows.find(f => lower.includes(f.trigger_keyword.toLowerCase()));
  if (!flow) return null;
  return { ...flow, steps: JSON.parse(flow.steps || '[]') };
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function isInCooldown(senderId, flow) {
  if (!flow.cooldown_hours) return false;
  const row = db.prepare('SELECT triggered_at FROM flow_cooldown WHERE sender_id=? AND flow_id=?').get(senderId, flow.id);
  if (!row) return false;
  const elapsed = (Date.now() - new Date(row.triggered_at).getTime()) / 3600000;
  return elapsed < flow.cooldown_hours;
}

function recordCooldown(senderId, flowId) {
  db.prepare('INSERT OR REPLACE INTO flow_cooldown (sender_id, flow_id, triggered_at) VALUES (?,?,CURRENT_TIMESTAMP)').run(senderId, flowId);
}

async function saveSubscriber(senderId, flowId) {
  db.prepare('INSERT OR IGNORE INTO subscribers (sender_id, flow_id) VALUES (?,?)').run(senderId, flowId);
  // Busca perfil se ainda não tiver nome
  const row = db.prepare('SELECT name FROM subscribers WHERE sender_id=? AND flow_id=?').get(senderId, flowId);
  if (!row?.name) {
    try {
      const pageToken = process.env.META_PAGE_TOKEN || process.env.META_ACCESS_TOKEN;
      const r = await fetch(`https://graph.facebook.com/v19.0/${senderId}?fields=name,first_name,last_name,profile_pic&access_token=${pageToken}`);
      const p = await r.json();
      if (!p.error && p.name) {
        db.prepare('UPDATE subscribers SET name=?, profile_pic=? WHERE sender_id=? AND flow_id=?')
          .run(p.name, p.profile_pic || null, senderId, flowId);
      }
    } catch (e) { console.warn('[Subscriber] Erro ao buscar perfil:', e.message); }
  }
}

async function sendDM(senderId, msgPayload) {
  const pageToken = process.env.META_PAGE_TOKEN || process.env.META_ACCESS_TOKEN;
  const pageId    = process.env.META_PAGE_ID;
  const r = await fetch(`https://graph.facebook.com/v19.0/${pageId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: senderId }, message: msgPayload, access_token: pageToken }),
  });
  return r.json();
}

async function sendStep(step, senderId, flowId, stepIndex) {
  if (step.delay_seconds > 0) await sleep(step.delay_seconds * 1000);

  // ── Imagem ────────────────────────────────────────────────────
  if (step.type === 'image') {
    if (!step.image_url) return;
    const d = await sendDM(senderId, {
      attachment: { type: 'image', payload: { url: step.image_url, is_reusable: true } },
    });
    if (d.error) throw new Error(d.error.message);
    if (step.text) {
      const d2 = await sendDM(senderId, { text: step.text });
      if (d2.error) console.warn('[Webhook] Erro ao enviar legenda:', d2.error.message);
    }
    return;
  }

  // ── DM ────────────────────────────────────────────────────────
  const qrButtons  = (step.buttons || []).filter(b => b.type === 'quick_reply');
  const urlButtons = (step.buttons || []).filter(b => b.type === 'url');
  let messagePayload;

  if (qrButtons.length > 0) {
    for (const btn of qrButtons) {
      const payload = btn.payload || `QR_${flowId}_${stepIndex}_${btn.id}`;
      btn.payload = payload;
      db.prepare(`INSERT OR REPLACE INTO flow_pending (sender_id, payload, flow_id, next_step_index) VALUES (?,?,?,?)`)
        .run(senderId, payload, flowId, stepIndex + 1);
    }
    messagePayload = {
      text: step.text,
      quick_replies: qrButtons.map(b => ({ content_type: 'text', title: b.title.slice(0, 20), payload: b.payload })),
    };
  } else if (urlButtons.length > 0) {
    messagePayload = {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: step.text,
          buttons: urlButtons.slice(0, 3).map(b => ({ type: 'web_url', url: b.url, title: b.title.slice(0, 20) })),
        },
      },
    };
  } else {
    messagePayload = { text: step.text };
  }

  const d = await sendDM(senderId, messagePayload);
  if (d.error && urlButtons.length > 0) {
    const fallback = step.text + '\n\n' + urlButtons.map(b => `${b.title}: ${b.url}`).join('\n');
    await sendDM(senderId, { text: fallback });
  } else if (d.error) {
    throw new Error(d.error.message);
  }
}

// Executa steps de um fluxo a partir de startIndex, suportando todos os tipos
async function executeSteps(steps, startIndex, { senderId, flowId, commentId, token }) {
  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i];

    if (step.type === 'comment_reply') {
      if (!commentId || !token) continue;
      const rc = await fetch(`https://graph.facebook.com/v19.0/${commentId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: step.text, access_token: token }),
      });
      const dc = await rc.json();
      if (dc.error) console.error('[Webhook] Erro reply comentário:', dc.error.message);
    } else if (step.type === 'wait') {
      if (step.delay_seconds > 0) await sleep(step.delay_seconds * 1000);
    } else if (step.type === 'dm' || step.type === 'image') {
      await sendStep(step, senderId, flowId, i);
      if (step.type === 'dm') {
        const hasQR = (step.buttons || []).some(b => b.type === 'quick_reply');
        if (hasQR) break;
      }
    }
  }
}

async function processWebhookEvent(body) {
  const token  = process.env.META_ACCESS_TOKEN;
  const myIgId = process.env.META_IG_ACCOUNT_ID;

  for (const entry of (body?.entry || [])) {
    // ── Comentários ──────────────────────────────────────────
    for (const change of (entry.changes || [])) {
      const isIgComment   = change.field === 'comments';
      const isFeedComment = change.field === 'feed' && change.value?.item === 'comment' && change.value?.verb === 'add';
      if (!isIgComment && !isFeedComment) continue;

      const val         = change.value || {};
      const commentId   = val.id || val.comment_id;
      const commentText = val.text || val.message || '';
      const senderId    = val.from?.id;

      if (!commentText || !commentId || senderId === myIgId) continue;

      const flow = matchFlow(commentText);
      let replied = 0, logError = null;

      if (flow) {
        if (isInCooldown(senderId, flow)) {
          console.log(`[Webhook] Cooldown ativo para ${senderId} no flow "${flow.name}" — ignorado`);
        } else {
          try {
            recordCooldown(senderId, flow.id);
            await executeSteps(flow.steps, 0, { senderId, flowId: flow.id, commentId, token });
            replied = 1;
            console.log(`[Webhook] Flow "${flow.name}" executado para ${senderId}`);
          } catch (e) {
            logError = e.message;
            console.error('[Webhook] Erro ao executar flow:', e.message);
          }
        }
      }

      db.prepare('INSERT INTO webhook_log (event_type, sender_id, content, rule_matched, replied, error) VALUES (?,?,?,?,?,?)')
        .run('comment', senderId || null, commentText, flow?.trigger_keyword || null, replied, logError);
    }

    // ── DMs / Quick Reply postbacks ───────────────────────────
    for (const msg of (entry.messaging || [])) {
      const senderId  = msg.sender?.id;
      const text      = msg.message?.text || '';
      const qrPayload = msg.message?.quick_reply?.payload || msg.postback?.payload || '';

      if (!senderId || senderId === myIgId) continue;

      // Quick reply de opt-in → executa próximo passo do flow
      if (qrPayload) {
        const pending = db.prepare('SELECT * FROM flow_pending WHERE sender_id=? AND payload=?').get(senderId, qrPayload);
        if (pending) {
          const flowRow = db.prepare('SELECT * FROM flows WHERE id=?').get(pending.flow_id);
          if (flowRow) {
            const flow = { ...flowRow, steps: JSON.parse(flowRow.steps || '[]') };
            try {
              saveSubscriber(senderId, pending.flow_id);
              db.prepare('DELETE FROM flow_pending WHERE sender_id=? AND payload=?').run(senderId, qrPayload);
              await executeSteps(flow.steps, pending.next_step_index, { senderId, flowId: flow.id, commentId: null, token: null });
              console.log(`[Webhook] Continuação de flow para ${senderId} após opt-in`);
            } catch (e) {
              console.error('[Webhook] Erro ao continuar flow:', e.message);
            }
          }
          continue;
        }
      }

      // DM com texto normal → tenta disparar flow
      if (!text) continue;
      const flow = matchFlow(text);
      let replied = 0, logError = null;
      if (flow) {
        if (isInCooldown(senderId, flow)) {
          console.log(`[Webhook] Cooldown ativo para ${senderId} no flow "${flow.name}" via DM — ignorado`);
        } else {
          try {
            recordCooldown(senderId, flow.id);
            await executeSteps(flow.steps, 0, { senderId, flowId: flow.id, commentId: null, token: null });
            replied = 1;
          } catch (e) {
            logError = e.message;
          }
        }
      }
      db.prepare('INSERT INTO webhook_log (event_type, sender_id, content, rule_matched, replied, error) VALUES (?,?,?,?,?,?)')
        .run('dm', senderId, text, flow?.trigger_keyword || null, replied, logError);
    }
  }
}

// Todas as rotas /api/* exigem autenticação
app.use('/api', requireAuth, router);

// ── Funções de Sincronização ─────────────────────────────────

async function syncYouTubeVideos() {
  const uploadsId = process.env.YOUTUBE_CHANNEL_ID.replace('UC', 'UU');
  let nextPageToken = '';
  let totalSynced = 0;

  do {
    const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=50&pageToken=${nextPageToken}&key=${process.env.YOUTUBE_API_KEY}`;
    const plResp = await fetch(plUrl);
    const plData = await plResp.json();

    if (plData.items?.length > 0) {
      const ids = plData.items.map(i => i.snippet.resourceId.videoId).join(',');
      const stUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids}&key=${process.env.YOUTUBE_API_KEY}`;
      const stResp = await fetch(stUrl);
      const stData = await stResp.json();

      if (stData.items) {
        const upsert = db.transaction((items) => {
          for (const v of items) {
            const exists = db.prepare('SELECT id FROM videos WHERE youtube_id = ?').get(v.id);
            if (exists) {
              db.prepare('UPDATE videos SET title=?, views=?, likes=?, updated_at=CURRENT_TIMESTAMP WHERE youtube_id=?').run(
                v.snippet.title, parseInt(v.statistics.viewCount || '0'), parseInt(v.statistics.likeCount || '0'), v.id
              );
            } else {
              db.prepare('INSERT INTO videos (id, title, youtube_id, pillar, status, views, likes) VALUES (?,?,?,?,?,?,?)').run(
                v.id, v.snippet.title, v.id, 'diagnostic', 'published',
                parseInt(v.statistics.viewCount || '0'), parseInt(v.statistics.likeCount || '0')
              );
            }
          }
        });
        upsert(stData.items);
        totalSynced += stData.items.length;
      }
    }
    nextPageToken = plData.nextPageToken || '';
  } while (nextPageToken);

  return { success: true, totalSynced };
}

async function syncAllHistoricalData() {
  const today = new Date().toISOString().split('T')[0];

  // YouTube snapshot
  try {
    const ytUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${process.env.YOUTUBE_CHANNEL_ID}&key=${process.env.YOUTUBE_API_KEY}`;
    const ytData = await fetch(ytUrl).then(r => r.json());
    if (ytData.items?.length > 0) {
      const s = ytData.items[0].statistics;
      db.prepare('INSERT OR REPLACE INTO youtube_history (date, subscribers, views, videos) VALUES (?,?,?,?)').run(
        today, parseInt(s.subscriberCount || '0'), parseInt(s.viewCount || '0'), parseInt(s.videoCount || '0')
      );
    }
  } catch (e) { console.error('YouTube sync error:', e.message); }

  // Instagram snapshot
  try {
    if (process.env.META_ACCESS_TOKEN && process.env.META_IG_ACCOUNT_ID) {
      const token = process.env.META_ACCESS_TOKEN;
      const igId  = process.env.META_IG_ACCOUNT_ID;
      const profile = await fetch(`https://graph.facebook.com/v19.0/${igId}?fields=followers_count&access_token=${token}`).then(r => r.json());
      const reachData = await fetch(`https://graph.facebook.com/v19.0/${igId}/insights?metric=reach&period=day&access_token=${token}`).then(r => r.json());
      const dailyReach = reachData.data?.[0]?.values?.[0]?.value || 0;
      db.prepare('INSERT OR REPLACE INTO instagram_history (date, followers, reach) VALUES (?,?,?)').run(today, profile.followers_count || 0, dailyReach);
    }
  } catch (e) { console.error('Instagram sync error:', e.message); }

  // Meta Ads snapshot
  try {
    if (process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID) {
      const fbUrl = `https://graph.facebook.com/v19.0/${process.env.META_AD_ACCOUNT_ID}/insights?date_preset=today&fields=spend,actions&access_token=${process.env.META_ACCESS_TOKEN}`;
      const fbData = await fetch(fbUrl).then(r => r.json());
      if (fbData.data?.length > 0) {
        const s = fbData.data[0];
        const la = s.actions?.find(a => a.action_type === 'lead') || s.actions?.find(a => a.action_type === 'offsite_conversion.fb_pixel_lead');
        const leads = la ? parseInt(la.value, 10) : 0;
        const spend = parseFloat(s.spend || 0);
        db.prepare('INSERT OR REPLACE INTO meta_history (date, spend, leads, cpl) VALUES (?,?,?,?)').run(today, spend, leads, leads > 0 ? spend / leads : 0);
      }
    }
  } catch (e) { console.error('Meta sync error:', e.message); }
}

// ── Cron: limpeza de flow_pending expirados (a cada hora) ────
cron.schedule('0 * * * *', () => {
  try {
    db.prepare("DELETE FROM flow_pending WHERE datetime(created_at, '+24 hours') < datetime('now')").run();
  } catch (e) { console.error('[CRON] Erro limpeza flow_pending:', e.message); }
});

// ── Cron: snapshot diário à meia-noite ──────────────────────
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Iniciando snapshot diário...');
  try {
    await syncAllHistoricalData();
    await syncYouTubeVideos();
    console.log('[CRON] Snapshot concluído.');
  } catch (e) {
    console.error('[CRON] Erro no snapshot:', e.message);
  }
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ PartnerHub API rodando na porta ${PORT}`);
  console.log(`   Banco de dados: ${DB_PATH}`);
});
