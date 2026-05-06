import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Badge } from '../components/Badge';

export function Strategy() {
  const [activeTab, setActiveTab] = useState<'vision' | 'persona' | 'funnel'>('vision');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Formalização da Estratégia</h1>
          <p className="text-muted">Documentação central do PartnerHub baseada no plano de negócios.</p>
        </div>
      </div>

      <div className="flex gap-4 border-b pb-4">
        <button 
          onClick={() => setActiveTab('vision')}
          className={`pb-2 px-2 font-semibold ${activeTab === 'vision' ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]' : 'text-muted'}`}
        >
          Visão e Posicionamento
        </button>
        <button 
          onClick={() => setActiveTab('persona')}
          className={`pb-2 px-2 font-semibold ${activeTab === 'persona' ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]' : 'text-muted'}`}
        >
          Persona e Avatar
        </button>
        <button 
          onClick={() => setActiveTab('funnel')}
          className={`pb-2 px-2 font-semibold ${activeTab === 'funnel' ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]' : 'text-muted'}`}
        >
          Funil e Produtos
        </button>
      </div>

      <div className="mt-4">
        {activeTab === 'vision' && <VisionTab />}
        {activeTab === 'persona' && <PersonaTab />}
        {activeTab === 'funnel' && <FunnelTab />}
      </div>
    </div>
  );
}

function VisionTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Missão</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">
            Capacitar donos de pequenos e médios negócios a conquistarem autonomia na gestão do próprio tráfego pago, 
            eliminando a dependência de agências e devolvendo o controle do marketing pra quem mais entende do negócio: 
            o próprio empreendedor.
          </p>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Visão de 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">
            Ser reconhecido no YouTube como a principal referência em gestão de tráfego pago para pequenos e médios 
            empreendedores que querem aprender a fazer por conta própria, com uma audiência qualificada que vê o canal 
            como alternativa séria aos influenciadores genéricos de marketing.
          </p>
        </CardContent>
      </Card>

      <Card className="glass-panel md:col-span-2">
        <CardHeader>
          <CardTitle>Posicionamento Único & Promessa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <h4 className="font-semibold text-sm mb-2 text-[var(--accent-secondary)]">Promessa Central</h4>
            <p className="text-lg italic font-medium">"Você não precisa de agência. Você precisa entender como o jogo funciona — e isso eu ensino."</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-2">Valores</h4>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="info">Honestidade direta</Badge>
              <Badge variant="info">Autonomia como objetivo</Badge>
              <Badge variant="info">Prova sobre narrativa</Badge>
              <Badge variant="info">Acessibilidade técnica</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PersonaTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Perfil Demográfico</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          <ul className="list-disc pl-4 space-y-2">
            <li><strong className="text-white">Idade:</strong> 30 a 50 anos</li>
            <li><strong className="text-white">Gênero:</strong> Predominantemente masculino</li>
            <li><strong className="text-white">Renda pessoal:</strong> R$ 8.000 a R$ 30.000/mês</li>
            <li><strong className="text-white">Faturamento do negócio:</strong> R$ 20.000 a R$ 300.000/mês</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Dores Centrais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Badge variant="danger">Já tentei e não funcionou</Badge>
            <Badge variant="danger">Não sei de onde vem o próximo cliente</Badge>
            <Badge variant="danger">Não confio em agência</Badge>
            <Badge variant="warning">Orçamento limitado</Badge>
            <Badge variant="warning">Falta de tempo e clareza</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FunnelTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="glass-panel">
        <CardHeader>
          <Badge variant="success" className="mb-2">Entrada</Badge>
          <CardTitle>Curso de Entrada</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="text-2xl font-bold mb-4">R$ 297–497</p>
          <p className="text-muted mb-2">Primeiro Cliente pelo Google</p>
          <p className="text-xs text-[var(--text-tertiary)]">Quebrar objeção de preço, provar valor e conseguir o primeiro cliente em 30 dias.</p>
        </CardContent>
      </Card>

      <Card className="glass-panel border border-[var(--accent-primary)]">
        <CardHeader>
          <Badge variant="info" className="mb-2">Produto Principal</Badge>
          <CardTitle>Mentoria Ads Sem Agência</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="text-2xl font-bold mb-4 text-gradient">R$ 1.997</p>
          <p className="text-muted mb-2">Dominar Google Ads em 90 dias</p>
          <p className="text-xs text-[var(--text-tertiary)]">Programa em grupo com acesso a comunidade, encontros semanais e suporte.</p>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <Badge variant="neutral" className="mb-2">Premium</Badge>
          <CardTitle>Consultoria / Serviço</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="text-2xl font-bold mb-4">R$ 5.000+</p>
          <p className="text-muted mb-2">Serviços sob demanda</p>
          <p className="text-xs text-[var(--text-tertiary)]">Auditorias, setup de campanhas para quem não quer aprender, só executar.</p>
        </CardContent>
      </Card>
    </div>
  );
}
