import React from 'react';
import { Box, Cpu, Shield, Zap } from 'lucide-react';
import { MODEL_TIER_CONFIG } from '../data/mockData';

export function ModelsPage() {
  const models = Object.entries(MODEL_TIER_CONFIG).map(([key, value]) => ({
    id: key,
    ...value
  }));

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto flex flex-col p-6 overflow-y-auto animate-in fade-in duration-500">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold text-white tracking-tight flex items-center justify-center gap-3 mb-3">
          <Box className="w-8 h-8 text-amber-500" />
          Gateway Neural Models
        </h2>
        <p className="text-slate-400 font-mono text-sm max-w-2xl mx-auto">
          Deep-space optimized inference clusters running on the Mars Gateway. 
          Latency depends on relay distance and tier allocation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
        {models.map((model) => (
          <div key={model.id} className="p-6 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-md flex flex-col h-full hover:border-amber-500/30 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white font-sans">{model.id.replace(/-/g, ' ').toUpperCase()}</h3>
                <p className="text-xs font-mono text-amber-400/80 mt-1">{model.quotaFormatted} Tokens / Month</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <Cpu className="w-5 h-5 text-slate-300" />
              </div>
            </div>

            <div className="flex-1">
              <p className="text-sm text-slate-400 mb-6 line-clamp-3">
                {model.id.includes('flash') ? 'High-speed, low-latency inference optimized for rapid iterative tasks and planetary rover telemetry processing.' : 
                 model.id.includes('pro') ? 'Advanced reasoning capabilities for complex deep-space trajectory calculations and scientific analysis.' :
                 model.id.includes('70b') ? 'Open-weights neural cluster fine-tuned for unconstrained creative problem solving on the Martian frontier.' :
                 'Specialized vision model for analyzing terrain scans, atmospheric conditions, and habitat integrity.'}
              </p>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <Zap className="w-4 h-4 text-emerald-400" />
                Max RPM: {model.maxRpm}
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <Shield className="w-4 h-4 text-cyan-400" />
                Tier: {model.id.split('-').pop()?.toUpperCase()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
