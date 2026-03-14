import React, { useState, useEffect, useMemo } from "react";
import { MapPin, Search, Navigation } from "lucide-react";

const WX_ICON = {
  Thunderstorm:"⛈️",Drizzle:"🌦️",Rain:"🌧️",Snow:"❄️",
  Clear:"☀️",Clouds:"☁️",Mist:"🌫️",Fog:"🌫️",Haze:"🌫️",Smoke:"🌫️"
};
const AQI_LABEL=["","Good","Fair","Moderate","Poor","Very Poor"];
const AQI_COLOR=["","#4caf50","#c6e03a","#ffeb3b","#ff9800","#f44336"];

function getMoonPhase(){
  const diff=(new Date()-new Date(2000,0,6))/864e5;
  const p=((diff%29.53058867)+29.53058867)%29.53058867;
  if(p<1.85)return{name:"New Moon",pct:0};
  if(p<7.38)return{name:"Waxing Crescent",pct:Math.round((p/7.38)*50)};
  if(p<9.22)return{name:"First Quarter",pct:50};
  if(p<14.77)return{name:"Waxing Gibbous",pct:Math.round(50+((p-9.22)/5.55)*50)};
  if(p<16.61)return{name:"Full Moon",pct:100};
  if(p<22.15)return{name:"Waning Gibbous",pct:Math.round(100-((p-16.61)/5.54)*50)};
  if(p<23.99)return{name:"Last Quarter",pct:50};
  return{name:"Waning Crescent",pct:Math.round(((29.53-p)/7.38)*50)};
}

function fmtTime(u,tz){const d=new Date((u+(tz||0))*1000);const h=d.getUTCHours(),m=d.getUTCMinutes(),ap=h>=12?"PM":"AM";return`${h%12||12}:${m.toString().padStart(2,"0")} ${ap}`;}

