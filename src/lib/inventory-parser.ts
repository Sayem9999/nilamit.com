import Papa from 'papaparse';
import { z } from 'zod';

export const BulkAuctionSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(20),
  category: z.string(),
  startingPrice: z.coerce.number().positive(),
  minIncrement: z.coerce.number().positive().default(100),
  durationHours: z.coerce.number().positive().default(24),
  reservePrice: z.coerce.number().positive().optional(),
  buyNowPrice: z.coerce.number().positive().optional(),
  location: z.string().optional().default("Dhaka"),
  images: z.string().optional().transform(val => val ? val.split(',').map(s => s.trim()) : []),
});

export type BulkAuctionInput = z.infer<typeof BulkAuctionSchema>;

export interface ParseResult {
  data: BulkAuctionInput[];
  errors: { row: number; message: string }[];
}

export function parseInventoryCSV(csvString: string): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data: BulkAuctionInput[] = [];
        const errors: { row: number; message: string }[] = [];

        results.data.forEach((row: Record<string, unknown>, index: number) => {
          const parsed = BulkAuctionSchema.safeParse(row);
          if (parsed.success) {
            data.push(parsed.data);
          } else {
            errors.push({
              row: index + 1,
              message: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
            });
          }
        });

        resolve({ data, errors });
      },
    });
  });
}
