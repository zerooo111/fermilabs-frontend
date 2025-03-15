import axios from 'axios';

const baseUrl = 'http://54.80.177.213:8082';

export async function submitOrderToSequencer(body: any) {
  const response = await axios.post(`${baseUrl}/place_order`, body);
  return response.data;
}

export async function fetchOrderbook() {
  const response = await axios.get(`${baseUrl}/orderbook`);
  return response.data.data;
}

export async function submitCancelOrderToSequencer(body: any) {
  const response = await axios.post(`${baseUrl}/cancel_order`, body);
  return response.data;
}
