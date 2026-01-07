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

let store = { 
    subjects: [], 
    teachers: [], 
    currentClass: "9A", 
    plans: { "9A": { cells: {}, times: ["08:30-09:15", "09:15-10:00", "10:00-10:15", "10:15-11:00", "11:00-11:45", "11:45-12:15", "12:15-13:00", "13:00-13:45", "13:45-14:00", "14:00-14:45", "14:45-15:30"] } }
};

let selectedCell = null;
let draggedItem = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        init();
    }
});

function init() {
    setupEventListeners();
    loadFromFirebase();
}

function renderTable() {
    const plan = store.plans[store.currentClass];
    const body = document.getElementById('tableBody');
    body.innerHTML = "";
    
    plan.times.forEach((time, i) => {
        const isPause = (i === 2 || i === 5 || i === 8);
        const tr = document.createElement('tr');
        
        // Tid-celle (Nå redigerbar!)
        const tidTd = document.createElement('td');
        tidTd.className = "time-cell";
        tidTd.contentEditable = true;
        tidTd.innerText = time;
        tidTd.onblur = () => { plan.times[i] = tidTd.innerText; saveToFirebase(); };
        tr.appendChild(tidTd);

        if (isPause) {
            const pauseTd = document.createElement('td');
            pauseTd.colSpan = 5;
            pauseTd.className = "pause-row";
            pauseTd.innerText = i === 5 ? "LUNSJ" : "PAUSE";
            tr.appendChild(pauseTd);
        } else {
            for (let d = 0; d < 5; d++) {
                const td = document.createElement('td');
                td.id = `cell-${i}-${d}`;
                td.className = "drop-zone";
                const cellId = `${i}-${d}`;
                if (plan.cells[cellId]) {
                    td.innerHTML = plan.cells[cellId].html;
                    td.style.backgroundColor = plan.cells[cellId].bg;
                }
                
                td.ondragover = e => e.preventDefault();
                td.ondrop = () => handleDrop(td, cellId);
                td.onclick = (e) => handleCellClick(e, td, cellId);
                tr.appendChild(td);
            }
        }
        body.appendChild(tr);
    });
    updateLists();
}

// PDF-funksjon som bevarer designet
function exportPDF() {
    const element = document.getElementById('printArea');
    const opt = {
        margin: 10,
        filename: `Ukeplan_${store.currentClass}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save();
}

function handleDrop(td, cellId) {
    if (!draggedItem) return;
    const plan = store.plans[store.currentClass];
    if (draggedItem.type === 'fag') {
        td.style.backgroundColor = draggedItem.color;
        td.innerHTML = `<div class="fag-name">${draggedItem.name}</div><div class="t-cont"></div><div class="r-cont"></div>`;
    } else {
        const tCont = td.querySelector('.t-cont');
        if (tCont && !tCont.innerText.includes(draggedItem.name)) {
            tCont.innerHTML += `<span class="t-chip">${draggedItem.name}</span>`;
        }
    }
    plan.cells[cellId] = { html: td.innerHTML, bg: td.style.backgroundColor };
    saveToFirebase();
}

function handleCellClick(e, td, cellId) {
    if (e.shiftKey) {
        td.innerHTML = ""; td.style.backgroundColor = "";
        delete store.plans[store.currentClass].cells[cellId];
        saveToFirebase();
    } else if (td.querySelector('.fag-name')) {
        selectedCell = td;
        selectedCellId = cellId;
        document.getElementById('roomModal').style.display = 'flex';
    }
}

function setupEventListeners() {
    document.getElementById('loginBtn').onclick = () => signInWithPopup(auth, provider);
    document.getElementById('pdfBtn').onclick = exportPDF;
    document.getElementById('resetBtn').onclick = () => { if(confirm("Nullstill hele planen?")) { store.plans[store.currentClass].cells = {}; renderTable(); saveToFirebase(); } };
    
    document.getElementById('addFagBtn').onclick = () => {
        const name = document.getElementById('subInp').value;
        const color = document.getElementById('colInp').value;
        if(name) { store.subjects.push({name, color}); updateLists(); saveToFirebase(); }
    };

    document.getElementById('saveRoomBtn').onclick = () => {
        const p = document.getElementById('primaryRoom').value;
        const s = document.getElementById('secondaryRoom').value;
        const rCont = selectedCell.querySelector('.r-cont');
        rCont.innerHTML = `<small>${p}${s ? ' / '+s : ''}</small>`;
        store.plans[store.currentClass].cells[selectedCellId].html = selectedCell.innerHTML;
        document.getElementById('roomModal').style.display = 'none';
        saveToFirebase();
    };

    // Tab-skifte
    document.getElementById('tabClass').onclick = () => { switchTab('class'); };
    document.getElementById('tabTeacher').onclick = () => { switchTab('teacher'); };
}

function switchTab(type) {
    document.getElementById('classView').style.display = type === 'class' ? 'block' : 'none';
    document.getElementById('teacherView').style.display = type === 'teacher' ? 'block' : 'none';
    document.getElementById('tabClass').className = type === 'class' ? 'tab active' : 'tab';
    document.getElementById('tabTeacher').className = type === 'teacher' ? 'tab active' : 'tab';
}

function updateLists() {
    const sList = document.getElementById('subjectsList');
    sList.innerHTML = store.subjects.map((s, i) => `
        <div class="fag-item" draggable="true" style="background:${s.color}" 
             ondragstart='draggedItem={type:"fag", name:"${s.name}", color:"${s.color}"}'>
            ${s.name} <span onclick="removeSub(${i})">×</span>
        </div>`).join('');

    const tList = document.getElementById('teachersList');
    tList.innerHTML = store.teachers.map((t, i) => `
        <div class="teacher-item" draggable="true" ondragstart='draggedItem={type:"tea", name:"${t}"}'>
            ${t} <span onclick="removeTea(${i})">×</span>
        </div>`).join('');
}

async function saveToFirebase() {
    await setDoc(doc(db, "data", "mainStore"), store);
}

function loadFromFirebase() {
    onSnapshot(doc(db, "data", "mainStore"), (doc) => {
        if(doc.exists()) { store = doc.data(); renderTable(); }
    });
}
