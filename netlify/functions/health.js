exports.handler = async function() {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ok', version: '3.3', platform: 'netlify' })
  };
};
