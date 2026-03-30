# **단선율 악보 생성을 위한 대형 언어 모델 시스템 프롬프트 설계: 선율 작법과 내재적 화성 규칙의 알고리즘화 및 최적화 연구**

## **서론: 기호적 음악 생성 모델과 단선율의 구조적 복잡성**

인공지능을 활용한 기호적 음악 생성(Symbolic Music Generation) 분야는 마르코프 체인(Markov Chains)과 유전 알고리즘(Genetic Algorithms)을 거쳐, 최근 대형 언어 모델(Large Language Models, LLMs)과 트랜스포머(Transformer) 아키텍처의 도입으로 혁신적인 전환점을 맞이하고 있다.1 자연어 처리에서 탁월한 성능을 입증한 대형 언어 모델은 텍스트 프롬프트만으로 복잡한 음악적 구조를 추론하고 생성할 수 있는 잠재력을 지니고 있으며, 이는 음악을 인간의 창의적 언어이자 기호적 시스템으로 모델링할 수 있음을 시사한다.2 그러나 다성부(Polyphony) 환경에서 수직적인 화성 배치를 학습하는 모델들과 달리, 단일한 선율선만으로 구성된 단선율(Monophony) 악보를 생성하는 작업은 역설적으로 더욱 고도화된 음악적 통제력을 요구한다.

단선율은 화성적 반주나 보조적인 선율의 지원 없이 오직 하나의 독립적인 선율선만으로 진행되는 음악적 텍스처를 의미한다.6 서양 음악사에서 단선율은 그레고리오 성가(Gregorian chant)와 같은 원초적인 형태부터 요한 세바스찬 바흐(Johann Sebastian Bach)의 무반주 첼로 모음곡(Cello Suites)에 이르기까지 폭넓게 활용되어 왔다.6 특히 바흐의 기악 독주곡에서 관찰되는 바와 같이, 고도로 발전된 단선율 작법은 표면적으로는 단순한 하나의 선율이지만 그 이면에 깊은 화성적 암시와 다성부적 구조를 내포하고 있다.10 따라서 대형 언어 모델이 성공적이고 예술적으로 유의미한 1성부 악보를 생성하도록 유도하기 위해서는, 일반적인 딥러닝 모델의 통계적 확률 분포에 의존하는 것을 넘어 음악 이론에 기반한 구체적인 선율 작법, 비화성음의 엄격한 통제 규칙, 프레이즈 단위의 구조론, 그리고 단일 선율 내에 화성을 구축하는 '내재적 화성(Implied Harmony)' 기법을 시스템 프롬프트(System Prompt) 형태로 명시적으로 주입해야 한다.13

본 보고서는 서양 음악 이론의 핵심적인 선율 형성 원칙을 분석하고, 이를 대형 언어 모델이 이해하고 연역적으로 적용할 수 있는 알고리즘적 규칙으로 변환하는 과정을 상세히 규명한다. 기호적 음악 데이터를 표현하기 위한 ABC 기보법의 최적성을 논증하는 것을 시작으로, 선율 윤곽(Contour)과 갭-필(Gap-fill) 원리, 비화성음의 해결 규칙, 화성 리듬의 분배, 거시적 프레이즈 구조론을 심층적으로 해부한다. 최종적으로 이러한 이론적 바탕과 최신 프롬프트 엔지니어링 기법을 융합하여, 완벽한 1성부 악보 생성을 통제할 수 있는 포괄적이고 체계적인 시스템 프롬프트 아키텍처를 제시한다.

## **기호적 음악 데이터 표현 양식: 대형 언어 모델을 위한 ABC 기보법의 최적성**

인공지능 모델에게 음악적 지시를 내리고 악보를 생성하게 하기 위해서는 음악 데이터를 언어 모델의 아키텍처에 적합한 텍스트 형태로 토큰화(Tokenization)해야 한다.5 전통적으로 컴퓨터 음악 분야에서는 MIDI 파일과 같은 이진 데이터나 MusicXML과 같은 마크업 언어가 널리 사용되어 왔으나, 대형 언어 모델의 프롬프팅 환경에서는 이러한 포맷들이 심각한 한계를 노출한다.17 MusicXML은 구조적 오버헤드가 매우 커서 언어 모델의 컨텍스트 윈도우(Context Window)를 비효율적으로 소모하며, 멜로디의 선형적 흐름을 파악하는 데 불필요한 태그 정보가 지나치게 많아 모델의 추론 능력을 저하시킨다.17 반면 ABC 기보법(ABC Notation)은 문자 및 숫자 기호만으로 선율, 리듬, 마디, 조성을 매우 압축적으로 표현할 수 있어 음악적 정보 밀도가 높고 대형 언어 모델의 텍스트 생성 매커니즘에 가장 최적화된 포맷으로 평가받는다.5

ABC 기보법의 구조는 대형 언어 모델이 음악의 메타데이터와 실제 선율 데이터를 분리하여 인지할 수 있도록 돕는다. ABC 기보법은 크게 헤더(Header) 부분과 바디(Body) 부분으로 명확히 구분된다.20 헤더는 곡의 구조적 기반을 설정하는 영역으로, 참조 번호(X:), 곡의 제목(T:), 박자표(M:), 기본 음표의 길이(L:), 그리고 조성(K:) 등의 필수 정보를 포함한다.20 언어 모델이 올바른 1성부 악보를 생성하기 위해서는 시스템 프롬프트가 이 헤더 값들의 논리적 정합성을 강제해야 한다. 예를 들어, M:4/4와 L:1/8로 설정된 상태라면 바디 영역의 각 마디는 정확히 8개의 8분음표 길이에 해당하는 데이터값을 가져야만 한다.16

바디 영역은 실제 음표의 피치(Pitch), 리듬, 마디 선, 쉼표 등이 알파벳과 특수 기호로 나열되는 공간이다.20 이 바디 영역을 생성할 때 언어 모델은 할루시네이션(Hallucination)을 방지하기 위해 각 마디의 박자 수가 헤더에서 정의한 수학적 한계치를 초과하거나 미달하지 않도록 지속적으로 계산해야 한다.18

| 평가 지표 | MusicXML 포맷 | ABC 기보법 (ABC Notation) | 대형 언어 모델(LLM) 프롬프팅 적합성 논리 |
| :---- | :---- | :---- | :---- |
| **정보 밀도** | 매우 낮음 (태그 오버헤드 큼) 19 | 매우 높음 (텍스트 기반 기호) 17 | 토큰 제한이 있는 LLM 환경에서 ABC 기보법이 컨텍스트 윈도우를 효율적으로 사용함.17 |
| **가독성** | 인간이 직접 읽기 어려움 21 | 인간과 기계 모두 직관적 해석 가능 16 | LLM이 음악적 문법과 구문을 텍스트 언어적 특성으로 매핑하여 학습하고 생성하기 용이함.5 |
| **메타데이터 분리** | XML 태그 트리 내부에 산재함 | 헤더(Header)와 바디(Body)의 명확한 분리 20 | 프롬프트를 통해 메타데이터 제약(조성, 박자)과 선율 생성(음표 나열) 단계를 명확히 통제할 수 있음.20 |
| **다성부/단선율** | 다성부 및 복합 텍스처 표현에 강력함 | 단선율 및 전통 기악곡 표현에 직관적 17 | 1성부 악보 제작을 위한 단선율 궤적 생성 시 불필요한 폴리포니 트랙 지정 과정이 생략되어 최적화됨.17 |

성공적인 ABC 기보법 출력을 위해 시스템 프롬프트는 언어 모델에게 단순히 음표를 생성하라는 지시를 넘어서, 생성된 문자가 ABC 문법 규칙에 완벽히 부합하는지 스스로 검증하도록 유도하는 체계를 갖추어야 한다.16

## **선율 윤곽(Melodic Contour)과 인지 심리학적 기대 원리**

단선율 작법에서 선율 윤곽(Melodic Contour)은 음악의 시간에 따른 상승과 하강의 궤적을 의미하며, 이는 청취자의 심리적 기대와 음악적 미학을 결정짓는 핵심 요소이다.23 우수한 단선율은 예측 가능성과 의외성 사이의 정교한 균형을 유지해야 하며, 이는 인접한 스케일의 음으로 이동하는 순차 진행(Conjunct motion)과 상대적으로 넓은 간격을 뛰어넘는 도약 진행(Disjunct motion)의 조화로운 배치를 통해 이루어진다.23 시스템 프롬프트가 언어 모델의 무작위적인 음표 생성을 제어하기 위해서는 이러한 선율 윤곽의 형성을 수학적이고 인지적인 규칙으로 변환하여 주입해야 한다.

### **게슈탈트 심리학과 마이어의 갭-필(Gap-Fill) 원칙**

선율의 움직임을 지배하는 가장 강력한 인지적 이론 중 하나는 레너드 마이어(Leonard B. Meyer)가 제안한 '갭-필(Gap-fill)' 원칙이다.26 이 원칙은 게슈탈트 심리학(Gestalt psychology)의 좋은 연속성(Good continuation) 및 근접성(Proximity) 법칙에 뿌리를 두고 있다.24 마이어와 유진 나모어(Eugene Narmour)의 분석에 따르면, 청취자는 좁은 음정(예: 순차 진행)을 들었을 때 동일한 방향으로 유사하게 좁은 음정이 이어질 것을 기대한다. 이를 '과정(Process)'이라 부른다.27 반면, 큰 음정의 도약(Gap)이 발생할 경우, 이는 구조적인 결핍이나 긴장을 유발하며 청취자는 본능적으로 선율이 도약했던 반대 방향으로 되돌아와 생략된 음역을 채워주기(Fill)를 기대하게 된다.26

이러한 인지적 반작용, 즉 '역전(Reversal)'의 개념은 대형 언어 모델의 토큰 생성 규칙으로 명시화되어야 한다.27 구체적으로, 선율이 한동안 계단식으로 상승하는 순차 진행을 지속했다면, 프롬프트는 모델에게 그 반대 방향인 하행 도약을 수행하도록 지시해야 한다.23 역으로, 모델이 선율선 내에서 완전 4도를 초과하는 넓은 도약을 생성했다면, 반드시 그 직후의 음표는 도약한 방향의 반대 방향으로 전환되어야 하며 가급적 순차 진행을 통해 음향적 공백을 메우도록 설정해야 한다.23 이 원칙은 단일 선율이 청취자에게 구조적 완결성과 심리적 만족감을 제공하는 데 필수적이다.26 예외적으로, 선율이 단일 화음의 구성음을 연속적으로 연주하는 아르페지오(Arpeggiation) 형태를 띨 경우, 화음 자체가 주는 내재적 안정성 덕분에 갭-필 원칙에 따른 반대 방향의 순차적 해결이 엄격하게 요구되지 않는다.23

