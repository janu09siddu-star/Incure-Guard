// ==========================================
// INSUREGUARD
// SMART INSURANCE AND FRAUD DETECTION SYSTEM
// FRONTEND JAVASCRIPT - MYSQL CONNECTED
// ==========================================

const API = "http://localhost:5000/api";

let customers = [];
let policies = [];
let claims = [];
let assessments = [];
let alerts = [];
let decisions = [];

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 0
    });
}

function sameId(a, b) {
    return String(a) === String(b);
}

function getCustomerName(customerId) {
    const customer = customers.find(item => sameId(item.id, customerId));
    return customer ? customer.name : "Unknown Customer";
}

function getPolicy(policyId) {
    return policies.find(item => sameId(item.id, policyId));
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) {
        console.log(message);
        return;
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2500);
}

function emptyRow(columns, message) {
    return `<tr><td colspan="${columns}" class="empty-message">${escapeHTML(message)}</td></tr>`;
}

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    let data = {};
    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(data.message || `Request failed (${response.status})`);
    }
    return data;
}

function pageError(error) {
    console.error(error);
    showToast(error.message || "Something went wrong. Please try again.");
}

// ==========================================
// PAGE NAVIGATION
// ==========================================

const pageTitles = {
    dashboard: "Dashboard",
    customers: "Customer Management",
    policies: "Policy Management",
    claims: "Claim Management",
    fraud: "Fraud Detection",
    alerts: "Fraud Alerts",
    decisions: "Claim Decisions",
    reports: "Reports & Analytics"
};

const pageDescriptions = {
    dashboard: "Welcome to your insurance management system.",
    customers: "Manage registered insurance customers.",
    policies: "Create and manage insurance policies.",
    claims: "Submit and track insurance claims.",
    fraud: "Identify potentially suspicious claims.",
    alerts: "Review claims requiring investigation.",
    decisions: "Record administrator claim decisions.",
    reports: "View insurance statistics and reports."
};

function showPage(pageName) {
    const page = document.getElementById(pageName);
    if (!page) return;

    document.querySelectorAll(".page").forEach(section => {
        section.classList.remove("active-page");
    });
    page.classList.add("active-page");

    document.querySelectorAll(".nav-link").forEach(button => {
        button.classList.toggle("active", button.dataset.page === pageName);
    });

    const heading = document.getElementById("page-heading");
    const subheading = document.getElementById("page-subheading");
    if (heading) heading.textContent = pageTitles[pageName] || "";
    if (subheading) subheading.textContent = pageDescriptions[pageName] || "";

    refreshAll();
}

document.querySelectorAll(".nav-link").forEach(button => {
    button.addEventListener("click", () => showPage(button.dataset.page));
});

// ==========================================
// LOAD DATA FROM MYSQL
// ==========================================

async function loadApplicationData() {
    try {
        const [customerData, policyData, claimData] = await Promise.all([
            apiRequest("/customers"),
            apiRequest("/policies"),
            apiRequest("/claims")
        ]);

        customers = customerData;
        policies = policyData;
        claims = claimData.map(claim => ({
            ...claim,
            riskScore: 0,
            riskLevel: "Low",
            riskReason: "Not assessed yet"
        }));

        // Assess each claim using the backend.
        for (const claim of claims) {
            try {
                await apiRequest(`/fraud-detection/${claim.id}`, { method: "POST" });
            } catch (error) {
                console.error(`Risk assessment failed for claim ${claim.id}:`, error);
            }
        }

        const [assessmentData, alertData, decisionData] = await Promise.all([
            apiRequest("/fraud-assessments"),
            apiRequest("/fraud-alerts"),
            apiRequest("/claim-decisions")
        ]);

        assessments = assessmentData;
        alerts = alertData;
        decisions = decisionData;

        claims = claims.map(claim => {
            const assessment = assessments.find(item => sameId(item.claimId, claim.id));
            console.log("CLAIM:", claim.id, "ASSESSMENT:", assessment);
            return {
                ...claim,
                riskScore: assessment ? Number(assessment.riskScore) : 0,
                riskLevel: assessment ? assessment.riskLevel : "Low",
                riskReason: assessment ? assessment.riskReason : "Not assessed yet"
            };
        });

        refreshAll();
        console.log("InsureGuard data loaded from MySQL successfully.");
    } catch (error) {
        pageError(error);
        const message = document.getElementById("page-subheading");
        if (message) {
            message.textContent = "Unable to load data. Make sure the backend is running on port 5000.";
        }
    }
}

