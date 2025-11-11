포토부스 앱 아키텍처 설계
Windows 환경에서 작동하는 '인생네컷' 스타일 포토부스 앱의 아키텍처를 설계하겠습니다.
1. 기술 스택 선택
권장: Electron + React (JavaScript/TypeScript)
선택 이유:

크로스 플랫폼: Windows 네이티브 앱으로 패키징 가능
하드웨어 접근: Node.js를 통한 USB 카메라, 프린터 제어
UI/UX: React로 터치 친화적 인터페이스 구현 용이
개발 생산성: 풍부한 라이브러리 생태계

대안: Python (PyQt6 + OpenCV)

빠른 프로토타이핑에 유리
하드웨어 제어 라이브러리 풍부
단, UI 개발이 상대적으로 복잡함


2. 시스템 아키텍처
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│  ┌──────────┬──────────┬──────────┬──────────┬────────┐ │
│  │   Home   │  Count   │  Camera  │  Result  │ Settings│ │
│  │  Screen  │  Select  │  Screen  │  Screen  │ Screen  │ │
│  └──────────┴──────────┴──────────┴──────────┴────────┘ │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│  ┌──────────────┬──────────────┬─────────────────────┐  │
│  │ State Manager│ Event Handler│  Workflow Manager   │  │
│  │   (Redux)    │              │  (State Machine)    │  │
│  └──────────────┴──────────────┴─────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                    Business Layer                        │
│  ┌─────────────┬──────────────┬────────────────────┐   │
│  │   Camera    │    Image     │     Template       │   │
│  │  Service    │  Processor   │     Manager        │   │
│  └─────────────┴──────────────┴────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                  Hardware Abstraction Layer              │
│  ┌──────────────┬──────────────┬────────────────────┐   │
│  │   Camera     │   Printer    │   File System      │   │
│  │   Driver     │   Driver     │   Manager          │   │
│  └──────────────┴──────────────┴────────────────────┘   │
└─────────────────────────────────────────────────────────┘

3. 핵심 모듈 설계
3.1 State Management (상태 관리)
typescriptinterface AppState {
  // 현재 화면
  currentScreen: 'home' | 'countSelect' | 'camera' | 'result' | 'settings';
  
  // 워크플로우 상태
  workflow: {
    printCount: number;           // 출력 매수
    capturedPhotos: string[];     // 촬영된 사진 경로 (최대 4장)
    finalImage: string | null;    // 최종 합성 이미지
    progress: number;             // 진행률 (0-100)
  };
  
  // 설정
  settings: {
    mainImage: string;            // 홈 화면 메인 이미지
    templateImage: string;        // 템플릿 이미지
    photoLayout: PhotoPosition[]; // 사진 배치 좌표
    timerDuration: number;        // 촬영 타이머 (초)
    autoReturnDelay: number;      // 자동 홈 복귀 시간 (초)
  };
  
  // 하드웨어 상태
  hardware: {
    cameraConnected: boolean;
    printerConnected: boolean;
  };
}

interface PhotoPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}
3.2 Camera Service (카메라 제어)
typescriptclass CameraService {
  private camera: any;
  private stream: MediaStream | null;
  
  // 카메라 초기화 및 연결
  async initialize(): Promise<boolean>;
  
  // 실시간 프리뷰 스트림 제공
  getPreviewStream(): MediaStream;
  
  // 사진 촬영 (셔터 효과 포함)
  async capturePhoto(): Promise<Blob>;
  
  // 타이머 촬영 (카운트다운 콜백 포함)
  async captureWithTimer(
    duration: number, 
    onTick: (remaining: number) => void
  ): Promise<Blob>;
  
  // 연속 촬영 (4장)
  async captureSequence(
    interval: number,
    onCapture: (index: number, photo: Blob) => void
  ): Promise<Blob[]>;
  
  // 카메라 해제
  release(): void;
}
구현 방법:

Electron: navigator.mediaDevices.getUserMedia() 사용
Python: OpenCV의 cv2.VideoCapture() 사용

