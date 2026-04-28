/* F42 — Supabase client initialisation */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://jfzaumgrzdezanmopanb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmemF1bWdyemRlemFubW9wYW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjcxNjMsImV4cCI6MjA5Mjk0MzE2M30.THB-LeqB8K6CcICVDNH0uUFqmNR3s-A6EPewo8X1ut8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
