'use client';
import dynamic from 'next/dynamic';

const CustomEditorWithNoSSR = dynamic(() => import('./CustomEditor'), {
  ssr: false
});

export default CustomEditorWithNoSSR;
