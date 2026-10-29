import Schema from '@deepseek-ai/schemastery';
/**
 * Cordis reads this export and fills defaults before `apply`.
 * Keep the defaults aligned with `normalizeConfig`.
 */
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    host: Schema<string, string, "defined">;
    port: Schema<number, number, "defined">;
    token: Schema<string, string, "defined">;
    apiKey: Schema<string, string, "defined">;
    baseUrl: Schema<string, string, "defined">;
    defaultModel: Schema<string, string, "defined">;
    ipAssetsDir: Schema<string, string, "defined">;
    cacheDir: Schema<string, string, "defined">;
    timeoutMs: Schema<number, number, "defined">;
    notionToken: Schema<string, string, "defined">;
    notionParentPageId: Schema<string, string, "defined">;
    notionDatabaseId: Schema<string, string, "defined">;
    styleNote: Schema<string, string, "defined">;
    refMap: Schema<import("@deepseek-ai/cosmokit").Dict<string, string>, import("@deepseek-ai/cosmokit").Dict<string, string>, "defined">;
    maxBodyBytes: Schema<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    host: Schema<string, string, "defined">;
    port: Schema<number, number, "defined">;
    token: Schema<string, string, "defined">;
    apiKey: Schema<string, string, "defined">;
    baseUrl: Schema<string, string, "defined">;
    defaultModel: Schema<string, string, "defined">;
    ipAssetsDir: Schema<string, string, "defined">;
    cacheDir: Schema<string, string, "defined">;
    timeoutMs: Schema<number, number, "defined">;
    notionToken: Schema<string, string, "defined">;
    notionParentPageId: Schema<string, string, "defined">;
    notionDatabaseId: Schema<string, string, "defined">;
    styleNote: Schema<string, string, "defined">;
    refMap: Schema<import("@deepseek-ai/cosmokit").Dict<string, string>, import("@deepseek-ai/cosmokit").Dict<string, string>, "defined">;
    maxBodyBytes: Schema<number, number, "defined">;
}>>, "plain">;
//# sourceMappingURL=schema.d.ts.map