import { z } from 'zod';

const consoleMessageSchema = z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    logs: z.array(z.string()),
});

export type ConsoleMessage = z.infer<typeof consoleMessageSchema>;
