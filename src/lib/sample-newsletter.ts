import type { NewsletterContent } from "@/types/newsletter";

/**
 * Sample newsletter content for the design preview at /preview/newsletter.
 * Once Phase 4.2 (Claude draft generation) is built, this will be replaced
 * by real DB-stored content.
 *
 * Branding: SPEAK — Stories People in micE Always Know · by GroundK
 */

// "Stories People in micE Always Know | by GroundK"
//  ^       ^         ^   ^      ^
//  S       P         E   A      K
//  0       8         18  20     27
const SUBTITLE = "Stories People in micE Always Know | by GroundK";
const BOLD_INDICES = [
  SUBTITLE.indexOf("S"), // 0
  SUBTITLE.indexOf("P"), // 8
  SUBTITLE.indexOf("E"), // 18 (the E in "micE")
  SUBTITLE.indexOf("A"), // 20
  SUBTITLE.indexOf("K"), // 27
];

export const sampleNewsletter: NewsletterContent = {
  issueLabel: "VOL.01 · 2026년 4월호",
  subject: "[SPEAK] 4월 호 — 금리 인하 신호와 Agentic AI",

  // ─── 1. Header ─────────────────────────────
  header: {
    topMessage: "보이지 않던 것들을 말해드립니다.",
    wordmark: "SPEAK",
    subtitle: SUBTITLE,
    boldIndices: BOLD_INDICES,
  },

  // ─── 2. Referral CTA ───────────────────────
  referralCta: {
    message:
      "지금부터 드리는 정보가 유익하셨거나, 함께 받으면 좋을 분이 떠오르셨다면 알려주세요. 다음 호부터 그분께도 전달해드리겠습니다.",
    buttonLabel: "추천하기",
    buttonHref: "https://mice-newsletter.vercel.app/r/sample-token",
  },

  // ─── 3. Opening Hook ───────────────────────
  openingHook: {
    hook: "금리 인하가 몰고 올 예산의 변화부터\n스스로 생각하는 AI 시대의 도래까지.\n당신의 행사는 지금보다 더 매끄러워져야 합니다.",
    subtext:
      "복잡해지는 환경 속에서 답을 찾기 위해 고군분투하는 MICE인들을 위해, 이번 호에서도 그라운드케이가 현장에서 발굴한 선명한 시그널을 공유합니다.",
  },

  // ─── 4. Number of the Month ────────────────
  numberOfMonth: {
    number: "73",
    suffix: "%",
    caption:
      "글로벌 이벤트 기획사 대상 조사에서, 행사 참가자 만족도에 가장 큰 영향을 미친 요소로 **'현장 운영의 매끄러움'**을 꼽은 응답 비율입니다.",
    source: "콘텐츠 퀄리티(68%)보다 높습니다. (Source: Eventbrite Industry Report, 2024)",
  },

  // ─── 5. News Briefing ──────────────────────
  newsBriefing: {
    englishLabel: "News Briefing",
    items: [
      {
        categoryTag: "경제 · 산업",
        title: "한국은행, 기준금리 0.25%p 인하 — 2년 만의 완화 신호",
        body: "한국은행 금융통화위원회가 기준금리를 연 3.25%로 0.25%p 인하했습니다. 내수 경기 부양과 수출 둔화 대응이 주요 배경으로 꼽힙니다.",
        insight: {
          label: "MICE 연결",
          text: "금리 인하는 기업의 자금 조달 비용을 낮추고, 기업 행사·연수·포상 관광 예산의 집행을 앞당기는 신호가 될 수 있습니다. 특히 하반기 MICE 발주 증가로 이어질 가능성에 주목할 시점입니다.",
        },
      },
      {
        categoryTag: "정책 · 규제",
        title: "탄소 공시 의무화 로드맵 발표 — 2026년부터 대기업 적용",
        body: "금융위원회가 국내 상장사 대상 ESG 정보 공시 의무화 일정을 확정 발표했습니다. 2026년 자산 2조 원 이상 기업부터 시작해 2030년 전체 코스피 상장사로 확대됩니다.",
        insight: {
          label: "MICE 연결",
          text: "발주처의 ESG 공시 의무화는 행사 기획 단계부터 탄소 발자국, 폐기물 처리, 친환경 운영 항목이 제안서 평가 요소로 편입될 가능성을 높입니다. 지속가능성을 운영 기준으로 내재화한 PCO·운영사가 우위를 가져가는 흐름이 앞당겨질 수 있습니다.",
        },
      },
      {
        categoryTag: "사회 · 인구",
        title: "외국인 관광객 방한 2,000만 명 시대 — 인바운드 수요 구조 변화",
        body: "한국관광공사에 따르면 2026년 방한 외국인 관광객이 2,000만 명을 돌파할 전망입니다. 단순 관광을 넘어 비즈니스·회의 목적 방문 비중이 꾸준히 증가하는 구조적 변화가 확인되고 있습니다.",
        insight: {
          label: "MICE 연결",
          text: "인바운드 증가는 국제회의 유치 경쟁을 심화시키는 동시에, 다국어 운영·외국인 참가자 경험 설계 역량이 PCO 선정의 핵심 변별 요소로 부상하는 흐름을 만듭니다.",
        },
      },
    ],
  },

  // ─── 6. MICE IN & OUT (2-column) ───────────
  miceInOut: {
    englishLabel: "MICE IN & OUT",
    inItem: {
      categoryTag: "IN · 국내",
      title: "코엑스, 2026년 상반기 국제회의 유치 건수 사상 최대",
      body: "한국무역협회 산하 코엑스가 상반기 국제회의 유치 건수 38건을 기록해 역대 최대 실적을 달성했습니다. 의료·IT·바이오 분야 비중이 절반 이상을 차지했습니다.",
      source: "출처: 한국무역협회 보도자료, 2026.04",
    },
    outItem: {
      categoryTag: "OUT · 글로벌",
      title: "싱가포르 STB, MICE 유치 건수 전년 대비 18% 증가 발표",
      body: "싱가포르 관광청(STB)은 2026년 MICE 행사 유치 건수가 전년 대비 18% 증가했다고 밝혔습니다. 500인 이하 중소형 전문 컨퍼런스가 증가를 이끌었습니다.",
      source: "출처: Singapore Tourism Board, 2026 MICE Report",
    },
  },

  // ─── 7. TECH SIGNAL (dark inverted) ────────
  techSignal: {
    englishLabel: "Tech Signal",
    topicLabel: "Agentic AI",
    topicMeta: "2026.04 · 이번 달 가장 뜨거운 기술 이슈",
    title: "AI 에이전트가 스스로 일을 맡기 시작했다 — Agentic AI의 부상",
    paragraphs: [
      "2026년 상반기 테크 업계의 가장 뜨거운 화두는 **Agentic AI**입니다. 질문에 답하는 것을 넘어, AI가 스스로 목표를 설정하고 여러 단계의 작업을 자율적으로 수행합니다. 사람이 \"해줘\"라고 지시하면, AI가 브라우저를 열고 검색하고 양식을 작성하고 결과를 정리하는 일련의 과정을 스스로 처리합니다. 기존 자동화와 다른 점은 **예외 상황에서 스스로 판단**한다는 것입니다.",
    ],
    miceInsight:
      "참가자 등록 확인, 호텔 예약 조율, 공급업체 견적 취합처럼 **반복적이지만 판단이 필요한 업무**가 에이전트 AI의 첫 번째 적용 대상이 될 가능성이 높습니다. 지금 이 기술이 어디까지 왔는지 알아두는 것만으로도 향후 시스템 도입 기준이 달라질 수 있습니다.",
  },

  // ─── 8. From Theory to Field (long-form) ───
  theoryToField: {
    englishLabel: "From Theory to Field",
    sourceYear: "1990",
    sourceAuthor: "얀 비외르크 / 카롤린스카 연구소",
    sourceMeta: "Circadian Rhythm & Cognitive Performance, Stockholm",
    title: "왜 오후 2시 세션은 항상 집중이 안 될까",
    introParagraphs: [
      "1990년대 초, 스웨덴 카롤린스카 연구소의 시간생물학자 얀 비외르크는 하루 중 인간의 인지 능력 변화를 연구했습니다. 결론은 단순했습니다. 대부분의 사람에게 오전 10시~12시가 집중력의 정점이고, 점심 이후 오후 1시~3시 사이에는 각성도가 현저하게 떨어진다는 것입니다.",
      "이 현상은 수면 부족과 무관하게 **Circadian Rhythm — 생체리듬 자체**에서 발생합니다. 이 연구가 MICE 업계에 처음 소개된 건 2000년대 초 유럽 PCO 협회(EFAPCO) 가이드라인을 통해서였습니다.",
    ],
    bridge: {
      label: "→ 현장에서는",
      text: "국내 MICE 현장에서 이 원칙이 적용되는 경우는 아직 많지 않습니다. 세션 배치는 여전히 연사 스케줄과 행사 흐름 위주로 결정됩니다. **\"오후 2시 세션은 항상 집중이 안 된다\"**는 것을 경험으로 다들 알면서도, 그것을 설계 원칙으로 가져오는 단계까지는 거리가 있습니다.",
    },
    outroParagraphs: [
      "30년이 지난 지금, 이 패턴은 여전히 반복됩니다. 세션 설계 방법론은 정교해졌는데, 인간의 생체리듬은 바뀌지 않았기 때문입니다. 그래서 오후 시간대에는 인터랙티브 워크숍·라운드테이블·네트워킹 같은 \"움직이는\" 형식이 더 효과적이라는 것이 후속 연구에서도 거듭 확인되었습니다.",
    ],
    closingNote:
      "참가자가 가장 잘 들을 수 있는 시간에 가장 중요한 메시지를 배치한다 — 단순하지만, 실제로 적용하면 참가자 경험이 달라지는 원칙입니다.",
  },

  // ─── 9. 지금 MICE는 ──────────────────────────
  nowMice: {
    englishLabel: "지금 MICE는",
    eyebrow: "이달의 이슈",
    title: "일이 많아진 게 아니라,\n일의 종류가 늘어난 것",
    leadParagraph: "요즘 MICE 업계 사람들과 이야기하다 보면 비슷한 말을 자주 듣습니다.",
    pullQuote: "바쁜 건 예전이랑 비슷한데,\n왜 더 힘든 느낌이 들지?",
    paragraphs: [
      "행사 자체가 더 복잡해진 것도 있지만, 실제로는 **일의 종류**가 늘어난 쪽이 큽니다. 10년 전 MICE 담당자가 커버해야 했던 영역과, 지금 담당자가 커버해야 하는 영역은 같은 직함이지만 내용이 다릅니다. 데이터 관리, 참가자 경험 설계, SNS 콘텐츠, 온라인 병행 운영, 지속가능성 보고까지 — 합산하면 전혀 다른 직무가 됩니다.",
      "문제는 이 추가된 영역들이 **\"새로운 업무\"로 명시되지 않는다**는 점입니다. 어느 순간부터 당연히 해야 하는 것이 되어 있습니다. 채용 공고에도, KPI에도, 연봉 협상 테이블에도 올라오지 않지만 — 현장에서는 이미 그 무게를 다들 지고 있습니다.",
    ],
    closingNote:
      "역할의 범위가 늘어났다는 것을 공식적으로 인정하고 구조화하는 일 — 어쩌면 지금 업계가 가장 조용히 필요로 하는 작업일 수 있습니다.",
  },

  // ─── 10. GroundK Story ─────────────────────
  groundkStory: {
    englishLabel: "GroundK Story",

    fieldBriefing: {
      eyebrow: "이달의 현장 브리핑",
      categoryTag: "공항 운영",
      body: "아시아나항공의 인천공항 T2 이전 이후 수하물 판독 시간이 평균 9분가량 지연되고 있습니다. 특히 오전 7~9시 동남아·일본 노선 집중 시간대는 더욱 심각합니다.\n\n**VIP 영접 시에는 도착 후 수하물 수취까지 기존 대비 15~20분의 추가 여유를 반드시 반영하시기 바랍니다.**",
    },

    projectSketch: {
      projectMeta: "Project · COS",
      dateMeta: "2026.03.25",
      eyebrow: "그라운드케이 프로젝트 스케치",
      title: "런웨이 뒤에는 또 다른 무대가 있다",
      paragraphs: [
        "지난 3월 25일, 런던 기반 패션 브랜드 COS가 서울에서 첫 공식 패션쇼를 열었습니다. 아시아 최초 개최지로 서울이 선택되었고, 성북구 정릉동의 브루탈리즘 건축 공간에서 40개 룩이 공개된 이 자리에 그라운드케이가 함께했습니다.",
        "패션쇼는 단순한 행사가 아닙니다. 글로벌 앰버서더와 미디어, 바이어, 인플루언서가 한 공간에 집결하는 고밀도 프로토콜 현장입니다. 쇼 이후에는 한국가구박물관에서 프라이빗 디너가 이어졌고, 저희는 런웨이 공간과 디너 장소를 넘나드는 동선 전체를 설계하고 관리했습니다.",
        "서울이 글로벌 브랜드 이벤트의 새로운 거점이 되고 있습니다. 루이비통, 디올에 이어 COS까지 — 이 흐름 속에서 저희가 쌓아온 경험이 어떤 의미를 갖는지, 매 프로젝트마다 새로 확인합니다.",
      ],
      tags: ["패션쇼", "VIP 의전", "서울 · 2026.03"],
    },
  },

  // ─── 11. Footer ────────────────────────────
  footer: {
    brandName: "GroundK",
    links: [
      { label: "groundk.co.kr", href: "https://groundk.co.kr" },
      { label: "triseup.com", href: "https://triseup.com" },
      { label: "rideus.co.kr", href: "https://rideus.co.kr" },
    ],
    unsubscribeHref: "https://mice-newsletter.vercel.app/u/sample-token",
  },
};
