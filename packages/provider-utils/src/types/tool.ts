import type { JSONValue, JSONObject } from '@ai-sdk/provider';
import type { FlexibleSchema } from '../schema';
import type { ToolResultOutput } from './content-part';
import type { Context } from './context';
import type { ExecutableTool } from './executable-tool';
import type { NeverOptional } from './never-optional';
import type { ProviderOptions } from './provider-options';
import type {
  ToolExecuteFunction,
  ToolExecutionOptions,
} from './tool-execute-function';
import type { ToolNeedsApprovalFunction } from './tool-needs-approval-function';
import type { SandboxSession } from './sandbox';

/**
 * Helper type to determine the outputSchema and execute function properties of a tool.
 */
/**
 * 中文：约束工具输出 Schema 与本地 `execute` 的组合。有 `execute` 时，Core 的
 * `executeToolCall` 可从返回值推导输出；没有
 * `execute` 时必须显式提供输出 Schema，表示结果由应用/Provider 的其他路径提供，
 * 而不是由 SDK 自动执行。
 */
type ToolOutputProperties<
  INPUT,
  OUTPUT,
  CONTEXT extends Context | unknown | never,
> = NeverOptional<
  OUTPUT,
  | {
      /**
       * The optional schema of the output that the tool produces.
       *
       * If not provided, the output shape will be inferred from the execute function.
       */
      /** 中文：工具输出的可选 Schema；有本地 `execute` 时可由其返回类型推导。 */
      outputSchema?: FlexibleSchema<OUTPUT>;

      /**
       * An async function that is called with the arguments from the tool call and produces a result.
       * If not provided, the tool will not be executed automatically.
       *
       * @args is the input of the tool call.
       * @options.abortSignal is a signal that can be used to abort the tool call.
       */
      /**
       * 中文：模型调用通过 Schema 校验后，由 Core 在应用侧调用的执行函数。未提供时
       * SDK 不会自动执行；`provider-executed` 工具则禁止提供它。
       */
      execute: ToolExecuteFunction<INPUT, OUTPUT, CONTEXT>;
    }
  | {
      /**
       * The schema of the output that the tool produces.
       *
       * Required when no execute function is provided.
       */
      outputSchema: FlexibleSchema<OUTPUT>;

      execute?: never;
    }
>;

/**
 * Common properties shared by all tool kinds.
 */
/**
 * 中文：全部四类工具共享的声明与本地生命周期属性。`prepareTools` 将 `inputSchema`
 * 转为 Provider 请求中的工具声明；模型返回调用后
 * `parseToolCall` 再用同一个 Schema 校验输入。Schema 被发给模型是为了让它选择和
 * 生成参数，不等于 Provider 会执行该工具。
 */
type BaseTool<
  INPUT extends JSONValue | unknown | never = any,
  OUTPUT extends JSONValue | unknown | never = any,
  CONTEXT extends Context | unknown | never = any,
