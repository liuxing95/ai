import {
  createProviderExecutedToolFactory,
  lazySchema,
  zodSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

// https://ai.google.dev/gemini-api/docs/google-search
// https://ai.google.dev/api/generate-content#GroundingSupport
// https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-search

export const googleSearchToolArgsBaseSchema = z.looseObject({
  searchTypes: z
    .object({
      webSearch: z.object({}).optional(),
      imageSearch: z.object({}).optional(),
    })
    .optional(),

  timeRangeFilter: z
    .object({
      startTime: z.string(),
      endTime: z.string(),
    })
    .optional(),
});

export type GoogleSearchToolArgs = z.infer<
  typeof googleSearchToolArgsBaseSchema
>;

/**
 * Google Search grounding 的服务端工具定义。搜索、grounding 和引用由 Google
 * Provider 完成，Core 只处理标准化的 tool-call/tool-result。
 */
export const googleSearch = createProviderExecutedToolFactory<
  {},
  {},
  GoogleSearchToolArgs
>({
  id: 'google.google_search',
  inputSchema: lazySchema(() => zodSchema(z.object({}))),
  outputSchema: lazySchema(() => zodSchema(z.object({}))),
});
