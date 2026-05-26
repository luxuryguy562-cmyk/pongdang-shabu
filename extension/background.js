// background.js — 알람으로 하루 1번 자동 동기화 (사장님이 쿠팡 페이지 열어둔 동안)

chrome.runtime.onInstalled.addListener(() => {
  // 하루 1번 알람 (사장님이 쿠팡 페이지 열어둔 동안에만 작동)
  chrome.alarms.create('dailySync', { periodInMinutes: 24 * 60 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'dailySync') return;
  const tabs = await chrome.tabs.query({ url: ['https://mc.coupang.com/ssr/desktop/order/list*', 'https://www.coupang.com/np/mypage/orderlist*'] });
  if (tabs.length === 0) return; // 쿠팡 페이지 안 열려있으면 패스
  // content script 가 이미 자동 실행됨 (run_at: document_idle)
});
