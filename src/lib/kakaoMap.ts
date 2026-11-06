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
  // "지역", "지하철역", "학교" 또는 카카오 카테고리 이름 (없으면 빈 문자열)
  category: string;
  // 도로명 주소가 없으면 지번 주소. 지역은 시·구·동 전체 이름
  address: string;
  latitude: number;
  longitude: number;
}

// 첫 화면 검색창은 "지역, 지하철역, 학교 검색"이라 이 카테고리를 먼저 보여준다.
const PREFERRED_CATEGORIES: Record<string, string> = { SW8: '지하철역', SC4: '학교' };

function keywordSearch(keyword: string): Promise<kakao.maps.services.PlacesSearchResultItem[]> {
  return new Promise((resolve, reject) => {
    new kakao.maps.services.Places().keywordSearch(
      keyword,
      (result, status) => {
        if (status === 'ZERO_RESULT') resolve([]);
        else if (status !== 'OK') reject(new Error('장소 검색 실패'));
        else resolve(result);
      },
      { size: 15 },
    );
  });
}

// 지역(행정구역) 이름만 맞은 결과. "신당동"처럼 동 이름으로 찾을 때 쓴다.
function regionSearch(keyword: string): Promise<kakao.maps.services.AddressSearchResultItem[]> {
  return new Promise((resolve, reject) => {
    new kakao.maps.services.Geocoder().addressSearch(keyword, (result, status) => {
      if (status === 'ZERO_RESULT') resolve([]);
      else if (status !== 'OK') reject(new Error('지역 검색 실패'));
      else resolve(result.filter((item) => item.address_type === 'REGION'));
    });
  });
}

// 카카오 지역·장소 검색. 지역 → 지하철역·학교 순으로 보여주고, 그런 결과가 하나도 없을 때만(공원·건물 이름 등)
// 일반 장소 결과를 그대로 보여준다. 결과가 없으면 빈 배열, 두 검색이 모두 실패하면 reject.
// 클라이언트에서 카카오맵 JS SDK를 직접 부르는 건 허용된 범위다(README "카카오맵 JS SDK").
export async function searchPlaces(appKey: string, keyword: string, size = 10): Promise<PlaceResult[]> {
  await loadKakaoMaps(appKey);
  const [regionsResult, placesResult] = await Promise.allSettled([regionSearch(keyword), keywordSearch(keyword)]);
  if (regionsResult.status === 'rejected' && placesResult.status === 'rejected') throw placesResult.reason;
  const regions = regionsResult.status === 'fulfilled' ? regionsResult.value : [];
  const places = placesResult.status === 'fulfilled' ? placesResult.value : [];

  const preferred = places.filter((item) => item.category_group_code in PREFERRED_CATEGORIES);
  const shownPlaces = regions.length + preferred.length > 0 ? preferred : places;
  return [
    ...regions.map((item) => ({
      id: `region:${item.address_name}`,
      name: item.address_name.split(' ').at(-1) ?? item.address_name,
      category: '지역',
      address: item.address_name,
      latitude: Number(item.y),
      longitude: Number(item.x),
    })),
    ...shownPlaces.map((item) => ({
      id: item.id,
      name: item.place_name,
      category: PREFERRED_CATEGORIES[item.category_group_code] ?? item.category_group_name,
      address: item.road_address_name || item.address_name,
      latitude: Number(item.y),
      longitude: Number(item.x),
    })),
  ].slice(0, size);
}
