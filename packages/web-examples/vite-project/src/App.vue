<script>
import { ref, watch, onMounted, onUnmounted } from 'vue';

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
    const seconds = ref(0);
    const startDate = ref(Date.now());
    const caption = ref('Click me to remove background');
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
        caption.value = `${type} ${subtype} ${progress}%`;
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

    onMounted(async () => {
      try {
        await preload(config);
        console.log('Asset preloading succeeded');
      } catch (error) {
        console.error('Asset preloading failed:', error);
      }

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
      if (isRunning.value || currentLoadPromise) {
        console.log('Already processing, please wait...');
        return;
      }

      const selectedImage = image
        ? image
        : images[Math.floor(Math.random() * images.length)];

      isRunning.value = true;
      resetTimer();

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
        })();

        await currentLoadPromise;
      } catch (error) {
        console.error('Processing failed:', error);
        throw error;
      } finally {
        currentLoadPromise = null;
        isRunning.value = false;
        stopTimer();
      }
    };

    if (auto) load();

    return { imageUrl, isRunning, seconds, caption, load };
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
      <p>Processing: {{ seconds }} s</p>

      <button :disabled="isRunning" @click="load('remove')">
        Click me (removeBackground)
      </button>
      <button :disabled="isRunning" @click="load('segment')">
        Click me (applySegmentationMask)
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
