export default function Illustration({ color, idx = 0 }) {
  const c = color;
  const a = (n) => c + n;
  const ills = [
    // 0: Resume + score ring
    <svg key="0" viewBox="0 0 320 180" fill="none" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="320" height="180" fill={a('14')} />
      <rect x="72" y="20" width="96" height="130" rx="6" fill={a('1a')} stroke={a('50')} strokeWidth="1.5" />
      <rect x="84" y="36" width="72" height="7" rx="3" fill={a('70')} />
      <rect x="84" y="50" width="54" height="4" rx="2" fill={a('40')} />
      <rect x="84" y="62" width="64" height="3" rx="1.5" fill={a('28')} />
      <rect x="84" y="69" width="48" height="3" rx="1.5" fill={a('28')} />
      <rect x="84" y="82" width="38" height="5" rx="2" fill={a('50')} />
      <rect x="84" y="93" width="68" height="3" rx="1.5" fill={a('28')} />
      <rect x="84" y="100" width="58" height="3" rx="1.5" fill={a('28')} />
      <rect x="84" y="114" width="36" height="5" rx="2" fill={a('50')} />
      <rect x="84" y="125" width="60" height="3" rx="1.5" fill={a('28')} />
      <circle cx="230" cy="80" r="44" fill={a('12')} stroke={a('30')} strokeWidth="1.5" />
      <text x="230" y="74" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="22" fontWeight="600" fill={a('cc')}>84%</text>
      <text x="230" y="90" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="10" fill={a('80')}>match</text>
      <path d="M200 130 L215 118 L228 124 L245 108 L260 96" stroke={a('60')} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>,
    // 1: Neural atom
    <svg key="1" viewBox="0 0 320 180" fill="none" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="320" height="180" fill={a('10')} />
      <circle cx="160" cy="90" r="10" fill={a('cc')} />
      <circle cx="160" cy="90" r="44" stroke={a('35')} strokeWidth="1.5" fill="none" />
      <ellipse cx="160" cy="90" rx="70" ry="28" stroke={a('30')} strokeWidth="1.2" fill="none" />
      <ellipse cx="160" cy="90" rx="70" ry="28" stroke={a('30')} strokeWidth="1.2" fill="none" transform="rotate(60 160 90)" />
      <ellipse cx="160" cy="90" rx="70" ry="28" stroke={a('30')} strokeWidth="1.2" fill="none" transform="rotate(120 160 90)" />
      <circle cx="230" cy="56" r="6" fill={a('60')} />
      <circle cx="90" cy="120" r="5" fill={a('60')} />
      <circle cx="228" cy="124" r="4" fill={a('40')} />
      <circle cx="92" cy="58" r="4" fill={a('40')} />
      <circle cx="160" cy="20" r="4" fill={a('40')} />
      <text x="160" y="164" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="9" fill={a('70')} letterSpacing="2">ATOMIZATION</text>
    </svg>,
    // 2: Growth chart
    <svg key="2" viewBox="0 0 320 180" fill="none" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="320" height="180" fill={a('10')} />
      <path d="M50 150 L90 128 L130 108 L170 82 L210 54 L260 30" stroke={a('80')} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 150 L90 128 L130 108 L170 82 L210 54 L260 30 L260 170 L50 170Z" fill={a('14')} />
      {[[50, 150], [90, 128], [130, 108], [170, 82], [210, 54], [260, 30]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.5" fill={a('99')} stroke={a('cc')} strokeWidth="1" />
      ))}
      <rect x="58" y="24" width="80" height="26" rx="5" fill={a('20')} stroke={a('40')} strokeWidth="1" />
      <text x="98" y="41" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="11" fontWeight="600" fill={a('cc')}>43% → 91%</text>
      <line x1="40" y1="170" x2="280" y2="170" stroke={a('25')} strokeWidth="1" />
    </svg>,
    // 3: Filter funnel + checkmark
    <svg key="3" viewBox="0 0 320 180" fill="none" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="320" height="180" fill={a('10')} />
      <path d="M90 35 L230 35 L188 85 L188 148 L132 148 L132 85 Z" fill={a('1a')} stroke={a('50')} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="112" y="96" width="96" height="9" rx="4.5" fill={a('50')} />
      <rect x="122" y="113" width="76" height="9" rx="4.5" fill={a('35')} />
      <text x="160" y="75" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="10" fill={a('90')}>ATS</text>
      <circle cx="248" cy="116" r="24" fill={a('18')} stroke={a('40')} strokeWidth="1.5" />
      <path d="M237 116 l7 7 12-14" stroke={a('90')} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>,
    // 4: Memory vault
    <svg key="4" viewBox="0 0 320 180" fill="none" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="320" height="180" fill={a('10')} />
      <rect x="90" y="40" width="140" height="100" rx="10" fill={a('18')} stroke={a('40')} strokeWidth="1.5" />
      <rect x="108" y="60" width="104" height="10" rx="5" fill={a('55')} />
      <rect x="108" y="78" width="80" height="7" rx="3.5" fill={a('30')} />
      <rect x="108" y="92" width="92" height="7" rx="3.5" fill={a('30')} />
      <rect x="108" y="106" width="68" height="7" rx="3.5" fill={a('30')} />
      <circle cx="160" cy="128" r="10" fill={a('60')} />
      <path d="M155 128 l4 4 7-7" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="238" cy="50" r="20" fill={a('20')} stroke={a('40')} strokeWidth="1" />
    </svg>,
    // 5: Stacked resumes
    <svg key="5" viewBox="0 0 320 180" fill="none" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="320" height="180" fill={a('10')} />
      <rect x="88" y="52" width="84" height="110" rx="5" fill={a('0e')} stroke={a('28')} strokeWidth="1" />
      <rect x="100" y="38" width="84" height="110" rx="5" fill={a('14')} stroke={a('35')} strokeWidth="1" />
      <rect x="112" y="24" width="84" height="110" rx="5" fill={a('1c')} stroke={a('50')} strokeWidth="1.5" />
      <rect x="125" y="40" width="56" height="7" rx="3" fill={a('70')} />
      <rect x="125" y="54" width="42" height="4" rx="2" fill={a('40')} />
      <rect x="125" y="66" width="50" height="3" rx="1.5" fill={a('28')} />
      <rect x="125" y="73" width="38" height="3" rx="1.5" fill={a('28')} />
      <rect x="125" y="85" width="36" height="5" rx="2" fill={a('50')} />
      <rect x="125" y="96" width="52" height="3" rx="1.5" fill={a('28')} />
      <circle cx="238" cy="100" r="30" fill={a('18')} stroke={a('40')} strokeWidth="1.5" />
      <text x="238" y="106" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="13" fontWeight="600" fill={a('cc')}>↑5</text>
    </svg>,
  ];
  return ills[((idx % 6) + 6) % 6];
}

