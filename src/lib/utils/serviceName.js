// 저장소(repo) 이름 → 한글 서비스명 매핑
// 매칭 기준은 redmine/deployment-request-form 페이지의 프로세스 목록과 동일하게 유지한다.
export const repoServiceNameMap = {
    // 영업관리시스템
    'sales-integration-web': '영업관리시스템 웹',
    'sales-integration-commons': '영업관리시스템 공통',
    'sales-integration-batch': '영업관리시스템 배치',
    'sales-integration-monitor': '영업관리시스템 모니터링',
    'sales-integration-api': '영업관리시스템 API',
    // 비즈뿌리오
    'bizweb': '비즈뿌리오 웹',
    'bizBatchApi': '비즈뿌리오 발송 배치',
    'kapi': 'KAPI',
    'napi': 'NAPI',
    'rapi': 'RAPI',
    'web-fax-daemon': '팩스 발송 데몬',
    'web-fax-forward-daemon': '팩스 포워드 데몬',
    'ivr': '080수신거부시나리오',
    // JavaASP
    'asp': 'JavaASP 웹',
    'asp-admin': 'JavaASP 중간 관리자 웹',
    'asp-manager': 'JavaASP 최고 관리자 웹',
    'asp-batch': 'JavaASP 배치',
    'asp-service-api': 'JavaASP API',
    'asp-spam': 'JavaASP 스팸',
    'asp-address-daemon': 'JavaASP 주소록 데몬',
    'asp-sms-send-daemon': 'JavaASP SMS 발송 데몬',
    'asp-sms-report-daemon': 'JavaASP SMS 리포트 데몬',
    'asp-mms-send-daemon': 'JavaASP MMS 발송 데몬',
    'asp-mms-report-daemon': 'JavaASP MMS 리포트 데몬',
    'asp-rcs-send-daemon': 'JavaASP RCS 발송 데몬',
    'asp-rcs-report-daemon': 'JavaASP RCS 리포트 데몬',
    'daemon-monitor': 'JavaASP 데몬 모니터링',
    'faxBridge': 'JavaASP 팩스 브릿지',
    // 유핏
    'ufit-web': '유핏 웹',
    'ufit-bill-batch': '유핏 정산 배치',
    // 번호자원관리시스템
    'numball-api': '번호자원관리시스템'
};

// repo 이름을 한글 서비스명으로 변환한다. 매핑이 없으면 원래 repo 이름을 그대로 반환한다.
export function toServiceName(repoName) {
    if (!repoName) return repoName;
    return repoServiceNameMap[repoName] ?? repoName;
}
