const { z } = require('zod');

describe('配置验证测试', () => {
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
      debug: z
        .boolean()
        .default(false),
      proxyToWorker: z
        .boolean()
        .default(true),
      fetchArgs: z
        .any()
        .default({}),
      progress: z
        .function()
        .args(z.string(), z.number(), z.number())
        .returns(z.void())
        .optional(),
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

  function validateConfig(configuration) {
    return ConfigSchema.parse(configuration ?? {});
  }

  test('应该使用默认配置', () => {
    const config = validateConfig({});
    expect(config).toBeDefined();
  });

  test('应该验证有效的配置', () => {
    const validConfig = {
      debug: true,
      model: 'small',
      output: {
        format: 'image/png',
        quality: 0.9
      }
    };
    
    expect(() => validateConfig(validConfig)).not.toThrow();
  });

  test('应该接受模型别名 large/small/medium', () => {
    const config1 = validateConfig({ model: 'large' });
    expect(config1.model).toBe('isnet');

    const config2 = validateConfig({ model: 'medium' });
    expect(config2.model).toBe('isnet_fp16');

    const config3 = validateConfig({ model: 'small' });
    expect(config3.model).toBe('isnet_quint8');
  });

  test('应该拒绝无效的模型名称', () => {
    expect(() => validateConfig({ model: 'invalid_model' })).toThrow();
  });

  test('应该验证输出格式', () => {
    const validFormats = ['image/png', 'image/jpeg', 'image/webp', 'image/x-rgba8', 'image/x-alpha8'];
    
    validFormats.forEach(format => {
      expect(() => validateConfig({ output: { format } })).not.toThrow();
    });
  });

  test('应该拒绝无效的输出格式', () => {
    expect(() => validateConfig({ output: { format: 'image/gif' } })).toThrow();
  });

  test('应该验证输出质量范围', () => {
    expect(() => validateConfig({ output: { quality: 0.5 } })).not.toThrow();
    expect(() => validateConfig({ output: { quality: 1.0 } })).not.toThrow();
  });

  test('应该验证调试标志', () => {
    const config1 = validateConfig({ debug: true });
    expect(config1.debug).toBe(true);

    const config2 = validateConfig({ debug: false });
    expect(config2.debug).toBe(false);
  });

  test('应该验证 publicPath 必须是有效的 URI', () => {
    expect(() => validateConfig({ publicPath: 'https://example.com/' })).not.toThrow();
    expect(() => validateConfig({ publicPath: 'file:///path/to/resources/' })).not.toThrow();
  });

  test('应该拒绝无效的 publicPath', () => {
    expect(() => validateConfig({ publicPath: 'not_a_valid_uri' })).toThrow();
  });

  test('应该设置默认值', () => {
    const config = validateConfig({});
    
    expect(config.debug).toBe(false);
    expect(config.model).toBe('isnet_fp16');
    expect(config.output.format).toBe('image/png');
    expect(config.output.quality).toBe(0.8);
  });

  test('应该验证 fetchArgs', () => {
    const fetchArgs = {
      headers: { 'Authorization': 'Bearer token' },
      cache: 'no-cache'
    };
    const config = validateConfig({ fetchArgs });
    
    expect(config.fetchArgs).toEqual(fetchArgs);
  });

  test('应该验证 proxyToWorker 选项', () => {
    const config1 = validateConfig({ proxyToWorker: true });
    expect(config1.proxyToWorker).toBe(true);

    const config2 = validateConfig({ proxyToWorker: false });
    expect(config2.proxyToWorker).toBe(false);
  });

  describe('Web 特定配置 Schema 验证', () => {
    const WebConfigSchema = z
      .object({
        device: z.enum(['cpu', 'gpu']).default('cpu'),
        rescale: z.boolean().default(true),
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
                tileSize: z.number().min(4).max(64).default(16),
                color1: z
                  .object({
                    r: z.number().min(0).max(255).default(255),
                    g: z.number().min(0).max(255).default(255),
                    b: z.number().min(0).max(255).default(255)
                  })
                  .default({}),
                color2: z
                  .object({
                    r: z.number().min(0).max(255).default(204),
                    g: z.number().min(0).max(255).default(204),
                    b: z.number().min(0).max(255).default(204)
                  })
                  .default({})
              })
              .default({})
          })
          .default({})
      })
      .default({});

    function validateWebConfig(config) {
      return WebConfigSchema.parse(config ?? {});
    }

    test('应该验证 device 选项', () => {
      const cpuConfig = validateWebConfig({ device: 'cpu' });
      expect(cpuConfig.device).toBe('cpu');

      const gpuConfig = validateWebConfig({ device: 'gpu' });
      expect(gpuConfig.device).toBe('gpu');
    });

    test('应该验证 rescale 选项', () => {
      const config1 = validateWebConfig({ rescale: true });
      expect(config1.rescale).toBe(true);

      const config2 = validateWebConfig({ rescale: false });
      expect(config2.rescale).toBe(false);
    });

    test('应该验证 mask 配置', () => {
      const maskConfig = {
        smoothness: 5,
        feather: 10,
        edgeMode: 'soft',
        contrast: 50,
        threshold: 128
      };
      const config = validateWebConfig({ mask: maskConfig });
      
      expect(config.mask.smoothness).toBe(5);
      expect(config.mask.feather).toBe(10);
      expect(config.mask.edgeMode).toBe('soft');
      expect(config.mask.contrast).toBe(50);
      expect(config.mask.threshold).toBe(128);
    });

    test('应该验证 mask 配置的边界值', () => {
      expect(() => validateWebConfig({ mask: { smoothness: 21 } })).toThrow();
      expect(() => validateWebConfig({ mask: { smoothness: -1 } })).toThrow();
      expect(() => validateWebConfig({ mask: { feather: 51 } })).toThrow();
      expect(() => validateWebConfig({ mask: { feather: -1 } })).toThrow();
      expect(() => validateWebConfig({ mask: { contrast: 101 } })).toThrow();
      expect(() => validateWebConfig({ mask: { contrast: -101 } })).toThrow();
      expect(() => validateWebConfig({ mask: { threshold: 256 } })).toThrow();
      expect(() => validateWebConfig({ mask: { threshold: -1 } })).toThrow();
    });

    test('应该验证 background 配置', () => {
      const bgConfig = {
        type: 'solid',
        color: { r: 255, g: 0, b: 0 }
      };
      const config = validateWebConfig({ background: bgConfig });
      
      expect(config.background.type).toBe('solid');
      expect(config.background.color.r).toBe(255);
    });

    test('应该验证 checkerboard 背景配置', () => {
      const bgConfig = {
        type: 'checkerboard',
        checkerboard: {
          tileSize: 32,
          color1: { r: 255, g: 255, b: 255 },
          color2: { r: 128, g: 128, b: 128 }
        }
      };
      const config = validateWebConfig({ background: bgConfig });
      
      expect(config.background.checkerboard.tileSize).toBe(32);
    });

    test('应该验证 background 类型枚举', () => {
      const validTypes = ['transparent', 'solid', 'image', 'checkerboard'];
      
      validTypes.forEach(type => {
        expect(() => validateWebConfig({ background: { type } })).not.toThrow();
      });
    });

    test('应该拒绝无效的 background 类型', () => {
      expect(() => validateWebConfig({ background: { type: 'invalid_type' } })).toThrow();
    });
  });
});
