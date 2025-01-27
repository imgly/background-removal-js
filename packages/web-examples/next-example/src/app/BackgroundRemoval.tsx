'use client';

import {
  applySegmentationMask,
  Config,
  preload,
  removeBackground,
  segmentForeground
} from '@imgly/background-removal';
import { useEffect, useRef, useState } from 'react';

const images = [
  'https://images.unsplash.com/photo-1656408308602-05835d990fb1?q=80&w=3200&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1686002359940-6a51b0d64f68?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1024&q=80',
  'https://images.unsplash.com/photo-1590523278191-995cbcda646b?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=1080&fit=max&ixid=eyJhcHBfaWQiOjEyMDd9',
  'https://images.unsplash.com/photo-1709248835088-03bb0946d6ab?q=80&w=3387&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
];

const BackgroundRemoval = () => {
  const [imageUrl, setImageUrl] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState('0');
  const [startDate, setStartDate] = useState(Date.now());
  const [caption, setCaption] = useState('Click me to remove background');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const config: Config = {
    debug: false,
    progress: (key, current, total) => {
      const [type, subtype] = key.split(':');
      setCaption(`${type} ${subtype} ${((current / total) * 100).toFixed(0)}%`);
    },
    rescale: true,
    device: 'gpu',
    output: {
      quality: 0.8,
      format: 'image/png'
    }
  };

  const calculateSecondsBetweenDates = (start: number, end: number) => {
    const milliseconds = end - start;
    return (milliseconds / 1000.0).toFixed(1);
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const imageParam = params.get('image');
    const auto = params.get('auto') || false;

    const randomImage =
      imageParam || images[Math.floor(Math.random() * images.length)];
    setImageUrl(randomImage);

    const preloadAssets = async () => {
      try {
        await preload(config);
        console.log('Asset preloading succeeded');
        if (auto) load('remove');
      } catch (error) {
        console.error('Asset preloading failed:', error);
      }
    };

    preloadAssets();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds(calculateSecondsBetweenDates(startDate, Date.now()));
      }, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, startDate]);

  const resetTimer = () => {
    setIsRunning(true);
    setStartDate(Date.now());
    setSeconds('0');
  };

  const stopTimer = () => {
    setIsRunning(false);
  };

  const load = async (type: string) => {
    const params = new URLSearchParams(window.location.search);
    const imageParam = params.get('image');
    const randomImage =
      imageParam || images[Math.floor(Math.random() * images.length)];

    setIsRunning(true);
    resetTimer();
    setImageUrl(randomImage);

    try {
      let imageBlob;
      if (type === 'remove') {
        imageBlob = await removeBackground(randomImage, config);
      } else {
        const maskBlob = await segmentForeground(randomImage, config);
        imageBlob = await applySegmentationMask(randomImage, maskBlob, config);
      }

      const url = URL.createObjectURL(imageBlob);
      setImageUrl(url);
    } catch (error) {
      console.error('Processing failed:', error);
      setCaption('Processing failed');
    } finally {
      setIsRunning(false);
      stopTimer();
    }
  };

  return (
    <div id="app">
      <header>
        {/* // eslint-disable-next-line @next/next/no-img-element */}
        {imageUrl && <img src={imageUrl} alt="logo" />}
        <p>{caption}</p>
        <p>Processing: {seconds} s</p>
        <button disabled={isRunning} onClick={() => load('remove')}>
          Click me (removeBackground)
        </button>
        <button disabled={isRunning} onClick={() => load('segment')}>
          Click me (applySegmentationMask)
        </button>
      </header>
    </div>
  );
};

export default BackgroundRemoval;
