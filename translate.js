// ---------- 표준어 → 제주어 번역 ----------
// 낱말은 jeju-dict.js(개정증보 제주어사전 2009에서 뽑은 짝)로 바꾸고,
// 조사와 어미는 같은 사전의 조사·어미 항목을 따라 아래 규칙으로 바꾼다.
// 문맥을 이해하는 번역이 아니라 낱말·말끝을 규칙대로 바꾸는 참고용 번역이다.

(function () {
  const LEADS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const TAILS = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const ARAEA = 'ㆍ';        // 아래아. 옛한글 모음이라 완성형 글자로 못 합쳐서 따로 다룸
  const SSANG_ARAEA = 'ᆢ';   // 쌍아래아
  const YANG = 'ㅏㅗㅑㅛㅘ' + ARAEA;

  const isYang = (v) => !!v && YANG.includes(v);   // 양성모음이면 '아', 아니면 '어'
  const isVowel = (c) => !!c && (VOWELS.includes(c) || c === ARAEA || c === SSANG_ARAEA);
  const isConsonant = (c) => !!c && LEADS.includes(c);

  // ---------- 한글 ↔ 낱자 ----------
  // '먹었어요' → 'ㅁㅓㄱㅇㅓㅆㅇㅓㅇㅛ' 처럼 풀어서 어간과 어미를 낱자 단위로 맞춘다.

  function toJamo(str) {
    let out = '';
    for (const ch of str) {
      const c = ch.codePointAt(0);
      if (c >= 0xAC00 && c <= 0xD7A3) {
        const i = c - 0xAC00;
        out += LEADS[Math.floor(i / 588)] + VOWELS[Math.floor((i % 588) / 28)] + TAILS[i % 28];
      } else if (c >= 0x1100 && c <= 0x1112) out += LEADS[c - 0x1100];
      else if (c >= 0x1161 && c <= 0x1175) out += VOWELS[c - 0x1161];
      else if (c === 0x119E) out += ARAEA;
      else if (c === 0x11A2) out += SSANG_ARAEA;
      else if (c >= 0x11A8 && c <= 0x11C2) out += TAILS[c - 0x11A7];
      else out += ch;
    }
    return out;
  }

  function fromJamo(j) {
    let out = '';
    let i = 0;
    while (i < j.length) {
      const l = LEADS.indexOf(j[i]);
      if (l < 0 || !isVowel(j[i + 1])) { out += j[i++]; continue; }
      const v = j[i + 1];
      let k = i + 2;
      let run = '';
      while (k < j.length && isConsonant(j[k])) run += j[k++];
      // 뒤에 모음이 이어지면 마지막 자음은 다음 글자의 첫소리
      let tail = isVowel(j[k]) ? run.slice(0, -1) : run;
      while (tail && TAILS.indexOf(tail) < 0) tail = tail.slice(0, -1);
      const t = TAILS.indexOf(tail);
      const vi = VOWELS.indexOf(v);
      if (vi >= 0) {
        out += String.fromCharCode(0xAC00 + (l * 21 + vi) * 28 + t);
      } else {
        out += String.fromCharCode(0x1100 + l) + (v === ARAEA ? 'ᆞ' : 'ᆢ') + (t ? String.fromCharCode(0x11A7 + t) : '');
      }
      i += 2 + tail.length;
    }
    return out;
  }

  function lastVowel(j) {
    for (let i = j.length - 1; i >= 0; i--) if (isVowel(j[i])) return j[i];
    return '';
  }

  // 받침이 있는지 / ㄹ받침인지 (조사 고를 때)
  function batchim(word) {
    const j = toJamo(word);
    const last = j.slice(-1);
    return { has: isConsonant(last), rieul: last === 'ㄹ' };
  }

  // ---------- 사전 ----------

  const DICT = window.JEJU_DICT || { N: {}, V: {} };
  const N = DICT.N;

  // 사전에 형용사로 올라 있지 않아도 형용사로 다룰 말 (말끝이 동사와 달라서 필요)
  const ADJ = new Set('좋 싫 많 적 같 있 없 예쁘 아프 바쁘 기쁘 슬프 춥 덥 멀 가깝 그립 고맙 반갑 즐겁 크 작 길 짧 높 낮 맑 밝 곱 싶 괜찮'.split(' '));
  const ADJ_HADA = new Set('행복 건강 편안 따뜻 시원 조용 깨끗 미안 죄송 감사 소중 필요 중요 피곤 심심 궁금 든든 뿌듯 다정 친절 착 튼튼 따스 포근 안녕 평안 무사 씩씩 든든'.split(' '));

  const STEMS = Object.keys(DICT.V).map((std) => ({
    s: toJamo(std),
    g: toJamo(DICT.V[std][0] || std),
    pos: ADJ.has(std) ? '형' : DICT.V[std][1],
  }));
  // 사전에 표준어와 같은 꼴로 따로 실리지 않은 기본 용언. 어간은 그대로 두고 말끝만 바꾼다.
  const known = new Set(Object.keys(DICT.V));
  for (const std of '보 오 가 주 좋 알 살 놀 만나 지내 되 많 같 싫 괜찮 늦 내리 받 웃 울 쓰 타 자 덥 춥 크 예쁘 아프 바쁘 슬프 멀 가깝 반갑 즐겁'.split(' ')) {
    // 드문 말과 겹칠 때(써요: 쓰다 / 써다) 이쪽이 먼저 잡히도록 앞에 둠
    if (!known.has(std)) STEMS.unshift({ s: toJamo(std), g: toJamo(std), pos: ADJ.has(std) ? '형' : '동' });
  }
  // '-고 싶다'는 사전의 어미 '-고정(-고저) ᄒᆞ다'로 옮김
  STEMS.push({ s: toJamo('싶'), g: 'ㅎ' + ARAEA, pos: '형' });

  // ---------- 어간이 활용하면서 바뀌는 꼴 ----------
  // [토큰 앞머리로 찾을 꼴, 그 꼴에 이미 녹아 있는 어미, 불규칙 종류]

  function stemForms(s) {
    const forms = [[s, '', null]];
    const last = s.slice(-1);
    const base = s.slice(0, -1);
    if (s.endsWith('ㅎㅏ')) forms.push([base + 'ㅐ', 'ㅇㅕ', null]);          // 하 → 해
    if (last === 'ㅣ') forms.push([base + 'ㅕ', 'ㅇㅓ', null]);                // 기다리 → 기다려
    if (last === 'ㅗ') forms.push([base + 'ㅘ', 'ㅇㅏ', null]);                // 오 → 와
    if (last === 'ㅜ') forms.push([base + 'ㅝ', 'ㅇㅓ', null]);                // 배우 → 배워
    if (last === 'ㅚ') forms.push([base + 'ㅙ', 'ㅇㅓ', null]);                // 되 → 돼
    if (last === 'ㅡ') {
      if (s.endsWith('ㄹㅡ')) {                                                 // 모르 → 몰라
        forms.push([s.slice(0, -2) + 'ㄹㄹㅏ', 'ㅇㅏ', 'reu'], [s.slice(0, -2) + 'ㄹㄹㅓ', 'ㅇㅓ', 'reu']);
      }
      forms.push([base + 'ㅏ', 'ㅇㅏ', null], [base + 'ㅓ', 'ㅇㅓ', null]);    // 기쁘 → 기뻐
    }
    if (last === 'ㅂ') forms.push([base + 'ㅇㅝ', 'ㅇㅓ', 'b'], [base + 'ㅇㅜ', 'ㅇㅡ', 'b']); // 그립 → 그리워, 그리운
    if (last === 'ㄷ') forms.push([base + 'ㄹ', '', 'd']);                      // 듣 → 들어
    if (last === 'ㄹ') forms.push([base, '', 'l']);                             // 살 → 삽니다, 사는
    return forms;
  }

  // 모음으로 시작하는 어미 앞에서 쓰는 제주어 어간
  function vowelStem(g, flag) {
    if (flag === 'b' && g.endsWith('ㅂ')) return g.slice(0, -1) + 'ㅇㅜ';
    if (flag === 'd' && g.endsWith('ㄷ')) return g.slice(0, -1) + 'ㄹ';
    return g;
  }

  // 어간 + '아/어' + 뒤따르는 말. 제주어 어간의 모음에 맞춰 아/어/여를 고르고 줄여 씀
  function joinAE(g, tail, flag) {
    if (flag === 'reu' && g.endsWith('ㄹㅡ')) {
      const b = g.slice(0, -2);
      return (b.endsWith('ㄹ') ? b : b + 'ㄹ') + 'ㄹ' + (isYang(lastVowel(b)) ? 'ㅏ' : 'ㅓ') + tail;
    }
    g = vowelStem(g, flag);
    const last = g.slice(-1);
    const base = g.slice(0, -1);
    if (g.endsWith('ㅎ' + ARAEA)) return g + 'ㅇㅕ' + tail;                      // ᄒᆞ여
    if (!isVowel(last)) return g + (isYang(lastVowel(g)) ? 'ㅇㅏ' : 'ㅇㅓ') + tail;
    switch (last) {
      case 'ㅏ': case 'ㅓ': case 'ㅐ': case 'ㅔ': case 'ㅕ': return g + tail;
      case 'ㅣ': return base + 'ㅕ' + tail;
      case 'ㅗ': return base + 'ㅘ' + tail;
      case 'ㅜ': return base + 'ㅝ' + tail;
      case 'ㅚ': return base + 'ㅙ' + tail;
      case 'ㅡ': return base + (isYang(lastVowel(base)) ? 'ㅏ' : 'ㅓ') + tail;
      default: return g + (isYang(last) ? 'ㅇㅏ' : 'ㅇㅓ') + tail;
    }
  }

  // 어간 + (으) + 뒤따르는 말
  function joinEU(g, tail, flag) {
    g = vowelStem(g, flag);
    const last = g.slice(-1);
    if (isVowel(last)) return g + tail;
    if (last === 'ㄹ') {
      if (tail[0] === 'ㄹ' && !isVowel(tail[1])) return g + tail.slice(1);    // 살 + ㄹ까 → 살까
      if (tail[0] === 'ㄹ') return g + tail;                                   // 놀 + 러 → 놀러
      if ('ㄴㅂㅅ'.includes(tail[0])) return g.slice(0, -1) + tail;            // ㄹ 탈락
      return g + tail;
    }
    return g + 'ㅇㅡ' + tail;
  }

  // 어간 + 자음으로 시작하는 어미. ㄹ받침 어간은 ㄴ 앞에서 ㄹ이 빠짐 (불다 → 부는)
  function joinPlain(g, tail) {
    return g.endsWith('ㄹ') && tail[0] === 'ㄴ' ? g.slice(0, -1) + tail : g + tail;
  }

  // 합쇼체·해요체 평서/의문: -수다, -우다, -ㅂ네다 / -수가, -우까, -ㅂ네까
  function formal(c, q) {
    let g = c.g;
    const last = g.slice(-1);
    const verb = c.pos === '동';
    if (isVowel(last) || (last === 'ㄹ' && c.flag === 'l')) {
      if (!isVowel(last)) g = g.slice(0, -1);
      if (c.pos === '형') return g + 'ㅇㅜ' + (q ? 'ㄲㅏ' : 'ㄷㅏ');
      return g + 'ㅂㄴㅔ' + (q ? 'ㄲㅏ' : 'ㄷㅏ');
    }
    if (verb) return g + 'ㅇㅡㅂㄴㅔ' + (q ? 'ㄲㅏ' : 'ㄷㅏ');
    return g + 'ㅅㅜ' + (q ? 'ㄱㅏ' : 'ㄷㅏ');
  }

  // ---------- 어미 규칙 ----------
  // safe: 사전에 없는 어간에도 적용해도 되는, 헷갈릴 일이 적은 말끝

  const A = '(?<a>ㅇㅏ|ㅇㅓ|ㅇㅕ|)';
  const PAST = A + 'ㅆ';
  const U = '(?<u>ㅇㅡ)?';

  const RULES = [
    [PAST + '(?:ㅅㅡㅂㄴㅣㄷㅏ|ㅇㅓㅇㅛ)', (c) => c.ae('ㅅ' + (c.q ? 'ㅅㅜㄱㅏ' : 'ㅅㅜㄷㅏ')), true],   // 먹었습니다 → 먹엇수다
    [PAST + 'ㅅㅡㅂㄴㅣㄲㅏ', (c) => c.ae('ㅅㅅㅜㄱㅏ'), true],
    ['ㅅㅡㅂㄴㅣㄷㅏ', (c) => formal(c, c.q), true],                                                  // 고맙습니다 → 고맙수다
    ['ㅅㅡㅂㄴㅣㄲㅏ', (c) => formal(c, true), true],
    ['ㅂㄴㅣㄷㅏ', (c) => formal(c, c.q), true],                                                      // 갑니다 → 갑네다
    ['ㅂㄴㅣㄲㅏ', (c) => formal(c, true), true],
    ['(?:ㄱㅔㅆㅅㅡㅂㄴㅣㄷㅏ|ㄱㅔㅆㅇㅓㅇㅛ)', (c) => c.eu('ㅋㅜㄷㅏ'), true],                   // 가겠습니다 → 가쿠다
    [U + 'ㄹㄱㅔㅇㅛ', (c) => c.eu('ㅋㅜㄷㅏ'), true],                                           // 갈게요 → 가쿠다
    [U + '(?:ㅅㅔㅇㅛ|ㅅㅣㅂㅅㅣㅇㅗ|ㅅㅕㅇㅛ)', (c) => c.eu(c.q ? 'ㅅㅣㅂㄴㅔㄲㅏ' : 'ㅂㅅㅓ'), true],           // 오세요 → 옵서
    [U + 'ㅂㅅㅣㄷㅏ', (c) => c.g + 'ㄱㅔㅁㅏㅆㅡㅁ', true],                                           // 갑시다 → 가게마씀
    [A + 'ㅇㅛ', (c) => (c.pos === '형' ? formal(c, c.q) : c.ae('ㅁ' + (c.q ? 'ㅅㅜㄱㅏ' : 'ㅅㅜㄷㅏ'))), true], // 먹어요 → 먹엄수다
    [PAST + 'ㄷㅏ', (c) => c.ae('ㅅㅈㅓ'), true],                                                     // 먹었다 → 먹엇저
    [PAST + 'ㅇㅓ', (c) => c.ae('ㅅㅇㅓ'), true],
    [PAST + 'ㄴㅡㄴㄷㅔ', (c) => c.ae('ㅅㄴㅡㄴㄷㅣ'), true],
    [PAST + 'ㅇㅡㄴㅣㄲㅏ', (c) => c.ae('ㅅㅇㅡㄴㅏㄴ'), true],
    [PAST + 'ㅇㅡㅁㅕㄴ', (c) => c.ae('ㅅㅇㅡㅁㅣㄴ'), true],
    [PAST + 'ㅈㅣㅁㅏㄴ', (c) => c.ae('ㅅㅈㅜㅁㅏㄴㅡㄴ'), true],
    [PAST + '(?<r>ㄱㅗ|ㄷㅓㄴ|ㄴㅔㅇㅛ|ㅈㅛ|ㅇㅡㄹ|ㄴㅡㄴ|ㄴㅡㄴㅈㅣ|ㄱㅓㄴㅏ)', (c) => c.ae('ㅅ' + c.m.groups.r), false],
    ['(?:ㄴㅡㄴㄷㅏ|ㄴㄷㅏ)', (c) => (c.pos === '동' ? c.ae('ㅁㅈㅓ') : null), false],                 // 간다 → 감저
    [A + 'ㅅㅓ', (c) => c.ae('ㄴㅔ'), false],                                                         // 먹어서 → 먹어네
    [A + '(?<r>ㄷㅗ|ㅇㅑ)', (c) => c.ae(c.m.groups.r), false],
    ['(?<a>ㅇㅏ|ㅇㅓ|ㅇㅕ)', (c) => c.ae(''), false],
    ['ㄱㅗ', (c) => c.g + (c.next === '싶' ? 'ㄱㅗㅈㅓㅇ' : /^[있계말]/.test(c.next) ? 'ㄱㅗ' : 'ㄱㅗㄱ'), false], // 먹고 → 먹곡
    [U + 'ㅁㅕㄴㅅㅓ', (c) => c.eu('ㅁㅓㅇ'), true],                                                  // 먹으면서 → 먹으멍
    [U + 'ㅁㅕㄴ', (c) => c.eu('ㅁㅣㄴ'), false],                                                     // 가면 → 가민
    [U + 'ㄴㅣㄲㅏ', (c) => c.eu('ㄴㅏㄴ'), true],                                                    // 가니까 → 가난
    [U + 'ㄹㅕㄱㅗ', (c) => vowelStem(c.g, c.flag) + 'ㅈㅔㄴ', true],                                 // 가려고 → 가젠
    ['ㄴㅡㄴㄷㅔ', (c) => c.plain('ㄴㅡㄴㄷㅣ'), true],                                                  // 가는데 → 가는디
    [U + 'ㄴㄷㅔ', (c) => c.eu('ㄴㄷㅣ'), false],
    ['ㅈㅣㅁㅏㄴ', (c) => c.g + 'ㅈㅜㅁㅏㄴㅡㄴ', true],                                               // 가지만 → 가주마는
    ['ㅈㅏ', (c) => (c.pos === '동' ? c.g + 'ㄱㅔ' : null), false],                                   // 가자 → 가게
    // 아래는 어미는 그대로 두고 어간만 제주어로 바꿈
    [U + '(?<r>ㄴ|ㄹ|ㅁ|ㅁㅕ|ㄹㅓ|ㄹㅈㅣ|ㄹㄲㅏ|ㄹㄲㅏㅇㅛ)', (c) => c.eu(c.m.groups.r), false],
    ['(?<r>ㄴㅡㄴ|ㄱㅣ|ㄱㅔ|ㅈㅣ|ㄷㅏ|ㄷㅓㄴ|ㄷㅗㄹㅗㄱ|ㄴㅔ|ㄴㅔㅇㅛ|ㄱㅜㄴㅏ|ㄴㅣ|ㄴㅑ|ㄷㅏㄱㅏ|ㄴㅡㄴㅈㅣ|ㅈㅛ|ㄱㅓㄴㅏ)', (c) => c.plain(c.m.groups.r), false],
  ].map(([src, gen, safe]) => ({ re: new RegExp('^' + src + '$'), tail: new RegExp('^(?<stem>.+?)' + src + '$'), gen, safe }));

  // 받침으로 시작하는 어미(ㅂ니다, ㅆ, ㄴ데…)는 모음 바로 뒤에만 올 수 있음
  function boundaryOk(stemEnd, rem) {
    if (!rem) return false;
    if (isConsonant(rem[0]) && !isVowel(rem[1])) return isVowel(stemEnd);
    return true;
  }

  // ---------- 용언 ----------

  // stems: 찾아볼 어간 (제주어 → 표준어 풀이에서 후보 어간만 넘김)
  function translateVerb(word, ctx, stems = STEMS) {
    const j = toJamo(word);

    // 1) 사전에 있는 어간
    let best = null;
    for (const stem of stems) {
      const variants = [];
      for (const [prefix, implied, flag] of stemForms(stem.s)) {
        variants.push([prefix, implied, flag, stem.g]);
        if (flag === null && !implied) {                                           // 높임 '-시-'
          const gv = isVowel(stem.g.slice(-1)) ? stem.g : stem.g + 'ㅇㅡ';
          const sv = isVowel(prefix.slice(-1)) ? prefix : prefix + 'ㅇㅡ';
          variants.push([sv + 'ㅅㅣ', '', null, gv + 'ㅅㅣ'], [sv + 'ㅅㅕ', 'ㅇㅓ', null, gv + 'ㅅㅣ']);
        }
      }
      for (const [prefix, implied, flag, g] of variants) {
        if (!j.startsWith(prefix)) continue;
        // 규칙 활용으로 풀리는 쪽을 먼저, 그다음 긴 어간을 고름 (놀러: 놀+러 > 노르+어)
        const rank = (flag === null ? 1000 : 0) + prefix.length;
        if (best && rank <= best.rank) continue;
        const rest = j.slice(prefix.length);
        if (flag === 'd' && rest[0] !== 'ㅇ') continue;
        if (flag === 'l' && !'ㄴㅂㅅ'.includes(rest[0])) continue;
        const rem = implied + rest;
        if (!implied && !boundaryOk(prefix.slice(-1), rem)) continue;
        for (const rule of RULES) {
          const m = rule.re.exec(rem);
          if (!m) continue;
          const c = {
            g, pos: stem.pos, flag, m, q: ctx.q, next: ctx.next,
            ae: (tail) => joinAE(g, tail, flag),
            eu: (tail) => joinEU(g, tail, flag),
            plain: (tail) => joinPlain(g, tail),
          };
          const out = rule.gen(c);
          if (out) { best = { rank, out: fromJamo(out) }; break; }
        }
      }
    }
    if (best) return best.out;

    // 2) 사전에 없는 어간: 뚜렷한 말끝만 바꿈
    const norm = j.replace(/ㅎㅐㅆ/g, 'ㅎㅏㅇㅕㅆ').replace(/ㅎㅐ(?=$|ㅇㅛ|ㅅㅓ|ㄷㅗ|ㅇㅑ)/, 'ㅎㅏㅇㅕ');
    for (const rule of RULES) {
      const m = rule.tail.exec(norm);
      if (!m) continue;
      const stem = m.groups.stem;
      const rem = norm.slice(stem.length);
      if (stem.length < 2 || !isConsonant(stem[0]) || !isVowel(stem[1])) continue;
      if (!boundaryOk(stem.slice(-1), rem)) continue;

      // '○○하다' 꼴이면 앞말은 사전에서 찾고 '하'는 'ᄒᆞ'로
      const hada = /^(.+)ㅎㅏ((?:ㅇㅡ)?ㅅ[ㅣㅕ])?$/.exec(stem);
      if (!hada && !rule.safe) continue;
      if (hada) {
        const head = fromJamo(hada[1]);
        const g = toJamo(N[head] || head) + 'ㅎ' + ARAEA + (hada[2] || '');
        const c = {
          g, pos: ADJ_HADA.has(head) ? '형' : '동', flag: null, m, q: ctx.q, next: ctx.next,
          ae: (tail) => joinAE(g, tail, null),
          eu: (tail) => joinEU(g, tail, null),
          plain: (tail) => g + tail,
        };
        const out = rule.gen(c);
        if (out) return fromJamo(out);
        continue;
      }

      const a = m.groups.a || '';
      const u = m.groups.u || '';
      const c = {
        g: stem, pos: ADJ.has(fromJamo(stem)) ? '형' : '?', flag: null, m, q: ctx.q, next: ctx.next,
        ae: (tail) => stem + a + tail,        // 모르는 어간은 쓰인 꼴(아/어) 그대로
        eu: (tail) => stem + u + tail,
        plain: (tail) => stem + tail,
      };
      const out = rule.gen(c);
      if (out) return fromJamo(out);
    }
    return null;
  }

  // ---------- 체언 + 조사 ----------

  const SAME = (p) => () => p;
  // [표준어 조사들, 제주어 조사 고르는 함수(받침 정보), 사전에 없는 체언에도 붙여 바꿀지]
  const PARTICLE_DEFS = [
    [['이', '가'], (b) => (b.has ? '이' : '가')],
    [['은', '는'], (b) => (b.has ? '은' : '는')],
    [['을', '를'], (b) => (b.has ? '을' : '를')],
    [['으로', '로'], (b) => (b.has && !b.rieul ? '으로' : '로'), false, true],
    [['이나', '나'], (b) => (b.has ? '이나' : '나')],
    [['와', '과'], SAME('광')],
    [['하고', '이랑', '랑'], (b) => (b.has ? '이영' : '영')],
    [['에게', '한테', '께'], SAME('신듸'), true, true],
    [['까지'], SAME('ᄁᆞ지'), true, true],
    [['부터'], SAME('부떠'), true, true],
    [['처럼'], SAME('처름'), true, true],
    [['같이'], SAME('ᄀᆞ치'), false, true],
    [['의'], SAME('의')], [['도'], SAME('도')], [['만'], SAME('만')],
    [['에'], SAME('에'), false, true], [['에서'], SAME('에서'), false, true],
    [['보다'], SAME('보다'), false, true], [['마다'], SAME('마다')], [['밖에'], SAME('밖에')], [['께서'], SAME('께서')],
    [['입니다', '이에요', '예요', '에요'], (b, q) => (b.has ? '이우' : '우') + (q ? '까' : '다'), true],
    [['입니까'], (b) => (b.has ? '이우까' : '우까'), true],
  ];
  const PARTICLES = new Map();
  for (const [stds, pick, strong, extendable] of PARTICLE_DEFS) {
    for (const std of stds) {
      PARTICLES.set(std, { pick, strong: !!strong });
      if (extendable) {
        for (const tail of ['는', '도', '만']) {
          PARTICLES.set(std + tail, { pick: (b, q) => pick(b, q) + tail, strong: !!strong });
        }
      }
    }
  }

  // 대명사는 바꾸지 않되(너 → 느 만 예외), '나는'을 '날다'로 잘못 풀지 않도록 체언으로 알려 둠
  const PRONOUNS = new Set('나 저 내 제 우리 저희 너희 이것 그것 저것 여기 거기 저기 누구 뭐 무엇 너'.split(' '));
  // '한 해도'의 '해'(年)를 '하다'로 잘못 풀지 않게, '수고'는 그대로 두도록 같은 방식으로 고정
  for (const w of ['해', '수고']) { PRONOUNS.add(w); N[w] = ''; }
  for (const p of PRONOUNS) if (!(p in N)) N[p] = '';

  function translateNoun(word, ctx) {
    if (word in N) return N[word] || word;
    for (let i = word.length - 1; i >= 1; i--) {
      const particle = PARTICLES.get(word.slice(i));
      if (!particle) continue;
      const noun = word.slice(0, i);
      if (!(noun in N) && !particle.strong) continue;
      const jeju = N[noun] || noun;
      return jeju + particle.pick(batchim(jeju), ctx.q);
    }
    return null;
  }

  function isPronounForm(word) {
    for (let i = 1; i < word.length; i++) {
      if (PRONOUNS.has(word.slice(0, i)) && PARTICLES.has(word.slice(i))) return true;
    }
    return false;
  }

  // ---------- 통째로 바꾸는 인사말 ----------

  const PHRASES = [
    [/어서\s*오세요|어서\s*오십시오/g, 'ᄒᆞᆫ저 옵서'],          // 사전 'ᄒᆞᆫ저' 항목의 보기 문장
    [/안녕하세요|안녕하십니까/g, '펜안ᄒᆞ우까'],
    [/감사합니다|감사해요|감사드립니다|감사드려요|고맙습니다|고마워요/g, '고맙수다'],
  ];
  const HOLD_OPEN = '';
  const HOLD_CLOSE = '';

  // ---------- 문장 ----------

  function translate(text) {
    let src = text;
    for (const [re, jeju] of PHRASES) src = src.replace(re, HOLD_OPEN + jeju + HOLD_CLOSE);

    // 이미 바꾼 인사말, 한글 낱말, 그 밖의 글자로 나눔
    // 옛한글 자모(ᄒᆞ 같은 글자)도 낱말에 붙여서 나눔. 이미 제주어로 바꾼 글을 다시 바꿀 때
    // '친ᄒᆞ게'의 '게'만 떨어져 나와 '깅이(게)'로 바뀌는 일을 막음
    const parts = src.split(/([^]*|[가-힣ᄀ-ᇿ]+)/);
    const words = parts.map((p, i) => (i % 2 === 1 && p[0] !== HOLD_OPEN ? p : null));

    return parts.map((part, i) => {
      if (i % 2 === 0) return part;
      if (part[0] === HOLD_OPEN) return part.slice(1, -1);
      if (/[ᄀ-ᇿ]/.test(part)) return part;   // 옛한글이 섞인 낱말은 이미 제주어

      const after = parts[i + 1] || '';
      const next = /^\s+$/.test(after) ? (words[i + 2] || '') : '';
      const ctx = { q: /^\s*\?/.test(after), next: next[0] || '' };

      const noun = translateNoun(part, ctx);
      if (noun && noun !== part) return noun;
      if (part in N || isPronounForm(part)) return part;   // 체언이 분명하면 용언으로 다시 풀지 않음
      const verb = translateVerb(part, ctx);
      if (verb) return verb;
      // '보고 싶다'처럼 어간은 그대로인 '-고 싶-'
      if (ctx.next === '싶' && part.endsWith('고')) return part + '정';
      return part;
    }).join('');
  }

  window.translateToJeju = translate;

  // ---------- 제주어 → 표준어 (대략 풀이) ----------
  // 게시판에 표준어 글 없이 저장된 엽서를 '표준어로 보기' 할 때 씀.
  // 낱말마다 표준어 후보(사전을 거꾸로 찾은 낱말 + 흔한 말끝)를 만들어 위의 번역기로 다시 바꿔 보고,
  // 똑같이 나오는 후보를 고른다. 못 찾은 낱말은 아래아만 'ㅏ'로 읽기 쉽게 바꿈. 참고용 풀이.

  // 제주어 체언 → 표준어. 한 글자 말(잘, 영, 새 …)은 표준어와 겹쳐 헷갈리니 아래 WORDS에 적은 것만
  const RN = {};
  for (const [std, jeju] of Object.entries(N)) {
    if (jeju && jeju.length > 1 && !(jeju in RN) && !(jeju in N)) RN[jeju] = std;
  }
  // 사전을 거꾸로 찾으면 엉뚱해지는 말 · 자주 쓰는 제주어 낱말
  const WORDS = {
    'ᄎᆞᆷ말': '정말', 'ᄒᆞᆫ듸': '함께', 'ᄒᆞᆫ저': '어서', 느: '너', 늴: '내일', 질: '길', 심: '힘', 펜: '편',
    이디: '여기', 거디: '거기', 영: '이렇게', 경: '그렇게', 막: '아주', 셍각: '생각', 어느제: '언제', 간간: '가끔',
    벨로: '별로', 펭소: '평소', 'ᄐᆞ시': '다시', 너미: '너무', 심든: '힘든', 엇어: '없어', 엇다: '없다',
    이신: '있는', 잇는: '있는', 이시난: '있으니까', 이서: '있어', 이서라: '있었어', 'ᄒᆞᆫ': '한',
    아니주마는: '아니지만', 엇주마는: '없지만', 'ᄒᆞ루': '하루', 'ᄆᆞ음': '마음',
    펜안: '편안', 'ᄃᆞᄉᆞ': '따뜻', '곱닥ᄒᆞᆫ': '고운', 벨: '별', 벨것: '별것', 펭소: '평소', 지드려져: '기다려져',
  };
  const KEEP = new Set(['제주', '오늘', '시험', '엽서', '사랑']);   // 표준어와 같은 말(사전 거꾸로 찾기 안 함)
  // 제주어 조사 → 표준어 (받침 있을 때, 없을 때)
  const JEJU_PARTICLES = [
    ['이영', '이랑', '이랑'], ['영', '이랑', '랑'], ['광', '과', '와'], ['신듸', '한테', '한테'], ['안티', '한테', '한테'],
    ['추룩', '처럼', '처럼'], ['처름', '처럼', '처럼'], ['ᄁᆞ지', '까지', '까지'], ['부떠', '부터', '부터'], ['덜', '들', '들'],
    ['이우다', '이에요', '예요'], ['우다', '이에요', '예요'], ['엔', '엔', '엔'], ['이서', '에서', '에서'],
  ];

  const B_IRREGULAR = new Set('고맙 그립 반갑 즐겁 춥 덥 가깝 쉽 어렵 무섭 아름답 귀엽 부럽 반갑 미덥 가볍 무겁 뜨겁 차갑 놀랍 외롭 새롭 정답 아깝'.split(' '));

  // 표준어 어간(낱자) + 말끝 → 표준어 낱말(낱자)
  function stdAE(s, tail, std) {
    const last = s.slice(-1);
    const base = s.slice(0, -1);
    if (s.endsWith('ㅎㅏ')) return base + 'ㅐ' + tail;                                    // 하 → 해
    if (B_IRREGULAR.has(std)) return base + 'ㅇㅝ' + tail;                                  // 고맙 → 고마워
    if (s.endsWith('ㄹㅡ') && s.length > 2) {                                              // 모르 → 몰라
      const b = s.slice(0, -2);
      return (b.endsWith('ㄹ') ? b : b + 'ㄹ') + 'ㄹ' + (isYang(lastVowel(b)) ? 'ㅏ' : 'ㅓ') + tail;
    }
    if (!isVowel(last)) return s + (isYang(lastVowel(s)) ? 'ㅇㅏ' : 'ㅇㅓ') + tail;
    switch (last) {
      case 'ㅏ': case 'ㅓ': case 'ㅐ': case 'ㅔ': case 'ㅕ': return s + tail;
      case 'ㅣ': return base + 'ㅕ' + tail;
      case 'ㅗ': return base + 'ㅘ' + tail;
      case 'ㅜ': return base + 'ㅝ' + tail;
      case 'ㅚ': return base + 'ㅙ' + tail;
      case 'ㅡ': return base + (isYang(lastVowel(base)) ? 'ㅏ' : 'ㅓ') + tail;
      default: return s + 'ㅇㅓ' + tail;
    }
  }
  function stdEU(s, tail, std) {
    const last = s.slice(-1);
    if (isVowel(last)) return s + tail;
    if (B_IRREGULAR.has(std)) return s.slice(0, -1) + 'ㅇㅜ' + tail;                      // 그리운
    if (last === 'ㄹ') {
      if (tail[0] === 'ㄹ' && !isVowel(tail[1])) return s + tail.slice(1);
      if ('ㄴㅂㅅ'.includes(tail[0])) return s.slice(0, -1) + tail;
      return s + tail;
    }
    return s + 'ㅇㅡ' + tail;
  }
  function stdFormal(s, q) {
    const end = q ? 'ㄲㅏ' : 'ㄷㅏ';
    const last = s.slice(-1);
    if (isVowel(last)) return s + 'ㅂㄴㅣ' + end;
    if (last === 'ㄹ') return s.slice(0, -1) + 'ㅂㄴㅣ' + end;
    return s + 'ㅅㅡㅂㄴㅣ' + end;
  }
  function stdPlain(s, tail) {
    return s.endsWith('ㄹ') && tail[0] === 'ㄴ' ? s.slice(0, -1) + tail : s + tail;
  }
  // 흔한 말끝부터 (같은 제주어로 바뀌는 표준어가 여럿이면 앞의 것을 고름)
  const STD_ENDINGS = [
    (s, q, d) => stdAE(s, 'ㅇㅛ', d),                // 해요체
    (s, q, d) => stdAE(s, 'ㅆㅇㅓㅇㅛ', d),
    (s, q) => stdFormal(s, q),                        // 합니다
    (s, q, d) => stdAE(s, 'ㅆㅅㅡㅂㄴㅣ' + (q ? 'ㄲㅏ' : 'ㄷㅏ'), d),
    (s) => s + 'ㄱㅔㅆㅅㅡㅂㄴㅣㄷㅏ',
    (s, q, d) => stdEU(s, 'ㅅㅔㅇㅛ', d),
    (s, q, d) => stdEU(s, 'ㄹㄱㅔㅇㅛ', d),
    (s, q, d) => stdEU(s, 'ㅂㅅㅣㄷㅏ', d),
    (s) => (isVowel(s.slice(-1)) ? s + 'ㄴㄷㅏ' : s.endsWith('ㄹ') ? s.slice(0, -1) + 'ㄴㄷㅏ' : s + 'ㄴㅡㄴㄷㅏ'),
    (s, q, d) => stdAE(s, 'ㅆㄷㅏ', d),
    (s, q, d) => stdAE(s, 'ㅆㅇㅓ', d),
    (s, q, d) => stdAE(s, 'ㅅㅓ', d),
    (s, q, d) => stdAE(s, '', d),
    (s) => s + 'ㄱㅗ',
    (s, q, d) => stdEU(s, 'ㅁㅕㄴㅅㅓ', d),
    (s, q, d) => stdEU(s, 'ㅁㅕㄴ', d),
    (s, q, d) => stdEU(s, 'ㄴㅣㄲㅏ', d),
    (s, q, d) => stdEU(s, 'ㄹㅕㄱㅗ', d),
    (s) => s + 'ㅈㅣㅁㅏㄴ',
    (s) => s + 'ㅈㅏ',
    (s) => stdPlain(s, 'ㄴㅡㄴㄷㅔ'),
    (s) => stdPlain(s, 'ㄴㅡㄴ'),
    (s, q, d) => stdEU(s, 'ㄴ', d),
    (s, q, d) => stdEU(s, 'ㄹ', d),
    (s) => s + 'ㄷㅏ',
    (s) => s + 'ㄱㅣ',
    (s) => s + 'ㄱㅔ',
    (s) => s + 'ㅈㅣ',
    (s) => s + 'ㅈㅛ',
  ];

  // 표준어 조사가 체언 받침에 맞는지 (받침 있을 때 / 없을 때)
  const STD_PAIRS = [['이', '가'], ['은', '는'], ['을', '를'], ['과', '와'], ['으로', '로'], ['이랑', '랑'], ['이나', '나'], ['이에요', '예요'], ['이에요', '에요']];
  function stdParticleOk(noun, p) {
    const b = batchim(noun);
    for (const [withB, without] of STD_PAIRS) {
      if (p.startsWith(withB) && !(withB === '이' && p !== '이')) {
        if (withB === '으로') return b.has && !b.rieul;
        return b.has;
      }
      if (p.startsWith(without) && p.length - without.length <= 1) {
        if (without === '로') return !b.has || b.rieul;
        if (without === '에요') return false;
        return !b.has;
      }
    }
    return true;
  }
  const STD_PARTICLES = ['예요', '이에요', ...[...PARTICLES.keys()].filter((p) => !['예요', '이에요', '에요'].includes(p))];

  const lookup = (w) => WORDS[w] || (KEEP.has(w) ? w : RN[w]);
  const BASIC = new Set(STEMS.filter((st) => st.s === st.g).map((st) => st.s));   // 표준어와 같은 꼴의 기본 용언
  const ENDING_ORDER_HADA = [(s) => s + 'ㄱㅔ', ...STD_ENDINGS];   // ○○ᄒᆞ게 → ○○하게 (하자 보다 먼저)
  const EXTRA_STEMS = ['나'].map((std) => ({ s: toJamo(std), g: toJamo(std), pos: '동' }));   // 잘나 · 생겨나 보다 먼저

  function standardWord(w, ctx) {
    const found = lookup(w);
    if (found) return found;
    if (w in N || PRONOUNS.has(w)) return w;   // 표준어 낱말

    // 체언 + 조사 (사전에 있는 체언)
    for (let i = w.length - 1; i >= 1; i--) {
      const noun = lookup(w.slice(0, i)) || (w.slice(0, i) in N ? w.slice(0, i) : null);
      if (!noun) continue;
      const rest = w.slice(i);
      if (rest in PARTICLES) return noun + rest;
      for (const [jp, withB, without] of JEJU_PARTICLES) {
        if (rest === jp) return noun + (batchim(noun).has ? withB : without);
      }
      for (const p of STD_PARTICLES) {
        if (stdParticleOk(noun, p) && translateNoun(noun + p, ctx) === w) return noun + p;
      }
    }

    // 용언: 제주어 어간이 낱말 앞머리와 맞는 어간만 후보로 (기본 용언 먼저, 그다음 긴 어간)
    const j = toJamo(w);
    const cands = [...EXTRA_STEMS, ...STEMS].filter((st) => j.startsWith(st.g.length > 2 ? st.g.slice(0, -1) : st.g))
      .sort((a, b) => (BASIC.has(b.s) - BASIC.has(a.s)) || (b.g.length - a.g.length));
    // '○○ᄒᆞ다' → '○○하다'
    const hada = j.lastIndexOf('ㅎ' + ARAEA);
    if (hada > 0) {
      const head = fromJamo(j.slice(0, hada));
      const std = lookup(head) || roughStandard(head);
      cands.unshift({ s: toJamo(std) + 'ㅎㅏ', g: j.slice(0, hada + 2), pos: '?', hadaHead: std });
    }
    for (const st of cands) {
      const std = st.hadaHead ? st.hadaHead + '하' : fromJamo(st.s);
      for (const make of st.hadaHead ? ENDING_ORDER_HADA : STD_ENDINGS) {
        const word = fromJamo(make(st.s, ctx.q, std));
        const back = st.hadaHead ? translate(word + (ctx.q ? '?' : '')).replace(/\?$/, '') : translateVerb(word, ctx, [st]);
        if (back === w) return word;
      }
    }

    // 사전에 없는 체언 + 조사
    for (let i = w.length - 1; i >= 1; i--) {
      const noun = w.slice(0, i);
      if (/[ᄀ-ᇿ]/.test(noun)) continue;
      const rest = w.slice(i);
      for (const [jp, withB, without] of JEJU_PARTICLES) {
        if (rest === jp) return noun + (batchim(noun).has ? withB : without);
      }
    }
    return null;
  }

  // 못 찾은 낱말: 흔한 제주어 말끝만 표준어로, 아래아(ᄒᆞ → 하)는 읽기 쉽게
  const ENDING_FIXES = [
    [/ㅎㅏㅇㅕㅅ(?=ㅇㅓ|ㅈㅜ|ㄷㅓㄴ|ㅅㅜ|ㅈㅓ|$)/, 'ㅎㅐㅆ'],                                   // ᄒᆞ엿어 → 했어
    [/([ㅏㅓㅕ])ㅅ(?=ㅇㅓ|ㅈㅜ|ㄷㅓㄴ|ㅅㅜ|ㅈㅓ)/, '$1ㅆ'],                                   // 웃엇던 → 웃었던
    [/ㅆㅅㅜㄷㅏ$/, 'ㅆㅇㅓㅇㅛ'],                                                           // 걸엇수다 → 걸었어요
    [/ㅆㅈㅓ$/, 'ㅆㄷㅏ'],
    [/ㅈㅜㅁㅏㄴㅡㄴ$/, 'ㅈㅣㅁㅏㄴ'],                                                       // 아니주마는 → 아니지만
    [/ㅋㅡㄹㅏ$/, 'ㄹㄱㅔ'],                                                                 // 주크라 → 줄게
    [/(ㅇㅡ)?ㅋㅣㅇㅕ$/, 'ㄱㅔㅆㅇㅓ'],                                                      // 좋으키여 → 좋겠어
    [/ㅋㅜㄷㅏ$/, 'ㄱㅔㅆㅇㅓㅇㅛ'],                                                         // 가쿠다 → 가겠어요
    [/ㅇㅕㅁㅈㅓ$/, 'ㄱㅗ ㅇㅣㅆㅇㅓ'],                                                     // 잘ᄒᆞ염저 → 잘하고 있어
    [/ㅁㅅㅣㄴㅑ$/, 'ㄴㅣ'],                                                                // 지냄시냐 → 지내니
    [/ㅁㅓㅇ$/, 'ㅁㅕㄴㅅㅓ'],                                                               // 맞으멍 → 맞으면서
    [/([ㅏㅓ])ㅅㅣㅁㅣㄴ$/, '$1ㅆㅇㅡㅁㅕㄴ'],                                              // 말아시민 → 말았으면
    [/([ㅏㅓ])ㅅㅣ(?=ㅈㅜ)/, '$1ㅆ'],                                                      // 늦어시주마는 → 늦었지만
    [/ㅁㅣㄴ$/, 'ㅁㅕㄴ'],                                                                  // 되민 → 되면
    [/ㄷㅏㄴ$/, 'ㄷㅏㄱㅏ'],                                                                // 걷단 → 걷다가
    [/ㄱㅗㄱ$/, 'ㄱㅗ'],                                                                    // ᄒᆞ곡 → 하고
    [/ㄷㅔㄴ$/, 'ㄷㅏㄴㅡㄴ'],                                                               // 고맙덴 → 고맙다는
    [/ㄷㅣ$/, 'ㄷㅔ'],                                                                      // 가는디 → 가는데
  ];
  function roughStandard(w) {
    const at = w.lastIndexOf('ᄒᆞ');
    if (at > 0 && lookup(w.slice(0, at))) w = lookup(w.slice(0, at)) + w.slice(at);   // 펜안ᄒᆞ곡 → 편안ᄒᆞ곡
    let j = toJamo(w.replace(/ᄀᆞᆯ아/g, '말해')).replaceAll(ARAEA, 'ㅏ').replaceAll(SSANG_ARAEA, 'ㅛ');
    if (w.length > 1 && !(w in N)) for (const [re, to] of ENDING_FIXES) j = j.replace(re, to);
    return fromJamo(j).replace(/셍각/g, '생각').replace(/하여$/, '해');
  }

  const REVERSE_PHRASES = [
    [/ᄒᆞᆫ저\s*옵서/g, '어서 오세요'],
    [/고맙수다/g, '고맙습니다'],
  ];

  function toStandard(text) {
    let src = text;
    for (const [re, std] of REVERSE_PHRASES) src = src.replace(re, HOLD_OPEN + std + HOLD_CLOSE);
    const parts = src.split(new RegExp(`(${HOLD_OPEN}[^${HOLD_CLOSE}]*${HOLD_CLOSE}|[가-힣ᄀ-ᇿ]+)`));
    const out = parts.map((part, i) => {
      if (i % 2 === 0) return part;
      if (part[0] === HOLD_OPEN) return part.slice(1, -1);
      const after = parts[i + 1] || '';
      const next = /^\s+$/.test(after) ? (parts[i + 2] || '') : '';
      // '-고정 ᄒᆞ다' = '-고 싶다'
      if (part.endsWith('고정') && next.startsWith('ᄒᆞ')) {
        const head = part.slice(0, -2);
        const verb = standardWord(head + '곡', {}) || roughStandard(head + '곡');
        return verb.endsWith('고') ? verb : roughStandard(head) + '고';
      }
      if (/^\s+$/.test(parts[i - 1] || '') && (parts[i - 2] || '').endsWith('고정') && part.startsWith('ᄒᆞ')) {
        const sip = STEMS[STEMS.length - 1];   // 싶 → ᄒᆞ
        const q = /^\s*\?/.test(after);
        for (const make of STD_ENDINGS) {
          const word = fromJamo(make(sip.s, q, '싶'));
          if (translateVerb(word, { q, next: '' }, [sip]) === part) return word;
        }
      }
      const ctx = { q: /^\s*\?/.test(after), next: next[0] || '' };
      return standardWord(part, ctx) || roughStandard(part);
    });
    return out.join('');
  }

  window.translateToStandard = toStandard;
})();
