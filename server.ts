import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy endpoint for CEIR APIs
  app.all('/api/ceir/*', async (req, res) => {
    try {
      const targetUrl = 'https://ceir.gov.mm/openapi/API' + req.originalUrl.replace('/api/ceir', '');
      
      const headers = new Headers();
      headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      headers.set('Accept', 'application/json, text/plain, */*');
      
      // Try to spoof Myanmar IP (Yatanarpon Teleport IP) to bypass geo-blocking
      const mmIp = '203.81.64.10';
      headers.set('X-Forwarded-For', mmIp);
      headers.set('CF-Connecting-IP', mmIp);
      headers.set('True-Client-IP', mmIp);
      headers.set('X-Real-IP', mmIp);
      
      if (req.headers['content-type']) {
         headers.set('Content-Type', req.headers['content-type'] as string);
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };

      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const response = await fetch(targetUrl, fetchOptions);
      const data = await response.text();
      
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        res.setHeader('Set-Cookie', setCookie);
      }

      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      
      if (!response.ok) {
         console.error(`Proxy Error for ${targetUrl}: ${response.status} ${response.statusText}`);
      }
      
      res.status(response.status).send(data);
    } catch (error) {
      console.error('Proxy Exception:', error);
      res.status(500).json({ error: 'Proxy request failed' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
