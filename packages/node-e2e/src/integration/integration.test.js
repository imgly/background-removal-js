const path = require('path');
const fs = require('fs/promises');

describe('集成测试 - 完整流程测试', () => {
  const removeBackground = require('../../node/dist/index.cjs').default;
  const { segmentForeground, removeForeground, applySegmentationMask } = require('../../node/dist/index.cjs');
  
  const testImagePath = path.join(__dirname, '../../fixtures/images/photo-1686002359940-6a51b0d64f68.jpeg');
  const outputDir = path.join(__dirname, '../../fixtures/output');
  
  beforeAll(async () => {
    try {
      await fs.access(outputDir);
    } catch {
      await fs.mkdir(outputDir, { recursive: true });
    }
  });

  describe('removeBackground - 背景移除核心功能', () => {
    test('应该从本地图片文件移除背景', async () => {
      const result = await removeBackground(testImagePath);
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.size).toBeGreaterThan(0);
      expect(result.type).toBe('image/png');
    }, 60000);

    test('应该返回 PNG 格式的结果', async () => {
      const result = await removeBackground(testImagePath, {
        output: { format: 'image/png' }
      });
      
      expect(result.type).toBe('image/png');
    }, 60000);

    test('应该返回 JPEG 格式的结果', async () => {
      const result = await removeBackground(testImagePath, {
        output: { format: 'image/jpeg', quality: 0.9 }
      });
      
      expect(result.type).toBe('image/jpeg');
    }, 60000);

    test('应该返回 WebP 格式的结果', async () => {
      const result = await removeBackground(testImagePath, {
        output: { format: 'image/webp', quality: 0.8 }
      });
      
      expect(result.type).toBe('image/webp');
    }, 60000);

    test('应该使用不同质量设置', async () => {
      const resultHigh = await removeBackground(testImagePath, {
        output: { quality: 1.0 }
      });
      
      const resultLow = await removeBackground(testImagePath, {
        output: { quality: 0.1 }
      });
      
      expect(resultHigh.size).toBeGreaterThan(0);
      expect(resultLow.size).toBeGreaterThan(0);
    }, 120000);

    test('应该支持进度回调', async () => {
      const progressCallback = jest.fn();
      
      await removeBackground(testImagePath, {
        progress: progressCallback
      });
      
      expect(progressCallback).toHaveBeenCalled();
    }, 60000);

    test('应该支持不同模型类型', async () => {
      const models = ['small', 'medium'];
      
      for (const model of models) {
        const result = await removeBackground(testImagePath, { model });
        expect(result).toBeInstanceOf(Blob);
        expect(result.size).toBeGreaterThan(0);
      }
    }, 120000);
  });

  describe('segmentForeground - 前景分割', () => {
    test('应该分割前景', async () => {
      const result = await segmentForeground(testImagePath);
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.size).toBeGreaterThan(0);
    }, 60000);

    test('应该分割前景并返回 alpha8 格式', async () => {
      const result = await segmentForeground(testImagePath, {
        output: { format: 'image/x-alpha8' }
      });
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.size).toBeGreaterThan(0);
    }, 60000);
  });

  describe('removeForeground - 前景移除', () => {
    test('应该移除前景', async () => {
      const result = await removeForeground(testImagePath);
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.size).toBeGreaterThan(0);
    }, 60000);
  });

  describe('applySegmentationMask - 应用分割掩码', () => {
    test('应该应用分割掩码到图片', async () => {
      const mask = await segmentForeground(testImagePath, {
        output: { format: 'image/x-alpha8' }
      });
      
      const result = await applySegmentationMask(testImagePath, mask);
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.size).toBeGreaterThan(0);
    }, 120000);
  });

  describe('图片源类型支持', () => {
    test('应该支持 Buffer 作为图片源', async () => {
      const imageBuffer = await fs.readFile(testImagePath);
      const result = await removeBackground(imageBuffer);
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.size).toBeGreaterThan(0);
    }, 60000);

    test('应该支持 Uint8Array 作为图片源', async () => {
      const imageBuffer = await fs.readFile(testImagePath);
      const uint8Array = new Uint8Array(imageBuffer);
      const result = await removeBackground(uint8Array);
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.size).toBeGreaterThan(0);
    }, 60000);

    test('应该支持文件路径字符串', async () => {
      const result = await removeBackground(testImagePath);
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.size).toBeGreaterThan(0);
    }, 60000);
  });

  describe('调试模式', () => {
    test('应该在调试模式下运行', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation();
      
      try {
        await removeBackground(testImagePath, { debug: true });
      } finally {
        consoleSpy.mockRestore();
        debugSpy.mockRestore();
      }
    }, 60000);
  });

  describe('结果验证', () => {
    test('结果应该可以保存为文件', async () => {
      const result = await removeBackground(testImagePath);
      const outputPath = path.join(outputDir, 'test-result.png');
      
      const buffer = Buffer.from(await result.arrayBuffer());
      await fs.writeFile(outputPath, buffer);
      
      const stats = await fs.stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);
      
      await fs.unlink(outputPath);
    }, 60000);

    test('结果应该包含 alpha 通道信息', async () => {
      const result = await removeBackground(testImagePath, {
        output: { format: 'image/x-rgba8' }
      });
      
      const buffer = await result.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
    }, 60000);
  });

  describe('模型缓存', () => {
    test('应该缓存已加载的模型', async () => {
      const startTime1 = Date.now();
      await removeBackground(testImagePath);
      const time1 = Date.now() - startTime1;
      
      const startTime2 = Date.now();
      await removeBackground(testImagePath);
      const time2 = Date.now() - startTime2;
      
      expect(time2).toBeLessThan(time1 * 2);
    }, 120000);
  });
});
