// App
import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { Strategy } from './pages/Strategy';
import { Content } from './pages/Content';
import { Finance } from './pages/Finance';
import { Automations } from './pages/Automations';
import { DashboardMix } from './pages/DashboardMix';
import { DashboardInstagram } from './pages/DashboardInstagram';
import { DashboardYoutube } from './pages/DashboardYoutube';
import { Competitors } from './pages/Competitors';
import { Benchmark } from './pages/Benchmark';
import { Goals } from './pages/Goals';
import { Calendar } from './pages/Calendar';
import { Login, getToken, clearToken } from './pages/Login';

import { SWRConfig } from 'swr';

function authFetcher(url: string) {
  const token = getToken();
  return fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(async res => {
    if (res.status === 401) {
      // Only log out on actual JWT failures, not on feature-level auth errors (403)
      const data = await res.json();
      const isJwtFailure = data?.error === 'Não autenticado' || data?.error === 'Token inválido ou expirado';
      if (isJwtFailure) {
        clearToken();
        window.location.reload();
      }
      return data;
    }
    return res.json();
  });
}

function App() {
  const [authed, setAuthed] = useState(() => !!getToken());

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  return (
    <SWRConfig
      value={{
        fetcher: authFetcher,
        revalidateOnFocus: false,
        revalidateIfStale: false,
        revalidateOnReconnect: false,
        dedupingInterval: 5 * 60 * 1000,
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout onLogout={() => { clearToken(); setAuthed(false); }} />}>
            <Route index element={<DashboardMix />} />
            <Route path="instagram" element={<DashboardInstagram />} />
            <Route path="youtube" element={<DashboardYoutube />} />
            <Route path="finance" element={<Finance />} />
            <Route path="automations" element={<Automations />} />
            <Route path="strategy" element={<Strategy />} />
            <Route path="content" element={<Content />} />
            <Route path="competitors" element={<Competitors />} />
            <Route path="benchmark" element={<Benchmark />} />
            <Route path="goals"     element={<Goals />} />
            <Route path="calendar"  element={<Calendar />} />
            <Route path="docs" element={<div style={{padding:'2rem',color:'var(--text-secondary)'}}>Página não disponível.</div>} />
            <Route path="settings" element={<div className="p-4">Configurações</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SWRConfig>
  );
}

export default App;
