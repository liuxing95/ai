import { tool, type ProviderDefinedTool, type Tool } from './types/tool';
import type { FlexibleSchema } from './schema';
import type { Context } from './types/context';
import type { ToolExecuteFunction } from './types/tool-execute-function';
/**
 * A provider-defined tool is a tool for which the provider defines the input
 * and output schemas, but does not execute the tool.
 */
/**
 * 中文：Provider 定义、应用侧执行的工具工厂。
 * Provider 固定工具的输入/输出 Schema 与调用协议；调用方只需提供该
 * Provider 允许的配置和可选的 `execute`。工厂会固定
 * `isProviderExecuted: false`；仅当调用方提供 `execute` 时，AI SDK 才会在
 * 应用侧执行该工具。
 */
export type ProviderDefinedToolFactory<
  INPUT,
  ARGS extends object,
  CONTEXT extends Context = {},
> = <OUTPUT>(
  options: ARGS & {
    execute?: ToolExecuteFunction<INPUT, OUTPUT, CONTEXT>;
    needsApproval?: Tool<INPUT, OUTPUT, CONTEXT>['needsApproval'];
    toModelOutput?: Tool<INPUT, OUTPUT, CONTEXT>['toModelOutput'];
    onInputStart?: Tool<INPUT, OUTPUT, CONTEXT>['onInputStart'];
    onInputDelta?: Tool<INPUT, OUTPUT, CONTEXT>['onInputDelta'];
    onInputAvailable?: Tool<INPUT, OUTPUT, CONTEXT>['onInputAvailable'];
  },
) => ProviderDefinedTool<INPUT, OUTPUT, CONTEXT>;

export function createProviderDefinedToolFactory<
  INPUT,
  ARGS extends object,
  CONTEXT extends Context = {},
>({
  id,
  inputSchema,
}: {
  id: `${string}.${string}`;
  inputSchema: FlexibleSchema<INPUT>;
}): ProviderDefinedToolFactory<INPUT, ARGS, CONTEXT> {
  // 返回的对象会先被 Core `prepareTools` 写成 `{ type: 'provider', id, args }`，
  // 再由对应 Provider adapter 按 `id` 生成原生 JSON；响应回来后仍由
  // `executeToolCall` 调用应用传入的 execute。
  return <OUTPUT>({
    execute,
    outputSchema,
    needsApproval,
    toModelOutput,
    onInputStart,
    onInputDelta,
    onInputAvailable,
    ...args
  }: ARGS & {
    execute?: ToolExecuteFunction<INPUT, OUTPUT, CONTEXT>;
    outputSchema?: FlexibleSchema<OUTPUT>;
    needsApproval?: Tool<INPUT, OUTPUT, CONTEXT>['needsApproval'];
    toModelOutput?: Tool<INPUT, OUTPUT, CONTEXT>['toModelOutput'];
    onInputStart?: Tool<INPUT, OUTPUT, CONTEXT>['onInputStart'];
    onInputDelta?: Tool<INPUT, OUTPUT, CONTEXT>['onInputDelta'];
    onInputAvailable?: Tool<INPUT, OUTPUT, CONTEXT>['onInputAvailable'];
  }): ProviderDefinedTool<INPUT, OUTPUT, CONTEXT> =>
    tool({
      type: 'provider',
      isProviderExecuted: false,
      id,
      args,
      inputSchema,
      outputSchema,
      execute,
      needsApproval,
      toModelOutput,
      onInputStart,
      onInputDelta,
      onInputAvailable,
    }) as ProviderDefinedTool<INPUT, OUTPUT, CONTEXT>;
}

export type ProviderDefinedToolFactoryWithOutputSchema<
  INPUT,
  OUTPUT,
  ARGS extends object,
  CONTEXT extends Context = {},
> = (
  options: ARGS & {
    execute?: ToolExecuteFunction<INPUT, OUTPUT, CONTEXT>;
    needsApproval?: Tool<INPUT, OUTPUT, CONTEXT>['needsApproval'];
    toModelOutput?: Tool<INPUT, OUTPUT, CONTEXT>['toModelOutput'];
    onInputStart?: Tool<INPUT, OUTPUT, CONTEXT>['onInputStart'];
    onInputDelta?: Tool<INPUT, OUTPUT, CONTEXT>['onInputDelta'];
    onInputAvailable?: Tool<INPUT, OUTPUT, CONTEXT>['onInputAvailable'];
  },
) => ProviderDefinedTool<INPUT, OUTPUT, CONTEXT>;

/**
 * 创建输入和输出 Schema 都由 Provider 固定的应用侧执行工具工厂。
 *
 * 与 `createProviderDefinedToolFactory` 相比，输出 Schema 不由调用方
 * 提供；两者都允许调用方提供本地 `execute`，并将工具标记为非 Provider
 * 服务端执行。
 */
export function createProviderDefinedToolFactoryWithOutputSchema<
  INPUT,
  OUTPUT,
  ARGS extends object,
  CONTEXT extends Context = {},
>({
  id,
  inputSchema,
  outputSchema,
}: {
  id: `${string}.${string}`;
  inputSchema: FlexibleSchema<INPUT>;
  outputSchema: FlexibleSchema<OUTPUT>;
}): ProviderDefinedToolFactoryWithOutputSchema<INPUT, OUTPUT, ARGS, CONTEXT> {
  // 序列化和本地执行路径与上面的工厂相同，差别仅是 outputSchema 由 Provider
  // 工厂固定，避免每位调用方重复声明。
  return ({
    execute,
    needsApproval,
    toModelOutput,
    onInputStart,
    onInputDelta,
    onInputAvailable,
    ...args
  }: ARGS & {
    execute?: ToolExecuteFunction<INPUT, OUTPUT, CONTEXT>;
    needsApproval?: Tool<INPUT, OUTPUT, CONTEXT>['needsApproval'];
    toModelOutput?: Tool<INPUT, OUTPUT, CONTEXT>['toModelOutput'];
    onInputStart?: Tool<INPUT, OUTPUT, CONTEXT>['onInputStart'];
    onInputDelta?: Tool<INPUT, OUTPUT, CONTEXT>['onInputDelta'];
    onInputAvailable?: Tool<INPUT, OUTPUT, CONTEXT>['onInputAvailable'];
  }): ProviderDefinedTool<INPUT, OUTPUT, CONTEXT> =>
    tool({
      type: 'provider',
      isProviderExecuted: false,
      id,
      args,
      inputSchema,
      outputSchema,
      execute,
      needsApproval,
      toModelOutput,
      onInputStart,
      onInputDelta,
      onInputAvailable,
    }) as ProviderDefinedTool<INPUT, OUTPUT, CONTEXT>;
}
