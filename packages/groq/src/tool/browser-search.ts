import {
  createProviderExecutedToolFactory,
  lazySchema,
  zodSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

/**
 * Browser search tool for Groq models.
 *
 * Provides interactive browser search capabilities that go beyond traditional web search
 * by navigating websites interactively and providing more detailed results.
 *
 * Currently supported on:
 * - openai/gpt-oss-20b
 * - openai/gpt-oss-120b
 *
 * @see https://console.groq.com/docs/browser-search
 */
/**
 * Groq Browser Search 的服务端工具定义。该工具的浏览/检索不经过 AI SDK 本地
 * `execute`，adapter 只负责将 Groq 的请求和结果映射为统一协议。
 */
export const browserSearch = createProviderExecutedToolFactory<
  {
    // Browser search doesn't take input parameters - it's controlled by the prompt
    // The tool is activated automatically when included in the tools array
  },
  {
    // Browser search doesn't have any output parameters
  },
  {
    // No configuration options needed - the tool works automatically
    // when included in the tools array for supported models
  }
>({
  id: 'groq.browser_search',
  inputSchema: lazySchema(() => zodSchema(z.object({}))),
  outputSchema: lazySchema(() => zodSchema(z.object({}))),
});
