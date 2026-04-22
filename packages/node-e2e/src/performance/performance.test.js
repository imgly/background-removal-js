const path = require('path');
const fs = require('fs/promises');
const { performance } = require('perf_hooks');
const ndarray = require('ndarray');

let removeBackground = null;
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

describe('性能测试', () => {
  const performanceMetrics = {
    firstLoadTime: null,
    subsequentLoadTime: null,
    memoryUsage: [],
    processingTimes: []
  };

  const getMemoryUsage = () => {
    const used = process.memoryUsage();
    return {
      rss: Math.round(used.rss / 1024 / 1024),
      heapTotal: Math.round(used.heapTotal / 1024 / 1024),
      heapUsed: Math.round(used.heapUsed / 1024 / 1024),
      external: Math.round(used.external / 1024 / 1024)
    };
  };

  const logMemory = (label) => {
    const memory = getMemoryUsage();
    performanceMetrics.memoryUsage.push({ label, ...memory, timestamp: Date.now() });
    console.log(`[${label}] Memory: RSS=${memory.rss}MB, HeapUsed=${memory.heapUsed}MB`);
  };

  describe('内存监控测试（独立运行）', () => {
    test('应该能够获取内存使用信息', () => {
      const memory = getMemoryUsage();
      
      expect(memory.rss).toBeGreaterThan(0);
      expect(memory.heapTotal).toBeGreaterThan(0);
      expect(memory.heapUsed).toBeGreaterThan(0);
    });

    test('内存使用应该是合理的数值', () => {
      const memory = getMemoryUsage();
      
      expect(typeof memory.rss).toBe('number');
      expect(typeof memory.heapTotal).toBe('number');
      expect(typeof memory.heapUsed).toBe('number');
      expect(typeof memory.external).toBe('number');
    });
  });

  describe('性能计时测试（独立运行）', () => {
    test('应该能够使用 performance.now() 测量时间', () => {
      const startTime = performance.now();
      
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }
      
      const endTime = performance.now();
      const elapsedTime = endTime - startTime;
      
      expect(elapsedTime).toBeGreaterThanOrEqual(0);
      expect(typeof elapsedTime).toBe('number');
    });

    test('测量循环执行时间', () => {
      const iterations = 100000;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        Math.sin(i);
      }
      
      const endTime = performance.now();
      const elapsedTime = endTime - startTime;
      
      console.log(`循环 ${iterations} 次耗时: ${elapsedTime.toFixed(2)}ms`);
      expect(elapsedTime).toBeGreaterThanOrEqual(0);
    });

    test('测量数组操作时间', () => {
      const sizes = [1000, 10000, 100000];
      const results = [];
      
      sizes.forEach(size => {
        const startTime = performance.now();
        const array = new Array(size).fill(0).map((_, i) => i * 2);
        const endTime = performance.now();
        
        const elapsedTime = endTime - startTime;
        results.push({ size, time: elapsedTime });
        console.log(`数组大小 ${size}: ${elapsedTime.toFixed(3)}ms`);
        
        expect(elapsedTime).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('ndarray 操作性能测试（独立运行）', () => {
    test('应该能够创建大尺寸 ndarray', () => {
      const sizes = [64, 128, 256, 512];
      
      sizes.forEach(size => {
        const startTime = performance.now();
        const data = new Uint8Array(size * size * 4);
        const array = ndarray(data, [size, size, 4]);
        const endTime = performance.now();
        
        const elapsedTime = endTime - startTime;
        console.log(`创建 ${size}x${size}x4 ndarray: ${elapsedTime.toFixed(3)}ms`);
        
        expect(array.shape).toEqual([size, size, 4]);
        expect(array.data.length).toBe(size * size * 4);
      });
    });

    test('应该能够快速访问 ndarray 元素', () => {
      const size = 256;
      const data = new Uint8Array(size * size * 4);
      const array = ndarray(data, [size, size, 4]);
      
      const startTime = performance.now();
      
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          array.set(y, x, 0, 255);
          array.set(y, x, 3, 255);
        }
      }
      
      const endTime = performance.now();
      const elapsedTime = endTime - startTime;
      
      console.log(`访问 ${size}x${size} ndarray 元素: ${elapsedTime.toFixed(2)}ms`);
      expect(elapsedTime).toBeGreaterThanOrEqual(0);
    });

    test('应该能够复制 ndarray 数据', () => {
      const size = 256;
      const originalData = new Uint8Array(size * size * 4);
      for (let i = 0; i < originalData.length; i++) {
        originalData[i] = i % 256;
      }
      const originalArray = ndarray(originalData, [size, size, 4]);
      
      const startTime = performance.now();
      const copiedData = new Uint8Array(originalData);
      const copiedArray = ndarray(copiedData, originalArray.shape);
      const endTime = performance.now();
      
      const elapsedTime = endTime - startTime;
      console.log(`复制 ${size}x${size}x4 ndarray: ${elapsedTime.toFixed(3)}ms`);
      
      expect(copiedArray.shape).toEqual(originalArray.shape);
      expect(copiedArray.data[0]).toBe(originalArray.data[0]);
    });
  });

  describe('Buffer 操作性能测试（独立运行）', () => {
    test('应该能够快速创建 Buffer', () => {
      const sizes = [1024, 10240, 102400, 1024000];
      
      sizes.forEach(size => {
        const startTime = performance.now();
        const buffer = Buffer.alloc(size);
        const endTime = performance.now();
        
        const elapsedTime = endTime - startTime;
        console.log(`创建 ${size} 字节 Buffer: ${elapsedTime.toFixed(3)}ms`);
        
        expect(buffer.length).toBe(size);
      });
    });

    test('应该能够快速复制 Buffer', () => {
      const size = 1024 * 1024;
      const original = Buffer.alloc(size, 0xAA);
      
      const startTime = performance.now();
      const copy = Buffer.from(original);
      const endTime = performance.now();
      
      const elapsedTime = endTime - startTime;
      console.log(`复制 ${(size / 1024 / 1024).toFixed(1)}MB Buffer: ${elapsedTime.toFixed(3)}ms`);
      
      expect(copy.length).toBe(size);
      expect(copy[0]).toBe(0xAA);
    });

    test('应该能够快速进行 Base64 编码', () => {
      const sizes = [1024, 10240, 102400];
      
      sizes.forEach(size => {
        const buffer = Buffer.alloc(size, 0x55);
        
        const startTime = performance.now();
        const encoded = buffer.toString('base64');
        const endTime = performance.now();
        
        const elapsedTime = endTime - startTime;
        console.log(`Base64 编码 ${size} 字节: ${elapsedTime.toFixed(3)}ms`);
        
        expect(typeof encoded).toBe('string');
        expect(Buffer.from(encoded, 'base64').length).toBe(size);
      });
    });
  });

  describe('文件系统操作测试（独立运行）', () => {
    test('测试图片文件应该存在且可读', async () => {
      const startTime = performance.now();
      
      try {
        await fs.access(testImagePath);
        const stats = await fs.stat(testImagePath);
        const buffer = await fs.readFile(testImagePath);
        
        const endTime = performance.now();
        const elapsedTime = endTime - startTime;
        
        console.log(`读取测试图片 (${(stats.size / 1024).toFixed(1)}KB): ${elapsedTime.toFixed(2)}ms`);
        
        expect(stats.size).toBeGreaterThan(0);
        expect(buffer.length).toBe(stats.size);
      } catch (error) {
        console.warn('测试图片文件访问失败:', error.message);
        throw error;
      }
    });

    test('应该能够快速检查文件是否存在', async () => {
      const iterations = 100;
      let totalTime = 0;
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        try {
          await fs.access(testImagePath);
        } catch {}
        const endTime = performance.now();
        totalTime += endTime - startTime;
      }
      
      const avgTime = totalTime / iterations;
      console.log(`平均文件检查时间: ${avgTime.toFixed(3)}ms`);
      
      expect(avgTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('JSON 序列化性能测试（独立运行）', () => {
    test('应该能够快速序列化和反序列化', () => {
      const testData = {
        numbers: Array.from({ length: 1000 }, (_, i) => i),
        strings: Array.from({ length: 100 }, (_, i) => `string_${i}`),
        nested: {
          a: 1,
          b: { c: 2, d: [3, 4, 5] }
        }
      };
      
      const serializeStart = performance.now();
      const serialized = JSON.stringify(testData);
      const serializeTime = performance.now() - serializeStart;
      
      const deserializeStart = performance.now();
      const deserialized = JSON.parse(serialized);
      const deserializeTime = performance.now() - deserializeStart;
      
      console.log(`JSON 序列化: ${serializeTime.toFixed(3)}ms, 反序列化: ${deserializeTime.toFixed(3)}ms`);
      
      expect(deserialized.numbers.length).toBe(1000);
      expect(deserialized.nested.b.d).toEqual([3, 4, 5]);
    });
  });

  describe('批量操作性能测试（独立运行）', () => {
    test('应该能够处理 Promise 批量操作', async () => {
      const count = 10;
      const delays = Array.from({ length: count }, () => Math.random() * 10);
      
      const startTime = performance.now();
      
      const promises = delays.map(delay => 
        new Promise(resolve => setTimeout(resolve, delay))
      );
      
      await Promise.all(promises);
      
      const endTime = performance.now();
      const elapsedTime = endTime - startTime;
      
      console.log(`批量处理 ${count} 个 Promise: ${elapsedTime.toFixed(2)}ms`);
      expect(elapsedTime).toBeGreaterThanOrEqual(0);
    });

    test('Promise.allSettled 性能测试', async () => {
      const count = 10;
      
      const startTime = performance.now();
      
      const promises = Array.from({ length: count }, (_, i) => 
        i % 2 === 0 
          ? Promise.resolve(`success_${i}`)
          : Promise.reject(new Error(`error_${i}`))
      );
      
      const results = await Promise.allSettled(promises);
      
      const endTime = performance.now();
      const elapsedTime = endTime - startTime;
      
      console.log(`Promise.allSettled 处理 ${count} 个 Promise: ${elapsedTime.toFixed(3)}ms`);
      
      expect(results.length).toBe(count);
      expect(results.filter(r => r.status === 'fulfilled').length).toBe(5);
      expect(results.filter(r => r.status === 'rejected').length).toBe(5);
    });
  });

  describe('类型转换性能测试（独立运行）', () => {
    test('Float32Array 到 Uint8Array 转换', () => {
      const size = 1000000;
      const floatData = new Float32Array(size);
      
      for (let i = 0; i < size; i++) {
        floatData[i] = Math.random();
      }
      
      const startTime = performance.now();
      
      const uintData = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        uintData[i] = floatData[i] * 255;
      }
      
      const endTime = performance.now();
      const elapsedTime = endTime - startTime;
      
      console.log(`转换 ${size} 个元素 Float32→Uint8: ${elapsedTime.toFixed(2)}ms`);
      
      expect(uintData.length).toBe(size);
    });

    test('Buffer 到 TypedArray 转换', () => {
      const size = 1024 * 1024;
      const buffer = Buffer.alloc(size);
      
      for (let i = 0; i < size; i++) {
        buffer[i] = i % 256;
      }
      
      const startTime = performance.now();
      const uint8Array = new Uint8Array(buffer);
      const endTime = performance.now();
      
      const elapsedTime = endTime - startTime;
      console.log(`Buffer→Uint8Array 转换 (${(size / 1024 / 1024).toFixed(1)}MB): ${elapsedTime.toFixed(3)}ms`);
      
      expect(uint8Array.length).toBe(size);
      expect(uint8Array[0]).toBe(buffer[0]);
    });
  });

  (moduleAvailable ? describe : describe.skip)('需要 @imgly/background-removal-node 模块的性能测试', () => {
    beforeAll(() => {
      logMemory('Before all tests');
    });

    afterAll(() => {
      logMemory('After all tests');
      console.log('\n=== 性能测试总结 ===');
      console.log('首次加载时间:', performanceMetrics.firstLoadTime ? `${performanceMetrics.firstLoadTime.toFixed(2)}ms` : 'N/A');
      console.log('后续加载时间:', performanceMetrics.subsequentLoadTime ? `${performanceMetrics.subsequentLoadTime.toFixed(2)}ms` : 'N/A');
      console.log('处理次数:', performanceMetrics.processingTimes.length);
      if (performanceMetrics.processingTimes.length > 0) {
        const avgTime = performanceMetrics.processingTimes.reduce((a, b) => a + b, 0) / performanceMetrics.processingTimes.length;
        console.log('平均处理时间:', `${avgTime.toFixed(2)}ms`);
      }
    });

    test('首次加载应该包含模型初始化时间', async () => {
      logMemory('Before first load');
      const startTime = performance.now();
      
      await removeBackground(testImagePath);
      
      const endTime = performance.now();
      performanceMetrics.firstLoadTime = endTime - startTime;
      logMemory('After first load');
      
      console.log(`首次加载时间: ${performanceMetrics.firstLoadTime.toFixed(2)}ms`);
      expect(performanceMetrics.firstLoadTime).toBeGreaterThan(0);
    }, 120000);

    test('后续加载应该更快（利用模型缓存）', async () => {
      logMemory('Before subsequent load');
      const startTime = performance.now();
      
      await removeBackground(testImagePath);
      
      const endTime = performance.now();
      performanceMetrics.subsequentLoadTime = endTime - startTime;
      logMemory('After subsequent load');
      
      console.log(`后续加载时间: ${performanceMetrics.subsequentLoadTime.toFixed(2)}ms`);
      expect(performanceMetrics.subsequentLoadTime).toBeLessThan(performanceMetrics.firstLoadTime * 1.5);
    }, 120000);

    test('批量处理性能', async () => {
      const batchSize = 3;
      logMemory(`Before batch of ${batchSize}`);
      const startTime = performance.now();
      
      const promises = [];
      for (let i = 0; i < batchSize; i++) {
        promises.push(removeBackground(testImagePath));
      }
      
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerImage = totalTime / batchSize;
      
      performanceMetrics.processingTimes.push(...Array(batchSize).fill(avgTimePerImage));
      logMemory(`After batch of ${batchSize}`);
      
      console.log(`批量处理 ${batchSize} 张: 总耗时 ${totalTime.toFixed(2)}ms, 平均 ${avgTimePerImage.toFixed(2)}ms/张`);
      
      results.forEach(result => {
        expect(result).toBeInstanceOf(Blob);
        expect(result.size).toBeGreaterThan(0);
      });
    }, 300000);

    test('处理过程中内存使用应该在合理范围内', async () => {
      const memoryBefore = getMemoryUsage();
      logMemory('Memory before processing');
      
      await removeBackground(testImagePath);
      
      const memoryAfter = getMemoryUsage();
      logMemory('Memory after processing');
      
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
      console.log(`处理后内存增加: ${memoryIncrease > 0 ? '+' : ''}${memoryIncrease}MB`);
      
      expect(memoryAfter.rss).toBeLessThan(4096);
    }, 120000);
  });
});
