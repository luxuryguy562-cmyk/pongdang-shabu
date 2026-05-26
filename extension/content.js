// content.js — 쿠팡 주문내역 페이지에서 JSON API 호출 후 Workers로 전송
// run_at: document_idle (페이지 로드 후 자동 실행)

(async () => {
  const { workersUrl, secret, storeId, autoSync } = await chrome.storage.sync.get(['workersUrl', 'secret', 'storeId', 'autoSync']);
  if (!workersUrl || !secret || !storeId) {
    console.log('[퐁당샤브] 설정 미완료 — 확장 아이콘 클릭해서 셋업하세요');
    return;
  }
  if (autoSync === false) {
    console.log('[퐁당샤브] 자동 동기화 OFF — 확장 아이콘에서 수동 [지금 동기화] 가능');
    return;
  }
  await syncOrders({ workersUrl, secret, storeId });
})();

// 외부 (background, popup) 에서 수동 호출용
chrome.runtime?.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'syncNow') {
    syncOrders(msg.config).then(sendResponse);
    return true;
  }
});

async function syncOrders({ workersUrl, secret, storeId }) {
  try {
    console.log('[퐁당샤브] 쿠팡 주문 가져오는 중...');
    // 쿠팡 JSON API — 검증 v2에서 캡처한 URL
    const r = await fetch('/ssr/api/myorders/model/page?requestYear=0&pageIndex=1&size=50', {
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'include',
    });
    if (!r.ok) {
      console.error('[퐁당샤브] 쿠팡 API 실패', r.status);
      await chrome.storage.local.set({ lastError: `쿠팡 API ${r.status}`, lastSync: Date.now() });
      return { ok: false, error: `쿠팡 API ${r.status}` };
    }
    const json = await r.json();
    const orders = extractOrders(json);
    console.log(`[퐁당샤브] 쿠팡에서 ${orders.length}건 추출`);

    // Workers 로 전송
    const post = await fetch(`${workersUrl}/coupang/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'X-Store-Id': storeId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orders }),
    });
    const result = await post.json();
    console.log('[퐁당샤브] Workers 응답', result);
    await chrome.storage.local.set({
      lastSync: Date.now(),
      lastResult: result,
      lastError: null,
    });
    return { ok: true, result };
  } catch (e) {
    console.error('[퐁당샤브] 동기화 실패', e);
    await chrome.storage.local.set({ lastError: e.message, lastSync: Date.now() });
    return { ok: false, error: e.message };
  }
}

// 쿠팡 JSON 응답에서 주문 항목 평탄화
function extractOrders(json) {
  const orders = [];
  // 쿠팡 응답 구조: { data: { orderList: [{ orderId, orderedAt, vendorItems: [...] }] } } 가정
  // 실제 구조는 첫 호출 후 갱신될 수 있음 (디버깅용 raw 같이 전송)
  const list = json?.data?.orderList || json?.orderList || json?.orders || [];
  for (const o of list) {
    const orderId = String(o.orderId || o.id || '');
    const orderDate = (o.orderedAt || o.orderDate || '').slice(0, 10);
    const items = o.vendorItems || o.items || o.products || [o];
    for (const it of items) {
      const item = (it.productName || it.itemName || it.name || it.title || '').trim();
      const amount = Number(it.salePrice || it.price || it.totalPrice || it.amount || 0);
      const quantity = Number(it.quantity || it.count || 1);
      if (!item || !amount) continue;
      orders.push({
        external_order_id: orderId,
        order_date: orderDate,
        item,
        amount,
        quantity,
        unit_price: quantity > 0 ? Math.round(amount / quantity) : null,
        raw: { orderId, item, orig: it },
      });
    }
  }
  return orders;
}