// ==========================================
// CUSTOMER MANAGEMENT
// ==========================================

const customerForm = document.getElementById("customerForm");

customerForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const name = document.getElementById("customerName").value.trim();
    const email = document.getElementById("customerEmail").value.trim();
    const phone = document.getElementById("customerPhone").value.trim();
    const address = document.getElementById("customerAddress").value.trim();

    if (!name || !email || !phone || !address) {
        showToast("Please fill in all customer details.");
        return;
    }

    if (!/^[0-9]{10}$/.test(phone)) {
        showToast("Enter a valid 10-digit phone number.");
        return;
    }

    if (customers.some(c => c.email.toLowerCase() === email.toLowerCase())) {
        showToast("This email is already registered.");
        return;
    }

    if (customers.some(c => c.phone === phone)) {
        showToast("This phone number is already registered.");
        return;
    }

    try {
        await apiRequest("/customers", {
            method: "POST",
            body: JSON.stringify({ name, email, phone, address })
        });

        customerForm.reset();
        await loadApplicationData();
        showToast("Customer added successfully!");
    } catch (error) {
        pageError(error);
    }
});

function renderCustomers(search = "") {
    const table = document.getElementById("customerTable");

    const filtered = customers.filter(customer => {
        const text = `${customer.id} ${customer.name} ${customer.email} ${customer.phone} ${customer.address}`.toLowerCase();
        return text.includes(search.toLowerCase());
    });

    if (!filtered.length) {
        table.innerHTML = emptyRow(6, "No customers found.");
        return;
    }

    table.innerHTML = filtered.map(customer => `
        <tr>
            <td>CUS${String(customer.id).padStart(5, "0")}</td>
            <td>${escapeHTML(customer.name)}</td>
            <td>${escapeHTML(customer.email)}</td>
            <td>${escapeHTML(customer.phone)}</td>
            <td>${escapeHTML(customer.address)}</td>
            <td>
                <button class="delete-btn" onclick="deleteCustomer(${Number(customer.id)})">
                    Delete
                </button>
            </td>
        </tr>
    `).join("");
}

async function deleteCustomer(id) {
    if (policies.some(policy => sameId(policy.customerId, id))) {
        showToast("Cannot delete: customer has linked policies.");
        return;
    }

    if (!confirm("Are you sure you want to delete this customer?")) return;

    try {
        await apiRequest(`/customers/${id}`, { method: "DELETE" });
        await loadApplicationData();
        showToast("Customer deleted successfully.");
    } catch (error) {
        pageError(error);
    }
}

document.getElementById("customerSearch").addEventListener("input", event => {
    renderCustomers(event.target.value);
});

// ==========================================
// CUSTOMER DROPDOWNS
// ==========================================

function updateCustomerDropdowns() {
    const policySelect = document.getElementById("policyCustomer");
    const claimSelect = document.getElementById("claimCustomer");

    const previousPolicyValue = policySelect.value;
    const previousClaimValue = claimSelect.value;

    const options = customers.map(customer => `
        <option value="${escapeHTML(customer.id)}">
            CUS${String(customer.id).padStart(5, "0")} - ${escapeHTML(customer.name)}
        </option>
    `).join("");

    policySelect.innerHTML = '<option value="">Select Customer</option>' + options;
    claimSelect.innerHTML = '<option value="">Select Customer</option>' + options;

    policySelect.value = previousPolicyValue;
    claimSelect.value = previousClaimValue;
}
// ==========================================
// POLICY MANAGEMENT
// ==========================================

const policyForm = document.getElementById("policyForm");

policyForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const customerId = document.getElementById("policyCustomer").value;
    const type = document.getElementById("policyType").value;
    const coverage = Number(document.getElementById("policyCoverage").value);
    const premium = Number(document.getElementById("policyPremium").value);
    const start = document.getElementById("policyStart").value;
    const end = document.getElementById("policyEnd").value;

    if (!customers.some(customer => sameId(customer.id, customerId))) {
        showToast("Please select a valid customer.");
        return;
    }

    if (coverage <= 0 || premium <= 0) {
        showToast("Amounts must be greater than zero.");
        return;
    }

    if (!start || !end || end <= start) {
        showToast("End date must be after start date.");
        return;
    }

    try {
        await apiRequest("/policies", {
            method: "POST",
            body: JSON.stringify({
                customerId: Number(customerId),
                type,
                coverage,
                premium,
                start,
                end
            })
        });

        policyForm.reset();
        await loadApplicationData();
        showToast("Insurance policy created successfully!");
    } catch (error) {
        pageError(error);
    }
});

function renderPolicies(search = "") {
    const table = document.getElementById("policyTable");

    const filtered = policies.filter(policy => {
        const text = `${policy.id} ${getCustomerName(policy.customerId)} ${policy.type}`.toLowerCase();
        return text.includes(search.toLowerCase());
    });

    if (!filtered.length) {
        table.innerHTML = emptyRow(7, "No policies found.");
        return;
    }

    table.innerHTML = filtered.map(policy => `
        <tr>
            <td>POL${String(policy.id).padStart(5, "0")}</td>
            <td>${escapeHTML(getCustomerName(policy.customerId))}</td>
            <td>${escapeHTML(policy.type)}</td>
            <td>${formatCurrency(policy.coverage)}</td>
            <td>${formatCurrency(policy.premium)}</td>
            <td>${escapeHTML(policy.start)} to ${escapeHTML(policy.end)}</td>
            <td>
                <button class="delete-btn" onclick="deletePolicy(${Number(policy.id)})">
                    Delete
                </button>
            </td>
        </tr>
    `).join("");
}

async function deletePolicy(id) {
    if (claims.some(claim => sameId(claim.policyId, id))) {
        showToast("Cannot delete: policy has linked claims.");
        return;
    }

    if (!confirm("Delete this policy?")) return;

    try {
        await apiRequest(`/policies/${id}`, { method: "DELETE" });
        await loadApplicationData();
        showToast("Policy deleted successfully.");
    } catch (error) {
        pageError(error);
    }
}

document.getElementById("policySearch").addEventListener("input", event => {
    renderPolicies(event.target.value);
});

// ==========================================
// POLICY DROPDOWN FOR CLAIMS
// ==========================================

function updatePolicyDropdown() {
    const customerId = document.getElementById("claimCustomer").value;
    const select = document.getElementById("claimPolicy");
    const previousValue = select.value;

    select.innerHTML = '<option value="">Select Policy</option>';

    const today = new Date().toISOString().split("T")[0];

    policies.filter(policy =>
        sameId(policy.customerId, customerId) &&
        policy.start <= today &&
        policy.end >= today
    ).forEach(policy => {
        const option = document.createElement("option");
        option.value = policy.id;
        option.textContent = `POL${String(policy.id).padStart(5, "0")} - ${policy.type}`;
        select.appendChild(option);
    });

    select.value = previousValue;
}

document.getElementById("claimCustomer").addEventListener("change", updatePolicyDropdown);

// ==========================================
// CLAIM MANAGEMENT
// ==========================================

const claimForm = document.getElementById("claimForm");

claimForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const customerId = document.getElementById("claimCustomer").value;
    const policyId = document.getElementById("claimPolicy").value;
    const amount = Number(document.getElementById("claimAmount").value);
    const date = document.getElementById("claimDate").value;
    const description = document.getElementById("claimDescription").value.trim();

    const policy = getPolicy(policyId);

    if (!customers.some(customer => sameId(customer.id, customerId))) {
        showToast("Please select a valid customer.");
        return;
    }

    if (!policy || !sameId(policy.customerId, customerId)) {
        showToast("Please select a valid policy.");
        return;
    }

    if (amount <= 0 || amount > Number(policy.coverage)) {
        showToast("Claim amount must be positive and within policy coverage.");
        return;
    }

    const today = new Date().toISOString().split("T")[0];

    if (!date || date > today) {
        showToast("Enter a valid incident date.");
        return;
    }

    if (date < policy.start || date > policy.end) {
        showToast("Incident date must fall within policy validity.");
        return;
    }

    if (!description) {
        showToast("Please enter a claim description.");
        return;
    }

    try {
        await apiRequest("/claims", {
            method: "POST",
            body: JSON.stringify({
                customerId: Number(customerId),
                policyId: Number(policyId),
                amount,
                date,
                description
            })
        });

        claimForm.reset();
        document.getElementById("claimPolicy").innerHTML =
            '<option value="">Select Policy</option>';

        await loadApplicationData();
        showToast("Claim submitted successfully!");
    } catch (error) {
        pageError(error);
    }
});

