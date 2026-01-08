import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCGyPMHUac2lHwIsmjYxKr_6dtQKAVQHe8",
    authDomain: "ukeplanskole-790e3.firebaseapp.com",
    projectId: "ukeplanskole-790e3",
    storageBucket: "ukeplanskole-790e3.firebasestorage.app",
    messagingSenderId: "59113153158",
    appId: "1:59113153158:web:57934f14254da5a19d6707"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const slotsTemplate = [{t: "08:30-09:15"}, {t: "09:15-10:00"}, {t: "10:00-10:15", p: "PAUSE"}, {t: "10:15-11:00"}, {t: "11:00-11:45"}, {t: "11:45-12:15", p: "LUNSJ"}, {t: "12:15-13:00"}, {t: "13:00-13:45"}, {t: "13:45-14:00", p: "PAUSE"}, {t: "14:00-14:45"}, {t: "14:45-15:30"}];

let currentTab = 'class', dragData = null, pendingRoomTarget = null, editingSubIndex = null;
let store = { currentPlanId: "9A", globalSubjects: [], globalTeachers: [], plans: { "9A": { klasse: "9A", uke: "1", cells: [], times: slotsTemplate.map(s => s.t) } } };

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        loadFromFirebase();
    }
});

window.login = () => signInWithPopup(auth, provider);

async function persistData() {
    if (currentTab === 'teacher') return;
    const plan = store.plans[store.currentPlanId];
    plan.klasse = document.getElementById('labelKlasse').innerText;
    plan.uke = document.getElementById('labelUke').innerText;
    plan.times = Array.from(document.querySelectorAll('.time-cell')).map(td => td.innerText);
    
    const newCells = [];
    document.querySelectorAll('.dropzone').forEach(z => {
        const ts = Array.from(z.querySelectorAll('.teacher-chip')).map(c => c.firstChild.textContent.trim());
        newCells.push({ 
            s: z.querySelector('.subject-display').innerText.trim(), 
            r: z.querySelector('.room-label').innerText.trim(), 
            t: ts, 
            bg: z.style.backgroundColor 
        });
    });
    plan.cells = newCells;
    await setDoc(doc(db, "data", "mainStore"), JSON.parse(JSON.stringify(store)));
}

function loadFromFirebase() {
    onSnapshot(doc(db, "data", "mainStore"), (d) => {
        if (d.exists()) {
            store = d.data();
            updateGlobalListsUI();
            updatePlanSelectorUI();
            if (currentTab === 'class') window.loadPlan(store.currentPlanId);
            else window.renderTeacherSchedule();
        }
    });
}

window.loadPlan = (id) => {
    if (!store.plans[id]) return;
    store.currentPlanId = id; const plan = store.plans[id];
    document.getElementById('labelKlasse').innerText = plan.klasse || id;
    document.getElementById('labelUke').innerText = plan.uke || "1";
    const tbody = document.getElementById('tableBody'); tbody.innerHTML = "";
    let cellIdx = 0;

    slotsTemplate.forEach((slot, i) => {
        const tr = document.createElement('tr');
        const displayTime = (plan.times && plan.times[i]) ? plan.times[i] : slot.t;
        tr.innerHTML = `<td class="time-cell" contenteditable="true" onblur="persistData()">${displayTime}</td>`;
        if (slot.p) tr.innerHTML += `<td colspan="5" class="pause-row">${slot.p}</td>`;
        else {
            for (let j = 0; j < 5; j++) {
                const td = document.createElement('td'); td.className = "dropzone";
                const saved = (plan.cells && plan.cells[cellIdx]) ? plan.cells[cellIdx] : {s:'', t:[], bg:'', r:''};
                td.style.backgroundColor = saved.bg || '';
                const rDisp = (saved.r && saved.r !== "Primærrom") ? `<div class="room-label">${saved.r}</div>` : '';
                let tHtml = (saved.t || []).map(t => `<span class="teacher-chip">${t}<span class="remove-chip no-print" onclick="removeTeacher(this)">✕</span></span>`).join('');
                td.innerHTML = `<div class="subject-display">${saved.s || ''}</div>${rDisp}<div class="teachers-container">${tHtml}</div>${saved.s ? '<span class="clear-btn no-print" onclick="clearSubject(this)">✕</span>' : ''}`;
                td.ondragover = e => e.preventDefault();
                td.ondrop = () => handleDrop(td, cellIdx);
                tr.appendChild(td); cellIdx++;
            }
        }
        tbody.appendChild(tr);
    });
};

