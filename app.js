const API_BASE = "http://localhost:5001/api";
const app = document.querySelector("#app");

let currentUser = JSON.parse(localStorage.getItem("billingUser") || "null");
let plans = [];
let payments = [];

function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

function formatDate(dateValue) {
  if (!dateValue) return "Not started";
  return new Date(dateValue).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function previewStartDate() {
  return new Date();
}

function previewEndDate(durationDays) {
  const date = new Date();
  date.setDate(date.getDate() + Number(durationDays || 30));
  return date;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

function saveUser(user) {
  currentUser = user;
  localStorage.setItem("billingUser", JSON.stringify(user));
}

function logout() {
  localStorage.removeItem("billingUser");
  currentUser = null;
  plans = [];
  payments = [];
  renderAuth();
}

function showMessage(text, isError = false) {
  const target = document.querySelector("#message");
  if (!target) return;
  target.textContent = text;
  target.className = isError ? "message error" : "message";
}

function renderAuth(mode = "login") {
  app.innerHTML = `
    <section class="auth-shell">
      <div class="auth-card">
        <div class="auth-info">
          <h1>Role-Based SaaS Billing Portal</h1>
          <p>Login as admin or customer, manage subscription plans, make payments, and track customer billing activity from a clean role-based interface.</p>
        </div>
        <div class="auth-panel">
          <div class="tabs">
            <button class="tab-button ${mode === "login" ? "active" : ""}" id="loginTab">Login</button>
            <button class="tab-button ${mode === "register" ? "active" : ""}" id="registerTab">Register</button>
          </div>
          <div id="formArea"></div>
          <div id="message"></div>
          <div class="hint">
            Demo logins:<br>
            Admin: abhi@admin.com<br>
            Customer: abhi@customer.com
          </div>
        </div>
      </div>
    </section>
  `;

  document.querySelector("#loginTab").addEventListener("click", () => renderAuth("login"));
  document.querySelector("#registerTab").addEventListener("click", () => renderAuth("register"));

  if (mode === "login") {
    renderLoginForm();
  } else {
    renderRegisterForm();
  }
}

function renderLoginForm() {
  document.querySelector("#formArea").innerHTML = `
    <form id="loginForm">
      <div class="field">
        <label for="loginEmail">Email address</label>
        <input id="loginEmail" type="email" placeholder="abhi@customer.com" required>
      </div>
      <button class="primary-button" type="submit">Login</button>
    </form>
  `;

  document.querySelector("#loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const email = document.querySelector("#loginEmail").value;
      const data = await request("/login", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      saveUser(data.user);
      await renderDashboard();
    } catch (error) {
      showMessage(error.message, true);
    }
  });
}

function renderRegisterForm() {
  document.querySelector("#formArea").innerHTML = `
    <form id="registerForm">
      <div class="field">
        <label for="registerName">Name</label>
        <input id="registerName" type="text" placeholder="Enter your name" required>
      </div>
      <div class="field">
        <label for="registerEmail">Email address</label>
        <input id="registerEmail" type="email" placeholder="Enter your email" required>
      </div>
      <button class="primary-button" type="submit">Register</button>
    </form>
  `;

  document.querySelector("#registerForm").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const name = document.querySelector("#registerName").value;
      const email = document.querySelector("#registerEmail").value;
      const data = await request("/register", {
        method: "POST",
        body: JSON.stringify({ name, email })
      });
      renderAuth("login");
      setTimeout(() => showMessage(data.message), 50);
    } catch (error) {
      showMessage(error.message, true);
    }
  });
}

function renderShell(content) {
  app.innerHTML = `
    <section class="app-shell">
      <header class="topbar">
        <div class="brand">
          <h1>${currentUser.role === "admin" ? "Admin Billing Dashboard" : "Subscription Management"}</h1>
          <p>${currentUser.role === "admin" ? "Manage customers and plans" : "Choose a plan and track your billing"}</p>
        </div>
        <div class="profile-wrap">
          <button class="icon-button" id="profileButton">Profile</button>
          <div class="profile-menu hidden" id="profileMenu"></div>
        </div>
      </header>
      <div class="content">${content}</div>
    </section>
  `;

  document.querySelector("#profileButton").addEventListener("click", () => {
    document.querySelector("#profileMenu").classList.toggle("hidden");
  });

  renderProfileMenu();
}

function renderProfileMenu() {
  const menu = document.querySelector("#profileMenu");
  if (!menu) return;

  const paymentHtml = currentUser.role === "customer"
    ? `
      <h3>Payment Details</h3>
      ${payments.length === 0
        ? `<p class="profile-line">No payments yet.</p>`
        : payments.map(payment => `
          <p class="profile-line">
            <strong>${payment.planName}</strong><br>
            ${formatCurrency(payment.amount)} - ${payment.status}<br>
            ${formatDate(payment.startDate)} to ${formatDate(payment.endDate)}
          </p>
        `).join("")}
    `
    : "";

  menu.innerHTML = `
    <h3>Profile</h3>
    <p class="profile-line"><strong>Name:</strong> ${currentUser.name}</p>
    <p class="profile-line"><strong>Email:</strong> ${currentUser.email}</p>
    <p class="profile-line"><strong>Role:</strong> ${currentUser.role}</p>
    ${paymentHtml}
    <button class="danger-button" id="logoutButton">Logout</button>
  `;

  document.querySelector("#logoutButton").addEventListener("click", logout);
}

