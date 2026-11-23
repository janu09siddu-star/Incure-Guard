const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: process.env.DB_PASSWORD,
    database: "insureguard",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();
console.log("DATABASE CHECK:", typeof db.getConnection);

const PORT = 5000;

// Database connection
async function startServer() {
    try {
        const connection = await db.getConnection();
        console.log("ROUTE DATABASE CHECK:", typeof db.getConnection);
        console.log("MySQL Database Connected Successfully!");
        connection.release();

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`InsureGuard available at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Database connection failed:", error.message);
    }
}

// Home route
app.get("/", (req, res) => {
    res.send("InsureGuard Backend is Running!");
});

// ------------------------------------
// CUSTOMER MODULE
// ------------------------------------

app.get("/api/customers", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                customer_id AS id,
                full_name AS name,
                email,
                phone,
                address,
                created_at AS createdAt
            FROM customers
            ORDER BY customer_id DESC
        `);

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post("/api/customers", async (req, res) => {
    try {
        const { name, email, phone, address } = req.body;

        if (!name || !email || !phone) {
            return res.status(400).json({
                message: "Name, email and phone are required."
            });
        }

        const [result] = await db.query(
            `INSERT INTO customers
            (full_name, email, phone, address)
            VALUES (?, ?, ?, ?)`,
            [name, email, phone, address || ""]
        );

        res.status(201).json({
            message: "Customer added successfully",
            id: result.insertId
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put("/api/customers/:id", async (req, res) => {
    try {
        const { name, email, phone, address } = req.body;

        const [result] = await db.query(
            `UPDATE customers
             SET full_name = ?, email = ?, phone = ?, address = ?
             WHERE customer_id = ?`,
            [name, email, phone, address || "", req.params.id]
        );

        res.json({ message: "Customer updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete("/api/customers/:id", async (req, res) => {
    try {
        const [policies] = await db.query(
            "SELECT policy_id FROM policies WHERE customer_id = ?",
            [req.params.id]
        );

        if (policies.length > 0) {
            return res.status(409).json({
                message: "Cannot delete customer because policies are linked."
            });
        }

        await db.query(
            "DELETE FROM customers WHERE customer_id = ?",
            [req.params.id]
        );

        res.json({ message: "Customer deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ------------------------------------
// POLICY MODULE
// ------------------------------------

app.get("/api/policies", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                policy_id AS id,
                customer_id AS customerId,
                policy_name AS name,
                policy_type AS type,
                coverage_amount AS coverage,
                premium_amount AS premium,
                DATE_FORMAT(start_date, '%Y-%m-%d') AS start,
                DATE_FORMAT(end_date, '%Y-%m-%d') AS end,
                status
            FROM policies
            ORDER BY policy_id DESC
        `);

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post("/api/policies", async (req, res) => {
    try {
        const {
            customerId,
            type,
            coverage,
            premium,
            start,
            end
        } = req.body;

        if (!customerId || !type || !coverage || !premium || !start || !end) {
            return res.status(400).json({
                message: "Please provide all policy details."
            });
        }

        const [result] = await db.query(
            `INSERT INTO policies
            (customer_id, policy_name, policy_type,
             coverage_amount, premium_amount, start_date, end_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [customerId, type, type, coverage, premium, start, end]
        );

        res.status(201).json({
            message: "Policy added successfully",
            id: result.insertId
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put("/api/policies/:id", async (req, res) => {
    try {
        const {
            customerId,
            type,
            coverage,
            premium,
            start,
            end
        } = req.body;

        await db.query(
            `UPDATE policies
             SET customer_id = ?, policy_name = ?, policy_type = ?,
                 coverage_amount = ?, premium_amount = ?,
                 start_date = ?, end_date = ?
             WHERE policy_id = ?`,
            [
                customerId, type, type, coverage,
                premium, start, end, req.params.id
            ]
        );

        res.json({ message: "Policy updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete("/api/policies/:id", async (req, res) => {
    try {
        const [claims] = await db.query(
            "SELECT claim_id FROM claims WHERE policy_id = ?",
            [req.params.id]
        );

        if (claims.length > 0) {
            return res.status(409).json({
                message: "Cannot delete policy because claims are linked."
            });
        }

        await db.query(
            "DELETE FROM policies WHERE policy_id = ?",
            [req.params.id]
        );

        res.json({ message: "Policy deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ------------------------------------
// CLAIM MODULE
// ------------------------------------

app.get("/api/claims", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                c.claim_id AS id,
                c.customer_id AS customerId,
                c.policy_id AS policyId,
                c.claim_amount AS amount,
                DATE_FORMAT(c.claim_date, '%Y-%m-%d') AS date,
                c.description,
                c.status
            FROM claims c
            ORDER BY c.claim_id DESC
        `);

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post("/api/claims", async (req, res) => {
    try {
        const {
            customerId,
            policyId,
            amount,
            date,
            description
        } = req.body;

        if (!customerId || !policyId || !amount || !date) {
            return res.status(400).json({
                message: "Please provide all required claim details."
            });
        }

        const [policies] = await db.query(
            `SELECT customer_id, coverage_amount, start_date, end_date
             FROM policies
             WHERE policy_id = ?`,
            [policyId]
        );

        if (policies.length === 0) {
            return res.status(404).json({
                message: "Policy not found."
            });
        }

        const policy = policies[0];

        if (Number(policy.customer_id) !== Number(customerId)) {
            return res.status(400).json({
                message: "The selected policy does not belong to this customer."
            });
        }

        if (Number(amount) <= 0 ||
            Number(amount) > Number(policy.coverage_amount)) {
            return res.status(400).json({
                message: "Claim amount must be positive and within policy coverage."
            });
        }

        if (date < policy.start_date.toISOString().slice(0, 10) ||
            date > policy.end_date.toISOString().slice(0, 10)) {
            return res.status(400).json({
                message: "Claim date must be within policy validity."
            });
        }

        const [result] = await db.query(
            `INSERT INTO claims
            (customer_id, policy_id, claim_amount, claim_date, description)
            VALUES (?, ?, ?, ?, ?)`,
            [customerId, policyId, amount, date, description || ""]
        );

        res.status(201).json({
            message: "Claim submitted successfully",
            id: result.insertId
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put("/api/claims/:id", async (req, res) => {
    try {
        const { amount, date, description, status } = req.body;

        await db.query(
            `UPDATE claims
             SET claim_amount = ?, claim_date = ?,
                 description = ?, status = ?
             WHERE claim_id = ?`,
            [amount, date, description, status, req.params.id]
        );

        res.json({ message: "Claim updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete("/api/claims/:id", async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const claimId = req.params.id;

        await connection.query(
            "DELETE FROM claim_decisions WHERE claim_id = ?",
            [claimId]
        );

        await connection.query(
            "DELETE FROM fraud_alerts WHERE claim_id = ?",
            [claimId]
        );

        await connection.query(
            "DELETE FROM fraud_assessments WHERE claim_id = ?",
            [claimId]
        );

        await connection.query(
            "DELETE FROM claims WHERE claim_id = ?",
            [claimId]
        );

        await connection.commit();

        res.json({ message: "Claim deleted successfully" });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
});

// ------------------------------------
// FRAUD DETECTION MODULE
// ------------------------------------

app.get("/api/fraud-assessments", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                fa.assessment_id AS id,
                fa.claim_id AS claimId,
                fa.risk_score AS riskScore,
                fa.risk_level AS riskLevel,
                fa.assessment_reason AS riskReason,
                fa.assessed_at AS assessedAt
            FROM fraud_assessments fa
            ORDER BY fa.assessment_id DESC
        `);

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post("/api/fraud-detection/:claimId", async (req, res) => {
    console.log("FRAUD ROUTE HIT:", req.params.claimId);
    let connection;

    try {
        console.log("CHECK INSIDE ROUTE:", typeof db.getConnection 
            
        );
        connection = await db.getConnection();

        const claimId = req.params.claimId;

    

    const [claims] = await connection.query(
        `SELECT c.*, p.coverage_amount
        FROM claims c
        JOIN policies p ON c.policy_id = p.policy_id
        WHERE c.claim_id = ?`,
        [claimId]
        );
        console.log("CLAIM QUERY RESULT:", claims);

        if (claims.length === 0) {
            return res.status(404).json({
                message: "Claim not found."
            });
        }

        const claim = claims[0];

        let score = 0;
        const reasons = [];

        // Rule 1: Exact duplicate claim
        const [duplicates] = await connection.query(
            `SELECT claim_id FROM claims
             WHERE customer_id = ?
             AND policy_id = ?
             AND claim_amount = ?
             AND claim_date = ?
             AND claim_id != ?`,
            [
                claim.customer_id,
                claim.policy_id,
                claim.claim_amount,
                claim.claim_date,
                claimId
            ]
        );

        if (duplicates.length > 0) {
            score += 60;
            reasons.push("Possible duplicate claim");
        }

        // Rule 2: Repeated claims within 30 days
        const [repeated] = await connection.query(
            `SELECT claim_id FROM claims
             WHERE customer_id = ?
             AND policy_id = ?
             AND claim_id != ?
             AND ABS(DATEDIFF(claim_date, ?)) <= 30`,
            [
                claim.customer_id,
                claim.policy_id,
                claimId,
                claim.claim_date
            ]
        );

        if (repeated.length > 0) {
            score += 25;
            reasons.push("Repeated claim within 30 days");
        }

        // Rule 3: Claim exceeds 50% of coverage
        if (
            Number(claim.claim_amount) >
            Number(claim.coverage_amount) * 0.5
        ) {
            score += 25;
            reasons.push("Claim amount exceeds 50% of policy coverage");
        }

        score = Math.min(score, 100);

        let riskLevel = "Low";

        if (score >= 60) {
            riskLevel = "High";
        } else if (score >= 30) {
            riskLevel = "Medium";
        }

        const reason = reasons.length > 0
            ? reasons.join("; ")
            : "No unusual claim pattern detected";

        await connection.beginTransaction();

        // Keep only the latest assessment for this claim
        await connection.query(
            "DELETE FROM fraud_assessments WHERE claim_id = ?",
            [claimId]
        );

        await connection.query(
            `INSERT INTO fraud_assessments
            (claim_id, risk_score, risk_level, assessment_reason)
            VALUES (?, ?, ?, ?)`,
            [claimId, score, riskLevel, reason]
        );

        if (riskLevel === "Medium" || riskLevel === "High") {
            const [openAlerts] = await connection.query(
                `SELECT alert_id FROM fraud_alerts
                 WHERE claim_id = ? AND alert_status = 'Open'`,
                [claimId]
            );

            if (openAlerts.length === 0) {
                await connection.query(
                    `INSERT INTO fraud_alerts
                    (claim_id, alert_message, alert_status)
                    VALUES (?, ?, 'Open')`,
                    [claimId, `${riskLevel} risk: ${reason}`]
                );
            }
        } else {
            await connection.query(
                `UPDATE fraud_alerts
                 SET alert_status = 'Closed'
                 WHERE claim_id = ? AND alert_status = 'Open'`,
                [claimId]
            );
        }

        await connection.commit();

        res.json({
            message: "Fraud risk assessment completed",
            claimId: Number(claimId),
            riskScore: score,
            riskLevel,
            riskReason: reason
        });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: error.message });
    }finally {
    if (connection) {
        connection.release();
    }
}
});

// ------------------------------------
// FRAUD ALERTS MODULE
// ------------------------------------

app.get("/api/fraud-alerts", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                fa.alert_id AS id,
                fa.claim_id AS claimId,
                fa.alert_message AS message,
                fa.alert_status AS status,
                fa.created_at AS createdAt
            FROM fraud_alerts fa
            ORDER BY fa.alert_id DESC
        `);

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put("/api/fraud-alerts/:id", async (req, res) => {
    try {
        const { status } = req.body;

        await db.query(
            `UPDATE fraud_alerts
             SET alert_status = ?
             WHERE alert_id = ?`,
            [status, req.params.id]
        );

        res.json({ message: "Fraud alert updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ------------------------------------
// CLAIM DECISIONS MODULE
// ------------------------------------

app.get("/api/claim-decisions", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                decision_id AS id,
                claim_id AS claimId,
                decision,
                remarks,
                decision_date AS decisionDate
            FROM claim_decisions
            ORDER BY decision_id DESC
        `);

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post("/api/claim-decisions", async (req, res) => {
    const connection = await db.getConnection();

    try {
        const { claimId, decision, remarks } = req.body;

        const allowedDecisions = [
            "Approved",
            "Rejected",
            "Under Review"
        ];

        if (!claimId || !allowedDecisions.includes(decision)) {
            return res.status(400).json({
                message: "Valid claim ID and decision are required."
            });
        }

        await connection.beginTransaction();

        await connection.query(
            `INSERT INTO claim_decisions
            (claim_id, decision, remarks)
            VALUES (?, ?, ?)`,
            [claimId, decision, remarks || ""]
        );

        await connection.query(
            `UPDATE claims
             SET status = ?
             WHERE claim_id = ?`,
            [decision, claimId]
        );

        await connection.commit();

        res.status(201).json({
            message: "Claim decision saved successfully"
        });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
});

// ------------------------------------
// REPORTS MODULE
// ------------------------------------

app.get("/api/reports", async (req, res) => {
    try {
        const [customerCount] = await db.query(
            "SELECT COUNT(*) AS total_customers FROM customers"
        );

        const [policyCount] = await db.query(
            "SELECT COUNT(*) AS total_policies FROM policies"
        );

        const [claimStats] = await db.query(`
            SELECT
                COUNT(*) AS total_claims,
                COALESCE(SUM(claim_amount), 0) AS total_claim_value,
                SUM(status = 'Approved') AS approved_claims,
                SUM(status = 'Rejected') AS rejected_claims,
                SUM(status = 'Pending') AS pending_claims
            FROM claims
        `);

        const [riskStats] = await db.query(`
            SELECT
                SUM(risk_level = 'Low') AS low_risk,
                SUM(risk_level = 'Medium') AS medium_risk,
                SUM(risk_level = 'High') AS high_risk
            FROM fraud_assessments
        `);

        res.json({
            ...customerCount[0],
            ...policyCount[0],
            ...claimStats[0],
            ...riskStats[0]
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ------------------------------------
// START SERVER
// ------------------------------------
const path = require("path");

app.use(express.static(path.join(__dirname, "..")));


startServer();