
// ==========================================
// ΜΕΡΟΣ 1: ΤΟΠΙΚΗ ΔΙΑΧΕΙΡΙΣΗ & ΣΥΓΧΡΟΝΙΣΜΟΣ CLOUD
// ==========================================

// Κλειδωμένα και σωστά συμπληρωμένα τα δικά σου στοιχεία Supabase
const SUPABASE_URL = "https://uyapnscadjnsdivmxeqt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YXBuc2NhZGpuc2Rpdm14ZXF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MDI0MzksImV4cCI6MjEwMTE3ODQzOX0.idM0d0LaAnYOhoOWurNRGh_G7rRR1EZBsmPHnzTpLJE";

let supabaseCloud = null;

// Σύνδεση με window.supabase λόγω χρήσης του τοπικού αρχείου (supabase-local.js)
try {
    if (typeof window.supabase !== 'undefined') {
        supabaseCloud = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) {
    console.log("Supabase library blocked by network. Running in local-only safety mode.");
}

// Φόρτωση δεδομένων ακαριαία από την τοπική μνήμη
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
const syncBtn = document.getElementById('syncBtn');

const now = new Date();
transMonthYear.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

function saveToLocalStorage() {
    localStorage.setItem('quantum_ledger', JSON.stringify(transactions));
    localStorage.setItem('quantum_recurring', JSON.stringify(recurringTemplates));
}

// Λειτουργία: Αυτόματο Κατέβασμα από το Cloud κατά την εκκίνηση
async function downloadFromCloud() {
    if (!supabaseCloud) return;
    try {
        const [ledgerRes, recurRes] = await Promise.all([
            supabaseCloud.from('quantum_ledger').select('*'),
            supabaseCloud.from('quantum_recurring').select('*')
        ]);

        if (!ledgerRes.error) transactions = ledgerRes.data || [];
        if (!recurRes.error) recurringTemplates = recurRes.data || [];

        saveToLocalStorage();
        updateDashboard();
    } catch (e) {
        console.log("Error auto-loading from cloud");
    }
}

// Λειτουργία: Χειροκίνητο κουμπί Συγχρονισμού
syncBtn.addEventListener('click', async () => {
    if (!supabaseCloud) {
        return alert("❌ Δεν υπάρχει σύνδεση με το Cloud αυτή τη στιγμή (Η βιβλιοθήκη Supabase είναι μπλοκαρισμένη από το δίκτυο).");
    }

    syncBtn.textContent = "⏳ ΣΥΓΧΡΟΝΙΣΜΟΣ...";
    syncBtn.style.opacity = "0.6";

    try {
        await supabaseCloud.from('quantum_ledger').delete().neq('id', 0);
        if (transactions.length > 0) {
            const cleanTransactions = transactions.filter(t => !t.isAuto).map(t => ({
                name: t.name, amount: t.amount, year: t.year, month: t.month, type: t.type
            }));
            await supabaseCloud.from('quantum_ledger').insert(cleanTransactions);
        }

        await supabaseCloud.from('quantum_recurring').delete().neq('id', 0);
        if (recurringTemplates.length > 0) {
            const cleanRecur = recurringTemplates.map(r => ({ name: r.name, amount: r.amount, type: r.type }));
            await supabaseCloud.from('quantum_recurring').insert(cleanRecur);
        }

        await downloadFromCloud();
        alert("✅ Ο συγχρονισμός ολοκληρώθηκε με επιτυχία!");
    } catch (e) {
        alert("❌ Σφάλμα δικτύου κατά το συγχρονισμό.");
    }

    syncBtn.textContent = "☁️ ΣΥΓΧΡΟΝΙΣΜΟΣ ΜΕ CLOUD";
    syncBtn.style.opacity = "1";
});

// Προσθήκη Πάγιας Εντολής (Τοπικά)
addRecurringBtn.addEventListener('click', () => {
    const name = recurName.value;
    const amount = Number(recurAmount.value);
    const type = recurType.value;
    if (name === "" || amount <= 0) return alert("Συμπληρώστε σωστά τα στοιχεία!");

    recurringTemplates.push({ id: Date.now(), name, amount, type });
    saveToLocalStorage();
    recurName.value = "";
    recurAmount.value = "";
    updateDashboard();
});

// Προσθήκη Συναλλαγής (Τοπικά)
addTransactionBtn.addEventListener('click', () => {
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
});

viewYear.addEventListener('change', updateDashboard);
viewMonth.addEventListener('change', updateDashboard);

window.deleteRecurring = function(id) {
    if(confirm("Κατάργηση αυτής της πάγιας εντολής;")) {
        recurringTemplates = recurringTemplates.filter(r => r.id !== id);
        saveToLocalStorage();
        updateDashboard();
    }
};

window.editRecurringPrice = function(id) {
    const newPrice = Number(prompt("Εισάγετε τη νέα τιμή:"));
    if (isNaN(newPrice) || newPrice <= 0) return alert("Μη έγκυρη τιμή!");
    recurringTemplates = recurringTemplates.map(r => r.id === id ? {...r, amount: newPrice} : r);
    saveToLocalStorage();
    updateDashboard();
};

window.deleteTransaction = function(id) {
    if(confirm("Διαγραφή συναλλαγής;")) {
        transactions = transactions.filter(t => t.id !== id);
        saveToLocalStorage();
        updateDashboard();
    }
};
