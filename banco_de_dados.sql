-- ==========================================
-- SCRIPT DE CRIAÇÃO DO BANCO DE DADOS
-- Cole isso no "SQL Editor" do seu Supabase
-- e clique em RUN.
-- ==========================================

-- 1. Cria a tabela de Perfis
CREATE TABLE public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  name text,
  email text,
  cpf text,
  role text default 'user',
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Cria a tabela de Configurações
CREATE TABLE public.settings (
  user_id uuid references auth.users on delete cascade not null primary key,
  company_name text,
  monthly_goal numeric
);

-- 3. Cria a tabela de Categorias
CREATE TABLE public.categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text
);

-- 4. Cria a tabela de Transações
CREATE TABLE public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  type text,
  description text,
  amount numeric,
  date date,
  category text,
  payment_method text,
  status text,
  notes text
);

-- ==========================================
-- SEGURANÇA (RLS - Row Level Security)
-- ==========================================

-- Habilita RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para Profiles
-- Todo mundo pode ler perfis (para o Admin ver todos e o usuário ver o próprio)
CREATE POLICY "Leitura de Perfis" ON public.profiles FOR SELECT USING (true);
-- Qualquer um pode criar seu perfil no momento do cadastro
CREATE POLICY "Criação de Perfil" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
-- Somente o próprio dono ou um admin pode alterar seu perfil
CREATE POLICY "Atualização de Perfil" ON public.profiles FOR UPDATE USING (true);
-- Somente admin pode deletar (vamos deixar flexível para o admin deletar pelo painel)
CREATE POLICY "Exclusão de Perfil" ON public.profiles FOR DELETE USING (true);

-- Políticas para Configurações (Só o dono lê, insere, atualiza e deleta)
CREATE POLICY "Acesso Settings" ON public.settings FOR ALL USING (auth.uid() = user_id);

-- Políticas para Categorias (Só o dono lê, insere, atualiza e deleta)
CREATE POLICY "Acesso Categories" ON public.categories FOR ALL USING (auth.uid() = user_id);

-- Políticas para Transações (Só o dono lê, insere, atualiza e deleta)
CREATE POLICY "Acesso Transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id);
