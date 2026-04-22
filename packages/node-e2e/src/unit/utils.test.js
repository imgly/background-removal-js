const ndarray = require('ndarray');

describe('核心工具函数测试', () => {
  describe('tensorResizeBilinear - 双线性插值缩放', () => {
    test('应该正确缩放图像尺寸', () => {
      const width = 4;
      const height = 4;
      const channels = 4;
      const data = new Uint8Array(width * height * channels);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.floor(Math.random() * 256);
      }
      const tensor = ndarray(data, [height, width, channels]);
      
      const newWidth = 8;
      const newHeight = 8;
      const resized = tensorResizeBilinear(tensor, newWidth, newHeight);
      
      expect(resized.shape).toEqual([newHeight, newWidth, channels]);
      expect(resized.data.length).toBe(newWidth * newHeight * channels);
    });

    test('应该正确缩小图像', () => {
      const width = 8;
      const height = 8;
      const channels = 4;
      const data = new Uint8Array(width * height * channels);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.floor(Math.random() * 256);
      }
      const tensor = ndarray(data, [height, width, channels]);
      
      const newWidth = 4;
      const newHeight = 4;
      const resized = tensorResizeBilinear(tensor, newWidth, newHeight);
      
      expect(resized.shape).toEqual([newHeight, newWidth, channels]);
    });

    test('应该保持像素值在合理范围内', () => {
      const width = 2;
      const height = 2;
      const channels = 4;
      const data = new Uint8Array([
        255, 0, 0, 255,
        0, 255, 0, 255,
        0, 0, 255, 255,
        255, 255, 0, 255
      ]);
      const tensor = ndarray(data, [height, width, channels]);
      
      const resized = tensorResizeBilinear(tensor, 4, 4);
      
      for (let i = 0; i < resized.data.length; i++) {
        expect(resized.data[i]).toBeGreaterThanOrEqual(0);
        expect(resized.data[i]).toBeLessThanOrEqual(255);
      }
    });
  });

  describe('tensorHWCtoBCHW - 张量格式转换', () => {
    test('应该正确转换 HWC 到 BCHW 格式', () => {
      const width = 2;
      const height = 2;
      const channels = 4;
      const data = new Uint8Array([
        128, 64, 32, 255,
        200, 150, 100, 255,
        50, 100, 150, 255,
        10, 20, 30, 255
      ]);
      const tensor = ndarray(data, [height, width, channels]);
      
      const result = tensorHWCtoBCHW(tensor);
      
      expect(result.shape).toEqual([1, 3, height, width]);
      expect(result.data instanceof Float32Array).toBe(true);
    });

    test('应该正确归一化像素值', () => {
      const width = 1;
      const height = 1;
      const channels = 4;
      const data = new Uint8Array([128, 128, 128, 255]);
      const tensor = ndarray(data, [height, width, channels]);
      
      const result = tensorHWCtoBCHW(tensor);
      
      const mean = [128, 128, 128];
      const std = [256, 256, 256];
      expect(result.data[0]).toBeCloseTo((128 - mean[0]) / std[0], 5);
      expect(result.data[1]).toBeCloseTo((128 - mean[1]) / std[1], 5);
      expect(result.data[2]).toBeCloseTo((128 - mean[2]) / std[2], 5);
    });

    test('应该使用自定义的 mean 和 std 参数', () => {
      const width = 1;
      const height = 1;
      const channels = 4;
      const data = new Uint8Array([100, 150, 200, 255]);
      const tensor = ndarray(data, [height, width, channels]);
      
      const customMean = [0, 0, 0];
      const customStd = [255, 255, 255];
      const result = tensorHWCtoBCHW(tensor, customMean, customStd);
      
      expect(result.data[0]).toBeCloseTo(100 / 255, 5);
      expect(result.data[1]).toBeCloseTo(150 / 255, 5);
      expect(result.data[2]).toBeCloseTo(200 / 255, 5);
    });
  });

  describe('convertFloat32ToUint8 - 类型转换', () => {
    test('应该正确转换 Float32 到 Uint8', () => {
      const data = new Float32Array([0.0, 0.5, 1.0, 0.25, 0.75]);
      const tensor = ndarray(data, [1, 5, 1]);
      
      const result = convertFloat32ToUint8(tensor);
      
      expect(result.data instanceof Uint8Array).toBe(true);
      expect(result.data[0]).toBe(0);
      expect(result.data[1]).toBe(127);
      expect(result.data[2]).toBe(255);
      expect(result.data[3]).toBe(63);
      expect(result.data[4]).toBe(191);
    });

    test('应该保持张量形状', () => {
      const data = new Float32Array([0.0, 0.5, 1.0, 0.25]);
      const tensor = ndarray(data, [2, 2, 1]);
      
      const result = convertFloat32ToUint8(tensor);
      
      expect(result.shape).toEqual([2, 2, 1]);
    });
  });

  describe('calculateProportionalSize - 比例计算', () => {
    test('应该按比例缩小尺寸', () => {
      const originalWidth = 1920;
      const originalHeight = 1080;
      const maxWidth = 1024;
      const maxHeight = 1024;
      
      const [newWidth, newHeight] = calculateProportionalSize(
        originalWidth, originalHeight, maxWidth, maxHeight
      );
      
      const aspectRatio = originalWidth / originalHeight;
      const newAspectRatio = newWidth / newHeight;
      
      expect(newWidth).toBeLessThanOrEqual(maxWidth);
      expect(newHeight).toBeLessThanOrEqual(maxHeight);
      expect(newAspectRatio).toBeCloseTo(aspectRatio, 5);
    });

    test('当原始尺寸小于最大尺寸时应该保持不变', () => {
      const originalWidth = 512;
      const originalHeight = 512;
      const maxWidth = 1024;
      const maxHeight = 1024;
      
      const [newWidth, newHeight] = calculateProportionalSize(
        originalWidth, originalHeight, maxWidth, maxHeight
      );
      
      expect(newWidth).toBeLessThanOrEqual(originalWidth);
      expect(newHeight).toBeLessThanOrEqual(originalHeight);
    });

    test('应该正确处理不同的宽高比', () => {
      const testCases = [
        { originalWidth: 100, originalHeight: 200, maxWidth: 50, maxHeight: 50 },
        { originalWidth: 200, originalHeight: 100, maxWidth: 50, maxHeight: 50 },
        { originalWidth: 1000, originalHeight: 500, maxWidth: 800, maxHeight: 600 },
      ];
      
      testCases.forEach(({ originalWidth, originalHeight, maxWidth, maxHeight }) => {
        const [newWidth, newHeight] = calculateProportionalSize(
          originalWidth, originalHeight, maxWidth, maxHeight
        );
        
        const aspectRatio = originalWidth / originalHeight;
        const newAspectRatio = newWidth / newHeight;
        
        expect(newWidth).toBeLessThanOrEqual(maxWidth);
        expect(newHeight).toBeLessThanOrEqual(maxHeight);
        expect(newAspectRatio).toBeCloseTo(aspectRatio, 5);
      });
    });
  });

  describe('图像过滤器函数', () => {
    test('applyContrast 应该正确调整对比度', () => {
      const width = 2;
      const height = 2;
      const channels = 1;
      const data = new Uint8Array([100, 128, 150, 200]);
      const tensor = ndarray(data, [height, width, channels]);
      
      const positiveContrast = applyContrast(tensor, 50);
      const negativeContrast = applyContrast(tensor, -50);
      
      for (let i = 0; i < positiveContrast.data.length; i++) {
        expect(positiveContrast.data[i]).toBeGreaterThanOrEqual(0);
        expect(positiveContrast.data[i]).toBeLessThanOrEqual(255);
        expect(negativeContrast.data[i]).toBeGreaterThanOrEqual(0);
        expect(negativeContrast.data[i]).toBeLessThanOrEqual(255);
      }
    });

    test('applyThreshold 应该正确应用阈值', () => {
      const width = 3;
      const height = 1;
      const channels = 1;
      const data = new Uint8Array([50, 128, 200]);
      const tensor = ndarray(data, [height, width, channels]);
      
      const result = applyThreshold(tensor, 100);
      
      expect(result.data[0]).toBe(0);
      expect(result.data[1]).toBe(255);
      expect(result.data[2]).toBe(255);
    });

    test('applyBoxBlur 应该正确应用模糊', () => {
      const width = 3;
      const height = 3;
      const channels = 1;
      const data = new Uint8Array([
        0, 0, 0,
        0, 255, 0,
        0, 0, 0
      ]);
      const tensor = ndarray(data, [height, width, channels]);
      
      const result = applyBoxBlur(tensor, 1);
      
      expect(result.data[4]).toBeLessThan(255);
      expect(result.data[4]).toBeGreaterThan(0);
    });

    test('applyGaussianBlur 应该正确应用高斯模糊', () => {
      const width = 3;
      const height = 3;
      const channels = 1;
      const data = new Uint8Array([
        0, 0, 0,
        0, 255, 0,
        0, 0, 0
      ]);
      const tensor = ndarray(data, [height, width, channels]);
      
      const result = applyGaussianBlur(tensor, 1);
      
      expect(result.data[4]).toBeLessThan(255);
      expect(result.data[4]).toBeGreaterThan(0);
    });

    test('applyErosion 应该正确应用腐蚀', () => {
      const width = 5;
      const height = 5;
      const channels = 1;
      const data = new Uint8Array(25).fill(255);
      data[12] = 0;
      const tensor = ndarray(data, [height, width, channels]);
      
      const result = applyErosion(tensor, 1);
      
      expect(result.data[12]).toBe(0);
    });

    test('applyDilation 应该正确应用膨胀', () => {
      const width = 5;
      const height = 5;
      const channels = 1;
      const data = new Uint8Array(25).fill(0);
      data[12] = 255;
      const tensor = ndarray(data, [height, width, channels]);
      
      const result = applyDilation(tensor, 1);
      
      expect(result.data[12]).toBe(255);
    });

    test('applyEdgeMode 应该正确应用边缘模式', () => {
      const width = 2;
      const height = 2;
      const channels = 1;
      const data = new Uint8Array([100, 150, 200, 50]);
      const tensor = ndarray(data, [height, width, channels]);
      
      const hardResult = applyEdgeMode(tensor, 'hard');
      const softResult = applyEdgeMode(tensor, 'soft');
      const blurResult = applyEdgeMode(tensor, 'blur');
      
      expect(hardResult.shape).toEqual(tensor.shape);
      expect(softResult.shape).toEqual(tensor.shape);
      expect(blurResult.shape).toEqual(tensor.shape);
    });
  });

  describe('createCheckerboardBackground - 棋盘格背景', () => {
    test('应该创建正确尺寸的棋盘格背景', () => {
      const width = 64;
      const height = 64;
      const tileSize = 16;
      
      const result = createCheckerboardBackground(width, height, tileSize);
      
      expect(result.shape).toEqual([height, width, 4]);
      expect(result.data.length).toBe(width * height * 4);
    });

    test('应该使用正确的颜色交替', () => {
      const width = 4;
      const height = 4;
      const tileSize = 2;
      const color1 = { r: 255, g: 255, b: 255 };
      const color2 = { r: 204, g: 204, b: 204 };
      
      const result = createCheckerboardBackground(width, height, tileSize, color1, color2);
      
      const idx00 = (0 * 4 + 0) * 4;
      expect(result.data[idx00]).toBe(color1.r);
      expect(result.data[idx00 + 1]).toBe(color1.g);
      expect(result.data[idx00 + 2]).toBe(color1.b);
      
      const idx02 = (0 * 4 + 2) * 4;
      expect(result.data[idx02]).toBe(color2.r);
      expect(result.data[idx02 + 1]).toBe(color2.g);
      expect(result.data[idx02 + 2]).toBe(color2.b);
      
      expect(result.data[idx00 + 3]).toBe(255);
    });
  });

  describe('composeImageWithBackground - 图像合成', () => {
    test('应该正确合成纯色背景', () => {
      const width = 2;
      const height = 2;
      const channels = 4;
      
      const fgData = new Uint8Array([
        255, 0, 0, 128,
        0, 255, 0, 255,
        0, 0, 255, 0,
        255, 255, 0, 64
      ]);
      const foreground = ndarray(fgData, [height, width, channels]);
      
      const bgColor = { r: 100, g: 100, b: 100 };
      
      const result = composeImageWithBackground(foreground, bgColor);
      
      expect(result.shape).toEqual([height, width, 4]);
      expect(result.data[3]).toBe(255);
      
      const idx1 = 4;
      const alpha1 = foreground.data[idx1 + 3] / 255;
      const invAlpha1 = 1 - alpha1;
      expect(result.data[idx1]).toBe(
        Math.round(foreground.data[idx1] * alpha1 + bgColor.r * invAlpha1)
      );
    });

    test('应该正确合成图像背景', () => {
      const width = 2;
      const height = 2;
      const channels = 4;
      
      const fgData = new Uint8Array([
        255, 0, 0, 128,
        0, 255, 0, 255,
        0, 0, 255, 0,
        255, 255, 0, 64
      ]);
      const foreground = ndarray(fgData, [height, width, channels]);
      
      const bgData = new Uint8Array([
        100, 100, 100, 255,
        150, 150, 150, 255,
        200, 200, 200, 255,
        50, 50, 50, 255
      ]);
      const background = ndarray(bgData, [height, width, channels]);
      
      const result = composeImageWithBackground(foreground, background);
      
      expect(result.shape).toEqual([height, width, 4]);
      
      const idx0 = 0;
      const alpha0 = foreground.data[idx0 + 3] / 255;
      const invAlpha0 = 1 - alpha0;
      expect(result.data[idx0]).toBe(
        Math.round(foreground.data[idx0] * alpha0 + background.data[idx0] * invAlpha0)
      );
    });
  });
});