> = {
  /**
   * An optional title of the tool.
   *
   * @deprecated Use `providerMetadata` for source-specific tool display metadata.
   */
  title?: string;

  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: ProviderOptions;

  /**
   * Optional metadata about the tool itself (e.g. its source).
   *
   * Unlike `providerOptions`, this metadata is not sent to the language
   * model. Instead, it is propagated onto the resulting tool call's
   * `toolMetadata` so consumers can read it from tool call / result parts
   * and UI message parts. This is useful for sources of dynamic tools (e.g.
   * an MCP server) to identify themselves.
   */
  metadata?: JSONObject;

  /**
   * The schema of the input that the tool expects.
   * The language model will use this to generate the input.
   * It is also used to validate the output of the language model.
   *
   * You can use descriptions on the schema properties to make the input understandable for the language model.
   */
  inputSchema: FlexibleSchema<INPUT>;

  /**
   * An optional schema describing the context that the tool expects.
   *
   * The context is passed to execute function as part of the execution options.
   */
  contextSchema?: FlexibleSchema<CONTEXT>;

  /**
   * Whether the tool needs approval before it can be executed.
   *
   * @deprecated Tool approval is handled on a `generateText` / `streamText` level now.
   */
  needsApproval?:
    | boolean
    | ToolNeedsApprovalFunction<
        [INPUT] extends [never] ? unknown : INPUT,
        NoInfer<CONTEXT>
      >;

  /**
   * Optional function that is called when the model starts generating the tool input.
   * In non-streaming contexts, it is called immediately before `onInputAvailable`.
   */
  onInputStart?: (
    options: ToolExecutionOptions<NoInfer<CONTEXT>>,
  ) => void | PromiseLike<void>;

  /**
   * Optional function that is called when an argument streaming delta is available.
   * Only called when the tool is used in a streaming context.
   */
  onInputDelta?: (
    options: { inputTextDelta: string } & ToolExecutionOptions<
      NoInfer<CONTEXT>
    >,
  ) => void | PromiseLike<void>;

  /**
   * Optional function that is called when a tool call can be started,
   * even if the execute function is not provided.
   */
  onInputAvailable?: (
    options: {
      input: [INPUT] extends [never] ? unknown : INPUT;
    } & ToolExecutionOptions<NoInfer<CONTEXT>>,
  ) => void | PromiseLike<void>;

  /**
   * Optional conversion function that maps the tool result to an output that can be used by the language model.
   *
   * If not provided, the tool result will be sent as a JSON object.
   *
   * This function is invoked on the server by `convertToModelMessages`, so ensure that you pass the same "tools" (ToolSet) to both "convertToModelMessages" and "streamText" (or other generation APIs).
   */
  /**
   * 中文：把工具结果转换为下一轮可发送给模型的内容；未提供时按 JSON 发送。它由
   * 服务端 `convertToModelMessages` 调用，因此该函数与 `streamText` /
   * `generateText` 必须使用同一份 ToolSet，才能按工具名找到转换逻辑。
   */
  toModelOutput?: (options: {
    /**
     * The ID of the tool call. You can use it e.g. when sending tool-call related information with stream data.
     */
    toolCallId: string;

    /**
     * The input of the tool call.
     */
    input: [INPUT] extends [never] ? unknown : INPUT;

    /**
     * The output of the tool call.
     */
    output: 0 extends 1 & OUTPUT
      ? any
      : [OUTPUT] extends [never]
        ? any
        : NoInfer<OUTPUT>;
  }) => ToolResultOutput | PromiseLike<ToolResultOutput>;
} & ToolOutputProperties<INPUT, OUTPUT, NoInfer<CONTEXT>>;

/**
 * Common properties shared by function-style tools.
 */
/**
 * 中文：`function` 与 `dynamic` 两类函数式工具共用的属性。这两类工具都由应用定义
 * 输入 Schema；模型发起调用后，若调用方提供了
 * `execute`，AI SDK 才会在应用侧调用它。二者的差别仅在于工具定义能否在
 * 开发时确定：`function` 可以，`dynamic` 则是在运行时才取得。
 */
type BaseFunctionTool<
  INPUT extends JSONValue | unknown | never = any,
  OUTPUT extends JSONValue | unknown | never = any,
  CONTEXT extends Context | unknown | never = any,
> = BaseTool<INPUT, OUTPUT, CONTEXT> & {
  /**
   * Optional description of what the tool does.
   *
   * Included in the tool definition sent to the language model so it can
   * decide when and how to call the tool.
   *
   * Provide a string for a fixed description, or a function that returns a
   * string from the current `context` (and optional `experimental_sandbox`) when the
   * description should vary per call.
   */
  description?:
    | string
    | ((options: {
        context: NoInfer<CONTEXT>;
        experimental_sandbox?: SandboxSession;
      }) => string);

  /**
   * Strict mode setting for the tool.
   *
   * Providers that support strict mode will use this setting to determine
   * how the input should be generated. Strict mode will always produce
   * valid inputs, but it might limit what input schemas are supported.
   */
  strict?: boolean;

  /**
   * An optional list of input examples that show the language
   * model what the input should look like.
   */
  inputExamples?: Array<{ input: NoInfer<INPUT> }>;

  // make all properties available to improve usage dx
  id?: never;
  isProviderExecuted?: never;
  args?: never;
  supportsDeferredResults?: never;
};

/**
 * Tool with user-defined input and output schemas that is executed by the AI SDK.
 */
/**
 * 中文：普通函数工具：输入与输出 Schema 由应用定义，模型调用后由 AI SDK 在
 * 应用侧调用 `execute`。
 *
 * 适合访问数据库、调用内部 API 等应用拥有定义权和执行权的能力。若不
 * 提供 `execute`，SDK 不会自动执行该调用，调用方需要自行处理结果。
 */
