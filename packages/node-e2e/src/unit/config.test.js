const path = require('path');

describe('配置验证测试', () => {
  const { validateConfig, ConfigSchema } = require('../../node/dist/schema.cjs');

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

  test('应该设置默认值', () => {
    const config = validateConfig({});
    
    expect(config.debug).toBe(false);
    expect(config.model).toBe('isnet_fp16');
    expect(config.output.format).toBe('image/png');
    expect(config.output.quality).toBe(0.8);
  });

  test('应该验证进度回调函数', () => {
    const progressCallback = jest.fn();
    const config = validateConfig({ progress: progressCallback });
    
    expect(config.progress).toBe(progressCallback);
  });

  test('应该验证 fetchArgs', () => {
    const fetchArgs = {
      headers: { 'Authorization': 'Bearer token' },
      cache: 'no-cache'
    };
    const config = validateConfig({ fetchArgs });
    
    expect(config.fetchArgs).toEqual(fetchArgs);
  });

  describe('Web 特定配置', () => {
    test('应该验证 device 选项', () => {
      const cpuConfig = validateConfig({ device: 'cpu' });
      expect(cpuConfig.device).toBe('cpu');

      const gpuConfig = validateConfig({ device: 'gpu' });
      expect(gpuConfig.device).toBe('gpu');
    });

    test('应该验证 rescale 选项', () => {
      const config1 = validateConfig({ rescale: true });
      expect(config1.rescale).toBe(true);

      const config2 = validateConfig({ rescale: false });
      expect(config2.rescale).toBe(false);
    });

    test('应该验证 proxyToWorker 选项', () => {
      const config1 = validateConfig({ proxyToWorker: true });
      expect(config1.proxyToWorker).toBe(true);

      const config2 = validateConfig({ proxyToWorker: false });
      expect(config2.proxyToWorker).toBe(false);
    });

    test('应该验证 mask 配置', () => {
      const maskConfig = {
        smoothness: 5,
        feather: 10,
        edgeMode: 'soft',
        contrast: 50,
        threshold: 128
      };
      const config = validateConfig({ mask: maskConfig });
      
      expect(config.mask.smoothness).toBe(5);
      expect(config.mask.feather).toBe(10);
      expect(config.mask.edgeMode).toBe('soft');
      expect(config.mask.contrast).toBe(50);
      expect(config.mask.threshold).toBe(128);
    });

    test('应该验证 mask 配置的边界值', () => {
      expect(() => validateConfig({ mask: { smoothness: 21 } })).toThrow();
      expect(() => validateConfig({ mask: { smoothness: -1 } })).toThrow();
      expect(() => validateConfig({ mask: { feather: 51 } })).toThrow();
      expect(() => validateConfig({ mask: { feather: -1 } })).toThrow();
      expect(() => validateConfig({ mask: { contrast: 101 } })).toThrow();
      expect(() => validateConfig({ mask: { contrast: -101 } })).toThrow();
      expect(() => validateConfig({ mask: { threshold: 256 } })).toThrow();
      expect(() => validateConfig({ mask: { threshold: -1 } })).toThrow();
    });

    test('应该验证 background 配置', () => {
      const bgConfig = {
        type: 'solid',
        color: { r: 255, g: 0, b: 0 }
      };
      const config = validateConfig({ background: bgConfig });
      
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
      const config = validateConfig({ background: bgConfig });
      
      expect(config.background.checkerboard.tileSize).toBe(32);
    });

    test('应该验证 background 类型枚举', () => {
      const validTypes = ['transparent', 'solid', 'image', 'checkerboard'];
      
      validTypes.forEach(type => {
        expect(() => validateConfig({ background: { type } })).not.toThrow();
      });
    });
  });
});
