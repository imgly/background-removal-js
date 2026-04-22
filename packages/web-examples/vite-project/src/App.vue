<script lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { preload, Config, processMask, composeWithBackground, getSegmentationMask, MaskConfig, BackgroundConfig } from '@imgly/background-removal';
import JSZip from 'jszip';
import ndarray, { NdArray } from 'ndarray';

type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
type ToolMode = 'none' | 'erase' | 'restore' | 'move';
type BackgroundType = 'transparent' | 'solid' | 'checkerboard' | 'preset';
type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp';

interface ImageTask {
  id: string;
  file: File;
  name: string;
  status: TaskStatus;
  progress: number;
  displayProgress: number;
  targetProgress: number;
  progressText: string;
  resultBlob: Blob | null;
  resultUrl: string | null;
  originalUrl: string | null;
  error: string | null;
  retryCount: number;
  processingTime: number;
  startTime: number;
  currentStage: string;
  stageStartTime: number;
  stageStartDisplay: number;
  lastApiUpdateTime: number;
  originalImageData: NdArray<Uint8Array> | null;
  segmentationMask: NdArray<Uint8Array> | null;
  currentMask: NdArray<Uint8Array> | null;
  maskCanvas: HTMLCanvasElement | null;
  previewUrl: string | null;
}

interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  estimatedTimeRemaining: number;
  averageTimePerTask: number;
}

interface BrushConfig {
  size: number;
  hardness: number;
  opacity: number;
}

interface MaskSettings {
  smoothness: number;
  feather: number;
  edgeMode: 'auto' | 'hard' | 'soft' | 'blur';
  contrast: number;
  threshold: number | null;
}

interface BackgroundSettings {
  type: BackgroundType;
  solidColor: { r: number; g: number; b: number };
  checkerboardSize: number;
  presetIndex: number;
}

interface ExportSettings {
  format: ExportFormat;
  quality: number;
}

const MAX_CONCURRENT = 1;
const MAX_RETRIES = 3;

interface StageConfig {
  start: number;
  end: number;
  description: string;
  weight: number;
}

const STAGE_CONFIG: Record<string, StageConfig> = {
  fetch: { start: 0, end: 8, description: '加载资源', weight: 1 },
  decode: { start: 8, end: 18, description: '解码图片', weight: 1 },
  inference: { start: 18, end: 78, description: 'AI处理中', weight: 5 },
  mask: { start: 78, end: 88, description: '生成掩码', weight: 1 },
  compose: { start: 88, end: 93, description: '合成背景', weight: 1 },
  encode: { start: 93, end: 100, description: '编码结果', weight: 1 }
};

const SMOOTH_FACTOR = 0.08;
const MIN_PROGRESS_PER_FRAME = 0.01;
const MAX_AUTO_PROGRESS_PER_SECOND = 15;

interface SolidPresetBackground {
  name: string;
  type: 'solid';
  color: string;
}

interface GradientPresetBackground {
  name: string;
  type: 'gradient';
  colors: string[];
}

type PresetBackground = SolidPresetBackground | GradientPresetBackground;

const PRESET_BACKGROUNDS: PresetBackground[] = [
  { name: '渐变蓝', type: 'gradient', colors: ['#667eea', '#764ba2'] },
  { name: '渐变橙', type: 'gradient', colors: ['#f093fb', '#f5576c'] },
  { name: '渐变绿', type: 'gradient', colors: ['#11998e', '#38ef7d'] },
  { name: '渐变粉', type: 'gradient', colors: ['#ff9a9e', '#fecfef'] },
  { name: '渐变紫', type: 'gradient', colors: ['#a18cd1', '#fbc2eb'] },
  { name: '渐变黄', type: 'gradient', colors: ['#f6d365', '#fda085'] },
  { name: '纯白', type: 'solid', color: '#ffffff' },
  { name: '纯黑', type: 'solid', color: '#000000' },
  { name: '浅灰', type: 'solid', color: '#f0f0f0' },
];

let animationId: number | null = null;
let lastFrameTime = 0;

const smoothDamp = (current: number, target: number, factor: number): number => {
  return current + (target - current) * factor;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function imageDataToNdArray(imageData: ImageData): NdArray<Uint8Array> {
  return ndarray(new Uint8Array(imageData.data), [imageData.height, imageData.width, 4]);
}

function ndArrayToImageData(tensor: NdArray<Uint8Array>): ImageData {
  const [height, width] = tensor.shape;
  return new ImageData(new Uint8ClampedArray(tensor.data), width, height);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = 'image/png',
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      type,
      quality
    );
  });
}

