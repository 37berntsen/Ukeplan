import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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
    plans: { "9A": { klasse: "9A", uke: "1", cells: {}, times: slotsTemplate.map(s => s.t) } }
};

let draggedItem = null;
let pendingRoomTarget = null;
let editingSubIndex = null;

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
                td.id = cellId;
                const saved = plan.cells[cellId] || {s:'', t:[], bg:'', r:''};
                
                td.style.backgroundColor = saved.bg || '';
                td.innerHTML = `
                    <div class="subject-display">${saved.s || ''}</div>
                    <div class="room-label">${saved.r || ''}</div>
                    <div class="teachers-container">${(saved.t || []).map(t => `<span class="t-chip">${t}<span class="rem-chip" onclick="removeTeacherFromCell('${cellId}', '${t}')">✕</span></span>`).join('')}</div>
                    ${saved.s ? `<span class="clear-cell-btn" onclick="clearCell('${cellId}')">✕</span>` : ''}
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

// DRAG AND DROP
window.setDrag = (type, name, color = '', needsRoom = false) => { draggedItem = {type, name, color, needsRoom}; };

function handleDrop(cellId) {
    if (!draggedItem) return;
    const plan = store.plans[store.currentPlanId];
    if (draggedItem.type === 'fag') {
        if (draggedItem.needsRoom) {
            pendingRoomTarget = cellId;
            document.getElementById('modalOverlay').style.display = 'block';
            document.getElementById('roomModal').style.display = 'block';
            document.getElementById('modalSubjectTitle').innerText = draggedItem.name;
        } else {
            plan.cells[cellId] = { ...plan.cells[cellId], s: draggedItem.name, bg: draggedItem.color, r: '' };
            save();
        }
    } else {
        if (!plan.cells[cellId]) plan.cells[cellId] = {s:'', t:[], bg:'', r:''};
        if (!plan.cells[cellId].t.includes(draggedItem.name)) {
            plan.cells[cellId].t.push(draggedItem.name);
            save();
        }
    }
}

window.applyRoomChoice = (roomType) => {
    const plan = store.plans[store.currentPlanId];
    plan.cells[pendingRoomTarget] = { ...plan.cells[pendingRoomTarget], s: draggedItem.name, bg: draggedItem.color, r: roomType };
    closeModals();
    save();
};

// FIREBASE
async function save() { await setDoc(doc(db, "data", "mainStore"), store); }
function loadFromFirebase() { onSnapshot(doc(db, "data", "mainStore"), (d) => { if(d.exists()) { store = d.data(); renderTable(); } }); }

// UI FUNKSJONER
function updateLists() {
    const sList = document.getElementById('subjectsList');
    sList.innerHTML = store.subjects.map((s, i) => `
        <div class="item" draggable="true" ondragstart="setDrag('fag','${s.n}','${s.c}', ${s.r})">
            <div class="color-preview" style="background:${s.c}"></div>
            <span>${s.n}</span>
            <div class="item-actions">
                <span onclick="openEditSubject(${i})">✎</span>
                <span onclick="removeItem('fag', ${i})">✕</span>
            </div>
        </div>`).join('');

    const tList = document.getElementById('teachersList');
    tList.innerHTML = store.teachers.map((t, i) => `
        <div class="item" draggable="true" ondragstart="setDrag('teacher','${t}')">
            <span>👤 ${t}</span>
            <span onclick="removeItem('teacher', ${i})">✕</span>
        </div>`).join('');
}

window.closeModals = () => { document.getElementById('modalOverlay').style.display = 'none'; document.querySelectorAll('.custom-modal').forEach(m => m.style.display = 'none'); };
window.clearCell = (id) => { delete store.plans[store.currentPlanId].cells[id]; save(); };

// INITIALISERING AV KNAPPER
document.getElementById('loginBtn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('pdfBtn').onclick = () => { html2pdf().set({ margin: 10, filename: 'ukeplan.pdf', jsPDF: { orientation: 'landscape' } }).from(document.getElementById('printArea')).save(); };
document.getElementById('addFagBtn').onclick = () => { store.subjects.push({n: document.getElementById('subInp').value, c: document.getElementById('colInp').value, r: true}); save(); };
document.getElementById('addTeaBtn').onclick = () => { store.teachers.push(document.getElementById('teaInp').value); save(); };
document.getElementById('tabClass').onclick = () => { switchTab('class'); };
document.getElementById('tabTeacher').onclick = () => { switchTab('teacher'); };

function switchTab(type) {
    document.getElementById('classView').style.display = type === 'class' ? 'block' : 'none';
    document.getElementById('teacherView').style.display = type === 'teacher' ? 'block' : 'none';
    document.getElementById('tabClass').className = type === 'class' ? 'tab active' : 'tab';
    document.getElementById('tabTeacher').className = type === 'teacher' ? 'tab active' : 'tab';
}
