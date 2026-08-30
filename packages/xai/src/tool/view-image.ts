import { createProviderExecutedToolFactory } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

const viewImageOutputSchema = z.object({
  description: z.string().describe('description of the image'),
  objects: z
    .array(z.string())
    .optional()
    .describe('objects detected in the image'),
});

/** xAI 服务端图像查看工具；无本地 `execute`，由 Provider 返回分析结果。 */
const viewImageToolFactory = createProviderExecutedToolFactory({
  id: 'xai.view_image',
  inputSchema: z.object({}).describe('no input parameters'),
  outputSchema: viewImageOutputSchema,
});

export const viewImage = (
  args: Parameters<typeof viewImageToolFactory>[0] = {},
) => viewImageToolFactory(args);
