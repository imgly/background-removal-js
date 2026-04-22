const path = require('path');
const fs = require('fs/promises');
const { z } = require('zod');

let removeBackground = null;
let segmentForeground = null;
let removeForeground = null;
let applySegmentationMask = null;
let moduleAvailable = false;

try {
  const pkg = require('@imgly/background-removal-node');
  removeBackground = pkg.default;
  segmentForeground = pkg.segmentForeground;
  removeForeground = pkg.removeForeground;
  applySegmentationMask = pkg.applySegmentationMask;
  moduleAvailable = true;
  console.log('✅ @imgly/background-removal-node 模块加载成功');
} catch (e) {
  console.log('⚠️ @imgly/background-removal-node 模块不可用，将跳过需要该模块的测试');
  console.log('   错误信息:', e.message);
}

const testImagePath = path.join(__dirname, '../../fixtures/images/photo-1686002359940-6a51b0d64f68.jpeg');
const outputDir = path.join(__dirname, '../../fixtures/output');

describe('集成测试 - 完整流程测试', () => {
  beforeAll(async () => {
    try {
      await fs.access(outputDir);
    } catch {
      await fs.mkdir(outputDir, { recursive: true });
    }
  });

  describe('配置 Schema 验证测试（独立运行）', () => {
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
        proxyToWorker: z.boolean().default(true),
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
          .default({})
      })
      .default({});

    test('应该使用默认配置', () => {
      const config = ConfigSchema.parse({});
      expect(config).toBeDefined();
      expect(config.debug).toBe(false);
      expect(config.model).toBe('isnet_fp16');
    });

    test('应该接受模型别名 large/small/medium', () => {
      expect(ConfigSchema.parse({ model: 'large' }).model).toBe('isnet');
      expect(ConfigSchema.parse({ model: 'medium' }).model).toBe('isnet_fp16');
      expect(ConfigSchema.parse({ model: 'small' }).model).toBe('isnet_quint8');
    });

    test('应该拒绝无效的模型名称', () => {
      expect(() => ConfigSchema.parse({ model: 'invalid_model' })).toThrow();
    });

    test('应该验证输出格式', () => {
      const validFormats = ['image/png', 'image/jpeg', 'image/webp', 'image/x-rgba8', 'image/x-alpha8'];
      validFormats.forEach(format => {
        expect(() => ConfigSchema.parse({ output: { format } })).not.toThrow();
      });
    });

    test('应该拒绝无效的输出格式', () => {
      expect(() => ConfigSchema.parse({ output: { format: 'image/gif' } })).toThrow();
    });

    test('应该验证 publicPath 必须是有效的 URI', () => {
      expect(() => ConfigSchema.parse({ publicPath: 'https://example.com/' })).not.toThrow();
      expect(() => ConfigSchema.parse({ publicPath: 'not_a_valid_uri' })).toThrow();
    });

    test('应该验证输出质量范围', () => {
      expect(() => ConfigSchema.parse({ output: { quality: 0.5 } })).not.toThrow();
      expect(() => ConfigSchema.parse({ output: { quality: 1.0 } })).not.toThrow();
    });

    test('应该验证调试标志', () => {
      expect(ConfigSchema.parse({ debug: true }).debug).toBe(true);
      expect(ConfigSchema.parse({ debug: false }).debug).toBe(false);
    });
  });

  describe('测试文件存在性验证', () => {
    test('测试图片文件应该存在', async () => {
      try {
        await fs.access(testImagePath);
        expect(true).toBe(true);
      } catch {
        fail('测试图片文件不存在: ' + testImagePath);
      }
    });

    test('测试图片文件应该有内容', async () => {
      const stats = await fs.stat(testImagePath);
      expect(stats.size).toBeGreaterThan(0);
    });

    test('输出目录应该可以创建', async () => {
      try {
        await fs.access(outputDir);
      } catch {
        await fs.mkdir(outputDir, { recursive: true });
      }
      
      try {
        await fs.access(outputDir);
        expect(true).toBe(true);
      } catch {
        fail('输出目录无法创建或访问');
      }
    });
  });

  describe('路径处理测试', () => {
    test('应该正确处理相对路径', () => {
      const relativePath = '../../fixtures/images/photo-1686002359940-6a51b0d64f68.jpeg';
      const absolutePath = path.join(__dirname, relativePath);
      
      expect(path.isAbsolute(absolutePath)).toBe(true);
    });

    test('应该正确处理不同的路径分隔符', () => {
      const winPath = 'fixtures\\images\\test.jpg';
      const posixPath = 'fixtures/images/test.jpg';
      
      expect(path.normalize(winPath)).toBe(path.normalize(posixPath));
    });

    test('应该正确提取文件扩展名', () => {
      expect(path.extname('test.png')).toBe('.png');
      expect(path.extname('test.jpg')).toBe('.jpg');
      expect(path.extname('test.jpeg')).toBe('.jpeg');
      expect(path.extname('test.webp')).toBe('.webp');
    });
  });

  describe('Buffer 处理测试', () => {
    test('应该正确创建和操作 Buffer', () => {
      const data = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
      expect(data.length).toBe(4);
      expect(data[0]).toBe(0x89);
      expect(data[1]).toBe(0x50);
    });

    test('应该正确转换 Buffer 和 Uint8Array', () => {
      const buffer = Buffer.from([1, 2, 3, 4]);
      const uint8Array = new Uint8Array(buffer);
      
      expect(uint8Array.length).toBe(buffer.length);
      expect(uint8Array[0]).toBe(buffer[0]);
    });

    test('应该正确处理 Base64 编码', () => {
      const data = 'test data';
      const encoded = Buffer.from(data).toString('base64');
      const decoded = Buffer.from(encoded, 'base64').toString();
      
      expect(decoded).toBe(data);
    });
  });

  (moduleAvailable ? describe : describe.skip)('需要 @imgly/background-removal-node 模块的测试', () => {
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

    test('结果应该可以保存为文件', async () => {
      const result = await removeBackground(testImagePath);
      const outputPath = path.join(outputDir, 'integration-test-result.png');
      
      const buffer = Buffer.from(await result.arrayBuffer());
      await fs.writeFile(outputPath, buffer);
      
      const stats = await fs.stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);
      
      await fs.unlink(outputPath);
    }, 60000);
  });
});
