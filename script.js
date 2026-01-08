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
    {n: "Engelsk", c: "#bfdbfe", r: false}, {n: "Naturfag", c: "#ccfbf1", r: true}
];

const slotsTemplate = [{t:"08:30-09:15"},{t:"09:15-10:00"},{t:"10:00-10:15",p:"PAUSE"},{t:"10:15-11:00"},{t:"11:00-11:45"},{t:"11:45-12:15",p:"LUNSJ"},{t:"12:15-13:00"},{t:"13:00-13:45"},{t:"13:45-14:00",p:"PAUSE"},{t:"14:00-14:45"},{t:"14:45-15:30"}];

let store = { 
    currentPlanId: "9A", 
    globalSubjects: [...defaultSubjects], 
    globalTeachers: [], 
    plans: { "9A": { klasse: "9A", uke: "1", cells: {}, times: slotsTemplate.map(s => s.t) } } 
};

let dragData = null;
let editingSubjectIdx = null;

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
                td.className = "dropzone";
                const cellId = `${i}-${d}`;
                const saved = plan.cells[cellId] || {s:'', t:[], bg:'', r:''};
                
                // Hvis lærervisning: Vis bare celler der læreren er tildelt
                if (view === 'teacher' && filterTeacher && !saved.t.includes(filterTeacher)) {
                    td.style.backgroundColor = 'transparent';
                } else {
                    td.style.backgroundColor = saved.bg;
                    td.innerHTML = `<div class="subject-display">${saved.s}</div><div class="room-label">${saved.r}</div><div class="teachers-container">${(saved.t || []).map(t => `<span class="teacher-chip">${t}<span class="rem-chip" onclick="removeTeacherFromCell('${cellId}', '${t}')">✕</span></span>`).join('')}</div>${saved.s ? `<span class="clear-btn" onclick="clearCell('${cellId}')">✕</span>` : ''}`;
                }

                td.ondragover = e => e.preventDefault();
                td.ondrop = (e) => handleDrop(cellId, e.clientX, e.clientY);
                tr.appendChild(td);
            }
        }
        body.appendChild(tr);
    });
    updateLists();
}

// DRAG AND DROP - FIKSET FOR LÆRER
window.setDrag = (type, text, color = '', needsRoom = false) => {
    dragData = {type, text, color, needsRoom};
};

window.handleDrop = (cellId, x, y) => {
    if (!dragData) return;
    const plan = store.plans[store.currentPlanId];
    
    if (dragData.type === 'subject') {
        plan.cells[cellId] = { ...plan.cells[cellId], s: dragData.text, bg: dragData.color, r: 'Primærrom' };
    } else if (dragData.type === 'teacher') {
        if (!plan.cells[cellId]) plan.cells[cellId] = {s:'', t:[], bg:'', r:''};
        if (!plan.cells[cellId].t.includes(dragData.text)) {
            plan.cells[cellId].t.push(dragData.text);
        }
    }
    save();
};

// FANER
window.setTab = (t) => {
    const classView = document.getElementById('classView');
    const teacherView = document.getElementById('teacherView');
    const tabClass = document.getElementById('tabClass');
    const tabTeacher = document.getElementById('tabTeacher');

    if (t === 'class') {
        classView.style.display = 'block';
        teacherView.style.display = 'none';
        tabClass.classList.add('active');
        tabTeacher.classList.remove('active');
        renderTable('class');
    } else {
        classView.style.display = 'none';
        teacherView.style.display = 'block';
        tabClass.classList.remove('active');
        tabTeacher.classList.add('active');
        updateTeacherSelect();
    }
};

function updateTeacherSelect() {
    const sel = document.getElementById('teacherViewSelector');
    sel.innerHTML = '<option value="">Velg lærer...</option>' + store.globalTeachers.map(t => `<option value="${t}">${t}</option>`).join('');
    sel.onchange = (e) => renderTable('teacher', e.target.value);
}

// BLYANT/REDIGERING AV FAG
window.openEditSubject = (i) => {
    editingSubjectIdx = i;
    const s = store.globalSubjects[i];
    document.getElementById('editSubName').value = s.n;
    document.getElementById('editSubColor').value = s.c;
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('editSubjectModal').style.display = 'block';
};

window.saveSubjectEdit = () => {
    const s = store.globalSubjects[editingSubjectIdx];
    s.n = document.getElementById('editSubName').value;
    s.c = document.getElementById('editSubColor').value;
    closeModals();
    save();
};

function updateLists() {
    document.getElementById('subjectsList').innerHTML = store.globalSubjects.map((s, i) => `
        <div class="fag-item" draggable="true" ondragstart="setDrag('subject','${s.n}','${s.c}')" style="background:${s.c}">
            <span>${s.n}</span>
            <div class="item-tools">
                <span onclick="openEditSubject(${i})">✏️</span>
                <span onclick="removeItem('sub',${i})">✕</span>
            </div>
        </div>`).join('');
    
    document.getElementById('teachersList').innerHTML = store.globalTeachers.map((t, i) => `
        <div class="teacher-item" draggable="true" ondragstart="setDrag('teacher','${t}')">
            <span>${t}</span>
            <span onclick="removeItem('tea',${i})">✕</span>
        </div>`).join('');
}

// FIREBASE
async function save() { await setDoc(doc(db, "data", "mainStore"), store); }
function loadFromFirebase() { onSnapshot(doc(db, "data", "mainStore"), (d) => { if(d.exists()) { store = d.data(); renderTable(); } }); }
window.closeModals = () => { document.getElementById('modalOverlay').style.display = 'none'; document.getElementById('editSubjectModal').style.display = 'none'; };
window.addItem = (type) => {
    const val = document.getElementById(type === 'fag' ? 'subInp' : 'teaInp').value;
    if (!val) return;
    if (type === 'fag') store.globalSubjects.push({n: val, c: document.getElementById('colInp').value, r: false});
    else store.globalTeachers.push(val);
    save();
};
