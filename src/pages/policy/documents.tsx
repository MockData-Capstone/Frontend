import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { contactText, POLICY_DOCS, POLICY_INFO, privacyOfficerText } from '../../lib/policy';

// 이용약관·개인정보 처리방침 본문. 약관 페이지(/policy/*)와 가입 화면의 [보기] 팝업이 같이 쓴다.
// 실제 동작(백엔드 develop 기준)과 맞춰 썼다. 수집 항목·보관·탈퇴 처리·외부 서비스가 바뀌면 여기도 고칠 것.

const { operator, effectiveDate } = POLICY_INFO;

function Article({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="policy-doc__article">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

// 호갱노노처럼 약관 위에 핵심만 먼저 보여준다.
export function PolicyHighlights() {
  return (
    <ul className="policy-highlights">
      <li>ZIPFIT은 캡스톤 디자인 프로젝트로 운영하는 무료 시범 서비스예요.</li>
      <li>경사·차량 진입·AI 추천은 공개 자료와 추정으로 만든 참고 정보예요. 계약 전에는 꼭 현장을 확인하세요.</li>
      <li>[대화 분석하기]를 누르면 그룹 대화가 AI 분석 서버로 보내져요. 보낸 사람은 닉네임 대신 '멤버1'처럼 바꿔서 보내요.</li>
      <li>집보기 영상·음성은 실시간으로만 전달하고 저장하지 않아요.</li>
      <li>ZIPFIT은 매물을 중개하지 않아요. 매물 검색 링크는 외부 사이트로 연결돼요.</li>
    </ul>
  );
}

// newTab: 가입 화면 팝업에서 열 때는 링크를 새 탭으로 열어 입력한 내용을 지킨다.
export function TermsOfService({ newTab = false }: { newTab?: boolean }) {
  return (
    <div className="policy-doc">
      <Article title="제1조 (목적)">
        <p>
          이 약관은 {operator}(이하 "운영팀")이 제공하는 ZIPFIT 서비스(이하 "서비스")를 이용하는 조건과 절차, 운영팀과 회원의
          권리·의무를 정합니다.
        </p>
      </Article>
      <Article title="제2조 (용어의 정의)">
        <ol>
          <li>"회원"은 이 약관과 개인정보 수집·이용에 동의하고 가입한 사람입니다.</li>
          <li>
            "그룹"은 회원이 함께 집을 찾으려고 만든 공간입니다. 그룹을 만든 회원은 "호스트", 초대받아 들어온 회원은 "멤버"라고
            합니다.
          </li>
          <li>"후보지"는 그룹에서 살펴보려고 저장한 동네나 위치입니다.</li>
          <li>"ZIPFIT AI"는 그룹 대화를 분석해 조건을 정리하고 동네를 추천하는 기능입니다.</li>
          <li>"집보기"는 방문자가 휴대폰 카메라로 집을 비추면 다른 멤버가 실시간으로 함께 보는 기능입니다.</li>
        </ol>
      </Article>
      <Article title="제3조 (약관의 게시와 변경)">
        <ol>
          <li>운영팀은 이 약관을 서비스 화면 하단의 "이용약관" 링크로 언제든 볼 수 있게 게시합니다.</li>
          <li>
            약관을 바꿀 때는 시행일과 바뀌는 내용을 시행 7일 전부터 서비스 안에 알립니다. 회원에게 불리하게 바뀌는 경우에는 30일
            전부터 알립니다.
          </li>
          <li>
            바뀐 약관에 동의하지 않는 회원은 탈퇴할 수 있습니다. 시행일 이후에도 서비스를 계속 이용하면 바뀐 약관에 동의한 것으로
            봅니다.
          </li>
        </ol>
      </Article>
      <Article title="제4조 (회원가입)">
        <ol>
          <li>만 14세 이상인 사람은 이메일 또는 카카오 계정으로 가입할 수 있습니다.</li>
          <li>가입하려면 이 약관과 개인정보 수집·이용에 동의해야 합니다.</li>
          <li>다른 사람의 정보를 쓰거나 사실과 다른 정보로 가입하면 이용을 제한하거나 회원 자격을 없앨 수 있습니다.</li>
        </ol>
      </Article>
      <Article title="제5조 (계정 관리)">
        <ol>
          <li>회원은 자신의 비밀번호와 로그인 수단을 직접 관리해야 하며, 다른 사람이 쓰게 해서는 안 됩니다.</li>
          <li>계정이 도용된 것을 알게 되면 바로 비밀번호를 바꾸고 운영팀에 알려야 합니다.</li>
        </ol>
      </Article>
      <Article title="제6조 (서비스 내용)">
        <p>운영팀은 다음 서비스를 무료로 제공합니다.</p>
        <ol>
          <li>지도에서 동네·경사도·로드뷰 둘러보기</li>
          <li>그룹 만들기·초대와 그룹 대화</li>
          <li>ZIPFIT AI 대화 분석과 동네 추천</li>
          <li>후보지 저장·비교·투표, 조건 확정과 외부 매물 사이트 연결</li>
          <li>방문자를 정하는 미니게임과 실시간 집보기</li>
          <li>그룹 활동 알림</li>
        </ol>
      </Article>
      <Article title="제7조 (ZIPFIT AI와 입지 정보)">
        <ol>
          <li>
            경사도, 차량 진입 가능 여부, 추천 동네와 추천 이유는 공개 자료와 추정 모델로 만든 참고 정보이며, 정확성이나 완전성을
            보장하지 않습니다.
          </li>
          <li>집을 계약하기 전에는 현장과 공적 장부(등기사항증명서 등)를 직접 확인해야 합니다.</li>
          <li>
            ZIPFIT은 매물을 중개하거나 거래 당사자가 되지 않습니다. 매물 검색 링크는 네이버부동산·직방 등 외부 사이트로 연결될
            뿐이며, 그 사이트의 매물 정보와 거래는 해당 사이트와 거래 당사자의 책임입니다.
          </li>
        </ol>
      </Article>
      <Article title="제8조 (그룹과 게시물)">
        <ol>
          <li>그룹의 대화, 후보지, 투표, 조건 등은 그 그룹 멤버 모두에게 보입니다.</li>
          <li>
            회원이 쓴 대화 등 게시물의 권리는 작성한 회원에게 있습니다. 운영팀은 서비스를 제공하는 데 필요한 범위에서만 이를
            저장하고 처리합니다.
          </li>
          <li>
            호스트는 그룹 정보를 고치고, 멤버를 내보내고, 호스트를 넘기고, 그룹을 삭제할 수 있습니다. 그룹을 삭제하면 그 그룹의
            대화와 후보지 등도 함께 삭제됩니다.
          </li>
        </ol>
      </Article>
      <Article title="제9조 (실시간 집보기)">
        <ol>
          <li>집보기 영상과 음성은 참여한 그룹 멤버에게 실시간으로만 전달되며, 운영팀은 이를 녹화하거나 저장하지 않습니다.</li>
          <li>
            방문자는 촬영 전에 중개사·임대인·거주자 등 촬영 대상의 동의를 받아야 하며, 다른 사람의 얼굴이나 개인 물건, 개인정보가
            비치지 않도록 주의해야 합니다.
          </li>
          <li>회원은 집보기 화면을 녹화하거나 캡처해서 촬영 대상의 동의 없이 공유해서는 안 됩니다.</li>
        </ol>
      </Article>
      <Article title="제10조 (회원의 의무)">
        <p>회원은 다음 행동을 해서는 안 됩니다.</p>
        <ol>
          <li>다른 사람의 정보를 도용하거나 거짓 정보를 등록하는 행위</li>
          <li>욕설, 혐오 표현, 음란물, 불법 정보를 올리는 행위</li>
          <li>다른 사람의 동의 없이 촬영하거나 그 영상을 퍼뜨리는 행위</li>
          <li>서비스를 해킹하거나 비정상적인 방법으로 접속·수집하는 행위, 서버에 과도한 부하를 주는 행위</li>
          <li>서비스를 영리 목적의 광고나 홍보에 쓰는 행위</li>
          <li>그 밖에 법령이나 이 약관을 어기는 행위</li>
        </ol>
      </Article>
      <Article title="제11조 (이용 제한)">
        <p>
          회원이 제10조를 어기면 운영팀은 경고, 일정 기간 이용 정지, 회원 자격 해지 순으로 이용을 제한할 수 있습니다. 다만 법을
          어기거나 다른 회원에게 큰 피해를 준 경우에는 바로 제한할 수 있습니다.
        </p>
      </Article>
      <Article title="제12조 (서비스의 변경과 중단)">
        <ol>
          <li>
            ZIPFIT은 캡스톤 디자인 프로젝트로 운영하는 시범 서비스입니다. 운영팀은 기능을 바꾸거나 서비스를 끝낼 수 있으며, 이때
            미리 서비스 안에 알립니다.
          </li>
          <li>서버 점검이나 장애, 카카오 지도 등 외부 서비스의 장애가 있으면 서비스가 잠시 멈출 수 있습니다.</li>
          <li>서비스를 끝내면 회원 정보와 그룹 데이터를 모두 파기합니다.</li>
        </ol>
      </Article>
      <Article title="제13조 (회원 탈퇴)">
        <ol>
          <li>회원은 언제든지 [내 정보]에서 탈퇴할 수 있습니다.</li>
          <li>
            다른 멤버가 있는 그룹의 호스트는 그룹 설정에서 호스트를 넘긴 뒤 탈퇴할 수 있습니다. 혼자 있는 그룹은 탈퇴할 때 함께
            삭제됩니다.
          </li>
          <li>
            탈퇴할 때 지워지는 정보와 그룹에 남는 정보는{' '}
            <Link to={POLICY_DOCS.privacy.path} {...(newTab ? { target: '_blank', rel: 'noreferrer' } : {})}>
              개인정보 처리방침
            </Link>
            을 따릅니다.
          </li>
        </ol>
      </Article>
      <Article title="제14조 (책임의 제한)">
        <ol>
          <li>운영팀은 무료로 제공하는 서비스와 관련해, 운영팀의 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.</li>
          <li>운영팀은 회원끼리, 또는 회원과 중개사·임대인 등 제3자 사이의 분쟁에 대해 책임을 지지 않습니다.</li>
          <li>운영팀은 제7조의 참고 정보만 믿고 내린 결정으로 생긴 손해에 대해 책임을 지지 않습니다.</li>
        </ol>
      </Article>
      <Article title="제15조 (준거법과 분쟁 해결)">
        <p>
          이 약관은 대한민국 법을 따릅니다. 서비스 이용과 관련한 분쟁은 먼저 운영팀과 회원이 협의해 해결하며, 해결되지 않으면
          민사소송법에 따른 관할 법원에서 해결합니다.
        </p>
      </Article>
      <Article title="부칙">
        <p>이 약관은 {effectiveDate}부터 시행합니다.</p>
      </Article>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <div className="policy-doc">
      <p className="policy-doc__lead">
        {operator}(이하 "운영팀")은 「개인정보 보호법」에 따라 회원의 개인정보를 보호하고 관련 고충을 빠르게 처리하기 위해 다음과
        같이 개인정보 처리방침을 둡니다.
      </p>
      <Article id="privacy-items" title="제1조 (처리하는 개인정보와 목적)">
        <div className="policy-doc__table-wrap">
          <table className="policy-doc__table">
            <thead>
              <tr>
                <th scope="col">구분</th>
                <th scope="col">항목</th>
                <th scope="col">목적</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">이메일로 가입 (필수)</th>
                <td>이메일, 비밀번호(복원할 수 없게 암호화해 저장), 닉네임</td>
                <td>회원 식별, 로그인, 비밀번호 재설정 메일 발송</td>
              </tr>
              <tr>
                <th scope="row">카카오로 가입 (필수)</th>
                <td>카카오 회원번호, 닉네임</td>
                <td>회원 식별, 로그인</td>
              </tr>
              <tr>
                <th scope="row">카카오로 가입 (선택)</th>
                <td>카카오 계정 이메일, 카카오 프로필 사진 주소 (카카오 동의 화면에서 허락한 경우만)</td>
                <td>내 정보와 프로필 표시</td>
              </tr>
              <tr>
                <th scope="row">프로필 (선택)</th>
                <td>직접 올린 프로필 사진</td>
                <td>그룹 멤버에게 프로필 표시</td>
              </tr>
              <tr>
                <th scope="row">서비스 이용</th>
                <td>
                  그룹 이름·설명, 멤버 목록, 대화 내용과 보낸 시각, AI 분석 결과, 후보지·투표·확정 조건, 미니게임·집보기 기록(참여자
                  닉네임, 시작·종료 시각), 알림
                </td>
                <td>그룹 기능 제공</td>
              </tr>
              <tr>
                <th scope="row">알림을 켠 경우</th>
                <td>브라우저 알림 구독 정보</td>
                <td>브라우저 알림 보내기</td>
              </tr>
              <tr>
                <th scope="row">자동으로 생기는 정보</th>
                <td>로그인 유지용 쿠키, 개인정보 수집·이용 동의 일시</td>
                <td>로그인 유지, 동의 기록 보관</td>
              </tr>
              <tr>
                <th scope="row">집보기</th>
                <td>영상·음성은 저장하지 않아요. 연결하는 동안 기기의 네트워크 주소(IP)가 쓰여요.</td>
                <td>실시간 집보기 연결</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Article>
      <Article id="privacy-ai" title="제2조 (ZIPFIT AI 분석)">
        <ol>
          <li>
            그룹 멤버가 [대화 분석하기]를 누르면, 그 그룹의 대화 내용과 보낸 시각을 운영팀이 운영하는 AI 분석 서버로 보내 조건을
            정리하고 동네를 추천합니다.
          </li>
          <li>보낸 사람은 닉네임 대신 "멤버1", "멤버2"처럼 바꿔서 보내며, 이메일 같은 계정 정보는 보내지 않습니다.</li>
          <li>대화에 직접 적은 연락처·주소 같은 개인정보는 그대로 전송될 수 있으니 대화에 적지 않도록 주의해 주세요.</li>
          <li>분석 결과(추출 조건, 추천 위치와 이유)는 그룹이 삭제될 때까지 보관합니다.</li>
        </ol>
      </Article>
      <Article id="privacy-retention" title="제3조 (보유 기간과 파기)">
        <ol>
          <li>
            회원 정보는 탈퇴할 때까지 보유하고, 탈퇴하면 바로 파기합니다. 이때 계정(이메일·닉네임·비밀번호), 프로필 사진, 카카오
            연결(카카오와의 연결도 끊습니다), 로그인 토큰, 투표, 알림, 브라우저 알림 구독 정보를 지웁니다.
          </li>
          <li>
            탈퇴해도 다른 멤버의 그룹 기록을 지키기 위해 다음은 그룹에 남습니다.
            <ul>
              <li>보낸 대화: 보낸 사람과 내용을 지우고 "탈퇴한 사용자의 메시지"로만 표시</li>
              <li>추가한 후보지: 추가한 사람 표시 없이 유지</li>
              <li>미니게임·집보기 기록의 닉네임: 그 그룹이 삭제될 때 함께 파기</li>
            </ul>
          </li>
          <li>혼자 있는 그룹은 탈퇴할 때 그룹의 모든 정보와 함께 파기합니다.</li>
          <li>
            전자 파일은 복구할 수 없는 방법으로 지웁니다. 다만 데이터베이스 서비스가 장애 복구용으로 보관하는 기록에는 짧은 기간
            남았다가 자동으로 지워질 수 있습니다.
          </li>
          <li>서비스를 끝내면 모든 개인정보를 파기합니다.</li>
        </ol>
      </Article>
      <Article title="제4조 (제3자 제공)">
        <p>
          운영팀은 회원의 개인정보를 제3자에게 제공하지 않습니다. 다만 그룹 기능의 특성상 닉네임·프로필 사진·대화 내용 등은 같은
          그룹 멤버에게 보이며, 법령에 따라 수사기관 등이 요청하는 경우는 예외로 합니다.
        </p>
      </Article>
      <Article title="제5조 (처리 위탁과 함께 쓰는 외부 서비스)">
        <div className="policy-doc__table-wrap">
          <table className="policy-doc__table">
            <thead>
              <tr>
                <th scope="col">업체</th>
                <th scope="col">맡기는 일</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Amazon Web Services (서울 리전)</th>
                <td>서버 운영, 프로필 사진 보관, 집보기 연결 중계</td>
              </tr>
              <tr>
                <th scope="row">Neon (AWS 시드니 리전)</th>
                <td>데이터베이스 보관</td>
              </tr>
              <tr>
                <th scope="row">Google (Gmail)</th>
                <td>비밀번호 재설정 메일 보내기</td>
              </tr>
              <tr>
                <th scope="row">카카오</th>
                <td>카카오 로그인, 지도·로드뷰 표시</td>
              </tr>
              <tr>
                <th scope="row">브라우저 회사 (Google·Apple·Mozilla 등)</th>
                <td>브라우저 알림 전달 (알림을 켠 경우)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Article>
      <Article id="privacy-abroad" title="제6조 (개인정보의 국외 이전)">
        <p>서비스 제공을 위해 다음과 같이 개인정보를 국외에 보관하거나 국외 서버를 거쳐 처리합니다.</p>
        <ul>
          <li>
            <b>Neon</b> — 이전 국가: 호주(AWS 시드니 리전) / 항목: 제1조의 회원 정보와 서비스 이용 정보(영상·음성 제외) / 시기와
            방법: 서비스를 이용할 때마다 암호화된 연결로 전송 / 목적과 기간: 데이터베이스 보관, 제3조의 보유 기간과 같음
          </li>
          <li>
            <b>Google LLC</b> — 이전 국가: 미국 / 항목: 이메일 주소, 비밀번호 재설정 메일 내용 / 시기와 방법: 비밀번호 재설정을
            요청할 때 메일 서버로 전송 / 목적: 비밀번호 재설정 메일 발송
          </li>
        </ul>
        <p>국외 이전을 원하지 않으면 가입하지 않거나 탈퇴할 수 있습니다. 이 경우 서비스를 이용할 수 없습니다.</p>
      </Article>
      <Article title="제7조 (회원의 권리와 행사 방법)">
        <ol>
          <li>회원은 언제든지 자신의 개인정보를 열람·정정·삭제하거나 처리 정지를 요구할 수 있습니다.</li>
          <li>
            [내 정보]에서 닉네임·프로필 사진·비밀번호를 바로 바꾸고 탈퇴할 수 있습니다. 그 밖의 요청은 아래 문의처로 보내 주세요.
          </li>
          <li>만 14세 미만은 가입할 수 없습니다.</li>
        </ol>
      </Article>
      <Article title="제8조 (쿠키 등 자동 저장 장치)">
        <ol>
          <li>
            로그인을 유지하려고 재발급 토큰을 쿠키에 저장합니다. 이 쿠키는 화면의 스크립트가 읽을 수 없고(HttpOnly), 로그인에만
            쓰입니다.
          </li>
          <li>
            브라우저 저장소에 가입하는 동안의 초대 링크, 로드뷰 창 크기, 조건 상자 펼침 같은 화면 설정을 저장합니다.
          </li>
          <li>광고나 행태 분석을 위한 쿠키와 추적 도구는 쓰지 않습니다.</li>
          <li>브라우저 설정에서 쿠키를 막을 수 있지만, 그러면 로그인이 유지되지 않습니다.</li>
        </ol>
      </Article>
      <Article title="제9조 (안전성 확보 조치)">
        <ul>
          <li>비밀번호는 복원할 수 없게 암호화(BCrypt)해 저장합니다.</li>
          <li>모든 통신은 HTTPS로 암호화합니다.</li>
          <li>로그인 토큰은 30분만 유효하고, 로그아웃하거나 탈퇴하면 바로 무효로 합니다.</li>
          <li>서버와 데이터베이스에 접근할 수 있는 사람을 운영팀으로 제한합니다.</li>
        </ul>
      </Article>
      <Article title="제10조 (개인정보 보호책임자와 문의처)">
        <ul>
          <li>개인정보 보호책임자: {privacyOfficerText()}</li>
          <li>문의: {contactText()}</li>
        </ul>
      </Article>
      <Article title="제11조 (권익침해 구제 방법)">
        <p>개인정보 침해에 대한 상담이나 신고가 필요하면 아래 기관에 문의할 수 있습니다.</p>
        <ul>
          <li>개인정보분쟁조정위원회: (국번 없이) 1833-6972, www.kopico.go.kr</li>
          <li>개인정보침해신고센터: (국번 없이) 118, privacy.kisa.or.kr</li>
          <li>대검찰청: (국번 없이) 1301, www.spo.go.kr</li>
          <li>경찰청: (국번 없이) 182, ecrm.police.go.kr</li>
        </ul>
      </Article>
      <Article title="제12조 (처리방침의 변경)">
        <p>이 처리방침은 {effectiveDate}부터 적용합니다. 바뀌는 경우 시행 7일 전부터 서비스 안에 알립니다.</p>
      </Article>
    </div>
  );
}

// 가입 화면 [보기]: 개인정보 수집·이용 동의에 꼭 알려야 하는 네 가지(목적·항목·보유 기간·거부할 권리)
export function PrivacyConsentSummary() {
  return (
    <div className="policy-doc">
      <div className="policy-doc__table-wrap">
        <table className="policy-doc__table policy-doc__table--compact">
          <tbody>
            <tr>
              <th scope="row">목적</th>
              <td>회원 식별과 로그인, 그룹 기능 제공, 비밀번호 재설정 안내</td>
            </tr>
            <tr>
              <th scope="row">항목</th>
              <td>
                이메일 가입: 이메일, 비밀번호, 닉네임
                <br />
                카카오 가입: 카카오 회원번호, 닉네임 (허락한 경우 이메일·프로필 사진)
              </td>
            </tr>
            <tr>
              <th scope="row">보유 기간</th>
              <td>탈퇴할 때까지 (탈퇴하면 바로 파기)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>동의를 거부할 수 있지만, 거부하면 가입할 수 없어요.</p>
      <p>
        데이터베이스는 호주(Neon, AWS 시드니 리전)에 있어요. 그룹 대화 분석, 외부 서비스, 국외 이전 등 자세한 내용은{' '}
        <Link to={POLICY_DOCS.privacy.path} target="_blank" rel="noreferrer">
          개인정보 처리방침
        </Link>
        에서 볼 수 있어요.
      </p>
    </div>
  );
}
