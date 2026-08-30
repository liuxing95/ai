import type { JSONSchema7, LanguageModelV4ToolCall } from '@ai-sdk/provider';
import type { InvalidToolInputError } from '../error/invalid-tool-input-error';
import type { NoSuchToolError } from '../error/no-such-tool-error';
import type { Instructions, ModelMessage } from '../prompt';
import type { ToolSet } from '@ai-sdk/provider-utils';

/**
 * A function that attempts to repair a tool call that failed to parse.
 *
 * It receives the error and the context as arguments and returns the repair
 * tool call JSON as text.
 *
 * @param options.instructions - The instructions provided to the model.
 * @param options.system - The instructions provided to the model.
 * @param options.messages - The messages in the current generation step.
 * @param options.toolCall - The tool call that failed to parse.
 * @param options.tools - The tools that are available.
 * @param options.inputSchema - A function that returns the JSON Schema for a tool.
 * @param options.error - The error that occurred while parsing the tool call.
 */
/**
 * 中文说明：AI SDK 只在 `parseToolCall` 发现“工具不存在”或“输入不符合 Schema”时调用该
 * 回调；SDK 本身不实现任何修复策略。调用方可以重试模型、纠正 JSON 或映射旧工具名，
 * 并返回修复后的 `LanguageModelV4ToolCall`；返回 `null` 则保留原始解析错误。
 * `experimental_repairToolCall` 只是历史实验字段，Core 将它别名为
 * `repairToolCall` 后走同一条调用链。
 *
 * 参数中文说明：`instructions` 是当前 instructions，`system` 是其已废弃别名，
 * `messages` 是当前步骤消息，`toolCall` 是待校验的 Provider 原始调用，`tools` 是
 * 当前启用的工具集合，`inputSchema` 用于读取指定工具的 JSON Schema，`error` 是
 * 工具名或输入校验阶段产生的错误。
 */
export type ToolCallRepairFunction<TOOLS extends ToolSet> = (options: {
  instructions: Instructions | undefined;
  /**
   * @deprecated Use `instructions` instead.
   */
  system: Instructions | undefined;
  messages: ModelMessage[];
  toolCall: LanguageModelV4ToolCall;
  tools: TOOLS;
  inputSchema: (options: { toolName: string }) => PromiseLike<JSONSchema7>;
  error: NoSuchToolError | InvalidToolInputError;
}) => Promise<LanguageModelV4ToolCall | null>;
