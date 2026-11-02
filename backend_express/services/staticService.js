import axios from "axios";
import { exec } from "child_process";
import util from "util";
import os from "os";
import path from "path";
import fs from "fs";

const execPromise = util.promisify(exec);

export const getStaticAnalysis = async (code, language) => {
    if (language === "python") {
        const res = await axios.post(process.env.PYTHON_SERVICE_URL, { code });
        return res.data.analysis;
    }

    if (language === "javascript" || language === "typescript") {
        const ext = language === "typescript" ? "ts" : "js";
        const tmpPath = path.join(os.tmpdir(), `review_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);

        fs.writeFileSync(tmpPath, code);

        try {
            const { stdout, stderr } = await execPromise(`npx eslint ${tmpPath}`);
            return { eslint: stdout || stderr };
        } catch (err) {
            return { eslint: err.stdout || err.stderr };
        } finally {
            try { fs.unlinkSync(tmpPath); } catch (_) {}
        }
    }

    return {};
};
