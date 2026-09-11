// aiSanitizer.js - Deep sanitization for AI gateway payloads (OWASP LLM Top-10)
// Prevents prompt leakage, system override, excessive agency, and output exfiltration.
// Default-deny: no system role, no tools/functions, strict numeric bounds.
const MODELS = new Set(['gemini-2.5-flash','gemini-2.5-pro','ares-neural-70b','deep-space-vision']);
const ZONES = new Set(['olympus-primary','chryse-ground','phobos-orbital','valles-marineris']);
const ROLES = new Set(['user','assistant']);

export function sanitizePrompt(prompt, max=4000){
  if(typeof prompt!=='string') return '';
  let s=prompt.normalize('NFKC').trim().slice(0,max);
  // Strip invisible / bidi / zero-width (smuggling) + control (keep \n\t)
  s=s.replace(/[\u200B-\u200D\uFEFF\u2060-\u2064\u202A-\u202E\u00AD]/g,'');
  s=s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,'');
  // Truncate (don't drop) fenced code to bound cost, keep functionality
  s=s.replace(/```[\s\S]{0,20000}```/g, (m)=> m.length > 2000 ? m.slice(0,2000) + '\n[code_truncated]' : m);
  // Remove excessive repeated chars (DoS / token-burn)
  s=s.replace(/(.)\1{50,}/g,'$1$1$1');
  // Cap lines to bound cost
  const lines=s.split('\n');
  if(lines.length > 200) s=lines.slice(0,200).join('\n') + '\n[lines_truncated]';
  return s;
}

export function extractAllUserText(body){
  const out=[];
  if(typeof body?.prompt === 'string') out.push(body.prompt);
  if(typeof body?.content === 'string') out.push(body.content);
  if(Array.isArray(body?.messages)){
    for(const m of body.messages){
      if(m && typeof m.content === 'string') out.push(m.content);
      // multimodal parts: [{type:'text',text:'...'}]
      if(Array.isArray(m?.content)){
        for(const p of m.content){
          if(p && typeof p.text === 'string') out.push(p.text);
        }
      }
    }
  }
  // RAG / tool context that becomes indirect injection surface
  if(typeof body?.context === 'string') out.push(body.context);
  if(Array.isArray(body?.documents)){
    for(const d of body.documents){
      if(typeof d === 'string') out.push(d);
      else if(d && typeof d.text === 'string') out.push(d.text);
    }
  }
  return out.join('\n---\n').slice(0, 16000);
}

export function validateAIRequest(body){
  const errors=[];
  if(!body || typeof body !== 'object' || Array.isArray(body)) { errors.push('missing body'); return errors; }
  const model=body.model || body.tier;
  const prompt=body.prompt ?? body.messages?.[0]?.content ?? body.content;
  if(model && !MODELS.has(model)) errors.push('invalid model');
  if(body.relayZone && !ZONES.has(body.relayZone)) errors.push('invalid relayZone');

  // Excessive agency (LLM06): default-deny tool/function calling unless key explicitly allows.
  // Gateway currently issues chat-only keys, so any tool use is rejected here.
  for(const k of ['tools','functions','tool_choice','function_call','parallel_tool_calls']) {
    if(body[k] !== undefined) errors.push(`forbidden field: ${k} (tool use disabled)`);
  }
  // System role from client = system-prompt override (LLM07). Always reject.
  if(Array.isArray(body.messages)){
    if(body.messages.length > 20) errors.push('too many messages (max 20)');
    for(let i=0;i<body.messages.length;i++){
      const m=body.messages[i];
      if(!m || typeof m !== 'object') { errors.push(`messages[${i}] invalid`); break; }
      if(!ROLES.has(m.role)) errors.push(`messages[${i}].role forbidden (system/developer/tool blocked)`);
      const c = typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? 'multimodal' : '';
      if(typeof c === 'string' && c.length > 8000) errors.push(`messages[${i}] exceeds 8000`);
    }
  }
  // Numeric bounds (prevent cost/quality manipulation)
  for(const [k,min,max] of [['max_tokens',1,4096],['maxTokens',1,4096],['temperature',0,1],['top_p',0,1],['topP',0,1]]) {
    if(body[k] !== undefined && (typeof body[k] !== 'number' || !Number.isFinite(body[k]) || body[k] < min || body[k] > max)) {
      errors.push(`invalid ${k} (must be ${min}-${max})`);
    }
  }
  if(prompt !== undefined && prompt !== null) {
    const t = typeof prompt === 'string' ? prompt : '';
    if(t && t.length>8000) errors.push('prompt exceeds 8000');
    if(t && t.length<2) errors.push('prompt too short');
  }
  // Unknown top-level fields = fail-closed (catches prompt-smuggling via new params)
  const known = new Set(['model','tier','prompt','messages','content','context','documents','relayZone','max_tokens','maxTokens','temperature','top_p','topP','stream','keyId']);
  for(const k of Object.keys(body)){
    if(!known.has(k) && !k.startsWith('_')) errors.push(`unknown field: ${k}`);
  }
  if(body.stream !== undefined && body.stream !== false) errors.push('streaming disabled (unbounded consumption)');
  return errors;
}

export function scrubResponseForPII(text){
  // Reuse PII patterns from firewall
  return text.replace(/[a-zA-Z0-9._%+-]+@[a-z]+\.[a-z]{2,}/g,'[REDACTED_EMAIL]').replace(/\b\d{3}-\d{2}-\d{4}\b/g,'[REDACTED_SSN]');
}