function renderClaims(search = "") {
    const table = document.getElementById("claimTable");

    const filtered = claims.filter(claim => {
        const text = `${claim.id} ${getCustomerName(claim.customerId)} ${claim.policyId} ${claim.status}`.toLowerCase();
        return text.includes(search.toLowerCase());
    });

    if (!filtered.length) {
        table.innerHTML = emptyRow(7, "No claims found.");
        return;
    }

    table.innerHTML = filtered.map(claim => `
        <tr>
            <td>CLM${String(claim.id).padStart(5, "0")}</td>
            <td>${escapeHTML(getCustomerName(claim.customerId))}</td>
            <td>POL${String(claim.policyId).padStart(5, "0")}</td>
            <td>${formatCurrency(claim.amount)}</td>
            <td>
                <strong>${Number(claim.riskScore ?? 0)}/100</strong>
                <br>
                <span class="badge badge-${String(claim.riskLevel || "Low").toLowerCase()}">
                    ${escapeHTML(claim.riskLevel || "Low")}
                </span>
            </td>
            <td>
                <span class="badge badge-${String(claim.status).toLowerCase().replace(/\s+/g, "-")}">
                    ${escapeHTML(claim.status)}
                </span>
            </td>
            <td>
                <button class="delete-btn" onclick="deleteClaim(${Number(claim.id)})">
                    Delete
                </button>
            </td>
        </tr>
    `).join("");
}

async function deleteClaim(id) {
    if (!confirm("Delete this claim record? Its linked assessment, alerts and decisions will also be deleted.")) {
        return;
    }

    try {
        await apiRequest(`/claims/${id}`, { method: "DELETE" });
        await loadApplicationData();
        showToast("Claim deleted successfully.");
    } catch (error) {
        pageError(error);
    }
}

document.getElementById("claimSearch").addEventListener("input", event => {
    renderClaims(event.target.value);
});

// ==========================================
// FRAUD DETECTION
// ==========================================

function renderFraud() {
    const table = document.getElementById("fraudTable");
    const flagged = claims.filter(claim => Number(claim.riskScore) >= 30);

    if (!flagged.length) {
        table.innerHTML = emptyRow(6, "No suspicious claims detected.");
    } else {
        table.innerHTML = flagged.map(claim => `
            <tr>
                <td>CLM${String(claim.id).padStart(5, "0")}</td>
                <td>${escapeHTML(getCustomerName(claim.customerId))}</td>
                <td>${formatCurrency(claim.amount)}</td>
                <td>${Number(claim.riskScore)}/100</td>
                <td>
                    <strong>${Number(claim.riskScore ?? 0)}/100</strong>
                    <br>
                    <span class="badge badge-${String(claim.riskLevel || "Low").toLowerCase()}">
                        ${escapeHTML(claim.riskLevel || "Low")}
                    </span>
                </td>
                <td>${escapeHTML(claim.riskReason)}</td>
            </tr>
        `).join("");
    }

    const flaggedElement = document.getElementById("fraudFlagged");
    const pendingElement = document.getElementById("fraudPending");
    const clearedElement = document.getElementById("fraudCleared");

    if (flaggedElement) flaggedElement.textContent = flagged.length;

    if (pendingElement) {
        pendingElement.textContent = flagged.filter(c => c.status === "Pending").length;
    }

    if (clearedElement) {
        clearedElement.textContent = flagged.filter(c =>
            c.status === "Approved" || c.status === "Rejected"
        ).length;
    }
}

