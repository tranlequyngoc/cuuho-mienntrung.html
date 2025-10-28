// app.js (type=module from index.html)
import L from "https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js";
import 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster-src.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, getDoc, updateDoc, getDocs, limit } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

// ---------- FIREBASE CONFIG (dùng config em đã gửi) ----------
const firebaseConfig = {
  apiKey: "AIzaSyD6DNuThRLY6NsSqlhX71j5zHKhu6e-K_E",
  authDomain: "cuuho-mientrung.firebaseapp.com",
  projectId: "cuuho-mientrung",
  storageBucket: "cuuho-mientrung.firebasestorage.app",
  messagingSenderId: "54443732617",
  appId: "1:54443732617:web:e86f1bc8aea31e64a96058"
};

// init firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// DOM refs
const userBox = document.getElementById('userBox');
const btnLogout = document.getElementById('btn-logout');
const btnSOS = document.getElementById('btn-sos');
const btnOpenSosChat = document.getElementById('btn-open-sos-chat');

const formAuth = document.getElementById('form-auth');
const inputEmail = document.getElementById('auth-email');
const inputPwd = document.getElementById('auth-password');
const btnRegister = document.getElementById('btn-register');

const formPost = document.getElementById('form-post');
const titleEl = document.getElementById('post-title');
const descEl = document.getElementById('post-desc');
const severityEl = document.getElementById('post-severity');
const typeEl = document.getElementById('post-type');
const fileEl = document.getElementById('post-file');
const posDisplay = document.getElementById('posDisplay');
const btnGetLoc = document.getElementById('btn-getloc');
const btnClear = document.getElementById('btn-clear');

const postsList = document.getElementById('postsList');

const searchBox = document.getElementById('searchBox');
const btnSearch = document.getElementById('btn-search');

const modal = document.getElementById('modal');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');

const sosChat = document.getElementById('sosChat');
const closeSosChat = document.getElementById('close-sos-chat');
const sosForm = document.getElementById('sosForm');
const sosInput = document.getElementById('sosInput');
const sosMessages = document.getElementById('sosMessages');

// state
let currentUser = null;
const ADMIN_EMAIL = 'admin@gmail.com';
let map, clusterLayer, areasLayer;
let selectedPos = null;
let firstCorner = null;
let showAreas = true;

// marker icons using SVG assets
const iconBase = (color) => L.icon({
  iconUrl: `assets/marker-${color}.svg`,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -38],
  className: ''
});

const severityColor = s => s==='red'? '#e74c3c' : s==='yellow'? '#f1c40f' : '#2ecc71';
const severityLabel = s => s==='red'? 'Ngập nặng' : s==='yellow'? 'Ngập trung bình' : 'Ngập nhẹ';
const isAdmin = ()=> currentUser && currentUser.email === ADMIN_EMAIL;

