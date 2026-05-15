import { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LabelList } from "recharts";
import { db } from "./firebase";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore";

const C = {
  cream:"#FAF7F2",blush:"#EDD9C8",rose:"#C07A58",
  deep:"#2E1F14",sage:"#6B9B82",alert:"#C93B3B",
  gold:"#C4993E",card:"#FFFFFF",muted:"#9A8478",roseDark:"#9A5C3E",
};

const SIDE_EFFECTS_OPTIONS = [
  "คลื่นไส้","อาเจียน","ท้องผูก","ท้องเสีย","ปวดหัว","เวียนหัว",
  "เบื่ออาหาร","ปวดท้อง","ปวดเมื่อยตามตัว",
  "ประจำเดือนผิดปกติ","นอนหลับผิดปกติ","ไม่มีผลข้างเคียง","อื่นๆ",
];
const EXERCISE_OPTIONS = [
  "เดิน 30+ นาที","วิ่ง","ว่ายน้ำ","ขี่จักรยาน",
  "โยคะ/พิลาทิส","เวทเทรนนิ่ง","คาร์ดิโอ","ยกน้ำหนัก",
  "ไม่ได้ออกกำลังกาย","อื่นๆ",
];
const FOOD_OPTIONS = [
  "ผลไม้","เครื่องดื่มรสหวาน","โปรตีนชง","ของทอด","วิตามินบี","สเตียรอยด์","อื่นๆ",
];
const DOSE_OPTIONS = ["2.5 mg","5 mg","7.5 mg","10 mg","12.5 mg","15 mg","อื่นๆ"];
const DOCTOR_PIN = "49338";
const RED_TRIGGERS = ["ผลไม้","เครื่องดื่มรสหวาน","ของทอด","วิตามินบี","สเตียรอยด์"];

// ── Firebase ──────────────────────────────────────────────
async function fbGet(name) {
  try { const s=await getDoc(doc(db,"patients",name)); return s.exists()?s.data():null; } catch { return null; }
}
async function fbSet(name,data) {
  try { await setDoc(doc(db,"patients",name),data); return true; } catch(e) { console.error(e); return false; }
}
async function fbListAll() {
  try { const s=await getDocs(collection(db,"patients")); return s.docs.map(d=>d.data()); } catch { return []; }
}
async function fbMarkRead(name) {
  try { await updateDoc(doc(db,"patients",name),{doctorRead:true}); return true; } catch { return false; }
}
async function fbDelete(name) {
  try { await deleteDoc(doc(db,"patients",name)); return true; } catch { return false; }
}

// ── Stock Firebase ───────────────────────────────────────
const STOCK_DOSES = ["5 mg","7.5 mg","10 mg","15 mg"];
async function fbGetStock() {
  try { const s=await getDoc(doc(db,"stock","mounjaro")); return s.exists()?s.data():{} ; } catch { return {}; }
}
async function fbSetStock(data) {
  try { await setDoc(doc(db,"stock","mounjaro"),data); return true; } catch { return false; }
}

// ── Order Firebase ────────────────────────────────────────
async function fbGetOrders() {
  try { const s=await getDocs(collection(db,"orders")); return s.docs.map(d=>({id:d.id,...d.data()})); } catch { return []; }
}
async function fbAddOrder(order) {
  try {
    const id="order_"+Date.now();
    await setDoc(doc(db,"orders",id),{...order,id,createdAt:new Date().toISOString(),status:"pending"});
    return true;
  } catch(e) { console.error(e); return false; }
}
async function fbUpdateOrder(id,updates) {
  try { await updateDoc(doc(db,"orders",id),updates); return true; } catch { return false; }
}
async function fbDeleteOrder(id) {
  try { await deleteDoc(doc(db,"orders",id)); return true; } catch { return false; }
}

// ── Helpers ───────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split("T")[0]; }
function fmtDateTH(d) {
  return new Date(d+"T00:00:00").toLocaleDateString("th-TH",{weekday:"short",day:"numeric",month:"long",year:"numeric"});
}
function fmtDateShort(d) {
  return new Date(d+"T00:00:00").toLocaleDateString("th-TH",{day:"numeric",month:"short"});
}
function daysBetween(a,b) { return Math.round((new Date(b)-new Date(a))/86400000); }
function getStatus(records,idx) {
  if(idx===0) return "first";
  const days=daysBetween(records[idx-1].date,records[idx].date)||7;
  const diff=records[idx-1].weight-records[idx].weight;
  const perWeek=(diff/days)*7;
  if(diff>=0&&perWeek>=0.5) return "good";
  if(diff>0) return "low";
  return "gain";
}
function hasAlert(recs) {
  if(recs.length<2) return false;
  const last=recs[recs.length-1], prev=recs[recs.length-2];
  const days=daysBetween(prev.date,last.date)||7;
  const diff=prev.weight-last.weight;
  const perWeek=(diff/days)*7;
  // alert only if weight went up OR per-week loss < 0.5
  return diff<0 || perWeek<0.5;
}
function hasRedFlag(r) {
  return RED_TRIGGERS.some(t=>(r.foodTags||[]).includes(t))||
    (r.sideEffects||[]).filter(s=>s!=="ไม่มีผลข้างเคียง"&&s!=="อื่นๆ").length>0||
    !!(r.sideEffectOther);
}
function hasExercise(r) {
  const ex=r.exercise||[];
  return ex.length>0&&!ex.every(e=>e==="ไม่ได้ออกกำลังกาย");
}
function noExercise(r) {
  const ex=r.exercise||[];
  return ex.includes("ไม่ได้ออกกำลังกาย")&&!ex.some(e=>e!=="ไม่ได้ออกกำลังกาย"&&e!=="อื่นๆ");
}