// ==========================================
// FRAUD ALERTS
// ==========================================

function renderAlerts() {
    const container = document.getElementById("alertList");
    const openAlerts = alerts.filter(alert => alert.status === "Open");

    if (!openAlerts.length) {
        container.innerHTML = `
            <div class="panel">
                <h3>No Pending Fraud Alerts</h3>
                <p>There are currently no flagged claims awaiting review.</p>
            </div>`;
        return;
    }

    container.innerHTML = openAlerts.map(alert => {
        const claim = claims.find(item => sameId(item.id, alert.claimId));

        return `
            <div class="alert-card">
                <h3>⚠ Review Required - CLM${String(alert.claimId).padStart(5, "0")}</h3>
                <p>Customer: ${escapeHTML(claim ? getCustomerName(claim.customerId) : "Unknown Customer")}</p>
                <p>Claim Amount: ${formatCurrency(claim ? claim.amount : 0)}</p>
                <p>${escapeHTML(alert.message)}</p>
            </div>`;
    }).join("");
}

// ==========================================
// CLAIM DECISIONS
// ==========================================

function renderDecisions() {
    const table = document.getElementById("decisionTable");
    const pending = claims.filter(claim => claim.status === "Pending");

    if (!pending.length) {
        table.innerHTML = emptyRow(6, "No pending claims for review.");
        return;
    }

    table.innerHTML = pending.map(claim => `
        <tr>
            <td>CLM${String(claim.id).padStart(5, "0")}</td>
            <td>${escapeHTML(getCustomerName(claim.customerId))}</td>
            <td>${formatCurrency(claim.amount)}</td>
            <td>
            <strong>${Number(claim.riskScore)}/100</strong>
            <br>
            <span class="badge badge-${String(claim.riskLevel).toLowerCase()}">
                ${escapeHTML(claim.riskLevel)}
            </span>
            </td>
            <td>${escapeHTML(claim.riskReason)}</td>
            <td>
                <button class="action-btn approve-btn"
                    onclick="decideClaim(${Number(claim.id)}, 'Approved')">
                    Approve
                </button>
                <button class="action-btn reject-btn"
                    onclick="decideClaim(${Number(claim.id)}, 'Rejected')">
                    Reject
                </button>
            </td>
        </tr>
    `).join("");
}

async function decideClaim(id, decision) {
    const message = decision === "Approved"
        ? "Are you sure you want to approve this claim?"
        : "Are you sure you want to reject this claim?";

    if (!confirm(message)) return;

    const claim = claims.find(item => sameId(item.id, id));
    if (!claim) return;

    const remarks = claim.riskScore >= 30
        ? "Reviewed by administrator after risk assessment"
        : "Reviewed by administrator";

    try {
        await apiRequest("/claim-decisions", {
            method: "POST",
            body: JSON.stringify({
                claimId: Number(id),
                decision,
                remarks
            })
        });

        await loadApplicationData();
        showToast("Claim " + decision.toLowerCase() + " successfully.");
    } catch (error) {
        pageError(error);
    }
}
// ==========================================
// DASHBOARD STATISTICS
// ==========================================