export default function WeatherApp(){
  const [data,setData]=useState(null);
  const [city,setCity]=useState(null);
  const [coords,setCoords]=useState(null);
  const [q,setQ]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [showSearch,setShowSearch]=useState(false);
  const [recent,setRecent]=useState(()=>{try{return JSON.parse(localStorage.getItem("wx_recent")||"[]");}catch{return[];}});
  const [showCities,setShowCities]=useState(false);
  const [saved,setSaved]=useState(()=>{try{return JSON.parse(localStorage.getItem("wx_cities")||"[]");}catch{return[];}});
  const [previews,setPreviews]=useState({});
  const [gpsOn,setGpsOn]=useState(false);

  async function load(c,co){
    setLoading(true);setError(null);
    try{
      const url=co?`https://weatherxxx-backend.onrender.com/api/weather/all?lat=${co.lat}&lon=${co.lon}`:`https://weatherxxx-backend.onrender.com/api/weather/all?city=${encodeURIComponent(c)}`;
      const r=await fetch(url);const j=await r.json();
      if(j.error)throw new Error(j.error);
      setData(j);
    }catch(e){setError(e.message);}finally{setLoading(false);}
  }

  function gps(){
    if(!navigator.geolocation)return;
    setGpsOn(true);
    navigator.geolocation.getCurrentPosition(
      p=>{setCoords({lat:p.coords.latitude,lon:p.coords.longitude});setCity(null);setGpsOn(false);},
      ()=>{setGpsOn(false);if(!city&&!coords){setCity("Bangalore");setError("Could not get your location. Showing Bangalore instead.");}},{timeout:10000}
    );
  }

  useEffect(()=>{gps();},[]);
  useEffect(()=>{if(coords)load(null,coords);},[coords]);
  useEffect(()=>{if(city)load(city,null);},[city]);

  const stars=useMemo(()=>[...Array(55)].map(()=>({
    w:Math.random()*2+0.5,x:Math.random()*100,y:Math.random()*80,
    d:Math.random()*3+2,dl:Math.random()*5
  })),[]);

  const doSearch=()=>{const clean=q.trim().replace(/[<>{}]/g,"").slice(0,100);if(clean){setData(null);setCoords(null);setCity(clean);setShowSearch(false);setQ("");const updated=[clean,...recent.filter(x=>x!==clean)].slice(0,5);setRecent(updated);localStorage.setItem("wx_recent",JSON.stringify(updated));}};

  const saveCity=()=>{
    if(!w||saved.includes(w.name))return;
    const updated=[...saved,w.name];
    setSaved(updated);
    localStorage.setItem("wx_cities",JSON.stringify(updated));
  };
  const removeCity=c=>{
    const updated=saved.filter(x=>x!==c);
    setSaved(updated);
    localStorage.setItem("wx_cities",JSON.stringify(updated));
  };

  useEffect(()=>{
    saved.forEach(async c=>{
      try{
        const r=await fetch(`https://weatherxxx-backend.onrender.com/api/weather/all?city=${encodeURIComponent(c)}`);
        const j=await r.json();
        if(!j.error)setPreviews(p=>({...p,[c]:j.current}));
      }catch{}
    });
  },[saved]);

  const w=data?.current;
  const isSaved=w&&saved.includes(w.name);
  const aqi=data?.air?.list?.[0];
  const moon=getMoonPhase();
  const lat=coords?.lat||w?.coord?.lat||12.97;
  const lon=coords?.lon||w?.coord?.lon||77.59;
  const uvIndex=data?.tomorrow?.uvIndex??0;
  const uvLabel=uvIndex<=2?"Low":uvIndex<=5?"Moderate":uvIndex<=7?"High":uvIndex<=10?"Very High":"Extreme";
  const uvPct=Math.min(100,(uvIndex/11)*100);
  const dewPoint=data?.tomorrow?.dewPoint?Math.round(data.tomorrow.dewPoint):w?Math.round(w.main.temp-(100-w.main.humidity)/5):0;
  const windSpd=w?Math.round(w.wind.speed*3.6):0;
  const runScore=w?(()=>{const t=w.main.temp,h=w.main.humidity,s=windSpd,r=w.weather[0].main;if(r==="Thunderstorm"||r==="Snow")return{e:"😰",l:"Bad",d:"Not ideal for running"};if(r==="Rain"||r==="Drizzle")return{e:"😕",l:"Poor",d:"Wet conditions outside"};if(t>38||t<5)return{e:"😰",l:"Bad",d:t>38?"Too hot to run":"Too cold to run"};if(t>33||h>85)return{e:"😐",l:"Fair",d:t>33?"High heat, take water":"High humidity today"};if(s>40)return{e:"😐",l:"Fair",d:"Windy conditions"};if(t>=15&&t<=28&&h<70&&s<25)return{e:"😊",l:"Great",d:"Perfect running weather!"};return{e:"😊",l:"Good",d:"Good weather for running"};})():{e:"😊",l:"Good",d:"Good weather for running"};
  const windDir=w&&w.wind.deg!==undefined?["N","NE","E","SE","S","SW","W","NW"][Math.round(w.wind.deg/45)%8]:"--";

  const hourly=data?data.forecast.list.slice(0,8).map(i=>({
    time:fmtTime(i.dt,data?.current?.timezone),temp:Math.round(i.main.temp),
    icon:WX_ICON[i.weather[0].main]||"🌤️",rain:Math.round((i.pop||0)*100)
  })):[];

  const daily=(()=>{
    if(!data)return[];
    const days={};
    data.forecast.list.forEach(i=>{
      const d=new Date(i.dt*1000);
      const k=d.toLocaleDateString("en-US",{weekday:"short",month:"numeric",day:"numeric"});
      const l=d.toLocaleDateString("en-US",{weekday:"short"});
      if(!days[k])days[k]={l,temps:[],icons:[],rain:0};
      days[k].temps.push(i.main.temp);days[k].icons.push(i.weather[0].main);
      days[k].rain=Math.max(days[k].rain,(i.pop||0)*100);
    });
    return Object.values(days).slice(0,7).map(d=>({
      day:d.l,high:Math.round(Math.max(...d.temps)),low:Math.round(Math.min(...d.temps)),
      icon:WX_ICON[d.icons[Math.floor(d.icons.length/2)]]||"🌤️",
      icon2:WX_ICON[d.icons[d.icons.length-1]]||"🌙",rain:Math.round(d.rain),
    }));
  })();

  const css=`
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{height:100%;background:#0a1840;}
    .app{
      min-height:100vh;width:100%;max-width:430px;margin:0 auto;
      background:linear-gradient(180deg,#0d2159 0%,#0f2d6b 20%,#0d246a 50%,#0a1d55 100%);
      font-family:"Nunito",sans-serif;position:relative;contain:layout style;
    }
    .star-bg{position:fixed;inset:0;pointer-events:none;max-width:430px;margin:0 auto;will-change:opacity;contain:strict;}
    .st{position:absolute;background:white;border-radius:50%;animation:tw var(--d) ease-in-out infinite var(--dl);}
    @keyframes tw{0%,100%{opacity:0.1;}50%{opacity:0.8;}}
    .scroll-area{
      overflow-y:auto;overflow-x:hidden;height:100vh;
      scrollbar-width:none;padding-bottom:80px;
    }
    .scroll-area::-webkit-scrollbar{display:none;}
    .cv{font-family:"Caveat",cursive;}
    .card{background:rgba(10,25,80,0.55);border:1px solid rgba(255,255,255,0.1);border-radius:18px;}
    .hcard{flex-shrink:0;width:70px;padding:12px 6px;border-radius:18px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);text-align:center;}
    .scroll-x{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none;}
    .scroll-x::-webkit-scrollbar{display:none;}
    .frow{display:flex;align-items:center;padding:13px 4px;border-bottom:1px solid rgba(255,255,255,0.07);}
    .frow:last-child{border-bottom:none;}
    .bar-track{height:7px;border-radius:7px;background:rgba(255,255,255,0.1);overflow:hidden;margin-top:10px;}
    .bar-fill{height:100%;border-radius:7px;}
    .stat2{background:rgba(10,25,80,0.55);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:16px;}
    .lbl{font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,0.4);display:flex;align-items:center;gap:5px;margin-bottom:6px;}
    .nav{
      position:fixed;bottom:0;left:50%;transform:translateX(-50%);
      width:100%;max-width:430px;height:66px;
      background:rgba(6,14,45,0.97);backdrop-filter:blur(20px);
      border-top:1px solid rgba(255,255,255,0.08);
      display:flex;align-items:center;justify-content:space-between;
      padding:0 28px 8px;z-index:100;
    }
    .nav-btn{background:none;border:none;cursor:pointer;padding:12px;min-width:44px;min-height:44px;color:rgba(255,255,255,0.65);display:flex;align-items:center;justify-content:center;}
    .dots{display:flex;gap:7px;align-items:center;}
    .dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.3);cursor:pointer;transition:all 0.3s;}
    .dot.on{background:white;}
    .search-overlay{position:fixed;inset:0;background:rgba(4,12,40,0.98);z-index:200;display:flex;flex-direction:column;padding:60px 20px 20px;gap:12px;max-width:430px;margin:0 auto;left:50%;transform:translateX(-50%);}
    .si{padding:15px 18px;border-radius:16px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:white;font-size:16px;font-family:"Nunito",sans-serif;outline:none;width:100%;}
    .si::placeholder{color:rgba(255,255,255,0.3);}
    .go-btn{padding:14px 24px;border-radius:16px;background:rgba(59,130,246,0.5);border:1px solid rgba(59,130,246,0.6);color:white;font-size:15px;font-family:"Nunito",sans-serif;font-weight:600;cursor:pointer;}
    .compass-ring{width:88px;height:88px;border-radius:50%;border:2px solid rgba(255,255,255,0.2);position:relative;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.03);}
  `;

  if(loading) return(
    <div className="app" style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",minHeight:"100vh",flexDirection:"column",gap:16}}>
      <style>{css}</style>
      <div style={{fontSize:56,animation:"tw 1.5s ease-in-out infinite"}}>🌙</div>
      <div style={{fontFamily:"Caveat,cursive",fontSize:22,color:"rgba(255,255,255,0.5)"}}>
        {gpsOn?"Finding your location...":"Loading weather..."}
      </div>
    </div>
  );

  return(
    <div className="app">
      <style>{css}</style>

      {/* Stars */}
      <div className="star-bg">
        {stars.map((s,i)=>(
          <div key={i} className="st" style={{
            width:s.w+"px",height:s.w+"px",
            left:s.x+"%",top:s.y+"%",
            "--d":s.d+"s","--dl":s.dl+"s"
          }}/>
        ))}
      </div>

      <div className="scroll-area">
        <div style={{position:"relative",zIndex:10,padding:"0 18px"}}>

          {/* ── HEADER ── */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:48,paddingBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <MapPin size={16} style={{color:"rgba(255,255,255,0.7)"}}/>
              <span style={{fontFamily:"Caveat,cursive",fontSize:26,fontWeight:600,color:"white"}}>{w?.name||"..."}</span>
            </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button style={{background:"none",border:"none",cursor:"pointer",padding:"12px",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={saveCity} aria-label={isSaved?"Remove from saved cities":"Save city"}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill={isSaved?"#fbbf24":"none"} stroke={isSaved?"#fbbf24":"rgba(255,255,255,0.6)"} strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
          <button style={{background:"none",border:"none",cursor:"pointer",padding:"12px",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowCities(true)} aria-label="View saved cities">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </button>
          <button style={{background:"none",border:"none",cursor:"pointer",padding:"12px",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={gps} aria-label="Use my location">
            <Navigation size={18} style={{color:"rgba(255,255,255,0.6)"}}/>
          </button>
        </div>
          </div>

          {error&&(
            <div style={{padding:16,background:"rgba(239,68,68,0.1)",borderRadius:14,color:"rgba(255,180,180,0.9)",fontFamily:"Caveat,cursive",fontSize:17,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
              <span>{error}</span>
              <button onClick={()=>{setError(null);city?load(city,null):load(null,coords);}} style={{background:"rgba(239,68,68,0.2)",border:"1px solid rgba(239,68,68,0.3)",color:"rgba(255,180,180,0.9)",borderRadius:10,padding:"6px 12px",cursor:"pointer",fontFamily:"Caveat,cursive",fontSize:15,flexShrink:0}}>Retry</button>
            </div>
          )}

          {w&&(<>

          {/* ── HERO ILLUSTRATION ── */}
          <div style={{height:230,minHeight:230,borderRadius:22,overflow:"hidden",marginBottom:0,border:"1px solid rgba(255,255,255,0.07)"}}>
            <svg viewBox="0 0 375 230" style={{width:"100%",height:"100%"}} xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#08173a"/>
                  <stop offset="50%" stopColor="#0e2d6b"/>
                  <stop offset="100%" stopColor="#1a4a90"/>
                </linearGradient>
              </defs>
              <rect width="375" height="230" fill="url(#sg)"/>
              {[[18,18],[52,12],[88,26],[128,10],[165,20],[205,8],[245,16],[285,24],[325,12],[358,22],[38,52],[72,42],[112,58],[150,38],[190,50],[230,42],[270,56],[310,46],[352,53]].map(([x,y],i)=>(
                <circle key={i} cx={x} cy={y} r={i%4===0?1.4:0.8} fill="white" opacity={0.25+Math.random()*0.55}/>
              ))}
              <circle cx="295" cy="36" r="22" fill="rgba(238,232,200,0.88)"/>
              <circle cx="303" cy="30" r="18" fill="#0e2d6b"/>
              <ellipse cx="75" cy="58" rx="58" ry="24" fill="rgba(25,55,130,0.5)"/>
              <ellipse cx="112" cy="48" rx="38" ry="16" fill="rgba(30,60,140,0.4)"/>
              <ellipse cx="315" cy="68" rx="42" ry="17" fill="rgba(20,50,120,0.45)"/>
              <path d="M0 158 Q55 132 125 148 Q185 160 248 136 Q305 116 375 142 L375 230 L0 230Z" fill="rgba(6,16,44,0.96)"/>
              <path d="M0 170 Q75 160 155 168 Q235 174 318 162 L375 167 L375 230 L0 230Z" fill="rgba(4,12,34,0.99)"/>
              <ellipse cx="178" cy="206" rx="115" ry="17" fill="rgba(12,40,105,0.6)"/>
              <path d="M76 202 Q140 197 205 202 Q250 205 288 199" stroke="rgba(70,120,230,0.18)" strokeWidth="1.5" fill="none"/>
              <circle cx="175" cy="137" r="7.5" fill="#c4956a"/>
              <rect x="171" y="144" width="8" height="20" rx="2" fill="#1d3b6e"/>
              <line x1="175" y1="148" x2="164" y2="138" stroke="#c4956a" strokeWidth="3" strokeLinecap="round"/>
              <line x1="175" y1="148" x2="185" y2="156" stroke="#1d3b6e" strokeWidth="3" strokeLinecap="round"/>
              <line x1="175" y1="164" x2="170" y2="177" stroke="#1d3b6e" strokeWidth="3" strokeLinecap="round"/>
              <line x1="175" y1="164" x2="180" y2="177" stroke="#1d3b6e" strokeWidth="3" strokeLinecap="round"/>
              <rect x="162" y="132" width="7" height="10" rx="1.5" fill="rgba(200,228,255,0.92)"/>
              <circle cx="166" cy="136" r="7" fill="rgba(180,220,255,0.08)"/>
            </svg>
          </div>

          {/* ── BIG TEMP ── */}
          <div style={{paddingTop:14,paddingBottom:4}}>
            <div style={{fontFamily:"Caveat,cursive",fontSize:90,fontWeight:700,color:"white",lineHeight:1,letterSpacing:-2}}>{Math.round(w.main.temp)}°</div>
            <div style={{fontFamily:"Caveat,cursive",fontSize:28,color:"white",fontWeight:500,textTransform:"capitalize",marginTop:2}}>{w.weather[0].description}</div>
            <div style={{display:"flex",gap:18,marginTop:8}}>
              <span style={{fontFamily:"Caveat,cursive",fontSize:17,color:"rgba(255,255,255,0.6)"}}>↑ {Math.round(w.main.temp_max)}° / ↓ {Math.round(w.main.temp_min)}°</span>
              <span style={{fontFamily:"Caveat,cursive",fontSize:17,color:"rgba(255,255,255,0.6)"}}>Feels like {Math.round(w.main.feels_like)}°</span>
            </div>
          </div>

          {/* Info strip */}
          <div className="card" style={{marginTop:14,padding:"12px 16px"}}>
            <span style={{fontFamily:"Caveat,cursive",fontSize:16,color:"rgba(255,255,255,0.65)"}}>
              {w.weather[0].description.charAt(0).toUpperCase()+w.weather[0].description.slice(1)}. Low {Math.round(w.main.temp_min)}°C.
            </span>
          </div>

          {/* ── HOURLY ── */}
          <div style={{marginTop:16}}>
            <div className="scroll-x">
              {hourly.map((h,i)=>(
                <div key={i} className="hcard">
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:8}}>{h.time}</div>
                  <div style={{fontSize:22,marginBottom:6}}>{h.icon}</div>
                  <div style={{fontFamily:"Caveat,cursive",fontSize:20,color:"white",fontWeight:600}}>{h.temp}°</div>
                  {h.rain>0&&<div style={{fontSize:10,color:"#60a5fa",marginTop:3}}>💧{h.rain}%</div>}
                  <div style={{width:6,height:6,borderRadius:"50%",background:"rgba(255,255,255,0.4)",margin:"6px auto 0"}}/>
                </div>
              ))}
            </div>
            <div style={{height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)",marginTop:4}}/>
            <div style={{textAlign:"right",marginTop:6}}>
              <span style={{fontFamily:"Caveat,cursive",fontSize:14,color:"rgba(150,190,255,0.7)",cursor:"pointer"}} onClick={()=>alert("48-hour forecast coming soon!")}>48-hour forecast &gt;</span>
            </div>
          </div>

          {/* Sunrise banner */}
          <div className="card" style={{marginTop:14,padding:"14px 18px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontFamily:"Caveat,cursive",fontSize:13,color:"rgba(255,255,255,0.5)"}}>☀️ Don&apos;t miss tomorrow&apos;s sunrise</div>
                <div style={{fontFamily:"Caveat,cursive",fontSize:17,color:"white",marginTop:3}}>Sunrise will be at {fmtTime(w.sys.sunrise,w.timezone)}</div>
              </div>
              <svg viewBox="0 0 80 55" width="80" height="55">
                <path d="M6 50 Q40 8 74 50" stroke="rgba(255,255,255,0.15)" strokeWidth="2" fill="none" strokeLinecap="round"/>
                <path d="M6 50 Q40 8 74 50" stroke="#fbbf24" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="135" strokeDashoffset="45"/>
                <text x="46" y="34" fill="rgba(255,255,255,0.65)" fontSize="9" fontFamily="Nunito,sans-serif">{fmtTime(w.sys.sunrise,w.timezone)}</text>
              </svg>
            </div>
          </div>

          {/* ── 7-DAY FORECAST ── */}
          <div className="card" style={{marginTop:14,padding:"6px 16px"}}>

            {daily.map((d,i)=>(
              <div key={i} className="frow">
                <span style={{fontFamily:"Caveat,cursive",fontSize:19,color:"white",width:70,flexShrink:0}}>{i===0?"Today":d.day}</span>
                {d.rain>0&&<span style={{fontSize:11,color:"rgba(150,200,255,0.8)",width:38,flexShrink:0}}>💧{d.rain}%</span>}
                <span style={{fontSize:20,marginRight:3,flexShrink:0}}>{d.icon}</span>
                <span style={{fontSize:18,flexShrink:0}}>{d.icon2}</span>
                <div style={{flex:1}}/>
                <span style={{fontFamily:"Caveat,cursive",fontSize:19,color:"white",flexShrink:0}}>{d.high}° {d.low}°</span>
              </div>
            ))}
            <div style={{paddingTop:10,paddingBottom:6,textAlign:"right"}}>
              <span style={{fontFamily:"Caveat,cursive",fontSize:15,color:"rgba(150,190,255,0.75)",cursor:"pointer"}} onClick={()=>alert("15-day forecast coming soon!")}>15-day forecast &gt;</span>
            </div>
          </div>

          {/* ── RUNNING ── */}
          <div className="card" style={{marginTop:14,padding:"18px"}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
              <svg viewBox="0 0 55 60" width="55" height="60">
                <circle cx="28" cy="9" r="6" fill="white"/>
                <line x1="28" y1="15" x2="22" y2="32" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="22" y1="32" x2="14" y2="46" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="22" y1="32" x2="33" y2="46" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="28" y1="20" x2="17" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="28" y1="20" x2="40" y2="27" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <div>
                <div style={{fontFamily:"Caveat,cursive",fontSize:24,color:"white",fontWeight:600}}>Running</div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
                  <span style={{fontSize:20}}>{runScore.e}</span>
                  <span style={{fontFamily:"Caveat,cursive",fontSize:20,color:"#4caf50",fontWeight:600}}>{runScore.l}</span>
                </div>
                <div style={{fontFamily:"Caveat,cursive",fontSize:14,color:"rgba(255,255,255,0.55)",marginTop:2}}>{runScore.d}</div>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-around"}}>
              {hourly.slice(0,3).map((h,i)=>{
                const hr=data?.forecast?.list?.[i];
                const ht=hr?hr.main.temp:w.main.temp;
                const hh=hr?hr.main.humidity:w.main.humidity;
                const hw=hr?Math.round(hr.wind.speed*3.6):windSpd;
                const hr2=hr?hr.weather[0].main:w.weather[0].main;
                const hs=(()=>{if(hr2==="Thunderstorm"||hr2==="Snow")return{e:"😰",l:"Bad"};if(hr2==="Rain"||hr2==="Drizzle")return{e:"😕",l:"Poor"};if(ht>38||ht<5)return{e:"😰",l:"Bad"};if(ht>33||hh>85)return{e:"😐",l:"Fair"};if(hw>40)return{e:"😐",l:"Fair"};if(ht>=15&&ht<=28&&hh<70&&hw<25)return{e:"😊",l:"Great"};return{e:"😊",l:"Good"};})();
                return(
                  <div key={i} style={{textAlign:"center"}}>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:6}}>{h.time}</div>
                    <div style={{fontSize:26}}>{hs.e}</div>
                    <div style={{fontFamily:"Caveat,cursive",fontSize:15,color:"rgba(255,255,255,0.65)",marginTop:4}}>{hs.l}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RADAR MAP ── */}
          <div style={{marginTop:20}}>
            <div style={{fontFamily:"Caveat,cursive",fontSize:22,color:"white",fontWeight:600,marginBottom:10}}>Radar and maps</div>
            <div style={{borderRadius:18,overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)"}}>
              <div style={{width:"100%",height:240,background:"#1a3a6e",borderRadius:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}><div style={{fontSize:40}}>🗺️</div><div style={{fontFamily:"Caveat,cursive",fontSize:18,color:"rgba(255,255,255,0.7)"}}>Map: {w?.name}, {w?.sys?.country}</div><div style={{fontFamily:"Caveat,cursive",fontSize:15,color:"rgba(255,255,255,0.45)"}}>Lat: {lat.toFixed(2)}° Lon: {lon.toFixed(2)}°</div></div>
            </div>
            <div style={{fontFamily:"Caveat,cursive",fontSize:15,color:"rgba(255,255,255,0.55)",marginTop:8}}>Current temperature of {Math.round(w.main.temp)}°</div>
          </div>

          {/* ── AQI ── */}
          {aqi&&(
            <div style={{marginTop:20,padding:"4px 0"}}>
              <div style={{fontFamily:"Caveat,cursive",fontSize:16,color:"rgba(255,255,255,0.5)"}}>AQI</div>
              <div style={{fontFamily:"Caveat,cursive",fontSize:30,color:"white",fontWeight:600,marginTop:2}}>
                {AQI_LABEL[aqi.main.aqi]}
              </div>
              <div style={{height:9,borderRadius:9,background:"rgba(255,255,255,0.1)",overflow:"hidden",marginTop:10}}>
                <div style={{height:"100%",borderRadius:9,background:AQI_COLOR[aqi.main.aqi],width:(aqi.main.aqi/5*100)+"%",transition:"width 0.5s"}}/>
              </div>
            </div>
          )}

          <div style={{height:1,background:"rgba(255,255,255,0.07)",margin:"20px 0"}}/>

          {/* ── POLLEN ── */}
          <div style={{marginBottom:20}}>
            <div style={{fontFamily:"Caveat,cursive",fontSize:22,color:"white",fontWeight:600,marginBottom:14}}>Pollen</div>
            <div className="card" style={{padding:"20px",display:"flex",justifyContent:"space-around"}}>
              {[["Tree",data?.pollen?.tree||"N/A",data?.pollen?.tree==="None"?"rgba(255,255,255,0.2)":data?.pollen?.tree==="Low"?"#4caf50":data?.pollen?.tree==="Moderate"?"#ffeb3b":"#f44336"],["Grass",data?.pollen?.grass==="N/A"?"No data":data?.pollen?.grass||"No data",data?.pollen?.grass==="None"?"rgba(255,255,255,0.2)":data?.pollen?.grass==="Low"?"#4caf50":data?.pollen?.grass==="Moderate"?"#ffeb3b":data?.pollen?.grass==="N/A"?"rgba(255,255,255,0.15)":"#f44336"],["Ragweed",data?.pollen?.ragweed==="N/A"?"No data":data?.pollen?.ragweed||"No data",data?.pollen?.ragweed==="None"?"rgba(255,255,255,0.2)":data?.pollen?.ragweed==="Low"?"#4caf50":data?.pollen?.ragweed==="Moderate"?"#ffeb3b":data?.pollen?.ragweed==="N/A"?"rgba(255,255,255,0.15)":"#f44336"]].map(([name,val,clr])=>(
                <div key={name} style={{textAlign:"center"}}>
                  <svg viewBox="0 0 40 44" width="44" height="48" style={{marginBottom:6}}>
                    <line x1="20" y1="42" x2="20" y2="18" stroke={clr} strokeWidth="2.5" strokeLinecap="round"/>
                    <path d="M20 24 C10 18 8 6 14 4 C18 8 18 18 20 20" fill={clr}/>
                    <path d="M20 30 C30 24 32 12 26 10 C22 14 22 24 20 26" fill={clr} opacity="0.75"/>
                  </svg>
                  <div style={{fontFamily:"Caveat,cursive",fontSize:14,color:"rgba(255,255,255,0.5)",marginBottom:3}}>{name}</div>
                  <div style={{fontFamily:"Caveat,cursive",fontSize:20,color:"white",fontWeight:600}}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── UV + HUMIDITY ── */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div className="stat2">
              <div className="lbl"><span>☀️</span> UV Index</div>
              <div style={{fontFamily:"Caveat,cursive",fontSize:14,color:"rgba(255,255,255,0.5)",marginBottom:4}}>{uvLabel} — UV {uvIndex}</div>
              <div style={{fontFamily:"Caveat,cursive",fontSize:32,color:"white",fontWeight:600}}>{uvLabel}</div>
              <div style={{position:"relative",marginTop:12}}>
                <div style={{height:7,borderRadius:7,background:"linear-gradient(90deg,#4caf50,#ffeb3b,#ff9800,#f44336,#9c27b0)"}}/>
                <div style={{position:"absolute",top:-3,left:uvPct+"%",width:13,height:13,borderRadius:"50%",background:"white",border:"2px solid rgba(0,0,0,0.25)"}}/>
              </div>
            </div>
            <div className="stat2">
              <div className="lbl"><span>💧</span> Humidity</div>
              <div style={{fontFamily:"Caveat,cursive",fontSize:14,color:"rgba(255,255,255,0.5)",marginBottom:4}}>
                {w.main.humidity>=80?"Very humid today":w.main.humidity>=60?"Humid today":w.main.humidity>=40?"Comfortable":"Dry today"}
              </div>
              <div style={{fontFamily:"Caveat,cursive",fontSize:32,color:"white",fontWeight:600}}>{w.main.humidity}%</div>
              <div className="bar-track">
                <div className="bar-fill" style={{width:w.main.humidity+"%",background:"linear-gradient(90deg,#06b6d4,#3b82f6)"}}/>
              </div>
            </div>
          </div>

          {/* ── WIND + DEW ── */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div className="stat2">
              <div className="lbl"><span>💨</span> Wind</div>
              <div style={{fontFamily:"Caveat,cursive",fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:10}}>
                {windSpd<5?"Calm":windSpd<10?"Light breeze":windSpd<20?"Moderate breeze":windSpd<30?"Fresh breeze":windSpd<40?"Strong breeze":"Strong wind"}
              </div>
              <div style={{display:"flex",justifyContent:"center"}}>
                <div className="compass-ring">
                  {[["N",{top:3,left:"50%",transform:"translateX(-50%)"},"#ef4444"],["S",{bottom:3,left:"50%",transform:"translateX(-50%)"},"rgba(255,255,255,0.4)"],["W",{left:3,top:"50%",transform:"translateY(-50%)"},"rgba(255,255,255,0.4)"],["E",{right:3,top:"50%",transform:"translateY(-50%)"},"rgba(255,255,255,0.4)"]].map(([d,pos,clr])=>(
                    <span key={d} style={{position:"absolute",fontSize:9,fontWeight:700,color:clr,...pos}}>{d}</span>
                  ))}
                  <div style={{textAlign:"center"}}>
                    <div style={{fontFamily:"Caveat,cursive",fontSize:20,color:"white",fontWeight:700}}>{windSpd}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.4)"}}>km/h</div>
                  </div>
                  {w.wind.deg!==undefined&&(
                    <div style={{position:"absolute",width:2,height:"32%",background:"rgba(255,255,255,0.75)",borderRadius:2,bottom:"50%",left:"calc(50% - 1px)",transformOrigin:"bottom center",transform:`rotate(${w.wind.deg}deg)`}}/>
                  )}
                </div>
              </div>
            </div>
            <div className="stat2">
              <div className="lbl"><span>🌡️</span> Dew Point</div>
              <div style={{fontFamily:"Caveat,cursive",fontSize:14,color:"rgba(255,255,255,0.5)",marginBottom:10}}>{dewPoint>=16?"Muggy and uncomfortable":dewPoint>=10?"Noticeable humidity":dewPoint>=0?"Fresh and pleasant":"Very dry air"}</div>
              <div style={{fontFamily:"Caveat,cursive",fontSize:48,color:"white",fontWeight:600,lineHeight:1}}>{dewPoint}°</div>
            </div>
          </div>

          {/* ── PRESSURE + VISIBILITY ── */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div className="stat2">
              <div className="lbl"><span>🌬️</span> Pressure</div>
              <div style={{fontFamily:"Caveat,cursive",fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:4}}>
                {w.main.pressure>1015?"Currently rising rapidly":w.main.pressure<1005?"Currently falling":"Stable"}
              </div>
              <svg viewBox="0 0 120 72" style={{width:"100%"}}>
                <path d="M14 68 A48 48 0 0 1 106 68" stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" strokeLinecap="round"/>
                {[...Array(28)].map((_,i)=>{
                  const a=-180+i*6.5,rd=(a*Math.PI)/180,r=44,cx=60,cy=68;
                  return <line key={i} x1={cx+r*Math.cos(rd)} y1={cy+r*Math.sin(rd)} x2={cx+(r+5)*Math.cos(rd)} y2={cy+(r+5)*Math.sin(rd)} stroke="rgba(255,255,255,0.25)" strokeWidth="1.2"/>;
                })}
                <path d="M14 68 A48 48 0 0 1 106 68" stroke="rgba(255,255,255,0.75)" strokeWidth="5" fill="none" strokeLinecap="round"
                  strokeDasharray="151" strokeDashoffset={151-Math.min(151,Math.max(0,((w.main.pressure-975)/70)*151))}/>
                <text x="60" y="54" textAnchor="middle" fill="white" fontFamily="Caveat,cursive" fontSize="15" fontWeight="bold">{w.main.pressure.toFixed(1)}</text>
                <text x="60" y="65" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontFamily="Nunito,sans-serif" fontSize="8">mb</text>
              </svg>
            </div>
            <div className="stat2">
              <div className="lbl"><span>👁️</span> Visibility</div>
              <div style={{fontFamily:"Caveat,cursive",fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:14}}>
                {data?.tomorrow?.visibility?data.tomorrow.visibility>=5?"Good right now":"Limited":(w.visibility||0)>=8000?"Good right now":"Limited"}
              </div>
              <div style={{fontFamily:"Caveat,cursive",fontSize:40,color:"white",fontWeight:600,lineHeight:1}}>{data?.tomorrow?.visibility?data.tomorrow.visibility.toFixed(1):((w.visibility||0)/1000).toFixed(2)}</div>
              <div style={{fontFamily:"Caveat,cursive",fontSize:20,color:"white",marginTop:4}}>km</div>
            </div>
          </div>

          {/* ── SUN ARC ── */}
          <div className="card" style={{padding:"20px",marginBottom:12}}>
            <div style={{position:"relative",height:88}}>
              <svg viewBox="0 0 340 88" style={{width:"100%",height:"100%"}}>
                <path d="M20 84 Q170 8 320 84" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                <path d="M20 84 Q170 8 320 84" stroke="#fbbf24" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="460" strokeDashoffset={()=>{const now=Date.now()/1000;const total=w.sys.sunset-w.sys.sunrise;const elapsed=Math.min(Math.max(now-w.sys.sunrise,0),total);return Math.round(460-(elapsed/total)*460);}}/>
                <circle cx="170" cy="22" r="11" fill="#fbbf24" opacity="0.9"/>
                <circle cx="170" cy="22" r="20" fill="rgba(251,191,36,0.12)"/>
              </svg>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
              <div>
                <div style={{fontFamily:"Caveat,cursive",fontSize:14,color:"rgba(255,255,255,0.5)"}}>Sunrise</div>
                <div style={{fontFamily:"Caveat,cursive",fontSize:30,color:"white",fontWeight:600}}>{fmtTime(w.sys.sunrise,w.timezone)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"Caveat,cursive",fontSize:14,color:"rgba(255,255,255,0.5)"}}>Sunset</div>
                <div style={{fontFamily:"Caveat,cursive",fontSize:30,color:"white",fontWeight:600}}>{fmtTime(w.sys.sunset,w.timezone)}</div>
              </div>
            </div>
          </div>

          {/* ── MOON ── */}
          <div className="card" style={{padding:"20px",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:22}}>
              {/* Moon visual */}
              <div style={{textAlign:"center",flexShrink:0}}>
                <div style={{position:"relative",width:88,height:88}}>
                  <div style={{width:88,height:88,borderRadius:"50%",background:"radial-gradient(circle at 36% 36%,#e0dbc8,#a09c90,#585550)",boxShadow:"inset -14px -5px 20px rgba(0,0,0,0.65)"}}>
                    {(moon.name.includes("Waning")||moon.name==="Last Quarter")&&(
                      <div style={{position:"absolute",top:0,right:0,width:"55%",height:"100%",borderRadius:"0 44px 44px 0",background:"rgba(10,25,75,0.92)"}}/>
                    )}
                    {(moon.name.includes("Waxing")||moon.name==="First Quarter")&&(
                      <div style={{position:"absolute",top:0,left:0,width:"55%",height:"100%",borderRadius:"44px 0 0 44px",background:"rgba(10,25,75,0.92)"}}/>
                    )}
                    {moon.name==="New Moon"&&(
                      <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"rgba(10,25,75,0.96)"}}/>
                    )}
                  </div>
                </div>
                <div style={{fontFamily:"Caveat,cursive",fontSize:14,color:"rgba(255,255,255,0.55)",marginTop:6}}>{moon.name}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{marginBottom:18}}>
                  <div style={{fontFamily:"Caveat,cursive",fontSize:15,color:"rgba(255,255,255,0.5)"}}>Moonrise</div>
                  <div style={{fontFamily:"Caveat,cursive",fontSize:28,color:"white",fontWeight:600}}>{data?.moonTimes?.moonrise||"N/A"}</div>
                </div>
                <div>
                  <div style={{fontFamily:"Caveat,cursive",fontSize:15,color:"rgba(255,255,255,0.5)"}}>Moonset</div>
                  <div style={{fontFamily:"Caveat,cursive",fontSize:28,color:"white",fontWeight:600}}>{data?.moonTimes?.moonset||"N/A"}</div>
                </div>
              </div>
            </div>
          </div>

          </>)}
        </div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div className="nav">
        <button className="nav-btn" onClick={()=>setShowSearch(true)} aria-label="Open menu">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <circle cx="17" cy="6" r="3.5" fill="rgba(255,255,255,0.15)"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div className="dots">
          <div className="dot on"/>
          <div className="dot"/>
          <div className="dot"/>
        </div>
        <button className="nav-btn" onClick={()=>setShowSearch(true)} aria-label="Search city">
          <Search size={22}/>
        </button>
      </div>

      {/* ── SEARCH OVERLAY ── */}
      {showCities&&(
        <div className="search-overlay">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
            <span style={{fontFamily:"Caveat,cursive",fontSize:32,color:"white",fontWeight:600}}>Saved Cities</span>
            <button style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",fontSize:14,cursor:"pointer",fontFamily:"Nunito,sans-serif"}} onClick={()=>setShowCities(false)}>✕ Close</button>
          </div>
          {w&&(
            <button onClick={saveCity} style={{padding:"14px 18px",borderRadius:16,background:isSaved?"rgba(251,191,36,0.15)":"rgba(255,255,255,0.07)",border:isSaved?"1px solid rgba(251,191,36,0.3)":"1px solid rgba(255,255,255,0.12)",color:isSaved?"#fbbf24":"rgba(255,255,255,0.7)",fontFamily:"Caveat,cursive",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",gap:8,width:"100%"}}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill={isSaved?"currentColor":"none"} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              {isSaved?`${w.name} is saved`:`Save ${w.name}`}
            </button>
          )}
          {saved.length===0?(
            <div style={{textAlign:"center",padding:"40px 20px",background:"rgba(255,255,255,0.03)",borderRadius:20,border:"1px solid rgba(255,255,255,0.06)",marginTop:8}}>
              <div style={{fontSize:48,marginBottom:12}}>🌍</div>
              <div style={{fontFamily:"Caveat,cursive",fontSize:20,color:"rgba(255,255,255,0.4)"}}>No saved cities yet</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.2)",marginTop:6}}>Search a city and tap the ★ to save it</div>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8,overflowY:"auto"}}>
              {saved.map(sc=>{
                const p=previews[sc];
                return(
                  <div key={sc} style={{display:"flex",alignItems:"center",gap:12,padding:"16px 18px",borderRadius:18,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",transition:"all 0.2s"}}
                    onClick={()=>{setData(null);setCoords(null);setCity(sc);setShowCities(false);}}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"Caveat,cursive",fontSize:20,color:"white",fontWeight:600}}>{sc}</div>
                      {p&&<div style={{fontSize:12,color:"rgba(255,255,255,0.4)",textTransform:"capitalize",marginTop:1}}>{p.weather[0].description}</div>}
                    </div>
                    {p&&<span style={{fontSize:22}}>{WX_ICON[p.weather[0].main]||"🌤️"}</span>}
                    {p&&<span style={{fontFamily:"Caveat,cursive",fontSize:26,color:"white",fontWeight:600}}>{Math.round(p.main.temp)}°</span>}
                    <button onClick={e=>{e.stopPropagation();removeCity(sc);}} style={{padding:"8px",borderRadius:10,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.15)",color:"rgba(239,68,68,0.65)",cursor:"pointer",display:"flex",marginLeft:4}}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showSearch&&(
        <div className="search-overlay">
          <div style={{fontFamily:"Caveat,cursive",fontSize:32,color:"white",fontWeight:600,marginBottom:6}}>Search City</div>
          <div style={{display:"flex",gap:10}}>
            <input className="si" value={q} onChange={e=>setQ(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="Enter city name..." autoFocus/>
            <button className="go-btn" onClick={doSearch}>Go</button>
          </div>
          {recent.length>0&&(
            <div style={{marginTop:8}}>
              <div style={{fontFamily:"Caveat,cursive",fontSize:15,color:"rgba(255,255,255,0.4)",marginBottom:8}}>Recent searches</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {recent.map(r=>(
                  <button key={r} onClick={()=>{setData(null);setCoords(null);setCity(r);setShowSearch(false);setQ("");}}
                    style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:20,padding:"6px 14px",color:"rgba(255,255,255,0.7)",fontFamily:"Caveat,cursive",fontSize:16,cursor:"pointer"}}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:16,padding:"14px",color:"rgba(255,255,255,0.7)",fontFamily:"Caveat,cursive",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
            onClick={()=>{gps();setShowSearch(false);}}>
            <Navigation size={16}/> Use My Current Location
          </button>
          <button style={{background:"none",border:"none",color:"rgba(255,255,255,0.45)",fontFamily:"Nunito,sans-serif",fontSize:14,cursor:"pointer",padding:"8px"}}
            onClick={()=>setShowSearch(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
