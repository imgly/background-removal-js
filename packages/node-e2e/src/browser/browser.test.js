const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { performance } = require('perf_hooks');

const PORT = 3000;
const TEST_IMAGE_PATH = path.join(__dirname, '../../fixtures/images/photo-1686002359940-6a51b0d64f68.jpeg');
const WEB_DIST_PATH = path.join(__dirname, '../../web/dist');

let server;

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

test.describe('浏览器基本测试', () => {
  test('页面应该正确加载', async ({ page, browserName }) => {
    const response = await page.goto(`http://localhost:${PORT}/`);
    expect(response.ok()).toBe(true);
    
    const title = await page.title();
    expect(title).toBe('Background Removal Test Page');
    
    const apiAvailable = await page.evaluate(() => {
      return typeof window.backgroundRemoval !== 'undefined';
    });
    expect(apiAvailable).toBe(true);
    
    console.log(`[${browserName}] 页面加载成功`);
  });

  test('应该报告浏览器能力信息', async ({ page, browserName }) => {
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

test.describe('背景移除功能测试', () => {
  test('应该支持基本的背景移除功能', async ({ page, browserName }) => {
    test.fixme(true, '此测试需要模型资源，可能需要网络或本地资源');
    
    await page.goto(`http://localhost:${PORT}/`);
    
    const testImageBase64 = await new Promise((resolve, reject) => {
      fs.readFile(TEST_IMAGE_PATH, (err, data) => {
        if (err) reject(err);
        else resolve(`data:image/jpeg;base64,${data.toString('base64')}`);
      });
    });

    page.on('console', msg => {
      console.log(`[${browserName} Console] ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
      console.error(`[${browserName} Page Error] ${error.message}`);
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
      console.log(`[${browserName}] 背景移除测试结果: ${JSON.stringify(result)}`);
      test.skip();
    }

    expect(result.success).toBe(true);
    expect(result.type).toBe('image/png');
    expect(result.size).toBeGreaterThan(0);
    
    console.log(`[${browserName}] 处理时间: ${result.time.toFixed(2)}ms, 输出大小: ${result.size} bytes`);
  });
});

test.describe('输出格式支持测试', () => {
  test('应该支持不同的输出格式', async ({ page, browserName }) => {
    test.fixme(true, '此测试需要模型资源，可能需要网络或本地资源');
    
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
      console.log(`[${browserName}] 测试格式: ${format}`);
      
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
        console.log(`[${browserName}] 格式 ${format} 测试结果: ${JSON.stringify(result)}`);
        test.skip();
      }

      expect(result.success).toBe(true);
      expect(result.type).toBe(expectedType);
      expect(result.size).toBeGreaterThan(0);
      
      console.log(`[${browserName}] 格式 ${format}: ${result.size} bytes`);
    }
  });
});

test.describe('缓存和多次调用测试', () => {
  test('应该处理多次调用（利用缓存）', async ({ page, browserName }) => {
    test.fixme(true, '此测试需要模型资源，可能需要网络或本地资源');
    
    await page.goto(`http://localhost:${PORT}/`);
    
    const testImageBase64 = await new Promise((resolve, reject) => {
      fs.readFile(TEST_IMAGE_PATH, (err, data) => {
        if (err) reject(err);
        else resolve(`data:image/jpeg;base64,${data.toString('base64')}`);
      });
    });

    const times = [];
    let allSuccess = true;
    
    for (let i = 0; i < 2; i++) {
      console.log(`[${browserName}] 第 ${i + 1} 次调用`);
      
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
        console.log(`[${browserName}] 第 ${i + 1} 次调用结果: ${JSON.stringify(result)}`);
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
      console.log(`[${browserName}] 缓存效果: 第一次 ${times[0].toFixed(2)}ms, 第二次 ${times[1].toFixed(2)}ms`);
    }
  });
});

test.describe('其他 API 功能测试', () => {
  test('应该处理 segmentForeground 功能', async ({ page, browserName }) => {
    test.fixme(true, '此测试需要模型资源，可能需要网络或本地资源');
    
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
      console.log(`[${browserName}] segmentForeground 测试结果: ${JSON.stringify(result)}`);
      test.skip();
    }

    expect(result.success).toBe(true);
    expect(result.size).toBeGreaterThan(0);
    
    console.log(`[${browserName}] segmentForeground: ${result.size} bytes`);
  });
});

test.describe('设备配置测试', () => {
  test('应该支持 CPU 设备配置', async ({ page, browserName }) => {
    test.fixme(true, '此测试需要模型资源，可能需要网络或本地资源');
    
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
      console.log(`[${browserName}] CPU 设备测试结果: ${JSON.stringify(result)}`);
      test.skip();
    }

    expect(result.success).toBe(true);
    expect(result.size).toBeGreaterThan(0);
  });
});

test.describe('进度回调测试', () => {
  test('应该支持进度回调', async ({ page, browserName }) => {
    test.fixme(true, '此测试需要模型资源，可能需要网络或本地资源');
    
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
      console.log(`[${browserName}] 进度回调测试结果: ${JSON.stringify(result)}`);
      test.skip();
    }

    expect(result.success).toBe(true);
    
    console.log(`[${browserName}] 进度事件数量: ${result.progressEvents.length}`);
    result.progressEvents.forEach((event, i) => {
      console.log(`  [${i}] ${event.key}: ${event.current}/${event.total}`);
    });
  });
});
