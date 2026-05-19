/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { Home, LayoutDashboard, ReceiptText, Target, Wallet, BrainCircuit, Heart, Settings, Bell, Menu, X, Plus, ChevronRight, TrendingUp, TrendingDown, DollarSign, FileUp, Upload, CheckCircle2, AlertCircle, Trash2, ShieldCheck, Sparkles, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Transaction } from './types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase, isSupabaseConfigured } from './lib/supabase';

// Navigation items
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transações', icon: ReceiptText },
  { id: 'import', label: 'Importação', icon: FileUp },
  { id: 'goals', label: 'Metas', icon: Target },
  { id: 'accounts', label: 'Contas', icon: Wallet },
  { id: 'insights', label: 'IA Insights', icon: BrainCircuit },
  { id: 'emotional', label: 'Sentimental', icon: Heart },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

import { Input } from '@/components/ui/input';
import { MainFlowChart, CategoriesPieChart, EmotionalRadarChart } from './components/Charts';
import NewTransactionDialog from './components/NewTransactionDialog';
import ImportPage from './components/ImportPage';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNewTxOpen, setIsNewTxOpen] = useState(false);

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-slate-50 font-sans">
      <Toaster position="top-right" theme="dark" />
      <NewTransactionDialog open={isNewTxOpen} onOpenChange={setIsNewTxOpen} />
      
      {/* Sidebar */}
      <aside 
        className={`fixed top-0 left-0 z-40 h-screen transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 w-64 bg-[#09090B] border-r border-slate-800 pt-5`}
      >
        <div className="px-6 pb-8 flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="text-white w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">Finna<span className="text-indigo-500">AI</span></span>
        </div>
        
        <nav className="px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id 
                  ? 'bg-slate-800/50 text-indigo-400 shadow-lg shadow-black/5' 
                  : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-100'
              }`}
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
              {item.id === 'insights' && (
                <span className="ml-auto text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30 uppercase font-bold">New</span>
              )}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-5 left-0 w-full px-6">
          <div className="bg-slate-900/40 rounded-2xl p-4 border border-slate-800">
            <p className="text-[10px] text-slate-500 mb-3 uppercase tracking-widest font-bold text-center">Fundo de Emergência</p>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mb-2">
               <div className="bg-indigo-500 h-full rounded-full" style={{ width: '68%' }}></div>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400">
               <span>R$ 6.800</span>
               <span>R$ 10.000</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`transition-all ${isSidebarOpen ? 'md:ml-64' : 'ml-0'} p-4 md:p-8 pt-20 md:pt-8`}>
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 text-slate-50">
              {NAV_ITEMS.find(i => i.id === activeTab)?.label}
            </h1>
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-indigo-500/20">Sync Ativo</span>
              Olá, Paulo. A Casa dos Silva está segura e otimizada.
            </p>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" className="rounded-full h-10 w-10 p-0 border-slate-800 hover:bg-slate-800/50 text-slate-400 hover:text-white transition-all">
                <Bell className="w-4.5 h-4.5" />
             </Button>
             <Button 
                onClick={() => setIsNewTxOpen(true)}
                className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 h-10 group transition-all"
              >
                <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
                Novo Gasto
             </Button>
          </div>
        </header>

        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'transactions' && <TransactionsPage />}
        {activeTab === 'insights' && <InsightsPage />}
        {activeTab === 'import' && <ImportPage />}
        {activeTab === 'emotional' && <EmotionalPage />}
        {activeTab !== 'dashboard' && activeTab !== 'transactions' && activeTab !== 'insights' && activeTab !== 'emotional' && activeTab !== 'import' && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
             <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800">
                <Settings className="text-slate-500 w-8 h-8" />
             </div>
             <h3 className="text-xl font-bold mb-2 text-slate-50">Em Construção</h3>
             <p className="text-slate-400 max-w-md">Esta funcionalidade está sendo polida para oferecer a melhor experiência fintech premium para sua família.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState({ balance: 0, income: 0, expense: 0, recent: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .order('date', { ascending: false });

        if (error) throw error;

        if (data) {
          const income = data.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
          const expense = data.filter(t => t.type === 'expense').reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);
          setStats({
            balance: income - expense,
            income,
            expense,
            recent: data.slice(0, 4)
          });
        }
      } catch (err: any) {
        console.error(err);
        if (err.message === 'Failed to fetch') {
          toast.error('Não foi possível conectar ao Supabase. Verifique suas configurações.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Saldo em Contas" value={loading ? "..." : `R$ ${stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} change="+0%" icon={Wallet} trend="up" />
        <StatCard title="Receitas Mensais" value={loading ? "..." : `R$ ${stats.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} change="+0%" icon={TrendingUp} trend="up" color="green" />
        <StatCard title="Despesas Mensais" value={loading ? "..." : `R$ ${stats.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} change="+0%" icon={TrendingDown} trend="down" color="red" />
        <StatCard title="Economia do Mês" value={loading ? "..." : `R$ ${(stats.income - stats.expense).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} change="0%" icon={DollarSign} trend="up" color="blue" subtitle="da meta mensal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart Card */}
        <Card className="lg:col-span-2 bg-slate-900/40 border-slate-800 shadow-none rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-800/50 px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-slate-50">Fluxo de Caixa</CardTitle>
                <CardDescription className="text-slate-400">Acompanhamento mensal de entradas e saídas</CardDescription>
              </div>
              <SelectMonth />
            </div>
          </CardHeader>
          <CardContent className="px-8 py-10">
            <MainFlowChart />
          </CardContent>
        </Card>

        {/* Categories / Right Panel */}
        <Card className="bg-slate-900/40 border-slate-800 shadow-none rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-slate-800/50 px-8 py-6">
            <CardTitle className="text-lg font-bold text-slate-50">Distribuição Mensal</CardTitle>
          </CardHeader>
          <CardContent className="px-8 py-6 space-y-6">
            <CategoriesPieChart />
            <div className="space-y-4 pt-4">
              <CategoryProgress label="Moradia" value={45} amount="R$ 1.200" color="bg-indigo-500" />
              <CategoryProgress label="Alimentação" value={22} amount="R$ 850" color="bg-slate-500" />
              <CategoryProgress label="Lazer" value={15} amount="R$ 400" color="bg-slate-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <Card className="bg-slate-900/40 border-slate-800 shadow-none rounded-3xl overflow-hidden">
            <CardHeader className="px-8 py-6 flex flex-row items-center justify-between border-b border-slate-800/50">
              <CardTitle className="text-lg font-bold text-slate-50">Últimas Transações</CardTitle>
              <Button variant="link" className="text-indigo-400 font-bold text-sm">Ver todas</Button>
            </CardHeader>
            <CardContent className="px-8 py-6">
               <div className="space-y-4">
                  {loading ? (
                    <div className="py-10 text-center text-slate-500">Caregando...</div>
                  ) : stats.recent.length > 0 ? (
                    stats.recent.map((tx: any) => (
                      <TransactionItem 
                        key={tx.id}
                        title={tx.description} 
                        date={format(new Date(tx.date), "dd MMM", { locale: ptBR })} 
                        amount={`${tx.type === 'income' ? '+' : '-'} R$ ${Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                        category={tx.category} 
                        type={tx.type} 
                      />
                    ))
                  ) : (
                    <div className="py-10 text-center text-slate-500 italic">Nenhuma transação registrada.</div>
                  )}
               </div>
            </CardContent>
         </Card>

         <Card className="bg-indigo-600 border-none shadow-none rounded-3xl text-white overflow-hidden relative shadow-2xl shadow-indigo-600/20">
            <div className="absolute top-0 right-0 p-8 opacity-10">
               <BrainCircuit className="w-32 h-32" />
            </div>
            <CardHeader className="px-8 pt-8">
               <Badge className="bg-white/10 text-white border-white/20 hover:bg-white/20 mb-4 w-fit">IA Insight</Badge>
               <CardTitle className="text-2xl font-bold leading-tight">Sugestão Finna Neural</CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8 pt-4">
               <p className="text-white/70 mb-6 leading-relaxed italic">
                 {stats.balance > 0 
                   ? "Você possui saldo positivo! Que tal direcionar 20% para sua meta de investimento?" 
                   : "Suas despesas superaram as receitas. Use nossa ferramenta de importação para identificar desperdícios."}
               </p>
               <div className="flex gap-4">
                  <Button className="bg-white text-indigo-600 hover:bg-white/90 rounded-xl font-bold h-11 px-6">Ver Sugestões</Button>
               </div>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, change, icon: Icon, trend, color = 'gray', subtitle }: any) {
  return (
    <Card className="bg-slate-900/40 border-slate-800 shadow-none rounded-2xl hover:border-indigo-500/50 transition-colors cursor-default group">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2.5 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <Icon className="w-5 h-5 text-indigo-400" />
          </div>
          <Badge variant="secondary" className={`bg-transparent border-none font-bold ${trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {change}
          </Badge>
        </div>
        <div>
          <p className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-widest">{title}</p>
          <p className="text-2xl font-bold text-slate-50 tracking-tight">{value}</p>
          {subtitle && <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryProgress({ label, value, amount, color }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-slate-400">
        <span className="font-medium">{label}</span>
        <span className="font-bold text-slate-100">{amount}</span>
      </div>
      <Progress value={value} className="h-1.5 bg-slate-800" indicatorClassName={color || 'bg-indigo-500'} />
    </div>
  );
}

function TransactionItem({ title, date, amount, category, type }: any) {
  return (
    <div className="flex items-center justify-between py-1 group">
      <div className="flex items-center gap-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${type === 'income' ? 'bg-emerald-500/10' : 'bg-slate-800'}`}>
          {type === 'income' ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-rose-400" />}
        </div>
        <div>
          <p className="text-sm font-bold text-slate-100">{title}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{category} • {date}</p>
        </div>
      </div>
      <p className={`text-sm font-bold ${type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
        {amount}
      </p>
    </div>
  );
}

function SelectMonth() {
  return (
    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-400 cursor-pointer hover:bg-slate-800 hover:text-slate-100 transition-all">
      Maio 2026
      <ChevronRight className="w-3 h-3 rotate-90" />
    </div>
  );
}

function TransactionsPage() {
   const [filter, setFilter] = useState<'all' | 'expense' | 'income'>('all');
   const [search, setSearch] = useState('');
   const [transactions, setTransactions] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
     fetchTransactions();
   }, []);

   const fetchTransactions = async () => {
     setLoading(true);
     if (!isSupabaseConfigured) {
       setLoading(false);
       return;
     }
     try {
       const { data, error } = await supabase
         .from('transactions')
         .select('*')
         .order('date', { ascending: false });
       
       if (error) throw error;
       setTransactions(data || []);
     } catch (err: any) {
       console.error(err);
       toast.error('Erro ao carregar transações: ' + (err.message === 'Failed to fetch' ? 'Erro de conexão' : err.message));
     } finally {
       setLoading(false);
     }
   };

   const filteredTransactions = transactions.filter(tx => {
      const matchesFilter = filter === 'all' || tx.type === filter;
      const matchesSearch = tx.description.toLowerCase().includes(search.toLowerCase()) || 
                           tx.category.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
   });

   return (
      <div className="space-y-6">
         <Card className="bg-slate-900/40 border-slate-800 shadow-none rounded-3xl pt-6">
            <div className="px-8 pb-4 flex flex-col md:flex-row items-center justify-between border-b border-slate-800/50 gap-4">
               <div className="flex gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
                  <Button 
                    variant="ghost" 
                    onClick={() => setFilter('all')}
                    className={`rounded-lg px-6 h-9 text-[10px] font-bold uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-200'}`}
                  >
                    Todos
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setFilter('expense')}
                    className={`rounded-lg px-6 h-9 text-[10px] font-bold uppercase tracking-widest transition-all ${filter === 'expense' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-200'}`}
                  >
                    Despesas
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setFilter('income')}
                    className={`rounded-lg px-6 h-9 text-[10px] font-bold uppercase tracking-widest transition-all ${filter === 'income' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-200'}`}
                  >
                    Receitas
                  </Button>
               </div>
               <div className="relative w-full md:w-64 group">
                  <Input 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar transação..." 
                    className="rounded-xl border-slate-800 bg-slate-900/50 text-slate-200 h-11 pl-10 focus:border-indigo-500 transition-all" 
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  </div>
               </div>
            </div>
            <CardContent className="p-0">
               <div className="overflow-x-auto min-h-[400px]">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                       <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                       <p className="text-slate-500 text-sm italic">Sincronizando com Supabase...</p>
                    </div>
                  ) : filteredTransactions.length > 0 ? (
                    <table className="w-full text-left">
                      <thead className="bg-[#09090B] text-[10px] uppercase font-bold text-slate-500 tracking-widest border-b border-slate-800/50">
                          <tr>
                            <th className="px-8 py-4">Fluxo</th>
                            <th className="px-4 py-4">Categoria</th>
                            <th className="px-4 py-4">Status</th>
                            <th className="px-8 py-4 text-right">Valor</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30">
                          {filteredTransactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-800/20 transition-colors group">
                                <td className="px-8 py-5">
                                  <div className="flex flex-col">
                                      <span className="font-bold text-sm text-slate-100 italic transition-transform group-hover:translate-x-1 duration-300">{tx.description}</span>
                                      <span className="text-[10px] text-slate-500">{format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-5">
                                  <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider italic">{tx.category}</Badge>
                                </td>
                                <td className="px-4 py-5">
                                  <Badge className={`border-none px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${tx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                                    {tx.status === 'completed' ? 'Concluído' : 'Pendente'}
                                  </Badge>
                                </td>
                                <td className={`px-8 py-5 text-right font-bold text-sm ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {tx.type === 'income' ? '+' : '-'} R$ {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                       <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800">
                          <ReceiptText className="text-slate-700 w-6 h-6" />
                       </div>
                       <p className="text-slate-500 text-sm italic">Nenhuma transação encontrada para sua busca.</p>
                    </div>
                  )}
               </div>
            </CardContent>
         </Card>
      </div>
   )
}

function InsightsPage() {
   const [messages, setMessages] = useState([
     { role: 'assistant', text: 'Olá! Sou o assistente Finna AI. Analisando o fluxo de caixa dos Silva, vejo que vocês estão gastando 20% acima do planejado em Delivery.' }
   ]);
   const [input, setInput] = useState('');
   const [loading, setLoading] = useState(false);

   const sendMessage = async () => {
     if (!input.trim()) return;
     const userMsg = input;
     setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
     setInput('');
     setLoading(true);

     try {
       const res = await fetch('/api/ai/chat', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ message: userMsg, history: messages })
       });
       const data = await res.json();
       setMessages(prev => [...prev, { role: 'assistant', text: data.text }]);
     } catch (e) {
       console.error(e);
     } finally {
       setLoading(false);
     }
   };

   return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <div className="space-y-6">
            <Card className="bg-indigo-600 text-white rounded-3xl p-8 border-none overflow-hidden relative">
               <div className="absolute -bottom-10 -right-10 opacity-10">
                  <BrainCircuit className="w-64 h-64" />
               </div>
               <Badge className="bg-white/20 text-white border-white/30 mb-4 hover:bg-white/30">KazaIA Active</Badge>
               <CardTitle className="text-3xl font-bold mb-4">Advisor Especialista</CardTitle>
               <p className="text-indigo-100 mb-8 max-w-sm leading-relaxed">Padrões identificados: Você gasta mais em lazer nas sextas-feiras à noite após as 22h.</p>
               <Button className="bg-white text-indigo-600 hover:bg-white/90 rounded-xl font-bold px-8 h-12">Gerar Nova Análise</Button>
            </Card>

            <div className="space-y-4">
               <h3 className="text-lg font-bold text-slate-50 italic">Insights KazaAI</h3>
               <div className="grid gap-4">
                  {[1, 2].map((i) => (
                     <Card key={i} className="bg-slate-900/40 border-slate-800 shadow-none rounded-2xl p-6">
                        <div className="flex gap-4 items-start">
                           <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0 border border-indigo-500/20">
                              <TrendingUp className="text-indigo-400 w-5 h-5" />
                           </div>
                           <div>
                              <div className="flex items-center gap-2 mb-1">
                                 <h4 className="font-bold text-slate-100">Alerta de Assinatura</h4>
                                 <Badge className="text-[8px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 uppercase font-bold tracking-widest">IA Insight</Badge>
                              </div>
                              <p className="text-sm text-slate-400">Detectamos 3 serviços de streaming não utilizados este mês. Economia potencial: R$ 89,90.</p>
                           </div>
                        </div>
                     </Card>
                  ))}
               </div>
            </div>
         </div>

         <Card className="bg-slate-900/60 border-slate-800 shadow-none rounded-3xl flex flex-col h-[600px] overflow-hidden">
            <CardHeader className="bg-[#09090B] border-b border-slate-800 py-4 px-6 flex flex-row items-center gap-3">
               <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <BrainCircuit className="text-white w-4 h-4" />
               </div>
               <div>
                  <CardTitle className="text-sm font-bold text-slate-50">KazaAI Assistente</CardTitle>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Processando...</p>
               </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
               {messages.map((m, i) => (
                 <div key={i} className={`${m.role === 'assistant' ? 'bg-slate-800/80 text-slate-200 rounded-tl-none border border-slate-700/50' : 'bg-indigo-600 text-white rounded-tr-none ml-auto shadow-xl shadow-indigo-500/10'} rounded-2xl p-4 max-w-[80%] transition-all`}>
                    <p className="text-sm leading-relaxed">{m.text}</p>
                 </div>
               ))}
               {loading && <div className="bg-slate-800/80 rounded-2xl rounded-tl-none p-4 max-w-[80%] animate-pulse border border-slate-700/50">...</div>}
            </CardContent>
            <div className="p-4 bg-[#09090B] border-t border-slate-800 flex gap-2">
               <Input 
                 value={input}
                 onChange={e => setInput(e.target.value)}
                 onKeyPress={e => e.key === 'Enter' && sendMessage()}
                 placeholder="Pergunte à IA..." 
                 className="rounded-xl border-slate-700 bg-slate-800 text-slate-100 focus:border-indigo-500 h-10" 
               />
               <Button onClick={sendMessage} disabled={loading} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 h-10 px-3">
                 <Plus className="w-4 h-4" />
               </Button>
            </div>
         </Card>
      </div>
   )
}

