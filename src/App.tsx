/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { Home, LayoutDashboard, ReceiptText, Target, Wallet, BrainCircuit, Heart, Settings, Bell, Menu, X, Plus, ChevronRight, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Transaction } from './types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Navigation items
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transações', icon: ReceiptText },
  { id: 'goals', label: 'Metas', icon: Target },
  { id: 'accounts', label: 'Contas', icon: Wallet },
  { id: 'insights', label: 'IA Insights', icon: BrainCircuit },
  { id: 'emotional', label: 'Sentimental', icon: Heart },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

import { Input } from '@/components/ui/input';
import { MainFlowChart, CategoriesPieChart, EmotionalRadarChart } from './components/Charts';
import NewTransactionDialog from './components/NewTransactionDialog';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNewTxOpen, setIsNewTxOpen] = useState(false);

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
        {activeTab === 'emotional' && <EmotionalPage />}
        {activeTab !== 'dashboard' && activeTab !== 'transactions' && activeTab !== 'insights' && activeTab !== 'emotional' && (
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
  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Saldo em Contas" value="R$ 12.450,00" change="+2.4%" icon={Wallet} trend="up" />
        <StatCard title="Receitas (Maio)" value="R$ 8.900,00" change="+12%" icon={TrendingUp} trend="up" color="green" />
        <StatCard title="Despesas (Maio)" value="R$ 4.320,00" change="-5%" icon={TrendingDown} trend="down" color="red" />
        <StatCard title="Economia do Mês" value="R$ 4.580,00" change="51%" icon={DollarSign} trend="up" color="blue" subtitle="da meta mensal" />
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
         <Card className="border-[#E5E5E5] shadow-none rounded-3xl">
            <CardHeader className="px-8 py-6 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold">Últimas Transações</CardTitle>
              <Button variant="link" className="text-[#1A1A1A] font-bold text-sm">Ver todas</Button>
            </CardHeader>
            <CardContent className="px-8 pb-8">
               <div className="space-y-4">
                  <TransactionItem title="Supermercado Extra" date="Hoje, 14:20" amount="- R$ 342,00" category="Alimentação" type="expense" />
                  <TransactionItem title="Salário Paulo" date="Ontem, 09:00" amount="+ R$ 6.500,00" category="Renda" type="income" />
                  <TransactionItem title="Assinatura Netflix" date="15 Mai 2026" amount="- R$ 55,90" category="Lazer" type="expense" />
                  <TransactionItem title="Posto Shell" date="14 Mai 2026" amount="- R$ 220,00" category="Transporte" type="expense" />
               </div>
            </CardContent>
         </Card>

         <Card className="bg-[#1A1A1A] border-none shadow-none rounded-3xl text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
               <BrainCircuit className="w-32 h-32" />
            </div>
            <CardHeader className="px-8 pt-8">
               <Badge className="bg-white/10 text-white border-white/20 hover:bg-white/20 mb-4 w-fit">IA Insight</Badge>
               <CardTitle className="text-2xl font-bold leading-tight">Você economizou 15% a mais que no último mês!</CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8 pt-4">
               <p className="text-white/70 mb-6 leading-relaxed">Sua família reduziu gastos impulsivos em 'Lazer' após as 22h. Continue assim para atingir a meta da Viagem em Agosto.</p>
               <div className="flex gap-4">
                  <Button className="bg-white text-[#1A1A1A] hover:bg-white/90 rounded-full font-bold">Ver Sugestões</Button>
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
   return (
      <div className="space-y-6">
         <Card className="bg-slate-900/40 border-slate-800 shadow-none rounded-3xl pt-6">
            <div className="px-8 pb-4 flex items-center justify-between border-b border-slate-800/50">
               <div className="flex gap-4">
                  <Button variant="secondary" className="bg-indigo-600 text-white rounded-full px-6 hover:bg-indigo-700">Todos</Button>
                  <Button variant="ghost" className="rounded-full text-slate-400 hover:text-white">Despesas</Button>
                  <Button variant="ghost" className="rounded-full text-slate-400 hover:text-white">Receitas</Button>
               </div>
               <div className="flex gap-2">
                  <Input placeholder="Buscar transação..." className="w-64 rounded-xl border-slate-800 bg-slate-900/50 text-slate-200" />
               </div>
            </div>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead className="bg-[#09090B] text-[10px] uppercase font-bold text-slate-500 tracking-widest border-b border-slate-800/50">
                        <tr>
                           <th className="px-8 py-4">Descrição</th>
                           <th className="px-4 py-4">Categoria</th>
                           <th className="px-4 py-4">Status</th>
                           <th className="px-4 py-4 text-right">Valor</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800/30">
                        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                           <tr key={i} className="hover:bg-slate-800/20 transition-colors group">
                              <td className="px-8 py-5">
                                 <div className="flex flex-col">
                                    <span className="font-bold text-sm text-slate-100 italic">Supermercado Zandona {i}</span>
                                    <span className="text-[10px] text-slate-500">1{i} Mai, 10:30</span>
                                 </div>
                              </td>
                              <td className="px-4 py-5">
                                 <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider italic">Alimentação</Badge>
                              </td>
                              <td className="px-4 py-5">
                                 <Badge className="bg-emerald-500/10 text-emerald-400 border-none px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider">Concluído</Badge>
                              </td>
                              <td className="px-4 py-5 text-right font-bold text-sm text-rose-400">- R$ 145,90</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
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
            <Card className="border-[#E5E5E5] shadow-none rounded-2xl p-6 bg-gradient-to-br from-white to-orange-50/30">
               <h4 className="text-xs font-bold text-[#999999] uppercase tracking-widest mb-2">Pulsão de Consumo</h4>
               <p className="text-3xl font-bold mb-2">42%</p>
               <p className="text-[10px] text-orange-600 font-bold leading-tight uppercase tracking-wider">Sinal Amarelo: Gastos impulsivos em alta este fim de semana.</p>
            </Card>
            <Card className="border-[#E5E5E5] shadow-none rounded-2xl p-6 bg-gradient-to-br from-white to-green-50/30">
               <h4 className="text-xs font-bold text-[#999999] uppercase tracking-widest mb-2">Felicidade Financeira</h4>
               <p className="text-3xl font-bold mb-2">85%</p>
               <p className="text-[10px] text-green-600 font-bold leading-tight uppercase tracking-wider">Meta Concluída: Sua família está satisfeita com as conquistas atuais.</p>
            </Card>
            <Card className="border-[#E5E5E5] shadow-none rounded-2xl p-6 bg-gradient-to-br from-white to-red-50/30">
               <h4 className="text-xs font-bold text-[#999999] uppercase tracking-widest mb-2">Indice de Arrependimento</h4>
               <p className="text-3xl font-bold mb-2">12%</p>
               <p className="text-[10px] text-red-600 font-bold leading-tight uppercase tracking-wider">Baixo: Poucos gastos após as 22h geraram desconforto.</p>
            </Card>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-[#E5E5E5] shadow-none rounded-3xl p-8">
               <CardTitle className="text-xl font-bold mb-6">Mapa Emocional de Gastos</CardTitle>
               <EmotionalRadarChart />
            </Card>

            <div className="space-y-6">
               <Card className="border-[#E5E5E5] shadow-none rounded-3xl p-6">
                  <CardTitle className="text-sm font-bold mb-4">Gatilhos Críticos</CardTitle>
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Noite de Sexta</span>
                        <Badge className="bg-orange-100 text-orange-700 font-bold text-[8px]">Alto Risco</Badge>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Apps de Delivery</span>
                        <Badge className="bg-orange-100 text-orange-700 font-bold text-[8px]">Moderado</Badge>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Shopping Centers</span>
                        <Badge className="bg-red-100 text-red-700 font-bold text-[8px]">Extremo</Badge>
                     </div>
                  </div>
               </Card>

               <Button className="w-full bg-[#1A1A1A] text-white rounded-2xl py-6 h-auto flex flex-col gap-1 items-center justify-center hover:scale-[1.02] transition-transform">
                  <span className="font-bold">Log de Gastos do Pulsão</span>
                  <span className="text-[10px] opacity-60 font-medium">Registre como você se sente agora</span>
               </Button>
            </div>
         </div>
      </div>
   )
}
