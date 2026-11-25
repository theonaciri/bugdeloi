-- Temps réel : chaque insertion dans `event` notifie le canal `bugdeloi_event`.
-- Le serveur web écoute ce canal (LISTEN) et coalesce les messages pour le flux SSE.
-- La charge utile reste minimale (id, type) : pg_notify est limité à 8000 octets.
CREATE OR REPLACE FUNCTION bugdeloi_event_notify() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('bugdeloi_event', json_build_object('id', NEW.id, 'type', NEW.type)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS event_notify ON event;
--> statement-breakpoint
CREATE TRIGGER event_notify AFTER INSERT ON event FOR EACH ROW EXECUTE FUNCTION bugdeloi_event_notify();
