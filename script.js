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

// Standardoppsett som garanterer innhold
const defaultSubjects = [
    {n: "Norsk", c: "#fecaca", r: false}, {n: "Matematikk", c: "#bbf7d0", r: false}, 
    {n: "Engelsk", c: "#bfdbfe", r: false}, {n: "Samfunnsfag", c: "#ffedd5", r: false}, 
    {n: "Naturfag", c: "#ccfbf1", r: true}, {n: "KRLE", c: "#fef9c3", r: false}, 
    {n: "Kroppsøving", c: "#e9d5ff", r: true}, {n: "Kunst & Håndverk", c: "#fbcfe8", r: true},
    {n: "Musikk", c: "#ddd6fe", r: true}
];

const slotsTemplate = [{t:"08:30-09:15"},{t:"09:15-10:00"},{t:"10:00-10:15",p:"PAUSE"},{t:"10:15-11:00"},{t:"11:00-11:45"},{t:"11:45-12:15",p:"LUNSJ"},{t:"12:15-13:00"},{t:"13:00-13:45"},{t:"13:45-14:00",p:"PAUSE"},{t:"14:00-14:45"},{t:"14:45-15:30"}];

let store = { 
    currentPlanId: "9A", 
    globalSubjects: [...defaultSubjects], 
    globalTeachers: [], 
    plans: { "9A": { klasse: "9A", uke: "1", cells: {}, times: slotsTemplate.map(s => s.t) } } 
};

let dragData = null, pendingRoomTarget = null, copyTarget = null;

// GJØR FUNKSJONENE GLOBALE FOR HTML-TILGANG
window.login = () => signInWithPopup(auth, provider);

window.addItem = (type) => {
    if (!store.globalSubjects) store.globalSubjects = [...defaultSubjects];
    if (!store.globalTeachers) store.globalTeachers = [];
    const val = document.getElementById(type === 'fag' ? 'subInp' : 'teaInp').value;
    if (!val) return;
    if (type === 'fag') store.globalSubjects.push({n: val, c: document.getElementById('colInp').value, r: true});
    else store.globalTeachers.push(val);
    document.getElementById(type === 'fag' ? 'subInp' : 'teaInp').value = "";
    save();
};

