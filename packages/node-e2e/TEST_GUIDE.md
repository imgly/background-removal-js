# Background Removal 自动化测试用例

## 测试套件概述

本测试套件为 @imgly/background-removal-js 项目提供了全面的自动化测试，覆盖以下方面：

1. **单元测试** - 核心工具函数测试
2. **集成测试** - 完整流程测试
3. **性能测试** - 大图片、批量处理测试
4. **异常处理测试** - 各种错误场景的容错处理
5. **跨浏览器测试** - Chrome、Firefox、Safari 浏览器兼容性测试

## 测试文件结构

```
packages/node-e2e/
├── src/
│   ├── unit/
│   │   ├── utils.test.js          # 核心工具函数单元测试
│   │   └── config.test.js         # 配置验证测试
│   ├── integration/
│   │   └── integration.test.js    # 完整流程集成测试
│   ├── performance/
│   │   └── performance.test.js    # 性能测试
│   ├── error/
│   │   └── error.test.js          # 异常处理测试
│   └── browser/
│       ├── browser.test.js        # Playwright 跨浏览器测试
│       └── test-page.html         # 浏览器测试页面
├── jest.config.js                  # Jest 配置
├── playwright.config.js            # Playwright 配置
└── package.json                    # 依赖和脚本
```

## 测试用例详情

### 1. 单元测试 (utils.test.js)

**测试内容：**

#### tensorResizeBilinear - 双线性插值缩放
- 测试图像放大和缩小
- 测试像素值范围保持 (0-255)
- 测试不同尺寸的输入输出

#### tensorHWCtoBCHW - 张量格式转换
- 测试 HWC (Height, Width, Channels) 到 BCHW (Batch, Channels, Height, Width) 格式转换
- 测试像素归一化
- 测试自定义 mean 和 std 参数

#### convertFloat32ToUint8 - 类型转换
- 测试 Float32 到 Uint8 的正确转换
- 测试张量形状保持

#### calculateProportionalSize - 比例计算
- 测试按比例缩小尺寸
- 测试原始尺寸小于最大尺寸的情况
- 测试不同宽高比的处理

#### 图像过滤器函数
- `applyContrast` - 对比度调整
- `applyThreshold` - 阈值处理
- `applyBoxBlur` - 方框模糊
- `applyGaussianBlur` - 高斯模糊
- `applyErosion` - 腐蚀操作
- `applyDilation` - 膨胀操作
- `applyEdgeMode` - 边缘模式处理

#### createCheckerboardBackground - 棋盘格背景
- 测试创建正确尺寸的背景
- 测试颜色交替模式

#### composeImageWithBackground - 图像合成
- 测试纯色背景合成
- 测试图像背景合成
- 测试 alpha 通道混合

### 2. 配置验证测试 (config.test.js)

**测试内容：**

#### 基础配置验证
- 默认配置测试
- 有效配置验证
- 模型别名测试 (large/small/medium → isnet/isnet_quint8/isnet_fp16)

#### 输出配置
- 输出格式验证 (image/png, image/jpeg, image/webp, image/x-rgba8, image/x-alpha8)
- 无效格式拒绝
- 质量设置验证

#### 路径配置
- publicPath 必须是有效 URI
- 无效路径拒绝

#### Web 特定配置
- device: cpu/gpu 验证
- rescale: true/false
- proxyToWorker: true/false
- mask 配置 (smoothness, feather, edgeMode, contrast, threshold)
- background 配置 (transparent, solid, image, checkerboard)

### 3. 集成测试 (integration.test.js)

**测试内容：**

#### removeBackground - 背景移除核心功能
- 本地图片文件处理
- 不同输出格式 (PNG/JPEG/WebP)
- 不同质量设置
- 进度回调支持
- 不同模型类型 (small/medium/large)

#### segmentForeground - 前景分割
- 基本分割功能
- alpha8 格式输出

#### removeForeground - 前景移除
- 前景移除功能测试

#### applySegmentationMask - 应用分割掩码
- 掩码应用到图片

#### 图片源类型支持
- Buffer
- Uint8Array
- 文件路径字符串

#### 其他功能
- 调试模式
- 结果保存到文件
- alpha 通道信息验证
- 模型缓存测试

### 4. 性能测试 (performance.test.js)

**测试内容：**

#### 首次加载 vs 后续加载
- 首次加载时间（包含模型初始化）
- 后续加载时间（利用模型缓存）
- 性能提升百分比计算

#### 批量处理性能
- 不同批次大小 (1/3/5 张图片)
- 顺序处理 vs 并行处理对比
- 平均处理时间计算

#### 不同模型性能对比
- small vs medium 模型
- 处理时间 vs 输出大小
- 质量/性能权衡

#### 内存占用监控
- 处理前后内存使用对比
- 多次处理后内存趋势
- 内存使用合理性验证

#### 不同输出格式性能
- PNG/JPEG/WebP 格式对比
- 不同质量设置的影响
- 输出大小 vs 处理时间

