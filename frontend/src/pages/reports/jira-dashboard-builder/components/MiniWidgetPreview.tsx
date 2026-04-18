import { COLOR_VIOLET, COLOR_AMBER_DARK, COLOR_EMERALD, COLOR_ERROR, COLOR_WARNING } from '../../../../brandTokens';

const MINI_SAMPLE_BAR = [4,7,3,9,5,6,8];
const MINI_SAMPLE_LINE = [3,5,4,7,6,8,5,9];
const MINI_SAMPLE_PIE = [{v:40},{v:25},{v:20},{v:15}];

export function MiniWidgetPreview({ type, color }: { type: string; color: string }) {
  const h = 52;
  const barW = 8, gap = 3, barMax = Math.max(...MINI_SAMPLE_BAR);
  const lineMax = Math.max(...MINI_SAMPLE_LINE), lineMin = Math.min(...MINI_SAMPLE_LINE);
  const linePoints = MINI_SAMPLE_LINE.map((v, i) => {
    const x = 4 + i * (92 / (MINI_SAMPLE_LINE.length - 1));
    const y = h - 6 - ((v - lineMin) / (lineMax - lineMin)) * (h - 12);
    return `${x},${y}`;
  }).join(' ');

  const barSvg = (
    <svg width="100%" height={h} viewBox={`0 0 80 ${h}`} preserveAspectRatio="none">
      {MINI_SAMPLE_BAR.map((v, i) => {
        const bh = (v / barMax) * (h - 8);
        return <rect key={i} x={4 + i * (barW + gap)} y={h - bh - 4} width={barW} height={bh} rx={2} fill={color} opacity={0.7 + (i === 3 ? 0.3 : 0)} />;
      })}
    </svg>
  );
  const lineSvg = (
    <svg width="100%" height={h} viewBox={`0 0 100 ${h}`} preserveAspectRatio="none">
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`${linePoints} 96,${h} 4,${h}`} fill={color} opacity={0.15} />
    </svg>
  );
  const pieSvg = (
    <svg width="100%" height={h} viewBox="0 0 60 60" preserveAspectRatio="xMidYMid meet">
      {(() => {
        let angle = -Math.PI / 2;
        const cx = 30, cy = 30, r = 22, ir = 12;
        const colors = [color, COLOR_VIOLET, COLOR_AMBER_DARK, COLOR_EMERALD];
        return MINI_SAMPLE_PIE.map((seg, i) => {
          const sweep = (seg.v / 100) * 2 * Math.PI;
          const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
          const x2 = cx + r * Math.cos(angle + sweep), y2 = cy + r * Math.sin(angle + sweep);
          const xi1 = cx + ir * Math.cos(angle), yi1 = cy + ir * Math.sin(angle);
          const xi2 = cx + ir * Math.cos(angle + sweep), yi2 = cy + ir * Math.sin(angle + sweep);
          const large = sweep > Math.PI ? 1 : 0;
          const d = `M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ir} ${ir} 0 ${large} 0 ${xi1} ${yi1}`;
          angle += sweep;
          return <path key={i} d={d} fill={colors[i % colors.length]} opacity={0.85} />;
        });
      })()}
    </svg>
  );
  const tableSvg = (
    <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
      <rect x="2" y="2" width="86" height="10" rx="2" fill={color} opacity="0.5" />
      {[16,26,36,46].map(y => (
        <g key={y}>
          <rect x="2" y={y} width="34" height="7" rx="1" fill={color} opacity="0.15" />
          <rect x="40" y={y} width="20" height="7" rx="1" fill={color} opacity="0.15" />
          <rect x="64" y={y} width="24" height="7" rx="1" fill={color} opacity="0.15" />
        </g>
      ))}
    </svg>
  );
  const gaugeSvg = (
    <svg width="100%" height={h} viewBox="0 0 80 52" preserveAspectRatio="xMidYMid meet">
      <path d="M 12 44 A 28 28 0 0 1 68 44" fill="none" stroke="#E2E8F0" strokeWidth="6" strokeLinecap="round"/>
      <path d="M 12 44 A 28 28 0 0 1 52 17" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      <text x="40" y="42" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>73%</text>
    </svg>
  );
  const heatSvg = (
    <svg width="100%" height={h} viewBox="0 0 84 52" preserveAspectRatio="none">
      {Array.from({length:5}).map((_,row) => Array.from({length:7}).map((_,col) => {
        const v = Math.random();
        return <rect key={`${row}-${col}`} x={4+col*11} y={4+row*9} width={9} height={7} rx={1} fill={color} opacity={0.1 + v * 0.8} />;
      }))}
    </svg>
  );
  const kpiSvg = (
    <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="xMidYMid meet">
      {[{x:4,w:24,val:'507'},{x:32,w:24,val:'42'},{x:60,w:28,val:'18%'}].map((k,i) => (
        <g key={i}>
          <rect x={k.x} y="4" width={k.w} height="44" rx="3" fill={color} opacity={0.1+i*0.05} />
          <text x={k.x+k.w/2} y="30" textAnchor="middle" fontSize="10" fontWeight="bold" fill={color}>{k.val}</text>
        </g>
      ))}
    </svg>
  );
  const radarSvg = (
    <svg width="100%" height={h} viewBox="0 0 60 60" preserveAspectRatio="xMidYMid meet">
      {[0,1,2,3,4].map(i => {
        const a = (i/5)*2*Math.PI - Math.PI/2;
        return <line key={i} x1={30} y1={30} x2={30+26*Math.cos(a)} y2={30+26*Math.sin(a)} stroke="#E2E8F0" strokeWidth={1}/>;
      })}
      <polygon points={[0,1,2,3,4].map(i => { const a=(i/5)*2*Math.PI-Math.PI/2, r=[0.8,0.6,0.9,0.7,0.85][i]*22; return `${30+r*Math.cos(a)},${30+r*Math.sin(a)}`; }).join(' ')} fill={color} opacity={0.3} stroke={color} strokeWidth={1.5}/>
    </svg>
  );
  const funnelSvg = (
    <svg width="100%" height={h} viewBox="0 0 70 52" preserveAspectRatio="none">
      {[{y:4,w:60,v:'100'},{y:16,w:44,v:'72'},{y:28,w:28,v:'48'},{y:40,w:16,v:'31'}].map((s,i) => (
        <g key={i}>
          <rect x={(70-s.w)/2} y={s.y} width={s.w} height={10} rx={2} fill={color} opacity={0.9-i*0.15}/>
        </g>
      ))}
    </svg>
  );

  const previewMap: Record<string, React.ReactNode> = {
    kpis: kpiSvg, singleKpi: kpiSvg, trendSpark: kpiSvg, ratioKpi: kpiSvg,
    donut: pieSvg, statusCategoryDonut: pieSvg, resolutionDonut: pieSvg,
    horizontalBar: (
      <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
        {MINI_SAMPLE_BAR.map((v,i) => <rect key={i} x={4} y={4+i*7} width={v/barMax*80} height={5} rx={2} fill={color} opacity={0.6+i*0.04}/>)}
      </svg>
    ),
    stackedBar: barSvg, velocityChart: barSvg, throughputHist: barSvg, teamComparison: barSvg,
    lineChart: lineSvg, bugTrend: lineSvg, resolutionTime: lineSvg, openTrend: lineSvg,
    createdVsResolved: (
      <svg width="100%" height={h} viewBox="0 0 100 52" preserveAspectRatio="none">
        <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2"/>
        <polyline points={MINI_SAMPLE_LINE.map((v,i)=>{const x=4+i*(92/(MINI_SAMPLE_LINE.length-1));const y=h-6-((v-lineMin)/(lineMax-lineMin))*(h-12)*0.7+8;return `${x},${y}`;}).join(' ')} fill="none" stroke={COLOR_ERROR} strokeWidth="2"/>
      </svg>
    ),
    gauge: gaugeSvg,
    heatmap: heatSvg,
    radarChart: radarSvg,
    treemap: (
      <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
        <rect x="2" y="2" width="50" height="30" rx="2" fill={color} opacity="0.7"/>
        <rect x="54" y="2" width="34" height="14" rx="2" fill={COLOR_VIOLET} opacity="0.7"/>
        <rect x="54" y="18" width="34" height="14" rx="2" fill={COLOR_AMBER_DARK} opacity="0.7"/>
        <rect x="2" y="34" width="28" height="16" rx="2" fill={COLOR_EMERALD} opacity="0.7"/>
        <rect x="32" y="34" width="56" height="16" rx="2" fill={color} opacity="0.4"/>
      </svg>
    ),
    funnelChart: funnelSvg,
    scatterPlot: (
      <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
        {[[15,30,12],[35,18,8],[55,38,16],[70,12,6],[45,42,18],[25,10,5],[60,28,10]].map(([x,y,r],i)=>(
          <circle key={i} cx={x} cy={y} r={r/2} fill={color} opacity={0.5+i*0.06}/>
        ))}
      </svg>
    ),
    cycleTimeScatter: (
      <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
        {[[10,40,4],[20,25,3],[30,15,3],[45,35,5],[55,10,3],[65,42,4],[75,20,4],[40,48,5]].map(([x,y,r],i)=>(
          <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.6}/>
        ))}
      </svg>
    ),
    countdown: (
      <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="xMidYMid meet">
        <text x="45" y="36" textAnchor="middle" fontSize="28" fontWeight="bold" fill={color} opacity="0.8">14d</text>
      </svg>
    ),
    cumulativeFlow: lineSvg, sprintBurndown: lineSvg, averageAge: barSvg,
    cycleTime: barSvg, aging: barSvg,
    pivotTable: tableSvg, issueTable: tableSvg, twoDimensional: tableSvg,
    monthlySummary: tableSvg, assigneeLeaderboard: tableSvg,
    workload: (
      <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
        {[{w:70,c:color},{w:50,c:COLOR_ERROR},{w:35,c:COLOR_WARNING}].map((b,i)=>(
          <rect key={i} x="4" y={4+i*16} width={b.w} height="12" rx={2} fill={b.c} opacity="0.7"/>
        ))}
      </svg>
    ),
    epicProgress: (
      <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
        {[0.82,0.64,0.41,0.91].map((v,i)=>(
          <g key={i}>
            <rect x="4" y={4+i*12} width="82" height="8" rx="2" fill="#E2E8F0"/>
            <rect x="4" y={4+i*12} width={v*82} height="8" rx="2" fill={color} opacity="0.75"/>
          </g>
        ))}
      </svg>
    ),
    releaseNotes: tableSvg, supportQueueSummary: tableSvg,
    worklogByAuthor: (
      <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
        {[0.9,0.7,0.55,0.4,0.25].map((v,i)=><rect key={i} x="4" y={4+i*9} width={v*80} height="6" rx="2" fill={color} opacity={0.8-i*0.1}/>)}
      </svg>
    ),
    worklogTimeline: tableSvg,
    productivityComparison: barSvg,
    pivotBuilder: (
      <svg width="100%" height={h} viewBox="0 0 90 52" preserveAspectRatio="none">
        {/* header row */}
        <rect x="2" y="2" width="86" height="9" rx="2" fill={color} opacity="0.5" />
        {/* row labels + cells */}
        {[14, 24, 34, 44].map((y, ri) => (
          <g key={ri}>
            <rect x="2" y={y} width="20" height="7" rx="1" fill={color} opacity="0.2" />
            {[24, 38, 52, 66, 80].map((x, ci) => (
              <rect key={ci} x={x} y={y} width="10" height="7" rx="1" fill={color} opacity={0.1 + (ri + ci) * 0.07} />
            ))}
          </g>
        ))}
      </svg>
    ),
  };

  const preview = previewMap[type] ?? barSvg;
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}08 0%, ${color}15 100%)`,
      borderBottom: `1px solid ${color}20`,
      height: h,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '4px 8px',
    }}>
      {preview}
    </div>
  );
}
