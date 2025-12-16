-- Supabase 테이블 생성 SQL
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS public.deployment_form_data (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Row Level Security (RLS) 설정 - 인증 없이 모두 접근 가능
ALTER TABLE public.deployment_form_data ENABLE ROW LEVEL SECURITY;

-- 3. 모든 사용자가 읽기/쓰기 가능하도록 정책 설정
CREATE POLICY "Enable read access for all users" ON public.deployment_form_data
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.deployment_form_data
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON public.deployment_form_data
    FOR UPDATE USING (true);

-- 4. 실시간 기능 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.deployment_form_data;

-- 5. 초기 데이터 삽입 (선택사항)
INSERT INTO public.deployment_form_data (key, value) VALUES
    ('deployment_approved', ''),
    ('deployment_pending', ''),
    ('deployment_redmine', ''),
    ('deployment_scenario', '')
ON CONFLICT (key) DO NOTHING;
