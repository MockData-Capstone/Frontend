export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < 8 || password.length > 64 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return '비밀번호는 영문과 숫자를 포함한 8~64자로 입력해주세요.';
  if (password !== confirmation) return '새 비밀번호가 서로 일치하지 않아요.';
  return null;
}
export function validateProfileImage(file: Pick<File, 'size' | 'type'>): string | null {
  if (!file.size) return '빈 파일은 올릴 수 없어요.';
  if (file.size > 5 * 1024 * 1024) return '사진은 5MB 이하로 선택해주세요.';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'JPG, PNG, WebP 사진을 선택해주세요.';
  return null;
}
