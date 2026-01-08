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

const defaultSubjects = [
    {n: "Norsk", c: "#fecaca", r: false}, {n: "Matematikk", c: "#bbf7d0", r: false}, 
    {n: "Engelsk", c: "#bfdbfe", r: false}, {n: "Naturfag", c: "#ccfbf1", r: true},
    {n: "Kroppsøving", c: "#e9d5ff", r: true}
];

const slotsTemplate = [{t:"08:30-09:15"},{t:"09:15-10:00"},{t:"10:00-10:15",p:"PAUSE"},{t:"10:15-11:00"},{t:"11:00-11:45"},{t:"11:45-12:15",p:"LUNSJ"},{t:"12:15-13:00"},{t:"13:00-13:45"},{t:"13:45-14:00",p:"PAUSE"},{t:"14:00-14:45"},{t:"14:45-15:30"}];

let store = { 
    currentPlanId: "9A", 
    globalSubjects: [...defaultSubjects], 
    globalTeachers: [], 
    plans: { "9A": { klasse: "9A", uke: "1", cells: {}, times: slotsTemplate.map(s => s.t) } } 
};

let dragData = null, pendingRoomTarget = null, editingSubjectIdx = null;

// FIREBASE AUTH
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        loadFromFirebase();
    }
});

window.login = () => signInWithPopup(auth, provider);

