import axios from "axios";

export const generateRepoSummary = async (results) => {
    const prompt = `
        You are a senior software architect.

        Given multiple file-level code analysis results, generate a repository-level summary.

        Return ONLY valid JSON:

        {
          "overall_score": number (0-100),
          "summary": "short paragraph",
          "top_issues": [],
          "recommendations": []
        }

        Results:
        ${JSON.stringify(results)}
    `;

    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
            contents: [{ parts: [{ text: prompt }] }]
        }
    );

    const raw = response.data.candidates[0].content.parts[0].text;

    const cleaned = raw.replace(/```json|```/g, "").trim();

    return JSON.parse(cleaned);
};
