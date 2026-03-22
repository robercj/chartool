-- ── 017_sprite_image_rpcs.sql ────────────────────────────────────────────────
-- Replaces the client-side read-modify-write pattern for the sprite_images
-- JSONB array on the characters table with atomic Postgres functions.
--
-- Problem: two simultaneous job completions for the same character both read
-- the array, both append their entry, and both write back — one overwrites
-- the other. The result is a missing sprite image in the DB.
--
-- Fix: UPDATE ... SET sprite_images = sprite_images || new_entry runs entirely
-- inside Postgres and is serialised by the row lock.
--
-- SECURITY INVOKER (default) runs as the calling user. RLS on the characters
-- table (migration 008) grants users UPDATE on their own rows, so the function
-- call is already scoped correctly.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION append_sprite_image(p_id UUID, p_entry JSONB)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  UPDATE public.characters
  SET sprite_images = COALESCE(sprite_images, '[]'::jsonb) || jsonb_build_array(p_entry)
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION delete_sprite_image(p_id UUID, p_url TEXT)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  UPDATE public.characters
  SET sprite_images = COALESCE(
    (SELECT jsonb_agg(elem)
     FROM jsonb_array_elements(sprite_images) AS elem
     WHERE elem->>'url' != p_url),
    '[]'::jsonb
  )
  WHERE id = p_id;
END;
$$;
