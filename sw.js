// 캐쉬플로우 Service Worker — 푸시 알림 (2026-06-29)
// ⚠️ 캐시는 절대 잡지 않는다 (옛 캐시 문제 재발 방지 — 사장님 "바텀시트 나오기 전 모양" 호소).
// 역할: 푸시 알림 수신·표시 전용. fetch 가로채기 없음 = 네트워크 직행.

self.addEventListener('install', (event) => {
  // 새 SW 즉시 활성화
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 과거 캐시 잔재 제거 (이 SW는 캐시를 만들지 않지만, 옛 SW가 남긴 것 청소)
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (_) {}
    // 현재 열린 페이지들을 이 SW가 즉시 제어 (다음 새로고침 없이 푸시 수신 가능)
    try { await self.clients.claim(); } catch (_) {}
  })());
});

// fetch 가로채지 않음 — 네트워크로 직행 (SW 없는 상태와 동일, 캐시 문제 원천 차단)

// ─── 푸시 수신 → 알림 표시 ───
self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (_) {
    d = { title: '캐쉬플로우', body: event.data ? event.data.text() : '' };
  }
  const title = d.title || '캐쉬플로우';
  const opts = {
    body: d.body || '',
    icon: d.icon || '/icon-192.png',
    badge: '/icon-192.png',
    // tag 없으면 매번 고유값 → 연속 알림이 서로 덮어쓰지 않음 (마감+퇴근 동시 도착 대비)
    tag: d.tag || ('cf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
    renotify: true,
    data: { url: d.url || '/' },
    requireInteraction: !!d.requireInteraction, // true면 사용자가 닫을 때까지 유지
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

// ─── 알림 클릭 → 앱 열기/포커스 ───
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { try { c.focus(); return; } catch (_) {} }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
