import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function securityHeadersPlugin(): Plugin {
  return {
    name: 'vite-plugin-security-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        res.setHeader('X-XSS-Protection', '0');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        const csp = [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: https: blob:",
          "connect-src 'self' ws: wss: http://localhost:5000 http://127.0.0.1:5000 https://api.github.com https://generativelanguage.googleapis.com",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
        ].join('; ');
        res.setHeader('Content-Security-Policy', csp);
        next();
      });
    },
  };
}

function aistudioMediaPlugin(): Plugin {
  return {
    name: 'vite-plugin-aistudio-media',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/assets/aistudio/')) {
          const rawPath = req.url.split('?')[0].split('#')[0];
          try {
            const decodedPath = decodeURIComponent(rawPath);
            const relativePath = decodedPath.replace(/^\//, '');
            const aistudioDir = path.resolve(__dirname, 'public', 'assets', 'aistudio');
            const filePath = path.resolve(__dirname, 'public', relativePath);
            const realAistudio = fs.realpathSync(aistudioDir, { encoding: 'utf8' } as any) || aistudioDir;
            if (!filePath.startsWith(aistudioDir + path.sep) || !filePath.startsWith(realAistudio + path.sep)) {
              res.statusCode = 403; res.end('Forbidden'); return;
            }
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              const ext = path.extname(filePath).toLowerCase();
              const mimeMap: Record<string, string> = {
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.pdf': 'application/pdf',
              };
              const mime = mimeMap[ext];
              if (!mime) { res.statusCode = 415; res.end('Unsupported Media Type'); return; }
              res.setHeader('Content-Type', mime);
              res.setHeader('Cache-Control', 'no-cache');
              res.setHeader('X-Content-Type-Options', 'nosniff');
              res.setHeader('X-Frame-Options', 'DENY');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch { res.statusCode = 400; res.end('Bad Request'); return; }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), aistudioMediaPlugin(), securityHeadersPlugin()],
    resolve: { alias: { '@': path.resolve(__dirname, '.') } },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      headers: { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' },
      proxy: {
        '/api': { target: 'http://localhost:5000', changeOrigin: true, secure: false },
      },
    },
    preview: {
      headers: {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      },
    },
    build: { sourcemap: false },
  };
});
