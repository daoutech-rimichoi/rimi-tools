-- 바로가기 링크(기타) 테이블 생성 SQL
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS public.quick_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. RLS 설정
ALTER TABLE public.quick_links ENABLE ROW LEVEL SECURITY;

-- 3. 정책 (인증 없이 모두 접근 가능)
CREATE POLICY "Enable read access for all users" ON public.quick_links FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.quick_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.quick_links FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.quick_links FOR DELETE USING (true);

-- 4. 초기 데이터
INSERT INTO public.quick_links (name, path, display_order) VALUES
    ('서비스운영팀', 'http://svctech.daou.co.kr/', 0),
    ('GatewayOperations', 'http://123.2.134.130:10120/', 1)
ON CONFLICT DO NOTHING;
