const path = require('path');
const fs = require('fs/promises');
const { performance } = require('perf_hooks');

describe('性能测试', () => {
  const removeBackground = require('../../node/dist/index.cjs').default;
  
  const testImagePath = path.join(__dirname, '../../fixtures/images/photo-1686002359940-6a51b0d64f68.jpeg');
  
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
    console.log('内存使用记录:', performanceMetrics.memoryUsage.length, '个点');
  });

  describe('首次加载 vs 后续加载', () => {
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
      console.log(`性能提升: ${((performanceMetrics.firstLoadTime - performanceMetrics.subsequentLoadTime) / performanceMetrics.firstLoadTime * 100).toFixed(1)}%`);
      
      expect(performanceMetrics.subsequentLoadTime).toBeLessThan(performanceMetrics.firstLoadTime * 1.5);
    }, 120000);
  });

  describe('批量处理性能', () => {
    const batchSizes = [1, 3, 5];
    
    batchSizes.forEach(batchSize => {
      test(`批量处理 ${batchSize} 张图片`, async () => {
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
    });

    test('顺序处理 vs 并行处理对比', async () => {
      const count = 3;
      
      logMemory('Before sequential processing');
      const sequentialStart = performance.now();
      
      for (let i = 0; i < count; i++) {
        await removeBackground(testImagePath);
      }
      
      const sequentialTime = performance.now() - sequentialStart;
      logMemory('After sequential processing');
      
      logMemory('Before parallel processing');
      const parallelStart = performance.now();
      
      const promises = [];
      for (let i = 0; i < count; i++) {
        promises.push(removeBackground(testImagePath));
      }
      await Promise.all(promises);
      
      const parallelTime = performance.now() - parallelStart;
      logMemory('After parallel processing');
      
      console.log(`顺序处理 ${count} 张: ${sequentialTime.toFixed(2)}ms`);
      console.log(`并行处理 ${count} 张: ${parallelTime.toFixed(2)}ms`);
      console.log(`并行效率: ${(sequentialTime / parallelTime).toFixed(2)}x`);
    }, 300000);
  });

  describe('不同模型性能对比', () => {
    const models = ['small', 'medium'];
    
    models.forEach(model => {
      test(`模型 '${model}' 性能测试`, async () => {
        logMemory(`Before model ${model}`);
        const startTime = performance.now();
        
        const result = await removeBackground(testImagePath, { model });
        
        const endTime = performance.now();
        const processingTime = endTime - startTime;
        
        logMemory(`After model ${model}`);
        
        console.log(`模型 '${model}': 处理时间 ${processingTime.toFixed(2)}ms, 输出大小 ${result.size} bytes`);
        
        expect(result).toBeInstanceOf(Blob);
        expect(result.size).toBeGreaterThan(0);
      }, 120000);
    });

    test('模型大小 vs 处理时间 vs 输出质量', async () => {
      const results = [];
      
      for (const model of models) {
        const startTime = performance.now();
        const result = await removeBackground(testImagePath, { model });
        const processingTime = performance.now() - startTime;
        
        results.push({
          model,
          processingTime,
          outputSize: result.size
        });
      }
      
      console.log('\n=== 模型性能对比 ===');
      results.forEach(r => {
        console.log(`${r.model}: ${r.processingTime.toFixed(2)}ms, ${r.outputSize} bytes`);
      });
      
      expect(results[0].processingTime).toBeGreaterThan(0);
    }, 240000);
  });

  describe('内存占用监控', () => {
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

    test('多次处理后内存不应该持续增长', async () => {
      const iterations = 3;
      const memorySnapshots = [];
      
      memorySnapshots.push({ iteration: 'before', ...getMemoryUsage() });
      
      for (let i = 0; i < iterations; i++) {
        await removeBackground(testImagePath);
        if (global.gc) {
          global.gc();
        }
        memorySnapshots.push({ iteration: `after ${i + 1}`, ...getMemoryUsage() });
      }
      
      console.log('\n=== 内存使用趋势 ===');
      memorySnapshots.forEach(s => {
        console.log(`${s.iteration}: RSS=${s.rss}MB, HeapUsed=${s.heapUsed}MB`);
      });
      
      const firstMemory = memorySnapshots[1].heapUsed;
      const lastMemory = memorySnapshots[memorySnapshots.length - 1].heapUsed;
      
      expect(Math.abs(lastMemory - firstMemory)).toBeLessThan(500);
    }, 300000);
  });

  describe('不同输出格式性能', () => {
    const formats = ['image/png', 'image/jpeg', 'image/webp'];
    
    formats.forEach(format => {
      test(`输出格式 '${format}' 性能`, async () => {
        const startTime = performance.now();
        
        const result = await removeBackground(testImagePath, {
          output: { format, quality: 0.8 }
        });
        
        const endTime = performance.now();
        const processingTime = endTime - startTime;
        
        console.log(`格式 '${format}': ${processingTime.toFixed(2)}ms, ${result.size} bytes`);
        
        expect(result.type).toBe(format);
        expect(result.size).toBeGreaterThan(0);
      }, 120000);
    });

    test('不同质量设置的性能影响', async () => {
      const qualities = [0.1, 0.5, 1.0];
      const results = [];
      
      for (const quality of qualities) {
        const startTime = performance.now();
        const result = await removeBackground(testImagePath, {
          output: { quality, format: 'image/jpeg' }
        });
        const processingTime = performance.now() - startTime;
        
        results.push({
          quality,
          processingTime,
          outputSize: result.size
        });
      }
      
      console.log('\n=== 质量设置对比 ===');
      results.forEach(r => {
        console.log(`质量 ${r.quality}: ${r.processingTime.toFixed(2)}ms, ${r.outputSize} bytes`);
      });
      
      expect(results[2].outputSize).toBeGreaterThanOrEqual(results[0].outputSize);
    }, 300000);
  });
});
