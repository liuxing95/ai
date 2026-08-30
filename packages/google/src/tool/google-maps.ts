import {
  createProviderExecutedToolFactory,
  lazySchema,
  zodSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

// https://ai.google.dev/gemini-api/docs/maps-grounding
// https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-maps

/**
 * Google Maps grounding 的服务端工具定义；地理检索由 Google 执行，Core 通过
 * `providerExecuted` 避免把此能力误交给本地 `execute`。
 */
export const googleMaps = createProviderExecutedToolFactory<{}, {}, {}>({
  id: 'google.google_maps',
  inputSchema: lazySchema(() => zodSchema(z.object({}))),
  outputSchema: lazySchema(() => zodSchema(z.object({}))),
});
