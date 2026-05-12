import { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { db } from "./firebase";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";

const C = {
  cream: "#FAF7F2", blush: "#EDD9C8", rose: "#C07A58",
  deep: "#2E1F14", sage: "#6B9B82", alert: "#C93B3B",
  gold: "#C4993E", card: "#FFFFFF", muted: "#9A8478", roseDark: "#9A5C3E",
};

const SIDE_EFFECTS_OPTIONS = [
  "คลื่นไส้","อาเจียน","ท้องผูก","ท้องเสีย","ปวดหัว","เวียนหัว",
  "เบื่ออาหาร","เมื่อยล้า","ปวดท้อง","ปวดเมื่อยตามตัว",
  "ประจำเดือนผิดปกติ","นอนหลับผิดปกติ","ไม่มีผลข้างเคียง","อื่นๆ",
];
const EXERCISE_OPTIONS = [
  "เดิน 30+ นาที","วิ่ง","ว่ายน้ำ","ขี่จักรยาน",
  "โยคะ/พิลาทิส","เวทเทรนนิ่ง","คาร์ดิโอ","ยกน้ำหนัก","ไม่ได้ออกกำลังกาย",
];
const FOOD_OPTIONS = [
  "ผลไม้","เครื่องดื่มรสหวาน","โปรตีนชง","ของทอด","วิตามินบี","สเตียรอยด์","อื่นๆ",
];
const DOSE_OPTIONS = ["2.5 mg","5 mg","7.5 mg","10 mg","12.5 mg","15 mg","อื่นๆ"];
const DOCTOR_PIN = "1234";

const RED_TRIGGERS = ["ผลไม้","เครื่องดื่มรสหวาน","ของทอด","วิตามินบี","สเตียรอยด์"];

async function fbGet(name) {
  try { const s = await getDoc(doc(db,"patients",name)); return s.exists()?s.data():null; } catch { return null; }
}
async function fbSet(name, data) {
  try { await setDoc(doc(db,"patients",name),data); return true; } catch(e) { console.error(e); return false; }
}
async function fbListAll() {
  try { const s = await getDocs(collection(db,"patients")); return s.docs.map(d=>d.data()); } catch { return []; }
}

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
  const days = daysBetween(records[idx-1].date,records[idx].date);
  const diff = records[idx-1].weight - records[idx].weight;
  const perWeek = days>0?(diff/days)*7:diff;
  if(diff>=0 && perWeek>=0.5) return "good";
  if(diff>0) return "low";
  return "gain";
}
function hasAlert(recs) {
  if(recs.length<2) return false;
  return recs[recs.length-2].weight - recs[recs.length-1].weight < 0.5;
}
function hasRedFlag(r) {
  return RED_TRIGGERS.some(t=>(r.foodTags||[]).includes(t)) ||
         (r.sideEffects||[]).filter(s=>s!=="ไม่มีผลข้างเคียง"&&s!=="อื่นๆ").length>0 ||
         !!(r.sideEffectOther);
}
function hasExercise(r) {
  const ex = r.exercise||[];
  return ex.length>0 && !ex.every(e=>e==="ไม่ได้ออกกำลังกาย");
}

const inputSt = {
  width:"100%",padding:"11px 13px",border:`1.5px solid ${C.blush}`,borderRadius:10,
  background:C.cream,color:C.deep,fontFamily:"'DM Sans',sans-serif",fontSize:15,outline:"none",boxSizing:"border-box",
};
const labelSt = {
  display:"block",fontSize:11,fontWeight:500,color:C.rose,
  textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6,
};
const cardSt = {
  background:C.card,borderRadius:16,padding:"18px 16px",
  marginBottom:14,boxShadow:"0 2px 16px rgba(46,31,20,.07)",
};
const btnSt = {
  width:"100%",padding:13,borderRadius:12,border:"none",
  background:`linear-gradient(135deg, ${C.rose}, ${C.roseDark})`,
  color:"#fff",fontSize:15,fontWeight:500,cursor:"pointer",
  fontFamily:"'DM Sans',sans-serif",marginTop:8,
};
const secBtnSt = {
  padding:"9px 18px",borderRadius:10,border:`1.5px solid ${C.blush}`,
  background:"transparent",color:C.muted,fontSize:13,
  fontFamily:"'DM Sans',sans-serif",cursor:"pointer",
};

