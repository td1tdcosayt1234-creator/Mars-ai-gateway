// deepVault.js - Tier3 vault status + HSM + Merkle audit (protected by all 3 tiers)
import express from 'express';
import { tier3Vault, getVaultStatus } from '../middleware/tier3DeepVault.js';
import { hsm } from '../utils/hsmSimulator.js';
import { getRoot, getChain, verify } from '../utils/merkleAudit.js';
import { tier2Guard } from '../middleware/tier2Core.js';
import { config } from '../config.js';

const router=express.Router();

// All deep vault routes require Tier1+Tier2+Tier3
router.get('/status', tier3Vault, (req,res)=>{
  res.json({
    tier:3,
    vault: getVaultStatus(),
    hsm: { version: hsm.version, audit: hsm.getAudit().slice(-3) },
    merkle: { root: getRoot(), chain: getChain(3), verify: verify() },
    freshness: '10m window',
  });
});

router.post('/hsm/rotate', tier3Vault, tier2Guard, (req,res)=>{
  // Only explicit admins (ADMIN_SUBJECTS env) can rotate — never any OAuth user
  const sub = req.user?.sub || req.user?.jti;
  if(!sub || !config.adminSubjects.has(sub)) {
    return res.status(403).json({ error:'Tier3: admin only' });
  }
  const v=hsm.rotate();
  res.json({ ok:true, version:v });
});

router.get('/canary/test', tier3Vault, (req,res)=>{
  // Never disclose the actual honey value — only capability
  res.json({ canary: 'enabled', trap: '418 if used' });
});

export default router;
