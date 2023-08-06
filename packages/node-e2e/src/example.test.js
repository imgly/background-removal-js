const pkg = require('@imgly/background-removal-node');
const removeBackground = pkg.default;
const path = require('path');
const FixturesPath = path.resolve('fixtures');

// Test case to ensure the system doesn't crash with valid inputs
test.only('removeBackground should not crash with valid inputs', async () => {
  const image = `file://${path.resolve(
    FixturesPath,
    'images',
    'photo-1686002359940-6a51b0d64f68.jpeg'
  )}`;
  const config = {
    debug: false,
    proxyToWorker: false,
    fetchArgs: {},
    model: 'medium'
  };

  await expect(removeBackground(image, config)).resolves.toBeInstanceOf(Blob);
});
