'use client';

import CreativeEditorSDK, { Configuration } from '@cesdk/cesdk-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface CreativeEditorProps extends React.HTMLAttributes<HTMLDivElement> {
  config?: Partial<Configuration>;
  configure?: (instance: CreativeEditorSDK) => Promise<void>;
  onInstanceChange?: (instance: CreativeEditorSDK | undefined) => void;
}

export default function CreativeEditor({
  config = undefined,
  configure = undefined,
  onInstanceChange = undefined,
  ...rest
}: CreativeEditorProps) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let instance: CreativeEditorSDK | null = null;
    let removed = false;
    CreativeEditorSDK.create(container, config ?? {}).then(
      async (_instance) => {
        if (removed) {
          _instance.dispose();
          return;
        }

        instance = _instance;
        if (configure) {
          await configure(instance);
        }
        if (onInstanceChange) {
          onInstanceChange(instance);
        }
      }
    );
    const cleanup = () => {
      removed = true;
      instance?.dispose();
      instance = null;
      if (onInstanceChange) {
        onInstanceChange(undefined);
      }
    };
    return cleanup;
  }, [containerRef, config, configure, onInstanceChange]);

  return <div ref={containerRef} {...rest}></div>;
}

// These typed hooks allow for autocomplete inside jsx files
export const useConfig = useMemo<Partial<Configuration>>;
export const useConfigure = useCallback<
  (instance: CreativeEditorSDK) => Promise<void>
>;
export const useCreativeEditor = useState<CreativeEditorSDK | undefined>;
export const useCreativeEditorRef = useRef<CreativeEditorSDK | undefined>;
