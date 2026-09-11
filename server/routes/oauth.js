// oauth.js - Google + GitHub OAuth (state PKCE, secure JWT, audit, super security)
// Uses manual fetch, no passport, fewer deps = smaller attack surface
import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const router=express.Router();
const JWT_SECRET = config.jwtSecret;
const APP_URL = config.appUrl;
const GH_ID=process.env.GITHUB_CLIENT_ID || '';
const GH_SECRET=process.env.GITHUB_CLIENT_SECRET || '';
const GO_ID=process.env.GOOGLE_CLIENT_ID || '';
const GO_SECRET=process.env.GOOGLE_CLIENT_SECRET || '';

// State store (PKCE + CSRF) - in prod use Redis
const stateStore=new Map(); // state -> { verifier, ts }

function genState(){
  const state=crypto.randomBytes(32).toString('hex');
  const verifier=crypto.randomBytes(32).toString('base64url');
  stateStore.set(state, { verifier, ts:Date.now() });
  setTimeout(()=> stateStore.delete(state), 10*60*1000);
  return { state, verifier };
}
function makeJWT(user){
  const jti=crypto.randomUUID();
  return jwt.sign({ sub:user.id, email:user.email, provider:user.provider, jti, fp:user.fp }, JWT_SECRET, { expiresIn: '30m' });
}

// Initiate GitHub
router.get('/github', (req,res)=>{
  if(!GH_ID) return res.status(503).json({ error:'GitHub OAuth not configured. Set GITHUB_CLIENT_ID/SECRET in Render env.' });
  const { state } = genState();
  const url=`https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(GH_ID)}&redirect_uri=${encodeURIComponent(APP_URL + '/api/auth/oauth/github/callback')}&scope=user:email&state=${state}`;
  res.redirect(url);
});
router.get('/github/callback', async (req,res)=>{
  const { code, state } = req.query;
  if(!stateStore.has(state)) return res.status(400).send('Invalid state (CSRF)');
  stateStore.delete(state);
  if(!code) return res.status(400).send('Missing code');
  try{
    const tokenRes=await fetch('https://github.com/login/oauth/access_token', {
      method:'POST',
      headers:{ 'Accept':'application/json', 'Content-Type':'application/json' },
      body: JSON.stringify({ client_id: GH_ID, client_secret: GH_SECRET, code, redirect_uri: APP_URL + '/api/auth/oauth/github/callback', state })
    });
    const tok=await tokenRes.json();
    if(tok.error) throw new Error(tok.error_description);
    const userRes=await fetch('https://api.github.com/user', { headers:{ Authorization:`Bearer ${tok.access_token}`, 'User-Agent':'Mars-Gateway' }});
    const user=await userRes.json();
    const emailRes=await fetch('https://api.github.com/user/emails', { headers:{ Authorization:`Bearer ${tok.access_token}`, 'User-Agent':'Mars-Gateway' }});
    const emails=await emailRes.json();
    const primary=Array.isArray(emails)? emails.find(e=>e.primary)?.email : null;
    const profile={ id:`gh_${user.id}`, email: primary||user.email||`${user.login}@github.local`, name: user.name||user.login, provider:'github', avatar:user.avatar_url, fp: req.fp };
    const jwtToken=makeJWT(profile);
    // Set cookies same as login — httpOnly only, never expose JWT in URL/query
    const isProd=config.isProd;
    res.cookie('ares_token', jwtToken, { httpOnly:true, secure:isProd, sameSite:'lax', maxAge:30*60*1000, path:'/' });
    // Redirect without token in URL (prevents log/history/referer leak)
    res.redirect(`${APP_URL}/dashboard?oauth=github`);
  }catch(e){
    console.error('[OAUTH_GH]', config.isProd ? 'oauth failed' : e);
    res.status(500).send('GitHub OAuth failed');
  }
});

// Initiate Google
router.get('/google', (req,res)=>{
  if(!GO_ID) return res.status(503).json({ error:'Google OAuth not configured. Set GOOGLE_CLIENT_ID/SECRET' });
  const { state, verifier } = genState();
  const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
  const url=`https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(GO_ID)}&redirect_uri=${encodeURIComponent(APP_URL + '/api/auth/oauth/google/callback')}&response_type=code&scope=${encodeURIComponent('openid email profile')}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256&access_type=offline&prompt=consent`;
  res.cookie('pkce_verifier', verifier, { httpOnly:true, secure: process.env.NODE_ENV==='production', sameSite:'lax', maxAge:10*60*1000, path:'/' });
  res.redirect(url);
});
router.get('/google/callback', async (req,res)=>{
  const { code, state } = req.query;
  if(!stateStore.has(state)) return res.status(400).send('Invalid state');
  const { verifier } = stateStore.get(state); stateStore.delete(state);
  const cookieVerifier=req.cookies?.pkce_verifier || verifier;
  if(!code) return res.status(400).send('Missing code');
  try{
    const tokenRes=await fetch('https://oauth2.googleapis.com/token', {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: GO_ID, client_secret: GO_SECRET, code, grant_type:'authorization_code', redirect_uri: APP_URL + '/api/auth/oauth/google/callback', code_verifier: cookieVerifier })
    });
    const tok=await tokenRes.json();
    if(tok.error) throw new Error(tok.error_description||tok.error);
    const idRes=await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers:{ Authorization:`Bearer ${tok.access_token}` }});
    const user=await idRes.json();
    const profile={ id:`go_${user.id}`, email:user.email, name:user.name, provider:'google', avatar:user.picture, fp: req.fp };
    const jwtToken=makeJWT(profile);
    const isProd=config.isProd;
    res.clearCookie('pkce_verifier', { path:'/' });
    res.cookie('ares_token', jwtToken, { httpOnly:true, secure:isProd, sameSite:'lax', maxAge:30*60*1000, path:'/' });
    res.redirect(`${APP_URL}/dashboard?oauth=google`);
  }catch(e){
    console.error('[OAUTH_GO]', config.isProd ? 'oauth failed' : e);
    res.status(500).send('Google OAuth failed');
  }
});

// Verify current OAuth user
router.get('/me', (req,res)=>{
  const auth=req.headers.authorization||'';
  const tok=auth.startsWith('Bearer ')? auth.slice(7) : req.cookies?.ares_token;
  if(!tok) return res.status(401).json({ error:'No token' });
  try{
    const p=jwt.verify(tok, JWT_SECRET);
    res.json({ user: p });
  }catch{ res.status(401).json({ error:'Invalid token' }); }
});

export default router;
