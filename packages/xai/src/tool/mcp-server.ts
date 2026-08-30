import {
  createProviderExecutedToolFactory,
  lazySchema,
  zodSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const mcpServerArgsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      serverUrl: z.string().describe('The URL of the MCP server'),
      serverLabel: z.string().optional().describe('A label for the MCP server'),
      serverDescription: z
        .string()
        .optional()
        .describe('Description of the MCP server'),
      allowedTools: z
        .array(z.string())
        .optional()
        .describe('List of allowed tool names'),
      headers: z
        .record(z.string(), z.string())
        .optional()
        .describe('Custom headers to send'),
      authorization: z
        .string()
        .optional()
        .describe('Authorization header value'),
    }),
  ),
);

// MCP tool output varies based on which tool is called
const mcpServerOutputSchema = lazySchema(() =>
  zodSchema(
    z.object({
      name: z.string(),
      arguments: z.string(),
      result: z.unknown(),
    }),
  ),
);

/**
 * xAI 代表调用方连接 MCP server 的服务端工具 Factory。网络连接、鉴权及工具调用由
 * xAI 负责；SDK 将响应标准化，必要时以动态 provider-executed 调用向上游透传。
 */
const mcpServerToolFactory = createProviderExecutedToolFactory<
  {},
  {
    name: string;
    arguments: string;
    result: unknown;
  },
  {
    serverUrl: string;
    serverLabel?: string;
    serverDescription?: string;
    allowedTools?: string[];
    headers?: Record<string, string>;
    authorization?: string;
  }
>({
  id: 'xai.mcp',
  inputSchema: lazySchema(() => zodSchema(z.object({}))),
  outputSchema: mcpServerOutputSchema,
});

export const mcpServer = (args: Parameters<typeof mcpServerToolFactory>[0]) =>
  mcpServerToolFactory(args);
