import axios from 'axios';

/**
 * Model Context Protocol (MCP) Client
 * Enables Vani AI to call external MCP tools provided by founders,
 * custom server endpoints, or local MCP sidecars.
 */
class McpClient {
  constructor() {
    this.servers = new Map();
  }

  /**
   * Registers an MCP server endpoint
   */
  registerServer(serverId, config) {
    if (!serverId || !config?.url) {
      throw new Error('serverId and config.url are required');
    }
    this.servers.set(serverId, {
      id: serverId,
      name: config.name || serverId,
      url: config.url,
      headers: config.headers || {},
      registeredAt: new Date().toISOString()
    });
    return this.servers.get(serverId);
  }

  /**
   * Lists available servers
   */
  listServers() {
    return Array.from(this.servers.values());
  }

  /**
   * Lists tools available on a registered MCP server
   */
  async listTools(serverId) {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`MCP Server "${serverId}" not found`);
    }

    try {
      const response = await axios.post(
        `${server.url}/mcp`,
        {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/list',
          params: {}
        },
        { headers: { 'Content-Type': 'application/json', ...server.headers }, timeout: 10000 }
      );
      return response.data?.result?.tools || [];
    } catch (err) {
      console.warn(`[MCP] Failed to fetch tools from server "${serverId}":`, err.message);
      return [];
    }
  }

  /**
   * Executes a tool via MCP JSON-RPC protocol
   */
  async callTool(serverId, toolName, args = {}) {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`MCP Server "${serverId}" not found`);
    }

    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    const response = await axios.post(`${server.url}/mcp`, payload, {
      headers: { 'Content-Type': 'application/json', ...server.headers },
      timeout: 30000
    });

    if (response.data?.error) {
      const err = new Error(response.data.error.message || 'MCP tool execution failed');
      err.code = response.data.error.code;
      throw err;
    }

    return response.data?.result || response.data;
  }
}

export const mcpClient = new McpClient();
export default mcpClient;