function tensorResizeBilinear(imageTensor, newWidth, newHeight, proportional = false) {
  const [srcHeight, srcWidth, srcChannels] = imageTensor.shape;
  const srcData = imageTensor.data;

  let scaleX = srcWidth / newWidth;
  let scaleY = srcHeight / newHeight;

  if (proportional) {
    const downscaling = Math.max(scaleX, scaleY) > 1.0;
    scaleX = scaleY = downscaling
      ? Math.max(scaleX, scaleY)
      : Math.min(scaleX, scaleY);
  }

  const dstData = new Uint8Array(srcChannels * newWidth * newHeight);
  const srcStrideY = srcWidth * srcChannels;
  const srcStrideX = srcChannels;
  const dstStrideY = newWidth * srcChannels;
  const dstStrideX = srcChannels;

  for (let y = 0; y < newHeight; y++) {
    const dstY = y * dstStrideY;
    const srcYf = y * scaleY;
    const srcY1 = Math.max(Math.floor(srcYf), 0);
    const srcY2 = Math.min(Math.ceil(srcYf), srcHeight - 1);
    const dy = srcYf - srcY1;
    const srcY1Idx = srcY1 * srcStrideY;
    const srcY2Idx = srcY2 * srcStrideY;

    for (let x = 0; x < newWidth; x++) {
      const dstIdx = dstY + x * dstStrideX;
      const srcXf = x * scaleX;
      const srcX1 = Math.max(Math.floor(srcXf), 0);
      const srcX2 = Math.min(Math.ceil(srcXf), srcWidth - 1);
      const dx = srcXf - srcX1;
      const srcX1Idx = srcX1 * srcStrideX;
      const srcX2Idx = srcX2 * srcStrideX;

      for (let c = 0; c < srcChannels; c++) {
        const p1 = srcData[srcY1Idx + srcX1Idx + c];
        const p2 = srcData[srcY1Idx + srcX2Idx + c];
        const p3 = srcData[srcY2Idx + srcX1Idx + c];
        const p4 = srcData[srcY2Idx + srcX2Idx + c];

        const interpolatedValue =
          (1 - dx) * (1 - dy) * p1 +
          dx * (1 - dy) * p2 +
          (1 - dx) * dy * p3 +
          dx * dy * p4;

        dstData[dstIdx + c] = Math.round(interpolatedValue);
      }
    }
  }

  return ndarray(dstData, [newHeight, newWidth, srcChannels]);
}

