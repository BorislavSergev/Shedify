import { createClient } from "@supabase/supabase-js";

const supabase = createClient("https://whezhucleldvktilymbg.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoZXpodWNsZWxkdmt0aWx5bWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5OTM1MTgsImV4cCI6MjA1MDU2OTUxOH0.WUYsC_7IsJB8n13xS7t8LsyM3d__iWtGinEXgezD300");

export default supabase;