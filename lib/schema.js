import Schema from '@deepseek-ai/schemastery';
/**
 * Cordis reads this export and fills defaults before `apply`.
 * Keep the defaults aligned with `normalizeConfig`.
 */
export const Config = Schema.object({
    host: Schema.string().default('127.0.0.1')
        .description('Bind address. Loopback is the supported setup.'),
    port: Schema.number().default(8794)
        .description('TCP port. 8794 stays clear of dsh-grok-bridge on 8791.'),
    token: Schema.string().default('')
        .description('Optional bearer for /v1. Empty is allowed only on loopback.'),
    apiKey: Schema.string().default('')
        .description('RootFlowAI key. Empty reads nothing from disk; set ROOTFLOWAI_IMAGE_API_KEY or a desktop literal.'),
    baseUrl: Schema.string().default('https://us.rootflowai.com/v1')
        .description('Images API origin. Alternate public host: https://api.rootflowai.com/v1.'),
    defaultModel: Schema.string().default('gemini-3.1-flash-image-count')
        .description('Model used when a request omits model. Gemini count models ignore quality.'),
    ipAssetsDir: Schema.string().default('')
        .description('Absolute directory of the Qingshan IP pack. Empty disables ref files.'),
    cacheDir: Schema.string().default('')
        .description('Where CDN results are saved. Empty uses $DSH_HOME/media-illust.'),
    timeoutMs: Schema.number().default(900_000)
        .description('Upstream read timeout in milliseconds. Generation often takes 30–150s.'),
    notionToken: Schema.string().default('')
        .description('Optional Notion integration token. Empty returns a payload instead of calling Notion.'),
    notionParentPageId: Schema.string().default('')
        .description('Page id or URL under which delivery pages are created.'),
    notionDatabaseId: Schema.string().default('')
        .description('Database id or URL. When set, a row is created here instead of a child page.'),
    styleNote: Schema.string().default('')
        .description('Replaces the built-in 晨纸暖阅 style paragraph. The character lock always stays.'),
    refMap: Schema.dict(Schema.string()).default({})
        .description('Optional ref key to filename overrides. Pack README.md / REFS.md are also read.'),
    maxBodyBytes: Schema.number().default(20_971_520)
        .description('Maximum inbound JSON body size.'),
});
//# sourceMappingURL=schema.js.map