-- Shared Table Ledger: Full Production Database Schema for PostgreSQL / C++ Drogon Backend
-- University Course Project: Mess Management System
-- Provides full compatibility with UUID and string identifiers, indexes, cascading foreign keys, and constraints

CREATE TABLE IF NOT EXISTS messes (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    owner_id VARCHAR(64) NOT NULL,
    name VARCHAR(80) NOT NULL,
    address VARCHAR(200) NOT NULL DEFAULT '',
    manager VARCHAR(80) NOT NULL DEFAULT '',
    start_day INT NOT NULL DEFAULT 1 CHECK (start_day BETWEEN 1 AND 28),
    currency VARCHAR(20) NOT NULL DEFAULT 'BDT (৳)',
    invite_code CHAR(6) NOT NULL UNIQUE,
    show_invite_to_members BOOLEAN NOT NULL DEFAULT TRUE,
    meal_categories TEXT[] NOT NULL DEFAULT ARRAY['Rice','Vegetables','Fish & meat','Eggs','Cooking oil','Spices','Other food'],
    household_categories TEXT[] NOT NULL DEFAULT ARRAY['Wi-Fi','Electricity','Gas','Water','Cleaning','Other household'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mess_members (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mess_id VARCHAR(64) NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
    user_id VARCHAR(64),
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
    name VARCHAR(80) NOT NULL,
    phone VARCHAR(30) NOT NULL DEFAULT '',
    room VARCHAR(30) NOT NULL DEFAULT '',
    joined DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','new','left')),
    tone VARCHAR(20) NOT NULL DEFAULT 'primary',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS mess_members_one_mess_per_user ON mess_members(user_id) WHERE user_id IS NOT NULL AND status <> 'left';
CREATE INDEX IF NOT EXISTS idx_mess_members_mess_id ON mess_members(mess_id);

CREATE TABLE IF NOT EXISTS mess_meals (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mess_id VARCHAR(64) NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
    member_id VARCHAR(64) NOT NULL REFERENCES mess_members(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    breakfast NUMERIC NOT NULL DEFAULT 0 CHECK (breakfast BETWEEN 0 AND 10),
    lunch NUMERIC NOT NULL DEFAULT 0 CHECK (lunch BETWEEN 0 AND 10),
    dinner NUMERIC NOT NULL DEFAULT 0 CHECK (dinner BETWEEN 0 AND 10),
    UNIQUE (member_id, date)
);
CREATE INDEX IF NOT EXISTS idx_mess_meals_mess_date ON mess_meals(mess_id, date);

CREATE TABLE IF NOT EXISTS mess_expenses (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mess_id VARCHAR(64) NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('meal','household')),
    category VARCHAR(60) NOT NULL,
    description VARCHAR(300) NOT NULL DEFAULT '',
    amount NUMERIC NOT NULL CHECK (amount > 0 AND amount < 10000000),
    member_id VARCHAR(64) REFERENCES mess_members(id) ON DELETE SET NULL,
    method VARCHAR(40) NOT NULL DEFAULT 'Cash',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mess_expenses_mess_date ON mess_expenses(mess_id, date);

CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mess_id VARCHAR(64) NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    member_id VARCHAR(64) NOT NULL REFERENCES mess_members(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0 AND amount < 10000000),
    method VARCHAR(40) NOT NULL DEFAULT 'Cash',
    kind VARCHAR(30) NOT NULL DEFAULT 'Deposit',
    reference VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_mess_date ON payments(mess_id, date);

CREATE TABLE IF NOT EXISTS mess_notifications (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mess_id VARCHAR(64) NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
    sender_id VARCHAR(64) REFERENCES mess_members(id) ON DELETE SET NULL,
    recipient_id VARCHAR(64) REFERENCES mess_members(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    message VARCHAR(1000) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'notice' CHECK (type IN ('notice','reminder','alert','info')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_mess ON mess_notifications(mess_id);

CREATE TABLE IF NOT EXISTS mess_guest_sessions (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    token VARCHAR(128) NOT NULL UNIQUE,
    mess_id VARCHAR(64) NOT NULL REFERENCES messes(id) ON DELETE CASCADE,
    member_id VARCHAR(64) REFERENCES mess_members(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'guest' CHECK (role IN ('guest','member')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_token ON mess_guest_sessions(token);

CREATE TABLE IF NOT EXISTS mess_users (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(80) NOT NULL,
    mess_id VARCHAR(64) REFERENCES messes(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON mess_users(email);
