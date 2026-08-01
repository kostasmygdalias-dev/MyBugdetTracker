// ==========================================
// ΜΕΡΟΣ 1: ΑΥΤΟΜΑΤΟΣ ΣΥΓΧΡΟΝΙΣΜΟΣ GOOGLE DRIVE
// ==========================================

// Ενσωματωμένο το δικό σου Google Client ID
const CLIENT_ID = "://googleusercontent.com";
const SCOPES = "https://googleapis.com";

let tokenClient;
let accessToken = null;
let driveFileId = null;

// Τα δεδομένα τρέχουν ακαριαία (0ms) τοπικά και συγχρονίζουν στο background
let transactions = JSON.parse(localStorage.getItem('quantum_ledger')) || [];
let recurringTemplates = JSON.parse(localStorage.getItem('quantum_recurring')) || [];

const transName = document.getElementById('transName');
const transAmount = document.getElementById('transAmount');
const transMonthYear = document.getElementById('transMonthYear');
const transType = document.getElementById('transType');
const addTransactionBtn = document.getElementById('addTransactionBtn');
const transactionList = document.getElementById('transactionList');
const recurName = document.getElementById('recurName');
const recurAmount = document.getElementById('recurAmount');
const recurType = document.getElementById('recurType');
const addRecurringBtn = document.getElementById('addRecurringBtn');
const recurringList = document.getElementById('recurringList');
const viewYear = document.getElementById('viewYear');
const viewMonth = document.getElementById('viewMonth');

const now = new Date();
transMonthYear.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

function saveToLocalStorage() {
    localStorage.setItem('quantum_ledger', JSON.stringify(transactions));
    localStorage.setItem('quantum_recurring', JSON.stringify(recurringTemplates));
}

// 🔐 ΑΥΤΟΜΑΤΗ ΕΚΚΙΝΗΣΗ & ΣΥΝΔΕΣΗ ΜΕ GOOGLE
window.onload = function () {
    try {
        gapi.load('client', async () => {
            await gapi.client.init({ discoveryDocs: ["https://googleapis.com"] });
        });
        
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: async (resp) => {
                if (resp.error) return;
                accessToken = resp.access_token;
                // Αποθηκεύουμε το token τοπικά για να μην ξαναρωτάει
                localStorage.setItem('drive_access_token', accessToken);
                await syncWithGoogleDrive();
            },
        });

        // 🔄 SILENT LOGIN: Αν ο χρήστης έχει ξαναμπει, ζητάει token αθόρυβα χωρίς παράθυρο!
        const savedToken = localStorage.getItem('drive_access_token');
        if (savedToken) {
            accessToken = savedToken;
            gapi.client.setToken({ access_token: accessToken });
            await syncWithGoogleDrive();
        } else {
            // Αν είναι η πρώτη φορά, ζητάει έγκριση αμέσως μόλις ανοίξει η σελίδα
            tokenClient.requestAccessToken({ prompt: 'none' });
        }
    } catch (e) {
        console.log("Offline mode active.");
    }
};

// ☁️ ΜΗΧΑΝΙΣΜΟΣ ΠΑΡΑΛΛΗΛΟΥ ΣΥΓΧΡΟΝΙΣΜΟΥ
async function syncWithGoogleDrive() {
    if (!accessToken) return;
    try {
        let res = await gapi.client.drive.files.list({
            q: "name='quantum_budget_data.json'",
            spaces: 'appDataFolder',
            fields: 'files(id)'
        });
        
        let files = res.result.files;
        let cloudData = null;

        if (files && files.length > 0) {
            driveFileId = files[0].id;
            let fileContent = await gapi.client.drive.files.get({
                fileId: driveFileId,
                alt: 'media'
            });
            cloudData = fileContent.result;
        }

        if (cloudData) {
            // Αν το cloud έχει δεδομένα και η συσκευή είναι άδεια, τραβάει του cloud
            if (transactions.length === 0 && cloudData.transactions) transactions = cloudData.transactions;
            if (recurringTemplates.length === 0 && cloudData.recurring) recurringTemplates = cloudData.recurring;
        }

        const boundary = 'foo_bar_baz';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";
        
        const metadata = {
            'name': 'quantum_budget_data.json',
            'parents': ['appDataFolder']
        };
        const data = { transactions, recurring: recurringTemplates };

        const multipartRequestBody =
            delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) + delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(data) + close_delim;

        if (driveFileId) {
            await gapi.client.request({
                'path': '/upload/drive/v3/files/' + driveFileId,
                'method': 'PATCH',
                'params': {'uploadType': 'multipart'},
                'headers': {'Content-Type': 'multipart/related; boundary="' + boundary + '"'},
                'body': multipartRequestBody
            });
        } else {
            let createRes = await gapi.client.request({
                'path': '/upload/drive/v3/files',
                'method': 'POST',
                'params': {'uploadType': 'multipart'},
                'headers': {'Content-Type': 'multipart/related; boundary="' + boundary + '"'},
                'body': multipartRequestBody
            });
            driveFileId = createRes.result.id;
        }

        saveToLocalStorage();
        updateDashboard();
    } catch (e) {
        // Αν το token έληξε, ζητάει ανανέωση αθόρυβα
        if(e.status === 401 && tokenClient) {
            tokenClient.requestAccessToken({ prompt: 'none' });
        }
    }
}

