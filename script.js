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

let currentTab = 'class', dragData = null, pendingRoomTarget = null, copyTarget = null, editingSubIndex = null;
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
    if(currentTab === 'teacher') return;
    const plan = store.plans[store.currentPlanId];
    plan.klasse = document.getElementById('labelKlasse').innerText;
    plan.uke = document.getElementById('labelUke').innerText;
    
    // Lagre redigerte tidspunkter
    plan.times = Array.from(document.querySelectorAll('.time-cell')).map(td => td.innerText);
    
    plan.cells = [];
    document.querySelectorAll('.dropzone').forEach(z => {
        const ts = Array.from(z.querySelectorAll('.teacher-chip')).map(c => c.firstChild.textContent);
        plan.cells.push({ 
            s: z.querySelector('.subject-display').innerText, 
            r: z.querySelector('.room-label').innerText, 
            t: ts, 
            bg: z.style.backgroundColor 
        });
    });
    await setDoc(doc(db, "data", "mainStore"), store);
}

function loadFromFirebase() {
    onSnapshot(doc(db, "data", "mainStore"), (d) => {
        if(d.exists()) {
            store = d.data();
            renderGlobalLists();
            renderPlanSelector();
            if(currentTab === 'class') loadPlan(store.currentPlanId);
            else renderTeacherSchedule();
        }
    });
}

window.loadPlan = (id) => {
    store.currentPlanId = id; const plan = store.plans[id];
    document.getElementById('labelKlasse').innerText = plan.klasse || id;
    document.getElementById('labelUke').innerText = plan.uke || "1";
    const tbody = document.getElementById('tableBody'); tbody.innerHTML = "";
    let cellIdx = 0;
    slotsTemplate.forEach((slot, i) => {
        const tr = document.createElement('tr');
        const displayTime = (plan.times && plan.times[i]) ? plan.times[i] : slot.t;
        tr.innerHTML = `<td class="time-cell" contenteditable="true" onblur="persistData()">${displayTime}</td>`;
        if(slot.p) tr.innerHTML += `<td colspan="5" class="pause-row">${slot.p}</td>`;
        else {
            for(let j=0; j<5; j++) {
                const td = document.createElement('td'); td.className = "dropzone";
                const saved = (plan.cells && plan.cells[cellIdx]) ? plan.cells[cellIdx] : {s:'', t:[], bg:'', r:''};
                td.style.backgroundColor = saved.bg || '';
                let tHtml = (saved.t || []).map(t => `<span class="teacher-chip">${t}<span class="remove-chip no-print" onclick="removeTeacher(this)">✕</span></span>`).join('');
                td.innerHTML = `<div class="subject-display">${saved.s || ''}</div><div class="room-label">${saved.r || ''}</div><div class="teachers-container">${tHtml}</div>${saved.s ? '<span class="clear-btn no-print" onclick="clearSubject(this)">✕</span>' : ''}`;
                tr.appendChild(td); cellIdx++;
            }
        }
        tbody.appendChild(tr);
    });
}

window.setTab = (type) => {
    currentTab = type;
    document.getElementById('tabClass').classList.toggle('active', type === 'class');
    document.getElementById('tabTeacher').classList.toggle('active', type === 'teacher');
    document.getElementById('teacherViewSelector').style.display = type === 'teacher' ? 'inline-block' : 'none';
    if(type === 'class') loadPlan(store.currentPlanId);
    else { populateTeacherSelector(); renderTeacherSchedule(); }
};

