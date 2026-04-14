export const portfolioHistory = [
  { m:'Oct', v:4.82 },{ m:'Nov', v:5.21 },{ m:'Dec', v:4.95 },
  { m:'Jan', v:5.84 },{ m:'Feb', v:6.12 },{ m:'Mar', v:5.97 },{ m:'Apr', v:6.53 },
];

export const indices = [
  { name:'NIFTY 50',   val:'23,547', chg:'+1.24%', up:true,  spark:[190,210,200,222,235,230,247] },
  { name:'SENSEX',     val:'77,482', chg:'+0.98%', up:true,  spark:[760,780,770,800,810,800,826] },
  { name:'NIFTY BANK', val:'48,320', chg:'-0.43%', up:false, spark:[490,485,488,480,475,478,483] },
  { name:'NIFTY IT',   val:'37,892', chg:'+2.31%', up:true,  spark:[360,365,370,378,368,382,392] },
];

export const watchlistData = [
  { sym:'RELIANCE', name:'Reliance Industries', price:'2,847.50', chg:'+1.84%', up:true  },
  { sym:'TCS',      name:'Tata Consultancy Svc', price:'3,541.20', chg:'+2.10%', up:true  },
  { sym:'HDFCBANK', name:'HDFC Bank Ltd',       price:'1,632.80', chg:'-0.62%', up:false },
  { sym:'INFY',     name:'Infosys Ltd',         price:'1,487.40', chg:'+1.93%', up:true  },
  { sym:'WIPRO',    name:'Wipro Ltd',           price:'512.30',   chg:'-0.28%', up:false },
  { sym:'ADANIPORTS',name:'Adani Ports',        price:'1,284.70', chg:'+3.41%', up:true  },
];

export const topMovers = [
  { sym:'ADANIPORTS', chg:'+4.82%', vol:'3.2M', up:true  },
  { sym:'TATASTEEL',  chg:'+3.64%', vol:'5.1M', up:true  },
  { sym:'BAJFINANCE', chg:'+2.91%', vol:'2.7M', up:true  },
  { sym:'ONGC',       chg:'-3.12%', vol:'4.8M', up:false },
  { sym:'COALINDIA',  chg:'-2.44%', vol:'3.9M', up:false },
];

export const newsData = [
  { title:'RBI holds repo rate at 6.5% amid global uncertainty', tag:'Macro',   sent:'neutral',  time:'2h ago',  summary:'Monetary Policy Committee voted 5-1 to pause, citing inflation at target range.' },
  { title:'IT sector surges on strong US job data; TCS leads',    tag:'IT',      sent:'positive', time:'3h ago',  summary:'TCS up 2.1%, INFY up 1.9% as strong US employment signals sustained tech spend.' },
  { title:'Adani Group stocks gain on port expansion plans',      tag:'Infra',   sent:'positive', time:'5h ago',  summary:'Adani Ports to invest ₹8,000Cr in Mundra expansion; JM Financial raises target.' },
  { title:'FIIs net sellers in March on valuation concerns',      tag:'Markets', sent:'negative', time:'7h ago',  summary:'Foreign institutional investors pulled ₹14,200Cr from equities. DIIs absorb outflow.' },
  { title:'Quarterly GDP at 7.2%, beats consensus of 6.9%',      tag:'Economy', sent:'positive', time:'10h ago', summary:'Manufacturing and services both showed strong momentum. RBI to revise forecast upward.' },
];

export const aiInsightsData = [
  { icon:'↑', color:'#C8FF00',   title:'IT Sector bullish',    body:'Strong US tech earnings signal upside for Indian IT. Consider adding TCS, INFY exposure at current levels.' },
  { icon:'⚠', color:'#FBBF24',  title:'Rate risk ahead',      body:'RBI pause may not last Q3. Keep rate-sensitive BFSI below 20% of portfolio until clarity emerges.' },
  { icon:'↗', color:'#9B72FF', title:'Breakout in ADANIPORTS', body:'Breaking above ₹1,280 resistance with 3× average volume. Momentum trade with stop at ₹1,240.' },
];

export const stockHistory = [
  { d:'1 Apr', v:2818 },{ d:'2 Apr', v:2832 },{ d:'3 Apr', v:2821 },
  { d:'4 Apr', v:2847 },{ d:'7 Apr', v:2863 },{ d:'8 Apr', v:2851 },
  { d:'9 Apr', v:2874 },{ d:'10 Apr', v:2858 },{ d:'11 Apr', v:2847 },
];

export const metrics = [
  { label:'Market Cap', val:'₹19.28L Cr' },{ label:'PE Ratio', val:'24.8x' },
  { label:'EPS (TTM)',  val:'₹114.80'    },{ label:'52W High',  val:'₹3,024' },
  { label:'52W Low',   val:'₹2,197'     },{ label:'Div Yield', val:'0.38%' },
  { label:'Volume',    val:'4.21M'      },{ label:'Beta',      val:'1.14'  },
];

export const holdings = [
  { sym:'RELIANCE',   qty:50,  avg:2450, ltp:2847, val:142350, gain:19850, pct:'+16.2', up:true  },
  { sym:'TCS',        qty:30,  avg:3200, ltp:3541, val:106230, gain:10230, pct:'+10.7', up:true  },
  { sym:'HDFCBANK',   qty:80,  avg:1720, ltp:1633, val:130640, gain:-6960, pct:'-5.1',  up:false },
  { sym:'INFY',       qty:100, avg:1380, ltp:1487, val:148700, gain:10700, pct:'+7.8',  up:true  },
  { sym:'ADANIPORTS', qty:40,  avg:1100, ltp:1285, val:51400,  gain:7400,  pct:'+16.8', up:true  },
];

export const alloc = [
  { name:'IT',     v:37, color:'#C8FF00' },
  { name:'Energy', v:25, color:'#FF4FD8' },
  { name:'BFSI',   v:23, color:'#9B72FF' },
  { name:'Infra',  v:15, color:'#60A5FA' },
];

export const alertsData = [
  { sym:'TCS',       cond:'Price above ₹3,600', type:'price',    active:true,  triggered:false },
  { sym:'NIFTY 50',  cond:'Drops below 23,000', type:'price',    active:true,  triggered:false },
  { sym:'RELIANCE',  cond:'News sentiment < −0.6', type:'news',  active:true,  triggered:false },
  { sym:'HDFCBANK',  cond:'RSI below 30 (oversold)', type:'ai',  active:false, triggered:true  },
  { sym:'INFY',      cond:'Volume spike > 3× avg', type:'ai',    active:true,  triggered:false },
];