// Προσθήκη Πάγιας Εντολής
addRecurringBtn.addEventListener('click', async () => {
    const name = recurName.value;
    const amount = Number(recurAmount.value);
    const type = recurType.value;
    if (name === "" || amount <= 0) return alert("Συμπληρώστε σωστά τα στοιχεία!");

    recurringTemplates.push({ id: Date.now(), name, amount, type });
    saveToLocalStorage();
    recurName.value = "";
    recurAmount.value = "";
    updateDashboard();
    await syncWithGoogleDrive();
});

// Προσθήκη Συναλλαγής
addTransactionBtn.addEventListener('click', async () => {
    const name = transName.value;
    const amount = Number(transAmount.value);
    const monthYearValue = transMonthYear.value;
    const typeValue = transType.value;
    if (name === "" || amount <= 0 || monthYearValue === "") return alert("Συμπληρώστε όλα τα στοιχεία!");

    const [yearPart, monthPart] = monthYearValue.split('-');
    const parsedMonthIndex = (parseInt(monthPart) - 1).toString();

    transactions.push({ id: Date.now(), name, amount, year: yearPart, month: parsedMonthIndex, type: typeValue });
    saveToLocalStorage();
    transName.value = "";
    transAmount.value = "";
    updateDashboard();
    await syncWithGoogleDrive();
});

viewYear.addEventListener('change', updateDashboard);
viewMonth.addEventListener('change', updateDashboard);

window.deleteRecurring = async function(id) {
    if(confirm("Κατάργηση αυτής της πάγιας εντολής;")) {
        recurringTemplates = recurringTemplates.filter(r => r.id !== id);
        saveToLocalStorage();
        updateDashboard();
        await syncWithGoogleDrive();
    }
};

window.editRecurringPrice = async function(id) {
    const newPrice = Number(prompt("Εισάγετε τη νέα τιμή:"));
    if (isNaN(newPrice) || newPrice <= 0) return alert("Μη έγκυρη τιμή!");
    recurringTemplates = recurringTemplates.map(r => r.id === id ? {...r, amount: newPrice} : r);
    saveToLocalStorage();
    updateDashboard();
    await syncWithGoogleDrive();
};

window.deleteTransaction = async function(id) {
    if(confirm("Διαγραφή συναλλαγής;")) {
        transactions = transactions.filter(t => t.id !== id);
        saveToLocalStorage();
        updateDashboard();
        await syncWithGoogleDrive();
    }
};
// ==========================================
// ΜΕΡΟΣ 2: ΜΗΧΑΝΗ ΥΠΟΛΟΓΙΣΜΩΝ & ΕΜΦΑΝΙΣΗ (UI)
// ==========================================

