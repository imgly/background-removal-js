import { readFile } from 'node:fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

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
        console.log(`Syncing ${packageName} to S3...`);
        const command = `aws s3 sync --endpoint-url ${endpointUrl} ./${path}/dist s3://${bucketName}/${packageName}/${version}/dist`;
        console.log(`Command: ${command}`);
        return await execAsync(command);
      })
    );

    console.log('S3 sync complete.');
  } catch (error) {
    console.error('Error during S3 sync:', error);
  }
}

syncToS3();
