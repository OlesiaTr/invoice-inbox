-- pgmq: locally installed by infra/postgres/init (SQL-only distribution);
-- on Supabase it is an available extension, so create it if needed.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgmq') THEN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pgmq') THEN
      CREATE EXTENSION pgmq;
    ELSE
      RAISE EXCEPTION 'pgmq is not installed in this database (see README → Database)';
    END IF;
  END IF;
END
$$;

-- Work queue for invoice processing + dead-letter queue for poison messages.
SELECT pgmq.create('invoice_processing');
SELECT pgmq.create('invoice_processing_dlq');

-- Every change to an invoice row is announced on the `invoice_events` channel.
-- A trigger (rather than application code) guarantees no code path can forget it,
-- and NOTIFY is transactional: listeners only hear about committed changes.
-- Payload is kept tiny (NOTIFY limit is 8 KB); clients fetch details themselves.
CREATE FUNCTION invoices_notify() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  r invoices%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  PERFORM pg_notify(
    'invoice_events',
    json_build_object(
      'type', TG_OP,
      'id', r.id,
      'status', r.status,
      'updatedAt', r.updated_at
    )::text
  );
  RETURN NULL;
END
$$;

CREATE TRIGGER invoices_notify
AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION invoices_notify();
