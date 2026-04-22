<script>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';

import {
  preload,
  removeBackground,
  removeForeground,
  segmentForeground,
  alphamask,
  applySegmentationMask
} from '@imgly/background-removal';

export default {
  name: 'App',
  setup() {
    const images = [
      'https://images.unsplash.com/photo-1656408308602-05835d990fb1?q=80&w=3200&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'https://images.unsplash.com/photo-1686002359940-6a51b0d64f68?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1024&q=80',
      'https://images.unsplash.com/photo-1590523278191-995cbcda646b?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=1080&fit=max&ixid=eyJhcHBfaWQiOjEyMDd9',
      'https://images.unsplash.com/photo-1709248835088-03bb0946d6ab?q=80&w=3387&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    ];

    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const imageParam = params.get('image');
    const auto = params.get('auto') || false;

    const currentImageIndex = ref(Math.floor(Math.random() * images.length));
    const imageUrl = ref(imageParam || images[currentImageIndex.value]);
    const isShowingResult = ref(false);
    const isRunning = ref(false);
    const isPreloading = ref(true);
    const seconds = ref(0);
    const startDate = ref(Date.now());
    const caption = ref('Loading model...');
    let interval = null;
    let currentLoadPromise = null;

    const publicPath = new URL(import.meta.url);
    publicPath.pathname = '/js/';
    const config = {
      debug: false,
      publicPath: publicPath.href,
      progress: (key, current, total) => {
        const [type, subtype] = key.split(':');
        const progress = ((current / total) * 100).toFixed(0);
        if (type === 'fetch') {
          caption.value = `Loading: ${progress}%`;
        } else if (type === 'compute') {
          caption.value = `Processing: ${subtype} ${progress}%`;
        }
      },
      rescale: true,
      device: 'cpu',
      model: 'isnet_quint8',
      output: {
        quality: 0.8,
        format: 'image/png'
      }
    };

    const calculateSecondsBetweenDates = (startDate, endDate) => {
      const milliseconds = endDate - startDate;
      const seconds = (milliseconds / 1000.0).toFixed(1);
      return seconds;
    };

    watch(
      () => isRunning.value,
      (newVal) => {
        if (newVal) {
          interval = setInterval(() => {
            seconds.value = calculateSecondsBetweenDates(
              startDate.value,
              Date.now()
            );
          }, 100);
        } else {
          clearInterval(interval);
        }
      }
    );

    const buttonDisabled = computed(() => {
      return isRunning.value || isPreloading.value;
    });

    const buttonText = computed(() => {
      if (isPreloading.value) {
        return 'Loading model...';
      }
      if (isRunning.value) {
        return 'Processing...';
      }
      if (isShowingResult.value) {
        return 'Next Image';
      }
      return 'Remove Background';
    });

    const buttonSegmentText = computed(() => {
      if (isPreloading.value) {
        return 'Loading model...';
      }
      if (isRunning.value) {
        return 'Processing...';
      }
      if (isShowingResult.value) {
        return 'Next Image';
      }
      return 'Segment Mask';
    });

    const statusText = computed(() => {
      if (isPreloading.value) {
        return 'Loading model and resources...';
      }
      if (isRunning.value) {
        return `Processing: ${seconds.value} s`;
      }
      if (isShowingResult.value) {
        return 'Done! Click "Next Image" to process another image';
      }
      return 'Click "Remove Background" to process the current image';
    });

    const getCurrentOriginalImage = () => {
      if (imageParam) {
        return imageParam;
      }
      return images[currentImageIndex.value];
    };

    const goToNextImage = () => {
      if (isRunning.value) {
        return;
      }

      if (imageParam) {
        imageUrl.value = imageParam;
        isShowingResult.value = false;
        caption.value = 'Click "Remove Background" to process the current image';
        return;
      }

      currentImageIndex.value = (currentImageIndex.value + 1) % images.length;
      imageUrl.value = images[currentImageIndex.value];
      isShowingResult.value = false;
      caption.value = 'Click "Remove Background" to process the current image';
    };

    const processCurrentImage = async (type) => {
      if (isRunning.value || currentLoadPromise) {
        return;
      }

      const imageToProcess = getCurrentOriginalImage();

      isRunning.value = true;
      startDate.value = Date.now();
      seconds.value = 0;
      caption.value = 'Processing image...';

      try {
        let imageBlob;
        if (type === 'remove') {
          imageBlob = await removeBackground(imageToProcess, config);
        } else {
          const maskBlob = await segmentForeground(imageToProcess, config);
          imageBlob = await applySegmentationMask(imageToProcess, maskBlob, config);
        }

        const resultUrl = URL.createObjectURL(imageBlob);
        imageUrl.value = resultUrl;
        isShowingResult.value = true;
        caption.value = 'Done! Click "Next Image" to process another image';
      } catch (error) {
        console.error('Processing failed:', error);
        caption.value = 'Processing failed, please try again';
      } finally {
        currentLoadPromise = null;
        isRunning.value = false;
      }
    };

    const load = async (type) => {
      if (isPreloading.value || isRunning.value) {
        return;
      }

      if (isShowingResult.value) {
        goToNextImage();
        return;
      }

      currentLoadPromise = processCurrentImage(type);
      await currentLoadPromise;
    };

    onMounted(() => {
      preload(config)
        .then(() => {
          console.log('Asset preloading succeeded');
          isPreloading.value = false;
          caption.value = 'Click "Remove Background" to process the current image';
        })
        .catch((error) => {
          console.error('Asset preloading failed:', error);
          isPreloading.value = false;
          caption.value = 'Ready (will load on first use)';
        });
    });

    onUnmounted(() => {
      clearInterval(interval);
    });

    const checkAndAutoLoad = () => {
      if (!isPreloading.value) {
        load('remove');
      } else {
        setTimeout(checkAndAutoLoad, 100);
      }
    };

    if (auto) {
      checkAndAutoLoad();
    }

    return {
      imageUrl,
      isRunning,
      isPreloading,
      isShowingResult,
      seconds,
      caption,
      statusText,
      buttonDisabled,
      buttonText,
      buttonSegmentText,
      load
    };
  }
};
</script>

<style scoped>
/* Add your styles here */
</style>

<template>
  <div id="app">
    <header>
      <img :src="imageUrl" alt="logo" />
      <p>{{ caption }}</p>
      <p v-if="isRunning">Processing: {{ seconds }} s</p>
      <p v-else-if="isPreloading">Loading model and resources...</p>
      <p v-else-if="isShowingResult">Ready for next image</p>

      <button :disabled="buttonDisabled" @click="load('remove')">
        {{ buttonText }}
      </button>
      <button :disabled="buttonDisabled" @click="load('segment')">
        {{ buttonSegmentText }}
      </button>
    </header>
  </div>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}

button:not(:last-child) {
  margin-right: 1em;
}
</style>
