-- ============================================
-- Receipt Items Table for Budget Tracker
-- Run this in Supabase SQL Editor
-- ============================================

-- Create the ReceiptItems table
CREATE TABLE IF NOT EXISTS "ReceiptItems" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id TEXT,  -- Links to Budget.id (the expense this receipt belongs to)
    item_name TEXT NOT NULL,
    quantity NUMERIC DEFAULT 1,
    unit_price NUMERIC DEFAULT 0,
    total_price NUMERIC NOT NULL,
    store TEXT,
    purchase_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index for faster lookups
    CONSTRAINT fk_expense FOREIGN KEY (expense_id) REFERENCES "Budget"(id) ON DELETE CASCADE
);

-- Add index for searching items by name
CREATE INDEX IF NOT EXISTS idx_receipt_items_name ON "ReceiptItems" (item_name);

-- Add index for filtering by expense
CREATE INDEX IF NOT EXISTS idx_receipt_items_expense ON "ReceiptItems" (expense_id);

-- Add index for date-based queries
CREATE INDEX IF NOT EXISTS idx_receipt_items_date ON "ReceiptItems" (purchase_date);

-- Add receipt_scanned column to Budget table to track which receipts have been processed
ALTER TABLE "Budget" ADD COLUMN IF NOT EXISTS receipt_scanned BOOLEAN DEFAULT FALSE;

-- Enable Row Level Security (RLS) - adjust policies as needed
ALTER TABLE "ReceiptItems" ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust based on your needs)
CREATE POLICY "Allow all for authenticated users" ON "ReceiptItems"
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON "ReceiptItems" TO anon;
GRANT ALL ON "ReceiptItems" TO authenticated;

-- ============================================
-- Verify the table was created
-- ============================================
-- SELECT * FROM "ReceiptItems" LIMIT 5;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ReceiptItems';

