import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));

  // Proxy route to fetch live external JSON / CSV API endpoints safely (with SSRF protection)
  app.post("/api/rexor/fetch-url", async (req, res) => {
    try {
      const { url, headers } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "A valid endpoint URL is required." });
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url.trim());
      } catch {
        return res.status(400).json({ error: "Invalid URL format." });
      }

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return res
          .status(400)
          .json({ error: "Only HTTP and HTTPS protocols are permitted." });
      }

      const host = parsedUrl.hostname.toLowerCase();
      if (
        /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?fe80:)/.test(
          host
        ) ||
        host.endsWith(".internal") ||
        host.endsWith(".local")
      ) {
        return res.status(403).json({
          error:
            "SSRF Guardrail: Internal, loopback, and cloud metadata network URLs are strictly blocked.",
        });
      }

      const response = await fetch(parsedUrl.toString(), {
        headers: {
          Accept: "application/json, text/csv, text/plain, */*",
          ...(headers || {}),
        },
      });
      if (!response.ok) {
        return res.status(response.status).json({
          error: `Remote endpoint returned HTTP ${response.status}: ${response.statusText}`,
        });
      }
      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      return res.json({
        contentType,
        rawText: text.slice(0, 2000000), // Cap at 2MB for safety
      });
    } catch (error: any) {
      return res.status(500).json({
        error: error?.message || "Failed to fetch external data source.",
      });
    }
  });

  // Main Rexor Autonomous 6-Stage Lifecycle Intelligence Engine
  app.post("/api/rexor/analyze", async (req, res) => {
    try {
      const {
        datasetName,
        businessQuestion,
        domainContext,
        rowCount,
        cleanedRowCount,
        columns,
        cleaningSummary,
        topCorrelations,
        sampleRows,
        activeUserRequirements,
        ecosystemKnowledge,
      } = req.body;

      const ai = getGenAIClient();

      const prompt = `You are Rexor, a Principal Autonomous Data Analyst Agent.
You execute the complete 6-stage Data Analytics Lifecycle with quantitative rigor, statistical precision, and executive clarity.

Here is the dataset and context you have just ingested, cleaned, and profiled:
- Dataset Name: ${datasetName || "Uploaded Business Dataset"}
- User's Business Question / Objective: ${businessQuestion || "Identify key performance drivers, operational anomalies, and high-ROI strategic actions."}
- Domain Context: ${domainContext || "Enterprise Operations & Revenue Analytics"}
- Raw Row Count: ${rowCount} | Cleaned Row Count: ${cleanedRowCount}
- Data Cleaning & Preparation Summary: ${JSON.stringify(cleaningSummary)}
- Active User-Specified Adaptive Requirements Applied to Dataset: ${JSON.stringify(activeUserRequirements || [])}
- Senior Analyst Ecosystem Knowledge Vault Heuristics: ${JSON.stringify(ecosystemKnowledge || [])}
- Column Statistical Profiles: ${JSON.stringify(columns)}
- Strongest Statistical Correlations (Pearson r): ${JSON.stringify(topCorrelations)}
- Sample Cleaned Records (first 8 rows): ${JSON.stringify(sampleRows)}

Generate a complete, deeply grounded 6-stage Data Analytics Lifecycle intelligence report in JSON format. Every metric, column name, SQL query, Python script, finding, and recommendation MUST reference the actual column names and numbers from this dataset, and strictly honor the Active User-Specified Adaptive Requirements and Senior Analyst Ecosystem Knowledge Heuristics.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction:
            "You are Rexor, an elite autonomous data analyst agent. Never use generic placeholders; always cite exact column names, statistical distributions, correlations, and realistic quantified impacts from the provided dataset profile.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              stage1ProblemFraming: {
                type: Type.OBJECT,
                properties: {
                  refinedQuestion: {
                    type: Type.STRING,
                    description: "Sharp, measurable formulation of the core business problem.",
                  },
                  decisionStakeholders: {
                    type: Type.STRING,
                    description: "Primary decision-makers and operational teams impacted.",
                  },
                  primaryObjectiveMetric: {
                    type: Type.STRING,
                    description: "The North Star metric column and target direction.",
                  },
                  hypotheses: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        statement: { type: Type.STRING },
                        rationale: { type: Type.STRING },
                        validationStatus: {
                          type: Type.STRING,
                          description: "Confirmed, Partially Supported, or Refuted based on the data.",
                        },
                        evidenceMetric: { type: Type.STRING },
                      },
                      required: ["id", "statement", "rationale", "validationStatus", "evidenceMetric"],
                    },
                  },
                },
                required: [
                  "refinedQuestion",
                  "decisionStakeholders",
                  "primaryObjectiveMetric",
                  "hypotheses",
                ],
              },
              stage3CleaningAssessment: {
                type: Type.OBJECT,
                properties: {
                  dataReliabilityScore: {
                    type: Type.NUMBER,
                    description: "Post-cleaning reliability score from 85 to 99.",
                  },
                  structuralRisksResolved: {
                    type: Type.STRING,
                    description: "Explanation of how missing values, duplicates, or format biases would have distorted analysis if left uncleaned.",
                  },
                  schemaRecommendations: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: [
                  "dataReliabilityScore",
                  "structuralRisksResolved",
                  "schemaRecommendations",
                ],
              },
              stage4AnalyticalFindings: {
                type: Type.OBJECT,
                properties: {
                  executiveSummary: {
                    type: Type.STRING,
                    description: "2-3 sentence synthesis of the most critical statistical discovery.",
                  },
                  keyInsights: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        category: {
                          type: Type.STRING,
                          description: "Driver Analysis, Anomaly Detection, Cohort Variance, or Distribution Shift",
                        },
                        quantifiedFinding: { type: Type.STRING },
                        businessImplication: { type: Type.STRING },
                      },
                      required: ["title", "category", "quantifiedFinding", "businessImplication"],
                    },
                  },
                  sqlQueries: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        purpose: { type: Type.STRING },
                        sql: { type: Type.STRING },
                        expectedOutputSummary: { type: Type.STRING },
                      },
                      required: ["title", "purpose", "sql", "expectedOutputSummary"],
                    },
                  },
                  pythonSnippet: {
                    type: Type.STRING,
                    description: "Production Python (pandas, scipy/statsmodels) code to reproduce the statistical test and feature importance.",
                  },
                },
                required: ["executiveSummary", "keyInsights", "sqlQueries", "pythonSnippet"],
              },
              stage5VisualNarrative: {
                type: Type.OBJECT,
                properties: {
                  dashboardHeadline: { type: Type.STRING },
                  storylineTakeaways: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  recommendedChartConfigs: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        chartTitle: { type: Type.STRING },
                        chartType: {
                          type: Type.STRING,
                          description: "bar, line, scatter, or distribution",
                        },
                        xColumn: { type: Type.STRING },
                        yColumn: { type: Type.STRING },
                        insightAnnotation: { type: Type.STRING },
                      },
                      required: ["chartTitle", "chartType", "xColumn", "yColumn", "insightAnnotation"],
                    },
                  },
                },
                required: ["dashboardHeadline", "storylineTakeaways", "recommendedChartConfigs"],
              },
              stage6ActionPlan: {
                type: Type.OBJECT,
                properties: {
                  recommendations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        priority: {
                          type: Type.STRING,
                          description: "P0 Immediate, P1 Near-Term, or P2 Strategic",
                        },
                        actionTitle: { type: Type.STRING },
                        targetSegmentOrVariable: { type: Type.STRING },
                        concreteMechanism: { type: Type.STRING },
                        quantifiedExpectedImpact: { type: Type.STRING },
                        effortLevel: { type: Type.STRING },
                        measurementKpi: { type: Type.STRING },
                      },
                      required: [
                        "priority",
                        "actionTitle",
                        "targetSegmentOrVariable",
                        "concreteMechanism",
                        "quantifiedExpectedImpact",
                        "effortLevel",
                        "measurementKpi",
                      ],
                    },
                  },
                  measurementFramework: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        kpiName: { type: Type.STRING },
                        baselineValue: { type: Type.STRING },
                        target30Day: { type: Type.STRING },
                        target90Day: { type: Type.STRING },
                        trackingCadence: { type: Type.STRING },
                      },
                      required: [
                        "kpiName",
                        "baselineValue",
                        "target30Day",
                        "target90Day",
                        "trackingCadence",
                      ],
                    },
                  },
                },
                required: ["recommendations", "measurementFramework"],
              },
            },
            required: [
              "stage1ProblemFraming",
              "stage3CleaningAssessment",
              "stage4AnalyticalFindings",
              "stage5VisualNarrative",
              "stage6ActionPlan",
            ],
          },
        },
      });

      const text = response.text || "{}";
      const parsed = JSON.parse(text);
      return res.json({ report: parsed });
    } catch (error: any) {
      console.error("Rexor analyze error:", error);
      return res.status(500).json({
        error: error?.message || "Failed to generate Rexor lifecycle analysis.",
      });
    }
  });

  // Adaptive Natural-Language User Requirement Compiler Endpoint
  app.post("/api/rexor/adapt-rule", async (req, res) => {
    try {
      const { instruction, datasetName, businessQuestion, columns, sampleRows } =
        req.body;
      if (!instruction) {
        return res.status(400).json({ error: "Instruction is required." });
      }

      const ai = getGenAIClient();
      const prompt = `You are Rexor's Adaptive Requirement Compiler.
Convert the user's plain-English data requirement into an executable transformation rule bound to the actual columns of "${datasetName}".

User Requirement: "${instruction}"
Business Context: ${businessQuestion || "Enterprise Analytics"}
Available Columns: ${JSON.stringify(columns)}
Sample Rows: ${JSON.stringify(sampleRows)}

Choose ruleType from:
- "FILTER_KEEP" (keep rows matching targetColumn operator compareValue)
- "FILTER_EXCLUDE" (exclude rows matching targetColumn operator compareValue)
- "CAP_MAX" (clip targetColumn upper bound at numericParameter)
- "FLOOR_MIN" (clip targetColumn lower bound at numericParameter)
- "DERIVE_FORMULA" (compute outputColumnName from targetColumn and secondaryColumn or numericParameter using formulaExpression: "SUB" | "ADD" | "MUL" | "DIV" | "SCALE_FACTOR")
- "CONDITIONAL_FLAG" (create outputColumnName flagging rows where targetColumn > numericParameter)
- "CONDITIONAL_DISCOUNT_AUDIT" (audit unauthorized MORNING10 discounts applied at or after 11:00 AM)
- "CANONICALIZE_TEXT" (canonicalize text strings in targetColumn to Title Case and standardized abbreviations)
- "COHORT_MEAN_IMPUTE" (impute missing values in targetColumn using group mean of secondaryColumn)`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              ruleType: {
                type: Type.STRING,
                description:
                  "FILTER_KEEP, FILTER_EXCLUDE, CAP_MAX, FLOOR_MIN, DERIVE_FORMULA, CONDITIONAL_FLAG, CONDITIONAL_DISCOUNT_AUDIT, CANONICALIZE_TEXT, or COHORT_MEAN_IMPUTE",
              },
              targetColumn: { type: Type.STRING },
              secondaryColumn: { type: Type.STRING },
              operator: {
                type: Type.STRING,
                description: "==, !=, >, >=, <, <=, or CONTAINS",
              },
              compareValue: { type: Type.STRING },
              numericParameter: { type: Type.NUMBER },
              formulaExpression: {
                type: Type.STRING,
                description: "SUB, ADD, MUL, DIV, or SCALE_FACTOR",
              },
              outputColumnName: { type: Type.STRING },
              flagLabelTrue: { type: Type.STRING },
              flagLabelFalse: { type: Type.STRING },
              pythonEquivalent: { type: Type.STRING },
              sqlEquivalent: { type: Type.STRING },
            },
            required: [
              "title",
              "ruleType",
              "targetColumn",
              "pythonEquivalent",
              "sqlEquivalent",
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json(parsed);
    } catch (error: any) {
      console.error("Rexor adapt-rule error:", error);
      return res.status(500).json({
        error: error?.message || "Fallback to deterministic requirement compiler.",
      });
    }
  });

  // Follow-up Deep-Dive Question Endpoint for Rexor (Grounded in Deterministic Full-Dataset Execution)
  app.post("/api/rexor/ask", async (req, res) => {
    try {
      const {
        question,
        datasetName,
        businessQuestion,
        columns,
        topCorrelations,
        sampleRows,
        activeUserRequirements,
        ecosystemKnowledge,
        deterministicResult,
      } = req.body;

      if (!question) {
        return res.status(400).json({ error: "Question is required." });
      }

      const ai = getGenAIClient();

      const prompt = `You are Rexor, an Autonomous Data Analyst Agent.
The user is asking a specific analytical question about their dataset "${datasetName}".
Business Context: ${businessQuestion}
Active User Requirements Applied: ${JSON.stringify(activeUserRequirements || [])}
Learned Ecosystem Analyst Wisdom: ${JSON.stringify(ecosystemKnowledge || [])}
Dataset Columns & Profiles: ${JSON.stringify(columns)}
Top Correlations: ${JSON.stringify(topCorrelations)}
Verified Full-Dataset Deterministic Sandbox Output (DO NOT contradict these exact numbers): ${JSON.stringify(deterministicResult || {})}
Sample Cleaned Data: ${JSON.stringify(sampleRows)}

User Question: "${question}"

Respond in JSON with:
1. directAnswer: Clear, quantitative answer citing the EXACT verified numbers from the Full-Dataset Deterministic Sandbox Output and Column Profiles (never guess or extrapolate from sample rows).
2. sqlQuery: Exact SQL query to compute or verify this answer on the table \`cleaned_dataset\`.
3. pythonCode: Concise pandas code to compute this analysis.
4. recommendedAction: Concrete business step based on this answer.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              directAnswer: { type: Type.STRING },
              sqlQuery: { type: Type.STRING },
              pythonCode: { type: Type.STRING },
              recommendedAction: { type: Type.STRING },
            },
            required: ["directAnswer", "sqlQuery", "pythonCode", "recommendedAction"],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json(parsed);
    } catch (error: any) {
      console.error("Rexor ask error:", error);
      return res.status(500).json({
        error: error?.message || "Failed to process analytical query.",
      });
    }
  });

  // Unrestricted Omni-Task AI Problem Solver & Adaptive Copilot Chat Endpoint
  app.post("/api/rexor/chat", async (req, res) => {
    try {
      const {
        message,
        history,
        activeView,
        datasetName,
        businessQuestion,
        cleaningSummary,
        columns,
        topCorrelations,
        activeUserRequirements,
        ecosystemKnowledge,
        deterministicResult,
        sampleRows,
      } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required." });
      }

      const ai = getGenAIClient();

      const prompt = `You are the Rexor Omni-Task AI Data & Business Problem Solver (architected and owned by Rushi Chavan · rushichavan69@gmail.com).
You are NEVER limited to a narrow template or preset task. Whatever the user types—whether it is a complex business strategy dilemma, a custom metric calculation, a messy operational bottleneck, a "what-if" scenario, a SQL/Python/Excel/DAX formula request, a statistical edge case, or an open-ended question—you MUST resolve it completely and provide a concrete, actionable workaround or solution.

Current Live Workbench Context:
- Active Screen/Tab: "${activeView}"
- Active Dataset: "${datasetName || "No dataset loaded yet (General Advisory Mode)"}"
- Business Objective: "${businessQuestion || "Optimize operational & financial performance"}"
- Data Hygiene Summary: ${JSON.stringify(cleaningSummary || {})}
- Active Pipeline Rules: ${JSON.stringify(activeUserRequirements || [])}
- Senior Analyst Playbooks: ${JSON.stringify(ecosystemKnowledge?.slice(0, 4) || [])}
- Full-Dataset Column Profiles: ${JSON.stringify(columns || [])}
- Top Bivariate Correlations (Pearson r): ${JSON.stringify(topCorrelations || [])}
- Pre-Executed 100% Deterministic Sandbox Output on ALL Rows (use these exact verified numbers when citing dataset metrics): ${JSON.stringify(deterministicResult || {})}
- Sample Rows (Schema Context): ${JSON.stringify(sampleRows?.slice(0, 4) || [])}

Recent Conversation History:
${JSON.stringify(history?.slice(-6) || [])}

User's Request / Problem to Resolve: "${message}"

Instructions for Unrestricted Problem Solving:
1. NEVER refuse a business, analytical, mathematical, coding, or operational question. If the dataset lacks a direct column for what the user wants, invent a smart proxy calculation or multi-step workaround using existing columns or external industry benchmarks.
2. Cite exact verified numbers from the Pre-Executed Deterministic Sandbox Output and Column Profiles whenever relevant.
3. Provide a clear, structured solution in JSON with:
   - reply: Comprehensive, plain-English + technical resolution directly solving the user's request with quantified business steps.
   - workaroundStrategy: Concrete step-by-step workaround or proxy methodology to solve the problem even under data/operational constraints.
   - customSqlOrFormula: Exact SQL query, Python pandas snippet, or Excel/Power BI DAX formula that implements the solution for their specific request.
   - executableRuleCommand: A short plain-English pipeline command (e.g., "Cap Prep_Time_Mins at maximum 30" or "Flag rows where Net_Revenue > 500") that the user can click to immediately transform the dataset in Rexor.
   - nextStepLabel: Action button label to jump to the best stage in the workbench.
   - suggestedView: One of "overview", "problem-data", "cleaning", "analysis", "visuals-actions", or "bi-studio".
   - followUpQuestions: 3 smart follow-up prompts tailored to their problem.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              workaroundStrategy: { type: Type.STRING },
              customSqlOrFormula: { type: Type.STRING },
              executableRuleCommand: { type: Type.STRING },
              nextStepLabel: { type: Type.STRING },
              suggestedView: {
                type: Type.STRING,
                description:
                  "overview, problem-data, cleaning, analysis, visuals-actions, or bi-studio",
              },
              followUpQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              "reply",
              "workaroundStrategy",
              "customSqlOrFormula",
              "executableRuleCommand",
              "nextStepLabel",
              "suggestedView",
              "followUpQuestions",
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json(parsed);
    } catch (error: any) {
      console.error("Rexor chat error:", error);
      return res.status(500).json({
        error: error?.message || "Failed to generate assistant reply.",
      });
    }
  });

  // Universal Python Data Science & N-Task Execution Endpoint (Backed by 100% Deterministic Full-Dataset Execution)
  app.post("/api/rexor/python-task", async (req, res) => {
    try {
      const {
        taskPrompt,
        customPythonCode,
        datasetName,
        rowCount,
        columns,
        topCorrelations,
        sampleRows,
        activeUserRequirements,
        ecosystemKnowledge,
        deterministicResult,
      } = req.body;

      const ai = getGenAIClient();

      const prompt = `You are the Rexor Universal Python Data Science & Analytics Engine (authored & licensed by Rushi Chavan).
A user is executing the following data analytics task in Python on dataset "${datasetName}" (${rowCount} cleaned rows):
Task Request: "${taskPrompt || "Execute the provided Python analytical script and summarize quantitative results."}"
${customPythonCode ? `User's Current Python Script:\n${customPythonCode}` : ""}
Active User Requirements Applied: ${JSON.stringify(activeUserRequirements || [])}
Senior Analyst Ecosystem Heuristics: ${JSON.stringify(ecosystemKnowledge?.slice(0, 4) || [])}

Dataset Column Profiles (computed on 100% of ${rowCount} rows):
${JSON.stringify(columns)}

Top Correlations (computed on 100% of ${rowCount} rows):
${JSON.stringify(topCorrelations)}

Pre-Executed 100% Deterministic Sandbox Result (computed on ALL ${rowCount} rows — DO NOT hallucinate or alter these numbers):
${JSON.stringify(deterministicResult || {})}

Sample Rows (schema reference only):
${JSON.stringify(sampleRows?.slice(0, 5))}

Return JSON with:
1. taskTitle: Clear title of the analytical task executed.
2. pythonCode: Complete, production-grade Python script using pandas, numpy, scipy.stats, or scikit-learn referencing the exact column names of "${datasetName}".
3. consoleStdout: Use the exact verified numbers from the Pre-Executed 100% Deterministic Sandbox Result.
4. outputColumns: Array of column header strings from the deterministic execution.
5. outputRows: Array of result rows from the deterministic execution.
6. analyticalInterpretation: 2-3 sentences interpreting the exact deterministic numbers and recommending the next business or modeling step.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              taskTitle: { type: Type.STRING },
              pythonCode: { type: Type.STRING },
              consoleStdout: { type: Type.STRING },
              outputColumns: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              outputRows: {
                type: Type.ARRAY,
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                description: "Each inner array has values corresponding to outputColumns in order.",
              },
              analyticalInterpretation: { type: Type.STRING },
            },
            required: [
              "taskTitle",
              "pythonCode",
              "consoleStdout",
              "outputColumns",
              "outputRows",
              "analyticalInterpretation",
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      // Always enforce the 100% deterministic table & stdout if provided by the client's in-memory execution engine
      if (deterministicResult) {
        return res.json({
          taskTitle: parsed.taskTitle || deterministicResult.taskTitle,
          pythonCode: parsed.pythonCode || deterministicResult.pythonCode,
          consoleStdout: deterministicResult.consoleStdout,
          outputColumns: deterministicResult.outputColumns,
          outputRows: deterministicResult.outputRows,
          analyticalInterpretation:
            parsed.analyticalInterpretation ||
            deterministicResult.analyticalInterpretation,
        });
      }
      return res.json(parsed);
    } catch (error: any) {
      console.error("Rexor python-task error:", error);
      return res.status(500).json({
        error: error?.message || "Failed to execute AI Python task.",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Rexor server running on http://localhost:${PORT}`);
  });
}

startServer();
