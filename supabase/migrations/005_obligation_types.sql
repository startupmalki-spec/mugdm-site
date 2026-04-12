-- Add new obligation types to match application code
ALTER TABLE obligations DROP CONSTRAINT IF EXISTS obligations_type_check;
ALTER TABLE obligations ADD CONSTRAINT obligations_type_check CHECK (type IN (
  'CR_CONFIRMATION', 'GOSI', 'ZATCA_VAT', 'CHAMBER', 'ZAKAT', 'BALADY',
  'MISA', 'INSURANCE', 'QIWA', 'CUSTOM', 'FOOD_SAFETY', 'SAFETY_CERT', 'HEALTH_LICENSE'
));
