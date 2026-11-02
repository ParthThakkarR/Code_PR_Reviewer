import crypto from "crypto";

export const generateHash = (code) => {
    return crypto.createHash("sha256").update(code).digest("hex");
};
