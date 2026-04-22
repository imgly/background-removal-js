const ndarray = require('ndarray');
const { z } = require('zod');

describe('示例测试套件', () => {
  describe('基础工具函数测试', () => {
    test('ndarray 应该正确创建和访问元素', () => {
      const data = new Uint8Array([0, 64, 128, 192, 255, 100, 150, 200]);
      const array = ndarray(data, [2, 2, 2]);
      
      expect(array.get(0, 0, 0)).toBe(0);
      expect(array.get(1, 1, 1)).toBe(200);
      expect(array.shape).toEqual([2, 2, 2]);
    });

    test('应该正确计算数组长度', () => {
      const width = 4;
      const height = 4;
      const channels = 4;
      const data = new Uint8Array(width * height * channels);
      
      expect(data.length).toBe(64);
    });
  });

  describe('配置验证测试', () => {
    test('应该验证有效的模型名称', () => {
      const ModelSchema = z.enum(['isnet', 'isnet_fp16', 'isnet_quint8']);
      
      expect(() => ModelSchema.parse('isnet')).not.toThrow();
      expect(() => ModelSchema.parse('isnet_fp16')).not.toThrow();
      expect(() => ModelSchema.parse('isnet_quint8')).not.toThrow();
    });

    test('应该拒绝无效的模型名称', () => {
      const ModelSchema = z.enum(['isnet', 'isnet_fp16', 'isnet_quint8']);
      
      expect(() => ModelSchema.parse('invalid_model')).toThrow();
    });

    test('应该验证输出格式', () => {
      const FormatSchema = z.enum([
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/x-rgba8',
        'image/x-alpha8'
      ]);
      
      expect(() => FormatSchema.parse('image/png')).not.toThrow();
      expect(() => FormatSchema.parse('image/jpeg')).not.toThrow();
      expect(() => FormatSchema.parse('image/webp')).not.toThrow();
    });

    test('应该拒绝无效的输出格式', () => {
      const FormatSchema = z.enum([
        'image/png',
        'image/jpeg',
        'image/webp'
      ]);
      
      expect(() => FormatSchema.parse('image/gif')).toThrow();
    });
  });

  describe('比例计算测试', () => {
    function calculateProportionalSize(originalWidth, originalHeight, maxWidth, maxHeight) {
      const widthRatio = maxWidth / originalWidth;
      const heightRatio = maxHeight / originalHeight;
      const scalingFactor = Math.min(widthRatio, heightRatio);
      const newWidth = Math.floor(originalWidth * scalingFactor);
      const newHeight = Math.floor(originalHeight * scalingFactor);
      return [newWidth, newHeight];
    }

    test('应该按比例缩小大尺寸', () => {
      const [newWidth, newHeight] = calculateProportionalSize(1920, 1080, 1024, 1024);
      
      expect(newWidth).toBeLessThanOrEqual(1024);
      expect(newHeight).toBeLessThanOrEqual(1024);
    });

    test('应该保持宽高比', () => {
      const originalWidth = 1920;
      const originalHeight = 1080;
      const aspectRatio = originalWidth / originalHeight;
      
      const [newWidth, newHeight] = calculateProportionalSize(originalWidth, originalHeight, 1024, 1024);
      const newAspectRatio = newWidth / newHeight;
      
      expect(newAspectRatio).toBeCloseTo(aspectRatio, 5);
    });

    test('应该按比例放大小尺寸以适应最大边界', () => {
      const [newWidth, newHeight] = calculateProportionalSize(512, 512, 1024, 1024);
      
      expect(newWidth).toBeLessThanOrEqual(1024);
      expect(newHeight).toBeLessThanOrEqual(1024);
    });
  });

  describe('类型转换测试', () => {
    function convertFloat32ToUint8(float32Array) {
      const uint8Array = new Uint8Array(float32Array.data.length);
      for (let i = 0; i < float32Array.data.length; i++) {
        uint8Array[i] = float32Array.data[i] * 255;
      }
      return ndarray(uint8Array, float32Array.shape);
    }

    test('应该正确转换 Float32 到 Uint8', () => {
      const data = new Float32Array([0.0, 0.5, 1.0]);
      const tensor = ndarray(data, [1, 3, 1]);
      
      const result = convertFloat32ToUint8(tensor);
      
      expect(result.data instanceof Uint8Array).toBe(true);
      expect(result.data[0]).toBe(0);
      expect(result.data[2]).toBe(255);
    });

    test('应该保持张量形状', () => {
      const data = new Float32Array([0.0, 0.5, 1.0, 0.25]);
      const tensor = ndarray(data, [2, 2, 1]);
      
      const result = convertFloat32ToUint8(tensor);
      
      expect(result.shape).toEqual([2, 2, 1]);
    });
  });

  describe('URI 验证测试', () => {
    function isURI(s) {
      try {
        new URL(s);
        return true;
      } catch (err) {
        return false;
      }
    }

    test('应该验证有效的 http URL', () => {
      expect(isURI('https://example.com/')).toBe(true);
      expect(isURI('http://localhost:3000/')).toBe(true);
    });

    test('应该验证有效的 file URI', () => {
      expect(isURI('file:///path/to/file')).toBe(true);
    });

    test('应该拒绝无效的 URI', () => {
      expect(isURI('not a valid uri')).toBe(false);
      expect(isURI('')).toBe(false);
    });
  });

  describe('边界情况测试', () => {
    test('应该正确处理 0 值', () => {
      const data = new Uint8Array([0]);
      expect(data[0]).toBe(0);
    });

    test('应该正确处理 255 值', () => {
      const data = new Uint8Array([255]);
      expect(data[0]).toBe(255);
    });

    test('应该正确创建不同尺寸的数组', () => {
      const sizes = [1, 2, 4, 8, 16, 32];
      
      sizes.forEach(size => {
        const data = new Uint8Array(size * size * 4);
        expect(data.length).toBe(size * size * 4);
      });
    });
  });
});
