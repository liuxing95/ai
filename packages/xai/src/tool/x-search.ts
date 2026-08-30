import {
  createProviderExecutedToolFactory,
  lazySchema,
  zodSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const xSearchArgsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      allowedXHandles: z.array(z.string()).max(10).optional(),
      excludedXHandles: z.array(z.string()).max(10).optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      enableImageUnderstanding: z.boolean().optional(),
      enableVideoUnderstanding: z.boolean().optional(),
    }),
  ),
);

const xSearchOutputSchema = lazySchema(() =>
  zodSchema(
    z.object({
      query: z.string(),
      posts: z.array(
        z.object({
          author: z.string(),
          text: z.string(),
          url: z.string(),
          likes: z.number(),
        }),
      ),
    }),
  ),
);

/**
 * xAI 对 X 平台内容的服务端检索工具。它是 `xai.*` 专有 Provider 能力，而不是
 * 可以自动降级到其他 Provider 的通用 function tool。
 */
const xSearchToolFactory = createProviderExecutedToolFactory<
  {},
  {
    query: string;
    posts: Array<{
      author: string;
      text: string;
      url: string;
      likes: number;
    }>;
  },
  {
    allowedXHandles?: string[];
    excludedXHandles?: string[];
    fromDate?: string;
    toDate?: string;
    enableImageUnderstanding?: boolean;
    enableVideoUnderstanding?: boolean;
  }
>({
  id: 'xai.x_search',
  inputSchema: lazySchema(() => zodSchema(z.object({}))),
  outputSchema: xSearchOutputSchema,
});

export const xSearch = (args: Parameters<typeof xSearchToolFactory>[0] = {}) =>
  xSearchToolFactory(args);
