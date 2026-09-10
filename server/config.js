// config.js - Centralized secure config (env validation)
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name, fallback = null) {
  const v = process.env[name] || fallback;
  if (!v && process.env.NODE_ENV === 'production') {
    console.error(`[FATAL] ${name} required in production`);
    process.exit(1);
  }
  return v;
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
  jwtExpires: process.env.JWT_EXPIRES || '30m',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  allowOrigins: [process.env.APP_URL, 'http://localhost:3000', 'http://localhost:5173'].filter(Boolean),
};

if (!process.env.JWT_SECRET) {
  console.warn('[SECURITY] JWT_SECRET ephemeral - set in production');
}
