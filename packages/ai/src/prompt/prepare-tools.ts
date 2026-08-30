import type {
  LanguageModelV4FunctionTool,
  LanguageModelV4ProviderTool,
} from '@ai-sdk/provider';
import {
  asSchema,
  type Experimental_SandboxSession as SandboxSession,
  type InferToolSetContext,
  type Tool,
  type ToolSet,
} from '@ai-sdk/provider-utils';
import type { ToolOrder } from '../generate-text/tool-order';
import { isNonEmptyObject } from '../util/is-non-empty-object';

export async function prepareTools<TOOLS extends ToolSet>({
  tools,
  toolOrder,
  toolsContext = {} as InferToolSetContext<TOOLS>,
  experimental_sandbox: sandbox,
}: {
  tools: TOOLS | undefined;
  toolOrder?: ToolOrder<TOOLS>;
  toolsContext?: InferToolSetContext<TOOLS>;
  experimental_sandbox?: SandboxSession;
}): Promise<
  Array<LanguageModelV4FunctionTool | LanguageModelV4ProviderTool> | undefined
> {
  if (!isNonEmptyObject(tools)) {
    return undefined;
  }

  const languageModelTools: Array<
    LanguageModelV4FunctionTool | LanguageModelV4ProviderTool
  > = [];
  for (const [name, tool] of orderToolEntries({ tools, toolOrder })) {
    const toolType = tool.type;

    switch (toolType) {
      case undefined:
      case 'dynamic':
      case 'function': {
        // 普通函数工具和动态工具共用 function 协议：应用提供的 Schema
        // 会被发送给模型。`dynamic` 仅影响 TypeScript 的运行时类型处理，
        // 不改变发给 Provider 的工具格式。
        const description = resolveToolDescription({
          tool,
          toolName: name,
          toolsContext,
          experimental_sandbox: sandbox,
        });
        const providerOptions = tool.providerOptions;
        const inputExamples = tool.inputExamples;
        const strict = tool.strict;

        languageModelTools.push({
          type: 'function' as const,
          name,
          inputSchema: await asSchema(tool.inputSchema).jsonSchema,
          ...(description != null ? { description } : {}),
          ...(inputExamples != null ? { inputExamples } : {}),
          ...(providerOptions != null ? { providerOptions } : {}),
          ...(strict != null ? { strict } : {}),
        });
        break;
      }
      case 'provider': {
        // Provider 工具的工具 ID、参数及其原生协议由 Provider 包负责解释。
        // `isProviderExecuted` 不影响序列化；它只在后续调度阶段决定由谁执行。
        languageModelTools.push({
          type: 'provider' as const,
          name,
          id: tool.id,
          args: tool.args,
        });
        break;
      }
      default: {
        const exhaustiveCheck: never = toolType as never;
        throw new Error(`Unsupported tool type: ${exhaustiveCheck}`);
      }
    }
  }

  return languageModelTools;
}

function orderToolEntries<TOOLS extends ToolSet>({
  tools,
  toolOrder,
}: {
  tools: TOOLS;
  toolOrder?: ToolOrder<TOOLS>;
}): Array<[string, Tool]> {
  if (toolOrder == null) {
    return Object.entries(tools);
  }

  const toolEntries = Object.entries(tools);

  const orderedTools = toolEntries
    .filter(([name]) => toolOrder.includes(name))
    .sort(
      ([nameA], [nameB]) => toolOrder.indexOf(nameA) - toolOrder.indexOf(nameB),
    );

  const unorderedTools = toolEntries
    .filter(([name]) => !toolOrder.includes(name))
    .sort(([nameA], [nameB]) => (nameA < nameB ? -1 : nameA > nameB ? 1 : 0));

  return [...orderedTools, ...unorderedTools];
}

function resolveToolDescription<TOOLS extends ToolSet>({
  tool,
  toolName,
  toolsContext,
  experimental_sandbox: sandbox,
}: {
  tool: Tool;
  toolName: string;
  toolsContext: InferToolSetContext<TOOLS>;
  experimental_sandbox?: SandboxSession;
}): string | undefined {
  return tool.description === undefined
    ? undefined
    : typeof tool.description === 'string'
      ? tool.description
      : tool.description({
          context: toolsContext[toolName as keyof InferToolSetContext<TOOLS>],
          experimental_sandbox: sandbox,
        });
}