// ── Shared styles ─────────────────────────────────────────
const inputSt={width:"100%",padding:"11px 13px",border:`1.5px solid ${C.blush}`,borderRadius:10,background:C.cream,color:C.deep,fontFamily:"'DM Sans',sans-serif",fontSize:15,outline:"none",boxSizing:"border-box"};
const labelSt={display:"block",fontSize:11,fontWeight:500,color:C.rose,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6};
const cardSt={background:C.card,borderRadius:16,padding:"18px 16px",marginBottom:14,boxShadow:"0 2px 16px rgba(46,31,20,.07)"};
const btnSt={width:"100%",padding:13,borderRadius:12,border:"none",background:`linear-gradient(135deg, ${C.rose}, ${C.roseDark})`,color:"#fff",fontSize:15,fontWeight:500,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",marginTop:8};
const secBtnSt={padding:"9px 18px",borderRadius:10,border:`1.5px solid ${C.blush}`,background:"transparent",color:C.muted,fontSize:13,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"};

// ── Shared components ─────────────────────────────────────
function Toast({msg,show}) {
  return <div style={{position:"fixed",bottom:28,left:"50%",transform:`translateX(-50%) translateY(${show?0:16}px)`,opacity:show?1:0,transition:"all .3s",background:C.deep,color:"#fff",padding:"11px 22px",borderRadius:30,fontSize:13,pointerEvents:"none",zIndex:999,whiteSpace:"nowrap"}}>{msg}</div>;
}
function Badge({color,children}) {
  return <span style={{fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:20,background:color+"22",color,display:"inline-block"}}>{children}</span>;
}
function CardTitle({children,color}) {
  return <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:600,color:C.deep,marginBottom:14,paddingBottom:10,borderBottom:`1px solid ${C.blush}`}}><span style={{display:"inline-block",width:6,height:6,background:color||C.rose,borderRadius:"50%",marginRight:8,verticalAlign:"middle"}}/>{children}</div>;
}
function TagSelector({options,selected,onChange,color}) {
  return <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
    {options.map(o=>{const on=selected.includes(o);return <button key={o} onClick={()=>onChange(on?selected.filter(x=>x!==o):[...selected,o])} style={{padding:"7px 13px",borderRadius:20,fontSize:12,border:`1.5px solid ${on?color:C.blush}`,background:on?color:"transparent",color:on?"#fff":C.muted,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",fontWeight:on?500:400}}>{o}</button>;})}
  </div>;
}

// custom dot with dose label
function ChartDot(props) {
  const {cx,cy,payload}=props;
  const color=payload.status==="good"?C.sage:payload.status==="first"?C.gold:C.alert;
  return <circle cx={cx} cy={cy} r={6} fill={color} stroke="#fff" strokeWidth={2}/>;
}
function DoseLabel(props) {
  const {x,y,value}=props;
  if(!value) return null;
  return <text x={x} y={y-10} textAnchor="middle" fill={C.muted} fontSize={9} fontFamily="'DM Sans',sans-serif">{value}</text>;
}

function WeightAdvice({records,idx}) {
  if(idx===0) return null;
  const days=daysBetween(records[idx-1].date,records[idx].date)||7;
  const diff=records[idx-1].weight-records[idx].weight;
  const perWeek=(diff/days)*7;
  if(diff<0) return <div style={{marginTop:8,padding:"10px 12px",background:"rgba(201,59,59,0.07)",borderRadius:10,fontSize:12,color:C.alert,lineHeight:1.6}}>⚠️ <strong>น้ำหนักขึ้น {Math.abs(diff).toFixed(1)} กก.</strong><br/>พิจารณาปรับพฤติกรรม หรือปรึกษาคุณหมอก่อนปรับยาค่ะ</div>;
  if(perWeek>=0.5) return <div style={{marginTop:8,padding:"10px 12px",background:"rgba(107,155,130,0.1)",borderRadius:10,fontSize:12,color:C.sage,lineHeight:1.6}}>✅ <strong>น้ำหนักลงดี ({diff.toFixed(1)} กก. ใน {days} วัน)</strong><br/>แนะนำใช้โดสเท่าเดิมต่อไปค่ะ</div>;
  return <div style={{marginTop:8,padding:"10px 12px",background:"rgba(201,59,59,0.07)",borderRadius:10,fontSize:12,color:C.alert,lineHeight:1.6}}>🔴 <strong>น้ำหนักลงช้า ({diff.toFixed(1)} กก. ใน {days} วัน)</strong><br/>พิจารณาปรับพฤติกรรมหรือปรับโดสยาขึ้น <em>ปรึกษาคุณหมอก่อนเพิ่มยาค่ะ</em></div>;
}

function RecordDetail({r}) {
  const red=hasRedFlag(r),green=hasExercise(r),nex=noExercise(r);
  const has=r.sideEffects?.length>0||r.exercise?.length>0||r.foodTags?.length>0||r.note||r.sideEffectOther||r.foodOther||r.exerciseOther||r.doseOther;
  if(!has) return null;
  return <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.blush}`,display:"flex",flexDirection:"column",gap:4}}>
    {r.sideEffects?.filter(s=>s!=="อื่นๆ").length>0&&<div style={{fontSize:12,color:C.alert}}>{red?"🔴 ":""} ⚡ {r.sideEffects.filter(s=>s!=="อื่นๆ").join(", ")}</div>}
    {r.sideEffectOther&&<div style={{fontSize:12,color:C.alert}}>🔴 ⚡ อื่นๆ: {r.sideEffectOther}</div>}
    {r.exercise?.length>0&&<div style={{fontSize:12,color:nex?C.alert:C.sage}}>{nex?"🔴":"🟢"} 🏃 {r.exercise.filter(e=>e!=="อื่นๆ").join(", ")}{r.exerciseOther?` / ${r.exerciseOther}`:""}</div>}
    {r.foodTags?.filter(f=>f!=="อื่นๆ").length>0&&<div style={{fontSize:12,color:C.gold}}>{red?"🔴 ":""} 🏷 {r.foodTags.filter(f=>f!=="อื่นๆ").join(", ")}</div>}
    {r.foodOther&&<div style={{fontSize:12,color:C.gold}}>🏷 อื่นๆ: {r.foodOther}</div>}
    {r.doseOther&&<div style={{fontSize:12,color:C.muted}}>💉 โดส: {r.doseOther}</div>}
    {r.note&&<div style={{fontSize:12,color:"#bbb"}}>📝 {r.note}</div>}
  </div>;
}

// ── RecordForm ────────────────────────────────────────────
function RecordForm({patientName,hasHistory,onSave,onViewHistory,saving,showToast,initialData,isEdit}) {
  const [date,setDate]=useState(initialData?.date||todayStr());
  const [weight,setWeight]=useState(initialData?.weight?.toString()||"");
  const [dose,setDose]=useState(initialData?.dose||"");
  const [doseOther,setDoseOther]=useState(initialData?.doseOther||"");
  const [sideEffects,setSideEffects]=useState(initialData?.sideEffects||[]);
  const [sideEffectOther,setSideEffectOther]=useState(initialData?.sideEffectOther||"");
  const [exercise,setExercise]=useState(initialData?.exercise||[]);
  const [exerciseOther,setExerciseOther]=useState(initialData?.exerciseOther||"");
  const [foodTags,setFoodTags]=useState(initialData?.foodTags||[]);
  const [foodOther,setFoodOther]=useState(initialData?.foodOther||"");
  const [note,setNote]=useState(initialData?.note||"");

  function submit() {
    if(!date) return showToast("กรุณาเลือกวันที่");
    const w=parseFloat(weight);
    if(isNaN(w)||w<20||w>250) return showToast("กรุณากรอกน้ำหนักให้ถูกต้อง");
    if(!dose) return showToast("กรุณาเลือกขนาดยา");
    if(dose==="อื่นๆ"&&!doseOther.trim()) return showToast("กรุณากรอกขนาดยา");
    onSave({date,weight:w,dose,doseOther,sideEffects,sideEffectOther,exercise,exerciseOther,foodTags,foodOther,note});
  }

  return <div style={{padding:"18px 14px"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <div>
        <div style={{fontSize:12,color:C.muted}}>{isEdit?"แก้ไขข้อมูล":"บันทึกโดย"}</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:C.deep,fontWeight:600}}>{patientName}</div>
      </div>
      {hasHistory&&!isEdit&&<button style={secBtnSt} onClick={onViewHistory}>ดูประวัติ</button>}
    </div>
    <div style={cardSt}>
      <CardTitle>{isEdit?"✏️ แก้ไขข้อมูล":"บันทึกวันนี้"}</CardTitle>
      <div style={{marginBottom:12}}>
        <label style={labelSt}>วันที่ชั่งน้ำหนัก</label>
        <input type="date" style={inputSt} value={date} onChange={e=>setDate(e.target.value)}/>
        {date&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>{fmtDateTH(date)}</div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div>
          <label style={labelSt}>น้ำหนัก (กก.)</label>
          <input type="number" inputMode="decimal" style={inputSt} placeholder="65.5" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)}/>
        </div>
        <div>
          <label style={labelSt}>ขนาดยา</label>
          <select style={{...inputSt,appearance:"none"}} value={dose} onChange={e=>setDose(e.target.value)}>
            <option value="">เลือก dose</option>
            {DOSE_OPTIONS.map(d=><option key={d}>{d}</option>)}
          </select>
        </div>
      </div>
      {dose==="อื่นๆ"&&<div style={{marginBottom:14}}><label style={labelSt}>ระบุขนาดยา</label><input style={inputSt} placeholder="เช่น 20 mg" value={doseOther} onChange={e=>setDoseOther(e.target.value)}/></div>}
      <div style={{marginBottom:14}}>
        <label style={labelSt}>ผลข้างเคียงที่พบ</label>
        <TagSelector options={SIDE_EFFECTS_OPTIONS} selected={sideEffects} onChange={setSideEffects} color={C.alert}/>
        {sideEffects.includes("อื่นๆ")&&<input style={{...inputSt,marginTop:8}} placeholder="ระบุผลข้างเคียงอื่นๆ..." value={sideEffectOther} onChange={e=>setSideEffectOther(e.target.value)}/>}
      </div>
      <div style={{marginBottom:14}}>
        <label style={labelSt}>การออกกำลังกายใน 1 สัปดาห์ที่ผ่านมา</label>
        <TagSelector options={EXERCISE_OPTIONS} selected={exercise} onChange={setExercise} color={C.sage}/>
        {exercise.includes("อื่นๆ")&&<input style={{...inputSt,marginTop:8}} placeholder="ระบุการออกกำลังกายอื่นๆ..." value={exerciseOther} onChange={e=>setExerciseOther(e.target.value)}/>}
      </div>
      <div style={{marginBottom:14}}>
        <label style={labelSt}>อาหาร / เครื่องดื่ม / ยาอื่น</label>
        <TagSelector options={FOOD_OPTIONS} selected={foodTags} onChange={setFoodTags} color={C.gold}/>
        {foodTags.includes("อื่นๆ")&&<input style={{...inputSt,marginTop:8}} placeholder="ระบุอาหาร/ยาอื่นๆ..." value={foodOther} onChange={e=>setFoodOther(e.target.value)}/>}
      </div>
      <div style={{marginBottom:4}}>
        <label style={labelSt}>หมายเหตุ</label>
        <input style={inputSt} placeholder="เช่น รู้สึกดี หิวน้อยลงมาก..." value={note} onChange={e=>setNote(e.target.value)}/>
      </div>
      <button style={{...btnSt,opacity:saving?0.7:1}} onClick={submit} disabled={saving}>{saving?"กำลังบันทึก...":"✦ บันทึก"}</button>
      {isEdit&&<button style={{...secBtnSt,width:"100%",marginTop:8,textAlign:"center"}} onClick={onViewHistory}>ยกเลิก</button>}
    </div>
  </div>;
}

// ── NameScreen ────────────────────────────────────────────
function NameScreen({onSubmit}) {
  const [first,setFirst]=useState(""); const [last,setLast]=useState("");
  return <div style={{padding:"18px 14px"}}>
    <div style={{textAlign:"center",padding:"32px 0 24px"}}>
      <div style={{fontSize:48,marginBottom:12}}>🌿</div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,color:C.deep,marginBottom:6}}>ยินดีต้อนรับ</div>
      <div style={{fontSize:14,color:C.muted,lineHeight:1.6}}>Astique Clinic — ติดตามผล Mounjaro<br/>กรุณากรอกชื่อ-นามสกุลเพื่อเริ่มต้น</div>
    </div>
    <div style={cardSt}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div><label style={labelSt}>ชื่อ</label><input style={inputSt} placeholder="ชื่อ" value={first} autoFocus onChange={e=>setFirst(e.target.value)}/></div>
        <div><label style={labelSt}>นามสกุล</label><input style={inputSt} placeholder="นามสกุล" value={last} onChange={e=>setLast(e.target.value)} onKeyDown={e=>e.key==="Enter"&&first.trim()&&last.trim()&&onSubmit(`${first.trim()} ${last.trim()}`)}/></div>
      </div>
      <button style={btnSt} onClick={()=>first.trim()&&last.trim()&&onSubmit(`${first.trim()} ${last.trim()}`)}>เริ่มต้นบันทึก →</button>
    </div>
  </div>;
}

// ── HistoryView ───────────────────────────────────────────
function HistoryView({patientName,records,onAddNew,onEdit}) {
  return <div style={{padding:"18px 14px"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <div>
        <div style={{fontSize:12,color:C.muted}}>ประวัติของ</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:C.deep,fontWeight:600}}>{patientName}</div>
      </div>
      <button style={secBtnSt} onClick={onAddNew}>+ บันทึกใหม่</button>
    </div>
    {records.length===0
      ?<div style={{textAlign:"center",padding:48,color:"#ccc"}}><div style={{fontSize:40,marginBottom:12}}>📋</div><div>ยังไม่มีข้อมูล</div></div>
      :[...records].reverse().map(r=>{
          const idx=records.indexOf(r);
          const status=getStatus(records,idx);
          const diff=idx>0?records[idx-1].weight-r.weight:null;
          const borderColor=status==="good"?C.sage:status==="first"?C.gold:C.alert;
          const red=hasRedFlag(r),green=hasExercise(r),nex=noExercise(r);
          return <div key={r.date} style={{...cardSt,borderLeft:`4px solid ${borderColor}`,paddingLeft:14,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontSize:11,color:C.muted,marginBottom:1}}>{fmtDateTH(r.date)}</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:600,color:C.deep}}>
                  {r.weight} <span style={{fontSize:14,fontWeight:400,color:C.muted}}>กก.</span>
                  {red&&<span style={{marginLeft:6}}>🔴</span>}
                  {green&&!nex&&<span style={{marginLeft:4}}>🟢</span>}
                  {nex&&<span style={{marginLeft:4}}>🔴</span>}
                </div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>💉 {r.dose==="อื่นๆ"?r.doseOther:r.dose}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                {status==="first"&&<Badge color={C.gold}>⭐ เริ่มต้น</Badge>}
                {status==="good"&&<Badge color={C.sage}>✅ ลงดี</Badge>}
                {status==="low"&&<Badge color={C.alert}>🔴 ลงช้า</Badge>}
                {status==="gain"&&<Badge color={C.alert}>🔴 น้ำหนักขึ้น</Badge>}
                <button onClick={()=>onEdit(r)} style={{...secBtnSt,fontSize:11,padding:"5px 10px"}}>✏️ แก้ไข</button>
              </div>
            </div>
            <WeightAdvice records={records} idx={idx}/>
            <RecordDetail r={r}/>
          </div>;
        })}
  </div>;
}

// ── ChartView ─────────────────────────────────────────────
function ChartView({patientName,records}) {
  if(!patientName) return <div style={{padding:40,textAlign:"center",color:C.muted}}>กรุณากรอกชื่อก่อน</div>;

  const chartData=records.map((r,i)=>({
    date:fmtDateShort(r.date),
    weight:r.weight,
    status:getStatus(records,i),
    dose:r.dose==="อื่นๆ"?r.doseOther:r.dose,
  }));

  // target line: from first weight, -0.5/week
  const targetData = records.length>=2 ? records.map((r,i)=>{
    const days=daysBetween(records[0].date,r.date);
    return {date:fmtDateShort(r.date),target:parseFloat((records[0].weight-(days/7)*0.5).toFixed(1))};
  }) : [];

  const totalLoss=records.length>=2?records[0].weight-records[records.length-1].weight:null;
  const alertRecs=records.filter((r,i)=>i>0&&records[i-1].weight-r.weight<0.5);

  return <div style={{padding:"18px 14px"}}>
    <div style={cardSt}>
      <CardTitle>สรุปผลของ {patientName}</CardTitle>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
        {[
          {val:records.length,label:"บันทึก"},
          {val:totalLoss!==null?`${totalLoss>=0?"−":"+"}${Math.abs(totalLoss).toFixed(1)} กก.`:"—",label:"ลดรวม"},
          {val:records.length>=2?daysBetween(records[0].date,records[records.length-1].date)+" วัน":"—",label:"ช่วงเวลา"},
        ].map(st=><div key={st.label} style={{background:C.cream,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:C.deep}}>{st.val}</div>
          <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.05em",marginTop:3}}>{st.label}</div>
        </div>)}
      </div>
      {chartData.length>=2
        ?<>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart margin={{top:20,right:8,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.blush} vertical={false}/>
              <XAxis dataKey="date" type="category" allowDuplicatedCategory={false} tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false} domain={["auto","auto"]}/>
              <Tooltip contentStyle={{borderRadius:10,fontFamily:"'DM Sans',sans-serif",fontSize:12}} formatter={(v,n)=>[`${v} กก.`,n==="weight"?"น้ำหนัก":"เป้าหมาย"]}/>
              {/* target line */}
              <Line data={targetData} type="monotone" dataKey="target" stroke={C.blush} strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="target"/>
              {/* actual weight */}
              <Line data={chartData} type="monotone" dataKey="weight" stroke={C.rose} strokeWidth={2.5} dot={<ChartDot/>} activeDot={{r:7,fill:C.rose}} name="weight">
                <LabelList dataKey="dose" content={<DoseLabel/>}/>
              </Line>
            </LineChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:14,justifyContent:"center",marginTop:8,flexWrap:"wrap"}}>
            {[{color:C.rose,label:"น้ำหนักจริง",dash:false},{color:C.blush,label:"เป้า −0.5กก./สป.",dash:true},{color:C.sage,label:"ลงดี ✅"},{color:C.alert,label:"ติดตาม 🔴"},{color:C.gold,label:"เริ่มต้น ⭐"}].map(l=>(
              <div key={l.label} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:C.muted}}>
                {l.dash?<div style={{width:14,height:2,borderTop:`2px dashed ${l.color}`}}/>:<div style={{width:8,height:8,borderRadius:"50%",background:l.color}}/>}
                {l.label}
              </div>
            ))}
          </div>
        </>
        :<div style={{textAlign:"center",color:C.muted,fontSize:13,padding:"24px 0"}}>ต้องมีข้อมูลอย่างน้อย 2 ครั้งเพื่อแสดงกราฟ</div>}
    </div>
    {alertRecs.length>0&&<div style={cardSt}>
      <CardTitle color={C.alert}>รายการที่ต้องแจ้งหมอ</CardTitle>
      {alertRecs.map(r=>{
        const idx=records.indexOf(r);
        const diff=records[idx-1].weight-r.weight;
        return <div key={r.date} style={{background:"rgba(201,59,59,0.05)",border:"1.5px solid rgba(201,59,59,0.2)",borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",gap:10}}>
          <span style={{fontSize:18}}>🔴</span>
          <div style={{fontSize:13,color:C.alert,lineHeight:1.5}}>
            <strong>{fmtDateShort(r.date)}</strong> — {diff>=0?`ลดน้อยเพียง −${diff.toFixed(1)}`:`ขึ้น +${Math.abs(diff).toFixed(1)}`} กก.<br/>
            <span style={{fontSize:11,color:C.muted}}>ปรึกษาหมอทิพย์ค่ะ</span>
          </div>
        </div>;
      })}
    </div>}
  </div>;
}

// ── DoctorView ────────────────────────────────────────────
function DoctorView() {
  const [allPatients,setAllPatients]=useState([]);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState(null);
  const [search,setSearch]=useState("");
  const [confirmDelete,setConfirmDelete]=useState(false);

  async function load() {
    setLoading(true);
    const patients=await fbListAll();
    // sort: unread alert first, then alert, then ok
    patients.sort((a,b)=>{
      const aAlert=hasAlert(a.records||[]), bAlert=hasAlert(b.records||[]);
      const aRead=a.doctorRead||false, bRead=b.doctorRead||false;
      if(aAlert&&!aRead&&(!bAlert||bRead)) return -1;
      if(bAlert&&!bRead&&(!aAlert||aRead)) return 1;
      if(aAlert&&!bAlert) return -1;
      if(bAlert&&!aAlert) return 1;
      return 0;
    });
    setAllPatients(patients);
    setLoading(false);
  }
  useEffect(()=>{load();},[]);

  const alertCount=allPatients.filter(p=>hasAlert(p.records||[])&&!p.doctorRead).length;
  const filtered=allPatients.filter(p=>p.name?.toLowerCase().includes(search.toLowerCase()));

  async function markRead(name) {
    await fbMarkRead(name);
    setAllPatients(prev=>prev.map(p=>p.name===name?{...p,doctorRead:true}:p));
  }

  if(selected) {
    const recs=selected.records||[];
    const total=recs.length>=2?recs[0].weight-recs[recs.length-1].weight:null;
    const chartData=recs.map((r,i)=>({date:fmtDateShort(r.date),weight:r.weight,status:getStatus(recs,i),dose:r.dose==="อื่นๆ"?r.doseOther:r.dose}));
    const targetData=recs.length>=2?recs.map(r=>{
      const days=daysBetween(recs[0].date,r.date);
      return {date:fmtDateShort(r.date),target:parseFloat((recs[0].weight-(days/7)*0.5).toFixed(1))};
    }):[];

    return <div style={{padding:"18px 14px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={()=>{setSelected(null);setConfirmDelete(false);}} style={secBtnSt}>← กลับ</button>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:C.deep,flex:1}}>{selected.name}</div>
        {!selected.doctorRead&&hasAlert(recs)&&(
          <button onClick={async()=>{await markRead(selected.name);setSelected(p=>({...p,doctorRead:true}));}} style={{padding:"9px 16px",borderRadius:10,border:"none",background:C.sage,color:"#fff",fontSize:12,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",fontWeight:600}}>✓ รับทราบแล้ว</button>
        )}
        {selected.doctorRead&&<span style={{fontSize:11,color:C.sage,border:`1px solid ${C.sage}`,borderRadius:8,padding:"4px 10px"}}>✓ รับทราบแล้ว</span>}
      </div>
      {/* Delete section */}
      {!confirmDelete
        ?<button onClick={()=>setConfirmDelete(true)} style={{...secBtnSt,width:"100%",marginBottom:14,color:C.alert,borderColor:C.alert,textAlign:"center"}}>🗑️ ลบข้อมูลคนไข้คนนี้</button>
        :<div style={{background:"rgba(201,59,59,0.07)",border:`1.5px solid ${C.alert}`,borderRadius:12,padding:"14px 16px",marginBottom:14}}>
          <div style={{fontSize:13,color:C.alert,fontWeight:600,marginBottom:10}}>⚠️ ยืนยันลบข้อมูลของ "{selected.name}" ?</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>ข้อมูลจะถูกลบถาวร ไม่สามารถกู้คืนได้</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setConfirmDelete(false)} style={{...secBtnSt,flex:1,textAlign:"center"}}>ยกเลิก</button>
            <button onClick={async()=>{
              const ok=await fbDelete(selected.name);
              if(ok){setAllPatients(prev=>prev.filter(p=>p.name!==selected.name));setSelected(null);setConfirmDelete(false);}
            }} style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:C.alert,color:"#fff",fontSize:13,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",fontWeight:600}}>🗑️ ลบถาวร</button>
          </div>
        </div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[
          {val:recs.length,label:"บันทึก"},
          {val:total!==null?`${total>=0?"−":"+"}${Math.abs(total).toFixed(1)} กก.`:"—",label:"ลดรวม"},
          {val:recs.length>=2?daysBetween(recs[0].date,recs[recs.length-1].date)+" วัน":"—",label:"ช่วงเวลา"},
        ].map(st=><div key={st.label} style={{background:C.card,borderRadius:12,padding:"12px 8px",textAlign:"center",boxShadow:"0 1px 8px rgba(0,0,0,.05)"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:C.deep}}>{st.val}</div>
          <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.05em",marginTop:3}}>{st.label}</div>
        </div>)}
      </div>
      {chartData.length>=2&&<div style={{...cardSt,padding:"14px 10px 14px 4px"}}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart margin={{top:20,right:8,left:-20,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.blush} vertical={false}/>
            <XAxis dataKey="date" type="category" allowDuplicatedCategory={false} tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false} domain={["auto","auto"]}/>
            <Tooltip contentStyle={{borderRadius:10,fontFamily:"'DM Sans',sans-serif",fontSize:12}} formatter={(v,n)=>[`${v} กก.`,n==="weight"?"น้ำหนัก":"เป้าหมาย"]}/>
            <Line data={targetData} type="monotone" dataKey="target" stroke={C.blush} strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="target"/>
            <Line data={chartData} type="monotone" dataKey="weight" stroke={C.rose} strokeWidth={2.5} dot={<ChartDot/>} activeDot={{r:7}} name="weight">
              <LabelList dataKey="dose" content={<DoseLabel/>}/>
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>}
      {[...recs].reverse().map(r=>{
        const idx=recs.indexOf(r);
        const status=getStatus(recs,idx);
        const diff=idx>0?recs[idx-1].weight-r.weight:null;
        const statusColor=status==="good"?C.sage:status==="first"?C.gold:C.alert;
        const statusDot=status==="good"?"🟢":status==="first"?"⭐":"🔴";
        const red=hasRedFlag(r),green=hasExercise(r),nex=noExercise(r);
        return <div key={r.date} style={{...cardSt,borderLeft:`4px solid ${statusColor}`,paddingLeft:14,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:11,color:C.muted}}>{fmtDateTH(r.date)}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,color:C.deep}}>
                {r.weight} <span style={{fontSize:13,fontWeight:400,color:C.muted}}>กก.</span>
                {red&&<span style={{marginLeft:6}}>🔴</span>}
                {green&&!nex&&<span style={{marginLeft:4}}>🟢</span>}
                {nex&&<span style={{marginLeft:4}}>🔴</span>}
              </div>
              <div style={{fontSize:12,color:C.muted}}>💉 {r.dose==="อื่นๆ"?r.doseOther:r.dose}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:18}}>{statusDot}</div>
              {diff!==null&&<div style={{fontSize:11,color:statusColor,marginTop:4,fontWeight:600}}>
                {diff>=0?`−${diff.toFixed(1)}`:`+${Math.abs(diff).toFixed(1)}`} กก.
              </div>}
            </div>
          </div>
          <WeightAdvice records={recs} idx={idx}/>
          <RecordDetail r={r}/>
        </div>;
      })}
    </div>;
  }

  return <div style={{padding:"18px 14px"}}>
    <div style={{background:`linear-gradient(135deg, ${C.deep}, #4A2D1C)`,borderRadius:16,padding:"18px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
      <div style={{width:50,height:50,borderRadius:"50%",background:`linear-gradient(135deg, ${C.gold}, ${C.rose})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>👩‍⚕️</div>
      <div style={{flex:1}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:C.cream}}>หมอทิพย์</div>
        <div style={{fontSize:11,color:C.blush,fontWeight:300}}>Astique Clinic — ภาพรวม Mounjaro</div>
      </div>
      <div style={{width:36,height:36,borderRadius:"50%",background:alertCount>0?C.alert:C.sage,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",flexShrink:0}}>{alertCount}</div>
    </div>

    {/* Alert banner */}
    {alertCount>0&&<div style={{background:"rgba(201,59,59,0.08)",border:`1.5px solid ${C.alert}`,borderRadius:14,padding:"14px 16px",marginBottom:14}}>
      <div style={{fontSize:13,color:C.alert,fontWeight:600,marginBottom:6}}>🔔 แจ้งเตือน — {alertCount} คนไข้น้ำหนักไม่ลดตามเป้า</div>
      {allPatients.filter(p=>hasAlert(p.records||[])&&!p.doctorRead).map(p=>{
        const recs=p.records||[]; const last=recs[recs.length-1]; const prev=recs[recs.length-2];
        const diff=prev&&last?prev.weight-last.weight:null;
        return <div key={p.name} onClick={()=>setSelected(p)} style={{cursor:"pointer",padding:"8px 10px",borderRadius:10,background:"rgba(201,59,59,0.07)",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:C.deep}}>{p.name}</div>
            <div style={{fontSize:11,color:C.muted}}>{diff!==null?diff>=0?`น้ำหนักลดเพียง −${diff.toFixed(1)} กก.`:`น้ำหนักขึ้น +${Math.abs(diff).toFixed(1)} กก.`:""} · 💉 {last?.dose==="อื่นๆ"?last?.doseOther:last?.dose}</div>
          </div>
          <span style={{fontSize:12,color:C.alert}}>ดูข้อมูล →</span>
        </div>;
      })}
    </div>}

    {/* Search */}
    <div style={{marginBottom:12,position:"relative"}}>
      <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16,color:C.muted}}>🔍</span>
      <input style={{...inputSt,paddingLeft:38}} placeholder="ค้นหาชื่อคนไข้..." value={search} onChange={e=>setSearch(e.target.value)}/>
    </div>

    <button onClick={load} style={{...btnSt,marginBottom:14}}>{loading?"กำลังโหลด...":"🔄 รีเฟรช"}</button>

    {loading
      ?<div style={{textAlign:"center",padding:40,color:C.muted}}>กำลังโหลดข้อมูล...</div>
      :filtered.length===0
        ?<div style={{textAlign:"center",padding:48,color:"#ccc"}}><div style={{fontSize:40,marginBottom:12}}>👩‍⚕️</div><div>{search?"ไม่พบ "+search:"ยังไม่มีข้อมูลคนไข้"}</div></div>
        :filtered.map(p=>{
            const recs=p.records||[];
            const alert=hasAlert(recs);
            const last=recs[recs.length-1];
            const diff=recs.length>=2?recs[recs.length-2].weight-last.weight:null;
            const isRead=p.doctorRead||false;
            const red=last&&hasRedFlag(last),green=last&&hasExercise(last),nex=last&&noExercise(last);
            const statusDot=recs.length<=1?"⭐":alert?"🔴":"🟢";
            const borderColor=recs.length<=1?C.gold:alert?(isRead?"#e8a0a0":C.alert):C.sage;
            return <div key={p.name} onClick={()=>setSelected(p)} style={{...cardSt,cursor:"pointer",borderLeft:`4px solid ${borderColor}`,paddingLeft:14,marginBottom:10,opacity:isRead&&alert?0.75:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:16}}>{statusDot}</span>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:600,color:C.deep}}>{p.name}</div>
                    {red&&<span>🔴</span>}
                    {green&&!nex&&<span>🟢</span>}
                    {nex&&<span>🔴</span>}
                    {isRead&&<span style={{fontSize:10,color:C.sage,border:`1px solid ${C.sage}`,borderRadius:10,padding:"1px 6px"}}>อ่านแล้ว</span>}
                  </div>
                  <div style={{fontSize:12,color:C.muted,marginTop:3}}>
                    {recs.length} บันทึก{last&&` · ล่าสุด ${fmtDateShort(last.date)}`}{last?.dose&&` · 💉 ${last.dose==="อื่นๆ"?last.doseOther:last.dose}`}
                  </div>
                  {diff!==null&&<div style={{fontSize:12,color:diff>=0.5?C.sage:C.alert,marginTop:2,fontWeight:500}}>
                    {diff>=0.5?`↓ −${diff.toFixed(1)} กก. 🟢`:diff>=0?`↓ −${diff.toFixed(1)} กก. 🔴`:`↑ +${Math.abs(diff).toFixed(1)} กก. 🔴`}
                  </div>}
                </div>
                {recs.length<=1?<Badge color={C.gold}>ใหม่</Badge>:alert?<Badge color={isRead?"#e8a0a0":C.alert}>{isRead?"🔴 อ่านแล้ว":"🔴 ต้องติดตาม"}</Badge>:<Badge color={C.sage}>🟢 ปกติดี</Badge>}
              </div>
            </div>;
          })}
  </div>;
}

// ── StockView ─────────────────────────────────────────────
function StockView({showToast}) {
  const [stock,setStock]=useState({});
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState({});

  async function load(){setLoading(true);const data=await fbGetStock();setStock(data);setLoading(false);}
  useEffect(()=>{load();},[]);

  async function save(){const ok=await fbSetStock(draft);if(!ok)return showToast("บันทึกไม่สำเร็จ");setStock(draft);setEditing(false);showToast("✓ อัพเดท Stock แล้ว");}
  function startEdit(){const d={};STOCK_DOSES.forEach(dose=>{d[dose]=stock[dose]||0;});setDraft(d);setEditing(true);}

  if(loading) return <div style={{textAlign:"center",padding:40,color:C.muted}}>กำลังโหลด...</div>;

  return <div style={{padding:"18px 14px"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:C.deep}}>💊 Stock Mounjaro</div>
      {!editing
        ?<button onClick={startEdit} style={{...secBtnSt,fontSize:12}}>✏️ แก้ไข</button>
        :<div style={{display:"flex",gap:8}}>
          <button onClick={()=>setEditing(false)} style={{...secBtnSt,fontSize:12}}>ยกเลิก</button>
          <button onClick={save} style={{padding:"9px 16px",borderRadius:10,border:"none",background:C.rose,color:"#fff",fontSize:12,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",fontWeight:600}}>บันทึก</button>
        </div>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      {STOCK_DOSES.map(dose=>{
        const qty=editing?draft[dose]||0:stock[dose]||0;
        const low=qty<=2,out=qty===0;
        return <div key={dose} style={{...cardSt,marginBottom:0,border:`1.5px solid ${out?C.alert:low?C.gold:C.blush}`,background:out?"rgba(201,59,59,0.04)":low?"rgba(196,153,62,0.04)":C.card}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:2}}>Mounjaro</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:C.deep,marginBottom:8}}>{dose}</div>
          {editing
            ?<div style={{display:"flex",alignItems:"center",gap:6}}>
              <button onClick={()=>setDraft(d=>({...d,[dose]:Math.max(0,(d[dose]||0)-1)}))} style={{width:30,height:30,borderRadius:8,border:`1px solid ${C.blush}`,background:"transparent",fontSize:16,cursor:"pointer"}}>−</button>
              <input type="number" inputMode="numeric" style={{...inputSt,textAlign:"center",padding:"4px",width:50,fontSize:16,fontWeight:600}} value={draft[dose]||0} onChange={e=>setDraft(d=>({...d,[dose]:Math.max(0,parseInt(e.target.value)||0)}))}/>
              <button onClick={()=>setDraft(d=>({...d,[dose]:(d[dose]||0)+1}))} style={{width:30,height:30,borderRadius:8,border:`1px solid ${C.blush}`,background:"transparent",fontSize:16,cursor:"pointer"}}>+</button>
            </div>
            :<div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:600,color:out?C.alert:low?C.gold:C.deep}}>{qty}</span>
              <span style={{fontSize:12,color:C.muted}}>หลอด</span>
              {out&&<span style={{fontSize:11,color:C.alert,fontWeight:600}}>หมด!</span>}
              {low&&!out&&<span style={{fontSize:11,color:C.gold,fontWeight:600}}>เหลือน้อย</span>}
            </div>}
        </div>;
      })}
    </div>
  </div>;
}

// ── OrderView ─────────────────────────────────────────────
const ORDER_STATUS = {
  pending:  {label:"รอยืนยันยอด",  color:"#C4993E", bg:"rgba(196,153,62,0.1)",  emoji:"🟡"},
  confirmed:{label:"ยืนยันแล้ว/รอโอน", color:"#C07A58", bg:"rgba(192,122,88,0.1)", emoji:"🟠"},
  paid:     {label:"โอนแล้ว/รอดำเนินการ", color:"#6B6B9B", bg:"rgba(107,107,155,0.1)", emoji:"💜"},
  clinic:   {label:"นัดมาคลินิก",  color:"#6B9B82", bg:"rgba(107,155,130,0.1)", emoji:"🏥"},
  shipping: {label:"รอจัดส่ง",     color:"#C07A58", bg:"rgba(192,122,88,0.1)",  emoji:"📦"},
  done:     {label:"เสร็จสิ้น",    color:"#9A8478", bg:"rgba(154,132,120,0.1)", emoji:"✅"},
};

function OrderView({showToast}) {
  const [orders,setOrders]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("active");
  const [expandId,setExpandId]=useState(null);
  const [orderTab,setOrderTab]=useState("orders");

  async function load(){
    setLoading(true);
    const data=await fbGetOrders();
    data.sort((a,b)=>{
      const priority={pending:0,paid:1,confirmed:2,clinic:3,shipping:4,done:5};
      return (priority[a.status]||0)-(priority[b.status]||0)||(new Date(b.createdAt)-new Date(a.createdAt));
    });
    setOrders(data);
    setLoading(false);
  }
  useEffect(()=>{load();},[]);

  async function updateStatus(id,status,dose){
    await fbUpdateOrder(id,{status,updatedAt:new Date().toISOString()});
    if(status==="done"&&dose){
      const matchDose=STOCK_DOSES.find(d=>dose.includes(d));
      if(matchDose){
        const stock=await fbGetStock();
        const cur=stock[matchDose]||0;
        if(cur>0){await fbSetStock({...stock,[matchDose]:cur-1});showToast(`✓ เสร็จสิ้น — ตัด ${matchDose} 1 หลอด`);}
        else showToast("⚠️ Stock หมด! กรุณาเติม Stock");
        setOrders(prev=>prev.map(o=>o.id===id?{...o,status}:o));
        return;
      }
    }
    setOrders(prev=>prev.map(o=>o.id===id?{...o,status}:o));
    showToast("✓ อัพเดทสถานะแล้ว");
  }

  async function deleteOrder(id){await fbDeleteOrder(id);setOrders(prev=>prev.filter(o=>o.id!==id));showToast("ลบ Order แล้ว");}

  const pending=orders.filter(o=>o.status==="pending").length;
  const paid=orders.filter(o=>o.status==="paid").length;
  const activeCount=orders.filter(o=>!["done"].includes(o.status)).length;
  const urgent=pending+paid;

  const filtered=filter==="active"
    ?orders.filter(o=>o.status!=="done")
    :filter==="done"?orders.filter(o=>o.status==="done")
    :orders.filter(o=>o.status===filter);

  const fmtDate=d=>new Date(d).toLocaleDateString("th-TH",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

  return <div style={{padding:"18px 14px"}}>
    {/* Sub tabs */}
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      {[{id:"orders",label:"📦 Order"},{id:"stock",label:"💊 Stock"}].map(t=>{
        const on=orderTab===t.id;
        return <button key={t.id} onClick={()=>setOrderTab(t.id)} style={{flex:1,padding:"9px",borderRadius:10,fontSize:13,border:`1.5px solid ${on?C.rose:C.blush}`,background:on?C.rose:"transparent",color:on?"#fff":C.muted,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",fontWeight:on?600:400}}>{t.label}</button>;
      })}
    </div>

    {orderTab==="stock"&&<StockView showToast={showToast}/>}

    {orderTab==="orders"&&<>
      {/* Alert banner */}
      {urgent>0&&<div style={{background:"rgba(201,59,59,0.07)",border:`1.5px solid ${C.alert}`,borderRadius:12,padding:"12px 14px",marginBottom:14}}>
        <div style={{fontSize:13,color:C.alert,fontWeight:600}}>
          🔔 มี {urgent} order รอดำเนินการ
          {pending>0&&<span> · 🟡 รอยืนยัน {pending}</span>}
          {paid>0&&<span> · 💜 โอนแล้ว {paid}</span>}
        </div>
      </div>}

      {/* Filter */}
      <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:2}}>
        {[
          {id:"active",label:`ทั้งหมด (${activeCount})`},
          {id:"pending",label:`🟡 รอยืนยัน (${pending})`},
          {id:"paid",label:`💜 โอนแล้ว (${paid})`},
          {id:"shipping",label:"📦 รอส่ง"},
          {id:"done",label:"✅ เสร็จ"},
        ].map(f=>{
          const on=filter===f.id;
          return <button key={f.id} onClick={()=>setFilter(f.id)} style={{padding:"7px 12px",borderRadius:20,fontSize:11,border:`1.5px solid ${on?C.rose:C.blush}`,background:on?C.rose:"transparent",color:on?"#fff":C.muted,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",whiteSpace:"nowrap",fontWeight:on?600:400}}>{f.label}</button>;
        })}
      </div>

      <button onClick={load} style={{...secBtnSt,width:"100%",textAlign:"center",fontSize:12,marginBottom:12}}>{loading?"กำลังโหลด...":"🔄 รีเฟรช"}</button>

      {loading
        ?<div style={{textAlign:"center",padding:40,color:C.muted}}>กำลังโหลด...</div>
        :filtered.length===0
          ?<div style={{textAlign:"center",padding:40,color:"#ccc"}}><div style={{fontSize:36,marginBottom:8}}>📭</div><div style={{fontSize:13}}>ไม่มี order</div></div>
          :filtered.map(o=>{
            const st=ORDER_STATUS[o.status]||ORDER_STATUS.pending;
            const isExp=expandId===o.id;
            return <div key={o.id} style={{...cardSt,borderLeft:`4px solid ${st.color}`,paddingLeft:14,marginBottom:10}}>
              <div onClick={()=>setExpandId(isExp?null:o.id)} style={{cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:600,color:C.deep}}>{o.name}</div>
                    <div style={{fontSize:12,color:C.muted,marginTop:2}}>
                      💉 {o.dose} × {o.qty||1} หลอด
                      {o.total?` · ฿${parseInt(o.total).toLocaleString()}`:""}
                      {" · "}{o.type==="มาฉีดที่คลินิก"?"🏥":"📦"} {o.type}
                    </div>
                    <div style={{fontSize:11,color:"#bbb",marginTop:2}}>📅 {fmtDate(o.createdAt)}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                    <span style={{fontSize:11,fontWeight:600,padding:"4px 8px",borderRadius:20,background:st.bg,color:st.color,display:"block"}}>{st.emoji} {st.label}</span>
                    <div style={{fontSize:10,color:C.muted,marginTop:4}}>{isExp?"▲ ซ่อน":"▼ ดูเพิ่ม"}</div>
                  </div>
                </div>
              </div>

              {isExp&&<div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.blush}`}}>
                {o.phone&&<div style={{fontSize:12,color:C.muted,marginBottom:6}}>📱 {o.phone}</div>}
                {o.address&&o.address!=="มาฉีดที่คลินิก"&&<div style={{fontSize:12,color:C.muted,marginBottom:6}}>📍 {o.address}</div>}
                {o.note&&<div style={{fontSize:12,color:"#bbb",marginBottom:10}}>📝 {o.note}</div>}

                <div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:8}}>เปลี่ยนสถานะ:</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                  {o.status!=="confirmed"&&o.status!=="done"&&<button onClick={()=>updateStatus(o.id,"confirmed",o.dose)} style={{padding:"9px",borderRadius:8,border:`1px solid ${C.gold}`,background:"transparent",color:C.gold,fontSize:11,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",fontWeight:600}}>🟠 ยืนยันยอดแล้ว</button>}
                  {o.status!=="paid"&&o.status!=="done"&&<button onClick={()=>updateStatus(o.id,"paid",o.dose)} style={{padding:"9px",borderRadius:8,border:"1px solid #6B6B9B",background:"transparent",color:"#6B6B9B",fontSize:11,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",fontWeight:600}}>💜 รับสลิปแล้ว</button>}
                  {o.status!=="clinic"&&o.status!=="done"&&o.type==="มาฉีดที่คลินิก"&&<button onClick={()=>updateStatus(o.id,"clinic",o.dose)} style={{padding:"9px",borderRadius:8,border:`1px solid ${C.sage}`,background:"transparent",color:C.sage,fontSize:11,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",fontWeight:600}}>🏥 นัดมาคลินิก</button>}
                  {o.status!=="shipping"&&o.status!=="done"&&o.type==="จัดส่งทางไปรษณีย์"&&<button onClick={()=>updateStatus(o.id,"shipping",o.dose)} style={{padding:"9px",borderRadius:8,border:`1px solid ${C.rose}`,background:"transparent",color:C.rose,fontSize:11,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",fontWeight:600}}>📦 กำลังจัดส่ง</button>}
                  {o.status!=="done"&&<button onClick={()=>updateStatus(o.id,"done",o.dose)} style={{padding:"9px",borderRadius:8,border:"none",background:C.sage,color:"#fff",fontSize:11,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",fontWeight:600}}>✅ เสร็จสิ้น</button>}
                </div>
                <button onClick={()=>{if(window.confirm(`ลบ order ของ ${o.name}?`))deleteOrder(o.id);}} style={{width:"100%",padding:"8px",borderRadius:8,border:`1px solid ${C.alert}`,background:"transparent",color:C.alert,fontSize:11,fontFamily:"'DM Sans',sans-serif",cursor:"pointer"}}>🗑️ ลบ Order นี้</button>
              </div>}
            </div>;
          })}
    </>}
  </div>;
}

// ── DoctorPinScreen ───────────────────────────────────────
function DoctorPinScreen({onUnlock}) {
  const [pin,setPin]=useState(""); const [shake,setShake]=useState(false);
  function tryPin(p){if(p===DOCTOR_PIN){onUnlock();}else{setShake(true);setTimeout(()=>{setShake(false);setPin("");},600);}}
  function press(v){if(pin.length>=5)return;const next=pin+v;setPin(next);if(next.length===5)tryPin(next);}
  return <div style={{padding:"40px 32px",display:"flex",flexDirection:"column",alignItems:"center"}}>
    <div style={{fontSize:40,marginBottom:16}}>👩‍⚕️</div>
    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:C.deep,marginBottom:6}}>หมอทิพย์</div>
    <div style={{fontSize:13,color:C.muted,marginBottom:32}}>ใส่ PIN เพื่อเข้าโหมดหมอ</div>
    <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-8px)}80%{transform:translateX(4px)}}`}</style>
    <div style={{display:"flex",gap:16,marginBottom:36,animation:shake?"shake .4s":"none"}}>
      {[0,1,2,3,4].map(i=><div key={i} style={{width:14,height:14,borderRadius:"50%",background:i<pin.length?C.rose:"transparent",border:`2px solid ${i<pin.length?C.rose:C.blush}`,transition:"all .15s"}}/>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,width:"100%",maxWidth:260}}>
      {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k,i)=>(
        k===""?<div key={i}/>:
        <button key={i} onClick={()=>k==="⌫"?setPin(p=>p.slice(0,-1)):press(k)}
          style={{height:64,borderRadius:16,border:"none",background:k==="⌫"?"transparent":C.card,boxShadow:k==="⌫"?"none":"0 2px 8px rgba(46,31,20,.08)",fontSize:k==="⌫"?22:24,fontFamily:"'DM Sans',sans-serif",color:C.deep,cursor:"pointer"}}>{k}</button>
      ))}
    </div>
  </div>;
}

// ── APP ───────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]=useState("patient");
  const [patientName,setPatientName]=useState("");
  const [phase,setPhase]=useState("name");
  const [records,setRecords]=useState([]);
  const [saving,setSaving]=useState(false);
  const [mode,setMode]=useState("patient");
  const [doctorUnlocked,setDoctorUnlocked]=useState(false);
  const [editRecord,setEditRecord]=useState(null);
  const [toast,setToast]=useState({show:false,msg:""});
  const toastTimer=useRef(null);

  function showToast(msg){clearTimeout(toastTimer.current);setToast({show:true,msg});toastTimer.current=setTimeout(()=>setToast(t=>({...t,show:false})),2500);}

  async function handleNameSubmit(name){
    const data=await fbGet(name);
    setRecords(data?.records||[]);
    setPatientName(name);
    setPhase("form");
  }

  async function handleSave(record){
    if(phase!=="edit"&&records.find(r=>r.date===record.date)) return showToast("มีข้อมูลวันนี้แล้ว");
    const newRecords=phase==="edit"
      ?records.map(r=>r.date===editRecord.date?record:r).sort((a,b)=>a.date.localeCompare(b.date))
      :[...records,record].sort((a,b)=>a.date.localeCompare(b.date));
    setSaving(true);
    const ok=await fbSet(patientName,{name:patientName,records:newRecords,doctorRead:false});
    setSaving(false);
    if(!ok) return showToast("บันทึกไม่สำเร็จ ลองใหม่นะคะ");
    setRecords(newRecords);
    showToast(phase==="edit"?"✓ แก้ไขสำเร็จ":"✓ บันทึกสำเร็จ");
    setPhase("history");
  }

  const tabBtnSt=(active)=>({flex:1,padding:"9px 6px",borderRadius:8,fontSize:12,fontWeight:500,border:`1.5px solid ${active?C.rose:"rgba(255,255,255,0.15)"}`,background:active?C.rose:"transparent",color:active?"#fff":"#EDD9C8",fontFamily:"'DM Sans',sans-serif",cursor:"pointer",transition:"all .2s"});

  return <>
    <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#FAF7F2}input:focus,select:focus{border-color:#C07A58!important;outline:none}input[type=date]::-webkit-calendar-picker-indicator{opacity:0.4}::-webkit-scrollbar{width:0}`}</style>
    <div style={{fontFamily:"'DM Sans',sans-serif",background:C.cream,minHeight:"100vh",maxWidth:480,margin:"0 auto"}}>
      <div style={{background:C.deep,padding:"18px 20px 14px",display:"flex",alignItems:"center",gap:13,position:"sticky",top:0,zIndex:100}}>
        <div style={{width:42,height:42,borderRadius:"50%",background:`linear-gradient(135deg, ${C.gold}, ${C.rose})`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:"#fff",fontWeight:600}}>A</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,color:C.cream,fontWeight:400}}>Astique Clinic</div>
          <div style={{fontSize:10,color:"#EDD9C8",letterSpacing:"0.07em",textTransform:"uppercase",marginTop:1}}>Mounjaro Weight Tracker</div>
        </div>
        <button onClick={()=>{if(mode==="doctor"){setMode("patient");setDoctorUnlocked(false);setTab("patient");}else setMode("doctor");}}
          style={{background:mode==="doctor"?C.rose:"rgba(255,255,255,0.1)",border:"none",borderRadius:8,padding:"7px 10px",cursor:"pointer",fontSize:16}}>
          {mode==="doctor"?"👩‍⚕️":"🔒"}
        </button>
      </div>

      {mode==="patient"&&<>
        <div style={{background:C.deep,padding:"0 16px 14px",display:"flex",gap:8}}>
          {[{id:"patient",label:"📋 บันทึก"},{id:"chart",label:"📈 กราฟ"}].map(t=>(
            <button key={t.id} style={tabBtnSt(tab===t.id)} onClick={()=>setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        {tab==="patient"&&phase==="name"&&<NameScreen onSubmit={handleNameSubmit}/>}
        {tab==="patient"&&phase==="form"&&<RecordForm patientName={patientName} hasHistory={records.length>0} onSave={handleSave} onViewHistory={()=>setPhase("history")} saving={saving} showToast={showToast}/>}
        {tab==="patient"&&phase==="history"&&<HistoryView patientName={patientName} records={records} onAddNew={()=>setPhase("form")} onEdit={r=>{setEditRecord(r);setPhase("edit");}}/>}
        {tab==="patient"&&phase==="edit"&&<RecordForm patientName={patientName} hasHistory={true} onSave={handleSave} onViewHistory={()=>setPhase("history")} saving={saving} showToast={showToast} initialData={editRecord} isEdit={true}/>}
        {tab==="chart"&&<ChartView patientName={patientName} records={records}/>}
      </>}

      {mode==="doctor"&&(doctorUnlocked
        ?<>
          <div style={{background:C.deep,padding:"0 16px 14px",display:"flex",gap:8}}>
            {[{id:"patients",label:"👩‍⚕️ คนไข้"},{id:"orders",label:"📦 Order"}].map(t=>(
              <button key={t.id} style={tabBtnSt(tab===t.id)} onClick={()=>setTab(t.id)}>{t.label}</button>
            ))}
          </div>
          {tab==="patients"&&<DoctorView/>}
          {tab==="orders"&&<OrderView showToast={showToast}/>}
        </>
        :<DoctorPinScreen onUnlock={()=>{setDoctorUnlocked(true);setTab("patients");}}/>
      )}

      <Toast msg={toast.msg} show={toast.show}/>
    </div>
  </>;
}