window.renderTeacherSchedule = () => {
    const tName = document.getElementById('teacherViewSelector').value;
    const tbody = document.getElementById('tableBody'); tbody.innerHTML = "";
    slotsTemplate.forEach((slot, sIdx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="time-cell">${slot.t}</td>`;
        if(slot.p) tr.innerHTML += `<td colspan="5" class="pause-row">${slot.p}</td>`;
        else {
            for(let day = 0; day < 5; day++) {
                const td = document.createElement('td');
                const cellData = findTeacherCell(tName, sIdx, day);
                if(cellData) { 
                    td.style.backgroundColor = cellData.bg; 
                    td.innerHTML = `<div class="subject-display">${cellData.s}</div><div class="room-label">${cellData.className}</div>`; 
                }
                tr.appendChild(td);
            }
        }
        tbody.appendChild(tr);
    });
}

function findTeacherCell(t, sIdx, dIdx) {
    if(!t) return null;
    let cellCounter = 0;
    for(let s = 0; s < sIdx; s++) if(!slotsTemplate[s].p) cellCounter += 5;
    const targetIdx = cellCounter + dIdx;
    for(let p in store.plans) {
        const plan = store.plans[p];
        if(plan.cells && plan.cells[targetIdx] && plan.cells[targetIdx].t.includes(t)) {
            return { s: plan.cells[targetIdx].s, bg: plan.cells[targetIdx].bg, className: plan.klasse };
        }
    }
    return null;
}

// ... (addItem, setupDragEvents, renderGlobalLists forblir som i din fil, men med persistData() koblet på)
window.setupDragEvents = () => {
    document.addEventListener('dragover', e => { if(e.target.closest('.dropzone')) e.preventDefault(); });
    document.addEventListener('drop', e => {
        const z = e.target.closest('.dropzone');
        if(z && dragData && currentTab === 'class') {
            if(dragData.type === 'subject') {
                if(dragData.needsRoom) {
                    pendingRoomTarget = z;
                    document.getElementById('modalOverlay').style.display = 'block';
                    document.getElementById('roomModal').style.display = 'block';
                } else updateCellSubject(z, dragData.text, dragData.color, "");
            } else {
                addTeacherToCell(z, dragData.text);
                checkForDoubleHour(z, dragData.text, e.clientX, e.clientY);
            }
            persistData();
        }
    });
}

window.addGlobalItem = (type) => {
    const inp = document.getElementById(type === 'subject' ? 'subInp' : 'teaInp');
    if(!inp.value) return;
    if(type === 'teacher') { if(!store.globalTeachers.includes(inp.value)) store.globalTeachers.push(inp.value); }
    else { store.globalSubjects.push({n: inp.value, c: document.getElementById('colInp').value, r: false}); }
    inp.value = ""; renderGlobalLists(); persistData();
};

function renderGlobalLists() {
    const sL = document.getElementById('subjectsList'), tL = document.getElementById('teachersList');
    sL.innerHTML = ""; tL.innerHTML = "";
    store.globalSubjects.forEach((s, idx) => {
        const div = document.createElement('div'); div.className = 'item'; div.draggable = true;
        div.ondragstart = () => { dragData = { type: 'subject', text: s.n, color: s.c, needsRoom: s.r }; };
        div.innerHTML = `<div class="color-preview" style="background:${s.c}"></div><span>${s.n}</span><div class="item-actions"><span class="action-icon" onclick="openEditSubject(${idx})">✎</span><span class="action-icon" onclick="removeItemFromList('subject','${s.n}')">✕</span></div>`;
        sL.appendChild(div);
    });
    store.globalTeachers.sort().forEach(t => {
        const div = document.createElement('div'); div.className = 'item'; div.draggable = true;
        div.ondragstart = () => { dragData = { type: 'teacher', text: t }; };
        div.innerHTML = `<span>👤 ${t}</span><span class="action-icon" onclick="removeItemFromList('teacher','${t}')">✕</span>`;
        tL.appendChild(div);
    });
}

function populateTeacherSelector() {
    const sel = document.getElementById('teacherViewSelector'); sel.innerHTML = '<option value="">Velg lærer...</option>';
    store.globalTeachers.sort().forEach(t => { const opt = document.createElement('option'); opt.value = t; opt.innerText = t; sel.appendChild(opt); });
}

window.createNewPlan = () => {
    const n = prompt("Klassenavn:");
    if(n) {
        store.plans[n] = { klasse: n, uke: "1", cells: [], times: slotsTemplate.map(s => s.t) };
        persistData();
        loadPlan(n);
    }
};

window.saveInfo = () => persistData();
window.persistData = persistData;
window.applyRoomChoice = (r) => { updateCellSubject(pendingRoomTarget, dragData.text, dragData.color, r); closeModals(); };
window.closeModals = () => { document.getElementById('modalOverlay').style.display = 'none'; document.getElementById('roomModal').style.display = 'none'; document.getElementById('editSubjectModal').style.display = 'none'; };
window.removeTeacher = (btn) => { btn.parentElement.remove(); persistData(); };
window.clearSubject = (btn) => { const td = btn.closest('.dropzone'); td.innerHTML = ''; td.style.backgroundColor = ''; persistData(); loadPlan(store.currentPlanId); };
window.removeItemFromList = (type, name) => { if(type === 'teacher') store.globalTeachers = store.globalTeachers.filter(t => t !== name); else store.globalSubjects = store.globalSubjects.filter(s => s.n !== name); renderGlobalLists(); persistData(); };
function addTeacherToCell(z, n) { const cont = z.querySelector('.teachers-container'); if(!Array.from(cont.querySelectorAll('.teacher-chip')).some(c => c.firstChild.textContent === n)) cont.insertAdjacentHTML('beforeend', `<span class="teacher-chip">${n}<span class="remove-chip no-print" onclick="removeTeacher(this)">✕</span></span>`); }
function renderPlanSelector() { const sel = document.getElementById('planSelector'); sel.innerHTML = ""; Object.keys(store.plans).forEach(id => { const opt = document.createElement('option'); opt.value = id; opt.textContent = id; if(id === store.currentPlanId) opt.selected = true; sel.appendChild(opt); }); }
window.switchPlan = () => { loadPlan(document.getElementById('planSelector').value); };
window.setupDragEvents = setupDragEvents;
window.init = () => { setupDragEvents(); loadFromFirebase(); };
window.onload = window.init;
