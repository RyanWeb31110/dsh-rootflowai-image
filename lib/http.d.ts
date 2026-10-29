import { type Server } from 'node:http';
import { type ImageConfig } from './config.js';
import type { Logger } from './logger.js';
import type { ImageService } from './service.js';
export interface RunningServer {
    port: number;
    close(): Promise<void>;
}
export declare function createHttpServer(config: ImageConfig, service: ImageService, logger: Logger): Server;
export declare function listen(server: Server, host: string, port: number): Promise<number>;
export declare function closeServer(server: Server): Promise<void>;
export declare function startHttpServer(options: {
    config: ImageConfig;
    service: ImageService;
    logger: Logger;
}): Promise<RunningServer>;
//# sourceMappingURL=http.d.ts.map