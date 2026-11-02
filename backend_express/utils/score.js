export const calculateScore = (aiData) => {
    const severity = aiData?.severity_summary;

    if (!severity) return 100;

    const { high = 0, medium = 0, low = 0 } = severity;

    let score = 100;

    score -= high * 15;
    score -= medium * 8;
    score -= low * 3;

    return Math.max(score, 0);
};
