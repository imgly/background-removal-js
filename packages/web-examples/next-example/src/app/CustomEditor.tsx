'use client';

import CreativeEditor, { useConfig, useConfigure } from './CreativeEditor';

export default function CustomEditor() {
  const config = useConfig(
    () => ({
      license: process.env.NEXT_PUBLIC_LICENSE
    }),
    []
  );

  const configure = useConfigure(async (instance) => {
    await instance.addDefaultAssetSources();
    await instance.addDemoAssetSources({ sceneMode: 'Design' });
    instance.createDesignScene();
  }, []);

  return (
    <div
      style={{
        minHeight: '100svh'
      }}
    >
      <CreativeEditor
        configure={configure}
        config={config}
        style={{
          position: 'absolute',
          inset: 0
        }}
      />
    </div>
  );
}
