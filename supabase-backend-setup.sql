-- ============================================
-- Backend Receipt Processing Setup for Supabase
-- Run this in Supabase SQL Editor AFTER deploying the Edge Function
-- ============================================

-- ============================================
-- STEP 1: Enable pg_net extension (for HTTP calls from database)
-- ============================================
-- This is optional - primary processing uses Edge Functions
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- STEP 2: Create a function to call the Edge Function
-- ============================================
-- Note: Replace YOUR_PROJECT_REF with your actual Supabase project reference
-- You can find it in your Supabase dashboard URL: https://supabase.com/dashboard/project/YOUR_PROJECT_REF

CREATE OR REPLACE FUNCTION trigger_receipt_processing()
RETURNS TRIGGER AS $$
DECLARE
    edge_function_url TEXT;
    service_role_key TEXT;
BEGIN
    -- Only trigger if:
    -- 1. Receipt was just uploaded (has_receipt changed to true)
    -- 2. OR this is a new record with a receipt
    -- 3. AND receipt hasn't been scanned yet
    IF (NEW.has_receipt = true AND NEW.receipt_scanned = false) THEN
        -- Get the Edge Function URL from app settings (stored in a config table)
        -- Or you can hardcode it: edge_function_url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-receipt';
        
        -- Log that processing was triggered (visible in Supabase logs)
        RAISE NOTICE 'Receipt processing triggered for expense: %', NEW.id;
        
        -- The actual HTTP call to the Edge Function is handled by the webhook
        -- This trigger just logs and validates
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 3: Create the trigger on Budget table
-- ============================================
DROP TRIGGER IF EXISTS on_receipt_uploaded ON "Budget";

CREATE TRIGGER on_receipt_uploaded
    AFTER INSERT OR UPDATE OF has_receipt, "Receipt"
    ON "Budget"
    FOR EACH ROW
    EXECUTE FUNCTION trigger_receipt_processing();

-- ============================================
-- STEP 4: Add processing_status column for better tracking (optional)
-- ============================================
ALTER TABLE "Budget" 
ADD COLUMN IF NOT EXISTS receipt_processing_status TEXT DEFAULT NULL;

-- Status values: 'pending', 'processing', 'completed', 'failed'

COMMENT ON COLUMN "Budget".receipt_processing_status IS 
'Tracks receipt OCR processing status: pending, processing, completed, failed';

-- ============================================
-- STEP 5: Create an index for faster queries on unprocessed receipts
-- ============================================
CREATE INDEX IF NOT EXISTS idx_budget_unprocessed_receipts 
ON "Budget" (has_receipt, receipt_scanned) 
WHERE has_receipt = true AND receipt_scanned = false;

-- ============================================
-- MANUAL WEBHOOK SETUP INSTRUCTIONS
-- ============================================
/*
After running this SQL, you need to set up a Database Webhook in Supabase:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to: Database > Webhooks
4. Click "Create a new webhook"
5. Configure as follows:

   Name: process-receipt-on-upload
   Table: Budget
   Events: INSERT, UPDATE
   
   Type: Supabase Edge Function
   Edge Function: process-receipt
   
   HTTP Headers:
   - Authorization: Bearer YOUR_SUPABASE_ANON_KEY
   - Content-Type: application/json

6. Click "Create webhook"

ALTERNATIVE: Using HTTP webhook directly:
   
   URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-receipt
   Method: POST
   
   HTTP Headers:
   - Authorization: Bearer YOUR_SUPABASE_ANON_KEY
   - Content-Type: application/json

*/

-- ============================================
-- STEP 6: Grant necessary permissions
-- ============================================
GRANT EXECUTE ON FUNCTION trigger_receipt_processing() TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_receipt_processing() TO anon;

-- ============================================
-- Verification queries
-- ============================================
-- Check if trigger exists:
-- SELECT trigger_name, event_manipulation, action_statement 
-- FROM information_schema.triggers 
-- WHERE trigger_name = 'on_receipt_uploaded';

-- Check unprocessed receipts:
-- SELECT id, "Item", has_receipt, receipt_scanned, receipt_processing_status
-- FROM "Budget"
-- WHERE has_receipt = true AND receipt_scanned = false;

-- ============================================
-- EDGE FUNCTION DEPLOYMENT INSTRUCTIONS
-- ============================================
/*
To deploy the Edge Function:

1. Install Supabase CLI:
   npm install -g supabase

2. Login to Supabase:
   supabase login

3. Link your project:
   cd /path/to/budget
   supabase link --project-ref YOUR_PROJECT_REF

4. Set the Gemini API key as a secret:
   supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here

5. Deploy the function:
   supabase functions deploy process-receipt

6. Test the function:
   curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-receipt' \
     -H 'Authorization: Bearer YOUR_ANON_KEY' \
     -H 'Content-Type: application/json' \
     -d '{"expense_id": "your-expense-id"}'
*/