### **단일 정점(Single Peak Note) 규칙과 아치형 궤적**

응집력 있고 서사적인 방향성을 지닌 선율은 반드시 구조적인 정점(Climax)을 내포한다. 음악 이론에 따르면, 성공적인 선율은 특정 프레이즈 단위 내에서 가장 높은 피치(Pitch), 즉 최고음(Peak note)이 단 한 번만 등장하도록 통제된다.23 모델이 동일한 최고음을 여러 번 반복해서 생성할 경우, 선율의 긴장감은 분산되고 방향성을 상실하게 된다.

시스템 프롬프트는 선율의 거시적 궤적을 '아치형 윤곽(Arc contour)'으로 설계하도록 지시해야 한다. 이는 선율이 비교적 낮은 음역에서 출발하여 서서히 상승하다가 프레이즈의 중간 이후 지점에서 단 한 번의 정점에 도달하고, 다시 점진적으로 하강하여 처음 출발했던 음역대와 유사한 공간을 채우며 마무리되는 형태를 말한다.23 또한 이러한 정점은 마디 내의 약박보다는 강박(Strong beats)에 배치될 때 그 표현적 효과가 극대화된다.23 4/4박자의 경우 첫 번째 박자와 세 번째 박자가 강박에 해당하며, 더 세밀한 하위 분할(Subdivision) 단위에서도 짝수 번째보다는 홀수 번째 분할 위치가 강박적 특성을 지니므로 최고음 배치에 유리하다.23

| 윤곽 제어 규칙 | 시스템 프롬프트 제약 명세 (Prompt Constraints) | 음악적 근거 및 효과 |
| :---- | :---- | :---- |
| **갭-필 (Gap-Fill)** | 도약 진행 후에는 반드시 도약의 반대 방향으로 선율 방향을 전환해야 하며 가급적 순차 진행을 사용할 것.23 | 청취자의 심리적 기대에 부응하고 음역의 공백을 채워 긴장을 해소함.26 |
| **방향 전환 (Direction)** | 3\~4음 이상의 연속적인 순차 상승/하강 후에는 반대 방향의 도약으로 전환할 것.23 | 단조로운 순차 진행의 반복을 깨고 선율의 텍스처에 역동성을 부여함.23 |
| **정점 통제 (Peak Note)** | 하나의 독립적인 프레이즈(보통 4\~8마디) 내에서 최고음은 오직 1회만 등장하도록 설계할 것.23 | 선율의 방향성을 확립하고 구조적 클라이맥스를 강조하여 서사적 흐름을 구축함.23 |
| **강박 배치 (Metrical Accent)** | 선율의 정점 및 주요 윤곽 변화 지점은 마디 내의 강박(Strong beat)에 위치시킬 것.23 | 리듬적 강세와 선율적 강세를 일치시켜 음악의 설득력을 높임.23 |

## **미시적 선율 작법: 음정의 엄격한 제약과 경향음의 해결**

선율 윤곽에 대한 거시적 통제와 더불어, 시스템 프롬프트는 개별 음표 사이의 간격인 음정(Interval)에 대해서도 요한 세바스찬 바흐의 합창곡(Chorales)이나 고전적 대위법 양식에 기반한 엄격한 미시적 제약을 가해야 한다.29 대형 언어 모델은 음표 기호들의 확률적 배열을 생성하므로, 금지된 음정 패턴을 사전에 차단하지 않으면 가창 불가능하거나 불협화음적인 선율을 도출하기 쉽다.29

### **증음정과 감음정의 회피**

서양의 전통적인 선율 작법에서 증음정(Augmented intervals)과 감음정(Diminished intervals)의 직접적인 도약은 철저히 회피되어야 한다.29 예를 들어, 다장조(C Major) 스케일에서 F음에서 B음으로 이동하는 증4도(Tritone) 도약이나, C음에서 F\#음으로의 이동은 청각적으로 매우 불안정하고 조성을 이탈하는 느낌을 준다.29 대위법의 수평적 선율 작성 원칙에 따라 언어 모델은 이러한 불안정한 음정을 선율선에 배치해서는 안 되며, 부득이하게 감음정 도약이 발생했을 경우에는 도약 직후에 반드시 반대 방향으로 순차 진행하여 불협화음을 해결해야 한다는 예외 규칙을 포함해야 한다.29

### **연속 도약의 화성적 스케치**

선율이 순차 진행 없이 연속으로 도약하는 경우, 모델은 이 도약들이 무작위적인 스케일 디그리를 선택하는 것을 방지해야 한다. 선율 내에서 2번 이상의 연속된 도약 진행이 발생할 때, 이 연속된 음표들은 반드시 하나의 장조 또는 단조 3화음(Major or Minor Triad)의 구성음들로만 이루어져야 한다.29 예컨대 C장조 곡에서 C4 \-\> G4 \-\> E5로 이어지는 연속 도약은 C 메이저 트라이어드의 근음, 5음, 3음을 명확하게 스케치하므로 허용된다. 이러한 규칙은 단선율 내에서도 뼈대가 되는 화성적 구조를 청취자에게 명확히 전달하는 데 핵심적인 역할을 한다.

### **경향음(Tendency Tones)의 수평적 해결**

조성 음악(Tonal music)의 단선율에서 특정 스케일 디그리(Scale degrees)는 내재적인 인력, 즉 특정한 방향으로 이동하려는 강한 성질을 지니며 이를 '경향음'이라 부른다.29 대형 언어 모델은 이러한 경향음이 등장했을 때 다음 토큰(음표)을 결정함에 있어 반드시 화성학적 방향성을 준수하도록 통제되어야 한다.

1. **이끎음(Leading Tone, ![][image1]):** 조성을 불문하고 7음은 가장 강한 상행 인력을 가지며, 반드시 반음 위의 으뜸음(![][image2] 혹은 ![][image3])으로 상행 순차 해결되어야 한다.29 단조의 경우 화성 단음계(Harmonic minor)를 사용하여 7음을 반음 올려 이끎음을 명확히 형성하고 으뜸음으로 이끌어야 한다.33  
2. **버금딸림음(Subdominant, ![][image4]):** 4음은 가음음(Mediant, ![][image5])으로 하행 순차 해결하려는 경향을 가진다.29 이 하행 해결은 이끎음의 해결만큼 엄격하지는 않으나, 안정적인 선율의 안착을 위해 권장된다.  
3. **버금가온음(![][image6]) 및 위으뜸음(![][image7]):** 이 두 스케일 디그리 역시 안정적인 코드톤인 5음과 1음으로 각각 하행 순차 진행하여 긴장을 완화하려는 특성을 지닌다.29

시스템 프롬프트 내에 이러한 경향음 해결 규칙을 명시함으로써, 언어 모델이 생성하는 단선율은 단순한 음의 나열을 넘어 조성적 중심(Tonal center)을 확고히 다지는 정교한 흐름을 갖추게 된다.

## **복합 선율(Compound Melody)과 내재적 화성(Implied Harmony)의 알고리즘화**

1성부 악보 제작에 있어 가장 도전적이고 심오한 영역은 단 하나의 선율만으로 완전한 화성 진행(Chord progression)과 다성부적 질감을 암시하는 것이다. 이를 '내재적 화성(Implied Harmony)'이라고 부르며 13, 악보 상으로는 1성부이지만 청각적으로는 2성부 이상의 다성음악(Polyphony)처럼 들리게 하는 기법을 '복합 선율(Compound Melody)' 혹은 '암시적 다성음악(Implied Polyphony)'이라 칭한다.9 바흐의 무반주 첼로 모음곡이나 바이올린 소나타 및 파르티타에서 광범위하게 사용된 이 기법은 단선율 기악곡의 예술적 정점이라 할 수 있다.10 언어 모델이 이러한 고도의 작곡 기법을 모방하기 위해서는 시스템 프롬프트가 단선율을 '표면적 선율(Surface melody)'과 '구조적 화성(Structural harmony)'의 2개 계층으로 나누어 연산하도록 유도해야 한다.

### **아르페지오와 페달 포인트를 통한 다성음악적 환영 구축**

복합 선율은 서로 다른 음역대(Register)에 속한 음들을 빠르게 번갈아 연주함으로써 실현된다.10 첼로와 같은 현악기가 보우(Bow)를 여러 현 사이를 빠르게 넘나들며 연주할 때, 청취자의 인지 체계는 큰 도약으로 연결된 음표들을 연속적인 하나의 흐름으로 인식하지 못하고, 저음역의 음표 그룹과 고음역의 음표 그룹을 각각 독립적인 선율선으로 분리하여 듣게 된다.10

프롬프트 엔지니어링 관점에서 모델은 다음과 같은 생성 전략을 취해야 한다.

1. 먼저 단선율 내에 가상의 베이스 라인(Bass line) 역할을 할 음을 저음역에 고정하거나 느리게 변화하도록 설정한다. 이를 페달 포인트(Pedal point)라 한다.38  
2. 이후 고음역에서 실제 선율적 진행을 담당하는 움직이는 음들을 배치한다.38  
3. 이 두 가지 음역대의 음표들을 16분음표나 8분음표 등 짧은 음가를 사용하여 교대로(Alternating) 배치한다.10 이는 앞서 언급된 '호켓(Hocket)' 혹은 선형 리듬(Linear rhythm) 기법과도 유사한 원리로, 한 대의 악기가 마치 여러 악기가 번갈아 연주하는 듯한 질감을 창출한다.23 결과적으로 악보의 단일 보표 위에는 연속된 음표들이 기보되지만, 음악적으로는 화성을 든든하게 받쳐주는 베이스와 그 위를 노니는 멜로디의 2성부 구조가 완벽하게 암시된다.9

### **구조적 코드톤 배치와 화성 진행의 스케치**

내재적 화성은 단선율이 특정 화음의 구성음을 전략적으로 포진시켜 밑바탕에 흐르는 코드 진행을 연상시킬 때 명확해진다.13 이를 위해 작곡가는 곡의 기초가 되는 화성적 윤곽(Basic Harmonic Outline), 예를 들어 단조의 경우 'i \- iv \- V \- i'와 같은 명확한 가상의 코드 진행을 먼저 설정해야 한다.13

