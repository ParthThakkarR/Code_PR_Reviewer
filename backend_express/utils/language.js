export const detectLanguage = (filename) => {
    if (filename.endsWith(".py")) return "python";
    if (filename.endsWith(".js")) return "javascript";
    if (filename.endsWith(".ts")) return "typescript";
    return "unknown";
};
