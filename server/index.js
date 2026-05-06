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

const PORT   = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'partnerhub.db');

// ── Banco de Dados ──────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Inicializar schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// ── Express ─────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

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
    const { id, trigger_keyword, response_message, active } = req.body;
    db.prepare('INSERT OR REPLACE INTO automation_rules (id, trigger_keyword, response_message, active) VALUES (?,?,?,?)').run(
      id || Math.random().toString(36).slice(7), trigger_keyword, response_message, active ?? 1
    );
    return ok(res, { success: true });
  } catch (e) { return err(res, e.message); }
});

router.delete('/automation-rules/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM automation_rules WHERE id = ?').run(req.params.id);
    return ok(res, { success: true });
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

app.use('/api', router);

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
