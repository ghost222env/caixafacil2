/* ==========================================================================
   SUPABASE CONFIGURATION
   ========================================================================== */
// ATENÇÃO: Substitua os valores abaixo pelos dados do seu projeto Supabase
// A URL deve obrigatoriamente começar com https:// e não deve terminar com /rest/v1/
const SUPABASE_URL = 'https://ajqyzclckthgmboygpes.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqcXl6Y2xja3RoZ21ib3lncGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDM1MTEsImV4cCI6MjA5MzQxOTUxMX0.DUyI8JDc0SA5afyt9CQWGO-QJuHsaE4Dk3XIKOHYbJU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ==========================================================================
   STATE MANAGEMENT
   ========================================================================== */
const DEFAULT_CATEGORIES = ["Vendas", "Serviços", "Alimentação", "Água", "Luz", "Internet", "Salário", "Impostos", "Outros"];
const DEFAULT_SETTINGS = {
    companyName: "CaixaFácil",
    monthlyGoal: 5000,
    theme: "light"
};

// Global State
let loggedInUser = null; // auth.user
let currentUserProfile = null; // public.profiles
let users = []; // For Admin

let transactions = [];
let categories = [];
let settings = {};
let financialChartInstance = null;

// Initialization
async function initApp() {
    // Set theme from local storage
    const localTheme = localStorage.getItem('caixa_theme') || 'light';
    settings.theme = localTheme;
    applyTheme();
    
    const yearSpan = document.getElementById('current-year');
    if(yearSpan) yearSpan.textContent = new Date().getFullYear();
    
    // Check if Supabase is configured
    if(SUPABASE_URL === 'https://seu-projeto.supabase.co') {
        console.warn("Supabase não configurado. Por favor, insira suas credenciais no script.js.");
        showLandingScreen();
        return;
    }
    
    try {
        // Check Supabase Auth
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            loggedInUser = null;
            currentUserProfile = null;
            showLandingScreen();
        } else {
            loggedInUser = session.user;
            await loadSupabaseData();
            showAppScreen();
            renderAll();
        }
    } catch(err) {
        console.error("Erro ao conectar com Supabase:", err);
        showLandingScreen();
    }
}

async function loadSupabaseData() {
    try {
        // 1. Fetch Profile
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', loggedInUser.id).single();
        
        if (error || !profile) {
            console.error("Erro ao buscar perfil. A tabela profiles existe no Supabase?", error);
            currentUserProfile = null;
            return;
        }
        
        currentUserProfile = profile;
        
        if(profile.status === 'active') {
        // 2. Fetch Settings
        const { data: setts } = await supabase.from('settings').select('*').eq('user_id', loggedInUser.id).single();
        if(setts) {
            settings = { ...DEFAULT_SETTINGS, ...setts, theme: settings.theme };
        } else {
            settings = { ...DEFAULT_SETTINGS, theme: settings.theme };
            await supabase.from('settings').insert({
                user_id: loggedInUser.id,
                company_name: DEFAULT_SETTINGS.companyName,
                monthly_goal: DEFAULT_SETTINGS.monthlyGoal
            });
        }
        
        // 3. Fetch Categories
        const { data: cats } = await supabase.from('categories').select('*').eq('user_id', loggedInUser.id);
        if(cats && cats.length > 0) {
            categories = cats.map(c => c.name);
        } else {
            categories = [...DEFAULT_CATEGORIES];
            for(let c of DEFAULT_CATEGORIES) {
                await supabase.from('categories').insert({ user_id: loggedInUser.id, name: c });
            }
        }
        
        // 4. Fetch Transactions
        const { data: trans } = await supabase.from('transactions').select('*').eq('user_id', loggedInUser.id);
        transactions = trans || [];
        
        // 5. Admin fetches all users
        if(profile.role === 'admin') {
            const { data: allUsers } = await supabase.from('profiles').select('*');
            users = allUsers || [];
        }
    }
    } catch(err) {
        console.error("Erro fatal ao carregar dados do Supabase:", err);
        currentUserProfile = null;
    }
}
/* ==========================================================================
   DOM ELEMENTS
   ========================================================================== */