function tensorHWCtoBCHW(imageTensor, mean = [128, 128, 128], std = [256, 256, 256]) {
  const imageBufferData = imageTensor.data;
  const [srcHeight, srcWidth, srcChannels] = imageTensor.shape;
  const stride = srcHeight * srcWidth;
  const float32Data = new Float32Array(3 * stride);

  for (let i = 0, j = 0; i < imageBufferData.length; i += 4, j += 1) {
    float32Data[j] = (imageBufferData[i] - mean[0]) / std[0];
    float32Data[j + stride] = (imageBufferData[i + 1] - mean[1]) / std[1];
    float32Data[j + stride + stride] =
      (imageBufferData[i + 2] - mean[2]) / std[2];
  }

  return ndarray(float32Data, [1, 3, srcHeight, srcWidth]);
}

function convertFloat32ToUint8(float32Array) {
  const uint8Array = new Uint8Array(float32Array.data.length);
  for (let i = 0; i < float32Array.data.length; i++) {
    uint8Array[i] = Math.round(float32Array.data[i] * 255);
  }
  return ndarray(uint8Array, float32Array.shape);
}

function calculateProportionalSize(originalWidth, originalHeight, maxWidth, maxHeight) {
  const widthRatio = maxWidth / originalWidth;
  const heightRatio = maxHeight / originalHeight;
  const scalingFactor = Math.min(widthRatio, heightRatio);
  const newWidth = Math.floor(originalWidth * scalingFactor);
  const newHeight = Math.floor(originalHeight * scalingFactor);
  return [newWidth, newHeight];
}

