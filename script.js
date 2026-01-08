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

const slotsTemplate = [{t:"08:30-09:15"}, {t:"09:15-10:00"}, {t:"10:00-10:15", p:"PAUSE"}, {t:"10:15-11:00"}, {t:"11:00-11:45"}, {t:"11:45-12:15", p:"LUNSJ"}, {t:"12:15-13:00"}, {t:"13:00-13:45"}, {t:"13:45-14:00", p:"PAUSE"}, {t:"14:00-14:45"}, {t:"14:45-15:30"}];

let store = { 
    currentPlanId: "9A", 
    subjects: [], 
    teachers: [], 
    plans: { "9A": { klasse: "9A", laerer: "", uke: "1", cells: Array(55).fill(null).map(() => ({s:'', r:'', t:[], bg:''})), times: slotsTemplate.map(s => s.t) } } 
};

let draggedItem = null;
let pendingCellIdx = null;

// FIREBASE AUTH
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        loadData();
    }
});

function setupApp() {
    renderTable();
    updateLists();
    updatePlanSelector();
    setupEventListeners();
}

// RENDER TIMEPLAN
function renderTable() {
    const plan = store.plans[store.currentPlanId];
    const body = document.getElementById('tableBody');
    body.innerHTML = "";
    
    let cellIdx = 0;
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
                td.className = "drop-zone";
                const idx = cellIdx;
                const cData = plan.cells[idx] || {s:'', r:'', t:[], bg:''};
                
                if (cData.bg) td.style.backgroundColor = cData.bg;
                td.innerHTML = `
                    <div class="subject-display">${cData.s || ''}</div>
                    <div class="room-label">${cData.r || ''}</div>
                    <div class="teachers-container">${(cData.t || []).map(t => `<span class="t-chip">${t}</span>`).join('')}</div>
                    ${cData.s ? `<span class="clear-btn">×</span>` : ''}
                `;

                // Drag and Drop Events
                td.ondragover = e => e.preventDefault();
                td.ondrop = () => handleDrop(idx);
                td.querySelector('.clear-btn')?.addEventListener('click', () => { plan.cells[idx] = {s:'', r:'', t:[], bg:''}; save(); });
                
                tr.appendChild(td);
                cellIdx++;
            }
        }
        body.appendChild(tr);
    });
}

// DRAG & DROP LOGIKK
window.setDrag = (type, text, color = '') => { draggedItem = {type, text, color}; };

function handleDrop(idx) {
    if (!draggedItem) return;
    const plan = store.plans[store.currentPlanId];
    
    if (draggedItem.type === 'fag') {
        pendingCellIdx = idx;
        document.getElementById('roomModal').style.display = 'block';
    } else if (draggedItem.type === 'teacher') {
        if (!plan.cells[idx].t.includes(draggedItem.text)) {
            plan.cells[idx].t.push(draggedItem.text);
            save();
        }
    }
}

window.selectRoom = (roomType) => {
    const plan = store.plans[store.currentPlanId];
    plan.cells[pendingCellIdx].s = draggedItem.text;
    plan.cells[pendingCellIdx].bg = draggedItem.color;
    plan.cells[pendingCellIdx].r = roomType;
    document.getElementById('roomModal').style.display = 'none';
    save();
};

// KLASSESTYRING
window.addNewClass = () => {
    const name = prompt("Navn på ny klasse (f.eks. 10B):");
    if (name && !store.plans[name]) {
        store.plans[name] = JSON.parse(JSON.stringify(store.plans["9A"]));
        store.plans[name].klasse = name;
        store.plans[name].cells = Array(55).fill(null).map(() => ({s:'', r:'', t:[], bg:''}));
        store.currentPlanId = name;
        save();
    }
};

function updatePlanSelector() {
    const sel = document.getElementById('planSelector');
    sel.innerHTML = Object.keys(store.plans).map(id => `<option value="${id}" ${id === store.currentPlanId ? 'selected' : ''}>${id}</option>`).join('');
    sel.onchange = (e) => { store.currentPlanId = e.target.value; renderTable(); };
}

// FAG & LÆRER LISTER
window.addItem = (type) => {
    const val = document.getElementById(type === 'fag' ? 'subInp' : 'teaInp').value;
    if (!val) return;
    if (type === 'fag') store.subjects.push({n: val, c: document.getElementById('colInp').value});
    else store.teachers.push(val);
    save();
};

function updateLists() {
    document.getElementById('subjectsList').innerHTML = store.subjects.map(s => `
        <div class="item fag-item" draggable="true" style="background:${s.c}" ondragstart="setDrag('fag','${s.n}','${s.c}')">${s.n}</div>`).join('');
    document.getElementById('teachersList').innerHTML = store.teachers.map(t => `
        <div class="item teacher-item" draggable="true" ondragstart="setDrag('teacher','${t}')">${t}</div>`).join('');
}

// FIREBASE KONTROLL
async function save() {
    await setDoc(doc(db, "data", "mainStore"), store);
}

function loadData() {
    onSnapshot(doc(db, "data", "mainStore"), (doc) => {
        if (doc.exists()) {
            store = doc.data();
            setupApp();
        }
    });
}

function setupEventListeners() {
    document.getElementById('loginBtn').onclick = () => signInWithPopup(auth, provider);
    document.getElementById('addFagBtn').onclick = () => addItem('fag');
    document.getElementById('addTeaBtn').onclick = () => addItem('teacher');
    document.getElementById('newPlanBtn').onclick = addNewClass;
}
