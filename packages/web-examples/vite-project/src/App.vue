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

    const currentImageIndex = ref(0);
    const displayImageUrl = ref('');
    const isProcessing = ref(false);
    const isPreloading = ref(true);
    const seconds = ref(0);
    const startDate = ref(Date.now());
    const caption = ref('Loading model...');
    let interval = null;

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
      () => isProcessing.value,
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

    const getCurrentOriginalImage = () => {
      if (imageParam) {
        return imageParam;
      }
      return images[currentImageIndex.value];
    };

    const buttonDisabled = computed(() => {
      return isProcessing.value || isPreloading.value;
    });

    const buttonText = computed(() => {
      if (isPreloading.value) {
        return 'Loading model...';
      }
      if (isProcessing.value) {
        return 'Processing...';
      }
      return 'Remove Background';
    });

    const buttonSegmentText = computed(() => {
      if (isPreloading.value) {
        return 'Loading model...';
      }
      if (isProcessing.value) {
        return 'Processing...';
      }
      return 'Segment Mask';
    });

    const selectNextImage = () => {
      if (imageParam) {
        displayImageUrl.value = imageParam;
        return;
      }
      currentImageIndex.value = (currentImageIndex.value + 1) % images.length;
      displayImageUrl.value = images[currentImageIndex.value];
    };

    const processCurrentImage = async (type) => {
      if (isProcessing.value) {
        return;
      }

      const imageToProcess = getCurrentOriginalImage();

      isProcessing.value = true;
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
        displayImageUrl.value = resultUrl;
        caption.value = 'Done! Click to process another image';
      } catch (error) {
        console.error('Processing failed:', error);
        caption.value = 'Processing failed, please try again';
      } finally {
        isProcessing.value = false;
      }
    };

    const load = async (type) => {
      if (isPreloading.value || isProcessing.value) {
        return;
      }

      selectNextImage();
      await processCurrentImage(type);
    };

    onMounted(() => {
      selectNextImage();
      
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
      displayImageUrl,
      isProcessing,
      isPreloading,
      seconds,
      caption,
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
      <img :src="displayImageUrl" alt="logo" />
      <p>{{ caption }}</p>
      <p v-if="isProcessing">Processing: {{ seconds }} s</p>
      <p v-else-if="isPreloading">Loading model and resources...</p>

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
