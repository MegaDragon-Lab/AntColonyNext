# Ant Colony — Setup Guide

## 1. Supabase — Crear la base de datos

1. Ve a [supabase.com](https://supabase.com) y crea un proyecto
2. En el menú lateral ve a **SQL Editor**
3. Pega y ejecuta esta query:

```sql
create table scores (
  id         bigint generated always as identity primary key,
  name       text        not null,
  score      integer     not null,
  created_at timestamptz default now()
);

create index scores_score_idx on scores (score desc);

alter table scores enable row level security;

create policy "read scores" on scores
  for select using (true);

create policy "insert scores" on scores
  for insert with check (true);
```

4. Ve a **Settings → API** y copia:
   - `Project URL` → es tu `SUPABASE_URL`
   - `anon public key` → es tu `SUPABASE_KEY`

---

## 2. Variables de entorno

### Local (desarrollo)
Edita el archivo `.env.local` en la raíz del proyecto:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=tu-anon-key
```

### Vercel (producción)
1. Ve a tu proyecto en [vercel.com](https://vercel.com)
2. **Settings → Environment Variables**
3. Agrega:
   - `SUPABASE_URL` → tu Project URL
   - `SUPABASE_KEY` → tu anon key
4. Redeploy

---

## 3. Correr en local

```zsh
cd "Ant Colony Next"
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## 4. Subir a GitHub

Primera vez:
```zsh
cd "Ant Colony Next"
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/MegaDragon-Lab/AntColony.git
git branch -M main
git push -u origin main
```

Siguientes veces:
```zsh
git add .
git commit -m "descripcion del cambio"
git push
```

---

## 5. Deploy en Vercel

1. Ve a [vercel.com/new](https://vercel.com/new)
2. Importa el repo `AntColony` de GitHub
3. En la configuración:
   - **Framework**: Next.js (se detecta solo)
   - **Root Directory**: `Ant Colony Next`
4. Agrega las variables de entorno (paso 2)
5. Click en **Deploy**

Cada `git push` a `main` despliega automáticamente.