function handleDrop(td, cellIdx) {
    if (!dragData || currentTab === 'teacher') return; // Hindrer drop i lærer-visning
    if (dragData.type === 'subject') {
        if (dragData.needsRoom) {
            pendingRoomTarget = { td, idx: cellIdx };
            document.getElementById('modalOverlay').style.display = 'block';
            document.getElementById('roomModal').style.display = 'block';
        } else {
            updateCellUI(td, dragData.text, dragData.color, "Primærrom");
            persistData();
        }
    } else {
        const cont = td.querySelector('.teachers-container');
        if (!Array.from(cont.querySelectorAll('.teacher-chip')).some(c => c.firstChild.textContent === dragData.text)) {
            cont.insertAdjacentHTML('beforeend', `<span class="teacher-chip">${dragData.text}<span class="remove-chip no-print" onclick="removeTeacher(this)">✕</span></span>`);
            persistData();
        }
    }
}

function updateCellUI(td, sub, col, room) {
    const subEl = td.querySelector('.subject-display');
    const roomEl = td.querySelector('.room-label');
    if (subEl) subEl.innerText = sub;
    if (roomEl) roomEl.innerText = (room === "Primærrom" ? "" : room);
    td.style.backgroundColor = col;
    if(!td.querySelector('.clear-btn')) td.insertAdjacentHTML('beforeend', '<span class="clear-btn no-print" onclick="clearSubject(this)">✕</span>');
}

window.applyRoomChoice = (room) => {
    updateCellUI(pendingRoomTarget.td, dragData.text, dragData.color, room);
    window.closeModals();
    persistData();
};

