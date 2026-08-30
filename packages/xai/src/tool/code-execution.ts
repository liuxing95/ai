import { createProviderExecutedToolFactory } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

const codeExecutionOutputSchema = z.object({
  output: z.string().describe('the output of the code execution'),
  error: z.string().optional().describe('any error that occurred'),
});

/**
 * xAI 托管代码执行工具。工厂只声明 `xai.code_execution`；xAI adapter 将它映射为
 * `code_interpreter` 请求 JSON，实际运行与输出都由 xAI 服务端完成。
 */
const codeExecutionToolFactory = createProviderExecutedToolFactory({
  id: 'xai.code_execution',
  inputSchema: z.object({}).describe('no input parameters'),
  outputSchema: codeExecutionOutputSchema,
});

export const codeExecution = (
  args: Parameters<typeof codeExecutionToolFactory>[0] = {},
) => codeExecutionToolFactory(args);
