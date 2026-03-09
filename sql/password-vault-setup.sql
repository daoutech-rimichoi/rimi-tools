-- 비밀번호 모음집 테이블 생성 SQL
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS public.password_vault (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    display_order INTEGER DEFAULT 0
);

-- 2. Row Level Security (RLS) 설정
ALTER TABLE public.password_vault ENABLE ROW LEVEL SECURITY;

-- 3. 모든 사용자가 읽기/쓰기/삭제 가능하도록 정책 설정
CREATE POLICY "Enable read access for all users" ON public.password_vault
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.password_vault
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON public.password_vault
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON public.password_vault
    FOR DELETE USING (true);
