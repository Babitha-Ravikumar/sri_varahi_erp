-- 003: Lot numbers must contain EXACTLY 3 digits in the sequence part:
--      format L-YYYYMMDD-NNN (001..999). Enforced at the storage level.
ALTER TABLE lots ADD CONSTRAINT chk_lot_number_format
  CHECK (lot_number ~ '^L-[0-9]{8}-[0-9]{3}$');