window.removeItem = (type, i) => {
    if (type === 'sub') store.globalSubjects.splice(i, 1);
    else store.globalTeachers.splice(i, 1);
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

window.setDrag = (type, text, color = '', needsRoom = false) => {
    dragData = {type, text, color, needsRoom};
};

window.applyRoomChoice = (room) => {
    const plan = store.plans[store.currentPlanId];
    if (!plan.cells[pendingRoomTarget]) plan.cells[pendingRoomTarget] = {s:'', t:[], bg:'', r:''};
    plan.cells[pendingRoomTarget].s = dragData.text;
    plan.cells[pendingRoomTarget].bg = dragData.color;
    plan.cells[pendingRoomTarget].r = room;
    closeModals();
    save();
};

window.closeModals = () => {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('roomModal').style.display = 'none';
};

window.clearCell = (id) => {
    store.plans[store.currentPlanId].cells[id] = {s:'', t:[], bg:'', r:''};
    save();
};

window.removeTeacherFromCell = (id, t) => { 
    const plan = store.plans[store.currentPlanId];
    if (plan.cells[id] && plan.cells[id].t) {
        plan.cells[id].t = plan.cells[id].t.filter(name => name !== t);
        save();
    }
};

window.setTab = (t) => {
    document.getElementById('classView').style.display = t === 'class' ? 'block' : 'none';
    document.getElementById('teacherView').style.display = t === 'teacher' ? 'block' : 'none';
    document.getElementById('tabClass').className = t === 'class' ? 'tab active' : 'tab';
    document.getElementById('tabTeacher').className = t === 'teacher' ? 'tab active' : 'tab';
    if (t === 'teacher') renderTeacherSelect();
};

window.confirmCopy = () => {
    const plan = store.plans[store.currentPlanId];
    if (!plan.cells[copyTarget.cellId]) plan.cells[copyTarget.cellId] = {s:'', t:[], bg:'', r:''};
    if (!plan.cells[copyTarget.cellId].t) plan.cells[copyTarget.cellId].t = [];
    if (!plan.cells[copyTarget.cellId].t.includes(copyTarget.teacher)) {
        plan.cells[copyTarget.cellId].t.push(copyTarget.teacher);
        save();
    }
    document.getElementById('copyPrompt').style.display = "none";
};

// FIREBASE LAGRING
async function save() { await setDoc(doc(db, "data", "mainStore"), store); }

// DRAG AND DROP HÅNDTERING (MED SIKRING MOT ERROR)
window.handleDrop = (cellId, x, y) => {
    if (!dragData) return;
    const plan = store.plans[store.currentPlanId];
    
    // Initialiser cellen hvis den er tom
    if (!plan.cells[cellId]) plan.cells[cellId] = {s:'', t:[], bg:'', r:''};
    // Sjekk at lærers-arrayet eksisterer
    if (!plan.cells[cellId].t) plan.cells[cellId].t = [];

    if (dragData.type === 'subject') {
        pendingRoomTarget = cellId;
        document.getElementById('modalOverlay').style.display = 'block';
        document.getElementById('roomModal').style.display = 'block';
    } else if (dragData.type === 'teacher') {
        // Her krasjer det ikke lenger fordi .t er garantert å være en liste
        if (!plan.cells[cellId].t.includes(dragData.text)) {
            plan.cells[cellId].t.push(dragData.text);
            save();
            checkForDoubleHour(cellId, dragData.text, x, y);
        }
    }
};

function checkForDoubleHour(cellId, teacherName, x, y) {
    const [row, col] = cellId.split('-').map(Number);
    let nextRow = row + 1;
    if ([2, 5, 8].includes(nextRow)) nextRow++;
    
    const nextCellId = `${nextRow}-${col}`;
    if (document.getElementById(nextCellId)) {
        const plan = store.plans[store.currentPlanId];
        // Sjekk om faget i timen under er det samme (for dobbelttime-boble)
        if (plan.cells[cellId]?.s === plan.cells[nextCellId]?.s && plan.cells[cellId]?.s !== "") {
            const prompt = document.getElementById('copyPrompt');
            prompt.style.left = x + "px"; prompt.style.top = (y + 20) + "px";
            prompt.style.display = "block";
            copyTarget = { cellId: nextCellId, teacher: teacherName };
            setTimeout(() => { prompt.style.display = "none"; }, 5000);
        }
    }
}

function renderTable() {
    if (!store.globalSubjects) store.globalSubjects = [...defaultSubjects];
    if (!store.globalTeachers) store.globalTeachers = [];

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

        if (slot.p) tr.innerHTML += `<td colspan="5" class="pause-row">${slot.p}</td>`;
        else {
            for (let d = 0; d < 5; d++) {
                const td = document.createElement('td');
                const cellId = `${i}-${d}`;
                td.className = "dropzone";
                const saved = plan.cells[cellId] || {s:'', t:[], bg:'', r:''};
                td.style.backgroundColor = saved.bg;
                td.innerHTML = `
                    <div class="subject-display">${saved.s}</div>
                    <div class="room-label">${saved.r}</div>
                    <div class="teachers-container">
                        ${(saved.t || []).map(t => `<span class="teacher-chip">${t}<span class="rem-chip" onclick="removeTeacherFromCell('${cellId}', '${t}')">✕</span></span>`).join('')}
                    </div>
                    ${saved.s ? `<span class="clear-btn" onclick="clearCell('${cellId}')">✕</span>` : ''}
                `;
                td.ondragover = e => e.preventDefault();
                td.ondrop = (e) => handleDrop(cellId, e.clientX, e.clientY);
                tr.appendChild(td);
            }
        }
        body.appendChild(tr);
    });
    updateListsUI();
    updatePlanSelector();
}

function updateListsUI() {
    document.getElementById('subjectsList').innerHTML = store.globalSubjects.map((s, i) => `
        <div class="fag-item" draggable="true" ondragstart="setDrag('subject','${s.n}','${s.c}',${s.r})" style="background:${s.c}">
            ${s.n} <span class="list-rem" onclick="removeItem('sub',${i})">✕</span>
        </div>`).join('');
    
    document.getElementById('teachersList').innerHTML = store.globalTeachers.map((t, i) => `
        <div class="teacher-item" draggable="true" ondragstart="setDrag('teacher','${t}')">
            ${t} <span class="list-rem" onclick="removeItem('tea',${i})">✕</span>
        </div>`).join('');
}

function updatePlanSelector() {
    const sel = document.getElementById('planSelector');
    sel.innerHTML = Object.keys(store.plans).map(id => `<option value="${id}" ${id === store.currentPlanId ? 'selected' : ''}>${id}</option>`).join('');
    sel.onchange = (e) => { store.currentPlanId = e.target.value; renderTable(); };
}

function renderTeacherSelect() {
    const area = document.getElementById('teacherView');
    area.innerHTML = `
        <div style="text-align:center; margin-bottom:20px;">
            <select id="teacherFilter" class="btn" style="min-width:200px;">
                <option value="">Velg lærer...</option>
                ${store.globalTeachers.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
        </div>
        <div id="teacherTableArea"></div>
    `;
    document.getElementById('teacherFilter').onchange = (e) => filterByTeacher(e.target.value);
}

function filterByTeacher(name) {
    const area = document.getElementById('teacherTableArea');
    if (!name) { area.innerHTML = ""; return; }
    
    // Her kan man bygge en visning som viser lærerens timer på tvers av klasser
    area.innerHTML = `<h3 style="text-align:center;">Viser plan for ${name}</h3><p style="text-align:center;">(Under utvikling: Her vil lærerens samlede timer vises)</p>`;
}

function loadFromFirebase() {
    onSnapshot(doc(db, "data", "mainStore"), (d) => {
        if(d.exists()) { store = d.data(); renderTable(); }
        else { renderTable(); }
    });
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        loadFromFirebase();
    }
});
