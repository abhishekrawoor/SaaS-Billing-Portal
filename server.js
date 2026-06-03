const http = require("http");
const fs = require("fs");
const path = require("path");
const PORT = process.env.PORT || 5001;
const DB_PATH = path.join(__dirname, "data", "db.json");

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString();
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    loginCount: user.loginCount || 0,
    lastLogin: user.lastLogin || null
  };
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + Number(days || 30));
  return copy;
}

function routeKey(req) {
  return `${req.method} ${new URL(req.url, `http://${req.headers.host}`).pathname}`;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathName = url.pathname;

  try {
    if (routeKey(req) === "GET /api/health") {
      sendJson(res, 200, { message: "SaaS billing portal API is running" });
      return;
    }

    if (routeKey(req) === "POST /api/register") {
      const { name, email } = await readBody(req);
      if (!name || !email) {
        sendJson(res, 400, { message: "Name and email are required." });
        return;
      }

      const db = readDb();
      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = db.users.find(user => user.email.toLowerCase() === normalizedEmail);

      if (existingUser) {
        sendJson(res, 409, { message: "This email is already registered." });
        return;
      }

      const user = {
        id: `customer-${Date.now()}`,
        name: name.trim(),
        email: normalizedEmail,
        role: "customer",
        loginCount: 0,
        lastLogin: null
      };

      db.users.push(user);
      writeDb(db);
      sendJson(res, 201, { message: "Registration successful. You can now login.", user: publicUser(user) });
      return;
    }

    if (routeKey(req) === "POST /api/login") {
      const { email } = await readBody(req);
      if (!email) {
        sendJson(res, 400, { message: "Email is required." });
        return;
      }

      const db = readDb();
      const user = db.users.find(item => item.email.toLowerCase() === email.trim().toLowerCase());

      if (!user) {
        sendJson(res, 404, { message: "User not found. Please register first." });
        return;
      }

      user.loginCount = (user.loginCount || 0) + 1;
      user.lastLogin = new Date().toISOString();
      writeDb(db);

      sendJson(res, 200, { message: "Login successful.", user: publicUser(user) });
      return;
    }

    if (routeKey(req) === "GET /api/plans") {
      const db = readDb();
      sendJson(res, 200, { plans: db.plans });
      return;
    }

    if (routeKey(req) === "POST /api/plans") {
      const { name, price, durationDays } = await readBody(req);
      if (!name || !price) {
        sendJson(res, 400, { message: "Plan name and price are required." });
        return;
      }

      const db = readDb();
      const plan = {
        id: `plan-${Date.now()}`,
        name: name.trim(),
        price: Number(price),
        durationDays: Number(durationDays || 30)
      };

      db.plans.push(plan);
      writeDb(db);
      sendJson(res, 201, { message: "Plan added successfully.", plan });
      return;
    }

    if (req.method === "PUT" && pathName.startsWith("/api/plans/")) {
      const planId = pathName.split("/").pop();
      const { name, price, durationDays } = await readBody(req);
      const db = readDb();
      const plan = db.plans.find(item => item.id === planId);

      if (!plan) {
        sendJson(res, 404, { message: "Plan not found." });
        return;
      }

      plan.name = name ? name.trim() : plan.name;
      plan.price = price ? Number(price) : plan.price;
      plan.durationDays = durationDays ? Number(durationDays) : plan.durationDays;

      writeDb(db);
      sendJson(res, 200, { message: "Plan updated successfully.", plan });
      return;
    }

    if (routeKey(req) === "POST /api/payments") {
      const { userId, planId } = await readBody(req);
      const db = readDb();
      const user = db.users.find(item => item.id === userId && item.role === "customer");
      const plan = db.plans.find(item => item.id === planId);

      if (!user || !plan) {
        sendJson(res, 404, { message: "Customer or plan not found." });
        return;
      }

      const start = new Date();
      const end = addDays(start, plan.durationDays);
      const payment = {
        id: `payment-${Date.now()}`,
        userId,
        customerName: user.name,
        customerEmail: user.email,
        planId: plan.id,
        planName: plan.name,
        amount: Number(plan.price),
        status: "Successful",
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        paidAt: new Date().toISOString()
      };

      db.payments.push(payment);
      writeDb(db);
      sendJson(res, 201, { message: "Payment successful.", payment });
      return;
    }

    if (pathName.startsWith("/api/payments/")) {
      const userId = pathName.split("/").pop();
      const db = readDb();
      const payments = db.payments.filter(payment => payment.userId === userId);
      sendJson(res, 200, { payments });
      return;
    }

    if (routeKey(req) === "GET /api/admin/customers") {
      const db = readDb();
      const customers = db.users
        .filter(user => user.role === "customer")
        .map(user => ({
          ...publicUser(user),
          payments: db.payments.filter(payment => payment.userId === user.id)
        }));

      sendJson(res, 200, { customers });
      return;
    }

    sendJson(res, 404, { message: "Route not found." });
  } catch (error) {
    sendJson(res, 500, { message: "Server error.", detail: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`SaaS billing portal backend running at http://localhost:${PORT}`);
});
