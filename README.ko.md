# YM4cut - 인생네컷 스타일 포토부스

**YM4cut**은 인기 있는 "인생네컷" 스타일에서 영감을 받은 셀프 포토부스용 PC 애플리케이션입니다. 
**Electron**과 **React**로 제작되었으며, '노트북'과 '캐논 셀피 포토프린터'만 있으면 쉽게 "인생네컷"을 만들 수 있습니다. 
4장의 사진을 연속으로 촬영하고, 이를 직접 만든 '나만의 템플릿'에 합성하여 이미지를 생성한 뒤 자동으로 출력하는 원스톱 경험을 제공합니다.

## 📸 주요 기능

*   **터치 친화적 UI:** 키오스크 터치스크린에 최적화된 직관적인 인터페이스. (마우스 조작도 가능)
*   **자동 촬영 워크플로우:** 4회 연속 촬영을 위한 자동 카운트다운 및 캡처.
*   **실시간 프리뷰:** 카운트다운 오버레이가 포함된 실시간 카메라 피드.
*   **즉시 합성:** 촬영된 사진을 나만의 템플릿(1:3 비율)과 결합하고 인쇄용 레이아웃(2:3 비율)을 빠르게 생성.
*   **자동 인쇄:** 프린터(Canon Selphy CP 시리즈 최적화)와 연동하여 즉시 출력.
*   **커스터마이징:** 설정 화면을 통해 메인 화면 이미지와 사진 템플릿을 쉽게 업데이트 가능. (재출력도 가능)

## 🛠 기술 스택

*   **런타임:** [Electron](https://www.electronjs.org/) (데스크톱 통합)
*   **프론트엔드:** [React](https://reactjs.org/) (UI), [Redux Toolkit](https://redux-toolkit.js.org/) (상태 관리)
*   **이미지 처리:** [Sharp](https://sharp.pixelplumbing.com/) (고성능 이미지 조작)
*   **하드웨어 제어:** `node-printer` (인쇄), HTML5 Media Devices API (카메라)
*   **언어:** TypeScript

## 📋 사전 요구사항

### 하드웨어        

*   **OS 및 성능:** Windows 10 또는 11 (Core i5 8세대, 8GB RAM 이상 권장).
*   **카메라:** USB 웹캠 (1080p, 30fps 지원 권장) 또는 노트북 웹캠
*   **프린터:** USB 또는 무선네트워크로 연결된 Canon Selphy CP1300/1500 시리즈.


### 소프트웨어
*   **Node.js:** v18.x 이상.
*   **Git:** 버전 관리용.
*   **프린터 드라이버:** 사용하는 프린터의 공식 드라이버가 설치되어 있고 기본 프린터로 설정되어 있어야 합니다.

## 🚀 사용자 가이드 (빠른 시작)

**YM4cut_setup.exe** 설치 파일을 받으신 경우 다음 단계를 따르세요:

1.  **설치 프로그램 실행:** `YM4cut_setup.exe` 파일을 더블 클릭하여 설치를 시작합니다. 화면의 지시에 따라 설치를 완료합니다.
2.  **하드웨어 연결:** USB 카메라와 포토 프린터가 PC에 연결되어 있고 전원이 켜져 있는지 확인합니다.
3.  **앱 실행:** 바탕화면이나 시작 메뉴에서 **YM4cut**을 실행합니다.
4.  **초기 설정:**
    *   홈 화면 좌측 하단의 **톱니바퀴 아이콘**(설정)을 클릭합니다.
    *   카메라 프리뷰와 프린터 상태를 확인합니다.
    *   원하는 메인 배경 이미지와 템플릿(1:3 비율)을 업로드합니다.
5.  **촬영 시작:** 홈 화면으로 돌아와 **시작** 버튼을 누르세요!

---

## 🛠 개발자 가이드 (소스 빌드)

직접 빌드하거나 개발에 참여하려는 경우 다음 단계를 따르세요:

### 1. 사전 요구사항
*   **Node.js:** v18.x 이상.
*   **Build Tools:** Windows Build Tools (네이티브 모듈 `sharp`, `node-printer` 빌드용).
*   **Git:** 버전 관리용.

### 2. 설치
```bash
git clone https://github.com/your-username/ym4cut.git
cd ym4cut
npm install
```

### 3. 개발 모드 실행
```bash
npm run electron:start
```

### 4. 설치 파일(`YM4cut_setup.exe`) 빌드
배포용 설치 파일을 생성하려면:
```bash
npm run electron:build
```
빌드된 `YM4cut_setup.exe` 파일은 `dist` 폴더 내에 생성됩니다.

## 📂 프로젝트 구조

```
YM4cut/
├── captures/           # 카메라 원본 촬영 이미지 임시 저장
├── config/             # 설정 파일 (settings.json)
├── output/             # 최종 합성 이미지 저장
├── public/             # 정적 자산 및 Electron 메인 프로세스
│   ├── electron.js     # Electron Main Process 엔트리 포인트
│   └── preload.js      # IPC용 프리로드 스크립트
├── src/                # React 소스 코드
│   ├── components/     # UI 컴포넌트 (Camera, Print 등)
│   ├── assets/         # 앱 자산 (아이콘, 기본 이미지)
│   └── ...
└── ...
```

## ⚙️ 설정

홈 화면의 톱니바퀴 아이콘을 통해 접근 가능한 **설정** 화면에서 기본 설정을 변경할 수 있습니다.

*   **메인 이미지:** 시작 화면에 표시되는 배경/홍보 이미지를 변경합니다.
*   **템플릿:** 새 프레임 템플릿을 업로드합니다.
    *   함께 제공되는 'ym4cut_tamplate.pptx' 의 슬라이드에 있는 템플릿을 편집, 이미지로 저장하여 활용합니다.

## ⚠️ 문제 해결

*   **카메라 작동 안 함:** Windows 개인 정보 설정에서 앱의 카메라 액세스 권한이 허용되어 있는지 확인하세요. USB 연결 상태를 확인하세요.
*   **인쇄 안 됨:** 프린터가 온라인 상태이고 용지와 잉크가 있는지 확인하세요. Windows 설정의 "프린터 및 스캐너" 메뉴에서 기본 프린터를 확인하세요.


## 📜 오픈소스 라이선스

본 프로젝트는 다음 오픈소스 소프트웨어를 사용합니다:

*   **Electron, React, Redux Toolkit, React Router, electron-is-dev, node-printer, concurrently, electron-builder**: [MIT License](https://opensource.org/licenses/MIT)에 따라 라이선스가 부여됩니다.
*   **Sharp, TypeScript**: [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)에 따라 라이선스가 부여됩니다.

## 📝 라이선스

이 프로젝트는 개인적 또는 교육적 용도로 제작되었습니다.
