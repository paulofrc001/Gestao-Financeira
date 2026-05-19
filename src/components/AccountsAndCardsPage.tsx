import { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Wallet, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  Percent, 
  Sparkles,
  RefreshCw,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Account, 
  Card as CreditCardType, 
  getAccounts, 
  getCards, 
  saveAccount, 
  saveCard, 
  deleteAccount, 
  deleteCard, 
  calculateCardMetrics, 
  payCreditCardInvoice, 
  getUpcomingInvoicesList, 
  formatBillingMonthLabel,
  getInvoiceBillingMonth
} from '../lib/accountsCardsStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AccountsAndCardsPageProps {
  onRefreshTrigger?: () => void;
}

export default function AccountsAndCardsPage({ onRefreshTrigger }: AccountsAndCardsPageProps = {}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State for Account
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountFormData, setAccountFormData] = useState({
    name: '',
    type: 'Checking' as const,
    balance: '',
    currency: 'BRL',
    color: '#820ad1'
  });

  // Modal State for Card
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardType | null>(null);
  const [cardFormData, setCardFormData] = useState({
    name: '',
    account_id: '',
    limit_amount: '',
    closing_day: '10',
    due_day: '17',
    brand: 'Mastercard'
  });

  // Modal State for Paying Invoice
  const [isPayInvoiceModalOpen, setIsPayInvoiceModalOpen] = useState(false);
  const [payingCard, setPayingCard] = useState<CreditCardType | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [paySourceAccountId, setPaySourceAccountId] = useState('');

  // Forecast state
  const [forecastMonths, setForecastMonths] = useState<{ value: string; label: string }[]>([]);

  // Pre-configured pastel premium colors for accounts
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

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const fetchedAccounts = await getAccounts();
      const fetchedCards = await getCards();
      setAccounts(fetchedAccounts);
      setCards(fetchedCards);

      // Load transactions to compute metrics
      if (!isSupabaseConfigured) {
        const localSaved = localStorage.getItem('finna_transactions');
        const INITIAL_DEMO_TRANSACTIONS = [
          { id: 'tx-1', description: 'Supermercado Pão de Açúcar', date: '2026-05-18', amount: -452.90, category: 'alimentacao', type: 'expense', source: 'Nubank Principal', status: 'completed', emotion: 'Neutro', card_id: 'card-1' },
          { id: 'tx-2', description: 'Assinatura Netflix Premium', date: '2026-05-15', amount: -55.90, category: 'lazer', type: 'expense', source: 'Nubank Principal', status: 'completed', emotion: 'Neutro', is_recurring: true, card_id: 'card-1' },
          { id: 'tx-3', description: 'Salário Paulo M.', date: '2026-05-05', amount: 8500.00, category: 'Salário', type: 'income', source: 'Itaú Recebimento', status: 'completed', emotion: 'Satisfeito', account_id: 'acc-2' },
          { id: 'tx-4', description: 'Condomínio e Aluguel', date: '2026-05-01', amount: -2300.00, category: 'moradia', type: 'expense', source: 'Itaú', status: 'completed', emotion: 'Preocupado', account_id: 'acc-2' },
          { id: 'tx-5', description: 'Combustível Posto Ipiranga', date: '2026-05-19', amount: -180.00, category: 'transporte', type: 'expense', source: 'XP Principal', status: 'completed', emotion: 'Neutro', card_id: 'card-2' },
          { id: 'tx-6', description: 'Fone de Ouvido Bluetooth (1/3)', date: '2026-05-19', amount: -120.00, category: 'lazer', type: 'expense', source: 'Nubank', status: 'completed', emotion: 'Feliz', card_id: 'card-1', installments: '1/3' },
          { id: 'tx-7', description: 'Fone de Ouvido Bluetooth (2/3)', date: '2026-06-19', amount: -120.00, category: 'lazer', type: 'expense', source: 'Nubank', status: 'completed', emotion: 'Feliz', card_id: 'card-1', installments: '2/3' },
          { id: 'tx-8', description: 'Fone de Ouvido Bluetooth (3/3)', date: '2026-07-19', amount: -120.00, category: 'lazer', type: 'expense', source: 'Nubank', status: 'completed', emotion: 'Feliz', card_id: 'card-1', installments: '3/3' },
        ];
        
        if (!localStorage.getItem('finna_transactions')) {
          localStorage.setItem('finna_transactions', JSON.stringify(INITIAL_DEMO_TRANSACTIONS));
          setAllTransactions(INITIAL_DEMO_TRANSACTIONS);
        } else {
          setAllTransactions(JSON.parse(localSaved || '[]'));
        }
      } else {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .order('date', { ascending: false });
        if (error) throw error;
        setAllTransactions(data || []);
      }

      setForecastMonths(getUpcomingInvoicesList(6));

    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao recarregar dados: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Form handling functions: Account
  const handleOpenAccountNew = () => {
    setEditingAccount(null);
    setAccountFormData({
      name: '',
      type: 'Checking',
      balance: '',
      currency: 'BRL',
      color: '#820ad1'
    });
    setIsAccountModalOpen(true);
  };

  const handleOpenAccountEdit = (account: Account) => {
    setEditingAccount(account);
    setAccountFormData({
      name: account.name,
      type: account.type,
      balance: account.balance.toString(),
      currency: account.currency,
      color: account.color || '#820ad1'
    });
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = async () => {
    if (!accountFormData.name) {
      toast.error('Informe o nome da conta');
      return;
    }
    if (accountFormData.balance === '') {
      toast.error('Informe o saldo inicial');
      return;
    }

    try {
      await saveAccount({
        id: editingAccount?.id,
        name: accountFormData.name,
        type: accountFormData.type,
        balance: Number(accountFormData.balance),
        currency: accountFormData.currency,
        color: accountFormData.color
      });

      toast.success(editingAccount ? 'Conta editada com sucesso!' : 'Nova conta registrada!');
      setIsAccountModalOpen(false);
      fetchAllData();
      if (onRefreshTrigger) onRefreshTrigger();
    } catch (err: any) {
      toast.error('Erro ao salvar conta: ' + err.message);
    }
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!window.confirm(`Deseja mesmo remover a conta "${name}"? Sucessivas transações podem perder a referência.`)) {
      return;
    }
    try {
      await deleteAccount(id);
      toast.success('Conta deletada com sucesso!');
      fetchAllData();
      if (onRefreshTrigger) onRefreshTrigger();
    } catch (err: any) {
      toast.error('Erro ao deletar conta: ' + err.message);
    }
  };

  // Form handling functions: Credit Card
  const handleOpenCardNew = () => {
    setEditingCard(null);
    setCardFormData({
      name: '',
      account_id: accounts[0]?.id || '',
      limit_amount: '',
      closing_day: '10',
      due_day: '17',
      brand: 'Mastercard'
    });
    setIsCardModalOpen(true);
  };

  const handleOpenCardEdit = (card: CreditCardType) => {
    setEditingCard(card);
    setCardFormData({
      name: card.name,
      account_id: card.account_id,
      limit_amount: card.limit_amount.toString(),
      closing_day: card.closing_day.toString(),
      due_day: card.due_day.toString(),
      brand: card.brand || 'Mastercard'
    });
    setIsCardModalOpen(true);
  };

  const handleSaveCard = async () => {
    if (!cardFormData.name) {
      toast.error('Informe o nome do cartão');
      return;
    }
    if (!cardFormData.limit_amount) {
      toast.error('Defina o limite de crédito');
      return;
    }
    if (!cardFormData.account_id) {
      toast.error('Selecione uma conta bancária de débito para o cartão');
      return;
    }

    try {
      await saveCard({
        id: editingCard?.id,
        name: cardFormData.name,
        account_id: cardFormData.account_id,
        limit_amount: Number(cardFormData.limit_amount),
        closing_day: Number(cardFormData.closing_day),
        due_day: Number(cardFormData.due_day),
        brand: cardFormData.brand
      });

      toast.success(editingCard ? 'Cartão editado com sucesso!' : 'Novo cartão registrado!');
      setIsCardModalOpen(false);
      fetchAllData();
    } catch (err: any) {
      toast.error('Erro ao salvar cartão: ' + err.message);
    }
  };

  const handleDeleteCard = async (id: string, name: string) => {
    if (!window.confirm(`Deseja mesmo remover o cartão "${name}"?`)) {
      return;
    }
    try {
      await deleteCard(id);
      toast.success('Cartão removido com sucesso!');
      fetchAllData();
    } catch (err: any) {
      toast.error('Erro ao deletar cartão: ' + err.message);
    }
  };

  // Quick invoice payment interface
  const handleOpenPayInvoice = (card: CreditCardType, currentBill: number) => {
    setPayingCard(card);
    setPayAmount(currentBill.toFixed(2));
    setPaySourceAccountId(accounts[0]?.id || '');
    setIsPayInvoiceModalOpen(true);
  };

  const handleConfirmPayInvoice = async () => {
    if (!payingCard || !paySourceAccountId || !payAmount) return;

    try {
      await payCreditCardInvoice(payingCard, Number(payAmount), paySourceAccountId);
      toast.success('Fatura quitada! Transação de pagamento registrada e saldo deduzido.');
      setIsPayInvoiceModalOpen(false);
      fetchAllData();
      if (onRefreshTrigger) onRefreshTrigger();
    } catch (err: any) {
      toast.error('Erro ao pagar fatura: ' + err.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Premium Informative Banner with limit alert statistics */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border border-indigo-500/10 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400">Central de Limites e Organização</h3>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-50">Sua estrutura financeira sob medida</h2>
          <p className="text-sm text-slate-400 max-w-xl">
            Gerencie múltiplas contas de débito, cartões de crédito e veja a projeção automática de faturas futuras para se antecipar a qualquer aperto.
          </p>
        </div>
        
        <div className="flex flex-col gap-2 w-full md:w-auto shrink-0 bg-slate-900/50 p-4 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aviso Inteligente</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-400">Cálculos automáticos em tempo real</span>
          </div>
          <p className="text-[10px] text-slate-400 max-w-[200px]">Os gastos parcelados com cartão geram faturamentos futuros automáticos nas projeções.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: BANK ACCOUNTS (MÚLTIPLAS CONTAS) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <Wallet className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Contas Bancárias</h3>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold italic">Saldo líquido disponível</p>
              </div>
            </div>
            <Button 
              size="sm" 
              onClick={handleOpenAccountNew} 
              className="rounded-xl bg-slate-900/60 border border-slate-800 hover:bg-slate-800 text-emerald-400 text-xs font-bold h-9"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Conta
            </Button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map(n => (
                  <div key={n} className="h-28 w-full bg-slate-900/20 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <Card className="bg-slate-900/10 border-dashed border-slate-800 rounded-2xl py-10 text-center">
                <CardContent className="space-y-2">
                  <Wallet className="w-8 h-8 text-slate-700 mx-auto" />
                  <p className="text-xs text-slate-400 font-semibold">Nenhuma conta cadastrada.</p>
                  <Button onClick={handleOpenAccountNew} variant="link" className="text-emerald-400">Cadastrar primeira conta</Button>
                </CardContent>
              </Card>
            ) : (
              accounts.map(acc => (
                <div 
                  key={acc.id} 
                  className="bg-[#0c0c0e] border border-slate-800 rounded-3xl p-5 hover:border-slate-700 transition-all shadow-xl hover:shadow-2xl relative overflow-hidden group"
                >
                  {/* Decorative side color block */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1.5 opacity-80 group-hover:opacity-100 transition-opacity" 
                    style={{ backgroundColor: acc.color || '#820ad1' }} 
                  />

                  <div className="flex items-start justify-between pl-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full text-slate-400 bg-slate-900 border border-slate-800/80">
                          {acc.type === 'Checking' && 'Conta Corrente'}
                          {acc.type === 'Savings' && 'Poupança'}
                          {acc.type === 'Investment' && 'Investimentos'}
                          {acc.type === 'Cash' && 'Dinheiro / Carteira'}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-100">{acc.name}</h4>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => handleOpenAccountEdit(acc)}
                        className="w-8 h-8 rounded-lg border border-slate-800/60 hover:bg-slate-800 text-slate-400"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => handleDeleteAccount(acc.id, acc.name)}
                        className="w-8 h-8 rounded-lg border border-slate-800/60 hover:bg-slate-800 text-rose-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-900 pl-2 flex items-baseline justify-between">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Saldo</span>
                    <span className="text-2xl font-black text-slate-50 mr-2 tracking-tight">
                      R$ {acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CREDIT CARDS (CARTÕES DE CRÉDITO + FATURAS AUTOMÁTICAS) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                <CreditCard className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Cartões de Crédito</h3>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold italic">Faturas automáticas e limites mágicos</p>
              </div>
            </div>
            
            <Button 
              size="sm" 
              onClick={handleOpenCardNew} 
              disabled={accounts.length === 0}
              className="rounded-xl bg-slate-900/60 border border-slate-800 hover:bg-slate-800 text-indigo-400 text-xs font-bold h-9"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Cartão
            </Button>
          </div>

          <div className="space-y-6">
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map(n => (
                  <div key={n} className="h-36 w-full bg-slate-900/20 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : cards.length === 0 ? (
              <Card className="bg-slate-900/10 border-dashed border-slate-800 rounded-2xl py-10 text-center">
                <CardContent className="space-y-4">
                  <CreditCard className="w-8 h-8 text-slate-700 mx-auto" />
                  <div>
                    <p className="text-xs text-slate-400 font-semibold">Nenhum cartão cadastrado.</p>
                    <p className="text-[10px] text-slate-600">Associe cartões de crédito para calcular seu faturamento e acompanhar os ciclos em tempo real.</p>
                  </div>
                  {accounts.length > 0 ? (
                    <Button onClick={handleOpenCardNew} variant="outline" className="text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/10 text-xs">Cadastrar Cartão</Button>
                  ) : (
                    <p className="text-xs text-amber-500 font-semibold">Crie primeiro uma conta bancária para vincular de débito ao cartão.</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              cards.map(card => {
                const metrics = calculateCardMetrics(card, allTransactions);
                const associatedAcc = accounts.find(a => a.id === card.account_id);
                
                return (
                  <div 
                    key={card.id} 
                    className="bg-[#0c0c0e] border border-slate-800 rounded-3xl p-6 transition-all shadow-xl relative overflow-hidden group space-y-4"
                  >
                    {/* Visual glowing aura for warnings */}
                    {metrics.isCritical && (
                      <div className="absolute top-0 right-0 left-0 h-1 bg-red-500 animate-pulse" />
                    )}
                    {metrics.isWarning && (
                      <div className="absolute top-0 right-0 left-0 h-1 bg-amber-500" />
                    )}

                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        <div className="p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl text-indigo-400 h-12 w-12 flex items-center justify-center font-black">
                          {card.brand ? card.brand.substring(0, 2).toUpperCase() : 'CC'}
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-base font-bold text-slate-150">{card.name}</h4>
                          <span className="text-[9.5px] uppercase tracking-wider font-extrabold text-slate-500 block">
                            Débito automático na conta: <span className="text-slate-350">{associatedAcc ? associatedAcc.name : 'Nenhuma associada'}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => handleOpenCardEdit(card)}
                          className="w-8 h-8 rounded-lg border border-slate-800/60 hover:bg-slate-800 text-slate-400"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => handleDeleteCard(card.id, card.name)}
                          className="w-8 h-8 rounded-lg border border-slate-800/60 hover:bg-slate-800 text-rose-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Cycle details & Invoice automatic display */}
                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-900/80">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block italic">Fechar Ciclo</span>
                        <span className="text-xs font-extrabold text-slate-300">Dia {card.closing_day}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block italic">Vencimento</span>
                        <span className="text-xs font-extrabold text-slate-300">Dia {card.due_day}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block italic">Status Fatura</span>
                        {metrics.isCritical ? (
                          <span className="text-[10px] font-bold text-red-500 uppercase flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Crítico
                          </span>
                        ) : metrics.isWarning ? (
                          <span className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Limite Alto
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-500 uppercase flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                            Saudável
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Limit Progress Bar with alert alarms */}
                    <div className="space-y-2 bg-[#08080a] p-4 rounded-2xl border border-slate-900">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acumulado Fatura Atual</span>
                        <span className="font-extrabold text-slate-50">
                          R$ {metrics.currentBill.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / R$ {card.limit_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <Progress 
                          value={Math.min(metrics.limitUtilization, 100)} 
                          className="h-2 rounded-full"
                          indicatorClassName={
                            metrics.isCritical ? 'bg-red-500' :
                            metrics.isWarning ? 'bg-amber-500' : 'bg-indigo-500'
                          }
                        />
                        <div className="flex justify-between items-center text-[10px] font-medium text-slate-500">
                          <span>{metrics.limitUtilization.toFixed(0)}% Utilizado</span>
                          <span>Disponível: R$ {Math.max(card.limit_amount - metrics.currentBill, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      {/* Warnings and Alarms notifications on Card */}
                      {metrics.isCritical && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2 animate-pulse mt-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span>ALERTA DE LIMITE EXCEDIDO: Cartão de compras ultrapassou o teto disponível. Cuidado com multas de rotativo!</span>
                        </div>
                      )}

                      {metrics.isWarning && (
                        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2 mt-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Atenção: Limite ultrapassando 80% do total disponível. Economize ou parcele se for prudente.</span>
                        </div>
                      )}
                    </div>

                    {/* Quick pay down client interface */}
                    <div className="flex gap-2">
                      <Button 
                        disabled={metrics.currentBill === 0} 
                        onClick={() => handleOpenPayInvoice(card, metrics.currentBill)}
                        className={`flex-1 rounded-xl h-10 text-[10px] font-bold uppercase tracking-widest transition-all ${metrics.currentBill > 0 ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-800 text-slate-500'}`}
                      >
                        Qualificar & Pagar Fatura
                      </Button>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* PREVISÃO DE GASTOS & PROJEÇÃO DE FATURA MULTI-MENSAL (Spending Forecast Timeline) */}
      <Card className="bg-[#0c0c0e] border-slate-800 shadow-none rounded-3xl overflow-hidden pt-4">
        <CardHeader className="px-8 pb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-900">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <CardTitle className="text-lg font-bold text-slate-100">Previsão e Planejamento Mensal</CardTitle>
            </div>
            <CardDescription className="text-slate-400 text-xs">
              Mapeamento automático de parcelamentos acumulados e despesas futuras para os próximos 6 meses.
            </CardDescription>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/15 rounded-full px-3 py-1 flex items-center gap-1.5 text-amber-400 text-[10px] font-extrabold uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5" />
            Gastos Futuros Estimados
          </div>
        </CardHeader>
        <CardContent className="px-8 py-6">
          {cards.length === 0 ? (
            <div className="py-8 text-center text-slate-500 italic text-xs">
              Adicione cartões de crédito para calcular previsões mensais automáticas.
            </div>
          ) : (
            <div className="space-y-6">
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {forecastMonths.map(monthObj => {
                  // Sum the forecast for ALL cards in this month
                  let totalForecastForMonth = 0;
                  cards.forEach(card => {
                    const metrics = calculateCardMetrics(card, allTransactions);
                    totalForecastForMonth += (metrics.byMonth[monthObj.value] || 0);
                  });

                  return (
                    <div 
                      key={monthObj.value} 
                      className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 text-center hover:border-slate-700 transition"
                    >
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block italic leading-none mb-1">
                        {monthObj.label.split(' ')[0]}
                      </span>
                      <span className="text-[10px] text-slate-500 block font-bold leading-none mb-2">
                        {monthObj.label.split(' ')[1]}
                      </span>
                      <div className="border-t border-slate-900/60 pt-2">
                        <span className="text-[10px] text-slate-450 block font-semibold">Total Faturas</span>
                        <span className={`text-sm font-black block tracking-tight mt-1 ${totalForecastForMonth > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                          R$ {totalForecastForMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Individual credit card projections list */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Projeção por Cartão</h4>
                <div className="divide-y divide-slate-900">
                  {cards.map(card => {
                    const metrics = calculateCardMetrics(card, allTransactions);
                    return (
                      <div key={card.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between text-xs gap-3">
                        <span className="font-extrabold text-slate-300 md:w-1/4 flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          {card.name}
                        </span>
                        
                        <div className="flex-1 grid grid-cols-2 lg:grid-cols-6 gap-2">
                          {forecastMonths.map(monthObj => {
                            const val = metrics.byMonth[monthObj.value] || 0;
                            return (
                              <div key={monthObj.value} className="bg-slate-950/40 p-2 border border-slate-900/85 rounded-xl flex justify-between items-center">
                                <span className="text-[9px] text-slate-600 font-bold uppercase">{monthObj.label.substring(0, 3)}</span>
                                <span className={`font-extrabold text-[11px] ${val > 0 ? 'text-slate-300' : 'text-slate-650'}`}>
                                  {val > 0 ? `R$ ${val.toFixed(0)}` : 'R$ 0'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================
          MODALES: DIALOGS FOR ACCOUNTS, CARDS, PAYMENTS
         ======================================================== */}

      {/* ACCOUNT NEW/EDIT DIALOG */}
      <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
        <DialogContent className="sm:max-w-[450px] border-slate-800 rounded-3xl p-0 overflow-hidden bg-[#09090B] text-slate-100">
          <DialogHeader className="px-8 py-6 bg-slate-900/50 border-b border-slate-800">
            <DialogTitle className="text-lg font-bold tracking-tight text-slate-50">
              {editingAccount ? 'Editar Conta' : 'Nova Conta Bancária'}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs text-slate-450">
              Crie uma conta para acompanhar seus saldos de débito e guardar as contas de crédito.
            </DialogDescription>
          </DialogHeader>
          
          <div className="px-8 py-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accName" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic block">Nome da Instituição ou Conta</Label>
              <Input 
                id="accName" 
                placeholder="Ex: Itaú Principal, Inter Poupança" 
                value={accountFormData.name} 
                onChange={e => setAccountFormData({ ...accountFormData, name: e.target.value })}
                className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100 focus:border-emerald-500" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accType" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic block">Tipo de Conta</Label>
                <Select 
                  value={accountFormData.type} 
                  onValueChange={(val: any) => setAccountFormData({ ...accountFormData, type: val })}
                >
                  <SelectTrigger id="accType" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#09090B] border-slate-800 text-slate-100">
                    <SelectItem value="Checking">Conta Corrente</SelectItem>
                    <SelectItem value="Savings">Poupança</SelectItem>
                    <SelectItem value="Investment">Investimentos</SelectItem>
                    <SelectItem value="Cash">Dinheiro / Carteira</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accBalance" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic block">Saldo Atual (R$)</Label>
                <Input 
                  id="accBalance" 
                  placeholder="0.00" 
                  type="number"
                  value={accountFormData.balance} 
                  onChange={e => setAccountFormData({ ...accountFormData, balance: e.target.value })}
                  className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100 font-bold" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic block">Design Cor de Destaque</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {ACCOUNT_COLORS.map(col => (
                  <button 
                    key={col} 
                    type="button" 
                    onClick={() => setAccountFormData({ ...accountFormData, color: col })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${accountFormData.color === col ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:border-slate-700'}`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="px-8 py-5 border-t border-slate-800 bg-slate-900/10 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAccountModalOpen(false)} className="rounded-xl text-slate-400">Cancelar</Button>
            <Button onClick={handleSaveAccount} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6">Salvar Conta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREDIT CARD NEW/EDIT DIALOG */}
      <Dialog open={isCardModalOpen} onOpenChange={setIsCardModalOpen}>
        <DialogContent className="sm:max-w-[450px] border-slate-800 rounded-3xl p-0 overflow-hidden bg-[#09090B] text-slate-100">
          <DialogHeader className="px-8 py-6 bg-slate-900/50 border-b border-slate-800">
            <DialogTitle className="text-lg font-bold tracking-tight text-slate-50">
              {editingCard ? 'Editar Cartão' : 'Novo Cartão de Crédito'}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs text-slate-450">
              Registre o limite, dia de fechamento e vencimento do cartão para os ciclos automáticos de faturas.
            </DialogDescription>
          </DialogHeader>

          <div className="px-8 py-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="cardName" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic block">Nome Comercial do Cartão</Label>
                <Input 
                  id="cardName" 
                  placeholder="Ex: Nubank Black, XP Infinite, Itaú Visa" 
                  value={cardFormData.name} 
                  onChange={e => setCardFormData({ ...cardFormData, name: e.target.value })}
                  className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cardLimit" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic block">Limite do Crédito (R$)</Label>
                <Input 
                  id="cardLimit" 
                  placeholder="Ex: 5000" 
                  type="number"
                  value={cardFormData.limit_amount} 
                  onChange={e => setCardFormData({ ...cardFormData, limit_amount: e.target.value })}
                  className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100 font-bold" 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardBrand" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic block">Bandeira</Label>
                <Select 
                  value={cardFormData.brand} 
                  onValueChange={(val: any) => setCardFormData({ ...cardFormData, brand: val })}
                >
                  <SelectTrigger id="cardBrand" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#09090B] border-slate-800 text-slate-100">
                    <SelectItem value="Mastercard">Mastercard</SelectItem>
                    <SelectItem value="Visa">Visa</SelectItem>
                    <SelectItem value="Elo">Elo</SelectItem>
                    <SelectItem value="American Express">Amex</SelectItem>
                    <SelectItem value="Outro">Outra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cardClosing" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic block">Dia de Fechamento</Label>
                <Select 
                  value={cardFormData.closing_day} 
                  onValueChange={(val: string) => setCardFormData({ ...cardFormData, closing_day: val })}
                >
                  <SelectTrigger id="cardClosing" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#09090B] border-slate-800 text-slate-100 max-h-56">
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                      <SelectItem key={day} value={day.toString()}>Dia {day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardDue" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic block">Dia do Vencimento</Label>
                <Select 
                  value={cardFormData.due_day} 
                  onValueChange={(val: string) => setCardFormData({ ...cardFormData, due_day: val })}
                >
                  <SelectTrigger id="cardDue" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#09090B] border-slate-800 text-slate-100 max-h-56">
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                      <SelectItem key={day} value={day.toString()}>Dia {day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardAcc" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic block">Debitar Automaticamente na Conta</Label>
              <Select 
                value={cardFormData.account_id}
                onValueChange={(val: string) => setCardFormData({ ...cardFormData, account_id: val })}
              >
                <SelectTrigger id="cardAcc" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100">
                  <SelectValue placeholder="Selecione a conta de liquidação..." />
                </SelectTrigger>
                <SelectContent className="bg-[#09090B] border-slate-800 text-slate-100">
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance.toFixed(0)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="px-8 py-5 border-t border-slate-800 bg-slate-900/10 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsCardModalOpen(false)} className="rounded-xl text-slate-400">Cancelar</Button>
            <Button onClick={handleSaveCard} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6">Salvar Cartão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PAY INVOICE DIALOG WITH BALANCE REDUCTION */}
      <Dialog open={isPayInvoiceModalOpen} onOpenChange={setIsPayInvoiceModalOpen}>
        <DialogContent className="sm:max-w-[450px] border-slate-800 rounded-3xl p-0 overflow-hidden bg-[#09090B] text-slate-100">
          <DialogHeader className="px-8 py-6 bg-slate-900/50 border-b border-slate-800">
            <DialogTitle className="text-lg font-bold tracking-tight text-slate-50">
              Quitar / Registrar Pagamento de Fatura
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs text-slate-450">
              Deduza diretamente o saldo de sua conta para zerar os gastos acumulados neste cartão.
            </DialogDescription>
          </DialogHeader>

          {payingCard && (
            <div className="px-8 py-6 space-y-4">
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/15 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-extrabold block">Fatura Cartão</span>
                  <span className="text-sm font-black text-slate-100">{payingCard.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-extrabold block">Valor Acumulado</span>
                  <span className="text-base font-black text-amber-400">R$ {Number(payAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paySrcAcc" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic block">Conta de Origem para Pagamento</Label>
                <Select 
                  value={paySourceAccountId}
                  onValueChange={(val: string) => setPaySourceAccountId(val)}
                >
                  <SelectTrigger id="paySrcAcc" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100">
                    <SelectValue placeholder="Selecione de onde virá o dinheiro..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#09090B] border-slate-800 text-slate-100">
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name} (Saldo: R$ {acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 0 })})</SelectItem>
                    ))}
                    <SelectItem value="manual">Manual (Registrar sem deduzir saldo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payVal" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic block">Valor Pago (R$)</Label>
                <Input 
                  id="payVal" 
                  placeholder="0.00" 
                  type="number"
                  value={payAmount} 
                  onChange={e => setPayAmount(e.target.value)}
                  className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100 font-bold" 
                />
              </div>
            </div>
          )}

          <DialogFooter className="px-8 py-5 border-t border-slate-800 bg-slate-900/10 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsPayInvoiceModalOpen(false)} className="rounded-xl text-slate-400">Voltar</Button>
            <Button onClick={handleConfirmPayInvoice} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6">Confirmar Quitação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
