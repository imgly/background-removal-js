const path = require('path');
const pkg = require('./package.json');

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === 'development';
  const publicPath = isDevelopment
    ? undefined
    : `https://unpkg.com/${pkg.name}@${pkg.version}/dist/`;

  const commonConfig = {
    devtool: 'source-map',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.(png|jpeg|jpg)$/i,
          type: 'asset/resource',
          generator: {
            publicPath: publicPath
          }
        },
        {
          test: /\.(onnx)$/i,
          type: 'asset/resource',
          generator: {
            publicPath: publicPath
          }
        },
        {
          test: /\.(wasm)$/i,
          type: 'asset/resource',
          generator: {
            publicPath: publicPath
          }
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    optimization: {
      splitChunks: {
        chunks: 'async'
      }
    }
  };

  const esmConfig = {
    ...commonConfig,
    experiments: {
      outputModule: true // needed for esm
    },
    entry: './src/browser.ts',
    target: 'web',
    output: {
      filename: 'browser.esm.js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: publicPath,
      library: {
        type: 'module'
      }
    }
  };

  const nodeConfig = {
    ...commonConfig,
    entry: './src/node.ts',
    target: 'node',
    output: {
      filename: 'node.js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        type: 'umd',
        name: 'backgroundRemoval'
      }
    }
  };

  return [esmConfig];
};
