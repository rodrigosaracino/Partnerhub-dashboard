// App
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

import { SWRConfig } from 'swr';

function App() {
  return (
    <SWRConfig 
      value={{
        fetcher: (url: string) => fetch(url).then(res => res.json()),
        revalidateOnFocus: false,      // não revalida ao focar a janela
        revalidateIfStale: false,      // não revalida se já tem dados em cache
        revalidateOnReconnect: false,  // não revalida ao reconectar
        dedupingInterval: 5 * 60 * 1000, // cache de 5 minutos
      }}
    >
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardMix />} />
          <Route path="instagram" element={<DashboardInstagram />} />
          <Route path="youtube" element={<DashboardYoutube />} />
          <Route path="finance" element={<Finance />} />
          <Route path="automations" element={<Automations />} />
          <Route path="strategy" element={<Strategy />} />
          <Route path="content" element={<Content />} />
          <Route path="competitors" element={<Competitors />} />
          <Route path="benchmark" element={<Benchmark />} />
          <Route path="docs" element={<div style={{padding:'2rem',color:'var(--text-secondary)'}}>Página não disponível.</div>} />
          <Route path="settings" element={<div className="p-4">Configurações</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
    </SWRConfig>
  );
}

export default App;
