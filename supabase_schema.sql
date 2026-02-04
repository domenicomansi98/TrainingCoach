-- Run this in Supabase SQL editor

create table if not exists plans (
  id uuid primary key,
  user_id uuid references auth.users not null,
  name text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  start_date date,
  end_date date,
  current_week int not null default 1,
  warmup jsonb not null default '[]'
);

alter table plans add column if not exists start_date date;
alter table plans add column if not exists end_date date;

create table if not exists sessions (
  id uuid primary key,
  user_id uuid references auth.users not null,
  plan_id uuid references plans not null,
  name text not null,
  order_index int not null,
  updated_at timestamptz not null
);

create table if not exists exercises (
  id uuid primary key,
  user_id uuid references auth.users not null,
  session_id uuid references sessions not null,
  name text not null,
  order_index int not null,
  week1 text,
  week2 text,
  week3 text,
  week4 text,
  planned_sets int not null default 1,
  rest_seconds int not null default 90,
  movement text not null default 'other',
  updated_at timestamptz not null
);

create table if not exists workouts (
  id uuid primary key,
  user_id uuid references auth.users not null,
  plan_id uuid references plans not null,
  session_id uuid references sessions not null,
  date timestamptz not null,
  status text not null,
  completed_at timestamptz,
  updated_at timestamptz not null
);

create table if not exists planned_workouts (
  id uuid primary key,
  user_id uuid references auth.users not null,
  plan_id uuid references plans not null,
  session_id uuid references sessions not null,
  date timestamptz not null,
  status text not null,
  workout_id uuid,
  updated_at timestamptz not null
);

create table if not exists exercise_logs (
  id uuid primary key,
  user_id uuid references auth.users not null,
  workout_id uuid references workouts not null,
  exercise_id uuid references exercises not null,
  weight numeric,
  reps int,
  exertion numeric,
  comment text,
  completed_sets int not null default 0,
  updated_at timestamptz not null
);

alter table plans enable row level security;
alter table sessions enable row level security;
alter table exercises enable row level security;
alter table workouts enable row level security;
alter table planned_workouts enable row level security;
alter table exercise_logs enable row level security;

create policy "Plans are private" on plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Sessions are private" on sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Exercises are private" on exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Workouts are private" on workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Planned workouts are private" on planned_workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Exercise logs are private" on exercise_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
