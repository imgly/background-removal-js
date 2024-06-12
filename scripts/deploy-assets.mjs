import chalk from 'chalk';
import { exec } from 'child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'util';

const execAsync = promisify(exec);

const execAsyncWithErrors = async (command, options) => {
  try {
    const { stdout, stderr } = await execAsync(command, options);
  } catch (error) {
    throw error;
  }
};

async function syncToS3() {
  try {
    // Load package.json
    const packageJson = JSON.parse(await readFile('./package.json', 'utf8'));
    const version = process.argv[2] || packageJson.version;

    if (!version || version === 'next') {
      throw new Error(`Version "${version}" is invalid.`);
    }

    // Get the endpoint URL from an environment variable
    const endpointUrl = process.env.S3_ENDPOINT_URL;
    if (!endpointUrl) {
      throw new Error('S3_ENDPOINT_URL environment variable is not set.');
    }
    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set.');
    }

    const packageNames = {
      'packages/node': '@imgly/background-removal-node',
      'packages/web': '@imgly/background-removal',
      'packages/web-data': '@imgly/background-removal-data'
    };

    await Promise.allSettled(
      Object.entries(packageNames).map(async ([path, packageName]) => {
        console.error(
          `${chalk.red(
            `NOTE: Syncing might fail when aws client ist not installed nor configured in silence!`
          )}`
        );
        // cwd based on package name:
        const cwd = path;
        // npm packing:
        await execAsyncWithErrors(
          `rm -rf ./${path}/tmp && mkdir -p ./${path}/tmp`
        );
        // we pack the package to also publish the package.tgz to s3
        const packCommand = `npm pack . --pack-destination ./tmp`;
        console.log(`Packing ${packageName} using ${packCommand}...`);
        await execAsyncWithErrors(packCommand, { cwd });
        // rename the .tgz from e.g imgly-background-removal-data-1.5.3.tgz to package.tgz to have a stable name
        await execAsyncWithErrors('mv ./tmp/*.tgz ./tmp/package.tgz', { cwd });
        // npm extract:
        const extractCommand = `tar -xvzf ./tmp/* -C ./tmp --strip-components=1`;
        console.log(`Extracting ${packageName} using ${extractCommand}...`);
        await execAsyncWithErrors(extractCommand, { cwd });
        // sync to s3:
        console.log(`Syncing ${packageName} to S3...`);
        const command = `aws s3 sync --endpoint-url ${endpointUrl} ./${path}/tmp s3://${bucketName}/${packageName}/${version}`;
        console.log(`Command: ${command}`);
        return await execAsyncWithErrors(command);
      })
    );

    console.log('S3 sync complete.');
  } catch (error) {
    console.error('Error during S3 sync:', error);
  }
}

syncToS3();
