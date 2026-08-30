import {
  executeTool,
  isExecutableTool,
  type Arrayable,
  type Experimental_SandboxSession as SandboxSession,
  type InferToolInput,
  type InferToolSetContext,
  type ModelMessage,
  type ToolSet,
} from '@ai-sdk/provider-utils';
import {
  getToolTimeoutMs,
  type TimeoutConfiguration,
} from '../prompt/request-options';
import type { TelemetryDispatcher } from '../telemetry/telemetry';
import { getOwn } from '../util/get-own';
import { mergeAbortSignals } from '../util/merge-abort-signals';
import { notify } from '../util/notify';
import { now } from '../util/now';
import type { TypedToolCall } from './tool-call';
import type { TypedToolError } from './tool-error';
import type {
  OnToolExecutionEndCallback,
  OnToolExecutionStartCallback,
  ToolExecutionEndEvent,
  ToolExecutionStartEvent,
} from './tool-execution-events';
import type { ToolOutput } from './tool-output';
import type { TypedToolResult } from './tool-result';
import { validateToolContext } from './validate-tool-context';

/**
 * Executes a single tool call and manages its lifecycle callbacks.
 *
 * This function handles the complete tool execution flow:
 * 1. Invokes `onToolExecutionStart` callback before execution
 * 2. Executes the tool's `execute` function with proper context
 * 3. Handles streaming outputs via `onPreliminaryToolResult`
 * 4. Invokes `onToolExecutionEnd` callback with success or error result
 *
 * @returns The tool output with performance metrics, or undefined if the tool has no execute function.
 */
/**
 * 中文：在应用侧执行一条已解析的工具调用，并管理回调、超时、追踪和流式预览结果。
 * 调用链：模型响应经 `parseToolCall` 标准化后，`generateText` 或
 * `executeToolsFromStream` 只把非 `providerExecuted` 的调用传入本函数；本函数再
 * 调用工具对象的 `execute`。Provider 服务端工具永远不应到达这里——即使误传进来，
 * 没有本地 `execute` 的工具也会安全返回 `undefined`。
 *
 * 返回标准 tool-result/tool-error 和耗时；没有可执行 `execute` 时返回
 * `undefined`，不会隐式执行任何 Provider 能力。
 */
export async function executeToolCall<TOOLS extends ToolSet>({
  toolCall,
  tools,
  toolsContext,
  callId,
  messages,
  abortSignal,
  timeout,
  experimental_sandbox: sandbox,
  onPreliminaryToolResult,
  onToolExecutionStart,
  onToolExecutionEnd,
  executeToolInTelemetryContext = async ({ execute }) => await execute(),
  runInTracingChannelSpan = async ({ execute }) => await execute(),
}: {
  toolCall: TypedToolCall<TOOLS>;
  tools: TOOLS | undefined;
  callId: string;
  messages: ModelMessage[];
  abortSignal: AbortSignal | undefined;
  toolsContext: InferToolSetContext<TOOLS>;
  timeout?: TimeoutConfiguration<TOOLS>;
  experimental_sandbox?: SandboxSession;
  onPreliminaryToolResult?: (result: TypedToolResult<TOOLS>) => void;
  onToolExecutionStart?: Arrayable<OnToolExecutionStartCallback<TOOLS>>;
  onToolExecutionEnd?: Arrayable<OnToolExecutionEndCallback<TOOLS>>;
  executeToolInTelemetryContext?: <T>(
    params: Partial<ToolExecutionStartEvent<TOOLS>> & {
      callId: string;
      toolCallId: string;
      execute: () => PromiseLike<T>;
    },
  ) => PromiseLike<T>;
  runInTracingChannelSpan?: NonNullable<
    TelemetryDispatcher['runInTracingChannelSpan']
  >;
}): Promise<
  | {
      output: ToolOutput<TOOLS>;
      toolExecutionMs: number;
    }
  | undefined
