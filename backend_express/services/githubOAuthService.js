import axios from "axios";

export const getUserRepos = async (token) => {
    const res = await axios.get("https://api.github.com/user/repos", {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    return res.data;
};