언어 모델은 이 가상의 진행을 스케치하기 위해 박자의 강도(Metric strength)를 활용해야 한다.37 ![][image8] 박자를 기준으로, 가장 강한 강세를 받는 1박자와 3박자(혹은 엇박이 아닌 정박자)에는 반드시 해당 시점에 할당된 가상 화음의 주요 코드톤(근음, 3음, 5음)을 아르페지오 형태로 배치하여 화성의 뼈대를 세운다.13 화음을 가장 강력하게 암시하기 위해서는 하나 이상의 코드톤을 사용하여 3화음의 구조를 스케치해야 하며, 특히 화음의 뿌리가 되는 근음(Root)을 명시적으로 노출시키는 것이 필수적이다.36 반면, 상대적으로 약세에 해당하는 2박자와 4박자, 혹은 박자의 하위 분할 지점(Off-beats)에는 비화성음이나 장식음을 배치하여 화음 사이의 공간을 색채감 있게 연결한다.13 이러한 리듬적 강조와 코드톤의 배치가 결합할 때, 단선율은 단순한 가락을 넘어 스스로 화성적 방향성(Forward momentum)을 지닌 입체적인 음악체로 거듭나게 된다.13

## **화성 리듬(Harmonic Rhythm)의 분배와 운율적 통제**

내재적 화성이 단선율의 공간적 깊이를 구축한다면, 화성 리듬(Harmonic Rhythm)은 음악의 시간적 역동성을 통제한다. 화성 리듬이란 악곡 내에서 화음이 변화하는 속도나 주기, 즉 화음의 지속 시간을 의미한다.41 단선율 악보를 생성할 때 언어 모델은 단순히 음표의 리듬뿐만 아니라, 그 이면에 설정된 가상 화음이 교체되는 주기를 일관성 있게 관리하도록 지시받아야 한다.8 화성 리듬의 분배는 음악의 전반적인 성격과 전진하는 느낌(Forward movement)에 지대한 영향을 미친다.42

대형 언어 모델의 시스템 프롬프트는 화성 리듬에 대해 다음과 같은 구체적인 지침을 명세해야 한다.

1. **박자(Meter)와의 일치성:** 화성이 변화하는 지점은 곡의 메트릭 구조를 명확히 정의하는 데 도움을 주어야 한다. 따라서 가상의 코드가 교체되는 순간은 약박이나 업비트보다는 강박(Downbeats)에 일치하도록 설계되어야 한다.41 으뜸화음(Tonic)의 경우 딸림화음(Dominant)보다 강박에 위치하는 빈도가 높아야 구조적 안정을 확보할 수 있다.41  
2. **템포(Tempo)와의 상관관계:** 화성 리듬은 일반적으로 곡의 템포와 반비례하는 경향을 보인다. 즉, 템포가 빠른 곡에서는 하나의 코드가 여러 마디에 걸쳐 유지되는 느린 화성 리듬이 어울리며, 템포가 느린 곡에서는 한 마디 안에서도 코드가 자주 바뀌는 빠른 화성 리듬이 효과적이다.41  
3. **종지를 향한 가속화:** 프레이즈가 마무리되는 종지(Cadence) 지점에 다가갈수록 화성 리듬의 속도는 가속되는 패턴을 보인다. 앞부분에서 한 마디에 하나의 화성이 부여되었다면, 종지 직전에는 한 마디 안에 두 개 또는 네 개의 화성이 조밀하게 전환되면서 곡의 결론을 향한 추진력을 극대화해야 한다.41 대조적인 화성 리듬의 배치는 청취자에게 강렬한 음악적 경험을 제공하는 데 기여한다.43

## **비화성음(Non-Harmonic Tones)의 알고리즘적 분류 및 엄격한 해결 규칙**

화성학적 분석에 있어 비화성음, 혹은 장식음(Embellishing tones)은 현재 배경에 지속되고 있는 화음의 구성음(Chord tones)이 아닌 피치를 의미한다.40 단선율 환경에서 비화성음은 자칫 건조해질 수 있는 아르페지오 구조 사이에 삽입되어 멜로디에 부드러운 순차 진행을 유도하고, 음악적 텍스처에 긴장감과 색채감을 불어넣는 핵심적인 역할을 수행한다.13

그러나 대형 언어 모델이 비화성음을 무분별하거나 확률적으로만 도입하게 되면, 조성적 맥락이 파괴되어 무조성(Atonal)의 불협화음처럼 들리게 될 위험이 농후하다. 따라서 비화성음의 진입 방식(Approach)과 긴장을 해소하는 해결 방식(Resolution)은 수학적 알고리즘 수준으로 엄격하게 통제되어 시스템 프롬프트 내에 조건문 형태로 명시되어야 한다.40 비화성음은 메트릭 강세에 따라 강박에 위치하는 악센트 있는 비화성음(Accented)과 약박에 위치하는 비화성음(Unaccented)으로 세분화된다.40

시스템 프롬프트가 통제해야 할 필수적인 비화성음의 분류와 그 알고리즘적 이동 규칙은 다음과 같다.40

| 비화성음 명칭 | 접근 방식 (Approach) | 해결 방식 (Resolution) | 메트릭 위치 성향 및 특징 |
| :---- | :---- | :---- | :---- |
| **경과음 (Passing Tone, PT)** | 이전 코드톤으로부터 **순차 진행 (Step)** | 접근한 방향과 **동일한 방향으로 순차 진행**하여 다음 코드톤에 도달.40 | 약박 (Unaccented). 두 코드톤 사이의 도약 공간을 부드럽게 메워주는 가장 기본적인 장식음.45 |
| **보조음 (Neighbor Tone, NT)** | 이전 코드톤으로부터 **순차 진행 (Step)** | 접근한 방향과 **반대 방향으로 순차 진행**하여 원래의 코드톤으로 복귀.40 | 약박 (Unaccented). 동일한 음표 사이에 위치하여 일시적인 흔들림을 줌.44 |
| **전타음 (Appoggiatura, App.)** | 이전 코드톤으로부터 **도약 진행 (Leap)** | 도약한 방향의 **반대 방향으로 순차 진행**하여 해결.40 | 강박 (Accented). 강박에 불협화를 발생시킨 후 순차 해결하여 짙은 감정적 표현을 만들어냄.44 |
| **에샤페 / 도피음 (Escape Tone, ET)** | 이전 코드톤으로부터 **순차 진행 (Step)** | 순차 진행한 방향의 **반대 방향으로 도약 진행**하여 해결.40 | 약박 (Unaccented). 두 화음 사이에서 발생하며, 프랑스어 echappée에서 유래.44 |
| **계류음 (Suspension, Sus.)** | 이전 화음의 음을 **동일하게 유지 (Same note)** | 화음이 바뀐 후 **아래로 순차 진행 (Step down)** 하여 해결.40 | 강박 (Accented). 화음 전환 시 기존 음을 지연시켜 강한 긴장감을 유발함.40 |
| **선행음 (Anticipation, Ant.)** | 현재 화음에서 **순차 진행 (Step)** 으로 진입 | 다음 화음으로 전환될 때 **동일 음 유지 (Same note)**.40 | 약박 (Unaccented). 다음 화음에 등장할 음을 미리 연주하여 기대감을 고조시킴.40 |
| **지연음 (Retardation, Ret.)** | 이전 화음의 음을 **동일하게 유지 (Same note)** | 화음이 바뀐 후 **위로 순차 진행 (Step up)** 하여 해결.40 | 강박 (Accented). 계류음과 유사하나 상행 해결된다는 점이 다름.40 |

언어 모델은 단선율의 약박에 음표를 생성할 때, 반드시 주변 코드톤과의 관계를 연산하여 위의 표에 명시된 엄격한 진입 및 해결 방향 규칙 중 하나를 만족하도록 스스로 교정(Self-Correction)해야 한다. 이러한 명시적 통제는 선율의 수평적 유려함과 수직적 타당성을 동시에 확보하는 결정적 기제이다.

## **단선율 환경에서의 선율적 종지(Melodic Cadences) 공식**

음악 언어에서 프레이즈(Phrase)의 끝을 맺는 종지(Cadence)는 문장의 마침표나 쉼표와 같은 구두점 역할을 하며, 화성적 안착과 함께 청취자에게 음악적 구조를 이해할 수 있는 인지적 여유를 제공한다.34 전통적인 다성음악에서는 여러 성부가 화음을 구성하여 V-I(딸림화음-으뜸화음) 등의 진행을 형성하지만, 단일 선율만 존재하는 환경에서는 화음의 수직적 울림이 불가능하다. 따라서 단선율에서는 스케일 디그리(Scale Degrees, 음계의 각 음)의 수평적인 궤적을 통해 화성적 종지를 간접적으로 암시하는 '선율적 종지(Melodic Cadence)' 공식을 사용해야 한다.49

### **단선율 종지 형성을 위한 스케일 디그리 궤적**

단선율에서 가장 완벽하고 강력한 종결감을 부여하기 위해서는 선율의 최종 도착지가 반드시 해당 조성의 으뜸음(Tonic, ![][image3])이어야 한다.34 그리고 이 으뜸음으로 향하는 접근 방식은 대위법적 해결 원칙에 기반해야 한다.35

1. **하행 접근법 (![][image9]):** 선율이 위으뜸음(Supertonic, ![][image7])에서 으뜸음(![][image3])으로 순차 하행하며 도달하는 방식이다. 음정이 아래로 떨어지는 하행 운동은 청각적 긴장을 이완시키고 평온함을 부여하므로 종지를 형성하는 데 가장 자연스럽고 강력한 선택지이다.35  
2. **상행 접근법 (![][image10]):** 앞서 논의된 경향음 규칙에 따라, 이끎음(Leading Tone, ![][image1])이 지닌 강한 상행 인력을 활용하여 으뜸음(![][image3])으로 반음 상행 해결하는 방식이다.35 이끎음은 딸림화음(V)의 3음 역할을 하므로, 이를 거쳐 으뜸음으로 이동하는 것은 청취자에게 V-I의 화성 진행을 명확하게 각인시킨다.29

가장 이상적인 선율적 종지는 단일 성부 안에서 이 두 가지 접근 방식을 교묘하게 엮어내는 것이다. 예를 들어, 종지 직전 마디에서 선율이 $\\hat{2} \\rightarrow \\hat{1}$의 흐름과 $\\hat{7} \\rightarrow \\hat{1}$의 흐름을 복합 선율적으로 암시한 후 최종 으뜸음에 안착할 때, 가장 설득력 있는 정격 종지가 완성된다.35

### **주요 종지 유형의 단선율적 시뮬레이션**

대형 언어 모델은 전체 곡의 구조적 요구 사항에 따라 각 프레이즈의 끝에 다음과 같은 네 가지 서양 음악의 기본 종지 유형을 스케일 디그리의 조작을 통해 시뮬레이션하도록 지시받아야 한다.48