function Toast({msg,show}) {
  return <div style={{position:"fixed",bottom:28,left:"50%",transform:`translateX(-50%) translateY(${show?0:16}px)`,opacity:show?1:0,transition:"all .3s",background:C.deep,color:"#fff",padding:"11px 22px",borderRadius:30,fontSize:13,pointerEvents:"none",zIndex:999,whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif"}}>{msg}</div>;
}
function Badge({color,children}) {
  return <span style={{fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:20,background:color+"22",color,display:"inline-block",fontFamily:"'DM Sans',sans-serif"}}>{children}</span>;
}
function CardTitle({children,color}) {
  return <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:600,color:C.deep,marginBottom:14,paddingBottom:10,borderBottom:`1px solid ${C.blush}`}}><span style={{display:"inline-block",width:6,height:6,background:color||C.rose,borderRadius:"50%",marginRight:8,verticalAlign:"middle"}}/>{children}</div>;
}
function TagSelector({options,selected,onChange,color}) {
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
      {options.map(o=>{
        const on=selected.includes(o);
        return <button key={o} onClick={()=>onChange(on?selected.filter(x=>x!==o):[...selected,o])}
          style={{padding:"7px 13px",borderRadius:20,fontSize:12,border:`1.5px solid ${on?color:C.blush}`,background:on?color:"transparent",color:on?"#fff":C.muted,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",fontWeight:on?500:400}}>{o}</button>;
      })}
    </div>
  );
}
function ColorDot({cx,cy,payload}) {
  const color=payload.status==="good"?C.sage:payload.status==="first"?C.gold:C.alert;
  return <circle cx={cx} cy={cy} r={6} fill={color} stroke="#fff" strokeWidth={2}/>;
}

function WeightAdvice({records,idx}) {
  if(idx===0) return null;
  const days=daysBetween(records[idx-1].date,records[idx].date);
  const diff=records[idx-1].weight-records[idx].weight;
  const perWeek=days>0?(diff/days)*7:diff;
  if(diff<0) return (
    <div style={{marginTop:8,padding:"10px 12px",background:"rgba(201,59,59,0.07)",borderRadius:10,fontSize:12,color:C.alert,lineHeight:1.6}}>
      ⚠️ <strong>น้ำหนักขึ้น {Math.abs(diff).toFixed(1)} กก.</strong><br/>พิจารณาปรับพฤติกรรม หรือปรึกษาคุณหมอก่อนปรับยาค่ะ
    </div>
  );
  if(perWeek>=0.5) return (
    <div style={{marginTop:8,padding:"10px 12px",background:"rgba(107,155,130,0.1)",borderRadius:10,fontSize:12,color:C.sage,lineHeight:1.6}}>
      ✅ <strong>น้ำหนักลงดี ({diff.toFixed(1)} กก. ใน {days} วัน)</strong><br/>แนะนำใช้โดสเท่าเดิมต่อไปค่ะ
    </div>
  );
  return (
    <div style={{marginTop:8,padding:"10px 12px",background:"rgba(201,59,59,0.07)",borderRadius:10,fontSize:12,color:C.alert,lineHeight:1.6}}>
      🔴 <strong>น้ำหนักลงช้า ({diff.toFixed(1)} กก. ใน {days} วัน)</strong><br/>พิจารณาปรับพฤติกรรมหรือปรับโดสยาขึ้น <em>ปรึกษาคุณหมอก่อนเพิ่มยาค่ะ</em>
    </div>
  );
}

function RecordDetail({r}) {
  const red=hasRedFlag(r), green=hasExercise(r);
  const has=r.sideEffects?.length>0||r.exercise?.length>0||r.foodTags?.length>0||r.food||r.note||r.sideEffectOther||r.foodOther||r.doseOther;
  if(!has) return null;
  return (
    <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.blush}`,display:"flex",flexDirection:"column",gap:4}}>
      {r.sideEffects?.filter(s=>s!=="อื่นๆ").length>0&&<div style={{fontSize:12,color:C.alert}}>{red?"🔴 ":""} ⚡ {r.sideEffects.filter(s=>s!=="อื่นๆ").join(", ")}</div>}
      {r.sideEffectOther&&<div style={{fontSize:12,color:C.alert}}>🔴 ⚡ อื่นๆ: {r.sideEffectOther}</div>}
      {r.exercise?.length>0&&<div style={{fontSize:12,color:C.sage}}>{green?"🟢 ":""} 🏃 {r.exercise.join(", ")}</div>}
      {r.foodTags?.filter(f=>f!=="อื่นๆ").length>0&&<div style={{fontSize:12,color:C.gold}}>{red?"🔴 ":""} 🏷 {r.foodTags.filter(f=>f!=="อื่นๆ").join(", ")}</div>}
      {r.foodOther&&<div style={{fontSize:12,color:C.gold}}>🏷 อื่นๆ: {r.foodOther}</div>}
      {r.food&&<div style={{fontSize:12,color:C.muted}}>🥗 {r.food}</div>}
      {r.doseOther&&<div style={{fontSize:12,color:C.muted}}>💉 โดส: {r.doseOther}</div>}
      {r.note&&<div style={{fontSize:12,color:"#bbb"}}>📝 {r.note}</div>}
    </div>
  );
}

function RecordForm({patientName,hasHistory,onSave,onViewHistory,saving,showToast,initialData,isEdit}) {
  const [date,setDate] = useState(initialData?.date||todayStr());
  const [weight,setWeight] = useState(initialData?.weight?.toString()||"");
  const [dose,setDose] = useState(initialData?.dose||"");
  const [doseOther,setDoseOther] = useState(initialData?.doseOther||"");
  const [sideEffects,setSideEffects] = useState(initialData?.sideEffects||[]);
  const [sideEffectOther,setSideEffectOther] = useState(initialData?.sideEffectOther||"");
  const [exercise,setExercise] = useState(initialData?.exercise||[]);
  const [foodTags,setFoodTags] = useState(initialData?.foodTags||[]);
  const [foodOther,setFoodOther] = useState(initialData?.foodOther||"");
  const [food,setFood] = useState(initialData?.food||"");
  const [note,setNote] = useState(initialData?.note||"");

  function submit() {
    if(!date) return showToast("กรุณาเลือกวันที่");
    const w=parseFloat(weight);
    if(isNaN(w)||w<20||w>250) return showToast("กรุณากรอกน้ำหนักให้ถูกต้อง");
    if(!dose) return showToast("กรุณาเลือกขนาดยา");
    if(dose==="อื่นๆ"&&!doseOther.trim()) return showToast("กรุณากรอกขนาดยา");
    onSave({date,weight:w,dose,doseOther,sideEffects,sideEffectOther,exercise,foodTags,foodOther,food,note});
  }

  return (
    <div style={{padding:"18px 14px"}}>
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
        {dose==="อื่นๆ"&&(
          <div style={{marginBottom:14}}>
            <label style={labelSt}>ระบุขนาดยา</label>
            <input style={inputSt} placeholder="เช่น 20 mg" value={doseOther} onChange={e=>setDoseOther(e.target.value)}/>
          </div>
        )}
        <div style={{marginBottom:14}}>
          <label style={labelSt}>ผลข้างเคียงที่พบ</label>
          <TagSelector options={SIDE_EFFECTS_OPTIONS} selected={sideEffects} onChange={setSideEffects} color={C.alert}/>
          {sideEffects.includes("อื่นๆ")&&(
            <input style={{...inputSt,marginTop:8}} placeholder="ระบุผลข้างเคียงอื่นๆ..." value={sideEffectOther} onChange={e=>setSideEffectOther(e.target.value)}/>
          )}
        </div>
        <div style={{marginBottom:14}}>
          <label style={labelSt}>การออกกำลังกายใน 1 สัปดาห์ที่ผ่านมา</label>
          <TagSelector options={EXERCISE_OPTIONS} selected={exercise} onChange={setExercise} color={C.sage}/>
        </div>
        <div style={{marginBottom:14}}>
          <label style={labelSt}>อาหาร / เครื่องดื่ม / ยาอื่น</label>
          <TagSelector options={FOOD_OPTIONS} selected={foodTags} onChange={setFoodTags} color={C.gold}/>
          {foodTags.includes("อื่นๆ")&&(
            <input style={{...inputSt,marginTop:8}} placeholder="ระบุอาหาร/ยาอื่นๆ..." value={foodOther} onChange={e=>setFoodOther(e.target.value)}/>
          )}
        </div>
        <div style={{marginBottom:12}}>
          <label style={labelSt}>บันทึกอาหารเพิ่มเติม</label>
          <input style={inputSt} placeholder="เช่น ข้าวต้มไก่เช้า สลัดกลางวัน..." value={food} onChange={e=>setFood(e.target.value)}/>
        </div>
        <div style={{marginBottom:4}}>
          <label style={labelSt}>หมายเหตุ</label>
          <input style={inputSt} placeholder="เช่น รู้สึกดี หิวน้อยลงมาก..." value={note} onChange={e=>setNote(e.target.value)}/>
        </div>
        <button style={{...btnSt,opacity:saving?0.7:1}} onClick={submit} disabled={saving}>
          {saving?"กำลังบันทึก...":"✦ บันทึก"}
        </button>
        {isEdit&&<button style={{...secBtnSt,width:"100%",marginTop:8,textAlign:"center"}} onClick={onViewHistory}>ยกเลิก</button>}
      </div>
    </div>
  );
}

function NameScreen({onSubmit}) {
  const [val,setVal] = useState("");
  return (
    <div style={{padding:"18px 14px"}}>
      <div style={{textAlign:"center",padding:"32px 0 24px"}}>
        <div style={{fontSize:48,marginBottom:12}}>🌿</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,color:C.deep,marginBottom:6}}>ยินดีต้อนรับ</div>
        <div style={{fontSize:14,color:C.muted,lineHeight:1.6}}>Astique Clinic — ติดตามผล Mounjaro<br/>กรุณากรอกชื่อของคุณเพื่อเริ่มต้น</div>
      </div>
      <div style={cardSt}>
        <div style={{marginBottom:12}}>
          <label style={labelSt}>ชื่อของคุณ</label>
          <input style={inputSt} placeholder="เช่น สมหญิง รักสุขภาพ" value={val} autoFocus onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&val.trim()&&onSubmit(val.trim())}/>
        </div>
        <button style={btnSt} onClick={()=>val.trim()&&onSubmit(val.trim())}>เริ่มต้นบันทึก →</button>
      </div>
    </div>
  );
}

function HistoryView({patientName,records,onAddNew,onEdit}) {
  return (
    <div style={{padding:"18px 14px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div>
          <div style={{fontSize:12,color:C.muted}}>ประวัติของ</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:C.deep,fontWeight:600}}>{patientName}</div>
        </div>
        <button style={secBtnSt} onClick={onAddNew}>+ บันทึกใหม่</button>
      </div>
      {records.length===0
        ?<div style={{textAlign:"center",padding:48,color:"#ccc"}}><div style={{fontSize:40,marginBottom:12}}>📋</div><div style={{fontSize:14}}>ยังไม่มีข้อมูล</div></div>
        :[...records].reverse().map(r=>{
            const idx=records.indexOf(r);
            const status=getStatus(records,idx);
            const diff=idx>0?records[idx-1].weight-r.weight:null;
            const borderColor=status==="good"?C.sage:status==="first"?C.gold:C.alert;
            const red=hasRedFlag(r),green=hasExercise(r);
            return (
              <div key={r.date} style={{...cardSt,borderLeft:`4px solid ${borderColor}`,paddingLeft:14,marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:11,color:C.muted,marginBottom:1}}>{fmtDateTH(r.date)}</div>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:600,color:C.deep}}>
                      {r.weight} <span style={{fontSize:14,fontWeight:400,color:C.muted}}>กก.</span>
                      {red&&<span style={{marginLeft:6}}>🔴</span>}
                      {green&&<span style={{marginLeft:4}}>🟢</span>}
                    </div>
                    <div style={{fontSize:12,color:C.muted,marginTop:2}}>💉 {r.dose==="อื่นๆ"?r.doseOther:r.dose}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                    {status==="first"&&<Badge color={C.gold}>⭐ เริ่มต้น</Badge>}
                    {status==="good"&&<Badge color={C.sage}>✅ น้ำหนักลงดี</Badge>}
                    {status==="low"&&<Badge color={C.alert}>🔴 น้ำหนักลงช้า</Badge>}
                    {status==="gain"&&<Badge color={C.alert}>🔴 น้ำหนักขึ้น</Badge>}
                    <button onClick={()=>onEdit(r)} style={{...secBtnSt,fontSize:11,padding:"5px 10px"}}>✏️ แก้ไข</button>
                  </div>
                </div>
                <WeightAdvice records={records} idx={idx}/>
                <RecordDetail r={r}/>
              </div>
            );
          })}
    </div>
  );
}

function ChartView({patientName,records}) {
  const chartData=records.map((r,i)=>({date:fmtDateShort(r.date),weight:r.weight,status:getStatus(records,i)}));
  const totalLoss=records.length>=2?records[0].weight-records[records.length-1].weight:null;
  const alertRecs=records.filter((r,i)=>i>0&&records[i-1].weight-r.weight<0.5);
  return (
    <div style={{padding:"18px 14px"}}>
      <div style={cardSt}>
        <CardTitle>สรุปผลของ {patientName||"—"}</CardTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
          {[
            {val:records.length,label:"บันทึก"},
            {val:totalLoss!==null?`${totalLoss>=0?"−":"+"}${Math.abs(totalLoss).toFixed(1)} กก.`:"—",label:"ลดรวม"},
            {val:records.length>=2?daysBetween(records[0].date,records[records.length-1].date)+" วัน":"—",label:"ช่วงเวลา"},
          ].map(st=>(
            <div key={st.label} style={{background:C.cream,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:C.deep}}>{st.val}</div>
              <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.05em",marginTop:3}}>{st.label}</div>
            </div>
          ))}
        </div>
        {chartData.length>=2
          ?<ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{top:8,right:8,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.blush} vertical={false}/>
              <XAxis dataKey="date" tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false} domain={["auto","auto"]}/>
              <Tooltip contentStyle={{borderRadius:10,fontFamily:"'DM Sans',sans-serif",fontSize:12}} formatter={v=>[`${v} กก.`,"น้ำหนัก"]}/>
              <Line type="monotone" dataKey="weight" stroke={C.rose} strokeWidth={2.5} dot={<ColorDot/>} activeDot={{r:7,fill:C.rose}}/>
            </LineChart>
          </ResponsiveContainer>
          :<div style={{textAlign:"center",color:C.muted,fontSize:13,padding:"24px 0"}}>ต้องมีข้อมูลอย่างน้อย 2 ครั้งเพื่อแสดงกราฟ</div>}
        <div style={{marginTop:12,display:"flex",gap:14,justifyContent:"center"}}>
          {[{color:C.sage,label:"ลงดี ✅"},{color:C.alert,label:"ติดตาม 🔴"},{color:C.gold,label:"เริ่มต้น ⭐"}].map(l=>(
            <div key={l.label} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.muted}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:l.color}}/>{l.label}
            </div>
          ))}
        </div>
      </div>
      {alertRecs.length>0&&(
        <div style={cardSt}>
          <CardTitle color={C.alert}>รายการที่ต้องแจ้งหมอ</CardTitle>
          {alertRecs.map(r=>{
            const idx=records.indexOf(r);
            const diff=records[idx-1].weight-r.weight;
            return (
              <div key={r.date} style={{background:"rgba(201,59,59,0.05)",border:"1.5px solid rgba(201,59,59,0.2)",borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",gap:10}}>
                <span style={{fontSize:18}}>🔴</span>
                <div style={{fontSize:13,color:C.alert,lineHeight:1.5}}>
                  <strong>{fmtDateShort(r.date)}</strong> — {diff>=0?`ลดน้อยเพียง −${diff.toFixed(1)}`:`ขึ้น +${Math.abs(diff).toFixed(1)}`} กก.<br/>
                  <span style={{fontSize:11,color:C.muted}}>ขนาดยา: {r.dose==="อื่นๆ"?r.doseOther:r.dose} · ปรึกษาหมอทิพย์ค่ะ</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DoctorView() {
  const [allPatients,setAllPatients] = useState([]);
  const [loading,setLoading] = useState(true);
  const [selected,setSelected] = useState(null);

  async function load() {
    setLoading(true);
    const patients=await fbListAll();
    patients.sort((a,b)=>hasAlert(b.records||[])-hasAlert(a.records||[]));
    setAllPatients(patients);
    setLoading(false);
  }
  useEffect(()=>{load();},[]);

  const alertCount=allPatients.filter(p=>hasAlert(p.records||[])).length;

  if(selected) {
    const recs=selected.records||[];
    const total=recs.length>=2?recs[0].weight-recs[recs.length-1].weight:null;
    const cdata=recs.map((r,i)=>({date:fmtDateShort(r.date),weight:r.weight,status:getStatus(recs,i)}));
    return (
      <div style={{padding:"18px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <button onClick={()=>setSelected(null)} style={secBtnSt}>← กลับ</button>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:C.deep}}>{selected.name}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
          {[
            {val:recs.length,label:"บันทึก"},
            {val:total!==null?`${total>=0?"−":"+"}${Math.abs(total).toFixed(1)} กก.`:"—",label:"ลดรวม"},
            {val:recs.length>=2?daysBetween(recs[0].date,recs[recs.length-1].date)+" วัน":"—",label:"ช่วงเวลา"},
          ].map(st=>(
            <div key={st.label} style={{background:C.card,borderRadius:12,padding:"12px 8px",textAlign:"center",boxShadow:"0 1px 8px rgba(0,0,0,.05)"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:C.deep}}>{st.val}</div>
              <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.05em",marginTop:3}}>{st.label}</div>
            </div>
          ))}
        </div>
        {cdata.length>=2&&(
          <div style={{...cardSt,padding:"14px 10px 14px 4px"}}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={cdata} margin={{top:8,right:8,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.blush} vertical={false}/>
                <XAxis dataKey="date" tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false} domain={["auto","auto"]}/>
                <Tooltip contentStyle={{borderRadius:10,fontFamily:"'DM Sans',sans-serif",fontSize:12}} formatter={v=>[`${v} กก.`,"น้ำหนัก"]}/>
                <Line type="monotone" dataKey="weight" stroke={C.rose} strokeWidth={2.5} dot={<ColorDot/>} activeDot={{r:7}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {[...recs].reverse().map(r=>{
          const idx=recs.indexOf(r);
          const status=getStatus(recs,idx);
          const diff=idx>0?recs[idx-1].weight-r.weight:null;
          const borderColor=status==="good"?C.sage:status==="first"?C.gold:C.alert;
          const red=hasRedFlag(r),green=hasExercise(r);
          return (
            <div key={r.date} style={{...cardSt,borderLeft:`4px solid ${borderColor}`,paddingLeft:14,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:11,color:C.muted}}>{fmtDateTH(r.date)}</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,color:C.deep}}>
                    {r.weight} <span style={{fontSize:13,fontWeight:400,color:C.muted}}>กก.</span>
                    {red&&<span style={{marginLeft:6}}>🔴</span>}
                    {green&&<span style={{marginLeft:4}}>🟢</span>}
                  </div>
                  <div style={{fontSize:12,color:C.muted}}>💉 {r.dose==="อื่นๆ"?r.doseOther:r.dose}</div>
                </div>
                <div>
                  {status==="first"&&<Badge color={C.gold}>⭐ เริ่มต้น</Badge>}
                  {status==="good"&&<Badge color={C.sage}>✅ ลงดี</Badge>}
                  {status==="low"&&<Badge color={C.alert}>🔴 ลงช้า</Badge>}
                  {status==="gain"&&<Badge color={C.alert}>🔴 ขึ้น +{Math.abs(diff).toFixed(1)}</Badge>}
                </div>
              </div>
              <WeightAdvice records={recs} idx={idx}/>
              <RecordDetail r={r}/>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{padding:"18px 14px"}}>
      <div style={{background:`linear-gradient(135deg, ${C.deep}, #4A2D1C)`,borderRadius:16,padding:"18px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:50,height:50,borderRadius:"50%",background:`linear-gradient(135deg, ${C.gold}, ${C.rose})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>👩‍⚕️</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:C.cream}}>หมอทิพย์</div>
          <div style={{fontSize:11,color:C.blush,fontWeight:300}}>Astique Clinic — ภาพรวม Mounjaro</div>
        </div>
        <div style={{width:36,height:36,borderRadius:"50%",background:alertCount>0?C.alert:C.sage,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",flexShrink:0}}>{alertCount}</div>
      </div>
      <button onClick={load} style={{...btnSt,marginBottom:14}}>{loading?"กำลังโหลด...":"🔄 รีเฟรช"}</button>
      {loading
        ?<div style={{textAlign:"center",padding:40,color:C.muted}}>กำลังโหลดข้อมูล...</div>
        :allPatients.length===0
          ?<div style={{textAlign:"center",padding:48,color:"#ccc"}}><div style={{fontSize:40,marginBottom:12}}>👩‍⚕️</div><div>ยังไม่มีข้อมูลคนไข้</div></div>
          :allPatients.map(p=>{
              const recs=p.records||[];
              const alert=hasAlert(recs);
              const last=recs[recs.length-1];
              const diff=recs.length>=2?recs[recs.length-2].weight-last.weight:null;
              const red=last&&hasRedFlag(last),green=last&&hasExercise(last);
              return (
                <div key={p.name} onClick={()=>setSelected(p)} style={{...cardSt,cursor:"pointer",borderLeft:`4px solid ${alert?C.alert:recs.length<=1?C.gold:C.sage}`,paddingLeft:14,marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:600,color:C.deep}}>
                        {p.name} {red&&"🔴"}{green&&"🟢"}
                      </div>
                      <div style={{fontSize:12,color:C.muted,marginTop:3}}>
                        {recs.length} บันทึก{last&&` · ล่าสุด ${fmtDateShort(last.date)}`}{last?.dose&&` · 💉 ${last.dose==="อื่นๆ"?last.doseOther:last.dose}`}
                      </div>
                      {diff!==null&&<div style={{fontSize:12,color:diff>=0.5?C.sage:C.alert,marginTop:2,fontWeight:500}}>
                        {diff>=0.5?`↓ −${diff.toFixed(1)} กก. ✅`:diff>=0?`↓ −${diff.toFixed(1)} กก. 🔴`:`↑ +${Math.abs(diff).toFixed(1)} กก. 🔴`}
                      </div>}
                    </div>
                    {recs.length<=1?<Badge color={C.gold}>ใหม่</Badge>:alert?<Badge color={C.alert}>🔴 ติดตาม</Badge>:<Badge color={C.sage}>✅ ปกติดี</Badge>}
                  </div>
                </div>
              );
            })}
    </div>
  );
}

function DoctorPinScreen({onUnlock}) {
  const [pin,setPin] = useState("");
  const [shake,setShake] = useState(false);
  function tryPin(p) {
    if(p===DOCTOR_PIN){onUnlock();}
    else{setShake(true);setTimeout(()=>{setShake(false);setPin("");},600);}
  }
  function press(v) {
    if(pin.length>=4) return;
    const next=pin+v; setPin(next);
    if(next.length===4) tryPin(next);
  }
  return (
    <div style={{padding:"40px 32px",display:"flex",flexDirection:"column",alignItems:"center"}}>
      <div style={{fontSize:40,marginBottom:16}}>👩‍⚕️</div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:C.deep,marginBottom:6}}>หมอทิพย์</div>
      <div style={{fontSize:13,color:C.muted,marginBottom:32}}>ใส่ PIN เพื่อเข้าโหมดหมอ</div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-8px)}80%{transform:translateX(4px)}}`}</style>
      <div style={{display:"flex",gap:16,marginBottom:36,animation:shake?"shake .4s":"none"}}>
        {[0,1,2,3].map(i=><div key={i} style={{width:14,height:14,borderRadius:"50%",background:i<pin.length?C.rose:"transparent",border:`2px solid ${i<pin.length?C.rose:C.blush}`,transition:"all .15s"}}/>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,width:"100%",maxWidth:260}}>
        {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k,i)=>(
          k===""?<div key={i}/>:
          <button key={i} onClick={()=>k==="⌫"?setPin(p=>p.slice(0,-1)):press(k)}
            style={{height:64,borderRadius:16,border:"none",background:k==="⌫"?"transparent":C.card,boxShadow:k==="⌫"?"none":"0 2px 8px rgba(46,31,20,.08)",fontSize:k==="⌫"?22:24,fontFamily:"'DM Sans',sans-serif",color:C.deep,cursor:"pointer"}}>{k}</button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [tab,setTab] = useState("patient");
  const [patientName,setPatientName] = useState("");
  const [phase,setPhase] = useState("name");
  const [records,setRecords] = useState([]);
  const [saving,setSaving] = useState(false);
  const [mode,setMode] = useState("patient");
  const [doctorUnlocked,setDoctorUnlocked] = useState(false);
  const [editRecord,setEditRecord] = useState(null);
  const [toast,setToast] = useState({show:false,msg:""});
  const toastTimer = useRef(null);

  function showToast(msg) {
    clearTimeout(toastTimer.current);
    setToast({show:true,msg});
    toastTimer.current=setTimeout(()=>setToast(t=>({...t,show:false})),2500);
  }

  async function handleNameSubmit(name) {
    const data=await fbGet(name);
    setRecords(data?.records||[]);
    setPatientName(name);
    setPhase("form");
  }

  async function handleSave(record) {
    if(phase!=="edit"&&records.find(r=>r.date===record.date)) return showToast("มีข้อมูลวันนี้แล้ว");
    let newRecords;
    if(phase==="edit") {
      newRecords=records.map(r=>r.date===editRecord.date?record:r).sort((a,b)=>a.date.localeCompare(b.date));
    } else {
      newRecords=[...records,record].sort((a,b)=>a.date.localeCompare(b.date));
    }
    setSaving(true);
    const ok=await fbSet(patientName,{name:patientName,records:newRecords});
    setSaving(false);
    if(!ok) return showToast("บันทึกไม่สำเร็จ ลองใหม่นะคะ");
    setRecords(newRecords);
    showToast(phase==="edit"?"✓ แก้ไขสำเร็จ":"✓ บันทึกสำเร็จ");
    setPhase("history");
  }

  const tabBtnSt=(active)=>({
    flex:1,padding:"9px 6px",borderRadius:8,fontSize:12,fontWeight:500,
    border:`1.5px solid ${active?C.rose:"rgba(255,255,255,0.15)"}`,
    background:active?C.rose:"transparent",color:active?"#fff":"#EDD9C8",
    fontFamily:"'DM Sans',sans-serif",cursor:"pointer",transition:"all .2s",
  });

  return (
    <>
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
          ?<><div style={{background:C.deep,padding:"0 16px 14px"}}><button style={tabBtnSt(true)}>👩‍⚕️ คนไข้ทั้งหมด</button></div><DoctorView/></>
          :<DoctorPinScreen onUnlock={()=>setDoctorUnlocked(true)}/>
        )}

        <Toast msg={toast.msg} show={toast.show}/>
      </div>
    </>
  );
}
