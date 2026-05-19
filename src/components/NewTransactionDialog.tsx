import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, Brain, AlertCircle, Save } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toast } from 'sonner';

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
  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'expense',
      isImpulse: false,
      source: 'Manual'
    }
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!isSupabaseConfigured) {
       toast.info('Modo demonstração: transação simulada.');
       onOpenChange(false);
       setStep(1);
       form.reset();
       return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        description: values.description,
        amount: values.type === 'expense' ? -Math.abs(Number(values.amount)) : Math.abs(Number(values.amount)),
        date: values.date,
        type: values.type,
        category: values.category,
        emotion: values.emotion || 'Neutro',
        is_impulse: values.isImpulse,
        necessity_level: values.necessityLevel ? Number(values.necessityLevel) : null,
        source: values.source || 'Manual',
        status: 'completed'
      });

      if (error) throw error;
      
      toast.success('Transação registrada com sucesso!');
      onOpenChange(false);
      setStep(1);
      form.reset();
      // Reload page to see new data (simple way)
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
                  <Label htmlFor="description" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic">O que foi comprado?</Label>
                  <Input id="description" placeholder="Ex: Mercado Mensal" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100 placeholder:text-slate-700 focus:border-indigo-500" {...form.register('description')} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic">Valor (R$)</Label>
                    <Input id="amount" placeholder="0,00" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 font-bold text-slate-50 focus:border-indigo-500" {...form.register('amount')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic">Data do fluxo</Label>
                    <Input id="date" type="date" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100 focus:border-indigo-500" {...form.register('date')} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="source" className="text-[10px] uppercase tracking-widest font-bold text-slate-500 italic">Origem / Conta</Label>
                  <Input id="source" placeholder="Ex: Dinheiro, Nubank, Itaú" className="rounded-xl border-slate-800 bg-slate-900/50 h-11 text-slate-100 placeholder:text-slate-700 focus:border-indigo-500" {...form.register('source')} />
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