const landingScreen = document.getElementById('landing-screen');
const appScreen = document.getElementById('app-screen');
const sidebar = document.getElementById('sidebar');
const btnOpenSidebar = document.getElementById('btn-open-sidebar');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');
const navItems = document.querySelectorAll('.nav-item');
const appSections = document.querySelectorAll('.app-section');
const currentPageTitle = document.getElementById('current-page-title');
const adminOnlyElements = document.querySelectorAll('.admin-only');

const modalAuth = document.getElementById('modal-auth');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const authModalTitle = document.getElementById('auth-modal-title');
const btnLogout = document.getElementById('btn-logout');

const sidebarCompanyName = document.getElementById('sidebar-company-name');
const loggedUserName = document.getElementById('logged-user-name');
const loggedUserRole = document.getElementById('logged-user-role');
const btnThemeToggle = document.getElementById('btn-theme-toggle');

const modalTransaction = document.getElementById('modal-transaction');
const btnNewTransaction = document.getElementById('btn-new-transaction');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelTransaction = document.getElementById('btn-cancel-transaction');
const formTransaction = document.getElementById('form-transaction');

const transactionsTableBody = document.querySelector('#transactions-table tbody');
const payablesTableBody = document.querySelector('#payables-table tbody');
const receivablesTableBody = document.querySelector('#receivables-table tbody');
const categoriesList = document.getElementById('categories-list');
const usersTableBody = document.querySelector('#users-table tbody');

const filterSearch = document.getElementById('filter-search');
const filterType = document.getElementById('filter-type');
const filterCategory = document.getElementById('filter-category');
const filterMonth = document.getElementById('filter-month');
const btnClearFilters = document.getElementById('btn-clear-filters');

/* ==========================================================================
   AUTHENTICATION & LAYOUT
   ========================================================================== */
function showLandingScreen() {
    landingScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
}

function showAppScreen() {
    if (!currentUserProfile) {
        alert("Erro fatal: Seu perfil não foi encontrado no banco de dados. Você já rodou o código SQL no painel do Supabase?");
        supabase.auth.signOut().then(() => {
            window.location.reload();
        });
        return;
    }

    landingScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    
    sidebarCompanyName.textContent = settings.companyName || settings.company_name || 'CaixaFácil';
    loggedUserName.textContent = currentUserProfile.name || 'Usuário';
    loggedUserRole.textContent = currentUserProfile.role === 'admin' ? 'Administrador' : 'Usuário';
    
    const now = new Date();
    filterMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    applyUserPermissions();
}

