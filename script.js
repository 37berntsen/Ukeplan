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

let store = { subjects: [], teachers: [], currentClass: "9A", plans: {} };
const slots = [{t:"08:30-09:15"}, {t:"09:15-10:00"}, {t:"10:00-10:15", p:"PAUSE"}, {t:"10:15-11:00"}, {t:"11:00-11:45"}, {t:"11:45-12:15", p:"LUNSJ"}, {t:"12:15-13:00"}, {t:"13:00-13:45"}, {t:"13:45-14:00", p:"PAUSE"}, {t:"14:00-14:45"}, {t:"14:45-15:30"}];

onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        init();
    }
});

function init() {
    renderTable();
    setupListeners();
    loadFromFirebase();
}

function renderTable() {
    const render = (id) => {
        const body = document.getElementById(id);
        body.innerHTML = slots.map((s, i) => {
            if(s.p) return `<tr style="background:#f1f5f9;"><td class="time-cell">${s.t}</td><td colspan="5" style="font-weight:900;">${s.p}</td></tr>`;
            return `<tr><td class="time-cell">${s.t}</td>${[0,1,2,3,4].map(d => `<td id="${id}-${i}-${d}" class="drop-zone"></td>`).join('')}</tr>`;
        }).join('');
    };
    render('tableBody');
    render('teacherTableBody');
    setupDragDrop();
}

function setupListeners() {
    // Legg til fag
    document.getElementById('addFagBtn').onclick = () => {
        const name = document.getElementById('subInp').value;
        const color = document.getElementById('colInp').value;
        if(name) {
            store.subjects.push({name, color});
            updateLists();
            saveToFirebase();
        }
    };

    // Legg til lærer
    document.getElementById('addTeaBtn').onclick = () => {
        const name = document.getElementById('teaInp').value;
        if(name) {
            store.teachers.push(name);
            updateLists();
            saveToFirebase();
        }
    };

    // Fanebytte
    document.getElementById('tabClass').onclick = () => {
        document.getElementById('classView').style.display = 'block';
        document.getElementById('teacherView').style.display = 'none';
        document.getElementById('tabClass').classList.add('active');
        document.getElementById('tabTeacher').classList.remove('active');
    };

    document.getElementById('tabTeacher').onclick = () => {
        document.getElementById('classView').style.display = 'none';
        document.getElementById('teacherView').style.display = 'block';
        document.getElementById('tabTeacher').classList.add('active');
        document.getElementById('tabClass').classList.remove('active');
    };

    document.getElementById('loginBtn').onclick = () => signInWithPopup(auth, provider);
}

function updateLists() {
    const sList = document.getElementById('subjectsList');
    sList.innerHTML = store.subjects.map(s => `<div class="fag-item" draggable="true" style="background:${s.color}">${s.name}</div>`).join('');
    
    const tList = document.getElementById('teachersList');
    tList.innerHTML = store.teachers.map(t => `<div class="teacher-item" draggable="true">${t}</div>`).join('');
    
    setupDragDrop();
}

function setupDragDrop() {
    let dragged = null;
    document.querySelectorAll('.fag-item, .teacher-item').forEach(el => {
        el.ondragstart = (e) => dragged = { 
            text: e.target.innerText, 
            color: e.target.style.backgroundColor,
            isTeacher: e.target.classList.contains('teacher-item')
        };
    });

    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.ondragover = e => e.preventDefault();
        zone.ondrop = () => {
            if(!dragged) return;
            if(!dragged.isTeacher) {
                zone.style.backgroundColor = dragged.color;
                zone.innerHTML = `<div style="font-weight:900;">${dragged.text}</div><div class="t-cont"></div>`;
            } else {
                const cont = zone.querySelector('.t-cont');
                if(cont) cont.innerHTML += `<span class="teacher-chip">${dragged.text}</span>`;
            }
            saveToFirebase();
        };
        // Slett ved klikk
        zone.onclick = () => { zone.innerHTML = ""; zone.style.backgroundColor = ""; saveToFirebase(); };
    });
}

async function saveToFirebase() {
    const cells = Array.from(document.querySelectorAll('#tableBody .drop-zone')).map(td => ({
        id: td.id, html: td.innerHTML, bg: td.style.backgroundColor
    }));
    await setDoc(doc(db, "ukeplaner", store.currentClass), { 
        cells, subjects: store.subjects, teachers: store.teachers 
    });
}

function loadFromFirebase() {
    onSnapshot(doc(db, "ukeplaner", store.currentClass), (doc) => {
        if(doc.exists()) {
            const data = doc.data();
            store.subjects = data.subjects || [];
            store.teachers = data.teachers || [];
            updateLists();
            data.cells.forEach(c => {
                const el = document.getElementById(c.id);
                if(el) { el.innerHTML = c.html; el.style.backgroundColor = c.bg; }
            });
        }
    });
}
