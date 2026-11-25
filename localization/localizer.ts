import type { MsgFn, MsgOptions, TemplateLike } from '@lit/localize';
import { runtimeMsg } from '@lit/localize/internal/runtime-msg.js';

/** `msg()` in the source language, for code that runs without a widget instance. */
export const sourceMsg = ((template: TemplateLike, options?: MsgOptions) =>
  runtimeMsg(undefined, template, options)) as MsgFn;
