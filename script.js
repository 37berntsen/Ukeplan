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

const slotsTemplate = [
    {t: "08:30-09:15"}, {t: "09:15-10:00"}, {t: "10:00-10:15", p: "PAUSE"},
    {t: "10:15-11:00"}, {t: "11:00-11:45"}, {t: "11:45-12:15", p: "LUNSJ"},
    {t: "12:15-13:00"}, {t: "13:00-13:45"}, {t: "13:45-14:00", p: "PAUSE"},
    {t: "14:00-14:45"}, {t: "14:45-15:30"}
];

let store = { 
    currentPlanId: "9A", 
    subjects: [], 
    teachers: [], 
    plans: { "9A": { klasse: "9A", laerer: "", uke: "1", cells: {}, times: slotsTemplate.map(s => s.t) } }
};

let draggedItem = null;
let pendingRoomTarget = null;

// AUTENTISERING
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        loadFromFirebase();
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});

window.login = () => signInWithPopup(auth, provider);

// RENDERING
function renderTable() {
    const plan = store.plans[store.currentPlanId];
    const body = document.getElementById('tableBody');
    if(!body) return;
    body.innerHTML = "";
    
    // Oppdater info-bokser
    document.getElementById('labelKlasse').innerText = plan.klasse || store.currentPlanId;
    document.getElementById('labelUke').innerText = plan.uke || "1";

    slotsTemplate.forEach((slot, i) => {
        const tr = document.createElement('tr');
        const tidTd = document.createElement('td');
        tidTd.className = "time-cell";
        tidTd.contentEditable = true;
        tidTd.innerText = plan.times[i] || slot.t;
        tidTd.onblur = () => { plan.times[i] = tidTd.innerText; save(); };
        tr.appendChild(tidTd);

        if (slot.p) {
            tr.innerHTML += `<td colspan="5" class="pause-row">${slot.p}</td>`;
        } else {
            for (let d = 0; d < 5; d++) {
                const td = document.createElement('td');
                const cellId = `${i}-${d}`;
                td.className = "drop-zone";
                const saved = plan.cells[cellId] || {s:'', t:[], bg:'', r:''};
                
                td.style.backgroundColor = saved.bg || '';
                td.innerHTML = `
                    <div class="subject-display">${saved.s || ''}</div>
                    <div class="room-label">${saved.r || ''}</div>
                    <div class="teachers-container">${(saved.t || []).map(t => `<span class="t-chip">${t}<span class="rem-chip" onclick="removeTeacherFromCell('${cellId}', '${t}')">✕</span></span>`).join('')}</div>
                    ${saved.s ? `<span class="clear-btn" onclick="clearCell('${cellId}')">✕</span>` : ''}
                `;
                td.ondragover = e => e.preventDefault();
                td.ondrop = () => handleDrop(cellId);
                tr.appendChild(td);
            }
        }
        body.appendChild(tr);
    });
    updateLists();
    updatePlanSelector();
}

// FUNKSJONALITET
window.handleDrop = (cellId) => {
    if (!draggedItem) return;
    const plan = store.plans[store.currentPlanId];
    if (draggedItem.type === 'fag') {
        pendingRoomTarget = cellId;
        document.getElementById('modalOverlay').style.display = 'block';
        document.getElementById('roomModal').style.display = 'block';
    } else {
        if (!plan.cells[cellId]) plan.cells[cellId] = {s:'', t:[], bg:'', r:''};
        if (!plan.cells[cellId].t.includes(draggedItem.name)) {
            plan.cells[cellId].t.push(draggedItem.name);
            save();
        }
    }
};

window.applyRoomChoice = (roomType) => {
    const plan = store.plans[store.currentPlanId];
    plan.cells[pendingRoomTarget] = { ...plan.cells[pendingRoomTarget], s: draggedItem.name, bg: draggedItem.color, r: roomType };
    closeModals();
    save();
};

window.addItem = (type) => {
    const val = document.getElementById(type === 'fag' ? 'subInp' : 'teaInp').value;
    if (!val) return;
    if (type === 'fag') {
        store.subjects.push({n: val, c: document.getElementById('colInp').value, r: true});
    } else {
        store.teachers.push(val);
    }
    save();
};

window.addNewClass = () => {
    const name = prompt("Skriv inn navn på ny klasse (f.eks 10B):");
    if (name) {
        store.plans[name] = { klasse: name, laerer: "", uke: "1", cells: {}, times: slotsTemplate.map(s => s.t) };
        store.currentPlanId = name;
        save();
    }
};

window.setTab = (t) => {
    document.getElementById('classView').style.display = t === 'class' ? 'block' : 'none';
    document.getElementById('teacherView').style.display = t === 'teacher' ? 'block' : 'none';
    document.getElementById('tabClass').className = t === 'class' ? 'tab active' : 'tab';
    document.getElementById('tabTeacher').className = t === 'teacher' ? 'tab active' : 'tab';
    if(t === 'teacher') renderTeacherView();
};

// FIREBASE
async function save() { await setDoc(doc(db, "data", "mainStore"), store); }
function loadFromFirebase() { onSnapshot(doc(db, "data", "mainStore"), (d) => { if(d.exists()) { store = d.data(); renderTable(); } }); }

// HJELPEFUNKSJONER
window.setDrag = (type, name, color = '') => { draggedItem = {type, name, color}; };
window.closeModals = () => { document.getElementById('modalOverlay').style.display = 'none'; document.getElementById('roomModal').style.display = 'none'; };
window.clearCell = (id) => { delete store.plans[store.currentPlanId].cells[id]; save(); };

function updateLists() {
    document.getElementById('subjectsList').innerHTML = store.subjects.map(s => `<div class="item" draggable="true" ondragstart="setDrag('fag','${s.n}','${s.c}')" style="background:${s.c}">${s.n}</div>`).join('');
    document.getElementById('teachersList').innerHTML = store.teachers.map(t => `<div class="item" draggable="true" ondragstart="setDrag('teacher','${t}')">${t}</div>`).join('');
}

function updatePlanSelector() {
    const sel = document.getElementById('planSelector');
    sel.innerHTML = Object.keys(store.plans).map(id => `<option value="${id}" ${id === store.currentPlanId ? 'selected' : ''}>${id}</option>`).join('');
    sel.onchange = (e) => { store.currentPlanId = e.target.value; renderTable(); };
}
