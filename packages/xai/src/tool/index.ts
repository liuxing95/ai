import { codeExecution } from './code-execution';
import { fileSearch } from './file-search';
import { imageGeneration } from './image-generation';
import { mcpServer } from './mcp-server';
import { viewImage } from './view-image';
import { viewXVideo } from './view-x-video';
import { webSearch } from './web-search';
import { xSearch } from './x-search';

export {
  codeExecution,
  fileSearch,
  imageGeneration,
  mcpServer,
  viewImage,
  viewXVideo,
  webSearch,
  xSearch,
};

/**
 * xAI Provider 原生工具的公开集合。每个工厂都由 Core `prepareTools` 识别为
 * provider tool，再由 `xai-responses-prepare-tools` 按 `xai.*` id 转为 API JSON；
 * 它不是跨 Provider 工具语义的通用注册表。
 */
export const xaiTools = {
  codeExecution,
  fileSearch,
  imageGeneration,
  mcpServer,
  viewImage,
  viewXVideo,
  webSearch,
  xSearch,
};
