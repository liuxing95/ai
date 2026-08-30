import type { LanguageModelV4ToolCall } from '@ai-sdk/provider';
import {
  asSchema,
  safeParseJSON,
  safeValidateTypes,
  type InferToolInput,
  type ModelMessage,
  type ToolSet,
} from '@ai-sdk/provider-utils';
import { InvalidToolInputError } from '../error/invalid-tool-input-error';
import { NoSuchToolError } from '../error/no-such-tool-error';
import { ToolCallRepairError } from '../error/tool-call-repair-error';
import type { Instructions } from '../prompt';
import { getOwn } from '../util/get-own';
import type { DynamicToolCall, TypedToolCall } from './tool-call';
import type { ToolCallRepairFunction } from './tool-call-repair-function';
import type { ToolInputRefinement } from './tool-input-refinement';

/**
 * 将 Provider adapter 输出的通用 `LanguageModelV4ToolCall` 校验并转换为 Core
 * 可执行的 `TypedToolCall`。
 *
 * 这是“Provider 响应 → 应用侧工具执行”的边界：先按工具名取得 Schema，再安全地
 * 解析和校验 JSON；只有成功的非 `providerExecuted` 调用才会在后续被
 * `executeToolCall` 本地执行。Provider 服务端工具仍会经过这里，以便统一输出
 * tool-call 事件和元数据，但之后会被执行队列跳过。
 */
export async function parseToolCall<TOOLS extends ToolSet>({
  toolCall,
  tools,
  repairToolCall,
  refineToolInput,
  messages,
  instructions,
}: {
  toolCall: LanguageModelV4ToolCall;
  tools: TOOLS | undefined;
  repairToolCall: ToolCallRepairFunction<TOOLS> | undefined;
  refineToolInput?: ToolInputRefinement<TOOLS> | undefined;
  instructions: Instructions | undefined;
  messages: ModelMessage[];
}): Promise<TypedToolCall<TOOLS>> {
  try {
    if (tools == null) {
      // provider-executed dynamic tools are not part of our list of tools:
      // 中文：Provider 可在响应中动态引入服务端工具（例如 server-side tool search
      // 找到的工具）。它不在应用的 ToolSet 中，仍可作为 provider-executed
      // 动态调用向上游透传；绝不能尝试本地执行。
      if (toolCall.providerExecuted && toolCall.dynamic) {
        return await refineParsedToolCallInput({
          toolCall: await parseProviderExecutedDynamicToolCall(toolCall),
          refineToolInput,
        });
      }

      throw new NoSuchToolError({ toolName: toolCall.toolName });
    }

    try {
      return await refineParsedToolCallInput({
        toolCall: await doParseToolCall({ toolCall, tools }),
        refineToolInput,
      });
    } catch (error) {
      if (
        repairToolCall == null ||
        !(
          NoSuchToolError.isInstance(error) ||
          InvalidToolInputError.isInstance(error)
        )
      ) {
        throw error;
      }

      // 修复回调由应用提供（包括已废弃的 experimental 字段），SDK 只注入
      // 上下文并对它返回的调用重新走同一套 Schema 校验。
      let repairedToolCall: LanguageModelV4ToolCall | null = null;

      try {
        repairedToolCall = await repairToolCall({
          toolCall,
          tools,
          inputSchema: async ({ toolName }) => {
            const inputSchema = getOwn(tools, toolName)?.inputSchema;
            return await asSchema(inputSchema).jsonSchema;
          },
          instructions,
          system: instructions,
          messages,
          error,
        });
      } catch (repairError) {
        throw new ToolCallRepairError({
          cause: repairError,
          originalError: error,
        });
      }

      // no repaired tool call returned
      if (repairedToolCall == null) {
        throw error;
      }

      return await refineParsedToolCallInput({
        toolCall: await doParseToolCall({ toolCall: repairedToolCall, tools }),
        refineToolInput,
      });
    }
  } catch (error) {
    // use parsed input when possible
    // 中文：即使解析或修复失败，也保留可读的调用部件给 UI/调用方。它会标记为
    // dynamic + invalid，后续调度会把它转为本地错误结果而非执行未知输入。
    const parsedInput = await safeParseJSON({ text: toolCall.input });
    const input = parsedInput.success ? parsedInput.value : toolCall.input;
    const tool = getOwn(tools, toolCall.toolName);

    // TODO AI SDK 6: special invalid tool call parts
    return {
      type: 'tool-call',
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      input,
      dynamic: true,
      invalid: true,
      error,
      title: tool?.title,
      providerExecuted: toolCall.providerExecuted,
      providerMetadata: toolCall.providerMetadata,
      ...(tool?.metadata != null ? { toolMetadata: tool.metadata } : {}),
    };
  }
}