### 5. 异常处理测试 (error.test.js)

**测试内容：**

#### 配置异常
- 无效模型名称
- 无效输出格式
- 无效 publicPath
- 无效 mask 配置（边界值）
- 无效 background 配置

#### 图片源异常
- 不存在的文件路径
- 空数据
- 无效图片格式
- null/undefined 输入
- 空字符串路径

#### 模型加载异常
- 无效 publicPath
- resources.json 不存在

#### 网络异常模拟
- 网络错误 (ECONNRESET)
- 404 响应
- 500 服务器错误
- 请求超时

#### 参数类型异常
- 数字类型图片源
- 对象类型（非 Blob/Buffer）
- 数组类型

#### 并发处理异常
- 多个并发请求中的失败处理
- Promise.allSettled 行为验证

#### 错误信息验证
- 错误消息的有意义性
- 配置验证错误的具体信息

#### 边界情况
- 极小图片处理
- 单通道图片

#### 内存异常处理
- 处理后资源清理
- 内存增长控制

### 6. 跨浏览器测试 (browser.test.js)

**测试内容（Chrome/Firefox/Safari）：**

#### 页面加载
- 测试页面正确加载
- API 可用验证

#### 模型预加载
- preload 功能测试
- 预加载时间测量

#### 背景移除功能
- 基本背景移除
- 输出格式验证
- 处理时间测量

#### 输出格式支持
- PNG/JPEG/WebP 格式
- 不同格式输出大小对比

#### 进度回调
- 进度事件触发
- 进度数据正确性

#### 多次调用缓存
- 首次调用 vs 后续调用
- 缓存带来的性能提升

#### 其他 API 功能
- segmentForeground 功能
- CPU 设备配置

#### 高级配置
- mask 配置 (smoothness, feather, edgeMode, threshold)
- background 配置 (transparent, solid, checkerboard)

#### 浏览器能力
- OffscreenCanvas 支持
- WebGL/WebGPU 支持
- 硬件并发数

## 运行测试

### 前置要求

1. Node.js >= 16.x
2. pnpm 包管理器
3. 项目已构建 (`pnpm run build`)

### 安装依赖

```bash
cd packages/node-e2e
pnpm install
```

### 运行所有测试

```bash
# 运行所有 Node.js 测试
pnpm run test

# 运行单元测试
pnpm run test:unit

# 运行集成测试
pnpm run test:integration

# 运行性能测试
pnpm run test:performance

# 运行异常处理测试
pnpm run test:error

# 运行 CI 友好的测试
pnpm run test:ci
```

### 运行跨浏览器测试

```bash
# 安装 Playwright 浏览器
pnpm run playwright:install

# 运行浏览器测试
pnpm run test:browser
```

### 测试配置

#### Jest 配置 (jest.config.js)
- 测试环境: Node.js
- 超时: 300 秒
- 单工作器运行（避免内存竞争）
- HTML 报告输出

#### Playwright 配置 (playwright.config.js)
- 浏览器: Chromium, Firefox, WebKit
- 截图: 仅失败时
- 视频: 失败时保留
- 自动启动本地测试服务器

## 性能测试指标

性能测试会收集以下指标：

1. **处理时间**
   - 首次加载时间（模型初始化）
   - 后续加载时间（缓存命中）
   - 平均每张图片处理时间
   - 批量处理总时间

2. **内存使用**
   - RSS (Resident Set Size)
   - Heap Total
   - Heap Used
   - External Memory

3. **输出质量**
   - 输出文件大小
   - 不同格式对比

## 注意事项

1. **模型加载**: 首次运行测试需要下载/加载模型，可能需要较长时间
2. **网络连接**: 部分测试需要网络连接来获取资源
3. **内存**: 性能测试会监控内存使用，建议在有足够内存的机器上运行
4. **超时**: 集成测试和性能测试有较长的超时时间，正常运行不会触发
5. **浏览器测试**: 需要先安装 Playwright 浏览器

## 测试结果分析

### 通过标准

- **单元测试**: 全部通过
- **集成测试**: 全部通过（验证核心功能）
- **性能测试**:
  - 后续加载时间 < 首次加载时间 * 1.5
  - 多次处理后内存增长 < 500MB
- **异常测试**: 全部通过（验证错误处理）
- **浏览器测试**: 全部通过（验证跨浏览器兼容性）

### 失败分析

如果测试失败，检查以下方面：

1. **环境问题**: Node.js 版本、依赖安装、网络连接
2. **模型问题**: 模型文件是否存在、publicPath 配置是否正确
3. **资源问题**: 内存不足、磁盘空间不足
4. **超时问题**: 测试机器性能较慢，考虑增加超时时间

## CI/CD 集成

测试套件设计为 CI/CD 友好：

```bash
# CI 环境运行
pnpm run test:ci
```

- 单工作器运行，避免并发问题
- 合理的超时设置
- 结构化的测试报告
