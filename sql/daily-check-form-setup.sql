-- 일일점검양식 테이블 생성 SQL
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. 테이블 생성 (check_date 기준으로 하루 한 행 저장)
CREATE TABLE IF NOT EXISTS public.daily_check_form (
    id SERIAL PRIMARY KEY,
    check_date DATE NOT NULL DEFAULT CURRENT_DATE,
    rows JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(check_date)
);

-- 2. Row Level Security (RLS) 설정
ALTER TABLE public.daily_check_form ENABLE ROW LEVEL SECURITY;

-- 3. 모든 사용자 읽기/쓰기/삭제 허용
CREATE POLICY "Enable read access for all users" ON public.daily_check_form
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.daily_check_form
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON public.daily_check_form
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON public.daily_check_form
    FOR DELETE USING (true);

-- 4. 실시간 기능 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_check_form;
