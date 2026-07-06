-- 바로가기 링크 테이블 (모든 그룹/링크를 DB로 관리)
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. 테이블 생성 (신규 설치)
CREATE TABLE IF NOT EXISTS public.quick_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_name TEXT,                 -- 그룹명 (비우면 사이드바에 '단독' 버튼으로 표시)
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1-1. 기존 설치 대상 컬럼 추가 (이미 quick_links 가 있는 경우)
ALTER TABLE public.quick_links ADD COLUMN IF NOT EXISTS group_name TEXT;

-- 2. RLS 설정
ALTER TABLE public.quick_links ENABLE ROW LEVEL SECURITY;

-- 3. 정책 (인증 없이 모두 접근 가능)
CREATE POLICY "Enable read access for all users" ON public.quick_links FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.quick_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.quick_links FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.quick_links FOR DELETE USING (true);

-- 4. 초기 데이터 (신규 설치용 — 표시 순서: Redmine → Jenkins → GoogleDrive → ClipShare → 기타)
--    Redmine '일감' 번호 입력 프롬프트는 코드(specialItems)에서 유지되므로 여기에 넣지 않습니다.
INSERT INTO public.quick_links (group_name, name, path, display_order) VALUES
    ('Redmine',     '초기화면', 'https://buly.kr/FsJakS2', 0),
    ('Jenkins',     '개발',     'http://123.2.134.38:9090/job/DEV/view/SYSCORE/', 1),
    ('Jenkins',     '검수',     'http://svctech.daou.co.kr:9090/job/STAGE/view/SYSCORE/', 2),
    ('GoogleDrive', '시코팀',   'https://drive.google.com/drive/u/1/folders/0AMJi1znV6czKUk9PVA', 3),
    (NULL,          'ClipShare','https://clipshare.bizppurio.com:9875/', 4)
ON CONFLICT DO NOTHING;