function applyContrast(imageTensor, contrast) {
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const [height, width, channels] = imageTensor.shape;
  const dstData = new Uint8Array(height * width * channels);

  for (let i = 0; i < height * width * channels; i++) {
    const val = imageTensor.data[i];
    const adjusted = factor * (val - 128) + 128;
    dstData[i] = Math.max(0, Math.min(255, Math.round(adjusted)));
  }

  return ndarray(dstData, [height, width, channels]);
}

function applyThreshold(imageTensor, threshold) {
  const [height, width, channels] = imageTensor.shape;
  const dstData = new Uint8Array(height * width * channels);

  for (let i = 0; i < height * width * channels; i++) {
    dstData[i] = imageTensor.data[i] >= threshold ? 255 : 0;
  }

  return ndarray(dstData, [height, width, channels]);
}

function applyBoxBlur(imageTensor, radius) {
  if (radius <= 0) return imageTensor;

  const [height, width, channels] = imageTensor.shape;
  const srcData = imageTensor.data;
  const dstData = new Uint8Array(height * width * channels);
  const tempData = new Uint8Array(height * width * channels);
  const kernelSize = radius * 2 + 1;

  for (let y = 0; y < height; y++) {
    for (let c = 0; c < channels; c++) {
      let sum = 0;
      for (let x = -radius; x <= radius; x++) {
        const px = Math.max(0, Math.min(width - 1, x));
        sum += srcData[y * width * channels + px * channels + c];
      }

      for (let x = 0; x < width; x++) {
        tempData[y * width * channels + x * channels + c] = Math.round(sum / kernelSize);

        const removeX = Math.max(0, x - radius);
        const addX = Math.min(width - 1, x + radius + 1);
        sum -= srcData[y * width * channels + removeX * channels + c];
        sum += srcData[y * width * channels + addX * channels + c];
      }
    }
  }

  for (let x = 0; x < width; x++) {
    for (let c = 0; c < channels; c++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) {
        const py = Math.max(0, Math.min(height - 1, y));
        sum += tempData[py * width * channels + x * channels + c];
      }

      for (let y = 0; y < height; y++) {
        dstData[y * width * channels + x * channels + c] = Math.round(sum / kernelSize);

        const removeY = Math.max(0, y - radius);
        const addY = Math.min(height - 1, y + radius + 1);
        sum -= tempData[removeY * width * channels + x * channels + c];
        sum += tempData[addY * width * channels + x * channels + c];
      }
    }
  }

  return ndarray(dstData, [height, width, channels]);
}

