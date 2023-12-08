import { readFile } from 'node:fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function syncToS3() {
  try {
    // Load package.json
    const packageJson = JSON.parse(await readFile('./package.json', 'utf8'));
    const version = packageJson.version;

    // Get the endpoint URL from an environment variable
    const endpointUrl = process.env.S3_ENDPOINT_URL;
    if (!endpointUrl) {
      throw new Error('S3_ENDPOINT_URL environment variable is not set.');
    }
    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set.');
    }

    // Construct S3 sync commands
    const command1 = `aws s3 sync --endpoint-url ${endpointUrl} ./packages/node/dist s3://${bucketName}/@imgly/background-removal-node/${version}/dist`;
    const command2 = `aws s3 sync --endpoint-url ${endpointUrl} ./packages/web/dist s3://${bucketName}/@imgly/background-removal/${version}/dist`;

    // Execute commands
    await execAsync(command1);
    await execAsync(command2);

    console.log('S3 sync complete.');
  } catch (error) {
    console.error('Error during S3 sync:', error);
  }
}

syncToS3();
