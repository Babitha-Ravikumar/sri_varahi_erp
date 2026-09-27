-- 004: Payment reference for UPI / Bank payments
--      (e.g. UPI confirmation or bank name + UTR number).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference text;
