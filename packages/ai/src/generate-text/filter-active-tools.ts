import type { ToolSet } from '@ai-sdk/provider-utils';
import type { ActiveTools } from './active-tools';

export type ActiveToolSubset<
  TOOLS extends ToolSet | undefined,
  ACTIVE_TOOL_NAMES extends ActiveTools<NonNullable<TOOLS>>,
> = TOOLS extends undefined
  ? undefined
  : [ACTIVE_TOOL_NAMES] extends [NonNullable<ActiveTools<NonNullable<TOOLS>>>]
    ? Pick<NonNullable<TOOLS>, ACTIVE_TOOL_NAMES[number]>
    : TOOLS;

/**
 * Filters the tools to only include the active tools.
 * When activeTools is provided, we only include the tools that are in the list.
 *
 * @param tools - The tools to filter.
 * @param activeTools - The active tools to include.
 * @returns The filtered tools.
 */
/**
 * 中文：按工具名筛选当前步骤允许暴露给模型的工具。
 * 调用链：`generateText` / `streamText` 在每一个 step 调用本函数，再把返回的
 * 子集交给 `prepareTools` 序列化并发送给 Provider。因此未出现在 `activeTools`
 * 中的工具既不会出现在该轮模型请求中，也不会成为该轮本地执行的候选。
 *
 * 这里仅执行精确名称匹配（`O(工具数 × 活跃名称数)`）；它不读取 description、
 * 不调用 embedding，也不会自动做“几千个工具”的语义检索、排序或路由。大规模
 * 工具集应由应用/Agent 先检索或分类，然后把选出的名称传给 `activeTools`，或在
 * `prepareStep` 中按轮返回 `activeTools`。
 *
 * 参数说明：`tools` 是完整工具集合；`activeTools` 是本轮保留的名称，省略时原样
 * 返回完整集合；返回值是本轮发送给模型且可供 Core 调度的工具子集。
 */
export function filterActiveTools<
  TOOLS extends ToolSet | undefined,
  ACTIVE_TOOL_NAMES extends ActiveTools<NonNullable<TOOLS>>,
>({
  tools,
  activeTools,
}: {
  tools: TOOLS;
  activeTools: ACTIVE_TOOL_NAMES;
}): ActiveToolSubset<TOOLS, ACTIVE_TOOL_NAMES> {
  if (tools == null || activeTools == null) {
    return tools as ActiveToolSubset<TOOLS, ACTIVE_TOOL_NAMES>;
  }

  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => activeTools.includes(name)),
  ) as ActiveToolSubset<TOOLS, ACTIVE_TOOL_NAMES>;
}
