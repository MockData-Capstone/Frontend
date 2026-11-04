let sdk: Promise<void> | null = null;

// SDK 스크립트는 한 번만 붙인다. autoload=false로 받은 뒤 kakao.maps.load로 초기화를 끝낸다.
export function loadKakaoMaps(appKey: string): Promise<void> {
  if (!sdk) {
    sdk = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      // 실패하면 다음 마운트에서 다시 시도할 수 있게 비운다.
      const fail = (message: string) => {
        sdk = null;
        script.remove();
        reject(new Error(message));
      };
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
      script.async = true;
      script.onload = () => {
        if (window.kakao?.maps) window.kakao.maps.load(() => resolve());
        else fail('카카오맵 SDK 초기화 실패');
      };
      script.onerror = () => fail('카카오맵 SDK 로드 실패');
      document.head.appendChild(script);
    });
  }
  return sdk;
}