function updateDashboard() {
    const totalCustomers = customers.length;
    const totalPolicies = policies.length;
    const totalClaims = claims.length;

    const approved = claims.filter(c => c.status === "Approved").length;
    const pending = claims.filter(c => c.status === "Pending").length;
    const suspicious = claims.filter(c => Number(c.riskScore) >= 30).length;

    document.getElementById("totalCustomers").textContent = totalCustomers;
    document.getElementById("totalPolicies").textContent = totalPolicies;
    document.getElementById("totalClaims").textContent = totalClaims;
    document.getElementById("approvedClaims").textContent = approved;
    document.getElementById("pendingClaims").textContent = pending;
    document.getElementById("suspiciousClaims").textContent = suspicious;

    const low = claims.filter(c => c.riskLevel === "Low").length;
    const medium = claims.filter(c => c.riskLevel === "Medium").length;
    const high = claims.filter(c => c.riskLevel === "High").length;

    document.getElementById("lowRiskCount").textContent = low;
    document.getElementById("mediumRiskCount").textContent = medium;
    document.getElementById("highRiskCount").textContent = high;

    const total = Math.max(totalClaims, 1);

    document.getElementById("lowRiskBar").style.width =
        (low / total * 100) + "%";

    document.getElementById("mediumRiskBar").style.width =
        (medium / total * 100) + "%";

    document.getElementById("highRiskBar").style.width =
        (high / total * 100) + "%";

    const recentTable = document.getElementById("recentClaims");
    const recent = [...claims].slice(-5).reverse();

    if (!recent.length) {
        recentTable.innerHTML = emptyRow(4, "No claims submitted yet.");
    } else {
        recentTable.innerHTML = recent.map(claim => `
            <tr>
                <td>CLM${String(claim.id).padStart(5, "0")}</td>
                <td>${escapeHTML(getCustomerName(claim.customerId))}</td>
                <td>${formatCurrency(claim.amount)}</td>
                <td>
                    <span class="badge badge-${String(claim.status).toLowerCase().replace(/\s+/g, "-")}">
                        ${escapeHTML(claim.status)}
                    </span>
                </td>
            </tr>
        `).join("");
    }
}

// ==========================================
// REPORTS
// ==========================================

function updateReports() {
    document.getElementById("reportCustomers").textContent = customers.length;
    document.getElementById("reportPolicies").textContent = policies.length;
    document.getElementById("reportClaims").textContent = claims.length;

    const totalAmount = claims.reduce(
        (sum, claim) => sum + Number(claim.amount), 0
    );

    document.getElementById("reportAmount").textContent =
        formatCurrency(totalAmount);

    const approved = claims.filter(c => c.status === "Approved").length;
    const pending = claims.filter(c => c.status === "Pending").length;
    const rejected = claims.filter(c => c.status === "Rejected").length;
    const suspicious = claims.filter(c => Number(c.riskScore) >= 30).length;

    document.getElementById("reportSummary").innerHTML = `
        <div class="report-row">
            <span>Approved Claims</span><strong>${approved}</strong>
        </div>
        <div class="report-row">
            <span>Pending Claims</span><strong>${pending}</strong>
        </div>
        <div class="report-row">
            <span>Rejected Claims</span><strong>${rejected}</strong>
        </div>
        <div class="report-row">
            <span>Suspicious Claims</span><strong>${suspicious}</strong>
        </div>
    `;
}

// ==========================================
// EXPORT CLAIMS AS CSV
// ==========================================

function exportClaims() {
    if (!claims.length) {
        showToast("There are no claims to export.");
        return;
    }

    const rows = [[
        "Claim ID",
        "Customer",
        "Policy ID",
        "Amount",
        "Incident Date",
        "Risk Score",
        "Risk Level",
        "Risk Reason",
        "Status"
    ]];

    claims.forEach(claim => {
        rows.push([
            `CLM${String(claim.id).padStart(5, "0")}`,
            getCustomerName(claim.customerId),
            `POL${String(claim.policyId).padStart(5, "0")}`,
            claim.amount,
            claim.date,
            claim.riskScore,
            claim.riskLevel,
            claim.riskReason,
            claim.status
        ]);
    });

    const csv = rows.map(row =>
        row.map(value =>
            '"' + String(value ?? "").replace(/"/g, '""') + '"'
        ).join(",")
    ).join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "InsureGuard_Claims_Report.csv";
    link.click();

    URL.revokeObjectURL(url);
    showToast("Claims report exported successfully.");
}

// ==========================================
// REFRESH ALL MODULES
// ==========================================

function refreshAll() {
    updateCustomerDropdowns();
    updatePolicyDropdown();

    renderCustomers(document.getElementById("customerSearch").value);
    renderPolicies(document.getElementById("policySearch").value);
    renderClaims(document.getElementById("claimSearch").value);

    renderFraud();
    renderAlerts();
    renderDecisions();

    updateDashboard();
    updateReports();
}

// ==========================================
// START APPLICATION
// ==========================================

document.addEventListener("DOMContentLoaded", async function() {
    refreshAll();
    showPage("dashboard");

    await loadApplicationData();

    console.log("InsureGuard frontend initialized.");
});