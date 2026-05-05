import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Save, Plus, Target, Trash2, ArrowUpCircle, ArrowDownCircle, Edit2, Check, X } from 'lucide-react';

interface FinancialGoal {
  id: string; // YYYY-MM
  target_revenue: number;
}

interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: string;
}

const API_URL = 'http://127.0.0.1:8787';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function Finance() {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States for Goal Form
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [goalMonth, setGoalMonth] = useState('');
  const [goalValue, setGoalValue] = useState('');

  // States for Transaction Form
  const [isTxFormOpen, setIsTxFormOpen] = useState(false);
  const [txId, setTxId] = useState('');
  const [txDate, setTxDate] = useState('');
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [goalsRes, txRes] = await Promise.all([
        fetch(`${API_URL}/financial-goals`),
        fetch(`${API_URL}/transactions`)
      ]);
      if (goalsRes.ok && txRes.ok) {
        setGoals(await goalsRes.json());
        setTransactions(await txRes.json());
      }
    } catch (e) {
      console.error('Erro ao buscar dados financeiros', e);
    } finally {
      setLoading(false);
    }
  };

  const openGoalForm = () => {
    const today = new Date();
    setGoalMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    setGoalValue('');
    setIsGoalFormOpen(true);
    setIsTxFormOpen(false);
  };

  const openTxForm = (tx?: Transaction) => {
    if (tx) {
      setTxId(tx.id);
      setTxDate(tx.date);
      setTxType(tx.type);
      setTxAmount(tx.amount.toString());
      setTxDescription(tx.description);
      setTxCategory(tx.category || '');
    } else {
      setTxId(crypto.randomUUID());
      const today = new Date();
      setTxDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
      setTxType('income');
      setTxAmount('');
      setTxDescription('');
      setTxCategory('');
    }
    setIsTxFormOpen(true);
    setIsGoalFormOpen(false);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalMonth) return;
    try {
      await fetch(`${API_URL}/financial-goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: goalMonth, target_revenue: parseFloat(goalValue) || 0 })
      });
      await fetchData();
      setIsGoalFormOpen(false);
    } catch (e) {
      console.error('Erro ao salvar meta', e);
    }
  };

  const handleSaveTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txDate || !txDescription || !txAmount) return;
    try {
      await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: txId,
          date: txDate,
          type: txType,
          amount: parseFloat(txAmount) || 0,
          description: txDescription,
          category: txCategory || 'Geral'
        })
      });
      await fetchData();
      setIsTxFormOpen(false);
    } catch (e) {
      console.error('Erro ao salvar transação', e);
    }
  };

  const handleDeleteTx = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConfirmDeleteId(null);
        await fetchData();
      }
    } catch (e) {
      console.error('Erro ao apagar transação', e);
    }
  };

  // Prepare Chart Data (Aggregate by Month)
  const chartDataMap: Record<string, { month: string, target: number, income: number, expense: number, profit: number }> = {};
  
  // Fill goals first
  goals.forEach(g => {
    chartDataMap[g.id] = { month: g.id, target: g.target_revenue, income: 0, expense: 0, profit: 0 };
  });

  // Aggregate transactions
  transactions.forEach(tx => {
    const month = tx.date.substring(0, 7); // YYYY-MM
    if (!chartDataMap[month]) {
      chartDataMap[month] = { month, target: 0, income: 0, expense: 0, profit: 0 };
    }
    if (tx.type === 'income') {
      chartDataMap[month].income += tx.amount;
    } else {
      chartDataMap[month].expense += tx.amount;
    }
    chartDataMap[month].profit = chartDataMap[month].income - chartDataMap[month].expense;
  });

  const chartData = Object.values(chartDataMap).sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">Gestão Financeira</h1>
          <p className="text-muted">Lançamentos de Livro Caixa e acompanhamento de metas.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openGoalForm} variant="secondary" icon={<Target size={16} />}>
            Definir Meta do Mês
          </Button>
          <Button onClick={() => openTxForm()} icon={<Plus size={16} />}>
            Novo Lançamento
          </Button>
        </div>
      </div>

      {/* Resumo Rápido do Mês Atual */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-[var(--border-color)]">
          <p className="text-sm text-muted mb-1">Receita do Mês Atual</p>
          <p className="text-xl font-bold text-[var(--success)]">
            {formatCurrency(chartDataMap[`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`]?.income || 0)}
          </p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-[var(--border-color)]">
          <p className="text-sm text-muted mb-1">Despesa do Mês Atual</p>
          <p className="text-xl font-bold text-[var(--danger)]">
            {formatCurrency(chartDataMap[`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`]?.expense || 0)}
          </p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-[var(--border-color)]">
          <p className="text-sm text-muted mb-1">Meta do Mês Atual</p>
          <p className="text-xl font-bold text-[var(--accent-secondary)]">
            {formatCurrency(chartDataMap[`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`]?.target || 0)}
          </p>
        </div>
      </div>

      {isGoalFormOpen && (
        <Card className="glass-panel border border-[var(--accent-secondary)]">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Definir Meta Mensal</h3>
            <form onSubmit={handleSaveGoal} className="flex gap-4 items-end">
              <div className="flex-1">
                <Input label="Mês (YYYY-MM)" value={goalMonth} onChange={e => setGoalMonth(e.target.value)} placeholder="Ex: 2026-01" />
              </div>
              <div className="flex-1">
                <Input label="Meta de Receita (R$)" type="number" step="0.01" value={goalValue} onChange={e => setGoalValue(e.target.value)} />
              </div>
              <Button type="submit" icon={<Save size={16}/>}>Salvar Meta</Button>
              <Button type="button" variant="ghost" onClick={() => setIsGoalFormOpen(false)}>Cancelar</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isTxFormOpen && (
        <Card className="glass-panel border border-[var(--accent-primary)]">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Lançamento no Livro Caixa</h3>
            <form onSubmit={handleSaveTx} className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-1/4">
                  <Input label="Data" type="date" value={txDate} onChange={e => setTxDate(e.target.value)} />
                </div>
                <div className="w-full md:w-1/4">
                  <label className="input-label block mb-2">Tipo</label>
                  <select 
                    className="input-field w-full h-[42px]"
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as 'income' | 'expense')}
                  >
                    <option value="income">Receita (Entrada)</option>
                    <option value="expense">Despesa (Saída)</option>
                  </select>
                </div>
                <div className="w-full md:w-1/4">
                  <Input label="Valor (R$)" type="number" step="0.01" value={txAmount} onChange={e => setTxAmount(e.target.value)} />
                </div>
                <div className="w-full md:w-1/4">
                  <Input label="Categoria" value={txCategory} onChange={e => setTxCategory(e.target.value)} placeholder="Ex: Venda, Software, Imposto" />
                </div>
              </div>
              <div className="w-full">
                <Input label="Descrição do Lançamento" value={txDescription} onChange={e => setTxDescription(e.target.value)} placeholder="Ex: Venda Curso XYZ" />
              </div>
              <div className="flex gap-2 justify-end mt-2">
                <Button type="button" variant="ghost" onClick={() => setIsTxFormOpen(false)}>Cancelar</Button>
                <Button type="submit" icon={<Save size={16}/>}>Salvar Lançamento</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Fluxo de Caixa (Meta vs Realizado)</CardTitle>
        </CardHeader>
        <CardContent style={{ height: '320px' }}>
          {loading ? (
            <div className="h-full flex items-center justify-center text-muted">Carregando gráfico...</div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted">Nenhum lançamento no sistema.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--text-tertiary)" />
                <YAxis 
                  stroke="var(--text-tertiary)" 
                  tickFormatter={(value) => `R$ ${value / 1000}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: 'var(--text-secondary)', marginBottom: '8px' }}
                />
                <Legend />
                <Bar dataKey="income" name="Receitas" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="expense" name="Despesas" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line 
                  type="monotone" 
                  dataKey="target" 
                  name="Meta de Receita" 
                  stroke="var(--accent-secondary)" 
                  strokeDasharray="5 5" 
                  strokeWidth={3} 
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel overflow-hidden">
        <CardHeader>
          <CardTitle>Livro Caixa (Últimos Lançamentos)</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="p-4 font-semibold text-sm text-muted">Data</th>
                <th className="p-4 font-semibold text-sm text-muted">Descrição / Categoria</th>
                <th className="p-4 font-semibold text-sm text-muted text-right">Valor</th>
                <th className="p-4 font-semibold text-sm text-muted text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && !loading && (
                <tr><td colSpan={4} className="p-8 text-center text-muted">Nenhuma transação registrada.</td></tr>
              )}
              {transactions.map(tx => (
                <tr key={tx.id} className="border-b border-[var(--border-color)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="p-4 font-medium text-sm">
                    {tx.date.split('-').reverse().join('/')}
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {tx.type === 'income' ? <ArrowUpCircle size={14} className="text-[var(--success)]" /> : <ArrowDownCircle size={14} className="text-[var(--danger)]" />}
                      {tx.description}
                    </div>
                    {tx.category && <span className="text-[10px] uppercase tracking-wider text-muted mt-1 block">{tx.category}</span>}
                  </td>
                  <td className={`p-4 text-right font-medium text-sm ${tx.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end items-center gap-1">
                      {confirmDeleteId === tx.id ? (
                        <>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: '0.25rem' }}>Apagar?</span>
                          <button
                            type="button"
                            style={{ padding: '0.25rem 0.6rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '0.375rem', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}
                            onClick={(e) => { e.stopPropagation(); handleDeleteTx(tx.id); }}
                          >
                            <Check size={13} /> Sim
                          </button>
                          <button
                            type="button"
                            style={{ padding: '0.25rem 0.6rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.375rem', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                          >
                            <X size={13} /> Não
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            title="Editar"
                            className="p-2 text-muted hover:text-white transition-colors rounded-md hover:bg-white/5"
                            onClick={(e) => { e.stopPropagation(); openTxForm(tx); }}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            title="Excluir"
                            className="p-2 text-muted hover:text-[var(--danger)] transition-colors rounded-md hover:bg-white/5"
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(tx.id); }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
