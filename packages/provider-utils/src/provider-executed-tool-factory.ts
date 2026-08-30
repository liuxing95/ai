import type { FlexibleSchema } from './schema';
import type { Context } from './types/context';
import { tool, type ProviderExecutedTool, type Tool } from './types/tool';
/**
 * A provider-executed tool is a tool for which the provider executes the tool.
 */
/**
 * 中文：Provider 定义并由其服务端执行的工具工厂。
 * 调用方只能配置 Provider 允许的参数和输入生命周期回调，不能提供本地
 * `execute`。工厂固定 `isProviderExecuted: true`，使 AI SDK 只负责
 * 传递工具定义并接收 Provider 返回的调用与结果。
 */
export type ProviderExecutedToolFactory<
  INPUT,
  OUTPUT,
  ARGS extends object,
  CONTEXT extends Context = {},
> = (
  options: ARGS & {
    onInputStart?: Tool<INPUT, OUTPUT, CONTEXT>['onInputStart'];
    onInputDelta?: Tool<INPUT, OUTPUT, CONTEXT>['onInputDelta'];
    onInputAvailable?: Tool<INPUT, OUTPUT, CONTEXT>['onInputAvailable'];
  },
) => ProviderExecutedTool<INPUT, OUTPUT, CONTEXT>;

export function createProviderExecutedToolFactory<
  INPUT,
  OUTPUT,
  ARGS extends object,
  CONTEXT extends Context = {},
>({
  id,
  inputSchema,
  outputSchema,
  supportsDeferredResults,
}: {
  id: `${string}.${string}`;
  inputSchema: FlexibleSchema<INPUT>;
  outputSchema: FlexibleSchema<OUTPUT>;

  /**
   * Whether this provider-executed tool supports deferred results.
   *
   * When true, the tool result may not be returned in the same turn as the
   * tool call (e.g., when using programmatic tool calling where a server tool
   * triggers a client-executed tool, and the server tool's result is deferred
   * until the client tool is resolved).
   *
   * @default false
   */
  /**
   * 中文：为 `true` 时，结果可以晚于发起调用的响应到达；AI SDK 因而接受当前
   * 响应中没有匹配 tool call 的工具结果。
   */
  supportsDeferredResults?: boolean;
}): ProviderExecutedToolFactory<INPUT, OUTPUT, ARGS, CONTEXT> {
  // 该对象同样由 Core prepareTools 传给 Provider adapter；不同之处在于响应中的
  // 调用带 providerExecuted 标记，Core 执行队列会跳过它，结果由 Provider 返回。
  return ({
    onInputStart,
    onInputDelta,
    onInputAvailable,
    ...args
  }: ARGS & {
    onInputStart?: Tool<INPUT, OUTPUT, CONTEXT>['onInputStart'];
    onInputDelta?: Tool<INPUT, OUTPUT, CONTEXT>['onInputDelta'];
    onInputAvailable?: Tool<INPUT, OUTPUT, CONTEXT>['onInputAvailable'];
  }): ProviderExecutedTool<INPUT, OUTPUT, CONTEXT> =>
    tool({
      type: 'provider',
      isProviderExecuted: true,
      id,
      args,
      inputSchema,
      outputSchema,
      onInputStart,
      onInputDelta,
      onInputAvailable,
      supportsDeferredResults,
    }) as ProviderExecutedTool<INPUT, OUTPUT, CONTEXT>;
}