function createGaussianKernel(sigma, radius) {
  const kernelSize = radius * 2 + 1;
  const kernel = new Array(kernelSize);
  let sum = 0;

  for (let i = 0; i < kernelSize; i++) {
    const x = i - radius;
    const exponent = -(x * x) / (2 * sigma * sigma);
    kernel[i] = Math.exp(exponent);
    sum += kernel[i];
  }

  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

function applyGaussianBlur(imageTensor, sigma) {
  if (sigma <= 0) return imageTensor;

  const radius = Math.ceil(sigma * 3);
  const kernel = createGaussianKernel(sigma, radius);
  const [height, width, channels] = imageTensor.shape;
  const srcData = imageTensor.data;
  const dstData = new Uint8Array(height * width * channels);
  const tempData = new Uint8Array(height * width * channels);

  for (let y = 0; y < height; y++) {
    for (let c = 0; c < channels; c++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const px = Math.max(0, Math.min(width - 1, x + k));
          sum += srcData[y * width * channels + px * channels + c] * kernel[k + radius];
        }
        tempData[y * width * channels + x * channels + c] = Math.round(sum);
      }
    }
  }

  for (let x = 0; x < width; x++) {
    for (let c = 0; c < channels; c++) {
      for (let y = 0; y < height; y++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const py = Math.max(0, Math.min(height - 1, y + k));
          sum += tempData[py * width * channels + x * channels + c] * kernel[k + radius];
        }
        dstData[y * width * channels + x * channels + c] = Math.round(sum);
      }
    }
  }

  return ndarray(dstData, [height, width, channels]);
}

