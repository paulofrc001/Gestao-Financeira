import { motion } from 'motion/react';
import { Sparkles, Brain, Loader2, Hourglass } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  subMessage?: string;
  variant?: 'fullscreen' | 'card' | 'inline' | 'micro';
  retryAttempt?: number;
  retryDelay?: number;
}

export default function LoadingState({
  message = 'Sincronizando com IA Finna...',
  subMessage = 'Organizando sua inteligência financeira...',
  variant = 'card',
  retryAttempt = 0,
  retryDelay = 0
}: LoadingStateProps) {

  const spinner = (
    <div className="relative flex items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        className="w-10 h-10 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full"
      />
      <Brain className="w-4 h-4 text-indigo-400 absolute animate-pulse" />
    </div>
  );

  const retryAlert = retryAttempt > 0 && (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 mx-auto max-w-xs justify-center"
    >
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span>AI Ocupada. Tentando novamente #{retryAttempt}...</span>
    </motion.div>
  );

  if (variant === 'fullscreen') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="space-y-6 max-w-md">
          {spinner}
          
          <div className="space-y-2">
            <h3 className="text-lg font-black tracking-tight text-white flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
              {message}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold italic">
              {subMessage}
            </p>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 max-w-xs mx-auto">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 block mb-1">Status da Fila</span>
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-300">
               <Hourglass className="w-3.5 h-3.5 animate-spin text-indigo-400" />
               Controle de Concorrência Ativo
            </div>
          </div>

          {retryAlert}
        </div>
      </motion.div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-3 py-3 px-4 bg-[#0a0a0c] border border-slate-900 rounded-xl">
        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
        <span className="text-xs font-bold text-slate-300">{message}</span>
        {retryAttempt > 0 && (
          <span className="text-[10px] text-amber-400 font-extrabold ml-auto">Retentando #{retryAttempt}</span>
        )}
      </div>
    );
  }

  if (variant === 'micro') {
    return (
      <div className="flex items-center gap-1.5 text-indigo-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="text-[11px] font-bold tracking-tight">{message}</span>
      </div>
    );
  }

  // DEFAULT: Variant 'card'
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#0b0b0d] border border-slate-900 rounded-3xl p-8 text-center space-y-4 max-w-md mx-auto shadow-2xl relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
      
      {spinner}

      <div className="space-y-1 relative z-10">
        <h4 className="text-sm font-black tracking-tight text-slate-100 uppercase">{message}</h4>
        <p className="text-[11px] text-slate-500 font-medium italic">{subMessage}</p>
      </div>

      {retryAlert}
    </motion.div>
  );
}
