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
    const image = params.get('image');
    const auto = params.get('auto') || false;
    const randomImage = image
      ? image
      : images[Math.floor(Math.random() * images.length)];

    const imageUrl = ref(randomImage);
    const isRunning = ref(false);
    const isPreloading = ref(true);
    const seconds = ref(0);
    const startDate = ref(Date.now());
    const caption = ref('Loading model...');
    const progressInfo = ref('');
    let interval = null;
    let currentLoadPromise = null;

    const publicPath = new URL(import.meta.url);
    publicPath.pathname = '/js/';
    const config = {
      debug: true,
      publicPath: publicPath.href,
      progress: (key, current, total) => {
        const [type, subtype] = key.split(':');
        const progress = ((current / total) * 100).toFixed(0);
        if (type === 'fetch') {
          progressInfo.value = `Downloading ${subtype}: ${progress}%`;
        } else if (type === 'compute') {
          progressInfo.value = `Processing: ${subtype} ${progress}%`;
        }
        caption.value = progressInfo.value;
        console.log(`[Progress] ${type} ${subtype}: ${progress}%`);
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

    onMounted(() => {
      preload(config)
        .then(() => {
          console.log('Asset preloading succeeded');
          isPreloading.value = false;
          caption.value = 'Click me to remove background';
        })
        .catch((error) => {
          console.error('Preload failed:', error);
          isPreloading.value = false;
          caption.value = 'Ready (preload failed, will load on first use)';
        });

      if (isRunning.value) {
        interval = setInterval(() => {
          seconds.value = calculateSecondsBetweenDates(
            startDate.value,
            Date.now()
          );
        }, 100);
      }
    });

    onUnmounted(() => {
      clearInterval(interval);
    });

    const resetTimer = () => {
      isRunning.value = true;
      startDate.value = Date.now();
      seconds.value = 0;
    };

    const stopTimer = () => {
      isRunning.value = false;
    };

    const load = async (type) => {
      if (isRunning.value) {
        console.log('Already processing, please wait...');
        return;
      }

      if (currentLoadPromise) {
        console.log('Waiting for previous operation...');
        return;
      }

      const selectedImage = image
        ? image
        : images[Math.floor(Math.random() * images.length)];

      isRunning.value = true;
      resetTimer();
      caption.value = 'Processing image...';

      const originalImageUrl = imageUrl.value;

      try {
        currentLoadPromise = (async () => {
          let imageBlob;
          if (type === 'remove') {
            imageBlob = await removeBackground(selectedImage, config);
          } else {
            const maskBlob = await segmentForeground(selectedImage, config);
            console.log(maskBlob);
            imageBlob = await applySegmentationMask(selectedImage, maskBlob, config);
          }
          console.log(imageBlob);

          const resultUrl = URL.createObjectURL(imageBlob);
          imageUrl.value = resultUrl;
          caption.value = 'Done! Click to process another image';
        })();

        await currentLoadPromise;
      } catch (error) {
        console.error('Processing failed:', error);
        imageUrl.value = originalImageUrl;
        caption.value = 'Processing failed, please try again';
      } finally {
        currentLoadPromise = null;
        isRunning.value = false;
        stopTimer();
      }
    };

    if (auto) {
      const checkAndLoad = () => {
        if (!isPreloading.value) {
          load('remove');
        } else {
          setTimeout(checkAndLoad, 100);
        }
      };
      checkAndLoad();
    }

    return { imageUrl, isRunning, isPreloading, seconds, caption, buttonDisabled, load };
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

      <button :disabled="buttonDisabled" @click="load('remove')">
        <span v-if="isPreloading">Loading model...</span>
        <span v-else-if="isRunning">Processing...</span>
        <span v-else>Click me (removeBackground)</span>
      </button>
      <button :disabled="buttonDisabled" @click="load('segment')">
        <span v-if="isPreloading">Loading model...</span>
        <span v-else-if="isRunning">Processing...</span>
        <span v-else>Click me (applySegmentationMask)</span>
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
