/**
 * Size strings the count API accepts, plus the aliases this plugin maps.
 *
 * RootFlow accepts OpenAI pixels and ratio strings. `2.35:1` is not in that
 * list. 21:9 is 2.333:1, which is the closest supported ratio (closer than
 * 2:1 or the 16:9 pixel size 1792x1024).
 */
export declare const RATIO_SIZES: readonly ["1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "2:1", "1:2", "21:9", "9:21"];
export declare const PIXEL_SIZES: readonly ["1024x1024", "1536x1024", "1024x1536", "1792x1024", "1024x1792"];
/** Pixel size the docs list as the equivalent of a standard ratio. */
export declare const PIXEL_FOR_RATIO: Record<string, string>;
/** GPT-Image-2 4K count models only accept these wide ratios. */
export declare const GPT_4K_RATIOS: Set<string>;
/** Extra long ratios documented for Gemini 3.1 Flash. */
export declare const GEMINI_LONG_RATIOS: Set<string>;
export interface SizeAlias {
    size: string;
    note: string;
}
export declare const SIZE_ALIASES: Record<string, SizeAlias>;
export declare const MODEL_ALIASES: Record<string, string>;
export declare function resolveModel(input: string | undefined, fallback: string): string;
export declare function isGeminiModel(model: string): boolean;
export declare function isGptImageModel(model: string): boolean;
export declare function isGpt4kModel(model: string): boolean;
export declare function resolveSize(input: string | undefined, model: string): {
    size: string;
    requestedSize: string;
};
export declare function isAllowedSize(size: string, model: string): boolean;
/** GPT count models accept quality. Gemini count models do not. */
export declare function qualityForModel(model: string, quality: string | undefined): 'low' | 'medium' | 'high' | undefined;
export declare function resolveCount(n: unknown): number;
//# sourceMappingURL=sizes.d.ts.map