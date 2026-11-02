import jwt from "jsonwebtoken";
import axios from "axios";

export const generateAppJWT = () => {
    return jwt.sign(
        {
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 600,
            iss: process.env.GITHUB_APP_ID
        },
        process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n"),
        { algorithm: "RS256" }
    );
};

export const getInstallationToken = async () => {
    const jwtToken = generateAppJWT();

    const response = await axios.post(
        `https://api.github.com/app/installations/${process.env.GITHUB_INSTALLATION_ID}/access_tokens`,
        {},
        {
            headers: {
                Authorization: `Bearer ${jwtToken}`,
                Accept: "application/vnd.github+json"
            }
        }
    );

    return response.data.token;
};

export const getRepoFiles = async (owner, repo) => {
    const token = await getInstallationToken();

    const treeRes = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return treeRes.data.tree;
};

export const getFileContent = async (owner, repo, path) => {
    const token = await getInstallationToken();

    const res = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    const content = Buffer.from(res.data.content, "base64").toString();

    return content;
};
