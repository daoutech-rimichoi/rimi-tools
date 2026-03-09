-- 비밀번호 모음집 테이블 생성 SQL
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. 그룹 테이블 생성
CREATE TABLE IF NOT EXISTS public.password_vault_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    display_order INTEGER DEFAULT 0
);

-- 2. 항목 테이블 생성
CREATE TABLE IF NOT EXISTS public.password_vault (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.password_vault_groups(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    display_order INTEGER DEFAULT 0
);

-- 3. RLS 설정
ALTER TABLE public.password_vault_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_vault ENABLE ROW LEVEL SECURITY;

-- 4. 그룹 테이블 정책
CREATE POLICY "Enable read access for all users" ON public.password_vault_groups FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.password_vault_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.password_vault_groups FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.password_vault_groups FOR DELETE USING (true);

-- 5. 항목 테이블 정책
CREATE POLICY "Enable read access for all users" ON public.password_vault FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.password_vault FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.password_vault FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.password_vault FOR DELETE USING (true);
