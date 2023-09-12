<script>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import removeBackground from '@imgly/background-removal';

export default {
  name: 'App',
  setup() {
    const images = [
      'https://images.unsplash.com/photo-1686002359940-6a51b0d64f68?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1024&q=80',
      'https://images.unsplash.com/photo-1590523278191-995cbcda646b?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=1080&fit=max&ixid=eyJhcHBfaWQiOjEyMDd9'
    ];
    const randomImage = images[Math.floor(Math.random() * images.length)];
    const imageUrl = ref(randomImage);
    const isRunning = ref(false);
    const seconds = ref(0);
    const startDate = ref(Date.now());
    const caption = ref('Click me to remove background');
    let interval = null;

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

    onMounted(() => {
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

      const publicPath = new URL(import.meta.url);
      publicPath.pathname = '/js/';
      imageUrl.value = randomImage;
      const imageBlob = await removeBackground(randomImage, {
        publicPath: publicPath.href,
        progress: (key, current, total) => {
          const [type, subtype] = key.split(':');
          caption.value = `${type} ${subtype} ${(
            (current / total) *
            100
          ).toFixed(0)}%`;
        }
      });
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
