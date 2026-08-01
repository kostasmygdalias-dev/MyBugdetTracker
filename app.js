// ==========================================
// ΜΕΡΟΣ 1: ΒΑΣΗ ΔΕΔΟΜΕΝΩΝ & ΔΙΑΧΕΙΡΙΣΗ ΠΑΓΙΩΝ
// ==========================================

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

addRecurringBtn.addEventListener('click', () => {
    const name = recurName.value;
    const amount = Number(recurAmount.value);
    const type = recurType.value;

    if (name === "" || amount <= 0) return alert("Συμπληρώστε σωστά τα στοιχεία του παγίου!");

    const newRecur = {
        id: Date.now(),
        name: name,
        amount: amount,
        type: type
    };

    recurringTemplates.push(newRecur);
    localStorage.setItem('quantum_recurring', JSON.stringify(recurringTemplates));
    
    recurName.value = "";
    recurAmount.value = "";
    updateDashboard();
});

addTransactionBtn.addEventListener('click', () => {
    const name = transName.value;
    const amount = Number(transAmount.value);
    const monthYearValue = transMonthYear.value;
    const typeValue = transType.value;

    if (name === "" || amount <= 0 || monthYearValue === "") return alert("Συμπληρώστε σωστά όλα τα στοιχεία!");

    const [yearPart, monthPart] = monthYearValue.split('-');
    const parsedMonthIndex = (parseInt(monthPart) - 1).toString();

    const newTransaction = {
        id: Date.now(),
        name: name,
        amount: amount,
        year: yearPart,
        month: parsedMonthIndex,
        type: typeValue,
        isAuto: false
    };

    transactions.push(newTransaction);
    localStorage.setItem('quantum_ledger', JSON.stringify(transactions));
    
    transName.value = "";
    transAmount.value = "";
    updateDashboard();
});

viewYear.addEventListener('change', updateDashboard);
viewMonth.addEventListener('change', updateDashboard);

window.deleteRecurring = function(id) {
    if(confirm("Κατάργηση αυτής της πάγιας εντολής για το μέλλον;")) {
        recurringTemplates = recurringTemplates.filter(r => r.id !== id);
        localStorage.setItem('quantum_recurring', JSON.stringify(recurringTemplates));
        updateDashboard();
    }
};

window.editRecurringPrice = function(id) {
    const newPrice = Number(prompt("Εισάγετε τη νέα τιμή για αυτή την πάγια εντολή (Δεν επηρεάζει το παρελθόν):"));
    if (isNaN(newPrice) || newPrice <= 0) return alert("Μη έγκυρη τιμή!");

    recurringTemplates = recurringTemplates.map(r => {
        if (r.id === id) return { ...r, amount: newPrice };
        return r;
    });

    localStorage.setItem('quantum_recurring', JSON.stringify(recurringTemplates));
    updateDashboard();
};

window.deleteTransaction = function(id) {
    if(confirm("Διαγραφή συναλλαγής;")) {
        transactions = transactions.filter(t => t.id !== id);
        localStorage.setItem('quantum_ledger', JSON.stringify(transactions));
        updateDashboard();
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
        recurAmount.focus(); // Στέλνει τον κέρσορα κατευθείαν στο ποσό του παγίου
    });
});

// Εκκίνηση της οθόνης κατά το πρώτο άνοιγμα
updateDashboard();
