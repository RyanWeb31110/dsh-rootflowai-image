import { ImageError } from './errors.js';
/**
 * Size strings the count API accepts, plus the aliases this plugin maps.
 *
 * RootFlow accepts OpenAI pixels and ratio strings. `2.35:1` is not in that
 * list. 21:9 is 2.333:1, which is the closest supported ratio (closer than
 * 2:1 or the 16:9 pixel size 1792x1024).
 */
export const RATIO_SIZES = [
    '1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5',
    '16:9', '9:16', '2:1', '1:2', '21:9', '9:21',
];
export const PIXEL_SIZES = [
    '1024x1024',
    '1536x1024',
    '1024x1536',
    '1792x1024',
    '1024x1792',
];
/** Pixel size the docs list as the equivalent of a standard ratio. */
export const PIXEL_FOR_RATIO = {
    '1:1': '1024x1024',
    '3:2': '1536x1024',
    '2:3': '1024x1536',
    '16:9': '1792x1024',
    '9:16': '1024x1792',
};
const PIXEL_TO_RATIO = Object.fromEntries(Object.entries(PIXEL_FOR_RATIO).map(([ratio, pixel]) => [pixel, ratio]));
/** GPT-Image-2 4K count models only accept these wide ratios. */
export const GPT_4K_RATIOS = new Set(['16:9', '9:16', '2:1', '1:2', '21:9', '9:21']);
/** Extra long ratios documented for Gemini 3.1 Flash. */
export const GEMINI_LONG_RATIOS = new Set(['1:4', '4:1', '1:8', '8:1']);
export const SIZE_ALIASES = {
    '2.35:1': {
        size: '21:9',
        note: 'Cinematic 2.35:1 maps to 21:9 (2.333:1). 1792x1024 is 16:9 and is not used for this alias.',
    },
    '2.39:1': {
        size: '21:9',
        note: 'Anamorphic 2.39:1 maps to 21:9.',
    },
    cover: {
        size: '21:9',
        note: 'The cover alias maps to 21:9, the closest supported ratio to a 2.35:1 banner.',
    },
};
export const MODEL_ALIASES = {
    'hd-count': 'gpt-image-2-hd-count',
    '4k-count': 'gpt-image-2-4k-count',
    'gpt-image-2-hd': 'gpt-image-2-hd-count',
    'gpt-image-2-4k': 'gpt-image-2-4k-count',
};
const RATIO_SET = new Set(RATIO_SIZES);
const PIXEL_SET = new Set(PIXEL_SIZES);
export function resolveModel(input, fallback) {
    const raw = (input ?? '').trim() || fallback;
    return MODEL_ALIASES[raw] ?? raw;
}
export function isGeminiModel(model) {
    return model.toLowerCase().includes('gemini');
}
export function isGptImageModel(model) {
    return model.toLowerCase().includes('gpt-image');
}
export function isGpt4kModel(model) {
    const name = model.toLowerCase();
    return name.includes('gpt-image') && name.includes('4k');
}
export function resolveSize(input, model) {
    const requestedSize = (input ?? '').trim() || '1:1';
    const alias = SIZE_ALIASES[requestedSize];
    const size = alias?.size ?? requestedSize;
    if (!isAllowedSize(size, model)) {
        throw new ImageError(400, 'invalid_size', `${requestedSize} is not a supported size for ${model}`);
    }
    return { size, requestedSize };
}
export function isAllowedSize(size, model) {
    if (isGpt4kModel(model)) {
        if (GPT_4K_RATIOS.has(size))
            return true;
        const ratio = PIXEL_TO_RATIO[size];
        return ratio ? GPT_4K_RATIOS.has(ratio) : false;
    }
    if (RATIO_SET.has(size) || PIXEL_SET.has(size))
        return true;
    if (isGeminiModel(model) && GEMINI_LONG_RATIOS.has(size))
        return true;
    return false;
}
/** GPT count models accept quality. Gemini count models do not. */
export function qualityForModel(model, quality) {
    if (quality === undefined || quality.trim() === '')
        return undefined;
    const value = quality.trim().toLowerCase();
    if (value !== 'low' && value !== 'medium' && value !== 'high') {
        throw new ImageError(400, 'invalid_quality', 'quality must be low, medium, or high');
    }
    if (isGeminiModel(model) || !isGptImageModel(model))
        return undefined;
    return value;
}
export function resolveCount(n) {
    if (n === undefined || n === null || n === '')
        return 1;
    const value = typeof n === 'number' ? n : Number(n);
    if (!Number.isInteger(value) || value < 1 || value > 4) {
        throw new ImageError(400, 'invalid_n', 'n must be an integer from 1 to 4; prefer 1');
    }
    return value;
}
//# sourceMappingURL=sizes.js.map