export default {
  name: 'App',
  setup() {
    const tasks = ref<ImageTask[]>([]);
    const isPreloading = ref(true);
    const preloadText = ref('Loading model...');
    const isDragging = ref(false);
    const isGeneratingZip = ref(false);
    const zipProgress = ref(0);
    const activeProcessors = ref(0);
    let fileInput: HTMLInputElement | null = null;

    const publicPath = new URL(import.meta.url);
    publicPath.pathname = '/js/';

    const baseConfig: Config = {
      debug: false,
      publicPath: publicPath.href,
      rescale: true,
      device: 'cpu',
      model: 'isnet_quint8',
      output: {
        quality: 0.8,
        format: 'image/png'
      }
    };

    const selectedTaskId = ref<string | null>(null);
    const showSidebar = ref(true);
    const activeTool = ref<ToolMode>('none');
    const isDrawing = ref(false);
    const lastMousePos = ref({ x: 0, y: 0 });
    
    const brushCursorPos = ref({ x: 0, y: 0 });
    const isMouseOverCanvas = ref(false);
    const pendingPreviewUpdate = ref(false);
    let previewUpdateRAFId: number | null = null;

    const brushConfig = ref<BrushConfig>({
      size: 30,
      hardness: 0.5,
      opacity: 1.0
    });

    const maskSettings = ref<MaskSettings>({
      smoothness: 0,
      feather: 0,
      edgeMode: 'auto',
      contrast: 0,
      threshold: null
    });

    const backgroundSettings = ref<BackgroundSettings>({
      type: 'transparent',
      solidColor: { r: 255, g: 255, b: 255 },
      checkerboardSize: 16,
      presetIndex: 0
    });

    const exportSettings = ref<ExportSettings>({
      format: 'image/png',
      quality: 0.8
    });

    const showColorPicker = ref(false);
    const colorPickerType = ref<'foreground' | 'background'>('background');

    const presetBackgrounds = computed(() => PRESET_BACKGROUNDS);

    const selectedTask = computed(() => {
      if (!selectedTaskId.value) return null;
      return tasks.value.find(t => t.id === selectedTaskId.value) || null;
    });

    const queueStats = computed<QueueStats>(() => {
      const total = tasks.value.length;
      const pending = tasks.value.filter(t => t.status === 'pending').length;
      const processing = tasks.value.filter(t => t.status === 'processing').length;
      const completed = tasks.value.filter(t => t.status === 'completed').length;
      const failed = tasks.value.filter(t => t.status === 'failed').length;

      const completedTasks = tasks.value.filter(t => t.processingTime > 0);
      const averageTimePerTask = completedTasks.length > 0
        ? completedTasks.reduce((sum, t) => sum + t.processingTime, 0) / completedTasks.length
        : 0;

      const remainingTasks = pending + processing;
      const estimatedTimeRemaining = averageTimePerTask > 0
        ? remainingTasks * averageTimePerTask / (MAX_CONCURRENT * 1000)
        : 0;

      return {
        total,
        pending,
        processing,
        completed,
        failed,
        estimatedTimeRemaining,
        averageTimePerTask
      };
    });

    const hasCompletedTasks = computed(() => {
      return tasks.value.some(t => t.status === 'completed' && t.resultBlob);
    });

    const hasTasks = computed(() => tasks.value.length > 0);

    const isAllCompleted = computed(() => {
      return tasks.value.length > 0 && 
        tasks.value.every(t => t.status === 'completed' || t.status === 'failed');
    });

    const generateTaskId = (): string => {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    };

    const formatFileSize = (bytes: number): string => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatTime = (seconds: number): string => {
      if (seconds < 60) return seconds.toFixed(1) + 's';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}m ${secs}s`;
    };

    const createTaskFromFile = (file: File): ImageTask => {
      return {
        id: generateTaskId(),
        file,
        name: file.name,
        status: 'pending',
        progress: 0,
        displayProgress: 0,
        targetProgress: 0,
        progressText: 'Waiting...',
        resultBlob: null,
        resultUrl: null,
        originalUrl: URL.createObjectURL(file),
        error: null,
        retryCount: 0,
        processingTime: 0,
        startTime: 0,
        currentStage: '',
        stageStartTime: 0,
        stageStartDisplay: 0,
        lastApiUpdateTime: 0,
        originalImageData: null,
        segmentationMask: null,
        currentMask: null,
        maskCanvas: null,
        previewUrl: null
      };
    };

    const updateTaskStage = (task: ImageTask, stageKey: string) => {
      if (task.currentStage === stageKey) return;
      
      const stageConfig = STAGE_CONFIG[stageKey];
      if (!stageConfig) return;
      
      task.currentStage = stageKey;
      task.stageStartTime = Date.now();
      task.stageStartDisplay = Math.max(task.displayProgress, stageConfig.start);
      task.targetProgress = stageConfig.end;
      task.progress = stageConfig.start;
      task.progressText = `${stageConfig.description}...`;
      task.lastApiUpdateTime = Date.now();
    };

    const calculateStageProgress = (task: ImageTask, now: number): number => {
      const stageConfig = STAGE_CONFIG[task.currentStage];
      if (!stageConfig) return task.displayProgress;

      const stageRange = stageConfig.end - stageConfig.start;
      const timeSinceLastApi = now - task.lastApiUpdateTime;

      let targetProgress: number;
      
      if (task.progress >= stageConfig.start && task.progress <= stageConfig.end) {
        const apiProgressInStage = (task.progress - stageConfig.start) / stageRange;
        targetProgress = stageConfig.start + apiProgressInStage * stageRange;
      } else {
        targetProgress = stageConfig.start;
      }

      const baseSpeed = MAX_AUTO_PROGRESS_PER_SECOND / Math.max(stageConfig.weight, 1);
      const maxAutoProgress = (timeSinceLastApi / 1000) * baseSpeed;
      
      const effectiveStart = Math.max(task.stageStartDisplay, stageConfig.start);
      const autoTarget = Math.min(
        effectiveStart + maxAutoProgress,
        stageConfig.end - 0.5
      );

      targetProgress = Math.max(targetProgress, autoTarget);
      targetProgress = Math.min(targetProgress, stageConfig.end - 0.5);

      return targetProgress;
    };

    const animateProgress = () => {
      const now = Date.now();
      const deltaMs = lastFrameTime > 0 ? now - lastFrameTime : 16;
      lastFrameTime = now;
      
      let hasActiveTasks = false;

      tasks.value.forEach(task => {
        if (task.status !== 'processing') return;
        
        hasActiveTasks = true;

        if (task.currentStage && task.stageStartTime > 0) {
          const newTarget = calculateStageProgress(task, now);
          
          if (newTarget > task.displayProgress) {
            task.displayProgress = smoothDamp(task.displayProgress, newTarget, SMOOTH_FACTOR);
            
            const minIncrement = MIN_PROGRESS_PER_FRAME * (deltaMs / 16);
            if (newTarget - task.displayProgress < minIncrement && task.displayProgress < newTarget - 0.01) {
              task.displayProgress += minIncrement;
            }
          } else {
            task.displayProgress = smoothDamp(task.displayProgress, newTarget, SMOOTH_FACTOR * 2);
          }
          
          task.displayProgress = clamp(task.displayProgress, 0, 99.9);
          task.displayProgress = Math.round(task.displayProgress * 100) / 100;
        } else {
          if (!task.currentStage && task.stageStartTime === 0) {
            updateTaskStage(task, 'decode');
          }
          
          if (task.displayProgress < 8) {
            task.displayProgress += 0.05;
            task.displayProgress = Math.round(task.displayProgress * 100) / 100;
          }
        }
      });

      if (hasActiveTasks) {
        animationId = window.requestAnimationFrame(animateProgress);
      } else {
        animationId = null;
        lastFrameTime = 0;
      }
    };

    const startProgressAnimation = () => {
      if (animationId !== null) return;
      lastFrameTime = Date.now();
      animationId = window.requestAnimationFrame(animateProgress);
    };

    const stopProgressAnimation = () => {
      if (animationId !== null) {
        window.cancelAnimationFrame(animationId);
        animationId = null;
        lastFrameTime = 0;
      }
    };

    const calculateActualProgress = (type: string, subtype: string, current: number, total: number): number => {
      if (type === 'fetch') {
        const stageConfig = STAGE_CONFIG['fetch'];
        if (!stageConfig) {
          return Math.round((current / total) * 100);
        }
        const stageProgress = current / total;
        const weightedProgress = stageConfig.start + (stageConfig.end - stageConfig.start) * stageProgress;
        return Math.round(weightedProgress);
      }

      if (type === 'compute') {
        if (current === total) {
          return 100;
        }

        const stageKey = subtype;
        const stageConfig = STAGE_CONFIG[stageKey];
        
        if (!stageConfig) {
          return Math.round((current / total) * 100);
        }

        return stageConfig.start;
      }

      return Math.round((current / total) * 100);
    };

    const addFiles = (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter(file => 
        file.type.startsWith('image/')
      );
      
      const newTasks = imageFiles.map(file => createTaskFromFile(file));
      tasks.value = [...tasks.value, ...newTasks];
      
      if (newTasks.length > 0) {
        selectedTaskId.value = newTasks[0].id;
      }
      
      processQueue();
    };

    const processTask = async (task: ImageTask) => {
      if (task.status !== 'pending') return;
      
      const now = Date.now();
      
      task.status = 'processing';
      task.startTime = now;
      task.progress = 0;
      task.displayProgress = 0;
      task.targetProgress = 0;
      task.progressText = '初始化中...';
      task.error = null;
      task.currentStage = '';
      task.stageStartTime = 0;
      task.stageStartDisplay = 0;
      task.lastApiUpdateTime = now;

      startProgressAnimation();
      
      updateTaskStage(task, 'decode');

      try {
        const config: Config = {
          ...baseConfig,
          progress: (key, current, total) => {
            const [type, subtype] = key.split(':');
            const stageKey = type === 'fetch' ? 'fetch' : subtype;
            
            updateTaskStage(task, stageKey);
            
            const actualProgress = calculateActualProgress(type, subtype, current, total);
            task.progress = Math.min(actualProgress, 99);
            task.lastApiUpdateTime = Date.now();
          }
        };

        const img = new Image();
        img.src = task.originalUrl || '';
        await new Promise(resolve => { img.onload = resolve; });
        
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        task.originalImageData = imageDataToNdArray(imageData);
        
        task.segmentationMask = await getSegmentationMask(task.file, config);
        task.currentMask = ndarray(new Uint8Array(task.segmentationMask.data), task.segmentationMask.shape);
        
        task.maskCanvas = createCanvas(img.width, img.height);
        
        await updateTaskPreview(task);
        
        task.resultBlob = null;
        task.status = 'completed';
        task.progress = 100;
        task.displayProgress = 100;
        task.progressText = '已完成';
        task.processingTime = Date.now() - task.startTime;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        task.error = errorMessage;
        task.status = 'failed';
        task.progressText = '处理失败';
        task.processingTime = Date.now() - task.startTime;
      }

      activeProcessors.value--;
      
      const hasMoreProcessing = tasks.value.some(t => t.status === 'processing');
      if (!hasMoreProcessing) {
        stopProgressAnimation();
      }
      
      processQueue();
    };

    const getMaskConfig = (): MaskConfig => {
      return {
        smoothness: maskSettings.value.smoothness,
        feather: maskSettings.value.feather,
        edgeMode: maskSettings.value.edgeMode,
        contrast: maskSettings.value.contrast,
        threshold: maskSettings.value.threshold ?? undefined
      };
    };

    const getBackgroundConfig = (): BackgroundConfig => {
      if (backgroundSettings.value.type === 'transparent') {
        return { type: 'transparent' };
      } else if (backgroundSettings.value.type === 'solid') {
        return {
          type: 'solid',
          color: backgroundSettings.value.solidColor
        };
      } else if (backgroundSettings.value.type === 'checkerboard') {
        return {
          type: 'checkerboard',
          checkerboard: {
            tileSize: backgroundSettings.value.checkerboardSize
          }
        };
      } else if (backgroundSettings.value.type === 'preset') {
        const preset = PRESET_BACKGROUNDS[backgroundSettings.value.presetIndex];
        if (preset.type === 'solid') {
          const color = hexToRgb(preset.color) || { r: 255, g: 255, b: 255 };
          return { type: 'solid', color };
        }
      }
      return { type: 'transparent' };
    };

    const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };

    const rgbToHex = (r: number, g: number, b: number): string => {
      return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
    };

    const updateTaskPreviewQuick = (task: ImageTask) => {
      if (!task.originalImageData || !task.currentMask || !task.maskCanvas) return;

      const [height, width] = task.originalImageData.shape;
      const resultData = ndarray(new Uint8Array(task.originalImageData.data), task.originalImageData.shape);
      
      const stride = width * height;
      for (let i = 0; i < stride; i += 1) {
        resultData.data[4 * i + 3] = task.currentMask.data[i];
      }

      const canvas = task.maskCanvas;
      const ctx = canvas.getContext('2d')!;
      const imageData = ndArrayToImageData(resultData);
      ctx.putImageData(imageData, 0, 0);
    };

    const schedulePreviewUpdate = (_task: ImageTask) => {
      pendingPreviewUpdate.value = true;
      
      if (previewUpdateRAFId !== null) {
        cancelAnimationFrame(previewUpdateRAFId);
      }
      
      previewUpdateRAFId = requestAnimationFrame(() => {
        if (pendingPreviewUpdate.value && selectedTask.value) {
          updateTaskPreviewQuick(selectedTask.value);
        }
        pendingPreviewUpdate.value = false;
        previewUpdateRAFId = null;
      });
    };

    const updateTaskPreview = async (task: ImageTask) => {
      if (!task.originalImageData || !task.currentMask) return;

      let processedMask = task.currentMask;
      
      const maskConfig = getMaskConfig();
      if (maskConfig.smoothness || maskConfig.feather || maskConfig.edgeMode !== 'auto' || maskConfig.contrast !== 0 || maskConfig.threshold !== undefined) {
        processedMask = processMask(task.currentMask, maskConfig);
      }

      const [height, width] = task.originalImageData.shape;
      const resultData = ndarray(new Uint8Array(task.originalImageData.data), task.originalImageData.shape);
      
      const stride = width * height;
      for (let i = 0; i < stride; i += 1) {
        resultData.data[4 * i + 3] = processedMask.data[i];
      }

      let finalImage = resultData;
      const bgConfig = getBackgroundConfig();
      if (bgConfig.type !== 'transparent') {
        finalImage = await composeWithBackground(resultData, bgConfig);
      }

      const canvas = task.maskCanvas!;
      const ctx = canvas.getContext('2d')!;
      const imageData = ndArrayToImageData(finalImage);
      ctx.putImageData(imageData, 0, 0);

      if (task.previewUrl) {
        URL.revokeObjectURL(task.previewUrl);
      }
      
      const blob = await canvasToBlob(canvas, 'image/png');
      task.previewUrl = URL.createObjectURL(blob);
    };

    const drawBrushStroke = (task: ImageTask, x: number, y: number, mode: 'erase' | 'restore') => {
      if (!task.currentMask || !task.maskCanvas) return;

      const canvas = task.maskCanvas;
      const [maskHeight, maskWidth] = task.currentMask.shape;
      const scaleX = maskWidth / canvas.width;
      const scaleY = maskHeight / canvas.height;

      const brushSize = brushConfig.value.size;
      const hardness = brushConfig.value.hardness;
      const opacity = brushConfig.value.opacity;
      const value = mode === 'erase' ? 0 : 255;

      const radius = brushSize / 2;
      const scaledRadiusX = radius * scaleX;
      const scaledRadiusY = radius * scaleY;

      const centerX = x * scaleX;
      const centerY = y * scaleY;

      const minX = Math.max(0, Math.floor(centerX - scaledRadiusX));
      const maxX = Math.min(maskWidth - 1, Math.ceil(centerX + scaledRadiusX));
      const minY = Math.max(0, Math.floor(centerY - scaledRadiusY));
      const maxY = Math.min(maskHeight - 1, Math.ceil(centerY + scaledRadiusY));

      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          const dx = (px - centerX) / scaledRadiusX;
          const dy = (py - centerY) / scaledRadiusY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= 1) {
            let factor: number;
            if (hardness >= 1) {
              factor = 1;
            } else {
              const softEdge = 1 - hardness;
              if (dist < hardness) {
                factor = 1;
              } else {
                factor = (1 - dist) / softEdge;
              }
            }
            factor = Math.max(0, Math.min(1, factor)) * opacity;

            const idx = py * maskWidth + px;
            const currentValue = task.currentMask!.data[idx];
            const newValue = currentValue + (value - currentValue) * factor;
            task.currentMask!.data[idx] = Math.max(0, Math.min(255, newValue));
          }
        }
      }
    };

    const getCanvasCoords = (e: MouseEvent, task: ImageTask) => {
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const scaleX = task.maskCanvas ? task.maskCanvas.width / rect.width : 1;
      const scaleY = task.maskCanvas ? task.maskCanvas.height / rect.height : 1;
      
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        displayX: e.clientX - rect.left,
        displayY: e.clientY - rect.top,
        rectWidth: rect.width,
        rectHeight: rect.height
      };
    };

    const handleMouseEnter = (_e: MouseEvent, _task: ImageTask) => {
      if (activeTool.value === 'none') return;
      isMouseOverCanvas.value = true;
    };

    const handleMouseLeave = () => {
      isMouseOverCanvas.value = false;
      isDrawing.value = false;
    };

    const handleMouseMoveAlways = (e: MouseEvent, task: ImageTask) => {
      if (activeTool.value === 'none') return;
      
      const coords = getCanvasCoords(e, task);
      brushCursorPos.value = {
        x: coords.displayX,
        y: coords.displayY
      };
      
      if (!isDrawing.value) return;
      
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const scaleX = task.maskCanvas ? task.maskCanvas.width / rect.width : 1;
      const scaleY = task.maskCanvas ? task.maskCanvas.height / rect.height : 1;
      
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      if (activeTool.value === 'erase' || activeTool.value === 'restore') {
        const dx = x - lastMousePos.value.x;
        const dy = y - lastMousePos.value.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.floor(dist / 2));

        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const ix = lastMousePos.value.x + dx * t;
          const iy = lastMousePos.value.y + dy * t;
          drawBrushStroke(task, ix, iy, activeTool.value);
        }

        lastMousePos.value = { x, y };
        schedulePreviewUpdate(task);
      }
    };

    const handleMouseDown = (e: MouseEvent, task: ImageTask) => {
      if (activeTool.value === 'none' || !task.maskCanvas) return;
      isDrawing.value = true;
      
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const scaleX = task.maskCanvas.width / rect.width;
      const scaleY = task.maskCanvas.height / rect.height;
      
      lastMousePos.value = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };

      if (activeTool.value === 'erase' || activeTool.value === 'restore') {
        drawBrushStroke(task, lastMousePos.value.x, lastMousePos.value.y, activeTool.value);
        schedulePreviewUpdate(task);
      }
    };

    const handleMouseUp = () => {
      isDrawing.value = false;
    };

    const selectTask = (taskId: string) => {
      selectedTaskId.value = taskId;
    };

    const processQueue = () => {
      const pendingTasks = tasks.value.filter(t => t.status === 'pending');
      
      while (activeProcessors.value < MAX_CONCURRENT && pendingTasks.length > 0) {
        const nextTask = pendingTasks.shift();
        if (nextTask) {
          activeProcessors.value++;
          processTask(nextTask);
        }
      }
    };

    const retryTask = (task: ImageTask) => {
      if (task.retryCount >= MAX_RETRIES) {
        return;
      }
      
      const now = Date.now();
      
      task.retryCount++;
      task.status = 'pending';
      task.progress = 0;
      task.displayProgress = 0;
      task.targetProgress = 0;
      task.progressText = '重试中...';
      task.error = null;
      task.processingTime = 0;
      task.currentStage = '';
      task.stageStartTime = 0;
      task.stageStartDisplay = 0;
      task.lastApiUpdateTime = now;
      
      if (task.resultUrl) {
        URL.revokeObjectURL(task.resultUrl);
        task.resultUrl = null;
      }
      task.resultBlob = null;
      
      processQueue();
    };

    const retryAllFailed = () => {
      const failedTasks = tasks.value.filter(t => 
        t.status === 'failed' && t.retryCount < MAX_RETRIES
      );
      
      const now = Date.now();
      
      failedTasks.forEach(task => {
        task.retryCount++;
        task.status = 'pending';
        task.progress = 0;
        task.displayProgress = 0;
        task.targetProgress = 0;
        task.progressText = '重试中...';
        task.error = null;
        task.processingTime = 0;
        task.currentStage = '';
        task.stageStartTime = 0;
        task.stageStartDisplay = 0;
        task.lastApiUpdateTime = now;
        
        if (task.resultUrl) {
          URL.revokeObjectURL(task.resultUrl);
          task.resultUrl = null;
        }
        task.resultBlob = null;
      });
      
      processQueue();
    };

    const removeTask = (task: ImageTask) => {
      if (task.originalUrl) {
        URL.revokeObjectURL(task.originalUrl);
      }
      if (task.resultUrl) {
        URL.revokeObjectURL(task.resultUrl);
      }
      if (task.previewUrl) {
        URL.revokeObjectURL(task.previewUrl);
      }
      
      const index = tasks.value.indexOf(task);
      if (index > -1) {
        tasks.value.splice(index, 1);
      }
      
      if (selectedTaskId.value === task.id) {
        selectedTaskId.value = tasks.value.length > 0 ? tasks.value[0].id : null;
      }
    };

    const clearAll = () => {
      tasks.value.forEach(task => {
        if (task.originalUrl) {
          URL.revokeObjectURL(task.originalUrl);
        }
        if (task.resultUrl) {
          URL.revokeObjectURL(task.resultUrl);
        }
        if (task.previewUrl) {
          URL.revokeObjectURL(task.previewUrl);
        }
      });
      tasks.value = [];
      selectedTaskId.value = null;
    };

    const generateFinalResult = async (task: ImageTask): Promise<Blob> => {
      if (!task.originalImageData || !task.currentMask) {
        throw new Error('图像数据不完整');
      }

      let processedMask = task.currentMask;
      const maskConfig = getMaskConfig();
      if (maskConfig.smoothness || maskConfig.feather || maskConfig.edgeMode !== 'auto' || maskConfig.contrast !== 0 || maskConfig.threshold !== undefined) {
        processedMask = processMask(task.currentMask, maskConfig);
      }

      const [height, width] = task.originalImageData.shape;
      const resultData = ndarray(new Uint8Array(task.originalImageData.data), task.originalImageData.shape);
      
      const stride = width * height;
      for (let i = 0; i < stride; i += 1) {
        resultData.data[4 * i + 3] = processedMask.data[i];
      }

      let finalImage = resultData;
      const bgConfig = getBackgroundConfig();
      if (bgConfig.type !== 'transparent') {
        finalImage = await composeWithBackground(resultData, bgConfig);
      }

      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d')!;
      const imageData = ndArrayToImageData(finalImage);
      ctx.putImageData(imageData, 0, 0);

      return canvasToBlob(
        canvas,
        exportSettings.value.format,
        exportSettings.value.quality
      );
    };

    const downloadSingle = async (task: ImageTask) => {
      try {
        const blob = await generateFinalResult(task);
        const link = document.createElement('a');
        const baseName = task.name.replace(/\.[^/.]+$/, '');
        const ext = exportSettings.value.format === 'image/png' ? 'png' : 
                    exportSettings.value.format === 'image/jpeg' ? 'jpg' : 'webp';
        link.href = URL.createObjectURL(blob);
        link.download = `${baseName}_processed.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      } catch (error) {
        console.error('下载失败:', error);
      }
    };

    const downloadAllAsZip = async () => {
      const completedTasks = tasks.value.filter(t => 
        t.status === 'completed' && t.originalImageData
      );
      
      if (completedTasks.length === 0) return;
      
      isGeneratingZip.value = true;
      zipProgress.value = 0;
      
      try {
        const zip = new JSZip();
        const totalFiles = completedTasks.length;
        const ext = exportSettings.value.format === 'image/png' ? 'png' : 
                    exportSettings.value.format === 'image/jpeg' ? 'jpg' : 'webp';
        
        for (let i = 0; i < completedTasks.length; i++) {
          const task = completedTasks[i];
          const baseName = task.name.replace(/\.[^/.]+$/, '');
          const fileName = `${baseName}_processed.${ext}`;
          
          const blob = await generateFinalResult(task);
          const arrayBuffer = await blob.arrayBuffer();
          zip.file(fileName, arrayBuffer);
          
          zipProgress.value = Math.round(((i + 1) / totalFiles) * 100);
        }
        
        const zipBlob = await zip.generateAsync({ 
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
        
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 10);
        link.href = URL.createObjectURL(zipBlob);
        link.download = `background_removal_${timestamp}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      } catch (error) {
        console.error('Failed to generate ZIP:', error);
      } finally {
        isGeneratingZip.value = false;
        zipProgress.value = 0;
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.value = true;
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.value = false;
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.value = false;
      
      if (e.dataTransfer?.files) {
        addFiles(e.dataTransfer.files);
      }
    };

    const handleFileInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        addFiles(target.files);
      }
      if (fileInput) {
        fileInput.value = '';
      }
    };

    const triggerFileInput = () => {
      if (fileInput) {
        fileInput.click();
      }
    };

    const getStatusBadgeClass = (status: TaskStatus): string => {
      const classes: Record<TaskStatus, string> = {
        pending: 'badge-pending',
        processing: 'badge-processing',
        completed: 'badge-completed',
        failed: 'badge-failed'
      };
      return classes[status];
    };

    const getStatusText = (status: TaskStatus): string => {
      const texts: Record<TaskStatus, string> = {
        pending: 'Waiting',
        processing: 'Processing',
        completed: 'Done',
        failed: 'Failed'
      };
      return texts[status];
    };

    watch([
      () => maskSettings.value.smoothness,
      () => maskSettings.value.feather,
      () => maskSettings.value.edgeMode,
      () => maskSettings.value.contrast,
      () => maskSettings.value.threshold,
      () => backgroundSettings.value.type,
      () => backgroundSettings.value.solidColor,
      () => backgroundSettings.value.checkerboardSize,
      () => backgroundSettings.value.presetIndex
    ], async () => {
      if (selectedTask.value && selectedTask.value.status === 'completed') {
        await updateTaskPreview(selectedTask.value);
      }
    }, { deep: true });

    onMounted(() => {
      fileInput = document.getElementById('file-input') as HTMLInputElement;
      
      preload({
        ...baseConfig,
        progress: (key, current, total) => {
          const [type] = key.split(':');
          const progress = Math.round((current / total) * 100);
          if (type === 'fetch') {
            preloadText.value = `Loading model: ${progress}%`;
          }
        }
      })
        .then(() => {
          console.log('Asset preloading succeeded');
          isPreloading.value = false;
          preloadText.value = 'Ready';
        })
        .catch((error) => {
          console.error('Asset preloading failed:', error);
          isPreloading.value = false;
          preloadText.value = 'Ready (will load on first use)';
        });

      window.addEventListener('mouseup', handleMouseUp);
    });

    onUnmounted(() => {
      stopProgressAnimation();
      window.removeEventListener('mouseup', handleMouseUp);
      tasks.value.forEach(task => {
        if (task.originalUrl) {
          URL.revokeObjectURL(task.originalUrl);
        }
        if (task.resultUrl) {
          URL.revokeObjectURL(task.resultUrl);
        }
        if (task.previewUrl) {
          URL.revokeObjectURL(task.previewUrl);
        }
      });
    });

    return {
      tasks,
      isPreloading,
      preloadText,
      isDragging,
      isGeneratingZip,
      zipProgress,
      activeProcessors,
      queueStats,
      hasCompletedTasks,
      hasTasks,
      isAllCompleted,
      MAX_RETRIES,
      selectedTaskId,
      selectedTask,
      showSidebar,
      activeTool,
      brushConfig,
      maskSettings,
      backgroundSettings,
      exportSettings,
      presetBackgrounds,
      showColorPicker,
      colorPickerType,
      isMouseOverCanvas,
      brushCursorPos,
      addFiles,
      retryTask,
      retryAllFailed,
      removeTask,
      clearAll,
      downloadSingle,
      downloadAllAsZip,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      handleFileInput,
      triggerFileInput,
      formatFileSize,
      formatTime,
      getStatusBadgeClass,
      getStatusText,
      selectTask,
      handleMouseDown,
      handleMouseMoveAlways,
      handleMouseEnter,
      handleMouseLeave,
      handleMouseUp,
      rgbToHex,
      hexToRgb
    };
  }
};
</script>

<template>
  <div id="app">
    <header class="app-header">
      <h1>智能抠图工具</h1>
      <p class="subtitle">AI 背景移除 + 高级编辑功能</p>
      <div v-if="isPreloading" class="preload-banner">
        <div class="spinner-small"></div>
        <span>{{ preloadText }}</span>
      </div>
    </header>

    <main class="main-content">
      <div
        class="upload-area"
        :class="{ 'drag-over': isDragging, disabled: isPreloading }"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
        @click="triggerFileInput"
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept="image/*"
          style="display: none"
          @change="handleFileInput"
        />
        <div class="upload-icon">
          <svg viewBox="0 0 24 24" width="48" height="48">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </div>
        <p class="upload-text">
          {{ isPreloading ? '加载模型中...' : '拖拽图片到此处或点击选择' }}
        </p>
        <p class="upload-hint">支持: JPG, PNG, WebP, GIF (可多选)</p>
      </div>

      <div v-if="hasTasks" class="workspace">
        <div class="sidebar" v-show="showSidebar">
          <div class="sidebar-header">
            <h3>控制面板</h3>
          </div>

          <div class="panel-section">
            <h4 class="panel-title">工具</h4>
            <div class="tool-buttons">
              <button 
                class="tool-btn" 
                :class="{ active: activeTool === 'none' }"
                @click="activeTool = 'none'"
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>选择</span>
              </button>
              <button 
                class="tool-btn erase" 
                :class="{ active: activeTool === 'erase' }"
                @click="activeTool = 'erase'"
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 01-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0zM4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-4.95-4.95-4.95 4.95z"/>
                </svg>
                <span>擦除</span>
              </button>
              <button 
                class="tool-btn restore" 
                :class="{ active: activeTool === 'restore' }"
                @click="activeTool = 'restore'"
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                </svg>
                <span>恢复</span>
              </button>
            </div>

            <div v-if="activeTool === 'erase' || activeTool === 'restore'" class="brush-settings">
              <div class="setting-row">
                <label>画笔大小: {{ brushConfig.size }}px</label>
                <input 
                  type="range" 
                  min="5" 
                  max="100" 
                  v-model.number="brushConfig.size"
                  class="slider"
                />
              </div>
              <div class="setting-row">
                <label>硬度: {{ Math.round(brushConfig.hardness * 100) }}%</label>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  v-model.number="brushConfig.hardness"
                  class="slider"
                />
              </div>
              <div class="setting-row">
                <label>不透明度: {{ Math.round(brushConfig.opacity * 100) }}%</label>
                <input 
                  type="range" 
                  min="0.1" 
                  max="1" 
                  step="0.1" 
                  v-model.number="brushConfig.opacity"
                  class="slider"
                />
              </div>
            </div>
          </div>

          <div class="panel-section">
            <h4 class="panel-title">抠图精细度</h4>
            
            <div class="setting-row">
              <label>边缘平滑度: {{ maskSettings.smoothness }}</label>
              <input 
                type="range" 
                min="0" 
                max="20" 
                v-model.number="maskSettings.smoothness"
                class="slider"
              />
            </div>

            <div class="setting-row">
              <label>边缘羽化: {{ maskSettings.feather }}px</label>
              <input 
                type="range" 
                min="0" 
                max="50" 
                v-model.number="maskSettings.feather"
                class="slider"
              />
            </div>

            <div class="setting-row">
              <label>对比度: {{ maskSettings.contrast }}</label>
              <input 
                type="range" 
                min="-100" 
                max="100" 
                v-model.number="maskSettings.contrast"
                class="slider"
              />
            </div>

            <div class="setting-row">
              <label>边缘模式</label>
              <select v-model="maskSettings.edgeMode" class="select-input">
                <option value="auto">自动</option>
                <option value="hard">硬边缘</option>
                <option value="soft">软边缘</option>
                <option value="blur">模糊边缘</option>
              </select>
            </div>

            <div class="setting-row">
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  :checked="maskSettings.threshold !== null"
                  @change="maskSettings.threshold = maskSettings.threshold === null ? 128 : null"
                />
                启用阈值
              </label>
            </div>

            <div v-if="maskSettings.threshold !== null" class="setting-row">
              <label>阈值: {{ maskSettings.threshold }}</label>
              <input 
                type="range" 
                min="0" 
                max="255" 
                v-model.number="maskSettings.threshold!"
                class="slider"
              />
            </div>
          </div>

          <div class="panel-section">
            <h4 class="panel-title">背景设置</h4>
            
            <div class="setting-row">
              <label>背景类型</label>
              <select v-model="backgroundSettings.type" class="select-input">
                <option value="transparent">透明</option>
                <option value="solid">纯色</option>
                <option value="checkerboard">棋盘格</option>
                <option value="preset">预设</option>
              </select>
            </div>

            <div v-if="backgroundSettings.type === 'solid'" class="setting-row">
              <label>背景颜色</label>
              <div class="color-input-row">
                <input 
                  type="color" 
                  :value="rgbToHex(backgroundSettings.solidColor.r, backgroundSettings.solidColor.g, backgroundSettings.solidColor.b)"
                  @input="(e: Event) => {
                    const hex = (e.target as HTMLInputElement).value;
                    const rgb = hexToRgb(hex);
                    if (rgb) backgroundSettings.solidColor = rgb;
                  }"
                  class="color-picker-input"
                />
                <span>{{ rgbToHex(backgroundSettings.solidColor.r, backgroundSettings.solidColor.g, backgroundSettings.solidColor.b) }}</span>
              </div>
            </div>

            <div v-if="backgroundSettings.type === 'checkerboard'" class="setting-row">
              <label>格子大小: {{ backgroundSettings.checkerboardSize }}px</label>
              <input 
                type="range" 
                min="4" 
                max="64" 
                v-model.number="backgroundSettings.checkerboardSize"
                class="slider"
              />
            </div>

            <div v-if="backgroundSettings.type === 'preset'" class="preset-grid">
              <div 
                v-for="(preset, idx) in presetBackgrounds" 
                :key="idx"
                class="preset-item"
                :class="{ active: backgroundSettings.presetIndex === idx }"
                @click="backgroundSettings.presetIndex = idx"
              >
                <div 
                  class="preset-preview"
                  :style="preset.type === 'solid' 
                    ? { background: preset.color } 
                    : { background: `linear-gradient(135deg, ${preset.colors?.[0]}, ${preset.colors?.[1]})` }"
                ></div>
                <span class="preset-name">{{ preset.name }}</span>
              </div>
            </div>
          </div>

          <div class="panel-section">
            <h4 class="panel-title">导出设置</h4>
            
            <div class="setting-row">
              <label>导出格式</label>
              <select v-model="exportSettings.format" class="select-input">
                <option value="image/png">PNG (无损)</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
              </select>
            </div>

            <div v-if="exportSettings.format !== 'image/png'" class="setting-row">
              <label>质量: {{ Math.round(exportSettings.quality * 100) }}%</label>
              <input 
                type="range" 
                min="0.1" 
                max="1" 
                step="0.1" 
                v-model.number="exportSettings.quality"
                class="slider"
              />
            </div>
          </div>
        </div>

        <div class="main-workspace">
          <div v-if="hasTasks" class="queue-controls">
            <div class="stats-row">
              <div class="stat-item">
                <span class="stat-value">{{ queueStats.total }}</span>
                <span class="stat-label">总数</span>
              </div>
              <div class="stat-item processing">
                <span class="stat-value">{{ queueStats.processing }}</span>
                <span class="stat-label">处理中</span>
              </div>
              <div class="stat-item completed">
                <span class="stat-value">{{ queueStats.completed }}</span>
                <span class="stat-label">已完成</span>
              </div>
              <div class="stat-item failed" v-if="queueStats.failed > 0">
                <span class="stat-value">{{ queueStats.failed }}</span>
                <span class="stat-label">失败</span>
              </div>
              <div class="stat-item" v-if="queueStats.estimatedTimeRemaining > 0">
                <span class="stat-value">{{ formatTime(queueStats.estimatedTimeRemaining) }}</span>
                <span class="stat-label">预计剩余</span>
              </div>
            </div>

            <div class="actions-row">
              <button
                v-if="queueStats.failed > 0"
                class="btn-secondary"
                @click="retryAllFailed"
              >
                重试失败 ({{ queueStats.failed }})
              </button>
              <button
                v-if="hasCompletedTasks"
                class="btn-primary"
                :disabled="isGeneratingZip"
                @click="downloadAllAsZip"
              >
                <span v-if="isGeneratingZip">
                  生成 ZIP... {{ zipProgress }}%
                </span>
                <span v-else>
                  批量下载 ({{ queueStats.completed }})
                </span>
              </button>
              <button class="btn-danger" @click="clearAll">
                清空全部
              </button>
            </div>
          </div>

          <div class="task-detail" v-if="selectedTask">
            <div class="task-detail-header">
              <h3>{{ selectedTask.name }}</h3>
              <span :class="['status-badge', getStatusBadgeClass(selectedTask.status)]">
                {{ getStatusText(selectedTask.status) }}
              </span>
            </div>

            <div class="comparison-view" v-if="selectedTask.status === 'completed' && selectedTask.previewUrl">
              <div class="image-container">
                <div class="image-wrapper">
                  <img :src="selectedTask.originalUrl || ''" class="original-image" />
                  <span class="image-label">原图</span>
                </div>
                <div class="arrow">→</div>
                <div 
                  class="image-wrapper result-wrapper"
                  @mousedown="(e: Event) => handleMouseDown(e as MouseEvent, selectedTask!)"
                  @mousemove="(e: Event) => handleMouseMoveAlways(e as MouseEvent, selectedTask!)"
                  @mouseenter="(e: Event) => handleMouseEnter(e as MouseEvent, selectedTask!)"
                  @mouseleave="handleMouseLeave"
                  @mouseup="handleMouseUp"
                  :style="{ cursor: activeTool === 'erase' || activeTool === 'restore' ? 'none' : 'default' }"
                >
                  <img 
                    :src="selectedTask.previewUrl" 
                    class="result-image"
                    draggable="false"
                  />
                  <span class="image-label">结果 ({{ activeTool === 'none' ? '点击选择' : activeTool === 'erase' ? '擦除模式' : '恢复模式' }})</span>
                  
                  <div 
                    v-if="(activeTool === 'erase' || activeTool === 'restore') && isMouseOverCanvas"
                    class="brush-indicator"
                    :style="{ 
                      width: brushConfig.size + 'px', 
                      height: brushConfig.size + 'px',
                      borderColor: activeTool === 'erase' ? '#ef4444' : '#10b981',
                      left: brushCursorPos.x + 'px',
                      top: brushCursorPos.y + 'px'
                    }"
                  ></div>
                </div>
              </div>
            </div>

            <div v-if="selectedTask.status === 'processing'" class="processing-view">
              <div class="processing-spinner"></div>
              <p class="processing-text">{{ selectedTask.progressText }}</p>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: selectedTask.displayProgress + '%' }"></div>
                <span class="progress-text-overlay">{{ Math.round(selectedTask.displayProgress) }}%</span>
              </div>
            </div>

            <div v-if="selectedTask.status === 'failed'" class="error-view">
              <div class="error-icon">⚠️</div>
              <p class="error-text">{{ selectedTask.error }}</p>
              <button 
                v-if="selectedTask.retryCount < MAX_RETRIES"
                class="btn-secondary"
                @click="retryTask(selectedTask!)"
              >
                重试 ({{ selectedTask.retryCount + 1 }}/{{ MAX_RETRIES }})
              </button>
            </div>

            <div class="task-actions-detail" v-if="selectedTask.status === 'completed'">
              <button class="btn-primary" @click="downloadSingle(selectedTask!)">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                下载图片
              </button>
              <button class="btn-danger" @click="removeTask(selectedTask!)">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
                删除
              </button>
            </div>
          </div>

          <div class="task-list-mini" v-if="tasks.length > 1">
            <div class="mini-task-header">图片列表</div>
            <div class="mini-task-list">
              <div 
                v-for="task in tasks" 
                :key="task.id"
                class="mini-task-item"
                :class="{ 
                  selected: selectedTaskId === task.id,
                  processing: task.status === 'processing',
                  failed: task.status === 'failed'
                }"
                @click="selectTask(task.id)"
              >
                <img :src="task.originalUrl || ''" class="mini-thumb" />
                <div class="mini-info">
                  <span class="mini-name">{{ task.name }}</span>
                  <span class="mini-status">{{ getStatusText(task.status) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="!isPreloading" class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" width="64" height="64">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
        </div>
        <h2>还没有图片</h2>
        <p>上传图片开始体验智能抠图功能</p>
        <div class="feature-list">
          <div class="feature-item">
            <span class="feature-icon">🎯</span>
            <span>AI 自动抠图</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">✏️</span>
            <span>手动擦除/恢复</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🎨</span>
            <span>背景替换</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">📥</span>
            <span>多格式导出</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

#app {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.app-header {
  text-align: center;
  color: white;
  margin-bottom: 20px;
}

.app-header h1 {
  margin: 0 0 8px 0;
  font-size: 2rem;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  opacity: 0.9;
  font-size: 1rem;
}

.preload-banner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  font-size: 0.85rem;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.main-content {
  max-width: 1600px;
  margin: 0 auto;
}

.upload-area {
  background: white;
  border: 3px dashed #cbd5e1;
  border-radius: 16px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 20px;
}

.upload-area:hover:not(.disabled) {
  border-color: #667eea;
  background: #f8fafc;
}

.upload-area.drag-over {
  border-color: #667eea;
  background: #eef2ff;
  transform: scale(1.01);
}

.upload-area.disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.upload-icon {
  margin-bottom: 12px;
}

.upload-icon svg {
  fill: #94a3b8;
}

.upload-text {
  margin: 0 0 6px 0;
  font-size: 1.1rem;
  font-weight: 500;
  color: #475569;
}

.upload-hint {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
}

.workspace {
  display: flex;
  gap: 20px;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  min-height: 600px;
}

.sidebar {
  width: 280px;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  padding: 16px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 1rem;
  color: #1e293b;
}

.panel-section {
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.panel-title {
  margin: 0 0 12px 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tool-buttons {
  display: flex;
  gap: 8px;
}

.tool-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.75rem;
  color: #64748b;
}

.tool-btn svg {
  fill: #64748b;
}

.tool-btn:hover {
  border-color: #667eea;
  background: #eef2ff;
}

.tool-btn.active {
  border-color: #667eea;
  background: #667eea;
  color: white;
}

.tool-btn.active svg {
  fill: white;
}

.tool-btn.erase.active {
  border-color: #ef4444;
  background: #ef4444;
}

.tool-btn.restore.active {
  border-color: #10b981;
  background: #10b981;
}

.brush-settings {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.setting-row {
  margin-bottom: 12px;
}

.setting-row:last-child {
  margin-bottom: 0;
}

.setting-row label {
  display: block;
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 6px;
}

.slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e2e8f0;
  outline: none;
  -webkit-appearance: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #667eea;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.select-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #475569;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.select-input:focus {
  outline: none;
  border-color: #667eea;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  color: #475569;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.color-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-picker-input {
  width: 40px;
  height: 32px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  cursor: pointer;
  padding: 2px;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.preset-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.preset-item:hover {
  background: #f1f5f9;
}

.preset-item.active {
  border-color: #667eea;
  background: #eef2ff;
}

.preset-preview {
  width: 50px;
  height: 50px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.preset-name {
  font-size: 0.7rem;
  color: #64748b;
  text-align: center;
}

.main-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.queue-controls {
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.stats-row {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 60px;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #475569;
}

.stat-label {
  font-size: 0.75rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-item.processing .stat-value {
  color: #f59e0b;
}

.stat-item.completed .stat-value {
  color: #10b981;
}

.stat-item.failed .stat-value {
  color: #ef4444;
}

.actions-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.btn-danger {
  background: #fee2e2;
  color: #dc2626;
}

.btn-danger:hover {
  background: #fecaca;
}

.task-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;
}

.task-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.task-detail-header h3 {
  margin: 0;
  font-size: 1rem;
  color: #1e293b;
  font-weight: 600;
}

.comparison-view {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.image-container {
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: 100%;
  max-height: 100%;
}

.image-wrapper {
  position: relative;
  max-width: 400px;
  max-height: 400px;
  background: linear-gradient(45deg, #f0f0f0 25%, transparent 25%), 
              linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), 
              linear-gradient(45deg, transparent 75%, #f0f0f0 75%), 
              linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.original-image,
.result-image {
  max-width: 100%;
  max-height: 400px;
  display: block;
  object-fit: contain;
}

.result-wrapper {
  cursor: crosshair;
}

.image-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 0.75rem;
  padding: 4px 8px;
  text-align: center;
}

.arrow {
  font-size: 1.5rem;
  color: #94a3b8;
  font-weight: bold;
}

.brush-indicator {
  position: absolute;
  border: 2px dashed;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0.8;
  transform: translate(-50%, -50%);
  z-index: 100;
}

.processing-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.processing-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.processing-text {
  font-size: 1rem;
  color: #475569;
  margin: 0;
}

.error-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.error-icon {
  font-size: 3rem;
}

.error-text {
  font-size: 0.9rem;
  color: #ef4444;
  margin: 0;
  text-align: center;
  max-width: 400px;
}

.task-actions-detail {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 16px;
  flex-shrink: 0;
}

.task-list-mini {
  border-left: 1px solid #e2e8f0;
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.mini-task-header {
  padding: 12px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.mini-task-list {
  flex: 1;
  overflow-y: auto;
}

.mini-task-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.2s ease;
  border-bottom: 1px solid #f1f5f9;
}

.mini-task-item:hover {
  background: #f8fafc;
}

.mini-task-item.selected {
  background: #eef2ff;
  border-left: 3px solid #667eea;
}

.mini-task-item.processing {
  background: #fffbeb;
}

.mini-task-item.failed {
  background: #fef2f2;
}

.mini-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  background: #f1f5f9;
}

.mini-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mini-name {
  font-size: 0.75rem;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.mini-status {
  font-size: 0.7rem;
  color: #94a3b8;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: white;
}

.empty-icon svg {
  fill: rgba(255, 255, 255, 0.4);
}

.empty-state h2 {
  margin: 12px 0 6px 0;
  font-size: 1.25rem;
}

.empty-state p {
  margin: 0;
  opacity: 0.8;
  font-size: 0.9rem;
}

.feature-list {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 24px;
  flex-wrap: wrap;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.15);
  padding: 10px 16px;
  border-radius: 20px;
}

.feature-icon {
  font-size: 1.25rem;
}

.feature-item span {
  font-size: 0.85rem;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;
}

.badge-pending {
  background: #f1f5f9;
  color: #64748b;
}

.badge-processing {
  background: #fef3c7;
  color: #d97706;
}

.badge-completed {
  background: #d1fae5;
  color: #059669;
}

.badge-failed {
  background: #fee2e2;
  color: #dc2626;
}

.progress-bar {
  position: relative;
  height: 24px;
  background: #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  width: 200px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #8b5cf6 50%, #764ba2 100%);
  border-radius: 12px;
  transition: width 0.1s linear;
}

.progress-text-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

@media (max-width: 1200px) {
  .workspace {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    max-height: 300px;
    border-right: none;
    border-bottom: 1px solid #e2e8f0;
  }
  
  .task-list-mini {
    width: 100%;
    border-left: none;
    border-top: 1px solid #e2e8f0;
    max-height: 150px;
  }
  
  .main-workspace {
    min-height: 400px;
  }
}

@media (max-width: 768px) {
  #app {
    padding: 10px;
  }
  
  .app-header h1 {
    font-size: 1.5rem;
  }
  
  .subtitle {
    font-size: 0.85rem;
  }
  
  .upload-area {
    padding: 30px 15px;
  }
  
  .upload-text {
    font-size: 1rem;
  }
  
  .workspace {
    min-height: auto;
  }
  
  .stats-row {
    gap: 8px;
  }
  
  .stat-item {
    min-width: 45px;
  }
  
  .stat-value {
    font-size: 1rem;
  }
  
  .stat-label {
    font-size: 0.65rem;
  }
  
  .actions-row {
    gap: 6px;
  }
  
  .btn-primary,
  .btn-secondary,
  .btn-danger {
    padding: 6px 12px;
    font-size: 0.75rem;
  }
  
  .image-container {
    flex-direction: column;
    gap: 10px;
  }
  
  .image-wrapper {
    max-width: 100%;
    max-height: 250px;
  }
  
  .arrow {
    transform: rotate(90deg);
  }
  
  .preset-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .feature-list {
    gap: 12px;
  }
  
  .feature-item {
    padding: 8px 12px;
  }
}
</style>

