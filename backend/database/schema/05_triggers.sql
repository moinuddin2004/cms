-- Triggers. The functions they call are in 01_extensions_functions.sql.

-- History is evidence: rows are only ever inserted.
CREATE TRIGGER trg_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER trg_status_history_append_only
  BEFORE UPDATE OR DELETE ON status_history
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

-- Commission ledger: append-only except settling / releasing an entry.
CREATE TRIGGER trg_commission_entries_append_only
  BEFORE UPDATE OR DELETE ON commission_entries
  FOR EACH ROW EXECUTE FUNCTION commission_entries_append_only();