async function loadPlans() {
  const data = await request("/plans");
  plans = data.plans;
}

async function loadPayments() {
  if (!currentUser || currentUser.role !== "customer") return;
  const data = await request(`/payments/${currentUser.id}`);
  payments = data.payments;
}

async function renderDashboard() {
  if (!currentUser) {
    renderAuth();
    return;
  }

  await loadPlans();
  if (currentUser.role === "customer") {
    await loadPayments();
    renderCustomerHome();
  } else {
    renderAdminHome();
  }
}

function renderCustomerHome() {
  const cards = plans.map(plan => `
    <article class="plan-card">
      <h3>${plan.name}</h3>
      <p class="price">${formatCurrency(plan.price)}<span style="font-size: 15px; color: var(--muted);">/month</span></p>
      <div class="meta-row"><span>Start date</span><strong>${formatDate(previewStartDate())}</strong></div>
      <div class="meta-row"><span>End date</span><strong>${formatDate(previewEndDate(plan.durationDays))}</strong></div>
      <div class="meta-row"><span>Duration</span><strong>${plan.durationDays} days</strong></div>
      <button class="primary-button pay-button" data-plan-id="${plan.id}">Pay</button>
    </article>
  `).join("");

  renderShell(`
    <div class="section-title">
      <div>
        <h2>Plans</h2>
        <p>Select a subscription plan and complete payment.</p>
      </div>
    </div>
    <div class="plans-grid">${cards || `<div class="empty">No plans available.</div>`}</div>
    <div id="message"></div>
  `);

  document.querySelectorAll(".pay-button").forEach(button => {
    button.addEventListener("click", async () => {
      try {
        const data = await request("/payments", {
          method: "POST",
          body: JSON.stringify({
            userId: currentUser.id,
            planId: button.dataset.planId
          })
        });
        payments.unshift(data.payment);
        showMessage("Payment successful.");
        renderProfileMenu();
      } catch (error) {
        showMessage(error.message, true);
      }
    });
  });
}

async function renderAdminHome() {
  const customerData = await request("/admin/customers");
  const customers = customerData.customers;

  const rows = customers.map(customer => {
    const latestPayment = customer.payments[customer.payments.length - 1];
    return `
      <tr>
        <td>${customer.name}</td>
        <td>${customer.email}</td>
        <td>${customer.loginCount}</td>
        <td>${customer.lastLogin ? formatDate(customer.lastLogin) : "Never"}</td>
        <td>${latestPayment ? `${latestPayment.planName} (${formatCurrency(latestPayment.amount)})` : "No payment"}</td>
      </tr>
    `;
  }).join("");

  renderShell(`
    <div class="section-title">
      <div>
        <h2>Customer Logins</h2>
        <p>Total customer accounts: ${customers.length}</p>
      </div>
    </div>
    <div class="admin-grid">
      <section class="data-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Logins</th>
                <th>Last Login</th>
                <th>Latest Payment</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="5">No customer logins yet.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
      <section class="data-card">
        <div class="section-title">
          <div>
            <h2>Edit Plans</h2>
            <p>Changes appear on the customer home page.</p>
          </div>
        </div>
        <form class="plan-form" id="addPlanForm">
          <div class="field">
            <label for="newPlanName">Plan</label>
            <input id="newPlanName" required placeholder="Premium">
          </div>
          <div class="field">
            <label for="newPlanPrice">Price</label>
            <input id="newPlanPrice" type="number" min="1" required placeholder="1499">
          </div>
          <div class="field">
            <label for="newPlanDays">Days</label>
            <input id="newPlanDays" type="number" min="1" value="30" required>
          </div>
          <button class="primary-button" type="submit">Add</button>
        </form>
        <div class="plan-editor-list">
          ${plans.map(plan => `
            <div class="plan-editor" data-plan-id="${plan.id}">
              <input class="edit-name" value="${plan.name}">
              <input class="edit-price" type="number" min="1" value="${plan.price}">
              <input class="edit-days" type="number" min="1" value="${plan.durationDays}">
              <button class="secondary-button save-plan" type="button">Save</button>
            </div>
          `).join("")}
        </div>
        <div id="message"></div>
      </section>
    </div>
  `);

  document.querySelector("#addPlanForm").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      await request("/plans", {
        method: "POST",
        body: JSON.stringify({
          name: document.querySelector("#newPlanName").value,
          price: document.querySelector("#newPlanPrice").value,
          durationDays: document.querySelector("#newPlanDays").value
        })
      });
      await renderDashboard();
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  document.querySelectorAll(".save-plan").forEach(button => {
    button.addEventListener("click", async () => {
      const editor = button.closest(".plan-editor");
      try {
        await request(`/plans/${editor.dataset.planId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: editor.querySelector(".edit-name").value,
            price: editor.querySelector(".edit-price").value,
            durationDays: editor.querySelector(".edit-days").value
          })
        });
        showMessage("Plan updated successfully.");
        await loadPlans();
      } catch (error) {
        showMessage(error.message, true);
      }
    });
  });
}

renderDashboard();
