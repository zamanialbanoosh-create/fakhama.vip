const express=require("express"),cors=require("cors"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const app=express();
const PORT=process.env.PORT||3000, ADMIN_PIN=process.env.ADMIN_PIN||"1234", STAFF_PIN=process.env.STAFF_PIN||"1111";
const DATA_DIR=path.join(__dirname,"data"), CLAIMS_FILE=path.join(DATA_DIR,"claims.json"), PRIZES_FILE=path.join(DATA_DIR,"prizes.json"), SETTINGS_FILE=path.join(DATA_DIR,"settings.json");
app.use(cors()); app.use(express.json({limit:"1mb"})); app.use(express.urlencoded({extended:true})); app.use(express.static(path.join(__dirname,"public")));
if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true});
function readJson(file,fallback){try{if(!fs.existsSync(file))return fallback;return JSON.parse(fs.readFileSync(file,"utf8"))}catch(e){console.error("READ JSON ERROR",file,e);return fallback}}
function writeJson(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2))}
function init(){
 if(!fs.existsSync(CLAIMS_FILE))writeJson(CLAIMS_FILE,{claims:[]});
 if(!fs.existsSync(PRIZES_FILE))writeJson(PRIZES_FILE,{prizes:[
  {id:crypto.randomUUID(),title:"خصم 10%",code:"DISCOUNT10",weight:34,active:true,vipOnly:false},
  {id:crypto.randomUUID(),title:"خصم 1 دينار",code:"KWD1",weight:20,active:true,vipOnly:false},
  {id:crypto.randomUUID(),title:"NFC مجاني مع الطلب",code:"FREE_NFC",weight:25,active:true,vipOnly:false},
  {id:crypto.randomUUID(),title:"خام نوم مجانا",code:"PIJAMAFABRIC",weight:10,active:true,vipOnly:true},
  {id:crypto.randomUUID(),title:"تفصيل 1 دشداشة مجاناً",code:"TAILOR_FREE",weight:3,active:true,vipOnly:true},
  {id:crypto.randomUUID(),title:"خصم 15%",code:"DISCOUNT15",weight:8,active:true,vipOnly:false}
 ]});
 if(!fs.existsSync(SETTINGS_FILE))writeJson(SETTINGS_FILE,{shopName:process.env.SHOP_NAME||"TAJ AL FAKHAMA",shopWhatsapp:process.env.SHOP_WHATSAPP||"96500000000",chanceHours:72,couponHours:72,storyText:"الجائزة لا تعتمد إلا بعد فحص الكود من الموظف.",vipPhones:[]});
}
init();
function settings(){let s=readJson(SETTINGS_FILE,{});return{shopName:s.shopName||"TAJ AL FAKHAMA",shopWhatsapp:s.shopWhatsapp||"96500000000",chanceHours:Number(s.chanceHours||72),couponHours:Number(s.couponHours||72),storyText:s.storyText||"الجائزة لا تعتمد إلا بعد فحص الكود من الموظف.",vipPhones:Array.isArray(s.vipPhones)?s.vipPhones:[]}}
function normalizePhone(p){return String(p||"").trim().replace(/[^\d+]/g,"").replace(/^00/,"+")}
function validPhone(p){return /^(\+?\d{8,15})$/.test(p)}
function now(){return Date.now()}
function makeCode(){return"TAJ-"+Math.floor(100000+Math.random()*900000)}
function isVip(phone){return settings().vipPhones.map(normalizePhone).includes(phone)}
function prizesFor(phone){let vip=isVip(phone);let ps=(readJson(PRIZES_FILE,{prizes:[]}).prizes||[]);return ps.filter(p=>p.active&&Number(p.weight)>0&&(!p.vipOnly||vip))}
function pickPrize(phone){let ps=prizesFor(phone);if(!ps.length)return{title:"حظ أوفر المرة القادمة",code:"TRY_AGAIN",weight:1};let total=ps.reduce((s,p)=>s+Number(p.weight||0),0),r=Math.random()*total;for(let p of ps){r-=Number(p.weight||0);if(r<=0)return p}return ps[0]}
function pub(c){return{id:c.id,phone:c.phone,prizeTitle:c.prizeTitle,prizeCode:c.prizeCode,claimCode:c.claimCode,status:c.status,createdAt:c.createdAt,expiresAt:c.expiresAt,usedAt:c.usedAt||null,usedBy:c.usedBy||"",orderNo:c.orderNo||""}}
function lastClaim(db,phone){let limit=now()-settings().chanceHours*60*60*1000;return db.claims.find(c=>c.phone===phone&&c.createdAtMs>=limit)}
function findClaim(db,code){return db.claims.find(c=>String(c.claimCode).toUpperCase()===String(code||"").toUpperCase())}
app.post("/api/admin/login",(req,res)=>{

  const { pin } = req.body;

  if(pin !== ADMIN_PIN){

    return res.status(401).json({
      success:false
    });

  }

  res.json({
    success:true
  });

});
app.get("/api/health",(req,res)=>res.json({success:true,message:"Fakhama VIP Rewards is running",settings:settings()}));
app.get("/api/config",(req,res)=>{let s=settings();res.json({success:true,data:{shopName:s.shopName,shopWhatsapp:s.shopWhatsapp,chanceHours:s.chanceHours,couponHours:s.couponHours,storyText:s.storyText}})});
app.get("/api/prizes",(req,res)=>res.json({success:true,data:(readJson(PRIZES_FILE,{prizes:[]}).prizes||[])}));
app.post("/api/claim",(req,res)=>{try{let phone=normalizePhone(req.body.phone);if(!validPhone(phone))return res.status(400).json({success:false,message:"رقم الهاتف غير صحيح"});let db=readJson(CLAIMS_FILE,{claims:[]});let old=lastClaim(db,phone);if(old)return res.json({success:true,reused:true,message:"لديك جائزة مسجلة سابقاً",claim:pub(old),settings:settings()});let p=pickPrize(phone), code=makeCode();while(findClaim(db,code))code=makeCode();let s=settings(), createdAtMs=now(), expiresAtMs=createdAtMs+s.couponHours*60*60*1000;let item={id:crypto.randomUUID(),phone,prizeTitle:p.title,prizeCode:p.code||"",claimCode:code,status:"active",createdAtMs,expiresAtMs,createdAt:new Date(createdAtMs).toISOString(),expiresAt:new Date(expiresAtMs).toISOString(),usedAt:null,usedAtMs:null,usedBy:"",orderNo:"",ip:req.ip};db.claims.unshift(item);writeJson(CLAIMS_FILE,db);res.json({success:true,reused:false,claim:pub(item),settings:s})}catch(e){console.error("CLAIM ERROR",e);res.status(500).json({success:false,message:"Server error"})}});
app.get("/api/check/:code",(req,res)=>{let db=readJson(CLAIMS_FILE,{claims:[]}),c=findClaim(db,req.params.code);if(!c)return res.json({success:false,valid:false,message:"الكود غير موجود"});if(c.status==="used")return res.json({success:true,valid:false,status:"used",message:"الكود مستخدم مسبقاً",claim:pub(c)});if(c.expiresAtMs<now()){c.status="expired";writeJson(CLAIMS_FILE,db);return res.json({success:true,valid:false,status:"expired",message:"انتهت صلاحية الكود",claim:pub(c)})}res.json({success:true,valid:true,status:"active",message:"الكود صحيح",claim:pub(c)})});
app.post("/api/redeem",(req,res)=>{let code=String(req.body.code||"").toUpperCase(),pin=String(req.body.pin||""),orderNo=String(req.body.orderNo||""),usedBy=String(req.body.usedBy||"staff");if(pin!==STAFF_PIN&&pin!==ADMIN_PIN)return res.status(403).json({success:false,message:"رمز الموظف غير صحيح"});let db=readJson(CLAIMS_FILE,{claims:[]}),c=findClaim(db,code);if(!c)return res.status(404).json({success:false,message:"الكود غير موجود"});if(c.status==="used")return res.status(409).json({success:false,message:"الكود مستخدم مسبقاً",claim:pub(c)});if(c.expiresAtMs<now()){c.status="expired";writeJson(CLAIMS_FILE,db);return res.status(409).json({success:false,message:"انتهت صلاحية الكود",claim:pub(c)})}c.status="used";c.usedAtMs=now();c.usedAt=new Date().toISOString();c.orderNo=orderNo;c.usedBy=usedBy;writeJson(CLAIMS_FILE,db);res.json({success:true,message:"تم تفعيل الجائزة بنجاح",claim:pub(c)})});
app.get("/api/admin/claims",(req,res)=>{if(String(req.query.pin||"")!==ADMIN_PIN)return res.status(403).json({success:false,message:"Invalid PIN"});res.json({success:true,data:(readJson(CLAIMS_FILE,{claims:[]}).claims||[]).map(pub)})});
app.post("/api/admin/prizes",(req,res)=>{if(String(req.body.pin||"")!==ADMIN_PIN)return res.status(403).json({success:false,message:"Invalid PIN"});let prizes=Array.isArray(req.body.prizes)?req.body.prizes:[];let clean=prizes.map(p=>({id:p.id||crypto.randomUUID(),title:String(p.title||"").trim(),code:String(p.code||"").trim(),weight:Number(p.weight||0),active:Boolean(p.active),vipOnly:Boolean(p.vipOnly)})).filter(p=>p.title&&p.weight>=0);writeJson(PRIZES_FILE,{prizes:clean});res.json({success:true,data:clean})});

app.post("/api/admin/settings",(req,res)=>{if(String(req.body.pin||"")!==ADMIN_PIN)return res.status(403).json({success:false,message:"Invalid PIN"});let cur=settings();let next={shopName:String(req.body.shopName||cur.shopName),shopWhatsapp:String(req.body.shopWhatsapp||cur.shopWhatsapp),chanceHours:Number(req.body.chanceHours||cur.chanceHours),couponHours:Number(req.body.couponHours||cur.couponHours),storyText:String(req.body.storyText||cur.storyText),vipPhones:Array.isArray(req.body.vipPhones)?req.body.vipPhones.map(normalizePhone):cur.vipPhones};writeJson(SETTINGS_FILE,next);res.json({success:true,data:next})});
app.post("/api/admin/login", (req, res) => {
  const pin = String(req.body.pin || "");

  if (pin !== ADMIN_PIN) {
    return res.status(401).json({
      success: false,
      message: "Invalid PIN"
    });
  }

  return res.json({
    success: true
  });
});
app.listen(PORT,()=>console.log(`Fakhama VIP Rewards running on port ${PORT}`));
