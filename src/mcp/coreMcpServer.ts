import http from 'node:http';
import crypto from 'node:crypto';
import { mcpRequestSchema, ToolName } from './contracts';
import { config } from '../utils/config';
import { handleChatAnswer, handleConfigGenerate, handleRagAnswer, handleRagSearch } from './toolHandlers';
import { devError, devLog } from '../utils/devLog';

function writeJson(res: http.ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function routeTool(tool: ToolName, args: unknown) {
  if (tool === ToolName.ChatAnswer) {
    devLog('mcp.route', 'routing tool to handler', { tool, handler: 'handleChatAnswer' });
    return handleChatAnswer(args);
  }
  if (tool === ToolName.RagSearch) {
    devLog('mcp.route', 'routing tool to handler', { tool, handler: 'handleRagSearch' });
    return handleRagSearch(args);
  }
  if (tool === ToolName.RagAnswer) {
    devLog('mcp.route', 'routing tool to handler', { tool, handler: 'handleRagAnswer' });
    return handleRagAnswer(args);
  }
  devLog('mcp.route', 'routing tool to handler', { tool, handler: 'handleConfigGenerate' });
  return handleConfigGenerate(args);
}

export function startCoreMcpServer(port = config.mcpPort) {
  const server = http.createServer((req, res) => {
    const reqId = crypto.randomUUID().slice(0, 8);

    if (req.method === 'GET' && req.url === '/health') {
      return writeJson(res, 200, { ok: true, service: 'core-mcp' });
    }

    if (req.method === 'POST' && req.url === '/mcp') {
      const start = Date.now();
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', async () => {
        try {
          devLog('mcp', `[${reqId}] request received`, { bodyBytes: body.length });
          const payload = mcpRequestSchema.parse(JSON.parse(body || '{}'));
          const argumentKeys = Object.keys(payload.arguments ?? {});
          devLog('mcp', `[${reqId}] parsed request`, { tool: payload.tool, argumentKeys });

          const response = await routeTool(payload.tool, payload.arguments);
          devLog('mcp', `[${reqId}] response ready`, {
            route: response.route,
            success: response.success,
            latencyMs: Date.now() - start,
            confidence: response.confidence,
            errors: response.errors?.length ?? 0
          });

          writeJson(res, response.success ? 200 : 400, response);
        } catch (error) {
          devError('mcp', `[${reqId}] request failed`, error instanceof Error ? error.message : String(error));
          writeJson(res, 400, {
            success: false,
            route: 'invalid',
            errors: [error instanceof Error ? error.message : String(error)]
          });
        }
      });
      return;
    }

    devLog('mcp', `[${reqId}] not found`, { method: req.method, url: req.url });
    writeJson(res, 404, { success: false, error: 'not_found' });
  });

  server.listen(port, () => {
    console.log(`Core MCP server running on http://localhost:${port}`);
  });

  return server;
}
