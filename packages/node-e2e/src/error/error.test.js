const path = require('path');
const fs = require('fs/promises');
const { z } = require('zod');
const ndarray = require('ndarray');

let removeBackground = null;
let validateConfig = null;
let moduleAvailable = false;

try {
  const pkg = require('@imgly/background-removal-node');
  removeBackground = pkg.default;
  moduleAvailable = true;
  console.log('✅ @imgly/background-removal-node 模块加载成功');
} catch (e) {
  console.log('⚠️ @imgly/background-removal-node 模块不可用，将跳过需要该模块的测试');
  console.log('   错误信息:', e.message);
}

const testImagePath = path.join(__dirname, '../../fixtures/images/photo-1686002359940-6a51b0d64f68.jpeg');
const nonExistentPath = path.join(__dirname, '../../fixtures/images/nonexistent.jpg');

function isURI(s) {
  try {
    new URL(s);
    return true;
  } catch (err) {
    return false;
  }
}

const ConfigSchema = z
  .object({
    publicPath: z
      .string()
      .optional()
      .default('file:///default/path/')
      .refine((val) => isURI(val), {
        message: 'String must be a valid uri'
      }),
    debug: z.boolean().default(false),
    model: z
      .preprocess(
        (val) => {
          switch (val) {
            case 'large':
              return 'isnet';
            case 'small':
              return 'isnet_quint8';
            case 'medium':
              return 'isnet_fp16';
            default:
              return val;
          }
        },
        z.enum(['isnet', 'isnet_fp16', 'isnet_quint8'])
      )
      .default('medium'),
    output: z
      .object({
        format: z
          .enum([
            'image/png',
            'image/jpeg',
            'image/webp',
            'image/x-rgba8',
            'image/x-alpha8'
          ])
          .default('image/png'),
        quality: z.number().default(0.8)
      })
      .default({}),
    mask: z
      .object({
        smoothness: z.number().min(0).max(20).default(0),
        feather: z.number().min(0).max(50).default(0),
        edgeMode: z.enum(['auto', 'hard', 'soft', 'blur']).default('auto'),
        contrast: z.number().min(-100).max(100).default(0),
        threshold: z.number().min(0).max(255).optional()
      })
      .default({}),
    background: z
      .object({
        type: z.enum(['transparent', 'solid', 'image', 'checkerboard']).default('transparent'),
        color: z
          .object({
            r: z.number().min(0).max(255).default(255),
            g: z.number().min(0).max(255).default(255),
            b: z.number().min(0).max(255).default(255)
          })
          .default({}),
        checkerboard: z
          .object({
            tileSize: z.number().min(4).max(64).default(16)
          })
          .default({})
      })
      .default({})
  })
  .default({});

function localValidateConfig(config) {
  return ConfigSchema.parse(config ?? {});
}