export function HeroIllustration() {
  return (
    <svg viewBox="0 0 1100 360" fill="none" style={{ width: '100%', height: '100%', display: 'block' }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="heroGrad" x1="0" y1="0" x2="1100" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4f6ef7" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <rect width="1100" height="360" fill="url(#heroGrad)" />
      <rect x="120" y="60" width="180" height="240" rx="10" fill="#4f6ef7" fillOpacity="0.08" stroke="#4f6ef7" strokeOpacity="0.2" strokeWidth="1.5" />
      <rect x="140" y="85" width="140" height="10" rx="5" fill="#4f6ef7" fillOpacity="0.4" />
      <rect x="140" y="103" width="100" height="6" rx="3" fill="#4f6ef7" fillOpacity="0.2" />
      <rect x="140" y="118" width="120" height="5" rx="2.5" fill="#4f6ef7" fillOpacity="0.15" />
      <rect x="140" y="127" width="90" height="5" rx="2.5" fill="#4f6ef7" fillOpacity="0.15" />
      <rect x="140" y="145" width="80" height="7" rx="3" fill="#4f6ef7" fillOpacity="0.25" />
      <rect x="140" y="159" width="130" height="5" rx="2.5" fill="#4f6ef7" fillOpacity="0.15" />
      <rect x="140" y="168" width="110" height="5" rx="2.5" fill="#4f6ef7" fillOpacity="0.15" />
      <rect x="140" y="177" width="95" height="5" rx="2.5" fill="#4f6ef7" fillOpacity="0.15" />
      <rect x="140" y="195" width="80" height="7" rx="3" fill="#4f6ef7" fillOpacity="0.25" />
      <rect x="140" y="209" width="125" height="5" rx="2.5" fill="#4f6ef7" fillOpacity="0.15" />
      <rect x="140" y="218" width="100" height="5" rx="2.5" fill="#4f6ef7" fillOpacity="0.15" />
      <rect x="130" y="268" width="66" height="22" rx="6" fill="#4f6ef7" fillOpacity="0.12" stroke="#4f6ef7" strokeOpacity="0.3" strokeWidth="1" />
      <text x="163" y="283" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="10" fontWeight="600" fill="#4f6ef7" fillOpacity="0.7">63% match</text>
      <path d="M330 180 L420 180" stroke="#4f6ef7" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 4" opacity="0.4" />
      <path d="M408 172 L420 180 L408 188" stroke="#4f6ef7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <text x="375" y="165" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="11" fill="#4f6ef7" fillOpacity="0.6">tailored by</text>
      <text x="375" y="178" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="10" fontWeight="600" fill="#4f6ef7" fillOpacity="0.8">RolePitch</text>
      <rect x="440" y="50" width="180" height="260" rx="10" fill="#22c55e" fillOpacity="0.07" stroke="#22c55e" strokeOpacity="0.3" strokeWidth="1.5" />
      <rect x="460" y="75" width="140" height="10" rx="5" fill="#22c55e" fillOpacity="0.5" />
      <rect x="460" y="93" width="100" height="6" rx="3" fill="#22c55e" fillOpacity="0.25" />
      <rect x="460" y="112" width="80" height="7" rx="3" fill="#22c55e" fillOpacity="0.35" />
      <rect x="460" y="126" width="148" height="5" rx="2.5" fill="#22c55e" fillOpacity="0.5" />
      <rect x="460" y="135" width="130" height="5" rx="2.5" fill="#22c55e" fillOpacity="0.4" />
      <rect x="460" y="144" width="120" height="5" rx="2.5" fill="#22c55e" fillOpacity="0.35" />
      <rect x="460" y="162" width="80" height="7" rx="3" fill="#22c55e" fillOpacity="0.35" />
      <rect x="460" y="176" width="148" height="5" rx="2.5" fill="#22c55e" fillOpacity="0.5" />
      <rect x="460" y="185" width="125" height="5" rx="2.5" fill="#22c55e" fillOpacity="0.35" />
      <rect x="460" y="203" width="80" height="7" rx="3" fill="#22c55e" fillOpacity="0.35" />
      <rect x="460" y="217" width="140" height="5" rx="2.5" fill="#22c55e" fillOpacity="0.35" />
      <rect x="460" y="226" width="110" height="5" rx="2.5" fill="#22c55e" fillOpacity="0.25" />
      <rect x="450" y="278" width="66" height="22" rx="6" fill="#22c55e" fillOpacity="0.15" stroke="#22c55e" strokeOpacity="0.4" strokeWidth="1" />
      <text x="483" y="293" textAnchor="middle" fontFamily="JetBrains Mono,monospace" fontSize="10" fontWeight="600" fill="#22c55e" fillOpacity="0.9">84% match</text>
      <rect x="680" y="80" width="220" height="200" rx="12" fill="white" fillOpacity="0.5" stroke="#4f6ef7" strokeOpacity="0.12" strokeWidth="1" />
      <text x="700" y="112" fontFamily="JetBrains Mono,monospace" fontSize="10" fontWeight="600" fill="#4f6ef7" fillOpacity="0.5" letterSpacing="2">ANALYSIS</text>
      {[
        { label: 'Before', val: '63%', color: '#4f6ef7', y: 140 },
        { label: 'After', val: '84%', color: '#22c55e', y: 180 },
        { label: 'Improvement', val: '+21%', color: '#22c55e', y: 220 },
        { label: 'Bullets rewritten', val: '2 of 5', color: '#f59e0b', y: 252 },
      ].map(({ label, val, color, y }) => (
        <g key={y}>
          <text x="700" y={y} fontFamily="DM Sans,sans-serif" fontSize="11" fill="#6b7280">{label}</text>
          <text x="888" y={y} textAnchor="end" fontFamily="JetBrains Mono,monospace" fontSize="11" fontWeight="600" fill={color}>{val}</text>
        </g>
      ))}
      <circle cx="950" cy="80" r="40" fill="#4f6ef7" fillOpacity="0.04" />
      <circle cx="950" cy="280" r="60" fill="#22c55e" fillOpacity="0.04" />
      <circle cx="60" cy="310" r="50" fill="#4f6ef7" fillOpacity="0.04" />
    </svg>
  );
}
