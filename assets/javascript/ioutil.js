export const fetchIgnoreCORS = async (url) => {
    let res
    try {
        res = await fetch(url).then(res => res.blob());
    } catch {
        console.log(`File ${url} blocked by CORS, trying proxy`);
        res = await fetch(`https://cors-anywhere.herokuapp.com/${Emoji(renamedEmoji[i].id, renamedEmoji[i].animated)}`).then(res => res.blob());
    }

    return res;
};
