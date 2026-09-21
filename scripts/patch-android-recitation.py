#!/usr/bin/env python3
from pathlib import Path

out = Path("app/src/main/assets/web/pages/quran-recitation.js")
out.write_text(r"""(function(root){
'use strict';
const pad=(n,w)=>String(n).padStart(w,'0');
const android=!!root.Houd11Android;
const localBase='https://appassets.androidplatform.net/quran-audio/audio/';
const webBase='https://everyayah.com/data/Minshawy_Murattal_128kbps/';
const fallbackBase='https://cdn.islamic.network/quran/audio/128/ar.minshawi/';
const audio=new Audio(); audio.preload='metadata';
const state={playing:false,loading:false,surah:null,ayah:null,totalAyahs:0,error:null,fallbackTried:false};
let onAyahChange=null,onSurahEnd=null,getGlobalAyah=null;
function emit(){root.dispatchEvent(new CustomEvent('rafeeq:recitation',{detail:{...state}}));}
function setState(p){Object.assign(state,p);emit();}
function localUrl(s,a){return localBase+pad(s,3)+pad(a,3)+'.ogg';}
function webUrl(s,a){return webBase+pad(s,3)+pad(a,3)+'.mp3';}
function fallbackUrl(g){return fallbackBase+String(g)+'.mp3';}
function play(surah,ayah,totalAyahs,globalAyah){
 const s=Number(surah),a=Number(ayah),total=Number(totalAyahs);
 if(!Number.isInteger(s)||s<1||s>114||!Number.isInteger(a)||a<1||!Number.isInteger(total)||a>total){setState({playing:false,loading:false,error:'بيانات التلاوة غير صحيحة'});return;}
 audio.pause();audio.currentTime=0;state.fallbackTried=false;
 setState({playing:true,loading:true,surah:s,ayah:a,totalAyahs:total,error:null});
 audio.src=android?localUrl(s,a):webUrl(s,a);onAyahChange?.(a);
 const p=audio.play();if(p?.catch)p.catch(()=>{setState({playing:false,loading:false,error:android?'ثبّت حزمة القرآن المسموع أولاً.':'تعذّر تشغيل التلاوة.'});});
}
function stop(){audio.pause();audio.currentTime=0;setState({playing:false,loading:false,error:null,surah:null,ayah:null,totalAyahs:0});}
function pause(){audio.pause();setState({playing:false,loading:false});}
function resume(){if(state.surah==null)return;const p=audio.play();if(p?.catch)p.catch(()=>setState({playing:false,loading:false,error:'تعذّر استئناف التلاوة.'}));}
function toggle(s,a,t,g){if(state.playing)return pause();if(state.surah===Number(s)&&state.ayah!=null)return resume();play(s,a,t,g);}
audio.addEventListener('playing',()=>setState({playing:true,loading:false,error:null}));
audio.addEventListener('waiting',()=>setState({loading:true}));
audio.addEventListener('pause',()=>{if(!audio.ended)setState({playing:false,loading:false});});
audio.addEventListener('error',()=>{
 if(android){setState({playing:false,loading:false,error:'صوت هذه الآية غير موجود في حزمة القرآن.'});return;}
 if(!state.fallbackTried){state.fallbackTried=true;const g=getGlobalAyah?.(state.surah,state.ayah);if(g){audio.src=fallbackUrl(g);audio.play().catch(()=>{});return;}}
 setState({playing:false,loading:false,error:'تعذّر تحميل صوت هذه الآية.'});
});
audio.addEventListener('ended',()=>{if(state.surah==null)return;if(state.ayah<state.totalAyahs)play(state.surah,state.ayah+1,state.totalAyahs);else{const s=state.surah;setState({playing:false,loading:false});onSurahEnd?.(s);}});
function configure(o={}){onAyahChange=typeof o.onAyahChange==='function'?o.onAyahChange:null;onSurahEnd=typeof o.onSurahEnd==='function'?o.onSurahEnd:null;getGlobalAyah=typeof o.getGlobalAyah==='function'?o.getGlobalAyah:null;}
root.RafeeqRecitation=Object.freeze({play,stop,pause,resume,toggle,configure,state,primaryUrl:android?localUrl:webUrl,fallbackUrl});
})(window);
""", encoding="utf-8")
print(out)
