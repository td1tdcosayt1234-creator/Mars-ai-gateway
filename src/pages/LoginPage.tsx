import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Orbit, Fingerprint, Lock, ArrowRight } from 'lucide-react';
import { playTerminalBlip } from '../utils/sound';
import { motion } from 'motion/react';

export function LoginPage() {
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    playTerminalBlip(800);
    setIsLoading(true);
    
    // Simulate auth delay
    setTimeout(() => {
      setIsLoading(false);
      navigate('/dashboard');
    }, 1500);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 w-full flex items-center justify-center p-6"
    >
      <div className="w-full max-w-md p-8 rounded-3xl bg-black/60 border border-white/10 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(255,255,255,0.05)] relative overflow-hidden">
        {/* Decorative corner accents */}
        <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-amber-500/20 rounded-tl-3xl" />
        <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-cyan-500/20 rounded-br-3xl" />

        <div className="flex flex-col items-center mb-8">
          <div className="relative flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-red-600/30 border border-amber-500/30 backdrop-blur-md shadow-[0_0_25px_rgba(245,158,11,0.25)]">
            <Orbit className="w-8 h-8 text-amber-400 animate-[spin_12s_linear_infinite]" />
            <div className="absolute w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_8px_#fbbf24]" />
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight font-display drop-shadow-md">Gateway Access</h2>
          <p className="text-slate-400 text-sm mt-1 font-mono">Olympus Mons Command Hub</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5 relative z-10">
          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" /> Security Code
            </label>
            <input
              type="password"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Enter authorization cipher"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono text-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full group relative flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-white text-black font-bold text-sm hover:bg-slate-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-amber-600" />
                Initialize Uplink
                <ArrowRight className="w-4 h-4 text-amber-600 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500 font-mono">
            Unregistered connection attempts will be logged and traced to origin.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
