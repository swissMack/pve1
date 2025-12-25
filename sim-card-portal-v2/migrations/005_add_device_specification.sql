-- Migration: Add device specification column
-- Description: Adds a specification_base64 column to store device specification documents in base64 format
-- Date: 2025-10-15

-- Add specification_base64 column to devices table
ALTER TABLE "sim-card-portal-v2".devices 
ADD COLUMN IF NOT EXISTS specification_base64 TEXT;

-- Add comment to the column for documentation
COMMENT ON COLUMN "sim-card-portal-v2".devices.specification_base64 IS 
'Base64-encoded device specification document (PDF, Word, etc.). Used to store technical specifications, datasheets, and documentation for the device.';
