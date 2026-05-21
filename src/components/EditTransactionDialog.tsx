import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, Brain, AlertCircle, Save, Undo2, CreditCard, Calendar, Layers } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toast } from 'sonner';
import { fetchCategories, Category } from '../lib/categoriesStore';
import { getCards } from '../lib/accountsCardsStore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  applyToAllSimilar: z.boolean().default(false),
});

interface EditTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any;
  onSuccess: () => void;
}

function getBaseDescription(desc: string): string {
  if (!desc) return '';
  return desc.replace(/\s*[([{\-]\s*\d+\s*\/\s*\d+\s*[)\]}]/g, '').trim();
}

export default function EditTransactionDialog({ open, onOpenChange, transaction, onSuccess }: EditTransactionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('core');
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [relatedTransactions, setRelatedTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      const loadCatsAndCards = async () => {
        try {
          const cats = await fetchCategories();
          setAvailableCategories(cats);
          const fetchedCards = await getCards();
          setCards(fetchedCards);
        } catch (err) {
          console.error('Error in EditTransactionDialog pre-fetching:', err);
        }
      };
      loadCatsAndCards();
    }
  }, [open]);

  useEffect(() => {
    if (open && transaction) {
      const loadRelated = async () => {
        try {
          let allTxs: any[] = [];
          if (!isSupabaseConfigured) {
            const localSaved = localStorage.getItem('finna_transactions');
            allTxs = localSaved ? JSON.parse(localSaved) : [];
          } else {
            const { data, error } = await supabase
              .from('transactions')
              .select('*')
              .order('date', { ascending: true });
            if (!error && data) {
              allTxs = data;
            }
          }

          const baseDesc = getBaseDescription(transaction.description);
          if (baseDesc) {
            const matched = allTxs.filter((t: any) => {
              const otherBase = getBaseDescription(t.description);
              return otherBase.toLowerCase() === baseDesc.toLowerCase();
            });
            matched.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setRelatedTransactions(matched);
          } else {
            setRelatedTransactions([]);
          }
        } catch (err) {
          console.error('Error fetching related transactions:', err);
        }
      };
      loadRelated();
    }
  }, [open, transaction]);

  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'expense',
      isImpulse: false,
      source: 'Manual',
      emotion: 'Neutro',
      necessityLevel: '3',
      applyToAllSimilar: false
    }
  });

  // Load transaction values into form when transaction prop changes
  useEffect(() => {
    if (transaction) {
      form.reset({
        description: transaction.description || '',
        amount: String(Math.abs(Number(transaction.amount || 0))),
        category: transaction.category || 'alimentacao',
        date: transaction.date ? transaction.date.substring(0, 10) : '',
        type: transaction.type || 'expense',
        emotion: transaction.emotion || 'Neutro',
        source: transaction.source || 'Manual',
        isImpulse: !!transaction.is_impulse,
        necessityLevel: transaction.necessity_level ? String(transaction.necessity_level) : '3',
        applyToAllSimilar: false
      });
    }
  }, [transaction, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!transaction) return;

    const formattedAmount = values.type === 'expense' ? -Math.abs(Number(values.amount)) : Math.abs(Number(values.amount));

    if (!isSupabaseConfigured) {
      // Offline / LocalStorage mode
      try {
        setLoading(true);
        const localSaved = localStorage.getItem('finna_transactions');
        let txs = localSaved ? JSON.parse(localSaved) : [];
        let updatedSimilarCount = 0;
        
        // Update the item in local array
        txs = txs.map((t: any) => {
          if (t.id === transaction.id) {
            return {
              ...t,
              description: values.description,
              amount: formattedAmount,
              date: values.date,
              type: values.type,
              category: values.category,
              emotion: values.emotion || 'Neutro',
              is_impulse: values.isImpulse,
              necessity_level: values.necessityLevel ? Number(values.necessityLevel) : null,
              source: values.source || 'Manual',
            };
          } else if (values.applyToAllSimilar && t.description?.trim().toLowerCase() === transaction.description?.trim().toLowerCase()) {
            updatedSimilarCount++;
            return {
              ...t,
              category: values.category
            };
          }
          return t;
        });

        localStorage.setItem('finna_transactions', JSON.stringify(txs));
        
        if (values.applyToAllSimilar && updatedSimilarCount > 0) {
          toast.success(`Transação e mais ${updatedSimilarCount} lançamentos semelhantes atualizados!`);
        } else {
          toast.success('Transação atualizada no modo demonstração!');
        }
        onOpenChange(false);
        onSuccess();
      } catch (err: any) {
        toast.error('Erro ao editar transação simulada: ' + err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          description: values.description,
          amount: formattedAmount,
          date: values.date,
          type: values.type,
          category: values.category,
          emotion: values.emotion || 'Neutro',
          is_impulse: values.isImpulse,
          necessity_level: values.necessityLevel ? Number(values.necessityLevel) : null,
          source: values.source || 'Manual',
        })
        .eq('id', transaction.id);

      if (error) throw error;

      let updatedSimilarCount = 0;
      if (values.applyToAllSimilar && transaction.description) {
        // Bulk update other transactions with the exact same description
        const { error: batchErr, count } = await supabase
          .from('transactions')
          .update({ category: values.category })
          .eq('description', transaction.description)
          .not('id', 'eq', transaction.id);
        
        if (batchErr) {
          console.error("Erro no depara em lote:", batchErr);
        } else {
          toast.success('Transações semelhantes atualizadas via depara!');
        }
      }
      
      toast.success('Transação atualizada com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao atualizar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-slate-800 rounded-3xl p-0 max-h-[85vh] overflow-y-auto bg-[#09090B] text-slate-50">
        <DialogHeader className="px-8 py-6 bg-slate-900/50 border-b border-slate-800">
          <DialogTitle className="text-xl font-bold tracking-tight text-slate-50 italic">Editar Entrada Financeira</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-8 pt-4">
            <TabsList className="grid grid-cols-2 bg-slate-900 border border-slate-800 rounded-xl p-1">
              <TabsTrigger value="core" className="rounded-lg text-xs font-bold py-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all text-slate-400">
                Informações Básicas
              </TabsTrigger>
              <TabsTrigger value="sensorial" className="rounded-lg text-xs font-bold py-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all text-slate-400">
                Análise Sensorial & IA
              </TabsTrigger>
            </TabsList>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="px-8 py-6">
            <TabsContent value="core" className="mt-0 space-y-6 focus-visible:outline-none focus-visible:ring-0">
              <div className="flex gap-4 p-1 bg-slate-900 rounded-xl border border-slate-800">
                <Button 
                  type="button"
                  variant="ghost" 
                  className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all h-9 ${form.watch('type') === 'expense' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
                  onClick={() => form.setValue('type', 'expense')}
                >
                  Despesa
                </Button>
                <Button 
                  type="button"
                  variant="ghost" 
                  className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all h-9 ${form.watch('type') === 'income' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
                  onClick={() => form.setValue('type', 'income')}
                >
                  Receita
                </Button>
              </div>

              <div className="space-y-4">
                {/* IDENTIFICAÇÃO DE CARTÃO E PARCELAS */}
                {transaction && (transaction.card_id || transaction.installments) && (
                  <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-slate-100 flex items-start gap-3.5 mb-1 animate-in fade-in slide-in-from-top-1 duration-300">
                    <CreditCard className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-indigo-200">Lançamento de Cartão de Crédito</p>
                      <p className="text-[11px] text-slate-400 leading-tight font-medium">
                        Esta despesa pertence ao cartão <span className="font-bold text-indigo-300">{cards.find(c => c.id === transaction.card_id)?.name || transaction.source || 'Nubank'}</span>.
                      </p>
                      {transaction.installments && (
                        <div className="flex items-center gap-1.5 mt-2 bg-indigo-500/15 border border-indigo-500/20 px-2 py-0.5 w-fit rounded-lg text-[10px] text-indigo-300 font-bold italic">
                          <Calendar className="w-3.5 h-3.5 text-indigo-300" />
                          Parcela {transaction.installments.split('/')[0]} de {transaction.installments.split('/')[1]}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="edit-description" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic">O que foi comprado / recebido?</Label>
                  <Input id="edit-description" placeholder="Ex: Mercado Mensal" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100 placeholder:text-slate-700 focus:border-indigo-500" {...form.register('description')} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-amount" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic">Valor (R$)</Label>
                    <Input id="edit-amount" placeholder="0,00" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 font-bold text-slate-50 focus:border-indigo-500" {...form.register('amount')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-date" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic">Data do fluxo</Label>
                    <Input id="edit-date" type="date" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100 focus:border-indigo-500" {...form.register('date')} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-source" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic">Origem / Conta</Label>
                  <Input id="edit-source" placeholder="Ex: Dinheiro, Nubank, Itaú" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100 placeholder:text-slate-700 focus:border-indigo-500" {...form.register('source')} />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic">Categoria</Label>
                  <Select value={form.watch('category')} onValueChange={(v) => form.setValue('category', v)}>
                    <SelectTrigger className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100 focus:border-indigo-500">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#09090B] border-slate-800 text-slate-100">
                      {availableCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name} className="focus:bg-indigo-600 focus:text-white capitalize">
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 mt-1 duration-300 hover:border-slate-800 transition">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-indigo-400 block">Propagar Categoria (Depara)?</span>
                    <p className="text-[10px] text-slate-400 max-w-[280px] leading-tight font-medium">Alterar a categoria de todas as outras transações com esta mesma descrição.</p>
                  </div>
                  <Button 
                    type="button"
                    onClick={() => form.setValue('applyToAllSimilar', !form.watch('applyToAllSimilar'))}
                    className={`h-8 rounded-xl px-4 text-[9px] font-bold uppercase tracking-widest transition-all ${form.watch('applyToAllSimilar') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-800/60 text-slate-400'}`}
                  >
                    {form.watch('applyToAllSimilar') ? 'Sim' : 'Não'}
                  </Button>
                </div>

                {/* CRONOGRAMA DE PROJEÇÕES E PARCELAS FUTURAS */}
                {relatedTransactions.length > 1 && (
                  <div className="space-y-3 mt-4 border-t border-slate-800/80 pt-4">
                    <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic block flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      Projeção e Cronograma de Parcelas
                    </Label>
                    
                    <div className="bg-[#0a0a0d] border border-slate-800/80 rounded-2xl p-4 space-y-3.5 max-h-[220px] overflow-y-auto custom-scrollbar">
                      <div className="flex justify-between items-center text-[10.5px] text-slate-400 border-b border-slate-800/40 pb-2 font-bold">
                        <span>{getBaseDescription(transaction.description)}</span>
                        <span className="text-indigo-400">{relatedTransactions.length} parcelas salvas</span>
                      </div>
                      
                      <div className="relative border-l border-slate-800 pl-4 ml-1.5 space-y-4 py-1">
                        {relatedTransactions.map((t, idx) => {
                          const isCurrent = t.id === transaction.id;
                          const isFuture = new Date(t.date) > new Date();
                          const installmentInfo = t.installments || `${idx + 1}/${relatedTransactions.length}`;
                          
                          return (
                            <div key={t.id || idx} className="relative group/time">
                              {/* Timeline dot */}
                              <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 transition-all duration-300
                                ${isCurrent 
                                  ? 'bg-indigo-500 border-indigo-400 scale-125 shadow-[0_0_8px_rgba(99,102,241,0.5)]' 
                                  : isFuture
                                    ? 'bg-[#09090B] border-slate-700' 
                                    : 'bg-emerald-500 border-emerald-400'
                                }`} 
                              />
                              
                              <div className="flex items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[11px] font-bold ${isCurrent ? 'text-indigo-300 font-extrabold' : isFuture ? 'text-slate-450' : 'text-slate-350'}`}>
                                      Parcela {installmentInfo}
                                    </span>
                                    {isCurrent && (
                                      <span className="bg-indigo-600/20 text-indigo-400 text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase tracking-wider">
                                        Editando
                                      </span>
                                    )}
                                    {isFuture && (
                                      <span className="bg-amber-600/10 text-amber-500 text-[8px] font-extrabold px-1.5 py-0.2 rounded border border-amber-500/15 uppercase tracking-wider">
                                        Pendente
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-semibold">
                                    {format(new Date(t.date + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                  </p>
                                </div>
                                
                                <div className="text-right">
                                  <span className={`text-xs font-extrabold block ${isCurrent ? 'text-indigo-400' : isFuture ? 'text-slate-400' : 'text-slate-200'}`}>
                                    R$ {Math.abs(Number(t.amount)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-medium uppercase tracking-tighter">
                                    {t.status === 'completed' ? 'Faturado' : 'Projetado'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button 
                  type="button" 
                  className="w-full rounded-2xl h-12 bg-indigo-600 hover:bg-indigo-700 font-bold transition-all shadow-xl shadow-indigo-600/20"
                  onClick={() => setActiveTab('sensorial')}
                >
                  Ir para Análise Sensorial
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="sensorial" className="mt-0 space-y-6 focus-visible:outline-none focus-visible:ring-0">
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex gap-3">
                <Heart className="text-indigo-400 w-5 h-5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-indigo-100">Algoritmo de Bem-estar</p>
                  <p className="text-[10px] text-indigo-300/80">Identificar suas emoções ajuda a mapear e otimizar impulsos financeiros.</p>
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
                  onClick={() => setActiveTab('core')}
                >
                  Voltar
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="flex-2 rounded-2xl h-12 bg-emerald-600 hover:bg-emerald-700 font-bold text-white shadow-xl shadow-emerald-600/10 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </TabsContent>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
