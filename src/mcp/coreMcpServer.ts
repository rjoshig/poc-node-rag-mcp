import http from 'node:http';
import { mcpRequestSchema, ToolName } from './contracts';
import { config } from '../utils/config';
import { handleChatAnswer, handleConfigGenerate, handleRagAnswer, handleRagSearch } from './toolHandlers';

function writeJson(res: http.ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function routeTool(tool: ToolName, args: unknown) {
  if (tool === ToolName.ChatAnswer) return handleChatAnswer(args);
  if (tool === ToolName.RagSearch) return handleRagSearch(args);
  if (tool === ToolName.RagAnswer) return handleRagAnswer(args);
  return handleConfigGenerate(args);
}

export function startCoreMcpServer(port = config.mcpPort) {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      return writeJson(res, 200, { ok: true, service: 'core-mcp' });
    }

    if (req.method === 'POST' && req.url === '/mcp') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', async () => {
        try {
          const payload = mcpRequestSchema.parse(JSON.parse(body || '{}'));
          const response = await routeTool(payload.tool, payload.arguments);
          writeJson(res, response.success ? 200 : 400, response);
        } catch (error) {
          writeJson(res, 400, {
            success: false,
            route: 'invalid',
            errors: [error instanceof Error ? error.message : String(error)]
          });
        }
      });
      return;
    }

    writeJson(res, 404, { success: false, error: 'not_found' });
  });

  server.listen(port, () => {
    console.log(`Core MCP server running on http://localhost:${port}`);
  });

  return server;
}