function applyUserPermissions() {
    adminOnlyElements.forEach(el => {
        if(currentUserProfile.role === 'admin') el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    if (currentUserProfile.status === 'pending') {
        navItems.forEach(item => item.classList.add('hidden'));
        document.querySelectorAll('.user-only-action').forEach(el => el.classList.add('hidden'));
        
        appSections.forEach(sec => {
            sec.classList.add('hidden');
            sec.classList.remove('active');
        });
        document.getElementById('section-pending').classList.remove('hidden');
        document.getElementById('section-pending').classList.add('active');
        currentPageTitle.textContent = 'Acesso Restrito';
    } else {
        navItems.forEach(item => {
            if(item.classList.contains('admin-only') && currentUserProfile.role !== 'admin') return;
            item.classList.remove('hidden');
        });
        document.querySelectorAll('.user-only-action').forEach(el => el.classList.remove('hidden'));
        navigateTo('section-dashboard', 'Dashboard');
    }
}

window.openAuthModal = function(view) {
    if(SUPABASE_URL === 'https://seu-projeto.supabase.co') {
        alert("⚠️ ATENÇÃO: Você precisa colocar a sua URL e Key do Supabase nas primeiras linhas do arquivo script.js para que o sistema funcione.");
        return;
    }
    modalAuth.classList.remove('hidden');
    switchAuthView(view);
};

window.closeAuthModal = function() {
    modalAuth.classList.add('hidden');
    formLogin.reset();
    formRegister.reset();
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('reg-error').classList.add('hidden');
};

window.switchAuthView = function(view) {
    if (view === 'login') {
        formLogin.classList.remove('hidden');
        formRegister.classList.add('hidden');
        authModalTitle.textContent = 'Entrar no CaixaFácil';
    } else {
        formLogin.classList.add('hidden');
        formRegister.classList.remove('hidden');
        authModalTitle.textContent = 'Criar Nova Conta';
    }
};

formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Aguarde...';
    
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const cpf = document.getElementById('reg-cpf').value.trim();
    const password = document.getElementById('reg-password').value;
    const errorEl = document.getElementById('reg-error');
    errorEl.classList.add('hidden');
    
    let role = 'user';
    let status = 'pending';
    if (email === 'jp14lopes07@gmail.com' && cpf === '19298299737') {
        role = 'admin';
        status = 'active';
    }
    
    const { data, error } = await supabase.auth.signUp({
        email, password
    });
    
    if (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Criar Conta';
        return;
    }
    
    if (data.user) {
        const { error: insertError } = await supabase.from('profiles').insert({
            id: data.user.id,
            name,
            email,
            cpf,
            role,
            status
        });
        
        if (insertError) {
            errorEl.textContent = "Erro ao salvar perfil no banco. Você rodou o SQL?";
            errorEl.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Criar Conta';
            return;
        }
        
        closeAuthModal();
        initApp();
    }
});

formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Aguarde...';
    
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.classList.add('hidden');
    
    const { error } = await supabase.auth.signInWithPassword({
        email, password
    });
    
    if (error) {
        errorEl.textContent = "E-mail ou senha inválidos.";
        errorEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Acessar Sistema';
        return;
    }
    
    closeAuthModal();
    initApp();
});

btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
    loggedInUser = null;
    currentUserProfile = null;
    showLandingScreen();
});

function applyTheme() {
    document.body.className = settings.theme === 'dark' ? 'dark-theme' : 'light-theme';
    const icon = btnThemeToggle.querySelector('i');
    if(settings.theme === 'dark') {
        icon.classList.remove('ph-moon');
        icon.classList.add('ph-sun');
    } else {
        icon.classList.remove('ph-sun');
        icon.classList.add('ph-moon');
    }
    if(financialChartInstance) renderChart();
}

btnThemeToggle.addEventListener('click', () => {
    settings.theme = settings.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('caixa_theme', settings.theme);
    applyTheme();
});

/* ==========================================================================
   NAVIGATION
   ========================================================================== */
function navigateTo(targetId, title) {
    navItems.forEach(item => {
        if(item.dataset.target === targetId) item.classList.add('active');
        else item.classList.remove('active');
    });

    appSections.forEach(section => {
        if(section.id === targetId) {
            section.classList.remove('hidden');
            section.classList.add('active');
        } else {
            section.classList.add('hidden');
            section.classList.remove('active');
        }
    });

    currentPageTitle.textContent = title;
    sidebar.classList.remove('open');
}

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(item.dataset.target, item.textContent.trim());
    });
});

btnOpenSidebar.addEventListener('click', () => sidebar.classList.add('open'));
btnCloseSidebar.addEventListener('click', () => sidebar.classList.remove('open'));

