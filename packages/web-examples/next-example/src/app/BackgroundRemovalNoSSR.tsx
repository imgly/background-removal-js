'use client';
import dynamic from 'next/dynamic';

const BackgroundRemovalNoSSR = dynamic(() => import('./BackgroundRemoval'), {
  ssr: false
});

export default BackgroundRemovalNoSSR;
