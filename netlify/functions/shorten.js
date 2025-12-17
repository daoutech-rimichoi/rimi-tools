const fetch = require('node-fetch');

exports.handler = async (event) => {
  // Netlify는 POST 요청 본문을 문자열로 전달합니다.
  const bodyParams = new URLSearchParams(event.body);
  const longUrl = bodyParams.get('url');

  const targetUrl = 'https://api.lrl.kr/v6/short';

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({url: longUrl}),
    });

    const data = await response.json();

    if (!response.ok) {
      // 에러 메시지를 보내면 그대로 전달
      throw new Error(data.message || 'API 요청 실패');
    }

    const responseBody = {
      result_url: data.result
    };

    return {
      statusCode: 200,
      body: JSON.stringify(responseBody),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