window.renderTeacherSchedule = () => {
    const tName = document.getElementById('teacherViewSelector').value;
    const tbody = document.getElementById('tableBody'); tbody.innerHTML = "";
    if(!tName) return;
    slotsTemplate.forEach((slot, sIdx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="time-cell">${slot.t}</td>`;
        if(slot.p) tr.innerHTML += `<td colspan="5" class="pause-row">${slot.p}</td>`;
        else {
            for(let d = 0; d < 5; d++) {
                const td = document.createElement('td');
                const cellData = findTeacherCellAcrossPlans(tName, sIdx, d);
                if(cellData) {
                    td.style.backgroundColor = cellData.bg;
                    td.innerHTML = `<div class="subject-display">${cellData.s}</div><div class="room-label">${cellData.className}</div>`;
                }
                tr.appendChild(td);
            }
        }
        tbody.appendChild(tr);
    });
};

function findTeacherCellAcrossPlans(t, sIdx, dIdx) {
    let flatIdx = 0;
    for(let s=0; s<sIdx; s++) if(!slotsTemplate[s].p) flatIdx += 5;
    flatIdx += dIdx;
    for(let pId in store.plans) {
        const plan = store.plans[pId];
        const cell = plan.cells[flatIdx];
        if(cell && cell.t && cell.t.includes(t)) return { s: cell.s, bg: cell.bg, className: plan.klasse };
    }
    return null;
}

window.setTab = (t) => {
    currentTab = t;
    document.getElementById('tabClass').classList.toggle('active', t === 'class');
    document.getElementById('tabTeacher').classList.toggle('active', t === 'teacher');
    document.getElementById('teacherViewSelector').style.display = t === 'teacher' ? 'inline-block' : 'none';
    if (t === 'teacher') {
        populateTeacherFilter();
        window.renderTeacherSchedule();
    } else {
        window.loadPlan(store.currentPlanId);
    }
};

function updateGlobalListsUI() {
    const sL = document.getElementById('subjectsList'); sL.innerHTML = "";
    store.globalSubjects.forEach((s, i) => {
        const d = document.createElement('div'); d.className = 'item'; d.draggable = true;
        d.style.borderLeft = `8px solid ${s.c}`; // Her settes fargen på listen
        d.ondragstart = () => { dragData = { type: 'subject', text: s.n, color: s.c, needsRoom: s.r }; };
        d.innerHTML = `<span>${s.n}</span><div class="item-actions"><span class="action-btn" onclick="openEditSubject(${i})">✏️</span><span class="action-btn" onclick="removeItem('sub',${i})">✕</span></div>`;
        sL.appendChild(d);
    });
    const tL = document.getElementById('teachersList'); tL.innerHTML = "";
    (store.globalTeachers || []).sort().forEach((t, i) => {
        const d = document.createElement('div'); d.className = 'item'; d.draggable = true;
        d.ondragstart = () => { dragData = { type: 'teacher', text: t }; };
        d.innerHTML = `<span>👤 ${t}</span><span class="action-btn" onclick="removeItem('tea',${i})">✕</span>`;
        tL.appendChild(d);
    });
}

window.addItem = (type) => {
    const val = document.getElementById(type === 'fag' ? 'subInp' : 'teaInp').value;
    if(!val) return;
    if(type === 'fag') store.globalSubjects.push({n: val, c: document.getElementById('colInp').value, r: false});
    else store.globalTeachers.push(val);
    persistData();
};

window.removeItem = (type, i) => {
    if(type === 'sub') store.globalSubjects.splice(i, 1);
    else store.globalTeachers.splice(i, 1);
    persistData();
};

window.openEditSubject = (i) => {
    editingSubIndex = i; const s = store.globalSubjects[i];
    document.getElementById('editSubName').value = s.n;
    document.getElementById('editSubColor').value = s.c;
    document.getElementById('editSubNeedsRoom').checked = s.r;
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('editSubjectModal').style.display = 'block';
};

window.saveSubjectEdit = () => {
    store.globalSubjects[editingSubIndex] = { n: document.getElementById('editSubName').value, c: document.getElementById('editSubColor').value, r: document.getElementById('editSubNeedsRoom').checked };
    window.closeModals(); persistData();
};

window.addNewClass = () => {
    const n = prompt("Klassenavn:");
    if(n) { store.plans[n] = { klasse: n, uke: "1", cells: [], times: slotsTemplate.map(s => s.t) }; store.currentPlanId = n; persistData(); }
};

window.switchPlan = () => { store.currentPlanId = document.getElementById('planSelector').value; window.loadPlan(store.currentPlanId); };
window.closeModals = () => { document.getElementById('modalOverlay').style.display = 'none'; document.getElementById('roomModal').style.display = 'none'; document.getElementById('editSubjectModal').style.display = 'none'; };
window.clearSubject = (btn) => { const td = btn.closest('.dropzone'); td.style.backgroundColor = ""; td.querySelector('.subject-display').innerText = ""; td.querySelector('.room-label').innerText = ""; td.querySelector('.teachers-container').innerHTML = ""; btn.remove(); persistData(); };
window.removeTeacher = (btn) => { btn.parentElement.remove(); persistData(); };
function populateTeacherFilter() { const sel = document.getElementById('teacherViewSelector'); sel.innerHTML = '<option value="">Velg lærer...</option>' + (store.globalTeachers || []).sort().map(t => `<option value="${t}">${t}</option>`).join(''); }
function updatePlanSelectorUI() { const sel = document.getElementById('planSelector'); sel.innerHTML = ""; Object.keys(store.plans).forEach(id => { const opt = document.createElement('option'); opt.value = id; opt.textContent = id; if(id === store.currentPlanId) opt.selected = true; sel.appendChild(opt); }); }
window.persistData = persistData;