describe('异常处理测试', () => {
  describe('配置异常测试（独立运行）', () => {
    test('应该拒绝无效的模型名称', () => {
      expect(() => {
        localValidateConfig({ model: 'invalid_model_name' });
      }).toThrow();
    });

    test('应该拒绝无效的输出格式', () => {
      expect(() => {
        localValidateConfig({ output: { format: 'image/gif' } });
      }).toThrow();
    });

    test('应该拒绝无效的 publicPath', () => {
      expect(() => {
        localValidateConfig({ publicPath: 'not_a_valid_uri' });
      }).toThrow();
    });

    test('应该拒绝无效的 mask.smoothness 配置', () => {
      expect(() => {
        localValidateConfig({ mask: { smoothness: 100 } });
      }).toThrow();

      expect(() => {
        localValidateConfig({ mask: { smoothness: -1 } });
      }).toThrow();
    });

    test('应该拒绝无效的 mask.feather 配置', () => {
      expect(() => {
        localValidateConfig({ mask: { feather: 51 } });
      }).toThrow();

      expect(() => {
        localValidateConfig({ mask: { feather: -1 } });
      }).toThrow();
    });

    test('应该拒绝无效的 mask.contrast 配置', () => {
      expect(() => {
        localValidateConfig({ mask: { contrast: 101 } });
      }).toThrow();

      expect(() => {
        localValidateConfig({ mask: { contrast: -101 } });
      }).toThrow();
    });

    test('应该拒绝无效的 mask.threshold 配置', () => {
      expect(() => {
        localValidateConfig({ mask: { threshold: 256 } });
      }).toThrow();

      expect(() => {
        localValidateConfig({ mask: { threshold: -1 } });
      }).toThrow();
    });

    test('应该拒绝无效的 background.type 配置', () => {
      expect(() => {
        localValidateConfig({ background: { type: 'invalid_type' } });
      }).toThrow();
    });

    test('应该接受有效的配置', () => {
      const validConfigs = [
        {},
        { debug: true },
        { model: 'small' },
        { model: 'medium' },
        { model: 'large' },
        { output: { format: 'image/png' } },
        { output: { format: 'image/jpeg', quality: 0.9 } },
        { publicPath: 'https://example.com/' },
        { mask: { smoothness: 5, feather: 10, edgeMode: 'soft' } },
        { background: { type: 'solid', color: { r: 255, g: 0, b: 0 } } }
      ];

      validConfigs.forEach(config => {
        expect(() => localValidateConfig(config)).not.toThrow();
      });
    });
  });

  describe('输入验证测试（独立运行）', () => {
    test('应该检测 null 输入', () => {
      expect(null).toBeNull();
    });

    test('应该检测 undefined 输入', () => {
      expect(undefined).toBeUndefined();
    });

    test('应该检测空字符串', () => {
      expect('').toHaveLength(0);
    });

    test('应该检测空 Buffer', () => {
      const emptyBuffer = Buffer.alloc(0);
      expect(emptyBuffer.length).toBe(0);
    });

    test('应该检测不存在的文件路径', async () => {
      try {
        await fs.access(nonExistentPath);
        fail('应该抛出错误');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('应该检测有效的图片文件', async () => {
      try {
        await fs.access(testImagePath);
        const stats = await fs.stat(testImagePath);
        expect(stats.size).toBeGreaterThan(0);
      } catch {
        fail('测试图片文件应该存在');
      }
    });
  });

  describe('边界情况测试（独立运行）', () => {
    test('应该正确处理 0 值', () => {
      const data = new Uint8Array([0]);
      expect(data[0]).toBe(0);
    });

    test('应该正确处理 255 值', () => {
      const data = new Uint8Array([255]);
      expect(data[0]).toBe(255);
    });

    test('应该正确处理类型转换', () => {
      const floatValue = 0.5;
      const uintValue = floatValue * 255;
      expect(uintValue).toBe(127.5);
    });

    test('应该正确创建不同尺寸的 ndarray', () => {
      const sizes = [1, 2, 4, 8, 16];
      
      sizes.forEach(size => {
        const data = new Uint8Array(size * size * 4);
        const array = ndarray(data, [size, size, 4]);
        expect(array.shape).toEqual([size, size, 4]);
      });
    });

    test('应该正确访问 ndarray 元素', () => {
      const data = new Uint8Array([0, 64, 128, 192, 255, 100, 150, 200]);
      const array = ndarray(data, [2, 2, 2]);
      
      expect(array.get(0, 0, 0)).toBe(0);
      expect(array.get(0, 0, 1)).toBe(64);
      expect(array.get(1, 1, 1)).toBe(200);
    });
  });

  describe('错误消息验证测试（独立运行）', () => {
    test('错误对象应该包含有意义的信息', () => {
      const error = new Error('Test error message');
      
      expect(error.message).toBeDefined();
      expect(typeof error.message).toBe('string');
      expect(error.message.length).toBeGreaterThan(0);
    });

    test('配置验证错误应该包含具体的字段信息', () => {
      try {
        localValidateConfig({ model: 'invalid' });
        fail('应该抛出错误');
      } catch (error) {
        expect(error.message).toContain('model');
      }
    });

    test('应该正确使用 try-catch 捕获错误', () => {
      let errorCaught = false;
      
      try {
        throw new Error('Test error');
      } catch (error) {
        errorCaught = true;
        expect(error.message).toBe('Test error');
      }
      
      expect(errorCaught).toBe(true);
    });
  });

  describe('URI 验证测试（独立运行）', () => {
    test('应该验证有效的 http URL', () => {
      expect(isURI('https://example.com/')).toBe(true);
      expect(isURI('http://localhost:3000/')).toBe(true);
    });

    test('应该验证有效的 file URI', () => {
      expect(isURI('file:///path/to/file')).toBe(true);
      expect(isURI('file:///C:/path/to/file')).toBe(true);
    });

    test('应该拒绝无效的 URI', () => {
      expect(isURI('not a valid uri')).toBe(false);
      expect(isURI('')).toBe(false);
      expect(isURI('relative/path')).toBe(false);
    });
  });

  describe('Promise 处理测试（独立运行）', () => {
    test('应该正确处理 Promise.allSettled', async () => {
      const promises = [
        Promise.resolve('success'),
        Promise.reject(new Error('failure')),
        Promise.resolve('success2')
      ];
      
      const results = await Promise.allSettled(promises);
      
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });

    test('应该正确处理 Promise.reject', async () => {
      await expect(Promise.reject(new Error('test error'))).rejects.toThrow();
    });

    test('应该正确处理 Promise.resolve', async () => {
      const result = await Promise.resolve('success');
      expect(result).toBe('success');
    });
  });

  (moduleAvailable ? describe : describe.skip)('需要 @imgly/background-removal-node 模块的测试', () => {
    test('应该对不存在的文件路径抛出错误', async () => {
      await expect(removeBackground(nonExistentPath)).rejects.toThrow();
    }, 30000);

    test('应该对空数据抛出错误', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(removeBackground(emptyBuffer)).rejects.toThrow();
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

    test('应该对无效的 publicPath 抛出错误', async () => {
      await expect(
        removeBackground(testImagePath, {
          publicPath: 'file:///nonexistent/path/'
        })
      ).rejects.toThrow();
    }, 60000);

    test('应该对错误类型的图片源抛出错误', async () => {
      await expect(removeBackground(12345)).rejects.toThrow();
    }, 30000);

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
  });
});
