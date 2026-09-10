// aiSanitizer.js - Deep sanitization for AI gateway payloads
// Prevents prompt leakage, system override, and output exfiltration

export function sanitizePrompt(prompt, max=4000){
  if(typeof prompt!=='string') return '';
  let s=prompt.trim().slice(0,max);
  s=s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,'');
  // Strip control sequences that try to break JSON
  s=s.replace(/```.*?```/gs,'[code_block_removed]');
  // Remove excessive repeated chars (DoS)
  s=s.replace(/(.)\1{50,}/g,'$1$1$1');
  return s;
}

export function validateAIRequest(body){
  const errors=[];
  if(!body) errors.push('missing body');
  const model=body.model || body.tier;
  const prompt=body.prompt || body.messages?.[0]?.content;
  if(model && !['gemini-2.5-flash','gemini-2.5-pro','ares-neural-70b','deep-space-vision'].includes(model)){
    errors.push('invalid model');
  }
  if(prompt && prompt.length>8000) errors.push('prompt exceeds 8000');
  if(prompt && prompt.length<2) errors.push('prompt too short');
  return errors;
}

export function scrubResponseForPII(text){
  // Reuse PII patterns from firewall
  return text.replace(/[a-zA-Z0-9._%+-]+@[a-z]+\.[a-z]{2,}/g,'[REDACTED_EMAIL]').replace(/\b\d{3}-\d{2}-\d{4}\b/g,'[REDACTED_SSN]');
}
