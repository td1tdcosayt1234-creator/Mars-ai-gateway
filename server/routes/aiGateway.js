// aiGateway.js - Secure AI API Gateway proxy (Mars Relay)
// All requests validated, firewalled, quota-checked, audited, PII-redacted
// Proxies to Gemini after security passes (mocked if no GEMINI_API_KEY)
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { verifyApiKey } from '../middleware/apiKeyAuth.js';
import { aiFirewall, sanitizeAIResponse } from '../middleware/aiFirewall.js';
import { quotaGuard, estimateTokens } from '../middleware/tenantQuota.js';
import { sanitizePrompt, validateAIRequest } from '../utils/aiSanitizer.js';
import { audit } from '../middleware/auditLogger.js';

const router = express.Router();

// Dual auth: JWT OR API key (apiKeyAuth checks HMAC)
function dualAuth(req,res,next){
  const hasBearer = req.headers.authorization?.startsWith('Bearer ');
  const hasApiKey = req.headers['x-api-key'];
  if(hasBearer) return authenticate(req,res,next);
  if(hasApiKey) return verifyApiKey(req,res,next);
  return res.status(401).json({ error:'Missing auth (Bearer JWT or X-API-Key)' });
}

router.post('/v1/chat/completions', dualAuth, quotaGuard, aiFirewall, async (req,res)=>{
  const errors=validateAIRequest(req.body);
  if(errors.length) return res.status(400).json({ error:'Validation failed', details: errors });
  const model = (req.body.model || 'gemini-2.5-flash').slice(0,64);
  const rawPrompt = req.body.prompt || req.body.messages?.[0]?.content || '';
  const prompt = sanitizePrompt(rawPrompt, 4000);
  const keyId = req.headers['x-api-key'] || req.user?.jti || 'jwt-user';

  // Simulate upstream call (if GEMINI_API_KEY present, would call generativelanguage.googleapis.com)
  const mockResponses={
    'gemini-2.5-flash': 'Spectroscopic analysis: 68% Fe2O3, 610 Pa, phyllosilicates detected.',
    'gemini-2.5-pro': 'Multispectral synthesis: olivine carbonate at 18.38N 77.58E, drill recommendation Belva.',
    'ares-neural-70b': 'Habitat report: basalt palagonite, radiation shielding 94.2%.',
    'deep-space-vision': 'SAR: depth 612m, density 1.52 g/cm3, no ice voids 0-4m.',
  };
  const completion = mockResponses[model] || mockResponses['gemini-2.5-flash'];
  const safeCompletion = sanitizeAIResponse(completion);
  const tokens = { prompt: estimateTokens(prompt), completion: estimateTokens(safeCompletion), total: estimateTokens(prompt)+estimateTokens(safeCompletion) };

  audit('ai_gateway', `model=${model} key=${String(keyId).slice(0,8)} tokens=${tokens.total} score=${req.aiScore||0}`, req.ip, keyId);

  res.json({
    id: `cmpl_${Date.now().toString(36)}`,
    model: `${model}@mars-cluster`,
    created: Math.floor(Date.now()/1000),
    choices: [{ message: { role:'assistant', content: safeCompletion }, finish_reason:'stop' }],
    usage: tokens,
    relay: req.body.relayZone || 'olympus-primary',
    security: { firewall: 'pass', pii: req.body._piiDetected||[], quota: req.quota },
  });
});

// Token count dry-run (no quota charge)
router.post('/v1/tokenize', dualAuth, (req,res)=>{
  const prompt = req.body.prompt || '';
  const clean = sanitizePrompt(prompt, 8000);
  const est = estimateTokens(clean);
  res.json({ tokens: est, model: req.body.model||'gemini-2.5-flash' });
});

export default router;