3.3 Image Processor (이미지 합성)
typescriptclass ImageProcessor {
  // 템플릿과 사진 합성
  async composeImage(
    templatePath: string,
    photos: string[],
    layout: PhotoPosition[]
  ): Promise<string>;
  
  // 이미지 좌우 복제 및 병합 (1:3 → 2:3)
  async duplicateAndMerge(imagePath: string): Promise<string>;
  
  // 이미지 리사이징 및 크롭
  async resizePhoto(
    photoPath: string,
    width: number,
    height: number
  ): Promise<string>;
  
  // Base64 변환 (프리뷰용)
  async toBase64(imagePath: string): Promise<string>;
}
구현 라이브러리:

JavaScript: sharp (고성능 이미지 처리)
Python: Pillow (PIL)

3.4 Printer Service (프린터 제어)
typescriptclass PrinterService {
  private printer: any;
  
  // 프린터 연결 확인
  async checkConnection(): Promise<boolean>;
  
  // 사용 가능한 프린터 목록
  async listPrinters(): Promise<PrinterInfo[]>;
  
  // 이미지 인쇄
  async print(
    imagePath: string,
    copies: number,
    onProgress: (progress: number) => void
  ): Promise<void>;
  
  // 인쇄 작업 취소
  cancelPrint(): void;
}
구현 방법:

Electron: node-printer 또는 pdf-to-printer 라이브러리
Python: win32print (Windows API)

3.5 Workflow Manager (워크플로우 관리)
typescriptclass WorkflowManager {
  private stateMachine: StateMachine;
  
  // 워크플로우 시작
  async startWorkflow(printCount: number): Promise<void>;
  
  // 다음 단계로 진행
  async nextStep(): Promise<void>;
  
  // 촬영 프로세스 실행
  async executeCameraFlow(): Promise<void>;
  
  // 이미지 합성 프로세스
  async executeComposition(): Promise<void>;
  
  // 인쇄 및 종료 프로세스
  async executePrintAndFinish(): Promise<void>;
  
  // 홈으로 복귀
  async returnToHome(delay: number): Promise<void>;
  
  // 워크플로우 취소
  cancelWorkflow(): void;
}
```

---

## 4. 화면 구성 및 UI 컴포넌트

### 4.1 Home Screen (홈 화면)
```
┌────────────────────────────────┐
│                                │
│       [메인 이미지 영역]         │
│                                │
│                                │
│        ┌──────────┐            │
│        │  시  작  │            │
│        └──────────┘            │
│                                │
│ [⚙️설정]                       │
└────────────────────────────────┘
```

**컴포넌트:**
- `MainImageDisplay`: 메인 이미지 표시
- `StartButton`: 시작 버튼 (큰 터치 영역)
- `SettingsButton`: 설정 버튼 (좌측 하단)

### 4.2 Count Select Screen (출력 매수 선택)
```
┌────────────────────────────────┐
│                                │
│        출력 매수 선택           │
│                                │
│      [-]   [  4  ]   [+]      │
│                                │
│        ┌──────────┐            │
│        │  촬  영  │            │
│        └──────────┘            │
│                                │
└────────────────────────────────┘
```

**컴포넌트:**
- `CountSelector`: 증감 토글 컴포넌트
- `CaptureButton`: 촬영 시작 버튼

### 4.3 Camera Screen (촬영 화면)
```
┌────────────────────────────────┐
│  [실시간 카메라 프리뷰]         │
│                                │
│                                │
│         ⏱️ 3                   │
│                                │
│    ▓▓▓▓▓▓▓░░░░ 2/4           │
│                                │
└────────────────────────────────┘
```

**컴포넌트:**
- `CameraPreview`: 실시간 프리뷰
- `CountdownTimer`: 카운트다운 오버레이
- `ProgressIndicator`: 촬영 진행 상황 (2/4)
- `ShutterEffect`: 셔터 플래시 효과

### 4.4 Result Screen (결과 화면)
```
┌────────────────────────────────┐
│                                │
│    [최종 합성 이미지 프리뷰]    │
│                                │
│                                │
│  📄 사진 인화 중...            │
│  ⏱️ 30초 후 자동 종료          │
│                                │
└────────────────────────────────┘
```

**컴포넌트:**
- `ResultImageDisplay`: 최종 이미지 표시
- `PrintStatusMessage`: 인쇄 상태 안내
- `AutoReturnTimer`: 자동 복귀 타이머

### 4.5 Settings Screen (설정 화면)
```
┌────────────────────────────────┐
│  ← 뒤로가기                     │
│                                │
│  메인 이미지:                   │
│  [파일 선택] [업로드]           │
│                                │
│  템플릿 이미지:                 │
│  [파일 선택] [업로드]           │
│                                │
│        [저장하기]               │
└────────────────────────────────┘
```

**컴포넌트:**
- `ImageUploader`: 파일 업로드 컴포넌트
- `SettingsForm`: 설정 폼

---

## 5. 데이터 흐름 (Sequence Diagram)
```
사용자 → 홈화면 → 출력매수 선택 → 촬영 → 합성 → 인쇄 → 홈화면

