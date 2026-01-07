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

const slots = [{t:"08:30-09:15"}, {t:"09:15-10:00"}, {t:"10:00-10:15", p:"PAUSE"}, {t:"10:15-11:00"}, {t:"11:00-11:45"}, {t:"11:45-12:15", p:"LUNSJ"}, {t:"12:15-13:00"}, {t:"13:00-13:45"}, {t:"13:45-14:00", p:"PAUSE"}, {t:"14:00-14:45"}, {t:"14:45-15:30"}];

let currentPlanId = "9A";
let dragData = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
            document.getElementById('adminSaveBtn').style.display = 'inline-block';
        }
        initApp();
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});

function initApp() {
    renderTable();
    loadSyncData();
    setupGlobalEvents();
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "";
    slots.forEach((slot, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="time-cell">${slot.t}</td>`;
        if (slot.p) tr.innerHTML += `<td colspan="5" style="background:#f1f5f9; font-weight:900;">${slot.p}</td>`;
        else {
            for (let j=0; j<5; j++) {
                tr.innerHTML += `<td id="cell-${i}-${j}" class="drop-zone"></td>`;
            }
        }
        tbody.appendChild(tr);
    });
    setupDragAndDrop();
}

function setupDragAndDrop() {
    document.querySelectorAll('.fag-item, .teacher-item').forEach(item => {
        item.ondragstart = (e) => {
            dragData = { text: e.target.innerText, bg: e.target.style.backgroundColor, type: e.target.classList.contains('fag-item') ? 'fag' : 'tea' };
        };
    });

    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.ondragover = (e) => e.preventDefault();
        zone.ondrop = (e) => {
            if (!dragData) return;
            if (dragData.type === 'fag') {
                zone.style.backgroundColor = dragData.bg;
                zone.innerHTML = `<div style="font-weight:900; text-transform:uppercase;">${dragData.text}</div><div class="teachers-cont"></div>`;
            } else {
                const cont = zone.querySelector('.teachers-cont');
                if (cont) cont.innerHTML += `<span class="teacher-chip">${dragData.text}</span>`;
            }
        };
    });
}

function loadSyncData() {
    onSnapshot(doc(db, "ukeplaner", "hovedplan"), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            data.cells.forEach(c => {
                const el = document.getElementById(c.id);
                if (el) {
                    el.innerHTML = c.html;
                    el.style.backgroundColor = c.bg;
                }
            });
        }
    });
}

function setupGlobalEvents() {
    document.getElementById('loginBtn').onclick = () => signInWithPopup(auth, provider);
    document.getElementById('adminSaveBtn').onclick = async () => {
        const cells = Array.from(document.querySelectorAll('.drop-zone')).map(td => ({ 
            id: td.id, 
            html: td.innerHTML,
            bg: td.style.backgroundColor 
        }));
        await setDoc(doc(db, "ukeplaner", "hovedplan"), { cells });
        alert("Lagret til skyen!");
    };
}
