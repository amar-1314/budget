// Supabase Edge Function: Process Receipt with Gemini OCR
// This function is triggered by a database webhook when a receipt is uploaded
// It extracts items from the receipt using Google Gemini and saves them to ReceiptItems table

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Gemini API configuration
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Retry configuration for exponential backoff
const INITIAL_RETRY_DELAY_MS = 1000; // Start with 1 second
const MAX_RETRY_DELAY_MS = 120000; // Cap at 2 minutes
const RETRY_MULTIPLIER = 2; // Double the delay each time (1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s...)
const MAX_RETRIES = 15; // Maximum retry attempts (with exponential backoff this gives plenty of time)

interface ReceiptItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface ExtractedReceiptData {
  store: string;
  date: string;
  total: number;
  items: ReceiptItem[];
}

// Helper function to sleep for a given duration
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Parse retry delay from Gemini API error response
function parseRetryDelay(errorText: string): number | null {
  try {
    const errorJson = JSON.parse(errorText);
    // Look for retryDelay in details
    const retryInfo = errorJson.error?.details?.find(
      (d: any) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
    );
    if (retryInfo?.retryDelay) {
      // Parse "34s" format
      const match = retryInfo.retryDelay.match(/(\d+)s/);
      if (match) {
        return parseInt(match[1], 10) * 1000; // Convert to milliseconds
      }
    }
    // Also try to parse from message like "Please retry in 34.487004172s"
    const messageMatch = errorJson.error?.message?.match(/retry in (\d+(?:\.\d+)?)s/i);
    if (messageMatch) {
      return Math.ceil(parseFloat(messageMatch[1]) * 1000);
    }
  } catch {
    // Failed to parse, return null
  }
  return null;
}

