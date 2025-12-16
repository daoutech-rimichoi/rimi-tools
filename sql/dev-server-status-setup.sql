-- 개발장비 현황판 테이블 생성 SQL
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS public.dev_server_status (
    server_key TEXT PRIMARY KEY,
    service_name TEXT NOT NULL,
    environment_name TEXT NOT NULL,
    url TEXT NOT NULL,
    in_use BOOLEAN DEFAULT false,
    assigned_to TEXT DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Row Level Security (RLS) 설정 - 인증 없이 모두 접근 가능
ALTER TABLE public.dev_server_status ENABLE ROW LEVEL SECURITY;

-- 3. 모든 사용자가 읽기/쓰기 가능하도록 정책 설정
CREATE POLICY "Enable read access for all users" ON public.dev_server_status
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.dev_server_status
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON public.dev_server_status
    FOR UPDATE USING (true);

-- 4. 실시간 기능 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.dev_server_status;

-- 5. 초기 데이터 삽입
INSERT INTO public.dev_server_status (server_key, service_name, environment_name, url, in_use, assigned_to) VALUES
    ('비즈뿌리오_test0', '비즈뿌리오', 'test0', 'https://dev.bizppurio.com:14119/', false, ''),
    ('비즈뿌리오_test1', '비즈뿌리오', 'test1', 'https://dev-test1.bizppurio.com:14119/', false, ''),
    ('비즈뿌리오_test2', '비즈뿌리오', 'test2', 'https://dev-test2.bizppurio.com:14119/', false, ''),
    ('영업관리시스템_test0', '영업관리시스템', 'test0', 'https://dev-bizsales.ppurio.com:14110/login.do', false, ''),
    ('영업관리시스템_test1', '영업관리시스템', 'test1', 'https://dev-bizsales-test1.ppurio.com:14110/login.do', false, ''),
    ('유핏_test', '유핏', 'test', 'https://dev.ufit.co.kr:6261/', false, '')
ON CONFLICT (server_key) DO NOTHING;
