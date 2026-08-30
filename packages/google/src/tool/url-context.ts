import {
  createProviderExecutedToolFactory,
  lazySchema,
  zodSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

/**
 * Google URL Context 的服务端工具定义。Provider 从 prompt 中的 URL 取得上下文；
 * SDK 负责序列化配置并转发结果，不在应用进程抓取 URL。
 */
export const urlContext = createProviderExecutedToolFactory<
  {
    // Url context does not have any input schema, it will directly use the url from the prompt
  },
  {},
  {}
>({
  id: 'google.url_context',
  inputSchema: lazySchema(() => zodSchema(z.object({}))),
  outputSchema: lazySchema(() => zodSchema(z.object({}))),
});
