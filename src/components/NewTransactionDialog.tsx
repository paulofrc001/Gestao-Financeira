import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, AlertCircle, Save } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toast } from 'sonner';
import { getAccounts, getCards, Account, Card as CreditCardType, saveAccount } from '../lib/accountsCardsStore';
import { addMonths, format, parseISO } from 'date-fns';

const formSchema = z.object({
  description: z.string().min(2, { message: "Descrição muito curta" }),
  amount: z.string().min(1, { message: "Informe um valor" }),
  category: z.string().min(1, { message: "Selecione uma categoria" }),
  date: z.string().min(1, { message: "Selecione uma data" }),
  type: z.enum(['income', 'expense', 'transfer']),
  emotion: z.string().optional(),
  source: z.string().optional(),
  isImpulse: z.boolean().default(false),
  necessityLevel: z.string().optional(),
});

export default function NewTransactionDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Accounts and Credit Cards resources
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'account' | 'card'>('account');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [installments, setInstallments] = useState<number>(1);

  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'expense',
      isImpulse: false,
      source: 'Manual',
      emotion: 'Neutro',
      necessityLevel: '3'
    }
  });

  // Load resources
  useEffect(() => {
    if (open) {
      const loadOptions = async () => {
        try {
          const accs = await getAccounts();
          const crds = await getCards();
          setAccounts(accs);
          setCards(crds);
          
          if (accs.length > 0) {
            setSelectedAccountId(accs[0].id);
          }
          if (crds.length > 0) {
            setSelectedCardId(crds[0].id);
          }
        } catch (err) {
          console.error(err);
        }
      };
      loadOptions();
    }
  }, [open]);

  // Adjust options based on transaction type
  const txType = form.watch('type');
  useEffect(() => {
    if (txType === 'income') {
      setPaymentMethod('account'); // Income must go to bank account
    }
  }, [txType]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    const amountNum = Number(values.amount);

    try {
      // Find associated account or card
      const acc = accounts.find(a => a.id === selectedAccountId);
      const card = cards.find(c => c.id === selectedCardId);
      const sourceName = paymentMethod === 'account' 
        ? (acc ? acc.name : 'Outro') 
        : (card ? card.name : 'Cartão de Crédito');

      // 1. DEMO MODE (LocalStorage fallback)
      if (!isSupabaseConfigured) {
        const localSaved = localStorage.getItem('finna_transactions');
        const txs = localSaved ? JSON.parse(localSaved) : [];

        // Check if installment credit card purchase
        if (paymentMethod === 'card' && installments > 1 && values.type === 'expense') {
          const partAmount = Number((amountNum / installments).toFixed(2));
          const baseDate = parseISO(values.date);
          const generatedTxs: any[] = [];

          for (let i = 1; i <= installments; i++) {
            const installmentDate = addMonths(baseDate, i - 1);
            const installmentDateStr = format(installmentDate, 'yyyy-MM-mm').replace(/-[0-9]{2}$/, '-' + String(installmentDate.getDate()).padStart(2, '0')); 
            // Fix eventual format issues with simple format:
            const finalDateStr = format(installmentDate, 'yyyy-MM-dd');
            
            generatedTxs.push({
              id: 'tx-' + Math.random().toString(36).substring(2, 9),
              description: `${values.description} (${i}/${installments})`,
              amount: -partAmount,
              date: finalDateStr,
              type: 'expense',
              category: values.category,
              emotion: values.emotion || 'Neutro',
              is_impulse: values.isImpulse,
              necessity_level: values.necessityLevel ? Number(values.necessityLevel) : null,
              source: sourceName,
              card_id: selectedCardId,
              installments: `${i}/${installments}`,
              status: 'completed'
            });
          }

          localStorage.setItem('finna_transactions', JSON.stringify([...generatedTxs, ...txs]));
        } else {
          // Regular bank transaction or single payment card purchase
          const finalAmount = values.type === 'expense' ? -Math.abs(amountNum) : Math.abs(amountNum);
          const newTx = {
            id: 'tx-' + Math.random().toString(36).substring(2, 9),
            description: values.description,
            amount: finalAmount,
            date: values.date,
            type: values.type,
            category: values.category,
            emotion: values.emotion || 'Neutro',
            is_impulse: values.isImpulse,
            necessity_level: values.necessityLevel ? Number(values.necessityLevel) : null,
            source: sourceName,
            account_id: paymentMethod === 'account' ? selectedAccountId : undefined,
            card_id: paymentMethod === 'card' ? selectedCardId : undefined,
            status: 'completed'
          };

          // If bank debit/credit account, update its balance in LocalStorage
          if (paymentMethod === 'account' && acc) {
            const updatedAccList = accounts.map(a => {
              if (a.id === selectedAccountId) {
                return { ...a, balance: a.balance + finalAmount };
              }
              return a;
            });
            localStorage.setItem('finna_accounts', JSON.stringify(updatedAccList));
          }

          localStorage.setItem('finna_transactions', JSON.stringify([newTx, ...txs]));
        }

        toast.success('Transação registrada no modo demonstração!');
        onOpenChange(false);
        setStep(1);
        form.reset();
        window.location.reload();
        return;
      }

      // 2. SUPABASE MODE
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      if (paymentMethod === 'card' && installments > 1 && values.type === 'expense') {
        const partAmount = Number((amountNum / installments).toFixed(2));
        const baseDate = parseISO(values.date);
        const rowsToInsert = [];

        for (let i = 1; i <= installments; i++) {
          const installmentDateStr = format(addMonths(baseDate, i - 1), 'yyyy-MM-dd');
          rowsToInsert.push({
            user_id: user.id,
            description: `${values.description} (${i}/${installments})`,
            amount: -partAmount,
            date: installmentDateStr,
            type: 'expense',
            category: values.category,
            emotion: values.emotion || 'Neutro',
            is_impulse: values.isImpulse,
            necessity_level: values.necessityLevel ? Number(values.necessityLevel) : null,
            source: sourceName,
            account_id: card ? card.account_id : null,
            card_id: selectedCardId,
            installments: `${i}/${installments}`,
            status: 'completed'
          });
        }

        const { error } = await supabase.from('transactions').insert(rowsToInsert);
        if (error) throw error;
      } else {
        // Single regular transaction
        const finalAmount = values.type === 'expense' ? -Math.abs(amountNum) : Math.abs(amountNum);
        const { error } = await supabase.from('transactions').insert({
          user_id: user.id,
          description: values.description,
          amount: finalAmount,
          date: values.date,
          type: values.type,
          category: values.category,
          emotion: values.emotion || 'Neutro',
          is_impulse: values.isImpulse,
          necessity_level: values.necessityLevel ? Number(values.necessityLevel) : null,
          source: sourceName,
          account_id: paymentMethod === 'account' ? selectedAccountId : (card ? card.account_id : null),
          card_id: paymentMethod === 'card' ? selectedCardId : null,
          status: 'completed'
        });

        if (error) throw error;

        // Balance reduction query
        if (paymentMethod === 'account' && acc) {
          const { error: accError } = await supabase
            .from('accounts')
            .update({ balance: acc.balance + finalAmount })
            .eq('id', selectedAccountId);
          if (accError) console.error('Error updating account balance', accError);
        }
      }

      toast.success('Transação registrada com sucesso!');
      onOpenChange(false);
      setStep(1);
      form.reset();
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-slate-800 rounded-3xl p-0 overflow-hidden bg-[#09090B] text-slate-50">
        <DialogHeader className="px-8 py-6 bg-slate-900/50 border-b border-slate-800">
          <DialogTitle className="text-xl font-bold tracking-tight text-slate-50">Entrada Financeira</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-8 py-6">
          {step === 1 ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex gap-4 p-1 bg-slate-900 rounded-xl border border-slate-800">
                 <Button 
                   type="button"
                   variant="ghost" 
                   className={`flex-1 rounded-lg text-xs font-bold transition-all ${form.watch('type') === 'expense' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
                   onClick={() => form.setValue('type', 'expense')}
                 >
                    Despesa
                 </Button>
                 <Button 
                    type="button"
                    variant="ghost" 
                    className={`flex-1 rounded-lg text-xs font-bold transition-all ${form.watch('type') === 'income' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
                    onClick={() => form.setValue('type', 'income')}
                 >
                    Receita
                 </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic">O que foi comprado / recebido?</Label>
                  <Input id="description" placeholder="Ex: Mercado Mensal, Salário" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100 placeholder:text-slate-700 focus:border-indigo-500 font-medium" {...form.register('description')} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic">Valor total (R$)</Label>
                    <Input id="amount" placeholder="0,00" type="number" step="any" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 font-bold text-slate-50 focus:border-indigo-500" {...form.register('amount')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic">Data do fluxo</Label>
                    <Input id="date" type="date" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100 focus:border-indigo-500" {...form.register('date')} />
                  </div>
                </div>

                {/* DYNAMIC PAYMENT METHOD SELECTORS (CONTAS E CARTÕES) */}
                <div className="space-y-3 bg-[#0c0c0e]/60 p-4 border border-slate-800 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400 italic">Forma de Pagamento</span>
                    {txType === 'expense' && (
                      <div className="flex gap-1.5 p-0.5 bg-slate-900 border border-slate-800 rounded-lg">
                        <button 
                          type="button"
                          onClick={() => setPaymentMethod('account')}
                          className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition ${paymentMethod === 'account' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
                        >
                          Conta
                        </button>
                        <button 
                          type="button"
                          onClick={() => setPaymentMethod('card')}
                          className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition ${paymentMethod === 'card' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
                        >
                          Cartão
                        </button>
                      </div>
                    )}
                  </div>

                  {paymentMethod === 'account' ? (
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block">Conta Debitada / Creditada</Label>
                      {accounts.length > 0 ? (
                        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                          <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900/80 h-10 text-slate-100 font-medium">
                            <SelectValue placeholder="Selecione a conta..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#09090B] border-slate-800 text-slate-100">
                            {accounts.map(acc => (
                              <SelectItem key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 0 })})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-[10px] text-amber-500 italic font-semibold">Crie uma conta primeiro na aba Contas.</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 animate-in slide-in-from-top-1 duration-150">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 block">Cartão Selecionado</Label>
                        {cards.length > 0 ? (
                          <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                            <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900/80 h-10 text-slate-100 font-medium">
                              <SelectValue placeholder="Selecione o cartão..." />
                            </SelectTrigger>
                            <SelectContent className="bg-[#09090B] border-slate-800 text-slate-150">
                              {cards.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name} (Lim: R$ {c.limit_amount.toLocaleString()})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-[10px] text-amber-500 italic font-semibold">Crie um cartão de crédito primeiro na aba de Contas.</p>
                        )}
                      </div>

                      {/* Parcelas Selector */}
                      <div className="pt-2 border-t border-slate-900/80 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Parcelamento</span>
                          <span className="text-[9px] text-indigo-400 block leading-tight font-medium">Dividir em parcelas mensais fixas</span>
                        </div>
                        <Select value={installments.toString()} onValueChange={(val) => setInstallments(Number(val))}>
                          <SelectTrigger className="w-24 rounded-lg border-slate-800 bg-slate-900/50 h-9 font-extrabold text-slate-100 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#09090B] border-slate-800 text-slate-100">
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                              <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic">Categoria</Label>
                  <Select onValueChange={(v) => form.setValue('category', v)}>
                    <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100 focus:border-indigo-500">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#09090B] border-slate-800 text-slate-100">
                      <SelectItem value="alimentacao" className="focus:bg-indigo-600 focus:text-white">Alimentação</SelectItem>
                      <SelectItem value="moradia" className="focus:bg-indigo-600 focus:text-white">Moradia</SelectItem>
                      <SelectItem value="lazer" className="focus:bg-indigo-600 focus:text-white">Lazer</SelectItem>
                      <SelectItem value="transporte" className="focus:bg-indigo-600 focus:text-white">Transporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                type="button" 
                className="w-full rounded-2xl h-12 bg-indigo-600 hover:bg-indigo-700 font-bold transition-all shadow-xl shadow-indigo-600/20"
                onClick={() => setStep(2)}
              >
                Análise Sensorial
              </Button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex gap-3">
                  <Heart className="text-indigo-400 w-5 h-5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-indigo-100">Algoritmo de Bem-estar</p>
                    <p className="text-[10px] text-indigo-300/80">Identificar suas emoções ajuda a reduzir gastos por impulso em 30%.</p>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic">Estado Emocional no momento?</Label>
                    <div className="grid grid-cols-3 gap-2">
                       {['Feliz', 'Ansioso', 'Culpado', 'Neutro', 'Nervoso', 'Satisfeito'].map(em => (
                         <Button 
                           key={em} 
                           type="button"
                           variant="outline" 
                           onClick={() => form.setValue('emotion', em)}
                           className={`h-10 rounded-xl text-[10px] border-slate-800 bg-slate-900/30 uppercase font-bold tracking-widest transition-all ${form.watch('emotion') === em ? 'bg-indigo-600 text-white border-indigo-500' : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-100'}`}
                         >
                           {em}
                         </Button>
                       ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                     <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-300">Foi impulsivo?</span>
                     </div>
                     <Button 
                        type="button"
                        onClick={() => form.setValue('isImpulse', !form.watch('isImpulse'))}
                        className={`h-8 rounded-full px-4 text-[9px] font-bold uppercase tracking-widest transition-all ${form.watch('isImpulse') ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'bg-slate-800 text-slate-500'}`}
                     >
                        {form.watch('isImpulse') ? 'Sim (Detectado)' : 'Não'}
                     </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic">Nível de necessidade (1-5)</Label>
                    <div className="flex justify-between gap-2 text-center">
                       {[1, 2, 3, 4, 5].map(n => (
                         <Button 
                           key={n} 
                           type="button"
                           onClick={() => form.setValue('necessityLevel', n.toString())}
                           className={`flex-1 h-10 rounded-xl border-slate-800 transition-all ${form.watch('necessityLevel') === n.toString() ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900/30 text-slate-500 hover:bg-slate-800/50'}`} 
                           variant="outline"
                         >
                           {n}
                         </Button>
                       ))}
                    </div>
                  </div>
               </div>

               <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="flex-1 rounded-2xl h-12 text-slate-500 font-bold hover:text-slate-100"
                    onClick={() => setStep(1)}
                  >
                    Voltar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="flex-2 rounded-2xl h-12 bg-emerald-600 hover:bg-emerald-700 font-bold text-white shadow-xl shadow-emerald-600/10 transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {loading ? 'Salvando...' : 'Salvar Dados'}
                  </Button>
               </div>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
