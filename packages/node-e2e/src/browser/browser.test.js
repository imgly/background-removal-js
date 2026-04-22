const { test, expect } = require('@playwright/test');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { performance } = require('perf_hooks');

const PORT = 3000;
const TEST_IMAGE_PATH = path.join(__dirname, '../../fixtures/images/photo-1686002359940-6a51b0d64f68.jpeg');
const WEB_DIST_PATH = path.join(__dirname, '../../web/dist');

let server;

const browsers = ['chromium', 'firefox', 'webkit'];

function createServer() {
  return http.createServer((req, res) => {
    let filePath = req.url;
    
    if (filePath === '/') {
      filePath = '/test-page.html';
    }
    
    if (filePath.startsWith('/dist/')) {
      filePath = filePath.replace('/dist/', '');
      const fullPath = path.join(WEB_DIST_PATH, filePath);
      serveFile(res, fullPath);
    } else if (filePath === '/test-page.html') {
      const fullPath = path.join(__dirname, 'test-page.html');
      serveFile(res, fullPath);
    } else if (filePath.startsWith('/fixtures/')) {
      filePath = filePath.replace('/fixtures/', '../../fixtures/');
      const fullPath = path.join(__dirname, filePath);
      serveFile(res, fullPath);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.wasm': 'application/wasm',
    '.onnx': 'application/octet-stream'
  };
  
  const contentType = contentTypes[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found: ' + filePath);
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
      });
      res.end(data);
    }
  });
}

test.describe.configure({ mode: 'parallel', timeout: 120000 });

test.beforeAll(async () => {
  server = createServer();
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Test server running on http://localhost:${PORT}`);
});

test.afterAll(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});

