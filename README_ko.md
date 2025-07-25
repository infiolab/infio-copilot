<h1 align="center">Infio-Copilot</h1>

**Infio-Copilot은 옵시디언을 위한 Cursor 스타일의 AI 어시스턴트로, 선택한 노트와의 스마트 자동 완성 및 대화형 채팅 기능을 제공합니다.**

<a href="README.md" target="_blank"><b>English</b></a>  |  <a href="README_zh-CN.md" target="_blank"><b>中文</b></a>  |  <a href="README_ko.md" target="_blank"><b>한국어</b></a>

## ✨ 새로운 기능
[0.7.2](https://github.com/infiolab/infio-copilot/releases/tag/0.7.2)
옵시디언 내에서 워크플로우를 간소화하고 지식 관리를 강화하는 새로운 기능으로 가득 찬 주요 업데이트를 발표하게 되어 기쁩니다.
---

* **🚀 즉시 사용 가능한 임베딩 모델**
더 빠른 시작을 돕기 위해 이제 기본 로컬 임베딩 모델(`bge-micro-v2`)을 포함합니다. 강력한 시맨틱 기능을 사용하기 위해 더 이상 수동 설정이 필요하지 않습니다!

* **🗂️ 작업 공간**
새로운 **작업 공간** 기능으로 프로젝트, 연구 및 개인 노트를 정리하세요. 컨텍스트를 깔끔하게 유지하고 다양한 설정 간에 원활하게 전환할 수 있습니다.

* **💡 인사이트**
새로운 **인사이트** 기능으로 단순한 노트를 넘어서세요. 정보를 종합하고, 연결을 발견하며, 지식 기반에 대한 더 깊은 이해를 얻으세요.

* **🔍 고급 다차원 쿼리**
노트와 대화하세요! 이제 시간, 작업 및 기타 메타데이터와 같은 다양한 차원을 기반으로 복잡한 쿼리를 수행할 수 있습니다. 정확한 정보를 찾는 것이 그 어느 때보다 쉬워졌습니다.

* **✍️ 새로운 "쓰기" 모드**
더 직관적이고 강력하며 방해 없는 글쓰기 경험을 제공하기 위해 **쓰기** 모드를 처음부터 다시 구축했습니다.


## 기능

| 기능 | 설명 |
|---------|-------------|
| 💬 채팅 및 편집 | 즉각적인 AI 지원을 받고 제안된 개선 사항을 한 번의 클릭으로 적용 |
| 📝 자동 완성 | 입력하는 동안 문맥에 맞는 쓰기 제안을 받음 |
| ✏️ 인라인 편집 | 현재 파일 내에서 직접 노트 편집 |
| 🔍 볼트 채팅 | AI를 사용하여 전체 옵시디언 볼트와 상호 작용 |
| 🔍 볼트 검색 | 시맨틱 검색을 사용하여 전체 볼트 탐색 |
| ⌨️ 명령어 | 빠른 작업을 위한 사용자 지정 명령어 생성 및 관리 |
| 🎯 사용자 지정 모드 | 특정 동작으로 개인화된 AI 모드 정의 |
| 🔌 MCP | 모델 컨텍스트 프로토콜 통합 관리 |
| 🗂️ 작업 공간 | 원활한 컨텍스트 전환으로 프로젝트, 연구 및 개인 노트 정리 |
| 💡 인사이트 | 정보 종합, 연결 발견 및 더 깊은 이해 획득 |
| 🔍 dataview 쿼리 | 시간, 작업 및 메타데이터를 기반으로 복잡한 쿼리 수행 |
| ✍️ 새로운 쓰기 모드 | 직관적이고 강력하며 방해 없는 인터페이스로 재구축된 글쓰기 경험 |


### 채팅 및 편집 흐름

옵시디언 내에서 즉각적인 AI 지원을 받고 제안된 개선 사항을 한 번의 클릭으로 모두 적용하세요.

![chat-with-select](asserts/chat-with-select.gif)

### 자동 완성

입력하는 동안 문맥에 맞는 쓰기 제안을 받으세요.

![autocomplte](asserts/autocomplete.gif)

### 인라인 편집

현재 파일 내에서 직접 노트를 편집하세요.

![inline-edit](asserts/edit-inline.gif)

### 볼트와 채팅하기

AI의 힘을 활용하여 전체 옵시디언 볼트와 상호 작용하고 노트 전반에 걸쳐 통찰력과 연결을 얻으세요.

![rag](asserts/rag.gif)

## 시작하기
> **⚠️ 중요: 설치 프로그램 버전 요구 사항** Infio-Copilot은 최신 버전의 옵시디언 설치 프로그램이 필요합니다. 플러그인이 제대로 로드되지 않는 문제가 발생하면:
>
> 1. 먼저 `설정 > 일반 > 업데이트 확인`에서 옵시디언을 정상적으로 업데이트해 보세요.
> 2. 문제가 지속되면 옵시디언 설치 프로그램을 수동으로 업데이트하세요:
>
>    - [옵시디언 다운로드 페이지](https://obsidian.md/download)에서 최신 설치 프로그램을 다운로드하세요.
>    - 옵시디언을 완전히 닫으세요.
>    - 새 설치 프로그램을 실행하세요.

1. 옵시디언 설정 열기
2. "커뮤니티 플러그인"으로 이동하여 "탐색" 클릭
3. "Infio Copilot"을 검색하고 설치 클릭
4. 커뮤니티 플러그인에서 플러그인 활성화
5. 플러그인 설정에서 API 키 설정
   - SiliconFlow : [SiliconFlow API 키](https://cloud.siliconflow.cn/account/ak)
   - OpenRouter : [OpenRouter API 키](https://openrouter.ai/settings/keys)
	 - Alibaba Bailian : [Bailian API 키](https://help.aliyun.com/zh/dashscope/developer-reference/activate-dashscope-and-create-an-api-key)
   - DeepSeek : [DeepSeek API 키](https://platform.deepseek.com/api_keys/)
   - OpenAI : [ChatGPT API 키](https://platform.openai.com/api-keys)
   - Anthropic : [Claude API 키](https://console.anthropic.com/settings/keys)
   - Gemini : [Gemini API 키](https://aistudio.google.com/apikey)
   - Groq : [Groq API 키](https://console.groq.com/keys)
6. 빠른 액세스를 위한 단축키 설정:
   - 설정 > 단축키로 이동
   - "Infio Copilot" 검색
   - 권장 키 바인딩:
     * Infio Copilot: Infio 선택 항목을 채팅에 추가 -> cmd + shift + L
     * Infio Copilot: Infio 인라인 편집 -> cmd + shift + K
![autocomplte](asserts/doc-set-hotkey.png)
7. **새로운 기능: 즉시 사용 가능한 임베딩 모델** - 이제 플러그인에 기본 로컬 임베딩 모델(`bge-micro-v2`)이 포함되어 있어 시맨틱 기능을 즉시 사용할 수 있습니다! 향상된 성능을 위해 추가 임베딩 모델을 구성할 수도 있습니다:
   - 현재 SiliconFlow, Alibaba, Google 및 OpenAI 플랫폼은 임베딩 모델을 지원합니다.

## 피드백 및 지원
저희는 귀하의 의견을 소중히 여기며 귀하의 생각과 문제를 쉽게 공유할 수 있도록 보장하고자 합니다:

- **버그 신고**: 버그나 예기치 않은 동작이 발생하면 [GitHub 이슈](https://github.com/infiolab/infio-copilot/issues) 페이지에 문제를 제출해 주세요. 문제를 재현하고 해결하는 데 도움이 되도록 가능한 한 많은 세부 정보를 포함해 주세요.
- **기능 요청**: 새로운 기능 아이디어나 개선 사항에 대해서는 [GitHub 토론 - 아이디어 및 기능 요청](https.github.com/infiolab/infio-copilot/discussions/categories/ideas) 페이지를 사용해 주세요. 제안을 공유하려면 새 토론을 만드세요.

[트위터에서 저와 채팅하기](https://x.com/buyiyouxi)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/felixduan)

## 감사의 말

이 프로젝트는 거인들의 어깨 위에 서 있습니다. 다음 오픈 소스 프로젝트에 감사를 표합니다:

- [obsidian-copilot-auto-completion](https://github.com/j0rd1smit/obsidian-copilot-auto-completion) - 자동 완성 구현 및 TypeScript 아키텍처 영감
- [obsidian-smart-composer](https://github.com/glowingjade/obsidian-smart-composer) - 채팅/적용 UI 패턴 및 PgLite 통합 예제
- [continue](https://github.com/continuedev/continue) & [cline](https://github.com/cline/cline) - 프롬프트 엔지니어링 및 LLM 상호 작용 패턴
- [pglite](https://github.com/electric-sql/pglite) - 대화/벡터 데이터 저장 및 샘플 코드

## 라이선스

이 프로젝트는 [MIT 라이선스](LICENSE)에 따라 라이선스가 부여됩니다.
