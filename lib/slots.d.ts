export type SlotType = 'cover' | 'inline' | 'end';
export type SlotStatus = 'pending' | 'ok' | 'error' | 'skipped' | 'dry-run';
/** Editable illustration marker. Publish copy must not keep the HTML comment. */
export interface IllustSlot {
    id: string;
    type: SlotType;
    ratio: string;
    /** Comma-separated ref keys, for example `front,smile`. */
    ref: string;
    mood: string;
    note: string;
    prompt?: string;
    imageUrl?: string;
    urls?: string[];
    localPath?: string;
    status: SlotStatus;
    model?: string;
    size?: string;
    requestedSize?: string;
    elapsedMs?: number;
    error?: string;
    cacheError?: string;
    skipped?: boolean;
    notionPageUrl?: string;
    notionError?: string;
    notionPayload?: unknown;
    warnings?: string[];
    /** Redacted upstream request, present on dry runs. */
    request?: Record<string, unknown>;
}
export declare function defaultRatio(type: SlotType): string;
export declare function parseRefList(ref: string | undefined): string[];
/** Accept a JSON slot object from the HTTP API or the CLI. */
export declare function coerceSlot(input: unknown): IllustSlot;
/** Read every ILLUST marker, in document order. */
export declare function planSlots(markdown: string): IllustSlot[];
/**
 * Remove ILLUST comments so a publish paste never contains them.
 * Other HTML comments are left alone. Blank runs collapse to one empty line.
 */
export declare function stripSlotsForPublish(markdown: string): string;
/** Serialize one slot back into a single HTML comment. */
export declare function renderMarker(slot: IllustSlot): string;
/**
 * Rewrite markers whose id matches `slots`. Ids that are not in the draft
 * are appended at the end, which is how a new slot is injected.
 */
export declare function applySlotUpdates(markdown: string, slots: readonly IllustSlot[]): string;
//# sourceMappingURL=slots.d.ts.map