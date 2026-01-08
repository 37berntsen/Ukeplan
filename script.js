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

// Mal for tidsplanen
const slotsTemplate = [
    {t: "08:30-09:15"}, {t: "09:15-10:00"}, {t: "10:00-10:15", p: "PAUSE"},
    {t: "10:15-11:00"}, {t: "11:00-11:45"}, {t: "11:45-12:15", p: "LUNSJ"},
    {t: "12:15-13:00"}, {t: "13:00-13:45"}, {t: "13:45-14:00", p: "PAUSE"},
    {t: "14:00-14:45"}, {t: "14:45-15:30"}
];

let store = {
    currentPlanId: "9A",
    globalSubjects: [],
    globalTeachers: [],
    plans: { "9A": { klasse: "9A", laerer: "", uke: "1", cells: [] } }
};

let currentTab = 'class', dragData = null, pendingRoomTarget = null, editingSubIndex = null;

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
        tr.innerHTML = `<td class="time-cell" contenteditable="true">${slot.t}</td>`;

        if(slot.p) {
            tr.innerHTML += `<td colspan="5" class="pause-row">${slot.p}</td>`;
        } else {
            for(let j=0; j<5; j++) {
                const td = document.createElement('td');
                td.className = "dropzone";
                const saved = plan.cells[cellIdx] || {s:'', t:[], bg:'', r:''};
                
                td.style.backgroundColor = saved.bg || '';
                td.innerHTML = `
                    <div class="subject-display">${saved.s || ''}</div>
                    <div class="room-label">${saved.r || ''}</div>
                    <div class="teachers-container">
                        ${(saved.t || []).map(t => `<span class="teacher-chip">${t}<span class="remove-chip" onclick="removeTeacher(this)">✕</span></span>`).join('')}
                    </div>
                    ${saved.s ? '<span class="clear-btn" onclick="clearCell(this)">✕</span>' : ''}
                `;
                tr.appendChild(td);
                cellIdx++;
            }
        }
        body.appendChild(tr);
    });
    setupDragEvents();
}

// DRAG AND DROP LOGIKK
function setupDragEvents() {
    document.querySelectorAll('.dropzone').forEach(z => {
        z.ondragover = e => e.preventDefault();
        z.ondrop = e => {
            if(!dragData) return;
            const idx = Array.from(document.querySelectorAll('.dropzone')).indexOf(z);
            if(dragData.type === 'subject') {
                if(dragData.needsRoom) {
                    pendingRoomTarget = z;
                    document.getElementById('modalOverlay').style.display = 'block';
                    document.getElementById('roomModal').style.display = 'block';
                } else {
                    updateCell(z, idx, dragData.text, dragData.color, "");
                }
            } else {
                addTeacher(z, idx, dragData.text);
            }
        };
    });
}

// KNAPPEFUNKSJONER
window.applyRoomChoice = (room) => {
    const idx = Array.from(document.querySelectorAll('.dropzone')).indexOf(pendingRoomTarget);
    updateCell(pendingRoomTarget, idx, dragData.text, dragData.color, room);
    closeModals();
};

window.addGlobalItem = (type) => {
    const inp = document.getElementById(type === 'subject' ? 'subInp' : 'teaInp');
    if(!inp.value) return;
    if(type === 'subject') {
        store.globalSubjects.push({n: inp.value, c: document.getElementById('colInp').value, r: true});
    } else {
        store.globalTeachers.push(inp.value);
    }
    inp.value = "";
    saveToFirebase();
};

window.setTab = (type) => {
    currentTab = type;
    document.getElementById('tabClass').classList.toggle('active', type === 'class');
    document.getElementById('tabTeacher').classList.toggle('active', type === 'teacher');
    document.getElementById('classView').style.display = type === 'class' ? 'block' : 'none';
    document.getElementById('teacherView').style.display = type === 'teacher' ? 'block' : 'none';
};

// FIREBASE SYNCHRONIZATION
async function saveToFirebase() {
    const plan = store.plans[store.currentPlanId];
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
    onSnapshot(doc(db, "data", "mainStore"), (doc) => {
        if(doc.exists()) {
            store = doc.data();
            updateGlobalLists();
            renderTable();
        }
    });
}

function updateGlobalLists() {
    const sL = document.getElementById('subjectsList');
    sL.innerHTML = store.globalSubjects.map((s, i) => `
        <div class="item" draggable="true" ondragstart='dragData={type:"subject",text:"${s.n}",color:"${s.c}",needsRoom:${s.r}}'>
            <div class="color-preview" style="background:${s.c}"></div>
            <span>${s.n}</span>
            <div class="item-actions">
                <span class="action-btn" onclick="openEditSubject(${i})">✎</span>
                <span class="action-btn" onclick="removeItem('subject', ${i})">✕</span>
            </div>
        </div>`).join('');

    const tL = document.getElementById('teachersList');
    tL.innerHTML = store.globalTeachers.map((t, i) => `
        <div class="item" draggable="true" ondragstart='dragData={type:"teacher",text:"${t}"}'>
            <span>👤 ${t}</span>
            <span class="action-btn" onclick="removeItem('teacher', ${i})">✕</span>
        </div>`).join('');
}

window.login = () => signInWithPopup(auth, provider);
window.closeModals = () => {
    document.getElementById('modalOverlay').style.display = 'none';
    document.querySelectorAll('.custom-modal').forEach(m => m.style.display = 'none');
};
