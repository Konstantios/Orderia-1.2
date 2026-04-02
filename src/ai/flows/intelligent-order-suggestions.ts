'use server';
/**
 * @fileOverview An AI agent that provides intelligent order quantity suggestions for customers.
 *
 * - intelligentOrderSuggestions - A function that handles the intelligent order suggestion process.
 * - IntelligentOrderSuggestionsInput - The input type for the intelligentOrderSuggestions function.
 * - IntelligentOrderSuggestionsOutput - The return type for the intelligentOrderSuggestions function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const IntelligentOrderSuggestionsInputSchema = z.object({
  customerId: z.string().describe('The ID of the customer for whom to generate order suggestions.'),
  customerName: z.string().optional().describe('The name of the customer.'),
  products: z.array(
    z.object({
      productId: z.string().describe('The ID of the product.'),
      productName: z.string().describe('The name of the product.'),
      currentStock: z.number().int().min(0).describe('The current stock level of the product for the customer.'),
      idealStock: z.number().int().min(0).optional().describe('The ideal stock level for the product, if known.'),
      historicalOrders: z.array(
        z.object({
          date: z.string().datetime().describe('The date of the historical order (ISO 8601 format).'),
          quantity: z.number().int().min(0).describe('The quantity of the product ordered on that date.'),
        })
      ).describe('A list of past orders for this specific product by this customer.'),
    })
  ).describe('A list of products for which to generate order suggestions, including current stock and historical data.'),
});
export type IntelligentOrderSuggestionsInput = z.infer<typeof IntelligentOrderSuggestionsInputSchema>;

const IntelligentOrderSuggestionsOutputSchema = z.object({
  suggestions: z.array(
    z.object({
      productId: z.string().describe('The ID of the product.'),
      suggestedQuantity: z.number().int().min(0).describe('The AI-powered suggested order quantity for the product.'),
      reasoning: z.string().describe('A brief explanation for the suggested quantity, considering historical patterns, seasonality, and current stock.'),
    })
  ).describe('A list of suggested order quantities for each product.'),
});
export type IntelligentOrderSuggestionsOutput = z.infer<typeof IntelligentOrderSuggestionsOutputSchema>;

export async function intelligentOrderSuggestions(input: IntelligentOrderSuggestionsInput): Promise<IntelligentOrderSuggestionsOutput> {
  return intelligentOrderSuggestionsFlow(input);
}

const intelligentOrderSuggestionsPrompt = ai.definePrompt({
  name: 'intelligentOrderSuggestionsPrompt',
  input: { schema: IntelligentOrderSuggestionsInputSchema },
  output: { schema: IntelligentOrderSuggestionsOutputSchema },
  prompt: `You are an intelligent ordering assistant for a wholesale frozen food business. Your goal is to provide accurate order quantity suggestions for a customer based on their current stock, historical purchasing patterns, and implied seasonality from their past orders.

Customer ID: {{{customerId}}}
Customer Name: {{{customerName}}}

Here are the products for which you need to generate order suggestions:

{{#each products}}
---
Product ID: {{{productId}}}
Product Name: {{{productName}}}
Current Stock: {{{currentStock}}}
{{#if idealStock}}Ideal Stock: {{{idealStock}}}{{/if}}

Historical Orders for this product:
{{#if historicalOrders}}
  {{#each historicalOrders}}
    - Date: {{{date}}}, Quantity: {{{quantity}}}
  {{/each}}
{{else}}
  No historical order data available for this product.
{{/if}}
---
{{/each}}

Based on the provided information, especially the historical purchasing data to infer usage patterns and seasonality, and considering the current stock levels, suggest an optimal order quantity for each product. If an ideal stock is provided, use it as a target. Ensure the suggested quantity is not negative. Provide a brief reasoning for each suggestion.

Please provide the output in JSON format, strictly conforming to the output schema.`,
});

const intelligentOrderSuggestionsFlow = ai.defineFlow(
  {
    name: 'intelligentOrderSuggestionsFlow',
    inputSchema: IntelligentOrderSuggestionsInputSchema,
    outputSchema: IntelligentOrderSuggestionsOutputSchema,
  },
  async (input) => {
    const { output } = await intelligentOrderSuggestionsPrompt(input);
    return output!;
  }
);