// map init
function initMap(){
  map = L.map('map', { zoomControl:true }).setView([15.5,108], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap' }).addTo(map);
  clusterLayer = L.markerClusterGroup();
  areasLayer = L.layerGroup();
  map.addLayer(clusterLayer);
  map.addLayer(areasLayer);

  // click to choose point or area
  map.on('click', (e)=>{
    if(typeEl.value === 'marker'){
      selectedPos = { lat: e.latlng.lat, lng: e.latlng.lng };
      posDisplay.textContent = `Vị trí: ${selectedPos.lat.toFixed(6)}, ${selectedPos.lng.toFixed(6)}`;
      // temp marker
      clusterLayer.eachLayer(l => { if(l._temp) clusterLayer.removeLayer(l) });
      const m = L.marker([selectedPos.lat, selectedPos.lng], { icon: iconBase('green') }).addTo(clusterLayer);
      m._temp = true;
    } else {
      if(!firstCorner){
        firstCorner = e.latlng; posDisplay.textContent = `Đã chọn góc 1 — click góc 2`;
      } else {
        const c1 = firstCorner; const c2 = e.latlng;
        const area = [[c1.lat,c1.lng],[c1.lat,c2.lng],[c2.lat,c2.lng],[c2.lat,c1.lng],[c1.lat,c1.lng]];
        selectedPos = { area, center: [(c1.lat+c2.lat)/2, (c1.lng+c2.lng)/2] };
        posDisplay.textContent = `Vùng đã chọn`;
        areasLayer.eachLayer(l => { if(l._temp) areasLayer.removeLayer(l) });
        const poly = L.polygon(area, { color: severityColor(severityEl.value), weight:1, fillOpacity:0.14 }).addTo(areasLayer);
        poly._temp = true; firstCorner = null;
      }
    }
  });
}

// geolocation
async function getGPS(){
  return new Promise((res, rej)=>{
    if(!navigator.geolocation) return rej('Không hỗ trợ GPS');
    navigator.geolocation.getCurrentPosition(p => res({lat:p.coords.latitude, lng:p.coords.longitude}), err => rej(err), {enableHighAccuracy:true, timeout:12000});
  });
}

// upload media to firebase storage
async function uploadMedia(file){
  if(!file) return null;
  const path = `media/${Date.now()}_${file.name.replace(/\s+/g,'_')}`;
  const ref = sRef(storage, path);
  const data = await file.arrayBuffer();
  await uploadBytes(ref, new Uint8Array(data));
  const url = await getDownloadURL(ref);
  return { url, path };
}

// AUTH handlers
formAuth.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = inputEmail.value.trim(), pwd = inputPwd.value;
  try{ await signInWithEmailAndPassword(auth, email, pwd); toast('Đăng nhập thành công'); }catch(err){ console.error(err); toast('Đăng nhập thất bại'); }
});
btnRegister.addEventListener('click', async ()=>{
  const email = inputEmail.value.trim(), pwd = inputPwd.value; if(!email||!pwd) return toast('Nhập email + mật khẩu');
  try{ await createUserWithEmailAndPassword(auth, email, pwd); toast('Đăng ký thành công — vui lòng đăng nhập'); }catch(err){ console.error(err); toast('Đăng ký thất bại'); }
});
btnLogout.addEventListener('click', async ()=>{ await signOut(auth); toast('Đã đăng xuất'); });