// RENDERING
function renderTable(view = 'class', filterTeacher = null) {
    const plan = store.plans[store.currentPlanId];
    const body = view === 'class' ? document.getElementById('tableBody') : document.getElementById('teacherTableBody');
    body.innerHTML = "";
    
    slotsTemplate.forEach((slot, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="time-cell">${plan.times[i] || slot.t}</td>`;
        
        if (slot.p) {
            tr.innerHTML += `<td colspan="5" class="pause-row">${slot.p}</td>`;
        } else {
            for (let d = 0; d < 5; d++) {
                const td = document.createElement('td');
                const cellId = `${i}-${d}`;
                const saved = plan.cells[cellId] || {s:'', t:[], bg:'', r:''};
                
                if (view === 'teacher' && filterTeacher) {
                    if (saved.t && saved.t.includes(filterTeacher)) {
                        td.style.backgroundColor = saved.bg;
                        td.innerHTML = `<div class="subject-display">${saved.s}</div><div class="room-label">${saved.r}</div>`;
                    }
                } else {
                    td.className = "dropzone";
                    td.style.backgroundColor = saved.bg;
                    td.innerHTML = `
                        <div class="subject-display">${saved.s}</div>
                        <div class="room-label">${saved.r}</div>
                        <div class="teachers-container">${(saved.t || []).map(t => `<span class="teacher-chip">${t}</span>`).join('')}</div>
                        ${saved.s ? `<span class="clear-btn" onclick="clearCell('${cellId}')">✕</span>` : ''}
                    `;
                    td.ondragover = e => e.preventDefault();
                    td.ondrop = () => handleDrop(cellId);
                }
                tr.appendChild(td);
            }
        }
        body.appendChild(tr);
    });
    updateGlobalLists();
    updatePlanSelector();
}

// LOGIKK
window.handleDrop = (cellId) => {
    if (!dragData) return;
    const plan = store.plans[store.currentPlanId];
    if (!plan.cells[cellId]) plan.cells[cellId] = {s:'', t:[], bg:'', r:''};

    if (dragData.type === 'subject') {
        if (dragData.needsRoom) {
            pendingRoomTarget = cellId;
            document.getElementById('modalOverlay').style.display = 'block';
            document.getElementById('roomModal').style.display = 'block';
        } else {
            plan.cells[cellId] = { ...plan.cells[cellId], s: dragData.text, bg: dragData.color, r: 'Primærrom' };
            save();
        }
    } else if (dragData.type === 'teacher') {
        if (!plan.cells[cellId].t) plan.cells[cellId].t = [];
        if (!plan.cells[cellId].t.includes(dragData.text)) {
            plan.cells[cellId].t.push(dragData.text);
            save();
        }
    }
};

window.setTab = (t) => {
    document.getElementById('classView').style.display = t === 'class' ? 'block' : 'none';
    document.getElementById('teacherView').style.display = t === 'teacher' ? 'block' : 'none';
    document.getElementById('tabClass').className = t === 'class' ? 'tab active' : 'tab';
    document.getElementById('tabTeacher').className = t === 'teacher' ? 'tab active' : 'tab';
    if(t === 'teacher') updateTeacherFilter();
    else renderTable('class');
};

function updateTeacherFilter() {
    const sel = document.getElementById('teacherFilter');
    sel.innerHTML = '<option value="">Velg lærer...</option>' + store.globalTeachers.map(t => `<option value="${t}">${t}</option>`).join('');
    sel.onchange = (e) => renderTable('teacher', e.target.value);
}

window.openEditSubject = (i) => {
    editingSubjectIdx = i;
    const s = store.globalSubjects[i];
    document.getElementById('editSubName').value = s.n;
    document.getElementById('editSubColor').value = s.c;
    document.getElementById('editSubNeedsRoom').checked = s.r;
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('editSubjectModal').style.display = 'block';
};

window.saveSubjectEdit = () => {
    const s = store.globalSubjects[editingSubjectIdx];
    s.n = document.getElementById('editSubName').value;
    s.c = document.getElementById('editSubColor').value;
    s.r = document.getElementById('editSubNeedsRoom').checked;
    closeModals();
    save();
};

window.addNewClass = () => {
    const name = prompt("Navn på ny klasse:");
    if (name) {
        store.plans[name] = { klasse: name, uke: "1", cells: {}, times: slotsTemplate.map(s => s.t) };
        store.currentPlanId = name;
        save();
    }
};

window.addItem = (type) => {
    const val = document.getElementById(type === 'fag' ? 'subInp' : 'teaInp').value;
    if (!val) return;
    if (type === 'fag') store.globalSubjects.push({n: val, c: document.getElementById('colInp').value, r: false});
    else store.globalTeachers.push(val);
    save();
};

window.removeItem = (type, i) => {
    if (type === 'sub') store.globalSubjects.splice(i, 1);
    else store.globalTeachers.splice(i, 1);
    save();
};

async function save() { await setDoc(doc(db, "data", "mainStore"), store); }
function loadFromFirebase() { onSnapshot(doc(db, "data", "mainStore"), (d) => { if(d.exists()) { store = d.data(); renderTable(); } }); }
window.setDrag = (type, text, color = '', needsRoom = false) => { dragData = {type, text, color, needsRoom}; };
window.closeModals = () => { document.getElementById('modalOverlay').style.display = 'none'; document.getElementById('roomModal').style.display = 'none'; document.getElementById('editSubjectModal').style.display = 'none'; };
window.applyRoomChoice = (r) => { const plan = store.plans[store.currentPlanId]; plan.cells[pendingRoomTarget] = { ...plan.cells[pendingRoomTarget], s: dragData.text, bg: dragData.color, r: r }; closeModals(); save(); };
window.clearCell = (id) => { store.plans[store.currentPlanId].cells[id] = {s:'', t:[], bg:'', r:''}; save(); };

function updateGlobalLists() {
    document.getElementById('subjectsList').innerHTML = store.globalSubjects.map((s, i) => `
        <div class="fag-item" draggable="true" ondragstart="setDrag('subject','${s.n}','${s.c}',${s.r})" style="background:${s.c}">
            <span>${s.n}</span>
            <div style="display:flex; gap:8px;">
                <span onclick="openEditSubject(${i})" style="cursor:pointer">✏️</span>
                <span onclick="removeItem('sub',${i})" style="cursor:pointer; color:red;">✕</span>
            </div>
        </div>`).join('');
    document.getElementById('teachersList').innerHTML = store.globalTeachers.map((t, i) => `
        <div class="teacher-item" draggable="true" ondragstart="setDrag('teacher','${t}')">
            <span>${t}</span>
            <span onclick="removeItem('tea',${i})" style="cursor:pointer; color:red;">✕</span>
        </div>`).join('');
}

function updatePlanSelector() {
    const sel = document.getElementById('planSelector');
    sel.innerHTML = Object.keys(store.plans).map(id => `<option value="${id}" ${id === store.currentPlanId ? 'selected' : ''}>${id}</option>`).join('');
    sel.onchange = (e) => { store.currentPlanId = e.target.value; renderTable(); };
}