async function refineParsedToolCallInput<TOOLS extends ToolSet>({
  toolCall,
  refineToolInput,
}: {
  toolCall: TypedToolCall<TOOLS>;
  refineToolInput: ToolInputRefinement<TOOLS> | undefined;
}): Promise<TypedToolCall<TOOLS>> {
  const refine = getOwn(refineToolInput, toolCall.toolName);

  if (refine == null) {
    return toolCall;
  }

  return {
    ...toolCall,
    input: await refine(toolCall.input as InferToolInput<TOOLS[keyof TOOLS]>),
  } as TypedToolCall<TOOLS>;
}

async function parseProviderExecutedDynamicToolCall(
  toolCall: LanguageModelV4ToolCall,
): Promise<DynamicToolCall> {
  const parseResult =
    toolCall.input.trim() === ''
      ? { success: true as const, value: {} }
      : await safeParseJSON({ text: toolCall.input });

  if (parseResult.success === false) {
    throw new InvalidToolInputError({
      toolName: toolCall.toolName,
      toolInput: toolCall.input,
      cause: parseResult.error,
    });
  }

  return {
    type: 'tool-call',
    toolCallId: toolCall.toolCallId,
    toolName: toolCall.toolName,
    input: parseResult.value,
    providerExecuted: true,
    dynamic: true,
    providerMetadata: toolCall.providerMetadata,
  };
}

async function doParseToolCall<TOOLS extends ToolSet>({
  toolCall,
  tools,
}: {
  toolCall: LanguageModelV4ToolCall;
  tools: TOOLS;
}): Promise<TypedToolCall<TOOLS>> {
  const toolName = toolCall.toolName as keyof TOOLS & string;

  const tool = getOwn(tools, toolName);

  if (tool == null) {
    // provider-executed dynamic tools are not part of our list of tools:
    if (toolCall.providerExecuted && toolCall.dynamic) {
      return await parseProviderExecutedDynamicToolCall(toolCall);
    }

    throw new NoSuchToolError({
      toolName: toolCall.toolName,
      availableTools: Object.keys(tools),
    });
  }

  const schema = asSchema(tool.inputSchema);

  // when the tool call has no arguments, we try passing an empty object to the schema
  // (many LLMs generate empty strings for tool calls with no arguments)
  // 中文：无参工具常被模型表示为空字符串；此处将其视为 `{}` 再按 Schema 校验，避免
  // 因 Provider/模型的表示差异而误判为无效调用。
  const parseResult =
    toolCall.input.trim() === ''
      ? await safeValidateTypes({ value: {}, schema })
      : await safeParseJSON({ text: toolCall.input, schema });

  if (parseResult.success === false) {
    throw new InvalidToolInputError({
      toolName,
      toolInput: toolCall.input,
      cause: parseResult.error,
    });
  }

  return tool.type === 'dynamic'
    ? {
        type: 'tool-call',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        input: parseResult.value,
        providerExecuted: toolCall.providerExecuted,
        providerMetadata: toolCall.providerMetadata,
        ...(tool.metadata != null ? { toolMetadata: tool.metadata } : {}),
        dynamic: true,
        title: tool.title,
      }
    : {
        type: 'tool-call',
        toolCallId: toolCall.toolCallId,
        toolName,
        input: parseResult.value,
        providerExecuted: toolCall.providerExecuted,
        providerMetadata: toolCall.providerMetadata,
        ...(tool.metadata != null ? { toolMetadata: tool.metadata } : {}),
        title: tool.title,
      };
}