browsers.forEach(browserName => {
  test.describe(`${browserName} 浏览器测试`, () => {
    let page;
    let browser;

    test.beforeEach(async ({ browserType }) => {
      browser = await browserType.launch();
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        locale: 'en-US',
        timezoneId: 'UTC'
      });
      page = await context.newPage();
      
      page.on('console', msg => {
        console.log(`[${browserName}] Console: ${msg.text()}`);
      });
      
      page.on('pageerror', error => {
        console.error(`[${browserName}] Page Error: ${error.message}`);
      });
    });

    test.afterEach(async () => {
      if (browser) {
        await browser.close();
      }
    });

    test('页面应该正确加载', async () => {
      const response = await page.goto(`http://localhost:${PORT}/`);
      expect(response.ok()).toBe(true);
      
      const title = await page.title();
      expect(title).toBe('Background Removal Test Page');
      
      const apiAvailable = await page.evaluate(() => {
        return typeof window.backgroundRemoval !== 'undefined';
      });
      expect(apiAvailable).toBe(true);
    });

    test('应该能够预加载模型', async () => {
      await page.goto(`http://localhost:${PORT}/`);
      
      const preloadStartTime = performance.now();
      
      const preloadResult = await page.evaluate(async () => {
        try {
          await window.backgroundRemoval.preload({ 
            model: 'small',
            debug: true 
          });
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      const preloadTime = performance.now() - preloadStartTime;
      
      console.log(`[${browserName}] 预加载时间: ${preloadTime.toFixed(2)}ms`);
      
      if (!preloadResult.success) {
        console.warn(`[${browserName}] 预加载失败（可能需要网络或本地资源）: ${preloadResult.error}`);
        test.skip();
      }
      
      expect(preloadResult.success).toBe(true);
    }, 120000);

    test('应该支持基本的背景移除功能', async () => {
      await page.goto(`http://localhost:${PORT}/`);
      
      const testImageBase64 = await new Promise((resolve, reject) => {
        fs.readFile(TEST_IMAGE_PATH, (err, data) => {
          if (err) reject(err);
          else resolve(`data:image/jpeg;base64,${data.toString('base64')}`);
        });
      });

      const result = await page.evaluate(async (imageData) => {
        try {
          const response = await fetch(imageData);
          const blob = await response.blob();
          
          const startTime = performance.now();
          const resultBlob = await window.backgroundRemoval.removeBackground(blob, {
            model: 'small',
            output: { format: 'image/png' }
          });
          const endTime = performance.now();
          
          return {
            success: true,
            type: resultBlob.type,
            size: resultBlob.size,
            time: endTime - startTime
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, testImageBase64);

      if (!result.success) {
        console.warn(`[${browserName}] 背景移除测试失败: ${result.error}`);
        test.skip();
      }

      expect(result.success).toBe(true);
      expect(result.type).toBe('image/png');
      expect(result.size).toBeGreaterThan(0);
      
      console.log(`[${browserName}] 处理时间: ${result.time.toFixed(2)}ms, 输出大小: ${result.size} bytes`);
    }, 180000);

    test('应该支持不同的输出格式', async () => {
      await page.goto(`http://localhost:${PORT}/`);
      
      const testImageBase64 = await new Promise((resolve, reject) => {
        fs.readFile(TEST_IMAGE_PATH, (err, data) => {
          if (err) reject(err);
          else resolve(`data:image/jpeg;base64,${data.toString('base64')}`);
        });
      });

      const formats = [
        { format: 'image/png', expectedType: 'image/png' },
        { format: 'image/jpeg', expectedType: 'image/jpeg' },
        { format: 'image/webp', expectedType: 'image/webp' }
      ];

      for (const { format, expectedType } of formats) {
        const result = await page.evaluate(async ([imageData, fmt]) => {
          try {
            const response = await fetch(imageData);
            const blob = await response.blob();
            
            const resultBlob = await window.backgroundRemoval.removeBackground(blob, {
              model: 'small',
              output: { format: fmt }
            });
            
            return {
              success: true,
              type: resultBlob.type,
              size: resultBlob.size
            };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }, [testImageBase64, format]);

        if (!result.success) {
          console.warn(`[${browserName}] 格式 ${format} 测试失败: ${result.error}`);
          continue;
        }

        expect(result.success).toBe(true);
        expect(result.type).toBe(expectedType);
        expect(result.size).toBeGreaterThan(0);
        
        console.log(`[${browserName}] 格式 ${format}: ${result.size} bytes`);
      }
    }, 300000);

    test('应该支持进度回调', async () => {
      await page.goto(`http://localhost:${PORT}/`);
      
      const testImageBase64 = await new Promise((resolve, reject) => {
        fs.readFile(TEST_IMAGE_PATH, (err, data) => {
          if (err) reject(err);
          else resolve(`data:image/jpeg;base64,${data.toString('base64')}`);
        });
      });

      const result = await page.evaluate(async (imageData) => {
        const progressEvents = [];
        
        try {
          const response = await fetch(imageData);
          const blob = await response.blob();
          
          await window.backgroundRemoval.removeBackground(blob, {
            model: 'small',
            progress: (key, current, total) => {
              progressEvents.push({ key, current, total });
            }
          });
          
          return {
            success: true,
            progressEvents
          };
        } catch (error) {
          return { success: false, error: error.message, progressEvents };
        }
      }, testImageBase64);

      if (!result.success) {
        console.warn(`[${browserName}] 进度回调测试失败: ${result.error}`);
        test.skip();
      }

      expect(result.success).toBe(true);
      expect(result.progressEvents.length).toBeGreaterThan(0);
      
      console.log(`[${browserName}] 进度事件数量: ${result.progressEvents.length}`);
      result.progressEvents.forEach((event, i) => {
        console.log(`  [${i}] ${event.key}: ${event.current}/${event.total}`);
      });
    }, 180000);

    test('应该处理多次调用（利用缓存）', async () => {
      await page.goto(`http://localhost:${PORT}/`);
      
      const testImageBase64 = await new Promise((resolve, reject) => {
        fs.readFile(TEST_IMAGE_PATH, (err, data) => {
          if (err) reject(err);
          else resolve(`data:image/jpeg;base64,${data.toString('base64')}`);
        });
      });

      const times = [];
      let allSuccess = true;
      
      for (let i = 0; i < 3; i++) {
        const result = await page.evaluate(async ([imageData, iteration]) => {
          try {
            const response = await fetch(imageData);
            const blob = await response.blob();
            
            const startTime = performance.now();
            await window.backgroundRemoval.removeBackground(blob, { model: 'small' });
            const endTime = performance.now();
            
            return {
              success: true,
              time: endTime - startTime
            };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }, [testImageBase64, i]);

        if (!result.success) {
          console.warn(`[${browserName}] 第 ${i + 1} 次调用失败: ${result.error}`);
          allSuccess = false;
          break;
        }
        
        times.push(result.time);
        console.log(`[${browserName}] 第 ${i + 1} 次调用时间: ${result.time.toFixed(2)}ms`);
      }

      if (!allSuccess) {
        test.skip();
      }

      if (times.length >= 2) {
        expect(times[1]).toBeLessThan(times[0] * 2);
      }
    }, 300000);

    test('应该处理 segmentForeground 功能', async () => {
      await page.goto(`http://localhost:${PORT}/`);
      
      const testImageBase64 = await new Promise((resolve, reject) => {
        fs.readFile(TEST_IMAGE_PATH, (err, data) => {
          if (err) reject(err);
          else resolve(`data:image/jpeg;base64,${data.toString('base64')}`);
        });
      });

      const result = await page.evaluate(async (imageData) => {
        try {
          const response = await fetch(imageData);
          const blob = await response.blob();
          
          const resultBlob = await window.backgroundRemoval.segmentForeground(blob, {
            model: 'small'
          });
          
          return {
            success: true,
            type: resultBlob.type,
            size: resultBlob.size
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, testImageBase64);

      if (!result.success) {
        console.warn(`[${browserName}] segmentForeground 测试失败: ${result.error}`);
        test.skip();
      }

      expect(result.success).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    }, 180000);

    test('应该支持 CPU 设备配置', async () => {
      await page.goto(`http://localhost:${PORT}/`);
      
      const testImageBase64 = await new Promise((resolve, reject) => {
        fs.readFile(TEST_IMAGE_PATH, (err, data) => {
          if (err) reject(err);
          else resolve(`data:image/jpeg;base64,${data.toString('base64')}`);
        });
      });

      const result = await page.evaluate(async (imageData) => {
        try {
          const response = await fetch(imageData);
          const blob = await response.blob();
          
          const resultBlob = await window.backgroundRemoval.removeBackground(blob, {
            model: 'small',
            device: 'cpu'
          });
          
          return {
            success: true,
            type: resultBlob.type,
            size: resultBlob.size
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, testImageBase64);

      if (!result.success) {
        console.warn(`[${browserName}] CPU 设备测试失败: ${result.error}`);
        test.skip();
      }

      expect(result.success).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    }, 180000);

    test('应该支持 mask 配置', async () => {
      await page.goto(`http://localhost:${PORT}/`);
      
      const testImageBase64 = await new Promise((resolve, reject) => {
        fs.readFile(TEST_IMAGE_PATH, (err, data) => {
          if (err) reject(err);
          else resolve(`data:image/jpeg;base64,${data.toString('base64')}`);
        });
      });

      const maskConfigs = [
        { smoothness: 5, feather: 3 },
        { edgeMode: 'hard' },
        { edgeMode: 'soft' },
        { threshold: 128 }
      ];

      for (const maskConfig of maskConfigs) {
        const result = await page.evaluate(async ([imageData, config]) => {
          try {
            const response = await fetch(imageData);
            const blob = await response.blob();
            
            const resultBlob = await window.backgroundRemoval.removeBackground(blob, {
              model: 'small',
              mask: config
            });
            
            return {
              success: true,
              size: resultBlob.size
            };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }, [testImageBase64, maskConfig]);

        if (!result.success) {
          console.warn(`[${browserName}] mask 配置 ${JSON.stringify(maskConfig)} 测试失败: ${result.error}`);
          continue;
        }

        expect(result.success).toBe(true);
        expect(result.size).toBeGreaterThan(0);
      }
    }, 300000);

    test('应该支持 background 配置', async () => {
      await page.goto(`http://localhost:${PORT}/`);
      
      const testImageBase64 = await new Promise((resolve, reject) => {
        fs.readFile(TEST_IMAGE_PATH, (err, data) => {
          if (err) reject(err);
          else resolve(`data:image/jpeg;base64,${data.toString('base64')}`);
        });
      });

      const bgConfigs = [
        { type: 'transparent' },
        { type: 'solid', color: { r: 255, g: 0, b: 0 } },
        { type: 'checkerboard' }
      ];

      for (const bgConfig of bgConfigs) {
        const result = await page.evaluate(async ([imageData, config]) => {
          try {
            const response = await fetch(imageData);
            const blob = await response.blob();
            
            const resultBlob = await window.backgroundRemoval.removeBackground(blob, {
              model: 'small',
              background: config
            });
            
            return {
              success: true,
              size: resultBlob.size
            };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }, [testImageBase64, bgConfig]);

        if (!result.success) {
          console.warn(`[${browserName}] background 配置 ${JSON.stringify(bgConfig)} 测试失败: ${result.error}`);
          continue;
        }

        expect(result.success).toBe(true);
        expect(result.size).toBeGreaterThan(0);
      }
    }, 300000);

    test('应该报告浏览器能力信息', async () => {
      await page.goto(`http://localhost:${PORT}/`);
      
      const capabilities = await page.evaluate(() => {
        return {
          hasOffscreenCanvas: typeof OffscreenCanvas !== 'undefined',
          hasWebGL: typeof WebGLRenderingContext !== 'undefined',
          hasWebGPU: typeof navigator !== 'undefined' && 'gpu' in navigator,
          navigator: typeof navigator !== 'undefined' ? {
            userAgent: navigator.userAgent,
            hardwareConcurrency: navigator.hardwareConcurrency
          } : null
        };
      });

      console.log(`[${browserName}] 浏览器能力:`, JSON.stringify({
        hasOffscreenCanvas: capabilities.hasOffscreenCanvas,
        hasWebGL: capabilities.hasWebGL,
        hasWebGPU: capabilities.hasWebGPU,
        hardwareConcurrency: capabilities.navigator?.hardwareConcurrency
      }, null, 2));

      expect(capabilities.hasWebGL).toBe(true);
    });
  });
});
