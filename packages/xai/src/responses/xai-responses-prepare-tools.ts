import {
  UnsupportedFunctionalityError,
  type LanguageModelV4CallOptions,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import { validateTypes } from '@ai-sdk/provider-utils';
import { removeAdditionalPropertiesFalse } from '../remove-additional-properties';
import { fileSearchArgsSchema } from '../tool/file-search';
import { imageGenerationArgsSchema } from '../tool/image-generation';
import { mcpServerArgsSchema } from '../tool/mcp-server';
import { webSearchArgsSchema } from '../tool/web-search';
import { xSearchArgsSchema } from '../tool/x-search';
import type { XaiResponsesTool } from './xai-responses-api';

type XaiResponsesToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; name: string };

/**
 * 将 Core 工具声明转换为 xAI Responses API 的 tools 字段。
 *
 * xAI 原生工具只接受此处枚举的 `xai.*` provider id；其余 function/dynamic 工具
 * 走通用 function 协议并由应用执行。未知 Provider 工具只生成 warning，不会自动
 * 把 OpenAI apply_patch 或 Anthropic text editor 猜测性改写成另一个能力。
 */
export async function prepareResponsesTools({
  tools,
  toolChoice,
}: {
  tools: LanguageModelV4CallOptions['tools'];
  toolChoice?: LanguageModelV4CallOptions['toolChoice'];
}): Promise<{
  tools: Array<XaiResponsesTool> | undefined;
  toolChoice: XaiResponsesToolChoice | undefined;
  toolWarnings: SharedV4Warning[];
}> {
  const normalizedTools = tools?.length ? tools : undefined;

  const toolWarnings: SharedV4Warning[] = [];

  if (normalizedTools == null) {
    return { tools: undefined, toolChoice: undefined, toolWarnings };
  }

  const xaiTools: Array<XaiResponsesTool> = [];
  const toolByName = new Map<string, (typeof normalizedTools)[number]>();

  for (const tool of normalizedTools) {
    toolByName.set(tool.name, tool);

    if (tool.type === 'provider') {
      // `xaiTools.push` 只构造请求 JSON；真正的 web/code/file 等服务端执行由
      // xAI API 完成，并在 language-model 响应适配中标记 providerExecuted。
      switch (tool.id) {
        case 'xai.web_search': {
          const args = await validateTypes({
            value: tool.args,
            schema: webSearchArgsSchema,
          });

          xaiTools.push({
            type: 'web_search',
            allowed_domains: args.allowedDomains,
            excluded_domains: args.excludedDomains,
            enable_image_search: args.enableImageSearch,
            enable_image_understanding: args.enableImageUnderstanding,
          });
          break;
        }

        case 'xai.x_search': {
          const args = await validateTypes({
            value: tool.args,
            schema: xSearchArgsSchema,
          });

          xaiTools.push({
            type: 'x_search',
            allowed_x_handles: args.allowedXHandles,
            excluded_x_handles: args.excludedXHandles,
            from_date: args.fromDate,
            to_date: args.toDate,
            enable_image_understanding: args.enableImageUnderstanding,
            enable_video_understanding: args.enableVideoUnderstanding,
          });
          break;
        }

        case 'xai.code_execution': {
          xaiTools.push({
            type: 'code_interpreter',
          });
          break;
        }

        case 'xai.view_image': {
          xaiTools.push({
            type: 'view_image',
          });
          break;
        }

        case 'xai.view_x_video': {
          xaiTools.push({
            type: 'view_x_video',
          });
          break;
        }

        case 'xai.image_generation': {
          const args = await validateTypes({
            value: tool.args,
            schema: imageGenerationArgsSchema,
          });

          xaiTools.push({
            type: 'image_generation',
            action: args.action,
          });
          break;
        }

        case 'xai.file_search': {
          const args = await validateTypes({
            value: tool.args,
            schema: fileSearchArgsSchema,
          });

          xaiTools.push({
            type: 'file_search',
            vector_store_ids: args.vectorStoreIds,
            max_num_results: args.maxNumResults,
          });
          break;
        }

        case 'xai.mcp': {
          const args = await validateTypes({
            value: tool.args,
            schema: mcpServerArgsSchema,
          });

          xaiTools.push({
            type: 'mcp',
            server_url: args.serverUrl,
            server_label: args.serverLabel,
            server_description: args.serverDescription,
            allowed_tools: args.allowedTools,
            headers: args.headers,
            authorization: args.authorization,
          });
          break;
        }

        default: {
          // 能力未对等时保持显式失败信号，避免静默改变 Agent 的安全语义。
          toolWarnings.push({
            type: 'unsupported',
            feature: `provider-defined tool ${tool.name}`,
          });
          break;
        }
      }
    } else {
      // function/dynamic 没有 xAI 专属 id 时仍可使用跨 Provider 的函数调用协议，
      // 但实际 execute 仍归应用/Agent，不是 xAI 托管。
      xaiTools.push({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: removeAdditionalPropertiesFalse(tool.inputSchema),
        ...(tool.strict != null ? { strict: tool.strict } : {}),
      });
    }
  }

  if (toolChoice == null) {
    return { tools: xaiTools, toolChoice: undefined, toolWarnings };
  }

  const type = toolChoice.type;

  switch (type) {
    case 'auto':
    case 'none':
      return { tools: xaiTools, toolChoice: type, toolWarnings };
    case 'required':
      return { tools: xaiTools, toolChoice: 'required', toolWarnings };
    case 'tool': {
      const selectedTool = toolByName.get(toolChoice.toolName);

      if (selectedTool == null) {
        return {
          tools: xaiTools,
          toolChoice: undefined,
          toolWarnings,
        };
      }

      if (selectedTool.type === 'provider') {
        // xAI API does not support forcing specific server-side tools via toolChoice
        // Only function tools can be forced with {"type": "function", "function": {"name": "..."}}
        toolWarnings.push({
          type: 'unsupported',
          feature: `toolChoice for server-side tool "${selectedTool.name}"`,
        });
        return { tools: xaiTools, toolChoice: undefined, toolWarnings };
      }

      return {
        tools: xaiTools,
        toolChoice: { type: 'function', name: selectedTool.name },
        toolWarnings,
      };
    }
    default: {
      const _exhaustiveCheck: never = type;
      throw new UnsupportedFunctionalityError({
        functionality: `tool choice type: ${_exhaustiveCheck}`,
      });
    }
  }
}
