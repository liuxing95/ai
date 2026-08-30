import {
  createProviderDefinedToolFactory,
  lazySchema,
  zodSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

export const textEditor_20250728ArgsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      maxCharacters: z.number().optional(),
    }),
  ),
);

const textEditor_20250728InputSchema = lazySchema(() =>
  zodSchema(
    z.object({
      command: z.enum(['view', 'create', 'str_replace', 'insert']),
      path: z.string(),
      file_text: z.string().optional(),
      insert_line: z.number().int().optional(),
      new_str: z.string().optional(),
      insert_text: z.string().optional(),
      old_str: z.string().optional(),
      view_range: z.array(z.number().int()).optional(),
    }),
  ),
);

/**
 * Anthropic 文本编辑原生协议的应用侧工具工厂。
 *
 * 它只固定 Claude 的 command/path Schema。adapter 将它声明为
 * `text_editor_20250728`，模型返回 `tool_use` 后 Core 会调用应用传入的 `execute`
 * 实际读写本地文件。因此它并非 Anthropic 托管执行，也不会和 OpenAI apply_patch
 * 自动互相转换；应用需在自己的 Agent 能力层实现统一/降级策略。
 */
const factory = createProviderDefinedToolFactory<
  {
    /**
     * The commands to run. Allowed options are: `view`, `create`, `str_replace`, `insert`.
     * Note: `undo_edit` is not supported in Claude 4 models.
     */
    command: 'view' | 'create' | 'str_replace' | 'insert';

    /**
     * Absolute path to file or directory, e.g. `/repo/file.py` or `/repo`.
     */
    path: string;

    /**
     * Required parameter of `create` command, with the content of the file to be created.
     */
    file_text?: string;

    /**
     * Required parameter of `insert` command. The `new_str` will be inserted AFTER the line `insert_line` of `path`.
     */
    insert_line?: number;

    /**
     * Optional parameter of `str_replace` command containing the new string (if not given, no string will be added).
     */
    new_str?: string;

    /**
     * Required parameter of `insert` command containing the text to insert.
     */
    insert_text?: string;

    /**
     * Required parameter of `str_replace` command containing the string in `path` to replace.
     */
    old_str?: string;

    /**
     * Optional parameter of `view` command when `path` points to a file. If none is given, the full file is shown. If provided, the file will be shown in the indicated line number range, e.g. [11, 12] will show lines 11 and 12. Indexing at 1 to start. Setting `[start_line, -1]` shows all lines from `start_line` to the end of the file.
     */
    view_range?: number[];
  },
  {
    /**
     * Optional parameter to control truncation when viewing large files. Only compatible with text_editor_20250728 and later versions.
     */
    maxCharacters?: number;
  }
>({
  id: 'anthropic.text_editor_20250728',
  inputSchema: textEditor_20250728InputSchema,
});

export const textEditor_20250728 = (
  args: Parameters<typeof factory>[0] = {}, // default
) => {
  return factory(args);
};
