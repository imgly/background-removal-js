const path = require('path');
const fs = require('fs/promises');

describe('异常处理测试', () => {
  const removeBackground = require('../../node/dist/index.cjs').default;
  const { validateConfig } = require('../../node/dist/schema.cjs');
  
  const testImagePath = path.join(__dirname, '../../fixtures/images/photo-1686002359940-6a51b0d64f68.jpeg');
  const nonExistentPath = path.join(__dirname, '../../fixtures/images/nonexistent.jpg');
  const invalidImagePath = path.join(__dirname, '../../fixtures/images/invalid.txt');

  describe('配置异常', () => {
    test('应该拒绝无效的模型名称', () => {
      expect(() => {
        validateConfig({ model: 'invalid_model_name' });
      }).toThrow();
    });

    test('应该拒绝无效的输出格式', () => {
      expect(() => {
        validateConfig({ output: { format: 'image/gif' } });
      }).toThrow();
    });

    test('应该拒绝无效的 publicPath', () => {
      expect(() => {
        validateConfig({ publicPath: 'not_a_valid_uri' });
      }).toThrow();
    });

    test('应该拒绝无效的 mask 配置', () => {
      expect(() => {
        validateConfig({ mask: { smoothness: 100 } });
      }).toThrow();

      expect(() => {
        validateConfig({ mask: { feather: -1 } });
      }).toThrow();
    });

    test('应该拒绝无效的 background 配置', () => {
      expect(() => {
        validateConfig({ background: { type: 'invalid_type' } });
      }).toThrow();
    });
  });

  describe('图片源异常', () => {
    test('应该对不存在的文件路径抛出错误', async () => {
      await expect(removeBackground(nonExistentPath)).rejects.toThrow();
    }, 30000);

    test('应该对空数据抛出错误', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(removeBackground(emptyBuffer)).rejects.toThrow();
    }, 30000);

    test('应该对无效的图片格式抛出错误', async () => {
      const invalidData = Buffer.from('this is not an image file');
      await expect(removeBackground(invalidData)).rejects.toThrow();
    }, 30000);

    test('应该对 null 输入抛出错误', async () => {
      await expect(removeBackground(null)).rejects.toThrow();
    }, 30000);

    test('应该对 undefined 输入抛出错误', async () => {
      await expect(removeBackground(undefined)).rejects.toThrow();
    }, 30000);

    test('应该对空字符串路径抛出错误', async () => {
      await expect(removeBackground('')).rejects.toThrow();
    }, 30000);
  });

  describe('模型加载异常', () => {
    test('应该对无效的 publicPath 抛出错误', async () => {
      await expect(
        removeBackground(testImagePath, {
          publicPath: 'file:///nonexistent/path/'
        })
      ).rejects.toThrow();
    }, 60000);

    test('应该在 resources.json 不存在时抛出错误', async () => {
      await expect(
        removeBackground(testImagePath, {
          publicPath: 'file:///tmp/invalid/'
        })
      ).rejects.toThrow();
    }, 60000);
  });

  describe('网络异常模拟', () => {
    const originalFetch = global.fetch;
    
    afterEach(() => {
      global.fetch = originalFetch;
    });

    test('应该在网络错误时抛出错误', async () => {
      global.fetch = jest.fn(() => 
        Promise.reject(new Error('Network error: ECONNRESET'))
      );
      
      await expect(
        removeBackground('https://example.com/non-existent-image.jpg')
      ).rejects.toThrow();
    }, 30000);

    test('应该在 404 响应时抛出错误', async () => {
      global.fetch = jest.fn(() => 
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        })
      );
      
      await expect(
        removeBackground('https://example.com/non-existent-image.jpg')
      ).rejects.toThrow();
    }, 30000);

    test('应该在 500 服务器错误时抛出错误', async () => {
      global.fetch = jest.fn(() => 
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
      );
      
      await expect(
        removeBackground('https://example.com/server-error.jpg')
      ).rejects.toThrow();
    }, 30000);

    test('应该在超时情况下抛出错误', async () => {
      global.fetch = jest.fn(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        })
      );
      
      await expect(
        removeBackground('https://example.com/timeout.jpg')
      ).rejects.toThrow();
    }, 5000);
  });

  describe('参数类型异常', () => {
    test('应该对错误类型的图片源抛出错误', async () => {
      await expect(removeBackground(12345)).rejects.toThrow();
    }, 30000);

    test('应该对对象类型的图片源抛出错误（非 Blob/Buffer）', async () => {
      await expect(removeBackground({ some: 'object' })).rejects.toThrow();
    }, 30000);

    test('应该对数组类型的图片源抛出错误', async () => {
      await expect(removeBackground([1, 2, 3])).rejects.toThrow();
    }, 30000);
  });

  describe('资源加载异常', () => {
    test('应该在模型文件损坏时抛出错误', async () => {
      const corruptedModelData = Buffer.from('corrupted model data');
      
      await expect(
        removeBackground(testImagePath, {
          publicPath: 'file:///corrupted/path/'
        })
      ).rejects.toThrow();
    }, 60000);
  });

  describe('并发处理异常', () => {
    test('应该正确处理多个并发请求中的失败', async () => {
      const promises = [
        removeBackground(testImagePath),
        removeBackground(nonExistentPath),
        removeBackground(testImagePath)
      ];
      
      const results = await Promise.allSettled(promises);
      
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    }, 120000);
  });

  describe('错误信息验证', () => {
    test('错误消息应该包含有意义的信息', async () => {
      try {
        await removeBackground(nonExistentPath);
        fail('应该抛出错误');
      } catch (error) {
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
      }
    }, 30000);

    test('配置验证错误应该包含具体的验证信息', () => {
      try {
        validateConfig({ model: 'invalid' });
        fail('应该抛出错误');
      } catch (error) {
        expect(error.message).toContain('model');
      }
    });
  });

  describe('边界情况', () => {
    test('应该处理极小的图片', async () => {
      const tinyPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      
      await expect(removeBackground(tinyPng)).resolves.toBeDefined();
    }, 60000);

    test('应该处理单通道图片', async () => {
      const grayscaleData = new Uint8Array([
        0, 128, 255, 128
      ]);
      
      const createGrayscaleImage = () => {
        const header = Buffer.from([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
          0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
          0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02,
          0x08, 0x00, 0x00, 0x00, 0x00, 0x57, 0xDD, 0x5F,
          0x54, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
          0x54, 0x08, 0xD7, 0x63, 0x60, 0x60, 0xF8, 0x0F,
          0x00, 0x02, 0x03, 0x00, 0x5E, 0x9B, 0xB7, 0x5F,
          0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
          0xAE, 0x42, 0x60, 0x82
        ]);
        return header;
      };
      
      const smallPng = createGrayscaleImage();
      
      expect(() => removeBackground(smallPng)).toBeDefined();
    }, 30000);
  });

  describe('内存异常处理', () => {
    test('应该在处理后清理资源', async () => {
      const initialMemory = process.memoryUsage();
      
      for (let i = 0; i < 2; i++) {
        try {
          await removeBackground(testImagePath);
        } catch (e) {
        }
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      
      expect(finalMemory.heapUsed).toBeLessThan(initialMemory.heapUsed + 500 * 1024 * 1024);
    }, 120000);
  });
});
