const { z } = require('zod');

const retrievalInputSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().optional()
});

const configGeneratorInputSchema = z.object({
  instructions: z.string().min(1),
  useExamples: z.boolean().optional(),
  topK: z.number().int().positive().optional()
});

module.exports = {
  retrievalInputSchema,
  configGeneratorInputSchema
};
