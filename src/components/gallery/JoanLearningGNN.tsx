import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const NODE_LINKS: Record<string, string> = {
  GCN:'/knowledge?topic=GCN',GAT:'/knowledge?topic=GAT',GraphSAGE:'/knowledge?topic=GraphSAGE',
  GIN:'/knowledge?topic=GIN',CrossEntropy:'/knowledge?topic=CrossEntropy',
  Contrastive:'/knowledge?topic=ContrastiveLoss',Triplet:'/knowledge?topic=TripletLoss',
  Cora:'/knowledge?topic=CoraDataset',PubMed:'/knowledge?topic=PubMedDataset',
  Reddit:'/knowledge?topic=RedditDataset',MessagePassing:'/knowledge?topic=MessagePassing',
  Aggregation:'/knowledge?topic=Aggregation',Embedding:'/knowledge?topic=NodeEmbedding',
  Attention:'/knowledge?topic=AttentionMechanism',Spectral:'/knowledge?topic=SpectralGraph',
};
interface KnowledgeNode{id:string;label:string;labelCn?:string;type:'gnn'|'loss'|'dataset'|'basic';orbitIndex:number;angleOffset:number;speed:number}
const N:KnowledgeNode[]=[
  {id:'g1',label:'GCN',type:'gnn',orbitIndex:0,angleOffset:0,speed:1.2},
  {id:'g2',label:'GAT',type:'gnn',orbitIndex:0,angleOffset:120,speed:1},
  {id:'g3',label:'GraphSAGE',type:'gnn',orbitIndex:0,angleOffset:240,speed:0.9},
  {id:'l1',label:'CrossEntropy',type:'loss',orbitIndex:1,angleOffset:45,speed:0.8},
  {id:'l2',label:'Contrastive',type:'loss',orbitIndex:1,angleOffset:165,speed:0.75},
  {id:'l3',label:'Triplet',type:'loss',orbitIndex:1,angleOffset:285,speed:0.7},
  {id:'d1',label:'Cora',type:'dataset',orbitIndex:1,angleOffset:105,speed:0.85},
  {id:'d2',label:'PubMed',type:'dataset',orbitIndex:1,angleOffset:225,speed:0.8},
  {id:'b1',label:'MessagePassing',labelCn:'消息传递',type:'basic',orbitIndex:2,angleOffset:15,speed:0.5},
  {id:'b2',label:'Aggregation',labelCn:'聚合函数',type:'basic',orbitIndex:2,angleOffset:87,speed:0.55},
  {id:'b3',label:'Embedding',labelCn:'节点嵌入',type:'basic',orbitIndex:2,angleOffset:159,speed:0.5},
  {id:'b4',label:'Attention',labelCn:'注意力机制',type:'basic',orbitIndex:2,angleOffset:231,speed:0.45},
  {id:'b5',label:'Spectral',labelCn:'谱域方法',type:'basic',orbitIndex:2,angleOffset:303,speed:0.4},
  {id:'g4',label:'GIN',type:'gnn',orbitIndex:2,angleOffset:330,speed:0.48},
  {id:'d3',label:'Reddit',type:'dataset',orbitIndex:2,angleOffset:195,speed:0.52},
];
const TC={gnn:{f:'#4DA6FF',s:'#2178C7',t:'#FFF',sh:'hex'as const},loss:{f:'#FF7F50',s:'#E55B3B',t:'#FFF',sh:'circle'as const},dataset:{f:'#00C9A7',s:'#01A084',t:'#FFF',sh:'rect'as const},basic:{f:'#A78BFA',s:'#8B5CF6',t:'#FFF',sh:'diamond'as const}};
const ORB=[{rx:200,ry:120},{rx:320,ry:185},{rx:470,ry:270}];
const CY=260,OY=220;
export default function J(){
  const nav=useNavigate();const sr=useRef<SVGSVGElement>(null);const[hv,setHv]=useState<string|null>(null);
  const[rm]=useState(()=>typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion:reduce)').matches);
  useEffect(()=>{if(rm)return;const s=sr.current;if(!s)return;
    const ns=s.querySelectorAll('[data-on]'),t0=Date.now();let ai:number;
    function tk(){const e=(Date.now()-t0)/1000;
      ns.forEach(g=>{const el=g as SVGGElement,oi=+el.dataset.oi!,of=+el.dataset.of!,sp=+el.dataset.sp!;
        const ob=ORB[oi]||ORB[0],a=((of+e*sp*15)%360)*Math.PI/180;
        el.setAttribute('transform','translate('+(600+ob.rx*Math.cos(a))+','+(OY+ob.ry*Math.sin(a))+')');});
      ai=requestAnimationFrame(tk);}tk();return()=>cancelAnimationFrame(ai);},[rm]);
  const sh=(ty:string,sz:number)=>{const c=TC[ty]||TC.gnn;
    switch(c.sh){case'hex':return<polygon points={'0,-'+sz+' '+sz*.866+',-'+sz*.5+' '+sz*.866+','+sz*.5+' 0,'+sz+' -'+sz*.866+','+sz*.5+' -'+sz*.866+',-'+sz*.5}/>;
      case'circle':return<circle r={sz}/>;case'rect':return<rect x={-sz}y={-sz*.65}width={sz*2}height={sz*1.3}rx={5}/>;
      case'diamond':return<polygon points={'0,-'+sz+' '+sz+',0 0,'+sz+' -'+sz+',0'}/>;}}
  return(<div style={{position:'relative',width:'100%',height:560,background:'transparent',overflow:'visible'}}>
    <svg ref={sr} viewBox="0 0 1200 560" style={{width:'100%',height:'100%'}} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="gg"x="-50%"y="-50%"w="200%"h="200%"><feGaussianBlur in="SourceGraphic"stdDeviation="4"r="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="gb"x="-50%"y="-50%"w="200%"h="200%"><feGaussianBlur in="SourceGraphic"stdDeviation="3"r="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="hg"x="-80%"y="-80%"w="260%"h="260%"><feGaussianBlur stdDeviation="18"r="b"/><feFlood floodColor="#FFD700"fO=".15"r="c"/><feComposite in="c"in2="b"op="in"r="d"/><feMerge><feMergeNode in="d"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="hg"x1="0%"y1="0%"x2="0%"y2="100%"><stop offset="0%"stopColor="#FFE570"/><stop offset="25%"stopColor="#FFDD38"/><stop offset="55%"stopColor="#E8B81A"/><stop offset="100%"stopColor="#C9960C"/></linearGradient>
        <linearGradient id="hh"x1="0%"y1="0%"x2="100%"y2="0%"><stop offset="0%"stopColor="#FFF3B8"/><stop offset="40%"stopColor="#FFE066"/><stop offset="100%"stopColor="#DAA520"/></linearGradient>
        <linearGradient id="am"x1="0%"y1="0%"x2="100%"y2="100%"><stop offset="0%"stopColor="#FAFAFA"/><stop offset="30%"stopColor="#F2F2F2"/><stop offset="65%"stopColor="#E0E0E0"/><stop offset="100%"stopColor="#C4C4C4"/></linearGradient>
        <linearGradient id="gt"x1="0%"y1="0%"x2="0%"y2="100%"><stop offset="0%"stopColor="#FFE55E"/><stop offset="40%"stopColor="#FFD700"/><stop offset="100%"stopColor="#B8962E"/></linearGradient>
        <linearGradient id="cp"x1="0%"y1="0%"x2="0%"y2="100%"><stop offset="0%"stopColor="#8E44AD"/><stop offset="35%"stopColor="#71368A"/><stop offset="100%"stopColor="#4A235A"/></linearGradient>
        <linearGradient id="cw"x1="0%"y1="0%"x2="0%"y2="100%"><stop offset="0%"stopColor="#FFFFFF"/><stop offset="100%"stopColor="#EDE5F5"/></linearGradient>
        <linearGradient id="sk"x1="0%"y1="0%"x2="0%"y2="100%"><stop offset="0%"stopColor="#FFECD8"/><stop offset="55%"stopColor="#F5DEC0"/><stop offset="100%"stopColor="#EDCBA8"/></linearGradient>
        <radialGradient id="ag"cx="50%"cy="50%"r="50%"><stop offset="0%"><animate attributeName="stop-color"values="#FFD700;#FFECB3;#FFD700"dur="4s"ri="indefinite"/><animate attributeName="stop-opacity"values=".28;.14;.28"dur="4s"ri="indefinite"/></stop><stop offset="100%"stopColor="transparent"sO="0"/></radialGradient>
        <linearGradient id="cg"x1="0%"y1="0%"x2="0%"y2="100%"><stop offset="0%"stopColor="#FFE566"/><stop offset="45%"stopColor="#FFD700"/><stop offset="100%"stopColor="#DAA520"/></linearGradient>
        <linearGradient id="gp"x1="0%"y1="0%"x2="100%"y2="100%"><stop offset="0%"stopColor="#9B59B6"/><stop offset="50%"stopColor="#7D3C98"/><stop offset="100%"stopColor="#5B2C6F"/></linearGradient>
        {['gnn','loss','dataset','basic'].map(t=><filter key={'n'+t}id={'n'+t}x="-50%"y="-50%"w="200%"h="200%"><feGaussianBlur stdDeviation={t==='gnn'?6:5}r="b"/><feFlood floodColor={['#4DA6FF','#FF7F50','#00C9A7','#A78BFA'][['gnn','loss','ds','bas'].indexOf(t)]}fO=".5"r="c"/><feComposite in="c"in2="b"op="in"r="d"/><feMerge><feMergeNode in="d"/><feMergeNode in="SourceGraphic"/></feMerge></filter>)}
      </defs>
      {/* 圣光 */}
      <ellipse cx="600" cy={CY-18}rx="210"ry="250"fill="url(#ag)"/>
      {/* 轨道 */}
      {ORB.map((o,i)=><ellipse key={'o'+i}cx="600"cy={OY}rx={o.rx}ry={o.ry}fill="none"
        stroke={['rgba(77,166,255,.25)','rgba(255,127,80,.18)','rgba(167,139,250,.15)'][i]}
        strokeWidth={[1.5,1,0.8][i]}strokeDasharray={[null,'8 4','4 6'][i]as unknown as undefined}/>)}

      {/* ===== 角色组 ===== */}
      <g transform={'translate(600,'+CY+')'}>
        <g style={{transformOrigin:'center bottom'}}><animateTransform attributeName="transform"type="scale"values="1,1;1.008,1.012;1,1"dur="4s"ri="indefinite"/>
        {/* 披风 */}
        <path d="M-95,-5Q-158,72-140,158Q-118,235-52,242Q10,234 42,162Q70,88 95,-5Q114,-44 98-82Q58-118 0-112Q-64-118-98-82Z"fill="url(#cp)"opacity=".93">
          <animateTransform attributeName="transform"type="rotate"values="-2.5 0 115;3 0 115;-2.5 0 115"dur="6s"ri="indefinite"/></path>
        <path d="M-82,42Q-52,110-22,168Q18,105 48,38"fill="none"stroke="rgba(0,0,0,.14)"strokeWidth="2.2"/>
        <path d="M-62,68Q-32,128 0,180Q32,122 60,60"fill="none"stroke="rgba(0,0,0,.09)"strokeWidth="1.6"/>
        <g transform="translate(0,78)"opacity=".9"><rect x="-21"y="-34"w="42"h="82"rx="4"fill="white"opacity=".11"/>
          <rect x="-17"y="-6"w="34"h="17"rx="3"fill="url(#cw)"stroke="white"strokeWidth="1.3"/>
          <rect x="-5.5"y="-32"w="11"h="74"rx="2.5"fill="url(#cw)"stroke="white"strokeWidth="1.3"/>
          <rect x="-17"y="-6"w="34"h="17"rx="3"fill="none"stroke="#D4AF37"strokeWidth=".85"opacity=".6"/>
          <rect x="-5.5"y="-32"w="11"h="74"rx="2.5"fill="none"stroke="#D4AF37"strokeWidth=".85"opacity=".6"/>
          <circle cx="0"cy="5"r="6.5"fill="#9B59B6"stroke="#D4AF37"strokeWidth="1.2"><animate attributeName="opacity"values=".85;1;.85"dur="3s"ri="indefinite"/></circle></g>

        {/* 后层长发 */}
        <g opacity=".42">
          <path d="M-20,-162Q-30,-132-28,-86Q-25,-40-15,12Q-5,43-11,79Q-17,116-7,152"fill="none"stroke="url(#hg)"strokeWidth="24"strokeLinecap="round"/>
          <path d="M20,-162Q30,-132 28-86Q25,-40 15,12Q5,43 11,79Q17,116 7,152"fill="none"stroke="url(#hg)"strokeWidth="24"strokeLinecap="round"/>
          <path d="M-7,-160Q-14,-126-10,-80Q-5,-34-12,17"fill="none"stroke="url(#hh)"strokeWidth="11"strokeLinecap="round"opacity=".5"/>
          <path d="M7,-160Q14-126 10-80Q5,-34 12,17"fill="none"stroke="url(#hh)"strokeWidth="11"strokeLinecap="round"opacity=".5"/>
        </g>

        {/* 铠甲 */}
        <g>
          <path d="M-58,-64L58-64Q72,-33 74,9Q76,60 56,132L45,140Q23,148 0,148Q-23,148-45,140L-56,132Q-76,60-74,9Q-72,-33-58-64Z"fill="#9A9A9A"opacity=".13"/>
          <path d="M-56,-60L56-60Q70,-29 72,11Q74,60 54,128L44,136Q22,144 0,144Q-22,144-44,136L-54,128Q-74,60-72,11Q-70,-29-56-60Z"fill="url(#am)"stroke="#BABABA"strokeWidth=".8"/>
          <path d="M-50,-54Q-22,-43 0,-46Q22,-43 38-54L42,11Q22,27 0,29Q-22,27-42,11Z"fill="white"opacity=".23"/>
          <path d="M-46,18Q-20,33 0,35Q20,33 40,18L38,60Q18,75 0,77Q-18,75-36,60Z"fill="white"opacity=".13"/>
          <line x1="0"y1="-58"x2="0"y2="142"stroke="#DDD"strokeWidth="1.5"opacity=".55"/>
          {[[-18,1,.9],[18,.9,.85],[56,.8,.8],[94,.75,.7]].map(([y,s,o],i)=>(
            <line key={'al'+i}x1={-50+i*1.5}y1={y}x2={50-i*1.5}y2={y}stroke="#BBB"strokeWidth={s}opacity={o}/>))}
          {/* 颈甲 */}
          <path d="M-24,-64L24-64L26,-53Q26,-44 19,-39L-19-39Q-26,-44-26-53Z"fill="url(#am)"stroke="#AAA"strokeWidth=".8"/>
          <path d="M-19,-59L19-59L20,-51Q20,-44 16,-40L-16-40Q-20,-44-20-51Z"fill="white"opacity=".22"/>
          <path d="M-24,-64L24-64"fill="none"stroke="url(#gt)"strokeWidth="2.2"/>
          {/* 洛林十字 */}
          <g transform="translate(0,3)">
            <path d="M-15,-24L15-24L18,-8L18,11L15,24L-15,24L-18,11L-18,-8Z"fill="#F5F0FA"stroke="#E0D8F0"strokeWidth=".85"opacity=".72"/>
            <rect x="-24"y="-10"w="48"h="20"rx="3.5"fill="white"stroke="#E8E0F8"strokeWidth="1.1"/>
            <rect x="-10"y="-28"w="20"h="56"rx="2.8"fill="white"stroke="#E8E0F8"strokeWidth="1.1"/>
            <rect x="-24"y="-10"w="48"h="20"rx="3.5"fill="#F0EBFA"stroke="#9B59B6"strokeWidth=".72"/>
            <rect x="-10"y="-28"w="20"h="56"rx="2.8"fill="#F0EBFA"stroke="#9B59B6"strokeWidth=".72"/>
            <circle cx="0"cy="0"r="7"fill="url(#gp)"stroke="#D4AF37"strokeWidth="1.6"><animate attributeName="opacity"values=".87;1;.87"dur="2.5s"ri="indefinite"/></circle>
            <ellipse cx="-1.8"cy="-2.5"rx="2.8"ry="2"fill="#E8D4FF"opacity=".85"/><circle cx="1.2"cy="1.8"r="1.2"fill="white"opacity=".5"/>
          </g>
          {/* 左肩甲 */}
          <g><path d="M-58,-60Q-82,-47-80-20Q-76,2-58-4Q-48,-11-50-26Q-52,-45-58-60Z"fill="#AEAEAE"opacity=".25"/>
            <path d="M-56,-58Q-80,-45-78-18Q-74,-2-56-8Q-46,-15-48-29Q-50,-46-56-58Z"fill="url(#am)"stroke="#AAAAAA"strokeWidth="1"/>
            <path d="M-56,-53Q-74,-43-72-23Q-69,-13-56-17"fill="white"opacity=".26"/>
            <path d="M-56,-58Q-80,-45-78-18"fill="none"stroke="url(#gt)"strokeWidth="2.2"/>
            <circle cx="-68"cy="-38"r="2.2"fill="url(#gt)"/><circle cx="-65"cy="-23"r="2.2"fill="url(#gt)"/><circle cx="-61"cy="-10"r="1.7"fill="url(#gt)"/></g>
          {/* 右肩甲 */}
          <g><path d="M58,-60Q82,-47 80-20Q76,2 58-4Q48-11 50-26Q52-45 58-60Z"fill="#AEAEAE"opacity=".25"/>
            <path d="M56,-58Q80,-45 78-18Q74,-2 56-8Q46-15 48-29Q50-46 56-58Z"fill="url(#am)"stroke="#AAAAAA"strokeWidth="1"/>
            <path d="M56,-53Q74-43 72-23Q69-13 56-17"fill="white"opacity=".26"/>
            <path d="M56,-58Q80,-45 78-18"fill="none"stroke="url(#gt)"strokeWidth="2.2"/>
            <circle cx="68"cy="-38"r="2.2"fill="url(#gt)"/><circle cx="65"cy="-23"r="2.2"fill="url(#gt)"/><circle cx="61"cy="-10"r="1.7"fill="url(#gt)"/></g>
          {/* 腰带 */}
          <path d="M-50,100L50,100L52,115Q52,124 44,126L-44,126Q-52,124-52,115Z"fill="#3D1F5C"stroke="#5B3A7A"strokeWidth="1.1"/>
          <path d="M-48,102L48,102"stroke="#6B3FA0"strokeWidth="1.1"opacity=".5"/>
          <rect x="-11"y="99"w="22"h="24"rx="3.5"fill="url(#gt)"stroke="#B8962E"strokeWidth=".85"/>
          <rect x="-8"y="103"w="16"h="16"rx="2.5"fill="#9B59B6"stroke="#7D3C98"strokeWidth=".55"/>
          <circle cx="0"cy="111"r="4"fill="#D4AF37"><animate attributeName="opacity"values=".8;1;.8"dur="3s"ri="indefinite"/></circle>
          <circle cx="-34"cy="113"r="3.5"fill="none"stroke="url(#gt)"strokeWidth="1.1"/><circle cx="34"cy="113"r="3.5"fill="none"stroke="url(#gt)"strokeWidth="1.1"/>
          <path d="M-42,134Q-20,148 0,150Q20,148 42,134"fill="none"stroke="#BBB"strokeWidth="1"opacity=".28"/>
        </g>

        {/* 头部 */}
        <g transform="translate(0,-120)">
          <path d="M-17,22L-15,54L15,54L17,22Z"fill="url(#sk)"/>
          <path d="M-13,27L-12,50L12,50L13,27Z"fill="url(#sk)"opacity=".35"/>
          <ellipse cx="0"cy="-8"rx="41"ry="51"fill="url(#sk)"/>
          <path d="M-34,19Q-21,34 0,36Q21,34 34,19"fill="none"stroke="url(#sk)"strokeWidth="2.2"opacity=".28"/>
          <ellipse cx="-40"cy="-2"rx="6.5"ry="11"fill="url(#sk)"stroke="#E8C4A8"strokeWidth=".55"/>
          <ellipse cx="40"cy="-2"rx="6.5"ry="11"fill="url(#sk)"stroke="#E8C4A8"strokeWidth=".55"/>

          {/* 刘海 */}
          <path d="M-43,-44Q-24,-66 0-60Q24-66 43-44Q36-33 25-38Q12-44 0-41Q-12-44-25-38Q-36-33-43-44Z"fill="url(#hg)"/>
          <path d="M-30,-50Q-15-60 0-56Q-10-48-20-45Q-28-50-30-50Z"fill="url(#hh)"opacity=".62"/>
          <path d="M0-60Q1-47 2-40"fill="none"stroke="#C9960C"strokeWidth=".8"opacity=".4"/>
          <path d="M-22,-46Q-14-55-5-49"fill="none"stroke="#DAA520"strokeWidth=".7"opacity=".5"/>
          <path d="M5-49Q14-55 22-46"fill="none"stroke="#DAA520"strokeWidth=".7"opacity=".5"/>
          <path d="M-41,-38Q-46-28-42-18"fill="none"stroke="url(#hg)"strokeWidth="3.5"strokeLinecap="round"opacity=".7"/>
          <path d="M41-38Q46-28 42-18"fill="none"stroke="url(#hg)"strokeWidth="3.5"strokeLinecap="round"opacity=".7"/>

          {/* 圣冠 */}
          <g><ellipse cx="0"cy="-60"rx="32"ry="9"fill="none"stroke="url(#cg)"strokeWidth="2.2"/>
            <polygon points="0,-80 -5,-66 5,-66"fill="url(#cg)"stroke="#DAA520"strokeWidth=".6"/>
            <polygon points="-16,-73 -19,-63 -12,-63"fill="url(#cg)"stroke="#DAA520"strokeWidth=".6"/>
            <polygon points="16,-73 19,-63 12,-63"fill="url(#cg)"stroke="#DAA520"strokeWidth=".6"/>
            <circle cx="-24"cy="-62"r="3"fill="#9B59B6"stroke="#D4AF37"strokeWidth=".6"/>
            <circle cx="24"cy="-62"r="3"fill="#9B59B6"stroke="#D4AF37"strokeWidth=".6"/>
            <circle cx="0"cy="-71"r="4.5"fill="#E8D4FF"stroke="#9B59B6"strokeWidth="1.2"><animate attributeName="opacity"values=".8;1;.8"dur="3s"ri="indefinite"/></circle></g>

          {/* 闭眼表情 */}
          <path d="M-26,-6Q-17,-2 -8,-7"stroke="#3D2B1F"strokeWidth="2.6"fill="none"strokeLinecap="round"/>
          <path d="M8,-6Q17,-2 26,-7"stroke="#3D2B1F"strokeWidth="2.6"fill="none"strokeLinecap="round"/>
          <path d="M-25,-7.5Q-17,-12 -8.5-8"stroke="#3D2B1F"strokeWidth="1.3"fill="none"opacity=".45"/>
          <path d="M8.5,-8Q17,-12 25-7.5"stroke="#3D2B1F"strokeWidth="1.3"fill="none"opacity=".45"/>
          <path d="M-28,-21Q-17,-28 -7-23"stroke="#A08060"strokeWidth="1.9"fill="none"strokeLinecap="round"/>
          <path d="M7-23Q17-28 28-21"stroke="#A08060"strokeWidth="1.9"fill="none"strokeLinecap="round"/>
          <path d="M0,-2L1.5,13"stroke="#DDBBA8"strokeWidth="1.6"strokeLinecap="round"opacity=".55"/>
          <ellipse cx="2.2"cy="14"rx="2.8"ry="2"fill="#F0D5BE"opacity=".5"/>
          <path d="M-10,23Q0,31 11,22"stroke="#D4867A"strokeWidth="2.4"fill="none"strokeLinecap="round"/>
          <path d="M-7,26.5Q0,31 7,24.5"stroke="#C47868"strokeWidth="1.1"fill="none"opacity=".35"strokeLinecap="round"/>
          <ellipse cx="-21"cy="14"rx="10"ry="6"fill="#FFB6A3"opacity=".28"/>
          <ellipse cx="21"cy="14"rx="10"ry="6"fill="#FFB6A3"opacity=".28"/>
          <ellipse cx="0"cy="-34"rx="9"ry="4.5"fill="white"opacity=".13"/>
        </g>

        {/* 金色长发 */}
        <g>
          {/* 左辫 */}
          <g><path d="M-38,-150Q-72,-122-82-70Q-90,-18-80,30Q-70,72-54,114Q-44,142-30,168Q-18,178-10,166Q-18,138-28,104Q-40,60-48,18Q-54,-28-44-76Q-36,-120-38-150Z"fill="url(#hg)"stroke="#C9960C"strokeWidth=".9">
            <animateTransform attributeName="transform"type="rotate"values="0 -44 0;3.5 -44 0;0 -44 0"dur="4.5s"ri="indefinite"/></path>
            <path d="M-54,-10Q-47,38-36,88M-64,-32Q-55,20-45,68M-74,-58Q-62,-5-52,48"stroke="#D4AF37"strokeWidth=".65"fill="none"opacity=".35"/>
            <path d="M-40,-143Q-67,-118-77-68Q-83,-18-75,26"fill="none"stroke="url(#hh)"strokeWidth="3.2"opacity=".32"strokeLinecap="round"/>
            <g transform="translate(-20,170)"><ellipse cx="-11"cy="0"rx="11"ry="5.5"fill="#1A1A2E"transform="rotate(-22)"><animateTransform attributeName="transform"type="rotate"values="-22;-8;-22"dur="3s"ri="indefinite"/></ellipse>
              <ellipse cx="11"cy="0"rx="11"ry="5.5"fill="#1A1A2E"transform="rotate(22)"><animateTransform attributeName="transform"type="rotate"values="22;34;22"dur="3s"ri="indefinite"/></ellipse>
              <circle cx="0"cy="0"r="3.2"fill="#1A1A2E"/>
              <path d="M0,3Q2,15-1,24"fill="none"stroke="#1A1A2E"strokeWidth="3.2"strokeLinecap="round"opacity=".82"><animateTransform attributeName="transform"type="rotate"values="0;6;0"dur="2.5s"ri="indefinite"/></path></g></g>
          {/* 右辫 */}
          <g><path d="M38,-150Q72,-122 82-70Q90,-18 80,30Q70,72 54,114Q44,142 30,168Q18,178 10,166Q18,138 28,104Q40,60 48,18Q54,-28 44-76Q36-120 38-150Z"fill="url(#hg)"stroke="#C9960C"strokeWidth=".9">
            <animateTransform attributeName="transform"type="rotate"values="0 44 0;-3.5 44 0;0 44 0"dur="4.5s"ri="indefinite"/></path>
            <path d="M54,-10Q47,38 36,88M64,-32Q55,20 45,68M74,-58Q62,-5 52,48"stroke="#D4AF37"strokeWidth=".65"fill="none"opacity=".35"/>
            <path d="M40,-143Q67-118 77-68Q83-18 75,26"fill="none"stroke="url(#hh)"strokeWidth="3.2"opacity=".32"strokeLinecap="round"/>
            <g transform="translate(20,170)"><ellipse cx="-11"cy="0"rx="11"ry="5.5"fill="#1A1A2E"transform="rotate(-22)"><animateTransform attributeName="transform"type="rotate"values="-22;-30;-22"dur="3s"ri="indefinite"/></ellipse>
              <ellipse cx="11"cy="0"rx="11"ry="5.5"fill="#1A1A2E"transform="rotate(22)"><animateTransform attributeName="transform"type="rotate"values="22;10;22"dur="3s"ri="indefinite"/></ellipse>
              <circle cx="0"cy="0"r="3.2"fill="#1A1A2E"/>
              <path d="M0,3Q-2,15 1,24"fill="none"stroke="#1A1A2E"strokeWidth="3.2"strokeLinecap="round"opacity=".82"><animateTransform attributeName="transform"type="rotate"values="0;-6;0"dur="2.5s"ri="indefinite"/></path></g></g>
          <path d="M-10,-155Q-24,-125-20-82Q-16,-40-22,5"fill="none"stroke="url(#hg)"strokeWidth="11"opacity=".26"strokeLinecap="round"/>
          <path d="M10,-155Q24-125 20-82Q16,-40 22,5"fill="none"stroke="url(#hg)"strokeWidth="11"opacity=".26"strokeLinecap="round"/>
        </g>

        {/* 祈祷双手 */}
        <g transform="translate(0,44)">
          <path d="M-42,-2Q-58,-20-52,-52Q-46,-80-32-105Q-21,-119-8-123"fill="none"stroke="url(#am)"strokeWidth="22"strokeLinecap="round"/>
          <path d="M-42,-2Q-58,-20-52,-52Q-46,-80-32-105Q-21,-119-8-123"fill="none"stroke="#EEE"strokeWidth="15"strokeLinecap="round"opacity=".26"/>
          <path d="M42,-2Q58,-20 52,-52Q46,-80 32-105Q21-119 8-123"fill="none"stroke="url(#am)"strokeWidth="22"strokeLinecap="round"/>
          <path d="M42,-2Q58,-20 52-52Q46,-80 32-105Q21-119 8-123"fill="none"stroke="#EEE"strokeWidth="15"strokeLinecap="round"opacity=".26"/>
          <ellipse cx="-44"cy="0"rx="11"ry="6.5"fill="none"stroke="url(#gt)"strokeWidth="2.2"transform="rotate(-16 -44 0)"/>
          <ellipse cx="44"cy="0"rx="11"ry="6.5"fill="none"stroke="url(#gt)"strokeWidth="2.2"transform="rotate(16 44 0)"/>
          <ellipse cx="0"cy="-119"rx="18"ry="28"fill="url(#sk)"stroke="#E8C4A8"strokeWidth="1.3"/>
          <line x1="0"y1="-145"x2="0"y2="-93"stroke="#E0B89A"strokeWidth="1.4"opacity=".45"/>
          <line x1="-8"y1="-141"x2="-7"y2="-95"stroke="#E0B89A"strokeWidth=".9"opacity=".3"/>
          <line x1="8"y1="-141"x2="7"y2="-95"stroke="#E0B89A"strokeWidth=".9"opacity=".3"/>
          <g transform="translate(0,-146)">
            <circle r="4.5"fill="#FFD700"opacity=".72"filter="url(#gg)"><animate attributeName="opacity"values=".4;.92;.4"dur="2s"ri="indefinite"/><animate attributeName="r"values="3.5;6;3.5"dur="2s"ri="indefinite"/></circle>
            <circle r="9"fill="none"stroke="#FFD700"strokeWidth=".9"opacity=".42"><animate attributeName="r"values="7;12;7"dur="2s"ri="indefinite"/><animate attributeName="opacity"values=".5;.15;.5"dur="2s"ri="indefinite"/></circle>
            <line x1="0"y1="-6"x2="0"y2="-20"stroke="#FFD700"strokeWidth="1.1"opacity=".52"><animate attributeName="opacity"values=".2;.72;.2"dur="2s"ri="indefinite"/></line>
            <line x1="-4.5"y1="-7"x2="-9"y2="-17"stroke="#FFD700"strokeWidth=".7"opacity=".32"><animate attributeName="opacity"values=".1;.52;.1"dur="2s"begin=".3s"ri="indefinite"/></line>
            <line x1="4.5"y1="-7"x2="9"y2="-17"stroke="#FFD700"strokeWidth=".7"opacity=".32"><animate attributeName="opacity"values=".1;.52;.1"dur="2s"begin=".6s"ri="indefinite"/></line>
          </g>
        </g>
        </g></g>

      {/* 知识节点 */}
      {N.map(n=>{const t=n.type,c=TC[t]||TC.gnn,sz=[34,28,24][n.orbitIndex],fsz=[15,13,12][n.orbitIndex],fid='ng-'+t;
        const orb=ORB[n.orbitIndex],rad=(n.angleOffset*Math.PI)/180,sx=600+orb.rx*Math.cos(rad),sy=OY+orb.ry*Math.sin(rad);
        return(<g key={n.id}data-orbit-node data-oi={n.orbitIndex}data-angle-offset={n.angleOffset}data-speed={n.speed}
          transform={'translate('+sx+','+sy+')'}className="kn"onMouseEnter()=>setHv(n.id)}onMouseLeave(()=>setHv(null))
          onClick={()=>{const l=NODE_LINKS[n.label];if(l)nav(l);}}style={{cursor:'pointer'}}>
          <g filter={'url(#'+fid)}>{sh(t,sz)}</g><g>{sh(t,sz)}</g>
          <g fill="none"stroke={c.s}strokeWidth="1.8">{sh(t,sz)}</g>
          <text textAnchor="middle"dominantBaseline="central"fill={c.t}fontSize={fsz}fontWeight="bold"fontFamily="'Inter','Noto Sans SC',sans-serif"pointerEvents="none"y={t==='rect'?1:0}>
            {n.label.length>10?(n.labelCn||n.label):n.label}</text>
          {hv===n.id&&<g transform={'translate(0,'+(-sz-22)+')'}><rect x={-65}y="-19"w="130"h="26"rx="5"fill="rgba(20,20,30,.93)"stroke={c.f}strokeWidth="1.2"/>
            <text textAnchor="middle"y="2"fill="white"fontSize="12"fontFamily="'Inter',sans-serif"fontWeight="500">{n.labelCn?n.labelCn+'('+n.label+')':n.label}</text>
            <polygon points="-5,8 5,8 0,15"fill="rgba(20,20,30,.93)"/></g>}
        </g>)})}

      {/* 粒子 */}
      {!rm&&<>{[...Array(10)].map((_,i)=>{const sx=360+Math.random()*180,sy=340+Math.random()*120,dur=3+Math.random()*3,dl=Math.random()*4;
        return(<circle key={'p'+i}cx={sx}cy={sy}r={1.5+Math.random()*1.8}fill="#FFD700"opacity={.4+Math.random()*.4}>
          <animate attributeName="cy"from={sy}to={sy-90-Math.random()*70}dur={dur+'s'}begin={dl+'s'}ri="indefinite"/>
          <animate attributeName="opacity"values="0;.7;0"dur={dur+'s'}begin={dl+'s'}ri="indefinite"/>
          <animate attributeName="cx"from={sx}to={sx+25+Math.random()*25}dur={dur+'s'}begin={dl+'s'}ri="indefinite"/></circle>);})}
        {[...Array(10)].map((_,i)=>{const sx=660+Math.random()*180,sy=340+Math.random()*120,dur=3+Math.random()*3,dl=Math.random()*4;
        return(<circle key={'pr'+i}cx={sx}cy={sy}r={1.5+Math.random()*1.8}fill="#FFD700"opacity={.4+Math.random()*.4}>
          <animate attributeName="cy"from={sy}to={sy-90-Math.random()*70}dur={dur+'s'}begin={dl+'s'}ri="indefinite"/>
          <animate attributeName="opacity"values="0;.7;0"dur={dur+'s'}begin={dl+'s'}ri="indefinite"/>
          <animate attributeName="cx"from={sx}to={sx-25-Math.random()*25}dur={dur+'s'}begin={dl+'s'}ri="indefinite"/></circle>);})}</>)}

      {/* 光环 */}
      <g transform={'translate(600,'+(CY-102)+')'}>
        <circle r="9"fill="#FFD700"opacity=".42"filter="url(#hg)"><animate attributeName="r"values="6;15;6"dur="2.5s"ri="indefinite"/><animate attributeName="opacity"values=".22;.62;.22"dur="2.5s"ri="indefinite"/></circle>
        {[0,40,80,120,160,200,240,280,320].map(a=><line key={'ra'+a}x1="0"y1="0"
          x2={Math.cos(a*Math.PI/180)*43}y2={Math.sin(a*Math.PI/180)*43}stroke="rgba(255,215,0,.32)"strokeWidth="1.1"opacity="0">
          <animate attributeName="opacity"values="0;.58;0"dur="2.5s"begin={a*.006+'s'}ri="indefinite"/></line>)}
      </g>

      <g transform="translate(600,530)"opacity=".7">
        <text textAnchor="middle"y="0"fill="#7D3C98"fontSize="13.5"fontWeight="bold"fontFamily="'Inter','Noto Sans SC',sans-serif"letterSpacing="4"opacity=".72">RULER JEANNE D'ARC</text>
        <text textAnchor="middle"y="17"fill="#999"fontSize="10"fontFamily="'Noto Sans SC',sans-serif"opacity=".5">圣女贞德 · 学术守护者</text>
      </g>
    </svg>
    <style>{`.kn{transition:transform .25s ease,filter .3s ease}.kn:hover{transform:scale(1.15);filter:brightness(1.2) drop-shadow(0 0 12px rgba(255,215,0,.5))}@media(prefers-reduced-motion:reduce){.kn,[data-orbit-node]{animation:none!important;transition:none!important}}</style>
  </div>);
}
