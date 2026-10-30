-- Create rate limit logging table
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Index for efficient rate limit queries
  INDEX idx_rate_limit_created_at ON rate_limit_log(created_at DESC)
);

-- Enable Row Level Security
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate limit logs
CREATE POLICY "Service role only" ON rate_limit_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- Automatically clean up old rate limit logs (older than 1 hour)
-- This keeps the table small and queries fast
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_log
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to clean up old logs every 10 minutes
-- Note: This requires pg_cron extension to be enabled in Supabase
-- You can also run this manually or via a scheduled edge function