| 종지 유형 | 가상 화성 진행 | 단선율 환경에서의 선율 스케치 전략 (Scale Degree Formula) | 심리적 효과 |
| :---- | :---- | :---- | :---- |
| **완전 정격 종지 (PAC)** | V ![][image11] I | 선율의 마지막 음이 반드시 조성의 으뜸음(![][image3])이어야 하며, 직전 음표는 ![][image1] 이나 ![][image7] 로서 순차 해결해야 함.34 | 완벽한 마침표. 강한 종결감 및 조성의 확립.34 |
| **반종지 (Half Cadence, HC)** | Any ![][image11] V | 선율이 으뜸음이 아닌 딸림화음의 구성음(주로 ![][image12] 혹은 ![][image7], ![][image1])에서 긴 페르마타나 쉼표를 동반하며 일시 정지함.48 | 쉼표나 물음표. 불안정하게 열린 결말로 다음 프레이즈를 강하게 요구함.50 |
| **거짓 종지 (Deceptive Cadence, DC)** | V ![][image11] vi | 청취자가 ![][image3] 로의 정격 종지를 예상할 타이밍에, 선율이 ![][image6] 이나 ![][image5] 등 하모닉 마이너의 의외의 코드톤으로 도약 또는 안착함.48 | 예상의 배반. 구조적 놀라움을 주며 음악적 서사를 확장함.48 |
| **변격 종지 (Plagal Cadence, PC)** | IV ![][image11] I | 선율이 ![][image13] 혹은 ![][image14] 로 순차 하행하며 화성의 윤곽을 그림. (흔히 '아멘 종지'로 불림).48 | 부드러운 여운. 정격 종지 이후에 부가적으로 사용되어 성스러운 결론을 내림.50 |

프롬프트는 프레이즈의 연속성을 위해 "첫 번째 프레이즈는 반종지로 불안정하게 닫고, 뒤따르는 두 번째 프레이즈는 완전 정격 종지로 강하게 닫아라"는 식의 구체적인 종지 페어링(Pairing) 지침을 포함해야 한다.51

## **거시적 선율 형식론: 센텐스(Sentence)와 피리어드(Period) 아키텍처**

우수한 단선율은 작은 동기(Motif)들의 무작위적인 집합이 아니라, 논리적이고 예측 가능한 거시적 형식 구조 위에 축조된다.1 서양 고전 양식(Classical style)에서 악곡의 기본 단위가 되는 테마를 구성하는 가장 핵심적인 두 가지 아키텍처는 센텐스(Sentence)와 피리어드(Period)이다.54 시스템 프롬프트는 8마디 분량의 기본 1성부 악보를 생성할 때, 모델이 이 두 가지 구조 중 하나를 명시적으로 선택하여 뼈대로 삼도록 강제해야 한다. 이는 모델이 부분적인 마디 생성에 매몰되지 않고 전체적인 곡의 응집력과 전개를 파악하는 서사적 통찰을 갖게 한다.53

### **센텐스 형식 (Sentence Form)**

센텐스 구조는 전형적으로 8마디 분량이며, '짧은-짧은-긴' 비율(![][image15])의 동력학적 진행을 특징으로 한다.55 이 구조는 동기의 강렬한 제시와 그에 이은 긴장감 넘치는 발전 과정을 그려낸다.

* **제시부 (Presentation, 1\~4마디):** 처음 2마디에서 곡의 성격을 결정짓는 '기본 동기(Basic Idea, BI)'가 제시된다. 이 동기는 특징적인 선율 윤곽이나 리듬 패턴을 지닌다.55 이어지는 2마디에서는 이 기본 동기가 동일하게 반복되거나, 코드 진행에 맞게 약간 변형되어(Varied repetition) 재등장한다.55 이 구간에서 화성적 배경은 주로 으뜸화음(Tonic prolongation) 주위에 머무르며 안정감을 준다.55  
* **전개부 (Continuation, 5\~8마디):** 나머지 4마디의 긴 구간으로, 제시된 동기가 해체되거나 조각나는 '단편화(Fragmentation)' 과정을 거친다.55 화성 리듬이 가속화(Acceleration)되고 멜로디의 운동성이 증가하며 긴장이 고조되다가, 마지막 마디에서 강력한 정격 종지(PAC)로 도달하며 문장을 맺는다.55 센텐스는 중간에 끊어지는 종지 없이 하나의 거대한 파도처럼 밀고 나가는 성격을 띤다.57

### **피리어드 형식 (Period Form)**

피리어드 구조 역시 전형적으로 8마디로 구성되지만, 4마디 단위의 두 프레이즈가 질문과 대답, 혹은 열림과 닫힘의 대칭적 관계를 맺는다는 점이 특징이다.52

* **전악절 (Antecedent Phrase, 1\~4마디):** 처음 2마디에 기본 동기(BI)가 제시되고, 이어지는 2마디에 이와는 다른 성격의 '대조 동기(Contrasting Idea, CI)'가 등장한다.55 전악절의 끝은 화성적 불안정성을 남기는 '반종지(HC)'나 '불완전 정격 종지(IAC)'로 마무리되어, 청취자로 하여금 다음 프레이즈를 기다리게 만든다.52  
* **후악절 (Consequent Phrase, 5\~8마디):** 전악절과 동일한 기본 동기(BI)로 다시 시작하여 구조적 통일성을 부여한다.55 하지만 후반부의 대조 동기는 변형되거나 새로운 흐름을 타면서, 마침내 강한 완결성을 지닌 '완전 정격 종지(PAC)'로 악절을 닫으며 질문에 대한 완벽한 해답을 제시한다.52

| 비교 항목 | 센텐스 (Sentence Form) | 피리어드 (Period Form) |
| :---- | :---- | :---- |
| **비율 및 구조** | **![][image15]** 마디 (제시부 \+ 전개부) | ![][image16] 마디 (전악절 \+ 후악절 대칭) |
| **동기 발전 방식** | 기본 동기(BI)의 즉각적인 반복 후, 파편화(Fragmentation) 및 리듬 가속 | 기본 동기(BI) ![][image11] 대조 동기(CI), 이후 기본 동기의 재등장 |
| **종지의 배치** | 프레이즈의 맨 끝(8마디째)에 단 한 번의 강력한 종지 발생 | 4마디째에 약한 종지(HC/IAC), 8마디째에 강한 종지(PAC) 발생 |
| **서사적 특성** | 점진적인 긴장 고조와 맹렬한 추진력 | 질문과 대답의 균형 잡히고 안정된 형식미 |

시스템 프롬프트는 곡을 생성하기 전 계획(Planning) 단계에서 모델이 이 두 가지 거시적 구조 중 하나를 선택하고, 각 마디별로 동기가 어떻게 전개될 것인지를 사전에 스케치하는 연쇄 추론(Chain of thought) 과정을 수행하도록 지시해야 한다.15

## **대형 언어 모델 프롬프트 엔지니어링: 시스템 통제 아키텍처**

지금까지 논의된 고도의 서양 음악 이론, 대위법적 금기 사항, 비화성음 통제 규칙, 그리고 프레이즈 아키텍처를 대형 언어 모델이 온전히 이해하고 실행에 옮기기 위해서는, 고도로 구조화된 프롬프트 엔지니어링(Prompt Engineering) 기법이 적용되어야 한다.14 자연어 처리 및 지시어 최적화 이론에 따르면, 단순히 규칙을 나열하는 것만으로는 충분하지 않으며 모델의 행동을 제약하고 논리적 추론을 유도하는 '시스템 프롬프트 아키텍처'를 설계해야 한다.14

### **1\. 페르소나 및 역할의 구체화 (Role & Boundaries)**

프롬프트의 서두에는 언어 모델의 전문성을 극대화하기 위한 페르소나(Persona)를 명시해야 한다.15 "당신은 요한 세바스찬 바흐의 대위법과 첼로 모음곡에 정통한 수석 작곡가 AI입니다"와 같이 명확한 정체성을 부여하면, 모델은 학습 데이터의 거대한 잠재 공간(Latent space) 내에서 대중음악이나 무작위적인 음표의 확률 분포를 배제하고 서양 고전 음악의 엄격한 문법을 활성화하는 데 집중하게 된다.61

### **2\. 단계적 추론과 마크다운 포맷팅 (Workflow Policy & Output Format)**

복잡한 음악을 생성할 때 언어 모델에게 즉시 악보의 텍스트 결과를 내놓으라고 지시하면 할루시네이션이 발생할 확률이 기하급수적으로 증가한다.15 따라서 프롬프트는 '작업 흐름 정책(Workflow policy)'을 강제해야 한다.15 모델은 최종 악보를 출력하기 전에 반드시 1\) 악곡의 거시적 구조 기획(Structural Planning), 2\) 마디별 내재적 화성 진행 스케치, 3\) 선율 제약 조건(음정, 비화성음)의 자체 검증 과정을 거치도록 설계되어야 한다.15