function applyErosion(imageTensor, radius) {
  if (radius <= 0) return imageTensor;

  const [height, width, channels] = imageTensor.shape;
  const srcData = imageTensor.data;
  const dstData = new Uint8Array(height * width * channels);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < channels; c++) {
        let minVal = 255;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const ny = Math.max(0, Math.min(height - 1, y + dy));
            const nx = Math.max(0, Math.min(width - 1, x + dx));
            const val = srcData[ny * width * channels + nx * channels + c];
            minVal = Math.min(minVal, val);
          }
        }

        dstData[y * width * channels + x * channels + c] = minVal;
      }
    }
  }

  return ndarray(dstData, [height, width, channels]);
}

function applyDilation(imageTensor, radius) {
  if (radius <= 0) return imageTensor;

  const [height, width, channels] = imageTensor.shape;
  const srcData = imageTensor.data;
  const dstData = new Uint8Array(height * width * channels);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < channels; c++) {
        let maxVal = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const ny = Math.max(0, Math.min(height - 1, y + dy));
            const nx = Math.max(0, Math.min(width - 1, x + dx));
            const val = srcData[ny * width * channels + nx * channels + c];
            maxVal = Math.max(maxVal, val);
          }
        }

        dstData[y * width * channels + x * channels + c] = maxVal;
      }
    }
  }

  return ndarray(dstData, [height, width, channels]);
}

function applyEdgeMode(mask, edgeMode) {
  switch (edgeMode) {
    case 'hard':
      return applyThreshold(mask, 128);
    case 'soft':
      return applyContrast(mask, 50);
    case 'blur':
      return applyGaussianBlur(mask, 2);
    case 'auto':
    default:
      return mask;
  }
}

function createCheckerboardBackground(width, height, tileSize = 16, color1 = { r: 255, g: 255, b: 255 }, color2 = { r: 204, g: 204, b: 204 }) {
  const data = new Uint8Array(height * width * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const tileX = Math.floor(x / tileSize);
      const tileY = Math.floor(y / tileSize);
      const isLight = (tileX + tileY) % 2 === 0;

      if (isLight) {
        data[idx] = color1.r;
        data[idx + 1] = color1.g;
        data[idx + 2] = color1.b;
      } else {
        data[idx] = color2.r;
        data[idx + 1] = color2.g;
        data[idx + 2] = color2.b;
      }
      data[idx + 3] = 255;
    }
  }

  return ndarray(data, [height, width, 4]);
}

function composeImageWithBackground(foreground, background) {
  const [fgHeight, fgWidth, fgChannels] = foreground.shape;
  const result = ndarray(new Uint8Array(fgHeight * fgWidth * 4), [fgHeight, fgWidth, 4]);

  if ('r' in background) {
    const bgColor = background;
    for (let y = 0; y < fgHeight; y++) {
      for (let x = 0; x < fgWidth; x++) {
        const idx = (y * fgWidth + x) * 4;
        const alpha = foreground.data[idx + 3] / 255;
        const invAlpha = 1 - alpha;

        result.data[idx] = Math.round(foreground.data[idx] * alpha + bgColor.r * invAlpha);
        result.data[idx + 1] = Math.round(foreground.data[idx + 1] * alpha + bgColor.g * invAlpha);
        result.data[idx + 2] = Math.round(foreground.data[idx + 2] * alpha + bgColor.b * invAlpha);
        result.data[idx + 3] = 255;
      }
    }
  } else {
    const bg = background;
    const [bgHeight, bgWidth] = bg.shape;
    
    for (let y = 0; y < fgHeight; y++) {
      for (let x = 0; x < fgWidth; x++) {
        const idx = (y * fgWidth + x) * 4;
        const bgX = Math.floor(x * (bgWidth / fgWidth));
        const bgY = Math.floor(y * (bgHeight / fgHeight));
        const bgIdx = (bgY * bgWidth + bgX) * 4;
        
        const alpha = foreground.data[idx + 3] / 255;
        const invAlpha = 1 - alpha;

        result.data[idx] = Math.round(foreground.data[idx] * alpha + bg.data[bgIdx] * invAlpha);
        result.data[idx + 1] = Math.round(foreground.data[idx + 1] * alpha + bg.data[bgIdx + 1] * invAlpha);
        result.data[idx + 2] = Math.round(foreground.data[idx + 2] * alpha + bg.data[bgIdx + 2] * invAlpha);
        result.data[idx + 3] = 255;
      }
    }
  }

  return result;
}