[시작 버튼]
    ↓
[출력매수 선택] → printCount 저장
    ↓
[촬영 시작]
    ↓
카메라 초기화 → 프리뷰 시작
    ↓
[타이머 촬영 4회 반복]
  - 카운트다운 3, 2, 1
  - 셔터 효과음
  - 사진 저장
  - 진행률 업데이트 (25%, 50%, 75%, 100%)
    ↓
[이미지 합성]
  - 템플릿 로드
  - 사진 4장 배치
  - 좌우 복제 병합
  - 최종 이미지 생성
    ↓
[결과 화면 표시]
    ↓
[프린터 출력] (백그라운드)
  - 출력 매수 계산: Math.ceil(printCount / 2)
  - 인쇄 진행
    ↓
[30초 타이머]
    ↓
[홈 화면 복귀]
```

---

## 6. 파일 구조 (Electron + React 기준)
```
photobooth-app/
├── electron/                    # Electron 메인 프로세스
│   ├── main.js                 # 앱 진입점
│   ├── preload.js              # 보안 브릿지
│   └── services/               # 하드웨어 서비스
│       ├── camera.service.js
│       ├── printer.service.js
│       └── image.processor.js
│
├── src/                        # React 렌더러 프로세스
│   ├── components/             # UI 컴포넌트
│   │   ├── common/
│   │   │   ├── ProgressBar.tsx
│   │   │   └── TouchButton.tsx
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── CountSelectScreen.tsx
│   │   │   ├── CameraScreen.tsx
│   │   │   ├── ResultScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   └── features/
│   │       ├── CameraPreview.tsx
│   │       ├── CountdownTimer.tsx
│   │       └── ShutterEffect.tsx
│   │
│   ├── store/                  # Redux 상태 관리
│   │   ├── slices/
│   │   │   ├── workflowSlice.ts
│   │   │   ├── settingsSlice.ts
│   │   │   └── hardwareSlice.ts
│   │   └── store.ts
│   │
│   ├── services/               # 비즈니스 로직
│   │   ├── workflowManager.ts
│   │   └── api.ts             # IPC 통신
│   │
│   ├── hooks/                  # Custom Hooks
│   │   ├── useCamera.ts
│   │   └── useWorkflow.ts
│   │
│   ├── assets/                 # 정적 파일
│   │   ├── sounds/
│   │   │   └── shutter.mp3
│   │   └── images/
│   │       ├── default-main.png
│   │       └── default-template.png
│   │
│   └── App.tsx                 # 루트 컴포넌트
│
├── public/                     # 공용 자산
├── package.json
└── electron-builder.json       # 빌드 설정