export type FunctionTool<
  INPUT extends JSONValue | unknown | never = any,
  OUTPUT extends JSONValue | unknown | never = any,
  CONTEXT extends Context | unknown | never = any,
> = BaseFunctionTool<INPUT, OUTPUT, CONTEXT> & {
  type?: undefined | 'function';
};

/**
 * Tool that is defined at runtime.
 * The types of input and output are not known at development time.
 *
 * For example, MCP tools that are not known at development time.
 */
/**
 * 中文：动态工具：执行方式与普通函数工具相同，仍由 AI SDK 在应用侧调用
 * `execute`；但其输入、输出类型在开发时未知，因此以 `unknown` 为主，
 * 需在运行时处理或校验。
 *
 * 例如从 MCP 服务器或其他运行时来源加载、编写代码时尚不存在的工具。
 */
export type DynamicTool<
  INPUT extends JSONValue | unknown | never = any,
  OUTPUT extends JSONValue | unknown | never = any,
  CONTEXT extends Context | unknown | never = any,
> = BaseFunctionTool<INPUT, OUTPUT, CONTEXT> & {
  type: 'dynamic';
};

/**
 * Common properties shared by provider tools.
 */
/**
 * 中文：Provider 工具共用的属性。工具的名称、参数 Schema 与调用协议由 Provider 规定；AI SDK 依据
 * `id` 和 `args` 将它转换为该 Provider API 的原生工具定义。是否在
 * 应用侧执行则由 `isProviderExecuted` 决定。
 */
type BaseProviderTool<
  INPUT extends JSONValue | unknown | never = any,
  OUTPUT extends JSONValue | unknown | never = any,
  CONTEXT extends Context | unknown | never = any,
> = BaseTool<INPUT, OUTPUT, CONTEXT> & {
  type: 'provider';

  /**
   * The ID of the tool. Must follow the format `<provider-name>.<unique-tool-name>`.
   */
  id: `${string}.${string}`;

  /**
   * The arguments for configuring the tool. Must match the expected arguments defined by the provider for this tool.
   */
  args: Record<string, unknown>;

  // make all properties available to improve usage dx
  description?: never;
  strict?: never;
  inputExamples?: never;
};

/**
 * Tool with provider-defined input and output schemas that is executed by the
 * user.
 *
 * For example, shell tools that are executed in a local shell, but have provider-defined input and output schemas.
 */
/**
 * 中文：Provider 定义、应用侧执行的工具。Provider 规定工具 ID、输入/输出 Schema 和调用协议；模型发起调用后，
 * AI SDK 仍会调用应用传入的 `execute`。例如 Provider 预定义的 shell、
 * 文本编辑或 computer 工具可在本地受控环境中执行。
 */
export type ProviderDefinedTool<
  INPUT extends JSONValue | unknown | never = any,
  OUTPUT extends JSONValue | unknown | never = any,
  CONTEXT extends Context | unknown | never = any,
> = BaseProviderTool<INPUT, OUTPUT, CONTEXT> & {
  /**
   * Flag that indicates whether the tool is executed by the provider.
   */
  /**
   * 中文：表示该工具不由 Provider 服务端执行。流式执行调度会据此将拥有
   * `execute` 的调用加入本地执行队列。
   */
  isProviderExecuted: false;

  // make all properties available to improve usage dx
  supportsDeferredResults?: never;
};

/**
 * Tool with provider-defined input and output schemas that is executed by the
 * provider.
 *
 * For example, web search tools and code execution tools that are executed by the provider itself.
 */
/**
 * 中文：Provider 定义并由 Provider 服务端执行的工具。应用仅配置工具参数，实际执行和结果生成发生在 Provider 服务端，因而
 * 该工具不能提供本地 `execute`。例如 web search、file search 或 code
 * execution 等托管能力。
 */
export type ProviderExecutedTool<
  INPUT extends JSONValue | unknown | never = any,
  OUTPUT extends JSONValue | unknown | never = any,
  CONTEXT extends Context | unknown | never = any,
