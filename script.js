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

// SIKKER LAGRING SOM OGSÅ TAR MED TIDSPUNKTER
async function persistData() {
    if (currentTab === 'teacher') return;
    const plan = store.plans[store.currentPlanId];
    
    plan.klasse = document.getElementById('labelKlasse').innerText;
    plan.uke = document.getElementById('labelUke').innerText;
    
    // Lagrer redigerte tider fra første kolonne
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

    await setDoc(doc(db, "data", "mainStore"), store);
}

function loadFromFirebase() {
    onSnapshot(doc(db, "data", "mainStore"), (d) => {
        if (d.exists()) {
            store = d.data();
            updateGlobalListsUI();
            updatePlanSelectorUI();
            if (currentTab === 'class') window.loadPlan(store.currentPlanId);
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
        
        if (slot.p) {
            tr.innerHTML += `<td colspan="5" class="pause-row">${slot.p}</td>`;
        } else {
            for (let j = 0; j < 5; j++) {
                const td = document.createElement('td'); td.className = "dropzone";
                const saved = (plan.cells && plan.cells[cellIdx]) ? plan.cells[cellIdx] : {s:'', t:[], bg:'', r:''};
                td.style.backgroundColor = saved.bg || '';
                const rDisp = (saved.r && saved.r !== "Primærrom") ? `<div class="room-label">${saved.r}</div>` : '';
                let tHtml = (saved.t || []).map(t => `<span class="teacher-chip">${t}<span class="remove-chip no-print" onclick="removeTeacher(this)">✕</span></span>`).join('');
                td.innerHTML = `<div class="subject-display">${saved.s || ''}</div>${rDisp}<div class="teachers-container">${tHtml}</div>${saved.s ? '<span class="clear-btn no-print" onclick="clearSubject(this)">✕</span>' : ''}`;
                tr.appendChild(td); cellIdx++;
            }
        }
        tbody.appendChild(tr);
    });
};

// LÆRER-FANE LOGIKK
window.setTab = (t) => {
    currentTab = t;
    document.getElementById('tabClass').classList.toggle('active', t === 'class');
    document.getElementById('tabTeacher').classList.toggle('active', t === 'teacher');
    document.getElementById('teacherViewSelector').style.display = t === 'teacher' ? 'inline-block' : 'none';
    if(t === 'teacher') {
        populateTeacherFilter();
        renderTeacherSchedule();
    } else {
        window.loadPlan(store.currentPlanId);
    }
};

function populateTeacherFilter() {
    const sel = document.getElementById('teacherViewSelector');
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">Velg lærer...</option>' + 
        store.globalTeachers.sort().map(t => `<option value="${t}">${t}</option>`).join('');
    sel.value = currentVal;
}

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

// ... Resten av funksjonene (handleDrop, addItem, removeItem, etc.) forblir som i den velfungerende kopien ...
window.handleDrop = (td, cellIdx) => { /* Din drag-logikk */ };
window.persistData = persistData;
