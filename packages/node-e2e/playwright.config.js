const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './src/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'playwright-results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 60000,
    navigationTimeout: 60000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],
  webServer: {
    command: 'node -e "const http = require(\'http\'); const fs = require(\'fs\'); const path = require(\'path\'); const PORT = 3000; const WEB_DIST_PATH = path.join(__dirname, \'../../web/dist\'); function serveFile(res, filePath) { const ext = path.extname(filePath); const contentTypes = { \'.html\': \'text/html\', \'.js\': \'application/javascript\', \'.mjs\': \'application/javascript\', \'.json\': \'application/json\', \'.png\': \'image/png\', \'.jpg\': \'image/jpeg\', \'.jpeg\': \'image/jpeg\', \'.webp\': \'image/webp\', \'.wasm\': \'application/wasm\', \'.onnx\': \'application/octet-stream\' }; const contentType = contentTypes[ext] || \'application/octet-stream\'; fs.readFile(filePath, (err, data) => { if (err) { res.writeHead(404); res.end(\'Not Found\'); } else { res.writeHead(200, { \'Content-Type\': contentType, \'Cross-Origin-Opener-Policy\': \'same-origin\', \'Cross-Origin-Embedder-Policy\': \'require-corp\' }); res.end(data); } }); } const server = http.createServer((req, res) => { let filePath = req.url; if (filePath === \'/\') { filePath = \'/test-page.html\'; } if (filePath.startsWith(\'/dist/\')) { filePath = filePath.replace(\'/dist/\', \'\'); const fullPath = path.join(WEB_DIST_PATH, filePath); serveFile(res, fullPath); } else if (filePath === \'/test-page.html\') { const fullPath = path.join(__dirname, \'src/browser/test-page.html\'); serveFile(res, fullPath); } else if (filePath.startsWith(\'/fixtures/\')) { filePath = filePath.replace(\'/fixtures/\', \'fixtures/\'); const fullPath = path.join(__dirname, filePath); serveFile(res, fullPath); } else { res.writeHead(404); res.end(\'Not Found\'); } }); server.listen(PORT, () => { console.log(`Test server running on http://localhost:${PORT}`); });"',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