/* ==========================================================================
   FORMATTERS & HELPERS
   ========================================================================== */
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (dateString) => {
    if(!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
};

const getStatusBadge = (status) => {
    const badges = {
        paid: '<span class="badge badge-success">Pago/Recebido</span>',
        pending: '<span class="badge badge-warning">Pendente</span>',
        late: '<span class="badge badge-danger">Atrasado</span>'
    };
    return badges[status] || status;
};

const getMethodIcon = (method) => {
    const icons = {
        pix: '<i class="ph ph-qr-code"></i> Pix',
        money: '<i class="ph ph-money"></i> Dinheiro',
        card: '<i class="ph ph-credit-card"></i> Cartão',
        boleto: '<i class="ph ph-barcode"></i> Boleto'
    };
    return icons[method] || method;
};

/* ==========================================================================
   TRANSACTIONS LOGIC
   ========================================================================== */
function openTransactionModal(editId = null) {
    populateCategoryDropdowns();
    
    if (editId) {
        const t = transactions.find(t => t.id === editId);
        if (t) {
            document.getElementById('modal-title').textContent = 'Editar Transação';
            document.getElementById('trans-id').value = t.id;
            document.querySelector(`input[name="trans-type"][value="${t.type}"]`).checked = true;
            document.getElementById('trans-desc').value = t.description;
            document.getElementById('trans-amount').value = t.amount;
            document.getElementById('trans-date').value = t.date;
            document.getElementById('trans-category').value = t.category;
            document.getElementById('trans-method').value = t.paymentMethod;
            document.getElementById('trans-status').value = t.status;
            document.getElementById('trans-notes').value = t.notes || '';
        }
    } else {
        document.getElementById('modal-title').textContent = 'Nova Transação';
        formTransaction.reset();
        document.getElementById('trans-id').value = '';
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        document.getElementById('trans-date').value = `${yyyy}-${mm}-${dd}`;
    }
    
    modalTransaction.classList.remove('hidden');
}

function closeTransactionModal() {
    modalTransaction.classList.add('hidden');
    formTransaction.reset();
}

window.openPayableModal = function() {
    openTransactionModal();
    document.getElementById('modal-title').textContent = 'Nova Conta a Pagar';
    document.querySelector('input[name="trans-type"][value="expense"]').checked = true;
    document.getElementById('trans-status').value = 'pending';
};

window.openReceivableModal = function() {
    openTransactionModal();
    document.getElementById('modal-title').textContent = 'Nova Conta a Receber';
    document.querySelector('input[name="trans-type"][value="income"]').checked = true;
    document.getElementById('trans-status').value = 'pending';
};

btnNewTransaction.addEventListener('click', () => openTransactionModal());
btnCloseModal.addEventListener('click', closeTransactionModal);
btnCancelTransaction.addEventListener('click', closeTransactionModal);

formTransaction.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-transaction') || e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    
    const id = document.getElementById('trans-id').value;
    const type = document.querySelector('input[name="trans-type"]:checked').value;
    
    const transactionData = {
        user_id: loggedInUser.id,
        type: type,
        description: document.getElementById('trans-desc').value.trim(),
        amount: parseFloat(document.getElementById('trans-amount').value),
        date: document.getElementById('trans-date').value,
        category: document.getElementById('trans-category').value,
        payment_method: document.getElementById('trans-method').value,
        status: document.getElementById('trans-status').value,
        notes: document.getElementById('trans-notes').value.trim()
    };
    
    if (id) {
        await supabase.from('transactions').update(transactionData).eq('id', id);
    } else {
        await supabase.from('transactions').insert(transactionData);
    }
    
    await loadSupabaseData(); // Refetch
    btn.disabled = false;
    btn.textContent = originalText;
    closeTransactionModal();
    renderAll();
});

window.deleteTransaction = async function(id) {
    if(confirm('Tem certeza que deseja excluir esta transação?')) {
        await supabase.from('transactions').delete().eq('id', id);
        await loadSupabaseData();
        renderAll();
    }
};

window.markAsPaid = async function(id) {
    const t = transactions.find(t => t.id === id);
    if(t) {
        await supabase.from('transactions').update({ status: 'paid' }).eq('id', id);
        await loadSupabaseData();
        renderAll();
    }
};
window.editTransaction = openTransactionModal;

/* ==========================================================================
   RENDERING & ADMIN
   ========================================================================== */
function renderAll() {
    if(currentUserProfile.status === 'pending') return;
    
    populateCategoryDropdowns();
    renderDashboard();
    renderTransactionsTable();
    renderPayablesTable();
    renderReceivablesTable();
    renderReportsTable();
    renderCategoriesList();
    renderSettingsForm();
    
    if(currentUserProfile.role === 'admin') {
        renderUsersTable();
    }
}

