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

CREATE TABLE IF NOT EXISTS card_payment_attempts (
    id BIGSERIAL PRIMARY KEY,
    payment_reference TEXT UNIQUE,
    fingerprint_hash TEXT NOT NULL,
    card_bin TEXT,
    card_type TEXT,
    last_four TEXT,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'CREATED',
    gateway_status TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

CREATE TABLE IF NOT EXISTS chargebacks (
    id BIGSERIAL PRIMARY KEY,

    case_id TEXT UNIQUE NOT NULL,

    status TEXT,
    network TEXT,

    card_bin TEXT,
    last_four TEXT,

    reason_code TEXT,
    dispute_condition TEXT,

    transaction_date DATE,

    merchant_transaction_reference TEXT,

    merchant_name TEXT,

    currency TEXT,
    amount NUMERIC(12,2),

    matched_payment_reference TEXT,

    card_country TEXT,
    affiliate_source TEXT,
    plan TEXT,
    card_type TEXT,
    email TEXT,

    imported_at TIMESTAMP DEFAULT NOW()
  );

CREATE TABLE IF NOT EXISTS xolvis_refunds (
    id BIGSERIAL PRIMARY KEY,
    payment_reference TEXT NOT NULL UNIQUE
      REFERENCES xolvis_payments(reference),
    refund_reference TEXT NOT NULL UNIQUE,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'GBP',
    status TEXT NOT NULL DEFAULT 'SUBMITTING',
    refund_uuid TEXT,
    gateway_response JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
