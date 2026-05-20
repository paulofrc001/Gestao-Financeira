import React, { useState, useEffect } from 'react';
import { 
  Upload, FileUp, ShieldCheck, AlertCircle, Save, Trash2, 
  Sparkles, CheckCircle2, TrendingDown, Clock, HelpCircle, 
  CreditCard, CalendarClock, TrendingUp, Plus, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useGemini } from '../hooks/useGemini';
import LoadingState from './LoadingState';
import { getAccounts, Account, expandInstallmentTransactions, filterDuplicateTransactions, saveAccount, AccountType } from '../lib/accountsCardsStore';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [isCreditCard, setIsCreditCard] = useState(false);
  
  // Dynamic accounts state
  const [realAccounts, setRealAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [customOrigin, setCustomOrigin] = useState('');

  // States for creating a brand new account inline
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<AccountType>('Checking');
  const [newAccountBalance, setNewAccountBalance] = useState('');
  const [newAccountColor, setNewAccountColor] = useState('#10b981');

  const ACCOUNT_COLORS = [
    '#820ad1', // Nubank Purple
    '#ec7000', // Itaú Orange
    '#003399', // Bradesco Blue
    '#008037', // Santander Red/Green
    '#10b981', // Cash Green
    '#6366f1', // Indigo Neon
    '#f59e0b', // Amber
    '#000000', // XP black
  ];

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) {
      toast.error('O nome da conta é obrigatório.');
      return;
    }

    const balanceNum = parseFloat(newAccountBalance) || 0;

    try {
      const created = await saveAccount({
        name: newAccountName.trim(),
        type: newAccountType,
        balance: balanceNum,
        currency: 'BRL',
        color: newAccountColor
      });

      toast.success(`Conta "${created.name}" criada de forma instantânea e vinculada aos seus lançamentos!`);
      
      // Refresh the options
      const accs = await getAccounts();
      setRealAccounts(accs);
      
      // Select the new account
      setSelectedAccountId(created.id);
      setSelectedAccount(created.name);
      setCustomOrigin(created.name);

      // Reset states
      setNewAccountName('');
      setNewAccountType('Checking');
      setNewAccountBalance('');
      setNewAccountColor('#10b981');
      setIsNewAccountModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao cadastrar conta:', err);
      toast.error('Não foi possível registrar a conta: ' + err.message);
    }
  };

  const { parseStatement, loading: aiLoading, error: aiError } = useGemini();

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const accs = await getAccounts();
        setRealAccounts(accs);
        if (accs.length > 0) {
          const primary = accs.find(a => a.name.includes('Nubank') || a.name.includes('Principal')) || accs[0];
          setSelectedAccount(primary.name);
          setSelectedAccountId(primary.id);
        }
      } catch (err) {
        console.error('Error fetching accounts in ImportPage:', err);
      }
    }
    fetchAccounts();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processFile = async () => {
    if (!file) return;
    setParsing(true);
    
    try {
      // Check if file is too large
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Arquivo muito grande (máx 5MB)');
        setParsing(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          
          if (!text || text.length < 10) {
            toast.error('O arquivo parece estar vazio ou não pôde ser lido corretamente.');
            setParsing(false);
            return;
          }

          // Safe call using our robust useGemini hook
          const fileExtension = file.name.split('.').pop() || 'txt';
          const data = await parseStatement(text.slice(0, 15000), fileExtension);

          if (!data || !data.transactions) {
            throw new Error('Não foi possível identificar nenhuma transação válida no documento.');
          }

          setTransactions(data.transactions || []);
          setInsights(data.insights || null);
          setIsCreditCard(data.isCreditCard || false);
          setStep('review');
          toast.success(data.isCreditCard ? 'Fatura de cartão analisada com sucesso!' : 'Extrato processado com sucesso!');
        } catch (innerErr: any) {
          console.error('Fetch error:', innerErr);
          toast.error('Erro na análise por IA: ' + innerErr.message);
        } finally {
          setParsing(false);
        }
      };
      
      reader.onerror = () => {
        toast.error('Erro ao ler o arquivo localmente.');
        setParsing(false);
      };

      // For PDF we might need specialized reading, but for this demo context we treat as text
      reader.readAsText(file);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao processar arquivo: ' + err.message);
      setParsing(false);
    }
  };

  const saveTransactions = async () => {
    setParsing(true);
    try {
      const sourceName = customOrigin || selectedAccount;
      
      // Determine final account_id
      const matchedAcc = realAccounts.find(a => a.id === selectedAccountId || a.name === sourceName);
      const accId = matchedAcc ? matchedAcc.id : null;

      // 1. SUPABASE MODE
      if (isSupabaseConfigured) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error('Você precisa estar logado para salvar.');
          setParsing(false);
          return;
        }

        const rawTxs = transactions.map(tx => {
          const finalAmount = tx.amount;
          return {
            user_id: user.id,
            description: tx.description,
            amount: finalAmount,
            category: tx.category || 'Outros',
            date: tx.date,
            type: finalAmount > 0 ? ('income' as const) : ('expense' as const),
            is_subscription: tx.isSubscription || false,
            is_recurring: tx.isRecurring || false,
            installments: tx.installments || null,
            emotion: tx.suggestedEmotion || tx.emotion || 'Neutro',
            status: 'completed',
            source: sourceName,
            account_id: accId
          };
        });

        // Load existing transactions in Supabase to do a depara check
        const { data: dbTxList } = await supabase.from('transactions').select('*');
        const existingList = dbTxList || [];

        const txsToSave = expandInstallmentTransactions(rawTxs, true);

        const { finalTransactions, skippedCount } = filterDuplicateTransactions(
          txsToSave,
          existingList
        );

        if (finalTransactions.length > 0) {
          const { error } = await supabase.from('transactions').insert(finalTransactions);
          if (error) throw error;
        }

        // Sum up total import amounts to update balance (excluding skipped ones)
        const totalDelta = finalTransactions.reduce((accValue, curr) => accValue + Number(curr.amount), 0);
        if (matchedAcc && totalDelta !== 0) {
          const { error: balanceErr } = await supabase
            .from('accounts')
            .update({ balance: matchedAcc.balance + totalDelta })
            .eq('id', matchedAcc.id);
          if (balanceErr) console.error('Error updating account balance in DB:', balanceErr);
        }

        if (skippedCount > 0) {
          toast.success(`${finalTransactions.length} transações salvas com sucesso no banco de dados. ${skippedCount} duplicadas foram detectadas e evitadas (depara).`);
        } else {
          toast.success(`${txsToSave.length} transações salvas com sucesso no banco de dados!`);
        }
      } else {
        // 2. OFFLINE / LOCALSTORAGE MODE
        const localSaved = localStorage.getItem('finna_transactions');
        const existingList = localSaved ? JSON.parse(localSaved) : [];

        const rawLocalTxs = transactions.map(tx => {
          const finalAmount = tx.amount;
          return {
            description: tx.description,
            amount: finalAmount,
            category: tx.category || 'Outros',
            date: tx.date,
            type: finalAmount > 0 ? 'income' : 'expense',
            is_subscription: tx.isSubscription || false,
            is_recurring: tx.isRecurring || false,
            installments: tx.installments || null,
            emotion: tx.suggestedEmotion || tx.emotion || 'Neutro',
            status: 'completed',
            source: sourceName,
            account_id: accId
          };
        });

        const generatedTxs = expandInstallmentTransactions(rawLocalTxs, false);

        const { finalTransactions, skippedCount } = filterDuplicateTransactions(
          generatedTxs,
          existingList
        );

        localStorage.setItem('finna_transactions', JSON.stringify([...finalTransactions, ...existingList]));

        // Update local balance of account
        const totalDelta = finalTransactions.reduce((accValue, curr) => accValue + Number(curr.amount), 0);
        if (matchedAcc && totalDelta !== 0) {
          const allLocalAccs = realAccounts.map(a => {
            if (a.id === matchedAcc.id) {
              return { ...a, balance: a.balance + totalDelta };
            }
            return a;
          });
          localStorage.setItem('finna_accounts', JSON.stringify(allLocalAccs));
        }

        if (skippedCount > 0) {
          toast.success(`${finalTransactions.length} transações salvas. ${skippedCount} duplicadas foram detectadas e evitadas (depara).`);
        } else {
          toast.success(`${transactions.length} transações salvas localmente no modo demonstração!`);
        }
      }

      setStep('upload');
      setFile(null);
      setTransactions([]);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar no banco de dados: ' + err.message);
    } finally {
      setParsing(false);
    }
  };

  if (aiLoading) {
    return (
      <LoadingState 
        variant="fullscreen" 
        message="Análise Neural Ativa..." 
        subMessage="Nosso algoritmo Finna está limpando as descrições, identificando recorrências ocultas e projetando parcelas futuras de cartão..."
      />
    );
  }

  if (parsing) {
    return (
      <LoadingState 
        variant="fullscreen" 
        message="Gravando Transações..." 
        subMessage="Sincronizando com seu banco de dados de alta performance..."
      />
    );
  }

  if (step === 'review') {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-50 italic flex items-center gap-3">
              {isCreditCard ? <CreditCard className="text-indigo-400 w-7 h-7" /> : <FileUp className="text-indigo-400 w-7 h-7" />}
              Revisão de {isCreditCard ? 'Fatura' : 'Extrato'}
              <div className="flex items-center gap-2 ml-4">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest italic">Origem:</span>
                <Select value={selectedAccountId} onValueChange={(val) => {
                  setSelectedAccountId(val);
                  const matched = realAccounts.find(a => a.id === val);
                  if (matched) {
                    setSelectedAccount(matched.name);
                    setCustomOrigin(matched.name);
                  }
                }}>
                  <SelectTrigger className="h-8 bg-[#0a0a0d] border-slate-800 text-[10px] w-48 rounded-lg focus:border-indigo-500 transition-all font-bold text-indigo-400">
                    <SelectValue placeholder="Selecione a conta..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#09090B] border-slate-800 text-slate-100">
                    {realAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id} className="text-[11px] font-medium text-slate-200">
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  type="button" 
                  onClick={() => setIsNewAccountModalOpen(true)}
                  className="bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700/40 text-indigo-400 font-bold h-8 px-2.5 rounded-lg flex items-center gap-1 transition-all text-[10px] shrink-0 font-sans"
                  title="Criar nova conta"
                >
                  <Plus className="w-3 h-3" />
                  Nova
                </Button>
              </div>
            </h2>
            <p className="text-slate-400 text-sm">Validando {transactions.length} transações identificadas pela FinnaAI.</p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" onClick={() => setStep('upload')} className="rounded-xl border-slate-800 text-slate-400 hover:bg-slate-800">Cancelar</Button>
             <Button 
               disabled={parsing}
               onClick={saveTransactions} 
               className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-8 shadow-lg shadow-indigo-600/20"
             >
               {parsing ? 'Salvando...' : <span className="flex items-center"><Save className="w-4 h-4 mr-2" /> Salvar Tudo</span>}
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-6">
              {isCreditCard && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-slate-900/40 border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                      <CalendarClock className="w-12 h-12" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Previsão Próximo Mês</span>
                    <p className="text-2xl font-bold text-slate-50 mt-1 italic">R$ {insights?.forecastNextMonth?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '---'}</p>
                    <p className="text-[10px] text-indigo-400 font-medium mt-2 flex items-center gap-1 italic">
                      <Sparkles className="w-3 h-3" /> Baseado em recorrências e parcelas
                    </p>
                  </Card>
                  <Card className="bg-slate-900/40 border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                      <TrendingUp className="text-emerald-500 w-12 h-12" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Compras Parceladas</span>
                    <p className="text-2xl font-bold text-slate-50 mt-1 italic">R$ {insights?.futureInstallmentsTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '---'}</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-2 uppercase tracking-tighter">Comprometimento de renda futuro</p>
                  </Card>
                </div>
              )}

              <Card className="bg-slate-900/40 border-slate-800 shadow-none rounded-3xl overflow-hidden">
                 <table className="w-full text-left text-sm">
                    <thead className="bg-[#09090B] text-[10px] uppercase font-bold text-slate-500 tracking-widest border-b border-slate-800/50">
                       <tr>
                          <th className="px-6 py-4">Transação</th>
                          <th className="px-4 py-4">Origem</th>
                          <th className="px-4 py-4">Categoria (IA)</th>
                          <th className="px-4 py-4">Fluxo</th>
                          <th className="px-6 py-4 text-right">Valor</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                       {transactions.map((tx, idx) => (
                         <tr key={idx} className="hover:bg-slate-800/20 transition-colors group">
                            <td className="px-6 py-4">
                               <div className="flex flex-col">
                                  <span className="font-bold text-slate-100 italic transition-transform group-hover:translate-x-1">{tx.description}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500">{tx.date}</span>
                                    {tx.installments && (
                                      <Badge variant="outline" className="text-[8px] h-4 border-slate-700 text-slate-400 rounded-sm">{tx.installments}</Badge>
                                    )}
                                  </div>
                               </div>
                            </td>
                            <td className="px-4 py-4">
                               <Badge variant="outline" className="text-[9px] border-slate-800 text-indigo-400/70 italic font-bold">
                                 {customOrigin || selectedAccount}
                               </Badge>
                            </td>
                            <td className="px-4 py-4">
                               <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider italic">
                                 {tx.category}
                               </Badge>
                            </td>
                            <td className="px-4 py-4">
                               <div className="flex gap-1">
                                  {tx.isSubscription && <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[8px] uppercase">Assinatura</Badge>}
                                  {tx.isRecurring && <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[8px] uppercase">Recorrente</Badge>}
                                  {tx.suggestedEmotion && (
                                    <span className="cursor-pointer grayscale hover:grayscale-0 transition-all" title={`Humor: ${tx.suggestedEmotion}`}>
                                      {tx.suggestedEmotion === 'Satisfeito' ? '😊' : tx.suggestedEmotion === 'Preocupado' ? '😟' : '😐'}
                                    </span>
                                  )}
                               </div>
                            </td>
                            <td className={`px-6 py-4 text-right font-bold ${tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                               {tx.amount > 0 ? '+' : ''} R$ {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </Card>
           </div>

           <div className="space-y-6">
              <Card className="bg-indigo-600 text-white rounded-3xl p-6 border-none relative overflow-hidden shadow-2xl shadow-indigo-600/20">
                 <div className="absolute -bottom-10 -right-10 opacity-10">
                    <Sparkles className="w-48 h-48" />
                 </div>
                 <Badge className="bg-white/20 text-white border-white/30 mb-4 uppercase tracking-widest font-black text-[8px]">Análise Preditiva Finna</Badge>
                 <h4 className="text-lg font-bold mb-4 italic">Parecer da IA</h4>
                 <p className="text-xs text-white/80 italic leading-relaxed mb-6">
                    "{insights?.analysis || 'Analisando padrões de consumo para otimizar sua jornada financeira...'}"
                 </p>
                 <div className="space-y-4 relative z-10">
                    <div className="flex justify-between items-center text-sm border-b border-white/10 pb-2">
                       <span className="opacity-70 font-medium">Fatura Atual</span>
                       <span className="font-bold">R$ {insights?.totalCurrentStatement?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-white/10 pb-2">
                       <span className="opacity-70 font-medium">Registros Lidos</span>
                       <span className="font-bold">{transactions.length}</span>
                    </div>
                 </div>
              </Card>

              {insights?.wastes?.length > 0 && (
                <Card className="bg-slate-900 border-slate-800 rounded-3xl p-6">
                   <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 italic">
                     <AlertCircle className="w-4 h-4 text-rose-400" /> Possíveis Desperdícios
                   </h4>
                   <ul className="space-y-4">
                      {insights.wastes.map((waste: string, i: number) => (
                        <li key={i} className="text-xs text-slate-300 flex gap-3 leading-relaxed">
                           <div className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1 shrink-0 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                           {waste}
                        </li>
                      ))}
                   </ul>
                </Card>
              )}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-3xl shadow-2xl shadow-indigo-600/20 mb-4">
          <Upload className="text-white w-10 h-10" />
        </div>
        <h2 className="text-4xl font-bold tracking-tighter text-slate-50 italic">Processamento <span className="text-indigo-500">Omni</span></h2>
        <p className="text-slate-400 max-w-lg mx-auto">Importe extratos bancários ou faturas de cartão via <span className="text-slate-100 font-bold">PDF, CSV ou OFX</span>. Nossa IA cuida do resto.</p>
      </div>

      {/* SELETOR DE CONTA / CONTA DE DESTINO */}
      <div className="space-y-4 bg-slate-900/20 p-5 sm:p-6 rounded-3xl border border-slate-800/80 shadow-xl transition-all duration-300 hover:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/40 pb-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#6366f1] block">Etapa 1: Vínculo de Conta Bancária</span>
            <span className="text-xs font-semibold text-slate-350 block">Escolha a conta onde as transações importadas serão integradas:</span>
          </div>
          {selectedAccount && (
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] font-bold uppercase tracking-wider py-1 px-2.5 rounded-xl self-start sm:self-center">
              Vinculado: {selectedAccount}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 justify-center sm:justify-start">
          {realAccounts.map(acc => (
            <button
              key={acc.id}
              type="button"
              onClick={() => {
                setSelectedAccount(acc.name);
                setSelectedAccountId(acc.id);
                setCustomOrigin(acc.name);
              }}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 active:scale-95 duration-200 ${selectedAccountId === acc.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/20 font-extrabold scale-[1.02]' : 'bg-slate-900/50 border-slate-800/70 text-slate-450 hover:text-slate-200 hover:border-slate-700'}`}
            >
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: acc.color || '#10b981' }} />
              <span className="truncate max-w-[120px]">{acc.name}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsNewAccountModalOpen(true)}
            className="px-3 sm:px-4 py-2 rounded-xl text-xs font-bold border border-slate-700/50 bg-indigo-950/40 text-indigo-300 hover:border-indigo-400 hover:bg-indigo-950/60 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Criar Conta
          </button>
        </div>
      </div>

      <Card className="bg-slate-900/40 border-slate-800 border-dashed border-2 rounded-3xl p-12 text-center transition-all hover:border-indigo-500/50 group relative">

        <input 
          type="file" 
          id="fileUpload" 
          className="hidden" 
          onChange={handleFileChange} 
          accept=".csv,.ofx,.txt,.pdf" 
        />
        <label htmlFor="fileUpload" className="cursor-pointer space-y-6 block">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
             <FileUp className="text-slate-500 w-8 h-8 group-hover:text-indigo-400 transition-colors" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-200">{file ? file.name : 'Selecione o arquivo de extrato'}</p>
            <p className="text-sm text-slate-500 mt-2">Suporte a faturas de cartões e extratos bancários</p>
          </div>
          <div className="flex items-center justify-center gap-8 pt-4">
             <div className="flex items-center gap-2 text-[9px] text-slate-500 uppercase font-black tracking-[0.2em]">
                <ShieldCheck className="w-3 h-3 text-emerald-500" /> Safe Data
             </div>
             <div className="flex items-center gap-2 text-[9px] text-slate-500 uppercase font-black tracking-[0.2em]">
                <Sparkles className="w-3 h-3 text-indigo-500" /> Neural Extract
             </div>
          </div>
        </label>
      </Card>

      {file && (
        <div className="flex justify-center animate-in slide-in-from-top-2 duration-300">
          <Button 
            onClick={processFile} 
            disabled={parsing}
            className="rounded-2xl h-14 px-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-2xl shadow-indigo-600/30 group"
          >
            {parsing ? (
              <span className="flex items-center gap-3">
                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                 Mapeando dados financeiros...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                 Iniciar Análise Neural
                 <Sparkles className="w-4 h-4 group-hover:scale-125 transition-transform" />
              </span>
            )}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
         <FeatureCard icon={TrendingUp} title="Projeção de Fatura" desc="Antecipamos o fechamento do seu cartão baseado em parcelamentos." />
         <FeatureCard icon={Clock} title="Assinaturas Ocultas" desc="Detectamos cobranças recorrentes que você pode ter esquecido." />
         <FeatureCard icon={AlertCircle} title="Detector de Resíduos" desc="Identificamos taxas bancárias e serviços desnecessários." />
      </div>

      {/* Diálogo de Criação de Conta Bancária ao importar */}
      <Dialog open={isNewAccountModalOpen} onOpenChange={setIsNewAccountModalOpen}>
        <DialogContent className="sm:max-w-[420px] border-slate-800 rounded-3xl p-0 max-h-[90vh] overflow-y-auto bg-[#09090B] text-slate-100">
          <DialogHeader className="px-8 py-6 bg-[#030303] border-b border-slate-800/60 shadow-inner">
            <DialogTitle className="text-lg font-bold tracking-tight text-slate-50 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              Nova Conta Bancária
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs leading-relaxed">
              Crie uma nova conta corrente ou poupança de forma instantânea para vincular e organizar suas despesas importadas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAccount} className="p-8 space-y-5 bg-[#09090B]">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Nome da Conta / Instituição</label>
              <Input 
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="Ex: Itaú, Nubank, Banco Inter"
                className="bg-[#0c0c0e] border-slate-800 text-slate-50 rounded-xl h-11 px-4 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Tipo de Conta</label>
                <Select value={newAccountType} onValueChange={(val: any) => setNewAccountType(val)}>
                  <SelectTrigger className="bg-[#0c0c0e] border-slate-800 text-xs h-11 px-4 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-100 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#09090B] border-slate-800 text-slate-100">
                    <SelectItem value="Checking" className="text-xs">Corrente</SelectItem>
                    <SelectItem value="Savings" className="text-xs">Poupança</SelectItem>
                    <SelectItem value="Investment" className="text-xs">Investimento</SelectItem>
                    <SelectItem value="Cash" className="text-xs">Dinheiro (Espécie)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Saldo Inicial (R$)</label>
                <Input 
                  type="number"
                  step="0.01"
                  value={newAccountBalance}
                  onChange={(e) => setNewAccountBalance(e.target.value)}
                  placeholder="0,00"
                  className="bg-[#0c0c0e] border-slate-800 text-slate-50 rounded-xl h-11 px-4 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Identidade Visual (Cor)</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {ACCOUNT_COLORS.map((colorHex) => (
                  <button
                    key={colorHex}
                    type="button"
                    onClick={() => setNewAccountColor(colorHex)}
                    className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110 active:scale-95 flex items-center justify-center relative shadow-sm"
                    style={{ 
                      backgroundColor: colorHex,
                      borderColor: newAccountColor === colorHex ? '#ffffff' : 'transparent'
                    }}
                  >
                    {newAccountColor === colorHex && (
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-800/60 flex justify-end gap-2">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsNewAccountModalOpen(false)} 
                className="rounded-xl text-slate-400 hover:text-slate-200"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5"
              >
                Criar e Vincular
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: any) {
  return (
    <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-3 transition-transform hover:-translate-y-1">
       <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
          <Icon className="w-4 h-4 text-indigo-400" />
       </div>
       <h4 className="text-sm font-bold text-slate-100 italic">{title}</h4>
       <p className="text-[10px] text-slate-500 leading-relaxed uppercase tracking-tighter">{desc}</p>
    </div>
  );
}
