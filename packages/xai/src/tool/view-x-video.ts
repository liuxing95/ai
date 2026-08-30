import { createProviderExecutedToolFactory } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

const viewXVideoOutputSchema = z.object({
  transcript: z.string().optional().describe('transcript of the video'),
  description: z.string().describe('description of the video content'),
  duration: z.number().optional().describe('duration in seconds'),
});

/** xAI 服务端 X 视频查看工具；Core 只转发声明和 Provider 返回的结果。 */
const viewXVideoToolFactory = createProviderExecutedToolFactory({
  id: 'xai.view_x_video',
  inputSchema: z.object({}).describe('no input parameters'),
  outputSchema: viewXVideoOutputSchema,
});

export const viewXVideo = (
  args: Parameters<typeof viewXVideoToolFactory>[0] = {},
) => viewXVideoToolFactory(args);
