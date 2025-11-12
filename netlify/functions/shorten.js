const fetch = require('node-fetch');

exports.handler = async (event) => {
  // Netlify는 POST 요청 본문을 문자열로 전달합니다.
  const bodyParams = new URLSearchParams(event.body);
  const orgUrl = bodyParams.get('org_url');

  // buly.kr API가 요구하는 다른 파라미터들도 함께 전달합니다.
  const targetUrl = 'https://www.buly.kr/api/shoturl.siso';
  const customerId = 'berryzed';
  const partnerApiId = '136C8F3B1452BF8CC8536931982FD993';

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        org_url: orgUrl,
        customer_id: customerId,
        partner_api_id: partnerApiId,
      }),
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message }),
    };
  }
};
