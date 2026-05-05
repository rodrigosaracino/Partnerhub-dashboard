export interface Env {
  YOUTUBE_API_KEY: string;
  YOUTUBE_CHANNEL_ID: string;
  META_ACCESS_TOKEN?: string;
  META_AD_ACCOUNT_ID?: string;
  META_IG_ACCOUNT_ID?: string;
  DB: D1Database;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. Endpoint Dashboard Stats (YouTube Channel API)
      if (request.method === 'GET' && url.pathname === '/channel-stats') {
        const ytUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${env.YOUTUBE_CHANNEL_ID}&key=${env.YOUTUBE_API_KEY}`;
        const response = await fetch(ytUrl);
        const data = await response.json() as any;
        if (data.items && data.items.length > 0) {
          const stats = data.items[0].statistics;
          return new Response(JSON.stringify(stats), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Canal não encontrado' }), { status: 404, headers: corsHeaders });
      }

      // 1.5 Endpoint Channel Growth (Latest Videos Stats)
      if (request.method === 'GET' && url.pathname === '/channel-growth') {
        const uploadsPlaylistId = env.YOUTUBE_CHANNEL_ID.replace('UC', 'UU');
        const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=10&key=${env.YOUTUBE_API_KEY}`;
        
        const playlistRes = await fetch(playlistUrl);
        const playlistData = await playlistRes.json() as any;

        if (playlistData.items && playlistData.items.length > 0) {
          const videoIds = playlistData.items.map((item: any) => item.snippet.resourceId.videoId).join(',');
          const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${env.YOUTUBE_API_KEY}`;
          
          const statsRes = await fetch(statsUrl);
          const statsData = await statsRes.json() as any;

          if (statsData.items) {
            // Reverse so older videos (of the last 10) are first on the chart, and newest is last
            const chartData = statsData.items.reverse().map((video: any) => ({
              name: video.snippet.title.length > 15 ? video.snippet.title.substring(0, 15) + '...' : video.snippet.title,
              views: parseInt(video.statistics.viewCount || '0', 10),
              likes: parseInt(video.statistics.likeCount || '0', 10),
            }));
            return new Response(JSON.stringify(chartData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }
        return new Response(JSON.stringify({ error: 'Erro ao buscar vídeos' }), { status: 500, headers: corsHeaders });
      }

      // 1.6 Endpoint Channel History (From DB)
      if (request.method === 'GET' && url.pathname === '/channel-history') {
        const { results } = await env.DB.prepare('SELECT * FROM youtube_history ORDER BY date ASC').all();
        const chartData = results.map((row: any) => {
          // Extrai o mês e ano se for no dia 01, ou dia/mês se for diário.
          const dateParts = row.date.split('-');
          const label = `${dateParts[2]}/${dateParts[1]}`;
          return {
            name: label,
            inscritos: row.subscribers,
            views: row.views
          };
        });
        return new Response(JSON.stringify(chartData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 1.7 Endpoint Meta Ads Stats
      if (request.method === 'GET' && url.pathname === '/meta-ads-stats') {
        if (!env.META_ACCESS_TOKEN || env.META_ACCESS_TOKEN === 'COLE_O_SEU_TOKEN_AQUI' || !env.META_AD_ACCOUNT_ID) {
          return new Response(JSON.stringify({ error: 'Configuração da Meta ausente' }), { status: 400, headers: corsHeaders });
        }
        
        // Fetch insights for current month
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        
        const fbUrl = `https://graph.facebook.com/v19.0/${env.META_AD_ACCOUNT_ID}/insights?time_range={"since":"${startOfMonth}","until":"${endOfMonth}"}&fields=spend,actions,cpc,cpm,ctr&access_token=${env.META_ACCESS_TOKEN}`;
        
        const response = await fetch(fbUrl);
        const data = await response.json() as any;
        
        if (data.error) {
          return new Response(JSON.stringify({ error: data.error.message }), { status: 500, headers: corsHeaders });
        }

        if (data.data && data.data.length > 0) {
          const stats = data.data[0];
          const leadsAction = stats.actions?.find((a: any) => a.action_type === 'lead') || 
                              stats.actions?.find((a: any) => a.action_type === 'offsite_conversion.fb_pixel_lead');
          const leads = leadsAction ? parseInt(leadsAction.value, 10) : 0;
          const spend = parseFloat(stats.spend || 0);
          const cpl = leads > 0 ? spend / leads : 0;
          
          return new Response(JSON.stringify({ spend, leads, cpl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        return new Response(JSON.stringify({ spend: 0, leads: 0, cpl: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 1.7.1 Endpoint Meta Ads History (From DB)
      if (request.method === 'GET' && url.pathname === '/meta-history') {
        const { results } = await env.DB.prepare('SELECT * FROM meta_history ORDER BY date ASC').all();
        const chartData = results.map((row: any) => ({
          name: row.date.split('-').slice(1).reverse().join('/'), // MM/DD or DD/MM
          spend: row.spend,
          leads: row.leads,
          cpl: row.cpl
        }));
        return new Response(JSON.stringify(chartData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 1.8 Endpoint Instagram Stats
      if (request.method === 'GET' && url.pathname === '/instagram-stats') {
        if (!env.META_ACCESS_TOKEN || !env.META_IG_ACCOUNT_ID) {
          return new Response(JSON.stringify({ error: 'Configuração do Instagram ausente' }), { status: 400, headers: corsHeaders });
        }

        const token = env.META_ACCESS_TOKEN;
        const igId = env.META_IG_ACCOUNT_ID;
        const today = new Date();
        const since = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const until = today.toISOString().split('T')[0];

        // Basic profile info
        const profileRes = await fetch(`https://graph.facebook.com/v19.0/${igId}?fields=username,followers_count,media_count&access_token=${token}`);
        const profileData = await profileRes.json() as any;

        // Reach (daily series)
        const reachRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/insights?metric=reach&period=day&since=${since}&until=${until}&access_token=${token}`);
        const reachData = await reachRes.json() as any;

        // Aggregate metrics (profile_views, accounts_engaged, total_interactions, follows_and_unfollows)
        const aggRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/insights?metric=profile_views,accounts_engaged,total_interactions,follows_and_unfollows&metric_type=total_value&period=day&since=${since}&until=${until}&access_token=${token}`);
        const aggData = await aggRes.json() as any;

        // Sum reach values for the month
        const totalReach = reachData.data?.[0]?.values?.reduce((acc: number, v: any) => acc + v.value, 0) || 0;

        // Extract aggregate values
        const findMetric = (name: string) => aggData.data?.find((m: any) => m.name === name)?.total_value?.value || 0;
        
        // Build reach chart data (last 7 days)
        const reachChartData = (reachData.data?.[0]?.values || []).slice(-7).map((v: any) => ({
          name: new Date(v.end_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          alcance: v.value
        }));

        return new Response(JSON.stringify({
          username: profileData.username || '',
          followers: profileData.followers_count || 0,
          media_count: profileData.media_count || 0,
          reach: totalReach,
          profile_views: findMetric('profile_views'),
          accounts_engaged: findMetric('accounts_engaged'),
          total_interactions: findMetric('total_interactions'),
          new_followers: findMetric('follows_and_unfollows'),
          reach_chart: reachChartData,
          // Derived strategic metrics
          engagement_rate: totalReach > 0 ? (findMetric('total_interactions') / totalReach) * 100 : 0,
          conversion_rate: findMetric('profile_views') > 0 ? (findMetric('follows_and_unfollows') / findMetric('profile_views')) * 100 : 0,
          retention_rate: totalReach > 0 ? (findMetric('profile_views') / totalReach) * 100 : 0
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 1.9 Endpoint Total Impact (Aggregated from DB)
      if (request.method === 'GET' && url.pathname === '/total-impact') {
        const currentYear = new Date().getFullYear().toString();
        
        // YouTube sum for the year (views)
        const yt = await env.DB.prepare('SELECT SUM(views) as total_views FROM youtube_history WHERE date LIKE ?').bind(`${currentYear}%`).first() as any;
        
        // Instagram sum for the year (reach)
        const ig = await env.DB.prepare('SELECT SUM(reach) as total_reach FROM instagram_history WHERE date LIKE ?').bind(`${currentYear}%`).first() as any;
        
        // Meta sum for the year (spend, leads)
        const meta = await env.DB.prepare('SELECT SUM(spend) as total_spend, SUM(leads) as total_leads FROM meta_history WHERE date LIKE ?').bind(`${currentYear}%`).first() as any;

        // Current totals (latest record)
        const latestYt = await env.DB.prepare('SELECT subscribers FROM youtube_history ORDER BY date DESC LIMIT 1').first() as any;
        const latestIg = await env.DB.prepare('SELECT followers FROM instagram_history ORDER BY date DESC LIMIT 1').first() as any;

        return new Response(JSON.stringify({
          year: {
            reach: (yt.total_views || 0) + (ig.total_reach || 0),
            leads: meta.total_leads || 0,
            investment: meta.total_spend || 0
          },
          community: {
            total: (latestYt?.subscribers || 0) + (latestIg?.followers || 0),
            youtube: latestYt?.subscribers || 0,
            instagram: latestIg?.followers || 0
          }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 2.0 YouTube Top Videos
      if (request.method === 'GET' && url.pathname === '/youtube-top-videos') {
        const { results } = await env.DB.prepare(
          'SELECT id, title, youtube_id, views, likes, pillar, created_at FROM videos ORDER BY views DESC LIMIT 10'
        ).all();
        return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 2.1 YouTube Monthly Stats
      if (request.method === 'GET' && url.pathname === '/youtube-monthly-stats') {
        const currentYear = new Date().getFullYear().toString();
        const { results } = await env.DB.prepare(
          `SELECT strftime('%Y-%m', date) as month, MAX(subscribers) as subscribers, MAX(views) as views
           FROM youtube_history WHERE date LIKE ? GROUP BY month ORDER BY month ASC`
        ).bind(`${currentYear}%`).all();
        const chartData = (results as any[]).map(r => ({
          name: r.month, inscritos: r.subscribers || 0, views: r.views || 0,
        }));
        return new Response(JSON.stringify(chartData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 2.2 YouTube Upload Frequency (videos per month)
      if (request.method === 'GET' && url.pathname === '/youtube-upload-frequency') {
        const { results } = await env.DB.prepare(
          `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
           FROM videos GROUP BY month ORDER BY month DESC LIMIT 12`
        ).all();
        return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 2.3 Instagram Monthly Reach
      if (request.method === 'GET' && url.pathname === '/instagram-monthly') {
        const currentYear = new Date().getFullYear().toString();
        const { results } = await env.DB.prepare(
          `SELECT strftime('%Y-%m', date) as month, SUM(reach) as total_reach, MAX(followers) as followers
           FROM instagram_history WHERE date LIKE ? GROUP BY month ORDER BY month ASC`
        ).bind(`${currentYear}%`).all();
        const chartData = (results as any[]).map(r => ({
          name: r.month, alcance: r.total_reach || 0, seguidores: r.followers || 0,
        }));
        return new Response(JSON.stringify(chartData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 1.8.1 Endpoint Instagram History (From DB)
      if (request.method === 'GET' && url.pathname === '/instagram-history') {
        const { results } = await env.DB.prepare('SELECT * FROM instagram_history ORDER BY date ASC').all();
        const chartData = results.map((row: any) => ({
          name: row.date.split('-').slice(1).reverse().join('/'),
          alcance: row.reach,
          seguidores: row.followers
        }));
        return new Response(JSON.stringify(chartData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 2. Videos CRUD
      if (url.pathname === '/videos') {
        // GET /videos
        if (request.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT * FROM videos ORDER BY created_at DESC').all();
          return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // POST /videos (Add or Update)
        if (request.method === 'POST') {
          const body: any = await request.json();
          const { id, title, youtube_id, pillar, status, tags, journey_stage, focus_keyword, persona, pain_point, problem_solved } = body;
          
          const existing = await env.DB.prepare('SELECT id FROM videos WHERE id = ?').bind(id).first();
          
          if (existing) {
            await env.DB.prepare(
              'UPDATE videos SET title = ?, youtube_id = ?, pillar = ?, status = ?, tags = ?, journey_stage = ?, focus_keyword = ?, persona = ?, pain_point = ?, problem_solved = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).bind(title, youtube_id || null, pillar, status, tags || null, journey_stage || null, focus_keyword || null, persona || null, pain_point || null, problem_solved || null, id).run();
          } else {
            await env.DB.prepare(
              'INSERT INTO videos (id, title, youtube_id, pillar, status, tags, journey_stage, focus_keyword, persona, pain_point, problem_solved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(id, title, youtube_id || null, pillar, status, tags || null, journey_stage || null, focus_keyword || null, persona || null, pain_point || null, problem_solved || null).run();
          }
          
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // DELETE /videos/:id
      if (request.method === 'DELETE' && url.pathname.startsWith('/videos/')) {
        const id = url.pathname.split('/videos/')[1];
        await env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 4. Financial Goals
      if (url.pathname === '/financial-goals') {
        if (request.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT * FROM financial_goals ORDER BY id ASC').all();
          return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (request.method === 'POST') {
          const body: any = await request.json();
          const { id, target_revenue } = body;
          
          const existing = await env.DB.prepare('SELECT id FROM financial_goals WHERE id = ?').bind(id).first();
          
          if (existing) {
            await env.DB.prepare(
              'UPDATE financial_goals SET target_revenue = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).bind(target_revenue || 0, id).run();
          } else {
            await env.DB.prepare(
              'INSERT INTO financial_goals (id, target_revenue) VALUES (?, ?)'
            ).bind(id, target_revenue || 0).run();
          }
          
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // 5. Transactions
      if (url.pathname === '/transactions') {
        if (request.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT * FROM transactions ORDER BY date DESC, created_at DESC').all();
          return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (request.method === 'POST') {
          const body: any = await request.json();
          const { id, date, type, amount, description, category } = body;
          
          const existing = await env.DB.prepare('SELECT id FROM transactions WHERE id = ?').bind(id).first();
          
          if (existing) {
            await env.DB.prepare(
              'UPDATE transactions SET date = ?, type = ?, amount = ?, description = ?, category = ? WHERE id = ?'
            ).bind(date, type, amount, description, category || null, id).run();
          } else {
            await env.DB.prepare(
              'INSERT INTO transactions (id, date, type, amount, description, category) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(id, date, type, amount, description, category || null).run();
          }
          
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      if (request.method === 'DELETE' && url.pathname.startsWith('/transactions/')) {
        const id = url.pathname.split('/transactions/')[1];
        await env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 3. Sync YouTube Videos Stats
      if (request.method === 'POST' && url.pathname === '/sync-youtube') {
        const { results } = await env.DB.prepare('SELECT id, youtube_id FROM videos WHERE youtube_id IS NOT NULL').all();
        
        if (results && results.length > 0) {
          const videoIds = results.map((v: any) => v.youtube_id).join(',');
          const ytUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${env.YOUTUBE_API_KEY}`;
          
          const response = await fetch(ytUrl);
          const data = await response.json() as any;
          
          if (data.items) {
            const updates = [];
            for (const item of data.items) {
              updates.push(
                env.DB.prepare('UPDATE videos SET views = ?, likes = ?, updated_at = CURRENT_TIMESTAMP WHERE youtube_id = ?')
                  .bind(item.statistics.viewCount || 0, item.statistics.likeCount || 0, item.id)
              );
            }
            if (updates.length > 0) {
              await env.DB.batch(updates);
            }
          }
        }
        
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 3.1 Sync ALL YouTube Videos (New & Existing)
      if (request.method === 'POST' && url.pathname === '/sync-youtube-all') {
        const result = await syncYouTubeVideos(env);
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 3.2 Sync ALL Stats snapshot (Manual Trigger)
      if (request.method === 'POST' && url.pathname === '/sync-all-stats') {
        await this.syncAllHistoricalData(env);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // 3.3 Sync 2026 History (Retroactive)
      if (request.method === 'POST' && url.pathname === '/sync-2026') {
        const result = await this.syncHistorical2026(env);
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 6. Automation Rules
      if (url.pathname === '/automation-rules') {
        if (request.method === 'GET') {
          const { results } = await env.DB.prepare('SELECT * FROM automation_rules ORDER BY created_at DESC').all();
          return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (request.method === 'POST') {
          const body: any = await request.json();
          const { id, trigger_keyword, response_message, active } = body;
          await env.DB.prepare(
            'INSERT OR REPLACE INTO automation_rules (id, trigger_keyword, response_message, active) VALUES (?, ?, ?, ?)'
          ).bind(id || Math.random().toString(36).substring(7), trigger_keyword, response_message, active ?? 1).run();
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      if (request.method === 'DELETE' && url.pathname.startsWith('/automation-rules/')) {
        const id = url.pathname.split('/automation-rules/')[1];
        await env.DB.prepare('DELETE FROM automation_rules WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 7. Instagram Webhook
      if (url.pathname === '/webhook') {
        // GET: Verification
        if (request.method === 'GET') {
          const mode = url.searchParams.get('hub.mode');
          const token = url.searchParams.get('hub.verify_token');
          const challenge = url.searchParams.get('hub.challenge');
          
          if (mode === 'subscribe' && token === 'partnerhub_secret_2026') {
            return new Response(challenge);
          }
          return new Response('Forbidden', { status: 403 });
        }

        // POST: Notification
        if (request.method === 'POST') {
          const body: any = await request.json();
          ctx.waitUntil(this.handleInstagramWebhook(body, env));
          return new Response('EVENT_RECEIVED');
        }
      }

      // Backward compatibility for dashboard request
      if (request.method === 'GET' && url.pathname === '/') {
        return new Response(JSON.stringify({ error: 'Use /channel-stats' }), { status: 400, headers: corsHeaders });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    try {
      const ytUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${env.YOUTUBE_CHANNEL_ID}&key=${env.YOUTUBE_API_KEY}`;
      const response = await fetch(ytUrl);
      const data = await response.json() as any;
      
      if (data.items && data.items.length > 0) {
        const stats = data.items[0].statistics;
        const today = new Date().toISOString().split('T')[0];
        
        await env.DB.prepare(
          'INSERT OR REPLACE INTO youtube_history (date, subscribers, views, videos) VALUES (?, ?, ?, ?)'
        ).bind(
          today, 
          parseInt(stats.subscriberCount || '0', 10), 
          parseInt(stats.viewCount || '0', 10), 
          parseInt(stats.videoCount || '0', 10)
        ).run();
      }

      // Sync videos as well
      await syncYouTubeVideos(env);

      // Sync Instagram and Meta snapshots
      await this.syncAllHistoricalData(env);

    } catch (error) {
      console.error('Erro no cron do youtube:', error);
    }
  },

  async syncAllHistoricalData(env: Env) {
    const today = new Date().toISOString().split('T')[0];

    // 1. YouTube Stats Snapshot (Already done in scheduled, but good for manual sync)
    try {
      const ytUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${env.YOUTUBE_CHANNEL_ID}&key=${env.YOUTUBE_API_KEY}`;
      const ytRes = await fetch(ytUrl);
      const ytData = await ytRes.json() as any;
      if (ytData.items?.length > 0) {
        const s = ytData.items[0].statistics;
        await env.DB.prepare('INSERT OR REPLACE INTO youtube_history (date, subscribers, views, videos) VALUES (?, ?, ?, ?)').bind(today, parseInt(s.subscriberCount || '0'), parseInt(s.viewCount || '0'), parseInt(s.videoCount || '0')).run();
      }
    } catch (e) {}

    // 2. Instagram Stats Snapshot
    try {
      if (env.META_ACCESS_TOKEN && env.META_IG_ACCOUNT_ID) {
        const token = env.META_ACCESS_TOKEN;
        const igId = env.META_IG_ACCOUNT_ID;
        
        // Followers
        const profileRes = await fetch(`https://graph.facebook.com/v19.0/${igId}?fields=followers_count&access_token=${token}`);
        const profileData = await profileRes.json() as any;
        
        // Reach (last 24h)
        const reachRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/insights?metric=reach&period=day&access_token=${token}`);
        const reachData = await reachRes.json() as any;
        const dailyReach = reachData.data?.[0]?.values?.[0]?.value || 0;

        await env.DB.prepare('INSERT OR REPLACE INTO instagram_history (date, followers, reach) VALUES (?, ?, ?)').bind(today, profileData.followers_count || 0, dailyReach).run();
      }
    } catch (e) {}

    // 3. Meta Ads Stats Snapshot
    try {
      if (env.META_ACCESS_TOKEN && env.META_AD_ACCOUNT_ID) {
        const fbUrl = `https://graph.facebook.com/v19.0/${env.META_AD_ACCOUNT_ID}/insights?date_preset=today&fields=spend,actions&access_token=${env.META_ACCESS_TOKEN}`;
        const fbRes = await fetch(fbUrl);
        const fbData = await fbRes.json() as any;
        
        if (fbData.data?.length > 0) {
          const stats = fbData.data[0];
          const leadsAction = stats.actions?.find((a: any) => a.action_type === 'lead') || 
                              stats.actions?.find((a: any) => a.action_type === 'offsite_conversion.fb_pixel_lead');
          const leads = leadsAction ? parseInt(leadsAction.value, 10) : 0;
          const spend = parseFloat(stats.spend || 0);
          const cpl = leads > 0 ? spend / leads : 0;

          await env.DB.prepare('INSERT OR REPLACE INTO meta_history (date, spend, leads, cpl) VALUES (?, ?, ?, ?)').bind(today, spend, leads, cpl).run();
        }
      }
    } catch (e) {}
  },

  async syncHistorical2026(env: Env) {
    const results: any = { meta: 0, instagram: 0 };
    const token = env.META_ACCESS_TOKEN;
    if (!token) return { error: 'Token ausente' };

    // 1. Meta Ads History (Whole Year)
    try {
      if (env.META_AD_ACCOUNT_ID) {
        const fbUrl = `https://graph.facebook.com/v19.0/${env.META_AD_ACCOUNT_ID}/insights?time_range={"since":"2026-01-01","until":"2026-12-31"}&time_increment=1&fields=spend,actions&access_token=${token}`;
        const res = await fetch(fbUrl);
        const data = await res.json() as any;
        if (data.data) {
          const updates = [];
          for (const day of data.data) {
            const leadsAction = day.actions?.find((a: any) => a.action_type === 'lead') || 
                                day.actions?.find((a: any) => a.action_type === 'offsite_conversion.fb_pixel_lead');
            const leads = leadsAction ? parseInt(leadsAction.value, 10) : 0;
            const spend = parseFloat(day.spend || 0);
            const cpl = leads > 0 ? spend / leads : 0;
            updates.push(env.DB.prepare('INSERT OR REPLACE INTO meta_history (date, spend, leads, cpl) VALUES (?, ?, ?, ?)').bind(day.date_start, spend, leads, cpl));
          }
          if (updates.length > 0) {
            await env.DB.batch(updates);
            results.meta = updates.length;
          }
        }
      }
    } catch (e) { results.meta_error = e.message; }

    // 2. Instagram Reach History (Chunks of 30 days)
    try {
      if (env.META_IG_ACCOUNT_ID) {
        const igId = env.META_IG_ACCOUNT_ID;
        const chunks = [
          { s: '2026-01-01', u: '2026-01-30' },
          { s: '2026-01-31', u: '2026-03-01' },
          { s: '2026-03-02', u: '2026-03-31' },
          { s: '2026-04-01', u: '2026-04-30' }
        ];

        let totalIg = 0;
        for (const chunk of chunks) {
          const igUrl = `https://graph.facebook.com/v19.0/${igId}/insights?metric=reach&period=day&since=${chunk.s}&until=${chunk.u}&access_token=${token}`;
          const res = await fetch(igUrl);
          const data = await res.json() as any;
          if (data.data?.[0]?.values) {
            const updates = [];
            for (const val of data.data[0].values) {
              const date = val.end_time.split('T')[0];
              updates.push(env.DB.prepare('INSERT OR REPLACE INTO instagram_history (date, reach) VALUES (?, ?)').bind(date, val.value));
            }
            if (updates.length > 0) {
              await env.DB.batch(updates);
              totalIg += updates.length;
            }
          }
        }
        results.instagram = totalIg;
      }
    } catch (e) { results.ig_error = e.message; }

    return results;
  },

  async handleInstagramWebhook(body: any, env: Env) {
    if (body.object !== 'instagram') return;

    for (const entry of body.entry) {
      if (!entry.changes) continue;
      
      for (const change of entry.changes) {
        if (change.field === 'comments') {
          const comment = change.value;
          const commentText = comment.text.toLowerCase();
          const commentId = comment.id;
          const fromId = comment.from.id;

          // Fetch active rules
          const { results: rules } = await env.DB.prepare('SELECT * FROM automation_rules WHERE active = 1').all();
          
          for (const rule of rules as any) {
            if (commentText.includes(rule.trigger_keyword.toLowerCase())) {
              // Trigger matched! Send DM
              await this.sendInstagramDM(fromId, rule.response_message, env);
              console.log(`Auto-response sent to ${fromId} for comment: ${commentText}`);
            }
          }
        }
      }
    }
  },

  async sendInstagramDM(recipientId: string, message: string, env: Env) {
    if (!env.META_ACCESS_TOKEN || !env.META_IG_ACCOUNT_ID) return;
    
    const url = `https://graph.facebook.com/v19.0/${env.META_IG_ACCOUNT_ID}/messages`;
    const body = {
      recipient: { id: recipientId },
      message: { text: message }
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.META_ACCESS_TOKEN}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('Error sending Instagram DM:', e);
    }
  }
};

async function syncYouTubeVideos(env: Env) {
  try {
    const uploadsPlaylistId = env.YOUTUBE_CHANNEL_ID.replace('UC', 'UU');
    let nextPageToken = '';
    let totalSynced = 0;

    do {
      const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&pageToken=${nextPageToken}&key=${env.YOUTUBE_API_KEY}`;
      const playlistRes = await fetch(playlistUrl);
      const playlistData = await playlistRes.json() as any;

      if (playlistData.items && playlistData.items.length > 0) {
        const videoIds = playlistData.items.map((item: any) => item.snippet.resourceId.videoId).join(',');
        const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${env.YOUTUBE_API_KEY}`;
        
        const statsRes = await fetch(statsUrl);
        const statsData = await statsRes.json() as any;

        if (statsData.items) {
          const updates = [];
          for (const video of statsData.items) {
            // Use youtube_id as a unique identifier to check if it exists
            const existing = await env.DB.prepare('SELECT id FROM videos WHERE youtube_id = ?').bind(video.id).first();
            
            if (existing) {
              updates.push(
                env.DB.prepare('UPDATE videos SET title = ?, views = ?, likes = ?, updated_at = CURRENT_TIMESTAMP WHERE youtube_id = ?')
                  .bind(video.snippet.title, parseInt(video.statistics.viewCount || '0'), parseInt(video.statistics.likeCount || '0'), video.id)
              );
            } else {
              // New video from YouTube
              updates.push(
                env.DB.prepare('INSERT INTO videos (id, title, youtube_id, pillar, status, views, likes) VALUES (?, ?, ?, ?, ?, ?, ?)')
                  .bind(video.id, video.snippet.title, video.id, 'diagnostic', 'published', parseInt(video.statistics.viewCount || '0'), parseInt(video.statistics.likeCount || '0'))
              );
            }
          }
          if (updates.length > 0) {
            await env.DB.batch(updates);
          }
          totalSynced += statsData.items.length;
        }
      }

      nextPageToken = playlistData.nextPageToken || '';
    } while (nextPageToken);

    return { success: true, totalSynced };
  } catch (error: any) {
    console.error('Sync YouTube error:', error);
    return { success: false, error: error.message };
  }
}
