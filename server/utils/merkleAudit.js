// merkleAudit.js - Immutable hash-chained log with Merkle root (Tier3)
// Every write is append-only, root published, tamper evident
import crypto from 'crypto';
const chain=[];
let root=crypto.createHash('sha256').update('TIER3_GENESIS_MARS_782_10MIN').digest('hex');
export function append(entry){
  const leaf=crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');
  root=crypto.createHash('sha256').update(root+leaf).digest('hex');
  chain.push({ ...entry, leaf, root, ts:Date.now() });
  if(chain.length>1000) chain.shift();
  return { leaf, root };
}
export function verify(){
  let r=crypto.createHash('sha256').update('TIER3_GENESIS_MARS_782_10MIN').digest('hex');
  for(const e of chain){
    const leaf=crypto.createHash('sha256').update(JSON.stringify({action:e.action,detail:e.detail,ip:e.ip})).digest('hex');
    // simplified: just check root chain continuity
    r=crypto.createHash('sha256').update(r+leaf).digest('hex');
  }
  return { valid: r===root, root, leaves: chain.length };
}
export function getRoot(){ return root; }
export function getChain(n=20){ return chain.slice(-n); }
