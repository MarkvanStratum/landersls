CREATE TABLE IF NOT EXISTS promo_checkout_links (
 id SERIAL PRIMARY KEY,token TEXT UNIQUE NOT NULL,step2_file TEXT NOT NULL,plan TEXT NOT NULL,
 first_name TEXT,last_name TEXT,full_name TEXT,email TEXT NOT NULL,phone TEXT,address TEXT,postcode TEXT,city TEXT,country TEXT,
 affiliate_ref TEXT,source_page TEXT,original_query_string TEXT,success_url TEXT,user_id INTEGER,ip TEXT,user_agent TEXT,
 expires_at TIMESTAMP NOT NULL,used_at TIMESTAMP,created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS xolvis_payments (
 id SERIAL PRIMARY KEY,reference TEXT UNIQUE NOT NULL,email TEXT NOT NULL,plan TEXT NOT NULL,amount NUMERIC(10,2) NOT NULL,
 status TEXT DEFAULT 'created',xolvis_uuid TEXT,xolvis_payload JSONB,created_at TIMESTAMP DEFAULT NOW(),paid_at TIMESTAMP,
 user_id INTEGER,binom_clickid TEXT,binom_postback_sent BOOLEAN DEFAULT FALSE,affiliate_source TEXT,sub_id TEXT,
 traffic_source TEXT,card_bin TEXT,card_type TEXT,last_four TEXT
);

ALTER TABLE xolvis_payments ADD COLUMN IF NOT EXISTS final_redirect_url TEXT;
CREATE TABLE IF NOT EXISTS promo_funnel_events (
 id BIGSERIAL PRIMARY KEY, flow_id TEXT NOT NULL,event_name TEXT NOT NULL,page_url TEXT,
 affiliate_ref TEXT,user_agent TEXT,ip TEXT,event_details TEXT,created_at TIMESTAMP DEFAULT NOW(),
 UNIQUE(flow_id,event_name)
);
ALTER TABLE promo_funnel_events ADD COLUMN IF NOT EXISTS event_details TEXT;
CREATE INDEX IF NOT EXISTS idx_promo_funnel_event_name ON promo_funnel_events(event_name);
CREATE INDEX IF NOT EXISTS idx_promo_funnel_created_at ON promo_funnel_events(created_at);