> = BaseProviderTool<INPUT, OUTPUT, CONTEXT> & {
  /**
   * Flag that indicates whether the tool is executed by the provider.
   */
  /**
   * 中文：表示该工具由 Provider 服务端执行。AI SDK 会转发其声明和结果，但不
   * 会把该调用加入本地 `execute` 队列。
   */
  isProviderExecuted: true;

  /**
   * Whether this provider-executed tool supports deferred results.
   *
   * When true, the tool result may not be returned in the same turn as the
   * tool call (e.g., when using programmatic tool calling where a server tool
   * triggers a client-executed tool, and the server tool's result is deferred
   * until the client tool is resolved).
   *
   * This flag allows the AI SDK to handle tool results that arrive without
   * a matching tool call in the current response.
   *
   * @default false
   */
  /**
   * 中文：该 Provider 服务端工具是否支持延迟返回结果。为 `true` 时，工具调用和结果不一定出现在同一轮响应中。例如，服务端
   * 工具可能触发一个客户端执行的工具，并在客户端工具完成后才返回自己的
   * 结果。此标记让 AI SDK 能处理当前响应中没有对应 tool call 的结果。
   */
  supportsDeferredResults?: boolean;
};

/**
 * A tool can either be user-defined or provider-defined.
 *
 * It contains the schemas and metadata needed for the language model to call
 * the tool and can include an execute function for tools that are executed by
 * the AI SDK.
 */
/**
 * 中文：AI SDK 支持的四类工具联合类型：
 * - `function`：应用定义，应用侧执行；
 * - `dynamic`：运行时定义，应用侧执行；
 * - `provider-defined`：Provider 定义，应用侧执行；
 * - `provider-executed`：Provider 定义，Provider 服务端执行。
 *
 * 所有工具都携带模型调用所需的 Schema 和元数据；只有应用侧执行的工具
 * 才可提供 `execute`。
 */
export type Tool<
  INPUT extends JSONValue | unknown | never = any,
  OUTPUT extends JSONValue | unknown | never = any,
  CONTEXT extends Context | unknown | never = any,
> =
  | FunctionTool<INPUT, OUTPUT, CONTEXT>
  | DynamicTool<INPUT, OUTPUT, CONTEXT>
  | ProviderDefinedTool<INPUT, OUTPUT, CONTEXT>
  | ProviderExecutedTool<INPUT, OUTPUT, CONTEXT>;

/**
 * Infer the tool type from a tool object.
 *
 * This is useful for type inference when working with tool objects.
 *
 * When the input has an `execute` function, the return type narrows to
 * `ExecutableTool<Tool<...>>` so that `.execute` is non-nullable without
 * needing `isExecutableTool` or a `!` assertion at the call site.
 */
// Note: overload order is important for auto-completion.
// The "with execute" overload comes first so calls that include an
// `execute` function get the narrowed return type. Calls without
// `execute` fall through to the overloads below.
export function tool<INPUT, OUTPUT, CONTEXT extends Context>(
  tool: Tool<INPUT, OUTPUT, CONTEXT> & {
    execute: ToolExecuteFunction<INPUT, OUTPUT, CONTEXT>;
  },
): ExecutableTool<Tool<INPUT, OUTPUT, CONTEXT>>;
export function tool<INPUT, OUTPUT, CONTEXT extends Context>(
  tool: Tool<INPUT, OUTPUT, CONTEXT>,
): Tool<INPUT, OUTPUT, CONTEXT>;
export function tool<INPUT, CONTEXT extends Context>(
  tool: Tool<INPUT, never, CONTEXT>,
): Tool<INPUT, never, CONTEXT>;
export function tool<OUTPUT, CONTEXT extends Context>(
  tool: Tool<never, OUTPUT, CONTEXT>,
): Tool<never, OUTPUT, CONTEXT>;
export function tool<CONTEXT extends Context>(
  tool: Tool<never, never, CONTEXT>,
): Tool<never, never, CONTEXT>;
// 运行时恒等函数：只通过重载改善 TypeScript 推断，并不注册、序列化或执行工具。
// 真正的请求构造从 Core `prepareTools` 开始。
export function tool(tool: any): any {
  return tool;
}

/**
 * Define a dynamic tool.
 */
/**
 * 中文：运行时行为与普通函数工具相同；此辅助函数仅补上 `type: 'dynamic'`，
 * 以告知 TypeScript 其输入和输出类型需要在运行时处理。
 */
export function dynamicTool(
  tool: Omit<DynamicTool<unknown, unknown, Context>, 'type'>,
): DynamicTool<unknown, unknown, Context> {
  return { ...tool, type: 'dynamic' } as DynamicTool<unknown, unknown, Context>;
}
