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
      // libraries=services: 첫 화면의 장소 검색(kakao.maps.services.Places)
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`;
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

export interface PlaceResult {
  id: string;
  name: string;
  category: string;
  // 도로명 주소가 없으면 지번 주소
  address: string;
  latitude: number;
  longitude: number;
}

// 카카오 장소 검색 (지역·지하철역·학교 등 키워드). 결과가 없으면 빈 배열, 검색 자체가 실패하면 reject.
// 클라이언트에서 카카오맵 JS SDK를 직접 부르는 건 허용된 범위다(README "카카오맵 JS SDK").
export async function searchPlaces(appKey: string, keyword: string, size = 10): Promise<PlaceResult[]> {
  await loadKakaoMaps(appKey);
  return new Promise((resolve, reject) => {
    new kakao.maps.services.Places().keywordSearch(
      keyword,
      (result, status) => {
        if (status === 'ZERO_RESULT') resolve([]);
        else if (status !== 'OK') reject(new Error('장소 검색 실패'));
        else
          resolve(
            result.map((item) => ({
              id: item.id,
              name: item.place_name,
              category: item.category_group_name,
              address: item.road_address_name || item.address_name,
              latitude: Number(item.y),
              longitude: Number(item.x),
            })),
          );
      },
      { size },
    );
  });
}
