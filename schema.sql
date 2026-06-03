-- Run this in the Supabase SQL editor to set up the database

create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  fodmap_status text not null default 'unknown',
  quantity text,
  updated_at timestamptz not null default now()
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  ingredients jsonb,
  instructions text,
  source_url text,
  fodmap_notes text,
  is_saved boolean not null default false,
  created_at timestamptz not null default now()
);

create table meal_plan (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  plan_date date not null,
  meal_type text not null,
  recipe_id uuid references recipes(id) on delete set null,
  recipe_title text,
  notes text,
  unique (user_id, plan_date, meal_type)
);

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  quantity text,
  is_checked boolean not null default false,
  source_recipe_id uuid,
  created_at timestamptz not null default now()
);
