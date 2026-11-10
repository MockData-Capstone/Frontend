import { api } from './api';
import type { ConditionView, HouseCondition, SavedCondition, Suggestion } from '../types/search';
export async function getConditions(workspaceId: number): Promise<ConditionView> {
  return (await api.get<ConditionView>(`/api/workspaces/${workspaceId}/condition`)).data;
}
export async function saveConditions(workspaceId: number, condition: HouseCondition, exists: boolean): Promise<SavedCondition> {
  return (await api.request<SavedCondition>({ url: `/api/workspaces/${workspaceId}/condition`, method: exists ? 'PUT' : 'POST', data: condition })).data;
}
export async function getSuggestions(workspaceId: number): Promise<Suggestion[]> {
  return (await api.get<{ items: Suggestion[] }>(`/api/workspaces/${workspaceId}/condition-suggestions`)).data.items;
}
export async function acceptSuggestion(workspaceId: number, type: Suggestion['type']): Promise<Suggestion[]> {
  return (await api.post<{ items: Suggestion[] }>(`/api/workspaces/${workspaceId}/condition-suggestions/${type}/accept`)).data.items;
}
export const emptyCondition: HouseCondition = {
  depositMin: null, depositMax: null, monthlyRentMin: null, monthlyRentMax: null,
  roomType: null, areaMin: null, areaMax: null, avoidSlope: null, needVehicleAccess: null,
};
export function validateCondition(condition: HouseCondition): string | null {
  for (const [low, high, label, max, integral] of [
    ['depositMin', 'depositMax', '보증금', 1000000, true],
    ['monthlyRentMin', 'monthlyRentMax', '월세', 10000, true],
    ['areaMin', 'areaMax', '면적', 1000, false],
  ] as const) {
    const minValue = condition[low]; const maxValue = condition[high];
    for (const value of [minValue, maxValue]) {
      if (value !== null && (!Number.isFinite(value) || value < 0 || value > max || (integral && !Number.isInteger(value)))) return `${label}은 0~${max} 범위의 ${integral ? '정수' : '숫자'}로 입력해주세요.`;
    }
    if (minValue !== null && maxValue !== null && minValue > maxValue) return `${label} 최솟값이 최댓값보다 클 수 없어요.`;
  }
  return null;
}
