import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {randomInt, randomUUID} from 'node:crypto';
import path from 'node:path';
import {existsSync} from 'node:fs';

const app=express(); const http=createServer(app); const allowedOrigin=process.env.CLIENT_ORIGIN; const io=new Server(http,{cors:{origin:allowedOrigin||true}});
type Player={id:string;token:string;socket:string|null;name:string;slot:0|1;ready:boolean;input:number;lastSeen:number};
type Game={ball:{x:number;y:number;vx:number;vy:number};paddles:[number,number];score:[number,number];countdown:number;winner:number|null};
type Room={code:string;host:string;players:Player[];status:'lobby'|'countdown'|'playing'|'over'|'paused';game:Game;updated:number;pauseAt:number};
const rooms=new Map<string,Room>(); const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function code(){let c='';do{c=Array.from({length:4},()=>alphabet[randomInt(alphabet.length)]).join('')}while(rooms.has(c));return c}
function game():Game{return {ball:{x:.5,y:.5,vx:0,vy:0},paddles:[.5,.5],score:[0,0],countdown:3,winner:null}}
function publicRoom(r:Room){return {code:r.code,status:r.status,players:r.players.map(p=>({id:p.id,name:p.name,slot:p.slot,ready:p.ready,connected:!!p.socket})),game:r.game}}
function emit(r:Room){r.updated=Date.now();io.to(r.code).emit('room',publicRoom(r))}
function resetBall(g:Game,direction:number){g.ball={x:.5,y:.5,vx:direction*.52,vy:(Math.random()*.42-.21)}}
function start(r:Room){r.game=game();r.status='countdown';r.game.countdown=3;emit(r);let n=3;const timer=setInterval(()=>{if(!rooms.has(r.code)||r.status!=='countdown'){clearInterval(timer);return}n--;r.game.countdown=n;if(n===0){clearInterval(timer);resetBall(r.game,Math.random()<.5?1:-1);r.status='playing'}emit(r)},1000)}
io.on('connection',s=>{
 s.on('create',(_,ack)=>{const r:Room={code:code(),host:s.id,players:[],status:'lobby',game:game(),updated:Date.now(),pauseAt:0};rooms.set(r.code,r);s.join(r.code);ack?.({ok:true,code:r.code});emit(r)});
 s.on('join',(data,ack)=>{const c=String(data?.code||'').toUpperCase();const r=rooms.get(c);if(!r)return ack?.({error:'Room not found or expired.'});let p=r.players.find(x=>x.token===data?.token);if(!p){if(r.players.length>=2)return ack?.({error:'Room is full.'});if(r.status!=='lobby')return ack?.({error:'Game already started.'});const name=String(data?.name||'PLAYER').trim().slice(0,16)||'PLAYER';if(r.players.some(x=>x.name.toLowerCase()===name.toLowerCase()))return ack?.({error:'That name is taken.'});p={id:randomUUID(),token:randomUUID(),socket:s.id,name,slot:r.players.length as 0|1,ready:false,input:0,lastSeen:Date.now()};r.players.push(p)}else{p.socket=s.id;p.lastSeen=Date.now();if(r.status==='paused'&&r.players.every(x=>x.socket)){r.status='playing'}}s.join(c);ack?.({ok:true,token:p.token,slot:p.slot});emit(r)});
 s.on('ready',(data)=>{const r=rooms.get(data?.code);const p=r?.players.find(x=>x.token===data?.token&&x.socket===s.id);if(!p)return;p.ready=!!data.ready;emit(r!)});
 s.on('input',(data)=>{const r=rooms.get(data?.code);const p=r?.players.find(x=>x.token===data?.token&&x.socket===s.id);if(!p||typeof data.vertical!=='number'||!Number.isFinite(data.vertical))return;p.input=Math.max(-1,Math.min(1,data.vertical));p.lastSeen=Date.now()});
 s.on('start',(data)=>{const r=rooms.get(data?.code);if(r?.host!==s.id||r.status!=='lobby'||r.players.length!==2||!r.players.every(p=>p.ready&&p.socket))return;start(r)});
 s.on('rematch',(data)=>{const r=rooms.get(data?.code);if(r?.host!==s.id||r.status!=='over'||!r.players.every(p=>p.socket))return;start(r)});
 s.on('lobby',(data)=>{const r=rooms.get(data?.code);if(r?.host!==s.id)return;r.status='lobby';r.game=game();r.players.forEach(p=>{p.ready=false;p.input=0});emit(r)});
 s.on('disconnect',()=>{for(const r of rooms.values()){if(r.host===s.id){io.to(r.code).emit('closed');rooms.delete(r.code);continue}const p=r.players.find(x=>x.socket===s.id);if(p){p.socket=null;p.lastSeen=Date.now();if(r.status==='playing'){r.status='paused';r.pauseAt=Date.now()}emit(r)}}});
});
let last=Date.now(),broadcast=0;
setInterval(()=>{const now=Date.now(),dt=Math.min((now-last)/1000,.05);last=now;for(const r of rooms.values()){if(r.status==='paused'&&now-r.pauseAt>30000){r.status='lobby';r.game=game();r.players=r.players.filter(p=>p.socket);r.players.forEach((p,i)=>{p.slot=i as 0|1;p.ready=false});emit(r)}if(r.status!=='playing')continue;const g=r.game;for(const p of r.players){const target=Math.max(.105,Math.min(.895,.5+p.input*.42));g.paddles[p.slot]+=(target-g.paddles[p.slot])*Math.min(1,dt*11)}const b=g.ball;let nx=b.x+b.vx*dt,ny=b.y+b.vy*dt;if(ny<.025||ny>.975){b.vy*=-1;ny=Math.max(.025,Math.min(.975,ny))}const side=nx<.055?0:nx>.945?1:-1;if(side!==-1&&b.vx*(side===0?-1:1)>0){const offset=(ny-g.paddles[side])/.115;if(Math.abs(offset)<=1){b.vx=-b.vx*1.055;b.vy=Math.max(-.85,Math.min(.85,b.vy*.65+offset*.38));nx=side===0?.055:.945;io.to(r.code).emit('effect',{type:'hit',slot:side})}}if(nx<-.02||nx>1.02){const winner=nx<0?1:0;g.score[winner]++;io.to(r.code).emit('effect',{type:'score',slot:winner});if(g.score[winner]>=7){g.winner=winner;r.status='over';b.vx=0;b.vy=0;emit(r)}else resetBall(g,winner===0?1:-1)}else{b.x=nx;b.y=ny}if(now-broadcast>=33)io.to(r.code).emit('frame',{game:g,status:r.status})}if(now-broadcast>=33)broadcast=now},16);
setInterval(()=>{const now=Date.now();for(const [c,r] of rooms)if(now-r.updated>2*60*60*1000)rooms.delete(c)},60000);
const dist=path.resolve('dist');if(existsSync(dist)){app.use(express.static(dist));app.get('/{*path}',(_,res)=>res.sendFile(path.join(dist,'index.html')))}
http.listen(Number(process.env.PORT)||3001,()=>console.log('Motion Arcade on port '+(process.env.PORT||3001)));
