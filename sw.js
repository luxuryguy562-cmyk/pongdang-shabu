// 캐쉬플로우 Service Worker — 자살 모드 (2026-05-22)
// 사장님 호소: "바텀시트 나오기 전 모양" — 옛 SW가 수개월 옛 index.html 캐시 잡고 있음
// 이 SW는 옛 SW를 대체한 후 자기 자신 + 모든 캐시 즉시 삭제

self.addEventListener('install', (event) => {
  // 옛 SW 즉시 교체
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1. 모든 캐시 삭제
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (_) {}
    // 2. 자기 자신 unregister
    try {
      await self.registration.unregister();
    } catch (_) {}
    // 3. 모든 클라이언트 강제 새로고침
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(c => {
        try { c.navigate(c.url); } catch (_) {}
      });
    } catch (_) {}
  })());
});

// fetch는 가로채지 않음 — 네트워크로 직행 (SW 없는 상태와 동일)
