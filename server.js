const express=require("express");
const cors=require("cors");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const app=express();
const PORT=process.env.PORT||3000;
const SHOP_WHATSAPP=process.env.SHOP_WHATSAPP||"965XXXXXXXX";
const DATA_DIR=path.join(__dirname,"data");
const DB_FILE=path.join(DATA_DIR,"claims.json");
const PRIZES_FILE=path.join(__dirname,"public","prizes.json");
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,"public")));
if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true});
if(!fs.existsSync(DB_FILE))fs.writeFileSync(DB_FILE,JSON.stringify({claims:[]},null,2));
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,"utf8"));}catch{return fallback;}}
function writeJson(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2));}
function nowMs(){return Date.now();}
function normalizePhone(phone){return String(phone||"").trim().replace(/[^\d+]/g,"").replace(/^00/,"+");}
function isValidPhone(phone){return /^(\+?\d{8,15})$/.test(phone);}
function generateClaimCode(){return "TAJ-"+Math.floor(100000+Math.random()*900000);}
function loadActivePrizes(){
  return [
    {"title":"خصم 10%","code":"DISCOUNT10","weight":32,"active":true},
    {"title":"خصم 1 دينار","code":"KWD1","weight":15,"active":true},
    {"title":"تفصيل 1 دشداشة مجاناً","code":"TAILOR1PCFREE","weight":5,"active":true},
    {"title":"NFC مجاني مع الطلب","code":"FREE_NFC","weight":27,"active":true},
    {"title":"طقم نوم مجاناً","code":"PIJAMAFABRIC","weight":10,"active":true},
    {"title":"خصم 15%","code":"DISCOUNT15","weight":8,"active":true},
    {"title":"قماش بنغفوري مجاناً","code":"FREEFABRICSNG","weight":3,"active":true}
  ].filter(p => p.active && Number(p.weight) > 0);
}
function pickPrize(){

  const prizes = [
    {title:"خصم 10%",code:"DISCOUNT10",weight:32,active:true},
    {title:"خصم 1 دينار",code:"KWD1",weight:15,active:true},
    {title:"تفصيل 1 دشداشة مجاناً",code:"TAILOR1PCFREE",weight:5,active:true},
    {title:"NFC مجاني مع الطلب",code:"FREE_NFC",weight:27,active:true},
    {title:"طقم نوم مجاناً",code:"PIJAMAFABRIC",weight:10,active:true},
    {title:"خصم 15%",code:"DISCOUNT15",weight:8,active:true},
    {title:"قماش بنغفوري مجاناً",code:"FREEFABRICSNG",weight:3,active:true}
  ];

  const total = prizes.reduce((sum,p)=>sum+p.weight,0);
  let r = Math.random()*total;

  for(const p of prizes){
    if(r < p.weight) return p;
    r -= p.weight;
  }

  return prizes[0];
}function findLast24hClaim(db,phone){const limit=nowMs()-24*60*60*1000;return db.claims.find(c=>c.phone===phone&&c.createdAtMs>=limit);}
function findClaimByCode(db,code){return db.claims.find(c=>String(c.claimCode).toUpperCase()===String(code).toUpperCase());}
function publicClaim(c){return{phone:c.phone,prizeTitle:c.prizeTitle,prizeCode:c.prizeCode,claimCode:c.claimCode,createdAt:c.createdAt,expiresAt:c.expiresAt};}
app.get("/api/health",(req,res)=>res.json({success:true,message:"Rewards system is running"}));
app.get("/api/prizes",(req,res)=>res.json({success:true,data:loadActivePrizes()}));
app.post("/api/claim",(req,res)=>{try{const phone=normalizePhone(req.body.phone);if(!isValidPhone(phone))return res.status(400).json({success:false,message:"رقم الهاتف غير صحيح"});const db=readJson(DB_FILE,{claims:[]});const oldClaim=findLast24hClaim(db,phone);if(oldClaim)return res.json({success:true,reused:true,message:"لديك جائزة مسجلة خلال آخر 24 ساعة",shopWhatsApp:SHOP_WHATSAPP,claim:publicClaim(oldClaim)});const prize=pickPrize();let claimCode=generateClaimCode();while(findClaimByCode(db,claimCode))claimCode=generateClaimCode();const createdAtMs=nowMs();const expiresAtMs=createdAtMs+24*60*60*1000;const claim={id:crypto.randomUUID(),phone,prizeTitle:prize.title,prizeCode:prize.code,claimCode,createdAtMs,expiresAtMs,createdAt:new Date(createdAtMs).toISOString(),expiresAt:new Date(expiresAtMs).toISOString(),ip:req.ip};db.claims.push(claim);writeJson(DB_FILE,db);return res.json({success:true,reused:false,message:"تم تسجيل جائزتك بنجاح",shopWhatsApp:SHOP_WHATSAPP,claim:publicClaim(claim)});}catch(err){console.error("CLAIM ERROR:",err);return res.status(500).json({success:false,message:"Server error"});}});
app.listen(PORT,()=>{console.log("Fakhama VIP Rewards is running");console.log("Customer page: http://localhost:"+PORT);console.log("Shop WhatsApp:",SHOP_WHATSAPP);});
