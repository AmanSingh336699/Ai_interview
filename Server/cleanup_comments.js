import fs from 'fs/promises';
import path from 'path';
import strip from 'strip-comments';

const SRC_DIR = './src';

async function processDirectory(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await processDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        // Use strip-comments to remove all comments
        const stripped = strip(content);
        await fs.writeFile(fullPath, stripped, 'utf8');
        console.log(`Processed: ${fullPath}`);
      } catch (fileError) {
        console.error(`Failed to process ${fullPath}:`, fileError);
      }
    }
  }
}

async function run() {
  console.log('🚀 Starting comment removal cleanup in ./src...');
  try {
    await processDirectory(SRC_DIR);
    console.log('\n✅ All comments removed successfully from all .js files.');
  } catch (error) {
    console.error('\n❌ Critical error during cleanup:', error);
    process.exit(1);
  }
}

run();
