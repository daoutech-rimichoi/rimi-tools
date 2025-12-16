-- 서버 현황판 통합 테이블 생성 SQL
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. 통합 테이블 생성
CREATE TABLE IF NOT EXISTS public.server_status (
    id SERIAL PRIMARY KEY,
    env_type TEXT NOT NULL, -- 'dev' 또는 'stg'
    service_name TEXT NOT NULL,
    environment_name TEXT NOT NULL,
    url TEXT NOT NULL DEFAULT '',
    in_use BOOLEAN DEFAULT false,
    assigned_to TEXT DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(env_type, service_name, environment_name)
);

-- 2. Row Level Security (RLS) 설정 - 인증 없이 모두 접근 가능
ALTER TABLE public.server_status ENABLE ROW LEVEL SECURITY;

-- 3. 모든 사용자가 읽기/쓰기 가능하도록 정책 설정
CREATE POLICY "Enable read access for all users" ON public.server_status
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.server_status
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON public.server_status
    FOR UPDATE USING (true);

-- 4. 실시간 기능 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.server_status;

-- 5. 초기 데이터 삽입 (개발 + 검수 통합)
INSERT INTO public.server_status (env_type, service_name, environment_name, url, in_use, assigned_to) VALUES
    -- 개발장비 (dev)
    ('dev', '비즈뿌리오 웹', 'test0', 'https://dev.bizppurio.com:14119/', false, ''),
    ('dev', '비즈뿌리오 웹', 'test1', 'https://dev-test1.bizppurio.com:14119/', false, ''),
    ('dev', '비즈뿌리오 웹', 'test2', 'https://dev-test2.bizppurio.com:14119/', false, ''),
    ('dev', '비즈뿌리오 배치', 'test0', '', false, ''),
    ('dev', '비즈뿌리오 배치', 'test1', '', false, ''),
    ('dev', '비즈뿌리오 배치', 'test2', '', false, ''),
    ('dev', 'KAPI', 'test', '', false, ''),
    ('dev', '영업관리시스템', 'test0', 'https://dev-bizsales.ppurio.com:14110/login.do', false, ''),
    ('dev', '영업관리시스템', 'test1', 'https://dev-bizsales-test1.ppurio.com:14110/login.do', false, ''),
    ('dev', '유핏', 'test', 'https://dev.ufit.co.kr:6261/', false, ''),
    -- 검수장비 (stg)
    ('stg', '비즈뿌리오 웹', 'stg', 'https://stg.bizppurio.com:14119/', false, ''),
    ('stg', '비즈뿌리오 배치', 'stg', '', false, ''),
    ('stg', 'KAPI', 'stg', '', false, ''),
    ('stg', '영업관리시스템', 'stg', 'https://stg-bizsales.ppurio.com:14110/login.do', false, ''),
    ('stg', '유핏', 'stg', 'https://stg.ufit.co.kr:6261/', false, '')
ON CONFLICT (env_type, service_name, environment_name) DO NOTHING;

