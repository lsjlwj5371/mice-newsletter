import type { NewsletterContent } from "@/types/newsletter";

/**
 * Sample newsletter content for the design preview at /preview/newsletter.
 * Once Phase 4.2 (Claude draft generation) is built, this will be replaced
 * by real DB-stored content.
 */
export const sampleNewsletter: NewsletterContent = {
  issueLabel: "2026.04",
  subject: "[GROUND INSIGHT] 4월 호 — 금리 인하 신호와 Agentic AI",

  header: {
    eyebrow: "MICE · PCO · Event Industry",
    brandTitle: "GROUND INSIGHT",
    tagline: "업계 종사자를 위한 인사이트 레터 · by GroundK",
  },

  referralCta: {
    message:
      "지금부터 드리는 정보가 유익하셨거나, 함께 받으면 좋을 분이 떠오르셨다면 알려주세요. 다음 호부터 그분께도 전달해드리겠습니다.",
    buttonLabel: "추천하기",
    buttonHref: "https://mice-newsletter.vercel.app/r/sample-token",
  },

  openingHook: {
    hook: "금리 인하가 몰고 올 예산의 변화부터\n스스로 생각하는 AI 시대의 도래까지.\n당신의 행사는 지금보다 더 매끄러워져야 합니다.",
    subtext:
      "복잡해지는 환경 속에서 답을 찾기 위해 고군분투하는 MICE인들을 위해, 이번 호에서도 그라운드케이가 현장에서 발굴한 선명한 시그널을 공유합니다.",
  },

  numberOfMonth: {
    number: "73",
    suffix: "%",
    caption:
      "참가자 만족도에 가장 큰 영향을 미친 요소로 **'현장의 매끄러움'**을 꼽은 비율",
    source: "콘텐츠 퀄리티(68%) 보다 높습니다. (Source: Eventbrite Industry Report, 2024)",
  },

  newsBriefing: {
    englishLabel: "News Briefing",
    items: [
      {
        categoryTag: "Macro & Economy",
        title: "한국은행, 기준금리 0.25%p 인하 — 2년 만의 완화 신호",
        body: "한국은행 금융통화위원회가 기준금리를 연 3.25%로 0.25%p 인하했습니다. 내수 경기 부양과 수출 둔화 대응이 주요 배경으로 꼽힙니다.",
        insight: {
          text: "금리 인하는 자금 조달 비용을 낮추고, 기업 행사의 예산 집행을 앞당기는 신호가 될 수 있습니다. 하반기 MICE 발주 증가 가능성에 주목하십시오.",
        },
      },
      {
        categoryTag: "Policy & ESG",
        title: "탄소 공시 의무화 로드맵 발표 — 2026년부터 대기업 적용",
        body: "금융위원회가 국내 상장사 대상 ESG 정보 공시 의무화 일정을 확정 발표했습니다. 2026년 대기업부터 시작해 점진적으로 전체 상장사로 확대됩니다.",
        insight: {
          text: "발주처의 ESG 공시 의무화는 행사 기획 단계부터 친환경 운영 항목이 제안서 평가 기본 요소로 편입된다는 것을 의미합니다.",
        },
      },
    ],
  },

  miceInOut: {
    englishLabel: "MICE IN & OUT",
    items: [
      {
        categoryTag: "Global Event",
        title: "IBTM World 2026 바르셀로나 — 한국 참가단 역대 최대 규모",
        body: "유럽 최대 비즈니스 이벤트 박람회 IBTM World가 11월 바르셀로나에서 개최됩니다. 한국관에는 PCO·CVB·DMO 28개사가 참가해 역대 최대 규모를 기록할 예정입니다.",
        insight: {
          text: "한국 MICE 산업의 글로벌 노출이 확대되는 시점입니다. 참가사들의 사전 비즈니스 미팅 매칭률 제고가 관건입니다.",
        },
      },
    ],
  },

  techSignal: {
    englishLabel: "TECH SIGNAL",
    items: [
      {
        categoryTag: "AI Agent",
        title: "스스로 일을 쫓는 AI — Agentic AI의 부상",
        body: "질문에 단순히 답하는 것을 넘어, AI가 목표를 설정하고 여러 단계의 작업을 자율적으로 수행합니다. 이는 기존 자동화 시스템과 달리 예외 상황에서 모델이 스스로 판단한다는 것이 가장 큰 차이점입니다.",
        insight: {
          text: "참가자 등록 확인, 호텔 예약 조율, 공급업체 견적 취합처럼 반복적이지만 순간적 판단이 필요한 업무가 가장 먼저 대체될 것입니다.",
        },
      },
    ],
  },

  theoryToField: {
    englishLabel: "From Theory to Field",
    items: [
      {
        categoryTag: "Research",
        title: "참가자 경험(Attendee Experience)의 4가지 차원",
        body: "Cornell 호스피탈리티 스쿨의 최신 연구는 참가자 경험을 기능적·사회적·감각적·의미적 4차원으로 구분합니다. 행사 평가에서 흔히 측정되는 만족도는 기능 영역에 치우쳐 있다는 한계가 지적됩니다.",
        insight: {
          text: "사후 설문 항목을 4차원으로 재설계하면 기존 만족도 지표가 놓치고 있던 '감각적·의미적' 가치를 포착할 수 있습니다.",
        },
      },
    ],
  },

  nowMice: {
    englishLabel: "Editor's Take",
    title: "일이 많아진 게 아니라, 일의 종류가 늘어난 것",
    pullQuote: "바쁜 건 예전이랑 비슷한데, 왜 더 힘든 느낌이 들지?",
    paragraphs: [
      "행사 자체가 복잡해진 것도 있지만, 실제로는 해야 할 **'일의 종류'**가 늘어난 쪽이 큽니다. 데이터 관리, 참가자 경험 설계, 온라인 병행 운영 등 합산하면 전혀 다른 직무가 됩니다.",
      "이 추가된 영역들이 \"새로운 업무\"로 공식 명시되지 않는다는 점이 가장 큰 문제입니다. 늘어난 역할을 조용히 짊어지는 현장의 부담을 구조화할 시간입니다.",
    ],
  },

  groundkStory: {
    englishLabel: "GroundK Story",
    items: [
      {
        categoryTag: "Field Briefing",
        title: "이달의 현장 | 공항 운영 지원 연착 이슈",
        body: "아시아나항공의 인천공항 T2 이전 이후 수하물 판독 시간이 평균 9분 지연되고 있습니다. 오전 동남아 타임에는 VIP 도착 후 수취까지 기존 대비 20분 추가 여유를 반영해야 합니다.",
      },
      {
        categoryTag: "Project Sketch",
        title: "런웨이 뒤에 숨겨진 또 다른 무대, Project COS",
        body: "3월 25일, 패션 브랜드 COS가 서울 정릉동 브루탈리즘 건축 공간에서 첫 공식 패션쇼를 열었습니다. 이 자리의 런웨이, 디너 이동 동선을 통제한 것이 그라운드케이였습니다.",
        pills: ["VIP 의전", "서울 · 2026.03"],
      },
    ],
  },

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
