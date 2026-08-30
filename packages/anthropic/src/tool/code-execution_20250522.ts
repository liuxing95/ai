import {
  createProviderExecutedToolFactory,
  lazySchema,
  zodSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const codeExecution_20250522OutputSchema = lazySchema(() =>
  zodSchema(
    z.object({
      type: z.literal('code_execution_result'),
      stdout: z.string(),
      stderr: z.string(),
      return_code: z.number(),
      content: z
        .array(
          z.object({
            type: z.literal('code_execution_output'),
            file_id: z.string(),
          }),
        )
        .optional()
        .default([]),
    }),
  ),
);

const codeExecution_20250522InputSchema = lazySchema(() =>
  zodSchema(
    z.object({
      code: z.string(),
    }),
  ),
);

/**
 * Anthropic 托管代码执行的 schema 工厂。
 *
 * 工厂生成 `isProviderExecuted: true` 的 provider tool；Core 将其交给
 * `anthropic-prepare-tools` 序列化为 `code_execution_20250522`，响应中的执行
 * 结果由 `anthropic-language-model` 转回通用 tool-result。SDK 本地没有 Python
 * 解释器或执行实现。
 */
const factory = createProviderExecutedToolFactory<
  {
    /**
     * The Python code to execute.
     */
    code: string;
  },
  {
    type: 'code_execution_result';
    stdout: string;
    stderr: string;
    return_code: number;
    content: Array<{ type: 'code_execution_output'; file_id: string }>;
  },
  {}
>({
  id: 'anthropic.code_execution_20250522',
  inputSchema: codeExecution_20250522InputSchema,
  outputSchema: codeExecution_20250522OutputSchema,
});

export const codeExecution_20250522 = (
  args: Parameters<typeof factory>[0] = {},
) => {
  return factory(args);
};
