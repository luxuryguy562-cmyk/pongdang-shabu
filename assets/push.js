// ─── 새 기능: 푸시 알림 (2026-06-29) ───
// 흐름: 사장님이 설정에서 "알림 켜기" → 권한 요청 → 구독 → push_subscriptions DB 저장.
// 발송은 Supabase 서버 함수(send-push)가 담당. 여기는 "구독 등록·해제" 프론트 전담.
// VAPID 공개키는 프론트 노출 OK (비밀키는 서버 함수에만).

const PUSH_VAPID_PUBLIC = 'BPdp5uU-72jbwLXFPwKJzlOcW1GIMc7xvPcbq6bDn2d_XyJV7zwoRAkvyicR7YtjMdbcymXJwkVd3GL1RCR-S40';

// base64url 문자열 → Uint8Array (구독 applicationServerKey 형식 변환)
function _pushUrlB64ToUint8(base64){
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for(let i=0; i<raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// 이 기기/브라우저가 푸시를 지원하는지
function pushSupported(){
  return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
}

// 현재 구독 상태: 'unsupported' | 'denied' | 'on' | 'off'
// 'on' = 이 기기로 "현재 매장"이 구독돼 있음 (한 폰 여러 매장 — 매장별 판정)
async function getPushStatus(){
  if(!pushSupported()) return 'unsupported';
  if(Notification.permission === 'denied') return 'denied';
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(!sub) return 'off';
    if(typeof currentStore === 'undefined' || !currentStore) return 'off';
    // 이 기기(endpoint)로 현재 매장이 구독됐는지 DB 확인
    const { data } = await sb.from('push_subscriptions').select('id')
      .eq('endpoint', sub.endpoint).eq('store_id', currentStore.id).eq('enabled', true).maybeSingle();
    return data ? 'on' : 'off';
  }catch(_){ return 'off'; }
}

// 알림 켜기 (성공 시 true)
async function enablePushNotifications(){
  if(!pushSupported()){
    alert('이 기기/브라우저는 알림을 지원하지 않습니다.\n\n아이폰은 Safari에서 "홈 화면에 추가" 후 그 앱으로 열면 알림이 가능합니다 (iOS 16.4 이상).');
    return false;
  }
  if(typeof guardStore === 'function' && !guardStore()) return false;
  try{
    // 1) 권한 요청
    const perm = await Notification.requestPermission();
    if(perm !== 'granted'){ alert('알림 권한이 허용되지 않았습니다.'); return false; }
    // 2) 서비스 워커 준비
    const reg = await navigator.serviceWorker.ready;
    // 3) 구독 (이미 있으면 재사용)
    let sub = await reg.pushManager.getSubscription();
    if(!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _pushUrlB64ToUint8(PUSH_VAPID_PUBLIC),
      });
    }
    // 4) DB 저장 (endpoint 기준 upsert — 같은 기기 중복 방지)
    const j = sub.toJSON();
    const { error } = await sb.from('push_subscriptions').upsert({
      store_id: currentStore.id,
      employee_id: (typeof currentEmp !== 'undefined' && currentEmp && currentEmp.id) ? currentEmp.id : null,
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
      user_agent: (navigator.userAgent || '').slice(0, 250),
      enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint,store_id' });
    if(error){ console.error('[push] 저장 실패', error); alert('알림 등록에 실패했습니다.'); return false; }
    return true;
  }catch(e){
    console.error('[push] 켜기 오류', e);
    alert('알림 설정 중 오류가 발생했습니다.');
    return false;
  }
}

// 알림 끄기 (현재 매장만 — 한 폰 여러 매장)
async function disablePushNotifications(){
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(sub && typeof currentStore !== 'undefined' && currentStore){
      // 1) 현재 매장 구독만 끔 (다른 매장 구독은 유지)
      try{ await sb.from('push_subscriptions').update({ enabled:false, updated_at:new Date().toISOString() })
        .eq('endpoint', sub.endpoint).eq('store_id', currentStore.id); }catch(_){}
      // 2) 이 기기에 살아있는 다른 매장 구독이 없을 때만 브라우저 구독 자체 해제
      try{
        const { data:others } = await sb.from('push_subscriptions').select('id')
          .eq('endpoint', sub.endpoint).eq('enabled', true).limit(1);
        if(!others || !others.length){ await sub.unsubscribe(); }
      }catch(_){}
    }
    return true;
  }catch(e){ console.error('[push] 끄기 오류', e); return false; }
}

// 이 폰의 모든 매장 구독 완전 해제 (로그아웃 / 개인모드 전환용) — 2026-07-01
// 폰이 매장을 떠나면 옛 매장 알림이 계속 오던 문제. 브라우저 구독을 해제하면
// 이 폰 endpoint가 무효화 → 이후 어느 매장도 이 폰에 발송 안 됨.
// (개인모드는 store_id가 없어 DB update가 RLS로 막힐 수 있으므로, 브라우저 unsubscribe로 확실히 끊음)
async function unsubscribeThisDevice(){
  try{
    if(!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(sub){
      try{ await sb.from('push_subscriptions').update({ enabled:false, updated_at:new Date().toISOString() }).eq('endpoint', sub.endpoint); }catch(_){}
      try{ await sub.unsubscribe(); }catch(_){}
    }
  }catch(e){ console.error('[push] 기기 구독 해제 오류', e); }
}

// 서비스 워커 자동 등록 (푸시 수신 준비) — 앱 로드 시 1회
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('[push] SW 등록 실패', e));
  });
}
