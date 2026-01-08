import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Standardmaler basert på din fil
const slotsTemplate = [{t: "08:30-09:15"}, {t: "09:15-10:00"}, {t: "10:00-10:15", p: "PAUSE"}, {t: "10:15-11:00"}, {t: "11:00-11:45"}, {t: "11:45-12:15", p: "LUNSJ"}, {t: "12:15-13:00"}, {t: "13:00-13:45"}, {t: "13:45-14:00", p: "PAUSE"}, {t: "14:00-14:45"}, {t: "14:45-15:30"}];

let store = { 
    currentPlanId: "9A", 
    globalSubjects: [], 
    globalTeachers: [], 
    plans: { "9A": { klasse: "9A", laerer: "", uke: "1", cells: [], times: slotsTemplate.map(s => s.t) } } 
};

let dragData = null;
let pendingRoomTarget = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        loadFromFirebase();
    }
});

function renderTable() {
    const plan = store.plans[store.currentPlanId];
    const body = document.getElementById('tableBody');
    body.innerHTML = "";
    
    let cellIdx = 0;
    slotsTemplate.forEach((slot, i) => {
        const tr = document.createElement('tr');
        
        // Tid-celle (Redigerbar)
        const tidTd = document.createElement('td');
        tidTd.className = "time-cell";
        tidTd.contentEditable = true;
        tidTd.innerText = plan.times[i] || slot.t;
        tidTd.onblur = () => { plan.times[i] = tidTd.innerText; saveToFirebase(); };
        tr.appendChild(tidTd);

        if (slot.p) {
            const pauseTd = document.createElement('td');
            pauseTd.colSpan = 5;
            pauseTd.className = "pause-row";
            pauseTd.innerText = slot.p;
            tr.appendChild(pauseTd);
        } else {
            for (let d = 0; d < 5; d++) {
                const td = document.createElement('td');
                td.className = "drop-zone";
                const cData = plan.cells[cellIdx] || {s:'', r:'', t:[], bg:''};
                
                td.style.backgroundColor = cData.bg || '';
                td.innerHTML = `
                    <div class="subject-display">${cData.s || ''}</div>
                    <div class="room-label">${cData.r || ''}</div>
                    <div class="teachers-container">${(cData.t || []).map(t => `<span class="teacher-chip">${t}<span class="remove-chip" onclick="removeTeacherFromCell(this)">✕</span></span>`).join('')}</div>
                    ${cData.s ? `<span class="delete-btn" onclick="clearCell(this)">✕</span>` : ''}
                `;

                td.ondragover = e => e.preventDefault();
                td.ondrop = () => handleDrop(td, cellIdx);
                tr.appendChild(td);
                cellIdx++;
            }
        }
        body.appendChild(tr);
    });
}

// DRAG AND DROP LOGIKK
window.handleDrop = (td, idx) => {
    if (!dragData) return;
    const plan = store.plans[store.currentPlanId];
    if (!plan.cells[idx]) plan.cells[idx] = {s:'', r:'', t:[], bg:''};

    if (dragData.type === 'subject') {
        pendingRoomTarget = { td, idx };
        document.getElementById('modalOverlay').style.display = 'block';
        document.getElementById('roomModal').style.display = 'block';
    } else if (dragData.type === 'teacher') {
        if (!plan.cells[idx].t.includes(dragData.text)) {
            plan.cells[idx].t.push(dragData.text);
            saveToFirebase();
        }
    }
};

window.applyRoomChoice = (type) => {
    const plan = store.plans[store.currentPlanId];
    const { td, idx } = pendingRoomTarget;
    plan.cells[idx].s = dragData.text;
    plan.cells[idx].bg = dragData.color;
    plan.cells[idx].r = type; // Primærrom eller Ekstrarom
    closeModals();
    saveToFirebase();
};

// LISTE-HÅNDTERING (FAG/LÆRER)
window.addGlobalItem = (type) => {
    const inp = document.getElementById(type === 'subject' ? 'subInp' : 'teaInp');
    if (!inp.value) return;
    if (type === 'subject') {
        store.globalSubjects.push({n: inp.value, c: document.getElementById('colInp').value});
    } else {
        store.globalTeachers.push(inp.value);
    }
    inp.value = "";
    updateLists();
    saveToFirebase();
};

function updateLists() {
    const sList = document.getElementById('subjectsList');
    sList.innerHTML = store.globalSubjects.map((s, i) => `
        <div class="fag-item" draggable="true" style="background:${s.c}" 
             ondragstart="setDragData('subject', '${s.n}', '${s.c}')">
            ${s.n} <span class="delete-btn" onclick="removeGlobal('subject', ${i})">✕</span>
        </div>`).join('');

    const tList = document.getElementById('teachersList');
    tList.innerHTML = store.globalTeachers.map((t, i) => `
        <div class="teacher-item" draggable="true" 
             ondragstart="setDragData('teacher', '${t}')">
            ${t} <span class="delete-btn" onclick="removeGlobal('teacher', ${i})">✕</span>
        </div>`).join('');
}

window.setDragData = (type, text, color = '') => { dragData = {type, text, color}; };
window.closeModals = () => { 
    document.getElementById('modalOverlay').style.display = 'none'; 
    document.getElementById('roomModal').style.display = 'none'; 
};

window.clearCell = (btn) => {
    const td = btn.closest('.drop-zone');
    const allZones = Array.from(document.querySelectorAll('.drop-zone'));
    const idx = allZones.indexOf(td);
    store.plans[store.currentPlanId].cells[idx] = {s:'', r:'', t:[], bg:''};
    saveToFirebase();
};

// FIREBASE SYNCHRONIZATION
async function saveToFirebase() {
    await setDoc(doc(db, "data", "mainStore"), store);
}

function loadFromFirebase() {
    onSnapshot(doc(db, "data", "mainStore"), (doc) => {
        if (doc.exists()) {
            store = doc.data();
            renderTable();
            updateLists();
        }
    });
}

// PDF EKSPORT
document.getElementById('pdfBtn').onclick = () => {
    const element = document.getElementById('printArea');
    html2pdf().set({ 
        margin: 10, 
        filename: `Ukeplan_${store.currentPlanId}.pdf`, 
        jsPDF: { orientation: 'landscape' } 
    }).from(element).save();
};

document.getElementById('loginBtn').onclick = () => signInWithPopup(auth, provider);
