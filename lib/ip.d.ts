import { type IllustSlot } from './slots.js';
/** Marker so a second pass can tell a built prompt from a short scene note. */
export declare const IP_LOCK_MARK = "\u9752\u5C71 IP \u00B7 V1.0";
/**
 * Built-in filenames for the owner's v1 pack. A README.md or REFS.md inside
 * `ipAssetsDir` overrides these rows. Config `refMap` overrides both.
 */
export declare const BUILTIN_REF_FILES: Record<string, string>;
export declare const CHARACTER_LOCK: string;
export declare const DEFAULT_STYLE: string;
/** Read `key → file` rows from a pack README. Tables and `key: file` lines both work. */
export declare function parseRefMapMarkdown(markdown: string): Record<string, string>;
/**
 * Resolve ref keys to absolute image files.
 * Explicit pack or config rows must exist. Built-in names fall through to a
 * unique filename that contains the key when the guessed file is absent.
 */
export declare function resolveRefFiles(refs: readonly string[], options: {
    ipAssetsDir: string;
    refMap?: Record<string, string>;
}): string[];
export declare function buildIpPrompt(slot: IllustSlot, options?: {
    articleTitle?: string;
    styleNote?: string;
    refKeys?: readonly string[];
}): string;
//# sourceMappingURL=ip.d.ts.map