onAuthStateChanged(auth, (u)=>{
  currentUser = u;
  if(u){
    userBox.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><img src="${u.photoURL||'assets/logo.svg'}" style="width:30px;height:30px;border-radius:6px;object-fit:cover"/> <div><div style="font-weight:600">${u.email}</div>${isAdmin()?'<div style="font-size:12px;color:#021;background:#fde68a;padding:4px;border-radius:6px;margin-top:4px">ADMIN</div>':''}</div></div>`;
    btnLogout.style.display = 'inline-block';
  } else { userBox.textContent = 'Chưa đăng nhập'; btnLogout.style.display = 'none'; }
  setTimeout(()=> startRealtime(), 400);
});

// POST submit
formPost.addEventListener('submit', async (e)=>{
  e.preventDefault(); if(!currentUser) return toast('Đăng nhập để đăng bài'); if(!selectedPos) return toast('Chọn vị trí trên bản đồ');
  try{
    const title = titleEl.value.trim() || 'Không tiêu đề';
    const desc = descEl.value.trim() || '';
    const severity = severityEl.value; const type = typeEl.value; const f = fileEl.files[0];
    let mediaUrl = null; if(f){ const upl = await uploadMedia(f); mediaUrl = upl.url; }
    const payload = { title, desc, severity, type, author: currentUser.email, uid: currentUser.uid, createdAt: serverTimestamp() };
    if(type==='marker'){ payload.lat = selectedPos.lat; payload.lng = selectedPos.lng; }
    else { payload.area = selectedPos.area; payload.center = selectedPos.center; }
    if(mediaUrl) payload.mediaUrl = mediaUrl;
    await addDoc(collection(db,'posts'), payload);
    toast('Đăng thành công'); titleEl.value=''; descEl.value=''; fileEl.value=''; selectedPos=null; posDisplay.textContent='Vị trí: chưa';
    clusterLayer.eachLayer(l => { if(l._temp) clusterLayer.removeLayer(l) }); areasLayer.eachLayer(l => { if(l._temp) areasLayer.removeLayer(l) });
  }catch(err){ console.error(err); toast('Lỗi khi đăng'); }
});

document.getElementById('btn-clear').addEventListener('click', ()=>{ titleEl.value=''; descEl.value=''; fileEl.value=''; selectedPos=null; posDisplay.textContent='Vị trí: chưa'; clusterLayer.eachLayer(l => { if(l._temp) clusterLayer.removeLayer(l) }); areasLayer.eachLayer(l => { if(l._temp) areasLayer.removeLayer(l) }); firstCorner=null; });

// SOS quick (creates a red post + record)
btnSOS.addEventListener('click', async ()=>{
  if(!currentUser) return toast('Đăng nhập để gửi SOS'); if(!confirm('Gửi SOS sẽ tạo cảnh báo đỏ với vị trí hiện tại. Tiếp tục?')) return;
  try{ const p = await getGPS(); await addDoc(collection(db,'posts'), { title:'SOS — CẦN CỨU TRỢ', desc:'Người dùng gửi SOS', severity:'red', type:'marker', lat:p.lat, lng:p.lng, uid:currentUser.uid, author:currentUser.email, createdAt: serverTimestamp(), sos:true }); await addDoc(collection(db,'sos'), { uid:currentUser.uid, author:currentUser.email, lat:p.lat, lng:p.lng, createdAt: serverTimestamp() }); toast('SOS đã gửi'); }catch(err){ console.error(err); toast('Không lấy được vị trí'); }
});

// SOS Chat popup (private chat between user and admin)
btnOpenSosChat.addEventListener('click', ()=> {
  if(!currentUser) return toast('Đăng nhập để chat SOS');
  sosChat.style.display = 'flex';
  subscribeSosChat(currentUser.uid);
});
closeSosChat.addEventListener('click', ()=> { sosChat.style.display='none'; sosMessages.innerHTML=''; if(unsubSos) unsubSos(); });
let unsubSos = null;
function subscribeSosChat(uid){
  const q = query(collection(db,'sos_chat_'+uid), orderBy('createdAt','asc'));
  unsubSos = onSnapshot(q, snap => {
    sosMessages.innerHTML = '';
    snap.forEach(s => {
      const d = s.data();
      const el = document.createElement('div');
      el.innerHTML = `<div style="margin:6px 0;padding:8px;border-radius:8px;background:${d.from==='admin'?'rgba(255,255,255,0.04)':'rgba(14,165,166,0.08)'}"><b>${d.from}</b><div style="font-size:13px;margin-top:6px">${escapeHtml(d.text)}</div><div class="small" style="margin-top:6px">${formatTS(d.createdAt)}</div></div>`;
      sosMessages.appendChild(el);
    });
    sosMessages.scrollTop = sosMessages.scrollHeight;
  });
}
sosForm.addEventListener('submit', async (e)=> {
  e.preventDefault();
  if(!currentUser) return toast('Đăng nhập để chat');
  const text = sosInput.value.trim(); if(!text) return;
  await addDoc(collection(db,'sos_chat_'+currentUser.uid), { text, from: currentUser.email, createdAt: serverTimestamp() });
  sosInput.value='';
});

// realtime posts
function startRealtime(){
  const q = query(collection(db,'posts'), orderBy('createdAt','desc'));
  onSnapshot(q, (snap)=>{
    clusterLayer.clearLayers(); areasLayer.clearLayers(); postsList.innerHTML = '';
    snap.forEach(docSnap => { const id = docSnap.id; const d = docSnap.data(); addToMap(id,d); addToFeed(id,d); });
  }, err => console.error(err));
}

function addToMap(id,d){
  const color = severityColor(d.severity || 'green');
  if(d.type==='marker' && d.lat && d.lng){
    const iconColor = d.severity === 'red' ? 'red' : d.severity === 'yellow' ? 'yellow' : 'green';
    const m = L.marker([d.lat,d.lng], { icon: iconBase(iconColor) });
    m.bindPopup(`<strong>${escapeHtml(d.title)}</strong><br/>${escapeHtml(d.desc||'')}<br/><small>${d.author||'Ẩn danh'}</small>`);
    m._id = id; clusterLayer.addLayer(m);
  } else if(d.type==='area' && d.area){
    const poly = L.polygon(d.area, { color, weight:1, fillOpacity:0.14 });
    poly._id = id; poly.bindPopup(`<strong>${escapeHtml(d.title)}</strong>`);
    areasLayer.addLayer(poly);
  }
}

function addToFeed(id,d){
  const el = document.createElement('div'); el.className = 'post';
  const media = document.createElement('div'); media.className = 'media';
  if(d.mediaUrl){
    if(d.mediaUrl.match(/\.(mp4|webm|ogg)(\?.*)?$/i) || d.mediaUrl.includes('video')){
      const v = document.createElement('video'); v.src=d.mediaUrl; v.controls=true; v.style.maxWidth='100%'; v.style.maxHeight='100%'; media.appendChild(v);
    } else {
      const img = document.createElement('img'); img.src=d.mediaUrl; img.style.width='100%'; img.style.height='100%'; img.style.objectFit='cover'; media.appendChild(img);
    }
  } else media.textContent='—';
  const meta = document.createElement('div'); meta.className='meta';
  const h = document.createElement('h4'); h.textContent = d.title || '(Không tiêu đề)';
  const p = document.createElement('p'); p.textContent = d.desc || '';
  const info = document.createElement('div'); info.className='small'; info.textContent = `${d.author||'Ẩn danh'} • ${d.createdAt ? formatTS(d.createdAt): ''}`;
  const tags = document.createElement('div'); tags.className='tags';
  const tag = document.createElement('div'); tag.className = 'tag';
  tag.textContent = severityLabel(d.severity||'green'); if(d.severity==='green') tag.className='tag green'; if(d.severity==='yellow') tag.className='tag yellow'; if(d.severity==='red') tag.className='tag red';
  tags.appendChild(tag);
  if(d.sos){ const s = document.createElement('div'); s.className='tag red'; s.textContent='SOS'; tags.appendChild(s); }

  const footer = document.createElement('div'); footer.className='footer';
  const btnView = document.createElement('button'); btnView.className='icon'; btnView.textContent='Xem'; btnView.onclick = ()=> openModal(id,d);
  const btnGoto = document.createElement('button'); btnGoto.className='icon'; btnGoto.textContent='Tới vị trí'; btnGoto.onclick = ()=> { if(d.type==='marker' && d.lat && d.lng) map.setView([d.lat,d.lng],16); else if(d.type==='area' && d.center) map.fitBounds(d.area); };
  footer.appendChild(btnView); footer.appendChild(btnGoto);

  if(isAdmin()){
    const btnDel = document.createElement('button'); btnDel.className='icon'; btnDel.textContent='Xóa';
    btnDel.onclick = async ()=>{ if(!confirm('Xác nhận xóa bài này?')) return; try{ await deleteDoc(doc(db,'posts',id)); toast('Đã xóa'); }catch(e){ toast('Xóa lỗi'); console.error(e); } };
    footer.appendChild(btnDel);
  }

  meta.appendChild(h); meta.appendChild(p); meta.appendChild(info); meta.appendChild(tags); meta.appendChild(footer);
  el.appendChild(media); el.appendChild(meta);
  postsList.appendChild(el);
}

// modal detail
async function openModal(id,d){
  modalTitle.textContent = d.title || 'Chi tiết';
  modalBody.innerHTML = '';
  const cont = document.createElement('div');
  if(d.mediaUrl){
    if(d.mediaUrl.match(/\.(mp4|webm|ogg)(\?.*)?$/i) || d.mediaUrl.includes('video')){
      const v = document.createElement('video'); v.src=d.mediaUrl; v.controls=true; v.style.maxWidth='100%'; cont.appendChild(v);
    } else {
      const img = document.createElement('img'); img.src=d.mediaUrl; img.style.maxWidth='100%'; cont.appendChild(img);
    }
  }
  const desc = document.createElement('div'); desc.style.marginTop='8px'; desc.textContent = d.desc || ''; cont.appendChild(desc);
  const loc = document.createElement('div'); loc.className='small'; loc.style.marginTop='8px';
  if(d.type==='marker') loc.innerHTML = `<b>Vị trí:</b> ${d.lat?.toFixed(6)}, ${d.lng?.toFixed(6)}`;
  else loc.innerHTML = `<b>Vùng khoanh</b>`;
  cont.appendChild(loc);

  // comments section
  const comWrap = document.createElement('div'); comWrap.style.marginTop='12px'; comWrap.innerHTML = '<strong>Bình luận</strong>';
  const comList = document.createElement('div'); comList.style.marginTop='8px'; comWrap.appendChild(comList);
  const form = document.createElement('form'); form.style.display='flex'; form.style.gap='8px'; form.style.marginTop='8px';
  const inp = document.createElement('input'); inp.placeholder='Viết bình luận...'; inp.style.flex='1';
  const sub = document.createElement('button'); sub.className='btn'; sub.textContent='Gửi'; form.appendChild(inp); form.appendChild(sub);
  comWrap.appendChild(form);

  modalBody.appendChild(cont); modalBody.appendChild(comWrap); modal.style.display = 'flex';

  const comQuery = query(collection(db, `posts/${id}/comments`), orderBy('createdAt','asc'));
  const unsub = onSnapshot(comQuery, snap => {
    comList.innerHTML='';
    snap.forEach(s=>{ const cd = s.data(); const ce = document.createElement('div'); ce.className='post'; ce.style.marginBottom='6px'; ce.innerHTML = `<div style="margin-right:8px"><img src="${cd.avatar||'assets/logo.svg'}" style="width:36px;height:36px;border-radius:50%"/></div><div><b>${cd.author||'Ẩn danh'}</b><div class="small">${formatTS(cd.createdAt)}</div><div style="margin-top:6px">${escapeHtml(cd.text)}</div></div>`; comList.appendChild(ce); });
  });

  form.addEventListener('submit', async (ev)=>{ ev.preventDefault(); if(!currentUser) return toast('Đăng nhập để bình luận'); if(!inp.value.trim()) return; await addDoc(collection(db, `posts/${id}/comments`), { text: inp.value.trim(), author: currentUser.email, uid: currentUser.uid, avatar: currentUser.photoURL||null, createdAt: serverTimestamp() }); inp.value=''; });

  modalClose.onclick = ()=>{ modal.style.display='none'; try{ unsub(); }catch(e){} };
  modal.onclick = (e)=> { if(e.target===modal) { modal.style.display='none'; try{ unsub(); }catch(e){} } };
}

// utilities
function escapeHtml(s){ if(!s) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function formatTS(ts){ try{ if(!ts) return ''; if(ts.seconds) ts = new Date(ts.seconds*1000); else if(ts.toDate) ts = ts.toDate(); else ts = new Date(ts); return ts.toLocaleString(); }catch(e){ return ''; } }
function toast(msg,t=2400){ const el = document.createElement('div'); el.className='toast'; el.textContent = msg; document.body.appendChild(el); setTimeout(()=> el.remove(), t); }

// boot
(function boot(){ initMap(); startRealtime(); getGPS().then(p=> map.setView([p.lat,p.lng],13)).catch(()=>{}); })();

// controls
document.getElementById('btn-getloc').onclick = async ()=>{ try{ const p = await getGPS(); selectedPos = { lat:p.lat, lng:p.lng }; posDisplay.textContent = `Vị trí: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`; clusterLayer.eachLayer(l=> { if(l._temp) clusterLayer.removeLayer(l) }); L.marker([p.lat,p.lng], { icon: iconBase('green') }).addTo(clusterLayer)._temp=true; }catch(e){ toast('Không lấy được vị trí'); } };

document.getElementById('btn-search').addEventListener('click', ()=>{ const q = searchBox.value.trim().toLowerCase(); if(!q) return toast('Nhập từ khoá'); (async ()=>{ const coll = collection(db,'posts'); const snap = await getDocs(query(coll, orderBy('createdAt','desc'), limit(200))); let found=null; snap.forEach(s=>{ const d = s.data(); if(!found && (d.title||'').toLowerCase().includes(q)) found = { id:s.id, data: d }; }); if(found){ const d = found.data; if(d.type==='marker' && d.lat && d.lng) map.setView([d.lat,d.lng],16); else if(d.type==='area' && d.center) map.setView(d.center,13); toast('Tìm thấy: '+(d.title||'')); } else toast('Không tìm thấy'); })(); });

// import helper used above
import { getDocs } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
