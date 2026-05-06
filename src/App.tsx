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

import { SWRConfig } from 'swr';

function App() {
  return (
    <SWRConfig 
      value={{
        fetcher: (url: string) => fetch(url).then(res => res.json()),
        revalidateOnFocus: true,
        dedupingInterval: 5000,
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
          <Route path="docs" element={<div style={{padding:'2rem',color:'var(--text-secondary)'}}>Página não disponível.</div>} />
          <Route path="settings" element={<div className="p-4">Configurações</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
    </SWRConfig>
  );
}

export default App;
