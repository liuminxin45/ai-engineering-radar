import { z } from "zod";
export const acquisitionTraceSchema = z.object({
  provider: z.string().regex(/^[a-z0-9-]{1,40}$/),
  attempts: z
    .array(
      z.object({
        provider: z.string().regex(/^[a-z0-9-]{1,40}$/),
        status: z.enum(["success", "failed"]),
      }),
    )
    .min(1)
    .max(8),
});
export type AcquisitionTrace = z.infer<typeof acquisitionTraceSchema>;
