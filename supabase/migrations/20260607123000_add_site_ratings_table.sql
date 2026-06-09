-- Create the public anonymous site ratings table
create table if not exists public.site_ratings (
  id uuid not null default gen_random_uuid() primary key,
  rating int not null check (rating between 1 and 5),
  created_at timestamp with time zone not null default now()
);

alter table public.site_ratings enable row level security;

create policy "Allow anonymous insert for site ratings"
  on public.site_ratings
  for insert
  with check (true);

grant insert on public.site_ratings to anon;
