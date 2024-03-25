<script>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import {
  preload,
  removeBackground,
  removeForeground,
  segmentForeground,
  applySegmentationMask
} from '@imgly/background-removal';

export default {
  name: 'App',
  setup() {
    const images = [
      'https://images.unsplash.com/photo-1686002359940-6a51b0d64f68?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1024&q=80',
      'https://images.unsplash.com/photo-1590523278191-995cbcda646b?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=1080&fit=max&ixid=eyJhcHBfaWQiOjEyMDd9',
      'https://images.unsplash.com/photo-1709248835088-03bb0946d6ab?q=80&w=3387&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
    ];
    const randomImage = images[Math.floor(Math.random() * images.length)];
    const imageUrl = ref(randomImage);
    const isRunning = ref(false);
    const seconds = ref(0);
    const startDate = ref(Date.now());
    const caption = ref('Click me to remove background');
    let interval = null;

    const publicPath = new URL(import.meta.url);
    publicPath.pathname = '/js/';
    const config = {
      debug: false,
      // debug: true,
      publicPath: publicPath.href,
      progress: (key, current, total) => {
        const [type, subtype] = key.split(':');
        caption.value = `${type} ${subtype} ${((current / total) * 100).toFixed(
          0
        )}%`;
      },
      device: 'gpu',
      // device: 'cpu',
      // model: 'isnet',
      // model: 'isnet_fp16',
      // model: 'isnet_quint8',
      // model: 'modnet',
      // model: 'modnet_fp16', //# does not work on webgpu
      // model: 'modnet_quint8',
      output: {
        quality: 0.8,
        format: 'image/png'
        // format: 'image/jpeg'
        // format: 'image/webp'
        //format: 'image/x-rgba8'
        //format: 'image/x-alpha8'
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
      // Optional Preload all assets
      // await preload(config).then(() => {
      //   console.log('Asset preloading succeeded');
      // });
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

    const load = async () => {
      isRunning.value = true;
      resetTimer();

      imageUrl.value = randomImage;
      const imageBlob = await removeBackground(randomImage, config);
      // const imageBlob = await removeForeground(randomImage, config);
      // const imageBlob = await segmentForeground(randomImage, config);
      // const maskBlob = await segmentForeground(randomImage, {...config}); // use this format for maximum efficient
      // const imageBlob = await applySegmentationMask(randomImage, maskBlob, config)
      // console.log(maskBlob);
      console.log(imageBlob);
      const url = URL.createObjectURL(imageBlob);
      imageUrl.value = url;
      isRunning.value = false;
      stopTimer();
    };

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

      <button :disabled="isRunning" @click="load">Click me</button>
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
</style>