// User Management (Admin)
function renderUsersTable() {
    if(!usersTableBody) return;
    
    usersTableBody.innerHTML = users.map(u => {
        const statusBadge = u.status === 'active' 
            ? '<span class="badge badge-success">Ativo</span>' 
            : '<span class="badge badge-warning">Pendente</span>';
            
        const roleBadge = u.role === 'admin'
            ? '<span class="badge badge-info">Admin</span>'
            : '<span class="badge badge-neutral">Usuário</span>';
            
        let actions = '';
        if(u.id !== loggedInUser.id) {
            if(u.status === 'pending') {
                actions += `<button class="btn-action approve" onclick="approveUser('${u.id}')" title="Aprovar Acesso"><i class="ph ph-check"></i></button>`;
            }
            actions += `<button class="btn-action delete" onclick="deleteUser('${u.id}')" title="Excluir Usuário"><i class="ph ph-trash"></i></button>`;
        } else {
            actions = '<span class="text-muted" style="font-size:0.8rem">Você</span>';
        }
        
        return `
            <tr>
                <td><strong>${u.name}</strong></td>
                <td>${u.email}</td>
                <td>${u.cpf}</td>
                <td>${statusBadge}</td>
                <td>${roleBadge}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}

window.approveUser = async function(id) {
    await supabase.from('profiles').update({ status: 'active' }).eq('id', id);
    await loadSupabaseData();
    renderUsersTable();
};

window.deleteUser = async function(id) {
    if(confirm('Atenção: Tem certeza que deseja remover este usuário permanentemente?')) {
        await supabase.from('profiles').delete().eq('id', id);
        await loadSupabaseData();
        renderUsersTable();
    }
};

function populateCategoryDropdowns() {
    const selects = [document.getElementById('trans-category'), filterCategory];
    selects.forEach(select => {
        if(!select) return;
        let html = '';
        if (select.id === 'filter-category') html += '<option value="all">Todas Categorias</option>';
        categories.forEach(cat => {
            html += `<option value="${cat}">${cat}</option>`;
        });
        select.innerHTML = html;
    });
}

[filterSearch, filterType, filterCategory, filterMonth].forEach(input => {
    input.addEventListener('input', renderTransactionsTable);
});

btnClearFilters.addEventListener('click', () => {
    filterSearch.value = '';
    filterType.value = 'all';
    filterCategory.value = 'all';
    const now = new Date();
    filterMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    renderTransactionsTable();
});

function getFilteredTransactions() {
    const search = filterSearch.value.toLowerCase();
    const type = filterType.value;
    const cat = filterCategory.value;
    const monthYear = filterMonth.value;
    
    return transactions.filter(t => {
        const matchSearch = t.description.toLowerCase().includes(search) || (t.notes && t.notes.toLowerCase().includes(search));
        const matchType = type === 'all' || t.type === type;
        const matchCat = cat === 'all' || t.category === cat;
        const matchDate = !monthYear || t.date.startsWith(monthYear);
        return matchSearch && matchType && matchCat && matchDate;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function generateTableRow(t, isPending = false) {
    const isIncome = t.type === 'income';
    const amountClass = isIncome ? 'income-text' : 'expense-text';
    const amountPrefix = isIncome ? '+ ' : '- ';
    
    let actionsHTML = '';
    if (isPending) {
        actionsHTML += `<button class="btn-action approve" onclick="markAsPaid('${t.id}')" title="Marcar como Pago/Recebido"><i class="ph ph-check-circle" style="color: var(--success);"></i></button>`;
    }
    actionsHTML += `
        <button class="btn-action edit" onclick="editTransaction('${t.id}')" title="Editar"><i class="ph ph-pencil-simple"></i></button>
        <button class="btn-action delete" onclick="deleteTransaction('${t.id}')" title="Excluir"><i class="ph ph-trash"></i></button>
    `;
    
    return `
        <tr>
            <td>${formatDate(t.date)}</td>
            <td>
                <strong>${t.description}</strong>
                ${t.notes ? `<br><small class="text-muted">${t.notes}</small>` : ''}
            </td>
            <td><span class="badge badge-neutral">${t.category}</span></td>
            <td class="${amountClass}"><strong>${amountPrefix}${formatCurrency(t.amount)}</strong></td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    ${getStatusBadge(t.status)}
                    <span class="payment-method">${getMethodIcon(t.payment_method || t.paymentMethod)}</span>
                </div>
            </td>
            <td>
                ${actionsHTML}
            </td>
        </tr>
    `;
}

function renderTransactionsTable() {
    const filtered = getFilteredTransactions();
    const emptyState = document.getElementById('transactions-empty');
    const table = document.getElementById('transactions-table');
    
    if (filtered.length === 0) {
        table.classList.add('hidden');
        emptyState.classList.remove('hidden');
    } else {
        table.classList.remove('hidden');
        emptyState.classList.add('hidden');
        transactionsTableBody.innerHTML = filtered.map(t => generateTableRow(t, false)).join('');
    }
}

function renderPayablesTable() {
    const payables = transactions.filter(t => 
        t.type === 'expense' && (t.status === 'pending' || t.status === 'late')
    ).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const emptyState = document.getElementById('payables-empty');
    const table = document.getElementById('payables-table');
    
    if (payables.length === 0) {
        table.classList.add('hidden');
        emptyState.classList.remove('hidden');
    } else {
        table.classList.remove('hidden');
        emptyState.classList.add('hidden');
        payablesTableBody.innerHTML = payables.map(t => generateTableRow(t, true)).join('');
    }
}

function renderReceivablesTable() {
    const receivables = transactions.filter(t => 
        t.type === 'income' && (t.status === 'pending' || t.status === 'late')
    ).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const emptyState = document.getElementById('receivables-empty');
    const table = document.getElementById('receivables-table');
    
    if (receivables.length === 0) {
        table.classList.add('hidden');
        emptyState.classList.remove('hidden');
    } else {
        table.classList.remove('hidden');
        emptyState.classList.add('hidden');
        receivablesTableBody.innerHTML = receivables.map(t => generateTableRow(t, true)).join('');
    }
}

/* ==========================================================================
   DASHBOARD CALCULATIONS
   ========================================================================== */
function renderDashboard() {
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const todayPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const currentDay = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - currentDay);
    
    let totalIncome = 0;
    let totalExpense = 0;
    let monthIncome = 0;
    let monthExpense = 0;
    let dayBalance = 0;
    let weekBalance = 0;

    transactions.forEach(t => {
        const isPaid = t.status === 'paid';
        if (isPaid) {
            if (t.type === 'income') totalIncome += t.amount;
            if (t.type === 'expense') totalExpense += t.amount;
            
            if (t.date.startsWith(currentMonthPrefix)) {
                if (t.type === 'income') monthIncome += t.amount;
                if (t.type === 'expense') monthExpense += t.amount;
            }
            
            if (t.date === todayPrefix) {
                if (t.type === 'income') dayBalance += t.amount;
                if (t.type === 'expense') dayBalance -= t.amount;
            }
            
            const tDate = new Date(t.date);
            if (tDate >= startOfWeek && tDate <= now) {
                if (t.type === 'income') weekBalance += t.amount;
                if (t.type === 'expense') weekBalance -= t.amount;
            }
        }
    });

    const currentBalance = totalIncome - totalExpense;

    document.getElementById('dash-income').textContent = formatCurrency(monthIncome);
    document.getElementById('dash-expense').textContent = formatCurrency(monthExpense);
    document.getElementById('dash-balance').textContent = formatCurrency(currentBalance);
    document.getElementById('dash-summary-day').textContent = formatCurrency(dayBalance);
    document.getElementById('dash-summary-week').textContent = formatCurrency(weekBalance);
    
    const alertDeficit = document.getElementById('alert-deficit');
    if (monthExpense > monthIncome && monthExpense > 0) {
        alertDeficit.classList.remove('hidden');
    } else {
        alertDeficit.classList.add('hidden');
    }

    const goalTarget = parseFloat(settings.monthlyGoal) || parseFloat(settings.monthly_goal) || 0;
    document.getElementById('dash-goal-target').textContent = formatCurrency(goalTarget);
    document.getElementById('dash-goal-current').textContent = formatCurrency(monthIncome);
    
    let progress = 0;
    if (goalTarget > 0) {
        progress = (monthIncome / goalTarget) * 100;
        if (progress > 100) progress = 100;
    }
    
    document.getElementById('dash-goal-progress').style.width = `${progress}%`;
    document.getElementById('dash-goal-percent').textContent = `${progress.toFixed(1)}%`;
    
    if(progress === 100) {
        document.getElementById('dash-goal-progress').style.backgroundColor = 'var(--success)';
    } else {
        document.getElementById('dash-goal-progress').style.backgroundColor = 'var(--primary)';
    }

    renderChart();
}

function renderChart() {
    const ctx = document.getElementById('financialChart');
    if (!ctx) return;

    const labels = [];
    const incomes = [];
    const expenses = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthName = d.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
        labels.push(monthName);
        
        let mInc = 0;
        let mExp = 0;
        
        transactions.forEach(t => {
            if (t.date.startsWith(monthStr) && t.status === 'paid') {
                if(t.type === 'income') mInc += t.amount;
                if(t.type === 'expense') mExp += t.amount;
            }
        });
        
        incomes.push(mInc);
        expenses.push(mExp);
    }

    const isDark = settings.theme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#6b7280';
    const gridColor = isDark ? '#334155' : '#e5e7eb';
    const colorSuccess = isDark ? '#34d399' : '#10b981';
    const colorDanger = isDark ? '#f87171' : '#ef4444';

    if (financialChartInstance) {
        financialChartInstance.destroy();
    }

    financialChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Entradas', data: incomes, backgroundColor: colorSuccess, borderRadius: 4 },
                { label: 'Saídas', data: expenses, backgroundColor: colorDanger, borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: textColor } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += formatCurrency(context.parsed.y);
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: textColor }, grid: { display: false } },
                y: { ticks: { color: textColor, callback: function(value) { return 'R$ ' + value; } }, grid: { color: gridColor, borderDash: [5, 5] } }
            }
        }
    });
}

function renderReportsTable() {
    const tableBody = document.querySelector('#reports-table tbody');
    if(!tableBody) return;
    
    const monthData = {};
    
    transactions.forEach(t => {
        if(t.status !== 'paid') return;
        const monthYear = t.date.substring(0, 7);
        if(!monthData[monthYear]) {
            monthData[monthYear] = { income: 0, expense: 0 };
        }
        if(t.type === 'income') monthData[monthYear].income += t.amount;
        if(t.type === 'expense') monthData[monthYear].expense += t.amount;
    });
    
    const sortedMonths = Object.keys(monthData).sort().reverse();
    
    if(sortedMonths.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhum dado financeiro consolidado encontrado.</td></tr>';
        return;
    }
    
    tableBody.innerHTML = sortedMonths.map(month => {
        const data = monthData[month];
        const balance = data.income - data.expense;
        const balanceClass = balance >= 0 ? 'income-text' : 'expense-text';
        
        const [year, m] = month.split('-');
        const dateObj = new Date(year, m - 1, 1);
        const monthName = dateObj.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        
        return `
            <tr>
                <td style="text-transform: capitalize;"><strong>${monthName}</strong></td>
                <td class="income-text">+ ${formatCurrency(data.income)}</td>
                <td class="expense-text">- ${formatCurrency(data.expense)}</td>
                <td class="${balanceClass}"><strong>${formatCurrency(balance)}</strong></td>
            </tr>
        `;
    }).join('');
}

/* ==========================================================================
   CATEGORIES CRUD
   ========================================================================== */
const formCategory = document.getElementById('form-category');
const catNameInput = document.getElementById('cat-name');

formCategory.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newCat = catNameInput.value.trim();
    
    if (newCat && !categories.includes(newCat)) {
        await supabase.from('categories').insert({ user_id: loggedInUser.id, name: newCat });
        catNameInput.value = '';
        await loadSupabaseData();
        renderAll();
    } else if (categories.includes(newCat)) {
        alert('Esta categoria já existe!');
    }
});

window.deleteCategory = async function(catName) {
    const isUsed = transactions.some(t => t.category === catName);
    if (isUsed) {
        alert('Não é possível excluir esta categoria pois existem transações vinculadas a ela.');
        return;
    }
    
    if(confirm(`Excluir a categoria "${catName}"?`)) {
        await supabase.from('categories').delete().eq('user_id', loggedInUser.id).eq('name', catName);
        await loadSupabaseData();
        renderAll();
    }
};

function renderCategoriesList() {
    if(!categoriesList) return;
    categoriesList.innerHTML = categories.map(cat => `
        <li class="category-item">
            <span class="badge badge-neutral">${cat}</span>
            <button class="btn-action delete" onclick="deleteCategory('${cat}')" title="Excluir"><i class="ph ph-trash"></i></button>
        </li>
    `).join('');
}

/* ==========================================================================
   SETTINGS & DATA MANAGEMENT
   ========================================================================== */
const formSettings = document.getElementById('form-settings');
const inputCompanyName = document.getElementById('set-company-name');
const inputGoal = document.getElementById('set-goal');

function renderSettingsForm() {
    inputCompanyName.value = settings.company_name || settings.companyName;
    inputGoal.value = settings.monthly_goal || settings.monthlyGoal;
}

formSettings.addEventListener('submit', async (e) => {
    e.preventDefault();
    const companyName = inputCompanyName.value.trim();
    const monthlyGoal = parseFloat(inputGoal.value);
    
    await supabase.from('settings').update({
        company_name: companyName,
        monthly_goal: monthlyGoal
    }).eq('user_id', loggedInUser.id);
    
    await loadSupabaseData();
    sidebarCompanyName.textContent = settings.company_name || settings.companyName;
    alert('Configurações salvas com sucesso no banco de dados!');
    renderDashboard();
});

function exportCSV() {
    if(transactions.length === 0) {
        alert('Nenhum dado para exportar.');
        return;
    }
    
    const headers = ['ID', 'Tipo', 'Data', 'Descricao', 'Categoria', 'Valor', 'Metodo', 'Status', 'Observacoes'];
    const csvRows = [];
    csvRows.push(headers.join(','));
    
    transactions.forEach(t => {
        const values = [
            t.id, t.type === 'income' ? 'Entrada' : 'Saida', t.date,
            `"${t.description.replace(/"/g, '""')}"`, `"${t.category}"`,
            t.amount, t.payment_method || t.paymentMethod, t.status, `"${(t.notes || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(values.join(','));
    });
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const compName = settings.company_name || settings.companyName || 'Extrato';
    link.setAttribute('download', `extrato_${compName.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
const btnExportReports = document.getElementById('btn-export-csv-reports');
if(btnExportReports) btnExportReports.addEventListener('click', exportCSV);

document.getElementById('btn-clear-data').addEventListener('click', async () => {
    const confirmation = prompt('Atenção: Isso apagará TODOS os seus dados do banco (Transações e Categorias).\nDigite "APAGAR TUDO" para confirmar:');
    if (confirmation === 'APAGAR TUDO') {
        await supabase.from('transactions').delete().eq('user_id', loggedInUser.id);
        await supabase.from('categories').delete().eq('user_id', loggedInUser.id);
        alert('Seus dados foram apagados com sucesso no banco.');
        window.location.reload();
    }
});

// Boot
document.addEventListener('DOMContentLoaded', initApp);