> {
  const { toolName, toolCallId, input } = toolCall;
  const tool = getOwn(tools, toolName);

  // `isExecutableTool` 同时保护“工具不存在”和“声明但未提供 execute”的情况。
  // 后者允许应用自行接管调用结果，不代表 SDK 会替它执行。
  if (!isExecutableTool(tool)) {
    return undefined;
  }

  const context = await validateToolContext({
    toolName,
    context: getOwn(toolsContext, toolName),
    contextSchema: tool.contextSchema,
  });

  const toolExecutionContext = {
    toolCall,
    messages,
    toolContext: context,
  };
  const baseCallbackEvent = {
    callId,
    ...toolExecutionContext,
  };

  return await runInTracingChannelSpan({
    type: 'executeTool',
    event: baseCallbackEvent,
    execute: async () => {
      let output: unknown;

      await notify({
        event: baseCallbackEvent as ToolExecutionStartEvent<TOOLS>,
        callbacks: onToolExecutionStart,
      });

      const toolTimeoutMs = getToolTimeoutMs<TOOLS>(timeout, toolName);
      const toolAbortSignal = mergeAbortSignals(abortSignal, toolTimeoutMs);

      let toolExecutionMs = 0;
      try {
        // Integration wrappers keep nested AI SDK calls associated with this tool execution.
        // 中文：集成包装器会让工具内部再次调用 AI SDK 时仍关联到本次工具追踪 span。
        await executeToolInTelemetryContext({
          callId,
          toolCallId,
          ...(toolExecutionContext as Partial<ToolExecutionStartEvent<TOOLS>>),
          execute: async () => {
            const startTime = now();
            try {
              // `executeTool` 统一同步值、Promise 和 AsyncIterable；预览结果可在
              // 流式场景中立即发给消费端，最终值才写入下一轮模型消息。
              const stream = executeTool({
                tool,
                input: input as InferToolInput<typeof tool>,
                options: {
                  toolCallId,
                  messages,
                  abortSignal: toolAbortSignal,
                  context,
                  experimental_sandbox: sandbox,
                },
              });

              for await (const part of stream) {
                if (part.type === 'preliminary') {
                  onPreliminaryToolResult?.({
                    ...toolCall,
                    type: 'tool-result',
                    output: part.output,
                    preliminary: true,
                  });
                } else {
                  output = part.output;
                }
              }
            } finally {
              toolExecutionMs = now() - startTime;
            }
          },
        });
      } catch (error) {
        const toolError = {
          type: 'tool-error',
          toolCallId,
          toolName,
          input,
          error,
          dynamic: tool.type === 'dynamic',
          ...(toolCall.providerMetadata != null
            ? { providerMetadata: toolCall.providerMetadata }
            : {}),
          ...(toolCall.toolMetadata != null
            ? { toolMetadata: toolCall.toolMetadata }
            : {}),
        } as TypedToolError<TOOLS>;

        await notify({
          event: {
            ...baseCallbackEvent,
            toolOutput: toolError,
            toolExecutionMs,
          } as ToolExecutionEndEvent<TOOLS>,
          callbacks: onToolExecutionEnd,
        });

        return {
          output: toolError,
          toolExecutionMs,
        };
      }

      const toolResult = {
        type: 'tool-result',
        toolCallId,
        toolName,
        input,
        output,
        dynamic: tool.type === 'dynamic',
        ...(toolCall.providerMetadata != null
          ? { providerMetadata: toolCall.providerMetadata }
          : {}),
        ...(toolCall.toolMetadata != null
          ? { toolMetadata: toolCall.toolMetadata }
          : {}),
      } as TypedToolResult<TOOLS>;

      await notify({
        event: {
          ...baseCallbackEvent,
          toolOutput: toolResult,
          toolExecutionMs,
        } as ToolExecutionEndEvent<TOOLS>,
        callbacks: onToolExecutionEnd,
      });

      return {
        output: toolResult,
        toolExecutionMs,
      };
    },
  });
}
