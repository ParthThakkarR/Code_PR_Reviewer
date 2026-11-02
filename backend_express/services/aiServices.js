import axios from "axios";

export const analyzeWithAI = async (code, staticData, language) => {

    const formattedData = {
        pylint: staticData.pylint,
        bandit: staticData.bandit,
        radon: staticData.radon
    };

    const prompt = `
  You are a senior software engineer.

  Language: ${language}

  Analyze this code using:
  1. Code itself
  2. Static analysis

  Return ONLY valid JSON:

  {
    "bugs": [],
    "security": [],
    "performance": [],
    "best_practices": [],
    "severity_summary": {
      "high": 0,
      "medium": 0,
      "low": 0
    }
  }

  Static Analysis:
  ${JSON.stringify(formattedData)}

  Code:
  ${code}
  `;

    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
            contents: [{ parts: [{ text: prompt }] }]
        },
        { timeout: 30000 }
    );

    const raw = response.data.candidates[0].content.parts[0].text;

    const cleaned = raw.replace(/```json|```/g, "").trim();

    try {
        return JSON.parse(cleaned);
    } catch (err) {
        throw new Error("Invalid AI JSON response");
    }
};