// Call Gemini API to extract receipt data with exponential backoff retry
async function extractReceiptDataWithGemini(
  base64Data: string,
  mimeType: string
): Promise<ExtractedReceiptData | null> {
  const prompt = `Analyze this receipt image and extract the following information in JSON format:
{
  "store": "store/merchant name",
  "date": "YYYY-MM-DD format",
  "total": numeric total amount,
  "items": [
    {
      "description": "item name/description",
      "quantity": numeric quantity (default 1 if not shown),
      "unit_price": numeric unit price (0 if not shown),
      "total_price": numeric total price for this item
    }
  ]
}

Important:
- Extract ALL line items from the receipt
- For quantity, use 1 if not explicitly shown
- For prices, extract the actual numbers without currency symbols
- Return ONLY valid JSON, no markdown or explanations`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
    },
  };

  let lastError: Error | null = null;
  let currentDelay = INITIAL_RETRY_DELAY_MS;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Gemini API attempt ${attempt}/${MAX_RETRIES}...`);
      
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const result = await response.json();
        const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textResponse) return null;

        // Clean up JSON response
        let jsonStr = textResponse.trim();
        if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
        else if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
        if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
        jsonStr = jsonStr.trim();

        console.log(`Gemini API succeeded on attempt ${attempt}`);
        return JSON.parse(jsonStr);
      }

      // Handle rate limit (429) errors with retry
      if (response.status === 429) {
        const errorText = await response.text();
        console.warn(`Rate limited (429) on attempt ${attempt}. Error:`, errorText);
        
        // Try to get suggested retry delay from API response
        const suggestedDelay = parseRetryDelay(errorText);
        
        // Use suggested delay if available and reasonable, otherwise use exponential backoff
        let delayToUse: number;
        if (suggestedDelay && suggestedDelay > 0 && suggestedDelay <= MAX_RETRY_DELAY_MS) {
          delayToUse = suggestedDelay + 1000; // Add 1 second buffer
          console.log(`Using API suggested retry delay: ${delayToUse}ms`);
        } else {
          delayToUse = Math.min(currentDelay, MAX_RETRY_DELAY_MS);
          console.log(`Using exponential backoff delay: ${delayToUse}ms`);
        }
        
        if (attempt < MAX_RETRIES) {
          console.log(`Waiting ${delayToUse}ms before retry ${attempt + 1}...`);
          await sleep(delayToUse);
          
          // Increase delay for next time using exponential backoff
          currentDelay = Math.min(currentDelay * RETRY_MULTIPLIER, MAX_RETRY_DELAY_MS);
        }
        
        lastError = new Error(`Gemini API rate limited (429) after ${attempt} attempts`);
        continue;
      }

      // For other errors, don't retry
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
      
    } catch (error) {
      // Network errors or other exceptions - retry with backoff
      if (error.message?.includes("Gemini API error:") && !error.message?.includes("429")) {
        // Non-retryable API error
        throw error;
      }
      
      console.warn(`Attempt ${attempt} failed:`, error.message);
      lastError = error;
      
      if (attempt < MAX_RETRIES) {
        const delayToUse = Math.min(currentDelay, MAX_RETRY_DELAY_MS);
        console.log(`Waiting ${delayToUse}ms before retry ${attempt + 1}...`);
        await sleep(delayToUse);
        currentDelay = Math.min(currentDelay * RETRY_MULTIPLIER, MAX_RETRY_DELAY_MS);
      }
    }
  }

  // All retries exhausted
  console.error(`All ${MAX_RETRIES} retry attempts exhausted`);
  throw lastError || new Error(`Gemini API failed after ${MAX_RETRIES} attempts`);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Store expense ID early so we can use it in error handling
  let currentExpenseId: string | null = null;

  try {
    // Get Supabase credentials from environment
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create Supabase client with service role key for full access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the incoming webhook payload
    const payload = await req.json();
    console.log("Received webhook payload:", JSON.stringify(payload));

    // Handle different payload formats (webhook vs direct call)
    let expenseId: string;
    let record: any;

    if (payload.type === "INSERT" || payload.type === "UPDATE") {
      // Database webhook format
      record = payload.record;
      expenseId = record.id;
    } else if (payload.expense_id) {
      // Direct function call format
      expenseId = payload.expense_id;
      
      // Fetch the expense record
      const { data, error } = await supabase
        .from("Budget")
        .select("*")
        .eq("id", expenseId)
        .single();

      if (error || !data) {
        throw new Error(`Expense not found: ${expenseId}`);
      }
      record = data;
    } else {
      throw new Error("Invalid payload format");
    }

    // Store expense ID for error handling
    currentExpenseId = expenseId;
    console.log("Processing expense:", expenseId);

    // Check if receipt needs processing
    if (!record.has_receipt || record.receipt_scanned) {
      console.log("Receipt already processed or no receipt attached");
      return new Response(
        JSON.stringify({ success: true, message: "No processing needed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only process grocery receipts - check if category contains "grocery"
    const category = (record.Category || "").toLowerCase();
    const isGrocery = category.includes("grocery") || category.includes("groceries");
    
    if (!isGrocery) {
      console.log(`Skipping non-grocery receipt. Category: "${record.Category}"`);
      // Mark as scanned but skipped (won't be processed)
      await supabase
        .from("Budget")
        .update({ receipt_scanned: true, receipt_processing_status: "skipped" })
        .eq("id", expenseId);
      return new Response(
        JSON.stringify({ success: true, message: "Skipped - not a grocery category" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing grocery receipt. Category: "${record.Category}"`);

    // Mark as processing
    await supabase
      .from("Budget")
      .update({ receipt_processing_status: "processing" })
      .eq("id", expenseId);

    // Get the receipt data
    const receiptData = record.Receipt;
    if (!receiptData) {
      console.log("No receipt data found");
      await supabase
        .from("Budget")
        .update({ receipt_scanned: true, receipt_processing_status: "failed" })
        .eq("id", expenseId);
      return new Response(
        JSON.stringify({ success: true, message: "No receipt data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse receipt data to get base64 and mime type
    let base64Data: string = "";
    let mimeType: string = "";

    try {
      let dataUrl: string | null = null;
      
      // Handle different receipt data formats
      if (typeof receiptData === "string") {
        if (receiptData.startsWith("data:")) {
          // Direct data URL format
          dataUrl = receiptData;
          console.log("Receipt format: direct data URL");
        } else if (receiptData.startsWith("[") || receiptData.startsWith("{")) {
          // JSON string - parse it
          const parsed = JSON.parse(receiptData);
          if (Array.isArray(parsed) && parsed[0]?.url) {
            dataUrl = parsed[0].url;
            console.log("Receipt format: JSON array with url");
          } else if (parsed.url) {
            dataUrl = parsed.url;
            console.log("Receipt format: JSON object with url");
          }
        }
      } else if (Array.isArray(receiptData) && receiptData[0]?.url) {
        // Already parsed array
        dataUrl = receiptData[0].url;
        console.log("Receipt format: parsed array");
      } else if (receiptData?.url) {
        // Already parsed object
        dataUrl = receiptData.url;
        console.log("Receipt format: parsed object");
      }

      if (!dataUrl) {
        console.error("Could not extract data URL from receipt data");
        console.error("Receipt data type:", typeof receiptData);
        console.error("Receipt data preview:", String(receiptData).substring(0, 100));
        throw new Error("Could not extract data URL from receipt");
      }

      // Parse the data URL
      if (dataUrl.startsWith("data:")) {
        const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
          console.log(`Extracted: mimeType=${mimeType}, base64 length=${base64Data.length}`);
        } else {
          throw new Error("Invalid data URL format");
        }
      } else {
        throw new Error("URL is not a data URL: " + dataUrl.substring(0, 50));
      }
    } catch (parseError) {
      console.error("Error parsing receipt data:", parseError);
      await supabase
        .from("Budget")
        .update({ receipt_scanned: true, receipt_processing_status: "failed" })
        .eq("id", expenseId);
      return new Response(
        JSON.stringify({ success: false, message: "Failed to parse receipt: " + parseError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling Gemini API to extract receipt data...");
    
    // Extract receipt data using Gemini
    const extractedData = await extractReceiptDataWithGemini(base64Data, mimeType);

    if (!extractedData || !extractedData.items || extractedData.items.length === 0) {
      console.log("No items extracted from receipt");
      await supabase
        .from("Budget")
        .update({ receipt_scanned: true, receipt_processing_status: "completed" })
        .eq("id", expenseId);
      return new Response(
        JSON.stringify({ success: true, message: "No items extracted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Extracted ${extractedData.items.length} items from receipt`);

    // Determine purchase date
    let purchaseDate = extractedData.date;
    if (!purchaseDate && record.Year && record.Month && record.Day) {
      const year = record.Year;
      const month = String(record.Month).padStart(2, "0");
      const day = String(record.Day).padStart(2, "0");
      purchaseDate = `${year}-${month}-${day}`;
    }

    // Save items to ReceiptItems table
    const itemsToInsert = extractedData.items.map((item) => ({
      expense_id: expenseId,
      item_name: item.description || "Unknown Item",
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 0,
      total_price: item.total_price || 0,
      store: extractedData.store || record.Item || "Unknown",
      purchase_date: purchaseDate,
    }));

    const { error: insertError } = await supabase
      .from("ReceiptItems")
      .insert(itemsToInsert);

    if (insertError) {
      console.error("Error inserting receipt items:", insertError);
      throw insertError;
    }

    // Mark receipt as scanned and completed
    await supabase
      .from("Budget")
      .update({ receipt_scanned: true, receipt_processing_status: "completed" })
      .eq("id", expenseId);

    console.log(`Successfully processed receipt for expense ${expenseId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Extracted ${extractedData.items.length} items`,
        items_count: extractedData.items.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing receipt:", error);
    
    // Determine error type for status
    const isRateLimit = error.message?.includes("429") || error.message?.includes("rate");
    const isRetryExhausted = error.message?.includes("attempts exhausted") || error.message?.includes("failed after");
    
    // Try to mark with appropriate status
    if (currentExpenseId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Determine appropriate status:
        // - "retry_pending": Rate limit exhausted all retries, needs to be re-triggered later
        // - "failed": Permanent failure (non-retryable error)
        let status: string;
        if (isRateLimit || isRetryExhausted) {
          status = "retry_pending"; // Indicates it needs to be manually re-triggered or scheduled
          console.log("Receipt marked as retry_pending - rate limit retries exhausted");
        } else {
          status = "failed";
          console.log("Receipt marked as failed - non-retryable error");
        }
        
        await supabase
          .from("Budget")
          .update({ receipt_processing_status: status })
          .eq("id", currentExpenseId);
        console.log(`Updated expense ${currentExpenseId} status to: ${status}`);
      } catch (updateError) {
        console.error("Failed to update status on error:", updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        retryable: isRateLimit || isRetryExhausted
      }),
      {
        status: isRateLimit ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