7. 핵심 기술 구현 상세
7.1 이미지 합성 알고리즘
typescriptasync function composePhotos(
  templatePath: string,
  photos: string[],
  layout: PhotoPosition[]
): Promise<string> {
  const sharp = require('sharp');
  
  // 1. 템플릿 로드 (1:3 비율)
  const template = sharp(templatePath);
  const metadata = await template.metadata();
  
  // 2. 각 사진을 레이아웃에 맞게 리사이즈 및 배치
  const compositeImages = await Promise.all(
    photos.map(async (photo, index) => {
      const pos = layout[index];
      const resized = await sharp(photo)
        .resize(pos.width, pos.height, { fit: 'cover' })
        .toBuffer();
      
      return {
        input: resized,
        left: pos.x,
        top: pos.y
      };
    })
  );
  
  // 3. 템플릿에 사진 합성
  const composed = await template
    .composite(compositeImages)
    .toBuffer();
  
  // 4. 좌우 복제 및 병합 (2:3 비율)
  const final = await sharp({
    create: {
      width: metadata.width * 2,
      height: metadata.height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
  .composite([
    { input: composed, left: 0, top: 0 },
    { input: composed, left: metadata.width, top: 0 }
  ])
  .jpeg({ quality: 95 })
  .toFile('output/final.jpg');
  
  return 'output/final.jpg';
}
7.2 프린터 출력 매수 계산
typescriptfunction calculatePrintCopies(userInput: number): number {
  // 사용자 입력을 2로 나누고 반올림
  // 예: 1매 → 1매, 2매 → 1매, 3매 → 2매, 4매 → 2매
  return Math.ceil(userInput / 2);
}
7.3 IPC 통신 (Electron)
typescript// preload.js - 보안 브릿지
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 카메라
  initCamera: () => ipcRenderer.invoke('camera:init'),
  capturePhoto: () => ipcRenderer.invoke('camera:capture'),
  
  // 프린터
  print: (imagePath, copies) => 
    ipcRenderer.invoke('printer:print', imagePath, copies),
  
  // 이미지 처리
  composeImage: (template, photos, layout) =>
    ipcRenderer.invoke('image:compose', template, photos, layout),
  
  // 이벤트 리스너
  onPrintProgress: (callback) => 
    ipcRenderer.on('printer:progress', callback)
});

8. 성능 최적화 전략

이미지 처리

백그라운드 워커에서 처리
프리뷰용 저해상도, 인쇄용 고해상도 분리


메모리 관리

촬영 완료 후 카메라 스트림 즉시 해제
사용하지 않는 이미지 버퍼 정리


프린터 출력

비동기 처리로 UI 블로킹 방지
프린터 스풀러 상태 모니터링


UI 반응성

터치 이벤트 최적화 (300ms delay 제거)
CSS transform을 사용한 애니메이션




9. 에러 처리 및 예외 상황
typescriptclass ErrorHandler {
  // 카메라 연결 실패
  handleCameraError(): void {
    showAlert('카메라를 찾을 수 없습니다. USB 연결을 확인해주세요.');
    returnToHome();
  }
  
  // 프린터 연결 실패
  handlePrinterError(): void {
    showAlert('프린터 오류가 발생했습니다. 용지와 연결을 확인해주세요.');
    // 사진은 저장하고 홈으로 복귀
  }
  
  // 이미지 합성 실패
  handleCompositionError(): void {
    showAlert('이미지 처리 중 오류가 발생했습니다.');
    returnToHome();
  }
  
  // 디스크 공간 부족
  handleStorageError(): void {
    showAlert('저장 공간이 부족합니다.');
    cleanupOldFiles();
  }
}

10. 배포 및 패키징
Electron 빌드 설정
json{
  "build": {
    "appId": "com.yourcompany.photobooth",
    "productName": "인생네컷 포토부스",
    "win": {
      "target": ["nsis"],
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
시작 프로그램 등록 (Kiosk Mode)
typescript// 부팅 시 자동 실행 + 전체 화면
app.setLoginItemSettings({
  openAtLogin: true,
  path: app.getPath('exe')
});

mainWindow.setFullScreen(true);
mainWindow.setKiosk(true); // 키오스크 모드
