import React from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyGeneratorCard } from '../components/KeyGeneratorCard';
import { Sparkles, BrainCircuit, Zap, Eye, Cpu, ArrowRight } from 'lucide-react';
import { playTerminalBlip } from '../utils/sound';
import { motion } from 'motion/react';

export function HomePage({
  setIsTerminalOpen,
  handleGenerateKey,
  handleOpenPlayground,
}: any) {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, filter: 'blur(10px)' },
    show: { 
      opacity: 1, 
      y: 0, 
      filter: 'blur(0px)',
      transition: { 
        duration: 0.8, 
        ease: [0.16, 1, 0.3, 1] 
      } 
    },
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="relative z-20 flex-1 w-full max-w-[1400px] mx-auto flex flex-col xl:flex-row items-center xl:items-start justify-center xl:justify-between px-6 sm:px-10 lg:px-16 py-12 lg:py-20 gap-12 xl:gap-20"
    >
      
      {/* Left Column: AI Details & Models */}
      <div className="flex-1 flex flex-col items-start text-left space-y-10 max-w-3xl pt-4">
        
        {/* Core AI Detail Hero */}
        <div className="space-y-6">
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-semibold uppercase tracking-widest backdrop-blur-md shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Ares Neural Core v2.4</span>
          </motion.div>

          <motion.h1 variants={itemVariants} className="font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/40 tracking-tight leading-[1.05]">
            Deep-Space <br />
            <span className="text-amber-500 text-glow-amber drop-shadow-xl">AI Intelligence.</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-lg lg:text-xl text-slate-400 leading-relaxed max-w-2xl font-sans font-light">
            Access state-of-the-art multimodal reasoning, lightning-fast edge inference, and spatial vision models directly from the Martian gateway. Engineered for zero-latency planetary relay.
          </motion.p>
        </div>

        {/* Model Options Showcase */}
        <motion.div variants={itemVariants} className="w-full pt-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-emerald-400" /> Available Neural Models
            </h3>
            <button 
              onClick={() => { playTerminalBlip(600); navigate('/models'); }}
              className="text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors group"
            >
              View Full Specs <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Model 1 */}
            <div 
              onClick={() => { playTerminalBlip(600); navigate('/models'); }}
              className="group p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/[0.02] transition-all cursor-pointer shadow-lg shadow-black/20"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                  <Zap className="w-4 h-4" />
                </div>
                <h4 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">Gemini 2.5 Flash</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">High-speed, low-latency inference optimized for rapid iterative tasks and telemetry.</p>
            </div>

            {/* Model 2 */}
            <div 
              onClick={() => { playTerminalBlip(600); navigate('/models'); }}
              className="group p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/[0.02] transition-all cursor-pointer shadow-lg shadow-black/20"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:bg-cyan-500/20 transition-colors">
                  <Cpu className="w-4 h-4" />
                </div>
                <h4 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">Gemini 2.5 Pro</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">Advanced reasoning capabilities for complex deep-space calculations and math.</p>
            </div>

            {/* Model 3 */}
            <div 
              onClick={() => { playTerminalBlip(600); navigate('/models'); }}
              className="group p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/[0.02] transition-all cursor-pointer shadow-lg shadow-black/20"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:bg-purple-500/20 transition-colors">
                  <BrainCircuit className="w-4 h-4" />
                </div>
                <h4 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">Ares-Neural 70B</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">Open-weights cluster fine-tuned for unconstrained frontier problem solving.</p>
            </div>

            {/* Model 4 */}
            <div 
              onClick={() => { playTerminalBlip(600); navigate('/models'); }}
              className="group p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/[0.02] transition-all cursor-pointer shadow-lg shadow-black/20"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
                  <Eye className="w-4 h-4" />
                </div>
                <h4 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">DeepSpace Vision</h4>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">Specialized spatial vision model for analyzing terrain and atmospheric scans.</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Column: Key Generator (Get API) */}
      <motion.div variants={itemVariants} className="w-full xl:w-auto flex justify-center xl:justify-end shrink-0 xl:mt-8">
        <div className="relative">
          {/* Subtle glow behind the card for visual hierarchy */}
          <div className="absolute -inset-4 bg-amber-500/10 blur-3xl rounded-full pointer-events-none opacity-50"></div>
          
          <KeyGeneratorCard
            onGenerateKey={handleGenerateKey}
            onOpenTerminal={() => setIsTerminalOpen(true)}
            onOpenPlayground={handleOpenPlayground}
          />
        </div>
      </motion.div>

    </motion.div>
  );
}
