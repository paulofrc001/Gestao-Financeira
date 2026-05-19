import { useState, useEffect } from 'react';
import { Calendar, ChevronDown, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, subMonths, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type PeriodType = 'all' | 'current_month' | 'last_month' | 'last_30_days' | 'last_90_days' | 'this_year' | 'custom' | 'specific_month';

export interface DateRangeFilter {
  type: PeriodType;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  specificMonth?: string; // YYYY-MM
}

interface PeriodFilterProps {
  onChange: (filter: DateRangeFilter) => void;
  transactions: any[];
}

export default function PeriodFilter({ onChange, transactions }: PeriodFilterProps) {
  const [activeType, setActiveType] = useState<PeriodType>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSpecificMonth, setSelectedSpecificMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]); // Array of "YYYY-MM"
  const [showDropdown, setShowDropdown] = useState(false);

  // Extract all unique months from transactions or default to recent/current months
  useEffect(() => {
    const monthsSet = new Set<string>();
    
    // Always include current month and last month as options
    const now = new Date();
    monthsSet.add(format(now, 'yyyy-MM'));
    monthsSet.add(format(subMonths(now, 1), 'yyyy-MM'));
    monthsSet.add(format(subMonths(now, 2), 'yyyy-MM'));

    transactions.forEach(tx => {
      if (tx.date) {
        try {
          const dateStr = tx.date.substring(0, 7); // "YYYY-MM"
          if (dateStr && dateStr.length === 7 && dateStr.match(/^\d{4}-\d{2}$/)) {
            monthsSet.add(dateStr);
          }
        } catch (e) {
          console.error('Error parsing date for filter', e);
        }
      }
    });

    const sortedMonths = Array.from(monthsSet).sort().reverse(); // Decending
    setAvailableMonths(sortedMonths);
  }, [transactions]);

  const handleTypeSelect = (type: PeriodType, specificM?: string) => {
    setActiveType(type);
    setShowDropdown(false);
    
    const now = new Date();
    
    if (type === 'all') {
      onChange({ type: 'all' });
    } else if (type === 'current_month') {
      const yearMonth = format(now, 'yyyy-MM');
      onChange({ type: 'current_month', specificMonth: yearMonth });
    } else if (type === 'last_month') {
      const lastMonthDate = subMonths(now, 1);
      const yearMonth = format(lastMonthDate, 'yyyy-MM');
      onChange({ type: 'last_month', specificMonth: yearMonth });
    } else if (type === 'last_30_days') {
      onChange({ type: 'last_30_days' });
    } else if (type === 'last_90_days') {
      onChange({ type: 'last_90_days' });
    } else if (type === 'this_year') {
      onChange({ type: 'this_year' });
    } else if (type === 'specific_month' && specificM) {
      setSelectedSpecificMonth(specificM);
      onChange({ type: 'specific_month', specificMonth: specificM });
    } else if (type === 'custom') {
      onChange({ type: 'custom', startDate, endDate });
    }
  };

  const applyCustomFilter = () => {
    if (startDate || endDate) {
      onChange({ type: 'custom', startDate, endDate });
    }
  };

  const clearCustomDates = () => {
    setStartDate('');
    setEndDate('');
    onChange({ type: 'all' });
    setActiveType('all');
  };

  // Helper to format month name for BRL
  const formatMonthLabel = (yearMonth: string) => {
    try {
      const [year, month] = yearMonth.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      const formatted = format(date, 'MMMM yyyy', { locale: ptBR });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return yearMonth;
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 bg-slate-900/10 border border-slate-800/60 rounded-3xl p-5 mb-6 animate-in fade-in duration-300">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <Calendar className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200">Filtro Temporal</h4>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold italic">Selecione o período de análise</p>
          </div>
        </div>

        {/* Action button-pills */}
        <div className="flex flex-wrap gap-1.5 w-full xl:w-auto">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTypeSelect('all')}
            className={`rounded-xl px-3 py-1 h-8 text-[9px] font-bold uppercase tracking-wider transition-all ${activeType === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            Tudo
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTypeSelect('current_month')}
            className={`rounded-xl px-3 py-1 h-8 text-[9px] font-bold uppercase tracking-wider transition-all ${activeType === 'current_month' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            Este Mês
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTypeSelect('last_month')}
            className={`rounded-xl px-3 py-1 h-8 text-[9px] font-bold uppercase tracking-wider transition-all ${activeType === 'last_month' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            Mês Passado
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTypeSelect('last_30_days')}
            className={`rounded-xl px-3 py-1 h-8 text-[9px] font-bold uppercase tracking-wider transition-all ${activeType === 'last_30_days' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            30 Dias
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTypeSelect('last_90_days')}
            className={`rounded-xl px-3 py-1 h-8 text-[9px] font-bold uppercase tracking-wider transition-all ${activeType === 'last_90_days' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            Trimestre
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTypeSelect('this_year')}
            className={`rounded-xl px-3 py-1 h-8 text-[9px] font-bold uppercase tracking-wider transition-all ${activeType === 'this_year' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            Este Ano
          </Button>

          {/* Quick Select specific month dropdown */}
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDropdown(!showDropdown)}
              className={`rounded-xl px-3 py-1 h-8 text-[9px] font-bold uppercase tracking-wider border-slate-800/80 transition-all ${activeType === 'specific_month' ? 'bg-indigo-600 text-white border-none' : 'bg-slate-900/40 text-slate-400 hover:bg-slate-800/50'}`}
            >
              {activeType === 'specific_month' ? formatMonthLabel(selectedSpecificMonth) : 'Mensal'}
              <ChevronDown className="w-3 ml-1.5 shrink-0 opacity-80" />
            </Button>
            
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-[#09090B] border border-slate-800 rounded-xl shadow-2xl z-50 p-1 divide-y divide-slate-800/30 max-h-56 overflow-y-auto">
                {availableMonths.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleTypeSelect('specific_month', m)}
                    className="w-full text-left px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wide text-slate-300 hover:bg-indigo-600 hover:text-white flex items-center justify-between transition-colors"
                  >
                    {formatMonthLabel(m)}
                    {activeType === 'specific_month' && selectedSpecificMonth === m && (
                      <Check className="w-3 h-3" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setActiveType('custom')}
            className={`rounded-xl px-3 py-1 h-8 text-[9px] font-bold uppercase tracking-wider transition-all ${activeType === 'custom' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}
          >
            Personalizado
          </Button>
        </div>
      </div>

      {/* Hidden Panel for Custom Period Date Inputs */}
      {activeType === 'custom' && (
        <div className="pt-4 border-t border-slate-800/50 flex flex-col md:flex-row items-end gap-4 animate-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-2 gap-4 w-full md:max-w-md">
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 italic ml-1">De (Data inicial)</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border-slate-800 bg-slate-900/50 text-slate-200 h-10 px-3 py-1.5 text-xs focus:border-indigo-500 transition-all font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 italic ml-1">Até (Data final)</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl border-slate-800 bg-slate-900/50 text-slate-200 h-10 px-3 py-1.5 text-xs focus:border-indigo-500 transition-all font-semibold"
              />
            </div>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto shrink-0">
            <Button
              type="button"
              onClick={applyCustomFilter}
              className="flex-1 md:flex-none rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase px-6 h-10 tracking-widest"
            >
              Aplicar Intervalo
            </Button>
            {(startDate || endDate) && (
              <Button
                type="button"
                variant="ghost"
                onClick={clearCustomDates}
                className="rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 p-2.5 h-10"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Global filter helper
export function filterTxsByDate(transactions: any[], filter: DateRangeFilter): any[] {
  if (!transactions || transactions.length === 0) return [];
  if (filter.type === 'all') return transactions;

  const now = new Date();

  return transactions.filter(tx => {
    if (!tx.date) return true;
    
    // Support dates in standard formats
    const txDateStr = tx.date.substring(0, 10); // "YYYY-MM-DD"
    
    if (filter.type === 'current_month' || filter.type === 'last_month' || filter.type === 'specific_month') {
      if (filter.specificMonth) {
        return txDateStr.startsWith(filter.specificMonth);
      }
    }
    
    if (filter.type === 'last_30_days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const startStr = thirtyDaysAgo.toISOString().substring(0, 10);
      const endStr = now.toISOString().substring(0, 10);
      return txDateStr >= startStr && txDateStr <= endStr;
    }

    if (filter.type === 'last_90_days') {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(now.getDate() - 90);
      const startStr = ninetyDaysAgo.toISOString().substring(0, 10);
      const endStr = now.toISOString().substring(0, 10);
      return txDateStr >= startStr && txDateStr <= endStr;
    }

    if (filter.type === 'this_year') {
      const yearStartStr = `${now.getFullYear()}-01-01`;
      const yearEndStr = `${now.getFullYear()}-12-31`;
      return txDateStr >= yearStartStr && txDateStr <= yearEndStr;
    }

    if (filter.type === 'custom') {
      const { startDate, endDate } = filter;
      if (startDate && txDateStr < startDate) return false;
      if (endDate && txDateStr > endDate) return false;
      return true;
    }
    
    return true;
  });
}