function updateDashboard() {
    const selectedYear = viewYear.value;
    const selectedMonth = viewMonth.value;

    let totalIncome = 0;
    let totalExpense = 0;
    let categoryTotals = { 
        'Φαγητό/Super Market': 0, 
        'Λογαριασμοί/Ενοίκιο': 0, 
        'Διασκέδαση/Ψώνια': 0, 
        'Άλλα/Διάφορα': 0 
    };

    // Σχεδίαση Λίστας Πάγιων Εντολών στην οθόνη
    recurringList.innerHTML = "";
    recurringTemplates.forEach(recur => {
        const li = document.createElement('li');
        li.className = "compact-li";
        li.innerHTML = `
            <span>🤖 ${recur.name}: <b>${recur.amount}€</b></span>
            <div>
                <button onclick="editRecurringPrice(${recur.id})" class="edit-btn" style="background:rgba(0,255,255,0.2); border:1px solid #00ffff; color:#00ffff; padding:2px 5px; font-size:9px; border-radius:3px; margin-right:4px;">Αλλαγή</button>
                <button onclick="deleteRecurring(${recur.id})" class="delete-btn">X</button>
            </div>
        `;
        recurringList.appendChild(li);
    });

    transactionList.innerHTML = "";
    const monthNames = ["Ιαν", "Φεβ", "Μάρ", "Απρ", "Μάι", "Ιούν", "Ιούλ", "Αύγ", "Σεπ", "Οκτ", "Νοέ", "Δεκ"];

    // Δημιουργούμε προσωρινή λίστα για να ενώσουμε κανονικά αρχεία και πάγια
    let activeList = [...transactions];

    // ΑΥΤΟΜΑΤΗ ΕΓΧΥΣΗ ΠΑΓΙΩΝ: Υπολογισμός και "γέννηση" των πάγιων στην οθόνη
    if (selectedMonth !== 'all') {
        recurringTemplates.forEach(recur => {
            activeList.push({
                id: 'recur-' + recur.id,
                name: `[Πάγιο] ${recur.name}`,
                amount: recur.amount,
                year: selectedYear,
                month: selectedMonth,
                type: recur.type,
                isAuto: true
            });
        });
    } else {
        // Αν βλέπουμε όλο το έτος, παράγουμε τα πάγια για όλους τους 12 μήνες
        for (let m = 0; m < 12; m++) {
            recurringTemplates.forEach(recur => {
                activeList.push({
                    id: 'recur-' + recur.id + '-' + m,
                    name: `[Πάγιο] ${recur.name}`,
                    amount: recur.amount,
                    year: selectedYear,
                    month: m.toString(),
                    type: recur.type,
                    isAuto: true
                });
            });
        }
    }

    // Φιλτράρισμα και επεξεργασία της ενιαίας λίστας
    activeList.forEach(trans => {
        const matchYear = trans.year === selectedYear;
        const matchMonth = (selectedMonth === 'all') || (trans.month === selectedMonth);

        if (matchYear && matchMonth) {
            if (trans.type === 'income') {
                totalIncome += trans.amount;
            } else {
                totalExpense += trans.amount;
                if (trans.type === 'expense-food') categoryTotals['Φαγητό/Super Market'] += trans.amount;
                if (trans.type === 'expense-bills') categoryTotals['Λογαριασμοί/Ενοίκιο'] += trans.amount;
                if (trans.type === 'expense-fun') categoryTotals['Διασκέδαση/Ψώνια'] += trans.amount;
                if (trans.type === 'expense-other') categoryTotals['Άλλα/Διάφορα'] += trans.amount;
            }

            const li = document.createElement('li');
            const isIncome = trans.type === 'income';
            li.style.borderLeft = isIncome ? "4px solid #00ff88" : "4px solid #ff0055";
            if(trans.isAuto) li.style.background = "rgba(0, 255, 255, 0.02)"; 

            li.innerHTML = `
                <div>
                    <small style="color:#8a8a9e; display:block;">${monthNames[parseInt(trans.month)]} ${trans.year}</small>
                    <span>${trans.name}</span>
                </div>
                <div>
                    <b style="color: ${isIncome ? '#00ff88' : '#ff0055'}; margin-right:10px;">
                        ${isIncome ? '+' : '-'}${trans.amount}€
                    </b>
                    ${trans.isAuto ? '<span style="color:#00ffff; font-size:10px;">🤖 Auto</span>' : `<button onclick="deleteTransaction(${trans.id})" class="delete-btn">X</button>`}
                </div>
            `;
            transactionList.appendChild(li);
        }
    });

    // Υπολογισμός και εμφάνιση του Καθαρού Κέρδους
    const netProfit = totalIncome - totalExpense;
    document.getElementById('totalIncomeDisplay').textContent = totalIncome + "€";
    document.getElementById('totalExpenseDisplay').textContent = totalExpense + "€";
    document.getElementById('netProfitDisplay').textContent = netProfit + "€";
    document.getElementById('netProfitDisplay').style.color = netProfit >= 0 ? "#00ffff" : "#ff0055";

    // Σχεδίαση των στατιστικών μπαρών (Πού τα έφαγες)
    let analyticsHTML = "<h4>📊 Πού ξοδεύτηκαν τα χρήματα:</h4>";
    if (totalExpense === 0) {
        analyticsHTML += "<p style='margin:0;'>Δεν υπάρχουν έξοδα.</p>";
    } else {
        for (let cat in categoryTotals) {
            const catAmount = categoryTotals[cat];
            const percentage = ((catAmount / totalExpense) * 100).toFixed(0);
            if (catAmount > 0) {
                analyticsHTML += `
                    <div style="margin-bottom: 8px;">
                        <div style="display:flex; justify-content:space-between; font-size:11px;">
                            <span>${cat}</span>
                            <span><b>${catAmount}€</b> (${percentage}%)</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.05); border-radius:5px; height: 5px; width: 100%; margin-top:3px;">
                            <div style="background: linear-gradient(90deg, #ff007f, #00ffff); height: 100%; width: ${percentage}%; border-radius:5px;"></div>
                        </div>
                    </div>
                `;
            }
        }
    }
    document.getElementById('analyticsContent').innerHTML = analyticsHTML;
}

// Λειτουργία για την αυτόματη συμπλήρωση μέσω των Quick Tags (Μεμονωμένα)
document.querySelectorAll('.tag-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        transName.value = e.target.getAttribute('data-name');
        transType.value = e.target.getAttribute('data-category');
        transAmount.focus();
    });
});

// Λειτουργία για την αυτόματη συμπλήρωση μέσω των Quick Tags (Πάγια)
document.querySelectorAll('.recur-tag-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        recurName.value = e.target.getAttribute('data-name');
        recurType.value = e.target.getAttribute('data-category');
        recurAmount.focus();
    });
});

// Αρχική σχεδίαση με βάση ό,τι υπάρχει ήδη αποθηκευμένο τοπικά
updateDashboard();
