const { z } = require('zod');

const retrievalInputSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().positive().optional(),
  generateAnswer: z.boolean().optional()
});

const configGeneratorInputSchema = z.object({
  instructions: z.string().min(1),
  useExamples: z.boolean().optional(),
  topK: z.number().int().positive().optional()
});

const chatInputSchema = z.object({
  message: z.string().min(1),
  systemPrompt: z.string().min(1).optional()
});

module.exports = {
  retrievalInputSchema,
  configGeneratorInputSchema,
  chatInputSchema
};
