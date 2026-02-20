import fs from 'node:fs/promises';
import { config } from './utils/config';
import { startBackroadApp } from './backroad/backroadApp';
import { startCoreMcpServer } from './mcp/coreMcpServer';

async function bootstrap() {
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.mkdir(config.processedDir, { recursive: true });
  startCoreMcpServer(config.mcpPort);
  await startBackroadApp();
}

bootstrap().catch((error) => {
  console.error('Startup failure:', error);
  process.exit(1);
});
