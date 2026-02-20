const http = require('http');
const { URL } = require('url');

const config = require('../config');
const { allTools } = require('./tools');

let mcpSdkServer = null;
try {
  const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
  mcpSdkServer = new McpServer({ name: 'poc-node-rag-mcp', version: '1.0.0' });

  for (const tool of allTools) {
    mcpSdkServer.tool(tool.name, tool.description, tool.inputSchema.shape, async (args) => {
      const result = await tool.handler(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    });
  }
  console.log('MCP SDK tools registered.');
} catch (error) {
  console.warn('MCP SDK server initialization skipped/fallback:', error.message);
}

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function startMcpServer(port = config.mcpPort) {
  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && reqUrl.pathname === '/health') {
      return jsonResponse(res, 200, { ok: true, service: 'poc-node-rag-mcp' });
    }

    if (req.method === 'POST' && reqUrl.pathname === '/mcp') {
      try {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const toolName = payload.tool;
            const args = payload.arguments || {};
            const tool = allTools.find((t) => t.name === toolName);

            if (!tool) {
              return jsonResponse(res, 404, { error: `Unknown tool: ${toolName}` });
            }

            console.log(`Running tool: ${toolName}`, args);
            const result = await tool.handler(args);
            return jsonResponse(res, 200, { tool: toolName, result });
          } catch (error) {
            console.error('Tool execution error:', error.message);
            return jsonResponse(res, 400, { error: error.message });
          }
        });
      } catch (error) {
        return jsonResponse(res, 500, { error: error.message });
      }
      return;
    }

    return jsonResponse(res, 404, { error: 'Not found' });
  });

  server.listen(port, () => {
    console.log(`MCP HTTP server listening on http://localhost:${port}`);
    console.log('POST /mcp with { tool, arguments } to invoke tool.');
  });

  return server;
}

module.exports = {
  startMcpServer
};