이러한 단계적 사고 과정은 사용자의 가독성과 시스템 파싱을 위해 마크다운 헤더(\#\#)를 사용하여 명확히 섹션을 구분하도록 지시받아야 한다.15 예를 들어 "결과물은 반드시 \#\# 1\. 구조 스케치, \#\# 2\. 규칙 검증, \#\# 3\. 최종 ABC 기보법 형식으로 출력하라"고 구문 형식을 제약하면, 출력의 일관성과 신뢰성이 크게 향상된다.22

### **3\. 명시적 한계 설정과 우선순위 규정 (Instruction Hierarchy & Constraints)**

프롬프트 설계 시 수많은 규칙들이 서로 충돌하는 상황(예: 갭-필 원리에 따라 순차 진행을 해야 하지만 해당 위치가 강박이라 코드톤 도약이 필요한 경우)에 대비해 규칙 간의 위계를 설정해야 한다.15 가장 높은 최우선 순위는 '증음정/감음정 도약의 엄격한 배제'와 '각 마디 내 박자 수의 수학적 일치'와 같은 하드 제약(Hard constraints)에 두어야 하며, 선율의 방향성 같은 소프트 제약(Soft constraints)은 그 하위 개념으로 작동하도록 명시해야 한다.14

또한 "멋진 멜로디를 만들어라"와 같은 모호한 지시는 배제하고 62, 부정어(Negative constraint)를 전략적으로 활용하여 "어떠한 경우에도 증4도 도약을 허용해서는 안 된다", "마디당 박자가 M 헤더와 다르면 절대 안 된다"와 같이 허용되지 않는 행동의 경계를 단호하게 설정해야 한다.14

## **종합 시스템 프롬프트 아키텍처 제시 (Final System Prompt Architecture)**

상술한 서양 음악 이론의 심층적 분석, 내재적 화성의 알고리즘, 거시적 형식론, 그리고 프롬프트 엔지니어링 최적화 기법을 완벽하게 융합하여, 1성부 악보 제작을 위한 대형 언어 모델용 시스템 프롬프트를 아래와 같이 도출하였다. 이 프롬프트는 복사하여 AI 에이전트의 시스템 지시어(System Instructions) 환경에 즉시 적용할 수 있도록 마크다운 문법으로 최적화되어 있다.

# **ROLE AND PERSONA (역할 및 페르소나 정의)**

당신은 서양 고전 음악 이론, 요한 세바스찬 바흐의 복합 선율(Compound Melody) 작법, 그리고 엄격한 대위법의 수평적 규칙에 완벽히 정통한 수석 음악 이론가 겸 작곡가 AI입니다. 당신의 유일한 목표는 사용자의 요청에 따라 완벽한 이론적 정합성을 갖춘 단선율(1성부, Monophony) 악보를 'ABC 기보법(ABC Notation)' 포맷으로 정교하게 생성하는 것입니다. 당신의 출력물은 인간 최고 수준의 작곡가들과 구별할 수 없을 만큼 음악적 서사와 화성적 깊이를 지녀야 합니다.

# **WORKFLOW POLICY (작업 절차 및 출력 포맷 강제)**

할루시네이션(오류)을 방지하기 위해, 최종 악보를 즉시 생성하지 말고 반드시 아래의 세 가지 단계(마크다운 헤더 사용)를 거쳐 논리적 추론(Chain-of-thought)을 시각화하십시오.

## **1\. Structural & Harmonic Planning (거시적 구조 및 내재적 화성 기획)**

* 곡의 마디 수에 따른 형식(Sentence 또는 Period) 선택 및 이유.  
* 각 마디를 지배할 가상의 뼈대 화성 진행(예: i \- iv \- V \- i) 스케치.

## **2\. Melodic Constraint Verification (선율 제약 조건 검증 계획)**

* 각 마디의 강박에 어떤 코드톤을 배치할 것인지, 갭-필 원리를 어떻게 적용할 것인지 서술.  
* 비화성음 처리 계획 명시.

## **3\. ABC Notation Output (최종 악보 생성)**

* 오직 유효한 ABC 기보법 문법만을 사용하여 악보를 작성하며, 코드 블록 abc로 감쌀 것.

# **RULE 1: MACRO FORM AND PHRASING (거시적 형식과 프레이즈 통제)**

단선율은 무작위적인 음표의 나열이 되어서는 안 되며, 8마디 분량을 기준으로 다음 중 하나의 구조 아키텍처를 엄격히 준수하십시오.

* Sentence Form (8마디): '제시부(1\~4마디) \+ 전개부(5\~8마디)' 구성. 2마디의 기본 동기(BI) 제시, 2마디의 동기 변형 반복. 이후 4마디에 걸쳐 동기를 단편화(Fragmentation)하고 화성 리듬을 가속하여 마지막 8마디째에 단 한 번의 강력한 정격 종지(PAC)로 도달하십시오.  
* Period Form (8마디): '전악절(1\~4마디) \+ 후악절(5\~8마디)' 구성. 두 악절은 동일한 기본 동기로 시작해야 합니다. 전악절의 끝(4마디째)은 반종지(HC)나 불완전 정격 종지(IAC)로 불안정하게 열어두고, 후악절의 끝(8마디째)은 완전 정격 종지(PAC)로 강하게 닫으십시오.

# **RULE 2: IMPLIED HARMONY & COMPOUND MELODY (내재적 화성과 복합 선율)**

반주 악기가 없으므로 단일 선율 자체가 두 개 이상의 성부(다성음악)를 암시하도록 설계해야 합니다.

* Harmonic Rhythm (화성 리듬): 가상의 코드는 반드시 마디의 강박(Downbeats)에서 변경되도록 설계하십시오. 종지에 접근할수록 화성 리듬의 주기를 짧게(가속) 하십시오.  
* Compound Melody (복합 선율): 넓은 음역대를 활용하여, 베이스 역할을 하는 낮은 음역의 '페달 포인트(Pedal point)'와 멜로디 역할을 하는 높은 음역의 '순차 진행' 음표들을 8분음표나 16분음표 단위로 빠르게 교대(Alternating)시켜 다성부적 환영을 구축하십시오.  
* Structural Tones: 마디 내의 가장 강력한 박자(예: 4/4박자의 1박과 3박)에는 반드시 배경에 설정된 가상 화음의 근음(Root), 3음, 5음을 도약이나 아르페지오로 배치하여 화성의 윤곽을 뚜렷이 스케치하십시오.

# **RULE 3: MELODIC CONTOUR & INTERVAL CONSTRAINTS (윤곽 및 음정의 엄격한 제약)**

선율의 궤적과 음정 간격에 대해 다음의 하드 제약(Hard constraints)을 수학적으로 완벽히 준수하십시오.

* Single Peak Note: 독립된 프레이즈(4마디 또는 8마디 단위) 내에서 선율의 가장 높은 피치(Peak note)는 단 한 번만 등장해야 하며, 아치형 궤적을 그리도록 강박에 위치시키십시오.  
* Gap-Fill Principle: 두 음 사이의 간격이 완전 4도를 초과하는 큰 도약(Gap)이 발생했다면, 그 직후의 음표는 반드시 도약했던 방향의 반대 방향으로 전환해야 하며 가급적 순차 진행(Step)으로 빈 공간을 채우십시오(Fill).  
* Forbidden Intervals: 어떠한 경우에도 증음정(Augmented intervals, 예: 증4도)과 감음정(Diminished intervals, 예: 감5도)의 직접적인 도약 진행을 허용하지 마십시오.  
* Consecutive Leaps: 2번 이상의 연속된 도약 진행이 등장할 경우, 해당 음표들은 무작위가 아니라 반드시 특정 장/단 3화음(Triad)의 구성음만을 뼈대로 삼아야 합니다.

# **RULE 4: NON-HARMONIC TONES & CADENCES (비화성음 통제와 선율적 종지)**

* Non-Harmonic Tones: 약박에 삽입되는 비화성음은 대위법의 해결 규칙을 따르십시오. 경과음(PT)은 순차 도입 후 같은 방향으로 순차 해결, 보조음(NT)은 순차 도입 후 반대 방향으로 복귀해야 합니다. 계류음이나 전타음의 긴장-이완 패턴을 적절히 활용하여 색채감을 더하십시오.  
* Tendency Tones: 이끎음(Scale degree 7)이 등장하면 반드시 다음 음은 으뜸음(Scale degree 8/1)으로 반음 상행 순차 해결하십시오.  
* Melodic Cadences: 완전 정격 종지(PAC)를 형성할 때, 화음을 쌓을 수 없으므로 선율의 흐름이 위으뜸음에서 으뜸음으로 하행(Scale Degree 2 \-\> 1)하거나 이끎음에서 으뜸음으로 상행(Scale Degree 7 \-\> 1)하여 종결지에 완벽히 안착하도록 조작하십시오.

# **FINAL OUTPUT VALIDATION (최종 검증 프로토콜)**

ABC 기보법의 헤더(Header)를 먼저 정의하십시오. X: (번호), T: (제목), M: (박자표), L: (기본 음가), K: (조성)를 정확히 명시해야 합니다. 출력 전 가장 중요한 단계로서, M: 헤더에서 정의한 박자(예: 4/4)와 바디 영역의 각 마디(|와 | 사이)에 들어간 음표 길이의 수학적 총합이 소수점 단위까지 완벽하게 일치하는지 백그라운드에서 검증하고 교정하십시오.

## **결론**

완성도 높은 1성부 악보를 생성하는 작업은 인공지능 음악 생성 분야에서 모델의 추론 능력과 기호적 통제력을 가늠하는 가장 가혹한 시험대 중 하나이다.2 본 보고서는 대형 언어 모델이 단순한 패턴 모방을 넘어, 연역적인 음악 이론 제약 규칙 안에서 작동할 수 있도록 심층적인 프롬프트 아키텍처를 설계하였다.1 마이어(Meyer)와 게슈탈트 심리학에 기반한 인지적 갭-필(Gap-Fill) 원리와 단일 정점 통제는 선율에 유려한 방향성을 부여하며 23, 연속 도약 및 금지 음정에 대한 대위법적 차단은 선율의 가창 가능성을 보장한다.29 나아가 바흐의 작법에서 추출된 페달 포인트와 아르페지오의 알고리즘적 교차 배치는 1성부라는 공간적 한계를 깨고 입체적인 내재적 화성의 환영을 성공적으로 구축한다.11

여기에 센텐스와 피리어드라는 거시적 형태론을 강제하고 56, ABC 기보법 기반의 마크다운 추론 프로세스를 도입함으로써 17, 언어 모델은 할루시네이션이나 구조적 붕괴 없이 이론적으로 무결하고 미학적으로 심오한 단선율을 생성해 낼 수 있다. 이러한 다학제적이고 융합적인 프롬프트 엔지니어링 접근 방식은 향후 AI 기반의 전문 작곡 도구 개발뿐만 아니라, 컴퓨터 음악 정보 검색(Music Information Retrieval) 및 자동화된 음악 분석 시스템에서 대형 언어 모델의 활용성을 극한으로 끌어올리는 핵심 기반 기술이 될 것이다.2

#### **참고 자료**

1. From Tools to Creators: A Review on the Development and Application of Artificial Intelligence Music Generation \- MDPI, 3월 30, 2026에 액세스, [https://www.mdpi.com/2078-2489/16/8/656](https://www.mdpi.com/2078-2489/16/8/656)  
2. Large Language Models' Internal Perception of Symbolic Music \- arXiv, 3월 30, 2026에 액세스, [https://arxiv.org/html/2507.12808v1](https://arxiv.org/html/2507.12808v1)  
3. A Survey of Music Generation in the Context of Interaction \- arXiv, 3월 30, 2026에 액세스, [https://arxiv.org/html/2402.15294v1](https://arxiv.org/html/2402.15294v1)  
4. Various Artificial Intelligence Techniques For Automated Melody Generation – IJERT, 3월 30, 2026에 액세스, [https://www.ijert.org/various-artificial-intelligence-techniques-for-automated-melody-generation](https://www.ijert.org/various-artificial-intelligence-techniques-for-automated-melody-generation)  
5. ChatMusician: Understanding and Generating Music Intrinsically with LLMs \- ACL Anthology, 3월 30, 2026에 액세스, [https://aclanthology.org/2024.findings-acl.373.pdf](https://aclanthology.org/2024.findings-acl.373.pdf)  
6. Texture – Open Music Theory \- VIVA's Pressbooks, 3월 30, 2026에 액세스, [https://viva.pressbooks.pub/openmusictheory/chapter/texture/](https://viva.pressbooks.pub/openmusictheory/chapter/texture/)  
7. Monophony: AP Music Theory Study Guide | Fiveable, 3월 30, 2026에 액세스, [https://fiveable.me/ap-music-theory/key-terms/monophony](https://fiveable.me/ap-music-theory/key-terms/monophony)  
8. Musical Terms and Concepts | SUNY Potsdam, 3월 30, 2026에 액세스, [https://www.potsdam.edu/academics/Crane/MusicTheory/Musical-Terms-and-Concepts](https://www.potsdam.edu/academics/Crane/MusicTheory/Musical-Terms-and-Concepts)  
9. Dance and Its Importance in Bach's Suites for Solo Cello \- Cedarville Digital Commons, 3월 30, 2026에 액세스, [https://digitalcommons.cedarville.edu/cgi/viewcontent.cgi?article=1016\&context=musicalofferings](https://digitalcommons.cedarville.edu/cgi/viewcontent.cgi?article=1016&context=musicalofferings)  
10. A new light on the polyphonic nature of Bach's Cello Suites, Sonatas and Partitas for Solo Violin | The Strad, 3월 30, 2026에 액세스, [https://www.thestrad.com/playing-hub/a-new-light-on-the-polyphonic-nature-of-bachs-cello-suites-sonatas-and-partitas-for-solo-violin/18295.article](https://www.thestrad.com/playing-hub/a-new-light-on-the-polyphonic-nature-of-bachs-cello-suites-sonatas-and-partitas-for-solo-violin/18295.article)  
11. Notation and Compound Melody \- Bach Sonatas and Partitas, 3월 30, 2026에 액세스, [https://www.sonatasandpartitas.com/articles/?selected=article\_detail\&id=41\&nomenu=t\&resultpage=1](https://www.sonatasandpartitas.com/articles/?selected=article_detail&id=41&nomenu=t&resultpage=1)  
12. The Archaeologist's Paradise: Digging Through Solo- Polyphonic Ambiguity in the Counterpoint Classroom \- Beaman Library's Carolyn Wilson Digital Collections at Lipscomb University, 3월 30, 2026에 액세스, [https://digitalcollections.lipscomb.edu/cgi/viewcontent.cgi?article=1176\&context=jmtp](https://digitalcollections.lipscomb.edu/cgi/viewcontent.cgi?article=1176&context=jmtp)  
13. Implied Harmony Techniques: Create Dynamic Solo Melodies ..., 3월 30, 2026에 액세스, [https://fisound.com/pages/implied-harmony-melodic-techniques-guide](https://fisound.com/pages/implied-harmony-melodic-techniques-guide)  
14. System Prompts: Design Patterns and Best Practices \- Tetrate, 3월 30, 2026에 액세스, [https://tetrate.io/learn/ai/system-prompts-guide](https://tetrate.io/learn/ai/system-prompts-guide)  
15. Guide to Writing System Prompts: The Hidden Force Behind Every AI Interaction \- Sahara AI, 3월 30, 2026에 액세스, [https://saharaai.com/blog/writing-ai-system-prompts](https://saharaai.com/blog/writing-ai-system-prompts)  
16. ABC-Eval: Benchmarking Large Language Models on Symbolic Music Understanding and Instruction Following \- arXiv, 3월 30, 2026에 액세스, [https://arxiv.org/html/2509.23350v1](https://arxiv.org/html/2509.23350v1)  
17. EMelodyGen: Emotion-Conditioned Melody Generation in ABC Notation with the Musical Feature Template \- arXiv, 3월 30, 2026에 액세스, [https://arxiv.org/html/2309.13259v2](https://arxiv.org/html/2309.13259v2)  
18. Automated Music Composition with a Large Language Model – An Exploration \- OrchestrAI, 3월 30, 2026에 액세스, [https://www.orchestrai.site/Article.pdf](https://www.orchestrai.site/Article.pdf)  
19. AI-Tunes: Creating New Songs with Artificial Intelligence | Towards Data Science, 3월 30, 2026에 액세스, [https://towardsdatascience.com/ai-tunes-creating-new-songs-with-artificial-intelligence-4fb383218146/](https://towardsdatascience.com/ai-tunes-creating-new-songs-with-artificial-intelligence-4fb383218146/)  
20. NOTA: Multimodal Music Notation Understanding for Visual Large Language Model \- arXiv, 3월 30, 2026에 액세스, [https://arxiv.org/html/2502.14893v1](https://arxiv.org/html/2502.14893v1)  
21. Adventures in generating music via ChatGPT text prompts | Holovaty.com, 3월 30, 2026에 액세스, [https://www.holovaty.com/writing/chatgpt-music-generation/](https://www.holovaty.com/writing/chatgpt-music-generation/)  
22. Crafting LLM Prompts for Markdown Header-Organized Outputs | CodeSignal Learn, 3월 30, 2026에 액세스, [https://codesignal.com/learn/courses/journey-into-format-control-in-prompt-engineering-1/lessons/crafting-llm-prompts-for-markdown-header-organized-outputs](https://codesignal.com/learn/courses/journey-into-format-control-in-prompt-engineering-1/lessons/crafting-llm-prompts-for-markdown-header-organized-outputs)  
23. Creating Melodies 1: Contour | Making Music book by Ableton, 3월 30, 2026에 액세스, [https://makingmusic.ableton.com/creating-melodies-1-contour](https://makingmusic.ableton.com/creating-melodies-1-contour)  
24. Expectations for Melodic Contours Transcend Pitch \- PMC \- NIH, 3월 30, 2026에 액세스, [https://pmc.ncbi.nlm.nih.gov/articles/PMC4605576/](https://pmc.ncbi.nlm.nih.gov/articles/PMC4605576/)  
25. 5 Key Elements of an Effective AI Music Prompt \- SendFame, 3월 30, 2026에 액세스, [https://sendfame.com/blog/ai-music-prompt](https://sendfame.com/blog/ai-music-prompt)  
26. Questioning a Melodic Archetype: Do Listeners Use Gap-Fill to Classify Melodies? | Request PDF \- ResearchGate, 3월 30, 2026에 액세스, [https://www.researchgate.net/publication/271681259\_Questioning\_a\_Melodic\_Archetype\_Do\_Listeners\_Use\_Gap-Fill\_to\_Classify\_Melodies](https://www.researchgate.net/publication/271681259_Questioning_a_Melodic_Archetype_Do_Listeners_Use_Gap-Fill_to_Classify_Melodies)  
27. 3월 30, 2026에 액세스, [https://mtosmt.org/classic/mto.95.1.6/mto.95.1.6.royal.html](https://mtosmt.org/classic/mto.95.1.6/mto.95.1.6.royal.html)  
28. 6 Schoenberg's 'second melody', or, 'Meyer-ed' in the bass \- William Caplin's Website, 3월 30, 2026에 액세스, [https://williamcaplin.com/download/schoenbergs-second-melody.pdf](https://williamcaplin.com/download/schoenbergs-second-melody.pdf)  
29. Rules of Melody \- Music Theory for the 21st-Century Classroom, 3월 30, 2026에 액세스, [https://musictheory.pugetsound.edu/mt21c/RulesOfMelody.html](https://musictheory.pugetsound.edu/mt21c/RulesOfMelody.html)  
30. What are some rules to follow when writing a melody? : r/Composition \- Reddit, 3월 30, 2026에 액세스, [https://www.reddit.com/r/Composition/comments/en6uv2/what\_are\_some\_rules\_to\_follow\_when\_writing\_a/](https://www.reddit.com/r/Composition/comments/en6uv2/what_are_some_rules_to_follow_when_writing_a/)  
31. Introduction to Species Counterpoint – Open Music Theory \- VIVA's Pressbooks, 3월 30, 2026에 액세스, [https://viva.pressbooks.pub/openmusictheory/chapter/species-counterpoint/](https://viva.pressbooks.pub/openmusictheory/chapter/species-counterpoint/)  
32. Melodic Intervals & Leaps in Songwriting \- Haydock Music, 3월 30, 2026에 액세스, [https://www.haydockmusic.com/composing\_tips/melody\_tips.html](https://www.haydockmusic.com/composing_tips/melody_tips.html)  
33. Scale Degrees \- musictheory.net, 3월 30, 2026에 액세스, [https://www.musictheory.net/lessons/23](https://www.musictheory.net/lessons/23)  
34. Cadence in Music Theory: Defining Endings & Transitions \- Hoffman Academy, 3월 30, 2026에 액세스, [https://www.hoffmanacademy.com/blog/cadence-in-music](https://www.hoffmanacademy.com/blog/cadence-in-music)  
35. Where a V-I perfect authentic cadence comes from, why just chords don't make a cadence, and why it's not something arbitrary : r/musictheory \- Reddit, 3월 30, 2026에 액세스, [https://www.reddit.com/r/musictheory/comments/q9b54x/where\_a\_vi\_perfect\_authentic\_cadence\_comes\_from/](https://www.reddit.com/r/musictheory/comments/q9b54x/where_a_vi_perfect_authentic_cadence_comes_from/)  
36. Implied Harmony \- My Music Theory, 3월 30, 2026에 액세스, [https://mymusictheory.com/composition/implied-harmony/](https://mymusictheory.com/composition/implied-harmony/)  
37. How can harmony be implied by melody \[duplicate\] \- Music Stack Exchange, 3월 30, 2026에 액세스, [https://music.stackexchange.com/questions/131577/how-can-harmony-be-implied-by-melody](https://music.stackexchange.com/questions/131577/how-can-harmony-be-implied-by-melody)  
38. A More Intimate Side of Bach \- A Matter of Music \- WordPress.com, 3월 30, 2026에 액세스, [https://listenlearnanddo.wordpress.com/2013/02/13/a-more-intimate-side-of-bach/](https://listenlearnanddo.wordpress.com/2013/02/13/a-more-intimate-side-of-bach/)  
39. Bach's Cello Suites, Volumes 1 and 2: Analyses and Explorations \- Thecellist.ru, 3월 30, 2026에 액세스, [https://thecellist.ru/wp-content/uploads/2020/04/t-Winold-A.-Bachs-Cello-Suites.-Analyses-and-Explorations.pdf](https://thecellist.ru/wp-content/uploads/2020/04/t-Winold-A.-Bachs-Cello-Suites.-Analyses-and-Explorations.pdf)  
40. Introduction to Non-Chord Tones, 3월 30, 2026에 액세스, [https://musictheory.pugetsound.edu/mt21c/NonChordTonesIntroduction.html](https://musictheory.pugetsound.edu/mt21c/NonChordTonesIntroduction.html)  
41. 6.3 Harmonic Rhythm: Tutorial – Comprehensive Musicianship, A Practical Resource, 3월 30, 2026에 액세스, [https://iastate.pressbooks.pub/comprehensivemusicianship/chapter/6-4-harmonic-rhythm-tutorial/](https://iastate.pressbooks.pub/comprehensivemusicianship/chapter/6-4-harmonic-rhythm-tutorial/)  
42. Harmonic Rhythm Explained (with 15+ examples) | School of Composition, 3월 30, 2026에 액세스, [https://www.schoolofcomposition.com/harmonic-rhythm-explained-with-examples/](https://www.schoolofcomposition.com/harmonic-rhythm-explained-with-examples/)  
43. How to use harmonic rhythm effectively in composition? : r/musictheory \- Reddit, 3월 30, 2026에 액세스, [https://www.reddit.com/r/musictheory/comments/uhnhea/how\_to\_use\_harmonic\_rhythm\_effectively\_in/](https://www.reddit.com/r/musictheory/comments/uhnhea/how_to_use_harmonic_rhythm_effectively_in/)  
44. Nonharmonic Tones \- musictheory.net, 3월 30, 2026에 액세스, [https://www.musictheory.net/lessons/53](https://www.musictheory.net/lessons/53)  
45. 15\. Nonharmonic Tones – Fundamentals, Function, and Form \- Milne Publishing, 3월 30, 2026에 액세스, [https://milnepublishing.geneseo.edu/fundamentals-function-form/chapter/15-nonharmonic-tones/](https://milnepublishing.geneseo.edu/fundamentals-function-form/chapter/15-nonharmonic-tones/)  
46. Non Harmonic Tones? : r/musictheory \- Reddit, 3월 30, 2026에 액세스, [https://www.reddit.com/r/musictheory/comments/1bs8dk/non\_harmonic\_tones/](https://www.reddit.com/r/musictheory/comments/1bs8dk/non_harmonic_tones/)  
47. Non-Harmonic Tones – Music Composition & Theory, 3월 30, 2026에 액세스, [https://open.lib.umn.edu/musiccomposition/chapter/non-harmonic-tones/](https://open.lib.umn.edu/musiccomposition/chapter/non-harmonic-tones/)  
48. Cadences \- Music Theory for the 21st-Century Classroom, 3월 30, 2026에 액세스, [https://musictheory.pugetsound.edu/mt21c/cadences.html](https://musictheory.pugetsound.edu/mt21c/cadences.html)  
49. Music Modes: Major and Minor Modal Scales in Music Theory \- Berklee Online, 3월 30, 2026에 액세스, [https://online.berklee.edu/takenote/music-modes-major-and-minor/](https://online.berklee.edu/takenote/music-modes-major-and-minor/)  
50. Harmonic Direction II: Tonality and Cadences – Composing Music: From Theory to Practice, 3월 30, 2026에 액세스, [https://rwu.pressbooks.pub/musictheory/chapter/harmonic-direction-ii-cadences-and-closes/](https://rwu.pressbooks.pub/musictheory/chapter/harmonic-direction-ii-cadences-and-closes/)  
51. Phrases and Cadences \- musictheory.net, 3월 30, 2026에 액세스, [https://www.musictheory.net/lessons/55](https://www.musictheory.net/lessons/55)  
52. The Period \- Music Theory for the 21st-Century Classroom, 3월 30, 2026에 액세스, [https://musictheory.pugetsound.edu/mt21c/PeriodForm.html](https://musictheory.pugetsound.edu/mt21c/PeriodForm.html)  
53. Motifs, Phrases, and Beyond: The Modelling of Structure in Symbolic Music Generation \- arXiv, 3월 30, 2026에 액세스, [https://arxiv.org/html/2403.07995v1](https://arxiv.org/html/2403.07995v1)  
54. 35\. Sentences and Periods – Fundamentals, Function, and Form \- Milne Publishing, 3월 30, 2026에 액세스, [https://milnepublishing.geneseo.edu/fundamentals-function-form/chapter/35-sentences-and-periods/](https://milnepublishing.geneseo.edu/fundamentals-function-form/chapter/35-sentences-and-periods/)  
55. The period – Open Music Theory \- Elliott Hauser, 3월 30, 2026에 액세스, [https://elliotthauser.com/openmusictheory/period.html](https://elliotthauser.com/openmusictheory/period.html)  
56. 8.2 Sentences and Periods: Tutorial – Comprehensive Musicianship, A Practical Resource, 3월 30, 2026에 액세스, [https://iastate.pressbooks.pub/comprehensivemusicianship/chapter/8-2-sentences-and-periods-tutorial/](https://iastate.pressbooks.pub/comprehensivemusicianship/chapter/8-2-sentences-and-periods-tutorial/)  
57. Sentence and period : r/musictheory \- Reddit, 3월 30, 2026에 액세스, [https://www.reddit.com/r/musictheory/comments/v2pg0y/sentence\_and\_period/](https://www.reddit.com/r/musictheory/comments/v2pg0y/sentence_and_period/)  
58. Overview of prompting strategies | Generative AI on Vertex AI, 3월 30, 2026에 액세스, [https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/prompt-design-strategies](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/prompt-design-strategies)  
59. General Tips for Designing Prompts \- Prompt Engineering Guide, 3월 30, 2026에 액세스, [https://www.promptingguide.ai/introduction/tips](https://www.promptingguide.ai/introduction/tips)  
60. System Prompts in Large Language Models \- PromptEngineering.org, 3월 30, 2026에 액세스, [https://promptengineering.org/system-prompts-in-large-language-models/](https://promptengineering.org/system-prompts-in-large-language-models/)  
61. How to Write a Prompt for AI Music | Advanced Guide, 3월 30, 2026에 액세스, [https://www.imagine.art/blogs/how-to-write-prompt-for-AI-Music](https://www.imagine.art/blogs/how-to-write-prompt-for-AI-Music)  
62. Ensuring Consistent LLM Outputs Using Structured Prompts \- Ubiai, 3월 30, 2026에 액세스, [https://ubiai.tools/ensuring-consistent-llm-outputs-using-structured-prompts-2/](https://ubiai.tools/ensuring-consistent-llm-outputs-using-structured-prompts-2/)  
63. The Complete Guide to Prompting Different AI Models | by Pramida Tumma \- Medium, 3월 30, 2026에 액세스, [https://medium.com/@pramida.tumma/the-complete-guide-to-prompting-different-ai-models-9167a2657490](https://medium.com/@pramida.tumma/the-complete-guide-to-prompting-different-ai-models-9167a2657490)  
64. How to Write Effective Prompts for AI Music Generation \- Soundverse AI, 3월 30, 2026에 액세스, [https://www.soundverse.ai/blog/article/how-to-write-effective-prompts-for-ai-music-generation-1136](https://www.soundverse.ai/blog/article/how-to-write-effective-prompts-for-ai-music-generation-1136)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAVCAYAAAB7R6/OAAAAvUlEQVR4XmNgIBEwQjEzugQIgCRyoHgXEEugShNQADKyAoh7oNgOiLcAsQpMAScQazMg3AACIBOUYQoyGSAmhECxLxDLA7EkSBKkYykQ/8eBCSvgBeKpQKzOADEShqWAuBWkQAyIS0EMNBAExAXogjCgAMSzgJgfTZyBFYpBbvJAkwMDggosofgCEIujyYG9OwWKDwAxD4osEAgC8WkoXogmBwZKQPwcislToA/En6B4DpocGIAcaQzFfDBBAF2NKVfUpNqvAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAZCAYAAAAIcL+IAAAA9klEQVR4XtXSsWoCQRgE4BUVlAiCFiIEYqMgWmlKH0FTaGHhA+QBJFgodpI2kD6ijagIgpAqhZ0Wgu8jAZ05Z82d1cXOga/ZG9bf3TXmhgSkCU9X3y5h4U2WsIBH8cR3sQRtCUMe+hJy9f6XiFQgY/7+nCfPsJIWDOBDOIoT7vJpvMNzp3d50Zr/Yhq2kBWbjrzahRisYS85rX1JwRaZOhxcdlAVTx5gIr9whKHwm5MozKEhCZipTJzTCQ94bM5XZa8rCD35MdrVd7EGIxXcKQtfE0/BFOEbkmLDk6CuXeAt8HlthHfN5zWVuC3apISj8Cc5J91NTuEaMvI5bk3IAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAVCAYAAAB7R6/OAAAAcklEQVR4XmNgIBEwQjEzugQIgCRyoHgXEEugShNQADKyAoh7oNgOiLcAsQpMAScQazMg3AACIBOUYQpgAKQQhGOBWAFZIpkBYu8rKP4KxMYkKeBlgDjUF4oxFMDAqAIIwKkgA4gfAfEXKP4PxO+gYvgBAI7UJtxUKDZPAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAZCAYAAAAIcL+IAAAAsklEQVR4XmNgIAMwQnE4EMujycEBSEEpFG8A4rVALAPFKIBohUZAXAzFrECsCcR1UMyCpI58IMkA8RQI4wQg9zYD8UIoxgmMgfgrAzUUgnwLwg1AvIcBj8IAKI5gQCjCUCjMADEJhDkZ8CjMBGIbKAYBrApVgLicAZEoQACrwjwg3gzEs5DwfSTcAcQCJCnkYYBEGTJejYTFgJgZpBAbwOpGGNCF4itA/BcJH2OAmDp8AABdzjJ85oROEwAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAVCAYAAAB7R6/OAAAA0klEQVR4XpXRMQsBYRzH8UcoSimTnZIMksEmpWw2m8VkMrDgDRiUQcjkPViUkqS8C4uZklJmvv/zv5xbnF996vo/v3vunjtj/oxP+d0LElloqQ3i38s/CrJlHyNVxApJuxBGxnzeQSI7JOyCDAuYqDlq5n2jlTbGiKgYDth6KshgjyvSStLDU69NGR0ElWSBh11wJ4szus5hCjt1wcC8H++94Ix82SmO7gVnqkZPkcMNS4TUVyGPO2YIKEnDc0EG8qvXqKsmThhq2YocqaQqiMrwBYZ4LHCwvd1ZAAAAAElFTkSuQmCC>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAVCAYAAAB7R6/OAAAA3klEQVR4XpXSIWtCYRjF8VfGwpJhE2cTZpkGg1iFxQXzgtG6tqDIqjBksGFYWhE/gGUgrFoE04IIJs02wWTQ//E+F++dwXsP/ODCOTzIi87FTMJc/C8UFc/mF7fh+sxAJ5t4NxX8IOcPrlBwx9+g6MKdP1BU5E0HX867dMglXtEz1867OI88eMIf0kapY6uPJMb4tuIkRazxhrbpY4SyBo/YYYasUR6wiDXoWuEng6U+StigEaoDgxtM0QrVgYGe+BMD5z2YKLq8ijRQUhjiw9QwwYs/UPSfuDdVZ0++Bzf9LirA7AszAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAVCAYAAAB7R6/OAAAAyUlEQVR4XpXQMQtBYRgF4FcospnMKIPBINn8BAtKmW0GFslqNRlM/oPEhL+irBabycA57vnSvV0up5667nvu1+sz+zMxiQcHDAcD2UPOP44o8MgJzKUBOyi6QhrK9t6B4QkFV+DLOixkCW3zPnwNh9CHrNTgBMefCnk4wwwSwnThwYcSXGANKWGqcNOzZSDpfihN0wlh4fZb0w5h+VhwFzWGgwWum4ORrMzbyzfswFTcwhVXaMFGJeI19/QuusBjrub956A7C1/zBOsuKf/6p5pGAAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB0AAAAWCAYAAAA8VJfMAAABK0lEQVR4Xu2VsUsCYRjG36CGMGiRQmi42oI2J4d2oy2EdkVycGiqMQiChJZcHJyD1v6G/pJWFxcdpEGft++pPl7urvdAXPIHP8T7nnvuu8/7TpE1a/4zm/AOlu1AETboNeyYsTRO4L2EcyzurlM6g7dmLI0urNmDxNV1AN/oVHKCZBf2+WlxdW3BHjynH5IRjKjDK3tQCnRdwCas0Myg/P5Wj/DIjCmurkTCzHSGuUFySJ8kPL0xiTi6vpci4ffMYIQuqarLG+PuasEhbNA2HcMXeAa3f9IiO3BA7d50dx1HIVVnpH7aINHtcUMt7i53kCzlopYqTdtb+sTq20ffQupf5HV9UYKvcETncALf4R4z+/BZwmxTZ0w8XW4u6crQ/fgg4W5XRt6/SSEW9JtRw9XlnY4AAAAASUVORK5CYII=>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADEAAAAYCAYAAABTPxXiAAABtUlEQVR4Xu2WTytFQRiHX6EIUSxYKCkLC5F/RcqGIjs7CyxFEjZ2UhaILCgLdpZ8AHXJB7BjYyELZWWp2Ej8fmame+7ce+6Ze5u4HfepZ3HOzGnmnfPOOyMSQ9rhtLbUaisEhrXjsMRq+6ELXsMT7S4sT+nxt0zAC+0ZXBQrkAa4Bxt1A50X9WEh0Aa3YZWWi7sOu4OdYhFEbGB0vbBfW53aXFA0S4b9yslfwlV4rn2HCxJSBX4Rjl8PR+Cp9hE2BTuxQwJ26GezJzbhJxzV731QBqdgnd2QhQq4AmfhgfZJrCB64Bu8ErVpDEPwQ9RHPmFpHLBfOrKmTQuCub8FZyQ1dfpEpZTvIJjPrDRpOe1AaBBhcMV8p5NhUtTCVdoNEfyvIFq0D6IOwKjfznvMcR7ewns4KO44BVErqtTSDYkOIF84zhEck9wumpFBcMKHotLIXK44QE2wkwc4zo6oAzVXsgbBCS9LskKZKsUKtWQ6eYKrP2e/dCQ0CE6YK38j6XmbELUJfcGxWF5b7QZHQoPohK/wK4M87Hjo+YQHqvnTruzDZ1HVknJuL/BOkjeNIkWKxIlvgIFesgKnUrgAAAAASUVORK5CYII=>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADEAAAAYCAYAAABTPxXiAAABlklEQVR4Xu2XvytFYRjHH6FIosiPYlEGg4giFouBbCwMMkpZTBZZERkMBiwsymBVkvwLRCaDMimLXXy/9zzD8Vznnvf+eLun437q0+2+zzn39n3v+z7vuSIppA8uqtWmlgQm1GlYZWoZBuEtPFZ3Ye2vK8rLDLxSL+CqmCCtcA92aIGuSHBjEuiF27BB5eRuwqHwRakIkQqYtNMOJphu+WO/nsLvHLIblAsu7RY4Cc/UFzGTzjV2qcUj452+ZqUukBq4AJttIQd1cA0uwQP1VUyIdgnaKb8gTJsErazLjBcLW+OYHXRkXc0KwUOtMfSes07ZrUZD46WC65mdppBfNzKEZU7dkIhTsQTMwi1Ybwsx/J8Q7ALX6rCpRcHOZRuCi/fwGY6LO04h5uGjylPcF03wEE5Jfg+asSHYnc7hjcrW6wNu6B04YgsOxIbgzD9JcPBRX3D2l+2gI7Eh+F/iQ/yGYKNge+2xBUdiQwzAT3ii+oLLNN+utw/f4JfKR6F3+AD7Q9dlPpjrlMvK56b2SipCVKhQJD8Sv1o6PjxN2wAAAABJRU5ErkJggg==>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAATCAYAAAB2pebxAAAAXElEQVR4XmNgGAWjgDaAFYrZ0CVIATpQXIIuQQqAuaQDiGXR5EgGakDcDcT8IA7IVGcgDiED1wLxaSAeRIaQC/SBuA+IudEliAGcUDyBgYLYMYbicnQJUgBGigUA5sIWPE7bg1gAAAAASUVORK5CYII=>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAVCAYAAAB7R6/OAAAAzUlEQVR4XpXQPwtBURgG8Fcif8qKUgZMlAGLJJOSmJgsJhkMsrAYTBZfw2xhIB/GVyBmnof3xD2Le5/61em8zz2dc0U8xqf89oDhYKJOkHCO/xR45AI2qg57yJpCGPLyvQPDEzKmUIU+pFQSCjA1hTk8LVdoeSosoafKEDBDU+j8bthhYQwrxSeO5PO6d/j1FmKK/2UNZ9eFoFiXQipw54LtGqQdY5ESPLgowg2OEFGOQhwOkNOByVDcFpg27GCgZnCBrikwUWiqBoS4+QIUfSwcLd1scAAAAABJRU5ErkJggg==>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAATCAYAAAAJdPQAAAABIklEQVR4XmNgQAWMUMyMJj7oAMiROVC8C4glUKUHDwCFZAUQ90CxHRBvAWIVZEWDBXACsTYDIhmAAChkleEqBjEAObgAiDPQJQYjGFKOtQXin0Bcji4xmIAMFG8E4q8M1HcsKMa40QXJAaxA3AnF3kD8kIH6jgVl5A4gFoRiskEQECdBsSQDbRwLAhFAHADFZAEFBkiIgkIXhGnpWFDotkKxAZocQQCLfgUkMVIcqwvEISTiBCg+A8SFDCSk42Qgns2AalgqEL8H4qVA7MkACQ1cgK6O1WTANAwUor8ZiHMsqYAHiKdAMchuksCQciw2YMxAm3IWBEDJjqLSAARA6WYFFL8C4v9A/AWIDwOxGJI6SgAoVPsZqFDO0gNQrQYb9AAAHMg6hq7D18UAAAAASUVORK5CYII=>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAATCAYAAAAJdPQAAAABV0lEQVR4XtXWMSiFURQH8CMM8kpC2F6xIFEyWMT4BjIoyqKsFhlIViUpkkwWWZVFKatFsRikTMw2ZTLw/3fP9b53Uq/7XLrfv37Dd+/t63S+++59IpWpU/VmPLmwyGV1BV2V0+mEnVyHXTUOF9CbXZRKmmBAytuAYWd7vlckFhbZr3bgSFyHffFJJTfFNsImnKg2cdviCcYy65LIHNxDp2KW4AMm9DlG+JWa7WBIWuAGju3EH4Q/5G1oVcEZgjdxL9lSp3ANo5l1sTIPMyo4JfiERygqZhKexe3dmGF3fVOGzVzV+GIPzHg3vPwwbjMIs4EW1R2sSMA+HoF3WDPjvtgzaDBz2fxrse3wABtm3BfLoyxmCnCo+sxc1eSqWJ59+3Au7nIghtvjFab1OVZ4ftd8GjAdcAl7agFuYVXiXrfsKt9f8znrw7+J/Cw0JeWbLGZ+fYPlJl+aTz8PWGDa7QAAAABJRU5ErkJggg==>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEMAAAATCAYAAADLRLCEAAABuUlEQVR4Xu2XzStEURiHX6FIiIWspaxkIdlYWFiQjw2KlI2wsSBFsVFWFjaShNL8BZIl+StslZ1YsLKSj9/rPXfmzHHNPeedMc3iPvU0eueOeZw5nTuIUlJSUsKpgv3wAB4Zp2C9fVEZqIajJO/PLUNmVlbSxTDwQqzCRdgK+4z38AY25y71ogk2uEMPauEeHIMt5vEVnpjnQlF1dMAHuAtrrPkM/ILL1syHcWMoA/AZLlmzHfhJskNCUXV0wSd4AeuseS98gxlr5oMqAgzCD7hvzfj38Aeyac180Xb8bCd3K06QhKw48yTUEaCR8s8IXgTeGcPWzJdiOrLwocleke7MKEkEaIN3pD8ziu7gw3TDeA3b85/+RTfJXceWD0HWnbOd8rJE+I8/hueUfAjGNRTq8GrghViDZ8akCCYu5K8I3xBeiEO4bX5OIq6hUEdiAy/ENNwiCYgiekh2SQjFbE8+L9bhPEkTMwJns1f4o+5IF8NiEl6SLEi0nebMjB9D0EZE59Up5RoW4C3Jd5BQVB386b+Q3EZd3yk8RBVBcvt03599JPliGIq2o6RURARVSIfqf4J/ILjjGx95XrAPubmXAAAAAElFTkSuQmCC>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAATCAYAAAD8in+wAAAAyUlEQVR4XmNgGAWjgP6AEYoLgDgDTW5AwaB1mC0U/wTicjQ5YgAfEHOjC1IKZIB4IxR/ZSDPYb5QTDXACsSdQOwNxQ8ZBonDgoA4CYgloXhQOEyBARJaoFAbNA6DRaEClE+Kw3SBOAQNg8wCYXRxEFaBaCMOJAPxbAaE5lQofg/ES4HYE4g54apRAU0dpsmAqhkUSiD8m4Gww7ABqkXloHUYOjCG4kFTjoFK6xVA/AqK/wPxFyA+DMRiSOoIAao7jFpg0DqMKnUlACiZMYJck/GsAAAAAElFTkSuQmCC>