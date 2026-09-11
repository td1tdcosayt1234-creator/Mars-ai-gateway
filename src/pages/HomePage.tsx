import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, BrainCircuit, Zap, Eye, Cpu, ArrowRight, KeyRound } from 'lucide-react';
import { playTerminalBlip } from '../utils/sound';
import { motion } from 'motion/react';
import { isSessionValid } from '../utils/security';
import { verifyBackend } from '../utils/api';

export function HomePage({
  setIsTerminalOpen,
}: any) {
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(false);

  // Get API: logged in → /dashboard, else → /login
  const handleGetApi = async () => {
    playTerminalBlip(800);
    if (isSessionValid()) {
      navigate('/dashboard');
      return;
    }
    setCheckingAuth(true);
    try {
      const ok = await verifyBackend().catch(() => false);
      navigate(ok ? '/dashboard' : '/login');
    } catch {
      navigate('/login');
    } finally {
      setCheckingAuth(false);
    }
  };

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

          <motion.h1 variants={itemVariants} className="font-display text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] text-white">
            Deep-Space <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-500 drop-shadow-[0_0_25px_rgba(56,189,248,0.35)]">AI Intelligence.</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-lg lg:text-xl text-slate-400 leading-relaxed max-w-2xl font-sans font-light">
            Access state-of-the-art multimodal reasoning, lightning-fast edge inference, and spatial vision models directly from the Martian gateway. Engineered for zero-latency planetary relay.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={handleGetApi}
              disabled={checkingAuth}
              className="group flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-all shadow-[0_0_30px_rgba(245,158,11,0.35)] disabled:opacity-60 disabled:cursor-wait"
            >
              <KeyRound className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              {checkingAuth ? 'Checking session...' : 'Get API'}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => { playTerminalBlip(600); navigate('/models'); }}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-sm transition-colors"
            >
              View Models
            </button>
          </motion.div>
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

      {/* Right Column: Get API Access */}
      <motion.div variants={itemVariants} className="w-full xl:w-auto flex justify-center xl:justify-end shrink-0 xl:mt-8">
        <div className="relative w-full max-w-md">
          {/* Subtle glow behind the card for visual hierarchy */}
          <div className="absolute -inset-4 bg-amber-500/10 blur-3xl rounded-full pointer-events-none opacity-50"></div>

          <div className="relative p-8 rounded-3xl bg-black/60 border border-amber-500/20 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">Get API Access</h3>
                <p className="text-xs text-slate-400 font-mono">Keys live in your dashboard vault</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Sign in to open your dashboard — manage keys, monitor usage, and test models in the playground.
            </p>
            <button
              onClick={handleGetApi}
              disabled={checkingAuth}
              className="group w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-all shadow-[0_0_25px_rgba(245,158,11,0.3)] disabled:opacity-60 disabled:cursor-wait"
            >
              <KeyRound className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              {checkingAuth ? 'Checking session...' : 'Get API — Open Dashboard'}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => setIsTerminalOpen(true)}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-mono text-xs transition-colors"
            >
              &gt;_ or open Mars Terminal
            </button>
          </div>
        </div>
      </motion.div>

    </motion.div>
  );
}
