export interface NotionDeliveryInput {
    title: string;
    prompt: string;
    model: string;
    size: string;
    imageUrl: string;
    localPath?: string;
    slotId?: string;
    articleTitle?: string;
}
export interface NotionPayload {
    parent: {
        page_id: string;
    } | {
        database_id: string;
    };
    properties: Record<string, unknown>;
    children: NotionBlock[];
}
interface NotionBlock {
    object: 'block';
    type: string;
    [key: string]: unknown;
}
export interface NotionDeliveryResult {
    delivered: boolean;
    pageId?: string;
    pageUrl?: string;
    notionError?: string;
    payload: NotionPayload;
}
interface NotionSettings {
    token: string;
    parentPageId: string;
    databaseId: string;
    fetchImpl?: typeof fetch;
}
export declare function normalizeNotionId(value: string): string;
export declare function buildNotionPayload(input: NotionDeliveryInput, parent: NotionPayload['parent'], titleKey?: string): NotionPayload;
/**
 * Create a child page or database row. Missing credentials return the payload
 * and do not throw. A Notion HTTP failure is reported on `notionError`.
 */
export declare function deliverIllustration(settings: NotionSettings, input: NotionDeliveryInput): Promise<NotionDeliveryResult>;
export {};
//# sourceMappingURL=notion.d.ts.map