import { getContributors } from "../services/contributorService.js";

export const getRepoContributors = async (req, res) => {
    try {
        const { owner, repo } = req.params;

        if (!owner || !repo) {
            return res.status(400).json({ message: "owner and repo are required" });
        }

        const data = await getContributors(owner, repo);

        res.json({ success: true, ...data });
    } catch (err) {
        console.error("Contributor fetch error:", err.message);
        res.status(500).json({ error: err.message });
    }
};