function EmotionalPage() {
   return (
      <div className="space-y-8">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-slate-900/40 border-slate-800 shadow-none rounded-2xl p-6 bg-gradient-to-br from-indigo-500/5 to-transparent">
               <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 italic">Pulsão de Consumo</h4>
               <p className="text-3xl font-bold mb-2 text-slate-50">42%</p>
               <p className="text-[10px] text-amber-400 font-bold leading-tight uppercase tracking-wider">Alerta: Gastos impulsivos em alta neste fim de semana.</p>
            </Card>
            <Card className="bg-slate-900/40 border-slate-800 shadow-none rounded-2xl p-6 bg-gradient-to-br from-emerald-500/5 to-transparent">
               <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 italic">Felicidade Financeira</h4>
               <p className="text-3xl font-bold mb-2 text-slate-50">85%</p>
               <p className="text-[10px] text-emerald-400 font-bold leading-tight uppercase tracking-wider italic">Meta Concluída: Sua família está satisfeita com as conquistas.</p>
            </Card>
            <Card className="bg-slate-900/40 border-slate-800 shadow-none rounded-2xl p-6 bg-gradient-to-br from-rose-500/5 to-transparent">
               <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 italic">Indice de Arrependimento</h4>
               <p className="text-3xl font-bold mb-2 text-slate-50">12%</p>
               <p className="text-[10px] text-rose-400 font-bold leading-tight uppercase tracking-wider">Baixo: Controle emocional estável nas últimas 48h.</p>
            </Card>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 bg-slate-900/40 border-slate-800 shadow-none rounded-3xl p-8">
               <CardTitle className="text-xl font-bold mb-6 text-slate-100 italic">Mapa Emocional de Gastos</CardTitle>
               <EmotionalRadarChart />
            </Card>

            <div className="space-y-6">
               <Card className="bg-slate-900/40 border-slate-800 shadow-none rounded-3xl p-6">
                  <CardTitle className="text-sm font-bold mb-4 text-slate-100">Gatilhos Críticos</CardTitle>
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">Noite de Sexta</span>
                        <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold text-[8px] uppercase tracking-widest">Alto Risco</Badge>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">Apps de Delivery</span>
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 font-bold text-[8px] uppercase tracking-widest">Moderado</Badge>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">Shopping Centers</span>
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold text-[8px] uppercase tracking-widest">Estável</Badge>
                     </div>
                  </div>
               </Card>

               <Button className="w-full bg-indigo-600 text-white rounded-2xl py-6 h-auto flex flex-col gap-1 items-center justify-center hover:scale-[1.02] transition-transform shadow-xl shadow-indigo-600/20 group">
                  <span className="font-bold flex items-center gap-2">
                     Log de Gastos Sensorial
                     <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                  </span>
                  <span className="text-[10px] opacity-60 font-medium uppercase tracking-widest">Registre suas emoções</span>
               </Button>
            </div>
         </div>
      </div>
   )
}

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) onLogin();
    });
  }, [onLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isSupabaseConfigured) {
      toast.success('Entrando no modo demonstração...');
      setTimeout(() => onLogin(), 500);
      return;
    }

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success('Conta criada! Verifique seu email.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin();
      }
    } catch (err: any) {
      console.error(err);
      let message = err.message || 'Erro na autenticação';
      
      if (err.status === 429 || message.includes('429')) {
        message = 'Muitos acessos (Rate Limit). Aguarde 1 minuto.';
      } else if (message.includes('apikey') || message.includes('No API key')) {
        message = 'Erro de Chave API. Verifique sua ANON_KEY.';
      } else if (message === 'Failed to fetch') {
        message = 'Erro de conexão. Verifique sua URL.';
      }
      
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center p-4 font-sans selection:bg-indigo-500/30">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-[2.5rem] shadow-2xl shadow-indigo-600/30 mb-2 rotate-3 hover:rotate-0 transition-transform">
            <TrendingUp className="text-white w-10 h-10" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white italic">Finna<span className="text-indigo-500">AI</span></h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em] opacity-80">Seu cérebro financeiro</p>
        </div>

        {!isSupabaseConfigured ? (
          <div className="bg-slate-900/40 border border-slate-800/50 p-10 rounded-[3rem] backdrop-blur-2xl shadow-2xl space-y-8 text-center">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-100 italic">Modo Demonstração</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Explore todas as funcionalidades da FinnaAI instantaneamente.
              </p>
            </div>
            
            <Button 
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded-2xl h-14 bg-indigo-600 hover:bg-indigo-700 font-black transition-all shadow-xl shadow-indigo-600/30 text-white text-lg group"
            >
              {loading ? 'Preparando...' : 'Acessar App Agora'}
              {!loading && <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />}
            </Button>

            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold italic">
              Conexão Supabase não detectada
            </p>
          </div>
        ) : (
          <Card className="bg-slate-900/40 border-slate-800/50 shadow-2xl rounded-[3rem] overflow-hidden backdrop-blur-2xl border-none">
            <CardContent className="p-10">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-black text-slate-500 italic ml-1">Identificação</Label>
                    <Input 
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Usuário ou Email" 
                      className="rounded-2xl border-slate-800 bg-slate-950/50 h-14 text-slate-100 placeholder:text-slate-800 focus:ring-2 ring-indigo-500/20 border-none px-6" 
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-black text-slate-500 italic ml-1">Senha</Label>
                    <Input 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="rounded-2xl border-slate-800 bg-slate-950/50 h-14 text-slate-100 placeholder:text-slate-800 focus:ring-2 ring-indigo-500/20 border-none px-6" 
                      required
                    />
                  </div>
                </div>

                {error && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider text-center animate-shake">{error}</p>}

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full rounded-2xl h-14 bg-indigo-600 hover:bg-indigo-700 font-black transition-all shadow-xl shadow-indigo-600/30 text-white text-lg group"
                >
                  {loading ? 'Autenticando...' : isSignUp ? 'Criar Acesso' : 'Entrar'}
                  {!loading && <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />}
                </Button>

                <div className="text-center pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-[10px] text-slate-500 uppercase tracking-widest font-black hover:text-indigo-400 transition-colors"
                  >
                    {isSignUp ? 'Já tem conta? Entrar' : 'Novo por aqui? Criar Acesso'}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        
        <p className="text-center text-[10px] text-slate-600 uppercase tracking-[0.3em] font-bold">
          © 2024 FinnaAI Labs
        </p>
      </div>
    </div>
  );
}

