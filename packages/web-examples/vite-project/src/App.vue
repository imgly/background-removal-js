<script lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { preload, removeBackground, Config } from '@imgly/background-removal';
import JSZip from 'jszip';

type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

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
  encode: { start: 88, end: 98, description: '编码结果', weight: 1 }
};

const SMOOTH_FACTOR = 0.05;
const MIN_PROGRESS_PER_FRAME = 0.02;
const API_TIMEOUT_MS = 2000;

let animationId: number | null = null;
let lastFrameTime = 0;

const smoothDamp = (current: number, target: number, factor: number): number => {
  return current + (target - current) * factor;
};

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
        lastApiUpdateTime: 0
      };
    };

    const updateTaskStage = (task: ImageTask, stageKey: string) => {
      if (task.currentStage === stageKey) return;
      
      const stageConfig = STAGE_CONFIG[stageKey];
      if (!stageConfig) return;
      
      task.currentStage = stageKey;
      task.stageStartTime = Date.now();
      task.stageStartDisplay = task.displayProgress;
      task.targetProgress = stageConfig.end;
      task.progressText = `${stageConfig.description}...`;
    };

    const calculateStageProgress = (task: ImageTask, now: number): number => {
      const stageConfig = STAGE_CONFIG[task.currentStage];
      if (!stageConfig) return task.displayProgress;

      const stageRange = stageConfig.end - stageConfig.start;
      const timeSinceStageStart = now - task.stageStartTime;
      const timeSinceLastApi = now - task.lastApiUpdateTime;

      let targetInStage: number;
      
      if (task.progress > stageConfig.start) {
        const apiProgressInStage = (task.progress - stageConfig.start) / stageRange;
        targetInStage = stageConfig.start + apiProgressInStage * stageRange;
      } else {
        targetInStage = stageConfig.start;
      }

      if (timeSinceLastApi > API_TIMEOUT_MS && task.displayProgress < task.targetProgress) {
        const autoProgressSpeed = stageRange / (8000 / stageConfig.weight);
        const autoIncrement = autoProgressSpeed * (timeSinceLastApi / 1000);
        const autoTarget = Math.min(targetInStage + autoIncrement, stageConfig.end - 0.5);
        targetInStage = Math.max(targetInStage, autoTarget);
      }

      return Math.min(targetInStage, task.targetProgress);
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
          
          task.displayProgress = Math.min(task.displayProgress, 99.5);
          task.displayProgress = Math.max(task.displayProgress, 0);
          task.displayProgress = Math.round(task.displayProgress * 100) / 100;
        } else {
          if (task.displayProgress < 3) {
            task.displayProgress += 0.03;
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
      const stageKey = type === 'fetch' ? 'fetch' : subtype;
      const stageConfig = STAGE_CONFIG[stageKey];
      
      if (!stageConfig) {
        return Math.round((current / total) * 100);
      }

      const stageProgress = current / total;
      const weightedProgress = stageConfig.start + (stageConfig.end - stageConfig.start) * stageProgress;
      
      return Math.round(weightedProgress);
    };

    const addFiles = (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter(file => 
        file.type.startsWith('image/')
      );
      
      const newTasks = imageFiles.map(file => createTaskFromFile(file));
      tasks.value = [...tasks.value, ...newTasks];
      
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

      try {
        const resultBlob = await removeBackground(task.file, config);
        
        if (task.resultUrl) {
          URL.revokeObjectURL(task.resultUrl);
        }
        
        task.resultBlob = resultBlob;
        task.resultUrl = URL.createObjectURL(resultBlob);
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
      
      const index = tasks.value.indexOf(task);
      if (index > -1) {
        tasks.value.splice(index, 1);
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
      });
      tasks.value = [];
    };

    const downloadSingle = (task: ImageTask) => {
      if (!task.resultBlob) return;
      
      const link = document.createElement('a');
      const baseName = task.name.replace(/\.[^/.]+$/, '');
      link.href = task.resultUrl || '';
      link.download = `${baseName}_no_bg.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const downloadAllAsZip = async () => {
      const completedTasks = tasks.value.filter(t => 
        t.status === 'completed' && t.resultBlob
      );
      
      if (completedTasks.length === 0) return;
      
      isGeneratingZip.value = true;
      zipProgress.value = 0;
      
      try {
        const zip = new JSZip();
        const totalFiles = completedTasks.length;
        
        for (let i = 0; i < completedTasks.length; i++) {
          const task = completedTasks[i];
          const baseName = task.name.replace(/\.[^/.]+$/, '');
          const fileName = `${baseName}_no_bg.png`;
          
          const arrayBuffer = await task.resultBlob!.arrayBuffer();
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
    });

    onUnmounted(() => {
      stopProgressAnimation();
      tasks.value.forEach(task => {
        if (task.originalUrl) {
          URL.revokeObjectURL(task.originalUrl);
        }
        if (task.resultUrl) {
          URL.revokeObjectURL(task.resultUrl);
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
      getStatusText
    };
  }
};
</script>

<template>
  <div id="app">
    <header class="app-header">
      <h1>Background Removal</h1>
      <p class="subtitle">Batch image processing with AI</p>
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
          {{ isPreloading ? 'Loading model...' : 'Drag & drop images here or click to browse' }}
        </p>
        <p class="upload-hint">Supports: JPG, PNG, WebP, GIF (multiple files)</p>
      </div>

      <div v-if="hasTasks" class="queue-controls">
        <div class="stats-row">
          <div class="stat-item">
            <span class="stat-value">{{ queueStats.total }}</span>
            <span class="stat-label">Total</span>
          </div>
          <div class="stat-item processing">
            <span class="stat-value">{{ queueStats.processing }}</span>
            <span class="stat-label">Processing</span>
          </div>
          <div class="stat-item completed">
            <span class="stat-value">{{ queueStats.completed }}</span>
            <span class="stat-label">Done</span>
          </div>
          <div class="stat-item failed" v-if="queueStats.failed > 0">
            <span class="stat-value">{{ queueStats.failed }}</span>
            <span class="stat-label">Failed</span>
          </div>
          <div class="stat-item" v-if="queueStats.estimatedTimeRemaining > 0">
            <span class="stat-value">{{ formatTime(queueStats.estimatedTimeRemaining) }}</span>
            <span class="stat-label">ETA</span>
          </div>
        </div>

        <div class="actions-row">
          <button
            v-if="queueStats.failed > 0"
            class="btn-secondary"
            @click="retryAllFailed"
          >
            Retry Failed ({{ queueStats.failed }})
          </button>
          <button
            v-if="hasCompletedTasks"
            class="btn-primary"
            :disabled="isGeneratingZip"
            @click="downloadAllAsZip"
          >
            <span v-if="isGeneratingZip">
              Generating ZIP... {{ zipProgress }}%
            </span>
            <span v-else>
              Download All as ZIP ({{ queueStats.completed }})
            </span>
          </button>
          <button class="btn-danger" @click="clearAll">
            Clear All
          </button>
        </div>
      </div>

      <div v-if="hasTasks" class="task-list">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="task-card"
          :class="{ 'task-failed': task.status === 'failed' }"
        >
          <div class="task-preview">
            <div class="preview-original">
              <img :src="task.originalUrl" :alt="task.name" />
              <span class="preview-label">Original</span>
            </div>
            <div class="preview-arrow">→</div>
            <div class="preview-result" :class="{ 'has-result': task.resultUrl }">
              <img
                v-if="task.resultUrl"
                :src="task.resultUrl"
                :alt="task.name + ' (processed)'"
              />
              <div v-else class="preview-placeholder">
                <span v-if="task.status === 'pending'">Waiting...</span>
                <span v-else-if="task.status === 'processing'">{{ task.progressText }}</span>
                <span v-else-if="task.status === 'failed'">Failed</span>
              </div>
              <span class="preview-label">Result</span>
            </div>
          </div>

          <div class="task-info">
            <div class="task-header">
              <span class="task-name">{{ task.name }}</span>
              <span :class="['status-badge', getStatusBadgeClass(task.status)]">
                {{ getStatusText(task.status) }}
              </span>
            </div>
            
            <div class="task-meta">
              <span class="task-size">{{ formatFileSize(task.file.size) }}</span>
              <span v-if="task.processingTime > 0" class="task-time">
                Time: {{ formatTime(task.processingTime / 1000) }}
              </span>
              <span v-if="task.retryCount > 0" class="task-retries">
                Retry: {{ task.retryCount }}/{{ MAX_RETRIES }}
              </span>
            </div>

            <div v-if="task.status === 'processing'" class="progress-bar">
              <div class="progress-fill" :style="{ width: task.displayProgress + '%' }"></div>
              <span class="progress-text">{{ task.progressText }} ({{ Math.round(task.displayProgress) }}%)</span>
            </div>

            <div v-if="task.error" class="task-error">
              {{ task.error }}
            </div>
          </div>

          <div class="task-actions">
            <button
              v-if="task.status === 'completed'"
              class="btn-action btn-download"
              @click="downloadSingle(task)"
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              <span>下载</span>
            </button>
            <button
              v-if="task.status === 'failed' && task.retryCount < MAX_RETRIES"
              class="btn-action btn-retry"
              @click="retryTask(task)"
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
              </svg>
              <span>重试</span>
            </button>
            <button
              class="btn-action btn-delete"
              @click="removeTask(task)"
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
              <span>删除</span>
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="!isPreloading" class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" width="64" height="64">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
        </div>
        <h2>No images yet</h2>
        <p>Upload images above to start removing backgrounds</p>
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
  margin-bottom: 30px;
}

.app-header h1 {
  margin: 0 0 8px 0;
  font-size: 2.5rem;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  opacity: 0.9;
  font-size: 1.1rem;
}

.preload-banner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  font-size: 0.9rem;
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
  max-width: 1200px;
  margin: 0 auto;
}

.upload-area {
  background: white;
  border: 3px dashed #cbd5e1;
  border-radius: 16px;
  padding: 60px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 24px;
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
  margin-bottom: 16px;
}

.upload-icon svg {
  fill: #94a3b8;
}

.upload-text {
  margin: 0 0 8px 0;
  font-size: 1.25rem;
  font-weight: 500;
  color: #475569;
}

.upload-hint {
  margin: 0;
  font-size: 0.9rem;
  color: #94a3b8;
}

.queue-controls {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.stats-row {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #475569;
}

.stat-label {
  font-size: 0.85rem;
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
  gap: 12px;
  flex-wrap: wrap;
}

.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
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

.task-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
}

.task-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.task-card.task-failed {
  border-left: 4px solid #ef4444;
}

.task-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.preview-original,
.preview-result {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(45deg, #f0f0f0 25%, transparent 25%), 
              linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), 
              linear-gradient(45deg, transparent 75%, #f0f0f0 75%), 
              linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}

.preview-original img,
.preview-result img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 0.75rem;
  text-align: center;
  padding: 8px;
}

.preview-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 0.7rem;
  padding: 2px 4px;
  text-align: center;
}

.preview-arrow {
  font-size: 1.5rem;
  color: #94a3b8;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.task-name {
  font-weight: 500;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  flex-shrink: 0;
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

.task-meta {
  display: flex;
  gap: 16px;
  font-size: 0.85rem;
  color: #94a3b8;
  margin-bottom: 8px;
}

.progress-bar {
  position: relative;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 4px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #8b5cf6 50%, #764ba2 100%);
  border-radius: 4px;
  transition: width 0.1s linear;
  position: relative;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.progress-text {
  position: absolute;
  top: -22px;
  left: 0;
  font-size: 0.85rem;
  color: #475569;
  font-weight: 500;
}

.task-error {
  font-size: 0.85rem;
  color: #ef4444;
  margin-top: 8px;
  padding: 8px;
  background: #fef2f2;
  border-radius: 6px;
}

.task-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.btn-action {
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s ease;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
}

.btn-action svg {
  flex-shrink: 0;
}

.btn-download {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-download svg {
  fill: white;
}

.btn-download:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-retry {
  background: #fef3c7;
  color: #d97706;
}

.btn-retry svg {
  fill: #d97706;
}

.btn-retry:hover {
  background: #fde68a;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(217, 119, 6, 0.2);
}

.btn-delete {
  background: #fee2e2;
  color: #dc2626;
}

.btn-delete svg {
  fill: #dc2626;
}

.btn-delete:hover {
  background: #fecaca;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(220, 38, 38, 0.2);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: white;
}

.empty-icon svg {
  fill: rgba(255, 255, 255, 0.4);
}

.empty-state h2 {
  margin: 16px 0 8px 0;
  font-size: 1.5rem;
}

.empty-state p {
  margin: 0;
  opacity: 0.8;
}

@media (max-width: 768px) {
  .app-header h1 {
    font-size: 1.75rem;
  }
  
  .task-card {
    flex-direction: column;
    align-items: stretch;
  }
  
  .task-preview {
    justify-content: center;
  }
  
  .stats-row {
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .actions-row {
    justify-content: center;
  }

  .task-actions {
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn-action {
    padding: 10px 16px;
    font-size: 0.9rem;
  }
}
</style>
