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

// Call Gemini API to extract receipt data
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

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const result = await response.json();
  const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) return null;

  // Clean up JSON response
  let jsonStr = textResponse.trim();
  if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
  else if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
  jsonStr = jsonStr.trim();

  return JSON.parse(jsonStr);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    console.log("Processing expense:", expenseId);

    // Check if receipt needs processing
    if (!record.has_receipt || record.receipt_scanned) {
      console.log("Receipt already processed or no receipt attached");
      return new Response(
        JSON.stringify({ success: true, message: "No processing needed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the receipt data
    const receiptData = record.Receipt;
    if (!receiptData) {
      console.log("No receipt data found");
      await supabase
        .from("Budget")
        .update({ receipt_scanned: true })
        .eq("id", expenseId);
      return new Response(
        JSON.stringify({ success: true, message: "No receipt data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse receipt data to get base64 and mime type
    let base64Data: string;
    let mimeType: string;

    try {
      const parsed = typeof receiptData === "string" 
        ? JSON.parse(receiptData) 
        : receiptData;
      
      if (Array.isArray(parsed) && parsed[0]?.url) {
        const dataUrl = parsed[0].url;
        if (dataUrl.startsWith("data:")) {
          const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            mimeType = matches[1];
            base64Data = matches[2];
          } else {
            throw new Error("Invalid data URL format");
          }
        } else {
          throw new Error("URL is not a data URL");
        }
      } else {
        throw new Error("Unexpected receipt data format");
      }
    } catch (parseError) {
      console.error("Error parsing receipt data:", parseError);
      await supabase
        .from("Budget")
        .update({ receipt_scanned: true })
        .eq("id", expenseId);
      return new Response(
        JSON.stringify({ success: false, message: "Failed to parse receipt" }),
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
        .update({ receipt_scanned: true })
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

    // Mark receipt as scanned
    await supabase
      .from("Budget")
      .update({ receipt_scanned: true })
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
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

